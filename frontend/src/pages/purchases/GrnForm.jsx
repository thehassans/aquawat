import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { ArrowLeft, CheckCircle2, Loader2, Plus, Save, Trash2, XCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import ProductChooser, { loadInventoryProducts } from '../../components/inventory/ProductChooser'
import { isStockTrackedProductType } from '../../lib/productType'
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

const emptyLine = () => ({
  productId: '',
  productName: '',
  barcode: '',
  productType: 'goods',
  quantityOrdered: 0,
  quantityReceived: 1,
  costPrice: 0,
  isDelayed: false,
  delayedUntil: '',
  delayReason: '',
  notes: '',
  batchNumber: '',
  expiryDate: '',
})

export default function GrnForm() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const [searchParams] = useSearchParams()
  const poIdParam = searchParams.get('poId') || ''
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { language } = useSelector((state) => state.ui)

  const [supplierId, setSupplierId] = useState('')
  const [purchaseOrderId, setPurchaseOrderId] = useState(poIdParam)
  const [warehouseId, setWarehouseId] = useState('')
  const [referenceNumber, setReferenceNumber] = useState('')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState([emptyLine()])
  const [products, setProducts] = useState([])

  const { data: existing, isLoading } = useQuery({
    queryKey: ['grn', id],
    queryFn: () => api.get(`/grn/${id}`).then((res) => res.data),
    enabled: isEdit,
  })

  const { data: suppliers } = useQuery({
    queryKey: ['suppliers-lookup'],
    queryFn: () => api.get('/suppliers', { params: { limit: 200 } }).then((res) => res.data.suppliers || []),
  })

  const { data: purchaseOrders } = useQuery({
    queryKey: ['purchase-orders-open'],
    queryFn: () =>
      api.get('/purchase-orders', { params: { page: 1, limit: 200 } }).then((res) => res.data?.purchaseOrders || []),
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

  useEffect(() => {
    loadInventoryProducts(api).then(setProducts)
  }, [])

  useEffect(() => {
    if (!existing) return
    setSupplierId(existing.supplierId?._id || existing.supplierId || '')
    setPurchaseOrderId(existing.purchaseOrderId?._id || existing.purchaseOrderId || '')
    setWarehouseId(existing.warehouseId?._id || existing.warehouseId || '')
    setReferenceNumber(existing.referenceNumber || '')
    setNotes(existing.notes || '')
    setLines((existing.lines || []).map((line) => ({
      ...emptyLine(),
      ...line,
      productId: line.productId?._id || line.productId || '',
      delayedUntil: line.delayedUntil ? String(line.delayedUntil).slice(0, 10) : '',
      expiryDate: line.expiryDate ? String(line.expiryDate).slice(0, 10) : '',
    })))
  }, [existing])

  const pullPo = async (poId) => {
    if (!poId) return
    try {
      const { data } = await api.get(`/grn/from-po/${poId}`)
      setPurchaseOrderId(poId)
      setSupplierId(data.supplierId?._id || data.supplierId || supplierId)
      setWarehouseId(data.warehouseId?._id || data.warehouseId || warehouseId)
      if (data.lines?.length) {
        setLines(data.lines.map((line) => ({
          ...emptyLine(),
          ...line,
          quantityReceived: line.remaining || line.quantityReceived || 0,
        })))
      }
    } catch (err) {
      toast.error(err.response?.data?.error || (language === 'ar' ? 'تعذر تحميل الطلب' : 'Could not load PO'))
    }
  }

  useEffect(() => {
    if (!isEdit && poIdParam) pullPo(poIdParam)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poIdParam, isEdit])

  const locked = isEdit && existing && !['draft'].includes(existing.status)

  const payload = useMemo(() => ({
    supplierId,
    purchaseOrderId: purchaseOrderId || undefined,
    warehouseId: warehouseId || undefined,
    referenceNumber,
    notes,
    lines: lines.map((line) => ({
      ...line,
      delayedUntil: line.delayedUntil || undefined,
      expiryDate: line.expiryDate || undefined,
    })),
  }), [supplierId, purchaseOrderId, warehouseId, referenceNumber, notes, lines])

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['grn-list'] })
    queryClient.invalidateQueries({ queryKey: ['grn', id] })
    queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })
  }

  const saveMutation = useMutation({
    mutationFn: () => (isEdit ? api.put(`/grn/${id}`, payload) : api.post('/grn', payload)),
    onSuccess: (res) => {
      toast.success(language === 'ar' ? 'تم الحفظ' : 'Saved')
      invalidate()
      if (!isEdit) navigate(`${PURCHASES_PATH.grn}/${res.data._id}`)
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Error'),
  })

  const receiveMutation = useMutation({
    mutationFn: async () => {
      let grnId = id
      if (!isEdit) {
        const created = await api.post('/grn', payload)
        grnId = created.data._id
      } else if (existing?.status === 'draft') {
        await api.put(`/grn/${id}`, payload)
      }
      await api.post(`/grn/${grnId}/receive`, { warehouseId })
      return grnId
    },
    onSuccess: (grnId) => {
      toast.success(language === 'ar' ? 'تم الاستلام وتحديث المخزون' : 'Received and stock updated')
      invalidate()
      navigate(`${PURCHASES_PATH.grn}/${grnId}`)
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Error'),
  })

  const completeMutation = useMutation({
    mutationFn: () => api.post(`/grn/${id}/complete`),
    onSuccess: () => {
      toast.success(language === 'ar' ? 'اكتمل الاستلام' : 'GRN completed')
      invalidate()
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Error'),
  })

  const cancelMutation = useMutation({
    mutationFn: () => api.post(`/grn/${id}/cancel`),
    onSuccess: () => {
      toast.success(language === 'ar' ? 'تم الإلغاء' : 'Cancelled')
      invalidate()
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Error'),
  })

  const updateLine = (index, patch) => {
    setLines((prev) => prev.map((line, i) => (i === index ? { ...line, ...patch } : line)))
  }

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
          <button type="button" onClick={() => navigate(PURCHASES_PATH.grn)} className={`${ghostBtn} h-10 w-10 justify-center px-0`}>
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-teal-700">
              {language === 'ar' ? 'إشعار الاستلام' : 'Goods receipt'}
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-[-0.04em] text-slate-950 dark:text-white">
              {isEdit ? (existing?.grnNumber || 'GRN') : language === 'ar' ? 'إشعار استلام جديد' : 'New GRN'}
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
            <button type="button" onClick={() => receiveMutation.mutate()} disabled={receiveMutation.isPending} className={primaryBtn}>
              {receiveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {language === 'ar' ? 'استلام' : 'Receive'}
            </button>
          )}
          {isEdit && existing?.status === 'received' && (
            <button type="button" onClick={() => completeMutation.mutate()} className={primaryBtn}>
              {language === 'ar' ? 'إكمال' : 'Complete'}
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
          {language === 'ar' ? 'المورد والمستودع' : 'Vendor & warehouse'}
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
            {language === 'ar' ? 'طلب الشراء' : 'Purchase order'}
            <select
              value={purchaseOrderId}
              disabled={locked}
              onChange={(e) => {
                setPurchaseOrderId(e.target.value)
                if (e.target.value) pullPo(e.target.value)
              }}
              className={`mt-1.5 ${fieldControlClass}`}
            >
              <option value="">{language === 'ar' ? 'بدون طلب' : 'No PO'}</option>
              {(purchaseOrders || [])
                .filter((po) => !['cancelled', 'draft'].includes(po.status) || po._id === purchaseOrderId)
                .map((po) => (
                  <option key={po._id} value={po._id}>{po.poNumber} — {partyName(po.supplierId, language)}</option>
                ))}
            </select>
          </label>
          <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
            {language === 'ar' ? 'المستودع' : 'Warehouse'}
            <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} disabled={locked && Boolean(existing?.purchaseOrderId)} className={`mt-1.5 ${fieldControlClass}`}>
              <option value="">{language === 'ar' ? 'اختر المستودع' : 'Select warehouse'}</option>
              {(warehouses || []).map((w) => (
                <option key={w._id} value={w._id}>{warehouseName(w, language)}</option>
              ))}
            </select>
          </label>
          <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
            {language === 'ar' ? 'المرجع' : 'Reference'}
            <input value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)} disabled={locked} className={`mt-1.5 ${fieldControlClass}`} />
          </label>
        </div>
      </section>

      <section className={`${shell} p-6`}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[13px] font-semibold text-slate-900 dark:text-white">
            {language === 'ar' ? 'البنود' : 'Lines'}
          </h2>
          {!locked && (
            <button type="button" onClick={() => setLines((prev) => [...prev, emptyLine()])} className={ghostBtn}>
              <Plus className="h-4 w-4" />
              {language === 'ar' ? 'بند' : 'Line'}
            </button>
          )}
        </div>
        {!locked && (
          <div className="mb-4">
            <ProductChooser
              products={products}
              onPick={(product) => {
                setLines((prev) => [{
                  ...emptyLine(),
                  productId: product._id,
                  productName: product.name,
                  barcode: product.barcode,
                  productType: product.productType || 'goods',
                  costPrice: product.costPrice || 0,
                }, ...prev.filter((l) => l.productId || l.productName)])
              }}
            />
          </div>
        )}
        <div className="space-y-4">
          {lines.map((line, index) => (
            <div key={index} className="rounded-2xl border border-slate-100 p-4 dark:border-white/10">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <label className="text-[11px] font-medium text-slate-500 sm:col-span-2">
                  {language === 'ar' ? 'المنتج' : 'Product'}
                  <input value={line.productName} disabled className={`mt-1.5 ${fieldControlClass}`} />
                </label>
                <label className="text-[11px] font-medium text-slate-500">
                  {language === 'ar' ? 'الكمية المستلمة' : 'Received qty'}
                  <input
                    type="number"
                    min="0"
                    value={line.quantityReceived}
                    disabled={locked}
                    onChange={(e) => updateLine(index, { quantityReceived: Number(e.target.value) })}
                    className={`mt-1.5 ${fieldControlClass}`}
                  />
                </label>
                <label className="text-[11px] font-medium text-slate-500">
                  {language === 'ar' ? 'التكلفة' : 'Cost'}
                  <input
                    type="number"
                    min="0"
                    value={line.costPrice}
                    disabled={locked}
                    onChange={(e) => updateLine(index, { costPrice: Number(e.target.value) })}
                    className={`mt-1.5 ${fieldControlClass}`}
                  />
                </label>
              </div>
              <p className="mt-2 text-[11px] text-slate-400">
                {isStockTrackedProductType(line.productType)
                  ? (language === 'ar' ? 'بضاعة — تُضاف للمخزون' : 'Goods — posts warehouse stock')
                  : (language === 'ar' ? 'خدمة — بدون مخزون' : 'Service — no stock movement')}
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <label className="flex items-center gap-2 text-[13px] text-slate-600">
                  <input
                    type="checkbox"
                    checked={Boolean(line.isDelayed)}
                    disabled={locked}
                    onChange={(e) => updateLine(index, { isDelayed: e.target.checked })}
                  />
                  {language === 'ar' ? 'تأخير البند' : 'Item delay'}
                </label>
                {line.isDelayed && (
                  <>
                    <input
                      type="date"
                      value={line.delayedUntil}
                      disabled={locked}
                      onChange={(e) => updateLine(index, { delayedUntil: e.target.value })}
                      className={fieldControlClass}
                    />
                    <input
                      value={line.delayReason}
                      disabled={locked}
                      placeholder={language === 'ar' ? 'سبب التأخير' : 'Delay reason'}
                      onChange={(e) => updateLine(index, { delayReason: e.target.value })}
                      className={fieldControlClass}
                    />
                  </>
                )}
              </div>
              <input
                value={line.notes}
                disabled={locked}
                placeholder={language === 'ar' ? 'ملاحظات البند' : 'Line notes'}
                onChange={(e) => updateLine(index, { notes: e.target.value })}
                className={`mt-3 ${fieldControlClass}`}
              />
              {!locked && lines.length > 1 && (
                <button type="button" onClick={() => setLines((prev) => prev.filter((_, i) => i !== index))} className={`${dangerBtn} mt-3`}>
                  <Trash2 className="h-4 w-4" />
                  {language === 'ar' ? 'حذف' : 'Remove'}
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className={`${shell} p-6`}>
        <h2 className="text-[13px] font-semibold text-slate-900 dark:text-white">
          {language === 'ar' ? 'ملاحظات' : 'Notes'}
        </h2>
        <textarea value={notes} disabled={locked} onChange={(e) => setNotes(e.target.value)} rows={4} className={`mt-3 ${fieldControlClass}`} />
      </section>
    </div>
  )
}
