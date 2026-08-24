import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import toast from 'react-hot-toast'
import { Play, Plus } from 'lucide-react'
import api from '../../lib/api'
import { fieldControlClass, ghostBtn, primaryBtn } from './inventoryUi'

export default function Replenishment() {
  const { language } = useSelector((state) => state.ui)
  const isAr = language === 'ar'
  const queryClient = useQueryClient()
  const [confirmRun, setConfirmRun] = useState(false)

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['stock-orderpoints'],
    queryFn: () => api.get('/stock/orderpoints').then((r) => r.data),
  })

  const orderOnce = useMutation({
    mutationFn: (payload) => api.post('/stock/orderpoints/order-once', payload),
    onSuccess: () => {
      toast.success(isAr ? 'تم إنشاء التوريد' : 'Procurement created')
      queryClient.invalidateQueries(['stock-orderpoints'])
      queryClient.invalidateQueries(['stock-pickings'])
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Error'),
  })

  const snooze = useMutation({
    mutationFn: ({ id, preset }) => api.post(`/stock/orderpoints/${id}/snooze`, { preset }),
    onSuccess: () => {
      toast.success(isAr ? 'تم التأجيل' : 'Snoozed')
      queryClient.invalidateQueries(['stock-orderpoints'])
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Error'),
  })

  const saveRule = useMutation({
    mutationFn: (payload) => api.post('/stock/orderpoints', payload),
    onSuccess: () => {
      toast.success(isAr ? 'تم حفظ القاعدة' : 'Rule saved')
      queryClient.invalidateQueries(['stock-orderpoints'])
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Error'),
  })

  const runScheduler = useMutation({
    mutationFn: () => api.post('/stock/scheduler/run'),
    onSuccess: (res) => {
      toast.success(
        isAr
          ? `المجدول: ${res.data.procurementsCreated} توريد`
          : `Scheduler: ${res.data.procurementsCreated} procurements`,
      )
      setConfirmRun(false)
      queryClient.invalidateQueries(['stock-orderpoints'])
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Error'),
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {isAr ? 'إعادة التوريد' : 'Replenishment'}
          </h1>
          <p className="text-gray-500 mt-1">
            {isAr ? 'قواعد إعادة الطلب + صفوف افتراضية للتوقع السالب' : 'Reorder rules + virtual rows for negative forecast'}
          </p>
        </div>
        <button type="button" className={primaryBtn} onClick={() => setConfirmRun(true)}>
          <Play className="w-4 h-4" />
          {isAr ? 'تشغيل المجدول' : 'Run Scheduler'}
        </button>
      </div>

      {confirmRun && (
        <div className="card p-4 border-amber-200 bg-amber-50 dark:bg-amber-500/10 flex flex-wrap gap-3 items-center">
          <p className="text-sm flex-1">
            {isAr ? 'تشغيل المجدول الآن؟' : 'Run the replenishment scheduler now?'}
          </p>
          <button type="button" className={primaryBtn} onClick={() => runScheduler.mutate()} disabled={runScheduler.isPending}>
            {isAr ? 'تأكيد' : 'Confirm'}
          </button>
          <button type="button" className={ghostBtn} onClick={() => setConfirmRun(false)}>{isAr ? 'إلغاء' : 'Cancel'}</button>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>{isAr ? 'النوع' : 'Kind'}</th>
                <th>{isAr ? 'المنتج' : 'Product'}</th>
                <th>{isAr ? 'المستودع' : 'WH'}</th>
                <th>{isAr ? 'باليد' : 'On hand'}</th>
                <th>{isAr ? 'متوقع' : 'Forecast'}</th>
                <th>{isAr ? 'للطلب' : 'To order'}</th>
                <th>{isAr ? 'حد أدنى/أقصى' : 'Min/Max'}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={8} className="text-center py-8 text-slate-500">…</td></tr>}
              {!isLoading && rows.length === 0 && (
                <tr><td colSpan={8} className="text-center py-8 text-slate-500">{isAr ? 'لا توجد عناصر' : 'No rows'}</td></tr>
              )}
              {rows.map((r) => {
                const productId = r.productId?._id || r.productId
                const locationId = r.locationId?._id || r.locationId
                const warehouseId = r.warehouseId?._id || r.warehouseId
                const name = r.productId?.defaultCode || r.productId?.templateId?.name || String(productId).slice(-6)
                return (
                  <tr key={r._id} className={r.kind === 'virtual' ? 'bg-violet-50/40 dark:bg-violet-500/5' : ''}>
                    <td>
                      <span className={`badge ${r.kind === 'virtual' ? 'badge-info' : 'badge-neutral'}`}>
                        {r.kind === 'virtual' ? (isAr ? 'افتراضي' : 'Virtual') : (isAr ? 'دائم' : 'Rule')}
                      </span>
                    </td>
                    <td className="text-sm">{name}</td>
                    <td className="text-sm">{r.warehouseId?.code || '—'}</td>
                    <td>{r.qtyOnHand}</td>
                    <td className={Number(r.qtyForecast) < 0 ? 'text-rose-600 font-medium' : ''}>{r.qtyForecast}</td>
                    <td>{r.qtyToOrder}</td>
                    <td className="text-xs text-slate-500">{r.productMinQty} / {r.productMaxQty}</td>
                    <td className="space-x-1 rtl:space-x-reverse">
                      {Number(r.qtyToOrder) > 0 && (
                        <button
                          type="button"
                          className={ghostBtn}
                          onClick={() => orderOnce.mutate({
                            productId,
                            locationId,
                            warehouseId,
                            qty: r.qtyToOrder,
                            routeId: r.routeId,
                          })}
                        >
                          {isAr ? 'اطلب مرة' : 'Order Once'}
                        </button>
                      )}
                      {r.kind === 'virtual' && (
                        <button
                          type="button"
                          className={ghostBtn}
                          onClick={() => saveRule.mutate({
                            productId,
                            locationId,
                            warehouseId,
                            productMinQty: '0',
                            productMaxQty: r.qtyToOrder,
                            qtyMultiple: '1',
                            trigger: 'auto',
                          })}
                        >
                          <Plus className="w-3 h-3" />
                          {isAr ? 'حفظ قاعدة' : 'Save rule'}
                        </button>
                      )}
                      {r.kind === 'permanent' && !String(r._id).startsWith('virtual') && (
                        <>
                          <button type="button" className={ghostBtn} onClick={() => snooze.mutate({ id: r._id, preset: '1d' })}>1d</button>
                          <button type="button" className={ghostBtn} onClick={() => snooze.mutate({ id: r._id, preset: '1w' })}>1w</button>
                          <button type="button" className={ghostBtn} onClick={() => snooze.mutate({ id: r._id, preset: '1m' })}>1m</button>
                        </>
                      )}
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
