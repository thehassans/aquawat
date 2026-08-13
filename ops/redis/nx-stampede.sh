#!/bin/sh
# Redis NX stampede check — cacheAside uses SET lock:{key} NX EX ttl.
# Run while two shells hit GET /api/invoices/stats at the same instant.
#
#   ./ops/redis/nx-stampede.sh
#   # other terminals: curl -H "Authorization: Bearer $TOKEN" "$BASE_URL/api/invoices/stats"

set -e
REDIS_URL="${REDIS_URL:-redis://127.0.0.1:6379}"
KEY="${LOCK_KEY:-lock:invoice-stats:demo}"

echo "SET $KEY NX EX 60 (first caller must OK, second must NIL)"
redis-cli -u "$REDIS_URL" SET "$KEY" '{"probe":1}' NX EX 60
echo "second SET NX (expect nil):"
redis-cli -u "$REDIS_URL" SET "$KEY" '{"probe":2}' NX EX 60
echo "TTL:"
redis-cli -u "$REDIS_URL" TTL "$KEY"
echo "DEL lock"
redis-cli -u "$REDIS_URL" DEL "$KEY"

echo
echo "While flooding stats, watch locks:"
echo "  redis-cli -u \"$REDIS_URL\" --scan --pattern 'lock:*'"
echo "  redis-cli -u \"$REDIS_URL\" MONITOR | grep lock:"
echo
echo "Pass: only one SET NX returns OK per key; others wait and then GET a filled cache key."
