import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import { fieldControlClass, primaryBtn } from './inventoryUi'

export default function StorageCategoriesList() {
  const { language } = useSelector((state) => state.ui)
  const isAr = language === 'ar'
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [maxWeight, setMaxWeight] = useState('')
  const [allowNewProduct, setAllowNewProduct] = useState('mixed')

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['stock-storage-categories'],
    queryFn: () => api.get('/stock/storage-categories').then((r) => r.data),
  })

  const create = useMutation({
    mutationFn: (payload) => api.post('/stock/storage-categories', payload),
    onSuccess: () => {
      toast.success(isAr ? 'تم' : 'Created')
      setName('')
      setMaxWeight('')
      queryClient.invalidateQueries(['stock-storage-categories'])
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Error'),
  })

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">{isAr ? 'فئات التخزين' : 'Storage Categories'}</h2>
        <p className="text-sm text-slate-500 mt-1">
          {isAr ? 'تُستخدم مع قواعد التخزين لتحديد السعة' : 'Used with putaway rules for capacity constraints'}
        </p>
      </div>

      <form
        className="card p-4 grid gap-3 md:grid-cols-4 items-end"
        onSubmit={(e) => {
          e.preventDefault()
          if (!name.trim()) return
          create.mutate({
            name: name.trim(),
            maxWeight: maxWeight || undefined,
            allowNewProduct,
          })
        }}
      >
        <div>
          <label className="label">{isAr ? 'الاسم' : 'Name'}</label>
          <input className={fieldControlClass} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="label">{isAr ? 'أقصى وزن' : 'Max weight'}</label>
          <input className={fieldControlClass} value={maxWeight} onChange={(e) => setMaxWeight(e.target.value)} />
        </div>
        <div>
          <label className="label">{isAr ? 'منتجات جديدة' : 'New products'}</label>
          <select className={fieldControlClass} value={allowNewProduct} onChange={(e) => setAllowNewProduct(e.target.value)}>
            <option value="mixed">mixed</option>
            <option value="same">same</option>
            <option value="empty">empty</option>
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
                <th>{isAr ? 'أقصى وزن' : 'Max weight'}</th>
                <th>{isAr ? 'سياسة' : 'Policy'}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={3} className="text-center py-6">…</td></tr>}
              {!isLoading && items.length === 0 && (
                <tr><td colSpan={3} className="text-center py-6 text-slate-500">{isAr ? 'لا فئات' : 'No categories'}</td></tr>
              )}
              {items.map((c) => (
                <tr key={c._id}>
                  <td>{c.name}</td>
                  <td>{c.maxWeight || '—'}</td>
                  <td>{c.allowNewProduct}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
