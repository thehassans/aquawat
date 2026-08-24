import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import { fieldControlClass, primaryBtn } from './inventoryUi'

export default function PackageTypesList() {
  const { language } = useSelector((state) => state.ui)
  const isAr = language === 'ar'
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [maxWeight, setMaxWeight] = useState('')

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['stock-package-types'],
    queryFn: () => api.get('/stock/package-types').then((r) => r.data),
  })

  const create = useMutation({
    mutationFn: (payload) => api.post('/stock/package-types', payload),
    onSuccess: () => {
      toast.success(isAr ? 'تم' : 'Created')
      setName('')
      setMaxWeight('')
      queryClient.invalidateQueries(['stock-package-types'])
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Error'),
  })

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">{isAr ? 'أنواع الطرود' : 'Package Types'}</h2>
        <p className="text-sm text-slate-500 mt-1">
          {isAr ? 'أبعاد وأوزان لأنواع التعبئة' : 'Dimensions and weights for packaging types'}
        </p>
      </div>

      <form
        className="card p-4 grid gap-3 md:grid-cols-3 items-end"
        onSubmit={(e) => {
          e.preventDefault()
          if (!name.trim()) return
          create.mutate({
            name: name.trim(),
            maxWeight: maxWeight || '0',
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
                <th>{isAr ? 'باركود' : 'Barcode'}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={3} className="text-center py-6">…</td></tr>}
              {!isLoading && items.length === 0 && (
                <tr><td colSpan={3} className="text-center py-6 text-slate-500">{isAr ? 'لا أنواع' : 'No package types'}</td></tr>
              )}
              {items.map((t) => (
                <tr key={t._id}>
                  <td>{t.name}</td>
                  <td>{t.maxWeight || '—'}</td>
                  <td>{t.barcode || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
