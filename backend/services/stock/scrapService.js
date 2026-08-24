import mongoose from 'mongoose';
import { D, decStr, decIsPositive } from '../../utils/decimal.js';
import {
  StockScrap,
  StockLocation,
  StockMove,
  StockMoveLine,
  StockProductVariant,
  StockProductTemplate,
} from '../../models/stock/index.js';
import { nextSequenceName, ensureSequence } from './sequence.js';
import { applyQuantDelta } from './quantDelta.js';
import { runWithTransaction } from './reserve.js';
import { StockValidationError } from './errors.js';

export async function createScrap(tenantId, userId, body) {
  const tid = new mongoose.Types.ObjectId(String(tenantId));
  await ensureSequence(tid, 'SP', 'SP');

  let scrapLocationId = body.scrapLocationId;
  if (!scrapLocationId) {
    const scrapLoc = await StockLocation.findOne({
      tenantId: tid,
      isScrapLocation: true,
      active: true,
    });
    if (!scrapLoc) throw new StockValidationError('Scrap location not found', 'NO_SCRAP_LOC');
    scrapLocationId = scrapLoc._id;
  }

  const variant = await StockProductVariant.findById(body.productId);
  if (!variant || String(variant.tenantId) !== String(tid)) {
    throw new StockValidationError('Product not found', 'PRODUCT_NOT_FOUND');
  }
  const template = await StockProductTemplate.findById(variant.templateId);
  const uomId = body.uomId || template?.uomId;
  if (!uomId) throw new StockValidationError('UoM required', 'NO_UOM');
  if (!body.locationId) throw new StockValidationError('locationId required', 'NO_LOCATION');
  if (!decIsPositive(body.quantity)) throw new StockValidationError('quantity must be positive', 'BAD_QTY');

  const name = await nextSequenceName(tid, 'SP');
  const [scrap] = await StockScrap.create([{
    tenantId: tid,
    name,
    productId: body.productId,
    uomId,
    quantity: decStr(body.quantity),
    lotId: body.lotId || null,
    packageId: body.packageId || null,
    locationId: body.locationId,
    scrapLocationId,
    scrapReasonTag: body.scrapReasonTag,
    state: 'draft',
    createdBy: userId,
  }]);

  return scrap;
}

/**
 * Validate scrap — move qty from internal location to scrap location via move engine.
 */
export async function validateScrap(scrapId, tenantId) {
  return runWithTransaction(async (session) => {
    const tid = new mongoose.Types.ObjectId(String(tenantId));
    const scrap = await StockScrap.findOne({ _id: scrapId, tenantId: tid }).session(session);
    if (!scrap) throw new StockValidationError('Scrap not found', 'SCRAP_NOT_FOUND');
    if (scrap.state === 'done') return scrap;

    const variant = await StockProductVariant.findById(scrap.productId).session(session);
    const template = await StockProductTemplate.findById(variant.templateId).session(session);
    const qty = decStr(scrap.quantity);
    const now = new Date();

    const [move] = await StockMove.create([{
      tenantId: tid,
      reference: scrap.name,
      origin: scrap.name,
      productId: scrap.productId,
      productUomId: scrap.uomId,
      productUomQty: qty,
      quantity: qty,
      locationId: scrap.locationId,
      locationDestId: scrap.scrapLocationId,
      state: 'done',
      date: now,
      scrapped: true,
      createdBy: scrap.createdBy,
    }], { session });

    await StockMoveLine.create([{
      tenantId: tid,
      moveId: move._id,
      productId: scrap.productId,
      productUomId: scrap.uomId,
      quantity: qty,
      quantityProduct: qty,
      locationId: scrap.locationId,
      locationDestId: scrap.scrapLocationId,
      lotId: scrap.lotId || null,
      packageId: scrap.packageId || null,
      state: 'done',
      reference: scrap.name,
      createdBy: scrap.createdBy,
    }], { session });

    const dims = {
      lotId: scrap.lotId || null,
      packageId: scrap.packageId || null,
      ownerId: null,
      tracking: template?.tracking,
    };

    await applyQuantDelta(session, tid, scrap.productId, scrap.locationId, decStr(D(0).minus(D(qty))), '0', now, dims);

    scrap.state = 'done';
    scrap.moveId = move._id;
    await scrap.save({ session });
    return scrap;
  });
}
