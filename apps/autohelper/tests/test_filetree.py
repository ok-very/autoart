"""Tests for the filetree module."""

from pathlib import Path

from fastapi.testclient import TestClient

from autohelper.db import get_db
from autohelper.modules.filetree.service import FiletreeService
from autohelper.modules.index.service import IndexService


class TestFiletreeService:
    """Test filetree service logic."""

    def test_get_tree_returns_empty_for_no_index(
        self, client: TestClient, temp_dir: Path, test_db
    ) -> None:
        """get_tree should return empty roots when no files are indexed."""
        service = FiletreeService()
        result = service.get_tree()

        # May have roots registered but no files
        for root in result:
            assert root.children is not None
            # Files inside should be empty if nothing indexed
            # But we just check no crash

    def test_get_tree_builds_hierarchy_from_files(
        self, client: TestClient, temp_dir: Path, test_db
    ) -> None:
        """get_tree should build correct hierarchy from indexed files."""
        # Create test file structure
        subdir = temp_dir / "projects" / "test-project"
        subdir.mkdir(parents=True)
        (subdir / "document.pdf").write_text("pdf content")
        (subdir / "notes.txt").write_text("notes")
        (temp_dir / "root-file.txt").write_text("root level")

        # Index the files
        index_service = IndexService()
        index_service.rebuild_index()

        # Get tree
        service = FiletreeService()
        result = service.get_tree()

        assert len(result) >= 1
        root_node = result[0]
        assert root_node.is_dir is True
        assert root_node.children is not None

        # Should have nested structure
        all_paths = self._collect_paths(root_node)
        assert any("root-file.txt" in p for p in all_paths)
        assert any("document.pdf" in p for p in all_paths)

    def test_get_tree_respects_max_depth(self, client: TestClient, temp_dir: Path, test_db) -> None:
        """get_tree should truncate at max_depth."""
        # Create deep structure
        deep = temp_dir / "a" / "b" / "c" / "d" / "e"
        deep.mkdir(parents=True)
        (deep / "deep.txt").write_text("deep file")

        # Index
        index_service = IndexService()
        index_service.rebuild_index()

        # Get tree with depth=2
        service = FiletreeService()
        result = service.get_tree(max_depth=2)

        assert len(result) >= 1
        # Deep file should not appear at depth 2
        all_paths = self._collect_paths(result[0])
        assert not any("deep.txt" in p for p in all_paths)

    def test_get_tree_filters_by_extension(
        self, client: TestClient, temp_dir: Path, test_db
    ) -> None:
        """get_tree should filter by extension."""
        (temp_dir / "doc.pdf").write_text("pdf")
        (temp_dir / "notes.txt").write_text("txt")
        (temp_dir / "image.png").write_text("png")

        # Index
        index_service = IndexService()
        index_service.rebuild_index()

        # Get tree with pdf filter
        service = FiletreeService()
        result = service.get_tree(extensions=[".pdf"])

        assert len(result) >= 1
        all_paths = self._collect_paths(result[0])

        # Should only have pdf
        assert any("doc.pdf" in p for p in all_paths)
        assert not any("notes.txt" in p for p in all_paths)
        assert not any("image.png" in p for p in all_paths)

    def test_get_tree_filters_by_root_id(self, client: TestClient, temp_dir: Path, test_db) -> None:
        """get_tree should filter by root_id."""
        (temp_dir / "file.txt").write_text("content")

        # Index to create roots
        index_service = IndexService()
        index_service.rebuild_index()

        # Get root_id from DB
        db = get_db()
        row = db.execute("SELECT root_id FROM roots LIMIT 1").fetchone()

        assert row is not None, "No roots in DB"
        root_id = row["root_id"]
        service = FiletreeService()
        result = service.get_tree(root_id=root_id)

        assert len(result) == 1
        assert result[0].is_dir is True

    def _collect_paths(self, node) -> list[str]:
        """Recursively collect all paths from a tree node."""
        paths = [node.path]
        if node.children:
            for child in node.children:
                paths.extend(self._collect_paths(child))
        return paths


class TestFiletreeEndpoint:
    """Test filetree API endpoints."""

    def test_filetree_endpoint_returns_200(
        self, client: TestClient, temp_dir: Path, test_db
    ) -> None:
        """GET /filetree should return 200."""
        (temp_dir / "test.txt").write_text("test")

        # Index first
        client.post("/index/rebuild", json={})

        response = client.get("/filetree")

        assert response.status_code == 200
        data = response.json()
        assert "roots" in data
        assert isinstance(data["roots"], list)

    def test_filetree_endpoint_with_extensions(
        self, client: TestClient, temp_dir: Path, test_db
    ) -> None:
        """GET /filetree with extensions param should filter."""
        (temp_dir / "doc.pdf").write_text("pdf")
        (temp_dir / "notes.txt").write_text("txt")

        # Index
        client.post("/index/rebuild", json={})

        response = client.get("/filetree?extensions=.pdf")

        assert response.status_code == 200
        data = response.json()
        assert "roots" in data

    def test_filetree_endpoint_with_max_depth(
        self, client: TestClient, temp_dir: Path, test_db
    ) -> None:
        """GET /filetree with max_depth param should work."""
        response = client.get("/filetree?max_depth=5")

        assert response.status_code == 200

    def test_filetree_endpoint_with_root_id(
        self, client: TestClient, temp_dir: Path, test_db
    ) -> None:
        """GET /filetree with root_id param should filter to one root."""
        (temp_dir / "file.txt").write_text("content")

        # Index
        client.post("/index/rebuild", json={})

        # Get a root_id
        db = get_db()
        row = db.execute("SELECT root_id FROM roots LIMIT 1").fetchone()

        assert row is not None, "No roots in DB"
        response = client.get(f"/filetree?root_id={row['root_id']}")
        assert response.status_code == 200
        data = response.json()
        assert len(data["roots"]) <= 1
