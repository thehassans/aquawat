import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { useSelector } from 'react-redux'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Plus, Search, Package, AlertTriangle, Eye, Edit, QrCode, Boxes, Warehouse, CircleOff, Printer, Download } from 'lucide-react'
import api from '../../lib/api'
import { useTranslation } from '../../lib/translations'
import Money from '../../components/ui/Money'
import { buildDefaultFileName, exportToCsv } from '../../lib/export'
import { InventoryIeButtons } from '../../components/inventory/ImportExportDialog'
import ResponsiveDataList from '../../components/ui/ResponsiveDataList'
import { getUomLabel } from '../../lib/uomOptions'
import { formatProductTypeLabel, isStockTrackedProductType, normalizeProductType, productTypeBadgeClass } from '../../lib/productType'
import { formatInvError } from '../../lib/invError'
import { invTableWrapClass, invTableClass } from './inventoryUi'
import { ColumnChooser, useColumnVisibility } from './columnVisibility'
import PrintBarcodeLabelsModal from './PrintBarcodeLabelsModal'

const OUTLINED_BTN =
  'inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50 dark:border-dark-600 dark:bg-dark-800 dark:text-slate-200'

const PRODUCT_COL_DEFS = [
  { id: 'name', labelEn: 'Product', labelAr: 'المنتج', locked: true },
  { id: 'productId', labelEn: 'ID', labelAr: 'المعرّف', defaultVisible: true },
  { id: 'sku', labelEn: 'SKU', labelAr: 'SKU', defaultVisible: true },
  { id: 'type', labelEn: 'Type', labelAr: 'النوع', defaultVisible: true },
  { id: 'uom', labelEn: 'UOM', labelAr: 'الوحدة', defaultVisible: true },
  { id: 'available', labelEn: 'Available', labelAr: 'المتاح', defaultVisible: true },
  { id: 'reorder', labelEn: 'Reorder', labelAr: 'حد الطلب', defaultVisible: true },
  { id: 'sellingPrice', labelEn: 'Selling price', labelAr: 'سعر البيع', defaultVisible: true },
  { id: 'stock', labelEn: 'Stock', labelAr: 'المخزون', defaultVisible: true },
  { id: 'actions', labelEn: 'Actions', labelAr: 'إجراءات', locked: true },
]


const healthMeta = {
  in_stock: { en: 'In stock', ar: 'متوفر', className: 'bg-emerald-50 text-emerald-800' },
  low_stock: { en: 'Low', ar: 'منخفض', className: 'bg-amber-50 text-amber-800' },
  out_of_stock: { en: 'Out', ar: 'نفد', className: 'bg-rose-50 text-rose-800' },
  backorder: { en: 'Backorder', ar: 'طلب مفتوح', className: 'bg-violet-50 text-violet-800' },
  not_tracked: { en: 'Service', ar: 'خدمة', className: 'bg-sky-50 text-sky-800' },
}

function qtyClass(health) {
  if (health === 'out_of_stock') return 'text-rose-600'
  if (health === 'low_stock') return 'text-amber-700'
  if (health === 'backorder') return 'text-violet-700'
  return 'text-slate-900 dark:text-white'
}

