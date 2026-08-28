import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PurchasesValidationError,
  applyGrnReceiveToPoLines,
  applyReturnToReceivedLines,
  allocateLandedCosts,
  remainingReceivable,
  remainingReturnable,
  stockDeltaForLine,
  round2,
  computePurchaseLineTotals,
  buildOpenReceiveLines,
  summarizeOpenPo,
  assertDelayedLines,
  buildPoReceivingLedger,
  matchPurchaseLine,
} from '../services/purchasesLogic.js';

const poLines = () => ([
  { productId: 'g1', productType: 'goods', quantityOrdered: 10, quantityReceived: 0, unitCost: 20 },
  { productId: 's1', productType: 'service', quantityOrdered: 2, quantityReceived: 0, unitCost: 100 },
]);

test('PO line totals recompute subtotal, tax, and grand total from qty/cost/tax', () => {
  const totals = computePurchaseLineTotals([
    { quantityOrdered: 1, unitCost: 1000, taxRate: 15 },
    { quantityOrdered: 2, unitCost: 50, taxRate: 0 },
  ]);
  assert.equal(totals.subtotal, 1100);
  assert.equal(totals.totalTax, 150);
  assert.equal(totals.grandTotal, 1250);
  assert.equal(totals.lines[0].lineTotal, 1150);
});

test('GRN supports receiving extra quantity as gift or supplier bonus', () => {
  const first = applyGrnReceiveToPoLines(poLines(), [{ productId: 'g1', quantityReceived: 6 }]);
  assert.equal(first.lines[0].quantityReceived, 6);
  assert.equal(first.status, 'partially_received');
  assert.equal(remainingReceivable(first.lines[0]), 4);

  // Supplier sends 5 more (total 11 received on 10 ordered)
  const second = applyGrnReceiveToPoLines(first.lines, [{ productId: 'g1', quantityReceived: 5 }]);
  assert.equal(second.lines[0].quantityReceived, 11);
  assert.equal(second.applied[0].quantity, 5);
  assert.equal(second.status, 'received');
  assert.equal(remainingReceivable(second.lines[0]), 0);
});

test('return cannot exceed received minus already returned', () => {
  const received = [{ productId: 'g1', productType: 'goods', quantityReceived: 8, quantityReturned: 2 }];
  const ok = applyReturnToReceivedLines(received, [{ productId: 'g1', quantityReturned: 5 }]);
  assert.equal(ok.lines[0].quantityReturned, 7);
  assert.equal(remainingReturnable(ok.lines[0]), 1);

  assert.throws(
    () => applyReturnToReceivedLines(ok.lines, [{ productId: 'g1', quantityReturned: 2 }]),
    (err) => err instanceof PurchasesValidationError && err.code === 'OVER_RETURN'
  );
});

test('stock increment/decrement is called for goods and skipped for services', () => {
  assert.equal(stockDeltaForLine({ productType: 'goods', quantity: 4, direction: 'in' }), 4);
  assert.equal(stockDeltaForLine({ productType: 'goods', quantity: 3, direction: 'out' }), -3);
  assert.equal(stockDeltaForLine({ productType: 'service', quantity: 9, direction: 'in' }), 0);
  assert.equal(stockDeltaForLine({ productType: 'service', quantity: 9, direction: 'out' }), 0);
});

test('landed cost unit landed and total unit include PO unit cost', () => {
  const { allocations } = allocateLandedCosts({
    totalCost: 10,
    method: 'by_value',
    allocations: [
      { productId: 'a', quantity: 1, lineValue: 100, unitCostBeforeLanded: 100 },
    ],
  });
  assert.equal(allocations[0].allocatedCost, 10);
  assert.equal(allocations[0].unitLandedCost, 10);
  assert.equal(allocations[0].totalLandedUnitCost, 110);
});

test('landed cost allocation by value sums to the extra cost', () => {
  const { allocations, totalAllocated } = allocateLandedCosts({
    totalCost: 100,
    method: 'by_value',
    allocations: [
      { productId: 'a', quantity: 2, lineValue: 60, unitCostBeforeLanded: 30 },
      { productId: 'b', quantity: 4, lineValue: 40, unitCostBeforeLanded: 10 },
    ],
  });
  assert.equal(totalAllocated, 100);
  assert.equal(round2(allocations[0].allocatedCost + allocations[1].allocatedCost), 100);
  assert.equal(allocations[0].allocatedCost, 60);
  assert.equal(allocations[1].allocatedCost, 40);
});

test('landed cost allocation absorbs rounding on the last line', () => {
  const { allocations, totalAllocated } = allocateLandedCosts({
    totalCost: 10,
    method: 'by_value',
    allocations: [
      { productId: 'a', quantity: 1, lineValue: 1 },
      { productId: 'b', quantity: 1, lineValue: 1 },
      { productId: 'c', quantity: 1, lineValue: 1 },
    ],
  });
  assert.equal(totalAllocated, 10);
  assert.equal(round2(allocations.reduce((sum, row) => sum + row.allocatedCost, 0)), 10);
});

