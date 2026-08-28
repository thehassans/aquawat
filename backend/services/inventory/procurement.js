import { D, decStr } from '../../utils/decimal.js';
import {
  InvRule,
  InvRoute,
  InvLocation,
  InvProcurementGroup,
  InvOperationType,
  InvSettings,
  InvMove,
} from '../../models/inventory/index.js';
import Product from '../../models/Product.js';
import InvProductCategory from '../../models/inventory/InvProductCategory.js';
import { toObjectId } from '../../models/inventory/common.js';
import { nextSequenceName } from './sequence.js';
import { computeForecast } from './forecast.js';
import { createTransfer } from './createTransfer.js';
import { InventoryValidationError } from './errors.js';

/**
 * Round qty UP to multiple (string decimals).
 */
export function roundToMultiple(qty, multiple) {
  const q = D(qty);
  const m = D(multiple || 1);
  if (m.lte(0)) return decStr(q);
  if (q.lte(0)) return '0';
  const steps = q.div(m).ceil();
  return decStr(steps.times(m));
}

/**
 * Create a draft Purchase Order for buy-rule procurement.
 */
export async function onBuyProcurement(ctx) {
  const PurchaseOrder = (await import('../../models/PurchaseOrder.js')).default;
  const Supplier = (await import('../../models/Supplier.js')).default;
  const Warehouse = (await import('../../models/Warehouse.js')).default;

  const tid = toObjectId(ctx.tenantId);
  const product = await Product.findById(ctx.productId).lean();
  if (!product) {
    throw new InventoryValidationError('Product not found', 'PRODUCT_NOT_FOUND');
  }

  const qty = Math.max(0, Number(ctx.qty || 0));
  const unitCost = Number(product.costPrice || product.purchasePrice || 0);
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

  let supplierId = ctx.preferredVendorId || null;
  if (!supplierId) {
    const supplier = await Supplier.findOne({ tenantId: tid, isActive: { $ne: false } })
      .sort({ createdAt: 1 })
      .select('_id')
      .lean();
    supplierId = supplier?._id || undefined;
  }

  let warehouseId = ctx.warehouseId || null;
  if (!warehouseId) {
    const loc = ctx.locationId
      ? await InvLocation.findById(ctx.locationId).select('warehouseId').lean()
      : null;
    warehouseId = loc?.warehouseId || null;
  }
  if (!warehouseId) {
    const legacyWh = await Warehouse.findOne({ tenantId: tid, isActive: true })
      .sort({ isPrimary: -1 })
      .select('_id')
      .lean();
    warehouseId = legacyWh?._id || undefined;
  }

  const [po] = await PurchaseOrder.create([{
    tenantId: tid,
    poNumber,
    flow: 'purchase',
    supplierId,
    warehouseId: warehouseId || undefined,
    status: 'draft',
    orderDate: new Date(),
    expectedDate: ctx.dateDeadline || undefined,
    currency: 'SAR',
    lineItems: [{
      productId: product._id,
      variantId: ctx.variantId || null,
      manualName: product.nameEn || product.sku || String(ctx.productId),
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
    notes: `Auto-created from inventory buy rule. Origin product ${product.nameEn || product._id}`,
    createdBy: ctx.userId || undefined,
  }]);

  return {
    stub: false,
    action: 'buy',
    purchaseOrderId: po._id,
    poNumber: po.poNumber,
    productId: ctx.productId,
    qty: String(qty),
  };
}

/**
 * Manufacture procurement — create WO when BOM exists; otherwise stub (never crash).
 */
export async function onManufactureProcurement(ctx) {
  try {
    const { ManufacturingBOM, ManufacturingWorkOrder } = await import('../../models/Manufacturing.js');
    const Warehouse = (await import('../../models/Warehouse.js')).default;

    const tid = toObjectId(ctx.tenantId);
    const product = await Product.findById(ctx.productId).lean();
    if (!product) {
      return { stub: true, action: 'manufacture', reason: 'NO_PRODUCT', productId: ctx.productId, qty: ctx.qty };
    }

    const bom = await ManufacturingBOM.findOne({
      tenantId: tid,
      finishedProductId: product._id,
      isActive: { $ne: false },
      status: { $in: ['active', 'draft'] },
    }).sort({ status: 1, updatedAt: -1 });

    if (!bom) {
      return {
        stub: true,
        action: 'manufacture',
        reason: 'NO_BOM',
        productId: ctx.productId,
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

    let warehouseId = ctx.warehouseId || null;
    if (!warehouseId) {
      const legacyWh = await Warehouse.findOne({ tenantId: tid, isActive: true })
        .sort({ isPrimary: -1 })
        .select('_id')
        .lean();
      warehouseId = legacyWh?._id || undefined;
    }

    const start = ctx.dateDeadline ? new Date(ctx.dateDeadline) : new Date();
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    const materialCost = Number(bom.estimatedMaterialCost || bom.totalStandardCost || 0) * qty;

    const [wo] = await ManufacturingWorkOrder.create([{
      tenantId: tid,
      orderNumber,
      productId: product._id,
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
      notes: `Auto-created from inventory manufacture rule (${ctx.ruleId || 'manufacture'})`,
      createdBy: ctx.userId || undefined,
    }]);

    return {
      stub: false,
      action: 'manufacture',
      workOrderId: wo._id,
      orderNumber: wo.orderNumber,
      bomId: bom._id,
      productId: ctx.productId,
      qty: String(qty),
    };
  } catch (err) {
    return {
      stub: true,
      action: 'manufacture',
      reason: 'MANUFACTURE_ERROR',
      message: err.message,
      productId: ctx.productId,
      qty: ctx.qty,
    };
  }
}

/**
 * Walk location parent chain; find first matching rule.
 * Priority: preferred > product routes > category routes > warehouse routes > global
 */
export async function findApplicableRule(tenantId, productId, locationId, { preferredRouteId } = {}) {
  const tid = toObjectId(tenantId);
  const product = await Product.findById(productId).lean();
  if (!product) throw new InventoryValidationError('Product not found', 'PRODUCT_NOT_FOUND');

  const category = product.categoryId
    ? await InvProductCategory.findById(product.categoryId).lean()
    : null;

  const productRouteIds = (product.routeIds || []).map(String);
  const categoryRouteIds = (category?.routeIds || []).map(String);

  const chain = [];
  let loc = await InvLocation.findOne({ _id: locationId, tenantId: tid }).lean();
  while (loc) {
    chain.push(loc);
    if (!loc.parentId) break;
    loc = await InvLocation.findOne({ _id: loc.parentId, tenantId: tid }).lean();
  }

  const allRoutes = await InvRoute.find({ tenantId: tid, active: true }).sort({ sequence: 1 }).lean();

  const scoreRoute = (route) => {
    const id = String(route._id);
    if (preferredRouteId && id === String(preferredRouteId)) return 0;
    if (productRouteIds.includes(id)) return 1;
    if (categoryRouteIds.includes(id)) return 2;
    if (route.warehouseIds?.some((w) => chain.some((c) => String(c.warehouseId) === String(w)))) return 3;
    if (!route.warehouseIds?.length) return 4;
    return 99;
  };

  const rankedRoutes = [...allRoutes]
    .map((r) => ({ route: r, score: scoreRoute(r) }))
    .filter((x) => x.score < 99)
    .sort((a, b) => a.score - b.score || a.route.sequence - b.route.sequence);

  for (const chainLoc of chain) {
    for (const { route } of rankedRoutes) {
      const rules = await InvRule.find({
        tenantId: tid,
        routeId: route._id,
        destLocationId: chainLoc._id,
        active: true,
      }).sort({ sequence: 1 }).lean();

      if (rules.length) return { rule: rules[0], route, matchedLocation: chainLoc };
    }
  }

  const productName = product.nameEn || product.sku || productId;
  const locName = chain[0]?.completePath || locationId;
  throw new InventoryValidationError(
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
  variantId,
  qty,
  locationId,
  dateDeadline,
  groupId,
  preferredRouteId,
  warehouseId,
  preferredVendorId,
  userId,
  depth = 0,
} = {}) {
  if (depth > 8) {
    throw new InventoryValidationError('Procurement chain too deep', 'PROCUREMENT_DEPTH');
  }

  const tid = toObjectId(tenantId);
  const settings = await InvSettings.findOne({ tenantId: tid }).lean();
  const securityLead = Number(settings?.securityLeadTimePurchase) || 0;

  const { rule, route } = await findApplicableRule(tid, productId, locationId, { preferredRouteId });

  if (rule.action === 'buy') {
    return onBuyProcurement({
      tenantId: tid,
      productId,
      variantId,
      qty,
      locationId,
      warehouseId,
      preferredVendorId,
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
      variantId,
      qty,
      locationId,
      warehouseId,
      dateDeadline,
      ruleId: rule._id,
      userId,
    });
  }

  // pull / push / pullPush
  const product = await Product.findById(productId);
  if (!product?.uomId) {
    throw new InventoryValidationError('Product UoM missing — assign InvUom first', 'NO_UOM');
  }

  let group = null;
  if (rule.groupPropagation === 'propagate' && groupId) {
    group = await InvProcurementGroup.findById(groupId);
  } else if (rule.groupPropagation === 'fixed' && rule.fixedGroupId) {
    group = await InvProcurementGroup.findById(rule.fixedGroupId);
  } else if (rule.groupPropagation === 'propagate' && !groupId) {
    group = await InvProcurementGroup.create({
      tenantId: tid,
      name: `PROC/${Date.now()}`,
      moveType: 'grouped',
      createdBy: userId,
    });
  }

  const deadline = dateDeadline ? new Date(dateDeadline) : new Date();
  const moveDate = new Date(deadline);
  moveDate.setDate(moveDate.getDate() - (Number(rule.leadDays) || 0) - securityLead);

  const srcId = rule.sourceLocationId;
  const destId = locationId;

  let transferId = null;
  let transferName = null;
  if (rule.operationTypeId) {
    const opType = await InvOperationType.findById(rule.operationTypeId);
    if (opType) {
      let existing = null;
      if (group && group.moveType === 'grouped') {
        const { default: InvTransfer } = await import('../../models/inventory/InvTransfer.js');
        existing = await InvTransfer.findOne({
          tenantId: tid,
          operationTypeId: opType._id,
          procurementGroupId: group._id,
          state: { $in: ['draft', 'confirmed', 'assigned', 'waiting'] },
        });
      }
      if (existing) {
        transferId = existing._id;
        transferName = existing.name;
        await InvMove.create({
          tenantId: tid,
          reference: existing.name,
          origin: group?.name,
          productId,
          uomId: product.uomId,
          demandQty: decStr(qty),
          sourceLocationId: srcId || opType.defaultSourceLocationId,
          destLocationId: destId || opType.defaultDestLocationId,
          state: 'draft',
          procureMethod: 'makeToStock',
          transferId: existing._id,
          ruleId: rule._id,
          procurementGroupId: group?._id || null,
          date: moveDate,
          deadlineDate: deadline,
          propagateCancel: rule.propagateCancel !== false,
          createdBy: userId,
        });
      } else {
        const created = await createTransfer(tid, {
          operationTypeId: opType._id,
          sourceLocationId: srcId || opType.defaultSourceLocationId,
          destLocationId: destId || opType.defaultDestLocationId,
          scheduledDate: moveDate,
          deadlineDate: deadline,
          origin: group?.name,
          procurementGroupId: group?._id || null,
          lines: [{ productId, demandQty: qty, uomId: product.uomId }],
        }, userId);
        transferId = created._id;
        transferName = created.name;
        await InvMove.updateMany(
          { tenantId: tid, transferId: created._id },
          { $set: { ruleId: rule._id, procurementGroupId: group?._id || null } },
        );
      }
    }
  }

  let procureMethod = rule.procureMethod;
  if (procureMethod === 'mtsElseMto') {
    const fc = await computeForecast(tid, productId);
    procureMethod = D(fc.freeToUse).lt(D(qty)) ? 'makeToOrder' : 'makeToStock';
  }

  let move = transferId
    ? await InvMove.findOne({ tenantId: tid, transferId, productId }).sort({ createdAt: -1 })
    : null;

  if (!move) {
    const name = transferName || (await nextSequenceName(tid, 'PROC'));
    [move] = await InvMove.create([{
      tenantId: tid,
      reference: name,
      origin: group?.name,
      productId,
      uomId: product.uomId,
      demandQty: decStr(qty),
      sourceLocationId: srcId,
      destLocationId: destId,
      state: procureMethod === 'makeToOrder' ? 'waiting' : 'confirmed',
      procureMethod,
      transferId,
      ruleId: rule._id,
      procurementGroupId: group?._id || null,
      date: moveDate,
      deadlineDate: deadline,
      propagateCancel: rule.propagateCancel !== false,
      createdBy: userId,
    }]);
  } else {
    move.procureMethod = procureMethod === 'makeToOrder' ? 'makeToOrder' : 'makeToStock';
    move.state = procureMethod === 'makeToOrder' ? 'waiting' : (move.state === 'draft' ? 'confirmed' : move.state);
    await move.save();
  }

  let chained = null;
  if (procureMethod === 'makeToOrder' && srcId) {
    chained = await runProcurement({
      tenantId: tid,
      productId,
      qty,
      locationId: srcId,
      dateDeadline: moveDate,
      groupId: group?._id,
      preferredRouteId,
      warehouseId,
      userId,
      depth: depth + 1,
    });

    if (chained?.move?._id) {
      const originMove = await InvMove.findById(chained.move._id);
      if (originMove) {
        const destIds = [...(originMove.destMoveIds || []).map(String), String(move._id)];
        originMove.destMoveIds = [...new Set(destIds)];
        await originMove.save();
        const origIds = [...(move.originMoveIds || []).map(String), String(originMove._id)];
        move.originMoveIds = [...new Set(origIds)];
        await move.save();
      }
    }
  }

  return { move, rule, route, group, chained, transferId };
}
