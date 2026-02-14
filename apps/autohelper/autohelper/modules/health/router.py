"""Health module routes."""

import os
import signal

from fastapi import APIRouter

from .schemas import HealthResponse, ShutdownResponse, StatusResponse
from .service import HealthService

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    """
    Simple health check.

    Returns ok if the service is running.
    """
    service = HealthService()
    return service.get_health()


@router.get("/status", response_model=StatusResponse)
async def status() -> StatusResponse:
    """
    Detailed status check.

    Returns:
    - Database connectivity
    - Migration status
    - Configured roots and their accessibility
    - Last index run info
    """
    service = HealthService()
    return service.get_status()


@router.post("/shutdown", response_model=ShutdownResponse)
async def shutdown() -> ShutdownResponse:
    """
    Gracefully shut down the server.

    Sends SIGINT to the current process, which uvicorn handles as a clean
    shutdown (runs lifespan teardown, closes connections).

    Used by the Electron shell to stop the Python backend before exit.
    """
    os.kill(os.getpid(), signal.SIGINT)
    return ShutdownResponse(status="shutting_down")
