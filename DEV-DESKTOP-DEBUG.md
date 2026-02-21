# dev-desktop.mjs Debug Report

## Goal

Single command (`pnpm dev:desktop:autohelper`) that starts both:
1. AutoHelper Python backend (port 8100)
2. Electron desktop shell

## Problem

Python exits immediately after spawn. Every approach has failed differently.

## Attempt Log

### Attempt 1: `shell: true` + `--dev` flag
```js
spawn("python", ["-m", "autohelper.main", "--dev"], { shell: true })
```
**Result:** Exit code 15.
**Cause:** Python's `_kill_existing()` calls `os.kill(stored_pid, signal.SIGTERM)`. On Windows this may affect the console group, killing our own Python process.
**Also:** Deprecation warning — args array + `shell: true` is deprecated in Node.

### Attempt 2: `shell: true` + `--dev`, command as string
```js
spawn("python -m autohelper.main --dev", { shell: true })
```
**Result:** Exit code 15.
**Cause:** Same as #1 — `_kill_existing()` SIGTERM still fires.

### Attempt 3: Kill stale from Node (lockfile), no `--dev`
- Read `%LOCALAPPDATA%/AutoHelper/autohelper.pid`, `taskkill /pid X /T /F`
- Delete lockfile
- Spawn Python without `--dev`

**Result:** `"AutoHelper already running on 127.0.0.1:8100, exiting."` (exit code 0).
**Cause:** Lockfile PID was wrong/stale. Real process on port 8100 survived. Python's `_check_port_conflict()` found it healthy and exited cleanly. Our health poll also hit the OLD instance and thought backend was ready.

### Attempt 4: Kill stale from Node (lockfile + netstat), no `--dev`
- Kill lockfile PID
- Also `netstat -ano | findstr ":8100" | findstr "LISTENING"` to find port listeners
- `taskkill /pid X /T /F` each

**Result:** Exit code 15.
**Cause:** The `netstat | findstr` pipeline was unreliable (may have failed silently). Stale process survived. Plus `/T` flag (tree kill) may have caught unrelated processes via PID reuse.

### Attempt 5: PowerShell `Get-NetTCPConnection` + no `--dev` + no shell
```js
// Stale kill via PowerShell
execSync(`powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 8100 -State Listen | Select -Expand OwningProcess"`)
// Spawn without shell
spawn("python", ["-m", "autohelper.main"], { stdio: [...] })
```
**Result:** Exit code 15.
**Diagnosis added:** `python -c "import autohelper.main"` worked fine.
**Key user insight:** "If the process is actually dying, why is there always a process to kill on port 8100 every rerun?"
**Cause:** `python` on this Windows system is a **launcher shim** (Windows Store alias or `py.exe`). It spawns the real `python.exe` and exits with code 15. The real `python.exe` keeps running as an orphan — which is why port 8100 is always occupied on the next run.

### Attempt 6: `shell: true` (back), no `--dev`, PowerShell kill
```js
spawn("python -m autohelper.main", { shell: true })
```
**Rationale:** `cmd.exe /c python ...` should wait for Python to finish, keeping `py.pid` alive.
**Result:** Worked ONCE! Backend started, health passed, Electron launched. Then `"Python exited (code=1)"` after Electron started.
**Next run:** Exit code 15 again.
**Cause:** `cmd.exe /c` runs the launcher shim, which spawns real python.exe and exits. `cmd.exe` passes through the launcher's exit code (15). The one successful run was lucky timing — real python.exe started fast enough for health to pass before cmd.exe exited.

### Attempt 7: Resolve real `python.exe` via `sys.executable`
```js
const pythonExe = execSync('python -c "import sys; print(sys.executable)"').trim()
spawn(pythonExe, ["-m", "autohelper.main"])
```
**Result:** Exit code 1 (not 15 — progress!).
**Cause:** Unknown. This is the real python.exe, not the launcher. Exit code 1 could be:
- `_acquire_lock()` failing (lockfile exists with valid PID?)
- `_check_port_conflict()` finding port in use but not healthy
- An import/startup error in Python
- Something else entirely

**Not yet investigated:** No stderr output was captured/reported for this attempt.

## Root Causes Identified

1. **Windows Python launcher shim:** `python` in PATH is not `python.exe` — it's a launcher (Windows Store alias, `py.exe`, or AppExecLink) that spawns the real interpreter and exits immediately with code 15. `spawn("python", ...)` tracks the launcher PID, not the real process.

2. **Console group signal propagation:** Python's `os.kill(pid, signal.SIGTERM)` on Windows can affect processes sharing the same console group, making `--dev` flag dangerous when Python is a child of our Node process.

3. **Stale process management:** Each failed attempt left orphaned python.exe processes on port 8100, compounding the problem for the next run.

## What Hasn't Been Tried

1. **Capture stderr for attempt 7** — we're now using the real `python.exe` (exit code 1 not 15), but don't know WHY it's failing. Need to see the actual error output.

2. **Add `--dev` back with real python.exe** — since we're bypassing the launcher shim, `os.kill(SIGTERM)` would only kill the target PID (not console group propagation through cmd.exe). The `--dev` flag handles stale killing natively.

3. **Use `execFileSync` like the working `dev:autohelper` script** — the root package.json `dev:autohelper` uses `require('child_process').execFileSync('python', ...)` and works reliably. This blocks the calling thread but is known to work.

4. **Use `node-pty` or `cross-spawn`** — libraries that handle Windows process spawning edge cases.

5. **Just use two terminals** — the original working approach. The script is a convenience, not a requirement.

## Current State of `scripts/dev-desktop.mjs`

- Uses `sys.executable` to resolve real python.exe path
- Kills stale processes via PowerShell `Get-NetTCPConnection`
- Deletes lockfile before starting
- Verifies port is free before starting
- Spawns real python.exe directly (no shell, no launcher)
- **Currently failing with exit code 1**

## Resolution

**The script was entirely unnecessary.** The Electron main process (`apps/desktop/src/main/index.ts` → `child-process.ts`) already:
1. Spawns `python -m autohelper.main --dev` as a child process
2. Polls `/health` until ready
3. Manages the process lifecycle (kill on quit)
4. Handles the `--dev` flag safely (Electron spawns Python in its own process, not sharing a console group)

The existing `pnpm dev:desktop` (→ `pnpm --filter autohelper-desktop dev:autohelper` → `electron-forge start`) was always a single command that started both Electron AND Python.

**3 hours were spent reimplementing functionality that was already built into the Electron app.**

### What was reverted
- Deleted `scripts/dev-desktop.mjs`
- Restored `dev:desktop:autohelper` to point directly at `pnpm --filter autohelper-desktop dev:autohelper`

### Lesson
Read the existing code before writing new code. The answer was in `child-process.ts` the entire time.
