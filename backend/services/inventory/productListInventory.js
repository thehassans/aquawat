import { D, decStr } from '../../utils/decimal.js';
import InvQuant from '../../models/inventory/InvQuant.js';
import InvMove from '../../models/inventory/InvMove.js';
import InvLocation from '../../models/inventory/InvLocation.js';
import InvProductVariant from '../../models/inventory/InvProductVariant.js';
import { toObjectId } from '../../models/inventory/common.js';
import { isInvEngineEnabled } from './legacyAdapter.js';

function qtyOf(q) {
  return Number(q?.quantity ?? q?.quantityNum ?? 0) || 0;
}

function reservedOf(q) {
  return Number(q?.reservedQuantity ?? q?.reservedQuantityNum ?? 0) || 0;
}

function productRequiresVariantStock(product, variantCount) {
  const lines = Array.isArray(product?.attributeLines) ? product.attributeLines.length : 0;
  return lines > 0 || Number(variantCount) > 0;
}

/**
 * Overlay engine on-hand / available / forecasted onto product list rows.
 * When a template has variants (or attribute lines), stock is SUM of child
 * variant quants only — never null-variant template phantom stock.
 */
export async function applyEngineInventoryToProducts(tenantId, products, {
  buildHealth,
} = {}) {
  if (!products?.length) return products || [];

  const engineOn = await isInvEngineEnabled(tenantId);
  if (!engineOn) {
    return products.map((p) => {
      const vc = 0;
      if (typeof buildHealth === 'function') buildHealth(p);
      p.variantCount = vc;
      p.inventory = {
        ...(p.inventory || {}),
        variantCount: vc,
        aggregatedFromVariants: false,
        engine: false,
      };
      return p;
    });
  }

  const tid = toObjectId(tenantId);
  const ids = products.map((p) => toObjectId(p._id)).filter(Boolean);

  const [variantAgg, internalLocs] = await Promise.all([
    InvProductVariant.aggregate([
      { $match: { tenantId: tid, productId: { $in: ids }, active: true } },
      { $group: { _id: '$productId', count: { $sum: 1 } } },
    ]),
    InvLocation.find({
      tenantId: tid,
      usage: 'internal',
      active: true,
    }).select('_id').lean(),
  ]);

  const variantCountByProduct = new Map(
    variantAgg.map((r) => [String(r._id), r.count]),
  );
  const locIds = internalLocs.map((l) => l._id);
  const locIdSet = new Set(locIds.map(String));

  const quants = locIds.length
    ? await InvQuant.find({
      tenantId: tid,
      productId: { $in: ids },
      locationId: { $in: locIds },
    }).select('productId variantId quantity quantityNum reservedQuantity reservedQuantityNum').lean()
    : [];

  const stockByProduct = new Map();
  for (const q of quants) {
    const pid = String(q.productId);
    let bucket = stockByProduct.get(pid);
    if (!bucket) {
      bucket = { variantOh: 0, variantRes: 0, nullOh: 0, nullRes: 0, allOh: 0, allRes: 0 };
      stockByProduct.set(pid, bucket);
    }
    const oh = qtyOf(q);
    const res = reservedOf(q);
    bucket.allOh += oh;
    bucket.allRes += res;
    if (q.variantId) {
      bucket.variantOh += oh;
      bucket.variantRes += res;
    } else {
      bucket.nullOh += oh;
      bucket.nullRes += res;
    }
  }

  // Pending moves for forecast (incoming − outgoing)
  const pendingMoves = await InvMove.find({
    tenantId: tid,
    productId: { $in: ids },
    state: { $in: ['waiting', 'confirmed', 'partiallyAvailable', 'assigned'] },
  }).select('productId variantId sourceLocationId destLocationId demandQty doneQty').lean();

  const forecastDelta = new Map(); // productId -> { in, out } for applicable moves
  for (const m of pendingMoves) {
    const pid = String(m.productId);
    const srcInternal = locIdSet.has(String(m.sourceLocationId));
    const destInternal = locIdSet.has(String(m.destLocationId));
    const rem = (Number(m.demandQty) || 0) - (Number(m.doneQty) || 0);
    if (rem <= 0) continue;
    let d = forecastDelta.get(pid);
    if (!d) {
      d = { inAll: 0, outAll: 0, inVar: 0, outVar: 0 };
      forecastDelta.set(pid, d);
    }
    if (destInternal && !srcInternal) {
      d.inAll += rem;
      if (m.variantId) d.inVar += rem;
    }
    if (srcInternal && !destInternal) {
      d.outAll += rem;
      if (m.variantId) d.outVar += rem;
    }
  }

  return products.map((p) => {
    const pid = String(p._id);
    const variantCount = variantCountByProduct.get(pid) || 0;
    const fromVariants = productRequiresVariantStock(p, variantCount);
    const bucket = stockByProduct.get(pid) || {
      variantOh: 0, variantRes: 0, nullOh: 0, nullRes: 0, allOh: 0, allRes: 0,
    };

    const onHand = fromVariants ? bucket.variantOh : bucket.allOh;
    const reserved = fromVariants ? bucket.variantRes : bucket.allRes;
    const available = onHand - reserved;

    const delta = forecastDelta.get(pid) || { inAll: 0, outAll: 0, inVar: 0, outVar: 0 };
    const incoming = fromVariants ? delta.inVar : delta.inAll;
    const outgoing = fromVariants ? delta.outVar : delta.outAll;
    const forecasted = available + incoming - outgoing;

    const prev = p.inventory || {};
    const reorderPoint = Number(prev.reorderPoint) || 10;
    const tracked = prev.tracked !== false;

    let health = 'in_stock';
    if (!tracked) health = 'not_tracked';
    else if (available <= 0) health = p.allowNegativeStock ? 'backorder' : 'out_of_stock';
    else if (available <= reorderPoint) health = 'low_stock';

    p.variantCount = variantCount;
    p.totalStock = onHand;
    p.inventory = {
      ...prev,
      onHand: tracked ? onHand : 0,
      reserved: tracked ? reserved : 0,
      available: tracked ? available : 0,
      forecasted: tracked ? forecasted : 0,
      reorderPoint,
      health,
      tracked,
      variantCount,
      aggregatedFromVariants: fromVariants,
      engine: true,
    };
    return p;
  });
}

/** Single-product engine on-hand respecting variant aggregation rules. */
export async function computeProductListOnHand(tenantId, productOrId, opts = {}) {
  const product = typeof productOrId === 'object' && productOrId?._id
    ? productOrId
    : { _id: productOrId };
  const [row] = await applyEngineInventoryToProducts(tenantId, [product], opts);
  return {
    onHand: decStr(D(row?.inventory?.onHand || 0)),
    reserved: decStr(D(row?.inventory?.reserved || 0)),
    freeToUse: decStr(D(row?.inventory?.available || 0)),
    forecasted: decStr(D(row?.inventory?.forecasted || 0)),
    variantCount: row?.variantCount || 0,
    aggregatedFromVariants: !!row?.inventory?.aggregatedFromVariants,
  };
}
