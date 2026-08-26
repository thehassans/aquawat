import test from 'node:test';
import assert from 'node:assert/strict';
import { assertProductAccountingAccounts } from '../services/inventory/productAccounting.js';

test('assertProductAccountingAccounts blocks sold product without income', async () => {
  await assert.rejects(
    () => assertProductAccountingAccounts('507f1f77bcf86cd799439011', {
      canBeSold: true,
      canBePurchased: false,
    }),
    (err) => err?.code === 'PRODUCT_ACCOUNTS_REQUIRED',
  );
});

test('assertProductAccountingAccounts allows sold product with income', async () => {
  await assert.doesNotReject(() => assertProductAccountingAccounts('507f1f77bcf86cd799439011', {
    canBeSold: true,
    incomeAccountId: '507f1f77bcf86cd799439012',
  }));
});

test('assertProductAccountingAccounts allows unsold product without income', async () => {
  await assert.doesNotReject(() => assertProductAccountingAccounts('507f1f77bcf86cd799439011', {
    canBeSold: false,
    canBePurchased: false,
  }));
});
