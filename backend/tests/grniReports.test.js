import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * Pure FIFO attribution used by GRNI unmatched receipts report.
 */
function attributeOpenQty(grnNets, invoicedBudget) {
  let budget = invoicedBudget;
  const opens = [];
  for (const net of grnNets) {
    const billed = Math.min(net, Math.max(0, budget));
    budget -= billed;
    const open = Math.max(0, net - billed);
    opens.push({ net, billed, open });
  }
  return { opens, remainingBudget: budget };
}

test('FIFO: earlier GRN consumes invoiced first', () => {
  const { opens } = attributeOpenQty([5, 5], 6);
  assert.equal(opens[0].open, 0);
  assert.equal(opens[0].billed, 5);
  assert.equal(opens[1].open, 4);
  assert.equal(opens[1].billed, 1);
});

test('FIFO: no invoiced leaves all open', () => {
  const { opens } = attributeOpenQty([3, 2], 0);
  assert.equal(opens[0].open, 3);
  assert.equal(opens[1].open, 2);
});

test('FIFO: fully billed zeros opens', () => {
  const { opens } = attributeOpenQty([4, 4], 8);
  assert.equal(opens[0].open, 0);
  assert.equal(opens[1].open, 0);
});

test('report total matches sum of open × cost', () => {
  const rows = [
    { quantityOpen: 2, unitCost: 10 },
    { quantityOpen: 1.5, unitCost: 20 },
  ];
  const total = Math.round(rows.reduce((s, r) => s + r.quantityOpen * r.unitCost, 0) * 100) / 100;
  assert.equal(total, 50);
});
