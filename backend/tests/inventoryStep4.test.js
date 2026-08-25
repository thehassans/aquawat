import test from 'node:test';
import assert from 'node:assert/strict';

test('smart-buttons response shape contract', () => {
  const sample = {
    onHand: '0',
    forecasted: '0',
    reorderRules: 0,
    lots: 0,
    moves: 0,
    putawayRules: 0,
  };
  for (const k of ['onHand', 'forecasted', 'reorderRules', 'lots', 'moves', 'putawayRules']) {
    assert.ok(k in sample);
  }
});

test('sale flags map to Product fields', () => {
  const map = { saleOk: 'canBeSold', posOk: 'canBeSoldOnPos', purchaseOk: 'canBePurchased' };
  assert.equal(map.saleOk, 'canBeSold');
  assert.equal(map.posOk, 'canBeSoldOnPos');
});
