"""
JSON Manifest storage backend (default).

Stores artifact metadata in a local JSON file at:
{output_folder}/.artcollector/manifest.json
"""

import asyncio
import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from ..runner.types import (
    ArtifactManifestEntry,
    CollectionManifest,
    NamingConfig,
)

logger = logging.getLogger(__name__)

# Manifest directory name (hidden folder)
MANIFEST_DIR = ".artcollector"
MANIFEST_FILE = "manifest.json"


class ManifestStorageBackend:
    """
    JSON manifest-based metadata storage (default backend).

    Stores collection manifests as JSON files in a hidden .artcollector
    directory within the output folder.
    """

    def __init__(self, output_folder: str | Path):
        """
        Initialize manifest storage backend.

        Args:
            output_folder: The output folder for this collection
        """
        self.output_folder = Path(output_folder)
        self.manifest_dir = self.output_folder / MANIFEST_DIR
        self.manifest_path = self.manifest_dir / MANIFEST_FILE
        self._lock = asyncio.Lock()
        self._cache: CollectionManifest | None = None

    async def _ensure_dir(self) -> None:
        """Ensure manifest directory exists."""
        self.manifest_dir.mkdir(parents=True, exist_ok=True)

    async def _load_or_create(self) -> CollectionManifest:
        """Load existing manifest or create a new one."""
        if self._cache is not None:
            return self._cache

        if self.manifest_path.exists():
            try:
                data = await asyncio.to_thread(self.manifest_path.read_text, encoding="utf-8")
                manifest_dict = json.loads(data)
                self._cache = CollectionManifest.model_validate(manifest_dict)
                return self._cache
            except (json.JSONDecodeError, ValueError) as e:
                logger.warning(f"Failed to load manifest, creating new: {e}")

        # Create new manifest
        now = datetime.now(timezone.utc).isoformat()
        self._cache = CollectionManifest(
            manifest_id=self.output_folder.name,
            created_at=now,
            updated_at=now,
            source_type="local",
            output_folder=str(self.output_folder),
        )
        return self._cache

    async def _save(self, manifest: CollectionManifest) -> None:
        """Save manifest to disk."""
        await self._ensure_dir()
        manifest.updated_at = datetime.now(timezone.utc).isoformat()
        data = manifest.model_dump_json(indent=2)
        await asyncio.to_thread(self.manifest_path.write_text, data, encoding="utf-8")
        self._cache = manifest

    async def save_artifact(self, artifact: ArtifactManifestEntry) -> None:
        """Save artifact metadata to manifest."""
        async with self._lock:
            manifest = await self._load_or_create()

            # Check for existing artifact with same ID (update case)
            existing_idx = next(
                (i for i, a in enumerate(manifest.artifacts) if a.artifact_id == artifact.artifact_id),
                None
            )
            if existing_idx is not None:
                manifest.artifacts[existing_idx] = artifact
            else:
                manifest.artifacts.append(artifact)

            await self._save(manifest)

    async def find_by_id(self, artifact_id: str) -> ArtifactManifestEntry | None:
        """Find artifact by persistent ID."""
        async with self._lock:
            manifest = await self._load_or_create()
            return next(
                (a for a in manifest.artifacts if a.artifact_id == artifact_id),
                None
            )

    async def find_by_hash(self, content_hash: str) -> list[ArtifactManifestEntry]:
        """Find artifacts by content hash."""
        async with self._lock:
            manifest = await self._load_or_create()
            return [a for a in manifest.artifacts if a.content_hash == content_hash]

    async def update_location(self, artifact_id: str, new_path: str) -> bool:
        """Update artifact location after file move."""
        async with self._lock:
            manifest = await self._load_or_create()

            for artifact in manifest.artifacts:
                if artifact.artifact_id == artifact_id:
                    artifact.current_filename = new_path
                    await self._save(manifest)
                    return True

            return False

    async def save_collection(self, manifest: CollectionManifest) -> None:
        """Save full collection manifest."""
        async with self._lock:
            await self._save(manifest)

    async def load_collection(self, manifest_id: str) -> CollectionManifest | None:
        """Load collection manifest by ID."""
        async with self._lock:
            manifest = await self._load_or_create()
            if manifest.manifest_id == manifest_id:
                return manifest
            return None

    async def list_collections(self) -> list[str]:
        """List all collection manifest IDs in this output folder."""
        async with self._lock:
            if self.manifest_path.exists():
                manifest = await self._load_or_create()
                return [manifest.manifest_id]
            return []

    def invalidate_cache(self) -> None:
        """Invalidate the in-memory cache (forces reload on next access)."""
        self._cache = None
