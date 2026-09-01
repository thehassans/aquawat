import { QRCodeSVG } from 'qrcode.react'
import { generateZatcaQrValue } from '../../lib/zatcaQr'
import { generateFbrQrValue } from '../../lib/fbrQr'
import { generateNbrQrValue } from '../../lib/nbrQr'
import { generateGccQrValue } from '../../lib/gccQr'
import { calculateInvoiceSummary, normalizeTravelDetails, toNumber } from '../../lib/invoiceDocument'
import { getInvoiceBranding, getInvoiceCssFontFamily, getInvoiceCurrencyDisplay, splitBrandingText } from '../../lib/invoiceBranding'
import { getZatcaStatusMeta } from '../../lib/zatcaStatus'
import { getAmountInWords } from '../../lib/amountInWords'
import { formatCurrency, formatCurrencyAmount, isSarCurrency } from '../../lib/currency'
import { getTravelInvoiceLabelMeta, isTravelAgencyInvoice } from '../../lib/travelInvoiceStatus'
import { setActiveInvoiceSecondaryLanguage, localizeSecondaryText } from '../../lib/invoiceLanguage'
import { formatInvoiceDateDisplay, resolveInvoiceDateCalendar } from '../../lib/invoiceDateFormat'
import SarIcon from '../ui/SarIcon'
import ModernZatcaTemplate from './ModernZatcaTemplate'
import ClassicElegantTemplate from './ClassicElegantTemplate'
import ModernSplitTemplate from './ModernSplitTemplate'
import ModernTemplate from './ModernTemplate'
import MonoTemplate from './MonoTemplate'
import AirTemplate from './AirTemplate'
import LedgerTemplate from './LedgerTemplate'
import SignatureTemplate from './SignatureTemplate'
import LetterheadTemplate from './LetterheadTemplate'
import {
  resolveCommercialDocumentNumber,
  resolveInvoiceParties,
} from '../../lib/commercialDocumentLabels'
import { getTaxIdLabel, isGccTenant } from '../../lib/saudiTenant'

const joinClasses = (...classes) => classes.filter(Boolean).join(' ')

const renderSarMoney = ({ formatted, className = '', iconClassName = '', position = 'after' }) => {
  const icon = (
    <SarIcon
      key="icon"
      className={joinClasses(
        'inline-block h-[0.95em] w-[0.95em] shrink-0 overflow-visible',
        position === 'before' ? 'me-[0.18em]' : 'ms-[0.18em]',
        iconClassName,
      )}
      style={{ overflow: 'visible' }}
      title="Saudi Riyal"
    />
  )
  const amount = <span key="amount" className="leading-none">{formatted}</span>
  return (
    <span dir="ltr" className={joinClasses('inline-flex items-center whitespace-nowrap tabular-nums leading-none', className)}>
      {position === 'before' ? [icon, amount] : [amount, icon]}
    </span>
  )
}

