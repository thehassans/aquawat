import crypto from 'crypto';
import Invoice from '../../models/Invoice.js';
import { toObjectId } from '../../models/inventory/common.js';

/**
 * Ensure ZATCA-ready stub fields exist on an invoice document (model completeness).
 * Does NOT sign or transmit — only stamps uuid / icv / pih chain placeholders.
 * Idempotent: skips when uuid already present.
 */
export async function ensureInvoiceZatcaStub(invoice, { userId = null } = {}) {
  if (!invoice?._id || !invoice.tenantId) return invoice;

  const zatca = invoice.zatca || {};
  if (zatca.uuid && (zatca.icv != null || zatca.invoiceCounter != null)) {
    return invoice;
  }

  const tid = toObjectId(invoice.tenantId);
  const last = await Invoice.findOne({
    tenantId: tid,
    _id: { $ne: invoice._id },
    $or: [
      { 'zatca.icv': { $exists: true, $ne: null } },
      { 'zatca.invoiceCounter': { $exists: true, $ne: null } },
    ],
  })
    .sort({ 'zatca.icv': -1, 'zatca.invoiceCounter': -1, createdAt: -1 })
    .select('zatca')
    .lean();

  const prevIcv = Number(last?.zatca?.icv ?? last?.zatca?.invoiceCounter ?? 0);
  const icv = prevIcv + 1;
  const pih = last?.zatca?.invoiceHash
    || last?.zatca?.xmlHash
    || last?.zatca?.pih
    || 'NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYzIzOWRkNGU5MWI0NjcyOWQ3M2EyN2ZiNTdlOQ==';

  invoice.zatca = {
    ...zatca,
    uuid: zatca.uuid || crypto.randomUUID(),
    icv: zatca.icv ?? icv,
    invoiceCounter: zatca.invoiceCounter ?? icv,
    pih: zatca.pih || pih,
    previousInvoiceHash: zatca.previousInvoiceHash || pih,
    submissionStatus: zatca.submissionStatus || 'pending',
    syncStatus: zatca.syncStatus || 'PENDING_SYNC',
  };

  // Always keep ZATCA invoice type in sync with transactionType (never leave stale "standard" default)
  invoice.zatca.invoiceType = invoice.transactionType === 'B2C' ? 'simplified' : 'standard';

  if (userId) invoice.updatedBy = userId;
  await invoice.save();
  return invoice;
}
