import { useState } from 'react'
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
} from 'lucide-react'
import { usePublicWebsiteSettings } from '../../lib/website'
import Money from '../../components/ui/Money'

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: (i = 0) => ({
    opacity: 1, y: 0,
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
    priceYearlyUsd: 299.99,
    priceMonthlySar: 99.99,
    priceYearlySar: 999.99,
    popular: false,
    icon: Zap,
    color: '#059669',
    featuresEn: ['Up to 5 users', '100 invoices / month', 'Inventory & Warehouses', 'Purchase Orders', 'Basic Reports', 'Email Support'],
    featuresAr: ['حتى 5 مستخدمين', '100 فاتورة / شهر', 'المخزون والمستودعات', 'أوامر الشراء', 'تقارير أساسية', 'دعم بالبريد'],
  },
  {
    id: 'professional',
    nameEn: 'Professional',
    nameAr: 'الاحترافية',
    taglineEn: 'For growing teams that need more power',
    taglineAr: 'للفرق النامية التي تحتاج قدرة أكبر',
    priceMonthlyUsd: 59.99,
    priceYearlyUsd: 599.99,
    priceMonthlySar: 199.99,
    priceYearlySar: 1999.99,
    popular: true,
    icon: Sparkles,
    color: '#059669',
    featuresEn: ['Up to 25 users', 'Unlimited Invoices', 'HR & Payroll', 'Expenses & Finance', 'Projects & Tasks', 'WhatsApp Integration', 'Advanced Reports', 'Priority Support'],
    featuresAr: ['حتى 25 مستخدم', 'فواتير غير محدودة', 'الموارد البشرية والرواتب', 'المصروفات والمالية', 'المشاريع والمهام', 'تكامل واتساب', 'تقارير متقدمة', 'دعم ذو أولوية'],
  },
  {
    id: 'enterprise',
    nameEn: 'Enterprise',
    nameAr: 'المؤسسات',
    taglineEn: 'Custom solutions for large organizations',
    taglineAr: 'حلول مخصصة للمؤسسات الكبيرة',
    priceMonthlyUsd: 0,
    priceYearlyUsd: 0,
    priceMonthlySar: 0,
    priceYearlySar: 0,
    popular: false,
    icon: Building2,
    color: '#0891b2',
    featuresEn: ['Unlimited users', 'Dedicated Account Manager', 'Custom Integrations', 'On-premise or Private Cloud', '24/7 Phone Support', 'SLA Guarantee', 'Custom Onboarding'],
    featuresAr: ['مستخدمون غير محدودين', 'مدير حساب مخصص', 'تكاملات مخصصة', 'خادم خاص أو سحابة خاصة', 'دعم هاتفي 24/7', 'ضمان SLA', 'تهيئة مخصصة'],
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
    aEn: 'Absolutely. Every new workspace gets a free trial with no credit card required. Start from the home page.',
    aAr: 'بالتأكيد. كل مساحة عمل جديدة تحصل على فترة تجريبية مجانية دون الحاجة لبطاقة ائتمان.',
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
    aEn: 'Yes. ZATCA Phase 2 e-invoicing is available for Saudi tenants on any paid plan as an included feature.',
    aAr: 'نعم. فوترة ZATCA المرحلة الثانية متاحة للمستأجرين السعوديين في أي خطة مدفوعة كميزة مشمولة.',
  },
  {
    qEn: 'Do you offer a yearly discount?',
    qAr: 'هل تقدمون خصماً سنوياً؟',
    aEn: 'Yes — paying yearly saves you approximately 17% compared to monthly billing.',
    aAr: 'نعم — الدفع السنوي يوفر لك حوالي 17% مقارنة بالفوترة الشهرية.',
  },
]

