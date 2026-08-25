import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
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
  const [pickAttributeId, setPickAttributeId] = useState('')
  const [pickValueIds, setPickValueIds] = useState([])

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

  const variantId = (data?.variants || []).find((v) => v.active !== false)?._id
    || data?.variants?.[0]?._id

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

  const { data: allAttributes = [] } = useQuery({
    queryKey: ['stock-product-attributes'],
    queryFn: () => api.get('/stock/product-attributes').then((r) => r.data),
    enabled: isEdit,
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

  const saveAttrLine = useMutation({
    mutationFn: (payload) => api.put(`/stock/products/templates/${id}/attribute-lines`, payload),
    onSuccess: (res) => {
      const warn = res.data?.regeneration?.warning
      toast.success(warn || (isAr ? 'تم تحديث المتغيرات' : 'Variants updated'))
      setPickAttributeId('')
      setPickValueIds([])
      queryClient.invalidateQueries(['stock-product-template', id])
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Error'),
  })

  const removeAttrLine = useMutation({
    mutationFn: (attributeId) => api.delete(`/stock/products/templates/${id}/attribute-lines/${attributeId}`),
    onSuccess: (res) => {
      const warn = res.data?.regeneration?.warning
      toast.success(warn || (isAr ? 'تم' : 'Removed'))
      queryClient.invalidateQueries(['stock-product-template', id])
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Error'),
  })

  const selectedAttr = allAttributes.find((a) => a._id === pickAttributeId)
  const valueNameById = Object.fromEntries(
    allAttributes.flatMap((a) => (a.values || []).map((v) => [String(v._id), v.name])),
  )

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
        <div className="sticky top-0 z-10 flex flex-wrap gap-2 rounded-xl border border-slate-200/80 bg-white/95 p-2 backdrop-blur dark:border-white/10 dark:bg-[#0c111a]/95">
          <Link
            to={`${INVENTORY_PATH.stockReport}?search=${encodeURIComponent(data.template?.name || '')}`}
            className="inline-flex items-center rounded-xl border border-slate-200/80 px-3 py-2 text-sm font-medium hover:border-teal-300 hover:bg-teal-50 dark:border-white/10 dark:hover:bg-teal-500/10"
          >
            {isAr ? 'باليد' : 'On Hand'}: <span className="ms-1 font-semibold">{data.onHand.onHand}</span>
          </Link>
          <Link
            to={`${INVENTORY_PATH.forecastReport}?productId=${variantId || ''}`}
            className="inline-flex items-center rounded-xl border border-slate-200/80 px-3 py-2 text-sm font-medium hover:border-teal-300 hover:bg-teal-50 dark:border-white/10 dark:hover:bg-teal-500/10"
          >
            {isAr ? 'متوقع' : 'Forecast'}: <span className="ms-1 font-semibold">{data.forecast?.forecasted ?? '—'}</span>
          </Link>
          <Link
            to={INVENTORY_PATH.movesHistory}
            className="inline-flex items-center rounded-xl border border-slate-200/80 px-3 py-2 text-sm font-medium hover:border-teal-300 dark:border-white/10"
          >
            {isAr ? 'وارد' : 'Incoming'}: {data.forecast?.incoming ?? '—'} · {isAr ? 'صادر' : 'Outgoing'}: {data.forecast?.outgoing ?? '—'}
          </Link>
          {valuation && (
            <span className="inline-flex items-center rounded-xl border border-slate-200/80 px-3 py-2 text-sm dark:border-white/10">
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

      {isEdit && (
        <div className="card p-6 max-w-3xl space-y-4">
          <div>
            <h2 className="font-semibold">{isAr ? 'الخصائص والمتغيرات' : 'Attributes & Variants'}</h2>
            <p className="text-xs text-slate-500 mt-1">
              {isAr
                ? 'تغيير الخصائص يعيد توليد المتغيرات. المتغيرات ذات الحركات تُؤرشف ولا تُحذف.'
                : 'Changing attributes regenerates variants. Variants with stock moves are archived, never deleted.'}
            </p>
          </div>

          {(data?.attributeLines || []).map((line) => (
            <div key={line._id} className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-dark-600 pb-2">
              <div>
                <div className="font-medium text-sm">{line.attribute?.name}</div>
                <div className="text-xs text-slate-500">
                  {(line.values || []).map((v) => v.name).join(', ') || '—'}
                </div>
              </div>
              <button
                type="button"
                className={ghostBtn}
                onClick={() => removeAttrLine.mutate(line.attributeId)}
              >
                {isAr ? 'إزالة' : 'Remove'}
              </button>
            </div>
          ))}

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="label">{isAr ? 'خاصية' : 'Attribute'}</label>
              <select
                className={fieldControlClass}
                value={pickAttributeId}
                onChange={(e) => {
                  setPickAttributeId(e.target.value)
                  setPickValueIds([])
                }}
              >
                <option value="">—</option>
                {allAttributes.map((a) => (
                  <option key={a._id} value={a._id}>{a.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">{isAr ? 'القيم' : 'Values'}</label>
              <div className="flex flex-wrap gap-2 max-h-28 overflow-auto border rounded-xl p-2">
                {(selectedAttr?.values || []).map((v) => {
                  const checked = pickValueIds.includes(v._id)
                  return (
                    <label key={v._id} className="inline-flex items-center gap-1 text-sm">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => setPickValueIds((ids) => (
                          checked ? ids.filter((x) => x !== v._id) : [...ids, v._id]
                        ))}
                      />
                      {v.name}
                    </label>
                  )
                })}
                {pickAttributeId && !(selectedAttr?.values || []).length && (
                  <span className="text-xs text-slate-500">{isAr ? 'أضف قيماً من الإعدادات' : 'Add values in Configuration'}</span>
                )}
              </div>
            </div>
          </div>
          <button
            type="button"
            className={primaryBtn}
            disabled={!pickAttributeId || !pickValueIds.length || saveAttrLine.isPending}
            onClick={() => saveAttrLine.mutate({ attributeId: pickAttributeId, valueIds: pickValueIds })}
          >
            {isAr ? 'حفظ الخاصية وإعادة التوليد' : 'Save attribute & regenerate'}
          </button>

          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>{isAr ? 'المتغير' : 'Variant'}</th>
                  <th>{isAr ? 'الرمز' : 'Code'}</th>
                  <th>{isAr ? 'نشط' : 'Active'}</th>
                </tr>
              </thead>
              <tbody>
                {(data?.variants || []).map((v) => (
                  <tr key={v._id} className={v.active === false ? 'opacity-50' : ''}>
                    <td className="text-sm">
                      {(v.attributeValueIds || []).map((vid) => valueNameById[String(vid)] || String(vid)).join(' / ')
                        || (isAr ? 'افتراضي' : 'Default')}
                    </td>
                    <td>{v.defaultCode || '—'}</td>
                    <td>{v.active === false ? (isAr ? 'مؤرشف' : 'Archived') : (isAr ? 'نعم' : 'Yes')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

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

      {isEdit && variantId && (
        <ProductPackagingsPanel variantId={variantId} isAr={isAr} />
      )}
    </div>
  )
}

function ProductPackagingsPanel({ variantId, isAr }) {
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [qty, setQty] = useState('1')
  const [barcode, setBarcode] = useState('')

  const { data: items = [] } = useQuery({
    queryKey: ['stock-product-packagings', variantId],
    queryFn: () => api.get('/stock/product-packagings', { params: { productId: variantId } }).then((r) => r.data),
    enabled: Boolean(variantId),
  })

  const create = useMutation({
    mutationFn: (payload) => api.post('/stock/product-packagings', payload),
    onSuccess: () => {
      toast.success(isAr ? 'تم' : 'Created')
      setName('')
      setQty('1')
      setBarcode('')
      queryClient.invalidateQueries(['stock-product-packagings', variantId])
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Error'),
  })

  return (
    <div className="card p-6 max-w-3xl space-y-4">
      <div>
        <h2 className="font-semibold">{isAr ? 'تعبئة المنتج' : 'Product Packagings'}</h2>
        <p className="text-xs text-slate-500 mt-1">{isAr ? 'عدد الوحدات في العبوة' : 'Units per packaging'}</p>
      </div>
      <form
        className="grid gap-3 md:grid-cols-4 items-end"
        onSubmit={(e) => {
          e.preventDefault()
          if (!name.trim()) return
          create.mutate({ name: name.trim(), qty, barcode: barcode || undefined, productId: variantId })
        }}
      >
        <div>
          <label className="label">{isAr ? 'الاسم' : 'Name'}</label>
          <input className={fieldControlClass} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="label">{isAr ? 'الكمية' : 'Qty'}</label>
          <input className={fieldControlClass} value={qty} onChange={(e) => setQty(e.target.value)} />
        </div>
        <div>
          <label className="label">{isAr ? 'باركود' : 'Barcode'}</label>
          <input className={fieldControlClass} value={barcode} onChange={(e) => setBarcode(e.target.value)} />
        </div>
        <button type="submit" className={primaryBtn} disabled={create.isPending}>{isAr ? 'إضافة' : 'Add'}</button>
      </form>
      <ul className="text-sm space-y-1">
        {items.map((p) => (
          <li key={p._id}>{p.name} — {p.qty} {p.barcode ? `(${p.barcode})` : ''}</li>
        ))}
        {!items.length && <li className="text-slate-500">{isAr ? 'لا تعبئة' : 'No packagings'}</li>}
      </ul>
    </div>
  )
}
