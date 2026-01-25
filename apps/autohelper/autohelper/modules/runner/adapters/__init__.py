"""
Site adapter registry and exports.

Provides automatic detection and selection of site-specific scrapers.
"""

import threading

from .base import SiteAdapter, SiteMatch


class AdapterRegistry:
    """
    Registry for site adapters with auto-detection.

    Maintains a list of adapters and selects the best match
    based on confidence scoring. Thread-safe for concurrent access.
    """

    _adapters: list[SiteAdapter] = []
    _default: SiteAdapter | None = None
    _lock: threading.Lock = threading.Lock()
    _initialized: bool = False

    @classmethod
    def register(cls, adapter: SiteAdapter, *, is_default: bool = False) -> None:
        """
        Register an adapter.

        Args:
            adapter: The adapter instance to register
            is_default: If True, use as fallback when no match found

        Note:
            Duplicate adapters (by name) are silently ignored.
        """
        with cls._lock:
            # Check for duplicate registration by adapter name
            existing_names = {a.name for a in cls._adapters}
            if adapter.name in existing_names:
                return

            cls._adapters.append(adapter)
            if is_default:
                cls._default = adapter

    @classmethod
    def detect(cls, url: str, html: str) -> tuple[SiteAdapter, SiteMatch]:
        """
        Find the best matching adapter for URL/HTML.

        Args:
            url: The page URL
            html: Raw HTML content

        Returns:
            Tuple of (adapter, match) with highest confidence
        """
        matches: list[tuple[SiteAdapter, SiteMatch]] = []

        with cls._lock:
            # Copy the list to avoid holding lock during detection
            adapters = list(cls._adapters)
            default = cls._default

        for adapter in adapters:
            match = adapter.detect(url, html)
            if match:
                matches.append((adapter, match))

        if matches:
            # Return highest confidence match
            return max(matches, key=lambda x: x[1].confidence)

        # Fallback to default adapter
        if default:
            return (default, SiteMatch("default", 0.0, {}))

        raise RuntimeError("No adapters registered and no default adapter set")

    @classmethod
    def clear(cls) -> None:
        """Clear all registered adapters (for testing)."""
        with cls._lock:
            cls._adapters = []
            cls._default = None
            cls._initialized = False


def _register_adapters() -> None:
    """Register built-in adapters (idempotent)."""
    with AdapterRegistry._lock:
        if AdapterRegistry._initialized:
            return
        AdapterRegistry._initialized = True

    from .cargo import CargoAdapter
    from .default import DefaultAdapter

    # Register default adapter first (lowest priority)
    default = DefaultAdapter()
    AdapterRegistry.register(default, is_default=True)

    # Register site-specific adapters
    AdapterRegistry.register(CargoAdapter())


# Register adapters on module load
_register_adapters()

__all__ = ["AdapterRegistry", "SiteAdapter", "SiteMatch"]
