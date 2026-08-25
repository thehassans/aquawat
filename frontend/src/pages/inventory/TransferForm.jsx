import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { Link, useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ArrowLeft } from 'lucide-react'
import api from '../../lib/api'
import { StatusChip } from './inventoryUi'

const CODE_FROM_PATH = () => {
  const parts = window.location.pathname.split('/')
  const i = parts.indexOf('inventory')
  const seg = parts[i + 1]
  if (seg === 'receipts') return 'incoming'
  if (seg === 'deliveries') return 'outgoing'
  return 'internal'
}

export default function TransferForm() {
  const { id } = useParams()
  const isNew = id === 'new'
  const { language } = useSelector((s) => s.ui)
  const navigate = useNavigate()
  const qc = useQueryClient()
  const code = CODE_FROM_PATH()
  const listPath = `/app/dashboard/inventory/${
    code === 'incoming' ? 'receipts' : code === 'outgoing' ? 'deliveries' : 'internal'
  }`

  const { data: opTypes = [] } = useQuery({
    queryKey: ['stock-op-types', code],
    queryFn: () => api.get('/stock/operation-types', { params: { code } }).then((r) => r.data),
  })

  const { data: products = [] } = useQuery({
    queryKey: ['products-lite'],
    queryFn: () => api.get('/products', { params: { limit: 200 } }).then((r) => r.data?.products || r.data?.data || r.data || []),
  })

  const { data: transfer, isLoading } = useQuery({
    queryKey: ['stock-transfer', id],
    enabled: !isNew,
    queryFn: () => api.get(`/stock/transfers/${id}`).then((r) => r.data),
  })

  const [form, setForm] = useState({
    operationTypeId: '',
    origin: '',
    note: '',
    lines: [{ productId: '', demandQty: '1' }],
  })

  const activeOpType = useMemo(
    () => opTypes.find((o) => o._id === (form.operationTypeId || transfer?.operationTypeId?._id || transfer?.operationTypeId)) || opTypes[0],
    [opTypes, form.operationTypeId, transfer],
  )

  const createMut = useMutation({
    mutationFn: (body) => api.post('/stock/transfers', body).then((r) => r.data),
    onSuccess: (doc) => {
      toast.success(language === 'ar' ? 'تم الإنشاء' : 'Created')
      qc.invalidateQueries({ queryKey: ['stock-transfers'] })
      navigate(`${listPath}/${doc._id}`)
    },
    onError: (e) => toast.error(e.response?.data?.error || e.message),
  })

  const actionMut = useMutation({
    mutationFn: ({ action, body }) => api.post(`/stock/transfers/${id}/${action}`, body || {}).then((r) => r.data),
    onSuccess: () => {
      toast.success(language === 'ar' ? 'تم' : 'Done')
      qc.invalidateQueries({ queryKey: ['stock-transfer', id] })
      qc.invalidateQueries({ queryKey: ['stock-transfers'] })
    },
    onError: (e) => toast.error(e.response?.data?.error || e.message),
  })

  const onCreate = (e) => {
    e.preventDefault()
    const operationTypeId = form.operationTypeId || activeOpType?._id
    if (!operationTypeId) {
      toast.error(language === 'ar' ? 'اختر نوع العملية' : 'Select operation type')
      return
    }
    createMut.mutate({
      operationTypeId,
      origin: form.origin,
      note: form.note,
      lines: form.lines.filter((l) => l.productId && l.demandQty),
    })
  }

  if (!isNew && isLoading) {
    return <div className="text-sm text-slate-400">…</div>
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link to={listPath} className="btn btn-secondary btn-sm">
            <ArrowLeft className="h-4 w-4" />
            {language === 'ar' ? 'رجوع' : 'Back'}
          </Link>
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              {isNew ? (language === 'ar' ? 'تحويل جديد' : 'New transfer') : transfer?.name}
            </h2>
            {!isNew && <StatusChip status={transfer?.state} language={language} />}
          </div>
        </div>
        {!isNew && (
          <div className="flex flex-wrap gap-2">
            {transfer?.state === 'draft' && (
              <button type="button" className="btn btn-secondary text-sm" onClick={() => actionMut.mutate({ action: 'confirm' })}>
                {language === 'ar' ? 'تأكيد' : 'Confirm'}
              </button>
            )}
            {['confirmed', 'partiallyAvailable', 'assigned', 'waiting'].includes(transfer?.state) && (
              <>
                <button type="button" className="btn btn-secondary text-sm" onClick={() => actionMut.mutate({ action: 'check-availability' })}>
                  {language === 'ar' ? 'تحقق التوفر' : 'Check availability'}
                </button>
                <button
                  type="button"
                  className="btn btn-primary text-sm"
                  onClick={() => actionMut.mutate({ action: 'validate', body: { immediate: true, createBackorder: false } })}
                >
                  {language === 'ar' ? 'اعتماد' : 'Validate'}
                </button>
              </>
            )}
            {transfer?.state === 'done' && (
              <button
                type="button"
                className="btn btn-secondary text-sm"
                onClick={async () => {
                  try {
                    const wiz = await api.get(`/stock/transfers/${id}/return-wizard`).then((r) => r.data)
                    const lines = (wiz.lines || []).map((l) => ({
                      moveId: l.moveId,
                      quantity: l.quantity,
                    }))
                    const ret = await api.post(`/stock/transfers/${id}/return`, { lines }).then((r) => r.data)
                    toast.success(language === 'ar' ? 'تم إنشاء المرتجع' : 'Return created')
                    qc.invalidateQueries({ queryKey: ['stock-transfers'] })
                    const code = ret.operationTypeId?.code || CODE_FROM_PATH()
                    const path = code === 'incoming' ? 'receipts' : code === 'outgoing' ? 'deliveries' : 'internal'
                    navigate(`/app/dashboard/inventory/${path}/${ret._id}`)
                  } catch (e) {
                    toast.error(e.response?.data?.error || e.message)
                  }
                }}
              >
                {language === 'ar' ? 'مرتجع' : 'Return'}
              </button>
            )}
            {transfer?.state !== 'done' && transfer?.state !== 'cancelled' && (
              <button type="button" className="btn btn-danger text-sm" onClick={() => actionMut.mutate({ action: 'cancel' })}>
                {language === 'ar' ? 'إلغاء' : 'Cancel'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Status bar */}
      {!isNew && (
        <div className="flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-dark-700">
          {['draft', 'waiting', 'assigned', 'done'].map((s) => {
            const active =
              (s === 'assigned' && ['assigned', 'confirmed', 'partiallyAvailable'].includes(transfer?.state)) ||
              transfer?.state === s
            return (
              <div
                key={s}
                className={`flex-1 rounded-lg px-2 py-2 text-center text-xs font-medium capitalize ${
                  active ? 'bg-white text-primary-700 shadow-sm dark:bg-dark-800 dark:text-primary-300' : 'text-slate-400'
                }`}
              >
                {s === 'assigned' ? 'Ready' : s}
              </div>
            )
          })}
        </div>
      )}

      {isNew ? (
        <form onSubmit={onCreate} className="space-y-4 rounded-2xl border border-slate-200/80 bg-white p-5 dark:border-dark-600 dark:bg-dark-800">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="label">{language === 'ar' ? 'نوع العملية' : 'Operation type'}</span>
              <select
                className="select mt-1 w-full"
                value={form.operationTypeId || activeOpType?._id || ''}
                onChange={(e) => setForm((f) => ({ ...f, operationTypeId: e.target.value }))}
              >
                {opTypes.map((o) => (
                  <option key={o._id} value={o._id}>{language === 'ar' && o.nameAr ? o.nameAr : o.name}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="label">{language === 'ar' ? 'المستند المصدر' : 'Source document'}</span>
              <input className="input mt-1 w-full" value={form.origin} onChange={(e) => setForm((f) => ({ ...f, origin: e.target.value }))} />
            </label>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium">{language === 'ar' ? 'البنود' : 'Operations'}</div>
            {form.lines.map((line, idx) => (
              <div key={idx} className="grid gap-2 sm:grid-cols-[1fr_120px]">
                <select
                  className="select"
                  value={line.productId}
                  onChange={(e) => {
                    const lines = [...form.lines]
                    lines[idx] = { ...lines[idx], productId: e.target.value }
                    setForm((f) => ({ ...f, lines }))
                  }}
                >
                  <option value="">{language === 'ar' ? 'منتج…' : 'Product…'}</option>
                  {(Array.isArray(products) ? products : []).map((p) => (
                    <option key={p._id} value={p._id}>
                      {language === 'ar' && p.nameAr ? p.nameAr : p.nameEn} ({p.sku})
                    </option>
                  ))}
                </select>
                <input
                  className="input"
                  type="text"
                  inputMode="decimal"
                  value={line.demandQty}
                  onChange={(e) => {
                    const lines = [...form.lines]
                    lines[idx] = { ...lines[idx], demandQty: e.target.value }
                    setForm((f) => ({ ...f, lines }))
                  }}
                />
              </div>
            ))}
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setForm((f) => ({ ...f, lines: [...f.lines, { productId: '', demandQty: '1' }] }))}
            >
              {language === 'ar' ? 'إضافة بند' : 'Add a line'}
            </button>
          </div>

          <button type="submit" className="btn btn-primary" disabled={createMut.isPending}>
            {language === 'ar' ? 'حفظ' : 'Save'}
          </button>
        </form>
      ) : (
        <div className="space-y-4 rounded-2xl border border-slate-200/80 bg-white p-5 dark:border-dark-600 dark:bg-dark-800">
          <div className="grid gap-4 sm:grid-cols-2 text-sm">
            <div>
              <div className="text-xs text-slate-500">{language === 'ar' ? 'الأصل' : 'Origin'}</div>
              <div className="font-medium">{transfer?.origin || '—'}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">{language === 'ar' ? 'النوع' : 'Operation'}</div>
              <div className="font-medium">{transfer?.operationTypeId?.name || '—'}</div>
            </div>
          </div>
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr>
                <th className="py-2 text-start">{language === 'ar' ? 'المنتج' : 'Product'}</th>
                <th className="py-2 text-start">{language === 'ar' ? 'الطلب' : 'Demand'}</th>
                <th className="py-2 text-start">{language === 'ar' ? 'المنجز' : 'Done'}</th>
                <th className="py-2 text-start">{language === 'ar' ? 'الحالة' : 'State'}</th>
              </tr>
            </thead>
            <tbody>
              {(transfer?.moves || []).map((m) => (
                <tr key={m._id} className="border-t border-slate-100 dark:border-dark-600">
                  <td className="py-2">
                    {language === 'ar' && m.productId?.nameAr
                      ? m.productId.nameAr
                      : m.productId?.nameEn || m.productId?.sku || '—'}
                  </td>
                  <td className="py-2 tabular-nums">{m.demandQty}</td>
                  <td className="py-2 tabular-nums">{m.doneQty}</td>
                  <td className="py-2"><StatusChip status={m.state} language={language} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
