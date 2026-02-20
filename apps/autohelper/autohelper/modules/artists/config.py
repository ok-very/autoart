"""
Artist Records configuration — loaded from artist_lexicon.json at runtime.

All scanning constants (subfolder aliases, identity options, completeness weights,
folder fixes, multi-folder overrides, category profiles) live in the lexicon JSON
so they can be edited without code changes.
"""
from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from autohelper.shared.paths import data_dir

logger = logging.getLogger(__name__)

LEXICON_FILENAME = "artist_lexicon.json"
MANIFEST_FILENAME = "artist_manifest.json"


# ---------------------------------------------------------------------------
# Dataclasses
# ---------------------------------------------------------------------------

@dataclass
class CategoryProfile:
    """Defines how a top-level category maps to artist folders."""

    key: str  # "indigenous", "public", "private", "corporate"
    rel_path: str  # relative to storage root
    layout: str  # "nation_based", "bucketed", "flat"
    label: str  # display name


@dataclass
class ArtistLexicon:
    """All scanning configuration, loaded from artist_lexicon.json."""

    version: str = "1.0"

    categories: list[CategoryProfile] = field(default_factory=list)
    subfolder_aliases: dict[str, str] = field(default_factory=dict)
    image_extensions: set[str] = field(default_factory=set)
    document_extensions: set[str] = field(default_factory=set)
    ignore_files: set[str] = field(default_factory=set)
    ignore_dirs: set[str] = field(default_factory=set)

    completeness_weights: dict[str, float] = field(default_factory=dict)
    completeness_gap_labels: dict[str, str] = field(default_factory=dict)

    identity_options: list[str] = field(default_factory=list)
    affiliation_types: list[str] = field(default_factory=list)
    location_types: list[str] = field(default_factory=list)
    name_types: list[str] = field(default_factory=list)

    folder_name_fixes: dict[str, str] = field(default_factory=dict)
    multi_folder_artists: dict[str, dict] = field(default_factory=dict)
    collaborative_entities: dict[str, dict] = field(default_factory=dict)
    nested_artists: dict[str, dict] = field(default_factory=dict)

    # Per-artist identity overrides: "category:nation:folder_name" -> {identities, affiliations, locations, pronouns}
    artist_identity_overrides: dict[str, dict] = field(default_factory=dict)

    # Derived lookup: (category, folder_name) -> canonical_id
    multi_folder_lookup: dict[tuple[str, str], str] = field(
        default_factory=dict, repr=False
    )


# ---------------------------------------------------------------------------
# Built-in defaults
# ---------------------------------------------------------------------------

DEFAULT_CATEGORIES: list[CategoryProfile] = [
    CategoryProfile(
        "indigenous", "Indigenous Artists", "nation_based", "Indigenous Artists"
    ),
    CategoryProfile(
        "public",
        "1. PUBLIC ART/ARTIST INFORMATION/ARTIST Folders",
        "nation_based",
        "Public Art",
    ),
    CategoryProfile(
        "private", "2. PRIVATE ART/03 Artists", "bucketed", "Private Art"
    ),
    CategoryProfile(
        "corporate", "3. CORPORATE ART/Artists", "flat", "Corporate Art"
    ),
]

DEFAULT_SUBFOLDER_ALIASES: dict[str, str] = {
    "bio": "Bio",
    "bios": "Bio",
    "biography": "Bio",
    "cv": "CV",
    "cvs": "CV",
    "curriculum vitae": "CV",
    "image": "Images",
    "images": "Images",
    "tearsheet": "Tearsheets",
    "tearsheets": "Tearsheets",
    "eoi": "EOI",
    "eois": "EOI",
    "concept proposal": "Concept Proposals",
    "concept proposals": "Concept Proposals",
    "proposal": "Concept Proposals",
    "proposals": "Concept Proposals",
    "project list": "Project list",
    "project lists": "Project list",
    "projects": "Project list",
    # PRIVATE ART numbered subfolder convention
    "01 artist bio": "Bio",
    "02 works": "Images",
    "04 tearsheets": "Tearsheets",
}

DEFAULT_IMAGE_EXTENSIONS: set[str] = {
    ".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp",
    ".avif", ".tiff", ".tif", ".heic", ".heif",
}

