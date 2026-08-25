import { D, decStr, decMin, decIsPositive, decRoundDown } from '../../utils/decimal.js';
import mongoose from 'mongoose';
import InvQuant from '../../models/inventory/InvQuant.js';
import InvMoveLine from '../../models/inventory/InvMoveLine.js';
import InvLocation from '../../models/inventory/InvLocation.js';
import InvProductCategory from '../../models/inventory/InvProductCategory.js';
import Product from '../../models/Product.js';
import { toObjectId } from '../../models/inventory/common.js';
import { getInternalLocationIds, sortQuantsForRemoval, resolveRemovalStrategy } from './locationHelpers.js';
import { atomicReserveQuant, applyQuantDelta } from './quantDelta.js';
import InvLot from '../../models/inventory/InvLot.js';
import { isLotExpired } from './lotService.js';
import { InventoryConflictError, InventoryValidationError } from './errors.js';
import { withWriteConflictRetry } from './advisoryLock.js';
import { demandInProductUom } from './uomConvert.js';

const MAX_CANDIDATE_RETRIES = 5;

async function runTransactionOnce(fn) {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const result = await fn(session);
    await session.commitTransaction();
    return result;
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}

/**
 * Mongo transaction with one automatic write-conflict retry + jitter.
 * Exhausted retries → typed WRITE_CONFLICT (409).
 */
export async function runWithTransaction(fn) {
  try {
    return await withWriteConflictRetry(() => runTransactionOnce(fn), { retries: 1 });
  } catch (err) {
    if (err?.code === 112 || err?.codeName === 'WriteConflict'
      || err?.errorLabels?.includes?.('TransientTransactionError')) {
      throw new InventoryConflictError(
        'Another concurrent stock update won — refresh and retry',
        'WRITE_CONFLICT',
      );
    }
    throw err;
  }
}

/**
 * Reserve stock for a move (MongoDB-safe atomic conditional updates).
 */
