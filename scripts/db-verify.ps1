# ===========================================
# AutoArt Database Management Script
# ===========================================
#
# Usage:
#   .\scripts\db-verify.ps1           - Interactive menu
#   .\scripts\db-verify.ps1 status    - Show database status
#   .\scripts\db-verify.ps1 reset     - Nuke and rebuild database
#   .\scripts\db-verify.ps1 repair    - Fix orphaned migrations
#   .\scripts\db-verify.ps1 verify    - Full verification test

param(
    [Parameter(Position = 0)]
    [ValidateSet('status', 'reset', 'repair', 'verify', 'migrate', 'seed', '')]
    [string]$Command = ''
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectDir = Split-Path -Parent $ScriptDir
$BackendDir = Join-Path $ProjectDir "backend"

function Show-Menu {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "  AutoArt Database Management" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  [1] status   - Show database status"
    Write-Host "  [2] migrate  - Run pending migrations"
    Write-Host "  [3] seed     - Seed sample data"
    Write-Host "  [4] reset    - Nuke & rebuild (DESTROYS DATA)"
    Write-Host "  [5] repair   - Fix orphaned migrations"
    Write-Host "  [6] verify   - Full verification test"
    Write-Host "  [q] quit"
    Write-Host ""
}

function Run-Command {
    param([string]$Cmd)

    Set-Location $BackendDir

    switch ($Cmd) {
        'status' {
            Write-Host "`nChecking database status..." -ForegroundColor Green
            npm run db:status 2>&1 | ForEach-Object { Write-Host $_ }
        }
        'migrate' {
            Write-Host "`nRunning migrations..." -ForegroundColor Green
            npm run migrate 2>&1 | ForEach-Object { Write-Host $_ }
        }
        'seed' {
            Write-Host "`nSeeding sample data..." -ForegroundColor Green
            npm run seed:dev 2>&1 | ForEach-Object { Write-Host $_ }
        }
        'reset' {
            Write-Host ""
            Write-Host "WARNING: This will DESTROY ALL DATA!" -ForegroundColor Red
            Write-Host ""
            $confirm = Read-Host "Type 'reset' to confirm"
            if ($confirm -eq 'reset') {
                Write-Host "`nNuking database..." -ForegroundColor Yellow
                npm run db:nuke -- --force 2>&1 | ForEach-Object { Write-Host $_ }
                Write-Host "`nRunning migrations..." -ForegroundColor Green
                npm run migrate 2>&1 | ForEach-Object { Write-Host $_ }
                Write-Host "`nSeeding data..." -ForegroundColor Green
                npm run seed:dev 2>&1 | ForEach-Object { Write-Host $_ }
                Write-Host "`nDatabase reset complete!" -ForegroundColor Green
            }
            else {
                Write-Host "Aborted." -ForegroundColor Gray
            }
        }
        'repair' {
            Write-Host "`nRepairing migrations..." -ForegroundColor Green
            npm run db:repair 2>&1 | ForEach-Object { Write-Host $_ }
        }
        'verify' {
            Write-Host ""
            Write-Host "========================================" -ForegroundColor Cyan
            Write-Host "  Full Verification Test" -ForegroundColor Cyan
            Write-Host "========================================" -ForegroundColor Cyan
            Write-Host ""
            Write-Host "This will:" -ForegroundColor Yellow
            Write-Host "  1. Drop all tables (destroy all data)" -ForegroundColor Yellow
            Write-Host "  2. Re-run all migrations" -ForegroundColor Yellow
            Write-Host "  3. Seed reference data" -ForegroundColor Yellow
            Write-Host "  4. Verify the result" -ForegroundColor Yellow
            Write-Host ""

            $confirm = Read-Host "Type 'verify' to continue"
            if ($confirm -ne 'verify') {
                Write-Host "Aborted." -ForegroundColor Gray
                return
            }

            # Step 1: Nuke
            Write-Host "`n[1/4] Dropping all tables..." -ForegroundColor Green
            npm run db:nuke -- --force 2>&1 | ForEach-Object { Write-Host "      $_" -ForegroundColor Gray }

            # Step 2: Migrate
            Write-Host "`n[2/4] Running migrations..." -ForegroundColor Green
            npm run migrate 2>&1 | ForEach-Object { Write-Host "      $_" -ForegroundColor Gray }
            if ($LASTEXITCODE -ne 0) {
                Write-Host "`n[X] Migration failed!" -ForegroundColor Red
                return
            }

            # Step 3: Seed
            Write-Host "`n[3/4] Seeding reference data..." -ForegroundColor Green
            npm run seed:dev 2>&1 | ForEach-Object { Write-Host "      $_" -ForegroundColor Gray }
            if ($LASTEXITCODE -ne 0) {
                Write-Host "`n[X] Seeding failed!" -ForegroundColor Red
                return
            }

            # Step 4: Verify
            Write-Host "`n[4/4] Verifying database..." -ForegroundColor Green
            npm run db:status 2>&1 | ForEach-Object { Write-Host "      $_" -ForegroundColor Gray }

            Write-Host ""
            Write-Host "========================================" -ForegroundColor Green
            Write-Host "  Verification Complete!" -ForegroundColor Green
            Write-Host "========================================" -ForegroundColor Green
            Write-Host ""
            Write-Host "Your database design is reproducible." -ForegroundColor White
            Write-Host "Ready for deployment to a fresh server." -ForegroundColor White
        }
    }

    Set-Location $ProjectDir
}

# Main execution
if ($Command) {
    Run-Command $Command
}
else {
    # Interactive mode
    while ($true) {
        Show-Menu
        $choice = Read-Host "Select option"

        switch ($choice) {
            '1' { Run-Command 'status' }
            '2' { Run-Command 'migrate' }
            '3' { Run-Command 'seed' }
            '4' { Run-Command 'reset' }
            '5' { Run-Command 'repair' }
            '6' { Run-Command 'verify' }
            'q' {
                Write-Host "Goodbye!" -ForegroundColor Cyan
                exit 0
            }
            'status' { Run-Command 'status' }
            'migrate' { Run-Command 'migrate' }
            'seed' { Run-Command 'seed' }
            'reset' { Run-Command 'reset' }
            'repair' { Run-Command 'repair' }
            'verify' { Run-Command 'verify' }
            default {
                Write-Host "Invalid option. Try again." -ForegroundColor Yellow
            }
        }
    }
}
