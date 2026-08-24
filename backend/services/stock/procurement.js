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
 * Integration stubs — Purchase / Manufacturing modules wire these later.
 */
export async function onBuyProcurement(ctx) {
  return { stub: true, action: 'buy', ...ctx };
}

export async function onManufactureProcurement(ctx) {
  return { stub: true, action: 'manufacture', ...ctx };
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
