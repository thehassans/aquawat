import test from 'node:test';
import assert from 'node:assert/strict';

// Mirror of frontend/src/lib/invList.js for contract coverage
function asInvList(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
}

test('asInvList accepts bare array, data, and items', () => {
  assert.deepEqual(asInvList([{ a: 1 }]), [{ a: 1 }]);
  assert.deepEqual(asInvList({ data: [{ a: 2 }], items: [{ a: 2 }] }), [{ a: 2 }]);
  assert.deepEqual(asInvList({ items: [{ a: 3 }] }), [{ a: 3 }]);
  assert.deepEqual(asInvList(null), []);
  assert.deepEqual(asInvList({}), []);
});
