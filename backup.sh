#!/bin/sh
# Daily MongoDB backup script for Docker host (optional S3 upload).
# Compose also runs scripts/mongo-backup-loop.sh as maqder_mongo_backup (local dumps).
# Host crontab still useful for S3: 0 3 * * * /var/www/vhosts/maqder.com/httpdocs/backup.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKUP_DIR="$SCRIPT_DIR/backups"
DB_NAME="maqder"
CONTAINER_NAME="maqder_mongo"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="mongo_backup_${DB_NAME}_${DATE}.gz"
RETENTION_DAYS=14

mkdir -p "$BACKUP_DIR"

if [ -f "$SCRIPT_DIR/backend/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  . "$SCRIPT_DIR/backend/.env"
  set +a
elif [ -f "$SCRIPT_DIR/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  . "$SCRIPT_DIR/.env"
  set +a
fi

echo "Starting MongoDB backup: $BACKUP_FILE"
docker exec "$CONTAINER_NAME" sh -c "mongodump --db $DB_NAME --archive --gzip" > "$BACKUP_DIR/$BACKUP_FILE"

echo "Backup saved: $BACKUP_DIR/$BACKUP_FILE"

if [ -n "${S3_BUCKET:-}" ] && [ -n "${S3_ACCESS_KEY:-}" ] && [ -n "${S3_SECRET_KEY:-}" ]; then
  echo "Uploading backup to object storage..."
  (cd "$SCRIPT_DIR/backend" && node scripts/uploadBackupToS3.js "$BACKUP_DIR/$BACKUP_FILE") \
    || echo "S3 backup upload failed (local dump kept)"
else
  echo "S3 backup skipped — set S3_BUCKET, S3_ACCESS_KEY, and S3_SECRET_KEY to enable off-site copies"
fi

# Remove old backups
find "$BACKUP_DIR" -name "mongo_backup_${DB_NAME}_*.gz" -mtime +$RETENTION_DAYS -delete

echo "Backup complete."

# Restore a dump (drops maqder):
#   ./restore.sh backups/mongo_backup_maqder_YYYYMMDD_HHMMSS.gz
# Atlas PITR: enable Continuous Cloud Backup in the Atlas UI, then restore a timestamp there.