DEFAULT_DOCUMENT_EXTENSIONS: set[str] = {
    ".pdf", ".docx", ".doc", ".txt", ".rtf", ".pptx", ".ppt", ".indd",
}

DEFAULT_IGNORE_FILES: set[str] = {
    ".tonfotos.ini", ".ds_store", "thumbs.db", "desktop.ini",
    ".bridgesort", ".tonfotos",
}

DEFAULT_IGNORE_DIRS: set[str] = {"__pycache__", ".git", "node_modules", ".artcollector"}

DEFAULT_COMPLETENESS_WEIGHTS: dict[str, float] = {
    "has_bio": 0.15,
    "has_cv": 0.10,
    "has_tearsheet": 0.15,
    "has_contact_email": 0.20,
    "has_contact_phone": 0.10,
    "has_website": 0.05,
    "has_images": 0.15,
    "has_pronouns": 0.10,
}

DEFAULT_COMPLETENESS_GAP_LABELS: dict[str, str] = {
    "has_bio": "Missing bio",
    "has_cv": "Missing CV",
    "has_tearsheet": "Missing tearsheet",
    "has_contact_email": "No contact email",
    "has_contact_phone": "No contact phone",
    "has_website": "No website",
    "has_images": "No images",
    "has_pronouns": "No pronouns",
}

DEFAULT_IDENTITIES: list[str] = [
    # Gender & sexuality
    "queer", "gay", "lesbian", "bisexual", "trans", "non-binary", "two-spirit",
    # Race & ethnicity
    "Indigenous", "First Nations", "Métis", "Inuit", "Black", "African", "PoC",
    "South Asian", "East Asian", "Southeast Asian", "Middle Eastern",
    "Latin American", "Caribbean",
    # Migration & origin
    "immigrant", "migrant", "refugee", "diaspora", "settler",
    # Other
    "disability", "Deaf", "religious", "cultural legacy",
]

DEFAULT_AFFILIATION_TYPES: list[str] = [
    "nation", "collective", "duo_partner", "studio_assistant_of",
    "band", "organization",
]

DEFAULT_LOCATION_TYPES: list[str] = [
    "origin",   # where the artist is from / born
    "home",     # where they currently live/work
    "studio",   # dedicated studio address
]

DEFAULT_NAME_TYPES: list[str] = [
    "traditional",   # Indigenous traditional/ceremonial name
    "pseudonym",     # artist alias / pen name
    "studio",        # studio or practice name
    "trade",         # registered trade name / business name
]

DEFAULT_FOLDER_NAME_FIXES: dict[str, str] = {
    "Martinez. Mauricio": "Martinez, Mauricio",
    "Atkins. Phyllis": "Atkins, Phyllis",
}

DEFAULT_MULTI_FOLDER_ARTISTS: dict[str, dict] = {
    "yuxweluptun_lawrence_paul": {
        "primary": "indigenous",
        "review_note": "Folder spelling differs across nations",
        "folders": [
            {"category": "indigenous", "nation": "Cowichan", "name": "Yuxweluptun, Lawrence Paul"},
            {"category": "indigenous", "nation": "Syilx", "name": "Yuxwelupton, Lawrence Paul"},
        ],
    },
    "klatle_bhi": {
        "primary": "indigenous",
        "review_note": "Klatle-bhi appears under multiple nations",
        "folders": [
            {"category": "indigenous", "nation": "Kwakwaka\u2019wakw", "name": "Klatle-bhi"},
            {"category": "indigenous", "nation": "Squamish", "name": "Klatle-bhi"},
        ],
    },
    "braeg_jason": {
        "primary": "indigenous",
        "folders": [
            {"category": "indigenous", "nation": "Cree", "name": "Braeg, Jason"},
            {"category": "indigenous", "nation": "M\xe9tis", "name": "Braeg, Jason"},
        ],
    },
    "sound_michelle": {
        "primary": "indigenous",
        "folders": [
            {"category": "indigenous", "nation": "Cree", "name": "Sound, Michelle"},
            {"category": "indigenous", "nation": "M\xe9tis", "name": "Sound, Michelle"},
        ],
    },
    "yeomans_don": {
        "primary": "indigenous",
        "folders": [
            {"category": "indigenous", "nation": "Haida", "name": "Yeomans, Don"},
            {"category": "indigenous", "nation": "M\xe9tis", "name": "Yeomans, Don"},
        ],
    },
    "kukwits_gigaemi": {
        "primary": "indigenous",
        "folders": [
            {"category": "indigenous", "nation": "Coast Salish", "name": "Kukwits, Gigaemi"},
            {"category": "indigenous", "nation": "Kwakwaka\u2019wakw", "name": "Kukwits, Gigaemi"},
            {"category": "indigenous", "nation": "Squamish", "name": "Kukwits, Gigaemi"},
        ],
    },
}

