import React from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { resolveTaxInvoiceQr } from '../../lib/taxInvoiceQr'
import { getUomLabel } from '../../lib/uomOptions'
import { calculateInvoiceSummary, toNumber } from '../../lib/invoiceDocument'
import { getInvoiceBranding } from '../../lib/invoiceBranding'
import { formatCurrencyAmount } from '../../lib/currency'
import { getAmountInWords } from '../../lib/amountInWords'
import { Building2 } from 'lucide-react'
import DocumentExtras from './DocumentExtras'
import { getCommercialCounterpartyLabel, getCommercialDocumentNumberLabel, getCommercialDocumentTitle, resolveCommercialDocumentNumber, shouldShowZatcaQr } from '../../lib/commercialDocumentLabels'

const hasArabicText = (value = '') => /[\u0600-\u06FF]/.test(String(value || ''))

export default function MonoTemplate({ invoice, tenant, language = 'en', bilingual = false, documentType = 'invoice' }) {
  const currency = invoice?.currency || tenant?.settings?.currency || 'SAR'
  const invoiceBranding = getInvoiceBranding(tenant, language, invoice?.businessContext)
  
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
        <span className="tabular-nums font-mono font-bold text-black">{amount}</span>
        <span className="text-[0.7em] text-black font-bold uppercase">{currency}</span>
      </span>
    )
  }

  const invoiceTitleEn = getCommercialDocumentTitle(documentType, 'en', { uppercase: true })
  const invoiceTitleAr = getCommercialDocumentTitle(documentType, 'ar')

  return (
    <div dir="ltr" className="mx-auto max-w-5xl bg-white border-2 border-black overflow-hidden font-sans rounded-none">
      <div className="p-8">
        
        {/* Header Section */}
        <div className="flex justify-between items-end border-b-4 border-black pb-6 mb-6">
          <div className="flex-1 flex items-end gap-6">
            <div className="h-16 w-16 flex-shrink-0 flex items-center justify-center bg-white border-2 border-black p-2">
              {logoSrc ? (
                <img src={logoSrc} alt="Logo" className="max-h-full max-w-full object-contain grayscale" />
              ) : (
                <Building2 className="h-8 w-8 text-black" />
              )}
            </div>
            <div>
              <h2 className="text-2xl font-black text-black uppercase tracking-tight">{sellerNameEn}</h2>
              {bilingual && sellerNameAr && <h2 className="text-xl font-bold text-black mt-1" dir="rtl">{sellerNameAr}</h2>}
            </div>
          </div>
          <div className="flex-1 text-right">
            <h1 className="text-5xl font-black text-black tracking-tighter uppercase leading-none">
              {invoiceTitleEn}
            </h1>
            {bilingual && <h1 className="text-2xl font-black text-black mt-2 leading-none" dir="rtl">{invoiceTitleAr}</h1>}
          </div>
        </div>

        {/* Info Grid */}
        <div className="flex border-b-2 border-black pb-6 mb-6">
          <div className="w-1/3 pr-6 border-r-2 border-black">
            <h3 className="text-[10px] text-black uppercase font-black mb-2 tracking-widest">{getCommercialCounterpartyLabel(documentType, 'en').toUpperCase()}</h3>
            <p className="text-base font-bold text-black uppercase">{buyerNameEn}</p>
            {bilingual && buyerNameAr && <p className="text-sm font-bold text-black mt-1" dir="rtl">{buyerNameAr}</p>}
            {invoice?.buyer?.vatNumber && <p className="text-xs font-mono text-black mt-2 font-bold">VAT: {invoice.buyer.vatNumber}</p>}
          </div>
          
          <div className="w-1/3 px-6 border-r-2 border-black">
            <div className="mb-4">
              <h3 className="text-[10px] text-black uppercase font-black mb-1 tracking-widest">{getCommercialDocumentNumberLabel(documentType, 'en').toUpperCase()}</h3>
              <p className="text-base font-mono font-bold text-black">#{documentNumber}</p>
            </div>
            <div>
              <h3 className="text-[10px] text-black uppercase font-black mb-1 tracking-widest">DATE</h3>
              <p className="text-base font-mono font-bold text-black">{formatDate(invoice?.issueDate || new Date())}</p>
            </div>
          </div>

          <div className="w-1/3 pl-6 flex justify-between items-start">
             <div>
               <h3 className="text-[10px] text-black uppercase font-black mb-1 tracking-widest">SELLER VAT</h3>
               <p className="text-sm font-mono font-bold text-black mb-2">{invoice?.seller?.vatNumber || tenant?.business?.vatNumber || '—'}</p>
               <h3 className="text-[10px] text-black uppercase font-black mb-1 tracking-widest">SELLER CR</h3>
               <p className="text-sm font-mono font-bold text-black">{invoice?.seller?.crNumber || '—'}</p>
             </div>
             {shouldShowZatcaQr(documentType) && qrValue && (
                <div className="p-1 border-2 border-black bg-white">
                  <QRCodeSVG value={qrValue} size={70} bgColor="#ffffff" fgColor="#000000" />
                </div>
              )}
          </div>
        </div>

        {/* Table */}
        <div className="border-2 border-black mb-8">
          <table className="min-w-full divide-y-2 divide-black">
            <thead className="bg-black">
              <tr>
                <th className="px-4 py-2 text-left text-[10px] font-black text-white uppercase tracking-widest w-12">#</th>
                <th className="px-4 py-2 text-left text-[10px] font-black text-white uppercase tracking-widest">Description</th>
                <th className="px-4 py-2 text-center text-[10px] font-black text-white uppercase tracking-widest w-20">Qty</th>
                <th className="px-4 py-2 text-right text-[10px] font-black text-white uppercase tracking-widest w-32">Price</th>
                <th className="px-4 py-2 text-right text-[10px] font-black text-white uppercase tracking-widest w-24">Tax</th>
                <th className="px-4 py-2 text-right text-[10px] font-black text-white uppercase tracking-widest w-32">Total</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-black/30">
              {lineItems.map((line, idx) => {
                const productNameEn = line?.raw?.productName || line?.productName || '—'
                const productNameAr = line?.raw?.productNameAr || line?.productNameAr || ''
                return (
                  <tr key={idx}>
                    <td className="px-4 py-3 whitespace-nowrap text-xs font-mono font-bold text-black">{idx + 1}</td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-bold text-black">{productNameEn}</p>
                      {bilingual && productNameAr && <p className="text-xs font-bold text-black mt-0.5" dir="rtl">{productNameAr}</p>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs font-mono font-bold text-center text-black">
                      <div>{toNumber(line?.quantity) || '—'}</div>
                      {(line?.unitCode || line?.raw?.unitCode) && <div className="text-[10px] text-gray-500 mt-1">{getUomLabel(line?.unitCode || line?.raw?.unitCode, language)}</div>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right">{renderMoney(line?.unitPrice)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-right">{renderMoney(line?.taxAmount)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-right bg-gray-100">{renderMoney(line?.lineTotalWithTax)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="flex justify-between items-start">
          <div className="w-1/2 pr-8">
             <h3 className="text-[10px] text-black uppercase font-black mb-2 tracking-widest">AMOUNT IN WORDS</h3>
             <p className="text-sm font-bold text-black capitalize p-3 border-2 border-black bg-gray-50">{getAmountInWords(totals.grandTotal, currency)}</p>
          </div>
          <div className="w-1/2 border-2 border-black">
            <div className="flex justify-between p-3 border-b divide-x-2 divide-black">
              <span className="text-[10px] font-black text-black uppercase tracking-widest flex-1">Subtotal</span>
              <span className="text-right flex-1 font-mono font-bold">{renderMoney(totals.subtotal)}</span>
            </div>
            <div className="flex justify-between p-3 border-b divide-x-2 divide-black">
              <span className="text-[10px] font-black text-black uppercase tracking-widest flex-1">VAT (15%)</span>
              <span className="text-right flex-1 font-mono font-bold">{renderMoney(totals.totalTax)}</span>
            </div>
            <div className="flex justify-between p-4 bg-black text-white">
              <span className="text-sm font-black uppercase tracking-widest">Total</span>
              <span className="text-lg font-mono font-black">{renderMoney(totals.grandTotal)}</span>
            </div>
          </div>
        </div>


        {/* Document Extras & Unified Signatory */}
        <DocumentExtras invoice={invoice} invoiceBranding={invoiceBranding} language={language} bilingual={bilingual} />

        {/* Footer */}
        <div className="mt-12 pt-4 border-t-4 border-black text-center">
          <p className="text-[10px] font-black text-black uppercase tracking-widest">
            {invoiceBranding.footerText || 'THANK YOU FOR YOUR BUSINESS'}
          </p>
        </div>
      </div>
    </div>
  )
}
