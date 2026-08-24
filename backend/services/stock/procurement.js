import mongoose from 'mongoose';
import { D, decStr, decRoundUp } from '../../utils/decimal.js';
import {
  StockRule,
  StockRoute,
  StockMove,
  StockLocation,
  StockProductVariant,
  StockProductTemplate,
  StockProductCategory,
  StockProcurementGroup,
  StockOperationType,
  StockPicking,
  StockSettings,
  StockQuant,
} from '../../models/stock/index.js';
import { nextSequenceName } from './sequence.js';
import { computeForecast } from './forecast.js';
import { StockValidationError } from './errors.js';

/**
 * Create a draft Purchase Order for buy-rule procurement.
 */
export async function onBuyProcurement(ctx) {
  const PurchaseOrder = (await import('../../models/PurchaseOrder.js')).default;
  const Supplier = (await import('../../models/Supplier.js')).default;
  const Warehouse = (await import('../../models/Warehouse.js')).default;

  const tid = ctx.tenantId;
  const variant = await StockProductVariant.findById(ctx.productId).lean();
  const template = variant
    ? await StockProductTemplate.findById(variant.templateId).lean()
    : null;

  const qty = Math.max(0, Number(ctx.qty || ctx.productQty || 0));
  const unitCost = Number(template?.standardPrice || 0);
  const lineSubtotal = Math.round(qty * unitCost * 100) / 100;
  const taxRate = 15;
  const lineTax = Math.round(lineSubtotal * (taxRate / 100) * 100) / 100;
  const lineTotal = Math.round((lineSubtotal + lineTax) * 100) / 100;

  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const d = String(today.getDate()).padStart(2, '0');
  const prefix = `PO-${y}${m}${d}`;
  const last = await PurchaseOrder.findOne({
    tenantId: tid,
    poNumber: { $regex: `^${prefix}-` },
  }).sort({ createdAt: -1 }).select('poNumber');
  let seq = 1;
  if (last?.poNumber) {
    const lastSeq = Number(String(last.poNumber).split('-').pop());
    if (Number.isFinite(lastSeq)) seq = lastSeq + 1;
  }
  const poNumber = `${prefix}-${String(seq).padStart(3, '0')}`;

  const supplier = await Supplier.findOne({ tenantId: tid, isActive: { $ne: false } })
    .sort({ createdAt: 1 })
    .select('_id')
    .lean();

  let warehouseId = null;
  const stockWh = await mongoose.model('StockWarehouse').findOne({
    tenantId: tid,
    active: true,
  }).lean();
  if (stockWh?.legacyWarehouseId) {
    warehouseId = stockWh.legacyWarehouseId;
  } else {
    const legacyWh = await Warehouse.findOne({ tenantId: tid, isActive: true }).sort({ isPrimary: -1 }).select('_id').lean();
    warehouseId = legacyWh?._id || null;
  }

  const [po] = await PurchaseOrder.create([{
    tenantId: tid,
    poNumber,
    flow: 'purchase',
    supplierId: supplier?._id || undefined,
    warehouseId: warehouseId || undefined,
    status: 'draft',
    orderDate: new Date(),
    expectedDate: ctx.dateDeadline || undefined,
    currency: 'SAR',
    lineItems: [{
      productId: variant?.legacyProductId || undefined,
      manualName: template?.name || variant?.defaultCode || String(ctx.productId),
      description: `Stock replenishment (${ctx.ruleId || 'buy'})`,
      productType: 'goods',
      quantityOrdered: qty,
      unitCost,
      taxRate,
      lineSubtotal,
      lineTax,
      lineTotal,
    }],
    subtotal: lineSubtotal,
    totalTax: lineTax,
    grandTotal: lineTotal,
    balanceDue: lineTotal,
    notes: `Auto-created from stock buy rule. Origin product ${template?.name || ctx.productId}`,
    createdBy: ctx.userId || undefined,
  }]);

  return {
    stub: false,
    action: 'buy',
    purchaseOrderId: po._id,
    poNumber: po.poNumber,
    productId: ctx.productId,
    qty,
  };
}

