import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { ArrowLeft, CheckCircle2, Clock3, Loader2, Plus, Save, Trash2, XCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import ProductChooser, { loadInventoryProducts } from '../../components/inventory/ProductChooser'
import PartnerCombobox from '../../components/inventory/PartnerCombobox'
import VariantLineSelect from '../../components/inventory/VariantLineSelect'
import ProductTypeToggle from '../../components/ui/ProductTypeToggle'
import { isStockTrackedProductType, normalizeProductType } from '../../lib/productType'
import Money from '../../components/ui/Money'
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
  formatDay,
  toDateInput,
  isFutureDate,
  earliestDelayedUntil,
} from './purchasesUi'

const emptyLine = () => ({
  productId: '',
  variantId: '',
  productName: '',
  barcode: '',
  productType: 'goods',
  uom: 'PCE',
  quantityOrdered: 0,
  quantityReceived: 1,
  remaining: 0,
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
  const receiveEarlyParam = searchParams.get('early') === '1'
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { language } = useSelector((state) => state.ui)

  const [supplierId, setSupplierId] = useState('')
  const [selectedSupplier, setSelectedSupplier] = useState(null)
  const [purchaseOrderId, setPurchaseOrderId] = useState(poIdParam)
  const [warehouseId, setWarehouseId] = useState('')
  const [referenceNumber, setReferenceNumber] = useState('')
  const [expectedDate, setExpectedDate] = useState('')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState([emptyLine()])
  const [products, setProducts] = useState([])

  const { data: existing, isLoading } = useQuery({
    queryKey: ['grn', id],
    queryFn: () => api.get(`/grn/${id}`).then((res) => res.data),
    enabled: isEdit,
  })

  const { data: purchaseOrders = [], isLoading: loadingPos } = useQuery({
    queryKey: ['purchase-orders-open'],
    queryFn: () =>
      api.get('/purchase-orders', { params: { page: 1, limit: 200, receivable: 1 } })
        .then((res) => res.data?.purchaseOrders || res.data || []),
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
    setSelectedSupplier(existing.supplierId && typeof existing.supplierId === 'object' ? existing.supplierId : null)
    setPurchaseOrderId(existing.purchaseOrderId?._id || existing.purchaseOrderId || '')
    setWarehouseId(existing.warehouseId?._id || existing.warehouseId || '')
    setReferenceNumber(existing.referenceNumber || '')
    setExpectedDate(toDateInput(existing.expectedDate || existing.purchaseOrderId?.expectedDate))
    setNotes(existing.notes || '')
    setLines((existing.lines || []).map((line) => ({
      ...emptyLine(),
      ...line,
      productId: line.productId?._id || line.productId || '',
      variantId: line.variantId?._id || line.variantId || '',
      delayedUntil: line.delayedUntil ? String(line.delayedUntil).slice(0, 10) : '',
      expiryDate: line.expiryDate ? String(line.expiryDate).slice(0, 10) : '',
    })))
  }, [existing])

  const pullPo = async (poId) => {
    if (!poId) return
    const applyFromPo = (data) => {
      setPurchaseOrderId(poId)
      const sid = data.supplierId?._id || data.supplierId || data.purchaseOrder?.supplierId?._id || data.purchaseOrder?.supplierId || ''
      setSupplierId(sid)
      if (data.supplierId && typeof data.supplierId === 'object') setSelectedSupplier(data.supplierId)
      else if (data.purchaseOrder?.supplierId && typeof data.purchaseOrder.supplierId === 'object') setSelectedSupplier(data.purchaseOrder.supplierId)
      setWarehouseId(data.warehouseId?._id || data.warehouseId || data.purchaseOrder?.warehouseId?._id || data.purchaseOrder?.warehouseId || '')
      setExpectedDate(toDateInput(data.expectedDate || data.purchaseOrder?.expectedDate))
      const nextLines = Array.isArray(data.lines) ? data.lines : []
      if (nextLines.length) {
        setLines(nextLines.map((line) => ({
          ...emptyLine(),
          ...line,
          productId: line.productId?._id || line.productId || '',
          variantId: line.variantId?._id || line.variantId || '',
          productType: normalizeProductType(line.productType),
          quantityReceived: line.remaining || line.quantityReceived || 0,
        })))
      } else {
        setLines([emptyLine()])
        toast.error(language === 'ar' ? 'لا توجد كميات متبقية على هذا الطلب' : 'No remaining quantity on this PO')
      }
    }
    try {
      const { data } = await api.get(`/grn/from-po/${poId}`)
      applyFromPo(data)
    } catch (err) {
      try {
        const { data: po } = await api.get(`/purchase-orders/${poId}`)
        const lines = (Array.isArray(po?.lineItems) ? po.lineItems : []).map((li) => {
          const product = li?.productId && typeof li.productId === 'object' ? li.productId : null
          const ordered = Number(li?.quantityOrdered || 0)
          const received = Number(li?.quantityReceived || 0)
          const remaining = Math.max(0, ordered - received)
          return {
            productId: product?._id || li?.productId || '',
            variantId: li?.variantId?._id || li?.variantId || '',
            productName: product?.nameEn || product?.nameAr || li?.manualName || li?.description || '',
            barcode: product?.barcode || '',
            productType: normalizeProductType(li?.productType || product?.productType),
            uom: li?.uom || product?.unitOfMeasure || 'PCE',
            quantityOrdered: ordered,
            quantityReceived: remaining,
            remaining,
            costPrice: Number(li?.unitCost || 0),
          }
        }).filter((line) => line.remaining > 0)
        applyFromPo({
          supplierId: po?.supplierId,
          warehouseId: po?.warehouseId,
          purchaseOrder: po,
          lines,
        })
      } catch {
        toast.error(err.response?.data?.error || (language === 'ar' ? 'تعذر تحميل الطلب' : 'Could not load PO'))
      }
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
    expectedDate: expectedDate || undefined,
    notes,
    lines: (Array.isArray(lines) ? lines : []).map((line) => ({
      ...line,
      quantityReceived: line.isDelayed ? 0 : line.quantityReceived,
      delayedUntil: line.delayedUntil || undefined,
      expiryDate: line.expiryDate || undefined,
    })),
  }), [supplierId, purchaseOrderId, warehouseId, referenceNumber, expectedDate, notes, lines])

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['grn-list'] })
    queryClient.invalidateQueries({ queryKey: ['grn-upcoming'] })
    queryClient.invalidateQueries({ queryKey: ['grn', id] })
    queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })
    queryClient.invalidateQueries({ queryKey: ['purchase-orders-open'] })
    queryClient.invalidateQueries({ queryKey: ['purchase-order'] })
  }

  const guardDelayDetails = () => {
    const missing = (payload.lines || []).some((line) => line.isDelayed && !String(line.delayReason || '').trim())
    if (!missing) return true
    toast.error(language === 'ar' ? 'كل بند متأخر يحتاج سبب التأخير' : 'Each delayed line needs a delay reason')
    return false
  }

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!guardDelayDetails()) throw new Error('DELAY_REASON_REQUIRED')
      return isEdit ? api.put(`/grn/${id}`, payload) : api.post('/grn', payload)
    },
    onSuccess: () => {
      toast.success(language === 'ar' ? 'تم الحفظ' : 'Saved')
      invalidate()
      navigate(PURCHASES_PATH.grn, { replace: true })
    },
    onError: (err) => {
      if (err?.message === 'DELAY_REASON_REQUIRED') return
      toast.error(err.response?.data?.error || 'Error')
    },
  })

  const receiveMutation = useMutation({
    mutationFn: async () => {
      if (!guardDelayDetails()) throw new Error('DELAY_REASON_REQUIRED')
      if (!warehouseId) {
        toast.error(language === 'ar' ? 'اختر المستودع قبل الاستلام' : 'Select a warehouse before receiving')
        throw new Error('WAREHOUSE_REQUIRED')
      }
      const totalRecv = (lines || []).reduce((sum, l) => sum + (l.isDelayed ? 0 : Number(l.quantityReceived || 0)), 0)
      if (totalRecv <= 0 && !(lines || []).some(l => l.isDelayed)) {
        toast.error(language === 'ar' ? 'أدخل كميات مستلمة أكبر من 0 أو علّم البنود كمتأخرة لإنشاء طلب متبقي' : 'Enter received quantity > 0 or mark lines as delayed for backorder')
        throw new Error('ZERO_RECEIVE')
      }
      let grnId = id
      if (!isEdit) {
        const created = await api.post('/grn', payload)
        grnId = created.data._id || created.data.id
      } else if (existing?.status === 'draft') {
        await api.put(`/grn/${id}`, payload)
      }
      if (totalRecv > 0) {
        await api.post(`/grn/${grnId}/receive`, { warehouseId })
      }
      return grnId
    },
    onSuccess: () => {
      toast.success(language === 'ar' ? 'تم حفظ الاستلام وتحديث المخزون' : 'Received and stock updated')
      invalidate()
      navigate(PURCHASES_PATH.grn, { replace: true })
    },
    onError: (err) => {
      if (err?.message === 'DELAY_REASON_REQUIRED' || err?.message === 'ZERO_RECEIVE') return
      toast.error(err.response?.data?.error || 'Error')
    },
  })

  const completeMutation = useMutation({
    mutationFn: () => api.post(`/grn/${id}/complete`),
    onSuccess: () => {
      toast.success(language === 'ar' ? 'اكتمل الاستلام' : 'GRN completed')
      invalidate()
      navigate(PURCHASES_PATH.grn, { replace: true })
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Error'),
  })

  const cancelMutation = useMutation({
    mutationFn: () => api.post(`/grn/${id}/cancel`),
    onSuccess: () => {
      toast.success(language === 'ar' ? 'تم الإلغاء' : 'Cancelled')
      invalidate()
      navigate(PURCHASES_PATH.grn, { replace: true })
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Error'),
  })

  const updateLine = (index, patch) => {
    setLines((prev) => prev.map((line, i) => {
      if (i !== index) return line
      const next = { ...line, ...patch }
      if (patch.isDelayed === true) next.quantityReceived = 0
      return next
    }))
  }

  const receiveTotal = (Array.isArray(lines) ? lines : []).reduce((sum, line) => sum + (line.isDelayed ? 0 : Number(line.quantityReceived || 0) * Number(line.costPrice || 0)), 0)
  const delayedCount = (Array.isArray(lines) ? lines : []).filter((line) => line.isDelayed).length
  const receivingNowCount = (Array.isArray(lines) ? lines : []).filter((line) => !line.isDelayed && Number(line.quantityReceived || 0) > 0).length
  const isPartialReceive = receivingNowCount > 0 && (delayedCount > 0 || (Array.isArray(lines) ? lines : []).some((line) => Number(line.quantityReceived || 0) < Number(line.quantityOrdered || 0)))

  if (isEdit && isLoading) {
    return (
      <div className="flex justify-center p-16">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-teal-700" />
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-24">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <button type="button" onClick={() => navigate(PURCHASES_PATH.grn)} className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200/80 bg-white text-slate-600 transition hover:border-slate-300 dark:border-white/10 dark:bg-transparent">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-slate-400">
              {language === 'ar' ? 'إشعار الاستلام' : 'Goods receipt'}
            </p>
            <h1 className="mt-1.5 text-2xl font-semibold tracking-[-0.04em] text-slate-950 dark:text-white sm:text-[28px]">
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
              {isFutureDate(expectedDate) || receiveEarlyParam
                ? (language === 'ar' ? 'استلام قبل التاريخ المتوقع' : 'Receive before estimated date')
                : (language === 'ar' ? 'استلام' : 'Receive')}
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

      <section className={`${shell} p-5 sm:p-6`}>
        <div className="mb-5 border-b border-slate-100 pb-4 dark:border-white/[0.08]">
          <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-slate-400">
            {language === 'ar' ? 'بيانات الاستلام' : 'Receipt information'}
          </p>
          <p className="mt-1 text-[13px] text-slate-500">
            {language === 'ar' ? 'اختر أمر الشراء لتعبئة البنود والكميات المتبقية' : 'Pick a purchase order to fill remaining lines'}
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400 lg:col-span-2">
            {language === 'ar' ? 'طلب الشراء' : 'Purchase order'}
            <select
              value={purchaseOrderId}
              disabled={locked || loadingPos}
              onChange={(e) => {
                const value = e.target.value
                setPurchaseOrderId(value)
                if (value) pullPo(value)
                else setLines([emptyLine()])
              }}
              className={`mt-1.5 ${fieldControlClass}`}
            >
              <option value="">{loadingPos ? (language === 'ar' ? 'جاري التحميل…' : 'Loading…') : (language === 'ar' ? 'اختر طلب شراء' : 'Select a purchase order')}</option>
              {(Array.isArray(purchaseOrders) ? purchaseOrders : []).map((po) => (
                <option key={po._id} value={po._id}>
                  {po.poNumber} — {partyName(po.supplierId, language)} ({statusLabel(po.status, language)})
                </option>
              ))}
            </select>
          </label>
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
            {language === 'ar' ? 'المورد' : 'Vendor'}
            <div className="mt-1.5">
              <PartnerCombobox
                role="vendor"
                value={supplierId}
                selectedOption={selectedSupplier}
                ar={language === 'ar'}
                language={language}
                disabled={locked}
                onChange={(id, opt) => {
                  setSupplierId(id || '')
                  setSelectedSupplier(opt || null)
                }}
              />
            </div>
          </div>
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
          <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
            {language === 'ar' ? 'تاريخ الاستلام المتوقع' : 'Estimated receive date'}
            <input type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} disabled={locked} className={`mt-1.5 ${fieldControlClass}`} />
          </label>
          <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
            {language === 'ar' ? 'تاريخ التأخير' : 'Delayed receive date'}
            <input
              type="date"
              value={earliestDelayedUntil(lines) || ''}
              disabled
              className={`mt-1.5 ${fieldControlClass}`}
            />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap gap-2 text-[12px]">
          <span className={`inline-flex rounded-full px-2.5 py-0.5 font-medium ring-1 ring-inset ${isPartialReceive ? STATUS_PILL.partially_received || STATUS_PILL.draft : 'bg-slate-50 text-slate-500 ring-slate-200/70'}`}>
            {language === 'ar' ? 'استلام جزئي' : 'Partial received'}: {isPartialReceive ? (language === 'ar' ? 'نعم' : 'Yes') : (language === 'ar' ? 'لا' : 'No')}
          </span>
          {expectedDate ? (
            <span className="inline-flex rounded-full bg-slate-50 px-2.5 py-0.5 font-medium text-slate-600 ring-1 ring-inset ring-slate-200/70">
              {language === 'ar' ? 'المتوقع' : 'Estimated'} {formatDay(expectedDate, language)}
            </span>
          ) : null}
          {earliestDelayedUntil(lines) ? (
            <span className={`inline-flex rounded-full px-2.5 py-0.5 font-medium ring-1 ring-inset ${STATUS_PILL.delayed}`}>
              {language === 'ar' ? 'التأخير حتى' : 'Delayed until'} {formatDay(earliestDelayedUntil(lines), language)}
            </span>
          ) : null}
        </div>
        {!loadingPos && !(purchaseOrders || []).length && (
          <p className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-[13px] text-slate-600 dark:bg-white/[0.04] dark:text-slate-300">
            {language === 'ar' ? 'لا توجد طلبات شراء مفتوحة. ' : 'No open purchase orders. '}
            <Link to={`${PURCHASES_PATH.orders}/new`} className="font-medium text-teal-700 hover:underline">
              {language === 'ar' ? 'إنشاء طلب شراء' : 'Create a purchase order'}
            </Link>
          </p>
        )}
      </section>

      <section className={`${shell} p-5 sm:p-6`}>
        <div className="mb-5 flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-end sm:justify-between dark:border-white/[0.08]">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-slate-400">
              {language === 'ar' ? 'بنود الاستلام' : 'Receive items'}
            </p>
            <p className="mt-1 text-[13px] text-slate-500">
              {language === 'ar' ? 'حدد الكمية المستلمة الآن، أو علّم البند متأخراً' : 'Receive now, or mark a line delayed'}
            </p>
          </div>
          {!locked && (
            <button type="button" onClick={() => setLines((prev) => [...prev, emptyLine()])} className={ghostBtn}>
              <Plus className="h-4 w-4" />
              {language === 'ar' ? 'إضافة بند' : 'Add item'}
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
                  variantId: '',
                  productName: product.name || product.nameEn || product.nameAr,
                  barcode: product.barcode,
                  productType: normalizeProductType(product.productType),
                  uom: product.unitOfMeasure || 'PCE',
                  costPrice: product.costPrice || 0,
                }, ...prev.filter((l) => l.productId || l.productName)])
              }}
            />
          </div>
        )}
        <div className="space-y-3">
          {lines.map((line, index) => (
            <div key={index} className="rounded-2xl border border-slate-100 p-4 dark:border-white/[0.08]">
              <div className="grid grid-cols-1 items-end gap-4 lg:grid-cols-12">
                <div className="lg:col-span-4">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <label className="text-[11px] font-medium text-slate-500">{language === 'ar' ? 'المنتج' : 'Product'}</label>
                    <ProductTypeToggle
                      value={normalizeProductType(line.productType)}
                      onChange={(next) => updateLine(index, { productType: next })}
                      language={language}
                      disabled={locked}
                    />
                  </div>
                  <input value={line.productName} disabled className={fieldControlClass} />
                  {line.productId && (
                    <div className="mt-1.5">
                      <VariantLineSelect
                        productId={line.productId}
                        value={line.variantId || ''}
                        language={language}
                        onChange={(variantId) => updateLine(index, { variantId: variantId || '' })}
                      />
                    </div>
                  )}
                </div>
                <label className="text-[11px] font-medium text-slate-500 lg:col-span-2">
                  {language === 'ar' ? 'الوحدة' : 'UOM'}
                  <input value={line.uom || 'PCE'} disabled className={`mt-1.5 ${fieldControlClass}`} />
                </label>
                <label className="text-[11px] font-medium text-slate-500 lg:col-span-2">
                  {language === 'ar' ? 'المطلوب' : 'Ordered'}
                  <input value={line.quantityOrdered || 0} disabled className={`mt-1.5 ${fieldControlClass}`} />
                </label>
                <label className="text-[11px] font-medium text-slate-500 lg:col-span-2">
                  {language === 'ar' ? 'استلام الآن' : 'Receive now'}
                  <input
                    type="number"
                    min="0"
                    value={line.isDelayed ? 0 : line.quantityReceived}
                    disabled={locked || line.isDelayed}
                    onChange={(e) => updateLine(index, { quantityReceived: Number(e.target.value) })}
                    className={`mt-1.5 ${fieldControlClass}`}
                  />
                </label>
                <div className="lg:col-span-2 text-end">
                  <p className="text-[11px] font-medium text-slate-500">{language === 'ar' ? 'القيمة' : 'Value'}</p>
                  <p className="mt-2 text-[15px] font-semibold tabular-nums text-slate-900 dark:text-white">
                    <Money value={line.isDelayed ? 0 : Number(line.quantityReceived || 0) * Number(line.costPrice || 0)} />
                  </p>
                </div>
              </div>
              {(() => {
                const orderedQty = Number(line.quantityOrdered || 0);
                const receivedQty = line.isDelayed ? 0 : Number(line.quantityReceived || 0);
                const remainingTarget = Number(line.remaining != null ? line.remaining : orderedQty);
                const backorderQty = Math.max(0, remainingTarget - receivedQty);
                return (
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                    <span className="text-slate-400">
                      {isStockTrackedProductType(line.productType)
                        ? (language === 'ar' ? 'بضاعة — تُضاف للمخزون عند الاستلام' : 'Goods — posts warehouse stock on receive')
                        : (language === 'ar' ? 'خدمة — بدون مخزون' : 'Service — no stock movement')}
                    </span>
                    {backorderQty > 0 ? (
                      <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-700 ring-1 ring-inset ring-amber-200/70 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/20">
                        {language === 'ar' ? `طلب متبقي (Backorder): ${backorderQty} ${line.uom || 'PCE'}` : `Backorder: ${backorderQty} ${line.uom || 'PCE'}`}
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200/70 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/20">
                        {language === 'ar' ? 'استلام كامل' : 'Full receipt'}
                      </span>
                    )}
                  </div>
                );
              })()}
              <div className={`mt-4 rounded-xl p-3.5 ${line.isDelayed ? 'border border-amber-200/80 bg-amber-50/70 dark:border-amber-500/20 dark:bg-amber-500/[0.06]' : 'bg-slate-50/80 dark:bg-white/[0.03]'}`}>
                <label className="flex items-center gap-2 text-[13px] font-medium text-slate-700 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={Boolean(line.isDelayed)}
                    disabled={locked}
                    onChange={(e) => updateLine(index, { isDelayed: e.target.checked })}
                  />
                  <Clock3 className="h-4 w-4 text-amber-600" />
                  {language === 'ar' ? 'تأخير هذا البند' : 'Delay this line'}
                </label>
                {line.isDelayed && (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <label className="text-[11px] font-medium text-slate-500">
                      {language === 'ar' ? 'مؤجل حتى' : 'Delayed until'}
                      <input
                        type="date"
                        value={line.delayedUntil}
                        disabled={locked}
                        onChange={(e) => updateLine(index, { delayedUntil: e.target.value })}
                        className={`mt-1.5 ${fieldControlClass}`}
                      />
                    </label>
                    <label className="text-[11px] font-medium text-slate-500">
                      {language === 'ar' ? 'سبب التأخير' : 'Delay reason'}
                      <input
                        value={line.delayReason}
                        disabled={locked}
                        placeholder={language === 'ar' ? 'جمارك، ناقلة، نقص المورد…' : 'Customs, carrier, supplier shortage…'}
                        onChange={(e) => updateLine(index, { delayReason: e.target.value })}
                        className={`mt-1.5 ${fieldControlClass}`}
                      />
                    </label>
                    <label className="text-[11px] font-medium text-slate-500 sm:col-span-2">
                      {language === 'ar' ? 'ملاحظة التأخير' : 'Delay notes'}
                      <textarea
                        rows={2}
                        value={line.notes}
                        disabled={locked}
                        placeholder={language === 'ar' ? 'تفاصيل هذا التأخير لهذا البند فقط' : 'Detail for this delayed line only'}
                        onChange={(e) => updateLine(index, { notes: e.target.value })}
                        className={`mt-1.5 ${fieldControlClass}`}
                      />
                    </label>
                  </div>
                )}
              </div>
              {!line.isDelayed && (
                <input
                  value={line.notes}
                  disabled={locked}
                  placeholder={language === 'ar' ? 'ملاحظة إضافية لهذا البند' : 'Extra note for this line'}
                  onChange={(e) => updateLine(index, { notes: e.target.value })}
                  className={`mt-3 ${fieldControlClass}`}
                />
              )}
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

      <section className={`${shell} p-5 sm:p-6`}>
        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-slate-400">
          {language === 'ar' ? 'ملاحظة إضافية' : 'Extra note'}
        </p>
        <textarea
          value={notes}
          disabled={locked}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          placeholder={language === 'ar' ? 'ملاحظات الاستلام، الفحص، أو الناقل' : 'Receiving, inspection, or carrier notes'}
          className={`mt-3 ${fieldControlClass}`}
        />
        <div className="mt-5 flex justify-between border-t border-slate-100 pt-4 text-[15px] font-semibold dark:border-white/[0.08]">
          <span>{language === 'ar' ? 'قيمة المستلم' : 'Received value'}</span>
          <span className="tabular-nums"><Money value={receiveTotal} /></span>
        </div>
      </section>
    </div>
  )
}
