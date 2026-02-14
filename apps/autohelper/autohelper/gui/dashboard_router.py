"""Dashboard router - serves the local settings dashboard."""

from pathlib import Path

from fastapi import APIRouter
from fastapi.responses import FileResponse
from starlette.staticfiles import StaticFiles

DASHBOARD_DIR = Path(__file__).parent / "dashboard"

router = APIRouter()


@router.get("/dashboard", include_in_schema=False)
async def dashboard_index() -> FileResponse:
    """Serve the dashboard HTML page."""
    return FileResponse(DASHBOARD_DIR / "index.html", media_type="text/html")


def get_static_files() -> StaticFiles:
    """Return StaticFiles mount for dashboard assets (JS, CSS)."""
    return StaticFiles(directory=str(DASHBOARD_DIR))
