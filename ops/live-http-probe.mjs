/**
 * Live defensive probes against the in-cluster Nginx + API.
 * Prints HTTP codes only — never tokens, emails, or secrets.
 *
 *   docker cp ops/live-http-probe.mjs maqder_backend:/tmp/live-http-probe.mjs
 *   docker exec maqder_backend node /tmp/live-http-probe.mjs
 */
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';

const BASE = (process.env.LIVE_BASE || 'http://maqder_frontend:80').replace(/\/$/, '');
const secret = process.env.JWT_SECRET;
if (!secret) {
  console.error('FAIL JWT_SECRET missing in container');
  process.exit(1);
}

const sign = (user) =>
  jwt.sign(
    { id: String(user._id), tenantId: user.tenantId ? String(user.tenantId) : undefined },
    secret,
    { expiresIn: '10m' }
  );

const probe = async ({ name, expect, method = 'GET', path, token, cookie, origin, extraHeaders = {}, body }) => {
  const headers = { ...extraHeaders };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (cookie) headers.Cookie = cookie;
  if (origin) headers.Origin = origin;
  if (body) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let error = '';
  try {
    error = String(JSON.parse(text).error || '').slice(0, 120);
  } catch {
    error = text.slice(0, 80).replace(/\s+/g, ' ');
  }
  const expectList = Array.isArray(expect) ? expect : [expect];
  const pass = expectList.includes(res.status);
  console.log(JSON.stringify({ name, status: res.status, expect: expectList, error, pass }));
  return pass;
};

await mongoose.connect(process.env.MONGODB_URI);
const db = mongoose.connection.db;
const users = db.collection('users');
const invoices = db.collection('invoices');

const invoiceB = await invoices.findOne({ tenantId: { $type: 'objectId' } }, { projection: { _id: 1, tenantId: 1 } });
const invoiceA = invoiceB
  ? await invoices.findOne({ tenantId: { $type: 'objectId', $ne: invoiceB.tenantId } }, { projection: { _id: 1, tenantId: 1 } })
  : null;
const userA = invoiceA
  ? await users.findOne({
      role: { $nin: ['super_admin', 'reseller'] },
      tenantId: invoiceA.tenantId,
      isActive: { $ne: false },
    })
  : await users.findOne({
      role: { $nin: ['super_admin', 'reseller'] },
      tenantId: { $type: 'objectId' },
      isActive: { $ne: false },
    });
const userB = invoiceB
  ? await users.findOne({
      role: { $nin: ['super_admin', 'reseller'] },
      tenantId: invoiceB.tenantId,
      isActive: { $ne: false },
    })
  : null;
const superAdmin = await users.findOne({ role: 'super_admin', isActive: { $ne: false } });

console.log(JSON.stringify({
  setup: true,
  hasUserA: Boolean(userA),
  hasUserB: Boolean(userB),
  hasSuperAdmin: Boolean(superAdmin),
  hasInvoiceA: Boolean(invoiceA),
  hasInvoiceB: Boolean(invoiceB),
  tenantA: userA?.tenantId ? String(userA.tenantId) : null,
  tenantB: userB?.tenantId ? String(userB.tenantId) : null,
}));

if (!userA || !userB) {
  console.error('FAIL need two distinct tenant users in Mongo');
  await mongoose.disconnect();
  process.exit(1);
}

const tokenA = sign(userA);
const tokenB = sign(userB);
const tokenSA = superAdmin ? sign(superAdmin) : '';
const tenantB = String(userB.tenantId);
const tenantA = String(userA.tenantId);
const invB = invoiceB ? String(invoiceB._id) : 'bbbbbbbbbbbbbbbbbbbbbbbb';
const invA = invoiceA ? String(invoiceA._id) : '';
const cookieA = `maqder_token=${tokenA}`;

const results = [];

