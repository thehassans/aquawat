import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { motion } from 'framer-motion'
import { Save, X, Plus, Trash2, Calculator, CheckCircle } from 'lucide-react'
import api from '../../lib/api'

const COST_TYPES = ['customs_duty', 'freight', 'insurance', 'port_handling', 'clearance_fees', 'other']

const Field = ({ label, children }) => (
  <div className="space-y-1">
    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
    {children}
  </div>
)

const Input = (props) => (
  <input {...props} className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-dark-600 bg-white dark:bg-dark-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
)

const Select = ({ children, ...props }) => (
  <select {...props} className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-dark-600 bg-white dark:bg-dark-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">{children}</select>
)

const emptyCostLine = () => ({ type: 'customs_duty', description: '', amount: '', currency: 'SAR', exchangeRate: 1 })
const emptyAllocation = () => ({ productName: '', productCode: '', quantity: '', unitCostBeforeLanded: '', weight: '', lineValue: '' })

export default function LandedCostForm() {
  const navigate = useNavigate()
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const isEdit = !!id
  const { language } = useSelector(s => s.ui)
  const isAr = language === 'ar'
  const t = (en, ar) => isAr ? ar : en
  const presetShipmentId = String(searchParams.get('shipment') || '').trim()

  const [form, setForm] = useState({
    lcNumber: '', vendor: '', invoiceDate: '', referenceNumber: '', notes: '',
    allocationMethod: 'by_value', status: 'draft',
    purchaseOrder: '', shipment: presetShipmentId
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
        shipment: data.shipment?._id || data.shipment || ''
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
        const [shipRes, poRes] = await Promise.all([
          api.get('/shipments', { params: { page: 1, limit: 200, type: 'inbound' } }),
          api.get('/purchase-orders', { params: { page: 1, limit: 200 } }),
        ])
        if (cancelled) return
        setShipments(shipRes.data?.shipments || [])
        setPurchaseOrders(poRes.data?.purchaseOrders || [])
      } catch (_) { /* lookups optional */ }
    }
    loadLookups()
    return () => { cancelled = true }
  }, [])

  const applyLinkedDocs = useCallback(async (shipmentId, purchaseOrderId, { fillVendor = true } = {}) => {
    if (!shipmentId && !purchaseOrderId) return
    try {
      let vendor = ''
      let nextPo = purchaseOrderId || ''
      let nextAlloc = []

      if (shipmentId) {
        const { data: shipment } = await api.get(`/shipments/${shipmentId}`)
        vendor = isAr
          ? (shipment.supplierId?.nameAr || shipment.supplierId?.nameEn || '')
          : (shipment.supplierId?.nameEn || shipment.supplierId?.nameAr || '')
        const poRef = shipment.purchaseOrderId?._id || shipment.purchaseOrderId || ''
        if (poRef) nextPo = String(poRef)
        nextAlloc = (shipment.lineItems || []).map((line) => {
          const p = line.productId && typeof line.productId === 'object' ? line.productId : null
          return {
            productId: p?._id || line.productId || '',
            productName: p?.nameEn || p?.nameAr || line.description || '',
            productCode: p?.sku || '',
            quantity: line.quantity || '',
            unitCostBeforeLanded: '',
            weight: '',
            lineValue: '',
          }
        })
      }

      if (nextPo) {
        const { data: po } = await api.get(`/purchase-orders/${nextPo}`)
        if (!vendor) {
          vendor = isAr
            ? (po.supplierId?.nameAr || po.supplierId?.nameEn || '')
            : (po.supplierId?.nameEn || po.supplierId?.nameAr || '')
        }
        const byProduct = new Map()
        for (const line of po.lineItems || []) {
          const pid = String(line.productId?._id || line.productId || '')
          if (pid) byProduct.set(pid, line)
        }
        if (nextAlloc.length === 0) {
          nextAlloc = (po.lineItems || []).map((line) => {
            const p = line.productId && typeof line.productId === 'object' ? line.productId : null
            const qty = line.quantityOrdered || 0
            const unit = line.unitCost || 0
            return {
              productId: p?._id || line.productId || '',
              productName: p?.nameEn || p?.nameAr || line.manualName || line.description || '',
              productCode: p?.sku || '',
              quantity: qty,
              unitCostBeforeLanded: unit,
              weight: '',
              lineValue: qty * unit,
            }
          })
        } else {
          nextAlloc = nextAlloc.map((alloc) => {
            const line = byProduct.get(String(alloc.productId || ''))
            if (!line) return alloc
            const unit = line.unitCost || 0
            const qty = Number(alloc.quantity) || 0
            return {
              ...alloc,
              unitCostBeforeLanded: unit,
              lineValue: qty * unit,
              productName: alloc.productName || line.productId?.nameEn || line.manualName || '',
              productCode: alloc.productCode || line.productId?.sku || '',
            }
          })
        }
      }

      setForm((f) => ({
        ...f,
        shipment: shipmentId || f.shipment,
        purchaseOrder: nextPo || f.purchaseOrder,
        vendor: fillVendor && vendor ? vendor : f.vendor,
      }))
      if (nextAlloc.length) setAllocations(nextAlloc)
    } catch (_) { /* keep current form */ }
  }, [isAr])

  useEffect(() => {
    if (isEdit || linkedPrefillDone || !presetShipmentId) return
    setLinkedPrefillDone(true)
    applyLinkedDocs(presetShipmentId, '')
  }, [applyLinkedDocs, isEdit, linkedPrefillDone, presetShipmentId])

  const totalCost = costLines.reduce((s, l) => s + (parseFloat(l.amount) || 0) * (parseFloat(l.exchangeRate) || 1), 0)

  const handleSave = async () => {
    try {
      setSaving(true); setError('')
      const payload = { ...form, costLines, allocations }
      if (isEdit) { await api.put(`/landed-costs/${id}`, payload); await fetchLC() }
      else { const { data } = await api.post('/landed-costs', payload); navigate(`/app/dashboard/landed-costs/${data._id}`) }
    } catch (e) { setError(e.userMessage || t('Failed to save', 'فشل')) }
    finally { setSaving(false) }
  }

  const handleCalculate = async () => {
    if (!isEdit) { await handleSave(); return }
    try {
      setCalculating(true)
      await api.put(`/landed-costs/${id}`, { costLines, allocations })
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

  const updateCostLine = (idx, field, value) => {
    setCostLines(lines => lines.map((l, i) => i === idx ? { ...l, [field]: value } : l))
  }

  const updateAllocation = (idx, field, value) => {
    setAllocations(allocs => allocs.map((a, i) => i === idx ? { ...a, [field]: value } : a))
  }

  const isPosted = form.status === 'posted'

  if (loading) return <div className="animate-pulse space-y-4"><div className="h-8 bg-gray-200 dark:bg-dark-600 rounded w-64" /><div className="h-96 bg-gray-200 dark:bg-dark-600 rounded-2xl" /></div>

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {isEdit ? (form.lcNumber || t('Edit Landed Cost', 'تعديل ت.م')) : t('New Landed Cost', 'تكلفة مرسية جديدة')}
        </h1>
        <div className="flex items-center gap-2">
          <button onClick={() => navigate('/app/dashboard/landed-costs')} className="px-4 py-2 rounded-xl border border-gray-200 dark:border-dark-600 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-700 flex items-center gap-2">
            <X className="w-4 h-4" /> {t('Cancel', 'إلغاء')}
          </button>
          {!isPosted && (
            <button onClick={handleSave} disabled={saving} className="px-4 py-2 rounded-xl bg-gray-600 hover:bg-gray-700 text-white text-sm font-medium flex items-center gap-2 disabled:opacity-50">
              <Save className="w-4 h-4" /> {saving ? '...' : t('Save Draft', 'حفظ مسودة')}
            </button>
          )}
          {isEdit && !isPosted && (
            <button onClick={handleCalculate} disabled={calculating} className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium flex items-center gap-2 disabled:opacity-50">
              <Calculator className="w-4 h-4" /> {calculating ? t('Calculating...', 'جارٍ الحساب...') : t('Calculate', 'احسب')}
            </button>
          )}
          {isEdit && form.status === 'calculated' && (
            <button onClick={handlePost} disabled={posting} className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium flex items-center gap-2 disabled:opacity-50">
              <CheckCircle className="w-4 h-4" /> {posting ? '...' : t('Post', 'نشر')}
            </button>
          )}
        </div>
      </div>

      {error && <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm border border-red-200 dark:border-red-800">{error}</div>}

      {isPosted && (
        <div className="p-4 rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/10 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
          <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">{t('This landed cost has been posted and is read-only.', 'تم نشر هذه التكلفة وهي للقراءة فقط.')}</p>
        </div>
      )}

      {/* Top Form */}
      <div className="bg-white dark:bg-dark-800 rounded-2xl border border-gray-100 dark:border-dark-700 p-6">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-4">{t('Header Information', 'معلومات العنوان')}</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Field label={t('LC Number', 'رقم ت.م')}><Input value={form.lcNumber} onChange={e => setForm(f => ({ ...f, lcNumber: e.target.value }))} disabled={isPosted} placeholder="Auto-generated" /></Field>
          <Field label={t('Vendor', 'المورد')}><Input value={form.vendor} onChange={e => setForm(f => ({ ...f, vendor: e.target.value }))} disabled={isPosted} /></Field>
          <Field label={t('Invoice Date', 'تاريخ الفاتورة')}><Input type="date" value={form.invoiceDate} onChange={e => setForm(f => ({ ...f, invoiceDate: e.target.value }))} disabled={isPosted} /></Field>
          <Field label={t('Purchase Order', 'أمر الشراء')}>
            <Select
              value={form.purchaseOrder}
              disabled={isPosted}
              onChange={(e) => {
                const next = e.target.value
                setForm((f) => ({ ...f, purchaseOrder: next }))
                if (next && !isEdit) applyLinkedDocs(form.shipment, next, { fillVendor: !form.vendor })
              }}
            >
              <option value="">{t('Select PO', 'اختر أمر شراء')}</option>
              {purchaseOrders.map((po) => (
                <option key={po._id} value={po._id}>{po.poNumber}</option>
              ))}
            </Select>
          </Field>
          <Field label={t('Shipment', 'الشحنة')}>
            <Select
              value={form.shipment}
              disabled={isPosted}
              onChange={(e) => {
                const next = e.target.value
                setForm((f) => ({ ...f, shipment: next }))
                if (next) applyLinkedDocs(next, form.purchaseOrder)
              }}
            >
              <option value="">{t('Select inbound shipment', 'اختر شحنة واردة')}</option>
              {shipments.map((s) => (
                <option key={s._id} value={s._id}>{s.shipmentNumber}</option>
              ))}
            </Select>
          </Field>
          <Field label={t('Reference #', 'المرجع')}><Input value={form.referenceNumber} onChange={e => setForm(f => ({ ...f, referenceNumber: e.target.value }))} disabled={isPosted} /></Field>
          <Field label={t('Allocation Method', 'طريقة التوزيع')}>
            <Select value={form.allocationMethod} onChange={e => setForm(f => ({ ...f, allocationMethod: e.target.value }))} disabled={isPosted}>
              <option value="by_value">{t('By Value', 'بالقيمة')}</option>
              <option value="by_weight">{t('By Weight', 'بالوزن')}</option>
              <option value="by_quantity">{t('By Quantity', 'بالكمية')}</option>
              <option value="equal">{t('Equal Split', 'مقسّم بالتساوي')}</option>
            </Select>
          </Field>
        </div>
      </div>

      {/* Cost Lines */}
      <div className="bg-white dark:bg-dark-800 rounded-2xl border border-gray-100 dark:border-dark-700 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 dark:border-dark-700 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 dark:text-white">{t('Cost Lines', 'بنود التكلفة')}</h3>
          {!isPosted && (
            <button onClick={() => setCostLines(l => [...l, emptyCostLine()])} className="flex items-center gap-1.5 text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 font-medium">
              <Plus className="w-4 h-4" /> {t('Add Row', 'إضافة صف')}
            </button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-dark-700/50">
              <tr>
                {[t('Type', 'النوع'), t('Description', 'الوصف'), t('Amount', 'المبلغ'), t('Currency', 'العملة'), t('Rate', 'سعر الصرف'), t('SAR', 'ر.س'), ''].map(h => (
                  <th key={h} className="px-4 py-2 text-start text-xs font-semibold text-gray-500 dark:text-gray-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-dark-700">
              {costLines.map((line, idx) => {
                const sarAmount = (parseFloat(line.amount) || 0) * (parseFloat(line.exchangeRate) || 1)
                return (
                  <tr key={idx}>
                    <td className="px-3 py-2">
                      <Select value={line.type} onChange={e => updateCostLine(idx, 'type', e.target.value)} disabled={isPosted}>
                        {COST_TYPES.map(ct => <option key={ct} value={ct}>{ct.replace(/_/g, ' ')}</option>)}
                      </Select>
                    </td>
                    <td className="px-3 py-2"><Input value={line.description || ''} onChange={e => updateCostLine(idx, 'description', e.target.value)} disabled={isPosted} /></td>
                    <td className="px-3 py-2"><Input type="number" value={line.amount} onChange={e => updateCostLine(idx, 'amount', e.target.value)} disabled={isPosted} /></td>
                    <td className="px-3 py-2">
                      <Select value={line.currency} onChange={e => updateCostLine(idx, 'currency', e.target.value)} disabled={isPosted}>
                        {['SAR', 'USD', 'EUR', 'AED'].map(c => <option key={c}>{c}</option>)}
                      </Select>
                    </td>
                    <td className="px-3 py-2"><Input type="number" step="0.0001" value={line.exchangeRate} onChange={e => updateCostLine(idx, 'exchangeRate', e.target.value)} disabled={isPosted} /></td>
                    <td className="px-3 py-2 font-semibold text-emerald-700 dark:text-emerald-400 text-xs whitespace-nowrap">{sarAmount.toFixed(2)}</td>
                    <td className="px-3 py-2">
                      {!isPosted && <button onClick={() => setCostLines(l => l.filter((_, i) => i !== idx))} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-gray-100 dark:border-dark-700 bg-gray-50 dark:bg-dark-700/30">
                <td colSpan={5} className="px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300 text-end">{t('Total:', 'الإجمالي:')}</td>
                <td className="px-4 py-3 font-bold text-primary-700 dark:text-primary-400">{totalCost.toFixed(2)} SAR</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Allocation Lines */}
      <div className="bg-white dark:bg-dark-800 rounded-2xl border border-gray-100 dark:border-dark-700 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 dark:border-dark-700 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 dark:text-white">{t('Product Allocation', 'توزيع المنتجات')}</h3>
          {!isPosted && (
            <button onClick={() => setAllocations(a => [...a, emptyAllocation()])} className="flex items-center gap-1.5 text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 font-medium">
              <Plus className="w-4 h-4" /> {t('Add Product', 'إضافة منتج')}
            </button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-dark-700/50">
              <tr>
                {[t('Product Name', 'المنتج'), t('Code', 'الكود'), t('Qty', 'الكمية'), t('Unit Cost', 'التكلفة'), t('Weight(kg)', 'الوزن'), t('Line Value', 'قيمة الخط'), t('Allocated', 'المخصص'), t('Unit Landed', 'الوحدة المرساة'), t('Total Unit Cost', 'الإجمالي/وحدة'), ''].map(h => (
                  <th key={h} className="px-3 py-2 text-start text-xs font-semibold text-gray-500 dark:text-gray-400 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-dark-700">
              {allocations.map((alloc, idx) => (
                <tr key={idx}>
                  <td className="px-3 py-2"><Input value={alloc.productName || ''} onChange={e => updateAllocation(idx, 'productName', e.target.value)} disabled={isPosted} /></td>
                  <td className="px-3 py-2"><Input value={alloc.productCode || ''} onChange={e => updateAllocation(idx, 'productCode', e.target.value)} disabled={isPosted} /></td>
                  <td className="px-3 py-2"><Input type="number" value={alloc.quantity || ''} onChange={e => updateAllocation(idx, 'quantity', e.target.value)} disabled={isPosted} /></td>
                  <td className="px-3 py-2"><Input type="number" value={alloc.unitCostBeforeLanded || ''} onChange={e => updateAllocation(idx, 'unitCostBeforeLanded', e.target.value)} disabled={isPosted} /></td>
                  <td className="px-3 py-2"><Input type="number" value={alloc.weight || ''} onChange={e => updateAllocation(idx, 'weight', e.target.value)} disabled={isPosted} /></td>
                  <td className="px-3 py-2"><Input type="number" value={alloc.lineValue || ''} onChange={e => updateAllocation(idx, 'lineValue', e.target.value)} disabled={isPosted} /></td>
                  <td className="px-3 py-2 text-xs font-semibold text-amber-600 dark:text-amber-400">{parseFloat(alloc.allocatedCost || 0).toFixed(2)}</td>
                  <td className="px-3 py-2 text-xs font-semibold text-blue-600 dark:text-blue-400">{parseFloat(alloc.unitLandedCost || 0).toFixed(4)}</td>
                  <td className="px-3 py-2 text-xs font-bold text-emerald-700 dark:text-emerald-400">{parseFloat(alloc.totalLandedUnitCost || 0).toFixed(4)}</td>
                  <td className="px-3 py-2">
                    {!isPosted && <button onClick={() => setAllocations(a => a.filter((_, i) => i !== idx))} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {allocations.length === 0 && (
          <div className="py-8 text-center text-sm text-gray-400 dark:text-gray-500">{t('Add product lines to allocate costs', 'أضف منتجات لتوزيع التكاليف')}</div>
        )}
      </div>

      {/* Notes */}
      <div className="bg-white dark:bg-dark-800 rounded-2xl border border-gray-100 dark:border-dark-700 p-5">
        <Field label={t('Notes', 'ملاحظات')}>
          <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} disabled={isPosted}
            className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-dark-600 bg-white dark:bg-dark-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none disabled:opacity-60" />
        </Field>
      </div>
    </div>
  )
}
