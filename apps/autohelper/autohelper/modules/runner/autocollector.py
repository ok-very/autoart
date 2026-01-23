"""
AutoCollector Runner - Web scraping and local folder intake.

Collects artist data from websites or scans local folders for intake.
"""

import asyncio
import hashlib
import ipaddress
import mimetypes
import re
import shutil
import socket
import uuid
from pathlib import Path
from typing import AsyncIterator
from urllib.parse import urljoin, urlparse

from autohelper.shared.logging import get_logger

from .service import BaseRunner
from .types import ArtifactRef, RunnerId, RunnerProgress, RunnerResult

logger = get_logger(__name__)

# Blocked hostnames/patterns for SSRF protection
BLOCKED_HOSTNAMES = {
    "localhost",
    "127.0.0.1",
    "0.0.0.0",
    "::1",
    "metadata.google.internal",
    "metadata",
}

# Private/internal IP ranges to block
PRIVATE_IP_RANGES = [
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("169.254.0.0/16"),  # Link-local / AWS metadata
    ipaddress.ip_network("::1/128"),
    ipaddress.ip_network("fc00::/7"),  # IPv6 private
    ipaddress.ip_network("fe80::/10"),  # IPv6 link-local
]


def _resolve_all_ips(hostname: str) -> list[str]:
    """
    Resolve hostname to all IP addresses (both IPv4 and IPv6).

    Returns:
        List of IP address strings
    """
    ips = []
    try:
        # Use getaddrinfo to get both IPv4 and IPv6 addresses
        results = socket.getaddrinfo(hostname, None, socket.AF_UNSPEC, socket.SOCK_STREAM)
        for result in results:
            ip_str = result[4][0]
            if ip_str not in ips:
                ips.append(ip_str)
    except socket.gaierror:
        pass
    return ips


def _check_ips_against_private_ranges(ips: list[str]) -> tuple[bool, str]:
    """
    Check if any of the IPs are in private/internal ranges.

    Returns:
        Tuple of (is_private, error_message)
    """
    for ip_str in ips:
        try:
            ip = ipaddress.ip_address(ip_str)
            for network in PRIVATE_IP_RANGES:
                if ip in network:
                    return True, f"URL resolves to private/internal IP: {ip_str}"
        except ValueError:
            # Invalid IP address format, skip
            continue
    return False, ""


async def _is_safe_url(url: str) -> tuple[bool, str]:
    """
    Validate URL to prevent SSRF attacks.

    Returns:
        Tuple of (is_safe, error_message)
    """
    try:
        parsed = urlparse(url)

        # Only allow http/https
        if parsed.scheme not in ("http", "https"):
            return False, f"Unsupported URL scheme: {parsed.scheme}"

        hostname = parsed.hostname
        if not hostname:
            return False, "Invalid URL: no hostname"

        # Check blocked hostnames
        hostname_lower = hostname.lower()
        if hostname_lower in BLOCKED_HOSTNAMES:
            return False, f"Blocked hostname: {hostname}"

        # Try to resolve hostname and check if IP is private
        # Use asyncio.to_thread to avoid blocking the event loop
        # Resolve all IPs (both IPv4 and IPv6)
        ips = await asyncio.to_thread(_resolve_all_ips, hostname)
        if ips:
            is_private, error_msg = _check_ips_against_private_ranges(ips)
            if is_private:
                return False, error_msg

        return True, ""

    except Exception as e:
        return False, f"URL validation error: {e}"


class SSRFProtectedClient:
    """HTTP client wrapper that validates redirect URLs for SSRF protection."""

    def __init__(self, timeout: float):
        self.timeout = timeout

    async def get(self, url: str) -> "httpx.Response":
        """Fetch URL with SSRF protection on redirects."""
        httpx = _get_httpx()

        async with httpx.AsyncClient(
            timeout=self.timeout,
            follow_redirects=False,  # Handle redirects manually
        ) as client:
            max_redirects = 10
            current_url = url

            for _ in range(max_redirects):
                response = await client.get(current_url)

                # Check if this is a redirect
                if response.status_code in (301, 302, 303, 307, 308):
                    redirect_url = response.headers.get("location")
                    if not redirect_url:
                        raise ValueError("Redirect response missing Location header")

                    # Make absolute URL if relative
                    redirect_url = urljoin(current_url, redirect_url)

                    # Validate redirect URL for SSRF (using async to avoid blocking)
                    is_safe, error_msg = await _is_safe_url(redirect_url)
                    if not is_safe:
                        raise ValueError(f"Unsafe redirect blocked: {error_msg}")

                    current_url = redirect_url
                    continue

                # Not a redirect, return response
                return response

            raise ValueError(f"Too many redirects (max {max_redirects})")

