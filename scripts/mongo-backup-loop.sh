#!/bin/sh
# In-compose Mongo dump loop (14-day retention). Complements host backup.sh + S3.
set -e

BACKUP_DIR="${BACKUP_DIR:-/backups}"
DB_NAME="${DB_NAME:-maqder}"
URI="${MONGO_BACKUP_URI:-mongodb://mongo:27017}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
INTERVAL="${BACKUP_INTERVAL_SECONDS:-86400}"
INITIAL_DELAY="${BACKUP_INITIAL_DELAY_SECONDS:-120}"

mkdir -p "$BACKUP_DIR"
echo "mongo-backup: waiting ${INITIAL_DELAY}s before first dump"
sleep "$INITIAL_DELAY"

while true; do
  DATE=$(date +%Y%m%d_%H%M%S)
  FILE="$BACKUP_DIR/mongo_backup_${DB_NAME}_${DATE}.gz"
  echo "mongo-backup: starting $FILE"
  mongodump --uri="$URI" --db="$DB_NAME" --archive --gzip > "$FILE"
  echo "mongo-backup: saved $FILE"
  find "$BACKUP_DIR" -name "mongo_backup_${DB_NAME}_*.gz" -mtime +"$RETENTION_DAYS" -delete || true
  sleep "$INTERVAL"
done
