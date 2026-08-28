import { useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { useForm, Controller } from 'react-hook-form'
import { motion } from 'framer-motion'
import { ArrowLeft, Save, Warehouse as WarehouseIcon, MapPin, Truck, PackageOpen, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import { useTranslation } from '../../lib/translations'
import { useLiveTranslation } from '../../lib/liveTranslation'
import { showArabicFields as isArabicTenantMarket } from '../../lib/saudiTenant'
import { invKpiCardClass, invKpiLabelClass } from './inventoryUi'

const RECEPTION_OPTIONS = [
  {
    value: 'one',
    labelEn: '1 Step',
    labelAr: 'خطوة واحدة',
    hintEn: 'Receive goods directly into stock.',
    hintAr: 'استلام البضائع مباشرة إلى المخزون.',
    pathEn: 'Vendors → Stock',
    pathAr: 'الموردون → المخزون',
  },
  {
    value: 'two',
    labelEn: '2 Steps',
    labelAr: 'خطوتان',
    hintEn: 'Receive in input, then transfer to stock.',
    hintAr: 'استلام في المدخل، ثم نقل إلى المخزون.',
    pathEn: 'Vendors → Input → Stock',
    pathAr: 'الموردون → المدخل → المخزون',
  },
  {
    value: 'three',
    labelEn: '3 Steps',
    labelAr: 'ثلاث خطوات',
    hintEn: 'Receive in input, quality control, then stock.',
    hintAr: 'استلام في المدخل، مراقبة الجودة، ثم المخزون.',
    pathEn: 'Vendors → Input → QC → Stock',
    pathAr: 'الموردون → المدخل → الجودة → المخزون',
  },
]

const DELIVERY_OPTIONS = [
  {
    value: 'ship',
    labelEn: '1 Step',
    labelAr: 'خطوة واحدة',
    hintEn: 'Deliver goods directly from stock.',
    hintAr: 'تسليم البضائع مباشرة من المخزون.',
    pathEn: 'Stock → Customers',
    pathAr: 'المخزون → العملاء',
  },
  {
    value: 'pickShip',
    labelEn: '2 Steps',
    labelAr: 'خطوتان',
    hintEn: 'Pick to output, then deliver.',
    hintAr: 'انتقاء إلى المخرج، ثم التسليم.',
    pathEn: 'Stock → Output → Customers',
    pathAr: 'المخزون → المخرج → العملاء',
  },
  {
    value: 'pickPackShip',
    labelEn: '3 Steps',
    labelAr: 'ثلاث خطوات',
    hintEn: 'Pick, pack, then deliver.',
    hintAr: 'انتقاء، تعبئة، ثم التسليم.',
    pathEn: 'Stock → Pack → Output → Customers',
    pathAr: 'المخزون → التعبئة → المخرج → العملاء',
  },
]

function StepRadioGroup({ name, options, value, onChange, isAr }) {
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {options.map((opt) => {
        const active = value === opt.value
        return (
          <label
            key={opt.value}
            className={`cursor-pointer rounded-xl border px-3.5 py-3 transition ${
              active
                ? 'border-teal-600/40 bg-teal-50/60 shadow-[0_1px_2px_rgba(13,148,136,0.08)] dark:border-teal-500/30 dark:bg-teal-950/20'
                : 'border-slate-200/90 bg-white hover:border-slate-300 dark:border-dark-600 dark:bg-dark-800 dark:hover:border-dark-500'
            }`}
          >
            <input
              type="radio"
              name={name}
              value={opt.value}
              checked={active}
              onChange={() => onChange(opt.value)}
              className="sr-only"
            />
            <span className={`block text-sm font-semibold ${active ? 'text-teal-900 dark:text-teal-100' : 'text-slate-900 dark:text-white'}`}>
              {isAr ? opt.labelAr : opt.labelEn}
            </span>
            <span className="mt-1 block text-xs leading-snug text-slate-500 dark:text-slate-400">
              {isAr ? opt.hintAr : opt.hintEn}
            </span>
            <span className={`mt-2 block font-mono text-[10px] ${active ? 'text-teal-700 dark:text-teal-300' : 'text-slate-400'}`}>
              {isAr ? opt.pathAr : opt.pathEn}
            </span>
          </label>
        )
      })}
    </div>
  )
}

export default function WarehouseForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const { language } = useSelector((state) => state.ui)
  const { tenant } = useSelector((state) => state.auth)
  const { t } = useTranslation(language)
  const isEdit = Boolean(id)
  const isAr = language === 'ar'
  const returnTo = searchParams.get('returnTo')
  const showArabicFields = isArabicTenantMarket(tenant)

  const { register, handleSubmit, reset, setValue, watch, control } = useForm({
    defaultValues: {
      isPrimary: false,
      address: { city: '', district: '' },
      capacity: { totalSpace: 0, unit: 'sqm' },
      receptionSteps: 'one',
      deliverySteps: 'ship',
      buyToResupply: true,
      manufactureToResupply: false,
      resupplyFromWarehouseIds: [],
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
        manufactureToResupply: warehouseData?.manufactureToResupply === true,
        resupplyFromWarehouseIds: (warehouseData?.resupplyFromWarehouseIds || []).map(String),
      })
    }
  }, [isEdit, warehouseData, reset])

  const { data: allWarehouses } = useQuery({
    queryKey: ['warehouses-lite'],
    queryFn: () => api.get('/warehouses').then((r) => r.data?.warehouses || r.data || []),
  })

  const resupplyIds = watch('resupplyFromWarehouseIds') || []
  const otherWarehouses = (allWarehouses || []).filter((w) => String(w._id) !== String(id))

  const toggleResupplyWarehouse = (whId) => {
    const sid = String(whId)
    const current = resupplyIds.map(String)
    const next = current.includes(sid) ? current.filter((x) => x !== sid) : [...current, sid]
    setValue('resupplyFromWarehouseIds', next, { shouldDirty: true })
  }

  const mutation = useMutation({
    mutationFn: async (data) => {
      const payload = {
        ...data,
        resupplyFromWarehouseIds: data.resupplyFromWarehouseIds || [],
      }
      const res = isEdit
        ? await api.put(`/warehouses/${id}`, payload)
        : await api.post('/warehouses', payload)
      return res.data
    },
    onSuccess: (data) => {
      toast.success(
        isEdit
          ? (isAr ? 'تم تحديث المستودع والمسارات' : 'Warehouse and routes updated')
          : (isAr ? 'تم إضافة المستودع' : 'Warehouse added')
      )
      queryClient.invalidateQueries(['warehouses'])
      queryClient.invalidateQueries(['warehouse', id])
      if (!isEdit && data?._id) {
        navigate(`/app/dashboard/inventory/warehouses/${data._id}/edit`)
      } else {
        navigate(returnTo || '/app/dashboard/inventory/warehouses')
      }
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Error'),
  })

  if (isEdit && isLoading) {
    return (
      <div className="flex justify-center p-12">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-teal-600 border-t-transparent" />
      </div>
    )
  }

  const bootstrapped = isEdit && warehouseData?.engineBootstrappedAt

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-12">
      <div className="flex items-center gap-4">
        <button type="button" onClick={() => navigate(returnTo || '/app/dashboard/inventory/warehouses')} className="btn btn-ghost btn-icon">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            {isAr ? 'المخزون' : 'Inventory'}
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {isEdit ? (isAr ? 'تعديل مستودع' : 'Edit Warehouse') : (isAr ? 'مستودع جديد' : 'New Warehouse')}
          </h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {isAr
              ? 'مركز لوجستي فعلي — يحدد المواقع وأنواع العمليات وقواعد التوريد.'
              : 'Physical logistics hub — defines locations, operation types, and resupply rules.'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="space-y-6">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:border-dark-600 dark:bg-dark-800">
          <div className="mb-5 flex items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-200">
              <WarehouseIcon className="h-4 w-4" strokeWidth={1.75} />
            </span>
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                {isAr ? 'الهوية' : 'Identity'}
              </h3>
              <p className="text-xs text-slate-500">
                {isAr ? 'رمز فريد واسم العرض' : 'Unique code and display name'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="label">{isAr ? 'الرمز' : 'Code'} *</label>
              <input {...register('code', { required: true })} className="input font-mono uppercase" placeholder="WH-001" />
            </div>

            {showArabicFields ? (
              <>
                <div>
                  <label className="label">{isAr ? 'الاسم (EN)' : 'Name (EN)'} *</label>
                  <input {...register('nameEn', { required: true })} className="input" />
                </div>
                <div className="md:col-span-2">
                  <label className="label">{isAr ? 'الاسم (AR)' : 'Name (AR)'}</label>
                  <input {...register('nameAr')} className="input" dir="rtl" />
                </div>
              </>
            ) : (
              <div>
                <label className="label">{isAr ? 'الاسم' : 'Name'} *</label>
                <input {...register('nameEn', { required: true })} className="input" />
                <input type="hidden" {...register('nameAr')} />
              </div>
            )}

            <div className="md:col-span-2">
              <label className="inline-flex cursor-pointer items-center gap-2.5">
                <input type="checkbox" {...register('isPrimary')} className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-600/20" />
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  {isAr ? 'المستودع الرئيسي الافتراضي' : 'Default primary warehouse'}
                </span>
              </label>
            </div>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }} className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:border-dark-600 dark:bg-dark-800">
          <div className="mb-5 flex items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300">
              <Truck className="h-4 w-4" strokeWidth={1.75} />
            </span>
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                {isAr ? 'تكوين اللوجستيات' : 'Logistics configuration'}
              </h3>
              <p className="text-xs text-slate-500">
                {isAr
                  ? 'يولّد المواقع وأنواع العمليات وقواعد التوجيه تلقائياً.'
                  : 'Auto-generates locations, operation types, and routing rules.'}
              </p>
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <p className={invKpiLabelClass}>{isAr ? 'الشحنات الواردة' : 'Incoming shipments'}</p>
              <Controller
                name="receptionSteps"
                control={control}
                render={({ field }) => (
                  <div className="mt-2">
                    <StepRadioGroup
                      name="receptionSteps"
                      options={RECEPTION_OPTIONS}
                      value={field.value}
                      onChange={field.onChange}
                      isAr={isAr}
                    />
                  </div>
                )}
              />
            </div>

            <div>
              <p className={invKpiLabelClass}>{isAr ? 'الشحنات الصادرة' : 'Outgoing shipments'}</p>
              <Controller
                name="deliverySteps"
                control={control}
                render={({ field }) => (
                  <div className="mt-2">
                    <StepRadioGroup
                      name="deliverySteps"
                      options={DELIVERY_OPTIONS}
                      value={field.value}
                      onChange={field.onChange}
                      isAr={isAr}
                    />
                  </div>
                )}
              />
            </div>
          </div>

          {bootstrapped && (
            <p className="mt-4 flex items-center gap-1.5 text-xs text-slate-500">
              <RefreshCw className="h-3.5 w-3.5" />
              {isAr
                ? 'عند الحفظ، يتم أرشفة المواقع وأنواع العمليات غير المستخدمة تلقائياً.'
                : 'On save, unused step locations and operation types are archived automatically.'}
            </p>
          )}
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:border-dark-600 dark:bg-dark-800">
          <div className="mb-5 flex items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
              <PackageOpen className="h-4 w-4" strokeWidth={1.75} />
            </span>
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                {isAr ? 'إعادة التوريد والشراء' : 'Resupply & purchasing'}
              </h3>
              <p className="text-xs text-slate-500">
                {isAr ? 'كيف يُعاد ملء هذا المستودع عند انخفاض المخزون' : 'How this warehouse refills when stock runs low'}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <label className={`flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200/90 px-4 py-3 dark:border-dark-600 ${watch('buyToResupply') ? 'bg-slate-50/80 dark:bg-dark-900/40' : ''}`}>
              <input type="checkbox" {...register('buyToResupply')} className="mt-0.5 h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-600/20" />
              <span>
                <span className="block text-sm font-semibold text-slate-900 dark:text-white">
                  {isAr ? 'الشراء لإعادة التوريد' : 'Buy to resupply'}
                </span>
                <span className="mt-0.5 block text-xs text-slate-500">
                  {isAr ? 'قاعدة سحب من مواقع الموردين — يسمح بأوامر الشراء.' : 'Pull rule from vendor locations — enables purchase orders.'}
                </span>
              </span>
            </label>

            <label className={`flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200/90 px-4 py-3 dark:border-dark-600 ${watch('manufactureToResupply') ? 'bg-slate-50/80 dark:bg-dark-900/40' : ''}`}>
              <input type="checkbox" {...register('manufactureToResupply')} className="mt-0.5 h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-600/20" />
              <span>
                <span className="block text-sm font-semibold text-slate-900 dark:text-white">
                  {isAr ? 'التصنيع لإعادة التوريد' : 'Manufacture to resupply'}
                </span>
                <span className="mt-0.5 block text-xs text-slate-500">
                  {isAr ? 'قاعدة سحب من موقع الإنتاج — يسمح بأوامر التصنيع.' : 'Pull rule from production location — enables manufacturing orders.'}
                </span>
              </span>
            </label>

            {otherWarehouses.length > 0 && (
              <div>
                <p className={invKpiLabelClass}>{isAr ? 'إعادة التوريد من مستودعات' : 'Resupply from warehouses'}</p>
                <p className="mb-2 text-xs text-slate-500">
                  {isAr
                    ? 'مسارات نقل بين المستودعات عند انخفاض الحد الأدنى.'
                    : 'Inter-warehouse transit routes when stock drops below minimums.'}
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {otherWarehouses.map((w) => {
                    const checked = resupplyIds.map(String).includes(String(w._id))
                    return (
                      <label
                        key={w._id}
                        className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-2.5 transition ${
                          checked
                            ? 'border-teal-600/30 bg-teal-50/50 dark:border-teal-500/20 dark:bg-teal-950/20'
                            : 'border-slate-200/90 bg-white dark:border-dark-600 dark:bg-dark-800'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleResupplyWarehouse(w._id)}
                          className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-600/20"
                        />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-slate-900 dark:text-white">
                            {w.code || w.nameEn}
                          </span>
                          {w.nameEn && w.code && (
                            <span className="block truncate text-xs text-slate-500">{w.nameEn}</span>
                          )}
                        </span>
                      </label>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:border-dark-600 dark:bg-dark-800">
          <div className="mb-5 flex items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
              <MapPin className="h-4 w-4" strokeWidth={1.75} />
            </span>
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
              {isAr ? 'العنوان والسعة' : 'Address & capacity'}
            </h3>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="label">{isAr ? 'المدينة' : 'City'}</label>
              <input {...register('address.city')} className="input" />
            </div>
            <div>
              <label className="label">{isAr ? 'الحي' : 'District'}</label>
              <input {...register('address.district')} className="input" />
            </div>
            <div>
              <label className="label">{isAr ? 'إجمالي السعة' : 'Total capacity'}</label>
              <input type="number" min="0" step="any" {...register('capacity.totalSpace', { valueAsNumber: true })} className="input" placeholder="0" />
            </div>
            <div>
              <label className="label">{isAr ? 'وحدة القياس' : 'Unit'}</label>
              <select {...register('capacity.unit')} className="select">
                <option value="sqm">{isAr ? 'م²' : 'sqm'}</option>
                <option value="cbm">{isAr ? 'م³' : 'cbm'}</option>
                <option value="pallets">{isAr ? 'منصات' : 'Pallets'}</option>
                <option value="units">{isAr ? 'وحدات' : 'Units'}</option>
              </select>
            </div>
          </div>
        </motion.div>

        {bootstrapped && (
          <div className={`${invKpiCardClass} grid grid-cols-2 gap-3 sm:grid-cols-4`}>
            {[
              { label: isAr ? 'الاستلام' : 'Reception', value: watch('receptionSteps') },
              { label: isAr ? 'التسليم' : 'Delivery', value: watch('deliverySteps') },
              { label: isAr ? 'الشراء' : 'Buy', value: watch('buyToResupply') ? (isAr ? 'نعم' : 'Yes') : (isAr ? 'لا' : 'No') },
              { label: isAr ? 'التصنيع' : 'Mfg', value: watch('manufactureToResupply') ? (isAr ? 'نعم' : 'Yes') : (isAr ? 'لا' : 'No') },
            ].map((item) => (
              <div key={item.label}>
                <p className={invKpiLabelClass}>{item.label}</p>
                <p className="mt-1 text-sm font-semibold capitalize text-slate-800 dark:text-slate-100">{item.value}</p>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => navigate(returnTo || '/app/dashboard/inventory/warehouses')} className="btn btn-secondary">
            {t('cancel')}
          </button>
          <button type="submit" disabled={mutation.isPending} className="btn btn-action-dark">
            {mutation.isPending ? (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <>
                <Save className="h-4 w-4" />
                {t('save')}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
