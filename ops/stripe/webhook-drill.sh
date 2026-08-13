#!/bin/sh
# Stripe CLI → live webhook /api/payments/stripe-webhook
# Use Stripe TEST mode keys. Forward to staging unless you intend production test-mode.
#
#   stripe login
#   ./ops/stripe/webhook-drill.sh https://staging.maqder.com

set -e
BASE="${1:-http://localhost:5000}"
WEBHOOK="${BASE%/}/api/payments/stripe-webhook"

echo "Forwarding Stripe events to $WEBHOOK"
echo "Keep this running in a dedicated terminal:"
echo "  stripe listen --forward-to $WEBHOOK"
echo
echo "In another terminal, after listen prints a whsec_... secret, set STRIPE_WEBHOOK_SECRET to match Super Admin → Payment Settings."
echo
echo "=== 1. Successful Checkout (maps to checkout.session.completed) ==="
echo "  stripe trigger checkout.session.completed"
echo "Expect: HTTP 200 from webhook; tenant subscription.status=active if metadata.tenantId is yours."
echo "Fixture metadata will NOT match a real tenant — for a real paid→paid invoice, complete a test Checkout from /demo-checkout instead."
echo
echo "=== 2. Async success ==="
echo "  stripe trigger checkout.session.async_payment_succeeded"
echo "Expect: same fulfill path as completed (isStripeFulfillmentEvent)."
echo
echo "=== 3. Failed payment (sendPaymentFailedEmail) ==="
echo "  stripe trigger checkout.session.async_payment_failed"
echo "  stripe trigger invoice.payment_failed"
echo "Expect: webhook 200; sendPaymentFailedEmail runs when metadata has tenantId/email (see stripeFailureContext)."
echo
echo "Round-trip check after a real test Checkout:"
echo "  mongosh \"\$MONGO_URI\" --eval 'db.invoices.findOne({_id: ObjectId(\"<id>\")}, {paymentStatus:1, paidAmount:1, grandTotal:1})'"
echo
echo "IEEE / 15% VAT (no Stripe):"
echo "  cd backend && node --test tests/invoiceMoney.test.js"
echo "  Expected: vatHalala(10.01, 15) === 1.50  (not 1.5014999999999998)"
