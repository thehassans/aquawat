import React from 'react'
import DocumentExtras from './DocumentExtras'
import { getCommercialCounterpartyLabel, getCommercialDocumentNumberLabel, getCommercialDocumentTitle, resolveCommercialDocumentNumber, resolveInvoiceParties, shouldShowZatcaQr } from '../../lib/commercialDocumentLabels'
import { QRCodeSVG } from 'qrcode.react'
import { resolveTaxInvoiceQr } from '../../lib/taxInvoiceQr'
import { getUomLabel } from '../../lib/uomOptions'
import { calculateInvoiceSummary, toNumber } from '../../lib/invoiceDocument'
import { getInvoiceBranding } from '../../lib/invoiceBranding'
import { formatCurrencyAmount } from '../../lib/currency'
import { getAmountInWords } from '../../lib/amountInWords'
import ProductTypeMark from './ProductTypeMark'

const hasArabicText = (value = '') => /[\u0600-\u06FF]/.test(String(value || ''))

export default function AirTemplate({ invoice, tenant, language = 'en', bilingual = false, documentType = 'invoice' }) {
  const currency = invoice?.currency || tenant?.settings?.currency || 'SAR'
  const invoiceBranding = getInvoiceBranding(tenant, language, invoice?.businessContext)
  const primaryColor = invoiceBranding.primaryColor || '#64748b'
  
  const parties = resolveInvoiceParties({ invoice, tenant, invoiceBranding, language, bilingual, documentType })
  const {
    headerCompanyName, companyNameEn, companyNameAr, companyVat, companyCr, companyNtn, companyStrn,
    counterpartyName, counterpartyNameEn, counterpartyNameAr, counterpartyVat, counterpartyNtn, counterpartyStrn,
    counterpartyLabelEn, taxLabel, taxIdLabel
  } = parties

  const logoSrc = invoiceBranding.logoSrc
  
  const qrValue = resolveTaxInvoiceQr({
    invoice,
    tenant,
    currency,
    sellerName: companyNameEn || companyNameAr,
    vatNumber: companyVat || companyNtn,
  })

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
        <span className="tabular-nums font-extralight tracking-tight">{amount}</span>
        <span className="text-[0.7em] text-slate-400 font-light">{currency}</span>
      </span>
    )
  }

  const invoiceTitleEn = getCommercialDocumentTitle(documentType, 'en', { flow: invoice?.flow })
  const invoiceTitleAr = getCommercialDocumentTitle(documentType, 'ar', { flow: invoice?.flow })

  return (
    <div dir="ltr" className="mx-auto max-w-5xl bg-white border border-slate-100 overflow-hidden font-sans rounded-none shadow-sm relative selection:bg-slate-100">
      
      {/* Delicate Top Line */}
      <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ backgroundColor: primaryColor }}></div>

      <div className="p-16">
        {/* Header Section */}
        <div className="flex justify-between items-start mb-24">
          <div className="flex-1">
            {logoSrc ? (
              <img src={logoSrc} alt="Logo" className="h-16 object-contain mb-8 mix-blend-multiply" />
            ) : (
              <div className="h-16 w-16 bg-slate-50 border border-slate-100 rounded-2xl mb-8 flex items-center justify-center">
                <span className="text-xs text-slate-300 font-light tracking-widest uppercase">Logo</span>
              </div>
            )}
            <h2 className="text-4xl font-extralight text-slate-900 tracking-tighter">{companyNameEn || headerCompanyName}</h2>
            {bilingual && companyNameAr && <h2 className="text-2xl font-light text-slate-500 mt-2 tracking-wide" dir="rtl">{companyNameAr}</h2>}
            
            <div className="mt-8 text-sm text-slate-400 space-y-2 font-light">
              {companyNtn ? <p className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-slate-200"></span>NTN {companyNtn}</p> : (companyVat ? <p className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-slate-200"></span>{taxIdLabel} {companyVat}</p> : null)}
              {companyStrn && <p className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-slate-200"></span>STRN {companyStrn}</p>}
              {companyCr && <p className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-slate-200"></span>CR {companyCr}</p>}
            </div>
          </div>

          <div className="flex-1 flex flex-col items-end text-right">
            <h1 className="text-5xl font-extralight tracking-widest text-slate-200 uppercase">
              {invoiceTitleEn}
            </h1>
            {bilingual && <h1 className="text-3xl font-extralight text-slate-200 mt-3" dir="rtl">{invoiceTitleAr}</h1>}
            
            <div className="mt-16 flex gap-12 text-right">
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-widest font-medium mb-2">{getCommercialDocumentNumberLabel(documentType, 'en', invoice?.flow)}</p>
                <p className="text-xl font-light text-slate-800">{documentNumber}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-widest font-medium mb-2">Issue Date</p>
                <p className="text-xl font-light text-slate-800">{formatDate(invoice?.issueDate || new Date())}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Bill To & QR */}
        <div className="flex justify-between items-end mb-24 bg-slate-50/50 rounded-3xl p-10 relative">
          <div className="pl-4">
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-medium mb-6">{counterpartyLabelEn}</p>
            <h3 className="text-3xl font-light text-slate-900 mb-2">{counterpartyNameEn || counterpartyName}</h3>
            {bilingual && counterpartyNameAr && <h3 className="text-xl font-light text-slate-500 mb-4" dir="rtl">{counterpartyNameAr}</h3>}
            {counterpartyNtn ? <p className="text-sm text-slate-500 mt-2 font-light tracking-wide">NTN: {counterpartyNtn}</p> : (counterpartyVat ? <p className="text-sm text-slate-500 mt-2 font-light tracking-wide">{taxIdLabel}: {counterpartyVat}</p> : null)}
            {counterpartyStrn && <p className="text-sm text-slate-500 mt-1 font-light tracking-wide">STRN: {counterpartyStrn}</p>}
          </div>

          <div>
             {shouldShowZatcaQr(documentType) && qrValue && (
                <div className="p-3 bg-white rounded-2xl shadow-sm border border-slate-100">
                  <QRCodeSVG value={qrValue} size={90} bgColor="transparent" fgColor={primaryColor} />
                </div>
              )}
          </div>
        </div>

        {/* Table */}
        <div className="mb-24">
          <table className="min-w-full">
            <thead>
              <tr>
                <th className="py-5 text-left text-[10px] font-medium text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100 w-12">0.</th>
                <th className="py-5 text-left text-[10px] font-medium text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">Description</th>
                <th className="py-5 text-center text-[10px] font-medium text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100 w-24">Qty</th>
                <th className="py-5 text-right text-[10px] font-medium text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100 w-32">Rate</th>
                <th className="py-5 text-right text-[10px] font-medium text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100 w-32">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50/50">
              {lineItems.map((line, idx) => {
                const productNameEn = line?.raw?.productName || line?.productName || '—'
                const productNameAr = line?.raw?.productNameAr || line?.productNameAr || ''
                return (
                  <tr key={idx} className="group hover:bg-slate-50/30 transition-colors">
                    <td className="py-8 whitespace-nowrap text-xs font-light text-slate-300">{String(idx + 1).padStart(2, '0')}</td>
                    <td className="py-8 pr-8">
                      <p className="text-lg font-light text-slate-800">{productNameEn}</p>
                      {bilingual && productNameAr && <p className="text-sm font-light text-slate-400 mt-2" dir="rtl">{productNameAr}</p>}
                      <ProductTypeMark line={line} language={language} bilingual={bilingual} />
                    </td>
                    <td className="py-8 whitespace-nowrap text-base font-light text-center text-slate-500">
                      <div>{toNumber(line?.quantity) || '—'}</div>
                      {(line?.unitCode || line?.raw?.unitCode) && <div className="text-[10px] text-slate-400 font-normal">{getUomLabel(line?.unitCode || line?.raw?.unitCode, language)}</div>}
                    </td>
                    <td className="py-8 whitespace-nowrap text-right text-slate-500">{renderMoney(line?.unitPrice)}</td>
                    <td className="py-8 whitespace-nowrap text-right text-slate-800">{renderMoney(line?.lineTotalWithTax)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="flex justify-end mb-24">
          <div className="w-[60%] pl-12">
            <div className="flex justify-between py-5 border-b border-slate-50">
              <span className="text-sm font-light text-slate-400 uppercase tracking-widest">Subtotal</span>
              <span className="text-slate-600 text-lg font-light">{renderMoney(totals.subtotal)}</span>
            </div>
            <div className="flex justify-between py-5 border-b border-slate-50">
              <span className="text-sm font-light text-slate-400 uppercase tracking-widest">{taxLabel}</span>
              <span className="text-slate-600 text-lg font-light">{renderMoney(totals.totalTax)}</span>
            </div>
            <div className="flex justify-between items-end py-10 mt-4">
              <span className="text-sm font-medium text-slate-800 uppercase tracking-[0.2em]">Total Due</span>
              <span className="text-5xl font-extralight tracking-tight" style={{ color: primaryColor }}>{renderMoney(totals.grandTotal)}</span>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-2">Amount in Words</p>
              <p className="text-sm font-light text-slate-500 capitalize">{getAmountInWords(totals.grandTotal, currency)}</p>
            </div>
          </div>
        </div>

        {/* Document Extras & Unified Signatory */}
        <DocumentExtras invoice={invoice} invoiceBranding={invoiceBranding} language={language} bilingual={bilingual} />

        {/* Footer */}
        <div className="pt-8 mt-6 flex justify-center border-t border-slate-100">
          <p className="text-xs font-light text-slate-400 tracking-[0.2em] uppercase">
            {invoiceBranding.footerText || 'Thank you for your business'}
          </p>
        </div>
      </div>
    </div>
  )
}
