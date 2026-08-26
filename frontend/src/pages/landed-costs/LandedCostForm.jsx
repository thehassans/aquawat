import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useSelector } from 'react-redux'
import {
  Save,
  X,
  Plus,
  Trash2,
  Calculator,
  CheckCircle,
  ArrowLeft,
  Anchor,
  Ship,
  FileText,
} from 'lucide-react'
import api from '../../lib/api'
import { normalizeGrnList } from '../../lib/grnApi'
import Money from '../../components/ui/Money'

const COST_TYPES = ['customs_duty', 'freight', 'insurance', 'port_handling', 'clearance_fees', 'other']

const COST_TYPE_LABELS = {
  customs_duty: { en: 'Customs duty', ar: 'رسوم جمركية' },
  freight: { en: 'Freight', ar: 'شحن' },
  insurance: { en: 'Insurance', ar: 'تأمين' },
  port_handling: { en: 'Port handling', ar: 'مناولة الميناء' },
  clearance_fees: { en: 'Clearance fees', ar: 'رسوم التخليص' },
  other: { en: 'Other', ar: 'أخرى' },
}

const STATUS_PILL = {
  draft: 'bg-slate-50 text-slate-500 ring-slate-200/70 dark:bg-white/[0.04] dark:text-slate-400 dark:ring-white/10',
  calculated: 'bg-amber-50 text-amber-800 ring-amber-200/70 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/20',
  posted: 'bg-emerald-50 text-emerald-700 ring-emerald-200/70 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/20',
}

const Field = ({ label, hint, children }) => (
  <div className="space-y-1.5">
    <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">{label}</label>
    {children}
    {hint ? <p className="text-[11px] text-slate-400">{hint}</p> : null}
  </div>
)

const inputClass =
  'w-full rounded-xl border border-slate-200/80 bg-white px-3.5 py-2.5 text-[13px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-teal-600/40 focus:ring-2 focus:ring-teal-600/15 disabled:bg-slate-50 disabled:text-slate-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:disabled:bg-white/[0.02]'

const Input = (props) => <input {...props} className={`${inputClass} ${props.className || ''}`} />

const Select = ({ children, ...props }) => (
  <select {...props} className={inputClass}>
    {children}
  </select>
)

const shell =
  'overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_16px_40px_-32px_rgba(15,23,42,0.45)] dark:border-white/10 dark:bg-[#0c111a]'
const ghostBtn =
  'inline-flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white px-3.5 py-2 text-[13px] font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-40 dark:border-white/10 dark:bg-transparent dark:text-slate-200 dark:hover:border-white/20 dark:hover:bg-white/[0.04]'
const primaryBtn =
  'inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-[13px] font-medium text-white transition hover:bg-slate-800 disabled:opacity-40 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100'
const amberBtn =
  'inline-flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-[13px] font-medium text-white transition hover:bg-amber-700 disabled:opacity-40'
const emeraldBtn =
  'inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-[13px] font-medium text-white transition hover:bg-emerald-700 disabled:opacity-40'

const emptyCostLine = () => ({ type: 'customs_duty', description: '', amount: '', currency: 'SAR', exchangeRate: 1 })
const emptyAllocation = () => ({ productName: '', productCode: '', quantity: '', unitCostBeforeLanded: '', weight: '', lineValue: '' })

function round2(value) {
  return Math.round((Number(value) || 0) * 100) / 100
}

function numOrBlank(value) {
  return value === 0 || value === '0' ? 0 : (value ?? '')
}

function allocatePreview(totalCost, rows = [], method = 'by_value') {
  const total = round2(totalCost)
  const list = (Array.isArray(rows) ? rows : []).map((row) => ({ ...row }))
  if (!list.length) return []
  const bases = list.map((row) => {
    if (method === 'by_quantity') return Math.max(0, Number(row.quantity) || 0)
    if (method === 'by_weight') return Math.max(0, Number(row.weight) || 0)
    if (method === 'equal') return 1
    return Math.max(0, Number(row.lineValue) || 0)
  })
  const totalBasis = bases.reduce((sum, basis) => sum + basis, 0)
  let allocatedSoFar = 0
  return list.map((row, idx) => {
    const isLast = idx === list.length - 1
    let allocatedCost
    if (totalBasis <= 0) {
      allocatedCost = isLast ? round2(total - allocatedSoFar) : round2(total / list.length)
    } else if (isLast) {
      allocatedCost = round2(total - allocatedSoFar)
    } else {
      allocatedCost = round2(total * (bases[idx] / totalBasis))
    }
    allocatedSoFar = round2(allocatedSoFar + allocatedCost)
    const qty = Number(row.quantity) || 1
    const unitLandedCost = round2(allocatedCost / qty)
    const totalLandedUnitCost = round2((Number(row.unitCostBeforeLanded) || 0) + unitLandedCost)
    return { ...row, allocatedCost, unitLandedCost, totalLandedUnitCost }
  })
}

