import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import api from '../../lib/api'
import { isInventoryEvaluationOn } from '../../lib/inventoryAccountingMode'

const SAVED_KEY = 'maqder-inv-report-filters'

export const REPORT_TABS = [
  { id: 'stock', path: '/app/dashboard/inventory/stock', en: 'Stock', ar: 'المخزون' },
  { id: 'locations', path: '/app/dashboard/inventory/report/locations', en: 'Locations', ar: 'المواقع', flag: 'multiLocations' },
  { id: 'moves', path: '/app/dashboard/inventory/moves', en: 'Moves History', ar: 'سجل الحركات' },
  { id: 'moves-analysis', path: '/app/dashboard/inventory/moves-analysis', en: 'Moves Analysis', ar: 'تحليل الحركات' },
  { id: 'performance', path: '/app/dashboard/inventory/performance', en: 'Performance', ar: 'الأداء' },
  { id: 'forecast', path: '/app/dashboard/inventory/forecast', en: 'Forecast', ar: 'التوقع' },
  { id: 'expiry-at-risk', path: '/app/dashboard/inventory/expiry-at-risk', en: 'Expiry at Risk', ar: 'انتهاء الصلاحية', flag: 'productExpiry' },
  { id: 'stock-ageing', path: '/app/dashboard/inventory/stock-ageing', en: 'Stock ageing', ar: 'تقادم المخزون' },
  { id: 'dead-stock', path: '/app/dashboard/inventory/dead-stock', en: 'Dead stock', ar: 'مخزون راكد' },
  { id: 'inventory-turns', path: '/app/dashboard/inventory/inventory-turns', en: 'Turns & DSI', ar: 'دوران المخزون' },
  { id: 'count-accuracy', path: '/app/dashboard/inventory/count-accuracy', en: 'Count accuracy', ar: 'دقة العد' },
  { id: 'mock-recall', path: '/app/dashboard/inventory/mock-recall', en: 'Mock recall', ar: 'استدعاء تجريبي' },
  { id: 'reception', path: '/app/dashboard/inventory/report/reception', en: 'Reception', ar: 'الاستلام', flag: 'receptionReport' },
  { id: 'valuation', path: '/app/dashboard/inventory/valuation', en: 'Valuation', ar: 'التقييم', flag: 'valuation' },
  { id: 'reconcile', path: '/app/dashboard/inventory/report/reconcile', en: 'Reconcile', ar: 'المطابقة' },
]

export function useReportFilters() {
  const [params, setParams] = useSearchParams()
  const filters = useMemo(() => ({
    warehouseId: params.get('warehouseId') || '',
    locationId: params.get('locationId') || '',
    productId: params.get('productId') || '',
    dateFrom: params.get('dateFrom') || '',
    dateTo: params.get('dateTo') || '',
    groupBy: params.get('groupBy') || '',
    asOf: params.get('asOf') || '',
    view: params.get('view') || 'list',
  }), [params])

  const setFilter = (key, value) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  const queryParams = useMemo(() => {
    const q = {}
    if (filters.warehouseId) q.warehouseId = filters.warehouseId
    if (filters.locationId) q.locationId = filters.locationId
    if (filters.productId) q.productId = filters.productId
    if (filters.dateFrom) q.dateFrom = filters.dateFrom
    if (filters.dateTo) q.dateTo = filters.dateTo
    if (filters.groupBy) q.groupBy = filters.groupBy
    if (filters.asOf) q.asOf = filters.asOf
    return q
  }, [filters])

  const qs = useMemo(() => {
    const sp = new URLSearchParams()
    Object.entries(queryParams).forEach(([k, v]) => { if (v) sp.set(k, v) })
    if (filters.view && filters.view !== 'list') sp.set('view', filters.view)
    const s = sp.toString()
    return s ? `?${s}` : ''
  }, [queryParams, filters.view])

  const clearFilters = () => {
    const next = new URLSearchParams()
    if (filters.view && filters.view !== 'list') next.set('view', filters.view)
    setParams(next, { replace: true })
  }

  const saveFilters = (name) => {
    const label = String(name || '').trim()
    if (!label) return
    let list = []
    try {
      list = JSON.parse(localStorage.getItem(SAVED_KEY) || '[]')
    } catch {
      list = []
    }
    const entry = { name: label, filters: { ...queryParams }, savedAt: new Date().toISOString() }
    list = [entry, ...list.filter((e) => e.name !== label)].slice(0, 12)
    localStorage.setItem(SAVED_KEY, JSON.stringify(list))
  }

  const loadSaved = () => {
    try {
      return JSON.parse(localStorage.getItem(SAVED_KEY) || '[]')
    } catch {
      return []
    }
  }

  const applySaved = (entry) => {
    const next = new URLSearchParams()
    Object.entries(entry?.filters || {}).forEach(([k, v]) => { if (v) next.set(k, v) })
    if (filters.view && filters.view !== 'list') next.set('view', filters.view)
    setParams(next, { replace: true })
  }

  return {
    filters, setFilter, queryParams, qs, params, setParams,
    clearFilters, saveFilters, loadSaved, applySaved,
  }
}

