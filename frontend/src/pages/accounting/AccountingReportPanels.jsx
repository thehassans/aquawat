import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '../../lib/api'
import Money from '../../components/ui/Money'
import { useAccountingQuery } from '../../hooks/useAccountingQuery'
import { ReportFilterRibbon, compareRange, variance } from './ReportFilterRibbon'
import AccountingQueryState from './AccountingQueryState'
import { extractDateOnly } from '../../lib/dateOnly'

const todayIso = () => extractDateOnly(new Date()) || new Date().toISOString().slice(0, 10)
const yearStartIso = () => {
  const y = Number((extractDateOnly(new Date()) || '').slice(0, 4)) || new Date().getFullYear()
  return `${y}-01-01`
}

const moneyCols = (isAr) => [
  { key: 'amount', label: isAr ? 'المبلغ' : 'Amount', value: (r) => Number(r.amount || r.balance || 0).toFixed(2) },
  { key: 'prior', label: isAr ? 'الفترة المقارنة' : 'Compare', value: (r) => (r.prior == null ? '' : Number(r.prior).toFixed(2)) },
  { key: 'varAmt', label: isAr ? 'الفرق' : 'Variance', value: (r) => (r.varAmt == null ? '' : Number(r.varAmt).toFixed(2)) },
  { key: 'varPct', label: isAr ? '%' : '%', value: (r) => (r.varPct == null ? '' : `${r.varPct}%`) },
]

function sourceHref(line) {
  const model = String(line?.sourceModel || '').toLowerCase()
  const id = line?.sourceId
  if (!id) return null
  if (model.includes('invoice')) return `/app/dashboard/accounting/invoices/${id}`
  if (model === 'invoice') return `/app/dashboard/accounting/invoices/${id}`
  if (model.includes('bill') || model.includes('purchase')) return `/app/dashboard/accounting/bills/${id}`
  if (model.includes('payment') || model.includes('voucher')) return `/app/dashboard/accounting/payments`
  return null
}

