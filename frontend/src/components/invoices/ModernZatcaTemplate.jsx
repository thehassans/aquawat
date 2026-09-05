import React from 'react'
import { QRCodeSVG } from 'qrcode.react'
import DocumentExtras from './DocumentExtras'
import { resolveTaxInvoiceQr } from '../../lib/taxInvoiceQr'
import { getUomLabel } from '../../lib/uomOptions'
import { calculateInvoiceSummary, toNumber } from '../../lib/invoiceDocument'
import { getInvoiceBranding, getLetterheadContact, hexColorToRgb } from '../../lib/invoiceBranding'
import { formatCurrencyAmount } from '../../lib/currency'
import { Calendar, Hash, User, Phone, MapPin, CreditCard, FileText, Mail, Info } from 'lucide-react'
import { getAmountInWords } from '../../lib/amountInWords'
import { hasInvoiceDateValue, localizeSecondaryText, setActiveInvoiceSecondaryLanguage } from '../../lib/invoiceLanguage'
import { getTaxIdLabel, getTaxQrLabel } from '../../lib/saudiTenant'
import { normalizeSaudiVatDigits } from '../../lib/saudiVat'
import { formatInvoiceDateDisplay, resolveInvoiceDateCalendar } from '../../lib/invoiceDateFormat'
import {
  getCommercialCounterpartyLabel,
  getCounterpartyFallbackName,
  getZatcaDocumentTitle,
  resolveCommercialDocumentNumber,
  shouldShowZatcaQr,
  formatPartyAddress,
} from '../../lib/commercialDocumentLabels'
import ProductTypeMark from './ProductTypeMark'
import LetterheadChrome from './LetterheadChrome'

const hasArabicText = (value = '') => /[\u0600-\u06FF]/.test(String(value || ''))
const toEasternArabicNumerals = (str) => String(str || '').replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d])
const isDummyVat = (val) => !val || /^DEMO-\d+/i.test(String(val).trim())
const isDummyCr = (val) => !val || /^CR-\d+/i.test(String(val).trim())