export async function onManufactureProcurement(ctx) {
  const { ManufacturingBOM, ManufacturingWorkOrder } = await import('../../models/Manufacturing.js');
  const Warehouse = (await import('../../models/Warehouse.js')).default;

  const tid = ctx.tenantId;
  const variant = await StockProductVariant.findById(ctx.productId).lean();
  if (!variant?.legacyProductId) {
    return {
      stub: true,
      action: 'manufacture',
      reason: 'NO_LEGACY_PRODUCT',
      productId: ctx.productId,
      qty: ctx.qty,
    };
  }

  const bom = await ManufacturingBOM.findOne({
    tenantId: tid,
    finishedProductId: variant.legacyProductId,
    isActive: { $ne: false },
    status: { $in: ['active', 'draft'] },
  }).sort({ status: 1, updatedAt: -1 });

  if (!bom) {
    return {
      stub: true,
      action: 'manufacture',
      reason: 'NO_BOM',
      productId: ctx.productId,
      legacyProductId: variant.legacyProductId,
      qty: ctx.qty,
    };
  }

  const qty = Math.max(1, Math.ceil(Number(ctx.qty || 1)));
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const d = String(today.getDate()).padStart(2, '0');
  const prefix = `WO-${y}${m}${d}`;
  const last = await ManufacturingWorkOrder.findOne({
    tenantId: tid,
    orderNumber: { $regex: `^${prefix}-` },
  }).sort({ createdAt: -1 }).select('orderNumber');
  let seq = 1;
  if (last?.orderNumber) {
    const lastSeq = Number(String(last.orderNumber).split('-').pop());
    if (Number.isFinite(lastSeq)) seq = lastSeq + 1;
  }
  const orderNumber = `${prefix}-${String(seq).padStart(3, '0')}`;

  let warehouseId = null;
  const stockWh = await mongoose.model('StockWarehouse').findOne({ tenantId: tid, active: true }).lean();
  if (stockWh?.legacyWarehouseId) warehouseId = stockWh.legacyWarehouseId;
  else {
    const legacyWh = await Warehouse.findOne({ tenantId: tid, isActive: true }).sort({ isPrimary: -1 }).select('_id').lean();
    warehouseId = legacyWh?._id || null;
  }

  const start = ctx.dateDeadline ? new Date(ctx.dateDeadline) : new Date();
  const end = new Date(start);
  end.setDate(end.getDate() + 7);

  const materialCost = Number(bom.estimatedMaterialCost || bom.totalStandardCost || 0) * qty;

  const [wo] = await ManufacturingWorkOrder.create([{
    tenantId: tid,
    orderNumber,
    productId: variant.legacyProductId,
    bomId: bom._id,
    bomVersion: bom.version || '1.0',
    routingId: bom.routingId || undefined,
    quantityPlanned: qty,
    status: 'draft',
    priority: 'medium',
    warehouseId: warehouseId || undefined,
    scheduledStartDate: start,
    scheduledEndDate: end,
    standardCostEstimated: materialCost,
    notes: `Auto-created from stock manufacture rule (${ctx.ruleId || 'manufacture'})`,
    createdBy: ctx.userId || undefined,
  }]);

  return {
    stub: false,
    action: 'manufacture',
    workOrderId: wo._id,
    orderNumber: wo.orderNumber,
    bomId: bom._id,
    productId: ctx.productId,
    qty,
  };
}

/**
 * Walk location parent chain; find first matching rule.
 * Priority: product routes > category routes > warehouse routes > global routes
 * then route.sequence, rule.sequence.
 */
