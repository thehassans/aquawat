import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'
import { useSelector } from 'react-redux'
import {
  Check,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  Zap,
  Shield,
  Building2,
  Sparkles,
  Star,
  HelpCircle,
  X,
  Layers,
  Monitor,
  Users,
} from 'lucide-react'
import { usePublicWebsiteSettings } from '../../lib/website'
import Money from '../../components/ui/Money'
import { HighlightText } from '../../components/ui/highlight-text'
import TrialSignup from '../../components/marketing/TrialSignup'

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay: i * 0.08, ease: [0.25, 0.46, 0.45, 0.94] },
  }),
}

const fallbackPlans = [
  {
    id: 'starter',
    nameEn: 'Starter',
    nameAr: 'البداية',
    taglineEn: 'Perfect for small businesses getting started',
    taglineAr: 'مثالي للشركات الصغيرة في بدايتها',
    priceMonthlyUsd: 29.99,
    priceYearlyUsd: 299,
    priceMonthlySar: 49.99,
    priceYearlySar: 499,
    popular: false,
    icon: Zap,
    users: 'Up to 3 users',
    color: '#059669',
    featuresEn: [
      '3 users included',
      '50 invoices & quotations / month',
      'Inventory & Warehouses',
      'Purchase Orders & Suppliers',
      'Basic Financial Reports',
      'Email & Community Support',
    ],
    featuresAr: [
      '3 مستخدمين مشمولين',
      '50 فاتورة وعرض سعر / شهر',
      'المخزون والمستودعات',
      'أوامر الشراء والموردين',
      'تقارير مالية أساسية',
      'دعم بالبريد والمجتمع',
    ],
  },
  {
    id: 'professional',
    nameEn: 'Professional',
    nameAr: 'الاحترافية',
    taglineEn: 'For growing teams that need full operational power',
    taglineAr: 'للفرق النامية التي تحتاج قدرة تشغيلية كاملة',
    priceMonthlyUsd: 59.99,
    priceYearlyUsd: 599,
    priceMonthlySar: 99.99,
    priceYearlySar: 999,
    popular: true,
    icon: Sparkles,
    users: 'Up to 15 users',
    color: '#059669',
    featuresEn: [
      'Up to 15 users',
      'Unlimited invoices & POS transactions',
      'ZATCA Phase 2 E-Invoicing',
      'HR, Payroll, WPS & GOSI',
      'Expenses, Assets & Double-entry Accounting',
      'WhatsApp & Email Automation',
      'Advanced Multi-branch & Analytics',
      'Priority 24/7 Support',
    ],
    featuresAr: [
      'حتى 15 مستخدماً',
      'فواتير ونقاط بيع غير محدودة',
      'فوترة ZATCA المرحلة الثانية',
      'الموارد البشرية والرواتب وWPS والتأمينات',
      'المصروفات والأصول والمحاسبة المزدوجة',
      'أتمتة الواتساب والبريد الإلكتروني',
      'فروع متعددة وتحليلات متقدمة',
      'دعم ذو أولوية على مدار الساعة',
    ],
  },
  {
    id: 'enterprise',
    nameEn: 'Enterprise',
    nameAr: 'المؤسسات',
    taglineEn: 'Custom architecture & SLAs for large organizations',
    taglineAr: 'بنية تحتية مخصصة وضمانات للمؤسسات الكبيرة',
    priceMonthlyUsd: 199.99,
    priceYearlyUsd: 1990,
    priceMonthlySar: 199.99,
    priceYearlySar: 1990,
    popular: false,
    icon: Building2,
    users: 'Unlimited users',
    color: '#0891b2',
    featuresEn: [
      'Unlimited users & branches',
      'Dedicated Account Success Manager',
      'Custom ERP & API Integrations',
      'On-premise or Private Cloud Hosting',
      '24/7 Dedicated Phone & Slack Support',
      '99.99% SLA Uptime Guarantee',
      'Custom Onboarding & Migration',
    ],
    featuresAr: [
      'مستخدمون وفروع غير محدودة',
      'مدير نجاح حساب مخصص',
      'تكاملات ERP وAPI مخصصة',
      'استضافة خاصة أو سحابة مخصصة',
      'دعم هاتفي وسلاك مخصص 24/7',
      'ضمان تشغيل بنسبة 99.99%',
      'تهيئة وترحيل بيانات مخصصة',
    ],
  },
]

