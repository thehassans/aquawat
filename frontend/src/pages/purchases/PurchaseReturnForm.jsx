import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { ArrowLeft, CheckCircle2, Loader2, Save, XCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import {
  PURCHASES_PATH,
  fieldControlClass,
  shell,
  ghostBtn,
  primaryBtn,
  dangerBtn,
  STATUS_PILL,
  statusLabel,
  partyName,
  warehouseName,
} from './purchasesUi'

export default function PurchaseReturnForm() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const [searchParams] = useSearchParams()
  const grnParam = searchParams.get('grnId') || ''
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { language } = useSelector((state) => state.ui)

  const [supplierId, setSupplierId] = useState('')
  const [grnId, setGrnId] = useState(grnParam)
  const [purchaseOrderId, setPurchaseOrderId] = useState('')
  const [warehouseId, setWarehouseId] = useState('')
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState([])

  const { data: existing, isLoading } = useQuery({
    queryKey: ['purchase-return', id],
    queryFn: () => api.get(`/purchase-returns/${id}`).then((res) => res.data),
    enabled: isEdit,
  })

  const { data: suppliers } = useQuery({
    queryKey: ['suppliers-lookup'],
    queryFn: () => api.get('/suppliers', { params: { limit: 200 } }).then((res) => res.data.suppliers || []),
  })

  const { data: grns } = useQuery({
    queryKey: ['grn-list'],
    queryFn: () => api.get('/grn').then((res) => (Array.isArray(res.data) ? res.data : [])),
  })

  const { data: warehouses } = useQuery({
    queryKey: ['warehouses'],
    queryFn: async () => {
      try {
        const res = await api.get('/warehouses')
        return Array.isArray(res.data) ? res.data : res.data?.warehouses || []
      } catch {
        return []
      }
    },
  })

  const pullGrn = async (nextId) => {
    if (!nextId) return
    try {
      const { data } = await api.get(`/purchase-returns/from-grn/${nextId}`)
      setGrnId(nextId)
      setSupplierId(data.supplierId?._id || data.supplierId || '')
      setWarehouseId(data.warehouseId?._id || data.warehouseId || '')
      setPurchaseOrderId(data.purchaseOrderId?._id || data.purchaseOrderId || '')
      setLines((data.lines || []).map((line) => ({
        ...line,
        quantityReturned: line.remaining || 0,
        reason: 'defective',
        notes: '',
      })))
    } catch (err) {
      toast.error(err.response?.data?.error || (language === 'ar' ? 'تعذر تحميل الإشعار' : 'Could not load GRN'))
    }
  }

  useEffect(() => {
    if (!isEdit && grnParam) pullGrn(grnParam)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grnParam, isEdit])

  useEffect(() => {
    if (!existing) return
    setSupplierId(existing.supplierId?._id || existing.supplierId || '')
    setGrnId(existing.grnId?._id || existing.grnId || '')
    setPurchaseOrderId(existing.purchaseOrderId?._id || existing.purchaseOrderId || '')
    setWarehouseId(existing.warehouseId?._id || existing.warehouseId || '')
    setReason(existing.reason || '')
    setNotes(existing.notes || '')
    setLines(existing.lines || [])
  }, [existing])

  const locked = isEdit && existing && existing.status !== 'draft'
  const payload = useMemo(() => ({
    supplierId,
    grnId: grnId || undefined,
    purchaseOrderId: purchaseOrderId || undefined,
    warehouseId: warehouseId || undefined,
    reason,
    notes,
    lines: lines.filter((line) => Number(line.quantityReturned) > 0),
  }), [supplierId, grnId, purchaseOrderId, warehouseId, reason, notes, lines])

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['purchase-returns'] })
    queryClient.invalidateQueries({ queryKey: ['purchase-return', id] })
    queryClient.invalidateQueries({ queryKey: ['grn-list'] })
    queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })
  }

  const saveMutation = useMutation({
    mutationFn: () => (isEdit ? api.put(`/purchase-returns/${id}`, payload) : api.post('/purchase-returns', payload)),
    onSuccess: (res) => {
      toast.success(language === 'ar' ? 'تم الحفظ' : 'Saved')
      invalidate()
      if (!isEdit) navigate(`${PURCHASES_PATH.returns}/${res.data._id}`)
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Error'),
  })

  const confirmMutation = useMutation({
    mutationFn: async () => {
      let docId = id
      if (!isEdit) {
        const created = await api.post('/purchase-returns', payload)
        docId = created.data._id
      } else if (existing?.status === 'draft') {
        await api.put(`/purchase-returns/${id}`, payload)
      }
      await api.post(`/purchase-returns/${docId}/confirm`)
      return docId
    },
    onSuccess: (docId) => {
      toast.success(language === 'ar' ? 'تم تأكيد المرتجع وخصم المخزون' : 'Return confirmed and stock deducted')
      invalidate()
      // Go back to the previous screen (purchase returns list or previous page)
      const referer = document.referrer || PURCHASES_PATH.returns
      navigate(referer, { replace: true })
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Error'),
  })

  const cancelMutation = useMutation({
    mutationFn: () => api.post(`/purchase-returns/${id}/cancel`),
    onSuccess: () => {
      toast.success(language === 'ar' ? 'تم الإلغاء' : 'Cancelled')
      invalidate()
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Error'),
  })

  if (isEdit && isLoading) {
    return (
      <div className="flex justify-center p-16">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-teal-700" />
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <button type="button" onClick={() => navigate(PURCHASES_PATH.returns)} className={`${ghostBtn} h-10 w-10 justify-center px-0`}>
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-teal-700">
              {language === 'ar' ? 'مرتجع المشتريات' : 'Purchase return'}
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-[-0.04em] text-slate-950 dark:text-white">
              {isEdit ? (existing?.returnNumber || 'PR') : language === 'ar' ? 'مرتجع جديد' : 'New return'}
            </h1>
            {existing?.status && (
              <span className={`mt-2 inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1 ring-inset ${STATUS_PILL[existing.status] || STATUS_PILL.draft}`}>
                {statusLabel(existing.status, language)}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {!locked && (
            <button type="button" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className={ghostBtn}>
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {language === 'ar' ? 'حفظ مسودة' : 'Save draft'}
            </button>
          )}
          {(!isEdit || existing?.status === 'draft') && (
            <button type="button" onClick={() => confirmMutation.mutate()} disabled={confirmMutation.isPending} className={primaryBtn}>
              {confirmMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {language === 'ar' ? 'تأكيد' : 'Confirm'}
            </button>
          )}
          {isEdit && existing && existing.status !== 'cancelled' && (
            <button type="button" onClick={() => cancelMutation.mutate()} className={dangerBtn}>
              <XCircle className="h-4 w-4" />
              {language === 'ar' ? 'إلغاء' : 'Cancel'}
            </button>
          )}
        </div>
      </div>

      <section className={`${shell} p-6`}>
        <h2 className="text-[13px] font-semibold text-slate-900 dark:text-white">
          {language === 'ar' ? 'المصدر والمستودع' : 'Source & warehouse'}
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
            {language === 'ar' ? 'إشعار الاستلام' : 'GRN'}
            <select
              value={grnId}
              disabled={locked}
              onChange={(e) => {
                setGrnId(e.target.value)
                if (e.target.value) pullGrn(e.target.value)
              }}
              className={`mt-1.5 ${fieldControlClass}`}
            >
              <option value="">{language === 'ar' ? 'اختر الإشعار' : 'Select GRN'}</option>
              {(grns || []).filter((g) => ['received', 'completed'].includes(g.status) || g._id === grnId).map((g) => (
                <option key={g._id} value={g._id}>{g.grnNumber}</option>
              ))}
            </select>
          </label>
          <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
            {language === 'ar' ? 'المورد' : 'Vendor'}
            <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} disabled={locked} className={`mt-1.5 ${fieldControlClass}`}>
              <option value="">{language === 'ar' ? 'اختر المورد' : 'Select vendor'}</option>
              {(suppliers || []).map((s) => (
                <option key={s._id} value={s._id}>{partyName(s, language)}</option>
              ))}
            </select>
          </label>
          <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
            {language === 'ar' ? 'المستودع' : 'Warehouse'}
            <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} disabled={locked} className={`mt-1.5 ${fieldControlClass}`}>
              <option value="">{language === 'ar' ? 'اختر المستودع' : 'Select warehouse'}</option>
              {(warehouses || []).map((w) => (
                <option key={w._id} value={w._id}>{warehouseName(w, language)}</option>
              ))}
            </select>
          </label>
          <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400 sm:col-span-2">
            {language === 'ar' ? 'سبب الإرجاع' : 'Reason'}
            <input value={reason} disabled={locked} onChange={(e) => setReason(e.target.value)} className={`mt-1.5 ${fieldControlClass}`} />
          </label>
        </div>
      </section>

      <section className={`${shell} p-6`}>
        <h2 className="text-[13px] font-semibold text-slate-900 dark:text-white">
          {language === 'ar' ? 'البنود' : 'Lines'}
        </h2>
        {lines.length === 0 ? (
          <p className="mt-4 text-[13px] text-slate-500">
            {language === 'ar' ? 'اختر إشعار استلام لسحب الكميات القابلة للإرجاع.' : 'Select a GRN to pull returnable quantities.'}
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                <tr>
                  <th className="py-2">{language === 'ar' ? 'المنتج' : 'Product'}</th>
                  <th className="py-2">{language === 'ar' ? 'قابل للإرجاع' : 'Returnable'}</th>
                  <th className="py-2">{language === 'ar' ? 'الكمية' : 'Qty'}</th>
                  <th className="py-2">{language === 'ar' ? 'ملاحظات' : 'Notes'}</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line, index) => (
                  <tr key={index} className="border-t border-slate-100 dark:border-white/10">
                    <td className="py-3 font-medium text-slate-900 dark:text-white">{line.productName || '—'}</td>
                    <td className="py-3 tabular-nums text-slate-500">{line.remaining ?? line.quantityReceived ?? '—'}</td>
                    <td className="py-3">
                      <input
                        type="number"
                        min="0"
                        max={line.remaining || undefined}
                        disabled={locked}
                        value={line.quantityReturned}
                        onChange={(e) => {
                          const quantityReturned = Number(e.target.value)
                          setLines((prev) => prev.map((row, i) => (i === index ? { ...row, quantityReturned } : row)))
                        }}
                        className={fieldControlClass}
                      />
                    </td>
                    <td className="py-3">
                      <input
                        disabled={locked}
                        value={line.notes || ''}
                        onChange={(e) => setLines((prev) => prev.map((row, i) => (i === index ? { ...row, notes: e.target.value } : row)))}
                        className={fieldControlClass}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className={`${shell} p-6`}>
        <h2 className="text-[13px] font-semibold text-slate-900 dark:text-white">
          {language === 'ar' ? 'ملاحظات إضافية' : 'Extra notes'}
        </h2>
        <textarea value={notes} disabled={locked} onChange={(e) => setNotes(e.target.value)} rows={4} className={`mt-3 ${fieldControlClass}`} />
      </section>
    </div>
  )
}
