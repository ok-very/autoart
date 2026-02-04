#
# Setup script for AutoHelper development environment
# Creates venv and installs dependencies
#

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectDir = Split-Path -Parent $ScriptDir
$VenvDir = Join-Path $ProjectDir ".venv"

Write-Host "Setting up AutoHelper in $ProjectDir"

# Create venv if it doesn't exist
if (-not (Test-Path $VenvDir)) {
    Write-Host "Creating virtual environment..."
    python -m venv $VenvDir
} else {
    Write-Host "Virtual environment already exists"
}

# Activate venv
$ActivateScript = Join-Path $VenvDir "Scripts\Activate.ps1"
. $ActivateScript

# Upgrade pip
Write-Host "Upgrading pip..."
pip install --upgrade pip

# Install package in editable mode with dev dependencies
Write-Host "Installing autohelper..."
pip install -e "$ProjectDir[dev]"

Write-Host ""
Write-Host "Done. Activate with:"
Write-Host "  $ActivateScript"
