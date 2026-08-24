import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import { fieldControlClass, primaryBtn } from './inventoryUi'

export default function PutawayRulesList() {
  const { language } = useSelector((state) => state.ui)
  const isAr = language === 'ar'
  const queryClient = useQueryClient()
  const [form, setForm] = useState({ locationInId: '', locationOutId: '', productId: '', sequence: 10 })

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ['stock-putaway'],
    queryFn: () => api.get('/stock/putaway-rules').then((r) => r.data),
  })
  const { data: locations = [] } = useQuery({
    queryKey: ['stock-locations'],
    queryFn: () => api.get('/stock/locations').then((r) => r.data),
  })
  const { data: variants = [] } = useQuery({
    queryKey: ['stock-variants'],
    queryFn: () => api.get('/stock/products/variants').then((r) => r.data),
  })

  const create = useMutation({
    mutationFn: (payload) => api.post('/stock/putaway-rules', payload),
    onSuccess: () => {
      toast.success(isAr ? 'تم' : 'Created')
      queryClient.invalidateQueries(['stock-putaway'])
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Error'),
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{isAr ? 'قواعد التخزين' : 'Putaway Rules'}</h1>
        <p className="text-gray-500 mt-1">{isAr ? 'تحديد الموقع الفرعي عند الاستلام' : 'Resolve destination sublocation on receipt'}</p>
      </div>

      <form
        className="card p-4 grid gap-3 md:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault()
          create.mutate({
            ...form,
            productId: form.productId || null,
            sequence: Number(form.sequence) || 10,
          })
        }}
      >
        <div>
          <label className="label">{isAr ? 'موقع الدخول' : 'Location in'}</label>
          <select className={fieldControlClass} required value={form.locationInId} onChange={(e) => setForm({ ...form, locationInId: e.target.value })}>
            <option value="">—</option>
            {locations.map((l) => <option key={l._id} value={l._id}>{l.completeName}</option>)}
          </select>
        </div>
        <div>
          <label className="label">{isAr ? 'موقع التخزين' : 'Putaway to'}</label>
          <select className={fieldControlClass} required value={form.locationOutId} onChange={(e) => setForm({ ...form, locationOutId: e.target.value })}>
            <option value="">—</option>
            {locations.filter((l) => l.usage === 'internal').map((l) => <option key={l._id} value={l._id}>{l.completeName}</option>)}
          </select>
        </div>
        <div>
          <label className="label">{isAr ? 'منتج (اختياري)' : 'Product (optional)'}</label>
          <select className={fieldControlClass} value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value })}>
            <option value="">—</option>
            {variants.map((v) => <option key={v._id} value={v._id}>{v.templateId?.name || v.defaultCode || v._id}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Sequence</label>
          <input type="number" className={fieldControlClass} value={form.sequence} onChange={(e) => setForm({ ...form, sequence: e.target.value })} />
        </div>
        <div className="md:col-span-2">
          <button type="submit" className={primaryBtn}>{isAr ? 'إضافة' : 'Add'}</button>
        </div>
      </form>

      <div className="card overflow-hidden">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Seq</th>
                <th>{isAr ? 'من' : 'In'}</th>
                <th>{isAr ? 'إلى' : 'Out'}</th>
                <th>{isAr ? 'منتج' : 'Product'}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={4} className="text-center py-6">…</td></tr>}
              {rules.map((r) => (
                <tr key={r._id}>
                  <td>{r.sequence}</td>
                  <td className="text-sm">{r.locationInId?.completeName}</td>
                  <td className="text-sm">{r.locationOutId?.completeName}</td>
                  <td className="text-sm">{r.productId?.defaultCode || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
