import { emitPlatformEvent, invoiceEventProps } from './platformEvents.js';
import { enqueueInvoicePdf } from '../services/invoicePdfQueue.js';
import { cacheDelPrefix } from '../lib/redis.js';
import logger from './logger.js';
import Invoice from '../models/Invoice.js';
import Tenant from '../models/Tenant.js';

export function invalidateInvoiceCaches(tenantId) {
  if (!tenantId) return;
  const id = String(tenantId);
  cacheDelPrefix(`invoices:stats:${id}:`).catch(() => {});
  cacheDelPrefix(`reports:vat:${id}:`).catch(() => {});
}

async function maybeEmitFirstInvoice(invoice) {
  try {
    if (invoice.flow === 'purchase' || invoice.status === 'draft') return;
    const tenant = await Tenant.findById(invoice.tenantId).select('createdAt').lean();
    if (!tenant?.createdAt) return;
    const ageMs = Date.now() - new Date(tenant.createdAt).getTime();
    if (ageMs > 7 * 24 * 60 * 60 * 1000) return;
    const count = await Invoice.countDocuments({
      tenantId: invoice.tenantId,
      flow: { $ne: 'purchase' },
      status: { $nin: ['draft', 'cancelled'] },
    });
    if (count === 1) {
      emitPlatformEvent('first_invoice_within_7d', {
        tenantId: String(invoice.tenantId),
        invoiceId: String(invoice._id),
      });
    }
  } catch (error) {
    logger.warn(`[invoiceLifecycle] first_invoice_within_7d: ${error.message}`);
  }
}

export function afterInvoiceWrite(invoice, { userId, created = false, previousPaymentStatus } = {}) {
  if (!invoice?._id) return;

  invalidateInvoiceCaches(invoice.tenantId);
  enqueueInvoicePdf(invoice._id);

  const props = invoiceEventProps(invoice, { userId: userId ? String(userId) : undefined });
  logger.info({ message: 'invoice_write', created, ...props });
  if (created) {
    emitPlatformEvent('invoice_created', props);
    maybeEmitFirstInvoice(invoice);
  }
  if (invoice.paymentStatus === 'paid' && previousPaymentStatus !== 'paid') {
    emitPlatformEvent('invoice_paid', props);
  }
}
