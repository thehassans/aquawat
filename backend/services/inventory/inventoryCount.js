import { D, decStr, decIsZero, decIsPositive } from '../../utils/decimal.js';
import InvQuant from '../../models/inventory/InvQuant.js';
import InvLocation from '../../models/inventory/InvLocation.js';
import InvMove from '../../models/inventory/InvMove.js';
import InvMoveLine from '../../models/inventory/InvMoveLine.js';
import Product from '../../models/Product.js';
import { toObjectId, setDecimalPair } from '../../models/inventory/common.js';
import { applyQuantDelta } from './quantDelta.js';
import { runWithTransaction } from './reserve.js';
import { getDefaultUom } from './bootstrap.js';
import { InventoryValidationError } from './errors.js';

/**
 * List quants for physical inventory (editable count fields).
 */
export async function listInventoryQuants(tenantId, {
  locationId,
  warehouseId,
  productId,
  filter: filterName,
} = {}) {
  const tid = toObjectId(tenantId);
  const locFilter = { tenantId: tid, usage: 'internal', active: true };
  if (warehouseId) locFilter.warehouseId = warehouseId;
  if (locationId) locFilter._id = locationId;

  const locs = await InvLocation.find(locFilter).select('_id').lean();
  const locIds = locs.map((l) => l._id);

  const filter = { tenantId: tid, locationId: { $in: locIds } };
  if (productId) filter.productId = productId;

  if (filterName === 'toCount') {
    filter.$or = [
      { lastCountDate: { $exists: false } },
      { lastCountDate: null },
      { countScheduledDate: { $lte: new Date() } },
    ];
  } else if (filterName === 'toApply') {
    filter.isCountSet = true;
  } else if (filterName === 'negative') {
    filter.quantityNum = { $lt: 0 };
  } else if (filterName === 'onHand') {
    // default: any with quantity or reserved
  }

  return InvQuant.find(filter)
    .populate('productId', 'nameEn nameAr sku unitOfMeasure uomId tracking')
    .populate('locationId', 'name completePath usage warehouseId')
    .populate('lotId', 'name expirationDate removalDate')
    .sort({ updatedAt: -1 })
    .limit(500)
    .lean();
}

/**
 * Set counted quantity on a quant (survives reload).
 */
export async function setCountedQuantity(tenantId, {
  quantId,
  productId,
  locationId,
  lotId,
  packageId,
  countedQty,
  userId,
  reason,
}) {
  const tid = toObjectId(tenantId);
  const counted = decStr(countedQty);

  let quant;
  if (quantId) {
    quant = await InvQuant.findOne({ _id: quantId, tenantId: tid });
  } else {
    if (!productId || !locationId) {
      throw new InventoryValidationError('productId and locationId required', 'MISSING_FIELDS');
    }
    const dims = {
      tenantId: tid,
      productId,
      locationId,
      variantId: null,
      lotId: lotId || null,
      packageId: packageId || null,
      ownerId: null,
    };
    quant = await InvQuant.findOne(dims);
    if (!quant) {
      const doc = { ...dims, createdBy: userId };
      setDecimalPair(doc, 'quantity', '0');
      setDecimalPair(doc, 'reservedQuantity', '0');
      setDecimalPair(doc, 'value', '0');
      quant = await InvQuant.create(doc);
    }
  }

  if (!quant) throw new InventoryValidationError('Quant not found', 'QUANT_NOT_FOUND');

  const onHand = D(quant.quantity);
  quant.countedQuantity = counted;
  quant.isCountSet = true;
  quant.countDifference = decStr(D(counted).minus(onHand));
  quant.countScheduledDate = quant.countScheduledDate || new Date();
  if (userId) quant.countUserId = userId;
  if (reason) quant.countReason = reason;
  await quant.save();
  return quant;
}

export async function clearCountedQuantity(tenantId, quantId) {
  const quant = await InvQuant.findOne({ _id: quantId, tenantId: toObjectId(tenantId) });
  if (!quant) throw new InventoryValidationError('Quant not found', 'QUANT_NOT_FOUND');
  quant.countedQuantity = null;
  quant.isCountSet = false;
  quant.countDifference = '0';
  await quant.save();
  return quant;
}

