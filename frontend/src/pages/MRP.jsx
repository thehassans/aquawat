import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Search, Factory, Package, TrendingUp, ArrowUpRight, Edit, ShoppingCart, HelpCircle, Boxes } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../lib/api'
import { useTranslation } from '../lib/translations'
import Money from '../components/ui/Money'
import ExportMenu from '../components/ui/ExportMenu'

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
      .filter((s) => map[String(s.productId)])
      .map((s) => ({ productId: s.productId, quantity: Number(s.recommendedQty || 0) }))
      .filter((x) => x.productId && x.quantity > 0)
  }, [selected, suggestions])

  const bomShortageItems = useMemo(() => {
    const shortages = bomResult?.shortages || []
    return shortages
      .map((l) => ({ productId: l.componentId, quantity: Number(l.shortageQty || 0) }))
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{language === 'ar' ? 'تخطيط الاحتياجات (MRP)' : 'MRP'}</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {language === 'ar'
              ? 'اقتراحات إعادة الطلب بناءً على المخزون الحالي والطلبات الواردة'
              : 'Reorder suggestions based on stock and incoming purchase orders'}
          </p>
        </div>
        <ExportMenu
          language={language}
          t={t}
          rows={suggestions}
          getRows={getExportRows}
          columns={exportColumns}
          fileBaseName={language === 'ar' ? 'MRP' : 'MRP'}
          title={language === 'ar' ? 'MRP' : 'MRP'}
          disabled={isLoading || suggestions.length === 0}
        />
      </div>

      <div className="card p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-gray-100 dark:bg-dark-700 rounded-xl">
              <HelpCircle className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <div className="text-sm font-semibold text-gray-900 dark:text-white">{language === 'ar' ? 'ما فائدة MRP؟' : 'What is MRP for?'}</div>
              <div className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                {language === 'ar'
                  ? 'MRP يساعدك على معرفة ما يجب شراؤه ومتى، بناءً على المخزون المتاح (بعد خصم المحجوز) والطلبات الواردة من أوامر الشراء.'
                  : 'MRP helps you decide what to buy and when, based on available stock (on-hand minus reserved) and incoming quantities from purchase orders.'}
              </div>
              <div className="mt-3 text-sm text-gray-600 dark:text-gray-300">
                <div className="font-medium text-gray-900 dark:text-white">{language === 'ar' ? 'المدخلات' : 'Inputs'}</div>
                <div className="mt-1">{language === 'ar' ? 'المخزون/المحجوز + نقطة إعادة الطلب + أوامر شراء واردة.' : 'Stock/reserved + reorder point + incoming purchase orders.'}</div>
                <div className="font-medium text-gray-900 dark:text-white mt-3">{language === 'ar' ? 'المخرجات' : 'Outputs'}</div>
                <div className="mt-1">{language === 'ar' ? 'كمية مقترحة للشراء، ويمكن إنشاء طلب شراء (مسودة) مباشرة.' : 'Suggested purchase quantity, with the ability to create a draft purchase order.'}</div>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => createPoMutation.mutate({ items: selectedItems, notes: 'Created from MRP' })}
            disabled={createPoMutation.isPending || selectedItems.length === 0}
            className="btn btn-primary"
          >
            {createPoMutation.isPending ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <ShoppingCart className="w-4 h-4" />
                {language === 'ar' ? 'إنشاء طلب شراء (مسودة)' : 'Create Draft PO'}
              </>
            )}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="card p-4 flex items-center gap-4">
          <div className="p-3 bg-primary-100 dark:bg-primary-900/30 rounded-xl">
            <Factory className="w-5 h-5 text-primary-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">{language === 'ar' ? 'اقتراحات' : 'Suggestions'}</p>
            <p className="text-2xl font-bold">{summary.suggestions}</p>
          </div>
        </div>

        <div className="card p-4 flex items-center gap-4">
          <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl">
            <TrendingUp className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">{language === 'ar' ? 'كمية مقترحة' : 'Recommended Qty'}</p>
            <p className="text-2xl font-bold text-emerald-600">{Number(summary.recommendedQty || 0).toLocaleString()}</p>
          </div>
        </div>

        <div className="card p-4 flex items-center gap-4">
          <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
            <ArrowUpRight className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">{language === 'ar' ? 'تكلفة تقديرية' : 'Estimated Cost'}</p>
            <p className="text-2xl font-bold text-blue-600">
              <Money value={summary.estimatedCost} minimumFractionDigits={0} maximumFractionDigits={0} />
            </p>
          </div>
        </div>

        <div className="card p-4 flex items-center gap-4">
          <div className="p-3 bg-amber-100 dark:bg-amber-900/30 rounded-xl">
            <Package className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">{language === 'ar' ? 'وارد (PO)' : 'Incoming (PO)'} </p>
            <p className="text-2xl font-bold text-amber-600">{Number(summary.incomingQty || 0).toLocaleString()}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card p-4 lg:col-span-2">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder={language === 'ar' ? 'بحث بالاسم / SKU / الباركود...' : 'Search by name / SKU / barcode...'}
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(1)
                }}
                className="input ps-10"
              />
            </div>

            <select
              value={multiplier}
              onChange={(e) => {
                setMultiplier(Number(e.target.value))
                setPage(1)
              }}
              className="select w-full sm:w-56"
              disabled={planningMode !== 'reorder'}
            >
              {[1, 2, 3, 4, 5].map((m) => (
                <option key={m} value={m}>
                  {language === 'ar' ? `هدف المخزون: ${m}× نقطة إعادة الطلب` : `Target: ${m}× reorder point`}
                </option>
              ))}
            </select>

            <select
              value={planningMode}
              onChange={(e) => {
                setPlanningMode(e.target.value)
                setSelected({})
                setBomResult(null)
              }}
              className="select w-full sm:w-56"
            >
              <option value="reorder">{language === 'ar' ? 'تخطيط إعادة الطلب' : 'Reorder Planning'}</option>
              <option value="bom">{language === 'ar' ? 'تخطيط BOM' : 'BOM Planning'}</option>
            </select>
          </div>
        </div>

        <div className="card p-4">
          <p className="text-sm text-gray-500">{language === 'ar' ? 'أعلى فئات بالتكلفة' : 'Top categories by cost'}</p>
          <div className="mt-3 space-y-2">
            {byCategory.length === 0 ? (
              <p className="text-sm text-gray-500">{t('noData')}</p>
            ) : (
              byCategory.slice(0, 4).map((row) => (
                <div key={row.category} className="flex items-center justify-between">
                  <span className="text-sm text-gray-700 dark:text-gray-200 truncate max-w-[60%]">{row.category}</span>
                  <span className="text-sm font-semibold">
                    <Money value={row.estimatedCost || 0} minimumFractionDigits={0} maximumFractionDigits={0} />
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card">
        {planningMode === 'reorder' ? (
          isLoading ? (
            <div className="p-8 text-center"><div className="inline-block w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>
          ) : (
            <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th className="w-10"></th>
                  <th>{language === 'ar' ? 'SKU' : 'SKU'}</th>
                  <th>{language === 'ar' ? 'المنتج' : 'Product'}</th>
                  <th>{language === 'ar' ? 'الفئة' : 'Category'}</th>
                  <th>{language === 'ar' ? 'المتاح' : 'Available'}</th>
                  <th>{language === 'ar' ? 'وارد' : 'Incoming'}</th>
                  <th>{language === 'ar' ? 'نقطة إعادة الطلب' : 'Reorder Point'}</th>
                  <th>{language === 'ar' ? 'الهدف' : 'Target'}</th>
                  <th>{language === 'ar' ? 'مقترح' : 'Suggested'}</th>
                  <th>{language === 'ar' ? 'تكلفة' : 'Cost'}</th>
                  <th>{t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {suggestions.map((s) => (
                  <tr key={s.productId}>
                    <td>
                      <input
                        type="checkbox"
                        checked={Boolean(selected?.[String(s.productId)])}
                        onChange={(e) => setSelected((prev) => ({ ...prev, [String(s.productId)]: e.target.checked }))}
                      />
                    </td>
                    <td className="font-mono text-sm">{s.sku}</td>
                    <td>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {language === 'ar' ? s.nameAr || s.nameEn : s.nameEn || s.nameAr}
                        </p>
                        <p className="text-xs text-gray-500">
                          {language === 'ar' ? 'مخزون متوقع:' : 'Projected:'} {Number(s.projectedStock || 0).toLocaleString()}
                          {typeof s?.onHand !== 'undefined' ? ` · ${language === 'ar' ? 'على الرف:' : 'On hand:'} ${Number(s.onHand || 0).toLocaleString()}` : ''}
                          {typeof s?.reservedQty !== 'undefined' ? ` · ${language === 'ar' ? 'محجوز:' : 'Reserved:'} ${Number(s.reservedQty || 0).toLocaleString()}` : ''}
                        </p>
                      </div>
                    </td>
                    <td>{s.category || '-'}</td>
                    <td className="font-mono text-sm">{Number(s.currentStock || 0).toLocaleString()}</td>
                    <td className="font-mono text-sm">{Number(s.incomingQty || 0).toLocaleString()}</td>
                    <td className="font-mono text-sm">{Number(s.reorderPoint || 0).toLocaleString()}</td>
                    <td className="font-mono text-sm">{Number(s.targetStock || 0).toLocaleString()}</td>
                    <td className="font-mono text-sm font-semibold text-emerald-600">{Number(s.recommendedQty || 0).toLocaleString()}</td>
                    <td className="font-semibold">
                      <Money value={s.estimatedCost || 0} minimumFractionDigits={0} maximumFractionDigits={0} />
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => createPoMutation.mutate({ items: [{ productId: s.productId, quantity: Number(s.recommendedQty || 0) }], notes: 'Created from MRP' })}
                          disabled={createPoMutation.isPending}
                          className="p-2 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg"
                          title={language === 'ar' ? 'إنشاء طلب شراء (مسودة)' : 'Create draft PO'}
                        >
                          <ShoppingCart className="w-4 h-4 text-gray-600" />
                        </button>
                        <Link to={`/products/${s.productId}`} className="p-2 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg">
                          <Edit className="w-4 h-4 text-gray-600" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )
        ) : (
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="label">{language === 'ar' ? 'منتج مُصنّع' : 'Manufactured Product'}</label>
                <select value={bomProductId} onChange={(e) => setBomProductId(e.target.value)} className="select">
                  <option value="">{language === 'ar' ? 'اختر منتج' : 'Select product'}</option>
                  {manufacturedProducts.map((p) => (
                    <option key={p._id} value={p._id}>
                      {(language === 'ar' ? p.nameAr || p.nameEn : p.nameEn) || p.sku}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">{language === 'ar' ? 'الكمية المطلوبة' : 'Required Quantity'}</label>
                <input type="number" min="1" step="1" value={bomQuantity} onChange={(e) => setBomQuantity(Number(e.target.value))} className="input" />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                className="btn btn-primary"
                disabled={!bomProductId || bomPlanMutation.isPending || !(Number(bomQuantity) > 0)}
                onClick={() => bomPlanMutation.mutate({ productId: bomProductId, quantity: Number(bomQuantity || 0) })}
              >
                {bomPlanMutation.isPending ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Boxes className="w-4 h-4" />
                    {language === 'ar' ? 'إنشاء خطة BOM' : 'Generate BOM Plan'}
                  </>
                )}
              </button>

              <button
                type="button"
                className="btn btn-secondary"
                disabled={createPoMutation.isPending || bomShortageItems.length === 0}
                onClick={() => createPoMutation.mutate({ items: bomShortageItems, notes: 'Created from MRP BOM plan' })}
              >
                <ShoppingCart className="w-4 h-4" />
                {language === 'ar' ? 'إنشاء طلب شراء للنواقص' : 'Create PO for Shortages'}
              </button>
            </div>

            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>{language === 'ar' ? 'المكوّن' : 'Component'}</th>
                    <th>{language === 'ar' ? 'المطلوب' : 'Required'}</th>
                    <th>{language === 'ar' ? 'المتاح' : 'Available'}</th>
                    <th>{language === 'ar' ? 'وارد' : 'Incoming'}</th>
                    <th>{language === 'ar' ? 'نقص' : 'Shortage'}</th>
                    <th>{language === 'ar' ? 'تكلفة' : 'Cost'}</th>
                  </tr>
                </thead>
                <tbody>
                  {(bomResult?.components || []).map((l) => (
                    <tr key={l.componentId}>
                      <td className="font-medium">
                        {(language === 'ar' ? l.nameAr || l.nameEn : l.nameEn || l.nameAr) || l.sku}
                        <div className="text-xs text-gray-500 font-mono">{l.sku}</div>
                      </td>
                      <td className="font-mono text-sm">{Number(l.requiredQty || 0).toLocaleString()}</td>
                      <td className="font-mono text-sm">{Number(l.availableQty || 0).toLocaleString()}</td>
                      <td className="font-mono text-sm">{Number(l.incomingQty || 0).toLocaleString()}</td>
                      <td className="font-mono text-sm font-semibold text-amber-600">{Number(l.shortageQty || 0).toLocaleString()}</td>
                      <td className="font-semibold"><Money value={l.estimatedCost || 0} minimumFractionDigits={0} maximumFractionDigits={0} /></td>
                    </tr>
                  ))}
                  {(bomResult?.components || []).length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center text-sm text-gray-500 py-8">{language === 'ar' ? 'لا توجد بيانات' : 'No data'}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </motion.div>

      {planningMode === 'reorder' && pagination?.pages > 1 && (
        <div className="flex items-center justify-between">
          <button className="btn btn-secondary" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            {language === 'ar' ? 'السابق' : 'Previous'}
          </button>
          <div className="text-sm text-gray-500">
            {language === 'ar' ? 'صفحة' : 'Page'} {page} / {pagination.pages}
          </div>
          <button
            className="btn btn-secondary"
            disabled={page >= pagination.pages}
            onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
          >
            {language === 'ar' ? 'التالي' : 'Next'}
          </button>
        </div>
      )}
    </div>
  )
}
