import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import { fieldControlClass, ghostBtn, primaryBtn, INVENTORY_PATH, PICKING_STATUS_PILL, pickingStatusLabel } from './inventoryUi'

export default function BatchesList() {
  const { language } = useSelector((state) => state.ui)
  const isAr = language === 'ar'
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['stock-batches'],
    queryFn: () => api.get('/stock/batches').then((r) => r.data),
  })

  const create = useMutation({
    mutationFn: () => api.post('/stock/batches', {}),
    onSuccess: (res) => {
      toast.success(isAr ? 'تم' : 'Created')
      queryClient.invalidateQueries(['stock-batches'])
      navigate(INVENTORY_PATH.batch(res.data._id))
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Error'),
  })

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">{isAr ? 'دفعات التحويل' : 'Transfer Batches'}</h1>
          <p className="text-sm text-slate-500 mt-1">{isAr ? 'تجميع عدة تحويلات لمعالجتها معاً' : 'Group transfers to process together'}</p>
        </div>
        <button type="button" className={primaryBtn} onClick={() => create.mutate()} disabled={create.isPending}>
          {isAr ? 'دفعة جديدة' : 'New batch'}
        </button>
      </div>
      <div className="card overflow-hidden">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>{isAr ? 'الاسم' : 'Name'}</th>
                <th>{isAr ? 'الحالة' : 'State'}</th>
                <th>{isAr ? 'تحويلات' : 'Pickings'}</th>
                <th>{isAr ? 'التاريخ' : 'Date'}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={4} className="text-center py-6">…</td></tr>}
              {!isLoading && !items.length && (
                <tr><td colSpan={4} className="text-center py-6 text-slate-500">{isAr ? 'لا دفعات' : 'No batches'}</td></tr>
              )}
              {items.map((b) => (
                <tr key={b._id}>
                  <td>
                    <Link to={INVENTORY_PATH.batch(b._id)} className="font-medium text-teal-700 dark:text-teal-400">
                      {b.name}
                    </Link>
                  </td>
                  <td><span className={`badge ${PICKING_STATUS_PILL[b.state] || 'badge-neutral'}`}>{b.state}</span></td>
                  <td>{b.pickingIds?.length || 0}</td>
                  <td>{b.scheduledDate ? new Date(b.scheduledDate).toLocaleDateString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export function BatchForm() {
  const { id } = useParams()
  const { language } = useSelector((state) => state.ui)
  const isAr = language === 'ar'
  const queryClient = useQueryClient()
  const [selected, setSelected] = useState([])

  const { data, isLoading } = useQuery({
    queryKey: ['stock-batch', id],
    queryFn: () => api.get(`/stock/batches/${id}`).then((r) => r.data),
    enabled: Boolean(id),
  })

  const { data: openPickings = [] } = useQuery({
    queryKey: ['stock-pickings-open'],
    queryFn: () => api.get('/stock/pickings', { params: { state: 'assigned,confirmed,waiting,draft', limit: 100 } }).then((r) => r.data?.items || r.data || []),
  })

  const savePickings = useMutation({
    mutationFn: (pickingIds) => api.put(`/stock/batches/${id}/pickings`, { pickingIds }),
    onSuccess: () => {
      toast.success(isAr ? 'تم' : 'Saved')
      queryClient.invalidateQueries(['stock-batch', id])
      queryClient.invalidateQueries(['stock-batches'])
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Error'),
  })

  const action = useMutation({
    mutationFn: (act) => api.post(`/stock/batches/${id}/${act}`, act === 'validate' ? { createBackorder: 'ask' } : {}),
    onSuccess: (res) => {
      const fail = (res.data?.results || []).filter((r) => !r.ok).length
      toast.success(fail ? `${fail} failed` : (isAr ? 'تم' : 'Done'))
      queryClient.invalidateQueries(['stock-batch', id])
      queryClient.invalidateQueries(['stock-batches'])
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Error'),
  })

  const batch = data?.batch
  const pickings = data?.pickings || []

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link to={INVENTORY_PATH.batches} className={ghostBtn}>{isAr ? 'رجوع' : 'Back'}</Link>
        <h1 className="text-2xl font-bold">{batch?.name || '…'}</h1>
        {batch && <span className={`badge ${PICKING_STATUS_PILL[batch.state] || 'badge-neutral'}`}>{batch.state}</span>}
      </div>

      {isLoading && <p>…</p>}

      <div className="flex flex-wrap gap-2">
        {['confirm', 'check', 'validate', 'cancel'].map((act) => (
          <button key={act} type="button" className={ghostBtn} onClick={() => action.mutate(act)} disabled={action.isPending}>
            {act}
          </button>
        ))}
      </div>

      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b font-medium">{isAr ? 'التحويلات في الدفعة' : 'Pickings in batch'}</div>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>{isAr ? 'الاسم' : 'Name'}</th>
                <th>{isAr ? 'الحالة' : 'State'}</th>
              </tr>
            </thead>
            <tbody>
              {pickings.map((p) => (
                <tr key={p._id}>
                  <td>
                    <Link to={INVENTORY_PATH.picking(p._id)} className="text-teal-700 dark:text-teal-400">{p.name}</Link>
                  </td>
                  <td>{pickingStatusLabel(p.state, language)}</td>
                </tr>
              ))}
              {!pickings.length && <tr><td colSpan={2} className="text-center py-4 text-slate-500">{isAr ? 'فارغ' : 'Empty'}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card p-4 space-y-3">
        <h2 className="font-medium">{isAr ? 'إضافة تحويلات مفتوحة' : 'Add open transfers'}</h2>
        <select
          multiple
          className={`${fieldControlClass} min-h-[140px]`}
          value={selected}
          onChange={(e) => setSelected([...e.target.selectedOptions].map((o) => o.value))}
        >
          {(Array.isArray(openPickings) ? openPickings : []).map((p) => (
            <option key={p._id} value={p._id}>{p.name} ({p.state})</option>
          ))}
        </select>
        <button
          type="button"
          className={primaryBtn}
          disabled={savePickings.isPending}
          onClick={() => {
            const current = pickings.map((p) => p._id)
            const merged = [...new Set([...current, ...selected])]
            savePickings.mutate(merged)
          }}
        >
          {isAr ? 'حفظ القائمة' : 'Save picking list'}
        </button>
      </div>
    </div>
  )
}
