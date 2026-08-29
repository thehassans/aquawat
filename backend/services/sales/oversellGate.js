import mongoose from 'mongoose';
import InvQuant from '../../models/inventory/InvQuant.js';
import InvLocation from '../../models/inventory/InvLocation.js';
import { getSalesSettings } from './salesLifecycle.js';

/**
 * Check warehouse available qty for MTS sell lines (skip mto/dropship).
 * oversellPolicy: warn | block | allow
 */
export async function evaluateSellOrderOversell(order, tenantId, { allowOversell = false } = {}) {
  const settings = await getSalesSettings(tenantId);
  const policy = String(settings?.oversellPolicy || 'warn').toLowerCase();
  if (policy === 'allow' || allowOversell) {
    return { ok: true, policy, shortages: [] };
  }

  const warehouseId = order.warehouseId;
  if (!warehouseId) {
    return { ok: true, policy, shortages: [], skipped: true };
  }

  const mtsLines = (order.lineItems || []).filter((li) => {
    const route = String(li.procurementRoute || 'mts').toLowerCase();
    return route === 'mts' && li.productId && Number(li.quantityOrdered) > 0;
  });
  if (!mtsLines.length) return { ok: true, policy, shortages: [] };

  const locations = await InvLocation.find({
    tenantId,
    warehouseId,
    usage: { $in: ['internal', 'transit'] },
  }).select('_id').lean();
  const locationIds = locations.map((l) => l._id);
  if (!locationIds.length) {
    // No inv locations — soft skip (engine may be off)
    return { ok: true, policy, shortages: [], skipped: true };
  }

  const productIds = [...new Set(mtsLines.map((l) => String(l.productId)))];
  const quants = await InvQuant.find({
    tenantId,
    productId: { $in: productIds.map((id) => new mongoose.Types.ObjectId(id)) },
    locationId: { $in: locationIds },
    inventoryStatus: 'available',
  }).select('productId variantId quantity reservedQuantity').lean();

  const avail = new Map();
  for (const q of quants) {
    const key = `${q.productId}:${q.variantId || ''}`;
    const free = (Number(q.quantity) || 0) - (Number(q.reservedQuantity) || 0);
    avail.set(key, (avail.get(key) || 0) + free);
  }

  const shortages = [];
  for (const li of mtsLines) {
    const key = `${li.productId}:${li.variantId || ''}`;
    const need = Number(li.quantityOrdered) || 0;
    const have = avail.get(key) || 0;
    if (have + 1e-9 < need) {
      shortages.push({
        productId: li.productId,
        variantId: li.variantId || null,
        needed: need,
        available: have,
        short: need - have,
      });
    }
    // consume for multi-line same product
    avail.set(key, have - need);
  }

  if (!shortages.length) return { ok: true, policy, shortages: [] };

  if (policy === 'block') {
    return {
      ok: false,
      policy,
      shortages,
      error: `Insufficient stock for ${shortages.length} line(s)`,
      code: 'OVERSELL_BLOCKED',
    };
  }

  // warn: allow confirm but surface warning
  return {
    ok: true,
    policy,
    shortages,
    warning: `Stock shortfall on ${shortages.length} line(s); confirming may create backorders`,
    code: 'OVERSELL_WARNING',
  };
}

export default evaluateSellOrderOversell;
