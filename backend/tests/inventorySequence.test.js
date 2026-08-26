/**
 * InvSequence helpers — atomic daily doc numbers (D05).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import InvSequence from '../models/inventory/InvSequence.js';
import { nextDailyDocNumber } from '../services/inventory/sequence.js';

const uri = process.env.STOCK_TEST_MONGODB_URI || process.env.MONGODB_URI;
const skip = uri ? false : 'Set MONGODB_URI to run sequence integration test';

test('nextDailyDocNumber returns unique PO numbers under concurrency', { skip }, async () => {
  await mongoose.connect(uri);
  const tenantId = new mongoose.Types.ObjectId();
  try {
    const nums = await Promise.all(
      Array.from({ length: 10 }, () => nextDailyDocNumber(tenantId, 'PO', { padding: 3 })),
    );
    assert.equal(new Set(nums).size, nums.length);
    assert.ok(nums.every((n) => /^PO-\d{8}-\d{3}$/.test(n)));
  } finally {
    await InvSequence.deleteMany({ tenantId });
    await mongoose.disconnect();
  }
});
