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

export default function TrialSignup() {
  const dispatch = useDispatch()
  const { language } = useSelector((state) => state.ui)
  const { isLoading, error } = useSelector((state) => state.auth)
  const isArabic = language === 'ar'

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

  return (
    <div className="mx-auto max-w-xl">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4 }}
        className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
      >
        <div className="border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <Sparkles className="h-5 w-5 text-emerald-700" />
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                {isArabic ? 'تجربة مجانية 7 أيام' : '7-day free demo'}
              </h3>
              <p className="text-xs text-slate-500">
                {isArabic ? 'الدولة ← الشركة ← النشاط ← البريد' : 'Country → company → business → email'}
              </p>
            </div>
          </div>
          <div className="mt-3 flex gap-1.5">
            {[1, 2, 3].map((n) => (
              <div key={n} className={`h-1 flex-1 rounded-full ${step >= n ? 'bg-emerald-700' : 'bg-slate-200'}`} />
            ))}
          </div>
        </div>

        <form onSubmit={step < 3 ? handleNext : handleSubmit} className="p-5 space-y-4">
          {step === 1 && (
            <>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-600">
                  {isArabic ? 'الدولة' : 'Country'}
                </label>
                <select
                  value={country}
                  onChange={(e) => onCountryChange(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-700"
                >
                  <option value="">{isArabic ? 'اختر الدولة' : 'Select country'}</option>
                  {COUNTRY_OPTIONS.map((c) => (
                    <option key={c.code} value={c.code}>{isArabic ? c.nameAr : c.nameEn}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-600">
                  {isArabic ? 'اسم الشركة' : 'Company name'}
                </label>
                <input
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-700"
                  placeholder={isArabic ? 'اسم منشأتك' : 'Your company name'}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-600">
                  {isArabic ? 'العملة' : 'Currency'}
                </label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-700"
                >
                  <option value="">{isArabic ? 'اختر العملة' : 'Select currency'}</option>
                  {currencyOptions.map((c) => (
                    <option key={c.code} value={c.code}>{c.code} — {isArabic ? (c.nameAr || c.nameEn) : c.nameEn}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          {step === 2 && (
            <div>
              <label className="mb-2 block text-xs font-medium text-slate-600">
                {isArabic ? 'نوع النشاط' : 'Business type'}
              </label>
              <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                {businessOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setSelectedType(option.id)}
                    className={`rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${
                      selectedType === option.id
                        ? 'border-emerald-700 bg-emerald-50 text-emerald-900'
                        : 'border-slate-200 hover:border-slate-300'
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
              <label className="mb-1.5 block text-xs font-medium text-slate-600">
                {isArabic ? 'بريد Gmail' : 'Gmail address'}
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@gmail.com"
                  className="w-full rounded-lg border border-slate-200 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-emerald-700"
                  disabled={isLoading}
                />
              </div>
              <p className="mt-2 text-xs text-slate-500">
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
                className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600"
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
                className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700"
                disabled={isLoading}
              >
                {isArabic ? 'رجوع' : 'Back'}
              </button>
            )}
            <button
              type="submit"
              disabled={isLoading}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
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
                  {isArabic ? 'ابدأ التجربة' : 'Start free demo'}
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
