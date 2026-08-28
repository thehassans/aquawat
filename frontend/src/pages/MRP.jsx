import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Search, Edit, ShoppingCart, Boxes, ArrowUpRight, Layers } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../lib/api'
import { useTranslation } from '../lib/translations'
import Money from '../components/ui/Money'
import ExportMenu from '../components/ui/ExportMenu'
import {
  pageTitleClass,
  pageSubtitleClass,
  pageHeaderClass,
  statGridClass,
  statCardClass,
  statLabelClass,
  statValueClass,
  filterBarClass,
  listShellClass,
  salesTableClass,
  salesThClass,
  salesTdClass,
  salesTrClass,
  primaryBtnClass,
  secondaryBtnClass,
  ghostActionClass,
  softChipClass,
  fieldControlClass,
  fieldLabelClass,
  rowActionsWrapClass,
  rowActionPrimaryClass,
  rowActionBtnClass,
  paginationBarClass,
  emptyStateClass,
  variantPillClass,
  monoCellClass,
  suggestCellClass,
} from './planning/planningUi'

export default function MRP() {
  const { language } = useSelector((state) => state.ui)
  const { t } = useTranslation(language)

  const queryClient = useQueryClient()

  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [multiplier, setMultiplier] = useState(2)
  const [selected, setSelected] = useState({})
  const [planningMode, setPlanningMode] = useState('reorder')
  const [bomProductId, setBomProductId] = useState('')
  const [bomQuantity, setBomQuantity] = useState(1)
  const [bomResult, setBomResult] = useState(null)

  const exportColumns = [
    { key: 'sku', label: 'SKU', value: (r) => r?.sku || '' },
    {
      key: 'name',
      label: language === 'ar' ? 'المنتج' : 'Product',
      value: (r) => (language === 'ar' ? r?.nameAr || r?.nameEn : r?.nameEn || r?.nameAr) || ''
    },
    { key: 'category', label: language === 'ar' ? 'الفئة' : 'Category', value: (r) => r?.category || '' },
    { key: 'currentStock', label: language === 'ar' ? 'المتاح' : 'Available', value: (r) => r?.currentStock ?? '' },
    { key: 'incomingQty', label: language === 'ar' ? 'وارد' : 'Incoming', value: (r) => r?.incomingQty ?? '' },
    { key: 'reorderPoint', label: language === 'ar' ? 'نقطة إعادة الطلب' : 'Reorder Point', value: (r) => r?.reorderPoint ?? '' },
    { key: 'targetStock', label: language === 'ar' ? 'الهدف' : 'Target', value: (r) => r?.targetStock ?? '' },
    { key: 'recommendedQty', label: language === 'ar' ? 'مقترح' : 'Suggested', value: (r) => r?.recommendedQty ?? '' },
    { key: 'estimatedCost', label: language === 'ar' ? 'تكلفة' : 'Cost', value: (r) => r?.estimatedCost ?? '' },
  ]

  const { data, isLoading } = useQuery({
    queryKey: ['mrp-suggestions', page, search, multiplier],
    queryFn: () =>
      api
        .get('/mrp/suggestions', {
          params: {
            page,
            limit: 25,
            search,
            multiplier,
          },
        })
        .then((res) => res.data),
  })

  const { data: products } = useQuery({
    queryKey: ['products-list-mrp'],
    queryFn: () => api.get('/products', { params: { limit: 200 } }).then((res) => res.data.products),
  })

  const manufacturedProducts = useMemo(() => {
    const rows = Array.isArray(products) ? products : []
    return rows.filter((p) => p?.isManufactured)
  }, [products])

  const bomPlanMutation = useMutation({
    mutationFn: (payload) => api.post('/mrp/bom-plan', payload).then((res) => res.data),
    onSuccess: (res) => {
      setBomResult(res)
      toast.success(language === 'ar' ? 'تم إنشاء خطة BOM' : 'BOM plan generated')
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Error'),
  })

  const getExportRows = async () => {
    const limit = 200
    let currentPage = 1
    let all = []

    while (true) {
      const res = await api.get('/mrp/suggestions', {
        params: { page: currentPage, limit, search, multiplier }
      })
      const batch = res.data?.suggestions || []
      all = all.concat(batch)

      const pages = res.data?.pagination?.pages || 1
      if (currentPage >= pages) break
      currentPage += 1

      if (all.length >= 10000) break
    }

    return all
  }

  const { data: stats } = useQuery({
    queryKey: ['mrp-stats', search, multiplier],
    queryFn: () => api.get('/mrp/stats', { params: { search, multiplier } }).then((res) => res.data),
  })

  const suggestions = data?.suggestions || []
  const pagination = data?.pagination

  const createPoMutation = useMutation({
    mutationFn: (payload) => api.post('/mrp/create-po', payload).then((res) => res.data),
    onSuccess: (res) => {
      const created = res?.purchaseOrders || []
      queryClient.invalidateQueries(['purchase-orders'])
      queryClient.invalidateQueries(['purchase-orders-stats'])
      toast.success(
        language === 'ar'
          ? `تم إنشاء ${created.length} طلب/طلبات شراء (مسودة)`
          : `Created ${created.length} draft purchase order(s)`
      )
      setSelected({})
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Error'),
  })

  const selectedItems = useMemo(() => {
    const map = selected || {}
    return suggestions
      .filter((s) => map[String(s.rowKey || s.productId)])
      .map((s) => ({
        productId: s.productId,
        variantId: s.variantId || undefined,
        quantity: Number(s.recommendedQty || 0),
      }))
      .filter((x) => x.productId && x.quantity > 0)
  }, [selected, suggestions])

  const bomShortageItems = useMemo(() => {
    const shortages = bomResult?.shortages || []
    return shortages
      .map((l) => ({
        productId: l.componentId,
        variantId: l.variantId || undefined,
        quantity: Number(l.shortageQty || 0),
      }))
      .filter((x) => x.productId && x.quantity > 0)
  }, [bomResult])

  const totals = stats?.totals
  const byCategory = stats?.byCategory || []

  const summary = useMemo(() => {
    return {
      suggestions: totals?.suggestions || 0,
      recommendedQty: totals?.recommendedQty || 0,
      estimatedCost: totals?.estimatedCost || 0,
      incomingQty: totals?.incomingQty || 0,
    }
  }, [totals])

  const ar = language === 'ar'

  return (
    <div className="space-y-5 pb-8">
      <div className={pageHeaderClass}>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className={pageTitleClass}>{ar ? 'تخطيط الاحتياجات' : 'MRP'}</h1>
            <span className={softChipClass}>
              {ar ? 'مشتريات · مخزون' : 'Purchasing · Inventory'}
            </span>
          </div>
          <p className={pageSubtitleClass}>
            {ar
              ? 'اقتراحات إعادة الطلب من المخزون المتاح، المحجوز، ووارد أوامر الشراء.'
              : 'Reorder suggestions from available stock, reservations, and incoming purchase orders.'}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link to="/app/dashboard/inventory/manufacturing" className={ghostActionClass}>
              <Layers className="h-3.5 w-3.5" />
              {ar ? 'أوامر التصنيع' : 'Manufacturing orders'}
            </Link>
            <Link to="/app/dashboard/purchases/orders" className={ghostActionClass}>
              <ArrowUpRight className="h-3.5 w-3.5" />
              {ar ? 'أوامر الشراء' : 'Purchase orders'}
            </Link>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <ExportMenu
            language={language}
            t={t}
            rows={suggestions}
            getRows={getExportRows}
            columns={exportColumns}
            fileBaseName="MRP"
            title="MRP"
            disabled={isLoading || suggestions.length === 0}
          />
          <button
            type="button"
            onClick={() => createPoMutation.mutate({ items: selectedItems, notes: 'Created from MRP' })}
            disabled={createPoMutation.isPending || selectedItems.length === 0}
            className={primaryBtnClass}
          >
            {createPoMutation.isPending ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white dark:border-slate-400 dark:border-t-slate-950" />
            ) : (
              <ShoppingCart className="h-4 w-4" />
            )}
            {ar ? 'إنشاء طلب شراء' : 'Create draft PO'}
            {selectedItems.length > 0 && (
              <span className="rounded-md bg-white/15 px-1.5 py-0.5 text-[11px] font-bold dark:bg-slate-900/10">
                {selectedItems.length}
              </span>
            )}
          </button>
        </div>
      </div>

      <div className={statGridClass}>
        {[
          { label: ar ? 'اقتراحات' : 'Suggestions', value: summary.suggestions },
          { label: ar ? 'كمية مقترحة' : 'Recommended qty', value: Number(summary.recommendedQty || 0).toLocaleString() },
          {
            label: ar ? 'تكلفة تقديرية' : 'Estimated cost',
            value: <Money value={summary.estimatedCost} minimumFractionDigits={0} maximumFractionDigits={0} />,
          },
          { label: ar ? 'وارد (PO)' : 'Incoming (PO)', value: Number(summary.incomingQty || 0).toLocaleString() },
        ].map((item) => (
          <div key={item.label} className={statCardClass}>
            <p className={statLabelClass}>{item.label}</p>
            <p className={statValueClass}>{item.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <div className={`${filterBarClass} lg:col-span-2`}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder={ar ? 'SKU · اسم · باركود' : 'SKU · name · barcode'}
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(1)
                }}
                className={`${fieldControlClass} ps-10`}
              />
            </div>
            <select
              value={planningMode}
              onChange={(e) => {
                setPlanningMode(e.target.value)
                setSelected({})
                setBomResult(null)
              }}
              className={`${fieldControlClass} sm:w-44`}
            >
              <option value="reorder">{ar ? 'إعادة الطلب' : 'Reorder'}</option>
              <option value="bom">{ar ? 'تخطيط BOM' : 'BOM plan'}</option>
            </select>
            <select
              value={multiplier}
              onChange={(e) => {
                setMultiplier(Number(e.target.value))
                setPage(1)
              }}
              className={`${fieldControlClass} sm:w-52`}
              disabled={planningMode !== 'reorder'}
            >
              {[1, 2, 3, 4, 5].map((m) => (
                <option key={m} value={m}>
                  {ar ? `هدف ${m}× نقطة الطلب` : `Target ${m}× reorder point`}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className={statCardClass}>
          <p className={statLabelClass}>{ar ? 'أعلى الفئات' : 'Top categories'}</p>
          <div className="mt-3 space-y-2">
            {byCategory.length === 0 ? (
              <p className="text-xs text-slate-400">{t('noData')}</p>
            ) : (
              byCategory.slice(0, 4).map((row) => (
                <div key={row.category} className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate text-slate-600 dark:text-slate-300">{row.category}</span>
                  <span className="shrink-0 font-semibold text-slate-900 dark:text-white">
                    <Money value={row.estimatedCost || 0} minimumFractionDigits={0} maximumFractionDigits={0} />
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className={listShellClass}>
        {planningMode === 'reorder' ? (
          isLoading ? (
            <div className={emptyStateClass}>
              <span className="inline-block h-7 w-7 animate-spin rounded-full border-2 border-slate-200 border-t-slate-900 dark:border-dark-600 dark:border-t-white" />
            </div>
          ) : suggestions.length === 0 ? (
            <div className={emptyStateClass}>{ar ? 'لا توجد اقتراحات حالياً' : 'No replenishment suggestions'}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className={salesTableClass}>
                <thead>
                  <tr>
                    <th className={`${salesThClass} w-10`} />
                    <th className={salesThClass}>{ar ? 'SKU' : 'SKU'}</th>
                    <th className={salesThClass}>{ar ? 'المنتج' : 'Product'}</th>
                    <th className={salesThClass}>{ar ? 'الفئة' : 'Category'}</th>
                    <th className={salesThClass}>{ar ? 'متاح' : 'Avail.'}</th>
                    <th className={salesThClass}>{ar ? 'وارد' : 'In.'}</th>
                    <th className={salesThClass}>{ar ? 'ROP' : 'ROP'}</th>
                    <th className={salesThClass}>{ar ? 'هدف' : 'Target'}</th>
                    <th className={salesThClass}>{ar ? 'مقترح' : 'Suggest'}</th>
                    <th className={salesThClass}>{ar ? 'تكلفة' : 'Cost'}</th>
                    <th className={salesThClass}>{t('actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {suggestions.map((s) => {
                    const rowKey = String(s.rowKey || s.productId)
                    const name = ar ? s.nameAr || s.nameEn : s.nameEn || s.nameAr
                    return (
                      <tr key={rowKey} className={salesTrClass}>
                        <td className={salesTdClass}>
                          <input
                            type="checkbox"
                            className="rounded border-slate-300 text-slate-900 focus:ring-slate-400"
                            checked={Boolean(selected?.[rowKey])}
                            onChange={(e) => setSelected((prev) => ({ ...prev, [rowKey]: e.target.checked }))}
                          />
                        </td>
                        <td className={`${salesTdClass} ${monoCellClass}`}>{s.sku}</td>
                        <td className={salesTdClass}>
                          <p className="font-medium text-slate-900 dark:text-white">{name}</p>
                          {s.variantName && <p className={variantPillClass}>{s.variantName}</p>}
                          <p className="mt-1 text-[11px] text-slate-400">
                            {ar ? 'متوقع' : 'Proj.'} {Number(s.projectedStock || 0).toLocaleString()}
                            {typeof s?.onHand !== 'undefined' && ` · ${ar ? 'رف' : 'OH'} ${Number(s.onHand || 0).toLocaleString()}`}
                            {typeof s?.reservedQty !== 'undefined' && ` · ${ar ? 'محجوز' : 'Res.'} ${Number(s.reservedQty || 0).toLocaleString()}`}
                          </p>
                        </td>
                        <td className={`${salesTdClass} text-slate-600 dark:text-slate-300`}>{s.category || '—'}</td>
                        <td className={`${salesTdClass} ${monoCellClass}`}>{Number(s.currentStock || 0).toLocaleString()}</td>
                        <td className={`${salesTdClass} ${monoCellClass}`}>{Number(s.incomingQty || 0).toLocaleString()}</td>
                        <td className={`${salesTdClass} ${monoCellClass}`}>{Number(s.reorderPoint || 0).toLocaleString()}</td>
                        <td className={`${salesTdClass} ${monoCellClass}`}>{Number(s.targetStock || 0).toLocaleString()}</td>
                        <td className={`${salesTdClass} ${suggestCellClass}`}>{Number(s.recommendedQty || 0).toLocaleString()}</td>
                        <td className={`${salesTdClass} font-semibold text-slate-900 dark:text-white`}>
                          <Money value={s.estimatedCost || 0} minimumFractionDigits={0} maximumFractionDigits={0} />
                        </td>
                        <td className={salesTdClass}>
                          <div className={rowActionsWrapClass}>
                            <button
                              type="button"
                              className={rowActionPrimaryClass}
                              title={ar ? 'إنشاء PO' : 'Create PO'}
                              disabled={createPoMutation.isPending}
                              onClick={() => createPoMutation.mutate({
                                items: [{
                                  productId: s.productId,
                                  variantId: s.variantId || undefined,
                                  quantity: Number(s.recommendedQty || 0),
                                }],
                                notes: 'Created from MRP',
                              })}
                            >
                              <ShoppingCart className="h-4 w-4" />
                            </button>
                            <Link to={`/products/${s.productId}`} className={rowActionBtnClass} title={t('edit')}>
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
          )
        ) : (
          <div className="space-y-5 p-5 sm:p-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="md:col-span-2">
                <label className={fieldLabelClass}>{ar ? 'منتج مُصنّع' : 'Manufactured product'}</label>
                <select value={bomProductId} onChange={(e) => setBomProductId(e.target.value)} className={fieldControlClass}>
                  <option value="">{ar ? 'اختر منتجاً' : 'Select product'}</option>
                  {manufacturedProducts.map((p) => (
                    <option key={p._id} value={p._id}>
                      {(ar ? p.nameAr || p.nameEn : p.nameEn) || p.sku}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={fieldLabelClass}>{ar ? 'الكمية' : 'Quantity'}</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={bomQuantity}
                  onChange={(e) => setBomQuantity(Number(e.target.value))}
                  className={fieldControlClass}
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={primaryBtnClass}
                disabled={!bomProductId || bomPlanMutation.isPending || !(Number(bomQuantity) > 0)}
                onClick={() => bomPlanMutation.mutate({ productId: bomProductId, quantity: Number(bomQuantity || 0) })}
              >
                {bomPlanMutation.isPending ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                ) : (
                  <Boxes className="h-4 w-4" />
                )}
                {ar ? 'خطة BOM' : 'Generate BOM plan'}
              </button>
              <button
                type="button"
                className={secondaryBtnClass}
                disabled={createPoMutation.isPending || bomShortageItems.length === 0}
                onClick={() => createPoMutation.mutate({ items: bomShortageItems, notes: 'Created from MRP BOM plan' })}
              >
                <ShoppingCart className="h-4 w-4" />
                {ar ? 'PO للنواقص' : 'PO for shortages'}
              </button>
            </div>
            <div className="overflow-x-auto rounded-xl border border-slate-200/90 dark:border-dark-600">
              <table className={salesTableClass}>
                <thead>
                  <tr>
                    <th className={salesThClass}>{ar ? 'المكوّن' : 'Component'}</th>
                    <th className={salesThClass}>{ar ? 'مطلوب' : 'Required'}</th>
                    <th className={salesThClass}>{ar ? 'متاح' : 'Available'}</th>
                    <th className={salesThClass}>{ar ? 'وارد' : 'Incoming'}</th>
                    <th className={salesThClass}>{ar ? 'نقص' : 'Shortage'}</th>
                    <th className={salesThClass}>{ar ? 'تكلفة' : 'Cost'}</th>
                  </tr>
                </thead>
                <tbody>
                  {(bomResult?.components || []).map((l) => (
                    <tr key={`${l.componentId}-${l.variantId || ''}`} className={salesTrClass}>
                      <td className={salesTdClass}>
                        <p className="font-medium text-slate-900 dark:text-white">
                          {(ar ? l.nameAr || l.nameEn : l.nameEn || l.nameAr) || l.sku}
                        </p>
                        {l.variantName && <p className={variantPillClass}>{l.variantName}</p>}
                        <p className={`mt-0.5 ${monoCellClass}`}>{l.sku}</p>
                      </td>
                      <td className={`${salesTdClass} ${monoCellClass}`}>{Number(l.requiredQty || 0).toLocaleString()}</td>
                      <td className={`${salesTdClass} ${monoCellClass}`}>{Number(l.availableQty || 0).toLocaleString()}</td>
                      <td className={`${salesTdClass} ${monoCellClass}`}>{Number(l.incomingQty || 0).toLocaleString()}</td>
                      <td className={`${salesTdClass} ${suggestCellClass}`}>{Number(l.shortageQty || 0).toLocaleString()}</td>
                      <td className={`${salesTdClass} font-semibold`}>
                        <Money value={l.estimatedCost || 0} minimumFractionDigits={0} maximumFractionDigits={0} />
                      </td>
                    </tr>
                  ))}
                  {(bomResult?.components || []).length === 0 && (
                    <tr>
                      <td colSpan={6} className={emptyStateClass}>{ar ? 'لا توجد بيانات' : 'No BOM plan yet'}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </motion.div>

      {planningMode === 'reorder' && pagination?.pages > 1 && (
        <div className={paginationBarClass}>
          <button type="button" className={secondaryBtnClass} disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            {ar ? 'السابق' : 'Previous'}
          </button>
          <div className="text-xs font-medium text-slate-500">
            {ar ? 'صفحة' : 'Page'} {page} / {pagination.pages}
          </div>
          <button
            type="button"
            className={secondaryBtnClass}
            disabled={page >= pagination.pages}
            onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
          >
            {ar ? 'التالي' : 'Next'}
          </button>
        </div>
      )}
    </div>
  )
}
