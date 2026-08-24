import mongoose from 'mongoose';
import { D, decStr, decSub, decMin, decIsPositive, decIsZero, uomToReference } from '../../utils/decimal.js';
import StockQuant from '../../models/stock/StockQuant.js';
import StockMove from '../../models/stock/StockMove.js';
import StockMoveLine from '../../models/stock/StockMoveLine.js';
import StockProductVariant from '../../models/stock/StockProductVariant.js';
import StockProductTemplate from '../../models/stock/StockProductTemplate.js';
import StockUom from '../../models/stock/StockUom.js';
import StockLocation from '../../models/stock/StockLocation.js';
import { getInternalLocationIds, sortQuantsForRemoval, resolveRemovalStrategy } from './locationHelpers.js';
import { StockValidationError } from './errors.js';

async function loadUomFactor(uomId, session) {
  const uom = await StockUom.findById(uomId).session(session);
  if (!uom) throw new StockValidationError('UoM not found', 'UOM_NOT_FOUND');
  return uom.factor || '1';
}

async function demandInProductUom(move, session) {
  const factor = await loadUomFactor(move.productUomId, session);
  const variant = await StockProductVariant.findById(move.productId).session(session);
  if (!variant) throw new StockValidationError('Product variant not found', 'PRODUCT_NOT_FOUND');
  const template = await StockProductTemplate.findById(variant.templateId).session(session);
  const templateUom = template?.uomId;
  const refQty = uomToReference(move.productUomQty, factor);
  if (String(templateUom) === String(move.productUomId)) return decStr(refQty);
  const templateFactor = await loadUomFactor(templateUom, session);
  return decStr(D(refQty).mul(D(templateFactor)));
}

/**
 * Reserve stock for a move inside an existing transaction.
 * @param {import('mongoose').Document} move
 * @param {import('mongoose').ClientSession} session
 */
export async function reserveMove(move, session) {
  if (['done', 'cancel', 'draft'].includes(move.state)) {
    return move;
  }

  const locationIds = await getInternalLocationIds(move.tenantId, move.locationId);
  if (locationIds.length === 0) {
    throw new StockValidationError('No internal locations under source', 'NO_SOURCE_LOCATIONS');
  }

  const variant = await StockProductVariant.findById(move.productId).session(session);
  const template = await StockProductTemplate.findById(variant.templateId).session(session);
  const category = template.categoryId
    ? await mongoose.model('StockProductCategory').findById(template.categoryId).session(session)
    : null;
  const srcLocation = await StockLocation.findById(move.locationId).session(session);
  const strategy = resolveRemovalStrategy({
    categoryStrategy: category?.removalStrategy,
    locationStrategy: srcLocation?.removalStrategy,
  });

  const demandStr = await demandInProductUom(move, session);

  // Already reserved qty on move lines
  const existingLines = await StockMoveLine.find({
    tenantId: move.tenantId,
    moveId: move._id,
    state: { $nin: ['done', 'cancel'] },
  }).session(session);

  let alreadyReserved = D(0);
  for (const line of existingLines) {
    alreadyReserved = alreadyReserved.plus(D(line.quantityProduct || line.quantity || 0));
  }

  let need = D(demandStr).minus(alreadyReserved);
  if (need.lte(0)) {
    move.state = 'assigned';
    await move.save({ session });
    return move;
  }

  const quants = await StockQuant.find({
    tenantId: move.tenantId,
    productId: move.productId,
    locationId: { $in: locationIds },
  }).session(session);

  // Enrich with location name + lot removal date for FEFO
  const StockLot = mongoose.model('StockLot');
  const quantsWithLoc = await Promise.all(quants.map(async (q) => {
    const loc = await StockLocation.findById(q.locationId).session(session);
    let lotRemovalDate = null;
    if (q.lotId) {
      const lot = await StockLot.findById(q.lotId).session(session);
      lotRemovalDate = lot?.removalDate || lot?.expirationDate || null;
    }
    return {
      ...q.toObject(),
      locationCompleteName: loc?.completeName || '',
      lotRemovalDate,
    };
  }));

  const sorted = sortQuantsForRemoval(quantsWithLoc, strategy);
  let reservedAny = false;

  for (const quantRow of sorted) {
    if (need.lte(0)) break;

    const quant = await StockQuant.findOne({ _id: quantRow._id }).session(session);
    if (!quant) continue;

    const available = D(quant.quantity).minus(D(quant.reservedQuantity));
    if (available.lte(0)) continue;

    // Serial: reserve one unit per line (may create multiple lines)
    if (template.tracking === 'serial') {
      if (available.lt(1)) continue;
      const take = D(1);
      quant.reservedQuantity = decStr(D(quant.reservedQuantity).plus(take));
      quant.version = (quant.version || 0) + 1;
      await quant.save({ session });

      await StockMoveLine.create([{
        tenantId: move.tenantId,
        moveId: move._id,
        pickingId: move.pickingId,
        productId: move.productId,
        productUomId: move.productUomId,
        quantity: '1',
        quantityProduct: '1',
        locationId: quant.locationId,
        locationDestId: move.locationDestId,
        lotId: quant.lotId || null,
        packageId: quant.packageId || null,
        ownerId: quant.ownerId || null,
        state: move.state,
        reference: move.reference,
        createdBy: move.createdBy,
      }], { session });

      need = need.minus(take);
      reservedAny = true;
      continue;
    }

    const take = decMin(need, available);
    if (!decIsPositive(take)) continue;

    quant.reservedQuantity = decStr(D(quant.reservedQuantity).plus(take));
    quant.version = (quant.version || 0) + 1;
    await quant.save({ session });

    await StockMoveLine.create([{
      tenantId: move.tenantId,
      moveId: move._id,
      pickingId: move.pickingId,
      productId: move.productId,
      productUomId: move.productUomId,
      quantity: decStr(take),
      quantityProduct: decStr(take),
      locationId: quant.locationId,
      locationDestId: move.locationDestId,
      lotId: quant.lotId || null,
      packageId: quant.packageId || null,
      ownerId: quant.ownerId || null,
      state: move.state,
      reference: move.reference,
      createdBy: move.createdBy,
    }], { session });

    need = need.minus(take);
    reservedAny = true;
  }

  if (need.lte(0)) {
    move.state = 'assigned';
  } else if (reservedAny) {
    move.state = 'partially_available';
  } else if (!['waiting'].includes(move.state)) {
    // keep confirmed/waiting
    if (move.state === 'draft') move.state = 'confirmed';
  }

  await move.save({ session });
  return move;
}

