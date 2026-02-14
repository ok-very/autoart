# Plan: AutoHelper Desktop — PyInstaller to Electron Migration

> Status: **Approved**
> Author: architect agent
> Date: 2026-02-14
> Decisions: NSIS installer, keep win32 service as optional [service] extra, static port 8100, React dashboard in Phase 1

---

## 1. Current Architecture

### 1.1 What Exists

AutoHelper (`apps/autohelper/`) is a Python desktop service packaged via PyInstaller into an MSIX installer.

**Runtime stack:**
- **Backend:** FastAPI + uvicorn (async), listening on `127.0.0.1:8100`
- **Database:** SQLite via aiosqlite, stored at `%LOCALAPPDATA%/AutoHelper/autohelper.db`
- **Config:** JSON file at `%LOCALAPPDATA%/AutoHelper/config.json` (via `ConfigStore`)
- **Scheduler:** APScheduler (GC, contact sync, mail polling)
- **Tray icon:** pystray + Pillow (custom smiley icon rendered in Python)
- **Dialogs:** tkinter (`simpledialog`, `messagebox`) for pairing code entry and feedback
- **Windows service:** pywin32 `win32serviceutil.ServiceFramework` for SCM registration
- **Dashboard:** Vanilla HTML/JS/CSS served by FastAPI at `/dashboard` — settings, pairing, contact sync status

**Entry modes** (from `main.py`):
1. `(no args)` — console mode, runs uvicorn on main thread
2. `--tray` — tray mode: uvicorn on background thread, pystray icon on main thread
3. `--service install|remove|start|stop` — Windows service management via pywin32
4. Frozen exe with no args — attempts SCM dispatcher (PyInstaller `sys.frozen`)

**Packaging pipeline:**
- `scripts/autohelper.spec` — PyInstaller spec producing two executables:
  - `autohelper.exe` (console) — CLI + service entry
  - `autohelper-tray.exe` (windowed) — tray mode (`--tray` option baked in)
- `scripts/build_installer.py` — orchestrates PyInstaller → MSIX layout → MakeAppx → signtool
- `scripts/msix/AppxManifest.xml` — declares two `<Application>` entries, tray auto-starts on login via `desktop:StartupTask`
- `.github/workflows/build-autohelper.yml` — CI on `autohelper-v*` tags, runs on `windows-latest`

**The problem:** PyInstaller dependency tree (fastapi, uvicorn, pydantic, lxml, PIL, httpx, pystray, pywin32, etc.) exceeds CI runner timeouts. The PATH-pruning workaround in CI is fragile. The build takes 15+ minutes and still fails intermittently.

### 1.2 What Gets Replaced

| Component | Current | Replacement |
|-----------|---------|-------------|
| System tray icon | pystray + Pillow (`gui/icon.py`) | Electron `Tray` API |
| Dialogs (pair/unpair) | tkinter (`gui/icon.py`) | Electron `dialog` / in-app UI |
| Window management | None (browser opens) | Electron `BrowserWindow` |
| Desktop packaging | PyInstaller + MakeAppx | electron-builder (NSIS or MSIX) |
| Auto-update | `.appinstaller` XML (MSIX sideload) | electron-updater (GitHub Releases) |
| CI workflow | PyInstaller on windows-latest | electron-builder on windows-latest |
| Startup task | MSIX `desktop:StartupTask` | electron-builder `openAtLogin` |

### 1.3 What Stays Unchanged

| Component | Why |
|-----------|-----|
| FastAPI backend (`app.py`, all modules) | Core business logic — no reason to touch |
| SQLite database + migrations | Electron doesn't affect storage |
| Config store (`config/store.py`, `config.json`) | Python-side persistence stays |
| Settings model (`config/settings.py`) | Env vars + config.json loading stays |
| Platform detection (`shared/platform.py`) | Still needed for Python-side gating |
| Dashboard HTML/JS/CSS (`gui/dashboard/`) | Loaded inside Electron `BrowserWindow` instead of system browser |
| Dashboard router (`gui/dashboard_router.py`) | Still serves the dashboard via FastAPI |
| All Python modules (index, search, mail, contacts, export, etc.) | Unchanged |
| `pyproject.toml` dependencies (minus pystray/Pillow) | Trimmed but structure stays |

---

## 2. Target Architecture

### 2.1 High-Level

