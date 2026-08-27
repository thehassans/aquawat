import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { useForm } from 'react-hook-form'
import { motion } from 'framer-motion'
import { ArrowLeft, Save, Package, DollarSign, Warehouse, Factory, Plus, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import { asInvList } from '../../lib/invList'
import { useTranslation } from '../../lib/translations'
import CurrencySymbol from '../../components/ui/CurrencySymbol'
import { showArabicFields as isArabicTenantMarket, getDefaultTaxRate, getTaxRateOptions, getTenantCurrency } from '../../lib/saudiTenant'
import { useLiveTranslation } from '../../lib/liveTranslation'
import Select from 'react-select'
import { getAvailableUomOptions, getDefaultUom, getUomLabel } from '../../lib/uomOptions'
import { normalizeProductType } from '../../lib/productType'
import ProductTypeToggle from '../../components/ui/ProductTypeToggle'
import CategoryCombobox from '../../components/inventory/CategoryCombobox'
import PartnerCombobox from '../../components/inventory/PartnerCombobox'
import ProductImageGallery from '../../components/inventory/ProductImageGallery'
import ProductRelationsEditor from '../../components/inventory/ProductRelationsEditor'
import AttributeExclusionsEditor from '../../components/inventory/AttributeExclusionsEditor'
import TemplatePriceExtrasEditor from '../../components/inventory/TemplatePriceExtrasEditor'
import ProductVariantsGrid from '../../components/inventory/ProductVariantsGrid'
import { formatInvError } from '../../lib/invError'

function AttributeValuesMulti({ attributeId, valueIds, onChange, language }) {
  const ar = language === 'ar'
  const { data } = useQuery({
    queryKey: ['inv-attribute-values', attributeId],
    queryFn: () => api.get(`/stock/attributes/${attributeId}/values`).then((r) => asInvList(r.data)),
    enabled: Boolean(attributeId),
  })
  const values = data || []
  if (!attributeId) {
    return <div className="text-xs text-slate-400">{ar ? 'اختر سمة' : 'Pick attribute'}</div>
  }
  return (
    <div className="flex max-h-24 flex-wrap gap-1 overflow-y-auto">
      {values.map((v) => {
        const on = valueIds.includes(v._id)
        return (
          <button
            key={v._id}
            type="button"
            className={`rounded-lg border px-2 py-0.5 text-xs ${on ? 'border-primary-400 bg-primary-50' : 'border-slate-200'}`}
            onClick={() => onChange(on ? valueIds.filter((x) => x !== v._id) : [...valueIds, v._id])}
          >
            {ar && v.nameAr ? v.nameAr : v.name}
          </button>
        )
      })}
    </div>
  )
}

export default function ProductForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { language } = useSelector((state) => state.ui)
  const { tenant } = useSelector((state) => state.auth)
  const { t } = useTranslation(language)
  const isEdit = Boolean(id)
  const showArabicFields = isArabicTenantMarket(tenant)
  const defaultTaxRate = getDefaultTaxRate(tenant)
  const taxRateOptions = getTaxRateOptions(tenant, language)
  const currency = getTenantCurrency(tenant)

  const { register, handleSubmit, reset, setValue, watch, control } = useForm({
    defaultValues: {
      productType: 'goods',
      costPrice: 0,
      sellingPrice: 0,
      unitOfMeasure: getDefaultUom(tenant),
      taxRate: defaultTaxRate,
      canBeSold: true,
      canBePurchased: true,
      canBeExpensed: false,
      canBeSoldOnPos: true,
      trackInventory: true,
      tracking: 'none',
      useExpirationDate: false,
    },
  })
  const [product, setProduct] = useState(null)
  const [stockWarehouseId, setStockWarehouseId] = useState('')
  const [stockQuantity, setStockQuantity] = useState(0)
  const [stockReorderPoint, setStockReorderPoint] = useState(10)
  const [savingStock, setSavingStock] = useState(false)
  const [isManufactured, setIsManufactured] = useState(false)
  const [bomComponents, setBomComponents] = useState([])
  const uomOptions = getAvailableUomOptions(tenant)
  const selectedProductType = normalizeProductType(watch('productType'))
  const isService = selectedProductType === 'service'
  const canBeSold = watch('canBeSold') !== false
  const canBePurchased = !!watch('canBePurchased')
  const canBeExpensed = !!watch('canBeExpensed')
  const canBeSoldOnPos = !!watch('canBeSoldOnPos')

  const buildPayload = (data) => {
    const payload = { ...data }
    delete payload._id
    delete payload.id
    delete payload.productId
    delete payload.__v
    delete payload.tenantId
    delete payload.createdBy
    delete payload.createdAt
    delete payload.updatedAt
    delete payload.totalStock
    delete payload.availableStock
    delete payload.landedCostHistory
    delete payload.averageLandedCost
    delete payload.predictedDemand

    payload.isManufactured = Boolean(isManufactured)
    payload.productType = normalizeProductType(payload.productType)
    payload.bomComponents = (Array.isArray(bomComponents) ? bomComponents : [])
      .filter((c) => c?.productId)
      .map((c) => ({
        productId: c.productId,
        variantId: c.variantId || undefined,
        quantity: Number.isFinite(Number(c.quantity)) ? Number(c.quantity) : 0,
        notes: c.notes || undefined,
      }))

    payload.attributeLines = (Array.isArray(attributeLines) ? attributeLines : [])
      .filter((l) => l?.attributeId)
      .map((l) => ({
        attributeId: l.attributeId,
        valueIds: l.valueIds || [],
        createVariantMode: l.createVariantMode || 'always',
      }))

    const tags = Array.isArray(payload.tags)
      ? payload.tags
      : (tagInput ? tagInput.split(',').map((t) => t.trim()).filter(Boolean) : [])
    payload.tags = tags

    payload.suppliers = (Array.isArray(productSuppliers) ? productSuppliers : [])
      .filter((s) => s?.supplierId)
      .map((s) => ({
        supplierId: s.supplierId,
        supplierSku: s.supplierSku || undefined,
        cost: Number.isFinite(Number(s.cost)) ? Number(s.cost) : undefined,
        leadTimeDays: Number.isFinite(Number(s.leadTimeDays)) ? Number(s.leadTimeDays) : undefined,
        isPreferred: !!s.isPreferred,
      }))

    payload.documents = (Array.isArray(productDocuments) ? productDocuments : [])
      .filter((d) => d?.name?.trim() && d?.url?.trim())
      .map((d) => ({
        name: String(d.name).trim(),
        url: String(d.url).trim(),
        mimeType: d.mimeType || undefined,
      }))

    if (isEdit) {
      delete payload.stocks
    } else {
      const s0 = payload?.stocks?.[0]
      if (!s0?.warehouseId) {
        delete payload.stocks
      } else {
        payload.stocks = [
          {
            warehouseId: s0.warehouseId,
            quantity: Number.isFinite(Number(s0.quantity)) ? Number(s0.quantity) : 0,
            reorderPoint: Number.isFinite(Number(s0.reorderPoint)) ? Number(s0.reorderPoint) : 10,
          },
        ]
      }
    }

    for (const key of [
      'incomeAccountId',
      'expenseAccountId',
      'stockValuationAccountId',
      'stockInputAccountId',
      'stockOutputAccountId',
      'categoryId',
      'uomId',
    ]) {
      if (payload[key] === '' || payload[key] == null) payload[key] = null
    }

    return payload
  }

  useLiveTranslation({
    control,
    watch,
    setValue,
    sourceField: 'nameEn',
    targetField: 'nameAr',
    sourceLang: 'en',
    targetLang: 'ar',
    enabled: showArabicFields,
  })

  useLiveTranslation({
    control,
    watch,
    setValue,
    sourceField: 'nameAr',
    targetField: 'nameEn',
    sourceLang: 'ar',
    targetLang: 'en',
    enabled: showArabicFields,
  })

  const { data: rawProductData, isLoading, error: productError } = useQuery({
    queryKey: ['product', id],
    queryFn: () => api.get(`/products/${id}`).then(res => res.data),
    enabled: isEdit
  })

  useEffect(() => {
    if (isEdit && rawProductData) {
      const data = rawProductData
      const normalized = {
        ...data,
        nameEn: data?.nameEn ?? data?.name ?? data?.productNameEn ?? data?.productName ?? '',
        nameAr: data?.nameAr ?? data?.nameArabic ?? data?.productNameAr ?? '',
        descriptionEn: data?.descriptionEn ?? data?.description ?? '',
        descriptionAr: data?.descriptionAr ?? '',
        costPrice: data?.costPrice ?? data?.cost ?? 0,
        sellingPrice: data?.sellingPrice ?? data?.price ?? 0,
        taxRate: data?.taxRate ?? 15,
        unitOfMeasure: data?.unitOfMeasure ?? 'PCE',
        productType: normalizeProductType(data?.productType),
      }
      setProduct(normalized)
      reset(normalized)
      setIsManufactured(Boolean(normalized?.isManufactured))
      setBomComponents(
        (Array.isArray(normalized?.bomComponents) ? normalized.bomComponents : []).map((c) => ({
          productId: String(c?.productId?._id || c?.productId || ''),
          variantId: String(c?.variantId?._id || c?.variantId || '') || '',
          quantity: c?.quantity ?? 0,
          notes: c?.notes || ''
        }))
      )
      setAttributeLines(
        (Array.isArray(normalized?.attributeLines) ? normalized.attributeLines : []).map((l) => ({
          attributeId: String(l.attributeId?._id || l.attributeId || ''),
          valueIds: (l.valueIds || []).map((v) => String(v?._id || v)),
          createVariantMode: l.createVariantMode || 'always',
        })),
      )
      setTagInput((normalized?.tags || []).join(', '))
      setProductSuppliers(
        (Array.isArray(normalized?.suppliers) ? normalized.suppliers : []).map((s) => {
          const sid = String(s.supplierId?._id || s.supplierId || '')
          const populated = s.supplierId && typeof s.supplierId === 'object' ? s.supplierId : null
          return {
            supplierId: sid,
            selectedOption: populated,
            supplierSku: s.supplierSku || '',
            cost: s.cost ?? '',
            leadTimeDays: s.leadTimeDays ?? '',
            isPreferred: !!s.isPreferred,
          }
        }),
      )
      setProductDocuments(
        (Array.isArray(normalized?.documents) ? normalized.documents : []).map((d) => ({
          name: d.name || '',
          url: d.url || '',
          mimeType: d.mimeType || '',
        })),
      )
    }
  }, [isEdit, rawProductData, reset])

  const { data: productsList } = useQuery({
    queryKey: ['products-list-lookup'],
    queryFn: () => api.get('/products', { params: { limit: 100, productType: 'goods' } }).then((res) => res.data.products),
    enabled: Boolean(isManufactured),
    staleTime: 5 * 60 * 1000,
  })

  const bomProductOptions = useMemo(() => {
    const rows = Array.isArray(productsList) ? productsList : []
    const currentId = String(id || '')
    return rows.filter((p) => String(p._id) !== currentId)
  }, [productsList, id])

  const { data: warehouses } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => api.get('/warehouses').then(res => res.data)
  })

  const { data: engineStatus } = useQuery({
    queryKey: ['stock-engine-status'],
    queryFn: () => api.get('/stock/engine-status').then((r) => r.data).catch(() => ({ engineEnabled: false })),
  })
  const engineOn = Boolean(engineStatus?.engineEnabled)

  const { data: invSettings } = useQuery({
    queryKey: ['stock-settings'],
    queryFn: () => api.get('/stock/settings').then((r) => r.data),
    staleTime: 60_000,
  })

  const { data: smartButtons } = useQuery({
    queryKey: ['product-smart-buttons', id],
    queryFn: () => api.get(`/stock/products/${id}/smart-buttons`).then((r) => r.data),
    enabled: isEdit && engineOn,
  })

  const { data: invCategories } = useQuery({
    queryKey: ['inv-product-categories'],
    queryFn: () => api.get('/stock/product-categories').then((r) => asInvList(r.data)),
  })

  const { data: invUoms } = useQuery({
    queryKey: ['inv-uoms'],
    queryFn: () => api.get('/stock/uoms').then((r) => asInvList(r.data)),
    enabled: invSettings?.groupUom !== false,
  })

  const { data: invRoutes } = useQuery({
    queryKey: ['inv-routes'],
    queryFn: () => api.get('/stock/routes').then((r) => asInvList(r.data)),
    enabled: invSettings?.groupAdvLocation !== false,
  })
  const { data: supplierOptions } = useQuery({
    queryKey: ['suppliers-lite-product'],
    queryFn: () => api.get('/suppliers', { params: { limit: 200 } }).then((r) => r.data?.suppliers || r.data || []),
    enabled: canBePurchased,
  })
  const supplierById = useMemo(() => {
    const map = new Map()
    for (const s of supplierOptions || []) {
      if (s?._id) map.set(String(s._id), s)
    }
    return map
  }, [supplierOptions])
  const { data: invRules } = useQuery({
    queryKey: ['inv-rules-all'],
    queryFn: () => api.get('/stock/rules').then((r) => asInvList(r.data)),
    enabled: invSettings?.groupAdvLocation !== false,
  })
  const { data: accountingAccounts } = useQuery({
    queryKey: ['accounting-accounts'],
    queryFn: () => api.get('/accounting/accounts').then((r) => r.data || []),
    staleTime: 60_000,
  })

  const [productTab, setProductTab] = useState('general')
  const [attributeLines, setAttributeLines] = useState([])
  const [generateWarning, setGenerateWarning] = useState(null)
  const [tagInput, setTagInput] = useState('')
  const [productSuppliers, setProductSuppliers] = useState([])
  const [productDocuments, setProductDocuments] = useState([])

  const { data: attrsData } = useQuery({
    queryKey: ['inv-attributes'],
    queryFn: () => api.get('/stock/attributes', { params: { active: 'false' } }).then((r) => asInvList(r.data)),
    enabled: invSettings?.groupProductVariant !== false,
  })
  const attrs = attrsData || []
  const activeAccounts = useMemo(
    () => (Array.isArray(accountingAccounts) ? accountingAccounts : []).filter((a) => a?.isActive !== false),
    [accountingAccounts],
  )
  const invRouteRows = Array.isArray(invRoutes) ? invRoutes : []
  const ruleRows = Array.isArray(invRules) ? invRules : []
  const routeActionGroups = useMemo(() => {
    const buy = new Set()
    const manufacture = new Set()
    for (const rule of ruleRows) {
      const rid = String(rule.routeId?._id || rule.routeId || '')
      if (!rid) continue
      if (rule.action === 'buy') buy.add(rid)
      if (rule.action === 'manufacture') manufacture.add(rid)
    }
    return {
      buy: [...buy],
      manufacture: [...manufacture],
    }
  }, [ruleRows])

  const { data: previewCount } = useQuery({
    queryKey: ['variant-preview-count', attributeLines],
    queryFn: () => api.post('/stock/variants/preview-count', { attributeLines }).then((r) => r.data?.count || 0),
    enabled: isEdit && invSettings?.groupProductVariant !== false && attributeLines.some((l) => l.attributeId),
  })

  const runGenerate = async (dryRun) => {
    try {
      const res = await api.post('/stock/variants/generate', {
        productId: id,
        attributeLines,
        dryRun: !!dryRun,
      })
      if (!dryRun) {
        setGenerateWarning(null)
        toast.success(
          language === 'ar'
            ? `أُنشئ ${res.data.created} · أُرشف ${res.data.archived || 0}`
            : `Created ${res.data.created} · archived ${res.data.archived || 0}`,
        )
        queryClient.invalidateQueries({ queryKey: ['inv-variants'] })
        queryClient.invalidateQueries({ queryKey: ['product', id] })
      }
      return res.data
    } catch (e) {
      toast.error(formatInvError(e, language))
      return null
    }
  }

  const warehouseOptions = useMemo(() => {
    return Array.isArray(warehouses) ? warehouses : []
  }, [warehouses])

  useEffect(() => {
    if (!isEdit) return
    if (stockWarehouseId) return
    if (warehouseOptions.length === 0) return

    const firstStockWh = product?.stocks?.[0]?.warehouseId?._id || product?.stocks?.[0]?.warehouseId
    const nextId = String(firstStockWh || warehouseOptions[0]._id || '')
    if (nextId) setStockWarehouseId(nextId)
  }, [isEdit, product, stockWarehouseId, warehouseOptions])

  useEffect(() => {
    if (!isEdit) return
    if (!stockWarehouseId) return

    const stocks = Array.isArray(product?.stocks) ? product.stocks : []
    const s = stocks.find((x) => String(x?.warehouseId?._id || x?.warehouseId) === String(stockWarehouseId))
    setStockQuantity(Number(s?.quantity || 0))
    setStockReorderPoint(Number.isFinite(Number(s?.reorderPoint)) ? Number(s.reorderPoint) : 10)
  }, [isEdit, product, stockWarehouseId])

  useEffect(() => {
    if (!canBeSold && canBeSoldOnPos) {
      setValue('canBeSoldOnPos', false, { shouldDirty: true })
    }
  }, [canBeSold, canBeSoldOnPos, setValue])

  const visibleTabs = useMemo(() => ([
    { id: 'general', en: 'General', ar: 'عام' },
    { id: 'sales', en: 'Sales', ar: 'المبيعات', hide: !canBeSold },
    { id: 'purchase', en: 'Purchase', ar: 'الشراء', hide: !canBePurchased },
    { id: 'expense', en: 'Expense', ar: 'المصروفات', hide: !canBeExpensed },
    { id: 'inventory', en: 'Inventory', ar: 'المخزون', hide: isService },
    { id: 'variants', en: 'Attributes & Variants', ar: 'السمات والمتغيرات', hide: invSettings?.groupProductVariant === false },
    { id: 'documents', en: 'Documents', ar: 'المستندات' },
    { id: 'accounting', en: 'Accounting', ar: 'المحاسبة' },
  ].filter((t) => !t.hide)), [canBeSold, canBePurchased, canBeExpensed, isService, invSettings?.groupProductVariant])

  useEffect(() => {
    if (!visibleTabs.some((t) => t.id === productTab)) {
      setProductTab(visibleTabs[0]?.id || 'general')
    }
  }, [productTab, visibleTabs])

  const selectedRouteIds = (watch('routeIds') || []).map(String)
  const selectedSupplyPreset = useMemo(() => {
    const buyIds = routeActionGroups.buy
    const manufactureIds = routeActionGroups.manufacture
    const hasBuy = buyIds.some((id) => selectedRouteIds.includes(id))
    const hasManufacture = manufactureIds.some((id) => selectedRouteIds.includes(id))
    if (hasBuy && hasManufacture) return 'both'
    if (hasBuy) return 'buy'
    if (hasManufacture) return 'manufacture'
    return 'custom'
  }, [routeActionGroups, selectedRouteIds])

  const applySupplyPreset = (preset) => {
    if (preset === 'buy') {
      setValue('routeIds', routeActionGroups.buy, { shouldDirty: true })
      return
    }
    if (preset === 'manufacture') {
      setValue('routeIds', routeActionGroups.manufacture, { shouldDirty: true })
      return
    }
    if (preset === 'both') {
      setValue('routeIds', [...new Set([...routeActionGroups.buy, ...routeActionGroups.manufacture])], { shouldDirty: true })
      return
    }
  }

  const mutation = useMutation({
    mutationFn: (data) => isEdit ? api.put(`/products/${id}`, data) : api.post('/products', data),
    onSuccess: () => {
      toast.success(isEdit ? (language === 'ar' ? 'تم تحديث المنتج' : 'Product updated') : (language === 'ar' ? 'تم إضافة المنتج' : 'Product added'))
      queryClient.invalidateQueries(['products'])
      queryClient.invalidateQueries(['products-stats'])
      navigate('/app/dashboard/inventory/products')
    },
    onError: (err) => toast.error(formatInvError(err, language) || 'Error saving product')
  })

  const saveStock = async () => {
    if (!isEdit) return
    if (!stockWarehouseId) return
    try {
      setSavingStock(true)
      if (engineOn) {
        await api.post(`/stock/report/stock/${id}/adjust`, {
          warehouseId: stockWarehouseId,
          onHand: stockQuantity,
          reason: 'Product form adjustment',
        })
        toast.success(language === 'ar' ? 'تم تسوية المخزون عبر المحرك' : 'Stock adjusted via inventory engine')
        queryClient.invalidateQueries(['product', id])
        queryClient.invalidateQueries(['products'])
        queryClient.invalidateQueries(['stock-report'])
        const refreshed = await api.get(`/products/${id}`).then((r) => r.data)
        setProduct(refreshed)
        reset(refreshed)
        queryClient.setQueryData(['product', id], refreshed)
        return
      }
      const res = await api.post(`/products/${id}/stock/set`, {
        warehouseId: stockWarehouseId,
        quantity: stockQuantity,
        reorderPoint: stockReorderPoint,
      })
      const updated = res?.data
      if (updated) {
        setProduct(updated)
        reset(updated)
        queryClient.setQueryData(['product', id], updated)
      }
      queryClient.invalidateQueries(['products'])
      queryClient.invalidateQueries(['products-stats'])
      toast.success(language === 'ar' ? 'تم تحديث المخزون' : 'Stock updated')
    } catch (e) {
      toast.error(formatInvError(e, language) || (language === 'ar' ? 'فشل تحديث المخزون' : 'Failed to update stock'))
    } finally {
      setSavingStock(false)
    }
  }

  if (isEdit && isLoading) {
    return <div className="flex justify-center p-8"><div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>
  }

  if (isEdit && productError) {
    const msg = formatInvError(productError, language)
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="btn btn-ghost btn-icon"><ArrowLeft className="w-5 h-5" /></button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {language === 'ar' ? 'تعديل منتج' : 'Edit Product'}
            </h1>
          </div>
        </div>
        <div className="card p-6 text-red-600">{msg}</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="btn btn-ghost btn-icon"><ArrowLeft className="w-5 h-5" /></button>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-slate-500">{language === 'ar' ? 'المنتجات' : 'Products'}{isEdit ? ` / ${product?.nameEn || product?.sku || ''}` : ''}</p>
          <h1 className="flex flex-wrap items-baseline gap-3 text-2xl font-bold text-gray-900 dark:text-white">
            <span>
              {isEdit ? (language === 'ar' ? 'تعديل منتج' : 'Edit Product') : (language === 'ar' ? 'إضافة منتج' : 'Add Product')}
            </span>
            {isEdit && product?.productId && (
              <span className="font-mono text-base font-semibold tracking-wide text-emerald-700 dark:text-emerald-400">
                {product.productId}
              </span>
            )}
            {isEdit && product?.nameEn && (
              <span className="truncate text-lg font-medium text-slate-500">{product.nameEn}</span>
            )}
          </h1>
        </div>
      </div>

      {isEdit && engineOn && smartButtons && (
        <div className="flex flex-wrap gap-2">
          {[
            { label: language === 'ar' ? 'بالمخزن' : 'On Hand', value: smartButtons.onHand, to: '/app/dashboard/inventory/physical' },
            { label: language === 'ar' ? 'المتوقع' : 'Forecasted', value: smartButtons.forecasted, to: '/app/dashboard/inventory/report/forecast' },
            { label: language === 'ar' ? 'إعادة الطلب' : 'Reordering', value: smartButtons.reorderRules, to: '/app/dashboard/inventory/reordering-rules' },
            { label: language === 'ar' ? 'الدفعات' : 'Lots', value: smartButtons.lots, to: '/app/dashboard/inventory/lots', hide: !(invSettings?.groupProductionLot || invSettings?.groupStockTrackingLot) },
            { label: language === 'ar' ? 'الحركات' : 'Moves', value: smartButtons.moves, to: `/app/dashboard/inventory/moves?productId=${id}` },
            { label: language === 'ar' ? 'التخزين' : 'Putaway', value: smartButtons.putawayRules, to: '/app/dashboard/inventory/putaway', hide: invSettings?.groupPutawayRules === false },
            { label: language === 'ar' ? 'المتغيرات' : 'Variants', value: smartButtons.variants, to: `/app/dashboard/inventory/variants?productId=${id}`, hide: invSettings?.groupProductVariant === false },
          ].filter((b) => !b.hide).map((b) => (
            <button
              key={b.label}
              type="button"
              className="rounded-xl border border-slate-200/80 bg-white px-3 py-2 text-start shadow-sm hover:border-primary-300 dark:border-dark-600 dark:bg-dark-800"
              onClick={() => navigate(b.to)}
            >
              <div className="text-lg font-semibold tabular-nums text-slate-900 dark:text-white">{b.value ?? 0}</div>
              <div className="text-[11px] uppercase tracking-wide text-slate-500">{b.label}</div>
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-4 rounded-xl border border-slate-200/80 bg-white px-4 py-3 text-sm dark:border-dark-600 dark:bg-dark-800">
        <label className="flex items-center gap-2">
          <input type="checkbox" {...register('canBeSold')} className="rounded border-gray-300 text-primary-600" />
          {language === 'ar' ? 'مبيعات' : 'Sales'}
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" {...register('canBePurchased')} className="rounded border-gray-300 text-primary-600" />
          {language === 'ar' ? 'مشتريات' : 'Purchase'}
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" {...register('canBeExpensed')} className="rounded border-gray-300 text-primary-600" />
          {language === 'ar' ? 'مصروفات' : 'Expense'}
        </label>
        {canBeSold && (
          <label className="ms-2 flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 dark:border-dark-600 dark:text-slate-300">
            <input type="checkbox" {...register('canBeSoldOnPos')} className="rounded border-gray-300 text-primary-600" />
            {language === 'ar' ? 'متاح في نقطة البيع' : 'Available in POS'}
          </label>
        )}
      </div>

      <div className="flex flex-wrap gap-1">
        {visibleTabs.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
              productTab === t.id ? 'bg-primary-50 text-primary-700 dark:bg-primary-950/40' : 'text-slate-500'
            }`}
            onClick={() => setProductTab(t.id)}
          >
            {language === 'ar' ? t.ar : t.en}
          </button>
        ))}
      </div>

      <form
        onSubmit={handleSubmit((data) => {
          const payload = buildPayload(data)
          const warnings = []
          const cat = (Array.isArray(invCategories) ? invCategories : []).find(
            (c) => String(c._id) === String(payload.categoryId || ''),
          )
          const hasIncome = !!(payload.incomeAccountId || cat?.incomeAccountId)
          const hasExpense = !!(payload.expenseAccountId || cat?.expenseAccountId)
          if (payload.canBeSold !== false && !hasIncome) {
            warnings.push(language === 'ar'
              ? 'المنتج القابل للبيع يحتاج حساب إيراد على المنتج أو الفئة'
              : 'Sold products require an income account on the product or category')
          }
          if ((payload.canBePurchased || payload.canBeExpensed) && !hasExpense) {
            warnings.push(language === 'ar'
              ? 'المنتج القابل للشراء/المصروف يحتاج حساب مصروف على المنتج أو الفئة'
              : 'Purchased/expensed products require an expense account on the product or category')
          }
          if (warnings.length) {
            toast.error(warnings.join('\n'))
            return
          }
          mutation.mutate(payload)
        })}
        className="space-y-6"
      >
        {(productTab === 'general') && (
        <>
        {/* Basic Info */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg"><Package className="w-5 h-5 text-primary-600" /></div>
            <h3 className="text-lg font-semibold">{language === 'ar' ? 'معلومات المنتج' : 'Product Information'}</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className={showArabicFields ? "md:col-span-1 lg:col-span-1" : "md:col-span-2 lg:col-span-3"}>
              <div className="mb-1.5 flex items-center gap-2" dir="ltr">
                <label className="label !mb-0 min-w-0 flex-1">
                  {showArabicFields ? `${t('productName')} (EN) *` : `${t('productName')} *`}
                </label>
                <ProductTypeToggle
                  value={selectedProductType}
                  onChange={(next) => setValue('productType', next, { shouldDirty: true, shouldTouch: true })}
                  language={language}
                />
              </div>
              <input {...register('nameEn', { required: true })} className="input" />
              <input type="hidden" {...register('productType')} />
              {isService ? (
                <p className="mt-1 text-[11px] text-gray-400">
                  {language === 'ar' ? 'الخدمات لا تُخصم من المخزون' : 'Services are not stock-tracked'}
                </p>
              ) : null}
            </div>
            {showArabicFields ? (
              <div className="md:col-span-1 lg:col-span-2">
                <label className="label">{t('productName')} (AR)</label>
                <input {...register('nameAr')} className="input" dir="rtl" />
              </div>
            ) : (
              <input type="hidden" {...register('nameAr')} />
            )}
            <div>
              <label className="label">{t('sku')} *</label>
              <input {...register('sku', { required: true })} className="input" placeholder="SKU-001" />
              <p className="mt-1 text-[11px] text-slate-400">
                {language === 'ar'
                  ? 'مرجع داخلي قابل للتعديل (SKU).'
                  : 'User-editable internal reference (SKU / default code).'}
              </p>
            </div>
            <div>
              <label className="label">{t('barcode')}</label>
              <input {...register('barcode')} className="input" placeholder="1234567890123" />
              <p className="mt-1 text-[11px] text-slate-400">
                {language === 'ar'
                  ? 'مفتاح المسح الضوئي — منفصل عن معرّف المنتج وSKU.'
                  : 'Scan key — distinct from Product ID and SKU.'}
              </p>
            </div>
            {isEdit && product?.productId && (
              <div>
                <label className="label">{language === 'ar' ? 'معرّف المنتج' : 'Product ID'}</label>
                <input className="input font-mono" value={product.productId} readOnly disabled />
                <p className="mt-1 text-[11px] text-slate-400">
                  {language === 'ar'
                    ? 'رمز ثابت تلقائي (مثل P00001) — لا يُغيَّر. منفصل عن SKU والباركود.'
                    : 'Immutable sequential code (e.g. P00001) — not editable. Distinct from SKU and barcode.'}
                </p>
              </div>
            )}
            {!isEdit && (
              <div>
                <label className="label">{language === 'ar' ? 'معرّف المنتج' : 'Product ID'}</label>
                <input
                  className="input font-mono text-slate-400"
                  value={language === 'ar' ? 'يُنشأ عند الحفظ (P00001…)' : 'Assigned on save (P00001…)'}
                  readOnly
                  disabled
                />
                <p className="mt-1 text-[11px] text-slate-400">
                  {language === 'ar'
                    ? 'ثلاثة حقول مختلفة: معرّف المنتج · SKU · باركود.'
                    : 'Three different jobs: Product ID · SKU · Barcode.'}
                </p>
              </div>
            )}
            <div>
              <label className="label">{language === 'ar' ? 'فئة المخزون' : 'Inventory category'}</label>
              <CategoryCombobox
                value={watch('categoryId') || ''}
                onChange={(id, cat) => {
                  setValue('categoryId', id || '', { shouldDirty: true })
                  if (cat?.legacyName || cat?.name) {
                    setValue('category', cat.legacyName || cat.name, { shouldDirty: true })
                  }
                }}
                language={language}
              />
              <input type="hidden" {...register('categoryId')} />
              <input type="hidden" {...register('category')} />
            </div>
            <div>
              <label className="label">{language === 'ar' ? 'الوسوم' : 'Tags'}</label>
              <input
                className="input"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                placeholder={language === 'ar' ? 'مفصولة بفاصلة' : 'Comma-separated'}
              />
            </div>
            <div>
              <label className="label">
                <span className="inline-flex items-center gap-1.5">
                  {t('sellingPrice')}
                  <CurrencySymbol currency={currency} />
                </span>
              </label>
              <input type="number" step="0.01" {...register('sellingPrice', { valueAsNumber: true })} className="input" />
            </div>
            <div>
              <label className="label">
                <span className="inline-flex items-center gap-1.5">
                  {t('costPrice')}
                  <CurrencySymbol currency={currency} />
                </span>
              </label>
              <input type="number" step="0.01" {...register('costPrice', { valueAsNumber: true })} className="input" />
            </div>
            <div>
              <label className="label">{language === 'ar' ? 'وحدة القياس' : 'Unit of Measure'}</label>
              {invSettings?.groupUom !== false && Array.isArray(invUoms) && invUoms.length > 0 ? (
                <select {...register('uomId')} className="select">
                  <option value="">—</option>
                  {invUoms.map((u) => (
                    <option key={u._id} value={u._id}>{u.name}</option>
                  ))}
                </select>
              ) : (
                <Select
                  inputId="unitOfMeasure-general"
                  options={[
                    { value: '', label: language === 'ar' ? 'بدون وحدة' : 'None' },
                    ...uomOptions.map((u) => ({ value: u.code, label: language === 'ar' ? u.labelAr : u.labelEn })),
                  ]}
                  value={watch('unitOfMeasure')
                    ? (uomOptions.find((u) => u.code === watch('unitOfMeasure'))
                      ? {
                        value: watch('unitOfMeasure'),
                        label: language === 'ar'
                          ? uomOptions.find((u) => u.code === watch('unitOfMeasure'))?.labelAr
                          : uomOptions.find((u) => u.code === watch('unitOfMeasure'))?.labelEn,
                      }
                      : { value: watch('unitOfMeasure'), label: watch('unitOfMeasure') })
                    : { value: '', label: language === 'ar' ? 'بدون وحدة' : 'None' }}
                  onChange={(selected) => setValue('unitOfMeasure', selected?.value || '', { shouldDirty: true })}
                  isClearable
                  isSearchable
                  styles={{
                    control: (base) => ({
                      ...base,
                      borderRadius: '0.75rem',
                      borderColor: '#e5e7eb',
                      padding: '0.125rem',
                      minHeight: '42px',
                    }),
                  }}
                />
              )}
            </div>
            <div className="md:col-span-2 lg:col-span-3">
              <label className="label">{language === 'ar' ? 'الوصف (EN)' : 'Description (EN)'}</label>
              <textarea {...register('descriptionEn')} className="input" rows={2} />
            </div>
            {showArabicFields && (
              <div className="md:col-span-2 lg:col-span-3">
                <label className="label">{language === 'ar' ? 'الوصف (AR)' : 'Description (AR)'}</label>
                <textarea {...register('descriptionAr')} className="input" rows={2} dir="rtl" />
              </div>
            )}
            <div className="md:col-span-2 lg:col-span-3">
              <label className="label">{language === 'ar' ? 'ملاحظات داخلية' : 'Internal notes'}</label>
              <textarea {...register('internalNotes')} className="input min-h-[3rem]" rows={2} />
            </div>
            <div className="md:col-span-2 lg:col-span-3">
              <label className="label mb-2 block">{language === 'ar' ? 'الصور' : 'Images'}</label>
              <ProductImageGallery
                productId={isEdit ? id : null}
                images={product?.images || rawProductData?.images || []}
                language={language}
              />
            </div>
          </div>
        </motion.div>

        </>
        )}

        {productTab === 'sales' && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="card p-6">
          <div className="mb-6 flex items-center gap-3">
            <div className="rounded-lg bg-emerald-100 p-2 dark:bg-emerald-900/30"><DollarSign className="h-5 w-5 text-emerald-600" /></div>
            <h3 className="text-lg font-semibold">{language === 'ar' ? 'المبيعات' : 'Sales'}</h3>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label className="label">
                <span className="inline-flex items-center gap-1.5">
                  {t('sellingPrice')} *
                  <CurrencySymbol currency={currency} />
                </span>
              </label>
              <input type="number" step="0.01" {...register('sellingPrice', { valueAsNumber: true, required: canBeSold })} className="input" />
            </div>
            <div>
              <label className="label">{language === 'ar' ? 'نسبة الضريبة' : 'Tax Rate'} %</label>
              <select {...register('taxRate', { valueAsNumber: true })} className="select">
                {taxRateOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-3">
              <label className="label">{language === 'ar' ? 'وصف المبيعات' : 'Sales description'}</label>
              <textarea {...register('salesDescription')} className="input min-h-[4rem]" rows={2} />
            </div>
            <div>
              <label className="label">{language === 'ar' ? 'الحد الأدنى للبيع' : 'Min sale qty'}</label>
              <input type="number" step="0.01" {...register('minSaleQty', { valueAsNumber: true })} className="input" />
            </div>
            <div>
              <label className="label">{language === 'ar' ? 'مضاعف البيع' : 'Sale multiple'}</label>
              <input type="number" step="1" {...register('saleMultiple', { valueAsNumber: true })} className="input" />
            </div>
            <div>
              <label className="label">{language === 'ar' ? 'سياسة الفوترة' : 'Invoicing policy'}</label>
              <select {...register('invoicingPolicy')} className="select">
                <option value="ordered">{language === 'ar' ? 'عند الطلب' : 'On ordered qty'}</option>
                <option value="delivered">{language === 'ar' ? 'عند التسليم' : 'On delivered qty'}</option>
              </select>
            </div>
            <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 px-4 py-3 text-sm text-slate-600 dark:border-dark-600 dark:bg-dark-800/60 dark:text-slate-300">
              <div className="font-medium text-slate-900 dark:text-white">{language === 'ar' ? 'نقطة البيع' : 'Point of Sale'}</div>
              <div className="mt-1 text-xs">
                {canBeSoldOnPos
                  ? (language === 'ar' ? 'هذا المنتج متاح في شاشة نقطة البيع.' : 'This product will be available in the POS catalog.')
                  : (language === 'ar' ? 'فعّل خيار نقطة البيع من أعلى النموذج.' : 'Enable POS availability from the top behavior bar.')}
              </div>
            </div>
          </div>
          <ProductRelationsEditor productId={isEdit ? id : null} language={language} />
        </motion.div>
        )}

        {(productTab === 'inventory' || productTab === 'purchase' || productTab === 'expense') && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="card p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg"><Warehouse className="w-5 h-5 text-blue-600" /></div>
            <h3 className="text-lg font-semibold">
              {productTab === 'purchase'
                ? (language === 'ar' ? 'الشراء' : 'Purchase')
                : productTab === 'expense'
                  ? (language === 'ar' ? 'المصروفات' : 'Expense')
                : (language === 'ar' ? 'المخزون' : 'Inventory')}
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(productTab === 'purchase' || productTab === 'expense') && (
              <div>
                <label className="label">
                  <span className="inline-flex items-center gap-1.5">
                    {t('costPrice')}
                    <CurrencySymbol currency={currency} />
                  </span>
                </label>
                <input type="number" step="0.01" {...register('costPrice', { valueAsNumber: true })} className="input" />
              </div>
            )}
            {productTab === 'purchase' && (
              <>
                <div className="md:col-span-3">
                  <label className="label">{language === 'ar' ? 'وصف الشراء' : 'Purchase description'}</label>
                  <textarea {...register('purchaseDescription')} className="input min-h-[4rem]" rows={2} />
                </div>
                <div>
                  <label className="label">{language === 'ar' ? 'سياسة التحكم' : 'Control policy'}</label>
                  <select {...register('controlPolicy')} className="select">
                    <option value="ordered">{language === 'ar' ? 'عند الطلب' : 'Bill on ordered'}</option>
                    <option value="received">{language === 'ar' ? 'عند الاستلام' : 'Bill on received'}</option>
                  </select>
                </div>
                <div>
                  <label className="label">{language === 'ar' ? 'أيام للشراء' : 'Days to purchase'}</label>
                  <input type="number" {...register('daysToPurchase', { valueAsNumber: true })} className="input" />
                </div>
                <div>
                  <label className="label">{language === 'ar' ? 'رمز HS' : 'HS code'}</label>
                  <input {...register('hsCode')} className="input" />
                </div>
                <div>
                  <label className="label">{language === 'ar' ? 'بلد المنشأ' : 'Country of origin'}</label>
                  <input {...register('countryOfOrigin')} className="input" />
                </div>
                <div className="md:col-span-3">
                  <div className="mb-2 flex items-center justify-between">
                    <label className="label !mb-0">{language === 'ar' ? 'الموردون' : 'Vendors'}</label>
                    <button
                      type="button"
                      className="btn btn-secondary btn-xs"
                      onClick={() => setProductSuppliers((rows) => [...rows, { supplierId: '', selectedOption: null, supplierSku: '', cost: '', leadTimeDays: '', isPreferred: false }])}
                    >
                      {language === 'ar' ? '+ مورد' : '+ Vendor'}
                    </button>
                  </div>
                  {productSuppliers.length === 0 ? (
                    <p className="text-xs text-slate-400">{language === 'ar' ? 'لا موردين' : 'No vendors linked'}</p>
                  ) : (
                    <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-dark-600">
                      <table className="w-full min-w-[720px] text-sm">
                        <thead className="bg-slate-50 text-xs uppercase dark:bg-dark-800">
                          <tr>
                            <th className="min-w-[150px] px-2 py-2 text-start">{language === 'ar' ? 'المورد' : 'Supplier'}</th>
                            <th className="min-w-[150px] px-2 py-2">{language === 'ar' ? 'SKU المورد' : 'Vendor SKU'}</th>
                            <th className="min-w-[150px] px-2 py-2">{language === 'ar' ? 'التكلفة' : 'Cost'}</th>
                            <th className="min-w-[150px] px-2 py-2">{language === 'ar' ? 'Lead time' : 'Lead (d)'}</th>
                            <th className="min-w-[150px] px-2 py-2">{language === 'ar' ? 'مفضل' : 'Pref.'}</th>
                            <th />
                          </tr>
                        </thead>
                        <tbody>
                          {productSuppliers.map((row, idx) => (
                            <tr key={idx} className="border-t border-slate-100">
                              <td className="min-w-[180px] px-2 py-1">
                                <PartnerCombobox
                                  role="vendor"
                                  value={row.supplierId}
                                  selectedOption={row.selectedOption || supplierById.get(String(row.supplierId)) || null}
                                  ar={language === 'ar'}
                                  language={language}
                                  onChange={(id, opt) => setProductSuppliers((rows) => rows.map((r, i) => (
                                    i === idx
                                      ? { ...r, supplierId: id || '', selectedOption: opt || null }
                                      : r
                                  )))}
                                />
                              </td>
                              <td className="px-2 py-1">
                                <input className="input input-sm" value={row.supplierSku} onChange={(e) => setProductSuppliers((rows) => rows.map((r, i) => (i === idx ? { ...r, supplierSku: e.target.value } : r)))} />
                              </td>
                              <td className="px-2 py-1">
                                <input type="number" className="input input-sm w-24" value={row.cost} onChange={(e) => setProductSuppliers((rows) => rows.map((r, i) => (i === idx ? { ...r, cost: e.target.value } : r)))} />
                              </td>
                              <td className="px-2 py-1">
                                <input type="number" className="input input-sm w-20" value={row.leadTimeDays} onChange={(e) => setProductSuppliers((rows) => rows.map((r, i) => (i === idx ? { ...r, leadTimeDays: e.target.value } : r)))} />
                              </td>
                              <td className="px-2 py-1 text-center">
                                <input type="checkbox" checked={!!row.isPreferred} onChange={(e) => setProductSuppliers((rows) => rows.map((r, i) => (i === idx ? { ...r, isPreferred: e.target.checked } : r)))} />
                              </td>
                              <td className="px-2 py-1">
                                <button type="button" className="text-rose-600 text-xs" onClick={() => setProductSuppliers((rows) => rows.filter((_, i) => i !== idx))}>×</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}
            {!isService && productTab === 'inventory' && (
              <>
                <div className="md:col-span-3 flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" {...register('trackInventory')} className="rounded border-gray-300 text-primary-600" />
                    {language === 'ar' ? 'تتبع المخزون' : 'Track Inventory'}
                  </label>
                </div>
                {(invSettings?.groupProductionLot || invSettings?.groupStockTrackingLot) && (
                  <div>
                    <label className="label">{language === 'ar' ? 'التتبع' : 'Tracking'}</label>
                    <select {...register('tracking')} className="select">
                      <option value="none">{language === 'ar' ? 'بدون' : 'No tracking'}</option>
                      <option value="lot">{language === 'ar' ? 'بالدفعات' : 'By Lots'}</option>
                      <option value="serial">{language === 'ar' ? 'تسلسلي فريد' : 'By Unique Serial'}</option>
                    </select>
                  </div>
                )}
                {invSettings?.moduleProductExpiry && (
                  <>
                    <div className="flex items-center pt-6">
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" {...register('useExpirationDate')} className="rounded border-gray-300 text-primary-600" />
                        {language === 'ar' ? 'تواريخ الصلاحية' : 'Expiration dates'}
                      </label>
                    </div>
                    <div>
                      <label className="label">{language === 'ar' ? 'أيام الانتهاء' : 'Expiration days'}</label>
                      <input type="number" className="input" {...register('expirationDays', { valueAsNumber: true })} />
                    </div>
                    <div>
                      <label className="label">{language === 'ar' ? 'أيام التنبيه' : 'Alert days'}</label>
                      <input type="number" className="input" {...register('alertDays', { valueAsNumber: true })} />
                    </div>
                  </>
                )}
                <div>
                  <label className="label">{language === 'ar' ? 'الوزن (كغ)' : 'Weight (kg)'}</label>
                  <input type="number" step="0.001" {...register('weight', { valueAsNumber: true })} className="input" />
                </div>
                <div>
                  <label className="label">{language === 'ar' ? 'الحجم' : 'Volume'}</label>
                  <input type="number" step="0.001" {...register('volume', { valueAsNumber: true })} className="input" />
                </div>
                {invSettings?.groupAdvLocation !== false && (
                  <div className="md:col-span-3 space-y-3">
                    <div>
                      <label className="label">{language === 'ar' ? 'مصدر التزويد' : 'Supply Route'}</label>
                      <div className="flex flex-wrap gap-2">
                        {[
                          { id: 'buy', en: 'Buy', ar: 'شراء', disabled: routeActionGroups.buy.length === 0 },
                          { id: 'manufacture', en: 'Manufacture', ar: 'تصنيع', disabled: routeActionGroups.manufacture.length === 0 },
                          { id: 'both', en: 'Buy + Manufacture', ar: 'شراء + تصنيع', disabled: routeActionGroups.buy.length === 0 || routeActionGroups.manufacture.length === 0 },
                        ].map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            disabled={opt.disabled}
                            onClick={() => applySupplyPreset(opt.id)}
                            className={`rounded-xl border px-3 py-2 text-xs font-medium transition ${
                              selectedSupplyPreset === opt.id
                                ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-950/30'
                                : 'border-slate-200 text-slate-600 dark:border-dark-600 dark:text-slate-300'
                            } ${opt.disabled ? 'opacity-40' : ''}`}
                          >
                            {language === 'ar' ? opt.ar : opt.en}
                          </button>
                        ))}
                      </div>
                      <p className="mt-1 text-[11px] text-slate-400">
                        {language === 'ar'
                          ? 'حدّد هل يُجلب هذا المنتج بالشراء أو بالتصنيع. ويمكن ضبط المسارات التفصيلية أسفل ذلك.'
                          : 'Choose whether this product is supplied by buying or by manufacturing, then refine with detailed routes below.'}
                      </p>
                    </div>
                    <div>
                    <label className="label">{language === 'ar' ? 'المسارات' : 'Routes'}</label>
                    <select
                      multiple
                      className="select min-h-[5rem]"
                      value={(watch('routeIds') || []).map(String)}
                      onChange={(e) => {
                        const vals = Array.from(e.target.selectedOptions).map((o) => o.value)
                        setValue('routeIds', vals, { shouldDirty: true })
                      }}
                    >
                      {invRouteRows.map((r) => (
                        <option key={r._id} value={r._id}>{r.name}</option>
                      ))}
                    </select>
                    </div>
                  </div>
                )}
              </>
            )}
            {productTab === 'expense' && (
              <div className="md:col-span-2 rounded-xl border border-amber-100 bg-amber-50/70 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-100">
                {language === 'ar'
                  ? 'هذا التبويب للمواد أو الخدمات التي تُشترى كمصروفات تشغيلية وتحتاج تعيين حساب مصروف واضح.'
                  : 'Use this tab for products or services primarily handled as operating expenses with a dedicated expense account.'}
              </div>
            )}
            <div>
              <label className="label">{language === 'ar' ? 'وحدة القياس (اختياري)' : 'Unit of Measure (Optional)'}</label>
              {invSettings?.groupUom !== false && Array.isArray(invUoms) && invUoms.length > 0 ? (
                <select {...register('uomId')} className="select">
                  <option value="">—</option>
                  {invUoms.map((u) => (
                    <option key={u._id} value={u._id}>{u.name}</option>
                  ))}
                </select>
              ) : (
                <Select
                  inputId="unitOfMeasure"
                  options={[
                    { value: '', label: language === 'ar' ? 'بدون وحدة (اختياري)' : 'None (Optional)' },
                    ...uomOptions.map(u => ({ value: u.code, label: language === 'ar' ? u.labelAr : u.labelEn }))
                  ]}
                  value={watch('unitOfMeasure') ? (uomOptions.find(u => u.code === watch('unitOfMeasure')) ? { value: watch('unitOfMeasure'), label: language === 'ar' ? uomOptions.find(u => u.code === watch('unitOfMeasure'))?.labelAr : uomOptions.find(u => u.code === watch('unitOfMeasure'))?.labelEn } : { value: watch('unitOfMeasure'), label: watch('unitOfMeasure') }) : { value: '', label: language === 'ar' ? 'بدون وحدة (اختياري)' : 'None (Optional)' }}
                  onChange={(selected) => setValue('unitOfMeasure', selected?.value || '')}
                  isClearable
                  isSearchable
                  styles={{
                    control: (base) => ({ ...base, borderRadius: '0.75rem', borderColor: '#e5e7eb', padding: '0.125rem', minHeight: '42px' })
                  }}
                />
              )}
              <input type="hidden" {...register('unitOfMeasure')} />
            </div>
            {productTab === 'purchase' && invSettings?.groupUom !== false && (
              <div>
                <label className="label">{language === 'ar' ? 'وحدة الشراء' : 'Purchase UoM'}</label>
                <select {...register('purchaseUomId')} className="select">
                  <option value="">—</option>
                  {(Array.isArray(invUoms) ? invUoms : []).map((u) => (
                    <option key={u._id} value={u._id}>{u.name}</option>
                  ))}
                </select>
              </div>
            )}
            {!isService && (
            <div className="flex items-center pt-2 md:pt-6">
              <label className="flex items-center gap-3 cursor-pointer select-none p-3 rounded-xl border border-gray-200 dark:border-dark-700 hover:bg-gray-50 dark:hover:bg-dark-700/50 transition-colors w-full">
                <input
                  type="checkbox"
                  {...register('allowNegativeStock')}
                  className="w-5 h-5 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                />
                <div>
                  <span className="text-sm font-semibold text-gray-900 dark:text-white block">
                    {language === 'ar' ? 'السماح بالمخزون السالب' : 'Allow Negative Stock'}
                  </span>
                  <p className="text-xs text-gray-500">
                    {language === 'ar' ? 'البيع والفواتير عند نفاد المخزون' : 'Allow sale & invoices below 0 stock'}
                  </p>
                </div>
              </label>
            </div>
            )}
            {!isService && !isEdit && warehouseOptions.length > 0 && productTab === 'inventory' && (
              <>
                <div>
                  <label className="label">{language === 'ar' ? 'المستودع' : 'Warehouse'}</label>
                  <select {...register('stocks.0.warehouseId')} className="select">
                    {warehouseOptions.map(w => <option key={w._id} value={w._id}>{language === 'ar' ? w.nameAr || w.nameEn : w.nameEn}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">{language === 'ar' ? 'الكمية الأولية' : 'Initial Quantity'}</label>
                  <input
                    type="number"
                    {...register('stocks.0.quantity', { valueAsNumber: true })}
                    className="input"
                    defaultValue={0}
                  />
                </div>
              </>
            )}

            {isService && (
              <div className="md:col-span-2 rounded-xl border border-sky-100 bg-sky-50/70 px-4 py-3 text-sm text-sky-900">
                {language === 'ar'
                  ? 'هذه خدمة — لا يُطلب مخزون ولا يُخصم عند إصدار الفواتير.'
                  : 'This is a service — stock is not required and invoices will not decrement inventory.'}
              </div>
            )}
            {!isService && isEdit && productTab === 'inventory' && (
              <div className="md:col-span-3 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm text-slate-500">
                    {engineOn
                      ? (language === 'ar'
                        ? 'محرك المخزون مفعّل — التسوية تنشئ حركة تعديل (لا كتابة مباشرة).'
                        : 'Engine on — this creates an adjustment transfer (no direct write).')
                      : (language === 'ar' ? 'تحديث كمية المخزون للمستودع' : 'Update on-hand quantity per warehouse')}
                  </p>
                  {engineOn && (
                    <button
                      type="button"
                      className="text-xs font-semibold text-teal-700 underline dark:text-teal-300"
                      onClick={() => navigate('/app/dashboard/inventory/stock')}
                    >
                      {language === 'ar' ? 'تقرير المخزون' : 'Stock report'}
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="label">{language === 'ar' ? 'المستودع' : 'Warehouse'}</label>
                    <select
                      value={stockWarehouseId}
                      onChange={(e) => setStockWarehouseId(e.target.value)}
                      className="select"
                      disabled={warehouseOptions.length === 0}
                    >
                      {warehouseOptions.map((w) => (
                        <option key={w._id} value={w._id}>
                          {language === 'ar' ? w.nameAr || w.nameEn : w.nameEn}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">{language === 'ar' ? 'الكمية' : 'Quantity'}</label>
                    <input
                      type="number"
                      className="input"
                      value={stockQuantity}
                      onChange={(e) => setStockQuantity(Number(e.target.value))}
                      min={0}
                    />
                    <p className="mt-1 text-[11px] text-slate-400">
                      {language === 'ar' ? 'للقراءة فقط عبر الأزرار الذكية — التسوية عبر الزر أدناه' : 'Prefer smart-button On Hand for view; adjust via button below'}
                    </p>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button type="button" onClick={saveStock} disabled={savingStock || !stockWarehouseId} className="btn btn-secondary">
                    {savingStock ? (
                      <div className="w-5 h-5 border-2 border-gray-600 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        {language === 'ar' ? 'تحديث المخزون' : 'Update Stock'}
                      </>
                    )}
                  </button>
                </div>

                <div className="border border-gray-100 dark:border-dark-700 rounded-xl overflow-hidden">
                  <div className="px-4 py-3 bg-gray-50 dark:bg-dark-700 text-sm font-medium">
                    {language === 'ar' ? 'المخزون حسب المستودع' : 'Stock by warehouse'}
                  </div>
                  <div className="divide-y divide-gray-100 dark:divide-dark-700">
                    {(Array.isArray(product?.stocks) ? product.stocks : []).map((s, idx) => {
                      const wh = s?.warehouseId
                      const whName = typeof wh === 'object' ? (language === 'ar' ? wh?.nameAr || wh?.nameEn : wh?.nameEn) : String(wh || '')
                      return (
                        <div key={String(wh?._id || wh || idx)} className="px-4 py-3 flex items-center justify-between">
                          <div className="text-sm text-gray-700 dark:text-gray-200">{whName || '-'}</div>
                          <div className="text-sm font-semibold text-gray-900 dark:text-white">{Number(s?.quantity || 0)}</div>
                        </div>
                      )
                    })}
                    {(Array.isArray(product?.stocks) ? product.stocks : []).length === 0 && (
                      <div className="px-4 py-3 text-sm text-gray-500">{language === 'ar' ? 'لا يوجد مخزون' : 'No stock'}</div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </motion.div>
        )}

        {productTab === 'variants' && invSettings?.groupProductVariant !== false && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="card space-y-4 p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-lg font-semibold">
                {language === 'ar' ? 'سمات ومتغيرات المنتج' : 'Product attributes & variants'}
              </h3>
              <Link to="/app/dashboard/inventory/attributes" className="text-sm text-primary-600 hover:underline">
                {language === 'ar' ? 'إدارة السمات' : 'Manage attributes'}
              </Link>
            </div>
            <p className="text-sm text-slate-500">
              {language === 'ar'
                ? 'عرّف أسطر السمات (سمة + قيم)، ثم اضغط «توليد المتغيرات». الشبكة السفلية للقراءة فقط — لا تُضاف صفوفاً يدوياً.'
                : 'Define attribute lines (Attribute + Values), then click Generate variants. The bottom grid is matrix output only — rows cannot be added manually.'}
            </p>
            {!isEdit && (
              <p className="text-sm text-slate-500">
                {language === 'ar' ? 'احفظ المنتج أولاً ثم ولّد المتغيرات.' : 'Save the product first, then generate variants.'}
              </p>
            )}
            <div className="space-y-3">
              {attributeLines.map((line, idx) => (
                <div key={idx} className="grid gap-2 rounded-xl border border-slate-100 p-3 dark:border-dark-600 md:grid-cols-4">
                  <select
                    className="select"
                    value={line.attributeId}
                    onChange={(e) => {
                      const next = [...attributeLines]
                      next[idx] = { ...next[idx], attributeId: e.target.value, valueIds: [] }
                      setAttributeLines(next)
                    }}
                  >
                    <option value="">{language === 'ar' ? 'سمة…' : 'Attribute…'}</option>
                    {attrs.map((a) => (
                      <option key={a._id} value={a._id}>{language === 'ar' && a.nameAr ? a.nameAr : a.name}</option>
                    ))}
                  </select>
                  <select
                    className="select"
                    value={line.createVariantMode || 'always'}
                    onChange={(e) => {
                      const next = [...attributeLines]
                      next[idx] = { ...next[idx], createVariantMode: e.target.value }
                      setAttributeLines(next)
                    }}
                  >
                    <option value="always">{language === 'ar' ? 'دائماً' : 'Always'}</option>
                    <option value="dynamic">{language === 'ar' ? 'ديناميكي' : 'Dynamically'}</option>
                    <option value="never">{language === 'ar' ? 'أبداً' : 'Never (no variant)'}</option>
                  </select>
                  <AttributeValuesMulti
                    attributeId={line.attributeId}
                    valueIds={line.valueIds || []}
                    language={language}
                    onChange={(valueIds) => {
                      const next = [...attributeLines]
                      next[idx] = { ...next[idx], valueIds }
                      setAttributeLines(next)
                    }}
                  />
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setAttributeLines(attributeLines.filter((_, i) => i !== idx))}
                  >
                    {language === 'ar' ? 'حذف' : 'Remove'}
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setAttributeLines([...attributeLines, { attributeId: '', valueIds: [], createVariantMode: 'always' }])}
              >
                <Plus className="h-4 w-4" /> {language === 'ar' ? 'سطر سمة' : 'Attribute line'}
              </button>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {language === 'ar'
                ? <>سيُنشئ هذا <strong>{previewCount ?? 0}</strong> متغيراً</>
                : <>This will generate <strong>{previewCount ?? 0}</strong> variants</>}
            </p>
            {generateWarning && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                {generateWarning}
                <div className="mt-2 flex gap-2">
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => runGenerate(false)}>
                    {language === 'ar' ? 'تطبيق (أرشفة الزائد)' : 'Apply (archive extras)'}
                  </button>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setGenerateWarning(null)}>
                    {language === 'ar' ? 'إلغاء' : 'Cancel'}
                  </button>
                </div>
              </div>
            )}
            {isEdit && (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={async () => {
                  try {
                    const dry = await api.post('/stock/variants/generate', {
                      productId: id,
                      attributeLines,
                      dryRun: true,
                    })
                    if ((dry.data?.archived || 0) > 0 || (dry.data?.warnings || []).length) {
                      setGenerateWarning(
                        language === 'ar'
                          ? `سيُنشأ ${dry.data.created} ويُؤرشف ${dry.data.archived}. المتغيرات ذات الحركات تُؤرشف ولا تُحذف.`
                          : `Will create ${dry.data.created} and archive ${dry.data.archived}. Variants with stock moves are archived, never deleted.`,
                      )
                    } else {
                      await runGenerate(false)
                    }
                  } catch (e) {
                    toast.error(formatInvError(e, language))
                  }
                }}
              >
                {language === 'ar' ? 'توليد المتغيرات' : 'Generate variants'}
              </button>
            )}
            {isEdit && (
              <AttributeExclusionsEditor
                productId={id}
                attributeLines={attributeLines}
                language={language}
              />
            )}
            {isEdit && (
              <TemplatePriceExtrasEditor
                productId={id}
                attributeLines={attributeLines}
                language={language}
              />
            )}
            {isEdit && (
              <div className="space-y-2 pt-2">
                <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  {language === 'ar' ? 'المتغيرات المولّدة' : 'Generated variants'}
                </h4>
                <ProductVariantsGrid productId={id} language={language} />
              </div>
            )}
          </motion.div>
        )}

        {productTab === 'documents' && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="card space-y-3 p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">{language === 'ar' ? 'المستندات' : 'Documents'}</h3>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setProductDocuments((rows) => [...rows, { name: '', url: '', mimeType: '' }])}
              >
                {language === 'ar' ? '+ مستند' : '+ Document'}
              </button>
            </div>
            {!productDocuments.length ? (
              <p className="text-sm text-slate-400">{language === 'ar' ? 'لا مستندات' : 'No documents linked'}</p>
            ) : (
              <div className="space-y-2">
                {productDocuments.map((doc, idx) => (
                  <div key={idx} className="grid gap-2 rounded-lg border border-slate-200 p-3 sm:grid-cols-3 dark:border-dark-600">
                    <input
                      className="input input-sm"
                      placeholder={language === 'ar' ? 'الاسم' : 'Name'}
                      value={doc.name}
                      onChange={(e) => setProductDocuments((rows) => rows.map((r, i) => (i === idx ? { ...r, name: e.target.value } : r)))}
                    />
                    <input
                      className="input input-sm sm:col-span-2"
                      placeholder="URL"
                      value={doc.url}
                      onChange={(e) => setProductDocuments((rows) => rows.map((r, i) => (i === idx ? { ...r, url: e.target.value } : r)))}
                    />
                    <button type="button" className="text-xs text-rose-600 sm:col-span-3 text-start" onClick={() => setProductDocuments((rows) => rows.filter((_, i) => i !== idx))}>
                      {language === 'ar' ? 'حذف' : 'Remove'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {productTab === 'accounting' && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="card space-y-3 p-6">
            <h3 className="text-lg font-semibold">{language === 'ar' ? 'المحاسبة' : 'Accounting'}</h3>
            <p className="text-sm text-slate-500">
              {language === 'ar'
                ? 'طريقة التكلفة والتقييم تأتي من فئة المخزون المحددة في التبويب العام.'
                : 'Costing method and valuation come from the inventory category set on the General tab.'}
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">
                  {language === 'ar' ? 'حساب الإيراد' : 'Income Account'}
                  {canBeSold ? ` (${language === 'ar' ? 'مستحسن للبيع' : 'recommended for sales'})` : ''}
                </label>
                <select {...register('incomeAccountId')} className="select">
                  <option value="">{language === 'ar' ? '— من الفئة / افتراضي —' : '— From category / default —'}</option>
                  {activeAccounts.map((a) => (
                    <option key={a._id} value={a._id}>{a.code ? `${a.code} · ${language === 'ar' ? (a.nameAr || a.name) : a.name}` : (language === 'ar' ? (a.nameAr || a.name) : a.name)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">
                  {language === 'ar' ? 'حساب المصروف' : 'Expense Account'}
                  {(canBePurchased || canBeExpensed) ? ` (${language === 'ar' ? 'مستحسن' : 'recommended'})` : ''}
                </label>
                <select {...register('expenseAccountId')} className="select">
                  <option value="">{language === 'ar' ? '— من الفئة / افتراضي —' : '— From category / default —'}</option>
                  {activeAccounts.map((a) => (
                    <option key={a._id} value={a._id}>{a.code ? `${a.code} · ${language === 'ar' ? (a.nameAr || a.name) : a.name}` : (language === 'ar' ? (a.nameAr || a.name) : a.name)}</option>
                  ))}
                </select>
              </div>
            </div>
            {(() => {
              const cat = (Array.isArray(invCategories) ? invCategories : []).find(
                (c) => String(c._id) === String(watch('categoryId') || ''),
              )
              return cat ? (
                <dl className="grid gap-2 text-sm sm:grid-cols-2">
                  <div><dt className="text-slate-400">{language === 'ar' ? 'المسار' : 'Path'}</dt><dd>{cat.completePath}</dd></div>
                  <div><dt className="text-slate-400">{language === 'ar' ? 'التكلفة' : 'Costing'}</dt><dd>{cat.costingMethod}</dd></div>
                  <div><dt className="text-slate-400">{language === 'ar' ? 'التقييم' : 'Valuation'}</dt><dd>{cat.valuationMode}</dd></div>
                  <div><dt className="text-slate-400">{language === 'ar' ? 'حساب الإيراد الموروث' : 'Inherited Income Account'}</dt><dd>{cat.incomeAccountId?.code || cat.incomeAccountId?.name || '—'}</dd></div>
                  <div><dt className="text-slate-400">{language === 'ar' ? 'حساب المصروف الموروث' : 'Inherited Expense Account'}</dt><dd>{cat.expenseAccountId?.code || cat.expenseAccountId?.name || '—'}</dd></div>
                </dl>
              ) : (
                <p className="text-sm text-slate-400">{language === 'ar' ? 'لا فئة محددة' : 'No category selected'}</p>
              )
            })()}
          </motion.div>
        )}

        {/* Submit */}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => navigate(-1)} className="btn btn-secondary">{t('cancel')}</button>
          <button type="submit" disabled={mutation.isPending} className="btn btn-primary">
            {mutation.isPending ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><Save className="w-4 h-4" />{t('save')}</>}
          </button>
        </div>
      </form>
    </div>
  )
}
