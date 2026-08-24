import mongoose from 'mongoose';
import { D, decStr, decIsPositive } from '../../utils/decimal.js';
import {
  StockPicking,
  StockMove,
  StockMoveLine,
  StockQuant,
  StockOperationType,
  StockLocation,
  StockLot,
  StockProductVariant,
  StockProductTemplate,
} from '../../models/stock/index.js';
import { nextSequenceName } from './sequence.js';
import { reserveMove, unreserveMove, runWithTransaction } from './reserve.js';
import { computePickingState } from './pickingState.js';
import { StockValidationError } from './errors.js';
import { ensureStockBootstrap } from './bootstrap.js';
import { applyQuantDelta } from './quantDelta.js';
import { resolvePutawayLocation } from './putaway.js';
import { createValuationForMove } from './valuation.js';

async function resolveOrCreateLot(session, tenantId, productId, lotId, lotName, template, createdBy) {
  if (lotId) {
    const existing = await StockLot.findOne({ _id: lotId, tenantId, productId }).session(session);
    if (!existing) throw new StockValidationError('Lot not found', 'LOT_NOT_FOUND');
    return existing;
  }
  if (!lotName) return null;

  let lot = await StockLot.findOne({ tenantId, productId, name: lotName }).session(session);
  if (lot) return lot;

  const now = new Date();
  const dates = {};
  if (template?.useExpirationDate) {
    const addDays = (d) => {
      const x = new Date(now);
      x.setDate(x.getDate() + (Number(d) || 0));
      return x;
    };
    if (template.expirationTime) dates.expirationDate = addDays(template.expirationTime);
    if (template.useTime) dates.useDate = addDays(template.useTime);
    if (template.removalTime) dates.removalDate = addDays(template.removalTime);
    if (template.alertTime) dates.alertDate = addDays(template.alertTime);
  }

  [lot] = await StockLot.create([{
    tenantId,
    productId,
    name: lotName,
    ...dates,
    createdBy,
  }], { session });
  return lot;
}

/**
 * Confirm picking — moves draft → confirmed, optionally reserve.
 */
export async function confirmPicking(pickingId, tenantId) {
  return runWithTransaction(async (session) => {
    const picking = await StockPicking.findOne({ _id: pickingId, tenantId }).session(session);
    if (!picking) throw new StockValidationError('Picking not found', 'PICKING_NOT_FOUND');
    if (picking.state === 'done') throw new StockValidationError('Picking already done', 'PICKING_DONE');

    const opType = await StockOperationType.findById(picking.operationTypeId).session(session);
    const moves = await StockMove.find({ tenantId, pickingId: picking._id, state: { $ne: 'cancel' } }).session(session);

    for (const move of moves) {
      if (move.state === 'draft') {
        move.state = move.moveOrigIds?.length ? 'waiting' : 'confirmed';
        await move.save({ session });
      }
      if (opType.reservationMethod === 'at_confirm' && ['confirmed', 'partially_available'].includes(move.state)) {
        await reserveMove(move, session);
      }
    }

    const refreshedMoves = await StockMove.find({ tenantId, pickingId: picking._id }).session(session);
    picking.state = computePickingState(refreshedMoves);
    await picking.save({ session });
    return picking;
  });
}

export async function checkAvailability(pickingId, tenantId) {
  return runWithTransaction(async (session) => {
    const picking = await StockPicking.findOne({ _id: pickingId, tenantId }).session(session);
    if (!picking) throw new StockValidationError('Picking not found', 'PICKING_NOT_FOUND');

    const moves = await StockMove.find({
      tenantId,
      pickingId: picking._id,
      state: { $in: ['confirmed', 'partially_available', 'waiting'] },
    }).session(session);

    for (const move of moves) {
      if (move.state !== 'waiting') await reserveMove(move, session);
    }

    const refreshedMoves = await StockMove.find({ tenantId, pickingId: picking._id }).session(session);
    picking.state = computePickingState(refreshedMoves);
    await picking.save({ session });
    return picking;
  });
}

export async function unreservePicking(pickingId, tenantId) {
  return runWithTransaction(async (session) => {
    const picking = await StockPicking.findOne({ _id: pickingId, tenantId }).session(session);
    if (!picking) throw new StockValidationError('Picking not found', 'PICKING_NOT_FOUND');

    const moves = await StockMove.find({ tenantId, pickingId: picking._id, state: { $ne: 'done' } }).session(session);
    for (const move of moves) {
      await unreserveMove(move, session);
    }

    const refreshedMoves = await StockMove.find({ tenantId, pickingId: picking._id }).session(session);
    picking.state = computePickingState(refreshedMoves);
    await picking.save({ session });
    return picking;
  });
}

