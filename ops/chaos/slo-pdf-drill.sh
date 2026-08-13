#!/bin/sh
# Staging chaos: SLO webhook cooldown + async PDF 202.
# Do not point this at production. Requires ALERT_WEBHOOK_URL on the API host.
#
#   BASE_URL=https://staging.maqder.com TOKEN=eyJ... INVOICE_ID=... ./ops/chaos/slo-pdf-drill.sh

set -e
BASE="${BASE_URL:-http://localhost:5000}"
BASE="${BASE%/}"

echo "=== SLO snapshot ==="
curl -sS "$BASE/api/health/slo" | tee /tmp/maqder-slo.json
echo

echo "To fire ALERT_WEBHOOK_URL on staging (10-minute cooldown, ALERT_COOLDOWN_MS default 600000):"
echo "  1. Set SLO_ERROR_RATE=0.01 and SLO_P95_MS=1 on the API, restart."
echo "  2. Point ALERT_WEBHOOK_URL at a catcher (webhook.site)."
echo "  3. Generate >=20 samples in 5 minutes with 5xx, e.g. stop mongo briefly so /api/health/ready is 503"
echo "     (evaluateSloAndAlert also fires on not_ready)."
echo "  4. First breach POSTs the webhook. Immediate second breach must return reason=cooldown."
echo "  5. Sentry: production tracesSampleRate defaults to 0.05. Look for the 5xx transaction; ~1 in 20 traces is sampled."
echo

if [ -n "$TOKEN" ] && [ -n "$INVOICE_ID" ]; then
  echo "=== PDF async=1 ==="
  CODE=$(curl -sS -o /tmp/maqder-pdf.json -w "%{http_code}" \
    -H "Authorization: Bearer $TOKEN" \
    "$BASE/api/invoices/$INVOICE_ID/pdf?async=1")
  echo "status=$CODE (expect 202)"
  cat /tmp/maqder-pdf.json
  echo
  echo "Poll until 200 (cached worker output):"
  i=0
  while [ "$i" -lt 30 ]; do
    CODE=$(curl -sS -o /tmp/maqder-pdf.bin -w "%{http_code}" \
      -H "Authorization: Bearer $TOKEN" \
      "$BASE/api/invoices/$INVOICE_ID/pdf")
    echo "poll $i -> $CODE"
    if [ "$CODE" = "200" ]; then
      file /tmp/maqder-pdf.bin
      exit 0
    fi
    i=$((i + 1))
    sleep 1
  done
  echo "PDF poll timed out"
  exit 1
else
  echo "Set TOKEN and INVOICE_ID to run the PDF 202→200 poll."
fi
