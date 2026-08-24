import mongoose from 'mongoose';
import { D, decStr } from '../../utils/decimal.js';
import StockMove from '../../models/stock/StockMove.js';
import StockMoveLine from '../../models/stock/StockMoveLine.js';
import StockPicking from '../../models/stock/StockPicking.js';
import StockOperationType from '../../models/stock/StockOperationType.js';

/**
 * Moves Analysis — aggregate qty by product/category/partner/date.
 */
export async function movesAnalysis(tenantId, {
  dateFrom,
  dateTo,
  groupBy = 'product',
  state = 'done',
} = {}) {
  const tid = new mongoose.Types.ObjectId(String(tenantId));
  const filter = { tenantId: tid };
  if (state) filter.state = state;
  if (dateFrom || dateTo) {
    filter.date = {};
    if (dateFrom) filter.date.$gte = new Date(dateFrom);
    if (dateTo) filter.date.$lte = new Date(dateTo);
  }

  const moves = await StockMove.find(filter)
    .populate({ path: 'productId', populate: { path: 'templateId', select: 'name categoryId' } })
    .lean();

  const buckets = new Map();

  for (const m of moves) {
    let key;
    let label;
    switch (groupBy) {
      case 'date':
        key = m.date ? new Date(m.date).toISOString().slice(0, 10) : 'unknown';
        label = key;
        break;
      case 'partner':
        key = String(m.partnerId || 'none');
        label = key;
        break;
      case 'state':
        key = m.state;
        label = m.state;
        break;
      case 'category':
        key = String(m.productId?.templateId?.categoryId || 'none');
        label = key;
        break;
      case 'product':
      default:
        key = String(m.productId?._id || m.productId);
        label = m.productId?.templateId?.name || m.productId?.defaultCode || key.slice(-6);
    }

    const prev = buckets.get(key) || { key, label, qty: D(0), count: 0 };
    prev.qty = prev.qty.plus(D(m.quantity || m.productUomQty || 0));
    prev.count += 1;
    buckets.set(key, prev);
  }

  return [...buckets.values()]
    .map((b) => ({ ...b, qty: decStr(b.qty) }))
    .sort((a, b) => Number(b.qty) - Number(a.qty));
}

/**
 * Performance KPIs for inventory operations.
 */
export async function performanceReport(tenantId, {
  dateFrom,
  dateTo,
  operationTypeId,
} = {}) {
  const tid = new mongoose.Types.ObjectId(String(tenantId));
  const filter = { tenantId: tid, state: 'done' };
  if (operationTypeId) filter.operationTypeId = operationTypeId;
  if (dateFrom || dateTo) {
    filter.dateDone = {};
    if (dateFrom) filter.dateDone.$gte = new Date(dateFrom);
    if (dateTo) filter.dateDone.$lte = new Date(dateTo);
  }

  const pickings = await StockPicking.find(filter)
    .populate('operationTypeId', 'name code')
    .lean();

  let onTime = 0;
  let late = 0;
  let leadSum = 0;
  let leadCount = 0;
  let receiveLeadSum = 0;
  let receiveLeadCount = 0;
  let withBackorder = 0;

  for (const p of pickings) {
    const done = p.dateDone ? new Date(p.dateDone) : null;
    const deadline = p.dateDeadline ? new Date(p.dateDeadline) : p.scheduledDate ? new Date(p.scheduledDate) : null;

    if (done && deadline) {
      if (done <= deadline) onTime += 1;
      else late += 1;
      leadSum += (done - new Date(p.createdAt || p.scheduledDate)) / (1000 * 60 * 60 * 24);
      leadCount += 1;
    }

    const code = p.operationTypeId?.code;
    if (code === 'incoming' && done && p.scheduledDate) {
      receiveLeadSum += (done - new Date(p.scheduledDate)) / (1000 * 60 * 60 * 24);
      receiveLeadCount += 1;
    }

    if (p.backorderId) withBackorder += 1;
  }

  const total = pickings.length;
  return {
    totalTransfers: total,
    onTimeDeliveryRate: total ? onTime / (onTime + late || 1) : null,
    lateTransfers: late,
    averageDeliveryLeadDays: leadCount ? leadSum / leadCount : null,
    averageDaysToReceive: receiveLeadCount ? receiveLeadSum / receiveLeadCount : null,
    backorderRate: total ? withBackorder / total : null,
    onTime,
  };
}
