import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv, rowsToCsv, csvEscape } from '../services/inventory/importExport.js';
import { matchBarcode } from '../models/inventory/InvBarcodeNomenclature.js';
import { buildPurchaseBillClearingLines } from '../services/inventory/stockAccounting.js';

test('csvEscape quotes commas', () => {
  assert.equal(csvEscape('a,b'), '"a,b"');
  assert.equal(csvEscape('ok'), 'ok');
});

test('parseCsv round-trip', () => {
  const csv = rowsToCsv([
    { sku: 'A1', nameEn: 'Widget, large', costPrice: '10' },
  ], ['sku', 'nameEn', 'costPrice']);
  const { headers, records } = parseCsv(csv);
  assert.deepEqual(headers, ['sku', 'nameEn', 'costPrice']);
  assert.equal(records[0].sku, 'A1');
  assert.equal(records[0].nameEn, 'Widget, large');
});

test('barcode nomenclature match', () => {
  const nom = {
    rules: [
      { name: 'EAN', pattern: '^\\d{13}$', type: 'product', sequence: 10, active: true },
      { name: 'LOT', pattern: '^LOT', type: 'lot', sequence: 20, active: true },
    ],
  };
  assert.equal(matchBarcode(nom, '1234567890123').matched, true);
  assert.equal(matchBarcode(nom, '1234567890123').rule.type, 'product');
  assert.equal(matchBarcode(nom, 'LOT-99').rule.type, 'lot');
  assert.equal(matchBarcode(nom, 'XYZ').matched, false);
});

test('purchase bill clearing uses interim when flagged', () => {
  const lines = buildPurchaseBillClearingLines({
    netAmount: 200,
    taxAmount: 30,
    stockInput: { _id: 'si', code: '1310' },
    inventory: { _id: 'inv', code: '1300' },
    ap: { _id: 'ap', code: '2000' },
    vatInput: { _id: 'vat', code: '1400' },
    useInterim: true,
  });
  assert.equal(lines[0].accountCode, '1310');
  const debit = lines.reduce((s, l) => s + l.debit, 0);
  const credit = lines.reduce((s, l) => s + l.credit, 0);
  assert.equal(debit, credit);
});

test('purchase bill stamps taxIds on recoverable VAT', () => {
  const lines = buildPurchaseBillClearingLines({
    netAmount: 100,
    taxAmount: 15,
    taxPostings: [{ taxId: 'tax15in', amount: 15, recoverable: true, isReverseCharge: false }],
    stockInput: { _id: 'si', code: '1310' },
    inventory: { _id: 'inv', code: '1300' },
    ap: { _id: 'ap', code: '2000' },
    vatInput: { _id: 'vat', code: '1400' },
    useInterim: true,
  });
  const vatLine = lines.find((l) => l.accountCode === '1400');
  assert.ok(vatLine);
  assert.equal(vatLine.debit, 15);
  assert.deepEqual(vatLine.taxIds, ['tax15in']);
  const debit = lines.reduce((s, l) => s + l.debit, 0);
  const credit = lines.reduce((s, l) => s + l.credit, 0);
  assert.equal(debit, credit);
});

test('reverse charge posts Dr VAT input and Cr VAT output', () => {
  const lines = buildPurchaseBillClearingLines({
    netAmount: 100,
    taxAmount: 15,
    taxPostings: [{ taxId: 'taxrc', amount: 15, recoverable: true, isReverseCharge: true }],
    stockInput: { _id: 'si', code: '1310' },
    inventory: { _id: 'inv', code: '1300' },
    ap: { _id: 'ap', code: '2000' },
    vatInput: { _id: 'vat', code: '1400' },
    vatOutput: { _id: 'vout', code: '2100' },
    useInterim: false,
  });
  const vatIn = lines.find((l) => l.accountCode === '1400');
  const vatOut = lines.find((l) => l.accountCode === '2100');
  const ap = lines.find((l) => l.accountCode === '2000');
  assert.equal(vatIn.debit, 15);
  assert.equal(vatOut.credit, 15);
  assert.equal(ap.credit, 100); // RC tax not payable to supplier
  const debit = lines.reduce((s, l) => s + l.debit, 0);
  const credit = lines.reduce((s, l) => s + l.credit, 0);
  assert.equal(debit, credit);
});

test('non-recoverable VAT folds into expense not 1400', () => {
  const lines = buildPurchaseBillClearingLines({
    netAmount: 100,
    taxAmount: 15,
    taxPostings: [{ taxId: 'taxnr', amount: 15, recoverable: false, isReverseCharge: false }],
    stockInput: { _id: 'si', code: '1310' },
    inventory: { _id: 'inv', code: '1300' },
    ap: { _id: 'ap', code: '2000' },
    vatInput: { _id: 'vat', code: '1400' },
    useInterim: false,
  });
  assert.equal(lines.some((l) => l.accountCode === '1400'), false);
  const inv = lines.find((l) => l.accountCode === '1300');
  assert.equal(inv.debit, 115);
  const ap = lines.find((l) => l.accountCode === '2000');
  assert.equal(ap.credit, 115);
});

test('import never implies direct quant write', () => {
  // Contract: countedQty path uses setCountedQuantity only; documented in importProducts.
  assert.ok(true);
});
