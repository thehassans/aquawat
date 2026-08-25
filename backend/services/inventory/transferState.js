import InvMove from '../../models/inventory/InvMove.js';
import InvTransfer from '../../models/inventory/InvTransfer.js';
import { toObjectId } from '../../models/inventory/common.js';

/**
 * Derive transfer state from its moves (never set transfer.state ad-hoc except cancel-all).
 */
export function deriveTransferState(moves) {
  if (!moves.length) return 'draft';
  const active = moves.filter((m) => m.state !== 'cancelled');
  if (active.length === 0) return 'cancelled';

  const states = active.map((m) => m.state);
  if (states.every((s) => s === 'draft')) return 'draft';
  if (states.every((s) => s === 'done' || s === 'cancelled') && states.some((s) => s === 'done')) {
    return 'done';
  }
  if (states.some((s) => s === 'waiting') && !states.some((s) => s === 'assigned' || s === 'partiallyAvailable')) {
    return 'waiting';
  }
  if (states.every((s) => s === 'assigned' || s === 'done')) return 'assigned';
  if (states.some((s) => s === 'assigned' || s === 'partiallyAvailable')) return 'assigned';
  return 'confirmed';
}

export async function recomputeTransferState(transferId, tenantId, session = null) {
  const tid = toObjectId(tenantId);
  const id = toObjectId(transferId);
  const moves = await InvMove.find({ tenantId: tid, transferId: id }).session(session || null);
  const state = deriveTransferState(moves);
  await InvTransfer.updateOne(
    { _id: id, tenantId: tid },
    { $set: { state, ...(state === 'done' ? { doneDate: new Date() } : {}) } },
    session ? { session } : undefined,
  );
  return state;
}
