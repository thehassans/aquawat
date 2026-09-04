import { getTaxIdLabel } from './saudiTenant.js'

export const isPurchaseOrderDocument = (documentType) => documentType === 'purchase_order'
export const isVendorBillDocument = (documentType) => documentType === 'vendor_bill'
export const isQuotationDocument = (documentType) => documentType === 'quotation'
export const isSalesOrderDocument = (documentType) => documentType === 'sales_order'
export const isPurchaseInvoiceDocument = (documentType, invoice) =>
  documentType === 'purchase_invoice' || (invoice?.flow === 'purchase' && documentType !== 'vendor_bill' && documentType !== 'purchase_order')

export const shouldShowZatcaQr = (documentType) =>
  documentType !== 'quotation'
  && documentType !== 'purchase_order'
  && documentType !== 'vendor_bill'
  && documentType !== 'sales_order'

export const getCommercialDocumentTitle = (documentType, language = 'en', { uppercase = false, flow = 'sell', invoice = null } = {}) => {
  let en = ''
  let ar = ''
  if (documentType === 'purchase_order') {
    en = 'Purchase Order'
    ar = 'طلب شراء'
  } else if (documentType === 'vendor_bill') {
    en = 'Purchase Order Bill'
    ar = 'فاتورة أمر الشراء'
  } else if (documentType === 'sales_order') {
    en = 'Sales Order Bill'
    ar = 'فاتورة أمر البيع'
  } else if (documentType === 'quotation') {
    en = 'Quotation'
    ar = 'عرض سعر'
  } else if (documentType === 'purchase_invoice' || flow === 'purchase') {
    en = 'Purchase Invoice'
    ar = 'فاتورة شراء'
  } else if (documentType === 'credit_note' || String(invoice?.invoiceType || '') === '381') {
    en = 'Credit Note'
    ar = 'إشعار دائن'
  } else if (documentType === 'debit_note' || String(invoice?.invoiceType || '') === '383') {
    en = 'Debit Note'
    ar = 'إشعار مدين'
  } else {
    const kind = resolveZatcaInvoiceKind(invoice, { required: true })
    if (kind === 'simplified') {
      en = 'Simplified Tax Invoice'
      ar = 'فاتورة ضريبية مبسطة'
    } else if (kind === 'credit_note') {
      en = 'Credit Note'
      ar = 'إشعار دائن'
    } else if (kind === 'debit_note') {
      en = 'Debit Note'
      ar = 'إشعار مدين'
    } else if (kind === 'standard') {
      en = 'Tax Invoice'
      ar = 'فاتورة ضريبية'
    } else {
      throw new Error(`Unsupported ZATCA invoice kind: ${kind}`)
    }
  }
  const value = language === 'ar' ? ar : en
  return uppercase ? value.toUpperCase() : value
}

/**
 * ZATCA document kind derived from invoice fields.
 * @param {{ required?: boolean }} [opts] When required, throws if kind cannot be determined (no silent Tax Invoice default).
 */
export function resolveZatcaInvoiceKind(invoice, { required = false } = {}) {
  if (!invoice) {
    if (required) throw new Error('Invoice is required to resolve ZATCA document title')
    return null
  }
  const docType = String(invoice.invoiceType || '').trim()
  if (docType === '381') return 'credit_note'
  if (docType === '383') return 'debit_note'

  const zatcaType = String(invoice?.zatca?.invoiceType || '').toLowerCase()
  if (zatcaType === 'simplified' || zatcaType === 'standard') {
    return zatcaType === 'simplified' ? 'simplified' : 'standard'
  }

  const code = String(invoice.invoiceTypeCode || '')
  const txn = String(invoice.transactionType || '').toUpperCase()
  if (code.startsWith('02') || txn === 'B2C' || txn === 'SIMPLIFIED') return 'simplified'
  if (code.startsWith('01') || txn === 'B2B' || txn === 'STANDARD') return 'standard'

  // Some UIs store a display label on invoiceType
  const label = String(invoice.invoiceType || '').toLowerCase()
  if (label.includes('simplified') || label.includes('b2c') || label.includes('مبسطة')) return 'simplified'
  if (label.includes('standard') || label.includes('b2b') || label === '388') return 'standard'

  if (required) {
    throw new Error('Cannot resolve ZATCA invoice kind: set transactionType (B2B/B2C) or invoiceTypeCode (01…/02…)')
  }
  return null
}

export function formatPartyAddress(address = {}, { bilingual = false, language = 'en' } = {}) {
  if (!address || typeof address !== 'object') return ''
  const en = [
    address.buildingNumber,
    address.street,
    address.district,
    address.city,
    address.postalCode,
    address.country,
  ].filter(Boolean).join(', ')
  const ar = [
    address.buildingNumber,
    address.streetAr || address.street,
    address.districtAr || address.district,
    address.cityAr || address.city,
    address.postalCode,
    address.country,
  ].filter(Boolean).join('، ')
  if (bilingual && ar && ar !== en) return { en, ar }
  return language === 'ar' ? (ar || en) : (en || ar)
}

export function getZatcaDocumentTitle(invoice, language = 'en', documentType = 'invoice') {
  return getCommercialDocumentTitle(documentType, language, {
    flow: invoice?.flow || 'sell',
    invoice,
  })
}

