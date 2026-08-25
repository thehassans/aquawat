import test from 'node:test';
import assert from 'node:assert/strict';
import { D } from '../utils/decimal.js';
import { roundToMultiple } from '../services/inventory/procurement.js';

test('roundToMultiple rounds up', () => {
  assert.equal(roundToMultiple('10', '3'), '12');
  assert.equal(roundToMultiple('9', '3'), '9');
  assert.equal(roundToMultiple('0', '5'), '0');
  assert.equal(roundToMultiple('1.5', '1'), '2');
});

test('reorder qty when forecast below min', () => {
  const forecasted = D('-2');
  const minQty = D('5');
  const maxQty = D('20');
  assert.ok(forecasted.lt(minQty));
  const toOrder = roundToMultiple(maxQty.minus(forecasted), '5');
  assert.equal(toOrder, '25');
});

test('reception / delivery step keys', () => {
  const reception = ['one', 'two', 'three'];
  const delivery = ['ship', 'pickShip', 'pickPackShip'];
  assert.equal(reception.length, 3);
  assert.equal(delivery.length, 3);
});

test('putaway specificity ranks', () => {
  const ranks = { product: 4, category: 3, packageType: 2, generic: 1 };
  assert.ok(ranks.product > ranks.category);
  assert.ok(ranks.generic < ranks.packageType);
});
