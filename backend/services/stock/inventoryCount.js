import mongoose from 'mongoose';
import { D, decStr, decIsZero } from '../../utils/decimal.js';
import {
  StockQuant,
  StockLocation,
  StockMove,
  StockMoveLine,
  StockProductVariant,
} from '../../models/stock/index.js';
import { applyQuantDelta } from './quantDelta.js';
import { runWithTransaction } from './reserve.js';
import { StockValidationError } from './errors.js';

/**
 * List quants for physical inventory (editable count fields).
 */
export async function listInventoryQuants(tenantId, { locationId, productId, onlySet } = {}) {
  const tid = new mongoose.Types.ObjectId(String(tenantId));
  const filter = { tenantId: tid };
  if (locationId) filter.locationId = locationId;
  if (productId) filter.productId = productId;
  if (onlySet === 'true' || onlySet === true) filter.inventoryQuantitySet = true;

  return StockQuant.find(filter)
    .populate('productId')
    .populate('locationId', 'completeName usage')
    .populate({ path: 'lotId', select: 'name expirationDate removalDate', model: 'StockLot' })
    .sort({ updatedAt: -1 })
    .lean();
}

/**
 * Set counted quantity on a quant (survives reload).
 */
export async function setCountedQuantity(tenantId, { quantId, productId, locationId, lotId, countedQty, userId }) {
  const tid = new mongoose.Types.ObjectId(String(tenantId));
  const counted = decStr(countedQty);

  let quant;
  if (quantId) {
    quant = await StockQuant.findOne({ _id: quantId, tenantId: tid });
  } else {
    if (!productId || !locationId) {
      throw new StockValidationError('productId and locationId required', 'MISSING_FIELDS');
    }
    quant = await StockQuant.findOne({
      tenantId: tid,
      productId,
      locationId,
      lotId: lotId || null,
      packageId: null,
      ownerId: null,
    });
    if (!quant) {
      quant = await StockQuant.create({
        tenantId: tid,
        productId,
        locationId,
        lotId: lotId || null,
        packageId: null,
        ownerId: null,
        quantity: '0',
        reservedQuantity: '0',
        createdBy: userId,
      });
    }
  }

  if (!quant) throw new StockValidationError('Quant not found', 'QUANT_NOT_FOUND');

  const onHand = D(quant.quantity);
  quant.inventoryQuantity = counted;
  quant.inventoryQuantitySet = true;
  quant.inventoryDiffQuantity = decStr(D(counted).minus(onHand));
  quant.inventoryDate = new Date();
  if (userId) quant.userId = userId;
  await quant.save();
  return quant;
}

/**
 * Apply inventory counts — create moves vs Inventory adjustment location.
 * Positive diff = in from inventory adj; negative = out to inventory adj.
 */
export async function applyInventoryCounts(tenantId, { ids, accountingDate, reason, userId }) {
  if (!ids?.length) throw new StockValidationError('No quant ids provided', 'NO_IDS');

  return runWithTransaction(async (session) => {
    const tid = new mongoose.Types.ObjectId(String(tenantId));
    const invAdj = await StockLocation.findOne({
      tenantId: tid,
      usage: 'inventory',
      completeName: /Inventory adjustment/i,
    }).session(session);

    if (!invAdj) {
      throw new StockValidationError('Inventory adjustment location not found — run bootstrap', 'NO_INV_ADJ');
    }

    const quants = await StockQuant.find({
      _id: { $in: ids },
      tenantId: tid,
      inventoryQuantitySet: true,
    }).session(session);

    const now = accountingDate ? new Date(accountingDate) : new Date();
    const results = [];

    for (const quant of quants) {
      const diff = D(quant.inventoryDiffQuantity || 0);
      if (decIsZero(diff)) {
        quant.inventoryQuantitySet = false;
        quant.inventoryQuantity = null;
        quant.inventoryDiffQuantity = '0';
        quant.lastCountDate = now;
        await quant.save({ session });
        results.push({ quantId: quant._id, skipped: true });
        continue;
      }

      const variant = await StockProductVariant.findById(quant.productId).session(session);
      const template = variant
        ? await mongoose.model('StockProductTemplate').findById(variant.templateId).session(session)
        : null;
      if (!template?.uomId) {
        throw new StockValidationError(`UoM missing for product ${quant.productId}`, 'NO_UOM');
      }

      const absDiff = decStr(diff.abs());
      const isGain = diff.gt(0);
      const locationId = isGain ? invAdj._id : quant.locationId;
      const locationDestId = isGain ? quant.locationId : invAdj._id;
      const ref = reason ? `INV/${reason}` : `INV/${now.toISOString().slice(0, 10)}`;

      const [move] = await StockMove.create([{
        tenantId: tid,
        reference: ref,
        origin: ref,
        productId: quant.productId,
        productUomId: template.uomId,
        productUomQty: absDiff,
        quantity: absDiff,
        locationId,
        locationDestId,
        state: 'done',
        date: now,
        createdBy: userId,
      }], { session });

      await StockMoveLine.create([{
        tenantId: tid,
        moveId: move._id,
        productId: quant.productId,
        productUomId: template.uomId,
        quantity: absDiff,
        quantityProduct: absDiff,
        locationId,
        locationDestId,
        lotId: quant.lotId || null,
        packageId: quant.packageId || null,
        ownerId: quant.ownerId || null,
        state: 'done',
        reference: ref,
        createdBy: userId,
      }], { session });

      const dims = {
        lotId: quant.lotId || null,
        packageId: quant.packageId || null,
        ownerId: quant.ownerId || null,
        tracking: template.tracking,
      };

      if (isGain) {
        await applyQuantDelta(session, tid, quant.productId, quant.locationId, absDiff, '0', now, dims);
      } else {
        await applyQuantDelta(session, tid, quant.productId, quant.locationId, decStr(D(0).minus(D(absDiff))), '0', now, dims);
      }

      // Re-fetch after delta (quant may have been GC'd or mutated)
      const refreshed = await StockQuant.findById(quant._id).session(session);
      if (refreshed) {
        refreshed.inventoryQuantitySet = false;
        refreshed.inventoryQuantity = null;
        refreshed.inventoryDiffQuantity = '0';
        refreshed.lastCountDate = now;
        refreshed.inventoryReason = reason || null;
        await refreshed.save({ session });
      }

      results.push({ quantId: quant._id, moveId: move._id, diff: decStr(diff) });
    }

    return { applied: results.length, results };
  });
}
