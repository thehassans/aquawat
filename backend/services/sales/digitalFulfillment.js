import Product from '../../models/Product.js';
import Customer from '../../models/Customer.js';
import { sendTenantEmail } from '../../utils/tenantEmailService.js';
import logger from '../../utils/logger.js';

/**
 * After invoice validation/approval, email digital/service product content to the customer.
 */
export async function deliverDigitalProductsByEmail(invoice, { language = 'en' } = {}) {
  if (!invoice || invoice.flow !== 'sell') return { sent: false, reason: 'not_sell' };
  const status = String(invoice.status || '');
  const paymentStatus = String(invoice.paymentStatus || '');
  // Blueprint Phase 5.3: fire on PAID (also honor partially_paid for installment digital goods)
  const paidEnough = ['paid', 'partially_paid'].includes(paymentStatus) || ['paid', 'partially_paid'].includes(status);
  if (!paidEnough) {
    return { sent: false, reason: 'not_paid' };
  }

  const buyerEmail = invoice.buyer?.contactEmail || invoice.buyer?.email;
  let customerEmail = buyerEmail;
  if (invoice.customerId) {
    const customer = await Customer.findById(invoice.customerId).select('email contactPerson').lean();
    customerEmail = customer?.email || customer?.contactPerson?.email || customerEmail;
  }
  if (!customerEmail) return { sent: false, reason: 'no_email' };

  const productIds = [...new Set((invoice.lineItems || invoice.lines || [])
    .map((l) => l.productId)
    .filter(Boolean)
    .map(String))];

  let productsById = new Map();
  if (productIds.length) {
    const products = await Product.find({ _id: { $in: productIds }, tenantId: invoice.tenantId })
      .select('name nameEn productType descriptionEn descriptionAr notes')
      .lean();
    productsById = new Map(products.map((p) => [String(p._id), p]));
  }

  const digitalLines = [];
  for (const line of invoice.lineItems || invoice.lines || []) {
    const product = line.productId ? productsById.get(String(line.productId)) : null;
    const isService = normalizeProductType(line.productType || product?.productType) === 'service';
    const content = String(line.description || product?.descriptionEn || product?.notes || '').trim();
    if (isService && content) {
      digitalLines.push({
        name: line.productName || product?.nameEn || product?.name || 'Digital product',
        content,
        quantity: line.quantity || 1,
      });
    }
  }

  if (!digitalLines.length) return { sent: false, reason: 'no_digital_lines' };

  const isAr = language === 'ar';
  const subject = isAr
    ? `محتوى رقمي — فاتورة ${invoice.invoiceNumber}`
    : `Your digital delivery — Invoice ${invoice.invoiceNumber}`;

  const bodyHtml = digitalLines.map((row) => `
    <div style="margin-bottom:16px;padding:12px;border:1px solid #e2e8f0;border-radius:8px">
      <strong>${escapeHtml(row.name)}</strong> × ${row.quantity}
      <pre style="white-space:pre-wrap;margin-top:8px;font-family:inherit">${escapeHtml(row.content)}</pre>
    </div>
  `).join('');

  try {
    await sendTenantEmail({
      tenantId: invoice.tenantId,
      to: customerEmail,
      subject,
      html: `<p>${isAr ? 'شكراً لشرائك. فيما يلي المحتوى الرقمي المرتبط بفاتورتك:' : 'Thank you for your purchase. Here is your digital content:'}</p>${bodyHtml}`,
    });
    return { sent: true, lineCount: digitalLines.length, to: customerEmail };
  } catch (err) {
    logger.warn(`[digitalFulfillment] ${invoice._id}: ${err.message}`);
    return { sent: false, reason: 'email_error', error: err.message };
  }
}

function normalizeProductType(value) {
  return String(value || 'goods').toLowerCase() === 'service' ? 'service' : 'goods';
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
