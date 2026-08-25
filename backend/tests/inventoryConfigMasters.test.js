import test from 'node:test';
import assert from 'node:assert/strict';
import { InventoryValidationError } from '../services/inventory/errors.js';
import {
  createLocation,
  createOperationType,
  createProductCategory,
} from '../services/inventory/configMasters.js';

test('createLocation rejects empty name', async () => {
  await assert.rejects(
    () => createLocation('507f1f77bcf86cd799439011', null, { usage: 'internal' }),
    (err) => err instanceof InventoryValidationError && err.code === 'LOC_NAME',
  );
});

test('createOperationType rejects missing warehouse', async () => {
  await assert.rejects(
    () => createOperationType('507f1f77bcf86cd799439011', null, {
      name: 'X',
      code: 'internal',
      sequenceCode: 'X/INT',
      sequencePrefix: 'X/INT',
    }),
    (err) => err instanceof InventoryValidationError && err.code === 'OT_WH',
  );
});

test('createProductCategory rejects empty name', async () => {
  await assert.rejects(
    () => createProductCategory('507f1f77bcf86cd799439011', null, {}),
    (err) => err instanceof InventoryValidationError && err.code === 'CAT_NAME',
  );
});
