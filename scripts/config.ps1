# ===========================================
# AutoArt Script Config (Windows / PowerShell)
# ===========================================
# Dot-source this file from other scripts:
#   . "$PSScriptRoot\config.ps1"

Set-StrictMode -Version Latest

function Get-AutoArtProjectDir {
    # scripts/ is at <project>/scripts, so project root is one level up
    return (Split-Path -Parent $PSScriptRoot)
}

$script:AutoArt = [ordered]@{}
$script:AutoArt.ProjectDir = Get-AutoArtProjectDir
$script:AutoArt.BackendDir = Join-Path $script:AutoArt.ProjectDir "backend"
$script:AutoArt.FrontendDir = Join-Path $script:AutoArt.ProjectDir "frontend"
$script:AutoArt.EnvFile = Join-Path $script:AutoArt.ProjectDir ".env"

# Default dev ports (override via env vars if you want)
$script:AutoArt.BackendPort = if ($env:AUTOART_BACKEND_PORT) { [int]$env:AUTOART_BACKEND_PORT } else { 3001 }
$script:AutoArt.FrontendPort = if ($env:AUTOART_FRONTEND_PORT) { [int]$env:AUTOART_FRONTEND_PORT } else { 5173 }
$script:AutoArt.AutoHelperPort = if ($env:AUTOART_AUTOHELPER_PORT) { [int]$env:AUTOART_AUTOHELPER_PORT } else { 8100 }

function Import-AutoArtEnv {
    param(
        [string]$EnvPath = $script:AutoArt.EnvFile
    )

    if (-not (Test-Path $EnvPath)) {
        return
    }

    Get-Content $EnvPath | ForEach-Object {
        $line = $_
        if (-not $line) { return }
        if ($line.TrimStart().StartsWith('#')) { return }
        if ($line -match '^\s*([^#=\s]+)=(.*)$') {
            $key = $matches[1].Trim()
            $value = $matches[2]

            # Trim optional surrounding quotes
            $value = $value.Trim()
            if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
                $value = $value.Substring(1, $value.Length - 2)
            }

            Set-Item -Path "env:$key" -Value $value
        }
    }
}

function Stop-ProcessOnPort {
    param(
        [Parameter(Mandatory = $true)][int]$Port
    )

    [array]$owningProcessIds = @()

    try {
        $owningProcessIds = @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction Stop |
            Select-Object -ExpandProperty OwningProcess -Unique)
    }
    catch {
        # Get-NetTCPConnection may not exist on older Windows/PS; fall back to netstat parsing
        $netstatMatches = netstat -ano -p tcp | Select-String -Pattern (":$Port\s+LISTENING\s+(\d+)$")
        foreach ($line in $netstatMatches) {
            if ($line.Line -match ":$Port\s+LISTENING\s+(\d+)$") {
                $owningProcessIds += [int]$Matches[1]
            }
        }
        $owningProcessIds = @($owningProcessIds | Select-Object -Unique)
    }

    if ($null -eq $owningProcessIds -or $owningProcessIds.Count -eq 0) {
        Write-Host "[i] No listener found on port $Port" -ForegroundColor Gray
        return
    }

    foreach ($owningProcessId in $owningProcessIds) {
        try {
            Stop-Process -Id $owningProcessId -Force -ErrorAction Stop
            Write-Host ("[OK] Stopped process {0} on port {1}" -f $owningProcessId, $Port) -ForegroundColor Green
        }
        catch {
            Write-Host ("[!] Could not stop process {0} on port {1}. {2}" -f $owningProcessId, $Port, $_.Exception.Message) -ForegroundColor Yellow
        }
    }
}
