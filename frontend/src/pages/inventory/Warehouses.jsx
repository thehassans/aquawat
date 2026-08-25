import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, Warehouse as WarehouseIcon, MapPin, Package, AlertCircle, X,
  ChevronRight, Loader2, Box, Info, ArrowRightLeft, SlidersHorizontal,
  PackagePlus, TrendingUp, CheckCircle, Search
} from 'lucide-react'
import api from '../../lib/api'
import { useTranslation } from '../../lib/translations'
import ExportMenu from '../../components/ui/ExportMenu'
import Money from '../../components/ui/Money'
import toast from 'react-hot-toast'

// ─── Transfer Modal ────────────────────────────────────────────────────────────
function TransferModal({ warehouse, warehouses, onClose, language }) {
  const isAr = language === 'ar'
  const [destWarehouse, setDestWarehouse] = useState('')
  const [search, setSearch] = useState('')
  const [lines, setLines] = useState([{ productName: '', quantity: 1 }])
  const [isLoading, setIsLoading] = useState(false)
  const qc = useQueryClient()

  const { data: products } = useQuery({
    queryKey: ['products-search', search],
    queryFn: () => api.get('/products', { params: { search, limit: 20 } }).then(r => r.data?.products || r.data || []),
    enabled: search.length > 1
  })

  const addLine = () => setLines(l => [...l, { productId: '', productName: '', quantity: 1 }])
  const removeLine = (i) => setLines(l => l.filter((_, idx) => idx !== i))
  const updateLine = (i, field, value) => setLines(l => l.map((ln, idx) => idx === i ? { ...ln, [field]: value } : ln))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!destWarehouse) return toast.error(isAr ? 'اختر المستودع المستلم' : 'Select destination warehouse')
    const validLines = lines.filter(l => l.productId && l.quantity > 0)
    if (!validLines.length) return toast.error(isAr ? 'أضف منتجاً واحداً على الأقل' : 'Add at least one product')
    setIsLoading(true)
    try {
      await api.post('/stock-transfers', {
        sourceWarehouseId: warehouse._id,
        destinationWarehouseId: destWarehouse,
        lines: validLines
      })
      toast.success(isAr ? 'تم نقل المخزون بنجاح' : 'Stock transfer initiated!')
      qc.invalidateQueries(['warehouses-stock-stats'])
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.error || (isAr ? 'حدث خطأ' : 'Transfer failed'))
    } finally {
      setIsLoading(false)
    }
  }

  const otherWarehouses = (warehouses || []).filter(w => w._id !== warehouse._id)

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-white/10"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-xl"><ArrowRightLeft className="h-5 w-5" /></div>
              <div>
                <h3 className="text-lg font-bold">{isAr ? 'نقل مخزون' : 'Transfer Stock'}</h3>
                <p className="text-blue-100 text-xs mt-0.5">{isAr ? 'من:' : 'From:'} {language === 'ar' ? warehouse.nameAr || warehouse.nameEn : warehouse.nameEn}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 hover:bg-white/20 rounded-xl transition-colors"><X className="h-5 w-5" /></button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Destination */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">{isAr ? 'المستودع المستلم' : 'Destination Warehouse'}</label>
            <select
              value={destWarehouse}
              onChange={e => setDestWarehouse(e.target.value)}
              required
              className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800 px-3 py-2.5 text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">{isAr ? '-- اختر مستودعاً --' : '-- Select warehouse --'}</option>
              {otherWarehouses.map(w => (
                <option key={w._id} value={w._id}>{language === 'ar' ? w.nameAr || w.nameEn : w.nameEn}</option>
              ))}
            </select>
          </div>

          {/* Lines */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-500">{isAr ? 'المنتجات' : 'Products'}</label>
              <button type="button" onClick={addLine} className="text-xs text-blue-600 font-semibold hover:text-blue-700">+ {isAr ? 'إضافة' : 'Add'}</button>
            </div>
            <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
              {lines.map((ln, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input
                    type="text"
                    placeholder={isAr ? 'ابحث عن منتج...' : 'Search product...'}
                    value={ln.productName}
                    onChange={e => { updateLine(i, 'productName', e.target.value); setSearch(e.target.value) }}
                    className="flex-1 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    list={`products-list-${i}`}
                  />
                  <datalist id={`products-list-${i}`}>
                    {(products || []).map(p => (
                      <option
                        key={p._id}
                        value={language === 'ar' ? p.nameAr || p.nameEn : p.nameEn}
                        onClick={() => updateLine(i, 'productId', p._id)}
                      />
                    ))}
                  </datalist>
                  <input
                    type="number"
                    min={1}
                    value={ln.quantity}
                    onChange={e => updateLine(i, 'quantity', Number(e.target.value))}
                    className="w-20 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {lines.length > 1 && (
                    <button type="button" onClick={() => removeLine(i)} className="p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"><X className="h-4 w-4" /></button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl border border-slate-200 dark:border-white/10 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
              {isAr ? 'إلغاء' : 'Cancel'}
            </button>
            <button type="submit" disabled={isLoading} className="flex-1 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center justify-center gap-2">
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRightLeft className="h-4 w-4" />}
              {isAr ? 'نقل المخزون' : 'Transfer Stock'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

// ─── Adjust Modal ──────────────────────────────────────────────────────────────
function AdjustModal({ warehouse, onClose, language }) {
  const isAr = language === 'ar'
  const [reason, setReason] = useState('Damage')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState([{ productName: '', productId: '', actualQuantity: 0, difference: 0 }])
  const [isLoading, setIsLoading] = useState(false)
  const qc = useQueryClient()

  const reasons = ['Damage', 'Shrinkage', 'Found', 'Manual Correction', 'Expiry']

  const addLine = () => setLines(l => [...l, { productName: '', productId: '', actualQuantity: 0, difference: 0 }])
  const removeLine = (i) => setLines(l => l.filter((_, idx) => idx !== i))
  const updateLine = (i, field, value) => setLines(l => l.map((ln, idx) => idx === i ? { ...ln, [field]: value } : ln))

  const handleSubmit = async (e) => {
    e.preventDefault()
    const validLines = lines.filter(l => l.productId)
    if (!validLines.length) return toast.error(isAr ? 'أضف منتجاً واحداً على الأقل' : 'Add at least one product')
    setIsLoading(true)
    try {
      await api.post('/inventory-adjustments', {
        reason,
        notes,
        warehouseId: warehouse._id,
        lines: validLines,
      })
      toast.success(isAr ? 'تم تعديل المخزون بنجاح' : 'Stock adjusted!')
      qc.invalidateQueries(['warehouses-stock-stats'])
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.error || (isAr ? 'حدث خطأ' : 'Adjustment failed'))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-white/10"
      >
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-xl"><SlidersHorizontal className="h-5 w-5" /></div>
              <div>
                <h3 className="text-lg font-bold">{isAr ? 'تعديل المخزون' : 'Adjust Stock'}</h3>
                <p className="text-amber-100 text-xs mt-0.5">{language === 'ar' ? warehouse.nameAr || warehouse.nameEn : warehouse.nameEn}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 hover:bg-white/20 rounded-xl transition-colors"><X className="h-5 w-5" /></button>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">{isAr ? 'السبب' : 'Reason'}</label>
              <select value={reason} onChange={e => setReason(e.target.value)} className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500">
                {reasons.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">{isAr ? 'ملاحظات' : 'Notes'}</label>
              <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder={isAr ? 'اختياري' : 'Optional...'} className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-500">{isAr ? 'الأصناف' : 'Items'}</label>
              <button type="button" onClick={addLine} className="text-xs text-amber-600 font-semibold hover:text-amber-700">+ {isAr ? 'إضافة' : 'Add'}</button>
            </div>
            <div className="grid grid-cols-3 gap-1 mb-1 px-1">
              <span className="text-[11px] font-semibold text-slate-400">{isAr ? 'المنتج' : 'Product'}</span>
              <span className="text-[11px] font-semibold text-slate-400 text-center">{isAr ? 'الكمية الفعلية' : 'Actual Qty'}</span>
              <span className="text-[11px] font-semibold text-slate-400 text-center">{isAr ? 'الفرق' : 'Difference'}</span>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {lines.map((ln, i) => (
                <div key={i} className="grid grid-cols-3 gap-2 items-center">
                  <input type="text" placeholder={isAr ? 'اسم المنتج' : 'Product name'} value={ln.productName} onChange={e => updateLine(i, 'productName', e.target.value)} className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" />
                  <input type="number" placeholder="0" value={ln.actualQuantity} onChange={e => updateLine(i, 'actualQuantity', Number(e.target.value))} className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-amber-500" />
                  <div className="flex items-center gap-1">
                    <input type="number" placeholder="0" value={ln.difference} onChange={e => updateLine(i, 'difference', Number(e.target.value))} className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-amber-500" />
                    {lines.length > 1 && <button type="button" onClick={() => removeLine(i)} className="p-1 text-rose-400 hover:text-rose-600 rounded-lg"><X className="h-3.5 w-3.5" /></button>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl border border-slate-200 dark:border-white/10 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">{isAr ? 'إلغاء' : 'Cancel'}</button>
            <button type="submit" disabled={isLoading} className="flex-1 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center justify-center gap-2">
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
              {isAr ? 'تعديل المخزون' : 'Adjust Stock'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

// ─── Receive Modal ─────────────────────────────────────────────────────────────
function ReceiveModal({ warehouse, onClose, language }) {
  const isAr = language === 'ar'
  const [lines, setLines] = useState([{ productName: '', productId: '', quantity: 1, unitCost: 0 }])
  const [notes, setNotes] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const qc = useQueryClient()

  const addLine = () => setLines(l => [...l, { productName: '', productId: '', quantity: 1, unitCost: 0 }])
  const removeLine = (i) => setLines(l => l.filter((_, idx) => idx !== i))
  const updateLine = (i, field, value) => setLines(l => l.map((ln, idx) => idx === i ? { ...ln, [field]: value } : ln))

  const handleSubmit = async (e) => {
    e.preventDefault()
    const validLines = lines.filter(l => l.productName && l.quantity > 0)
    if (!validLines.length) return toast.error(isAr ? 'أضف منتجاً واحداً على الأقل' : 'Add at least one product')
    setIsLoading(true)
    try {
      await api.post('/inventory-adjustments', {
        reason: 'Manual Correction',
        notes: notes || `Direct receive into ${language === 'ar' ? warehouse.nameAr || warehouse.nameEn : warehouse.nameEn}`,
        warehouseId: warehouse._id,
        lines: validLines.map(l => ({ ...l, difference: l.quantity })),
      })
      toast.success(isAr ? 'تم استلام المخزون بنجاح' : 'Stock received successfully!')
      qc.invalidateQueries(['warehouses-stock-stats'])
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.error || (isAr ? 'حدث خطأ' : 'Receive failed'))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-white/10"
      >
        <div className="bg-gradient-to-r from-emerald-500 to-teal-600 p-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-xl"><PackagePlus className="h-5 w-5" /></div>
              <div>
                <h3 className="text-lg font-bold">{isAr ? 'استلام مخزون' : 'Receive Stock'}</h3>
                <p className="text-emerald-100 text-xs mt-0.5">{isAr ? 'إلى:' : 'Into:'} {language === 'ar' ? warehouse.nameAr || warehouse.nameEn : warehouse.nameEn}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 hover:bg-white/20 rounded-xl transition-colors"><X className="h-5 w-5" /></button>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">{isAr ? 'ملاحظات' : 'Notes'}</label>
            <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder={isAr ? 'مصدر الاستلام...' : 'Source / notes...'} className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-500">{isAr ? 'الأصناف المستلمة' : 'Received Items'}</label>
              <button type="button" onClick={addLine} className="text-xs text-emerald-600 font-semibold hover:text-emerald-700">+ {isAr ? 'إضافة' : 'Add'}</button>
            </div>
            <div className="grid grid-cols-3 gap-1 mb-1 px-1">
              <span className="text-[11px] font-semibold text-slate-400">{isAr ? 'المنتج' : 'Product'}</span>
              <span className="text-[11px] font-semibold text-slate-400 text-center">{isAr ? 'الكمية' : 'Qty'}</span>
              <span className="text-[11px] font-semibold text-slate-400 text-center">{isAr ? 'تكلفة الوحدة' : 'Unit Cost'}</span>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {lines.map((ln, i) => (
                <div key={i} className="grid grid-cols-3 gap-2 items-center">
                  <input type="text" placeholder={isAr ? 'اسم المنتج' : 'Product name'} value={ln.productName} onChange={e => updateLine(i, 'productName', e.target.value)} className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                  <input type="number" min={1} value={ln.quantity} onChange={e => updateLine(i, 'quantity', Number(e.target.value))} className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                  <div className="flex items-center gap-1">
                    <input type="number" min={0} step="0.01" value={ln.unitCost} onChange={e => updateLine(i, 'unitCost', Number(e.target.value))} className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                    {lines.length > 1 && <button type="button" onClick={() => removeLine(i)} className="p-1 text-rose-400 hover:text-rose-600 rounded-lg"><X className="h-3.5 w-3.5" /></button>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl border border-slate-200 dark:border-white/10 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">{isAr ? 'إلغاء' : 'Cancel'}</button>
            <button type="submit" disabled={isLoading} className="flex-1 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center justify-center gap-2">
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackagePlus className="h-4 w-4" />}
              {isAr ? 'استلام المخزون' : 'Receive Stock'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

// ─── Main Warehouses Component ─────────────────────────────────────────────────
export default function Warehouses() {
  const { language } = useSelector((state) => state.ui)
  const { t } = useTranslation(language)
  const navigate = useNavigate()
  const isRtl = language === 'ar'

  const [activeModal, setActiveModal] = useState(null) // { type: 'transfer'|'adjust'|'receive', warehouse }

  const exportColumns = [
    { key: 'code', label: language === 'ar' ? 'الرمز' : 'Code', value: (r) => r?.code || '' },
    { key: 'name', label: language === 'ar' ? 'الاسم' : 'Name', value: (r) => (language === 'ar' ? r?.nameAr || r?.nameEn : r?.nameEn || r?.nameAr) || '' },
    { key: 'type', label: language === 'ar' ? 'النوع' : 'Type', value: (r) => r?.type || '' },
    { key: 'city', label: language === 'ar' ? 'المدينة' : 'City', value: (r) => r?.address?.city || '' },
  ]

  const { data: warehouses, isLoading: loadingWarehouses } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => api.get('/warehouses').then(res => res.data)
  })

  const { data: stockStats } = useQuery({
    queryKey: ['warehouses-stock-stats'],
    queryFn: () => api.get('/warehouses/stock-summary/stats').then(res => res.data)
  })

  const statsMap = (stockStats || []).reduce((acc, curr) => {
    acc[curr._id] = curr
    return acc
  }, {})

  const containerVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.1 } }
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
  }

  const openModal = (type, warehouse, e) => {
    e.stopPropagation()
    setActiveModal({ type, warehouse })
  }

  return (
    <div className="space-y-8 min-h-screen pb-12">
      {/* ── Light-Themed Premium Header ────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl bg-white border border-slate-200 shadow-sm p-8">
        {/* Subtle decorative blobs */}
        <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-blue-100/80 blur-3xl pointer-events-none" />
        <div className="absolute -left-16 -bottom-16 h-56 w-56 rounded-full bg-indigo-100/80 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
          <div>
            <motion.div initial={{ opacity: 0, x: isRtl ? 20 : -20 }} animate={{ opacity: 1, x: 0 }}>
              <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 border border-blue-100 px-3 py-1 mb-3">
                <WarehouseIcon className="h-3.5 w-3.5 text-blue-600" />
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-600">
                  {language === 'ar' ? 'المخزون' : 'Inventory'}
                </p>
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                {t('warehouses')}
              </h1>
              <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-slate-500">
                {language === 'ar' ? 'تتبع المخزون وتحليل الأداء عبر جميع مواقعك في لوحة تحكم واحدة.' : 'Manage facilities, track stock, and analyze performance across all your locations in one premium dashboard.'}
              </p>
            </motion.div>
          </div>
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-wrap items-center gap-3">
            <ExportMenu
              language={language}
              t={t}
              rows={warehouses || []}
              columns={exportColumns}
              fileBaseName={language === 'ar' ? 'المستودعات' : 'Warehouses'}
              title={language === 'ar' ? 'المستودعات' : 'Warehouses'}
              disabled={loadingWarehouses || !(warehouses || []).length}
            />
            <Link
              to="/app/dashboard/warehouses/new"
              className="group relative inline-flex items-center gap-2 overflow-hidden rounded-xl bg-slate-900 px-5 py-2.5 text-[14px] font-semibold text-white transition-all hover:bg-slate-800 hover:shadow-lg active:scale-95"
            >
              <Plus className="relative h-4 w-4 transition-transform group-hover:rotate-90" />
              <span className="relative">{language === 'ar' ? 'إضافة مستودع' : 'Add Warehouse'}</span>
            </Link>
          </motion.div>
        </div>
      </div>

      {/* ── Content ───────────────────────────────────────────────────── */}
      {loadingWarehouses ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
        </div>
      ) : (warehouses || []).length === 0 ? (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-white p-20 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-slate-100">
            <WarehouseIcon className="h-10 w-10 text-slate-400" />
          </div>
          <p className="mt-6 text-xl font-bold text-slate-900">{language === 'ar' ? 'لا توجد مستودعات' : 'No warehouses found'}</p>
          <p className="mt-2 max-w-sm text-[14px] text-slate-500">{language === 'ar' ? 'أضف مستودعك الأول للبدء في تتبع المخزون.' : 'Add your first warehouse to start tracking inventory.'}</p>
          <Link to="/app/dashboard/warehouses/new" className="mt-8 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-[14px] font-medium text-white shadow-lg shadow-blue-600/20 transition-all hover:bg-blue-700">
            <Plus className="h-5 w-5" />
            {language === 'ar' ? 'إضافة مستودع' : 'Add Warehouse'}
          </Link>
        </motion.div>
      ) : (
        <motion.div variants={containerVariants} initial="hidden" animate="show" className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
          {warehouses.map((warehouse) => {
            const stats = statsMap[warehouse._id] || { totalSKUs: 0, totalQuantity: 0, totalValue: 0 }
            const capacity = warehouse.capacity?.totalSpace || 0
            const used = stats.totalQuantity || 0
            const usagePercent = capacity > 0 ? Math.min(100, Math.round((used / capacity) * 100)) : 0

            return (
              <motion.div
                variants={itemVariants}
                whileHover={{ y: -4 }}
                key={warehouse._id}
                className="group relative flex flex-col overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white p-1 shadow-[0_4px_20px_rgb(0,0,0,0.06)] hover:shadow-[0_8px_40px_rgb(0,0,0,0.10)] transition-all"
              >
                {/* Hover gradient */}
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-purple-500/5 opacity-0 transition-opacity duration-500 group-hover:opacity-100 rounded-[2rem]" />

                <div className="relative h-full rounded-[1.85rem] bg-white p-6 flex flex-col">
                  {/* Card Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`relative flex h-14 w-14 items-center justify-center rounded-2xl shadow-sm ${warehouse.isPrimary ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                        <WarehouseIcon className="h-7 w-7" />
                        {warehouse.isPrimary && (
                          <div className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-blue-400 ring-2 ring-white">
                            <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
                          </div>
                        )}
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-slate-900">
                          {language === 'ar' ? warehouse.nameAr || warehouse.nameEn : warehouse.nameEn}
                        </h3>
                        <div className="mt-1 flex items-center gap-2">
                          <span className="flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-semibold text-slate-600">
                            <MapPin className="h-3 w-3" />
                            {warehouse.code}
                          </span>
                          {warehouse.isPrimary && (
                            <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-bold tracking-wider text-blue-600">
                              {language === 'ar' ? 'رئيسي' : 'PRIMARY'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Stats Grid */}
                  <div className="mt-6 grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 transition-colors group-hover:bg-blue-50/50">
                      <div className="flex items-center gap-2 text-[12px] font-medium text-slate-500">
                        <Box className="h-4 w-4 text-blue-500" />
                        {language === 'ar' ? 'إجمالي الأصناف' : 'Total SKUs'}
                      </div>
                      <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900">{stats.totalSKUs.toLocaleString()}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 transition-colors group-hover:bg-indigo-50/50">
                      <div className="flex items-center gap-2 text-[12px] font-medium text-slate-500">
                        <TrendingUp className="h-4 w-4 text-indigo-500" />
                        {language === 'ar' ? 'قيمة المخزون' : 'Stock Value'}
                      </div>
                      <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900"><Money value={stats.totalValue} /></p>
                    </div>
                  </div>

                  {/* Capacity Bar */}
                  {capacity > 0 && (
                    <div className="mt-4 rounded-2xl border border-slate-100 p-4">
                      <div className="flex items-center justify-between text-[12px] font-semibold">
                        <span className="text-slate-600">{language === 'ar' ? 'سعة المستودع' : 'Warehouse Capacity'}</span>
                        <span className={usagePercent > 90 ? 'text-rose-600' : 'text-slate-900'}>{usagePercent}%</span>
                      </div>
                      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${usagePercent}%` }}
                          transition={{ duration: 1, ease: 'easeOut' }}
                          className={`h-full rounded-full ${usagePercent > 90 ? 'bg-gradient-to-r from-rose-500 to-rose-400' : usagePercent > 70 ? 'bg-gradient-to-r from-amber-500 to-amber-400' : 'bg-gradient-to-r from-emerald-500 to-emerald-400'}`}
                        />
                      </div>
                      <div className="mt-2 text-[11px] text-slate-400">{used.toLocaleString()} / {capacity.toLocaleString()} {warehouse.capacity.unit}</div>
                    </div>
                  )}

                  <div className="flex-1" />

                  {/* Action Buttons — Transfer / Adjust / Receive */}
                  <div className="mt-6 grid grid-cols-3 gap-2">
                    <motion.button
                      whileHover={{ scale: 1.04 }}
                      whileTap={{ scale: 0.96 }}
                      onClick={(e) => openModal('transfer', warehouse, e)}
                      className="group/btn flex flex-col items-center gap-1.5 rounded-2xl bg-blue-50 border border-blue-100 py-3 px-2 text-[11px] font-semibold text-blue-700 transition-all hover:bg-blue-100 hover:shadow-md hover:shadow-blue-100 active:scale-95"
                    >
                      <div className="p-1.5 bg-blue-100 group-hover/btn:bg-blue-200 rounded-xl transition-colors">
                        <ArrowRightLeft className="h-4 w-4" />
                      </div>
                      {language === 'ar' ? 'نقل' : 'Transfer'}
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.04 }}
                      whileTap={{ scale: 0.96 }}
                      onClick={(e) => openModal('adjust', warehouse, e)}
                      className="group/btn flex flex-col items-center gap-1.5 rounded-2xl bg-amber-50 border border-amber-100 py-3 px-2 text-[11px] font-semibold text-amber-700 transition-all hover:bg-amber-100 hover:shadow-md hover:shadow-amber-100 active:scale-95"
                    >
                      <div className="p-1.5 bg-amber-100 group-hover/btn:bg-amber-200 rounded-xl transition-colors">
                        <SlidersHorizontal className="h-4 w-4" />
                      </div>
                      {language === 'ar' ? 'تعديل' : 'Adjust'}
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.04 }}
                      whileTap={{ scale: 0.96 }}
                      onClick={(e) => openModal('receive', warehouse, e)}
                      className="group/btn flex flex-col items-center gap-1.5 rounded-2xl bg-emerald-50 border border-emerald-100 py-3 px-2 text-[11px] font-semibold text-emerald-700 transition-all hover:bg-emerald-100 hover:shadow-md hover:shadow-emerald-100 active:scale-95"
                    >
                      <div className="p-1.5 bg-emerald-100 group-hover/btn:bg-emerald-200 rounded-xl transition-colors">
                        <PackagePlus className="h-4 w-4" />
                      </div>
                      {language === 'ar' ? 'استلام' : 'Receive'}
                    </motion.button>
                  </div>

                  {/* View Details */}
                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <motion.button
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      onClick={() => navigate(`/app/dashboard/warehouses/${warehouse._id}`)}
                      className="group/btn flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-3 text-[13px] font-semibold text-white shadow-sm transition-all hover:bg-slate-800 hover:shadow-md active:scale-95"
                    >
                      {language === 'ar' ? 'عرض التفاصيل' : 'View Details'}
                      <ChevronRight className={`h-4 w-4 transition-transform ${isRtl ? 'rotate-180 group-hover/btn:-translate-x-1' : 'group-hover/btn:translate-x-1'}`} />
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </motion.div>
      )}

      {/* ── Modals ─────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {activeModal?.type === 'transfer' && (
          <TransferModal warehouse={activeModal.warehouse} warehouses={warehouses} onClose={() => setActiveModal(null)} language={language} />
        )}
        {activeModal?.type === 'adjust' && (
          <AdjustModal warehouse={activeModal.warehouse} onClose={() => setActiveModal(null)} language={language} />
        )}
        {activeModal?.type === 'receive' && (
          <ReceiveModal warehouse={activeModal.warehouse} onClose={() => setActiveModal(null)} language={language} />
        )}
      </AnimatePresence>
    </div>
  )
}
