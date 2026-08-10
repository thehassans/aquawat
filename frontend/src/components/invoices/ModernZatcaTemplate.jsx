import React from 'react'
import { QRCodeSVG } from 'qrcode.react'
import DocumentExtras from './DocumentExtras'
import { generateZatcaQrValue } from '../../lib/zatcaQr'
import { getUomLabel } from '../../lib/uomOptions'
import { calculateInvoiceSummary, toNumber } from '../../lib/invoiceDocument'
import { getInvoiceBranding } from '../../lib/invoiceBranding'
import { formatCurrencyAmount } from '../../lib/currency'
import { Building2, Calendar, Hash, User, Phone, MapPin, CreditCard, FileText, Mail, Info } from 'lucide-react'
import { getAmountInWords } from '../../lib/amountInWords'
import { bilingualLabel, localizeSecondaryText, setActiveInvoiceSecondaryLanguage } from '../../lib/invoiceLanguage'

const hasArabicText = (value = '') => /[\u0600-\u06FF]/.test(String(value || ''))
const toEasternArabicNumerals = (str) => String(str || '').replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d])

export default function ModernZatcaTemplate({ invoice, tenant, language = 'en', bilingual = false, secondaryLanguage, documentType = 'invoice' }) {
  const resolvedSecondary = ['ur', 'bn', 'ar'].includes(secondaryLanguage) ? secondaryLanguage : null
  setActiveInvoiceSecondaryLanguage(resolvedSecondary)
  const secondaryDir = resolvedSecondary === 'bn' ? 'ltr' : 'rtl'
  const isArabicSecondary = bilingual && resolvedSecondary === 'ar'
  const L = (en, ar) => bilingualLabel(en, ar, bilingual)
  const S = (ar) => localizeSecondaryText(ar)

  const currency = invoice?.currency || tenant?.settings?.currency || 'SAR'
  const invoiceBranding = getInvoiceBranding(tenant, language, invoice?.businessContext)
  
  const sellerNameEn = invoice?.seller?.name || invoice?.seller?.nameAr || tenant?.business?.legalNameEn || tenant?.business?.legalNameAr || ''
  const sellerNameAr = invoice?.seller?.nameAr || (hasArabicText(invoice?.seller?.name) ? invoice?.seller?.name : '') || tenant?.business?.legalNameAr || ''
  const buyerNameEn = invoice?.buyer?.name || invoice?.buyer?.nameAr || 'Cash Customer'
  const buyerNameAr = invoice?.buyer?.nameAr || (hasArabicText(invoice?.buyer?.name) ? invoice?.buyer?.name : '')
  
  const sellerName = bilingual ? sellerNameEn : (language === 'ar' ? (sellerNameAr || sellerNameEn) : (sellerNameEn || sellerNameAr))
  const buyerName = bilingual ? buyerNameEn : (language === 'ar' ? (buyerNameAr || buyerNameEn) : (buyerNameEn || buyerNameAr))

  const logoSrc = invoiceBranding.logoSrc
  
  // ZATCA is a Saudi-only requirement tied to SAR-denominated invoices.
  const isZatcaApplicable = String(currency || 'SAR').toUpperCase() === 'SAR'
  const qrValue = !isZatcaApplicable ? null : (invoice?.zatca?.qrCodeData || generateZatcaQrValue({
    sellerName: sellerNameEn || sellerNameAr,
    vatNumber: invoice?.seller?.vatNumber || tenant?.business?.vatNumber,
    timestamp: invoice?.issueDate || new Date().toISOString(),
    totalWithVat: toNumber(invoice?.grandTotal),
    vatTotal: toNumber(invoice?.totalTax),
  }))

  const totals = calculateInvoiceSummary(invoice)
  const lineItems = totals.lines.length > 0 ? totals.lines : [{ raw: { productName: language === 'ar' ? 'خدمة' : 'Service' }, quantity: 1, unitPrice: 0, taxAmount: 0, lineTotalWithTax: 0 }]
  
  const documentNumber = invoice?.quotationNumber || invoice?.invoiceNumber || 'DRAFT-PREVIEW'
  
  const formatDate = (dateString, locale = 'en-SA') => {
    if (!dateString) return '—'
    return new Date(dateString).toLocaleDateString(locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  const renderMoney = (value) => {
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
    return (
      <span className="inline-flex items-center gap-[0.3em] whitespace-nowrap">
        <span className="tabular-nums">{amount}</span>
        <span className="text-[0.85em] font-medium">{currency}</span>
        {isBoutiqueRental && isArabicSecondary && (
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

  const isBoutiqueRental = invoice?.businessContext === 'boutique' && invoice?.boutiqueDetails?.transactionType === 'rental'
  const isQuotation = documentType === 'quotation'

  return (
    <div dir="ltr" className={`relative mx-auto max-w-5xl ${invoiceBranding.letterheadImage ? 'bg-transparent' : 'bg-white'} border rounded-[2rem] shadow-xl overflow-hidden font-sans`}>
      {invoiceBranding.letterheadImage && (
        <img src={invoiceBranding.letterheadImage} alt="" className="absolute inset-0 w-full h-full object-cover z-0 pointer-events-none" />
      )}
      <div className="relative z-10">
        {/* Header */}
        <div className={`border-b ${invoiceBranding.letterheadImage ? 'bg-transparent' : 'bg-white'} px-6 pb-6 ${invoice?.businessContext === 'boutique' && invoice?.boutiqueDetails?.transactionType === 'rental' ? 'pt-2' : 'pt-6'}`}>
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div className="flex-1">
            <div className="mb-4">
              {logoSrc ? (
                <img
                  src={logoSrc}
                  alt="Logo"
                  className={`w-auto object-contain ${invoice?.businessContext === 'boutique' && invoice?.boutiqueDetails?.transactionType === 'rental' ? 'h-24' : 'h-16'}`}
                />
              ) : (
                <Building2 className={`text-primary-600 ${invoice?.businessContext === 'boutique' && invoice?.boutiqueDetails?.transactionType === 'rental' ? 'h-12 w-12' : 'h-8 w-8'}`} />
              )}
            </div>
            
            <div className="mt-2 space-y-1 text-sm">
              {(invoice?.seller?.address?.street || invoice?.seller?.address?.city) && (
                <div className="flex flex-col gap-1">
                  <p className="flex items-start gap-2">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gray-500" />
                    <span>{[invoice.seller.address.street, invoice.seller.address.district, invoice.seller.address.city, invoice.seller.address.country].filter(Boolean).join(', ')}</span>
                  </p>
                  {bilingual && (invoice?.seller?.address?.streetAr || invoice?.seller?.address?.districtAr || invoice?.seller?.address?.cityAr) && (
                    <p className="flex items-start gap-2 text-gray-500" dir="rtl">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{[invoice.seller.address.streetAr, invoice.seller.address.districtAr, invoice.seller.address.cityAr, invoice.seller.address.country].filter(Boolean).join('، ')}</span>
                    </p>
                  )}
                </div>
              )}
              {invoice?.seller?.contactPhone && (
                <p className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-gray-500" />
                  {invoice.seller.contactPhone}
                </p>
              )}
              {invoice?.seller?.contactEmail && (
                <p className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-gray-500" />
                  {invoice.seller.contactEmail}
                </p>
              )}
            </div>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center text-center mt-2">
            <h2 className="text-2xl font-bold tracking-normal text-slate-900 uppercase">
              {sellerName}
            </h2>
            {bilingual && sellerNameAr && (
              <p className="text-2xl font-bold text-slate-900 mt-2" dir="rtl">
                {sellerNameAr}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-4 md:items-end">
            <div className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-medium w-fit ${
              invoice?.businessContext === 'furniture' || window.location.pathname.includes('/furniture')
                ? 'bg-blue-50 text-blue-700 border-blue-200'
                : invoice?.businessContext === 'boutique'
                ? invoice?.boutiqueDetails?.transactionType === 'sale'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-rose-50 text-rose-700 border-rose-200'
                : 'bg-primary-50 text-primary-700'
            }`}>
              <FileText className="mr-2 h-4 w-4" />
              {invoice?.businessContext === 'furniture' || window.location.pathname.includes('/furniture')
                ? L('Furniture Sale Invoice', 'فاتورة بيع مفروشات')
                : invoice?.businessContext === 'boutique'
                ? invoice?.boutiqueDetails?.transactionType === 'sale'
                  ? L('Boutique Sale Invoice', 'فاتورة بيع بوتيك')
                  : L('Boutique Rental Invoice', 'فاتورة إيجار بوتيك')
                : isQuotation
                ? L('Quotation', 'عرض سعر')
                : L('Tax Invoice', 'فاتورة ضريبية')}
            </div>
            
            <div className="mt-2 space-y-1 text-sm text-gray-600 md:text-right">
              {(invoice?.seller?.contactPhone || tenant?.business?.contactPhone || tenant?.phone) && (
                <div className="flex items-center gap-2 md:justify-end mb-2">
                  <span className="font-semibold text-gray-900">Phone:</span>
                  <span className="font-mono">{invoice?.seller?.contactPhone || tenant?.business?.contactPhone || tenant?.phone}</span>
                </div>
              )}
              {(invoice?.seller?.vatNumber || tenant?.business?.vatNumber) && (
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-end gap-2">
                    <span className="font-semibold text-gray-900">VAT No:</span>
                    <span className="font-mono">{invoice?.seller?.vatNumber || tenant?.business?.vatNumber}</span>
                  </div>
                  {bilingual && S('الرقم الضريبي') && (
                    <div className="flex items-center justify-end gap-2" dir={secondaryDir}>
                      <span className="font-semibold text-gray-900">{S('الرقم الضريبي')}:</span>
                      <span className="font-sans">{isArabicSecondary ? toEasternArabicNumerals(invoice?.seller?.vatNumber || tenant?.business?.vatNumber) : (invoice?.seller?.vatNumber || tenant?.business?.vatNumber)}</span>
                    </div>
                  )}
                </div>
              )}
              {(invoice?.seller?.crNumber || tenant?.business?.crNumber) && (
                <div className="flex items-center gap-2 md:justify-end mt-2">
                  <span className="font-semibold text-gray-900">CR No:</span>
                  <span className="font-mono">{invoice?.seller?.crNumber || tenant?.business?.crNumber}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="p-6">
        {/* Bill To & Invoice Details Grid */}
        <div className="mb-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border bg-gray-50 p-3">
            <h3 className="mb-2 flex items-center gap-2 font-semibold text-gray-900 border-b pb-1 text-sm">
              <User className="h-4 w-4 text-primary-600" />
              {L('Bill To', 'الفاتورة إلى')}
            </h3>
            <div className="space-y-1 text-sm text-gray-700">
              <p className="font-bold text-gray-900 text-base">{buyerName}</p>
              {bilingual && buyerNameAr && (
                <p className="font-bold text-gray-500" dir="rtl">{buyerNameAr}</p>
              )}

              <div className="mt-2 space-y-1.5">
                {(invoice?.buyer?.address?.street || invoice?.buyer?.address?.city) && (
                  <div className="flex flex-col gap-1">
                    <p>{[invoice.buyer.address.street, invoice.buyer.address.district, invoice.buyer.address.city, invoice.buyer.address.country].filter(Boolean).join(', ')}</p>
                    {bilingual && (invoice?.buyer?.address?.streetAr || invoice?.buyer?.address?.districtAr || invoice?.buyer?.address?.cityAr) && (
                      <p className="text-gray-500" dir="rtl">{[invoice.buyer.address.streetAr, invoice.buyer.address.districtAr, invoice.buyer.address.cityAr, invoice.buyer.address.country].filter(Boolean).join('، ')}</p>
                    )}
                  </div>
                )}
                {invoice?.buyer?.contactPhone && (
                  <p className="flex items-center gap-2">
                    <Phone className="h-3 w-3 text-gray-400" />
                    {invoice.buyer.contactPhone}
                  </p>
                )}
                {(invoice?.buyer?.idNumber || invoice?.buyer?.customerIdNumber) && (
                  <div className="flex flex-col gap-1">
                    <p className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">{invoice?.buyer?.idType === 'vat' ? 'VAT No' : invoice?.buyer?.idType === 'id' ? 'ID' : 'Iqama'}:</span>
                      <span className="font-mono">{invoice.buyer.idNumber || invoice.buyer.customerIdNumber}</span>
                    </p>
                    {bilingual && (
                      <p className="flex gap-2" dir={secondaryDir}>
                        <span className="font-semibold text-gray-900">
                          {invoice?.buyer?.idType === 'vat' ? S('الرقم الضريبي') : invoice?.buyer?.idType === 'id' ? (isArabicSecondary ? 'الهوية' : 'ID') : (isArabicSecondary ? 'الإقامة' : 'Iqama')}:
                        </span>
                        <span className="font-sans">{isArabicSecondary ? toEasternArabicNumerals(invoice.buyer.idNumber || invoice.buyer.customerIdNumber) : (invoice.buyer.idNumber || invoice.buyer.customerIdNumber)}</span>
                      </p>
                    )}
                  </div>
                )}
                {invoice?.buyer?.vatNumber && (
                  <div className="mt-2 flex flex-col gap-1">
                    <p>
                      <span className="font-semibold text-gray-900">VAT No:</span>{" "}
                      <span className="font-mono">{invoice.buyer.vatNumber}</span>
                    </p>
                    {bilingual && S('الرقم الضريبي') && (
                      <p className="flex gap-2" dir={secondaryDir}>
                        <span className="font-semibold text-gray-900">{S('الرقم الضريبي')}:</span>
                        <span className="font-sans">{isArabicSecondary ? toEasternArabicNumerals(invoice.buyer.vatNumber) : invoice.buyer.vatNumber}</span>
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-xl border bg-gray-50 p-3">
            <h3 className="mb-2 flex items-center gap-2 font-semibold text-gray-900 border-b pb-1 text-sm">
              <Calendar className="h-4 w-4 text-primary-600" />
              {L('Details', 'التفاصيل')}
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
              {!(invoice?.businessContext === 'boutique' && invoice?.boutiqueDetails?.transactionType === 'rental') && (
                <>
                  <hr className="border-gray-200" />
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Due Date:</span>
                    <span className="font-semibold text-gray-900">{formatDate(invoice?.dueDate || invoice?.validUntil)}</span>
                    {bilingual && S('تاريخ الاستحقاق') && <span className="text-gray-500" dir={secondaryDir}>:{S('تاريخ الاستحقاق')}</span>}
                  </div>
                </>
              )}

              {invoice?.businessContext === 'boutique' && invoice?.boutiqueDetails?.transactionType === 'rental' && (
                <>
                  <hr className="border-gray-200" />
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Rental Start:</span>
                    <span className="font-semibold text-gray-900">{formatDate(invoice.boutiqueDetails.startDate)}</span>
                    {bilingual && S('بداية الإيجار') && <span className="text-gray-500" dir={secondaryDir}>:{S('بداية الإيجار')}</span>}
                  </div>
                  <hr className="border-gray-200" />
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Rental End:</span>
                    <span className="font-semibold text-gray-900">{formatDate(invoice.boutiqueDetails.endDate)}</span>
                    {bilingual && S('نهاية الإيجار') && <span className="text-gray-500" dir={secondaryDir}>:{S('نهاية الإيجار')}</span>}
                  </div>
                  <hr className="border-gray-200" />
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Rental Days:</span>
                    <span className="font-semibold text-gray-900">
                      {(() => {
                        const start = new Date(invoice.boutiqueDetails.startDate)
                        const end = new Date(invoice.boutiqueDetails.endDate)
                        const days = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)))
                        return days
                      })()}
                    </span>
                    {bilingual && S('عدد أيام الإيجار') && <span className="text-gray-500" dir={secondaryDir}>:{S('عدد أيام الإيجار')}</span>}
                  </div>
                  <hr className="border-gray-200" />
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Security Deposit:</span>
                    <span className="font-semibold text-gray-900">{renderMoney(toNumber(invoice.boutiqueDetails.totalDeposit))}</span>
                    {bilingual && S('تأمين') && <span className="text-gray-500" dir={secondaryDir}>:{S('تأمين')}</span>}
                  </div>
                  <hr className="border-gray-200" />
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Payment Method:</span>
                    <span className="font-semibold text-gray-900 capitalize">{invoice.boutiqueDetails.paymentMethod === 'card' ? 'Card' : 'Cash'}</span>
                    {bilingual && S('طريقة الدفع') && (
                      <span className="font-semibold text-gray-900" dir={secondaryDir}>
                        {invoice.boutiqueDetails.paymentMethod === 'card' ? (isArabicSecondary ? 'بطاقة' : 'Card') : (isArabicSecondary ? 'نقدي' : 'Cash')}:{S('طريقة الدفع')}
                      </span>
                    )}
                  </div>
                  <hr className="border-gray-200" />
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Amount Paid:</span>
                    <span className="font-semibold text-gray-900">{renderMoney(toNumber(invoice.boutiqueDetails.amountPaid))}</span>
                    {bilingual && S('المبلغ المدفوع') && <span className="text-gray-500" dir={secondaryDir}>:{S('المبلغ المدفوع')}</span>}
                  </div>
                  {toNumber(invoice.boutiqueDetails.amountPaid) < toNumber(invoice.grandTotal) && (
                    <>
                      <hr className="border-gray-200" />
                      <div className="flex justify-between items-center">
                        <span className="text-gray-500">Pending Amount:</span>
                        <span className="font-semibold text-rose-600">{renderMoney(toNumber(invoice.grandTotal) - toNumber(invoice.boutiqueDetails.amountPaid))}</span>
                        {bilingual && S('المبلغ المتبقي') && <span className="text-gray-500" dir={secondaryDir}>:{S('المبلغ المتبقي')}</span>}
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="mb-4 overflow-hidden rounded-xl border border-gray-200">
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
                    <td className="px-4 py-4 font-medium text-gray-900">{index + 1}</td>
                    <td className="px-4 py-4 max-w-xs">
                      <div>
                        <p className="font-medium text-gray-900 whitespace-pre-wrap">{productNameEn}</p>
                        {bilingual && productNameAr && (
                          <p className="text-sm text-gray-500 mt-1 whitespace-pre-wrap" dir="rtl">
                            {productNameAr}
                          </p>
                        )}
                      </div>
                    </td>
                    {isBoutiqueRental ? (
                      <td className="px-4 py-4 text-center">
                        <div>{item.rentalDays || item.quantity || 1}</div>
                        {(item?.unitCode || item?.raw?.unitCode) && <div className="text-[10px] text-gray-500 font-semibold mt-1">{getUomLabel(item?.unitCode || item?.raw?.unitCode, language)}</div>}
                      </td>
                    ) : (
                      <td className="px-4 py-4 text-center">
                        <div>{item.quantity}</div>
                        {(item?.unitCode || item?.raw?.unitCode) && <div className="text-[10px] text-gray-500 font-semibold mt-1">{getUomLabel(item?.unitCode || item?.raw?.unitCode, language)}</div>}
                      </td>
                    )}
                    <td className="px-4 py-4 text-right font-mono text-gray-900">
                      {renderMoney(toNumber(item.unitPrice))}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex flex-col items-end">
                        <span className="font-mono text-gray-900">
                          {renderMoney(toNumber(item.taxAmount))}
                        </span>
                        <span className="text-xs text-gray-500 mt-0.5">
                          ({item.taxRate}%)
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right font-mono font-bold text-gray-900">
                      {renderMoney(toNumber(item.lineTotalWithTax))}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Footer Summary & Notes */}
        <div className="flex flex-col gap-4 md:flex-row">
          {(invoice?.notes || invoice?.notesAr || invoice?.paymentMethod) && (
            <div className="flex-1 rounded-xl border bg-gray-50 p-3">
              {(invoice?.notes || invoice?.notesAr) && (
                <>
                  <h4 className="mb-2 font-semibold text-gray-900 border-b pb-1 text-sm">{L('Notes', 'ملاحظات')}</h4>
                  <p className="text-sm text-gray-600 whitespace-pre-wrap">{invoice?.notes || '—'}</p>
                  {bilingual && invoice?.notesAr && (
                    <p className="mt-2 text-sm text-gray-600 whitespace-pre-wrap" dir="rtl">{invoice?.notesAr}</p>
                  )}
                </>
              )}

              {invoice?.paymentMethod && (
                <>
                  {(invoice?.notes || invoice?.notesAr) && <hr className="my-3 border-gray-200" />}
                  <div className="flex items-center gap-2 text-sm">
                    <CreditCard className="h-4 w-4 text-gray-400" />
                    <span className="font-semibold text-gray-900">Payment Method:</span>
                    <span className="text-gray-700">{invoice.paymentMethod}</span>
                  </div>
                </>
              )}

              {tenant?.business?.bankDetails?.bankName && (
                <>
                  {(invoice?.notes || invoice?.notesAr || invoice?.paymentMethod) && <hr className="my-3 border-gray-200" />}
                  <div className="text-sm space-y-1 text-gray-700">
                    <h4 className="font-semibold text-gray-900 border-b pb-1 mb-2">{L('Bank Details', 'بيانات البنك')}</h4>
                    <p><span className="font-medium text-gray-900">Bank:</span> {tenant.business.bankDetails.bankName}</p>
                    {tenant.business.bankDetails.accountName && <p><span className="font-medium text-gray-900">Account:</span> {tenant.business.bankDetails.accountName}</p>}
                    {tenant.business.bankDetails.accountNumber && <p><span className="font-medium text-gray-900">Acc No:</span> {tenant.business.bankDetails.accountNumber}</p>}
                    {tenant.business.bankDetails.iban && <p><span className="font-medium text-gray-900">IBAN:</span> {tenant.business.bankDetails.iban}</p>}
                  </div>
                </>
              )}
            </div>
          )}

          <div className="w-full rounded-xl border bg-gray-50 p-3 md:w-80">
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <div className="flex flex-col">
                  <span className="text-gray-500">Subtotal</span>
                  {bilingual && S('المجموع الفرعي') && <span className="text-xs text-gray-400" dir={secondaryDir}>{S('المجموع الفرعي')}</span>}
                </div>
                <span className="font-mono font-semibold text-gray-900">
                  {renderMoney(totals.subtotal)}
                </span>
              </div>
              <hr className="border-gray-200" />
              
              <div className="flex justify-between text-sm">
                <div className="flex flex-col">
                  <span className="text-gray-500">VAT Total</span>
                  {bilingual && S('إجمالي الضريبة') && <span className="text-xs text-gray-400" dir={secondaryDir}>{S('إجمالي الضريبة')}</span>}
                </div>
                <span className="font-mono font-semibold text-gray-900">
                  {renderMoney(totals.totalTax)}
                </span>
              </div>
              <hr className="border-gray-200" />

              {invoice?.businessContext === 'boutique' && invoice?.boutiqueDetails?.transactionType === 'rental' && toNumber(invoice.boutiqueDetails.totalDeposit) > 0 && (
                <>
                  <div className="flex justify-between text-sm">
                    <div className="flex flex-col">
                      <span className="text-gray-500">Security Deposit</span>
                      {bilingual && S('تأمين') && <span className="text-xs text-gray-400" dir={secondaryDir}>{S('تأمين')}</span>}
                    </div>
                    <span className="font-mono font-semibold text-gray-900">
                      {renderMoney(toNumber(invoice.boutiqueDetails.totalDeposit))}
                    </span>
                  </div>
                  <hr className="border-gray-200" />
                </>
              )}
              
              <div className="flex justify-between rounded-lg bg-primary-100/50 p-3 border border-primary-100">
                <div className="flex flex-col">
                  <span className="font-bold text-gray-900">Total</span>
                  {bilingual && S('الإجمالي') && <span className="text-xs font-semibold text-gray-600" dir={secondaryDir}>{S('الإجمالي')}</span>}
                </div>
                <span className="font-mono text-xl font-bold text-primary-700">
                  {renderMoney(totals.grandTotal)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Amount In Words & ZATCA QR */}
        <div className="mt-4 flex flex-col md:flex-row gap-4">
          <div className="flex-1 rounded-xl border border-dashed border-gray-300 bg-gray-50/50 p-3">
            <div className="flex items-start gap-3">
              <Hash className="mt-0.5 h-5 w-5 shrink-0 text-gray-400" />
              <div className="flex-1 text-sm text-gray-600">
                <p className="mb-1 font-semibold text-gray-900">
                  {L('Amount in Words', 'المبلغ كتابةً')}
                </p>
                <p className="font-medium text-gray-800">{getAmountInWords(totals.grandTotal, currency, 'en')}</p>
                {bilingual && resolvedSecondary && resolvedSecondary !== 'bn' && (
                  <p dir={secondaryDir} className="mt-1 font-medium text-gray-800">
                    {getAmountInWords(totals.grandTotal, currency, resolvedSecondary)}
                  </p>
                )}
              </div>
            </div>
          </div>

          {!isQuotation && isZatcaApplicable && (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50/50 p-3 w-full md:w-56">
              <QRCodeSVG value={qrValue} size={100} bgColor="transparent" fgColor="#111827" />
              <p className="mt-2 text-xs text-center text-gray-500">ZATCA Compliant QR</p>
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
        <DocumentExtras invoice={invoice} invoiceBranding={invoiceBranding} language={language} bilingual={bilingual} />
      </div>
      </div>
    </div>
  )
}
