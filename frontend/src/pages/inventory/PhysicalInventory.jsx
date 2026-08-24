import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import { fieldControlClass, ghostBtn, primaryBtn } from './inventoryUi'

export default function PhysicalInventory() {
  const { language } = useSelector((state) => state.ui)
  const isAr = language === 'ar'
  const queryClient = useQueryClient()
  const [selected, setSelected] = useState([])
  const [reason, setReason] = useState('')
  const [counts, setCounts] = useState({})

  const { data: quants = [], isLoading } = useQuery({
    queryKey: ['stock-inventory'],
    queryFn: () => api.get('/stock/inventory').then((r) => r.data),
  })

  const setCounted = useMutation({
    mutationFn: (payload) => api.post('/stock/quants/set-counted', payload),
    onSuccess: () => {
      toast.success(isAr ? 'تم حفظ العد' : 'Count saved')
      queryClient.invalidateQueries(['stock-inventory'])
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Error'),
  })

  const applyCount = useMutation({
    mutationFn: (payload) => api.post('/stock/quants/apply-count', payload),
    onSuccess: (res) => {
      toast.success(isAr ? `تم تطبيق ${res.data.applied}` : `Applied ${res.data.applied}`)
      setSelected([])
      queryClient.invalidateQueries(['stock-inventory'])
      queryClient.invalidateQueries(['stock-report'])
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Error'),
  })

  const rows = useMemo(() => quants, [quants])

  const toggle = (id) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {isAr ? 'الجرد الفعلي' : 'Physical Inventory'}
          </h1>
          <p className="text-gray-500 mt-1">
            {isAr ? 'أدخل الكمية المعدودة ثم طبّق الفروقات عبر محرك الحركات' : 'Set counted qty, then apply differences via the move engine'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <input
            className={`${fieldControlClass} max-w-[200px]`}
            placeholder={isAr ? 'سبب' : 'Reason'}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <button
            type="button"
            className={primaryBtn}
            disabled={!selected.length || applyCount.isPending}
            onClick={() => applyCount.mutate({ ids: selected, reason })}
          >
            {isAr ? 'تطبيق' : 'Apply'}
          </button>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th />
                <th>{isAr ? 'الموقع' : 'Location'}</th>
                <th>{isAr ? 'المنتج' : 'Product'}</th>
                <th>{isAr ? 'الدفعة' : 'Lot'}</th>
                <th>{isAr ? 'باليد' : 'On Hand'}</th>
                <th>{isAr ? 'المعدود' : 'Counted'}</th>
                <th>{isAr ? 'الفرق' : 'Difference'}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={8} className="text-center text-slate-500 py-8">{isAr ? 'جاري التحميل...' : 'Loading...'}</td></tr>
              )}
              {!isLoading && rows.length === 0 && (
                <tr><td colSpan={8} className="text-center text-slate-500 py-8">{isAr ? 'لا توجد كميات' : 'No quants'}</td></tr>
              )}
              {rows.map((q) => {
                const countedVal = counts[q._id] ?? (q.inventoryQuantitySet ? q.inventoryQuantity : q.quantity)
                const diff = Number(countedVal) - Number(q.quantity)
                return (
                  <tr key={q._id} className={q.inventoryQuantitySet ? 'bg-amber-50/50 dark:bg-amber-500/5' : ''}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selected.includes(q._id)}
                        onChange={() => toggle(q._id)}
                        disabled={!q.inventoryQuantitySet}
                      />
                    </td>
                    <td className="text-sm">{q.locationId?.completeName || '—'}</td>
                    <td className="text-sm">{q.productId?.defaultCode || String(q.productId?._id || q.productId).slice(-6)}</td>
                    <td className="text-sm">{q.lotId?.name || '—'}</td>
                    <td>{q.quantity}</td>
                    <td>
                      <input
                        className={`${fieldControlClass} w-24`}
                        value={countedVal ?? ''}
                        onChange={(e) => setCounts((c) => ({ ...c, [q._id]: e.target.value }))}
                      />
                    </td>
                    <td className={diff === 0 ? '' : diff > 0 ? 'text-emerald-600' : 'text-rose-600'}>
                      {q.inventoryQuantitySet ? q.inventoryDiffQuantity : diff}
                    </td>
                    <td>
                      <button
                        type="button"
                        className={ghostBtn}
                        onClick={() => setCounted.mutate({ quantId: q._id, countedQty: countedVal })}
                      >
                        {isAr ? 'حفظ' : 'Save'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