const renderSarMoneySnapshotIcon = ({ formatted, className = '', position = 'after' }) => {
  const iconStyle = {
    display: 'inline-block',
    width: '0.95em',
    height: '0.95em',
    overflow: 'visible',
    flexShrink: 0,
    [position === 'before' ? 'marginInlineEnd' : 'marginInlineStart']: '0.18em',
  }
  const icon = <SarIcon key="icon" title="Saudi Riyal" style={iconStyle} />
  const amount = <span key="amount" style={{ lineHeight: 1 }}>{formatted}</span>
  return (
    <span
      dir="ltr"
      className={className}
      style={{ display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap', lineHeight: 1 }}
    >
      {position === 'before' ? [icon, amount] : [amount, icon]}
    </span>
  )
}

const renderSarText = ({ formatted, className = '', position = 'after' }) => {
  const label = <span key="label" className="leading-none">SAR</span>
  const amount = <span key="amount" className="leading-none">{formatted}</span>
  return (
    <span dir="ltr" className={joinClasses('inline-flex items-baseline gap-[0.28em] whitespace-nowrap tabular-nums leading-none', className)}>
      {position === 'before' ? [label, amount] : [amount, label]}
    </span>
  )
}

const hasArabicText = (value = '') => /[\u0600-\u06FF]/.test(String(value || ''))

const uniqueLines = (...values) => {
  const seen = new Set()
  const result = []

  for (const value of values) {
    const lines = String(value || '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)

    for (const line of lines) {
      const key = line.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      result.push(line)
    }
  }

  return result
}

const toBilingualText = (englishValue, arabicValue, fallback = '—') => {
  const lines = uniqueLines(englishValue, localizeSecondaryText(arabicValue))
  return lines.length > 0 ? lines.join('\n') : fallback
}

const getUntranslatedRouteText = (travelDetails = {}) => {
  const segments = Array.isArray(travelDetails?.segments) ? travelDetails.segments : []
  if (segments.length > 0) {
    return segments
      .map((segment) => {
        const from = String(segment?.from || segment?.fromAr || '').trim()
        const to = String(segment?.to || segment?.toAr || '').trim()
        if (from && to) return `${from} - ${to}`
        return from || to || '—'
      })
      .join(' | ')
  }

  const routeFrom = String(travelDetails?.routeFrom || travelDetails?.routeFromAr || '').trim()
  const routeTo = String(travelDetails?.routeTo || travelDetails?.routeToAr || '').trim()
  if (routeFrom && routeTo) return `${routeFrom} - ${routeTo}`
  return routeFrom || routeTo || '—'
}

const getRawDisplayValue = (value, fallback = '—') => {
  if (value === null || value === undefined) return fallback
  const text = String(value).trim()
  return text || fallback
}

const getCreatorDisplayName = (invoice, language = 'en') => {
  const createdByEn = [invoice?.createdBy?.firstName, invoice?.createdBy?.lastName].filter(Boolean).join(' ')
  const createdByAr = [invoice?.createdBy?.firstNameAr, invoice?.createdBy?.lastNameAr].filter(Boolean).join(' ')

  if (language === 'ar') {
    return invoice?.createdByNameAr || createdByAr || invoice?.createdByName || createdByEn || ''
  }

  return invoice?.createdByName || createdByEn || invoice?.createdByNameAr || createdByAr || ''
}

const formatAddress = (address = {}) => {
  return [address?.street, address?.district, address?.city, address?.postalCode, address?.country]
    .filter(Boolean)
    .join(', ')
}

const getPartyDetailLines = (party = {}, language = 'en', role = 'party', isPk = false) => {
  const lines = []
  const vatLabel = role === 'seller'
    ? (language === 'ar' ? 'الرقم الضريبي للشركة' : (isPk ? 'Company GST / STRN' : 'Company VAT'))
    : (language === 'ar' ? 'الرقم الضريبي' : (isPk ? 'GST / STRN' : 'VAT'))

  if (party?.ntn) {
    lines.push({ label: 'NTN', value: party.ntn })
  }

  if (party?.strn) {
    lines.push({ label: 'STRN', value: party.strn })
  }

  if (party?.cnic) {
    lines.push({ label: 'CNIC', value: party.cnic })
  }

  if (party?.vatNumber) {
    lines.push({ label: vatLabel, value: party.vatNumber })
  }

  if (party?.crNumber) {
    lines.push({ label: language === 'ar' ? 'السجل التجاري' : 'CR', value: party.crNumber })
  }

  if (party?.contactPhone) {
    lines.push({ label: language === 'ar' ? 'الهاتف' : 'Phone', value: party.contactPhone })
  }

  if (party?.contactEmail) {
    lines.push({ label: language === 'ar' ? 'البريد الإلكتروني' : 'Email', value: party.contactEmail })
  }

  const addressText = formatAddress(party?.address)
  if (addressText) {
    lines.push({ label: language === 'ar' ? 'العنوان' : 'Address', value: addressText })
  }

  return lines.length > 0 ? lines : [{ label: '', value: '—' }]
}

const getPartyDetailLinesBilingual = (party = {}, role = 'party', isPk = false) => {
  const lines = []

  if (party?.ntn) {
    lines.push({ label: 'NTN', value: party.ntn, dir: 'ltr' })
  }

  if (party?.strn) {
    lines.push({ label: 'STRN', value: party.strn, dir: 'ltr' })
  }

  if (party?.cnic) {
    lines.push({ label: 'CNIC', value: party.cnic, dir: 'ltr' })
  }

  if (party?.vatNumber) {
    lines.push({
      label: role === 'seller'
        ? toBilingualText(isPk ? 'Company GST' : 'Company VAT', 'الرقم الضريبي للشركة')
        : toBilingualText(isPk ? 'GST' : 'VAT', 'الرقم الضريبي'),
      value: party.vatNumber,
      dir: 'ltr',
    })
  }

  if (party?.crNumber) {
    lines.push({ label: toBilingualText('CR', 'السجل التجاري'), value: party.crNumber, dir: 'ltr' })
  }

  if (role !== 'seller' && party?.contactPhone) {
    lines.push({ label: toBilingualText('Phone', 'الهاتف'), value: party.contactPhone })
  }

  if (party?.contactEmail) {
    lines.push({ label: 'Email', value: party.contactEmail, dir: 'ltr' })
  }

  const addressText = formatAddress(party?.address)
  if (addressText) {
    lines.push({ label: toBilingualText('Address', 'العنوان'), value: addressText })
  }

  return lines.length > 0 ? lines : [{ label: '', value: '—' }]
}

const formatDate = (value, language = 'en', tenant, invoice) => {
  if (!value) return '—'
  return formatInvoiceDateDisplay(value, {
    mode: resolveInvoiceDateCalendar(tenant),
    language,
    hijriValue: invoice?.issueDateHijri,
    includeTime: true,
    timeZone: tenant?.settings?.timezone || 'Asia/Riyadh',
  })
}

const getTemplateClasses = (templateId) => {
  switch (Number(templateId)) {
    case 5:
      return {
        shell: 'bg-white border-slate-300 shadow-[0_20px_60px_-35px_rgba(15,23,42,0.35)]',
        badge: 'bg-slate-100 text-slate-800 border-slate-300',
        block: 'border border-slate-300 bg-white',
        tableHead: 'bg-slate-900 text-white',
      }
    case 6:
      return {
        shell: 'bg-white border-slate-300 shadow-[0_24px_70px_-36px_rgba(15,23,42,0.4)]',
        badge: 'bg-slate-100 text-slate-800 border-slate-300',
        block: 'border-2 border-slate-300 bg-white',
        tableHead: 'bg-slate-900 text-white',
      }
    case 7:
      return {
        shell: 'bg-white border-double border-[6px] border-amber-900 shadow-2xl rounded-sm',
        badge: 'bg-amber-50 text-amber-900 border-amber-200',
        block: 'border border-amber-900/20 bg-amber-50/30',
        tableHead: 'bg-amber-900 text-amber-50',
      }
    case 8:
      return {
        shell: 'bg-white shadow-[0_30px_80px_-20px_rgba(0,0,0,0.15)] rounded-none border-t-[16px] border-slate-900',
        badge: 'bg-slate-100 text-slate-800 border-transparent',
        block: 'bg-slate-50 border-transparent',
        tableHead: 'bg-slate-100 text-slate-900 border-b-2 border-slate-900',
      }
    default:
      return {
        shell: 'bg-white border-slate-200 shadow-[0_24px_70px_-38px_rgba(15,23,42,0.32)]',
        badge: 'bg-slate-50 text-slate-700 border-slate-200',
        block: 'border border-slate-200 bg-white',
        tableHead: 'bg-slate-900 text-white',
      }
  }
}

const getDocumentStatusMeta = (invoice, language = 'en', documentType = 'invoice') => {
  if (documentType === 'quotation') {
    const status = String(invoice?.status || 'draft').trim().toLowerCase()
    const labels = {
      draft: language === 'ar' ? 'مسودة' : 'Draft',
      sent: language === 'ar' ? 'مرسل' : 'Sent',
      accepted: language === 'ar' ? 'مقبول' : 'Accepted',
      rejected: language === 'ar' ? 'مرفوض' : 'Rejected',
      expired: language === 'ar' ? 'منتهي' : 'Expired',
      cancelled: language === 'ar' ? 'ملغي' : 'Cancelled',
    }
    return { label: labels[status] || (language === 'ar' ? 'مسودة' : 'Draft') }
  }

  if (documentType === 'purchase_order') {
    const status = String(invoice?.status || 'draft').trim().toLowerCase()
    const labels = {
      draft: language === 'ar' ? 'مسودة' : 'Draft',
      sent: language === 'ar' ? 'مرسل' : 'Sent',
      approved: language === 'ar' ? 'معتمد' : 'Approved',
      partially_received: language === 'ar' ? 'مستلم جزئياً' : 'Partially received',
      received: language === 'ar' ? 'مستلم' : 'Received',
      cancelled: language === 'ar' ? 'ملغي' : 'Cancelled',
    }
    return { label: labels[status] || (language === 'ar' ? 'مسودة' : 'Draft') }
  }

  if (documentType === 'sales_order') {
    const status = String(invoice?.status || 'draft').trim().toLowerCase()
    const labels = {
      draft: language === 'ar' ? 'مسودة' : 'Draft',
      sent: language === 'ar' ? 'مرسل' : 'Sent',
      approved: language === 'ar' ? 'مؤكد' : 'Confirmed',
      pending_approval: language === 'ar' ? 'بانتظار الموافقة' : 'Pending approval',
      partially_delivered: language === 'ar' ? 'مُسلّم جزئياً' : 'Partially delivered',
      delivered: language === 'ar' ? 'مُسلّم' : 'Delivered',
      cancelled: language === 'ar' ? 'ملغي' : 'Cancelled',
    }
    return { label: labels[status] || (language === 'ar' ? 'مسودة' : 'Draft') }
  }

  const cur = String(invoice?.currency || '').toUpperCase()
  if (cur && cur !== 'SAR') {
    const status = String(invoice?.status || 'draft').trim().toLowerCase()
    const labels = {
      draft: language === 'ar' ? 'مسودة' : 'Draft',
      issued: language === 'ar' ? 'صادرة' : 'Issued',
      paid: language === 'ar' ? 'مدفوعة' : 'Paid',
      partially_paid: language === 'ar' ? 'مدفوعة جزئياً' : 'Partially Paid',
      approved: language === 'ar' ? 'معتمدة' : 'Approved',
      overdue: language === 'ar' ? 'متأخرة' : 'Overdue',
      cancelled: language === 'ar' ? 'ملغاة' : 'Cancelled',
    }
    return { label: labels[status] || (language === 'ar' ? 'مسودة' : 'Draft') }
  }

  return getZatcaStatusMeta(invoice, language)
}

const getInvoiceEyebrow = (invoice, language = 'en', documentType = 'invoice') => {
  if (documentType === 'purchase_order') {
    return language === 'ar' ? 'طلب شراء' : 'Purchase Order'
  }
  if (documentType === 'vendor_bill') {
    return language === 'ar' ? 'فاتورة أمر الشراء' : 'Purchase Order Bill'
  }
  if (documentType === 'sales_order') {
    return language === 'ar' ? 'فاتورة أمر البيع' : 'Sales Order Bill'
  }
  if (documentType === 'quotation') {
    if (invoice?.businessContext === 'construction') {
      return language === 'ar' ? 'عرض سعر للمقاولات' : 'Construction Quotation'
    }
    if (invoice?.businessContext === 'travel_agency') {
      return language === 'ar' ? 'عرض سعر خدمات السفر' : 'Travel Services Quotation'
    }
    if (invoice?.businessContext === 'restaurant') {
      return language === 'ar' ? 'عرض سعر مطعم' : 'Restaurant Quotation'
    }
    return language === 'ar' ? 'عرض سعر' : 'Quotation'
  }

  if (invoice?.invoiceSubtype === 'travel_ticket' || invoice?.businessContext === 'travel_agency') {
    return language === 'ar' ? 'فاتورة خدمات السفر' : 'Travel Services Invoice'
  }

  if (invoice?.businessContext === 'construction') {
    return language === 'ar' ? 'فاتورة مقاولات' : 'Construction Invoice'
  }

  if (invoice?.businessContext === 'restaurant') {
    return language === 'ar' ? 'فاتورة مطعم' : 'Restaurant Invoice'
  }

  return language === 'ar' ? 'فاتورة تجارة' : 'Trading Invoice'
}

const getInvoiceTitle = (invoice, language = 'en', documentType = 'invoice') => {
  if (documentType === 'purchase_order') {
    return language === 'ar' ? 'طلب شراء' : 'Purchase Order'
  }
  if (documentType === 'vendor_bill') {
    return language === 'ar' ? 'فاتورة أمر الشراء' : 'Purchase Order Bill'
  }
  if (documentType === 'sales_order') {
    return language === 'ar' ? 'فاتورة أمر البيع' : 'Sales Order Bill'
  }
  if (documentType === 'quotation') {
    if (invoice?.businessContext === 'construction') {
      return language === 'ar' ? 'عرض سعر للمقاولات' : 'Construction Quotation'
    }
    if (invoice?.businessContext === 'travel_agency') {
      return language === 'ar' ? 'عرض سعر لخدمات السفر' : 'Travel Services Quotation'
    }
    if (invoice?.businessContext === 'restaurant') {
      return language === 'ar' ? 'عرض سعر للمطعم' : 'Restaurant Quotation'
    }
    return language === 'ar' ? 'عرض سعر' : 'Quotation'
  }

  if (invoice?.invoiceSubtype === 'travel_ticket' || invoice?.businessContext === 'travel_agency') {
    return language === 'ar' ? 'فاتورة ضريبية لخدمات السفر' : 'Travel Services Tax Invoice'
  }

  if (invoice?.businessContext === 'construction') {
    return language === 'ar' ? 'فاتورة ضريبية للمقاولات' : 'Construction Tax Invoice'
  }

  if (invoice?.businessContext === 'trading') {
    return language === 'ar' ? 'فاتورة ضريبية للتجارة' : 'Trading Tax Invoice'
  }

  return language === 'ar' ? 'فاتورة ضريبية' : 'Tax Invoice'
}

export default function InvoiceLivePreview({ invoice, tenant, language = 'en', templateId = 1, bilingual = false, secondaryLanguage, currencyRenderMode = 'icon', currencyDisplay, currencyPosition, documentType = 'invoice' }) {
  const resolvedSecondaryLanguage = ['ur', 'bn', 'ar'].includes(secondaryLanguage) ? secondaryLanguage : null
  setActiveInvoiceSecondaryLanguage(resolvedSecondaryLanguage)
  const secondaryDir = resolvedSecondaryLanguage === 'bn' ? 'ltr' : 'rtl'
  const currency = invoice?.currency || tenant?.settings?.currency || 'SAR'
  const invoiceBranding = getInvoiceBranding(tenant, language, invoice?.businessContext)
  const resolvedCurrency = getInvoiceCurrencyDisplay(tenant)
  const effectiveCurrencyDisplay = currencyDisplay || resolvedCurrency.display
  const effectiveCurrencyPosition = currencyPosition || resolvedCurrency.position
  const styles = getTemplateClasses(Number(templateId || invoiceBranding.templateId || 1))
  const parties = resolveInvoiceParties({ invoice, tenant, invoiceBranding, language, bilingual, documentType })
  const { headerCompanyName, companyNameEn, companyNameAr, companyVat, companyCr, counterpartyName, counterpartyNameEn, counterpartyNameAr, counterpartyData, counterpartyVat, counterpartyCr, counterpartyLabelEn, counterpartyLabelAr, isPurchaseFlow } = parties

  const sellerName = headerCompanyName
  const buyerName = counterpartyName
  const customerLabel = bilingual
    ? (documentType === 'purchase_order' || isPurchaseFlow
      ? toBilingualText('Supplier', 'المورد')
      : toBilingualText('Customer', 'العميل'))
    : (documentType === 'purchase_order' || isPurchaseFlow
      ? (language === 'ar' ? 'المورد' : 'Supplier')
      : (language === 'ar' ? 'العميل' : 'Customer'))
  const logoSrc = invoiceBranding.logoSrc
  const vatNumber = companyVat || tenant?.business?.vatNumber
  const cur = String(currency || 'SAR').toUpperCase()
  const isZatcaApplicable = cur === 'SAR'
  const isFbrApplicable = cur === 'PKR'
  const isNbrApplicable = cur === 'BDT'
  const qrValue = (() => {
    try {
      if (cur === 'SAR') {
        return invoice?.zatca?.qrCodeData || generateZatcaQrValue({
          sellerName: companyNameEn || companyNameAr,
          vatNumber,
          timestamp: invoice?.issueDate || new Date().toISOString(),
          totalWithVat: toNumber(invoice?.grandTotal),
          vatTotal: toNumber(invoice?.totalTax),
        })
      }
      if (cur === 'AED') {
        return invoice?.countryCompliance?.qrCode || generateGccQrValue({
          authority: 'FTA',
          countryCode: 'AE',
          sellerName: companyNameEn || companyNameAr,
          taxId: tenant?.fta?.trn || vatNumber,
          invoiceNumber: invoice?.invoiceNumber,
          timestamp: invoice?.issueDate || new Date().toISOString(),
          grandTotal: toNumber(invoice?.grandTotal),
          totalTax: toNumber(invoice?.totalTax),
          currency: 'AED',
        })
      }
      if (cur === 'OMR') {
        return invoice?.countryCompliance?.qrCode || generateGccQrValue({
          authority: 'OTA',
          countryCode: 'OM',
          sellerName: companyNameEn || companyNameAr,
          taxId: tenant?.ota?.tin || vatNumber,
          invoiceNumber: invoice?.invoiceNumber,
          timestamp: invoice?.issueDate || new Date().toISOString(),
          grandTotal: toNumber(invoice?.grandTotal),
          totalTax: toNumber(invoice?.totalTax),
          currency: 'OMR',
        })
      }
      if (cur === 'BHD') {
        return invoice?.countryCompliance?.qrCode || generateGccQrValue({
          authority: 'NBR',
          countryCode: 'BH',
          sellerName: companyNameEn || companyNameAr,
          taxId: tenant?.bahrainNbr?.vatAccountNumber || vatNumber,
          invoiceNumber: invoice?.invoiceNumber,
          timestamp: invoice?.issueDate || new Date().toISOString(),
          grandTotal: toNumber(invoice?.grandTotal),
          totalTax: toNumber(invoice?.totalTax),
          currency: 'BHD',
        })
      }
      if (cur === 'KWD') {
        return invoice?.countryCompliance?.qrCode || generateGccQrValue({
          authority: 'MOF',
          countryCode: 'KW',
          sellerName: companyNameEn || companyNameAr,
          taxId: tenant?.mofKuwait?.civilId || tenant?.mofKuwait?.taxCardNumber || vatNumber,
          invoiceNumber: invoice?.invoiceNumber,
          timestamp: invoice?.issueDate || new Date().toISOString(),
          grandTotal: toNumber(invoice?.grandTotal),
          totalTax: toNumber(invoice?.totalTax),
          currency: 'KWD',
        })
      }
      if (cur === 'QAR') {
        return invoice?.countryCompliance?.qrCode || generateGccQrValue({
          authority: 'GTA',
          countryCode: 'QA',
          sellerName: companyNameEn || companyNameAr,
          taxId: tenant?.gtaQatar?.tin || vatNumber,
          invoiceNumber: invoice?.invoiceNumber,
          timestamp: invoice?.issueDate || new Date().toISOString(),
          grandTotal: toNumber(invoice?.grandTotal),
          totalTax: toNumber(invoice?.totalTax),
          currency: 'QAR',
        })
      }
      if (cur === 'PKR' && tenant?.fbr?.autoGenerateQr !== false) {
        return invoice?.fbr?.qrCode || generateFbrQrValue({
          sellerName: companyNameEn || companyNameAr,
          ntn: tenant?.fbr?.ntn || vatNumber,
          strn: tenant?.fbr?.strn || '',
          invoiceNumber: invoice?.invoiceNumber,
          fbrInvoiceNo: invoice?.fbr?.fbrInvoiceNo,
          timestamp: invoice?.issueDate || new Date().toISOString(),
          totalWithTax: toNumber(invoice?.grandTotal),
          salesTax: toNumber(invoice?.totalTax),
        })
      }
      if (cur === 'BDT' && tenant?.nbr?.autoGenerateQr !== false) {
        return generateNbrQrValue({
          sellerName: companyNameEn || companyNameAr,
          binNumber: tenant?.nbr?.binNumber || vatNumber,
          invoiceNumber: invoice?.invoiceNumber,
          timestamp: invoice?.issueDate || new Date().toISOString(),
          totalWithVat: toNumber(invoice?.grandTotal),
          vatTotal: toNumber(invoice?.totalTax),
          mushakForm: tenant?.nbr?.mushakForm,
        })
      }
      return null
    } catch {
      return null
    }
  })()
  const totals = calculateInvoiceSummary(invoice)
  const travelDetails = normalizeTravelDetails(invoice?.travelDetails || {}, counterpartyNameEn || counterpartyNameAr, language)
  const travelDetailsEn = normalizeTravelDetails(invoice?.travelDetails || {}, counterpartyNameEn || counterpartyNameAr, 'en')
  const travelDetailsAr = normalizeTravelDetails(invoice?.travelDetails || {}, counterpartyNameAr || counterpartyNameEn, 'ar')
  const lineItems = totals.lines.length > 0 ? totals.lines : [{ raw: { productName: language === 'ar' ? 'خدمة' : 'Service' }, quantity: 1, unitPrice: 0, taxAmount: 0, lineTotalWithTax: 0 }]
  const isPk = isFbrApplicable || (tenant?.business?.address?.country || '').toUpperCase() === 'PK'
  const sellerDetails = bilingual
    ? getPartyDetailLinesBilingual(isPurchaseFlow ? (tenant?.business || {}) : (invoice?.seller || tenant?.business || {}), 'seller', isPk)
    : getPartyDetailLines(isPurchaseFlow ? (tenant?.business || {}) : (invoice?.seller || tenant?.business || {}), language, 'seller', isPk)
  const buyerDetails = bilingual
    ? getPartyDetailLinesBilingual(counterpartyData || {}, isPurchaseFlow ? 'supplier' : 'buyer', isPk)
    : getPartyDetailLines(counterpartyData || {}, language, isPurchaseFlow ? 'supplier' : 'buyer', isPk)
  const companyName = invoiceBranding.companyName || companyNameEn || companyNameAr || '—'
  const headerLines = splitBrandingText(invoiceBranding.headerText)
  const footerLines = splitBrandingText(invoiceBranding.footerText)
  const showVisionLogo = invoiceBranding.showVision2030 && invoiceBranding.vision2030LogoSrc
  const typography = invoiceBranding.typography || {}
  const zatcaStatusMeta = getDocumentStatusMeta(invoice, language, documentType)
  const isTravelInvoice = isTravelAgencyInvoice(invoice)
  const travelInvoiceLabelMeta = isTravelInvoice ? getTravelInvoiceLabelMeta(invoice, language) : null
  const isQuotation = documentType === 'quotation'
  const isPurchaseOrder = documentType === 'purchase_order'
  const isSalesOrder = documentType === 'sales_order'
  const documentNumber = resolveCommercialDocumentNumber(invoice, documentType)
  const amountInWordsLines = bilingual
    ? uniqueLines(
        getAmountInWords(totals.grandTotal, currency, 'en'),
        (resolvedSecondaryLanguage && resolvedSecondaryLanguage !== 'bn')
          ? getAmountInWords(totals.grandTotal, currency, resolvedSecondaryLanguage)
          : '',
      )
    : [getAmountInWords(totals.grandTotal, currency, language)]
  const hideTaxOnInvoice = isTravelInvoice && toNumber(totals.totalTax) <= 0
  const showInvoiceTitle = isQuotation || isPurchaseOrder || isSalesOrder || !(invoice?.invoiceSubtype === 'travel_ticket' || invoice?.businessContext === 'travel_agency')
  const invoiceTitle = bilingual
    ? toBilingualText(getInvoiceTitle(invoice, 'en', documentType), getInvoiceTitle(invoice, 'ar', documentType))
    : getInvoiceTitle(invoice, language, documentType)
  const createdByName = getCreatorDisplayName(invoice, language)
  const rawRouteText = getUntranslatedRouteText(invoice?.travelDetails || {})
  const rawDepartureDate = getRawDisplayValue(invoice?.travelDetails?.departureDate)
  const renderStackedLabel = (english, arabic, uppercaseEnglish = false) => {
    if (!bilingual) return language === 'ar' ? arabic : english

    return (
      <span className="flex flex-col gap-1 leading-tight">
        <span className={uppercaseEnglish ? 'uppercase tracking-[0.2em]' : ''}>{english}</span>
        <span dir={secondaryDir} className="tracking-normal normal-case">{localizeSecondaryText(arabic)}</span>
      </span>
    )
  }
  const travelRows = invoice?.invoiceSubtype === 'travel_ticket'
    ? [
        {
          key: 'lead-traveler',
          label: bilingual ? toBilingualText('Lead Traveler', 'اسم المسافر الرئيسي') : (language === 'ar' ? 'اسم المسافر الرئيسي' : 'Lead Traveler'),
          value: bilingual ? toBilingualText(travelDetailsEn?.travelerDisplayName, travelDetailsAr?.travelerDisplayName) : (travelDetails?.travelerDisplayName || '—'),
        },
        {
          key: 'passport',
          label: bilingual ? toBilingualText('Passport', 'رقم الجواز') : (language === 'ar' ? 'رقم الجواز' : 'Passport Number'),
          value: travelDetails?.passportNumber || '—',
        },
        {
          key: 'ticket-reference',
          label: bilingual ? toBilingualText('Ticket Reference', 'مرجع التذكرة') : (language === 'ar' ? 'مرجع التذكرة' : 'Ticket Reference'),
          value: travelDetails?.ticketNumber || '—',
        },
        {
          key: 'pnr',
          label: bilingual ? toBilingualText('PNR', 'رمز الحجز') : 'PNR',
          value: travelDetails?.pnr || '—',
        },
        {
          key: 'travel-route',
          label: bilingual ? toBilingualText('Travel Route', 'مسار الرحلة') : (language === 'ar' ? 'مسار الرحلة' : 'Travel Route'),
          value: rawRouteText,
          dir: hasArabicText(rawRouteText) ? 'rtl' : 'ltr',
        },
        {
          key: 'carrier',
          label: bilingual ? toBilingualText('Carrier / Service Provider', 'الناقل / مزود الخدمة') : (language === 'ar' ? 'الناقل / مزود الخدمة' : 'Carrier / Service Provider'),
          value: getRawDisplayValue(invoice?.travelDetails?.airlineName || travelDetailsEn?.airlineDisplayName || invoice?.seller?.name),
          dir: 'ltr',
        },
        {
          key: 'departure-date',
          label: bilingual ? toBilingualText('Departure Date', 'تاريخ المغادرة') : (language === 'ar' ? 'تاريخ المغادرة' : 'Departure Date'),
          value: rawDepartureDate,
          dir: 'ltr',
        },
        travelDetails?.hasReturnDate || (bilingual && travelDetailsEn?.hasReturnDate)
          ? {
              key: 'return-date',
              label: bilingual ? toBilingualText('Return Date', 'تاريخ العودة') : (language === 'ar' ? 'تاريخ العودة' : 'Return Date'),
              value: bilingual ? toBilingualText(formatDate(travelDetailsEn?.returnDate, 'en'), formatDate(travelDetailsAr?.returnDate, 'ar')) : formatDate(travelDetails?.returnDate, language),
            }
          : null,
        {
          key: 'layover-stay',
          label: bilingual ? toBilingualText('Layover / Stay', 'التوقف / الإقامة') : (language === 'ar' ? 'التوقف / الإقامة' : 'Layover / Stay'),
          value: bilingual ? toBilingualText(travelDetailsEn?.layoverStayDisplay, travelDetailsAr?.layoverStayDisplay) : (travelDetails?.layoverStayDisplay || '—'),
        },
        {
          key: 'additional-passengers',
          label: bilingual ? toBilingualText('Additional Passengers', 'مسافرون إضافيون') : (language === 'ar' ? 'مسافرون إضافيون' : 'Additional Passengers'),
          value: bilingual
            ? toBilingualText(travelDetailsEn?.additionalPassengersText === '—' ? '' : travelDetailsEn?.additionalPassengersText, travelDetailsAr?.additionalPassengersText === '—' ? '' : travelDetailsAr?.additionalPassengersText)
            : (travelDetails?.additionalPassengersText || '—'),
          spanFull: true,
        },
      ].filter(Boolean)
    : []
  const tableHeadStyle = {}
  const accentBarStyle = {
    background: invoiceBranding.primaryColor,
    opacity: Number(templateId) === 8 ? 1 : 0.9,
  }

  let rowClassName = ''

  if (Number(templateId) === 2) {
    accentBarStyle.height = '16px'
  } else if (Number(templateId) === 3) {
    accentBarStyle.height = '8px'
  } else if (Number(templateId) === 4) {
    accentBarStyle.height = '8px'
    tableHeadStyle.backgroundColor = invoiceBranding.primaryColor
    tableHeadStyle.color = '#ffffff'
  } else if (Number(templateId) === 5) {
    accentBarStyle.display = 'none'
    tableHeadStyle.backgroundColor = invoiceBranding.primaryColor
    tableHeadStyle.color = '#ffffff'
    rowClassName = 'even:bg-slate-50'
  } else if (Number(templateId) === 6) {
    accentBarStyle.height = '12px'
    tableHeadStyle.backgroundColor = invoiceBranding.primaryColor
    tableHeadStyle.color = '#ffffff'
  } else if (Number(templateId) !== 8) {
    accentBarStyle.display = 'none'
  }

  const metaCardStyle = {
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
  }
  const mutedText = 'text-slate-500'
  const titleText = 'font-semibold'
  const bilingualFontFamily = resolvedSecondaryLanguage === 'ur'
    ? '"Noto Nastaliq Urdu", "InvoiceAlmarai", "Almarai", Arial, Helvetica, sans-serif'
    : resolvedSecondaryLanguage === 'bn'
      ? '"Noto Sans Bengali", "Noto Sans", Arial, Helvetica, sans-serif'
      : '"InvoiceAlmarai", "Almarai", Arial, Helvetica, sans-serif'
  const shellStyle = {
    fontFamily: bilingual ? bilingualFontFamily : getInvoiceCssFontFamily(typography.bodyFontFamily),
    fontSize: `${typography.bodyFontSize || 12}px`,
    color: invoiceBranding.primaryColor || '#0F172A',
  }
  const headingStyle = {
    fontFamily: bilingual ? bilingualFontFamily : getInvoiceCssFontFamily(typography.headingFontFamily),
    color: invoiceBranding.primaryColor || '#0F172A',
  }
  const companyHeadingStyle = {
    ...headingStyle,
    fontSize: `${Math.max(
      Number(invoiceBranding.headingSize) || Number(typography.headingFontSize) || 18,
      12,
    )}px`,
  }
  const invoiceTitleStyle = {
    ...headingStyle,
    fontSize: `${Math.max(
      Math.round((Number(invoiceBranding.headingSize) || Number(typography.headingFontSize) || 18) * 0.9),
      14,
    )}px`,
  }
  const renderMoney = (value, options = {}) => {
    const isSar = isSarCurrency(currency)
    const formatted = formatCurrencyAmount(value, {
      language,
      currency,
      currencyDisplay: 'code',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })

    if (!isSar) {
      return formatCurrency(value, {
        language,
        currency,
        currencyDisplay: 'code',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    }

    // Tenant preference: render SAR as plain text (before/after the amount).
    if (effectiveCurrencyDisplay === 'text') {
      return renderSarText({
        formatted,
        className: options.className || '',
        position: effectiveCurrencyPosition,
      })
    }

    // Icon mode — use the snapshot-safe renderer for html2canvas output paths.
    if (currencyRenderMode === 'snapshot-icon') {
      return renderSarMoneySnapshotIcon({
        formatted,
        className: options.className || '',
        position: effectiveCurrencyPosition,
      })
    }

    return renderSarMoney({
      formatted,
      className: options.className || '',
      position: effectiveCurrencyPosition,
    })
  }

  if (Number(templateId) === 9) {
    return <LetterheadTemplate invoice={invoice} tenant={tenant} language={language} bilingual={bilingual} documentType={documentType} />
  }

  if (Number(templateId) === 7) {
    return <ClassicElegantTemplate invoice={invoice} tenant={tenant} language={language} bilingual={bilingual} documentType={documentType} />
  }

  if (Number(templateId) === 8) {
    return <ModernSplitTemplate invoice={invoice} tenant={tenant} language={language} bilingual={bilingual} documentType={documentType} />
  }

  if (!isTravelInvoice) {
    switch (Number(templateId)) {
      case 1:
        return <ModernZatcaTemplate invoice={invoice} tenant={tenant} language={language} bilingual={bilingual} secondaryLanguage={resolvedSecondaryLanguage} documentType={documentType} />
      case 2:
        return <ModernTemplate invoice={invoice} tenant={tenant} language={language} bilingual={bilingual} documentType={documentType} />
      case 3:
        return <MonoTemplate invoice={invoice} tenant={tenant} language={language} bilingual={bilingual} documentType={documentType} />
      case 4:
        return <AirTemplate invoice={invoice} tenant={tenant} language={language} bilingual={bilingual} documentType={documentType} />
      case 5:
        return <LedgerTemplate invoice={invoice} tenant={tenant} language={language} bilingual={bilingual} documentType={documentType} />
      case 6:
        return <SignatureTemplate invoice={invoice} tenant={tenant} language={language} bilingual={bilingual} documentType={documentType} />
    }
  }

  return (
    <div className={`relative overflow-hidden rounded-[2rem] border shadow-[0_30px_80px_-40px_rgba(15,23,42,0.30)] ${styles.shell}`} style={shellStyle}>
      <div className="absolute inset-x-0 top-0 h-1.5 print:hidden" style={accentBarStyle} data-html2canvas-ignore="true" />
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
        {logoSrc ? <img src={logoSrc} alt="" className="h-[32rem] w-[32rem] object-contain opacity-[0.15]" /> : null}
      </div>
      <div className="relative px-6 pb-6 pt-7">
        <div className="border-b border-slate-200 pb-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex min-w-0 flex-1 items-start gap-4">
              <div className="flex h-32 max-w-[18rem] shrink-0 items-center justify-center overflow-hidden bg-transparent">
                <img src={logoSrc} alt="" className="max-h-full max-w-full object-contain" />
              </div>
              <div className="min-w-0 max-w-[34rem] flex-1">
                <p className={joinClasses('text-[11px] uppercase tracking-[0.24em]', isQuotation ? mutedText : (isTravelInvoice ? travelInvoiceLabelMeta?.textClassName : mutedText))}>{getInvoiceEyebrow(invoice, language, documentType)}</p>
                <h3 className={`mt-2 text-[1.75rem] font-semibold leading-tight ${titleText}`} style={companyHeadingStyle}>{companyName || '—'}</h3>
                {headerLines.length > 0 && (
                  <div className="mt-2 max-w-[30rem] space-y-1 overflow-hidden">
                    {headerLines.slice(0, 2).map((line, index) => (
                      <p key={`${line}-${index}`} className={`text-sm leading-5 ${mutedText}`}>{line}</p>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="flex min-w-[148px] flex-col items-center gap-3 self-start text-center">
              {!isTravelInvoice && !isQuotation && !isPurchaseOrder && !isSalesOrder && (isZatcaApplicable || isFbrApplicable || isNbrApplicable || isGccTenant(tenant)) && (
                <div className="rounded-[1.5rem] border border-slate-200 bg-white p-2 shadow-sm">
                  {qrValue ? (
                    <QRCodeSVG value={qrValue} size={88} bgColor="transparent" fgColor="#0F172A" />
                  ) : (
                    /* VAT number not set or invalid — show placeholder instead of crashing */
                    <div
                      title={language === 'ar' ? 'أضف الرقم الضريبي في الإعدادات لإظهار رمز QR' : 'Add VAT number in Settings to show QR code'}
                      style={{ width: 88, height: 88, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '1.5px dashed #CBD5E1', borderRadius: 8, background: '#F8FAFC', gap: 4 }}
                    >
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                      </svg>
                      <span style={{ fontSize: 8, color: '#94A3B8', textAlign: 'center', lineHeight: '1.2', padding: '0 4px' }}>
                        {language === 'ar' ? 'الرقم الضريبي مطلوب' : 'VAT required'}
                      </span>
                    </div>
                  )}
                </div>
              )}
              <div className="w-full max-w-[132px] space-y-1 text-[11px] leading-4 text-slate-600 text-center">
                {isPk ? (
                  <>
                    {(invoice?.seller?.ntn || tenant?.fbr?.ntn || tenant?.business?.ntn) && (
                      <p><span className="font-medium text-slate-900">NTN:</span> {invoice?.seller?.ntn || tenant?.fbr?.ntn || tenant?.business?.ntn}</p>
                    )}
                    {(invoice?.seller?.strn || tenant?.fbr?.strn || tenant?.business?.strn) && (
                      <p><span className="font-medium text-slate-900">STRN:</span> {invoice?.seller?.strn || tenant?.fbr?.strn || tenant?.business?.strn}</p>
                    )}
                  </>
                ) : (
                  <>
                    {companyVat ? (
                      <p><span className="font-medium text-slate-900">{getTaxIdLabel(tenant, cur, language === 'ar')}:</span> {companyVat}</p>
                    ) : null}
                    {companyCr ? (
                      <p><span className="font-medium text-slate-900">{language === 'ar' ? 'السجل التجاري' : 'CR'}:</span> {companyCr}</p>
                    ) : null}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 pt-6 lg:grid-cols-[minmax(0,1fr)_188px]">
          <div className="space-y-4">
            <div className="text-center lg:text-start">
              {showInvoiceTitle ? <h2 className={`mt-2 text-3xl font-semibold whitespace-pre-line ${titleText}`} style={invoiceTitleStyle}>{invoiceTitle}</h2> : null}
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className={`rounded-[1.5rem] p-5 ${styles.block}`} style={metaCardStyle}>
                <p className={`text-xs font-semibold ${mutedText}`}>{isPurchaseFlow ? renderStackedLabel('Company', 'الشركة', true) : renderStackedLabel('Seller', 'البائع', true)}</p>
                <p className={`mt-3 text-[1.05rem] font-bold leading-7 ${titleText} whitespace-pre-line`}>{sellerName || '—'}</p>
                <div className="mt-3 space-y-2">
                  {sellerDetails.map((detail, index) => (
                    <div key={`${detail.label}-${index}`} className="text-sm font-semibold leading-6 text-slate-800 break-words whitespace-pre-line">
                      {detail.label ? <p className="font-bold text-slate-900 whitespace-pre-line">{detail.label}</p> : null}
                      <p dir={detail.dir || undefined} className={detail.dir ? 'block whitespace-pre-line' : 'whitespace-pre-line'}>{detail.value}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className={`rounded-[1.5rem] p-5 ${styles.block}`} style={metaCardStyle}>
                <p className={`text-xs font-semibold ${mutedText}`}>{isPurchaseFlow ? renderStackedLabel('Supplier', 'المورد', true) : renderStackedLabel('Customer', 'العميل', true)}</p>
                <p className={`mt-3 text-[1.05rem] font-bold leading-7 ${titleText} whitespace-pre-line`}>{buyerName || '—'}</p>
                <div className="mt-3 space-y-2">
                  {buyerDetails.map((detail, index) => (
                    <div key={`${detail.label}-${index}`} className="text-sm font-semibold leading-6 text-slate-800 break-words whitespace-pre-line">
                      {detail.label ? <p className="font-bold text-slate-900 whitespace-pre-line">{detail.label}</p> : null}
                      <p dir={detail.dir || undefined} className={detail.dir ? 'block whitespace-pre-line' : 'whitespace-pre-line'}>{detail.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className={`flex flex-col items-center justify-center rounded-[1.75rem] p-5 ${styles.block}`}>
            <div className="flex w-full justify-center">
              <div className={`inline-flex items-center justify-center rounded-full border px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-center ${styles.badge}`}>
                {invoice?.transactionType || 'B2C'}
              </div>
            </div>
            <p className={`mt-4 text-center text-base font-semibold ${titleText}`}>{documentNumber}</p>
            <p className={`mt-1 text-center text-xs ${mutedText}`}>{formatDate(invoice?.issueDate || new Date(), language, tenant, invoice)}</p>
            <div className="mt-4 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-center">
              <p className={`text-[11px] font-medium uppercase tracking-[0.2em] ${mutedText}`}>{language === 'ar' ? 'الحالة' : 'Status'}</p>
              <p className={`mt-2 text-sm font-semibold ${titleText}`} style={headingStyle}>{zatcaStatusMeta.label}</p>
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 rounded-[1.5rem] border border-slate-200 bg-white p-5 md:grid-cols-2 xl:grid-cols-4">
          <div>
            <p className={`text-xs ${mutedText}`}>{isPurchaseOrder ? (language === 'ar' ? 'رقم طلب الشراء' : 'PO #') : isSalesOrder ? (language === 'ar' ? 'رقم أمر البيع' : 'SO #') : isQuotation ? (language === 'ar' ? 'رقم عرض السعر' : 'Quotation #') : (language === 'ar' ? 'رقم الفاتورة' : 'Invoice #')}</p>
            <p className={`mt-1 text-sm font-semibold ${titleText}`}>{documentNumber}</p>
          </div>
          <div>
            <p className={`text-xs ${mutedText}`}>{isQuotation ? (language === 'ar' ? 'صالح حتى' : 'Valid Until') : (language === 'ar' ? 'التاريخ' : 'Date')}</p>
            <p className={`mt-1 text-sm font-semibold ${titleText}`}>{formatDate((isQuotation ? invoice?.validUntil : invoice?.issueDate) || new Date(), language, tenant, isQuotation ? null : invoice)}</p>
          </div>
          <div>
            <p className={`text-xs ${mutedText}`}>{isPurchaseOrder || isQuotation || isSalesOrder ? (language === 'ar' ? 'نوع المستند' : 'Document Type') : (language === 'ar' ? 'التدفق' : 'Flow')}</p>
            <p className={`mt-1 text-sm font-semibold ${titleText}`}>{isPurchaseOrder ? (language === 'ar' ? 'طلب شراء' : 'Purchase Order') : isSalesOrder ? (language === 'ar' ? 'فاتورة أمر البيع' : 'Sales Order Bill') : isQuotation ? (language === 'ar' ? 'عرض سعر' : 'Quotation') : (invoice?.flow || 'sell')}</p>
          </div>
          <div>
            <p className={`text-xs ${mutedText}`}>{language === 'ar' ? 'تم الإنشاء بواسطة' : 'Created By'}</p>
            <p className={`mt-1 text-sm font-semibold ${titleText}`}>{createdByName || '—'}</p>
          </div>
        </div>
      </div>

      {invoice?.invoiceSubtype === 'travel_ticket' && (
        <div className="px-6 pt-6">
          <div className={`grid grid-cols-1 gap-4 rounded-2xl p-4 md:grid-cols-3 ${styles.block}`}>
            {travelRows.map((row, index) => (
              <div key={row.key || `${index}`} className={row.spanFull ? 'md:col-span-3' : ''}>
                <p className={`text-xs ${mutedText} whitespace-pre-line`}>{row.label}</p>
                <p dir={row.dir || undefined} className={`mt-1 text-sm font-semibold ${titleText} whitespace-pre-line`}>{row.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="px-6 py-6">
        <div className="overflow-hidden rounded-2xl border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className={styles.tableHead} style={tableHeadStyle}>
              <tr>
                <th className="px-4 py-3 text-start font-medium">#</th>
                <th className="px-4 py-3 text-start font-medium whitespace-pre-line">{bilingual ? toBilingualText('Description', 'الوصف') : (language === 'ar' ? 'الوصف' : 'Description')}</th>
                {!isTravelInvoice && <th className="px-4 py-3 text-center font-medium whitespace-pre-line">{bilingual ? toBilingualText('Qty', 'الكمية') : (language === 'ar' ? 'الكمية' : 'Qty')}</th>}
                <th className="px-4 py-3 text-end font-medium whitespace-pre-line">{bilingual ? toBilingualText('Unit Price', 'سعر الوحدة') : (language === 'ar' ? 'السعر' : 'Price')}</th>
                {!hideTaxOnInvoice && <th className="px-4 py-3 text-end font-medium whitespace-pre-line">{bilingual ? toBilingualText('Tax', 'الضريبة') : (language === 'ar' ? 'الضريبة' : 'Tax')}</th>}
                <th className="px-4 py-3 text-end font-medium whitespace-pre-line">{bilingual ? toBilingualText('Total', 'الإجمالي') : (language === 'ar' ? 'الإجمالي' : 'Total')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-700">
              {lineItems.map((line, index) => {
                const quantity = toNumber(line?.quantity)
                const customerPriceRaw = toNumber(line?.customerPrice ?? line?.raw?.customerPrice)
                const unitPriceDisplayed = isTravelInvoice && customerPriceRaw > 0
                  ? customerPriceRaw
                  : toNumber(line?.unitPrice)
                const tax = toNumber(line?.taxAmount)
                const total = toNumber(line?.lineTotalWithTax)
                const productNameEn = line?.raw?.productName || line?.productName || line?.raw?.productNameAr || line?.productNameAr || '—'
                const productNameAr = line?.raw?.productNameAr || line?.productNameAr || (hasArabicText(productNameEn) ? productNameEn : '')
                const descriptionEn = line?.raw?.description || line?.description || line?.raw?.descriptionAr || line?.descriptionAr || ''
                const descriptionAr = line?.raw?.descriptionAr || line?.descriptionAr || (hasArabicText(descriptionEn) ? descriptionEn : '')
                return (
                  <tr key={`${line?.raw?.productName || line?.productName || 'line'}-${index}`} className={rowClassName}>
                    <td className="px-4 py-3">{index + 1}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium whitespace-pre-line">{bilingual ? toBilingualText(productNameEn, productNameAr) : (language === 'ar' ? (line?.raw?.productNameAr || line?.raw?.productName || line?.productNameAr || line?.productName || '—') : (line?.raw?.productName || line?.raw?.productNameAr || line?.productName || line?.productNameAr || '—'))}</div>
                      {(line?.raw?.description || line?.raw?.descriptionAr || line?.description || line?.descriptionAr) && <div className={`mt-1 text-xs font-semibold text-slate-600 whitespace-pre-line`}>{bilingual ? toBilingualText(descriptionEn, descriptionAr) : (language === 'ar' ? (line?.raw?.descriptionAr || line?.raw?.description || line?.descriptionAr || line?.description) : (line?.raw?.description || line?.raw?.descriptionAr || line?.description || line?.descriptionAr))}</div>}
                    </td>
                    {!isTravelInvoice && (
                      <td className="px-4 py-3 text-center">
                        <div className="font-medium text-slate-800">{quantity || '—'}</div>
                        {(line?.unitCode || line?.raw?.unitCode) && (
                          <div className="text-[10px] text-slate-500 font-semibold">{line?.unitCode || line?.raw?.unitCode}</div>
                        )}
                      </td>
                    )}
                    <td className="px-4 py-3 text-end">{renderMoney(unitPriceDisplayed)}</td>
                    {!hideTaxOnInvoice && <td className="px-4 py-3 text-end">{renderMoney(tax)}</td>}
                    <td className="px-4 py-3 text-end font-semibold">{renderMoney(total)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
          <div className={`rounded-2xl p-4 ${styles.block}`}>
            <p className={`text-xs font-semibold ${mutedText}`}>{renderStackedLabel('Amount in Words', 'المبلغ كتابةً')}</p>
            <div className={`mt-3 space-y-1 text-base font-bold leading-8 ${titleText}`}>
              {amountInWordsLines.map((line, index) => (
                <p key={`${line}-${index}`} dir="auto" className="whitespace-pre-line">{line}</p>
              ))}
            </div>
          </div>
          <div className={`rounded-2xl p-4 ${styles.block}`}>
            <div className="flex items-center justify-between text-sm font-bold text-slate-800">
              <span className="whitespace-pre-line">{bilingual ? toBilingualText('Subtotal', 'الإجمالي الفرعي') : (language === 'ar' ? 'الإجمالي الفرعي' : 'Subtotal')}</span>
              <span>{renderMoney(totals.subtotal)}</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-sm font-bold text-slate-800">
              <span className="whitespace-pre-line">{bilingual ? toBilingualText('Discount', 'الخصم') : (language === 'ar' ? 'الخصم' : 'Discount')}</span>
              <span>{renderMoney(totals.totalDiscount)}</span>
            </div>
            {!hideTaxOnInvoice && (
              <div className="mt-2 flex items-center justify-between text-sm font-bold text-slate-800">
                <span className="whitespace-pre-line">{bilingual ? toBilingualText(isPk ? 'GST' : 'Tax', 'الضريبة') : (language === 'ar' ? 'الضريبة' : (isPk ? 'GST' : 'VAT'))}</span>
                <span>{renderMoney(totals.totalTax)}</span>
              </div>
            )}
            <div className={`mt-4 flex items-center justify-between border-t border-slate-200 pt-4 ${titleText}`}>
              <span className="text-base font-bold whitespace-pre-line">{bilingual ? toBilingualText('Total', 'الإجمالي') : (language === 'ar' ? 'الإجمالي النهائي' : 'Grand Total')}</span>
              <span className="text-2xl font-bold">{renderMoney(totals.grandTotal)}</span>
            </div>
          </div>
        </div>

        {/* Document Extras & Unified Signatory */}
        <DocumentExtras invoice={invoice} invoiceBranding={invoiceBranding} language={language} bilingual={bilingual} />

        <div className="mt-6 flex flex-col gap-4 border-t border-slate-200 pt-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex min-h-16 items-end justify-center lg:justify-start">
            {showVisionLogo ? (
              <div className="flex h-16 w-28 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white px-3 py-2">
                <img src={invoiceBranding.vision2030LogoSrc} alt="" className="h-full w-full object-contain" />
              </div>
            ) : <div />}
          </div>
          {footerLines.length > 0 ? (
            <div className="flex-1 space-y-1 text-center lg:text-end">
              {footerLines.map((line, index) => (
                <p key={`${line}-${index}`} className={`text-sm leading-6 ${mutedText}`}>{line}</p>
              ))}
            </div>
          ) : <div className="flex-1" />}
        </div>
      </div>
    </div>
  )
}
