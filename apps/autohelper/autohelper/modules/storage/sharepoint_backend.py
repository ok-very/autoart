"""
SharePoint storage backend (optional).

Stores artifact metadata in a SharePoint list for enterprise environments.
Requires the Office365-REST-Python-Client package:
    pip install Office365-REST-Python-Client

Or install the optional dependency:
    pip install autohelper[sharepoint]
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

# SharePoint list names
COLLECTIONS_LIST = "ArtifactCollections"
ARTIFACTS_LIST = "CollectedArtifacts"


def _lazy_import_office365():
    """Lazily import office365 to avoid import errors when not installed."""
    try:
        from office365.runtime.auth.client_credential import ClientCredential
        from office365.sharepoint.client_context import ClientContext

        return ClientCredential, ClientContext
    except ImportError as e:
        raise ImportError(
            "SharePoint backend requires 'Office365-REST-Python-Client' package. "
            "Install with: pip install Office365-REST-Python-Client "
            "or: pip install autohelper[sharepoint]"
        ) from e


class SharePointStorageBackend:
    """
    SharePoint-based metadata storage backend.

    Stores artifact metadata in SharePoint lists for enterprise environments
    where centralized tracking is required.

    Lists used:
    - ArtifactCollections: Collection manifests (one item per collection)
    - CollectedArtifacts: Individual artifact entries (many items per collection)

    Required SharePoint permissions:
    - Sites.ReadWrite.All (or specific site permissions)
    - Lists.ReadWrite.All
    """

    def __init__(
        self,
        site_url: str,
        client_id: str,
        client_secret: str,
        output_folder: str | Path,
    ):
        """
        Initialize SharePoint storage backend.

        Args:
            site_url: SharePoint site URL (e.g., https://contoso.sharepoint.com/sites/art)
            client_id: Azure AD app client ID
            client_secret: Azure AD app client secret
            output_folder: Local output folder (used for manifest_id generation)
        """
        self.site_url = site_url
        self.client_id = client_id
        self.client_secret = client_secret
        self.output_folder = Path(output_folder)

        # Lazy initialization of SharePoint context
        self._ctx = None
        self._lock = asyncio.Lock()
        self._lists_ensured = False

    def _get_context(self):
        """Get or create SharePoint client context."""
        if self._ctx is None:
            ClientCredential, ClientContext = _lazy_import_office365()
            credentials = ClientCredential(self.client_id, self.client_secret)
            self._ctx = ClientContext(self.site_url).with_credentials(credentials)
        return self._ctx

    async def _ensure_lists(self) -> None:
        """Ensure required SharePoint lists exist (cached after first check)."""
        if self._lists_ensured:
            return

        ctx = self._get_context()

        def _create_lists():
            web = ctx.web
            ctx.load(web.lists)
            ctx.execute_query()

            list_titles = {lst.properties.get("Title", "") for lst in web.lists}

            # Create collections list if missing
            if COLLECTIONS_LIST not in list_titles:
                logger.info(f"Creating SharePoint list: {COLLECTIONS_LIST}")
                list_creation_info = {
                    "Title": COLLECTIONS_LIST,
                    "Description": "Artifact collection manifests",
                    "BaseTemplate": 100,  # Generic list
                }
                web.lists.add(list_creation_info)
                ctx.execute_query()

            # Create artifacts list if missing
            if ARTIFACTS_LIST not in list_titles:
                logger.info(f"Creating SharePoint list: {ARTIFACTS_LIST}")
                list_creation_info = {
                    "Title": ARTIFACTS_LIST,
                    "Description": "Collected artifact metadata",
                    "BaseTemplate": 100,
                }
                web.lists.add(list_creation_info)
                ctx.execute_query()

        await asyncio.to_thread(_create_lists)
        self._lists_ensured = True

    def _artifact_to_list_item(
        self, artifact: ArtifactManifestEntry, collection_id: str | None = None
    ) -> dict[str, Any]:
        """Convert artifact entry to SharePoint list item fields."""
        return {
            "Title": artifact.artifact_id,
            "CollectionId": collection_id or "",
            "OriginalFilename": artifact.original_filename,
            "CurrentFilename": artifact.current_filename,
            "ContentHash": artifact.content_hash,
            "SourceUrl": artifact.source_url or "",
            "SourcePath": artifact.source_path or "",
            "CollectedAt": artifact.collected_at,
            "MimeType": artifact.mime_type,
            "FileSize": artifact.size,
            "MetadataJson": json.dumps(artifact.metadata) if artifact.metadata else "{}",
        }

    def _list_item_to_artifact(self, item: dict[str, Any]) -> ArtifactManifestEntry:
        """Convert SharePoint list item to artifact entry."""
        metadata = {}
        metadata_json = item.get("MetadataJson", "{}")
        if metadata_json:
            try:
                metadata = json.loads(metadata_json)
            except (json.JSONDecodeError, TypeError):
                metadata = {}

        return ArtifactManifestEntry(
            artifact_id=item.get("Title", ""),
            original_filename=item.get("OriginalFilename", ""),
            current_filename=item.get("CurrentFilename", ""),
            content_hash=item.get("ContentHash", ""),
            source_url=item.get("SourceUrl") or None,
            source_path=item.get("SourcePath") or None,
            collected_at=item.get("CollectedAt", ""),
            mime_type=item.get("MimeType", "application/octet-stream"),
            size=int(item.get("FileSize", 0)),
            metadata=metadata,
        )

    async def save_artifact(self, artifact: ArtifactManifestEntry) -> None:
        """Save artifact metadata to SharePoint list."""
        async with self._lock:
            await self._ensure_lists()
            ctx = self._get_context()

            def _save():
                artifacts_list = ctx.web.lists.get_by_title(ARTIFACTS_LIST)

                # Check if artifact already exists using CAML query
                caml_query = f"""
                    <View>
                        <Query>
                            <Where>
                                <Eq>
                                    <FieldRef Name='Title'/>
                                    <Value Type='Text'>{artifact.artifact_id}</Value>
                                </Eq>
                            </Where>
                        </Query>
                        <RowLimit>1</RowLimit>
                    </View>
                """
                items = artifacts_list.get_items().filter(f"Title eq '{artifact.artifact_id}'")
                ctx.load(items)
                ctx.execute_query()

                item_data = self._artifact_to_list_item(artifact)

                if len(items) > 0:
                    # Update existing item
                    existing_item = items[0]
                    for key, value in item_data.items():
                        if key != "Title":  # Don't update Title (primary key)
                            existing_item.set_property(key, value)
                    existing_item.update()
                    ctx.execute_query()
                    logger.debug(f"Updated artifact in SharePoint: {artifact.artifact_id}")
                else:
                    # Create new item
                    artifacts_list.add_item(item_data)
                    ctx.execute_query()
                    logger.debug(f"Created artifact in SharePoint: {artifact.artifact_id}")

            await asyncio.to_thread(_save)

    async def find_by_id(self, artifact_id: str) -> ArtifactManifestEntry | None:
        """Find artifact by persistent ID."""
        async with self._lock:
            await self._ensure_lists()
            ctx = self._get_context()

            def _find():
                artifacts_list = ctx.web.lists.get_by_title(ARTIFACTS_LIST)
                items = artifacts_list.get_items().filter(f"Title eq '{artifact_id}'")
                ctx.load(items)
                ctx.execute_query()

                if len(items) > 0:
                    return items[0].properties
                return None

            result = await asyncio.to_thread(_find)

            if result:
                return self._list_item_to_artifact(result)
            return None

    async def find_by_hash(self, content_hash: str) -> list[ArtifactManifestEntry]:
        """Find artifacts by content hash."""
        async with self._lock:
            await self._ensure_lists()
            ctx = self._get_context()

            def _find():
                artifacts_list = ctx.web.lists.get_by_title(ARTIFACTS_LIST)
                items = artifacts_list.get_items().filter(f"ContentHash eq '{content_hash}'")
                ctx.load(items)
                ctx.execute_query()
                return [item.properties for item in items]

            results = await asyncio.to_thread(_find)
            return [self._list_item_to_artifact(r) for r in results]

    async def update_location(self, artifact_id: str, new_path: str) -> bool:
        """Update artifact location after file move."""
        async with self._lock:
            await self._ensure_lists()
            ctx = self._get_context()

            def _update():
                artifacts_list = ctx.web.lists.get_by_title(ARTIFACTS_LIST)
                items = artifacts_list.get_items().filter(f"Title eq '{artifact_id}'")
                ctx.load(items)
                ctx.execute_query()

                if len(items) > 0:
                    items[0].set_property("CurrentFilename", new_path)
                    items[0].update()
                    ctx.execute_query()
                    logger.debug(f"Updated location for {artifact_id}: {new_path}")
                    return True
                return False

            return await asyncio.to_thread(_update)

    async def save_collection(self, manifest: CollectionManifest) -> None:
        """Save full collection manifest to SharePoint."""
        async with self._lock:
            await self._ensure_lists()
            ctx = self._get_context()

            def _save_manifest():
                collections_list = ctx.web.lists.get_by_title(COLLECTIONS_LIST)

                # Check if collection exists
                items = collections_list.get_items().filter(
                    f"Title eq '{manifest.manifest_id}'"
                )
                ctx.load(items)
                ctx.execute_query()

                item_data = {
                    "Title": manifest.manifest_id,
                    "Version": manifest.version,
                    "CreatedAt": manifest.created_at,
                    "UpdatedAt": datetime.now(timezone.utc).isoformat(),
                    "SourceType": manifest.source_type,
                    "SourceUrl": manifest.source_url or "",
                    "SourcePath": manifest.source_path or "",
                    "OutputFolder": manifest.output_folder,
                    "NamingTemplate": manifest.naming_config.template,
                    "IndexStart": manifest.naming_config.index_start,
                    "IndexPadding": manifest.naming_config.index_padding,
                    "ArtifactCount": len(manifest.artifacts),
                }

                if len(items) > 0:
                    # Update existing
                    existing_item = items[0]
                    for key, value in item_data.items():
                        if key != "Title":
                            existing_item.set_property(key, value)
                    existing_item.update()
                    ctx.execute_query()
                    logger.info(f"Updated collection in SharePoint: {manifest.manifest_id}")
                else:
                    # Create new
                    collections_list.add_item(item_data)
                    ctx.execute_query()
                    logger.info(f"Created collection in SharePoint: {manifest.manifest_id}")

            await asyncio.to_thread(_save_manifest)

        # Save all artifacts (outside the lock for manifest)
        for artifact in manifest.artifacts:
            await self.save_artifact(artifact)

    async def load_collection(self, manifest_id: str) -> CollectionManifest | None:
        """Load collection manifest from SharePoint."""
        async with self._lock:
            await self._ensure_lists()
            ctx = self._get_context()

            def _load():
                collections_list = ctx.web.lists.get_by_title(COLLECTIONS_LIST)
                items = collections_list.get_items().filter(f"Title eq '{manifest_id}'")
                ctx.load(items)
                ctx.execute_query()

                if len(items) > 0:
                    return items[0].properties
                return None

            collection_data = await asyncio.to_thread(_load)

            if not collection_data:
                return None

            # Load artifacts for this collection
            def _load_artifacts():
                artifacts_list = ctx.web.lists.get_by_title(ARTIFACTS_LIST)
                items = artifacts_list.get_items().filter(
                    f"CollectionId eq '{manifest_id}'"
                )
                ctx.load(items)
                ctx.execute_query()
                return [item.properties for item in items]

            artifact_data = await asyncio.to_thread(_load_artifacts)
            artifacts = [self._list_item_to_artifact(a) for a in artifact_data]

            # Reconstruct naming config from stored fields
            naming_config = NamingConfig(
                template=collection_data.get("NamingTemplate", "{index}_{hash}"),
                index_start=int(collection_data.get("IndexStart", 1)),
                index_padding=int(collection_data.get("IndexPadding", 3)),
            )

            return CollectionManifest(
                manifest_id=collection_data.get("Title", ""),
                version=collection_data.get("Version", "1.0"),
                created_at=collection_data.get("CreatedAt", ""),
                updated_at=collection_data.get("UpdatedAt", ""),
                source_type=collection_data.get("SourceType", "local"),
                source_url=collection_data.get("SourceUrl") or None,
                source_path=collection_data.get("SourcePath") or None,
                output_folder=collection_data.get("OutputFolder", ""),
                naming_config=naming_config,
                artifacts=artifacts,
            )

    async def list_collections(self) -> list[str]:
        """List all collection manifest IDs from SharePoint."""
        async with self._lock:
            await self._ensure_lists()
            ctx = self._get_context()

            def _list():
                collections_list = ctx.web.lists.get_by_title(COLLECTIONS_LIST)
                items = collections_list.get_items().select(["Title"])
                ctx.load(items)
                ctx.execute_query()
                return [item.properties.get("Title", "") for item in items if item.properties.get("Title")]

            return await asyncio.to_thread(_list)
