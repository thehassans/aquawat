import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { useForm } from 'react-hook-form'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Save, User, FileText, CreditCard, Briefcase, Shield, Heart, Upload, X, Camera, Users, Phone, Mail, MapPin, Building2, Calendar, CheckCircle, Search } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import { useTranslation } from '../../lib/translations'
import CurrencySymbol from '../../components/ui/CurrencySymbol'
import { useLiveTranslation } from '../../lib/liveTranslation'
import { describeSaudiId, normalizeSaudiId } from '../../lib/saudiId'
import { showArabicFields as isArabicTenantMarket, getTenantCurrency, isPakistanTenant } from '../../lib/saudiTenant'
import { useEffect, useState } from 'react'

export default function EmployeeForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { language } = useSelector((state) => state.ui)
  const { tenant } = useSelector((state) => state.auth)
  const { t } = useTranslation(language)
  const isEdit = Boolean(id)
  const [lookupMeta, setLookupMeta] = useState(null)
  const showArabicFields = isArabicTenantMarket(tenant)
  const currency = getTenantCurrency(tenant)
  const isPk = isPakistanTenant(tenant)

  const { register, handleSubmit, reset, setValue, watch, control, formState: { errors } } = useForm()

  useLiveTranslation({
    control,
    watch,
    setValue,
    sourceField: 'firstNameEn',
    targetField: 'firstNameAr',
    sourceLang: 'en',
    targetLang: 'ar',
    enabled: showArabicFields,
  })

  useLiveTranslation({
    control,
    watch,
    setValue,
    sourceField: 'firstNameAr',
    targetField: 'firstNameEn',
    sourceLang: 'ar',
    targetLang: 'en',
    enabled: showArabicFields,
  })

  useLiveTranslation({
    control,
    watch,
    setValue,
    sourceField: 'lastNameEn',
    targetField: 'lastNameAr',
    sourceLang: 'en',
    targetLang: 'ar'
  })

  useLiveTranslation({
    control,
    watch,
    setValue,
    sourceField: 'lastNameAr',
    targetField: 'lastNameEn',
    sourceLang: 'ar',
    targetLang: 'en'
  })

  const formatDateForInput = (value) => {
    if (!value) return undefined
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return undefined
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    return local.toISOString().slice(0, 10)
  }

  const getSaudiIdentityDocument = (documents) => {
    if (!Array.isArray(documents)) return null
    return documents.find((doc) => doc?.type === 'national_id' || doc?.type === 'iqama') || null
  }

  const buildSaudiIdentityDefaults = (data) => {
    const saudiDocument = getSaudiIdentityDocument(data?.documents)
    const nationalId = normalizeSaudiId(data?.nationalId || saudiDocument?.number)
    const saudiIdDetails = describeSaudiId(nationalId)

    return {
      nationalId: nationalId || undefined,
      nationalIdIssueDate: formatDateForInput(data?.nationalIdIssueDate || saudiDocument?.issueDate),
      nationalIdExpiry: saudiIdDetails.isIqama
        ? formatDateForInput(data?.nationalIdExpiry || saudiDocument?.expiryDate)
        : undefined,
      nationality: data?.nationality || (saudiIdDetails.isSaudi ? 'Saudi' : data?.nationality),
    }
  }

  const guardianEnabled = watch('guardian.isEnabled')
  const idCardFrontValue = watch('idCardFront')
  const idCardBackValue = watch('idCardBack')
  const nationalIdValue = watch('nationalId')
  const nationalityValue = watch('nationality')
  const nationalIdIssueDateValue = watch('nationalIdIssueDate')
  const nationalIdExpiryValue = watch('nationalIdExpiry')
  const hasIdentityImages = Boolean(idCardFrontValue || idCardBackValue)
  const saudiIdMeta = describeSaudiId(nationalIdValue)
  const saudiIdTypeLabel = saudiIdMeta.type === 'national_id'
    ? (language === 'ar' ? 'هوية وطنية' : 'Saudi National ID')
    : saudiIdMeta.type === 'iqama'
      ? (language === 'ar' ? 'إقامة' : 'Iqama')
      : (language === 'ar' ? 'غير محدد' : 'Unknown')
  const toHijri = (value) => {
    if (!value) return ''
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return ''
    const parts = new Intl.DateTimeFormat(
      language === 'ar' ? 'ar-SA-u-ca-islamic-umalqura' : 'en-u-ca-islamic-umalqura',
      { year: 'numeric', month: '2-digit', day: '2-digit' }
    ).formatToParts(date)
    const year = parts.find((part) => part.type === 'year')?.value || ''
    const month = parts.find((part) => part.type === 'month')?.value || ''
    const day = parts.find((part) => part.type === 'day')?.value || ''
    return year && month && day ? `${year}/${month}/${day}` : ''
  }

  useEffect(() => {
    const normalized = normalizeSaudiId(nationalIdValue)

    if ((nationalIdValue || '') !== normalized) {
      setValue('nationalId', normalized, { shouldDirty: true, shouldValidate: true })
      return
    }

    if (!normalized || !saudiIdMeta.valid) return

    if (saudiIdMeta.isSaudi && !nationalityValue) {
      setValue('nationality', 'Saudi', { shouldDirty: true, shouldValidate: true })
    }

    if (!saudiIdMeta.isIqama && nationalIdExpiryValue) {
      setValue('nationalIdExpiry', undefined, { shouldDirty: true, shouldValidate: true })
    }
  }, [nationalIdValue, nationalIdExpiryValue, nationalityValue, saudiIdMeta.isIqama, saudiIdMeta.isSaudi, saudiIdMeta.valid, setValue])

  const { data: employee, isLoading } = useQuery({
    queryKey: ['employee', id],
    queryFn: () => api.get(`/employees/${id}`).then(res => res.data),
    enabled: isEdit,
    onSuccess: (data) => reset({
      ...data,
      ...buildSaudiIdentityDefaults(data),
      joinDate: formatDateForInput(data?.joinDate),
      dateOfBirth: formatDateForInput(data?.dateOfBirth),
      baladyCertificateExpiryDate: formatDateForInput(data?.documents?.find(d => d.type === 'balady_certificate')?.expiryDate),
      baladyCertificateNumber: data?.documents?.find(d => d.type === 'balady_certificate')?.number || '',
    })
  })
  const linkedSaudiDocument = getSaudiIdentityDocument(employee?.documents)

  const mutation = useMutation({
    mutationFn: (data) => isEdit ? api.put(`/employees/${id}`, data) : api.post('/employees', data),
    onSuccess: () => {
      toast.success(isEdit 
        ? (language === 'ar' ? 'تم تحديث الموظف' : 'Employee updated') 
        : (language === 'ar' ? 'تم إضافة الموظف' : 'Employee added'))
      queryClient.invalidateQueries(['employees'])
      navigate('/employees')
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Error saving employee')
  })

  const buildSaudiIdentityDocuments = (data) => {
    const existingDocuments = Array.isArray(employee?.documents)
      ? employee.documents
      : Array.isArray(data?.documents)
        ? data.documents
        : []
    const saudiDocument = existingDocuments.find((doc) => doc?.type === 'national_id' || doc?.type === 'iqama')
    const documents = existingDocuments.filter((doc) => doc?.type !== 'national_id' && doc?.type !== 'iqama')
    const normalizedNationalId = normalizeSaudiId(data?.nationalId)
    const saudiIdDetails = describeSaudiId(normalizedNationalId)

    if (!normalizedNationalId || !saudiIdDetails.valid || !saudiIdDetails.type) {
      return documents
    }

    documents.push({
      ...saudiDocument,
      type: saudiIdDetails.type,
      number: normalizedNationalId,
      issueDate: data?.nationalIdIssueDate || undefined,
      expiryDate: saudiIdDetails.isIqama ? (data?.nationalIdExpiry || undefined) : undefined,
    })

    if (data?.baladyCertificateExpiryDate || data?.baladyCertificateNumber) {
      documents.push({
        type: 'balady_certificate',
        number: data?.baladyCertificateNumber || 'N/A',
        expiryDate: data?.baladyCertificateExpiryDate || undefined
      })
    }

    return documents
  }

  const handleFileUpload = async (e, fieldName) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 2 * 1024 * 1024) {
      toast.error(language === 'ar' ? 'حجم الملف كبير جداً (الحد 2MB)' : 'File is too large (max 2MB)')
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      setValue(fieldName, reader.result)
    }
    reader.readAsDataURL(file)
  }

  const removeFile = (fieldName) => {
    setValue(fieldName, null)
  }

  const handleLookupResponse = (lookup = {}, options = {}) => {
    const { showValidationOnlyToast = true } = options

    setLookupMeta(lookup)

    if (lookup?.nationalId) {
      setValue('nationalId', lookup.nationalId, { shouldDirty: true, shouldValidate: true })
    }

    if (lookup?.details) {
      applyLookupDetails(lookup.details)
    }

    if (lookup?.duplicate?.exists) {
      toast.error(
        language === 'ar'
          ? `رقم الهوية مرتبط بالموظف ${lookup.duplicate.employeeName || lookup.duplicate.employeeId || ''}`
          : `This ID is already linked to employee ${lookup.duplicate.employeeName || lookup.duplicate.employeeId || ''}`
      )
      return
    }

    if (lookup?.source === 'tenant_records') {
      toast.success(language === 'ar' ? 'تم جلب بيانات الهوية من سجلات النظام' : 'Identity details loaded from tenant records')
      return
    }

    if (lookup?.source === 'provider_live' || lookup?.source === 'provider_ocr') {
      toast.success(language === 'ar' ? 'تم جلب بيانات الهوية من المزود الخارجي' : 'Identity details loaded from the external provider')
      return
    }

    if (showValidationOnlyToast) {
      toast.success(language === 'ar' ? 'تم التحقق من الهوية ولكن لا توجد بيانات محفوظة إضافية' : 'ID validated, but no saved details were found')
    }
  }

  const applyLookupDetails = (details = {}) => {
    const fieldEntries = [
      ['firstNameEn', details?.firstNameEn],
      ['lastNameEn', details?.lastNameEn],
      ['firstNameAr', details?.firstNameAr],
      ['lastNameAr', details?.lastNameAr],
      ['email', details?.email],
      ['phone', details?.phone],
      ['alternatePhone', details?.alternatePhone],
      ['dateOfBirth', formatDateForInput(details?.dateOfBirth)],
      ['nationality', details?.nationality],
      ['gender', details?.gender],
      ['maritalStatus', details?.maritalStatus],
      ['bloodGroup', details?.bloodGroup],
      ['nationalIdIssueDate', formatDateForInput(details?.nationalIdIssueDate)],
      ['nationalIdExpiry', formatDateForInput(details?.nationalIdExpiry)],
      ['idCardFront', details?.idCardFront],
      ['idCardBack', details?.idCardBack],
      ['insurance.provider', details?.insurance?.provider],
      ['insurance.policyNumber', details?.insurance?.policyNumber],
      ['insurance.memberId', details?.insurance?.memberId],
      ['insurance.class', details?.insurance?.class],
      ['insurance.startDate', formatDateForInput(details?.insurance?.startDate)],
      ['insurance.expiryDate', formatDateForInput(details?.insurance?.expiryDate)],
    ]

    fieldEntries.forEach(([field, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        setValue(field, value, { shouldDirty: true, shouldValidate: true })
      }
    })
  }

  const lookupSaudiIdMutation = useMutation({
    mutationFn: async () => {
      const normalized = normalizeSaudiId(watch('nationalId'))
      return await api.post('/employees/lookup-saudi-id', {
        nationalId: normalized,
        excludeEmployeeId: id,
      }).then((res) => res.data)
    },
    onSuccess: (data) => {
      const lookup = data?.lookup || {}
      handleLookupResponse(lookup)
    },
    onError: (error) => {
      const lookup = error?.response?.data?.lookup
      if (lookup) {
        setLookupMeta(lookup)
        if (lookup?.nationalId) {
          setValue('nationalId', lookup.nationalId, { shouldDirty: true, shouldValidate: true })
        }
      }
      toast.error(error?.response?.data?.error || (language === 'ar' ? 'تعذر جلب تفاصيل الهوية' : 'Unable to get ID details'))
    }
  })

  const lookupSaudiIdImagesMutation = useMutation({
    mutationFn: async () => {
      return await api.post('/employees/lookup-saudi-id-images', {
        nationalId: normalizeSaudiId(watch('nationalId')),
        idCardFront: idCardFrontValue,
        idCardBack: idCardBackValue,
        excludeEmployeeId: id,
        language,
      }).then((res) => res.data)
    },
    onSuccess: (data) => {
      const lookup = data?.lookup || {}
      handleLookupResponse(lookup, { showValidationOnlyToast: false })
      if (!lookup?.details) {
        toast.success(lookup?.message || (language === 'ar' ? 'تم إرسال الصور للمزود ولكن لم يتم إرجاع تفاصيل' : 'Images were sent, but no details were returned'))
      }
    },
    onError: (error) => {
      const lookup = error?.response?.data?.lookup
      if (lookup) {
        setLookupMeta(lookup)
      }
      toast.error(error?.response?.data?.error || (language === 'ar' ? 'تعذر استخراج تفاصيل الهوية من الصور' : 'Unable to extract identity details from images'))
    }
  })

  const onSubmit = (data) => mutation.mutate({
    ...data,
    nationalId: normalizeSaudiId(data?.nationalId) || undefined,
    documents: buildSaudiIdentityDocuments(data),
  })

  if (isEdit && isLoading) {
    return <div className="flex justify-center p-8"><div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="btn btn-ghost btn-icon">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {isEdit ? (language === 'ar' ? 'تعديل موظف' : 'Edit Employee') : (language === 'ar' ? 'إضافة موظف' : 'Add Employee')}
          </h1>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Personal Info */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
              <User className="w-5 h-5 text-primary-600" />
            </div>
            <h3 className="text-lg font-semibold">{language === 'ar' ? 'المعلومات الشخصية' : 'Personal Information'}</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="label">{t('employeeId')} *</label>
              <input {...register('employeeId', { required: true })} className="input" placeholder="EMP-001" />
            </div>
            <div>
              <label className="label">{showArabicFields ? `${t('firstName')} (EN) *` : `${t('firstName')} *`}</label>
              <input {...register('firstNameEn', { required: true })} className="input" />
            </div>
            <div>
              <label className="label">{showArabicFields ? `${t('lastName')} (EN) *` : `${t('lastName')} *`}</label>
              <input {...register('lastNameEn', { required: true })} className="input" />
            </div>
            {showArabicFields ? (
              <>
                <div>
                  <label className="label">{t('firstName')} (AR)</label>
                  <input {...register('firstNameAr')} className="input" dir="rtl" />
                </div>
                <div>
                  <label className="label">{t('lastName')} (AR)</label>
                  <input {...register('lastNameAr')} className="input" dir="rtl" />
                </div>
              </>
            ) : (
              <>
                <input type="hidden" {...register('firstNameAr')} />
                <input type="hidden" {...register('lastNameAr')} />
              </>
            )}
            <div>
              <label className="label">{t('email')}</label>
              <input type="email" {...register('email')} className="input" />
            </div>
            <div>
              <label className="label">{language === 'ar' ? 'الهاتف' : 'Phone'}</label>
              <input {...register('phone')} className="input" placeholder={isPk ? "03xx xxxxxxx" : "+966 5x xxx xxxx"} />
            </div>
            <div>
              <label className="label">{language === 'ar' ? 'رقم بديل' : 'Alternate Contact Number'}</label>
              <input {...register('alternatePhone')} className="input" placeholder={isPk ? "03xx xxxxxxx" : "+966 5x xxx xxxx"} />
            </div>
            <div>
              <label className="label">{language === 'ar' ? 'تاريخ الميلاد' : 'Date of Birth'}</label>
              <input
                type="date"
                {...register('dateOfBirth', { setValueAs: (v) => (v === '' ? undefined : v) })}
                className="input"
              />
            </div>
            <div>
              <label className="label">{t('nationality')} *</label>
              <select {...register('nationality', { required: true })} className="select">
                <option value="">Select</option>
                <option value="Saudi">Saudi</option>
                <option value="Indian">Indian</option>
                <option value="Pakistani">Pakistani</option>
                <option value="Egyptian">Egyptian</option>
                <option value="Filipino">Filipino</option>
                <option value="Bangladeshi">Bangladeshi</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label className="label">{language === 'ar' ? 'الجنس' : 'Gender'}</label>
              <select {...register('gender', { setValueAs: (v) => (v === '' ? undefined : v) })} className="select">
                <option value="">{language === 'ar' ? 'اختر' : 'Select'}</option>
                <option value="male">{language === 'ar' ? 'ذكر' : 'Male'}</option>
                <option value="female">{language === 'ar' ? 'أنثى' : 'Female'}</option>
              </select>
            </div>
            <div>
              <label className="label">{language === 'ar' ? 'الحالة الاجتماعية' : 'Marital Status'}</label>
              <select {...register('maritalStatus', { setValueAs: (v) => (v === '' ? undefined : v) })} className="select">
                <option value="">{language === 'ar' ? 'اختر' : 'Select'}</option>
                <option value="single">{language === 'ar' ? 'أعزب' : 'Single'}</option>
                <option value="married">{language === 'ar' ? 'متزوج' : 'Married'}</option>
                <option value="divorced">{language === 'ar' ? 'مطلق' : 'Divorced'}</option>
                <option value="widowed">{language === 'ar' ? 'أرمل' : 'Widowed'}</option>
              </select>
            </div>
            <div>
              <label className="label">{language === 'ar' ? 'فصيلة الدم' : 'Blood Group'}</label>
              <select {...register('bloodGroup', { setValueAs: (v) => (v === '' ? undefined : v) })} className="select">
                <option value="">{language === 'ar' ? 'اختر' : 'Select'}</option>
                <option value="A+">A+</option>
                <option value="A-">A-</option>
                <option value="B+">B+</option>
                <option value="B-">B-</option>
                <option value="AB+">AB+</option>
                <option value="AB-">AB-</option>
                <option value="O+">O+</option>
                <option value="O-">O-</option>
              </select>
            </div>
            <div>
              <label className="label">{language === 'ar' ? 'رابط فيسبوك' : 'Facebook Link'}</label>
              <input type="url" {...register('socialLinks.facebook')} className="input" placeholder="https://facebook.com/..." />
            </div>
            <div>
              <label className="label">{language === 'ar' ? 'رابط X' : 'X Link'}</label>
              <input type="url" {...register('socialLinks.x')} className="input" placeholder="https://x.com/..." />
            </div>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.03 }} className="card p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <Shield className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-base font-medium text-gray-900 dark:text-white">{language === 'ar' ? 'الهوية السعودية / الإقامة' : 'Saudi ID / Iqama'}</h3>
              <p className="text-sm text-gray-500">{language === 'ar' ? 'تحقق فوري من صيغة الهوية السعودية أو الإقامة مع تتبع تاريخ الانتهاء' : 'Instant checksum validation and expiry tracking for Saudi National ID / Iqama.'}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="lg:col-span-2">
              <label className="label">{language === 'ar' ? 'رقم الهوية / الإقامة' : 'National ID / Iqama Number'}</label>
              <div className="flex gap-2">
                <input
                  {...register('nationalId')}
                  className={`input ${nationalIdValue && !saudiIdMeta.valid ? 'border-red-300 focus:border-red-500' : ''}`}
                  inputMode="numeric"
                  maxLength={10}
                  placeholder={language === 'ar' ? '10 أرقام تبدأ بـ 1 أو 2' : '10 digits starting with 1 or 2'}
                />
                <button
                  type="button"
                  onClick={() => lookupSaudiIdMutation.mutate()}
                  disabled={lookupSaudiIdMutation.isPending || !normalizeSaudiId(nationalIdValue)}
                  className="btn btn-secondary shrink-0"
                >
                  {lookupSaudiIdMutation.isPending ? (
                    <div className="w-4 h-4 border-2 border-gray-600 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Search className="w-4 h-4" />
                  )}
                  {language === 'ar' ? 'جلب التفاصيل' : 'Get Details'}
                </button>
              </div>
              {nationalIdValue ? (
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  <span className={`inline-flex rounded-full px-2.5 py-1 font-medium ${saudiIdMeta.valid ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'}`}>
                    {saudiIdMeta.valid
                      ? (language === 'ar' ? 'صيغة صحيحة' : 'Valid format')
                      : (language === 'ar' ? 'تحقق غير صالح' : 'Invalid checksum')}
                  </span>
                  <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-1 font-medium text-gray-600 dark:bg-dark-700 dark:text-gray-300">
                    {saudiIdTypeLabel}
                  </span>
                </div>
              ) : null}
              {saudiIdMeta.valid ? (
                <p className="mt-2 text-xs text-gray-500">
                  {linkedSaudiDocument
                    ? (language === 'ar' ? 'سيتم تحديث وثيقة الهوية المرتبطة تلقائياً عند الحفظ.' : 'The linked identity document will be updated automatically on save.')
                    : (language === 'ar' ? 'سيتم إنشاء وثيقة هوية مرتبطة تلقائياً عند الحفظ.' : 'A linked identity document will be created automatically on save.')}
                </p>
              ) : null}
              {lookupMeta?.duplicate?.exists ? (
                <p className="mt-2 text-xs text-red-600 dark:text-red-400">
                  {language === 'ar'
                    ? `هذا الرقم مستخدم بالفعل للموظف ${lookupMeta.duplicate.employeeName || lookupMeta.duplicate.employeeId || ''}`
                    : `This number is already used by employee ${lookupMeta.duplicate.employeeName || lookupMeta.duplicate.employeeId || ''}`}
                </p>
              ) : null}
              {lookupMeta?.message && !lookupMeta?.duplicate?.exists ? (
                <p className="mt-2 text-xs text-gray-500">{lookupMeta.message}</p>
              ) : null}
            </div>

            <div>
              <label className="label">{language === 'ar' ? 'تاريخ الإصدار' : 'Issue Date'}</label>
              <input type="date" {...register('nationalIdIssueDate', { setValueAs: (v) => (v === '' ? undefined : v) })} className="input" />
              {nationalIdIssueDateValue ? <p className="mt-2 text-xs text-gray-500">{toHijri(nationalIdIssueDateValue)}</p> : null}
              {!nationalIdIssueDateValue ? (
                <p className="mt-2 text-xs text-gray-500">
                  {language === 'ar'
                    ? 'يمكن تعبئة التفاصيل والصور تلقائياً فقط عند ربط خدمة خارجية للهوية أو OCR.'
                    : 'Full identity details and images can only be auto-filled when an external identity or OCR service is connected.'}
                </p>
              ) : null}
            </div>

            <div>
              <label className="label">{language === 'ar' ? 'النوع المكتشف' : 'Detected Type'}</label>
              <div className="input flex items-center bg-gray-50 text-sm text-gray-600 dark:bg-dark-800 dark:text-gray-300">
                {nationalIdValue ? saudiIdTypeLabel : '—'}
              </div>
            </div>

            {saudiIdMeta.isIqama && (
              <div>
                <label className="label">{language === 'ar' ? 'تاريخ انتهاء الإقامة' : 'Iqama Expiry Date'}</label>
                <input type="date" {...register('nationalIdExpiry', { setValueAs: (v) => (v === '' ? undefined : v) })} className="input" />
                {nationalIdExpiryValue ? <p className="mt-2 text-xs text-gray-500">{toHijri(nationalIdExpiryValue)}</p> : null}
              </div>
            )}
          </div>
        </motion.div>

        {/* ID Card Documents - Ultra Premium Minimalistic */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="card p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-dark-700 flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </div>
            <div>
              <h3 className="text-base font-medium text-gray-900 dark:text-white">{language === 'ar' ? 'وثائق الهوية' : 'Identity Documents'}</h3>
              <p className="text-sm text-gray-500">{language === 'ar' ? 'صور بطاقة الهوية الأمامية والخلفية' : 'Upload front and back of ID card'}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* ID Card Front */}
            <div>
              <input type="hidden" {...register('idCardFront')} />
              <div className={`relative group rounded-xl border transition-all ${idCardFrontValue ? 'border-gray-200 dark:border-dark-600 bg-gray-50 dark:bg-dark-800' : 'border-dashed border-gray-300 dark:border-dark-500 hover:border-gray-400 dark:hover:border-dark-400'}`}>
                {idCardFrontValue ? (
                  <div className="relative aspect-[16/10] p-3">
                    <img src={idCardFrontValue} alt="ID Front" className="w-full h-full object-contain rounded-lg" />
                    <button type="button" onClick={() => removeFile('idCardFront')} className="absolute top-2 right-2 w-7 h-7 rounded-full bg-gray-900/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <X className="w-4 h-4" />
                    </button>
                    <span className="absolute bottom-2 left-2 text-xs font-medium text-gray-500 dark:text-gray-400">{language === 'ar' ? 'الوجه الأمامي' : 'Front'}</span>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center aspect-[16/10] cursor-pointer p-6">
                    <Camera className="w-8 h-8 text-gray-400 mb-2" />
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">{language === 'ar' ? 'الوجه الأمامي' : 'Front Side'}</span>
                    <span className="text-xs text-gray-400 mt-1">PNG, JPG · 2MB max</span>
                    <input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, 'idCardFront')} className="hidden" />
                  </label>
                )}
              </div>
            </div>

            {/* ID Card Back */}
            <div>
              <input type="hidden" {...register('idCardBack')} />
              <div className={`relative group rounded-xl border transition-all ${idCardBackValue ? 'border-gray-200 dark:border-dark-600 bg-gray-50 dark:bg-dark-800' : 'border-dashed border-gray-300 dark:border-dark-500 hover:border-gray-400 dark:hover:border-dark-400'}`}>
                {idCardBackValue ? (
                  <div className="relative aspect-[16/10] p-3">
                    <img src={idCardBackValue} alt="ID Back" className="w-full h-full object-contain rounded-lg" />
                    <button type="button" onClick={() => removeFile('idCardBack')} className="absolute top-2 right-2 w-7 h-7 rounded-full bg-gray-900/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <X className="w-4 h-4" />
                    </button>
                    <span className="absolute bottom-2 left-2 text-xs font-medium text-gray-500 dark:text-gray-400">{language === 'ar' ? 'الوجه الخلفي' : 'Back'}</span>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center aspect-[16/10] cursor-pointer p-6">
                    <Camera className="w-8 h-8 text-gray-400 mb-2" />
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">{language === 'ar' ? 'الوجه الخلفي' : 'Back Side'}</span>
                    <span className="text-xs text-gray-400 mt-1">PNG, JPG · 2MB max</span>
                    <input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, 'idCardBack')} className="hidden" />
                  </label>
                )}
              </div>
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={() => lookupSaudiIdImagesMutation.mutate()}
              disabled={lookupSaudiIdImagesMutation.isPending || !hasIdentityImages}
              className="btn btn-secondary"
            >
              {lookupSaudiIdImagesMutation.isPending ? (
                <div className="w-4 h-4 border-2 border-gray-600 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
              {language === 'ar' ? 'جلب التفاصيل من الصور' : 'Get Details from Images'}
            </button>
          </div>
        </motion.div>

        {/* Balady Certificate & Health Certificates */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }} className="card p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <Shield className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h3 className="text-base font-medium text-gray-900 dark:text-white">{language === 'ar' ? 'الشهادة الصحية / بلدي' : 'Health & Balady Certificates'}</h3>
              <p className="text-sm text-gray-500">{language === 'ar' ? 'تتبع تاريخ انتهاء الشهادة الصحية للعاملين' : 'Track expiry dates for health certificates'}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="label">{language === 'ar' ? 'رقم شهادة بلدي' : 'Balady Certificate Number'}</label>
              <input {...register('baladyCertificateNumber')} className="input" placeholder="BAL-XXXXXXXX" />
            </div>
            <div>
              <label className="label">{language === 'ar' ? 'تاريخ انتهاء شهادة بلدي' : 'Balady Expiry Date'}</label>
              <input type="date" {...register('baladyCertificateExpiryDate')} className="input" />
            </div>
          </div>
        </motion.div>

        {/* Insurance Details - Ultra Premium Minimalistic */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="card p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-dark-700 flex items-center justify-center">
              <Heart className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </div>
            <div>
              <h3 className="text-base font-medium text-gray-900 dark:text-white">{language === 'ar' ? 'التأمين الصحي' : 'Health Insurance'}</h3>
              <p className="text-sm text-gray-500">{language === 'ar' ? 'بيانات التأمين الطبي للموظف' : 'Employee medical insurance details'}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="label">{language === 'ar' ? 'شركة التأمين' : 'Provider'}</label>
              <select {...register('insurance.provider')} className="select">
                <option value="">{language === 'ar' ? 'اختر' : 'Select'}</option>
                <option value="bupa">Bupa Arabia</option>
                <option value="tawuniya">Tawuniya</option>
                <option value="medgulf">Medgulf</option>
                <option value="alrajhi">Al Rajhi Takaful</option>
                <option value="walaa">Walaa Insurance</option>
                <option value="other">{language === 'ar' ? 'أخرى' : 'Other'}</option>
              </select>
            </div>
            <div>
              <label className="label">{language === 'ar' ? 'رقم البوليصة' : 'Policy No.'}</label>
              <input {...register('insurance.policyNumber')} className="input" placeholder="POL-XXXXXXXX" />
            </div>
            <div>
              <label className="label">{language === 'ar' ? 'رقم العضوية' : 'Member ID'}</label>
              <input {...register('insurance.memberId')} className="input" />
            </div>
            <div>
              <label className="label">{language === 'ar' ? 'فئة التأمين' : 'Class'}</label>
              <select {...register('insurance.class')} className="select">
                <option value="">{language === 'ar' ? 'اختر' : 'Select'}</option>
                <option value="VIP">VIP</option>
                <option value="A">A</option>
                <option value="B">B</option>
                <option value="C">C</option>
              </select>
            </div>
            <div>
              <label className="label">{language === 'ar' ? 'تاريخ البداية' : 'Start'}</label>
              <input type="date" {...register('insurance.startDate')} className="input" />
            </div>
            <div>
              <label className="label">{language === 'ar' ? 'تاريخ الانتهاء' : 'Expiry'}</label>
              <input type="date" {...register('insurance.expiryDate')} className="input" />
            </div>
          </div>
        </motion.div>

        {/* Guardian Details - Ultra Premium Minimalistic */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="card p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-dark-700 flex items-center justify-center">
                <Users className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </div>
              <div>
                <h3 className="text-base font-medium text-gray-900 dark:text-white">{language === 'ar' ? 'ولي الأمر / الطوارئ' : 'Guardian / Emergency'}</h3>
                <p className="text-sm text-gray-500">{language === 'ar' ? 'جهة الاتصال في حالات الطوارئ' : 'Emergency contact information'}</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" {...register('guardian.isEnabled')} className="sr-only peer" />
              <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-dark-600 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-dark-500 peer-checked:bg-primary-500"></div>
            </label>
          </div>
          
          <AnimatePresence>
            {guardianEnabled && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2 border-t border-gray-100 dark:border-dark-700">
                  <div className="lg:col-span-2 pt-4">
                    <label className="label">{language === 'ar' ? 'الاسم الكامل' : 'Full Name'}</label>
                    <input {...register('guardian.fullName')} className="input" />
                  </div>
                  <div className="pt-4">
                    <label className="label">{language === 'ar' ? 'صلة القرابة' : 'Relationship'}</label>
                    <select {...register('guardian.relationship')} className="select">
                      <option value="">{language === 'ar' ? 'اختر' : 'Select'}</option>
                      <option value="father">{language === 'ar' ? 'الأب' : 'Father'}</option>
                      <option value="mother">{language === 'ar' ? 'الأم' : 'Mother'}</option>
                      <option value="spouse">{language === 'ar' ? 'الزوج/ة' : 'Spouse'}</option>
                      <option value="sibling">{language === 'ar' ? 'أخ/أخت' : 'Sibling'}</option>
                      <option value="other">{language === 'ar' ? 'أخرى' : 'Other'}</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">{language === 'ar' ? 'الهاتف' : 'Phone'}</label>
                    <input {...register('guardian.phone')} className="input" placeholder="+966" />
                  </div>
                  <div>
                    <label className="label">{language === 'ar' ? 'هاتف بديل' : 'Alt. Phone'}</label>
                    <input {...register('guardian.alternatePhone')} className="input" />
                  </div>
                  <div>
                    <label className="label">{language === 'ar' ? 'رقم الهوية' : 'National ID'}</label>
                    <input {...register('guardian.nationalId')} className="input" />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          
          {!guardianEnabled && (
            <p className="text-sm text-gray-400 text-center py-4">{language === 'ar' ? 'قم بالتفعيل لإضافة بيانات ولي الأمر' : 'Enable to add guardian details'}</p>
          )}
        </motion.div>

        {/* Employment Details */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="card p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Briefcase className="w-5 h-5 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold">{language === 'ar' ? 'تفاصيل التوظيف' : 'Employment Details'}</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="label">{t('department')}</label>
              <input {...register('department')} className="input" />
            </div>
            <div>
              <label className="label">{showArabicFields ? `${t('position')} (EN)` : t('position')}</label>
              <input {...register('position')} className="input" />
            </div>
            {showArabicFields ? (
              <div>
                <label className="label">{t('position')} (AR)</label>
                <input {...register('positionAr')} className="input" dir="rtl" />
              </div>
            ) : (
              <input type="hidden" {...register('positionAr')} />
            )}
            <div>
              <label className="label">{t('joinDate')} *</label>
              <input type="date" {...register('joinDate', { required: true })} className="input" />
            </div>
            <div>
              <label className="label">{language === 'ar' ? 'نوع التوظيف' : 'Employment Type'}</label>
              <select {...register('employmentType')} className="select">
                <option value="full_time">{language === 'ar' ? 'دوام كامل' : 'Full Time'}</option>
                <option value="part_time">{language === 'ar' ? 'دوام جزئي' : 'Part Time'}</option>
                <option value="contract">{language === 'ar' ? 'عقد' : 'Contract'}</option>
              </select>
            </div>
          </div>
        </motion.div>

        {/* Salary */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="card p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
              <CreditCard className="w-5 h-5 text-emerald-600" />
            </div>
            <h3 className="text-lg font-semibold">{language === 'ar' ? 'الراتب والبدلات' : 'Salary & Allowances'}</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="label">
                <span className="inline-flex items-center gap-1.5">
                  {t('basicSalary')}
                  <CurrencySymbol currency={currency} />
                </span>
              </label>
              <input type="number" {...register('currentSalary.basicSalary', { valueAsNumber: true })} className="input" />
            </div>
            <div>
              <label className="label">
                <span className="inline-flex items-center gap-1.5">
                  {t('housingAllowance')}
                  <CurrencySymbol currency={currency} />
                </span>
              </label>
              <input type="number" {...register('currentSalary.housingAllowance', { valueAsNumber: true })} className="input" />
            </div>
            <div>
              <label className="label">
                <span className="inline-flex items-center gap-1.5">
                  {t('transportAllowance')}
                  <CurrencySymbol currency={currency} />
                </span>
              </label>
              <input type="number" {...register('currentSalary.transportAllowance', { valueAsNumber: true })} className="input" />
            </div>
            <div>
              <label className="label">
                <span className="inline-flex items-center gap-1.5">
                  {language === 'ar' ? 'بدل الطعام' : 'Food Allowance'}
                  <CurrencySymbol currency={currency} />
                </span>
              </label>
              <input type="number" {...register('currentSalary.foodAllowance', { valueAsNumber: true })} className="input" />
            </div>
            <div>
              <label className="label">
                <span className="inline-flex items-center gap-1.5">
                  {language === 'ar' ? 'بدلات أخرى' : 'Other Allowances'}
                  <CurrencySymbol currency={currency} />
                </span>
              </label>
              <input type="number" {...register('currentSalary.otherAllowances', { valueAsNumber: true })} className="input" />
            </div>
          </div>
        </motion.div>

        {/* Bank Details */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="card p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-violet-100 dark:bg-violet-900/30 rounded-lg">
              <FileText className="w-5 h-5 text-violet-600" />
            </div>
            <h3 className="text-lg font-semibold">{language === 'ar' ? 'البيانات البنكية (WPS)' : 'Bank Details (WPS)'}</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="label">{language === 'ar' ? 'اسم البنك' : 'Bank Name'}</label>
              <input {...register('bankDetails.bankName')} className="input" />
            </div>
            <div>
              <label className="label">{language === 'ar' ? 'رمز البنك' : 'Bank Code'}</label>
              <input {...register('bankDetails.bankCode')} className="input" placeholder="10" />
            </div>
            <div>
              <label className="label">IBAN</label>
              <input {...register('bankDetails.iban')} className="input" placeholder="SA..." />
            </div>
            <div>
              <label className="label">{language === 'ar' ? 'رقم الحساب' : 'Account Number'}</label>
              <input {...register('bankDetails.accountNumber')} className="input" />
            </div>
            <div>
              <label className="label">SWIFT</label>
              <input {...register('bankDetails.swiftCode')} className="input" />
            </div>
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
