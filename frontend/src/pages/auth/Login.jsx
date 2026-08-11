import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { useForm } from 'react-hook-form'
import { motion } from 'framer-motion'
import { Eye, EyeOff, Loader2, Mail, Lock, ArrowRight, Shield, Zap, Globe, Phone, MessageCircle, ChevronDown, RefreshCw } from 'lucide-react'
import { login, clearError } from '../../store/slices/authSlice'
import { setLanguage, setAppLauncherOpen, setHideSidebar, setNavigationStyle } from '../../store/slices/uiSlice'
import { useTranslation } from '../../lib/translations'
import { usePublicWebsiteSettings, usePublicTenantBranding } from '../../lib/website'
import { getAliasSlugFromHost, isApexHost, isOnTenantAliasHost, getTenantAliasHandoffUrl } from '../../lib/tenantHost'
import { isGccArabicMarket } from '../../lib/invoiceLanguage'
import DailyAyat from '../../components/ui/DailyAyat'
import TenantLoginScreen from './TenantLoginScreen'

const complianceLogos = [
  { src: 'ZATCA_Logo.svg', alt: 'ZATCA', cardClassName: 'w-48', imageClassName: 'scale-[1.35]' },
  { src: 'saudi-vision-2030-logo.webp', alt: 'Saudi Vision 2030', cardClassName: 'w-36', imageClassName: 'scale-100' },
  { src: 'saudi_tech_mob_en.svg', alt: 'Saudi Tech MOB', cardClassName: 'w-36', imageClassName: 'scale-100' },
]

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
  // Apex login keeps Arabic; tenant subdomains only show it for GCC / Middle East currencies.
  const arabicUiOnLogin = !isTenantHost
    || (brandedTenant ? isGccArabicMarket({ settings: { currency: brandedTenant.currency } }) : false)

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
      const tenant = result.tenant;
      const businessTypes = Array.isArray(tenant?.businessTypes)
        ? tenant.businessTypes
        : (tenant?.business?.businessType
            ? (Array.isArray(tenant.business.businessType) ? tenant.business.businessType : [tenant.business.businessType])
            : []);

      if (result.user?.role === 'super_admin') {
        navigate('/super-admin', { replace: true });
        return;
      } else if (result.user?.role === 'reseller') {
        navigate('/reseller', { replace: true });
        return;
      }

      // Apex login → send the user to their dedicated {slug}.maqder.com workspace
      // (token handoff required because localStorage is origin-scoped).
      const tenantSlug = String(tenant?.slug || '').trim().toLowerCase()
      const sessionToken = result.token || localStorage.getItem('token')
      if (tenantSlug && sessionToken && isApexHost() && !isOnTenantAliasHost()) {
        window.location.replace(getTenantAliasHandoffUrl(tenantSlug, sessionToken, {
          lang: language === 'ar' ? 'ar' : 'en',
        }))
        return
      }

      // For all tenant users, open the Application Bar Launcher directly
      dispatch(setNavigationStyle({ tenantId: tenant?._id, style: 'launcher' }))
      dispatch(setHideSidebar(true))
      navigate('/app/dashboard', { replace: true })
      // Open app launcher after navigation settles
      setTimeout(() => {
        dispatch(setAppLauncherOpen(true))
      }, 50)
    } catch {
      setIsAutoLoggingIn(false)
      // handled by auth slice state
    }
  }

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    if (!forgotPasswordEmail) return;
    setForgotPasswordStatus('loading');
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotPasswordEmail })
      });
      const data = await res.json();
      setForgotPasswordStatus(data.error ? 'error' : 'success');
    } catch {
      setForgotPasswordStatus('error');
    }
  }

  const handlePhoneSubmit = async (e) => {
    e.preventDefault();
    if (!phoneNumber) return;
    setPhoneLoginStatus('loading');
    
    try {
      if (!isOtpSent) {
        const endpoint = isForgotPassword ? '/api/auth/forgot-password-phone' : '/api/auth/login-phone';
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: phoneNumber })
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        setIsOtpSent(true);
        setPhoneLoginStatus(null);
      } else {
        if (isForgotPassword) {
           if (!newPassword) return;
           const res = await fetch('/api/auth/reset-password-phone', {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ phone: phoneNumber, otp, newPassword })
           });
           const data = await res.json();
           if (data.error) throw new Error(data.error);
           setIsForgotPassword(false);
           setIsOtpSent(false);
           setPhoneNumber('');
           setOtp('');
           setNewPassword('');
           setPhoneLoginStatus('success');
        } else {
           const res = await fetch('/api/auth/verify-otp', {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ phone: phoneNumber, otp })
           });
           const data = await res.json();
           if (data.error) throw new Error(data.error);
           
           window.location.href = '/app/dashboard';
        }
      }
    } catch (err) {
      setPhoneLoginStatus('error');
    }
  }

  useEffect(() => {
    dispatch(clearError())
    if (autoLogin && demoEmail && demoPassword) {
      onSubmit({ email: demoEmail, password: demoPassword })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoLogin, demoEmail, demoPassword])

  if (isAutoLoggingIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#1a3d28]">
        <div className="flex flex-col items-center gap-4 text-center">
          <Loader2 className="w-12 h-12 text-white animate-spin mx-auto" />
          <h2 className="text-xl font-semibold text-white">
            {language === 'ar' ? 'جاري تسجيل الدخول...' : 'Logging you in...'}
          </h2>
          <p className="text-white/70">
            {language === 'ar' ? 'إعداد مساحة العمل الخاصة بك' : 'Preparing your workspace'}
          </p>
        </div>
      </div>
    )
  }

  if (isTenantHost) {
    return (
      <TenantLoginScreen
        language={language}
        t={t}
        brandedTenant={brandedTenant}
        brandingLoading={brandingLoading}
        arabicUiOnLogin={arabicUiOnLogin}
        isSaudiBrandedLogin={isSaudiBrandedLogin}
        onToggleLanguage={() => dispatch(setLanguage(language === 'ar' ? 'en' : 'ar'))}
        showPassword={showPassword}
        setShowPassword={setShowPassword}
        showContactOptions={showContactOptions}
        setShowContactOptions={setShowContactOptions}
        isForgotPassword={isForgotPassword}
        setIsForgotPassword={setIsForgotPassword}
        forgotPasswordEmail={forgotPasswordEmail}
        setForgotPasswordEmail={setForgotPasswordEmail}
        forgotPasswordStatus={forgotPasswordStatus}
        loginMethod={loginMethod}
        setLoginMethod={setLoginMethod}
        isOtpSent={isOtpSent}
        setIsOtpSent={setIsOtpSent}
        phoneNumber={phoneNumber}
        setPhoneNumber={setPhoneNumber}
        otp={otp}
        setOtp={setOtp}
        newPassword={newPassword}
        setNewPassword={setNewPassword}
        phoneLoginStatus={phoneLoginStatus}
        isLoading={isLoading}
        error={error}
        friendlyError={friendlyError}
        register={register}
        handleSubmit={handleSubmit}
        errors={errors}
        onSubmit={onSubmit}
        handleForgotPassword={handleForgotPassword}
        handlePhoneSubmit={handlePhoneSubmit}
        salesPhone={salesPhone}
        salesEmail={salesEmail}
        whatsappNumber={whatsappNumber}
        contactSalesSubject={contactSalesSubject}
      />
    )
  }

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        {/* Solid Background */}
        <div className="absolute inset-0 bg-[#1a3d28]" />

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between p-12 text-white">
          {/* Logo */}
          <div className="flex items-center gap-3 -ml-4 -mt-4 mb-4">
            <div className="w-full h-40 flex items-center justify-start">
              {brandedTenant?.logo ? (
                <img src={brandedTenant.logo} alt={brandedTenant.name} className="h-full w-auto object-contain object-left scale-110 origin-left" />
              ) : (
                <img src="maqdernewlogo.webp" alt="Maqder" className="h-full w-auto object-contain object-left scale-110 origin-left" />
              )}
            </div>
          </div>

          {/* Hero */}
          <div className="space-y-8">
            <div>
              {brandedTenant ? (
                <h1 className="text-4xl font-bold leading-tight mb-4">
                  {language === 'ar' ? (brandedTenant.nameAr || brandedTenant.name) : brandedTenant.name}
                </h1>
              ) : (
                <h1 className="text-5xl font-bold leading-tight mb-4">
                  {language === 'ar' ? 'نظام ERP متكامل' : 'Complete ERP System'}
                  <br />
                  <span className="text-white/80">
                    {language === 'ar' ? 'متوافق مع السعودية' : 'Saudi Compliant'}
                  </span>
                </h1>
              )}
              <p className="text-xl text-white/70 max-w-md">
                {language === 'ar' 
                  ? 'الفوترة الإلكترونية، الموارد البشرية، المخزون - كل شيء في مكان واحد'
                  : 'E-Invoicing, HR & Payroll, Inventory - All in one platform'}
              </p>
            </div>

            {/* Features */}
            <div className="grid grid-cols-1 gap-4">
              {(isSaudiBrandedLogin
                ? [
                    { icon: Shield, text: language === 'ar' ? 'متوافق مع فاتورة المرحلة الثانية' : 'ZATCA Phase 2 Compliant' },
                    { icon: Zap, text: language === 'ar' ? 'حسابات GOSI و EOSB التلقائية' : 'Auto GOSI & EOSB Calculations' },
                    { icon: Globe, text: language === 'ar' ? 'دعم كامل للغة العربية' : 'Full Arabic RTL Support' },
                  ]
                : [
                    { icon: Shield, text: language === 'ar' ? 'فوترة ومبيعات متكاملة' : 'Invoicing & Sales Built-In' },
                    { icon: Zap, text: language === 'ar' ? 'نقاط بيع ومخزون سريعة' : 'Fast POS & Inventory' },
                    { icon: Globe, text: language === 'ar' ? 'متعدد العملات واللغات' : 'Multi-Currency & Multi-Language' },
                  ]
              ).map((feature, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + i * 0.1 }}
                  className="flex items-center gap-3 bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3 border border-white/20"
                >
                  <feature.icon className="w-5 h-5 text-green-300" />
                  <span className="font-medium">{feature.text}</span>
                </motion.div>
              ))}
            </div>

            {/* Daily Ayat */}
            <div className="mt-8">
              <DailyAyat variant="dark" />
            </div>
          </div>

          {/* Footer */}
          <div className="text-white/50 text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              2024 Maqder ERP. {language === 'ar' ? 'صنع بواسطة Eastern Workforce Solutions Establishment' : 'Built by Eastern Workforce Solutions Establishment'}
            </div>
            <div className="flex items-center gap-4 text-white/70">
              <a href="tel:+966596775485" title="Call Us" className="hover:text-white transition-colors">
                <Phone className="w-4 h-4" />
              </a>
              <a href="https://wa.me/966596775485" target="_blank" rel="noreferrer" title="WhatsApp" className="hover:text-white transition-colors">
                <MessageCircle className="w-4 h-4" />
              </a>
              <a href="mailto:support@maqder.com" title="Email Us" className="hover:text-white transition-colors">
                <Mail className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-gradient-to-br from-gray-50 to-white">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          {/* Language Toggle — Arabic only on apex or GCC tenant hosts */}
          {arabicUiOnLogin && (
            <div className="flex justify-end mb-8">
              <button
                onClick={() => dispatch(setLanguage(language === 'ar' ? 'en' : 'ar'))}
                className="flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-sm border border-gray-200 hover:shadow-md transition-all text-sm font-medium text-gray-600"
              >
                <Globe className="w-4 h-4" />
                {language === 'ar' ? 'English' : 'العربية'}
              </button>
            </div>
          )}

          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
            <img src="maqderlogolandingpage.webp" alt="Maqder" className="h-24 w-auto object-contain object-center" />
          </div>

          {/* Header */}
          <div className="text-center lg:text-start mb-8">
            {brandedTenant && (
              <div className="inline-flex items-center gap-2 mb-3 px-3 py-1.5 rounded-full bg-[#244D33]/10 text-[#244D33] text-xs font-semibold">
                {brandedTenant.logo && <img src={brandedTenant.logo} alt="" className="w-4 h-4 rounded-full object-cover" />}
                {language === 'ar'
                  ? `تسجيل الدخول إلى ${brandedTenant.nameAr || brandedTenant.name}`
                  : `Signing in to ${brandedTenant.name}`}
              </div>
            )}
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {isForgotPassword ? (language === 'ar' ? 'استعادة كلمة المرور' : 'Reset Password') : t('welcomeBack') + ' 👋'}
            </h1>
            <p className="text-gray-500 text-lg">
              {isForgotPassword 
                ? (language === 'ar' ? (loginMethod === 'phone' ? 'أدخل رقم جوالك' : 'أدخل بريدك الإلكتروني لإرسال رابط إعادة التعيين') : (loginMethod === 'phone' ? 'Enter your phone number' : 'Enter your email to receive a reset link')) 
                : t('signInToContinue')}
            </p>
          </div>

          <div className="flex bg-gray-100 p-1 rounded-xl mb-6">
            <button
              onClick={() => { setLoginMethod('email'); setIsOtpSent(false); }}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${loginMethod === 'email' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
            >
              {language === 'ar' ? 'البريد الإلكتروني' : 'Email'}
            </button>
            <button
              onClick={() => { setLoginMethod('phone'); setIsOtpSent(false); }}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${loginMethod === 'phone' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
            >
              {language === 'ar' ? 'رقم الجوال' : 'Phone Number'}
            </button>
          </div>

          {/* Error */}
          {error && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3"
            >
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-sm text-red-600 font-medium">{friendlyError}</p>
            </motion.div>
          )}

          {/* Form */}
          {loginMethod === 'phone' ? (
            <form onSubmit={handlePhoneSubmit} className="space-y-5">
              {phoneLoginStatus === 'error' && (
                <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-3">
                  <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-sm text-red-700 font-medium mt-2">{language === 'ar' ? 'حدث خطأ. يرجى التحقق والمحاولة مرة أخرى.' : 'An error occurred. Please check and try again.'}</p>
                </div>
              )}
              {phoneLoginStatus === 'success' && (
                <div className="p-4 bg-green-50 border border-green-100 rounded-2xl flex items-start gap-3">
                  <Shield className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-green-700 font-medium">{language === 'ar' ? 'تمت العملية بنجاح.' : 'Operation successful.'}</p>
                </div>
              )}
              
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">{language === 'ar' ? 'رقم الجوال' : 'Phone Number'}</label>
                <div className="relative">
                  <div className="absolute inset-y-0 start-0 flex items-center ps-4 pointer-events-none">
                    <Phone className="w-5 h-5 text-gray-400" />
                  </div>
                  <input
                    type="tel"
                    required
                    disabled={isOtpSent}
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="w-full h-14 ps-12 pe-4 bg-white border-2 border-gray-200 focus:border-[#244D33] rounded-2xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-[#244D33]/10 transition-all disabled:bg-gray-50"
                    placeholder="+966500000000"
                  />
                </div>
              </div>

              {isOtpSent && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">{language === 'ar' ? 'رمز التحقق (OTP)' : 'OTP Code'}</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 start-0 flex items-center ps-4 pointer-events-none">
                      <Lock className="w-5 h-5 text-gray-400" />
                    </div>
                    <input
                      type="text"
                      required
                      maxLength={6}
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      className="w-full h-14 ps-12 pe-4 bg-white border-2 border-gray-200 focus:border-[#244D33] rounded-2xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-[#244D33]/10 transition-all tracking-widest text-xl font-bold"
                      placeholder="••••••"
                    />
                  </div>
                </div>
              )}

              {isOtpSent && isForgotPassword && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">{language === 'ar' ? 'كلمة المرور الجديدة' : 'New Password'}</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 start-0 flex items-center ps-4 pointer-events-none">
                      <Lock className="w-5 h-5 text-gray-400" />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full h-14 ps-12 pe-14 bg-white border-2 border-gray-200 focus:border-[#244D33] rounded-2xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-[#244D33]/10 transition-all"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 end-0 flex items-center pe-4 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
              )}

              {!isOtpSent && (
                <div className="flex items-center justify-end pt-2">
                  <button type="button" onClick={() => setIsForgotPassword(!isForgotPassword)} className="text-sm text-[#244D33] hover:text-[#1e3f2a] font-semibold transition-colors">
                    {isForgotPassword ? (language === 'ar' ? 'العودة لتسجيل الدخول' : 'Back to Login') : t('forgotPassword')}
                  </button>
                </div>
              )}

              <button
                type="submit"
                disabled={phoneLoginStatus === 'loading'}
                className="w-full h-14 bg-gradient-to-r from-[#244D33] to-[#1e3f2a] hover:from-[#1e3f2a] hover:to-[#163121] text-white font-semibold rounded-2xl shadow-lg shadow-[#244D33]/30 hover:shadow-xl hover:shadow-[#244D33]/40 disabled:opacity-70 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center gap-2 group"
              >
                {phoneLoginStatus === 'loading' ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    {!isOtpSent 
                      ? (language === 'ar' ? 'إرسال الرمز' : 'Send OTP') 
                      : (isForgotPassword 
                          ? (language === 'ar' ? 'التحقق وتعيين كلمة المرور' : 'Verify & Reset') 
                          : (language === 'ar' ? 'التحقق والدخول' : 'Verify & Login')
                        )
                    }
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </form>
          ) : isForgotPassword ? (
            <form onSubmit={handleForgotPassword} className="space-y-5">
              {forgotPasswordStatus === 'success' && (
                <div className="p-4 bg-green-50 border border-green-100 rounded-2xl flex items-start gap-3">
                  <Shield className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-green-700 font-medium">If that email exists in our system, we have sent a password reset link to the configured email address.</p>
                </div>
              )}
              {forgotPasswordStatus === 'error' && (
                <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-3">
                  <Loader2 className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700 font-medium">There was an error sending the reset email. Please try again later.</p>
                </div>
              )}
              
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">{t('email')}</label>
                <div className="relative">
                  <div className="absolute inset-y-0 start-0 flex items-center ps-4 pointer-events-none">
                    <Mail className="w-5 h-5 text-gray-400" />
                  </div>
                  <input
                    type="email"
                    required
                    value={forgotPasswordEmail}
                    onChange={(e) => setForgotPasswordEmail(e.target.value)}
                    className="w-full h-14 ps-12 pe-4 bg-white border-2 border-gray-200 focus:border-[#244D33] rounded-2xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-[#244D33]/10 transition-all"
                    placeholder="admin@zatca-erp.com"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setIsForgotPassword(false)}
                  className="text-sm font-medium text-gray-500 hover:text-gray-800 transition-colors"
                >
                  {language === 'ar' ? 'العودة لتسجيل الدخول' : 'Back to Login'}
                </button>
                <button
                  type="submit"
                  disabled={forgotPasswordStatus === 'loading'}
                  className="px-6 h-12 bg-gradient-to-r from-[#244D33] to-[#1e3f2a] hover:from-[#1e3f2a] hover:to-[#163121] text-white font-semibold rounded-xl shadow-md disabled:opacity-70 transition-all flex items-center gap-2"
                >
                  {forgotPasswordStatus === 'loading' ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {language === 'ar' ? 'إرسال الرابط' : 'Send Link'}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              {/* Email */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">{t('email')}</label>
                <div className="relative">
                  <div className="absolute inset-y-0 start-0 flex items-center ps-4 pointer-events-none">
                    <Mail className="w-5 h-5 text-gray-400" />
                  </div>
                  <input
                    type="email"
                    {...register('email', { 
                      required: 'Email is required',
                      pattern: { value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i, message: 'Invalid email' }
                    })}
                    className={`w-full h-14 ps-12 pe-4 bg-white border-2 ${errors.email ? 'border-red-300 focus:border-red-500' : 'border-gray-200 focus:border-[#244D33]'} rounded-2xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-[#244D33]/10 transition-all`}
                    placeholder="admin@zatca-erp.com"
                  />
                </div>
                {errors.email && <p className="mt-2 text-sm text-red-500 font-medium">{errors.email.message}</p>}
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">{t('password')}</label>
                <div className="relative">
                  <div className="absolute inset-y-0 start-0 flex items-center ps-4 pointer-events-none">
                    <Lock className="w-5 h-5 text-gray-400" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    {...register('password', { required: 'Password is required' })}
                    className={`w-full h-14 ps-12 pe-14 bg-white border-2 ${errors.password ? 'border-red-300 focus:border-red-500' : 'border-gray-200 focus:border-[#244D33]'} rounded-2xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-[#244D33]/10 transition-all`}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 end-0 flex items-center pe-4 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {errors.password && <p className="mt-2 text-sm text-red-500 font-medium">{errors.password.message}</p>}
              </div>

              {/* Remember & Forgot */}
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className="relative">
                    <input type="checkbox" className="peer sr-only" />
                    <div className="w-5 h-5 border-2 border-gray-300 rounded-md peer-checked:bg-[#244D33] peer-checked:border-[#244D33] transition-all" />
                    <svg className="absolute top-0.5 left-0.5 w-4 h-4 text-white opacity-0 peer-checked:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span className="text-sm text-gray-600 group-hover:text-gray-900 transition-colors">{t('rememberMe')}</span>
                </label>
                <button type="button" onClick={() => setIsForgotPassword(true)} className="text-sm text-[#244D33] hover:text-[#1e3f2a] font-semibold transition-colors">
                  {t('forgotPassword')}
                </button>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-14 bg-gradient-to-r from-[#244D33] to-[#1e3f2a] hover:from-[#1e3f2a] hover:to-[#163121] text-white font-semibold rounded-2xl shadow-lg shadow-[#244D33]/30 hover:shadow-xl hover:shadow-[#244D33]/40 disabled:opacity-70 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center gap-2 group"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    {t('login')}
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* Footer */}
          <div className="mt-10 text-center">
            <p className="text-gray-500">
              {language === 'ar' ? 'ليس لديك حساب؟' : "Don't have an account?"}{' '}
              <button
                type="button"
                onClick={() => setShowContactOptions((current) => !current)}
                className="inline-flex items-center gap-1 text-[#244D33] hover:text-[#1e3f2a] font-semibold transition-colors"
              >
                {language === 'ar' ? 'تواصل معنا' : 'Contact Sales'}
                <ChevronDown className={`w-4 h-4 transition-transform ${showContactOptions ? 'rotate-180' : ''}`} />
              </button>
            </p>
            {showContactOptions ? (
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <a href={`tel:${salesPhone}`} className="flex items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 shadow-sm transition-all hover:border-[#244D33] hover:text-[#244D33] hover:shadow-md">
                  <Phone className="w-4 h-4" />
                  {language === 'ar' ? 'اتصال' : 'Call'}
                </a>
                <a href={`https://wa.me/${whatsappNumber}?text=${contactSalesSubject}`} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 shadow-sm transition-all hover:border-[#244D33] hover:text-[#244D33] hover:shadow-md">
                  <MessageCircle className="w-4 h-4" />
                  WhatsApp
                </a>
                <a href={`mailto:${salesEmail}?subject=${contactSalesSubject}`} className="flex items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 shadow-sm transition-all hover:border-[#244D33] hover:text-[#244D33] hover:shadow-md">
                  <Mail className="w-4 h-4" />
                  {language === 'ar' ? 'بريد' : 'Email'}
                </a>
              </div>
            ) : null}
          </div>

          {/* Trust Badges */}
          {isSaudiBrandedLogin && (
          <div className="mt-10 pt-8 border-t border-gray-200">
            <p className="text-center text-xs text-gray-400 mb-4">{language === 'ar' ? 'معتمد من' : 'Trusted & Certified'}</p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              {complianceLogos.map((logo) => (
                <div key={logo.alt} className={`flex h-20 ${logo.cardClassName} items-center justify-center overflow-hidden rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm`}>
                  <img src={logo.src} alt={logo.alt} className={`max-h-full max-w-full object-contain ${logo.imageClassName}`} />
                </div>
              ))}
            </div>

            {/* Premium Cache Refresh Button */}
            <div className="mt-8 flex justify-center">
              <button
                type="button"
                onClick={async () => {
                  try {
                    const keys = await caches.keys();
                    await Promise.all(keys.map(key => caches.delete(key)));
                    window.location.reload(true);
                  } catch (e) {
                    window.location.reload(true);
                  }
                }}
                className="group flex items-center gap-2 px-4 py-2 rounded-full border border-gray-100 bg-gray-50/50 text-xs font-medium text-gray-400 hover:text-gray-900 hover:bg-gray-100 hover:border-gray-200 transition-all duration-300 shadow-sm hover:shadow"
              >
                <RefreshCw className="w-3.5 h-3.5 group-hover:rotate-180 transition-transform duration-500" />
                {language === 'ar' ? 'تحديث النظام (مسح التخزين المؤقت)' : 'Clear Cache & Reload'}
              </button>
            </div>
          </div>
          )}
          {!isSaudiBrandedLogin && (
            <div className="mt-10 pt-8 border-t border-gray-200 flex justify-center">
              <button
                type="button"
                onClick={async () => {
                  try {
                    const keys = await caches.keys();
                    await Promise.all(keys.map(key => caches.delete(key)));
                    window.location.reload(true);
                  } catch (e) {
                    window.location.reload(true);
                  }
                }}
                className="group flex items-center gap-2 px-4 py-2 rounded-full border border-gray-100 bg-gray-50/50 text-xs font-medium text-gray-400 hover:text-gray-900 hover:bg-gray-100 hover:border-gray-200 transition-all duration-300 shadow-sm hover:shadow"
              >
                <RefreshCw className="w-3.5 h-3.5 group-hover:rotate-180 transition-transform duration-500" />
                {language === 'ar' ? 'تحديث النظام (مسح التخزين المؤقت)' : 'Clear Cache & Reload'}
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  )
}
