/**
 * One-off / boot-safe: ensure sell PO line items have Mongo _ids for sale_line_ids linkage.
 * Safe to run repeatedly.
 */
import mongoose from 'mongoose';
import PurchaseOrder from '../models/PurchaseOrder.js';
import logger from '../utils/logger.js';

export async function backfillSellOrderLineIds({ tenantId = null, limit = 500 } = {}) {
  const filter = {
    flow: 'sell',
    ...(tenantId ? { tenantId } : {}),
  };

  let scanned = 0;
  let patched = 0;
  const cursor = PurchaseOrder.find(filter).select('lineItems').cursor();

  for await (const order of cursor) {
    scanned += 1;
    if (scanned > limit * 20) break;
    const lines = order.lineItems || [];
    let dirty = false;
    for (const li of lines) {
      if (!li._id) {
        li._id = new mongoose.Types.ObjectId();
        dirty = true;
      }
    }
    if (dirty) {
      order.markModified('lineItems');
      await order.save();
      patched += 1;
      if (patched >= limit) break;
    }
  }

  logger.info(`[migrate] sell PO line _ids: scanned=${scanned} patched=${patched}`);
  return { scanned, patched };
}

export default backfillSellOrderLineIds;
