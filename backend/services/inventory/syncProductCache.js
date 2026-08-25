import { D, decStr } from '../../utils/decimal.js';
import Product from '../../models/Product.js';
import InvQuant from '../../models/inventory/InvQuant.js';
import InvLocation from '../../models/inventory/InvLocation.js';
import { toObjectId } from '../../models/inventory/common.js';

/**
 * Mirror engine on-hand into Product.stocks[] / totalStock for legacy list UIs.
 * Does not write quants — reads them only.
 */
export async function syncProductStockCache(tenantId, productId, { session = null } = {}) {
  const tid = toObjectId(tenantId);
  const pid = toObjectId(productId);

  const internalLocs = await InvLocation.find({
    tenantId: tid,
    usage: 'internal',
    active: true,
  }).select('_id warehouseId').session(session || null).lean();

  if (!internalLocs.length) return null;

  const locIds = internalLocs.map((l) => l._id);
  const quants = await InvQuant.find({
    tenantId: tid,
    productId: pid,
    locationId: { $in: locIds },
  }).session(session || null).lean();

  const byWh = new Map();
  for (const loc of internalLocs) {
    if (!loc.warehouseId) continue;
    const key = String(loc.warehouseId);
    if (!byWh.has(key)) byWh.set(key, { warehouseId: loc.warehouseId, quantity: D(0), reserved: D(0) });
  }

  const locWh = new Map(internalLocs.map((l) => [String(l._id), l.warehouseId]));
  for (const q of quants) {
    const whId = locWh.get(String(q.locationId));
    if (!whId) continue;
    const key = String(whId);
    const row = byWh.get(key) || { warehouseId: whId, quantity: D(0), reserved: D(0) };
    row.quantity = row.quantity.plus(D(q.quantity));
    row.reserved = row.reserved.plus(D(q.reservedQuantity || 0));
    byWh.set(key, row);
  }

  const product = await Product.findOne({ _id: pid, tenantId: tid }).session(session || null);
  if (!product) return null;

  const now = new Date();
  const stocks = [...byWh.values()].map((r) => {
    const existing = (product.stocks || []).find((s) => String(s.warehouseId) === String(r.warehouseId));
    return {
      warehouseId: r.warehouseId,
      quantity: Number(decStr(r.quantity)),
      reservedQuantity: Number(decStr(r.reserved)),
      minQuantity: existing?.minQuantity ?? 0,
      maxQuantity: existing?.maxQuantity,
      reorderPoint: existing?.reorderPoint ?? 10,
      lastStockUpdate: now,
      location: existing?.location,
    };
  });

  product.stocks = stocks;
  product.totalStock = stocks.reduce((s, x) => s + (Number(x.quantity) || 0), 0);
  await product.save(session ? { session } : undefined);
  return product;
}

export async function syncProductsStockCache(tenantId, productIds, opts = {}) {
  const unique = [...new Set((productIds || []).map(String).filter(Boolean))];
  for (const id of unique) {
    try {
      await syncProductStockCache(tenantId, id, opts);
    } catch (err) {
      console.error('[inventory] stock cache sync failed', id, err?.message || err);
    }
  }
}
