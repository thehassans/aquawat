import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canFulfillPaymentForTenant,
  rejectUnauthorizedPaymentPoll,
} from '../utils/paymentTenantGuard.js';

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

test('IDOR: Tenant A cannot fulfill Tenant B payment metadata', () => {
  const req = { user: { role: 'admin', tenantId: TENANT_A, email: 'a@t.test' } };
  assert.equal(canFulfillPaymentForTenant(req, { tenantId: TENANT_B }), false);
  assert.equal(canFulfillPaymentForTenant(req, { tenantId: TENANT_A }), true);
});

test('IDOR: missing tenantId on payment metadata is never fulfillable', () => {
  const req = { user: { role: 'admin', tenantId: TENANT_A } };
  assert.equal(canFulfillPaymentForTenant(req, {}), false);
  assert.equal(canFulfillPaymentForTenant(req, { tenantId: '' }), false);
});

test('super_admin may fulfill any tenant payment', () => {
  const req = { user: { role: 'super_admin' } };
  assert.equal(canFulfillPaymentForTenant(req, { tenantId: TENANT_B }), true);
});

test('demoEmail match allows the checkout owner without tenant JWT', () => {
  const req = { user: { role: 'user', email: 'Owner@T.TEST' } };
  assert.equal(
    canFulfillPaymentForTenant(req, { tenantId: TENANT_B, demoEmail: 'owner@t.test' }),
    true
  );
  assert.equal(
    canFulfillPaymentForTenant(req, { tenantId: TENANT_B, demoEmail: 'other@t.test' }),
    false
  );
});

test('rejectUnauthorizedPaymentPoll returns 403 and does not leak status', () => {
  const req = { user: { role: 'admin', tenantId: TENANT_A } };
  const res = mockRes();
  const denied = rejectUnauthorizedPaymentPoll(req, res, { tenantId: TENANT_B, status: 'paid' });
  assert.equal(denied, true);
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.error, 'Not authorized to view this payment');
  assert.equal(res.body.status, undefined);
  assert.equal(res.body.paid, undefined);
});

test('rejectUnauthorizedPaymentPoll allows the owner through', () => {
  const req = { user: { role: 'admin', tenantId: TENANT_A } };
  const res = mockRes();
  const denied = rejectUnauthorizedPaymentPoll(req, res, { tenantId: TENANT_A });
  assert.equal(denied, false);
  assert.equal(res.statusCode, 200);
});
