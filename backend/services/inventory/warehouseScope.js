import { toObjectId } from '../../models/inventory/common.js';
import InvSettings from '../../models/inventory/InvSettings.js';
import { InventoryError } from './errors.js';

/**
 * Resolve warehouse scope for the current user.
 * Empty warehouseIds on user = all warehouses (permissive).
 * Returns null (no filter) or an array of ObjectIds.
 */
export async function resolveWarehouseScope(req) {
  const settings = await InvSettings.findOne({ tenantId: req.user.tenantId }).lean();
  if (!settings?.enforceWarehouseRestriction) return null;

  const ids = Array.isArray(req.user.warehouseIds) ? req.user.warehouseIds.filter(Boolean) : [];
  if (!ids.length) return null;
  return ids.map((id) => toObjectId(id));
}

/** Build a Mongo filter fragment for warehouseId */
export function warehouseFilter(scope) {
  if (!scope || !scope.length) return {};
  return { warehouseId: { $in: scope } };
}

/**
 * Throw if warehouseId is outside the user's allowed set (when restriction on).
 */
export async function assertWarehouseAccess(req, warehouseId) {
  if (!warehouseId) return;
  const scope = await resolveWarehouseScope(req);
  if (!scope?.length) return;
  const ok = scope.some((id) => String(id) === String(warehouseId));
  if (!ok) {
    throw new InventoryError('Warehouse not allowed for this user', 'WAREHOUSE_FORBIDDEN', 403);
  }
}