/**
 * Validate picking — apply quant deltas, mark done, handle backorder.
 * @param {string} pickingId
 * @param {string} tenantId
 * @param {{ createBackorder?: boolean|null }} opts — null = ask (throws), true/false explicit
 */
export async function validatePicking(pickingId, tenantId, opts = {}) {
  await ensureStockBootstrap(tenantId);

  const valuationJobs = [];

  const picking = await runWithTransaction(async (session) => {
    const picking = await StockPicking.findOne({ _id: pickingId, tenantId }).session(session);
    if (!picking) throw new StockValidationError('Picking not found', 'PICKING_NOT_FOUND');

    // Idempotency lock
    if (picking.state === 'done') return picking;
    if (picking.validateLock) return picking;

    picking.validateLock = new mongoose.Types.ObjectId().toString();
    await picking.save({ session });

    const opType = await StockOperationType.findById(picking.operationTypeId).session(session);
    const moves = await StockMove.find({ tenantId, pickingId: picking._id, state: { $ne: 'cancel' } }).session(session);

    if (moves.some((m) => m.state === 'draft')) {
      throw new StockValidationError('Cannot validate while moves are draft', 'DRAFT_MOVES');
    }

    let lines = await StockMoveLine.find({
      tenantId,
      pickingId: picking._id,
      state: { $nin: ['done', 'cancel'] },
    }).session(session);

    // If no lines, use move demand as immediate transfer
    if (lines.length === 0) {
      for (const move of moves) {
        if (decIsPositive(move.productUomQty)) {
          await StockMoveLine.create([{
            tenantId,
            moveId: move._id,
            pickingId: picking._id,
            productId: move.productId,
            productUomId: move.productUomId,
            quantity: move.productUomQty,
            quantityProduct: move.productUomQty,
            locationId: move.locationId,
            locationDestId: move.locationDestId,
            state: move.state,
            reference: move.reference,
          }], { session });
        }
      }
      lines = await StockMoveLine.find({ tenantId, pickingId: picking._id, state: { $nin: ['done', 'cancel'] } }).session(session);
    }

    const positiveLines = lines.filter((l) => decIsPositive(l.quantity || l.quantityProduct));
    if (positiveLines.length === 0) {
      throw new StockValidationError('You cannot validate a transfer with no quantities', 'NO_QUANTITIES');
    }

    // Lot / serial guards
    const seenIncomingSerials = new Set();
    for (const line of positiveLines) {
      const variant = await StockProductVariant.findById(line.productId).session(session);
      const template = variant
        ? await StockProductTemplate.findById(variant.templateId).session(session)
        : null;
      const tracking = template?.tracking || 'none';
      line._tracking = tracking;
      line._template = template;

      const needsLot = tracking !== 'none' && (opType.useCreateLots || opType.useExistingLots || tracking === 'lot' || tracking === 'serial');
      if (needsLot && !line.lotId && !line.lotName) {
        throw new StockValidationError(
          `Lot/serial required for product ${template?.name || line.productId}`,
          'LOT_REQUIRED',
        );
      }

      if (line.lotId || line.lotName) {
        if (opType.useCreateLots || opType.useExistingLots || tracking !== 'none') {
          const lot = await resolveOrCreateLot(
            session,
            tenantId,
            line.productId,
            line.lotId,
            line.lotName,
            template,
            picking.createdBy,
          );
          if (lot) {
            line.lotId = lot._id;
            line.lotName = lot.name;
          }
        }
      }

      if (tracking === 'serial') {
        const serialKey = `${line.productId}:${line.lotName || line.lotId}`;
        if (opType.code === 'incoming') {
          if (seenIncomingSerials.has(serialKey)) {
            throw new StockValidationError(`Duplicate serial in transfer: ${line.lotName || line.lotId}`, 'DUPLICATE_SERIAL');
          }
          seenIncomingSerials.add(serialKey);
          const existing = await StockQuant.findOne({
            tenantId,
            productId: line.productId,
            lotId: line.lotId,
          }).session(session);
          if (existing && D(existing.quantity).gt(0)) {
            throw new StockValidationError(`Serial already exists in stock: ${line.lotName || line.lotId}`, 'SERIAL_EXISTS');
          }
        } else if (opType.code === 'outgoing') {
          const srcQuant = await StockQuant.findOne({
            tenantId,
            productId: line.productId,
            locationId: line.locationId,
            lotId: line.lotId,
            packageId: line.packageId || null,
            ownerId: line.ownerId || null,
          }).session(session);
          if (!srcQuant || D(srcQuant.quantity).lte(0)) {
            throw new StockValidationError(`Serial not in source location: ${line.lotName || line.lotId}`, 'SERIAL_NOT_IN_SOURCE');
          }
        }
      }
    }

    // Backorder detection
    const needsBackorder = [];
    for (const move of moves) {
      const doneQty = positiveLines
        .filter((l) => String(l.moveId) === String(move._id))
        .reduce((s, l) => D(s).plus(D(l.quantityProduct || l.quantity)), D(0));
      if (doneQty.lt(D(move.productUomQty))) {
        needsBackorder.push({ move, remaining: decStr(D(move.productUomQty).minus(doneQty)) });
      }
    }

    if (needsBackorder.length > 0) {
      const policy = opType.createBackorder || 'ask';
      if (policy === 'ask' && opts.createBackorder == null) {
        throw new StockValidationError('Backorder required — confirm createBackorder', 'BACKORDER_REQUIRED');
      }
      if (policy === 'never' || opts.createBackorder === false) {
        // drop remaining — adjust move demand to done qty
        for (const { move } of needsBackorder) {
          const doneQty = positiveLines
            .filter((l) => String(l.moveId) === String(move._id))
            .reduce((s, l) => D(s).plus(D(l.quantityProduct || l.quantity)), D(0));
          move.productUomQty = decStr(doneQty);
          await move.save({ session });
        }
      } else if (policy === 'always' || opts.createBackorder === true) {
        await createBackorderPicking(session, picking, opType, needsBackorder, tenantId);
      }
    }

    const now = new Date();

    for (const line of positiveLines) {
      const qty = line.quantityProduct || line.quantity;
      const srcLoc = await StockLocation.findById(line.locationId).session(session);
      let destLoc = await StockLocation.findById(line.locationDestId).session(session);

      // Putaway: resolve final sublocation for receipts into internal/view destinations
      if (destLoc && (destLoc.usage === 'internal' || destLoc.usage === 'view' || opType.code === 'incoming')) {
        const putawayDest = await resolvePutawayLocation(tenantId, {
          locationInId: line.locationDestId,
          productId: line.productId,
          packageTypeId: null,
        });
        if (String(putawayDest) !== String(line.locationDestId)) {
          line.locationDestId = putawayDest;
          destLoc = await StockLocation.findById(putawayDest).session(session);
        }
      }

      const dims = {
        lotId: line.lotId || null,
        packageId: line.packageId || null,
        ownerId: line.ownerId || null,
        tracking: line._tracking,
      };

      if (srcLoc?.usage === 'internal') {
        await applyQuantDelta(session, tenantId, line.productId, line.locationId, decStr(D(0).minus(D(qty))), decStr(D(0).minus(D(qty))), now, dims);
      }
      if (destLoc?.usage === 'internal') {
        await applyQuantDelta(session, tenantId, line.productId, line.locationDestId, decStr(qty), '0', now, dims);
      }

      // Valuation when crossing internal boundary
      const srcInternal = srcLoc?.usage === 'internal';
      const destInternal = destLoc?.usage === 'internal';
      if (destInternal && !srcInternal) {
        const layer = await createValuationForMove(session, {
          tenantId,
          productId: line.productId,
          quantity: qty,
          stockMoveId: line.moveId,
          direction: 'in',
          description: `IN ${picking.name}`,
        });
        if (layer?._id) valuationJobs.push({ layerId: layer._id, direction: 'in' });
      } else if (srcInternal && !destInternal) {
        const layer = await createValuationForMove(session, {
          tenantId,
          productId: line.productId,
          quantity: qty,
          stockMoveId: line.moveId,
          direction: 'out',
          description: `OUT ${picking.name}`,
        });
        if (layer?._id) valuationJobs.push({ layerId: layer._id, direction: 'out' });
      }

      line.state = 'done';
      line.quantity = decStr(qty);
      line.quantityProduct = decStr(qty);
      await line.save({ session });
    }

    for (const move of moves) {
      const moveLines = positiveLines.filter((l) => String(l.moveId) === String(move._id));
      const doneQty = moveLines.reduce((s, l) => D(s).plus(D(l.quantityProduct || l.quantity)), D(0));
      move.quantity = decStr(doneQty);
      move.state = 'done';
      move.date = now;
      await move.save({ session });

      // Trigger chained destination moves
      for (const destId of move.moveDestIds || []) {
        const destMove = await StockMove.findById(destId).session(session);
        if (!destMove || destMove.state === 'done') continue;
        const origins = await StockMove.find({ _id: { $in: destMove.moveOrigIds || [] } }).session(session);
        if (origins.length > 0 && origins.every((o) => o.state === 'done')) {
          destMove.state = 'confirmed';
          await destMove.save({ session });
          if (opType.reservationMethod === 'at_confirm') {
            await reserveMove(destMove, session);
          }
        }
      }
    }

    picking.state = 'done';
    picking.dateDone = now;
    picking.validateLock = null;
    await picking.save({ session });
    return picking;
  });

  if (valuationJobs.length) {
    try {
      const { postValuationLayerJournal } = await import('./stockAccounting.js');
      for (const job of valuationJobs) {
        await postValuationLayerJournal({
          tenantId,
          userId: picking?.createdBy || picking?.userId,
          layerId: job.layerId,
          direction: job.direction,
        });
      }
    } catch (err) {
      console.error('[stock] valuation journal failed', err?.message || err);
    }
  }

  return picking;
}

