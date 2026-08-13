import { useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useDispatch, useSelector } from 'react-redux'
import { Mail, CheckCircle2, AlertCircle, ArrowRight, ImagePlus, X, Building2, Globe2, Wallet } from 'lucide-react'
import { demoSignup } from '../../store/slices/authSlice'
import { getBusinessTypeOptions } from '../../lib/businessTypes'
import { COUNTRY_OPTIONS, currencyForCountry } from '../../lib/countryCurrency'
import { CURRENCIES } from '../../lib/currency'
import { isApexHost, isOnTenantAliasHost, getTenantAliasHandoffUrl, issueHandoffCode } from '../../lib/tenantHost'
import api from '../../lib/api'

const MAX_LOGO_BYTES = 3 * 1024 * 1024

const flagEmoji = (code) => {
  if (!code || code === 'OTHER') return '🌍'
  return [...String(code).toUpperCase()]
    .map((c) => String.fromCodePoint(127397 + c.charCodeAt(0)))
    .join('')
}

export default function TrialSignup({ variant = 'light', embedded = false }) {
  const dispatch = useDispatch()
  const { language } = useSelector((state) => state.ui)
  const { isLoading, error } = useSelector((state) => state.auth)
  const isArabic = language === 'ar'
  const premium = variant === 'premium'
  const logoInputRef = useRef(null)

  const [step, setStep] = useState(1)
  const [email, setEmail] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [country, setCountry] = useState('')
  const [currency, setCurrency] = useState('')
  const [selectedType, setSelectedType] = useState('')
  const [logo, setLogo] = useState('')
  const [logoName, setLogoName] = useState('')
  const [localError, setLocalError] = useState('')
  const [logoHover, setLogoHover] = useState(false)

  const businessOptions = getBusinessTypeOptions(language)
  const currencyOptions = useMemo(() => CURRENCIES || [], [])
  const selectedCountry = COUNTRY_OPTIONS.find((c) => c.code === country)

  const onCountryChange = (code) => {
    setCountry(code)
    setCurrency(currencyForCountry(code))
  }

  const applyLogoFile = (file) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setLocalError(isArabic ? 'الملف يجب أن يكون صورة' : 'Please upload an image file')
      return
    }
    if (file.size > MAX_LOGO_BYTES) {
      setLocalError(isArabic ? 'حجم الشعار يجب ألا يتجاوز 3 ميجابايت' : 'Logo must be 3MB or smaller')
      return
    }
    const reader = new FileReader()
    reader.onload = (event) => {
      setLogo(String(event.target?.result || ''))
      setLogoName(file.name)
      setLocalError('')
    }
    reader.readAsDataURL(file)
  }

  const handleLogoUpload = (e) => applyLogoFile(e.target.files?.[0])

  const clearLogo = () => {
    setLogo('')
    setLogoName('')
    if (logoInputRef.current) logoInputRef.current.value = ''
  }

  const validateStep = () => {
    if (step === 1) {
      if (!country) return isArabic ? 'اختر الدولة' : 'Please select your country'
      if (!companyName.trim()) return isArabic ? 'اسم الشركة مطلوب' : 'Company name is required'
      if (!currency) return isArabic ? 'العملة مطلوبة' : 'Currency is required'
      return ''
    }
    if (step === 2) {
      if (!selectedType) return isArabic ? 'اختر نوع نشاطك' : 'Please select your business type'
      return ''
    }
    if (!email.trim()) return isArabic ? 'البريد الإلكتروني مطلوب' : 'Email is required'
    if (!email.trim().toLowerCase().endsWith('@gmail.com')) {
      return isArabic ? 'يجب استخدام بريد Gmail' : 'Please use a Gmail address'
    }
    return ''
  }

  const handleNext = (e) => {
    e.preventDefault()
    const err = validateStep()
    if (err) {
      setLocalError(err)
      return
    }
    setLocalError('')
    setStep((s) => Math.min(3, s + 1))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const err = validateStep()
    if (err) {
      setLocalError(err)
      return
    }
    setLocalError('')

    const result = await dispatch(demoSignup({
      email: email.trim().toLowerCase(),
      businessType: selectedType,
      country,
      currency,
      companyName: companyName.trim(),
      logo: logo || undefined,
    }))

    if (result.meta.requestStatus !== 'fulfilled') return

    const tenant = result.payload?.tenant
    const token = result.payload?.token
    const tenantSlug = String(tenant?.slug || '').trim().toLowerCase()
    const lang = language === 'ar' ? 'ar' : 'en'

    if (tenantSlug && token && isApexHost() && !isOnTenantAliasHost()) {
      try {
        const code = await issueHandoffCode(api, token)
        window.location.replace(getTenantAliasHandoffUrl(tenantSlug, code, { lang }))
      } catch {
        window.location.replace(getTenantAliasHandoffUrl(tenantSlug, token, { lang }))
      }
      return
    }

    window.location.assign('/app/dashboard')
  }

  const isDark = premium

  const shell = isDark
    ? 'overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_30px_80px_-20px_rgba(0,0,0,0.7)] backdrop-blur-xl'
    : 'overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-[0_8px_48px_-12px_rgba(0,0,0,0.12),0_2px_8px_-2px_rgba(0,0,0,0.06)]'
  const labelCls = isDark
    ? 'mb-2 block text-[11px] font-bold text-white/55 uppercase tracking-[0.18em]'
    : 'mb-2 block text-[11px] font-bold text-slate-500 uppercase tracking-[0.18em]'
  const inputCls = isDark
    ? 'w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3.5 text-sm text-white outline-none placeholder:text-white/30 focus:border-emerald-400/60 focus:ring-4 focus:ring-emerald-400/10 transition-all'
    : 'w-full appearance-none rounded-2xl border border-slate-200/90 bg-white px-4 py-3.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] focus:border-emerald-500/70 focus:ring-4 focus:ring-emerald-500/10 transition-all'
  const btnPrimary = isDark
    ? 'inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-5 py-3.5 text-sm font-bold text-white shadow-[0_8px_24px_-8px_rgba(16,185,129,0.65)] transition-all hover:-translate-y-0.5 hover:bg-emerald-400 disabled:opacity-60'
    : 'inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-3.5 text-sm font-bold text-white shadow-[0_10px_28px_-10px_rgba(5,150,105,0.65)] transition-all hover:-translate-y-0.5 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-60'
  const btnGhost = isDark
    ? 'rounded-2xl border border-white/15 px-5 py-3.5 text-sm font-semibold text-white/80 transition-all hover:bg-white/5'
    : 'rounded-2xl border border-slate-200 px-5 py-3.5 text-sm font-semibold text-slate-600 transition-all hover:bg-slate-50'
  const chipActive = isDark
    ? 'border-emerald-400/60 bg-emerald-400/15 text-emerald-200 shadow-[0_0_0_3px_rgba(52,211,153,0.12)]'
    : 'border-emerald-500 bg-emerald-50/90 text-emerald-950 shadow-[0_0_0_3px_rgba(16,185,129,0.12)]'
  const chipIdle = isDark
    ? 'border-white/10 hover:border-white/25 text-white/70'
    : 'border-slate-200/90 bg-white text-slate-700 hover:border-emerald-300 hover:bg-emerald-50/40'

  const steps = [
    { n: 1, en: 'Workspace', ar: 'المساحة' },
    { n: 2, en: 'Business', ar: 'النشاط' },
    { n: 3, en: 'Access', ar: 'الدخول' },
  ]

  const formInner = (
    <>
      <div className={embedded ? 'mb-6' : 'border-b border-slate-100 px-6 py-5'}>
        {!embedded && (
          <div className="mb-3">
            <h3 className={isDark ? 'text-base font-bold text-white' : 'text-base font-bold text-slate-900'}>
              {isArabic ? 'تجربة مباشرة مجانية' : 'Start live demo'}
            </h3>
            <p className={isDark ? 'text-xs text-white/50' : 'text-xs text-slate-500'}>
              {isArabic ? 'الدولة ← الشركة ← النشاط ← البريد' : 'Country → company → business → email'}
            </p>
          </div>
        )}
        <div className="flex items-center gap-2">
          {steps.map((s, i) => {
            const active = step === s.n
            const done = step > s.n
            return (
              <div key={s.n} className="flex min-w-0 flex-1 items-center gap-2">
                <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold transition-all ${
                  done || active
                    ? 'bg-emerald-600 text-white shadow-[0_4px_12px_-4px_rgba(5,150,105,0.8)]'
                    : isDark ? 'bg-white/10 text-white/40' : 'bg-slate-100 text-slate-400'
                }`}>
                  {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : s.n}
                </div>
                <span className={`hidden truncate text-[11px] font-bold uppercase tracking-[0.14em] sm:inline ${
                  active ? (isDark ? 'text-white' : 'text-slate-800') : (isDark ? 'text-white/35' : 'text-slate-400')
                }`}>
                  {isArabic ? s.ar : s.en}
                </span>
                {i < steps.length - 1 && (
                  <div className={`h-px min-w-[8px] flex-1 ${done ? 'bg-emerald-500' : isDark ? 'bg-white/10' : 'bg-slate-200'}`} />
                )}
              </div>
            )
          })}
        </div>
      </div>

      <form onSubmit={step < 3 ? handleNext : handleSubmit} className={embedded ? 'space-y-5' : 'space-y-5 p-6'}>
        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.div
              key="creating"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center py-10 text-center"
            >
              <div className="relative mb-6">
                <div className="h-16 w-16 rounded-full border-2 border-emerald-100" />
                <div className="absolute inset-0 h-16 w-16 animate-spin rounded-full border-2 border-transparent border-t-emerald-600" />
                <SparklesMark />
              </div>
              <p className="font-display text-lg font-bold text-slate-900">
                {isArabic ? 'جاري تجهيز مساحتك' : 'Assembling your workspace'}
              </p>
              <p className="mt-2 max-w-xs text-sm text-slate-500">
                {companyName
                  ? (isArabic ? `تجهيز ${companyName} بالعملة ${currency}` : `Provisioning ${companyName} in ${currency}`)
                  : (isArabic ? 'ثوانٍ وستكون لوحة التحكم جاهزة.' : 'A few seconds and your dashboard will be ready.')}
              </p>
            </motion.div>
          ) : (
            <motion.div
              key={step}
              initial={{ opacity: 0, x: isArabic ? -16 : 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: isArabic ? 16 : -16 }}
              transition={{ duration: 0.22 }}
              className="space-y-5"
            >
              {step === 1 && (
                <>
                  <div>
                    <label className={labelCls}>{isArabic ? 'الدولة' : 'Country'}</label>
                    <div className="relative">
                      <Globe2 className={`pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 ${isDark ? 'text-white/30' : 'text-slate-400'}`} />
                      <select value={country} onChange={(e) => onCountryChange(e.target.value)} className={`${inputCls} pl-11`}>
                        <option value="">{isArabic ? 'اختر الدولة' : 'Select country'}</option>
                        {COUNTRY_OPTIONS.map((c) => (
                          <option key={c.code} value={c.code} className="text-slate-900">
                            {flagEmoji(c.code)} {isArabic ? c.nameAr : c.nameEn}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>{isArabic ? 'اسم الشركة' : 'Company name'}</label>
                    <div className="relative">
                      <Building2 className={`pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 ${isDark ? 'text-white/30' : 'text-slate-400'}`} />
                      <input
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        className={`${inputCls} pl-11`}
                        placeholder={isArabic ? 'اسم منشأتك' : 'Your company name'}
                        autoComplete="organization"
                      />
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>
                      {isArabic ? 'شعار الشركة' : 'Company logo'}
                      <span className={`ml-2 font-medium normal-case tracking-normal ${isDark ? 'text-white/35' : 'text-slate-400'}`}>
                        ({isArabic ? 'اختياري' : 'optional'})
                      </span>
                    </label>
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleLogoUpload}
                    />
                    {logo ? (
                      <div className={`flex items-center gap-3 rounded-2xl border px-3 py-3 ${isDark ? 'border-white/15 bg-white/[0.06]' : 'border-slate-200 bg-white shadow-sm'}`}>
                        <img src={logo} alt="Logo preview" className="h-14 w-14 rounded-xl object-contain bg-white ring-1 ring-black/5" />
                        <div className="min-w-0 flex-1">
                          <p className={`truncate text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>{logoName || 'logo'}</p>
                          <p className={`text-xs ${isDark ? 'text-white/40' : 'text-slate-500'}`}>
                            {isArabic ? 'سيظهر على الفواتير والعلامة التجارية' : 'Appears on invoices and branding'}
                          </p>
                        </div>
                        <button type="button" onClick={clearLogo} className={`rounded-lg p-2 ${isDark ? 'text-white/50 hover:bg-white/10 hover:text-white' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'}`} aria-label="Remove logo">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => logoInputRef.current?.click()}
                        onDragOver={(e) => { e.preventDefault(); setLogoHover(true) }}
                        onDragLeave={() => setLogoHover(false)}
                        onDrop={(e) => {
                          e.preventDefault()
                          setLogoHover(false)
                          applyLogoFile(e.dataTransfer.files?.[0])
                        }}
                        className={`flex w-full items-center gap-4 rounded-2xl border border-dashed px-4 py-5 text-sm transition ${
                          logoHover
                            ? 'border-emerald-400 bg-emerald-50/70'
                            : isDark
                              ? 'border-white/20 bg-white/[0.04] text-white/70 hover:border-emerald-400/50'
                              : 'border-slate-300 bg-slate-50/70 text-slate-600 hover:border-emerald-400 hover:bg-emerald-50/50'
                        }`}
                      >
                        <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${isDark ? 'bg-white/10 text-emerald-300' : 'bg-white text-emerald-600 shadow-sm ring-1 ring-emerald-100'}`}>
                          <ImagePlus className="h-5 w-5" />
                        </span>
                        <span className="text-left">
                          <span className={`block font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>
                            {isArabic ? 'اسحب الشعار أو اضغط للرفع' : 'Drop logo or click to upload'}
                          </span>
                          <span className={`block text-xs ${isDark ? 'text-white/40' : 'text-slate-500'}`}>
                            {isArabic ? 'PNG أو JPG حتى 3 ميجابايت' : 'PNG or JPG up to 3MB'}
                          </span>
                        </span>
                      </button>
                    )}
                  </div>
                  <div>
                    <label className={labelCls}>{isArabic ? 'العملة' : 'Currency'}</label>
                    <div className="relative">
                      <Wallet className={`pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 ${isDark ? 'text-white/30' : 'text-slate-400'}`} />
                      <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={`${inputCls} pl-11`}>
                        <option value="">{isArabic ? 'اختر العملة' : 'Select currency'}</option>
                        {currencyOptions.map((c) => (
                          <option key={c.code} value={c.code} className="text-slate-900">
                            {c.code} — {isArabic ? (c.nameAr || c.nameEn) : c.nameEn}
                          </option>
                        ))}
                      </select>
                    </div>
                    {selectedCountry && (
                      <p className={`mt-2 text-xs ${isDark ? 'text-white/35' : 'text-slate-400'}`}>
                        {isArabic
                          ? `افتراضي ${selectedCountry.nameAr}: ${selectedCountry.currency}`
                          : `Default for ${selectedCountry.nameEn}: ${selectedCountry.currency}`}
                      </p>
                    )}
                  </div>
                </>
              )}

              {step === 2 && (
                <div>
                  <label className={`${labelCls} mb-3`}>{isArabic ? 'نوع النشاط' : 'What do you run?'}</label>
                  <div className="grid max-h-[280px] grid-cols-1 gap-2 overflow-y-auto pr-0.5 sm:grid-cols-2">
                    {businessOptions.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setSelectedType(option.id)}
                        className={`rounded-2xl border px-3.5 py-3 text-left transition-all ${
                          selectedType === option.id ? chipActive : chipIdle
                        }`}
                      >
                        <span className="block text-sm font-semibold">{option.label}</span>
                        {option.description && (
                          <span className={`mt-0.5 block text-[11px] leading-snug ${selectedType === option.id ? 'opacity-80' : 'opacity-55'}`}>
                            {option.description}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {step === 3 && (
                <div>
                  <label className={labelCls}>{isArabic ? 'بريد Gmail' : 'Gmail address'}</label>
                  <div className="relative">
                    <Mail className={`absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 ${premium ? 'text-white/35' : 'text-slate-400'}`} />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@gmail.com"
                      className={`${inputCls} pl-11`}
                      disabled={isLoading}
                      autoComplete="email"
                    />
                  </div>
                  <div className={`mt-4 rounded-2xl border px-4 py-3 text-xs ${isDark ? 'border-white/10 bg-white/[0.04] text-white/55' : 'border-slate-100 bg-slate-50 text-slate-500'}`}>
                    <p className={`font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>{companyName}</p>
                    <p className="mt-1">
                      {[selectedCountry ? (isArabic ? selectedCountry.nameAr : selectedCountry.nameEn) : country, currency, logo ? (isArabic ? 'شعار مرفق' : 'logo attached') : null]
                        .filter(Boolean)
                        .join('  ·  ')}
                    </p>
                  </div>
                  <p className={`mt-3 text-xs ${premium ? 'text-white/40' : 'text-slate-400'}`}>
                    {isArabic ? 'نستخدم Gmail لإرسال بيانات الدخول. بلا بطاقة ائتمان.' : 'Gmail is used to send your login details. No credit card required.'}
                  </p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {(localError || error) && !isLoading && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm ${premium ? 'bg-red-500/15 text-red-200' : 'bg-red-50 text-red-600'}`}
            >
              <AlertCircle className="h-4 w-4 shrink-0" />
              {localError || (typeof error === 'string' ? error : error?.message || 'An error occurred')}
            </motion.div>
          )}
        </AnimatePresence>

        {!isLoading && (
          <div className="flex gap-2 pt-1">
            {step > 1 && (
              <button
                type="button"
                onClick={() => { setLocalError(''); setStep((s) => s - 1) }}
                className={btnGhost}
                disabled={isLoading}
              >
                {isArabic ? 'رجوع' : 'Back'}
              </button>
            )}
            <button type="submit" disabled={isLoading} className={btnPrimary}>
              {step < 3 ? (
                <>
                  {isArabic ? 'التالي' : 'Continue'}
                  <ArrowRight className={`h-4 w-4 ${isArabic ? 'rotate-180' : ''}`} />
                </>
              ) : (
                <>
                  {isArabic ? 'ابدأ التجربة' : 'Launch demo'}
                  <CheckCircle2 className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        )}
      </form>
    </>
  )

  if (embedded) {
    return <div className="w-full">{formInner}</div>
  }

  return (
    <div className={premium ? 'mx-auto w-full max-w-2xl' : 'mx-auto max-w-xl'}>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4 }}
        className={shell}
      >
        {formInner}
      </motion.div>
    </div>
  )
}

function SparklesMark() {
  return (
    <span className="absolute inset-0 flex items-center justify-center text-emerald-600">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M12 3l1.2 4.8L18 9l-4.8 1.2L12 15l-1.2-4.8L6 9l4.8-1.2L12 3z" fill="currentColor" />
      </svg>
    </span>
  )
}
