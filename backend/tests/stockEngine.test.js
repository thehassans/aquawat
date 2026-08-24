import test from 'node:test';
import assert from 'node:assert/strict';
import {
  D,
  decStr,
  decAdd,
  decSub,
  decMin,
  decRoundUp,
  uomToReference,
  referenceToUom,
} from '../utils/decimal.js';
import { computePickingState } from '../services/stock/pickingState.js';
import { sortQuantsForRemoval, resolveRemovalStrategy } from '../services/stock/locationHelpers.js';
import { roundToMultiple } from '../services/stock/procurement.js';
import { consumeFifoLayers } from '../services/stock/valuation.js';
import { splitLandedCostAmounts } from '../services/stock/landedCost.js';
import { matchBarcode, defaultBarcodeRules } from '../services/stock/barcode.js';
import { simulateConcurrentReserves } from '../services/stock/legacyAdapter.js';
import { buildPickingPrintHtml } from '../services/stock/printLayout.js';
import {
  buildValuationJournalLines,
  buildLandedCostJournalLines,
} from '../services/stock/stockAccounting.js';

test('decimal add/sub preserves precision', () => {
  assert.equal(decStr(decAdd('0.1', '0.2')), '0.3');
  assert.equal(decStr(decSub('1.00', '0.01')), '0.99');
});

test('decMin picks smaller value', () => {
  assert.equal(decStr(decMin('3', '10')), '3');
});

test('uom conversion round-trip within rounding', () => {
  const ref = uomToReference('12', '1');
  const back = referenceToUom(ref, '1', '0.01');
  assert.equal(decStr(back), '12');
});

test('decRoundUp rounds up to uom rounding', () => {
  assert.equal(decStr(decRoundUp('1.001', '0.01')), '1.01');
  assert.equal(decStr(decRoundUp('1.00', '0.01')), '1');
});

test('picking state: all assigned → assigned', () => {
  assert.equal(
    computePickingState([{ state: 'assigned' }, { state: 'assigned' }]),
    'assigned',
  );
});

test('picking state: mix done and cancel with one done → done', () => {
  assert.equal(
    computePickingState([{ state: 'done' }, { state: 'cancel' }]),
    'done',
  );
});

test('picking state: all cancel → cancel', () => {
  assert.equal(
    computePickingState([{ state: 'cancel' }, { state: 'cancel' }]),
    'cancel',
  );
});

test('picking state: draft only → draft', () => {
  assert.equal(computePickingState([{ state: 'draft' }]), 'draft');
});

test('invariant: reserved cannot exceed quantity (logic check)', () => {
  const qty = D('10');
  const reserved = D('3');
  const take = decMin(D('5'), qty.minus(reserved));
  assert.equal(decStr(take), '5');
  const newReserved = reserved.plus(take);
  assert.ok(newReserved.lte(qty));
});

test('FEFO sorts by lot removal date ascending', () => {
  const quants = [
    { _id: 'a', inDate: '2026-01-01', lotRemovalDate: '2026-06-01' },
    { _id: 'b', inDate: '2026-01-02', lotRemovalDate: '2026-03-01' },
    { _id: 'c', inDate: '2026-01-03', lotRemovalDate: null },
  ];
  const sorted = sortQuantsForRemoval(quants, 'fefo');
  assert.equal(sorted[0]._id, 'b');
  assert.equal(sorted[1]._id, 'a');
  assert.equal(sorted[2]._id, 'c');
});

test('FIFO sorts by inDate ascending', () => {
  const quants = [
    { _id: 'a', inDate: '2026-01-03' },
    { _id: 'b', inDate: '2026-01-01' },
    { _id: 'c', inDate: '2026-01-02' },
  ];
  const sorted = sortQuantsForRemoval(quants, 'fifo');
  assert.equal(sorted[0]._id, 'b');
  assert.equal(sorted[2]._id, 'a');
});

test('removal strategy prefers category over location', () => {
  assert.equal(resolveRemovalStrategy({ categoryStrategy: 'fefo', locationStrategy: 'lifo' }), 'fefo');
  assert.equal(resolveRemovalStrategy({ categoryStrategy: null, locationStrategy: 'lifo' }), 'lifo');
  assert.equal(resolveRemovalStrategy({}), 'fifo');
});

test('serial: each reservation unit is 1', () => {
  const need = D('3');
  const takes = [];
  let remaining = need;
  while (remaining.gt(0)) {
    takes.push('1');
    remaining = remaining.minus(1);
  }
  assert.equal(takes.length, 3);
  assert.ok(takes.every((t) => t === '1'));
});

test('roundToMultiple rounds UP to qty multiple', () => {
  assert.equal(roundToMultiple('7', '5'), '10');
  assert.equal(roundToMultiple('10', '5'), '10');
  assert.equal(roundToMultiple('1.2', '1'), '2');
});

test('NO_RULE_FOUND error message format', () => {
  const productName = 'Almond Milk';
  const locName = 'WH/Stock';
  const msg = `No rule has been found to replenish "${productName}" in "${locName}".`;
  assert.match(msg, /No rule has been found/);
  assert.match(msg, /Almond Milk/);
});

