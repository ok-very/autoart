"""
Cargo site adapter for portfolio sites hosted on cargo.site.

Handles multi-page extraction and JSON-embedded image data.
"""

import asyncio
import json
import re
from pathlib import Path
from typing import TYPE_CHECKING, Any
from urllib.parse import urljoin, urlparse

from .base import SiteAdapter, SiteMatch

if TYPE_CHECKING:
    from bs4 import BeautifulSoup

# Supported image extensions
SUPPORTED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".tiff"}


class CargoAdapter(SiteAdapter):
    """
    Adapter for Cargo portfolio sites (cargo.site, cargocollective.com).

    Cargo sites store content in JSON script tags and use a CDN for images.
    This adapter extracts project pages and finds original-size images.
    """

    @property
    def name(self) -> str:
        return "cargo"

    @property
    def patterns(self) -> list[str]:
        return ["cargo.site", "cargocollective.com"]

    def detect(self, url: str, html: str) -> SiteMatch | None:
        """Detect Cargo sites by URL or HTML markers."""
        # Check URL patterns
        if "cargo.site" in url or "cargocollective.com" in url:
            return SiteMatch("cargo", 0.95, {"platform": "cargo", "detected_by": "url"})

        # Check HTML markers
        cargo_markers = [
            "cargo.site",
            "Running on cargo.site",
            "freight.cargo.site",
            "cargocollective.com",
        ]
        for marker in cargo_markers:
            if marker in html:
                return SiteMatch("cargo", 0.9, {"platform": "cargo", "detected_by": "html"})

        return None

    async def extract_pages(self, soup: "BeautifulSoup", base_url: str) -> list[str]:
        """
        Extract project page URLs from Cargo JSON data.

        Cargo stores navigation data in script tags with type="text/json".
        """
        urls: list[str] = []

        # Look for JSON data in script tags
        for script in soup.find_all("script", type="text/json"):
            try:
                data = json.loads(script.string or "")
                urls.extend(self._find_project_urls(data, base_url))
            except (json.JSONDecodeError, TypeError):
                pass

        # Also check for data-content-data attributes
        for el in soup.find_all(attrs={"data-content-data": True}):
            try:
                data = json.loads(el.get("data-content-data", ""))
                urls.extend(self._find_project_urls(data, base_url))
            except (json.JSONDecodeError, TypeError):
                pass

        # Also look for navigation links
        for link in soup.find_all("a", href=True):
            href = link.get("href", "")
            # Skip anchors and mailto links
            if href.startswith("#") or href.startswith("mailto:"):
                continue
            # Skip static assets
            if href.startswith("/static"):
                continue
            # Resolve and validate URL
            full_url = urljoin(base_url, href)
            if full_url not in urls and self._is_same_domain(full_url, base_url):
                urls.append(full_url)

        return list(dict.fromkeys(urls))  # Deduplicate while preserving order

    async def extract_images(self, soup: "BeautifulSoup", base_url: str) -> list[str]:
        """
        Extract original-size images, skipping thumbnails.

        Cargo uses freight.cargo.site CDN with these patterns:
        - Original: /t/original/i/{hash}/{filename}
        - Thumbnail: /w/{width}/i/{hash}/{filename}
        """
        # Offload CPU-bound work to thread pool to avoid blocking event loop
        return await asyncio.to_thread(self._extract_images_sync, soup, base_url)

    def _extract_images_sync(self, soup: "BeautifulSoup", base_url: str) -> list[str]:
        """Synchronous image extraction (CPU-bound)."""
        urls: list[str] = []
        html_text = str(soup)

        # Pattern for original images (preferred)
        original_pattern = r'freight\.cargo\.site/t/original/[^"\s\\<>\']+\.(jpg|jpeg|png|gif|webp)'
        for match in re.finditer(original_pattern, html_text, re.IGNORECASE):
            url = "https://" + match.group(0).replace("\\/", "/")
            if self._is_supported_image(url):
                urls.append(url)

        # If no original images found, extract from JSON and img tags
        if not urls:
            urls.extend(self._extract_images_from_json(soup, base_url))
            urls.extend(self._extract_images_from_tags(soup, base_url))

        return list(dict.fromkeys(urls))  # Deduplicate while preserving order

    async def extract_bio(self, soup: "BeautifulSoup") -> str | None:
        """Extract bio from Cargo about section."""
        # Look for common Cargo bio containers
        bio_selectors = [
            ".about-text",
            ".bio-text",
            "[data-about]",
            ".profile-text",
            "#about",
        ]
        for selector in bio_selectors:
            el = soup.select_one(selector)
            if el:
                text = el.get_text(separator="\n", strip=True)
                if text:
                    return text
        return None

    def _find_project_urls(self, data: Any, base_url: str) -> list[str]:
        """Recursively find project URLs in JSON data."""
        urls: list[str] = []

        if isinstance(data, dict):
            # Look for URL-like keys
            for key in ("url", "href", "link", "path", "slug"):
                if key in data:
                    value = data[key]
                    if isinstance(value, str) and value:
                        full_url = urljoin(base_url, value)
                        if self._is_same_domain(full_url, base_url):
                            urls.append(full_url)

            # Look for projects/pages arrays
            for key in ("projects", "pages", "items", "works", "children"):
                if key in data and isinstance(data[key], list):
                    for item in data[key]:
                        urls.extend(self._find_project_urls(item, base_url))

            # Recurse into all dict values
            for value in data.values():
                if isinstance(value, (dict, list)):
                    urls.extend(self._find_project_urls(value, base_url))

        elif isinstance(data, list):
            for item in data:
                urls.extend(self._find_project_urls(item, base_url))

        return urls

    def _extract_images_from_json(self, soup: "BeautifulSoup", base_url: str) -> list[str]:
        """Extract image URLs from JSON data in script tags."""
        originals: list[str] = []
        thumbnails: list[str] = []

        for script in soup.find_all("script"):
            script_text = script.string or ""
            # Find freight.cargo.site URLs in any script content
            pattern = r'freight\.cargo\.site/[^"\s\\<>\']+\.(jpg|jpeg|png|gif|webp)'
            for match in re.finditer(pattern, script_text, re.IGNORECASE):
                url = "https://" + match.group(0).replace("\\/", "/")
                # Separate originals from thumbnails to preserve discovery order
                if "/t/original/" in url:
                    originals.append(url)
                elif self._is_supported_image(url):
                    thumbnails.append(url)

        # Return originals first (in discovery order), then thumbnails
        return originals + thumbnails

    def _extract_images_from_tags(self, soup: "BeautifulSoup", base_url: str) -> list[str]:
        """Extract images from standard HTML tags."""
        urls: list[str] = []

        for img in soup.find_all("img"):
            src = img.get("src") or img.get("data-src") or img.get("data-lazy-src")
            if src:
                full_url = urljoin(base_url, src)
                # Validate domain: allow same domain or Cargo CDN
                if not self._is_allowed_image_domain(full_url, base_url):
                    continue
                # Skip small thumbnails (width-based URLs)
                if "/w/" in full_url:
                    # Check if it's a very small thumbnail
                    width_match = re.search(r"/w/(\d+)/", full_url)
                    if width_match:
                        width = int(width_match.group(1))
                        if width < 800:  # Skip thumbnails under 800px
                            continue
                if self._is_supported_image(full_url):
                    urls.append(full_url)

        return urls

    def _is_allowed_image_domain(self, url: str, base_url: str) -> bool:
        """Check if URL is from an allowed domain (same domain or Cargo CDN)."""
        try:
            url_domain = urlparse(url).netloc.lower()
            # Allow Cargo CDN domains
            if url_domain in ("freight.cargo.site", "static.cargo.site"):
                return True
            # Allow same domain as base URL
            return self._is_same_domain(url, base_url)
        except Exception:
            return False

    def _is_supported_image(self, url: str) -> bool:
        """Check if URL points to a supported image type."""
        try:
            parsed = urlparse(url)
            ext = Path(parsed.path).suffix.lower()
            return ext in SUPPORTED_EXTENSIONS
        except Exception:
            return False

    def _is_same_domain(self, url: str, base_url: str) -> bool:
        """Check if URL is on the same domain as base."""
        try:
            url_domain = urlparse(url).netloc.lower()
            base_domain = urlparse(base_url).netloc.lower()
            return url_domain == base_domain
        except Exception:
            return False
