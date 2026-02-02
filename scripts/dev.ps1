# ===========================================
# AutoArt Development Server Startup (Windows)
# ===========================================
# Usage: .\scripts\dev.ps1
#        pnpm dev
#
# Services started:
#   - Backend API (port 3001)
#   - Frontend (port 5173)
#   - AutoHelper Python service (port 8000)
#   - Forms app (port 5174) - optional

$ErrorActionPreference = "Stop"

# Ensure Azure CLI is in PATH for DefaultAzureCredential
$AzureCLIPath = "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin"
if (Test-Path $AzureCLIPath) {
    $env:Path = "$AzureCLIPath;$env:Path"
}

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectDir = Split-Path -Parent $ScriptDir

. "$ScriptDir\config.ps1"

Set-Location $ProjectDir

Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "  AutoArt Development Environment" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# Check if pnpm is installed
$pnpmPath = Get-Command pnpm -ErrorAction SilentlyContinue
if (-not $pnpmPath) {
    Write-Host "[!] pnpm not found. Installing via corepack..." -ForegroundColor Yellow
    corepack enable
    corepack prepare pnpm@latest --activate
    Write-Host "[OK] pnpm installed" -ForegroundColor Green
}

# Check if .env exists
if (-not (Test-Path ".env")) {
    Write-Host "[!] No .env file found. Copying from .env.example..." -ForegroundColor Yellow
    Copy-Item ".env.example" ".env"
    Write-Host "[i] Created .env file with default settings" -ForegroundColor Yellow
    Write-Host ""
}

# Load .env file
Import-AutoArtEnv

# Build shared package first if dist doesn't exist
if (-not (Test-Path "shared\dist")) {
    Write-Host "[*] Building shared package..." -ForegroundColor Yellow
    Push-Location shared
    pnpm build 2>&1 | Out-Null
    Pop-Location
    Write-Host "[OK] Shared package built" -ForegroundColor Green
}

Write-Host "[*] Starting backend server..." -ForegroundColor Green
$currentPath = $env:Path
$backendJob = Start-Job -Name "AutoArt-Backend" -ScriptBlock {
    param($dir, $pathWithAz)
    $env:Path = $pathWithAz
    Set-Location "$dir\backend"
    pnpm dev 2>&1
} -ArgumentList $ProjectDir, $currentPath

Start-Sleep -Seconds 2

Write-Host "[*] Starting frontend server..." -ForegroundColor Green
$frontendJob = Start-Job -Name "AutoArt-Frontend" -ScriptBlock {
    param($dir)
    Set-Location "$dir\frontend"
    $env:NODE_OPTIONS = "--max-old-space-size=8192"
    pnpm dev 2>&1
} -ArgumentList $ProjectDir

Start-Sleep -Seconds 2

# Start AutoHelper if it exists
$autohelperJob = $null
if (Test-Path "$ProjectDir\apps\autohelper\package.json") {
    Write-Host "[*] Starting AutoHelper service..." -ForegroundColor Green
    $autohelperJob = Start-Job -Name "AutoArt-AutoHelper" -ScriptBlock {
        param($dir)
        Set-Location "$dir\apps\autohelper"
        pnpm dev:win 2>&1
    } -ArgumentList $ProjectDir
    Start-Sleep -Seconds 2
}

# Start Forms app if it exists
$formsJob = $null
if (Test-Path "$ProjectDir\apps\forms\package.json") {
    Write-Host "[*] Starting Forms app..." -ForegroundColor Green
    $formsJob = Start-Job -Name "AutoArt-Forms" -ScriptBlock {
        param($dir)
        Set-Location "$dir\apps\forms"
        pnpm dev 2>&1
    } -ArgumentList $ProjectDir
    Start-Sleep -Seconds 2
}

