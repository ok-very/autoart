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
#   - Intake preview (port 5174)
#   - Poll preview (port 5175)
#   - AutoHelper Python service (port 8100) - if present

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

# Start Intake preview (port 5174)
echo "[*] Starting Intake preview server..."
(cd frontend && pnpm dev:intake) 2>&1 | sed 's/^/[INTAKE] /' &
PIDS+=($!)
sleep 1

# Start Poll preview (port 5175)
echo "[*] Starting Poll preview server..."
(cd frontend && pnpm dev:poll) 2>&1 | sed 's/^/[POLL] /' &
PIDS+=($!)
sleep 1

echo ""
echo "======================================"
echo "  AutoArt is running!"
echo "======================================"
echo ""
echo "  Frontend:   http://localhost:$FRONTEND_PORT"
echo "  Backend:    http://localhost:$BACKEND_PORT"
echo "  Intake:     http://localhost:5174"
echo "  Poll:       http://localhost:5175"
[[ -f apps/autohelper/package.json ]] && echo "  AutoHelper: http://localhost:$AUTOHELPER_PORT"
echo ""
echo "Press Ctrl+C to stop all services"
echo ""

# Auto-pair AutoHelper with backend (background, non-blocking)
if [[ -f apps/autohelper/package.json ]]; then
    (
        auto_pair() {
            local max_wait=30
            local elapsed=0

            # 1. Wait for backend to be ready
            echo "[PAIR] Waiting for backend..."
            while ! curl -sf "http://localhost:$BACKEND_PORT/api/auth/me" >/dev/null 2>&1; do
                sleep 1
                elapsed=$((elapsed + 1))
                if [[ $elapsed -ge $max_wait ]]; then
                    echo "[PAIR] Backend not ready after ${max_wait}s, skipping auto-pair"
                    return 0
                fi
            done

            # 2. Wait for AutoHelper to be ready
            echo "[PAIR] Waiting for AutoHelper..."
            elapsed=0
            while ! curl -sf "http://localhost:$AUTOHELPER_PORT/health" >/dev/null 2>&1; do
                sleep 1
                elapsed=$((elapsed + 1))
                if [[ $elapsed -ge 15 ]]; then
                    echo "[PAIR] AutoHelper not ready after 15s, skipping auto-pair"
                    return 0
                fi
            done

            # 3. Check if already paired
            local status
            status=$(curl -sf "http://localhost:$AUTOHELPER_PORT/pair/status" 2>/dev/null || echo '{}')
            if echo "$status" | grep -q '"paired": *true'; then
                echo "[PAIR] Already paired"
                return 0
            fi

            # 4. Login with demo credentials
            local login_resp
            login_resp=$(curl -sf -X POST "http://localhost:$BACKEND_PORT/api/auth/login" \
                -H "Content-Type: application/json" \
                -d '{"email":"demo@autoart.local","password":"demo123"}' 2>/dev/null)
            if [[ -z "$login_resp" ]]; then
                echo "[PAIR] Login failed, skipping auto-pair"
                return 0
            fi

            local token
            token=$(echo "$login_resp" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)
            if [[ -z "$token" ]]; then
                echo "[PAIR] Could not extract access token, skipping auto-pair"
                return 0
            fi

            # 5. Generate claim code
            local claim_resp
            claim_resp=$(curl -sf -X POST "http://localhost:$BACKEND_PORT/api/pair/claim" \
                -H "Content-Type: application/json" \
                -H "Authorization: Bearer $token" 2>/dev/null)
            if [[ -z "$claim_resp" ]]; then
                echo "[PAIR] Claim token generation failed, skipping auto-pair"
                return 0
            fi

            local code
            code=$(echo "$claim_resp" | grep -o '"code":"[^"]*"' | cut -d'"' -f4)
            if [[ -z "$code" ]]; then
                echo "[PAIR] Could not extract claim code, skipping auto-pair"
                return 0
            fi

            # 6. Send claim code to AutoHelper
            local pair_resp
            pair_resp=$(curl -sf -X POST "http://localhost:$AUTOHELPER_PORT/pair/claim" \
                -H "Content-Type: application/json" \
                -d "{\"code\":\"$code\",\"backend_url\":\"http://localhost:$BACKEND_PORT\"}" 2>/dev/null)
            if echo "$pair_resp" | grep -q '"paired": *true'; then
                echo "[PAIR] AutoHelper paired successfully"
            else
                echo "[PAIR] Pairing failed: $pair_resp"
            fi
        }
        auto_pair
    ) &
fi

# Wait for all children
wait
