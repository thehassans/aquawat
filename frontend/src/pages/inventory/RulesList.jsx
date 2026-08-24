import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import { fieldControlClass, primaryBtn } from './inventoryUi'

export default function RulesList() {
  const { language } = useSelector((state) => state.ui)
  const isAr = language === 'ar'
  const queryClient = useQueryClient()
  const [form, setForm] = useState({
    name: '',
    routeId: '',
    action: 'pull',
    locationSrcId: '',
    locationDestId: '',
    procureMethod: 'make_to_stock',
    operationTypeId: '',
  })

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ['stock-rules'],
    queryFn: () => api.get('/stock/rules').then((r) => r.data),
  })
  const { data: routes = [] } = useQuery({
    queryKey: ['stock-routes'],
    queryFn: () => api.get('/stock/routes').then((r) => r.data),
  })
  const { data: locations = [] } = useQuery({
    queryKey: ['stock-locations'],
    queryFn: () => api.get('/stock/locations').then((r) => r.data),
  })
  const { data: opTypes = [] } = useQuery({
    queryKey: ['stock-op-types'],
    queryFn: () => api.get('/stock/operation-types').then((r) => r.data),
  })

  const create = useMutation({
    mutationFn: (payload) => api.post('/stock/rules', payload),
    onSuccess: () => {
      toast.success(isAr ? 'تم' : 'Created')
      queryClient.invalidateQueries(['stock-rules'])
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Error'),
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{isAr ? 'القواعد' : 'Rules'}</h1>
      </div>

      <form
        className="card p-4 grid gap-3 md:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault()
          create.mutate({
            ...form,
            locationSrcId: form.locationSrcId || null,
            operationTypeId: form.operationTypeId || null,
          })
        }}
      >
        <div>
          <label className="label">{isAr ? 'الاسم' : 'Name'}</label>
          <input className={fieldControlClass} required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div>
          <label className="label">{isAr ? 'المسار' : 'Route'}</label>
          <select className={fieldControlClass} required value={form.routeId} onChange={(e) => setForm({ ...form, routeId: e.target.value })}>
            <option value="">—</option>
            {routes.map((r) => <option key={r._id} value={r._id}>{r.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Action</label>
          <select className={fieldControlClass} value={form.action} onChange={(e) => setForm({ ...form, action: e.target.value })}>
            {['pull', 'push', 'pull_push', 'buy', 'manufacture'].map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Procure method</label>
          <select className={fieldControlClass} value={form.procureMethod} onChange={(e) => setForm({ ...form, procureMethod: e.target.value })}>
            <option value="make_to_stock">make_to_stock</option>
            <option value="make_to_order">make_to_order</option>
            <option value="mts_else_mto">mts_else_mto</option>
          </select>
        </div>
        <div>
          <label className="label">{isAr ? 'من' : 'Source'}</label>
          <select className={fieldControlClass} value={form.locationSrcId} onChange={(e) => setForm({ ...form, locationSrcId: e.target.value })}>
            <option value="">—</option>
            {locations.map((l) => <option key={l._id} value={l._id}>{l.completeName}</option>)}
          </select>
        </div>
        <div>
          <label className="label">{isAr ? 'إلى' : 'Destination'}</label>
          <select className={fieldControlClass} required value={form.locationDestId} onChange={(e) => setForm({ ...form, locationDestId: e.target.value })}>
            <option value="">—</option>
            {locations.map((l) => <option key={l._id} value={l._id}>{l.completeName}</option>)}
          </select>
        </div>
        <div>
          <label className="label">{isAr ? 'نوع العملية' : 'Operation type'}</label>
          <select className={fieldControlClass} value={form.operationTypeId} onChange={(e) => setForm({ ...form, operationTypeId: e.target.value })}>
            <option value="">—</option>
            {opTypes.map((o) => <option key={o._id} value={o._id}>{o.name}</option>)}
          </select>
        </div>
        <div className="md:col-span-2">
          <button type="submit" className={primaryBtn}>{isAr ? 'إضافة قاعدة' : 'Add rule'}</button>
        </div>
      </form>

      <div className="card overflow-hidden">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>{isAr ? 'الاسم' : 'Name'}</th>
                <th>Action</th>
                <th>{isAr ? 'المسار' : 'Route'}</th>
                <th>{isAr ? 'من → إلى' : 'From → To'}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={4} className="text-center py-6">…</td></tr>}
              {rules.map((r) => (
                <tr key={r._id}>
                  <td>{r.name}</td>
                  <td><span className="badge badge-info">{r.action}</span></td>
                  <td>{r.routeId?.name || '—'}</td>
                  <td className="text-sm">{r.locationSrcId?.completeName || '—'} → {r.locationDestId?.completeName || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
