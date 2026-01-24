"""
SharePoint storage backend (optional).

Stores artifact metadata in a SharePoint list.
Requires office365-rest-python-client package.

This is a stub implementation - full implementation is a Phase 2 task.
"""

from pathlib import Path
from typing import TYPE_CHECKING

from ..runner.types import ArtifactManifestEntry, CollectionManifest

# Only import SharePoint libs when type checking or actually used
if TYPE_CHECKING:
    pass  # SharePoint types would be imported here


class SharePointStorageBackend:
    """
    SharePoint-based metadata storage (optional backend).

    Stores collection manifests in a SharePoint list for enterprise
    environments with SharePoint integration.

    NOTE: This is a stub implementation. Full implementation requires:
    - office365-rest-python-client package
    - SharePoint app registration with appropriate permissions
    - ArtifactCollections list in SharePoint site
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
            site_url: SharePoint site URL
            client_id: Azure AD app client ID
            client_secret: Azure AD app client secret
            output_folder: Local output folder (for reference in metadata)
        """
        self.site_url = site_url
        self.client_id = client_id
        self.client_secret = client_secret
        self.output_folder = Path(output_folder)

        # Lazy import to fail gracefully if package not installed
        try:
            from office365.runtime.auth.client_credential import ClientCredential
            from office365.sharepoint.client_context import ClientContext

            self.ctx = ClientContext(site_url).with_credentials(
                ClientCredential(client_id, client_secret)
            )
        except ImportError as e:
            raise ImportError(
                "SharePoint backend requires 'office365-rest-python-client' package. "
                "Install with: pip install office365-rest-python-client"
            ) from e

        self.list_name = "ArtifactCollections"

    async def save_artifact(self, artifact: ArtifactManifestEntry) -> None:
        """Save artifact metadata to SharePoint list."""
        # TODO: Implement SharePoint list item creation
        raise NotImplementedError("SharePoint backend not yet implemented")

    async def find_by_id(self, artifact_id: str) -> ArtifactManifestEntry | None:
        """Find artifact by persistent ID."""
        # TODO: Implement CAML query on ArtifactCollections list
        raise NotImplementedError("SharePoint backend not yet implemented")

    async def find_by_hash(self, content_hash: str) -> list[ArtifactManifestEntry]:
        """Find artifacts by content hash."""
        # TODO: Implement CAML query by content_hash
        raise NotImplementedError("SharePoint backend not yet implemented")

    async def update_location(self, artifact_id: str, new_path: str) -> bool:
        """Update artifact location in SharePoint."""
        # TODO: Implement list item update
        raise NotImplementedError("SharePoint backend not yet implemented")

    async def save_collection(self, manifest: CollectionManifest) -> None:
        """Save full collection manifest to SharePoint."""
        # TODO: Implement document library upload + list item
        raise NotImplementedError("SharePoint backend not yet implemented")

    async def load_collection(self, manifest_id: str) -> CollectionManifest | None:
        """Load collection manifest from SharePoint."""
        # TODO: Implement document library download
        raise NotImplementedError("SharePoint backend not yet implemented")

    async def list_collections(self) -> list[str]:
        """List all collection manifest IDs in SharePoint."""
        # TODO: Implement list query
        raise NotImplementedError("SharePoint backend not yet implemented")
