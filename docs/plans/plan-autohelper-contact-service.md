# AutoHelper Contact Sync Service + Windows Installer

## Context

Microsoft EAC was recently installed to sync organizational contacts from admin@ballardfineart.com. AutoHelper needs a new contact sync module that polls the reconciled master CSV every 30 minutes during business hours and pushes changes to Exchange Online via PowerShell remoting. This is also the experiment for making AutoHelper a standalone Windows service with its own installer, decoupled from the autoart development workflow.

**Current state**: AutoHelper is a Python FastAPI app in `autoart/apps/autohelper/`. It runs as a tray app or console process. No Windows service support, no installer, no Exchange integration.

**Target state**: AutoHelper polls `master_contacts.csv`, diffs against Exchange Online contacts, syncs via PowerShell, runs as a Windows service, and ships as a one-click installer.

---

## Phase 0: Headless Mode + Local Settings Dashboard

AutoHelper currently depends on the AutoArt React frontend for its settings UI - the tray menu's "Open Settings" opens `localhost:5173/settings#autohelper`. When running standalone as a Windows service (no autoart stack), there's no way to configure anything visually.

**The fix**: A lightweight local web dashboard served directly by FastAPI at `http://localhost:8100/dashboard`. No React, no build step — plain HTML + CSS + vanilla JS calling the existing config API.

**What already works headless (no changes needed)**:
- Backend poller already skips when not paired (`sync/poller.py:487` checks link key)
- `GET /config` and `PUT /config` already manage `config.json` locally (`modules/config/router.py`)
- GC, mail, index, runner modules all work without the backend
- `ConfigStore` (`config/store.py`) handles local persistence

**New files**:

| File | Responsibility |
|------|---------------|
| `autohelper/gui/dashboard/index.html` | Single-page settings dashboard |
| `autohelper/gui/dashboard/app.js` | Vanilla JS — fetch config API, render forms, submit changes |
| `autohelper/gui/dashboard/style.css` | Minimal styling (follows AutoArt design palette) |
| `autohelper/gui/dashboard_router.py` | FastAPI `StaticFiles` mount + dashboard route |

**Dashboard sections**:
- **Service Status** — health endpoint data, uptime, active modules
- **General Settings** — allowed roots, excludes, log level
- **Contact Sync** — CSV path, schedule, Exchange credentials, dry run toggle
- **Contact Sync Status** — last run, next run, history log, manual sync trigger
- **Mail Settings** — enabled, poll interval, output path
- **Pairing** — paired/unpaired status, pair/unpair buttons (only when autoart URL configured)

**Changes to existing files**:
- `app.py` — mount dashboard static files and router
- `gui/popup.py` — `open_settings_in_browser()` opens `localhost:8100/dashboard` instead of the React frontend
- `gui/icon.py` — no changes needed (already calls `open_settings_in_browser`)

**Key principle**: The dashboard is read/write against `GET /config` and `PUT /config`. Contact sync status comes from new endpoints in Phase 1. The dashboard is the **only** settings UI for standalone mode, and works equally well when paired (just shows additional pairing info).

---

## Phase 1: Contact Sync Module Core

**New files** in `apps/autohelper/autohelper/modules/contacts/`:

| File | Responsibility |
|------|---------------|
| `__init__.py` | Exports router, service |
| `types.py` | `ContactRecord` dataclass, `SyncResult` |
| `csv_reader.py` | Parse CSV (utf-8-sig for BOM), normalize fields, dedupe by email_primary |
| `service.py` | `ContactSyncService` - file hash change detection, working hours guard, orchestrates sync |
| `scheduler.py` | APScheduler `IntervalTrigger(minutes=30)` with working hours guard (follows `gc/scheduler.py` pattern) |
| `router.py` | `GET /contacts/status`, `POST /contacts/sync` (manual), `GET /contacts/history` |
| `schemas.py` | Pydantic response models |

