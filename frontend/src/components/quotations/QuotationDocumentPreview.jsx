import { getInvoiceBranding } from '../../lib/invoiceBranding'
import { formatCurrency } from '../../lib/currency'
import NaturalStamp from '../invoices/NaturalStamp'

const formatDate = (value, language = 'en') => {
  if (!value) return '—'
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  })
}

const joinAddress = (address = {}) =>
  [
    address?.buildingNumber,
    address?.additionalNumber,
    address?.street,
    address?.district,
    address?.city,
    address?.postalCode,
    address?.country,
  ].filter(Boolean)

const pickLocalizedText = (primary, secondary) => primary || secondary || '—'

const getStatusLabel = (status, language = 'en') => {
  const value = String(status || 'draft').trim().toLowerCase()
  const map = {
    draft:     language === 'ar' ? 'مسودة'      : 'Draft',
    sent:      language === 'ar' ? 'مرسل'       : 'Sent',
    accepted:  language === 'ar' ? 'مقبول'      : 'Accepted',
    approved:  language === 'ar' ? 'معتمد'      : 'Approved',
    rejected:  language === 'ar' ? 'مرفوض'     : 'Rejected',
    expired:   language === 'ar' ? 'منتهي'      : 'Expired',
    cancelled: language === 'ar' ? 'ملغي'       : 'Cancelled',
    converted: language === 'ar' ? 'تم التحويل' : 'Converted',
  }
  return map[value] || status || '—'
}

const getStatusTone = (status) => {
  const value = String(status || 'draft').trim().toLowerCase()
  if (value === 'accepted')  return 'bg-emerald-50 text-emerald-700 border-emerald-200'
  if (value === 'approved')  return 'bg-teal-50 text-teal-700 border-teal-200'
  if (value === 'converted') return 'bg-violet-50 text-violet-700 border-violet-200'
  if (value === 'sent')      return 'bg-sky-50 text-sky-700 border-sky-200'
  if (value === 'rejected' || value === 'cancelled') return 'bg-rose-50 text-rose-700 border-rose-200'
  if (value === 'expired')   return 'bg-amber-50 text-amber-700 border-amber-200'
  return 'bg-slate-50 text-slate-600 border-slate-200'
}

