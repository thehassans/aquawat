import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveTenantId, TenantScopeError } from '../utils/tenantScope.js';

const TENANT_A = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const TENANT_B = 'bbbbbbbbbbbbbbbbbbbbbbbb';

test('tenant JWT ignores spoofed x-tenant-id', () => {
  const id = resolveTenantId({ role: 'admin', tenantId: TENANT_A }, { headers: { 'x-tenant-id': TENANT_B } });
  assert.equal(String(id), TENANT_A);
});

test('firm accountant may use x-tenant-id when listed', () => {
  const id = resolveTenantId(
    { role: 'accountant', tenantId: TENANT_A, firmHomeTenantId: TENANT_A, accessibleTenantIds: [TENANT_A, TENANT_B] },
    { headers: { 'x-tenant-id': TENANT_B } }
  );
  assert.equal(String(id), TENANT_B);
});

test('firm accountant spoofed x-tenant-id outside access falls back to JWT tenant', () => {
  const TENANT_C = 'cccccccccccccccccccccccc';
  const id = resolveTenantId(
    { role: 'accountant', tenantId: TENANT_A, accessibleTenantIds: [TENANT_A] },
    { headers: { 'x-tenant-id': TENANT_C } }
  );
  assert.equal(String(id), TENANT_A);
});

test('super_admin without header uses JWT tenantId when present', () => {
  const id = resolveTenantId({ role: 'super_admin', tenantId: TENANT_A }, { headers: {} });
  assert.equal(String(id), TENANT_A);
});

test('super_admin x-tenant-id wins over JWT tenantId (impersonation)', () => {
  const id = resolveTenantId(
    { role: 'super_admin', tenantId: TENANT_A },
    { headers: { 'x-tenant-id': TENANT_B } }
  );
  assert.equal(String(id), TENANT_B);
});

test('super_admin with no tenant context throws 400', () => {
  assert.throws(
    () => resolveTenantId({ role: 'super_admin' }, { headers: {} }),
    (err) => err instanceof TenantScopeError && err.statusCode === 400
  );
});

test('non-admin without tenantId is 403', () => {
  assert.throws(
    () => resolveTenantId({ role: 'user' }, { headers: {} }),
    (err) => err instanceof TenantScopeError && err.statusCode === 403
  );
});
