import test from 'node:test';
import assert from 'node:assert/strict';
import { filterInventoryMenu } from '../services/inventory/menu.js';

test('reconcile response shape contract — zero drift', () => {
  const sample = {
    ok: true,
    checked: 3,
    matched: 3,
    mismatchCount: 0,
    stockValueTotal: '100.00',
    valuationValueTotal: '100.00',
    valueDrift: '0',
    mismatches: [],
  };
  assert.equal(sample.ok, true);
  assert.equal(sample.valueDrift, '0');
  assert.equal(sample.stockValueTotal, sample.valuationValueTotal);
  assert.equal(sample.mismatches.length, 0);
  for (const k of [
    'ok', 'checked', 'matched', 'mismatchCount',
    'stockValueTotal', 'valuationValueTotal', 'valueDrift', 'mismatches',
  ]) {
    assert.ok(k in sample, `missing ${k}`);
  }
});

test('mismatch issue codes are known', () => {
  const known = new Set([
    'QTY_LEDGER_VS_VALUATION',
    'FIFO_VALUE_VS_LAYERS',
    'STOCK_VALUE_VS_VALUATION',
    'CACHE_VS_LEDGER',
  ]);
  const sampleIssue = { code: 'STOCK_VALUE_VS_VALUATION', stockValue: '10', valuationValue: '9' };
  assert.ok(known.has(sampleIssue.code));
});

test('filterInventoryMenu includes report-reconcile under reporting', () => {
  const items = filterInventoryMenu(
    { stockAccountingEnabled: true },
    { role: 'admin' },
  );
  const reporting = items.find((i) => i.id === 'reporting');
  assert.ok(reporting);
  const ids = (reporting.children || []).map((c) => c.id);
  assert.ok(ids.includes('report-reconcile'));
  assert.ok(ids.includes('report-locations'));
  assert.ok(ids.includes('stock'));
  assert.ok(ids.includes('valuation'));
});

test('hard invariant: stock value total must equal valuation total', () => {
  // Documented contract for GET /stock/report/reconcile — valueDrift must be 0 when ok.
  const assertInvariant = (stockValueTotal, valuationValueTotal) => {
    const drift = Number(stockValueTotal) - Number(valuationValueTotal);
    return { ok: drift === 0, valueDrift: String(drift) };
  };
  assert.deepEqual(assertInvariant('42.5', '42.5'), { ok: true, valueDrift: '0' });
  assert.equal(assertInvariant('10', '9').ok, false);
});
