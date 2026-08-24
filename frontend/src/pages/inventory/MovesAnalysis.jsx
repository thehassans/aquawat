import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import api from '../../lib/api'
import { fieldControlClass } from './inventoryUi'

export default function MovesAnalysis() {
  const { language } = useSelector((state) => state.ui)
  const isAr = language === 'ar'
  const [groupBy, setGroupBy] = useState('product')

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['stock-moves-analysis', groupBy],
    queryFn: () => api.get('/stock/reports/moves-analysis', { params: { groupBy } }).then((r) => r.data),
  })

  const maxQty = Math.max(...rows.map((r) => Number(r.qty) || 0), 1)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{isAr ? 'تحليل الحركات' : 'Moves Analysis'}</h1>
          <p className="text-gray-500 mt-1">{isAr ? 'تجميع الكميات حسب البعد' : 'Pivot quantities by dimension'}</p>
        </div>
        <select className={`${fieldControlClass} max-w-[200px]`} value={groupBy} onChange={(e) => setGroupBy(e.target.value)}>
          <option value="product">{isAr ? 'منتج' : 'Product'}</option>
          <option value="category">{isAr ? 'فئة' : 'Category'}</option>
          <option value="date">{isAr ? 'تاريخ' : 'Date'}</option>
          <option value="state">{isAr ? 'حالة' : 'State'}</option>
        </select>
      </div>

      <div className="card p-4 space-y-3">
        {isLoading && <p className="text-slate-500">…</p>}
        {!isLoading && rows.length === 0 && <p className="text-slate-500">{isAr ? 'لا بيانات' : 'No data'}</p>}
        {rows.slice(0, 40).map((r) => (
          <div key={r.key} className="flex items-center gap-3 text-sm">
            <div className="w-40 truncate font-medium">{r.label}</div>
            <div className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-dark-700 overflow-hidden">
              <div className="h-full bg-teal-600 dark:bg-teal-400" style={{ width: `${(Number(r.qty) / maxQty) * 100}%` }} />
            </div>
            <div className="w-20 text-end tabular-nums">{r.qty}</div>
            <div className="w-12 text-end text-slate-400">{r.count}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
