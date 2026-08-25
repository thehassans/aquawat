import { D, decStr, decIsPositive } from '../../utils/decimal.js';
import InvScrap from '../../models/inventory/InvScrap.js';
import InvLocation from '../../models/inventory/InvLocation.js';
import InvMove from '../../models/inventory/InvMove.js';
import InvMoveLine from '../../models/inventory/InvMoveLine.js';
import Product from '../../models/Product.js';
import { toObjectId } from '../../models/inventory/common.js';
import { nextSequenceName, ensureSequence } from './sequence.js';
import { applyQuantDelta } from './quantDelta.js';
import { runWithTransaction } from './reserve.js';
import { getDefaultUom } from './bootstrap.js';
import { InventoryValidationError } from './errors.js';
import { computeMoveDoneChecksum, computeMoveLineDoneChecksum } from './doneChecksum.js';

export async function createScrap(tenantId, userId, body) {
  const tid = toObjectId(tenantId);
  await ensureSequence(tid, 'SCR', 'SCR');

  let scrapLocationId = body.scrapLocationId;
  if (!scrapLocationId) {
    const scrapLoc = await InvLocation.findOne({
      tenantId: tid,
      $or: [{ isScrapLocation: true }, { usage: 'scrap' }],
      active: true,
    });
    if (!scrapLoc) throw new InventoryValidationError('Scrap location not found', 'NO_SCRAP_LOC');
    scrapLocationId = scrapLoc._id;
  }

  const product = await Product.findOne({ _id: body.productId, tenantId: tid });
  if (!product) throw new InventoryValidationError('Product not found', 'PRODUCT_NOT_FOUND');

  const defaultUom = await getDefaultUom(tid);
  const uomId = body.uomId || product.uomId || defaultUom?._id;
  if (!uomId) throw new InventoryValidationError('UoM required', 'NO_UOM');
  if (!body.sourceLocationId && !body.locationId) {
    throw new InventoryValidationError('sourceLocationId required', 'NO_LOCATION');
  }
  if (!decIsPositive(body.quantity)) {
    throw new InventoryValidationError('quantity must be positive', 'BAD_QTY');
  }

  const name = await nextSequenceName(tid, 'SCR');
  return InvScrap.create({
    tenantId: tid,
    name,
    productId: product._id,
    uomId,
    quantity: decStr(body.quantity),
    lotId: body.lotId || null,
    packageId: body.packageId || null,
    sourceLocationId: body.sourceLocationId || body.locationId,
    scrapLocationId,
    transferId: body.transferId || null,
    reasonTag: body.reasonTag || body.scrapReasonTag,
    note: body.note,
    date: body.date || new Date(),
    responsibleId: body.responsibleId || userId,
    state: 'draft',
    createdBy: userId,
  });
}

/**
 * Validate scrap — move qty from internal → scrap via move ledger.
 */
export async function validateScrap(scrapId, tenantId) {
  return runWithTransaction(async (session) => {
    const tid = toObjectId(tenantId);
    const scrap = await InvScrap.findOne({ _id: scrapId, tenantId: tid }).session(session);
    if (!scrap) throw new InventoryValidationError('Scrap not found', 'SCRAP_NOT_FOUND');
    if (scrap.state === 'done') return scrap;

    const product = await Product.findById(scrap.productId).session(session);
    const qty = decStr(scrap.quantity);
    const now = scrap.date || new Date();

    const [move] = await InvMove.create([{
      tenantId: tid,
      reference: scrap.name,
      origin: scrap.name,
      productId: scrap.productId,
      uomId: scrap.uomId,
      demandQty: qty,
      doneQty: qty,
      sourceLocationId: scrap.sourceLocationId,
      destLocationId: scrap.scrapLocationId,
      state: 'done',
      date: now,
      doneAt: now,
      doneChecksum: computeMoveDoneChecksum({
        productId: scrap.productId,
        demandQty: qty,
        doneQty: qty,
        sourceLocationId: scrap.sourceLocationId,
        destLocationId: scrap.scrapLocationId,
        uomId: scrap.uomId,
        transferId: scrap.transferId || null,
      }),
      isScrapped: true,
      transferId: scrap.transferId || null,
      createdBy: scrap.createdBy,
    }], { session });

    await InvMoveLine.create([{
      tenantId: tid,
      moveId: move._id,
      transferId: scrap.transferId || null,
      productId: scrap.productId,
      uomId: scrap.uomId,
      quantity: qty,
      quantityInProductUom: qty,
      sourceLocationId: scrap.sourceLocationId,
      destLocationId: scrap.scrapLocationId,
      lotId: scrap.lotId || null,
      packageId: scrap.packageId || null,
      state: 'done',
      doneAt: now,
      doneChecksum: computeMoveLineDoneChecksum({
        moveId: move._id,
        productId: scrap.productId,
        quantity: qty,
        quantityInProductUom: qty,
        sourceLocationId: scrap.sourceLocationId,
        destLocationId: scrap.scrapLocationId,
        lotId: scrap.lotId || null,
        packageId: scrap.packageId || null,
      }),
      reference: scrap.name,
      createdBy: scrap.createdBy,
    }], { session });

    const dims = {
      lotId: scrap.lotId || null,
      packageId: scrap.packageId || null,
      ownerId: null,
      tracking: product?.tracking,
    };

    await applyQuantDelta(
      session,
      tid,
      scrap.productId,
      scrap.sourceLocationId,
      decStr(D(0).minus(D(qty))),
      '0',
      now,
      dims,
    );

    scrap.state = 'done';
    scrap.moveId = move._id;
    await scrap.save({ session });
    return scrap;
  });
}

export async function listScraps(tenantId, { state, page = 1, limit = 40 } = {}) {
  const filter = { tenantId: toObjectId(tenantId) };
  if (state) filter.state = state;
  const skip = (Number(page) - 1) * Number(limit);
  const [items, total] = await Promise.all([
    InvScrap.find(filter)
      .populate('productId', 'nameEn nameAr sku')
      .populate('sourceLocationId', 'name completePath')
      .populate('scrapLocationId', 'name completePath')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    InvScrap.countDocuments(filter),
  ]);
  return { items, total, page: Number(page), limit: Number(limit) };
}
