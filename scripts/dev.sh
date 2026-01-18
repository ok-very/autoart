#!/bin/bash

# ==============================================================================
# AutoArt Development Startup Script
# Usage: ./scripts/dev.sh
# ==============================================================================

# Ensure we are in the project root
cd "$(dirname "$0")/.."

echo "🚀 Starting AutoArt Development Environment..."

# Check for .env
if [ ! -f .env ]; then
    echo "⚠️  No .env file found. Copying from .env.example..."
    cp .env.example .env
fi

# Function to kill all child processes on script exit (Ctrl+C)
cleanup() {
    echo ""
    echo "🛑 Stopping services..."
    # Kill the process group
    kill 0
    exit
}

# Trap SIGINT (Ctrl+C) and SIGTERM
trap cleanup SIGINT SIGTERM

# Start Backend
echo "📦 Starting Backend (Port 8000)..."
(cd backend && npm run dev) &

# Start Frontend
echo "🎨 Starting Frontend (Port 5173)..."
(cd frontend && npm run dev) &

# Wait for all background processes
wait
