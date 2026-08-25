/**
 * Integration: 20 concurrent reserves of 1 from qty 10 never oversell.
 * Requires replica set. Set STOCK_TEST_MONGODB_URI or MONGODB_URI.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { applyQuantDelta } from '../services/inventory/quantDelta.js';
import { runWithTransaction } from '../services/inventory/reserve.js';
import InvQuant from '../models/inventory/InvQuant.js';
import { InventoryConflictError, InventoryValidationError } from '../services/inventory/errors.js';
import { D, decStr } from '../utils/decimal.js';
import { setDecimalPair } from '../models/inventory/common.js';

const uri = process.env.STOCK_TEST_MONGODB_URI || process.env.MONGODB_URI;
const shouldRun = Boolean(uri) && process.env.STOCK_TEST_INTEGRATION !== '0';

async function mongoSupportsTransactions() {
  await mongoose.connect(uri);
  try {
    const db = mongoose.connection.db;
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        await db.collection('_inv_test_txn_probe').insertOne({ probe: true }, { session });
      });
      await db.collection('_inv_test_txn_probe').deleteMany({ probe: true });
      return true;
    } catch (err) {
      const msg = String(err?.message || err);
      if (msg.includes('replica set') || msg.includes('mongos')) return false;
      throw err;
    } finally {
      session.endSession();
    }
  } finally {
    await mongoose.disconnect();
  }
}

let skipReason = !shouldRun ? 'Set STOCK_TEST_MONGODB_URI to run' : null;
if (shouldRun && !skipReason) {
  try {
    const ok = await mongoSupportsTransactions();
    if (!ok) skipReason = 'MongoDB replica set required for transaction integration test';
  } catch (err) {
    skipReason = `Mongo unavailable: ${err.message}`;
  }
}

async function reserveOneUnit(tenantId, productId, locationId) {
  const maxRetries = 8;
  let lastErr;
  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await runWithTransaction(async (session) => applyQuantDelta(
        session,
        tenantId,
        productId,
        locationId,
        '0',
        '1',
      ));
    } catch (err) {
      lastErr = err;
      const retryable = err instanceof InventoryConflictError
        || err?.code === 'CONFLICT'
        || err?.name === 'MongoServerError'
        || err?.errorLabels?.includes?.('TransientTransactionError');
      if (i < maxRetries && retryable) continue;
      throw err;
    }
  }
  throw lastErr;
}

test(
  'integration: 20 concurrent reserves of 1 from qty 10 never oversell',
  { skip: skipReason || false },
  async () => {
    await mongoose.connect(uri);
    const tenantId = new mongoose.Types.ObjectId();
    const productId = new mongoose.Types.ObjectId();
    const locationId = new mongoose.Types.ObjectId();

    try {
      const doc = {
        tenantId,
        productId,
        locationId,
        variantId: null,
        lotId: null,
        packageId: null,
        ownerId: null,
        version: 0,
      };
      setDecimalPair(doc, 'quantity', '10');
      setDecimalPair(doc, 'reservedQuantity', '0');
      setDecimalPair(doc, 'value', '0');
      await InvQuant.create([doc]);

      const workers = Array.from({ length: 20 }, () => reserveOneUnit(tenantId, productId, locationId));
      const settled = await Promise.allSettled(workers);
      const ok = settled.filter((s) => s.status === 'fulfilled').length;
      const failed = settled.filter((s) => s.status === 'rejected');

      for (const f of failed) {
        assert.ok(
          f.reason instanceof InventoryValidationError
            || f.reason instanceof InventoryConflictError
            || f.reason?.code === 'OVER_RESERVED'
            || f.reason?.code === 'CONFLICT',
          `unexpected failure: ${f.reason?.message || f.reason}`,
        );
      }

      const quant = await InvQuant.findOne({ tenantId, productId, locationId });
      assert.ok(quant);
      assert.ok(D(quant.reservedQuantity).lte(D(quant.quantity)));
      assert.equal(decStr(quant.quantity), '10');
      assert.equal(decStr(quant.reservedQuantity), '10');
      assert.equal(ok, 10);
      assert.equal(failed.length, 10);
    } finally {
      await InvQuant.deleteMany({ tenantId });
      await mongoose.disconnect();
    }
  },
);