**Config additions** to `config/settings.py`:
```
contact_sync_enabled: bool = False
contact_sync_csv_path: str = ""
contact_sync_interval_minutes: int = 30
contact_sync_work_hours_start: int = 8
contact_sync_work_hours_end: int = 18
contact_sync_timezone: str = "America/Los_Angeles"
contact_sync_exchange_upn: str = ""          # admin@ballardfineart.com
contact_sync_exchange_org: str = ""
contact_sync_exchange_app_id: str = ""       # For cert-based auth (service mode)
contact_sync_exchange_cert_thumbprint: str = ""
contact_sync_dry_run: bool = False
contact_sync_batch_size: int = 50
contact_sync_managed_prefix: str = "BFA-"    # Prefix to identify managed contacts
```

**New migration** `0008_contact_sync.sql`:
- `contact_sync_state` - singleton row tracking last file hash, last sync time, counts
- `contact_sync_log` - append-only audit log per sync run (status, counts, errors, duration)
- `contact_sync_contacts` - maps CSV email_primary to Exchange identity, tracks per-row hash for incremental sync

**Wire into `app.py`**: Add router, start/stop scheduler in lifespan (same pattern as GC).

**Key files to modify**:
- `autohelper/app.py` (add router, lifespan hooks)
- `autohelper/config/settings.py` (new settings)

**Reuse**: Follow `modules/gc/scheduler.py` pattern exactly. Reuse `db/database.py` for SQLite access.

---

## Phase 2: PowerShell Exchange Integration

**New files**:

| File | Responsibility |
|------|---------------|
| `modules/contacts/exchange_sync.py` | Python subprocess wrapper - builds diff, serializes to temp JSON, invokes PowerShell, parses results |
| `modules/contacts/powershell/sync_contacts.ps1` | Connect-ExchangeOnline, CRUD contacts, return JSON results |
| `modules/contacts/powershell/test_connection.ps1` | Verify Exchange Online connectivity |

**Sync flow**:
1. `csv_reader.py` parses CSV into `ContactRecord` list
2. `service.py` compares file hash against stored hash - skip if unchanged
3. `exchange_sync.py` diffs CSV contacts against `contact_sync_contacts` table (per-row hash)
4. Builds create/update/delete lists
5. Serializes to temp JSON file
6. Invokes: `powershell.exe -ExecutionPolicy Bypass -File sync_contacts.ps1 -InputFile <path>`
7. Script connects to Exchange, executes operations, writes JSON result to stdout
8. Python parses result, updates tracking tables

**CSV field -> Exchange property mapping**:
| CSV | Exchange |
|-----|----------|
| email_primary | ExternalEmailAddress |
| full_name | DisplayName |
| first_name / last_name | FirstName / LastName |
| company | Company (Set-Contact) |
| job_title | Title (Set-Contact) |
| phone_business / phone_mobile | Phone / MobilePhone (Set-Contact) |
| address fields | StreetAddress, City, StateOrProvince, PostalCode, CountryOrRegion |
| category_canonical | CustomAttribute1 |

**Auth**: Certificate-based for service mode (Azure AD app registration), interactive fallback for tray/dev mode.

**Safety**: Deletion threshold check - abort if >20% of contacts would be deleted in one run (prevents accidental wipe from truncated CSV).

---

## Phase 3: Windows Service

**New file**: `autohelper/winservice.py`

Uses `win32serviceutil.ServiceFramework` (pywin32 already a dependency):
- Service name: `AutoHelper`
- Starts uvicorn server + all schedulers in a background thread
- Handles SCM start/stop events
- Logs to Windows Event Log via `servicemanager`

**Modify `main.py`**:
```
--service install   -> register Windows service
--service remove    -> deregister
--service start     -> start via SCM
--tray              -> existing tray mode
(no flag)           -> console mode
```

**Add PID lockfile** in data directory to prevent simultaneous service + tray instances.

**Key files to modify**:
- `autohelper/main.py` (add --service routing)

---

## Phase 4: PyInstaller + Inno Setup Installer

**New files** in `apps/autohelper/scripts/`:

| File | Purpose |
|------|---------|
| `autohelper.spec` | PyInstaller spec - bundles Python, deps, migrations, PS1 scripts |
| `installer.iss` | Inno Setup script - installs to Program Files, registers service, Start Menu entries |
| `build_installer.py` | Orchestrator - runs PyInstaller then ISCC.exe |

**Two executables** from PyInstaller:
- `autohelper.exe` (console) - for service registration and CLI
- `autohelper-tray.exe` (windowed) - for system tray mode

**Inno Setup installer**:
- Installs to `C:\Program Files\AutoHelper\`
- Registers Windows service (`autohelper.exe --service install`)
- Start Menu: tray launcher, status page link, uninstaller
- Uninstall: stops service, deregisters, removes files
- Ships `.env.template` for config

**Critical PyInstaller concerns**:
- Hidden imports: uvicorn internals, pydantic, apscheduler triggers, win32 modules, pystray._win32
- Data files: SQL migrations, PowerShell scripts, dashboard HTML/CSS/JS
- Test the built exe thoroughly - dynamic imports are the #1 failure mode

---

## Phase 5: CI/CD Release Pipeline

**New file**: `.github/workflows/build-autohelper.yml`

Triggers on tags matching `autohelper-v*`. Runs on `windows-latest`:
1. Checkout, setup Python 3.11
2. Install deps + PyInstaller
3. Run tests
4. Build with PyInstaller
5. Build installer with Inno Setup
6. Upload as GitHub Release artifact

**Version source of truth**: `autohelper/__init__.py` + `pyproject.toml`

**No separate release branch needed** - tags on main trigger builds. Code stays in monorepo.

---

## Stacked PR Sequence

| PR | Scope | Depends on |
|----|-------|------------|
| 0 | Headless mode: local settings dashboard, `popup.py` redirect to local dashboard | - |
| 1 | Contact sync module core (CSV reader, service, scheduler, router, migration, config) | - |
| 2 | PowerShell integration (exchange_sync.py, PS1 scripts, field mapping) | PR 1 |
| 3 | Windows service (winservice.py, main.py --service flag, event log) | PR 1 |
| 4 | PyInstaller + Inno Setup (spec, iss, build script) | PR 3 |
| 5 | GitHub Actions CI/CD workflow | PR 4 |

PRs 0 and 1 can be developed in parallel (independent). PRs 2 and 3 can also be parallel after PR 1.

---

## Verification

**Phase 0**: Start autohelper without autoart running. Open `http://localhost:8100/dashboard`. Verify settings load, can edit and save config, contact sync section shows. Verify tray "Open Settings" opens the local dashboard (not the React frontend).

**Phase 1**: Run autohelper locally, hit `GET /contacts/status` and `POST /contacts/sync`. Verify CSV is read, hash stored in SQLite, scheduler fires during work hours and skips outside.

**Phase 2**: With Exchange Online credentials configured, trigger a manual sync. Verify contacts appear in EAC. Modify CSV, trigger again - verify updates. Test deletion threshold safety.

**Phase 3**: On Windows, run `autohelper.exe --service install`, `net start AutoHelper`, verify service runs in Services.msc. Check Windows Event Log. `net stop AutoHelper`, verify clean shutdown.

**Phase 4**: Run `python scripts/build_installer.py`. Install the resulting `.exe` on a clean Windows machine (no Python). Verify service starts, contacts sync, tray mode works from Start Menu.

**Phase 5**: Push a tag `autohelper-v0.2.0`. Verify GitHub Actions builds and publishes the installer to Releases.

---

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Interactive auth won't work in service mode | Require cert-based auth for service; fail fast with clear error |
| Exchange throttling on large initial sync | Batch size setting (default 50), max-ops-per-run limit, spread across cycles |
| CSV on OneDrive/network share unavailable | Try/except on file access, skip cycle, log warning |
| Truncated CSV triggers mass deletion | Abort if >20% of contacts would be deleted; require manual override |
| PyInstaller misses dynamic imports | Comprehensive hiddenimports list, `--verify` CLI flag to test imports |
| Service + tray running simultaneously | PID lockfile + port conflict detection at startup |