const FAQS = [
  {
    qEn: 'Can I change my plan later?',
    qAr: 'هل يمكنني تغيير خطتي لاحقاً؟',
    aEn: 'Yes, you can upgrade or downgrade your plan at any time from your account settings. Changes take effect immediately.',
    aAr: 'نعم، يمكنك الترقية أو التخفيض في أي وقت من إعدادات حسابك. تسري التغييرات فوراً.',
  },
  {
    qEn: 'Is there a free trial?',
    qAr: 'هل هناك فترة تجريبية مجانية؟',
    aEn: 'Absolutely. Every new workspace gets a 7-day free trial with all features and apps unlocked. No credit card required.',
    aAr: 'بالتأكيد. كل مساحة عمل جديدة تحصل على فترة تجريبية مجانية لمدة 7 أيام مع فتح جميع التطبيقات دون الحاجة لبطاقة ائتمان.',
  },
  {
    qEn: 'What currencies do you support?',
    qAr: 'ما هي العملات المدعومة؟',
    aEn: 'Maqder supports SAR, USD, AED, PKR, BDT, KWD, QAR, and many more. Currency is set per workspace.',
    aAr: 'يدعم Maqder SAR وUSD وAED وPKR وBDT وKWD وQAR والعديد غيرها. العملة تُحدد لكل مساحة عمل.',
  },
  {
    qEn: 'Is ZATCA Phase 2 included?',
    qAr: 'هل يشمل امتثال ZATCA المرحلة الثانية؟',
    aEn: 'Yes. ZATCA Phase 2 e-invoicing is fully integrated and compliant for Saudi businesses on all active plans.',
    aAr: 'نعم. فوترة ZATCA المرحلة الثانية مدمجة ومتوافقة تماماً للشركات السعودية في جميع الخطط النشطة.',
  },
  {
    qEn: 'Do you offer an annual billing discount?',
    qAr: 'هل تقدمون خصماً سنوياً؟',
    aEn: 'Yes — paying annually saves approximately 17% to 20% compared to monthly billing.',
    aAr: 'نعم — الدفع السنوي يوفر ما بين 17% إلى 20% مقارنة بالفوترة الشهرية.',
  },
]

