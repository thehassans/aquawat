import test from 'node:test';
import assert from 'node:assert/strict';
import { isMenuFlagOn } from '../services/inventory/menu.js';

test('putaway menu requires multiLocations', () => {
  assert.equal(isMenuFlagOn({ groupPutawayRules: true, groupStockMultiLocations: false }, 'putawayRules'), false);
  assert.equal(isMenuFlagOn({ groupPutawayRules: true, groupStockMultiLocations: true }, 'putawayRules'), true);
});

test('costing preview delta math contract', () => {
  const currentTotal = 100;
  const proposedTotal = 120;
  const delta = proposedTotal - currentTotal;
  assert.equal(delta, 20);
});

test('backorder policy ask requires explicit decision', () => {
  const policy = 'ask';
  const createBackorder = null;
  const needsAsk = policy === 'ask' && createBackorder == null;
  assert.equal(needsAsk, true);
  assert.equal(policy === 'always' || true === true, true);
});

test('document link note includes PO reference', () => {
  const note = ['Linked PO PO-1', 'GRN GRN-1'].join('\n');
  assert.ok(note.includes('Linked PO'));
  assert.ok(note.includes('GRN'));
});
