"""Tests for file watch module."""

import time
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

from autohelper.modules.file_watch.service import FileWatchService


def test_watch_unwatch_lifecycle(test_db: Any, temp_dir: Path) -> None:
    """Test starting and stopping watchers."""
    service = FileWatchService()

    # Watch a directory
    success = service.watch("test-root", str(temp_dir))
    assert success is True

    # Verify it's being watched
    roots = service.get_watched_roots()
    assert len(roots) == 1
    assert roots[0].root_id == "test-root"

    # Unwatch
    success = service.unwatch("test-root")
    assert success is True

    # Verify it's no longer watched
    roots = service.get_watched_roots()
    assert len(roots) == 0


def test_watch_nonexistent_path(test_db: Any, temp_dir: Path) -> None:
    """Test watching a nonexistent path fails gracefully."""
    service = FileWatchService()

    nonexistent = temp_dir / "does-not-exist"
    success = service.watch("test-root", str(nonexistent))
    assert success is False


def test_watch_file_not_directory(test_db: Any, temp_dir: Path) -> None:
    """Test watching a file (not directory) fails."""
    service = FileWatchService()

    test_file = temp_dir / "test.txt"
    test_file.write_text("test")

    success = service.watch("test-root", str(test_file))
    assert success is False


def test_file_created_event(test_db: Any, temp_dir: Path) -> None:
    """Test file creation generates event."""
    service = FileWatchService()

    # Start watching
    service.watch("test-root", str(temp_dir))

    # Create a file
    test_file = temp_dir / "new_file.txt"
    test_file.write_text("content")

    # Give watchdog time to detect
    time.sleep(0.2)

    # Drain events
    events = service.drain_events()

    # Should have one creation event
    assert len(events) > 0
    create_events = [e for e in events if e.event_type.value == "file_created"]
    assert len(create_events) == 1
    assert create_events[0].root_id == "test-root"
    assert "new_file.txt" in create_events[0].path

    # Cleanup
    service.shutdown()


def test_file_deleted_event(test_db: Any, temp_dir: Path) -> None:
    """Test file deletion generates event."""
    service = FileWatchService()

    # Create a file first
    test_file = temp_dir / "to_delete.txt"
    test_file.write_text("content")

    # Start watching
    service.watch("test-root", str(temp_dir))

    # Delete the file
    test_file.unlink()

    # Give watchdog time to detect
    time.sleep(0.2)

    # Drain events
    events = service.drain_events()

    # Should have deletion event
    delete_events = [e for e in events if e.event_type.value == "file_deleted"]
    assert len(delete_events) >= 1
    assert any("to_delete.txt" in e.path for e in delete_events)

    # Cleanup
    service.shutdown()


def test_file_moved_event(test_db: Any, temp_dir: Path) -> None:
    """Test file move generates event."""
    service = FileWatchService()

    # Create a file first
    src_file = temp_dir / "source.txt"
    src_file.write_text("content")

    # Start watching
    service.watch("test-root", str(temp_dir))

    # Move the file
    dest_file = temp_dir / "destination.txt"
    src_file.rename(dest_file)

    # Give watchdog time to detect
    time.sleep(0.2)

    # Drain events
    events = service.drain_events()

    # Should have move event
    move_events = [e for e in events if e.event_type.value == "file_moved"]
    assert len(move_events) >= 1
    move_event = move_events[0]
    assert "destination.txt" in move_event.path
    assert move_event.old_path is not None
    assert "source.txt" in move_event.old_path

    # Cleanup
    service.shutdown()


