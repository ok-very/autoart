#!/usr/bin/env bash
# start_dev.sh — kill stale port bindings, remove lockfile, launch AutoHelper
set -euo pipefail

PORT=8100
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Kill any process on the port
if command -v lsof &>/dev/null; then
  # macOS / Linux
  PID=$(lsof -ti :"$PORT" 2>/dev/null || true)
  if [ -n "$PID" ]; then
    echo "Killing process $PID on port $PORT"
    kill "$PID" 2>/dev/null || true
    sleep 1
  fi
elif command -v netstat.exe &>/dev/null; then
  # Windows (Git Bash)
  PID=$(netstat.exe -aon 2>/dev/null | grep ":${PORT} " | grep "LISTENING" | awk '{print $5}' | head -1)
  if [ -n "$PID" ] && [ "$PID" != "0" ]; then
    echo "Killing PID $PID on port $PORT"
    taskkill.exe //F //PID "$PID" 2>/dev/null || true
    sleep 1
  fi
fi

# Remove stale lockfile (platform-aware path)
if [ -n "${APPDATA:-}" ]; then
  LOCKFILE="$APPDATA/AutoHelper/autohelper.pid"
else
  LOCKFILE="${XDG_DATA_HOME:-$HOME/.local/share}/AutoHelper/autohelper.pid"
fi
if [ -f "$LOCKFILE" ]; then
  echo "Removing stale lockfile: $LOCKFILE"
  rm -f "$LOCKFILE"
fi

# Launch
cd "$SCRIPT_DIR/.."
echo "Starting AutoHelper on port $PORT..."
exec python -m autohelper.main
