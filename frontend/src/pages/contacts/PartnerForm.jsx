import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import {
  ArrowLeft,
  Building2,
  CreditCard,
  FileText,
  MapPin,
  Plus,
  Save,
  Trash2,
  User,
  Users,
} from 'lucide-react'
import toast from 'react-hot-toast'
import api, { getImageUrl } from '../../lib/api'
import { useTranslation } from '../../lib/translations'
import AsyncCombobox from '../../components/ui/AsyncCombobox'
import {
  fetchDefaultPayableAccountId,
  fetchDefaultReceivableAccountId,
  validatePartnerVat,
} from '../../lib/partnerDefaults'
import { getTenantCountryCode, getTaxIdLabel, showArabicFields as isArabicTenantMarket } from '../../lib/saudiTenant'
import {
  backBtnClass,
  contactTabClass,
  contactsEyebrowClass,
  contactsSubtitleClass,
  contactsTitleClass,
  entitySegmentClass,
  entitySegmentWrapClass,
  fieldControlClass,
  fieldLabelClass,
  formCanvasClass,
  formTabBarClass,
  ghostActionClass,
  outlinedBtnClass,
  primaryBtnClass,
  roleCheckClass,
  sectionCardClass,
  softChipClass,
} from './contactsUi'

const TABS = [
  { id: 'general', en: 'General', ar: 'عام', icon: User },
  { id: 'sales', en: 'Sales & Purchase', ar: 'بيع وشراء', icon: Users },
  { id: 'accounting', en: 'Accounting', ar: 'محاسبة', icon: CreditCard },
]

const emptyBankRow = () => ({
  bankName: '',
  accountName: '',
  iban: '',
  accountNumber: '',
  isDefault: false,
})

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

/**
 * Unified Contacts App form — Company vs Individual, role from route/query.
 * Used for /customers/* and /suppliers/* create & edit.
 */