```
┌─────────────────────────────────────────────┐
│  Electron Main Process                       │
│  ┌───────────────┐  ┌────────────────────┐  │
│  │ Tray Icon     │  │ BrowserWindow      │  │
│  │ (native)      │  │ loads localhost:8100│  │
│  └───────────────┘  └────────────────────┘  │
│        │                                     │
│  ┌─────┴──────────────────────────────────┐ │
│  │ Python Process Manager                  │ │
│  │ - spawns embedded python               │ │
│  │ - health checks /health endpoint       │ │
│  │ - restart on crash                     │ │
│  │ - graceful shutdown on app quit        │ │
│  └────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
         │ child_process.spawn
         ▼
┌─────────────────────────────────────────────┐
│  Python Backend (unchanged)                  │
│  FastAPI + uvicorn on 127.0.0.1:8100        │
│  SQLite, APScheduler, all modules           │
└─────────────────────────────────────────────┘
```

### 2.2 IPC Strategy: HTTP over localhost

No custom IPC. The Python backend already exposes a full REST API on `127.0.0.1:8100`. Electron's renderer loads `http://127.0.0.1:8100/dashboard` directly. The main process performs health checks via `GET http://127.0.0.1:8100/health`.

**Why HTTP, not stdio/named pipes:**
- The API already exists and works.
- The dashboard already communicates via fetch to the same-origin API.
- No serialization protocol to maintain.
- stdio adds complexity for zero benefit when the server is already HTTP.
- Named pipes would require a custom transport layer in both Python and Node.

### 2.3 Python Backend Lifecycle

Electron main process manages the Python backend as a child process:

1. **Spawn:** `child_process.spawn(pythonPath, ['-m', 'autohelper.main'])` with `cwd` set to the embedded Python directory
2. **Health poll:** After spawn, poll `GET /health` every 500ms until 200 OK (timeout: 15s)
3. **Ready signal:** Once health check passes, show tray icon and allow window opening
4. **Crash restart:** If the child process exits unexpectedly, wait 2s and respawn (max 3 retries, then show error dialog)
5. **Graceful shutdown:** On app quit, send `POST /shutdown` (new endpoint) or `SIGTERM`, wait 5s, then `SIGKILL`

### 2.4 Python Embedding Strategy

**Approach: Embedded Python (python-build-standalone)**

Ship a self-contained Python distribution alongside the Electron app. No system Python dependency, no user-managed venv.

