import test from 'node:test';
import assert from 'node:assert/strict';
import { D, decStr } from '../utils/decimal.js';
import { consumeFifoLayers } from '../services/inventory/valuation.js';
import { splitLandedCostAmounts } from '../services/inventory/landedCost.js';
import {
  buildValuationJournalLines,
  buildLandedCostJournalLines,
  buildPurchaseBillClearingLines,
} from '../services/inventory/stockAccounting.js';

test('FIFO consume takes oldest layers first', () => {
  const layers = [
    { _id: 'a', remainingQty: '10', remainingValue: '100', unitCost: '10' },
    { _id: 'b', remainingQty: '5', remainingValue: '60', unitCost: '12' },
  ];
  const { totalCost, updates } = consumeFifoLayers(layers, '12', '0');
  assert.equal(decStr(totalCost), '124'); // 10*10 + 2*12
  assert.equal(updates[0].remainingQty, '0');
  assert.equal(updates[1].remainingQty, '3');
});

test('FIFO fallback uses standard when layers exhausted', () => {
  const layers = [
    { _id: 'a', remainingQty: '2', remainingValue: '20', unitCost: '10' },
  ];
  const { totalCost } = consumeFifoLayers(layers, '5', '8');
  assert.equal(decStr(totalCost), '44'); // 20 + 3*8
});

test('landed cost split by quantity', () => {
  const products = [
    { productId: 'p1', quantity: D(10), weight: D(0), volume: D(0), cost: D(0) },
    { productId: 'p2', quantity: D(30), weight: D(0), volume: D(0), cost: D(0) },
  ];
  const map = splitLandedCostAmounts(products, [
    { price: '100', splitMethod: 'byQuantity' },
  ]);
  assert.equal(decStr(map.get('p1')), '25');
  assert.equal(decStr(map.get('p2')), '75');
});

test('valuation journal in/out balanced', () => {
  const inventory = { _id: 'inv', code: '1300' };
  const stockInput = { _id: 'in', code: '1310' };
  const stockOutput = { _id: 'out', code: '1320' };

  const inLines = buildValuationJournalLines({
    direction: 'in',
    amount: 150.5,
    inventory,
    stockInput,
  });
  assert.equal(inLines.length, 2);
  assert.equal(inLines[0].debit + inLines[1].debit, inLines[0].credit + inLines[1].credit);

  const outLines = buildValuationJournalLines({
    direction: 'out',
    amount: 40,
    inventory,
    stockOutput,
  });
  assert.equal(outLines[0].debit, 40);
  assert.equal(outLines[1].credit, 40);
});

test('landed cost journal lines', () => {
  const lines = buildLandedCostJournalLines({
    amount: 99,
    inventory: { _id: 'i', code: '1300' },
    landedCredit: { _id: 'l', code: '2200' },
  });
  assert.equal(lines[0].debit, 99);
  assert.equal(lines[1].credit, 99);
});

test('purchase bill clearing with interim', () => {
  const lines = buildPurchaseBillClearingLines({
    netAmount: 100,
    taxAmount: 15,
    stockInput: { _id: 'si', code: '1310' },
    inventory: { _id: 'inv', code: '1300' },
    ap: { _id: 'ap', code: '2000' },
    vatInput: { _id: 'vat', code: '1400' },
    useInterim: true,
  });
  const debit = lines.reduce((s, l) => s + l.debit, 0);
  const credit = lines.reduce((s, l) => s + l.credit, 0);
  assert.equal(debit, credit);
  assert.equal(credit, 115);
});
