import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux'
import { motion } from 'framer-motion'
import {
  Crown,
  Check,
  Shield,
  Zap,
  Star,
  Sparkles,
  ArrowRight,
  CreditCard,
  Loader2,
  Mail,
  MessageCircle,
  Phone,
  Globe,
  Rocket,
  Building2,
  Gem,
  Lock,
} from 'lucide-react'
import api from '../lib/api'
import { getPrimaryBusinessType } from '../lib/businessTypes'
import { isSaudiTenant, showArabicUi } from '../lib/saudiTenant'
import {
  isZatcaFeatureText,
  normalizeCheckoutPlan,
  resolveCheckoutLane,
  resolvePlanPrice,
  zatcaAddonAmount,
} from '../lib/checkoutPricing'
import { setLanguage } from '../store/slices/uiSlice'
import DailyAyat from '../components/ui/DailyAyat'

const fallbackPricingPlans = [
  {
    id: 'starter',
    nameEn: 'Starter',
    nameAr: 'البداية',
    priceMonthlyUsd: 29.99,
    priceYearlyUsd: 299.99,
    priceMonthlySar: 49.99,
    priceYearlySar: 499.99,
    priceMonthly: 29.99,
    priceYearly: 299.99,
    popular: false,
    featuresEn: ['ZATCA E-Invoicing', '1 user', '50 invoices / month', '50 quotations / month', 'Inventory & Warehouses', 'Basic Reports', 'Email Support'],
    featuresAr: ['الفوترة الإلكترونية', 'مستخدم واحد', '50 فاتورة / شهر', '50 عرض سعر / شهر', 'المخزون والمستودعات', 'تقارير أساسية', 'دعم بالبريد'],
  },
  {
    id: 'professional',
    nameEn: 'Professional',
    nameAr: 'الاحترافية',
    priceMonthlyUsd: 59.99,
    priceYearlyUsd: 599.99,
    priceMonthlySar: 99.99,
    priceYearlySar: 999.99,
    priceMonthly: 59.99,
    priceYearly: 599.99,
    popular: true,
    featuresEn: ['Everything in Starter', '3 users', '100 invoices / month', '100 quotations / month', 'HR & Payroll (GOSI/WPS)', 'Expenses & Finance', 'Projects & Tasks', 'Advanced Reports', 'Priority Support'],
    featuresAr: ['كل ما في البداية', '3 مستخدمين', '100 فاتورة / شهر', '100 عرض سعر / شهر', 'الموارد البشرية والرواتب', 'المصروفات والمالية', 'المشاريع والمهام', 'تقارير متقدمة', 'دعم ذو أولوية'],
  },
  {
    id: 'enterprise',
    nameEn: 'Enterprise',
    nameAr: 'المؤسسات',
    priceMonthlyUsd: 0,
    priceYearlyUsd: 0,
    priceMonthlySar: 0,
    priceYearlySar: 0,
    priceMonthly: 0,
    priceYearly: 0,
    popular: false,
    featuresEn: ['Everything in Professional', 'Unlimited users', 'Dedicated Account Manager', 'Custom Integrations', 'On-premise Option', '24/7 Phone Support', 'SLA Guarantee'],
    featuresAr: ['كل ما في الاحترافية', 'مستخدمون غير محدودين', 'مدير حساب مخصص', 'تكاملات مخصصة', 'خيار الخادم الخاص', 'دعم هاتفي 24/7', 'ضمان SLA'],
  },
]

const planMeta = {
  starter: { icon: Rocket, color: 'from-emerald-500 to-teal-600', shadow: 'shadow-emerald-500/20' },
  professional: { icon: Crown, color: 'from-amber-400 to-orange-500', shadow: 'shadow-amber-500/25' },
  enterprise: { icon: Building2, color: 'from-violet-500 to-indigo-600', shadow: 'shadow-violet-500/20' },
}

const complianceLogos = [
  { src: '/ZATCA_Logo.svg', alt: 'ZATCA', cardClassName: 'w-48', imageClassName: 'scale-[1.35]' },
  { src: '/saudi-vision-2030-logo.webp', alt: 'Saudi Vision 2030', cardClassName: 'w-36', imageClassName: 'scale-100' },
  { src: '/saudi_tech_mob_en.svg', alt: 'Saudi Tech MOB', cardClassName: 'w-36', imageClassName: 'scale-100' },
]

