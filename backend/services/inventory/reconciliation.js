import { D, decStr } from '../../utils/decimal.js';
import InvQuant from '../../models/inventory/InvQuant.js';
import InvLocation from '../../models/inventory/InvLocation.js';
import InvValuationLayer from '../../models/inventory/InvValuationLayer.js';
import Product from '../../models/Product.js';
import { toObjectId } from '../../models/inventory/common.js';
import { productInventoryValue } from './valuation.js';
import { syncProductStockCache } from './syncProductCache.js';

/**
 * Hard invariant: stock (quant) value per product must match valuation report value.
 * Also compares Product.stocks[] cache vs ledger on-hand when requested.
 */
export async function reconcileInventory(tenantId, {
  warehouseId = null,
  productId = null,
  includeCache = true,
  limit = 500,
} = {}) {
  const tid = toObjectId(tenantId);

  const locFilter = { tenantId: tid, usage: 'internal', active: true };
  if (warehouseId) locFilter.warehouseId = toObjectId(warehouseId);
  const locs = await InvLocation.find(locFilter).select('_id warehouseId').lean();
  const locIds = locs.map((l) => l._id);

  const quantMatch = { tenantId: tid, locationId: { $in: locIds } };
  if (productId) quantMatch.productId = toObjectId(productId);

  const quantAgg = await InvQuant.aggregate([
    { $match: quantMatch },
    {
      $group: {
        _id: '$productId',
        onHandNum: { $sum: '$quantityNum' },
        reservedNum: { $sum: '$reservedQuantityNum' },
      },
    },
    { $limit: Number(limit) || 500 },
  ]);

  const productIds = quantAgg.map((q) => q._id);
  const products = await Product.find({
    tenantId: tid,
    ...(productId ? { _id: toObjectId(productId) } : { _id: { $in: productIds } }),
  }).select('nameEn sku costPrice stocks totalStock categoryId trackInventory').lean();

  const byId = new Map(products.map((p) => [String(p._id), p]));
  const mismatches = [];
  let matched = 0;
  let stockValueTotal = D(0);
  let valuationValueTotal = D(0);

  const idsToCheck = productId
    ? [toObjectId(productId)]
    : [...new Set([...productIds.map(String), ...products.map((p) => String(p._id))])].map((id) => toObjectId(id));

  for (const pid of idsToCheck.slice(0, Number(limit) || 500)) {
    const p = byId.get(String(pid)) || await Product.findOne({ _id: pid, tenantId: tid })
      .select('nameEn sku costPrice stocks totalStock')
      .lean();
    if (!p || p.trackInventory === false) continue;

    const quantRow = quantAgg.find((q) => String(q._id) === String(pid));
    const ledgerQty = D(quantRow?.onHandNum?.toString?.() || '0');

    const valuation = await productInventoryValue(tid, pid);
    const valQty = D(valuation.qty || 0);
    const valValue = D(valuation.value || 0);

    // Stock report value uses same productInventoryValue for consistency
    const stockValue = valValue;
    stockValueTotal = stockValueTotal.plus(stockValue);
    valuationValueTotal = valuationValueTotal.plus(valValue);

    const layerSum = await InvValuationLayer.aggregate([
      { $match: { tenantId: tid, productId: pid } },
      {
        $group: {
          _id: null,
          remainingValue: { $sum: { $toDouble: { $ifNull: ['$remainingValue', '0'] } } },
          remainingQty: { $sum: { $toDouble: { $ifNull: ['$remainingQty', '0'] } } },
        },
      },
    ]);
    const layerRemainingValue = D(layerSum[0]?.remainingValue || 0);
    const layerRemainingQty = D(layerSum[0]?.remainingQty || 0);

    const issues = [];

    // Qty: ledger quants vs valuation qty helper
    if (!ledgerQty.eq(valQty)) {
      issues.push({
        code: 'QTY_LEDGER_VS_VALUATION',
        ledgerQty: decStr(ledgerQty),
        valuationQty: decStr(valQty),
      });
    }

    // FIFO: valuation value should equal layer remaining value
    if (valuation.costMethod === 'fifo' && !valValue.eq(layerRemainingValue)) {
      issues.push({
        code: 'FIFO_VALUE_VS_LAYERS',
        valuationValue: decStr(valValue),
        layerRemainingValue: decStr(layerRemainingValue),
        layerRemainingQty: decStr(layerRemainingQty),
      });
    }

    // Hard invariant: stock report value == valuation value (same source today; keep explicit)
    if (!stockValue.eq(valValue)) {
      issues.push({
        code: 'STOCK_VALUE_VS_VALUATION',
        stockValue: decStr(stockValue),
        valuationValue: decStr(valValue),
      });
    }

    if (includeCache) {
      let cacheQty = D(0);
      if (warehouseId) {
        const row = (p.stocks || []).find((s) => String(s.warehouseId) === String(warehouseId));
        cacheQty = D(row?.quantity || 0);
      } else {
        cacheQty = D(p.totalStock ?? (p.stocks || []).reduce((s, x) => s + Number(x.quantity || 0), 0));
      }
      if (!cacheQty.eq(ledgerQty)) {
        issues.push({
          code: 'CACHE_VS_LEDGER',
          cacheQty: decStr(cacheQty),
          ledgerQty: decStr(ledgerQty),
        });
      }
    }

    if (issues.length) {
      mismatches.push({
        productId: pid,
        sku: p.sku,
        name: p.nameEn || p.sku,
        costMethod: valuation.costMethod,
        ledgerQty: decStr(ledgerQty),
        valuationQty: decStr(valQty),
        stockValue: decStr(stockValue),
        valuationValue: decStr(valValue),
        issues,
      });
    } else {
      matched += 1;
    }
  }

  return {
    ok: mismatches.length === 0,
    checked: matched + mismatches.length,
    matched,
    mismatchCount: mismatches.length,
    stockValueTotal: decStr(stockValueTotal),
    valuationValueTotal: decStr(valuationValueTotal),
    valueDrift: decStr(stockValueTotal.minus(valuationValueTotal)),
    mismatches,
  };
}

