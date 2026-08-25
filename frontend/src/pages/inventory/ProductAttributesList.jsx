import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import { fieldControlClass, primaryBtn, ghostBtn } from './inventoryUi'

export default function ProductAttributesList() {
  const { language } = useSelector((state) => state.ui)
  const isAr = language === 'ar'
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [createVariant, setCreateVariant] = useState('always')
  const [valueDrafts, setValueDrafts] = useState({})

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['stock-product-attributes'],
    queryFn: () => api.get('/stock/product-attributes').then((r) => r.data),
  })

  const createAttr = useMutation({
    mutationFn: (payload) => api.post('/stock/product-attributes', payload),
    onSuccess: () => {
      toast.success(isAr ? 'تم' : 'Created')
      setName('')
      queryClient.invalidateQueries(['stock-product-attributes'])
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Error'),
  })

  const addValue = useMutation({
    mutationFn: ({ id, valueName }) => api.post(`/stock/product-attributes/${id}/values`, { name: valueName }),
    onSuccess: (_r, vars) => {
      toast.success(isAr ? 'تم' : 'Value added')
      setValueDrafts((d) => ({ ...d, [vars.id]: '' }))
      queryClient.invalidateQueries(['stock-product-attributes'])
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Error'),
  })

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">{isAr ? 'خصائص المنتج' : 'Product Attributes'}</h2>
        <p className="text-sm text-slate-500 mt-1">
          {isAr
            ? 'تُستخدم لإنشاء المتغيرات (cartesian). always = إنشاء متغير لكل تركيبة.'
            : 'Used to generate variants (cartesian). always = one variant per combination.'}
        </p>
      </div>

      <form
        className="card p-4 grid gap-3 md:grid-cols-3 items-end"
        onSubmit={(e) => {
          e.preventDefault()
          if (!name.trim()) return
          createAttr.mutate({ name: name.trim(), createVariant })
        }}
      >
        <div>
          <label className="label">{isAr ? 'الاسم' : 'Name'}</label>
          <input className={fieldControlClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="Size, Color…" />
        </div>
        <div>
          <label className="label">{isAr ? 'إنشاء متغير' : 'Create variants'}</label>
          <select className={fieldControlClass} value={createVariant} onChange={(e) => setCreateVariant(e.target.value)}>
            <option value="always">always</option>
            <option value="dynamic">dynamic</option>
            <option value="no_variant">no_variant</option>
          </select>
        </div>
        <button type="submit" className={primaryBtn} disabled={createAttr.isPending}>
          {isAr ? 'إضافة خاصية' : 'Add attribute'}
        </button>
      </form>

      <div className="space-y-4">
        {isLoading && <p>…</p>}
        {items.map((a) => (
          <div key={a._id} className="card p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-semibold">{a.name}</h3>
                <p className="text-xs text-slate-500">{a.createVariant} · {a.displayType}</p>
              </div>
            </div>
            <ul className="flex flex-wrap gap-2 text-sm">
              {(a.values || []).map((v) => (
                <li key={v._id} className="badge-neutral px-2 py-1 rounded-lg">{v.name}</li>
              ))}
              {!a.values?.length && <li className="text-slate-500">{isAr ? 'لا قيم' : 'No values'}</li>}
            </ul>
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <label className="label">{isAr ? 'قيمة جديدة' : 'New value'}</label>
                <input
                  className={fieldControlClass}
                  value={valueDrafts[a._id] || ''}
                  onChange={(e) => setValueDrafts((d) => ({ ...d, [a._id]: e.target.value }))}
                />
              </div>
              <button
                type="button"
                className={ghostBtn}
                disabled={addValue.isPending || !(valueDrafts[a._id] || '').trim()}
                onClick={() => addValue.mutate({ id: a._id, valueName: valueDrafts[a._id].trim() })}
              >
                {isAr ? 'إضافة' : 'Add'}
              </button>
            </div>
          </div>
        ))}
        {!isLoading && !items.length && (
          <p className="text-slate-500 text-sm">{isAr ? 'لا خصائص بعد' : 'No attributes yet'}</p>
        )}
      </div>
    </div>
  )
}
