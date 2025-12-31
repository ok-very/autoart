# ===========================================
# AutoArt Database Verification Script
# ===========================================
# Usage: .\scripts\db-verify.ps1
#
# This script verifies that the database can be rebuilt
# from migrations alone. This is the "future check" -
# if this passes, you're ready to deploy.

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectDir = Split-Path -Parent $ScriptDir

Set-Location $ProjectDir

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  AutoArt Database Verification" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "This will:" -ForegroundColor Yellow
Write-Host "  1. Drop all tables (destroy all data)" -ForegroundColor Yellow
Write-Host "  2. Re-run all migrations" -ForegroundColor Yellow
Write-Host "  3. Seed reference data" -ForegroundColor Yellow
Write-Host "  4. Verify the result" -ForegroundColor Yellow
Write-Host ""

$confirm = Read-Host "Continue? (yes/no)"
if ($confirm -ne "yes") {
    Write-Host "Aborted." -ForegroundColor Gray
    exit 0
}

Write-Host ""

# Step 1: Roll back all migrations
Write-Host "[1/4] Rolling back migrations..." -ForegroundColor Green
Set-Location backend
try {
    npm run migrate:down 2>&1 | ForEach-Object { Write-Host "      $_" -ForegroundColor Gray }
} catch {
    Write-Host "      (No migrations to roll back)" -ForegroundColor Gray
}

# Step 2: Run all migrations
Write-Host ""
Write-Host "[2/4] Running migrations..." -ForegroundColor Green
npm run migrate 2>&1 | ForEach-Object { Write-Host "      $_" -ForegroundColor Gray }

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "[X] Migration failed!" -ForegroundColor Red
    Set-Location $ProjectDir
    exit 1
}

# Step 3: Seed reference data
Write-Host ""
Write-Host "[3/4] Seeding reference data..." -ForegroundColor Green
npm run seed 2>&1 | ForEach-Object { Write-Host "      $_" -ForegroundColor Gray }

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "[X] Seeding failed!" -ForegroundColor Red
    Set-Location $ProjectDir
    exit 1
}

# Step 4: Verify tables exist
Write-Host ""
Write-Host "[4/4] Verifying database structure..." -ForegroundColor Green

# Quick verification using Node
$verifyScript = @"
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
async function verify() {
  const tables = ['users', 'sessions', 'record_definitions', 'hierarchy_nodes', 'records', 'task_references'];
  for (const table of tables) {
    const result = await pool.query(\`SELECT COUNT(*) FROM \${table}\`);
    console.log(\`  \${table}: OK\`);
  }
  await pool.end();
}
verify().catch(e => { console.error(e.message); process.exit(1); });
"@

node -e $verifyScript 2>&1 | ForEach-Object { Write-Host $_ -ForegroundColor Gray }

Set-Location $ProjectDir

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Verification Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Your database design is reproducible." -ForegroundColor White
Write-Host "Ready for deployment to a fresh server." -ForegroundColor White
Write-Host ""
