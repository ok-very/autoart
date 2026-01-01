# ===========================================
# AutoArt Development Server Startup (Windows)
# ===========================================
# Usage: .\scripts\dev.ps1
# Short command: npm run dev:win (from root)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectDir = Split-Path -Parent $ScriptDir

. "$ScriptDir\config.ps1"

Set-Location $ProjectDir

Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "  AutoArt Development Environment" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# Check if .env exists
if (-not (Test-Path ".env")) {
    Write-Host "[!] No .env file found. Copying from .env.example..." -ForegroundColor Yellow
    Copy-Item ".env.example" ".env"
    Write-Host "[i] Created .env file with default settings" -ForegroundColor Yellow
    Write-Host ""
}

# Load .env file
Import-AutoArtEnv

Write-Host "[*] Starting backend server..." -ForegroundColor Green
$backendJob = Start-Job -Name "AutoArt-Backend" -ScriptBlock {
    param($dir)
    Set-Location "$dir\backend"
    npm run dev 2>&1
} -ArgumentList $ProjectDir

Start-Sleep -Seconds 2

Write-Host "[*] Starting frontend server..." -ForegroundColor Green
$frontendJob = Start-Job -Name "AutoArt-Frontend" -ScriptBlock {
    param($dir)
    Set-Location "$dir\frontend"
    npm run dev 2>&1
} -ArgumentList $ProjectDir

Start-Sleep -Seconds 3

Write-Host ""
Write-Host "======================================" -ForegroundColor Green
Write-Host "  AutoArt is running!" -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Frontend: http://localhost:$($script:AutoArt.FrontendPort)" -ForegroundColor White
Write-Host "  Backend:  http://localhost:$($script:AutoArt.BackendPort)" -ForegroundColor White
Write-Host ""
Write-Host "  Demo Login:" -ForegroundColor Gray
Write-Host "    Email:    demo@autoart.local" -ForegroundColor Gray
Write-Host "    Password: demo123" -ForegroundColor Gray
Write-Host ""
Write-Host "Press Ctrl+C to stop all services" -ForegroundColor Yellow
Write-Host ""

# Stream logs from both jobs
try {
    while ($true) {
        $backendOutput = Receive-Job $backendJob -ErrorAction SilentlyContinue
        if ($backendOutput) {
            $backendOutput | ForEach-Object { Write-Host "[API] $_" -ForegroundColor Blue }
        }

        $frontendOutput = Receive-Job $frontendJob -ErrorAction SilentlyContinue
        if ($frontendOutput) {
            $frontendOutput | ForEach-Object { Write-Host "[WEB] $_" -ForegroundColor Magenta }
        }

        if ($backendJob.State -eq "Failed") {
            Write-Host "[X] Backend crashed!" -ForegroundColor Red
            Receive-Job $backendJob
            break
        }
        if ($frontendJob.State -eq "Failed") {
            Write-Host "[X] Frontend crashed!" -ForegroundColor Red
            Receive-Job $frontendJob
            break
        }

        Start-Sleep -Milliseconds 500
    }
}
finally {
    Write-Host ""
    Write-Host "[*] Stopping services..." -ForegroundColor Yellow
    Stop-Job $backendJob, $frontendJob -ErrorAction SilentlyContinue
    Remove-Job $backendJob, $frontendJob -Force -ErrorAction SilentlyContinue
    Write-Host "[OK] Stopped." -ForegroundColor Green
}
