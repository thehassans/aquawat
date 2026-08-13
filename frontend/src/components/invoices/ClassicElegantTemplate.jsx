import React from 'react'
import DocumentExtras from './DocumentExtras'
import { getCommercialCounterpartyLabel, getCommercialDocumentTitle, resolveCommercialDocumentNumber, shouldShowZatcaQr } from '../../lib/commercialDocumentLabels'
import { QRCodeSVG } from 'qrcode.react'
import { generateZatcaQrValue } from '../../lib/zatcaQr'
import { getUomLabel } from '../../lib/uomOptions'
import { calculateInvoiceSummary, toNumber } from '../../lib/invoiceDocument'
import { getInvoiceBranding } from '../../lib/invoiceBranding'
import { formatCurrencyAmount } from '../../lib/currency'
import { getAmountInWords } from '../../lib/amountInWords'
import { Building2 } from 'lucide-react'

const hasArabicText = (value = '') => /[\u0600-\u06FF]/.test(String(value || ''))

export default function ClassicElegantTemplate({ invoice, tenant, language = 'en', bilingual = false, documentType = 'invoice' }) {
  const currency = invoice?.currency || tenant?.settings?.currency || 'SAR'
  const invoiceBranding = getInvoiceBranding(tenant, language, invoice?.businessContext)
  
  const sellerNameEn = invoice?.seller?.name || invoice?.seller?.nameAr || tenant?.business?.legalNameEn || tenant?.business?.legalNameAr || ''
  const sellerNameAr = invoice?.seller?.nameAr || (hasArabicText(invoice?.seller?.name) ? invoice?.seller?.name : '') || tenant?.business?.legalNameAr || ''
  const buyerNameEn = invoice?.buyer?.name || invoice?.buyer?.nameAr || 'Cash Customer'
  const buyerNameAr = invoice?.buyer?.nameAr || (hasArabicText(invoice?.buyer?.name) ? invoice?.buyer?.name : '')
  
  const sellerName = bilingual ? sellerNameEn : (language === 'ar' ? (sellerNameAr || sellerNameEn) : (sellerNameEn || sellerNameAr))
  const buyerName = bilingual ? buyerNameEn : (language === 'ar' ? (buyerNameAr || buyerNameEn) : (buyerNameEn || buyerNameAr))

  const logoSrc = invoiceBranding.logoSrc
  
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
  
  const documentNumber = resolveCommercialDocumentNumber(invoice, documentType)
  
  const formatDate = (dateString, locale = 'en-SA') => {
    if (!dateString) return '—'
    return new Date(dateString).toLocaleDateString(locale, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
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
    return (
      <span className="inline-flex items-center gap-[0.3em] whitespace-nowrap">
        <span className="tabular-nums">{amount}</span>
        <span className="text-[0.85em] font-medium">{currency}</span>
      </span>
    )
  }

  const invoiceTitle = getCommercialDocumentTitle(documentType, language)

  return (
    <div dir="ltr" className="mx-auto max-w-5xl bg-white border-double border-[6px] border-amber-900 shadow-2xl p-8 font-serif" style={{ fontFamily: '"Times New Roman", Times, "Almarai", serif' }}>
      
      {/* Header */}
      <div className="flex justify-between items-start border-b-2 border-amber-900 pb-6 mb-6">
        <div className="w-1/3">
          {logoSrc ? (
            <img src={logoSrc} alt="Logo" className="h-20 object-contain" />
          ) : (
            <Building2 className="h-12 w-12 text-amber-900" />
          )}
        </div>
        
        <div className="w-1/3 text-center">
          <h1 className="text-3xl font-bold tracking-widest text-amber-900 uppercase">{invoiceTitle}</h1>
          <p className="text-lg font-semibold mt-2">#{documentNumber}</p>
          <p className="text-sm text-amber-800">{formatDate(invoice?.issueDate || new Date(), 'en-GB')}</p>
        </div>
        
        <div className="w-1/3 text-right">
          <h2 className="text-xl font-bold text-amber-900">{sellerNameEn}</h2>
          {bilingual && <h2 className="text-lg font-bold text-amber-900" dir="rtl">{sellerNameAr}</h2>}
          <div className="mt-2 text-sm text-gray-700">
            {invoice?.seller?.vatNumber && <p>VAT: {invoice.seller.vatNumber}</p>}
            {invoice?.seller?.crNumber && <p>CR: {invoice.seller.crNumber}</p>}
          </div>
        </div>
      </div>

      {/* Bill To & QR */}
      <div className="flex justify-between items-start mb-8">
        <div className="w-1/2">
          <p className="text-sm font-semibold text-amber-900 uppercase tracking-widest mb-2 border-b border-amber-200 pb-1 inline-block">{getCommercialCounterpartyLabel(documentType, 'en')}</p>
          <h3 className="text-lg font-bold text-gray-900">{buyerNameEn}</h3>
          {bilingual && <h3 className="text-lg font-bold text-gray-900 mt-1" dir="rtl">{buyerNameAr}</h3>}
          <div className="mt-2 text-sm text-gray-700">
            {invoice?.buyer?.vatNumber && <p>VAT: {invoice.buyer.vatNumber}</p>}
            {invoice?.buyer?.contactPhone && <p>Tel: {invoice.buyer.contactPhone}</p>}
          </div>
        </div>
        
        {shouldShowZatcaQr(documentType) && qrValue && (
          <div className="w-32 h-32 p-2 border-2 border-amber-900">
            <QRCodeSVG value={qrValue} size="100%" bgColor="transparent" fgColor="#451a03" />
          </div>
        )}
      </div>

      {/* Line Items */}
      <table className="w-full text-left mb-8 border-collapse">
        <thead>
          <tr className="border-y-2 border-amber-900 text-amber-900 bg-amber-50/30">
            <th className="py-3 px-2 font-bold w-12 text-center">#</th>
            <th className="py-3 px-2 font-bold">Item Description</th>
            <th className="py-3 px-2 font-bold text-center w-24">Qty</th>
            <th className="py-3 px-2 font-bold text-right w-32">Unit Price</th>
            <th className="py-3 px-2 font-bold text-right w-32">Tax</th>
            <th className="py-3 px-2 font-bold text-right w-32">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-amber-100">
          {lineItems.map((item, idx) => (
            <tr key={idx}>
              <td className="py-4 px-2 text-center text-sm">{idx + 1}</td>
              <td className="py-4 px-2">
                <p className="font-bold text-gray-900">{item.productName || item.raw?.productName}</p>
                {bilingual && <p className="text-sm text-gray-600 mt-1" dir="rtl">{item.productNameAr || item.raw?.productNameAr}</p>}
              </td>
              <td className="py-4 px-2 text-center text-sm">
                <div>{item.quantity}</div>
                {(item?.unitCode || item?.raw?.unitCode) && <div className="text-[10px] text-gray-500 mt-1">{getUomLabel(item?.unitCode || item?.raw?.unitCode, language)}</div>}
              </td>
              <td className="py-4 px-2 text-right text-sm">{renderMoney(item.unitPrice)}</td>
              <td className="py-4 px-2 text-right text-sm">{renderMoney(item.taxAmount)}</td>
              <td className="py-4 px-2 text-right font-bold">{renderMoney(item.lineTotalWithTax)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals & Amount in Words */}
      <div className="flex justify-between items-start pt-6 border-t-2 border-amber-900">
        <div className="w-1/2 pr-8">
          <p className="text-sm font-semibold text-amber-900 uppercase tracking-widest mb-2 border-b border-amber-200 pb-1 inline-block">Amount in Words</p>
          <p className="text-gray-800 font-bold italic">{getAmountInWords(totals.grandTotal, currency, 'en')}</p>
          {bilingual && <p className="text-gray-800 font-bold mt-2 leading-relaxed" dir="rtl">{getAmountInWords(totals.grandTotal, currency, 'ar')}</p>}
        </div>
        
        <div className="w-1/2 max-w-sm">
          <div className="flex justify-between py-2 text-gray-700">
            <span>Subtotal</span>
            <span>{renderMoney(totals.subtotal)}</span>
          </div>
          <div className="flex justify-between py-2 text-gray-700">
            <span>Discount</span>
            <span>{renderMoney(totals.totalDiscount)}</span>
          </div>
          <div className="flex justify-between py-2 text-gray-700 border-b border-amber-200">
            <span>VAT (15%)</span>
            <span>{renderMoney(totals.totalTax)}</span>
          </div>
          <div className="flex justify-between py-4 text-2xl font-bold text-amber-900">
            <span>Total</span>
            <span>{renderMoney(totals.grandTotal)}</span>
          </div>
        </div>
      </div>

      {/* Document Extras & Unified Signatory */}
      <DocumentExtras invoice={invoice} invoiceBranding={invoiceBranding} language={language} bilingual={bilingual} />
    </div>
  )
}
