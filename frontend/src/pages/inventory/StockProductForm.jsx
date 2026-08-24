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
      listPrice: '0',
      standardPrice: '0',
      isStorable: true,
      tracking: 'none',
      useExpirationDate: false,
      expirationTime: 0,
      removalTime: 0,
    },
  })

  const { data } = useQuery({
    queryKey: ['stock-product-template', id],
    queryFn: () => api.get(`/stock/products/templates/${id}`).then((r) => r.data),
    enabled: isEdit,
  })

  useEffect(() => {
    if (data?.template) {
      reset({
        name: data.template.name,
        defaultCode: data.template.defaultCode || '',
        listPrice: data.template.listPrice,
        standardPrice: data.template.standardPrice,
        isStorable: data.template.isStorable,
        tracking: data.template.tracking || 'none',
        useExpirationDate: Boolean(data.template.useExpirationDate),
        expirationTime: data.template.expirationTime || 0,
        removalTime: data.template.removalTime || 0,
      })
    }
  }, [data, reset])

  const saveMutation = useMutation({
    mutationFn: (payload) =>
      isEdit ? api.patch(`/stock/products/templates/${id}`, payload) : api.post('/stock/products/templates', payload),
    onSuccess: (res) => {
      toast.success(isAr ? 'تم الحفظ' : 'Saved')
      queryClient.invalidateQueries(['stock-product-templates'])
      if (!isEdit && res.data?.template?._id) {
        navigate(INVENTORY_PATH.product(res.data.template._id))
      }
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
        </div>
      )}

      <form
        onSubmit={handleSubmit((form) => saveMutation.mutate(form))}
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
          <label className="label">{isAr ? 'أيام الإزالة (FEFO)' : 'Removal (days, FEFO)'}</label>
          <input type="number" className={fieldControlClass} {...register('removalTime')} />
        </div>
        {isEdit && data?.variants?.[0] && (
          <div className="md:col-span-2 text-xs text-slate-500">
            {isAr ? 'معرف المتغير' : 'Variant ID'}: <code>{data.variants[0]._id}</code>
          </div>
        )}
        <div className="md:col-span-2">
          <button type="submit" className={primaryBtn} disabled={saveMutation.isPending}>
            <Save className="w-4 h-4" />
            {isAr ? 'حفظ' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  )
}
