#!/usr/bin/env bash
# ===========================================
# AutoArt Kill Dev Processes (Linux)
# ===========================================
# Usage: ./scripts/kill-dev.sh
#        pnpm dev:kill

set -euo pipefail

source "$(dirname "$0")/config.sh"

echo ""
echo "======================================"
echo "  AutoArt Kill Dev Processes"
echo "======================================"
echo ""

echo "[*] Stopping listeners on dev ports..."
stop_on_port "$BACKEND_PORT"
stop_on_port "$FRONTEND_PORT"
stop_on_port "$AUTOHELPER_PORT"
stop_on_port 5174

# Vite fallback ports
for port in 5175 5176 5177 5178; do
    stop_on_port "$port"
done

echo ""
echo "[*] Checking for orphaned node processes..."
KILLED=0
for pid in $(pgrep -f "$PROJECT_DIR" 2>/dev/null || true); do
    cmdline=$(tr '\0' ' ' < "/proc/$pid/cmdline" 2>/dev/null || true)
    if [[ "$cmdline" == *"$PROJECT_DIR"* ]] || [[ "$cmdline" == *tsx*backend* ]] || [[ "$cmdline" == *vite* ]]; then
        echo "  PID $pid: ${cmdline:0:80}"
        kill -9 "$pid" 2>/dev/null && echo "  [OK] Stopped" || echo "  [!] Could not stop"
        ((KILLED++)) || true
    fi
done
[[ $KILLED -eq 0 ]] && echo "  [i] No orphaned node processes found"

echo ""
echo "[*] Checking for orphaned Python processes..."
KILLED=0
for pid in $(pgrep -f "autohelper" 2>/dev/null || true); do
    echo "  PID $pid"
    kill -9 "$pid" 2>/dev/null && echo "  [OK] Stopped" || echo "  [!] Could not stop"
    ((KILLED++)) || true
done
[[ $KILLED -eq 0 ]] && echo "  [i] No orphaned Python processes found"

echo ""
echo "======================================"
echo "  All AutoArt processes stopped"
echo "======================================"
echo ""