function FAQItem({ q, a }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b border-slate-200 dark:border-dark-700 last:border-0">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-4 py-5 text-left transition hover:text-emerald-600"
      >
        <span className="text-base font-bold text-slate-900 dark:text-white">{q}</span>
        {open ? (
          <ChevronUp className="h-5 w-5 shrink-0 text-emerald-600" />
        ) : (
          <ChevronDown className="h-5 w-5 shrink-0 text-slate-400" />
        )}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <p className="pb-5 text-sm leading-relaxed text-slate-500 dark:text-slate-400">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function MarketingPricing() {
  const { language } = useSelector((s) => s.ui)
  const { data } = usePublicWebsiteSettings()
  const isArabic = false
  const dir = 'ltr'

  const [yearly, setYearly] = useState(false)
  const [currencyPref, setCurrencyPref] = useState('SAR')
  const [trialOpen, setTrialOpen] = useState(false)

  const isUsd = currencyPref === 'USD'

  const plans =
    Array.isArray(data?.pricing?.plans) && data.pricing.plans.length > 0
      ? data.pricing.plans
      : fallbackPlans

  useEffect(() => {
    if (!trialOpen) return
    const onKey = (e) => {
      if (e.key === 'Escape') setTrialOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [trialOpen])

  const openTrialModal = (e) => {
    e?.preventDefault?.()
    setTrialOpen(true)
  }

  return (
    <main dir={dir} className="bg-white text-slate-900 antialiased overflow-x-hidden font-body">
      {/* ── HERO WITH COLORFUL HIGHLIGHT TEXT ── */}
      <section className="relative overflow-hidden bg-white pt-24 pb-12">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage:
              'linear-gradient(#000 1px,transparent 1px),linear-gradient(90deg,#000 1px,transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />
        <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 h-[600px] w-[900px] rounded-full bg-emerald-500/10 blur-[140px]" />
        <div className="pointer-events-none absolute top-60 -right-20 h-[400px] w-[400px] rounded-full bg-teal-400/10 blur-[100px]" />

        <div className="relative mx-auto max-w-5xl px-4 text-center sm:px-6 lg:px-8">
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200/80 bg-emerald-50 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-emerald-700 shadow-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {isArabic ? 'خطط مرنة وشفافة' : 'Simple, Transparent Pricing'}
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.6 }}
            className="mt-6 font-display text-4xl font-black tracking-[-0.02em] text-slate-950 sm:text-6xl lg:text-[4rem] leading-[1.15]"
          >
            {isArabic ? (
              <>
                الأسعار التي <HighlightText variant="lime">تنمو معك</HighlightText>{' '}
                <span className="inline-block">— <HighlightText variant="yellow">ولا تعيقك</HighlightText></span>
              </>
            ) : (
              <>
                The Pricing that <HighlightText variant="lime">Grows with you</HighlightText>{' '}
                <span className="inline-block">— <HighlightText variant="yellow">not Against you</HighlightText></span>
              </>
            )}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18, duration: 0.5 }}
            className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-500 sm:text-xl"
          >
            {isArabic
              ? 'ابدأ مجاناً، وادفع عندما تنمو. جميع التطبيقات مشمولة بلا رسوم خفية وبلا عقود.'
              : 'Start free, scale seamlessly. All apps included with zero hidden setup fees and no locked-in contracts.'}
          </motion.p>

          {/* Highlight Text Feature Banner */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.22 }}
            className="mt-8 mx-auto max-w-3xl flex items-center justify-center rounded-2xl border border-slate-200/90 bg-white/90 backdrop-blur-md px-6 py-4 shadow-sm"
          >
            <p className="text-center text-sm sm:text-base font-semibold text-slate-800">
              Switch between <HighlightText variant="lime">monthly</HighlightText> and{' '}
              <HighlightText variant="yellow">annual billing</HighlightText> anytime with{' '}
              <HighlightText variant="pink">zero penalty</HighlightText>.
            </p>
          </motion.div>

          {/* Billing & Currency Controls */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.28 }}
            className="mt-8 flex flex-wrap items-center justify-center gap-4"
          >
            {/* Monthly / Yearly Toggle */}
            <div className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100/80 p-1.5 shadow-sm">
              <button
                type="button"
                onClick={() => setYearly(false)}
                className={`rounded-full px-5 py-2 text-sm font-bold transition-all ${
                  !yearly ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {isArabic ? 'شهرياً' : 'Monthly'}
              </button>
              <button
                type="button"
                onClick={() => setYearly(true)}
                className={`flex items-center gap-2 rounded-full px-5 py-2 text-sm font-bold transition-all ${
                  yearly ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {isArabic ? 'سنوياً' : 'Yearly'}
                <span className="rounded-full bg-emerald-600 text-white px-2.5 py-0.5 text-[11px] font-black shadow-sm">
                  {isArabic ? 'وفّر 17%' : 'Save 17%'}
                </span>
              </button>
            </div>

            {/* Currency Switcher */}
            <div className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100/80 p-1 text-xs font-bold text-slate-600 shadow-sm">
              <button
                type="button"
                onClick={() => setCurrencyPref('SAR')}
                className={`px-3 py-1.5 rounded-full transition ${
                  currencyPref === 'SAR' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500'
                }`}
              >
                🇸🇦 SAR
              </button>
              <button
                type="button"
                onClick={() => setCurrencyPref('USD')}
                className={`px-3 py-1.5 rounded-full transition ${
                  currencyPref === 'USD' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500'
                }`}
              >
                🇺🇸 USD
              </button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── PLANS CARDS GRID ── */}
      <section className="pb-28 pt-6">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-3 items-stretch">
            {plans.map((plan, idx) => {
              const name = isArabic ? plan.nameAr || plan.nameEn : plan.nameEn || plan.nameAr
              const tagline = isArabic
                ? plan.taglineAr || plan.taglineEn || ''
                : plan.taglineEn || plan.taglineAr || ''
              const features = isArabic
                ? plan.featuresAr || plan.featuresEn || []
                : plan.featuresEn || plan.featuresAr || []

              const priceM = Number(
                isUsd ? plan.priceMonthlyUsd ?? plan.priceMonthly ?? 0 : plan.priceMonthlySar ?? plan.priceMonthly ?? 0
              )
              const priceY = Number(
                isUsd ? plan.priceYearlyUsd ?? plan.priceYearly ?? 0 : plan.priceYearlySar ?? plan.priceYearly ?? 0
              )

              const displayPrice = yearly ? (priceY > 0 ? priceY / 12 : 0) : priceM
              const Icon = plan.icon || (idx === 0 ? Layers : idx === 1 ? Sparkles : Building2)
              const currSymbol = isUsd ? '$' : 'SAR '

              return (
                <motion.div
                  key={plan.id}
                  custom={idx}
                  variants={fadeUp}
                  initial="hidden"
                  animate="show"
                  className={`relative flex flex-col justify-between rounded-3xl border p-8 transition-all duration-300 hover:-translate-y-1.5 ${
                    plan.popular
                      ? 'border-emerald-500 bg-gradient-to-b from-emerald-50/90 via-white to-white shadow-[0_16px_48px_-12px_rgba(5,150,105,0.25)] ring-2 ring-emerald-500/40'
                      : 'border-slate-200 bg-white shadow-sm hover:shadow-2xl hover:shadow-slate-200/70 hover:border-emerald-300'
                  }`}
                >
                  {plan.popular && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-black uppercase tracking-wider text-white shadow-lg shadow-emerald-600/30">
                        <Star className="h-3.5 w-3.5 fill-white" />
                        {isArabic ? 'الأكثر طلباً' : 'Most Popular'}
                      </span>
                    </div>
                  )}

                  <div>
                    {/* Icon + Title */}
                    <div className="mb-6 flex items-center gap-3.5">
                      <div
                        className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
                          plan.popular ? 'bg-emerald-600 text-white shadow-md' : 'bg-slate-100 text-emerald-600'
                        }`}
                      >
                        <Icon className="h-6 w-6" />
                      </div>
                      <div>
                        <h3 className="text-xl font-black text-slate-950">{name}</h3>
                        <p className="text-xs text-slate-500 leading-tight mt-0.5">{tagline}</p>
                      </div>
                    </div>

                    {/* Price Block */}
                    <div className="mb-6 border-b border-slate-100 pb-6">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-4xl font-black tracking-tight text-slate-950">
                          {currSymbol}
                          {displayPrice.toFixed(2)}
                        </span>
                        <span className="text-sm font-semibold text-slate-500">/ {isArabic ? 'شهر' : 'month'}</span>
                      </div>
                      {yearly && priceY > 0 && (
                        <p className="mt-1.5 text-xs text-emerald-600 font-bold">
                          {isArabic ? 'يُفوتر' : 'Billed'} {currSymbol}
                          {priceY} {isArabic ? 'سنوياً' : '/ year'} (Save 17%)
                        </p>
                      )}
                      <p className="mt-2 text-xs font-semibold text-slate-400">
                        ✓ {plan.users || 'Multi-user access'}
                      </p>
                    </div>

                    {/* Features List */}
                    <div className="mb-8">
                      <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3">
                        {isArabic ? 'المزايا المشمولة' : 'Included Features'}
                      </h4>
                      <ul className="space-y-3">
                        {features.map((f, i) => (
                          <li key={i} className="flex items-start gap-3 text-sm text-slate-700">
                            <div
                              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                                plan.popular ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              <Check className="h-3 w-3 stroke-[3]" />
                            </div>
                            <span className="font-medium leading-relaxed">{f}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* CTA Button */}
                  <button
                    type="button"
                    onClick={openTrialModal}
                    className={`inline-flex w-full items-center justify-center gap-2 rounded-2xl px-6 py-4 text-sm font-black transition-all hover:-translate-y-0.5 shadow-sm ${
                      plan.popular
                        ? 'bg-emerald-600 text-white shadow-emerald-600/30 hover:bg-emerald-700 hover:shadow-emerald-600/40'
                        : 'border border-slate-200 bg-white text-slate-900 hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-700'
                    }`}
                  >
                    <span>{isArabic ? 'ابدأ الآن مجاناً' : 'Start Free Trial'}</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </motion.div>
              )
            })}
          </div>

          {/* Trust Guarantees */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="mt-12 flex flex-wrap items-center justify-center gap-6 text-sm font-semibold text-slate-500"
          >
            <span className="flex items-center gap-1.5">
              <Check className="h-4 w-4 text-emerald-600" />
              7-Day Full Free Trial
            </span>
            <span className="flex items-center gap-1.5">
              <Check className="h-4 w-4 text-emerald-600" />
              No Credit Card Required
            </span>
            <span className="flex items-center gap-1.5">
              <Check className="h-4 w-4 text-emerald-600" />
              Instant Workspace Activation
            </span>
            <span className="flex items-center gap-1.5">
              <Check className="h-4 w-4 text-emerald-600" />
              Cancel Anytime
            </span>
          </motion.div>
        </div>
      </section>

      {/* ── FEATURE COMPARISON TABLE WITH COLORFUL HIGHLIGHTS ── */}
      <section className="bg-slate-950 py-28 text-white relative overflow-hidden">
        <div className="pointer-events-none absolute -top-40 right-10 h-96 w-96 rounded-full bg-emerald-500/10 blur-[120px]" />
        <div className="pointer-events-none absolute -bottom-40 left-10 h-96 w-96 rounded-full bg-teal-500/10 blur-[120px]" />

        <div className="relative mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="mb-14 text-center">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.25em] text-emerald-400">
              {isArabic ? 'مقارنة الخطط' : 'Feature Matrix'}
            </p>
            <h2 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">
              Everything your <HighlightText variant="lime">business</HighlightText> needs to{' '}
              <span className="inline-block"><HighlightText variant="yellow">scale rapidly</HighlightText></span>
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base text-white/60">
              All plans include the core ERP modules. Higher plans unlock advanced automation, compliance, and custom APIs.
            </p>
          </div>

          <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-sm shadow-2xl">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.04]">
                  <th className="p-5 text-left font-bold text-white/70 w-1/2">
                    {isArabic ? 'الميزة / الخاصية' : 'Module / Feature'}
                  </th>
                  {['Starter', 'Professional', 'Enterprise'].map((h, i) => (
                    <th
                      key={h}
                      className={`p-5 text-center font-bold ${
                        i === 1 ? 'text-emerald-400 bg-emerald-500/10' : 'text-white'
                      }`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { fEn: 'ZATCA Phase 2 E-Invoicing', fAr: 'الفوترة الإلكترونية المرحلة 2', s: true, p: true, e: true },
                  { fEn: 'Inventory & Warehouses', fAr: 'المخزون والمستودعات', s: true, p: true, e: true },
                  { fEn: 'Sales POS & Quotations', fAr: 'نقاط البيع وعروض الأسعار', s: true, p: true, e: true },
                  { fEn: 'HR, Payroll, WPS & GOSI', fAr: 'الموارد البشرية والرواتب', s: false, p: true, e: true },
                  { fEn: 'Expenses & Double-Entry Ledger', fAr: 'المصروفات ودفتر الأستاذ', s: false, p: true, e: true },
                  { fEn: 'Projects, Tasks & Job Costing', fAr: 'المشاريع والتكاليف', s: false, p: true, e: true },
                  { fEn: 'WhatsApp & Email Notification Suite', fAr: 'تكامل الواتساب والبريد', s: false, p: true, e: true },
                  { fEn: 'Multi-branch Central Synchronization', fAr: 'مزامنة الفروع المركزية', s: false, p: true, e: true },
                  { fEn: 'Custom Integrations & REST APIs', fAr: 'تكاملات وواجهات API', s: false, p: false, e: true },
                  { fEn: 'Dedicated Account Success Manager', fAr: 'مدير حساب مخصص', s: false, p: false, e: true },
                  { fEn: '99.99% SLA Uptime Guarantee', fAr: 'ضمان تشغيل 99.99%', s: false, p: false, e: true },
                ].map((row, i) => (
                  <tr
                    key={i}
                    className={`border-b border-white/[0.06] transition hover:bg-white/[0.04] ${
                      i % 2 === 0 ? '' : 'bg-white/[0.015]'
                    }`}
                  >
                    <td className="p-5 font-medium text-white/80">{isArabic ? row.fAr : row.fEn}</td>
                    {[row.s, row.p, row.e].map((v, j) => (
                      <td key={j} className={`p-5 text-center ${j === 1 ? 'bg-emerald-500/5' : ''}`}>
                        {v ? (
                          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
                            <Check className="h-4 w-4 stroke-[3]" />
                          </span>
                        ) : (
                          <span className="inline-block h-1 w-4 rounded-full bg-white/20" />
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── FAQ SECTION ── */}
      <section className="bg-white py-28">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="mb-14 text-center">
            <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-slate-600">
              <HelpCircle className="h-3.5 w-3.5 text-emerald-600" />
              {isArabic ? 'الأسئلة الشائعة' : 'FAQ'}
            </span>
            <h2 className="mt-3 font-display text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl">
              Common <HighlightText variant="lime">Questions</HighlightText> &{' '}
              <HighlightText variant="yellow">Answers</HighlightText>
            </h2>
          </div>
          <div className="rounded-3xl border border-slate-200/90 bg-white px-8 shadow-sm">
            {FAQS.map((faq, i) => (
              <FAQItem key={i} q={isArabic ? faq.qAr : faq.qEn} a={isArabic ? faq.aAr : faq.aEn} />
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA BANNER WITH COLORFUL HIGHLIGHTS ── */}
      <section className="pb-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-950 p-10 text-white shadow-[0_40px_100px_-30px_rgba(5,150,105,0.4)] lg:p-16">
            <div className="pointer-events-none absolute -top-24 -right-24 h-80 w-80 rounded-full bg-white/10 blur-3xl" />
            <div className="relative flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-xl">
                <h2 className="text-3xl font-black lg:text-4xl">
                  {isArabic ? 'ابدأ تجربتك المجانية اليوم' : 'Start your 7-day free trial today'}
                </h2>
                <p className="mt-3 text-lg text-white/75 leading-relaxed">
                  No credit card required. Pick your country and currency, and your workspace is live in under a minute.
                </p>
              </div>
              <div className="flex shrink-0 gap-3">
                <button
                  type="button"
                  onClick={openTrialModal}
                  className="inline-flex items-center gap-2 rounded-full bg-white px-8 py-4 text-sm font-black text-emerald-800 shadow-xl transition-all hover:-translate-y-0.5 hover:bg-emerald-50"
                >
                  <span>{isArabic ? 'ابدأ مجاناً' : 'Start Free Trial'}</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
                <Link
                  to="/contact"
                  className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-8 py-4 text-sm font-bold text-white transition-all hover:bg-white/20"
                >
                  {isArabic ? 'تواصل معنا' : 'Contact Sales'}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── TRIAL SIGNUP MODAL ── */}
      <AnimatePresence>
        {trialOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] flex items-end justify-center bg-[#06140f]/70 p-3 backdrop-blur-xl sm:items-center sm:p-6"
            onClick={() => setTrialOpen(false)}
          >
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-[0.06]"
              style={{
                backgroundImage:
                  'linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)',
                backgroundSize: '48px 48px',
              }}
            />
            <motion.div
              initial={{ opacity: 0, y: 40, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 320, damping: 28 }}
              className="relative flex w-full max-w-[980px] overflow-hidden rounded-[2rem] border border-slate-200/90 bg-white shadow-[0_32px_96px_-24px_rgba(15,23,42,0.24)]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="relative hidden w-[38%] shrink-0 flex-col justify-between overflow-hidden border-r border-slate-100 bg-[#f8faf9] px-8 py-10 text-slate-900 lg:flex">
                <div
                  aria-hidden
                  className="pointer-events-none absolute -top-24 -left-16 h-64 w-64 rounded-full bg-emerald-500/10 blur-[80px]"
                />
                <div
                  aria-hidden
                  className="pointer-events-none absolute bottom-0 right-0 h-48 w-48 rounded-full bg-teal-400/10 blur-[80px]"
                />
                <div className="relative">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200/70 bg-emerald-50 px-3 py-1 text-[10.5px] font-bold uppercase tracking-[0.22em] text-emerald-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Free trial
                  </span>
                  <h3 className="mt-5 font-display text-[1.85rem] font-bold leading-[1.2] tracking-[-0.03em] text-slate-950">
                    Your <HighlightText variant="lime">Workspace</HighlightText> in{' '}
                    <span className="inline-block"><HighlightText variant="yellow">under a minute</HighlightText></span>
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-slate-500">
                    Pick country, company, and currency — then land in a live dashboard.
                  </p>
                </div>
                <ul className="relative mt-10 space-y-4 text-sm">
                  {[
                    '7 full days — every app included',
                    'No credit card required',
                    'Invoices, customers, and reports from first login',
                  ].map((line) => (
                    <li key={line} className="flex items-start gap-3 text-slate-700">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200/70">
                        <Check className="h-3 w-3" strokeWidth={3} />
                      </span>
                      <span className="font-medium leading-relaxed">{line}</span>
                    </li>
                  ))}
                </ul>
                <p className="relative mt-10 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Maqder · Live ERP
                </p>
              </div>

              <div className="relative min-w-0 flex-1 bg-white">
                <button
                  type="button"
                  onClick={() => setTrialOpen(false)}
                  className="absolute right-4 top-4 z-10 rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>
                <div className="border-b border-slate-100 px-6 pb-4 pt-7 lg:hidden">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200/70 bg-emerald-50 px-3 py-1 text-[10.5px] font-bold uppercase tracking-[0.22em] text-emerald-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Free trial
                  </span>
                  <h3 className="mt-2 font-display text-xl font-bold tracking-tight text-slate-950">
                    Your <HighlightText variant="lime">Workspace</HighlightText> in{' '}
                    <HighlightText variant="yellow">under a minute</HighlightText>
                  </h3>
                </div>
                <div className="max-h-[min(78vh,720px)] overflow-y-auto px-6 py-6 sm:px-8">
                  <TrialSignup variant="light" embedded />
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  )
}
