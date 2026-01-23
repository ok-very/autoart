"""
Runner module types - Pydantic models for runner invocation.
Mirrors backend TypeScript types in runner/types.ts.
"""

from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class RunnerId(str, Enum):
    """Available runner identifiers."""
    AUTOCOLLECTOR = "autocollector"


class RunnerConfig(BaseModel):
    """Configuration for a runner invocation."""
    # Web collection mode
    url: str | None = None
    
    # Local intake mode
    source_path: str | None = None
    template: str | None = None
    
    # Allow arbitrary additional config
    class Config:
        extra = "allow"


class InvokeRequest(BaseModel):
    """Request to invoke a runner."""
    runner_id: RunnerId
    config: dict[str, Any]
    output_folder: str = Field(..., min_length=1)
    context_id: str | None = None


class RunnerProgress(BaseModel):
    """Progress update during runner execution."""
    stage: str
    message: str
    percent: int | None = None


class ArtifactRef(BaseModel):
    """Reference to an artifact produced by a runner."""
    ref_id: str
    path: str
    artifact_type: str
    mime_type: str | None = None


class RunnerResult(BaseModel):
    """Result of a runner invocation."""
    success: bool
    artifacts: list[ArtifactRef] = Field(default_factory=list)
    error: str | None = None
    duration_ms: int | None = None


class RunnerStatus(BaseModel):
    """Current status of the runner system."""
    active: bool = False
    current_runner: RunnerId | None = None
    progress: RunnerProgress | None = None
