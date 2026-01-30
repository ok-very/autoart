#!/usr/bin/env bash
# ===========================================
# AutoArt Script Config (Linux / Bash)
# ===========================================
# Source this file from other scripts:
#   source "$(dirname "$0")/config.sh"

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"
ENV_FILE="$PROJECT_DIR/.env"

# Default dev ports (override via env vars)
BACKEND_PORT="${AUTOART_BACKEND_PORT:-3001}"
FRONTEND_PORT="${AUTOART_FRONTEND_PORT:-5173}"
AUTOHELPER_PORT="${AUTOART_AUTOHELPER_PORT:-8000}"

import_env() {
    local env_path="${1:-$ENV_FILE}"
    [[ -f "$env_path" ]] || return 0

    while IFS= read -r line || [[ -n "$line" ]]; do
        # Skip empty lines and comments
        [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
        # Match KEY=VALUE
        if [[ "$line" =~ ^[[:space:]]*([^#=[:space:]]+)=(.*) ]]; then
            local key="${BASH_REMATCH[1]}"
            local value="${BASH_REMATCH[2]}"
            # Trim surrounding quotes
            value="${value#\"}" ; value="${value%\"}"
            value="${value#\'}" ; value="${value%\'}"
            export "$key=$value"
        fi
    done < "$env_path"
}

stop_on_port() {
    local port="$1"
    local pids
    pids=$(lsof -ti :"$port" 2>/dev/null || true)
    if [[ -z "$pids" ]]; then
        echo "  [i] No listener on port $port"
        return
    fi
    for pid in $pids; do
        kill -9 "$pid" 2>/dev/null && \
            echo "  [OK] Stopped PID $pid on port $port" || \
            echo "  [!] Could not stop PID $pid on port $port"
    done
}
