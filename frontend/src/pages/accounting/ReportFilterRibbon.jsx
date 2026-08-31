import { useMemo, useState } from 'react'
import ExportMenu from '../../components/ui/ExportMenu'

const iso = (d) => {
  const x = new Date(d)
  const y = x.getFullYear()
  const m = String(x.getMonth() + 1).padStart(2, '0')
  const day = String(x.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function datePresets(now = new Date()) {
  const y = now.getFullYear()
  const m = now.getMonth()
  const q = Math.floor(m / 3)
  return {
    this_month: {
      from: iso(new Date(y, m, 1)),
      to: iso(new Date(y, m + 1, 0)),
      asOf: iso(new Date(y, m + 1, 0)),
      labelEn: 'This month',
      labelAr: 'هذا الشهر',
    },
    this_quarter: {
      from: iso(new Date(y, q * 3, 1)),
      to: iso(new Date(y, q * 3 + 3, 0)),
      asOf: iso(new Date(y, q * 3 + 3, 0)),
      labelEn: 'This quarter',
      labelAr: 'هذا الربع',
    },
    this_year: {
      from: iso(new Date(y, 0, 1)),
      to: iso(new Date(y, 11, 31)),
      asOf: iso(new Date(y, 11, 31)),
      labelEn: 'This year',
      labelAr: 'هذه السنة',
    },
    last_year: {
      from: iso(new Date(y - 1, 0, 1)),
      to: iso(new Date(y - 1, 11, 31)),
      asOf: iso(new Date(y - 1, 11, 31)),
      labelEn: 'Last financial year',
      labelAr: 'السنة المالية السابقة',
    },
    ytd: {
      from: iso(new Date(y, 0, 1)),
      to: iso(now),
      asOf: iso(now),
      labelEn: 'Year to date',
      labelAr: 'من بداية السنة',
    },
  }
}

/** Shift a [from,to] range to the previous equal-length period or prior year. */
export function compareRange(from, to, mode) {
  if (!from || !to || mode === 'none') return null
  const start = new Date(from)
  const end = new Date(to)
  if (mode === 'previous_year') {
    const cFrom = new Date(start)
    cFrom.setFullYear(cFrom.getFullYear() - 1)
    const cTo = new Date(end)
    cTo.setFullYear(cTo.getFullYear() - 1)
    return { from: iso(cFrom), to: iso(cTo), asOf: iso(cTo) }
  }
  // previous_period: same length immediately before `from`
  const ms = end.getTime() - start.getTime()
  const cTo = new Date(start.getTime() - 86400000)
  const cFrom = new Date(cTo.getTime() - ms)
  return { from: iso(cFrom), to: iso(cTo), asOf: iso(cTo) }
}

export function variance(current, prior) {
  const a = Number(current) || 0
  const b = Number(prior) || 0
  const amount = Math.round((a - b) * 100) / 100
  const pct = Math.abs(b) < 0.005 ? (Math.abs(a) < 0.005 ? 0 : 100) : Math.round(((a - b) / Math.abs(b)) * 1000) / 10
  return { amount, pct }
}

/**
 * Sticky universal filter ribbon for accounting reports.
 * mode: 'range' | 'asOf'
 */
export function ReportFilterRibbon({
  language,
  mode = 'range',
  from,
  to,
  asOf,
  setFrom,
  setTo,
  setAsOf,
  comparison = 'none',
  setComparison,
  basis = 'accrual',
  setBasis,
  showComparison = true,
  showBasis = true,
  hideDates = false,
  hidePresets = false,
  extra,
  exportProps,
  title,
}) {
  const isAr = language === 'ar'
  const presets = useMemo(() => datePresets(), [])
  const [activePreset, setActivePreset] = useState('')

  const applyPreset = (key) => {
    const p = presets[key]
    if (!p) return
    setActivePreset(key)
    if (mode === 'asOf') {
      setAsOf?.(p.asOf)
    } else {
      setFrom?.(p.from)
      setTo?.(p.to)
    }
  }

  return (
    <div className="sticky top-0 z-20 space-y-3 rounded-[1.4rem] border border-white/80 bg-white/95 p-4 shadow-[0_14px_36px_-28px_rgba(15,23,42,0.35)] backdrop-blur-md dark:border-white/10 dark:bg-dark-800/95">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          {title ? <p className="text-sm font-semibold text-slate-900 dark:text-white">{title}</p> : null}
          {!hidePresets ? (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {Object.entries(presets).map(([key, p]) => (
              <button
                key={key}
                type="button"
                onClick={() => applyPreset(key)}
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                  activePreset === key
                    ? 'bg-emerald-700 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-dark-900 dark:text-slate-300'
                }`}
              >
                {isAr ? p.labelAr : p.labelEn}
              </button>
            ))}
          </div>
          ) : null}
        </div>
        {exportProps ? (
          <ExportMenu
            language={language}
            rows={exportProps.rows || []}
            getRows={exportProps.getRows}
            columns={exportProps.columns || []}
            fileBaseName={exportProps.fileBaseName || 'maqder-report'}
            title={exportProps.title || title}
          />
        ) : null}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        {!hideDates && mode === 'asOf' ? (
          <label className="text-xs font-medium text-slate-500">
            {isAr ? 'كما في' : 'As of'}
            <input
              type="date"
              value={asOf || ''}
              onChange={(e) => {
                setActivePreset('')
                setAsOf?.(e.target.value)
              }}
              className="mt-1 block rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-dark-600 dark:bg-dark-900"
            />
          </label>
        ) : !hideDates ? (
          <>
            <label className="text-xs font-medium text-slate-500">
              {isAr ? 'من' : 'From'}
              <input
                type="date"
                value={from || ''}
                onChange={(e) => {
                  setActivePreset('')
                  setFrom?.(e.target.value)
                }}
                className="mt-1 block rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-dark-600 dark:bg-dark-900"
              />
            </label>
            <label className="text-xs font-medium text-slate-500">
              {isAr ? 'إلى' : 'To'}
              <input
                type="date"
                value={to || ''}
                onChange={(e) => {
                  setActivePreset('')
                  setTo?.(e.target.value)
                }}
                className="mt-1 block rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-dark-600 dark:bg-dark-900"
              />
            </label>
          </>
        ) : null}

        {showComparison && setComparison ? (
          <label className="text-xs font-medium text-slate-500">
            {isAr ? 'المقارنة' : 'Comparison'}
            <select
              value={comparison}
              onChange={(e) => setComparison(e.target.value)}
              className="mt-1 block rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-dark-600 dark:bg-dark-900"
            >
              <option value="none">{isAr ? 'بدون' : 'None'}</option>
              <option value="previous_period">{isAr ? 'الفترة السابقة' : 'Previous period'}</option>
              <option value="previous_year">{isAr ? 'السنة السابقة' : 'Previous year'}</option>
            </select>
          </label>
        ) : null}

        {showBasis && setBasis ? (
          <label className="text-xs font-medium text-slate-500">
            {isAr ? 'أساس المحاسبة' : 'Accounting basis'}
            <select
              value={basis}
              onChange={(e) => setBasis(e.target.value)}
              className="mt-1 block rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-dark-600 dark:bg-dark-900"
            >
              <option value="accrual">{isAr ? 'استحقاق' : 'Accrual'}</option>
              <option value="cash">{isAr ? 'نقدي' : 'Cash'}</option>
            </select>
          </label>
        ) : null}

        {extra}
      </div>
    </div>
  )
}

export default ReportFilterRibbon
