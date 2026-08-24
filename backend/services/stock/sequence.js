import mongoose from 'mongoose';
import StockSequence from '../../models/stock/StockSequence.js';

/**
 * Atomically increment sequence and return formatted name e.g. WH/IN/00001
 * @param {import('mongoose').Types.ObjectId|string} tenantId
 * @param {string} code
 * @param {import('mongoose').ClientSession} [session]
 */
export async function nextSequenceName(tenantId, code, session = null) {
  const tid = new mongoose.Types.ObjectId(String(tenantId));
  const opts = session ? { session, new: true } : { new: true };

  let seq = await StockSequence.findOneAndUpdate(
    { tenantId: tid, code },
    { $inc: { nextNumber: 1 } },
    opts,
  );

  if (!seq) {
    const created = await StockSequence.create([{
      tenantId: tid,
      code,
      prefix: code,
      padding: 5,
      nextNumber: 2,
    }], session ? { session } : undefined);
    seq = created[0];
    const num = 1;
    const padded = String(num).padStart(seq.padding || 5, '0');
    return `${seq.prefix}/${padded}`;
  }

  const num = (seq.nextNumber || 2) - 1;
  const padded = String(num).padStart(seq.padding || 5, '0');
  return `${seq.prefix}/${padded}`;
}

/**
 * Ensure sequence row exists with prefix (does not consume a number).
 */
export async function ensureSequence(tenantId, code, prefix, session = null) {
  const tid = new mongoose.Types.ObjectId(String(tenantId));
  const existing = await StockSequence.findOne({ tenantId: tid, code }).session(session || null);
  if (existing) return existing;
  const [seq] = await StockSequence.create([{
    tenantId: tid,
    code,
    prefix,
    padding: 5,
    nextNumber: 1,
  }], session ? { session } : undefined);
  return seq;
}
