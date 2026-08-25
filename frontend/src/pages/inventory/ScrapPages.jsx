import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { Link, useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Plus, ArrowLeft } from 'lucide-react'
import api from '../../lib/api'
import { asInvList } from '../../lib/invList'
import { StatusChip } from './inventoryUi'
import EmptyState from '../../components/ui/EmptyState'

export function ScrapList() {
  const { language } = useSelector((s) => s.ui)
  const { data, isLoading } = useQuery({
    queryKey: ['stock-scraps'],
    queryFn: () => api.get('/stock/scraps').then((r) => r.data),
  })
  const items = data?.items || []

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
          {language === 'ar' ? 'الخردة' : 'Scrap'}
        </h2>
        <Link to="/app/dashboard/inventory/scrap/new" className="btn btn-primary text-sm">
          <Plus className="h-4 w-4" />
          {language === 'ar' ? 'جديد' : 'New'}
        </Link>
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-dark-600 dark:bg-dark-800">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-100 bg-slate-50/80 text-xs uppercase text-slate-500 dark:border-dark-600">
            <tr>
              <th className="px-4 py-3 text-start">{language === 'ar' ? 'المرجع' : 'Reference'}</th>
              <th className="px-4 py-3 text-start">{language === 'ar' ? 'المنتج' : 'Product'}</th>
              <th className="px-4 py-3 text-start">{language === 'ar' ? 'الكمية' : 'Qty'}</th>
              <th className="px-4 py-3 text-start">{language === 'ar' ? 'الحالة' : 'Status'}</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">…</td></tr>}
            {!isLoading && items.length === 0 && (
              <tr><td colSpan={4} className="p-8"><EmptyState title={language === 'ar' ? 'لا خردة' : 'No scraps'} /></td></tr>
            )}
            {items.map((s) => (
              <tr key={s._id} className="border-b border-slate-50 dark:border-dark-700">
                <td className="px-4 py-3">
                  <Link to={`/app/dashboard/inventory/scrap/${s._id}`} className="font-medium text-primary-700 hover:underline dark:text-primary-300">
                    {s.name}
                  </Link>
                </td>
                <td className="px-4 py-3">{language === 'ar' && s.productId?.nameAr ? s.productId.nameAr : s.productId?.nameEn}</td>
                <td className="px-4 py-3 tabular-nums">{s.quantity}</td>
                <td className="px-4 py-3"><StatusChip status={s.state === 'done' ? 'done' : 'draft'} language={language} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function ScrapForm() {
  const { id } = useParams()
  const isNew = id === 'new'
  const { language } = useSelector((s) => s.ui)
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data: products = [] } = useQuery({
    queryKey: ['products-lite'],
    queryFn: () => api.get('/products', { params: { limit: 200 } }).then((r) => r.data?.products || r.data?.data || r.data || []),
  })
  const { data: locations = [] } = useQuery({
    queryKey: ['stock-locations-internal'],
    queryFn: () => api.get('/stock/locations', { params: { usage: 'internal' } }).then((r) => asInvList(r.data)),
  })
  const { data: scrap } = useQuery({
    queryKey: ['stock-scrap', id],
    enabled: !isNew,
    queryFn: () => api.get(`/stock/scraps/${id}`).then((r) => r.data),
  })

  const [form, setForm] = useState({ productId: '', quantity: '1', sourceLocationId: '', reasonTag: '' })

  const create = useMutation({
    mutationFn: (body) => api.post('/stock/scraps', body).then((r) => r.data),
    onSuccess: (doc) => {
      toast.success(language === 'ar' ? 'تم' : 'Created')
      navigate(`/app/dashboard/inventory/scrap/${doc._id}`)
    },
    onError: (e) => toast.error(e.response?.data?.error || e.message),
  })

  const validate = useMutation({
    mutationFn: () => api.post(`/stock/scraps/${id}/validate`),
    onSuccess: () => {
      toast.success(language === 'ar' ? 'تم الاعتماد' : 'Validated')
      qc.invalidateQueries({ queryKey: ['stock-scrap', id] })
      qc.invalidateQueries({ queryKey: ['stock-scraps'] })
    },
    onError: (e) => toast.error(e.response?.data?.error || e.message),
  })

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <Link to="/app/dashboard/inventory/scrap" className="btn btn-secondary btn-sm inline-flex">
        <ArrowLeft className="h-4 w-4" />
        {language === 'ar' ? 'رجوع' : 'Back'}
      </Link>
      <h2 className="text-lg font-semibold">{isNew ? (language === 'ar' ? 'خردة جديدة' : 'New scrap') : scrap?.name}</h2>

      {isNew ? (
        <form
          className="space-y-3 rounded-2xl border border-slate-200/80 bg-white p-5 dark:border-dark-600 dark:bg-dark-800"
          onSubmit={(e) => {
            e.preventDefault()
            create.mutate(form)
          }}
        >
          <label className="block text-sm">
            <span className="label">{language === 'ar' ? 'المنتج' : 'Product'}</span>
            <select className="select mt-1 w-full" required value={form.productId} onChange={(e) => setForm((f) => ({ ...f, productId: e.target.value }))}>
              <option value="">…</option>
              {(Array.isArray(products) ? products : []).map((p) => (
                <option key={p._id} value={p._id}>{language === 'ar' && p.nameAr ? p.nameAr : p.nameEn}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="label">{language === 'ar' ? 'الكمية' : 'Quantity'}</span>
            <input className="input mt-1 w-full" required value={form.quantity} onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))} />
          </label>
          <label className="block text-sm">
            <span className="label">{language === 'ar' ? 'من موقع' : 'Source location'}</span>
            <select className="select mt-1 w-full" required value={form.sourceLocationId} onChange={(e) => setForm((f) => ({ ...f, sourceLocationId: e.target.value }))}>
              <option value="">…</option>
              {locations.map((l) => (
                <option key={l._id} value={l._id}>{l.completePath || l.name}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="label">{language === 'ar' ? 'السبب' : 'Reason'}</span>
            <input className="input mt-1 w-full" value={form.reasonTag} onChange={(e) => setForm((f) => ({ ...f, reasonTag: e.target.value }))} />
          </label>
          <button type="submit" className="btn btn-primary" disabled={create.isPending}>{language === 'ar' ? 'حفظ' : 'Save'}</button>
        </form>
      ) : (
        <div className="space-y-3 rounded-2xl border border-slate-200/80 bg-white p-5 dark:border-dark-600 dark:bg-dark-800 text-sm">
          <div><span className="text-slate-500">{language === 'ar' ? 'المنتج' : 'Product'}: </span>{scrap?.productId?.nameEn}</div>
          <div><span className="text-slate-500">{language === 'ar' ? 'الكمية' : 'Qty'}: </span>{scrap?.quantity}</div>
          <div><span className="text-slate-500">{language === 'ar' ? 'من' : 'From'}: </span>{scrap?.sourceLocationId?.completePath}</div>
          <StatusChip status={scrap?.state === 'done' ? 'done' : 'draft'} language={language} />
          {scrap?.state === 'draft' && (
            <button type="button" className="btn btn-primary" onClick={() => validate.mutate()} disabled={validate.isPending}>
              {language === 'ar' ? 'اعتماد' : 'Validate'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default ScrapList
