"""
AutoCollector Runner - Web scraping and local folder intake.

Orchestrates artifact collection from web URLs and local folders.
Delegates to specialized collectors for each source type.
"""

from pathlib import Path
from typing import AsyncIterator

from autohelper.shared.logging import get_logger

from .collectors import FolderCollector, WebCollector
from .service import BaseRunner
from .types import NamingConfig, RunnerId, RunnerProgress, RunnerResult

logger = get_logger(__name__)


class AutoCollectorRunner(BaseRunner):
    """
    AutoCollector runner for web scraping and local folder intake.

    Modes:
    - Web: Provide 'url' in config to scrape a website
    - Local: Provide 'source_path' in config to scan a folder

    The runner delegates to specialized collectors:
    - WebCollector for web URLs
    - FolderCollector for local paths

    Supports naming configuration for generated filenames and
    creates manifests for artifact tracking.
    """

    def __init__(self):
        """Initialize the collector with web and folder handlers."""
        self._web_collector = WebCollector()
        self._folder_collector = FolderCollector()

    @property
    def runner_id(self) -> RunnerId:
        return RunnerId.AUTOCOLLECTOR

    async def invoke(
        self,
        config: dict,
        output_folder: Path,
        context_id: str | None = None,
    ) -> RunnerResult:
        """
        Execute the collector.

        Args:
            config: Configuration dict with either 'url' or 'source_path'
            output_folder: Output folder for collected artifacts
            context_id: Optional context identifier

        Returns:
            RunnerResult with collection outcome
        """
        # Validate config is a dict
        if not isinstance(config, dict):
            return RunnerResult(
                success=False,
                error="Config must be a dictionary",
            )

        # Parse naming config
        naming_config = NamingConfig(**(config.get("naming_config") or {}))

        url = config.get("url")
        source_path = config.get("source_path")

        if url:
            return await self._web_collector.collect(
                url, output_folder, naming_config, context_id
            )
        elif source_path:
            return await self._folder_collector.collect(
                source_path, output_folder, naming_config, context_id
            )
        else:
            return RunnerResult(
                success=False,
                error="Config must include 'url' or 'source_path'",
            )

    async def invoke_stream(
        self,
        config: dict,
        output_folder: Path,
        context_id: str | None = None,
    ) -> AsyncIterator[RunnerProgress]:
        """
        Execute with streaming progress.

        Args:
            config: Configuration dict with either 'url' or 'source_path'
            output_folder: Output folder for collected artifacts
            context_id: Optional context identifier

        Yields:
            RunnerProgress events during collection
        """
        # Validate config is a dict
        if not isinstance(config, dict):
            yield RunnerProgress(
                stage="error",
                message="Config must be a dictionary",
            )
            return

        # Parse naming config
        naming_config = NamingConfig(**(config.get("naming_config") or {}))

        url = config.get("url")
        source_path = config.get("source_path")

        if url:
            async for progress in self._web_collector.collect_stream(
                url, output_folder, naming_config, context_id
            ):
                yield progress
        elif source_path:
            async for progress in self._folder_collector.collect_stream(
                source_path, output_folder, naming_config, context_id
            ):
                yield progress
        else:
            yield RunnerProgress(
                stage="error",
                message="Config must include 'url' or 'source_path'",
            )
