import React from 'react'
import DocumentExtras from './DocumentExtras'
import { getCommercialCounterpartyLabel, getCommercialDocumentNumberLabel, getCommercialDocumentTitle, resolveCommercialDocumentNumber, resolveInvoiceParties, shouldShowZatcaQr, formatPartyAddress } from '../../lib/commercialDocumentLabels'
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
  
  const parties = resolveInvoiceParties({ invoice, tenant, invoiceBranding, language, bilingual, documentType })
  const {
    headerCompanyName, companyNameEn, companyNameAr, companyVat, companyCr, companyNtn, companyStrn,
    companyAddress,
    counterpartyName, counterpartyNameEn, counterpartyNameAr, counterpartyVat, counterpartyCr, counterpartyNtn, counterpartyStrn,
    counterpartyLabelEn, taxLabel, taxIdLabel
  } = parties
  const sellerAddressText = formatPartyAddress(companyAddress, { language: 'en' })

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
        <span className="tabular-nums font-mono font-medium">{amount}</span>
        <span className="text-[0.8em] text-slate-500 font-normal">{currency}</span>
      </span>
    )
  }

  const invoiceTitleEn = getCommercialDocumentTitle(documentType, 'en', { flow: invoice?.flow, invoice })
  const invoiceTitleAr = getCommercialDocumentTitle(documentType, 'ar', { flow: invoice?.flow, invoice })

  return (
    <div dir="ltr" className="mx-auto max-w-5xl bg-white border border-slate-300 overflow-hidden font-sans rounded-none shadow-sm text-slate-800">
      
      {/* Top Header */}
      <div className="p-6 border-b border-slate-300 flex justify-between items-center bg-slate-50">
        <div className="flex items-center gap-4">
          {logoSrc && (
            <img src={logoSrc} alt="Logo" className="h-12 object-contain" />
          )}
          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">{companyNameEn || headerCompanyName}</h2>
            {bilingual && companyNameAr && <h2 className="text-lg font-bold text-slate-700" dir="rtl">{companyNameAr}</h2>}
            {sellerAddressText ? <p className="mt-1 max-w-sm text-xs text-slate-500">{sellerAddressText}</p> : null}
          </div>
        </div>
        <div className="text-right">
          <h1 className="text-2xl font-bold text-slate-900 tracking-wide uppercase" style={{ color: primaryColor }}>
            {invoiceTitleEn}
          </h1>
          {bilingual && <h1 className="text-xl font-bold text-slate-700 mt-0.5" dir="rtl">{invoiceTitleAr}</h1>}
        </div>
      </div>

      {/* Meta Grid */}
      <div className="flex border-b border-slate-300">
        <div className="w-1/2 p-6 border-r border-slate-300">
          <table className="text-sm">
            <tbody>
              <tr>
                <td className="py-1 font-bold text-slate-600 uppercase w-32">{getCommercialDocumentNumberLabel(documentType, 'en', invoice?.flow)}:</td>
                <td className="py-1 font-mono font-medium text-slate-900">#{documentNumber}</td>
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
              {companyNtn ? (
                <>
                  <tr>
                    <td className="py-1 font-bold text-slate-600 uppercase w-32">Company NTN:</td>
                    <td className="py-1 font-medium text-slate-900">{companyNtn}</td>
                  </tr>
                  {companyStrn && (
                    <tr>
                      <td className="py-1 font-bold text-slate-600 uppercase w-32">Company STRN:</td>
                      <td className="py-1 font-medium text-slate-900">{companyStrn}</td>
                    </tr>
                  )}
                </>
              ) : (
                <tr>
                  <td className="py-1 font-bold text-slate-600 uppercase w-32">{parties.isPurchaseFlow ? 'Company VAT:' : 'Seller VAT:'}</td>
                  <td className="py-1 font-medium text-slate-900">{companyVat || '—'}</td>
                </tr>
              )}
              {companyCr && (
                <tr>
                  <td className="py-1 font-bold text-slate-600 uppercase">{parties.isPurchaseFlow ? 'Company CR:' : 'Seller CR:'}</td>
                  <td className="py-1 font-medium text-slate-900">{companyCr || '—'}</td>
                </tr>
              )}
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
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 border-b border-slate-200 pb-1 w-fit">{counterpartyLabelEn}</h3>
        <p className="text-base font-bold text-slate-900">{counterpartyNameEn || counterpartyName}</p>
        {bilingual && counterpartyNameAr && <p className="text-sm font-bold text-slate-900 mt-1" dir="rtl">{counterpartyNameAr}</p>}
        {counterpartyNtn ? <p className="text-sm text-slate-700 mt-2">NTN: {counterpartyNtn}</p> : (counterpartyVat ? <p className="text-sm text-slate-700 mt-2">{taxIdLabel}: {counterpartyVat}</p> : null)}
        {counterpartyStrn && <p className="text-sm text-slate-700 mt-1">STRN: {counterpartyStrn}</p>}
        {counterpartyCr ? <p className="text-sm text-slate-700 mt-1">CR: {counterpartyCr}</p> : null}
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
              <th className="px-4 py-3 text-right text-xs font-bold text-white uppercase tracking-wider border-r border-white/20 w-32">{taxLabel}</th>
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
                <td className="px-6 py-3 text-sm font-bold text-slate-600 uppercase tracking-widest border-r border-slate-200">{taxLabel}</td>
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
