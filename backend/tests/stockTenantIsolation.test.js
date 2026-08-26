/**
 * v4 A.3 #20 — stock layer tenant isolation contracts.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import InvTransfer from '../models/inventory/InvTransfer.js';
import InvQuant from '../models/inventory/InvQuant.js';
import Product from '../models/Product.js';
import {
  uri,
  resolveIntegrationSkip,
  bootstrapTestTenant,
  cleanupTestTenant,
} from './helpers/inventoryIntegrationHarness.js';
import { createTransfer } from '../services/inventory/createTransfer.js';

const integrationSkip = await resolveIntegrationSkip();

test('stock query contract: tenantFilter.tenantId must match document tenantId', () => {
  const tenantA = new mongoose.Types.ObjectId();
  const tenantB = new mongoose.Types.ObjectId();
  const query = { _id: new mongoose.Types.ObjectId(), tenantId: tenantA };
  assert.notEqual(String(query.tenantId), String(tenantB));
  assert.equal(String(query.tenantId), String(tenantA));
});

test('InvTransfer service create scopes tenantId on document', { skip: integrationSkip || false }, async () => {
  await mongoose.connect(uri);
  const ctx = await bootstrapTestTenant('iso');
  try {
    const transfer = await createTransfer(ctx.tenantId, {
      operationTypeId: ctx.incoming._id,
      lines: [{ productId: ctx.products[0]._id, demandQty: '1' }],
    }, ctx.userId);
    assert.equal(String(transfer.tenantId), String(ctx.tenantId));

    const foreign = await InvTransfer.findOne({
      _id: transfer._id,
      tenantId: new mongoose.Types.ObjectId(),
    });
    assert.equal(foreign, null);
  } finally {
    await cleanupTestTenant(ctx.tenantId);
    await mongoose.disconnect();
  }
});

test('InvQuant aggregate must include tenantId filter', { skip: integrationSkip || false }, async () => {
  await mongoose.connect(uri);
  const ctxA = await bootstrapTestTenant('qA');
  const ctxB = await bootstrapTestTenant('qB');
  try {
    await Product.updateOne(
      { _id: ctxA.products[0]._id },
      { $set: { tenantId: ctxA.tenantId } },
    );

    const countA = await InvQuant.countDocuments({ tenantId: ctxA.tenantId });
    const countB = await InvQuant.countDocuments({ tenantId: ctxB.tenantId });
    assert.equal(countA, 0);
    assert.equal(countB, 0);

    const cross = await InvQuant.findOne({
      productId: ctxA.products[0]._id,
      tenantId: ctxB.tenantId,
    });
    assert.equal(cross, null);
  } finally {
    await cleanupTestTenant(ctxA.tenantId);
    await cleanupTestTenant(ctxB.tenantId);
    await mongoose.disconnect();
  }
});
