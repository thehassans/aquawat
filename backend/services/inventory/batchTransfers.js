import InvBatchTransfer from '../../models/inventory/InvBatchTransfer.js';
import InvTransfer from '../../models/inventory/InvTransfer.js';
import InvOperationType from '../../models/inventory/InvOperationType.js';
import { toObjectId } from '../../models/inventory/common.js';
import { InventoryValidationError } from './errors.js';
import { getInvSettings } from './settingsService.js';
import {
  confirmTransfer,
  validateTransfer,
  checkAvailability,
  cancelTransfer,
} from './transferService.js';

async function assertBatchEnabled(tenantId) {
  const settings = await getInvSettings(tenantId);
  if (!settings.groupBatchTransfer) {
    throw new InventoryValidationError('Batch transfers are disabled in settings', 'BATCH_DISABLED');
  }
}

function recomputeBatchState(pickingStates) {
  if (!pickingStates.length) return 'draft';
  if (pickingStates.every((s) => s === 'cancelled')) return 'cancelled';
  if (pickingStates.every((s) => s === 'done' || s === 'cancelled')) return 'done';
  if (pickingStates.some((s) => ['waiting', 'confirmed', 'assigned', 'partiallyAvailable'].includes(s))) {
    return 'inProgress';
  }
  return 'draft';
}

export async function listBatchTransfers(tenantId, { state, limit = 50 } = {}) {
  await assertBatchEnabled(tenantId);
  const filter = { tenantId: toObjectId(tenantId) };
  if (state) filter.state = state;
  return InvBatchTransfer.find(filter)
    .populate('operationTypeId', 'name nameAr code')
    .sort({ scheduledDate: -1, createdAt: -1 })
    .limit(Math.min(100, Number(limit) || 50))
    .lean();
}

export async function getBatchTransfer(tenantId, id) {
  await assertBatchEnabled(tenantId);
  const tid = toObjectId(tenantId);
  const batch = await InvBatchTransfer.findOne({ _id: id, tenantId: tid })
    .populate('operationTypeId', 'name nameAr code')
    .lean();
  if (!batch) throw new InventoryValidationError('Batch not found', 'BATCH_NOT_FOUND');

  const pickings = await InvTransfer.find({
    tenantId: tid,
    _id: { $in: batch.pickingIds || [] },
  })
    .populate('operationTypeId', 'name nameAr code')
    .sort({ name: 1 })
    .lean();

  return { ...batch, pickings };
}

export async function createBatchTransfer(tenantId, userId, body) {
  await assertBatchEnabled(tenantId);
  const tid = toObjectId(tenantId);
  const name = String(body.name || '').trim() || `BATCH/${Date.now().toString(36).toUpperCase()}`;

  let operationTypeId = body.operationTypeId || null;
  if (operationTypeId) {
    const ot = await InvOperationType.findOne({ _id: operationTypeId, tenantId: tid, active: true }).lean();
    if (!ot) throw new InventoryValidationError('Operation type not found', 'OP_TYPE_NOT_FOUND');
    operationTypeId = ot._id;
  }

  const pickingIds = [];
  if (Array.isArray(body.pickingIds) && body.pickingIds.length) {
    const transfers = await InvTransfer.find({
      tenantId: tid,
      _id: { $in: body.pickingIds.map(toObjectId) },
      state: { $nin: ['done', 'cancelled'] },
    }).lean();
    pickingIds.push(...transfers.map((t) => t._id));
  }

  return InvBatchTransfer.create({
    tenantId: tid,
    name,
    userId: userId || null,
    operationTypeId,
    scheduledDate: body.scheduledDate ? new Date(body.scheduledDate) : new Date(),
    state: pickingIds.length ? 'inProgress' : 'draft',
    pickingIds,
    createdBy: userId,
  });
}

