import mongoose from 'mongoose';
import { D, decStr } from '../../utils/decimal.js';
import {
  StockOrderpoint,
  StockSchedulerRun,
  StockSettings,
  StockWarehouse,
  StockProductVariant,
  StockMove,
  StockOperationType,
} from '../../models/stock/index.js';
import { computeForecast } from './forecast.js';
import { runProcurement, roundToMultiple } from './procurement.js';
import { reserveMove, runWithTransaction } from './reserve.js';
import { StockValidationError } from './errors.js';

/**
 * List real orderpoints + virtual ones for products with negative forecast.
 */
export async function listReplenishment(tenantId, { warehouseId } = {}) {
  const tid = new mongoose.Types.ObjectId(String(tenantId));
  const filter = { tenantId: tid, active: true };
  if (warehouseId) filter.warehouseId = warehouseId;

  const orderpoints = await StockOrderpoint.find(filter)
    .populate('productId')
    .populate('locationId', 'completeName')
    .populate('warehouseId', 'name code')
    .lean();

  const rows = [];
  for (const op of orderpoints) {
    const fc = await computeForecast(tid, op.productId?._id || op.productId, { warehouseId: op.warehouseId });
    const toOrder = D(fc.forecasted).lt(D(op.productMinQty))
      ? roundToMultiple(D(op.productMaxQty).minus(D(fc.forecasted)), op.qtyMultiple)
      : '0';
    rows.push({
      ...op,
      kind: 'permanent',
      qtyOnHand: fc.onHand,
      qtyForecast: fc.forecasted,
      qtyToOrder: toOrder,
      snoozed: op.snoozedUntil && new Date(op.snoozedUntil) > new Date(),
    });
  }

  // Virtual: variants with negative forecast not already covered
  const covered = new Set(orderpoints.map((o) => String(o.productId?._id || o.productId)));
  const warehouses = warehouseId
    ? [await StockWarehouse.findOne({ _id: warehouseId, tenantId: tid }).lean()]
    : await StockWarehouse.find({ tenantId: tid, active: true }).lean();

  const variants = await StockProductVariant.find({ tenantId: tid, active: true }).limit(200).lean();
  for (const wh of warehouses.filter(Boolean)) {
    for (const v of variants) {
      if (covered.has(String(v._id))) continue;
      const fc = await computeForecast(tid, v._id, { warehouseId: wh._id });
      if (D(fc.forecasted).gte(0)) continue;
      rows.push({
        _id: `virtual:${v._id}:${wh._id}`,
        kind: 'virtual',
        productId: v,
        warehouseId: wh,
        locationId: wh.lotStockId,
        productMinQty: '0',
        productMaxQty: decStr(D(fc.forecasted).abs()),
        qtyMultiple: '1',
        qtyOnHand: fc.onHand,
        qtyForecast: fc.forecasted,
        qtyToOrder: decStr(D(fc.forecasted).abs()),
        trigger: 'manual',
      });
    }
  }

  return rows;
}

export async function upsertOrderpoint(tenantId, userId, body) {
  const tid = new mongoose.Types.ObjectId(String(tenantId));
  if (!body.productId || !body.locationId || !body.warehouseId) {
    throw new StockValidationError('productId, locationId, warehouseId required', 'MISSING_FIELDS');
  }

  const existing = await StockOrderpoint.findOne({
    tenantId: tid,
    productId: body.productId,
    locationId: body.locationId,
  });

  if (existing) {
    existing.productMinQty = String(body.productMinQty ?? existing.productMinQty);
    existing.productMaxQty = String(body.productMaxQty ?? existing.productMaxQty);
    existing.qtyMultiple = String(body.qtyMultiple ?? existing.qtyMultiple);
    existing.trigger = body.trigger || existing.trigger;
    existing.routeId = body.routeId || existing.routeId;
    existing.leadDays = body.leadDays ?? existing.leadDays;
    existing.warehouseId = body.warehouseId;
    existing.active = body.active !== false;
    await existing.save();
    return existing;
  }

  return StockOrderpoint.create({
    tenantId: tid,
    productId: body.productId,
    locationId: body.locationId,
    warehouseId: body.warehouseId,
    productMinQty: String(body.productMinQty ?? 0),
    productMaxQty: String(body.productMaxQty ?? 0),
    qtyMultiple: String(body.qtyMultiple ?? 1),
    trigger: body.trigger || 'auto',
    routeId: body.routeId || null,
    leadDays: body.leadDays || 0,
    createdBy: userId,
  });
}

