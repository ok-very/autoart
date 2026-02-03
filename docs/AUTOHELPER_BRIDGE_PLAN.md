# Complete AutoHelper Settings Bridge (Pairing → Control)

## Problem

The Feb 2026 pairing refactor established authentication between AutoHelper and the backend, but the settings control loop was never closed. Pairing works; controlling AutoHelper through the web UI does not.

### Structural Gaps

| Gap | Location | Impact |
|-----|----------|--------|
| Missing `sync.py` | `apps/autohelper/autohelper/` | AutoHelper never polls backend for settings |
| Missing DB tables | `backend/src/db/migrations/` | Backend endpoints crash on any settings call |
| Wrong routing | `frontend/src/api/autohelperClient.ts` | Frontend talks to localhost, not backend |

### Current Data Flow (Broken)

```
Frontend                                 Backend
  │                                        │
  ├─ PairCard ─────────────────────────────► POST /pair/claim ✓
  │                                        │
  └─ Settings cards ───╳───────────────────► autohelper_instances
       │                                        (TABLE MISSING)
       │
       └──────────────────────────────────► AutoHelper localhost:8100
            (works locally, breaks remotely)     │
                                                 │ sync.py MISSING
                                                 ▼
                                            Backend polling
                                                 ╳ NEVER HAPPENS
```

### Target Data Flow

```
Frontend                                 Backend                         AutoHelper
  │                                        │                                │
  ├─ Settings ─────────────────────────────► PUT /autohelper/settings      │
  │                                        │   └─ autohelper_instances     │
  │                                        │       └─ bump settings_version│
  │                                        │                                │
  │                                        ◄────────────────────────────────┤
  │                                        │  GET /autohelper/poll          │
  │                                        │  (every 5s, x-autohelper-key)  │
  │                                        │                                │
  │                                        │  returns:                      │
  │                                        │    settings + version          │
  │                                        │    pending commands            │
  │                                        │                                ▼
  │                                        │                           if version changed:
  │                                        │                             reload config
```

---

## Implementation Plan

### Phase 1: Backend Tables

**File:** `backend/src/db/migrations/054_autohelper_tables.ts`

```sql
CREATE TABLE autohelper_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id),
  settings JSONB NOT NULL DEFAULT '{}',
  settings_version INTEGER NOT NULL DEFAULT 1,
  status JSONB NOT NULL DEFAULT '{}',
  last_seen TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE autohelper_commands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id),
  command_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending',
  result JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  acknowledged_at TIMESTAMPTZ
);

CREATE INDEX idx_autohelper_commands_pending
  ON autohelper_commands(user_id, status)
  WHERE status = 'pending';
```

**File:** `backend/src/db/schema.ts` — add type exports for new tables.

### Phase 2: AutoHelper Backend Poller

**File:** `apps/autohelper/autohelper/sync.py`

```python
"""
Backend settings poller.

Polls GET /autohelper/poll every N seconds when paired.
Applies settings changes when version bumps.
Executes queued commands.
"""

import threading
import time
import json
import urllib.request
from typing import Optional

from autohelper.config import get_settings, reset_settings
from autohelper.config.store import ConfigStore
from autohelper.shared.logging import get_logger

logger = get_logger(__name__)

_poller_thread: Optional[threading.Thread] = None
_stop_event = threading.Event()
_local_settings_version = 0

POLL_INTERVAL = 5  # seconds


def _poll_once() -> None:
    """Single poll iteration."""
    global _local_settings_version

    store = ConfigStore()
    cfg = store.load()
    link_key = cfg.get("autoart_link_key")

    if not link_key:
        return

    settings = get_settings()
    url = f"{settings.autoart_api_url}/api/autohelper/poll"

    req = urllib.request.Request(url, method="GET")
    req.add_header("x-autohelper-key", link_key)

    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read())
    except Exception as e:
        logger.warning("Poll failed: %s", e)
        return

    # Check for settings update
    remote_version = data.get("settingsVersion", 0)
    if remote_version > _local_settings_version:
        logger.info("Settings updated: v%d → v%d", _local_settings_version, remote_version)
        _apply_settings(data.get("settings", {}))
        _local_settings_version = remote_version

    # Process pending commands
    for cmd in data.get("commands", []):
        _execute_command(cmd)


def _apply_settings(settings: dict) -> None:
    """Apply settings from backend to local config."""
    store = ConfigStore()
    cfg = store.load()

    # Merge backend settings into local config
    for key in ["allowed_roots", "excludes", "mail_enabled",
                "mail_poll_interval", "crawl_depth",
                "min_width", "max_width", "min_height", "max_height",
                "min_filesize_kb", "max_filesize_kb"]:
        if key in settings:
            cfg[key] = settings[key]

    store.save(cfg)
    reset_settings()
    logger.info("Applied settings from backend")


def _execute_command(cmd: dict) -> None:
    """Execute a queued command."""
    cmd_id = cmd.get("id")
    cmd_type = cmd.get("command_type")

    logger.info("Executing command %s: %s", cmd_id, cmd_type)

    # TODO: Implement command execution
    # - rescan_index → call /index/rescan locally
    # - rebuild_index → call /index/rebuild locally
    # - start_mail → call /mail/start locally
    # - stop_mail → call /mail/stop locally
    # - run_gc → call /gc/run locally

    # Acknowledge completion
    _ack_command(cmd_id, success=True)


def _ack_command(cmd_id: str, success: bool, result: dict = None) -> None:
    """Acknowledge command completion to backend."""
    store = ConfigStore()
    cfg = store.load()
    link_key = cfg.get("autoart_link_key")
    settings = get_settings()

    url = f"{settings.autoart_api_url}/api/autohelper/commands/{cmd_id}/ack"
    data = json.dumps({"success": success, "result": result or {}}).encode()

    req = urllib.request.Request(url, data=data, method="POST")
    req.add_header("Content-Type", "application/json")
    req.add_header("x-autohelper-key", link_key)

    try:
        urllib.request.urlopen(req, timeout=5)
    except Exception as e:
        logger.warning("Failed to ack command %s: %s", cmd_id, e)


def _poll_loop() -> None:
    """Main poll loop."""
    while not _stop_event.wait(POLL_INTERVAL):
        try:
            _poll_once()
        except Exception:
            logger.exception("Poll loop error")


def start_backend_poller() -> None:
    """Start the backend poller thread."""
    global _poller_thread, _stop_event

    if _poller_thread and _poller_thread.is_alive():
        return

    _stop_event.clear()
    _poller_thread = threading.Thread(target=_poll_loop, daemon=True)
    _poller_thread.start()
    logger.info("Backend poller started")


def stop_backend_poller() -> None:
    """Stop the backend poller thread."""
    global _poller_thread

    _stop_event.set()
    if _poller_thread:
        _poller_thread.join(timeout=2)
        _poller_thread = None
    logger.info("Backend poller stopped")
```

