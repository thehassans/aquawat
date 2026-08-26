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
