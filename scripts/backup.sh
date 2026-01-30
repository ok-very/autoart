#!/usr/bin/env bash
# ===========================================
# AutoArt Database Backup (Linux)
# ===========================================
# Usage: ./scripts/backup.sh

set -euo pipefail

source "$(dirname "$0")/config.sh"
cd "$PROJECT_DIR"

BACKUP_DIR="$PROJECT_DIR/backups"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/autoart_$TIMESTAMP.sql"

mkdir -p "$BACKUP_DIR"

echo "Creating database backup..."
echo "   File: $BACKUP_FILE"

# Run backup
if ! pg_dump -U autoart -h localhost -F c autoart > "$BACKUP_FILE"; then
    echo "[X] Backup failed!"
    exit 1
fi

# Compress
gzip "$BACKUP_FILE"
COMPRESSED="$BACKUP_FILE.gz"
SIZE=$(du -h "$COMPRESSED" | cut -f1)

echo ""
echo "Backup complete!"
echo "   File: $COMPRESSED"
echo "   Size: $SIZE"

# Cleanup old backups
echo ""
echo "Cleaning up backups older than $RETENTION_DAYS days..."
DELETED=$(find "$BACKUP_DIR" -name "autoart_*.sql.gz" -mtime +"$RETENTION_DAYS" -delete -print | wc -l)
echo "   Deleted $DELETED old backup(s)"

# List recent backups
echo ""
echo "Recent backups:"
ls -lhS "$BACKUP_DIR"/autoart_*.sql.gz 2>/dev/null | head -5 | \
    awk '{print "   " $NF " - " $5 " - " $6 " " $7 " " $8}'