**Update:** `apps/autohelper/autohelper/main.py` — call `start_backend_poller()` on startup if paired.

### Phase 3: Frontend Routing

**File:** `frontend/src/api/autohelperClient.ts`

Change settings-related calls to go through backend:

```typescript
// For settings (must go through backend)
const BACKEND_BASE = '/api';

// For direct operations (health check, local status during dev)
const AUTOHELPER_DIRECT = import.meta.env.DEV
  ? '/autohelper'
  : (import.meta.env.VITE_AUTOHELPER_URL || 'http://localhost:8100');
```

**File:** `frontend/src/api/hooks/autohelper.ts`

Split hooks:
- `useAutoHelperConfig` → `GET /api/autohelper/settings`
- `useUpdateAutoHelperConfig` → `PUT /api/autohelper/settings`
- `useAutoHelperHealth` → stays direct (localhost check is intentional)
- Command hooks → `POST /api/autohelper/commands`

### Phase 4: Backend Routes Registration

Verify `autohelper.routes.ts` is registered in `app.ts`. Add if missing:

```typescript
import { autohelperRoutes } from './modules/autohelper/autohelper.routes.js';
// ...
app.register(autohelperRoutes, { prefix: '/api/autohelper' });
```

---

## Test Plan

### Unit Tests

- [ ] Migration creates tables correctly
- [ ] `getOrCreateInstance` creates default settings
- [ ] `updateSettings` bumps version
- [ ] `poll` returns settings + pending commands
- [ ] `sync.py` applies settings when version changes

### Integration Tests

| # | Action | Expected Result |
|---|--------|-----------------|
| 1 | Generate pairing code in UI | 6-char code displayed, polling starts |
| 2 | Enter code in AutoHelper tray | Success dialog, tray shows "Paired" |
| 3 | UI detects pairing | "Paired" badge appears, polling stops |
| 4 | Change crawl_depth in UI | Backend stores new value, version bumps |
| 5 | Wait 5 seconds | AutoHelper polls, detects version change |
| 6 | Check AutoHelper config | crawl_depth reflects UI change |
| 7 | Click "Rescan" in UI | Command queued in backend |
| 8 | Wait 5 seconds | AutoHelper executes rescan, acks command |
| 9 | Unpair from tray | Both sides clear state, settings UI shows unpaired |

### Edge Cases

- [ ] AutoHelper not running when settings changed → settings persist, apply on next startup
- [ ] Network failure during poll → logged, retried next interval
- [ ] Invalid link key → 401, trigger re-pair flow
- [ ] Concurrent settings updates → last write wins (version still increments)

---

## Files Changed

| File | Change |
|------|--------|
| `backend/src/db/migrations/054_autohelper_tables.ts` | New |
| `backend/src/db/schema.ts` | Add table types |
| `backend/src/app.ts` | Register autohelper routes (if not already) |
| `apps/autohelper/autohelper/sync.py` | New |
| `apps/autohelper/autohelper/main.py` | Start poller on startup |
| `apps/autohelper/autohelper/gui/icon.py` | Import fix (sync module now exists) |
| `frontend/src/api/autohelperClient.ts` | Split direct vs backend routing |
| `frontend/src/api/hooks/autohelper.ts` | Route settings through backend |

---

## Done Sentence

> User can change AutoHelper settings in the web UI and see them take effect on AutoHelper within 5 seconds, regardless of whether AutoHelper is on the same machine.
