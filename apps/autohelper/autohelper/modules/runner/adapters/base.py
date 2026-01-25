"""
Site adapter base class and types.

Provides the foundation for site-specific scraping strategies.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from bs4 import BeautifulSoup


@dataclass
class SiteMatch:
    """Result of site detection."""

    adapter_name: str
    confidence: float  # 0-1, higher = better match
    metadata: dict[str, Any] = field(default_factory=dict)


class SiteAdapter(ABC):
    """
    Base class for site-specific scrapers.

    Subclasses implement detection and extraction logic for specific
    site platforms (Cargo, Squarespace, etc.).
    """

    @property
    @abstractmethod
    def name(self) -> str:
        """Adapter identifier (e.g., 'cargo', 'squarespace')."""

    @property
    @abstractmethod
    def patterns(self) -> list[str]:
        """URL/HTML patterns this adapter handles."""

    @abstractmethod
    def detect(self, url: str, html: str) -> SiteMatch | None:
        """
        Check if this adapter should handle the site.

        Args:
            url: The page URL
            html: Raw HTML content

        Returns:
            SiteMatch if this adapter can handle the site, None otherwise
        """

    @abstractmethod
    async def extract_pages(self, soup: "BeautifulSoup", base_url: str) -> list[str]:
        """
        Extract sub-page URLs to crawl (for multi-page sites).

        Args:
            soup: Parsed HTML document
            base_url: Base URL for resolving relative URLs

        Returns:
            List of absolute URLs to crawl
        """

    @abstractmethod
    async def extract_images(self, soup: "BeautifulSoup", base_url: str) -> list[str]:
        """
        Extract image URLs from a page.

        Args:
            soup: Parsed HTML document
            base_url: Base URL for resolving relative URLs

        Returns:
            List of absolute image URLs
        """

    async def extract_bio(self, soup: "BeautifulSoup") -> str | None:
        """
        Extract bio/about text from the page.

        Override in subclasses for site-specific bio extraction.

        Args:
            soup: Parsed HTML document

        Returns:
            Bio text or None if not found
        """
        return None
