"""
Web collector for scraping images and content from URLs.

Collects artifacts from web pages with SSRF protection and manifest tracking.
"""

import asyncio
import logging
import mimetypes
import uuid
from collections.abc import AsyncIterator
from datetime import UTC, datetime
from pathlib import Path
from typing import TYPE_CHECKING

from ..adapters import AdapterRegistry
from ..naming import (
    IndexCounter,
    compute_content_hash,
    compute_url_hash,
    generate_filename,
    generate_persistent_id,
)
from ..ssrf import SSRFProtectedClient, is_safe_url
from ..types import (
    ArtifactManifestEntry,
    ArtifactRef,
    CollectionManifest,
    NamingConfig,
    RunnerProgress,
    RunnerResult,
)
from .base import MAX_IMAGES, REQUEST_TIMEOUT

if TYPE_CHECKING:
    from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

# Lazy imports for optional dependencies
_bs4 = None


def _get_bs4():
    """Lazy import BeautifulSoup."""
    global _bs4
    if _bs4 is None:
        try:
            from bs4 import BeautifulSoup

            _bs4 = BeautifulSoup
        except ImportError as e:
            raise ImportError(
                "beautifulsoup4 is required for web collection. "
                "Install with: pip install beautifulsoup4 lxml"
            ) from e
    return _bs4


def _get_html_parser() -> str:
    """Determine the best available HTML parser, with fallback."""
    try:
        import lxml  # noqa: F401

        return "lxml"
    except ImportError:
        logger.info("lxml not available, falling back to html.parser")
        return "html.parser"


