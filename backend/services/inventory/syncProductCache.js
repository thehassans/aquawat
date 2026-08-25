import { D, decStr } from '../../utils/decimal.js';
import Product from '../../models/Product.js';
import InvQuant from '../../models/inventory/InvQuant.js';
import InvLocation from '../../models/inventory/InvLocation.js';
import InvProductStockCache from '../../models/inventory/InvProductStockCache.js';
import { setDecimalPair, toObjectId } from '../../models/inventory/common.js';
import { computeForecast } from './forecast.js';

/**
 * Mirror engine on-hand into Product.stocks[] / totalStock and InvProductStockCache.
 * Does not write quants — reads them only. Prefer calling inside the same session as validate.
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
  const stocks = [];
  for (const r of byWh.values()) {
    let forecasted = r.quantity.minus(r.reserved);
    try {
      const fc = await computeForecast(tid, pid, { warehouseId: r.warehouseId });
      forecasted = D(fc.forecasted);
    } catch {
      /* keep free-to-use approximation */
    }

    const cacheDoc = {
      tenantId: tid,
      productId: pid,
      warehouseId: r.warehouseId,
      updatedBy: product.updatedBy,
    };
    setDecimalPair(cacheDoc, 'onHand', r.quantity);
    setDecimalPair(cacheDoc, 'reserved', r.reserved);
    setDecimalPair(cacheDoc, 'forecasted', forecasted);

    await InvProductStockCache.findOneAndUpdate(
      { tenantId: tid, productId: pid, warehouseId: r.warehouseId },
      { $set: cacheDoc },
      { upsert: true, session: session || undefined },
    );

    const existing = (product.stocks || []).find((s) => String(s.warehouseId) === String(r.warehouseId));
    stocks.push({
      warehouseId: r.warehouseId,
      quantity: Number(decStr(r.quantity)),
      reservedQuantity: Number(decStr(r.reserved)),
      minQuantity: existing?.minQuantity ?? 0,
      maxQuantity: existing?.maxQuantity,
      reorderPoint: existing?.reorderPoint ?? 10,
      lastStockUpdate: now,
      location: existing?.location,
    });
  }

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

/**
 * Assert InvProductStockCache.onHand == ledger quant sum per product/warehouse.
 */
export async function assertProductStockCache(tenantId, { limit = 500 } = {}) {
  const tid = toObjectId(tenantId);
  const caches = await InvProductStockCache.find({ tenantId: tid }).limit(limit).lean();
  const mismatches = [];

  for (const row of caches) {
    const locs = await InvLocation.find({
      tenantId: tid,
      warehouseId: row.warehouseId,
      usage: 'internal',
      active: true,
    }).select('_id').lean();
    const agg = await InvQuant.aggregate([
      {
        $match: {
          tenantId: tid,
          productId: row.productId,
          locationId: { $in: locs.map((l) => l._id) },
        },
      },
      {
        $group: {
          _id: null,
          onHand: { $sum: '$quantityNum' },
          reserved: { $sum: '$reservedQuantityNum' },
        },
      },
    ]);
    const ledgerOnHand = D(agg[0]?.onHand?.toString?.() || '0');
    const ledgerReserved = D(agg[0]?.reserved?.toString?.() || '0');
    const cacheOnHand = D(row.onHand || 0);
    const cacheReserved = D(row.reserved || 0);
    if (!ledgerOnHand.eq(cacheOnHand) || !ledgerReserved.eq(cacheReserved)) {
      mismatches.push({
        productId: row.productId,
        warehouseId: row.warehouseId,
        cacheOnHand: decStr(cacheOnHand),
        ledgerOnHand: decStr(ledgerOnHand),
        cacheReserved: decStr(cacheReserved),
        ledgerReserved: decStr(ledgerReserved),
      });
    }
  }

  return {
    ok: mismatches.length === 0,
    checked: caches.length,
    mismatchCount: mismatches.length,
    mismatches,
  };
}

/** Re-sync cache rows that drift from ledger (reads quants only — no ledger writes). */
export async function repairProductStockCache(tenantId, { limit = 500 } = {}) {
  const assert = await assertProductStockCache(tenantId, { limit });
  let repaired = 0;
  const seen = new Set();
  for (const m of assert.mismatches || []) {
    const key = String(m.productId);
    if (seen.has(key)) continue;
    seen.add(key);
    await syncProductStockCache(tenantId, m.productId);
    repaired += 1;
  }
  return { repaired, mismatchCount: assert.mismatchCount, checked: assert.checked };
}
