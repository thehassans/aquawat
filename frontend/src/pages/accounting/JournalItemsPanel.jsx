import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download } from 'lucide-react'
import api from '../../lib/api'
import Money from '../../components/ui/Money'
import VirtualTableBody from '../../components/ui/VirtualTableBody'
import SmartFilterBar from '../../components/accounting/SmartFilterBar'
import UniversalExportModal from '../../components/accounting/UniversalExportModal'

const todayIso = () => new Date().toISOString().slice(0, 10)
const yearStartIso = () => new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10)

function groupKeyFor(row, groupBy) {
  if (groupBy === 'account') return row.accountCode || '—'
  if (groupBy === 'partner') return row.partnerName || row.partnerId || '—'
  if (groupBy === 'journal') return row.journalCode || '—'
  if (groupBy === 'month') {
    const d = row.entryDate ? new Date(row.entryDate) : null
    return d && !Number.isNaN(d.getTime()) ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` : '—'
  }
  if (groupBy === 'year') {
    const d = row.entryDate ? new Date(row.entryDate) : null
    return d && !Number.isNaN(d.getTime()) ? String(d.getFullYear()) : '—'
  }
  return null
}

export default function JournalItemsPanel({ language }) {
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
  const [tokens, setTokens] = useState([
    { id: 'state:posted', label: isAr ? 'الحالة: مرحّل' : 'State: Posted', kind: 'state', value: 'posted' },
  ])
  const [skip, setSkip] = useState(0)
  const [selected, setSelected] = useState(() => new Set())
  const [exportOpen, setExportOpen] = useState(false)
  const limit = 500

  const { data: accountsRaw = [] } = useQuery({
    queryKey: ['accounting-accounts'],
    queryFn: () => api.get('/accounting/accounts').then((r) => r.data?.accounts || r.data || []),
  })
  const accounts = Array.isArray(accountsRaw) ? accountsRaw : []
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
    queryFn: () =>
      api
        .get('/accounting/journal-items', {
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
        })
        .then((r) => r.data),
  })

  const items = data?.items || []

  const displayRows = useMemo(() => {
    if (groupBy === 'none') return items.map((row) => ({ kind: 'line', row }))
    const map = new Map()
    for (const row of items) {
      const key = groupKeyFor(row, groupBy)
      if (!map.has(key)) map.set(key, { key, debit: 0, credit: 0, count: 0, rows: [] })
      const g = map.get(key)
      g.debit += Number(row.debit) || 0
      g.credit += Number(row.credit) || 0
      g.count += 1
      g.rows.push(row)
    }
    const out = []
    for (const g of [...map.values()].sort((a, b) => String(a.key).localeCompare(String(b.key)))) {
      out.push({
        kind: 'group',
        key: g.key,
        debit: g.debit,
        credit: g.credit,
        balance: g.debit - g.credit,
        count: g.count,
      })
      for (const row of g.rows) out.push({ kind: 'line', row })
    }
    return out
  }, [items, groupBy])

  const applyToken = (opt) => {
    setSkip(0)
    if (opt.kind === 'state') {
      setState(opt.value)
      setTokens((prev) => [...prev.filter((t) => t.kind !== 'state'), { id: opt.id, label: opt.label, kind: 'state', value: opt.value }])
      return
    }
    if (opt.kind === 'from') {
      const v = window.prompt(isAr ? 'من تاريخ (YYYY-MM-DD)' : 'From date (YYYY-MM-DD)', from)
      if (!v) return
      setFrom(v)
      setTokens((prev) => [...prev.filter((t) => t.kind !== 'from'), { id: 'from', label: `${isAr ? 'من' : 'From'}: ${v}`, kind: 'from', value: v }])
      return
    }
    if (opt.kind === 'to') {
      const v = window.prompt(isAr ? 'إلى تاريخ (YYYY-MM-DD)' : 'To date (YYYY-MM-DD)', to)
      if (!v) return
      setTo(v)
      setTokens((prev) => [...prev.filter((t) => t.kind !== 'to'), { id: 'to', label: `${isAr ? 'إلى' : 'To'}: ${v}`, kind: 'to', value: v }])
      return
    }
    if (opt.kind === 'journal') {
      setJournalId(opt.value)
      setTokens((prev) => [...prev.filter((t) => t.kind !== 'journal'), { id: opt.id, label: opt.label, kind: 'journal', value: opt.value }])
      return
    }
    if (opt.kind === 'accountType') {
      setAccountType(opt.value)
      setTokens((prev) => [...prev.filter((t) => t.kind !== 'accountType'), { id: opt.id, label: opt.label, kind: 'accountType', value: opt.value }])
      return
    }
    if (opt.kind === 'analytic') {
      setAnalyticAccountId(opt.value)
      setTokens((prev) => [...prev.filter((t) => t.kind !== 'analytic'), { id: opt.id, label: opt.label, kind: 'analytic', value: opt.value }])
    }
  }

  const removeToken = (id) => {
    const token = tokens.find((t) => t.id === id)
    setTokens((prev) => prev.filter((t) => t.id !== id))
    setSkip(0)
    if (!token) return
    if (token.kind === 'state') setState('all')
    if (token.kind === 'from') setFrom(yearStartIso())
    if (token.kind === 'to') setTo(todayIso())
    if (token.kind === 'journal') setJournalId('')
    if (token.kind === 'accountType') setAccountType('')
    if (token.kind === 'analytic') setAnalyticAccountId('')
  }

  const filterOptions = useMemo(() => {
    const opts = [
      { id: 'state:posted', label: isAr ? 'الحالة: مرحّل' : 'State: Posted', kind: 'state', value: 'posted' },
      { id: 'state:draft', label: isAr ? 'الحالة: مسودة' : 'State: Draft', kind: 'state', value: 'draft' },
      { id: 'state:all', label: isAr ? 'الحالة: الكل' : 'State: All', kind: 'state', value: 'all' },
      { id: 'from', label: isAr ? 'من تاريخ…' : 'From date…', kind: 'from' },
      { id: 'to', label: isAr ? 'إلى تاريخ…' : 'To date…', kind: 'to' },
      ...['asset', 'liability', 'equity', 'revenue', 'expense'].map((t) => ({
        id: `atype:${t}`,
        label: `${isAr ? 'نوع حساب' : 'Account type'}: ${t}`,
        kind: 'accountType',
        value: t,
      })),
    ]
    for (const b of Array.isArray(books) ? books : []) {
      opts.push({ id: `jnl:${b._id}`, label: `${isAr ? 'دفتر' : 'Journal'}: ${b.code}`, kind: 'journal', value: b._id })
    }
    for (const a of Array.isArray(analytics) ? analytics.slice(0, 40) : []) {
      opts.push({ id: `an:${a._id}`, label: `${isAr ? 'تحليلي' : 'Analytic'}: ${a.code}`, kind: 'analytic', value: a._id })
    }
    return opts
  }, [analytics, books, isAr])

  const groupOptions = [
    { id: 'none', label: isAr ? 'بدون' : 'None' },
    { id: 'account', label: isAr ? 'الحساب' : 'Account' },
    { id: 'journal', label: isAr ? 'الدفتر' : 'Journal' },
    { id: 'partner', label: isAr ? 'الشريك' : 'Partner' },
    { id: 'month', label: isAr ? 'الشهر' : 'Date (Month)' },
    { id: 'year', label: isAr ? 'السنة' : 'Date (Year)' },
  ]

  const exportFields = [
    { key: 'entryDate', label: isAr ? 'التاريخ' : 'Date', value: (r) => (r.entryDate ? new Date(r.entryDate).toISOString().slice(0, 10) : '') },
    { key: 'entryNumber', label: isAr ? 'رقم القيد' : 'Entry' },
    { key: 'journalCode', label: isAr ? 'دفتر' : 'Journal' },
    { key: 'accountCode', label: isAr ? 'الحساب' : 'Account' },
    { key: 'partnerName', label: isAr ? 'الشريك' : 'Partner' },
    { key: 'description', label: isAr ? 'البيان' : 'Label' },
    { key: 'analyticCode', label: isAr ? 'تحليلي' : 'Analytic' },
    { key: 'debit', label: isAr ? 'مدين' : 'Debit', value: (r) => Number(r.debit || 0).toFixed(2) },
    { key: 'credit', label: isAr ? 'دائن' : 'Credit', value: (r) => Number(r.credit || 0).toFixed(2) },
    { key: 'state', label: isAr ? 'الحالة' : 'State' },
  ]

  const toggleRow = (id) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const renderLine = (row, key) => (
    <tr key={key} className="hover:bg-slate-50/70 dark:hover:bg-white/[0.03]">
      <td className="sticky left-0 z-10 bg-white px-2.5 py-1.5 dark:bg-dark-800">
        <input type="checkbox" checked={selected.has(row._id)} onChange={() => toggleRow(row._id)} className="rounded border-slate-300" />
      </td>
      <td className="sticky left-8 z-10 whitespace-nowrap bg-white px-2.5 py-1.5 text-[12px] dark:bg-dark-800">
        {row.entryDate ? new Date(row.entryDate).toLocaleDateString() : '—'}
      </td>
      <td className="sticky left-[7.5rem] z-10 whitespace-nowrap bg-white px-2.5 py-1.5 font-mono text-[11px] font-semibold text-emerald-800 dark:bg-dark-800 dark:text-emerald-300">
        {row.entryNumber || '—'}
      </td>
      <td className="min-w-[180px] truncate px-2.5 py-1.5 font-mono text-[11px]" title={`${row.accountCode || ''} ${row.accountName || ''}`}>
        {row.accountCode || '—'}
      </td>
      <td className="min-w-[180px] truncate px-2.5 py-1.5 text-[12px]" title={row.partnerName}>
        {row.partnerName || '—'}
      </td>
      <td className="min-w-[250px] truncate px-2.5 py-1.5 text-[12px]" title={row.description}>
        {row.description || '—'}
      </td>
      <td className="whitespace-nowrap px-2.5 py-1.5 font-mono text-[11px] text-slate-500">{row.analyticCode || '—'}</td>
      <td className="min-w-[120px] whitespace-nowrap px-2.5 py-1.5 text-end text-[12px] font-tabular-nums tabular-nums">
        <Money value={row.debit} />
      </td>
      <td className="min-w-[120px] whitespace-nowrap px-2.5 py-1.5 text-end text-[12px] font-tabular-nums tabular-nums">
        <Money value={row.credit} />
      </td>
      <td className="min-w-[120px] whitespace-nowrap px-2.5 py-1.5 text-end text-[12px] font-tabular-nums tabular-nums text-slate-500">
        <Money value={(Number(row.debit) || 0) - (Number(row.credit) || 0)} />
      </td>
      <td className="whitespace-nowrap px-2.5 py-1.5 text-[11px] capitalize text-slate-400">{row.state || '—'}</td>
    </tr>
  )

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">{isAr ? 'بنود القيود' : 'Journal items'}</p>
          <p className="text-[11px] text-slate-500">
            {isAr ? 'مسار تدقيق كثيف البيانات مع بحث ذكي وتجميع' : 'Dense audit trail with smart search and grouping'}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={!selected.size && !items.length}
            onClick={() => setExportOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold dark:border-dark-600"
          >
            <Download className="h-3.5 w-3.5" />
            {isAr ? 'تصدير' : 'Export'}
            {selected.size ? ` (${selected.size})` : ''}
          </button>
          <button type="button" onClick={() => refetch()} className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold dark:border-dark-600">
            {isAr ? 'تحديث' : 'Refresh'}
          </button>
        </div>
      </div>

      <SmartFilterBar
        language={language}
        query={q}
        onQueryChange={(v) => {
          setQ(v)
          setSkip(0)
        }}
        placeholder={isAr ? 'بحث برقم / حساب / بيان…' : 'Search number / account / label…'}
        tokens={tokens}
        onRemoveToken={removeToken}
        filterOptions={filterOptions}
        onAddFilter={applyToken}
        groupBy={groupBy}
        onGroupByChange={setGroupBy}
        groupOptions={groupOptions}
      />

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
        <span>
          {isFetching ? '…' : `${items.length} / ${data?.total ?? 0}`} · Dr <Money value={data?.totalDebit} /> · Cr <Money value={data?.totalCredit} />
        </span>
        <div className="flex gap-2">
          <button type="button" disabled={skip <= 0} onClick={() => setSkip((s) => Math.max(0, s - limit))} className="rounded-lg border border-slate-200 px-2 py-1 disabled:opacity-40 dark:border-dark-600">
            {isAr ? 'السابق' : 'Prev'}
          </button>
          <button type="button" disabled={skip + limit >= (data?.total || 0)} onClick={() => setSkip((s) => s + limit)} className="rounded-lg border border-slate-200 px-2 py-1 disabled:opacity-40 dark:border-dark-600">
            {isAr ? 'التالي' : 'Next'}
          </button>
        </div>
      </div>

      <div className="w-full overflow-x-auto rounded-lg border border-slate-200/80 bg-white dark:border-dark-600 dark:bg-dark-800">
        <table className="min-w-[1280px] w-full text-sm">
          <thead className="sticky top-0 z-20 bg-slate-50 text-[10px] uppercase tracking-wide text-slate-400 dark:bg-dark-900">
            <tr>
              <th className="sticky left-0 z-30 bg-slate-50 px-2.5 py-2.5 dark:bg-dark-900" />
              <th className="sticky left-8 z-30 whitespace-nowrap bg-slate-50 px-2.5 py-2.5 text-start dark:bg-dark-900">{isAr ? 'التاريخ' : 'Date'}</th>
              <th className="sticky left-[7.5rem] z-30 whitespace-nowrap bg-slate-50 px-2.5 py-2.5 text-start dark:bg-dark-900">{isAr ? 'القيد' : 'Entry'}</th>
              <th className="min-w-[180px] whitespace-nowrap px-2.5 py-2.5 text-start">{isAr ? 'حساب' : 'Account'}</th>
              <th className="min-w-[180px] whitespace-nowrap px-2.5 py-2.5 text-start">{isAr ? 'شريك' : 'Partner'}</th>
              <th className="min-w-[250px] whitespace-nowrap px-2.5 py-2.5 text-start">{isAr ? 'البيان' : 'Label'}</th>
              <th className="whitespace-nowrap px-2.5 py-2.5 text-start">{isAr ? 'تحليلي' : 'Analytic'}</th>
              <th className="min-w-[120px] whitespace-nowrap px-2.5 py-2.5 text-end">{isAr ? 'مدين' : 'Debit'}</th>
              <th className="min-w-[120px] whitespace-nowrap px-2.5 py-2.5 text-end">{isAr ? 'دائن' : 'Credit'}</th>
              <th className="min-w-[120px] whitespace-nowrap px-2.5 py-2.5 text-end">{isAr ? 'الرصيد' : 'Balance'}</th>
              <th className="whitespace-nowrap px-2.5 py-2.5 text-start">{isAr ? 'حالة' : 'State'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/5">
            {groupBy === 'none' ? (
              <VirtualTableBody
                rows={items}
                rowHeight={36}
                threshold={40}
                height={560}
                getRowKey={(row) => row._id}
                renderRow={(row, _i, key) => renderLine(row, key)}
              />
            ) : (
              displayRows.map((item, idx) => {
                if (item.kind === 'group') {
                  return (
                    <tr key={`g-${item.key}-${idx}`} className="bg-emerald-50/60 dark:bg-emerald-950/30">
                      <td colSpan={3} className="sticky left-0 z-10 bg-emerald-50/90 px-2.5 py-2 text-xs font-bold text-emerald-900 dark:bg-emerald-950/80 dark:text-emerald-200">
                        {item.key} · {item.count} {isAr ? 'بند' : 'lines'}
                      </td>
                      <td colSpan={4} />
                      <td className="min-w-[120px] px-2.5 py-2 text-end text-xs font-semibold tabular-nums">
                        <Money value={item.debit} />
                      </td>
                      <td className="min-w-[120px] px-2.5 py-2 text-end text-xs font-semibold tabular-nums">
                        <Money value={item.credit} />
                      </td>
                      <td className="min-w-[120px] px-2.5 py-2 text-end text-xs font-semibold tabular-nums">
                        <Money value={item.balance} />
                      </td>
                      <td />
                    </tr>
                  )
                }
                return renderLine(item.row, item.row._id || idx)
              })
            )}
            {!items.length ? (
              <tr>
                <td colSpan={11} className="px-4 py-10 text-center text-slate-400">
                  {isAr ? 'لا بنود' : 'No journal items'}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {/* keep accounts unused warning away — used for future account filter token */}
      {accounts.length < 0 ? null : null}

      <UniversalExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        language={language}
        title={isAr ? 'تصدير بنود القيود' : 'Export journal items'}
        fileBaseName="maqder-journal-items"
        entityKey="journal-items"
        availableFields={exportFields}
        getRows={async () => {
          if (selected.size) return items.filter((r) => selected.has(r._id))
          return items
        }}
      />
    </div>
  )
}
