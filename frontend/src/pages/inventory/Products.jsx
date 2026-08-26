import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { useSelector } from 'react-redux'
import { Link, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Plus, Search, Package, AlertTriangle, Eye, Edit, QrCode, Boxes, Warehouse, CircleOff, Printer } from 'lucide-react'
import api from '../../lib/api'
import { useTranslation } from '../../lib/translations'
import Money from '../../components/ui/Money'
import ExportMenu from '../../components/ui/ExportMenu'
import { InventoryIeButtons } from '../../components/inventory/ImportExportDialog'
import ResponsiveDataList from '../../components/ui/ResponsiveDataList'
import { getUomLabel } from '../../lib/uomOptions'
import { formatProductTypeLabel, isStockTrackedProductType, normalizeProductType, productTypeBadgeClass } from '../../lib/productType'

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
  const [searchParams] = useSearchParams()
  const categoryIdFromUrl = searchParams.get('categoryId') || ''
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [filters, setFilters] = useState({ status: '', stockHealth: '', productType: '', categoryId: '' })
  const [page, setPage] = useState(1)

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
        <div className="flex gap-2">
          <InventoryIeButtons
            model="products"
            ar={isAr}
            filters={{ search: debouncedSearch, ...filters }}
            onImported={() => {
              queryClient.invalidateQueries({ queryKey: ['products'] })
              queryClient.invalidateQueries({ queryKey: ['products-stats'] })
            }}
          />
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50 dark:border-dark-600 dark:bg-dark-800 dark:text-slate-200"
            disabled={!products.length}
            onClick={async () => {
              try {
                const res = await api.post('/stock/print', {
                  layout: 'product_label',
                  productIds: products.slice(0, 50).map((p) => p._id),
                  copies: 1,
                  lang: isAr ? 'ar' : 'en',
                }, { responseType: 'blob' })
                const url = URL.createObjectURL(res.data)
                const a = document.createElement('a')
                a.href = url
                a.download = 'product-labels.pdf'
                a.click()
                URL.revokeObjectURL(url)
              } catch (e) {
                toast.error(e.response?.data?.error || e.message)
              }
            }}
          >
            <Printer className="h-4 w-4" />
            {isAr ? 'ملصقات' : 'Labels'}
          </button>
          <ExportMenu
            language={language}
            t={t}
            rows={products}
            getRows={getExportRows}
            columns={exportColumns}
            fileBaseName={isAr ? 'المخزون' : 'Inventory'}
            title={isAr ? 'المخزون' : 'Inventory'}
            disabled={isLoading || products.length === 0}
          />
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
                    <span className={`font-semibold ${tracked ? qtyClass(health) : 'text-slate-500'}`}>
                      {tracked ? `${(inv.available ?? product.totalStock) || 0} ${product.unitOfMeasure || 'EA'}` : (isAr ? 'بدون مخزون' : 'No stock')}
                    </span>
                    <Money value={product.sellingPrice} />
                  </div>
                  {tracked ? (
                    <span className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${hm.className}`}>{isAr ? hm.ar : hm.en}</span>
                  ) : null}
                </div>
              )
            }}
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[880px] text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-start text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                    <th className="px-5 py-3 font-semibold">{t('productName')}</th>
                    <th className="px-3 py-3 font-semibold">{isAr ? 'المعرّف' : 'ID'}</th>
                    <th className="px-3 py-3 font-semibold">{t('sku')}</th>
                    <th className="px-3 py-3 font-semibold">{isAr ? 'النوع' : 'Type'}</th>
                    <th className="px-3 py-3 font-semibold">{isAr ? 'الوحدة' : 'UOM'}</th>
                    <th className="px-3 py-3 font-semibold">{isAr ? 'المتاح' : 'Available'}</th>
                    <th className="px-3 py-3 font-semibold">{isAr ? 'حد الطلب' : 'Reorder'}</th>
                    <th className="px-3 py-3 font-semibold">{t('sellingPrice')}</th>
                    <th className="px-3 py-3 font-semibold">{isAr ? 'المخزون' : 'Stock'}</th>
                    <th className="px-5 py-3 font-semibold" />
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => {
                    const inv = product.inventory || {}
                    const health = inv.health || 'in_stock'
                    const hm = healthMeta[health] || healthMeta.in_stock
                    const tracked = isStockTrackedProductType(product.productType)
                    const type = normalizeProductType(product.productType)
                    return (
                      <tr key={product._id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/70">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-slate-100">
                              {product.images?.[0] ? (
                                <img src={product.images[0].thumbUrl || product.images[0].url} alt="" className="h-full w-full object-cover" />
                              ) : (
                                <Package className="h-5 w-5 text-slate-400" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-slate-900">
                                <Link to={`/app/dashboard/inventory/products/${product._id}`} className="hover:text-emerald-800 hover:underline">
                                  {isAr ? product.nameAr || product.nameEn : product.nameEn}
                                </Link>
                              </p>
                              {product.barcode && (
                                <p className="flex items-center gap-1 font-mono text-[11px] text-slate-400">
                                  <QrCode className="h-3 w-3" />{product.barcode}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3.5 font-mono text-xs font-semibold text-emerald-700">{product.productId || '—'}</td>
                        <td className="px-3 py-3.5 font-mono text-xs text-slate-500">{product.sku}</td>
                        <td className="px-3 py-3.5">
                          <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${productTypeBadgeClass(type)}`}>
                            {formatProductTypeLabel(type, language)}
                          </span>
                        </td>
                        <td className="px-3 py-3.5">
                          <span className="rounded-lg bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-600">
                            {getUomLabel(product.unitOfMeasure, language) || product.unitOfMeasure || 'EA'}
                          </span>
                        </td>
                        <td className="px-3 py-3.5">
                          {tracked ? (
                            <>
                              <p className={`font-semibold tabular-nums ${qtyClass(health)}`}>
                                {inv.available ?? product.totalStock ?? 0}
                              </p>
                              {inv.reserved > 0 && (
                                <p className="text-[11px] text-slate-400">{inv.onHand} {isAr ? 'في اليد' : 'on hand'} · {inv.reserved} {isAr ? 'محجوز' : 'reserved'}</p>
                              )}
                            </>
                          ) : (
                            <span className="text-xs text-slate-400">{isAr ? '—' : '—'}</span>
                          )}
                        </td>
                        <td className="px-3 py-3.5 tabular-nums text-slate-500">{tracked ? (inv.reorderPoint ?? '—') : '—'}</td>
                        <td className="px-3 py-3.5 font-semibold"><Money value={product.sellingPrice} /></td>
                        <td className="px-3 py-3.5">
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
                        <td className="px-5 py-3.5">
                          <div className="flex justify-end gap-1">
                            {tracked ? (
                              <button type="button" onClick={() => openStockModal(product)} className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-emerald-700 hover:bg-emerald-50" title={isAr ? 'استلام مخزون' : 'Receive stock'}>
                                <Plus className="h-4 w-4" />
                              </button>
                            ) : null}
                            <Link to={`/app/dashboard/inventory/products/${product._id}`} className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                              <Eye className="h-4 w-4" />
                            </Link>
                            <Link to={`/app/dashboard/inventory/products/${product._id}`} className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                              <Edit className="h-4 w-4" />
                            </Link>
                          </div>
                        </td>
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
