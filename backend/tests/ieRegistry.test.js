import test from 'node:test';
import assert from 'node:assert/strict';
import { assertProductRegistryComplete, flattenIeFields, getIeModel, costGatedFieldKeys } from '../services/inventory/ieRegistry.js';
import { rowsToCsv } from '../services/inventory/importExport.js';

test('product IE registry covers §1.1 catalog', () => {
  const result = assertProductRegistryComplete();
  assert.equal(result.ok, true);
  assert.ok(result.registered > 40);
});

test('product export fields expose groups and locked computed', () => {
  const fields = flattenIeFields('products');
  const onHand = fields.find((f) => f.key === 'onHand');
  assert.ok(onHand);
  assert.equal(onHand.locked, true);
  assert.equal(onHand.group, 'Computed');
  const sku = fields.find((f) => f.key === 'sku');
  assert.equal(sku.importable, true);
  assert.equal(sku.required, true);
});

test('cost fields are permission-gated', () => {
  const gated = costGatedFieldKeys('products');
  assert.ok(gated.has('cost'));
  assert.ok(gated.has('inventoryValue'));
});

test('CSV includes UTF-8 BOM for Excel Arabic', () => {
  const csv = rowsToCsv([{ name_ar: 'منتج' }], ['name_ar'], { bom: true });
  assert.equal(csv.charCodeAt(0), 0xfeff);
  assert.ok(csv.includes('منتج'));
});

test('stock and physical_inventory models exist', () => {
  assert.ok(getIeModel('stock'));
  assert.ok(getIeModel('physical_inventory'));
  assert.ok(getIeModel('vendors_pricelist'));
  assert.ok(getIeModel('transfer_lines'));
  assert.equal(getIeModel('transfer_lines').importable, false);
});