/**
 * Unreserve a move — decrement quant reservations, remove auto move lines.
 */
export async function unreserveMove(move, session) {
  if (move.state === 'done') {
    throw new StockValidationError('Cannot unreserve a done move', 'MOVE_DONE');
  }

  const lines = await StockMoveLine.find({
    tenantId: move.tenantId,
    moveId: move._id,
    picked: { $ne: true },
    state: { $nin: ['done', 'cancel'] },
  }).session(session);

  for (const line of lines) {
    const qty = D(line.quantityProduct || line.quantity || 0);
    if (decIsPositive(qty)) {
      const quant = await StockQuant.findOne({
        tenantId: move.tenantId,
        productId: line.productId,
        locationId: line.locationId,
        lotId: line.lotId || null,
        packageId: line.packageId || null,
        ownerId: line.ownerId || null,
      }).session(session);

      if (quant) {
        quant.reservedQuantity = decStr(D(quant.reservedQuantity).minus(qty));
        if (D(quant.reservedQuantity).lt(0)) quant.reservedQuantity = '0';
        quant.version = (quant.version || 0) + 1;
        await quant.save({ session });
      }
    }
    await StockMoveLine.deleteOne({ _id: line._id }).session(session);
  }

  move.state = move.moveOrigIds?.length ? 'waiting' : 'confirmed';
  await move.save({ session });
  return move;
}

export async function runWithTransaction(fn) {
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
 * Reserve with retry on write conflict.
 */
export async function reserveMoveWithRetry(moveId, tenantId, maxRetries = 2) {
  let lastErr;
  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await runWithTransaction(async (session) => {
        const move = await StockMove.findOne({ _id: moveId, tenantId }).session(session);
        if (!move) throw new StockValidationError('Move not found', 'MOVE_NOT_FOUND');
        return reserveMove(move, session);
      });
    } catch (err) {
      lastErr = err;
      if (i < maxRetries && (err.name === 'MongoServerError' || err.code === 'CONFLICT')) continue;
      throw err;
    }
  }
  throw lastErr;
}
