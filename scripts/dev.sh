#!/usr/bin/env bash
# ===========================================
# AutoArt Development Server Startup (Linux)
# ===========================================
# Usage: ./scripts/dev.sh
#        pnpm dev
#
# Services started:
#   - Backend API (port 3001)
#   - Frontend (port 5173)
#   - AutoHelper Python service (port 8100)
#   - Forms app (port 5174) - optional

set -euo pipefail

source "$(dirname "$0")/config.sh"
cd "$PROJECT_DIR"

echo ""
echo "======================================"
echo "  AutoArt Development Environment"
echo "======================================"
echo ""

# Check pnpm
if ! command -v pnpm &>/dev/null; then
    echo "[!] pnpm not found. Installing via corepack..."
    corepack enable
    corepack prepare pnpm@latest --activate
    echo "[OK] pnpm installed"
fi

# Check .env
if [[ ! -f .env ]]; then
    echo "[!] No .env file found. Copying from .env.example..."
    cp .env.example .env
    echo "[i] Created .env with default settings"
    echo ""
fi

import_env

# Build shared if needed
if [[ ! -d shared/dist ]]; then
    echo "[*] Building shared package..."
    (cd shared && pnpm build) >/dev/null 2>&1
    echo "[OK] Shared package built"
fi

# Track child PIDs for cleanup
PIDS=()

cleanup() {
    echo ""
    echo "[*] Stopping services..."
    for pid in "${PIDS[@]}"; do
        kill "$pid" 2>/dev/null || true
        wait "$pid" 2>/dev/null || true
    done
    # Kill anything still on dev ports
    stop_on_port "$BACKEND_PORT"
    stop_on_port "$FRONTEND_PORT"
    stop_on_port "$AUTOHELPER_PORT"
    stop_on_port 5174
    echo "[OK] All services stopped."
    exit 0
}
trap cleanup SIGINT SIGTERM EXIT

# Start backend
echo "[*] Starting backend server..."
(cd backend && pnpm dev) 2>&1 | sed 's/^/[API] /' &
PIDS+=($!)
sleep 2

# Start frontend
echo "[*] Starting frontend server..."
(cd frontend && pnpm dev) 2>&1 | sed 's/^/[WEB] /' &
PIDS+=($!)
sleep 2

# Start AutoHelper if present
if [[ -f apps/autohelper/package.json ]]; then
    echo "[*] Starting AutoHelper service..."
    (cd apps/autohelper && pnpm dev) 2>&1 | sed 's/^/[HELPER] /' &
    PIDS+=($!)
    sleep 2
fi

# Start Forms if present
if [[ -f apps/forms/package.json ]]; then
    echo "[*] Starting Forms app..."
    (cd apps/forms && pnpm dev) 2>&1 | sed 's/^/[FORMS] /' &
    PIDS+=($!)
    sleep 2
fi

echo ""
echo "======================================"
echo "  AutoArt is running!"
echo "======================================"
echo ""
echo "  Frontend:   http://localhost:$FRONTEND_PORT"
echo "  Backend:    http://localhost:$BACKEND_PORT"
[[ -f apps/autohelper/package.json ]] && echo "  AutoHelper: http://localhost:$AUTOHELPER_PORT"
[[ -f apps/forms/package.json ]] && echo "  Forms:      http://localhost:5174"
echo ""
echo "Press Ctrl+C to stop all services"
echo ""

# Wait for all children
wait
