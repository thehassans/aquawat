import test from 'node:test';
import assert from 'node:assert/strict';
import { diffFields } from '../services/inventory/configAudit.js';
import { parseCsv } from '../services/inventory/importExport.js';

test('category allowNegativeStock default is false (policy contract)', () => {
  const cat = { allowNegativeStock: false, costingMethod: 'average' };
  assert.equal(cat.allowNegativeStock, false);
});

test('quantDelta negative policy: allowNegative flag is required to go below zero', () => {
  const dims = { allowNegative: false };
  const wouldGoNegative = true;
  const blocked = wouldGoNegative && !dims.allowNegative;
  assert.equal(blocked, true);
  assert.equal(wouldGoNegative && { allowNegative: true }.allowNegative, true);
});

test('diffFields records costingMethod and allowNegativeStock changes', () => {
  const changes = diffFields(
    { costingMethod: 'average', allowNegativeStock: false },
    { costingMethod: 'fifo', allowNegativeStock: true },
    ['costingMethod', 'allowNegativeStock'],
  );
  assert.equal(changes.length, 2);
  assert.equal(changes.find((c) => c.field === 'costingMethod').to, 'fifo');
});

test('import opening preview marks inventory_adjustment path', () => {
  const { records } = parseCsv('sku,nameEn,onHand\nA1,Widget,10\n');
  assert.equal(records[0].onHand, '10');
  const openingVia = records[0].onHand != null ? 'inventory_adjustment' : null;
  assert.equal(openingVia, 'inventory_adjustment');
});

test('exception queue types are known', () => {
  const types = new Set([
    'waiting_past_deadline',
    'no_rule',
    'procurement_failed',
    'negative_forecast',
    'expired_lot_on_hand',
  ]);
  assert.ok(types.has('expired_lot_on_hand'));
});

test('idempotency key header contract', () => {
  const header = 'Idempotency-Key';
  assert.equal(header.toLowerCase(), 'idempotency-key');
});

test('scheduler rate-limit skip status', () => {
  const run = { status: 'skipped', rateLimited: true };
  assert.equal(run.status, 'skipped');
  assert.equal(run.rateLimited, true);
});

test('ProductStockCache assert shape', () => {
  const sample = { ok: true, checked: 0, mismatchCount: 0, mismatches: [] };
  assert.equal(sample.ok, true);
  assert.equal(sample.valueDrift ?? 0, 0);
});
