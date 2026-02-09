"""Tests for ConnectionStateManager."""

import threading
import time

import pytest

from autohelper.sync.connection_state import ConnectionState, ConnectionStateManager


@pytest.fixture(autouse=True)
def reset_singleton():
    """Reset singleton before each test."""
    ConnectionStateManager.reset()
    yield
    ConnectionStateManager.reset()


def test_singleton_behavior():
    """Test that ConnectionStateManager is a singleton."""
    mgr1 = ConnectionStateManager()
    mgr2 = ConnectionStateManager()
    assert mgr1 is mgr2


def test_initial_state():
    """Test that initial state is UNPAIRED."""
    mgr = ConnectionStateManager()
    assert mgr.state == ConnectionState.UNPAIRED


def test_state_transitions():
    """Test state transitions."""
    mgr = ConnectionStateManager()

    # UNPAIRED -> PAIRED_CONNECTED
    mgr.set_state(ConnectionState.PAIRED_CONNECTED)
    assert mgr.state == ConnectionState.PAIRED_CONNECTED

    # PAIRED_CONNECTED -> PAIRED_DISCONNECTED
    mgr.set_state(ConnectionState.PAIRED_DISCONNECTED)
    assert mgr.state == ConnectionState.PAIRED_DISCONNECTED  # type: ignore[comparison-overlap]

    # PAIRED_DISCONNECTED -> UNPAIRED
    mgr.set_state(ConnectionState.UNPAIRED)
    assert mgr.state == ConnectionState.UNPAIRED


def test_listener_notification():
    """Test that listeners are notified on state change."""
    mgr = ConnectionStateManager()
    notifications = []

    def listener(state: ConnectionState) -> None:
        notifications.append(state)

    mgr.add_listener(listener)

    # Trigger state change
    mgr.set_state(ConnectionState.PAIRED_CONNECTED)
    assert notifications == [ConnectionState.PAIRED_CONNECTED]

    # Another change
    mgr.set_state(ConnectionState.PAIRED_DISCONNECTED)
    assert notifications == [ConnectionState.PAIRED_CONNECTED, ConnectionState.PAIRED_DISCONNECTED]


def test_listener_not_notified_on_same_state():
    """Test that listeners are not notified when state doesn't change."""
    mgr = ConnectionStateManager()
    notifications = []

    def listener(state: ConnectionState) -> None:
        notifications.append(state)

    mgr.add_listener(listener)

    # Set to same state
    mgr.set_state(ConnectionState.UNPAIRED)
    assert notifications == []  # No notification since state didn't change


def test_remove_listener():
    """Test removing a listener."""
    mgr = ConnectionStateManager()
    notifications = []

    def listener(state: ConnectionState) -> None:
        notifications.append(state)

    mgr.add_listener(listener)
    mgr.set_state(ConnectionState.PAIRED_CONNECTED)
    assert len(notifications) == 1

    # Remove and verify no more notifications
    mgr.remove_listener(listener)
    mgr.set_state(ConnectionState.PAIRED_DISCONNECTED)
    assert len(notifications) == 1  # No new notification


def test_listener_exception_handling():
    """Test that exceptions in listeners don't break state manager."""
    mgr = ConnectionStateManager()

    def bad_listener(state: ConnectionState) -> None:
        raise RuntimeError("Listener failed")

    def good_listener(state: ConnectionState) -> None:
        good_listener.called = True  # type: ignore[attr-defined]

    good_listener.called = False  # type: ignore[attr-defined]

    mgr.add_listener(bad_listener)
    mgr.add_listener(good_listener)

    # State change should complete despite bad_listener raising
    mgr.set_state(ConnectionState.PAIRED_CONNECTED)
    assert mgr.state == ConnectionState.PAIRED_CONNECTED
    assert good_listener.called  # type: ignore[attr-defined]


def test_thread_safety_concurrent_set_state():
    """Test concurrent state changes from multiple threads."""
    mgr = ConnectionStateManager()
    barrier = threading.Barrier(10)
    results = []

    def set_state_worker(target_state: ConnectionState) -> None:
        barrier.wait()  # Synchronize all threads
        mgr.set_state(target_state)
        results.append(mgr.state)

    threads = [
        threading.Thread(target=set_state_worker, args=(ConnectionState.PAIRED_CONNECTED,))
        for _ in range(5)
    ] + [
        threading.Thread(target=set_state_worker, args=(ConnectionState.PAIRED_DISCONNECTED,))
        for _ in range(5)
    ]

    for t in threads:
        t.start()
    for t in threads:
        t.join()

    # Final state should be one of the target states
    assert mgr.state in (ConnectionState.PAIRED_CONNECTED, ConnectionState.PAIRED_DISCONNECTED)


def test_thread_safety_listeners():
    """Test adding/removing listeners while state changes."""
    mgr = ConnectionStateManager()
    notifications = []
    lock = threading.Lock()

    def listener(state: ConnectionState) -> None:
        with lock:
            notifications.append(state)

    def add_remove_worker() -> None:
        for _ in range(10):
            mgr.add_listener(listener)
            time.sleep(0.001)
            mgr.remove_listener(listener)

    def state_change_worker() -> None:
        states = [ConnectionState.PAIRED_CONNECTED, ConnectionState.PAIRED_DISCONNECTED, ConnectionState.UNPAIRED]
        for state in states * 3:
            mgr.set_state(state)
            time.sleep(0.001)

    workers = [
        threading.Thread(target=add_remove_worker),
        threading.Thread(target=add_remove_worker),
        threading.Thread(target=state_change_worker),
    ]

    for t in workers:
        t.start()
    for t in workers:
        t.join()

    # Should complete without deadlock
    assert True


def test_reset():
    """Test that reset clears the singleton instance."""
    mgr1 = ConnectionStateManager()
    mgr1.set_state(ConnectionState.PAIRED_CONNECTED)
    assert mgr1.state == ConnectionState.PAIRED_CONNECTED

    ConnectionStateManager.reset()

    mgr2 = ConnectionStateManager()
    assert mgr2.state == ConnectionState.UNPAIRED  # Fresh instance
    assert mgr1 is not mgr2  # Different instance
