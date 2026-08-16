import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import api from '../../lib/api'
import Money from '../../components/ui/Money'

const todayIso = () => new Date().toISOString().slice(0, 10)
const yearStartIso = () => new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10)

function DateRangeBar({ from, to, setFrom, setTo, language, extra }) {
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-[1.4rem] border border-white/80 bg-white/85 p-4 shadow-[0_14px_36px_-28px_rgba(15,23,42,0.35)] dark:border-white/10 dark:bg-dark-800">
      <label className="text-xs font-medium text-slate-500">
        {language === 'ar' ? 'من' : 'From'}
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 block rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-dark-600 dark:bg-dark-900" />
      </label>
      <label className="text-xs font-medium text-slate-500">
        {language === 'ar' ? 'إلى' : 'To'}
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 block rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-dark-600 dark:bg-dark-900" />
      </label>
      {extra}
    </div>
  )
}

function JournalCards({ rows, language, empty, onPost, posting }) {
  if (!rows?.length) {
    return (
      <div className="rounded-[1.5rem] border border-dashed border-emerald-200/80 bg-white/70 py-14 text-center dark:border-emerald-500/20 dark:bg-dark-800/60">
        <p className="text-sm font-semibold text-slate-600 dark:text-slate-200">{empty}</p>
      </div>
    )
  }
  return (
    <div className="space-y-3">
      {rows.map((j) => (
        <div key={j._id} className="rounded-[1.4rem] border border-white/80 bg-white/90 p-5 shadow-[0_14px_36px_-28px_rgba(15,23,42,0.35)] dark:border-white/10 dark:bg-dark-800">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-semibold text-slate-900 dark:text-white">{j.entryNumber}</p>
              <p className="text-sm text-slate-500">{j.memo || '—'}</p>
              <p className="mt-1 text-xs text-slate-400">{new Date(j.entryDate).toLocaleDateString()} · {j.type}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
                j.status === 'posted' ? 'bg-emerald-50 text-emerald-700' : j.status === 'void' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'
              }`}>{j.status}</span>
              {j.status === 'draft' && onPost && (
                <button
                  type="button"
                  onClick={() => onPost(j._id)}
                  disabled={posting}
                  className="rounded-full bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                >
                  {language === 'ar' ? 'ترحيل' : 'Post'}
                </button>
              )}
            </div>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead className="text-slate-400">
                <tr>
                  <th className="py-1 text-start">{language === 'ar' ? 'الحساب' : 'Account'}</th>
                  <th className="py-1 text-end">{language === 'ar' ? 'مدين' : 'Debit'}</th>
                  <th className="py-1 text-end">{language === 'ar' ? 'دائن' : 'Credit'}</th>
                </tr>
              </thead>
              <tbody>
                {(j.lines || []).map((line, idx) => (
                  <tr key={idx} className="border-t border-slate-50 dark:border-dark-700">
                    <td className="py-2">{line.accountCode} · {line.accountName}</td>
                    <td className="py-2 text-end"><Money value={line.debit || 0} /></td>
                    <td className="py-2 text-end"><Money value={line.credit || 0} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  )
}

export function DailyRestrictionPanel({ language, onNew, onPost, posting }) {
  const [q, setQ] = useState('')
  const day = todayIso()
  const { data } = useQuery({
    queryKey: ['accounting-daily', day, q],
    queryFn: () => api.get('/accounting/journals', { params: { from: day, to: day, limit: 100, q: q || undefined } }).then((r) => r.data),
  })
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">{language === 'ar' ? `قيود يوم ${day}` : `Entries for ${day}`}</p>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={language === 'ar' ? 'بحث برقم القيد أو البيان…' : 'Search entry or memo…'}
              className="rounded-xl border border-slate-200 py-2 ps-9 pe-3 text-sm dark:border-dark-600 dark:bg-dark-900"
            />
          </div>
          <button type="button" onClick={onNew} className="rounded-2xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800">
            {language === 'ar' ? 'قيد جديد' : 'New restriction'}
          </button>
        </div>
      </div>
      <JournalCards
        rows={data?.rows}
        language={language}
        onPost={onPost}
        posting={posting}
        empty={language === 'ar' ? 'لا قيود لهذا اليوم' : 'No daily restrictions yet'}
      />
    </div>
  )
}

export function GeneralVoucherPanel({ language, onNew, onPost, posting }) {
  const [q, setQ] = useState('')
  const { data } = useQuery({
    queryKey: ['accounting-general-vouchers', q],
    queryFn: () => api.get('/accounting/journals', { params: { type: 'manual', limit: 100, q: q || undefined } }).then((r) => r.data),
  })
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">{language === 'ar' ? 'سندات القيد العام' : 'Manual general vouchers'}</p>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={language === 'ar' ? 'بحث…' : 'Search…'}
              className="rounded-xl border border-slate-200 py-2 ps-9 pe-3 text-sm dark:border-dark-600 dark:bg-dark-900"
            />
          </div>
          <button type="button" onClick={onNew} className="rounded-2xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800">
            {language === 'ar' ? 'سند جديد' : 'New voucher'}
          </button>
        </div>
      </div>
      <JournalCards
        rows={data?.rows}
        language={language}
        onPost={onPost}
        posting={posting}
        empty={language === 'ar' ? 'لا توجد سندات عامة' : 'No general vouchers yet'}
      />
    </div>
  )
}

export function AccountReportPanel({ language }) {
  const [accountId, setAccountId] = useState('')
  const [from, setFrom] = useState(yearStartIso())
  const [to, setTo] = useState(todayIso())
  const { data: accounts = [] } = useQuery({
    queryKey: ['accounting-accounts'],
    queryFn: () => api.get('/accounting/accounts').then((r) => r.data),
  })
  const { data, isFetching } = useQuery({
    queryKey: ['accounting-ledger', accountId, from, to],
    queryFn: () => api.get(`/accounting/reports/general-ledger/${accountId}`, { params: { from, to } }).then((r) => r.data),
    enabled: Boolean(accountId),
  })

  return (
    <div className="space-y-4">
      <DateRangeBar
        from={from}
        to={to}
        setFrom={setFrom}
        setTo={setTo}
        language={language}
        extra={(
          <label className="min-w-[220px] flex-1 text-xs font-medium text-slate-500">
            {language === 'ar' ? 'الحساب' : 'Account'}
            <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-dark-600 dark:bg-dark-900">
              <option value="">{language === 'ar' ? 'اختر حساب' : 'Select account'}</option>
              {accounts.map((a) => (
                <option key={a._id} value={a._id}>{a.code} — {language === 'ar' ? (a.nameAr || a.name) : a.name}</option>
              ))}
            </select>
          </label>
        )}
      />
      {!accountId && <p className="py-12 text-center text-sm text-slate-400">{language === 'ar' ? 'اختر حساباً لعرض كشف الحركة' : 'Select an account to view its ledger'}</p>}
      {accountId && (
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-dark-600 dark:bg-dark-800">
          <div className="border-b border-slate-100 px-5 py-4 dark:border-dark-600">
            <h3 className="font-semibold">{data?.account?.code} · {language === 'ar' ? (data?.account?.nameAr || data?.account?.name) : data?.account?.name}</h3>
            {isFetching && <p className="text-xs text-slate-400">{language === 'ar' ? 'جاري التحميل…' : 'Loading…'}</p>}
          </div>
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-[0.12em] text-slate-400 dark:bg-dark-900">
              <tr>
                <th className="px-4 py-3 text-start">{language === 'ar' ? 'التاريخ' : 'Date'}</th>
                <th className="px-4 py-3 text-start">{language === 'ar' ? 'القيد' : 'Entry'}</th>
                <th className="px-4 py-3 text-start">{language === 'ar' ? 'البيان' : 'Memo'}</th>
                <th className="px-4 py-3 text-end">{language === 'ar' ? 'مدين' : 'Debit'}</th>
                <th className="px-4 py-3 text-end">{language === 'ar' ? 'دائن' : 'Credit'}</th>
                <th className="px-4 py-3 text-end">{language === 'ar' ? 'الرصيد' : 'Balance'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-dark-600">
              {(data?.lines || []).map((line) => (
                <tr key={`${line.entryId}-${line.entryNumber}-${line.balance}`}>
                  <td className="px-4 py-2.5">{line.entryDate ? new Date(line.entryDate).toLocaleDateString() : '—'}</td>
                  <td className="px-4 py-2.5 font-mono text-xs">{line.entryNumber}</td>
                  <td className="px-4 py-2.5">{line.memo || line.reference || '—'}</td>
                  <td className="px-4 py-2.5 text-end"><Money value={line.debit} /></td>
                  <td className="px-4 py-2.5 text-end"><Money value={line.credit} /></td>
                  <td className="px-4 py-2.5 text-end font-semibold"><Money value={line.balance} /></td>
                </tr>
              ))}
              {(!data?.lines || data.lines.length === 0) && (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400">{language === 'ar' ? 'لا توجد حركات' : 'No movements in this period'}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export function CustomerAccountPanel({ language }) {
  const [customerId, setCustomerId] = useState(new URLSearchParams(window.location.search).get('customerId') || '')
  const [from, setFrom] = useState(yearStartIso())
  const [to, setTo] = useState(todayIso())
  const { data: customers = [] } = useQuery({
    queryKey: ['accounting-customers'],
    queryFn: () => api.get('/accounting/parties/customers').then((r) => Array.isArray(r.data) ? r.data : (r.data?.customers || [])),
  })
  const { data, isFetching } = useQuery({
    queryKey: ['accounting-customer-account', customerId, from, to],
    queryFn: () => api.get('/accounting/reports/customer-account', { params: { customerId, from, to } }).then((r) => r.data),
    enabled: Boolean(customerId),
  })

  return (
    <div className="space-y-4">
      <DateRangeBar
        from={from}
        to={to}
        setFrom={setFrom}
        setTo={setTo}
        language={language}
        extra={(
          <label className="min-w-[220px] flex-1 text-xs font-medium text-slate-500">
            {language === 'ar' ? 'العميل' : 'Customer'}
            <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-dark-600 dark:bg-dark-900">
              <option value="">{language === 'ar' ? 'اختر عميلاً' : 'Select customer'}</option>
              {customers.map((c) => (
                <option key={c._id} value={c._id}>{c.name}{c.phone ? ` · ${c.phone}` : ''}</option>
              ))}
            </select>
          </label>
        )}
      />
      {data && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-dark-600 dark:bg-dark-800">
            <p className="text-[11px] uppercase tracking-widest text-slate-400">{language === 'ar' ? 'افتتاحي' : 'Opening'}</p>
            <p className="mt-1 text-lg font-semibold"><Money value={data.openingBalance} /></p>
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-dark-600 dark:bg-dark-800">
            <p className="text-[11px] uppercase tracking-widest text-slate-400">{language === 'ar' ? 'الختامي' : 'Closing'}</p>
            <p className="mt-1 text-lg font-semibold"><Money value={data.closingBalance} /></p>
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-dark-600 dark:bg-dark-800">
            <p className="text-[11px] uppercase tracking-widest text-slate-400">{data.customer?.name}</p>
            <p className="mt-1 text-sm text-slate-500">{isFetching ? (language === 'ar' ? 'جاري التحميل…' : 'Loading…') : (data.customer?.phone || '—')}</p>
          </div>
        </div>
      )}
      {customerId && (
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-dark-600 dark:bg-dark-800">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-[0.12em] text-slate-400 dark:bg-dark-900">
              <tr>
                <th className="px-4 py-3 text-start">{language === 'ar' ? 'التاريخ' : 'Date'}</th>
                <th className="px-4 py-3 text-start">{language === 'ar' ? 'المرجع' : 'Ref'}</th>
                <th className="px-4 py-3 text-start">{language === 'ar' ? 'البيان' : 'Memo'}</th>
                <th className="px-4 py-3 text-end">{language === 'ar' ? 'مدين' : 'Debit'}</th>
                <th className="px-4 py-3 text-end">{language === 'ar' ? 'دائن' : 'Credit'}</th>
                <th className="px-4 py-3 text-end">{language === 'ar' ? 'الرصيد' : 'Balance'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-dark-600">
              {(data?.lines || []).map((line, idx) => (
                <tr key={`${line.ref}-${idx}`}>
                  <td className="px-4 py-2.5">{line.date ? new Date(line.date).toLocaleDateString() : '—'}</td>
                  <td className="px-4 py-2.5 font-mono text-xs">{line.ref}</td>
                  <td className="px-4 py-2.5">{line.memo}</td>
                  <td className="px-4 py-2.5 text-end"><Money value={line.debit} /></td>
                  <td className="px-4 py-2.5 text-end"><Money value={line.credit} /></td>
                  <td className="px-4 py-2.5 text-end font-semibold"><Money value={line.balance} /></td>
                </tr>
              ))}
              {customerId && (!data?.lines || data.lines.length === 0) && (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400">{language === 'ar' ? 'لا توجد حركات' : 'No movements in this period'}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function SummaryTable({ rows, totals, language, kind, search, onOpen }) {
  const isSupplier = kind === 'supplier'
  const q = String(search || '').trim().toLowerCase()
  const filtered = (rows || []).filter((row) => !q || String(row.name || '').toLowerCase().includes(q))
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-dark-600 dark:bg-dark-800">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 text-[11px] uppercase tracking-[0.12em] text-slate-400 dark:bg-dark-900">
          <tr>
            <th className="px-4 py-3 text-start">{isSupplier ? (language === 'ar' ? 'المورد' : 'Supplier') : (language === 'ar' ? 'العميل' : 'Customer')}</th>
            <th className="px-4 py-3 text-end">{language === 'ar' ? 'الفواتير' : 'Invoices'}</th>
            <th className="px-4 py-3 text-end">{language === 'ar' ? 'المفوتر' : 'Invoiced'}</th>
            <th className="px-4 py-3 text-end">{language === 'ar' ? 'المدفوع' : 'Paid'}</th>
            <th className="px-4 py-3 text-end">{isSupplier ? (language === 'ar' ? 'سندات الصرف' : 'Payments') : (language === 'ar' ? 'سندات القبض' : 'Receipts')}</th>
            <th className="px-4 py-3 text-end">{language === 'ar' ? 'المتبقي' : 'Outstanding'}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-dark-600">
          {filtered.map((row) => (
            <tr
              key={row.partyId || row.name}
              onClick={() => row.partyId && onOpen?.(row.partyId)}
              className={row.partyId && onOpen ? 'cursor-pointer hover:bg-emerald-50/50 dark:hover:bg-white/[0.03]' : ''}
            >
              <td className="px-4 py-2.5 font-medium">{row.name}</td>
              <td className="px-4 py-2.5 text-end">{row.invoices}</td>
              <td className="px-4 py-2.5 text-end"><Money value={row.invoiced} /></td>
              <td className="px-4 py-2.5 text-end"><Money value={row.paid} /></td>
              <td className="px-4 py-2.5 text-end"><Money value={isSupplier ? row.payments : row.receipts} /></td>
              <td className="px-4 py-2.5 text-end font-semibold"><Money value={row.outstanding} /></td>
            </tr>
          ))}
          {filtered.length === 0 && (
            <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400">{language === 'ar' ? 'لا توجد بيانات' : 'No data in this period'}</td></tr>
          )}
        </tbody>
        {totals && (
          <tfoot className="border-t border-slate-200 font-semibold dark:border-dark-500">
            <tr>
              <td className="px-4 py-3">{language === 'ar' ? 'الإجمالي' : 'Total'}</td>
              <td className="px-4 py-3 text-end">{totals.invoices}</td>
              <td className="px-4 py-3 text-end"><Money value={totals.invoiced} /></td>
              <td className="px-4 py-3 text-end"><Money value={totals.paid} /></td>
              <td className="px-4 py-3 text-end"><Money value={isSupplier ? totals.payments : totals.receipts} /></td>
              <td className="px-4 py-3 text-end"><Money value={totals.outstanding} /></td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}

export function CustomerSummaryPanel({ language }) {
  const navigate = useNavigate()
  const [from, setFrom] = useState(yearStartIso())
  const [to, setTo] = useState(todayIso())
  const [search, setSearch] = useState('')
  const { data } = useQuery({
    queryKey: ['accounting-customer-summary', from, to],
    queryFn: () => api.get('/accounting/reports/customer-summary', { params: { from, to } }).then((r) => r.data),
  })
  return (
    <div className="space-y-4">
      <DateRangeBar
        from={from}
        to={to}
        setFrom={setFrom}
        setTo={setTo}
        language={language}
        extra={(
          <label className="min-w-[200px] flex-1 text-xs font-medium text-slate-500">
            {language === 'ar' ? 'بحث' : 'Search'}
            <input value={search} onChange={(e) => setSearch(e.target.value)} className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-dark-600 dark:bg-dark-900" placeholder={language === 'ar' ? 'اسم العميل…' : 'Customer name…'} />
          </label>
        )}
      />
      <SummaryTable rows={data?.rows} totals={data?.totals} language={language} kind="customer" search={search} onOpen={(id) => navigate(`/app/dashboard/accounting/customer-account?customerId=${id}`)} />
    </div>
  )
}

export function SupplierSummaryPanel({ language }) {
  const navigate = useNavigate()
  const [from, setFrom] = useState(yearStartIso())
  const [to, setTo] = useState(todayIso())
  const [search, setSearch] = useState('')
  const { data } = useQuery({
    queryKey: ['accounting-supplier-summary', from, to],
    queryFn: () => api.get('/accounting/reports/supplier-summary', { params: { from, to } }).then((r) => r.data),
  })
  return (
    <div className="space-y-4">
      <DateRangeBar
        from={from}
        to={to}
        setFrom={setFrom}
        setTo={setTo}
        language={language}
        extra={(
          <label className="min-w-[200px] flex-1 text-xs font-medium text-slate-500">
            {language === 'ar' ? 'بحث' : 'Search'}
            <input value={search} onChange={(e) => setSearch(e.target.value)} className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-dark-600 dark:bg-dark-900" placeholder={language === 'ar' ? 'اسم المورد…' : 'Supplier name…'} />
          </label>
        )}
      />
      <SummaryTable rows={data?.rows} totals={data?.totals} language={language} kind="supplier" search={search} onOpen={(id) => navigate(`/app/dashboard/accounting/supplier-account?supplierId=${id}`)} />
    </div>
  )
}

export function SupplierAccountPanel({ language }) {
  const [supplierId, setSupplierId] = useState(new URLSearchParams(window.location.search).get('supplierId') || '')
  const [from, setFrom] = useState(yearStartIso())
  const [to, setTo] = useState(todayIso())
  const [q, setQ] = useState('')
  const { data: suppliers = [] } = useQuery({
    queryKey: ['accounting-suppliers', q],
    queryFn: () => api.get('/accounting/parties/suppliers', { params: { q: q || undefined } }).then((r) => Array.isArray(r.data) ? r.data : (r.data?.suppliers || [])),
  })
  const { data, isFetching } = useQuery({
    queryKey: ['accounting-supplier-account', supplierId, from, to],
    queryFn: () => api.get('/accounting/reports/supplier-account', { params: { supplierId, from, to } }).then((r) => r.data),
    enabled: Boolean(supplierId),
  })
  const partyName = (s) => (language === 'ar' ? s.nameAr || s.nameEn : s.nameEn || s.nameAr) || s.code

  return (
    <div className="space-y-4">
      <DateRangeBar
        from={from}
        to={to}
        setFrom={setFrom}
        setTo={setTo}
        language={language}
        extra={(
          <label className="min-w-[240px] flex-1 text-xs font-medium text-slate-500">
            {language === 'ar' ? 'المورد' : 'Supplier'}
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={language === 'ar' ? 'ابحث ثم اختر…' : 'Search then select…'}
              className="mt-1 mb-2 block w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-dark-600 dark:bg-dark-900"
            />
            <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className="block w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-dark-600 dark:bg-dark-900">
              <option value="">{language === 'ar' ? 'اختر مورداً' : 'Select supplier'}</option>
              {suppliers.map((s) => (
                <option key={s._id} value={s._id}>{partyName(s)}{s.code ? ` · ${s.code}` : ''}</option>
              ))}
            </select>
          </label>
        )}
      />
      {data && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-dark-600 dark:bg-dark-800">
            <p className="text-[11px] uppercase tracking-widest text-slate-400">{language === 'ar' ? 'افتتاحي' : 'Opening'}</p>
            <p className="mt-1 text-lg font-semibold"><Money value={data.openingBalance} /></p>
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-dark-600 dark:bg-dark-800">
            <p className="text-[11px] uppercase tracking-widest text-slate-400">{language === 'ar' ? 'الختامي' : 'Closing'}</p>
            <p className="mt-1 text-lg font-semibold"><Money value={data.closingBalance} /></p>
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-dark-600 dark:bg-dark-800">
            <p className="text-[11px] uppercase tracking-widest text-slate-400">{partyName(data.supplier || {})}</p>
            <p className="mt-1 text-sm text-slate-500">{isFetching ? (language === 'ar' ? 'جاري التحميل…' : 'Loading…') : (data.supplier?.phone || data.supplier?.code || '—')}</p>
          </div>
        </div>
      )}
      {supplierId && (
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-dark-600 dark:bg-dark-800">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-[0.12em] text-slate-400 dark:bg-dark-900">
              <tr>
                <th className="px-4 py-3 text-start">{language === 'ar' ? 'التاريخ' : 'Date'}</th>
                <th className="px-4 py-3 text-start">{language === 'ar' ? 'المرجع' : 'Ref'}</th>
                <th className="px-4 py-3 text-start">{language === 'ar' ? 'النوع' : 'Type'}</th>
                <th className="px-4 py-3 text-start">{language === 'ar' ? 'البيان' : 'Memo'}</th>
                <th className="px-4 py-3 text-end">{language === 'ar' ? 'مدين' : 'Debit'}</th>
                <th className="px-4 py-3 text-end">{language === 'ar' ? 'دائن' : 'Credit'}</th>
                <th className="px-4 py-3 text-end">{language === 'ar' ? 'الرصيد' : 'Balance'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-dark-600">
              {(data?.lines || []).map((line, idx) => (
                <tr key={`${line.ref}-${idx}`}>
                  <td className="px-4 py-2.5">{line.date ? new Date(line.date).toLocaleDateString() : '—'}</td>
                  <td className="px-4 py-2.5 font-mono text-xs">{line.ref}</td>
                  <td className="px-4 py-2.5 text-slate-500">{line.type}</td>
                  <td className="px-4 py-2.5">{line.memo}</td>
                  <td className="px-4 py-2.5 text-end"><Money value={line.debit} /></td>
                  <td className="px-4 py-2.5 text-end"><Money value={line.credit} /></td>
                  <td className="px-4 py-2.5 text-end font-semibold"><Money value={line.balance} /></td>
                </tr>
              ))}
              {supplierId && (!data?.lines || data.lines.length === 0) && (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400">{language === 'ar' ? 'لا توجد حركات' : 'No movements in this period'}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export function LedgerSearchPanel({ language, onPost, posting }) {
  const [q, setQ] = useState('')
  const [from, setFrom] = useState(yearStartIso())
  const [to, setTo] = useState(todayIso())
  const { data, isFetching } = useQuery({
    queryKey: ['accounting-ledger-search', q, from, to],
    queryFn: () => api.get('/accounting/journals', { params: { q: q || undefined, from, to, limit: 100 } }).then((r) => r.data),
  })
  return (
    <div className="space-y-4">
      <DateRangeBar
        from={from}
        to={to}
        setFrom={setFrom}
        setTo={setTo}
        language={language}
        extra={(
          <label className="min-w-[240px] flex-1 text-xs font-medium text-slate-500">
            {language === 'ar' ? 'بحث عميق' : 'Deep search'}
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={language === 'ar' ? 'رقم القيد، البيان، المرجع، أو المصدر…' : 'Entry no, memo, reference, or source…'}
              className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-dark-600 dark:bg-dark-900"
            />
          </label>
        )}
      />
      {isFetching && <p className="text-xs text-slate-400">{language === 'ar' ? 'جاري البحث…' : 'Searching…'}</p>}
      <JournalCards
        rows={data?.rows}
        language={language}
        onPost={onPost}
        posting={posting}
        empty={language === 'ar' ? 'لا نتائج' : 'No matching journals'}
      />
    </div>
  )
}