export default function Products() {
  const { language } = useSelector((state) => state.ui)
  const { t } = useTranslation(language)
  const isAr = language === 'ar'
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const categoryIdFromUrl = searchParams.get('categoryId') || ''
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [filters, setFilters] = useState({ status: '', stockHealth: '', productType: '', categoryId: '' })
  const [page, setPage] = useState(1)

  const goToVariantStock = (product) => {
    if (!product?._id) return
    navigate(`/app/dashboard/inventory/variants?productId=${product._id}`)
  }

  useEffect(() => {
    if (categoryIdFromUrl) {
      setFilters((f) => ({ ...f, categoryId: categoryIdFromUrl }))
      setPage(1)
    }
  }, [categoryIdFromUrl])

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(handle)
  }, [search])

  const queryClient = useQueryClient()
  const [stockModal, setStockModal] = useState({ isOpen: false, productId: null, productName: '' })
  const [stockWarehouseId, setStockWarehouseId] = useState('')
  const [stockQuantity, setStockQuantity] = useState(1)
  const [selected, setSelected] = useState(() => new Set())
  const [labelModalOpen, setLabelModalOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const masterCheckboxRef = useRef(null)

  const columnDefs = useMemo(() => PRODUCT_COL_DEFS, [])
  const { visible, toggle } = useColumnVisibility('maqder-inv-product-cols', columnDefs)
  const col = (id) => visible[id] !== false

  const { data: warehouses } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => api.get('/warehouses').then((res) => res.data)
  })
  const warehouseOptions = Array.isArray(warehouses) ? warehouses : []

  const { data: engineStatus } = useQuery({
    queryKey: ['stock-engine-status'],
    queryFn: () => api.get('/stock/engine-status').then((r) => r.data),
    staleTime: 60_000,
  })
  const engineOn = Boolean(engineStatus?.engineEnabled)

  const addStockMutation = useMutation({
    mutationFn: async (data) => {
      const qty = Number(data.quantity)
      if (engineOn) {
        const current = await api
          .get(`/stock/products/${data.productId}/on-hand`, {
            params: { warehouseId: data.warehouseId },
          })
          .then((r) => Number(r.data?.onHand || 0))
        return api.post(`/stock/report/stock/${data.productId}/adjust`, {
          warehouseId: data.warehouseId,
          onHand: current + qty,
          reason: 'Products list receive stock',
        })
      }
      return api.post(`/products/${data.productId}/stock`, {
        warehouseId: data.warehouseId,
        quantity: qty,
        type: 'add',
      })
    },
    onSuccess: () => {
      toast.success(isAr ? 'تمت إضافة المخزون' : 'Stock received')
      queryClient.invalidateQueries(['products'])
      queryClient.invalidateQueries(['products-stats'])
      queryClient.invalidateQueries(['stock-report'])
      queryClient.invalidateQueries(['physical-inventory'])
      setStockModal({ isOpen: false, productId: null, productName: '' })
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || (isAr ? 'حدث خطأ' : 'Failed to add stock'))
    }
  })

  const openStockModal = (product) => {
    setStockModal({
      isOpen: true,
      productId: product._id,
      productName: isAr ? product.nameAr || product.nameEn : product.nameEn
    })
    setStockQuantity(1)
    if (warehouseOptions.length > 0) setStockWarehouseId(warehouseOptions[0]._id)
  }

  const handleAddStock = (e) => {
    e.preventDefault()
    if (!stockWarehouseId || stockQuantity <= 0) return
    addStockMutation.mutate({
      productId: stockModal.productId,
      warehouseId: stockWarehouseId,
      quantity: stockQuantity
    })
  }

  const exportColumns = [
    { key: 'productId', label: isAr ? 'معرّف المنتج' : 'Product ID', value: (r) => r?.productId || '' },
    { key: 'name', label: t('productName'), value: (r) => (isAr ? r?.nameAr || r?.nameEn : r?.nameEn || r?.nameAr) || '' },
    { key: 'sku', label: t('sku'), value: (r) => r?.sku || '' },
    { key: 'barcode', label: t('barcode'), value: (r) => r?.barcode || '' },
    { key: 'category', label: t('category'), value: (r) => r?.category || '' },
    { key: 'unitOfMeasure', label: isAr ? 'وحدة القياس' : 'UOM', value: (r) => getUomLabel(r?.unitOfMeasure, language) || r?.unitOfMeasure || 'EA' },
    { key: 'productType', label: isAr ? 'النوع' : 'Type', value: (r) => formatProductTypeLabel(r?.productType, language) },
    { key: 'onHand', label: isAr ? 'الرصيد' : 'On hand', value: (r) => r?.inventory?.onHand ?? r?.totalStock ?? '' },
    { key: 'available', label: isAr ? 'المتاح' : 'Available', value: (r) => r?.inventory?.available ?? '' },
    { key: 'reorderPoint', label: isAr ? 'حد الطلب' : 'Reorder at', value: (r) => r?.inventory?.reorderPoint ?? '' },
    { key: 'health', label: isAr ? 'المخزون' : 'Stock', value: (r) => r?.inventory?.health || '' },
    { key: 'costPrice', label: t('costPrice'), value: (r) => r?.costPrice ?? '' },
    { key: 'sellingPrice', label: t('sellingPrice'), value: (r) => r?.sellingPrice ?? '' },
    { key: 'status', label: t('status'), value: (r) => r?.status || '' },
  ]

  const { data, isLoading } = useQuery({
    queryKey: ['products', page, debouncedSearch, filters],
    queryFn: () => api.get('/products', { params: { page, limit: 25, search: debouncedSearch, ...filters } }).then((res) => res.data),
    placeholderData: (prev) => prev,
  })

  const getExportRows = async () => {
    const limit = 200
    let currentPage = 1
    let all = []
    while (true) {
      const res = await api.get('/products', { params: { page: currentPage, limit, search: debouncedSearch, ...filters } })
      const batch = res.data?.products || []
      all = all.concat(batch)
      if (currentPage >= (res.data?.pagination?.pages || 1) || all.length >= 10000) break
      currentPage += 1
    }
    return all
  }

  const { data: stats } = useQuery({
    queryKey: ['products-stats'],
    queryFn: () => api.get('/products/stats').then((res) => res.data)
  })

  const totals = stats?.totals?.[0] || {}
  const products = data?.products || []
  const pagination = data?.pagination
  const pageIds = useMemo(() => products.map((p) => String(p._id)), [products])
  const selectedRowIds = useMemo(() => pageIds.filter((id) => selected.has(id)), [pageIds, selected])
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id))
  const somePageSelected = pageIds.some((id) => selected.has(id)) && !allPageSelected

  useEffect(() => {
    if (masterCheckboxRef.current) {
      masterCheckboxRef.current.indeterminate = somePageSelected
    }
  }, [somePageSelected])

  const toggleRow = (id) => {
    const key = String(id)
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const toggleAllPage = () => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (allPageSelected) pageIds.forEach((id) => next.delete(id))
      else pageIds.forEach((id) => next.add(id))
      return next
    })
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      let rows
      if (selectedRowIds.length > 0) {
        const res = await api.get('/products', {
          params: { ids: selectedRowIds.join(','), limit: Math.min(500, selectedRowIds.length), page: 1 },
        })
        rows = res.data?.products || []
      } else {
        rows = await getExportRows()
      }
      exportToCsv({
        fileName: buildDefaultFileName(isAr ? 'المخزون' : 'Inventory'),
        rows,
        columns: exportColumns,
      })
      toast.success(
        isAr
          ? `تم تصدير ${rows.length} صف`
          : `Exported ${rows.length} rows`,
      )
    } catch (e) {
      toast.error(formatInvError(e, language))
    } finally {
      setExporting(false)
    }
  }

  const setHealth = (health) => {
    setFilters((f) => ({ ...f, stockHealth: f.stockHealth === health ? '' : health }))
    setPage(1)
  }

  const tiles = [
    { key: '', label: isAr ? 'الأصناف' : 'SKUs', value: totals.totalProducts || 0, icon: Package, hint: isAr ? 'في الكتالوج' : 'In catalogue' },
    { key: 'in_stock', label: isAr ? 'متوفر' : 'In stock', value: totals.inStock || 0, icon: Boxes, hint: isAr ? 'فوق حد الطلب' : 'Above reorder' },
    { key: 'low_stock', label: isAr ? 'منخفض' : 'Low stock', value: totals.lowStock || stats?.lowStock?.[0]?.count || 0, icon: AlertTriangle, hint: isAr ? 'عند أو تحت حد الطلب' : 'At or below reorder' },
    { key: 'out_of_stock', label: isAr ? 'نفد' : 'Out of stock', value: totals.outOfStock || 0, icon: CircleOff, hint: isAr ? 'لا رصيد متاح' : 'No available qty' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-emerald-700">{isAr ? 'المخزون' : 'Inventory'}</p>
          <h1 className="mt-1 font-[Outfit,sans-serif] text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">
            {isAr ? 'المخزون والمنتجات' : 'Inventory'}
          </h1>
          <p className="mt-1 max-w-xl text-sm text-slate-500">
            {isAr
              ? 'الرصيد المتاح، حد إعادة الطلب، والقيمة — وليس مجرد قائمة منتجات.'
              : 'On-hand, available, and reorder levels — not just a product list.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <InventoryIeButtons
            model="products"
            ar={isAr}
            hideExport
            filters={{ search: debouncedSearch, ...filters }}
            onImported={() => {
              queryClient.invalidateQueries({ queryKey: ['products'] })
              queryClient.invalidateQueries({ queryKey: ['products-stats'] })
            }}
          />
          <ColumnChooser ar={isAr} definitions={columnDefs} visible={visible} onToggle={toggle} />
          <button
            type="button"
            className={OUTLINED_BTN}
            disabled={selectedRowIds.length === 0}
            onClick={() => setLabelModalOpen(true)}
          >
            <Printer className="h-4 w-4" />
            {selectedRowIds.length
              ? (isAr ? `ملصقات (${selectedRowIds.length})` : `Labels (${selectedRowIds.length})`)
              : (isAr ? 'ملصقات' : 'Labels')}
          </button>
          <button
            type="button"
            className={OUTLINED_BTN}
            disabled={isLoading || exporting || (!selectedRowIds.length && !products.length)}
            onClick={handleExport}
          >
            <Download className="h-4 w-4" />
            {exporting
              ? '…'
              : selectedRowIds.length
                ? (isAr ? `تصدير (${selectedRowIds.length})` : `Export (${selectedRowIds.length})`)
                : (isAr ? 'تصدير' : 'Export')}
          </button>
          <Link to="/app/dashboard/inventory/products/new" className="inline-flex items-center gap-2 rounded-xl bg-[#1a3d28] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#244d33]">
            <Plus className="h-4 w-4" />
            {isAr ? 'إضافة صنف' : 'Add SKU'}
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((tile) => {
          const Icon = tile.icon
          const active = (tile.key && filters.stockHealth === tile.key) || (!tile.key && !filters.stockHealth)
          return (
            <button
              key={tile.key || 'all'}
              type="button"
              onClick={() => (tile.key ? setHealth(tile.key) : (setFilters((f) => ({ ...f, stockHealth: '' })), setPage(1)))}
              className={`rounded-2xl border p-4 text-start transition ${
                active
                  ? 'border-emerald-200 bg-white shadow-[0_16px_40px_-24px_rgba(16,185,129,.45)] ring-1 ring-emerald-100'
                  : 'border-slate-100 bg-white/70 hover:border-slate-200 hover:bg-white'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="font-[Outfit,sans-serif] text-2xl font-semibold tabular-nums text-slate-900">{Number(tile.value).toLocaleString()}</span>
              </div>
              <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{tile.label}</p>
              <p className="mt-0.5 text-xs text-slate-400">{tile.hint}</p>
            </button>
          )
        })}
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white px-4 py-3 text-sm text-slate-600">
        <span className="font-semibold text-slate-900"><Money value={totals.totalValue || 0} /></span>
        {' '}{isAr ? 'قيمة المخزون بسعر التكلفة' : 'inventory value at cost'}
        <span className="mx-2 text-slate-300">·</span>
        {(totals.totalStock || 0).toLocaleString()} {isAr ? 'وحدة في اليد' : 'units on hand'}
        {filters.categoryId ? (
          <>
            <span className="mx-2 text-slate-300">·</span>
            <span className="inline-flex items-center gap-2">
              {isAr ? 'مصفّى حسب الفئة' : 'Filtered by category'}
              <button
                type="button"
                className="text-xs font-semibold text-emerald-800 underline"
                onClick={() => {
                  setFilters((f) => ({ ...f, categoryId: '' }))
                  setPage(1)
                }}
              >
                {isAr ? 'مسح' : 'Clear'}
              </button>
            </span>
          </>
        ) : null}
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white p-3 sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder={isAr ? 'بحث بالاسم أو الباركود أو SKU أو معرّف المنتج' : 'Search name, barcode, SKU, or Product ID'}
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/70 py-2.5 ps-10 pe-3 text-sm outline-none transition focus:border-emerald-600/40 focus:bg-white focus:ring-2 focus:ring-emerald-700/10"
            />
          </div>
          <select
            value={filters.status}
            onChange={(e) => { setFilters({ ...filters, status: e.target.value }); setPage(1) }}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm sm:w-40"
          >
            <option value="">{isAr ? 'كل الحالات' : 'All statuses'}</option>
            <option value="active">{isAr ? 'نشط' : 'Active'}</option>
            <option value="inactive">{isAr ? 'غير نشط' : 'Inactive'}</option>
          </select>
          <select
            value={filters.productType}
            onChange={(e) => { setFilters({ ...filters, productType: e.target.value }); setPage(1) }}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm sm:w-40"
          >
            <option value="">{isAr ? 'كل الأنواع' : 'All types'}</option>
            <option value="goods">{isAr ? 'بضاعة' : 'Goods'}</option>
            <option value="service">{isAr ? 'خدمة' : 'Service'}</option>
          </select>
        </div>
      </div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="overflow-hidden rounded-[28px] border border-slate-100 bg-white shadow-[0_24px_60px_-32px_rgba(15,23,42,.18)]">
        {isLoading ? (
          <div className="flex justify-center p-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
          </div>
        ) : (
          <ResponsiveDataList
            items={products}
            empty={
              <div className="px-6 py-16 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                  <Warehouse className="h-6 w-6" />
                </div>
                <p className="mt-4 font-[Outfit,sans-serif] text-lg font-semibold text-slate-900">{isAr ? 'لا توجد أصناف' : 'No inventory in this view'}</p>
              </div>
            }
            className="p-4 md:p-0"
            renderCard={(product) => {
              const inv = product.inventory || {}
              const health = inv.health || 'in_stock'
              const hm = healthMeta[health] || healthMeta.in_stock
              const tracked = isStockTrackedProductType(product.productType)
              const type = normalizeProductType(product.productType)
              return (
                <div key={product._id} className="rounded-2xl border border-slate-100 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">
                        <Link to={`/app/dashboard/inventory/products/${product._id}`} className="hover:text-emerald-800 hover:underline">
                          {isAr ? product.nameAr || product.nameEn : product.nameEn}
                        </Link>
                      </p>
                      <p className="font-mono text-xs text-emerald-700">{product.productId || '—'}</p>
                      <p className="font-mono text-xs text-slate-400">{product.sku}</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${productTypeBadgeClass(type)}`}>
                      {formatProductTypeLabel(type, language)}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-sm">
                    {(inv.aggregatedFromVariants || (product.variantCount || 0) > 0) ? (
                      <button
                        type="button"
                        className={`font-semibold hover:underline ${tracked ? qtyClass(health) : 'text-slate-500'}`}
                        onClick={() => goToVariantStock(product)}
                      >
                        {tracked ? `${(inv.available ?? product.totalStock) || 0} ${product.unitOfMeasure || 'EA'}` : (isAr ? 'بدون مخزون' : 'No stock')}
                      </button>
                    ) : (
                      <span className={`font-semibold ${tracked ? qtyClass(health) : 'text-slate-500'}`}>
                        {tracked ? `${(inv.available ?? product.totalStock) || 0} ${product.unitOfMeasure || 'EA'}` : (isAr ? 'بدون مخزون' : 'No stock')}
                      </span>
                    )}
                    <Money value={product.sellingPrice} />
                  </div>
                  {tracked ? (
                    <span className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${hm.className}`}>{isAr ? hm.ar : hm.en}</span>
                  ) : null}
                </div>
              )
            }}
          >
            <div className={`${invTableWrapClass} w-full`}>
              <table className={`${invTableClass} table-fixed w-full`}>
                <thead>
                  <tr className="border-b border-slate-100 text-start text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                    <th className="w-10 px-3 py-3">
                      <input
                        ref={masterCheckboxRef}
                        type="checkbox"
                        checked={allPageSelected}
                        onChange={toggleAllPage}
                        disabled={!pageIds.length}
                        aria-label={isAr ? 'تحديد الكل' : 'Select all'}
                      />
                    </th>
                    {col('name') && <th className="w-full px-3 py-3 font-semibold">{t('productName')}</th>}
                    {col('productId') && <th className="w-24 px-2 py-3 font-semibold">{isAr ? 'المعرّف' : 'ID'}</th>}
                    {col('sku') && <th className="w-32 px-2 py-3 font-semibold">{t('sku')}</th>}
                    {col('type') && <th className="w-24 px-2 py-3 font-semibold">{isAr ? 'النوع' : 'Type'}</th>}
                    {col('uom') && <th className="w-24 px-2 py-3 font-semibold">{isAr ? 'الوحدة' : 'UOM'}</th>}
                    {col('available') && <th className="w-24 px-2 py-3 font-semibold">{isAr ? 'المتاح' : 'Available'}</th>}
                    {col('reorder') && <th className="w-24 px-2 py-3 font-semibold">{isAr ? 'حد الطلب' : 'Reorder'}</th>}
                    {col('sellingPrice') && <th className="w-28 px-2 py-3 font-semibold">{t('sellingPrice')}</th>}
                    {col('stock') && <th className="w-24 px-2 py-3 font-semibold">{isAr ? 'المخزون' : 'Stock'}</th>}
                    {col('actions') && <th className="w-28 px-2 py-3 font-semibold" />}
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => {
                    const inv = product.inventory || {}
                    const health = inv.health || 'in_stock'
                    const hm = healthMeta[health] || healthMeta.in_stock
                    const tracked = isStockTrackedProductType(product.productType)
                    const type = normalizeProductType(product.productType)
                    const rowId = String(product._id)
                    return (
                      <tr key={product._id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/70">
                        <td className="px-3 py-3.5">
                          <input
                            type="checkbox"
                            checked={selected.has(rowId)}
                            onChange={() => toggleRow(rowId)}
                            aria-label={isAr ? 'تحديد' : 'Select row'}
                          />
                        </td>
                        {col('name') && (
                          <td className="max-w-0 px-3 py-3.5">
                            <div className="flex min-w-0 items-center gap-2">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100">
                                {product.images?.[0] ? (
                                  <img src={product.images[0].thumbUrl || product.images[0].url} alt="" className="h-full w-full object-cover" />
                                ) : (
                                  <Package className="h-4 w-4 text-slate-400" />
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="truncate font-semibold text-slate-900">
                                  <Link to={`/app/dashboard/inventory/products/${product._id}`} className="hover:text-emerald-800 hover:underline">
                                    {isAr ? product.nameAr || product.nameEn : product.nameEn}
                                  </Link>
                                </p>
                                {product.barcode && (
                                  <p className="truncate font-mono text-[11px] text-slate-400">
                                    <QrCode className="me-1 inline h-3 w-3" />{product.barcode}
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>
                        )}
                        {col('productId') && (
                          <td className="truncate px-2 py-3.5 font-mono text-xs font-semibold text-emerald-700">{product.productId || '—'}</td>
                        )}
                        {col('sku') && (
                          <td className="truncate px-2 py-3.5 font-mono text-xs text-slate-500">{product.sku}</td>
                        )}
                        {col('type') && (
                          <td className="px-2 py-3.5">
                            <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${productTypeBadgeClass(type)}`}>
                              {formatProductTypeLabel(type, language)}
                            </span>
                          </td>
                        )}
                        {col('uom') && (
                          <td className="truncate px-2 py-3.5">
                            <span className="rounded-lg bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-600">
                              {getUomLabel(product.unitOfMeasure, language) || product.unitOfMeasure || 'EA'}
                            </span>
                          </td>
                        )}
                        {col('available') && (
                          <td className="px-2 py-3.5">
                            {tracked ? (
                              <>
                                {(inv.aggregatedFromVariants || (product.variantCount || 0) > 0) ? (
                                  <button
                                    type="button"
                                    className={`font-semibold tabular-nums hover:underline ${qtyClass(health)}`}
                                    title={isAr ? 'عرض تفصيل المتغيرات' : 'View variant breakdown'}
                                    onClick={() => goToVariantStock(product)}
                                  >
                                    {inv.available ?? product.totalStock ?? 0}
                                  </button>
                                ) : (
                                  <p className={`font-semibold tabular-nums ${qtyClass(health)}`}>
                                    {inv.available ?? product.totalStock ?? 0}
                                  </p>
                                )}
                                {inv.reserved > 0 && (
                                  <p className="text-[11px] text-slate-400">{inv.onHand} {isAr ? 'في اليد' : 'on hand'} · {inv.reserved} {isAr ? 'محجوز' : 'reserved'}</p>
                                )}
                                {(inv.aggregatedFromVariants || (product.variantCount || 0) > 0) && (
                                  <p className="text-[10px] text-slate-400">
                                    {isAr ? 'مجموع المتغيرات' : 'Sum of variants'}
                                    {inv.forecasted != null ? ` · ${isAr ? 'متوقع' : 'Fcst'} ${inv.forecasted}` : ''}
                                  </p>
                                )}
                              </>
                            ) : (
                              <span className="text-xs text-slate-400">—</span>
                            )}
                          </td>
                        )}
                        {col('reorder') && (
                          <td className="truncate px-2 py-3.5 tabular-nums text-slate-500">{tracked ? (inv.reorderPoint ?? '—') : '—'}</td>
                        )}
                        {col('sellingPrice') && (
                          <td className="truncate px-2 py-3.5 font-semibold"><Money value={product.sellingPrice} /></td>
                        )}
                        {col('stock') && (
                          <td className="px-2 py-3.5">
                            {tracked ? (
                              <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${hm.className}`}>
                                {isAr ? hm.ar : hm.en}
                              </span>
                            ) : (
                              <span className="rounded-full bg-sky-50 px-2.5 py-1 text-[11px] font-semibold text-sky-800">
                                {isAr ? 'خدمة' : 'Service'}
                              </span>
                            )}
                          </td>
                        )}
                        {col('actions') && (
                          <td className="px-2 py-3.5">
                            <div className="flex justify-end gap-1">
                            {tracked ? (
                              <button
                                type="button"
                                onClick={() => openStockModal(product)}
                                disabled={inv.aggregatedFromVariants || (product.variantCount || 0) > 0}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-40"
                                title={
                                  (inv.aggregatedFromVariants || (product.variantCount || 0) > 0)
                                    ? (isAr ? 'اضبط المخزون على مستوى المتغير' : 'Adjust stock on the variant')
                                    : (isAr ? 'استلام مخزون' : 'Receive stock')
                                }
                              >
                                <Plus className="h-4 w-4" />
                              </button>
                            ) : null}
                            {(inv.aggregatedFromVariants || (product.variantCount || 0) > 0) && (
                              <button
                                type="button"
                                onClick={() => goToVariantStock(product)}
                                className="inline-flex h-9 items-center rounded-xl px-2 text-xs font-semibold text-sky-800 hover:bg-sky-50"
                                title={isAr ? 'المتغيرات' : 'Variants'}
                              >
                                {isAr ? 'متغيرات' : 'Variants'}
                              </button>
                            )}
                              <Link to={`/app/dashboard/inventory/products/${product._id}`} className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                                <Eye className="h-4 w-4" />
                              </Link>
                              <Link to={`/app/dashboard/inventory/products/${product._id}`} className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                                <Edit className="h-4 w-4" />
                              </Link>
                            </div>
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </ResponsiveDataList>
        )}
      </motion.div>

      {pagination?.pages > 1 && (
        <div className="flex items-center justify-between text-sm text-slate-500">
          <button className="rounded-xl border border-slate-200 bg-white px-4 py-2 disabled:opacity-40" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            {isAr ? 'السابق' : 'Previous'}
          </button>
          <span>{isAr ? 'صفحة' : 'Page'} {page} / {pagination.pages} · {pagination.total} {isAr ? 'صنف' : 'SKUs'}</span>
          <button className="rounded-xl border border-slate-200 bg-white px-4 py-2 disabled:opacity-40" disabled={page >= pagination.pages} onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}>
            {isAr ? 'التالي' : 'Next'}
          </button>
        </div>
      )}

      <PrintBarcodeLabelsModal
        open={labelModalOpen}
        onClose={() => setLabelModalOpen(false)}
        productIds={selectedRowIds}
        ar={isAr}
        language={language}
      />

      {stockModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="p-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-700">{isAr ? 'حركة مخزون' : 'Stock movement'}</p>
              <h3 className="mt-1 font-[Outfit,sans-serif] text-xl font-semibold text-slate-900">
                {isAr ? 'استلام مخزون' : 'Receive stock'}
              </h3>
              <p className="mt-1 text-sm text-slate-500">{stockModal.productName}</p>
              {engineOn && (
                <p className="mt-2 text-xs text-slate-400">
                  {isAr
                    ? 'المحرك مفعّل — الاستلام يمر عبر تسوية مخزون مرتبطة بالمنتج.'
                    : 'Engine on — receive posts an adjustment transfer for this product.'}
                </p>
              )}
              <form onSubmit={handleAddStock} className="mt-5 space-y-4">
                <div>
                  <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">{isAr ? 'المستودع' : 'Warehouse'}</label>
                  <select className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" value={stockWarehouseId} onChange={(e) => setStockWarehouseId(e.target.value)} required>
                    <option value="">{isAr ? 'اختر المستودع' : 'Select warehouse'}</option>
                    {warehouseOptions.map((w) => (
                      <option key={w._id} value={w._id}>{isAr ? w.nameAr || w.nameEn : w.nameEn}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">{isAr ? 'الكمية المستلمة' : 'Quantity received'}</label>
                  <input type="number" min="0.0001" step="0.0001" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" value={stockQuantity} onChange={(e) => setStockQuantity(e.target.value)} required />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setStockModal({ isOpen: false, productId: null, productName: '' })} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600">
                    {isAr ? 'إلغاء' : 'Cancel'}
                  </button>
                  <button type="submit" disabled={addStockMutation.isPending} className="rounded-xl bg-[#1a3d28] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
                    {addStockMutation.isPending ? '…' : (isAr ? 'استلام' : 'Receive')}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}