/**
 * Apply inventory counts — moves vs Inventory adjustment location (ledger only).
 */
export async function applyInventoryCounts(tenantId, {
  ids,
  accountingDate,
  reason,
  userId,
}) {
  if (!ids?.length) throw new InventoryValidationError('No quant ids provided', 'NO_IDS');

  return runWithTransaction(async (session) => {
    const tid = toObjectId(tenantId);
    const invAdj = await InvLocation.findOne({
      tenantId: tid,
      usage: 'inventoryLoss',
    }).session(session);

    if (!invAdj) {
      throw new InventoryValidationError(
        'Inventory adjustment location not found — run bootstrap',
        'NO_INV_ADJ',
      );
    }

    const defaultUom = await getDefaultUom(tid);
    const quants = await InvQuant.find({
      _id: { $in: ids },
      tenantId: tid,
      isCountSet: true,
    }).session(session);

    const now = accountingDate ? new Date(accountingDate) : new Date();
    const results = [];

    for (const quant of quants) {
      const diff = D(quant.countDifference || 0);
      if (decIsZero(diff)) {
        quant.isCountSet = false;
        quant.countedQuantity = null;
        quant.countDifference = '0';
        quant.lastCountDate = now;
        await quant.save({ session });
        results.push({ quantId: quant._id, skipped: true });
        continue;
      }

      const product = await Product.findById(quant.productId).session(session);
      const uomId = product?.uomId || defaultUom?._id;
      if (!uomId) {
        throw new InventoryValidationError(`UoM missing for product ${quant.productId}`, 'NO_UOM');
      }

      const absDiff = decStr(diff.abs());
      const isGain = diff.gt(0);
      const sourceLocationId = isGain ? invAdj._id : quant.locationId;
      const destLocationId = isGain ? quant.locationId : invAdj._id;
      const ref = reason || quant.countReason || `INV/${now.toISOString().slice(0, 10)}`;

      const [move] = await InvMove.create([{
        tenantId: tid,
        reference: ref,
        origin: ref,
        productId: quant.productId,
        variantId: quant.variantId,
        uomId,
        demandQty: absDiff,
        doneQty: absDiff,
        sourceLocationId,
        destLocationId,
        state: 'done',
        date: now,
        isScrapped: false,
        createdBy: userId,
      }], { session });

      await InvMoveLine.create([{
        tenantId: tid,
        moveId: move._id,
        productId: quant.productId,
        variantId: quant.variantId,
        uomId,
        quantity: absDiff,
        quantityInProductUom: absDiff,
        sourceLocationId,
        destLocationId,
        lotId: quant.lotId || null,
        packageId: quant.packageId || null,
        ownerId: quant.ownerId || null,
        state: 'done',
        reference: ref,
        createdBy: userId,
      }], { session });

      const dims = {
        variantId: quant.variantId,
        lotId: quant.lotId,
        packageId: quant.packageId,
        ownerId: quant.ownerId,
        tracking: product?.tracking,
      };

      if (isGain) {
        // Dest internal only — source is virtual
        await applyQuantDelta(session, tid, quant.productId, quant.locationId, absDiff, '0', now, dims);
      } else {
        await applyQuantDelta(
          session,
          tid,
          quant.productId,
          quant.locationId,
          decStr(D(0).minus(D(absDiff))),
          '0',
          now,
          dims,
        );
      }

      quant.isCountSet = false;
      quant.countedQuantity = null;
      quant.countDifference = '0';
      quant.lastCountDate = now;
      if (reason) quant.countReason = reason;
      await quant.save({ session });

      results.push({ quantId: quant._id, moveId: move._id, diff: absDiff, isGain });
    }

    return { applied: results.length, results };
  });
}

export async function requestCount(tenantId, { locationId, productIds, scheduledDate, userId }) {
  const tid = toObjectId(tenantId);
  const filter = { tenantId: tid };
  if (locationId) filter.locationId = locationId;
  if (productIds?.length) filter.productId = { $in: productIds };

  const when = scheduledDate ? new Date(scheduledDate) : new Date();
  const res = await InvQuant.updateMany(filter, {
    $set: {
      countScheduledDate: when,
      countUserId: userId || undefined,
    },
  });
  return { matched: res.matchedCount, modified: res.modifiedCount };
}