export async function addPickingsToBatch(tenantId, batchId, userId, pickingIds = []) {
  await assertBatchEnabled(tenantId);
  const tid = toObjectId(tenantId);
  const batch = await InvBatchTransfer.findOne({ _id: batchId, tenantId: tid });
  if (!batch) throw new InventoryValidationError('Batch not found', 'BATCH_NOT_FOUND');
  if (batch.state === 'done' || batch.state === 'cancelled') {
    throw new InventoryValidationError('Batch is closed', 'BATCH_CLOSED');
  }

  const ids = (pickingIds || []).map(toObjectId);
  if (!ids.length) throw new InventoryValidationError('pickingIds required', 'PICKINGS_REQUIRED');

  const filter = {
    tenantId: tid,
    _id: { $in: ids },
    state: { $nin: ['done', 'cancelled'] },
  };
  if (batch.operationTypeId) filter.operationTypeId = batch.operationTypeId;

  const transfers = await InvTransfer.find(filter).select('_id state').lean();
  const existing = new Set((batch.pickingIds || []).map((id) => String(id)));
  let added = 0;
  for (const t of transfers) {
    if (existing.has(String(t._id))) continue;
    batch.pickingIds.push(t._id);
    existing.add(String(t._id));
    added += 1;
  }

  const pickings = await InvTransfer.find({
    tenantId: tid,
    _id: { $in: batch.pickingIds },
  }).select('state').lean();
  batch.state = recomputeBatchState(pickings.map((p) => p.state));
  batch.updatedBy = userId;
  batch.version = (batch.version || 0) + 1;
  await batch.save();
  return { batch, added, skipped: ids.length - added };
}

export async function removePickingFromBatch(tenantId, batchId, userId, pickingId) {
  await assertBatchEnabled(tenantId);
  const tid = toObjectId(tenantId);
  const batch = await InvBatchTransfer.findOne({ _id: batchId, tenantId: tid });
  if (!batch) throw new InventoryValidationError('Batch not found', 'BATCH_NOT_FOUND');
  if (batch.state === 'done' || batch.state === 'cancelled') {
    throw new InventoryValidationError('Batch is closed', 'BATCH_CLOSED');
  }

  batch.pickingIds = (batch.pickingIds || []).filter((id) => String(id) !== String(pickingId));
  const pickings = await InvTransfer.find({
    tenantId: tid,
    _id: { $in: batch.pickingIds },
  }).select('state').lean();
  batch.state = recomputeBatchState(pickings.map((p) => p.state));
  batch.updatedBy = userId;
  batch.version = (batch.version || 0) + 1;
  await batch.save();
  return batch;
}

async function mapPickings(tenantId, batch, fn) {
  const tid = toObjectId(tenantId);
  const results = [];
  for (const pid of batch.pickingIds || []) {
    try {
      const out = await fn(pid);
      results.push({ pickingId: pid, ok: true, result: out });
    } catch (err) {
      results.push({
        pickingId: pid,
        ok: false,
        error: err.message,
        code: err.code || err.name,
      });
    }
  }
  const pickings = await InvTransfer.find({
    tenantId: tid,
    _id: { $in: batch.pickingIds || [] },
  }).select('state').lean();
  batch.state = recomputeBatchState(pickings.map((p) => p.state));
  batch.version = (batch.version || 0) + 1;
  await batch.save();
  return {
    batchId: batch._id,
    state: batch.state,
    results,
    okCount: results.filter((r) => r.ok).length,
    failCount: results.filter((r) => !r.ok).length,
  };
}

export async function confirmBatchTransfer(tenantId, batchId, userId) {
  await assertBatchEnabled(tenantId);
  const batch = await InvBatchTransfer.findOne({ _id: batchId, tenantId: toObjectId(tenantId) });
  if (!batch) throw new InventoryValidationError('Batch not found', 'BATCH_NOT_FOUND');
  return mapPickings(tenantId, batch, (pid) => confirmTransfer(tenantId, pid, userId));
}

