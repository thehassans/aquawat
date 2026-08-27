import { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { motion } from 'framer-motion'
import { 
  ArrowLeft, 
  Save, 
  Building2, 
  User, 
  Mail, 
  Phone, 
  MapPin,
  FileText,
  CreditCard,
  Users
} from 'lucide-react'
import api from '../../lib/api'
import { useTranslation } from '../../lib/translations'
import { getTenantCountryCode, isPakistanTenant, getTaxIdLabel, showArabicFields as isArabicTenantMarket, getTenantCurrency } from '../../lib/saudiTenant'

function pathWithPartnerId(returnTo, partnerId) {
  if (!returnTo || !partnerId) return returnTo
  try {
    const u = new URL(returnTo, window.location.origin)
    u.searchParams.set('partnerId', partnerId)
    return `${u.pathname}${u.search}${u.hash}`
  } catch {
    const sep = returnTo.includes('?') ? '&' : '?'
    return `${returnTo}${sep}partnerId=${encodeURIComponent(partnerId)}`
  }
}

export default function CustomerForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const returnTo = searchParams.get('returnTo')
  const namePrefill = searchParams.get('name') || ''
  const queryClient = useQueryClient()
  const { language } = useSelector((state) => state.ui)
  const { tenant } = useSelector((state) => state.auth)
  const { t } = useTranslation(language)
  const isEditing = Boolean(id)
  const showArabicFields = isArabicTenantMarket(tenant)
  const isPk = isPakistanTenant(tenant)
  const taxIdLabel = getTaxIdLabel(tenant)
  const tenantCountry = getTenantCountryCode(tenant)
  const backPath = returnTo || '/app/dashboard/customers'

  const { register, handleSubmit, reset, watch, setValue, formState: { errors, isSubmitting } } = useForm({
    defaultValues: {
      type: 'business',
      customerCode: '',
      name: namePrefill,
      nameAr: '',
      email: '',
      phone: '',
      mobile: '',
      vatNumber: '',
      crNumber: '',
      parentCompanyId: '',
      receivableAccountId: '',
      address: {
        street: '',
        city: '',
        district: '',
        postalCode: '',
        country: tenantCountry,
        buildingNumber: '',
        additionalNumber: ''
      },
      contactPerson: {
        name: '',
        email: '',
        phone: '',
        position: ''
      },
      paymentTerms: 'net30',
      creditLimit: 0,
      notes: '',
      isActive: true
    }
  })

  const customerType = watch('type')

  const { data: customer, isLoading } = useQuery({
    queryKey: ['customer', id],
    queryFn: () => api.get(`/customers/${id}`).then(res => res.data),
    enabled: isEditing
  })

  const { data: parentCompanies = [] } = useQuery({
    queryKey: ['customers-parent-companies'],
    queryFn: () => api.get('/customers', { params: { type: 'business', limit: 200, isActive: true } })
      .then((r) => r.data?.customers || r.data?.data || (Array.isArray(r.data) ? r.data : [])),
  })

  const { data: receivableAccounts = [] } = useQuery({
    queryKey: ['accounts-receivable'],
    queryFn: () => api.get('/accounting/accounts', { params: { type: 'asset', subtype: 'receivable' } })
      .then((r) => (Array.isArray(r.data) ? r.data : [])),
  })

  useEffect(() => {
    if (customer) {
      reset({
        ...customer,
        parentCompanyId: customer.parentCompanyId?._id || customer.parentCompanyId || '',
        receivableAccountId: customer.receivableAccountId?._id || customer.receivableAccountId || '',
      })
    }
  }, [customer, reset])

  useEffect(() => {
    if (!isEditing && namePrefill) setValue('name', namePrefill)
  }, [isEditing, namePrefill, setValue])

  const mutation = useMutation({
    mutationFn: (data) => {
      const payload = {
        ...data,
        parentCompanyId: data.parentCompanyId || null,
        receivableAccountId: data.receivableAccountId || null,
      }
      if (isEditing) {
        return api.put(`/customers/${id}`, payload)
      }
      return api.post('/customers', payload)
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries(['customers'])
      queryClient.invalidateQueries(['customer-stats'])
      const created = res?.data
      const newId = created?._id || id
      if (returnTo && newId) {
        navigate(pathWithPartnerId(returnTo, newId))
      } else {
        navigate('/app/dashboard/customers')
      }
    }
  })

  const onSubmit = (data) => {
    mutation.mutate(data)
  }

  if (isEditing && isLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(backPath)}
          className="p-2 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-xl transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        </button>
        <div className="flex flex-1 items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {isEditing 
              ? (language === 'ar' ? 'تعديل العميل' : 'Edit Customer')
              : (language === 'ar' ? 'عميل جديد' : 'New Customer')
            }
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {isEditing 
              ? (language === 'ar' ? 'تحديث بيانات العميل' : 'Update customer information')
              : (language === 'ar' ? 'أضف عميل جديد لنظامك' : 'Add a new customer to your system')
            }
          </p>
        </div>
        {isEditing && (
          <button
            type="button"
            onClick={() => navigate(`/app/dashboard/customers/${id}/statement`)}
            className="btn btn-secondary gap-2"
          >
            <FileText className="w-4 h-4" />
            {language === 'ar' ? 'كشف الحساب' : 'Statement'}
          </button>
        )}
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Customer Type */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card p-6"
        >
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            {language === 'ar' ? 'نوع العميل' : 'Customer Type'}
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <label className={`relative flex items-center gap-4 p-4 border-2 rounded-xl cursor-pointer transition-all ${
              customerType === 'business' 
                ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' 
                : 'border-gray-200 dark:border-dark-600 hover:border-gray-300'
            }`}>
              <input
                type="radio"
                value="business"
                {...register('type')}
                className="sr-only"
              />
              <div className={`p-3 rounded-xl ${customerType === 'business' ? 'bg-primary-500 text-white' : 'bg-gray-100 dark:bg-dark-700 text-gray-600 dark:text-gray-400'}`}>
                <Building2 className="w-6 h-6" />
              </div>
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">
                  {language === 'ar' ? 'شركة' : 'Business'}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {language === 'ar' ? 'منشأة تجارية مسجلة' : 'Registered business entity'}
                </p>
              </div>
            </label>

            <label className={`relative flex items-center gap-4 p-4 border-2 rounded-xl cursor-pointer transition-all ${
              customerType === 'individual' 
                ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' 
                : 'border-gray-200 dark:border-dark-600 hover:border-gray-300'
            }`}>
              <input
                type="radio"
                value="individual"
                {...register('type')}
                className="sr-only"
              />
              <div className={`p-3 rounded-xl ${customerType === 'individual' ? 'bg-primary-500 text-white' : 'bg-gray-100 dark:bg-dark-700 text-gray-600 dark:text-gray-400'}`}>
                <User className="w-6 h-6" />
              </div>
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">
                  {language === 'ar' ? 'فرد' : 'Individual'}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {language === 'ar' ? 'عميل شخصي' : 'Personal customer'}
                </p>
              </div>
            </label>
          </div>
        </motion.div>

        {/* Basic Information */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="card p-6"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
              <Users className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {language === 'ar' ? 'المعلومات الأساسية' : 'Basic Information'}
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6" dir="ltr">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {language === 'ar' ? 'رقم العميل (اختياري)' : 'Customer ID (Optional)'}
              </label>
              <input
                type="text"
                {...register('customerCode')}
                className="input"
                placeholder="1001"
              />
            </div>
            <div className={showArabicFields ? '' : 'md:col-span-2'}>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-baseline justify-between gap-2" dir="ltr">
                <span>{showArabicFields ? 'Name (EN) *' : 'Name *'}</span>
                {showArabicFields ? <span dir="rtl" className="font-medium text-gray-500">الاسم بالإنجليزية</span> : null}
              </label>
              <input
                type="text"
                {...register('name', { required: 'Name is required' })}
                className={`input ${errors.name ? 'border-red-500' : ''}`}
                placeholder={language === 'ar' ? 'اسم العميل' : 'Customer name'}
              />
              {errors.name && <p className="mt-1 text-sm text-red-500">{errors.name.message}</p>}
            </div>

            {showArabicFields ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-baseline justify-between gap-2" dir="ltr">
                  <span>Name (AR)</span>
                  <span dir="rtl" className="font-medium text-gray-500">الاسم بالعربية</span>
                </label>
                <input
                  type="text"
                  {...register('nameAr')}
                  className="input"
                  placeholder={language === 'ar' ? 'اسم العميل بالعربية' : 'Customer name in Arabic'}
                  dir="rtl"
                />
              </div>
            ) : (
              <input type="hidden" {...register('nameAr')} />
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  {language === 'ar' ? 'البريد الإلكتروني' : 'Email'}
                </div>
              </label>
              <input
                type="email"
                {...register('email', {
                  pattern: {
                    value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                    message: 'Invalid email address'
                  }
                })}
                className={`input ${errors.email ? 'border-red-500' : ''}`}
                placeholder="customer@example.com"
              />
              {errors.email && <p className="mt-1 text-sm text-red-500">{errors.email.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  {language === 'ar' ? 'رقم الهاتف' : 'Phone'}
                </div>
              </label>
              <input
                type="tel"
                {...register('phone')}
                className="input"
                placeholder={isPk ? "03xx xxxxxxx" : "+966 5x xxx xxxx"}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {language === 'ar' ? 'رقم الجوال' : 'Mobile'}
              </label>
              <input
                type="tel"
                {...register('mobile')}
                className="input"
                placeholder={isPk ? "03xx xxxxxxx" : "+966 5x xxx xxxx"}
              />
            </div>
          </div>
        </motion.div>

        {/* Tax & Registration */}
        {customerType === 'business' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="card p-6"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {language === 'ar' ? 'التسجيل الضريبي' : 'Tax & Registration'}
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {language === 'ar' ? 'الرقم الضريبي' : taxIdLabel}
                </label>
                <input
                  type="text"
                  {...register('vatNumber')}
                  className="input"
                  placeholder={isPk ? "e.g. 1234567-8" : "3xxxxxxxxxxxxxxx"}
                />
                <p className="mt-1 text-xs text-gray-500">
                  {isPk
                    ? (language === 'ar' ? 'رقم NTN أو STRN للعميل' : 'Customer NTN or STRN')
                    : (language === 'ar' ? '15 رقم تبدأ بـ 3' : '15 digits starting with 3')}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {language === 'ar' ? 'رقم السجل التجاري' : (isPk ? 'Business Registration / NTN' : 'CR Number')}
                </label>
                <input
                  type="text"
                  {...register('crNumber')}
                  className="input"
                  placeholder="xxxxxxxxxx"
                />
              </div>
            </div>
          </motion.div>
        )}

        {/* Address */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="card p-6"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <MapPin className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {language === 'ar' ? 'العنوان' : 'Address'}
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="md:col-span-2 lg:col-span-3">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {language === 'ar' ? 'الشارع' : 'Street'}
              </label>
              <input
                type="text"
                {...register('address.street')}
                className="input"
                placeholder={language === 'ar' ? 'اسم الشارع' : 'Street name'}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {language === 'ar' ? 'المدينة' : 'City'}
              </label>
              <input
                type="text"
                {...register('address.city')}
                className="input"
                placeholder={language === 'ar' ? 'المدينة' : 'City'}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {language === 'ar' ? 'الحي' : 'District'}
              </label>
              <input
                type="text"
                {...register('address.district')}
                className="input"
                placeholder={language === 'ar' ? 'الحي' : 'District'}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {language === 'ar' ? 'الرمز البريدي' : 'Postal Code'}
              </label>
              <input
                type="text"
                {...register('address.postalCode')}
                className="input"
                placeholder="12345"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {language === 'ar' ? 'رقم المبنى' : 'Building Number'}
              </label>
              <input
                type="text"
                {...register('address.buildingNumber')}
                className="input"
                placeholder="1234"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {language === 'ar' ? 'الرقم الإضافي' : 'Additional Number'}
              </label>
              <input
                type="text"
                {...register('address.additionalNumber')}
                className="input"
                placeholder="1234"
              />
            </div>
          </div>
        </motion.div>

        {/* Contact Person (for businesses) */}
        {customerType === 'business' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="card p-6"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-violet-100 dark:bg-violet-900/30 rounded-lg">
                <User className="w-5 h-5 text-violet-600 dark:text-violet-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {language === 'ar' ? 'جهة الاتصال' : 'Contact Person'}
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {language === 'ar' ? 'الاسم' : 'Name'}
                </label>
                <input
                  type="text"
                  {...register('contactPerson.name')}
                  className="input"
                  placeholder={language === 'ar' ? 'اسم جهة الاتصال' : 'Contact person name'}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {language === 'ar' ? 'المنصب' : 'Position'}
                </label>
                <input
                  type="text"
                  {...register('contactPerson.position')}
                  className="input"
                  placeholder={language === 'ar' ? 'المنصب' : 'Position'}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {language === 'ar' ? 'البريد الإلكتروني' : 'Email'}
                </label>
                <input
                  type="email"
                  {...register('contactPerson.email')}
                  className="input"
                  placeholder="contact@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {language === 'ar' ? 'رقم الهاتف' : 'Phone'}
                </label>
                <input
                  type="tel"
                  {...register('contactPerson.phone')}
                  className="input"
                  placeholder="+966 5x xxx xxxx"
                />
              </div>
            </div>
          </motion.div>
        )}

        {/* Hierarchy & Accounting */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className="card p-6"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-slate-100 dark:bg-dark-700 rounded-lg">
              <Building2 className="w-5 h-5 text-slate-700 dark:text-slate-200" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {language === 'ar' ? 'التسلسل المحاسبي' : 'Hierarchy & Accounting'}
              </h3>
              <p className="text-xs text-slate-400">
                {language === 'ar'
                  ? 'اربط الأفراد بالشركات الأم وحدد حساب الذمم المدينة'
                  : 'Link individuals to parent companies and set Accounts Receivable'}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {language === 'ar' ? 'الشركة الأم' : 'Parent Company'}
              </label>
              <select {...register('parentCompanyId')} className="input">
                <option value="">{language === 'ar' ? '— بدون —' : '— None —'}</option>
                {(parentCompanies || [])
                  .filter((c) => String(c._id) !== String(id))
                  .map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name || c.nameEn || c.customerCode || c._id}
                    </option>
                  ))}
              </select>
              {customerType === 'individual' && (
                <p className="mt-1 text-xs text-slate-400">
                  {language === 'ar' ? 'اختياري: ربط هذا الفرد بشركة' : 'Optional: attach this individual to a company'}
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {language === 'ar' ? 'حساب الذمم المدينة' : 'Accounts Receivable'}
              </label>
              <select {...register('receivableAccountId')} className="input">
                <option value="">{language === 'ar' ? '— افتراضي —' : '— Default —'}</option>
                {(receivableAccounts || []).map((a) => (
                  <option key={a._id} value={a._id}>
                    {a.code} · {language === 'ar' && a.nameAr ? a.nameAr : a.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </motion.div>

        {/* Payment Terms */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="card p-6"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
              <CreditCard className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {language === 'ar' ? 'شروط الدفع' : 'Payment Terms'}
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {language === 'ar' ? 'شروط السداد' : 'Payment Terms'}
              </label>
              <select {...register('paymentTerms')} className="input">
                <option value="immediate">{language === 'ar' ? 'فوري' : 'Immediate'}</option>
                <option value="net15">{language === 'ar' ? '15 يوم' : 'Net 15'}</option>
                <option value="net30">{language === 'ar' ? '30 يوم' : 'Net 30'}</option>
                <option value="net45">{language === 'ar' ? '45 يوم' : 'Net 45'}</option>
                <option value="net60">{language === 'ar' ? '60 يوم' : 'Net 60'}</option>
                <option value="net90">{language === 'ar' ? '90 يوم' : 'Net 90'}</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {language === 'ar' ? 'حد الائتمان' : 'Credit Limit'}
              </label>
              <input
                type="number"
                {...register('creditLimit', { valueAsNumber: true })}
                className="input"
                placeholder="0"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {language === 'ar' ? 'ملاحظات' : 'Notes'}
              </label>
              <textarea
                {...register('notes')}
                rows={3}
                className="input"
                placeholder={language === 'ar' ? 'ملاحظات إضافية...' : 'Additional notes...'}
              />
            </div>
          </div>
        </motion.div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-4">
          <button
            type="button"
            onClick={() => navigate(backPath)}
            className="btn btn-secondary"
          >
            {language === 'ar' ? 'إلغاء' : 'Cancel'}
          </button>
          <button
            type="submit"
            disabled={isSubmitting || mutation.isPending}
            className="btn btn-primary flex items-center gap-2"
          >
            {(isSubmitting || mutation.isPending) ? (
              <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {isEditing 
              ? (language === 'ar' ? 'تحديث' : 'Update')
              : (language === 'ar' ? 'حفظ' : 'Save')
            }
          </button>
        </div>

        {mutation.isError && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
            <p className="text-red-600 dark:text-red-400">
              {mutation.error?.response?.data?.error || mutation.error?.message || 'An error occurred'}
            </p>
          </div>
        )}
      </form>
    </div>
  )
}
