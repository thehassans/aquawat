import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { useForm } from 'react-hook-form'
import { motion } from 'framer-motion'
import { ArrowLeft, Save, Building2, CreditCard, User, Shield, MapPin, Briefcase, Receipt, KeyRound, Eye, EyeOff, Users } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import { useTranslation } from '../../lib/translations'
import SarIcon from '../../components/ui/SarIcon'
import { getBusinessTypeOptions, getPrimaryBusinessType, getTenantBusinessTypes, normalizeBusinessTypes } from '../../lib/businessTypes'
import { CURRENCIES, CURRENCY_CODE } from '../../lib/currency'
import { COUNTRY_OPTIONS, currencyForCountry, timezoneForCountry } from '../../lib/countryCurrency'
import TenantAppStorePanel from '../../components/super-admin/TenantAppStorePanel'

export default function TenantForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { language } = useSelector((state) => state.ui)
  const { t } = useTranslation(language)
  const isEdit = Boolean(id)

  const [passwordModal, setPasswordModal] = useState(null)
  const [newPassword, setNewPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const { register, handleSubmit, reset, setValue, watch } = useForm({
    defaultValues: {
      businessType: 'trading',
      businessTypes: ['trading'],
    },
  })

  const logoValue = watch('branding.logo')
  const businessTypeOptions = getBusinessTypeOptions(language)
  const watchedBusinessTypes = normalizeBusinessTypes(watch('businessTypes'), watch('businessType') || 'trading')
  const watchedPrimaryBusinessType = watch('businessType') || 'trading'
  const watchedCurrency = String(watch('settings.currency') || CURRENCY_CODE).toUpperCase()
  const isSaudiTenant = watchedCurrency === 'SAR'

  const { data: tenant, isLoading } = useQuery({
    queryKey: ['tenant', id],
    queryFn: () => api.get(`/super-admin/tenants/${id}`).then(res => res.data),
    enabled: isEdit,
  })

  const { data: resellersData } = useQuery({
    queryKey: ['resellers'],
    queryFn: () => api.get('/super-admin/resellers').then(res => res.data),
    staleTime: 5 * 60 * 1000,
  })
  const resellers = resellersData?.resellers || []

  useEffect(() => {
    if (!tenant?.tenant) return
    const businessData = tenant.tenant?.business || {}
    const resolvedCrNumber = businessData.crNumber || businessData.commercialRegistration?.crNumber || ''
    reset({
      ...tenant.tenant,
      business: {
        ...businessData,
        crNumber: resolvedCrNumber,
        commercialRegistration: {
          ...(businessData.commercialRegistration || {}),
          crNumber: resolvedCrNumber,
        }
      },
      businessTypes: getTenantBusinessTypes(tenant.tenant),
      businessType: getPrimaryBusinessType(tenant.tenant),
      subscription: {
        ...tenant.tenant?.subscription,
        endDate: tenant.tenant?.subscription?.endDate ? new Date(tenant.tenant.subscription.endDate).toISOString().split('T')[0] : ''
      }
    })
  }, [reset, tenant])

  useEffect(() => {
    if (!watchedBusinessTypes.includes(watchedPrimaryBusinessType)) {
      setValue('businessTypes', Array.from(new Set([...watchedBusinessTypes, watchedPrimaryBusinessType])))
    }
  }, [setValue, watchedBusinessTypes, watchedPrimaryBusinessType])

  const watchedBillingCycle = watch('subscription.billingCycle')
  const watchedExtraMonths = watch('subscription.extraMonthsOffer')
  const watchedStartDate = watch('subscription.startDate')
  const watchedEndDate = watch('subscription.endDate')
  const billingCycleRef = useRef(null)
  const extraMonthsRef = useRef(null)

  // Initialize default subscription dates and state for new tenants
  useEffect(() => {
    if (isEdit) return
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    const end = new Date(start)
    end.setDate(end.getDate() + 30)
    reset({
      name: '',
      businessType: 'trading',
      businessTypes: ['trading'],
      branding: {
        logo: '',
        primaryColor: '#0ea5e9',
        accentColor: '#38bdf8'
      },
      business: {},
      settings: {
        currency: CURRENCY_CODE,
      },
      subscription: {
        plan: 'starter',
        status: 'active',
        billingCycle: 'monthly',
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0]
      }
    })
  }, [isEdit, reset])

  // Recalculate end date when billing cycle or extra months change
  useEffect(() => {
    if (!watchedBillingCycle) return
    if (billingCycleRef.current === null && extraMonthsRef.current === null) {
      billingCycleRef.current = watchedBillingCycle
      extraMonthsRef.current = watchedExtraMonths
      return
    }
    if (billingCycleRef.current === watchedBillingCycle && extraMonthsRef.current === watchedExtraMonths) return
    billingCycleRef.current = watchedBillingCycle
    extraMonthsRef.current = watchedExtraMonths
    
    const start = watchedStartDate ? new Date(watchedStartDate) : new Date()
    let days = watchedBillingCycle === 'yearly' ? 365 : 30
    
    if (watchedBillingCycle === 'yearly' && watchedExtraMonths) {
      days += parseInt(watchedExtraMonths) * 30
    }
    
    const end = new Date(start)
    end.setDate(end.getDate() + days)
    const formatted = end.toISOString().split('T')[0]
    if (formatted !== watchedEndDate) {
      setValue('subscription.endDate', formatted, { shouldDirty: true })
    }
  }, [watchedBillingCycle, watchedExtraMonths, watchedStartDate, watchedEndDate, setValue])

  // Auto-sync bilingual legal names with tenant name when empty or matching
  const watchedName = watch('name')
  const legalNameEn = watch('business.legalNameEn')
  const legalNameAr = watch('business.legalNameAr')
  useEffect(() => {
    if (watchedName && (!legalNameEn || legalNameEn.trim() === '')) {
      setValue('business.legalNameEn', watchedName, { shouldValidate: false })
    }
    if (watchedName && (!legalNameAr || legalNameAr.trim() === '')) {
      setValue('business.legalNameAr', watchedName, { shouldValidate: false })
    }
  }, [watchedName, legalNameEn, legalNameAr, setValue])

  useEffect(() => {
    if (legalNameEn && !legalNameAr) {
      setValue('business.legalNameAr', legalNameEn, { shouldValidate: false })
    } else if (legalNameAr && !legalNameEn) {
      setValue('business.legalNameEn', legalNameAr, { shouldValidate: false })
    }
  }, [legalNameEn, legalNameAr, setValue])

  const toggleBusinessType = (businessTypeId) => {
    const next = watchedBusinessTypes.includes(businessTypeId)
      ? watchedBusinessTypes.filter((item) => item !== businessTypeId)
      : [...watchedBusinessTypes, businessTypeId]
    const normalized = normalizeBusinessTypes(next)
    setValue('businessTypes', normalized)
    if (!normalized.includes(watchedPrimaryBusinessType)) {
      setValue('businessType', normalized[0])
    }
  }

  const onSubmit = (data) => {
    const nextSettings = data?.settings || {}
    const crNumberVal = data?.business?.crNumber || data?.business?.commercialRegistration?.crNumber || ''
    const tenantName = String(data?.name || '').trim()

    const nextPayload = {
      ...data,
      name: tenantName,
      resellerId: data?.resellerId || null,
      business: {
        ...(data?.business || {}),
        legalNameEn: data?.business?.legalNameEn || tenantName,
        legalNameAr: data?.business?.legalNameAr || data?.business?.legalNameEn || tenantName,
        tradeName: data?.business?.tradeName || tenantName,
        crNumber: crNumberVal,
        commercialRegistration: {
          ...(data?.business?.commercialRegistration || {}),
          crNumber: crNumberVal,
        },
        address: {
          ...(data?.business?.address || {}),
          country: data?.business?.address?.country || 'SA',
        },
      },
      settings: nextSettings,
      businessTypes: watchedBusinessTypes,
      businessType: watchedBusinessTypes.includes(watchedPrimaryBusinessType) ? watchedPrimaryBusinessType : watchedBusinessTypes[0],
    }

    if (nextPayload.subscription) {
      const { hasEmailAddon, hasIotAddon, hasWeightScaleAddon, hasBranchAddon, hasDeliveryAddon, hasMessAddon, hasCombosAddon, hasQrOrderingAddon, hasSmsAddon, ...subscriptionRest } = nextPayload.subscription
      nextPayload.subscription = subscriptionRest
    }

    mutation.mutate(nextPayload)
  }

  const mutation = useMutation({
    mutationFn: (data) => (isEdit ? api.put(`/super-admin/tenants/${id}`, data) : api.post('/super-admin/tenants', data)).then((res) => res.data),
    onSuccess: (response) => {
      toast.success(isEdit ? (language === 'ar' ? 'تم تحديث المستأجر' : 'Tenant updated') : (language === 'ar' ? 'تم إنشاء المستأجر' : 'Tenant created'))
      if (!isEdit) {
        if (response?.welcomeEmail?.sent) {
          toast.success(language === 'ar' ? 'تم إرسال بريد إنشاء اللوحة إلى بريد النشاط التجاري' : 'Panel creation email sent to the business email')
        } else {
          toast.error((language === 'ar' ? 'تم إنشاء المستأجر لكن تعذر إرسال البريد:' : 'Tenant created, but welcome email was not sent: ') + (response?.welcomeEmail?.error || response?.welcomeEmail?.reason || 'unknown_error'))
        }
      }
      queryClient.invalidateQueries(['tenants'])
      navigate('/super-admin/tenants')
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Error')
  })

  const handleLogoChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type?.startsWith('image/')) {
      toast.error(language === 'ar' ? 'الملف يجب أن يكون صورة' : 'File must be an image')
      return
    }

    if (file.size > 1024 * 1024) {
      toast.error(language === 'ar' ? 'حجم الصورة كبير جداً (الحد 1MB)' : 'Image is too large (max 1MB)')
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      setValue('branding.logo', reader.result)
    }
    reader.readAsDataURL(file)
  }

  const toggleStatusMutation = useMutation({
    mutationFn: () => api.put(`/super-admin/tenants/${id}/toggle-status`),
    onSuccess: () => {
      toast.success(language === 'ar' ? 'تم تحديث الحالة' : 'Status updated')
      queryClient.invalidateQueries(['tenant', id])
    }
  })

  const changePasswordMutation = useMutation({
    mutationFn: ({ userId, password }) => api.put(`/super-admin/users/${userId}`, { password }),
    onSuccess: () => {
      toast.success(language === 'ar' ? 'تم تغيير كلمة المرور' : 'Password changed')
      setPasswordModal(null)
      setNewPassword('')
      setShowPassword(false)
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Error'),
  })

  if (isEdit && isLoading) {
    return <div className="flex justify-center p-8"><div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="btn btn-ghost btn-icon"><ArrowLeft className="w-5 h-5" /></button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {isEdit ? (language === 'ar' ? 'تعديل مستأجر' : 'Edit Tenant') : (language === 'ar' ? 'إضافة مستأجر' : 'Add Tenant')}
            </h1>
            {isEdit && <p className="text-gray-500">{tenant?.tenant?.name}</p>}
          </div>
        </div>
        {isEdit && (
          <button onClick={() => toggleStatusMutation.mutate()} className={`btn ${tenant?.tenant?.isActive ? 'btn-danger' : 'btn-primary'}`}>
            {tenant?.tenant?.isActive ? (language === 'ar' ? 'تعطيل' : 'Deactivate') : (language === 'ar' ? 'تفعيل' : 'Activate')}
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Basic Info */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg"><Building2 className="w-5 h-5 text-primary-600" /></div>
            <h3 className="text-lg font-semibold">{language === 'ar' ? 'معلومات المستأجر' : 'Tenant Information'}</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="label">{language === 'ar' ? 'شعار الشركة' : 'Company Logo'}</label>
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="w-20 h-20 rounded-xl bg-gray-100 dark:bg-dark-700 border border-gray-200 dark:border-dark-600 flex items-center justify-center overflow-hidden">
                  {logoValue ? (
                    <img src={logoValue} alt="" className="w-full h-full object-contain" />
                  ) : (
                    <Building2 className="w-8 h-8 text-gray-400" />
                  )}
                </div>
                <div className="flex-1">
                  <input type="hidden" {...register('branding.logo')} />
                  <input type="file" accept="image/*" onChange={handleLogoChange} className="input" />
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {logoValue ? (
                      <button
                        type="button"
                        onClick={() => setValue('branding.logo', '', { shouldDirty: true })}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                      >
                        {language === 'ar' ? 'إزالة الشعار' : 'Remove Logo'}
                      </button>
                    ) : null}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {language === 'ar' ? 'PNG/JPG بحد أقصى 1MB' : 'PNG/JPG max 1MB'}
                  </p>
                </div>
              </div>
            </div>
            <div>
              <label className="label">{language === 'ar' ? 'اسم المستأجر' : 'Tenant Name'} *</label>
              <input {...register('name', { required: true })} className="input" />
            </div>
            <div>
              <label className="label">{language === 'ar' ? 'الرمز (Slug)' : 'Slug'} *</label>
              <input {...register('slug', { required: true })} className="input" placeholder="company-name" />
            </div>
            
            <div>
              <label className="label">{language === 'ar' ? 'العملة الافتراضية' : 'Default Currency'}</label>
              <select {...register('settings.currency')} defaultValue={CURRENCY_CODE} className="select">
                {CURRENCIES.map((cur) => (
                  <option key={cur.code} value={cur.code}>
                    {language === 'ar' ? `${cur.nameAr} (${cur.code})` : `${cur.nameEn} (${cur.code})`}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                {language === 'ar'
                  ? 'تحدد هذه العملة كافتراضية لجميع صفحات هذا المستأجر. تنطبق أحكام هيئة الزكاة (زاتكا) فقط عند اختيار الريال السعودي.'
                  : 'Sets the default currency used across all pages for this tenant. Saudi ZATCA e-invoicing rules only apply when SAR is selected.'}
              </p>
            </div>

            {isSaudiTenant && (
              <div>
                <label className="label">{language === 'ar' ? 'مرحلة زاتكا (ZATCA)' : 'ZATCA Phase'} *</label>
                <select {...register('zatca.phase', { valueAsNumber: true })} className="select">
                  <option value={1}>{language === 'ar' ? 'المرحلة الأولى' : 'Phase 1'}</option>
                  <option value={2}>{language === 'ar' ? 'المرحلة الثانية' : 'Phase 2'}</option>
                </select>
              </div>
            )}

            <div>
              <label className="label">{language === 'ar' ? 'نوع النشاط' : 'Business Type'}</label>
              <div className="flex flex-wrap gap-2 mt-2">
                {businessTypeOptions.map((option) => {
                  const active = watchedBusinessTypes.includes(option.id)
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => toggleBusinessType(option.id)}
                      className={`rounded-xl px-4 py-2.5 text-sm font-medium border transition-all ${active ? 'border-primary-500 bg-primary-50 text-primary-700 dark:border-primary-500/50 dark:bg-primary-900/30 dark:text-primary-300 shadow-sm' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50 dark:border-dark-600 dark:bg-dark-800 dark:text-gray-400 dark:hover:border-dark-500'}`}
                    >
                      {option.label}
                    </button>
                  )
                })}
              </div>
              <input type="hidden" {...register('businessTypes')} />
            </div>

            {watchedBusinessTypes.length > 1 && (
              <div>
                <label className="label">{language === 'ar' ? 'النشاط الأساسي (الواجهة الافتراضية)' : 'Primary Context (Default Dashboard)'}</label>
                <select {...register('businessType')} className="select">
                  {watchedBusinessTypes.map((typeId) => {
                    const opt = businessTypeOptions.find((o) => o.id === typeId)
                    return (
                      <option key={typeId} value={typeId}>
                        {opt?.label}
                      </option>
                    )
                  })}
                </select>
                <p className="text-xs text-gray-500 mt-2">{language === 'ar' ? 'جميع الأنشطة المحددة أعلاه ستكون فعالة. هذا الخيار يحدد الواجهة الافتراضية فقط.' : 'All selected types above will be active. This only sets the default dashboard.'}</p>
              </div>
            )}
            <div>
              <label className="label">{language === 'ar' ? 'الاسم القانوني (EN)' : 'Legal Name (EN)'} *</label>
              <input {...register('business.legalNameEn', { required: true })} className="input" />
            </div>
            {isSaudiTenant ? (
              <div>
                <label className="label">{language === 'ar' ? 'الاسم القانوني (AR)' : 'Legal Name (AR)'} *</label>
                <input {...register('business.legalNameAr', { required: true })} className="input" dir="rtl" />
              </div>
            ) : (
              <input type="hidden" {...register('business.legalNameAr')} />
            )}
            <div>
              <label className="label">{language === 'ar' ? 'الرقم الضريبي' : isSaudiTenant ? 'VAT Number' : 'Tax / VAT Number'}</label>
              <input {...register('business.vatNumber')} className="input" placeholder={isSaudiTenant ? '3XXXXXXXXXX00003' : ''} />
            </div>
            <div>
              <label className="label">{language === 'ar' ? 'السجل التجاري' : isSaudiTenant ? 'CR Number' : 'Business Registration Number'}</label>
              <input {...register('business.crNumber')} className="input" />
            </div>
            {isEdit && (
              <>
                <div>
                  <label className="label">{language === 'ar' ? 'المدينة' : 'City'}</label>
                  <input {...register('business.address.city')} className="input" />
                </div>
                <div>
                  <label className="label">{language === 'ar' ? 'المدينة (AR)' : 'City (AR)'}</label>
                  <input {...register('business.address.cityAr')} className="input" dir="rtl" />
                </div>
                <div>
                  <label className="label">{language === 'ar' ? 'الحي' : 'District'}</label>
                  <input {...register('business.address.district')} className="input" />
                </div>
                <div>
                  <label className="label">{language === 'ar' ? 'الحي (AR)' : 'District (AR)'}</label>
                  <input {...register('business.address.districtAr')} className="input" dir="rtl" />
                </div>
                <div>
                  <label className="label">{language === 'ar' ? 'الشارع' : 'Street'}</label>
                  <input {...register('business.address.street')} className="input" />
                </div>
                <div>
                  <label className="label">{language === 'ar' ? 'الشارع (AR)' : 'Street (AR)'}</label>
                  <input {...register('business.address.streetAr')} className="input" dir="rtl" />
                </div>
                <div>
                  <label className="label">{language === 'ar' ? 'الرمز البريدي' : 'Postal Code'}</label>
                  <input {...register('business.address.postalCode')} className="input" />
                </div>
                <div>
                  <label className="label">{language === 'ar' ? 'رقم المبنى' : 'Building Number'}</label>
                  <input {...register('business.address.buildingNumber')} className="input" />
                </div>
                <div>
                  <label className="label">{language === 'ar' ? 'الرقم الإضافي' : 'Additional Number'}</label>
                  <input {...register('business.address.additionalNumber')} className="input" />
                </div>
                <div>
                  <label className="label">{language === 'ar' ? 'الدولة' : 'Country'}</label>
                  <select
                    {...register('business.address.country', {
                      onChange: (e) => {
                        const code = e.target.value;
                        if (code) {
                          setValue('settings.currency', currencyForCountry(code));
                          setValue('settings.timezone', timezoneForCountry(code));
                        }
                      },
                    })}
                    className="select"
                  >
                    <option value="">{language === 'ar' ? 'اختر الدولة' : 'Select Country'}</option>
                    {COUNTRY_OPTIONS.map((c) => (
                      <option key={c.code} value={c.code}>
                        {language === 'ar' ? c.nameAr : c.nameEn} ({c.code}) — {c.currency}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">{language === 'ar' ? 'البريد الإلكتروني' : 'Email'}</label>
                  <input type="email" {...register('business.contactEmail')} className="input" />
                </div>
              </>
            )}
          </div>
        </motion.div>

        {/* National Address — Saudi Post / ZATCA-specific, SAR tenants only */}
        {isSaudiTenant && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.03 }} className="card p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg"><MapPin className="w-5 h-5 text-blue-600" /></div>
            <h3 className="text-lg font-semibold">{language === 'ar' ? 'العنوان الوطني' : 'National Address'}</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">{language === 'ar' ? 'رقم الإثبات' : 'Proof Number'}</label>
              <input {...register('business.nationalAddress.proofNumber')} className="input" />
            </div>
            <div>
              <label className="label">{language === 'ar' ? 'الرقم الإضافي / حساب العميل' : 'Customer Account'}</label>
              <input {...register('business.nationalAddress.customerAccount')} className="input" />
            </div>
            <div>
              <label className="label">{language === 'ar' ? 'تاريخ الإصدار الأصلي' : 'Original Date'}</label>
              <input type="date" {...register('business.nationalAddress.originalDate')} className="input" />
            </div>
            <div>
              <label className="label">{language === 'ar' ? 'تاريخ الانتهاء' : 'Expiration Date'}</label>
              <input type="date" {...register('business.nationalAddress.expirationDate')} className="input" />
            </div>
            <div>
              <label className="label">{language === 'ar' ? 'تاريخ التسجيل' : 'Registration Date'}</label>
              <input type="date" {...register('business.nationalAddress.regDate')} className="input" />
            </div>
            <div>
              <label className="label">{language === 'ar' ? 'العنوان المختصر' : 'Short Address'}</label>
              <input {...register('business.nationalAddress.shortAddress')} className="input" />
            </div>
            <div>
              <label className="label">{language === 'ar' ? 'رقم المبنى' : 'Building No'}</label>
              <input {...register('business.nationalAddress.buildingNo')} className="input" />
            </div>
            <div>
              <label className="label">{language === 'ar' ? 'الحي' : 'Neighborhood'}</label>
              <input {...register('business.nationalAddress.neighborhood')} className="input" />
            </div>
            <div>
              <label className="label">{language === 'ar' ? 'المنطقة' : 'Region'}</label>
              <input {...register('business.nationalAddress.region')} className="input" />
            </div>
            <div className="md:col-span-2">
              <label className="label">{language === 'ar' ? 'رابط QR للتحقق' : 'QR Verification URL'}</label>
              <input {...register('business.nationalAddress.qrCodeUrl')} className="input" placeholder="https://proof.address.gov.sa/VerifyProofNA.aspx" />
            </div>
          </div>
        </motion.div>
        )}

        {/* Commercial Registration — detailed Saudi CR metadata for ZATCA UBL, SAR tenants only */}
        {isSaudiTenant && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }} className="card p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg"><Briefcase className="w-5 h-5 text-amber-600" /></div>
            <h3 className="text-lg font-semibold">{language === 'ar' ? 'السجل التجاري' : 'Commercial Registration'}</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">{language === 'ar' ? 'تاريخ الإصدار' : 'Issue Date'}</label>
              <input type="date" {...register('business.commercialRegistration.issueDate')} className="input" />
            </div>
            <div>
              <label className="label">{language === 'ar' ? 'نوع الكيان (EN)' : 'Company Type (EN)'}</label>
              <input {...register('business.commercialRegistration.companyType')} className="input" placeholder="Limited Liability Company" />
            </div>
            <div>
              <label className="label">{language === 'ar' ? 'نوع الكيان (AR)' : 'Company Type (AR)'}</label>
              <input {...register('business.commercialRegistration.companyTypeAr')} className="input" dir="rtl" placeholder="شركة ذات مسؤولية محدودة" />
            </div>
            <div>
              <label className="label">{language === 'ar' ? 'حالة السجل (EN)' : 'Company Status (EN)'}</label>
              <input {...register('business.commercialRegistration.companyStatus')} className="input" placeholder="Active" />
            </div>
            <div>
              <label className="label">{language === 'ar' ? 'حالة السجل (AR)' : 'Company Status (AR)'}</label>
              <input {...register('business.commercialRegistration.companyStatusAr')} className="input" dir="rtl" placeholder="نشط" />
            </div>
            <div className="md:col-span-2">
              <label className="label">{language === 'ar' ? 'رابط QR للتحقق' : 'QR Verification URL'}</label>
              <input {...register('business.commercialRegistration.qrCodeUrl')} className="input" />
            </div>
          </div>
        </motion.div>
        )}

        {/* VAT Registration Certificate — Saudi ZATCA VAT certificate, SAR tenants only */}
        {isSaudiTenant && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="card p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-teal-100 dark:bg-teal-900/30 rounded-lg"><Receipt className="w-5 h-5 text-teal-600" /></div>
            <h3 className="text-lg font-semibold">{language === 'ar' ? 'شهادة تسجيل ضريبة القيمة المضافة' : 'VAT Registration Certificate'}</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">{language === 'ar' ? 'رقم الشهادة' : 'Certificate No'}</label>
              <input {...register('business.vatCertificate.certificateNo')} className="input" />
            </div>
            <div>
              <label className="label">{language === 'ar' ? 'تاريخ الشهادة' : 'Certificate Date'}</label>
              <input type="date" {...register('business.vatCertificate.certificateDate')} className="input" />
            </div>
            <div>
              <label className="label">{language === 'ar' ? 'تاريخ التسجيل الفعّال' : 'Effective Registration Date'}</label>
              <input type="date" {...register('business.vatCertificate.effectiveDate')} className="input" />
            </div>
            <div>
              <label className="label">{language === 'ar' ? 'تاريخ أول إقرار ضريبي' : 'First Filing Due Date'}</label>
              <input type="date" {...register('business.vatCertificate.firstFilingDueDate')} className="input" />
            </div>
            <div>
              <label className="label">{language === 'ar' ? 'الفترة الضريبية (EN)' : 'Tax Period (EN)'}</label>
              <input {...register('business.vatCertificate.taxPeriod')} className="input" placeholder="Quarterly" />
            </div>
            <div>
              <label className="label">{language === 'ar' ? 'الفترة الضريبية (AR)' : 'Tax Period (AR)'}</label>
              <input {...register('business.vatCertificate.taxPeriodAr')} className="input" dir="rtl" placeholder="ربع سنوي" />
            </div>
            <div className="md:col-span-2">
              <label className="label">{language === 'ar' ? 'رابط QR للتحقق' : 'QR Verification URL'}</label>
              <input {...register('business.vatCertificate.qrCodeUrl')} className="input" />
            </div>
          </div>
        </motion.div>
        )}

        {/* Reseller Assignment */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="card p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg"><Users className="w-5 h-5 text-indigo-600" /></div>
            <h3 className="text-lg font-semibold">{language === 'ar' ? 'تعيين الموزع' : 'Reseller Assignment'}</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">{language === 'ar' ? 'الموزع' : 'Reseller'}</label>
              <select {...register('resellerId')} className="select">
                <option value="">{language === 'ar' ? '— بدون موزع —' : '— No reseller —'}</option>
                {resellers.filter(r => r.isActive).map(r => (
                  <option key={r._id} value={r._id}>{r.name}{r.company ? ` (${r.company})` : ''}</option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                {language === 'ar' ? 'تعيين موزع لهذا المستأجر. سيتمكن الموزع من عرض بيانات الاشتراك فقط.' : 'Assign a reseller to this tenant. The reseller can view subscription details only.'}
              </p>
            </div>
          </div>
        </motion.div>

        {/* Subscription */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="card p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg"><CreditCard className="w-5 h-5 text-emerald-600" /></div>
            <h3 className="text-lg font-semibold">{language === 'ar' ? 'الاشتراك' : 'Subscription'}</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="label">{language === 'ar' ? 'الخطة' : 'Plan'}</label>
              <select {...register('subscription.plan')} className="select">
                <option value="trial">Trial</option>
                <option value="starter">Starter</option>
                <option value="professional">Professional</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </div>
            <div>
              <label className="label">{language === 'ar' ? 'الحالة' : 'Status'}</label>
              <select {...register('subscription.status')} className="select">
                <option value="active">{language === 'ar' ? 'نشط' : 'Active'}</option>
                <option value="suspended">{language === 'ar' ? 'معلق' : 'Suspended'}</option>
                <option value="expired">{language === 'ar' ? 'منتهي' : 'Expired'}</option>
              </select>
            </div>
            <div>
              <label className="label">{language === 'ar' ? 'دورة الفوترة' : 'Billing Cycle'}</label>
              <select {...register('subscription.billingCycle')} className="select">
                <option value="monthly">{language === 'ar' ? 'شهري' : 'Monthly'}</option>
                <option value="yearly">{language === 'ar' ? 'سنوي' : 'Yearly'}</option>
              </select>
            </div>
            {watchedBillingCycle === 'yearly' && (
              <div>
                <label className="label text-emerald-600 dark:text-emerald-400">
                  {language === 'ar' ? 'أشهر إضافية مجانية (عرض)' : 'Extra Free Months (Offer)'}
                </label>
                <select {...register('subscription.extraMonthsOffer')} className="select border-emerald-500/30 focus:border-emerald-500">
                  <option value="">{language === 'ar' ? 'بدون أشهر إضافية' : 'No extra months'}</option>
                  <option value="1">+ 1 {language === 'ar' ? 'شهر' : 'Month'}</option>
                  <option value="2">+ 2 {language === 'ar' ? 'أشهر' : 'Months'}</option>
                  <option value="3">+ 3 {language === 'ar' ? 'أشهر' : 'Months'}</option>
                  <option value="4">+ 4 {language === 'ar' ? 'أشهر' : 'Months'}</option>
                  <option value="6">+ 6 {language === 'ar' ? 'أشهر' : 'Months'}</option>
                </select>
              </div>
            )}
            <div>
              <label className="label">{language === 'ar' ? 'تاريخ البدء' : 'Start Date'}</label>
              <input type="date" {...register('subscription.startDate')} className="input" />
            </div>
            <div>
              <label className="label">
                <span className="inline-flex items-center gap-1">
                  {language === 'ar' ? 'تاريخ الانتهاء' : 'End Date'}
                </span>
              </label>
              <input type="date" {...register('subscription.endDate')} className="input" />
              <p className="text-xs text-gray-500 mt-1">
                {language === 'ar' ? 'يتم تحديث التاريخ تلقائياً عند تغيير دورة الفوترة.' : 'End date is auto-recalculated when billing cycle changes.'}
              </p>
            </div>
            {isEdit && (
              <>
                <div>
                  <label className="label">{language === 'ar' ? 'الحد الأقصى للمستخدمين' : 'Max Users'}</label>
                  <input type="number" {...register('subscription.maxUsers', { valueAsNumber: true })} className="input" />
                </div>
                <div>
                  <label className="label">{language === 'ar' ? 'الحد الأقصى للفواتير' : 'Max Invoices'}</label>
                  <input type="number" {...register('subscription.maxInvoices', { valueAsNumber: true })} className="input" />
                </div>
                <div>
                  <label className="label">{language === 'ar' ? 'الحد الأقصى لعروض الأسعار' : 'Max Quotations'}</label>
                  <input type="number" {...register('subscription.maxQuotations', { valueAsNumber: true })} className="input" />
                </div>
                <div>
                  <label className="label">
                    <span className="inline-flex items-center gap-1">
                      {language === 'ar' ? 'السعر' : 'Price'}
                      <SarIcon className="w-[1em] h-[1em]" />
                    </span>
                  </label>
                  <input type="number" {...register('subscription.price', { valueAsNumber: true })} className="input" />
                </div>
                {isEdit ? <TenantAppStorePanel tenantId={id} language={language} /> : null}
                <div>
                  <label className="label">{language === 'ar' ? 'الحد الأقصى للفروع' : 'Max Branches'}</label>
                  <input type="number" {...register('subscription.maxBranches', { valueAsNumber: true })} className="input" />
                </div>
              </>
            )}
          </div>
        </motion.div>

        {/* Admin User (New tenant only) */}
        {!isEdit && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="card p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg"><User className="w-5 h-5 text-blue-600" /></div>
              <h3 className="text-lg font-semibold">{language === 'ar' ? 'مستخدم المشرف والتواصل' : 'Admin User & Contact'}</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">{t('firstName')} *</label>
                <input {...register('adminUser.firstName', { required: true })} className="input" />
              </div>
              <div>
                <label className="label">{t('lastName')} *</label>
                <input {...register('adminUser.lastName', { required: true })} className="input" />
              </div>
              <div>
                <label className="label">{t('email')} *</label>
                <input type="email" {...register('adminUser.email', { required: true })} className="input" />
              </div>
              <div>
                <label className="label">{t('password')} *</label>
                <input type="password" {...register('adminUser.password', { required: true })} className="input" />
              </div>
              <div className="md:col-span-2 mt-2 pt-4 border-t border-gray-200 dark:border-dark-600 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label">{language === 'ar' ? 'البريد الشخصي للمالك' : 'Owner Personal Email'}</label>
                  <input type="email" {...register('personalEmail')} className="input" placeholder="Used for welcome email" />
                </div>
                <div>
                  <label className="label">{language === 'ar' ? 'رقم الواتساب' : 'WhatsApp Number'}</label>
                  <input type="text" {...register('phoneNumber')} className="input" placeholder="e.g. 966500000000" />
                </div>
              </div>
            </div>
            <div className="mt-6 p-4 rounded-xl border border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/20 flex items-center justify-between">
               <div>
                 <h4 className="font-medium text-emerald-900 dark:text-emerald-100">{language === 'ar' ? 'تم تصفية المبالغ' : 'Billing Cleared'}</h4>
                 <p className="text-sm text-emerald-700 dark:text-emerald-300">{language === 'ar' ? 'سيتم إرسال رسالة التخليص وإرفاق الشروط والأحكام.' : 'Send billing cleared message and attach Terms & Conditions PDF.'}</p>
               </div>
               <input type="checkbox" {...register('billingCleared')} className="h-5 w-5 accent-emerald-500" />
            </div>
          </motion.div>
        )}

        {/* Stats (Edit only) */}
        {isEdit && tenant && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="card p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-violet-100 dark:bg-violet-900/30 rounded-lg"><Shield className="w-5 h-5 text-violet-600" /></div>
              <h3 className="text-lg font-semibold">{language === 'ar' ? 'الإحصائيات' : 'Statistics'}</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-gray-50 dark:bg-dark-700 rounded-xl">
                <p className="text-sm text-gray-500">{language === 'ar' ? 'المستخدمين' : 'Users'}</p>
                <p className="text-2xl font-bold">{tenant.users?.length || 0}</p>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-dark-700 rounded-xl">
                <p className="text-sm text-gray-500">{language === 'ar' ? 'الموظفين' : 'Employees'}</p>
                <p className="text-2xl font-bold">{tenant.employeeCount || 0}</p>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-dark-700 rounded-xl">
                <p className="text-sm text-gray-500">{language === 'ar' ? 'الفواتير' : 'Invoices'}</p>
                <p className="text-2xl font-bold">{tenant.invoiceStats?.reduce((sum, s) => sum + s.count, 0) || 0}</p>
              </div>
              {isSaudiTenant ? (
                <div className="p-4 bg-gray-50 dark:bg-dark-700 rounded-xl">
                  <p className="text-sm text-gray-500">ZATCA</p>
                  <p className="text-lg font-bold">{tenant.tenant?.zatca?.isOnboarded ? '✓ Active' : '○ Pending'}</p>
                </div>
              ) : (
                <div className="p-4 bg-gray-50 dark:bg-dark-700 rounded-xl">
                  <p className="text-sm text-gray-500">{language === 'ar' ? 'العملة' : 'Currency'}</p>
                  <p className="text-lg font-bold">{watchedCurrency}</p>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* User Password Management (Edit only) */}
        {isEdit && tenant?.users && tenant.users.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }} className="card p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg"><KeyRound className="w-5 h-5 text-amber-600" /></div>
              <h3 className="text-lg font-semibold">{language === 'ar' ? 'إدارة المستخدمين وكلمات المرور' : 'User Password Management'}</h3>
            </div>
            <div className="space-y-3">
              {(tenant.users || []).map((user) => (
                <div key={user._id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-dark-700 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                      <User className="w-5 h-5 text-primary-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {user.firstName} {user.lastName}
                      </p>
                      <p className="text-sm text-gray-500">{user.email}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {language === 'ar' ? 'الدور' : 'Role'}: {user.role}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setPasswordModal(user); setNewPassword(''); setShowPassword(false) }}
                    className="btn btn-secondary"
                  >
                    <KeyRound className="w-4 h-4" />
                    {language === 'ar' ? 'تغيير كلمة المرور' : 'Change Password'}
                  </button>
                </div>
              ))}
            </div>
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

      {passwordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="card p-6 w-full max-w-md"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                  <KeyRound className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">{language === 'ar' ? 'تغيير كلمة المرور' : 'Change Password'}</h3>
                  <p className="text-sm text-gray-500">{passwordModal.firstName} {passwordModal.lastName}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => { setPasswordModal(null); setNewPassword(''); setShowPassword(false) }}
                className="p-2 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg"
              >
                <ArrowLeft className="w-5 h-5 rotate-45" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="label">{language === 'ar' ? 'كلمة المرور الجديدة' : 'New Password'} *</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="input pe-10"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder={language === 'ar' ? 'أدخل كلمة المرور الجديدة' : 'Enter new password'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((p) => !p)}
                    className="absolute end-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {newPassword && newPassword.length < 6 && (
                  <p className="text-xs text-amber-600 mt-1">
                    {language === 'ar' ? 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' : 'Password must be at least 6 characters'}
                  </p>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={() => { setPasswordModal(null); setNewPassword(''); setShowPassword(false) }}
                className="btn btn-secondary"
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                disabled={!newPassword || newPassword.length < 6 || changePasswordMutation.isPending}
                onClick={() => changePasswordMutation.mutate({ userId: passwordModal._id, password: newPassword })}
                className="btn btn-primary"
              >
                {changePasswordMutation.isPending ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <KeyRound className="w-4 h-4" />
                    {language === 'ar' ? 'تحديث كلمة المرور' : 'Update Password'}
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}
