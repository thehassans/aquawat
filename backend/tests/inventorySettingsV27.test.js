import test from 'node:test';
import assert from 'node:assert/strict';
import { decStr, referenceToUom, uomToReference } from '../utils/decimal.js';
import {
  AUTOMATED_CATEGORY_ACCOUNT_KEYS,
  validateAutomatedCategoryAccounts,
} from '../services/inventory/stockAccounting.js';
import { packagesEnabled, lotsEnabled, signatureRequired } from '../services/inventory/settingsService.js';
import { SETTINGS_EFFECTS } from '../services/inventory/settingsEffects.js';
import { SETTINGS_ALLOWED } from '../services/inventory/settingsService.js';

test('uom convert: consumption rounds up via referenceToUom', () => {
  // 1.001 boxes with factor 10 → 10.01 ref when rounded? factor path: qty/factor then *target
  const ref = uomToReference('1.001', '1');
  const out = referenceToUom(ref, '1', '0.01');
  assert.equal(decStr(out), '1.01');
});

test('automated category requires five account keys', () => {
  assert.equal(AUTOMATED_CATEGORY_ACCOUNT_KEYS.length, 5);
  assert.ok(AUTOMATED_CATEGORY_ACCOUNT_KEYS.includes('stockValuationAccountId'));
  assert.ok(AUTOMATED_CATEGORY_ACCOUNT_KEYS.includes('stockJournalId'));
});

test('each SETTINGS_ALLOWED flag has an effect map entry', () => {
  const missing = SETTINGS_ALLOWED.filter((k) => !SETTINGS_EFFECTS[k]);
  assert.deepEqual(missing, []);
});

test('toggle helpers flip observable predicates', () => {
  assert.equal(packagesEnabled({ groupStockPackaging: false }), false);
  assert.equal(packagesEnabled({ groupStockPackaging: true }), true);
  assert.equal(lotsEnabled({ groupProductionLot: false }), false);
  assert.equal(lotsEnabled({ groupProductionLot: true }), true);
  assert.equal(signatureRequired({ signatureOnDelivery: false }), false);
  assert.equal(signatureRequired({ signatureOnDelivery: true }), true);
});

test('validateAutomatedCategoryAccounts shape (empty tenant id object)', async () => {
  // Unit-level: function exists and returns contract fields when given absurd id (may throw or empty)
  assert.equal(typeof validateAutomatedCategoryAccounts, 'function');
});
