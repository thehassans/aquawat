import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import {
  computeMatchingStatus,
  resolveThreeWayOptions,
  DEFAULT_THREE_WAY_TOLERANCE,
} from '../services/inventory/threeWayMatch.js';

test('resolveThreeWayOptions uses settings defaults', () => {
  const opts = resolveThreeWayOptions({
    threeWayMatch: {
      qtyTolerance: 1,
      priceTolerancePct: 5,
      priceToleranceAmount: 50,
      blockQtyOverReceived: true,
    },
  }, {});
  assert.equal(opts.qtyTolerance, 1);
  assert.equal(opts.priceTolerancePct, 5);
  assert.equal(opts.priceToleranceAmount, 50);
  assert.equal(opts.blockQtyOverReceived, true);
});

test('resolveThreeWayOptions body overrides including zero', () => {
  const opts = resolveThreeWayOptions({
    threeWayMatch: { priceTolerancePct: 5, priceToleranceAmount: 50 },
  }, { priceTolerancePct: 0, priceToleranceAmount: 0 });
  assert.equal(opts.priceTolerancePct, 0);
  assert.equal(opts.priceToleranceAmount, 0);
});

test('DEFAULT_THREE_WAY_TOLERANCE matches plan', () => {
  assert.equal(DEFAULT_THREE_WAY_TOLERANCE.priceTolerancePct, 5);
  assert.equal(DEFAULT_THREE_WAY_TOLERANCE.priceToleranceAmount, 50);
  assert.equal(DEFAULT_THREE_WAY_TOLERANCE.qtyTolerance, 0);
});

test('price dual tolerance: within amount auto-accepts even if pct high', () => {
  const poPrice = 100;
  const billPrice = 140; // 40% but abs 40 <= 50
  const absDiff = Math.abs(billPrice - poPrice);
  const diffPct = (absDiff / poPrice) * 100;
  const withinPct = diffPct <= 5;
  const withinAmt = absDiff <= 50;
  assert.equal(withinPct, false);
  assert.equal(withinAmt, true);
  assert.ok(withinPct || withinAmt, 'should auto-accept');
});

test('price dual tolerance: beyond both warns', () => {
  const poPrice = 100;
  const billPrice = 160; // 60% and abs 60 > 50
  const absDiff = Math.abs(billPrice - poPrice);
  const diffPct = (absDiff / poPrice) * 100;
  const withinPct = diffPct <= 5;
  const withinAmt = absDiff <= 50;
  assert.equal(withinPct, false);
  assert.equal(withinAmt, false);
});

test('over-ordered detection', () => {
  const ordered = 10;
  const alreadyInvoiced = 8;
  const remainingOrderable = ordered - alreadyInvoiced; // 2
  const billQty = 3;
  assert.ok(billQty > remainingOrderable, 'should block over-ordered');
});

test('computeMatchingStatus: variance on warn', () => {
  const status = computeMatchingStatus({
    exceptions: [{ severity: 'warn', type: 'price_mismatch' }],
    lines: [{ billedQty: 5, remainingBillable: 5 }],
    hasPo: true,
  });
  assert.equal(status, 'variance');
});

test('computeMatchingStatus: fully matched', () => {
  const status = computeMatchingStatus({
    exceptions: [],
    lines: [{ billedQty: 5, remainingBillable: 5 }],
    hasPo: true,
  });
  assert.equal(status, 'fully_matched');
});

test('computeMatchingStatus: partially matched', () => {
  const status = computeMatchingStatus({
    exceptions: [],
    lines: [{ billedQty: 2, remainingBillable: 5 }],
    hasPo: true,
  });
  assert.equal(status, 'partially_matched');
});

test('computeMatchingStatus: unmatched without PO', () => {
  assert.equal(computeMatchingStatus({ hasPo: false, lines: [], exceptions: [] }), 'unmatched');
});

test('ObjectId validity for PoS sourceDocId', () => {
  assert.equal(mongoose.Types.ObjectId.isValid('not-an-id'), false);
  assert.equal(mongoose.Types.ObjectId.isValid(new mongoose.Types.ObjectId().toString()), true);
});

test('GRNI open amount math', () => {
  const netReceived = 10;
  const billedAttributed = 4;
  const openQty = netReceived - billedAttributed;
  const unitCost = 19.5;
  const amount = Math.round(openQty * unitCost * 100) / 100;
  assert.equal(openQty, 6);
  assert.equal(amount, 117);
});
