import test from 'node:test';
import assert from 'node:assert/strict';
import {
  D, decStr, decRoundUp, decRoundDown, decRoundMoney, uomToReference, referenceToUom,
} from '../utils/decimal.js';
import { deriveTransferState } from '../services/inventory/transferState.js';
import { sortQuantsForRemoval, resolveRemovalStrategy } from '../services/inventory/locationHelpers.js';

test('decimal: money half-up', () => {
  assert.equal(decStr(decRoundMoney('10.015')), '10.02');
  assert.equal(decStr(decRoundMoney('10.014')), '10.01');
});

test('decimal: consumption rounds up', () => {
  assert.equal(decStr(decRoundUp('1.001', '0.01')), '1.01');
  assert.equal(decStr(decRoundUp('1.000', '0.01')), '1');
});

test('decimal: reservation take rounds down', () => {
  assert.equal(decStr(decRoundDown('1.019', '0.01')), '1.01');
});

test('decimal: uom round-trip within precision', () => {
  const ref = uomToReference('10', '2'); // bigger uom factor 2 → 5 ref
  assert.equal(decStr(ref), '5');
  const back = referenceToUom(ref, '2', '0.01');
  assert.equal(decStr(back), '10');
});

test('transfer state derived from moves', () => {
  assert.equal(deriveTransferState([]), 'draft');
  assert.equal(deriveTransferState([{ state: 'cancelled' }, { state: 'cancelled' }]), 'cancelled');
  assert.equal(deriveTransferState([{ state: 'draft' }, { state: 'draft' }]), 'draft');
  assert.equal(deriveTransferState([{ state: 'done' }, { state: 'cancelled' }]), 'done');
  assert.equal(deriveTransferState([{ state: 'assigned' }, { state: 'assigned' }]), 'assigned');
  assert.equal(deriveTransferState([{ state: 'confirmed' }, { state: 'confirmed' }]), 'confirmed');
  assert.equal(deriveTransferState([{ state: 'waiting' }, { state: 'confirmed' }]), 'waiting');
});

test('removal strategy fifo/lifo ordering', () => {
  assert.equal(resolveRemovalStrategy({}), 'fifo');
  const quants = [
    { _id: 'b', inDate: new Date('2024-02-01') },
    { _id: 'a', inDate: new Date('2024-01-01') },
  ];
  const fifo = sortQuantsForRemoval(quants, 'fifo');
  assert.equal(fifo[0]._id, 'a');
  const lifo = sortQuantsForRemoval(quants, 'lifo');
  assert.equal(lifo[0]._id, 'b');
});

test('FEFO sorts by lot removal date nulls last', () => {
  const quants = [
    { _id: 'late', inDate: new Date('2024-01-01'), lotRemovalDate: new Date('2025-06-01') },
    { _id: 'soon', inDate: new Date('2024-02-01'), lotRemovalDate: new Date('2025-01-01') },
    { _id: 'none', inDate: new Date('2024-01-15'), lotRemovalDate: null },
  ];
  const fefo = sortQuantsForRemoval(quants, 'fefo');
  assert.equal(fefo[0]._id, 'soon');
  assert.equal(fefo[1]._id, 'late');
  assert.equal(fefo[2]._id, 'none');
});

test('mirror invariant helper: string equals Decimal', () => {
  const q = '12.5';
  assert.equal(decStr(D(q)), q);
});
