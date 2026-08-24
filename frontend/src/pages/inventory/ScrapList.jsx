import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import toast from 'react-hot-toast'
import { Plus } from 'lucide-react'
import api from '../../lib/api'
import { fieldControlClass, ghostBtn, primaryBtn } from './inventoryUi'

export default function ScrapList() {
  const { language } = useSelector((state) => state.ui)
  const isAr = language === 'ar'
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ productId: '', locationId: '', quantity: '1', scrapReasonTag: '' })

  const { data: scraps = [], isLoading } = useQuery({
    queryKey: ['stock-scraps'],
    queryFn: () => api.get('/stock/scraps').then((r) => r.data),
  })

  const { data: variants = [] } = useQuery({
    queryKey: ['stock-variants'],
    queryFn: () => api.get('/stock/products/variants').then((r) => r.data),
  })

  const { data: locations = [] } = useQuery({
    queryKey: ['stock-locations-internal'],
    queryFn: () => api.get('/stock/locations', { params: { usage: 'internal' } }).then((r) => r.data),
  })

  const createMut = useMutation({
    mutationFn: (payload) => api.post('/stock/scraps', payload),
    onSuccess: () => {
      toast.success(isAr ? 'تم الإنشاء' : 'Created')
      setShowForm(false)
      queryClient.invalidateQueries(['stock-scraps'])
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Error'),
  })

  const validateMut = useMutation({
    mutationFn: (id) => api.post(`/stock/scraps/${id}/validate`),
    onSuccess: () => {
      toast.success(isAr ? 'تم الإهلاك' : 'Scrapped')
      queryClient.invalidateQueries(['stock-scraps'])
      queryClient.invalidateQueries(['stock-report'])
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Error'),
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{isAr ? 'الهالك' : 'Scrap'}</h1>
          <p className="text-gray-500 mt-1">{isAr ? 'نقل الكمية إلى موقع الهالك' : 'Move quantity to scrap location'}</p>
        </div>
        <button type="button" className={primaryBtn} onClick={() => setShowForm((v) => !v)}>
          <Plus className="w-4 h-4" />
          {isAr ? 'جديد' : 'New'}
        </button>
      </div>

      {showForm && (
        <form
          className="card p-4 grid gap-3 md:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault()
            createMut.mutate(form)
          }}
        >
          <div>
            <label className="label">{isAr ? 'المنتج' : 'Product'}</label>
            <select className={fieldControlClass} value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value })} required>
              <option value="">—</option>
              {variants.map((v) => (
                <option key={v._id} value={v._id}>{v.templateId?.name || v.defaultCode || v._id}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">{isAr ? 'الموقع' : 'Location'}</label>
            <select className={fieldControlClass} value={form.locationId} onChange={(e) => setForm({ ...form, locationId: e.target.value })} required>
              <option value="">—</option>
              {locations.map((l) => (
                <option key={l._id} value={l._id}>{l.completeName}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">{isAr ? 'الكمية' : 'Quantity'}</label>
            <input className={fieldControlClass} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
          </div>
          <div>
            <label className="label">{isAr ? 'السبب' : 'Reason'}</label>
            <input className={fieldControlClass} value={form.scrapReasonTag} onChange={(e) => setForm({ ...form, scrapReasonTag: e.target.value })} />
          </div>
          <div className="md:col-span-2">
            <button type="submit" className={primaryBtn} disabled={createMut.isPending}>{isAr ? 'حفظ' : 'Save'}</button>
          </div>
        </form>
      )}

      <div className="card overflow-hidden">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>{isAr ? 'المرجع' : 'Reference'}</th>
                <th>{isAr ? 'المنتج' : 'Product'}</th>
                <th>{isAr ? 'الكمية' : 'Qty'}</th>
                <th>{isAr ? 'الحالة' : 'State'}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={5} className="text-center py-6 text-slate-500">…</td></tr>}
              {scraps.map((s) => (
                <tr key={s._id}>
                  <td>{s.name}</td>
                  <td>{s.productId?.defaultCode || String(s.productId?._id || s.productId).slice(-6)}</td>
                  <td>{s.quantity}</td>
                  <td><span className={`badge ${s.state === 'done' ? 'badge-neutral' : 'badge-warning'}`}>{s.state}</span></td>
                  <td>
                    {s.state === 'draft' && (
                      <button type="button" className={ghostBtn} onClick={() => validateMut.mutate(s._id)}>
                        {isAr ? 'اعتماد' : 'Validate'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
