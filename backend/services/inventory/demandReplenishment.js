import { D, decStr } from '../../utils/decimal.js';
import InvMoveLine from '../../models/inventory/InvMoveLine.js';
import InvLocation from '../../models/inventory/InvLocation.js';
import InvReorderRule from '../../models/inventory/InvReorderRule.js';
import Product from '../../models/Product.js';
import { toObjectId } from '../../models/inventory/common.js';
import { getInvSettings } from './settingsService.js';
import { computeOnHand } from './forecast.js';

const SERVICE_LEVEL_Z = { 90: 1.28, 95: 1.65, 99: 2.33 };

function stdDev(values) {
  if (!values.length) return D(0);
  const nums = values.map((v) => D(v));
  const mean = nums.reduce((a, b) => a.plus(b), D(0)).div(nums.length);
  const variance = nums.reduce((a, b) => a.plus(b.minus(mean).pow(2)), D(0)).div(nums.length);
  return variance.sqrt();
}

/**
 * B.5 — demand-based min/max suggestions from done outbound move history.
 */
export async function computeDemandSuggestion(tenantId, productId, {
  warehouseId,
  windowDays = 90,
  reviewDays = 14,
  leadDays = 0,
  serviceLevel = 95,
  seasonalityMultiplier = 1,
} = {}) {
  const tid = toObjectId(tenantId);
  const pid = toObjectId(productId);
  const since = new Date();
  since.setDate(since.getDate() - (Number(windowDays) || 90));

  let locFilter = {};
  if (warehouseId) {
    const locs = await InvLocation.find({
      tenantId: tid,
      warehouseId: toObjectId(warehouseId),
      usage: 'internal',
      active: true,
    }).select('_id').lean();
    locFilter = { sourceLocationId: { $in: locs.map((l) => l._id) } };
  }

  const lines = await InvMoveLine.find({
    tenantId: tid,
    productId: pid,
    state: 'done',
    updatedAt: { $gte: since },
    ...locFilter,
  }).select('quantityInProductUom quantity updatedAt').lean();

  const dailyTotals = new Map();
  for (const line of lines) {
    const day = new Date(line.updatedAt).toISOString().slice(0, 10);
    const qty = D(line.quantityInProductUom || line.quantity || 0);
    dailyTotals.set(day, (dailyTotals.get(day) || D(0)).plus(qty));
  }

  const days = Math.max(1, Number(windowDays) || 90);
  const totalOut = [...dailyTotals.values()].reduce((a, b) => a.plus(b), D(0));
  const avgDaily = totalOut.div(days).mul(D(seasonalityMultiplier || 1));
  const dailyValues = [...dailyTotals.values()].map((v) => Number(v));
  const sigma = stdDev(dailyValues.length ? dailyValues : [0]);
  const z = SERVICE_LEVEL_Z[serviceLevel] ?? 1.65;
  const lead = Math.max(0, Number(leadDays) || 0);
  const review = Math.max(1, Number(reviewDays) || 14);

  const safetyStock = D(z).mul(sigma).mul(Math.sqrt(lead || 1));
  const suggestedMin = avgDaily.mul(lead + 3).plus(safetyStock);
  const suggestedMax = suggestedMin.plus(avgDaily.mul(review));

  const onHand = await computeOnHand(tid, pid, { warehouseId });

  return {
    productId: pid,
    warehouseId: warehouseId || null,
    windowDays: days,
    avgDailyDemand: decStr(avgDaily),
    sigmaDemand: decStr(sigma),
    safetyStock: decStr(safetyStock),
    suggestedMin: decStr(suggestedMin),
    suggestedMax: decStr(suggestedMax),
    onHand: decStr(onHand),
    serviceLevel,
    leadDays: lead,
    reviewDays: review,
    seasonalityMultiplier: seasonalityMultiplier || 1,
    explanation: `Based on ${decStr(avgDaily)} units/day over ${days} days, ${lead}-day lead time, ${serviceLevel}% service level`,
    explanationAr: `بناءً على ${decStr(avgDaily)} وحدة/يوم خلال ${days} يوماً، مهلة ${lead} يوم، مستوى خدمة ${serviceLevel}%`,
  };
}

