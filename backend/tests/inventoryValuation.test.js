import test from 'node:test';
import assert from 'node:assert/strict';
import { D, decStr } from '../utils/decimal.js';
import { consumeFifoLayers, computeAverageCost } from '../services/inventory/valuation.js';
import { splitLandedCostAmounts } from '../services/inventory/landedCost.js';
import {
  buildValuationJournalLines,
  buildLandedCostJournalLines,
  buildMultiLandedCostJournalLines,
  buildPurchaseBillClearingLines,
  preferredStockAccountIds,
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

test('AVCO: buy 10@10 then 10@13 averages to 11.5', () => {
  const afterFirst = computeAverageCost({
    qtyBefore: 0,
    oldAvg: 0,
    incomingQty: 10,
    unitCost: 10,
  });
  assert.equal(decStr(afterFirst), '10');

  const afterSecond = computeAverageCost({
    qtyBefore: 10,
    oldAvg: 10,
    incomingQty: 10,
    unitCost: 13,
  });
  assert.equal(decStr(afterSecond), '11.5');
});

test('AVCO after partial consume uses remaining on-hand', () => {
  // Had 20 @ 11.5, sold 5 → 15 left; buy 5 @ 20 → (15*11.5 + 5*20) / 20 = 13.625
  const avg = computeAverageCost({
    qtyBefore: 15,
    oldAvg: '11.5',
    incomingQty: 5,
    unitCost: 20,
  });
  assert.equal(decStr(avg), '13.625');
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

test('preferred stock accounts: product beats category beats location beats settings', () => {
  const ids = preferredStockAccountIds('inventory', {
    product: { stockValuationAccountId: 'prod' },
    category: { stockValuationAccountId: 'cat' },
    location: { stockValuationAccountId: 'loc' },
    settings: { propertyStockValuationAccountId: 'set' },
  });
  assert.deepEqual(ids, ['prod', 'cat', 'loc', 'set']);

  const withoutProduct = preferredStockAccountIds('inventory', {
    category: { stockValuationAccountId: 'cat' },
    location: { stockValuationAccountId: 'loc' },
    settings: { propertyStockValuationAccountId: 'set' },
  });
  assert.equal(withoutProduct.find((x) => x), 'cat');
});

test('preferred stock output includes expense fallbacks after output accounts', () => {
  const ids = preferredStockAccountIds('stockOutput', {
    product: { expenseAccountId: 'prod-exp' },
    category: { stockOutputAccountId: 'cat-out', expenseAccountId: 'cat-exp' },
    location: { stockOutputAccountId: 'loc-out' },
    settings: { propertyStockOutputAccountId: 'set-out' },
  });
  assert.deepEqual(ids, [undefined, 'prod-exp', 'cat-out', 'cat-exp', 'loc-out', 'set-out']);
});

test('multi landed cost merges inventory accounts and balances credit', () => {
  const lines = buildMultiLandedCostJournalLines({
    segments: [
      { amount: 40, inventory: { _id: 'inv-a', code: '1300' } },
      { amount: 60, inventory: { _id: 'inv-b', code: '1301' } },
      { amount: 10, inventory: { _id: 'inv-a', code: '1300' } },
    ],
    landedCredit: { _id: 'lc', code: '2200' },
  });
  assert.equal(lines.length, 3);
  const debitA = lines.find((l) => l.accountId === 'inv-a');
  assert.equal(debitA.debit, 50);
  const credit = lines.find((l) => l.credit > 0);
  assert.equal(credit.credit, 110);
});

test('purchase bill clearing with per-product goods debits', () => {
  const lines = buildPurchaseBillClearingLines({
    netAmount: 100,
    taxAmount: 15,
    ap: { _id: 'ap', code: '2000' },
    vatInput: { _id: 'vat', code: '1400' },
    goodsDebits: [
      { account: { _id: 'si1', code: '1310' }, amount: 70 },
      { account: { _id: 'si2', code: '1311' }, amount: 30 },
    ],
  });
  const debit = lines.reduce((s, l) => s + l.debit, 0);
  const credit = lines.reduce((s, l) => s + l.credit, 0);
  assert.equal(debit, credit);
  assert.equal(credit, 115);
  assert.equal(lines.filter((l) => l.debit > 0 && l.accountCode !== '1400').length, 2);
});

test('assertAutomatedCategoryAccounts requires five fields when automated', async () => {
  const { assertAutomatedCategoryAccounts } = await import('../services/inventory/stockAccounting.js');
  assert.throws(
    () => assertAutomatedCategoryAccounts({ valuationMode: 'automated' }),
    (err) => err?.code === 'CAT_ACCOUNTS_REQUIRED',
  );
  assert.doesNotThrow(() => assertAutomatedCategoryAccounts({
    valuationMode: 'automated',
    stockValuationAccountId: 'a',
    stockInputAccountId: 'b',
    stockOutputAccountId: 'c',
    stockJournalId: 'd',
    expenseAccountId: 'e',
  }));
  assert.doesNotThrow(() => assertAutomatedCategoryAccounts({ valuationMode: 'manual' }));
});