function FAQItem({ q, a, isArabic }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b border-slate-200 last:border-0">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-4 py-5 text-left"
      >
        <span className="text-base font-semibold text-slate-900">{q}</span>
        {open
          ? <ChevronUp className="h-5 w-5 shrink-0 text-emerald-600" />
          : <ChevronDown className="h-5 w-5 shrink-0 text-slate-400" />}
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
            <p className="pb-5 text-sm leading-relaxed text-slate-500">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function MarketingPricing() {
  const { language } = useSelector((s) => s.ui)
  const { data } = usePublicWebsiteSettings()
  const isArabic = language === 'ar'
  const dir = isArabic ? 'rtl' : 'ltr'

  const [yearly, setYearly] = useState(false)

  const rawCurrency = data?.pricing?.currency || 'USD'
  const currency = String(rawCurrency).toUpperCase()
  const isUsd = currency === 'USD'

  const plans =
    Array.isArray(data?.pricing?.plans) && data.pricing.plans.length > 0
      ? data.pricing.plans
      : fallbackPlans

  return (
    <main dir={dir} className="bg-white text-slate-900 antialiased overflow-x-hidden">

      {/* ── HERO ── */}
      <section className="relative overflow-hidden bg-white pt-20 pb-10">
        <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 h-[600px] w-[900px] rounded-full bg-emerald-500/8 blur-[140px]" />
        <div className="relative mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200/70 bg-emerald-50 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-emerald-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              {isArabic ? 'خطط مرنة للشركات النامية' : 'Transparent, flexible pricing'}
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.6 }}
            className="mt-5 font-display text-5xl font-bold tracking-[-0.02em] text-slate-950 sm:text-6xl lg:text-7xl"
          >
            {isArabic ? (
              <>خطط تنمو<br /><span className="text-emerald-600">معك</span></>
            ) : (
              <>Plans that<br /><span className="text-emerald-600">grow with you</span></>
            )}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18, duration: 0.5 }}
            className="mx-auto mt-5 max-w-xl text-lg text-slate-500"
          >
            {isArabic
              ? 'ابدأ مجاناً، وادفع عندما تنمو. لا رسوم خفية، لا عقود.'
              : 'Start free, pay as you grow. No hidden fees, no contracts.'}
          </motion.p>

          {/* Billing toggle */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.25 }}
            className="mt-8 inline-flex items-center gap-3 rounded-full border border-slate-200 bg-slate-50/80 p-1.5 shadow-sm"
          >
            <button
              onClick={() => setYearly(false)}
              className={`rounded-full px-5 py-2 text-sm font-bold transition-all ${!yearly ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
            >
              {isArabic ? 'شهرياً' : 'Monthly'}
            </button>
            <button
              onClick={() => setYearly(true)}
              className={`flex items-center gap-2 rounded-full px-5 py-2 text-sm font-bold transition-all ${yearly ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
            >
              {isArabic ? 'سنوياً' : 'Yearly'}
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                {isArabic ? 'وفّر 17%' : 'Save 17%'}
              </span>
            </button>
          </motion.div>
        </div>
      </section>

      {/* ── PLANS GRID ── */}
      <section className="pb-28 pt-8">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-6 lg:grid-cols-3">
            {plans.map((plan, idx) => {
              const name = isArabic ? (plan.nameAr || plan.nameEn) : (plan.nameEn || plan.nameAr)
              const tagline = isArabic ? (plan.taglineAr || plan.taglineEn || '') : (plan.taglineEn || plan.taglineAr || '')
              const features = isArabic ? (plan.featuresAr || plan.featuresEn || []) : (plan.featuresEn || plan.featuresAr || [])
              const priceM = Number(isUsd ? (plan.priceMonthlyUsd ?? plan.priceMonthly ?? 0) : (plan.priceMonthlySar ?? plan.priceMonthly ?? 0))
              const priceY = Number(isUsd ? (plan.priceYearlyUsd ?? plan.priceYearly ?? 0) : (plan.priceYearlySar ?? plan.priceYearly ?? 0))
              const displayPrice = yearly ? (priceY > 0 ? priceY / 12 : 0) : priceM
              const isFree = displayPrice <= 0
              const Icon = plan.icon || Zap

              return (
                <motion.div
                  key={plan.id}
                  custom={idx}
                  variants={fadeUp}
                  initial="hidden"
                  animate="show"
                  className={`relative flex flex-col rounded-3xl border p-8 transition-all duration-300 hover:-translate-y-1 ${
                    plan.popular
                      ? 'border-emerald-300 bg-gradient-to-b from-emerald-50/80 to-white shadow-[0_8px_48px_-12px_rgba(5,150,105,0.25)] ring-1 ring-emerald-200'
                      : 'border-slate-200 bg-white shadow-sm hover:shadow-xl hover:shadow-slate-200/60'
                  }`}
                >
                  {plan.popular && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-bold text-white shadow-lg shadow-emerald-600/30">
                        <Star className="h-3 w-3 fill-white" />
                        {isArabic ? 'الأكثر شيوعاً' : 'Most Popular'}
                      </span>
                    </div>
                  )}

                  {/* Icon + name */}
                  <div className="mb-6 flex items-center gap-3">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${plan.popular ? 'bg-emerald-600' : 'bg-slate-100'}`}>
                      <Icon className={`h-5 w-5 ${plan.popular ? 'text-white' : 'text-slate-600'}`} />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-950">{name}</h3>
                      <p className="text-xs text-slate-500 leading-tight mt-0.5">{tagline}</p>
                    </div>
                  </div>

                  {/* Price */}
                  <div className="mb-6 border-b border-slate-100 pb-6">
                    {isFree ? (
                      <div>
                        <p className="text-4xl font-bold text-slate-950">{isArabic ? 'مخصص' : 'Custom'}</p>
                        <p className="mt-1 text-sm text-slate-500">{isArabic ? 'تواصل معنا للأسعار' : 'Contact us for pricing'}</p>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-baseline gap-1">
                          <span className="text-4xl font-bold tracking-tight text-slate-950">
                            <Money value={displayPrice} currency={currency} language={language} minimumFractionDigits={2} maximumFractionDigits={2} />
                          </span>
                          <span className="text-sm font-medium text-slate-500">/ {isArabic ? 'شهر' : 'mo'}</span>
                        </div>
                        {yearly && priceY > 0 && (
                          <p className="mt-1 text-xs text-emerald-600 font-semibold">
                            {isArabic ? 'يُفوتر' : 'Billed'}{' '}
                            <Money value={priceY} currency={currency} language={language} minimumFractionDigits={0} maximumFractionDigits={0} />
                            {isArabic ? ' سنوياً' : ' / year'}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Features */}
                  <ul className="mb-8 flex-1 space-y-3">
                    {features.map((f, i) => (
                      <li key={i} className="flex items-start gap-3 text-sm text-slate-600">
                        <div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${plan.popular ? 'bg-emerald-100' : 'bg-slate-100'}`}>
                          <Check className={`h-3 w-3 ${plan.popular ? 'text-emerald-600' : 'text-slate-500'}`} />
                        </div>
                        <span className="leading-relaxed">{f}</span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA */}
                  <Link
                    to={isFree ? '/contact' : '/'}
                    onClick={isFree ? undefined : (e) => { e.preventDefault(); document.getElementById('trial')?.scrollIntoView({ behavior: 'smooth' }) }}
                    className={`inline-flex w-full items-center justify-center gap-2 rounded-2xl px-6 py-3.5 text-sm font-bold transition-all hover:-translate-y-0.5 ${
                      plan.popular
                        ? 'bg-emerald-600 text-white shadow-[0_4px_16px_-4px_rgba(5,150,105,0.5)] hover:bg-emerald-700 hover:shadow-[0_6px_24px_-4px_rgba(5,150,105,0.55)]'
                        : 'border border-slate-200 bg-white text-slate-900 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700'
                    }`}
                  >
                    {isFree ? (isArabic ? 'تواصل معنا' : 'Contact sales') : (isArabic ? 'ابدأ الآن' : 'Get started')}
                    <ArrowRight className={`h-4 w-4 ${isArabic ? 'rotate-180' : ''}`} />
                  </Link>
                </motion.div>
              )
            })}
          </div>

          {/* Trust line */}
          <motion.p
            initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
            className="mt-10 text-center text-sm text-slate-400"
          >
            {isArabic
              ? '✓ لا بطاقة ائتمان مطلوبة · ✓ إلغاء في أي وقت · ✓ بيانات آمنة ومشفرة'
              : '✓ No credit card required · ✓ Cancel anytime · ✓ Encrypted & secure data'}
          </motion.p>
        </div>
      </section>

      {/* ── FEATURE COMPARISON TABLE ── */}
      <section className="bg-slate-950 py-28 text-white">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="mb-14 text-center">
            <h2 className="text-4xl font-bold tracking-tight sm:text-5xl">
              {isArabic ? 'ما الذي يشمله كل خطة؟' : "What's included in every plan?"}
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-white/50">
              {isArabic ? 'جميع الخطط تشمل النواة الأساسية. الخطط الأعلى تفتح المزيد.' : 'All plans include the core. Higher tiers unlock more.'}
            </p>
          </div>

          <div className="overflow-hidden rounded-3xl border border-white/10">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.04]">
                  <th className="p-5 text-left font-bold text-white/60 w-1/2">{isArabic ? 'الميزة' : 'Feature'}</th>
                  {['Starter', 'Pro', 'Enterprise'].map((h) => (
                    <th key={h} className="p-5 text-center font-bold text-white">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { fEn: 'E-Invoicing', fAr: 'الفوترة الإلكترونية', s: true, p: true, e: true },
                  { fEn: 'Inventory', fAr: 'المخزون', s: true, p: true, e: true },
                  { fEn: 'HR & Leave', fAr: 'الموارد البشرية', s: false, p: true, e: true },
                  { fEn: 'Payroll & WPS', fAr: 'الرواتب وWPS', s: false, p: true, e: true },
                  { fEn: 'Projects', fAr: 'المشاريع', s: false, p: true, e: true },
                  { fEn: 'WhatsApp', fAr: 'واتساب', s: false, p: true, e: true },
                  { fEn: 'Custom Integrations', fAr: 'تكاملات مخصصة', s: false, p: false, e: true },
                  { fEn: 'Dedicated Manager', fAr: 'مدير حساب مخصص', s: false, p: false, e: true },
                  { fEn: 'SLA Guarantee', fAr: 'ضمان SLA', s: false, p: false, e: true },
                ].map((row, i) => (
                  <tr key={i} className={`border-b border-white/[0.06] ${i % 2 === 0 ? '' : 'bg-white/[0.02]'}`}>
                    <td className="p-5 font-medium text-white/75">{isArabic ? row.fAr : row.fEn}</td>
                    {[row.s, row.p, row.e].map((v, j) => (
                      <td key={j} className="p-5 text-center">
                        {v
                          ? <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/20"><Check className="h-4 w-4 text-emerald-400" /></span>
                          : <span className="inline-block h-1 w-4 rounded-full bg-white/15" />
                        }
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="bg-white py-28">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="mb-14 text-center">
            <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-slate-600">
              <HelpCircle className="h-3.5 w-3.5" />
              {isArabic ? 'الأسئلة الشائعة' : 'FAQ'}
            </span>
            <h2 className="mt-4 text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl">
              {isArabic ? 'أسئلة شائعة' : 'Common questions'}
            </h2>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white px-8 shadow-sm">
            {FAQS.map((faq, i) => (
              <FAQItem key={i} q={isArabic ? faq.qAr : faq.qEn} a={isArabic ? faq.aAr : faq.aEn} isArabic={isArabic} />
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA BANNER ── */}
      <section className="pb-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-900 p-10 text-white shadow-[0_40px_100px_-30px_rgba(5,150,105,0.4)] lg:p-16">
            <div className="pointer-events-none absolute -top-24 -right-24 h-80 w-80 rounded-full bg-white/10 blur-3xl" />
            <div className="relative flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-xl">
                <h2 className="text-3xl font-bold lg:text-4xl">
                  {isArabic ? 'ابدأ تجربتك المجانية اليوم' : 'Start your free trial today'}
                </h2>
                <p className="mt-3 text-lg text-white/65">
                  {isArabic ? 'لا حاجة لبطاقة ائتمان. النظام جاهز في أقل من دقيقة.' : 'No credit card needed. Your workspace is ready in under a minute.'}
                </p>
              </div>
              <div className="flex shrink-0 gap-3">
                <Link
                  to="/"
                  onClick={(e) => { e.preventDefault(); window.location.replace('/#trial') }}
                  className="inline-flex items-center gap-2 rounded-full bg-white px-8 py-4 text-sm font-bold text-emerald-700 shadow-lg transition-all hover:-translate-y-0.5"
                >
                  {isArabic ? 'ابدأ مجاناً' : 'Start for free'}
                  <ArrowRight className={`h-4 w-4 ${isArabic ? 'rotate-180' : ''}`} />
                </Link>
                <Link to="/contact" className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-8 py-4 text-sm font-bold text-white transition-all hover:bg-white/20">
                  {isArabic ? 'تواصل معنا' : 'Talk to sales'}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

    </main>
  )
}
