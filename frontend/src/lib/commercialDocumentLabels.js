export const isPurchaseOrderDocument = (documentType) => documentType === 'purchase_order'
export const isQuotationDocument = (documentType) => documentType === 'quotation'
export const isPurchaseInvoiceDocument = (documentType, invoice) =>
  documentType === 'purchase_invoice' || invoice?.flow === 'purchase'

export const shouldShowZatcaQr = (documentType) =>
  documentType !== 'quotation' && documentType !== 'purchase_order'

export const getCommercialDocumentTitle = (documentType, language = 'en', { uppercase = false, flow = 'sell' } = {}) => {
  let en = 'Tax Invoice'
  let ar = 'فاتورة ضريبية'
  if (documentType === 'purchase_order') {
    en = 'Purchase Order'
    ar = 'طلب شراء'
  } else if (documentType === 'quotation') {
    en = 'Quotation'
    ar = 'عرض سعر'
  } else if (documentType === 'purchase_invoice' || flow === 'purchase') {
    en = 'Purchase Invoice'
    ar = 'فاتورة شراء'
  }
  const value = language === 'ar' ? ar : en
  return uppercase ? value.toUpperCase() : value
}

export const getCommercialDocumentNumberLabel = (documentType, language = 'en', flow = 'sell') => {
  if (documentType === 'purchase_order') return language === 'ar' ? 'رقم طلب الشراء' : 'PO No.'
  if (documentType === 'quotation') return language === 'ar' ? 'رقم عرض السعر' : 'Quotation No.'
  if (documentType === 'purchase_invoice' || flow === 'purchase') return language === 'ar' ? 'رقم فاتورة الشراء' : 'Purchase Inv No.'
  return language === 'ar' ? 'رقم الفاتورة' : 'Invoice No.'
}

export const getCommercialCounterpartyLabel = (documentType, language = 'en', flow = 'sell') => {
  if (documentType === 'purchase_order' || documentType === 'purchase_invoice' || flow === 'purchase') {
    return language === 'ar' ? 'المورد' : 'Supplier'
  }
  return language === 'ar' ? 'الفاتورة إلى' : 'Bill To'
}

export const getCounterpartyFallbackName = (documentType, language = 'en', flow = 'sell') => {
  if (documentType === 'purchase_order' || documentType === 'purchase_invoice' || flow === 'purchase') {
    return language === 'ar' ? 'مورد نقدي' : 'Cash Supplier'
  }
  return language === 'ar' ? 'عميل نقدي' : 'Cash Customer'
}

export const resolveCommercialDocumentNumber = (invoice, documentType) => {
  if (documentType === 'purchase_order') {
    return invoice?.poNumber || invoice?.invoiceNumber || 'PO-DRAFT'
  }
  return invoice?.quotationNumber || invoice?.invoiceNumber || 'DRAFT-PREVIEW'
}

const hasArabicText = (value = '') => /[\u0600-\u06FF]/.test(String(value || ''))

