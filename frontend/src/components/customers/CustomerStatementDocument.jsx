import Money from '../ui/Money'

function fmtDate(value, locale = 'en-GB') {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' })
}

function addrLines(address = {}, ar = false) {
  if (!address || typeof address !== 'object') return []
  return [
    ar ? (address.streetAr || address.street) : (address.street || address.streetAr),
    ar ? (address.districtAr || address.district) : (address.district || address.districtAr),
    [ar ? (address.cityAr || address.city) : (address.city || address.cityAr), address.postalCode].filter(Boolean).join(' '),
    address.country,
  ].map((x) => String(x || '').trim()).filter(Boolean)
}

/**
 * Bilingual printable Statement of Account (EN left / AR right).
 */
export default function CustomerStatementDocument({ data, language = 'en' }) {
  if (!data) return null
  const company = data.company || {}
  const customer = data.customer || {}
  const period = data.period || {}
  const aging = data.aging || {}
  const bank = data.bankDetails || {}
  const rows = Array.isArray(data.statement) ? data.statement : []
  const currency = data.currency || 'SAR'

  return (
    <div className="soa-print mx-auto w-full max-w-[210mm] bg-white text-slate-900 shadow-sm print:shadow-none">
      {/* Header — EN left / AR right */}
      <div className="grid grid-cols-[1fr_auto_1fr] gap-3 border-b border-slate-200 px-6 pb-4 pt-6">
        <div className="text-left text-[11px] leading-relaxed">
          <p className="text-base font-semibold tracking-tight">{company.nameEn || '—'}</p>
          {addrLines(company.address, false).map((line) => (
            <p key={line} className="text-slate-600">{line}</p>
          ))}
          {company.vatNumber ? <p className="mt-1 text-slate-600">VAT: {company.vatNumber}</p> : null}
          {company.crNumber ? <p className="text-slate-600">CR: {company.crNumber}</p> : null}
        </div>
        <div className="flex flex-col items-center justify-center px-2 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">SOA</p>
          <p className="mt-1 text-sm font-bold">Statement of Account</p>
          <p className="font-['Almarai'] text-sm font-bold" dir="rtl">كشف حساب</p>
        </div>
        <div className="text-right font-['Almarai'] text-[11px] leading-relaxed" dir="rtl">
          <p className="text-base font-semibold">{company.nameAr || company.nameEn || '—'}</p>
          {addrLines(company.address, true).map((line) => (
            <p key={`ar-${line}`} className="text-slate-600">{line}</p>
          ))}
          {company.vatNumber ? <p className="mt-1 text-slate-600">الرقم الضريبي: {company.vatNumber}</p> : null}
          {company.crNumber ? <p className="text-slate-600">س.ت: {company.crNumber}</p> : null}
        </div>
      </div>

      {/* Customer + period */}
      <div className="grid grid-cols-2 gap-4 border-b border-slate-200 px-6 py-4 text-[12px]">
        <div className="text-left">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Customer</p>
          <p className="mt-1 font-semibold">{customer.nameEn || customer.name || '—'}</p>
          {customer.vatNumber ? <p className="text-slate-600">VAT: {customer.vatNumber}</p> : null}
          {customer.email ? <p className="text-slate-600">{customer.email}</p> : null}
          {customer.phone ? <p className="text-slate-600">{customer.phone}</p> : null}
        </div>
        <div className="text-right font-['Almarai']" dir="rtl">
          <p className="text-[10px] font-semibold text-slate-400">العميل</p>
          <p className="mt-1 font-semibold">{customer.nameAr || customer.nameEn || '—'}</p>
          {customer.vatNumber ? <p className="text-slate-600">الرقم الضريبي: {customer.vatNumber}</p> : null}
          <p className="mt-2 text-[11px] text-slate-500" dir="ltr">
            {period.startDate} — {period.endDate}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-3 text-[12px]">
        <div>
          <span className="text-slate-500">Opening / افتتاحي: </span>
          <span className="font-semibold tabular-nums" dir="ltr">
            <Money value={data.openingBalance} /> {currency}
          </span>
        </div>
        <div>
          <span className="text-slate-500">Closing / إقفال: </span>
          <span className="font-semibold tabular-nums text-teal-800" dir="ltr">
            <Money value={data.closingBalance} /> {currency}
          </span>
        </div>
      </div>

      <div className="overflow-x-auto px-4 py-2">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500">
              <th className="px-2 py-2 text-left font-medium">Date<br /><span className="font-['Almarai'] font-normal" dir="rtl">التاريخ</span></th>
              <th className="px-2 py-2 text-left font-medium">Document<br /><span className="font-['Almarai'] font-normal" dir="rtl">المستند</span></th>
              <th className="px-2 py-2 text-left font-medium">Description<br /><span className="font-['Almarai'] font-normal" dir="rtl">البيان</span></th>
              <th className="px-2 py-2 text-right font-medium">Debit<br /><span className="font-['Almarai'] font-normal" dir="rtl">مدين</span></th>
              <th className="px-2 py-2 text-right font-medium">Credit<br /><span className="font-['Almarai'] font-normal" dir="rtl">دائن</span></th>
              <th className="px-2 py-2 text-right font-medium">Balance<br /><span className="font-['Almarai'] font-normal" dir="rtl">الرصيد</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={`${row.id}-${i}`} className={`border-b border-slate-100 ${row.type === 'opening' ? 'bg-slate-50' : ''}`}>
                <td className="px-2 py-1.5 tabular-nums text-slate-600">{fmtDate(row.date, language === 'ar' ? 'ar-SA' : 'en-GB')}</td>
                <td className="px-2 py-1.5 font-medium">{row.documentNumber || row.id || '—'}</td>
                <td className="px-2 py-1.5 text-slate-600">
                  <span className="block">{row.descriptionEn || row.desc || '—'}</span>
                  {row.descriptionAr && row.descriptionAr !== row.descriptionEn ? (
                    <span className="block font-['Almarai'] text-[10px] text-slate-400" dir="rtl">{row.descriptionAr}</span>
                  ) : null}
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums text-rose-700">
                  {Number(row.debit) > 0 ? <Money value={row.debit} /> : '—'}
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums text-emerald-700">
                  {Number(row.credit) > 0 ? <Money value={row.credit} /> : '—'}
                </td>
                <td className="px-2 py-1.5 text-right font-semibold tabular-nums" dir="ltr">
                  <Money value={row.balance} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Aging */}
      <div className="mx-6 mb-4 mt-4 rounded-xl border border-slate-200 p-4">
        <div className="mb-2 flex items-center justify-between text-[11px] font-semibold">
          <span>Aging summary</span>
          <span className="font-['Almarai']" dir="rtl">ملخص الأعمار</span>
        </div>
        <div className="grid grid-cols-5 gap-2 text-center text-[11px]">
          {[
            { k: 'd0_30', en: '0–30', ar: '٠–٣٠' },
            { k: 'd31_60', en: '31–60', ar: '٣١–٦٠' },
            { k: 'd61_90', en: '61–90', ar: '٦١–٩٠' },
            { k: 'd90_plus', en: '90+', ar: '٩٠+' },
            { k: 'total', en: 'Total', ar: 'الإجمالي' },
          ].map((b) => (
            <div key={b.k} className={`rounded-lg px-2 py-2 ${b.k === 'total' ? 'bg-teal-50' : 'bg-slate-50'}`}>
              <p className="text-[10px] text-slate-500">{b.en} / <span className="font-['Almarai']" dir="rtl">{b.ar}</span></p>
              <p className="mt-1 font-semibold tabular-nums" dir="ltr"><Money value={aging[b.k] || 0} /></p>
            </div>
          ))}
        </div>
        {data.consistency ? (
          <p className={`mt-2 text-[10px] ${data.consistency.match ? 'text-emerald-700' : 'text-amber-700'}`}>
            {data.consistency.match
              ? 'Closing = Directory receivable = Aged AR total ✓'
              : `Check: close ${Number(data.consistency.closingBalance).toFixed(2)} · directory ${Number(data.consistency.directoryReceivable).toFixed(2)} · aged ${Number(data.consistency.agedArTotal).toFixed(2)}`}
          </p>
        ) : null}
      </div>

      {/* Bank footer */}
      {(bank.bankName || bank.iban || bank.accountNumber) ? (
        <div className="border-t border-slate-200 px-6 py-4 text-[11px]">
          <div className="flex items-start justify-between gap-4">
            <div className="text-left">
              <p className="font-semibold text-slate-700">Bank details for payment</p>
              {bank.bankName ? <p>{bank.bankName}</p> : null}
              {bank.accountName ? <p>{bank.accountName}</p> : null}
              {bank.iban ? <p>IBAN: {bank.iban}</p> : null}
              {!bank.iban && bank.accountNumber ? <p>Account: {bank.accountNumber}</p> : null}
            </div>
            <div className="text-right font-['Almarai']" dir="rtl">
              <p className="font-semibold text-slate-700">بيانات البنك للسداد</p>
              {bank.bankName ? <p>{bank.bankName}</p> : null}
              {bank.accountName ? <p>{bank.accountName}</p> : null}
              {bank.iban ? <p>آيبان: {bank.iban}</p> : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