results.push(await probe({
  name: 'health',
  expect: 200,
  path: '/api/health',
}));
results.push(await probe({
  name: 'health.ready',
  expect: 200,
  path: '/api/health/ready',
}));
results.push(await probe({
  name: 'health.slo',
  expect: [200, 503],
  path: '/api/health/slo',
}));
results.push(await probe({
  name: 'csrf.cookie.foreignOrigin.POST',
  expect: 403,
  method: 'POST',
  path: '/api/invoices',
  cookie: cookieA,
  origin: 'https://evil.example',
  body: {
    status: 'draft',
    paymentMethod: 'credit',
    lineItems: [{ productName: 'csrf-probe', quantity: 1, unitPrice: 1, taxRate: 15 }],
  },
}));
results.push(await probe({
  name: 'csrf.cookie.foreignOrigin.PUT',
  expect: 403,
  method: 'PUT',
  path: `/api/invoices/${invB}`,
  cookie: cookieA,
  origin: 'https://evil.example',
  body: { notes: 'csrf-probe' },
}));
results.push(await probe({
  name: 'csrf.bearer.skipsOrigin',
  expect: [200, 403],
  path: '/api/invoices?limit=1',
  token: tokenA,
  origin: 'https://evil.example',
}));
results.push(await probe({
  name: 'idor.uploads.hr.B',
  expect: [401, 403, 404],
  path: `/uploads/hr/${tenantB}/cv.pdf`,
  token: tokenA,
}));
results.push(await probe({
  name: 'idor.api.uploads.hr.B',
  expect: [401, 403, 404],
  path: `/api/uploads/hr/${tenantB}/cv.pdf`,
  token: tokenA,
}));
results.push(await probe({
  name: 'idor.invoice.B',
  expect: [404, 400, 403],
  path: `/api/invoices/${invB}`,
  token: tokenA,
}));
results.push(await probe({
  name: 'idor.x-tenant-id.spoof',
  expect: 404,
  path: `/api/invoices/${invB}`,
  token: tokenA,
  extraHeaders: { 'x-tenant-id': tenantB },
}));
results.push(await probe({
  name: 'idor.payment.tenant-status.B',
  expect: 403,
  path: `/api/payments/tenant-status/${tenantB}`,
  token: tokenA,
}));
results.push(await probe({
  name: 'idor.stripe.session.B',
  expect: [400, 403],
  path: '/api/payments/stripe-session/cs_test_isolation_probe',
  token: tokenA,
}));
results.push(await probe({
  name: 'idor.moyasar.payment.B',
  expect: [400, 403, 404],
  path: '/api/payments/not-a-real-moyasar-id',
  token: tokenA,
}));
results.push(await probe({
  name: 'tenant.blocked.super-admin',
  expect: [401, 403],
  path: '/api/super-admin/tenants?limit=1',
  token: tokenA,
  extraHeaders: { 'x-tenant-id': tenantB },
}));

if (tokenSA) {
  results.push(await probe({
    name: 'superAdmin.invoices.noHeader',
    expect: 400,
    path: '/api/invoices?limit=1',
    token: tokenSA,
  }));
  results.push(await probe({
    name: 'superAdmin.current.noHeader',
    expect: [400, 404],
    path: '/api/tenants/current',
    token: tokenSA,
  }));
  results.push(await probe({
    name: 'superAdmin.invoices.withHeader',
    expect: 200,
    path: '/api/invoices?limit=5',
    token: tokenSA,
    extraHeaders: { 'x-tenant-id': tenantA },
  }));
}

results.push(await probe({
  name: 'stripe.webhook.unsigned',
  expect: [400, 401, 403, 503],
  method: 'POST',
  path: '/api/payments/stripe-webhook',
  extraHeaders: { 'Content-Type': 'application/json' },
  body: { type: 'checkout.session.completed', data: { object: { id: 'cs_test_probe' } } },
}));

if (invB) {
  results.push(await probe({
    name: 'pdf.async.ownInvoice',
    expect: [202, 200],
    path: `/api/invoices/${invB}/pdf?async=1`,
    token: tokenB,
  }));
  let pdfPass = false;
  for (let i = 0; i < 20; i += 1) {
    const res = await fetch(`${BASE}/api/invoices/${invB}/pdf`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    console.log(JSON.stringify({
      name: `pdf.poll.${i}`,
      status: res.status,
      expect: [200, 202, 409, 425],
      pass: res.status === 200 || (i < 19 && [202, 409, 425].includes(res.status)),
    }));
    if (res.status === 200) {
      pdfPass = true;
      break;
    }
    if (![202, 409, 425].includes(res.status)) break;
    await new Promise((r) => setTimeout(r, 1000));
  }
  results.push(pdfPass);
}

await mongoose.disconnect();
const failed = results.filter((p) => p === false).length;
const passed = results.filter((p) => p === true).length;
console.log(JSON.stringify({ summary: true, passed, failed, total: results.length }));
process.exit(failed ? 1 : 0);
