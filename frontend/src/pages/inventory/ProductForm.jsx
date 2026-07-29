import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { useForm } from 'react-hook-form'
import { motion } from 'framer-motion'
import { ArrowLeft, Save, Package, DollarSign, Warehouse, Factory, Plus, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import { useTranslation } from '../../lib/translations'
import SarIcon from '../../components/ui/SarIcon'
import { useLiveTranslation } from '../../lib/liveTranslation'
import Select from 'react-select'
import { ZATCA_UOM_OPTIONS } from '../../lib/uomOptions'
export default function ProductForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { language } = useSelector((state) => state.ui)
  const { t } = useTranslation(language)
  const isEdit = Boolean(id)

  const { register, handleSubmit, reset, setValue, watch, control } = useForm()
  const [product, setProduct] = useState(null)
  const [stockWarehouseId, setStockWarehouseId] = useState('')
  const [stockQuantity, setStockQuantity] = useState(0)
  const [stockReorderPoint, setStockReorderPoint] = useState(10)
  const [savingStock, setSavingStock] = useState(false)
  const [isManufactured, setIsManufactured] = useState(false)
  const [bomComponents, setBomComponents] = useState([])

  const buildPayload = (data) => {
    const payload = { ...data }
    delete payload._id
    delete payload.id
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
    payload.bomComponents = (Array.isArray(bomComponents) ? bomComponents : [])
      .filter((c) => c?.productId)
      .map((c) => ({
        productId: c.productId,
        quantity: Number.isFinite(Number(c.quantity)) ? Number(c.quantity) : 0,
        notes: c.notes || undefined,
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

    return payload
  }

  useLiveTranslation({
    control,
    watch,
    setValue,
    sourceField: 'nameEn',
    targetField: 'nameAr',
    sourceLang: 'en',
    targetLang: 'ar'
  })

  useLiveTranslation({
    control,
    watch,
    setValue,
    sourceField: 'nameAr',
    targetField: 'nameEn',
    sourceLang: 'ar',
    targetLang: 'en'
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
      }
      setProduct(normalized)
      reset(normalized)
      setIsManufactured(Boolean(normalized?.isManufactured))
      setBomComponents(
        (Array.isArray(normalized?.bomComponents) ? normalized.bomComponents : []).map((c) => ({
          productId: String(c?.productId?._id || c?.productId || ''),
          quantity: c?.quantity ?? 0,
          notes: c?.notes || ''
        }))
      )
    }
  }, [isEdit, rawProductData, reset])

  const { data: productsList } = useQuery({
    queryKey: ['products-list-lookup'],
    queryFn: () => api.get('/products', { params: { limit: 200 } }).then((res) => res.data.products),
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

  const mutation = useMutation({
    mutationFn: (data) => isEdit ? api.put(`/products/${id}`, data) : api.post('/products', data),
    onSuccess: () => {
      toast.success(isEdit ? (language === 'ar' ? 'تم تحديث المنتج' : 'Product updated') : (language === 'ar' ? 'تم إضافة المنتج' : 'Product added'))
      queryClient.invalidateQueries(['products'])
      queryClient.invalidateQueries(['products-stats'])
      navigate('/products')
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Error saving product')
  })

  const saveStock = async () => {
    if (!isEdit) return
    if (!stockWarehouseId) return
    try {
      setSavingStock(true)
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
      toast.error(e?.response?.data?.error || (language === 'ar' ? 'فشل تحديث المخزون' : 'Failed to update stock'))
    } finally {
      setSavingStock(false)
    }
  }

  if (isEdit && isLoading) {
    return <div className="flex justify-center p-8"><div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>
  }

  if (isEdit && productError) {
    const msg = productError?.response?.data?.error || (language === 'ar' ? 'فشل تحميل المنتج' : 'Failed to load product')
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
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {isEdit ? (language === 'ar' ? 'تعديل منتج' : 'Edit Product') : (language === 'ar' ? 'إضافة منتج' : 'Add Product')}
          </h1>
        </div>
      </div>

      <form onSubmit={handleSubmit((data) => mutation.mutate(buildPayload(data)))} className="space-y-6">
        {/* Basic Info */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg"><Package className="w-5 h-5 text-primary-600" /></div>
            <h3 className="text-lg font-semibold">{language === 'ar' ? 'معلومات المنتج' : 'Product Information'}</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="label">{t('sku')} *</label>
              <input {...register('sku', { required: true })} className="input" placeholder="SKU-001" />
            </div>
            <div>
              <label className="label">{t('barcode')}</label>
              <input {...register('barcode')} className="input" placeholder="1234567890123" />
            </div>
            <div>
              <label className="label">{t('category')}</label>
              <input {...register('category')} className="input" />
            </div>
            <div className="md:col-span-2 lg:col-span-1">
              <label className="label">{t('productName')} (EN) *</label>
              <input {...register('nameEn', { required: true })} className="input" />
            </div>
            <div className="md:col-span-2 lg:col-span-2">
              <label className="label">{t('productName')} (AR)</label>
              <input {...register('nameAr')} className="input" dir="rtl" />
            </div>
            <div className="md:col-span-2 lg:col-span-3">
              <label className="label">{language === 'ar' ? 'الوصف' : 'Description'}</label>
              <textarea {...register('descriptionEn')} className="input" rows={2} />
            </div>
          </div>
        </motion.div>


        {/* Pricing */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="card p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg"><DollarSign className="w-5 h-5 text-emerald-600" /></div>
            <h3 className="text-lg font-semibold">{language === 'ar' ? 'التسعير' : 'Pricing'}</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="label">
                <span className="inline-flex items-center gap-1">
                  {t('costPrice')}
                  <SarIcon className="w-[1em] h-[1em]" />
                </span>
              </label>
              <input type="number" step="0.01" {...register('costPrice', { valueAsNumber: true })} className="input" />
            </div>
            <div>
              <label className="label">
                <span className="inline-flex items-center gap-1">
                  {t('sellingPrice')} *
                  <SarIcon className="w-[1em] h-[1em]" />
                </span>
              </label>
              <input type="number" step="0.01" {...register('sellingPrice', { valueAsNumber: true, required: true })} className="input" />
            </div>
            <div>
              <label className="label">{language === 'ar' ? 'نسبة الضريبة' : 'Tax Rate'} %</label>
              <select {...register('taxRate', { valueAsNumber: true })} className="select">
                <option value={15}>15% (Standard)</option>
                <option value={0}>0% (Exempt)</option>
              </select>
            </div>
          </div>
        </motion.div>

        {/* Stock */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="card p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg"><Warehouse className="w-5 h-5 text-blue-600" /></div>
            <h3 className="text-lg font-semibold">{language === 'ar' ? 'المخزون' : 'Stock'}</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="label">{language === 'ar' ? 'وحدة القياس' : 'Unit of Measure'}</label>
              <Select
                inputId="unitOfMeasure"
                options={ZATCA_UOM_OPTIONS.map(u => ({ value: u.code, label: language === 'ar' ? u.labelAr : u.labelEn }))}
                value={ZATCA_UOM_OPTIONS.find(u => u.code === watch('unitOfMeasure')) ? { value: watch('unitOfMeasure'), label: language === 'ar' ? ZATCA_UOM_OPTIONS.find(u => u.code === watch('unitOfMeasure'))?.labelAr : ZATCA_UOM_OPTIONS.find(u => u.code === watch('unitOfMeasure'))?.labelEn } : null}
                onChange={(selected) => setValue('unitOfMeasure', selected?.value || 'PCE')}
                isSearchable
                styles={{
                  control: (base) => ({ ...base, borderRadius: '0.75rem', borderColor: '#e5e7eb', padding: '0.125rem', minHeight: '42px' })
                }}
              />
              <input type="hidden" {...register('unitOfMeasure')} />
            </div>
            {!isEdit && warehouseOptions.length > 0 && (
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

            {isEdit && (
              <div className="md:col-span-3 space-y-4">
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
