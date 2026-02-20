"""
Settings manifest — single source of truth for all user-editable settings.

Every field that appears in config.json AND the Settings class is defined here.
The dashboard, ConfigStore defaults, Settings loader, and backend poller all
derive their field lists from this manifest.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True)
class FieldDef:
    """Definition of a single user-editable setting."""

    key: str  # config.json key AND Settings attribute name
    label: str  # UI label
    section: str  # "general" | "mail" | "contacts" | "exchange"
    field_type: str  # "bool" | "int" | "string" | "select" | "text" | "string_list" | "tag_list"
    default: Any  # Default value
    description: str = ""
    admin_only: bool = False
    min_value: int | None = None
    max_value: int | None = None
    options: list[str] | None = None  # For "select" type
    placeholder: str = ""
    depends_on: str | None = None  # Key of bool field; hide unless True
    row_group: str | None = None  # Same group -> side-by-side in UI


# =============================================================================
# Field Definitions
# =============================================================================

FIELDS: tuple[FieldDef, ...] = (
    # -- General --
    FieldDef(
        key="allowed_roots",
        label="Allowed Roots",
        section="general",
        field_type="string_list",
        default=[],
        description="Filesystem paths to index (one per line)",
        placeholder="/path/to/folder",
    ),
    FieldDef(
        key="excludes",
        label="Excludes",
        section="general",
        field_type="tag_list",
        default=["pyc", "__pycache__", ".git", ".idea", "node_modules"],
        description="Patterns to exclude from indexing (comma-separated)",
    ),
    FieldDef(
        key="log_level",
        label="Log Level",
        section="general",
        field_type="select",
        default="INFO",
        options=["DEBUG", "INFO", "WARNING", "ERROR"],
    ),
    # -- Mail --
    FieldDef(
        key="mail_enabled",
        label="Enable mail polling",
        section="mail",
        field_type="bool",
        default=False,
    ),
    FieldDef(
        key="mail_poll_interval",
        label="Poll Interval (seconds)",
        section="mail",
        field_type="int",
        default=30,
        min_value=5,
        max_value=3600,
        depends_on="mail_enabled",
    ),
    # -- Contacts --
    FieldDef(
        key="contact_sync_enabled",
        label="Enable contact sync",
        section="contacts",
        field_type="bool",
        default=False,
    ),
    FieldDef(
        key="contact_sync_csv_path",
        label="CSV File Path",
        section="contacts",
        field_type="string",
        default="",
        placeholder=r"C:\path\to\master_contacts.csv",
        depends_on="contact_sync_enabled",
    ),
    FieldDef(
        key="contact_sync_interval_minutes",
        label="Interval (minutes)",
        section="contacts",
        field_type="int",
        default=30,
        min_value=5,
        max_value=1440,
        depends_on="contact_sync_enabled",
        row_group="schedule",
    ),
    FieldDef(
        key="contact_sync_work_hours_start",
        label="Work Hours Start",
        section="contacts",
        field_type="int",
        default=8,
        min_value=0,
        max_value=23,
        depends_on="contact_sync_enabled",
        row_group="schedule",
    ),
    FieldDef(
        key="contact_sync_work_hours_end",
        label="Work Hours End",
        section="contacts",
        field_type="int",
        default=18,
        min_value=0,
        max_value=23,
        depends_on="contact_sync_enabled",
        row_group="schedule",
    ),
    FieldDef(
        key="contact_sync_timezone",
        label="Timezone",
        section="contacts",
        field_type="string",
        default="America/Los_Angeles",
        placeholder="America/Los_Angeles",
        depends_on="contact_sync_enabled",
    ),
    FieldDef(
        key="contact_sync_batch_size",
        label="Batch Size",
        section="contacts",
        field_type="int",
        default=50,
        min_value=1,
        max_value=500,
        depends_on="contact_sync_enabled",
        row_group="batch",
    ),
    FieldDef(
        key="contact_sync_managed_prefix",
        label="Managed Prefix",
        section="contacts",
        field_type="string",
        default="BFA-",
        placeholder="BFA-",
        depends_on="contact_sync_enabled",
        row_group="batch",
    ),
    FieldDef(
        key="contact_sync_dry_run",
        label="Dry run (no Exchange changes)",
        section="contacts",
        field_type="bool",
        default=False,
        depends_on="contact_sync_enabled",
    ),
    # -- Artists --
    FieldDef(
        key="artist_storage_root",
        label="Storage Root",
        section="artists",
        field_type="string",
        default="",
        description="Company file storage root (e.g. OneDrive sync folder)",
        placeholder=r"C:\Users\you\OneDrive\Company Files",
    ),
    FieldDef(
        key="artist_scan_enabled",
        label="Enable artist scanning",
        section="artists",
        field_type="bool",
        default=False,
    ),
    FieldDef(
        key="artist_scan_on_change",
        label="Auto-rescan on file change",
        section="artists",
        field_type="bool",
        default=True,
        depends_on="artist_scan_enabled",
        description="Watchdog monitors storage root and rescans changed artist folders",
    ),
)


# =============================================================================
# Derived Lookups (computed once at import time)
# =============================================================================

CONFIG_KEYS: list[str] = [f.key for f in FIELDS]

DEFAULTS: dict[str, Any] = {f.key: f.default for f in FIELDS}

FIELDS_BY_KEY: dict[str, FieldDef] = {f.key: f for f in FIELDS}

FIELDS_BY_SECTION: dict[str, list[FieldDef]] = {}
for _f in FIELDS:
    FIELDS_BY_SECTION.setdefault(_f.section, []).append(_f)

# Ordered section labels for UI rendering
SECTION_LABELS: dict[str, str] = {
    "general": "General Settings",
    "mail": "Mail Settings",
    "contacts": "Contact Sync",
    "exchange": "Exchange Connection",
    "artists": "Artist Records",
}


def schema_as_dict() -> dict[str, Any]:
    """Serialize the manifest as a JSON-friendly dict for the /config/schema endpoint."""
    sections = []
    for section_id, label in SECTION_LABELS.items():
        fields = FIELDS_BY_SECTION.get(section_id, [])
        admin_only = any(f.admin_only for f in fields) and all(f.admin_only for f in fields)
        sections.append({
            "id": section_id,
            "label": label,
            "admin_only": admin_only,
            "fields": [_field_to_dict(f) for f in fields],
        })
    return {"sections": sections}


def _field_to_dict(f: FieldDef) -> dict[str, Any]:
    """Serialize a single FieldDef to a JSON-friendly dict."""
    d: dict[str, Any] = {
        "key": f.key,
        "label": f.label,
        "type": f.field_type,
        "default": f.default,
    }
    if f.description:
        d["description"] = f.description
    if f.admin_only:
        d["admin_only"] = True
    if f.min_value is not None:
        d["min"] = f.min_value
    if f.max_value is not None:
        d["max"] = f.max_value
    if f.options is not None:
        d["options"] = f.options
    if f.placeholder:
        d["placeholder"] = f.placeholder
    if f.depends_on:
        d["depends_on"] = f.depends_on
    if f.row_group:
        d["row_group"] = f.row_group
    return d
