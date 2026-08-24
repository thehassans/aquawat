import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import toast from 'react-hot-toast'
import { Plus } from 'lucide-react'
import api from '../../lib/api'
import { INVENTORY_PATH, fieldControlClass, primaryBtn } from './inventoryUi'

export default function LandedCostsList() {
  const { language } = useSelector((state) => state.ui)
  const isAr = language === 'ar'
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ pickingIds: [], costName: 'Freight', price: '0', splitMethod: 'by_quantity' })

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['stock-landed-costs'],
    queryFn: () => api.get('/stock/landed-costs').then((r) => r.data),
  })

  const { data: receipts } = useQuery({
    queryKey: ['stock-pickings-done-in'],
    queryFn: () => api.get('/stock/pickings', { params: { code: 'incoming', state: 'done', limit: 50 } }).then((r) => r.data),
  })

  const create = useMutation({
    mutationFn: (payload) => api.post('/stock/landed-costs', payload),
    onSuccess: (res) => {
      toast.success(isAr ? 'تم الإنشاء' : 'Created')
      setShowForm(false)
      queryClient.invalidateQueries(['stock-landed-costs'])
      navigate(INVENTORY_PATH.landedCost(res.data._id))
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Error'),
  })

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{isAr ? 'التكاليف المرسية' : 'Landed Costs'}</h1>
          <p className="text-gray-500 mt-1">{isAr ? 'توزيع التكاليف على طبقات التقييم' : 'Allocate extra costs onto valuation layers'}</p>
        </div>
        <button type="button" className={primaryBtn} onClick={() => setShowForm((v) => !v)}>
          <Plus className="w-4 h-4" />{isAr ? 'جديد' : 'New'}
        </button>
      </div>

      {showForm && (
        <form
          className="card p-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            create.mutate({
              pickingIds: form.pickingIds,
              costLines: [{ name: form.costName, price: form.price, splitMethod: form.splitMethod }],
            })
          }}
        >
          <div>
            <label className="label">{isAr ? 'إيصالات منجزة' : 'Done receipts'}</label>
            <select
              multiple
              className={`${fieldControlClass} min-h-[100px]`}
              value={form.pickingIds}
              onChange={(e) => setForm({
                ...form,
                pickingIds: [...e.target.selectedOptions].map((o) => o.value),
              })}
            >
              {(receipts?.items || []).map((p) => (
                <option key={p._id} value={p._id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className="grid md:grid-cols-3 gap-3">
            <input className={fieldControlClass} placeholder="Cost name" value={form.costName} onChange={(e) => setForm({ ...form, costName: e.target.value })} />
            <input className={fieldControlClass} placeholder="Amount" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
            <select className={fieldControlClass} value={form.splitMethod} onChange={(e) => setForm({ ...form, splitMethod: e.target.value })}>
              <option value="by_quantity">by_quantity</option>
              <option value="by_weight">by_weight</option>
              <option value="by_volume">by_volume</option>
              <option value="by_current_cost_price">by_current_cost_price</option>
              <option value="equal">equal</option>
            </select>
          </div>
          <button type="submit" className={primaryBtn}>{isAr ? 'إنشاء' : 'Create'}</button>
        </form>
      )}

      <div className="card overflow-hidden">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>{isAr ? 'المرجع' : 'Name'}</th>
                <th>{isAr ? 'الحالة' : 'State'}</th>
                <th>{isAr ? 'التاريخ' : 'Date'}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={3} className="text-center py-6">…</td></tr>}
              {items.map((lc) => (
                <tr key={lc._id}>
                  <td>
                    <Link to={INVENTORY_PATH.landedCost(lc._id)} className="text-teal-700 dark:text-teal-400 font-medium">
                      {lc.name}
                    </Link>
                  </td>
                  <td><span className={`badge ${lc.state === 'done' ? 'badge-success' : 'badge-warning'}`}>{lc.state}</span></td>
                  <td>{lc.date ? new Date(lc.date).toLocaleDateString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
