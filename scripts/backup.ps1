# ===========================================
# AutoArt Database Backup (Windows)
# ===========================================
# Usage: .\scripts\backup.ps1

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectDir = Split-Path -Parent $ScriptDir
$BackupDir = Join-Path $ProjectDir "backups"
$RetentionDays = if ($env:BACKUP_RETENTION_DAYS) { [int]$env:BACKUP_RETENTION_DAYS } else { 30 }

Set-Location $ProjectDir

# Create backup directory if it doesn't exist
if (-not (Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir | Out-Null
}

# Generate timestamp
$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$BackupFile = Join-Path $BackupDir "autoart_$Timestamp.sql"

Write-Host "Creating database backup..." -ForegroundColor Green
Write-Host "   File: $BackupFile"

# Find pg_dump
$PgDump = "pg_dump"
$PgPaths = @(
    "C:\Program Files\PostgreSQL\16\bin\pg_dump.exe",
    "C:\Program Files\PostgreSQL\15\bin\pg_dump.exe",
    "C:\Program Files\PostgreSQL\14\bin\pg_dump.exe"
)
foreach ($path in $PgPaths) {
    if (Test-Path $path) {
        $PgDump = $path
        break
    }
}

# Run backup
try {
    & $PgDump -U autoart -h localhost -F c autoart > $BackupFile
} catch {
    Write-Host "[X] Backup failed: $_" -ForegroundColor Red
    exit 1
}

# Get file size before compression
$OrigSize = (Get-Item $BackupFile).Length

# Compress using PowerShell (creates .zip instead of .gz on Windows)
$ZipFile = "$BackupFile.zip"
Compress-Archive -Path $BackupFile -DestinationPath $ZipFile -Force
Remove-Item $BackupFile

$CompSize = (Get-Item $ZipFile).Length
$SizeMB = [math]::Round($CompSize / 1MB, 2)

Write-Host ""
Write-Host "Backup complete!" -ForegroundColor Green
Write-Host "   File: $ZipFile"
Write-Host "   Size: $SizeMB MB"

# Cleanup old backups
Write-Host ""
Write-Host "Cleaning up backups older than $RetentionDays days..." -ForegroundColor Yellow
$CutoffDate = (Get-Date).AddDays(-$RetentionDays)
$OldBackups = Get-ChildItem -Path $BackupDir -Filter "autoart_*.sql.zip" | Where-Object { $_.LastWriteTime -lt $CutoffDate }
$DeletedCount = 0
foreach ($backup in $OldBackups) {
    Remove-Item $backup.FullName
    $DeletedCount++
}
Write-Host "   Deleted $DeletedCount old backup(s)"

# List recent backups
Write-Host ""
Write-Host "Recent backups:" -ForegroundColor Cyan
Get-ChildItem -Path $BackupDir -Filter "autoart_*.sql.zip" |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 5 |
    ForEach-Object {
        $sizeMB = [math]::Round($_.Length / 1MB, 2)
        Write-Host "   $($_.Name) - $sizeMB MB - $($_.LastWriteTime)"
    }