DEFAULT_COLLABORATIVE_ENTITIES: dict[str, dict] = {
    "indigenous:Coast Salish:Brevner, Lauren & James Harry": {
        "display_name": "Lauren Brevner & James Harry",
        "members": ["Lauren Brevner", "James Harry"],
    },
    "indigenous:Kwantlen:Atkins, Drew and Phyllis": {
        "display_name": "Drew and Phyllis Atkins",
        "members": ["Drew Atkins", "Phyllis Atkins"],
    },
    "indigenous:Semiahmoo:Wells, Leslie and Leonard": {
        "display_name": "Leslie and Leonard Wells",
        "members": ["Leslie Wells", "Leonard Wells"],
    },
}

DEFAULT_NESTED_ARTISTS: dict[str, dict] = {
    "indigenous:Squamish:Xwalacktun": {
        "traditional_name": "Xwalacktun",
        "western_subfolder": "Harry, Rick",
        "western_first": "Rick",
        "western_last": "Harry",
        "review_note": "Xwalacktun (traditional name) = Rick Harry",
    },
}

# Category priority for choosing the primary folder
CATEGORY_PRIORITY: list[str] = ["indigenous", "public", "private", "corporate"]


# ---------------------------------------------------------------------------
# Lexicon singleton
# ---------------------------------------------------------------------------

_lexicon: ArtistLexicon | None = None


def get_lexicon() -> ArtistLexicon:
    """Get the cached lexicon, loading from disk or defaults."""
    global _lexicon
    if _lexicon is None:
        _lexicon = load_lexicon()
    return _lexicon


def reset_lexicon() -> None:
    """Force reload on next access."""
    global _lexicon
    _lexicon = None


def get_lexicon_path() -> Path:
    """Path to the lexicon JSON file."""
    return data_dir() / LEXICON_FILENAME


def load_lexicon() -> ArtistLexicon:
    """Load lexicon from disk, falling back to built-in defaults."""
    path = get_lexicon_path()
    if path.exists():
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
            return _parse_lexicon(data)
        except Exception:
            logger.warning("Failed to load %s, using defaults", path, exc_info=True)

    # Generate from defaults
    lex = _build_default_lexicon()
    try:
        save_lexicon(lex)
    except Exception:
        logger.warning("Failed to save default lexicon to disk", exc_info=True)
    return lex


def save_lexicon(lex: ArtistLexicon) -> None:
    """Write lexicon to disk as JSON."""
    path = get_lexicon_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    data = _serialize_lexicon(lex)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def _build_default_lexicon() -> ArtistLexicon:
    """Construct a lexicon from built-in defaults."""
    lex = ArtistLexicon(
        categories=list(DEFAULT_CATEGORIES),
        subfolder_aliases=dict(DEFAULT_SUBFOLDER_ALIASES),
        image_extensions=set(DEFAULT_IMAGE_EXTENSIONS),
        document_extensions=set(DEFAULT_DOCUMENT_EXTENSIONS),
        ignore_files=set(DEFAULT_IGNORE_FILES),
        ignore_dirs=set(DEFAULT_IGNORE_DIRS),
        completeness_weights=dict(DEFAULT_COMPLETENESS_WEIGHTS),
        completeness_gap_labels=dict(DEFAULT_COMPLETENESS_GAP_LABELS),
        identity_options=list(DEFAULT_IDENTITIES),
        affiliation_types=list(DEFAULT_AFFILIATION_TYPES),
        location_types=list(DEFAULT_LOCATION_TYPES),
        name_types=list(DEFAULT_NAME_TYPES),
        folder_name_fixes=dict(DEFAULT_FOLDER_NAME_FIXES),
        multi_folder_artists=dict(DEFAULT_MULTI_FOLDER_ARTISTS),
        collaborative_entities=dict(DEFAULT_COLLABORATIVE_ENTITIES),
        nested_artists=dict(DEFAULT_NESTED_ARTISTS),
        artist_identity_overrides={},
    )
    _rebuild_lookup(lex)
    return lex


