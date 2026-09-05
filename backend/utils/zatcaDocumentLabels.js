/**
 * ZATCA document titles for PDF / print — no silent Tax Invoice fallback.
 * standard → Tax Invoice / فاتورة ضريبية
 * simplified → Simplified Tax Invoice / فاتورة ضريبية مبسطة
 */

export function resolveZatcaInvoiceKind(invoice, { required = false } = {}) {
  if (!invoice) {
    if (required) throw new Error('Invoice is required to resolve ZATCA document title');
    return null;
  }
  const docType = String(invoice.invoiceType || '').trim();
  if (docType === '381') return 'credit_note';
  if (docType === '383') return 'debit_note';

  const code = String(invoice.invoiceTypeCode || '');
  const txn = String(invoice.transactionType || '').toUpperCase();
  if (code.startsWith('02') || txn === 'B2C' || txn === 'SIMPLIFIED') return 'simplified';
  if (code.startsWith('01') || txn === 'B2B' || txn === 'STANDARD') return 'standard';

  const zatcaType = String(invoice?.zatca?.invoiceType || '').toLowerCase();
  if (zatcaType === 'simplified' || zatcaType === 'standard') {
    return zatcaType === 'simplified' ? 'simplified' : 'standard';
  }

  if (required) {
    throw new Error('Cannot resolve ZATCA invoice kind: set transactionType (B2B/B2C) or invoiceTypeCode (01…/02…)');
  }
  return null;
}

export function getZatcaDocumentTitle(invoice, language = 'en') {
  const kind = resolveZatcaInvoiceKind(invoice, { required: true });
  if (kind === 'credit_note') {
    return language === 'ar' ? 'إشعار دائن' : 'Credit Note';
  }
  if (kind === 'debit_note') {
    return language === 'ar' ? 'إشعار مدين' : 'Debit Note';
  }
  if (kind === 'simplified') {
    return language === 'ar' ? 'فاتورة ضريبية مبسطة' : 'Simplified Tax Invoice';
  }
  if (kind === 'standard') {
    return language === 'ar' ? 'فاتورة ضريبية' : 'Tax Invoice';
  }
  throw new Error(`Unsupported ZATCA invoice kind: ${kind}`);
}

export function zatcaInvoiceTypeForTransaction(txn) {
  return String(txn || '').toUpperCase() === 'B2C' ? 'simplified' : 'standard';
}
