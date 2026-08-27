import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Loader2, Search } from 'lucide-react'
import api from '../../lib/api'
import { useTranslation } from '../../lib/translations'
import ExportMenu from '../../components/ui/ExportMenu'
import { InventoryIeButtons } from '../../components/inventory/ImportExportDialog'
import Money from '../../components/ui/Money'

export default function Warehouses() {
  const { language } = useSelector((state) => state.ui)
  const { t } = useTranslation(language)
  const navigate = useNavigate()
  const qc = useQueryClient()
  const ar = language === 'ar'
  const [q, setQ] = useState('')
  const [selected, setSelected] = useState(() => new Set())

  const exportColumns = [
    { key: 'code', label: ar ? 'الرمز' : 'Code', value: (r) => r?.code || '' },
    { key: 'name', label: ar ? 'الاسم' : 'Name', value: (r) => (ar ? r?.nameAr || r?.nameEn : r?.nameEn || r?.nameAr) || '' },
    { key: 'reception', label: ar ? 'الاستلام' : 'Reception', value: (r) => r?.receptionSteps || '' },
    { key: 'delivery', label: ar ? 'التسليم' : 'Delivery', value: (r) => r?.deliverySteps || '' },
    { key: 'city', label: ar ? 'المدينة' : 'City', value: (r) => r?.address?.city || '' },
  ]

  const { data: warehousesRaw, isLoading: loadingWarehouses } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => api.get('/warehouses').then((res) => res.data),
  })

  const warehouses = Array.isArray(warehousesRaw)
    ? warehousesRaw
    : (warehousesRaw?.warehouses || warehousesRaw?.data || [])

  const { data: stockStats } = useQuery({
    queryKey: ['warehouses-stock-stats'],
    queryFn: () => api.get('/warehouses/stock-summary/stats').then((res) => res.data),
  })

  const statsMap = (Array.isArray(stockStats) ? stockStats : []).reduce((acc, curr) => {
    acc[curr._id] = curr
    return acc
  }, {})

  const rows = warehouses.filter((w) => {
    if (!q.trim()) return true
    const needle = q.toLowerCase()
    return `${w.nameEn || ''} ${w.nameAr || ''} ${w.code || ''}`.toLowerCase().includes(needle)
  })

  const toggle = (id) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (selected.size === rows.length) setSelected(new Set())
    else setSelected(new Set(rows.map((r) => r._id)))
  }

  return (
    <div className="space-y-4 pb-12" dir={ar ? 'rtl' : 'ltr'}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-white">{t('warehouses')}</h1>
          <p className="text-sm text-slate-500">
            {ar ? 'قائمة المستودعات — كل سجل قابل للفتح' : 'Warehouse records — every warehouse is openable'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <InventoryIeButtons
            model="warehouses"
            ar={ar}
            onImported={() => qc.invalidateQueries({ queryKey: ['warehouses'] })}
          />
          <ExportMenu
            language={language}
            t={t}
            rows={rows}
            columns={exportColumns}
            fileBaseName={ar ? 'المستودعات' : 'Warehouses'}
            title={ar ? 'المستودعات' : 'Warehouses'}
            disabled={loadingWarehouses || !rows.length}
          />
          <Link to="/app/dashboard/inventory/warehouses/new" className="btn btn-primary text-sm">
            <Plus className="h-4 w-4" />
            {ar ? 'جديد' : 'New'}
          </Link>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          className="input w-full ps-9"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={ar ? 'بحث…' : 'Search…'}
        />
      </div>

      <p className="text-xs text-slate-400">
        {rows.length ? `1-${rows.length} / ${warehouses.length}` : `0 / ${warehouses.length}`}
        {selected.size > 0 ? ` · ${selected.size} ${ar ? 'محدد' : 'selected'}` : ''}
      </p>

      {loadingWarehouses ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
        </div>
      ) : !rows.length ? (
        <div className="rounded-2xl border border-dashed border-slate-200 p-12 text-center dark:border-dark-600">
          <p className="font-medium text-slate-800 dark:text-slate-100">
            {ar ? 'لا توجد مستودعات' : 'No warehouses'}
          </p>
          <Link to="/app/dashboard/inventory/warehouses/new" className="btn btn-primary mt-4 text-sm">
            <Plus className="h-4 w-4" /> {ar ? 'إضافة' : 'Add'}
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200/80 bg-white dark:border-dark-600 dark:bg-dark-800">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b border-slate-100 bg-slate-50/80 text-start text-xs uppercase tracking-wide text-slate-500 dark:border-dark-600 dark:bg-dark-900/50">
              <tr>
                <th className="min-w-[150px] px-3 py-3">
                  <input type="checkbox" checked={selected.size === rows.length && rows.length > 0} onChange={toggleAll} />
                </th>
                <th className="min-w-[150px] px-3 py-3 font-medium">{ar ? 'المستودع' : 'Warehouse'}</th>
                <th className="min-w-[150px] px-3 py-3 font-medium">{ar ? 'الرمز' : 'Short Name'}</th>
                <th className="min-w-[150px] px-3 py-3 font-medium">{ar ? 'موقع المخزون' : 'Location Stock'}</th>
                <th className="min-w-[150px] px-3 py-3 font-medium">{ar ? 'العنوان' : 'Address'}</th>
                <th className="min-w-[150px] px-3 py-3 font-medium">{ar ? 'الاستلام' : 'Reception'}</th>
                <th className="min-w-[150px] px-3 py-3 font-medium">{ar ? 'التسليم' : 'Delivery'}</th>
                <th className="min-w-[150px] px-3 py-3 font-medium">{ar ? 'القيمة' : 'On-hand Value'}</th>
                <th className="min-w-[150px] px-3 py-3 font-medium">{ar ? 'الحالة' : 'Active'}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((w) => {
                const stats = statsMap[w._id] || {}
                const stockPath = w.stockLocationId?.completePath
                  || w.stockLocationId?.name
                  || (w.code ? `${String(w.code).toUpperCase()}/Stock` : '—')
                return (
                  <tr
                    key={w._id}
                    className="cursor-pointer border-b border-slate-50 hover:bg-slate-50/80 dark:border-dark-700 dark:hover:bg-dark-700/40"
                    onClick={() => navigate(`/app/dashboard/inventory/warehouses/${w._id}/edit`)}
                  >
                    <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={selected.has(w._id)} onChange={() => toggle(w._id)} />
                    </td>
                    <td className="px-3 py-3 font-medium text-primary-700 dark:text-primary-300">
                      {ar ? (w.nameAr || w.nameEn) : (w.nameEn || w.nameAr)}
                      {w.isPrimary && (
                        <span className="ms-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600 dark:bg-dark-700">
                          {ar ? 'رئيسي' : 'main'}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 font-mono text-xs">{w.code || '—'}</td>
                    <td className="px-3 py-3 text-slate-500">{stockPath}</td>
                    <td className="px-3 py-3 text-slate-500">
                      {[w.address?.city, w.address?.street].filter(Boolean).join(', ') || '—'}
                    </td>
                    <td className="px-3 py-3">
                      <span className="rounded-md bg-teal-50 px-2 py-0.5 text-xs text-teal-700 dark:bg-teal-950/40 dark:text-teal-300">
                        {w.receptionSteps || 'one'}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span className="rounded-md bg-sky-50 px-2 py-0.5 text-xs text-sky-700 dark:bg-sky-950/40 dark:text-sky-300">
                        {w.deliverySteps || 'ship'}
                      </span>
                    </td>
                    <td className="px-3 py-3 tabular-nums">
                      <Money value={stats.totalValue || 0} />
                    </td>
                    <td className="px-3 py-3">
                      <span className={`rounded-md px-2 py-0.5 text-xs ${w.isActive === false ? 'bg-slate-100 text-slate-500' : 'bg-emerald-50 text-emerald-700'}`}>
                        {w.isActive === false ? (ar ? 'متوقف' : 'Off') : (ar ? 'نشط' : 'Active')}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
