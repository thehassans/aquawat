import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { useForm } from 'react-hook-form'
import { motion } from 'framer-motion'
import { Save, Globe, ShieldCheck, DollarSign, Plus, Trash2, Star, GripVertical, Copy } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import { getBusinessTypeOptions } from '../../lib/businessTypes'

const defaultPlan = {
  id: '',
  nameEn: '',
  nameAr: '',
  priceMonthly: 99.99,
  priceYearly: 999.99,
  priceMonthlySar: 99.99,
  priceYearlySar: 999.99,
  priceMonthlyUsd: 29.99,
  priceYearlyUsd: 299.99,
  popular: false,
  featuresEn: [],
  featuresAr: []
}

export default function WebsiteSettings() {
  const queryClient = useQueryClient()
  const { language } = useSelector((state) => state.ui)
  const isArabic = language === 'ar'

  const [plans, setPlans] = useState([])
  const [currency, setCurrency] = useState('SAR')
  const [pricingContext, setPricingContext] = useState('default')
  const [plansByBusinessType, setPlansByBusinessType] = useState([])
  const [loadingDefaults, setLoadingDefaults] = useState(false)

  const { register, handleSubmit, reset, getValues } = useForm({
    defaultValues: {
      brandName: 'Maqder ERP',
      domain: 'maqder.com',
      contactPhone: '+966596775485',
      contactEmail: 'info@maqder.com',
      contactAddressEn: 'DAMMAM, Madinat Al Ummal Dist. 18, Saudi Arabia',
      contactAddressAr: 'الدمام، حي مدينة العمال 18، المملكة العربية السعودية',
      heroTitleEn: 'Complete ERP System',
      heroTitleAr: 'نظام ERP متكامل',
      heroSubtitleEn: 'Saudi compliant, ZATCA Phase 2 ready. Invoicing, HR, Payroll, Inventory & more.',
      heroSubtitleAr: 'متوافق مع السعودية وجاهز للمرحلة الثانية. فوترة، موارد بشرية، رواتب، مخزون وأكثر.',
      demoEnabled: true,
      demoTenantSlug: 'demo',
      demoEmail: 'demo@maqder.com',
      demoPassword: '',
    },
  })

  const { data, isLoading } = useQuery({
    queryKey: ['website-settings'],
    queryFn: () => api.get('/super-admin/settings/website').then((res) => res.data),
  })

  useEffect(() => {
    if (data?.website) {
      const website = data.website
      const demo = website?.demo || {}
      reset({
        brandName: website?.brandName || 'Maqder ERP',
        domain: website?.domain || 'maqder.com',
        contactPhone: website?.contactPhone || '+966596775485',
        contactEmail: website?.contactEmail || 'info@maqder.com',
        contactAddressEn: website?.contactAddressEn || 'DAMMAM, Madinat Al Ummal Dist. 18, Saudi Arabia',
        contactAddressAr: website?.contactAddressAr || 'الدمام، حي مدينة العمال 18، المملكة العربية السعودية',
        heroTitleEn: website?.hero?.titleEn || 'Complete ERP System',
        heroTitleAr: website?.hero?.titleAr || 'نظام ERP متكامل',
        heroSubtitleEn: website?.hero?.subtitleEn || '',
        heroSubtitleAr: website?.hero?.subtitleAr || '',
        demoEnabled: !!demo?.enabled,
        demoTenantSlug: demo?.tenantSlug || 'demo',
        demoEmail: demo?.email || 'demo@maqder.com',
        demoPassword: '',
      })
      setCurrency(website?.pricing?.currency || 'SAR')
      setPlans(website?.pricing?.plans || [])
      setPlansByBusinessType(website?.pricing?.plansByBusinessType || [])
      setPricingContext('default')
    }
  }, [data, reset])

  const saveMutation = useMutation({
    mutationFn: (payload) => api.put('/super-admin/settings/website', payload).then((res) => res.data),
    onSuccess: (d) => {
      toast.success(isArabic ? 'تم حفظ إعدادات الموقع' : 'Website settings saved')
      queryClient.invalidateQueries(['website-settings'])
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Error saving settings'),
  })

  const getContextPlans = () => {
    if (pricingContext === 'default') return plans
    const entry = plansByBusinessType.find((p) => p.businessType === pricingContext)
    return entry?.plans || []
  }

  const setContextPlans = (nextPlans) => {
    if (pricingContext === 'default') {
      setPlans(nextPlans)
    } else {
      setPlansByBusinessType((prev) => {
        const existingIndex = prev.findIndex((p) => p.businessType === pricingContext)
        if (existingIndex >= 0) {
          return prev.map((p, i) => i === existingIndex ? { ...p, plans: nextPlans } : p)
        }
        return [...prev, { businessType: pricingContext, plans: nextPlans }]
      })
    }
  }

  const updatePlan = (index, field, value) => {
    const current = getContextPlans()
    setContextPlans(current.map((p, i) => i === index ? { ...p, [field]: value } : p))
  }

  const updatePlanFields = (index, fields) => {
    const current = getContextPlans()
    setContextPlans(current.map((p, i) => i === index ? { ...p, ...fields } : p))
  }

  const addPlan = () => {
    setContextPlans([...getContextPlans(), { ...defaultPlan, id: `plan_${Date.now()}` }])
  }

  const removePlan = (index) => {
    setContextPlans(getContextPlans().filter((_, i) => i !== index))
  }

  const togglePopular = (index) => {
    setContextPlans(getContextPlans().map((p, i) => ({ ...p, popular: i === index })))
  }

  const copyFromDefault = async () => {
    if (pricingContext === 'default') {
      setContextPlans(plans.map((p) => ({ ...p })))
      return
    }
    try {
      setLoadingDefaults(true)
      const res = await api.get('/super-admin/settings/pricing-defaults', { params: { businessType: pricingContext } })
      const nextPlans = Array.isArray(res.data?.plans) ? res.data.plans : []
      setContextPlans(nextPlans)
      toast.success(isArabic ? 'تم تحميل الأسعار الافتراضية' : 'Default pricing loaded')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error loading defaults')
    } finally {
      setLoadingDefaults(false)
    }
  }

  const onSubmit = (formData) => {
    const payload = {
      website: {
        brandName: String(formData.brandName || '').trim(),
        domain: String(formData.domain || '').trim(),
        contactPhone: String(formData.contactPhone || '').trim(),
        contactEmail: String(formData.contactEmail || '').trim(),
        contactAddressEn: String(formData.contactAddressEn || '').trim(),
        contactAddressAr: String(formData.contactAddressAr || '').trim(),
        hero: {
          titleEn: String(formData.heroTitleEn || '').trim(),
          titleAr: String(formData.heroTitleAr || '').trim(),
          subtitleEn: String(formData.heroSubtitleEn || '').trim(),
          subtitleAr: String(formData.heroSubtitleAr || '').trim(),
        },
        demo: {
          enabled: !!formData.demoEnabled,
          tenantSlug: String(formData.demoTenantSlug || '').trim().toLowerCase(),
          email: String(formData.demoEmail || '').trim().toLowerCase(),
          password: String(formData.demoPassword || '').trim(),
        },
        pricing: {
          currency: currency.trim() || 'SAR',
          plans,
          plansByBusinessType,
        },
      },
    }

    saveMutation.mutate(payload)
  }

  if (isLoading) {
    return (
      <div className="flex justify-center p-12">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const demoInfo = data?.website?.demo

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {isArabic ? 'إعدادات الموقع' : 'Website Settings'}
        </h1>
        <p className="text-gray-500 mt-1">
          {isArabic ? 'تعديل محتوى موقع التسويق وبيانات التواصل والـ Live Demo' : 'Edit marketing website content, contact details, and Live Demo'}
        </p>
      </div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card p-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-primary-500" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{isArabic ? 'الهوية والتواصل' : 'Brand & Contact'}</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">{isArabic ? 'اسم العلامة' : 'Brand name'}</label>
                <input {...register('brandName')} className="input" />
              </div>
              <div>
                <label className="label">{isArabic ? 'الدومين' : 'Domain'}</label>
                <input {...register('domain')} className="input" placeholder="maqder.com" />
              </div>
              <div>
                <label className="label">{isArabic ? 'رقم التواصل' : 'Contact phone'}</label>
                <input {...register('contactPhone')} className="input" placeholder="+966596775485" />
              </div>
              <div>
                <label className="label">{isArabic ? 'البريد' : 'Contact email'}</label>
                <input {...register('contactEmail')} className="input" placeholder="info@maqder.com" />
              </div>
              <div>
                <label className="label">{isArabic ? 'العنوان (EN)' : 'Address (EN)'}</label>
                <input {...register('contactAddressEn')} className="input" />
              </div>
              <div>
                <label className="label">{isArabic ? 'العنوان (AR)' : 'Address (AR)'}</label>
                <input {...register('contactAddressAr')} className="input" />
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{isArabic ? 'نص الواجهة' : 'Hero Content'}</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">{isArabic ? 'العنوان (EN)' : 'Title (EN)'}</label>
                <input {...register('heroTitleEn')} className="input" />
              </div>
              <div>
                <label className="label">{isArabic ? 'العنوان (AR)' : 'Title (AR)'}</label>
                <input {...register('heroTitleAr')} className="input" />
              </div>
              <div className="md:col-span-2">
                <label className="label">{isArabic ? 'الوصف (EN)' : 'Subtitle (EN)'}</label>
                <textarea {...register('heroSubtitleEn')} className="input min-h-[96px]" />
              </div>
              <div className="md:col-span-2">
                <label className="label">{isArabic ? 'الوصف (AR)' : 'Subtitle (AR)'}</label>
                <textarea {...register('heroSubtitleAr')} className="input min-h-[96px]" />
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-amber-600" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{isArabic ? 'Live Demo' : 'Live Demo'}</h2>
            </div>

            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
              <p className="text-sm text-amber-800 dark:text-amber-200">
                {isArabic
                  ? 'ترك كلمة المرور فارغة سيحتفظ بكلمة المرور الحالية.'
                  : 'Leaving the password empty will keep the current password.'}
              </p>
              {demoInfo?.hasPassword && (
                <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                  {isArabic ? `محفوظ: ${demoInfo.passwordMasked}` : `Saved: ${demoInfo.passwordMasked}`}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <input type="checkbox" {...register('demoEnabled')} className="h-4 w-4" />
                <span className="text-sm text-gray-700 dark:text-gray-200">{isArabic ? 'تفعيل الديمو' : 'Enable demo'}</span>
              </div>
              <div />

              <div>
                <label className="label">{isArabic ? 'Tenant Slug' : 'Tenant slug'}</label>
                <input {...register('demoTenantSlug')} className="input" placeholder="demo" />
              </div>
              <div>
                <label className="label">{isArabic ? 'Email' : 'Email'}</label>
                <input {...register('demoEmail')} className="input" placeholder="demo@maqder.com" />
              </div>
              <div className="md:col-span-2">
                <label className="label">{isArabic ? 'كلمة المرور الجديدة (اختياري)' : 'New password (optional)'}</label>
                <input type="password" {...register('demoPassword')} className="input" placeholder={isArabic ? 'اتركه فارغاً للاحتفاظ بالحالية' : 'Leave empty to keep current'} />
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-violet-600" />
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{isArabic ? 'الأسعار' : 'Pricing'}</h2>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={pricingContext}
                  onChange={(e) => setPricingContext(e.target.value)}
                  className="input text-sm"
                >
                  <option value="default">
                    {isArabic ? 'افتراضي (جميع الأنواع)' : 'Default (all types)'}
                  </option>
                  {getBusinessTypeOptions(language).map((bt) => (
                    <option key={bt.id} value={bt.id}>
                      {bt.label}
                    </option>
                  ))}
                </select>
                {pricingContext !== 'default' && (
                  <button
                    type="button"
                    onClick={copyFromDefault}
                    disabled={loadingDefaults}
                    className="btn btn-secondary text-sm"
                    title={isArabic ? 'تحميل الأسعار الافتراضية لهذا النوع' : 'Load default pricing for this type'}
                  >
                    {loadingDefaults ? (
                      <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                )}
                <button type="button" onClick={addPlan} className="btn btn-secondary text-sm">
                  <Plus className="w-4 h-4" />
                  {isArabic ? 'إضافة خطة' : 'Add Plan'}
                </button>
              </div>
            </div>

            {pricingContext !== 'default' && (
              <div className="p-3 rounded-lg bg-violet-50 dark:bg-violet-900/20 border border-violet-100 dark:border-violet-900/30 text-sm text-violet-800 dark:text-violet-200">
                {isArabic
                  ? `تعديل أسعار ${getBusinessTypeOptions(language).find((b) => b.id === pricingContext)?.label || pricingContext}. إذا لم تُحفظ خطط لهذا النوع، سيتم استخدام الأسعار الافتراضية.`
                  : `Editing pricing for ${getBusinessTypeOptions(language).find((b) => b.id === pricingContext)?.label || pricingContext}. If no plans are saved for this type, default pricing will be used.`}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="label">{isArabic ? 'عملة العرض التسويقي' : 'Marketing display currency'}</label>
                <input value={currency} onChange={(e) => setCurrency(e.target.value)} className="input" placeholder="SAR" />
                <p className="mt-1 text-[11px] text-gray-500">
                  {isArabic
                    ? 'أسعار USD و SAR تُضبط بشكل مستقل أدناه — بدون تحويل تلقائي.'
                    : 'USD and SAR list prices below are set independently — no auto FX conversion.'}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {getContextPlans().map((plan, index) => (
                <div key={plan.id || index} className={`p-4 rounded-xl border-2 ${plan.popular ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/20' : 'border-gray-200 dark:border-dark-600 bg-gray-50 dark:bg-dark-700/50'}`}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <GripVertical className="w-4 h-4 text-gray-400" />
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {isArabic ? `خطة ${index + 1}` : `Plan ${index + 1}`}
                      </span>
                      {plan.popular && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-violet-500 text-white rounded-full flex items-center gap-1">
                          <Star className="w-3 h-3" /> {isArabic ? 'مميزة' : 'Popular'}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => togglePopular(index)} className={`text-xs px-2 py-1 rounded ${plan.popular ? 'bg-violet-200 text-violet-700' : 'bg-gray-200 text-gray-600 hover:bg-violet-100'}`}>
                        <Star className="w-3 h-3 inline mr-1" />
                        {isArabic ? 'مميزة' : 'Popular'}
                      </button>
                      <button type="button" onClick={() => removePlan(index)} className="p-1.5 text-red-500 hover:bg-red-50 rounded">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs text-gray-500">{isArabic ? 'الاسم (EN)' : 'Name (EN)'}</label>
                      <input value={plan.nameEn || ''} onChange={(e) => updatePlan(index, 'nameEn', e.target.value)} className="input text-sm" placeholder="Starter" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">{isArabic ? 'الاسم (AR)' : 'Name (AR)'}</label>
                      <input value={plan.nameAr || ''} onChange={(e) => updatePlan(index, 'nameAr', e.target.value)} className="input text-sm" placeholder="البداية" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">{isArabic ? 'المعرّف' : 'Plan ID'}</label>
                      <input value={plan.id || ''} onChange={(e) => updatePlan(index, 'id', e.target.value)} className="input text-sm" placeholder="starter" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                    <div>
                      <label className="text-xs text-gray-500">{isArabic ? 'شهري USD' : 'Monthly USD'}</label>
                      <input
                        type="number"
                        step="0.01"
                        value={plan.priceMonthlyUsd ?? ''}
                        onChange={(e) => {
                          const v = Number(e.target.value)
                          updatePlan(index, 'priceMonthlyUsd', v)
                        }}
                        className="input text-sm"
                        placeholder="29.99"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">{isArabic ? 'سنوي USD' : 'Yearly USD'}</label>
                      <input
                        type="number"
                        step="0.01"
                        value={plan.priceYearlyUsd ?? ''}
                        onChange={(e) => updatePlan(index, 'priceYearlyUsd', Number(e.target.value))}
                        className="input text-sm"
                        placeholder="299.99"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">{isArabic ? 'شهري SAR' : 'Monthly SAR'}</label>
                      <input
                        type="number"
                        step="0.01"
                        value={plan.priceMonthlySar ?? plan.priceMonthly ?? ''}
                        onChange={(e) => {
                          const v = Number(e.target.value)
                          updatePlanFields(index, { priceMonthlySar: v, priceMonthly: v })
                        }}
                        className="input text-sm"
                        placeholder="99.99"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">{isArabic ? 'سنوي SAR' : 'Yearly SAR'}</label>
                      <input
                        type="number"
                        step="0.01"
                        value={plan.priceYearlySar ?? plan.priceYearly ?? ''}
                        onChange={(e) => {
                          const v = Number(e.target.value)
                          updatePlanFields(index, { priceYearlySar: v, priceYearly: v })
                        }}
                        className="input text-sm"
                        placeholder="999.99"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                    <div>
                      <label className="text-xs text-gray-500">{isArabic ? 'الميزات (EN) - سطر لكل ميزة' : 'Features (EN) - one per line'}</label>
                      <textarea
                        value={(plan.featuresEn || []).join('\n')}
                        onChange={(e) => updatePlan(index, 'featuresEn', e.target.value.split('\n').filter(Boolean))}
                        className="input text-sm min-h-[100px]"
                        placeholder="ZATCA E-Invoicing&#10;Up to 100 invoices/month&#10;5 users"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">{isArabic ? 'الميزات (AR) - سطر لكل ميزة' : 'Features (AR) - one per line'}</label>
                      <textarea
                        value={(plan.featuresAr || []).join('\n')}
                        onChange={(e) => updatePlan(index, 'featuresAr', e.target.value.split('\n').filter(Boolean))}
                        className="input text-sm min-h-[100px]"
                        placeholder="الفوترة الإلكترونية&#10;حتى 100 فاتورة/شهر&#10;5 مستخدمين"
                      />
                    </div>
                  </div>
                </div>
              ))}

              {getContextPlans().length === 0 && (
                <div className="text-center py-8 text-gray-500 border-2 border-dashed border-gray-300 dark:border-dark-600 rounded-xl">
                  {isArabic ? 'لا توجد خطط. اضغط "إضافة خطة" لإنشاء خطة جديدة.' : 'No plans yet. Click "Add Plan" to create one.'}
                </div>
              )}
            </div>
          </section>

          <div className="flex justify-end">
            <button type="submit" disabled={saveMutation.isPending} className="btn btn-primary">
              {saveMutation.isPending ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  {isArabic ? 'حفظ' : 'Save'}
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}