export async function findApplicableRule(tenantId, productId, locationId, { preferredRouteId } = {}) {
  const tid = new mongoose.Types.ObjectId(String(tenantId));
  const variant = await StockProductVariant.findById(productId).lean();
  if (!variant) throw new StockValidationError('Product not found', 'PRODUCT_NOT_FOUND');
  const template = await StockProductTemplate.findById(variant.templateId).lean();
  const category = template?.categoryId
    ? await StockProductCategory.findById(template.categoryId).lean()
    : null;

  const productRouteIds = (template?.routeIds || []).map(String);
  const categoryRouteIds = (category?.routeIds || []).map(String);

  // Build location chain (self → parents)
  const chain = [];
  let loc = await StockLocation.findOne({ _id: locationId, tenantId: tid }).lean();
  while (loc) {
    chain.push(loc);
    if (!loc.parentId) break;
    loc = await StockLocation.findOne({ _id: loc.parentId, tenantId: tid }).lean();
  }

  const allRoutes = await StockRoute.find({ tenantId: tid, active: true }).sort({ sequence: 1 }).lean();

  const scoreRoute = (route) => {
    const id = String(route._id);
    if (preferredRouteId && id === String(preferredRouteId)) return 0;
    if (productRouteIds.includes(id)) return 1;
    if (categoryRouteIds.includes(id)) return 2;
    if (route.warehouseIds?.some((w) => chain.some((c) => String(c.warehouseId) === String(w)))) return 3;
    if (!route.warehouseIds?.length) return 4; // global
    return 99;
  };

  const rankedRoutes = [...allRoutes]
    .map((r) => ({ route: r, score: scoreRoute(r) }))
    .filter((x) => x.score < 99 || !x.route.warehouseIds?.length)
    .sort((a, b) => a.score - b.score || a.route.sequence - b.route.sequence);

  for (const chainLoc of chain) {
    for (const { route } of rankedRoutes) {
      const rules = await StockRule.find({
        tenantId: tid,
        routeId: route._id,
        locationDestId: chainLoc._id,
        active: true,
      }).sort({ sequence: 1 }).lean();

      if (rules.length) return { rule: rules[0], route, matchedLocation: chainLoc };
    }
  }

  const productName = template?.name || productId;
  const locName = chain[0]?.completeName || locationId;
  throw new StockValidationError(
    `No rule has been found to replenish "${productName}" in "${locName}".`,
    'NO_RULE_FOUND',
  );
}

/**
 * runProcurement — create moves (and optionally chain MTO) per applicable rule.
 */
