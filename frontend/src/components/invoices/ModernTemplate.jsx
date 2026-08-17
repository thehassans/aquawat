import React from 'react'
import { getCommercialCounterpartyLabel, getCommercialDocumentNumberLabel, getCommercialDocumentTitle, resolveCommercialDocumentNumber, resolveInvoiceParties, shouldShowZatcaQr } from '../../lib/commercialDocumentLabels'
import { QRCodeSVG } from 'qrcode.react'
import { resolveTaxInvoiceQr } from '../../lib/taxInvoiceQr'
import { getUomLabel } from '../../lib/uomOptions'
import { calculateInvoiceSummary, toNumber } from '../../lib/invoiceDocument'
import { getInvoiceBranding } from '../../lib/invoiceBranding'
import { formatCurrencyAmount } from '../../lib/currency'
import { getAmountInWords } from '../../lib/amountInWords'
import { Building2, MapPin, Phone, Mail } from 'lucide-react'
import DocumentExtras from './DocumentExtras'
import ProductTypeMark from './ProductTypeMark'

const hasArabicText = (value = '') => /[\u0600-\u06FF]/.test(String(value || ''))

export default function ModernTemplate({ invoice, tenant, language = 'en', bilingual = false, documentType = 'invoice' }) {
  const currency = invoice?.currency || tenant?.settings?.currency || 'SAR'
  const invoiceBranding = getInvoiceBranding(tenant, language, invoice?.businessContext)
  const primaryColor = invoiceBranding.primaryColor || '#0ea5e9'
  
  const parties = resolveInvoiceParties({ invoice, tenant, invoiceBranding, language, bilingual, documentType })
  const { headerCompanyName, companyNameEn, companyNameAr, companyVat, companyCr, counterpartyName, counterpartyNameEn, counterpartyNameAr, counterpartyVat, counterpartyLabelEn, counterpartyLabelAr } = parties

  const logoSrc = invoiceBranding.logoSrc
  
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
  
  const formatDate = (dateString, locale = 'en-US') => {
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
        <span className="tabular-nums font-semibold">{amount}</span>
        <span className="text-[0.75em] text-slate-500 font-medium">{currency}</span>
      </span>
    )
  }

  const invoiceTitleEn = getCommercialDocumentTitle(documentType, 'en', { flow: invoice?.flow })
  const invoiceTitleAr = getCommercialDocumentTitle(documentType, 'ar', { flow: invoice?.flow })

  return (
    <div dir="ltr" className="mx-auto max-w-5xl bg-white border border-slate-200 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.1)] overflow-hidden font-sans rounded-xl">
      {/* Top Corporate Banner */}
      <div className="h-4 w-full" style={{ backgroundColor: primaryColor }}></div>

      <div className="p-12">
        {/* Header Section */}
        <div className="flex justify-between items-start mb-12">
          <div className="flex-1 flex gap-6">
            <div className="h-24 w-24 flex-shrink-0 flex items-center justify-center bg-slate-50 rounded-xl border border-slate-100 p-3 shadow-sm">
              {logoSrc ? (
                <img src={logoSrc} alt="Logo" className="max-h-full max-w-full object-contain" />
              ) : (
                <Building2 className="h-10 w-10 text-slate-400" />
              )}
            </div>
            <div className="pt-1">
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">{companyNameEn || headerCompanyName}</h2>
              {bilingual && companyNameAr && <h2 className="text-xl font-bold text-slate-900 mt-1" dir="rtl">{companyNameAr}</h2>}
              <div className="mt-3 text-sm text-slate-500 space-y-1">
                {companyVat && <p>VAT: <span className="text-slate-900 font-medium">{companyVat}</span></p>}
                {companyCr && <p>CR: <span className="text-slate-900 font-medium">{companyCr}</span></p>}
              </div>
            </div>
          </div>
          <div className="flex-1 flex justify-end">
            <div className="text-right">
              <h1 className="text-5xl font-extrabold tracking-tighter uppercase" style={{ color: primaryColor }}>
                {invoiceTitleEn}
              </h1>
              {bilingual && <h1 className="text-3xl font-extrabold tracking-tighter mt-1" style={{ color: primaryColor }} dir="rtl">{invoiceTitleAr}</h1>}
              <div className="mt-6 inline-block bg-slate-50 px-5 py-3 rounded-lg border border-slate-200 shadow-sm">
                <p className="text-xs text-slate-500 uppercase tracking-widest font-bold">{getCommercialDocumentNumberLabel(documentType, 'en', invoice?.flow)}</p>
                <p className="text-xl font-bold text-slate-900 mt-0.5">#{documentNumber}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-3 gap-8 mb-12 border-y border-slate-200 py-8">
          <div>
            <h3 className="text-xs text-slate-400 uppercase tracking-widest font-bold mb-4">{counterpartyLabelEn}</h3>
            <p className="text-lg font-bold text-slate-900 leading-tight">{counterpartyNameEn || counterpartyName}</p>
            {bilingual && counterpartyNameAr && <p className="text-base font-bold text-slate-900 mt-1" dir="rtl">{counterpartyNameAr}</p>}
            {counterpartyVat && <p className="text-sm text-slate-500 mt-3 font-medium">VAT: {counterpartyVat}</p>}
          </div>
          <div>
            <h3 className="text-xs text-slate-400 uppercase tracking-widest font-bold mb-4">Date & Time</h3>
            <p className="text-base font-bold text-slate-900">{formatDate(invoice?.issueDate || new Date())}</p>
            {invoice?.dueDate && (
              <div className="mt-4">
                <h3 className="text-xs text-slate-400 uppercase tracking-widest font-bold mb-1">Due Date</h3>
                <p className="text-sm font-bold text-slate-900">{formatDate(invoice.dueDate)}</p>
              </div>
            )}
          </div>
          <div className="flex justify-end items-center">
             {shouldShowZatcaQr(documentType) && qrValue && (
                <div className="p-3 bg-white border border-slate-200 rounded-2xl shadow-sm">
                  <QRCodeSVG value={qrValue} size={100} bgColor="#ffffff" fgColor={primaryColor} />
                </div>
              )}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-xl border border-slate-200 shadow-sm">
          <table className="min-w-full divide-y divide-slate-200">
            <thead style={{ backgroundColor: primaryColor }}>
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider">#</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider">Description</th>
                <th className="px-6 py-4 text-center text-xs font-bold text-white uppercase tracking-wider">Qty</th>
                <th className="px-6 py-4 text-right text-xs font-bold text-white uppercase tracking-wider">Unit Price</th>
                <th className="px-6 py-4 text-right text-xs font-bold text-white uppercase tracking-wider">Tax</th>
                <th className="px-6 py-4 text-right text-xs font-bold text-white uppercase tracking-wider">Total</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              {lineItems.map((line, idx) => {
                const productNameEn = line?.raw?.productName || line?.productName || '—'
                const productNameAr = line?.raw?.productNameAr || line?.productNameAr || ''
                return (
                  <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-5 whitespace-nowrap text-sm font-medium text-slate-400">{idx + 1}</td>
                    <td className="px-6 py-5">
                      <p className="text-sm font-bold text-slate-900">{productNameEn}</p>
                      {bilingual && productNameAr && <p className="text-xs font-medium text-slate-500 mt-1" dir="rtl">{productNameAr}</p>}
                      <ProductTypeMark line={line} language={language} bilingual={bilingual} />
                    </td>
                    <td className="px-6 py-5 whitespace-nowrap text-sm text-center text-slate-700 font-semibold">
                      <div>{toNumber(line?.quantity) || '—'}</div>
                      {(line?.unitCode || line?.raw?.unitCode) && <div className="text-[10px] text-slate-400 font-normal">{getUomLabel(line?.unitCode || line?.raw?.unitCode, language)}</div>}
                    </td>
                    <td className="px-6 py-5 whitespace-nowrap text-right">{renderMoney(line?.unitPrice)}</td>
                    <td className="px-6 py-5 whitespace-nowrap text-right">{renderMoney(line?.taxAmount)}</td>
                    <td className="px-6 py-5 whitespace-nowrap text-right text-slate-900 font-bold">{renderMoney(line?.lineTotalWithTax)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="mt-8 flex justify-end">
          <div className="w-1/2 rounded-xl bg-slate-50 border border-slate-200 p-8 shadow-sm">
            <div className="flex justify-between py-2 border-b border-slate-200/60">
              <span className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Subtotal</span>
              <span>{renderMoney(totals.subtotal)}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-200/60 mt-2">
              <span className="text-sm font-semibold text-slate-500 uppercase tracking-wide">VAT (15%)</span>
              <span>{renderMoney(totals.totalTax)}</span>
            </div>
            <div className="flex justify-between py-4 mt-4 border-t-2 border-slate-800">
              <span className="text-xl font-bold text-slate-900 uppercase tracking-widest">Total</span>
              <span className="text-2xl font-black" style={{ color: primaryColor }}>{renderMoney(totals.grandTotal)}</span>
            </div>
            <div className="mt-4 text-right">
              <p className="text-xs font-medium text-slate-400">Total amount in words</p>
              <p className="text-sm font-semibold text-slate-700 capitalize mt-1">{getAmountInWords(totals.grandTotal, currency)}</p>
            </div>
          </div>
        </div>

        {/* Document Extras & Unified Signatory */}
        <DocumentExtras invoice={invoice} invoiceBranding={invoiceBranding} language={language} bilingual={bilingual} />

        {/* Footer */}
        <div className="mt-12 pt-6 border-t border-slate-200">
          <p className="text-center text-sm font-semibold text-slate-400 tracking-wide">
            {invoiceBranding.footerText || 'Thank you for your business! | شكرا لتعاملكم معنا'}
          </p>
        </div>
      </div>
    </div>
  )
}
