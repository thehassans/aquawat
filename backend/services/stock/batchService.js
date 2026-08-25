import mongoose from 'mongoose';
import StockPickingBatch from '../../models/stock/StockPickingBatch.js';
import StockPicking from '../../models/stock/StockPicking.js';
import { nextSequenceName, ensureSequence } from './sequence.js';
import {
  confirmPicking,
  checkAvailability,
  validatePicking,
  cancelPicking,
} from './pickingService.js';
import { StockValidationError } from './errors.js';

function computeBatchState(pickings) {
  if (!pickings.length) return 'draft';
  const states = pickings.map((p) => p.state);
  if (states.every((s) => s === 'cancel')) return 'cancel';
  if (states.every((s) => s === 'done' || s === 'cancel') && states.some((s) => s === 'done')) return 'done';
  if (states.every((s) => s === 'draft')) return 'draft';
  return 'in_progress';
}

export async function createBatch(tenantId, userId, { name, operationTypeId, pickingIds = [], scheduledDate, notes }) {
  const tid = new mongoose.Types.ObjectId(String(tenantId));
  await ensureSequence(tid, 'BATCH', 'BATCH');
  const batchName = name || await nextSequenceName(tid, 'BATCH');

  const ids = (pickingIds || []).map((id) => new mongoose.Types.ObjectId(String(id)));
  if (ids.length) {
    const count = await StockPicking.countDocuments({
      tenantId: tid,
      _id: { $in: ids },
      state: { $nin: ['done', 'cancel'] },
    });
    if (count !== ids.length) {
      throw new StockValidationError('Some pickings are missing or already done/cancelled', 'BATCH_PICKINGS');
    }
  }

  const [batch] = await StockPickingBatch.create([{
    tenantId: tid,
    name: batchName,
    operationTypeId: operationTypeId || null,
    userId: userId || null,
    scheduledDate: scheduledDate ? new Date(scheduledDate) : new Date(),
    pickingIds: ids,
    notes,
    createdBy: userId,
  }]);

  if (ids.length) {
    await StockPicking.updateMany(
      { tenantId: tid, _id: { $in: ids } },
      { $set: { batchId: batch._id } },
    );
  }

  return batch;
}

export async function setBatchPickings(tenantId, batchId, pickingIds) {
  const tid = new mongoose.Types.ObjectId(String(tenantId));
  const batch = await StockPickingBatch.findOne({ _id: batchId, tenantId: tid });
  if (!batch) throw new StockValidationError('Batch not found', 'BATCH_NOT_FOUND');
  if (batch.state === 'done' || batch.state === 'cancel') {
    throw new StockValidationError('Cannot edit a closed batch', 'BATCH_CLOSED');
  }

  const ids = (pickingIds || []).map((id) => new mongoose.Types.ObjectId(String(id)));
  await StockPicking.updateMany(
    { tenantId: tid, batchId: batch._id },
    { $unset: { batchId: 1 } },
  );
  if (ids.length) {
    await StockPicking.updateMany(
      { tenantId: tid, _id: { $in: ids }, state: { $nin: ['done', 'cancel'] } },
      { $set: { batchId: batch._id } },
    );
  }
  batch.pickingIds = ids;
  const pickings = await StockPicking.find({ _id: { $in: ids }, tenantId: tid }).lean();
  batch.state = computeBatchState(pickings);
  await batch.save();
  return batch;
}

export async function runBatchAction(tenantId, userId, batchId, action, opts = {}) {
  const tid = new mongoose.Types.ObjectId(String(tenantId));
  const batch = await StockPickingBatch.findOne({ _id: batchId, tenantId: tid });
  if (!batch) throw new StockValidationError('Batch not found', 'BATCH_NOT_FOUND');

  const pickings = await StockPicking.find({
    tenantId: tid,
    _id: { $in: batch.pickingIds },
    state: { $nin: ['done', 'cancel'] },
  });

  const results = [];
  for (const p of pickings) {
    try {
      if (action === 'confirm') await confirmPicking(p._id, tid, userId);
      else if (action === 'check') await checkAvailability(p._id, tid, userId);
      else if (action === 'validate') await validatePicking(p._id, tid, userId, opts);
      else if (action === 'cancel') await cancelPicking(p._id, tid, userId);
      else throw new StockValidationError(`Unknown action ${action}`, 'BATCH_ACTION');
      results.push({ pickingId: p._id, ok: true });
    } catch (err) {
      results.push({ pickingId: p._id, ok: false, error: err.message, code: err.code });
    }
  }

  const refreshed = await StockPicking.find({ _id: { $in: batch.pickingIds }, tenantId: tid }).lean();
  batch.state = computeBatchState(refreshed);
  await batch.save();
  return { batch, results };
}

export { computeBatchState };
