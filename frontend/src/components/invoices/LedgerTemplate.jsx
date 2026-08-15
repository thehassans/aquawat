import React from 'react'
import DocumentExtras from './DocumentExtras'
import { getCommercialCounterpartyLabel, getCommercialDocumentNumberLabel, getCommercialDocumentTitle, resolveCommercialDocumentNumber, shouldShowZatcaQr } from '../../lib/commercialDocumentLabels'
import { QRCodeSVG } from 'qrcode.react'
import { resolveTaxInvoiceQr } from '../../lib/taxInvoiceQr'
import { getUomLabel } from '../../lib/uomOptions'
import { calculateInvoiceSummary, toNumber } from '../../lib/invoiceDocument'
import { getInvoiceBranding } from '../../lib/invoiceBranding'
import { formatCurrencyAmount } from '../../lib/currency'
import { getAmountInWords } from '../../lib/amountInWords'
import ProductTypeMark from './ProductTypeMark'

const hasArabicText = (value = '') => /[\u0600-\u06FF]/.test(String(value || ''))

export default function LedgerTemplate({ invoice, tenant, language = 'en', bilingual = false, documentType = 'invoice' }) {
  const currency = invoice?.currency || tenant?.settings?.currency || 'SAR'
  const invoiceBranding = getInvoiceBranding(tenant, language, invoice?.businessContext)
  
  const primaryColor = invoiceBranding.primaryColor || '#1e293b'
  
  const sellerNameEn = invoice?.seller?.name || invoice?.seller?.nameAr || tenant?.business?.legalNameEn || tenant?.business?.legalNameAr || ''
  const sellerNameAr = invoice?.seller?.nameAr || (hasArabicText(invoice?.seller?.name) ? invoice?.seller?.name : '') || tenant?.business?.legalNameAr || ''
  const buyerNameEn = invoice?.buyer?.name || invoice?.buyer?.nameAr || 'Cash Customer'
  const buyerNameAr = invoice?.buyer?.nameAr || (hasArabicText(invoice?.buyer?.name) ? invoice?.buyer?.name : '')
  
  const sellerName = bilingual ? sellerNameEn : (language === 'ar' ? (sellerNameAr || sellerNameEn) : (sellerNameEn || sellerNameAr))
  const buyerName = bilingual ? buyerNameEn : (language === 'ar' ? (buyerNameAr || buyerNameEn) : (buyerNameEn || buyerNameAr))

  const logoSrc = invoiceBranding.logoSrc
  
  const qrValue = resolveTaxInvoiceQr({
    invoice,
    tenant,
    currency,
    sellerName: sellerNameEn || sellerNameAr,
    vatNumber: invoice?.seller?.vatNumber || tenant?.business?.vatNumber,
  })

  const totals = calculateInvoiceSummary(invoice)
  const lineItems = totals.lines.length > 0 ? totals.lines : [{ raw: { productName: language === 'ar' ? 'خدمة' : 'Service' }, quantity: 1, unitPrice: 0, taxAmount: 0, lineTotalWithTax: 0 }]
  
  const documentNumber = resolveCommercialDocumentNumber(invoice, documentType)
  
  const formatDate = (dateString, locale = 'en-US') => {
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
        <span className="tabular-nums font-medium">{amount}</span>
        <span className="text-[0.8em] font-medium">{currency}</span>
      </span>
    )
  }

  const invoiceTitleEn = getCommercialDocumentTitle(documentType, 'en', { uppercase: true })
  const invoiceTitleAr = getCommercialDocumentTitle(documentType, 'ar')

  return (
    <div dir="ltr" className="mx-auto max-w-5xl bg-white border border-slate-300 font-sans shadow-md rounded-none">
      
      {/* Header Banner */}
      <div className="flex bg-slate-100 border-b border-slate-300">
        <div className="flex-1 p-6 border-r border-slate-300 flex items-center gap-4">
          {logoSrc && (
            <img src={logoSrc} alt="Logo" className="h-14 object-contain" />
          )}
          <div>
            <h2 className="text-xl font-bold text-slate-800 uppercase tracking-tight">{sellerNameEn}</h2>
            {bilingual && sellerNameAr && <h2 className="text-lg font-bold text-slate-800" dir="rtl">{sellerNameAr}</h2>}
          </div>
        </div>
        <div className="w-1/3 p-6 flex flex-col justify-center items-end" style={{ backgroundColor: primaryColor }}>
          <h1 className="text-3xl font-bold tracking-widest text-white uppercase">{invoiceTitleEn}</h1>
          {bilingual && <h1 className="text-xl font-bold text-white mt-1 uppercase" dir="rtl">{invoiceTitleAr}</h1>}
        </div>
      </div>

      {/* Meta Grid */}
      <div className="flex border-b border-slate-300">
        <div className="w-1/2 p-6 border-r border-slate-300">
          <table className="w-full text-sm">
            <tbody>
              <tr>
                <td className="py-1 font-bold text-slate-600 uppercase w-32">{getCommercialDocumentNumberLabel(documentType, 'en')}:</td>
                <td className="py-1 font-medium text-slate-900">{documentNumber}</td>
              </tr>
              <tr>
                <td className="py-1 font-bold text-slate-600 uppercase">Date:</td>
                <td className="py-1 font-medium text-slate-900">{formatDate(invoice?.issueDate || new Date())}</td>
              </tr>
              {invoice?.dueDate && (
                <tr>
                  <td className="py-1 font-bold text-slate-600 uppercase">Due Date:</td>
                  <td className="py-1 font-medium text-slate-900">{formatDate(invoice.dueDate)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="w-1/2 p-6 flex justify-between items-center bg-slate-50">
          <table className="text-sm">
            <tbody>
              <tr>
                <td className="py-1 font-bold text-slate-600 uppercase w-32">Seller VAT:</td>
                <td className="py-1 font-medium text-slate-900">{invoice?.seller?.vatNumber || tenant?.business?.vatNumber || '—'}</td>
              </tr>
              <tr>
                <td className="py-1 font-bold text-slate-600 uppercase">Seller CR:</td>
                <td className="py-1 font-medium text-slate-900">{invoice?.seller?.crNumber || '—'}</td>
              </tr>
            </tbody>
          </table>
          {shouldShowZatcaQr(documentType) && qrValue && (
            <div className="p-1 border border-slate-300 bg-white shadow-sm">
              <QRCodeSVG value={qrValue} size={64} bgColor="#ffffff" fgColor="#1e293b" />
            </div>
          )}
        </div>
      </div>

      {/* Bill To */}
      <div className="p-6 border-b border-slate-300 bg-slate-50/50">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 border-b border-slate-200 pb-1 w-fit">{getCommercialCounterpartyLabel(documentType, 'en')}</h3>
        <p className="text-base font-bold text-slate-900">{buyerNameEn}</p>
        {bilingual && buyerNameAr && <p className="text-sm font-bold text-slate-900 mt-1" dir="rtl">{buyerNameAr}</p>}
        {invoice?.buyer?.vatNumber && <p className="text-sm text-slate-700 mt-2">VAT: {invoice.buyer.vatNumber}</p>}
      </div>

      {/* Table */}
      <div>
        <table className="min-w-full divide-y border-b border-slate-300">
          <thead style={{ backgroundColor: primaryColor }}>
            <tr>
              <th className="px-4 py-3 text-left text-xs font-bold text-white uppercase tracking-wider border-r border-white/20 w-12">#</th>
              <th className="px-4 py-3 text-left text-xs font-bold text-white uppercase tracking-wider border-r border-white/20">Description</th>
              <th className="px-4 py-3 text-center text-xs font-bold text-white uppercase tracking-wider border-r border-white/20 w-24">Qty</th>
              <th className="px-4 py-3 text-right text-xs font-bold text-white uppercase tracking-wider border-r border-white/20 w-32">Unit Price</th>
              <th className="px-4 py-3 text-right text-xs font-bold text-white uppercase tracking-wider border-r border-white/20 w-32">Tax</th>
              <th className="px-4 py-3 text-right text-xs font-bold text-white uppercase tracking-wider w-32">Total</th>
            </tr>
          </thead>
          <tbody className="bg-white">
            {lineItems.map((line, idx) => {
              const productNameEn = line?.raw?.productName || line?.productName || '—'
              const productNameAr = line?.raw?.productNameAr || line?.productNameAr || ''
              return (
                <tr key={idx} className="even:bg-slate-50 border-b border-slate-200">
                  <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-500 border-r border-slate-200">{idx + 1}</td>
                  <td className="px-4 py-3 border-r border-slate-200">
                    <p className="text-sm font-semibold text-slate-900">{productNameEn}</p>
                    {bilingual && productNameAr && <p className="text-xs text-slate-600 mt-1" dir="rtl">{productNameAr}</p>}
                    <ProductTypeMark line={line} language={language} bilingual={bilingual} />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-slate-700 border-r border-slate-200">
                    <div>{toNumber(line?.quantity) || '—'}</div>
                    {(line?.unitCode || line?.raw?.unitCode) && <div className="text-[10px] text-slate-500 mt-0.5">{getUomLabel(line?.unitCode || line?.raw?.unitCode, language)}</div>}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right border-r border-slate-200">{renderMoney(line?.unitPrice)}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-right border-r border-slate-200">{renderMoney(line?.taxAmount)}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-right font-medium text-slate-900">{renderMoney(line?.lineTotalWithTax)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Totals */}
      <div className="flex">
        <div className="w-1/2 p-6 border-r border-slate-300 flex items-end">
          <div className="w-full">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 border-b border-slate-200 pb-1">Amount in Words</h3>
            <p className="text-sm font-medium text-slate-700 capitalize">{getAmountInWords(totals.grandTotal, currency)}</p>
          </div>
        </div>
        <div className="w-1/2">
          <table className="w-full">
            <tbody>
              <tr className="border-b border-slate-200 bg-slate-50">
                <td className="px-6 py-3 text-sm font-bold text-slate-600 uppercase tracking-widest border-r border-slate-200">Subtotal</td>
                <td className="px-6 py-3 text-right font-medium text-slate-900">{renderMoney(totals.subtotal)}</td>
              </tr>
              <tr className="border-b border-slate-200 bg-slate-50">
                <td className="px-6 py-3 text-sm font-bold text-slate-600 uppercase tracking-widest border-r border-slate-200">VAT (15%)</td>
                <td className="px-6 py-3 text-right font-medium text-slate-900">{renderMoney(totals.totalTax)}</td>
              </tr>
              <tr className="bg-slate-100">
                <td className="px-6 py-4 text-base font-bold text-slate-900 uppercase tracking-widest border-r border-slate-200">Total Due</td>
                <td className="px-6 py-4 text-right text-lg font-bold text-slate-900">{renderMoney(totals.grandTotal)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Document Extras & Unified Signatory */}
      <div className="p-6 border-b border-slate-300">
        <DocumentExtras invoice={invoice} invoiceBranding={invoiceBranding} language={language} bilingual={bilingual} />
      </div>

      {/* Footer */}
      <div className="p-4 bg-slate-800 text-center">
        <p className="text-xs font-medium text-slate-300 tracking-widest uppercase">
          {invoiceBranding.footerText || 'Thank you for your business!'}
        </p>
      </div>
    </div>
  )
}
