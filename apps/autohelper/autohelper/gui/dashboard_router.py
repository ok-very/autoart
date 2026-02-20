"""Dashboard router - serves the local settings dashboard and artist pages."""

from pathlib import Path

from fastapi import APIRouter
from fastapi.responses import FileResponse
from starlette.staticfiles import StaticFiles

DASHBOARD_DIR = Path(__file__).parent / "dashboard"
ARTISTS_DIR = Path(__file__).parent / "artists"

router = APIRouter()


@router.get("/dashboard", include_in_schema=False)
async def dashboard_index() -> FileResponse:
    """Serve the dashboard HTML page."""
    return FileResponse(DASHBOARD_DIR / "index.html", media_type="text/html")


@router.get("/artists-dashboard", include_in_schema=False)
async def artists_dashboard_index() -> FileResponse:
    """Serve the artist directory page."""
    return FileResponse(ARTISTS_DIR / "index.html", media_type="text/html")


@router.get("/artists-settings", include_in_schema=False)
async def artists_settings_index() -> FileResponse:
    """Serve the artist settings page."""
    return FileResponse(ARTISTS_DIR / "settings.html", media_type="text/html")


@router.get("/artists-health", include_in_schema=False)
async def artists_health_index() -> FileResponse:
    """Serve the artist lists health page."""
    return FileResponse(ARTISTS_DIR / "health.html", media_type="text/html")


def get_static_files() -> StaticFiles:
    """Return StaticFiles mount for dashboard assets (JS, CSS)."""
    return StaticFiles(directory=str(DASHBOARD_DIR))


def get_artists_static_files() -> StaticFiles:
    """Return StaticFiles mount for artist dashboard assets."""
    return StaticFiles(directory=str(ARTISTS_DIR))