export async function runProcurement({
  tenantId,
  productId,
  qty,
  locationId,
  dateDeadline,
  groupId,
  preferredRouteId,
  userId,
  depth = 0,
  session = null,
}) {
  if (depth > 8) {
    throw new StockValidationError('Procurement chain too deep', 'PROCUREMENT_DEPTH');
  }

  const tid = new mongoose.Types.ObjectId(String(tenantId));
  const settings = await StockSettings.findOne({ tenantId: tid }).lean();
  const securityLead = Number(settings?.securityLeadTime) || 0;

  const { rule, route } = await findApplicableRule(tid, productId, locationId, { preferredRouteId });

  if (rule.action === 'buy') {
    return onBuyProcurement({
      tenantId: tid,
      productId,
      qty,
      locationId,
      dateDeadline,
      ruleId: rule._id,
      routeId: route._id,
      userId,
    });
  }
  if (rule.action === 'manufacture') {
    return onManufactureProcurement({
      tenantId: tid,
      productId,
      qty,
      locationId,
      dateDeadline,
      ruleId: rule._id,
      userId,
    });
  }

  // pull / pull_push / push
  const variant = await StockProductVariant.findById(productId).session(session || null);
  const template = await StockProductTemplate.findById(variant.templateId).session(session || null);
  if (!template?.uomId) throw new StockValidationError('Product UoM missing', 'NO_UOM');

  let group = null;
  if (rule.groupPropagationOption === 'propagate' && groupId) {
    group = await StockProcurementGroup.findById(groupId).session(session || null);
  } else if (rule.groupPropagationOption === 'fixed' && rule.fixedGroupId) {
    group = await StockProcurementGroup.findById(rule.fixedGroupId).session(session || null);
  } else if (rule.groupPropagationOption === 'propagate' && !groupId) {
    const [g] = await StockProcurementGroup.create([{
      tenantId: tid,
      name: `PROC/${Date.now()}`,
      moveType: 'one',
      createdBy: userId,
    }], session ? { session } : undefined);
    group = g;
  }

  const deadline = dateDeadline ? new Date(dateDeadline) : new Date();
  const moveDate = new Date(deadline);
  moveDate.setDate(moveDate.getDate() - (Number(rule.delay) || 0) - securityLead);

  const srcId = rule.locationSrcId;
  const destId = locationId;

  // Resolve or create picking for this op type + group
  let pickingId = null;
  if (rule.operationTypeId) {
    const opType = await StockOperationType.findById(rule.operationTypeId).session(session || null);
    if (opType) {
      let picking = null;
      if (group && group.moveType === 'one') {
        picking = await StockPicking.findOne({
          tenantId: tid,
          operationTypeId: opType._id,
          groupId: group._id,
          state: { $in: ['draft', 'confirmed', 'assigned', 'waiting'] },
        }).session(session || null);
      }
      if (!picking) {
        const name = await nextSequenceName(tid, opType.sequenceCode, session);
        const [created] = await StockPicking.create([{
          tenantId: tid,
          name,
          operationTypeId: opType._id,
          locationId: srcId || opType.defaultLocationSrcId,
          locationDestId: destId || opType.defaultLocationDestId,
          scheduledDate: moveDate,
          dateDeadline: deadline,
          state: 'draft',
          groupId: group?._id || null,
          origin: group?.name,
          createdBy: userId,
        }], session ? { session } : undefined);
        picking = created;
      }
      pickingId = picking._id;
    }
  }

  let procureMethod = rule.procureMethod;
  if (procureMethod === 'mts_else_mto') {
    const fc = await computeForecast(tid, productId);
    if (D(fc.freeToUse).lt(D(qty))) procureMethod = 'make_to_order';
    else procureMethod = 'make_to_stock';
  }

  const [move] = await StockMove.create([{
    tenantId: tid,
    reference: pickingId ? undefined : `PROC/${productId}`,
    origin: group?.name,
    productId,
    productUomId: template.uomId,
    productUomQty: decStr(qty),
    quantity: '0',
    locationId: srcId,
    locationDestId: destId,
    state: procureMethod === 'make_to_order' ? 'waiting' : 'confirmed',
    procureMethod,
    pickingId,
    ruleId: rule._id,
    groupId: group?._id || null,
    date: moveDate,
    dateDeadline: deadline,
    propagateCancel: rule.propagateCancel !== false,
    createdBy: userId,
  }], session ? { session } : undefined);

  if (pickingId) {
    move.reference = (await StockPicking.findById(pickingId).session(session || null))?.name;
    await move.save(session ? { session } : undefined);
  }

  let chained = null;
  if (procureMethod === 'make_to_order' && srcId) {
    chained = await runProcurement({
      tenantId: tid,
      productId,
      qty,
      locationId: srcId,
      dateDeadline: moveDate,
      groupId: group?._id,
      preferredRouteId,
      userId,
      depth: depth + 1,
      session,
    });

    // Chain: origin move → this move
    if (chained?.move?._id) {
      const originMove = await StockMove.findById(chained.move._id).session(session || null);
      if (originMove) {
        originMove.moveDestIds = [...(originMove.moveDestIds || []).map(String), String(move._id)]
          .filter((v, i, a) => a.indexOf(v) === i);
        await originMove.save(session ? { session } : undefined);
        move.moveOrigIds = [...(move.moveOrigIds || []).map(String), String(originMove._id)]
          .filter((v, i, a) => a.indexOf(v) === i);
        await move.save(session ? { session } : undefined);
      }
    }
  }

  return { move, rule, route, group, chained, pickingId };
}

/**
 * Round qty UP to multiple.
 */
export function roundToMultiple(qty, multiple) {
  const m = D(multiple || 1);
  if (m.lte(0)) return decStr(qty);
  return decStr(decRoundUp(D(qty), m));
}