export function ReportShell({ activeId, title, subtitle, children, extraFilters, toolbar }) {
  const { language } = useSelector((s) => s.ui)
  const ar = language === 'ar'
  const {
    filters, setFilter, qs, clearFilters, saveFilters, loadSaved, applySaved,
  } = useReportFilters()
  const [savedOpen, setSavedOpen] = useState(false)
  const saved = savedOpen ? loadSaved() : []

  const { data: settings } = useQuery({
    queryKey: ['stock-settings'],
    queryFn: () => api.get('/stock/settings').then((r) => r.data),
    staleTime: 60_000,
  })

  const { data: warehouses } = useQuery({
    queryKey: ['warehouses-lite'],
    queryFn: () => api.get('/warehouses').then((r) => r.data?.warehouses || r.data || []),
  })

  const tabs = REPORT_TABS.filter((t) => {
    if (t.flag === 'multiLocations' && settings?.groupStockMultiLocations === false) return false
    if (t.flag === 'valuation' && !(isInventoryEvaluationOn(settings || {}) || settings?.groupLandedCosts)) return false
    if (t.flag === 'receptionReport' && !(settings?.receptionReportEnabled || settings?.groupReceptionReport)) return false
    if (t.flag === 'productExpiry' && !settings?.moduleProductExpiry) return false
    return true
  })

  const hasFilters = Boolean(
    filters.warehouseId || filters.dateFrom || filters.dateTo
    || filters.productId || filters.locationId || filters.asOf || filters.groupBy,
  )

  return (
    <div className="flex h-[calc(100dvh-6.5rem)] min-h-[28rem] flex-col gap-3 overflow-hidden">
      <div className="flex shrink-0 flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h2>
          {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {toolbar}
          <Link to={`/app/dashboard/inventory/reports${qs}`} className="text-xs font-medium text-primary-600 hover:underline">
            {ar ? 'مركز التقارير' : 'Reports hub'}
          </Link>
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap gap-1 border-b border-slate-200/80 dark:border-dark-600">
        {tabs.map((t) => (
          <Link
            key={t.id}
            to={`${t.path}${qs}`}
            className={`relative rounded-t-lg px-3 py-2 text-xs font-semibold transition ${
              activeId === t.id
                ? 'bg-white text-slate-900 shadow-sm dark:bg-dark-800 dark:text-white after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-emerald-600'
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800 dark:hover:bg-dark-800/60 dark:hover:text-slate-200'
            }`}
          >
            {ar ? t.ar : t.en}
          </Link>
        ))}
      </div>

      <div className="flex shrink-0 flex-wrap items-end gap-3 rounded-xl border border-slate-200/80 bg-slate-50/60 p-3 dark:border-dark-600 dark:bg-dark-800/40">
        <div>
          <label className="label text-[11px]">{ar ? 'المستودع' : 'Warehouse'}</label>
          <select
            className="select select-sm min-w-[10rem]"
            value={filters.warehouseId}
            onChange={(e) => setFilter('warehouseId', e.target.value)}
          >
            <option value="">{ar ? 'الكل' : 'All'}</option>
            {(warehouses || []).map((w) => (
              <option key={w._id} value={w._id}>{w.code || w.nameEn || w.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label text-[11px]">{ar ? 'من تاريخ' : 'From'}</label>
          <input
            type="date"
            className="input input-sm"
            value={filters.dateFrom}
            onChange={(e) => setFilter('dateFrom', e.target.value)}
          />
        </div>
        <div>
          <label className="label text-[11px]">{ar ? 'إلى تاريخ' : 'To'}</label>
          <input
            type="date"
            className="input input-sm"
            value={filters.dateTo}
            onChange={(e) => setFilter('dateTo', e.target.value)}
          />
        </div>
        <div>
          <label className="label text-[11px]">{ar ? 'العرض' : 'View'}</label>
          <select
            className="select select-sm"
            value={filters.view || 'list'}
            onChange={(e) => setFilter('view', e.target.value === 'list' ? '' : e.target.value)}
          >
            <option value="list">{ar ? 'قائمة' : 'List'}</option>
            <option value="pivot">{ar ? 'محوري' : 'Pivot'}</option>
            <option value="graph">{ar ? 'رسم' : 'Graph'}</option>
          </select>
        </div>
        {extraFilters}
        <div className="relative">
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setSavedOpen((o) => !o)}>
            {ar ? 'فلاتر محفوظة' : 'Saved filters'}
          </button>
          {savedOpen && (
            <div className="absolute end-0 z-20 mt-1 min-w-[14rem] rounded-xl border border-slate-200 bg-white p-2 shadow-lg dark:border-dark-600 dark:bg-dark-800">
              <button
                type="button"
                className="mb-1 block w-full rounded-lg px-2 py-1.5 text-start text-sm hover:bg-slate-50 dark:hover:bg-dark-700"
                onClick={() => {
                  const name = window.prompt(ar ? 'اسم الفلتر' : 'Filter name')
                  if (name) saveFilters(name)
                  setSavedOpen(false)
                }}
              >
                {ar ? 'حفظ الحالي…' : 'Save current…'}
              </button>
              {saved.length === 0 && (
                <p className="px-2 py-1 text-xs text-slate-400">{ar ? 'لا محفوظات' : 'None saved'}</p>
              )}
              {saved.map((e) => (
                <button
                  key={e.name}
                  type="button"
                  className="block w-full rounded-lg px-2 py-1.5 text-start text-sm hover:bg-slate-50 dark:hover:bg-dark-700"
                  onClick={() => { applySaved(e); setSavedOpen(false) }}
                >
                  {e.name}
                </button>
              ))}
            </div>
          )}
        </div>
        {hasFilters && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={clearFilters}>
            {ar ? 'مسح الفلاتر' : 'Clear filters'}
          </button>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {children}
      </div>
    </div>
  )
}

/** Scrollable report table shell — sticky header, flex-1 overflow. */
export function ReportTableFrame({ children, toolbar, className = '' }) {
  return (
    <div className={`flex min-h-0 flex-1 flex-col gap-2 overflow-hidden ${className}`}>
      {toolbar ? <div className="shrink-0">{toolbar}</div> : null}
      <div className="min-h-0 flex-1 overflow-auto rounded-2xl border border-slate-200/80 bg-white dark:border-dark-600 dark:bg-dark-800">
        {children}
      </div>
    </div>
  )
}

export const REPORT_THEAD =
  'sticky top-0 z-10 border-b border-slate-100 bg-slate-50/95 text-xs uppercase tracking-wide text-slate-500 backdrop-blur dark:border-dark-600 dark:bg-dark-900/95'

export function exportCsv(filename, rows, columns) {
  // Guard against reversed args from older call sites: exportCsv(rows, filename, columns)
  let file = filename
  let data = rows
  let cols = columns
  if (Array.isArray(filename) && typeof rows === 'string') {
    data = filename
    file = rows
    cols = columns
  }
  const header = cols.map((c) => c.label).join(',')
  const body = data.map((row) => cols.map((c) => {
    const v = c.get(row)
    const s = v == null ? '' : String(v)
    return `"${s.replace(/"/g, '""')}"`
  }).join(',')).join('\n')
  const blob = new Blob([`${header}\n${body}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = file
  a.click()
  URL.revokeObjectURL(url)
}
