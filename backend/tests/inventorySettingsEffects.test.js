import test from 'node:test';
import assert from 'node:assert/strict';
import { SETTINGS_ALLOWED } from '../services/inventory/settingsService.js';
import { SETTINGS_EFFECTS, listSettingsEffects } from '../services/inventory/settingsEffects.js';

test('every SETTINGS_ALLOWED flag has an observable effect', () => {
  const missing = SETTINGS_ALLOWED.filter((k) => !SETTINGS_EFFECTS[k]);
  assert.deepEqual(missing, [], `missing effects: ${missing.join(', ')}`);
});

test('listSettingsEffects returns one row per flag', () => {
  assert.equal(listSettingsEffects().length, Object.keys(SETTINGS_EFFECTS).length);
});

test('email and SMS confirmation effects are documented', () => {
  assert.equal(SETTINGS_EFFECTS.emailConfirmationOnDelivery, 'validate_stamps_email_note');
  assert.equal(SETTINGS_EFFECTS.stockSmsConfirmation, 'validate_stamps_sms_note_requires_provider');
});

test('lots on delivery slip effect is print_lot_column_on_delivery', () => {
  assert.equal(SETTINGS_EFFECTS.showLotsOnDeliverySlips, 'print_lot_column_on_delivery');
});
