#!/bin/sh
# Disaster recovery drill — mongodump gzip from S3 → restore.sh
# THIS DROPS the maqder database. Use a staging replica, not production,
# unless you have an approved maintenance window.
#
#   ./ops/dr/restore-drill.sh
#
# Measures wall-clock RTO from "DB dropped" to /api/health/ready == 200.

set -e
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

if [ -f backend/.env ]; then
  set -a
  # shellcheck disable=SC1091
  . backend/.env
  set +a
fi

BUCKET="${S3_BUCKET:?set S3_BUCKET}"
PREFIX="${S3_BACKUP_PREFIX:-backups/}"
API="${BASE_URL:-http://localhost:5000}"
START=$(date +%s)

echo "=== 1. Confirm latest off-site object ==="
if [ -n "${S3_ENDPOINT:-}" ]; then
  AWS_ARGS="--endpoint-url $S3_ENDPOINT"
else
  AWS_ARGS=""
fi
# shellcheck disable=SC2086
aws s3 ls "s3://$BUCKET/$PREFIX" $AWS_ARGS | tail -n 5
LATEST=$(aws s3 ls "s3://$BUCKET/$PREFIX" $AWS_ARGS | awk '{print $4}' | grep 'mongo_backup_maqder_' | tail -n 1)
echo "Using $LATEST"

echo "=== 2. Pull gzip locally ==="
mkdir -p backups
# shellcheck disable=SC2086
aws s3 cp "s3://$BUCKET/$PREFIX$LATEST" "backups/$LATEST" $AWS_ARGS

echo "=== 3. Simulate total loss (drop maqder) ==="
echo "Skipping drop unless CONFIRM_DROP=1"
if [ "${CONFIRM_DROP:-}" = "1" ]; then
  docker exec maqder_mongo mongosh --quiet --eval 'db.getSiblingDB("maqder").dropDatabase()'
fi

echo "=== 4. restore.sh ==="
chmod +x restore.sh
./restore.sh "backups/$LATEST"

echo "=== 5. App ready? ==="
i=0
until curl -sf "$API/api/health/ready" >/dev/null; do
  i=$((i + 1))
  if [ "$i" -gt 60 ]; then
    echo "RTO fail: /api/health/ready never 200"
    exit 1
  fi
  sleep 2
done
END=$(date +%s)
echo "RTO seconds: $((END - START))"
curl -sS "$API/api/health/ready"
echo
echo "Spot-check: login UI loads, one tenant invoice list returns 200."
