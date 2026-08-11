import { motion } from 'framer-motion'
import { Eye, EyeOff, Loader2, Mail, Lock, ArrowRight, Shield, Globe, Phone, MessageCircle, ChevronDown, RefreshCw } from 'lucide-react'

const MAQDER_LOGO = 'maqdernewlogo.webp'

const complianceLogos = [
  { src: 'ZATCA_Logo.svg', alt: 'ZATCA' },
  { src: 'saudi-vision-2030-logo.webp', alt: 'Saudi Vision 2030' },
  { src: 'saudi_tech_mob_en.svg', alt: 'Saudi Tech MOB' },
]

/**
 * Ultra-premium minimal login for `{slug}.maqder.com` only.
 * Apex `maqder.com/login` keeps the classic split layout.
 */
export default function TenantLoginScreen({
  language,
  t,
  brandedTenant,
  brandingLoading,
  arabicUiOnLogin,
  isSaudiBrandedLogin,
  onToggleLanguage,
  showPassword,
  setShowPassword,
  showContactOptions,
  setShowContactOptions,
  isForgotPassword,
  setIsForgotPassword,
  forgotPasswordEmail,
  setForgotPasswordEmail,
  forgotPasswordStatus,
  loginMethod,
  setLoginMethod,
  isOtpSent,
  setIsOtpSent,
  phoneNumber,
  setPhoneNumber,
  otp,
  setOtp,
  newPassword,
  setNewPassword,
  phoneLoginStatus,
  isLoading,
  error,
  friendlyError,
  register,
  handleSubmit,
  errors,
  onSubmit,
  handleForgotPassword,
  handlePhoneSubmit,
  salesPhone,
  salesEmail,
  whatsappNumber,
  contactSalesSubject,
}) {
  const brandLogo = brandedTenant?.logo || MAQDER_LOGO
  const brandName = brandedTenant
    ? (language === 'ar' ? (brandedTenant.nameAr || brandedTenant.name) : brandedTenant.name)
    : 'Maqder'
  const hasTenantLogo = Boolean(brandedTenant?.logo)
  const accent = (brandedTenant?.primaryColor && !/#d946ef/i.test(String(brandedTenant.primaryColor)))
    ? brandedTenant.primaryColor
    : '#0f766e'

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
    `w-full h-12 ps-11 pe-4 rounded-xl border bg-white text-[14.5px] text-slate-900 placeholder:text-slate-400 outline-none transition-all duration-300 ${
      hasError
        ? 'border-red-300 focus:border-red-500 focus:ring-4 focus:ring-red-500/10'
        : 'border-slate-200 focus:border-[var(--login-accent)] focus:ring-4 focus:ring-[color-mix(in_srgb,var(--login-accent)_12%,transparent)]'
    }`

  const primaryBtnClass =
    'w-full h-12 rounded-xl font-semibold text-[15px] text-white transition-all duration-300 flex items-center justify-center gap-2 group disabled:opacity-70 disabled:cursor-not-allowed hover:brightness-[1.04] hover:-translate-y-px active:translate-y-0'

  return (
    <div
      className="relative flex min-h-screen items-center justify-center overflow-hidden px-5 py-12 sm:px-6"
      style={{
        ['--login-accent']: accent,
        fontFamily: "'Plus Jakarta Sans', 'DM Sans', sans-serif",
        background: '#f5f7f6',
      }}
    >
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(16,185,129,0.09),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_80%_100%,rgba(13,148,136,0.07),transparent_45%)]" />
        <motion.div
          className="absolute left-[18%] top-[28%] h-56 w-56 rounded-full bg-emerald-400/10 blur-3xl"
          animate={{ y: [0, 16, 0], opacity: [0.4, 0.7, 0.4] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute right-[14%] bottom-[22%] h-44 w-44 rounded-full bg-teal-300/10 blur-3xl"
          animate={{ y: [0, -12, 0], opacity: [0.3, 0.65, 0.3] }}
          transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut', delay: 0.6 }}
        />
      </div>

      {arabicUiOnLogin && (
        <button
          type="button"
          onClick={onToggleLanguage}
          className="absolute end-4 top-4 z-20 inline-flex items-center gap-2 rounded-full border border-slate-200/90 bg-white/80 px-3.5 py-2 text-[12px] font-semibold text-slate-600 shadow-sm backdrop-blur-md transition hover:border-slate-300 hover:text-slate-900 sm:end-7 sm:top-7"
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
          <Globe className="h-3.5 w-3.5" />
          {language === 'ar' ? 'English' : 'العربية'}
        </button>
      )}

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 w-full max-w-[400px]"
      >
        <div className="mb-8 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            className="mx-auto mb-7 flex h-[7.25rem] w-full max-w-[240px] items-center justify-center sm:h-32"
          >
            {brandingLoading && !hasTenantLogo ? (
              <div className="h-14 w-36 animate-pulse rounded-2xl bg-slate-200/80" />
            ) : (
              <img
                src={brandLogo}
                alt={brandName}
                className="max-h-full max-w-full object-contain"
              />
            )}
          </motion.div>

          <motion.p
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08, duration: 0.4 }}
            className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            {isForgotPassword
              ? (language === 'ar' ? 'استعادة الحساب' : 'Account recovery')
              : (language === 'ar' ? 'مساحة العمل' : 'Workspace')}
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.14, duration: 0.45 }}
            className="mt-2 text-[1.65rem] font-semibold tracking-[-0.03em] text-slate-900 sm:text-[1.85rem]"
            style={{ fontFamily: "'Outfit', 'Plus Jakarta Sans', sans-serif" }}
          >
            {isForgotPassword
              ? (language === 'ar' ? 'إعادة تعيين كلمة المرور' : 'Reset your password')
              : (language === 'ar' ? 'مرحباً بعودتك' : 'Welcome back')}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.45 }}
            className="mx-auto mt-2 max-w-[18rem] text-[14px] leading-relaxed text-slate-500"
          >
            {isForgotPassword
              ? (language === 'ar'
                ? (loginMethod === 'phone' ? 'أدخل رقم جوالك للمتابعة' : 'أدخل بريدك لإرسال رابط إعادة التعيين')
                : (loginMethod === 'phone' ? 'Enter your phone number to continue' : 'Enter your email for a reset link'))
              : (hasTenantLogo
                ? (language === 'ar' ? 'سجّل الدخول للمتابعة' : 'Sign in to continue')
                : (language === 'ar'
                  ? `سجّل الدخول إلى ${brandName}`
                  : `Sign in to ${brandName}`))}
          </motion.p>
        </div>

        <div className="mb-5 flex rounded-xl border border-slate-200/90 bg-white/70 p-1 backdrop-blur-sm">
          {[
            { id: 'email', labelEn: 'Email', labelAr: 'البريد' },
            { id: 'phone', labelEn: 'Phone', labelAr: 'الجوال' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => { setLoginMethod(tab.id); setIsOtpSent(false) }}
              className={`flex-1 rounded-lg py-2 text-[13px] font-semibold transition-all ${
                loginMethod === tab.id
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {language === 'ar' ? tab.labelAr : tab.labelEn}
            </button>
          ))}
        </div>

        {error && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-4 rounded-xl border border-red-100 bg-red-50 px-3.5 py-3 text-[13px] font-medium text-red-600"
          >
            {friendlyError}
          </motion.div>
        )}

        {loginMethod === 'phone' ? (
          <form onSubmit={handlePhoneSubmit} className="space-y-3.5">
            {phoneLoginStatus === 'error' && (
              <div className="rounded-xl border border-red-100 bg-red-50 px-3.5 py-3 text-[13px] font-medium text-red-700">
                {language === 'ar' ? 'حدث خطأ. يرجى المحاولة مرة أخرى.' : 'Something went wrong. Please try again.'}
              </div>
            )}
            {phoneLoginStatus === 'success' && (
              <div className="flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-3.5 py-3 text-[13px] font-medium text-emerald-700">
                <Shield className="h-4 w-4 shrink-0" />
                {language === 'ar' ? 'تمت العملية بنجاح.' : 'Done successfully.'}
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-slate-600">
                {language === 'ar' ? 'رقم الجوال' : 'Phone number'}
              </label>
              <div className="relative">
                <Phone className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
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
                <label className="mb-1.5 block text-[13px] font-medium text-slate-600">
                  {language === 'ar' ? 'رمز التحقق' : 'OTP code'}
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    className={`${fieldClass(false)} tracking-[0.28em] text-base font-semibold`}
                    placeholder="••••••"
                  />
                </div>
              </div>
            )}

            {isOtpSent && isForgotPassword && (
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-slate-600">
                  {language === 'ar' ? 'كلمة المرور الجديدة' : 'New password'}
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className={`${fieldClass(false)} pe-12`}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute end-3.5 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )}

            {!isOtpSent && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setIsForgotPassword(!isForgotPassword)}
                  className="text-[13px] font-semibold transition-colors"
                  style={{ color: 'var(--login-accent)' }}
                >
                  {isForgotPassword ? (language === 'ar' ? 'العودة لتسجيل الدخول' : 'Back to login') : t('forgotPassword')}
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={phoneLoginStatus === 'loading'}
              className={primaryBtnClass}
              style={{
                background: `linear-gradient(135deg, ${accent}, color-mix(in srgb, ${accent} 70%, #042f1a))`,
                boxShadow: `0 14px 32px -16px ${accent}`,
              }}
            >
              {phoneLoginStatus === 'loading' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  {!isOtpSent
                    ? (language === 'ar' ? 'إرسال الرمز' : 'Send OTP')
                    : (isForgotPassword
                      ? (language === 'ar' ? 'التحقق وتعيين كلمة المرور' : 'Verify & reset')
                      : (language === 'ar' ? 'التحقق والدخول' : 'Verify & sign in'))}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </>
              )}
            </button>
          </form>
        ) : isForgotPassword ? (
          <form onSubmit={handleForgotPassword} className="space-y-3.5">
            {forgotPasswordStatus === 'success' && (
              <div className="flex items-start gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-3.5 py-3 text-[13px] font-medium text-emerald-700">
                <Shield className="mt-0.5 h-4 w-4 shrink-0" />
                If that email exists, a reset link has been sent.
              </div>
            )}
            {forgotPasswordStatus === 'error' && (
              <div className="rounded-xl border border-red-100 bg-red-50 px-3.5 py-3 text-[13px] font-medium text-red-700">
                Could not send the reset email. Please try again later.
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-slate-600">{t('email')}</label>
              <div className="relative">
                <Mail className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
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
                className="text-[13px] font-medium text-slate-500 transition hover:text-slate-800"
              >
                {language === 'ar' ? 'العودة لتسجيل الدخول' : 'Back to login'}
              </button>
              <button
                type="submit"
                disabled={forgotPasswordStatus === 'loading'}
                className="inline-flex h-10 items-center gap-2 rounded-lg px-4 text-[13px] font-semibold text-white transition hover:brightness-105 disabled:opacity-70"
                style={{ background: accent }}
              >
                {forgotPasswordStatus === 'loading' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                {language === 'ar' ? 'إرسال الرابط' : 'Send link'}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3.5">
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-slate-600">{t('email')}</label>
              <div className="relative">
                <Mail className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
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
              {errors.email && <p className="mt-1.5 text-[12px] font-medium text-red-500">{errors.email.message}</p>}
            </div>

            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-slate-600">{t('password')}</label>
              <div className="relative">
                <Lock className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  {...register('password', { required: 'Password is required' })}
                  className={`${fieldClass(Boolean(errors.password))} pe-12`}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute end-3.5 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && <p className="mt-1.5 text-[12px] font-medium text-red-500">{errors.password.message}</p>}
            </div>

            <div className="flex items-center justify-between pt-0.5">
              <label className="group flex cursor-pointer items-center gap-2">
                <div className="relative">
                  <input type="checkbox" className="peer sr-only" />
                  <div className="h-4 w-4 rounded-[5px] border-2 border-slate-300 transition peer-checked:border-[var(--login-accent)] peer-checked:bg-[var(--login-accent)]" />
                  <svg className="pointer-events-none absolute left-0 top-0 h-4 w-4 text-white opacity-0 transition peer-checked:opacity-100" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="text-[13px] text-slate-500 transition group-hover:text-slate-800">{t('rememberMe')}</span>
              </label>
              <button
                type="button"
                onClick={() => setIsForgotPassword(true)}
                className="text-[13px] font-semibold transition-colors"
                style={{ color: 'var(--login-accent)' }}
              >
                {t('forgotPassword')}
              </button>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className={primaryBtnClass}
              style={{
                background: `linear-gradient(135deg, ${accent}, color-mix(in srgb, ${accent} 70%, #042f1a))`,
                boxShadow: `0 14px 32px -16px ${accent}`,
              }}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  {t('login')}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </>
              )}
            </button>
          </form>
        )}

        <div className="mt-7 text-center">
          <p className="text-[13px] text-slate-500">
            {language === 'ar' ? 'ليس لديك حساب؟' : "Don't have an account?"}{' '}
            <button
              type="button"
              onClick={() => setShowContactOptions((current) => !current)}
              className="inline-flex items-center gap-1 font-semibold transition-colors"
              style={{ color: 'var(--login-accent)' }}
            >
              {language === 'ar' ? 'تواصل معنا' : 'Contact sales'}
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showContactOptions ? 'rotate-180' : ''}`} />
            </button>
          </p>
          {showContactOptions ? (
            <div className="mt-3 grid grid-cols-3 gap-2">
              <a href={`tel:${salesPhone}`} className="inline-flex items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-2 text-[11px] font-semibold text-slate-600 transition hover:border-emerald-300 hover:text-emerald-800">
                <Phone className="h-3 w-3" />
                {language === 'ar' ? 'اتصال' : 'Call'}
              </a>
              <a href={`https://wa.me/${whatsappNumber}?text=${contactSalesSubject}`} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-2 text-[11px] font-semibold text-slate-600 transition hover:border-emerald-300 hover:text-emerald-800">
                <MessageCircle className="h-3 w-3" />
                WhatsApp
              </a>
              <a href={`mailto:${salesEmail}?subject=${contactSalesSubject}`} className="inline-flex items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-2 text-[11px] font-semibold text-slate-600 transition hover:border-emerald-300 hover:text-emerald-800">
                <Mail className="h-3 w-3" />
                Email
              </a>
            </div>
          ) : null}
        </div>

        {isSaudiBrandedLogin && (
          <div className="mt-9 border-t border-slate-200/80 pt-6">
            <div className="flex flex-wrap items-center justify-center gap-5 opacity-55">
              {complianceLogos.map((logo) => (
                <img key={logo.alt} src={logo.src} alt={logo.alt} className="h-8 w-auto max-w-[5.5rem] object-contain" />
              ))}
            </div>
          </div>
        )}

        <div className="mt-7 flex flex-col items-center gap-2.5">
          <p className="text-[11px] font-medium tracking-wide text-slate-400">
            {language === 'ar' ? 'مدعوم من' : 'Powered by'}{' '}
            <span className="font-semibold text-slate-500">Maqder</span>
          </p>
          <button
            type="button"
            onClick={clearCacheAndReload}
            className="group inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-400 transition hover:text-slate-600"
          >
            <RefreshCw className="h-3 w-3 transition-transform duration-500 group-hover:rotate-180" />
            {language === 'ar' ? 'مسح التخزين المؤقت' : 'Clear cache'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}