def _rebuild_lookup(lex: ArtistLexicon) -> None:
    """Build the multi_folder_lookup from multi_folder_artists."""
    lex.multi_folder_lookup = {}
    for canonical_id, cfg in lex.multi_folder_artists.items():
        for folder in cfg.get("folders", []):
            key = (folder.get("category", ""), folder.get("nation", ""), folder.get("name", ""))
            lex.multi_folder_lookup[key] = canonical_id


def _parse_lexicon(data: dict[str, Any]) -> ArtistLexicon:
    """Parse a JSON dict into an ArtistLexicon."""
    lex = ArtistLexicon(
        version=data.get("version", "1.0"),
        categories=[
            CategoryProfile(**c) for c in data.get("categories", [])
        ] or list(DEFAULT_CATEGORIES),
        subfolder_aliases=data.get("subfolder_aliases", dict(DEFAULT_SUBFOLDER_ALIASES)),
        image_extensions=set(data.get("image_extensions", DEFAULT_IMAGE_EXTENSIONS)),
        document_extensions=set(data.get("document_extensions", DEFAULT_DOCUMENT_EXTENSIONS)),
        ignore_files=set(data.get("ignore_files", DEFAULT_IGNORE_FILES)),
        ignore_dirs=set(data.get("ignore_dirs", DEFAULT_IGNORE_DIRS)),
        completeness_weights=data.get("completeness_weights", dict(DEFAULT_COMPLETENESS_WEIGHTS)),
        completeness_gap_labels=data.get("completeness_gap_labels", dict(DEFAULT_COMPLETENESS_GAP_LABELS)),
        # Fall back to old key name for one-time migration of pre-refactor lexicon files
        identity_options=data.get("identity_options") or data.get("identity_labels", list(DEFAULT_IDENTITIES)),
        affiliation_types=data.get("affiliation_types", list(DEFAULT_AFFILIATION_TYPES)),
        location_types=data.get("location_types", list(DEFAULT_LOCATION_TYPES)),
        name_types=data.get("name_types", list(DEFAULT_NAME_TYPES)),
        folder_name_fixes=data.get("folder_name_fixes", dict(DEFAULT_FOLDER_NAME_FIXES)),
        multi_folder_artists=data.get("multi_folder_artists", dict(DEFAULT_MULTI_FOLDER_ARTISTS)),
        collaborative_entities=data.get("collaborative_entities", dict(DEFAULT_COLLABORATIVE_ENTITIES)),
        nested_artists=data.get("nested_artists", dict(DEFAULT_NESTED_ARTISTS)),
        artist_identity_overrides=data.get("artist_identity_overrides", {}),
    )
    _rebuild_lookup(lex)
    return lex


def _serialize_lexicon(lex: ArtistLexicon) -> dict[str, Any]:
    """Serialize an ArtistLexicon to a JSON-friendly dict."""
    return {
        "version": lex.version,
        "categories": [
            {"key": c.key, "rel_path": c.rel_path, "layout": c.layout, "label": c.label}
            for c in lex.categories
        ],
        "subfolder_aliases": lex.subfolder_aliases,
        "image_extensions": sorted(lex.image_extensions),
        "document_extensions": sorted(lex.document_extensions),
        "ignore_files": sorted(lex.ignore_files),
        "ignore_dirs": sorted(lex.ignore_dirs),
        "completeness_weights": lex.completeness_weights,
        "completeness_gap_labels": lex.completeness_gap_labels,
        "identity_options": lex.identity_options,
        "affiliation_types": lex.affiliation_types,
        "location_types": lex.location_types,
        "name_types": lex.name_types,
        "folder_name_fixes": lex.folder_name_fixes,
        "multi_folder_artists": lex.multi_folder_artists,
        "collaborative_entities": lex.collaborative_entities,
        "nested_artists": lex.nested_artists,
        "artist_identity_overrides": lex.artist_identity_overrides,
    }
