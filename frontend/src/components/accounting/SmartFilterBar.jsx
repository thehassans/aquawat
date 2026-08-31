import { useMemo, useState } from 'react'
import { Filter, Layers, Search, X } from 'lucide-react'

/**
 * Odoo-style smart search: query + filter/group dropdowns that render removable tokens.
 */
export default function SmartFilterBar({
  language = 'en',
  query,
  onQueryChange,
  placeholder,
  tokens = [],
  onRemoveToken,
  filterOptions = [],
  onAddFilter,
  groupBy,
  onGroupByChange,
  groupOptions = [],
  trailing = null,
}) {
  const isAr = language === 'ar'
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [groupOpen, setGroupOpen] = useState(false)

  const unusedFilters = useMemo(
    () => filterOptions.filter((opt) => !tokens.some((t) => t.id === opt.id)),
    [filterOptions, tokens],
  )

  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white p-2 shadow-[0_8px_30px_-24px_rgba(15,23,42,0.28)] dark:border-dark-600 dark:bg-dark-800">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <div className="flex min-h-[42px] flex-wrap items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50/60 py-1.5 pe-2 ps-9 dark:border-dark-600 dark:bg-dark-900/60">
            {tokens.map((token) => (
              <span
                key={token.id}
                className="inline-flex max-w-full items-center gap-1 rounded-lg border border-emerald-200/80 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300"
              >
                <span className="truncate">{token.label}</span>
                <button type="button" onClick={() => onRemoveToken?.(token.id)} className="rounded p-0.5 hover:bg-emerald-100 dark:hover:bg-emerald-500/20" aria-label="Remove">
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            <input
              value={query}
              onChange={(e) => onQueryChange?.(e.target.value)}
              placeholder={placeholder || (isAr ? 'بحث ذكي…' : 'Smart search…')}
              className="min-w-[8rem] flex-1 border-0 bg-transparent py-1 text-sm outline-none placeholder:text-slate-400"
            />
          </div>
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => { setFiltersOpen((v) => !v); setGroupOpen(false) }}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 dark:border-dark-600 dark:bg-dark-900 dark:text-slate-200"
          >
            <Filter className="h-3.5 w-3.5" />
            {isAr ? 'فلاتر' : 'Filters'}
          </button>
          {filtersOpen ? (
            <div className="absolute end-0 z-30 mt-1 max-h-64 w-56 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg dark:border-dark-600 dark:bg-dark-800">
              {unusedFilters.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className="block w-full px-3 py-2 text-start text-sm hover:bg-slate-50 dark:hover:bg-white/5"
                  onClick={() => {
                    onAddFilter?.(opt)
                    setFiltersOpen(false)
                  }}
                >
                  {opt.label}
                </button>
              ))}
              {!unusedFilters.length ? (
                <p className="px-3 py-3 text-xs text-slate-400">{isAr ? 'لا فلاتر إضافية' : 'No more filters'}</p>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => { setGroupOpen((v) => !v); setFiltersOpen(false) }}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 dark:border-dark-600 dark:bg-dark-900 dark:text-slate-200"
          >
            <Layers className="h-3.5 w-3.5" />
            {isAr ? 'تجميع' : 'Group by'}
          </button>
          {groupOpen ? (
            <div className="absolute end-0 z-30 mt-1 w-48 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg dark:border-dark-600 dark:bg-dark-800">
              {groupOptions.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className={`block w-full px-3 py-2 text-start text-sm hover:bg-slate-50 dark:hover:bg-white/5 ${groupBy === opt.id ? 'font-semibold text-emerald-700' : ''}`}
                  onClick={() => {
                    onGroupByChange?.(opt.id)
                    setGroupOpen(false)
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {trailing}
      </div>
    </div>
  )
}