export async function checkBatchAvailability(tenantId, batchId) {
  await assertBatchEnabled(tenantId);
  const batch = await InvBatchTransfer.findOne({ _id: batchId, tenantId: toObjectId(tenantId) });
  if (!batch) throw new InventoryValidationError('Batch not found', 'BATCH_NOT_FOUND');
  return mapPickings(tenantId, batch, (pid) => checkAvailability(tenantId, pid));
}

export async function validateBatchTransfer(tenantId, batchId, userId, opts = {}) {
  await assertBatchEnabled(tenantId);
  const batch = await InvBatchTransfer.findOne({ _id: batchId, tenantId: toObjectId(tenantId) });
  if (!batch) throw new InventoryValidationError('Batch not found', 'BATCH_NOT_FOUND');
  return mapPickings(tenantId, batch, (pid) => validateTransfer(tenantId, pid, {
    userId,
    createBackorder: opts.createBackorder,
  }));
}

export async function cancelBatchTransfer(tenantId, batchId, userId) {
  await assertBatchEnabled(tenantId);
  const batch = await InvBatchTransfer.findOne({ _id: batchId, tenantId: toObjectId(tenantId) });
  if (!batch) throw new InventoryValidationError('Batch not found', 'BATCH_NOT_FOUND');
  const summary = await mapPickings(tenantId, batch, (pid) => cancelTransfer(tenantId, pid, userId));
  batch.state = 'cancelled';
  batch.updatedBy = userId;
  await batch.save();
  return { ...summary, state: 'cancelled' };
}

/** B.6 — merged pick list aggregated by product+location, sorted by pickSequence */
export async function getMergedPickList(tenantId, batchId) {
  const tid = toObjectId(tenantId);
  const { pickings } = await getBatchTransfer(tenantId, batchId);
  const transferIds = pickings.map((p) => p._id);
  const InvMove = (await import('../../models/inventory/InvMove.js')).default;
  const InvMoveLine = (await import('../../models/inventory/InvMoveLine.js')).default;

  const moves = await InvMove.find({
    tenantId: tid,
    transferId: { $in: transferIds },
    state: { $nin: ['cancelled', 'done'] },
  }).select('_id transferId').lean();
  const moveIds = moves.map((m) => m._id);
  const moveTransfer = new Map(moves.map((m) => [String(m._id), m.transferId]));

  const lines = await InvMoveLine.find({
    tenantId: tid,
    moveId: { $in: moveIds },
    state: { $nin: ['done', 'cancelled'] },
  })
    .populate('productId', 'nameEn nameAr sku')
    .populate('sourceLocationId', 'name completePath pickSequence')
    .lean();

  const agg = new Map();
  for (const line of lines) {
    const pid = String(line.productId?._id || line.productId);
    const locId = String(line.sourceLocationId?._id || line.sourceLocationId);
    const key = `${pid}:${locId}:${line.lotId || ''}`;
    const qty = Number(line.quantityInProductUom || line.quantity || 0);
    const pickSeq = line.sourceLocationId?.pickSequence ?? 9999;
    const existing = agg.get(key) || {
      productId: line.productId?._id || line.productId,
      productName: line.productId?.nameEn || line.productId?.sku,
      locationId: line.sourceLocationId?._id,
      locationPath: line.sourceLocationId?.completePath || line.sourceLocationId?.name,
      pickSequence: pickSeq,
      lotId: line.lotId,
      qty: 0,
      allocations: [],
    };
    existing.qty += qty;
    existing.allocations.push({
      transferId: moveTransfer.get(String(line.moveId)),
      moveLineId: line._id,
      qty,
    });
    agg.set(key, existing);
  }

  const merged = [...agg.values()].sort((a, b) => a.pickSequence - b.pickSequence || a.locationPath?.localeCompare(b.locationPath));
  return { batchId, pickings: pickings.length, lines: merged };
}
