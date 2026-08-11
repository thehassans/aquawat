import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useDispatch, useSelector } from 'react-redux'
import { Mail, Sparkles, CheckCircle2, Loader2, AlertCircle, ArrowRight } from 'lucide-react'
import { demoSignup } from '../../store/slices/authSlice'
import { getBusinessTypeOptions } from '../../lib/businessTypes'
import { COUNTRY_OPTIONS, currencyForCountry } from '../../lib/countryCurrency'
import { CURRENCIES } from '../../lib/currency'
import { isApexHost, isOnTenantAliasHost, getTenantAliasHandoffUrl } from '../../lib/tenantHost'
import { setLanguage } from '../../store/slices/uiSlice'

export default function TrialSignup({ variant = 'light' }) {
  const dispatch = useDispatch()
  const { language } = useSelector((state) => state.ui)
  const { isLoading, error } = useSelector((state) => state.auth)
  const isArabic = language === 'ar'
  const premium = variant === 'premium'

  const [step, setStep] = useState(1)
  const [email, setEmail] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [country, setCountry] = useState('')
  const [currency, setCurrency] = useState('')
  const [selectedType, setSelectedType] = useState('')
  const [localError, setLocalError] = useState('')

  const businessOptions = getBusinessTypeOptions(language)
  const currencyOptions = useMemo(() => CURRENCIES || [], [])

  const onCountryChange = (code) => {
    setCountry(code)
    setCurrency(currencyForCountry(code))
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
    }))

    if (result.meta.requestStatus !== 'fulfilled') return

    const tenant = result.payload?.tenant
    const token = result.payload?.token
    const tenantSlug = String(tenant?.slug || '').trim().toLowerCase()
    const cur = String(tenant?.settings?.currency || currency || '').toUpperCase()
    if (['SAR', 'AED', 'QAR', 'KWD', 'BHD', 'OMR'].includes(cur)) {
      dispatch(setLanguage('ar'))
    } else {
      dispatch(setLanguage('en'))
    }

    if (tenantSlug && token && isApexHost() && !isOnTenantAliasHost()) {
      window.location.replace(getTenantAliasHandoffUrl(tenantSlug, token))
      return
    }

    window.location.assign('/app/dashboard')
  }

  // ── theme tokens ─────────────────────────────────────────────────────────
  // "premium" = dark glass (used inside dark hero sections)
  // "light"   = crisp white card (used on white/light sections) — DEFAULT
  const isDark = premium

  const shell = isDark
    ? 'overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_30px_80px_-20px_rgba(0,0,0,0.7)] backdrop-blur-xl'
    : 'overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-[0_8px_48px_-12px_rgba(0,0,0,0.12),0_2px_8px_-2px_rgba(0,0,0,0.06)]'
  const headerCls = isDark ? 'border-b border-white/10 px-6 py-5' : 'border-b border-slate-100 px-6 py-5'
  const titleCls = isDark ? 'text-base font-bold text-white' : 'text-base font-bold text-slate-900'
  const subCls = isDark ? 'text-xs text-white/50' : 'text-xs text-slate-500'
  const labelCls = isDark ? 'mb-2 block text-xs font-semibold text-white/60 uppercase tracking-wider' : 'mb-2 block text-xs font-semibold text-slate-500 uppercase tracking-wider'
  const inputCls = isDark
    ? 'w-full rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-emerald-400/60 focus:ring-2 focus:ring-emerald-400/15 transition-all'
    : 'w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/10 transition-all'
  const stepTrack = isDark ? 'bg-white/15' : 'bg-slate-200'
  const stepActive = isDark ? 'bg-emerald-400' : 'bg-emerald-600'
  const btnPrimary = isDark
    ? 'inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-bold text-white shadow-[0_4px_16px_-4px_rgba(5,150,105,0.5)] transition-all hover:-translate-y-0.5 hover:bg-emerald-600 disabled:opacity-60'
    : 'inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-[0_4px_16px_-4px_rgba(5,150,105,0.4)] transition-all hover:-translate-y-0.5 hover:bg-emerald-700 disabled:opacity-60'
  const btnGhost = isDark
    ? 'rounded-xl border border-white/15 px-5 py-3 text-sm font-semibold text-white/80 transition-all hover:bg-white/5'
    : 'rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-600 transition-all hover:bg-slate-50'
  const chipActive = isDark
    ? 'border-emerald-400/60 bg-emerald-400/15 text-emerald-200'
    : 'border-emerald-500 bg-emerald-50 text-emerald-900 shadow-sm'
  const chipIdle = isDark
    ? 'border-white/10 hover:border-white/25 text-white/70'
    : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-300 hover:text-emerald-800'

  return (
    <div className={premium ? 'mx-auto w-full max-w-2xl' : 'mx-auto max-w-xl'}>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4 }}
        className={shell}
      >
        <div className={headerCls}>
          <div className="flex items-center gap-2.5">
            <Sparkles className={`h-5 w-5 ${premium ? 'text-emerald-300' : 'text-emerald-700'}`} />
            <div>
              <h3 className={titleCls}>
                {isArabic ? 'تجربة مباشرة مجانية' : 'Start live demo'}
              </h3>
              <p className={subCls}>
                {isArabic ? 'الدولة ← الشركة ← النشاط ← البريد' : 'Country → company → business → email'}
              </p>
            </div>
          </div>
          <div className="mt-3 flex gap-1.5">
            {[1, 2, 3].map((n) => (
              <div key={n} className={`h-1 flex-1 rounded-full ${step >= n ? stepActive : stepTrack}`} />
            ))}
          </div>
        </div>

        <form onSubmit={step < 3 ? handleNext : handleSubmit} className="space-y-5 p-6">
          {step === 1 && (
            <>
              <div>
                <label className={labelCls}>{isArabic ? 'الدولة' : 'Country'}</label>
                <select value={country} onChange={(e) => onCountryChange(e.target.value)} className={inputCls}>
                  <option value="">{isArabic ? 'اختر الدولة' : 'Select country'}</option>
                  {COUNTRY_OPTIONS.map((c) => (
                    <option key={c.code} value={c.code} className="text-slate-900">{isArabic ? c.nameAr : c.nameEn}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>{isArabic ? 'اسم الشركة' : 'Company name'}</label>
                <input
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className={inputCls}
                  placeholder={isArabic ? 'اسم منشأتك' : 'Your company name'}
                />
              </div>
              <div>
                <label className={labelCls}>{isArabic ? 'العملة' : 'Currency'}</label>
                <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={inputCls}>
                  <option value="">{isArabic ? 'اختر العملة' : 'Select currency'}</option>
                  {currencyOptions.map((c) => (
                    <option key={c.code} value={c.code} className="text-slate-900">
                      {c.code} — {isArabic ? (c.nameAr || c.nameEn) : c.nameEn}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {step === 2 && (
            <div>
              <label className={`${labelCls} mb-2`}>{isArabic ? 'نوع النشاط' : 'Business type'}</label>
              <div className="grid max-h-56 grid-cols-2 gap-2 overflow-y-auto">
                {businessOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setSelectedType(option.id)}
                    className={`rounded-xl border px-3 py-2.5 text-left text-sm transition-colors ${
                      selectedType === option.id ? chipActive : chipIdle
                    }`}
                  >
                    <span className="font-medium">{option.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <label className={labelCls}>{isArabic ? 'بريد Gmail' : 'Gmail address'}</label>
              <div className="relative">
                <Mail className={`absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 ${premium ? 'text-white/35' : 'text-slate-400'}`} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@gmail.com"
                  className={`${inputCls} pl-10`}
                  disabled={isLoading}
                />
              </div>
              <p className={`mt-2 text-xs ${premium ? 'text-white/40' : 'text-slate-500'}`}>
                {companyName} · {country} · {currency}
              </p>
            </div>
          )}

          <AnimatePresence>
            {(localError || error) && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${premium ? 'bg-red-500/15 text-red-200' : 'bg-red-50 text-red-600'}`}
              >
                <AlertCircle className="h-4 w-4 shrink-0" />
                {localError || (typeof error === 'string' ? error : error?.message || 'An error occurred')}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex gap-2">
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
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {isArabic ? 'جاري الإنشاء...' : 'Creating...'}
                </>
              ) : step < 3 ? (
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
        </form>
      </motion.div>
    </div>
  )
}