function VarianceCells({ current, prior, show }) {
  if (!show) return null
  const v = variance(current, prior)
  return (
    <>
      <td className="px-3 py-2 text-end text-slate-500"><Money value={prior} /></td>
      <td className={`px-3 py-2 text-end font-medium ${v.amount >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
        <Money value={v.amount} />
      </td>
      <td className="px-3 py-2 text-end text-xs text-slate-500">{v.pct}%</td>
    </>
  )
}

function HorizontalGroupsSection({
  language,
  groups,
  amountKey = 'amount',
  priorMap,
  showVar,
  onAccountClick,
  titleEn = 'Horizontal groups',
  titleAr = 'المجموعات الأفقية',
  purposeEn = 'Collapsible tree by account groups defined in Configuration.',
  purposeAr = 'عرض شجري حسب مجموعات الحسابات المعرّفة في الإعدادات.',
}) {
  const isAr = language === 'ar'
  const [expanded, setExpanded] = useState(() => ({}))

  if (!groups?.length) return null

  const getAmount = (row) => Number(row?.[amountKey] ?? row?.balance ?? row?.amount ?? 0)

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-dark-600 dark:bg-dark-800">
      <div className="border-b border-slate-100 px-5 py-4 dark:border-white/10">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          {isAr ? titleAr : titleEn}
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          {isAr ? purposeAr : purposeEn}
        </p>
      </div>
      <div className="divide-y divide-slate-100 dark:divide-white/5">
        {groups.map((group) => {
          const key = group.code || group.name
          const open = expanded[key] !== false
          return (
            <div key={key}>
              <button
                type="button"
                onClick={() => setExpanded((p) => ({ ...p, [key]: !open }))}
                className="flex w-full items-center justify-between px-5 py-3 text-start hover:bg-slate-50/80 dark:hover:bg-white/[0.03]"
              >
                <span className="font-semibold text-emerald-900 dark:text-emerald-200">
                  {isAr ? (group.nameAr || group.name) : group.name}
                  <span className="ms-2 font-mono text-[10px] font-normal text-slate-400">{group.code}</span>
                </span>
                <span className="text-sm font-semibold"><Money value={group.amount} /></span>
              </button>
              {open ? (
                <table className="min-w-full text-sm">
                  <tbody className="divide-y divide-slate-50 dark:divide-white/5">
                    {(group.accounts || []).map((row) => (
                      <tr
                        key={String(row._id || row.code)}
                        className={onAccountClick && row.accountId ? 'cursor-pointer hover:bg-emerald-50/60 dark:hover:bg-white/[0.04]' : ''}
                        onClick={() => onAccountClick?.(row)}
                      >
                        <td className="px-8 py-2 text-slate-600 dark:text-slate-300">
                          <span className="font-mono text-xs text-emerald-800">{row.code}</span>
                          {' · '}
                          {isAr ? (row.nameAr || row.name) : row.name}
                        </td>
                        <td className="px-4 py-2 text-end font-medium"><Money value={getAmount(row)} /></td>
                        <VarianceCells
                          current={getAmount(row)}
                          prior={priorMap?.get(row.code) ?? priorMap?.get(String(row._id))}
                          show={showVar}
                        />
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function CustomReportLinesSection({ language, lines }) {
  const isAr = language === 'ar'
  if (!lines?.length) return null
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-dark-600 dark:bg-dark-800">
      <div className="border-b border-slate-100 px-5 py-4 dark:border-white/10">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          {isAr ? 'بنود مخصصة (إعدادات)' : 'Custom lines (configuration)'}
        </h3>
      </div>
      <table className="min-w-full text-sm">
        <tbody className="divide-y divide-slate-100 dark:divide-white/5">
          {lines.map((row) => (
            <tr key={row.code}>
              <td className="px-5 py-2">
                <span className="font-mono text-[10px] text-slate-400">{row.code}</span>
                {' · '}
                {isAr ? (row.labelAr || row.label) : row.label}
              </td>
              <td className="px-5 py-2 text-end font-semibold"><Money value={row.amount} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function BalanceSheetPanel({ language }) {
  const isAr = language === 'ar'
  const navigate = useNavigate()
  const [asOf, setAsOf] = useState(todayIso())
  const [comparison, setComparison] = useState('none')
  const [expanded, setExpanded] = useState({ assets: true, liabilities: true, equity: true })

  const compare = useMemo(() => {
    if (comparison === 'none') return null
    return compareRange(asOf, asOf, comparison === 'previous_year' ? 'previous_year' : 'previous_period')
  }, [asOf, comparison])

  const { data, isFetching, isLoading, isError, error, refetch } = useAccountingQuery({
    queryKey: ['accounting-balance', asOf],
    queryFn: () => api.get('/accounting/reports/balance-sheet', { params: { asOf } }).then((r) => r.data),
  })
  const { data: prior } = useAccountingQuery({
    queryKey: ['accounting-balance-prior', compare?.asOf],
    queryFn: () => api.get('/accounting/reports/balance-sheet', { params: { asOf: compare.asOf } }).then((r) => r.data),
    enabled: Boolean(compare?.asOf),
  })

  const priorMap = useMemo(() => {
    const m = new Map()
    for (const section of ['assets', 'liabilities', 'equity']) {
      for (const row of prior?.[section] || []) m.set(row.code, row.balance)
    }
    return m
  }, [prior])

  const showVar = comparison !== 'none' && Boolean(prior)

  const exportRows = () => {
    const rows = []
    for (const [section, label] of [
      ['assets', isAr ? 'أصول' : 'Assets'],
      ['liabilities', isAr ? 'التزامات' : 'Liabilities'],
      ['equity', isAr ? 'حقوق ملكية' : 'Equity'],
    ]) {
      for (const r of data?.[section] || []) {
        const p = priorMap.get(r.code)
        const v = variance(r.balance, p)
        rows.push({
          section: label,
          code: r.code,
          name: isAr ? (r.nameAr || r.name) : r.name,
          amount: r.balance,
          prior: p,
          varAmt: showVar ? v.amount : null,
          varPct: showVar ? v.pct : null,
        })
      }
    }
    return rows
  }

  const openGl = (row) => {
    if (!row?.accountId) return
    navigate(`/app/dashboard/accounting/general-ledger?accountId=${row.accountId}&to=${asOf}`)
  }

  const Section = ({ id, title, rows, total, tone }) => (
    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-dark-600 dark:bg-dark-800">
      <button
        type="button"
        onClick={() => setExpanded((p) => ({ ...p, [id]: !p[id] }))}
        className="flex w-full items-center justify-between border-b border-slate-100 px-5 py-4 text-start dark:border-white/10"
      >
        <h3 className={`font-semibold ${tone}`}>{title}</h3>
        <span className="text-sm font-semibold"><Money value={total} /></span>
      </button>
      {expanded[id] ? (
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-[11px] uppercase text-slate-400 dark:bg-dark-900">
            <tr>
              <th className="px-4 py-2 text-start">{isAr ? 'الحساب' : 'Account'}</th>
              <th className="px-3 py-2 text-end">{isAr ? 'الرصيد' : 'Balance'}</th>
              {showVar ? (
                <>
                  <th className="px-3 py-2 text-end">{isAr ? 'مقارنة' : 'Compare'}</th>
                  <th className="px-3 py-2 text-end">{isAr ? 'فرق' : 'Var'}</th>
                  <th className="px-3 py-2 text-end">%</th>
                </>
              ) : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/5">
            {(rows || []).map((r) => (
              <tr
                key={r.code}
                className={r.accountId ? 'cursor-pointer hover:bg-emerald-50/60 dark:hover:bg-white/[0.04]' : ''}
                onClick={() => openGl(r)}
              >
                <td className="px-4 py-2">
                  <span className="font-mono text-xs text-emerald-800">{r.code}</span>
                  {' · '}
                  {isAr ? (r.nameAr || r.name) : r.name}
                </td>
                <td className="px-3 py-2 text-end font-semibold"><Money value={r.balance} /></td>
                <VarianceCells current={r.balance} prior={priorMap.get(r.code)} show={showVar} />
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </div>
  )

  return (
    <div className="space-y-4">
      <ReportFilterRibbon
        language={language}
        mode="asOf"
        asOf={asOf}
        setAsOf={setAsOf}
        comparison={comparison}
        setComparison={setComparison}
        showBasis={false}
        title={isAr ? 'الميزانية العمومية' : 'Balance sheet'}
        exportProps={{
          getRows: exportRows,
          columns: [
            { key: 'section', label: isAr ? 'القسم' : 'Section' },
            { key: 'code', label: isAr ? 'الرمز' : 'Code' },
            { key: 'name', label: isAr ? 'الحساب' : 'Account' },
            ...moneyCols(isAr),
          ],
          fileBaseName: 'maqder-balance-sheet',
          title: isAr ? 'الميزانية العمومية' : 'Balance sheet',
        }}
      />
      <AccountingQueryState
        language={language}
        isLoading={isLoading && !data}
        isError={isError}
        error={error}
        onRetry={() => refetch()}
      >
        {isFetching && data ? <p className="text-xs text-slate-400">…</p> : null}
        <div className={`rounded-full px-3 py-1 text-xs font-bold w-fit ${data?.balanced ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
          {data?.balanced ? (isAr ? 'معادلة الميزانية متوازنة' : 'Accounting equation balanced') : (isAr ? 'غير متوازن' : 'Out of balance')}
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <Section id="assets" title={isAr ? 'الأصول' : 'Assets'} rows={data?.assets} total={data?.totalAssets} tone="text-emerald-800" />
          <Section id="liabilities" title={isAr ? 'الالتزامات' : 'Liabilities'} rows={data?.liabilities} total={data?.totalLiabilities} tone="text-amber-800" />
          <Section id="equity" title={isAr ? 'حقوق الملكية' : 'Equity'} rows={data?.equity} total={data?.totalEquity} tone="text-sky-800" />
        </div>
        <HorizontalGroupsSection
          language={language}
          groups={data?.horizontalGroups}
          amountKey="balance"
          priorMap={priorMap}
          showVar={showVar}
          onAccountClick={openGl}
        />
        <HorizontalGroupsSection
          language={language}
          groups={data?.accountGroups}
          amountKey="balance"
          priorMap={priorMap}
          showVar={showVar}
          onAccountClick={openGl}
          titleEn="Account groups"
          titleAr="مجموعات الحسابات"
          purposeEn="P&L and balance sheet sections by account prefix from Configuration."
          purposeAr="أقسام قائمة الدخل والميزانية حسب بادئة الحساب من الإعدادات."
        />
        <CustomReportLinesSection language={language} lines={data?.customReportLines} />
      </AccountingQueryState>
    </div>
  )
}

export function ProfitAndLossPanel({ language }) {
  const isAr = language === 'ar'
  const navigate = useNavigate()
  const [from, setFrom] = useState(yearStartIso())
  const [to, setTo] = useState(todayIso())
  const [comparison, setComparison] = useState('none')
  const [basis, setBasis] = useState('accrual')
  const [analyticAccountId, setAnalyticAccountId] = useState('')

  const { data: analytics = [] } = useAccountingQuery({
    queryKey: ['accounting-analytic-accounts'],
    queryFn: () => api.get('/accounting/analytic-accounts').then((r) => r.data || []),
  })

  const compare = useMemo(() => compareRange(from, to, comparison), [from, to, comparison])

  const { data, isFetching, isLoading, isError, error, refetch } = useAccountingQuery({
    queryKey: ['accounting-pnl', from, to, basis, analyticAccountId],
    queryFn: () => api.get('/accounting/reports/profit-and-loss', {
      params: {
        from,
        to,
        basis,
        analyticAccountId: analyticAccountId || undefined,
      },
    }).then((r) => r.data),
  })
  const { data: prior } = useAccountingQuery({
    queryKey: ['accounting-pnl-prior', compare?.from, compare?.to, basis, analyticAccountId],
    queryFn: () => api.get('/accounting/reports/profit-and-loss', {
      params: {
        from: compare.from,
        to: compare.to,
        basis,
        analyticAccountId: analyticAccountId || undefined,
      },
    }).then((r) => r.data),
    enabled: Boolean(compare),
  })

  const priorMap = useMemo(() => {
    const m = new Map()
    for (const r of [...(prior?.revenue || []), ...(prior?.expenses || [])]) {
      m.set(String(r._id || r.code), r.amount)
    }
    return m
  }, [prior])

  const showVar = comparison !== 'none' && Boolean(prior)

  const openGl = (row) => {
    if (!row?._id) return
    navigate(`/app/dashboard/accounting/general-ledger?accountId=${row._id}&from=${from}&to=${to}`)
  }

  const LineBlock = ({ title, rows, total, tone }) => (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 dark:border-dark-600 dark:bg-dark-800">
      <h3 className={`font-semibold ${tone}`}>{title}</h3>
      <table className="mt-3 min-w-full text-sm">
        <tbody className="divide-y divide-slate-100 dark:divide-white/5">
          {(rows || []).filter((a) => Math.abs(a.amount) > 0.009).map((a) => (
            <tr key={a._id} className="cursor-pointer hover:bg-emerald-50/50 dark:hover:bg-white/[0.04]" onClick={() => openGl(a)}>
              <td className="py-2">{isAr ? (a.nameAr || a.name) : a.name}</td>
              <td className="py-2 text-end font-semibold"><Money value={a.amount} /></td>
              <VarianceCells current={a.amount} prior={priorMap.get(String(a._id))} show={showVar} />
            </tr>
          ))}
          <tr className="font-semibold">
            <td className="border-t border-slate-100 pt-3 dark:border-white/10">{isAr ? 'الإجمالي' : 'Total'}</td>
            <td className="border-t border-slate-100 pt-3 text-end dark:border-white/10"><Money value={total} /></td>
            {showVar ? <td colSpan={3} className="border-t border-slate-100 dark:border-white/10" /> : null}
          </tr>
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
        basis={basis}
        setBasis={setBasis}
        title={isAr ? 'الأرباح والخسائر' : 'Profit & loss'}
        extra={(
          <label className="min-w-[200px] text-xs font-medium text-slate-500">
            {isAr ? 'حساب تحليلي' : 'Analytic account'}
            <select
              value={analyticAccountId}
              onChange={(e) => setAnalyticAccountId(e.target.value)}
              className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-dark-600 dark:bg-dark-900"
            >
              <option value="">{isAr ? 'الكل' : 'All'}</option>
              {analytics.map((a) => (
                <option key={a._id} value={a._id}>{a.code} — {isAr ? (a.nameAr || a.name) : a.name}</option>
              ))}
            </select>
          </label>
        )}
        exportProps={{
          getRows: () => [
            ...(data?.revenue || []).map((r) => ({ section: 'Revenue', name: r.name, amount: r.amount, prior: priorMap.get(String(r._id)), ...variance(r.amount, priorMap.get(String(r._id))) })),
            ...(data?.expenses || []).map((r) => ({ section: 'Expense', name: r.name, amount: r.amount, prior: priorMap.get(String(r._id)), ...variance(r.amount, priorMap.get(String(r._id))) })),
          ].map((r) => ({ ...r, varAmt: r.amount - (r.prior || 0), varPct: variance(r.amount, r.prior).pct })),
          columns: [
            { key: 'section', label: isAr ? 'القسم' : 'Section' },
            { key: 'name', label: isAr ? 'الحساب' : 'Account' },
            ...moneyCols(isAr),
          ],
          fileBaseName: 'maqder-pnl',
          title: isAr ? 'الأرباح والخسائر' : 'Profit & loss',
        }}
      />
      <AccountingQueryState
        language={language}
        isLoading={isLoading && !data}
        isError={isError}
        error={error}
        onRetry={() => refetch()}
      >
        {isFetching && data ? <p className="text-xs text-slate-400">…</p> : null}
        <div className="grid gap-3 sm:grid-cols-4">
          {[
            [isAr ? 'الإيرادات' : 'Revenue', data?.totalRevenue],
            [isAr ? 'مجمل الربح' : 'Gross profit', data?.grossProfit],
            [isAr ? 'المصروفات' : 'Expenses', data?.totalExpenses],
            [isAr ? 'صافي الدخل' : 'Net income', data?.netIncome],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-dark-600 dark:bg-dark-800">
              <p className="text-[11px] uppercase tracking-widest text-slate-400">{label}</p>
              <p className="mt-1 text-lg font-semibold"><Money value={value} /></p>
            </div>
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <LineBlock title={isAr ? 'الإيرادات' : 'Revenue'} rows={data?.revenue} total={data?.totalRevenue} tone="text-emerald-800" />
          <LineBlock title={isAr ? 'المصروفات' : 'Expenses'} rows={data?.expenses} total={data?.totalExpenses} tone="text-rose-700" />
        </div>
        <HorizontalGroupsSection
          language={language}
          groups={data?.horizontalGroups}
          amountKey="amount"
          priorMap={priorMap}
          showVar={showVar}
          onAccountClick={openGl}
        />
        <HorizontalGroupsSection
          language={language}
          groups={data?.accountGroups}
          amountKey="amount"
          priorMap={priorMap}
          showVar={showVar}
          onAccountClick={openGl}
          titleEn="Account groups"
          titleAr="مجموعات الحسابات"
          purposeEn="P&L sections by account prefix from Configuration."
          purposeAr="أقسام قائمة الدخل حسب بادئة الحساب من الإعدادات."
        />
        <CustomReportLinesSection language={language} lines={data?.customReportLines} />
      </AccountingQueryState>
    </div>
  )
}

export function TrialBalancePanel({ language }) {
  const isAr = language === 'ar'
  const navigate = useNavigate()
  const [from, setFrom] = useState(yearStartIso())
  const [to, setTo] = useState(todayIso())
  const [comparison, setComparison] = useState('none')

  const { data, isFetching, isLoading, isError, error, refetch } = useAccountingQuery({
    queryKey: ['accounting-trial', from, to],
    queryFn: () => api.get('/accounting/reports/trial-balance', { params: { from, to } }).then((r) => r.data),
  })

  const compare = useMemo(() => compareRange(from, to, comparison), [from, to, comparison])
  const { data: prior } = useAccountingQuery({
    queryKey: ['accounting-trial-prior', compare?.from, compare?.to],
    queryFn: () => api.get('/accounting/reports/trial-balance', {
      params: { from: compare.from, to: compare.to },
    }).then((r) => r.data),
    enabled: Boolean(compare),
  })
  const priorMap = useMemo(() => {
    const m = new Map()
    for (const r of prior?.rows || []) m.set(r.code, r.endingBalance ?? r.balance)
    return m
  }, [prior])
  const showVar = comparison !== 'none' && Boolean(prior)

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
        title={isAr ? 'ميزان المراجعة' : 'Trial balance'}
        exportProps={{
          getRows: async () => (data?.rows || []).map((r) => ({
            code: r.code,
            name: isAr ? (r.nameAr || r.name) : r.name,
            initial: r.initialBalance,
            debit: r.debit,
            credit: r.credit,
            ending: r.endingBalance ?? r.balance,
          })),
          columns: [
            { key: 'code', label: isAr ? 'الرمز' : 'Code' },
            { key: 'name', label: isAr ? 'الحساب' : 'Account' },
            { key: 'initial', label: isAr ? 'افتتاحي' : 'Initial', value: (r) => Number(r.initial || 0).toFixed(2) },
            { key: 'debit', label: isAr ? 'مدين' : 'Debit', value: (r) => Number(r.debit || 0).toFixed(2) },
            { key: 'credit', label: isAr ? 'دائن' : 'Credit', value: (r) => Number(r.credit || 0).toFixed(2) },
            { key: 'ending', label: isAr ? 'ختامي' : 'Ending', value: (r) => Number(r.ending || 0).toFixed(2) },
          ],
          fileBaseName: 'maqder-trial-balance',
          title: isAr ? 'ميزان المراجعة' : 'Trial balance',
        }}
      />
      <AccountingQueryState
        language={language}
        isLoading={isLoading && !data}
        isError={isError}
        error={error}
        onRetry={() => refetch()}
        skeletonRows={8}
      >
        {isFetching && data ? <p className="text-xs text-slate-400">…</p> : null}
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-dark-600 dark:bg-dark-800">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-white/10">
            <h3 className="font-semibold">{isAr ? 'ميزان المراجعة' : 'Trial balance'}</h3>
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${data?.balanced ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
              {data?.balanced ? (isAr ? 'متوازن' : 'Balanced') : (isAr ? 'غير متوازن' : 'Out of balance')}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="sticky top-[6.75rem] bg-slate-50 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400 dark:bg-dark-900">
                <tr>
                  <th className="px-4 py-3 text-start">{isAr ? 'الرمز' : 'Code'}</th>
                  <th className="px-4 py-3 text-start">{isAr ? 'الحساب' : 'Account'}</th>
                  <th className="px-3 py-3 text-end">{isAr ? 'افتتاحي' : 'Initial'}</th>
                  <th className="px-3 py-3 text-end">{isAr ? 'مدين' : 'Debit'}</th>
                  <th className="px-3 py-3 text-end">{isAr ? 'دائن' : 'Credit'}</th>
                  <th className="px-3 py-3 text-end">{isAr ? 'ختامي' : 'Ending'}</th>
                  {showVar ? <th className="px-3 py-3 text-end">{isAr ? 'فرق' : 'Var'}</th> : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {(data?.rows || []).map((r) => {
                  const ending = r.endingBalance ?? r.balance
                  const v = variance(ending, priorMap.get(r.code))
                  return (
                    <tr
                      key={r.code}
                      className="cursor-pointer hover:bg-emerald-50/50 dark:hover:bg-white/[0.04]"
                      onClick={() => r.accountId && navigate(`/app/dashboard/accounting/general-ledger?accountId=${r.accountId}&from=${from}&to=${to}`)}
                    >
                      <td className="px-4 py-2.5 font-mono text-xs text-emerald-800">{r.code}</td>
                      <td className="px-4 py-2.5">{isAr ? (r.nameAr || r.name) : r.name}</td>
                      <td className="px-3 py-2.5 text-end"><Money value={r.initialBalance} /></td>
                      <td className="px-3 py-2.5 text-end"><Money value={r.debit} /></td>
                      <td className="px-3 py-2.5 text-end"><Money value={r.credit} /></td>
                      <td className="px-3 py-2.5 text-end font-semibold"><Money value={ending} /></td>
                      {showVar ? (
                        <td className={`px-3 py-2.5 text-end text-xs ${v.amount >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                          <Money value={v.amount} />
                        </td>
                      ) : null}
                    </tr>
                  )
                })}
              </tbody>
              <tfoot className="border-t border-slate-200 font-semibold dark:border-white/10">
                <tr>
                  <td className="px-4 py-3" colSpan={3}>{isAr ? 'الإجمالي' : 'Total'}</td>
                  <td className="px-3 py-3 text-end"><Money value={data?.totalDebit} /></td>
                  <td className="px-3 py-3 text-end"><Money value={data?.totalCredit} /></td>
                  <td className="px-3 py-3" colSpan={showVar ? 2 : 1} />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </AccountingQueryState>
    </div>
  )
}

export function JournalAuditReportPanel({ language }) {
  const isAr = language === 'ar'
  const navigate = useNavigate()
  const [from, setFrom] = useState(yearStartIso())
  const [to, setTo] = useState(todayIso())
  const [journalId, setJournalId] = useState('')

  const { data: books = [] } = useAccountingQuery({
    queryKey: ['accounting-journal-books'],
    queryFn: () => api.get('/accounting/journal-books').then((r) => r.data || []),
  })
  const { data, isFetching, isLoading, isError, error, refetch } = useAccountingQuery({
    queryKey: ['accounting-journal-report', from, to, journalId],
    queryFn: () => api.get('/accounting/reports/journal-report', {
      params: { from, to, journalId: journalId || undefined },
    }).then((r) => r.data),
  })

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
        title={isAr ? 'تقرير اليومية' : 'Journal report'}
        extra={(
          <label className="min-w-[200px] text-xs font-medium text-slate-500">
            {isAr ? 'دفتر اليومية' : 'Journal'}
            <select
              value={journalId}
              onChange={(e) => setJournalId(e.target.value)}
              className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-dark-600 dark:bg-dark-900"
            >
              <option value="">{isAr ? 'الكل' : 'All journals'}</option>
              {books.map((b) => (
                <option key={b._id} value={b._id}>{b.code} — {isAr ? (b.nameAr || b.name) : b.name}</option>
              ))}
            </select>
          </label>
        )}
        exportProps={{
          getRows: async () => (data?.rows || []).map((r) => ({
            date: r.entryDate ? new Date(r.entryDate).toISOString().slice(0, 10) : '',
            number: r.entryNumber,
            journal: r.journalCode,
            memo: r.memo,
            debit: r.totalDebit,
            credit: r.totalCredit,
            status: r.status,
          })),
          columns: [
            { key: 'date', label: isAr ? 'التاريخ' : 'Date' },
            { key: 'number', label: isAr ? 'الرقم' : 'Number' },
            { key: 'journal', label: isAr ? 'اليومية' : 'Journal' },
            { key: 'memo', label: isAr ? 'البيان' : 'Memo' },
            { key: 'debit', label: isAr ? 'مدين' : 'Debit', value: (r) => Number(r.debit || 0).toFixed(2) },
            { key: 'credit', label: isAr ? 'دائن' : 'Credit', value: (r) => Number(r.credit || 0).toFixed(2) },
            { key: 'status', label: isAr ? 'الحالة' : 'Status' },
          ],
          fileBaseName: 'maqder-journal-report',
          title: isAr ? 'تقرير اليومية' : 'Journal report',
        }}
      />
      <AccountingQueryState
        language={language}
        isLoading={isLoading && !data}
        isError={isError}
        error={error}
        onRetry={() => refetch()}
        skeletonRows={6}
      >
        {(data?.gaps || []).length ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
            <p className="font-semibold">{isAr ? 'فجوات في التسلسل (تنبيه زاتكا)' : 'Sequence gaps (ZATCA warning)'}</p>
            <ul className="mt-1 list-disc ps-5 text-xs">
              {data.gaps.slice(0, 8).map((g, i) => <li key={i}>{g.message}</li>)}
            </ul>
          </div>
        ) : (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 px-4 py-2 text-xs text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-100">
            {isAr ? 'التسلسل سليم — لا فجوات في النطاق' : 'Sequence intact — no gaps in range'}
            {data?.backdatedCount ? ` · ${data.backdatedCount} ${isAr ? 'قيد بتاريخ سابق' : 'backdated'}` : ''}
          </div>
        )}
        {isFetching && data ? <p className="text-xs text-slate-400">…</p> : null}
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-dark-600 dark:bg-dark-800">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-[11px] uppercase text-slate-400 dark:bg-dark-900">
              <tr>
                <th className="px-4 py-2 text-start">{isAr ? 'التاريخ' : 'Date'}</th>
                <th className="px-4 py-2 text-start">{isAr ? 'الرقم' : 'Number'}</th>
                <th className="px-4 py-2 text-start">{isAr ? 'اليومية' : 'Journal'}</th>
                <th className="px-4 py-2 text-start">{isAr ? 'البيان' : 'Memo'}</th>
                <th className="px-3 py-2 text-end">{isAr ? 'مدين' : 'Debit'}</th>
                <th className="px-3 py-2 text-end">{isAr ? 'دائن' : 'Credit'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {(data?.rows || []).map((r) => {
                const href = sourceHref(r)
                return (
                  <tr
                    key={r.entryId}
                    className={href ? 'cursor-pointer hover:bg-emerald-50/50' : ''}
                    onClick={() => href && navigate(href)}
                  >
                    <td className="px-4 py-2">
                      {r.entryDate ? new Date(r.entryDate).toLocaleDateString() : '—'}
                      {r.isBackdated ? (
                        <span className="ms-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-900/50 dark:text-amber-100">
                          {isAr ? 'تاريخ سابق' : 'backdated'}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs">{r.entryNumber}</td>
                    <td className="px-4 py-2">{r.journalCode || '—'}</td>
                    <td className="px-4 py-2">{r.memo || r.reference || '—'}</td>
                    <td className="px-3 py-2 text-end"><Money value={r.totalDebit} /></td>
                    <td className="px-3 py-2 text-end"><Money value={r.totalCredit} /></td>
                  </tr>
                )
              })}
              {!(data?.rows || []).length && (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400">{isAr ? 'لا قيود' : 'No entries'}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </AccountingQueryState>
    </div>
  )
}

export function SequenceIntegrityReportPanel({ language }) {
  const isAr = language === 'ar'
  const [year, setYear] = useState(String(new Date().getFullYear()))
  const [journalId, setJournalId] = useState('')

  const { data: books = [] } = useAccountingQuery({
    queryKey: ['accounting-journal-books'],
    queryFn: () => api.get('/accounting/journal-books').then((r) => r.data || []),
  })
  const { data, isFetching, isLoading, isError, error, refetch } = useAccountingQuery({
    queryKey: ['accounting-sequence-integrity', year, journalId],
    queryFn: () => api.get('/accounting/reports/sequence-integrity', {
      params: { year, journalId: journalId || undefined },
    }).then((r) => r.data),
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs font-medium text-slate-500">
          {isAr ? 'السنة' : 'Year'}
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="mt-1 block w-28 rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-dark-600 dark:bg-dark-900"
          />
        </label>
        <label className="min-w-[200px] text-xs font-medium text-slate-500">
          {isAr ? 'دفتر اليومية' : 'Journal'}
          <select
            value={journalId}
            onChange={(e) => setJournalId(e.target.value)}
            className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-dark-600 dark:bg-dark-900"
          >
            <option value="">{isAr ? 'الكل' : 'All journals'}</option>
            {books.map((b) => (
              <option key={b._id} value={b._id}>{b.code} — {isAr ? (b.nameAr || b.name) : b.name}</option>
            ))}
          </select>
        </label>
        <p className="pb-2 text-sm text-slate-600 dark:text-slate-300">
          {isAr ? 'سلامة تسلسل القيود (زاتكا)' : 'Sequence integrity (ZATCA)'}
          {data?.summary?.intact ? (
            <span className="ms-2 text-emerald-600">{isAr ? 'سليم' : 'Intact'}</span>
          ) : data ? (
            <span className="ms-2 text-amber-600">
              {data.summary?.totalGaps || 0} {isAr ? 'فجوة' : 'gaps'} · {data.summary?.totalDuplicates || 0} {isAr ? 'تكرار' : 'dupes'}
            </span>
          ) : null}
        </p>
      </div>
      <AccountingQueryState
        language={language}
        isLoading={isLoading && !data}
        isError={isError}
        error={error}
        onRetry={() => refetch()}
        skeletonRows={4}
      >
        {isFetching && data ? <p className="text-xs text-slate-400">…</p> : null}
        <div className="space-y-3">
          {(data?.books || []).map((b) => (
            <div
              key={b.series}
              className={`rounded-2xl border px-4 py-3 text-sm ${
                b.ok
                  ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/20'
                  : 'border-amber-200 bg-amber-50/60 dark:border-amber-900 dark:bg-amber-950/20'
              }`}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-semibold font-mono">{b.series}</p>
                <p className="text-xs text-slate-500">
                  {b.count} {isAr ? 'قيد' : 'entries'}
                  {b.minSeq != null ? ` · ${String(b.minSeq).padStart(4, '0')}–${String(b.maxSeq).padStart(4, '0')}` : ''}
                  {b.backdatedCount ? ` · ${b.backdatedCount} ${isAr ? 'تاريخ سابق' : 'backdated'}` : ''}
                </p>
              </div>
              {(b.gaps || []).length ? (
                <ul className="mt-2 list-disc ps-5 text-xs text-amber-900 dark:text-amber-100">
                  {b.gaps.map((g, i) => <li key={`g-${i}`}>{g.message}</li>)}
                </ul>
              ) : null}
              {(b.duplicates || []).length ? (
                <ul className="mt-2 list-disc ps-5 text-xs text-rose-800 dark:text-rose-200">
                  {b.duplicates.map((d, i) => <li key={`d-${i}`}>{d.message}</li>)}
                </ul>
              ) : null}
              {(b.dateOrderIssues || []).length ? (
                <ul className="mt-2 list-disc ps-5 text-xs text-slate-600 dark:text-slate-300">
                  {b.dateOrderIssues.slice(0, 5).map((d, i) => (
                    <li key={`o-${i}`}>
                      {d.message}
                      {d.isBackdated ? ` (${isAr ? 'معلّم' : 'flagged'})` : ''}
                    </li>
                  ))}
                </ul>
              ) : null}
              {b.ok && !(b.dateOrderIssues || []).length ? (
                <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">{isAr ? 'لا فجوات أو تكرار' : 'No gaps or duplicates'}</p>
              ) : null}
            </div>
          ))}
          {!(data?.books || []).length && (
            <p className="py-8 text-center text-slate-400">{isAr ? 'لا سلاسل لهذه السنة' : 'No series for this year'}</p>
          )}
        </div>
      </AccountingQueryState>
    </div>
  )
}

export function JournalBookMappingReportPanel({ language }) {
  const isAr = language === 'ar'
  const [from, setFrom] = useState(yearStartIso())
  const [to, setTo] = useState(todayIso())
  const [onlyMismatches, setOnlyMismatches] = useState(true)

  const { data, isFetching, isLoading, isError, error, refetch } = useAccountingQuery({
    queryKey: ['accounting-journal-book-mapping', from, to, onlyMismatches],
    queryFn: () => api.get('/accounting/reports/journal-book-mapping', {
      params: { from, to, onlyMismatches: onlyMismatches ? '1' : '0' },
    }).then((r) => r.data),
  })

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
        title={isAr ? 'تقرير مطابقة دفاتر القيود' : 'Journal book mapping'}
        extra={(
          <label className="flex items-center gap-2 text-xs font-medium text-slate-500">
            <input
              type="checkbox"
              checked={onlyMismatches}
              onChange={(e) => setOnlyMismatches(e.target.checked)}
              className="rounded border-slate-300"
            />
            {isAr ? 'المخالفات فقط' : 'Mismatches only'}
          </label>
        )}
        exportProps={{
          getRows: async () => (data?.rows || []).map((r) => ({
            date: r.entryDate ? new Date(r.entryDate).toISOString().slice(0, 10) : '',
            number: r.entryNumber,
            actual: r.actualJournalCode,
            expected: r.expectedSequencePrefix,
            note: r.note,
          })),
          columns: [
            { key: 'date', label: isAr ? 'التاريخ' : 'Date' },
            { key: 'number', label: isAr ? 'الرقم' : 'Number' },
            { key: 'actual', label: isAr ? 'الفعلية' : 'Actual' },
            { key: 'expected', label: isAr ? 'المتوقعة' : 'Expected' },
            { key: 'note', label: isAr ? 'ملاحظة' : 'Note' },
          ],
          fileBaseName: 'maqder-journal-book-mapping',
          title: isAr ? 'مطابقة دفاتر القيود' : 'Journal book mapping',
        }}
      />
      <p className="text-xs text-slate-500">
        {isAr
          ? 'لا يُعاد ترقيم القيود القديمة (مسار التدقيق). يعرض أين كان يجب أن تُسجَّل.'
          : 'Historical numbers are never renamed (audit trail). Shows which book each entry should have used.'}
        {data?.count != null ? ` · ${data.count} ${isAr ? 'صف' : 'rows'}` : ''}
      </p>
      <AccountingQueryState
        language={language}
        isLoading={isLoading && !data}
        isError={isError}
        error={error}
        onRetry={() => refetch()}
        skeletonRows={6}
      >
        {isFetching && data ? <p className="text-xs text-slate-400">…</p> : null}
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-dark-600 dark:bg-dark-800">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-[11px] uppercase text-slate-400 dark:bg-dark-900">
              <tr>
                <th className="px-4 py-2 text-start">{isAr ? 'الرقم' : 'Number'}</th>
                <th className="px-4 py-2 text-start">{isAr ? 'الفعلية' : 'Actual'}</th>
                <th className="px-4 py-2 text-start">{isAr ? 'المتوقعة' : 'Expected'}</th>
                <th className="px-4 py-2 text-start">{isAr ? 'البيان' : 'Memo'}</th>
                <th className="px-4 py-2 text-start">{isAr ? 'ملاحظة' : 'Note'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {(data?.rows || []).map((r) => (
                <tr
                  key={r.entryId}
                  className={r.mismatch ? 'bg-amber-50/40 dark:bg-amber-950/20' : ''}
                >
                  <td className="px-4 py-2 font-mono text-xs">{r.entryNumber}</td>
                  <td className="px-4 py-2">{r.actualJournalCode || '—'}</td>
                  <td className="px-4 py-2 font-medium">{r.expectedSequencePrefix}</td>
                  <td className="px-4 py-2 max-w-xs truncate">{r.memo || r.sourceNumber || '—'}</td>
                  <td className="px-4 py-2 text-xs text-slate-600 dark:text-slate-300">{r.note}</td>
                </tr>
              ))}
              {!(data?.rows || []).length && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-slate-400">
                    {isAr ? 'لا مخالفات' : 'No mismatches'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </AccountingQueryState>
    </div>
  )
}

/** Upgrade wrapper notes — keep AccountReportPanel in modules but enhance via this thin re-export pattern if needed */
export function useReportDrillParams() {
  const [params] = useSearchParams()
  return {
    accountId: params.get('accountId') || '',
    from: params.get('from') || yearStartIso(),
    to: params.get('to') || todayIso(),
  }
}

export { sourceHref, todayIso, yearStartIso }