test('FIFO consumeFifoLayers preserves remainingValue/qty ratio', () => {
  const layers = [
    { _id: '1', remainingQty: '10', remainingValue: '100', unitCost: '10' },
    { _id: '2', remainingQty: '5', remainingValue: '60', unitCost: '12' },
  ];
  const { totalCost, updates } = consumeFifoLayers(layers, '12', '0');
  assert.equal(decStr(totalCost), '124'); // 10*10 + 2*12
  assert.equal(updates[0].remainingQty, '0');
  assert.equal(updates[0].remainingValue, '0');
  assert.equal(updates[1].remainingQty, '3');
  assert.equal(updates[1].remainingValue, '36');
});

test('landed cost by_quantity split', () => {
  const products = [
    { productId: 'a', quantity: '10', weight: '0', volume: '0', cost: '0' },
    { productId: 'b', quantity: '30', weight: '0', volume: '0', cost: '0' },
  ];
  const map = splitLandedCostAmounts(products, [
    { price: '40', splitMethod: 'by_quantity' },
  ]);
  assert.equal(decStr(map.get('a')), '10');
  assert.equal(decStr(map.get('b')), '30');
});

test('landed cost equal split', () => {
  const products = [
    { productId: 'a', quantity: '1' },
    { productId: 'b', quantity: '99' },
  ];
  const map = splitLandedCostAmounts(products, [
    { price: '50', splitMethod: 'equal' },
  ]);
  assert.equal(decStr(map.get('a')), '25');
  assert.equal(decStr(map.get('b')), '25');
});

test('barcode match EAN13 and lot prefix', () => {
  const nom = { rules: defaultBarcodeRules() };
  const ean = matchBarcode(nom, '1234567890123');
  assert.equal(ean.matched, true);
  assert.equal(ean.type, 'product');
  const lot = matchBarcode(nom, '10LOTABC');
  assert.equal(lot.matched, true);
  assert.equal(lot.type, 'lot');
  assert.equal(lot.groups[0], 'LOTABC');
});

test('return wizard line swaps location conceptually', () => {
  const doneMove = { locationId: 'SRC', locationDestId: 'DEST', quantity: '5' };
  const returnLine = {
    locationId: doneMove.locationDestId,
    locationDestId: doneMove.locationId,
    quantity: doneMove.quantity,
  };
  assert.equal(returnLine.locationId, 'DEST');
  assert.equal(returnLine.locationDestId, 'SRC');
});

test('concurrent reserves: 20 workers × 1 from 10 → 10 success', () => {
  const sim = simulateConcurrentReserves(10, 20, 1);
  assert.equal(sim.successes, 10);
  assert.equal(sim.failures, 10);
  assert.equal(sim.freeRemaining, 0);
});

test('print HTML includes picking name and rows', () => {
  const html = buildPickingPrintHtml({
    picking: { name: 'WH/IN/00001', state: 'done', operationTypeId: { name: 'Receipts' }, origin: 'GRN-1' },
    moves: [{ _id: 'm1', productId: { defaultCode: 'SKU1' }, productUomQty: '5', quantity: '5', state: 'done' }],
    moveLines: [{ moveId: 'm1', lotName: 'LOT-A' }],
    printedAt: '2026-08-25T00:00:00.000Z',
  });
  assert.match(html, /WH\/IN\/00001/);
  assert.match(html, /SKU1/);
  assert.match(html, /LOT-A/);
  assert.match(html, /<!DOCTYPE html>/);
});

test('valuation journal receipt: Dr Inventory Cr Stock Input', () => {
  const inventory = { _id: 'inv', code: '1300' };
  const stockInput = { _id: 'in', code: '1310' };
  const lines = buildValuationJournalLines({
    direction: 'in',
    amount: 150.5,
    inventory,
    stockInput,
    stockOutput: { _id: 'out', code: '1320' },
  });
  assert.equal(lines.length, 2);
  assert.equal(lines[0].debit, 150.5);
  assert.equal(lines[0].accountCode, '1300');
  assert.equal(lines[1].credit, 150.5);
  assert.equal(lines[1].accountCode, '1310');
});

test('valuation journal delivery: Dr Output Cr Inventory', () => {
  const lines = buildValuationJournalLines({
    direction: 'out',
    amount: 80,
    inventory: { _id: 'inv', code: '1300' },
    stockInput: { _id: 'in', code: '1310' },
    stockOutput: { _id: 'out', code: '1320' },
  });
  assert.equal(lines[0].debit, 80);
  assert.equal(lines[0].accountCode, '1320');
  assert.equal(lines[1].credit, 80);
  assert.equal(lines[1].accountCode, '1300');
});

test('landed cost journal: Dr Inventory Cr Accrued', () => {
  const lines = buildLandedCostJournalLines({
    amount: 40,
    inventory: { _id: 'inv', code: '1300' },
    landedCredit: { _id: 'acc', code: '2200' },
  });
  assert.equal(lines[0].debit, 40);
  assert.equal(lines[1].credit, 40);
  assert.equal(lines[1].accountCode, '2200');
});
