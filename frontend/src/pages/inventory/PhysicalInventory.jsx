import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import EmptyState from '../../components/ui/EmptyState'

export default function PhysicalInventory() {
  const { language } = useSelector((s) => s.ui)
  const qc = useQueryClient()
  const [filter, setFilter] = useState('')
  const [warehouseId, setWarehouseId] = useState('')
  const [selected, setSelected] = useState(() => new Set())
  const [edits, setEdits] = useState({})

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => api.get('/warehouses').then((r) => r.data?.warehouses || r.data || []),
  })

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['physical-inventory', warehouseId, filter],
    queryFn: () =>
      api
        .get('/stock/physical-inventory', {
          params: { warehouseId: warehouseId || undefined, filter: filter || undefined },
        })
        .then((r) => r.data),
  })

  const setCount = useMutation({
    mutationFn: (body) => api.post('/stock/physical-inventory/set', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['physical-inventory'] })
    },
    onError: (e) => toast.error(e.response?.data?.error || e.message),
  })

  const apply = useMutation({
    mutationFn: (ids) => api.post('/stock/physical-inventory/apply', { ids, reason: 'Physical inventory' }),
    onSuccess: (res) => {
      toast.success(language === 'ar' ? `تم تطبيق ${res.data.applied}` : `Applied ${res.data.applied}`)
      setSelected(new Set())
      qc.invalidateQueries({ queryKey: ['physical-inventory'] })
      qc.invalidateQueries({ queryKey: ['stock-report'] })
    },
    onError: (e) => toast.error(e.response?.data?.error || e.message),
  })

  const clear = useMutation({
    mutationFn: (quantId) => api.post('/stock/physical-inventory/clear', { quantId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['physical-inventory'] }),
  })

  const list = useMemo(() => (Array.isArray(rows) ? rows : []), [rows])
  const whList = Array.isArray(warehouses) ? warehouses : []

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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
          {language === 'ar' ? 'الجرد الفعلي' : 'Physical Inventory'}
        </h2>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-primary text-sm"
            disabled={!selected.size || apply.isPending}
            onClick={() => apply.mutate([...selected])}
          >
            {language === 'ar' ? `تطبيق (${selected.size})` : `Apply (${selected.size})`}
          </button>
          <button
            type="button"
            className="btn btn-secondary text-sm"
            disabled={!list.some((r) => r.isCountSet)}
            onClick={() => apply.mutate(list.filter((r) => r.isCountSet).map((r) => r._id))}
          >
            {language === 'ar' ? 'تطبيق الكل' : 'Apply all'}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <select className="select" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
          <option value="">{language === 'ar' ? 'كل المستودعات' : 'All warehouses'}</option>
          {whList.map((w) => (
            <option key={w._id} value={w._id}>{language === 'ar' && w.nameAr ? w.nameAr : w.nameEn}</option>
          ))}
        </select>
        {[
          { id: '', en: 'All', ar: 'الكل' },
          { id: 'toCount', en: 'To count', ar: 'للعد' },
          { id: 'toApply', en: 'To apply', ar: 'للتطبيق' },
          { id: 'negative', en: 'Negative', ar: 'سالب' },
        ].map((f) => (
          <button
            key={f.id || 'all'}
            type="button"
            className={`btn btn-sm ${filter === f.id ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilter(f.id)}
          >
            {language === 'ar' ? f.ar : f.en}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-dark-600 dark:bg-dark-800">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-100 bg-slate-50/80 text-xs uppercase text-slate-500 dark:border-dark-600 dark:bg-dark-900/50">
            <tr>
              <th className="px-3 py-3 w-10" />
              <th className="px-3 py-3 text-start">{language === 'ar' ? 'الموقع' : 'Location'}</th>
              <th className="px-3 py-3 text-start">{language === 'ar' ? 'المنتج' : 'Product'}</th>
              <th className="px-3 py-3 text-start">{language === 'ar' ? 'دفعة' : 'Lot'}</th>
              <th className="px-3 py-3 text-start">{language === 'ar' ? 'المتاح' : 'On hand'}</th>
              <th className="px-3 py-3 text-start">{language === 'ar' ? 'العد' : 'Counted'}</th>
              <th className="px-3 py-3 text-start">{language === 'ar' ? 'الفرق' : 'Diff'}</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">…</td></tr>}
            {!isLoading && list.length === 0 && (
              <tr>
                <td colSpan={7} className="p-8">
                  <EmptyState title={language === 'ar' ? 'لا كميات' : 'No quants'} description={language === 'ar' ? 'رحّل الأرصدة أولاً' : 'Migrate balances first'} />
                </td>
              </tr>
            )}
            {list.map((row) => {
              const counted = edits[row._id] ?? row.countedQuantity ?? ''
              const diff = row.isCountSet || edits[row._id] != null
                ? (Number(counted || 0) - Number(row.quantity || 0)).toFixed(2)
                : row.countDifference || '—'
              return (
                <tr key={row._id} className="border-b border-slate-50 dark:border-dark-700">
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selected.has(row._id)}
                      disabled={!row.isCountSet}
                      onChange={() => toggle(row._id)}
                    />
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-500">{row.locationId?.completePath || row.locationId?.name}</td>
                  <td className="px-3 py-2">
                    <div className="font-medium">{language === 'ar' && row.productId?.nameAr ? row.productId.nameAr : row.productId?.nameEn}</div>
                    <div className="text-xs text-slate-400">{row.productId?.sku}</div>
                  </td>
                  <td className="px-3 py-2 tabular-nums">{row.lotId?.name || '—'}</td>
                  <td className="px-3 py-2 tabular-nums">{row.quantity}</td>
                  <td className="px-3 py-2">
                    <input
                      className="input w-24"
                      value={counted}
                      onChange={(e) => setEdits((m) => ({ ...m, [row._id]: e.target.value }))}
                      onBlur={() => {
                        if (edits[row._id] == null || edits[row._id] === '') return
                        setCount.mutate({ quantId: row._id, countedQty: edits[row._id] })
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.currentTarget.blur()
                        }
                      }}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <span className={`tabular-nums ${Number(diff) < 0 ? 'text-rose-600' : Number(diff) > 0 ? 'text-emerald-600' : ''}`}>
                      {diff}
                    </span>
                    {row.isCountSet && (
                      <button type="button" className="ms-2 text-xs text-slate-400 hover:text-rose-500" onClick={() => clear.mutate(row._id)}>
                        {language === 'ar' ? 'مسح' : 'Clear'}
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
