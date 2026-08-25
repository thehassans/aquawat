import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import { fieldControlClass, primaryBtn } from './inventoryUi'

const USAGES = ['view', 'internal', 'vendor', 'customer', 'inventory', 'production', 'transit']

export default function LocationsConfigList() {
  const { language } = useSelector((state) => state.ui)
  const isAr = language === 'ar'
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()
  const highlightId = searchParams.get('highlight')
  const highlightRef = useRef(null)
  const [name, setName] = useState('')
  const [usage, setUsage] = useState('internal')
  const [parentId, setParentId] = useState('')
  const [warehouseId, setWarehouseId] = useState('')

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['stock-locations-all'],
    queryFn: () => api.get('/stock/locations').then((r) => r.data),
  })

  const { data: warehouses = [] } = useQuery({
    queryKey: ['stock-warehouses'],
    queryFn: () => api.get('/stock/warehouses').then((r) => r.data),
  })

  const create = useMutation({
    mutationFn: (payload) => api.post('/stock/locations', payload),
    onSuccess: () => {
      toast.success(isAr ? 'تم' : 'Created')
      setName('')
      queryClient.invalidateQueries(['stock-locations-all'])
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Error'),
  })

  const patch = useMutation({
    mutationFn: ({ id, ...payload }) => api.patch(`/stock/locations/${id}`, payload),
    onSuccess: () => {
      toast.success(isAr ? 'تم' : 'Updated')
      queryClient.invalidateQueries(['stock-locations-all'])
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Error'),
  })

  useEffect(() => {
    if (highlightId && highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [highlightId, items])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">{isAr ? 'المواقع' : 'Locations'}</h2>
        <p className="text-sm text-slate-500 mt-1">
          {isAr ? 'شجرة المواقع واستراتيجية الإزالة' : 'Location tree and removal strategy'}
        </p>
      </div>

      <form
        className="card p-4 grid gap-3 md:grid-cols-5 items-end"
        onSubmit={(e) => {
          e.preventDefault()
          if (!name.trim()) return
          create.mutate({
            name: name.trim(),
            usage,
            parentId: parentId || undefined,
            warehouseId: warehouseId || undefined,
          })
        }}
      >
        <div>
          <label className="label">{isAr ? 'الاسم' : 'Name'}</label>
          <input className={fieldControlClass} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="label">{isAr ? 'النوع' : 'Usage'}</label>
          <select className={fieldControlClass} value={usage} onChange={(e) => setUsage(e.target.value)}>
            {USAGES.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
        <div>
          <label className="label">{isAr ? 'الأب' : 'Parent'}</label>
          <select className={fieldControlClass} value={parentId} onChange={(e) => setParentId(e.target.value)}>
            <option value="">—</option>
            {items.map((l) => <option key={l._id} value={l._id}>{l.completeName}</option>)}
          </select>
        </div>
        <div>
          <label className="label">{isAr ? 'المستودع' : 'Warehouse'}</label>
          <select className={fieldControlClass} value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
            <option value="">—</option>
            {warehouses.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}
          </select>
        </div>
        <button type="submit" className={primaryBtn} disabled={create.isPending}>{isAr ? 'إضافة' : 'Add'}</button>
      </form>

      <div className="card overflow-hidden">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>{isAr ? 'الاسم الكامل' : 'Complete name'}</th>
                <th>{isAr ? 'النوع' : 'Usage'}</th>
                <th>{isAr ? 'الإزالة' : 'Removal'}</th>
                <th>{isAr ? 'باركود' : 'Barcode'}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={4} className="text-center py-6">…</td></tr>}
              {items.map((l) => (
                <tr
                  key={l._id}
                  ref={String(l._id) === highlightId ? highlightRef : undefined}
                  className={String(l._id) === highlightId ? 'bg-teal-50/80 ring-2 ring-teal-500/30 dark:bg-teal-500/10' : undefined}
                >
                  <td>{l.completeName}</td>
                  <td>{l.usage}</td>
                  <td>
                    <select
                      className={fieldControlClass}
                      value={l.removalStrategy || ''}
                      onChange={(e) => patch.mutate({ id: l._id, removalStrategy: e.target.value || null })}
                    >
                      <option value="">—</option>
                      <option value="fifo">fifo</option>
                      <option value="lifo">lifo</option>
                      <option value="fefo">fefo</option>
                      <option value="closest">closest</option>
                    </select>
                  </td>
                  <td>
                    <input
                      className={fieldControlClass}
                      defaultValue={l.barcode || ''}
                      key={`${l._id}-${l.barcode || ''}`}
                      onBlur={(e) => {
                        const v = e.target.value || null
                        if (v !== (l.barcode || null)) patch.mutate({ id: l._id, barcode: v })
                      }}
                    />
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
