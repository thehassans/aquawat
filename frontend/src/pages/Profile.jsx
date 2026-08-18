import React, { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSelector, useDispatch } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import {
  Building2,
  Building,
  User,
  Phone,
  Globe,
  FileText,
  Receipt,
  Shield,
  ShieldCheck,
  CheckCircle2,
  MapPin,
  Briefcase,
  Calendar,
  Lock,
  Key,
  KeyRound,
  Copy,
  Check,
  Edit3,
  ExternalLink,
  Layers,
  Crown,
  Server,
  Zap,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  Upload,
  Image as ImageIcon,
  Eye,
  EyeOff,
  Save,
  X,
  RefreshCw,
  Sliders,
  Clock,
  Wallet,
  Landmark,
  Store,
  Pill,
  UtensilsCrossed,
  Scissors,
  Shirt,
  Car,
  Wrench,
  BookOpen,
  ShoppingBag,
  Star,
  Trash2,
  Hash,
  ChevronRight,
  ArrowLeft
} from 'lucide-react'

import api from '../lib/api'
import { updateTenant, updateUser } from '../store/slices/authSlice'
import { getBusinessTypeOptions, getPrimaryBusinessType, getTenantBusinessTypes, normalizeBusinessTypes } from '../lib/businessTypes'
import { getAvailableUomOptions, getDefaultUom, getUomLabel } from '../lib/uomOptions'
import {
  formatPlanLimit,
  formatSubscriptionDate,
  getPlanDisplayName,
  getPlanLimits,
  getSubscriptionState,
  humanizeAppId,
} from '../lib/subscriptionState'
import RichTextNoteField from '../components/invoices/RichTextNoteField'

const BUSINESS_TYPE_ICONS = {
  trading: Store,
  construction: Building2,
  travel_agency: Globe,
  restaurant: UtensilsCrossed,
  car_rental: Car,
  laundry: Shirt,
  saloon: Scissors,
  khayyat: Shirt,
  boutique: ShoppingBag,
  manpower: User,
  bakala: Store,
  pharmacy: Pill,
  car_workshop: Wrench,
  bookstore: BookOpen,
  ecommerce: ShoppingBag,
  furniture_shop: Store,
}

