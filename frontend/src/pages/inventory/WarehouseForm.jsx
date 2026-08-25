import { useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { useForm } from 'react-hook-form'
import { motion } from 'framer-motion'
import { ArrowLeft, Save, Warehouse as WarehouseIcon, MapPin } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import { useTranslation } from '../../lib/translations'
import { useLiveTranslation } from '../../lib/liveTranslation'
import { showArabicFields as isArabicTenantMarket } from '../../lib/saudiTenant'

export default function WarehouseForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const { language } = useSelector((state) => state.ui)
  const { tenant } = useSelector((state) => state.auth)
  const { t } = useTranslation(language)
  const isEdit = Boolean(id)
  const returnTo = searchParams.get('returnTo')
  const showArabicFields = isArabicTenantMarket(tenant)

  const { register, handleSubmit, reset, setValue, watch, control } = useForm({
    defaultValues: {
      type: 'main',
      isPrimary: false,
      address: { city: '', district: '' },
      capacity: { totalSpace: 0, unit: 'sqm' },
    },
  })

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

  const { data: warehouseData, isLoading } = useQuery({
    queryKey: ['warehouse', id],
    queryFn: () => api.get(`/warehouses/${id}`).then((res) => res.data),
    enabled: isEdit,
  })

  useEffect(() => {
    if (isEdit && warehouseData) {
      reset({
        ...warehouseData,
        address: {
          city: warehouseData?.address?.city || '',
          district: warehouseData?.address?.district || '',
        },
        capacity: {
          totalSpace: warehouseData?.capacity?.totalSpace || 0,
          unit: warehouseData?.capacity?.unit || 'sqm',
        },
        receptionSteps: warehouseData?.receptionSteps || 'one',
        deliverySteps: warehouseData?.deliverySteps || 'ship',
        buyToResupply: warehouseData?.buyToResupply !== false,
      })
    }
  }, [isEdit, warehouseData, reset])

  const mutation = useMutation({
    mutationFn: (data) => (isEdit ? api.put(`/warehouses/${id}`, data) : api.post('/warehouses', data)),
    onSuccess: () => {
      toast.success(
        isEdit
          ? language === 'ar'
            ? 'تم تحديث المستودع'
            : 'Warehouse updated'
          : language === 'ar'
            ? 'تم إضافة المستودع'
            : 'Warehouse added'
      )
      queryClient.invalidateQueries(['warehouses'])
      navigate(returnTo || '/app/dashboard/warehouses')
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Error'),
  })

  const recomputeMut = useMutation({
    mutationFn: (body) => api.post(`/stock/warehouses/${id}/recompute-routes`, body),
    onSuccess: () => {
      toast.success(language === 'ar' ? 'تم تحديث المسارات' : 'Warehouse routes recomputed')
      queryClient.invalidateQueries(['warehouse', id])
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Error'),
  })

  if (isEdit && isLoading) {
    return (
      <div className="flex justify-center p-12">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(returnTo || '/app/dashboard/warehouses')} className="btn btn-ghost btn-icon">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {isEdit ? (language === 'ar' ? 'تعديل مستودع' : 'Edit Warehouse') : language === 'ar' ? 'إضافة مستودع' : 'Add Warehouse'}
          </h1>
        </div>
      </div>

      <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="space-y-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
              <WarehouseIcon className="w-5 h-5 text-primary-600" />
            </div>
            <h3 className="text-lg font-semibold">{language === 'ar' ? 'معلومات المستودع' : 'Warehouse Information'}</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">{language === 'ar' ? 'الرمز' : 'Code'} *</label>
              <input {...register('code', { required: true })} className="input" placeholder="WH-001" />
            </div>

            <div>
              <label className="label">{language === 'ar' ? 'النوع' : 'Type'}</label>
              <select {...register('type')} className="select">
                <option value="main">{language === 'ar' ? 'رئيسي' : 'Main'}</option>
                <option value="branch">{language === 'ar' ? 'فرع' : 'Branch'}</option>
                <option value="distribution">{language === 'ar' ? 'توزيع' : 'Distribution'}</option>
                <option value="returns">{language === 'ar' ? 'مرتجعات' : 'Returns'}</option>
                <option value="virtual">{language === 'ar' ? 'افتراضي' : 'Virtual'}</option>
              </select>
            </div>

            {showArabicFields ? (
              <>
                <div>
                  <label className="label">{language === 'ar' ? 'الاسم (EN)' : 'Name (EN)'} *</label>
                  <input {...register('nameEn', { required: true })} className="input" />
                </div>

                <div>
                  <label className="label">{language === 'ar' ? 'الاسم (AR)' : 'Name (AR)'}</label>
                  <input {...register('nameAr')} className="input" dir="rtl" />
                </div>
              </>
            ) : (
              <div className="md:col-span-2">
                <label className="label">{language === 'ar' ? 'الاسم' : 'Name'} *</label>
                <input {...register('nameEn', { required: true })} className="input" />
                <input type="hidden" {...register('nameAr')} />
              </div>
            )}

            <div className="md:col-span-2">
              <div className="flex items-center gap-3">
                <input type="checkbox" id="isPrimary" {...register('isPrimary')} className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                <label htmlFor="isPrimary" className="text-sm cursor-pointer">
                  {language === 'ar' ? 'مستودع رئيسي' : 'Primary Warehouse'}
                </label>
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="card p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <MapPin className="w-5 h-5 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold">{language === 'ar' ? 'الموقع' : 'Location'}</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">{language === 'ar' ? 'المدينة' : 'City'}</label>
              <input {...register('address.city')} className="input" />
            </div>
            <div>
              <label className="label">{language === 'ar' ? 'الحي' : 'District'}</label>
              <input {...register('address.district')} className="input" />
            </div>
          </div>
        </motion.div>

        </motion.div>

        {isEdit && warehouseData?.engineBootstrappedAt && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="card p-6">
            <h3 className="mb-4 text-lg font-semibold">
              {language === 'ar' ? 'خطوات المخزون' : 'Inventory steps'}
            </h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="label">{language === 'ar' ? 'الاستلام' : 'Reception'}</label>
                <select {...register('receptionSteps')} className="select">
                  <option value="one">{language === 'ar' ? 'خطوة واحدة (مباشر)' : 'One step (direct)'}</option>
                  <option value="two">{language === 'ar' ? 'خطوتان (مدخل → مخزون)' : 'Two steps (input → stock)'}</option>
                  <option value="three">{language === 'ar' ? 'ثلاث خطوات (+ جودة)' : 'Three steps (+ QC)'}</option>
                </select>
              </div>
              <div>
                <label className="label">{language === 'ar' ? 'التسليم' : 'Delivery'}</label>
                <select {...register('deliverySteps')} className="select">
                  <option value="ship">{language === 'ar' ? 'شحن مباشر' : 'Ship only'}</option>
                  <option value="pickShip">{language === 'ar' ? 'انتقاء ثم شحن' : 'Pick + ship'}</option>
                  <option value="pickPackShip">{language === 'ar' ? 'انتقاء + تعبئة + شحن' : 'Pick + pack + ship'}</option>
                </select>
              </div>
              <div className="md:col-span-2 flex items-center gap-3">
                <input type="checkbox" id="buyToResupply" {...register('buyToResupply')} className="w-4 h-4 rounded border-gray-300 text-primary-600" />
                <label htmlFor="buyToResupply" className="text-sm cursor-pointer">
                  {language === 'ar' ? 'إعادة التوريد بالشراء' : 'Buy to resupply'}
                </label>
              </div>
            </div>
            <div className="mt-4">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={recomputeMut.isPending}
                onClick={() => {
                  const values = watch()
                  recomputeMut.mutate({
                    receptionSteps: values.receptionSteps,
                    deliverySteps: values.deliverySteps,
                    buyToResupply: values.buyToResupply,
                  })
                }}
              >
                {language === 'ar' ? 'إعادة حساب المسارات والقواعد' : 'Recompute routes & rules'}
              </button>
            </div>
          </motion.div>
        )}

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="card p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
              <WarehouseIcon className="w-5 h-5 text-emerald-600" />
            </div>
            <h3 className="text-lg font-semibold">{language === 'ar' ? 'السعة والتخزين' : 'Capacity & Storage'}</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">{language === 'ar' ? 'إجمالي السعة' : 'Total Capacity'}</label>
              <input type="number" min="0" step="any" {...register('capacity.totalSpace', { valueAsNumber: true })} className="input" placeholder="0" />
            </div>
            <div>
              <label className="label">{language === 'ar' ? 'وحدة القياس' : 'Unit of Measurement'}</label>
              <select {...register('capacity.unit')} className="select">
                <option value="sqm">{language === 'ar' ? 'متر مربع (sqm)' : 'Square Meters (sqm)'}</option>
                <option value="cbm">{language === 'ar' ? 'متر مكعب (cbm)' : 'Cubic Meters (cbm)'}</option>
                <option value="pallets">{language === 'ar' ? 'منصات نقالة (Pallets)' : 'Pallets'}</option>
                <option value="units">{language === 'ar' ? 'وحدات (Units)' : 'Units'}</option>
              </select>
            </div>
          </div>
        </motion.div>

        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => navigate(returnTo || '/app/dashboard/warehouses')} className="btn btn-secondary">
            {t('cancel')}
          </button>
          <button type="submit" disabled={mutation.isPending} className="btn btn-primary">
            {mutation.isPending ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Save className="w-4 h-4" />
                {t('save')}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
