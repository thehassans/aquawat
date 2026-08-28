/**
 * Unit tests for inventory label barcode rendering.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { linearBarcodeDataUrl } from '../services/inventory/invPrint.js';

test('linearBarcodeDataUrl returns PNG data URL for Code 128 SKU', async () => {
  const url = await linearBarcodeDataUrl('SKU-ABC-123');
  assert.match(url, /^data:image\/png;base64,/);
  assert.ok(url.length > 100);
});

test('linearBarcodeDataUrl returns PNG data URL for EAN-13 barcode', async () => {
  const url = await linearBarcodeDataUrl('9780201379624');
  assert.match(url, /^data:image\/png;base64,/);
});

test('linearBarcodeDataUrl returns empty string for blank input', async () => {
  assert.equal(await linearBarcodeDataUrl(''), '');
  assert.equal(await linearBarcodeDataUrl('   '), '');
});
