import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import EmptyState from '../../components/ui/EmptyState'

export default function StockReport() {
  const { language } = useSelector((s) => s.ui)
  const qc = useQueryClient()
  const [warehouseId, setWarehouseId] = useState('')
  const [editing, setEditing] = useState(null)
  const [editValue, setEditValue] = useState('')

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => api.get('/warehouses').then((r) => r.data?.warehouses || r.data || []),
    staleTime: 10 * 60 * 1000,
  })

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['stock-report', warehouseId],
    queryFn: () =>
      api.get('/stock/report/stock', { params: warehouseId ? { warehouseId } : {} }).then((r) => r.data),
    placeholderData: (prev) => prev,
    staleTime: 30_000,
  })

  const adjust = useMutation({
    mutationFn: ({ productId, onHand }) =>
      api.post(`/stock/report/stock/${productId}/adjust`, {
        warehouseId: warehouseId || warehouses[0]?._id,
        onHand,
        reason: 'Stock report inline edit',
      }),
    onSuccess: () => {
      toast.success(language === 'ar' ? 'تم عبر حركة تسوية' : 'Adjusted via ledger move')
      setEditing(null)
      qc.invalidateQueries({ queryKey: ['stock-report'] })
    },
    onError: (e) => toast.error(e.response?.data?.error || e.message),
  })

  const rows = data?.data || []
  const whList = Array.isArray(warehouses) ? warehouses : []

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
          {language === 'ar' ? 'تقرير المخزون' : 'Stock report'}
        </h2>
        <select className="select" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
          <option value="">{language === 'ar' ? 'كل المستودعات' : 'All warehouses'}</option>
          {whList.map((w) => (
            <option key={w._id} value={w._id}>
              {language === 'ar' && w.nameAr ? w.nameAr : w.nameEn}
            </option>
          ))}
        </select>
      </div>

      <p className="text-xs text-slate-500">
        {language === 'ar'
          ? 'تعديل الكمية ينشئ حركة تسوية — لا كتابة مباشرة على الرصيد.'
          : 'Editing On Hand creates an adjustment transfer — never a direct quantity write.'}
      </p>

      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-dark-600 dark:bg-dark-800">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-100 bg-slate-50/80 text-xs uppercase text-slate-500 dark:border-dark-600 dark:bg-dark-900/50">
            <tr>
              <th className="px-4 py-3 text-start">{language === 'ar' ? 'المنتج' : 'Product'}</th>
              <th className="px-4 py-3 text-start">{language === 'ar' ? 'التكلفة' : 'Unit cost'}</th>
              <th className="px-4 py-3 text-start">{language === 'ar' ? 'المتاح' : 'On hand'}</th>
              <th className="px-4 py-3 text-start">{language === 'ar' ? 'حر' : 'Free'}</th>
              <th className="px-4 py-3 text-start">{language === 'ar' ? 'وارد' : 'In'}</th>
              <th className="px-4 py-3 text-start">{language === 'ar' ? 'صادر' : 'Out'}</th>
              <th className="px-4 py-3 text-start">{language === 'ar' ? 'متوقع' : 'Forecast'}</th>
            </tr>
          </thead>
          <tbody className={isFetching && !isLoading ? 'opacity-60 transition-opacity' : ''}>
            {isLoading && !rows.length && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">…</td></tr>
            )}
            {!isLoading && rows.length === 0 && (
              <tr>
                <td colSpan={7} className="p-8">
                  <EmptyState
                    title={language === 'ar' ? 'لا مخزون بعد' : 'No stock yet'}
                    description={language === 'ar' ? 'رحّل الأرصدة أو استلم بضاعة' : 'Migrate balances or validate a receipt'}
                  />
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row.productId} className="border-b border-slate-50 dark:border-dark-700">
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-900 dark:text-white">
                    {language === 'ar' && row.product?.nameAr ? row.product.nameAr : row.product?.nameEn}
                  </div>
                  <div className="text-xs text-slate-400">{row.product?.sku}</div>
                </td>
                <td className="px-4 py-3 tabular-nums">{row.unitCost ?? '—'}</td>
                <td className="px-4 py-3">
                  {editing === row.productId ? (
                    <form
                      className="flex gap-1"
                      onSubmit={(e) => {
                        e.preventDefault()
                        if (!warehouseId && !whList[0]?._id) {
                          toast.error(language === 'ar' ? 'اختر مستودعاً' : 'Select a warehouse')
                          return
                        }
                        adjust.mutate({ productId: row.productId, onHand: editValue })
                      }}
                    >
                      <input
                        className="input w-24"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        autoFocus
                      />
                      <button type="submit" className="btn btn-primary btn-sm">OK</button>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditing(null)}>×</button>
                    </form>
                  ) : (
                    <button
                      type="button"
                      className="tabular-nums font-medium text-primary-700 hover:underline dark:text-primary-300"
                      onClick={() => {
                        setEditing(row.productId)
                        setEditValue(row.onHand)
                      }}
                    >
                      {row.onHand}
                    </button>
                  )}
                </td>
                <td className="px-4 py-3 tabular-nums">{row.freeToUse}</td>
                <td className="px-4 py-3 tabular-nums text-emerald-600">{row.incoming}</td>
                <td className="px-4 py-3 tabular-nums text-rose-600">{row.outgoing}</td>
                <td className="px-4 py-3 tabular-nums font-medium">{row.forecast}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
