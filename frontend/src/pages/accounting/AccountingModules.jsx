import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import Money from '../../components/ui/Money'
import VirtualTableBody from '../../components/ui/VirtualTableBody'

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
          ? 'يمنع إنشاء أو ترحيل القيود بتاريخ محاسبي على أو قبل تاريخ القفل. الإقفال الصلب يمنع الجميع بما فيهم المدققون.'
          : 'Blocks creating/posting moves with an accounting date on or before the lock. Hard lock freezes everyone including controllers.'}
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {[
          ['lockDate', isAr ? 'قفل لغير المستشارين' : 'Lock date for non-advisers'],
          ['taxLockDate', isAr ? 'قفل الضريبة' : 'Tax lock date'],
          ['hardLockDate', isAr ? 'قفل لجميع المستخدمين' : 'Lock date for all users'],
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
  ['outstandingPaymentsAccountId', 'Outstanding payments', 'مدفوعات معلقة'],
  ['outstandingReceiptsAccountId', 'Outstanding receipts', 'مقبوضات معلقة'],
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
  const [apForm, setApForm] = useState({
    sepa: { debtorIban: '', debtorBic: '', debtorName: '' },
    checkPrint: { prefix: 'CHK', nextNumber: 1001, micrRouting: '', micrAccount: '' },
    useOutstandingPayments: true,
  })
  const [arForm, setArForm] = useState({ useOutstandingReceipts: true })
  const { data: accounts = [] } = useQuery({
    queryKey: ['accounting-accounts'],
    queryFn: () => api.get('/accounting/accounts').then((r) => r.data?.accounts || r.data || []),
  })
  const { data, refetch } = useQuery({
    queryKey: ['accounting-defaults'],
    queryFn: () => api.get('/accounting/defaults').then((r) => r.data),
  })
  const { data: apSettings, refetch: refetchAp } = useQuery({
    queryKey: ['accounting-ap-payment-settings'],
    queryFn: () => api.get('/accounting/ap-payment-settings').then((r) => r.data),
  })
  const { data: arSettings, refetch: refetchAr } = useQuery({
    queryKey: ['accounting-ar-payment-settings'],
    queryFn: () => api.get('/accounting/ar-payment-settings').then((r) => r.data),
  })

  useEffect(() => {
    if (!data) return
    const next = {}
    for (const [key] of DEFAULT_ACCOUNT_FIELDS) {
      next[key] = data[key] ? String(data[key]) : ''
    }
    setForm(next)
  }, [data])

  useEffect(() => {
    if (!apSettings) return
    setApForm({
      sepa: {
        debtorIban: apSettings.sepa?.debtorIban || '',
        debtorBic: apSettings.sepa?.debtorBic || '',
        debtorName: apSettings.sepa?.debtorName || '',
      },
      checkPrint: {
        prefix: apSettings.checkPrint?.prefix || 'CHK',
        nextNumber: Number(apSettings.checkPrint?.nextNumber || 1001),
        micrRouting: apSettings.checkPrint?.micrRouting || '',
        micrAccount: apSettings.checkPrint?.micrAccount || '',
      },
      useOutstandingPayments: apSettings.useOutstandingPayments !== false,
    })
  }, [apSettings])

  useEffect(() => {
    if (!arSettings) return
    setArForm({
      useOutstandingReceipts: arSettings.useOutstandingReceipts !== false,
    })
  }, [arSettings])

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

  const saveAp = useMutation({
    mutationFn: () => api.put('/accounting/ap-payment-settings', apForm).then((r) => r.data),
    onSuccess: () => refetchAp(),
  })

  const saveAr = useMutation({
    mutationFn: () => api.put('/accounting/ar-payment-settings', arForm).then((r) => r.data),
    onSuccess: () => refetchAr(),
  })

  const ensure = useMutation({
    mutationFn: () => api.post('/accounting/defaults/ensure').then((r) => r.data),
    onSuccess: () => refetch(),
  })

  const postable = (Array.isArray(accounts) ? accounts : []).filter((a) => a.isPostable !== false)

  return (
    <div className="space-y-4">
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

    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 dark:border-dark-600 dark:bg-dark-800">
      <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
        {isAr ? 'مدفوعات الموردين (SEPA والشيكات)' : 'Vendor payments (SEPA & checks)'}
      </h3>
      <p className="mt-1 text-xs text-slate-500">
        {isAr
          ? 'IBAN الشركة لتصدير SEPA، وتسلسل أرقام الشيكات مع سطر MICR اختياري.'
          : 'Company IBAN for SEPA export, plus check numbering and optional MICR line.'}
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="text-xs font-medium text-slate-500">
          {isAr ? 'اسم المدين (SEPA)' : 'Debtor name (SEPA)'}
          <input
            value={apForm.sepa.debtorName}
            onChange={(e) => setApForm((p) => ({ ...p, sepa: { ...p.sepa, debtorName: e.target.value } }))}
            className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-dark-600 dark:bg-dark-900"
            placeholder={isAr ? 'اسم الشركة' : 'Company legal name'}
          />
        </label>
        <label className="text-xs font-medium text-slate-500">
          {isAr ? 'IBAN المدين' : 'Debtor IBAN'}
          <input
            value={apForm.sepa.debtorIban}
            onChange={(e) => setApForm((p) => ({ ...p, sepa: { ...p.sepa, debtorIban: e.target.value } }))}
            className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-dark-600 dark:bg-dark-900"
            placeholder="SAxx…"
          />
        </label>
        <label className="text-xs font-medium text-slate-500">
          {isAr ? 'BIC المدين' : 'Debtor BIC'}
          <input
            value={apForm.sepa.debtorBic}
            onChange={(e) => setApForm((p) => ({ ...p, sepa: { ...p.sepa, debtorBic: e.target.value.toUpperCase() } }))}
            className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-dark-600 dark:bg-dark-900"
            placeholder="XXXASARI"
          />
        </label>
        <label className="text-xs font-medium text-slate-500">
          {isAr ? 'بادئة الشيك' : 'Check prefix'}
          <input
            value={apForm.checkPrint.prefix}
            onChange={(e) => setApForm((p) => ({ ...p, checkPrint: { ...p.checkPrint, prefix: e.target.value } }))}
            className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-dark-600 dark:bg-dark-900"
          />
        </label>
        <label className="text-xs font-medium text-slate-500">
          {isAr ? 'رقم الشيك التالي' : 'Next check number'}
          <input
            type="number"
            min="1"
            value={apForm.checkPrint.nextNumber}
            onChange={(e) => setApForm((p) => ({ ...p, checkPrint: { ...p.checkPrint, nextNumber: Number(e.target.value || 1) } }))}
            className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-dark-600 dark:bg-dark-900"
          />
        </label>
        <label className="text-xs font-medium text-slate-500">
          {isAr ? 'MICR routing' : 'MICR routing'}
          <input
            value={apForm.checkPrint.micrRouting}
            onChange={(e) => setApForm((p) => ({ ...p, checkPrint: { ...p.checkPrint, micrRouting: e.target.value } }))}
            className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-dark-600 dark:bg-dark-900"
          />
        </label>
        <label className="text-xs font-medium text-slate-500">
          {isAr ? 'MICR account' : 'MICR account'}
          <input
            value={apForm.checkPrint.micrAccount}
            onChange={(e) => setApForm((p) => ({ ...p, checkPrint: { ...p.checkPrint, micrAccount: e.target.value } }))}
            className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-dark-600 dark:bg-dark-900"
          />
        </label>
        <label className="flex items-center gap-2 text-xs font-medium text-slate-600 sm:col-span-2">
          <input
            type="checkbox"
            checked={apForm.useOutstandingPayments}
            onChange={(e) => setApForm((p) => ({ ...p, useOutstandingPayments: e.target.checked }))}
            className="rounded border-slate-300"
          />
          {isAr ? 'استخدام حساب المدفوعات المعلقة حتى المقاصة البنكية' : 'Use Outstanding Payments until bank clearance'}
        </label>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={saveAp.isPending}
          onClick={() => saveAp.mutate()}
          className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {saveAp.isPending ? '…' : (isAr ? 'حفظ إعدادات الدفع' : 'Save payment settings')}
        </button>
        {saveAp.isSuccess ? (
          <span className="self-center text-xs text-emerald-600">{isAr ? 'تم' : 'Done'}</span>
        ) : null}
        {saveAp.isError ? (
          <span className="self-center text-xs text-rose-600">{saveAp.error?.response?.data?.error || (isAr ? 'فشل الحفظ' : 'Save failed')}</span>
        ) : null}
      </div>
    </div>

    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 dark:border-dark-600 dark:bg-dark-800">
      <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
        {isAr ? 'إعدادات قبض العملاء' : 'Customer receipt settings'}
      </h3>
      <p className="mt-1 text-xs text-slate-500">
        {isAr
          ? 'تحويلات بنكية وشيكات العملاء تُسجّل على المقبوضات المعلقة حتى تصل كشف البنك.'
          : 'Bank transfers and cheques debit Outstanding Receipts until the bank statement clears.'}
      </p>
      <label className="mt-4 flex items-center gap-2 text-xs font-medium text-slate-600">
        <input
          type="checkbox"
          checked={arForm.useOutstandingReceipts}
          onChange={(e) => setArForm((p) => ({ ...p, useOutstandingReceipts: e.target.checked }))}
          className="rounded border-slate-300"
        />
        {isAr ? 'استخدام حساب المقبوضات المعلقة حتى المقاصة البنكية' : 'Use Outstanding Receipts until bank clearance'}
      </label>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={saveAr.isPending}
          onClick={() => saveAr.mutate()}
          className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {saveAr.isPending ? '…' : (isAr ? 'حفظ إعدادات القبض' : 'Save receipt settings')}
        </button>
        {saveAr.isSuccess ? (
          <span className="self-center text-xs text-emerald-600">{isAr ? 'تم' : 'Done'}</span>
        ) : null}
      </div>
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
  const [selectedOutstandingIds, setSelectedOutstandingIds] = useState([])
  const [selectedOutstandingReceiptIds, setSelectedOutstandingReceiptIds] = useState([])
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

  const { data: outstandingItems = [], refetch: refetchOutstanding } = useQuery({
    queryKey: ['bank-unmatched-outstanding', accountId],
    queryFn: () => api.get('/accounting/bank-recon/unmatched-outstanding').then((r) => r.data || []),
    enabled: Boolean(accountId),
  })

  const { data: outstandingReceiptItems = [], refetch: refetchOutstandingReceipts } = useQuery({
    queryKey: ['bank-unmatched-outstanding-receipts', accountId],
    queryFn: () => api.get('/accounting/bank-recon/unmatched-outstanding-receipts').then((r) => r.data || []),
    enabled: Boolean(accountId),
  })

  const { data: unmatchedLines = [], refetch: refetchLines } = useQuery({
    queryKey: ['bank-unmatched-lines', accountId, statementId],
    queryFn: () => api.get('/accounting/bank-recon/unmatched-lines', {
      params: { accountId, statementId: statementId || undefined },
    }).then((r) => r.data || []),
    enabled: Boolean(accountId),
  })

  const { data: suggestData } = useQuery({
    queryKey: ['bank-recon-suggest', selectedLineId],
    queryFn: () => api.get('/accounting/bank-recon/suggest', {
      params: { statementLineId: selectedLineId },
    }).then((r) => r.data),
    enabled: Boolean(selectedLineId),
  })

  const selectedLine = useMemo(
    () => (Array.isArray(unmatchedLines) ? unmatchedLines : []).find((l) => l._id === selectedLineId),
    [unmatchedLines, selectedLineId],
  )

  const residual = useMemo(() => {
    if (!selectedLine) return null
    const stmt = Number(selectedLine.amount) || 0
    let matched = 0
    for (const item of unmatchedItems) {
      if (!selectedItemIds.includes(item._id)) continue
      matched += (Number(item.debit) || 0) - (Number(item.credit) || 0)
    }
    for (const item of outstandingItems) {
      if (!selectedOutstandingIds.includes(item._id)) continue
      matched -= Number(item.credit) || 0
    }
    for (const item of outstandingReceiptItems) {
      if (!selectedOutstandingReceiptIds.includes(item._id)) continue
      matched += Number(item.debit) || 0
    }
    return Math.round((stmt - matched) * 100) / 100
  }, [
    selectedLine,
    selectedItemIds,
    selectedOutstandingIds,
    selectedOutstandingReceiptIds,
    unmatchedItems,
    outstandingItems,
    outstandingReceiptItems,
  ])

  const suggestionScoreById = useMemo(() => {
    const map = new Map()
    for (const s of suggestData?.suggestions || []) map.set(String(s.id), s)
    return map
  }, [suggestData])

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
      outstandingJournalItemIds: selectedOutstandingIds,
      outstandingReceiptJournalItemIds: selectedOutstandingReceiptIds,
    }).then((r) => r.data),
    onSuccess: () => {
      setSelectedLineId('')
      setSelectedItemIds([])
      setSelectedOutstandingIds([])
      setSelectedOutstandingReceiptIds([])
      toast.success(isAr ? 'تمت المطابقة' : 'Validated')
      refetchItems()
      refetchOutstanding()
      refetchOutstandingReceipts()
      refetchLines()
    },
    onError: (e) => toast.error(e.response?.data?.error || e.message || 'Failed'),
  })

  const unmatch = useMutation({
    mutationFn: (lineId) => api.post('/accounting/bank-recon/unmatch', { statementLineId: lineId }).then((r) => r.data),
    onSuccess: () => {
      refetchItems()
      refetchOutstanding()
      refetchOutstandingReceipts()
      refetchLines()
    },
  })

  const toggleItem = (id) => {
    setSelectedItemIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const toggleOutstanding = (id) => {
    setSelectedOutstandingIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const toggleOutstandingReceipt = (id) => {
    setSelectedOutstandingReceiptIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const applyBestSuggestion = () => {
    const best = suggestData?.best
    if (!best) return
    setSelectedItemIds([])
    setSelectedOutstandingIds([])
    setSelectedOutstandingReceiptIds([])
    if (best.bucket === 'journal') setSelectedItemIds([best.id])
    else if (best.bucket === 'outstanding_payment') setSelectedOutstandingIds([best.id])
    else if (best.bucket === 'outstanding_receipt') setSelectedOutstandingReceiptIds([best.id])
  }

  const sortedJournalItems = useMemo(() => {
    const rows = Array.isArray(unmatchedItems) ? [...unmatchedItems] : []
    rows.sort((a, b) => (suggestionScoreById.get(String(b._id))?.score || 0) - (suggestionScoreById.get(String(a._id))?.score || 0))
    return rows
  }, [unmatchedItems, suggestionScoreById])

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
              setSelectedOutstandingIds([])
              setSelectedOutstandingReceiptIds([])
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
                  onClick={() => {
                    setSelectedLineId(line._id)
                    setSelectedItemIds([])
                    setSelectedOutstandingIds([])
                    setSelectedOutstandingReceiptIds([])
                  }}
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
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 dark:border-white/10">
              <p className="text-sm font-semibold">{isAr ? 'مقترحات المطابقة / قيود مفتوحة' : 'Suggested matches / open items'}</p>
              {suggestData?.best ? (
                <button
                  type="button"
                  onClick={applyBestSuggestion}
                  className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
                >
                  {isAr ? `تطبيق الأفضل (${suggestData.best.score})` : `Apply best (${suggestData.best.score})`}
                </button>
              ) : null}
            </div>
            <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-white/5">
              {sortedJournalItems.map((item) => {
                const net = Number(item.debit || 0) - Number(item.credit || 0)
                const checked = selectedItemIds.includes(item._id)
                const sug = suggestionScoreById.get(String(item._id))
                return (
                  <label key={item._id} className={`flex cursor-pointer items-center gap-3 px-4 py-3 text-sm ${checked ? 'bg-emerald-50 dark:bg-emerald-900/20' : sug ? 'bg-sky-50/60 dark:bg-sky-950/20' : ''}`}>
                    <input type="checkbox" checked={checked} onChange={() => toggleItem(item._id)} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{item.entryNumber} · {item.description || '—'}</p>
                      <p className="text-xs text-slate-400">
                        {item.entryDate ? new Date(item.entryDate).toLocaleDateString() : '—'}
                        {sug ? ` · ${isAr ? 'درجة' : 'score'} ${sug.score}` : ''}
                      </p>
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
            {(Array.isArray(outstandingItems) ? outstandingItems : []).length > 0 ? (
              <>
                <div className="border-y border-slate-100 px-4 py-3 text-sm font-semibold dark:border-white/10">
                  {isAr ? 'مدفوعات معلقة (بانتظار المقاصة البنكية)' : 'Outstanding payments (awaiting bank clearance)'}
                </div>
                <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-white/5">
                  {outstandingItems.map((item) => {
                    const credit = Number(item.credit || 0)
                    const checked = selectedOutstandingIds.includes(item._id)
                    const sug = suggestionScoreById.get(String(item._id))
                    return (
                      <label key={item._id} className={`flex cursor-pointer items-center gap-3 px-4 py-3 text-sm ${checked ? 'bg-amber-50 dark:bg-amber-900/20' : sug ? 'bg-sky-50/60 dark:bg-sky-950/20' : ''}`}>
                        <input type="checkbox" checked={checked} onChange={() => toggleOutstanding(item._id)} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{item.entryNumber} · {item.description || '—'}</p>
                          <p className="text-xs text-slate-400">
                            {item.entryDate ? new Date(item.entryDate).toLocaleDateString() : '—'}
                            {sug ? ` · ${isAr ? 'درجة' : 'score'} ${sug.score}` : ''}
                          </p>
                        </div>
                        <span className="font-semibold tabular-nums text-amber-700">
                          <Money value={credit} />
                        </span>
                      </label>
                    )
                  })}
                </div>
              </>
            ) : null}
            {(Array.isArray(outstandingReceiptItems) ? outstandingReceiptItems : []).length > 0 ? (
              <>
                <div className="border-y border-slate-100 px-4 py-3 text-sm font-semibold dark:border-white/10">
                  {isAr ? 'مقبوضات معلقة (بانتظار المقاصة البنكية)' : 'Outstanding receipts (awaiting bank clearance)'}
                </div>
                <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-white/5">
                  {outstandingReceiptItems.map((item) => {
                    const debit = Number(item.debit || 0)
                    const checked = selectedOutstandingReceiptIds.includes(item._id)
                    const sug = suggestionScoreById.get(String(item._id))
                    return (
                      <label key={item._id} className={`flex cursor-pointer items-center gap-3 px-4 py-3 text-sm ${checked ? 'bg-emerald-50 dark:bg-emerald-900/20' : sug ? 'bg-sky-50/60 dark:bg-sky-950/20' : ''}`}>
                        <input type="checkbox" checked={checked} onChange={() => toggleOutstandingReceipt(item._id)} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{item.entryNumber} · {item.description || '—'}</p>
                          <p className="text-xs text-slate-400">
                            {item.entryDate ? new Date(item.entryDate).toLocaleDateString() : '—'}
                            {sug ? ` · ${isAr ? 'درجة' : 'score'} ${sug.score}` : ''}
                          </p>
                        </div>
                        <span className="font-semibold tabular-nums text-emerald-700">
                          <Money value={debit} />
                        </span>
                      </label>
                    )
                  })}
                </div>
              </>
            ) : null}
          </div>
        </div>
      ) : (
        <p className="py-12 text-center text-sm text-slate-400">{isAr ? 'اختر حساب بنك للبدء' : 'Select a bank account to start'}</p>
      )}

      {accountId && selectedLine ? (
        <div className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-sm ${Math.abs(residual || 0) < 0.02 ? 'border-emerald-200 bg-emerald-50/80 dark:border-emerald-800 dark:bg-emerald-950/30' : 'border-amber-200 bg-amber-50/70 dark:border-amber-800 dark:bg-amber-950/20'}`}>
          <div>
            <p className="font-semibold">{isAr ? 'الرصيد المتبقي للمطابقة' : 'Match residual'}</p>
            <p className="text-xs text-slate-500">{selectedLine.label || selectedLine.reference || '—'}</p>
          </div>
          <p className="text-lg font-semibold tabular-nums"><Money value={residual} /></p>
        </div>
      ) : null}

      {accountId ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!selectedLineId || (selectedItemIds.length === 0 && selectedOutstandingIds.length === 0 && selectedOutstandingReceiptIds.length === 0) || Math.abs(residual || 0) >= 0.02 || match.isPending}
            onClick={() => match.mutate()}
            className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            {match.isPending ? '…' : (isAr ? 'تحقق / ترحيل' : 'Validate')}
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

export function FollowUpReportsPanel({ language }) {
  const isAr = language === 'ar'
  const [asOf, setAsOf] = useState(todayIso())
  const [minAgeDays, setMinAgeDays] = useState(1)
  const [selected, setSelected] = useState(() => new Set())
  const { data, isFetching } = useQuery({
    queryKey: ['accounting-follow-up', asOf],
    queryFn: () => api.get('/accounting/reports/aged-ar', { params: { asOf } }).then((r) => r.data),
  })

  const overdueRows = useMemo(() => {
    return (data?.rows || [])
      .filter((row) => Number(row.ageDays || 0) >= minAgeDays && Number(row.residual || 0) > 0)
      .sort((a, b) => Number(b.ageDays || 0) - Number(a.ageDays || 0))
  }, [data?.rows, minAgeDays])

  const partnerSummary = useMemo(() => {
    const map = new Map()
    for (const row of overdueRows) {
      const key = String(row.partnerId || row.partnerName || row.invoiceId)
      const prev = map.get(key) || {
        partnerId: row.partnerId,
        partnerName: row.partnerName,
        partnerPhone: row.partnerPhone,
        invoiceCount: 0,
        totalResidual: 0,
        maxAgeDays: 0,
      }
      prev.invoiceCount += 1
      prev.totalResidual += Number(row.residual || 0)
      prev.maxAgeDays = Math.max(prev.maxAgeDays, Number(row.ageDays || 0))
      if (!prev.partnerPhone && row.partnerPhone) prev.partnerPhone = row.partnerPhone
      map.set(key, prev)
    }
    return [...map.values()].sort((a, b) => b.totalResidual - a.totalResidual)
  }, [overdueRows])

  const remind = useMutation({
    mutationFn: (invoiceIds) => api.post('/accounting/follow-up/remind', {
      invoiceIds,
      language: isAr ? 'ar' : 'en',
    }).then((r) => r.data),
    onSuccess: (payload) => {
      const results = payload?.results || []
      results.slice(0, 5).forEach((row, idx) => {
        setTimeout(() => {
          if (row.waLink) window.open(row.waLink, '_blank', 'noopener,noreferrer')
        }, idx * 400)
      })
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

  const nextActivityLabel = (row) => {
    const age = Number(row.ageDays || 0)
    if (age <= 0) return isAr ? 'مستحق قريباً' : 'Due soon'
    if (age === 1) return isAr ? 'متأخر يوم' : '1 day overdue'
    return isAr ? `متأخر ${age} يوم` : `${age} days overdue`
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-[1.4rem] border border-white/80 bg-white/85 p-4 dark:border-white/10 dark:bg-dark-800">
        <label className="text-xs font-medium text-slate-500">
          {isAr ? 'كما في' : 'As of'}
          <input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} className="mt-1 block rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-dark-600 dark:bg-dark-900" />
        </label>
        <label className="text-xs font-medium text-slate-500">
          {isAr ? 'الحد الأدنى للتأخير (أيام)' : 'Min overdue (days)'}
          <input type="number" min={0} value={minAgeDays} onChange={(e) => setMinAgeDays(Math.max(0, Number(e.target.value) || 0))} className="mt-1 block w-24 rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-dark-600 dark:bg-dark-900" />
        </label>
        <p className="pb-2 text-xs text-slate-400">
          {isAr ? 'فواتير متأخرة للمتابعة' : 'Overdue invoices for collection follow-up'}
          {isFetching ? ' · …' : ` · ${overdueRows.length}`}
        </p>
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
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-dark-600 dark:bg-dark-800">
          <p className="text-[11px] uppercase tracking-widest text-slate-400">{isAr ? 'فواتير متأخرة' : 'Overdue invoices'}</p>
          <p className="mt-1 text-lg font-semibold">{overdueRows.length}</p>
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-dark-600 dark:bg-dark-800">
          <p className="text-[11px] uppercase tracking-widest text-slate-400">{isAr ? 'عملاء' : 'Customers'}</p>
          <p className="mt-1 text-lg font-semibold">{partnerSummary.length}</p>
        </div>
        <div className="rounded-2xl border border-rose-200/80 bg-rose-50/50 p-4 dark:border-rose-500/20 dark:bg-rose-950/20">
          <p className="text-[11px] uppercase tracking-widest text-rose-700/70">{isAr ? 'إجمالي المتبقي' : 'Total outstanding'}</p>
          <p className="mt-1 text-lg font-semibold"><Money value={overdueRows.reduce((s, r) => s + Number(r.residual || 0), 0)} /></p>
        </div>
      </div>

      {partnerSummary.length ? (
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-dark-600 dark:bg-dark-800">
          <div className="border-b border-slate-100 px-4 py-3 dark:border-white/10">
            <p className="text-sm font-semibold">{isAr ? 'ملخص حسب العميل' : 'Summary by customer'}</p>
          </div>
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-400 dark:bg-dark-900">
              <tr>
                <th className="px-4 py-2 text-start">{isAr ? 'العميل' : 'Customer'}</th>
                <th className="px-4 py-2 text-end">{isAr ? 'فواتير' : 'Invoices'}</th>
                <th className="px-4 py-2 text-end">{isAr ? 'أقصى تأخير' : 'Max age'}</th>
                <th className="px-4 py-2 text-end">{isAr ? 'المتبقي' : 'Outstanding'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {partnerSummary.slice(0, 20).map((row) => (
                <tr key={String(row.partnerId || row.partnerName)}>
                  <td className="px-4 py-2">
                    <p>{row.partnerName}</p>
                    {row.partnerPhone ? <p className="font-mono text-[11px] text-slate-400">{row.partnerPhone}</p> : null}
                  </td>
                  <td className="px-4 py-2 text-end tabular-nums">{row.invoiceCount}</td>
                  <td className="px-4 py-2 text-end tabular-nums">{row.maxAgeDays}d</td>
                  <td className="px-4 py-2 text-end"><Money value={row.totalResidual} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-dark-600 dark:bg-dark-800">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-400 dark:bg-dark-900">
            <tr>
              <th className="px-3 py-2 text-start" />
              <th className="px-4 py-2 text-start">{isAr ? 'العميل' : 'Customer'}</th>
              <th className="px-4 py-2 text-start">{isAr ? 'الفاتورة' : 'Invoice'}</th>
              <th className="px-4 py-2 text-start">{isAr ? 'النشاط التالي' : 'Next activity'}</th>
              <th className="px-4 py-2 text-end">{isAr ? 'المتبقي' : 'Due'}</th>
              <th className="px-4 py-2 text-end">{isAr ? 'تذكير' : 'Remind'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/5">
            {overdueRows.map((row) => (
              <tr key={row.invoiceId}>
                <td className="px-3 py-2">
                  <input type="checkbox" checked={selected.has(row.invoiceId)} onChange={() => toggle(row.invoiceId)} />
                </td>
                <td className="px-4 py-2">{row.partnerName}</td>
                <td className="px-4 py-2 font-mono text-xs">{row.invoiceNumber}</td>
                <td className="px-4 py-2">
                  <span className="rounded-full bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                    {nextActivityLabel(row)}
                  </span>
                </td>
                <td className="px-4 py-2 text-end"><Money value={row.residual} /></td>
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
              </tr>
            ))}
            {!overdueRows.length && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">{isAr ? 'لا فواتير متأخرة' : 'No overdue invoices'}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function PartnerLedgerPanel({ language }) {
  const isAr = language === 'ar'
  const [partyKind, setPartyKind] = useState('customer')
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-slate-500">{isAr ? 'نوع الشريك' : 'Partner type'}</span>
        <div className="inline-flex rounded-xl border border-slate-200 p-0.5 dark:border-dark-600">
          {[
            { id: 'customer', labelEn: 'Customer', labelAr: 'عميل' },
            { id: 'supplier', labelEn: 'Vendor', labelAr: 'مورد' },
          ].map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setPartyKind(opt.id)}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                partyKind === opt.id
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                  : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-white/5'
              }`}
            >
              {isAr ? opt.labelAr : opt.labelEn}
            </button>
          ))}
        </div>
      </div>
      {partyKind === 'customer'
        ? <CustomerAccountPanel language={language} />
        : <SupplierAccountPanel language={language} />}
    </div>
  )
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
  const [view, setView] = useState('board')
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
    onSuccess: () => { toast.success(isAr ? 'تم الترحيل' : 'Posted'); refetch() },
    onError: (e) => toast.error(e.response?.data?.error || 'Failed'),
  })
  const reverse = useMutation({
    mutationFn: (id) => api.post(`/accounting/journals/${id}/reverse`, {
      reason: isAr ? 'عكس قيد' : 'Manual reversal',
    }).then((r) => r.data),
    onSuccess: () => { toast.success(isAr ? 'تم العكس' : 'Reversed'); refetch() },
    onError: (e) => toast.error(e.response?.data?.error || 'Failed'),
  })

  const columns = [
    { key: 'draft', en: 'Draft', ar: 'مسودة', tone: 'border-amber-200 bg-amber-50/40 dark:border-amber-500/20 dark:bg-amber-950/10' },
    { key: 'posted', en: 'Posted', ar: 'مرحّل', tone: 'border-emerald-200 bg-emerald-50/40 dark:border-emerald-500/20 dark:bg-emerald-950/10' },
    { key: 'reversed', en: 'Reversed', ar: 'معكوس', tone: 'border-slate-200 bg-slate-50/60 dark:border-dark-600 dark:bg-dark-900/40' },
    { key: 'void', en: 'Void', ar: 'ملغى', tone: 'border-rose-200 bg-rose-50/40 dark:border-rose-500/20 dark:bg-rose-950/10' },
  ]

  const flatRows = useMemo(() => {
    const out = []
    for (const col of columns) {
      for (const j of (data?.columns?.[col.key] || [])) {
        out.push({ ...j, _col: col.key })
      }
    }
    return out.sort((a, b) => new Date(b.entryDate || 0) - new Date(a.entryDate || 0))
  }, [data])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <label className="min-w-[220px] text-xs font-medium text-slate-500">
          {isAr ? 'دفتر القيود' : 'Journal book'}
          <select value={journalId} onChange={(e) => setJournalId(e.target.value)} className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-dark-600 dark:bg-dark-900">
            <option value="">{isAr ? 'الكل' : 'All'}</option>
            {(Array.isArray(books) ? books : []).map((b) => (
              <option key={b._id} value={b._id}>{b.code} — {isAr ? (b.nameAr || b.name) : b.name}</option>
            ))}
          </select>
        </label>
        <div className="flex gap-1 rounded-xl border border-slate-200 p-1 dark:border-dark-600">
          {[['board', isAr ? 'لوحة' : 'Board'], ['list', isAr ? 'قائمة' : 'List']].map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setView(id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${view === id ? 'bg-emerald-700 text-white' : 'text-slate-500'}`}
            >
              {label}
            </button>
          ))}
        </div>
        {isFetching ? <p className="pb-2 text-xs text-slate-400">…</p> : null}
      </div>

      {view === 'list' ? (
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-dark-600 dark:bg-dark-800">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-400 dark:bg-dark-900">
              <tr>
                <th className="px-3 py-2 text-start">{isAr ? 'التاريخ' : 'Date'}</th>
                <th className="px-3 py-2 text-start">{isAr ? 'الرقم' : 'Number'}</th>
                <th className="px-3 py-2 text-start">{isAr ? 'المرجع' : 'Reference'}</th>
                <th className="px-3 py-2 text-start">{isAr ? 'البيان' : 'Memo'}</th>
                <th className="px-3 py-2 text-end">{isAr ? 'الإجمالي' : 'Total'}</th>
                <th className="px-3 py-2 text-start">{isAr ? 'الحالة' : 'Status'}</th>
                <th className="px-3 py-2 text-end">{isAr ? 'إجراء' : 'Action'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {flatRows.map((j) => (
                <tr key={j._id} className="hover:bg-slate-50/80 dark:hover:bg-white/[0.03]">
                  <td className="px-3 py-2 whitespace-nowrap">{j.entryDate ? new Date(j.entryDate).toLocaleDateString() : '—'}</td>
                  <td className="px-3 py-2 font-mono text-xs font-semibold">{j.entryNumber}</td>
                  <td className="px-3 py-2 text-xs text-slate-500">{j.sourceNumber || '—'}</td>
                  <td className="px-3 py-2 max-w-[220px] truncate">{j.memo || '—'}</td>
                  <td className="px-3 py-2 text-end"><Money value={j.totalDebit} /></td>
                  <td className="px-3 py-2 capitalize text-xs">{j._col}</td>
                  <td className="px-3 py-2 text-end">
                    {j._col === 'draft' ? (
                      <button type="button" disabled={post.isPending} onClick={() => post.mutate(j._id)} className="rounded-full bg-emerald-700 px-3 py-1 text-[11px] font-semibold text-white disabled:opacity-50">{isAr ? 'ترحيل' : 'Post'}</button>
                    ) : null}
                    {j._col === 'posted' ? (
                      <button type="button" disabled={reverse.isPending} onClick={() => reverse.mutate(j._id)} className="rounded-full border border-slate-200 px-3 py-1 text-[11px] font-semibold dark:border-dark-600">{isAr ? 'عكس' : 'Reverse'}</button>
                    ) : null}
                  </td>
                </tr>
              ))}
              {!flatRows.length ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">{isAr ? 'لا قيود' : 'No entries'}</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      ) : (
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
              <div className="max-h-[28rem] space-y-2 overflow-y-auto">
                {(data?.columns?.[col.key] || []).map((j) => (
                  <div key={j._id} className="rounded-xl border border-white/70 bg-white/90 p-3 shadow-sm dark:border-white/5 dark:bg-dark-800">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{j.entryNumber}</p>
                    <p className="line-clamp-2 text-xs text-slate-500">{j.memo || '—'}</p>
                    <p className="mt-1 text-[11px] text-slate-400">
                      {j.entryDate ? new Date(j.entryDate).toLocaleDateString() : '—'} · <Money value={j.totalDebit} />
                    </p>
                    {col.key === 'draft' ? (
                      <button type="button" disabled={post.isPending} onClick={() => post.mutate(j._id)} className="mt-2 rounded-full bg-emerald-700 px-3 py-1 text-[11px] font-semibold text-white disabled:opacity-50">{isAr ? 'ترحيل' : 'Post'}</button>
                    ) : null}
                    {col.key === 'posted' ? (
                      <button type="button" disabled={reverse.isPending} onClick={() => reverse.mutate(j._id)} className="mt-2 rounded-full border border-slate-200 px-3 py-1 text-[11px] font-semibold dark:border-dark-600">{isAr ? 'عكس' : 'Reverse'}</button>
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
      )}
      <p className="text-[11px] text-slate-400">
        {isAr
          ? 'القيود المرحّلة لا تُحذف — العكس فقط. المدين يجب أن يساوي الدائن قبل الترحيل.'
          : 'Posted entries are immutable — reverse only. Debits must equal credits before post.'}
      </p>
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
  const [taxUnit, setTaxUnit] = useState('')
  const { data: taxUnitsData } = useQuery({
    queryKey: ['accounting-tax-units'],
    queryFn: () => api.get('/accounting/tax-units').then((r) => r.data),
  })
  const { data: glTax, isFetching: glLoading } = useQuery({
    queryKey: ['accounting-tax-report', from, to, taxUnit],
    queryFn: () => api.get('/accounting/reports/tax', {
      params: { from, to, taxUnit: taxUnit || undefined },
    }).then((r) => r.data),
  })
  const { data: vatReturn, isFetching: vatLoading, isError: vatError } = useQuery({
    queryKey: ['vat-returns-accounting', from, to],
    queryFn: () => api.get('/reports/vat-return', {
      params: { startDate: from, endDate: to },
    }).then((r) => r.data),
    retry: false,
  })

  const statement = vatReturn?.vatReturn?.statement || vatReturn?.statement || null
  const units = taxUnitsData?.units || []

  return (
    <div className="space-y-4">
      <DateRangeBar
        from={from}
        to={to}
        setFrom={setFrom}
        setTo={setTo}
        language={language}
        extra={units.length ? (
          <label className="text-xs font-medium text-slate-500">
            {isAr ? 'وحدة الضريبة' : 'Tax unit'}
            <select
              value={taxUnit}
              onChange={(e) => setTaxUnit(e.target.value)}
              className="mt-1 block rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-dark-600 dark:bg-dark-900"
            >
              <option value="">{isAr ? 'الكل' : 'All'}</option>
              {units.map((u) => (
                <option key={u.code} value={u.code}>{isAr ? (u.nameAr || u.name) : u.name}</option>
              ))}
            </select>
          </label>
        ) : null}
      />
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

/** Atomic audit trail — account.move.line (list only, no single-line edit). */
export function JournalItemsPanel({ language }) {
  const isAr = language === 'ar'
  const [from, setFrom] = useState(yearStartIso())
  const [to, setTo] = useState(todayIso())
  const [accountId, setAccountId] = useState('')
  const [accountType, setAccountType] = useState('')
  const [journalId, setJournalId] = useState('')
  const [analyticAccountId, setAnalyticAccountId] = useState('')
  const [state, setState] = useState('posted')
  const [q, setQ] = useState('')
  const [partnerId, setPartnerId] = useState('')
  const [groupBy, setGroupBy] = useState('none')
  const [skip, setSkip] = useState(0)
  const limit = 500

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounting-accounts'],
    queryFn: () => api.get('/accounting/accounts').then((r) => r.data || []),
  })
  const { data: books = [] } = useQuery({
    queryKey: ['accounting-journal-books'],
    queryFn: () => api.get('/accounting/journal-books').then((r) => r.data || []),
  })
  const { data: analytics = [] } = useQuery({
    queryKey: ['accounting-analytic-accounts'],
    queryFn: () => api.get('/accounting/analytic-accounts').then((r) => r.data || []),
  })
  const { data, isFetching, refetch } = useQuery({
    queryKey: ['accounting-journal-items', from, to, accountId, accountType, journalId, analyticAccountId, state, q, partnerId, skip],
    queryFn: () => api.get('/accounting/journal-items', {
      params: {
        from,
        to,
        accountId: accountId || undefined,
        accountType: accountType || undefined,
        journalId: journalId || undefined,
        analyticAccountId: analyticAccountId || undefined,
        partnerId: partnerId || undefined,
        state: state || 'posted',
        q: q || undefined,
        limit,
        skip,
      },
    }).then((r) => r.data),
  })

  const items = data?.items || []
  const grouped = useMemo(() => {
    if (groupBy === 'none') return null
    const map = new Map()
    for (const row of items) {
      const key = groupBy === 'account'
        ? (row.accountCode || '—')
        : groupBy === 'partner'
          ? (row.partnerName || row.partnerId || '—')
          : (row.analyticCode || '—')
      if (!map.has(key)) map.set(key, { key, debit: 0, credit: 0, count: 0 })
      const g = map.get(key)
      g.debit += Number(row.debit) || 0
      g.credit += Number(row.credit) || 0
      g.count += 1
    }
    return [...map.values()].sort((a, b) => String(a.key).localeCompare(String(b.key)))
  }, [items, groupBy])

  const renderRow = (row, _index, key) => (
    <tr key={key} className="hover:bg-slate-50/70 dark:hover:bg-white/[0.03]">
      <td className="whitespace-nowrap px-2 py-1.5 text-[12px]">{row.entryDate ? new Date(row.entryDate).toLocaleDateString() : '—'}</td>
      <td className="px-2 py-1.5 font-mono text-[11px] font-semibold text-emerald-800 dark:text-emerald-300">{row.entryNumber || '—'}</td>
      <td className="px-2 py-1.5 font-mono text-[11px] text-slate-500">{row.journalCode || '—'}</td>
      <td className="px-2 py-1.5 font-mono text-[11px]">{row.accountCode || '—'}</td>
      <td className="max-w-[140px] truncate px-2 py-1.5 text-[12px]" title={row.partnerName}>{row.partnerName || '—'}</td>
      <td className="max-w-[180px] truncate px-2 py-1.5 text-[12px]" title={row.description}>{row.description || '—'}</td>
      <td className="px-2 py-1.5 font-mono text-[11px] text-slate-500">{row.analyticCode || '—'}</td>
      <td className="px-2 py-1.5 text-end text-[12px] tabular-nums"><Money value={row.debit} /></td>
      <td className="px-2 py-1.5 text-end text-[12px] tabular-nums"><Money value={row.credit} /></td>
      <td className="px-2 py-1.5 text-[11px] capitalize text-slate-400">{row.state || '—'}</td>
    </tr>
  )

  return (
    <div className="space-y-3">
      <div className="rounded-[1.4rem] border border-white/80 bg-white/85 p-4 shadow-[0_14px_36px_-28px_rgba(15,23,42,0.35)] dark:border-white/10 dark:bg-dark-800">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold">{isAr ? 'بنود القيود (مسار التدقيق)' : 'Journal items (audit trail)'}</p>
            <p className="text-[11px] text-slate-500">{isAr ? 'عرض فقط — تعديل بند واحد يكسر التوازن' : 'List-only — editing a single line would unbalance the move'}</p>
          </div>
          <button type="button" onClick={() => refetch()} className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold dark:border-dark-600">{isAr ? 'تحديث' : 'Refresh'}</button>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
          <label className="text-[11px] font-medium text-slate-500">{isAr ? 'من' : 'From'}
            <input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setSkip(0) }} className="mt-1 block w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-dark-600 dark:bg-dark-900" />
          </label>
          <label className="text-[11px] font-medium text-slate-500">{isAr ? 'إلى' : 'To'}
            <input type="date" value={to} onChange={(e) => { setTo(e.target.value); setSkip(0) }} className="mt-1 block w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-dark-600 dark:bg-dark-900" />
          </label>
          <label className="text-[11px] font-medium text-slate-500">{isAr ? 'نوع الحساب' : 'Account type'}
            <select value={accountType} onChange={(e) => { setAccountType(e.target.value); setSkip(0) }} className="mt-1 block w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-dark-600 dark:bg-dark-900">
              <option value="">{isAr ? 'الكل' : 'All'}</option>
              {['asset', 'liability', 'equity', 'revenue', 'expense'].map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label className="text-[11px] font-medium text-slate-500">{isAr ? 'الحساب' : 'Account'}
            <select value={accountId} onChange={(e) => { setAccountId(e.target.value); setSkip(0) }} className="mt-1 block w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-dark-600 dark:bg-dark-900">
              <option value="">{isAr ? 'الكل' : 'All'}</option>
              {accounts.map((a) => <option key={a._id} value={a._id}>{a.code} — {isAr ? (a.nameAr || a.name) : a.name}</option>)}
            </select>
          </label>
          <label className="text-[11px] font-medium text-slate-500">{isAr ? 'الدفتر' : 'Journal'}
            <select value={journalId} onChange={(e) => { setJournalId(e.target.value); setSkip(0) }} className="mt-1 block w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-dark-600 dark:bg-dark-900">
              <option value="">{isAr ? 'الكل' : 'All'}</option>
              {(Array.isArray(books) ? books : []).map((b) => <option key={b._id} value={b._id}>{b.code}</option>)}
            </select>
          </label>
          <label className="text-[11px] font-medium text-slate-500">{isAr ? 'تحليلي' : 'Analytic'}
            <select value={analyticAccountId} onChange={(e) => { setAnalyticAccountId(e.target.value); setSkip(0) }} className="mt-1 block w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-dark-600 dark:bg-dark-900">
              <option value="">{isAr ? 'الكل' : 'All'}</option>
              {(Array.isArray(analytics) ? analytics : []).map((a) => <option key={a._id} value={a._id}>{a.code}</option>)}
            </select>
          </label>
          <label className="text-[11px] font-medium text-slate-500">{isAr ? 'الحالة' : 'State'}
            <select value={state} onChange={(e) => { setState(e.target.value); setSkip(0) }} className="mt-1 block w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-dark-600 dark:bg-dark-900">
              <option value="posted">{isAr ? 'مرحّل' : 'Posted'}</option>
              <option value="draft">{isAr ? 'مسودة' : 'Draft'}</option>
              <option value="cancelled">{isAr ? 'ملغى' : 'Cancelled'}</option>
              <option value="all">{isAr ? 'الكل' : 'All'}</option>
            </select>
          </label>
          <label className="text-[11px] font-medium text-slate-500">{isAr ? 'بحث' : 'Search'}
            <div className="relative mt-1">
              <Search className="pointer-events-none absolute start-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input value={q} onChange={(e) => { setQ(e.target.value); setSkip(0) }} placeholder={isAr ? 'رقم / حساب / بيان' : 'Number / account / label'} className="block w-full rounded-lg border border-slate-200 py-1.5 pe-2 ps-7 text-sm dark:border-dark-600 dark:bg-dark-900" />
            </div>
          </label>
          <label className="text-[11px] font-medium text-slate-500">{isAr ? 'معرّف الشريك' : 'Partner id'}
            <input value={partnerId} onChange={(e) => { setPartnerId(e.target.value.trim()); setSkip(0) }} className="mt-1 block w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-dark-600 dark:bg-dark-900" />
          </label>
          <label className="text-[11px] font-medium text-slate-500">{isAr ? 'تجميع' : 'Group by'}
            <select value={groupBy} onChange={(e) => setGroupBy(e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-dark-600 dark:bg-dark-900">
              <option value="none">{isAr ? 'بدون' : 'None'}</option>
              <option value="account">{isAr ? 'الحساب' : 'Account'}</option>
              <option value="partner">{isAr ? 'الشريك' : 'Partner'}</option>
              <option value="analytic">{isAr ? 'تحليلي' : 'Analytic'}</option>
            </select>
          </label>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
        <span>{isFetching ? '…' : `${items.length} / ${data?.total ?? 0}`} · Dr <Money value={data?.totalDebit} /> · Cr <Money value={data?.totalCredit} /></span>
        <div className="flex gap-2">
          <button type="button" disabled={skip <= 0} onClick={() => setSkip((s) => Math.max(0, s - limit))} className="rounded-lg border border-slate-200 px-2 py-1 disabled:opacity-40 dark:border-dark-600">{isAr ? 'السابق' : 'Prev'}</button>
          <button type="button" disabled={skip + limit >= (data?.total || 0)} onClick={() => setSkip((s) => s + limit)} className="rounded-lg border border-slate-200 px-2 py-1 disabled:opacity-40 dark:border-dark-600">{isAr ? 'التالي' : 'Next'}</button>
        </div>
      </div>

      {grouped ? (
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-dark-600 dark:bg-dark-800">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-[11px] uppercase text-slate-400 dark:bg-dark-900">
              <tr>
                <th className="px-3 py-2 text-start">{isAr ? 'المجموعة' : 'Group'}</th>
                <th className="px-3 py-2 text-end">{isAr ? 'بنود' : 'Lines'}</th>
                <th className="px-3 py-2 text-end">{isAr ? 'مدين' : 'Debit'}</th>
                <th className="px-3 py-2 text-end">{isAr ? 'دائن' : 'Credit'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {grouped.map((g) => (
                <tr key={g.key}>
                  <td className="px-3 py-2 font-medium">{g.key}</td>
                  <td className="px-3 py-2 text-end">{g.count}</td>
                  <td className="px-3 py-2 text-end"><Money value={g.debit} /></td>
                  <td className="px-3 py-2 text-end"><Money value={g.credit} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-dark-600 dark:bg-dark-800">
          <div className="overflow-x-auto">
            <table className="min-w-[960px] w-full table-fixed text-sm">
              <thead className="sticky top-0 z-10 bg-slate-50 text-[10px] uppercase tracking-wide text-slate-400 dark:bg-dark-900">
                <tr>
                  <th className="w-[88px] px-2 py-2 text-start">{isAr ? 'التاريخ' : 'Date'}</th>
                  <th className="w-[100px] px-2 py-2 text-start">{isAr ? 'القيد' : 'Entry'}</th>
                  <th className="w-[64px] px-2 py-2 text-start">{isAr ? 'دفتر' : 'Jnl'}</th>
                  <th className="w-[80px] px-2 py-2 text-start">{isAr ? 'حساب' : 'Acct'}</th>
                  <th className="w-[140px] px-2 py-2 text-start">{isAr ? 'شريك' : 'Partner'}</th>
                  <th className="px-2 py-2 text-start">{isAr ? 'البيان' : 'Label'}</th>
                  <th className="w-[72px] px-2 py-2 text-start">{isAr ? 'تحليلي' : 'Analytic'}</th>
                  <th className="w-[96px] px-2 py-2 text-end">{isAr ? 'مدين' : 'Debit'}</th>
                  <th className="w-[96px] px-2 py-2 text-end">{isAr ? 'دائن' : 'Credit'}</th>
                  <th className="w-[72px] px-2 py-2 text-start">{isAr ? 'حالة' : 'State'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                <VirtualTableBody
                  rows={items}
                  rowHeight={36}
                  threshold={40}
                  height={560}
                  getRowKey={(row) => row._id}
                  renderRow={renderRow}
                />
                {!items.length ? (
                  <tr><td colSpan={10} className="px-4 py-10 text-center text-slate-400">{isAr ? 'لا بنود' : 'No journal items'}</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

export function ExecutiveSummaryPanel({ language }) {
  const isAr = language === 'ar'
  const [from, setFrom] = useState(yearStartIso())
  const [to, setTo] = useState(todayIso())
  const { data: dash, isFetching: dashLoading } = useQuery({
    queryKey: ['accounting-dashboard'],
    queryFn: () => api.get('/accounting/dashboard').then((r) => r.data),
  })
  const { data: pnl } = useQuery({
    queryKey: ['accounting-pnl-exec', from, to],
    queryFn: () => api.get('/accounting/reports/profit-and-loss', { params: { from, to } }).then((r) => r.data),
  })
  const { data: bs } = useQuery({
    queryKey: ['accounting-bs-exec'],
    queryFn: () => api.get('/accounting/reports/balance-sheet').then((r) => r.data),
  })

  const cards = [
    [isAr ? 'صافي الدخل (YTD)' : 'Net income (YTD)', dash?.netIncome],
    [isAr ? 'الإيرادات (YTD)' : 'Revenue (YTD)', dash?.totalRevenue],
    [isAr ? 'المصروفات (YTD)' : 'Expenses (YTD)', dash?.totalExpenses],
    [isAr ? 'نقد + بنك' : 'Cash + bank', dash?.cashBalance],
    [isAr ? 'المدينون' : 'Receivables', dash?.arBalance],
    [isAr ? 'الدائنون' : 'Payables', dash?.apBalance],
  ]

  return (
    <div className="space-y-4">
      <DateRangeBar from={from} to={to} setFrom={setFrom} setTo={setTo} language={language} />
      {dashLoading ? <p className="text-xs text-slate-400">{isAr ? 'جاري التحميل…' : 'Loading…'}</p> : null}
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {cards.map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-dark-600 dark:bg-dark-800">
            <p className="text-[11px] uppercase tracking-widest text-slate-400">{label}</p>
            <p className="mt-1 text-lg font-semibold"><Money value={value} /></p>
          </div>
        ))}
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-dark-600 dark:bg-dark-800">
          <p className="text-sm font-semibold">{isAr ? 'الأرباح والخسائر (الفترة)' : 'P&L (period)'}</p>
          <div className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between"><span>{isAr ? 'الإيرادات' : 'Revenue'}</span><Money value={pnl?.totalRevenue} /></div>
            <div className="flex justify-between"><span>{isAr ? 'المصروفات' : 'Expenses'}</span><Money value={pnl?.totalExpenses} /></div>
            <div className="flex justify-between border-t border-slate-100 pt-2 font-semibold dark:border-white/10"><span>{isAr ? 'صافي' : 'Net'}</span><Money value={pnl?.netIncome} /></div>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-dark-600 dark:bg-dark-800">
          <p className="text-sm font-semibold">{isAr ? 'الميزانية (ملخص)' : 'Balance sheet (summary)'}</p>
          <div className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between"><span>{isAr ? 'الأصول' : 'Assets'}</span><Money value={bs?.totalAssets} /></div>
            <div className="flex justify-between"><span>{isAr ? 'الخصوم' : 'Liabilities'}</span><Money value={bs?.totalLiabilities} /></div>
            <div className="flex justify-between"><span>{isAr ? 'حقوق الملكية' : 'Equity'}</span><Money value={bs?.totalEquity} /></div>
          </div>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-dark-600 dark:bg-dark-800">
          <p className="text-sm font-semibold">{isAr ? 'أعمار المدينين' : 'Aged receivables'}</p>
          <p className="mt-1 text-xs text-slate-500">{isAr ? 'فواتير مفتوحة' : 'Open invoices'}: {dash?.agedAr?.openCount ?? 0}</p>
          <p className="mt-2 text-lg font-semibold"><Money value={dash?.agedAr?.buckets?.total} /></p>
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-dark-600 dark:bg-dark-800">
          <p className="text-sm font-semibold">{isAr ? 'أعمار الدائنين' : 'Aged payables'}</p>
          <p className="mt-1 text-xs text-slate-500">{isAr ? 'فواتير مفتوحة' : 'Open bills'}: {dash?.agedAp?.openCount ?? 0}</p>
          <p className="mt-2 text-lg font-semibold"><Money value={dash?.agedAp?.buckets?.total} /></p>
        </div>
      </div>
    </div>
  )
}

export function FiscalPositionsPanel({ language }) {
  const isAr = language === 'ar'
  const { data, refetch, isFetching } = useQuery({
    queryKey: ['accounting-fiscal-positions'],
    queryFn: () => api.get('/accounting/fiscal-positions').then((r) => r.data),
  })
  const [rows, setRows] = useState([])

  useEffect(() => {
    if (data?.positions) setRows(data.positions.map((row) => ({ ...row })))
  }, [data?.positions])

  const save = useMutation({
    mutationFn: () => api.put('/accounting/fiscal-positions', { positions: rows }).then((r) => r.data),
    onSuccess: () => refetch(),
  })

  const addRow = () => {
    setRows((prev) => [...prev, { code: '', name: '', nameAr: '', isDefault: prev.length === 0 }])
  }

  const updateRow = (index, key, value) => {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, [key]: value } : row)))
  }

  const setDefault = (index) => {
    setRows((prev) => prev.map((row, i) => ({ ...row, isDefault: i === index })))
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">{isAr ? 'المراكز الضريبية' : 'Fiscal positions'}</p>
          <p className="text-xs text-slate-500">{isAr ? 'تُستخدم في فواتير المبيعات (Other info).' : 'Used on sales invoices (Other info tab).'}</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={addRow} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold dark:border-dark-600">{isAr ? 'إضافة' : 'Add'}</button>
          <button type="button" disabled={save.isPending || isFetching} onClick={() => save.mutate()} className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{save.isPending ? '…' : (isAr ? 'حفظ' : 'Save')}</button>
        </div>
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-dark-600 dark:bg-dark-800">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-400 dark:bg-dark-900">
            <tr>
              <th className="px-4 py-2 text-start">{isAr ? 'الرمز' : 'Code'}</th>
              <th className="px-4 py-2 text-start">{isAr ? 'الاسم' : 'Name'}</th>
              <th className="px-4 py-2 text-start">{isAr ? 'عربي' : 'Arabic'}</th>
              <th className="px-4 py-2 text-center">{isAr ? 'افتراضي' : 'Default'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/5">
            {rows.map((row, index) => (
              <tr key={`${row.code}-${index}`}>
                <td className="px-4 py-2"><input value={row.code || ''} onChange={(e) => updateRow(index, 'code', e.target.value)} className="w-full rounded-lg border border-slate-200 px-2 py-1 text-sm dark:border-dark-600 dark:bg-dark-900" /></td>
                <td className="px-4 py-2"><input value={row.name || ''} onChange={(e) => updateRow(index, 'name', e.target.value)} className="w-full rounded-lg border border-slate-200 px-2 py-1 text-sm dark:border-dark-600 dark:bg-dark-900" /></td>
                <td className="px-4 py-2"><input value={row.nameAr || ''} onChange={(e) => updateRow(index, 'nameAr', e.target.value)} className="w-full rounded-lg border border-slate-200 px-2 py-1 text-sm dark:border-dark-600 dark:bg-dark-900" /></td>
                <td className="px-4 py-2 text-center"><input type="radio" name="fiscal-default" checked={Boolean(row.isDefault)} onChange={() => setDefault(index)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function InvoiceAnalysisPanel({ language }) {
  const isAr = language === 'ar'
  const [from, setFrom] = useState(yearStartIso())
  const [to, setTo] = useState(todayIso())
  const [flow, setFlow] = useState('all')
  const { data, isFetching } = useQuery({
    queryKey: ['accounting-invoice-analysis', from, to, flow],
    queryFn: () => api.get('/accounting/reports/invoice-analysis', {
      params: { from, to, flow: flow === 'all' ? undefined : flow },
    }).then((r) => r.data),
  })
  const s = data?.summary || {}

  return (
    <div className="space-y-4">
      <DateRangeBar
        from={from}
        to={to}
        setFrom={setFrom}
        setTo={setTo}
        language={language}
        extra={(
          <label className="text-xs font-medium text-slate-500">
            {isAr ? 'النوع' : 'Flow'}
            <select value={flow} onChange={(e) => setFlow(e.target.value)} className="mt-1 block rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-dark-600 dark:bg-dark-900">
              <option value="all">{isAr ? 'الكل' : 'All'}</option>
              <option value="sell">{isAr ? 'مبيعات' : 'Sales'}</option>
              <option value="purchase">{isAr ? 'مشتريات' : 'Purchases'}</option>
            </select>
          </label>
        )}
      />
      {isFetching ? <p className="text-xs text-slate-400">…</p> : null}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          [isAr ? 'عدد الفواتير' : 'Invoices', s.invoiceCount],
          [isAr ? 'إجمالي المبيعات' : 'Sales total', s.sellTotal, true],
          [isAr ? 'إجمالي المشتريات' : 'Purchase total', s.purchaseTotal, true],
          [isAr ? 'الضريبة' : 'Tax', s.taxTotal, true],
        ].map(([label, value, money]) => (
          <div key={label} className="rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-dark-600 dark:bg-dark-800">
            <p className="text-[11px] uppercase tracking-widest text-slate-400">{label}</p>
            <p className="mt-1 text-lg font-semibold">{money ? <Money value={value} /> : (value ?? 0)}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-dark-600 dark:bg-dark-800">
          <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold dark:border-white/10">{isAr ? 'حسب الشهر' : 'By month'}</div>
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-[11px] uppercase text-slate-400 dark:bg-dark-900">
              <tr>
                <th className="px-4 py-2 text-start">{isAr ? 'الشهر' : 'Month'}</th>
                <th className="px-4 py-2 text-end">{isAr ? 'عدد' : 'Count'}</th>
                <th className="px-4 py-2 text-end">{isAr ? 'الإجمالي' : 'Total'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {(data?.byMonth || []).map((row) => (
                <tr key={row.month}>
                  <td className="px-4 py-2 font-mono text-xs">{row.month}</td>
                  <td className="px-4 py-2 text-end">{row.count}</td>
                  <td className="px-4 py-2 text-end"><Money value={row.total} /></td>
                </tr>
              ))}
              {!(data?.byMonth || []).length && (
                <tr><td colSpan={3} className="px-4 py-8 text-center text-slate-400">{isAr ? 'لا بيانات' : 'No data'}</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-dark-600 dark:bg-dark-800">
          <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold dark:border-white/10">{isAr ? 'حالة الدفع' : 'Payment status'}</div>
          <div className="space-y-2 p-4 text-sm">
            {Object.entries(data?.byPaymentStatus || {}).map(([key, count]) => (
              <div key={key} className="flex justify-between">
                <span className="capitalize text-slate-500">{key}</span>
                <span className="font-semibold">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-dark-600 dark:bg-dark-800">
          <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold dark:border-white/10">{isAr ? 'أعلى الشركاء' : 'Top partners'}</div>
          <table className="min-w-full text-sm">
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {(data?.topPartners || []).map((row) => (
                <tr key={`${row.flow}-${row.partnerId || row.name}`}>
                  <td className="px-4 py-2">
                    <p>{row.name}</p>
                    <p className="text-[11px] text-slate-400">{row.flow === 'purchase' ? (isAr ? 'مورد' : 'Vendor') : (isAr ? 'عميل' : 'Customer')} · {row.count}</p>
                  </td>
                  <td className="px-4 py-2 text-end"><Money value={row.total} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-dark-600 dark:bg-dark-800">
          <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold dark:border-white/10">{isAr ? 'أعلى المنتجات' : 'Top products'}</div>
          <table className="min-w-full text-sm">
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {(data?.topProducts || []).map((row) => (
                <tr key={String(row.productId || row.name)}>
                  <td className="px-4 py-2">
                    <p>{row.name}</p>
                    <p className="text-[11px] text-slate-400">{isAr ? 'الكمية' : 'Qty'}: {row.qty}</p>
                  </td>
                  <td className="px-4 py-2 text-end"><Money value={row.amount} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export function PaymentTermsPanel({ language }) {
  const isAr = language === 'ar'
  const { data, refetch, isFetching } = useQuery({
    queryKey: ['accounting-payment-terms'],
    queryFn: () => api.get('/accounting/payment-terms').then((r) => r.data),
  })
  const [terms, setTerms] = useState([])
  const [defaultId, setDefaultId] = useState('net30')

  useEffect(() => {
    if (!data?.terms) return
    setTerms(data.terms.map((t) => ({ ...t })))
    setDefaultId(data.defaultPaymentTermId || 'net30')
  }, [data])

  const save = useMutation({
    mutationFn: () => api.put('/accounting/payment-terms', {
      enabledIds: terms.filter((t) => t.enabled).map((t) => t.id),
      defaultPaymentTermId: defaultId,
    }).then((r) => r.data),
    onSuccess: () => refetch(),
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">{isAr ? 'شروط الدفع' : 'Payment terms'}</p>
          <p className="text-xs text-slate-500">{isAr ? 'فعّل الشروط الظاهرة في فواتير البيع والشراء.' : 'Enable terms shown on sales and purchase invoices.'}</p>
        </div>
        <button type="button" disabled={save.isPending || isFetching} onClick={() => save.mutate()} className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {save.isPending ? '…' : (isAr ? 'حفظ' : 'Save')}
        </button>
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-dark-600 dark:bg-dark-800">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-[11px] uppercase text-slate-400 dark:bg-dark-900">
            <tr>
              <th className="px-4 py-2 text-start">{isAr ? 'مفعّل' : 'On'}</th>
              <th className="px-4 py-2 text-start">{isAr ? 'الاسم' : 'Name'}</th>
              <th className="px-4 py-2 text-start">{isAr ? 'التفاصيل' : 'Details'}</th>
              <th className="px-4 py-2 text-center">{isAr ? 'افتراضي' : 'Default'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/5">
            {terms.map((term, index) => (
              <tr key={term.id}>
                <td className="px-4 py-2">
                  <input
                    type="checkbox"
                    checked={Boolean(term.enabled)}
                    onChange={(e) => setTerms((prev) => prev.map((t, i) => (i === index ? { ...t, enabled: e.target.checked } : t)))}
                  />
                </td>
                <td className="px-4 py-2">{isAr ? term.labelAr : term.labelEn}</td>
                <td className="px-4 py-2 text-xs text-slate-500">
                  {term.kind === 'days' ? `${term.days}d` : term.kind}
                </td>
                <td className="px-4 py-2 text-center">
                  <input type="radio" name="payment-term-default" checked={defaultId === term.id} onChange={() => setDefaultId(term.id)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function IncotermsPanel({ language }) {
  const isAr = language === 'ar'
  const { data, refetch, isFetching } = useQuery({
    queryKey: ['accounting-incoterms'],
    queryFn: () => api.get('/accounting/incoterms').then((r) => r.data),
  })
  const [terms, setTerms] = useState([])
  const [defaultCode, setDefaultCode] = useState('EXW')

  useEffect(() => {
    if (!data?.terms) return
    setTerms(data.terms.map((t) => ({ ...t })))
    setDefaultCode(data.defaultIncoterm || 'EXW')
  }, [data])

  const save = useMutation({
    mutationFn: () => api.put('/accounting/incoterms', {
      enabledCodes: terms.filter((t) => t.enabled).map((t) => t.code),
      defaultIncoterm: defaultCode,
    }).then((r) => r.data),
    onSuccess: () => refetch(),
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">{isAr ? 'شروط التجارة الدولية' : 'Incoterms'}</p>
          <p className="text-xs text-slate-500">{isAr ? 'اختر الرموز المتاحة في Other info.' : 'Choose codes available on invoice Other info.'}</p>
        </div>
        <button type="button" disabled={save.isPending || isFetching} onClick={() => save.mutate()} className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {save.isPending ? '…' : (isAr ? 'حفظ' : 'Save')}
        </button>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {terms.map((term, index) => (
          <label key={term.code} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-white px-4 py-3 text-sm dark:border-dark-600 dark:bg-dark-800">
            <span className="flex items-center gap-2 font-semibold">
              <input
                type="checkbox"
                checked={Boolean(term.enabled)}
                onChange={(e) => setTerms((prev) => prev.map((t, i) => (i === index ? { ...t, enabled: e.target.checked } : t)))}
              />
              {term.code}
            </span>
            <input type="radio" name="incoterm-default" checked={defaultCode === term.code} onChange={() => setDefaultCode(term.code)} title={isAr ? 'افتراضي' : 'Default'} />
          </label>
        ))}
      </div>
    </div>
  )
}

export function BankAccountsPanel({ language }) {
  const isAr = language === 'ar'
  const navigate = useNavigate()
  const { data: accounts = [], isFetching } = useQuery({
    queryKey: ['accounting-accounts'],
    queryFn: () => api.get('/accounting/accounts').then((r) => r.data || []),
  })
  const { data: apSettings } = useQuery({
    queryKey: ['accounting-ap-payment-settings'],
    queryFn: () => api.get('/accounting/ap-payment-settings').then((r) => r.data),
  })
  const bankAccounts = (Array.isArray(accounts) ? accounts : []).filter((a) => a.subtype === 'bank' || a.subtype === 'cash')

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-dark-600 dark:bg-dark-800">
        <p className="text-sm font-semibold">{isAr ? 'مدين SEPA (الشركة)' : 'SEPA debtor (company)'}</p>
        <p className="mt-1 text-xs text-slate-500">
          {isAr
            ? 'يُستخدم عند تصدير pain.001 لرفعه على بوابة البنك.'
            : 'Used when exporting pain.001 for upload to your bank portal.'}
        </p>
        <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
          <div><span className="text-slate-400">{isAr ? 'الاسم' : 'Name'}</span><p className="font-medium">{apSettings?.sepa?.debtorName || '—'}</p></div>
          <div><span className="text-slate-400">IBAN</span><p className="font-mono text-xs">{apSettings?.sepa?.debtorIban || '—'}</p></div>
          <div><span className="text-slate-400">BIC</span><p className="font-mono text-xs">{apSettings?.sepa?.debtorBic || '—'}</p></div>
        </div>
        <button
          type="button"
          onClick={() => navigate('/app/dashboard/accounting/defaults')}
          className="mt-3 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold dark:border-dark-600"
        >
          {isAr ? 'تعديل في الحسابات الافتراضية' : 'Edit in Default accounts'}
        </button>
      </div>
      {isFetching ? <p className="text-xs text-slate-400">…</p> : null}
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-dark-600 dark:bg-dark-800">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-[11px] uppercase text-slate-400 dark:bg-dark-900">
            <tr>
              <th className="px-4 py-2 text-start">{isAr ? 'الرمز' : 'Code'}</th>
              <th className="px-4 py-2 text-start">{isAr ? 'الاسم' : 'Name'}</th>
              <th className="px-4 py-2 text-start">{isAr ? 'النوع' : 'Type'}</th>
              <th className="px-4 py-2 text-end">{isAr ? 'الرصيد' : 'Balance'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/5">
            {bankAccounts.map((a) => (
              <tr key={a._id}>
                <td className="px-4 py-2 font-mono text-xs">{a.code}</td>
                <td className="px-4 py-2">{isAr ? (a.nameAr || a.name) : a.name}</td>
                <td className="px-4 py-2 capitalize text-slate-500">{a.subtype}</td>
                <td className="px-4 py-2 text-end"><Money value={a.balance} /></td>
              </tr>
            ))}
            {!bankAccounts.length && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">{isAr ? 'لا حسابات نقد/بنك في الدليل' : 'No cash/bank accounts in chart'}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function CurrenciesPanel({ language }) {
  const isAr = language === 'ar'
  const { data, refetch, isFetching } = useQuery({
    queryKey: ['accounting-currencies'],
    queryFn: () => api.get('/accounting/currencies').then((r) => r.data),
  })
  const [rows, setRows] = useState([])
  useEffect(() => {
    if (data?.currencies) setRows(data.currencies.map((r) => ({ ...r })))
  }, [data?.currencies])
  const save = useMutation({
    mutationFn: () => api.put('/accounting/currencies', { currencies: rows }).then((r) => r.data),
    onSuccess: () => refetch(),
  })
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">{isAr ? 'العملات' : 'Currencies'}</p>
          <p className="text-xs text-slate-500">
            {isAr ? `عملة الشركة: ${data?.companyCurrency || '—'}` : `Company currency: ${data?.companyCurrency || '—'}`}
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setRows((p) => [...p, { code: '', name: '', nameAr: '', rate: 1, active: true }])} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold dark:border-dark-600">{isAr ? 'إضافة' : 'Add'}</button>
          <button type="button" disabled={save.isPending || isFetching} onClick={() => save.mutate()} className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{save.isPending ? '…' : (isAr ? 'حفظ' : 'Save')}</button>
        </div>
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-dark-600 dark:bg-dark-800">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-[11px] uppercase text-slate-400 dark:bg-dark-900">
            <tr>
              <th className="px-3 py-2 text-start">{isAr ? 'مفعّل' : 'On'}</th>
              <th className="px-3 py-2 text-start">{isAr ? 'الرمز' : 'Code'}</th>
              <th className="px-3 py-2 text-start">{isAr ? 'الاسم' : 'Name'}</th>
              <th className="px-3 py-2 text-start">{isAr ? 'عربي' : 'Arabic'}</th>
              <th className="px-3 py-2 text-end">{isAr ? 'سعر الصرف' : 'Rate'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/5">
            {rows.map((row, i) => (
              <tr key={`${row.code}-${i}`}>
                <td className="px-3 py-2"><input type="checkbox" checked={row.active !== false} onChange={(e) => setRows((p) => p.map((r, idx) => (idx === i ? { ...r, active: e.target.checked } : r)))} /></td>
                <td className="px-3 py-2"><input value={row.code || ''} onChange={(e) => setRows((p) => p.map((r, idx) => (idx === i ? { ...r, code: e.target.value.toUpperCase() } : r)))} className="w-20 rounded-lg border border-slate-200 px-2 py-1 dark:border-dark-600 dark:bg-dark-900" /></td>
                <td className="px-3 py-2"><input value={row.name || ''} onChange={(e) => setRows((p) => p.map((r, idx) => (idx === i ? { ...r, name: e.target.value } : r)))} className="w-full rounded-lg border border-slate-200 px-2 py-1 dark:border-dark-600 dark:bg-dark-900" /></td>
                <td className="px-3 py-2"><input value={row.nameAr || ''} onChange={(e) => setRows((p) => p.map((r, idx) => (idx === i ? { ...r, nameAr: e.target.value } : r)))} className="w-full rounded-lg border border-slate-200 px-2 py-1 dark:border-dark-600 dark:bg-dark-900" /></td>
                <td className="px-3 py-2 text-end"><input type="number" step="0.0001" value={row.rate ?? 1} onChange={(e) => setRows((p) => p.map((r, idx) => (idx === i ? { ...r, rate: Number(e.target.value) } : r)))} className="w-28 rounded-lg border border-slate-200 px-2 py-1 text-end dark:border-dark-600 dark:bg-dark-900" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function FollowUpLevelsPanel({ language }) {
  const isAr = language === 'ar'
  const { data, refetch, isFetching } = useQuery({
    queryKey: ['accounting-follow-up-levels'],
    queryFn: () => api.get('/accounting/follow-up-levels').then((r) => r.data),
  })
  const [rows, setRows] = useState([])
  useEffect(() => {
    if (data?.levels) setRows(data.levels.map((r) => ({ ...r })))
  }, [data?.levels])
  const save = useMutation({
    mutationFn: () => api.put('/accounting/follow-up-levels', { levels: rows }).then((r) => r.data),
    onSuccess: () => refetch(),
  })
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">{isAr ? 'مستويات المتابعة' : 'Follow-up levels'}</p>
          <p className="text-xs text-slate-500">{isAr ? 'عتبات التأخير لقنوات التذكير.' : 'Overdue day thresholds for reminder channels.'}</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setRows((p) => [...p, { level: p.length + 1, daysOverdue: 0, name: '', nameAr: '', channel: 'whatsapp' }])} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold dark:border-dark-600">{isAr ? 'إضافة' : 'Add'}</button>
          <button type="button" disabled={save.isPending || isFetching} onClick={() => save.mutate()} className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{save.isPending ? '…' : (isAr ? 'حفظ' : 'Save')}</button>
        </div>
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-dark-600 dark:bg-dark-800">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-[11px] uppercase text-slate-400 dark:bg-dark-900">
            <tr>
              <th className="px-3 py-2 text-start">#</th>
              <th className="px-3 py-2 text-start">{isAr ? 'أيام التأخير' : 'Days overdue'}</th>
              <th className="px-3 py-2 text-start">{isAr ? 'الاسم' : 'Name'}</th>
              <th className="px-3 py-2 text-start">{isAr ? 'عربي' : 'Arabic'}</th>
              <th className="px-3 py-2 text-start">{isAr ? 'القناة' : 'Channel'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/5">
            {rows.map((row, i) => (
              <tr key={i}>
                <td className="px-3 py-2"><input type="number" value={row.level || i + 1} onChange={(e) => setRows((p) => p.map((r, idx) => (idx === i ? { ...r, level: Number(e.target.value) } : r)))} className="w-14 rounded-lg border border-slate-200 px-2 py-1 dark:border-dark-600 dark:bg-dark-900" /></td>
                <td className="px-3 py-2"><input type="number" value={row.daysOverdue ?? 0} onChange={(e) => setRows((p) => p.map((r, idx) => (idx === i ? { ...r, daysOverdue: Number(e.target.value) } : r)))} className="w-20 rounded-lg border border-slate-200 px-2 py-1 dark:border-dark-600 dark:bg-dark-900" /></td>
                <td className="px-3 py-2"><input value={row.name || ''} onChange={(e) => setRows((p) => p.map((r, idx) => (idx === i ? { ...r, name: e.target.value } : r)))} className="w-full rounded-lg border border-slate-200 px-2 py-1 dark:border-dark-600 dark:bg-dark-900" /></td>
                <td className="px-3 py-2"><input value={row.nameAr || ''} onChange={(e) => setRows((p) => p.map((r, idx) => (idx === i ? { ...r, nameAr: e.target.value } : r)))} className="w-full rounded-lg border border-slate-200 px-2 py-1 dark:border-dark-600 dark:bg-dark-900" /></td>
                <td className="px-3 py-2">
                  <select value={row.channel || 'whatsapp'} onChange={(e) => setRows((p) => p.map((r, idx) => (idx === i ? { ...r, channel: e.target.value } : r)))} className="rounded-lg border border-slate-200 px-2 py-1 dark:border-dark-600 dark:bg-dark-900">
                    <option value="whatsapp">WhatsApp</option>
                    <option value="email">Email</option>
                    <option value="sms">SMS</option>
                    <option value="call">Call</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function AnalyticItemsPanel({ language }) {
  const isAr = language === 'ar'
  const [from, setFrom] = useState(yearStartIso())
  const [to, setTo] = useState(todayIso())
  const [analyticAccountId, setAnalyticAccountId] = useState('')
  const { data: analytics = [] } = useQuery({
    queryKey: ['accounting-analytic-accounts'],
    queryFn: () => api.get('/accounting/analytic-accounts').then((r) => r.data || []),
  })
  const { data, isFetching } = useQuery({
    queryKey: ['accounting-analytic-items', from, to, analyticAccountId],
    queryFn: () => api.get('/accounting/journal-items', {
      params: { from, to, analyticAccountId: analyticAccountId || undefined, limit: 200 },
    }).then((r) => r.data),
  })
  const items = (data?.items || []).filter((row) => row.analyticAccountId)
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
              <option value="">{isAr ? 'الكل (مع تحليل)' : 'All (with analytic)'}</option>
              {(Array.isArray(analytics) ? analytics : []).map((a) => (
                <option key={a._id} value={a._id}>{a.code} — {isAr ? (a.nameAr || a.name) : a.name}</option>
              ))}
            </select>
          </label>
        )}
      />
      <p className="text-xs text-slate-400">{isFetching ? '…' : `${items.length} ${isAr ? 'بند' : 'items'}`}</p>
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-dark-600 dark:bg-dark-800">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-[11px] uppercase text-slate-400 dark:bg-dark-900">
            <tr>
              <th className="px-4 py-2 text-start">{isAr ? 'التاريخ' : 'Date'}</th>
              <th className="px-4 py-2 text-start">{isAr ? 'القيد' : 'Entry'}</th>
              <th className="px-4 py-2 text-start">{isAr ? 'الحساب' : 'Account'}</th>
              <th className="px-4 py-2 text-end">{isAr ? 'مدين' : 'Debit'}</th>
              <th className="px-4 py-2 text-end">{isAr ? 'دائن' : 'Credit'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/5">
            {items.map((row) => (
              <tr key={row._id}>
                <td className="px-4 py-2">{row.entryDate ? new Date(row.entryDate).toLocaleDateString() : '—'}</td>
                <td className="px-4 py-2 font-mono text-xs">{row.entryNumber || '—'}</td>
                <td className="px-4 py-2">{row.accountCode || '—'} · {row.description || ''}</td>
                <td className="px-4 py-2 text-end"><Money value={row.debit} /></td>
                <td className="px-4 py-2 text-end"><Money value={row.credit} /></td>
              </tr>
            ))}
            {!items.length && <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">{isAr ? 'لا بنود تحليلية' : 'No analytic items'}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function FixedAssetsPanel({ language }) {
  const isAr = language === 'ar'
  const [modelCode, setModelCode] = useState('')
  const [selectedAsset, setSelectedAsset] = useState(null)
  const { data: modelsData } = useQuery({
    queryKey: ['accounting-asset-models'],
    queryFn: () => api.get('/accounting/asset-models').then((r) => r.data),
  })
  const { data, isFetching, refetch } = useQuery({
    queryKey: ['accounting-fixed-assets', modelCode],
    queryFn: () => api.get('/accounting/reports/fixed-assets', { params: { modelCode: modelCode || undefined } }).then((r) => r.data),
  })

  const postDepr = useMutation({
    mutationFn: () => api.post('/accounting/actions/post-depreciation', { modelCode: modelCode || undefined }).then((r) => r.data),
    onSuccess: (res) => {
      toast.success(res.created
        ? (isAr ? `تم ترحيل إهلاك ${res.periodKey}` : `Posted depreciation ${res.periodKey}`)
        : (res.message || (isAr ? 'موجود مسبقاً' : 'Already posted')))
      refetch()
    },
    onError: (e) => toast.error(e.response?.data?.error || 'Failed'),
  })

  const schedule = useMemo(() => {
    if (!selectedAsset) return []
    const months = Math.min(60, Number(selectedAsset.usefulLifeMonths) || 60)
    const monthly = Number(selectedAsset.monthlyDepreciation) || 0
    const start = new Date()
    return Array.from({ length: months }, (_, i) => {
      const d = new Date(start.getFullYear(), start.getMonth() + i, 1)
      return {
        period: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        amount: monthly,
        status: i === 0 ? (isAr ? 'الشهر الحالي' : 'Current month') : (isAr ? 'مسودة مجدولة' : 'Scheduled draft'),
      }
    })
  }, [selectedAsset, isAr])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <label className="text-xs font-medium text-slate-500">
          {isAr ? 'نموذج الإهلاك' : 'Depreciation model'}
          <select value={modelCode} onChange={(e) => setModelCode(e.target.value)} className="mt-1 block rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-dark-600 dark:bg-dark-900">
            <option value="">{isAr ? 'الافتراضي' : 'Default'}</option>
            {(modelsData?.models || []).map((m) => (
              <option key={m.code} value={m.code}>{m.code} — {isAr ? (m.nameAr || m.name) : m.name}</option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={postDepr.isPending}
          onClick={() => postDepr.mutate()}
          className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {postDepr.isPending ? '…' : (isAr ? 'ترحيل إهلاك هذا الشهر' : 'Post this month’s depreciation')}
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-dark-600 dark:bg-dark-800">
          <p className="text-[11px] uppercase tracking-widest text-slate-400">{isAr ? 'تكلفة الأصول' : 'Asset cost'}</p>
          <p className="mt-1 text-lg font-semibold"><Money value={data?.totals?.cost} /></p>
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-dark-600 dark:bg-dark-800">
          <p className="text-[11px] uppercase tracking-widest text-slate-400">{isAr ? 'صافي القيمة الدفترية' : 'Net book value'}</p>
          <p className="mt-1 text-lg font-semibold"><Money value={data?.totals?.netBookValue} /></p>
          <p className="mt-1 text-[11px] text-slate-400">
            {isAr ? 'مجمع الإهلاك' : 'Accum. depr.'} {data?.accumDepreciation?.code || '1650'}: <Money value={data?.accumDepreciation?.balance} />
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-dark-600 dark:bg-dark-800">
          <p className="text-[11px] uppercase tracking-widest text-slate-400">{isAr ? 'إهلاك شهري' : 'Monthly depreciation'}</p>
          <p className="mt-1 text-lg font-semibold"><Money value={data?.totals?.monthlyDepreciation} /></p>
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-dark-600 dark:bg-dark-800">
          <p className="text-[11px] uppercase tracking-widest text-slate-400">{isAr ? 'إهلاك سنوي' : 'Annual depreciation'}</p>
          <p className="mt-1 text-lg font-semibold"><Money value={data?.totals?.annualDepreciation} /></p>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-dark-600 dark:bg-dark-800">
          <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold dark:border-white/10">{isAr ? 'سجل الأصول' : 'Asset register'}</div>
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-[11px] uppercase text-slate-400 dark:bg-dark-900">
              <tr>
                <th className="px-4 py-2 text-start">{isAr ? 'الحساب' : 'Account'}</th>
                <th className="px-4 py-2 text-end">{isAr ? 'التكلفة' : 'Cost'}</th>
                <th className="px-4 py-2 text-end">{isAr ? 'شهري' : 'Monthly'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {(data?.rows || []).map((row) => (
                <tr
                  key={row.accountId}
                  className={`cursor-pointer hover:bg-emerald-50/50 dark:hover:bg-white/[0.04] ${selectedAsset?.accountId === row.accountId ? 'bg-emerald-50/70 dark:bg-emerald-950/20' : ''}`}
                  onClick={() => setSelectedAsset(row)}
                >
                  <td className="px-4 py-2">{row.code} — {isAr ? (row.nameAr || row.name) : row.name}</td>
                  <td className="px-4 py-2 text-end"><Money value={row.cost} /></td>
                  <td className="px-4 py-2 text-end"><Money value={row.monthlyDepreciation} /></td>
                </tr>
              ))}
              {!(data?.rows || []).length && <tr><td colSpan={3} className="px-4 py-8 text-center text-slate-400">{isAr ? 'لا أصول ثابتة في الدليل' : 'No fixed-asset accounts'}</td></tr>}
            </tbody>
          </table>
          {isFetching ? <p className="px-4 py-2 text-xs text-slate-400">…</p> : null}
        </div>
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-dark-600 dark:bg-dark-800">
          <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold dark:border-white/10">
            {isAr ? 'لوحة الإهلاك' : 'Depreciation board'}
            {selectedAsset ? ` · ${selectedAsset.code}` : ''}
          </div>
          {selectedAsset ? (
            <div className="max-h-[28rem] overflow-y-auto">
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 bg-slate-50 text-[11px] uppercase text-slate-400 dark:bg-dark-900">
                  <tr>
                    <th className="px-4 py-2 text-start">{isAr ? 'الفترة' : 'Period'}</th>
                    <th className="px-4 py-2 text-end">{isAr ? 'المبلغ' : 'Amount'}</th>
                    <th className="px-4 py-2 text-start">{isAr ? 'الحالة' : 'Status'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {schedule.map((row) => (
                    <tr key={row.period}>
                      <td className="px-4 py-2 font-mono text-xs">{row.period}</td>
                      <td className="px-4 py-2 text-end"><Money value={row.amount} /></td>
                      <td className="px-4 py-2 text-xs text-slate-500">{row.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="px-4 py-10 text-center text-sm text-slate-400">{isAr ? 'اختر أصلاً لعرض جدول الإهلاك' : 'Select an asset to view the depreciation board'}</p>
          )}
        </div>
      </div>
    </div>
  )
}

export function DepreciationSchedulePanel({ language }) {
  return <FixedAssetsPanel language={language} />
}

export function DeferredAccountsPanel({ language, kind = 'expense' }) {
  const isAr = language === 'ar'
  const [modelCode, setModelCode] = useState('')
  const [selectedRow, setSelectedRow] = useState(null)
  const { data: modelsData } = useQuery({
    queryKey: ['accounting-deferred-models', kind],
    queryFn: () => api.get('/accounting/deferred-models', { params: { kind } }).then((r) => r.data),
  })
  const { data, isFetching, refetch } = useQuery({
    queryKey: ['accounting-deferred', kind, modelCode],
    queryFn: () => api.get('/accounting/reports/deferred-accounts', {
      params: { kind, modelCode: modelCode || undefined },
    }).then((r) => r.data),
  })

  const postAmort = useMutation({
    mutationFn: () => api.post('/accounting/actions/post-amortization', {
      kind,
      modelCode: modelCode || undefined,
    }).then((r) => r.data),
    onSuccess: (res) => {
      toast.success(res.created
        ? (isAr ? `تم ترحيل الإطفاء ${res.periodKey}` : `Posted amortization ${res.periodKey}`)
        : (res.message || (isAr ? 'موجود مسبقاً' : 'Already posted')))
      refetch()
    },
    onError: (e) => toast.error(e.response?.data?.error || 'Failed'),
  })

  const schedule = useMemo(() => {
    if (!selectedRow) return []
    const months = Math.min(36, Number(selectedRow.months) || 12)
    const monthly = Number(selectedRow.monthlyAmortization) || 0
    const start = new Date()
    return Array.from({ length: months }, (_, i) => {
      const d = new Date(start.getFullYear(), start.getMonth() + i, 1)
      return {
        period: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        amount: monthly,
        status: i === 0 ? (isAr ? 'الشهر الحالي' : 'Current month') : (isAr ? 'مسودة مجدولة' : 'Scheduled draft'),
      }
    })
  }, [selectedRow, isAr])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <label className="text-xs font-medium text-slate-500">
          {isAr ? 'نموذج الإطفاء' : 'Amortization model'}
          <select value={modelCode} onChange={(e) => setModelCode(e.target.value)} className="mt-1 block rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-dark-600 dark:bg-dark-900">
            <option value="">{isAr ? 'الافتراضي' : 'Default'}</option>
            {(modelsData?.models || []).map((m) => (
              <option key={m.code} value={m.code}>{m.code} — {isAr ? (m.nameAr || m.name) : m.name} ({m.months}m)</option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={postAmort.isPending}
          onClick={() => postAmort.mutate()}
          className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {postAmort.isPending ? '…' : (isAr ? 'ترحيل إطفاء هذا الشهر' : 'Post this month’s amortization')}
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-dark-600 dark:bg-dark-800">
          <p className="text-sm font-semibold">
            {kind === 'revenue'
              ? (isAr ? 'إيرادات مؤجلة' : 'Deferred revenues')
              : (isAr ? 'مصروفات مؤجلة / مدفوعة مقدماً' : 'Deferred / prepaid expenses')}
          </p>
          <p className="mt-1 text-lg font-semibold"><Money value={data?.total} /></p>
          {isFetching ? <p className="text-xs text-slate-400">…</p> : null}
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-dark-600 dark:bg-dark-800">
          <p className="text-sm font-semibold">{isAr ? 'إطفاء شهري تقديري' : 'Est. monthly amortization'}</p>
          <p className="mt-1 text-lg font-semibold"><Money value={data?.monthlyTotal} /></p>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-dark-600 dark:bg-dark-800">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-[11px] uppercase text-slate-400 dark:bg-dark-900">
              <tr>
                <th className="px-4 py-2 text-start">{isAr ? 'الحساب' : 'Account'}</th>
                <th className="px-4 py-2 text-end">{isAr ? 'الرصيد' : 'Balance'}</th>
                <th className="px-4 py-2 text-end">{isAr ? 'شهري' : 'Monthly'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {(data?.rows || []).map((row) => (
                <tr
                  key={row.accountId}
                  className={`cursor-pointer hover:bg-emerald-50/50 dark:hover:bg-white/[0.04] ${selectedRow?.accountId === row.accountId ? 'bg-emerald-50/70 dark:bg-emerald-950/20' : ''}`}
                  onClick={() => setSelectedRow(row)}
                >
                  <td className="px-4 py-2">{row.code} — {isAr ? (row.nameAr || row.name) : row.name}</td>
                  <td className="px-4 py-2 text-end"><Money value={row.balance} /></td>
                  <td className="px-4 py-2 text-end"><Money value={row.monthlyAmortization} /></td>
                </tr>
              ))}
              {!(data?.rows || []).length && <tr><td colSpan={3} className="px-4 py-8 text-center text-slate-400">{isAr ? 'لا حسابات' : 'No accounts'}</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-dark-600 dark:bg-dark-800">
          <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold dark:border-white/10">
            {isAr ? 'لوحة الإطفاء' : 'Amortization board'}
            {selectedRow ? ` · ${selectedRow.code}` : ''}
          </div>
          {selectedRow ? (
            <div className="max-h-[28rem] overflow-y-auto">
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 bg-slate-50 text-[11px] uppercase text-slate-400 dark:bg-dark-900">
                  <tr>
                    <th className="px-4 py-2 text-start">{isAr ? 'الفترة' : 'Period'}</th>
                    <th className="px-4 py-2 text-end">{isAr ? 'المبلغ' : 'Amount'}</th>
                    <th className="px-4 py-2 text-start">{isAr ? 'الحالة' : 'Status'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {schedule.map((row) => (
                    <tr key={row.period}>
                      <td className="px-4 py-2 font-mono text-xs">{row.period}</td>
                      <td className="px-4 py-2 text-end"><Money value={row.amount} /></td>
                      <td className="px-4 py-2 text-xs text-slate-500">{row.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="px-4 py-10 text-center text-sm text-slate-400">{isAr ? 'اختر حساباً لعرض جدول الإطفاء' : 'Select an account to view the amortization board'}</p>
          )}
        </div>
      </div>
    </div>
  )
}

export function DeferredModelsPanel({ language, kind = 'expense' }) {
  const isAr = language === 'ar'
  const { data, refetch, isFetching } = useQuery({
    queryKey: ['accounting-deferred-models', kind],
    queryFn: () => api.get('/accounting/deferred-models', { params: { kind } }).then((r) => r.data),
  })
  const [rows, setRows] = useState([])
  useEffect(() => { if (data?.models) setRows(data.models.map((r) => ({ ...r }))) }, [data?.models])
  const save = useMutation({
    mutationFn: () => api.put('/accounting/deferred-models', { kind, models: rows }).then((r) => r.data),
    onSuccess: () => { toast.success(isAr ? 'تم الحفظ' : 'Saved'); refetch() },
    onError: (e) => toast.error(e.response?.data?.error || 'Failed'),
  })
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold">
          {kind === 'revenue'
            ? (isAr ? 'نماذج الإيرادات المؤجلة' : 'Deferred revenue models')
            : (isAr ? 'نماذج المصروفات المؤجلة' : 'Deferred expense models')}
        </p>
        <div className="flex gap-2">
          <button type="button" onClick={() => setRows((p) => [...p, { code: '', name: '', nameAr: '', months: 12, kind }])} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold dark:border-dark-600">{isAr ? 'إضافة' : 'Add'}</button>
          <button type="button" disabled={save.isPending || isFetching} onClick={() => save.mutate()} className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{isAr ? 'حفظ' : 'Save'}</button>
        </div>
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-dark-600 dark:bg-dark-800">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-[11px] uppercase text-slate-400 dark:bg-dark-900">
            <tr>
              <th className="px-3 py-2 text-start">{isAr ? 'الرمز' : 'Code'}</th>
              <th className="px-3 py-2 text-start">{isAr ? 'الاسم' : 'Name'}</th>
              <th className="px-3 py-2 text-end">{isAr ? 'الأشهر' : 'Months'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/5">
            {rows.map((row, i) => (
              <tr key={i}>
                <td className="px-3 py-2"><input value={row.code || ''} onChange={(e) => setRows((p) => p.map((r, idx) => (idx === i ? { ...r, code: e.target.value } : r)))} className="w-28 rounded-lg border border-slate-200 px-2 py-1 dark:border-dark-600 dark:bg-dark-900" /></td>
                <td className="px-3 py-2"><input value={row.name || ''} onChange={(e) => setRows((p) => p.map((r, idx) => (idx === i ? { ...r, name: e.target.value } : r)))} className="w-full rounded-lg border border-slate-200 px-2 py-1 dark:border-dark-600 dark:bg-dark-900" /></td>
                <td className="px-3 py-2 text-end"><input type="number" value={row.months ?? 12} onChange={(e) => setRows((p) => p.map((r, idx) => (idx === i ? { ...r, months: Number(e.target.value) } : r)))} className="w-20 rounded-lg border border-slate-200 px-2 py-1 text-end dark:border-dark-600 dark:bg-dark-900" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function AssetModelsPanel({ language }) {
  const isAr = language === 'ar'
  const { data, refetch, isFetching } = useQuery({
    queryKey: ['accounting-asset-models'],
    queryFn: () => api.get('/accounting/asset-models').then((r) => r.data),
  })
  const [rows, setRows] = useState([])
  useEffect(() => { if (data?.models) setRows(data.models.map((r) => ({ ...r }))) }, [data?.models])
  const save = useMutation({
    mutationFn: () => api.put('/accounting/asset-models', { models: rows }).then((r) => r.data),
    onSuccess: () => refetch(),
  })
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold">{isAr ? 'نماذج الأصول' : 'Asset models'}</p>
        <div className="flex gap-2">
          <button type="button" onClick={() => setRows((p) => [...p, { code: '', name: '', nameAr: '', usefulLifeMonths: 60, salvagePct: 0, method: 'straight_line' }])} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold dark:border-dark-600">{isAr ? 'إضافة' : 'Add'}</button>
          <button type="button" disabled={save.isPending || isFetching} onClick={() => save.mutate()} className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{isAr ? 'حفظ' : 'Save'}</button>
        </div>
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-dark-600 dark:bg-dark-800">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-[11px] uppercase text-slate-400 dark:bg-dark-900">
            <tr>
              <th className="px-3 py-2 text-start">{isAr ? 'الرمز' : 'Code'}</th>
              <th className="px-3 py-2 text-start">{isAr ? 'الاسم' : 'Name'}</th>
              <th className="px-3 py-2 text-start">{isAr ? 'الطريقة' : 'Method'}</th>
              <th className="px-3 py-2 text-end">{isAr ? 'العمر (شهر)' : 'Life (mo)'}</th>
              <th className="px-3 py-2 text-end">{isAr ? 'خردة %' : 'Salvage %'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/5">
            {rows.map((row, i) => (
              <tr key={i}>
                <td className="px-3 py-2"><input value={row.code || ''} onChange={(e) => setRows((p) => p.map((r, idx) => (idx === i ? { ...r, code: e.target.value } : r)))} className="w-24 rounded-lg border border-slate-200 px-2 py-1 dark:border-dark-600 dark:bg-dark-900" /></td>
                <td className="px-3 py-2"><input value={row.name || ''} onChange={(e) => setRows((p) => p.map((r, idx) => (idx === i ? { ...r, name: e.target.value } : r)))} className="w-full rounded-lg border border-slate-200 px-2 py-1 dark:border-dark-600 dark:bg-dark-900" /></td>
                <td className="px-3 py-2">
                  <select value={row.method || 'straight_line'} onChange={(e) => setRows((p) => p.map((r, idx) => (idx === i ? { ...r, method: e.target.value } : r)))} className="rounded-lg border border-slate-200 px-2 py-1 dark:border-dark-600 dark:bg-dark-900">
                    <option value="straight_line">{isAr ? 'قسط ثابت' : 'Straight line'}</option>
                    <option value="declining_balance">{isAr ? 'قسط متناقص' : 'Declining balance'}</option>
                  </select>
                </td>
                <td className="px-3 py-2 text-end"><input type="number" value={row.usefulLifeMonths ?? 60} onChange={(e) => setRows((p) => p.map((r, idx) => (idx === i ? { ...r, usefulLifeMonths: Number(e.target.value) } : r)))} className="w-20 rounded-lg border border-slate-200 px-2 py-1 text-end dark:border-dark-600 dark:bg-dark-900" /></td>
                <td className="px-3 py-2 text-end"><input type="number" value={row.salvagePct ?? 0} onChange={(e) => setRows((p) => p.map((r, idx) => (idx === i ? { ...r, salvagePct: Number(e.target.value) } : r)))} className="w-20 rounded-lg border border-slate-200 px-2 py-1 text-end dark:border-dark-600 dark:bg-dark-900" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function AnalyticPlansPanel({ language }) {
  const isAr = language === 'ar'
  const { data, refetch, isFetching } = useQuery({
    queryKey: ['accounting-analytic-plans'],
    queryFn: () => api.get('/accounting/analytic-plans').then((r) => r.data),
  })
  const [rows, setRows] = useState([])
  useEffect(() => { if (data?.plans) setRows(data.plans.map((r) => ({ ...r }))) }, [data?.plans])
  const save = useMutation({
    mutationFn: () => api.put('/accounting/analytic-plans', { plans: rows }).then((r) => r.data),
    onSuccess: () => refetch(),
  })
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold">{isAr ? 'الخطط التحليلية' : 'Analytic plans'}</p>
        <div className="flex gap-2">
          <button type="button" onClick={() => setRows((p) => [...p, { code: '', name: '', nameAr: '', active: true }])} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold dark:border-dark-600">{isAr ? 'إضافة' : 'Add'}</button>
          <button type="button" disabled={save.isPending || isFetching} onClick={() => save.mutate()} className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{isAr ? 'حفظ' : 'Save'}</button>
        </div>
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-dark-600 dark:bg-dark-800">
        <table className="min-w-full text-sm">
          <tbody className="divide-y divide-slate-100 dark:divide-white/5">
            {rows.map((row, i) => (
              <tr key={i}>
                <td className="px-3 py-2"><input type="checkbox" checked={row.active !== false} onChange={(e) => setRows((p) => p.map((r, idx) => (idx === i ? { ...r, active: e.target.checked } : r)))} /></td>
                <td className="px-3 py-2"><input value={row.code || ''} onChange={(e) => setRows((p) => p.map((r, idx) => (idx === i ? { ...r, code: e.target.value } : r)))} className="w-24 rounded-lg border border-slate-200 px-2 py-1 dark:border-dark-600 dark:bg-dark-900" /></td>
                <td className="px-3 py-2"><input value={row.name || ''} onChange={(e) => setRows((p) => p.map((r, idx) => (idx === i ? { ...r, name: e.target.value } : r)))} className="w-full rounded-lg border border-slate-200 px-2 py-1 dark:border-dark-600 dark:bg-dark-900" /></td>
                <td className="px-3 py-2"><input value={row.nameAr || ''} onChange={(e) => setRows((p) => p.map((r, idx) => (idx === i ? { ...r, nameAr: e.target.value } : r)))} className="w-full rounded-lg border border-slate-200 px-2 py-1 dark:border-dark-600 dark:bg-dark-900" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function AccountTagsPanel({ language }) {
  const isAr = language === 'ar'
  const { data, refetch, isFetching } = useQuery({
    queryKey: ['accounting-account-tags'],
    queryFn: () => api.get('/accounting/account-tags').then((r) => r.data),
  })
  const [text, setText] = useState('')
  useEffect(() => { if (data?.tags) setText((data.tags || []).join(', ')) }, [data?.tags])
  const save = useMutation({
    mutationFn: () => api.put('/accounting/account-tags', {
      tags: text.split(/[,،\n]/).map((t) => t.trim()).filter(Boolean),
    }).then((r) => r.data),
    onSuccess: () => refetch(),
  })
  return (
    <div className="space-y-4 rounded-2xl border border-slate-200/80 bg-white p-5 dark:border-dark-600 dark:bg-dark-800">
      <p className="text-sm font-semibold">{isAr ? 'وسوم الحسابات' : 'Account tags'}</p>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-dark-600 dark:bg-dark-900" placeholder={isAr ? 'مفصولة بفواصل' : 'Comma-separated'} />
      <button type="button" disabled={save.isPending || isFetching} onClick={() => save.mutate()} className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{isAr ? 'حفظ' : 'Save'}</button>
    </div>
  )
}

export function AccountGroupsPanel({ language }) {
  const isAr = language === 'ar'
  const { data: accounts = [], isFetching } = useQuery({
    queryKey: ['accounting-accounts'],
    queryFn: () => api.get('/accounting/accounts').then((r) => r.data || []),
  })
  const groups = useMemo(() => {
    const map = new Map()
    for (const a of (Array.isArray(accounts) ? accounts : [])) {
      const key = a.type || 'other'
      if (!map.has(key)) map.set(key, { type: key, count: 0, balance: 0 })
      const g = map.get(key)
      g.count += 1
      g.balance += Number(a.balance) || 0
    }
    return [...map.values()].sort((a, b) => a.type.localeCompare(b.type))
  }, [accounts])
  return (
    <div className="space-y-4">
      {isFetching ? <p className="text-xs text-slate-400">…</p> : null}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {groups.map((g) => (
          <div key={g.type} className="rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-dark-600 dark:bg-dark-800">
            <p className="text-[11px] uppercase tracking-widest text-slate-400">{g.type}</p>
            <p className="mt-1 text-sm text-slate-500">{g.count} {isAr ? 'حساب' : 'accounts'}</p>
            <p className="mt-1 text-lg font-semibold"><Money value={g.balance} /></p>
          </div>
        ))}
      </div>
    </div>
  )
}

export function TaxGroupsPanel({ language }) {
  const isAr = language === 'ar'
  const { data: taxes = [], isFetching } = useQuery({
    queryKey: ['accounting-taxes'],
    queryFn: () => api.get('/accounting/taxes', { params: { active: 'false' } }).then((r) => r.data || []),
  })
  const groups = useMemo(() => {
    const map = new Map()
    for (const t of (Array.isArray(taxes) ? taxes : [])) {
      const key = t.type || 'other'
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(t)
    }
    return [...map.entries()]
  }, [taxes])
  return (
    <div className="space-y-4">
      {isFetching ? <p className="text-xs text-slate-400">…</p> : null}
      {groups.map(([type, rows]) => (
        <div key={type} className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-dark-600 dark:bg-dark-800">
          <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold capitalize dark:border-white/10">{type}</div>
          <ul className="divide-y divide-slate-100 dark:divide-white/5">
            {rows.map((t) => (
              <li key={t._id} className="flex justify-between px-4 py-2 text-sm">
                <span>{t.code} — {isAr ? (t.nameAr || t.name) : t.name}</span>
                <span className="tabular-nums text-slate-500">{t.rate}%</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

export function ProductCategoriesBridgePanel({ language }) {
  const isAr = language === 'ar'
  const navigate = useNavigate()
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-6 dark:border-dark-600 dark:bg-dark-800">
      <p className="text-sm font-semibold">{isAr ? 'فئات المنتجات' : 'Product categories'}</p>
      <p className="mt-2 text-sm text-slate-500">
        {isAr
          ? 'تُدار فئات المنتجات من وحدة المخزون (حسابات الدخل/المصروف على الفئة).'
          : 'Product categories are managed in Inventory (income/expense accounts on the category).'}
      </p>
      <button type="button" onClick={() => navigate('/app/dashboard/inventory/product-categories')} className="mt-4 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white">
        {isAr ? 'فتح فئات المنتجات' : 'Open product categories'}
      </button>
    </div>
  )
}

export function AccountingReportsConfigPanel({ language }) {
  const isAr = language === 'ar'
  const navigate = useNavigate()
  const links = [
    ['executive-summary', isAr ? 'الملخص التنفيذي' : 'Executive summary'],
    ['invoice-analysis', isAr ? 'تحليل الفواتير' : 'Invoice analysis'],
    ['general-ledger', isAr ? 'دفتر الأستاذ' : 'General ledger'],
    ['partner-ledger', isAr ? 'دفتر الشريك' : 'Partner ledger'],
    ['trial', isAr ? 'ميزان المراجعة' : 'Trial balance'],
    ['pnl', isAr ? 'الأرباح والخسائر' : 'Profit & loss'],
    ['balance-sheet', isAr ? 'الميزانية' : 'Balance sheet'],
    ['cash-flow', isAr ? 'التدفقات النقدية' : 'Cash flow'],
    ['aged-ar', isAr ? 'أعمار المدينين' : 'Aged AR'],
    ['aged-ap', isAr ? 'أعمار الدائنين' : 'Aged AP'],
    ['tax-report', isAr ? 'تقرير الضريبة' : 'Tax report'],
  ]
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {links.map(([id, label]) => (
        <button
          key={id}
          type="button"
          onClick={() => navigate(`/app/dashboard/accounting/${id}`)}
          className="rounded-2xl border border-slate-200/80 bg-white px-4 py-4 text-start text-sm font-semibold hover:border-slate-300 dark:border-dark-600 dark:bg-dark-800"
        >
          {label}
        </button>
      ))}
    </div>
  )
}

export function HorizontalGroupsPanel({ language }) {
  const isAr = language === 'ar'
  const { data, refetch, isFetching } = useQuery({
    queryKey: ['accounting-horizontal-groups'],
    queryFn: () => api.get('/accounting/horizontal-groups').then((r) => r.data),
  })
  const { data: accounts = [] } = useQuery({
    queryKey: ['accounting-accounts'],
    queryFn: () => api.get('/accounting/accounts').then((r) => r.data || []),
  })
  const [rows, setRows] = useState([])
  useEffect(() => {
    if (data?.groups) {
      setRows(data.groups.map((row) => ({
        ...row,
        accountPrefixesText: (row.accountPrefixes || []).join(', '),
      })))
    }
  }, [data?.groups])

  const countFor = (prefixesText) => {
    const prefixes = String(prefixesText || '').split(/[,،\s]+/).map((p) => p.trim()).filter(Boolean)
    if (!prefixes.length) return 0
    return (Array.isArray(accounts) ? accounts : []).filter((a) => prefixes.some((p) => String(a.code || '').startsWith(p))).length
  }

  const save = useMutation({
    mutationFn: () => api.put('/accounting/horizontal-groups', {
      groups: rows.map((row, idx) => ({
        code: row.code,
        name: row.name,
        nameAr: row.nameAr,
        accountPrefixes: String(row.accountPrefixesText || '').split(/[,،\s]+/).map((p) => p.trim()).filter(Boolean),
        sequence: row.sequence || (idx + 1),
      })),
    }).then((r) => r.data),
    onSuccess: () => refetch(),
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">{isAr ? 'مجموعات أفقية' : 'Horizontal groups'}</p>
          <p className="text-xs text-slate-500">{isAr ? 'تجميع أعمدة التقارير حسب بادئة رمز الحساب.' : 'Group report columns by account code prefix.'}</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setRows((p) => [...p, { code: '', name: '', nameAr: '', accountPrefixesText: '', sequence: p.length + 1 }])} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold dark:border-dark-600">{isAr ? 'إضافة' : 'Add'}</button>
          <button type="button" disabled={save.isPending || isFetching} onClick={() => save.mutate()} className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{isAr ? 'حفظ' : 'Save'}</button>
        </div>
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-dark-600 dark:bg-dark-800">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-[11px] uppercase text-slate-400 dark:bg-dark-900">
            <tr>
              <th className="px-3 py-2 text-start">{isAr ? 'الرمز' : 'Code'}</th>
              <th className="px-3 py-2 text-start">{isAr ? 'الاسم' : 'Name'}</th>
              <th className="px-3 py-2 text-start">{isAr ? 'بادئات الحساب' : 'Account prefixes'}</th>
              <th className="px-3 py-2 text-end">{isAr ? 'حسابات' : 'Accounts'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/5">
            {rows.map((row, i) => (
              <tr key={i}>
                <td className="px-3 py-2"><input value={row.code || ''} onChange={(e) => setRows((p) => p.map((r, idx) => (idx === i ? { ...r, code: e.target.value } : r)))} className="w-20 rounded-lg border border-slate-200 px-2 py-1 dark:border-dark-600 dark:bg-dark-900" /></td>
                <td className="px-3 py-2"><input value={row.name || ''} onChange={(e) => setRows((p) => p.map((r, idx) => (idx === i ? { ...r, name: e.target.value } : r)))} className="w-full rounded-lg border border-slate-200 px-2 py-1 dark:border-dark-600 dark:bg-dark-900" /></td>
                <td className="px-3 py-2"><input value={row.accountPrefixesText || ''} onChange={(e) => setRows((p) => p.map((r, idx) => (idx === i ? { ...r, accountPrefixesText: e.target.value } : r)))} placeholder="4, 5, 6" className="w-full rounded-lg border border-slate-200 px-2 py-1 font-mono text-xs dark:border-dark-600 dark:bg-dark-900" /></td>
                <td className="px-3 py-2 text-end tabular-nums text-slate-500">{countFor(row.accountPrefixesText)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function TaxUnitsPanel({ language }) {
  const isAr = language === 'ar'
  const { data, refetch, isFetching } = useQuery({
    queryKey: ['accounting-tax-units'],
    queryFn: () => api.get('/accounting/tax-units').then((r) => r.data),
  })
  const { data: taxes = [] } = useQuery({
    queryKey: ['accounting-taxes'],
    queryFn: () => api.get('/accounting/taxes', { params: { active: 'false' } }).then((r) => r.data || []),
  })
  const [rows, setRows] = useState([])
  useEffect(() => {
    if (data?.units) {
      setRows(data.units.map((row) => ({
        ...row,
        taxCodesText: (row.taxCodes || []).join(', '),
      })))
    }
  }, [data?.units])

  const save = useMutation({
    mutationFn: () => api.put('/accounting/tax-units', {
      units: rows.map((row) => ({
        code: row.code,
        name: row.name,
        nameAr: row.nameAr,
        vatNumber: row.vatNumber,
        country: row.country,
        taxCodes: String(row.taxCodesText || '').split(/[,،\s]+/).map((c) => c.trim()).filter(Boolean),
        isDefault: Boolean(row.isDefault),
      })),
    }).then((r) => r.data),
    onSuccess: () => refetch(),
  })

  const setDefault = (index) => {
    setRows((prev) => prev.map((row, i) => ({ ...row, isDefault: i === index })))
  }

  const taxHint = (Array.isArray(taxes) ? taxes : []).map((t) => t.code).filter(Boolean).join(', ')

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">{isAr ? 'وحدات الضريبة' : 'Tax units'}</p>
          <p className="text-xs text-slate-500">{isAr ? 'كيانات قانونية/فروع لإقرارات ضريبة مجمّعة.' : 'Legal entities/branches for consolidated tax filing.'}</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setRows((p) => [...p, { code: '', name: '', nameAr: '', vatNumber: '', country: 'SA', taxCodesText: '', isDefault: p.length === 0 }])} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold dark:border-dark-600">{isAr ? 'إضافة' : 'Add'}</button>
          <button type="button" disabled={save.isPending || isFetching} onClick={() => save.mutate()} className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{isAr ? 'حفظ' : 'Save'}</button>
        </div>
      </div>
      {taxHint ? <p className="text-xs text-slate-400">{isAr ? 'رموز الضريبة المتاحة:' : 'Available tax codes:'} {taxHint}</p> : null}
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-dark-600 dark:bg-dark-800">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-[11px] uppercase text-slate-400 dark:bg-dark-900">
            <tr>
              <th className="px-3 py-2 text-start">{isAr ? 'الرمز' : 'Code'}</th>
              <th className="px-3 py-2 text-start">{isAr ? 'الاسم' : 'Name'}</th>
              <th className="px-3 py-2 text-start">{isAr ? 'الرقم الضريبي' : 'VAT no.'}</th>
              <th className="px-3 py-2 text-start">{isAr ? 'الضرائب' : 'Tax codes'}</th>
              <th className="px-3 py-2 text-center">{isAr ? 'افتراضي' : 'Default'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/5">
            {rows.map((row, i) => (
              <tr key={i}>
                <td className="px-3 py-2"><input value={row.code || ''} onChange={(e) => setRows((p) => p.map((r, idx) => (idx === i ? { ...r, code: e.target.value } : r)))} className="w-20 rounded-lg border border-slate-200 px-2 py-1 dark:border-dark-600 dark:bg-dark-900" /></td>
                <td className="px-3 py-2"><input value={row.name || ''} onChange={(e) => setRows((p) => p.map((r, idx) => (idx === i ? { ...r, name: e.target.value } : r)))} className="w-full rounded-lg border border-slate-200 px-2 py-1 dark:border-dark-600 dark:bg-dark-900" /></td>
                <td className="px-3 py-2"><input value={row.vatNumber || ''} onChange={(e) => setRows((p) => p.map((r, idx) => (idx === i ? { ...r, vatNumber: e.target.value } : r)))} className="w-32 rounded-lg border border-slate-200 px-2 py-1 font-mono text-xs dark:border-dark-600 dark:bg-dark-900" /></td>
                <td className="px-3 py-2"><input value={row.taxCodesText || ''} onChange={(e) => setRows((p) => p.map((r, idx) => (idx === i ? { ...r, taxCodesText: e.target.value } : r)))} placeholder="VAT15" className="w-full rounded-lg border border-slate-200 px-2 py-1 font-mono text-xs dark:border-dark-600 dark:bg-dark-900" /></td>
                <td className="px-3 py-2 text-center"><input type="radio" name="tax-unit-default" checked={Boolean(row.isDefault)} onChange={() => setDefault(i)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function AnalyticDistributionModelsPanel({ language }) {
  const isAr = language === 'ar'
  const { data, refetch, isFetching } = useQuery({
    queryKey: ['accounting-analytic-distribution-models'],
    queryFn: () => api.get('/accounting/analytic-distribution-models').then((r) => r.data),
  })
  const [rows, setRows] = useState([])
  useEffect(() => {
    if (data?.models) setRows(data.models.map((row) => ({ ...row, lines: (row.lines || []).map((l) => ({ ...l })) })))
  }, [data?.models])

  const save = useMutation({
    mutationFn: () => api.put('/accounting/analytic-distribution-models', { models: rows }).then((r) => r.data),
    onSuccess: () => refetch(),
  })

  const updateModel = (index, key, value) => {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, [key]: value } : row)))
  }

  const updateLine = (modelIndex, lineIndex, key, value) => {
    setRows((prev) => prev.map((row, i) => {
      if (i !== modelIndex) return row
      const lines = (row.lines || []).map((line, li) => (li === lineIndex ? { ...line, [key]: value } : line))
      return { ...row, lines }
    }))
  }

  const addModel = () => {
    setRows((prev) => [...prev, {
      name: '',
      nameAr: '',
      active: true,
      priority: 10,
      matchPartnerTag: '',
      matchProductCategory: '',
      matchAccountPrefix: '',
      lines: [{ planCode: 'DEPT', analyticAccountCode: 'GEN', percent: 100 }],
    }])
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">{isAr ? 'نماذج التوزيع التحليلي' : 'Analytic distribution models'}</p>
          <p className="text-xs text-slate-500">{isAr ? 'قواعد توزيع تلقائي للحسابات التحليلية على بنود الفواتير.' : 'Rules to auto-split analytic accounts on invoice lines.'}</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={addModel} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold dark:border-dark-600">{isAr ? 'إضافة' : 'Add'}</button>
          <button type="button" disabled={save.isPending || isFetching} onClick={() => save.mutate()} className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{isAr ? 'حفظ' : 'Save'}</button>
        </div>
      </div>
      <div className="space-y-4">
        {rows.map((model, mi) => (
          <div key={mi} className="rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-dark-600 dark:bg-dark-800">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <input value={model.name || ''} onChange={(e) => updateModel(mi, 'name', e.target.value)} placeholder={isAr ? 'الاسم' : 'Name'} className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-dark-600 dark:bg-dark-900" />
              <input value={model.matchAccountPrefix || ''} onChange={(e) => updateModel(mi, 'matchAccountPrefix', e.target.value)} placeholder={isAr ? 'بادئة حساب' : 'Account prefix'} className="rounded-lg border border-slate-200 px-2 py-1.5 font-mono text-sm dark:border-dark-600 dark:bg-dark-900" />
              <input value={model.matchProductCategory || ''} onChange={(e) => updateModel(mi, 'matchProductCategory', e.target.value)} placeholder={isAr ? 'فئة منتج' : 'Product category'} className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-dark-600 dark:bg-dark-900" />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={model.active !== false} onChange={(e) => updateModel(mi, 'active', e.target.checked)} />
                {isAr ? 'نشط' : 'Active'}
              </label>
            </div>
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead className="text-slate-400">
                  <tr>
                    <th className="px-2 py-1 text-start">{isAr ? 'الخطة' : 'Plan'}</th>
                    <th className="px-2 py-1 text-start">{isAr ? 'حساب تحليلي' : 'Analytic account'}</th>
                    <th className="px-2 py-1 text-end">%</th>
                  </tr>
                </thead>
                <tbody>
                  {(model.lines || []).map((line, li) => (
                    <tr key={li}>
                      <td className="px-2 py-1"><input value={line.planCode || ''} onChange={(e) => updateLine(mi, li, 'planCode', e.target.value)} className="w-20 rounded border border-slate-200 px-2 py-1 dark:border-dark-600 dark:bg-dark-900" /></td>
                      <td className="px-2 py-1"><input value={line.analyticAccountCode || ''} onChange={(e) => updateLine(mi, li, 'analyticAccountCode', e.target.value)} className="w-28 rounded border border-slate-200 px-2 py-1 font-mono dark:border-dark-600 dark:bg-dark-900" /></td>
                      <td className="px-2 py-1 text-end"><input type="number" value={line.percent ?? 100} onChange={(e) => updateLine(mi, li, 'percent', Number(e.target.value))} className="w-16 rounded border border-slate-200 px-2 py-1 text-end dark:border-dark-600 dark:bg-dark-900" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button type="button" onClick={() => setRows((p) => p.map((r, idx) => (idx === mi ? { ...r, lines: [...(r.lines || []), { planCode: 'DEPT', analyticAccountCode: '', percent: 0 }] } : r)))} className="mt-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
              + {isAr ? 'سطر توزيع' : 'Distribution line'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

export function AutomaticTransfersPanel({ language }) {
  const isAr = language === 'ar'
  const { data: accounts = [] } = useQuery({
    queryKey: ['accounting-accounts'],
    queryFn: () => api.get('/accounting/accounts').then((r) => r.data || []),
  })
  const { data, refetch, isFetching } = useQuery({
    queryKey: ['accounting-automatic-transfers'],
    queryFn: () => api.get('/accounting/automatic-transfers').then((r) => r.data),
  })
  const [rows, setRows] = useState([])
  useEffect(() => {
    if (data?.transfers) setRows(data.transfers.map((r) => ({ ...r })))
  }, [data?.transfers])

  const save = useMutation({
    mutationFn: () => api.put('/accounting/automatic-transfers', { transfers: rows }).then((r) => r.data),
    onSuccess: () => { toast.success(isAr ? 'تم الحفظ' : 'Saved'); refetch() },
    onError: (e) => toast.error(e.response?.data?.error || 'Failed'),
  })
  const run = useMutation({
    mutationFn: () => api.post('/accounting/automatic-transfers/run').then((r) => r.data),
    onSuccess: (res) => toast.success(isAr ? `تم إنشاء ${res.count || 0} قيد` : `Created ${res.count || 0} entries`),
    onError: (e) => toast.error(e.response?.data?.error || 'Failed'),
  })

  const postable = (Array.isArray(accounts) ? accounts : []).filter((a) => a.isPostable !== false)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">{isAr ? 'تحويلات تلقائية' : 'Automatic transfers'}</p>
          <p className="text-xs text-slate-500">{isAr ? 'مسح / إعادة توزيع أرصدة الحسابات بنسبة ودورية.' : 'Sweep or reallocate account balances by percent on a schedule.'}</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setRows((p) => [...p, { name: '', nameAr: '', sourceAccountId: '', destinationAccountId: '', frequency: 'monthly', percent: 100, active: true }])} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold dark:border-dark-600">{isAr ? 'إضافة' : 'Add'}</button>
          <button type="button" disabled={save.isPending || isFetching} onClick={() => save.mutate()} className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{isAr ? 'حفظ' : 'Save'}</button>
          <button type="button" disabled={run.isPending} onClick={() => run.mutate()} className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-950/30 dark:text-emerald-200">{isAr ? 'تشغيل الآن' : 'Run now'}</button>
        </div>
      </div>
      <div className="space-y-3">
        {rows.map((row, i) => (
          <div key={i} className="grid gap-2 rounded-2xl border border-slate-200/80 bg-white p-4 sm:grid-cols-2 lg:grid-cols-6 dark:border-dark-600 dark:bg-dark-800">
            <input value={row.name || ''} onChange={(e) => setRows((p) => p.map((r, idx) => (idx === i ? { ...r, name: e.target.value } : r)))} placeholder={isAr ? 'الاسم' : 'Name'} className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-dark-600 dark:bg-dark-900 lg:col-span-2" />
            <select value={row.sourceAccountId || ''} onChange={(e) => setRows((p) => p.map((r, idx) => (idx === i ? { ...r, sourceAccountId: e.target.value } : r)))} className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-dark-600 dark:bg-dark-900">
              <option value="">{isAr ? 'مصدر' : 'Source'}</option>
              {postable.map((a) => <option key={a._id} value={a._id}>{a.code}</option>)}
            </select>
            <select value={row.destinationAccountId || ''} onChange={(e) => setRows((p) => p.map((r, idx) => (idx === i ? { ...r, destinationAccountId: e.target.value } : r)))} className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-dark-600 dark:bg-dark-900">
              <option value="">{isAr ? 'وجهة' : 'Destination'}</option>
              {postable.map((a) => <option key={a._id} value={a._id}>{a.code}</option>)}
            </select>
            <select value={row.frequency || 'monthly'} onChange={(e) => setRows((p) => p.map((r, idx) => (idx === i ? { ...r, frequency: e.target.value } : r)))} className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-dark-600 dark:bg-dark-900">
              <option value="monthly">{isAr ? 'شهري' : 'Monthly'}</option>
              <option value="quarterly">{isAr ? 'ربعي' : 'Quarterly'}</option>
              <option value="yearly">{isAr ? 'سنوي' : 'Yearly'}</option>
            </select>
            <div className="flex items-center gap-2">
              <input type="number" min="0" max="100" value={row.percent ?? 100} onChange={(e) => setRows((p) => p.map((r, idx) => (idx === i ? { ...r, percent: Number(e.target.value) } : r)))} className="w-20 rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-dark-600 dark:bg-dark-900" />
              <span className="text-xs text-slate-400">%</span>
              <label className="ms-auto flex items-center gap-1 text-xs"><input type="checkbox" checked={row.active !== false} onChange={(e) => setRows((p) => p.map((r, idx) => (idx === i ? { ...r, active: e.target.checked } : r)))} />{isAr ? 'نشط' : 'Active'}</label>
            </div>
          </div>
        ))}
        {!rows.length ? <p className="text-sm text-slate-400">{isAr ? 'لا قواعد بعد — أضف قاعدة أو استخدم إقفال الفترة.' : 'No rules yet — add one, or use Period close for P&L sweeps.'}</p> : null}
      </div>
    </div>
  )
}

export function SimpleStatusPanel({ language, titleEn, titleAr, bodyEn, bodyAr, href, ctaEn, ctaAr }) {
  const isAr = language === 'ar'
  const navigate = useNavigate()
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-6 dark:border-dark-600 dark:bg-dark-800">
      <p className="text-sm font-semibold">{isAr ? titleAr : titleEn}</p>
      <p className="mt-2 text-sm leading-relaxed text-slate-500">{isAr ? bodyAr : bodyEn}</p>
      {href ? (
        <button type="button" onClick={() => navigate(href)} className="mt-4 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold dark:border-dark-600">
          {isAr ? (ctaAr || 'متابعة') : (ctaEn || 'Continue')}
        </button>
      ) : null}
    </div>
  )
}

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