export default function ModernZatcaTemplate({ invoice, tenant, language = 'en', bilingual = false, secondaryLanguage, documentType = 'invoice' }) {
  const resolvedSecondary = ['ur', 'bn', 'ar'].includes(secondaryLanguage) ? secondaryLanguage : null
  setActiveInvoiceSecondaryLanguage(resolvedSecondary)
  const secondaryDir = resolvedSecondary === 'bn' ? 'ltr' : 'rtl'
  const isArabicSecondary = bilingual && resolvedSecondary === 'ar'
  const S = (ar) => localizeSecondaryText(ar)
  // Separate Arabic from English so CSS uppercase/letter-spacing cannot break ligatures
  // (html2canvas / print also inherit those from parents).
  const ArText = ({ children, className = '' }) => (
    <span
      className={`font-['Almarai'] normal-case tracking-normal [letter-spacing:0] [text-transform:none] ${className}`}
      dir={secondaryDir}
      lang={isArabicSecondary ? 'ar' : undefined}
    >
      {children}
    </span>
  )
  const EnAr = ({ en, ar, enClassName = '', arClassName = '', className = '' }) => {
    const secondary = bilingual ? S(ar) : ''
    if (!secondary) return <span className={enClassName}>{en}</span>
    // shrink-0 on each part — otherwise a compressed parent (min-w-0) collapses
    // the flex children and English/Arabic text paint on top of each other.
    return (
      <span className={`inline-flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 ${className}`}>
        <span className={`shrink-0 ${enClassName}`}>{en}</span>
        <span className="shrink-0 opacity-60" aria-hidden>/</span>
        <ArText className={`shrink-0 ${arClassName}`}>{secondary}</ArText>
      </span>
    )
  }

  const currency = invoice?.currency || tenant?.settings?.currency || 'SAR'
  const invoiceBranding = getInvoiceBranding(tenant, language, invoice?.businessContext)
  const letterheadContact = getLetterheadContact(tenant, invoice)
  const textColor = invoiceBranding.primaryColor || '#0F172A'
  const accentColor = invoiceBranding.secondaryColor || textColor
  const accentRgb = hexColorToRgb(accentColor)
  const brandBodyStyle = {
    color: textColor,
    '--inv-text': textColor,
    '--inv-accent': accentColor,
    '--inv-accent-soft': `rgba(${accentRgb.r}, ${accentRgb.g}, ${accentRgb.b}, 0.12)`,
    '--inv-accent-border': `rgba(${accentRgb.r}, ${accentRgb.g}, ${accentRgb.b}, 0.28)`,
  }
  
  const isVendorBill = documentType === 'vendor_bill'
  const isPurchaseFlow = invoice?.flow === 'purchase' || documentType === 'purchase_invoice' || documentType === 'purchase_order' || isVendorBill

  // Header Company Info:
  // For sales/quotations, seller is the tenant/business.
  // For purchase orders & purchase invoices, the company header is ALWAYS the Tenant (issuer).
  const companyNameEn = isPurchaseFlow
    ? (tenant?.business?.legalNameEn || tenant?.name || invoiceBranding?.legalNameEn || '')
    : (invoice?.seller?.name || invoice?.seller?.nameAr || tenant?.business?.legalNameEn || tenant?.business?.legalNameAr || '')
  
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

  const rawCompanyVat = isPurchaseFlow
    ? (tenant?.business?.vatNumber || '')
    : (tenant?.business?.vatNumber || invoice?.seller?.vatNumber || '')
  const companyVat = (() => {
    if (isDummyVat(rawCompanyVat)) return ''
    const digits = normalizeSaudiVatDigits(rawCompanyVat)
    return digits || String(rawCompanyVat).trim()
  })()

  const rawCompanyCr = isPurchaseFlow
    ? (tenant?.business?.crNumber || '')
    : (invoice?.seller?.crNumber || tenant?.business?.crNumber || '')
  const companyCr = isDummyCr(rawCompanyCr) ? '' : String(rawCompanyCr).trim()

  // Counterparty Info (Customer for sell/quotation, Supplier for purchase/PO):
  const counterpartyData = isPurchaseFlow ? invoice?.seller : invoice?.buyer
  const counterpartyNameEn = counterpartyData?.name || counterpartyData?.nameAr || (isPurchaseFlow ? (language === 'ar' ? 'مورد نقدي' : 'Cash Supplier') : getCounterpartyFallbackName(documentType, 'en'))
  const counterpartyNameAr = counterpartyData?.nameAr || (hasArabicText(counterpartyData?.name) ? counterpartyData?.name : '') || (isPurchaseFlow ? 'مورد نقدي' : '')
  const counterpartyName = bilingual ? counterpartyNameEn : (language === 'ar' ? (counterpartyNameAr || counterpartyNameEn) : (counterpartyNameEn || counterpartyNameAr))
  const counterpartyAddress = counterpartyData?.address
  const counterpartyPhone = counterpartyData?.contactPhone || counterpartyData?.phone
  const counterpartyVat = isDummyVat(counterpartyData?.vatNumber) ? '' : String(counterpartyData?.vatNumber).trim()
  const counterpartyCr = isDummyCr(counterpartyData?.crNumber) ? '' : String(counterpartyData?.crNumber).trim()

  const taxIdLabel = getTaxIdLabel(tenant, currency, false)
  const taxIdLabelAr = getTaxIdLabel(tenant, currency, true)
  const isZatcaApplicable = String(currency || 'SAR').toUpperCase() === 'SAR'
  const qrValue = resolveTaxInvoiceQr({
    invoice,
    tenant,
    currency,
    sellerName: companyNameEn || companyNameAr,
    vatNumber: companyVat,
  })

  const totals = calculateInvoiceSummary(invoice)
  const lineItems = totals.lines.length > 0 ? totals.lines : [{ raw: { productName: language === 'ar' ? 'خدمة' : 'Service' }, quantity: 1, unitPrice: 0, taxAmount: 0, lineTotalWithTax: 0 }]
  
  const documentNumber = resolveCommercialDocumentNumber(invoice, documentType)
  
  const formatDate = (dateString, locale = 'en-SA') => {
    if (!dateString) return '—'
    return formatInvoiceDateDisplay(dateString, {
      mode: resolveInvoiceDateCalendar(tenant),
      language: locale.startsWith('ar') ? 'ar' : 'en',
      hijriValue: invoice?.issueDateHijri,
      includeTime: false,
      timeZone: tenant?.settings?.timezone || 'Asia/Riyadh',
    })
  }

  const isBoutiqueRental = invoice?.businessContext === 'boutique' && invoice?.boutiqueDetails?.transactionType === 'rental'

  const renderMoney = (value, { compact = false } = {}) => {
    const amount = formatCurrencyAmount(value, {
      language,
      currency,
      currencyDisplay: 'code',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
    const amountAr = formatCurrencyAmount(value, {
      language: 'ar',
      currency,
      currencyDisplay: 'code',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
    const showArabicMoney = isBoutiqueRental && isArabicSecondary
    // Stack EN/AR amounts vertically in tight summary rows so labels never collide.
    if (showArabicMoney && compact) {
      return (
        <span className="inline-flex flex-col items-end gap-0.5 whitespace-nowrap leading-tight">
          <span className="inline-flex items-center gap-[0.3em]">
            <span className="tabular-nums">{amount}</span>
            <span className="text-[0.85em] font-medium">{currency}</span>
          </span>
          <span className="font-['Almarai'] text-[0.8em] font-medium text-gray-600" dir="rtl">
            {amountAr} {currency === 'SAR' ? 'ر.س' : currency}
          </span>
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-[0.3em] whitespace-nowrap">
        <span className="tabular-nums">{amount}</span>
        <span className="text-[0.85em] font-medium">{currency}</span>
        {showArabicMoney && (
          <>
            <span className="text-gray-400">/</span>
            <span className="font-['Almarai'] text-[0.85em] font-medium" dir="rtl">
              {amountAr} {currency === 'SAR' ? 'ر.س' : currency}
            </span>
          </>
        )}
      </span>
    )
  }
  const isQuotation = documentType === 'quotation'
  const isPurchaseOrder = documentType === 'purchase_order'
  const showZatcaQr = shouldShowZatcaQr(documentType)

  const companyAddressText = formatPartyAddress(companyAddress || {}, { language: 'en' })
  const companyAddressArText = formatPartyAddress(companyAddress || {}, { language: 'ar' })

  return (
    <LetterheadChrome
      tenant={tenant}
      invoice={invoice}
      bilingual={bilingual}
      hideFooter={!isQuotation}
      className={`rounded-[2rem] border shadow-xl overflow-hidden font-sans ${invoiceBranding.letterheadImage ? 'bg-transparent' : 'bg-white'}`}
    >
      {invoiceBranding.letterheadImage && (
        <img src={invoiceBranding.letterheadImage} alt="" className="absolute inset-0 w-full h-full object-cover z-0 pointer-events-none" />
      )}
      <div className="inv-branded-body relative z-10" style={brandBodyStyle}>
        {(companyAddressText || companyVat || companyPhone) && (
          <div className="border-b border-slate-100 px-4 py-2 text-[11px] text-slate-600">
            {companyAddressText ? <p>{companyAddressText}</p> : null}
            {bilingual && companyAddressArText && companyAddressArText !== companyAddressText ? (
              <p dir="rtl">{companyAddressArText}</p>
            ) : null}
            <p className="mt-0.5 flex flex-wrap gap-x-3">
              {companyVat ? <span>VAT: {companyVat}</span> : null}
              {companyCr ? <span>CR: {companyCr}</span> : null}
              {companyPhone ? <span>{companyPhone}</span> : null}
            </p>
          </div>
        )}
        <style>{`
          .inv-branded-body .text-gray-900,
          .inv-branded-body .text-gray-800,
          .inv-branded-body .text-gray-700 { color: var(--inv-text); }
          .inv-branded-body .text-primary-700,
          .inv-branded-body .text-primary-600 { color: var(--inv-accent); }
        `}</style>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <div
            className={`inline-flex w-fit items-center justify-center gap-2 rounded-full border px-4 py-1.5 text-xs font-semibold text-center align-middle ${
              isPurchaseOrder || isPurchaseFlow
                ? 'bg-slate-900 text-white border-slate-900'
                : invoice?.businessContext === 'furniture' || (typeof window !== 'undefined' && window.location.pathname.includes('/furniture'))
                ? 'bg-blue-50 text-blue-700 border-blue-200'
                : invoice?.businessContext === 'boutique'
                ? invoice?.boutiqueDetails?.transactionType === 'sale'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-rose-50 text-rose-700 border-rose-200'
                : ''
            }`}
            style={
              !(isPurchaseOrder || isPurchaseFlow || invoice?.businessContext === 'furniture' || invoice?.businessContext === 'boutique')
                ? { backgroundColor: 'var(--inv-accent-soft)', color: 'var(--inv-accent)', borderColor: 'var(--inv-accent-border)' }
                : undefined
            }
          >
            <FileText className="h-4 w-4 shrink-0" />
            <span className="inline-flex items-center gap-1.5 leading-none">
              {isPurchaseOrder
                ? <EnAr en="Purchase Order" ar="طلب شراء" enClassName="uppercase tracking-wider" />
                : isVendorBill
                ? <EnAr en="Purchase Order Bill" ar="فاتورة أمر الشراء" enClassName="uppercase tracking-wider" />
                : isPurchaseFlow
                ? <EnAr en="Purchase Invoice" ar="فاتورة شراء" enClassName="uppercase tracking-wider" />
                : invoice?.businessContext === 'furniture' || (typeof window !== 'undefined' && window.location.pathname.includes('/furniture'))
                ? <EnAr en="Furniture Sale Invoice" ar="فاتورة بيع مفروشات" enClassName="uppercase tracking-wider" />
                : invoice?.businessContext === 'boutique'
                ? invoice?.boutiqueDetails?.transactionType === 'sale'
                  ? <EnAr en="Boutique Sale Invoice" ar="فاتورة بيع بوتيك" enClassName="uppercase tracking-wider" />
                  : <EnAr en="Boutique Rental Invoice" ar="فاتورة إيجار بوتيك" enClassName="uppercase tracking-wider" />
                : isQuotation
                ? <EnAr en="Quotation" ar="عرض سعر" enClassName="uppercase tracking-wider" />
                : (() => {
                    try {
                      return (
                        <EnAr
                          en={getZatcaDocumentTitle(invoice, 'en', documentType)}
                          ar={getZatcaDocumentTitle(invoice, 'ar', documentType)}
                          enClassName="uppercase tracking-wider"
                        />
                      )
                    } catch (err) {
                      return <span className="text-rose-700">{String(err.message || err)}</span>
                    }
                  })()}
            </span>
          </div>
        </div>

      <div className="p-4">
        {/* Bill To & Invoice Details Grid */}
        <div className="mb-3 grid items-start gap-3 md:grid-cols-2">
          <div className="rounded-xl border bg-gray-50 p-3">
            <h3 className="mb-2 flex items-center gap-2 font-semibold text-gray-900 border-b pb-1 text-sm">
              <User className="h-4 w-4 text-primary-600" />
              <EnAr
                en={getCommercialCounterpartyLabel(documentType, 'en', invoice?.flow)}
                ar={getCommercialCounterpartyLabel(documentType, 'ar', invoice?.flow)}
                enClassName="font-semibold text-gray-900"
                arClassName="font-semibold text-gray-900"
              />
            </h3>
            <div className="space-y-1 text-sm text-gray-700">
              <p className="font-bold text-gray-900 text-base">{counterpartyName}</p>
              {bilingual && counterpartyNameAr && (
                <p className="font-bold text-gray-500 font-['Almarai'] normal-case tracking-normal" dir="rtl" lang={isArabicSecondary ? 'ar' : undefined}>{counterpartyNameAr}</p>
              )}

              <div className="mt-2 space-y-1.5">
                {(counterpartyAddress?.street || counterpartyAddress?.city) && (
                  <div className="flex flex-col gap-1">
                    <p>{[counterpartyAddress.street, counterpartyAddress.district, counterpartyAddress.city, counterpartyAddress.country].filter(Boolean).join(', ')}</p>
                    {bilingual && (counterpartyAddress.streetAr || counterpartyAddress.districtAr || counterpartyAddress.cityAr) && (
                      <p className="text-gray-500" dir="rtl">{[counterpartyAddress.streetAr, counterpartyAddress.districtAr, counterpartyAddress.cityAr, counterpartyAddress.country].filter(Boolean).join('، ')}</p>
                    )}
                  </div>
                )}
                {counterpartyPhone && (
                  <p className="flex items-center gap-2">
                    <Phone className="h-3 w-3 text-gray-400" />
                    {counterpartyPhone}
                  </p>
                )}
                {(counterpartyData?.idNumber || counterpartyData?.customerIdNumber) && (
                  <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <p className="inline-flex items-center gap-2">
                      <span className="font-semibold text-gray-900">{counterpartyData?.idType === 'vat' ? 'VAT No' : counterpartyData?.idType === 'id' ? 'ID' : 'Iqama'}:</span>
                      <span className="font-mono">{counterpartyData.idNumber || counterpartyData.customerIdNumber}</span>
                    </p>
                    {bilingual && (
                      <>
                        <span className="text-gray-400" aria-hidden>/</span>
                        <p className="inline-flex items-center gap-1.5" dir={secondaryDir}>
                          <ArText className="font-semibold text-gray-900">
                            {counterpartyData?.idType === 'vat' ? S('الرقم الضريبي') : counterpartyData?.idType === 'id' ? (isArabicSecondary ? 'الهوية' : 'ID') : (isArabicSecondary ? 'الإقامة' : 'Iqama')}:
                          </ArText>
                          <ArText>{isArabicSecondary ? toEasternArabicNumerals(counterpartyData.idNumber || counterpartyData.customerIdNumber) : (counterpartyData.idNumber || counterpartyData.customerIdNumber)}</ArText>
                        </p>
                      </>
                    )}
                  </div>
                )}
                {counterpartyVat && (
                  <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <p className="inline-flex items-center gap-2">
                      <span className="font-semibold text-gray-900">VAT No:</span>
                      <span className="font-mono">{counterpartyVat}</span>
                    </p>
                    {bilingual && S('الرقم الضريبي') && (
                      <>
                        <span className="text-gray-400" aria-hidden>/</span>
                        <p className="inline-flex items-center gap-1.5" dir={secondaryDir}>
                          <ArText className="font-semibold text-gray-900">{S('الرقم الضريبي')}:</ArText>
                          <ArText>{isArabicSecondary ? toEasternArabicNumerals(counterpartyVat) : counterpartyVat}</ArText>
                        </p>
                      </>
                    )}
                  </div>
                )}
                {counterpartyCr && (
                  <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <p className="inline-flex items-center gap-2">
                      <span className="font-semibold text-gray-900">CR No:</span>
                      <span className="font-mono">{counterpartyCr}</span>
                    </p>
                    {bilingual && S('السجل التجاري') && (
                      <>
                        <span className="text-gray-400" aria-hidden>/</span>
                        <p className="inline-flex items-center gap-1.5" dir={secondaryDir}>
                          <ArText className="font-semibold text-gray-900">{S('السجل التجاري')}:</ArText>
                          <ArText>{isArabicSecondary ? toEasternArabicNumerals(counterpartyCr) : counterpartyCr}</ArText>
                        </p>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-xl border bg-gray-50 p-3">
            <h3 className="mb-2 flex items-center gap-2 font-semibold text-gray-900 border-b pb-1 text-sm">
              <Calendar className="h-4 w-4 text-primary-600" />
              <EnAr en="Details" ar="التفاصيل" enClassName="font-semibold text-gray-900" arClassName="font-semibold text-gray-900" />
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-gray-500">No:</span>
                <span className="font-mono font-bold text-gray-900">{documentNumber}</span>
                {bilingual && S('رقم') && <span className="text-gray-500" dir={secondaryDir}>:{S('رقم')}</span>}
              </div>
              <hr className="border-gray-200" />
              
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Date:</span>
                <span className="font-semibold text-gray-900">{formatDate(invoice?.issueDate)}</span>
                {bilingual && S('التاريخ') && <span className="text-gray-500" dir={secondaryDir}>:{S('التاريخ')}</span>}
              </div>
              {!(invoice?.businessContext === 'boutique' && invoice?.boutiqueDetails?.transactionType === 'rental') && hasInvoiceDateValue(invoice?.dueDate) && (
                <>
                  <hr className="border-gray-200" />
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Due Date:</span>
                    <span className="font-semibold text-gray-900">{formatDate(invoice.dueDate)}</span>
                    {bilingual && S('تاريخ الاستحقاق') && <span className="text-gray-500" dir={secondaryDir}>:{S('تاريخ الاستحقاق')}</span>}
                  </div>
                </>
              )}
              {isQuotation && hasInvoiceDateValue(invoice?.validUntil) && (
                <>
                  <hr className="border-gray-200" />
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Valid Until:</span>
                    <span className="font-semibold text-gray-900">{formatDate(invoice.validUntil)}</span>
                    {bilingual && S('صالح حتى') && <span className="text-gray-500" dir={secondaryDir}>:{S('صالح حتى')}</span>}
                  </div>
                </>
              )}

              {invoice?.businessContext === 'boutique' && invoice?.boutiqueDetails?.transactionType === 'rental' && (
                <>
                  <hr className="border-gray-200" />
                  <div className="flex items-start justify-between gap-3">
                    <EnAr en="Rental Start" ar="بداية الإيجار" enClassName="text-gray-500" arClassName="text-xs text-gray-400" className="shrink-0 max-w-[55%]" />
                    <span className="font-semibold text-gray-900 shrink-0 text-end">{formatDate(invoice.boutiqueDetails.startDate)}</span>
                  </div>
                  <hr className="border-gray-200" />
                  <div className="flex items-start justify-between gap-3">
                    <EnAr en="Rental End" ar="نهاية الإيجار" enClassName="text-gray-500" arClassName="text-xs text-gray-400" className="shrink-0 max-w-[55%]" />
                    <span className="font-semibold text-gray-900 shrink-0 text-end">{formatDate(invoice.boutiqueDetails.endDate)}</span>
                  </div>
                  <hr className="border-gray-200" />
                  <div className="flex items-start justify-between gap-3">
                    <EnAr en="Rental Days" ar="عدد أيام الإيجار" enClassName="text-gray-500" arClassName="text-xs text-gray-400" className="shrink-0 max-w-[55%]" />
                    <span className="font-semibold text-gray-900 shrink-0 text-end">
                      {(() => {
                        const start = new Date(invoice.boutiqueDetails.startDate)
                        const end = new Date(invoice.boutiqueDetails.endDate)
                        const days = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)))
                        return days
                      })()}
                    </span>
                  </div>
                  <hr className="border-gray-200" />
                  <div className="flex items-start justify-between gap-3">
                    <EnAr en="Security Deposit" ar="تأمين" enClassName="text-gray-500" arClassName="text-xs text-gray-400" className="shrink-0 max-w-[55%]" />
                    <span className="font-semibold text-gray-900 shrink-0 text-end">{renderMoney(toNumber(invoice.boutiqueDetails.totalDeposit), { compact: true })}</span>
                  </div>
                  <hr className="border-gray-200" />
                  <div className="flex items-start justify-between gap-3">
                    <EnAr en="Payment Method" ar="طريقة الدفع" enClassName="text-gray-500" arClassName="text-xs text-gray-400" className="shrink-0 max-w-[55%]" />
                    <span className="font-semibold text-gray-900 capitalize shrink-0 text-end">
                      {invoice.boutiqueDetails.paymentMethod === 'card'
                        ? (isArabicSecondary ? 'Card / بطاقة' : 'Card')
                        : (isArabicSecondary ? 'Cash / نقدي' : 'Cash')}
                    </span>
                  </div>
                  <hr className="border-gray-200" />
                  <div className="flex items-start justify-between gap-3">
                    <EnAr en="Amount Paid" ar="المبلغ المدفوع" enClassName="text-gray-500" arClassName="text-xs text-gray-400" className="shrink-0 max-w-[55%]" />
                    <span className="font-semibold text-gray-900 shrink-0 text-end">{renderMoney(toNumber(invoice.boutiqueDetails.amountPaid), { compact: true })}</span>
                  </div>
                  {toNumber(invoice.boutiqueDetails.amountPaid) < toNumber(invoice.grandTotal) && (
                    <>
                      <hr className="border-gray-200" />
                      <div className="flex items-start justify-between gap-3">
                        <EnAr en="Pending Amount" ar="المبلغ المتبقي" enClassName="text-gray-500" arClassName="text-xs text-gray-400" className="shrink-0 max-w-[55%]" />
                        <span className="font-semibold text-rose-600 shrink-0 text-end">{renderMoney(toNumber(invoice.grandTotal) - toNumber(invoice.boutiqueDetails.amountPaid), { compact: true })}</span>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="mb-3 overflow-hidden rounded-xl border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-start font-semibold text-gray-900">#</th>
                <th className="px-3 py-2 text-start font-semibold text-gray-900">
                  <div className="flex flex-col">
                    <span>Description</span>
                    {bilingual && S('الوصف') && <span className="text-xs text-gray-500" dir={secondaryDir}>{S('الوصف')}</span>}
                  </div>
                </th>
                {invoice?.businessContext === 'boutique' && invoice?.boutiqueDetails?.transactionType === 'rental' ? (
                  <th className="px-3 py-2 text-center font-semibold text-gray-900">
                    <div className="flex flex-col">
                      <span>Days</span>
                      {bilingual && S('الأيام') && <span className="text-xs text-gray-500" dir={secondaryDir}>{S('الأيام')}</span>}
                    </div>
                  </th>
                ) : (
                  <th className="px-3 py-2 text-center font-semibold text-gray-900">
                    <div className="flex flex-col">
                      <span>Qty</span>
                      {bilingual && S('الكمية') && <span className="text-xs text-gray-500" dir={secondaryDir}>{S('الكمية')}</span>}
                    </div>
                  </th>
                )}
                <th className="px-3 py-2 text-right font-semibold text-gray-900">
                  <div className="flex flex-col items-end">
                    <span>Unit Price</span>
                    {bilingual && S('سعر الوحدة') && <span className="text-xs text-gray-500" dir={secondaryDir}>{S('سعر الوحدة')}</span>}
                  </div>
                </th>
                <th className="px-3 py-2 text-right font-semibold text-gray-900">
                  <div className="flex flex-col items-end">
                    <span>Tax</span>
                    {bilingual && S('الضريبة') && <span className="text-xs text-gray-500" dir={secondaryDir}>{S('الضريبة')}</span>}
                  </div>
                </th>
                <th className="px-3 py-2 text-right font-semibold text-gray-900">
                  <div className="flex flex-col items-end">
                    <span>Total</span>
                    {bilingual && S('المجموع') && <span className="text-xs text-gray-500" dir={secondaryDir}>{S('المجموع')}</span>}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white text-gray-700">
              {lineItems.map((item, index) => {
                const productNameEn = item?.raw?.productName || item?.productName || item?.raw?.productNameAr || item?.productNameAr || '—'
                const productNameAr = item?.raw?.productNameAr || item?.productNameAr || (hasArabicText(productNameEn) ? productNameEn : '')
                
                return (
                  <tr key={index} className="hover:bg-gray-50/50">
                    <td className="px-3 py-2 font-medium text-gray-900">{index + 1}</td>
                    <td className="px-3 py-2 max-w-xs">
                      <div>
                        <p className="font-medium text-gray-900 whitespace-pre-wrap">{productNameEn}</p>
                        {bilingual && productNameAr && (
                          <p className="text-sm text-gray-500 mt-1 whitespace-pre-wrap font-['Almarai'] normal-case tracking-normal" dir="rtl" lang={isArabicSecondary ? 'ar' : undefined}>
                            {productNameAr}
                          </p>
                        )}
                        <ProductTypeMark line={item} language={language} bilingual={bilingual} />
                      </div>
                    </td>
                    {isBoutiqueRental ? (
                      <td className="px-3 py-2 text-center">
                        <div>{item.rentalDays || item.quantity || 1}</div>
                        {(item?.unitCode || item?.raw?.unitCode) && <div className="text-[10px] text-gray-500 font-semibold mt-1">{getUomLabel(item?.unitCode || item?.raw?.unitCode, language)}</div>}
                      </td>
                    ) : (
                      <td className="px-3 py-2 text-center">
                        <div>{item.quantity}</div>
                        {(item?.unitCode || item?.raw?.unitCode) && <div className="text-[10px] text-gray-500 font-semibold mt-1">{getUomLabel(item?.unitCode || item?.raw?.unitCode, language)}</div>}
                      </td>
                    )}
                    <td className="px-3 py-2 text-right font-mono text-gray-900">
                      {renderMoney(toNumber(item.unitPrice))}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex flex-col items-end">
                        <span className="font-mono text-gray-900">
                          {renderMoney(toNumber(item.taxAmount))}
                        </span>
                        <span className="text-xs text-gray-500 mt-0.5">
                          ({item.taxRate}%)
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right font-mono font-bold text-gray-900">
                      {renderMoney(toNumber(item.lineTotalWithTax))}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Footer Summary & Notes */}
        <div className={`flex flex-col gap-3 ${(invoice?.notes || invoice?.notesAr) ? 'md:flex-row md:items-start' : 'md:flex-row md:justify-end'}`}>
          {(invoice?.notes || invoice?.notesAr) && (
            <div className="min-w-0 flex-1 rounded-xl border bg-gray-50 p-3">
              <h4 className="mb-2 font-semibold text-gray-900 border-b pb-1 text-sm">
                <EnAr en="Notes" ar="ملاحظات" enClassName="font-semibold text-gray-900" arClassName="font-semibold text-gray-900" />
              </h4>
              <p className="text-sm text-gray-600 whitespace-pre-wrap">{invoice?.notes || '—'}</p>
              {bilingual && invoice?.notesAr && (
                <p className="mt-2 text-sm text-gray-600 whitespace-pre-wrap" dir="rtl">{invoice?.notesAr}</p>
              )}
            </div>
          )}

          <div className="w-full shrink-0 rounded-xl border bg-gray-50 p-3 md:min-w-[20rem] md:w-[24rem]">
            {invoice?.paymentMethod && (
              <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-gray-200 pb-2 text-sm">
                <CreditCard className="h-4 w-4 shrink-0 text-gray-400" />
                <span className="font-semibold text-gray-900">
                  <EnAr en="Payment Method" ar="طريقة الدفع" enClassName="font-semibold text-gray-900" arClassName="font-semibold text-gray-900" />:
                </span>
                <span className="text-gray-700 capitalize">{invoice.paymentMethod}</span>
              </div>
            )}
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-3 text-sm">
                <EnAr en="Subtotal" ar="المجموع الفرعي" enClassName="text-gray-500" arClassName="text-xs text-gray-400" className="shrink-0 max-w-[55%]" />
                <span className="font-mono font-semibold text-gray-900 shrink-0 text-end">
                  {renderMoney(totals.subtotal, { compact: true })}
                </span>
              </div>
              <hr className="border-gray-200" />
              
              <div className="flex items-start justify-between gap-3 text-sm">
                <EnAr en="VAT Total" ar="إجمالي الضريبة" enClassName="text-gray-500" arClassName="text-xs text-gray-400" className="shrink-0 max-w-[55%]" />
                <span className="font-mono font-semibold text-gray-900 shrink-0 text-end">
                  {renderMoney(totals.totalTax, { compact: true })}
                </span>
              </div>
              <hr className="border-gray-200" />

              {invoice?.businessContext === 'boutique' && invoice?.boutiqueDetails?.transactionType === 'rental' && toNumber(invoice.boutiqueDetails.totalDeposit) > 0 && (
                <>
                  <div className="flex items-start justify-between gap-3 text-sm">
                    <EnAr en="Security Deposit" ar="تأمين" enClassName="text-gray-500" arClassName="text-xs text-gray-400" className="shrink-0 max-w-[55%]" />
                    <span className="font-mono font-semibold text-gray-900 shrink-0 text-end">
                      {renderMoney(toNumber(invoice.boutiqueDetails.totalDeposit), { compact: true })}
                    </span>
                  </div>
                  <hr className="border-gray-200" />
                </>
              )}
              
              <div
                className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
                style={{ backgroundColor: 'var(--inv-accent-soft)', borderColor: 'var(--inv-accent-border)' }}
              >
                <EnAr en="Total" ar="الإجمالي" enClassName="font-bold text-gray-900" arClassName="text-sm font-semibold text-gray-600" className="shrink-0" />
                <span className="font-mono text-lg font-bold text-primary-700 shrink-0 text-end sm:text-xl">
                  {renderMoney(totals.grandTotal, { compact: true })}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Amount In Words & ZATCA QR */}
        <div className="mt-3 flex flex-col gap-3 md:flex-row">
          <div className="flex-1 rounded-xl border border-dashed border-gray-300 bg-gray-50/50 p-3">
            <div className="flex items-start gap-3">
              <Hash className="mt-0.5 h-5 w-5 shrink-0 text-gray-400" />
              <div className="flex-1 text-sm text-gray-600">
                <p className="mb-1 font-semibold text-gray-900">
                  <EnAr en="Amount in Words" ar="المبلغ كتابةً" enClassName="font-semibold text-gray-900" arClassName="font-semibold text-gray-900" />
                </p>
                <p className="font-medium text-gray-800">{getAmountInWords(totals.grandTotal, currency, 'en')}</p>
                {bilingual && resolvedSecondary && resolvedSecondary !== 'bn' && (
                  <p dir={secondaryDir} className="mt-1 font-medium text-gray-800 font-['Almarai'] normal-case tracking-normal" lang={isArabicSecondary ? 'ar' : undefined}>
                    {getAmountInWords(totals.grandTotal, currency, resolvedSecondary)}
                  </p>
                )}
              </div>
            </div>
          </div>

          {showZatcaQr && qrValue && (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50/50 p-3 w-full md:w-56">
              <QRCodeSVG value={qrValue} size={100} bgColor="transparent" fgColor={textColor} />
              <p className="mt-2 text-xs text-center text-gray-500">{getTaxQrLabel(tenant, currency, language === 'ar')}</p>
            </div>
          )}
        </div>

        {/* Boutique Rental Terms — compact single-page */}
        {invoice?.businessContext === 'boutique' && invoice?.boutiqueDetails?.transactionType === 'rental' && (
          <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50/50 p-2 text-[10px] leading-[1.25] print:break-inside-avoid font-bold">
            <div className="flex justify-between items-center mb-1">
              <h4 className="font-bold text-gray-900">Rental Terms</h4>
              {bilingual && S('شروط الإيجار') && <h4 className="font-bold text-gray-900" dir={secondaryDir}>{S('شروط الإيجار')}</h4>}
            </div>
            <div className="text-[9px] text-gray-700 mb-1">
              <span className="block">To protect the item from damage, the customer must adhere to the following:</span>
              {isArabicSecondary && <span className="block font-['Almarai']" dir="rtl">حفاظاً على السلعة من التلف يرجى التزام العميل بالآتي:</span>}
            </div>
            <div className={`grid gap-3 items-start ${isArabicSecondary ? 'grid-cols-2' : 'grid-cols-1'}`}>
              <div dir="ltr">
                <div className="space-y-0.5 text-left">
                  <div className="flex gap-1.5"><span className="shrink-0 w-3">1.</span><span>The down payment is non-refundable after the invoice is issued.</span></div>
                  <div className="flex gap-1.5"><span className="shrink-0 w-3">2.</span><span>In the event of a delay in returning the dress, the store has the right to double the rental amount by 500 Riyals for each day. In the event the dress is damaged, the security deposit will be deducted from the customer, and they must pay the remaining amount to cover the full value of the dress.</span></div>
                  <div className="flex gap-1.5"><span className="shrink-0 w-3">3.</span><span>Please bring the security deposit amount before taking the dress.</span></div>
                  <div className="flex gap-1.5"><span className="shrink-0 w-3">4.</span><span>The customer will be charged 200 Riyals for washing the Maleka (Engagement) dress, and 200 Riyals for washing the Meel (Train).</span></div>
                </div>
              </div>
              {isArabicSecondary && (
              <div dir="rtl" className="font-['Almarai']">
                <div className="space-y-0.5 pr-0 [direction:rtl]">
                  <div className="flex gap-1.5 text-right"><span className="shrink-0 w-3">١.</span><span>لا يتم إرجاع العربون بعد تحرير الفاتورة.</span></div>
                  <div className="flex gap-1.5 text-right"><span className="shrink-0 w-3">٢.</span><span>في حال تأخير الفستان يحق للمحل مضاعفة مبلغ الايجار في كل يوم ٥٠٠ ريال، وفي حال تعرض الفستان للتلف يخصم على العميل التأمين ويكمل قيمة الفستان كامل.</span></div>
                  <div className="flex gap-1.5 text-right"><span className="shrink-0 w-3">٣.</span><span>يرجى إحضار مبلغ التأمين قبل أخذ الفستان.</span></div>
                  <div className="flex gap-1.5 text-right"><span className="shrink-0 w-3">٤.</span><span>يخصم على العميل قيمة غسيل فستان الملكة ٢٠٠ ريال، وغسيل الميل ٢٠٠ ريال.</span></div>
                </div>
              </div>
              )}
            </div>
          </div>
        )}

        {/* Document Extras & Unified Signatory */}
        <DocumentExtras invoice={invoice} invoiceBranding={invoiceBranding} language={language} bilingual={bilingual} signatoryFromDocumentOnly={isQuotation} />
      </div>
      {isQuotation ? (
        <footer className="border-t border-gray-200 px-6 py-4">
          <div className="flex flex-col items-center justify-center gap-2">
            <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-sm font-bold text-gray-900">
              {letterheadContact.addressLine ? (
                <p className="flex max-w-xl items-start gap-1.5 text-center">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{letterheadContact.addressLine}</span>
                </p>
              ) : null}
              {letterheadContact.phone ? (
                <p className="flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 shrink-0" />
                  <span>{letterheadContact.phone}</span>
                </p>
              ) : null}
              {letterheadContact.email ? (
                <p className="flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 shrink-0" />
                  <span>{letterheadContact.email}</span>
                </p>
              ) : null}
            </div>
            {letterheadContact.addressAr && letterheadContact.addressAr !== letterheadContact.addressLine ? (
              <p className="max-w-xl text-center text-sm font-bold text-gray-900" dir="rtl">{letterheadContact.addressAr}</p>
            ) : null}
          </div>
        </footer>
      ) : null}
      </div>
    </LetterheadChrome>
  )
}