export default function LandedCostForm() {
  const navigate = useNavigate()
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const isEdit = !!id
  const { language } = useSelector(s => s.ui)
  const isAr = language === 'ar'
  const t = (en, ar) => isAr ? ar : en
  const presetShipmentId = String(searchParams.get('shipment') || '').trim()
  const presetPoId = String(searchParams.get('po') || '').trim()
  const presetGrnId = String(searchParams.get('grn') || '').trim()

  const [form, setForm] = useState({
    lcNumber: '', vendor: '', invoiceDate: '', referenceNumber: '', notes: '',
    allocationMethod: 'by_value', status: 'draft',
    purchaseOrder: presetPoId, shipment: presetShipmentId, grnIds: presetGrnId ? [presetGrnId] : []
  })
  const [costLines, setCostLines] = useState([emptyCostLine()])
  const [allocations, setAllocations] = useState([emptyAllocation()])
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [calculating, setCalculating] = useState(false)
  const [posting, setPosting] = useState(false)
  const [error, setError] = useState('')
  const [shipments, setShipments] = useState([])
  const [purchaseOrders, setPurchaseOrders] = useState([])
  const [grns, setGrns] = useState([])
  const [linkedPrefillDone, setLinkedPrefillDone] = useState(false)

  const fetchLC = useCallback(async () => {
    if (!isEdit) return
    try {
      setLoading(true)
      const { data } = await api.get(`/landed-costs/${id}`)
      setForm({
        lcNumber: data.lcNumber || '', vendor: data.vendor || '',
        invoiceDate: data.invoiceDate?.split('T')[0] || '',
        referenceNumber: data.referenceNumber || '', notes: data.notes || '',
        allocationMethod: data.allocationMethod || 'by_value', status: data.status || 'draft',
        purchaseOrder: data.purchaseOrder?._id || data.purchaseOrder || '',
        shipment: data.shipment?._id || data.shipment || '',
        grnIds: (data.grnIds || []).map((g) => g._id || g),
      })
      setCostLines(data.costLines?.length ? data.costLines : [emptyCostLine()])
      setAllocations(data.allocations?.length ? data.allocations : [emptyAllocation()])
    } catch (_) { setError(t('Failed to load', 'فشل في التحميل')) }
    finally { setLoading(false) }
  }, [id, isEdit])

  useEffect(() => { fetchLC() }, [fetchLC])

  useEffect(() => {
    let cancelled = false
    const loadLookups = async () => {
      try {
        const [shipRes, poRes, grnRes] = await Promise.all([
          api.get('/shipments', { params: { page: 1, limit: 200, type: 'inbound' } }),
          api.get('/purchase-orders', { params: { page: 1, limit: 200 } }),
          api.get('/grn'),
        ])
        if (cancelled) return
        setShipments(shipRes.data?.shipments || [])
        setPurchaseOrders(poRes.data?.purchaseOrders || [])
        setGrns(normalizeGrnList(grnRes.data))
      } catch (_) { /* lookups optional */ }
    }
    loadLookups()
    return () => { cancelled = true }
  }, [])

  const applyLinkedDocs = useCallback(async (shipmentId, purchaseOrderId, grnIds = [], { fillVendor = true } = {}) => {
    const selectedGrns = Array.isArray(grnIds) ? grnIds.filter(Boolean) : (grnIds ? [grnIds] : [])
    if (!shipmentId && !purchaseOrderId && !selectedGrns.length) return
    try {
      const { data } = await api.get('/landed-costs/from-links', {
        params: {
          shipment: shipmentId || undefined,
          purchaseOrder: purchaseOrderId || undefined,
          grnIds: selectedGrns.join(','),
        },
      })
      const vendor = data.vendor || ''
      const nextPo = data.purchaseOrder?._id || data.purchaseOrder || purchaseOrderId || ''
      const nextAlloc = (data.allocations || []).map((row) => {
        const qty = Number(row.quantity) || 0
        const unit = Number(row.unitCostBeforeLanded) || 0
        return {
          productId: row.productId || '',
          productName: row.productName || '',
          productCode: row.productCode || '',
          quantity: numOrBlank(row.quantity),
          unitCostBeforeLanded: numOrBlank(row.unitCostBeforeLanded),
          weight: numOrBlank(row.weight),
          lineValue: numOrBlank(row.lineValue ?? qty * unit),
        }
      })
      setForm((f) => ({
        ...f,
        shipment: data.shipment || shipmentId || f.shipment,
        purchaseOrder: nextPo || f.purchaseOrder,
        grnIds: (data.grnIds || selectedGrns).map((id) => String(id)),
        vendor: fillVendor && vendor ? vendor : f.vendor,
      }))
      if (nextAlloc.length) setAllocations(nextAlloc)
    } catch (_) { /* keep current form */ }
  }, [])

  useEffect(() => {
    if (isEdit || linkedPrefillDone) return
    if (presetShipmentId) {
      setLinkedPrefillDone(true)
      applyLinkedDocs(presetShipmentId, presetPoId, presetGrnId ? [presetGrnId] : [])
      return
    }
    if (presetPoId || presetGrnId) {
      setLinkedPrefillDone(true)
      applyLinkedDocs('', presetPoId, presetGrnId ? [presetGrnId] : [])
    }
  }, [applyLinkedDocs, isEdit, linkedPrefillDone, presetShipmentId, presetPoId, presetGrnId])

  const totalCost = costLines.reduce((s, l) => s + (parseFloat(l.amount) || 0) * (parseFloat(l.exchangeRate) || 1), 0)
  const previewedAllocations = useMemo(
    () => allocatePreview(totalCost, allocations, form.allocationMethod),
    [totalCost, allocations, form.allocationMethod]
  )

  const handleSave = async () => {
    try {
      setSaving(true); setError('')
      const payload = { ...form, costLines, allocations: previewedAllocations }
      if (isEdit) { await api.put(`/landed-costs/${id}`, payload); await fetchLC() }
      else { const { data } = await api.post('/landed-costs', payload); navigate(`/app/dashboard/purchases/landed-costs/${data._id}`) }
    } catch (e) { setError(e.userMessage || t('Failed to save', 'فشل')) }
    finally { setSaving(false) }
  }

  const handleCalculate = async () => {
    if (!isEdit) { await handleSave(); return }
    try {
      setCalculating(true)
      await api.put(`/landed-costs/${id}`, { costLines, allocations: previewedAllocations })
      const { data } = await api.post(`/landed-costs/${id}/calculate`)
      setAllocations(data.allocations || [])
      setForm(f => ({ ...f, status: data.status }))
    } catch (e) { setError(e.userMessage || t('Calculation failed', 'فشل الحساب')) }
    finally { setCalculating(false) }
  }

  const handlePost = async () => {
    try {
      setPosting(true)
      await api.post(`/landed-costs/${id}/post`)
      await fetchLC()
    } catch (e) { setError(e.userMessage || t('Failed to post', 'فشل النشر')) }
    finally { setPosting(false) }
  }

  const handleCancel = async () => {
    try {
      await api.post(`/landed-costs/${id}/cancel`)
      await fetchLC()
    } catch (e) { setError(e.userMessage || t('Failed to cancel', 'فشل الإلغاء')) }
  }

  const updateCostLine = (idx, field, value) => {
    setCostLines(lines => lines.map((l, i) => i === idx ? { ...l, [field]: value } : l))
  }

  const updateAllocation = (idx, field, value) => {
    setAllocations((allocs) => allocs.map((a, i) => {
      if (i !== idx) return a
      const next = { ...a, [field]: value }
      if (field === 'quantity' || field === 'unitCostBeforeLanded') {
        const qty = Number(field === 'quantity' ? value : next.quantity) || 0
        const unit = Number(field === 'unitCostBeforeLanded' ? value : next.unitCostBeforeLanded) || 0
        next.lineValue = round2(qty * unit)
      }
      return next
    }))
  }

  const isPosted = form.status === 'posted'
  const statusLabel = (status) => {
    const ar = { draft: 'مسودة', calculated: 'محسوبة', posted: 'منشورة' }
    if (isAr) return ar[status] || status
    return status ? status.charAt(0).toUpperCase() + status.slice(1) : status
  }
  const workflow = [
    { id: 'draft', label: t('Draft', 'مسودة') },
    { id: 'calculated', label: t('Calculated', 'محسوبة') },
    { id: 'posted', label: t('Posted', 'منشورة') },
  ]
  const workflowIndex = form.status === 'posted' ? 2 : form.status === 'calculated' ? 1 : 0

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-10 w-64 animate-pulse rounded-xl bg-slate-200 dark:bg-white/10" />
        <div className="h-96 animate-pulse rounded-2xl bg-slate-100 dark:bg-white/5" />
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-24">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={() => navigate('/app/dashboard/purchases/landed-costs')}
            className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200/80 bg-white text-slate-600 transition hover:border-slate-300 hover:text-slate-900 dark:border-white/10 dark:bg-transparent dark:text-slate-300"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-slate-400">
              {t('Import costing', 'تكلفة الاستيراد')}
            </p>
            <h1 className="mt-1.5 text-2xl font-semibold tracking-[-0.04em] text-slate-950 dark:text-white sm:text-[28px]">
              {isEdit ? (form.lcNumber || t('Landed cost', 'تكلفة مرسية')) : t('New landed cost', 'تكلفة مرسية جديدة')}
            </h1>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1 ring-inset ${STATUS_PILL[form.status] || STATUS_PILL.draft}`}>
                {statusLabel(form.status)}
              </span>
              {form.vendor ? <span className="text-[12px] text-slate-500">{form.vendor}</span> : null}
            </div>
          </div>
        </div>
        <div className="hidden flex-wrap items-center gap-2 md:flex">
          <button type="button" onClick={() => navigate('/app/dashboard/purchases/landed-costs')} className={ghostBtn}>
            <X className="h-4 w-4 opacity-70" /> {t('Cancel', 'إلغاء')}
          </button>
          {!isPosted && (
            <button type="button" onClick={handleSave} disabled={saving} className={primaryBtn}>
              <Save className="h-4 w-4 opacity-80" /> {saving ? t('Saving…', 'جارٍ الحفظ…') : t('Save draft', 'حفظ مسودة')}
            </button>
          )}
          {isEdit && !isPosted && (
            <button type="button" onClick={handleCalculate} disabled={calculating} className={amberBtn}>
              <Calculator className="h-4 w-4" /> {calculating ? t('Calculating…', 'جارٍ الحساب…') : t('Calculate', 'احسب')}
            </button>
          )}
          {isEdit && form.status === 'calculated' && (
            <button type="button" onClick={handlePost} disabled={posting} className={emeraldBtn}>
              <CheckCircle className="h-4 w-4" /> {posting ? t('Posting…', 'جارٍ النشر…') : t('Post to inventory', 'ترحيل للمخزون')}
            </button>
          )}
          {isEdit && form.status !== 'posted' && form.status !== 'cancelled' && (
            <button type="button" onClick={handleCancel} className={ghostBtn}>
              <X className="h-4 w-4" /> {t('Cancel', 'إلغاء')}
            </button>
          )}
        </div>
      </div>

      <div className={`${shell} px-5 py-4`}>
        <div className="flex items-center gap-2">
          {workflow.map((step, idx) => (
            <div key={step.id} className="flex flex-1 items-center gap-2">
              <div
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                  idx <= workflowIndex
                    ? 'bg-slate-950 text-white dark:bg-white dark:text-slate-950'
                    : 'bg-slate-100 text-slate-400 dark:bg-white/10'
                }`}
              >
                {idx + 1}
              </div>
              <span className={`text-[12px] font-medium ${idx <= workflowIndex ? 'text-slate-800 dark:text-slate-200' : 'text-slate-400'}`}>
                {step.label}
              </span>
              {idx < workflow.length - 1 && (
                <div className={`h-px flex-1 ${idx < workflowIndex ? 'bg-slate-900 dark:bg-white' : 'bg-slate-200 dark:bg-white/10'}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] text-rose-700 dark:border-rose-800 dark:bg-rose-900/20 dark:text-rose-300">
          {error}
        </div>
      )}

      {isPosted && (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-800 dark:bg-emerald-900/10">
          <CheckCircle className="h-5 w-5 shrink-0 text-emerald-600" />
          <p className="text-[13px] font-medium text-emerald-800 dark:text-emerald-300">
            {t('Posted and locked. Unit costs have been applied to inventory.', 'تم الترحيل والقفل. طُبقت تكلفة الوحدة على المخزون.')}
          </p>
        </div>
      )}

      <div className={`${shell} p-6`}>
        <div className="mb-5 flex items-center gap-2">
          <FileText className="h-4 w-4 text-slate-400" />
          <h2 className="text-[13px] font-semibold tracking-tight text-slate-950 dark:text-white">
            {t('Header', 'البيانات الأساسية')}
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label={t('LC number', 'رقم التكلفة')}>
            <Input value={form.lcNumber} onChange={(e) => setForm((f) => ({ ...f, lcNumber: e.target.value }))} disabled={isPosted} placeholder={t('Auto-generated', 'يُنشأ تلقائياً')} />
          </Field>
          <Field label={t('Vendor', 'المورد')}>
            <Input value={form.vendor} onChange={(e) => setForm((f) => ({ ...f, vendor: e.target.value }))} disabled={isPosted} placeholder={t('Supplier or broker', 'المورد أو المخلّص')} />
          </Field>
          <Field label={t('Invoice date', 'تاريخ الفاتورة')}>
            <Input type="date" value={form.invoiceDate} onChange={(e) => setForm((f) => ({ ...f, invoiceDate: e.target.value }))} disabled={isPosted} />
          </Field>
          <Field label={t('Purchase order', 'أمر الشراء')}>
            <Select
              value={form.purchaseOrder}
              disabled={isPosted}
              onChange={(e) => {
                const next = e.target.value
                setForm((f) => ({ ...f, purchaseOrder: next }))
                if (next && !isPosted) {
                  applyLinkedDocs(form.shipment, next, form.grnIds, { fillVendor: !form.vendor })
                } else if (!next) {
                  setAllocations([emptyAllocation()])
                }
              }}
            >
              <option value="">{t('Select PO', 'اختر أمر شراء')}</option>
              {purchaseOrders.map((po) => (
                <option key={po._id} value={po._id}>{po.poNumber}</option>
              ))}
            </Select>
          </Field>
          <Field label={t('Inbound shipment', 'الشحنة الواردة')}>
            <Select
              value={form.shipment}
              disabled={isPosted}
              onChange={(e) => {
                const next = e.target.value
                setForm((f) => ({ ...f, shipment: next }))
                if (next && !isPosted) applyLinkedDocs(next, form.purchaseOrder, form.grnIds)
              }}
            >
              <option value="">{t('Select shipment', 'اختر شحنة')}</option>
              {shipments.map((s) => (
                <option key={s._id} value={s._id}>{s.shipmentNumber}</option>
              ))}
            </Select>
          </Field>
          <Field label={t('GRN', 'إشعار الاستلام')}>
            <Select
              value={(form.grnIds || [])[0] || ''}
              disabled={isPosted}
              onChange={(e) => {
                const next = e.target.value ? [e.target.value] : []
                setForm((f) => ({ ...f, grnIds: next }))
                if (e.target.value && !isPosted) {
                  applyLinkedDocs(form.shipment, form.purchaseOrder, next)
                } else if (!e.target.value && !form.purchaseOrder && !form.shipment) {
                  setAllocations([emptyAllocation()])
                }
              }}
            >
              <option value="">{t('Select GRN', 'اختر إشعار استلام')}</option>
              {grns.filter((g) => ['received', 'completed', 'draft'].includes(g.status) || (form.grnIds || []).includes(g._id)).map((g) => (
                <option key={g._id} value={g._id}>{g.grnNumber}</option>
              ))}
            </Select>
          </Field>
          <Field label={t('Reference', 'المرجع')}>
            <Input value={form.referenceNumber} onChange={(e) => setForm((f) => ({ ...f, referenceNumber: e.target.value }))} disabled={isPosted} />
          </Field>
          <Field label={t('Allocation method', 'طريقة التوزيع')} hint={t('How overhead is spread across products', 'كيف تُوزَّع التكاليف على المنتجات')}>
            <Select value={form.allocationMethod} onChange={(e) => setForm((f) => ({ ...f, allocationMethod: e.target.value }))} disabled={isPosted}>
              <option value="by_value">{t('By value', 'بالقيمة')}</option>
              <option value="by_weight">{t('By weight', 'بالوزن')}</option>
              <option value="by_quantity">{t('By quantity', 'بالكمية')}</option>
              <option value="equal">{t('Equal split', 'مقسّم بالتساوي')}</option>
            </Select>
          </Field>
        </div>
      </div>

      <div className={shell}>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-white/10">
          <div className="flex items-center gap-2">
            <Ship className="h-4 w-4 text-slate-400" />
            <h2 className="text-[13px] font-semibold text-slate-950 dark:text-white">{t('Cost lines', 'بنود التكلفة')}</h2>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[12px] font-semibold tabular-nums text-slate-950 dark:text-white">
              <Money value={totalCost} />
            </span>
            {!isPosted && (
              <button type="button" onClick={() => setCostLines((l) => [...l, emptyCostLine()])} className={ghostBtn}>
                <Plus className="h-4 w-4" /> {t('Add line', 'إضافة بند')}
              </button>
            )}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-white/10">
                {[t('Type', 'النوع'), t('Description', 'الوصف'), t('Amount', 'المبلغ'), t('Currency', 'العملة'), t('FX rate', 'سعر الصرف'), t('SAR', 'ر.س'), ''].map((h) => (
                  <th key={h || 'x'} className="whitespace-nowrap px-4 py-3 text-start text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-white/5">
              {costLines.map((line, idx) => {
                const sarAmount = (parseFloat(line.amount) || 0) * (parseFloat(line.exchangeRate) || 1)
                return (
                  <tr key={idx} className="hover:bg-slate-50/70 dark:hover:bg-white/[0.02]">
                    <td className="px-3 py-2.5">
                      <Select value={line.type} onChange={(e) => updateCostLine(idx, 'type', e.target.value)} disabled={isPosted}>
                        {COST_TYPES.map((ct) => (
                          <option key={ct} value={ct}>{COST_TYPE_LABELS[ct]?.[isAr ? 'ar' : 'en'] || ct}</option>
                        ))}
                      </Select>
                    </td>
                    <td className="px-3 py-2.5"><Input value={line.description || ''} onChange={(e) => updateCostLine(idx, 'description', e.target.value)} disabled={isPosted} placeholder={t('Optional note', 'ملاحظة اختيارية')} /></td>
                    <td className="px-3 py-2.5"><Input type="number" value={line.amount} onChange={(e) => updateCostLine(idx, 'amount', e.target.value)} disabled={isPosted} /></td>
                    <td className="px-3 py-2.5">
                      <Select value={line.currency} onChange={(e) => updateCostLine(idx, 'currency', e.target.value)} disabled={isPosted}>
                        {['SAR', 'USD', 'EUR', 'AED'].map((c) => <option key={c}>{c}</option>)}
                      </Select>
                    </td>
                    <td className="px-3 py-2.5"><Input type="number" step="0.0001" value={line.exchangeRate} onChange={(e) => updateCostLine(idx, 'exchangeRate', e.target.value)} disabled={isPosted} /></td>
                    <td className="px-3 py-2.5 font-semibold tabular-nums text-slate-950 dark:text-white"><Money value={sarAmount} /></td>
                    <td className="px-3 py-2.5">
                      {!isPosted && (
                        <button type="button" onClick={() => setCostLines((l) => l.filter((_, i) => i !== idx))} className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className={shell}>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-white/10">
          <div className="flex items-center gap-2">
            <Anchor className="h-4 w-4 text-slate-400" />
            <h2 className="text-[13px] font-semibold text-slate-950 dark:text-white">{t('Product allocation', 'توزيع المنتجات')}</h2>
          </div>
          {!isPosted && (
            <button type="button" onClick={() => setAllocations((a) => [...a, emptyAllocation()])} className={ghostBtn}>
              <Plus className="h-4 w-4" /> {t('Add product', 'إضافة منتج')}
            </button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-white/10">
                {[t('Product', 'المنتج'), t('SKU', 'الرمز'), t('Qty', 'الكمية'), t('Unit cost', 'تكلفة الوحدة'), t('Weight kg', 'الوزن'), t('Line value', 'قيمة السطر'), t('Allocated', 'المخصص'), t('Unit landed', 'الوحدة المرساة'), t('Total unit', 'الإجمالي/وحدة'), ''].map((h) => (
                  <th key={h || 'x'} className="whitespace-nowrap px-3 py-3 text-start text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-white/5">
              {previewedAllocations.map((alloc, idx) => (
                <tr key={idx} className="hover:bg-slate-50/70 dark:hover:bg-white/[0.02]">
                  <td className="px-3 py-2.5"><Input value={alloc.productName || ''} onChange={(e) => updateAllocation(idx, 'productName', e.target.value)} disabled={isPosted} /></td>
                  <td className="px-3 py-2.5"><Input value={alloc.productCode || ''} onChange={(e) => updateAllocation(idx, 'productCode', e.target.value)} disabled={isPosted} /></td>
                  <td className="px-3 py-2.5"><Input type="number" value={numOrBlank(alloc.quantity)} onChange={(e) => updateAllocation(idx, 'quantity', e.target.value)} disabled={isPosted} /></td>
                  <td className="px-3 py-2.5"><Input type="number" value={numOrBlank(alloc.unitCostBeforeLanded)} onChange={(e) => updateAllocation(idx, 'unitCostBeforeLanded', e.target.value)} disabled={isPosted} /></td>
                  <td className="px-3 py-2.5"><Input type="number" value={numOrBlank(alloc.weight)} onChange={(e) => updateAllocation(idx, 'weight', e.target.value)} disabled={isPosted} /></td>
                  <td className="px-3 py-2.5"><Input type="number" value={numOrBlank(alloc.lineValue)} onChange={(e) => updateAllocation(idx, 'lineValue', e.target.value)} disabled={isPosted} /></td>
                  <td className="px-3 py-2.5 text-[12px] font-semibold tabular-nums text-amber-700 dark:text-amber-400"><Money value={alloc.allocatedCost || 0} /></td>
                  <td className="px-3 py-2.5 text-[12px] font-semibold tabular-nums text-sky-700 dark:text-sky-400">{parseFloat(alloc.unitLandedCost || 0).toFixed(4)}</td>
                  <td className="px-3 py-2.5 text-[12px] font-bold tabular-nums text-emerald-700 dark:text-emerald-400">{parseFloat(alloc.totalLandedUnitCost || 0).toFixed(4)}</td>
                  <td className="px-3 py-2.5">
                    {!isPosted && (
                      <button type="button" onClick={() => setAllocations((a) => a.filter((_, i) => i !== idx))} className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {allocations.length === 0 && (
          <div className="px-6 py-10 text-center text-[13px] text-slate-400">
            {t('Link a shipment or PO, or add product lines to allocate costs.', 'اربط شحنة أو أمر شراء، أو أضف منتجات لتوزيع التكاليف.')}
          </div>
        )}
      </div>

      <div className={`${shell} p-5`}>
        <Field label={t('Notes', 'ملاحظات')}>
          <textarea
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            rows={3}
            disabled={isPosted}
            placeholder={t('Broker notes, BL number, or customs file…', 'ملاحظات المخلّص أو رقم البوليصة…')}
            className={`${inputClass} resize-none disabled:opacity-60`}
          />
        </Field>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200/80 bg-white/90 px-4 py-3 backdrop-blur-md dark:border-white/10 dark:bg-[#0c111a]/90 md:hidden">
        <div className="mx-auto flex max-w-lg gap-2">
          {!isPosted && (
            <button type="button" onClick={handleSave} disabled={saving} className={`${primaryBtn} flex-1 justify-center`}>
              <Save className="h-4 w-4" /> {t('Save', 'حفظ')}
            </button>
          )}
          {isEdit && !isPosted && (
            <button type="button" onClick={handleCalculate} disabled={calculating} className={`${amberBtn} flex-1 justify-center`}>
              <Calculator className="h-4 w-4" /> {t('Calculate', 'احسب')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