async function createBackorderPicking(session, originalPicking, opType, needsBackorder, tenantId) {
  const name = await nextSequenceName(tenantId, opType.sequenceCode, session);
  const [backorderPicking] = await StockPicking.create([{
    tenantId,
    name,
    operationTypeId: originalPicking.operationTypeId,
    partnerId: originalPicking.partnerId,
    locationId: originalPicking.locationId,
    locationDestId: originalPicking.locationDestId,
    scheduledDate: originalPicking.scheduledDate,
    origin: originalPicking.origin,
    state: 'draft',
    backorderId: null,
    groupId: originalPicking.groupId,
    createdBy: originalPicking.createdBy,
  }], { session });

  originalPicking.backorderId = backorderPicking._id;
  await originalPicking.save({ session });

  for (const { move, remaining } of needsBackorder) {
    await StockMove.create([{
      tenantId,
      reference: move.reference,
      origin: move.origin,
      productId: move.productId,
      productUomId: move.productUomId,
      productUomQty: remaining,
      quantity: '0',
      locationId: move.locationId,
      locationDestId: move.locationDestId,
      state: 'draft',
      pickingId: backorderPicking._id,
      groupId: move.groupId,
      moveOrigIds: move.moveOrigIds,
      createdBy: move.createdBy,
    }], { session });
  }
}

