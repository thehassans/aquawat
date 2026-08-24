import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import { fieldControlClass, primaryBtn } from './inventoryUi'

export default function ProductCategoriesList() {
  const { language } = useSelector((state) => state.ui)
  const isAr = language === 'ar'
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [parentId, setParentId] = useState('')
  const [costMethod, setCostMethod] = useState('average')
  const [removalStrategy, setRemovalStrategy] = useState('')

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['stock-product-categories'],
    queryFn: () => api.get('/stock/product-categories').then((r) => r.data),
  })

  const create = useMutation({
    mutationFn: (payload) => api.post('/stock/product-categories', payload),
    onSuccess: () => {
      toast.success(isAr ? 'تم' : 'Created')
      setName('')
      setParentId('')
      queryClient.invalidateQueries(['stock-product-categories'])
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Error'),
  })

  const patch = useMutation({
    mutationFn: ({ id, ...payload }) => api.patch(`/stock/product-categories/${id}`, payload),
    onSuccess: () => {
      toast.success(isAr ? 'تم' : 'Updated')
      queryClient.invalidateQueries(['stock-product-categories'])
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Error'),
  })

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">{isAr ? 'فئات المنتجات' : 'Product Categories'}</h2>
        <p className="text-sm text-slate-500 mt-1">
          {isAr ? 'طريقة التكلفة واستراتيجية الإزالة لكل فئة' : 'Cost method and removal strategy per category'}
        </p>
      </div>

      <form
        className="card p-4 grid gap-3 md:grid-cols-5 items-end"
        onSubmit={(e) => {
          e.preventDefault()
          if (!name.trim()) return
          create.mutate({
            name: name.trim(),
            parentId: parentId || undefined,
            costMethod,
            removalStrategy: removalStrategy || null,
          })
        }}
      >
        <div>
          <label className="label">{isAr ? 'الاسم' : 'Name'}</label>
          <input className={fieldControlClass} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="label">{isAr ? 'الأب' : 'Parent'}</label>
          <select className={fieldControlClass} value={parentId} onChange={(e) => setParentId(e.target.value)}>
            <option value="">—</option>
            {items.map((c) => (
              <option key={c._id} value={c._id}>{c.completeName}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">{isAr ? 'التكلفة' : 'Cost method'}</label>
          <select className={fieldControlClass} value={costMethod} onChange={(e) => setCostMethod(e.target.value)}>
            <option value="standard">standard</option>
            <option value="average">average</option>
            <option value="fifo">fifo</option>
          </select>
        </div>
        <div>
          <label className="label">{isAr ? 'الإزالة' : 'Removal'}</label>
          <select className={fieldControlClass} value={removalStrategy} onChange={(e) => setRemovalStrategy(e.target.value)}>
            <option value="">—</option>
            <option value="fifo">fifo</option>
            <option value="lifo">lifo</option>
            <option value="fefo">fefo</option>
            <option value="closest">closest</option>
          </select>
        </div>
        <button type="submit" className={primaryBtn} disabled={create.isPending}>
          {isAr ? 'إضافة' : 'Add'}
        </button>
      </form>

      <div className="card overflow-hidden">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>{isAr ? 'الاسم' : 'Name'}</th>
                <th>{isAr ? 'التكلفة' : 'Cost'}</th>
                <th>{isAr ? 'التقييم' : 'Valuation'}</th>
                <th>{isAr ? 'الإزالة' : 'Removal'}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={4} className="text-center py-6">…</td></tr>}
              {!isLoading && items.length === 0 && (
                <tr><td colSpan={4} className="text-center py-6 text-slate-500">{isAr ? 'لا فئات' : 'No categories'}</td></tr>
              )}
              {items.map((c) => (
                <tr key={c._id}>
                  <td>{c.completeName}</td>
                  <td>
                    <select
                      className={fieldControlClass}
                      value={c.costMethod || 'average'}
                      onChange={(e) => patch.mutate({ id: c._id, costMethod: e.target.value })}
                    >
                      <option value="standard">standard</option>
                      <option value="average">average</option>
                      <option value="fifo">fifo</option>
                    </select>
                  </td>
                  <td>
                    <select
                      className={fieldControlClass}
                      value={c.valuation || 'real_time'}
                      onChange={(e) => patch.mutate({ id: c._id, valuation: e.target.value })}
                    >
                      <option value="real_time">real_time</option>
                      <option value="manual_periodic">manual_periodic</option>
                    </select>
                  </td>
                  <td>
                    <select
                      className={fieldControlClass}
                      value={c.removalStrategy || ''}
                      onChange={(e) => patch.mutate({ id: c._id, removalStrategy: e.target.value || null })}
                    >
                      <option value="">—</option>
                      <option value="fifo">fifo</option>
                      <option value="lifo">lifo</option>
                      <option value="fefo">fefo</option>
                      <option value="closest">closest</option>
                    </select>
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
