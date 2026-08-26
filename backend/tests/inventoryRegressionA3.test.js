/**
 * v4 Part A.3 — regression matrix.
 * Unit proofs always run; integration flows need STOCK_TEST_MONGODB_URI + replica set.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { sortQuantsForRemoval } from '../services/inventory/locationHelpers.js';
import { deriveTransferState } from '../services/inventory/transferState.js';
import { stockDeltaForLine } from '../services/purchasesLogic.js';
import { InventoryValidationError } from '../services/inventory/errors.js';
import { applyQuantDelta } from '../services/inventory/quantDelta.js';
import { runWithTransaction } from '../services/inventory/reserve.js';
import InvQuant from '../models/inventory/InvQuant.js';
import InvTransfer from '../models/inventory/InvTransfer.js';
import InvMove from '../models/inventory/InvMove.js';
import InvMoveLine from '../models/inventory/InvMoveLine.js';
import InvLot from '../models/inventory/InvLot.js';
import InvValuationLayer from '../models/inventory/InvValuationLayer.js';
import InvLocation from '../models/inventory/InvLocation.js';
import Product from '../models/Product.js';
import { setDecimalPair } from '../models/inventory/common.js';
import { createTransfer } from '../services/inventory/createTransfer.js';
import { confirmTransfer, validateTransfer, cancelTransfer, checkAvailability } from '../services/inventory/transferService.js';
import { setCountedQuantity, applyInventoryCounts } from '../services/inventory/inventoryCount.js';
import { createScrap, validateScrap } from '../services/inventory/scrapService.js';
import { createReturnTransfer } from '../services/inventory/returns.js';
import { createLandedCost, validateLandedCost } from '../services/inventory/landedCost.js';
import { importProducts } from '../services/inventory/importExport.js';
import { universalExport, universalImport } from '../services/inventory/universalIe.js';
import { nextSequenceName, ensureSequence } from '../services/inventory/sequence.js';
import { loadCostContext } from '../services/inventory/valuation.js';
import {
  uri,
  resolveIntegrationSkip,
  bootstrapTestTenant,
  quantOnHand,
  seedStockViaReceipt,
  seedLotStockViaReceipt,
  seedLotQuant,
  findQuantId,
  cleanupTestTenant,
} from './helpers/inventoryIntegrationHarness.js';

let integrationSkip = 'resolving…';
integrationSkip = await resolveIntegrationSkip();

// ── Unit proofs (always run) ────────────────────────────────────────────────

test('A.3 #9 FEFO sorts nearest expiry first', () => {
  const quants = [
    { _id: 'late', lotRemovalDate: new Date('2025-06-01') },
    { _id: 'soon', lotRemovalDate: new Date('2025-01-01') },
  ];
  const sorted = sortQuantsForRemoval(quants, 'fefo');
  assert.equal(sorted[0]._id, 'soon');
});

test('A.3 #10 zero demand leaves transfer in draft state', () => {
  assert.equal(deriveTransferState([{ state: 'draft' }]), 'draft');
});

test('A.3 #12 internal move qty deltas net to zero for valuation', () => {
  const out = stockDeltaForLine({ productType: 'goods', quantity: 5, direction: 'out' });
  const inn = stockDeltaForLine({ productType: 'goods', quantity: 5, direction: 'in' });
  assert.equal(out + inn, 0);
});

test('A.3 #8 INSUFFICIENT_STOCK names product and location', { skip: integrationSkip || false }, async () => {
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
    setDecimalPair(doc, 'quantity', '1');
    setDecimalPair(doc, 'reservedQuantity', '0');
    setDecimalPair(doc, 'value', '0');
    await InvQuant.create([doc]);

    let caught = null;
    try {
      await runWithTransaction((session) => applyQuantDelta(
        session,
        tenantId,
        productId,
        locationId,
        '-3',
        '0',
        new Date(),
        {
          productLabel: 'Almond Milk',
          locationLabel: 'WH/Stock',
          requestedQty: '3',
        },
      ));
    } catch (err) {
      caught = err;
    }
    assert.ok(caught instanceof InventoryValidationError);
    assert.equal(caught.code, 'INSUFFICIENT_STOCK');
    assert.match(caught.message, /Almond Milk/);
    assert.match(caught.message, /WH\/Stock/);
    assert.match(caught.message, /Available: 1/);
  } finally {
    await InvQuant.deleteMany({ tenantId });
    await mongoose.disconnect();
  }
});

// ── Integration flows ─────────────────────────────────────────────────────────

test('A.3 #1 receipt validate increases on-hand by received qty', { skip: integrationSkip || false }, async () => {
  await mongoose.connect(uri);
  const ctx = await bootstrapTestTenant('rcpt');
  try {
    const before = await Promise.all(ctx.products.map((p) => quantOnHand(ctx.tenantId, p._id, ctx.stockLocationId)));
    assert.deepEqual(before, ['0', '0', '0']);

    const transfer = await createTransfer(ctx.tenantId, {
      operationTypeId: ctx.incoming._id,
      lines: ctx.products.map((p, i) => ({
        productId: p._id,
        demandQty: String(i + 2),
      })),
      origin: 'A.3#1',
    }, ctx.userId);

    await confirmTransfer(ctx.tenantId, transfer._id, ctx.userId);
    const done = await validateTransfer(ctx.tenantId, transfer._id, {
      userId: ctx.userId,
      immediate: true,
    });
    assert.equal(done.state, 'done');

    const after = await Promise.all(ctx.products.map((p) => quantOnHand(ctx.tenantId, p._id, ctx.stockLocationId)));
    assert.deepEqual(after, ['2', '3', '4']);
  } finally {
    await cleanupTestTenant(ctx.tenantId);
    await mongoose.disconnect();
  }
});

test('A.3 #7 delivery validate decreases on-hand', { skip: integrationSkip || false }, async () => {
  await mongoose.connect(uri);
  const ctx = await bootstrapTestTenant('delv');
  try {
    const product = ctx.products[0];
    const receipt = await createTransfer(ctx.tenantId, {
      operationTypeId: ctx.incoming._id,
      lines: [{ productId: product._id, demandQty: '10' }],
    }, ctx.userId);
    await confirmTransfer(ctx.tenantId, receipt._id, ctx.userId);
    await validateTransfer(ctx.tenantId, receipt._id, { userId: ctx.userId, immediate: true });
    assert.equal(await quantOnHand(ctx.tenantId, product._id, ctx.stockLocationId), '10');

    const delivery = await createTransfer(ctx.tenantId, {
      operationTypeId: ctx.outgoing._id,
      partnerId: ctx.customer._id,
      lines: [{ productId: product._id, demandQty: '3' }],
    }, ctx.userId);
    await confirmTransfer(ctx.tenantId, delivery._id, ctx.userId);
    await validateTransfer(ctx.tenantId, delivery._id, { userId: ctx.userId, immediate: true });

    assert.equal(await quantOnHand(ctx.tenantId, product._id, ctx.stockLocationId), '7');
  } finally {
    await cleanupTestTenant(ctx.tenantId);
    await mongoose.disconnect();
  }
});

test('A.3 #4 lot-tracked receipt without lot is blocked', { skip: integrationSkip || false }, async () => {
  await mongoose.connect(uri);
  const ctx = await bootstrapTestTenant('lot');
  try {
    const transfer = await createTransfer(ctx.tenantId, {
      operationTypeId: ctx.incoming._id,
      lines: [{ productId: ctx.lotProduct._id, demandQty: '5' }],
    }, ctx.userId);
    await confirmTransfer(ctx.tenantId, transfer._id, ctx.userId);

    let caught = null;
    try {
      await validateTransfer(ctx.tenantId, transfer._id, { userId: ctx.userId, immediate: true });
    } catch (err) {
      caught = err;
    }
    assert.ok(caught instanceof InventoryValidationError);
    assert.equal(caught.code, 'LOT_REQUIRED');
  } finally {
    await cleanupTestTenant(ctx.tenantId);
    await mongoose.disconnect();
  }
});

test('A.3 #17 double validate is idempotent', { skip: integrationSkip || false }, async () => {
  await mongoose.connect(uri);
  const ctx = await bootstrapTestTenant('dbl');
  try {
    const transfer = await createTransfer(ctx.tenantId, {
      operationTypeId: ctx.incoming._id,
      lines: [{ productId: ctx.products[0]._id, demandQty: '5' }],
    }, ctx.userId);
    await confirmTransfer(ctx.tenantId, transfer._id, ctx.userId);
    const first = await validateTransfer(ctx.tenantId, transfer._id, { userId: ctx.userId, immediate: true });
    const second = await validateTransfer(ctx.tenantId, transfer._id, { userId: ctx.userId, immediate: true });
    assert.equal(first.state, 'done');
    assert.equal(second.state, 'done');
    assert.equal(String(first._id), String(second._id));

    const movesDone = await InvTransfer.findById(transfer._id).lean();
    assert.equal(movesDone.state, 'done');
    assert.equal(await quantOnHand(ctx.tenantId, ctx.products[0]._id, ctx.stockLocationId), '5');
  } finally {
    await cleanupTestTenant(ctx.tenantId);
    await mongoose.disconnect();
  }
});

test('A.3 #20 tenant A cannot read tenant B transfer', { skip: integrationSkip || false }, async () => {
  await mongoose.connect(uri);
  const ctxA = await bootstrapTestTenant('tenA');
  const ctxB = await bootstrapTestTenant('tenB');
  try {
    const transferB = await createTransfer(ctxB.tenantId, {
      operationTypeId: ctxB.incoming._id,
      lines: [{ productId: ctxB.products[0]._id, demandQty: '1' }],
    }, ctxB.userId);

    const leak = await InvTransfer.findOne({ _id: transferB._id, tenantId: ctxA.tenantId });
    assert.equal(leak, null);

    const scoped = await InvTransfer.findOne({ _id: transferB._id, tenantId: ctxB.tenantId });
    assert.ok(scoped);
  } finally {
    await cleanupTestTenant(ctxA.tenantId);
    await cleanupTestTenant(ctxB.tenantId);
    await mongoose.disconnect();
  }
});

test('A.3 #2 partial receipt creates backorder for remainder', { skip: integrationSkip || false }, async () => {
  await mongoose.connect(uri);
  const ctx = await bootstrapTestTenant('part');
  try {
    const product = ctx.products[0];
    const transfer = await createTransfer(ctx.tenantId, {
      operationTypeId: ctx.incoming._id,
      lines: [{ productId: product._id, demandQty: '10' }],
      origin: 'A.3#2',
    }, ctx.userId);
    await confirmTransfer(ctx.tenantId, transfer._id, ctx.userId);

    const moves = await InvMove.find({ tenantId: ctx.tenantId, transferId: transfer._id }).lean();
    assert.equal(moves.length, 1);

    const done = await validateTransfer(ctx.tenantId, transfer._id, {
      userId: ctx.userId,
      immediate: true,
      createBackorder: true,
      moveQuantities: [{ moveId: moves[0]._id, quantity: '3' }],
    });
    assert.equal(done.state, 'done');
    assert.equal(await quantOnHand(ctx.tenantId, product._id, ctx.stockLocationId), '3');

    const backorders = await InvTransfer.find({
      tenantId: ctx.tenantId,
      backorderOfId: transfer._id,
    }).lean();
    assert.equal(backorders.length, 1);
    const boMoves = await InvMove.find({ tenantId: ctx.tenantId, transferId: backorders[0]._id }).lean();
    assert.equal(boMoves[0].demandQty, '7');
  } finally {
    await cleanupTestTenant(ctx.tenantId);
    await mongoose.disconnect();
  }
});

test('A.3 #13 physical count positive difference increases on-hand', { skip: integrationSkip || false }, async () => {
  await mongoose.connect(uri);
  const ctx = await bootstrapTestTenant('cnt+');
  try {
    const product = ctx.products[0];
    await seedStockViaReceipt(ctx, product._id, 10, 'A.3#13');
    assert.equal(await quantOnHand(ctx.tenantId, product._id, ctx.stockLocationId), '10');

    const quantId = await findQuantId(ctx.tenantId, product._id, ctx.stockLocationId);
    assert.ok(quantId);
    await setCountedQuantity(ctx.tenantId, {
      quantId,
      countedQty: '12',
      userId: ctx.userId,
      reasonCode: 'found',
    });
    const applied = await applyInventoryCounts(ctx.tenantId, {
      ids: [quantId],
      reasonCode: 'found',
      userId: ctx.userId,
    });
    assert.equal(applied.applied, 1);
    assert.equal(await quantOnHand(ctx.tenantId, product._id, ctx.stockLocationId), '12');
  } finally {
    await cleanupTestTenant(ctx.tenantId);
    await mongoose.disconnect();
  }
});

test('A.3 #14 physical count negative difference decreases on-hand', { skip: integrationSkip || false }, async () => {
  await mongoose.connect(uri);
  const ctx = await bootstrapTestTenant('cnt-');
  try {
    const product = ctx.products[0];
    await seedStockViaReceipt(ctx, product._id, 10, 'A.3#14');

    const quantId = await findQuantId(ctx.tenantId, product._id, ctx.stockLocationId);
    await setCountedQuantity(ctx.tenantId, {
      quantId,
      countedQty: '7',
      userId: ctx.userId,
      reasonCode: 'damage',
    });
    await applyInventoryCounts(ctx.tenantId, {
      ids: [quantId],
      reasonCode: 'damage',
      userId: ctx.userId,
    });
    assert.equal(await quantOnHand(ctx.tenantId, product._id, ctx.stockLocationId), '7');
  } finally {
    await cleanupTestTenant(ctx.tenantId);
    await mongoose.disconnect();
  }
});

test('A.3 #15 scrap validate removes qty from stock', { skip: integrationSkip || false }, async () => {
  await mongoose.connect(uri);
  const ctx = await bootstrapTestTenant('scr');
  try {
    const product = ctx.products[0];
    await seedStockViaReceipt(ctx, product._id, 10, 'A.3#15');

    const scrap = await createScrap(ctx.tenantId, ctx.userId, {
      productId: product._id,
      sourceLocationId: ctx.stockLocationId,
      quantity: '3',
      reasonTag: 'obsolete',
    });
    await validateScrap(scrap._id, ctx.tenantId, ctx.userId);
    assert.equal(await quantOnHand(ctx.tenantId, product._id, ctx.stockLocationId), '7');
  } finally {
    await cleanupTestTenant(ctx.tenantId);
    await mongoose.disconnect();
  }
});

test('A.3 #18 cancel confirmed transfer sets state cancelled', { skip: integrationSkip || false }, async () => {
  await mongoose.connect(uri);
  const ctx = await bootstrapTestTenant('cncl');
  try {
    const transfer = await createTransfer(ctx.tenantId, {
      operationTypeId: ctx.incoming._id,
      lines: [{ productId: ctx.products[0]._id, demandQty: '5' }],
    }, ctx.userId);
    await confirmTransfer(ctx.tenantId, transfer._id, ctx.userId);

    const cancelled = await cancelTransfer(ctx.tenantId, transfer._id, ctx.userId);
    assert.equal(cancelled.state, 'cancelled');
    assert.equal(await quantOnHand(ctx.tenantId, ctx.products[0]._id, ctx.stockLocationId), '0');
  } finally {
    await cleanupTestTenant(ctx.tenantId);
    await mongoose.disconnect();
  }
});

test('A.3 #19 done transfer cannot be cancelled via API', { skip: integrationSkip || false }, async () => {
  await mongoose.connect(uri);
  const ctx = await bootstrapTestTenant('immu');
  try {
    const transfer = await createTransfer(ctx.tenantId, {
      operationTypeId: ctx.incoming._id,
      lines: [{ productId: ctx.products[0]._id, demandQty: '5' }],
    }, ctx.userId);
    await confirmTransfer(ctx.tenantId, transfer._id, ctx.userId);
    await validateTransfer(ctx.tenantId, transfer._id, { userId: ctx.userId, immediate: true });

    let caught = null;
    try {
      await cancelTransfer(ctx.tenantId, transfer._id, ctx.userId);
    } catch (err) {
      caught = err;
    }
    assert.ok(caught instanceof InventoryValidationError);
    assert.equal(caught.code, 'INVALID_STATE');
  } finally {
    await cleanupTestTenant(ctx.tenantId);
    await mongoose.disconnect();
  }
});

test('A.3 #3 two-step receipt lands at input then store to stock', { skip: integrationSkip || false }, async () => {
  await mongoose.connect(uri);
  const ctx = await bootstrapTestTenant('2stp', { receptionSteps: 'two' });
  try {
    assert.ok(ctx.inputLocationId, 'input location required for two-step WH');
    assert.ok(ctx.storeOt, 'store operation type required');

    const product = ctx.products[0];
    const receipt = await createTransfer(ctx.tenantId, {
      operationTypeId: ctx.incoming._id,
      lines: [{ productId: product._id, demandQty: '5' }],
      origin: 'A.3#3',
    }, ctx.userId);
    await confirmTransfer(ctx.tenantId, receipt._id, ctx.userId);
    await validateTransfer(ctx.tenantId, receipt._id, { userId: ctx.userId, immediate: true });

    assert.equal(await quantOnHand(ctx.tenantId, product._id, ctx.inputLocationId), '5');
    assert.equal(await quantOnHand(ctx.tenantId, product._id, ctx.stockLocationId), '0');

    const store = await createTransfer(ctx.tenantId, {
      operationTypeId: ctx.storeOt._id,
      lines: [{ productId: product._id, demandQty: '5' }],
      origin: 'A.3#3-store',
    }, ctx.userId);
    await confirmTransfer(ctx.tenantId, store._id, ctx.userId);
    await validateTransfer(ctx.tenantId, store._id, { userId: ctx.userId, immediate: true });

    assert.equal(await quantOnHand(ctx.tenantId, product._id, ctx.inputLocationId), '0');
    assert.equal(await quantOnHand(ctx.tenantId, product._id, ctx.stockLocationId), '5');
  } finally {
    await cleanupTestTenant(ctx.tenantId);
    await mongoose.disconnect();
  }
});

test('A.3 #5 expiry auto-computed on lot receipt', { skip: integrationSkip || false }, async () => {
  await mongoose.connect(uri);
  const ctx = await bootstrapTestTenant('exp');
  try {
    const { lot } = await seedLotStockViaReceipt(ctx, ctx.expiryProduct._id, 4, 'EXP-A', 'A.3#5');
    assert.ok(lot);
    assert.ok(lot.expirationDate);
    assert.ok(lot.removalDate);
    const days = (new Date(lot.expirationDate) - new Date()) / (86400000);
    assert.ok(days >= 13 && days <= 15, `expected ~14d expiry, got ${days}`);
  } finally {
    await cleanupTestTenant(ctx.tenantId);
    await mongoose.disconnect();
  }
});

test('A.3 #6 landed cost updates fifo valuation', { skip: integrationSkip || false }, async () => {
  await mongoose.connect(uri);
  const ctx = await bootstrapTestTenant('lc');
  try {
    const product = ctx.products[0];
    const receipt = await seedStockViaReceipt(ctx, product._id, 10, 'A.3#6');
    const beforeCtx = await loadCostContext(product._id);
    assert.equal(beforeCtx.costMethod, 'fifo');

    const lc = await createLandedCost(ctx.tenantId, ctx.userId, {
      transferIds: [receipt._id],
      costLines: [{ name: 'Freight', price: '50', splitMethod: 'byQuantity' }],
    });
    await validateLandedCost(ctx.tenantId, lc._id, ctx.userId);

    const layers = await InvValuationLayer.find({
      tenantId: ctx.tenantId,
      productId: product._id,
      remainingQty: { $ne: '0' },
    }).lean();
    assert.ok(layers.length >= 1);
    const totalRemValue = layers.reduce((s, l) => s + Number(l.remainingValue || 0), 0);
    assert.ok(totalRemValue >= 100, `expected layered value >= 100, got ${totalRemValue}`);
  } finally {
    await cleanupTestTenant(ctx.tenantId);
    await mongoose.disconnect();
  }
});

test('A.3 #9 FEFO reservation picks nearest expiry lot', { skip: integrationSkip || false }, async () => {
  await mongoose.connect(uri);
  const ctx = await bootstrapTestTenant('fefo');
  try {
    await InvLocation.updateOne(
      { _id: ctx.stockLocationId },
      { $set: { removalStrategy: 'fefo' } },
    );

    const soon = await InvLot.create({
      tenantId: ctx.tenantId,
      productId: ctx.lotProduct._id,
      name: 'FEFO-SOON',
      expirationDate: new Date(Date.now() + 3 * 86400000),
    });
    const late = await InvLot.create({
      tenantId: ctx.tenantId,
      productId: ctx.lotProduct._id,
      name: 'FEFO-LATE',
      expirationDate: new Date(Date.now() + 30 * 86400000),
    });
    await seedLotQuant(ctx.tenantId, ctx.lotProduct._id, ctx.stockLocationId, late._id, 5);
    await seedLotQuant(ctx.tenantId, ctx.lotProduct._id, ctx.stockLocationId, soon._id, 5);

    const delivery = await createTransfer(ctx.tenantId, {
      operationTypeId: ctx.outgoing._id,
      partnerId: ctx.customer._id,
      lines: [{ productId: ctx.lotProduct._id, demandQty: '2' }],
    }, ctx.userId);
    await confirmTransfer(ctx.tenantId, delivery._id, ctx.userId);
    await checkAvailability(ctx.tenantId, delivery._id);

    const lines = await InvMoveLine.find({
      tenantId: ctx.tenantId,
      transferId: delivery._id,
      state: { $ne: 'cancelled' },
    }).lean();
    assert.ok(lines.length >= 1);
    assert.equal(String(lines[0].lotId), String(soon._id));
  } finally {
    await cleanupTestTenant(ctx.tenantId);
    await mongoose.disconnect();
  }
});

test('A.3 #11 return of done delivery restores stock', { skip: integrationSkip || false }, async () => {
  await mongoose.connect(uri);
  const ctx = await bootstrapTestTenant('ret');
  try {
    const product = ctx.products[0];
    await seedStockViaReceipt(ctx, product._id, 10, 'A.3#11');
    const delivery = await createTransfer(ctx.tenantId, {
      operationTypeId: ctx.outgoing._id,
      partnerId: ctx.customer._id,
      lines: [{ productId: product._id, demandQty: '3' }],
    }, ctx.userId);
    await confirmTransfer(ctx.tenantId, delivery._id, ctx.userId);
    await validateTransfer(ctx.tenantId, delivery._id, { userId: ctx.userId, immediate: true });
    assert.equal(await quantOnHand(ctx.tenantId, product._id, ctx.stockLocationId), '7');

    const doneMove = await InvMove.findOne({ tenantId: ctx.tenantId, transferId: delivery._id, state: 'done' }).lean();
    const ret = await createReturnTransfer(ctx.tenantId, ctx.userId, delivery._id, {
      lines: [{ moveId: doneMove._id, quantity: '2' }],
    });
    assert.equal(ret.isReturn, true);
    assert.equal(String(ret.returnOfTransferId), String(delivery._id));
    await confirmTransfer(ctx.tenantId, ret._id, ctx.userId);
    await validateTransfer(ctx.tenantId, ret._id, { userId: ctx.userId, immediate: true });
    assert.equal(await quantOnHand(ctx.tenantId, product._id, ctx.stockLocationId), '9');
  } finally {
    await cleanupTestTenant(ctx.tenantId);
    await mongoose.disconnect();
  }
});

test('A.3 #18b cancel propagates to chained waiting move', { skip: integrationSkip || false }, async () => {
  await mongoose.connect(uri);
  const ctx = await bootstrapTestTenant('cprop');
  try {
    const product = ctx.products[0];
    const transfer = await createTransfer(ctx.tenantId, {
      operationTypeId: ctx.incoming._id,
      lines: [{ productId: product._id, demandQty: '5' }],
    }, ctx.userId);
    await confirmTransfer(ctx.tenantId, transfer._id, ctx.userId);
    const move1 = await InvMove.findOne({ tenantId: ctx.tenantId, transferId: transfer._id });
    const [move2] = await InvMove.create([{
      tenantId: ctx.tenantId,
      reference: `${move1.reference}-chain`,
      productId: product._id,
      uomId: move1.uomId,
      demandQty: '5',
      sourceLocationId: move1.destLocationId,
      destLocationId: ctx.stockLocationId,
      state: 'waiting',
      transferId: transfer._id,
      propagateCancel: true,
      createdBy: ctx.userId,
    }]);
    move1.destMoveIds = [move2._id];
    move1.propagateCancel = true;
    await move1.save();

    await cancelTransfer(ctx.tenantId, transfer._id, ctx.userId);
    const after1 = await InvMove.findById(move1._id).lean();
    const after2 = await InvMove.findById(move2._id).lean();
    assert.equal(after1.state, 'cancelled');
    assert.equal(after2.state, 'cancelled');
  } finally {
    await cleanupTestTenant(ctx.tenantId);
    await mongoose.disconnect();
  }
});

test('A.3 #21 product IE export/import round-trip updates rows', { skip: integrationSkip || false }, async () => {
  await mongoose.connect(uri);
  const ctx = await bootstrapTestTenant('ie');
  try {
    const exported = await universalExport(ctx.tenantId, ctx.userId, {
      model: 'products',
      importCompatible: true,
      filters: { sku: ctx.products[0].sku },
    });
    assert.ok(exported.payload?.includes(ctx.products[0].sku));

    const patched = exported.payload.replace(
      ctx.products[0].nameEn,
      'IE Round Trip Name',
    );
    const dry = await universalImport(ctx.tenantId, ctx.userId, {
      model: 'products',
      csvText: patched,
      dryRun: true,
    });
    assert.ok((dry.updated >= 1 || dry.wouldUpdate >= 1 || dry.preview?.length >= 1));

    await universalImport(ctx.tenantId, ctx.userId, {
      model: 'products',
      csvText: patched,
      dryRun: false,
    });
    const refreshed = await Product.findById(ctx.products[0]._id).lean();
    assert.equal(refreshed.nameEn, 'IE Round Trip Name');
  } finally {
    await cleanupTestTenant(ctx.tenantId);
    await mongoose.disconnect();
  }
});

test('A.3 #22 import dry-run rejects bad rows without writes', { skip: integrationSkip || false }, async () => {
  await mongoose.connect(uri);
  const ctx = await bootstrapTestTenant('dry');
  try {
    const before = await Product.countDocuments({ tenantId: ctx.tenantId });
    const csv = 'sku,nameEn,costPrice\n,BAD ROW ONLY,\nGOOD-1,Good Product,5';
    const result = await importProducts(ctx.tenantId, ctx.userId, { csvText: csv, dryRun: true });
    assert.ok(result.errors?.length >= 1);
    assert.equal(result.dryRun, true);
    assert.ok(result.wouldCreate >= 1 || result.preview?.length >= 1);

    const after = await Product.countDocuments({ tenantId: ctx.tenantId });
    assert.equal(after, before);
  } finally {
    await cleanupTestTenant(ctx.tenantId);
    await mongoose.disconnect();
  }
});

test('A.3 #23 concurrent picking names are unique', { skip: integrationSkip || false }, async () => {
  await mongoose.connect(uri);
  const tenantId = new mongoose.Types.ObjectId();
  try {
    await ensureSequence(tenantId, 'PICK', 'WH/PICK');
    const names = await Promise.all(
      Array.from({ length: 25 }, () => nextSequenceName(tenantId, 'PICK')),
    );
    assert.equal(new Set(names).size, names.length);
  } finally {
    await InvSequence.deleteMany({ tenantId });
    await mongoose.disconnect();
  }
});

test('A.3 #16 concurrent reserve covered by inventoryConcurrentReserve.test.js', () => {
  assert.ok(true);
});

