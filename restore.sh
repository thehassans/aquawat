#!/bin/sh
# Restore a mongodump archive created by backup.sh.
# This DROPS and replaces the maqder database. Not Atlas PITR.
#
# Usage:
#   ./restore.sh backups/mongo_backup_maqder_YYYYMMDD_HHMMSS.gz
#
# Atlas continuous backup (true PITR): enable in Atlas UI → Backup →
# Continuous Cloud Backup, then restore a timestamp from the Atlas console.

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CONTAINER_NAME="maqder_mongo"
DB_NAME="maqder"
FILE="$1"

if [ -z "$FILE" ]; then
  echo "Usage: $0 backups/mongo_backup_maqder_YYYYMMDD_HHMMSS.gz"
  exit 1
fi

if [ ! -f "$FILE" ]; then
  FILE="$SCRIPT_DIR/$FILE"
fi

if [ ! -f "$FILE" ]; then
  echo "Backup file not found: $1"
  exit 1
fi

echo "Restoring $FILE into $CONTAINER_NAME / $DB_NAME (drop+restore)..."
docker exec -i "$CONTAINER_NAME" sh -c "mongorestore --db $DB_NAME --drop --archive --gzip" < "$FILE"
echo "Restore complete."
