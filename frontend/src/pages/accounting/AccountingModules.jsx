import { Fragment, useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Search } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import Money from '../../components/ui/Money'
import VirtualTableBody from '../../components/ui/VirtualTableBody'
import { ReportFilterRibbon, compareRange, variance } from './ReportFilterRibbon'
import { ConfigPanelShell } from './ConfigPanelShell'
import { CustomReportLinesSection } from './AccountingReportPanels'

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
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [accountId, setAccountId] = useState(searchParams.get('accountId') || '')
  const [from, setFrom] = useState(searchParams.get('from') || yearStartIso())
  const [to, setTo] = useState(searchParams.get('to') || todayIso())
  const [comparison, setComparison] = useState('none')
  const [basis, setBasis] = useState('accrual')

  useEffect(() => {
    const id = searchParams.get('accountId')
    if (id) setAccountId(id)
    if (searchParams.get('from')) setFrom(searchParams.get('from'))
    if (searchParams.get('to')) setTo(searchParams.get('to'))
  }, [searchParams])

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounting-accounts'],
    queryFn: () => api.get('/accounting/accounts').then((r) => r.data),
  })
  const { data, isFetching } = useQuery({
    queryKey: ['accounting-ledger', accountId, from, to],
    queryFn: () => api.get(`/accounting/reports/general-ledger/${accountId}`, { params: { from, to } }).then((r) => r.data),
    enabled: Boolean(accountId),
  })

  const openSource = (line) => {
    const model = String(line?.sourceModel || '').toLowerCase()
    const id = line?.sourceId
    if (!id) return
    if (model.includes('invoice')) navigate(`/app/dashboard/accounting/invoices/${id}`)
  }

  return (
    <div className="space-y-4">
      <ReportFilterRibbon
        language={language}
        mode="range"
        from={from}
        to={to}
        setFrom={setFrom}
        setTo={setTo}
        comparison={comparison}
        setComparison={setComparison}
        basis={basis}
        setBasis={setBasis}
        showComparison={false}
        showBasis={false}
        title={language === 'ar' ? 'دفتر الأستاذ العام' : 'General ledger'}
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
        exportProps={{
          getRows: async () => (data?.lines || []).map((line) => ({
            date: line.entryDate ? new Date(line.entryDate).toISOString().slice(0, 10) : '',
            entry: line.entryNumber,
            memo: line.memo || line.reference,
            debit: line.debit,
            credit: line.credit,
            balance: line.balance,
            source: line.sourceNumber || line.sourceModel,
          })),
          columns: [
            { key: 'date', label: language === 'ar' ? 'التاريخ' : 'Date' },
            { key: 'entry', label: language === 'ar' ? 'القيد' : 'Entry' },
            { key: 'memo', label: language === 'ar' ? 'البيان' : 'Memo' },
            { key: 'debit', label: language === 'ar' ? 'مدين' : 'Debit', value: (r) => Number(r.debit || 0).toFixed(2) },
            { key: 'credit', label: language === 'ar' ? 'دائن' : 'Credit', value: (r) => Number(r.credit || 0).toFixed(2) },
            { key: 'balance', label: language === 'ar' ? 'الرصيد' : 'Balance', value: (r) => Number(r.balance || 0).toFixed(2) },
            { key: 'source', label: language === 'ar' ? 'المصدر' : 'Source' },
          ],
          fileBaseName: 'maqder-general-ledger',
          title: language === 'ar' ? 'دفتر الأستاذ' : 'General ledger',
        }}
      />
      {!accountId && <p className="py-12 text-center text-sm text-slate-400">{language === 'ar' ? 'اختر حساباً لعرض كشف الحركة' : 'Select an account to view its ledger'}</p>}
      {accountId && (
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-dark-600 dark:bg-dark-800">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-dark-600">
            <div>
              <h3 className="font-semibold">{data?.account?.code} · {language === 'ar' ? (data?.account?.nameAr || data?.account?.name) : data?.account?.name}</h3>
              {isFetching && <p className="text-xs text-slate-400">{language === 'ar' ? 'جاري التحميل…' : 'Loading…'}</p>}
            </div>
            <div className="flex gap-4 text-sm">
              <div>
                <p className="text-[11px] uppercase text-slate-400">{language === 'ar' ? 'افتتاحي' : 'Opening'}</p>
                <p className="font-semibold"><Money value={data?.openingBalance} /></p>
              </div>
              <div>
                <p className="text-[11px] uppercase text-slate-400">{language === 'ar' ? 'ختامي' : 'Ending'}</p>
                <p className="font-semibold"><Money value={data?.endingBalance} /></p>
              </div>
            </div>
          </div>
          <table className="min-w-full text-sm">
            <thead className="sticky top-[7.5rem] bg-slate-50 text-[11px] uppercase tracking-[0.12em] text-slate-400 dark:bg-dark-900">
              <tr>
                <th className="px-4 py-3 text-start">{language === 'ar' ? 'التاريخ' : 'Date'}</th>
                <th className="px-4 py-3 text-start">{language === 'ar' ? 'القيد' : 'Entry'}</th>
                <th className="px-4 py-3 text-start">{language === 'ar' ? 'البيان' : 'Memo'}</th>
                <th className="px-4 py-3 text-start">{language === 'ar' ? 'المصدر' : 'Source'}</th>
                <th className="px-4 py-3 text-end">{language === 'ar' ? 'مدين' : 'Debit'}</th>
                <th className="px-4 py-3 text-end">{language === 'ar' ? 'دائن' : 'Credit'}</th>
                <th className="px-4 py-3 text-end">{language === 'ar' ? 'الرصيد' : 'Balance'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-dark-600">
              {(data?.lines || []).map((line) => {
                const clickable = Boolean(line.sourceId && String(line.sourceModel || '').toLowerCase().includes('invoice'))
                return (
                  <tr
                    key={`${line.entryId}-${line.entryNumber}-${line.balance}`}
                    className={clickable ? 'cursor-pointer hover:bg-emerald-50/50 dark:hover:bg-white/[0.04]' : ''}
                    onClick={() => clickable && openSource(line)}
                  >
                    <td className="px-4 py-2.5">{line.entryDate ? new Date(line.entryDate).toLocaleDateString() : '—'}</td>
                    <td className="px-4 py-2.5 font-mono text-xs">{line.entryNumber}</td>
                    <td className="px-4 py-2.5">{line.memo || line.reference || '—'}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-500">{line.sourceNumber || line.sourceModel || '—'}</td>
                    <td className="px-4 py-2.5 text-end"><Money value={line.debit} /></td>
                    <td className="px-4 py-2.5 text-end"><Money value={line.credit} /></td>
                    <td className="px-4 py-2.5 text-end font-semibold"><Money value={line.balance} /></td>
                  </tr>
                )
              })}
              {(!data?.lines || data.lines.length === 0) && (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400">{language === 'ar' ? 'لا توجد حركات' : 'No movements in this period'}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export function CustomerAccountPanel({ language }) {
  const navigate = useNavigate()
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
  const isAr = language === 'ar'

  return (
    <div className="space-y-4">
      <ReportFilterRibbon
        language={language}
        mode="range"
        from={from}
        to={to}
        setFrom={setFrom}
        setTo={setTo}
        showComparison={false}
        showBasis={false}
        title={isAr ? 'كشف حساب العميل' : 'Customer account'}
        extra={(
          <>
            <label className="min-w-[220px] flex-1 text-xs font-medium text-slate-500">
              {isAr ? 'العميل' : 'Customer'}
              <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-dark-600 dark:bg-dark-900">
                <option value="">{isAr ? 'اختر عميلاً' : 'Select customer'}</option>
                {customers.map((c) => (
                  <option key={c._id} value={c._id}>{c.name}{c.phone ? ` · ${c.phone}` : ''}</option>
                ))}
              </select>
            </label>
            <label className="text-xs font-medium text-slate-500">
              {isAr ? 'المصدر' : 'Source'}
              <select value={mode} onChange={(e) => setMode(e.target.value)} className="mt-1 block rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-dark-600 dark:bg-dark-900">
                <option value="gl">{isAr ? 'دفتر الأستاذ (قيود)' : 'GL ledger'}</option>
                <option value="docs">{isAr ? 'مستندات' : 'Documents'}</option>
              </select>
            </label>
          </>
        )}
        exportProps={{
          getRows: async () => (data?.lines || []).map((line) => ({
            date: line.date,
            ref: line.ref || line.entryNumber || line.sourceNumber,
            memo: line.memo || line.description,
            debit: line.debit,
            credit: line.credit,
            balance: line.balance,
          })),
          columns: [
            { key: 'date', label: isAr ? 'التاريخ' : 'Date', value: (r) => r.date ? new Date(r.date).toLocaleDateString() : '' },
            { key: 'ref', label: isAr ? 'المرجع' : 'Ref' },
            { key: 'memo', label: isAr ? 'البيان' : 'Memo' },
            { key: 'debit', label: isAr ? 'مدين' : 'Debit', value: (r) => Number(r.debit || 0).toFixed(2) },
            { key: 'credit', label: isAr ? 'دائن' : 'Credit', value: (r) => Number(r.credit || 0).toFixed(2) },
            { key: 'balance', label: isAr ? 'الرصيد' : 'Balance', value: (r) => Number(r.balance || 0).toFixed(2) },
          ],
          fileBaseName: 'maqder-customer-account',
          title: isAr ? 'كشف حساب العميل' : 'Customer account',
        }}
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
              {(data?.lines || []).map((line, idx) => {
                const clickable = Boolean(line.sourceId && String(line.sourceModel || '').toLowerCase().includes('invoice'))
                return (
                <tr
                  key={`${line.ref || line.entryNumber}-${idx}`}
                  className={clickable ? 'cursor-pointer hover:bg-emerald-50/50 dark:hover:bg-white/[0.04]' : ''}
                  onClick={() => clickable && navigate(`/app/dashboard/accounting/invoices/${line.sourceId}`)}
                >
                  <td className="px-4 py-2.5">{line.date ? new Date(line.date).toLocaleDateString() : '—'}</td>
                  <td className="px-4 py-2.5 font-mono text-xs">{line.ref || line.entryNumber || line.sourceNumber || '—'}</td>
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
                )
              })}
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
  const navigate = useNavigate()
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
  const isAr = language === 'ar'

  return (
    <div className="space-y-4">
      <ReportFilterRibbon
        language={language}
        mode="range"
        from={from}
        to={to}
        setFrom={setFrom}
        setTo={setTo}
        showComparison={false}
        showBasis={false}
        title={isAr ? 'كشف حساب المورد' : 'Supplier account'}
        extra={(
          <>
            <label className="min-w-[240px] flex-1 text-xs font-medium text-slate-500">
              {isAr ? 'المورد' : 'Supplier'}
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={isAr ? 'ابحث ثم اختر…' : 'Search then select…'}
                className="mt-1 mb-2 block w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-dark-600 dark:bg-dark-900"
              />
              <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className="block w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-dark-600 dark:bg-dark-900">
                <option value="">{isAr ? 'اختر مورداً' : 'Select supplier'}</option>
                {suppliers.map((s) => (
                  <option key={s._id} value={s._id}>{partyName(s)}{s.code ? ` · ${s.code}` : ''}</option>
                ))}
              </select>
            </label>
            <label className="text-xs font-medium text-slate-500">
              {isAr ? 'المصدر' : 'Source'}
              <select value={mode} onChange={(e) => setMode(e.target.value)} className="mt-1 block rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-dark-600 dark:bg-dark-900">
                <option value="gl">{isAr ? 'دفتر الأستاذ (قيود)' : 'GL ledger'}</option>
                <option value="docs">{isAr ? 'مستندات' : 'Documents'}</option>
              </select>
            </label>
          </>
        )}
        exportProps={{
          getRows: async () => (data?.lines || []).map((line) => ({
            date: line.date,
            ref: line.ref || line.entryNumber || line.sourceNumber,
            memo: line.memo || line.description,
            debit: line.debit,
            credit: line.credit,
            balance: line.balance,
          })),
          columns: [
            { key: 'date', label: isAr ? 'التاريخ' : 'Date', value: (r) => r.date ? new Date(r.date).toLocaleDateString() : '' },
            { key: 'ref', label: isAr ? 'المرجع' : 'Ref' },
            { key: 'memo', label: isAr ? 'البيان' : 'Memo' },
            { key: 'debit', label: isAr ? 'مدين' : 'Debit', value: (r) => Number(r.debit || 0).toFixed(2) },
            { key: 'credit', label: isAr ? 'دائن' : 'Credit', value: (r) => Number(r.credit || 0).toFixed(2) },
            { key: 'balance', label: isAr ? 'الرصيد' : 'Balance', value: (r) => Number(r.balance || 0).toFixed(2) },
          ],
          fileBaseName: 'maqder-supplier-account',
          title: isAr ? 'كشف حساب المورد' : 'Supplier account',
        }}
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
              {(data?.lines || []).map((line, idx) => {
                const clickable = Boolean(line.sourceId && String(line.sourceModel || '').toLowerCase().includes('invoice'))
                return (
                <tr
                  key={`${line.ref || line.entryNumber}-${idx}`}
                  className={clickable ? 'cursor-pointer hover:bg-emerald-50/50 dark:hover:bg-white/[0.04]' : ''}
                  onClick={() => clickable && navigate(`/app/dashboard/accounting/invoices/${line.sourceId}`)}
                >
                  <td className="px-4 py-2.5">{line.date ? new Date(line.date).toLocaleDateString() : '—'}</td>
                  <td className="px-4 py-2.5 font-mono text-xs">{line.ref || line.entryNumber || line.sourceNumber || '—'}</td>
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
                )
              })}
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
    <ConfigPanelShell
      language={language}
      titleEn="Accounting defaults"
      titleAr="الإعدادات الافتراضية للمحاسبة"
      purposeEn="Default GL roles, vendor payment (SEPA/checks), and customer receipt behaviour when posting invoices and payments."
      purposeAr="أدوار الدليل الافتراضية ومدفوعات الموردين وقبض العملاء عند ترحيل الفواتير والمدفوعات."
      impactEn="Missing per-line accounts fall back to these roles; outstanding receipts/payments defer bank clearance until reconciliation."
      impactAr="تُستخدم هذه الأدوار عند غياب حساب محدد؛ المقبوضات/المدفوعات المعلقة تؤجل المقاصة البنكية."
    >
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
    </ConfigPanelShell>
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
    <ConfigPanelShell
      language={language}
      titleEn="Journal books"
      titleAr="دفاتر القيود"
      purposeEn="Numbering series and book types for sales, purchase, cash, bank, and stock journals."
      purposeAr="سلاسل الترقيم وأنواع الدفاتر للمبيعات والمشتريات والنقد والبنك والمخزون."
      impactEn="Each posted journal entry is assigned to a book; defaults drive debit/credit accounts on new entries."
      impactAr="كل قيد يُسند إلى دفتر؛ الحسابات الافتراضية تُستخدم عند إنشاء القيود."
      actions={(
        <button
          type="button"
          onClick={() => setCreating((v) => !v)}
          className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white"
        >
          {creating ? (isAr ? 'إلغاء' : 'Cancel') : (isAr ? 'دفتر جديد' : 'New book')}
        </button>
      )}
    >
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
    </ConfigPanelShell>
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
    <ConfigPanelShell
      language={language}
      titleEn="Taxes"
      titleAr="الضرائب"
      purposeEn="Link tax rates to chart accounts for VAT output and input posting."
      purposeAr="ربط نسب الضريبة بحسابات الدليل لترحيل ضريبة المخرجات والمدخلات."
      impactEn="Tax codes appear on invoices and feed tax reports, PDF groupings, and GL posting."
      impactAr="رموز الضريبة تظهر على الفواتير وتغذي تقارير الضريبة وPDF والترحيل."
      actions={(
        <div className="flex gap-2">
          <button type="button" onClick={() => ensure.mutate()} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold dark:border-dark-600">
            {ensure.isPending ? '…' : (isAr ? 'تعبئة الافتراضي' : 'Seed defaults')}
          </button>
          <button type="button" onClick={() => setCreating((v) => !v)} className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white">
            {creating ? (isAr ? 'إلغاء' : 'Cancel') : (isAr ? 'ضريبة جديدة' : 'New tax')}
          </button>
        </div>
      )}
    >

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
    </ConfigPanelShell>
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

  const autoMatch = useMutation({
    mutationFn: () => api.post('/accounting/bank-recon/auto-match', {
      accountId,
      statementId: statementId || undefined,
      minScore: 100,
    }).then((r) => r.data),
    onSuccess: (payload) => {
      toast.success(isAr
        ? `تمت مطابقة ${payload.matched} سطر`
        : `Auto-matched ${payload.matched} line(s)`)
      refetchItems()
      refetchOutstanding()
      refetchOutstandingReceipts()
      refetchLines()
    },
    onError: (e) => toast.error(e.response?.data?.error || e.message || 'Failed'),
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
        {accountId ? (
          <button
            type="button"
            disabled={autoMatch.isPending}
            onClick={() => autoMatch.mutate()}
            className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {autoMatch.isPending ? '…' : (isAr ? 'مطابقة تلقائية' : 'Auto-match')}
          </button>
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
  const navigate = useNavigate()
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

  const openLine = (line) => {
    if (line.sourceId && String(line.sourceModel || '').toLowerCase().includes('invoice')) {
      navigate(`/app/dashboard/accounting/invoices/${line.sourceId}`)
      return
    }
    if (line.entryNumber) {
      navigate(`/app/dashboard/accounting?tab=journals&q=${encodeURIComponent(line.entryNumber)}`)
    }
  }

  return (
    <div className="space-y-4">
      <ReportFilterRibbon
        language={language}
        mode="range"
        from={from}
        to={to}
        setFrom={setFrom}
        setTo={setTo}
        showComparison={false}
        showBasis={false}
        title={isAr ? 'التقرير التحليلي' : 'Analytic report'}
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
        exportProps={{
          getRows: async () => (data?.rows || []).flatMap((row) => (
            (row.lines || []).map((line) => ({
              analytic: row.analytic?.code,
              analyticName: isAr ? (row.analytic?.nameAr || row.analytic?.name) : row.analytic?.name,
              ...line,
            }))
          )),
          columns: [
            { key: 'analytic', label: isAr ? 'الرمز' : 'Code' },
            { key: 'analyticName', label: isAr ? 'التحليلي' : 'Analytic' },
            { key: 'entryNumber', label: isAr ? 'القيد' : 'Entry' },
            { key: 'accountCode', label: isAr ? 'الحساب' : 'Account' },
            { key: 'debit', label: isAr ? 'مدين' : 'Debit', value: (r) => Number(r.debit || 0).toFixed(2) },
            { key: 'credit', label: isAr ? 'دائن' : 'Credit', value: (r) => Number(r.credit || 0).toFixed(2) },
          ],
          fileBaseName: 'maqder-analytic-report',
          title: isAr ? 'التقرير التحليلي' : 'Analytic report',
        }}
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
              {(row.lines || []).map((line, idx) => {
                const clickable = Boolean(line.sourceId || line.entryNumber)
                return (
                <tr
                  key={`${line.entryNumber}-${idx}`}
                  className={clickable ? 'cursor-pointer hover:bg-emerald-50/50 dark:hover:bg-white/[0.04]' : ''}
                  onClick={() => clickable && openLine(line)}
                >
                  <td className="px-4 py-2">{line.date ? new Date(line.date).toLocaleDateString() : '—'}</td>
                  <td className="px-4 py-2 font-mono text-xs">{line.entryNumber}</td>
                  <td className="px-4 py-2">{line.accountCode} {line.description ? `· ${line.description}` : ''}</td>
                  <td className="px-4 py-2 text-end"><Money value={line.debit} /></td>
                  <td className="px-4 py-2 text-end"><Money value={line.credit} /></td>
                </tr>
                )
              })}
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

function agedRowKey(row) {
  return `${row.invoiceId}-${row.trancheSequence ?? 0}`
}

function AgedReportPanel({ language, kind }) {
  const isAr = language === 'ar'
  const navigate = useNavigate()
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

  const toggle = (rowKey) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(rowKey)) next.delete(rowKey)
      else next.add(rowKey)
      return next
    })
  }

  const selectedInvoiceIds = useMemo(() => {
    const ids = new Set()
    for (const row of data?.rows || []) {
      if (selected.has(agedRowKey(row))) ids.add(row.invoiceId)
    }
    return [...ids]
  }, [data?.rows, selected])

  const title = kind === 'ap'
    ? (isAr ? 'أعمار الذمم الدائنة' : 'Aged payables')
    : (isAr ? 'أعمار الذمم المدينة' : 'Aged receivables')

  return (
    <div className="space-y-4">
      <ReportFilterRibbon
        language={language}
        mode="asOf"
        asOf={asOf}
        setAsOf={setAsOf}
        showComparison={false}
        showBasis={false}
        title={title}
        extra={kind === 'ar' ? (
          <button
            type="button"
            disabled={!selectedInvoiceIds.length || remind.isPending}
            onClick={() => remind.mutate(selectedInvoiceIds)}
            className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            {remind.isPending
              ? '…'
              : (isAr ? `تذكير واتساب (${selectedInvoiceIds.length})` : `WhatsApp remind (${selectedInvoiceIds.length})`)}
          </button>
        ) : null}
        exportProps={{
          getRows: async () => (data?.rows || []).map((row) => ({
            partnerName: row.partnerName,
            invoiceNumber: row.invoiceNumber,
            trancheSequence: row.trancheSequence,
            dueDate: row.dueDate || row.issueDate,
            residual: row.residual,
            ageDays: row.ageDays,
            bucket: row.bucket,
          })),
          columns: [
            { key: 'partnerName', label: isAr ? 'الشريك' : 'Partner' },
            { key: 'invoiceNumber', label: isAr ? 'الفاتورة' : 'Invoice' },
            { key: 'trancheSequence', label: isAr ? 'الدفعة' : 'Tranche', value: (r) => (r.trancheSequence ? `#${r.trancheSequence}` : '—') },
            { key: 'dueDate', label: isAr ? 'الاستحقاق' : 'Due', value: (r) => r.dueDate ? new Date(r.dueDate).toLocaleDateString() : '' },
            { key: 'residual', label: isAr ? 'المتبقي' : 'Residual', value: (r) => Number(r.residual || 0).toFixed(2) },
            { key: 'ageDays', label: isAr ? 'العمر' : 'Age' },
            { key: 'bucket', label: isAr ? 'الشريحة' : 'Bucket' },
          ],
          fileBaseName: kind === 'ap' ? 'maqder-aged-ap' : 'maqder-aged-ar',
          title,
        }}
      />
      {remind.isError ? (
        <p className="text-xs text-rose-600">{remind.error?.response?.data?.error || remind.error?.message}</p>
      ) : null}
      {isFetching ? <p className="text-xs text-slate-400">…</p> : null}
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
              <th className="px-4 py-2 text-start">{isAr ? 'الدفعة' : 'Tranche'}</th>
              <th className="px-4 py-2 text-start">{isAr ? 'الاستحقاق' : 'Due'}</th>
              <th className="px-4 py-2 text-end">{isAr ? 'المتبقي' : 'Residual'}</th>
              <th className="px-4 py-2 text-end">{isAr ? 'العمر' : 'Age'}</th>
              <th className="px-4 py-2 text-start">{isAr ? 'الشريحة' : 'Bucket'}</th>
              {kind === 'ar' ? <th className="px-4 py-2 text-end">{isAr ? 'تذكير' : 'Remind'}</th> : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/5">
            {(data?.rows || []).map((row) => {
              const rowKey = agedRowKey(row)
              return (
              <tr key={rowKey}>
                {kind === 'ar' ? (
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selected.has(rowKey)}
                      onChange={() => toggle(rowKey)}
                    />
                  </td>
                ) : null}
                <td className="px-4 py-2">
                  <button
                    type="button"
                    className="text-start hover:text-emerald-700"
                    onClick={() => {
                      if (row.partnerId && kind === 'ar') {
                        navigate(`/app/dashboard/accounting/partner-ledger?customerId=${row.partnerId}`)
                      } else if (row.partnerId && kind === 'ap') {
                        navigate(`/app/dashboard/accounting/partner-ledger?supplierId=${row.partnerId}`)
                      }
                    }}
                  >
                    <p>{row.partnerName}</p>
                    {row.partnerPhone ? <p className="font-mono text-[11px] text-slate-400">{row.partnerPhone}</p> : null}
                  </button>
                </td>
                <td className="px-4 py-2">
                  <button
                    type="button"
                    className="font-mono text-xs text-emerald-800 hover:underline"
                    onClick={() => navigate(`/app/dashboard/accounting/invoices/${row.invoiceId}`)}
                  >
                    {row.invoiceNumber}
                  </button>
                </td>
                <td className="px-4 py-2 text-xs text-slate-500">
                  {row.trancheSequence ? `#${row.trancheSequence}` : '—'}
                </td>
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
              )
            })}
            {!(data?.rows || []).length && (
              <tr><td colSpan={kind === 'ar' ? 9 : 7} className="px-4 py-8 text-center text-slate-400">{isAr ? 'لا أرصدة مفتوحة' : 'No open balances'}</td></tr>
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
  const navigate = useNavigate()
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

  const toggle = (rowKey) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(rowKey)) next.delete(rowKey)
      else next.add(rowKey)
      return next
    })
  }

  const selectedInvoiceIds = useMemo(() => {
    const ids = new Set()
    for (const row of overdueRows) {
      if (selected.has(agedRowKey(row))) ids.add(row.invoiceId)
    }
    return [...ids]
  }, [overdueRows, selected])

  const nextActivityLabel = (row) => {
    const age = Number(row.ageDays || 0)
    if (age <= 0) return isAr ? 'مستحق قريباً' : 'Due soon'
    if (age === 1) return isAr ? 'متأخر يوم' : '1 day overdue'
    return isAr ? `متأخر ${age} يوم` : `${age} days overdue`
  }

  return (
    <div className="space-y-4">
      <ReportFilterRibbon
        language={language}
        mode="asOf"
        asOf={asOf}
        setAsOf={setAsOf}
        showComparison={false}
        showBasis={false}
        title={isAr ? 'تقارير المتابعة' : 'Follow-up reports'}
        extra={(
          <>
            <label className="text-xs font-medium text-slate-500">
              {isAr ? 'الحد الأدنى للتأخير (أيام)' : 'Min overdue (days)'}
              <input type="number" min={0} value={minAgeDays} onChange={(e) => setMinAgeDays(Math.max(0, Number(e.target.value) || 0))} className="mt-1 block w-24 rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-dark-600 dark:bg-dark-900" />
            </label>
            <button
              type="button"
              disabled={!selectedInvoiceIds.length || remind.isPending}
              onClick={() => remind.mutate(selectedInvoiceIds)}
              className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
            >
              {remind.isPending
                ? '…'
                : (isAr ? `تذكير واتساب (${selectedInvoiceIds.length})` : `WhatsApp remind (${selectedInvoiceIds.length})`)}
            </button>
          </>
        )}
        exportProps={{
          getRows: async () => overdueRows.map((row) => ({
            partnerName: row.partnerName,
            invoiceNumber: row.invoiceNumber,
            trancheSequence: row.trancheSequence,
            ageDays: row.ageDays,
            residual: row.residual,
          })),
          columns: [
            { key: 'partnerName', label: isAr ? 'العميل' : 'Customer' },
            { key: 'invoiceNumber', label: isAr ? 'الفاتورة' : 'Invoice' },
            { key: 'trancheSequence', label: isAr ? 'الدفعة' : 'Tranche', value: (r) => (r.trancheSequence ? `#${r.trancheSequence}` : '—') },
            { key: 'ageDays', label: isAr ? 'التأخير' : 'Age (days)' },
            { key: 'residual', label: isAr ? 'المتبقي' : 'Due', value: (r) => Number(r.residual || 0).toFixed(2) },
          ],
          fileBaseName: 'maqder-follow-up',
          title: isAr ? 'تقارير المتابعة' : 'Follow-up reports',
        }}
      />
      {isFetching ? <p className="text-xs text-slate-400">…</p> : null}

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
              <th className="px-4 py-2 text-start">{isAr ? 'الدفعة' : 'Tranche'}</th>
              <th className="px-4 py-2 text-start">{isAr ? 'النشاط التالي' : 'Next activity'}</th>
              <th className="px-4 py-2 text-start">{isAr ? 'المستوى' : 'Level'}</th>
              <th className="px-4 py-2 text-end">{isAr ? 'المتبقي' : 'Due'}</th>
              <th className="px-4 py-2 text-end">{isAr ? 'تذكير' : 'Remind'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/5">
            {overdueRows.map((row) => {
              const rowKey = agedRowKey(row)
              return (
              <tr key={rowKey}>
                <td className="px-3 py-2">
                  <input type="checkbox" checked={selected.has(rowKey)} onChange={() => toggle(rowKey)} />
                </td>
                <td className="px-4 py-2">
                  <button type="button" className="text-start hover:text-emerald-700" onClick={() => row.partnerId && navigate(`/app/dashboard/accounting/partner-ledger?customerId=${row.partnerId}`)}>
                    {row.partnerName}
                  </button>
                </td>
                <td className="px-4 py-2">
                  <button type="button" className="font-mono text-xs text-emerald-800 hover:underline" onClick={() => navigate(`/app/dashboard/accounting/invoices/${row.invoiceId}`)}>
                    {row.invoiceNumber}
                  </button>
                </td>
                <td className="px-4 py-2 text-xs text-slate-500">
                  {row.trancheSequence ? `#${row.trancheSequence}` : '—'}
                </td>
                <td className="px-4 py-2">
                  <span className="rounded-full bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                    {nextActivityLabel(row)}
                  </span>
                </td>
                <td className="px-4 py-2">
                  {row.followUpLevel ? (
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                      {isAr ? (row.followUpLevel.nameAr || row.followUpLevel.name) : row.followUpLevel.name}
                      {' · '}{row.followUpLevel.channel}
                    </span>
                  ) : '—'}
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
              )
            })}
            {!overdueRows.length && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">{isAr ? 'لا فواتير متأخرة' : 'No overdue invoices'}</td></tr>
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
  const [comparison, setComparison] = useState('none')
  const compare = useMemo(() => compareRange(from, to, comparison), [from, to, comparison])

  const { data, isFetching } = useQuery({
    queryKey: ['accounting-cash-flow', from, to],
    queryFn: () => api.get('/accounting/reports/cash-flow', { params: { from, to } }).then((r) => r.data),
  })
  const { data: prior } = useQuery({
    queryKey: ['accounting-cash-flow-prior', compare?.from, compare?.to],
    queryFn: () => api.get('/accounting/reports/cash-flow', { params: { from: compare.from, to: compare.to } }).then((r) => r.data),
    enabled: Boolean(compare),
  })
  const showVar = comparison !== 'none' && Boolean(prior)

  const Section = ({ title, section, priorSection }) => (
    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-dark-600 dark:bg-dark-800">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-white/10">
        <p className="text-sm font-semibold">{title}</p>
        <div className="flex items-center gap-3 text-sm font-semibold tabular-nums">
          <Money value={section?.net} />
          {showVar ? (
            <span className="text-xs font-medium text-slate-500">
              ({variance(section?.net, priorSection?.net).pct}%)
            </span>
          ) : null}
        </div>
      </div>
      <table className="min-w-full text-sm">
        <tbody className="divide-y divide-slate-100 dark:divide-white/5">
          {(section?.rows || []).map((row) => {
            const priorRow = (priorSection?.rows || []).find((r) => r.label === row.label)
            const v = variance(row.amount, priorRow?.amount)
            return (
              <tr key={row.label}>
                <td className="px-4 py-2">{row.label}</td>
                <td className="px-4 py-2 text-end"><Money value={row.amount} /></td>
                {showVar ? (
                  <>
                    <td className="px-3 py-2 text-end text-slate-500"><Money value={priorRow?.amount} /></td>
                    <td className={`px-3 py-2 text-end text-xs ${v.amount >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>{v.pct}%</td>
                  </>
                ) : null}
              </tr>
            )
          })}
          {!(section?.rows || []).length && (
            <tr><td className="px-4 py-6 text-center text-slate-400" colSpan={showVar ? 4 : 2}>{isAr ? 'لا حركات' : 'No activity'}</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )

  return (
    <div className="space-y-4">
      <ReportFilterRibbon
        language={language}
        mode="range"
        from={from}
        to={to}
        setFrom={setFrom}
        setTo={setTo}
        comparison={comparison}
        setComparison={setComparison}
        showBasis={false}
        title={isAr ? 'قائمة التدفقات النقدية' : 'Cash flow statement'}
        exportProps={{
          getRows: async () => {
            const rows = []
            for (const [key, label] of [
              ['operating', 'Operating'],
              ['investing', 'Investing'],
              ['financing', 'Financing'],
            ]) {
              for (const r of data?.[key]?.rows || []) {
                rows.push({ section: label, label: r.label, amount: r.amount })
              }
            }
            return rows
          },
          columns: [
            { key: 'section', label: isAr ? 'القسم' : 'Section' },
            { key: 'label', label: isAr ? 'البند' : 'Line' },
            { key: 'amount', label: isAr ? 'المبلغ' : 'Amount', value: (r) => Number(r.amount || 0).toFixed(2) },
          ],
          fileBaseName: 'maqder-cash-flow',
          title: isAr ? 'التدفقات النقدية' : 'Cash flow',
        }}
      />
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
      <Section title={isAr ? 'تشغيلي' : 'Operating'} section={data?.operating} priorSection={prior?.operating} />
      <Section title={isAr ? 'استثماري' : 'Investing'} section={data?.investing} priorSection={prior?.investing} />
      <Section title={isAr ? 'تمويلي' : 'Financing'} section={data?.financing} priorSection={prior?.financing} />
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
      <CustomReportLinesSection language={language} lines={data?.customReportLines} />
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
  const navigate = useNavigate()
  const [from, setFrom] = useState(yearStartIso())
  const [to, setTo] = useState(todayIso())
  const [taxUnit, setTaxUnit] = useState('')
  const [comparison, setComparison] = useState('none')
  const [expandedTaxId, setExpandedTaxId] = useState(null)
  const compareParams = compareRange(from, to, comparison)
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
  const { data: priorTax } = useQuery({
    queryKey: ['accounting-tax-report-prior', compareParams?.from, compareParams?.to, taxUnit],
    queryFn: () => api.get('/accounting/reports/tax', {
      params: { from: compareParams.from, to: compareParams.to, taxUnit: taxUnit || undefined },
    }).then((r) => r.data),
    enabled: Boolean(compareParams),
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
  const showVar = comparison !== 'none' && priorTax
  const netVar = showVar ? variance(glTax?.netVatDue, priorTax?.netVatDue) : null
  const taxRowById = useMemo(
    () => Object.fromEntries((glTax?.rows || []).map((r) => [String(r.taxId), r])),
    [glTax?.rows],
  )

  const openTaxLine = (line) => {
    if (line.sourceId && String(line.sourceModel || '').toLowerCase().includes('invoice')) {
      navigate(`/app/dashboard/accounting/invoices/${line.sourceId}`)
      return
    }
    if (line.entryNumber) {
      navigate(`/app/dashboard/accounting?tab=journals&q=${encodeURIComponent(line.entryNumber)}`)
    }
  }

  const renderTaxLines = (taxId, variant = 'grid') => {
    const lines = taxRowById[String(taxId)]?.lines || []
    const emptyColSpan = variant === 'summary' ? 5 : (showVar ? 5 : 4)
    if (!lines.length) {
      return (
        <tr>
          <td colSpan={emptyColSpan} className="bg-slate-50/80 px-4 py-4 text-center text-xs text-slate-400 dark:bg-dark-900/50">
            {isAr ? 'لا خطوط دفتر لهذا الرمز' : 'No GL lines for this tax code'}
          </td>
        </tr>
      )
    }
    return lines.map((line, idx) => (
      <tr
        key={`${line.entryNumber}-${idx}`}
        className="cursor-pointer bg-slate-50/80 hover:bg-emerald-50/40 dark:bg-dark-900/50"
        onClick={() => openTaxLine(line)}
      >
        <td colSpan={2} className="px-4 py-2 ps-8 text-xs text-slate-500">
          {line.date ? new Date(line.date).toLocaleDateString() : '—'} · {line.entryNumber} · {line.accountCode}
          {line.description ? ` · ${line.description}` : ''}
        </td>
        <td className="px-4 py-2 text-end text-xs"><Money value={line.debit} /></td>
        <td className="px-4 py-2 text-end text-xs"><Money value={line.credit} /></td>
        {variant === 'summary' ? <td /> : (showVar ? <td /> : null)}
      </tr>
    ))
  }

  const renderTaxGrid = (title, rows, priorRows) => (
    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-dark-600 dark:bg-dark-800">
      <div className="border-b border-slate-100 px-4 py-3 dark:border-white/10">
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-[11px] text-slate-400">{isAr ? 'انقر صفاً لعرض خطوط الدفتر' : 'Click a row to drill into GL lines'}</p>
      </div>
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-400 dark:bg-dark-900">
          <tr>
            <th className="px-4 py-2 text-start">{isAr ? 'الرمز' : 'Code'}</th>
            <th className="px-4 py-2 text-start">{isAr ? 'الاسم' : 'Name'}</th>
            <th className="px-4 py-2 text-end">{isAr ? 'الأساس' : 'Base'}</th>
            <th className="px-4 py-2 text-end">{isAr ? 'الضريبة' : 'Tax'}</th>
            {showVar ? <th className="px-4 py-2 text-end">{isAr ? 'سابق' : 'Prior'}</th> : null}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-white/5">
          {(rows || []).map((row) => {
            const priorRow = (priorRows || []).find((r) => r.code === row.code)
            const taxId = String(row.taxId || '')
            const expanded = expandedTaxId === taxId
            return (
              <Fragment key={row.code}>
                <tr
                  className={`cursor-pointer ${expanded ? 'bg-emerald-50/50 dark:bg-emerald-950/20' : 'hover:bg-emerald-50/30 dark:hover:bg-white/[0.03]'}`}
                  onClick={() => setExpandedTaxId(expanded ? null : taxId)}
                >
                  <td className="px-4 py-2 font-mono text-xs">{row.code}</td>
                  <td className="px-4 py-2">{isAr ? (row.nameAr || row.name) : row.name}{row.rate != null ? ` (${row.rate}%)` : ''}</td>
                  <td className="px-4 py-2 text-end"><Money value={row.baseAmount} /></td>
                  <td className="px-4 py-2 text-end"><Money value={row.taxAmount} /></td>
                  {showVar ? (
                    <td className="px-4 py-2 text-end text-slate-500"><Money value={priorRow?.taxAmount} /></td>
                  ) : null}
                </tr>
                {expanded ? renderTaxLines(taxId) : null}
              </Fragment>
            )
          })}
          {!(rows || []).length ? (
            <tr><td colSpan={showVar ? 5 : 4} className="px-4 py-8 text-center text-slate-400">{isAr ? 'لا بيانات' : 'No data'}</td></tr>
          ) : null}
        </tbody>
      </table>
    </div>
  )

  return (
    <div className="space-y-4">
      <ReportFilterRibbon
        language={language}
        mode="range"
        from={from}
        to={to}
        setFrom={setFrom}
        setTo={setTo}
        comparison={comparison}
        setComparison={setComparison}
        showBasis={false}
        title={isAr ? 'تقرير الضريبة' : 'Tax report'}
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
        exportProps={{
          getRows: async () => [
            ...(glTax?.outputGrid || []).map((r) => ({ section: isAr ? 'مخرجات' : 'Output', ...r })),
            ...(glTax?.inputGrid || []).map((r) => ({ section: isAr ? 'مدخلات' : 'Input', ...r })),
          ],
          columns: [
            { key: 'section', label: isAr ? 'القسم' : 'Section' },
            { key: 'code', label: isAr ? 'الرمز' : 'Code' },
            { key: 'name', label: isAr ? 'الاسم' : 'Name' },
            { key: 'baseAmount', label: isAr ? 'الأساس' : 'Base', value: (r) => Number(r.baseAmount || 0).toFixed(2) },
            { key: 'taxAmount', label: isAr ? 'الضريبة' : 'Tax', value: (r) => Number(r.taxAmount || 0).toFixed(2) },
          ],
          fileBaseName: 'maqder-tax-report',
          title: isAr ? 'تقرير الضريبة' : 'Tax report',
        }}
      />
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-dark-600 dark:bg-dark-800">
        <div>
          <p className="text-xs text-slate-500">
            {isAr
              ? 'ملخص خطوط الضريبة في الدفتر + شبكة مخرجات/مدخلات + رابط إقرار القيمة المضافة.'
              : 'GL tax summary, output/input grids, and VAT return link.'}
          </p>
        </div>
        <a
          href="/app/dashboard/vat-returns"
          className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold dark:border-dark-600"
        >
          {isAr ? 'إقرار ضريبة القيمة المضافة' : 'Full VAT return'}
        </a>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          [isAr ? 'ضريبة المخرجات' : 'Output VAT', glTax?.outputTax],
          [isAr ? 'ضريبة المدخلات' : 'Input VAT', glTax?.inputTax],
          [isAr ? 'صافي الضريبة المستحقة' : 'Net VAT due', glTax?.netVatDue],
          [isAr ? 'صافي الدفتر' : 'GL net', glTax?.net],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-dark-600 dark:bg-dark-800">
            <p className="text-[11px] uppercase tracking-widest text-slate-400">{label}</p>
            <p className="mt-1 text-lg font-semibold"><Money value={value} /></p>
            {showVar && label === (isAr ? 'صافي الضريبة المستحقة' : 'Net VAT due') && netVar ? (
              <p className={`mt-1 text-xs ${netVar.amount >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                {netVar.pct}% {isAr ? 'مقارنة بالفترة السابقة' : 'vs prior period'}
              </p>
            ) : null}
          </div>
        ))}
      </div>

      {!vatError && statement ? (
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            [isAr ? 'المبيعات الخاضعة' : 'Taxable sales', statement.standardRatedSales ?? statement.taxableAmount],
            [isAr ? 'ضريبة المخرجات (إقرار)' : 'Output VAT (return)', statement.vatOnSales ?? statement.totalTax ?? statement.outputVat],
            [isAr ? 'صافي الضريبة (إقرار)' : 'Net VAT (return)', statement.netVatPayable ?? statement.netVat],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-emerald-200/60 bg-emerald-50/40 p-4 dark:border-emerald-800 dark:bg-emerald-950/20">
              <p className="text-[11px] uppercase tracking-widest text-emerald-700/70">{label}</p>
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

      {(glTax?.taxGroupsRollup || []).length ? (
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-dark-600 dark:bg-dark-800">
          <div className="border-b border-slate-100 px-4 py-3 dark:border-white/10">
            <p className="text-sm font-semibold">{isAr ? 'مجموعات الضريبة (إعدادات)' : 'Tax groups (configuration)'}</p>
          </div>
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-400 dark:bg-dark-900">
              <tr>
                <th className="px-4 py-2 text-start">{isAr ? 'المجموعة' : 'Group'}</th>
                <th className="px-4 py-2 text-end">{isAr ? 'مدين' : 'Debit'}</th>
                <th className="px-4 py-2 text-end">{isAr ? 'دائن' : 'Credit'}</th>
                <th className="px-4 py-2 text-end">{isAr ? 'صافي' : 'Net'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {glTax.taxGroupsRollup.map((group) => (
                <tr key={group.code}>
                  <td className="px-4 py-2">
                    <span className="font-mono text-[10px] text-slate-400">{group.code}</span>
                    {' · '}
                    {isAr ? (group.nameAr || group.name) : group.name}
                  </td>
                  <td className="px-4 py-2 text-end"><Money value={group.debit} /></td>
                  <td className="px-4 py-2 text-end"><Money value={group.credit} /></td>
                  <td className="px-4 py-2 text-end font-semibold"><Money value={group.net} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {renderTaxGrid(isAr ? 'شبكة المخرجات (ZATCA)' : 'Output grid (ZATCA)', glTax?.outputGrid, priorTax?.outputGrid)}
        {renderTaxGrid(isAr ? 'شبكة المدخلات (ZATCA)' : 'Input grid (ZATCA)', glTax?.inputGrid, priorTax?.inputGrid)}
      </div>

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
            {(glTax?.rows || []).map((row) => {
              const taxId = String(row.taxId || '')
              const expanded = expandedTaxId === taxId
              return (
                <Fragment key={row.taxId || row.code}>
                  <tr
                    className={`cursor-pointer ${expanded ? 'bg-emerald-50/50 dark:bg-emerald-950/20' : 'hover:bg-emerald-50/30 dark:hover:bg-white/[0.03]'}`}
                    onClick={() => setExpandedTaxId(expanded ? null : taxId)}
                  >
                    <td className="px-4 py-2 font-mono text-xs">{row.code}</td>
                    <td className="px-4 py-2">{isAr ? (row.nameAr || row.name) : row.name}{row.rate != null ? ` (${row.rate}%)` : ''}</td>
                    <td className="px-4 py-2 text-end"><Money value={row.debit} /></td>
                    <td className="px-4 py-2 text-end"><Money value={row.credit} /></td>
                    <td className="px-4 py-2 text-end"><Money value={row.net} /></td>
                  </tr>
                  {expanded ? renderTaxLines(taxId, 'summary') : null}
                </Fragment>
              )
            })}
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
  const navigate = useNavigate()
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
    queryKey: ['accounting-bs-exec', to],
    queryFn: () => api.get('/accounting/reports/balance-sheet', { params: { asOf: to } }).then((r) => r.data),
  })

  const revenue = Number(pnl?.totalRevenue) || 0
  const expenses = Number(pnl?.totalExpenses) || 0
  const net = Number(pnl?.netIncome) || 0
  const gross = Number(pnl?.grossProfit) || (revenue - (Number(pnl?.totalCogs) || 0))
  const cash = Number(dash?.cashBalance) || 0
  const ar = Number(dash?.arBalance) || 0
  const ap = Number(dash?.apBalance) || 0
  const currentAssets = Number(bs?.totalAssets) || 0
  const currentLiab = Number(bs?.totalLiabilities) || 0
  const days = Math.max(1, (new Date(to) - new Date(from)) / 86400000)
  const dso = revenue > 0 ? Math.round((ar / revenue) * days) : 0
  const kpis = [
    [isAr ? 'عائد النقد' : 'Cash return', revenue > 0 ? `${((cash / revenue) * 100).toFixed(1)}%` : '—'],
    [isAr ? 'هامش مجمل الربح' : 'Gross profit margin', revenue > 0 ? `${((gross / revenue) * 100).toFixed(1)}%` : '—'],
    [isAr ? 'هامش صافي الربح' : 'Net profit margin', revenue > 0 ? `${((net / revenue) * 100).toFixed(1)}%` : '—'],
    [isAr ? 'نسبة التداول' : 'Current ratio', currentLiab > 0 ? (currentAssets / currentLiab).toFixed(2) : '—'],
    [isAr ? 'أيام التحصيل (DSO)' : 'Days sales outstanding', String(dso)],
  ]

  const cards = [
    [isAr ? 'صافي الدخل' : 'Net income', net],
    [isAr ? 'الإيرادات' : 'Revenue', revenue],
    [isAr ? 'المصروفات' : 'Expenses', expenses],
    [isAr ? 'نقد + بنك' : 'Cash + bank', cash],
    [isAr ? 'المدينون' : 'Receivables', ar],
    [isAr ? 'الدائنون' : 'Payables', ap],
  ]

  return (
    <div className="space-y-4">
      <ReportFilterRibbon
        language={language}
        mode="range"
        from={from}
        to={to}
        setFrom={setFrom}
        setTo={setTo}
        showComparison={false}
        showBasis={false}
        title={isAr ? 'الملخص التنفيذي' : 'Executive summary'}
        exportProps={{
          getRows: async () => [
            ...cards.map(([label, value]) => ({ metric: label, value: Number(value || 0).toFixed(2) })),
            ...kpis.map(([label, value]) => ({ metric: label, value: String(value) })),
          ],
          columns: [
            { key: 'metric', label: isAr ? 'المؤشر' : 'Metric' },
            { key: 'value', label: isAr ? 'القيمة' : 'Value' },
          ],
          fileBaseName: 'maqder-executive-summary',
          title: isAr ? 'الملخص التنفيذي' : 'Executive summary',
        }}
      />
      {dashLoading ? <p className="text-xs text-slate-400">{isAr ? 'جاري التحميل…' : 'Loading…'}</p> : null}
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {kpis.map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-emerald-200/60 bg-emerald-50/40 p-4 dark:border-emerald-800 dark:bg-emerald-950/20">
            <p className="text-[11px] uppercase tracking-widest text-emerald-700/70">{label}</p>
            <p className="mt-1 text-lg font-semibold">{value}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {cards.map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-dark-600 dark:bg-dark-800">
            <p className="text-[11px] uppercase tracking-widest text-slate-400">{label}</p>
            <p className="mt-1 text-lg font-semibold"><Money value={value} /></p>
          </div>
        ))}
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <button
          type="button"
          onClick={() => navigate('/app/dashboard/accounting/pnl')}
          className="rounded-2xl border border-slate-200/80 bg-white p-4 text-start dark:border-dark-600 dark:bg-dark-800"
        >
          <p className="text-sm font-semibold">{isAr ? 'الأرباح والخسائر (الفترة)' : 'P&L (period)'}</p>
          <div className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between"><span>{isAr ? 'الإيرادات' : 'Revenue'}</span><Money value={pnl?.totalRevenue} /></div>
            <div className="flex justify-between"><span>{isAr ? 'المصروفات' : 'Expenses'}</span><Money value={pnl?.totalExpenses} /></div>
            <div className="flex justify-between border-t border-slate-100 pt-2 font-semibold dark:border-white/10"><span>{isAr ? 'صافي' : 'Net'}</span><Money value={pnl?.netIncome} /></div>
          </div>
        </button>
        <button
          type="button"
          onClick={() => navigate('/app/dashboard/accounting/balance-sheet')}
          className="rounded-2xl border border-slate-200/80 bg-white p-4 text-start dark:border-dark-600 dark:bg-dark-800"
        >
          <p className="text-sm font-semibold">{isAr ? 'الميزانية (ملخص)' : 'Balance sheet (summary)'}</p>
          <div className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between"><span>{isAr ? 'الأصول' : 'Assets'}</span><Money value={bs?.totalAssets} /></div>
            <div className="flex justify-between"><span>{isAr ? 'الخصوم' : 'Liabilities'}</span><Money value={bs?.totalLiabilities} /></div>
            <div className="flex justify-between"><span>{isAr ? 'حقوق الملكية' : 'Equity'}</span><Money value={bs?.totalEquity} /></div>
          </div>
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => navigate('/app/dashboard/accounting/aged-ar')}
          className="rounded-2xl border border-slate-200/80 bg-white p-4 text-start dark:border-dark-600 dark:bg-dark-800"
        >
          <p className="text-sm font-semibold">{isAr ? 'أعمار المدينين' : 'Aged receivables'}</p>
          <p className="mt-1 text-xs text-slate-500">{isAr ? 'فواتير مفتوحة' : 'Open invoices'}: {dash?.agedAr?.openCount ?? 0}</p>
          <p className="mt-2 text-lg font-semibold"><Money value={dash?.agedAr?.buckets?.total} /></p>
        </button>
        <button
          type="button"
          onClick={() => navigate('/app/dashboard/accounting/aged-ap')}
          className="rounded-2xl border border-slate-200/80 bg-white p-4 text-start dark:border-dark-600 dark:bg-dark-800"
        >
          <p className="text-sm font-semibold">{isAr ? 'أعمار الدائنين' : 'Aged payables'}</p>
          <p className="mt-1 text-xs text-slate-500">{isAr ? 'فواتير مفتوحة' : 'Open bills'}: {dash?.agedAp?.openCount ?? 0}</p>
          <p className="mt-2 text-lg font-semibold"><Money value={dash?.agedAp?.buckets?.total} /></p>
        </button>
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
    <ConfigPanelShell
      language={language}
      titleEn="Fiscal positions"
      titleAr="المراكز الضريبية"
      purposeEn="Tax context labels applied on sales invoices (Other info tab) for reporting and analytic matching."
      purposeAr="سياق ضريبي يُطبّق على فواتير المبيعات (تبويب معلومات أخرى) للتقارير والتوزيع التحليلي."
      impactEn="Partner tag on analytic distribution models can match fiscal position codes."
      impactAr="وسم الشريك في نماذج التوزيع التحليلي قد يطابق رموز المراكز الضريبية."
      actions={(
        <>
          <button type="button" onClick={addRow} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold dark:border-dark-600">{isAr ? 'إضافة' : 'Add'}</button>
          <button type="button" disabled={save.isPending || isFetching} onClick={() => save.mutate()} className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{save.isPending ? '…' : (isAr ? 'حفظ' : 'Save')}</button>
        </>
      )}
    >
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
    </ConfigPanelShell>
  )
}

export function InvoiceAnalysisPanel({ language }) {
  const isAr = language === 'ar'
  const navigate = useNavigate()
  const [from, setFrom] = useState(yearStartIso())
  const [to, setTo] = useState(todayIso())
  const [flow, setFlow] = useState('all')
  const [groupBy, setGroupBy] = useState('month')
  const { data, isFetching } = useQuery({
    queryKey: ['accounting-invoice-analysis', from, to, flow, groupBy],
    queryFn: () => api.get('/accounting/reports/invoice-analysis', {
      params: { from, to, flow: flow === 'all' ? undefined : flow, groupBy },
    }).then((r) => r.data),
  })
  const s = data?.summary || {}
  const chartMax = Math.max(1, ...(data?.chartSeries || []).map((c) => Number(c.value) || 0))
  const groupLabels = {
    month: isAr ? 'الشهر' : 'Month',
    partner: isAr ? 'الشريك' : 'Partner',
    product: isAr ? 'المنتج' : 'Product',
    payment: isAr ? 'حالة الدفع' : 'Payment status',
    salesperson: isAr ? 'مندوب المبيعات' : 'Salesperson',
    flow: isAr ? 'نوع الفاتورة' : 'Invoice flow',
  }

  return (
    <div className="space-y-4">
      <ReportFilterRibbon
        language={language}
        mode="range"
        from={from}
        to={to}
        setFrom={setFrom}
        setTo={setTo}
        showComparison={false}
        showBasis={false}
        title={isAr ? 'تحليل الفواتير' : 'Invoice analysis'}
        extra={(
          <>
            <label className="text-xs font-medium text-slate-500">
              {isAr ? 'النوع' : 'Flow'}
              <select value={flow} onChange={(e) => setFlow(e.target.value)} className="mt-1 block rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-dark-600 dark:bg-dark-900">
                <option value="all">{isAr ? 'الكل' : 'All'}</option>
                <option value="sell">{isAr ? 'مبيعات' : 'Sales'}</option>
                <option value="purchase">{isAr ? 'مشتريات' : 'Purchases'}</option>
              </select>
            </label>
            <label className="text-xs font-medium text-slate-500">
              {isAr ? 'تجميع حسب' : 'Group by'}
              <select value={groupBy} onChange={(e) => setGroupBy(e.target.value)} className="mt-1 block rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-dark-600 dark:bg-dark-900">
                {Object.entries(groupLabels).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </label>
          </>
        )}
        exportProps={{
          getRows: async () => [
            ...(data?.pivotRows || []).map((r) => ({ section: isAr ? 'تجميع' : 'Pivot', ...r })),
            ...(data?.recentInvoices || []).map((r) => ({ section: isAr ? 'فواتير' : 'Invoices', ...r })),
          ],
          columns: [
            { key: 'section', label: isAr ? 'القسم' : 'Section' },
            { key: 'label', label: isAr ? 'البند' : 'Label' },
            { key: 'count', label: isAr ? 'العدد' : 'Count' },
            { key: 'total', label: isAr ? 'الإجمالي' : 'Total', value: (r) => Number(r.total || r.grandTotal || 0).toFixed(2) },
            { key: 'taxTotal', label: isAr ? 'الضريبة' : 'Tax', value: (r) => Number(r.taxTotal || 0).toFixed(2) },
          ],
          fileBaseName: 'maqder-invoice-analysis',
          title: isAr ? 'تحليل الفواتير' : 'Invoice analysis',
        }}
      />
      {isFetching ? <p className="text-xs text-slate-400">…</p> : null}
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-dark-600 dark:bg-dark-800">
        <div className="border-b border-slate-100 px-4 py-3 dark:border-white/10">
          <p className="text-sm font-semibold">{isAr ? 'جدول محوري' : 'Pivot table'} · {groupLabels[groupBy] || groupBy}</p>
        </div>
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-[11px] uppercase text-slate-400 dark:bg-dark-900">
            <tr>
              <th className="px-4 py-2 text-start">{groupLabels[groupBy] || (isAr ? 'البند' : 'Label')}</th>
              <th className="px-4 py-2 text-end">{isAr ? 'عدد' : 'Count'}</th>
              {groupBy === 'product' ? <th className="px-4 py-2 text-end">{isAr ? 'الكمية' : 'Qty'}</th> : null}
              <th className="px-4 py-2 text-end">{isAr ? 'الإجمالي' : 'Total'}</th>
              {groupBy !== 'product' ? <th className="px-4 py-2 text-end">{isAr ? 'الضريبة' : 'Tax'}</th> : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/5">
            {(data?.pivotRows || []).map((row) => (
              <tr key={row.key}>
                <td className="px-4 py-2">{row.label}</td>
                <td className="px-4 py-2 text-end tabular-nums">{row.count}</td>
                {groupBy === 'product' ? <td className="px-4 py-2 text-end tabular-nums">{row.qty}</td> : null}
                <td className="px-4 py-2 text-end"><Money value={row.total} /></td>
                {groupBy !== 'product' ? <td className="px-4 py-2 text-end"><Money value={row.taxTotal} /></td> : null}
              </tr>
            ))}
            {!(data?.pivotRows || []).length && (
              <tr><td colSpan={groupBy === 'product' ? 4 : 4} className="px-4 py-8 text-center text-slate-400">{isAr ? 'لا بيانات' : 'No data'}</td></tr>
            )}
          </tbody>
        </table>
      </div>
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
      {(data?.chartSeries || []).length ? (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-dark-600 dark:bg-dark-800">
          <p className="mb-4 text-sm font-semibold">{isAr ? 'اتجاه الفواتير (شهري)' : 'Invoice trend (monthly)'}</p>
          <div className="flex items-end gap-2 overflow-x-auto pb-2">
            {(data?.chartSeries || []).map((row) => (
              <div key={row.label} className="flex min-w-[3rem] flex-1 flex-col items-center gap-1">
                <div
                  className="w-full rounded-t-md bg-emerald-600/80 dark:bg-emerald-500/70"
                  style={{ height: `${Math.max(8, (Number(row.value) / chartMax) * 120)}px` }}
                  title={`${row.label}: ${row.value}`}
                />
                <span className="text-[10px] font-mono text-slate-400">{String(row.label).slice(5)}</span>
                <span className="text-[10px] text-slate-500">{row.count}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
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
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-dark-600 dark:bg-dark-800">
        <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold dark:border-white/10">{isAr ? 'أحدث الفواتير' : 'Recent invoices'}</div>
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-[11px] uppercase text-slate-400 dark:bg-dark-900">
            <tr>
              <th className="px-4 py-2 text-start">{isAr ? 'التاريخ' : 'Date'}</th>
              <th className="px-4 py-2 text-start">{isAr ? 'الفاتورة' : 'Invoice'}</th>
              <th className="px-4 py-2 text-start">{isAr ? 'الشريك' : 'Partner'}</th>
              <th className="px-4 py-2 text-end">{isAr ? 'الإجمالي' : 'Total'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/5">
            {(data?.recentInvoices || []).map((row) => (
              <tr
                key={row.invoiceId}
                className="cursor-pointer hover:bg-emerald-50/50 dark:hover:bg-white/[0.04]"
                onClick={() => navigate(`/app/dashboard/accounting/invoices/${row.invoiceId}`)}
              >
                <td className="px-4 py-2">{row.issueDate ? new Date(row.issueDate).toLocaleDateString() : '—'}</td>
                <td className="px-4 py-2 font-mono text-xs">{row.invoiceNumber || '—'}</td>
                <td className="px-4 py-2">{row.partnerName || '—'}</td>
                <td className="px-4 py-2 text-end"><Money value={row.grandTotal} /></td>
              </tr>
            ))}
            {!(data?.recentInvoices || []).length && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">{isAr ? 'لا فواتير' : 'No invoices'}</td></tr>
            )}
          </tbody>
        </table>
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
    <ConfigPanelShell
      language={language}
      titleEn="Payment terms"
      titleAr="شروط الدفع"
      purposeEn="Commercial due-date rules applied when an invoice is dated — including staggered tranches and early-payment discounts."
      purposeAr="قواعد استحقاق الفواتير عند التاريخ — تشمل الدفعات المتعددة وخصومات الدفع المبكر."
      impactEn="Backend computes dueDate, paymentSchedule tranches, and earlyPaymentDiscount on save; receivables aging uses the final due date."
      impactAr="يحسب النظام تاريخ الاستحقاق وجدول الدفعات وخصم الدفع المبكر عند الحفظ؛ أعمار المدينين تستخدم آخر تاريخ."
      actions={(
        <button type="button" disabled={save.isPending || isFetching} onClick={() => save.mutate()} className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {save.isPending ? '…' : (isAr ? 'حفظ' : 'Save')}
        </button>
      )}
    >
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-dark-600 dark:bg-dark-800">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-[11px] uppercase text-slate-400 dark:bg-dark-900">
            <tr>
              <th className="px-4 py-2 text-start">{isAr ? 'مفعّل' : 'On'}</th>
              <th className="px-4 py-2 text-start">{isAr ? 'الاسم' : 'Name'}</th>
              <th className="px-4 py-2 text-start">{isAr ? 'المحرك' : 'Engine'}</th>
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
                <td className="px-4 py-2 font-mono text-[11px] text-slate-500">
                  {isAr ? (term.scheduleSummaryAr || term.kind) : (term.scheduleSummaryEn || term.kind)}
                </td>
                <td className="px-4 py-2 text-center">
                  <input type="radio" name="payment-term-default" checked={defaultId === term.id} onChange={() => setDefaultId(term.id)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ConfigPanelShell>
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
    <ConfigPanelShell
      language={language}
      titleEn="Incoterms"
      titleAr="شروط التجارة الدولية"
      purposeEn="International commercial terms (EXW, FOB, CIF…) printed on invoices to define freight and risk transfer."
      purposeAr="شروط التجارة الدولية المطبوعة على الفواتير لتحديد مسؤولية الشحن والنقل."
      impactEn="Selected incoterm is stored on customer/vendor documents and appears on PDF invoices."
      impactAr="يُخزَّن المصطلح المختار على مستندات البيع/الشراء ويظهر في PDF الفاتورة."
      actions={(
        <button type="button" disabled={save.isPending || isFetching} onClick={() => save.mutate()} className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {save.isPending ? '…' : (isAr ? 'حفظ' : 'Save')}
        </button>
      )}
    >
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
    </ConfigPanelShell>
  )
}

export function BankAccountsPanel({ language }) {
  const isAr = language === 'ar'
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [showWizard, setShowWizard] = useState(false)
  const [form, setForm] = useState({ name: '', nameAr: '', code: '', iban: '', bic: '' })
  const { data, isFetching, refetch } = useQuery({
    queryKey: ['accounting-bank-accounts-catalog'],
    queryFn: () => api.get('/accounting/bank-accounts').then((r) => r.data),
  })
  const rows = data?.rows || []

  const createBank = useMutation({
    mutationFn: () => api.post('/accounting/bank-accounts/setup', {
      name: form.name,
      nameAr: form.nameAr || undefined,
      code: form.code || undefined,
      iban: form.iban,
      bic: form.bic,
    }).then((r) => r.data),
    onSuccess: () => {
      toast.success(isAr ? 'تم إنشاء حساب البنك والدفتر' : 'Bank account and journal created')
      setShowWizard(false)
      setForm({ name: '', nameAr: '', code: '', iban: '', bic: '' })
      refetch()
      queryClient.invalidateQueries({ queryKey: ['accounting-accounts'] })
      queryClient.invalidateQueries({ queryKey: ['accounting-journal-books'] })
    },
    onError: (e) => toast.error(e.response?.data?.error || 'Failed'),
  })

  return (
    <ConfigPanelShell
      language={language}
      titleEn="Bank accounts"
      titleAr="الحسابات البنكية"
      purposeEn="Link liquidity ledgers (CoA) to bank journals and IBAN metadata for reconciliation and SEPA."
      purposeAr="ربط حسابات السيولة بدفاتر البنوك وبيانات IBAN للتسوية وSEPA."
      impactEn="Creates account.journal (type Bank) + account.account (Bank and Cash). Feeds bank reconciliation and payment provider settlement."
      impactAr="ينشئ دفتر بنك + حساب نقد/بنك. يغذي التسوية البنكية وتسوية بوابات الدفع."
      actions={(
        <>
          <button type="button" onClick={() => setShowWizard((v) => !v)} className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white">
            {showWizard ? (isAr ? 'إلغاء' : 'Cancel') : (isAr ? 'إضافة حساب بنك' : 'Add bank account')}
          </button>
          <button type="button" onClick={() => navigate('/app/dashboard/accounting/bank-recon')} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold dark:border-dark-600">
            {isAr ? 'التسوية البنكية' : 'Bank reconciliation'}
          </button>
        </>
      )}
    >
      {showWizard ? (
        <div className="grid gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 sm:grid-cols-2 dark:border-dark-600 dark:bg-dark-800">
          {[
            ['name', isAr ? 'اسم الحساب' : 'Account name', form.name, (v) => setForm((p) => ({ ...p, name: v }))],
            ['nameAr', isAr ? 'الاسم (عربي)' : 'Name (Arabic)', form.nameAr, (v) => setForm((p) => ({ ...p, nameAr: v }))],
            ['code', isAr ? 'رمز الدليل (اختياري)' : 'CoA code (optional)', form.code, (v) => setForm((p) => ({ ...p, code: v }))],
            ['iban', 'IBAN', form.iban, (v) => setForm((p) => ({ ...p, iban: v }))],
            ['bic', 'BIC / SWIFT', form.bic, (v) => setForm((p) => ({ ...p, bic: v }))],
          ].map(([key, label, value, onChange]) => (
            <label key={key} className="text-xs font-medium text-slate-500">
              {label}
              <input value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-mono dark:border-dark-600 dark:bg-dark-900" />
            </label>
          ))}
          <div className="sm:col-span-2">
            <button type="button" disabled={!form.name || createBank.isPending} onClick={() => createBank.mutate()} className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              {createBank.isPending ? '…' : (isAr ? 'إنشاء حساب + دفتر' : 'Create account + journal')}
            </button>
          </div>
        </div>
      ) : null}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-dark-600 dark:bg-dark-800">
        <p className="text-sm font-semibold">{isAr ? 'مدين SEPA (الشركة)' : 'SEPA debtor (company)'}</p>
        <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
          <div><span className="text-slate-400">{isAr ? 'الاسم' : 'Name'}</span><p className="font-medium">{data?.sepa?.debtorName || '—'}</p></div>
          <div><span className="text-slate-400">IBAN</span><p className="font-mono text-xs">{data?.sepa?.debtorIban || '—'}</p></div>
          <div><span className="text-slate-400">BIC</span><p className="font-mono text-xs">{data?.sepa?.debtorBic || '—'}</p></div>
        </div>
      </div>
      {isFetching ? <p className="text-xs text-slate-400">…</p> : null}
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-dark-600 dark:bg-dark-800">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-[11px] uppercase text-slate-400 dark:bg-dark-900">
            <tr>
              <th className="px-4 py-2 text-start">{isAr ? 'الرمز' : 'Code'}</th>
              <th className="px-4 py-2 text-start">{isAr ? 'الاسم' : 'Name'}</th>
              <th className="px-4 py-2 text-start">{isAr ? 'الدفتر' : 'Journal'}</th>
              <th className="px-4 py-2 text-start">IBAN</th>
              <th className="px-4 py-2 text-end">{isAr ? 'الرصيد' : 'Balance'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/5">
            {rows.map((a) => (
              <tr key={a.accountId}>
                <td className="px-4 py-2 font-mono text-xs">{a.code}</td>
                <td className="px-4 py-2">{isAr ? (a.nameAr || a.name) : a.name}</td>
                <td className="px-4 py-2 font-mono text-xs">{a.journalCode || '—'}</td>
                <td className="px-4 py-2 font-mono text-[11px] text-slate-500">{a.iban || '—'}</td>
                <td className="px-4 py-2 text-end"><Money value={a.balance} /></td>
              </tr>
            ))}
            {!rows.length && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">{isAr ? 'لا حسابات بنك — أنشئ واحداً' : 'No bank accounts — create one'}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </ConfigPanelShell>
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
    <ConfigPanelShell
      language={language}
      titleEn="Currencies"
      titleAr="العملات"
      purposeEn="Multi-currency rates used when foreign invoices are paid or revalued."
      purposeAr="أسعار الصرف للعملات الأجنبية عند الدفع أو إعادة التقييم."
      impactEn="Exchange rates drive unrealized/realized gain-loss entries on foreign currency settlement."
      impactAr="أسعار الصرف تولّد قيود أرباح/خسائر فروقات العملة عند التسوية."
      actions={(
        <>
          <button type="button" onClick={() => setRows((p) => [...p, { code: '', name: '', nameAr: '', rate: 1, active: true }])} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold dark:border-dark-600">{isAr ? 'إضافة' : 'Add'}</button>
          <button type="button" disabled={save.isPending || isFetching} onClick={() => save.mutate()} className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{save.isPending ? '…' : (isAr ? 'حفظ' : 'Save')}</button>
        </>
      )}
    >
      <p className="text-xs text-slate-500">
        {isAr ? `عملة الشركة: ${data?.companyCurrency || '—'}` : `Company currency: ${data?.companyCurrency || '—'}`}
      </p>
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
    </ConfigPanelShell>
  )
}

const COA_TYPES = [
  { id: 'asset', labelEn: 'Asset', labelAr: 'أصل' },
  { id: 'liability', labelEn: 'Liability', labelAr: 'التزام' },
  { id: 'equity', labelEn: 'Equity', labelAr: 'حقوق ملكية' },
  { id: 'revenue', labelEn: 'Revenue', labelAr: 'إيراد' },
  { id: 'expense', labelEn: 'Expense', labelAr: 'مصروف' },
]

const COA_SUBTYPES = [
  'cash', 'bank', 'receivable', 'inventory', 'fixed_asset', 'accum_depreciation', 'other_asset',
  'payable', 'tax', 'other_liability',
  'capital', 'retained_earnings', 'other_equity',
  'sales', 'other_income',
  'cogs', 'operating', 'payroll', 'other_expense',
]

const emptyCoaForm = () => ({
  code: '',
  name: '',
  nameAr: '',
  type: 'expense',
  subtype: 'operating',
  parentCode: '',
  description: '',
  tagsText: '',
  isPostable: true,
  isActive: true,
})

export function ChartOfAccountsPanel({ language }) {
  const isAr = language === 'ar'
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState(emptyCoaForm())

  const { data: accounts = [], isFetching, refetch } = useQuery({
    queryKey: ['accounting-accounts'],
    queryFn: () => api.get('/accounting/accounts').then((r) => r.data),
  })

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return accounts
    return accounts.filter((a) => [a.code, a.name, a.nameAr, a.type].some((v) => String(v || '').toLowerCase().includes(q)))
  }, [accounts, search])

  const { data: tagCatalog } = useQuery({
    queryKey: ['accounting-account-tags'],
    queryFn: () => api.get('/accounting/account-tags').then((r) => r.data),
  })
  const tagOptions = tagCatalog?.tags || []

  const payloadFromForm = () => ({
    ...form,
    tags: String(form.tagsText || '').split(/[,،\n]/).map((t) => t.trim()).filter(Boolean),
  })

  const saveCreate = useMutation({
    mutationFn: () => api.post('/accounting/accounts', payloadFromForm()).then((r) => r.data),
    onSuccess: () => {
      toast.success(isAr ? 'تم إنشاء الحساب' : 'Account created')
      setShowForm(false)
      setForm(emptyCoaForm())
      refetch()
      queryClient.invalidateQueries({ queryKey: ['accounting-accounts'] })
    },
    onError: (e) => toast.error(e.response?.data?.error || 'Failed'),
  })

  const saveEdit = useMutation({
    mutationFn: () => api.put(`/accounting/accounts/${editId}`, payloadFromForm()).then((r) => r.data),
    onSuccess: () => {
      toast.success(isAr ? 'تم التحديث' : 'Account updated')
      setEditId(null)
      setForm(emptyCoaForm())
      refetch()
      queryClient.invalidateQueries({ queryKey: ['accounting-accounts'] })
    },
    onError: (e) => toast.error(e.response?.data?.error || 'Failed'),
  })

  const startEdit = (row) => {
    setEditId(row._id)
    setShowForm(true)
    setForm({
      code: row.code || '',
      name: row.name || '',
      nameAr: row.nameAr || '',
      type: row.type || 'expense',
      subtype: row.subtype || 'other_expense',
      parentCode: row.parentCode || '',
      description: row.description || '',
      tagsText: (row.tags || []).join(', '),
      isPostable: row.isPostable !== false,
      isActive: row.isActive !== false,
    })
  }

  return (
    <ConfigPanelShell
      language={language}
      titleEn="Chart of accounts"
      titleAr="دليل الحسابات"
      purposeEn="Hierarchical ledger structure — every journal line posts to an account here."
      purposeAr="هيكل الدفاتر المالية — كل بند قيد يرتبط بحساب في هذا الدليل."
      impactEn="Product categories, taxes, bank setup, and automated entries all resolve account codes from this chart."
      impactAr="فئات المنتجات والضرائب وإعداد البنوك والقيود الآلية تعتمد على رموز هذا الدليل."
      actions={(
        <button
          type="button"
          onClick={() => {
            if (showForm && !editId) {
              setShowForm(false)
              setForm(emptyCoaForm())
            } else {
              setEditId(null)
              setForm(emptyCoaForm())
              setShowForm(true)
            }
          }}
          className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white"
        >
          {showForm && !editId ? (isAr ? 'إلغاء' : 'Cancel') : (isAr ? 'حساب جديد' : 'New account')}
        </button>
      )}
    >
      {showForm ? (
        <div className="grid gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 sm:grid-cols-2 lg:grid-cols-3 dark:border-dark-600 dark:bg-dark-800">
          {[
            ['code', isAr ? 'الرمز' : 'Code', form.code, (v) => setForm((p) => ({ ...p, code: v })), !editId || !accounts.find((a) => a._id === editId)?.isSystem],
            ['name', isAr ? 'الاسم' : 'Name', form.name, (v) => setForm((p) => ({ ...p, name: v })), true],
            ['nameAr', isAr ? 'الاسم (عربي)' : 'Name (Arabic)', form.nameAr, (v) => setForm((p) => ({ ...p, nameAr: v })), true],
            ['parentCode', isAr ? 'الرمز الأب' : 'Parent code', form.parentCode, (v) => setForm((p) => ({ ...p, parentCode: v })), true],
            ['description', isAr ? 'الوصف' : 'Description', form.description, (v) => setForm((p) => ({ ...p, description: v })), true],
          ].map(([key, label, value, onChange, editable]) => (
            editable ? (
              <label key={key} className="text-xs font-medium text-slate-500">
                {label}
                <input value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-dark-600 dark:bg-dark-900" />
              </label>
            ) : (
              <label key={key} className="text-xs font-medium text-slate-500">
                {label}
                <input value={value} disabled className="mt-1 block w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm opacity-70 dark:border-dark-600 dark:bg-dark-900" />
              </label>
            )
          ))}
          <label className="text-xs font-medium text-slate-500">
            {isAr ? 'النوع' : 'Type'}
            <select value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))} disabled={Boolean(editId && accounts.find((a) => a._id === editId)?.isSystem)} className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-dark-600 dark:bg-dark-900">
              {COA_TYPES.map((t) => <option key={t.id} value={t.id}>{isAr ? t.labelAr : t.labelEn}</option>)}
            </select>
          </label>
          <label className="text-xs font-medium text-slate-500">
            {isAr ? 'النوع الفرعي' : 'Subtype'}
            <select value={form.subtype} onChange={(e) => setForm((p) => ({ ...p, subtype: e.target.value }))} className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-dark-600 dark:bg-dark-900">
              {COA_SUBTYPES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label className="text-xs font-medium text-slate-500 sm:col-span-2">
            {isAr ? 'وسوم (تصنيف التدفقات)' : 'Tags (cash-flow classification)'}
            <input
              value={form.tagsText || ''}
              onChange={(e) => setForm((p) => ({ ...p, tagsText: e.target.value }))}
              list="coa-tag-options"
              placeholder={tagOptions.slice(0, 4).join(', ')}
              className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-dark-600 dark:bg-dark-900"
            />
            <datalist id="coa-tag-options">
              {tagOptions.map((tag) => <option key={tag} value={tag} />)}
            </datalist>
          </label>
          <div className="flex flex-wrap items-center gap-4 sm:col-span-2 lg:col-span-3">
            <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={form.isPostable} onChange={(e) => setForm((p) => ({ ...p, isPostable: e.target.checked }))} />{isAr ? 'قابل للترحيل' : 'Postable'}</label>
            <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={form.isActive} onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))} />{isAr ? 'نشط' : 'Active'}</label>
            <button
              type="button"
              disabled={!form.code || !form.name || saveCreate.isPending || saveEdit.isPending}
              onClick={() => (editId ? saveEdit.mutate() : saveCreate.mutate())}
              className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {editId ? (isAr ? 'تحديث' : 'Update') : (isAr ? 'إنشاء' : 'Create')}
            </button>
          </div>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-dark-600 dark:bg-dark-800">
        <div className="border-b border-slate-100 px-5 py-3 dark:border-white/10">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={isAr ? 'بحث بالرمز أو الاسم…' : 'Search code or name…'}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-dark-900"
          />
        </div>
        {isFetching ? <p className="px-5 py-3 text-xs text-slate-400">…</p> : null}
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50/80 text-left text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400 dark:bg-dark-900">
              <tr>
                <th className="px-5 py-3.5">{isAr ? 'الرمز' : 'Code'}</th>
                <th className="px-5 py-3.5">{isAr ? 'الاسم' : 'Name'}</th>
                <th className="px-5 py-3.5">{isAr ? 'النوع' : 'Type'}</th>
                <th className="px-5 py-3.5">{isAr ? 'وسوم' : 'Tags'}</th>
                <th className="px-5 py-3.5 text-end">{isAr ? 'الرصيد' : 'Balance'}</th>
                <th className="px-5 py-3.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {filtered.map((a) => (
                <tr key={a._id} className="hover:bg-emerald-50/40 dark:hover:bg-white/[0.03]">
                  <td className="px-5 py-3.5 font-mono text-xs font-semibold text-emerald-800 dark:text-emerald-300">{a.code}</td>
                  <td className="px-5 py-3.5">
                    <p className="font-medium text-slate-900 dark:text-white">{isAr ? (a.nameAr || a.name) : a.name}</p>
                    {a.isSystem ? <span className="text-[10px] uppercase text-slate-400">{isAr ? 'نظام' : 'System'}</span> : null}
                  </td>
                  <td className="px-5 py-3.5 capitalize text-slate-500">{a.type}{a.subtype ? ` · ${a.subtype}` : ''}</td>
                  <td className="px-5 py-3.5 text-xs text-slate-500">{(a.tags || []).join(', ') || '—'}</td>
                  <td className="px-5 py-3.5 text-end font-semibold"><Money value={a.balance || 0} /></td>
                  <td className="px-5 py-3.5 text-end">
                    <button type="button" onClick={() => startEdit(a)} className="rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-semibold dark:border-dark-600">
                      {isAr ? 'تعديل' : 'Edit'}
                    </button>
                  </td>
                </tr>
              ))}
              {!filtered.length && (
                <tr><td colSpan={6} className="px-5 py-8 text-center text-slate-400">{isAr ? 'لا حسابات' : 'No accounts'}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </ConfigPanelShell>
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
    <ConfigPanelShell
      language={language}
      titleEn="Follow-up levels"
      titleAr="مستويات المتابعة"
      purposeEn="Sequential dunning rules by days overdue — drives collection messages and follow-up report badges."
      purposeAr="قواعد التذكير المتسلسلة حسب أيام التأخير — تتحكم برسائل التحصيل وشارات تقرير المتابعة."
      impactEn="Aged AR rows and WhatsApp reminders use the matching level name, channel, and escalation tone."
      impactAr="صفوف أعمار المدينين وتذكيرات واتساب تستخدم اسم المستوى والقناة ونبرة التصعيد."
      actions={(
        <>
          <button type="button" onClick={() => setRows((p) => [...p, { level: p.length + 1, daysOverdue: 0, name: '', nameAr: '', channel: 'whatsapp' }])} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold dark:border-dark-600">{isAr ? 'إضافة' : 'Add'}</button>
          <button type="button" disabled={save.isPending || isFetching} onClick={() => save.mutate()} className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{save.isPending ? '…' : (isAr ? 'حفظ' : 'Save')}</button>
        </>
      )}
    >
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
    </ConfigPanelShell>
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
  const navigate = useNavigate()
  const [modelCode, setModelCode] = useState('')
  const [selectedAsset, setSelectedAsset] = useState(null)
  const { data: modelsData } = useQuery({
    queryKey: ['accounting-asset-models'],
    queryFn: () => api.get('/accounting/asset-models').then((r) => r.data),
  })
  const { data, isFetching, refetch } = useQuery({
    queryKey: ['accounting-depreciation-schedule', modelCode],
    queryFn: () => api.get('/accounting/reports/depreciation-schedule', {
      params: { modelCode: modelCode || undefined },
    }).then((r) => r.data),
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

  const schedule = selectedAsset?.schedule || []
  const statusLabel = (status, posted) => {
    if (posted || status === 'posted') return isAr ? 'مرحّل' : 'Posted'
    if (status === 'current') return isAr ? 'الفترة الحالية' : 'Current period'
    return isAr ? 'مجدول' : 'Scheduled'
  }

  return (
    <div className="space-y-4">
      <ReportFilterRibbon
        language={language}
        hideDates
        hidePresets
        showComparison={false}
        showBasis={false}
        title={isAr ? 'الأصول الثابتة وجدول الإهلاك' : 'Fixed assets & depreciation schedule'}
        extra={(
          <>
            <label className="text-xs font-medium text-slate-500">
              {isAr ? 'نموذج الإهلاك' : 'Depreciation model'}
              <select value={modelCode} onChange={(e) => { setModelCode(e.target.value); setSelectedAsset(null) }} className="mt-1 block rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-dark-600 dark:bg-dark-900">
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
          </>
        )}
        exportProps={{
          getRows: async () => (data?.rows || []).flatMap((asset) => (
            (asset.schedule || []).map((row) => ({
              account: asset.code,
              name: asset.name,
              period: row.period,
              amount: row.amount,
              status: row.status,
              entryNumber: row.entryNumber || '',
            }))
          )),
          columns: [
            { key: 'account', label: isAr ? 'الحساب' : 'Account' },
            { key: 'name', label: isAr ? 'الاسم' : 'Name' },
            { key: 'period', label: isAr ? 'الفترة' : 'Period' },
            { key: 'amount', label: isAr ? 'المبلغ' : 'Amount', value: (r) => Number(r.amount || 0).toFixed(2) },
            { key: 'status', label: isAr ? 'الحالة' : 'Status' },
            { key: 'entryNumber', label: isAr ? 'القيد' : 'Entry' },
          ],
          fileBaseName: 'maqder-depreciation-schedule',
          title: isAr ? 'جدول الإهلاك' : 'Depreciation schedule',
        }}
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-dark-600 dark:bg-dark-800">
          <p className="text-[11px] uppercase tracking-widest text-slate-400">{isAr ? 'تكلفة الأصول' : 'Asset cost'}</p>
          <p className="mt-1 text-lg font-semibold"><Money value={data?.totals?.cost} /></p>
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-dark-600 dark:bg-dark-800">
          <p className="text-[11px] uppercase tracking-widest text-slate-400">{isAr ? 'إهلاك سابق' : 'Previously depreciated'}</p>
          <p className="mt-1 text-lg font-semibold"><Money value={data?.totals?.previouslyDepreciated} /></p>
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-dark-600 dark:bg-dark-800">
          <p className="text-[11px] uppercase tracking-widest text-slate-400">{isAr ? 'إهلاك الفترة' : 'Current period'}</p>
          <p className="mt-1 text-lg font-semibold"><Money value={data?.totals?.currentPeriodDepreciation} /></p>
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-dark-600 dark:bg-dark-800">
          <p className="text-[11px] uppercase tracking-widest text-slate-400">{isAr ? 'صافي القيمة الدفترية' : 'Net book value'}</p>
          <p className="mt-1 text-lg font-semibold"><Money value={data?.totals?.bookValue} /></p>
          <p className="mt-1 text-[11px] text-slate-400">
            {isAr ? 'مجمع الإهلاك' : 'Accum. depr.'} {data?.accumDepreciation?.code || '1650'}: <Money value={data?.accumDepreciation?.balance} />
          </p>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-dark-600 dark:bg-dark-800">
          <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold dark:border-white/10">{isAr ? 'سجل الأصول' : 'Asset register'}</div>
          <div className="max-h-[28rem] overflow-x-auto overflow-y-auto">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 text-[11px] uppercase text-slate-400 dark:bg-dark-900">
                <tr>
                  <th className="px-4 py-2 text-start">{isAr ? 'الحساب' : 'Account'}</th>
                  <th className="px-4 py-2 text-end">{isAr ? 'التكلفة' : 'Cost'}</th>
                  <th className="px-4 py-2 text-start">{isAr ? 'الطريقة' : 'Method'}</th>
                  <th className="px-4 py-2 text-end">{isAr ? 'إهلاك سابق' : 'Prev. depr.'}</th>
                  <th className="px-4 py-2 text-end">{isAr ? 'الفترة' : 'Period'}</th>
                  <th className="px-4 py-2 text-end">{isAr ? 'القيمة الدفترية' : 'Book value'}</th>
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
                    <td className="px-4 py-2 text-xs text-slate-500">{row.methodLabel || row.method || '—'}</td>
                    <td className="px-4 py-2 text-end"><Money value={row.previouslyDepreciated} /></td>
                    <td className="px-4 py-2 text-end"><Money value={row.currentPeriodDepreciation} /></td>
                    <td className="px-4 py-2 text-end"><Money value={row.bookValue} /></td>
                  </tr>
                ))}
                {!(data?.rows || []).length && <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">{isAr ? 'لا أصول ثابتة في الدليل' : 'No fixed-asset accounts'}</td></tr>}
              </tbody>
            </table>
          </div>
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
                    <th className="px-4 py-2 text-start">{isAr ? 'القيد' : 'Entry'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {schedule.map((row) => (
                    <tr key={row.period} className={row.posted ? 'bg-emerald-50/30 dark:bg-emerald-950/10' : ''}>
                      <td className="px-4 py-2 font-mono text-xs">{row.period}</td>
                      <td className="px-4 py-2 text-end"><Money value={row.amount} /></td>
                      <td className="px-4 py-2 text-xs text-slate-500">{statusLabel(row.status, row.posted)}</td>
                      <td className="px-4 py-2 font-mono text-xs">
                        {row.entryId ? (
                          <button
                            type="button"
                            className="text-emerald-700 hover:underline dark:text-emerald-400"
                            onClick={() => navigate(`/app/dashboard/accounting?tab=journals&q=${encodeURIComponent(row.entryNumber || '')}`)}
                          >
                            {row.entryNumber || '—'}
                          </button>
                        ) : '—'}
                      </td>
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
    <ConfigPanelShell
      language={language}
      titleEn={kind === 'revenue' ? 'Deferred revenue models' : 'Deferred expense models'}
      titleAr={kind === 'revenue' ? 'نماذج الإيرادات المؤجلة' : 'نماذج المصروفات المؤجلة'}
      purposeEn="Amortization templates (months) for prepaid revenue or deferred expenses."
      purposeAr="قوالب الإطفاء (بالأشهر) للإيرادات أو المصروفات المؤجلة."
      impactEn="Monthly amortization jobs post journal entries using these model durations."
      impactAr="مهام الإطفاء الشهرية ترحّل القيود وفق مدة النموذج."
      actions={(
        <>
          <button type="button" onClick={() => setRows((p) => [...p, { code: '', name: '', nameAr: '', months: 12, kind }])} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold dark:border-dark-600">{isAr ? 'إضافة' : 'Add'}</button>
          <button type="button" disabled={save.isPending || isFetching} onClick={() => save.mutate()} className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{isAr ? 'حفظ' : 'Save'}</button>
        </>
      )}
    >
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
    </ConfigPanelShell>
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
    <ConfigPanelShell
      language={language}
      titleEn="Asset models"
      titleAr="نماذج الأصول"
      purposeEn="Fixed-asset depreciation templates (method, useful life, salvage)."
      purposeAr="قوالب إهلاك الأصول الثابتة (الطريقة، العمر، قيمة الخردة)."
      impactEn="Depreciation schedule and monthly posting use these parameters."
      impactAr="جدول الإهلاك والترحيل الشهري يستخدمان هذه المعاملات."
      actions={(
        <>
          <button type="button" onClick={() => setRows((p) => [...p, { code: '', name: '', nameAr: '', usefulLifeMonths: 60, salvagePct: 0, method: 'straight_line' }])} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold dark:border-dark-600">{isAr ? 'إضافة' : 'Add'}</button>
          <button type="button" disabled={save.isPending || isFetching} onClick={() => save.mutate()} className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{isAr ? 'حفظ' : 'Save'}</button>
        </>
      )}
    >
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
    </ConfigPanelShell>
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
    <ConfigPanelShell
      language={language}
      titleEn="Analytic plans"
      titleAr="الخطط التحليلية"
      purposeEn="Dimensions (departments, projects) that group analytic accounts for cost tracking."
      purposeAr="أبعاد (أقسام، مشاريع) تجمع الحسابات التحليلية لتتبع التكاليف."
      impactEn="Analytic accounts belong to a plan; distribution models reference plan codes."
      impactAr="الحسابات التحليلية تنتمي لخطة؛ نماذج التوزيع تشير إلى رموز الخطط."
      actions={(
        <>
          <button type="button" onClick={() => setRows((p) => [...p, { code: '', name: '', nameAr: '', active: true }])} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold dark:border-dark-600">{isAr ? 'إضافة' : 'Add'}</button>
          <button type="button" disabled={save.isPending || isFetching} onClick={() => save.mutate()} className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{isAr ? 'حفظ' : 'Save'}</button>
        </>
      )}
    >
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
    </ConfigPanelShell>
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
    onSuccess: () => { toast.success(isAr ? 'تم الحفظ' : 'Saved'); refetch() },
  })
  return (
    <ConfigPanelShell
      language={language}
      titleEn="Account tags"
      titleAr="وسوم الحسابات"
      purposeEn="Vocabulary for tagging chart-of-accounts lines — drives cash-flow classification and custom reports."
      purposeAr="قاموس وسوم حسابات الدليل — يتحكم بتصنيف التدفقات النقدية والتقارير."
      impactEn="Assign tags on each CoA row; cash-flow statement buckets prefer investing/financing/operating tags."
      impactAr="يُعيَّن الوسم على كل حساب؛ تقرير التدفقات النقدية يفضّل وسوم investing/financing/operating."
      actions={(
        <button type="button" disabled={save.isPending || isFetching} onClick={() => save.mutate()} className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{save.isPending ? '…' : (isAr ? 'حفظ' : 'Save')}</button>
      )}
    >
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-dark-600 dark:bg-dark-900" placeholder={isAr ? 'operating, investing, financing, tax' : 'operating, investing, financing, tax'} />
    </ConfigPanelShell>
  )
}

export function AccountGroupsPanel({ language }) {
  const isAr = language === 'ar'
  const { data, refetch, isFetching } = useQuery({
    queryKey: ['accounting-account-groups'],
    queryFn: () => api.get('/accounting/account-groups').then((r) => r.data),
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
    mutationFn: () => api.put('/accounting/account-groups', {
      groups: rows.map((row, idx) => ({
        code: row.code,
        name: row.name,
        nameAr: row.nameAr,
        report: row.report || 'pnl',
        accountPrefixes: String(row.accountPrefixesText || '').split(/[,،\s]+/).map((p) => p.trim()).filter(Boolean),
        sequence: row.sequence || (idx + 1),
      })),
    }).then((r) => r.data),
    onSuccess: () => refetch(),
  })

  return (
    <ConfigPanelShell
      language={language}
      titleEn="Account groups"
      titleAr="مجموعات الحسابات"
      purposeEn="Define P&L and balance sheet sections by account code prefix for report rollups."
      purposeAr="تعريف أقسام قائمة الدخل والميزانية حسب بادئة رمز الحساب."
      impactEn="Evaluated on P&L and balance sheet as section subtotals alongside horizontal column groups."
      impactAr="تُعرض في قائمة الدخل والميزانية كمجموعات أقسام بجانب المجموعات الأفقية."
      actions={(
        <>
          <button type="button" onClick={() => setRows((p) => [...p, { code: '', name: '', nameAr: '', report: 'pnl', accountPrefixesText: '', sequence: p.length + 1 }])} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold dark:border-dark-600">{isAr ? 'إضافة' : 'Add'}</button>
          <button type="button" disabled={save.isPending || isFetching} onClick={() => save.mutate()} className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{isAr ? 'حفظ' : 'Save'}</button>
        </>
      )}
    >
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-dark-600 dark:bg-dark-800">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-[11px] uppercase text-slate-400 dark:bg-dark-900">
            <tr>
              <th className="px-3 py-2 text-start">{isAr ? 'الرمز' : 'Code'}</th>
              <th className="px-3 py-2 text-start">{isAr ? 'الاسم' : 'Name'}</th>
              <th className="px-3 py-2 text-start">{isAr ? 'التقرير' : 'Report'}</th>
              <th className="px-3 py-2 text-start">{isAr ? 'بادئات الحساب' : 'Account prefixes'}</th>
              <th className="px-3 py-2 text-end">{isAr ? 'حسابات' : 'Accounts'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/5">
            {rows.map((row, i) => (
              <tr key={i}>
                <td className="px-3 py-2"><input value={row.code || ''} onChange={(e) => setRows((p) => p.map((r, idx) => (idx === i ? { ...r, code: e.target.value.toUpperCase() } : r)))} className="w-24 rounded-lg border border-slate-200 px-2 py-1 font-mono text-xs dark:border-dark-600 dark:bg-dark-900" /></td>
                <td className="px-3 py-2"><input value={row.name || ''} onChange={(e) => setRows((p) => p.map((r, idx) => (idx === i ? { ...r, name: e.target.value } : r)))} className="w-full rounded-lg border border-slate-200 px-2 py-1 dark:border-dark-600 dark:bg-dark-900" /></td>
                <td className="px-3 py-2">
                  <select value={row.report || 'pnl'} onChange={(e) => setRows((p) => p.map((r, idx) => (idx === i ? { ...r, report: e.target.value } : r)))} className="rounded-lg border border-slate-200 px-2 py-1 text-xs dark:border-dark-600 dark:bg-dark-900">
                    <option value="pnl">{isAr ? 'قائمة الدخل' : 'P&L'}</option>
                    <option value="bs">{isAr ? 'الميزانية' : 'Balance sheet'}</option>
                  </select>
                </td>
                <td className="px-3 py-2"><input value={row.accountPrefixesText || ''} onChange={(e) => setRows((p) => p.map((r, idx) => (idx === i ? { ...r, accountPrefixesText: e.target.value } : r)))} placeholder="4, 5" className="w-full rounded-lg border border-slate-200 px-2 py-1 font-mono text-xs dark:border-dark-600 dark:bg-dark-900" /></td>
                <td className="px-3 py-2 text-end tabular-nums text-slate-500">{countFor(row.accountPrefixesText)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ConfigPanelShell>
  )
}

export function TaxGroupsPanel({ language }) {
  const isAr = language === 'ar'
  const { data: taxes = [] } = useQuery({
    queryKey: ['accounting-taxes'],
    queryFn: () => api.get('/accounting/taxes', { params: { active: 'false' } }).then((r) => r.data || []),
  })
  const { data, refetch, isFetching } = useQuery({
    queryKey: ['accounting-tax-groups'],
    queryFn: () => api.get('/accounting/tax-groups').then((r) => r.data),
  })
  const [rows, setRows] = useState([])
  useEffect(() => {
    if (data?.groups) setRows(data.groups.map((r) => ({ ...r, taxCodes: (r.taxCodes || []).join(', ') })))
  }, [data?.groups])
  const save = useMutation({
    mutationFn: () => api.put('/accounting/tax-groups', {
      groups: rows.map((r) => ({
        ...r,
        taxCodes: String(r.taxCodes || '').split(/[,،\s]+/).map((c) => c.trim().toUpperCase()).filter(Boolean),
      })),
    }).then((r) => r.data),
    onSuccess: () => { toast.success(isAr ? 'تم الحفظ' : 'Saved'); refetch() },
  })
  const taxCodeOptions = (Array.isArray(taxes) ? taxes : []).map((t) => t.code).filter(Boolean)

  return (
    <ConfigPanelShell
      language={language}
      titleEn="Tax groups"
      titleAr="مجموعات الضريبة"
      purposeEn="Combine multiple tax rates into one subtotal line on printed invoices (e.g. 15% VAT)."
      purposeAr="دمج عدة معدلات ضريبة في سطر واحد على PDF الفاتورة."
      impactEn="Groups reference tax master codes; invoice PDF and ZATCA grids can aggregate by group."
      impactAr="تشير المجموعات إلى رموز الضرائب؛ PDF وZATCA يمكن أن يجمعا حسب المجموعة."
      actions={(
        <>
          <button type="button" onClick={() => setRows((p) => [...p, { code: '', name: '', nameAr: '', taxCodes: '', sequence: p.length + 1 }])} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold dark:border-dark-600">{isAr ? 'إضافة' : 'Add'}</button>
          <button type="button" disabled={save.isPending || isFetching} onClick={() => save.mutate()} className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{save.isPending ? '…' : (isAr ? 'حفظ' : 'Save')}</button>
        </>
      )}
    >
      <div className="overflow-x-auto overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-dark-600 dark:bg-dark-800">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-[11px] uppercase text-slate-400 dark:bg-dark-900">
            <tr>
              <th className="px-3 py-2">{isAr ? 'الرمز' : 'Code'}</th>
              <th className="px-3 py-2">{isAr ? 'الاسم' : 'Name'}</th>
              <th className="px-3 py-2">{isAr ? 'رموز الضرائب' : 'Tax codes'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/5">
            {rows.map((row, i) => (
              <tr key={i}>
                <td className="px-3 py-2"><input value={row.code || ''} onChange={(e) => setRows((p) => p.map((r, idx) => (idx === i ? { ...r, code: e.target.value.toUpperCase() } : r)))} className="w-24 rounded-lg border border-slate-200 px-2 py-1 font-mono text-xs dark:border-dark-600 dark:bg-dark-900" /></td>
                <td className="px-3 py-2"><input value={row.name || ''} onChange={(e) => setRows((p) => p.map((r, idx) => (idx === i ? { ...r, name: e.target.value } : r)))} className="w-full rounded-lg border border-slate-200 px-2 py-1 dark:border-dark-600 dark:bg-dark-900" /></td>
                <td className="px-3 py-2">
                  <input value={row.taxCodes || ''} onChange={(e) => setRows((p) => p.map((r, idx) => (idx === i ? { ...r, taxCodes: e.target.value } : r)))} list="tax-code-options" placeholder={taxCodeOptions.slice(0, 3).join(', ')} className="w-full rounded-lg border border-slate-200 px-2 py-1 font-mono text-xs dark:border-dark-600 dark:bg-dark-900" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <datalist id="tax-code-options">{taxCodeOptions.map((code) => <option key={code} value={code} />)}</datalist>
      </div>
    </ConfigPanelShell>
  )
}

export function ProductCategoriesBridgePanel({ language }) {
  const isAr = language === 'ar'
  const navigate = useNavigate()
  const { data, isFetching } = useQuery({
    queryKey: ['accounting-product-categories-bridge'],
    queryFn: () => api.get('/accounting/product-categories-bridge').then((r) => r.data),
  })
  const rows = data?.rows || []
  const summary = data?.summary || {}

  const acctLabel = (acct) => (acct ? `${acct.code} — ${isAr ? (acct.nameAr || acct.name) : acct.name}` : '—')

  return (
    <ConfigPanelShell
      language={language}
      titleEn="Product categories"
      titleAr="فئات المنتجات"
      purposeEn="Bridge between Inventory and Accounting — default income, expense, and valuation accounts per category."
      purposeAr="جسر بين المخزون والمحاسبة — حسابات الدخل والمصروف والتقييم لكل فئة."
      impactEn="Stock moves and invoice revenue lines resolve accounts from the product category when not overridden."
      impactAr="حركات المخزون وإيرادات الفواتير تستخدم حسابات الفئة عند عدم التخصيص."
      actions={(
        <button type="button" onClick={() => navigate('/app/dashboard/inventory/product-categories')} className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white">
          {isAr ? 'تحرير في المخزون' : 'Edit in Inventory'}
        </button>
      )}
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-dark-600 dark:bg-dark-800">
          <p className="text-[11px] uppercase text-slate-400">{isAr ? 'الفئات' : 'Categories'}</p>
          <p className="mt-1 text-lg font-semibold">{summary.total ?? rows.length}</p>
        </div>
        <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/50 p-4 dark:border-emerald-500/20 dark:bg-emerald-950/20">
          <p className="text-[11px] uppercase text-emerald-700/70">{isAr ? 'مكتملة' : 'Complete'}</p>
          <p className="mt-1 text-lg font-semibold">{summary.complete ?? 0}</p>
        </div>
        <div className="rounded-2xl border border-amber-200/80 bg-amber-50/50 p-4 dark:border-amber-500/20 dark:bg-amber-950/20">
          <p className="text-[11px] uppercase text-amber-800/70">{isAr ? 'ناقصة' : 'Incomplete'}</p>
          <p className="mt-1 text-lg font-semibold">{summary.incomplete ?? 0}</p>
        </div>
      </div>
      {isFetching ? <p className="text-xs text-slate-400">…</p> : null}
      <div className="overflow-x-auto overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-dark-600 dark:bg-dark-800">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-[11px] uppercase text-slate-400 dark:bg-dark-900">
            <tr>
              <th className="px-3 py-2 text-start">{isAr ? 'الفئة' : 'Category'}</th>
              <th className="px-3 py-2 text-start">{isAr ? 'الدخل' : 'Income'}</th>
              <th className="px-3 py-2 text-start">{isAr ? 'المصروف' : 'Expense'}</th>
              <th className="px-3 py-2 text-start">{isAr ? 'التقييم' : 'Valuation'}</th>
              <th className="px-3 py-2 text-end">{isAr ? 'منتجات' : 'Products'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/5">
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="px-3 py-2">
                  <p className="font-medium">{row.completePath || row.name}</p>
                  {!row.complete ? (
                    <span className="text-[10px] font-semibold text-amber-700">{isAr ? 'حسابات ناقصة' : 'Missing accounts'}</span>
                  ) : null}
                </td>
                <td className="px-3 py-2 text-xs text-slate-600">{acctLabel(row.incomeAccount)}</td>
                <td className="px-3 py-2 text-xs text-slate-600">{acctLabel(row.expenseAccount)}</td>
                <td className="px-3 py-2 text-xs text-slate-600">{acctLabel(row.stockValuationAccount)}</td>
                <td className="px-3 py-2 text-end tabular-nums">{row.productCount}</td>
              </tr>
            ))}
            {!rows.length && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">{isAr ? 'لا فئات' : 'No categories'}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </ConfigPanelShell>
  )
}

export function AccountingReportsConfigPanel({ language }) {
  const isAr = language === 'ar'
  const navigate = useNavigate()
  const { data, refetch, isFetching } = useQuery({
    queryKey: ['accounting-report-definitions'],
    queryFn: () => api.get('/accounting/report-definitions').then((r) => r.data),
  })
  const [rows, setRows] = useState([])
  useEffect(() => {
    if (data?.definitions) setRows(data.definitions.map((r) => ({ ...r })))
  }, [data?.definitions])
  const save = useMutation({
    mutationFn: () => api.put('/accounting/report-definitions', { definitions: rows }).then((r) => r.data),
    onSuccess: () => { toast.success(isAr ? 'تم الحفظ' : 'Saved'); refetch() },
  })
  const links = [
    ['pnl', isAr ? 'الأرباح والخسائر' : 'Profit & loss'],
    ['balance-sheet', isAr ? 'الميزانية' : 'Balance sheet'],
    ['cash-flow', isAr ? 'التدفقات النقدية' : 'Cash flow'],
  ]

  return (
    <ConfigPanelShell
      language={language}
      titleEn="Accounting reports"
      titleAr="تقارير محاسبية"
      purposeEn="Custom statement lines with formulas referencing account prefixes or other lines."
      purposeAr="بنود مخصصة بمعادلات تشير إلى بادئات الحسابات أو بنود أخرى."
      impactEn="Evaluated on P&L and balance sheet as customReportLines; use sum(prefix:4), sum(account:4100), line:CODE."
      impactAr="تُقيَّم في الأرباح والميزانية؛ استخدم sum(prefix:4) و line:CODE."
      actions={(
        <>
          <button type="button" onClick={() => setRows((p) => [...p, { report: 'pnl', code: '', label: '', labelAr: '', formula: '', sequence: p.length + 1 }])} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold dark:border-dark-600">{isAr ? 'إضافة سطر' : 'Add line'}</button>
          <button type="button" disabled={save.isPending || isFetching} onClick={() => save.mutate()} className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{save.isPending ? '…' : (isAr ? 'حفظ' : 'Save')}</button>
        </>
      )}
    >
      <div className="overflow-x-auto overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-dark-600 dark:bg-dark-800">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-[11px] uppercase text-slate-400 dark:bg-dark-900">
            <tr>
              <th className="px-2 py-2">{isAr ? 'التقرير' : 'Report'}</th>
              <th className="px-2 py-2">{isAr ? 'الرمز' : 'Code'}</th>
              <th className="px-2 py-2">{isAr ? 'التسمية' : 'Label'}</th>
              <th className="px-2 py-2">{isAr ? 'المعادلة' : 'Formula'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/5">
            {rows.map((row, i) => (
              <tr key={i}>
                <td className="px-2 py-2">
                  <select value={row.report || 'pnl'} onChange={(e) => setRows((p) => p.map((r, idx) => (idx === i ? { ...r, report: e.target.value } : r)))} className="rounded-lg border border-slate-200 px-2 py-1 text-xs dark:border-dark-600 dark:bg-dark-900">
                    <option value="pnl">P&L</option>
                    <option value="bs">BS</option>
                    <option value="cashflow">{isAr ? 'تدفقات' : 'Cash flow'}</option>
                  </select>
                </td>
                <td className="px-2 py-2"><input value={row.code || ''} onChange={(e) => setRows((p) => p.map((r, idx) => (idx === i ? { ...r, code: e.target.value.toUpperCase() } : r)))} className="w-28 rounded-lg border border-slate-200 px-2 py-1 font-mono text-xs dark:border-dark-600 dark:bg-dark-900" /></td>
                <td className="px-2 py-2"><input value={row.label || ''} onChange={(e) => setRows((p) => p.map((r, idx) => (idx === i ? { ...r, label: e.target.value } : r)))} className="w-full min-w-[8rem] rounded-lg border border-slate-200 px-2 py-1 dark:border-dark-600 dark:bg-dark-900" /></td>
                <td className="px-2 py-2"><input value={row.formula || ''} onChange={(e) => setRows((p) => p.map((r, idx) => (idx === i ? { ...r, formula: e.target.value } : r)))} placeholder="sum(prefix:4) - sum(prefix:5)" className="w-full min-w-[12rem] rounded-lg border border-slate-200 px-2 py-1 font-mono text-[11px] dark:border-dark-600 dark:bg-dark-900" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {links.map(([id, label]) => (
          <button key={id} type="button" onClick={() => navigate(`/app/dashboard/accounting/${id}`)} className="rounded-2xl border border-slate-200/80 bg-white px-4 py-4 text-start text-sm font-semibold hover:border-slate-300 dark:border-dark-600 dark:bg-dark-800">
            {label}
          </button>
        ))}
      </div>
    </ConfigPanelShell>
  )
}

export function OnlineSyncPanel({ language }) {
  const isAr = language === 'ar'
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [bankAccountId, setBankAccountId] = useState('')
  const [syncProvider, setSyncProvider] = useState('sandbox')
  const { data, refetch, isFetching } = useQuery({
    queryKey: ['accounting-bank-sync'],
    queryFn: () => api.get('/accounting/bank-sync/status').then((r) => r.data),
  })
  const { data: bankCatalog } = useQuery({
    queryKey: ['accounting-bank-catalog'],
    queryFn: () => api.get('/accounting/bank-accounts').then((r) => r.data),
  })
  const connect = useMutation({
    mutationFn: (payload) => api.post('/accounting/bank-sync/connect', payload).then((r) => r.data),
    onSuccess: (payload) => {
      if (payload?.authorizeUrl) {
        window.open(payload.authorizeUrl, '_blank', 'noopener,noreferrer')
        toast.success(payload?.message || (isAr ? 'أكمل الربط ثم أكّد' : 'Finish OAuth, then confirm'))
      } else {
        toast.success(payload?.message || (isAr ? 'تم الربط' : 'Connected'))
      }
      refetch()
      queryClient.invalidateQueries({ queryKey: ['accounting-bank-sync'] })
    },
    onError: (e) => toast.error(e.response?.data?.error || 'Failed'),
  })
  const confirmOAuth = useMutation({
    mutationFn: (provider) => {
      const conn = connections.find((c) => c.provider === provider)
      return api.post('/accounting/bank-sync/oauth/callback', {
        provider,
        state: conn?.metadata?.oauthState || undefined,
        bankAccountId: bankAccountId || undefined,
      }).then((r) => r.data)
    },
    onSuccess: (payload) => {
      toast.success(payload?.message || (isAr ? 'تم تأكيد الربط' : 'Connected'))
      refetch()
    },
    onError: (e) => toast.error(e.response?.data?.error || 'Failed'),
  })
  const syncFeed = useMutation({
    mutationFn: (provider) => api.post('/accounting/bank-sync/sync', {
      provider: provider || syncProvider || 'sandbox',
      bankAccountId: bankAccountId || undefined,
    }).then((r) => r.data),
    onSuccess: (payload) => {
      toast.success(isAr
        ? `تم استيراد ${payload.lineCount} سطر`
        : `Imported ${payload.lineCount} statement lines`)
      refetch()
    },
    onError: (e) => toast.error(e.response?.data?.error || 'Failed'),
  })
  const disconnect = useMutation({
    mutationFn: (provider) => api.post('/accounting/bank-sync/disconnect', { provider }).then((r) => r.data),
    onSuccess: () => { toast.success(isAr ? 'تم قطع الربط' : 'Disconnected'); refetch() },
  })
  const providers = data?.providers || []
  const connections = data?.connections || []
  const connectedSet = new Set(connections.filter((c) => c.status === 'connected').map((c) => c.provider))
  const pendingSet = new Set(connections.filter((c) => c.status === 'pending').map((c) => c.provider))
  const bankRows = bankCatalog?.rows || []
  const anyConnected = connectedSet.size > 0

  return (
    <ConfigPanelShell
      language={language}
      titleEn="Online bank synchronization"
      titleAr="مزامنة بنكية عبر الإنترنت"
      purposeEn="OAuth connections to bank aggregators. Sandbox always works; Plaid/Salt Edge unlock when env credentials are set."
      purposeAr="ربط OAuth مع مجمعات البنوك. التجريبي متاح دائماً؛ Plaid/Salt Edge عند ضبط المفاتيح."
      impactEn="Sync pulls statement lines into Bank reconciliation; auto-match can reconcile mirrored GL items."
      impactAr="المزامنة تستورد أسطر الكشف إلى التسوية البنكية؛ المطابقة التلقائية تربط بنود الأستاذ."
      actions={(
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => navigate('/app/dashboard/accounting/bank-recon')} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold dark:border-dark-600">
            {isAr ? 'التسوية البنكية' : 'Bank reconciliation'}
          </button>
          {anyConnected ? (
            <button
              type="button"
              disabled={syncFeed.isPending}
              onClick={() => syncFeed.mutate(syncProvider)}
              className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {syncFeed.isPending ? '…' : (isAr ? 'مزامنة الآن' : 'Sync now')}
            </button>
          ) : null}
        </div>
      )}
    >
      {isFetching ? <p className="text-xs text-slate-400">…</p> : null}
      {anyConnected ? (
        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-medium text-slate-500">
            {isAr ? 'المزود للمزامنة' : 'Provider to sync'}
            <select
              value={syncProvider}
              onChange={(e) => setSyncProvider(e.target.value)}
              className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-dark-600 dark:bg-dark-900"
            >
              {[...connectedSet].map((id) => (
                <option key={id} value={id}>{id}</option>
              ))}
            </select>
          </label>
          {bankRows.length ? (
            <label className="block text-xs font-medium text-slate-500">
              {isAr ? 'حساب البنك للمزامنة' : 'Bank account for sync'}
              <select
                value={bankAccountId}
                onChange={(e) => setBankAccountId(e.target.value)}
                className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-dark-600 dark:bg-dark-900"
              >
                <option value="">{isAr ? 'الافتراضي' : 'Default'}</option>
                {bankRows.map((row) => (
                  <option key={row.accountId} value={row.accountId}>{row.code} — {isAr ? (row.nameAr || row.name) : row.name}</option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {providers.map((provider) => {
          const connected = connectedSet.has(provider.id)
          const pending = pendingSet.has(provider.id)
          const comingSoon = provider.status === 'coming_soon'
          return (
            <div key={provider.id} className="rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-dark-600 dark:bg-dark-800">
              <p className="font-semibold">{isAr ? (provider.nameAr || provider.name) : provider.name}</p>
              <p className="mt-1 text-xs text-slate-500">
                {comingSoon
                  ? (provider.credentialHint || (isAr ? 'قريباً' : 'Coming soon'))
                  : connected
                    ? (isAr ? 'متصل' : 'Connected')
                    : pending
                      ? (isAr ? 'بانتظار OAuth' : 'Pending OAuth')
                      : (isAr ? 'غير متصل' : 'Not connected')}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {!comingSoon && !connected && !pending ? (
                  <button type="button" disabled={connect.isPending} onClick={() => connect.mutate({ provider: provider.id, bankAccountId: bankAccountId || null })} className="rounded-xl bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">
                    {isAr ? 'ربط' : 'Connect'}
                  </button>
                ) : null}
                {pending ? (
                  <button type="button" disabled={confirmOAuth.isPending} onClick={() => confirmOAuth.mutate(provider.id)} className="rounded-xl bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">
                    {isAr ? 'تأكيد الربط' : 'Confirm'}
                  </button>
                ) : null}
                {connected ? (
                  <>
                    <button type="button" disabled={syncFeed.isPending} onClick={() => { setSyncProvider(provider.id); syncFeed.mutate(provider.id) }} className="rounded-xl border border-emerald-200 px-3 py-1.5 text-xs font-semibold text-emerald-800 dark:border-emerald-900">
                      {isAr ? 'مزامنة' : 'Sync'}
                    </button>
                    <button type="button" disabled={disconnect.isPending} onClick={() => disconnect.mutate(provider.id)} className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold dark:border-dark-600">
                      {isAr ? 'قطع' : 'Disconnect'}
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>
    </ConfigPanelShell>
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
    <ConfigPanelShell
      language={language}
      titleEn="Horizontal groups"
      titleAr="مجموعات أفقية"
      purposeEn="Group P&L and balance sheet columns by account code prefix for multi-column reporting."
      purposeAr="تجميع أعمدة قائمة الدخل والميزانية حسب بادئة رمز الحساب."
      impactEn="Evaluated on P&L and balance sheet reports as extra column groups alongside account rows."
      impactAr="تُعرض في تقارير قائمة الدخل والميزانية كمجموعات أعمدة إضافية."
      actions={(
        <>
          <button type="button" onClick={() => setRows((p) => [...p, { code: '', name: '', nameAr: '', accountPrefixesText: '', sequence: p.length + 1 }])} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold dark:border-dark-600">{isAr ? 'إضافة' : 'Add'}</button>
          <button type="button" disabled={save.isPending || isFetching} onClick={() => save.mutate()} className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{isAr ? 'حفظ' : 'Save'}</button>
        </>
      )}
    >
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
    </ConfigPanelShell>
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
    <ConfigPanelShell
      language={language}
      titleEn="Tax units"
      titleAr="وحدات الضريبة"
      purposeEn="Legal entities or branches for consolidated VAT filing and multi-unit tax reports."
      purposeAr="كيانات قانونية أو فروع لإقرارات ضريبة القيمة المضافة المجمّعة."
      impactEn="Tax unit codes scope tax report rows when multiple VAT registrations exist."
      impactAr="رموز الوحدات تحدد نطاق صفوف تقرير الضريبة عند وجود أكثر من تسجيل."
      actions={(
        <>
          <button type="button" onClick={() => setRows((p) => [...p, { code: '', name: '', nameAr: '', vatNumber: '', country: 'SA', taxCodesText: '', isDefault: p.length === 0 }])} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold dark:border-dark-600">{isAr ? 'إضافة' : 'Add'}</button>
          <button type="button" disabled={save.isPending || isFetching} onClick={() => save.mutate()} className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{isAr ? 'حفظ' : 'Save'}</button>
        </>
      )}
    >
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
    </ConfigPanelShell>
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
    <ConfigPanelShell
      language={language}
      titleEn="Analytic distribution models"
      titleAr="نماذج التوزيع التحليلي"
      purposeEn="Rules to auto-split invoice line amounts across analytic accounts by prefix, category, or partner tag."
      purposeAr="قواعد توزيع تلقائي لمبالغ بنود الفواتير على الحسابات التحليلية."
      impactEn="Applied when building sales/purchase journal previews and posted invoice lines."
      impactAr="تُطبّق عند بناء معاينة القيود وترحيل بنود الفواتير."
      actions={(
        <>
          <button type="button" onClick={addModel} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold dark:border-dark-600">{isAr ? 'إضافة' : 'Add'}</button>
          <button type="button" disabled={save.isPending || isFetching} onClick={() => save.mutate()} className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{isAr ? 'حفظ' : 'Save'}</button>
        </>
      )}
    >
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
    </ConfigPanelShell>
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
    <ConfigPanelShell
      language={language}
      titleEn="Automatic transfers"
      titleAr="تحويلات تلقائية"
      purposeEn="Scheduled sweeps that reallocate account balances by percent (monthly/quarterly/yearly)."
      purposeAr="مسح مجدول يعيد توزيع أرصدة الحسابات بنسبة (شهري/ربعي/سنوي)."
      impactEn="Run now or period close creates balanced journal entries between source and destination accounts."
      impactAr="التشغيل اليدوي أو إقفال الفترة ينشئ قيوداً متوازنة بين المصدر والوجهة."
      actions={(
        <>
          <button type="button" onClick={() => setRows((p) => [...p, { name: '', nameAr: '', sourceAccountId: '', destinationAccountId: '', frequency: 'monthly', percent: 100, active: true }])} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold dark:border-dark-600">{isAr ? 'إضافة' : 'Add'}</button>
          <button type="button" disabled={save.isPending || isFetching} onClick={() => save.mutate()} className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{isAr ? 'حفظ' : 'Save'}</button>
          <button type="button" disabled={run.isPending} onClick={() => run.mutate()} className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-950/30 dark:text-emerald-200">{isAr ? 'تشغيل الآن' : 'Run now'}</button>
        </>
      )}
    >
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
    </ConfigPanelShell>
  )
}

export function ReconciliationModelsPanel({ language }) {
  const isAr = language === 'ar'
  const { data, refetch, isFetching } = useQuery({
    queryKey: ['accounting-reconciliation-models'],
    queryFn: () => api.get('/accounting/reconciliation-models').then((r) => r.data),
  })
  const [rows, setRows] = useState([])
  useEffect(() => {
    if (data?.models) setRows(data.models.map((r) => ({ ...r })))
  }, [data?.models])
  const save = useMutation({
    mutationFn: () => api.put('/accounting/reconciliation-models', { models: rows }).then((r) => r.data),
    onSuccess: () => { toast.success(isAr ? 'تم الحفظ' : 'Saved'); refetch() },
    onError: (e) => toast.error(e.response?.data?.error || 'Failed'),
  })

  return (
    <ConfigPanelShell
      language={language}
      titleEn="Reconciliation models"
      titleAr="نماذج التسوية"
      purposeEn="Rule engine that scores bank statement lines against open ledger items during reconciliation."
      purposeAr="محرك قواعد يقيّم كشوف البنك مقابل بنود الدفتر أثناء التسوية."
      impactEn="Boosts auto-match scores in bank reconciliation when label/reference/amount rules hit (e.g. Stripe fees, exact invoice refs)."
      impactAr="يرفع درجة المطابقة التلقائية عند تطابق القواعد (مثل Stripe أو مراجع الفواتير)."
      actions={(
        <>
          <button type="button" onClick={() => setRows((p) => [...p, { name: '', nameAr: '', active: true, priority: 50, labelContains: '', referenceContains: '', feePercent: 0, feeAccountPrefix: '', autoMatchExactAmount: false, autoMatchInvoiceRef: false }])} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold dark:border-dark-600">{isAr ? 'إضافة' : 'Add'}</button>
          <button type="button" disabled={save.isPending || isFetching} onClick={() => save.mutate()} className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{save.isPending ? '…' : (isAr ? 'حفظ' : 'Save')}</button>
        </>
      )}
    >
      <div className="overflow-x-auto overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-dark-600 dark:bg-dark-800">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-[11px] uppercase text-slate-400 dark:bg-dark-900">
            <tr>
              <th className="px-2 py-2">{isAr ? 'مفعّل' : 'On'}</th>
              <th className="px-2 py-2">{isAr ? 'الاسم' : 'Name'}</th>
              <th className="px-2 py-2">{isAr ? 'الوصف يحتوي' : 'Label contains'}</th>
              <th className="px-2 py-2">{isAr ? 'المرجع' : 'Ref contains'}</th>
              <th className="px-2 py-2">{isAr ? 'رسوم %' : 'Fee %'}</th>
              <th className="px-2 py-2">{isAr ? 'مطابقة' : 'Match'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/5">
            {rows.map((row, i) => (
              <tr key={i}>
                <td className="px-2 py-2"><input type="checkbox" checked={Boolean(row.active)} onChange={(e) => setRows((p) => p.map((r, idx) => (idx === i ? { ...r, active: e.target.checked } : r)))} /></td>
                <td className="px-2 py-2"><input value={row.name || ''} onChange={(e) => setRows((p) => p.map((r, idx) => (idx === i ? { ...r, name: e.target.value } : r)))} className="w-full min-w-[8rem] rounded-lg border border-slate-200 px-2 py-1 dark:border-dark-600 dark:bg-dark-900" /></td>
                <td className="px-2 py-2"><input value={row.labelContains || ''} onChange={(e) => setRows((p) => p.map((r, idx) => (idx === i ? { ...r, labelContains: e.target.value } : r)))} className="w-full rounded-lg border border-slate-200 px-2 py-1 font-mono text-xs dark:border-dark-600 dark:bg-dark-900" /></td>
                <td className="px-2 py-2"><input value={row.referenceContains || ''} onChange={(e) => setRows((p) => p.map((r, idx) => (idx === i ? { ...r, referenceContains: e.target.value } : r)))} className="w-full rounded-lg border border-slate-200 px-2 py-1 font-mono text-xs dark:border-dark-600 dark:bg-dark-900" /></td>
                <td className="px-2 py-2"><input type="number" value={row.feePercent ?? 0} onChange={(e) => setRows((p) => p.map((r, idx) => (idx === i ? { ...r, feePercent: Number(e.target.value) } : r)))} className="w-16 rounded-lg border border-slate-200 px-2 py-1 dark:border-dark-600 dark:bg-dark-900" /></td>
                <td className="px-2 py-2 text-[10px]">
                  <label className="flex items-center gap-1"><input type="checkbox" checked={Boolean(row.autoMatchExactAmount)} onChange={(e) => setRows((p) => p.map((r, idx) => (idx === i ? { ...r, autoMatchExactAmount: e.target.checked } : r)))} />{isAr ? 'مبلغ' : 'Amt'}</label>
                  <label className="flex items-center gap-1"><input type="checkbox" checked={Boolean(row.autoMatchInvoiceRef)} onChange={(e) => setRows((p) => p.map((r, idx) => (idx === i ? { ...r, autoMatchInvoiceRef: e.target.checked } : r)))} />{isAr ? 'فاتورة' : 'Inv'}</label>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ConfigPanelShell>
  )
}

export function JournalGroupsPanel({ language }) {
  const isAr = language === 'ar'
  const { data, refetch, isFetching } = useQuery({
    queryKey: ['accounting-journal-groups'],
    queryFn: () => api.get('/accounting/journal-groups').then((r) => r.data),
  })
  const [rows, setRows] = useState([])
  useEffect(() => {
    if (data?.groups) setRows(data.groups.map((r) => ({ ...r, journalCodes: (r.journalCodes || []).join(', ') })))
  }, [data?.groups])
  const save = useMutation({
    mutationFn: () => api.put('/accounting/journal-groups', {
      groups: rows.map((r) => ({
        ...r,
        journalCodes: String(r.journalCodes || '').split(/[,،\s]+/).filter(Boolean),
      })),
    }).then((r) => r.data),
    onSuccess: () => { toast.success(isAr ? 'تم الحفظ' : 'Saved'); refetch() },
  })

  return (
    <ConfigPanelShell
      language={language}
      titleEn="Journal groups"
      titleAr="مجموعات الدفاتر"
      purposeEn="Reporting metadata — group journal books (Sales, Bank, Purchases) for filters and document numbering views."
      purposeAr="بيانات وصفية لتجميع دفاتر القيود (مبيعات، بنك، مشتريات) في التقارير والفلاتر."
      impactEn="Organizes journal books for UI and future consolidated journal reports; does not change posting logic."
      impactAr="ينظم دفاتر القيود للواجهة والتقارير دون تغيير منطق الترحيل."
      actions={(
        <>
          <button type="button" onClick={() => setRows((p) => [...p, { code: '', name: '', nameAr: '', journalCodes: '', sequence: p.length + 1 }])} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold dark:border-dark-600">{isAr ? 'إضافة' : 'Add'}</button>
          <button type="button" disabled={save.isPending || isFetching} onClick={() => save.mutate()} className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{save.isPending ? '…' : (isAr ? 'حفظ' : 'Save')}</button>
        </>
      )}
    >
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-dark-600 dark:bg-dark-800">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-[11px] uppercase text-slate-400 dark:bg-dark-900">
            <tr>
              <th className="px-3 py-2 text-start">{isAr ? 'الرمز' : 'Code'}</th>
              <th className="px-3 py-2 text-start">{isAr ? 'الاسم' : 'Name'}</th>
              <th className="px-3 py-2 text-start">{isAr ? 'دفاتر (رموز)' : 'Journal codes'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/5">
            {rows.map((row, i) => (
              <tr key={i}>
                <td className="px-3 py-2"><input value={row.code || ''} onChange={(e) => setRows((p) => p.map((r, idx) => (idx === i ? { ...r, code: e.target.value.toUpperCase() } : r)))} className="w-24 rounded-lg border border-slate-200 px-2 py-1 font-mono text-xs dark:border-dark-600 dark:bg-dark-900" /></td>
                <td className="px-3 py-2"><input value={row.name || ''} onChange={(e) => setRows((p) => p.map((r, idx) => (idx === i ? { ...r, name: e.target.value } : r)))} className="w-full rounded-lg border border-slate-200 px-2 py-1 dark:border-dark-600 dark:bg-dark-900" /></td>
                <td className="px-3 py-2"><input value={row.journalCodes || ''} onChange={(e) => setRows((p) => p.map((r, idx) => (idx === i ? { ...r, journalCodes: e.target.value } : r)))} placeholder="SAL, BNK" className="w-full rounded-lg border border-slate-200 px-2 py-1 font-mono text-xs dark:border-dark-600 dark:bg-dark-900" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ConfigPanelShell>
  )
}

export function PaymentProvidersPanel({ language }) {
  const isAr = language === 'ar'
  const { data: journals = [] } = useQuery({
    queryKey: ['accounting-journal-books'],
    queryFn: () => api.get('/accounting/journal-books').then((r) => r.data || []),
  })
  const { data, refetch, isFetching } = useQuery({
    queryKey: ['accounting-payment-providers'],
    queryFn: () => api.get('/accounting/payment-providers').then((r) => r.data),
  })
  const [rows, setRows] = useState([])
  useEffect(() => {
    if (data?.providers) setRows(data.providers.map((r) => ({ ...r })))
  }, [data?.providers])
  const save = useMutation({
    mutationFn: () => api.put('/accounting/payment-providers', { providers: rows }).then((r) => r.data),
    onSuccess: () => { toast.success(isAr ? 'تم الحفظ' : 'Saved'); refetch() },
  })
  const bankJournals = (Array.isArray(journals) ? journals : []).filter((j) => j.type === 'bank')
  const webhookBase = typeof window !== 'undefined' ? `${window.location.origin}/api/accounting/webhooks/payment` : '/api/accounting/webhooks/payment'

  return (
    <ConfigPanelShell
      language={language}
      titleEn="Payment providers"
      titleAr="بوابات الدفع"
      purposeEn="Map external gateways (Moyasar, Stripe, etc.) to bank journals for automated invoice settlement."
      purposeAr="ربط بوابات الدفع بدفاتر البنوك لتسوية الفواتير تلقائياً."
      impactEn="Webhook handlers use journalCode to post customer receipts and mark invoices paid on successful capture."
      impactAr="معالجات webhook تستخدم دفتر البنك لترحيل المقبوضات وتحديث حالة الفاتورة."
      actions={(
        <>
          <button type="button" onClick={() => setRows((p) => [...p, { provider: '', name: '', nameAr: '', journalCode: '', active: true, webhookSecret: '' }])} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold dark:border-dark-600">{isAr ? 'إضافة' : 'Add'}</button>
          <button type="button" disabled={save.isPending || isFetching} onClick={() => save.mutate()} className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{save.isPending ? '…' : (isAr ? 'حفظ' : 'Save')}</button>
        </>
      )}
    >
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-dark-600 dark:bg-dark-800">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-[11px] uppercase text-slate-400 dark:bg-dark-900">
            <tr>
              <th className="px-3 py-2">{isAr ? 'مفعّل' : 'On'}</th>
              <th className="px-3 py-2">{isAr ? 'المزود' : 'Provider'}</th>
              <th className="px-3 py-2">{isAr ? 'الاسم' : 'Name'}</th>
              <th className="px-3 py-2">{isAr ? 'دفتر البنك' : 'Bank journal'}</th>
              <th className="px-3 py-2">{isAr ? 'Webhook URL' : 'Webhook URL'}</th>
              <th className="px-3 py-2">{isAr ? 'السر' : 'Secret'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/5">
            {rows.map((row, i) => (
              <tr key={i}>
                <td className="px-3 py-2"><input type="checkbox" checked={Boolean(row.active)} onChange={(e) => setRows((p) => p.map((r, idx) => (idx === i ? { ...r, active: e.target.checked } : r)))} /></td>
                <td className="px-3 py-2"><input value={row.provider || ''} onChange={(e) => setRows((p) => p.map((r, idx) => (idx === i ? { ...r, provider: e.target.value } : r)))} placeholder="stripe" className="w-28 rounded-lg border border-slate-200 px-2 py-1 font-mono text-xs dark:border-dark-600 dark:bg-dark-900" /></td>
                <td className="px-3 py-2"><input value={row.name || ''} onChange={(e) => setRows((p) => p.map((r, idx) => (idx === i ? { ...r, name: e.target.value } : r)))} className="w-full rounded-lg border border-slate-200 px-2 py-1 dark:border-dark-600 dark:bg-dark-900" /></td>
                <td className="px-3 py-2">
                  <select value={row.journalCode || ''} onChange={(e) => setRows((p) => p.map((r, idx) => (idx === i ? { ...r, journalCode: e.target.value } : r)))} className="rounded-lg border border-slate-200 px-2 py-1 text-xs dark:border-dark-600 dark:bg-dark-900">
                    <option value="">—</option>
                    {bankJournals.map((j) => <option key={j._id} value={j.code}>{j.code}</option>)}
                  </select>
                </td>
                <td className="px-3 py-2">
                  <code className="block max-w-[220px] truncate rounded bg-slate-50 px-2 py-1 font-mono text-[10px] text-slate-600 dark:bg-dark-900 dark:text-slate-300" title={row.provider ? `${webhookBase}/${row.provider}` : ''}>
                    {row.provider ? `${webhookBase}/${row.provider}` : '—'}
                  </code>
                </td>
                <td className="px-3 py-2"><input value={row.webhookSecret || ''} onChange={(e) => setRows((p) => p.map((r, idx) => (idx === i ? { ...r, webhookSecret: e.target.value } : r)))} className="w-full rounded-lg border border-slate-200 px-2 py-1 font-mono text-[10px] dark:border-dark-600 dark:bg-dark-900" placeholder="X-Webhook-Secret" /></td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">{isAr ? 'أضف مزود دفع' : 'Add a payment provider'}</td></tr>}
          </tbody>
        </table>
      </div>
    </ConfigPanelShell>
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

