import { randomUUID } from 'crypto';
import { InventoryConflictError } from './errors.js';

/**
 * Acquire a short-lived advisory lock on a document via a lock field.
 * Returns the locked doc or throws WRITE_CONFLICT / typed code.
 */
export async function acquireAdvisoryLock(Model, {
  filter,
  lockField = 'advisoryLock',
  lockValue = randomUUID(),
  session = null,
  conflictCode = 'WRITE_CONFLICT',
  conflictMessage,
} = {}) {
  const query = {
    ...filter,
    $or: [
      { [lockField]: null },
      { [lockField]: { $exists: false } },
      { [lockField]: '' },
    ],
  };
  const opts = { new: true };
  if (session) opts.session = session;

  const doc = await Model.findOneAndUpdate(
    query,
    { $set: { [lockField]: lockValue } },
    opts,
  );

  if (!doc) {
    throw new InventoryConflictError(
      conflictMessage || 'Resource is locked by another operation — refresh and retry',
      conflictCode,
    );
  }

  return { doc, lockValue, release: async () => {
    await Model.updateOne(
      { _id: doc._id, [lockField]: lockValue },
      { $unset: { [lockField]: 1 } },
      session ? { session } : undefined,
    );
  } };
}

function isTransientWriteConflict(err) {
  if (!err) return false;
  if (err.code === 112 || err.codeName === 'WriteConflict') return true;
  if (err.errorLabels?.includes?.('TransientTransactionError')) return true;
  const msg = String(err.message || '');
  return /WriteConflict|TransientTransactionError|Unable to acquire|lock/i.test(msg);
}

function jitterMs(base = 40) {
  return base + Math.floor(Math.random() * 80);
}

/**
 * Run fn once; on write conflict wait with jitter and retry once.
 * Further conflicts → typed WRITE_CONFLICT 409.
 */
export async function withWriteConflictRetry(fn, { retries = 1 } = {}) {
  let attempt = 0;
  for (;;) {
    try {
      return await fn(attempt);
    } catch (err) {
      if (attempt >= retries || !isTransientWriteConflict(err)) throw err;
      attempt += 1;
      await new Promise((r) => setTimeout(r, jitterMs(40 * attempt)));
    }
  }
}