Write-Host ""
Write-Host "======================================" -ForegroundColor Green
Write-Host "  AutoArt is running!" -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Frontend:   http://localhost:$($script:AutoArt.FrontendPort)" -ForegroundColor White
Write-Host "  Backend:    http://localhost:$($script:AutoArt.BackendPort)" -ForegroundColor White
if ($autohelperJob) {
    Write-Host "  AutoHelper: http://localhost:$($script:AutoArt.AutoHelperPort)" -ForegroundColor White
}
if ($formsJob) {
    Write-Host "  Forms:      http://localhost:5174" -ForegroundColor White
}
Write-Host ""
Write-Host "  Demo Login:" -ForegroundColor Gray
Write-Host "    Email:    demo@autoart.local" -ForegroundColor Gray
Write-Host "    Password: demo123" -ForegroundColor Gray
Write-Host ""
Write-Host "Press Ctrl+C to stop all services" -ForegroundColor Yellow
Write-Host ""

# Collect all jobs
$allJobs = @($backendJob, $frontendJob)
if ($autohelperJob) { $allJobs += $autohelperJob }
if ($formsJob) { $allJobs += $formsJob }

# Cleanup function - kills all dev processes
function Stop-AllDevProcesses {
    Write-Host ""
    Write-Host "[*] Stopping services..." -ForegroundColor Yellow

    # Stop PowerShell jobs
    $allJobs | ForEach-Object {
        if ($_) {
            Stop-Job $_ -ErrorAction SilentlyContinue
            Remove-Job $_ -Force -ErrorAction SilentlyContinue
        }
    }

    # Kill processes on dev ports
    Stop-ProcessOnPort -Port $script:AutoArt.BackendPort
    Stop-ProcessOnPort -Port $script:AutoArt.FrontendPort
    Stop-ProcessOnPort -Port $script:AutoArt.AutoHelperPort
    Stop-ProcessOnPort -Port 5174

    # Kill orphaned node processes
    Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object {
        try {
            $cmd = (Get-CimInstance Win32_Process -Filter "ProcessId = $($_.Id)" -ErrorAction SilentlyContinue).CommandLine
            $cmd -and ($cmd -match [regex]::Escape($ProjectDir) -or ($cmd -match "tsx" -and $cmd -match "backend") -or ($cmd -match "vite"))
        } catch { $false }
    } | ForEach-Object { Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue }

    # Kill orphaned Python processes
    Get-Process -Name "python", "python3", "uvicorn" -ErrorAction SilentlyContinue | Where-Object {
        try {
            $cmd = (Get-CimInstance Win32_Process -Filter "ProcessId = $($_.Id)" -ErrorAction SilentlyContinue).CommandLine
            $cmd -and ($cmd -match [regex]::Escape($ProjectDir) -or $cmd -match "autohelper")
        } catch { $false }
    } | ForEach-Object { Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue }

    Write-Host "[OK] All services stopped." -ForegroundColor Green
}

# Handle Ctrl+C - this runs BEFORE the finally block
[Console]::TreatControlCAsInput = $false
$null = Register-EngineEvent -SourceIdentifier PowerShell.Exiting -Action { Stop-AllDevProcesses }

# Stream logs from all jobs
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

        if ($autohelperJob) {
            $autohelperOutput = Receive-Job $autohelperJob -ErrorAction SilentlyContinue
            if ($autohelperOutput) {
                $autohelperOutput | ForEach-Object { Write-Host "[HELPER] $_" -ForegroundColor Cyan }
            }
        }

        if ($formsJob) {
            $formsOutput = Receive-Job $formsJob -ErrorAction SilentlyContinue
            if ($formsOutput) {
                $formsOutput | ForEach-Object { Write-Host "[FORMS] $_" -ForegroundColor DarkYellow }
            }
        }

        # Check for crashed jobs
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
        if ($autohelperJob -and $autohelperJob.State -eq "Failed") {
            Write-Host "[X] AutoHelper crashed!" -ForegroundColor Red
            Receive-Job $autohelperJob
            break
        }
        if ($formsJob -and $formsJob.State -eq "Failed") {
            Write-Host "[X] Forms app crashed!" -ForegroundColor Red
            Receive-Job $formsJob
            break
        }

        Start-Sleep -Milliseconds 500
    }
}
finally {
    Stop-AllDevProcesses
}