export async function snoozeOrderpoint(tenantId, id, { until, preset }) {
  const tid = new mongoose.Types.ObjectId(String(tenantId));
  const op = await StockOrderpoint.findOne({ _id: id, tenantId: tid });
  if (!op) throw new StockValidationError('Orderpoint not found', 'OP_NOT_FOUND');

  let date = until ? new Date(until) : new Date();
  if (!until && preset) {
    if (preset === '1d') date.setDate(date.getDate() + 1);
    else if (preset === '1w') date.setDate(date.getDate() + 7);
    else if (preset === '1m') date.setMonth(date.getMonth() + 1);
  }
  op.snoozedUntil = date;
  await op.save();
  return op;
}

export async function orderOnce(tenantId, userId, { productId, locationId, qty, routeId, warehouseId }) {
  if (!productId || !locationId || !qty) {
    throw new StockValidationError('productId, locationId, qty required', 'MISSING_FIELDS');
  }
  const deadline = new Date();
  deadline.setDate(deadline.getDate() + 7);
  return runProcurement({
    tenantId,
    productId,
    qty,
    locationId,
    dateDeadline: deadline,
    preferredRouteId: routeId,
    userId,
  });
}

/**
 * Run scheduler: auto orderpoints + reservation retry for by_date windows.
 */
export async function runScheduler(tenantId, userId, { trigger = 'manual' } = {}) {
  const tid = new mongoose.Types.ObjectId(String(tenantId));
  const settings = await StockSettings.findOne({ tenantId: tid }).lean();

  const [run] = await StockSchedulerRun.create([{
    tenantId: tid,
    startedAt: new Date(),
    trigger,
    status: 'running',
    createdBy: userId,
  }]);

  let procurementsCreated = 0;
  let reservationsRetried = 0;
  const errors = [];

  try {
    const orderpoints = await StockOrderpoint.find({
      tenantId: tid,
      active: true,
      trigger: 'auto',
      $or: [
        { snoozedUntil: null },
        { snoozedUntil: { $lte: new Date() } },
      ],
    });

    const leadExtra = (Number(settings?.poLeadTime) || 0)
      + (Number(settings?.securityLeadTime) || 0);

    for (const op of orderpoints) {
      try {
        const fc = await computeForecast(tid, op.productId, { warehouseId: op.warehouseId });
        if (D(fc.forecasted).gte(D(op.productMinQty))) continue;

        let toOrder = D(op.productMaxQty).minus(D(fc.forecasted));
        if (toOrder.lte(0)) continue;
        toOrder = roundToMultiple(toOrder, op.qtyMultiple);

        const deadline = new Date();
        deadline.setDate(deadline.getDate() + (Number(op.leadDays) || 0) + leadExtra);

        await runProcurement({
          tenantId: tid,
          productId: op.productId,
          qty: toOrder,
          locationId: op.locationId,
          dateDeadline: deadline,
          preferredRouteId: op.routeId,
          userId,
        });
        procurementsCreated += 1;
      } catch (err) {
        errors.push({ message: err.message, code: err.code || 'PROCURE', at: new Date() });
      }
    }

    // Retry reservations for confirmed/partially_available moves whose by_date window opened
    const opTypes = await StockOperationType.find({
      tenantId: tid,
      reservationMethod: 'by_date',
      active: true,
    }).lean();

    for (const ot of opTypes) {
      const daysBefore = Number(ot.reservationDaysBefore) || 0;
      const windowEnd = new Date();
      windowEnd.setDate(windowEnd.getDate() + daysBefore);

      const pickings = await mongoose.model('StockPicking').find({
        tenantId: tid,
        operationTypeId: ot._id,
        state: { $in: ['confirmed', 'assigned', 'waiting'] },
        scheduledDate: { $lte: windowEnd },
      }).select('_id').lean();

      const moves = await StockMove.find({
        tenantId: tid,
        pickingId: { $in: pickings.map((p) => p._id) },
        state: { $in: ['confirmed', 'partially_available'] },
      });

      for (const move of moves) {
        try {
          await runWithTransaction(async (session) => {
            const m = await StockMove.findById(move._id).session(session);
            if (m) await reserveMove(m, session);
          });
          reservationsRetried += 1;
        } catch (err) {
          errors.push({ message: err.message, code: 'RESERVE', at: new Date() });
        }
      }
    }

    run.endedAt = new Date();
    run.orderpointsChecked = orderpoints.length;
    run.procurementsCreated = procurementsCreated;
    run.reservationsRetried = reservationsRetried;
    run.errorLog = errors;
    run.status = 'done';
    await run.save();
    return run;
  } catch (err) {
    run.endedAt = new Date();
    run.status = 'failed';
    run.errorLog = [...errors, { message: err.message, code: 'FATAL', at: new Date() }];
    await run.save();
    throw err;
  }
}
