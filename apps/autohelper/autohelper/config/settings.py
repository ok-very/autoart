"""
Configuration settings using pydantic-settings.
Supports env vars and optional .env file.

Config values can also be persisted to config.json via ConfigStore.
For values that need to persist across restarts (like autoart_link_key),
we read from config.json during Settings initialization.
"""

from pathlib import Path
from typing import Literal

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

from autohelper.shared.paths import data_dir

# =============================================================================
# Metadata Backend Types
# =============================================================================

MetadataBackendType = Literal["manifest", "sharepoint"]


class Settings(BaseSettings):
    """Application settings with env var support."""

    model_config = SettingsConfigDict(
        env_prefix="AUTOHELPER_",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Server
    host: str = "127.0.0.1"
    port: int = 8100
    debug: bool = False

    # Database
    db_path: Path = Field(default_factory=lambda: data_dir() / "autohelper.db")

    # Filesystem roots (comma-separated paths)
    allowed_roots: list[str] = Field(default_factory=list)

    # Security
    block_symlinks: bool = True

    # OneDrive Files On-Demand detection (Windows only)
    onedrive_detection: bool = True

    # Logging
    log_level: str = "INFO"

    # CORS
    cors_origins: list[str] = Field(default=["http://localhost:5173", "http://localhost:3000"])

    # Mail Polling
    mail_enabled: bool = False
    mail_poll_interval: int = 30  # seconds
    mail_output_path: Path = Field(
        default_factory=lambda: Path(Path.home() / "OneDrive" / "Emails")
    )
    mail_ingest_path: Path = Field(
        default_factory=lambda: data_dir() / "ingest"
    )

    # Context Layer / External Data Sources
    autoart_frontend_url: str = "http://localhost:5173"
    autoart_api_url: str = "http://localhost:3001"
    autoart_link_key: str = ""  # Persistent link key from AutoArt pairing
    context_providers: list[str] = Field(default=["autoart", "monday"])  # Priority order

    # Artifact Storage Settings
    # Backend selection: "manifest" (default, local JSON) or "sharepoint" (requires credentials)
    metadata_backend: MetadataBackendType = "manifest"

    # SharePoint settings (only used if metadata_backend == "sharepoint")
    sharepoint_site_url: str | None = None
    sharepoint_client_id: str | None = None
    sharepoint_client_secret: str | None = None

    # Garbage Collection Settings
    gc_enabled: bool = True  # Enable/disable GC scheduler
    gc_schedule_hours: int = Field(default=24, ge=1)  # Run every N hours (min: 1)
    gc_retention_days: int = Field(default=7, ge=1)  # Retain files/sessions N days (min: 1)
    gc_rtf_temp_path: str | None = None  # Custom RTF temp path (default: system temp)
    gc_cleanup_orphaned_manifests: bool = False  # Disabled by default (risky)
    gc_cleanup_mail_ingest: bool = True  # Clean up processed mail files

    @model_validator(mode="after")
    def load_from_config_store(self) -> "Settings":
        """
        Load persisted values from config.json.

        ConfigStore is the source of truth for values that persist across restarts,
        like autoart_link_key and user-editable settings.
        """
        try:
            from autohelper.config.store import ConfigStore

            cfg = ConfigStore().load()

            # Link key is only stored in config.json (not env vars)
            if "autoart_link_key" in cfg and cfg["autoart_link_key"]:
                object.__setattr__(self, "autoart_link_key", cfg["autoart_link_key"])

            # User-editable settings that exist on Settings class
            config_keys = ["allowed_roots", "mail_enabled", "mail_poll_interval"]
            for key in config_keys:
                if key in cfg:
                    object.__setattr__(self, key, cfg[key])
        except Exception:
            # Don't fail startup if config.json is missing or malformed
            pass

        return self

    def get_allowed_roots(self) -> list[Path]:
        """Parse and validate allowed root paths."""
        return [Path(r).resolve() for r in self.allowed_roots if r]


# Global settings instance for caching
_settings: Settings | None = None


def init_settings(settings: Settings) -> None:
    """Initialize global settings (call during app startup or test setup)."""
    global _settings
    _settings = settings


def get_settings() -> Settings:
    """Get cached settings instance."""
    global _settings
    if _settings is None:
        _settings = Settings()
    return _settings


def reset_settings() -> None:
    """Reset settings (for testing)."""
    global _settings
    _settings = None
