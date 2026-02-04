#!/usr/bin/env bash
#
# Setup script for AutoHelper development environment
# Creates venv and installs dependencies
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
VENV_DIR="$PROJECT_DIR/.venv"

echo "Setting up AutoHelper in $PROJECT_DIR"

# Create venv if it doesn't exist
if [ ! -d "$VENV_DIR" ]; then
    echo "Creating virtual environment..."
    python3 -m venv "$VENV_DIR"
else
    echo "Virtual environment already exists"
fi

# Activate venv
source "$VENV_DIR/bin/activate"

# Upgrade pip
echo "Upgrading pip..."
pip install --upgrade pip

# Install package in editable mode with dev dependencies
echo "Installing autohelper..."
pip install -e "$PROJECT_DIR[dev]"

echo ""
echo "Done. Activate with:"
echo "  source $VENV_DIR/bin/activate"
