import test from 'node:test';
import assert from 'node:assert/strict';
import { filterInventoryMenu, isMenuFlagOn } from '../services/inventory/menu.js';

test('isMenuFlagOn defaults multiLocations on when missing', () => {
  assert.equal(isMenuFlagOn({}, 'multiLocations'), true);
  assert.equal(isMenuFlagOn({ groupStockMultiLocations: false }, 'multiLocations'), false);
});

test('filterInventoryMenu hides internal when multiLocations off', () => {
  const admin = { role: 'admin' };
  const items = filterInventoryMenu({ groupStockMultiLocations: false, groupAdvLocation: false }, admin);
  const ops = items.find((i) => i.id === 'operations');
  assert.ok(ops);
  const ids = (ops.children || []).map((c) => c.id);
  assert.ok(!ids.includes('internal'));
  assert.ok(ids.includes('receipts'));
});

test('filterInventoryMenu keeps five top-level roots', () => {
  const items = filterInventoryMenu({}, { role: 'admin' });
  assert.deepEqual(
    items.map((i) => i.id),
    ['overview', 'operations', 'products', 'reporting', 'configuration'],
  );
});