export default function PartnerForm() {
  const { id } = useParams()
  const isEditing = Boolean(id)
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const { language } = useSelector((state) => state.ui)
  const { tenant } = useSelector((state) => state.auth)
  const { t } = useTranslation(language)
  const ar = language === 'ar'
  const showArabic = isArabicTenantMarket(tenant)
  const taxIdLabel = getTaxIdLabel(tenant)
  const tenantCountry = getTenantCountryCode(tenant)

  const isSupplierRoute = location.pathname.includes('/suppliers')
  const roleParam = searchParams.get('role')
  const defaultVendor = isSupplierRoute || roleParam === 'vendor'
  const defaultEmployee = roleParam === 'employee'
  const returnTo = searchParams.get('returnTo')
  const namePrefill = searchParams.get('name') || ''
  const emailPrefill = searchParams.get('email') || ''
  const phonePrefill = searchParams.get('phone') || ''
  const entityPrefill = searchParams.get('entity') // individual | company

  const backPath = returnTo || (isSupplierRoute ? '/app/dashboard/suppliers' : '/app/dashboard/contacts?types=customer,supplier')

  const [tab, setTab] = useState('general')
  const [parentOption, setParentOption] = useState(null)
  const [salespersonOption, setSalespersonOption] = useState(null)
  const [logoUrl, setLogoUrl] = useState('')
  const [logoUploading, setLogoUploading] = useState(false)
  const [bankAccounts, setBankAccounts] = useState([emptyBankRow()])

  const { register, handleSubmit, reset, watch, setValue, formState: { errors, isSubmitting } } = useForm({
    defaultValues: {
      entity: entityPrefill === 'individual' || defaultEmployee ? 'individual' : 'company',
      nameEn: namePrefill,
      nameAr: '',
      email: emailPrefill,
      phone: phonePrefill,
      mobile: '',
      website: '',
      vatNumber: '',
      crNumber: '',
      parentCompanyId: '',
      jobTitle: '',
      receivableAccountId: '',
      payableAccountId: '',
      paymentTermsCustomer: 'net30',
      paymentTermsVendorTerm: 'net_30',
      salespersonId: '',
      vendorCurrency: 'SAR',
      salesPricelistId: '',
      address: {
        street: '',
        city: '',
        district: '',
        postalCode: '',
        country: tenantCountry || 'SA',
        buildingNumber: '',
        additionalNumber: '',
        shortAddress: '',
      },
      notes: '',
      isActive: true,
      isCustomer: !defaultVendor && !defaultEmployee,
      isVendor: defaultVendor,
      isEmployee: defaultEmployee,
    },
  })

  const entity = watch('entity')
  const isCompany = entity === 'company'
  const isCustomer = watch('isCustomer')
  const isVendor = watch('isVendor')
  const parentCompanyId = watch('parentCompanyId')

  const { data: existing, isLoading } = useQuery({
    queryKey: ['partner', id],
    queryFn: async () => {
      try {
        return await api.get(`/partners/${id}`).then((r) => r.data)
      } catch (err) {
        if (err?.response?.status !== 404) throw err
        const fallback = isSupplierRoute ? `/suppliers/${id}` : `/customers/${id}`
        return api.get(fallback).then((r) => r.data)
      }
    },
    enabled: isEditing,
  })

  const { data: receivableAccounts = [] } = useQuery({
    queryKey: ['accounts-receivable'],
    queryFn: () => api.get('/accounting/accounts', { params: { type: 'asset', subtype: 'receivable' } })
      .then((r) => (Array.isArray(r.data) ? r.data : [])),
  })

  const { data: payableAccounts = [] } = useQuery({
    queryKey: ['accounts-payable'],
    queryFn: () => api.get('/accounting/accounts', { params: { type: 'liability', subtype: 'payable' } })
      .then((r) => (Array.isArray(r.data) ? r.data : [])),
  })

  useEffect(() => {
    if (isEditing || !receivableAccounts.length && !payableAccounts.length) return
    ;(async () => {
      if (!watch('receivableAccountId')) {
        const idAr = await fetchDefaultReceivableAccountId()
        if (idAr) setValue('receivableAccountId', idAr)
      }
      if (!watch('payableAccountId')) {
        const idAp = await fetchDefaultPayableAccountId()
        if (idAp) setValue('payableAccountId', idAp)
      }
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing, receivableAccounts.length, payableAccounts.length])

  useEffect(() => {
    if (!existing) return
    const isInd = existing.type === 'individual'
    reset({
      entity: isInd ? 'individual' : 'company',
      nameEn: existing.nameEn || existing.name || '',
      nameAr: existing.nameAr || '',
      email: existing.email || '',
      phone: existing.phone || '',
      mobile: existing.mobile || '',
      website: existing.website || '',
      vatNumber: existing.vatNumber || '',
      crNumber: existing.crNumber || '',
      parentCompanyId: existing.parentCompanyId?._id || existing.parentCompanyId || '',
      jobTitle: existing.contactPerson?.position || '',
      receivableAccountId: existing.receivableAccountId?._id || existing.receivableAccountId || '',
      payableAccountId: existing.payableAccountId?._id || existing.payableAccountId || '',
      paymentTermsCustomer: existing.paymentTermsCustomer || existing.paymentTerms || 'net30',
      paymentTermsVendorTerm: existing.paymentTermsVendor?.term || existing.paymentTermsVendorTerm || existing.paymentTerms?.term || 'net_30',
      salespersonId: existing.salespersonId?._id || existing.salespersonId || '',
      vendorCurrency: existing.vendorCurrency || 'SAR',
      salesPricelistId: existing.salesPricelistId || '',
      address: {
        street: existing.address?.street || '',
        city: existing.address?.city || '',
        district: existing.address?.district || '',
        postalCode: existing.address?.postalCode || '',
        country: existing.address?.country || tenantCountry || 'SA',
        buildingNumber: existing.address?.buildingNumber || '',
        additionalNumber: existing.address?.additionalNumber || '',
        shortAddress: existing.address?.shortAddress || '',
      },
      notes: existing.notes || '',
      isActive: existing.isActive !== false,
      isCustomer: existing.isCustomer != null ? Boolean(existing.isCustomer) : !isSupplierRoute,
      isVendor: existing.isVendor != null ? Boolean(existing.isVendor) : isSupplierRoute,
      isEmployee: Boolean(existing.isEmployee),
    })
    if (existing.parentCompanyId && typeof existing.parentCompanyId === 'object') {
      setParentOption({
        ...existing.parentCompanyId,
        name: existing.parentCompanyId.name || existing.parentCompanyId.nameEn,
      })
    }
    if (existing.salespersonId && typeof existing.salespersonId === 'object') {
      const sp = existing.salespersonId
      const label = [sp.firstName, sp.lastName].filter(Boolean).join(' ') || sp.email || '—'
      setSalespersonOption({ ...sp, name: label })
    }
    if (existing.logoUrl) setLogoUrl(existing.logoUrl)
    const banks = existing.bankAccounts?.length
      ? existing.bankAccounts
      : (existing.bank?.iban || existing.bank?.bankName
        ? [{
          bankName: existing.bank.bankName || '',
          accountName: existing.bank.beneficiaryName || '',
          iban: existing.bank.iban || '',
          accountNumber: existing.bank.iban || '',
          isDefault: true,
        }]
        : [emptyBankRow()])
    setBankAccounts(banks)
  }, [existing, reset, isSupplierRoute, tenantCountry])

  const fetchCompanies = async (q) => {
    const res = await api.get('/partners/search', {
      params: { q, type: 'business', limit: 15 },
    }).catch(() => ({ data: { partners: [] } }))
    return (res.data?.partners || []).filter((p) => String(p._id) !== String(id))
  }

  const fetchSalespeople = async (q) => {
    const res = await api.get('/users', { params: { search: q, limit: 15, isActive: true } })
      .catch(() => ({ data: { users: [] } }))
    return (res.data?.users || []).map((u) => ({
      ...u,
      name: [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email,
    }))
  }

  const inheritFromParent = (opt) => {
    if (!opt) return
    if (opt.address) {
      setValue('address.street', opt.address.street || '')
      setValue('address.city', opt.address.city || '')
      setValue('address.district', opt.address.district || '')
      setValue('address.postalCode', opt.address.postalCode || '')
      setValue('address.country', opt.address.country || tenantCountry || 'SA')
      setValue('address.buildingNumber', opt.address.buildingNumber || '')
      setValue('address.additionalNumber', opt.address.additionalNumber || '')
    }
    if (opt.vatNumber) setValue('vatNumber', opt.vatNumber)
    if (opt.crNumber) setValue('crNumber', opt.crNumber)
    const arId = opt.receivableAccountId?._id || opt.receivableAccountId
    const apId = opt.payableAccountId?._id || opt.payableAccountId
    if (arId) setValue('receivableAccountId', arId)
    if (apId) setValue('payableAccountId', apId)
    if (opt.paymentTermsCustomer || (typeof opt.paymentTerms === 'string' && opt.paymentTerms)) {
      setValue('paymentTermsCustomer', opt.paymentTermsCustomer || opt.paymentTerms)
    }
    if (opt.paymentTermsVendor?.term || opt.paymentTerms?.term) {
      setValue('paymentTermsVendorTerm', opt.paymentTermsVendor?.term || opt.paymentTerms?.term)
    }
  }

  const mutation = useMutation({
    mutationFn: async (raw) => {
      const displayName = (raw.nameEn || '').trim()
      if (!displayName) {
        throw new Error(ar ? 'الاسم مطلوب' : 'Name is required')
      }

      const country = raw.address?.country || tenantCountry
      if (isCompany && raw.vatNumber) {
        const vatCheck = validatePartnerVat(raw.vatNumber, country)
        if (!vatCheck.ok) throw new Error(ar ? vatCheck.messageAr : vatCheck.message)
      }

      const payload = {
        entity: raw.entity,
        nameEn: displayName,
        nameAr: raw.nameAr || '',
        email: raw.email || undefined,
        phone: raw.phone || undefined,
        mobile: raw.mobile || undefined,
        website: raw.website || undefined,
        vatNumber: raw.vatNumber || undefined,
        crNumber: isCompany ? (raw.crNumber || undefined) : undefined,
        address: raw.address,
        notes: raw.notes || undefined,
        isActive: raw.isActive !== false,
        isCustomer: Boolean(raw.isCustomer),
        isVendor: Boolean(raw.isVendor),
        isEmployee: Boolean(raw.isEmployee),
        parentCompanyId: !isCompany && raw.parentCompanyId ? raw.parentCompanyId : null,
        receivableAccountId: raw.isCustomer ? (raw.receivableAccountId || null) : null,
        payableAccountId: raw.isVendor ? (raw.payableAccountId || null) : null,
        paymentTerms: raw.paymentTermsCustomer || 'net30',
        paymentTermsVendorTerm: raw.paymentTermsVendorTerm || 'net_30',
        salespersonId: raw.salespersonId || null,
        vendorCurrency: raw.vendorCurrency || 'SAR',
        salesPricelistId: raw.salesPricelistId || null,
        logoUrl: logoUrl || undefined,
        bankAccounts: bankAccounts.filter((b) => b.bankName || b.iban || b.accountNumber),
        contactPerson: !isCompany && raw.jobTitle
          ? { name: displayName, position: raw.jobTitle, email: raw.email, phone: raw.mobile || raw.phone }
          : undefined,
      }

      if (isEditing) return api.put(`/partners/${id}`, payload).then((r) => r.data)
      return api.post('/partners', payload).then((r) => r.data)
    },
    onSuccess: (res) => {
      const partnerId = res?._id || id
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      queryClient.invalidateQueries({ queryKey: ['suppliers'] })
      queryClient.invalidateQueries({ queryKey: ['contacts'] })
      queryClient.invalidateQueries({ queryKey: ['partner', id] })
      toast.success(ar ? 'تم حفظ جهة الاتصال' : 'Contact saved')
      if (returnTo && partnerId) {
        navigate(pathWithPartnerId(returnTo, partnerId))
      } else if (isSupplierRoute) {
        navigate(`/app/dashboard/suppliers/${partnerId}`)
      } else {
        navigate(`/app/dashboard/customers/${partnerId}`)
      }
    },
    onError: (err) => {
      const msg = err?.response?.data?.error || err?.message || (ar ? 'فشل الحفظ' : 'Save failed')
      toast.error(typeof msg === 'string' ? msg : (ar ? 'فشل الحفظ' : 'Save failed'))
    },
  })

  const onSubmit = (data) => {
    if (!data.isCustomer && !data.isVendor && !data.isEmployee) {
      toast.error(ar ? 'اختر دورًا واحدًا على الأقل' : 'Select at least one role')
      setTab('sales')
      return
    }
    mutation.mutate(data)
  }

  const updateBankRow = (index, field, value) => {
    setBankAccounts((rows) => rows.map((row, i) => (i === index ? { ...row, [field]: value } : row)))
  }

  const addBankRow = () => setBankAccounts((rows) => [...rows, emptyBankRow()])

  const removeBankRow = (index) => {
    setBankAccounts((rows) => (rows.length <= 1 ? [emptyBankRow()] : rows.filter((_, i) => i !== index)))
  }

  const salespersonId = watch('salespersonId')

  const title = useMemo(() => {
    if (isEditing) return ar ? 'تعديل جهة الاتصال' : 'Edit contact'
    return ar ? 'جهة اتصال جديدة' : 'New contact'
  }, [isEditing, ar])

  if (isEditing && isLoading) {
    return (
      <div className={`${formCanvasClass} flex items-center justify-center p-10`}>
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
      </div>
    )
  }

  return (
    <div className={formCanvasClass} dir={ar ? 'rtl' : 'ltr'}>
      <div className="mx-auto max-w-4xl space-y-5 px-4 py-6 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-start gap-3">
            <button type="button" onClick={() => navigate(backPath)} className={backBtnClass} aria-label={ar ? 'رجوع' : 'Back'}>
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div>
              <p className={contactsEyebrowClass}>{ar ? 'جهات الاتصال' : 'Contacts'}</p>
              <h1 className={contactsTitleClass}>{title}</h1>
              <p className={contactsSubtitleClass}>
                {ar
                  ? 'سجل موحّد للعملاء والموردين مع حقول المحاسبة والضريبة'
                  : 'Unified partner record with accounting, tax, and ZATCA fields'}
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={isSubmitting || mutation.isPending}
            onClick={handleSubmit(onSubmit)}
            className={primaryBtnClass}
          >
            <Save className="h-4 w-4" />
            {ar ? 'حفظ جهة الاتصال' : 'Save contact'}
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className={sectionCardClass}>
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <span className={fieldLabelClass}>{ar ? 'الكيان' : 'Entity'}</span>
                <div className={entitySegmentWrapClass}>
                  <button
                    type="button"
                    className={entitySegmentClass(isCompany)}
                    onClick={() => setValue('entity', 'company')}
                  >
                    <Building2 className="h-4 w-4" />
                    {ar ? 'شركة' : 'Company'}
                  </button>
                  <button
                    type="button"
                    className={entitySegmentClass(!isCompany)}
                    onClick={() => setValue('entity', 'individual')}
                  >
                    <User className="h-4 w-4" />
                    {ar ? 'فرد' : 'Individual'}
                  </button>
                </div>
              </div>
              <div>
                <span className={fieldLabelClass}>{ar ? 'الأدوار المحاسبية' : 'Accounting roles'}</span>
                <div className="flex flex-wrap gap-2 pt-1">
                  <label className={roleCheckClass}>
                    <input type="checkbox" className="rounded border-slate-300" {...register('isCustomer')} />
                    {ar ? 'عميل' : 'Customer'}
                  </label>
                  <label className={roleCheckClass}>
                    <input type="checkbox" className="rounded border-slate-300 text-teal-600 focus:ring-teal-600/20" {...register('isVendor')} />
                    {ar ? 'مورد' : 'Vendor'}
                  </label>
                  <label className={roleCheckClass}>
                    <input type="checkbox" className="rounded border-slate-300" {...register('isEmployee')} />
                    {ar ? 'موظف' : 'Employee'}
                  </label>
                </div>
                <p className="mt-1.5 text-[11px] text-slate-400">
                  {ar
                    ? 'نفس السجل يظهر في المبيعات و/أو المشتريات حسب الأدوار'
                    : 'Same record appears in sales and/or purchases based on roles'}
                </p>
              </div>
            </div>

            <div className="mt-5 border-t border-slate-100 pt-5 dark:border-white/[0.06]">
              <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="sm:col-span-2">
                    <span className={fieldLabelClass}>{ar ? 'الاسم (EN)' : 'Name (EN)'} *</span>
                    <input className={fieldControlClass} {...register('nameEn', { required: true })} />
                    {errors.nameEn && <span className="mt-1 block text-xs text-rose-600">{t('required') || 'Required'}</span>}
                  </label>
                  <label className="sm:col-span-2">
                    <span className={fieldLabelClass}>{ar ? 'الاسم (AR)' : 'Name (AR)'}</span>
                    <input className={fieldControlClass} dir="rtl" {...register('nameAr')} />
                  </label>
                  {!isCompany && (
                    <label className="sm:col-span-2">
                      <span className={fieldLabelClass}>{ar ? 'المسمى الوظيفي' : 'Job position / title'}</span>
                      <input className={fieldControlClass} {...register('jobTitle')} />
                    </label>
                  )}
                  {!isCompany && (
                    <div className="sm:col-span-2">
                      <span className={fieldLabelClass}>{ar ? 'الشركة المرتبطة' : 'Related company'}</span>
                      <AsyncCombobox
                        value={parentCompanyId || null}
                        selectedOption={parentOption}
                        debounceMs={300}
                        minChars={1}
                        queryKeyPrefix="partner-related-company"
                        fetchOptions={fetchCompanies}
                        placeholder={ar ? 'ابحث عن شركة…' : 'Search company…'}
                        noResultsText={ar ? 'لا توجد نتائج' : 'No results'}
                        getOptionLabel={(c) => (ar && c.nameAr ? c.nameAr : c.name || c.nameEn) || '—'}
                        getOptionSub={(c) => [c.customerCode || c.supplierCode, c.vatNumber].filter(Boolean).join(' · ')}
                        onChange={async (pid, opt) => {
                          setValue('parentCompanyId', pid || '')
                          setParentOption(opt || null)
                          if (pid) {
                            const full = await api.get(`/partners/${pid}`).then((r) => r.data).catch(() => opt)
                            inheritFromParent(full || opt)
                          }
                        }}
                      />
                      <p className="mt-1.5 text-[11px] text-slate-400">
                        {ar
                          ? 'يرث العنوان والرقم الضريبي وإعدادات المحاسبة من الشركة الأم'
                          : 'Inherits address, tax ID, and accounting settings from the parent company'}
                      </p>
                    </div>
                  )}
                </div>
                <div>
                  <span className={fieldLabelClass}>{ar ? 'الشعار / الصورة' : 'Logo / avatar'}</span>
                  <div className="flex items-center gap-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-4 dark:border-white/10 dark:bg-white/[0.03]">
                    <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl bg-white text-sm font-bold text-slate-500 ring-1 ring-slate-200 dark:bg-dark-800 dark:ring-white/10">
                      {logoUrl ? (
                        <img src={getImageUrl(logoUrl)} alt="" className="h-full w-full object-cover" />
                      ) : isCompany ? (
                        <Building2 className="h-6 w-6" />
                      ) : (
                        <User className="h-6 w-6" />
                      )}
                    </div>
                    <div>
                      <input
                        type="file"
                        accept="image/*"
                        className="block text-xs text-slate-600 file:me-3 file:rounded-lg file:border-0 file:bg-slate-800 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white"
                        onChange={async (e) => {
                          const file = e.target.files?.[0]
                          if (!file) return
                          if (file.size > 512000) {
                            toast.error(ar ? 'الصورة كبيرة جداً (500KB كحد أقصى)' : 'Image too large (max 500KB)')
                            return
                          }
                          setLogoUploading(true)
                          try {
                            const fd = new FormData()
                            fd.append('logo', file)
                            const res = await api.post('/partners/upload-logo', fd)
                            setLogoUrl(res.data?.logoUrl || '')
                          } catch (err) {
                            toast.error(err?.response?.data?.error || (ar ? 'فشل رفع الصورة' : 'Logo upload failed'))
                          } finally {
                            setLogoUploading(false)
                          }
                        }}
                        disabled={logoUploading}
                      />
                      {logoUploading && (
                        <p className="mt-1 text-[11px] text-slate-400">{ar ? 'جاري الرفع…' : 'Uploading…'}</p>
                      )}
                      {logoUrl && (
                        <button type="button" className="mt-1 text-[11px] text-rose-600" onClick={() => setLogoUrl('')}>
                          {ar ? 'إزالة' : 'Remove'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className={formTabBarClass}>
            {TABS.map((item) => {
              const Icon = item.icon
              const active = tab === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  className={contactTabClass(active)}
                  onClick={() => setTab(item.id)}
                >
                  <Icon className="h-3.5 w-3.5 opacity-70" />
                  {ar ? item.ar : item.en}
                </button>
              )
            })}
          </div>

          {tab === 'general' && (
            <div className={`${sectionCardClass} space-y-5`}>
              <div className="border-b border-slate-100 pb-5 dark:border-white/[0.06]">
                <div className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-200">
                  {ar ? 'بيانات التواصل' : 'Contact details'}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label>
                    <span className={fieldLabelClass}>{ar ? 'الهاتف' : 'Phone'}</span>
                    <input className={fieldControlClass} {...register('phone')} />
                  </label>
                  <label>
                    <span className={fieldLabelClass}>{ar ? 'الجوال' : 'Mobile'}</span>
                    <input className={fieldControlClass} {...register('mobile')} />
                  </label>
                  <label>
                    <span className={fieldLabelClass}>{ar ? 'البريد' : 'Email'}</span>
                    <input type="email" className={fieldControlClass} {...register('email')} />
                  </label>
                  {isCompany && (
                    <label>
                      <span className={fieldLabelClass}>{ar ? 'الموقع' : 'Website'}</span>
                      <input className={fieldControlClass} placeholder="https://" {...register('website')} />
                    </label>
                  )}
                </div>
              </div>

              <div className="border-t border-slate-100 pt-5 dark:border-white/[0.06]">
                <div className="mb-3 flex items-center gap-2 text-slate-800 dark:text-slate-200">
                  <MapPin className="h-4 w-4 opacity-60" />
                  <span className="text-sm font-semibold">
                    {tenantCountry === 'SA'
                      ? (ar ? 'العنوان الوطني (SPL)' : 'National address (SPL)')
                      : (ar ? 'العنوان' : 'Address')}
                  </span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {tenantCountry === 'SA' ? (
                    <label>
                      <span className={fieldLabelClass}>{ar ? 'العنوان المختصر' : 'Short address'}</span>
                      <input className={fieldControlClass} placeholder="RRRD2929" maxLength={8} {...register('address.shortAddress')} />
                    </label>
                  ) : null}
                  <label>
                    <span className={fieldLabelClass}>{ar ? 'رقم المبنى' : 'Building no.'}</span>
                    <input className={fieldControlClass} {...register('address.buildingNumber')} />
                  </label>
                  <label className="sm:col-span-2">
                    <span className={fieldLabelClass}>{ar ? 'اسم الشارع' : 'Street name'}</span>
                    <input className={fieldControlClass} {...register('address.street')} />
                  </label>
                  <label>
                    <span className={fieldLabelClass}>{ar ? 'الحي' : 'District'}</span>
                    <input className={fieldControlClass} {...register('address.district')} />
                  </label>
                  <label>
                    <span className={fieldLabelClass}>{ar ? 'المدينة' : 'City'}</span>
                    <input className={fieldControlClass} {...register('address.city')} />
                  </label>
                  <label>
                    <span className={fieldLabelClass}>{ar ? 'الرمز البريدي' : 'Postal code'}</span>
                    <input className={fieldControlClass} {...register('address.postalCode')} />
                  </label>
                  {tenantCountry === 'SA' ? (
                    <label>
                      <span className={fieldLabelClass}>{ar ? 'الرقم الإضافي' : 'Additional no.'}</span>
                      <input className={fieldControlClass} {...register('address.additionalNumber')} />
                    </label>
                  ) : null}
                  <label>
                    <span className={fieldLabelClass}>{ar ? 'الدولة' : 'Country'}</span>
                    <input className={fieldControlClass} {...register('address.country')} />
                  </label>
                </div>
              </div>

              {isCompany && (
                <div className="border-t border-slate-100 pt-5 dark:border-white/[0.06]">
                  <div className="mb-3 flex items-center gap-2 text-slate-800">
                    <FileText className="h-4 w-4 opacity-60" />
                    <span className="text-sm font-semibold">{ar ? 'الضريبة والقانوني' : 'Tax & legal'}</span>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label>
                      <span className={fieldLabelClass}>{taxIdLabel || (ar ? 'الرقم الضريبي' : 'Tax ID / VAT')}</span>
                      <input
                        className={fieldControlClass}
                        {...register('vatNumber')}
                        placeholder={tenantCountry === 'SA' ? '15 digits' : ''}
                      />
                      <p className="mt-1 text-[11px] text-slate-400">
                        {tenantCountry === 'SA'
                          ? (ar ? 'زاتكا: 15 رقمًا' : 'ZATCA: exactly 15 digits')
                          : null}
                      </p>
                    </label>
                    <label>
                      <span className={fieldLabelClass}>{ar ? 'السجل التجاري' : 'CR number'}</span>
                      <input className={fieldControlClass} {...register('crNumber')} />
                    </label>
                  </div>
                </div>
              )}

              <div className="border-t border-slate-100 pt-5 dark:border-white/[0.06]">
                <label>
                  <span className={fieldLabelClass}>{ar ? 'ملاحظات داخلية' : 'Internal notes'}</span>
                  <textarea className={`${fieldControlClass} min-h-[100px]`} {...register('notes')} />
                </label>
              </div>
            </div>
          )}

          {tab === 'sales' && (
            <div className={`${sectionCardClass} space-y-4`}>
              {isCustomer && (
                <>
                  <label>
                    <span className={fieldLabelClass}>{ar ? 'مندوب المبيعات' : 'Salesperson'}</span>
                    <AsyncCombobox
                      value={salespersonId || null}
                      selectedOption={salespersonOption}
                      debounceMs={300}
                      minChars={0}
                      queryKeyPrefix="partner-salesperson"
                      fetchOptions={fetchSalespeople}
                      placeholder={ar ? 'ابحث عن مستخدم…' : 'Search user…'}
                      noResultsText={ar ? 'لا توجد نتائج' : 'No results'}
                      getOptionLabel={(u) => u.name || u.email || '—'}
                      getOptionSub={(u) => u.email || ''}
                      onChange={(uid, opt) => {
                        setValue('salespersonId', uid || '')
                        setSalespersonOption(opt || null)
                      }}
                    />
                  </label>
                  <label>
                    <span className={fieldLabelClass}>{ar ? 'شروط دفع العميل' : 'Customer payment terms'}</span>
                    <select className={fieldControlClass} {...register('paymentTermsCustomer')}>
                      <option value="immediate">Immediate</option>
                      <option value="net15">Net 15</option>
                      <option value="net30">Net 30</option>
                      <option value="net45">Net 45</option>
                      <option value="net60">Net 60</option>
                      <option value="net90">Net 90</option>
                    </select>
                  </label>
                  <label>
                    <span className={fieldLabelClass}>{ar ? 'قائمة الأسعار' : 'Pricelist'}</span>
                    <input
                      className={fieldControlClass}
                      placeholder={ar ? 'معرف قائمة الأسعار (اختياري)' : 'Pricelist ID (optional)'}
                      {...register('salesPricelistId')}
                    />
                  </label>
                </>
              )}
              {isVendor && (
                <>
                  <label>
                    <span className={fieldLabelClass}>{ar ? 'شروط دفع المورد' : 'Vendor payment terms'}</span>
                    <select className={fieldControlClass} {...register('paymentTermsVendorTerm')}>
                      <option value="immediate">Immediate</option>
                      <option value="net_7">Net 7</option>
                      <option value="net_15">Net 15</option>
                      <option value="net_30">Net 30</option>
                      <option value="net_60">Net 60</option>
                    </select>
                  </label>
                  <label>
                    <span className={fieldLabelClass}>{ar ? 'عملة المورد' : 'Vendor currency'}</span>
                    <select className={fieldControlClass} {...register('vendorCurrency')}>
                      <option value="SAR">SAR</option>
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                      <option value="GBP">GBP</option>
                      <option value="AED">AED</option>
                    </select>
                  </label>
                </>
              )}
              {!isCustomer && !isVendor && (
                <p className="text-sm text-amber-800">{ar ? 'فعّل عميل أو مورد أعلاه' : 'Enable Customer or Vendor above'}</p>
              )}
            </div>
          )}

          {tab === 'accounting' && (
            <div className={`${sectionCardClass} space-y-5`}>
              {isCustomer && (
                <label>
                  <span className={fieldLabelClass}>{ar ? 'حسابات القبض' : 'Accounts receivable'}</span>
                  <select className={fieldControlClass} {...register('receivableAccountId')}>
                    <option value="">{ar ? 'الافتراضي من النظام' : 'System default'}</option>
                    {receivableAccounts.map((a) => (
                      <option key={a._id} value={a._id}>
                        {a.code} — {ar ? a.nameAr || a.name : a.name || a.nameEn}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {isVendor && (
                <label>
                  <span className={fieldLabelClass}>{ar ? 'حسابات الدفع' : 'Accounts payable'}</span>
                  <select className={fieldControlClass} {...register('payableAccountId')}>
                    <option value="">{ar ? 'الافتراضي من النظام' : 'System default'}</option>
                    {payableAccounts.map((a) => (
                      <option key={a._id} value={a._id}>
                        {a.code} — {ar ? a.nameAr || a.name : a.name || a.nameEn}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <div>
                <div className="mb-3 flex items-center justify-between">
                  <span className={fieldLabelClass}>{ar ? 'الحسابات البنكية' : 'Bank accounts'}</span>
                  <button type="button" className="inline-flex items-center gap-1 text-xs font-semibold text-sky-700" onClick={addBankRow}>
                    <Plus className="h-3.5 w-3.5" />
                    {ar ? 'إضافة' : 'Add row'}
                  </button>
                </div>
                <div className="space-y-3">
                  {bankAccounts.map((row, index) => (
                    <div key={index} className="grid gap-2 rounded-xl border border-slate-100 p-3 sm:grid-cols-2 dark:border-white/10">
                      <input
                        className={fieldControlClass}
                        placeholder={ar ? 'اسم البنك' : 'Bank name'}
                        value={row.bankName}
                        onChange={(e) => updateBankRow(index, 'bankName', e.target.value)}
                      />
                      <input
                        className={fieldControlClass}
                        placeholder={ar ? 'اسم الحساب' : 'Account name'}
                        value={row.accountName}
                        onChange={(e) => updateBankRow(index, 'accountName', e.target.value)}
                      />
                      <input
                        className={fieldControlClass}
                        placeholder="IBAN"
                        value={row.iban}
                        onChange={(e) => updateBankRow(index, 'iban', e.target.value)}
                      />
                      <div className="flex items-center gap-2">
                        <input
                          className={fieldControlClass}
                          placeholder={ar ? 'رقم الحساب' : 'Account number'}
                          value={row.accountNumber}
                          onChange={(e) => updateBankRow(index, 'accountNumber', e.target.value)}
                        />
                        <button type="button" className="shrink-0 rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600" onClick={() => removeBankRow(index)}>
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <label className="inline-flex items-center gap-2 text-sm text-slate-800">
                <input type="checkbox" className="rounded border-slate-300" {...register('isActive')} />
                {ar ? 'نشط' : 'Active'}
              </label>
            </div>
          )}

          <div className="flex justify-end gap-2 pb-8">
            <button type="button" className={outlinedBtnClass} onClick={() => navigate(backPath)}>
              {ar ? 'إلغاء' : 'Cancel'}
            </button>
            <button type="submit" className={primaryBtnClass} disabled={isSubmitting || mutation.isPending}>
              <Save className="h-4 w-4" />
              {ar ? 'حفظ جهة الاتصال' : 'Save contact'}
            </button>
          </div>
        </form>

        {isEditing && isCustomer && isVendor ? (
          <p className="pb-10 text-center text-xs text-slate-400">
            <Link to={`/app/dashboard/customers/${id}`} className="text-sky-700 hover:underline">
              {ar ? 'عرض كعميل' : 'Open as customer'}
            </Link>
            {' · '}
            <Link to={`/app/dashboard/suppliers/${id}`} className="text-amber-700 hover:underline">
              {ar ? 'عرض كمورد' : 'Open as supplier'}
            </Link>
          </p>
        ) : null}
      </div>
    </div>
  )
}
