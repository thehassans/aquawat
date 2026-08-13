import React from 'react'
import DocumentExtras from './DocumentExtras'
import { getCommercialCounterpartyLabel, getCommercialDocumentNumberLabel, getCommercialDocumentTitle, resolveCommercialDocumentNumber, shouldShowZatcaQr } from '../../lib/commercialDocumentLabels'
import { QRCodeSVG } from 'qrcode.react'
import { generateZatcaQrValue } from '../../lib/zatcaQr'
import { getUomLabel } from '../../lib/uomOptions'
import { calculateInvoiceSummary, toNumber } from '../../lib/invoiceDocument'
import { getInvoiceBranding } from '../../lib/invoiceBranding'
import { formatCurrencyAmount } from '../../lib/currency'
import { getAmountInWords } from '../../lib/amountInWords'

const hasArabicText = (value = '') => /[\u0600-\u06FF]/.test(String(value || ''))

export default function SignatureTemplate({ invoice, tenant, language = 'en', bilingual = false, documentType = 'invoice' }) {
  const currency = invoice?.currency || tenant?.settings?.currency || 'SAR'
  const invoiceBranding = getInvoiceBranding(tenant, language, invoice?.businessContext)
  
  const primaryColor = invoiceBranding.primaryColor || '#0f172a'
  
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
  
  const formatDate = (dateString, locale = 'en-US') => {
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
    return (
      <span className="inline-flex items-center gap-[0.3em] whitespace-nowrap">
        <span className="tabular-nums font-serif tracking-tight">{amount}</span>
        <span className="text-[0.6em] text-slate-500 font-sans tracking-widest">{currency}</span>
      </span>
    )
  }

  const invoiceTitleEn = getCommercialDocumentTitle(documentType, 'en')
  const invoiceTitleAr = getCommercialDocumentTitle(documentType, 'ar')

  return (
    <div dir="ltr" className="mx-auto max-w-5xl bg-white border border-slate-200 overflow-hidden font-serif rounded-lg shadow-xl relative">
      
      {/* Decorative Signature Line */}
      <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-transparent via-slate-800 to-transparent opacity-20"></div>

      <div className="p-16">
        
        {/* Header Section */}
        <div className="flex justify-between items-start mb-16 border-b border-slate-200 pb-12">
          <div className="flex-1">
            <h1 className="text-4xl font-normal text-slate-900 tracking-wider uppercase mb-2">
              {invoiceTitleEn}
            </h1>
            {bilingual && <h1 className="text-2xl font-normal text-slate-600 mt-2 tracking-wider" dir="rtl">{invoiceTitleAr}</h1>}
            <div className="mt-8 flex gap-12">
              <div>
                <p className="text-[9px] text-slate-400 uppercase tracking-[0.2em] font-sans mb-1">{getCommercialDocumentNumberLabel(documentType, 'en')}</p>
                <p className="text-base font-serif text-slate-900">{documentNumber}</p>
              </div>
              <div>
                <p className="text-[9px] text-slate-400 uppercase tracking-[0.2em] font-sans mb-1">Date Issued</p>
                <p className="text-base font-serif text-slate-900">{formatDate(invoice?.issueDate || new Date())}</p>
              </div>
            </div>
          </div>

          <div className="flex-1 flex flex-col items-end text-right">
            {logoSrc ? (
              <img src={logoSrc} alt="Logo" className="h-16 object-contain mb-6" />
            ) : (
              <div className="h-16 w-16 bg-slate-50 border border-slate-100 mb-6 flex items-center justify-center">
                 <span className="text-xs font-sans text-slate-400 uppercase tracking-widest">Logo</span>
              </div>
            )}
            <h2 className="text-xl font-normal text-slate-900 tracking-wide">{sellerNameEn}</h2>
            {bilingual && sellerNameAr && <h2 className="text-lg font-normal text-slate-600 mt-1" dir="rtl">{sellerNameAr}</h2>}
            <div className="mt-4 text-xs font-sans text-slate-500 tracking-wide space-y-1">
              {invoice?.seller?.vatNumber && <p>VAT Registration: {invoice.seller.vatNumber}</p>}
              {invoice?.seller?.crNumber && <p>Commercial Registry: {invoice.seller.crNumber}</p>}
            </div>
          </div>
        </div>

        {/* Bill To & QR */}
        <div className="flex justify-between items-start mb-16">
          <div className="w-1/2">
            <h3 className="text-[9px] text-slate-400 uppercase tracking-[0.2em] font-sans mb-4 border-b border-slate-100 pb-2 w-fit">{getCommercialCounterpartyLabel(documentType, 'en')}</h3>
            <p className="text-2xl font-normal text-slate-900 mb-1">{buyerNameEn}</p>
            {bilingual && buyerNameAr && <p className="text-xl font-normal text-slate-600 mb-2" dir="rtl">{buyerNameAr}</p>}
            {invoice?.buyer?.vatNumber && <p className="text-sm font-sans text-slate-500 mt-2">VAT: {invoice.buyer.vatNumber}</p>}
          </div>
          <div>
             {shouldShowZatcaQr(documentType) && qrValue && (
                <div className="p-1 border border-slate-200 bg-white">
                  <QRCodeSVG value={qrValue} size={90} bgColor="#ffffff" fgColor={primaryColor} />
                </div>
              )}
          </div>
        </div>

        {/* Table */}
        <div className="mb-16">
          <table className="min-w-full">
            <thead>
              <tr className="border-y border-slate-200">
                <th className="py-4 text-left text-[9px] font-sans text-slate-400 uppercase tracking-[0.2em] font-normal w-12">Item</th>
                <th className="py-4 text-left text-[9px] font-sans text-slate-400 uppercase tracking-[0.2em] font-normal">Description</th>
                <th className="py-4 text-center text-[9px] font-sans text-slate-400 uppercase tracking-[0.2em] font-normal w-24">Qty</th>
                <th className="py-4 text-right text-[9px] font-sans text-slate-400 uppercase tracking-[0.2em] font-normal w-32">Rate</th>
                <th className="py-4 text-right text-[9px] font-sans text-slate-400 uppercase tracking-[0.2em] font-normal w-32">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 border-b border-slate-200">
              {lineItems.map((line, idx) => {
                const productNameEn = line?.raw?.productName || line?.productName || '—'
                const productNameAr = line?.raw?.productNameAr || line?.productNameAr || ''
                return (
                  <tr key={idx}>
                    <td className="py-5 whitespace-nowrap text-sm font-sans text-slate-400">{String(idx + 1).padStart(2, '0')}</td>
                    <td className="py-5 pr-8">
                      <p className="text-base font-normal text-slate-900">{productNameEn}</p>
                      {bilingual && productNameAr && <p className="text-sm font-normal text-slate-500 mt-1" dir="rtl">{productNameAr}</p>}
                    </td>
                    <td className="py-5 whitespace-nowrap text-sm font-sans text-center text-slate-500">
                      <div>{toNumber(line?.quantity) || '—'}</div>
                      {(line?.unitCode || line?.raw?.unitCode) && <div className="text-[10px] text-slate-400 mt-1">{getUomLabel(line?.unitCode || line?.raw?.unitCode, language)}</div>}
                    </td>
                    <td className="py-5 whitespace-nowrap text-right text-slate-700">{renderMoney(line?.unitPrice)}</td>
                    <td className="py-5 whitespace-nowrap text-right text-slate-900">{renderMoney(line?.lineTotalWithTax)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="flex justify-end mb-16">
          <div className="w-1/2">
            <div className="flex justify-between py-3 border-b border-slate-100">
              <span className="text-[10px] font-sans text-slate-500 uppercase tracking-[0.2em]">Subtotal</span>
              <span className="text-slate-700">{renderMoney(totals.subtotal)}</span>
            </div>
            <div className="flex justify-between py-3 border-b border-slate-100">
              <span className="text-[10px] font-sans text-slate-500 uppercase tracking-[0.2em]">VAT (15%)</span>
              <span className="text-slate-700">{renderMoney(totals.totalTax)}</span>
            </div>
            <div className="flex justify-between py-6 mt-2 border-y border-slate-200">
              <span className="text-sm font-sans text-slate-900 uppercase tracking-[0.2em] font-medium">Total Due</span>
              <span className="text-2xl font-normal text-slate-900">{renderMoney(totals.grandTotal)}</span>
            </div>
          </div>
        </div>

        {/* Document Extras & Unified Signatory */}
        <DocumentExtras invoice={invoice} invoiceBranding={invoiceBranding} language={language} bilingual={bilingual} />

        {/* Footer */}
        <div className="text-center mt-10">
          <div className="w-12 h-[1px] bg-slate-300 mx-auto mb-6"></div>
          <p className="text-[10px] font-sans text-slate-400 tracking-[0.2em] uppercase">
            {invoiceBranding.footerText || 'Thank you for your business'}
          </p>
        </div>
      </div>
    </div>
  )
}
