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
} from '../services/purchasesLogic.js';

const poLines = () => ([
  { productId: 'g1', productType: 'goods', quantityOrdered: 10, quantityReceived: 0, unitCost: 20 },
  { productId: 's1', productType: 'service', quantityOrdered: 2, quantityReceived: 0, unitCost: 100 },
]);

test('GRN cannot over-receive remaining PO quantity', () => {
  const first = applyGrnReceiveToPoLines(poLines(), [{ productId: 'g1', quantityReceived: 6 }]);
  assert.equal(first.lines[0].quantityReceived, 6);
  assert.equal(first.status, 'partially_received');
  assert.equal(remainingReceivable(first.lines[0]), 4);

  assert.throws(
    () => applyGrnReceiveToPoLines(first.lines, [{ productId: 'g1', quantityReceived: 5 }]),
    (err) => err instanceof PurchasesValidationError && err.code === 'OVER_RECEIVE'
  );
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