test('open receive lines skip fully received qty and keep remaining cost', () => {
  const summary = summarizeOpenPo({
    lineItems: [
      { productId: { _id: 'g1', nameEn: 'Rice', barcode: '1', unitOfMeasure: 'KG' }, quantityOrdered: 10, quantityReceived: 4, unitCost: 12 },
      { manualName: 'Done', quantityOrdered: 2, quantityReceived: 2, unitCost: 5 },
    ],
  });
  assert.equal(summary.remainingQty, 6);
  assert.equal(summary.remainingValue, 72);
  assert.equal(buildOpenReceiveLines({ lineItems: summary.lines }).length, 1);
});

test('each delayed GRN line must have its own delay reason', () => {
  assert.doesNotThrow(() => assertDelayedLines([
    { isDelayed: true, delayReason: 'Customs hold' },
    { isDelayed: false },
  ]));
  assert.throws(
    () => assertDelayedLines([{ isDelayed: true, delayReason: '  ' }]),
    (err) => err instanceof PurchasesValidationError && err.code === 'DELAY_REASON_REQUIRED'
  );
});

test('PO receiving ledger keeps a reason and note per delayed line', () => {
  const ledger = buildPoReceivingLedger({
    lineItems: [
      { productId: { _id: 'g1', nameEn: 'Gloves', nameAr: 'قفازات' }, quantityOrdered: 10, quantityReceived: 4 },
      { productId: { _id: 'g2', nameEn: 'Helmet' }, quantityOrdered: 2, quantityReceived: 0 },
    ],
    grns: [{
      _id: 'grn1',
      grnNumber: 'GRN-1',
      status: 'received',
      dateReceived: '2026-08-16',
      lines: [
        { productId: 'g1', productName: 'Gloves', quantityReceived: 4, isDelayed: false },
        { productId: 'g1', productName: 'Gloves', quantityOrdered: 3, quantityReceived: 0, isDelayed: true, delayedUntil: '2026-08-20', delayReason: 'Harmoz', notes: 'Waiting on next vessel' },
        { productId: 'g2', productName: 'Helmet', quantityOrdered: 2, quantityReceived: 0, isDelayed: true, delayedUntil: '2026-08-22', delayReason: 'Supplier shortage', notes: 'Partial crate' },
      ],
    }],
  });
  assert.equal(ledger.receivedCount, 1);
  assert.equal(ledger.delayedCount, 2);
  assert.equal(ledger.lines[0].receivedEvents[0].quantity, 4);
  assert.equal(ledger.lines[0].delayedEvents[0].delayReason, 'Harmoz');
  assert.equal(ledger.lines[0].delayedEvents[0].notes, 'Waiting on next vessel');
  assert.equal(ledger.lines[1].delayedEvents[0].delayReason, 'Supplier shortage');
});

test('PO receiving ledger matches variant lines separately', () => {
  const ledger = buildPoReceivingLedger({
    lineItems: [
      { productId: { _id: 'p1', nameEn: 'Shirt' }, variantId: 'v-red', quantityOrdered: 5, quantityReceived: 0 },
      { productId: { _id: 'p1', nameEn: 'Shirt' }, variantId: 'v-blue', quantityOrdered: 3, quantityReceived: 0 },
    ],
    grns: [{
      _id: 'grn1',
      grnNumber: 'GRN-2',
      status: 'received',
      lines: [
        { productId: 'p1', variantId: 'v-red', productName: 'Shirt Red', quantityReceived: 2, isDelayed: false },
        { productId: 'p1', variantId: 'v-blue', productName: 'Shirt Blue', quantityReceived: 1, isDelayed: false },
      ],
    }],
  });
  assert.equal(ledger.lines[0].variantId, 'v-red');
  assert.equal(ledger.lines[0].receivedEvents.length, 1);
  assert.equal(ledger.lines[0].receivedEvents[0].quantityReceived, 2);
  assert.equal(ledger.lines[1].variantId, 'v-blue');
  assert.equal(ledger.lines[1].receivedEvents.length, 1);
  assert.equal(ledger.lines[1].receivedEvents[0].quantityReceived, 1);
});

test('matchPurchaseLine prefers variant when both sides specify it', () => {
  assert.equal(matchPurchaseLine(
    { productId: 'p1', variantId: 'v1' },
    { productId: 'p1', variantId: 'v1' },
  ), true);
  assert.equal(matchPurchaseLine(
    { productId: 'p1', variantId: 'v1' },
    { productId: 'p1', variantId: 'v2' },
  ), false);
});