export default function DemoCheckout() {
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const { tenant } = useSelector((state) => state.auth)
  const { language } = useSelector((state) => state.ui)
  const isArabic = language === 'ar'

  const [selectedPlan, setSelectedPlan] = useState('professional')
  const [selectedBilling, setSelectedBilling] = useState('monthly')
  const [paymentMethod, setPaymentMethod] = useState('creditcard')
  const [paymentLoading, setPaymentLoading] = useState(false)
  const [paymentError, setPaymentError] = useState('')
  const [mounted, setMounted] = useState(false)
  const [websiteSettings, setWebsiteSettings] = useState(null)
  const [settingsLoading, setSettingsLoading] = useState(true)
  const saudiTenant = isSaudiTenant(tenant)
  const arabicUi = showArabicUi(tenant)
  const [zatcaPhase2Enabled, setZatcaPhase2Enabled] = useState(
    () => saudiTenant && (tenant?.zatca?.phase === 2 || false)
  )

  useEffect(() => {
    setMounted(true)
    if (!tenant) {
      navigate('/login', { replace: true })
    }
  }, [tenant, navigate])

  useEffect(() => {
    if (!saudiTenant) setZatcaPhase2Enabled(false)
  }, [saudiTenant])

  useEffect(() => {
    if (!arabicUi && language === 'ar') dispatch(setLanguage('en'))
  }, [arabicUi, language, dispatch])

  const primaryBusinessType = getPrimaryBusinessType(tenant)

  useEffect(() => {
    let cancelled = false
    setSettingsLoading(true)
    api.get('/public/website', { params: { businessType: primaryBusinessType } })
      .then((res) => {
        if (!cancelled) setWebsiteSettings(res.data)
      })
      .catch(() => {
        if (!cancelled) setWebsiteSettings(null)
      })
      .finally(() => {
        if (!cancelled) setSettingsLoading(false)
      })
    return () => { cancelled = true }
  }, [primaryBusinessType])

  const paymentMethods = websiteSettings?.paymentMethods || {}
  const isPaymentEnabled = (key) => paymentMethods[key] !== false

  useEffect(() => {
    if (!websiteSettings) return
    const isEnabled = (key) => paymentMethods[key] !== false
    const methodMap = {
      creditcard: 'moyasar',
      applepay: 'applePay',
      tabby: 'tabby',
      tamara: 'tamara',
      stcpay: 'stcPay',
      stripe: 'stripe',
    }
    if (isEnabled(methodMap[paymentMethod])) return
    const firstAvailable = [
      { id: 'stripe', key: 'stripe' },
      { id: 'creditcard', key: 'moyasar' },
      { id: 'applepay', key: 'applePay' },
      { id: 'tabby', key: 'tabby' },
      { id: 'tamara', key: 'tamara' },
      { id: 'stcpay', key: 'stcPay' },
    ].find((m) => isEnabled(m.key))
    if (firstAvailable) setPaymentMethod(firstAvailable.id)
  }, [websiteSettings, paymentMethod])

  const checkoutCurrency = resolveCheckoutLane(tenant)

  const plans = useMemo(() => {
    const filterFeatures = (list = []) =>
      (saudiTenant ? list : list.filter((f) => !isZatcaFeatureText(f)))
        .map((f) => String(f).replace(/500 invoices/gi, '100 invoices').replace(/500 فاتورة/g, '100 فاتورة'))

    const configured = websiteSettings?.pricing?.plans
    if (Array.isArray(configured) && configured.length > 0) {
      return configured.map((p) => {
        const fallback = fallbackPricingPlans.find((f) => f.id === p.id)
        const normalized = normalizeCheckoutPlan(p, fallback, checkoutCurrency)
        return {
          ...normalized,
          featuresEn: filterFeatures(normalized.featuresEn?.length ? normalized.featuresEn : fallback?.featuresEn),
          featuresAr: filterFeatures(normalized.featuresAr?.length ? normalized.featuresAr : fallback?.featuresAr),
        }
      })
    }
    return fallbackPricingPlans.map((p) => ({
      ...normalizeCheckoutPlan(p, {}, checkoutCurrency),
      featuresEn: filterFeatures(p.featuresEn),
      featuresAr: filterFeatures(p.featuresAr),
    }))
  }, [websiteSettings, saudiTenant, checkoutCurrency])

  const selectedPlanObj = plans.find((p) => p.id === selectedPlan) || plans[1]
  const amountUsd = resolvePlanPrice(selectedPlanObj, selectedBilling, 'USD')
  const amountSar = resolvePlanPrice(selectedPlanObj, selectedBilling, 'SAR')
  const currency = checkoutCurrency
  const amount = currency === 'SAR' ? amountSar : amountUsd
  const zatcaAddonUsd = saudiTenant && zatcaPhase2Enabled ? zatcaAddonAmount(selectedBilling, 'USD') : 0
  const zatcaAddonSar = saudiTenant && zatcaPhase2Enabled ? zatcaAddonAmount(selectedBilling, 'SAR') : 0
  const zatcaAddon = currency === 'SAR' ? zatcaAddonSar : zatcaAddonUsd
  const totalAmount = Math.round((Number(amount) + Number(zatcaAddon)) * 100) / 100
  const totalAmountUsd = Math.round((Number(amountUsd) + Number(zatcaAddonUsd)) * 100) / 100
  const totalAmountSar = Math.round((Number(amountSar) + Number(zatcaAddonSar)) * 100) / 100

  const handleUpgrade = async () => {
    if (selectedPlan === 'enterprise') {
      window.open('mailto:sales@maqder.com?subject=Enterprise%20Plan%20Inquiry', '_blank')
      return
    }

    setPaymentLoading(true)
    setPaymentError('')

    try {
      const { data } = await api.post('/payments/create-payment', {
        amount: totalAmountUsd,
        amountSar: totalAmountSar,
        currency,
        plan: selectedPlan,
        billingCycle: selectedBilling,
        paymentMethod,
        zatcaPhase2: saudiTenant && zatcaPhase2Enabled,
      })

      if (data?.url) {
        window.location.href = data.url
      } else {
        setPaymentError(isArabic ? 'تعذر إنشاء عملية الدفع' : 'Could not initiate payment')
        setPaymentLoading(false)
      }
    } catch (error) {
      const errData = error.response?.data || {}
      const errMsg = errData.error || (isArabic ? 'حدث خطأ' : 'An error occurred')
      setPaymentError(errMsg)
      setPaymentLoading(false)
    }
  }

  if (!mounted) return null

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-white dark:bg-dark-800">
      {/* Left Panel — Branding & Features */}
      <div className="hidden md:flex md:w-1/2 relative overflow-hidden">
        {/* Solid Background to match Login */}
        <div className="absolute inset-0 bg-[#1a3d28]" />

        <div className="relative z-10 flex flex-col justify-between p-12 text-white w-full">
          <div className="flex items-center gap-3 -ml-4 -mt-4 mb-4">
            <div className="w-full h-40 flex items-center justify-start">
              <img
                src="/maqdernewlogo.webp"
                alt="Maqder"
                className="h-full w-auto object-contain object-left scale-110 origin-left"
              />
            </div>
          </div>

          <div className="space-y-8">
            <div>
              <h1 className="text-4xl lg:text-5xl font-bold leading-tight mb-4">
                {isArabic ? 'الترقية إلى النسخة الكاملة' : 'Upgrade to Full Version'}
              </h1>
              <p className="text-lg lg:text-xl text-white/70 max-w-md">
                {isArabic
                  ? 'افتح كل الميزات — الفوترة، الموارد البشرية، المخزون، التقارير والمزيد.'
                  : 'Unlock all features — invoicing, HR, inventory, reports, and more.'}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {[
                saudiTenant
                  ? { icon: Shield, text: isArabic ? 'متوافق مع فاتورة المرحلة الثانية' : 'ZATCA Phase 2 Compliant' }
                  : { icon: Shield, text: isArabic ? 'فوترة وتقارير احترافية' : 'Professional invoicing & reports' },
                { icon: Zap, text: isArabic ? 'تفعيل فوري بعد الدفع' : 'Instant activation after payment' },
                arabicUi
                  ? { icon: Star, text: isArabic ? 'دعم كامل للغة العربية' : 'Full Arabic RTL support' }
                  : { icon: Star, text: 'Multi-language ready workspace' },
                { icon: Sparkles, text: isArabic ? 'جميع الميزات بدون قيود' : 'All features, no limits' },
              ].map((feature, i) => (
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

            <div className="mt-8">
              <DailyAyat variant="dark" />
            </div>
          </div>

          <div className="text-white/50 text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-8">
            <div>
              2024 Maqder ERP. {isArabic ? 'صنع بواسطة Eastern Workforce Solutions Establishment' : 'Built by Eastern Workforce Solutions Establishment'}
            </div>
            <div className="flex items-center gap-4 text-white/70">
              <a href="tel:+966596775485" title="Call Us" className="hover:text-white transition-colors">
                <Phone className="w-4 h-4" />
              </a>
              <a href="https://wa.me/966596775485" target="_blank" rel="noreferrer" title="WhatsApp" className="hover:text-white transition-colors">
                <MessageCircle className="w-4 h-4" />
              </a>
              <a href="mailto:sales@maqder.com" title="Email Us" className="hover:text-white transition-colors">
                <Mail className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel — Checkout */}
      <div className="relative w-full md:w-1/2 flex items-center justify-center p-6 md:p-10 bg-gradient-to-br from-slate-50 via-white to-emerald-50/40 dark:from-dark-900 dark:via-dark-850 dark:to-dark-900 overflow-hidden">
        {/* Premium ambient background */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-28 -right-28 h-[28rem] w-[28rem] rounded-full bg-emerald-200/40 dark:bg-emerald-900/20 blur-3xl" />
          <div className="absolute -bottom-20 -left-20 h-[24rem] w-[24rem] rounded-full bg-amber-200/30 dark:bg-amber-900/10 blur-3xl" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.8),transparent_60%)] dark:bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.03),transparent_60%)]" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="relative w-full max-w-xl"
        >
          {/* Mobile logo */}
          <div className="md:hidden flex items-center justify-center mb-6">
            <img src="/maqderlogolandingpage.webp" alt="Maqder" className="h-24 w-auto object-contain" />
          </div>

          {/* Language Toggle — GCC / Middle East only */}
          {arabicUi && (
            <div className="flex justify-end mb-4">
              <button
                onClick={() => dispatch(setLanguage(isArabic ? 'en' : 'ar'))}
                className="flex items-center gap-2 rounded-full border border-gray-200 dark:border-dark-600 bg-white dark:bg-dark-800 px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 shadow-sm hover:shadow-md transition-all"
              >
                <Globe className="w-4 h-4" />
                {isArabic ? 'English' : 'العربية'}
              </button>
            </div>
          )}

          {/* Header */}
          <div className="text-center mb-6">
            <h1 className="text-3xl md:text-4xl font-black text-gray-900 dark:text-white mb-2 tracking-tight">
              {isArabic ? 'اختر خطتك' : 'Choose Your Plan'}
            </h1>
            <p className="text-gray-500 dark:text-gray-400 text-base md:text-lg">
              {isArabic ? 'خطوة واحدة تفصلك عن النسخة الكاملة' : 'One step away from the full version'}
            </p>
          </div>

          {/* Premium checkout card */}
          <div className="rounded-[2rem] bg-white/85 dark:bg-dark-800/80 backdrop-blur-2xl border border-white/70 dark:border-white/10 shadow-[0_25px_80px_-20px_rgba(15,61,46,0.15)] dark:shadow-[0_25px_80px_-20px_rgba(0,0,0,0.4)] p-6 md:p-8">
            {/* Plan cards */}
            <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {plans.map((plan) => {
                const isSelected = selectedPlan === plan.id
                const meta = planMeta[plan.id]
                const Icon = meta.icon
                const price = selectedBilling === 'yearly' ? plan.priceYearly : plan.priceMonthly
                return (
                  <button
                    key={plan.id}
                    onClick={() => setSelectedPlan(plan.id)}
                    className={`group relative flex flex-col rounded-2xl border-2 p-4 text-left transition-all duration-200 ${
                      isSelected
                        ? 'border-[#244D33] bg-gradient-to-br from-[#244D33]/[0.06] to-[#1e3f2a]/[0.04] dark:from-[#244D33]/20 dark:to-[#1e3f2a]/10 shadow-lg shadow-[#244D33]/10'
                        : 'border-gray-100 dark:border-dark-600 bg-white dark:bg-dark-700 hover:border-gray-300 dark:hover:border-dark-500 hover:shadow-md'
                    }`}
                  >
                    {plan.popular && (
                      <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 px-3 py-0.5 text-[10px] font-bold text-white shadow-sm">
                        {isArabic ? 'الأكثر شيوعاً' : 'POPULAR'}
                      </span>
                    )}
                    <div className="mb-4">
                      <div className={`relative inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${meta.color} text-white shadow-xl ${meta.shadow} ring-2 ring-white/60 dark:ring-white/10 backdrop-blur-sm transition-all duration-300 group-hover:scale-110 group-hover:rotate-3 ${isSelected ? 'shadow-2xl' : ''}`}>
                        <Icon className="h-6 w-6 drop-shadow-md" />
                        {isSelected && (
                          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-white ring-2 ring-white dark:ring-dark-800 shadow-sm">
                            <Check className="h-2.5 w-2.5" />
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="mb-1.5 flex items-center gap-2">
                      <div className={`flex h-5 w-5 items-center justify-center rounded-full border-2 transition ${isSelected ? 'border-[#244D33] bg-[#244D33]' : 'border-gray-300 dark:border-dark-500'}`}>
                        {isSelected && <Check className="h-3 w-3 text-white" />}
                      </div>
                      <p className="text-sm font-bold text-gray-900 dark:text-white">{isArabic ? plan.nameAr : plan.nameEn}</p>
                    </div>
                    {plan.priceMonthly > 0 ? (
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        <span className="text-lg font-black text-gray-900 dark:text-white">{price}</span> {currency}
                        <span className="ml-0.5">
                          {selectedBilling === 'yearly' ? (isArabic ? '/سنة' : '/yr') : (isArabic ? '/شهر' : '/mo')}
                        </span>
                      </p>
                    ) : (
                      <p className="text-xs text-gray-500 dark:text-gray-400">{isArabic ? 'تواصل معنا' : 'Contact us'}</p>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Selected plan features */}
            {(selectedPlanObj.featuresEn?.length > 0 || selectedPlanObj.featuresAr?.length > 0) && (
              <div className="mb-6 rounded-2xl bg-gradient-to-br from-emerald-50/90 to-white dark:from-emerald-900/10 dark:to-dark-700/50 border border-emerald-100/80 dark:border-emerald-900/20 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
                    <Gem className="h-3.5 w-3.5" />
                  </div>
                  <span className="text-sm font-bold text-gray-900 dark:text-white">
                    {isArabic ? 'ما تحصل عليه' : 'What you get'}
                  </span>
                </div>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {(isArabic ? selectedPlanObj.featuresAr : selectedPlanObj.featuresEn).slice(0, 6).map((feature, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-gray-600 dark:text-gray-300">
                      <Check className="h-3.5 w-3.5 text-emerald-600 mt-0.5 shrink-0" />
                      <span className="leading-relaxed">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Billing cycle toggle */}
            {selectedPlan !== 'enterprise' && (
              <div className="mb-6 flex items-center gap-2 rounded-2xl bg-gray-100/80 dark:bg-dark-700/80 p-1">
                <button
                  onClick={() => setSelectedBilling('monthly')}
                  className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition ${
                    selectedBilling === 'monthly'
                      ? 'bg-white dark:bg-dark-800 text-[#244D33] dark:text-white shadow-sm'
                      : 'text-gray-500 dark:text-gray-400'
                  }`}
                >
                  {isArabic ? 'شهري' : 'Monthly'}
                </button>
                <button
                  onClick={() => setSelectedBilling('yearly')}
                  className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition ${
                    selectedBilling === 'yearly'
                      ? 'bg-white dark:bg-dark-800 text-[#244D33] dark:text-white shadow-sm'
                      : 'text-gray-500 dark:text-gray-400'
                  }`}
                >
                  {isArabic ? 'سنوي' : 'Yearly'}
                  <span className="ml-1.5 text-xs text-emerald-500">−17%</span>
                </button>
              </div>
            )}

            {/* ZATCA Phase 2 — Saudi tenants only */}
            {saudiTenant && selectedPlan !== 'enterprise' && (
              <div className="mb-6 relative overflow-hidden rounded-2xl bg-gradient-to-r from-white via-emerald-50/40 to-white dark:from-dark-800 dark:via-emerald-900/10 dark:to-dark-800 border border-emerald-100/70 dark:border-emerald-900/20 p-4 shadow-[0_8px_30px_-10px_rgba(15,61,46,0.12)] dark:shadow-[0_8px_30px_-10px_rgba(0,0,0,0.3)]">
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/[0.03] via-transparent to-emerald-500/[0.03] pointer-events-none" />
                <div className="relative flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="relative inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white shadow-lg shadow-emerald-500/25 ring-2 ring-white/60 dark:ring-white/10 overflow-hidden p-1">
                      <img src="/zatca-sm-profile-05.png" alt="ZATCA" className="h-full w-full object-contain" />
                      <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-amber-400 text-white ring-2 ring-white dark:ring-dark-800">
                        <Sparkles className="h-2 w-2" />
                      </span>
                    </div>
                    <div>
                      <div className="text-sm font-bold text-gray-900 dark:text-white">
                        {isArabic ? 'تفعيل فاتورة المرحلة الثانية' : 'Enable ZATCA Phase 2'}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {isArabic ? 'فاتورة إلكترونية + متوافقة مع الزكاة' : 'E-invoicing + ZATCA compliance'}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setZatcaPhase2Enabled((v) => !v)}
                    className={`relative h-8 w-14 rounded-full transition-all duration-300 shadow-inner ${
                      zatcaPhase2Enabled
                        ? 'bg-gradient-to-r from-[#244D33] to-[#1e3f2a] shadow-emerald-900/30'
                        : 'bg-gray-300 dark:bg-dark-600'
                    }`}
                    aria-label={isArabic ? 'تفعيل المرحلة الثانية' : 'Toggle ZATCA Phase 2'}
                  >
                    <span
                      className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow-lg transition-all duration-300 flex items-center justify-center ${
                        zatcaPhase2Enabled ? 'translate-x-7' : 'translate-x-1'
                      }`}
                    >
                      <Shield className={`h-3.5 w-3.5 transition-colors ${zatcaPhase2Enabled ? 'text-[#244D33]' : 'text-gray-400'}`} />
                    </span>
                  </button>
                </div>
              </div>
            )}

            {/* Amount display */}
            {selectedPlan !== 'enterprise' && (
              <div className="mb-6 rounded-2xl bg-gradient-to-r from-emerald-50 via-white to-emerald-50 dark:from-emerald-900/10 dark:via-dark-700/30 dark:to-emerald-900/10 border border-emerald-100/60 dark:border-emerald-900/20 p-5">
                <div className="flex items-center justify-center gap-3">
                  <div className="text-center">
                    <span className="text-5xl font-black tracking-tight text-gray-900 dark:text-white">{totalAmount}</span>
                    <span className="ml-1 text-lg font-bold text-gray-500 dark:text-gray-400">{currency}</span>
                    <span className="ml-1 text-sm text-gray-400 dark:text-gray-500">
                      {selectedBilling === 'yearly' ? (isArabic ? '/سنة' : '/year') : (isArabic ? '/شهر' : '/month')}
                    </span>
                  </div>
                </div>
                <p className="mt-2 text-center text-[11px] text-gray-400 dark:text-gray-500">
                  {currency === 'SAR'
                    ? (isArabic ? 'الأسعار بالريال السعودي حسب عملة المنشأة.' : 'Priced in SAR for this tenant’s currency.')
                    : (isArabic ? 'الأسعار بالدولار الأمريكي حسب عملة المنشأة.' : 'Priced in USD for this tenant’s currency.')}
                </p>
                <div className="mt-3 space-y-2 text-sm">
                  <div className="flex items-center justify-between text-gray-600 dark:text-gray-300">
                    <span>{isArabic ? `خطة ${selectedPlanObj.nameAr}` : `${selectedPlanObj.nameEn} plan`}</span>
                    <span className="font-medium">{amount} {currency}</span>
                  </div>
                  {saudiTenant && zatcaPhase2Enabled && (
                    <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-400">
                      <span className="flex items-center gap-1.5">
                        <Shield className="h-4 w-4" />
                        {isArabic ? 'المرحلة الثانية من الزكاة والضريبة' : 'ZATCA Phase 2 addon'}
                      </span>
                      <span className="font-medium">+{zatcaAddon} {currency}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Payment Method Selector */}
            <div className="mb-6">
              <label className="mb-3 block text-center text-sm font-bold text-gray-700 dark:text-gray-300">
                {isArabic ? 'اختر طريقة الدفع' : 'Select Payment Method'}
              </label>
              <div className="flex flex-wrap justify-center gap-3">
                {isPaymentEnabled('stripe') && (
                  <button
                    onClick={() => setPaymentMethod('stripe')}
                    className={`flex min-w-[90px] flex-1 flex-col items-center justify-center gap-2 rounded-2xl border-2 p-3 transition-all sm:flex-none ${
                      paymentMethod === 'stripe'
                        ? 'border-[#635BFF] bg-[#635BFF]/[0.06] dark:bg-[#635BFF]/15 shadow-md'
                        : 'border-gray-100 dark:border-dark-600 hover:border-gray-300 dark:hover:border-dark-500'
                    }`}
                  >
                    <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#635BFF] to-[#0A2540] text-white shadow-lg">
                      <CreditCard className="relative h-6 w-6" />
                    </div>
                    <span className="text-xs font-bold text-gray-800 dark:text-white">Stripe</span>
                  </button>
                )}

                {isPaymentEnabled('moyasar') && (
                  <button
                    onClick={() => setPaymentMethod('creditcard')}
                    className={`flex min-w-[90px] flex-1 flex-col items-center justify-center gap-2 rounded-2xl border-2 p-3 transition-all sm:flex-none ${
                      paymentMethod === 'creditcard'
                        ? 'border-[#244D33] bg-[#244D33]/[0.03] dark:bg-[#244D33]/10 shadow-md'
                        : 'border-gray-100 dark:border-dark-600 hover:border-gray-300 dark:hover:border-dark-500'
                    }`}
                  >
                    <div className={`relative flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#244D33] via-[#1e3f2a] to-[#244D33] text-white shadow-lg ring-2 ring-white/60 dark:ring-white/10 overflow-hidden ${paymentMethod === 'creditcard' ? 'shadow-emerald-500/30' : ''}`}>
                      <div className="absolute inset-0 bg-gradient-to-tr from-white/25 to-transparent" />
                      <CreditCard className="relative h-6 w-6 drop-shadow-md" />
                    </div>
                    <span className="text-xs font-bold text-gray-800 dark:text-white">
                      {isArabic ? 'بطاقة' : 'Card'}
                    </span>
                  </button>
                )}

                {isPaymentEnabled('applePay') && (
                  <button
                    onClick={() => setPaymentMethod('applepay')}
                    className={`flex min-w-[90px] flex-1 flex-col items-center justify-center gap-2 rounded-2xl border-2 p-3 transition-all sm:flex-none ${
                      paymentMethod === 'applepay'
                        ? 'border-[#244D33] bg-[#244D33]/[0.03] dark:bg-[#244D33]/10 shadow-md'
                        : 'border-gray-100 dark:border-dark-600 hover:border-gray-300 dark:hover:border-dark-500'
                    }`}
                  >
                    <img src="/applepay.webp" alt="Apple Pay" className="h-10 w-auto object-contain" />
                    <span className="text-xs font-bold text-gray-800 dark:text-white">Apple Pay</span>
                  </button>
                )}

                {isPaymentEnabled('tabby') && (
                  <button
                    onClick={() => setPaymentMethod('tabby')}
                    className={`flex min-w-[90px] flex-1 flex-col items-center justify-center gap-2 rounded-2xl border-2 p-3 transition-all sm:flex-none ${
                      paymentMethod === 'tabby'
                        ? 'border-[#244D33] bg-[#244D33]/[0.03] dark:bg-[#244D33]/10 shadow-md'
                        : 'border-gray-100 dark:border-dark-600 hover:border-gray-300 dark:hover:border-dark-500'
                    }`}
                  >
                    <img src="/tabby.png" alt="Tabby" className="h-24 w-auto object-contain" />
                    <span className="text-[10px] font-bold text-gray-800 dark:text-white">Tabby</span>
                  </button>
                )}

                {isPaymentEnabled('tamara') && (
                  <button
                    onClick={() => setPaymentMethod('tamara')}
                    className={`flex min-w-[90px] flex-1 flex-col items-center justify-center gap-2 rounded-2xl border-2 p-3 transition-all sm:flex-none ${
                      paymentMethod === 'tamara'
                        ? 'border-[#244D33] bg-[#244D33]/[0.03] dark:bg-[#244D33]/10 shadow-md'
                        : 'border-gray-100 dark:border-dark-600 hover:border-gray-300 dark:hover:border-dark-500'
                    }`}
                  >
                    <img src="/tamara.webp" alt="Tamara" className="h-8 w-auto object-contain" />
                    <span className="text-[10px] font-bold text-gray-800 dark:text-white">Tamara</span>
                  </button>
                )}

                {isPaymentEnabled('stcPay') && (
                  <div className="relative flex min-w-[90px] flex-1 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-gray-100 dark:border-dark-600 p-3 opacity-60 cursor-not-allowed sm:flex-none">
                    <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-gray-500 px-2 py-0.5 text-[9px] font-bold text-white">
                      {isArabic ? 'قريباً' : 'Soon'}
                    </span>
                    <img src="/stcpay.webp" alt="STC Pay" className="h-8 w-auto object-contain" />
                    <span className="text-[10px] font-bold text-gray-800 dark:text-white">STC Pay</span>
                  </div>
                )}
              </div>

              {[
                isPaymentEnabled('stripe'),
                isPaymentEnabled('moyasar'),
                isPaymentEnabled('applePay'),
                isPaymentEnabled('tabby'),
                isPaymentEnabled('tamara'),
                isPaymentEnabled('stcPay'),
              ].some(Boolean) === false && (
                <div className="mt-3 rounded-xl bg-gray-50 dark:bg-dark-700 px-4 py-3 text-center text-xs text-gray-500 dark:text-gray-400">
                  {isArabic ? 'لا توجد طرق دفع متاحة حالياً. يرجى التواصل مع الدعم.' : 'No payment methods are currently available. Please contact support.'}
                </div>
              )}

              {/* Tabby/Tamara info badge */}
              {(paymentMethod === 'tabby' || paymentMethod === 'tamara') && (
                <div className="mt-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/10 px-4 py-2.5 text-center text-xs text-emerald-700 dark:text-emerald-400 font-medium">
                  {paymentMethod === 'tabby'
                    ? (isArabic ? 'قسّمها على 4 دفعات بدون فوائد مع تابي' : 'Split into 4 interest-free payments with Tabby')
                    : (isArabic ? 'ادفع لاحقاً مع تمارا' : 'Pay later with Tamara')}
                </div>
              )}
            </div>

            {/* Error */}
            {paymentError && (
              <div className="mb-4 rounded-xl bg-red-50 dark:bg-red-900/20 px-4 py-3 text-xs text-red-600 dark:text-red-400 whitespace-pre-wrap break-all max-h-40 overflow-y-auto">
                {paymentError}
              </div>
            )}

            {/* CTA */}
            <button
              onClick={handleUpgrade}
              disabled={paymentLoading || settingsLoading}
              className="flex w-full items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-[#244D33] to-[#1e3f2a] px-6 py-4 text-base font-bold text-white shadow-xl shadow-[#244D33]/25 transition hover:shadow-2xl hover:shadow-[#244D33]/35 hover:-translate-y-0.5 disabled:opacity-60 disabled:hover:translate-y-0"
            >
              {paymentLoading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  {isArabic ? 'جاري المعالجة...' : 'Processing...'}
                </>
              ) : selectedPlan === 'enterprise' ? (
                <>
                  <Crown className="h-5 w-5" />
                  {isArabic ? 'تواصل مع المبيعات' : 'Contact Sales'}
                </>
              ) : (
                <>
                  <Lock className="h-5 w-5" />
                  {isArabic ? 'ادفع الآن' : 'Pay Now'}
                  <ArrowRight className="h-5 w-5" />
                </>
              )}
            </button>

            {/* Trust badges */}
            <div className="mt-5 flex flex-wrap items-center justify-center gap-4 text-xs text-gray-500 dark:text-gray-400">
              <span className="flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5" />
                {isArabic ? 'دفع آمن' : 'Secure'}
              </span>
              <span className="flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5" />
                {isArabic ? 'تفعيل فوري' : 'Instant access'}
              </span>
              <span className="flex items-center gap-1.5">
                <Globe className="h-3.5 w-3.5" />
                Visa, Mada, Apple Pay, Tabby, Tamara
              </span>
            </div>

            {/* Trusted & Certified — Saudi compliance logos only */}
            {saudiTenant && (
              <div className="mt-6 pt-6 border-t border-gray-100 dark:border-dark-600">
                <p className="text-center text-[10px] uppercase tracking-wider font-semibold text-gray-400 dark:text-gray-500 mb-3">
                  {isArabic ? 'معتمد وموثوق من' : 'Trusted & Certified'}
                </p>
                <div className="flex flex-wrap items-center justify-center gap-3">
                  {complianceLogos.map((logo) => (
                    <div
                      key={logo.alt}
                      className={`flex h-14 ${logo.cardClassName} items-center justify-center overflow-hidden rounded-xl border border-gray-200 dark:border-dark-600 bg-white dark:bg-dark-700 px-3 py-2`}
                    >
                      <img src={logo.src} alt={logo.alt} className={`max-h-full max-w-full object-contain ${logo.imageClassName}`} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  )
}
