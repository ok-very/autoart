"""
Content extractors submodule.

Provides HTML content extraction functions decoupled from HTTP fetching.
"""

from .bio import extract_bio_text
from .images import SUPPORTED_IMAGE_EXTENSIONS, extract_image_urls

__all__ = [
    "extract_bio_text",
    "extract_image_urls",
    "SUPPORTED_IMAGE_EXTENSIONS",
]