- Use [python-build-standalone](https://github.com/indygreg/python-build-standalone) — prebuilt, portable CPython 3.11 for Windows x64
- Bundle it at `resources/python/` inside the Electron app
- Install AutoHelper's Python package into that distribution at build time via `pip install -e .` (or `pip install .` for production)
- Total size: ~35MB compressed for Python + deps (vs 100MB+ for PyInstaller bundles)

**Why not system Python or user venv:**
- System Python: version mismatch, missing on many machines, PATH issues
- User venv: user has to install Python first, run setup commands, fragile
- Embedded: deterministic, zero user setup, same approach as VS Code Python extension

### 2.5 Monorepo Placement

New workspace package: `apps/autohelper-electron/`

```
apps/autohelper-electron/
├── package.json              # workspace package, electron + electron-builder deps
├── tsconfig.json
├── electron-builder.yml      # electron-builder config
├── src/
│   ├── main.ts               # Electron main process entry
│   ├── preload.ts             # (minimal, if needed for IPC)
│   ├── python-manager.ts     # Spawn/manage Python backend
│   ├── tray.ts                # Tray icon setup + menu
│   └── window.ts              # BrowserWindow management
├── assets/
│   ├── icon.ico               # App icon (Windows)
│   ├── icon.png               # App icon (tray)
│   └── tray-active.png        # Tray icon when job running
├── scripts/
│   └── prepare-python.ts      # Downloads python-build-standalone + installs deps
└── build/                     # electron-builder output (gitignored)
```

The existing `apps/autohelper/` stays as-is — it's the Python package. The Electron app references it.

---

## 3. Migration Phases

### Phase 1: Electron Shell Bootstrap + React Dashboard

**Goal:** Electron app that opens a `BrowserWindow` loading a React dashboard (replacing the vanilla HTML/JS). Python backend started manually by the developer.

**Deliverables:**
- `apps/autohelper-electron/package.json` with electron, electron-builder, typescript, React deps
- `apps/autohelper-electron/src/main.ts` — creates `BrowserWindow`, loads dashboard URL
- `apps/autohelper-electron/src/window.ts` — window factory, show/hide, minimize to tray
- React dashboard app replacing `autohelper/gui/dashboard/` — uses `packages/ui` component library, served by FastAPI or bundled into Electron
- Add to `pnpm-workspace.yaml` (already covered by `apps/*` glob)
- `pnpm dev:electron` script in root `package.json`

**package.json (initial):**
```json
{
  "name": "autohelper-electron",
  "version": "0.1.0",
  "private": true,
  "main": "dist/main.js",
  "scripts": {
    "dev": "tsc && electron dist/main.js",
    "build": "tsc",
    "pack": "electron-builder --dir",
    "dist": "electron-builder"
  },
  "dependencies": {
    "electron-updater": "^6.3.0"
  },
  "devDependencies": {
    "electron": "^33.0.0",
    "electron-builder": "^25.1.0",
    "typescript": "catalog:"
  }
}
```

**Dashboard rebuild approach:**
- React app built with Vite, using `packages/ui` components and `--ws-*` design tokens
- Replaces `autohelper/gui/dashboard/index.html` + `app.js` (vanilla fetch-based UI)
- Two options for serving: (a) FastAPI continues serving static files from a `dist/` output, or (b) Electron loads the React dev server in dev / bundled files in prod
- The existing REST endpoints (`/api/*`, `/health`, `/pair/*`, etc.) remain the data layer

**Verification:** `pnpm --filter autohelper-electron dev` opens a window showing the React dashboard (with Python backend running separately).

---

### Phase 2: Python Backend as Child Process

**Goal:** Electron spawns and manages the Python backend automatically. No manual startup required.

**Deliverables:**
- `apps/autohelper-electron/src/python-manager.ts`:
  - `startPython()` — resolves python path (dev: venv, prod: embedded), spawns child process
  - `waitForReady()` — polls `/health` until 200
  - `stopPython()` — sends shutdown signal, waits, kills
  - `restartPython()` — stop + start with backoff
  - Pipe stdout/stderr to Electron's log file
- New FastAPI endpoint `POST /shutdown` in `apps/autohelper/autohelper/modules/health/router.py` — sets `server.should_exit = True`
- Electron `app.on('before-quit')` calls `stopPython()`

**Python path resolution:**
```typescript
function getPythonPath(): string {
  if (app.isPackaged) {
    // Production: embedded python-build-standalone
    return path.join(process.resourcesPath, 'python', 'python.exe');
  }
  // Development: use autohelper's local venv
  return path.join(__dirname, '..', '..', 'autohelper', '.venv',
    process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python3');
}
```

**Verification:** `pnpm --filter autohelper-electron dev` starts Python automatically, dashboard loads after health check passes, Python stops on quit.

---

### Phase 3: Tray Icon + Window Management

**Goal:** Replace pystray + tkinter with Electron's native `Tray` API. Match existing menu structure.

**Deliverables:**
- `apps/autohelper-electron/src/tray.ts`:
  - Creates `Tray` with icon
  - Context menu: Status (disabled label), Connection status, Pair.../Unpair, Open Settings, separator, Exit
  - Click toggles BrowserWindow visibility
  - Dynamic icon swap (idle vs working) via polling `/runner/status` + `/index/status`
  - Connection state polling via `/health` or new `/pair/status` endpoint
- `apps/autohelper-electron/assets/icon.ico` + `icon.png` + `tray-active.png`
  - Pre-rendered versions of the smiley (with/without cowboy hat)
  - No more runtime Pillow rendering
- Pairing flow:
  - "Pair..." menu item opens BrowserWindow to dashboard pairing section (or `dialog.showInputBox` if we want to keep it modal)
  - "Unpair" calls `DELETE /api/autohelper/unpair` via the Python backend, no tkinter needed
- Window management:
  - Show/hide on tray click
  - Close button hides to tray (not quit)
  - "Exit" from tray menu does actual quit

**Menu structure mapping:**

| Current (pystray) | Electron Tray |
|---|---|
| "AutoHelper Service" (disabled) | Label item (disabled) |
| "Status: Idle/Working..." (disabled) | Dynamic label, polled |
| "Paired (Connected)" etc. (disabled) | Dynamic label, polled |
| "Pair..." (conditional) | Menu item, opens dashboard or input dialog |
| "Unpair" (conditional) | Menu item, calls API |
| separator | separator |
| "Open Settings" | Opens BrowserWindow to dashboard |
| separator | separator |
| "Exit" | `app.quit()` |

**Verification:** Tray icon appears, menu works, pairing via dashboard works, window shows/hides correctly.

---

### Phase 4: electron-builder Packaging

**Goal:** Produce a distributable Windows installer (NSIS or MSIX) via electron-builder. Include embedded Python.

**Deliverables:**
- `apps/autohelper-electron/scripts/prepare-python.ts`:
  - Downloads python-build-standalone for target platform
  - Extracts to `apps/autohelper-electron/python-embed/`
  - Runs `python-embed/python.exe -m pip install ../../autohelper[all]` to install AutoHelper + deps
  - This runs as a build step, not at runtime
- `apps/autohelper-electron/electron-builder.yml`:

```yaml
appId: com.okvery.autohelper
productName: AutoHelper
directories:
  output: build
  buildResources: assets

files:
  - dist/**/*
  - assets/**/*
  - "!**/*.ts"

extraResources:
  # Bundle the embedded Python + installed AutoHelper package
  - from: python-embed
    to: python
    filter:
      - "**/*"
  # Bundle AutoHelper Python source (for dev reference / migrations)
  - from: ../autohelper/autohelper
    to: autohelper-src
    filter:
      - "db/migrations/**/*"

win:
  target:
    - target: nsis
      arch: [x64]
  icon: assets/icon.ico
  signDLLs: false

nsis:
  oneClick: false
  allowToChangeInstallationDirectory: false
  perMachine: false
  createDesktopShortcut: false
  createStartMenuShortcut: true
  shortcutName: AutoHelper
  runAfterFinish: true

publish:
  provider: github
  owner: ok-very
  repo: autoart
```

**Why NSIS over MSIX:**
- electron-builder has first-class NSIS support, mature and well-tested
- MSIX via electron-builder requires additional Windows SDK tools and is less commonly used
- NSIS handles auto-start via registry (simpler than MSIX startup tasks)
- If MSIX is preferred (for Microsoft Store distribution), electron-builder supports it but requires more config

**Auto-update:**
- `electron-updater` checks GitHub Releases for new versions
- Configured in `main.ts` with `autoUpdater.checkForUpdatesAndNotify()`
- Replaces the `.appinstaller` approach entirely

**Auto-start on login:**
- `app.setLoginItemSettings({ openAtLogin: true })` in main process
- Configurable via settings (exposed in dashboard)

**Verification:** `pnpm --filter autohelper-electron dist` produces `build/AutoHelper Setup.exe`, installs and runs correctly on Windows.

---

### Phase 5: CI Workflow Replacement

**Goal:** Replace `.github/workflows/build-autohelper.yml` with a new workflow that uses electron-builder.

**New workflow: `.github/workflows/build-autohelper-electron.yml`**

```yaml
name: Build AutoHelper

on:
  push:
    tags:
      - "autohelper-v*"

permissions:
  contents: write

jobs:
  build:
    runs-on: windows-latest
    defaults:
      run:
        working-directory: apps/autohelper-electron

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Setup pnpm
        uses: pnpm/action-setup@v4

      - name: Install Node dependencies
        run: pnpm install --frozen-lockfile
        working-directory: .

      - name: Setup Python 3.11
        uses: actions/setup-python@v5
        with:
          python-version: "3.11"

      - name: Prepare embedded Python
        run: pnpm run prepare-python

      - name: Extract version from tag
        id: version
        shell: bash
        run: echo "version=${GITHUB_REF_NAME#autohelper-v}" >> "$GITHUB_OUTPUT"

      - name: Build Electron app
        run: pnpm dist
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Upload artifacts
        uses: actions/upload-artifact@v4
        with:
          name: autohelper-installer
          path: |
            apps/autohelper-electron/build/AutoHelper*.exe
            apps/autohelper-electron/build/latest.yml

      - name: Create GitHub Release
        uses: softprops/action-gh-release@v2
        with:
          name: AutoHelper ${{ steps.version.outputs.version }}
          files: |
            apps/autohelper-electron/build/AutoHelper*.exe
            apps/autohelper-electron/build/latest.yml
          draft: false
          prerelease: false
```

**Key differences from current workflow:**
- No PyInstaller step (saves 15+ minutes)
- No MakeAppx/signtool (electron-builder handles signing)
- Python setup is only for `prepare-python.ts` (embedding), not for running tests
- Tests run in a separate workflow (not gated on build)
- Total build time estimate: 3-5 minutes (vs 15-25 minutes current)

**Code signing:**
- electron-builder supports Windows code signing via `CSC_LINK` (base64 PFX) and `CSC_KEY_PASSWORD` environment variables
- Add to workflow: `env: CSC_LINK: ${{ secrets.AUTOHELPER_SIGN_PFX }}` and `CSC_KEY_PASSWORD: ${{ secrets.AUTOHELPER_SIGN_PFX_PASSWORD }}`

**Verification:** Push a `autohelper-v*` tag, CI produces signed installer, GitHub Release is created, auto-update works from previous version.

---

### Phase 6: Cleanup

**Goal:** Remove all PyInstaller/pystray/tkinter infrastructure.

**Files to delete:**
- `apps/autohelper/scripts/autohelper.spec`
- `apps/autohelper/scripts/build_installer.py`
- `apps/autohelper/scripts/msix/` (entire directory)
- `apps/autohelper/autohelper/gui/icon.py` (pystray tray icon)
- `apps/autohelper/autohelper/gui/popup.py` (browser-open shim)
- `.github/workflows/build-autohelper.yml` (old CI)

**Files to modify:**
- `apps/autohelper/pyproject.toml` — remove `pystray`, `Pillow` from default deps. Move `pywin32` to `[service]` optional extra.
  - (tkinter is stdlib, no dep to remove, but imports are gone)
- `apps/autohelper/autohelper/main.py` — remove:
  - `--tray` mode (`_run_with_tray` function)
  - pystray import path
  - The `app = build_app()` module-level call can stay (used by uvicorn factory)
  - Keep `--service` handling (pywin32 available via `[service]` extra)
- `apps/autohelper/autohelper/gui/__init__.py` — remove or simplify
- `apps/autohelper/autohelper/winservice.py` — **Stays** (optional `[service]` path)

**Verification:** `pip install -e .` succeeds without pystray/Pillow. Python backend starts in console mode. Electron app works end-to-end.

---

## 4. Key Decisions

### 4.1 Windows Service: Keep or Remove?

**Current state:** `winservice.py` registers AutoHelper as a Windows service via pywin32, allowing it to run in the background without a logged-in user.

**Options:**

| Option | Pros | Cons |
|--------|------|------|
| **A: Remove** | Simpler. Electron handles lifecycle. One fewer pywin32 dep surface. | Can't run without a user logged in. |
| **B: Keep** | Background operation without login. IT admin deployment. | pywin32 dep stays. Two runtime modes to maintain. |
| **C: Defer** | Ship Electron first, decide later based on user need. | Leaves dead code temporarily. |

**Decision: Option B — Keep as optional.** Move pywin32 to `[service]` extra in `pyproject.toml`. The `--service` CLI path stays functional. Electron doesn't invoke it. `winservice.py` stays in the codebase.

### 4.2 Where in Monorepo?

**Decision: `apps/autohelper-electron/`** (new package alongside `apps/autohelper/`)

**Why not restructure `apps/autohelper/`:**
- The Python package has its own `pyproject.toml`, venv, tests — it's a self-contained Python project
- Mixing Electron (Node) and Python packaging in one directory creates tooling conflicts
- Clean separation: `apps/autohelper/` = Python backend, `apps/autohelper-electron/` = desktop shell
- The workspace `apps/*` glob in `pnpm-workspace.yaml` already picks it up

### 4.3 Embedded Python Distribution

**Decision: python-build-standalone**

| Option | Size | Complexity | Reliability |
|--------|------|------------|-------------|
| python-build-standalone | ~35MB | Medium (download + pip install at build) | High (maintained by Astral/uv team) |
| System Python | 0 | Low | Low (version mismatch, missing) |
| PyOxidizer | ~25MB | High (Rust toolchain, custom config) | Medium |
| cx_Freeze | ~30MB | Medium | Medium (same dep issues as PyInstaller) |

python-build-standalone is the same distribution used by `uv` and `rye`. It's well-tested, actively maintained, and provides standalone CPython builds for Windows/macOS/Linux.

**Build-time preparation:**
1. Download `cpython-3.11.*-x86_64-pc-windows-msvc-install_only.tar.gz`
2. Extract to `apps/autohelper-electron/python-embed/`
3. Run `python-embed/python.exe -m pip install ../../autohelper` to install AutoHelper and all its dependencies
4. electron-builder bundles `python-embed/` as `extraResources`

### 4.4 Tray Icon Assets

**Decision: Pre-rendered PNG/ICO files** instead of runtime Pillow rendering.

Current approach renders the smiley + cowboy hat programmatically in `icon.py` via Pillow. This was necessary because pystray requires `PIL.Image` objects. Electron's `Tray` accepts file paths to `.png` or `.ico` files.

**Action:** Export the current icon designs as static files:
- `icon.png` (64x64, idle smiley — blue background, yellow face)
- `icon-active.png` (64x64, smiley with cowboy hat + glow)
- `icon.ico` (multi-size ICO for Windows: 16x16, 32x32, 48x48, 256x256)

Can be generated once from the existing Pillow code, then committed as static assets.

### 4.5 Dashboard: Electron BrowserWindow vs. System Browser

**Decision: BrowserWindow** (load `http://127.0.0.1:8100/dashboard` inside Electron)

**Why:**
- Consistent UX — the settings window looks like part of the app, not a random browser tab
- Window lifecycle control (show/hide on tray click, close-to-tray)
- Can add Electron-specific features later (native menus, IPC for OS-level actions)
- The dashboard is already vanilla HTML/JS — works in any rendering context

**Fallback:** "Open in Browser" menu item still available for users who prefer it.

---

## 5. Risks & Mitigations

### 5.1 Python Process Crashes

**Risk:** The Python backend crashes and the user sees a blank window.

**Mitigation:**
- `python-manager.ts` monitors the child process exit event
- Auto-restart with exponential backoff (1s, 2s, 4s, max 3 retries)
- After max retries, show native dialog: "AutoHelper backend failed to start. Check logs at [path]."
- Pipe Python stdout/stderr to log file at `%LOCALAPPDATA%/AutoHelper/electron.log`

### 5.2 Port Conflict

**Risk:** Port 8100 already in use when Electron starts.

**Mitigation:**
- `_check_port_conflict()` already exists in `main.py` — it prints an error and exits
- `python-manager.ts` detects non-zero exit code, shows dialog with the error
- Future: dynamically assign port and pass to BrowserWindow URL (would require config changes)

### 5.3 Installer Size

**Risk:** Electron (~80MB) + Python (~35MB) + deps = ~150MB installer.

**Mitigation:**
- This is typical for desktop apps (VS Code is ~100MB, Slack is ~200MB)
- Use electron-builder's `asar` to compress the Electron app
- Strip Python test files, `__pycache__`, `.pyc` during `prepare-python.ts`
- Consider `7z` ultra compression in NSIS config

### 5.4 Auto-Update Transition

**Risk:** Existing MSIX users won't auto-update to the Electron version.

**Mitigation:**
- The `.appinstaller` auto-update only works within the MSIX ecosystem
- Users must manually install the new Electron version once
- Communicate via release notes / in-app notification on the old version (if still running)
- New Electron version can auto-update via electron-updater going forward

### 5.5 Signing Certificate

**Risk:** Current MSIX signing uses a self-signed certificate. electron-builder signing is different.

**Mitigation:**
- electron-builder uses the same PFX certificate format
- CI already has `AUTOHELPER_SIGN_PFX` and `AUTOHELPER_SIGN_PFX_PASSWORD` secrets
- electron-builder reads them from `CSC_LINK` and `CSC_KEY_PASSWORD` env vars
- For production distribution, may want a proper code signing certificate (e.g., from SSL.com)

### 5.6 Windows Defender SmartScreen

**Risk:** Unsigned or newly-signed NSIS installers trigger SmartScreen warnings.

**Mitigation:**
- Sign with a valid EV code signing certificate for immediate SmartScreen trust
- Or: accept SmartScreen warning for self-signed dev builds, EV cert for production

---

## 6. File Inventory

### 6.1 Files to Create

| File | Purpose |
|------|---------|
| `apps/autohelper-electron/package.json` | Workspace package with electron deps |
| `apps/autohelper-electron/tsconfig.json` | TypeScript config |
| `apps/autohelper-electron/electron-builder.yml` | electron-builder packaging config |
| `apps/autohelper-electron/src/main.ts` | Electron main process entry |
| `apps/autohelper-electron/src/preload.ts` | Preload script (minimal) |
| `apps/autohelper-electron/src/python-manager.ts` | Python child process lifecycle |
| `apps/autohelper-electron/src/tray.ts` | System tray icon + menu |
| `apps/autohelper-electron/src/window.ts` | BrowserWindow management |
| `apps/autohelper-electron/scripts/prepare-python.ts` | Build-time: download + install embedded Python |
| `apps/autohelper-electron/assets/icon.ico` | Windows app icon |
| `apps/autohelper-electron/assets/icon.png` | Tray icon (idle) |
| `apps/autohelper-electron/assets/tray-active.png` | Tray icon (job running) |
| `.github/workflows/build-autohelper-electron.yml` | New CI workflow |

### 6.2 Files to Modify

| File | Change |
|------|--------|
| `apps/autohelper/pyproject.toml` | Move `pystray`, `Pillow` to optional `[tray]` extra, add `[service]` extra for `pywin32` |
| `apps/autohelper/autohelper/main.py` | Keep console mode + `--service` mode. Remove `--tray` import of `gui.icon`. Add `/shutdown` endpoint plumbing. |
| `apps/autohelper/autohelper/modules/health/router.py` | Add `POST /shutdown` endpoint |
| `apps/autohelper/package.json` | Optional: add `dev:electron` script that starts both Python + Electron |
| `package.json` (root) | Add `dev:electron` convenience script |

### 6.3 Files to Delete (Phase 6)

| File | Reason |
|------|--------|
| `apps/autohelper/scripts/autohelper.spec` | PyInstaller no longer used |
| `apps/autohelper/scripts/build_installer.py` | MSIX build no longer used |
| `apps/autohelper/scripts/msix/AppxManifest.xml` | Replaced by electron-builder |
| `apps/autohelper/scripts/msix/create_cert.ps1` | Replaced by electron-builder signing |
| `apps/autohelper/scripts/msix/generate_assets.py` | Static assets replace runtime generation |
| `apps/autohelper/autohelper/gui/icon.py` | Replaced by Electron Tray |
| `apps/autohelper/autohelper/gui/popup.py` | Replaced by Electron BrowserWindow |
| `.github/workflows/build-autohelper.yml` | Replaced by new workflow |

---

## 7. Development Workflow

### Local Development (after Phase 2)

```bash
# Terminal 1: Start Python backend directly (for hot reload)
cd apps/autohelper
AUTOHELPER_DATA_DIR=./data .venv/bin/python3 -m autohelper.main

# Terminal 2: Start Electron shell (connects to running backend)
pnpm --filter autohelper-electron dev
```

Or with the combined script (after adding to package.json):
```bash
pnpm dev:electron
```

### Building for Distribution

```bash
# 1. Prepare embedded Python (downloads python-build-standalone, installs deps)
pnpm --filter autohelper-electron run prepare-python

# 2. Build Electron app + installer
pnpm --filter autohelper-electron dist
# Output: apps/autohelper-electron/build/AutoHelper Setup X.Y.Z.exe
```

---

## 8. Implementation Order & Dependencies

```
Phase 1 (Electron shell)
   │
   ▼
Phase 2 (Python as child process)  ──── can demo at this point
   │
   ▼
Phase 3 (Tray + window management) ──── feature parity with current app
   │
   ▼
Phase 4 (electron-builder packaging) ── can ship installer
   │
   ▼
Phase 5 (CI workflow) ─────────────── automated releases
   │
   ▼
Phase 6 (Cleanup) ─────────────────── remove legacy code
```

Each phase is independently shippable (dev can use Phases 1-3 locally while packaging/CI are WIP). Phase 3 is the first point of full feature parity. Phase 4 is the first point where a user-installable artifact exists.

---

## 9. Resolved Decisions

| # | Question | Decision |
|---|----------|----------|
| 1 | NSIS vs MSIX? | **NSIS.** Simpler, mature electron-builder support. MSIX later if Store distribution needed. |
| 2 | Windows service mode? | **Keep as optional.** pywin32 moves to `[service]` extra. `--service` CLI stays. |
| 3 | Port assignment? | **Static 8100.** Conflict detection already in `main.py`. Dynamic port is future enhancement. |
| 4 | Dashboard modernization? | **React rebuild in Phase 1.** Replace vanilla HTML/JS with React app using `packages/ui`. |

## 10. Open Questions

1. **macOS/Linux support?** Current code has cross-platform detection (`platform.py`). Electron is inherently cross-platform. The embedded Python approach works on all three. But this migration is Windows-first — cross-platform can be a follow-up.
