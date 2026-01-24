"""
Artifact naming utilities.

Provides configurable filename generation with template variables and fallback chains.
"""

import hashlib
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

from .types import NamingConfig, NumberingMode


class IndexCounter:
    """
    Counter for artifact numbering.

    Supports two modes:
    - SEQUENTIAL: Global counter across all sources
    - BY_SOURCE: Separate counter per source URL/path
    """

    def __init__(self, start: int = 1, mode: NumberingMode = NumberingMode.SEQUENTIAL):
        """
        Initialize counter.

        Args:
            start: Starting index (default 1)
            mode: Numbering mode (sequential or by_source)
        """
        self.start = start
        self.mode = mode
        self._global = start - 1
        self._by_source: dict[str, int] = {}

    def next(self, source_key: str | None = None) -> int:
        """
        Get next index.

        Args:
            source_key: Source identifier (used for BY_SOURCE mode)

        Returns:
            Next index value
        """
        if self.mode == NumberingMode.SEQUENTIAL:
            self._global += 1
            return self._global
        else:
            key = source_key or "default"
            if key not in self._by_source:
                self._by_source[key] = self.start - 1
            self._by_source[key] += 1
            return self._by_source[key]

    def current(self, source_key: str | None = None) -> int:
        """Get current index without incrementing."""
        if self.mode == NumberingMode.SEQUENTIAL:
            return self._global
        else:
            key = source_key or "default"
            return self._by_source.get(key, self.start - 1)


def _slugify(text: str, max_length: int = 50) -> str:
    """
    Convert text to a filesystem-safe slug.

    Args:
        text: Input text
        max_length: Maximum slug length

    Returns:
        Slugified string
    """
    # Lowercase and replace spaces/underscores with hyphens
    slug = text.lower().strip()
    slug = re.sub(r'[\s_]+', '-', slug)
    # Remove non-alphanumeric characters except hyphens
    slug = re.sub(r'[^a-z0-9\-]', '', slug)
    # Collapse multiple hyphens
    slug = re.sub(r'-+', '-', slug)
    # Trim leading/trailing hyphens
    slug = slug.strip('-')
    # Truncate
    if len(slug) > max_length:
        slug = slug[:max_length].rstrip('-')
    return slug or "untitled"


def resolve_template_var(
    var: str,
    context: dict[str, Any],
    index: int,
    index_padding: int = 3,
    date_format: str = "%Y%m%d",
) -> str:
    """
    Resolve a single template variable with fallback chain.

    Args:
        var: Variable name (e.g., "artist", "title", "index")
        context: Context dictionary with metadata
        index: Current index value
        index_padding: Zero-padding width for index
        date_format: strftime format for date

    Returns:
        Resolved value string
    """
    match var:
        case "index":
            return str(index).zfill(index_padding)

        case "hash":
            # Use content hash or URL hash from context
            content_hash = context.get("content_hash", "")
            url_hash = context.get("url_hash", "")
            return (content_hash[:8] or url_hash[:8] or "00000000")

        case "date":
            timestamp = context.get("timestamp")
            if timestamp:
                try:
                    dt = datetime.fromisoformat(timestamp)
                except ValueError:
                    dt = datetime.now(timezone.utc)
            else:
                dt = datetime.now(timezone.utc)
            return dt.strftime(date_format)

        case "ext":
            # Extension without the dot
            ext = context.get("extension", ".jpg")
            return ext.lstrip(".")

        case "artist":
            # Fallback chain for artist
            artist = (
                context.get("artist")
                or context.get("page_author")
                or context.get("folder_name")
                or "unknown-artist"
            )
            return _slugify(artist)

        case "title":
            # Fallback chain for title
            title = (
                context.get("alt_text")
                or context.get("caption")
                or context.get("filename_stem")
                or f"untitled-{index}"
            )
            return _slugify(title)

        case "source":
            # Hostname or folder name
            source_url = context.get("source_url")
            source_path = context.get("source_path")
            if source_url:
                parsed = urlparse(source_url)
                return _slugify(parsed.hostname or "web")
            elif source_path:
                return _slugify(Path(source_path).name)
            else:
                return "local"

        case _:
            # Unknown variable - try context, fallback to empty
            return str(context.get(var, ""))


def generate_filename(
    config: NamingConfig,
    context: dict[str, Any],
    index: int,
    extension: str,
) -> str:
    """
    Generate filename from template configuration.

    Args:
        config: Naming configuration with template
        context: Context dictionary with metadata
        index: Current index value
        extension: File extension (with or without dot)

    Returns:
        Generated filename (without path)
    """
    # Ensure extension has dot
    if extension and not extension.startswith("."):
        extension = f".{extension}"

    # Add extension to context for {ext} variable
    context = {**context, "extension": extension}

    # Parse template and replace variables
    template = config.template

    def replace_var(match: re.Match) -> str:
        var_name = match.group(1)
        return resolve_template_var(
            var_name,
            context,
            index,
            index_padding=config.index_padding,
            date_format=config.date_format,
        )

    # Replace {var} patterns
    filename = re.sub(r'\{(\w+)\}', replace_var, template)

    # Apply prefix and suffix
    if config.prefix:
        filename = f"{config.prefix}{filename}"
    if config.suffix:
        filename = f"{filename}{config.suffix}"

    # Add extension
    filename = f"{filename}{extension}"

    # Sanitize filename (remove dangerous characters)
    filename = re.sub(r'[<>:"/\\|?*]', '', filename)
    filename = filename.strip('. ')

    return filename or f"artifact_{index:03d}{extension}"


def generate_persistent_id(
    content: bytes,
    source: str,
    timestamp: str,
) -> str:
    """
    Generate a stable, persistent artifact ID.

    The ID is deterministic based on content hash, source, and timestamp,
    allowing the same artifact to be identified even if moved.

    Args:
        content: File content bytes
        source: Source URL or path
        timestamp: ISO timestamp string

    Returns:
        UUID string (stable for same inputs)
    """
    content_hash = hashlib.sha256(content).hexdigest()
    id_input = f"{content_hash}:{source}:{timestamp}"
    return str(uuid.uuid5(uuid.NAMESPACE_URL, id_input))


def compute_content_hash(content: bytes) -> str:
    """
    Compute SHA-256 hash of file content.

    Args:
        content: File content bytes

    Returns:
        Hex-encoded hash string
    """
    return hashlib.sha256(content).hexdigest()


def compute_url_hash(url: str) -> str:
    """
    Compute MD5 hash of URL (for filename generation).

    Args:
        url: URL string

    Returns:
        First 8 characters of hex-encoded hash
    """
    return hashlib.md5(url.encode()).hexdigest()[:8]
