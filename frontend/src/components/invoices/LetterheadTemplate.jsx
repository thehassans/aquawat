import DocumentExtras from './DocumentExtras'
import LetterheadChrome from './LetterheadChrome'
import { getCommercialCounterpartyLabel, getCommercialDocumentTitle, resolveCommercialDocumentNumber } from '../../lib/commercialDocumentLabels'
import { getUomLabel } from '../../lib/uomOptions'
import { calculateInvoiceSummary } from '../../lib/invoiceDocument'
import { getInvoiceBranding } from '../../lib/invoiceBranding'
import { formatCurrencyAmount } from '../../lib/currency'
import { getAmountInWords } from '../../lib/amountInWords'

const hasArabicText = (value = '') => /[\u0600-\u06FF]/.test(String(value || ''))

export default function LetterheadTemplate({ invoice, tenant, language = 'en', bilingual = false, documentType = 'invoice' }) {
  const currency = invoice?.currency || tenant?.settings?.currency || 'SAR'
  const invoiceBranding = getInvoiceBranding(tenant, language, invoice?.businessContext)

  const buyerNameEn = invoice?.buyer?.name || invoice?.buyer?.nameAr || 'Cash Customer'
  const buyerNameAr = invoice?.buyer?.nameAr || (hasArabicText(invoice?.buyer?.name) ? invoice?.buyer?.name : '')
  const buyerName = bilingual ? buyerNameEn : (language === 'ar' ? (buyerNameAr || buyerNameEn) : (buyerNameEn || buyerNameAr))

  const totals = calculateInvoiceSummary(invoice)
  const lineItems = totals.lines.length > 0
    ? totals.lines
    : [{ raw: { productName: language === 'ar' ? 'خدمة' : 'Service' }, quantity: 1, unitPrice: 0, taxAmount: 0, lineTotalWithTax: 0 }]
  const documentNumber = resolveCommercialDocumentNumber(invoice, documentType)
  const invoiceTitle = getCommercialDocumentTitle(documentType, language)
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

  const buyerAddress = [
    invoice?.buyer?.address?.street,
    invoice?.buyer?.address?.district,
    invoice?.buyer?.address?.city,
    invoice?.buyer?.address?.country,
  ].filter(Boolean).join(', ')

  return (
    <LetterheadChrome
      tenant={tenant}
      invoice={invoice}
      bilingual={bilingual}
      className="rounded-xl border border-gray-200 shadow-xl"
    >
      <div className="px-8 py-6" style={{ fontFamily: 'Arial, Helvetica, "Almarai", sans-serif' }}>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500">{isQuotation ? 'Quotation' : 'Document'}</p>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-900">{invoiceTitle}</h1>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
            <p><span className="font-semibold text-slate-500">No.</span> {documentNumber}</p>
            <p className="mt-1"><span className="font-semibold text-slate-500">Date:</span> {formatDate(invoice?.issueDate || new Date())}</p>
            {isQuotation && invoice?.validUntil ? (
              <p className="mt-1"><span className="font-semibold text-slate-500">Valid until:</span> {formatDate(invoice.validUntil)}</p>
            ) : null}
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-slate-200 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
              {getCommercialCounterpartyLabel(documentType, 'en')} / {getCommercialCounterpartyLabel(documentType, 'ar')}
            </p>
            <p className="mt-2 text-base font-bold">{buyerName || '—'}</p>
            {bilingual && buyerNameAr && buyerNameAr !== buyerNameEn ? (
              <p className="text-sm text-slate-600" dir="rtl">{buyerNameAr}</p>
            ) : null}
            {buyerAddress ? <p className="mt-2 text-sm text-slate-600">{buyerAddress}</p> : null}
            {invoice?.buyer?.contactPhone ? <p className="mt-1 text-sm text-slate-600">{invoice.buyer.contactPhone}</p> : null}
          </div>
          <div className="rounded-xl border border-slate-200 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Details / التفاصيل</p>
            {invoice?.subject ? <p className="mt-2 text-sm"><span className="font-semibold">Subject:</span> {invoice.subject}</p> : null}
            {invoice?.transactionType ? <p className="mt-1 text-sm"><span className="font-semibold">Type:</span> {invoice.transactionType}</p> : null}
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
                    {line.raw?.description ? <p className="text-xs text-slate-500">{line.raw.description}</p> : null}
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

        <DocumentExtras invoice={invoice} invoiceBranding={invoiceBranding} language={language} bilingual={bilingual} />
      </div>
    </LetterheadChrome>
  )
}