export async function cancelPicking(pickingId, tenantId) {
  return runWithTransaction(async (session) => {
    const picking = await StockPicking.findOne({ _id: pickingId, tenantId }).session(session);
    if (!picking) throw new StockValidationError('Picking not found', 'PICKING_NOT_FOUND');
    if (picking.state === 'done') throw new StockValidationError('Cannot cancel done picking', 'PICKING_DONE');

    const moves = await StockMove.find({ tenantId, pickingId: picking._id }).session(session);
    for (const move of moves) {
      if (move.state !== 'done') {
        await unreserveMove(move, session);
        move.state = 'cancel';
        await move.save({ session });

        if (move.propagateCancel) {
          for (const destId of move.moveDestIds || []) {
            const dest = await StockMove.findById(destId).session(session);
            if (dest && dest.state !== 'done') {
              await unreserveMove(dest, session);
              dest.state = 'cancel';
              await dest.save({ session });
            }
          }
        }
      }
    }

    picking.state = 'cancel';
    await picking.save({ session });
    return picking;
  });
}

export async function createPicking({
  tenantId,
  userId,
  operationTypeId,
  partnerId,
  locationId,
  locationDestId,
  scheduledDate,
  origin,
  note,
  moves,
}) {
  await ensureStockBootstrap(tenantId);

  return runWithTransaction(async (session) => {
    const opType = await StockOperationType.findOne({ _id: operationTypeId, tenantId }).session(session);
    if (!opType) throw new StockValidationError('Operation type not found', 'OP_TYPE_NOT_FOUND');

    const srcId = locationId || opType.defaultLocationSrcId;
    const destId = locationDestId || opType.defaultLocationDestId;
    if (!srcId || !destId) throw new StockValidationError('Source and destination locations required', 'LOCATIONS_REQUIRED');

    const name = await nextSequenceName(tenantId, opType.sequenceCode, session);

    const [picking] = await StockPicking.create([{
      tenantId,
      name,
      operationTypeId: opType._id,
      partnerId: partnerId || null,
      locationId: srcId,
      locationDestId: destId,
      scheduledDate: scheduledDate || new Date(),
      origin,
      note,
      state: 'draft',
      userId: userId || null,
      createdBy: userId || null,
    }], { session });

    for (const m of moves || []) {
      await StockMove.create([{
        tenantId,
        reference: picking.name,
        origin: origin || picking.name,
        productId: m.productId,
        productUomId: m.productUomId,
        productUomQty: m.productUomQty || m.quantity || '0',
        quantity: '0',
        locationId: m.locationId || srcId,
        locationDestId: m.locationDestId || destId,
        state: 'draft',
        pickingId: picking._id,
        createdBy: userId || null,
      }], { session });
    }

    return picking;
  });
}
