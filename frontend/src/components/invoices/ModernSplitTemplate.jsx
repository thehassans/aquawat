import React from 'react'
import DocumentExtras from './DocumentExtras'
import { QRCodeSVG } from 'qrcode.react'
import { generateZatcaQrValue } from '../../lib/zatcaQr'
import { getUomLabel } from '../../lib/uomOptions'
import { calculateInvoiceSummary, toNumber } from '../../lib/invoiceDocument'
import { getInvoiceBranding } from '../../lib/invoiceBranding'
import { formatCurrencyAmount } from '../../lib/currency'
import { getAmountInWords } from '../../lib/amountInWords'
import { Building2 } from 'lucide-react'

const hasArabicText = (value = '') => /[\u0600-\u06FF]/.test(String(value || ''))

export default function ModernSplitTemplate({ invoice, tenant, language = 'en', bilingual = false, documentType = 'invoice' }) {
  const currency = invoice?.currency || tenant?.settings?.currency || 'SAR'
  const invoiceBranding = getInvoiceBranding(tenant, language, invoice?.businessContext)
  
  const sellerNameEn = invoice?.seller?.name || invoice?.seller?.nameAr || tenant?.business?.legalNameEn || tenant?.business?.legalNameAr || ''
  const sellerNameAr = invoice?.seller?.nameAr || (hasArabicText(invoice?.seller?.name) ? invoice?.seller?.name : '') || tenant?.business?.legalNameAr || ''
  const buyerNameEn = invoice?.buyer?.name || invoice?.buyer?.nameAr || 'Cash Customer'
  const buyerNameAr = invoice?.buyer?.nameAr || (hasArabicText(invoice?.buyer?.name) ? invoice?.buyer?.name : '')
  
  const sellerName = bilingual ? sellerNameEn : (language === 'ar' ? (sellerNameAr || sellerNameEn) : (sellerNameEn || sellerNameAr))
  const buyerName = bilingual ? buyerNameEn : (language === 'ar' ? (buyerNameAr || buyerNameEn) : (buyerNameEn || buyerNameAr))

  const logoSrc = invoiceBranding.logoSrc
  
  const qrValue = invoice?.zatca?.qrCodeData || generateZatcaQrValue({
    sellerName: sellerNameEn || sellerNameAr,
    vatNumber: invoice?.seller?.vatNumber || tenant?.business?.vatNumber,
    timestamp: invoice?.issueDate || new Date().toISOString(),
    totalWithVat: toNumber(invoice?.grandTotal),
    vatTotal: toNumber(invoice?.totalTax),
  })

  const totals = calculateInvoiceSummary(invoice)
  const lineItems = totals.lines.length > 0 ? totals.lines : [{ raw: { productName: language === 'ar' ? 'خدمة' : 'Service' }, quantity: 1, unitPrice: 0, taxAmount: 0, lineTotalWithTax: 0 }]
  
  const documentNumber = invoice?.quotationNumber || invoice?.invoiceNumber || 'DRAFT-PREVIEW'
  
  const formatDate = (dateString, locale = 'en-SA') => {
    if (!dateString) return '—'
    return new Date(dateString).toLocaleDateString(locale, {
      year: 'numeric',
      month: 'short',
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
        <span className="tabular-nums">{amount}</span>
        <span className="text-[0.85em] font-medium text-gray-500">{currency}</span>
      </span>
    )
  }

  const isQuotation = documentType === 'quotation'
  const invoiceTitle = isQuotation 
    ? (language === 'ar' ? 'عرض سعر' : 'QUOTATION')
    : (language === 'ar' ? 'فاتورة ضريبية' : 'TAX INVOICE')

  const bgWatermark = invoiceBranding.letterheadImage || tenant?.branding?.letterheadImage || tenant?.settings?.invoiceBranding?.letterheadImage || logoSrc

  return (
    <div dir="ltr" className="mx-auto max-w-5xl bg-white shadow-xl flex font-sans min-h-[1056px]" style={{ fontFamily: 'Arial, Helvetica, "Almarai", sans-serif' }}>
      
      {/* Left Column - Dark Theme */}
      <div className="w-[30%] bg-slate-900 text-white p-8 flex flex-col justify-between rounded-l-2xl print:rounded-none">
        <div>
          {/* Logo Box */}
          <div className="bg-white rounded-2xl p-4 mb-8 flex items-center justify-center h-32">
            {logoSrc ? (
              <img src={logoSrc} alt="Logo" className="max-h-full object-contain" />
            ) : (
              <Building2 className="h-12 w-12 text-slate-900" />
            )}
          </div>
          
          <h1 className="text-2xl font-bold tracking-widest mb-8 uppercase text-slate-300 border-b border-slate-700 pb-4">{invoiceTitle}</h1>
          
          <div className="mb-8">
            <p className="text-slate-400 text-xs tracking-widest uppercase mb-1">Invoice Number</p>
            <p className="text-lg font-bold">#{documentNumber}</p>
          </div>
          
          <div className="mb-8">
            <p className="text-slate-400 text-xs tracking-widest uppercase mb-1">Date of Issue</p>
            <p className="text-lg font-bold">{formatDate(invoice?.issueDate || new Date(), 'en-US')}</p>
          </div>

          {!isQuotation && qrValue && (
            <div className="mt-8 bg-white p-2 rounded-xl inline-block">
              <QRCodeSVG value={qrValue} size={120} bgColor="transparent" fgColor="#0f172a" />
            </div>
          )}
        </div>
        
        <div className="text-xs text-slate-500 mt-12">
          Generated automatically by Maqder
        </div>
      </div>

      {/* Right Column - Light Theme */}
      <div className="relative w-[70%] bg-slate-50 p-10 rounded-r-2xl print:rounded-none flex flex-col overflow-hidden">
        {bgWatermark && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden z-0 select-none p-12" aria-hidden="true">
            <img
              src={bgWatermark}
              alt=""
              className="max-h-[60%] max-w-[60%] object-contain opacity-[0.06] print:opacity-[0.06] grayscale-0 transition-opacity"
            />
          </div>
        )}
        <div className="relative z-10 flex flex-col flex-1">
        
        {/* Addresses */}
        <div className="flex justify-between items-start mb-12">
          <div className="w-[45%]">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 border-b border-slate-200 pb-2">From</p>
            <h2 className="text-lg font-bold text-slate-900">{sellerNameEn}</h2>
            {bilingual && <h2 className="text-md font-bold text-slate-700 mt-1" dir="rtl">{sellerNameAr}</h2>}
            <div className="mt-3 text-sm text-slate-600 space-y-1">
              {invoice?.seller?.vatNumber && <p>VAT: <span className="font-medium text-slate-900">{invoice.seller.vatNumber}</span></p>}
              {invoice?.seller?.crNumber && <p>CR: <span className="font-medium text-slate-900">{invoice.seller.crNumber}</span></p>}
            </div>
          </div>
          
          <div className="w-[45%] bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <p className="text-xs font-bold text-blue-500 uppercase tracking-widest mb-3 border-b border-slate-100 pb-2">Billed To</p>
            <h3 className="text-lg font-bold text-slate-900">{buyerNameEn}</h3>
            {bilingual && <h3 className="text-md font-bold text-slate-700 mt-1" dir="rtl">{buyerNameAr}</h3>}
            <div className="mt-3 text-sm text-slate-600 space-y-1">
              {invoice?.buyer?.vatNumber && <p>VAT: <span className="font-medium text-slate-900">{invoice.buyer.vatNumber}</span></p>}
              {invoice?.buyer?.contactPhone && <p>Tel: <span className="font-medium text-slate-900">{invoice.buyer.contactPhone}</span></p>}
            </div>
          </div>
        </div>

        {/* Line Items */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm mb-8 flex-1">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-100 text-slate-600 text-xs uppercase tracking-wider border-b border-slate-200">
                <th className="py-4 px-4 font-bold w-12 text-center">#</th>
                <th className="py-4 px-4 font-bold">Description</th>
                <th className="py-4 px-4 font-bold text-center w-20">Qty</th>
                <th className="py-4 px-4 font-bold text-right w-28">Price</th>
                <th className="py-4 px-4 font-bold text-right w-32">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lineItems.map((item, idx) => (
                <tr key={idx} className="group hover:bg-slate-50 transition-colors">
                  <td className="py-4 px-4 text-center text-sm text-slate-500">{idx + 1}</td>
                  <td className="py-4 px-4">
                    <p className="font-bold text-slate-900">{item.productName || item.raw?.productName}</p>
                    {bilingual && <p className="text-sm text-slate-500 mt-1" dir="rtl">{item.productNameAr || item.raw?.productNameAr}</p>}
                  </td>
                  <td className="py-4 px-4 text-center text-sm font-medium">
                    <div>{item.quantity}</div>
                    {(item?.unitCode || item?.raw?.unitCode) && <div className="text-[10px] text-slate-500 mt-1">{getUomLabel(item?.unitCode || item?.raw?.unitCode, language)}</div>}
                  </td>
                  <td className="py-4 px-4 text-right text-sm">{renderMoney(item.unitPrice)}</td>
                  <td className="py-4 px-4 text-right font-bold text-slate-900">{renderMoney(item.lineTotalWithTax)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer / Totals */}
        <div className="flex justify-between items-end gap-8">
          <div className="flex-1 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 border-b border-slate-100 pb-2">Amount in Words</p>
            <p className="text-slate-800 font-medium italic text-sm">{getAmountInWords(totals.grandTotal, currency, 'en')}</p>
            {bilingual && <p className="text-slate-800 font-medium mt-2 leading-relaxed text-sm" dir="rtl">{getAmountInWords(totals.grandTotal, currency, 'ar')}</p>}
          </div>
          
          <div className="w-72 bg-slate-900 text-white p-6 rounded-2xl shadow-lg">
            <div className="flex justify-between py-2 text-slate-400 text-sm">
              <span>Subtotal</span>
              <span className="text-white">{renderMoney(totals.subtotal)}</span>
            </div>
            <div className="flex justify-between py-2 text-slate-400 text-sm">
              <span>Discount</span>
              <span className="text-white">{renderMoney(totals.totalDiscount)}</span>
            </div>
            <div className="flex justify-between py-2 text-slate-400 text-sm border-b border-slate-700">
              <span>VAT (15%)</span>
              <span className="text-white">{renderMoney(totals.totalTax)}</span>
            </div>
            <div className="flex justify-between pt-4 text-2xl font-bold">
              <span>Total</span>
              <span>{renderMoney(totals.grandTotal)}</span>
            </div>
          </div>
        </div>

      {(invoiceBranding.stampImage || invoiceBranding.signatureImage) && (
        <div className="flex justify-end gap-12 pt-8 pr-12">
          {invoiceBranding.signatureImage && (
            <div className="flex flex-col items-center">
              <img src={invoiceBranding.signatureImage} alt="Signature" className="max-h-24 object-contain mix-blend-multiply" />
            </div>
          )}
          {invoiceBranding.stampImage && (
            <div className="flex flex-col items-center">
              <img src={invoiceBranding.stampImage} alt="Stamp" className="max-h-24 object-contain mix-blend-multiply" />
            </div>
          )}
        </div>
      )}

        </div>
      </div>
    
      <DocumentExtras invoice={invoice} language={language} bilingual={bilingual} />
    </div>
  )
}
