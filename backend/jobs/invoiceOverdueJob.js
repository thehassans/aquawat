import Invoice from '../models/Invoice.js';
import logger from '../utils/logger.js';
import { startOfDayInRiyadh } from '../utils/riyadhTime.js';

/**
 * Mark unpaid sell invoices overdue after 00:00 Asia/Riyadh on the due date.
 */
export async function markOverdueInvoices() {
  const cutoff = startOfDayInRiyadh();

  const result = await Invoice.updateMany(
    {
      flow: { $ne: 'purchase' },
      paymentStatus: { $in: ['pending', 'partial'] },
      status: { $nin: ['draft', 'cancelled', 'credited'] },
      dueDate: { $ne: null, $lt: cutoff },
      $expr: { $lt: [{ $ifNull: ['$paidAmount', 0] }, { $ifNull: ['$grandTotal', 0] }] },
    },
    { $set: { paymentStatus: 'overdue' } }
  );

  const matched = result.matchedCount ?? result.n ?? 0;
  const modified = result.modifiedCount ?? result.nModified ?? 0;
  if (modified > 0) {
    logger.info(`[invoices] marked ${modified}/${matched} invoices overdue (due before ${cutoff.toISOString()})`);
  }
  return { matched, modified, cutoff };
}