export async function listDemandSuggestions(tenantId, { warehouseId, limit = 200 } = {}) {
  const tid = toObjectId(tenantId);
  const settings = await getInvSettings(tenantId);
  const windowDays = Number(settings.demandWindowDays) || 90;
  const serviceLevel = Number(settings.replenishmentServiceLevel) || 95;
  const reviewDays = Number(settings.replenishmentReviewDays) || 14;

  const filter = { tenantId: tid, active: true };
  if (warehouseId) filter.warehouseId = toObjectId(warehouseId);

  const rules = await InvReorderRule.find(filter)
    .populate('productId', 'nameEn nameAr sku costPrice seasonalityMultiplier seasonalityUntil')
    .populate('warehouseId', 'name code')
    .limit(Math.min(500, Number(limit) || 200))
    .lean();

  const rows = [];
  for (const rule of rules) {
    const product = rule.productId;
    if (!product?._id) continue;
    let mult = 1;
    if (product.seasonalityMultiplier && product.seasonalityUntil) {
      const until = new Date(product.seasonalityUntil);
      if (until >= new Date()) mult = Number(product.seasonalityMultiplier) || 1;
    }
    const sug = await computeDemandSuggestion(tid, product._id, {
      warehouseId: rule.warehouseId?._id || rule.warehouseId,
      windowDays,
      reviewDays,
      leadDays: rule.leadDays || settings.securityLeadTimePurchase || 0,
      serviceLevel,
      seasonalityMultiplier: mult,
    });
    rows.push({
      ruleId: rule._id,
      productId: product._id,
      productName: product.nameEn || product.sku,
      sku: product.sku,
      warehouseId: rule.warehouseId?._id || rule.warehouseId,
      warehouseName: rule.warehouseId?.name,
      currentMin: rule.minQty,
      currentMax: rule.maxQty,
      suggestedMin: sug.suggestedMin,
      suggestedMax: sug.suggestedMax,
      onHand: sug.onHand,
      explanation: sug.explanation,
      explanationAr: sug.explanationAr,
    });
  }
  return rows;
}

export async function applyDemandSuggestion(tenantId, ruleId, userId, { fields = ['minQty', 'maxQty'] } = {}) {
  const tid = toObjectId(tenantId);
  const rule = await InvReorderRule.findOne({ _id: ruleId, tenantId: tid });
  if (!rule) throw new Error('Reorder rule not found');
  const sug = await computeDemandSuggestion(tid, rule.productId, {
    warehouseId: rule.warehouseId,
    leadDays: rule.leadDays,
    reviewDays: Number((await getInvSettings(tenantId)).replenishmentReviewDays) || 14,
  });
  if (fields.includes('minQty')) rule.minQty = sug.suggestedMin;
  if (fields.includes('maxQty')) rule.maxQty = sug.suggestedMax;
  if (userId) rule.updatedBy = userId;
  await rule.save();
  return rule;
}

/** Group replenishment rows by preferred vendor for PO drafting */
export async function listDemandSuggestionsByVendor(tenantId, opts = {}) {
  const rows = await listDemandSuggestions(tenantId, opts);
  const tid = toObjectId(tenantId);
  const productIds = [...new Set(rows.map((r) => String(r.productId)))];
  const products = await Product.find({ _id: { $in: productIds }, tenantId: tid })
    .select('suppliers nameEn sku')
    .populate('suppliers.supplierId', 'name nameEn nameAr')
    .lean();
  const productMap = new Map(products.map((p) => [String(p._id), p]));

  const groups = new Map();
  for (const row of rows) {
    const product = productMap.get(String(row.productId));
    const preferred = (product?.suppliers || []).find((s) => s.isPreferred) || product?.suppliers?.[0];
    const vendor = preferred?.supplierId;
    const vendorKey = vendor?._id ? String(vendor._id) : '__none__';
    const vendorName = vendor?.nameEn || vendor?.name || vendor?.nameAr || 'No vendor';
    if (!groups.has(vendorKey)) {
      groups.set(vendorKey, { vendorId: vendor?._id || null, vendorName, lines: [] });
    }
    groups.get(vendorKey).lines.push({
      ...row,
      vendorSku: preferred?.supplierSku || null,
      vendorCost: preferred?.cost ?? null,
    });
  }
  return [...groups.values()].sort((a, b) => a.vendorName.localeCompare(b.vendorName));
}
