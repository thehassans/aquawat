import Product from '../../models/Product.js';
import InvSequence from '../../models/inventory/InvSequence.js';
import { toObjectId } from '../../models/inventory/common.js';
import { ensureSequence } from './sequence.js';

const PRODUCT_SEQ_CODE = 'PRODUCT';
const PRODUCT_PREFIX = 'P';
const PRODUCT_PADDING = 5;

/**
 * Human-readable immutable product code: P00001.
 * Uses the same row-locked InvSequence as picking names — never count().
 */
export async function nextProductId(tenantId, session = null) {
  const tid = toObjectId(tenantId);
  await ensureSequence(tid, PRODUCT_SEQ_CODE, PRODUCT_PREFIX, session);

  const opts = session ? { session, new: true } : { new: true };
  let seq = await InvSequence.findOneAndUpdate(
    { tenantId: tid, code: PRODUCT_SEQ_CODE },
    { $inc: { nextNumber: 1 }, $set: { prefix: PRODUCT_PREFIX, padding: PRODUCT_PADDING } },
    opts,
  );

  if (!seq) {
    const created = await InvSequence.create([{
      tenantId: tid,
      code: PRODUCT_SEQ_CODE,
      prefix: PRODUCT_PREFIX,
      padding: PRODUCT_PADDING,
      nextNumber: 2,
    }], session ? { session } : undefined);
    seq = created[0];
    return `${PRODUCT_PREFIX}${String(1).padStart(PRODUCT_PADDING, '0')}`;
  }

  const num = (seq.nextNumber || 2) - 1;
  return `${PRODUCT_PREFIX}${String(num).padStart(seq.padding || PRODUCT_PADDING, '0')}`;
}

/** Align sequence cursor to the highest existing P##### so new codes never collide. */
export async function syncProductIdSequence(tenantId, session = null) {
  const tid = toObjectId(tenantId);
  const rows = await Product.find({
    tenantId: tid,
    productId: { $regex: /^P\d+$/ },
  }).select('productId').lean().session(session || null);

  let max = 0;
  for (const row of rows) {
    const m = /^P(\d+)$/.exec(row.productId || '');
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }

  await ensureSequence(tid, PRODUCT_SEQ_CODE, PRODUCT_PREFIX, session);
  const existing = await InvSequence.findOne({ tenantId: tid, code: PRODUCT_SEQ_CODE })
    .session(session || null);
  const nextNumber = Math.max(max + 1, existing?.nextNumber || 1);
  await InvSequence.findOneAndUpdate(
    { tenantId: tid, code: PRODUCT_SEQ_CODE },
    {
      $set: {
        prefix: PRODUCT_PREFIX,
        padding: PRODUCT_PADDING,
        nextNumber,
      },
    },
    session ? { session, upsert: true } : { upsert: true },
  );
  return { max, nextNumber };
}

/**
 * Assign productId to all products missing one (oldest first). Idempotent.
 */
export async function backfillProductIds(tenantId) {
  const tid = toObjectId(tenantId);
  await syncProductIdSequence(tid);

  const missing = await Product.find({
    tenantId: tid,
    $or: [
      { productId: { $exists: false } },
      { productId: null },
      { productId: '' },
    ],
  }).sort({ createdAt: 1 }).select('_id');

  let assigned = 0;
  for (const row of missing) {
    const code = await nextProductId(tid);
    // eslint-disable-next-line no-await-in-loop
    await Product.updateOne({ _id: row._id, tenantId: tid }, { $set: { productId: code } });
    assigned += 1;
  }
  return { assigned, remaining: 0 };
}

/** Lookup by productId / sku / barcode / ObjectId / externalId */
export async function findProductByIdentity(tenantId, key) {
  const tid = toObjectId(tenantId);
  const raw = String(key || '').trim();
  if (!raw) return null;

  if (/^P\d+$/i.test(raw)) {
    const byCode = await Product.findOne({ tenantId: tid, productId: raw.toUpperCase() });
    if (byCode) return byCode;
  }
  if (/^[a-f0-9]{24}$/i.test(raw)) {
    const byId = await Product.findOne({ _id: raw, tenantId: tid });
    if (byId) return byId;
  }
  return Product.findOne({
    tenantId: tid,
    $or: [
      { sku: raw },
      { barcode: raw },
      { externalId: raw },
      { productId: raw },
    ],
  });
}
