# ===========================================
# AutoArt Kill Dev Processes (Windows)
# ===========================================
# Usage:
#   .\scripts\kill-dev.ps1
#   npm run dev:kill

$ErrorActionPreference = "Stop"

. "$PSScriptRoot\config.ps1"

Write-Host "" 
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "  AutoArt Kill Dev Processes" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "" 

# Stop any jobs created by scripts/dev.ps1 (only visible within the current PowerShell session)
$jobNames = @("AutoArt-Backend", "AutoArt-Frontend")
$jobs = Get-Job -ErrorAction SilentlyContinue | Where-Object { $jobNames -contains $_.Name }
if ($jobs) {
    Write-Host "[*] Stopping existing PowerShell jobs..." -ForegroundColor Yellow
    try {
        $jobs | Stop-Job -Force -ErrorAction SilentlyContinue
        $jobs | Remove-Job -Force -ErrorAction SilentlyContinue
        Write-Host "[OK] Jobs stopped." -ForegroundColor Green
    }
    catch {
        Write-Host "[!] Failed stopping jobs: $($_.Exception.Message)" -ForegroundColor Yellow
    }
}

Write-Host "" 
Write-Host "[*] Stopping listeners on dev ports..." -ForegroundColor Yellow

Stop-ProcessOnPort -Port $script:AutoArt.BackendPort
Stop-ProcessOnPort -Port $script:AutoArt.FrontendPort
Stop-ProcessOnPort -Port $script:AutoArt.AutoHelperPort

# Also check for additional common Vite fallback ports (5174, 5175, etc.)
$additionalPorts = @(5174, 5175, 5176)
foreach ($port in $additionalPorts) {
    Stop-ProcessOnPort -Port $port
}

Write-Host "" 
Write-Host "[*] Checking for duplicate/orphaned node processes..." -ForegroundColor Yellow

# Find node processes that might be orphaned backend (tsx) or frontend (vite) servers
$backendDir = $script:AutoArt.BackendDir
$frontendDir = $script:AutoArt.FrontendDir
$projectDir = $script:AutoArt.ProjectDir

[array]$nodeProcesses = @(Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object {
        try {
            $cmdLine = (Get-CimInstance Win32_Process -Filter "ProcessId = $($_.Id)" -ErrorAction SilentlyContinue).CommandLine
            if ($cmdLine) {
                # Match processes running from our project directories
                $isAutoArt = $cmdLine -match [regex]::Escape($projectDir) -or
                $cmdLine -match "tsx" -and $cmdLine -match "backend" -or
                $cmdLine -match "vite" -and $cmdLine -match "frontend" -or
                $cmdLine -match "autoart"
                return $isAutoArt
            }
            return $false
        }
        catch {
            return $false
        }
    })

if ($null -ne $nodeProcesses -and $nodeProcesses.Count -gt 0) {
    Write-Host "[i] Found $($nodeProcesses.Count) potential AutoArt node process(es)" -ForegroundColor Yellow
    foreach ($proc in $nodeProcesses) {
        try {
            $cmdLine = (Get-CimInstance Win32_Process -Filter "ProcessId = $($proc.Id)" -ErrorAction SilentlyContinue).CommandLine
            $shortCmd = if ($cmdLine.Length -gt 80) { $cmdLine.Substring(0, 80) + "..." } else { $cmdLine }
            Write-Host "    PID $($proc.Id): $shortCmd" -ForegroundColor Gray
            Stop-Process -Id $proc.Id -Force -ErrorAction Stop
            Write-Host "[OK] Stopped orphaned process $($proc.Id)" -ForegroundColor Green
        }
        catch {
            Write-Host "[!] Could not stop process $($proc.Id): $($_.Exception.Message)" -ForegroundColor Yellow
        }
    }
}
else {
    Write-Host "[i] No orphaned node processes found" -ForegroundColor Gray
}

Write-Host "" 
Write-Host "Done." -ForegroundColor Green
