# Maqder live verification (isolation, limits, money, replica, SLO, DR)

Run against **staging** first. Production only with an approved window.

```powershell
powershell -File ops/run-local-checks.ps1
# or: cd backend; npm test
# isolation-only: cd backend; npm run test:isolation
```

CI: `.github/workflows/deploy.yml` runs `npm test` in `backend/` and **blocks Plesk deploy** if those tests fail.

---

## 1. Tenant isolation & CSRF (Newman)

Expected failure codes (pass = denied):

| Probe | Expected |
| --- | --- |
| Cookie `maqder_token` + `Origin: https://evil.example` on POST/PUT | **403** `{ error: "CSRF origin check failed" }` |
| Bearer token + foreign Origin | CSRF skipped (custom header). Isolation still applies. |
| Tenant A GET `/uploads/hr/{tenantB}/…` or `/api/uploads/hr/{tenantB}/…` | **401 / 403 / 404**, never 200 |
| Tenant A GET `/api/invoices/{invoiceB}` | **404** (`findOne` includes `tenantFilter`) |
| Tenant A GET `/api/payments/tenant-status/{tenantB}` | **403** |
| Tenant A GET `/api/payments/stripe-session/{sessionB}` | **403** `{ error: "Not authorized to view this payment" }` (paid or unpaid). Invalid Stripe id still **400** |
| Tenant A GET `/api/payments/invoice/{moyasarIdB}` or `/api/payments/{paymentBId}` | **403** (same body). Gateway-not-configured or unknown id: **400** |
| Tenant A + spoofed `x-tenant-id: B` | Header **ignored**; still **404** on B’s invoice |
| Super-admin GET `/api/invoices` without `x-tenant-id` | **400** `x-tenant-id header required for this operation` |
| Tenant JWT on `/api/super-admin/*` | **401 / 403** |

PowerShell:

```powershell
npx newman run ops/newman/tenant-isolation.postman_collection.json `
  -e ops/newman/env.example.json --bail
```

Fill `tokenA`, `tenantBId`, `invoiceBId`, `superAdminToken`, `cookieA` (session cookie only — no Bearer — for CSRF cases).

---

## 2. Rate limits (k6 + Redis)

Caps in code:

- Invoice create: **40 / 60s** per tenant (`INVOICE_CREATE_RATE_LIMIT_MAX`, HybridRateLimitStore `invoice-write`)
- Auth: **40 / 15 min** per IP (`AUTH_RATE_LIMIT_MAX`)

```powershell
k6 run -e BASE_URL=https://staging.maqder.com -e AUTH_TOKEN=eyJ... `
  backend/tests/k6/invoiceCreateRateLimit.js
k6 run -e BASE_URL=https://staging.maqder.com backend/tests/k6/authRateLimit.js
```

Pass: after the 40th create in a minute, status **429** with `Too many invoices`; connections stay up; p95 stays under 2s.

---

## 3. Stripe webhooks & VAT rounding

```bash
stripe listen --forward-to https://staging.maqder.com/api/payments/stripe-webhook
stripe trigger checkout.session.completed
stripe trigger checkout.session.async_payment_succeeded
stripe trigger checkout.session.async_payment_failed
stripe trigger invoice.payment_failed
```

Fulfillment types: `checkout.session.completed`, `checkout.session.async_payment_succeeded`.  
Failed email: `checkout.session.async_payment_failed`, `invoice.payment_failed` → `sendPaymentFailedEmail`.

CLI fixtures do not carry your tenant metadata. For a real **paid** invoice, complete test Checkout on `/demo-checkout` and confirm `subscription.status=active` and `endDate` extended.

VAT:

```powershell
cd backend; node --test tests/invoiceMoney.test.js tests/paymentPollIsolation.test.js
```

`10.01 * 0.15` is IEEE `1.5014999…`; `roundMoney` / `vatHalala` must be **1.50** (2 decimal halalas). Two lines → tax **3.00**, grand **23.02**.

---

## 4. Mongo secondary + cursor index + Redis NX

Git Bash / WSL (mongosh `--file` and the Redis NX script):

```bash
TENANT_ID=24hex mongosh "$MONGO_URI" --file ops/mongo/explain-diagnostics.js
sh ops/redis/nx-stampede.sh
```

Pass:

- `MONGODB_STATS_READ_PREFERENCE=secondaryPreferred` (compose default). Explain `serverInfo` is a secondary when rs0 has one.
- List winning plan uses `tenantId_1_flow_1_status_1_issueDate_-1` (or `tenantId_1_issueDate_-1__id_-1`). Cursor path does **not** `skip` (`invoice.routes.js` skip only when `cursor` is absent).
- `SET lock:… NX` second caller gets nil; stats flood does not N× Mongo.

---

## 5. SLO, Sentry, async PDF

Git Bash / WSL:

```bash
TOKEN=eyJ... INVOICE_ID=24hex BASE_URL=https://staging.maqder.com \
  sh ops/chaos/slo-pdf-drill.sh
```

- `/api/invoices/:id/pdf?async=1` → **202** `{ status: "queued", retryAfter: 1 }`, then poll `/pdf` until **200**.
- SLO window 5 minutes, min 20 samples; default p95 2000ms, 5xx rate 5%. Webhook cooldown **10 minutes**.
- Sentry `tracesSampleRate` is **0.05** in production (`sentryTracesSampleRate()`).

Staging-only: lower `SLO_ERROR_RATE`, stop Mongo briefly so `/api/health/ready` is **503**, confirm first webhook send then `cooldown`.

---

## 6. DR (S3 gzip → restore.sh)

Git Bash / WSL — `restore.sh` **drops** `maqder` in `maqder_mongo`:

```bash
CONFIRM_DROP=1 BASE_URL=http://localhost:5000 sh ops/dr/restore-drill.sh
```

Sequence: list S3 → `aws s3 cp` latest gzip → optional `dropDatabase` → `./restore.sh backups/mongo_backup_maqder_….gz` → wait `/api/health/ready` 200 → record RTO seconds.

`restore.sh` **drops and replaces** `maqder` in `maqder_mongo`. Not Atlas PITR.
