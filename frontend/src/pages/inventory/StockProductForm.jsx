import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { ArrowLeft, Save } from 'lucide-react'
import api from '../../lib/api'
import { INVENTORY_PATH, fieldControlClass, ghostBtn, primaryBtn } from './inventoryUi'

export default function StockProductForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { language } = useSelector((state) => state.ui)
  const isAr = language === 'ar'
  const isEdit = Boolean(id)

  const { register, handleSubmit, reset } = useForm({
    defaultValues: {
      name: '',
      defaultCode: '',
      barcode: '',
      listPrice: '0',
      standardPrice: '0',
      isStorable: true,
      tracking: 'none',
      useExpirationDate: false,
      expirationTime: 0,
      useTime: 0,
      removalTime: 0,
      alertTime: 0,
      descriptionPicking: '',
      uomId: '',
      categoryId: '',
      legacyProductId: '',
    },
  })

  const { data } = useQuery({
    queryKey: ['stock-product-template', id],
    queryFn: () => api.get(`/stock/products/templates/${id}`).then((r) => r.data),
    enabled: isEdit,
  })

  const variantId = data?.variants?.[0]?._id

  const { data: legacyProducts } = useQuery({
    queryKey: ['legacy-products-pick'],
    queryFn: () => api.get('/products', { params: { limit: 200 } }).then((r) => r.data?.products || r.data || []),
  })

  const { data: uoms = [] } = useQuery({
    queryKey: ['stock-uom'],
    queryFn: () => api.get('/stock/uom').then((r) => r.data),
    enabled: !isEdit,
  })

  const { data: categories = [] } = useQuery({
    queryKey: ['stock-product-categories'],
    queryFn: () => api.get('/stock/product-categories').then((r) => r.data),
  })

  const { data: valuation } = useQuery({
    queryKey: ['stock-valuation', variantId],
    queryFn: () => api.get(`/stock/valuation/${variantId}`).then((r) => r.data),
    enabled: Boolean(variantId),
  })

  useEffect(() => {
    if (data?.template) {
      reset({
        name: data.template.name,
        defaultCode: data.template.defaultCode || '',
        barcode: data.template.barcode || '',
        listPrice: data.template.listPrice,
        standardPrice: data.template.standardPrice,
        isStorable: data.template.isStorable,
        tracking: data.template.tracking || 'none',
        useExpirationDate: Boolean(data.template.useExpirationDate),
        expirationTime: data.template.expirationTime || 0,
        useTime: data.template.useTime || 0,
        removalTime: data.template.removalTime || 0,
        alertTime: data.template.alertTime || 0,
        descriptionPicking: data.template.descriptionPicking || '',
        uomId: data.template.uomId?._id || data.template.uomId || '',
        categoryId: data.template.categoryId?._id || data.template.categoryId
          ? String(data.template.categoryId._id || data.template.categoryId)
          : '',
        legacyProductId: data.variants?.[0]?.legacyProductId
          ? String(data.variants[0].legacyProductId)
          : '',
      })
    }
  }, [data, reset])

  const saveMutation = useMutation({
    mutationFn: (payload) =>
      isEdit ? api.patch(`/stock/products/templates/${id}`, payload) : api.post('/stock/products/templates', payload),
    onSuccess: (res) => {
      toast.success(isAr ? 'تم الحفظ' : 'Saved')
      queryClient.invalidateQueries(['stock-product-templates'])
      queryClient.invalidateQueries(['stock-product-template', id])
      queryClient.invalidateQueries(['stock-valuation'])
      const nextId = res.data?.template?._id || id
      if (!isEdit && nextId) navigate(INVENTORY_PATH.product(nextId))
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Error'),
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => navigate(INVENTORY_PATH.products)} className={ghostBtn}>
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {isEdit ? (isAr ? 'تعديل منتج' : 'Edit product') : (isAr ? 'منتج جديد' : 'New product')}
        </h1>
      </div>

      {isEdit && data?.onHand && (
        <div className="flex flex-wrap gap-2">
          <span className="btn btn-ghost text-sm">{isAr ? 'باليد' : 'On Hand'}: {data.onHand.onHand}</span>
          <span className="btn btn-ghost text-sm">{isAr ? 'متاح' : 'Free'}: {data.onHand.freeToUse}</span>
          {data.forecast && (
            <span className="btn btn-ghost text-sm">{isAr ? 'متوقع' : 'Forecast'}: {data.forecast.forecasted}</span>
          )}
          {valuation && (
            <span className="btn btn-ghost text-sm">
              {isAr ? 'القيمة' : 'Value'}: {valuation.value} ({valuation.costMethod})
            </span>
          )}
        </div>
      )}

      <form
        onSubmit={handleSubmit((form) => saveMutation.mutate({
          ...form,
          uomId: form.uomId || undefined,
          categoryId: form.categoryId || undefined,
          legacyProductId: form.legacyProductId || null,
        }))}
        className="card p-6 grid gap-4 md:grid-cols-2 max-w-3xl"
      >
        <div className="md:col-span-2">
          <label className="label">{isAr ? 'الاسم' : 'Name'}</label>
          <input className={fieldControlClass} {...register('name', { required: true })} />
        </div>
        <div>
          <label className="label">{isAr ? 'الرمز' : 'Internal reference'}</label>
          <input className={fieldControlClass} {...register('defaultCode')} />
        </div>
        <div>
          <label className="label">{isAr ? 'الباركود' : 'Barcode'}</label>
          <input className={fieldControlClass} {...register('barcode')} />
        </div>
        {!isEdit && (
          <div>
            <label className="label">{isAr ? 'وحدة القياس' : 'Unit of measure'}</label>
            <select className={fieldControlClass} {...register('uomId')}>
              <option value="">{isAr ? 'افتراضي' : 'Default'}</option>
              {uoms.map((u) => (
                <option key={u._id} value={u._id}>{u.name}</option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="label">{isAr ? 'الفئة' : 'Category'}</label>
          <select className={fieldControlClass} {...register('categoryId')}>
            <option value="">{isAr ? 'افتراضي (All)' : 'Default (All)'}</option>
            {categories.map((c) => (
              <option key={c._id} value={c._id}>{c.completeName}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">{isAr ? 'ربط منتج قديم' : 'Link legacy product'}</label>
          <select className={fieldControlClass} {...register('legacyProductId')}>
            <option value="">—</option>
            {(Array.isArray(legacyProducts) ? legacyProducts : []).map((p) => (
              <option key={p._id} value={p._id}>
                {p.nameEn || p.sku} {p.sku ? `(${p.sku})` : ''}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">{isAr ? 'سعر البيع' : 'List price'}</label>
          <input className={fieldControlClass} {...register('listPrice')} />
        </div>
        <div>
          <label className="label">{isAr ? 'التكلفة' : 'Standard cost'}</label>
          <input className={fieldControlClass} {...register('standardPrice')} />
        </div>
        <div className="flex items-center gap-2">
          <input type="checkbox" id="isStorable" {...register('isStorable')} />
          <label htmlFor="isStorable">{isAr ? 'قابل للتخزين' : 'Storable'}</label>
        </div>
        <div>
          <label className="label">{isAr ? 'التتبع' : 'Tracking'}</label>
          <select className={fieldControlClass} {...register('tracking')}>
            <option value="none">{isAr ? 'بدون' : 'No tracking'}</option>
            <option value="lot">{isAr ? 'بالدفعة' : 'By Lots'}</option>
            <option value="serial">{isAr ? 'بالتسلسل' : 'By Unique Serial'}</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <input type="checkbox" id="useExpirationDate" {...register('useExpirationDate')} />
          <label htmlFor="useExpirationDate">{isAr ? 'تواريخ الصلاحية' : 'Expiration dates'}</label>
        </div>
        <div>
          <label className="label">{isAr ? 'أيام الصلاحية' : 'Expiration (days)'}</label>
          <input type="number" className={fieldControlClass} {...register('expirationTime')} />
        </div>
        <div>
          <label className="label">{isAr ? 'أيام الاستخدام' : 'Best before (days)'}</label>
          <input type="number" className={fieldControlClass} {...register('useTime')} />
        </div>
        <div>
          <label className="label">{isAr ? 'أيام الإزالة (FEFO)' : 'Removal (days, FEFO)'}</label>
          <input type="number" className={fieldControlClass} {...register('removalTime')} />
        </div>
        <div>
          <label className="label">{isAr ? 'أيام التنبيه' : 'Alert (days)'}</label>
          <input type="number" className={fieldControlClass} {...register('alertTime')} />
        </div>
        <div className="md:col-span-2">
          <label className="label">{isAr ? 'وصف للالتقاط' : 'Picking description'}</label>
          <textarea className={fieldControlClass} rows={2} {...register('descriptionPicking')} />
        </div>
        {isEdit && variantId && (
          <div className="md:col-span-2 text-xs text-slate-500">
            {isAr ? 'معرف المتغير' : 'Variant ID'}: <code>{variantId}</code>
          </div>
        )}
        <div className="md:col-span-2">
          <button type="submit" className={primaryBtn} disabled={saveMutation.isPending}>
            <Save className="w-4 h-4" />
            {isAr ? 'حفظ' : 'Save'}
          </button>
        </div>
      </form>

      {isEdit && valuation?.layers?.length > 0 && (
        <div className="card overflow-hidden max-w-3xl">
          <div className="px-4 py-3 border-b font-medium">{isAr ? 'طبقات التقييم' : 'Valuation layers'}</div>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>{isAr ? 'الوصف' : 'Description'}</th>
                  <th>{isAr ? 'الكمية' : 'Qty'}</th>
                  <th>{isAr ? 'التكلفة' : 'Unit'}</th>
                  <th>{isAr ? 'القيمة' : 'Value'}</th>
                  <th>{isAr ? 'متبقي' : 'Remaining'}</th>
                </tr>
              </thead>
              <tbody>
                {valuation.layers.slice(0, 20).map((layer) => (
                  <tr key={layer._id}>
                    <td className="text-sm">{layer.description || '—'}</td>
                    <td>{layer.quantity}</td>
                    <td>{layer.unitCost}</td>
                    <td>{layer.value}</td>
                    <td>{layer.remainingQty} / {layer.remainingValue}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
