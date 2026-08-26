import mongoose from 'mongoose';
import InvSequence from '../../models/inventory/InvSequence.js';
import { toObjectId } from '../../models/inventory/common.js';

/**
 * Atomically increment sequence and return formatted name e.g. WH/IN/00001
 */
export async function nextSequenceName(tenantId, code, session = null) {
  const tid = toObjectId(tenantId);
  const opts = session ? { session, new: true } : { new: true };

  let seq = await InvSequence.findOneAndUpdate(
    { tenantId: tid, code },
    { $inc: { nextNumber: 1 } },
    opts,
  );

  if (!seq) {
    const created = await InvSequence.create([{
      tenantId: tid,
      code,
      prefix: code,
      padding: 5,
      nextNumber: 2,
    }], session ? { session } : undefined);
    seq = created[0];
    return `${seq.prefix}/${String(1).padStart(seq.padding || 5, '0')}`;
  }

  const num = (seq.nextNumber || 2) - 1;
  return `${seq.prefix}/${String(num).padStart(seq.padding || 5, '0')}`;
}

export async function ensureSequence(tenantId, code, prefix, session = null) {
  const tid = toObjectId(tenantId);
  const existing = await InvSequence.findOne({ tenantId: tid, code }).session(session || null);
  if (existing) return existing;
  const [seq] = await InvSequence.create([{
    tenantId: tid,
    code,
    prefix,
    padding: 5,
    nextNumber: 1,
  }], session ? { session } : undefined);
  return seq;
}

/**
 * Atomic daily document number e.g. PO-20260826-001 (uses InvSequence $inc).
 */
export async function nextDailyDocNumber(tenantId, docPrefix, { padding = 3, session = null } = {}) {
  const tid = toObjectId(tenantId);
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const d = String(today.getDate()).padStart(2, '0');
  const code = `${docPrefix}-${y}${m}${d}`;
  await ensureSequence(tid, code, code, session);
  const opts = session ? { session, new: true } : { new: true };
  const seq = await InvSequence.findOneAndUpdate(
    { tenantId: tid, code },
    { $inc: { nextNumber: 1 } },
    opts,
  );
  const num = (seq?.nextNumber || 2) - 1;
  return `${code}-${String(num).padStart(padding, '0')}`;
}

/** Atomic padded doc number e.g. WO-00001 (uses InvSequence $inc). */
export async function nextDocNumber(tenantId, code, { padding = 5, session = null } = {}) {
  const tid = toObjectId(tenantId);
  await ensureSequence(tid, code, code, session);
  const opts = session ? { session, new: true } : { new: true };
  const seq = await InvSequence.findOneAndUpdate(
    { tenantId: tid, code },
    { $inc: { nextNumber: 1 } },
    opts,
  );
  const num = (seq?.nextNumber || 2) - 1;
  return `${code}-${String(num).padStart(padding, '0')}`;
}
