#!/bin/bash
set -u

echo "=== replica set ==="
docker exec maqder_mongo mongosh --quiet --eval 'JSON.stringify(rs.status().members.map(function(m){return {name:m.name,stateStr:m.stateStr,health:m.health}}))'
echo "=== secondary hello.info ==="
docker exec maqder_mongo_secondary mongosh --quiet --eval 'print(db.hello().info || db.hello().secondary)'

echo "=== redis NX ==="
echo -n "first="; docker exec maqder_redis redis-cli SET lock:invoice-stats:live-probe probe1 NX EX 60
echo -n "second="; docker exec maqder_redis redis-cli SET lock:invoice-stats:live-probe probe2 NX EX 60
docker exec maqder_redis redis-cli DEL lock:invoice-stats:live-probe >/dev/null

echo "=== mongo explain ==="
TENANT=$(docker exec maqder_mongo mongosh --quiet --eval 'const i=db.getSiblingDB("maqder").invoices.findOne({tenantId:{$type:"objectId"}},{tenantId:1}); print(i && i.tenantId ? String(i.tenantId) : "")')
echo "TENANT_ID_SET=$([ -n "$TENANT" ] && echo yes || echo no)"
docker cp /tmp/explain-diagnostics.js maqder_mongo:/tmp/explain-diagnostics.js
docker exec -e TENANT_ID="$TENANT" maqder_mongo mongosh "mongodb://127.0.0.1:27017/maqder?directConnection=true" --quiet --file /tmp/explain-diagnostics.js

echo "=== live HTTP isolation ==="
docker cp /tmp/live-http-probe.mjs maqder_backend:/app/ops-live-http-probe.mjs
docker exec maqder_backend node /app/ops-live-http-probe.mjs
HTTP_RC=$?
docker exec maqder_backend rm -f /app/ops-live-http-probe.mjs
echo "HTTP_PROBE_EXIT=$HTTP_RC"
exit $HTTP_RC
