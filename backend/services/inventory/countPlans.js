import InvCountPlan from '../../models/inventory/InvCountPlan.js';
import InvLocation from '../../models/inventory/InvLocation.js';
import InvProductCategory from '../../models/inventory/InvProductCategory.js';
import Product from '../../models/Product.js';
import InvQuant from '../../models/inventory/InvQuant.js';
import { toObjectId } from '../../models/inventory/common.js';
import { InventoryValidationError } from './errors.js';
import { requestCount } from './inventoryCount.js';

const FREQ_DAYS = { weekly: 7, monthly: 30, quarterly: 90, yearly: 365 };

function nextRunFrom(frequency, from = new Date()) {
  const days = FREQ_DAYS[frequency] || 30;
  const next = new Date(from);
  next.setDate(next.getDate() + days);
  return next;
}

export async function listCountPlans(tenantId) {
  return InvCountPlan.find({ tenantId: toObjectId(tenantId), active: { $ne: false } })
    .sort({ name: 1 })
    .lean();
}

export async function upsertCountPlan(tenantId, userId, body) {
  const tid = toObjectId(tenantId);
  if (!body.name?.trim()) {
    throw new InventoryValidationError('name required', 'MISSING_NAME');
  }
  const payload = {
    tenantId: tid,
    name: String(body.name).trim(),
    scopeType: body.scopeType || 'warehouse',
    scopeId: body.scopeId || null,
    abcClass: body.abcClass || null,
    frequency: body.frequency || 'monthly',
    assignedUserId: body.assignedUserId || null,
    blindCount: body.blindCount !== false,
    active: body.active !== false,
    notes: body.notes || '',
  };
  if (body._id) {
    const plan = await InvCountPlan.findOneAndUpdate(
      { _id: body._id, tenantId: tid },
      { $set: { ...payload, updatedBy: userId } },
      { new: true },
    );
    if (!plan) throw new InventoryValidationError('Plan not found', 'PLAN_NOT_FOUND');
    return plan;
  }
  payload.nextRunAt = nextRunFrom(payload.frequency);
  payload.createdBy = userId;
  const [plan] = await InvCountPlan.create([payload]);
  return plan;
}

export async function runCountPlan(tenantId, planId, userId) {
  const tid = toObjectId(tenantId);
  const plan = await InvCountPlan.findOne({ _id: planId, tenantId: tid, active: true });
  if (!plan) throw new InventoryValidationError('Plan not found', 'PLAN_NOT_FOUND');

  let productFilter = { tenantId: tid, isActive: { $ne: false }, trackInventory: { $ne: false } };
  let locationIds = [];

  if (plan.scopeType === 'warehouse' && plan.scopeId) {
    const locs = await InvLocation.find({
      tenantId: tid,
      warehouseId: plan.scopeId,
      usage: 'internal',
      active: true,
    }).select('_id').lean();
    locationIds = locs.map((l) => l._id);
  } else if (plan.scopeType === 'location' && plan.scopeId) {
    locationIds = [plan.scopeId];
  } else if (plan.scopeType === 'category' && plan.scopeId) {
    productFilter.categoryId = plan.scopeId;
    const locs = await InvLocation.find({ tenantId: tid, usage: 'internal', active: true }).select('_id').lean();
    locationIds = locs.map((l) => l._id);
  } else if (plan.scopeType === 'abc' && plan.abcClass) {
    productFilter.abcClass = plan.abcClass;
    const locs = await InvLocation.find({ tenantId: tid, usage: 'internal', active: true }).select('_id').lean();
    locationIds = locs.map((l) => l._id);
  }

  const products = await Product.find(productFilter).select('_id').limit(500).lean();
  const result = await requestCount(tid, {
    warehouseId: plan.scopeType === 'warehouse' ? plan.scopeId : undefined,
    locationId: plan.scopeType === 'location' ? plan.scopeId : undefined,
    categoryId: plan.scopeType === 'category' ? plan.scopeId : undefined,
    productIds: plan.scopeType === 'abc' ? products.map((p) => p._id) : undefined,
    scheduledDate: new Date(),
    userId,
    countUserId: plan.assignedUserId,
  });

  plan.lastRunAt = new Date();
  plan.nextRunAt = nextRunFrom(plan.frequency, plan.lastRunAt);
  await plan.save();
  return { plan, scheduled: result?.stamped || result?.count || 0 };
}

/** Monthly ABC Pareto — 80/15/5 by outbound value */
export async function computeAbcClasses(tenantId, { windowDays = 365 } = {}) {
  const tid = toObjectId(tenantId);
  const since = new Date();
  since.setDate(since.getDate() - windowDays);
  const { default: InvMoveLine } = await import('../../models/inventory/InvMoveLine.js');
  const lines = await InvMoveLine.find({
    tenantId: tid,
    state: 'done',
    updatedAt: { $gte: since },
  }).select('productId quantityInProductUom quantity').lean();

  const byProduct = new Map();
  for (const line of lines) {
    const pid = String(line.productId);
    const qty = Number(line.quantityInProductUom || line.quantity || 0);
    byProduct.set(pid, (byProduct.get(pid) || 0) + qty);
  }

  const products = await Product.find({ tenantId: tid, isActive: { $ne: false } })
    .select('_id costPrice sellingPrice')
    .lean();
  const ranked = products.map((p) => ({
    _id: p._id,
    value: (byProduct.get(String(p._id)) || 0) * Number(p.costPrice || p.sellingPrice || 0),
  })).sort((a, b) => b.value - a.value);

  const total = ranked.reduce((s, r) => s + r.value, 0) || 1;
  let cum = 0;
  const updates = [];
  for (const row of ranked) {
    cum += row.value;
    const pct = cum / total;
    const abcClass = pct <= 0.8 ? 'A' : pct <= 0.95 ? 'B' : 'C';
    updates.push({ updateOne: { filter: { _id: row._id }, update: { $set: { abcClass } } } });
  }
  if (updates.length) await Product.bulkWrite(updates.slice(0, 5000));
  return { updated: updates.length, windowDays };
}
