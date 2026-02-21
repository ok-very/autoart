"""Dashboard router - serves the local settings dashboard and artist pages."""

from pathlib import Path

from fastapi import APIRouter
from fastapi.responses import FileResponse
from starlette.staticfiles import StaticFiles

DASHBOARD_DIR = Path(__file__).parent / "dashboard"
ARTISTS_DIR = Path(__file__).parent / "artists"
ARTISTS_DIST_DIR = Path(__file__).parent / "artists-dist"

# Prefer Vite-built artists-dist/ when it exists, fall back to vanilla JS
_ARTISTS_SERVE = ARTISTS_DIST_DIR if ARTISTS_DIST_DIR.is_dir() else ARTISTS_DIR

# Vite outputs directory.html; vanilla JS uses index.html
_DIR_HTML = "directory.html" if _ARTISTS_SERVE == ARTISTS_DIST_DIR else "index.html"

# Prevent bfcache / stale HTML on navigation
_NO_CACHE = {"Cache-Control": "no-store"}

router = APIRouter()


@router.get("/dashboard", include_in_schema=False)
async def dashboard_index() -> FileResponse:
    """Serve the dashboard HTML page."""
    return FileResponse(DASHBOARD_DIR / "index.html", media_type="text/html", headers=_NO_CACHE)


@router.get("/artists-dashboard", include_in_schema=False)
async def artists_dashboard_index() -> FileResponse:
    """Serve the artist directory page."""
    return FileResponse(_ARTISTS_SERVE / _DIR_HTML, media_type="text/html", headers=_NO_CACHE)


@router.get("/artists-settings", include_in_schema=False)
async def artists_settings_index() -> FileResponse:
    """Serve the artist settings page."""
    return FileResponse(_ARTISTS_SERVE / "settings.html", media_type="text/html", headers=_NO_CACHE)


@router.get("/artists-health", include_in_schema=False)
async def artists_health_index() -> FileResponse:
    """Serve the artist lists health page."""
    return FileResponse(_ARTISTS_SERVE / "health.html", media_type="text/html", headers=_NO_CACHE)


@router.get("/artists-recon", include_in_schema=False)
async def artists_recon_index() -> FileResponse:
    """Serve the artist reconciliation page."""
    return FileResponse(_ARTISTS_SERVE / "recon.html", media_type="text/html", headers=_NO_CACHE)


def get_static_files() -> StaticFiles:
    """Return StaticFiles mount for dashboard assets (JS, CSS)."""
    return StaticFiles(directory=str(DASHBOARD_DIR))


def get_artists_static_files() -> StaticFiles:
    """Return StaticFiles mount for artist dashboard assets."""
    return StaticFiles(directory=str(_ARTISTS_SERVE))