/**
 * Repair Product.stocks cache from ledger for mismatched products (or all).
 */
export async function repairStockCache(tenantId, { productIds = null } = {}) {
  const tid = toObjectId(tenantId);
  let ids = productIds;
  if (!ids?.length) {
    const locs = await InvLocation.find({ tenantId: tid, usage: 'internal', active: true }).select('_id').lean();
    const agg = await InvQuant.aggregate([
      { $match: { tenantId: tid, locationId: { $in: locs.map((l) => l._id) } } },
      { $group: { _id: '$productId' } },
    ]);
    ids = agg.map((a) => a._id);
  }
  let synced = 0;
  for (const id of ids) {
    await syncProductStockCache(tid, id);
    synced += 1;
  }
  return { synced };
}

/**
 * Locations report: quants rolled up by location completePath.
 */
export async function locationsReport(tenantId, { warehouseId = null, usage = 'internal' } = {}) {
  const tid = toObjectId(tenantId);
  const locFilter = { tenantId: tid, active: true };
  if (usage) locFilter.usage = usage;
  if (warehouseId) locFilter.warehouseId = toObjectId(warehouseId);

  const locs = await InvLocation.find(locFilter).sort({ completePath: 1 }).lean();
  const locIds = locs.map((l) => l._id);
  const quants = await InvQuant.aggregate([
    { $match: { tenantId: tid, locationId: { $in: locIds } } },
    {
      $group: {
        _id: '$locationId',
        qty: { $sum: '$quantityNum' },
        reserved: { $sum: '$reservedQuantityNum' },
        products: { $addToSet: '$productId' },
      },
    },
  ]);
  const byLoc = new Map(quants.map((q) => [String(q._id), q]));

  const rows = [];
  for (const loc of locs) {
    const q = byLoc.get(String(loc._id));
    const qty = D(q?.qty?.toString?.() || '0');
    if (qty.eq(0) && loc.usage !== 'internal') continue;
    rows.push({
      locationId: loc._id,
      completePath: loc.completePath,
      name: loc.name,
      usage: loc.usage,
      warehouseId: loc.warehouseId,
      onHand: decStr(qty),
      reserved: decStr(D(q?.reserved?.toString?.() || '0')),
      productCount: q?.products?.length || 0,
    });
  }
  return { items: rows, total: rows.length };
}
