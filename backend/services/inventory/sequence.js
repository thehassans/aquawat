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