export async function reserveMove(move, session) {
  if (['done', 'cancelled', 'draft'].includes(move.state)) {
    return move;
  }

  const product = await Product.findOne({ _id: move.productId, tenantId: move.tenantId }).session(session);
  if (!product) throw new InventoryValidationError('Product not found', 'PRODUCT_NOT_FOUND');

  if (product.trackInventory === false || product.productType === 'service') {
    move.state = 'assigned';
    await move.save({ session });
    return move;
  }

  const locationIds = await getInternalLocationIds(move.tenantId, move.sourceLocationId);
  const srcLocation = await InvLocation.findById(move.sourceLocationId).session(session);

  // Incoming from non-internal (vendor / inventoryLoss / production): no quant to reserve —
  // assign a single move line for full demand at source → dest.
  if (locationIds.length === 0 || (srcLocation && srcLocation.usage !== 'internal')) {
    const existing = await InvMoveLine.countDocuments({
      tenantId: move.tenantId,
      moveId: move._id,
      state: { $nin: ['done', 'cancelled'] },
    }).session(session);
    if (!existing) {
      const { need: demandStr } = await demandInProductUom(move, product, session);
      if (decIsPositive(demandStr)) {
        await InvMoveLine.create([{
          tenantId: move.tenantId,
          moveId: move._id,
          transferId: move.transferId,
          productId: move.productId,
          variantId: move.variantId || null,
          uomId: move.uomId,
          quantity: demandStr,
          quantityInProductUom: demandStr,
          sourceLocationId: move.sourceLocationId,
          destLocationId: move.destLocationId,
          state: 'assigned',
          reference: move.reference,
          createdBy: move.createdBy,
        }], { session });
      }
    }
    move.state = 'assigned';
    await move.save({ session });
    return move;
  }

  const category = product.categoryId
    ? await InvProductCategory.findById(product.categoryId).session(session)
    : null;
  const strategy = resolveRemovalStrategy({
    categoryStrategy: category?.forceRemovalStrategy,
    locationStrategy: srcLocation?.removalStrategy,
  });

  const { need: demandStr, rounding } = await demandInProductUom(move, product, session);

  const existingLines = await InvMoveLine.find({
    tenantId: move.tenantId,
    moveId: move._id,
    state: { $nin: ['done', 'cancelled'] },
  }).session(session);

  let alreadyReserved = D(0);
  for (const line of existingLines) {
    alreadyReserved = alreadyReserved.plus(D(line.quantityInProductUom || line.quantity || 0));
  }

  let need = D(demandStr).minus(alreadyReserved);
  if (need.lte(0)) {
    move.state = 'assigned';
    await move.save({ session });
    return move;
  }

  const quants = await InvQuant.find({
    tenantId: move.tenantId,
    productId: move.productId,
    locationId: { $in: locationIds },
  }).session(session);

  const quantsWithLoc = await Promise.all(quants.map(async (q) => {
    const loc = await InvLocation.findById(q.locationId).session(session);
    let lotRemovalDate = null;
    let expired = false;
    if (q.lotId) {
      const lot = await InvLot.findById(q.lotId).session(session);
      lotRemovalDate = lot?.removalDate || lot?.expirationDate || null;
      expired = isLotExpired(lot);
    }
    return {
      ...q.toObject(),
      completePath: loc?.completePath || '',
      lotRemovalDate,
      expired,
    };
  }));

  // Exclude expired lots from reservation (FEFO / food-safety)
  const eligible = quantsWithLoc.filter((q) => !q.expired);
  const sorted = sortQuantsForRemoval(eligible, strategy);
  let reservedAny = false;
  /** @type {{ quantId: import('mongoose').Types.ObjectId, locationId: import('mongoose').Types.ObjectId, productId: import('mongoose').Types.ObjectId, take: string, dims: object }[]} */
  const reservedThisCall = [];

  try {
    for (const quantRow of sorted) {
      if (need.lte(0)) break;

      for (let attempt = 0; attempt < MAX_CANDIDATE_RETRIES && need.gt(0); attempt++) {
        const live = await InvQuant.findById(quantRow._id).session(session);
        if (!live) break;

        const available = D(live.quantity).minus(D(live.reservedQuantity));
        if (available.lte(0)) break;

        const dims = {
          variantId: live.variantId,
          lotId: live.lotId,
          packageId: live.packageId,
          ownerId: live.ownerId,
        };

        if (product.tracking === 'serial') {
          if (available.lt(1)) break;
          const takeStr = '1';
          const updated = await atomicReserveQuant(session, live._id, move.tenantId, takeStr, rounding);
          if (!updated) continue;

          await InvMoveLine.create([{
            tenantId: move.tenantId,
            moveId: move._id,
            transferId: move.transferId,
            productId: move.productId,
            variantId: move.variantId || null,
            uomId: move.uomId,
            quantity: '1',
            quantityInProductUom: '1',
            sourceLocationId: live.locationId,
            destLocationId: move.destLocationId,
            lotId: live.lotId || null,
            packageId: live.packageId || null,
            ownerId: live.ownerId || null,
            state: move.state,
            reference: move.reference,
            createdBy: move.createdBy,
          }], { session });

          reservedThisCall.push({
            quantId: live._id,
            locationId: live.locationId,
            productId: move.productId,
            take: takeStr,
            dims,
          });
          need = need.minus(1);
          reservedAny = true;
          break;
        }

        const rawTake = decMin(need, available);
        const take = decRoundDown(rawTake, rounding);
        if (!decIsPositive(take)) break;

        const takeStr = decStr(take);
        const updated = await atomicReserveQuant(session, live._id, move.tenantId, takeStr, rounding);
        if (!updated) continue;

        await InvMoveLine.create([{
          tenantId: move.tenantId,
          moveId: move._id,
          transferId: move.transferId,
          productId: move.productId,
          variantId: move.variantId || null,
          uomId: move.uomId,
          quantity: takeStr,
          quantityInProductUom: takeStr,
          sourceLocationId: live.locationId,
          destLocationId: move.destLocationId,
          lotId: live.lotId || null,
          packageId: live.packageId || null,
          ownerId: live.ownerId || null,
          state: move.state,
          reference: move.reference,
          createdBy: move.createdBy,
        }], { session });

        reservedThisCall.push({
          quantId: live._id,
          locationId: live.locationId,
          productId: move.productId,
          take: takeStr,
          dims,
        });
        need = need.minus(take);
        reservedAny = true;
        break;
      }
    }
  } catch (err) {
    for (const r of reservedThisCall.reverse()) {
      await applyQuantDelta(
        session,
        move.tenantId,
        r.productId,
        r.locationId,
        '0',
        decStr(D(r.take).neg()),
        new Date(),
        r.dims,
      );
    }
    throw err;
  }

  if (need.lte(0)) {
    move.state = 'assigned';
  } else if (reservedAny) {
    move.state = 'partiallyAvailable';
  }

  await move.save({ session });
  return move;
}

export async function unreserveMove(move, session) {
  if (move.state === 'done') {
    throw new InventoryValidationError('Cannot unreserve a done move', 'MOVE_DONE');
  }

  const lines = await InvMoveLine.find({
    tenantId: move.tenantId,
    moveId: move._id,
    isPicked: { $ne: true },
    state: { $nin: ['done', 'cancelled'] },
  }).session(session);

  for (const line of lines) {
    const qty = D(line.quantityInProductUom || line.quantity || 0);
    if (qty.gt(0)) {
      await applyQuantDelta(
        session,
        move.tenantId,
        line.productId,
        line.sourceLocationId,
        '0',
        decStr(qty.neg()),
        new Date(),
        {
          variantId: line.variantId,
          lotId: line.lotId,
          packageId: line.packageId,
          ownerId: line.ownerId,
        },
      );
    }
    await InvMoveLine.deleteOne({ _id: line._id }).session(session);
  }

  if (move.state !== 'waiting' && move.state !== 'cancelled') {
    move.state = 'confirmed';
  }
  await move.save({ session });
  return move;
}

export async function reserveTransfer(transferId, tenantId, session) {
  const moves = await InvMove.find({
    tenantId: toObjectId(tenantId),
    transferId: toObjectId(transferId),
    state: { $in: ['confirmed', 'partiallyAvailable', 'waiting'] },
  }).session(session);

  for (const move of moves) {
    if (move.state === 'waiting') continue;
    await reserveMove(move, session);
  }
}