export const resolveInvoiceParties = ({ invoice, tenant, invoiceBranding = {}, language = 'en', bilingual = false, documentType = 'invoice' }) => {
  const isPurchaseFlow = invoice?.flow === 'purchase' || documentType === 'purchase_invoice' || documentType === 'purchase_order'

  // Company / Header Info (The tenant / business owner issuing or recording the document):
  const companyNameEn = isPurchaseFlow
    ? (tenant?.business?.legalNameEn || tenant?.name || invoiceBranding?.legalNameEn || '')
    : (invoice?.seller?.name || invoice?.seller?.nameAr || tenant?.business?.legalNameEn || tenant?.business?.legalNameAr || invoiceBranding?.legalNameEn || '')
  
  const companyNameAr = isPurchaseFlow
    ? (tenant?.business?.legalNameAr || invoiceBranding?.legalNameAr || '')
    : (invoice?.seller?.nameAr || (hasArabicText(invoice?.seller?.name) ? invoice?.seller?.name : '') || tenant?.business?.legalNameAr || invoiceBranding?.legalNameAr || '')

  const companyAddress = isPurchaseFlow
    ? (tenant?.business?.address || null)
    : (invoice?.seller?.address || tenant?.business?.address || null)

  const companyPhone = isPurchaseFlow
    ? (tenant?.business?.contactPhone || tenant?.phone || '')
    : (invoice?.seller?.contactPhone || tenant?.business?.contactPhone || tenant?.phone || '')

  const companyEmail = isPurchaseFlow
    ? (tenant?.business?.contactEmail || tenant?.email || '')
    : (invoice?.seller?.contactEmail || tenant?.business?.contactEmail || tenant?.email || '')

  const companyVat = isPurchaseFlow
    ? (tenant?.business?.vatNumber || '')
    : (invoice?.seller?.vatNumber || tenant?.business?.vatNumber || '')

  const companyCr = isPurchaseFlow
    ? (tenant?.business?.crNumber || '')
    : (invoice?.seller?.crNumber || tenant?.business?.crNumber || '')

  const headerCompanyName = bilingual
    ? companyNameEn
    : (language === 'ar' ? (companyNameAr || companyNameEn) : (companyNameEn || companyNameAr))

  // Counterparty Info (Customer for sell/quotation, Supplier for purchase/PO):
  const counterpartyData = isPurchaseFlow ? invoice?.seller : invoice?.buyer
  const counterpartyNameEn = counterpartyData?.name || counterpartyData?.nameAr || (isPurchaseFlow ? 'Cash Supplier' : 'Cash Customer')
  const counterpartyNameAr = counterpartyData?.nameAr || (hasArabicText(counterpartyData?.name) ? counterpartyData?.name : '') || (isPurchaseFlow ? 'مورد نقدي' : 'عميل نقدي')
  const counterpartyName = bilingual
    ? counterpartyNameEn
    : (language === 'ar' ? (counterpartyNameAr || counterpartyNameEn) : (counterpartyNameEn || counterpartyNameAr))
  const counterpartyAddress = counterpartyData?.address
  const counterpartyPhone = counterpartyData?.contactPhone || counterpartyData?.phone
  const counterpartyEmail = counterpartyData?.contactEmail || counterpartyData?.email
  const counterpartyVat = counterpartyData?.vatNumber
  const counterpartyCr = counterpartyData?.crNumber
  const counterpartyNtn = counterpartyData?.ntn || counterpartyData?.taxId
  const counterpartyStrn = counterpartyData?.strn

  const companyNtn = tenant?.fbr?.ntn || tenant?.business?.ntn || invoice?.seller?.ntn || ''
  const companyStrn = tenant?.fbr?.strn || tenant?.business?.strn || invoice?.seller?.strn || ''

  const isPk = String(invoice?.currency || tenant?.settings?.currency || '').toUpperCase() === 'PKR' ||
    (tenant?.business?.address?.country || '').toUpperCase() === 'PK'
  const taxLabel = isPk ? 'GST' : 'VAT'
  const taxIdLabel = isPk ? 'NTN / STRN' : 'VAT'

  const counterpartyLabelEn = getCommercialCounterpartyLabel(documentType, 'en', invoice?.flow)
  const counterpartyLabelAr = getCommercialCounterpartyLabel(documentType, 'ar', invoice?.flow)

  return {
    isPurchaseFlow,
    companyNameEn,
    companyNameAr,
    headerCompanyName,
    companyAddress,
    companyPhone,
    companyEmail,
    companyVat,
    companyCr,
    companyNtn,
    companyStrn,
    counterpartyData,
    counterpartyNameEn,
    counterpartyNameAr,
    counterpartyName,
    counterpartyAddress,
    counterpartyPhone,
    counterpartyEmail,
    counterpartyVat,
    counterpartyCr,
    counterpartyNtn,
    counterpartyStrn,
    taxLabel,
    taxIdLabel,
    counterpartyLabelEn,
    counterpartyLabelAr,
  }
}


