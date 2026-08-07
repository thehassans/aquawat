import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ScanLine, Camera, Plus, Save, PackageCheck, ArrowLeft, Loader2,
  Barcode as BarcodeIcon, Tag, Layers, Boxes, CheckCircle2, AlertTriangle, Edit2,
  X, Sparkles, WifiOff, Upload,
} from 'lucide-react'
import api from '../../lib/api'
import toast from 'react-hot-toast'
import BarcodeScanner from '../../components/ui/BarcodeScanner'
import { useBakalaSync } from '../../hooks/useBakalaSync'
import { savePendingProduct, checkBarcodeExistsOffline, addProductToCache } from '../../lib/bakalaDb'
import { useAutoTranslate } from '../../hooks/useAutoTranslate'
import { v4 as uuidv4 } from 'uuid'

const EMPTY_FORM = {
  name: '', nameAr: '', primaryBarcode: '', category: '', brand: '',
  unit: 'PCS', costPrice: '', retailPrice: '', minimumStockAlertLevel: 10,
  stockQuantity: 0, expiryDate: '', batchNumber: '', isActive: true,
}

export default function BakalaAddProduct() {
  const navigate = useNavigate()
  const { isOnline, pendingProductsCount, syncOfflineData } = useBakalaSync()
  const [form, setForm] = useState(EMPTY_FORM)
  const [categories, setCategories] = useState([])
  const [brands, setBrands] = useState([])
  const [units, setUnits] = useState([])
  const [saving, setSaving] = useState(false)
  const [showScanner, setShowScanner] = useState(false)
  const [checkingBarcode, setCheckingBarcode] = useState(false)
  const [existingProduct, setExistingProduct] = useState(null)
  const [recentlyAdded, setRecentlyAdded] = useState([])
  const [noBarcode, setNoBarcode] = useState(false)
  const [quickAddModal, setQuickAddModal] = useState(null) // { type, label } or null
  const [quickAddValue, setQuickAddValue] = useState('')
  const [quickAddLoading, setQuickAddLoading] = useState(false)
  const [translatingName, setTranslatingName] = useState(false)
  const quickAddInputRef = useRef(null)
  const translateTimerRef = useRef(null)
  const { translate, isTranslating } = useAutoTranslate()

  const barcodeRef = useRef(null)
  const nameRef = useRef(null)
  const retailPriceRef = useRef(null)
  const barcodeTimerRef = useRef(null)
  const checkingRef = useRef(false)

  const update = (patch) => setForm((prev) => ({ ...prev, ...patch }))

  const fetchDropdowns = async () => {
    if (!navigator.onLine) return
    try {
      const [catRes, brandRes, unitRes] = await Promise.all([
        api.get('/bakala-products/categories'),
        api.get('/bakala-products/brands'),
        api.get('/bakala-products/units'),
      ])
      setCategories(catRes.data || [])
      setBrands(brandRes.data || [])
      setUnits(unitRes.data || [])
    } catch {
      // non-fatal
    }
  }

  useEffect(() => {
    fetchDropdowns()
    setTimeout(() => barcodeRef.current?.focus(), 200)
  }, [])

  // Auto-sync when coming back online
  useEffect(() => {
    if (isOnline && pendingProductsCount > 0) {
      syncOfflineData()
    }
  }, [isOnline, pendingProductsCount, syncOfflineData])

  // Clean raw scanner input (some scanners inject whitespace/newlines)
  const cleanBarcode = (raw) => String(raw || '').replace(/[\s\n\r\t]+/g, '').trim()

  // Look up a scanned/typed barcode to detect duplicates
  const lookupBarcode = useCallback(async (raw) => {
    const code = cleanBarcode(raw)
    if (!code) return
    if (checkingRef.current) return
    checkingRef.current = true
    setCheckingBarcode(true)
    setExistingProduct(null)
    update({ primaryBarcode: code })

    // Offline: check IndexedDB only
    if (!navigator.onLine) {
      try {
        const result = await checkBarcodeExistsOffline(code)
        if (result.exists) {
          setExistingProduct(result.product)
          toast.error('This barcode already exists locally.')
        } else {
          setTimeout(() => nameRef.current?.focus(), 50)
        }
      } finally {
        checkingRef.current = false
        setCheckingBarcode(false)
      }
      return
    }

    // Online: check server
    try {
      const res = await api.get(`/bakala-products/barcode/${encodeURIComponent(code)}`)
      if (res.data?.found) {
        setExistingProduct(res.data.product)
        toast.error('This barcode already exists. You can edit it instead.')
      } else {
        // free to use — move focus to name
        setTimeout(() => nameRef.current?.focus(), 50)
      }
    } catch (err) {
      if (err.response?.status === 404) {
        setTimeout(() => nameRef.current?.focus(), 50)
      }
    } finally {
      checkingRef.current = false
      setCheckingBarcode(false)
    }
  }, [update])

  // Debounce barcode lookup while typing/scanning
  const scheduleBarcodeLookup = (raw) => {
    if (barcodeTimerRef.current) clearTimeout(barcodeTimerRef.current)
    const code = cleanBarcode(raw)
    update({ primaryBarcode: code })
    if (!code) return
    barcodeTimerRef.current = setTimeout(() => {
      lookupBarcode(code)
    }, 250)
  }

  const handleScanDetected = (code) => {
    setShowScanner(false)
    setNoBarcode(false)
    const cleaned = cleanBarcode(code)
    update({ primaryBarcode: cleaned })
    lookupBarcode(cleaned)
  }

  const handleBarcodeChange = (e) => {
    const raw = e.target.value || ''
    const cleaned = cleanBarcode(raw)
    // If the scanner injected a newline, it will appear as a single Enter keydown as well.
    // Keep the cleaned value in state so the input always shows the sanitized barcode.
    update({ primaryBarcode: cleaned })
    scheduleBarcodeLookup(cleaned)
  }

  const handleBarcodeKeyDown = (e) => {
    // USB scanners send an Enter at the end of the code
    if (e.key === 'Enter') {
      e.preventDefault()
      if (barcodeTimerRef.current) clearTimeout(barcodeTimerRef.current)
      lookupBarcode(e.currentTarget.value)
    }
  }

  const handleBarcodeBlur = () => {
    if (barcodeTimerRef.current) clearTimeout(barcodeTimerRef.current)
    if (form.primaryBarcode) lookupBarcode(form.primaryBarcode)
  }

  // Quick-add helpers for category / brand / unit
  const openQuickAdd = (type) => {
    const labelMap = { categories: 'Category', brands: 'Brand', units: 'Unit' }
    setQuickAddModal({ type, label: labelMap[type] })
    setQuickAddValue('')
    setTimeout(() => quickAddInputRef.current?.focus(), 50)
  }

  const closeQuickAdd = () => {
    setQuickAddModal(null)
    setQuickAddValue('')
    setQuickAddLoading(false)
  }

  const submitQuickAdd = async (e) => {
    e?.preventDefault?.()
    const name = quickAddValue.trim()
    if (!name || !quickAddModal) return
    const { type, label } = quickAddModal
    setQuickAddLoading(true)
    try {
      const res = await api.post(`/bakala-products/${type}`, { name })
      toast.success(`${label} added`)
      if (type === 'categories') {
        setCategories((p) => [...p, res.data])
        update({ category: res.data.name })
      } else if (type === 'brands') {
        setBrands((p) => [...p, res.data])
        update({ brand: res.data.name })
      } else {
        setUnits((p) => [...p, res.data])
        update({ unit: res.data.name })
      }
      closeQuickAdd()
    } catch (err) {
      toast.error(err.response?.data?.error || `Failed to add ${label}`)
    } finally {
      setQuickAddLoading(false)
    }
  }

  useEffect(() => {
    if (!quickAddModal) return
    const onKey = (e) => {
      if (e.key === 'Escape') closeQuickAdd()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [quickAddModal])

  const resetForNext = () => {
    setForm(EMPTY_FORM)
    setExistingProduct(null)
    setNoBarcode(false)
    setTimeout(() => barcodeRef.current?.focus(), 100)
  }

  const handleSubmit = async (e) => {
    e?.preventDefault?.()
    if (!form.name.trim()) return toast.error('Product name is required')
    if (form.retailPrice === '' || Number(form.retailPrice) <= 0) return toast.error('Retail price is required')
    if (!noBarcode && !form.primaryBarcode.trim()) return toast.error('Scan or enter a barcode, or mark as "no barcode"')

    setSaving(true)
    try {
      let primaryBarcode = noBarcode ? '' : form.primaryBarcode.trim()
      // Auto-generate barcode if none provided
      if (!primaryBarcode) {
        primaryBarcode = `INT${Date.now()}${Math.floor(Math.random() * 100)}`
      }

      const payload = {
        ...form,
        primaryBarcode,
        barcodes: [primaryBarcode],
        costPrice: Number(form.costPrice) || 0,
        retailPrice: Number(form.retailPrice) || 0,
        stockQuantity: Number(form.stockQuantity) || 0,
        minimumStockAlertLevel: Number(form.minimumStockAlertLevel) || 0,
        expiryDate: form.expiryDate || null,
      }

      if (navigator.onLine) {
        // Online: save to server directly
        const res = await api.post('/bakala-products', payload)
        toast.success(`${res.data.name} added`)
        setRecentlyAdded((p) => [res.data, ...p].slice(0, 8))
      } else {
        // Offline: save to IndexedDB pending_products
        const pendingProduct = {
          ...payload,
          pendingId: uuidv4(),
          timestamp: Date.now(),
        }
        await savePendingProduct(pendingProduct)
        // Also add to local cache so it appears in POS immediately
        await addProductToCache(pendingProduct)
        toast.success(`${payload.name} saved offline. Will sync when online.`, {
          icon: '📡',
          duration: 4000,
        })
        setRecentlyAdded((p) => [pendingProduct, ...p].slice(0, 8))
      }
      resetForNext()
    } catch (err) {
      if (err.response?.status === 409) {
        toast.error('A product with this barcode already exists.')
        if (err.response?.data?.product) setExistingProduct(err.response.data.product)
      } else {
        toast.error(err.response?.data?.error || err.message || 'Failed to save product')
      }
    } finally {
      setSaving(false)
    }
  }

  const margin = (() => {
    const c = Number(form.costPrice) || 0
    const r = Number(form.retailPrice) || 0
    if (!r || !c) return null
    return Math.round(((r - c) / r) * 100)
  })()

  // Auto-translate name when one language is entered and the other is empty
  const handleNameChange = (lang, value) => {
    const patch = lang === 'en' ? { name: value } : { nameAr: value }
    update(patch)

    // Debounced auto-translate to the other language
    if (translateTimerRef.current) clearTimeout(translateTimerRef.current)
    if (!value.trim()) return

    const otherKey = lang === 'en' ? 'nameAr' : 'name'
    // Only auto-translate if the other field is empty or was auto-filled before
    if (form[otherKey] && form[otherKey] !== form[lang === 'en' ? 'name' : 'nameAr']) return

    translateTimerRef.current = setTimeout(() => {
      setTranslatingName(true)
      const fromLang = lang === 'en' ? 'en' : 'ar'
      const toLang = lang === 'en' ? 'ar' : 'en'
      const translated = translate(value, fromLang, toLang)
      if (translated) {
        update({ [otherKey]: translated })
      }
      setTranslatingName(false)
    }, 120)
  }

  // Format price to 2 decimals on blur
  const formatPrice = (field) => {
    const num = Number(form[field])
    if (!isNaN(num) && form[field] !== '') {
      update({ [field]: num.toFixed(2) })
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {showScanner && (
        <BarcodeScanner onDetected={handleScanDetected} onClose={() => setShowScanner(false)} />
      )}

      {/* Premium Quick-Add Modal */}
      {quickAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
            onClick={closeQuickAdd}
          />
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl ring-1 ring-black/5 overflow-hidden animate-[slideIn_0.2s_ease-out]">
            <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">New {quickAddModal.label}</h3>
                  <p className="text-emerald-50 text-xs">Create a new {quickAddModal.label.toLowerCase()} instantly</p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeQuickAdd}
                className="p-2 hover:bg-white/20 rounded-xl text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={submitQuickAdd} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  {quickAddModal.label} name
                </label>
                <input
                  ref={quickAddInputRef}
                  type="text"
                  value={quickAddValue}
                  onChange={(e) => setQuickAddValue(e.target.value)}
                  placeholder={`e.g., ${quickAddModal.label === 'Category' ? 'Beverages' : quickAddModal.label === 'Brand' ? 'Coca-Cola' : 'Box'}`}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={closeQuickAdd}
                  className="flex-1 px-4 py-3 border border-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!quickAddValue.trim() || quickAddLoading}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 disabled:opacity-60 transition-colors"
                >
                  {quickAddLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/app/dashboard/bakala/products')} className="p-2 hover:bg-gray-100 rounded-xl">
            <ArrowLeft className="w-5 h-5 text-gray-500" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              Add Product
              {!isOnline && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded-lg">
                  <WifiOff className="w-3 h-3" /> Offline Mode
                </span>
              )}
            </h1>
            <p className="text-gray-500 text-sm">Scan a barcode or add manually. Items are saved instantly so you can keep scanning.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {pendingProductsCount > 0 && (
            <button
              onClick={() => syncOfflineData()}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors"
            >
              <Upload className="w-3.5 h-3.5" />
              {pendingProductsCount} pending sync
            </button>
          )}
          <button
            onClick={() => navigate('/app/dashboard/bakala/products')}
            className="text-sm font-semibold text-gray-500 hover:text-gray-900"
          >
            View all products
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main form */}
        <form onSubmit={handleSubmit} className="lg:col-span-2 space-y-6">
          {/* Barcode scan zone */}
          <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100 rounded-2xl p-5">
            <label className="flex items-center gap-2 text-sm font-bold text-emerald-800 mb-3">
              <BarcodeIcon className="w-4 h-4" /> Barcode
            </label>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-500" />
                <input
                  ref={barcodeRef}
                  type="text"
                  value={form.primaryBarcode}
                  disabled={noBarcode}
                  onChange={handleBarcodeChange}
                  onKeyDown={handleBarcodeKeyDown}
                  onBlur={handleBarcodeBlur}
                  placeholder="Scan with USB scanner or type, then press Enter"
                  className="w-full pl-11 pr-4 py-3 bg-white border border-emerald-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 font-mono disabled:bg-gray-100 disabled:text-gray-400"
                  inputMode="numeric"
                  autoComplete="off"
                />
                {checkingBarcode && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-emerald-500" />}
              </div>
              <button
                type="button"
                onClick={() => setShowScanner(true)}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 font-semibold"
              >
                <Camera className="w-4 h-4" /> Camera
              </button>
            </div>
            <label className="mt-3 flex items-center gap-2 text-sm text-emerald-800 cursor-pointer">
              <input
                type="checkbox"
                checked={noBarcode}
                onChange={(e) => { setNoBarcode(e.target.checked); if (e.target.checked) { update({ primaryBarcode: '' }); setExistingProduct(null) } }}
                className="w-4 h-4 accent-emerald-600"
              />
              This item has no barcode (generate one automatically)
            </label>

            {existingProduct && (
              <div className="mt-3 flex items-center justify-between gap-3 bg-amber-50 border border-amber-200 rounded-xl p-3">
                <div className="flex items-center gap-2 text-sm text-amber-800">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span><b>{existingProduct.name}</b> already uses this barcode.</span>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/app/dashboard/bakala/products')}
                  className="flex items-center gap-1 text-xs font-bold text-amber-700 hover:text-amber-900 whitespace-nowrap"
                >
                  <Edit2 className="w-3 h-3" /> Edit it
                </button>
              </div>
            )}
          </div>

          {/* Details */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name (English) *</label>
                <input ref={nameRef} type="text" value={form.name} onChange={(e) => handleNameChange('en', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none" />
              </div>
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
                  Name (Arabic)
                  {translatingName && <span className="text-xs text-emerald-600 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Translating...</span>}
                </label>
                <input type="text" dir="rtl" value={form.nameAr} onChange={(e) => handleNameChange('ar', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-right" />
              </div>

              <div>
                <label className="flex items-center justify-between text-sm font-medium text-gray-700 mb-1">
                  <span className="flex items-center gap-1"><Tag className="w-3.5 h-3.5" /> Category</span>
                  <button type="button" onClick={() => openQuickAdd('categories')} className="text-xs text-emerald-600 hover:text-emerald-700 font-semibold flex items-center gap-0.5"><Plus className="w-3 h-3" /> New</button>
                </label>
                <select value={form.category} onChange={(e) => update({ category: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none">
                  <option value="">None</option>
                  {categories.map((c) => <option key={c._id} value={c.name}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="flex items-center justify-between text-sm font-medium text-gray-700 mb-1">
                  <span className="flex items-center gap-1"><Layers className="w-3.5 h-3.5" /> Brand</span>
                  <button type="button" onClick={() => openQuickAdd('brands')} className="text-xs text-emerald-600 hover:text-emerald-700 font-semibold flex items-center gap-0.5"><Plus className="w-3 h-3" /> New</button>
                </label>
                <select value={form.brand} onChange={(e) => update({ brand: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none">
                  <option value="">None</option>
                  {brands.map((b) => <option key={b._id} value={b.name}>{b.name}</option>)}
                </select>
              </div>

              <div>
                <label className="flex items-center justify-between text-sm font-medium text-gray-700 mb-1">
                  <span className="flex items-center gap-1"><Boxes className="w-3.5 h-3.5" /> Unit</span>
                  <button type="button" onClick={() => openQuickAdd('units')} className="text-xs text-emerald-600 hover:text-emerald-700 font-semibold flex items-center gap-0.5"><Plus className="w-3 h-3" /> New</button>
                </label>
                <select value={form.unit} onChange={(e) => update({ unit: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none">
                  <option value="PCS">PCS</option>
                  {units.map((u) => <option key={u._id} value={u.name}>{u.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Opening Stock Qty</label>
                <input type="number" value={form.stockQuantity} onChange={(e) => update({ stockQuantity: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cost Price (SAR)</label>
                <input type="number" step="0.01" min="0" value={form.costPrice} onChange={(e) => update({ costPrice: e.target.value })} onBlur={() => formatPrice('costPrice')} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none" />
              </div>
              <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-4">
                <label className="block text-sm font-bold text-emerald-900 mb-1">Selling Price (SAR) *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-700 font-bold">SAR</span>
                  <input ref={retailPriceRef} type="number" step="0.01" min="0" value={form.retailPrice} onChange={(e) => update({ retailPrice: e.target.value })} onBlur={() => formatPrice('retailPrice')} className="w-full pl-12 pr-3 py-2.5 border border-emerald-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-emerald-900" />
                </div>
                {margin != null && <p className="text-xs text-gray-500 mt-2">Margin: <span className={margin < 0 ? 'text-red-500' : 'text-emerald-600'}>{margin}%</span></p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Min. Stock Alert Level</label>
                <input type="number" min="0" value={form.minimumStockAlertLevel} onChange={(e) => update({ minimumStockAlertLevel: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Expiry Date</label>
                  <input type="date" value={form.expiryDate} onChange={(e) => update({ expiryDate: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Batch No.</label>
                  <input type="text" value={form.batchNumber} onChange={(e) => update({ batchNumber: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none" />
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-100">
              <button type="button" onClick={resetForNext} className="px-4 py-2.5 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 font-semibold">Clear</button>
              <button type="submit" disabled={saving} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 font-bold disabled:opacity-60">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save & Add Another
              </button>
            </div>
          </div>
        </form>

        {/* Recently added sidebar */}
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-2xl p-5">
            <h3 className="font-bold text-gray-900 flex items-center gap-2 mb-3">
              <PackageCheck className="w-5 h-5 text-emerald-600" /> Added this session
              <span className="ml-auto text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">{recentlyAdded.length}</span>
            </h3>
            {recentlyAdded.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <Boxes className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Products you add will appear here.</p>
              </div>
            ) : (
              <ul className="space-y-2 max-h-[460px] overflow-y-auto">
                {recentlyAdded.map((p) => (
                  <li key={p._id} className="flex items-center gap-3 p-2 rounded-xl bg-gray-50">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-900 truncate">{p.name}</p>
                      <p className="text-xs text-gray-400 font-mono truncate">{p.primaryBarcode}</p>
                    </div>
                    <span className="text-xs font-bold text-gray-700">SAR {Number(p.retailPrice).toFixed(2)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="bg-gray-900 text-white rounded-2xl p-5">
            <h4 className="font-bold mb-2 flex items-center gap-2"><ScanLine className="w-4 h-4" /> Fast entry tips</h4>
            <ul className="text-sm text-white/70 space-y-1.5 list-disc list-inside">
              <li>Focus the barcode box and scan with a USB scanner — it auto-fills.</li>
              <li>No scanner? Tap <b>Camera</b> to scan with your device.</li>
              <li>Existing barcodes are detected to prevent duplicates.</li>
              <li>After saving, the form resets so you can scan the next item.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
