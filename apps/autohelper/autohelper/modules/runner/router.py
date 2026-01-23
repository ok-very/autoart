"""
Runner module API router.
"""

import json
from typing import Any

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from autohelper.shared.logging import get_logger

from .service import get_runner_service
from .types import InvokeRequest, RunnerId, RunnerResult

logger = get_logger(__name__)

router = APIRouter(prefix="/runner", tags=["runner"])


@router.get("/status")
async def get_status() -> dict[str, Any]:
    """Get status of the runner system and available runners."""
    service = get_runner_service()
    status = service.get_status()
    
    return {
        "status": "ok",
        "runners": service.list_runners(),
        "active": status.active,
        "current_runner": status.current_runner.value if status.current_runner else None,
        "progress": status.progress.model_dump() if status.progress else None,
    }


@router.post("/invoke")
async def invoke_runner(request: InvokeRequest) -> RunnerResult:
    """
    Invoke a runner synchronously.
    
    Returns the result once the runner completes.
    """
    logger.info(f"Invoking runner: {request.runner_id}")
    
    service = get_runner_service()
    result = await service.invoke(request)
    
    if not result.success:
        logger.warning(f"Runner {request.runner_id} failed: {result.error}")
    else:
        logger.info(
            f"Runner {request.runner_id} completed: {len(result.artifacts)} artifacts"
        )
    
    return result


@router.post("/invoke/stream")
async def invoke_runner_stream(request: InvokeRequest) -> StreamingResponse:
    """
    Invoke a runner and stream progress updates via SSE.
    
    Streams Server-Sent Events with progress updates until completion.
    """
    logger.info(f"Streaming runner: {request.runner_id}")
    
    service = get_runner_service()
    
    async def event_generator():
        async for progress in service.invoke_stream(request):
            # Format as SSE
            data = json.dumps(progress.model_dump())
            yield f"data: {data}\n\n"
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
    )
