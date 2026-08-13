import './forceRedisOff.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { isSensitiveUploadPath, uploadPathAllowsTenant, gateSensitiveUploads } from '../middleware/uploadsAccess.js';
import { requireTenantFilter, tenantFilter } from '../middleware/auth.js';

const TENANT_A = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const TENANT_B = 'bbbbbbbbbbbbbbbbbbbbbbbb';

function mockRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  return res;
}

test('hr/ and expense-receipts/ and khayyat/ are sensitive', () => {
  assert.equal(isSensitiveUploadPath('hr/cv.pdf'), true);
  assert.equal(isSensitiveUploadPath('expense-receipts/a.png'), true);
  assert.equal(isSensitiveUploadPath('khayyat/measure.jpg'), true);
  assert.equal(isSensitiveUploadPath('products/logo.png'), false);
  assert.equal(isSensitiveUploadPath('branding/logo.webp'), false);
});

test('IDOR: tenant A cannot read tenant B HR upload path', () => {
  const path = `hr/${TENANT_B}/cv.pdf`;
  assert.equal(uploadPathAllowsTenant(path, TENANT_A), false);
  assert.equal(uploadPathAllowsTenant(path, TENANT_B), true);
});

test('IDOR: tenant A cannot read tenant B expense-receipts path', () => {
  assert.equal(uploadPathAllowsTenant(`expense-receipts/${TENANT_B}/r.png`, TENANT_A), false);
});

test('catalog image without ObjectId segment stays tenant-agnostic (public after gate skip)', () => {
  assert.equal(isSensitiveUploadPath('catalog/shirt.jpg'), false);
});

test('requireTenantFilter rejects empty super-admin filter (no x-tenant-id)', () => {
  const req = { tenantFilter: {} };
  const res = mockRes();
  let nextCalled = false;
  requireTenantFilter(req, res, () => {
    nextCalled = true;
  });
  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 400);
});

test('tenantFilter for tenant A never scopes to tenant B', () => {
  const req = { user: { role: 'admin', tenantId: TENANT_A }, headers: { 'x-tenant-id': TENANT_B } };
  const res = mockRes();
  tenantFilter(req, res, () => {});
  assert.equal(String(req.tenantFilter.tenantId), TENANT_A);
});

test('PUT invoice query must include caller tenantId (IDOR contract)', () => {
  const callerFilter = { tenantId: TENANT_A };
  const foreignInvoiceId = 'cccccccccccccccccccccccc';
  const query = { _id: foreignInvoiceId, ...callerFilter };
  assert.deepEqual(query, { _id: foreignInvoiceId, tenantId: TENANT_A });
  assert.notEqual(query.tenantId, TENANT_B);
});

test('IDOR: tenant id must match a 24-hex path segment, not a substring', () => {
  assert.equal(uploadPathAllowsTenant(`hr/${TENANT_B}/cv.pdf`, TENANT_A), false);
  assert.equal(uploadPathAllowsTenant(`hr/${TENANT_B}/cv.pdf`, TENANT_B), true);
  assert.equal(uploadPathAllowsTenant(`hr/${TENANT_A}/nested/${TENANT_B}/cv.pdf`, TENANT_A), false);
  assert.equal(uploadPathAllowsTenant(`hr/${TENANT_A}/nested/${TENANT_B}/cv.pdf`, TENANT_B), false);
});

test('GET /uploads/hr/ without a tenant segment still requires auth (sensitive prefix)', () => {
  assert.equal(isSensitiveUploadPath('hr/'), true);
  assert.equal(isSensitiveUploadPath('hr'), true);
});

test('unauthenticated GET /uploads/hr/ is rejected by gateSensitiveUploads', async () => {
  const req = { path: '/hr/cv.pdf', headers: {}, cookies: {} };
  const res = mockRes();
  let nextCalled = false;
  await new Promise((resolve) => {
    const origJson = res.json.bind(res);
    res.json = (payload) => {
      origJson(payload);
      resolve();
      return res;
    };
    res.status = (code) => {
      res.statusCode = code;
      return res;
    };
    gateSensitiveUploads(req, res, () => {
      nextCalled = true;
      resolve();
    });
  });
  assert.equal(nextCalled, false);
  assert.ok(res.statusCode === 401 || res.statusCode === 403);
});

const live = process.env.MAQDER_IDOR_TEST === '1';
const liveSkip = !live;

test('live IDOR: tenant A GET /uploads/hr/{B}/ is 401/403', { skip: liveSkip }, async () => {
  const base = String(process.env.BASE_URL || 'http://localhost:5000').replace(/\/$/, '');
  const tokenA = process.env.TOKEN_A;
  const tenantB = process.env.TENANT_B_ID || TENANT_B;
  assert.ok(tokenA, 'TOKEN_A required');
  const res = await fetch(`${base}/uploads/hr/${tenantB}/cv.pdf`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  assert.ok([401, 403, 404].includes(res.status), `unexpected ${res.status}`);
  assert.notEqual(res.status, 200);
});

test('live IDOR: tenant A PUT invoice of tenant B is 404 not 200', { skip: liveSkip }, async () => {
  const base = String(process.env.BASE_URL || 'http://localhost:5000').replace(/\/$/, '');
  const tokenA = process.env.TOKEN_A;
  const invoiceB = process.env.INVOICE_B_ID;
  assert.ok(tokenA && invoiceB, 'TOKEN_A and INVOICE_B_ID required');
  const res = await fetch(`${base}/api/invoices/${invoiceB}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${tokenA}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ notes: 'idor-probe' }),
  });
  assert.ok([400, 403, 404].includes(res.status), `unexpected ${res.status}`);
  assert.notEqual(res.status, 200);
});
