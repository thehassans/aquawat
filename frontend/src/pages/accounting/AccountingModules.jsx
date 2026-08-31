import { useEffect, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
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

function JournalCards({ rows, language, empty, onPost, posting, onReverse, reversing }) {
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
                j.status === 'posted' ? 'bg-emerald-50 text-emerald-700'
                  : j.status === 'reversed' ? 'bg-slate-100 text-slate-600'
                    : j.status === 'void' ? 'bg-rose-50 text-rose-700'
                      : 'bg-amber-50 text-amber-700'
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
              {j.status === 'posted' && onReverse && (
                <button
                  type="button"
                  onClick={() => onReverse(j._id)}
                  disabled={reversing}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-50 dark:border-dark-600 dark:bg-dark-900"
                >
                  {language === 'ar' ? 'عكس' : 'Reverse'}
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

export function DailyRestrictionPanel({ language, onNew, onPost, posting, onReverse, reversing }) {
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
        onReverse={onReverse}
        reversing={reversing}
        empty={language === 'ar' ? 'لا قيود لهذا اليوم' : 'No daily restrictions yet'}
      />
    </div>
  )
}

export function GeneralVoucherPanel({ language, onNew, onPost, posting, onReverse, reversing }) {
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
        onReverse={onReverse}
        reversing={reversing}
        empty={language === 'ar' ? 'لا سندات' : 'No vouchers yet'}
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
  const [mode, setMode] = useState('gl')
  const { data: customers = [] } = useQuery({
    queryKey: ['accounting-customers'],
    queryFn: () => api.get('/accounting/parties/customers').then((r) => Array.isArray(r.data) ? r.data : (r.data?.customers || [])),
  })
  const { data, isFetching } = useQuery({
    queryKey: ['accounting-customer-account', mode, customerId, from, to],
    queryFn: () => api.get(
      mode === 'gl' ? '/accounting/reports/partner-ledger' : '/accounting/reports/customer-account',
      { params: mode === 'gl' ? { partnerId: customerId, from, to } : { customerId, from, to } },
    ).then((r) => r.data),
    enabled: Boolean(customerId),
  })
  const party = data?.partner || data?.customer

  return (
    <div className="space-y-4">
      <DateRangeBar
        from={from}
        to={to}
        setFrom={setFrom}
        setTo={setTo}
        language={language}
        extra={(
          <>
            <label className="min-w-[220px] flex-1 text-xs font-medium text-slate-500">
              {language === 'ar' ? 'العميل' : 'Customer'}
              <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-dark-600 dark:bg-dark-900">
                <option value="">{language === 'ar' ? 'اختر عميلاً' : 'Select customer'}</option>
                {customers.map((c) => (
                  <option key={c._id} value={c._id}>{c.name}{c.phone ? ` · ${c.phone}` : ''}</option>
                ))}
              </select>
            </label>
            <label className="text-xs font-medium text-slate-500">
              {language === 'ar' ? 'المصدر' : 'Source'}
              <select value={mode} onChange={(e) => setMode(e.target.value)} className="mt-1 block rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-dark-600 dark:bg-dark-900">
                <option value="gl">{language === 'ar' ? 'دفتر الأستاذ (قيود)' : 'GL ledger'}</option>
                <option value="docs">{language === 'ar' ? 'مستندات' : 'Documents'}</option>
              </select>
            </label>
          </>
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
            <p className="text-[11px] uppercase tracking-widest text-slate-400">{party?.name || party?.nameEn || '—'}</p>
            <p className="mt-1 text-sm text-slate-500">{isFetching ? (language === 'ar' ? 'جاري التحميل…' : 'Loading…') : (party?.phone || '—')}</p>
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
                <tr key={`${line.ref || line.entryNumber}-${idx}`}>
                  <td className="px-4 py-2.5">{line.date ? new Date(line.date).toLocaleDateString() : '—'}</td>
                  <td className="px-4 py-2.5 font-mono text-xs">{line.ref || line.entryNumber || '—'}</td>
                  <td className="px-4 py-2.5">
                    {line.memo || line.description || '—'}
                    {mode === 'gl' && line.accountCode ? (
                      <span className="ms-2 text-[10px] text-slate-400">{line.accountCode}</span>
                    ) : null}
                  </td>
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
  const [mode, setMode] = useState('gl')
  const { data: suppliers = [] } = useQuery({
    queryKey: ['accounting-suppliers', q],
    queryFn: () => api.get('/accounting/parties/suppliers', { params: { q: q || undefined } }).then((r) => Array.isArray(r.data) ? r.data : (r.data?.suppliers || [])),
  })
  const { data, isFetching } = useQuery({
    queryKey: ['accounting-supplier-account', mode, supplierId, from, to],
    queryFn: () => api.get(
      mode === 'gl' ? '/accounting/reports/partner-ledger' : '/accounting/reports/supplier-account',
      { params: mode === 'gl' ? { partnerId: supplierId, from, to } : { supplierId, from, to } },
    ).then((r) => r.data),
    enabled: Boolean(supplierId),
  })
  const partyName = (s) => (language === 'ar' ? s.nameAr || s.nameEn || s.name : s.nameEn || s.nameAr || s.name) || s.code
  const party = data?.partner || data?.supplier

  return (
    <div className="space-y-4">
      <DateRangeBar
        from={from}
        to={to}
        setFrom={setFrom}
        setTo={setTo}
        language={language}
        extra={(
          <>
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
            <label className="text-xs font-medium text-slate-500">
              {language === 'ar' ? 'المصدر' : 'Source'}
              <select value={mode} onChange={(e) => setMode(e.target.value)} className="mt-1 block rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-dark-600 dark:bg-dark-900">
                <option value="gl">{language === 'ar' ? 'دفتر الأستاذ (قيود)' : 'GL ledger'}</option>
                <option value="docs">{language === 'ar' ? 'مستندات' : 'Documents'}</option>
              </select>
            </label>
          </>
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
            <p className="text-[11px] uppercase tracking-widest text-slate-400">{partyName(party || {})}</p>
            <p className="mt-1 text-sm text-slate-500">{isFetching ? (language === 'ar' ? 'جاري التحميل…' : 'Loading…') : (party?.phone || party?.code || '—')}</p>
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
                {mode === 'docs' ? <th className="px-4 py-3 text-start">{language === 'ar' ? 'النوع' : 'Type'}</th> : null}
                <th className="px-4 py-3 text-start">{language === 'ar' ? 'البيان' : 'Memo'}</th>
                <th className="px-4 py-3 text-end">{language === 'ar' ? 'مدين' : 'Debit'}</th>
                <th className="px-4 py-3 text-end">{language === 'ar' ? 'دائن' : 'Credit'}</th>
                <th className="px-4 py-3 text-end">{language === 'ar' ? 'الرصيد' : 'Balance'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-dark-600">
              {(data?.lines || []).map((line, idx) => (
                <tr key={`${line.ref || line.entryNumber}-${idx}`}>
                  <td className="px-4 py-2.5">{line.date ? new Date(line.date).toLocaleDateString() : '—'}</td>
                  <td className="px-4 py-2.5 font-mono text-xs">{line.ref || line.entryNumber || '—'}</td>
                  {mode === 'docs' ? <td className="px-4 py-2.5 text-slate-500">{line.type}</td> : null}
                  <td className="px-4 py-2.5">
                    {line.memo || line.description || '—'}
                    {mode === 'gl' && line.accountCode ? (
                      <span className="ms-2 text-[10px] text-slate-400">{line.accountCode}</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-2.5 text-end"><Money value={line.debit} /></td>
                  <td className="px-4 py-2.5 text-end"><Money value={line.credit} /></td>
                  <td className="px-4 py-2.5 text-end font-semibold"><Money value={line.balance} /></td>
                </tr>
              ))}
              {supplierId && (!data?.lines || data.lines.length === 0) && (
                <tr><td colSpan={mode === 'docs' ? 7 : 6} className="px-4 py-10 text-center text-slate-400">{language === 'ar' ? 'لا توجد حركات' : 'No movements in this period'}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export function LedgerSearchPanel({ language, onPost, posting, onReverse, reversing }) {
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
        onReverse={onReverse}
        reversing={reversing}
        empty={language === 'ar' ? 'لا نتائج' : 'No matching journals'}
      />
    </div>
  )
}

/** Period lock dates — Phase 1 accounting close controls */
export function AccountingLockDatesPanel({ language }) {
  const isAr = language === 'ar'
  const [form, setForm] = useState({ lockDate: '', taxLockDate: '', hardLockDate: '' })
  const { data, refetch } = useQuery({
    queryKey: ['accounting-lock-dates'],
    queryFn: () => api.get('/accounting/lock-dates').then((r) => r.data),
  })

  useEffect(() => {
    if (!data) return
    setForm({
      lockDate: data.lockDate ? String(data.lockDate).slice(0, 10) : '',
      taxLockDate: data.taxLockDate ? String(data.taxLockDate).slice(0, 10) : '',
      hardLockDate: data.hardLockDate ? String(data.hardLockDate).slice(0, 10) : '',
    })
  }, [data])

  const save = useMutation({
    mutationFn: () => api.put('/accounting/lock-dates', {
      lockDate: form.lockDate || null,
      taxLockDate: form.taxLockDate || null,
      hardLockDate: form.hardLockDate || null,
    }).then((r) => r.data),
    onSuccess: () => refetch(),
  })

  const backfill = useMutation({
    mutationFn: () => api.post('/accounting/journal-items/backfill', { limit: 1000 }).then((r) => r.data),
  })

  const backfillPartners = useMutation({
    mutationFn: () => api.post('/accounting/journal-items/backfill-partners', { limit: 1000 }).then((r) => r.data),
  })

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 dark:border-dark-600 dark:bg-dark-800">
      <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
        {isAr ? 'تواريخ إقفال المحاسبة' : 'Accounting lock dates'}
      </h3>
      <p className="mt-1 text-xs text-slate-500">
        {isAr
          ? 'يمنع الترحيل على أو قبل تاريخ القفل. الإقفال الصلب يمنع الترحيل والعكس.'
          : 'Soft lock blocks posting on/before the date. Hard lock also blocks reversals.'}
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {[
          ['lockDate', isAr ? 'قفل الترحيل' : 'Posting lock'],
          ['taxLockDate', isAr ? 'قفل الضريبة' : 'Tax lock'],
          ['hardLockDate', isAr ? 'إقفال صلب' : 'Hard lock'],
        ].map(([key, label]) => (
          <label key={key} className="text-xs font-medium text-slate-500">
            {label}
            <input
              type="date"
              value={form[key]}
              onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
              className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-dark-600 dark:bg-dark-900"
            />
          </label>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={save.isPending}
          onClick={() => save.mutate()}
          className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {save.isPending ? '…' : (isAr ? 'حفظ الأقفال' : 'Save locks')}
        </button>
        <button
          type="button"
          disabled={backfill.isPending}
          onClick={() => backfill.mutate()}
          className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 dark:border-dark-600"
        >
          {backfill.isPending
            ? '…'
            : (isAr ? 'مزامنة بنود القيود' : 'Backfill journal items')}
        </button>
        <button
          type="button"
          disabled={backfillPartners.isPending}
          onClick={() => backfillPartners.mutate()}
          className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 dark:border-dark-600"
        >
          {backfillPartners.isPending
            ? '…'
            : (isAr ? 'مزامنة الشركاء على القيود' : 'Backfill partner ids')}
        </button>
        {backfill.isSuccess ? (
          <span className="self-center text-xs text-emerald-600">
            {isAr
              ? `تمت مزامنة ${backfill.data?.synced || 0}`
              : `Synced ${backfill.data?.synced || 0} moves`}
          </span>
        ) : null}
        {backfillPartners.isSuccess ? (
          <span className="self-center text-xs text-emerald-600">
            {isAr
              ? `شركاء: ${backfillPartners.data?.updated || 0}`
              : `Partners: ${backfillPartners.data?.updated || 0}`}
          </span>
        ) : null}
        {save.isSuccess ? (
          <span className="self-center text-xs text-emerald-600">{isAr ? 'تم الحفظ' : 'Saved'}</span>
        ) : null}
      </div>
    </div>
  )
}

const DEFAULT_ACCOUNT_FIELDS = [
  ['receivableAccountId', 'Accounts receivable', 'الذمم المدينة'],
  ['payableAccountId', 'Accounts payable', 'الذمم الدائنة'],
  ['incomeAccountId', 'Income / sales', 'الإيرادات / المبيعات'],
  ['expenseAccountId', 'Operating expense', 'مصروف تشغيلي'],
  ['cogsAccountId', 'Cost of goods sold', 'تكلفة البضاعة'],
  ['bankAccountId', 'Bank', 'البنك'],
  ['cashAccountId', 'Cash', 'النقدية'],
  ['taxInputAccountId', 'Tax input (VAT)', 'ضريبة المدخلات'],
  ['taxOutputAccountId', 'Tax output (VAT)', 'ضريبة المخرجات'],
  ['inventoryAccountId', 'Inventory', 'المخزون'],
  ['suspenseAccountId', 'Suspense / clearing', 'حساب وسيط'],
]

export function AccountingDefaultsPanel({ language }) {
  const isAr = language === 'ar'
  const [form, setForm] = useState({})
  const { data: accounts = [] } = useQuery({
    queryKey: ['accounting-accounts'],
    queryFn: () => api.get('/accounting/accounts').then((r) => r.data?.accounts || r.data || []),
  })
  const { data, refetch } = useQuery({
    queryKey: ['accounting-defaults'],
    queryFn: () => api.get('/accounting/defaults').then((r) => r.data),
  })

  useEffect(() => {
    if (!data) return
    const next = {}
    for (const [key] of DEFAULT_ACCOUNT_FIELDS) {
      next[key] = data[key] ? String(data[key]) : ''
    }
    setForm(next)
  }, [data])

  const save = useMutation({
    mutationFn: () => {
      const body = {}
      for (const [key] of DEFAULT_ACCOUNT_FIELDS) {
        body[key] = form[key] || null
      }
      return api.put('/accounting/defaults', body).then((r) => r.data)
    },
    onSuccess: () => refetch(),
  })

  const ensure = useMutation({
    mutationFn: () => api.post('/accounting/defaults/ensure').then((r) => r.data),
    onSuccess: () => refetch(),
  })

  const postable = (Array.isArray(accounts) ? accounts : []).filter((a) => a.isPostable !== false)

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 dark:border-dark-600 dark:bg-dark-800">
      <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
        {isAr ? 'الحسابات الافتراضية' : 'Default accounts'}
      </h3>
      <p className="mt-1 text-xs text-slate-500">
        {isAr
          ? 'تُستخدم عند ترحيل الفواتير والمدفوعات إذا لم يُحدد حساب آخر.'
          : 'Used when posting invoices and payments if no other account is specified.'}
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {DEFAULT_ACCOUNT_FIELDS.map(([key, en, ar]) => (
          <label key={key} className="text-xs font-medium text-slate-500">
            {isAr ? ar : en}
            <select
              value={form[key] || ''}
              onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
              className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-dark-600 dark:bg-dark-900"
            >
              <option value="">{isAr ? '— من الدليل —' : '— from chart —'}</option>
              {postable.map((a) => (
                <option key={a._id} value={a._id}>
                  {a.code} — {isAr ? (a.nameAr || a.name) : a.name}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={save.isPending}
          onClick={() => save.mutate()}
          className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {save.isPending ? '…' : (isAr ? 'حفظ' : 'Save')}
        </button>
        <button
          type="button"
          disabled={ensure.isPending}
          onClick={() => ensure.mutate()}
          className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 dark:border-dark-600"
        >
          {ensure.isPending ? '…' : (isAr ? 'تعبئة من الدليل' : 'Fill from chart')}
        </button>
        {save.isSuccess || ensure.isSuccess ? (
          <span className="self-center text-xs text-emerald-600">{isAr ? 'تم' : 'Done'}</span>
        ) : null}
      </div>
    </div>
  )
}

const JOURNAL_TYPES = ['sales', 'purchase', 'cash', 'bank', 'stock', 'miscellaneous']

export function JournalBooksPanel({ language }) {
  const isAr = language === 'ar'
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState({
    code: '',
    name: '',
    nameAr: '',
    type: 'miscellaneous',
    sequencePrefix: '',
    defaultDebitAccountId: '',
    defaultCreditAccountId: '',
  })
  const [editId, setEditId] = useState(null)
  const [editForm, setEditForm] = useState({})

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounting-accounts'],
    queryFn: () => api.get('/accounting/accounts').then((r) => r.data?.accounts || r.data || []),
  })
  const { data: books = [], refetch } = useQuery({
    queryKey: ['accounting-journal-books'],
    queryFn: () => api.get('/accounting/journal-books', { params: { active: 'false' } }).then((r) => r.data || []),
  })

  const postable = (Array.isArray(accounts) ? accounts : []).filter((a) => a.isPostable !== false)

  const create = useMutation({
    mutationFn: () => api.post('/accounting/journal-books', {
      ...draft,
      sequencePrefix: draft.sequencePrefix || draft.code,
      defaultDebitAccountId: draft.defaultDebitAccountId || null,
      defaultCreditAccountId: draft.defaultCreditAccountId || null,
    }).then((r) => r.data),
    onSuccess: () => {
      setCreating(false)
      setDraft({
        code: '', name: '', nameAr: '', type: 'miscellaneous', sequencePrefix: '',
        defaultDebitAccountId: '', defaultCreditAccountId: '',
      })
      refetch()
    },
  })

  const update = useMutation({
    mutationFn: ({ id, body }) => api.put(`/accounting/journal-books/${id}`, body).then((r) => r.data),
    onSuccess: () => {
      setEditId(null)
      refetch()
    },
  })

  const acctLabel = (acct) => {
    if (!acct) return '—'
    if (typeof acct === 'object') {
      return `${acct.code || ''} — ${isAr ? (acct.nameAr || acct.name) : acct.name}`
    }
    const found = postable.find((a) => String(a._id) === String(acct))
    return found ? `${found.code} — ${isAr ? (found.nameAr || found.name) : found.name}` : String(acct)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            {isAr ? 'دفاتر القيود' : 'Journal books'}
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            {isAr ? 'سلاسل الترقيم وأنواع الدفاتر' : 'Numbering series and book types'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreating((v) => !v)}
          className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white"
        >
          {creating ? (isAr ? 'إلغاء' : 'Cancel') : (isAr ? 'دفتر جديد' : 'New book')}
        </button>
      </div>

      {creating ? (
        <div className="grid gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-dark-600 dark:bg-dark-800 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ['code', isAr ? 'الرمز' : 'Code'],
            ['name', isAr ? 'الاسم' : 'Name'],
            ['nameAr', isAr ? 'الاسم عربي' : 'Arabic name'],
            ['sequencePrefix', isAr ? 'بادئة الترقيم' : 'Sequence prefix'],
          ].map(([key, label]) => (
            <label key={key} className="text-xs font-medium text-slate-500">
              {label}
              <input
                value={draft[key]}
                onChange={(e) => setDraft((p) => ({ ...p, [key]: e.target.value }))}
                className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-dark-600 dark:bg-dark-900"
              />
            </label>
          ))}
          <label className="text-xs font-medium text-slate-500">
            {isAr ? 'النوع' : 'Type'}
            <select
              value={draft.type}
              onChange={(e) => setDraft((p) => ({ ...p, type: e.target.value }))}
              className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-dark-600 dark:bg-dark-900"
            >
              {JOURNAL_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label className="text-xs font-medium text-slate-500">
            {isAr ? 'حساب مدين افتراضي' : 'Default debit'}
            <select
              value={draft.defaultDebitAccountId}
              onChange={(e) => setDraft((p) => ({ ...p, defaultDebitAccountId: e.target.value }))}
              className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-dark-600 dark:bg-dark-900"
            >
              <option value="">—</option>
              {postable.map((a) => (
                <option key={a._id} value={a._id}>{a.code} — {isAr ? (a.nameAr || a.name) : a.name}</option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium text-slate-500">
            {isAr ? 'حساب دائن افتراضي' : 'Default credit'}
            <select
              value={draft.defaultCreditAccountId}
              onChange={(e) => setDraft((p) => ({ ...p, defaultCreditAccountId: e.target.value }))}
              className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-dark-600 dark:bg-dark-900"
            >
              <option value="">—</option>
              {postable.map((a) => (
                <option key={a._id} value={a._id}>{a.code} — {isAr ? (a.nameAr || a.name) : a.name}</option>
              ))}
            </select>
          </label>
          <div className="flex items-end">
            <button
              type="button"
              disabled={!draft.code || !draft.name || create.isPending}
              onClick={() => create.mutate()}
              className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
            >
              {create.isPending ? '…' : (isAr ? 'إنشاء' : 'Create')}
            </button>
          </div>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-dark-600 dark:bg-dark-800">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-dark-900">
            <tr>
              <th className="px-4 py-3 text-start">{isAr ? 'الرمز' : 'Code'}</th>
              <th className="px-4 py-3 text-start">{isAr ? 'الاسم' : 'Name'}</th>
              <th className="px-4 py-3 text-start">{isAr ? 'النوع' : 'Type'}</th>
              <th className="px-4 py-3 text-start">{isAr ? 'مدين' : 'Debit'}</th>
              <th className="px-4 py-3 text-start">{isAr ? 'دائن' : 'Credit'}</th>
              <th className="px-4 py-3 text-start">{isAr ? 'نشط' : 'Active'}</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/5">
            {(Array.isArray(books) ? books : []).map((book) => (
              <tr key={book._id}>
                <td className="px-4 py-3 font-semibold tabular-nums">{book.code}</td>
                <td className="px-4 py-3">{isAr ? (book.nameAr || book.name) : book.name}</td>
                <td className="px-4 py-3 text-slate-500">{book.type}</td>
                <td className="px-4 py-3 text-xs text-slate-500">
                  {editId === book._id ? (
                    <select
                      value={editForm.defaultDebitAccountId || ''}
                      onChange={(e) => setEditForm((p) => ({ ...p, defaultDebitAccountId: e.target.value }))}
                      className="w-full rounded-lg border border-slate-200 px-2 py-1 dark:border-dark-600 dark:bg-dark-900"
                    >
                      <option value="">—</option>
                      {postable.map((a) => (
                        <option key={a._id} value={a._id}>{a.code}</option>
                      ))}
                    </select>
                  ) : acctLabel(book.defaultDebitAccountId)}
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">
                  {editId === book._id ? (
                    <select
                      value={editForm.defaultCreditAccountId || ''}
                      onChange={(e) => setEditForm((p) => ({ ...p, defaultCreditAccountId: e.target.value }))}
                      className="w-full rounded-lg border border-slate-200 px-2 py-1 dark:border-dark-600 dark:bg-dark-900"
                    >
                      <option value="">—</option>
                      {postable.map((a) => (
                        <option key={a._id} value={a._id}>{a.code}</option>
                      ))}
                    </select>
                  ) : acctLabel(book.defaultCreditAccountId)}
                </td>
                <td className="px-4 py-3">
                  <span className={book.active !== false ? 'text-emerald-600' : 'text-slate-400'}>
                    {book.active !== false ? (isAr ? 'نعم' : 'Yes') : (isAr ? 'لا' : 'No')}
                  </span>
                </td>
                <td className="px-4 py-3 text-end">
                  {editId === book._id ? (
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        className="text-xs font-semibold text-emerald-700"
                        onClick={() => update.mutate({
                          id: book._id,
                          body: {
                            name: editForm.name,
                            nameAr: editForm.nameAr,
                            sequencePrefix: editForm.sequencePrefix,
                            active: editForm.active,
                            defaultDebitAccountId: editForm.defaultDebitAccountId || null,
                            defaultCreditAccountId: editForm.defaultCreditAccountId || null,
                          },
                        })}
                      >
                        {isAr ? 'حفظ' : 'Save'}
                      </button>
                      <button type="button" className="text-xs text-slate-400" onClick={() => setEditId(null)}>
                        {isAr ? 'إلغاء' : 'Cancel'}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="text-xs font-semibold text-slate-600 hover:text-emerald-700"
                      onClick={() => {
                        setEditId(book._id)
                        setEditForm({
                          name: book.name || '',
                          nameAr: book.nameAr || '',
                          sequencePrefix: book.sequencePrefix || book.code || '',
                          active: book.active !== false,
                          defaultDebitAccountId: book.defaultDebitAccountId?._id || book.defaultDebitAccountId || '',
                          defaultCreditAccountId: book.defaultCreditAccountId?._id || book.defaultCreditAccountId || '',
                        })
                      }}
                    >
                      {isAr ? 'تعديل' : 'Edit'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function TaxesPanel({ language }) {
  const isAr = language === 'ar'
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState({
    code: '', name: '', nameAr: '', rate: '15', type: 'sales', accountId: '',
  })
  const { data: accounts = [] } = useQuery({
    queryKey: ['accounting-accounts'],
    queryFn: () => api.get('/accounting/accounts').then((r) => r.data || []),
  })
  const { data: taxes = [], refetch } = useQuery({
    queryKey: ['accounting-taxes'],
    queryFn: () => api.get('/accounting/taxes', { params: { active: 'false' } }).then((r) => r.data || []),
  })
  const postable = (Array.isArray(accounts) ? accounts : []).filter((a) => a.isPostable !== false)

  const create = useMutation({
    mutationFn: () => api.post('/accounting/taxes', {
      ...draft,
      rate: Number(draft.rate),
    }).then((r) => r.data),
    onSuccess: () => {
      setCreating(false)
      setDraft({ code: '', name: '', nameAr: '', rate: '15', type: 'sales', accountId: '' })
      refetch()
    },
  })
  const ensure = useMutation({
    mutationFn: () => api.post('/accounting/taxes/ensure').then((r) => r.data),
    onSuccess: () => refetch(),
  })
  const toggle = useMutation({
    mutationFn: ({ id, active }) => api.put(`/accounting/taxes/${id}`, { active }).then((r) => r.data),
    onSuccess: () => refetch(),
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            {isAr ? 'الضرائب' : 'Taxes'}
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            {isAr ? 'ربط نسب الضريبة بحسابات الدليل' : 'Link tax rates to chart accounts'}
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => ensure.mutate()} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold dark:border-dark-600">
            {ensure.isPending ? '…' : (isAr ? 'تعبئة الافتراضي' : 'Seed defaults')}
          </button>
          <button type="button" onClick={() => setCreating((v) => !v)} className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white">
            {creating ? (isAr ? 'إلغاء' : 'Cancel') : (isAr ? 'ضريبة جديدة' : 'New tax')}
          </button>
        </div>
      </div>

      {creating ? (
        <div className="grid gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-dark-600 dark:bg-dark-800 sm:grid-cols-3">
          {[
            ['code', isAr ? 'الرمز' : 'Code'],
            ['name', isAr ? 'الاسم' : 'Name'],
            ['nameAr', isAr ? 'عربي' : 'Arabic'],
            ['rate', isAr ? 'النسبة %' : 'Rate %'],
          ].map(([key, label]) => (
            <label key={key} className="text-xs font-medium text-slate-500">
              {label}
              <input
                value={draft[key]}
                onChange={(e) => setDraft((p) => ({ ...p, [key]: e.target.value }))}
                className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-dark-600 dark:bg-dark-900"
              />
            </label>
          ))}
          <label className="text-xs font-medium text-slate-500">
            {isAr ? 'النوع' : 'Type'}
            <select value={draft.type} onChange={(e) => setDraft((p) => ({ ...p, type: e.target.value }))} className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-dark-600 dark:bg-dark-900">
              <option value="sales">{isAr ? 'مبيعات' : 'Sales'}</option>
              <option value="purchase">{isAr ? 'مشتريات' : 'Purchase'}</option>
            </select>
          </label>
          <label className="text-xs font-medium text-slate-500">
            {isAr ? 'الحساب' : 'Account'}
            <select value={draft.accountId} onChange={(e) => setDraft((p) => ({ ...p, accountId: e.target.value }))} className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-dark-600 dark:bg-dark-900">
              <option value="">—</option>
              {postable.map((a) => (
                <option key={a._id} value={a._id}>{a.code} — {isAr ? (a.nameAr || a.name) : a.name}</option>
              ))}
            </select>
          </label>
          <div className="flex items-end">
            <button
              type="button"
              disabled={!draft.code || !draft.name || !draft.accountId || create.isPending}
              onClick={() => create.mutate()}
              className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
            >
              {create.isPending ? '…' : (isAr ? 'إنشاء' : 'Create')}
            </button>
          </div>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-dark-600 dark:bg-dark-800">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-dark-900">
            <tr>
              <th className="px-4 py-3 text-start">{isAr ? 'الرمز' : 'Code'}</th>
              <th className="px-4 py-3 text-start">{isAr ? 'الاسم' : 'Name'}</th>
              <th className="px-4 py-3 text-start">{isAr ? 'النوع' : 'Type'}</th>
              <th className="px-4 py-3 text-end">{isAr ? 'النسبة' : 'Rate'}</th>
              <th className="px-4 py-3 text-start">{isAr ? 'الحساب' : 'Account'}</th>
              <th className="px-4 py-3 text-start">{isAr ? 'نشط' : 'Active'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/5">
            {(Array.isArray(taxes) ? taxes : []).map((tax) => (
              <tr key={tax._id}>
                <td className="px-4 py-3 font-semibold">{tax.code}</td>
                <td className="px-4 py-3">{isAr ? (tax.nameAr || tax.name) : tax.name}</td>
                <td className="px-4 py-3 text-slate-500">{tax.type}</td>
                <td className="px-4 py-3 text-end tabular-nums">{tax.rate}%</td>
                <td className="px-4 py-3 text-xs text-slate-500">
                  {tax.accountId?.code || '—'} {tax.accountId?.name ? `— ${isAr ? (tax.accountId.nameAr || tax.accountId.name) : tax.accountId.name}` : ''}
                </td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    className={`text-xs font-semibold ${tax.active !== false ? 'text-emerald-600' : 'text-slate-400'}`}
                    onClick={() => toggle.mutate({ id: tax._id, active: tax.active === false })}
                  >
                    {tax.active !== false ? (isAr ? 'نعم' : 'Yes') : (isAr ? 'لا' : 'No')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function BankReconPanel({ language }) {
  const isAr = language === 'ar'
  const [accountId, setAccountId] = useState('')
  const [statementId, setStatementId] = useState('')
  const [selectedLineId, setSelectedLineId] = useState('')
  const [selectedItemIds, setSelectedItemIds] = useState([])
  const [newStmt, setNewStmt] = useState({
    name: '',
    statementDate: todayIso(),
    linesText: '',
  })

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounting-accounts'],
    queryFn: () => api.get('/accounting/accounts').then((r) => r.data || []),
  })
  const bankAccounts = (Array.isArray(accounts) ? accounts : []).filter(
    (a) => a.isPostable !== false && (a.subtype === 'bank' || a.subtype === 'cash' || ['1000', '1100'].includes(String(a.code))),
  )

  const { data: statements = [], refetch: refetchStatements } = useQuery({
    queryKey: ['bank-statements', accountId],
    queryFn: () => api.get('/accounting/bank-statements', { params: { accountId } }).then((r) => r.data || []),
    enabled: Boolean(accountId),
  })

  const { data: unmatchedItems = [], refetch: refetchItems } = useQuery({
    queryKey: ['bank-unmatched-items', accountId],
    queryFn: () => api.get('/accounting/bank-recon/unmatched-items', { params: { accountId } }).then((r) => r.data || []),
    enabled: Boolean(accountId),
  })

  const { data: unmatchedLines = [], refetch: refetchLines } = useQuery({
    queryKey: ['bank-unmatched-lines', accountId, statementId],
    queryFn: () => api.get('/accounting/bank-recon/unmatched-lines', {
      params: { accountId, statementId: statementId || undefined },
    }).then((r) => r.data || []),
    enabled: Boolean(accountId),
  })

  const createStmt = useMutation({
    mutationFn: () => {
      const lines = String(newStmt.linesText || '')
        .split('\n')
        .map((row) => row.trim())
        .filter(Boolean)
        .map((row) => {
          const [date, amount, ...rest] = row.split(/[,\t]/)
          return {
            date: date || newStmt.statementDate,
            amount: Number(amount),
            label: rest.join(' ').trim(),
          }
        })
        .filter((l) => !Number.isNaN(l.amount) && l.amount !== 0)
      return api.post('/accounting/bank-statements', {
        accountId,
        name: newStmt.name || undefined,
        statementDate: newStmt.statementDate,
        lines,
      }).then((r) => r.data)
    },
    onSuccess: (data) => {
      setNewStmt({ name: '', statementDate: todayIso(), linesText: '' })
      setStatementId(data?.statement?._id || '')
      refetchStatements()
      refetchLines()
    },
  })

  const match = useMutation({
    mutationFn: () => api.post('/accounting/bank-recon/match', {
      statementLineId: selectedLineId,
      journalItemIds: selectedItemIds,
    }).then((r) => r.data),
    onSuccess: () => {
      setSelectedLineId('')
      setSelectedItemIds([])
      refetchItems()
      refetchLines()
    },
  })

  const unmatch = useMutation({
    mutationFn: (lineId) => api.post('/accounting/bank-recon/unmatch', { statementLineId: lineId }).then((r) => r.data),
    onSuccess: () => {
      refetchItems()
      refetchLines()
    },
  })

  const toggleItem = (id) => {
    setSelectedItemIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-dark-600 dark:bg-dark-800">
        <label className="min-w-[220px] flex-1 text-xs font-medium text-slate-500">
          {isAr ? 'حساب البنك / النقدية' : 'Bank / cash account'}
          <select
            value={accountId}
            onChange={(e) => {
              setAccountId(e.target.value)
              setStatementId('')
              setSelectedLineId('')
              setSelectedItemIds([])
            }}
            className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-dark-600 dark:bg-dark-900"
          >
            <option value="">{isAr ? 'اختر حساباً' : 'Select account'}</option>
            {bankAccounts.map((a) => (
              <option key={a._id} value={a._id}>{a.code} — {isAr ? (a.nameAr || a.name) : a.name}</option>
            ))}
          </select>
        </label>
        {accountId ? (
          <label className="min-w-[200px] text-xs font-medium text-slate-500">
            {isAr ? 'كشف الحساب' : 'Statement'}
            <select
              value={statementId}
              onChange={(e) => setStatementId(e.target.value)}
              className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-dark-600 dark:bg-dark-900"
            >
              <option value="">{isAr ? 'كل الأسطر غير المطابقة' : 'All unmatched lines'}</option>
              {(Array.isArray(statements) ? statements : []).map((s) => (
                <option key={s._id} value={s._id}>{s.name}</option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      {accountId ? (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-dark-600 dark:bg-dark-800">
          <h4 className="text-sm font-semibold">{isAr ? 'استيراد كشف' : 'Import statement'}</h4>
          <p className="mt-1 text-xs text-slate-500">
            {isAr ? 'سطر لكل حركة: تاريخ، مبلغ (+داخل / −خارج)، بيان' : 'One line per move: date, amount (+in / −out), label'}
          </p>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <input
              placeholder={isAr ? 'اسم الكشف' : 'Statement name'}
              value={newStmt.name}
              onChange={(e) => setNewStmt((p) => ({ ...p, name: e.target.value }))}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-dark-600 dark:bg-dark-900"
            />
            <input
              type="date"
              value={newStmt.statementDate}
              onChange={(e) => setNewStmt((p) => ({ ...p, statementDate: e.target.value }))}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-dark-600 dark:bg-dark-900"
            />
            <button
              type="button"
              disabled={!newStmt.linesText.trim() || createStmt.isPending}
              onClick={() => createStmt.mutate()}
              className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
            >
              {createStmt.isPending ? '…' : (isAr ? 'إنشاء' : 'Create')}
            </button>
          </div>
          <textarea
            rows={4}
            value={newStmt.linesText}
            onChange={(e) => setNewStmt((p) => ({ ...p, linesText: e.target.value }))}
            placeholder={'2026-08-01,1500,Customer payment INV-1\n2026-08-02,-200,Bank fee'}
            className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2 font-mono text-xs dark:border-dark-600 dark:bg-dark-900"
          />
          {createStmt.isError ? (
            <p className="mt-2 text-xs text-rose-600">{createStmt.error?.response?.data?.error || createStmt.error?.message}</p>
          ) : null}
        </div>
      ) : null}

      {accountId ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-dark-600 dark:bg-dark-800">
            <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold dark:border-white/10">
              {isAr ? 'أسطر الكشف غير المطابقة' : 'Unmatched statement lines'}
            </div>
            <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-white/5">
              {(Array.isArray(unmatchedLines) ? unmatchedLines : []).map((line) => (
                <button
                  key={line._id}
                  type="button"
                  onClick={() => setSelectedLineId(line._id)}
                  className={`flex w-full items-center justify-between px-4 py-3 text-start text-sm ${selectedLineId === line._id ? 'bg-emerald-50 dark:bg-emerald-900/20' : ''}`}
                >
                  <div>
                    <p className="font-medium">{line.label || line.reference || '—'}</p>
                    <p className="text-xs text-slate-400">{line.date ? new Date(line.date).toLocaleDateString() : '—'}</p>
                  </div>
                  <span className={`font-semibold tabular-nums ${Number(line.amount) >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                    <Money value={line.amount} />
                  </span>
                </button>
              ))}
              {(!unmatchedLines || unmatchedLines.length === 0) && (
                <p className="px-4 py-8 text-center text-sm text-slate-400">{isAr ? 'لا أسطر' : 'No unmatched lines'}</p>
              )}
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-dark-600 dark:bg-dark-800">
            <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold dark:border-white/10">
              {isAr ? 'قيود دفتر غير مطابقة' : 'Unmatched journal items'}
            </div>
            <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-white/5">
              {(Array.isArray(unmatchedItems) ? unmatchedItems : []).map((item) => {
                const net = Number(item.debit || 0) - Number(item.credit || 0)
                const checked = selectedItemIds.includes(item._id)
                return (
                  <label key={item._id} className={`flex cursor-pointer items-center gap-3 px-4 py-3 text-sm ${checked ? 'bg-emerald-50 dark:bg-emerald-900/20' : ''}`}>
                    <input type="checkbox" checked={checked} onChange={() => toggleItem(item._id)} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{item.entryNumber} · {item.description || '—'}</p>
                      <p className="text-xs text-slate-400">{item.entryDate ? new Date(item.entryDate).toLocaleDateString() : '—'}</p>
                    </div>
                    <span className={`font-semibold tabular-nums ${net >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                      <Money value={net} />
                    </span>
                  </label>
                )
              })}
              {(!unmatchedItems || unmatchedItems.length === 0) && (
                <p className="px-4 py-8 text-center text-sm text-slate-400">{isAr ? 'لا قيود' : 'No unmatched items'}</p>
              )}
            </div>
          </div>
        </div>
      ) : (
        <p className="py-12 text-center text-sm text-slate-400">{isAr ? 'اختر حساب بنك للبدء' : 'Select a bank account to start'}</p>
      )}

      {accountId ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!selectedLineId || selectedItemIds.length === 0 || match.isPending}
            onClick={() => match.mutate()}
            className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            {match.isPending ? '…' : (isAr ? 'مطابقة' : 'Match')}
          </button>
          {selectedLineId ? (
            <button
              type="button"
              disabled={unmatch.isPending}
              onClick={() => unmatch.mutate(selectedLineId)}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold dark:border-dark-600"
            >
              {isAr ? 'إلغاء مطابقة السطر' : 'Unmatch selected line'}
            </button>
          ) : null}
          {match.isError ? (
            <span className="self-center text-xs text-rose-600">{match.error?.response?.data?.error || match.error?.message}</span>
          ) : null}
          {match.isSuccess ? (
            <span className="self-center text-xs text-emerald-600">{isAr ? 'تمت المطابقة' : 'Matched'}</span>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

const ANALYTIC_TYPES = ['general', 'department', 'project', 'cost_center']

export function AnalyticAccountsPanel({ language }) {
  const isAr = language === 'ar'
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState({ code: '', name: '', nameAr: '', type: 'department' })
  const { data: rows = [], refetch } = useQuery({
    queryKey: ['accounting-analytic-accounts'],
    queryFn: () => api.get('/accounting/analytic-accounts', { params: { active: 'false' } }).then((r) => r.data || []),
  })
  const create = useMutation({
    mutationFn: () => api.post('/accounting/analytic-accounts', draft).then((r) => r.data),
    onSuccess: () => {
      setCreating(false)
      setDraft({ code: '', name: '', nameAr: '', type: 'department' })
      refetch()
    },
  })
  const ensure = useMutation({
    mutationFn: () => api.post('/accounting/analytic-accounts/ensure').then((r) => r.data),
    onSuccess: () => refetch(),
  })
  const toggle = useMutation({
    mutationFn: ({ id, active }) => api.put(`/accounting/analytic-accounts/${id}`, { active }).then((r) => r.data),
    onSuccess: () => refetch(),
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            {isAr ? 'الحسابات التحليلية' : 'Analytic accounts'}
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            {isAr ? 'مراكز تكلفة وأقسام للقيود' : 'Cost centers and departments for journals'}
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => ensure.mutate()} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold dark:border-dark-600">
            {ensure.isPending ? '…' : (isAr ? 'تعبئة الافتراضي' : 'Seed defaults')}
          </button>
          <button type="button" onClick={() => setCreating((v) => !v)} className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white">
            {creating ? (isAr ? 'إلغاء' : 'Cancel') : (isAr ? 'جديد' : 'New')}
          </button>
        </div>
      </div>
      {creating ? (
        <div className="grid gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-dark-600 dark:bg-dark-800 sm:grid-cols-4">
          {[['code', isAr ? 'الرمز' : 'Code'], ['name', isAr ? 'الاسم' : 'Name'], ['nameAr', isAr ? 'عربي' : 'Arabic']].map(([key, label]) => (
            <label key={key} className="text-xs font-medium text-slate-500">
              {label}
              <input value={draft[key]} onChange={(e) => setDraft((p) => ({ ...p, [key]: e.target.value }))} className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-dark-600 dark:bg-dark-900" />
            </label>
          ))}
          <label className="text-xs font-medium text-slate-500">
            {isAr ? 'النوع' : 'Type'}
            <select value={draft.type} onChange={(e) => setDraft((p) => ({ ...p, type: e.target.value }))} className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-dark-600 dark:bg-dark-900">
              {ANALYTIC_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <div className="flex items-end sm:col-span-4">
            <button type="button" disabled={!draft.code || !draft.name || create.isPending} onClick={() => create.mutate()} className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">
              {create.isPending ? '…' : (isAr ? 'إنشاء' : 'Create')}
            </button>
          </div>
        </div>
      ) : null}
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-dark-600 dark:bg-dark-800">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-dark-900">
            <tr>
              <th className="px-4 py-3 text-start">{isAr ? 'الرمز' : 'Code'}</th>
              <th className="px-4 py-3 text-start">{isAr ? 'الاسم' : 'Name'}</th>
              <th className="px-4 py-3 text-start">{isAr ? 'النوع' : 'Type'}</th>
              <th className="px-4 py-3 text-start">{isAr ? 'نشط' : 'Active'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/5">
            {(Array.isArray(rows) ? rows : []).map((row) => (
              <tr key={row._id}>
                <td className="px-4 py-3 font-semibold">{row.code}</td>
                <td className="px-4 py-3">{isAr ? (row.nameAr || row.name) : row.name}</td>
                <td className="px-4 py-3 text-slate-500">{row.type}</td>
                <td className="px-4 py-3">
                  <button type="button" className={`text-xs font-semibold ${row.active !== false ? 'text-emerald-600' : 'text-slate-400'}`} onClick={() => toggle.mutate({ id: row._id, active: row.active === false })}>
                    {row.active !== false ? (isAr ? 'نعم' : 'Yes') : (isAr ? 'لا' : 'No')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function AnalyticReportPanel({ language }) {
  const isAr = language === 'ar'
  const [analyticAccountId, setAnalyticAccountId] = useState('')
  const [from, setFrom] = useState(yearStartIso())
  const [to, setTo] = useState(todayIso())
  const { data: analytics = [] } = useQuery({
    queryKey: ['accounting-analytic-accounts'],
    queryFn: () => api.get('/accounting/analytic-accounts').then((r) => r.data || []),
  })
  const { data, isFetching } = useQuery({
    queryKey: ['accounting-analytic-report', analyticAccountId, from, to],
    queryFn: () => api.get('/accounting/reports/analytic', {
      params: { analyticAccountId: analyticAccountId || undefined, from, to },
    }).then((r) => r.data),
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
            {isAr ? 'حساب تحليلي' : 'Analytic'}
            <select value={analyticAccountId} onChange={(e) => setAnalyticAccountId(e.target.value)} className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-dark-600 dark:bg-dark-900">
              <option value="">{isAr ? 'الكل' : 'All'}</option>
              {(Array.isArray(analytics) ? analytics : []).map((a) => (
                <option key={a._id} value={a._id}>{a.code} — {isAr ? (a.nameAr || a.name) : a.name}</option>
              ))}
            </select>
          </label>
        )}
      />
      {isFetching ? <p className="text-xs text-slate-400">{isAr ? 'جاري التحميل…' : 'Loading…'}</p> : null}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-dark-600 dark:bg-dark-800">
          <p className="text-[11px] uppercase tracking-widest text-slate-400">{isAr ? 'مدين' : 'Debit'}</p>
          <p className="mt-1 text-lg font-semibold"><Money value={data?.totalDebit} /></p>
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-dark-600 dark:bg-dark-800">
          <p className="text-[11px] uppercase tracking-widest text-slate-400">{isAr ? 'دائن' : 'Credit'}</p>
          <p className="mt-1 text-lg font-semibold"><Money value={data?.totalCredit} /></p>
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-dark-600 dark:bg-dark-800">
          <p className="text-[11px] uppercase tracking-widest text-slate-400">{isAr ? 'صافي' : 'Net'}</p>
          <p className="mt-1 text-lg font-semibold"><Money value={round2Safe((data?.totalDebit || 0) - (data?.totalCredit || 0))} /></p>
        </div>
      </div>
      {(data?.rows || []).map((row) => (
        <div key={row.analytic?._id || row.analytic?.code} className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-dark-600 dark:bg-dark-800">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-white/10">
            <p className="text-sm font-semibold">
              {row.analytic?.code} — {isAr ? (row.analytic?.nameAr || row.analytic?.name) : row.analytic?.name}
            </p>
            <p className="text-sm font-semibold tabular-nums"><Money value={row.net} /></p>
          </div>
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-400 dark:bg-dark-900">
              <tr>
                <th className="px-4 py-2 text-start">{isAr ? 'التاريخ' : 'Date'}</th>
                <th className="px-4 py-2 text-start">{isAr ? 'القيد' : 'Entry'}</th>
                <th className="px-4 py-2 text-start">{isAr ? 'الحساب' : 'Account'}</th>
                <th className="px-4 py-2 text-end">{isAr ? 'مدين' : 'Debit'}</th>
                <th className="px-4 py-2 text-end">{isAr ? 'دائن' : 'Credit'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {(row.lines || []).map((line, idx) => (
                <tr key={`${line.entryNumber}-${idx}`}>
                  <td className="px-4 py-2">{line.date ? new Date(line.date).toLocaleDateString() : '—'}</td>
                  <td className="px-4 py-2 font-mono text-xs">{line.entryNumber}</td>
                  <td className="px-4 py-2">{line.accountCode} {line.description ? `· ${line.description}` : ''}</td>
                  <td className="px-4 py-2 text-end"><Money value={line.debit} /></td>
                  <td className="px-4 py-2 text-end"><Money value={line.credit} /></td>
                </tr>
              ))}
              {(!row.lines || row.lines.length === 0) && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-400">{isAr ? 'لا حركات' : 'No lines'}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}

function round2Safe(n) {
  return Math.round((Number(n) || 0) * 100) / 100
}

export function PeriodClosePanel({ language }) {
  const isAr = language === 'ar'
  const year = new Date().getFullYear()
  const [from, setFrom] = useState(`${year}-01-01`)
  const [to, setTo] = useState(`${year}-12-31`)
  const [setHardLock, setSetHardLock] = useState(true)
  const [confirm, setConfirm] = useState(false)

  const { data: preview } = useQuery({
    queryKey: ['accounting-pnl-preview-close', from, to],
    queryFn: () => api.get('/accounting/reports/profit-and-loss', { params: { from, to } }).then((r) => r.data),
    enabled: Boolean(from && to),
  })

  const close = useMutation({
    mutationFn: () => api.post('/accounting/period-close', { from, to, setHardLock }).then((r) => r.data),
  })

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 dark:border-dark-600 dark:bg-dark-800">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
          {isAr ? 'إقفال الفترة' : 'Period close'}
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          {isAr
            ? 'ينقل صافي الأرباح/الخسائر إلى الأرباح المحتجزة (3100) ويقفل الفترة صلباً.'
            : 'Posts P&L into retained earnings (3100) and sets the hard lock date.'}
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <label className="text-xs font-medium text-slate-500">
            {isAr ? 'من' : 'From'}
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-dark-600 dark:bg-dark-900" />
          </label>
          <label className="text-xs font-medium text-slate-500">
            {isAr ? 'إلى' : 'To'}
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-dark-600 dark:bg-dark-900" />
          </label>
          <label className="flex items-end gap-2 pb-2 text-xs font-medium text-slate-500">
            <input type="checkbox" checked={setHardLock} onChange={(e) => setSetHardLock(e.target.checked)} />
            {isAr ? 'تعيين إقفال صلب' : 'Set hard lock'}
          </label>
        </div>
        {preview ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-slate-50 p-3 dark:bg-dark-900">
              <p className="text-[11px] text-slate-400">{isAr ? 'الإيرادات' : 'Revenue'}</p>
              <p className="font-semibold"><Money value={preview.totalRevenue} /></p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3 dark:bg-dark-900">
              <p className="text-[11px] text-slate-400">{isAr ? 'المصروفات' : 'Expenses'}</p>
              <p className="font-semibold"><Money value={preview.totalExpenses} /></p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3 dark:bg-dark-900">
              <p className="text-[11px] text-slate-400">{isAr ? 'صافي الدخل' : 'Net income'}</p>
              <p className="font-semibold"><Money value={preview.netIncome} /></p>
            </div>
          </div>
        ) : null}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {!confirm ? (
            <button type="button" onClick={() => setConfirm(true)} className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white">
              {isAr ? 'متابعة الإقفال…' : 'Continue to close…'}
            </button>
          ) : (
            <>
              <button
                type="button"
                disabled={close.isPending}
                onClick={() => close.mutate()}
                className="rounded-xl bg-rose-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {close.isPending ? '…' : (isAr ? 'تأكيد إقفال الفترة' : 'Confirm period close')}
              </button>
              <button type="button" onClick={() => setConfirm(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold dark:border-dark-600">
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
            </>
          )}
          {close.isSuccess ? (
            <span className="text-xs text-emerald-600">
              {isAr
                ? `تم: ${close.data?.entry?.entryNumber || ''} · صافي ${close.data?.pnl?.netIncome ?? ''}`
                : `Closed: ${close.data?.entry?.entryNumber || ''} · NI ${close.data?.pnl?.netIncome ?? ''}`}
            </span>
          ) : null}
          {close.isError ? (
            <span className="text-xs text-rose-600">{close.error?.response?.data?.error || close.error?.message}</span>
          ) : null}
        </div>
      </div>
    </div>
  )
}

const AGING_LABELS = {
  d0_30: { en: '0–30 days', ar: '٠–٣٠ يوم' },
  d31_60: { en: '31–60 days', ar: '٣١–٦٠ يوم' },
  d61_90: { en: '61–90 days', ar: '٦١–٩٠ يوم' },
  d90_plus: { en: '90+ days', ar: '٩٠+ يوم' },
}

function AgedReportPanel({ language, kind }) {
  const isAr = language === 'ar'
  const [asOf, setAsOf] = useState(todayIso())
  const [selected, setSelected] = useState(() => new Set())
  const endpoint = kind === 'ap' ? '/accounting/reports/aged-ap' : '/accounting/reports/aged-ar'
  const { data, isFetching } = useQuery({
    queryKey: ['accounting-aged', kind, asOf],
    queryFn: () => api.get(endpoint, { params: { asOf } }).then((r) => r.data),
  })
  const buckets = data?.buckets || {}

  const remind = useMutation({
    mutationFn: (invoiceIds) => api.post('/accounting/follow-up/remind', {
      invoiceIds,
      language: isAr ? 'ar' : 'en',
    }).then((r) => r.data),
    onSuccess: (payload) => {
      const first = payload?.results?.[0]
      if (first?.waLink) window.open(first.waLink, '_blank', 'noopener,noreferrer')
      if ((payload?.results || []).length > 1) {
        // Open remaining links with a short delay so the browser allows them
        payload.results.slice(1, 5).forEach((row, idx) => {
          setTimeout(() => {
            if (row.waLink) window.open(row.waLink, '_blank', 'noopener,noreferrer')
          }, (idx + 1) * 400)
        })
      }
      setSelected(new Set())
    },
  })

  const toggle = (id) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-[1.4rem] border border-white/80 bg-white/85 p-4 dark:border-white/10 dark:bg-dark-800">
        <label className="text-xs font-medium text-slate-500">
          {isAr ? 'كما في' : 'As of'}
          <input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} className="mt-1 block rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-dark-600 dark:bg-dark-900" />
        </label>
        <p className="pb-2 text-xs text-slate-400">
          {isAr
            ? (kind === 'ap' ? 'أعمار الذمم الدائنة' : 'أعمار الذمم المدينة')
            : (kind === 'ap' ? 'Aged payables' : 'Aged receivables')}
          {isFetching ? ' · …' : ''}
        </p>
        {kind === 'ar' ? (
          <button
            type="button"
            disabled={!selected.size || remind.isPending}
            onClick={() => remind.mutate([...selected])}
            className="mb-0.5 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            {remind.isPending
              ? '…'
              : (isAr ? `تذكير واتساب (${selected.size})` : `WhatsApp remind (${selected.size})`)}
          </button>
        ) : null}
        {remind.isError ? (
          <p className="pb-2 text-xs text-rose-600">{remind.error?.response?.data?.error || remind.error?.message}</p>
        ) : null}
      </div>
      <div className="grid gap-3 sm:grid-cols-5">
        {['d0_30', 'd31_60', 'd61_90', 'd90_plus'].map((key) => (
          <div key={key} className="rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-dark-600 dark:bg-dark-800">
            <p className="text-[11px] uppercase tracking-widest text-slate-400">{isAr ? AGING_LABELS[key].ar : AGING_LABELS[key].en}</p>
            <p className="mt-1 text-lg font-semibold"><Money value={buckets[key]} /></p>
          </div>
        ))}
        <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/50 p-4 dark:border-emerald-500/20 dark:bg-emerald-950/20">
          <p className="text-[11px] uppercase tracking-widest text-emerald-700/70">{isAr ? 'الإجمالي' : 'Total'}</p>
          <p className="mt-1 text-lg font-semibold"><Money value={buckets.total} /></p>
        </div>
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-dark-600 dark:bg-dark-800">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-400 dark:bg-dark-900">
            <tr>
              {kind === 'ar' ? <th className="px-3 py-2 text-start" /> : null}
              <th className="px-4 py-2 text-start">{isAr ? 'الشريك' : 'Partner'}</th>
              <th className="px-4 py-2 text-start">{isAr ? 'الفاتورة' : 'Invoice'}</th>
              <th className="px-4 py-2 text-start">{isAr ? 'الاستحقاق' : 'Due'}</th>
              <th className="px-4 py-2 text-end">{isAr ? 'المتبقي' : 'Residual'}</th>
              <th className="px-4 py-2 text-end">{isAr ? 'العمر' : 'Age'}</th>
              <th className="px-4 py-2 text-start">{isAr ? 'الشريحة' : 'Bucket'}</th>
              {kind === 'ar' ? <th className="px-4 py-2 text-end">{isAr ? 'تذكير' : 'Remind'}</th> : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/5">
            {(data?.rows || []).map((row) => (
              <tr key={row.invoiceId}>
                {kind === 'ar' ? (
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selected.has(row.invoiceId)}
                      onChange={() => toggle(row.invoiceId)}
                    />
                  </td>
                ) : null}
                <td className="px-4 py-2">
                  <p>{row.partnerName}</p>
                  {row.partnerPhone ? <p className="font-mono text-[11px] text-slate-400">{row.partnerPhone}</p> : null}
                </td>
                <td className="px-4 py-2 font-mono text-xs">{row.invoiceNumber}</td>
                <td className="px-4 py-2">{row.dueDate ? new Date(row.dueDate).toLocaleDateString() : (row.issueDate ? new Date(row.issueDate).toLocaleDateString() : '—')}</td>
                <td className="px-4 py-2 text-end"><Money value={row.residual} /></td>
                <td className="px-4 py-2 text-end tabular-nums">{row.ageDays}</td>
                <td className="px-4 py-2 text-xs text-slate-500">{AGING_LABELS[row.bucket] ? (isAr ? AGING_LABELS[row.bucket].ar : AGING_LABELS[row.bucket].en) : row.bucket}</td>
                {kind === 'ar' ? (
                  <td className="px-4 py-2 text-end">
                    <button
                      type="button"
                      disabled={remind.isPending}
                      onClick={() => remind.mutate([row.invoiceId])}
                      className="rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-semibold dark:border-dark-600"
                    >
                      {isAr ? 'واتساب' : 'WA'}
                    </button>
                  </td>
                ) : null}
              </tr>
            ))}
            {!(data?.rows || []).length && (
              <tr><td colSpan={kind === 'ar' ? 8 : 6} className="px-4 py-8 text-center text-slate-400">{isAr ? 'لا أرصدة مفتوحة' : 'No open balances'}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function AgedReceivablesPanel({ language }) {
  return <AgedReportPanel language={language} kind="ar" />
}

export function AgedPayablesPanel({ language }) {
  return <AgedReportPanel language={language} kind="ap" />
}

export function CashFlowPanel({ language }) {
  const isAr = language === 'ar'
  const [from, setFrom] = useState(yearStartIso())
  const [to, setTo] = useState(todayIso())
  const { data, isFetching } = useQuery({
    queryKey: ['accounting-cash-flow', from, to],
    queryFn: () => api.get('/accounting/reports/cash-flow', { params: { from, to } }).then((r) => r.data),
  })

  const Section = ({ title, section }) => (
    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-dark-600 dark:bg-dark-800">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-white/10">
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-sm font-semibold tabular-nums"><Money value={section?.net} /></p>
      </div>
      <table className="min-w-full text-sm">
        <tbody className="divide-y divide-slate-100 dark:divide-white/5">
          {(section?.rows || []).map((row) => (
            <tr key={row.label}>
              <td className="px-4 py-2">{row.label}</td>
              <td className="px-4 py-2 text-end"><Money value={row.amount} /></td>
            </tr>
          ))}
          {!(section?.rows || []).length && (
            <tr><td className="px-4 py-6 text-center text-slate-400" colSpan={2}>{isAr ? 'لا حركات' : 'No activity'}</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )

  return (
    <div className="space-y-4">
      <DateRangeBar from={from} to={to} setFrom={setFrom} setTo={setTo} language={language} />
      {isFetching ? <p className="text-xs text-slate-400">{isAr ? 'جاري التحميل…' : 'Loading…'}</p> : null}
      <div className="grid gap-3 sm:grid-cols-4">
        {[
          [isAr ? 'افتتاحي' : 'Opening cash', data?.openingCash],
          [isAr ? 'صافي التغير' : 'Net change', data?.netChange],
          [isAr ? 'ختامي' : 'Closing cash', data?.closingCash],
          [isAr ? 'مطابقة' : 'Reconciled', data?.reconciled ? (isAr ? 'نعم' : 'Yes') : (isAr ? 'لا' : 'No')],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-dark-600 dark:bg-dark-800">
            <p className="text-[11px] uppercase tracking-widest text-slate-400">{label}</p>
            <p className="mt-1 text-lg font-semibold">{typeof value === 'string' ? value : <Money value={value} />}</p>
          </div>
        ))}
      </div>
      <Section title={isAr ? 'تشغيلي' : 'Operating'} section={data?.operating} />
      <Section title={isAr ? 'استثماري' : 'Investing'} section={data?.investing} />
      <Section title={isAr ? 'تمويلي' : 'Financing'} section={data?.financing} />
      {data?.indirect ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-4 dark:border-dark-600 dark:bg-dark-900/40">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {isAr ? 'جسر غير مباشر (ملخص)' : 'Indirect bridge (summary)'}
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div>
              <p className="text-[11px] text-slate-400">{isAr ? 'صافي الدخل' : 'Net income'}</p>
              <p className="font-semibold"><Money value={data.indirect.netIncome} /></p>
            </div>
            <div>
              <p className="text-[11px] text-slate-400">{isAr ? 'تسوية رأس المال / غير نقدي' : 'WC / non-cash plug'}</p>
              <p className="font-semibold"><Money value={data.indirect.nonCashAndWorkingCapital} /></p>
            </div>
            <div>
              <p className="text-[11px] text-slate-400">{isAr ? 'تقريبي للتشغيلي' : 'Approx. operating cash'}</p>
              <p className="font-semibold"><Money value={data.indirect.netCashFromOperationsApprox} /></p>
            </div>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-slate-500">
            {isAr ? data.indirect.noteAr : data.indirect.noteEn}
          </p>
        </div>
      ) : null}
      {(data?.notes || []).length ? (
        <ul className="space-y-1.5 rounded-2xl border border-slate-200/80 bg-white px-4 py-3 text-xs text-slate-500 dark:border-dark-600 dark:bg-dark-800">
          {data.notes.map((n, i) => (
            <li key={i}>· {isAr ? n.ar : n.en}</li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

export function JournalsBoardPanel({ language }) {
  const isAr = language === 'ar'
  const [journalId, setJournalId] = useState('')
  const { data: books = [] } = useQuery({
    queryKey: ['accounting-journal-books'],
    queryFn: () => api.get('/accounting/journal-books').then((r) => r.data || []),
  })
  const { data, refetch, isFetching } = useQuery({
    queryKey: ['accounting-journals-board', journalId],
    queryFn: () => api.get('/accounting/journals/board', {
      params: { journalId: journalId || undefined },
    }).then((r) => r.data),
  })
  const post = useMutation({
    mutationFn: (id) => api.post(`/accounting/journals/${id}/post`).then((r) => r.data),
    onSuccess: () => refetch(),
  })

  const columns = [
    { key: 'draft', en: 'Draft', ar: 'مسودة', tone: 'border-amber-200 bg-amber-50/40 dark:border-amber-500/20 dark:bg-amber-950/10' },
    { key: 'posted', en: 'Posted', ar: 'مرحّل', tone: 'border-emerald-200 bg-emerald-50/40 dark:border-emerald-500/20 dark:bg-emerald-950/10' },
    { key: 'reversed', en: 'Reversed', ar: 'معكوس', tone: 'border-slate-200 bg-slate-50/60 dark:border-dark-600 dark:bg-dark-900/40' },
    { key: 'void', en: 'Void', ar: 'ملغى', tone: 'border-rose-200 bg-rose-50/40 dark:border-rose-500/20 dark:bg-rose-950/10' },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-[220px] text-xs font-medium text-slate-500">
          {isAr ? 'دفتر القيود' : 'Journal book'}
          <select value={journalId} onChange={(e) => setJournalId(e.target.value)} className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-dark-600 dark:bg-dark-900">
            <option value="">{isAr ? 'الكل' : 'All'}</option>
            {(Array.isArray(books) ? books : []).map((b) => (
              <option key={b._id} value={b._id}>{b.code} — {isAr ? (b.nameAr || b.name) : b.name}</option>
            ))}
          </select>
        </label>
        {isFetching ? <p className="pb-2 text-xs text-slate-400">…</p> : null}
      </div>
      <div className="grid gap-3 lg:grid-cols-4">
        {columns.map((col) => (
          <div key={col.key} className={`rounded-2xl border p-3 ${col.tone}`}>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                {isAr ? col.ar : col.en}
              </p>
              <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-bold dark:bg-dark-800">
                {data?.counts?.[col.key] ?? 0}
              </span>
            </div>
            <div className="space-y-2">
              {(data?.columns?.[col.key] || []).map((j) => (
                <div key={j._id} className="rounded-xl border border-white/70 bg-white/90 p-3 shadow-sm dark:border-white/5 dark:bg-dark-800">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">{j.entryNumber}</p>
                  <p className="line-clamp-2 text-xs text-slate-500">{j.memo || '—'}</p>
                  <p className="mt-1 text-[11px] text-slate-400">
                    {j.entryDate ? new Date(j.entryDate).toLocaleDateString() : '—'} · <Money value={j.totalDebit} />
                  </p>
                  {col.key === 'draft' ? (
                    <button
                      type="button"
                      disabled={post.isPending}
                      onClick={() => post.mutate(j._id)}
                      className="mt-2 rounded-full bg-emerald-700 px-3 py-1 text-[11px] font-semibold text-white disabled:opacity-50"
                    >
                      {isAr ? 'ترحيل' : 'Post'}
                    </button>
                  ) : null}
                </div>
              ))}
              {!(data?.columns?.[col.key] || []).length ? (
                <p className="py-6 text-center text-xs text-slate-400">{isAr ? 'فارغ' : 'Empty'}</p>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function FirmClientsPanel({ language }) {
  const isAr = language === 'ar'
  const [searchQ, setSearchQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const { data, refetch } = useQuery({
    queryKey: ['accounting-firm-clients'],
    queryFn: () => api.get('/accounting/firm/clients').then((r) => r.data),
  })

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(searchQ.trim()), 300)
    return () => clearTimeout(t)
  }, [searchQ])

  const { data: searchHits = [] } = useQuery({
    queryKey: ['accounting-firm-tenant-search', debouncedQ],
    queryFn: () => api.get('/accounting/firm/tenants/search', { params: { q: debouncedQ } }).then((r) => r.data || []),
    enabled: debouncedQ.length >= 2,
  })

  const enable = useMutation({
    mutationFn: () => api.post('/accounting/firm/enable').then((r) => r.data),
    onSuccess: () => refetch(),
  })
  const link = useMutation({
    mutationFn: (clientTenantId) => api.post('/accounting/firm/clients', { clientTenantId }).then((r) => r.data),
    onSuccess: () => {
      setSearchQ('')
      refetch()
    },
  })
  const unlink = useMutation({
    mutationFn: (id) => api.delete(`/accounting/firm/clients/${id}`).then((r) => r.data),
    onSuccess: () => refetch(),
  })
  const switchTo = useMutation({
    mutationFn: (tenantId) => api.post('/accounting/firm/switch', { tenantId }).then((r) => r.data),
    onSuccess: (payload) => {
      localStorage.setItem('token', payload.token)
      if (payload?.user) localStorage.setItem('auth_user', JSON.stringify(payload.user))
      if (payload?.tenant) localStorage.setItem('auth_tenant', JSON.stringify(payload.tenant))
      window.location.href = '/app/dashboard/accounting'
    },
  })

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 dark:border-dark-600 dark:bg-dark-800">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
          {isAr ? 'وضع مكتب المحاسبة' : 'Accounting Firms Mode'}
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          {isAr
            ? 'فعّل المكتب، ابحث عن مستأجر بالاسم أو الـ slug، واربطه ثم بدّل دفاتره.'
            : 'Enable firm mode, search tenants by name or slug, link them, then switch into their books.'}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {!data?.firmMode ? (
            <button type="button" onClick={() => enable.mutate()} disabled={enable.isPending} className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              {enable.isPending ? '…' : (isAr ? 'تفعيل وضع المكتب' : 'Enable firm mode')}
            </button>
          ) : (
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
              {isAr ? 'مفعّل' : 'Enabled'}
              {data?.home?.name ? ` · ${data.home.name}` : ''}
            </span>
          )}
          {data?.home && String(data.activeTenantId) !== String(data.home._id) ? (
            <button type="button" onClick={() => switchTo.mutate(data.home._id)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold dark:border-dark-600">
              {isAr ? 'العودة للمكتب' : 'Back to firm'}
            </button>
          ) : null}
        </div>
        <div className="mt-4">
          <label className="text-xs font-medium text-slate-500">
            {isAr ? 'بحث بالاسم أو الـ slug' : 'Search by name or slug'}
            <input
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              placeholder={isAr ? 'اكتب حرفين على الأقل…' : 'Type at least 2 characters…'}
              className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-dark-600 dark:bg-dark-900"
            />
          </label>
          {debouncedQ.length >= 2 ? (
            <div className="mt-2 max-h-56 overflow-auto rounded-xl border border-slate-200 dark:border-dark-600">
              {(searchHits || []).length === 0 ? (
                <p className="px-3 py-4 text-center text-xs text-slate-400">{isAr ? 'لا نتائج' : 'No matches'}</p>
              ) : (
                (searchHits || []).map((hit) => (
                  <div key={hit._id} className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-3 py-2 last:border-0 dark:border-white/5">
                    <div>
                      <p className="text-sm font-semibold">{hit.name}</p>
                      <p className="font-mono text-[11px] text-slate-400">{hit.slug}{hit.legalName ? ` · ${hit.legalName}` : ''}</p>
                    </div>
                    <button
                      type="button"
                      disabled={hit.isFirm || hit.linkedToThisFirm || link.isPending || (hit.alreadyLinked && !hit.linkedToThisFirm)}
                      onClick={() => link.mutate(hit._id)}
                      className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white disabled:opacity-40 dark:bg-white dark:text-slate-900"
                    >
                      {hit.linkedToThisFirm
                        ? (isAr ? 'مرتبط' : 'Linked')
                        : hit.isFirm
                          ? (isAr ? 'مكتب' : 'Firm')
                          : hit.alreadyLinked
                            ? (isAr ? 'لدى مكتب آخر' : 'Other firm')
                            : (isAr ? 'ربط' : 'Link')}
                    </button>
                  </div>
                ))
              )}
            </div>
          ) : null}
        </div>
        {(enable.isError || link.isError || switchTo.isError) ? (
          <p className="mt-2 text-xs text-rose-600">
            {enable.error?.response?.data?.error || link.error?.response?.data?.error || switchTo.error?.response?.data?.error}
          </p>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-dark-600 dark:bg-dark-800">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-dark-900">
            <tr>
              <th className="px-4 py-3 text-start">{isAr ? 'العميل' : 'Client'}</th>
              <th className="px-4 py-3 text-start">Slug</th>
              <th className="px-4 py-3 text-end">{isAr ? 'إجراءات' : 'Actions'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/5">
            {(data?.clients || []).map((c) => (
              <tr key={c._id}>
                <td className="px-4 py-3 font-semibold">{c.name || c.business?.legalNameEn || c._id}</td>
                <td className="px-4 py-3 font-mono text-xs text-slate-500">{c.slug}</td>
                <td className="px-4 py-3 text-end">
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      disabled={switchTo.isPending || String(data?.activeTenantId) === String(c._id)}
                      onClick={() => switchTo.mutate(c._id)}
                      className="rounded-full bg-emerald-700 px-3 py-1 text-xs font-semibold text-white disabled:opacity-40"
                    >
                      {String(data?.activeTenantId) === String(c._id)
                        ? (isAr ? 'الحالي' : 'Current')
                        : (isAr ? 'فتح الدفاتر' : 'Open books')}
                    </button>
                    <button
                      type="button"
                      onClick={() => unlink.mutate(c._id)}
                      className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold dark:border-dark-600"
                    >
                      {isAr ? 'إلغاء الربط' : 'Unlink'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!(data?.clients || []).length ? (
              <tr><td colSpan={3} className="px-4 py-8 text-center text-slate-400">{isAr ? 'لا عملاء مرتبطين' : 'No linked clients'}</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function VatTaxReportPanel({ language }) {
  const isAr = language === 'ar'
  const [from, setFrom] = useState(yearStartIso())
  const [to, setTo] = useState(todayIso())
  const { data: glTax, isFetching: glLoading } = useQuery({
    queryKey: ['accounting-tax-report', from, to],
    queryFn: () => api.get('/accounting/reports/tax', { params: { from, to } }).then((r) => r.data),
  })
  const { data: vatReturn, isFetching: vatLoading, isError: vatError } = useQuery({
    queryKey: ['vat-returns-accounting', from, to],
    queryFn: () => api.get('/reports/vat-return', {
      params: { startDate: from, endDate: to },
    }).then((r) => r.data),
    retry: false,
  })

  const statement = vatReturn?.vatReturn?.statement || vatReturn?.statement || null

  return (
    <div className="space-y-4">
      <DateRangeBar from={from} to={to} setFrom={setFrom} setTo={setTo} language={language} />
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-dark-600 dark:bg-dark-800">
        <div>
          <h3 className="text-sm font-semibold">{isAr ? 'تقرير الضريبة' : 'Tax report'}</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            {isAr
              ? 'ملخص خطوط الضريبة في الدفتر + رابط إقرار القيمة المضافة.'
              : 'GL tax-tagged lines summary plus VAT return link.'}
          </p>
        </div>
        <a
          href="/app/dashboard/vat-returns"
          className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold dark:border-dark-600"
        >
          {isAr ? 'إقرار ضريبة القيمة المضافة' : 'Full VAT return'}
        </a>
      </div>

      {!vatError && statement ? (
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            [isAr ? 'المبيعات الخاضعة' : 'Taxable sales', statement.standardRatedSales ?? statement.taxableAmount],
            [isAr ? 'ضريبة المخرجات' : 'Output VAT', statement.vatOnSales ?? statement.totalTax ?? statement.outputVat],
            [isAr ? 'صافي الضريبة' : 'Net VAT', statement.netVatPayable ?? statement.netVat],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-dark-600 dark:bg-dark-800">
              <p className="text-[11px] uppercase tracking-widest text-slate-400">{label}</p>
              <p className="mt-1 text-lg font-semibold"><Money value={value} /></p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-slate-400">
          {vatLoading
            ? (isAr ? 'جاري تحميل إقرار الضريبة…' : 'Loading VAT return…')
            : (isAr ? 'إقرار ضريبة القيمة المضافة متاح لمستأجري الريال السعودي.' : 'Statutory VAT return applies to SAR tenants.')}
        </p>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-dark-600 dark:bg-dark-800">
        <div className="border-b border-slate-100 px-4 py-3 dark:border-white/10">
          <p className="text-sm font-semibold">{isAr ? 'ملخص الضريبة من القيود' : 'GL tax summary'}</p>
          {glLoading ? <p className="text-xs text-slate-400">…</p> : null}
        </div>
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-400 dark:bg-dark-900">
            <tr>
              <th className="px-4 py-2 text-start">{isAr ? 'الرمز' : 'Code'}</th>
              <th className="px-4 py-2 text-start">{isAr ? 'الاسم' : 'Name'}</th>
              <th className="px-4 py-2 text-end">{isAr ? 'مدين' : 'Debit'}</th>
              <th className="px-4 py-2 text-end">{isAr ? 'دائن' : 'Credit'}</th>
              <th className="px-4 py-2 text-end">{isAr ? 'صافي' : 'Net'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/5">
            {(glTax?.rows || []).map((row) => (
              <tr key={row.taxId || row.code}>
                <td className="px-4 py-2 font-mono text-xs">{row.code}</td>
                <td className="px-4 py-2">{isAr ? (row.nameAr || row.name) : row.name}{row.rate != null ? ` (${row.rate}%)` : ''}</td>
                <td className="px-4 py-2 text-end"><Money value={row.debit} /></td>
                <td className="px-4 py-2 text-end"><Money value={row.credit} /></td>
                <td className="px-4 py-2 text-end"><Money value={row.net} /></td>
              </tr>
            ))}
            {!(glTax?.rows || []).length ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">{isAr ? 'لا خطوط ضريبة موسومة' : 'No tax-tagged journal lines'}</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function OpeningBalancesPanel({ language, onNewOpening }) {
  const isAr = language === 'ar'
  const { data, isFetching, refetch } = useQuery({
    queryKey: ['accounting-opening-journals'],
    queryFn: () => api.get('/accounting/journals', {
      params: { type: 'opening', limit: 50 },
    }).then((r) => r.data),
  })
  const post = useMutation({
    mutationFn: (id) => api.post(`/accounting/journals/${id}/post`).then((r) => r.data),
    onSuccess: () => refetch(),
  })

  const rows = data?.rows || []

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white p-5 dark:border-dark-600 dark:bg-dark-800">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            {isAr ? 'أرصدة افتتاحية' : 'Opening balances'}
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            {isAr
              ? 'قيود من نوع opening لترحيل أرصدة بداية الفترة. راعِ تواريخ الإقفال.'
              : 'Journals with type opening for period start balances. Respect lock dates when posting.'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onNewOpening?.()}
          className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white"
        >
          {isAr ? 'قيد افتتاحي جديد' : 'New opening entry'}
        </button>
      </div>
      {isFetching ? <p className="text-xs text-slate-400">…</p> : null}
      <div className="space-y-3">
        {rows.map((j) => (
          <div key={j._id} className="rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-dark-600 dark:bg-dark-800">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{j.entryNumber}</p>
                <p className="text-sm text-slate-500">{j.memo || '—'}</p>
                <p className="mt-1 text-xs text-slate-400">
                  {j.entryDate ? new Date(j.entryDate).toLocaleDateString() : '—'} · {j.status}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold tabular-nums"><Money value={j.totalDebit} /></span>
                {j.status === 'draft' ? (
                  <button
                    type="button"
                    disabled={post.isPending}
                    onClick={() => post.mutate(j._id)}
                    className="rounded-full bg-emerald-700 px-3 py-1 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    {isAr ? 'ترحيل' : 'Post'}
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        ))}
        {!rows.length ? (
          <div className="rounded-2xl border border-dashed border-slate-200 py-12 text-center text-sm text-slate-400 dark:border-dark-600">
            {isAr ? 'لا قيود افتتاحية بعد' : 'No opening journals yet'}
          </div>
        ) : null}
      </div>
    </div>
  )
}

/** Placeholder for Accounting menu items not yet built as full modules. */
export function AccountingComingSoonPanel({ language, titleEn, titleAr, descriptionEn, descriptionAr }) {
  const isAr = language === 'ar'
  return (
    <div className="rounded-[1.5rem] border border-dashed border-emerald-200/80 bg-white/80 px-6 py-16 text-center shadow-[0_14px_36px_-28px_rgba(15,23,42,0.35)] dark:border-emerald-500/20 dark:bg-dark-800/60">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700/70 dark:text-emerald-300/80">
        {isAr ? 'قريباً' : 'Coming soon'}
      </p>
      <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
        {isAr ? (titleAr || titleEn) : (titleEn || titleAr)}
      </h2>
      <p className="mx-auto mt-3 max-w-lg text-sm text-slate-500 dark:text-slate-400">
        {isAr
          ? (descriptionAr || 'هذه الشاشة مخططة في قائمة المحاسبة وستُبنى في مرحلة لاحقة.')
          : (descriptionEn || 'This screen is listed in the Accounting menu and will be built in a later phase.')}
      </p>
    </div>
  )
}

