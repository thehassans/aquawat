import React from 'react'
import DocumentExtras from './DocumentExtras'
import { getCommercialCounterpartyLabel, getCommercialDocumentTitle, resolveCommercialDocumentNumber, resolveInvoiceParties } from '../../lib/commercialDocumentLabels'
import { getUomLabel } from '../../lib/uomOptions'
import { calculateInvoiceSummary, toNumber } from '../../lib/invoiceDocument'
import { getInvoiceBranding } from '../../lib/invoiceBranding'
import { formatCurrencyAmount } from '../../lib/currency'
import { getAmountInWords } from '../../lib/amountInWords'
import LetterheadChrome from './LetterheadChrome'
import ProductTypeMark from './ProductTypeMark'

const hasArabicText = (value = '') => /[\u0600-\u06FF]/.test(String(value || ''))

export default function LetterheadTemplate({ invoice, tenant, language = 'en', bilingual = false, documentType = 'invoice' }) {
  const currency = invoice?.currency || tenant?.settings?.currency || 'SAR'
  const invoiceBranding = getInvoiceBranding(tenant, language, invoice?.businessContext)

  const parties = resolveInvoiceParties({ invoice, tenant, invoiceBranding, language, bilingual, documentType })
  const { counterpartyName, counterpartyNameEn, counterpartyNameAr, counterpartyAddress, counterpartyPhone, counterpartyLabelEn, counterpartyLabelAr } = parties

  const totals = calculateInvoiceSummary(invoice)
  const lineItems = totals.lines.length > 0
    ? totals.lines
    : [{ raw: { productName: language === 'ar' ? 'خدمة' : 'Service' }, quantity: 1, unitPrice: 0, taxAmount: 0, lineTotalWithTax: 0 }]
  const documentNumber = resolveCommercialDocumentNumber(invoice, documentType)
  const invoiceTitle = getCommercialDocumentTitle(documentType, language, { flow: invoice?.flow })
  const isQuotation = documentType === 'quotation' || Boolean(invoice?.quotationNumber)

  const formatDate = (dateString) => {
    if (!dateString) return '—'
    return new Date(dateString).toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' })
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

  const counterpartyAddressStr = counterpartyAddress ? [
    counterpartyAddress?.street,
    counterpartyAddress?.district,
    counterpartyAddress?.city,
    counterpartyAddress?.country,
  ].filter(Boolean).join(', ') : ''

  return (
    <LetterheadChrome
      tenant={tenant}
      invoice={invoice}
      bilingual={bilingual}
      className="rounded-xl border border-gray-200 shadow-xl"
    >
      <div className="px-8 py-6" style={{ fontFamily: 'Arial, Helvetica, "Almarai", sans-serif' }}>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h1 className="text-2xl font-black tracking-tight text-slate-900">{invoiceTitle}</h1>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
            <p><span className="font-semibold text-slate-500">No.</span> {documentNumber}</p>
            <p className="mt-1"><span className="font-semibold text-slate-500">Date:</span> {formatDate(invoice?.issueDate || new Date())}</p>
            {isQuotation && invoice?.validUntil ? (
              <p className="mt-1"><span className="font-semibold text-slate-500">Valid until:</span> {formatDate(invoice.validUntil)}</p>
            ) : null}
            {documentType === 'purchase_order' && invoice?.dueDate ? (
              <p className="mt-1"><span className="font-semibold text-slate-500">Expected:</span> {formatDate(invoice.dueDate)}</p>
            ) : null}
          </div>
        </div>

        {(invoice?.subject || invoice?.subjectAr) ? (
          <div className="mt-4">
            <p className="text-base">
              <span className="font-bold">Subject:</span>{' '}
              <span>{language === 'ar' ? (invoice.subjectAr || invoice.subject) : (invoice.subject || invoice.subjectAr)}</span>
            </p>
            {bilingual && invoice?.subjectAr && invoice.subjectAr !== invoice.subject ? (
              <p className="mt-1 text-base" dir="rtl">
                <span className="font-bold">الموضوع:</span> {invoice.subjectAr}
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-slate-200 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
              {counterpartyLabelEn} / {counterpartyLabelAr}
            </p>
            <p className="mt-2 text-base font-bold">{counterpartyNameEn || counterpartyName || '—'}</p>
            {bilingual && counterpartyNameAr && counterpartyNameAr !== counterpartyNameEn ? (
              <p className="text-sm text-slate-600" dir="rtl">{counterpartyNameAr}</p>
            ) : null}
            {counterpartyAddressStr ? <p className="mt-2 text-sm text-slate-600">{counterpartyAddressStr}</p> : null}
            {counterpartyPhone ? <p className="mt-1 text-sm text-slate-600">{counterpartyPhone}</p> : null}
          </div>
          <div className="rounded-xl border border-slate-200 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Details / التفاصيل</p>
            {invoice?.transactionType ? <p className="mt-2 text-sm"><span className="font-semibold">Type:</span> {invoice.transactionType}</p> : null}
          </div>
        </div>

        <div className="mt-6 overflow-hidden rounded-xl border border-slate-200">
          <table className="min-w-full text-sm">
            <thead className="bg-primary-500">
              <tr className="text-white">
                <th className="px-3 py-2.5 text-start font-semibold">#</th>
                <th className="px-3 py-2.5 text-start font-semibold">Item</th>
                <th className="px-3 py-2.5 text-start font-semibold">Qty</th>
                <th className="px-3 py-2.5 text-start font-semibold">Unit</th>
                <th className="px-3 py-2.5 text-end font-semibold">Price</th>
                <th className="px-3 py-2.5 text-end font-semibold">Tax</th>
                <th className="px-3 py-2.5 text-end font-semibold">Total</th>
              </tr>
            </thead>
            <tbody>
              {lineItems.map((line, index) => (
                <tr key={index} className={index % 2 ? 'bg-slate-50' : 'bg-white'}>
                  <td className="px-3 py-2">{index + 1}</td>
                  <td className="px-3 py-2">
                    <p className="font-semibold">{line.raw?.productName || line.productName || '—'}</p>
                    {bilingual && (line.raw?.productNameAr || line.productNameAr) && (line.raw?.productNameAr || line.productNameAr) !== (line.raw?.productName || line.productName) ? (
                      <p className="text-xs text-slate-600" dir="rtl">{line.raw?.productNameAr || line.productNameAr}</p>
                    ) : null}
                    <ProductTypeMark line={line} language={language} bilingual={bilingual} />
                    {line.raw?.description ? <p className="text-xs text-slate-500">{line.raw.description}</p> : null}
                    {bilingual && line.raw?.descriptionAr && line.raw.descriptionAr !== line.raw.description ? (
                      <p className="text-xs text-slate-500" dir="rtl">{line.raw.descriptionAr}</p>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">{line.quantity}</td>
                  <td className="px-3 py-2">{getUomLabel(line.raw?.unitCode || 'PCE', language)}</td>
                  <td className="px-3 py-2 text-end">{renderMoney(line.unitPrice)}</td>
                  <td className="px-3 py-2 text-end">{renderMoney(line.taxAmount)}</td>
                  <td className="px-3 py-2 text-end font-semibold">{renderMoney(line.lineTotalWithTax)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-6 flex flex-col gap-4 md:flex-row md:justify-between">
          <div className="max-w-sm text-sm text-slate-600">
            <p className="font-semibold text-slate-800">Amount in words</p>
            <p className="mt-1">{getAmountInWords(totals.grandTotal, currency, language)}</p>
          </div>
          <div className="w-full max-w-xs space-y-2 text-sm">
            <div className="flex justify-between"><span>Subtotal</span><span>{renderMoney(totals.subtotal)}</span></div>
            <div className="flex justify-between"><span>Discount</span><span>{renderMoney(totals.totalDiscount)}</span></div>
            <div className="flex justify-between"><span>Tax</span><span>{renderMoney(totals.totalTax)}</span></div>
            <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-black">
              <span>Grand Total</span>
              <span>{renderMoney(totals.grandTotal)}</span>
            </div>
          </div>
        </div>

        <DocumentExtras invoice={invoice} invoiceBranding={invoiceBranding} language={language} bilingual={bilingual} hideSubject signatoryFromDocumentOnly={isQuotation} />
      </div>
    </LetterheadChrome>
  )
}
