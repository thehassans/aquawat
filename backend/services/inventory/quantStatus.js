import InvQuant from '../../models/inventory/InvQuant.js';
import { D, decStr } from '../../utils/decimal.js';
import { toObjectId } from '../../models/inventory/common.js';
import { InventoryValidationError } from './errors.js';
import { recordConfigAudit } from './configAudit.js';

export const QUANT_INVENTORY_STATUSES = ['available', 'quarantine', 'damaged', 'on_hold', 'expired'];

export const RESERVABLE_INVENTORY_STATUSES = new Set(['available']);

export function isQuantReservable(status) {
  return !status || RESERVABLE_INVENTORY_STATUSES.has(status);
}

/**
 * B.4 — change quant inventory status (only available is reservable).
 */
export async function updateQuantInventoryStatus(tenantId, quantId, {
  status,
  reason,
  userId = null,
} = {}) {
  const tid = toObjectId(tenantId);
  if (!QUANT_INVENTORY_STATUSES.includes(status)) {
    throw new InventoryValidationError(
      `status must be one of: ${QUANT_INVENTORY_STATUSES.join(', ')}`,
      'BAD_STATUS',
    );
  }

  const quant = await InvQuant.findOne({ _id: quantId, tenantId: tid });
  if (!quant) throw new InventoryValidationError('Quant not found', 'QUANT_NOT_FOUND');

  const prior = quant.inventoryStatus || 'available';
  if (prior === status) return quant;

  if (!isQuantReservable(status) && D(quant.reservedQuantity).gt(0)) {
    throw new InventoryValidationError(
      'Cannot change status while quantity is reserved — unreserve first',
      'RESERVED',
    );
  }

  quant.inventoryStatus = status;
  if (reason) quant.statusReason = reason;
  quant.statusChangedAt = new Date();
  if (userId) quant.statusChangedBy = userId;
  await quant.save();

  await recordConfigAudit({
    tenantId: tid,
    userId,
    resourceType: 'quant_status',
    resourceId: quant._id,
    resourceName: `${quant.productId}@${quant.locationId}`,
    changes: [{ field: 'inventoryStatus', from: prior, to: status }],
    note: reason || null,
  });

  return quant;
}

/** B.2 — write off expired quant via scrap document */
export async function writeOffExpiredQuant(tenantId, quantId, userId) {
  const tid = toObjectId(tenantId);
  const quant = await InvQuant.findOne({ _id: quantId, tenantId: tid }).populate('lotId');
  if (!quant) throw new InventoryValidationError('Quant not found', 'QUANT_NOT_FOUND');
  const lot = quant.lotId;
  if (!lot?.expirationDate || new Date(lot.expirationDate) >= new Date()) {
    throw new InventoryValidationError('Lot is not expired', 'NOT_EXPIRED');
  }
  const qty = D(quant.quantity || 0);
  if (qty.lte(0)) throw new InventoryValidationError('Nothing to write off', 'NO_QTY');

  const { createScrap, validateScrap } = await import('./scrapService.js');
  const scrap = await createScrap(tid, userId, {
    productId: quant.productId,
    variantId: quant.variantId,
    lotId: quant.lotId?._id || quant.lotId,
    sourceLocationId: quant.locationId,
    quantity: decStr(qty),
    reasonTag: 'Expired',
    note: `Auto write-off lot ${lot.name || lot._id}`,
  });
  const validated = await validateScrap(scrap._id, tid, userId);
  return validated;
}
