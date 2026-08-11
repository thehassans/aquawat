import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { useForm } from 'react-hook-form'
import { motion } from 'framer-motion'
import { Eye, EyeOff, Loader2, Mail, Lock, ArrowRight, Shield, Globe, Phone, MessageCircle, ChevronDown, RefreshCw } from 'lucide-react'
import { login, clearError } from '../../store/slices/authSlice'
import { setLanguage, setAppLauncherOpen, setHideSidebar, setNavigationStyle } from '../../store/slices/uiSlice'
import { useTranslation } from '../../lib/translations'
import { usePublicWebsiteSettings, usePublicTenantBranding } from '../../lib/website'
import { getAliasSlugFromHost, isApexHost, isOnTenantAliasHost, getTenantAliasHandoffUrl } from '../../lib/tenantHost'
import { isGccArabicMarket } from '../../lib/invoiceLanguage'

const complianceLogos = [
  { src: 'ZATCA_Logo.svg', alt: 'ZATCA' },
  { src: 'saudi-vision-2030-logo.webp', alt: 'Saudi Vision 2030' },
  { src: 'saudi_tech_mob_en.svg', alt: 'Saudi Tech MOB' },
]

const MAQDER_LOGO = 'maqdernewlogo.webp'

export default function Login() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { isLoading, error } = useSelector((state) => state.auth)
  const { language } = useSelector((state) => state.ui)
  const { t } = useTranslation(language)
  const [showPassword, setShowPassword] = useState(false)
  const [showContactOptions, setShowContactOptions] = useState(false)
  const [isForgotPassword, setIsForgotPassword] = useState(false)
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('')
  const [forgotPasswordStatus, setForgotPasswordStatus] = useState(null)

  const [loginMethod, setLoginMethod] = useState('email')
  const [isOtpSent, setIsOtpSent] = useState(false)
  const [phoneNumber, setPhoneNumber] = useState('')
  const [otp, setOtp] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [phoneLoginStatus, setPhoneLoginStatus] = useState(null)

  const { data: websiteSettings } = usePublicWebsiteSettings()
  const aliasSlug = getAliasSlugFromHost()
  const initialTenantSlug = String(searchParams.get('tenant') || searchParams.get('tenantSlug') || aliasSlug || '').trim().toLowerCase()
  const { data: aliasTenantBranding, isLoading: brandingLoading } = usePublicTenantBranding(aliasSlug)
  const brandedTenant = aliasTenantBranding?.found ? aliasTenantBranding : null
  const isTenantHost = isOnTenantAliasHost()
  const isSaudiBrandedLogin = !brandedTenant || String(brandedTenant.currency || 'SAR').toUpperCase() === 'SAR'
  const arabicUiOnLogin = !isTenantHost
    || (brandedTenant ? isGccArabicMarket({ settings: { currency: brandedTenant.currency } }) : false)

  const brandLogo = brandedTenant?.logo || MAQDER_LOGO
  const brandName = brandedTenant
    ? (language === 'ar' ? (brandedTenant.nameAr || brandedTenant.name) : brandedTenant.name)
    : 'Maqder'
  const accent = (brandedTenant?.primaryColor && !/#d946ef/i.test(brandedTenant.primaryColor))
    ? brandedTenant.primaryColor
    : '#0f766e'

  useEffect(() => {
    if (!arabicUiOnLogin && language === 'ar') {
      dispatch(setLanguage('en'))
    }
  }, [arabicUiOnLogin, language, dispatch])

  const salesPhone = String(websiteSettings?.contactPhone || '+966596775485').trim()
  const salesEmail = String(websiteSettings?.contactEmail || 'info@maqder.com').trim()
  const whatsappNumber = salesPhone.replace(/\D/g, '')
  const contactSalesSubject = encodeURIComponent('Maqder ERP Sales Inquiry')

  const location = useLocation()

  const errorStr = typeof error === 'string' ? error : (error ? String(error?.message || error?.error || '') : '')
  const isAccountNotFound = /account does not exist|الحساب غير موجود/i.test(errorStr)
  const isInvalidCredentials = /invalid credentials|بيانات الدخول غير صحيحة|incorrect/i.test(errorStr)
  const isAccountLocked = /temporarily locked|مؤقتاً مقفل|مؤقتاً مغلق/i.test(errorStr)
  const friendlyError = (isInvalidCredentials || isAccountNotFound)
    ? (language === 'ar' ? 'اسم المستخدم أو كلمة المرور قد تكون غير صحيحة. يرجى المحاولة مرة أخرى.' : 'Username or password may not exist. Please try again.')
    : isAccountLocked
    ? (language === 'ar' ? 'تم قفل الحساب مؤقتاً بسبب محاولات كثيرة. حاول مرة أخرى لاحقاً.' : 'Account is temporarily locked due to too many attempts. Please try again later.')
    : errorStr

  const demoEmail = searchParams.get('demoEmail')
  const demoPassword = searchParams.get('demoPassword')
  const autoLogin = searchParams.get('autoLogin') === 'true'
  const [isAutoLoggingIn, setIsAutoLoggingIn] = useState(autoLogin && !!demoEmail && !!demoPassword)

  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: {
      email: demoEmail || location.state?.email || '',
      password: demoPassword || location.state?.password || ''
    }
  })

  const onSubmit = async (data) => {
    dispatch(clearError())

    try {
      const result = await dispatch(login({
        ...data,
        tenantSlug: String(data.tenantSlug || initialTenantSlug || '').trim().toLowerCase() || undefined,
      })).unwrap()
      const tenant = result.tenant

      if (result.user?.role === 'super_admin') {
        navigate('/super-admin', { replace: true })
        return
      } else if (result.user?.role === 'reseller') {
        navigate('/reseller', { replace: true })
        return
      }

      const tenantSlug = String(tenant?.slug || '').trim().toLowerCase()
      const sessionToken = result.token || localStorage.getItem('token')
      if (tenantSlug && sessionToken && isApexHost() && !isOnTenantAliasHost()) {
        window.location.replace(getTenantAliasHandoffUrl(tenantSlug, sessionToken))
        return
      }

      dispatch(setNavigationStyle({ tenantId: tenant?._id, style: 'launcher' }))
      dispatch(setHideSidebar(true))
      navigate('/app/dashboard', { replace: true })
      setTimeout(() => {
        dispatch(setAppLauncherOpen(true))
      }, 50)
    } catch {
      setIsAutoLoggingIn(false)
    }
  }

  const handleForgotPassword = async (e) => {
    e.preventDefault()
    if (!forgotPasswordEmail) return
    setForgotPasswordStatus('loading')
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotPasswordEmail })
      })
      const data = await res.json()
      setForgotPasswordStatus(data.error ? 'error' : 'success')
    } catch {
      setForgotPasswordStatus('error')
    }
  }

  const handlePhoneSubmit = async (e) => {
    e.preventDefault()
    if (!phoneNumber) return
    setPhoneLoginStatus('loading')

    try {
      if (!isOtpSent) {
        const endpoint = isForgotPassword ? '/api/auth/forgot-password-phone' : '/api/auth/login-phone'
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: phoneNumber })
        })
        const data = await res.json()
        if (data.error) throw new Error(data.error)
        setIsOtpSent(true)
        setPhoneLoginStatus(null)
      } else {
        if (isForgotPassword) {
          if (!newPassword) return
          const res = await fetch('/api/auth/reset-password-phone', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone: phoneNumber, otp, newPassword })
          })
          const data = await res.json()
          if (data.error) throw new Error(data.error)
          setIsForgotPassword(false)
          setIsOtpSent(false)
          setPhoneNumber('')
          setOtp('')
          setNewPassword('')
          setPhoneLoginStatus('success')
        } else {
          const res = await fetch('/api/auth/verify-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone: phoneNumber, otp })
          })
          const data = await res.json()
          if (data.error) throw new Error(data.error)

          window.location.href = '/app/dashboard'
        }
      }
    } catch {
      setPhoneLoginStatus('error')
    }
  }

  useEffect(() => {
    dispatch(clearError())
    if (autoLogin && demoEmail && demoPassword) {
      onSubmit({ email: demoEmail, password: demoPassword })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoLogin, demoEmail, demoPassword])

  const clearCacheAndReload = async () => {
    try {
      const keys = await caches.keys()
      await Promise.all(keys.map((key) => caches.delete(key)))
      window.location.reload(true)
    } catch {
      window.location.reload(true)
    }
  }

  const fieldClass = (hasError) =>
    `w-full h-14 ps-12 pe-4 rounded-2xl border bg-white/80 text-[15px] text-slate-900 placeholder:text-slate-400 outline-none transition-all duration-300 backdrop-blur-sm ${
      hasError
        ? 'border-red-300 focus:border-red-500 focus:ring-4 focus:ring-red-500/10'
        : 'border-slate-200/90 focus:border-[var(--login-accent)] focus:ring-4 focus:ring-[color-mix(in_srgb,var(--login-accent)_14%,transparent)]'
    }`

  const primaryBtnClass =
    'w-full h-14 rounded-2xl font-semibold text-white transition-all duration-300 flex items-center justify-center gap-2 group disabled:opacity-70 disabled:cursor-not-allowed shadow-[0_16px_40px_-18px_var(--login-accent)] hover:brightness-[1.03] hover:-translate-y-0.5 active:translate-y-0'

  if (isAutoLoggingIn) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f6f8f7]">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-[-18%] h-[420px] w-[620px] -translate-x-1/2 rounded-full bg-emerald-300/25 blur-[110px]" />
        </div>
        <div className="relative flex flex-col items-center gap-4 text-center">
          <Loader2 className="mx-auto h-10 w-10 animate-spin text-emerald-700" />
          <h2 className="font-[Syne] text-xl font-bold text-slate-900">
            {language === 'ar' ? 'جاري تسجيل الدخول...' : 'Logging you in...'}
          </h2>
          <p className="text-sm text-slate-500">
            {language === 'ar' ? 'إعداد مساحة العمل الخاصة بك' : 'Preparing your workspace'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div
      className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10 sm:px-6"
      style={{
        ['--login-accent']: accent,
        fontFamily: "'DM Sans', sans-serif",
        background: 'linear-gradient(165deg, #f7faf8 0%, #eef5f1 42%, #f8fafc 100%)',
      }}
    >
      {/* Atmosphere */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 top-[-12%] h-[480px] w-[480px] rounded-full bg-emerald-300/20 blur-[120px]" />
        <div className="absolute -right-16 bottom-[-18%] h-[420px] w-[420px] rounded-full bg-teal-200/25 blur-[110px]" />
        <div
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, #0f172a 1px, transparent 0)',
            backgroundSize: '28px 28px',
          }}
        />
        <motion.div
          className="absolute left-[12%] top-[22%] h-40 w-40 rounded-full bg-emerald-400/10 blur-2xl"
          animate={{ y: [0, 18, 0], opacity: [0.45, 0.75, 0.45] }}
          transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute right-[16%] bottom-[18%] h-32 w-32 rounded-full bg-teal-300/15 blur-2xl"
          animate={{ y: [0, -14, 0], opacity: [0.35, 0.7, 0.35] }}
          transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut', delay: 0.8 }}
        />
      </div>

      {arabicUiOnLogin && (
        <button
          type="button"
          onClick={() => dispatch(setLanguage(language === 'ar' ? 'en' : 'ar'))}
          className="absolute end-4 top-4 z-20 inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/70 px-3.5 py-2 text-xs font-semibold text-slate-600 shadow-sm backdrop-blur-md transition hover:border-slate-300 hover:text-slate-900 sm:end-6 sm:top-6"
        >
          <Globe className="h-3.5 w-3.5" />
          {language === 'ar' ? 'English' : 'العربية'}
        </button>
      )}

      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 w-full max-w-[420px]"
      >
        {/* Brand hero */}
        <div className="mb-9 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="mx-auto mb-6 flex h-28 w-full max-w-[280px] items-center justify-center sm:h-32"
          >
            {isTenantHost && brandingLoading && !brandedTenant?.logo ? (
              <div className="h-16 w-40 animate-pulse rounded-2xl bg-slate-200/70" />
            ) : (
              <img
                src={brandLogo}
                alt={brandName}
                className="max-h-full max-w-full object-contain drop-shadow-[0_18px_40px_-22px_rgba(15,23,42,0.35)]"
              />
            )}
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12, duration: 0.45 }}
            className="font-[Syne] text-[1.85rem] font-extrabold tracking-tight text-slate-900 sm:text-[2.05rem]"
          >
            {isForgotPassword
              ? (language === 'ar' ? 'استعادة كلمة المرور' : 'Reset Password')
              : brandName}
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.45 }}
            className="mx-auto mt-2 max-w-sm text-[15px] leading-relaxed text-slate-500"
          >
            {isForgotPassword
              ? (language === 'ar'
                ? (loginMethod === 'phone' ? 'أدخل رقم جوالك' : 'أدخل بريدك الإلكتروني لإرسال رابط إعادة التعيين')
                : (loginMethod === 'phone' ? 'Enter your phone number' : 'Enter your email to receive a reset link'))
              : (brandedTenant
                ? (language === 'ar' ? 'سجّل الدخول إلى مساحة عملك' : 'Sign in to your workspace')
                : (language === 'ar' ? 'سجّل الدخول للمتابعة إلى لوحة التحكم' : 'Sign in to continue to your dashboard'))}
          </motion.p>
        </div>

        {/* Method toggle */}
        <div className="mb-6 flex rounded-2xl border border-slate-200/80 bg-white/55 p-1 backdrop-blur-md">
          <button
            type="button"
            onClick={() => { setLoginMethod('email'); setIsOtpSent(false) }}
            className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition-all ${
              loginMethod === 'email'
                ? 'bg-white text-slate-900 shadow-[0_8px_20px_-12px_rgba(15,23,42,0.35)]'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {language === 'ar' ? 'البريد الإلكتروني' : 'Email'}
          </button>
          <button
            type="button"
            onClick={() => { setLoginMethod('phone'); setIsOtpSent(false) }}
            className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition-all ${
              loginMethod === 'phone'
                ? 'bg-white text-slate-900 shadow-[0_8px_20px_-12px_rgba(15,23,42,0.35)]'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {language === 'ar' ? 'رقم الجوال' : 'Phone'}
          </button>
        </div>

        {error && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-5 flex items-start gap-3 rounded-2xl border border-red-100 bg-red-50/90 px-4 py-3.5"
          >
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-100">
              <svg className="h-4 w-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-red-600">{friendlyError}</p>
          </motion.div>
        )}

        {loginMethod === 'phone' ? (
          <form onSubmit={handlePhoneSubmit} className="space-y-4">
            {phoneLoginStatus === 'error' && (
              <div className="rounded-2xl border border-red-100 bg-red-50/90 px-4 py-3 text-sm font-medium text-red-700">
                {language === 'ar' ? 'حدث خطأ. يرجى التحقق والمحاولة مرة أخرى.' : 'An error occurred. Please check and try again.'}
              </div>
            )}
            {phoneLoginStatus === 'success' && (
              <div className="flex items-center gap-2 rounded-2xl border border-emerald-100 bg-emerald-50/90 px-4 py-3 text-sm font-medium text-emerald-700">
                <Shield className="h-4 w-4 shrink-0" />
                {language === 'ar' ? 'تمت العملية بنجاح.' : 'Operation successful.'}
              </div>
            )}

            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                {language === 'ar' ? 'رقم الجوال' : 'Phone Number'}
              </label>
              <div className="relative">
                <Phone className="pointer-events-none absolute start-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" />
                <input
                  type="tel"
                  required
                  disabled={isOtpSent}
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className={`${fieldClass(false)} disabled:bg-slate-50`}
                  placeholder="+966500000000"
                />
              </div>
            </div>

            {isOtpSent && (
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  {language === 'ar' ? 'رمز التحقق (OTP)' : 'OTP Code'}
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute start-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    className={`${fieldClass(false)} tracking-[0.35em] text-lg font-bold`}
                    placeholder="••••••"
                  />
                </div>
              </div>
            )}

            {isOtpSent && isForgotPassword && (
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  {language === 'ar' ? 'كلمة المرور الجديدة' : 'New Password'}
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute start-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className={`${fieldClass(false)} pe-14`}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute end-4 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>
            )}

            {!isOtpSent && (
              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={() => setIsForgotPassword(!isForgotPassword)}
                  className="text-sm font-semibold transition-colors"
                  style={{ color: 'var(--login-accent)' }}
                >
                  {isForgotPassword ? (language === 'ar' ? 'العودة لتسجيل الدخول' : 'Back to Login') : t('forgotPassword')}
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={phoneLoginStatus === 'loading'}
              className={primaryBtnClass}
              style={{ background: `linear-gradient(135deg, ${accent}, color-mix(in srgb, ${accent} 72%, #052e1c))` }}
            >
              {phoneLoginStatus === 'loading' ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  {!isOtpSent
                    ? (language === 'ar' ? 'إرسال الرمز' : 'Send OTP')
                    : (isForgotPassword
                      ? (language === 'ar' ? 'التحقق وتعيين كلمة المرور' : 'Verify & Reset')
                      : (language === 'ar' ? 'التحقق والدخول' : 'Verify & Login'))}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </>
              )}
            </button>
          </form>
        ) : isForgotPassword ? (
          <form onSubmit={handleForgotPassword} className="space-y-4">
            {forgotPasswordStatus === 'success' && (
              <div className="flex items-start gap-2 rounded-2xl border border-emerald-100 bg-emerald-50/90 px-4 py-3 text-sm font-medium text-emerald-700">
                <Shield className="mt-0.5 h-4 w-4 shrink-0" />
                If that email exists in our system, we have sent a password reset link to the configured email address.
              </div>
            )}
            {forgotPasswordStatus === 'error' && (
              <div className="rounded-2xl border border-red-100 bg-red-50/90 px-4 py-3 text-sm font-medium text-red-700">
                There was an error sending the reset email. Please try again later.
              </div>
            )}

            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{t('email')}</label>
              <div className="relative">
                <Mail className="pointer-events-none absolute start-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  required
                  value={forgotPasswordEmail}
                  onChange={(e) => setForgotPasswordEmail(e.target.value)}
                  className={fieldClass(false)}
                  placeholder="you@company.com"
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 pt-1">
              <button
                type="button"
                onClick={() => setIsForgotPassword(false)}
                className="text-sm font-medium text-slate-500 transition hover:text-slate-800"
              >
                {language === 'ar' ? 'العودة لتسجيل الدخول' : 'Back to Login'}
              </button>
              <button
                type="submit"
                disabled={forgotPasswordStatus === 'loading'}
                className="inline-flex h-11 items-center gap-2 rounded-xl px-5 text-sm font-semibold text-white transition hover:brightness-105 disabled:opacity-70"
                style={{ background: accent }}
              >
                {forgotPasswordStatus === 'loading' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {language === 'ar' ? 'إرسال الرابط' : 'Send Link'}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{t('email')}</label>
              <div className="relative">
                <Mail className="pointer-events-none absolute start-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  {...register('email', {
                    required: 'Email is required',
                    pattern: { value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i, message: 'Invalid email' }
                  })}
                  className={fieldClass(Boolean(errors.email))}
                  placeholder="you@company.com"
                />
              </div>
              {errors.email && <p className="mt-2 text-sm font-medium text-red-500">{errors.email.message}</p>}
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{t('password')}</label>
              <div className="relative">
                <Lock className="pointer-events-none absolute start-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  {...register('password', { required: 'Password is required' })}
                  className={`${fieldClass(Boolean(errors.password))} pe-14`}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute end-4 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              {errors.password && <p className="mt-2 text-sm font-medium text-red-500">{errors.password.message}</p>}
            </div>

            <div className="flex items-center justify-between pt-1">
              <label className="group flex cursor-pointer items-center gap-2.5">
                <div className="relative">
                  <input type="checkbox" className="peer sr-only" />
                  <div
                    className="h-[18px] w-[18px] rounded-md border-2 border-slate-300 transition peer-checked:border-[var(--login-accent)] peer-checked:bg-[var(--login-accent)]"
                  />
                  <svg className="pointer-events-none absolute left-[1px] top-[1px] h-4 w-4 text-white opacity-0 transition peer-checked:opacity-100" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="text-sm text-slate-500 transition group-hover:text-slate-800">{t('rememberMe')}</span>
              </label>
              <button
                type="button"
                onClick={() => setIsForgotPassword(true)}
                className="text-sm font-semibold transition-colors"
                style={{ color: 'var(--login-accent)' }}
              >
                {t('forgotPassword')}
              </button>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className={primaryBtnClass}
              style={{ background: `linear-gradient(135deg, ${accent}, color-mix(in srgb, ${accent} 72%, #052e1c))` }}
            >
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  {t('login')}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </>
              )}
            </button>
          </form>
        )}

        <div className="mt-8 text-center">
          <p className="text-sm text-slate-500">
            {language === 'ar' ? 'ليس لديك حساب؟' : "Don't have an account?"}{' '}
            <button
              type="button"
              onClick={() => setShowContactOptions((current) => !current)}
              className="inline-flex items-center gap-1 font-semibold transition-colors"
              style={{ color: 'var(--login-accent)' }}
            >
              {language === 'ar' ? 'تواصل معنا' : 'Contact Sales'}
              <ChevronDown className={`h-4 w-4 transition-transform ${showContactOptions ? 'rotate-180' : ''}`} />
            </button>
          </p>
          {showContactOptions ? (
            <div className="mt-4 grid grid-cols-3 gap-2">
              <a href={`tel:${salesPhone}`} className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200/90 bg-white/70 px-2 py-2.5 text-xs font-semibold text-slate-600 backdrop-blur-sm transition hover:border-emerald-300 hover:text-emerald-800">
                <Phone className="h-3.5 w-3.5" />
                {language === 'ar' ? 'اتصال' : 'Call'}
              </a>
              <a href={`https://wa.me/${whatsappNumber}?text=${contactSalesSubject}`} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200/90 bg-white/70 px-2 py-2.5 text-xs font-semibold text-slate-600 backdrop-blur-sm transition hover:border-emerald-300 hover:text-emerald-800">
                <MessageCircle className="h-3.5 w-3.5" />
                WhatsApp
              </a>
              <a href={`mailto:${salesEmail}?subject=${contactSalesSubject}`} className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200/90 bg-white/70 px-2 py-2.5 text-xs font-semibold text-slate-600 backdrop-blur-sm transition hover:border-emerald-300 hover:text-emerald-800">
                <Mail className="h-3.5 w-3.5" />
                {language === 'ar' ? 'بريد' : 'Email'}
              </a>
            </div>
          ) : null}
        </div>

        {isSaudiBrandedLogin && (
          <div className="mt-10 border-t border-slate-200/70 pt-7">
            <p className="mb-4 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              {language === 'ar' ? 'معتمد من' : 'Trusted & Certified'}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 opacity-80">
              {complianceLogos.map((logo) => (
                <div key={logo.alt} className="flex h-12 w-[6.5rem] items-center justify-center">
                  <img src={logo.src} alt={logo.alt} className="max-h-full max-w-full object-contain grayscale-[0.2]" />
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-8 flex flex-col items-center gap-3">
          {brandedTenant?.logo ? (
            <p className="text-[11px] font-medium tracking-wide text-slate-400">
              {language === 'ar' ? 'مدعوم من' : 'Powered by'}{' '}
              <span className="font-semibold text-slate-500">Maqder</span>
            </p>
          ) : null}
          <button
            type="button"
            onClick={clearCacheAndReload}
            className="group inline-flex items-center gap-2 rounded-full border border-slate-200/70 bg-white/50 px-3.5 py-1.5 text-[11px] font-medium text-slate-400 backdrop-blur-sm transition hover:border-slate-300 hover:text-slate-700"
          >
            <RefreshCw className="h-3 w-3 transition-transform duration-500 group-hover:rotate-180" />
            {language === 'ar' ? 'مسح التخزين المؤقت' : 'Clear cache'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}
