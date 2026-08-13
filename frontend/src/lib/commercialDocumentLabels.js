export const isPurchaseOrderDocument = (documentType) => documentType === 'purchase_order'
export const isQuotationDocument = (documentType) => documentType === 'quotation'

export const shouldShowZatcaQr = (documentType) =>
  documentType !== 'quotation' && documentType !== 'purchase_order'

export const getCommercialDocumentTitle = (documentType, language = 'en', { uppercase = false } = {}) => {
  let en = 'Tax Invoice'
  let ar = 'فاتورة ضريبية'
  if (documentType === 'purchase_order') {
    en = 'Purchase Order'
    ar = 'طلب شراء'
  } else if (documentType === 'quotation') {
    en = 'Quotation'
    ar = 'عرض سعر'
  }
  const value = language === 'ar' ? ar : en
  return uppercase ? value.toUpperCase() : value
}

export const getCommercialDocumentNumberLabel = (documentType, language = 'en') => {
  if (documentType === 'purchase_order') return language === 'ar' ? 'رقم طلب الشراء' : 'PO No.'
  if (documentType === 'quotation') return language === 'ar' ? 'رقم عرض السعر' : 'Quotation No.'
  return language === 'ar' ? 'رقم الفاتورة' : 'Invoice No.'
}

export const getCommercialCounterpartyLabel = (documentType, language = 'en') => {
  if (documentType === 'purchase_order') return language === 'ar' ? 'المورد' : 'Supplier'
  return language === 'ar' ? 'الفاتورة إلى' : 'Bill To'
}

export const getCounterpartyFallbackName = (documentType, language = 'en') => {
  if (documentType === 'purchase_order') return language === 'ar' ? 'المورد' : 'Supplier'
  return language === 'ar' ? 'عميل نقدي' : 'Cash Customer'
}

export const resolveCommercialDocumentNumber = (invoice, documentType) => {
  if (documentType === 'purchase_order') {
    return invoice?.poNumber || invoice?.invoiceNumber || 'PO-DRAFT'
  }
  return invoice?.quotationNumber || invoice?.invoiceNumber || 'DRAFT-PREVIEW'
}
