import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const routesDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../routes');

function walk(dir, acc = []) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walk(full, acc);
    else if (name.endsWith('.js')) acc.push(full);
  }
  return acc;
}

test('every router.use(tenantFilter) is followed by requireTenantFilter', () => {
  const missing = [];
  for (const file of walk(routesDir)) {
    const src = fs.readFileSync(file, 'utf8');
    if (!src.includes('router.use(tenantFilter)')) continue;
    if (!src.includes('router.use(requireTenantFilter)')) {
      missing.push(path.relative(routesDir, file).replaceAll('\\', '/'));
    }
  }
  assert.deepEqual(missing, []);
});

test('req.user.tenantId without requireTenantFilter stays on the known allowlist', () => {
  const allowed = new Set(['payment.routes.js']);
  const unexpected = [];
  for (const file of walk(routesDir)) {
    const rel = path.relative(routesDir, file).replaceAll('\\', '/');
    const src = fs.readFileSync(file, 'utf8');
    const usesCallerTenant =
      src.includes('req.user.tenantId') || src.includes('req.user?.tenantId');
    if (!usesCallerTenant) continue;
    if (src.includes('requireTenantFilter') || src.includes('resolveTenantId')) continue;
    if (!allowed.has(rel)) unexpected.push(rel);
  }
  assert.deepEqual(unexpected, []);
});