class WebCollector:
    """
    Collector for web-based artifact sources.

    Downloads images and extracts text content from web pages,
    with SSRF protection and manifest tracking.
    """

    def __init__(
        self,
        timeout: float = REQUEST_TIMEOUT,
        max_images: int = MAX_IMAGES,
    ):
        """
        Initialize the web collector.

        Args:
            timeout: Request timeout in seconds
            max_images: Maximum images to collect per page
        """
        self.timeout = timeout
        self.max_images = max_images

    async def collect(
        self,
        source: str,
        output_folder: Path,
        naming_config: NamingConfig,
        context_id: str | None = None,
    ) -> RunnerResult:
        """
        Collect artifacts from a web URL.

        Args:
            source: Web URL to collect from
            output_folder: Output folder for artifacts
            naming_config: Configuration for artifact naming
            context_id: Optional context identifier

        Returns:
            RunnerResult with collection outcome
        """
        # Validate URL for SSRF protection
        is_safe, error_msg = await is_safe_url(source)
        if not is_safe:
            return RunnerResult(
                success=False,
                error=f"URL validation failed: {error_msg}",
            )

        BeautifulSoup = _get_bs4()
        artifacts: list[ArtifactRef] = []
        manifest_entries: list[ArtifactManifestEntry] = []
        now = datetime.now(UTC).isoformat()

        try:
            # Ensure output folder exists
            output_folder.mkdir(parents=True, exist_ok=True)

            # Initialize index counter
            counter = IndexCounter(
                start=naming_config.index_start,
                mode=naming_config.numbering_mode,
            )

            # Fetch the page
            client = SSRFProtectedClient(timeout=self.timeout)
            response = await client.get(source)
            response.raise_for_status()
            html = response.text

            # Parse HTML
            soup = BeautifulSoup(html, _get_html_parser())

            # Detect site type and get appropriate adapter
            adapter, match = AdapterRegistry.detect(source, html)
            logger.info(f"Detected site type: {adapter.name} (confidence: {match.confidence})")

            # Extract bio text using adapter
            bio_text = await adapter.extract_bio(soup)
            if bio_text:
                bio_path = output_folder / "bio.txt"
                await asyncio.to_thread(bio_path.write_text, bio_text, encoding="utf-8")
                artifacts.append(
                    ArtifactRef(
                        ref_id=str(uuid.uuid4()),
                        path=str(bio_path),
                        artifact_type="text",
                        mime_type="text/plain",
                    )
                )

            # Extract sub-pages (for multi-page sites like Cargo)
            all_pages: list[tuple[str, "BeautifulSoup"]] = [(source, soup)]
            page_urls = await adapter.extract_pages(soup, source)

            for page_url in page_urls[:10]:  # Limit sub-pages
                try:
                    is_page_safe, _ = await is_safe_url(page_url)
                    if not is_page_safe:
                        continue
                    page_response = await client.get(page_url)
                    page_response.raise_for_status()
                    page_soup = BeautifulSoup(page_response.text, _get_html_parser())
                    all_pages.append((page_url, page_soup))
                except Exception as e:
                    logger.warning(f"Failed to fetch sub-page {page_url}: {e}")

            # Extract images from all pages using adapter
            image_urls: list[str] = []
            for page_url, page_soup in all_pages:
                page_images = await adapter.extract_images(page_soup, page_url)
                image_urls.extend(page_images)

            # Deduplicate while preserving order
            image_urls = list(dict.fromkeys(image_urls))
            logger.info(f"Found {len(image_urls)} images across {len(all_pages)} pages")

            for img_url in image_urls[: self.max_images]:
                result = await self._download_image(
                    img_url,
                    output_folder,
                    counter,
                    naming_config,
                    source,
                    now,
                )
                if result:
                    artifact, entry = result
                    artifacts.append(artifact)
                    manifest_entries.append(entry)

            # Save manifest
            await self._save_manifest(output_folder, source, naming_config, manifest_entries, now)

            return RunnerResult(success=True, artifacts=artifacts)

        except Exception as e:
            logger.exception(f"Web collection failed for {source}")
            return RunnerResult(success=False, error=str(e), artifacts=artifacts)

    async def collect_stream(
        self,
        source: str,
        output_folder: Path,
        naming_config: NamingConfig,
        context_id: str | None = None,
    ) -> AsyncIterator[RunnerProgress]:
        """
        Collect from web with streaming progress.

        Args:
            source: Web URL to collect from
            output_folder: Output folder for artifacts
            naming_config: Configuration for artifact naming
            context_id: Optional context identifier

        Yields:
            RunnerProgress events during collection
        """
        # Validate URL for SSRF protection
        is_safe, error_msg = await is_safe_url(source)
        if not is_safe:
            yield RunnerProgress(stage="error", message=f"URL validation failed: {error_msg}")
            return

        BeautifulSoup = _get_bs4()
        manifest_entries: list[ArtifactManifestEntry] = []
        now = datetime.now(UTC).isoformat()

        yield RunnerProgress(stage="connecting", message=f"Fetching {source}...", percent=5)

        try:
            output_folder.mkdir(parents=True, exist_ok=True)

            # Initialize index counter
            counter = IndexCounter(
                start=naming_config.index_start,
                mode=naming_config.numbering_mode,
            )

            # Fetch the page
            client = SSRFProtectedClient(timeout=self.timeout)
            response = await client.get(source)
            response.raise_for_status()
            html = response.text

            yield RunnerProgress(stage="parsing", message="Parsing page content...", percent=15)

            soup = BeautifulSoup(html, _get_html_parser())

            # Detect site type and get appropriate adapter
            adapter, match = AdapterRegistry.detect(source, html)
            logger.info(f"Detected site type: {adapter.name} (confidence: {match.confidence})")

            yield RunnerProgress(
                stage="detecting",
                message=f"Detected site type: {adapter.name}",
                percent=20,
            )

            # Extract bio using adapter
            bio_text = await adapter.extract_bio(soup)
            if bio_text:
                bio_path = output_folder / "bio.txt"
                await asyncio.to_thread(bio_path.write_text, bio_text, encoding="utf-8")
                yield RunnerProgress(stage="bio", message="Extracted bio text", percent=25)

            # Extract sub-pages (for multi-page sites)
            all_pages: list[tuple[str, "BeautifulSoup"]] = [(source, soup)]
            page_urls = await adapter.extract_pages(soup, source)

            if page_urls:
                yield RunnerProgress(
                    stage="pages",
                    message=f"Found {len(page_urls)} sub-pages to crawl",
                    percent=28,
                )

            for page_url in page_urls[:10]:  # Limit sub-pages
                try:
                    is_page_safe, _ = await is_safe_url(page_url)
                    if not is_page_safe:
                        continue
                    page_response = await client.get(page_url)
                    page_response.raise_for_status()
                    page_soup = BeautifulSoup(page_response.text, _get_html_parser())
                    all_pages.append((page_url, page_soup))
                except Exception as e:
                    logger.warning(f"Failed to fetch sub-page {page_url}: {e}")

            # Extract images from all pages using adapter
            image_urls: list[str] = []
            for page_url, page_soup in all_pages:
                page_images = await adapter.extract_images(page_soup, page_url)
                image_urls.extend(page_images)

            # Deduplicate while preserving order
            image_urls = list(dict.fromkeys(image_urls))
            total_images = min(len(image_urls), self.max_images)

            yield RunnerProgress(
                stage="images",
                message=f"Found {total_images} images to download",
                percent=35,
            )

            # Download images with progress
            if total_images > 0:
                for i, img_url in enumerate(image_urls[: self.max_images]):
                    try:
                        result = await self._download_image(
                            img_url,
                            output_folder,
                            counter,
                            naming_config,
                            source,
                            now,
                        )
                        if result:
                            _, entry = result
                            manifest_entries.append(entry)

                        progress = 35 + int((i + 1) / total_images * 60)
                        yield RunnerProgress(
                            stage="downloading",
                            message=f"Downloaded image {i + 1}/{total_images}",
                            percent=progress,
                        )
                    except Exception as e:
                        logger.warning(f"Failed to download {img_url}: {e}")

            # Save manifest
            await self._save_manifest(output_folder, source, naming_config, manifest_entries, now)

            yield RunnerProgress(stage="complete", message="Collection complete!", percent=100)

        except Exception as e:
            yield RunnerProgress(stage="error", message=str(e))

    async def _download_image(
        self,
        url: str,
        output_folder: Path,
        counter: IndexCounter,
        naming_config: NamingConfig,
        source_url: str,
        timestamp: str,
    ) -> tuple[ArtifactRef, ArtifactManifestEntry] | None:
        """
        Download a single image with naming and manifest entry creation.

        Returns:
            Tuple of (ArtifactRef, ArtifactManifestEntry) or None if failed
        """
        # Validate URL for SSRF protection
        is_safe, error_msg = await is_safe_url(url)
        if not is_safe:
            logger.warning(f"Skipping unsafe image URL {url}: {error_msg}")
            return None

        try:
            client = SSRFProtectedClient(timeout=self.timeout)
            response = await client.get(url)
            response.raise_for_status()
            content = response.content

            # Validate content-type
            content_type = response.headers.get("content-type", "")
            content_type_base = content_type.split(";")[0].strip().lower()
            if not content_type_base.startswith("image/"):
                logger.warning(f"Skipping non-image content-type {content_type_base} from {url}")
                return None

            ext = mimetypes.guess_extension(content_type_base) or ".jpg"

            # Build context for filename generation
            context = {
                "source_url": source_url,
                "url_hash": compute_url_hash(url),
                "content_hash": compute_content_hash(content),
                "timestamp": timestamp,
            }

            # Generate filename using naming config
            index = counter.next(source_key=source_url)
            filename = generate_filename(naming_config, context, index, ext)
            filepath = output_folder / filename

            # Write file
            await asyncio.to_thread(filepath.write_bytes, content)

            # Generate persistent ID
            artifact_id = generate_persistent_id(content, url, timestamp)

            # Create artifact reference
            artifact = ArtifactRef(
                ref_id=artifact_id,
                path=str(filepath),
                artifact_type="image",
                mime_type=content_type_base or "image/jpeg",
            )

            # Create manifest entry
            entry = ArtifactManifestEntry(
                artifact_id=artifact_id,
                original_filename=filename,
                current_filename=filename,
                content_hash=context["content_hash"],
                source_url=url,
                collected_at=timestamp,
                mime_type=content_type_base or "image/jpeg",
                size=len(content),
                metadata={
                    "source_page": source_url,
                    "url_hash": context["url_hash"],
                },
            )

            return artifact, entry

        except ValueError as e:
            logger.warning(f"Image URL blocked by SSRF protection {url}: {e}")
            return None
        except Exception as e:
            logger.warning(f"Failed to download image {url}: {e}")
            return None

    async def _save_manifest(
        self,
        output_folder: Path,
        source_url: str,
        naming_config: NamingConfig,
        entries: list[ArtifactManifestEntry],
        timestamp: str,
    ) -> None:
        """Save collection manifest to output folder."""
        from ...storage import get_metadata_backend

        manifest = CollectionManifest(
            manifest_id=str(uuid.uuid4()),
            created_at=timestamp,
            updated_at=timestamp,
            source_type="web",
            source_url=source_url,
            output_folder=str(output_folder),
            naming_config=naming_config,
            artifacts=entries,
        )

        backend = get_metadata_backend(output_folder)
        await backend.save_collection(manifest)