# Lazy imports for optional dependencies
_httpx = None
_bs4 = None


def _get_httpx():
    """Lazy import httpx."""
    global _httpx
    if _httpx is None:
        try:
            import httpx
            _httpx = httpx
        except ImportError:
            raise ImportError(
                "httpx is required for web collection. "
                "Install with: pip install httpx"
            )
    return _httpx


def _get_bs4():
    """Lazy import BeautifulSoup."""
    global _bs4
    if _bs4 is None:
        try:
            from bs4 import BeautifulSoup
            _bs4 = BeautifulSoup
        except ImportError:
            raise ImportError(
                "beautifulsoup4 is required for web collection. "
                "Install with: pip install beautifulsoup4 lxml"
            )
    return _bs4


class AutoCollectorRunner(BaseRunner):
    """
    AutoCollector runner for web scraping and local folder intake.
    
    Modes:
    - Web: Provide 'url' in config to scrape a website
    - Local: Provide 'source_path' in config to scan a folder
    """
    
    SUPPORTED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".tiff"}
    MAX_IMAGES = 50  # Limit images per collection
    REQUEST_TIMEOUT = 30.0
    
    @property
    def runner_id(self) -> RunnerId:
        return RunnerId.AUTOCOLLECTOR
    
    async def invoke(
        self,
        config: dict,
        output_folder: Path,
        context_id: str | None = None,
    ) -> RunnerResult:
        """Execute the collector."""
        # Validate config is a dict
        if not isinstance(config, dict):
            return RunnerResult(
                success=False,
                error="Config must be a dictionary",
            )

        url = config.get("url")
        source_path = config.get("source_path")
        
        if url:
            return await self._collect_from_web(url, output_folder, context_id)
        elif source_path:
            return await self._collect_from_folder(
                Path(source_path), output_folder, context_id
            )
        else:
            return RunnerResult(
                success=False,
                error="Config must include 'url' or 'source_path'",
            )
    
    async def invoke_stream(
        self,
        config: dict,
        output_folder: Path,
        context_id: str | None = None,
    ) -> AsyncIterator[RunnerProgress]:
        """Execute with streaming progress."""
        # Validate config is a dict
        if not isinstance(config, dict):
            yield RunnerProgress(
                stage="error",
                message="Config must be a dictionary",
            )
            return

        url = config.get("url")
        source_path = config.get("source_path")
        
        if url:
            async for progress in self._collect_from_web_stream(
                url, output_folder, context_id
            ):
                yield progress
        elif source_path:
            async for progress in self._collect_from_folder_stream(
                Path(source_path), output_folder, context_id
            ):
                yield progress
        else:
            yield RunnerProgress(
                stage="error",
                message="Config must include 'url' or 'source_path'",
            )
    
    # =========================================================================
    # Web Collection
    # =========================================================================
    
    async def _collect_from_web(
        self,
        url: str,
        output_folder: Path,
        context_id: str | None,
    ) -> RunnerResult:
        """Collect content from a web URL."""
        # Validate URL for SSRF protection
        is_safe, error_msg = await _is_safe_url(url)
        if not is_safe:
            return RunnerResult(
                success=False,
                error=f"URL validation failed: {error_msg}",
            )

        BeautifulSoup = _get_bs4()

        artifacts: list[ArtifactRef] = []

        try:
            # Ensure output folder exists
            output_folder.mkdir(parents=True, exist_ok=True)

            # Fetch the page with SSRF-protected client
            protected_client = SSRFProtectedClient(timeout=self.REQUEST_TIMEOUT)
            response = await protected_client.get(url)
            response.raise_for_status()
            html = response.text
            
            # Parse HTML
            soup = BeautifulSoup(html, "lxml")
            
            # Extract text content (bio)
            bio_text = self._extract_bio_text(soup)
            if bio_text:
                bio_path = output_folder / "bio.txt"
                bio_path.write_text(bio_text, encoding="utf-8")
                artifacts.append(ArtifactRef(
                    ref_id=str(uuid.uuid4()),
                    path=str(bio_path),
                    artifact_type="text",
                    mime_type="text/plain",
                ))
            
            # Extract and download images
            image_urls = self._extract_image_urls(soup, url)
            downloaded = await self._download_images(
                image_urls, output_folder, context_id
            )
            artifacts.extend(downloaded)
            
            return RunnerResult(
                success=True,
                artifacts=artifacts,
            )
            
        except Exception as e:
            logger.exception(f"Web collection failed for {url}")
            return RunnerResult(
                success=False,
                error=str(e),
                artifacts=artifacts,
            )
    
    async def _collect_from_web_stream(
        self,
        url: str,
        output_folder: Path,
        context_id: str | None,
    ) -> AsyncIterator[RunnerProgress]:
        """Collect from web with streaming progress."""
        # Validate URL for SSRF protection
        is_safe, error_msg = await _is_safe_url(url)
        if not is_safe:
            yield RunnerProgress(stage="error", message=f"URL validation failed: {error_msg}")
            return

        BeautifulSoup = _get_bs4()

        yield RunnerProgress(stage="connecting", message=f"Fetching {url}...", percent=5)

        try:
            output_folder.mkdir(parents=True, exist_ok=True)

            # Fetch the page with SSRF-protected client
            protected_client = SSRFProtectedClient(timeout=self.REQUEST_TIMEOUT)
            response = await protected_client.get(url)
            response.raise_for_status()
            html = response.text
            
            yield RunnerProgress(stage="parsing", message="Parsing page content...", percent=20)
            
            soup = BeautifulSoup(html, "lxml")
            
            # Extract bio
            bio_text = self._extract_bio_text(soup)
            if bio_text:
                bio_path = output_folder / "bio.txt"
                bio_path.write_text(bio_text, encoding="utf-8")
                yield RunnerProgress(stage="bio", message="Extracted bio text", percent=30)
            
            # Get image URLs
            image_urls = self._extract_image_urls(soup, url)
            total_images = min(len(image_urls), self.MAX_IMAGES)

            yield RunnerProgress(
                stage="images",
                message=f"Found {total_images} images to download",
                percent=35,
            )

            # Download images with progress (skip if no images found)
            if total_images > 0:
                for i, img_url in enumerate(image_urls[:self.MAX_IMAGES]):
                    try:
                        await self._download_single_image(img_url, output_folder, i)
                        progress = 35 + int((i + 1) / total_images * 60)
                        yield RunnerProgress(
                            stage="downloading",
                            message=f"Downloaded image {i + 1}/{total_images}",
                            percent=progress,
                        )
                    except Exception as e:
                        logger.warning(f"Failed to download {img_url}: {e}")
            
            yield RunnerProgress(stage="complete", message="Collection complete!", percent=100)
            
        except Exception as e:
            yield RunnerProgress(stage="error", message=str(e))
    
    def _extract_bio_text(self, soup) -> str:
        """Extract likely bio/about text from page."""
        # Look for common bio containers
        bio_selectors = [
            "article",
            ".bio", ".about", ".artist-bio", ".biography",
            "#bio", "#about", "#artist-bio", "#biography",
            "[class*='bio']", "[class*='about']",
            "main p",
        ]
        
        text_parts = []
        for selector in bio_selectors:
            elements = soup.select(selector)
            for el in elements:
                text = el.get_text(separator="\n", strip=True)
                if len(text) > 100:  # Only keep substantial text
                    text_parts.append(text)
        
        # Deduplicate and join
        seen = set()
        unique_parts = []
        for part in text_parts:
            normalized = re.sub(r'\s+', ' ', part)[:200]  # Normalize for comparison
            if normalized not in seen:
                seen.add(normalized)
                unique_parts.append(part)
        
        return "\n\n---\n\n".join(unique_parts[:5])  # Limit to 5 sections
    
    def _extract_image_urls(self, soup, base_url: str) -> list[str]:
        """Extract image URLs from page."""
        image_urls = []
        
        # Find all img tags
        for img in soup.find_all("img"):
            src = img.get("src") or img.get("data-src") or img.get("data-lazy-src")
            if src:
                # Make absolute URL
                full_url = urljoin(base_url, src)
                # Filter by extension
                parsed = urlparse(full_url)
                ext = Path(parsed.path).suffix.lower()
                if ext in self.SUPPORTED_IMAGE_EXTENSIONS:
                    image_urls.append(full_url)
        
        # Also check for background images in style attributes
        for el in soup.find_all(style=re.compile(r'background.*url')):
            style = el.get("style", "")
            urls = re.findall(r'url\(["\']?([^"\']+)["\']?\)', style)
            for url in urls:
                full_url = urljoin(base_url, url)
                # Filter by extension like <img> tags
                parsed = urlparse(full_url)
                ext = Path(parsed.path).suffix.lower()
                if ext in self.SUPPORTED_IMAGE_EXTENSIONS:
                    image_urls.append(full_url)
        
        return list(dict.fromkeys(image_urls))  # Dedupe while preserving order
    
    async def _download_images(
        self,
        image_urls: list[str],
        output_folder: Path,
        context_id: str | None,
    ) -> list[ArtifactRef]:
        """Download images to output folder."""
        artifacts = []

        for i, url in enumerate(image_urls[:self.MAX_IMAGES]):
            try:
                artifact = await self._download_single_image(url, output_folder, i)
                if artifact:
                    artifacts.append(artifact)
            except Exception as e:
                logger.warning(f"Failed to download {url}: {e}")

        return artifacts
    
    async def _download_single_image(
        self,
        url: str,
        output_folder: Path,
        index: int,
    ) -> ArtifactRef | None:
        """Download a single image with SSRF protection on redirects."""
        # Validate initial image URL for SSRF protection
        is_safe, error_msg = await _is_safe_url(url)
        if not is_safe:
            logger.warning(f"Skipping unsafe image URL {url}: {error_msg}")
            return None

        try:
            # Use SSRF-protected client for image downloads
            protected_client = SSRFProtectedClient(timeout=self.REQUEST_TIMEOUT)
            response = await protected_client.get(url)
            response.raise_for_status()
            
            # Determine extension from content-type or URL
            content_type = response.headers.get("content-type", "")
            ext = mimetypes.guess_extension(content_type.split(";")[0]) or ".jpg"
            
            # Generate filename from URL hash
            url_hash = hashlib.md5(url.encode()).hexdigest()[:8]
            filename = f"image_{index:03d}_{url_hash}{ext}"
            filepath = output_folder / filename
            
            # Write file
            filepath.write_bytes(response.content)
            
            return ArtifactRef(
                ref_id=str(uuid.uuid4()),
                path=str(filepath),
                artifact_type="image",
                mime_type=content_type.split(";")[0] or "image/jpeg",
            )
            
        except Exception as e:
            logger.warning(f"Failed to download image {url}: {e}")
            return None
    
    # =========================================================================
    # Local Folder Collection
    # =========================================================================
    
    async def _collect_from_folder(
        self,
        source_path: Path,
        output_folder: Path,
        context_id: str | None,
    ) -> RunnerResult:
        """Collect files from a local folder."""
        # Run blocking filesystem checks in thread pool
        exists = await asyncio.to_thread(source_path.exists)
        if not exists:
            return RunnerResult(
                success=False,
                error=f"Source path does not exist: {source_path}",
            )

        is_dir = await asyncio.to_thread(source_path.is_dir)
        if not is_dir:
            return RunnerResult(
                success=False,
                error=f"Source path is not a directory: {source_path}",
            )

        artifacts: list[ArtifactRef] = []

        try:
            # Ensure output folder exists
            await asyncio.to_thread(output_folder.mkdir, parents=True, exist_ok=True)

            # Offload blocking rglob to thread pool
            # Resolve source_path to absolute for symlink validation
            resolved_source = source_path.resolve()

            def scan_files() -> list[Path]:
                safe_files = []
                for item in source_path.rglob("*"):
                    if not item.is_file():
                        continue
                    # Resolve symlinks and verify the target is within source_path
                    try:
                        resolved_item = item.resolve()
                        # Check if resolved path is within the source directory
                        resolved_item.relative_to(resolved_source)
                        safe_files.append(item)
                    except ValueError:
                        # Path is outside source_path (symlink escape attempt)
                        logger.warning(f"Skipping file outside source path: {item} -> {resolved_item}")
                        continue
                return safe_files

            files = await asyncio.to_thread(scan_files)

            for item in files:
                # Determine artifact type from extension
                ext = item.suffix.lower()
                if ext in self.SUPPORTED_IMAGE_EXTENSIONS:
                    artifact_type = "image"
                elif ext in {".txt", ".md", ".doc", ".docx", ".pdf"}:
                    artifact_type = "document"
                else:
                    artifact_type = "file"

                mime_type, _ = mimetypes.guess_type(str(item))

                # Copy file to output_folder preserving relative structure
                rel_path = item.relative_to(source_path)
                dest_path = output_folder / rel_path
                await asyncio.to_thread(dest_path.parent.mkdir, parents=True, exist_ok=True)
                await asyncio.to_thread(shutil.copy2, item, dest_path)

                artifacts.append(ArtifactRef(
                    ref_id=str(uuid.uuid4()),
                    path=str(dest_path),
                    artifact_type=artifact_type,
                    mime_type=mime_type,
                ))

            return RunnerResult(
                success=True,
                artifacts=artifacts,
            )

        except Exception as e:
            logger.exception(f"Folder collection failed for {source_path}")
            return RunnerResult(
                success=False,
                error=str(e),
                artifacts=artifacts,
            )
    
    async def _collect_from_folder_stream(
        self,
        source_path: Path,
        output_folder: Path,
        context_id: str | None,
    ) -> AsyncIterator[RunnerProgress]:
        """Collect from folder with streaming progress."""
        yield RunnerProgress(
            stage="scanning",
            message=f"Scanning {source_path}...",
            percent=10,
        )

        # Run blocking filesystem check in thread pool
        exists = await asyncio.to_thread(source_path.exists)
        if not exists:
            yield RunnerProgress(
                stage="error",
                message=f"Source path does not exist: {source_path}",
            )
            return

        is_dir = await asyncio.to_thread(source_path.is_dir)
        if not is_dir:
            yield RunnerProgress(
                stage="error",
                message=f"Source path is not a directory: {source_path}",
            )
            return

        # Ensure output folder exists
        await asyncio.to_thread(output_folder.mkdir, parents=True, exist_ok=True)

        # Offload blocking rglob to thread pool
        # Resolve source_path to absolute for symlink validation
        resolved_source = await asyncio.to_thread(source_path.resolve)

        def scan_files() -> list[Path]:
            safe_files = []
            for f in source_path.rglob("*"):
                if not f.is_file():
                    continue
                # Resolve symlinks and verify the target is within source_path
                try:
                    resolved_f = f.resolve()
                    # Check if resolved path is within the source directory
                    resolved_f.relative_to(resolved_source)
                    safe_files.append(f)
                except ValueError:
                    # Path is outside source_path (symlink escape attempt)
                    logger.warning(f"Skipping file outside source path: {f}")
                    continue
            return safe_files

        files = await asyncio.to_thread(scan_files)
        total = len(files)

        yield RunnerProgress(
            stage="processing",
            message=f"Found {total} files",
            percent=30,
        )

        # Handle empty directory case
        if total == 0:
            yield RunnerProgress(
                stage="complete",
                message="No files found in directory",
                percent=100,
            )
            return

        # Process files - copy to output folder and create artifact references
        artifacts_collected = 0
        for i, item in enumerate(files):
            try:
                # Determine artifact type from extension
                ext = item.suffix.lower()
                if ext in self.SUPPORTED_IMAGE_EXTENSIONS:
                    artifact_type = "image"
                elif ext in {".txt", ".md", ".doc", ".docx", ".pdf"}:
                    artifact_type = "document"
                else:
                    artifact_type = "file"

                # Copy file to output_folder preserving relative structure
                rel_path = item.relative_to(source_path)
                dest_path = output_folder / rel_path
                await asyncio.to_thread(dest_path.parent.mkdir, parents=True, exist_ok=True)
                await asyncio.to_thread(shutil.copy2, item, dest_path)
                artifacts_collected += 1
            except Exception as e:
                logger.warning(f"Failed to copy {item}: {e}")

            progress = 30 + int((i + 1) / total * 65)
            if i % 10 == 0:  # Update every 10 files
                yield RunnerProgress(
                    stage="processing",
                    message=f"Processed {i + 1}/{total} files",
                    percent=progress,
                )
            await asyncio.sleep(0)  # Yield control

        yield RunnerProgress(
            stage="complete",
            message=f"Collected {artifacts_collected} files",
            percent=100,
        )
