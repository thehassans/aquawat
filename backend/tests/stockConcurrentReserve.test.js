/**
 * Integration: concurrent reserved deltas against one quant.
 * Runs only when STOCK_TEST_MONGODB_URI or MONGODB_URI is set.
 *
 * Example:
 *   STOCK_TEST_MONGODB_URI=mongodb://127.0.0.1:27017/maqder_stock_test npm test -- tests/stockConcurrentReserve.test.js
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { applyQuantDelta } from '../services/stock/quantDelta.js';
import { runWithTransaction } from '../services/stock/reserve.js';
import StockQuant from '../models/stock/StockQuant.js';
import { StockConflictError, StockValidationError } from '../services/stock/errors.js';
import { D, decStr } from '../utils/decimal.js';

const uri = process.env.STOCK_TEST_MONGODB_URI || process.env.MONGODB_URI;
const shouldRun = Boolean(uri) && process.env.STOCK_TEST_INTEGRATION !== '0';

async function mongoSupportsTransactions() {
  await mongoose.connect(uri);
  try {
    const db = mongoose.connection.db;
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        await db.collection('_stock_test_txn_probe').insertOne({ probe: true }, { session });
      });
      await db.collection('_stock_test_txn_probe').deleteMany({ probe: true });
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
      const retryable = err instanceof StockConflictError
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
      await StockQuant.create([{
        tenantId,
        productId,
        locationId,
        lotId: null,
        packageId: null,
        ownerId: null,
        quantity: '10',
        reservedQuantity: '0',
        value: '0',
        version: 0,
      }]);

      const workers = Array.from({ length: 20 }, () => reserveOneUnit(tenantId, productId, locationId));
      const settled = await Promise.allSettled(workers);
      const ok = settled.filter((s) => s.status === 'fulfilled').length;
      const failed = settled.filter((s) => s.status === 'rejected');

      for (const f of failed) {
        assert.ok(
          f.reason instanceof StockValidationError
            || f.reason instanceof StockConflictError
            || f.reason?.code === 'OVER_RESERVED'
            || f.reason?.code === 'CONFLICT',
          `unexpected failure: ${f.reason?.message || f.reason}`,
        );
      }

      const quant = await StockQuant.findOne({ tenantId, productId, locationId });
      assert.ok(quant);
      assert.ok(D(quant.reservedQuantity).lte(D(quant.quantity)));
      assert.equal(decStr(quant.quantity), '10');
      assert.equal(decStr(quant.reservedQuantity), '10');
      assert.equal(ok, 10);
      assert.equal(failed.length, 10);
    } finally {
      await StockQuant.deleteMany({ tenantId });
      await mongoose.disconnect();
    }
  },
);