export const getCommercialDocumentNumberLabel = (documentType, language = 'en', flow = 'sell') => {
  if (documentType === 'purchase_order') return language === 'ar' ? 'رقم طلب الشراء' : 'PO No.'
  if (documentType === 'vendor_bill') return language === 'ar' ? 'رقم فاتورة أمر الشراء' : 'Bill No.'
  if (documentType === 'sales_order') return language === 'ar' ? 'رقم أمر البيع' : 'SO No.'
  if (documentType === 'quotation') return language === 'ar' ? 'رقم عرض السعر' : 'Quotation No.'
  if (documentType === 'purchase_invoice' || flow === 'purchase') return language === 'ar' ? 'رقم فاتورة الشراء' : 'Purchase Inv No.'
  return language === 'ar' ? 'رقم الفاتورة' : 'Invoice No.'
}

export const getCommercialCounterpartyLabel = (documentType, language = 'en', flow = 'sell') => {
  if (documentType === 'purchase_order' || documentType === 'vendor_bill' || documentType === 'purchase_invoice' || flow === 'purchase') {
    return language === 'ar' ? 'المورد' : 'Supplier'
  }
  return language === 'ar' ? 'الفاتورة إلى' : 'Bill To'
}

export const getCounterpartyFallbackName = (documentType, language = 'en', flow = 'sell') => {
  if (documentType === 'purchase_order' || documentType === 'vendor_bill' || documentType === 'purchase_invoice' || flow === 'purchase') {
    return language === 'ar' ? 'مورد نقدي' : 'Cash Supplier'
  }
  return language === 'ar' ? 'عميل نقدي' : 'Cash Customer'
}

export const resolveCommercialDocumentNumber = (invoice, documentType) => {
  if (documentType === 'purchase_order') {
    return invoice?.poNumber || invoice?.invoiceNumber || 'PO-DRAFT'
  }
  if (documentType === 'vendor_bill') {
    return invoice?.billNumber || (invoice?.poNumber ? `BILL-${invoice.poNumber}` : invoice?.invoiceNumber || 'BILL-DRAFT')
  }
  if (documentType === 'sales_order') {
    return invoice?.poNumber || invoice?.invoiceNumber || 'SO-DRAFT'
  }
  return invoice?.quotationNumber || invoice?.invoiceNumber || 'DRAFT-PREVIEW'
}

const hasArabicText = (value = '') => /[\u0600-\u06FF]/.test(String(value || ''))

export const resolveInvoiceParties = ({ invoice, tenant, invoiceBranding = {}, language = 'en', bilingual = false, documentType = 'invoice' }) => {
  const isPurchaseFlow = invoice?.flow === 'purchase' || documentType === 'purchase_invoice' || documentType === 'purchase_order' || documentType === 'vendor_bill'

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

  const cur = String(invoice?.currency || tenant?.settings?.currency || '').toUpperCase()

  const isDummyVat = (val) => !val || /^DEMO-\d+/i.test(String(val).trim()) || /^(0{10,15}|X{5,})$/i.test(String(val).trim())
  const isDummyCr = (val) => !val || /^CR-\d+/i.test(String(val).trim()) || /^(0{7,12}|X{5,}|1010X+)$/i.test(String(val).trim())

  const countryTaxId = isPurchaseFlow ? '' : (
    cur === 'AED' ? (tenant?.fta?.trn || tenant?.business?.trn || '') :
    cur === 'OMR' ? (tenant?.ota?.tin || tenant?.business?.tin || '') :
    cur === 'BHD' ? (tenant?.bahrainNbr?.vatAccountNo || '') :
    cur === 'KWD' ? (tenant?.mofKuwait?.civilId || tenant?.mofKuwait?.taxCardNumber || '') :
    cur === 'QAR' ? (tenant?.gtaQatar?.tin || '') :
    cur === 'BDT' ? (tenant?.nbr?.binNumber || '') :
    cur === 'PKR' ? (tenant?.fbr?.ntn || '') : ''
  )

  const countryCrNumber = isPurchaseFlow ? '' : (
    cur === 'OMR' ? (tenant?.ota?.commercialRegistrationNumber || '') :
    cur === 'BHD' ? (tenant?.bahrainNbr?.crNumber || '') :
    cur === 'QAR' ? (tenant?.gtaQatar?.crNumber || '') : ''
  )

  const rawCompanyVat = isPurchaseFlow
    ? (tenant?.business?.vatNumber || '')
    : (invoice?.seller?.vatNumber || countryTaxId || tenant?.business?.vatNumber || '')
  const companyVat = isDummyVat(rawCompanyVat) ? '' : String(rawCompanyVat).trim()

  const rawCompanyCr = isPurchaseFlow
    ? (tenant?.business?.crNumber || '')
    : (invoice?.seller?.crNumber || countryCrNumber || tenant?.business?.crNumber || '')
  const companyCr = isDummyCr(rawCompanyCr) ? '' : String(rawCompanyCr).trim()

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
  const counterpartyVat = isDummyVat(counterpartyData?.vatNumber) ? '' : String(counterpartyData?.vatNumber).trim()
  const counterpartyCr = isDummyCr(counterpartyData?.crNumber) ? '' : String(counterpartyData?.crNumber).trim()
  const counterpartyNtn = counterpartyData?.ntn || counterpartyData?.taxId
  const counterpartyStrn = counterpartyData?.strn

  const companyNtn = tenant?.fbr?.ntn || tenant?.business?.ntn || invoice?.seller?.ntn || ''
  const companyStrn = tenant?.fbr?.strn || tenant?.business?.strn || invoice?.seller?.strn || ''

  const isPk = cur === 'PKR' || (tenant?.business?.address?.country || '').toUpperCase() === 'PK'
  const taxLabel = isPk ? 'GST' : 'VAT'
  const taxIdLabel = getTaxIdLabel(tenant, cur, false)
  const taxIdLabelAr = getTaxIdLabel(tenant, cur, true)

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
    taxIdLabel,
    taxIdLabelAr,
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