export default function QuotationDocumentPreview({ quotation, tenant, language = 'en' }) {
  const branding = getInvoiceBranding(tenant, language, quotation?.businessContext || 'trading')
  const logoSrc = branding?.logoSrc || tenant?.business?.logoUrl || tenant?.branding?.logo || '/maqdernewlogo.webp'

  const companyName = language === 'ar'
    ? pickLocalizedText(tenant?.business?.legalNameAr, tenant?.business?.legalNameEn)
    : pickLocalizedText(tenant?.business?.legalNameEn, tenant?.business?.legalNameAr)
  const companySecondary = language === 'ar'
    ? pickLocalizedText(tenant?.business?.legalNameEn, tenant?.business?.legalNameAr)
    : pickLocalizedText(tenant?.business?.legalNameAr, tenant?.business?.legalNameEn)

  const buyerName = language === 'ar'
    ? pickLocalizedText(quotation?.buyer?.nameAr, quotation?.buyer?.name)
    : pickLocalizedText(quotation?.buyer?.name, quotation?.buyer?.nameAr)
  const buyerAddress = joinAddress(quotation?.buyer?.address || {})

  const currency = quotation?.currency || 'SAR'
  const lineItems = Array.isArray(quotation?.lineItems) ? quotation.lineItems : []
  const totals = {
    subtotal:      Number(quotation?.subtotal || 0),
    totalDiscount: Number(quotation?.totalDiscount || quotation?.invoiceDiscount || 0),
    totalTax:      Number(quotation?.totalTax || 0),
    grandTotal:    Number(quotation?.grandTotal || 0),
  }
  const itemCount = lineItems.length

  return (
    /* â”€â”€ Outer wrapper: pure white, no dark bg anywhere â”€â”€ */
    <div className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_28px_90px_-48px_rgba(15,23,42,0.18)]">

      {/* Top accent stripe — uses CSS variable so it matches brand color */}
      <div style={{ background: 'var(--color-primary-500, #16a34a)', height: 3 }} />

      {/* Watermark logo — very faint */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        {logoSrc ? <img src={logoSrc} alt="" className="h-56 w-56 object-contain opacity-[0.03]" /> : null}
      </div>

      <div className="relative px-7 pb-8 pt-7">

        {/* â”€â”€ Section 1: Header â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_268px] lg:items-start">

          {/* Left: Logo + company */}
          <div className="flex items-center gap-5">
            <div className="flex h-32 w-32 shrink-0 items-center justify-center overflow-hidden rounded-[1.25rem] border border-slate-200 bg-white p-3 shadow-sm">
              {logoSrc ? (
                <img src={logoSrc} alt="" className="h-full w-full object-contain" />
              ) : (
                <span className="text-2xl font-bold tracking-[0.25em] text-slate-500">{companyName.slice(0, 2)}</span>
              )}
            </div>
            <div className="min-w-0 flex-1 pt-1">
              <p className="text-[10px] uppercase tracking-[0.3em] text-slate-400">
                {language === 'ar' ? 'عرض سعر احترافي / Commercial Quotation' : 'Commercial Quotation / عرض سعر احترافي'}
              </p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
                {language === 'ar' ? 'عرض سعر' : 'Quotation'}
              </h2>
              <p className="mt-1.5 text-sm font-bold text-slate-900">{tenant?.business?.legalNameEn || tenant?.name}</p>
              {tenant?.business?.legalNameAr && (
                <p className="mt-0.5 text-sm font-bold text-slate-900" dir="rtl">{tenant.business.legalNameAr}</p>
              )}
            </div>
          </div>

          {/* Right: meta card — light only */}
          <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
            <div className="flex items-center justify-between gap-3 mb-4">
              <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">
                {language === 'ar' ? 'الحالة' : 'Status'}
              </p>
              <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getStatusTone(quotation?.status)}`}>
                {getStatusLabel(quotation?.status, language)}
              </span>
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">
                  {language === 'ar' ? 'رقم العرض' : 'Quotation #'}
                </p>
                <p className="mt-1 text-lg font-bold text-slate-900 tracking-tight">
                  {quotation?.quotationNumber || '—'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.16em] text-slate-400">
                    {language === 'ar' ? 'تاريخ الإصدار' : 'Issue Date'}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-800">
                    {formatDate(quotation?.issueDate, language)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.16em] text-slate-400">
                    {language === 'ar' ? 'صالح حتى' : 'Valid Until'}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-800">
                    {formatDate(quotation?.validUntil, language)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* â”€â”€ Section 1.5: Subject â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        {quotation?.subject && (
          <div className="mt-6 rounded-[1.5rem] border border-slate-200 bg-white p-5">
            <p className="text-[10px] uppercase tracking-[0.25em] text-slate-400 mb-2">
              {language === 'ar' ? 'الموضوع' : 'Subject'}
            </p>
            <p className="text-base font-semibold text-slate-900">
              {language === 'ar'
                ? pickLocalizedText(quotation?.subjectAr, quotation?.subject)
                : pickLocalizedText(quotation?.subject, quotation?.subjectAr)}
            </p>
          </div>
        )}

        {/* â”€â”€ Section 2: FROM / TO â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <div className="mt-6 grid gap-4 lg:grid-cols-2">

          {/* FROM — white card */}
          <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5">
            <p className="text-[10px] uppercase tracking-[0.25em] text-slate-400 mb-3">
              Prepared By / <span dir="rtl">إعداد من</span>
            </p>
            <p className="text-base font-bold text-slate-900">{tenant?.business?.legalNameEn || tenant?.name}</p>
            {tenant?.business?.legalNameAr && (
              <p className="text-sm font-bold text-slate-700 mt-0.5" dir="rtl">{tenant.business.legalNameAr}</p>
            )}
            <div className="mt-3 space-y-1.5 text-sm text-slate-600">
              {tenant?.business?.vatNumber && (
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 text-[11px] w-16 shrink-0">VAT / ض.ق</span>
                  <span className="font-medium text-slate-800">{tenant.business.vatNumber}</span>
                </div>
              )}
              {tenant?.business?.crNumber && (
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 text-[11px] w-16 shrink-0">CR / س.ت</span>
                  <span className="font-medium text-slate-800">{tenant.business.crNumber}</span>
                </div>
              )}
              {tenant?.business?.contactEmail && (
                <div className="flex items-start gap-2">
                  <span className="text-slate-400 text-[11px] w-16 shrink-0 mt-0.5">Email / بريد</span>
                  <span className="font-medium text-slate-800 break-all">{tenant.business.contactEmail}</span>
                </div>
              )}
            </div>
          </div>

          {/* TO — light blue tint card */}
          <div className="rounded-[1.5rem] border border-blue-100 bg-blue-50/50 p-5">
            <p className="text-[10px] uppercase tracking-[0.25em] text-blue-400 mb-3">
              Prepared For / <span dir="rtl">مُعدَّ لـ</span>
            </p>
            <p className="text-base font-bold text-slate-900">{quotation?.buyer?.name || '—'}</p>
            {quotation?.buyer?.nameAr && (
              <p className="text-sm font-bold text-slate-700 mt-0.5" dir="rtl">{quotation.buyer.nameAr}</p>
            )}
            <div className="mt-3 space-y-1.5 text-sm text-slate-600">
              {quotation?.buyer?.vatNumber && (
                <div className="flex items-center gap-2">
                  <span className="text-blue-400 text-[11px] w-16 shrink-0">VAT / ض.ق</span>
                  <span className="font-medium text-slate-800">{quotation.buyer.vatNumber}</span>
                </div>
              )}
              {quotation?.buyer?.contactPhone && (
                <div className="flex items-center gap-2">
                  <span className="text-blue-400 text-[11px] w-16 shrink-0">Tel / هاتف</span>
                  <span className="font-medium text-slate-800">{quotation.buyer.contactPhone}</span>
                </div>
              )}
              {quotation?.buyer?.contactEmail && (
                <div className="flex items-start gap-2">
                  <span className="text-blue-400 text-[11px] w-16 shrink-0 mt-0.5">Email / بريد</span>
                  <span className="font-medium text-slate-800 break-all">{quotation.buyer.contactEmail}</span>
                </div>
              )}
            </div>
            {buyerAddress.length > 0 && (
              <div className="mt-4 rounded-xl border border-blue-100 bg-white/80 px-4 py-3">
                <p className="text-[10px] uppercase tracking-[0.18em] text-blue-400 mb-2">
                  Address / العنوان
                </p>
                <div className="space-y-0.5 text-xs text-slate-700 font-medium">
                  {buyerAddress.map((line, i) => <p key={`${line}-${i}`}>{line}</p>)}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* â”€â”€ Section 3: Line items table â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <div className="mt-6 overflow-hidden rounded-[1.5rem] border border-slate-200">
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead>
              <tr className="bg-slate-50">
                <th className="px-4 py-3 text-start text-[11px] font-semibold uppercase tracking-wider text-slate-500">#</th>
                <th className="px-4 py-3 text-start text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  {language === 'ar' ? 'البند' : 'Item'}
                </th>
                <th className="px-4 py-3 text-start text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  {language === 'ar' ? 'الوصف' : 'Description'}
                </th>
                <th className="px-4 py-3 text-end text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  {language === 'ar' ? 'الكمية' : 'Qty'}
                </th>
                <th className="px-4 py-3 text-end text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  {language === 'ar' ? 'السعر' : 'Price'}
                </th>
                <th className="px-4 py-3 text-end text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  {language === 'ar' ? 'الإجمالي' : 'Total'}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
              {lineItems.length > 0 ? lineItems.map((line, index) => {
                const itemName = language === 'ar'
                  ? pickLocalizedText(line?.productNameAr, line?.productName)
                  : pickLocalizedText(line?.productName, line?.productNameAr)
                const rawDescription = language === 'ar'
                  ? pickLocalizedText(line?.descriptionAr, line?.description)
                  : pickLocalizedText(line?.description, line?.descriptionAr)
                const description = (rawDescription || '')
                  .replace(/\b(exclusions?|excl)\b/gi, '\n$1')
                  .replace(/\n{2,}/g, '\n')
                  .trim()
                const isEven = index % 2 === 1
                return (
                  <tr key={`${line?._id || index}`} className={isEven ? 'bg-slate-50/50' : 'bg-white'}>
                    <td className="px-4 py-3.5 text-slate-400 text-xs">{index + 1}</td>
                    <td className="px-4 py-3.5 font-semibold text-slate-900">{itemName}</td>
                    <td className="px-4 py-3.5 font-semibold text-slate-700 whitespace-pre-line">{description}</td>
                    <td className="px-4 py-3.5 text-end">
                      <div className="text-slate-700">{Number(line?.quantity || 0)}</div>
                      {line?.raw?.unitCode && <div className="text-[10px] text-slate-400 mt-0.5">{line.raw.unitCode}</div>}
                      {line?.unitCode && (
                        <div className="text-[10px] text-slate-500 font-semibold">{line.unitCode}</div>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-end text-slate-700">{formatCurrency(line?.unitPrice || 0, { language, currency })}</td>
                    <td className="px-4 py-3.5 text-end font-bold text-slate-900">{formatCurrency(line?.lineTotalWithTax || line?.lineTotal || 0, { language, currency })}</td>
                  </tr>
                )
              }) : (
                <tr>
                  <td className="px-4 py-8 text-center text-slate-400" colSpan="6">
                    {language === 'ar' ? 'لا توجد بنود' : 'No quotation items'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* â”€â”€ Section 4: Totals + Notes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">

          {/* Notes */}
          <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50/60 p-5">
            <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400 mb-3">
              Quotation Notes / ملاحظات العرض
            </p>
            <p className="whitespace-pre-line text-sm leading-7 text-slate-600">
              {quotation?.notes || '—'}
            </p>
            {quotation?.notesAr && (
              <p className="whitespace-pre-line text-sm leading-7 text-slate-600 mt-2" dir="rtl">
                {quotation.notesAr}
              </p>
            )}
          </div>

          {/* Totals */}
          <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50/60 p-5">
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">{language === 'ar' ? 'عدد البنود' : 'Items'}</span>
                <span className="font-semibold text-slate-800">{itemCount}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">{language === 'ar' ? 'الإجمالي الفرعي' : 'Subtotal'}</span>
                <span className="font-semibold text-slate-800">{formatCurrency(totals.subtotal, { language, currency })}</span>
              </div>
              {totals.totalDiscount > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">{language === 'ar' ? 'الخصم' : 'Discount'}</span>
                  <span className="font-semibold text-rose-600">âˆ’ {formatCurrency(totals.totalDiscount, { language, currency })}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">{language === 'ar' ? 'الضريبة (VAT)' : 'VAT'}</span>
                <span className="font-semibold text-slate-800">{formatCurrency(totals.totalTax, { language, currency })}</span>
              </div>
            </div>

            {/* Grand total — light accent row */}
            <div className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-3.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {language === 'ar' ? 'الإجمالي النهائي' : 'Grand Total'}
                </span>
                <span className="text-xl font-bold tracking-tight text-slate-900">
                  {formatCurrency(totals.grandTotal, { language, currency })}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Section 4.5: Terms & Conditions ──────────────────────── */}
        {quotation?.termsAndConditions && (
          <div className="mt-6 rounded-[1.5rem] border border-amber-100 bg-amber-50/30 p-5">
            <p className="text-[10px] uppercase tracking-[0.2em] text-amber-600 mb-3 font-bold">
              Terms &amp; Conditions / الشروط والأحكام
            </p>
            <p className="whitespace-pre-line text-sm leading-7 text-slate-700 font-medium">
              {quotation.termsAndConditions}
            </p>
            {quotation?.termsAndConditionsAr && (
              <p className="whitespace-pre-line text-sm leading-7 text-slate-700 font-medium mt-3 border-t border-amber-100 pt-3" dir="rtl">
                {quotation.termsAndConditionsAr}
              </p>
            )}
          </div>
        )}

        {/* â”€â”€ Authorized Signature / Stamp â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        {/* ── Authorized Signature / Stamp ───────────────────── */}
        {(quotation?.authorizedPersonSignature || branding?.signatureImage || branding?.stampImage) && (
          <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_220px]">
            <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5">
              <p className="text-[10px] uppercase tracking-[0.25em] text-slate-400 mb-3">
                {language === 'ar' ? 'الموثّق / المفوّض' : 'Authorized By'}
              </p>
              <div className="flex items-start gap-4">
                {(quotation?.authorizedPersonSignature || branding?.signatureImage) && (
                  <img
                    src={quotation?.authorizedPersonSignature || branding?.signatureImage}
                    alt="Signature"
                    className="h-20 max-w-[200px] object-contain mix-blend-multiply"
                  />
                )}
                <div>
                  <p className="font-bold text-slate-900">
                    {language === 'ar'
                      ? pickLocalizedText(quotation?.authorizedPersonNameAr, quotation?.authorizedPersonName)
                      : pickLocalizedText(quotation?.authorizedPersonName, quotation?.authorizedPersonNameAr)}
                  </p>
                  {quotation?.authorizedPersonDesignation && (
                    <p className="text-sm text-slate-500 mt-1">
                      {language === 'ar'
                        ? pickLocalizedText(quotation?.authorizedPersonDesignationAr, quotation?.authorizedPersonDesignation)
                        : pickLocalizedText(quotation?.authorizedPersonDesignation, quotation?.authorizedPersonDesignationAr)}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-[1.5rem] border border-slate-200 bg-white p-4 flex items-center justify-center">
              <NaturalStamp
                stampImage={quotation?.stampImage || branding?.stampImage}
                companyName={companyName}
                companyNameAr={tenant?.business?.legalNameAr || ''}
                crNumber={tenant?.business?.crNumber || ''}
                vatNumber={tenant?.business?.vatNumber || ''}
                language={language}
                size="md"
              />
            </div>
          </div>
        )}

        {/* â”€â”€ Footer â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <div className="mt-6 pt-4 border-t border-slate-100">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px] text-slate-400">
            <div className="space-y-1">
              <p className="font-semibold text-slate-500">{companyName}</p>
              <p>
                {tenant?.business?.vatNumber ? `${language === 'ar' ? 'الرقم الضريبي' : 'VAT'}: ${tenant.business.vatNumber}` : ''}
                {tenant?.business?.vatNumber && tenant?.business?.crNumber ? ' Â· ' : ''}
                {tenant?.business?.crNumber ? `CR: ${tenant.business.crNumber}` : ''}
              </p>
              <p>
                {tenant?.business?.contactPhone ? `${language === 'ar' ? 'الهاتف' : 'Phone'}: ${tenant.business.contactPhone}` : ''}
              </p>
            </div>
            <div className={`space-y-1 ${language === 'ar' ? 'sm:text-start' : 'sm:text-end'}`}>
              {tenant?.business?.contactEmail && (
                <p>{language === 'ar' ? 'البريد' : 'Email'}: {tenant.business.contactEmail}</p>
              )}
              {tenant?.business?.website && (
                <p>{language === 'ar' ? 'الموقع' : 'Website'}: {tenant.business.website}</p>
              )}
              <p>{language === 'ar' ? 'وثيقة سرية' : 'Confidential Document'}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
