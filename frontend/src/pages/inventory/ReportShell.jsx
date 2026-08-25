import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import api from '../../lib/api'

export const REPORT_TABS = [
  { id: 'stock', path: '/app/dashboard/inventory/stock', en: 'Stock', ar: 'المخزون' },
  { id: 'locations', path: '/app/dashboard/inventory/report/locations', en: 'Locations', ar: 'المواقع', flag: 'multiLocations' },
  { id: 'moves', path: '/app/dashboard/inventory/moves', en: 'Moves History', ar: 'سجل الحركات' },
  { id: 'moves-analysis', path: '/app/dashboard/inventory/moves-analysis', en: 'Moves Analysis', ar: 'تحليل الحركات' },
  { id: 'performance', path: '/app/dashboard/inventory/performance', en: 'Performance', ar: 'الأداء' },
  { id: 'forecast', path: '/app/dashboard/inventory/forecast', en: 'Forecast', ar: 'التوقع' },
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
    return q
  }, [filters])

  const qs = useMemo(() => {
    const sp = new URLSearchParams()
    Object.entries(queryParams).forEach(([k, v]) => { if (v) sp.set(k, v) })
    const s = sp.toString()
    return s ? `?${s}` : ''
  }, [queryParams])

  return { filters, setFilter, queryParams, qs, params, setParams }
}

export function ReportShell({ activeId, title, subtitle, children, extraFilters }) {
  const { language } = useSelector((s) => s.ui)
  const ar = language === 'ar'
  const { filters, setFilter, qs } = useReportFilters()

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
    if (t.flag === 'valuation' && !(settings?.stockAccountingEnabled || settings?.groupLandedCosts)) return false
    return true
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h2>
          {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
        </div>
        <Link to={`/app/dashboard/inventory/reports${qs}`} className="text-xs font-medium text-primary-600 hover:underline">
          {ar ? 'مركز التقارير' : 'Reports hub'}
        </Link>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-slate-200/80 pb-2 dark:border-dark-600">
        {tabs.map((t) => (
          <Link
            key={t.id}
            to={`${t.path}${qs}`}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
              activeId === t.id
                ? 'bg-primary-50 text-primary-700 dark:bg-primary-950/40 dark:text-primary-300'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            {ar ? t.ar : t.en}
          </Link>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200/80 bg-slate-50/60 p-3 dark:border-dark-600 dark:bg-dark-800/40">
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
        {extraFilters}
        {(filters.warehouseId || filters.dateFrom || filters.dateTo || filters.productId) && (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => {
              setFilter('warehouseId', '')
              setFilter('dateFrom', '')
              setFilter('dateTo', '')
              setFilter('productId', '')
              setFilter('locationId', '')
              setFilter('groupBy', '')
            }}
          >
            {ar ? 'مسح الفلاتر' : 'Clear filters'}
          </button>
        )}
      </div>

      {children}
    </div>
  )
}

export function exportCsv(filename, rows, columns) {
  const header = columns.map((c) => c.label).join(',')
  const body = rows.map((row) => columns.map((c) => {
    const v = c.get(row)
    const s = v == null ? '' : String(v)
    return `"${s.replace(/"/g, '""')}"`
  }).join(',')).join('\n')
  const blob = new Blob([`${header}\n${body}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