def test_reference_matching(test_db: Any, temp_dir: Path) -> None:
    """Test events match against reference registry."""
    from autohelper.db import get_db

    service = FileWatchService()

    # Create a test file and ref
    test_file = temp_dir / "tracked.txt"
    test_file.write_text("content")
    canonical_path = str(test_file.resolve())

    # Insert a ref for this path
    db = get_db()
    ref_id = "test-ref-123"
    db.execute(
        "INSERT INTO refs (ref_id, canonical_path, work_item_id) VALUES (?, ?, ?)",
        (ref_id, canonical_path, "work-item-456"),
    )
    db.commit()

    # Delete the file (we'll recreate it while watching)
    test_file.unlink()

    # Start watching
    service.watch("test-root", str(temp_dir))

    # Recreate the file (should match ref)
    test_file.write_text("new content")

    # Give watchdog time to detect
    time.sleep(0.2)

    # Drain events
    events = service.drain_events()

    # Should have creation event with ref_id
    create_events = [e for e in events if e.event_type.value == "file_created"]
    assert len(create_events) >= 1

    # Find the event for our tracked file
    matched = [e for e in create_events if e.ref_id == ref_id]
    assert len(matched) == 1
    assert matched[0].ref_id == ref_id

    # Cleanup
    service.shutdown()


def test_drain_clears_queue(test_db: Any, temp_dir: Path) -> None:
    """Test draining events clears the queue."""
    service = FileWatchService()

    # Start watching
    service.watch("test-root", str(temp_dir))

    # Create files
    for i in range(3):
        (temp_dir / f"file{i}.txt").write_text("content")

    time.sleep(0.2)

    # First drain
    events1 = service.drain_events()
    assert len(events1) > 0

    # Second drain should be empty
    events2 = service.drain_events()
    assert len(events2) == 0

    # Cleanup
    service.shutdown()


def test_modified_events_ignored(test_db: Any, temp_dir: Path) -> None:
    """Test that file modification events are not captured."""
    service = FileWatchService()

    # Create a file
    test_file = temp_dir / "modified.txt"
    test_file.write_text("initial")

    # Start watching
    service.watch("test-root", str(temp_dir))

    # Clear any creation events
    time.sleep(0.2)
    service.drain_events()

    # Modify the file
    test_file.write_text("updated")

    # Give watchdog time to detect
    time.sleep(0.2)

    # Drain events - should be empty (no modified events)
    events = service.drain_events()

    # Filter to modification-like events (there shouldn't be any in our schema)
    # We only capture created/deleted/moved, so this should be empty
    assert len(events) == 0

    # Cleanup
    service.shutdown()


def test_api_watch_endpoint(client: TestClient, temp_dir: Path) -> None:
    """Test /file-watch/watch endpoint."""
    response = client.post(
        "/file-watch/watch",
        json={"root_id": "api-test", "path": str(temp_dir)},
    )
    assert response.status_code == 200
    assert response.json()["success"] is True


def test_api_unwatch_endpoint(client: TestClient, temp_dir: Path) -> None:
    """Test /file-watch/unwatch endpoint."""
    # Start watching first
    client.post(
        "/file-watch/watch",
        json={"root_id": "api-test", "path": str(temp_dir)},
    )

    # Unwatch
    response = client.post("/file-watch/unwatch/api-test")
    assert response.status_code == 200
    assert response.json()["success"] is True


def test_api_events_endpoint(client: TestClient, temp_dir: Path) -> None:
    """Test /file-watch/events endpoint."""
    # Start watching
    client.post(
        "/file-watch/watch",
        json={"root_id": "api-test", "path": str(temp_dir)},
    )

    # Create a file
    (temp_dir / "api_test.txt").write_text("content")
    time.sleep(0.2)

    # Get events
    response = client.get("/file-watch/events")
    assert response.status_code == 200
    data = response.json()
    assert "events" in data
    assert "count" in data
    assert data["count"] == len(data["events"])


def test_api_roots_endpoint(client: TestClient, temp_dir: Path) -> None:
    """Test /file-watch/roots endpoint."""
    # Start watching
    client.post(
        "/file-watch/watch",
        json={"root_id": "api-test", "path": str(temp_dir)},
    )

    # Get roots
    response = client.get("/file-watch/roots")
    assert response.status_code == 200
    data = response.json()
    assert "roots" in data
    assert len(data["roots"]) == 1
    assert data["roots"][0]["root_id"] == "api-test"