export default function Profile() {
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const queryClient = useQueryClient()
  const { language, theme } = useSelector((state) => state.ui)
  const { user, tenant: authTenant } = useSelector((state) => state.auth)

  const [activeTab, setActiveTab] = useState('overview')
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false)
  const [copiedField, setCopiedField] = useState(null)
  const [logoPreview, setLogoPreview] = useState(null)
  const [signaturePreview, setSignaturePreview] = useState(null)
  const [stampPreview, setStampPreview] = useState(null)

  // Fetch fresh tenant data — never seed from slim auth.tenant (missing business).
  const { data: tenantData, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['current-tenant-profile'],
    queryFn: async () => {
      const res = await api.get('/tenants/current')
      const payload = res.data
      if (payload?._id) {
        dispatch(updateTenant(payload))
      }
      return payload
    },
    staleTime: 0,
    refetchOnMount: 'always',
  })

  const tenant = tenantData || authTenant || {}
  const business = tenant?.business || {}
  const nationalAddress = business?.nationalAddress || {}
  const commercialReg = business?.commercialRegistration || {}
  const vatCertificate = business?.vatCertificate || {}
  const bankDetails = business?.bankDetails || {}
  const subscription = tenant?.subscription || {}
  const branding = tenant?.branding || {}
  const invoiceBranding = tenant?.settings?.invoiceBranding || {}

  const businessTypes = getTenantBusinessTypes(tenant)
  const primaryBusinessType = getPrimaryBusinessType(tenant)
  const businessTypeOptions = getBusinessTypeOptions(language)

  const handleCopy = (text, fieldKey) => {
    if (!text) return
    navigator.clipboard.writeText(text)
    setCopiedField(fieldKey)
    toast.success(language === 'ar' ? 'تم النسخ إلى الحافظة' : 'Copied to clipboard')
    setTimeout(() => setCopiedField(null), 2000)
  }

  // --- EDIT PROFILE FORM ---
  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm()

  useEffect(() => {
    if (!tenant?._id) return
    const resolvedCr = business?.crNumber || commercialReg?.crNumber || ''
    const currentInvoiceBranding = tenant?.settings?.invoiceBranding || {}
    const signatureUrl = currentInvoiceBranding.presetSignature || currentInvoiceBranding.signatureImage || ''
    const stampUrl = currentInvoiceBranding.presetStamp || currentInvoiceBranding.stampImage || ''
    const defUom = getDefaultUom(tenant) || ''
    reset({
      business: {
        legalNameEn: business.legalNameEn || '',
        legalNameAr: business.legalNameAr || '',
        tradeName: business.tradeName || '',
        vatNumber: business.vatNumber || '',
        crNumber: resolvedCr,
        contactEmail: business.contactEmail || '',
        contactPhone: business.contactPhone || '',
        website: business.website || '',
        defaultUom: defUom,
        address: {
          city: business.address?.city || '',
          cityAr: business.address?.cityAr || '',
          district: business.address?.district || '',
          districtAr: business.address?.districtAr || '',
          street: business.address?.street || '',
          streetAr: business.address?.streetAr || '',
          buildingNumber: business.address?.buildingNumber || '',
          additionalNumber: business.address?.additionalNumber || '',
          postalCode: business.address?.postalCode || '',
          country: business.address?.country || 'SA',
        },
        nationalAddress: {
          proofNumber: nationalAddress.proofNumber || '',
          customerAccount: nationalAddress.customerAccount || '',
          originalDate: nationalAddress.originalDate ? nationalAddress.originalDate.split('T')[0] : '',
          expirationDate: nationalAddress.expirationDate ? nationalAddress.expirationDate.split('T')[0] : '',
          regDate: nationalAddress.regDate ? nationalAddress.regDate.split('T')[0] : '',
          shortAddress: nationalAddress.shortAddress || '',
          buildingNo: nationalAddress.buildingNo || '',
          neighborhood: nationalAddress.neighborhood || '',
          region: nationalAddress.region || '',
          qrCodeUrl: nationalAddress.qrCodeUrl || '',
        },
        commercialRegistration: {
          issueDate: commercialReg.issueDate ? commercialReg.issueDate.split('T')[0] : '',
          companyType: commercialReg.companyType || '',
          companyTypeAr: commercialReg.companyTypeAr || '',
          companyStatus: commercialReg.companyStatus || 'Active',
          companyStatusAr: commercialReg.companyStatusAr || 'نشط',
          qrCodeUrl: commercialReg.qrCodeUrl || '',
        },
        vatCertificate: {
          certificateNo: vatCertificate.certificateNo || '',
          certificateDate: vatCertificate.certificateDate ? vatCertificate.certificateDate.split('T')[0] : '',
          effectiveDate: vatCertificate.effectiveDate ? vatCertificate.effectiveDate.split('T')[0] : '',
          firstFilingDueDate: vatCertificate.firstFilingDueDate ? vatCertificate.firstFilingDueDate.split('T')[0] : '',
          taxPeriod: vatCertificate.taxPeriod || 'Quarterly',
          taxPeriodAr: vatCertificate.taxPeriodAr || 'ربع سنوي',
          qrCodeUrl: vatCertificate.qrCodeUrl || '',
        },
        bankDetails: {
          bankName: bankDetails.bankName || '',
          accountName: bankDetails.accountName || '',
          accountNumber: bankDetails.accountNumber || '',
          iban: bankDetails.iban || '',
        }
      },
      branding: {
        primaryColor: branding.primaryColor || '#0284c7',
        logo: branding.logo || '',
      },
      settings: {
        defaultUom: defUom,
        termsAndConditions: tenant?.settings?.termsAndConditions || currentInvoiceBranding.termsAndConditions || '',
        notes: tenant?.settings?.notes || currentInvoiceBranding.defaultNotes || '',
        invoiceBranding: {
          presetAuthorizedPersonName: currentInvoiceBranding.presetAuthorizedPersonName || '',
          presetAuthorizedPersonNameAr: currentInvoiceBranding.presetAuthorizedPersonNameAr || '',
          presetAuthorizedPersonDesignation: currentInvoiceBranding.presetAuthorizedPersonDesignation || '',
          presetAuthorizedPersonDesignationAr: currentInvoiceBranding.presetAuthorizedPersonDesignationAr || '',
          presetSignature: signatureUrl,
          presetStamp: stampUrl,
          termsAndConditions: currentInvoiceBranding.termsAndConditions || tenant?.settings?.termsAndConditions || '',
          defaultNotes: currentInvoiceBranding.defaultNotes || tenant?.settings?.notes || '',
        }
      }
    })
    setLogoPreview(branding.logo || null)
    setSignaturePreview(signatureUrl || null)
    setStampPreview(stampUrl || null)
  }, [tenant, isEditModalOpen, reset])

  const handleLogoUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 3 * 1024 * 1024) {
      toast.error(language === 'ar' ? 'حجم الصورة يجب أن لا يتجاوز 3 ميجابايت' : 'Image size must not exceed 3MB')
      return
    }
    const reader = new FileReader()
    reader.onload = (event) => {
      const dataUrl = event.target?.result
      setLogoPreview(dataUrl)
      setValue('branding.logo', dataUrl, { shouldDirty: true })
    }
    reader.readAsDataURL(file)
  }

  const handleRemoveLogo = () => {
    setLogoPreview('')
    setValue('branding.logo', '', { shouldDirty: true })
  }

  const handleSignatureUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      toast.error(language === 'ar' ? 'حجم التوقيع يجب أن لا يتجاوز 2 ميجابايت' : 'Signature size must not exceed 2MB')
      return
    }
    const reader = new FileReader()
    reader.onload = (event) => {
      const dataUrl = event.target?.result
      setSignaturePreview(dataUrl)
      setValue('settings.invoiceBranding.presetSignature', dataUrl, { shouldDirty: true })
    }
    reader.readAsDataURL(file)
  }

  const handleRemoveSignature = () => {
    setSignaturePreview('')
    setValue('settings.invoiceBranding.presetSignature', '', { shouldDirty: true })
  }

  const handleStampUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      toast.error(language === 'ar' ? 'حجم الختم يجب أن لا يتجاوز 2 ميجابايت' : 'Stamp size must not exceed 2MB')
      return
    }
    const reader = new FileReader()
    reader.onload = (event) => {
      const dataUrl = event.target?.result
      setStampPreview(dataUrl)
      setValue('settings.invoiceBranding.presetStamp', dataUrl, { shouldDirty: true })
    }
    reader.readAsDataURL(file)
  }

  const handleRemoveStamp = () => {
    setStampPreview('')
    setValue('settings.invoiceBranding.presetStamp', '', { shouldDirty: true })
  }

  const updateProfileMutation = useMutation({
    mutationFn: async (formData) => {
      const crVal = formData.business?.crNumber || ''
      const nextLogo = logoPreview == null ? String(formData.branding?.logo || '') : String(logoPreview || '')
      const nextSig = signaturePreview == null ? String(formData.settings?.invoiceBranding?.presetSignature || '') : String(signaturePreview || '')
      const nextStamp = stampPreview == null ? String(formData.settings?.invoiceBranding?.presetStamp || '') : String(stampPreview || '')
      const nextUom = formData.settings?.defaultUom ?? (getDefaultUom(tenant) || '')
      const nextTerms = formData.settings?.termsAndConditions || formData.settings?.invoiceBranding?.termsAndConditions || ''
      const nextNotes = formData.settings?.notes || formData.settings?.invoiceBranding?.defaultNotes || ''
      const payload = {
        ...formData,
        business: {
          ...formData.business,
          crNumber: crVal,
          defaultUom: nextUom,
          commercialRegistration: {
            ...formData.business.commercialRegistration,
            crNumber: crVal,
          }
        },
        branding: {
          ...(tenant.branding || {}),
          ...formData.branding,
          logo: nextLogo,
        },
        settings: {
          ...(tenant.settings || {}),
          ...(formData.settings || {}),
          defaultUom: nextUom,
          termsAndConditions: nextTerms,
          notes: nextNotes,
          invoiceBranding: {
            ...(tenant.settings?.invoiceBranding || {}),
            ...(formData.settings?.invoiceBranding || {}),
            logo: nextLogo,
            presetSignature: nextSig,
            signatureImage: nextSig,
            presetStamp: nextStamp,
            stampImage: nextStamp,
            presetAuthorizedPersonName: formData.settings?.invoiceBranding?.presetAuthorizedPersonName || '',
            presetAuthorizedPersonNameAr: formData.settings?.invoiceBranding?.presetAuthorizedPersonNameAr || '',
            presetAuthorizedPersonDesignation: formData.settings?.invoiceBranding?.presetAuthorizedPersonDesignation || '',
            presetAuthorizedPersonDesignationAr: formData.settings?.invoiceBranding?.presetAuthorizedPersonDesignationAr || '',
            termsAndConditions: nextTerms,
            defaultNotes: nextNotes,
          },
        },
      }
      const res = await api.put('/tenants/current', payload)
      return res.data
    },
    onSuccess: (updated) => {
      dispatch(updateTenant(updated))
      queryClient.setQueryData(['current-tenant-profile'], updated)
      toast.success(language === 'ar' ? 'تم تحديث الملف التعريفي للمنشأة بنجاح' : 'Company profile updated successfully')
      setIsEditModalOpen(false)
      refetch()
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || (language === 'ar' ? 'فشل تحديث البيانات' : 'Failed to update profile'))
    }
  })

  const onSaveProfile = (formData) => {
    updateProfileMutation.mutate(formData)
  }

  // --- CHANGE PASSWORD FORM ---
  const {
    register: registerPwd,
    handleSubmit: handleSubmitPwd,
    reset: resetPwd,
    formState: { errors: pwdErrors, isSubmitting: isSubmittingPwd },
  } = useForm()

  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)

  const passwordMutation = useMutation({
    mutationFn: async (pwdData) => {
      const res = await api.put('/auth/password', pwdData)
      return res.data
    },
    onSuccess: () => {
      toast.success(language === 'ar' ? 'تم تغيير كلمة المرور بنجاح' : 'Password changed successfully')
      setIsPasswordModalOpen(false)
      resetPwd()
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || (language === 'ar' ? 'فشل تغيير كلمة المرور' : 'Failed to change password'))
    }
  })

  const onChangePassword = (data) => {
    if (data.newPassword !== data.confirmPassword) {
      toast.error(language === 'ar' ? 'كلمات المرور الجديدة غير متطابقة' : 'New passwords do not match')
      return
    }
    passwordMutation.mutate({
      currentPassword: data.currentPassword,
      newPassword: data.newPassword,
    })
  }

  // --- USER INFO UPDATE ---
  const [isEditUserModalOpen, setIsEditUserModalOpen] = useState(false)
  const {
    register: registerUser,
    handleSubmit: handleSubmitUser,
    reset: resetUser,
    formState: { isSubmitting: isSubmittingUser }
  } = useForm()

  useEffect(() => {
    if (user) {
      resetUser({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        firstNameAr: user.firstNameAr || '',
        lastNameAr: user.lastNameAr || '',
        phone: user.phone || '',
      })
    }
  }, [user, isEditUserModalOpen, resetUser])

  const updateUserMutation = useMutation({
    mutationFn: async (userData) => {
      const res = await api.put('/auth/profile', userData)
      return res.data
    },
    onSuccess: (data) => {
      if (data.user) {
        dispatch(updateUser(data.user))
      }
      toast.success(language === 'ar' ? 'تم تحديث بيانات المستخدم' : 'User info updated')
      setIsEditUserModalOpen(false)
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || (language === 'ar' ? 'فشل التحديث' : 'Update failed'))
    }
  })

  const subState = useMemo(() => getSubscriptionState(tenant), [tenant])
  const planLimits = useMemo(() => getPlanLimits(tenant), [tenant])
  const planName = (subState.plan || 'trial').toUpperCase()
  const isSubActive = subState.isActive
  const isTrialEnded = subState.isTrialEnded
  const isSubExpired = subState.isExpired
  const daysRemaining = subState.daysLeft

  const { data: appStoreCatalog = [] } = useQuery({
    queryKey: ['app-store-apps'],
    queryFn: () => api.get('/app-store/apps').then((r) => r.data?.apps || r.data || []),
    enabled: activeTab === 'subscription',
    staleTime: 5 * 60 * 1000,
  })

  const installedModules = useMemo(() => {
    const appsMap = tenant?.settings?.installedApps || {}
    const catalogById = new Map(
      (Array.isArray(appStoreCatalog) ? appStoreCatalog : []).map((app) => [app.appId, app])
    )
    return Object.entries(appsMap)
      .filter(([, meta]) => meta?.isInstalled)
      .map(([appId, meta]) => {
        const catalog = catalogById.get(appId)
        return {
          appId,
          nameEn: catalog?.nameEn || humanizeAppId(appId),
          nameAr: catalog?.nameAr || catalog?.nameEn || humanizeAppId(appId),
          isEnabled: meta?.isEnabled !== false,
          installedAt: meta?.installedAt || null,
        }
      })
      .sort((a, b) => a.nameEn.localeCompare(b.nameEn))
  }, [tenant?.settings?.installedApps, appStoreCatalog])

  const tabs = [
    { id: 'overview', label: language === 'ar' ? 'بيانات المنشأة' : 'Company Overview', icon: Building2, color: 'text-blue-500', activeStyle: 'text-blue-700 dark:text-blue-300 bg-blue-50/80 dark:bg-blue-950/40 border-blue-200/80 dark:border-blue-800/60' },
    { id: 'signature_defaults', label: language === 'ar' ? 'التوقيع والختم والإعدادات' : 'Signature, Stamp & Defaults', icon: FileText, color: 'text-rose-500', activeStyle: 'text-rose-700 dark:text-rose-300 bg-rose-50/80 dark:bg-rose-950/40 border-rose-200/80 dark:border-rose-800/60' },
    { id: 'commercial', label: language === 'ar' ? 'السجل التجاري' : 'Commercial Reg.', icon: Briefcase, color: 'text-amber-500', activeStyle: 'text-amber-700 dark:text-amber-300 bg-amber-50/80 dark:bg-amber-950/40 border-amber-200/80 dark:border-amber-800/60' },
    { id: 'national_address', label: language === 'ar' ? 'العنوان الوطني' : 'National Address', icon: MapPin, color: 'text-sky-500', activeStyle: 'text-sky-700 dark:text-sky-300 bg-sky-50/80 dark:bg-sky-950/40 border-sky-200/80 dark:border-sky-800/60' },
    { id: 'vat_cert', label: language === 'ar' ? 'شهادة الضريبة' : 'VAT Certificate', icon: Receipt, color: 'text-teal-500', activeStyle: 'text-teal-700 dark:text-teal-300 bg-teal-50/80 dark:bg-teal-950/40 border-teal-200/80 dark:border-teal-800/60' },
    { id: 'bank', label: language === 'ar' ? 'الحسابات البنكية' : 'Bank Accounts', icon: Landmark, color: 'text-indigo-500', activeStyle: 'text-indigo-700 dark:text-indigo-300 bg-indigo-50/80 dark:bg-indigo-950/40 border-indigo-200/80 dark:border-indigo-800/60' },
    { id: 'subscription', label: language === 'ar' ? 'الاشتراك والتراخيص' : 'Subscription & License', icon: Crown, color: 'text-purple-500', activeStyle: 'text-purple-700 dark:text-purple-300 bg-purple-50/80 dark:bg-purple-950/40 border-purple-200/80 dark:border-purple-800/60' },
    { id: 'security', label: language === 'ar' ? 'المستخدم والأمان' : 'User & Security', icon: ShieldCheck, color: 'text-emerald-500', activeStyle: 'text-emerald-700 dark:text-emerald-300 bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-200/80 dark:border-emerald-800/60' },
  ]

  return (
    <div className="min-h-screen pb-16 space-y-8 animate-fade-in">
      {/* Back Button */}
      <div className="flex items-center">
        <button onClick={() => navigate('/app/dashboard')} className="btn btn-ghost btn-icon">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <span className="text-lg font-semibold ml-2">{language === 'ar' ? 'العودة للرئيسية' : 'Back to Dashboard'}</span>
      </div>

      {/* Ultra-premium company identity header */}
      <div className="relative overflow-hidden rounded-[2rem] border border-slate-200/70 bg-[#0b1220] text-white shadow-[0_40px_80px_-48px_rgba(15,23,42,0.65)] dark:border-white/10">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-24 start-1/4 h-64 w-64 rounded-full bg-emerald-400/20 blur-3xl" />
          <div className="absolute -bottom-28 end-0 h-72 w-72 rounded-full bg-sky-500/15 blur-3xl" />
          <div
            className="absolute inset-0 opacity-[0.08]"
            style={{
              backgroundImage:
                'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.55) 1px, transparent 0)',
              backgroundSize: '22px 22px',
            }}
          />
        </div>

        <div className="relative px-6 py-8 sm:px-10 sm:py-10">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex items-start gap-5 sm:gap-6">
              <div className="relative group">
                <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-[1.35rem] border border-white/15 bg-white/95 p-2.5 shadow-[0_20px_40px_-24px_rgba(0,0,0,0.55)] sm:h-28 sm:w-28">
                  {branding.logo ? (
                    <img src={branding.logo} alt="Company Logo" className="h-full w-full object-contain" />
                  ) : (
                    <Building2 className="h-10 w-10 text-slate-400" />
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(true)}
                  className="absolute -bottom-2 -end-2 rounded-xl bg-emerald-500 p-2 text-white shadow-lg transition hover:bg-emerald-400 hover:scale-105"
                  title={language === 'ar' ? 'تغيير الشعار' : 'Change Logo'}
                >
                  <Edit3 className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="min-w-0 space-y-3 pt-1">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-300/90">
                    {language === 'ar' ? 'ملف المنشأة' : 'Company profile'}
                  </p>
                  <h1 className="mt-1.5 text-3xl font-semibold tracking-[-0.03em] text-white sm:text-4xl">
                    {language === 'ar'
                      ? (business.legalNameAr || business.legalNameEn || tenant?.name || 'المنشأة')
                      : (business.legalNameEn || business.legalNameAr || tenant?.name || 'Business Profile')}
                  </h1>
                  {(business.tradeName || business.legalNameAr) && (
                    <p className="mt-1.5 text-sm font-medium text-white/55">
                      {business.tradeName && business.tradeName !== business.legalNameEn
                        ? business.tradeName
                        : (language !== 'ar' ? business.legalNameAr : business.legalNameEn)}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold ring-1 ${
                    isSubActive
                      ? 'bg-emerald-400/15 text-emerald-200 ring-emerald-300/30'
                      : 'bg-rose-400/15 text-rose-200 ring-rose-300/30'
                  }`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${isSubActive ? 'bg-emerald-300' : 'bg-rose-300'}`} />
                    {planName}
                    {' · '}
                    {isTrialEnded
                      ? (language === 'ar' ? 'انتهت التجربة' : 'Trial Ended')
                      : isSubExpired
                        ? (language === 'ar' ? 'منتهي' : 'Expired')
                        : isSubActive
                          ? (language === 'ar' ? 'نشط' : 'Active')
                          : (language === 'ar' ? 'تجريبي' : 'Trial')}
                  </span>

                  {(business.vatNumber || business.crNumber || commercialReg.crNumber) && (
                    <>
                      {business.vatNumber && (
                        <button
                          type="button"
                          onClick={() => handleCopy(business.vatNumber, 'vatTop')}
                          className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-1 text-[11px] font-medium text-white/80 ring-1 ring-white/10 transition hover:bg-white/10"
                        >
                          <Receipt className="h-3.5 w-3.5 text-teal-300" />
                          VAT {business.vatNumber}
                          {copiedField === 'vatTop' ? <Check className="h-3 w-3 text-emerald-300" /> : <Copy className="h-3 w-3 opacity-50" />}
                        </button>
                      )}
                      {(business.crNumber || commercialReg.crNumber) && (
                        <button
                          type="button"
                          onClick={() => handleCopy(business.crNumber || commercialReg.crNumber, 'crTop')}
                          className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-1 text-[11px] font-medium text-white/80 ring-1 ring-white/10 transition hover:bg-white/10"
                        >
                          <Briefcase className="h-3.5 w-3.5 text-amber-300" />
                          CR {business.crNumber || commercialReg.crNumber}
                          {copiedField === 'crTop' ? <Check className="h-3 w-3 text-emerald-300" /> : <Copy className="h-3 w-3 opacity-50" />}
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => setIsEditModalOpen(true)}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 shadow-lg transition hover:bg-emerald-50"
              >
                <Edit3 className="h-4 w-4" />
                {language === 'ar' ? 'تعديل المنشأة' : 'Edit profile'}
              </button>
              <button
                type="button"
                onClick={() => setIsPasswordModalOpen(true)}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/90 backdrop-blur transition hover:bg-white/10"
              >
                <KeyRound className="h-4 w-4 text-amber-300" />
                {language === 'ar' ? 'كلمة المرور' : 'Password'}
              </button>
              <button
                type="button"
                onClick={() => refetch()}
                disabled={isRefetching}
                className="rounded-2xl border border-white/15 bg-white/5 p-2.5 text-white/80 transition hover:bg-white/10"
                title={language === 'ar' ? 'تحديث البيانات' : 'Refresh Data'}
              >
                <RefreshCw className={`h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>

        <div className="relative flex items-center gap-1 overflow-x-auto border-t border-white/10 bg-black/20 px-3 py-2 sm:px-6 no-scrollbar">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 whitespace-nowrap rounded-xl px-3.5 py-2.5 text-xs font-semibold transition sm:text-sm ${
                  isActive
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-white/60 hover:bg-white/5 hover:text-white'
                }`}
              >
                <Icon className={`h-4 w-4 flex-shrink-0 ${isActive ? 'text-emerald-600' : 'text-white/40'}`} />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* TAB CONTENT AREAS */}
      <AnimatePresence mode="wait">
        {/* 1. OVERVIEW & COMPANY INFO */}
        {activeTab === 'overview' && (
          <motion.div
            key="overview"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-6"
          >
            {/* Left 2 Cols: Main Details */}
            <div className="lg:col-span-2 space-y-6">
              {/* Primary Identity Card */}
              <div className="card p-6 border border-gray-100 dark:border-dark-700 shadow-sm rounded-3xl">
                <div className="flex items-center justify-between pb-4 mb-6 border-b border-gray-100 dark:border-dark-700">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-gray-900 dark:text-white">
                        {language === 'ar' ? 'الهوية القانونية والتجارية' : 'Legal & Commercial Identity'}
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {language === 'ar' ? 'البيانات المسجلة رسمياً لدى الجهات الحكومية السعودية' : 'Official registration details filed with Saudi authorities'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsEditModalOpen(true)}
                    className="text-xs font-semibold text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    {language === 'ar' ? 'تعديل' : 'Edit'}
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="p-4 rounded-2xl bg-gray-50 dark:bg-dark-700/50 border border-gray-100 dark:border-dark-600/50">
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                      {language === 'ar' ? 'الاسم القانوني (بالعربية)' : 'Legal Name (Arabic)'}
                    </p>
                    <p className="text-base font-bold text-gray-900 dark:text-white" dir="rtl">
                      {business.legalNameAr || '—'}
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-gray-50 dark:bg-dark-700/50 border border-gray-100 dark:border-dark-600/50">
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                      {language === 'ar' ? 'الاسم القانوني (بالإنجليزية)' : 'Legal Name (English)'}
                    </p>
                    <p className="text-base font-bold text-gray-900 dark:text-white">
                      {business.legalNameEn || '—'}
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-gray-50 dark:bg-dark-700/50 border border-gray-100 dark:border-dark-600/50">
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                      {language === 'ar' ? 'الاسم التجاري / العلامة' : 'Trade / Brand Name'}
                    </p>
                    <p className="text-base font-bold text-gray-900 dark:text-white">
                      {business.tradeName || business.legalNameAr || business.legalNameEn || '—'}
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-gray-50 dark:bg-dark-700/50 border border-gray-100 dark:border-dark-600/50">
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                      {language === 'ar' ? 'الرقم الضريبي (ZATCA VAT)' : 'VAT Number (ZATCA)'}
                    </p>
                    <div className="flex items-center justify-between">
                      <p className="text-base font-mono font-bold text-teal-600 dark:text-teal-400">
                        {business.vatNumber || '—'}
                      </p>
                      {business.vatNumber && (
                        <button
                          onClick={() => handleCopy(business.vatNumber, 'vatCard')}
                          className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-dark-600 text-gray-500"
                        >
                          {copiedField === 'vatCard' ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-gray-50 dark:bg-dark-700/50 border border-gray-100 dark:border-dark-600/50">
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                      {language === 'ar' ? 'رقم السجل التجاري (CR Number)' : 'Commercial Registration No.'}
                    </p>
                    <div className="flex items-center justify-between">
                      <p className="text-base font-mono font-bold text-amber-600 dark:text-amber-400">
                        {business.crNumber || commercialReg.crNumber || '—'}
                      </p>
                      {(business.crNumber || commercialReg.crNumber) && (
                        <button
                          onClick={() => handleCopy(business.crNumber || commercialReg.crNumber, 'crCard')}
                          className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-dark-600 text-gray-500"
                        >
                          {copiedField === 'crCard' ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-gray-50 dark:bg-dark-700/50 border border-gray-100 dark:border-dark-600/50">
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                      {language === 'ar' ? 'البريد الإلكتروني للنشاط' : 'Official Contact Email'}
                    </p>
                    <p className="text-base font-semibold text-gray-900 dark:text-white truncate">
                      {business.contactEmail || '—'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Physical & Postal Address Card */}
              <div className="card p-6 border border-gray-100 dark:border-dark-700 shadow-sm rounded-3xl">
                <div className="flex items-center justify-between pb-4 mb-6 border-b border-gray-100 dark:border-dark-700">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-2xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
                      <MapPin className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-gray-900 dark:text-white">
                        {language === 'ar' ? 'العنوان الجغرافي والفرع الرئيسي' : 'Physical & Headquarters Address'}
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {language === 'ar' ? 'الموقع الفعلي للمنشأة المطبوع على الفواتير والسندات' : 'Physical headquarters address displayed on tax invoices'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="p-3.5 rounded-2xl bg-gray-50 dark:bg-dark-700/50">
                    <span className="text-xs text-gray-400 block mb-1">{language === 'ar' ? 'المدينة' : 'City'}</span>
                    <span className="font-bold text-gray-900 dark:text-white">{business.address?.cityAr || business.address?.city || '—'}</span>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-gray-50 dark:bg-dark-700/50">
                    <span className="text-xs text-gray-400 block mb-1">{language === 'ar' ? 'الحي' : 'District'}</span>
                    <span className="font-bold text-gray-900 dark:text-white">{business.address?.districtAr || business.address?.district || '—'}</span>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-gray-50 dark:bg-dark-700/50">
                    <span className="text-xs text-gray-400 block mb-1">{language === 'ar' ? 'الشارع' : 'Street'}</span>
                    <span className="font-bold text-gray-900 dark:text-white">{business.address?.streetAr || business.address?.street || '—'}</span>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-gray-50 dark:bg-dark-700/50">
                    <span className="text-xs text-gray-400 block mb-1">{language === 'ar' ? 'رقم المبنى' : 'Building No'}</span>
                    <span className="font-bold text-gray-900 dark:text-white">{business.address?.buildingNumber || nationalAddress.buildingNo || '—'}</span>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-gray-50 dark:bg-dark-700/50">
                    <span className="text-xs text-gray-400 block mb-1">{language === 'ar' ? 'الرقم الإضافي' : 'Additional No'}</span>
                    <span className="font-bold text-gray-900 dark:text-white">{business.address?.additionalNumber || '—'}</span>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-gray-50 dark:bg-dark-700/50">
                    <span className="text-xs text-gray-400 block mb-1">{language === 'ar' ? 'الرمز البريدي' : 'Postal Code'}</span>
                    <span className="font-bold font-mono text-gray-900 dark:text-white">{business.address?.postalCode || '—'}</span>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-gray-50 dark:bg-dark-700/50">
                    <span className="text-xs text-gray-400 block mb-1">{language === 'ar' ? 'الدولة' : 'Country'}</span>
                    <span className="font-bold text-gray-900 dark:text-white">{business.address?.country || 'SA (المملكة العربية السعودية)'}</span>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-gray-50 dark:bg-dark-700/50">
                    <span className="text-xs text-gray-400 block mb-1">{language === 'ar' ? 'الموقع الإلكتروني' : 'Website'}</span>
                    <span className="font-bold text-primary-600 dark:text-primary-400 truncate block">
                      {business.website ? <a href={business.website.startsWith('http') ? business.website : `https://${business.website}`} target="_blank" rel="noreferrer" className="hover:underline">{business.website}</a> : '—'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right 1 Col: Quick Cards */}
            <div className="space-y-6">
              {/* Business Sectors Card */}
              <div className="card p-6 border border-gray-100 dark:border-dark-700 shadow-sm rounded-3xl">
                <div className="flex items-center gap-3 pb-4 mb-4 border-b border-gray-100 dark:border-dark-700">
                  <div className="p-2.5 rounded-2xl bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400">
                    <Layers className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-gray-900 dark:text-white">
                      {language === 'ar' ? 'الأنشطة والقطاعات المفعلة' : 'Active Business Sectors'}
                    </h3>
                    <p className="text-xs text-gray-500">
                      {language === 'ar' ? `${businessTypes.length} قطاعات نشطة` : `${businessTypes.length} active sectors`}
                    </p>
                  </div>
                </div>

                <div className="space-y-2.5">
                  {businessTypes.map((typeId) => {
                    const opt = businessTypeOptions.find((o) => o.id === typeId) || { id: typeId, label: typeId }
                    const Icon = BUSINESS_TYPE_ICONS[typeId] || Store
                    const isPrimary = typeId === primaryBusinessType
                    return (
                      <div
                        key={typeId}
                        className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${
                          isPrimary
                            ? 'bg-primary-50/50 dark:bg-primary-950/20 border-primary-200 dark:border-primary-800/40 shadow-sm'
                            : 'bg-gray-50 dark:bg-dark-700/40 border-gray-100 dark:border-dark-600/40'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-xl ${isPrimary ? 'bg-primary-500 text-white' : 'bg-gray-200 dark:bg-dark-600 text-gray-600 dark:text-gray-300'}`}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-gray-900 dark:text-white">{opt.label}</p>
                            <p className="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-1">{opt.description}</p>
                          </div>
                        </div>
                        {isPrimary && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300">
                            {language === 'ar' ? 'الرئيسي' : 'Primary'}
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Admin User Quick Card */}
              <div className="card p-6 border border-gray-100 dark:border-dark-700 shadow-sm rounded-3xl">
                <div className="flex items-center justify-between pb-4 mb-4 border-b border-gray-100 dark:border-dark-700">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-2xl bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
                      <User className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-gray-900 dark:text-white">
                        {language === 'ar' ? 'المسؤول الحالي' : 'Account Administrator'}
                      </h3>
                      <p className="text-xs text-gray-500">{user?.role || 'Admin'}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsEditUserModalOpen(true)}
                    className="p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-dark-700 text-primary-600 dark:text-primary-400"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500 dark:text-gray-400">{language === 'ar' ? 'الاسم:' : 'Name:'}</span>
                    <span className="font-bold text-gray-900 dark:text-white">{user?.name || `${user?.firstName || ''} ${user?.lastName || ''}`}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500 dark:text-gray-400">{language === 'ar' ? 'البريد:' : 'Email:'}</span>
                    <span className="font-semibold text-gray-900 dark:text-white">{user?.email}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500 dark:text-gray-400">{language === 'ar' ? 'الجوال:' : 'Phone:'}</span>
                    <span className="font-semibold text-gray-900 dark:text-white">{user?.phone || '—'}</span>
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-gray-100 dark:border-dark-700">
                  <button
                    onClick={() => setIsPasswordModalOpen(true)}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-dark-700 dark:hover:bg-dark-600 text-gray-800 dark:text-gray-200 text-xs font-bold transition-colors"
                  >
                    <KeyRound className="w-4 h-4 text-amber-500" />
                    {language === 'ar' ? 'تغيير كلمة المرور' : 'Change Password'}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* SIGNATURE, STAMP & DEFAULTS TAB */}
        {activeTab === 'signature_defaults' && (
          <motion.div
            key="signature_defaults"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {/* Top Signatory & Stamps Card */}
            <div className="card p-6 sm:p-8 border border-gray-100 dark:border-dark-700 shadow-sm rounded-3xl relative overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 mb-6 border-b border-gray-100 dark:border-dark-700">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                      {language === 'ar' ? 'التوقيع، الختم، والمفوّض بالتوقيع' : 'Authorized Signatory, Signature & Stamp'}
                    </h3>
                    <p className="text-xs text-gray-500">
                      {language === 'ar' ? 'تُدرج هذه البيانات تلقائياً على الفواتير، عروض الأسعار، وسندات الشراء' : 'These details auto-fill onto invoices, quotations, and purchase orders'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsEditModalOpen(true)}
                  className="btn btn-secondary text-xs flex items-center gap-2 self-start sm:self-auto"
                >
                  <Edit3 className="w-4 h-4" />
                  {language === 'ar' ? 'تعديل التوقيع والختم' : 'Edit Signature & Stamp'}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <div className="p-4 rounded-2xl bg-gray-50 dark:bg-dark-700/50 border border-gray-100 dark:border-dark-600/50">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                    {language === 'ar' ? 'اسم المفوض (عربي)' : 'Authorized Person (Arabic)'}
                  </p>
                  <p className="text-base font-bold text-gray-900 dark:text-white" dir="rtl">
                    {invoiceBranding.presetAuthorizedPersonNameAr || '—'}
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-gray-50 dark:bg-dark-700/50 border border-gray-100 dark:border-dark-600/50">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                    {language === 'ar' ? 'اسم المفوض (إنجليزي)' : 'Authorized Person (English)'}
                  </p>
                  <p className="text-base font-bold text-gray-900 dark:text-white">
                    {invoiceBranding.presetAuthorizedPersonName || '—'}
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-gray-50 dark:bg-dark-700/50 border border-gray-100 dark:border-dark-600/50">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                    {language === 'ar' ? 'الصفة / المنصب (عربي)' : 'Designation (Arabic)'}
                  </p>
                  <p className="text-base font-semibold text-gray-900 dark:text-white" dir="rtl">
                    {invoiceBranding.presetAuthorizedPersonDesignationAr || '—'}
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-gray-50 dark:bg-dark-700/50 border border-gray-100 dark:border-dark-600/50">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                    {language === 'ar' ? 'الصفة / المنصب (إنجليزي)' : 'Designation (English)'}
                  </p>
                  <p className="text-base font-semibold text-gray-900 dark:text-white">
                    {invoiceBranding.presetAuthorizedPersonDesignation || '—'}
                  </p>
                </div>
              </div>

              {/* Visual previews of Signature & Stamp */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-6 rounded-3xl bg-slate-50 dark:bg-dark-900/40 border border-slate-200/80 dark:border-dark-600 flex flex-col items-center justify-center text-center min-h-[200px]">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-4">
                    {language === 'ar' ? 'توقيع المفوض المعتمد' : 'Authorized Signature'}
                  </p>
                  {invoiceBranding.presetSignature || invoiceBranding.signatureImage ? (
                    <div className="max-h-28 max-w-full flex items-center justify-center p-2 rounded-xl bg-white dark:bg-dark-800 border border-slate-200 dark:border-dark-700 shadow-sm">
                      <img
                        src={invoiceBranding.presetSignature || invoiceBranding.signatureImage}
                        alt="Signature"
                        className="max-h-24 object-contain"
                      />
                    </div>
                  ) : (
                    <div className="text-slate-400 dark:text-slate-500 text-xs flex flex-col items-center gap-2">
                      <FileText className="w-8 h-8 opacity-40" />
                      <span>{language === 'ar' ? 'لم يتم رفع توقيع بعد' : 'No signature uploaded yet'}</span>
                    </div>
                  )}
                </div>

                <div className="p-6 rounded-3xl bg-slate-50 dark:bg-dark-900/40 border border-slate-200/80 dark:border-dark-600 flex flex-col items-center justify-center text-center min-h-[200px]">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-4">
                    {language === 'ar' ? 'ختم المنشأة الرسمي' : 'Official Company Stamp'}
                  </p>
                  {invoiceBranding.presetStamp || invoiceBranding.stampImage ? (
                    <div className="max-h-28 max-w-full flex items-center justify-center p-2 rounded-xl bg-white dark:bg-dark-800 border border-slate-200 dark:border-dark-700 shadow-sm">
                      <img
                        src={invoiceBranding.presetStamp || invoiceBranding.stampImage}
                        alt="Stamp"
                        className="max-h-24 object-contain"
                      />
                    </div>
                  ) : (
                    <div className="text-slate-400 dark:text-slate-500 text-xs flex flex-col items-center gap-2">
                      <Shield className="w-8 h-8 opacity-40" />
                      <span>{language === 'ar' ? 'لم يتم رفع ختم بعد' : 'No stamp uploaded yet'}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Bottom Invoice & Document Defaults Card */}
            <div className="card p-6 sm:p-8 border border-gray-100 dark:border-dark-700 shadow-sm rounded-3xl relative overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 mb-6 border-b border-gray-100 dark:border-dark-700">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center">
                    <Sliders className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                      {language === 'ar' ? 'إعدادات المستندات ووحدة القياس الافتراضية' : 'Document Defaults & Default UOM'}
                    </h3>
                    <p className="text-xs text-gray-500">
                      {language === 'ar' ? 'الوحدة الافتراضية للمنتجات والفواتير وعروض الأسعار والشروط والأحكام' : 'Default UOM for products, invoices, quotations, and default terms & notes'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsEditModalOpen(true)}
                  className="btn btn-secondary text-xs flex items-center gap-2 self-start sm:self-auto"
                >
                  <Edit3 className="w-4 h-4" />
                  {language === 'ar' ? 'تعديل الإعدادات' : 'Edit Defaults'}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-4 rounded-2xl bg-gray-50 dark:bg-dark-700/50 border border-gray-100 dark:border-dark-600/50">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                    {language === 'ar' ? 'وحدة القياس الافتراضية (Default UOM)' : 'Default Unit of Measure (UOM)'}
                  </p>
                  <div className="text-base font-bold text-teal-700 dark:text-teal-300 flex items-center gap-2 mt-1">
                    {getDefaultUom(tenant) ? (
                      <>
                        <span className="px-2.5 py-1 rounded-lg bg-teal-100 dark:bg-teal-900/40 text-teal-800 dark:text-teal-200 text-xs font-mono">
                          {getDefaultUom(tenant)}
                        </span>
                        <span>{getUomLabel(getDefaultUom(tenant), language)}</span>
                      </>
                    ) : (
                      <span className="text-slate-400 text-sm font-normal">{language === 'ar' ? 'بدون وحدة افتراضية (اختياري)' : 'None (Optional)'}</span>
                    )}
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-gray-50 dark:bg-dark-700/50 border border-gray-100 dark:border-dark-600/50 md:col-span-2">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                    {language === 'ar' ? 'الشروط والأحكام الافتراضية' : 'Default Terms & Conditions'}
                  </p>
                  <p className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-line mt-1">
                    {tenant?.settings?.termsAndConditions || invoiceBranding.termsAndConditions || (language === 'ar' ? 'لا توجد شروط افتراضية مضافة' : 'No default terms added')}
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-gray-50 dark:bg-dark-700/50 border border-gray-100 dark:border-dark-600/50 md:col-span-3">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                    {language === 'ar' ? 'الملاحظات الافتراضية' : 'Default Notes'}
                  </p>
                  <p className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-line mt-1">
                    {tenant?.settings?.notes || invoiceBranding.defaultNotes || (language === 'ar' ? 'لا توجد ملاحظات افتراضية مضافة' : 'No default notes added')}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* 2. COMMERCIAL REGISTRATION */}
        {activeTab === 'commercial' && (
          <motion.div
            key="commercial"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            <div className="card p-6 sm:p-8 border border-gray-100 dark:border-dark-700 shadow-sm rounded-3xl relative overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 mb-6 border-b border-gray-100 dark:border-dark-700">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                    <Briefcase className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                        {language === 'ar' ? 'السجل التجاري (وزارة التجارة)' : 'Commercial Registration (Ministry of Commerce)'}
                      </h3>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                        {commercialReg.companyStatus || (language === 'ar' ? 'نشط' : 'Active')}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {language === 'ar' ? 'بيانات القيد في السجل التجاري لدى وزارة التجارة بالمملكة العربية السعودية' : 'Official registration records with Saudi Ministry of Commerce'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {commercialReg.qrCodeUrl && (
                    <a
                      href={commercialReg.qrCodeUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50 text-xs font-bold hover:bg-amber-100 transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      {language === 'ar' ? 'التحقق من السجل' : 'Verify CR Link'}
                    </a>
                  )}
                  <button
                    onClick={() => setIsEditModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary-50 dark:bg-primary-950/30 text-primary-600 dark:text-primary-400 border border-primary-200 dark:border-primary-800 text-xs font-bold hover:bg-primary-100 transition-colors"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    {language === 'ar' ? 'تعديل السجل' : 'Edit CR Details'}
                  </button>
                </div>
              </div>

              {/* Certificate Presentation Box */}
              <div className="p-6 rounded-3xl bg-gradient-to-br from-amber-500/5 via-amber-500/10 to-transparent border border-amber-500/20">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                      {language === 'ar' ? 'رقم السجل التجاري' : 'CR Number'}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-black font-mono text-gray-900 dark:text-white">
                        {business.crNumber || commercialReg.crNumber || '—'}
                      </span>
                      {(business.crNumber || commercialReg.crNumber) && (
                        <button
                          onClick={() => handleCopy(business.crNumber || commercialReg.crNumber, 'crTab')}
                          className="p-1 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/30 text-amber-600"
                        >
                          {copiedField === 'crTab' ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                      {language === 'ar' ? 'تاريخ الإصدار' : 'Issue Date'}
                    </span>
                    <p className="text-lg font-bold text-gray-900 dark:text-white">
                      {commercialReg.issueDate ? new Date(commercialReg.issueDate).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-GB') : '—'}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <span className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                      {language === 'ar' ? 'حالة السجل' : 'Commercial Status'}
                    </span>
                    <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 className="w-5 h-5" />
                      {language === 'ar' ? (commercialReg.companyStatusAr || 'نشط') : (commercialReg.companyStatus || 'Active')}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <span className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                      {language === 'ar' ? 'نوع الكيان (عربي)' : 'Company Type (Arabic)'}
                    </span>
                    <p className="text-base font-bold text-gray-900 dark:text-white" dir="rtl">
                      {commercialReg.companyTypeAr || 'شركة ذات مسؤولية محدودة'}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <span className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                      {language === 'ar' ? 'نوع الكيان (إنجليزي)' : 'Company Type (English)'}
                    </span>
                    <p className="text-base font-bold text-gray-900 dark:text-white">
                      {commercialReg.companyType || 'Limited Liability Company (LLC)'}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <span className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                      {language === 'ar' ? 'رابط التحقق الإلكتروني' : 'Verification QR URL'}
                    </span>
                    <p className="text-sm font-mono text-primary-600 dark:text-primary-400 truncate">
                      {commercialReg.qrCodeUrl || '—'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* 3. SAUDI NATIONAL ADDRESS */}
        {activeTab === 'national_address' && (
          <motion.div
            key="national_address"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            <div className="card p-6 sm:p-8 border border-gray-100 dark:border-dark-700 shadow-sm rounded-3xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 mb-6 border-b border-gray-100 dark:border-dark-700">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center">
                    <MapPin className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                        {language === 'ar' ? 'العنوان الوطني السعودي (البريد السعودي SPL)' : 'Saudi National Address (Saudi Post SPL)'}
                      </h3>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
                        SPL Verified
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {language === 'ar' ? 'إثبات العنوان الوطني المعتمد لجميع المعاملات البنكية والرسمية' : 'Official National Address certificate for banking and regulatory compliance'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {nationalAddress.qrCodeUrl && (
                    <a
                      href={nationalAddress.qrCodeUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-50 dark:bg-sky-950/30 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800 text-xs font-bold hover:bg-sky-100 transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      {language === 'ar' ? 'التحقق من إثبات العنوان' : 'Verify SPL Proof'}
                    </a>
                  )}
                  <button
                    onClick={() => setIsEditModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary-50 dark:bg-primary-950/30 text-primary-600 dark:text-primary-400 border border-primary-200 dark:border-primary-800 text-xs font-bold hover:bg-primary-100 transition-colors"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    {language === 'ar' ? 'تعديل العنوان' : 'Edit Address'}
                  </button>
                </div>
              </div>

              {/* National Address Highlighting Box */}
              <div className="p-6 rounded-3xl bg-gradient-to-br from-sky-500/5 via-sky-500/10 to-transparent border border-sky-500/20 space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-sky-700 dark:text-sky-400 uppercase tracking-wider">
                      {language === 'ar' ? 'العنوان الوطني المختصر' : 'Short National Address'}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-black font-mono text-gray-900 dark:text-white">
                        {nationalAddress.shortAddress || '—'}
                      </span>
                      {nationalAddress.shortAddress && (
                        <button
                          onClick={() => handleCopy(nationalAddress.shortAddress, 'shortTab')}
                          className="p-1 rounded-lg hover:bg-sky-100 dark:hover:bg-sky-900/30 text-sky-600"
                        >
                          {copiedField === 'shortTab' ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-xs font-bold text-sky-700 dark:text-sky-400 uppercase tracking-wider">
                      {language === 'ar' ? 'رقم الإثبات' : 'Proof Number'}
                    </span>
                    <p className="text-lg font-mono font-bold text-gray-900 dark:text-white">
                      {nationalAddress.proofNumber || '—'}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <span className="text-xs font-bold text-sky-700 dark:text-sky-400 uppercase tracking-wider">
                      {language === 'ar' ? 'حساب العميل / الرقم الإضافي' : 'Customer Account'}
                    </span>
                    <p className="text-lg font-mono font-bold text-gray-900 dark:text-white">
                      {nationalAddress.customerAccount || business.address?.additionalNumber || '—'}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <span className="text-xs font-bold text-sky-700 dark:text-sky-400 uppercase tracking-wider">
                      {language === 'ar' ? 'رقم المبنى' : 'Building No'}
                    </span>
                    <p className="text-lg font-bold text-gray-900 dark:text-white">
                      {nationalAddress.buildingNo || business.address?.buildingNumber || '—'}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-sky-500/20">
                  <div>
                    <span className="text-xs text-gray-400 block mb-1">{language === 'ar' ? 'الحي' : 'Neighborhood'}</span>
                    <span className="font-bold text-gray-900 dark:text-white">{nationalAddress.neighborhood || business.address?.district || '—'}</span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-400 block mb-1">{language === 'ar' ? 'المنطقة' : 'Region'}</span>
                    <span className="font-bold text-gray-900 dark:text-white">{nationalAddress.region || business.address?.city || '—'}</span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-400 block mb-1">{language === 'ar' ? 'تاريخ الإصدار الأصلي' : 'Original Date'}</span>
                    <span className="font-bold text-gray-900 dark:text-white">
                      {nationalAddress.originalDate ? new Date(nationalAddress.originalDate).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-GB') : '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-400 block mb-1">{language === 'ar' ? 'تاريخ الانتهاء' : 'Expiration Date'}</span>
                    <span className="font-bold text-gray-900 dark:text-white">
                      {nationalAddress.expirationDate ? new Date(nationalAddress.expirationDate).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-GB') : '—'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* 4. VAT REGISTRATION CERTIFICATE */}
        {activeTab === 'vat_cert' && (
          <motion.div
            key="vat_cert"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            <div className="card p-6 sm:p-8 border border-gray-100 dark:border-dark-700 shadow-sm rounded-3xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 mb-6 border-b border-gray-100 dark:border-dark-700">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center">
                    <Receipt className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                        {language === 'ar' ? 'شهادة تسجيل ضريبة القيمة المضافة (ZATCA)' : 'VAT Registration Certificate (ZATCA)'}
                      </h3>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-teal-100 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                        ZATCA Certified
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {language === 'ar' ? 'شهادة التسجيل الضريبي الرسمية الصادرة من هيئة الزكاة والضريبة والجمارك' : 'Official VAT certificate issued by Zakat, Tax and Customs Authority'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {vatCertificate.qrCodeUrl && (
                    <a
                      href={vatCertificate.qrCodeUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-50 dark:bg-teal-950/30 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 text-xs font-bold hover:bg-teal-100 transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      {language === 'ar' ? 'التحقق من الشهادة' : 'Verify ZATCA QR'}
                    </a>
                  )}
                  <button
                    onClick={() => setIsEditModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary-50 dark:bg-primary-950/30 text-primary-600 dark:text-primary-400 border border-primary-200 dark:border-primary-800 text-xs font-bold hover:bg-primary-100 transition-colors"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    {language === 'ar' ? 'تعديل الشهادة' : 'Edit Certificate'}
                  </button>
                </div>
              </div>

              {/* VAT Certificate Presentation Box */}
              <div className="p-6 rounded-3xl bg-gradient-to-br from-teal-500/5 via-teal-500/10 to-transparent border border-teal-500/20 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-teal-700 dark:text-teal-400 uppercase tracking-wider">
                      {language === 'ar' ? 'الرقم الضريبي' : 'VAT Number'}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-black font-mono text-gray-900 dark:text-white">
                        {business.vatNumber || '—'}
                      </span>
                      {business.vatNumber && (
                        <button
                          onClick={() => handleCopy(business.vatNumber, 'vatTab')}
                          className="p-1 rounded-lg hover:bg-teal-100 dark:hover:bg-teal-900/30 text-teal-600"
                        >
                          {copiedField === 'vatTab' ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-xs font-bold text-teal-700 dark:text-teal-400 uppercase tracking-wider">
                      {language === 'ar' ? 'رقم الشهادة الضريبية' : 'Certificate Number'}
                    </span>
                    <p className="text-lg font-mono font-bold text-gray-900 dark:text-white">
                      {vatCertificate.certificateNo || '—'}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <span className="text-xs font-bold text-teal-700 dark:text-teal-400 uppercase tracking-wider">
                      {language === 'ar' ? 'الفترة الضريبية' : 'Tax Period'}
                    </span>
                    <p className="text-lg font-bold text-teal-700 dark:text-teal-300">
                      {language === 'ar' ? (vatCertificate.taxPeriodAr || 'ربع سنوي') : (vatCertificate.taxPeriod || 'Quarterly')}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <span className="text-xs font-bold text-teal-700 dark:text-teal-400 uppercase tracking-wider">
                      {language === 'ar' ? 'تاريخ الشهادة' : 'Certificate Date'}
                    </span>
                    <p className="text-base font-bold text-gray-900 dark:text-white">
                      {vatCertificate.certificateDate ? new Date(vatCertificate.certificateDate).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-GB') : '—'}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <span className="text-xs font-bold text-teal-700 dark:text-teal-400 uppercase tracking-wider">
                      {language === 'ar' ? 'تاريخ التسجيل الفعّال' : 'Effective Registration Date'}
                    </span>
                    <p className="text-base font-bold text-gray-900 dark:text-white">
                      {vatCertificate.effectiveDate ? new Date(vatCertificate.effectiveDate).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-GB') : '—'}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <span className="text-xs font-bold text-teal-700 dark:text-teal-400 uppercase tracking-wider">
                      {language === 'ar' ? 'تاريخ أول إقرار ضريبي' : 'First Filing Due Date'}
                    </span>
                    <p className="text-base font-bold text-gray-900 dark:text-white">
                      {vatCertificate.firstFilingDueDate ? new Date(vatCertificate.firstFilingDueDate).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-GB') : '—'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* 5. BANK ACCOUNTS */}
        {activeTab === 'bank' && (
          <motion.div
            key="bank"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            <div className="card p-6 sm:p-8 border border-gray-100 dark:border-dark-700 shadow-sm rounded-3xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 mb-6 border-b border-gray-100 dark:border-dark-700">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                    <Landmark className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                      {language === 'ar' ? 'الحسابات والمعلومات البنكية' : 'Corporate Bank Details'}
                    </h3>
                    <p className="text-xs text-gray-500 mt-1">
                      {language === 'ar' ? 'الحسابات البنكية المعتمدة للتحويل واستقبال المدفوعات والطباعة على الفواتير' : 'Official bank details used for payments, transfers, and invoice footer'}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setIsEditModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary-50 dark:bg-primary-950/30 text-primary-600 dark:text-primary-400 border border-primary-200 dark:border-primary-800 text-xs font-bold hover:bg-primary-100 transition-colors"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  {language === 'ar' ? 'تعديل البيانات البنكية' : 'Edit Bank Info'}
                </button>
              </div>

              {/* Minimalist Bank Card Preview */}
              <div className="max-w-2xl mx-auto rounded-3xl bg-gradient-to-br from-slate-50 via-white to-indigo-50/40 dark:from-dark-800 dark:via-dark-800 dark:to-indigo-950/20 text-gray-900 dark:text-white p-6 sm:p-8 shadow-sm border border-gray-200/80 dark:border-dark-700 relative overflow-hidden">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-2xl bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400">
                      <Landmark className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider">{language === 'ar' ? 'اسم البنك' : 'Bank Name'}</p>
                      <h4 className="text-lg font-bold text-gray-900 dark:text-white">{bankDetails.bankName || (language === 'ar' ? 'البنك الأهلي السعودي / الراجحي' : 'Saudi National Bank')}</h4>
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                    SAR Account
                  </span>
                </div>

                <div className="space-y-5">
                  <div>
                    <span className="text-xs text-gray-500 dark:text-gray-400 block uppercase tracking-wider mb-1">IBAN</span>
                    <div className="flex items-center justify-between bg-white dark:bg-dark-700/60 px-4 py-3 rounded-2xl border border-gray-200/80 dark:border-dark-600 shadow-xs">
                      <span className="text-base sm:text-lg font-mono font-bold tracking-wider text-emerald-600 dark:text-emerald-400">
                        {bankDetails.iban || 'SA00 0000 0000 0000 0000 0000'}
                      </span>
                      {bankDetails.iban && (
                        <button
                          onClick={() => handleCopy(bankDetails.iban, 'ibanCard')}
                          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-600 text-gray-500 hover:text-gray-700 dark:text-gray-400"
                          title={language === 'ar' ? 'نسخ الآيبان' : 'Copy IBAN'}
                        >
                          {copiedField === 'ibanCard' ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-100 dark:border-dark-700">
                    <div>
                      <span className="text-xs text-gray-500 dark:text-gray-400 block uppercase tracking-wider mb-0.5">{language === 'ar' ? 'اسم صاحب الحساب' : 'Account Name'}</span>
                      <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{bankDetails.accountName || business.legalNameAr || business.legalNameEn || '—'}</p>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500 dark:text-gray-400 block uppercase tracking-wider mb-0.5">{language === 'ar' ? 'رقم الحساب' : 'Account Number'}</span>
                      <p className="text-sm font-mono font-bold text-gray-900 dark:text-white truncate">{bankDetails.accountNumber || '—'}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* 6. SUBSCRIPTION & LICENSE */}
        {activeTab === 'subscription' && (
          <motion.div
            key="subscription"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {/* Ultra-premium YOUR SUBSCRIPTION */}
            <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-white/10 dark:bg-[#0c111a]">
              <div className="px-6 py-7 sm:px-8 sm:py-8">
                <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
                      {language === 'ar' ? 'اشتراكك' : 'Your subscription'}
                    </p>
                    <h3 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-900 dark:text-white sm:text-[28px]">
                      {getPlanDisplayName(subState.plan, language)}
                    </h3>
                    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span
                        className={`inline-flex items-center gap-1.5 text-[12px] font-medium ${
                          isSubExpired
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-emerald-600 dark:text-emerald-400'
                        }`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${isSubExpired ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                        {isTrialEnded
                          ? (language === 'ar' ? 'انتهت التجربة' : 'Trial Ended')
                          : isSubExpired
                            ? (language === 'ar' ? 'منتهي' : 'Expired')
                            : (language === 'ar' ? 'نشط' : 'Active')}
                      </span>
                      {!isSubExpired && daysRemaining !== null && (
                        <span className="text-[12px] text-slate-400 dark:text-slate-500">
                          {language === 'ar' ? `${daysRemaining} يوم متبقي` : `${daysRemaining} days left`}
                        </span>
                      )}
                    </div>

                    {isSubExpired && (
                      <p className="mt-3 max-w-xl text-[13px] leading-relaxed text-slate-500 dark:text-slate-400">
                        {isTrialEnded
                          ? (language === 'ar'
                            ? 'انتهت فترة التجربة. يمكنك فتح النظام واختيار باقة جديدة للمتابعة.'
                            : 'Trial ended. Your tenant stays open — choose a plan to continue with full access.')
                          : (language === 'ar'
                            ? 'انتهى الاشتراك. يمكنك فتح النظام وتجديد الباقة في أي وقت.'
                            : 'Subscription expired. Your tenant stays open — renew anytime to restore full access.')}
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => navigate('/demo-checkout')}
                    className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-[13px] font-medium text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
                  >
                    {isTrialEnded
                      ? (language === 'ar' ? 'اشترك الآن' : 'Subscribe')
                      : (language === 'ar' ? 'تجديد الباقة' : 'Renew Plan')}
                    <ArrowRight className={`h-3.5 w-3.5 opacity-70 ${language === 'ar' ? 'rotate-180' : ''}`} />
                  </button>
                </div>

                <div className="mt-8 grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-slate-100 bg-slate-100 sm:grid-cols-3 dark:border-white/[0.08] dark:bg-white/[0.08]">
                  {[
                    {
                      label: language === 'ar' ? 'تاريخ البدء' : 'Start date',
                      value: formatSubscriptionDate(subState.startDate, language),
                    },
                    {
                      label: language === 'ar' ? 'دورة الفوترة' : 'Billing',
                      value: subState.billingCycle === 'yearly'
                        ? (language === 'ar' ? 'سنوي' : 'Yearly')
                        : (language === 'ar' ? 'شهري' : 'Monthly'),
                    },
                    {
                      label: language === 'ar' ? 'تاريخ الانتهاء' : 'Expires',
                      value: formatSubscriptionDate(subState.endDate, language),
                      alert: isSubExpired,
                    },
                    {
                      label: language === 'ar' ? 'حد الفواتير' : 'Invoice limit',
                      value: formatPlanLimit(planLimits.invoices, language),
                    },
                    {
                      label: language === 'ar' ? 'حد المستخدمين' : 'User limit',
                      value: formatPlanLimit(planLimits.users, language),
                    },
                    {
                      label: language === 'ar' ? 'حد عروض الأسعار' : 'Quotation limit',
                      value: formatPlanLimit(planLimits.quotations, language),
                    },
                  ].map((item) => (
                    <div key={item.label} className="bg-white px-4 py-3.5 dark:bg-[#0c111a]">
                      <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                        {item.label}
                      </p>
                      <p className={`mt-1.5 text-[14px] font-medium tabular-nums tracking-tight ${
                        item.alert ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-white'
                      }`}>
                        {item.value}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Installed Modules */}
            <div className="rounded-2xl border border-slate-200/80 bg-white px-6 py-6 sm:px-8 sm:py-7 dark:border-white/10 dark:bg-[#0c111a]">
              <div className="mb-5 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h4 className="text-[10px] font-medium uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
                    {language === 'ar' ? 'الوحدات المثبتة' : 'Installed modules'}
                  </h4>
                  <p className="mt-1.5 text-[13px] text-slate-500 dark:text-slate-400">
                    {language === 'ar'
                      ? 'التطبيقات المثبتة من متجر التطبيقات'
                      : 'Apps installed from the App Store'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/app/dashboard/app-store')}
                  className="inline-flex items-center gap-1.5 text-[12px] font-medium text-slate-700 transition hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                >
                  {language === 'ar' ? 'متجر التطبيقات' : 'App Store'}
                  <ArrowRight className={`h-3.5 w-3.5 ${language === 'ar' ? 'rotate-180' : ''}`} />
                </button>
              </div>

              {installedModules.length === 0 ? (
                <div className="border-t border-slate-100 py-10 text-center dark:border-white/[0.08]">
                  <p className="text-[13px] font-medium text-slate-600 dark:text-slate-300">
                    {language === 'ar' ? 'لا توجد وحدات مثبتة بعد' : 'No modules installed yet'}
                  </p>
                  <p className="mt-1 text-[12px] text-slate-400">
                    {language === 'ar' ? 'ثبّت التطبيقات من متجر التطبيقات لإظهارها هنا' : 'Install apps from the App Store to see them here'}
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-slate-100 border-t border-slate-100 dark:divide-white/[0.08] dark:border-white/[0.08]">
                  {installedModules.map((mod) => (
                    <li key={mod.appId} className="flex items-center justify-between gap-3 py-3.5">
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-medium text-slate-900 dark:text-white">
                          {language === 'ar' ? mod.nameAr : mod.nameEn}
                        </p>
                        <p className="mt-0.5 text-[11px] text-slate-400">
                          {mod.isEnabled
                            ? (language === 'ar' ? 'مثبت ومفعّل' : 'Installed · Enabled')
                            : (language === 'ar' ? 'مثبت · معطّل' : 'Installed · Disabled')}
                        </p>
                      </div>
                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${mod.isEnabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </motion.div>
        )}

        {/* 7. USER PROFILE & SECURITY */}
        {activeTab === 'security' && (
          <motion.div
            key="security"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-6"
          >
            {/* User Details Card */}
            <div className="card p-6 border border-gray-100 dark:border-dark-700 shadow-sm rounded-3xl space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-dark-700">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-2xl bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400">
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-gray-900 dark:text-white">
                      {language === 'ar' ? 'الملف الشخصي للمستخدم' : 'User Account Profile'}
                    </h3>
                    <p className="text-xs text-gray-500">{user?.email}</p>
                  </div>
                </div>

                <button
                  onClick={() => setIsEditUserModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary-50 dark:bg-primary-950/30 text-primary-600 dark:text-primary-400 text-xs font-bold hover:bg-primary-100 transition-colors"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  {language === 'ar' ? 'تعديل' : 'Edit'}
                </button>
              </div>

              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-gray-50 dark:bg-dark-700/50">
                  <span className="text-xs text-gray-400 block mb-1">{language === 'ar' ? 'الاسم الكامل' : 'Full Name'}</span>
                  <span className="text-base font-bold text-gray-900 dark:text-white">{user?.name || `${user?.firstName || ''} ${user?.lastName || ''}`}</span>
                </div>

                <div className="p-4 rounded-2xl bg-gray-50 dark:bg-dark-700/50">
                  <span className="text-xs text-gray-400 block mb-1">{language === 'ar' ? 'البريد الإلكتروني' : 'Email Address'}</span>
                  <span className="text-base font-semibold text-gray-900 dark:text-white">{user?.email}</span>
                </div>

                <div className="p-4 rounded-2xl bg-gray-50 dark:bg-dark-700/50">
                  <span className="text-xs text-gray-400 block mb-1">{language === 'ar' ? 'رقم الجوال' : 'Phone Number'}</span>
                  <span className="text-base font-semibold text-gray-900 dark:text-white">{user?.phone || '—'}</span>
                </div>

                <div className="p-4 rounded-2xl bg-gray-50 dark:bg-dark-700/50">
                  <span className="text-xs text-gray-400 block mb-1">{language === 'ar' ? 'الدور والصلاحيات' : 'Role & Privileges'}</span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    {user?.role || 'admin'}
                  </span>
                </div>
              </div>
            </div>

            {/* Change Password Card */}
            <div className="card p-6 border border-gray-100 dark:border-dark-700 shadow-sm rounded-3xl space-y-6">
              <div className="flex items-center gap-3 pb-4 border-b border-gray-100 dark:border-dark-700">
                <div className="p-2.5 rounded-2xl bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">
                    {language === 'ar' ? 'تغيير كلمة المرور' : 'Change Security Password'}
                  </h3>
                  <p className="text-xs text-gray-500">
                    {language === 'ar' ? 'تحديث كلمة المرور لحماية حسابك وبيانات منشأتك' : 'Update your password regularly to secure company records'}
                  </p>
                </div>
              </div>

              <form onSubmit={handleSubmitPwd(onChangePassword)} className="space-y-4">
                <div>
                  <label className="label">{language === 'ar' ? 'كلمة المرور الحالية' : 'Current Password'}</label>
                  <div className="relative">
                    <input
                      type={showCurrentPassword ? 'text' : 'password'}
                      {...registerPwd('currentPassword', { required: true })}
                      className="input pe-10"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute end-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="label">{language === 'ar' ? 'كلمة المرور الجديدة' : 'New Password'}</label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      {...registerPwd('newPassword', { required: true, minLength: 6 })}
                      className="input pe-10"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute end-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="label">{language === 'ar' ? 'تأكيد كلمة المرور الجديدة' : 'Confirm New Password'}</label>
                  <input
                    type="password"
                    {...registerPwd('confirmPassword', { required: true })}
                    className="input"
                    placeholder="••••••••"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmittingPwd || passwordMutation.isPending}
                  className="w-full btn btn-primary py-3 rounded-2xl font-bold flex items-center justify-center gap-2 mt-4"
                >
                  <Key className="w-4 h-4" />
                  {isSubmittingPwd || passwordMutation.isPending ? (language === 'ar' ? 'جاري الحفظ...' : 'Saving...') : (language === 'ar' ? 'تحديث كلمة المرور' : 'Update Password')}
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FULL EDIT COMPANY PROFILE MODAL */}
      <AnimatePresence>
        {isEditModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-dark-800 rounded-3xl shadow-2xl border border-gray-100 dark:border-dark-700 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden my-6"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 dark:border-dark-700 bg-gray-50/50 dark:bg-dark-800/50">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-primary-100 dark:bg-primary-900/30 text-primary-600">
                    <Edit3 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                      {language === 'ar' ? 'تعديل بيانات المنشأة' : 'Edit Company Details'}
                    </h3>
                    <p className="text-xs text-gray-500">
                      {language === 'ar' ? 'تحديث بيانات المنشأة، العناوين، السجلات، والحسابات البنكية' : 'Update company information, addresses, registrations, and bank details'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsEditModalOpen(false)}
                  className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-dark-700 text-gray-500"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <form onSubmit={handleSubmit(onSaveProfile)} className="flex-1 overflow-y-auto p-6 space-y-8">
                {/* 1. Logo & Brand */}
                <div className="space-y-4">
                  <h4 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2 border-b pb-2 dark:border-dark-700">
                    <ImageIcon className="w-4 h-4 text-primary-500" />
                    {language === 'ar' ? 'شعار المنشأة' : 'Company Logo'}
                  </h4>
                  <div className="flex items-center gap-6">
                    <div className="w-24 h-24 rounded-2xl bg-gray-100 dark:bg-dark-700 border border-gray-200 dark:border-dark-600 flex items-center justify-center overflow-hidden p-2">
                      {logoPreview ? (
                        <img src={logoPreview} alt="Preview" className="w-full h-full object-contain" />
                      ) : (
                        <Building2 className="w-8 h-8 text-gray-400" />
                      )}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="btn btn-secondary text-xs cursor-pointer inline-flex items-center gap-2">
                          <Upload className="w-4 h-4" />
                          {language === 'ar' ? 'رفع شعار جديد' : 'Upload New Logo'}
                          <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                        </label>
                        {logoPreview ? (
                          <button
                            type="button"
                            onClick={handleRemoveLogo}
                            className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            {language === 'ar' ? 'إزالة الشعار' : 'Remove Logo'}
                          </button>
                        ) : null}
                      </div>
                      <p className="text-xs text-gray-400 mt-1">PNG, JPG or WEBP (Max 3MB)</p>
                    </div>
                  </div>
                </div>

                {/* 2. Legal Identity */}
                <div className="space-y-4">
                  <h4 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2 border-b pb-2 dark:border-dark-700">
                    <Building2 className="w-4 h-4 text-indigo-500" />
                    {language === 'ar' ? 'البيانات القانونية والضريبية' : 'Legal & Tax Details'}
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="label">{language === 'ar' ? 'الاسم القانوني (عربي)' : 'Legal Name (Arabic)'} *</label>
                      <input {...register('business.legalNameAr', { required: true })} className="input" dir="rtl" />
                    </div>
                    <div>
                      <label className="label">{language === 'ar' ? 'الاسم القانوني (إنجليزي)' : 'Legal Name (English)'} *</label>
                      <input {...register('business.legalNameEn', { required: true })} className="input" />
                    </div>
                    <div>
                      <label className="label">{language === 'ar' ? 'الاسم التجاري / اسم المحل' : 'Trade Name'}</label>
                      <input {...register('business.tradeName')} className="input" />
                    </div>
                    <div>
                      <label className="label">{language === 'ar' ? 'الرقم الضريبي (VAT)' : 'VAT Number'}</label>
                      <input {...register('business.vatNumber')} className="input font-mono" placeholder="3XXXXXXXXXX00003" />
                    </div>
                    <div>
                      <label className="label">{language === 'ar' ? 'رقم السجل التجاري (CR)' : 'Commercial Reg. (CR)'}</label>
                      <input {...register('business.crNumber')} className="input font-mono" />
                    </div>
                    <div>
                      <label className="label">{language === 'ar' ? 'البريد الإلكتروني للنشاط' : 'Contact Email'}</label>
                      <input type="email" {...register('business.contactEmail')} className="input" />
                    </div>
                    <div>
                      <label className="label">{language === 'ar' ? 'رقم هاتف النشاط' : 'Contact Phone'}</label>
                      <input {...register('business.contactPhone')} className="input" placeholder="9665XXXXXXXX" />
                    </div>
                    <div>
                      <label className="label">{language === 'ar' ? 'الموقع الإلكتروني' : 'Website'}</label>
                      <input {...register('business.website')} className="input" placeholder="https://example.com" />
                    </div>
                  </div>
                </div>

                {/* 3. Physical Address */}
                <div className="space-y-4">
                  <h4 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2 border-b pb-2 dark:border-dark-700">
                    <MapPin className="w-4 h-4 text-emerald-500" />
                    {language === 'ar' ? 'العنوان الجغرافي والبريدي' : 'Physical Address Details'}
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="label">{language === 'ar' ? 'المدينة (عربي)' : 'City (Arabic)'}</label>
                      <input {...register('business.address.cityAr')} className="input" dir="rtl" />
                    </div>
                    <div>
                      <label className="label">{language === 'ar' ? 'المدينة (إنجليزي)' : 'City (English)'}</label>
                      <input {...register('business.address.city')} className="input" />
                    </div>
                    <div>
                      <label className="label">{language === 'ar' ? 'الحي' : 'District'}</label>
                      <input {...register('business.address.districtAr')} className="input" dir="rtl" />
                    </div>
                    <div>
                      <label className="label">{language === 'ar' ? 'الشارع' : 'Street'}</label>
                      <input {...register('business.address.streetAr')} className="input" dir="rtl" />
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
                      <label className="label">{language === 'ar' ? 'الرمز البريدي' : 'Postal Code'}</label>
                      <input {...register('business.address.postalCode')} className="input font-mono" />
                    </div>
                  </div>
                </div>

                {/* 4. National Address SPL */}
                <div className="space-y-4">
                  <h4 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2 border-b pb-2 dark:border-dark-700">
                    <MapPin className="w-4 h-4 text-sky-500" />
                    {language === 'ar' ? 'بيانات العنوان الوطني (البريد السعودي)' : 'National Address (Saudi Post)'}
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="label">{language === 'ar' ? 'العنوان المختصر' : 'Short Address'}</label>
                      <input {...register('business.nationalAddress.shortAddress')} className="input font-mono" placeholder="RRRD2929" />
                    </div>
                    <div>
                      <label className="label">{language === 'ar' ? 'رقم الإثبات' : 'Proof Number'}</label>
                      <input {...register('business.nationalAddress.proofNumber')} className="input font-mono" />
                    </div>
                    <div>
                      <label className="label">{language === 'ar' ? 'حساب العميل' : 'Customer Account'}</label>
                      <input {...register('business.nationalAddress.customerAccount')} className="input font-mono" />
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
                      <label className="label">{language === 'ar' ? 'رابط QR للتحقق' : 'SPL Verification QR URL'}</label>
                      <input {...register('business.nationalAddress.qrCodeUrl')} className="input" placeholder="https://proof.address.gov.sa/..." />
                    </div>
                  </div>
                </div>

                {/* 5. Commercial Registration Details */}
                <div className="space-y-4">
                  <h4 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2 border-b pb-2 dark:border-dark-700">
                    <Briefcase className="w-4 h-4 text-amber-500" />
                    {language === 'ar' ? 'بيانات السجل التجاري (وزارة التجارة)' : 'Commercial Registration (Ministry of Commerce)'}
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="label">{language === 'ar' ? 'تاريخ الإصدار' : 'Issue Date'}</label>
                      <input type="date" {...register('business.commercialRegistration.issueDate')} className="input" />
                    </div>
                    <div>
                      <label className="label">{language === 'ar' ? 'نوع الكيان (عربي)' : 'Company Type (Arabic)'}</label>
                      <input {...register('business.commercialRegistration.companyTypeAr')} className="input" dir="rtl" placeholder="شركة ذات مسؤولية محدودة" />
                    </div>
                    <div>
                      <label className="label">{language === 'ar' ? 'حالة السجل (عربي)' : 'Status (Arabic)'}</label>
                      <input {...register('business.commercialRegistration.companyStatusAr')} className="input" dir="rtl" placeholder="نشط" />
                    </div>
                    <div className="md:col-span-3">
                      <label className="label">{language === 'ar' ? 'رابط QR للتحقق من السجل' : 'CR Verification QR URL'}</label>
                      <input {...register('business.commercialRegistration.qrCodeUrl')} className="input" />
                    </div>
                  </div>
                </div>

                {/* 6. VAT Registration Certificate Details */}
                <div className="space-y-4">
                  <h4 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2 border-b pb-2 dark:border-dark-700">
                    <Receipt className="w-4 h-4 text-teal-500" />
                    {language === 'ar' ? 'شهادة تسجيل ضريبة القيمة المضافة (ZATCA)' : 'VAT Certificate Details'}
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="label">{language === 'ar' ? 'رقم الشهادة' : 'Certificate Number'}</label>
                      <input {...register('business.vatCertificate.certificateNo')} className="input font-mono" />
                    </div>
                    <div>
                      <label className="label">{language === 'ar' ? 'الفترة الضريبية (عربي)' : 'Tax Period (Arabic)'}</label>
                      <input {...register('business.vatCertificate.taxPeriodAr')} className="input" dir="rtl" placeholder="ربع سنوي" />
                    </div>
                    <div>
                      <label className="label">{language === 'ar' ? 'تاريخ الشهادة' : 'Certificate Date'}</label>
                      <input type="date" {...register('business.vatCertificate.certificateDate')} className="input" />
                    </div>
                    <div>
                      <label className="label">{language === 'ar' ? 'تاريخ التسجيل الفعّال' : 'Effective Date'}</label>
                      <input type="date" {...register('business.vatCertificate.effectiveDate')} className="input" />
                    </div>
                    <div>
                      <label className="label">{language === 'ar' ? 'تاريخ أول إقرار ضريبي' : 'First Filing Due Date'}</label>
                      <input type="date" {...register('business.vatCertificate.firstFilingDueDate')} className="input" />
                    </div>
                    <div>
                      <label className="label">{language === 'ar' ? 'رابط QR للتحقق' : 'ZATCA QR Verification URL'}</label>
                      <input {...register('business.vatCertificate.qrCodeUrl')} className="input" />
                    </div>
                  </div>
                </div>

                {/* 7. Bank Details */}
                <div className="space-y-4">
                  <h4 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2 border-b pb-2 dark:border-dark-700">
                    <Landmark className="w-4 h-4 text-indigo-500" />
                    {language === 'ar' ? 'الحسابات البنكية' : 'Bank Accounts'}
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="label">{language === 'ar' ? 'اسم البنك' : 'Bank Name'}</label>
                      <input {...register('business.bankDetails.bankName')} className="input" placeholder="Al Rajhi Bank / SNB" />
                    </div>
                    <div>
                      <label className="label">{language === 'ar' ? 'اسم صاحب الحساب' : 'Account Name'}</label>
                      <input {...register('business.bankDetails.accountName')} className="input" />
                    </div>
                    <div>
                      <label className="label">{language === 'ar' ? 'رقم الحساب' : 'Account Number'}</label>
                      <input {...register('business.bankDetails.accountNumber')} className="input font-mono" />
                    </div>
                    <div>
                      <label className="label">{language === 'ar' ? 'الآيبان (IBAN)' : 'IBAN'}</label>
                      <input {...register('business.bankDetails.iban')} className="input font-mono" placeholder="SA0000000000000000000000" />
                    </div>
                  </div>
                </div>

                {/* 8. Signature, Stamp & Document Defaults */}
                <div className="space-y-6">
                  <h4 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2 border-b pb-2 dark:border-dark-700">
                    <FileText className="w-4 h-4 text-rose-500" />
                    {language === 'ar' ? 'التوقيع، الختم، والإعدادات الافتراضية للمستندات' : 'Signature, Stamp & Document Defaults'}
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Signature Upload */}
                    <div className="p-4 rounded-2xl bg-gray-50 dark:bg-dark-700/50 border border-gray-100 dark:border-dark-600/50 space-y-3">
                      <label className="label !mb-0">{language === 'ar' ? 'توقيع المفوض المعتمد' : 'Authorized Signature'}</label>
                      <div className="flex items-center gap-4">
                        <div className="w-20 h-20 rounded-xl bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-600 flex items-center justify-center overflow-hidden p-1.5">
                          {signaturePreview ? (
                            <img src={signaturePreview} alt="Signature" className="w-full h-full object-contain" />
                          ) : (
                            <FileText className="w-6 h-6 text-gray-400" />
                          )}
                        </div>
                        <div className="flex flex-col gap-2">
                          <label className="btn btn-secondary text-xs cursor-pointer inline-flex items-center gap-2">
                            <Upload className="w-3.5 h-3.5" />
                            {language === 'ar' ? 'رفع توقيع' : 'Upload Signature'}
                            <input type="file" accept="image/*" onChange={handleSignatureUpload} className="hidden" />
                          </label>
                          {signaturePreview ? (
                            <button
                              type="button"
                              onClick={handleRemoveSignature}
                              className="text-xs text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1"
                            >
                              <Trash2 className="w-3 h-3" />
                              {language === 'ar' ? 'إزالة التوقيع' : 'Remove Signature'}
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    {/* Stamp Upload */}
                    <div className="p-4 rounded-2xl bg-gray-50 dark:bg-dark-700/50 border border-gray-100 dark:border-dark-600/50 space-y-3">
                      <label className="label !mb-0">{language === 'ar' ? 'ختم المنشأة الرسمي' : 'Official Company Stamp'}</label>
                      <div className="flex items-center gap-4">
                        <div className="w-20 h-20 rounded-xl bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-600 flex items-center justify-center overflow-hidden p-1.5">
                          {stampPreview ? (
                            <img src={stampPreview} alt="Stamp" className="w-full h-full object-contain" />
                          ) : (
                            <Shield className="w-6 h-6 text-gray-400" />
                          )}
                        </div>
                        <div className="flex flex-col gap-2">
                          <label className="btn btn-secondary text-xs cursor-pointer inline-flex items-center gap-2">
                            <Upload className="w-3.5 h-3.5" />
                            {language === 'ar' ? 'رفع ختم' : 'Upload Stamp'}
                            <input type="file" accept="image/*" onChange={handleStampUpload} className="hidden" />
                          </label>
                          {stampPreview ? (
                            <button
                              type="button"
                              onClick={handleRemoveStamp}
                              className="text-xs text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1"
                            >
                              <Trash2 className="w-3 h-3" />
                              {language === 'ar' ? 'إزالة الختم' : 'Remove Stamp'}
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Signatory Names & Designations */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="label">{language === 'ar' ? 'اسم الشخص المفوض (عربي)' : 'Authorized Person Name (Arabic)'}</label>
                      <input {...register('settings.invoiceBranding.presetAuthorizedPersonNameAr')} className="input" dir="rtl" placeholder="فلان بن فلان" />
                    </div>
                    <div>
                      <label className="label">{language === 'ar' ? 'اسم الشخص المفوض (إنجليزي)' : 'Authorized Person Name (English)'}</label>
                      <input {...register('settings.invoiceBranding.presetAuthorizedPersonName')} className="input" placeholder="Full Name" />
                    </div>
                    <div>
                      <label className="label">{language === 'ar' ? 'الصفة / المنصب (عربي)' : 'Authorized Person Designation (Arabic)'}</label>
                      <input {...register('settings.invoiceBranding.presetAuthorizedPersonDesignationAr')} className="input" dir="rtl" placeholder="المدير التنفيذي / المدير العام" />
                    </div>
                    <div>
                      <label className="label">{language === 'ar' ? 'الصفة / المنصب (إنجليزي)' : 'Authorized Person Designation (English)'}</label>
                      <input {...register('settings.invoiceBranding.presetAuthorizedPersonDesignation')} className="input" placeholder="Chief Executive Officer / General Manager" />
                    </div>
                  </div>

                  {/* Default UOM */}
                  <div>
                    <label className="label">{language === 'ar' ? 'وحدة القياس الافتراضية (Default UOM)' : 'Default Unit of Measure (UOM)'}</label>
                    <select {...register('settings.defaultUom')} className="select">
                      <option value="">{language === 'ar' ? 'بدون وحدة افتراضية (اختياري)' : 'None (Optional)'}</option>
                      {getAvailableUomOptions(tenant).map((uom) => (
                        <option key={uom.code} value={uom.code}>
                          {language === 'ar' ? `${uom.labelAr} (${uom.code})` : `${uom.labelEn} (${uom.code})`}
                        </option>
                      ))}
                    </select>
                    <p className="text-[11px] text-gray-400 mt-1">
                      {language === 'ar' ? 'تُعرض هذه الوحدة تلقائياً عند إضافة منتجات جديدة أو بنود فواتير وعروض أسعار' : 'Used as the default UOM when creating products, invoices, quotations, and purchase orders'}
                    </p>
                  </div>

                  {/* Default Terms and Notes */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <RichTextNoteField
                      label={language === 'ar' ? 'الشروط والأحكام الافتراضية للفواتير' : 'Default Terms & Conditions'}
                      value={watch('settings.termsAndConditions')}
                      onChange={(val) => setValue('settings.termsAndConditions', val, { shouldDirty: true })}
                      placeholder={language === 'ar' ? '• البضاعة المباعة لا ترد ولا تستبدل بعد 7 أيام\n• الدفع خلال 30 يوماً من تاريخ الفاتورة' : '• Payment due within 30 days\n• Goods once sold cannot be returned'}
                      rows={4}
                      language={language}
                    />
                    <RichTextNoteField
                      label={language === 'ar' ? 'الملاحظات الافتراضية للفواتير' : 'Default Invoice Notes'}
                      value={watch('settings.notes')}
                      onChange={(val) => setValue('settings.notes', val, { shouldDirty: true })}
                      placeholder={language === 'ar' ? 'شكراً لتعاملكم معنا' : 'Thank you for your business'}
                      rows={4}
                      language={language}
                    />
                  </div>
                </div>

                {/* Modal Actions Footer */}
                <div className="flex items-center justify-end gap-3 pt-6 border-t border-gray-100 dark:border-dark-700">
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(false)}
                    className="btn btn-secondary px-5"
                  >
                    {language === 'ar' ? 'إلغاء' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || updateProfileMutation.isPending}
                    className="btn btn-primary px-6 font-bold flex items-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    {isSubmitting || updateProfileMutation.isPending ? (language === 'ar' ? 'جاري الحفظ...' : 'Saving...') : (language === 'ar' ? 'حفظ التعديلات' : 'Save Changes')}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* EDIT USER INFO MODAL */}
      <AnimatePresence>
        {isEditUserModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-dark-800 rounded-3xl shadow-2xl border border-gray-100 dark:border-dark-700 w-full max-w-lg p-6 space-y-6"
            >
              <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-dark-700">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  {language === 'ar' ? 'تعديل بيانات المستخدم' : 'Edit User Profile'}
                </h3>
                <button onClick={() => setIsEditUserModalOpen(false)} className="text-gray-500 hover:text-gray-700">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmitUser((data) => updateUserMutation.mutate(data))} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">{language === 'ar' ? 'الاسم الأول' : 'First Name'}</label>
                    <input {...registerUser('firstName', { required: true })} className="input" />
                  </div>
                  <div>
                    <label className="label">{language === 'ar' ? 'الاسم الأخير' : 'Last Name'}</label>
                    <input {...registerUser('lastName', { required: true })} className="input" />
                  </div>
                </div>

                <div>
                  <label className="label">{language === 'ar' ? 'رقم الجوال' : 'Phone Number'}</label>
                  <input {...registerUser('phone')} className="input" placeholder="9665XXXXXXXX" />
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100 dark:border-dark-700">
                  <button type="button" onClick={() => setIsEditUserModalOpen(false)} className="btn btn-secondary">
                    {language === 'ar' ? 'إلغاء' : 'Cancel'}
                  </button>
                  <button type="submit" disabled={isSubmittingUser || updateUserMutation.isPending} className="btn btn-primary font-bold">
                    {language === 'ar' ? 'حفظ' : 'Save'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CHANGE PASSWORD MODAL */}
      <AnimatePresence>
        {isPasswordModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-dark-800 rounded-3xl shadow-2xl border border-gray-100 dark:border-dark-700 w-full max-w-md p-6 space-y-6"
            >
              <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-dark-700">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-900/30 text-amber-600">
                    <KeyRound className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                    {language === 'ar' ? 'تغيير كلمة المرور' : 'Change Password'}
                  </h3>
                </div>
                <button onClick={() => setIsPasswordModalOpen(false)} className="text-gray-500 hover:text-gray-700">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmitPwd(onChangePassword)} className="space-y-4">
                <div>
                  <label className="label">{language === 'ar' ? 'كلمة المرور الحالية' : 'Current Password'}</label>
                  <input
                    type="password"
                    {...registerPwd('currentPassword', { required: true })}
                    className="input"
                    placeholder="••••••••"
                  />
                </div>

                <div>
                  <label className="label">{language === 'ar' ? 'كلمة المرور الجديدة' : 'New Password'}</label>
                  <input
                    type="password"
                    {...registerPwd('newPassword', { required: true, minLength: 6 })}
                    className="input"
                    placeholder="••••••••"
                  />
                </div>

                <div>
                  <label className="label">{language === 'ar' ? 'تأكيد كلمة المرور الجديدة' : 'Confirm New Password'}</label>
                  <input
                    type="password"
                    {...registerPwd('confirmPassword', { required: true })}
                    className="input"
                    placeholder="••••••••"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100 dark:border-dark-700">
                  <button type="button" onClick={() => setIsPasswordModalOpen(false)} className="btn btn-secondary">
                    {language === 'ar' ? 'إلغاء' : 'Cancel'}
                  </button>
                  <button type="submit" disabled={isSubmittingPwd || passwordMutation.isPending} className="btn btn-primary font-bold">
                    {language === 'ar' ? 'تحديث كلمة المرور' : 'Update Password'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
