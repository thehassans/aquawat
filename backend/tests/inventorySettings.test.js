import test from 'node:test';
import assert from 'node:assert/strict';
import { InventoryValidationError } from '../services/inventory/errors.js';
import { packagesEnabled, lotsEnabled, signatureRequired } from '../services/inventory/settingsService.js';

test('packagesEnabled accepts tracking-lot or packaging flags', () => {
  assert.equal(packagesEnabled({}), false);
  assert.equal(packagesEnabled({ groupStockTrackingLot: true }), true);
  assert.equal(packagesEnabled({ groupStockPackaging: true }), true);
});

test('lotsEnabled prefers production lot flag', () => {
  assert.equal(lotsEnabled({ groupProductionLot: true }), true);
  assert.equal(lotsEnabled({ groupStockTrackingLot: true }), true);
  assert.equal(lotsEnabled({}), false);
});

test('signatureRequired accepts either alias', () => {
  assert.equal(signatureRequired({ signatureOnDelivery: true }), true);
  assert.equal(signatureRequired({ groupStockSignDelivery: true }), true);
  assert.equal(signatureRequired({}), false);
});

test('InventoryValidationError carries code', () => {
  const err = new InventoryValidationError('x', 'MULTI_LOC_STOCK');
  assert.equal(err.code, 'MULTI_LOC_STOCK');
});
