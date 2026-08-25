import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import { fieldControlClass, primaryBtn, stockProductLabel } from './inventoryUi'

export default function OrderpointsConfigList() {
  const { language } = useSelector((state) => state.ui)
  const isAr = language === 'ar'
  const queryClient = useQueryClient()
  const [productId, setProductId] = useState('')
  const [warehouseId, setWarehouseId] = useState('')
  const [minQty, setMinQty] = useState('0')
  const [maxQty, setMaxQty] = useState('0')
  const [multiple, setMultiple] = useState('1')
  const [trigger, setTrigger] = useState('auto')

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['stock-orderpoints-permanent'],
    queryFn: () => api.get('/stock/orderpoints', { params: { permanentOnly: 1 } }).then((r) => r.data),
  })

  const { data: variants = [] } = useQuery({
    queryKey: ['stock-variants-pick'],
    queryFn: () => api.get('/stock/products/variants', { params: { limit: 200 } }).then((r) => r.data),
  })

  const { data: warehouses = [] } = useQuery({
    queryKey: ['stock-warehouses'],
    queryFn: () => api.get('/stock/warehouses').then((r) => r.data),
  })

  const save = useMutation({
    mutationFn: (payload) => api.post('/stock/orderpoints', payload),
    onSuccess: () => {
      toast.success(isAr ? 'تم الحفظ' : 'Saved')
      setProductId('')
      setMinQty('0')
      setMaxQty('0')
      queryClient.invalidateQueries(['stock-orderpoints-permanent'])
      queryClient.invalidateQueries(['stock-orderpoints'])
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Error'),
  })

  const selectedWh = warehouses.find((w) => w._id === warehouseId)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">{isAr ? 'قواعد إعادة الطلب' : 'Reordering Rules'}</h2>
        <p className="text-sm text-slate-500 mt-1">
          {isAr ? 'الحد الأدنى/الأقصى للمجدول' : 'Min/max rules used by the scheduler'}
        </p>
      </div>

      <form
        className="card p-4 grid gap-3 md:grid-cols-3 lg:grid-cols-6 items-end"
        onSubmit={(e) => {
          e.preventDefault()
          if (!productId || !warehouseId || !selectedWh?.lotStockId) {
            toast.error(isAr ? 'اختر المنتج والمستودع' : 'Pick product and warehouse')
            return
          }
          save.mutate({
            productId,
            warehouseId,
            locationId: selectedWh.lotStockId,
            productMinQty: minQty,
            productMaxQty: maxQty,
            qtyMultiple: multiple,
            trigger,
          })
        }}
      >
        <div className="lg:col-span-2">
          <label className="label">{isAr ? 'المنتج' : 'Product'}</label>
          <select className={fieldControlClass} value={productId} onChange={(e) => setProductId(e.target.value)}>
            <option value="">—</option>
            {variants.map((v) => (
              <option key={v._id} value={v._id}>{stockProductLabel(v)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">{isAr ? 'المستودع' : 'Warehouse'}</label>
          <select className={fieldControlClass} value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
            <option value="">—</option>
            {warehouses.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">{isAr ? 'أدنى' : 'Min'}</label>
          <input className={fieldControlClass} value={minQty} onChange={(e) => setMinQty(e.target.value)} />
        </div>
        <div>
          <label className="label">{isAr ? 'أقصى' : 'Max'}</label>
          <input className={fieldControlClass} value={maxQty} onChange={(e) => setMaxQty(e.target.value)} />
        </div>
        <div>
          <label className="label">{isAr ? 'مضاعف' : 'Multiple'}</label>
          <input className={fieldControlClass} value={multiple} onChange={(e) => setMultiple(e.target.value)} />
        </div>
        <div>
          <label className="label">{isAr ? 'المشغّل' : 'Trigger'}</label>
          <select className={fieldControlClass} value={trigger} onChange={(e) => setTrigger(e.target.value)}>
            <option value="auto">auto</option>
            <option value="manual">manual</option>
          </select>
        </div>
        <button type="submit" className={`${primaryBtn} lg:col-span-6`} disabled={save.isPending}>
          {isAr ? 'حفظ القاعدة' : 'Save rule'}
        </button>
      </form>

      <div className="card overflow-hidden">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>{isAr ? 'المنتج' : 'Product'}</th>
                <th>{isAr ? 'الموقع' : 'Location'}</th>
                <th>{isAr ? 'أدنى' : 'Min'}</th>
                <th>{isAr ? 'أقصى' : 'Max'}</th>
                <th>{isAr ? 'المشغّل' : 'Trigger'}</th>
                <th>{isAr ? 'المتوقع' : 'Forecast'}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={6} className="text-center py-6">…</td></tr>}
              {!isLoading && rows.length === 0 && (
                <tr><td colSpan={6} className="text-center py-6 text-slate-500">{isAr ? 'لا قواعد' : 'No rules'}</td></tr>
              )}
              {rows.map((r) => (
                <tr key={r._id}>
                  <td>{stockProductLabel(r.productId)}</td>
                  <td>{r.locationId?.completeName || '—'}</td>
                  <td>{r.productMinQty}</td>
                  <td>{r.productMaxQty}</td>
                  <td>{r.trigger}</td>
                  <td>{r.qtyForecast}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
