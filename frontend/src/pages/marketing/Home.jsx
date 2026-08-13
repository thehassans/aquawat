import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion, useInView } from 'framer-motion'
import { useRef } from 'react'
import TrialSignup from '../../components/marketing/TrialSignup'
import PremiumAppIcon, { PREMIUM_APP_CATALOG } from '../../components/marketing/PremiumAppIcon'
import { ArrowRight, Star, TrendingUp, X, Wallet, FileText, ShieldCheck, Building2, Store, Users, Utensils, Truck, Briefcase, Check } from 'lucide-react'

const TENANT_STORY_ICONS = [Building2, Store, Users, Utensils, Truck, Briefcase]

function Counter({ to, suffix = '', duration = 1800 }) {
  const [val, setVal] = useState(0)
  const ref = useRef(null)
  const inView = useInView(ref, { once: true })
  useEffect(() => {
    if (!inView) return
    let start = 0
    const step = to / (duration / 16)
    const id = setInterval(() => {
      start += step
      if (start >= to) { setVal(to); clearInterval(id) }
      else setVal(Math.floor(start))
    }, 16)
    return () => clearInterval(id)
  }, [inView, to, duration])
  return <span ref={ref}>{val.toLocaleString()}{suffix}</span>
}

function Marquee({ children, duration = 40, reverse = false, className = '' }) {
  return (
    <div className={`relative overflow-hidden ${className}`}>
      <div
        className="flex w-max gap-4"
        style={{
          animation: `${reverse ? 'maqderMarqueeReverse' : 'maqderMarquee'} ${duration}s linear infinite`,
        }}
      >
        {children}
        {children}
      </div>
    </div>
  )
}

const TESTIMONIALS = [
  {
    companyEn: 'Al Noor Trading Co.',
    companyAr: 'شركة النور للتجارة',
    industryEn: 'Wholesale & Distribution',
    industryAr: 'الجملة والتوزيع',
    content: 'Month-end close is faster and cleaner. Finance, inventory, and reporting finally live in one place.',
    contentAr: 'إقفال الشهر أسرع وأنظف. المالية والمخزون والتقارير في مكان واحد.',
    accent: '#10b981',
  },
  {
    companyEn: 'Riyadh Retail Group',
    companyAr: 'مجموعة الرياض للتجزئة',
    industryEn: 'Multi-branch Retail',
    industryAr: 'تجزئة متعددة الفروع',
    content: 'POS, inventory, and e-invoicing in one login. Checkout speed improved across every branch.',
    contentAr: 'نقطة البيع والمخزون والفوترة في تسجيل دخول واحد. سرعة الدفع تحسنت في كل فرع.',
    accent: '#14b8a6',
  },
  {
    companyEn: 'Gulf Manpower Services',
    companyAr: 'خدمات الخليج للقوى العاملة',
    industryEn: 'HR & Workforce',
    industryAr: 'الموارد البشرية والعمالة',
    content: 'Payroll, WPS, and leave approvals finally feel automatic. Zero end-of-month panic.',
    contentAr: 'الرواتب وWPS وموافقات الإجازات أصبحت تلقائية. لا ذعر في نهاية الشهر.',
    accent: '#f59e0b',
  },
  {
    companyEn: 'Desert Bloom F&B',
    companyAr: 'ديزرت بلوم للمأكولات',
    industryEn: 'Restaurant Chain',
    industryAr: 'سلسلة مطاعم',
    content: 'Kitchen, inventory, and tax-ready receipts run together — our managers finally see the full picture.',
    contentAr: 'المطبخ والمخزون والإيصالات الضريبية تعمل معاً — المديرون يرون الصورة كاملة.',
    accent: '#ef4444',
  },
  {
    companyEn: 'Horizon Logistics',
    companyAr: 'هورايزون للخدمات اللوجستية',
    industryEn: 'Warehousing & Shipping',
    industryAr: 'المستودعات والشحن',
    content: 'Multi-warehouse tracking with live alerts changed how we operate at scale.',
    contentAr: 'تتبع المستودعات المتعددة مع التنبيهات الحية غيّر طريقة عملنا.',
    accent: '#3b82f6',
  },
  {
    companyEn: 'BrightPath Consulting',
    companyAr: 'برايت باث للاستشارات',
    industryEn: 'Professional Services',
    industryAr: 'الخدمات المهنية',
    content: 'Live P&L and cash-flow views replaced three spreadsheets we used every week.',
    contentAr: 'لوحة الأرباح والتدفق النقدي استبدلت ثلاثة جداول كنا نستخدمها أسبوعياً.',
    accent: '#34d399',
  },
]

const REVENUE_BARS = [42, 55, 48, 68, 72, 64, 88, 80, 95, 90, 78, 100]
const EXPENSE_BARS = [30, 34, 32, 40, 38, 36, 44, 42, 48, 45, 41, 50]

export default function MarketingHome() {
  // Marketing site is English-only (no Arabic UI).
  const isArabic = false
  const dir = 'ltr'
  const [trialOpen, setTrialOpen] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('trial') === '1') {
      setTrialOpen(true)
      window.history.replaceState({}, '', '/')
    }
  }, [])

  useEffect(() => {
    if (!trialOpen) return
    const onKey = (e) => { if (e.key === 'Escape') setTrialOpen(false) }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [trialOpen])

  const openTrial = (e) => {
    e?.preventDefault?.()
    setTrialOpen(true)
  }

  return (
    <main dir={dir} className="bg-white text-slate-900 antialiased overflow-x-hidden font-body">
      <style>{`
        @keyframes maqderMarquee {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        @keyframes maqderMarqueeReverse {
          from { transform: translateX(-50%); }
          to { transform: translateX(0); }
        }
      `}</style>

      {/* ── HERO ── */}
      <section className="relative overflow-hidden bg-white">
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.035]" style={{ backgroundImage: 'linear-gradient(#000 1px,transparent 1px),linear-gradient(90deg,#000 1px,transparent 1px)', backgroundSize: '48px 48px' }} />
        <div className="pointer-events-none absolute -top-40 -right-40 h-[600px] w-[600px] rounded-full bg-emerald-500/10 blur-[120px]" />
        <div className="pointer-events-none absolute top-60 -left-20 h-[400px] w-[400px] rounded-full bg-emerald-400/10 blur-[90px]" />

        <div className="relative mx-auto max-w-7xl px-4 pt-20 pb-6 sm:px-6 lg:px-8 lg:pt-28">
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-6 flex justify-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200/70 bg-emerald-50 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-emerald-700">
              <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
              {isArabic ? 'نظام ERP سحابي متكامل' : 'All-in-one cloud ERP platform'}
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.65, delay: 0.08 }}
            className="mx-auto max-w-5xl text-center font-display text-[2.75rem] font-bold leading-[1.1] tracking-[-0.02em] text-slate-950 sm:text-6xl lg:text-[4.5rem]"
          >
            {isArabic ? (
              <>{'كل أعمالك على '}<span className="text-emerald-600">منصة واحدة</span></>
            ) : (
              <>The ERP that <span className="text-emerald-600">grows with you</span> — not against you.</>
            )}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}
            className="mx-auto mt-5 max-w-2xl text-center text-lg leading-relaxed text-slate-500 sm:text-xl"
          >
            {isArabic
              ? 'فوترة ذكية، موارد بشرية، مخزون، وتقارير حية — منصة واحدة مُهيَّأة لعملتك ودولتك.'
              : 'Invoicing, HR, payroll, inventory & live reporting — one unified platform tuned to your country and currency.'}
          </motion.p>

          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.25 }} className="mt-5 flex justify-center">
            <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-5 py-2 shadow-sm backdrop-blur-sm">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-sm font-bold text-slate-700">
                {isArabic ? 'من 29.99 دولار / شهرياً — جميع التطبيقات' : 'From US$ 29.99 / month — all apps included'}
              </span>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <button
              type="button"
              onClick={openTrial}
              className="group inline-flex items-center gap-2.5 rounded-full bg-emerald-600 px-8 py-4 text-base font-bold text-white shadow-[0_8px_32px_-8px_rgba(5,150,105,0.55)] transition-all hover:-translate-y-0.5 hover:bg-emerald-700"
            >
              {isArabic ? 'ابدأ الآن — مجاناً' : "Start now — It's free"}
              <ArrowRight className={`h-5 w-5 transition-transform group-hover:translate-x-0.5 ${isArabic ? 'rotate-180' : ''}`} />
            </button>
            <Link to="/pricing" className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-8 py-4 text-base font-bold text-slate-700 shadow-sm transition-all hover:border-slate-400 hover:bg-slate-50">
              {isArabic ? 'الأسعار' : 'View pricing'}
            </Link>
          </motion.div>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.45 }} className="mt-6 flex items-center justify-center gap-3 text-sm text-slate-500">
            <div className="flex items-center gap-0.5">
              {[...Array(5)].map((_, j) => <Star key={j} className="h-4 w-4 fill-amber-400 text-amber-400" />)}
            </div>
            <span>{isArabic ? '٤.٩/٥ · أكثر من ٥٠٠ شركة' : '4.9 / 5 · 500+ companies'}</span>
          </motion.div>
        </div>

        {/* Premium app icon grid */}
        <div className="relative mx-auto max-w-6xl px-4 pb-8 sm:px-6 lg:px-8">
          <motion.div initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-7">
            {PREMIUM_APP_CATALOG.slice(0, 14).map((app) => (
              <PremiumAppIcon
                key={app.id}
                name={app.id}
                size={64}
                showLabel
                label={isArabic ? app.labelAr : app.labelEn}
                className="transition-transform hover:-translate-y-1"
              />
            ))}
          </motion.div>
          <div className="mt-8 flex justify-center">
            <Link to="/solutions" className="inline-flex items-center gap-1.5 text-sm font-bold text-emerald-600 hover:text-emerald-700">
              {isArabic ? 'عرض كل التطبيقات' : 'View all apps'}
              <ArrowRight className={`h-4 w-4 ${isArabic ? 'rotate-180' : ''}`} />
            </Link>
          </div>
        </div>
      </section>

      {/* ── LIVE REPORTING ── */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#f7faf8] via-white to-[#f3f7f5] py-28">
        <div className="pointer-events-none absolute inset-0 opacity-[0.4]" style={{ backgroundImage: 'radial-gradient(circle at 20% 20%, #05966918 0%, transparent 42%), radial-gradient(circle at 85% 10%, #14b8a618 0%, transparent 40%)' }} />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-14 text-center">
            <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.32em] text-emerald-600">
              {isArabic ? 'تقارير حية' : 'Live reporting'}
            </p>
            <h2 className="font-display text-4xl font-bold tracking-[-0.02em] text-slate-950 sm:text-5xl lg:text-[3.25rem]">
              {isArabic ? 'أرباحك، تكاليفك، ونموك — بوضوح.' : 'Revenue, costs, and growth — crystal clear.'}
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-slate-500">
              {isArabic
                ? 'لوحات مالية حقيقية: الإيرادات مقابل المصروفات، هامش الربح، والتدفق النقدي — تتحدث لحظة بلحظة.'
                : 'Real finance views: revenue vs expenses, margin, and cash flow — updating as your business moves.'}
            </p>
          </div>

          <div className="grid gap-5 lg:grid-cols-12">
            <motion.div
              initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              className="rounded-[1.75rem] border border-slate-200/80 bg-white p-6 shadow-[0_20px_50px_-30px_rgba(15,23,42,0.25)] lg:col-span-8"
            >
              <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">{isArabic ? 'الأرباح والخسائر' : 'Profit & Loss'}</p>
                  <p className="mt-1 font-display text-3xl font-bold tracking-tight text-slate-950">$1.24M <span className="text-sm font-semibold text-emerald-600">+18.4%</span></p>
                </div>
                <div className="flex items-center gap-4 text-xs font-bold">
                  <span className="inline-flex items-center gap-1.5 text-emerald-700"><span className="h-2 w-2 rounded-full bg-emerald-500" />{isArabic ? 'إيراد' : 'Revenue'}</span>
                  <span className="inline-flex items-center gap-1.5 text-teal-700"><span className="h-2 w-2 rounded-full bg-teal-400" />{isArabic ? 'مصروف' : 'Expense'}</span>
                </div>
              </div>
              <div className="flex h-48 items-end gap-2 sm:gap-3">
                {REVENUE_BARS.map((h, i) => (
                  <div key={i} className="flex flex-1 flex-col items-center justify-end gap-1">
                    <div className="flex w-full items-end gap-0.5" style={{ height: '100%' }}>
                      <div className="flex-1 rounded-t-md bg-gradient-to-t from-emerald-600 to-emerald-400" style={{ height: `${h}%` }} />
                      <div className="flex-1 rounded-t-md bg-gradient-to-t from-teal-500 to-teal-300 opacity-90" style={{ height: `${EXPENSE_BARS[i]}%` }} />
                    </div>
                    <span className="text-[10px] font-semibold text-slate-400">{['J','F','M','A','M','J','J','A','S','O','N','D'][i]}</span>
                  </div>
                ))}
              </div>
            </motion.div>

            <div className="grid gap-4 sm:grid-cols-3 lg:col-span-4 lg:grid-cols-1">
              {[
                { labelEn: 'Gross margin', labelAr: 'هامش الربح', value: '42.8%', trend: '+2.1%', up: true, Icon: TrendingUp },
                { labelEn: 'Cash on hand', labelAr: 'النقد المتاح', value: '$318K', trend: '+9%', up: true, Icon: Wallet },
                { labelEn: 'Open invoices', labelAr: 'فواتير مفتوحة', value: '86', trend: '−12%', up: true, Icon: FileText },
              ].map((k, i) => (
                <motion.div
                  key={k.labelEn}
                  initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                  transition={{ delay: i * 0.08 }}
                  className="rounded-[1.5rem] border border-slate-200/80 bg-white p-5 shadow-sm"
                >
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 ring-1 ring-emerald-100">
                    <k.Icon className="h-5 w-5 text-emerald-600" />
                  </div>
                  <p className="text-xs font-semibold text-slate-400">{isArabic ? k.labelAr : k.labelEn}</p>
                  <p className="mt-1 font-display text-2xl font-bold tracking-tight text-slate-950">{k.value}</p>
                  <p className={`mt-1 text-xs font-bold ${k.up ? 'text-emerald-600' : 'text-amber-600'}`}>{k.trend}</p>
                </motion.div>
              ))}
            </div>

            <motion.div
              initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              className="rounded-[1.75rem] border border-slate-200/80 bg-white p-6 shadow-sm lg:col-span-7"
            >
              <p className="mb-5 text-[11px] font-bold uppercase tracking-widest text-slate-400">{isArabic ? 'توزيع الإيرادات' : 'Revenue mix'}</p>
              <div className="space-y-4">
                {[
                  { nameEn: 'Retail / POS', nameAr: 'التجزئة / نقطة البيع', pct: 38, color: '#059669' },
                  { nameEn: 'Services', nameAr: 'الخدمات', pct: 27, color: '#14b8a6' },
                  { nameEn: 'eCommerce', nameAr: 'التجارة الإلكترونية', pct: 21, color: '#f59e0b' },
                  { nameEn: 'Other', nameAr: 'أخرى', pct: 14, color: '#0ea5e9' },
                ].map((row) => (
                  <div key={row.nameEn}>
                    <div className="mb-1.5 flex justify-between text-sm">
                      <span className="font-semibold text-slate-700">{isArabic ? row.nameAr : row.nameEn}</span>
                      <span className="font-bold text-slate-950">{row.pct}%</span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full" style={{ width: `${row.pct}%`, background: row.color }} />
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              className="rounded-[1.75rem] border border-emerald-200/70 bg-gradient-to-br from-emerald-50 to-teal-50/40 p-6 shadow-sm lg:col-span-5"
            >
              <p className="mb-4 flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-emerald-700">
                <ShieldCheck className="h-4 w-4" />
                {isArabic ? 'جاهزية الامتثال' : 'Compliance readiness'}
              </p>
              <div className="space-y-3">
                {['ZATCA Phase 2', 'NBR Bangladesh', 'VAT / Tax rules', 'WPS payroll files'].map((t) => (
                  <div key={t} className="flex items-center justify-between rounded-2xl border border-white/80 bg-white/80 px-4 py-3 shadow-sm">
                    <span className="text-sm font-semibold text-slate-700">{t}</span>
                    <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700">Live</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── STATS ── */}
      <section className="bg-white py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[
              { to: 500, suffix: '+', labelEn: 'Companies', labelAr: 'شركة' },
              { to: 50000, suffix: '+', labelEn: 'Daily invoices', labelAr: 'فاتورة يومياً' },
              { to: 99, suffix: '.9%', labelEn: 'Uptime', labelAr: 'وقت التشغيل' },
              { to: 24, suffix: '/7', labelEn: 'Support', labelAr: 'دعم متواصل' },
            ].map((s) => (
              <div key={s.labelEn} className="rounded-3xl border border-slate-200 bg-gradient-to-b from-white to-slate-50/50 p-6 text-center shadow-sm">
                <p className="font-display text-5xl font-bold tracking-tight text-slate-950"><Counter to={s.to} suffix={s.suffix} /></p>
                <p className="mt-2 text-sm font-semibold text-slate-500">{isArabic ? s.labelAr : s.labelEn}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── WHY CHOOSE — ICON MARQUEE ── */}
      <section className="overflow-hidden bg-slate-50 py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-12 text-center">
            <h2 className="font-display text-4xl font-bold tracking-[-0.02em] text-slate-950 sm:text-5xl">
              {isArabic ? 'لماذا تختار Maqder؟' : 'Why choose Maqder?'}
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg leading-relaxed text-slate-500">
              {isArabic
                ? 'كل ما تحتاجه لإدارة عملك — وحدات متكاملة تعمل معاً بسلاسة.'
                : 'Everything you need to run your business — integrated modules that work as one.'}
            </p>
          </div>
        </div>

        <Marquee duration={90} className="mb-5 [mask-image:linear-gradient(90deg,transparent,black_8%,black_92%,transparent)]">
          {PREMIUM_APP_CATALOG.map((app) => (
            <div key={`a-${app.id}`} className="flex w-[108px] shrink-0 flex-col items-center gap-2">
              <PremiumAppIcon name={app.id} size={72} />
              <span className="text-center text-[11px] font-semibold text-slate-600">{isArabic ? app.labelAr : app.labelEn}</span>
            </div>
          ))}
        </Marquee>
        <Marquee duration={110} reverse className="[mask-image:linear-gradient(90deg,transparent,black_8%,black_92%,transparent)]">
          {[...PREMIUM_APP_CATALOG].reverse().map((app) => (
            <div key={`b-${app.id}`} className="flex w-[108px] shrink-0 flex-col items-center gap-2">
              <PremiumAppIcon name={app.id} size={64} />
              <span className="text-center text-[11px] font-semibold text-slate-600">{isArabic ? app.labelAr : app.labelEn}</span>
            </div>
          ))}
        </Marquee>
      </section>

      {/* ── TESTIMONIALS MARQUEE ── */}
      <section className="overflow-hidden bg-gradient-to-b from-white via-[#f8faf9] to-slate-50 py-28">
        <div className="mx-auto mb-14 max-w-7xl px-4 text-center sm:px-6 lg:px-8">
          <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.32em] text-emerald-600">
            {isArabic ? 'قصص نجاح' : 'Customer stories'}
          </p>
          <h2 className="font-display text-4xl font-bold tracking-[-0.02em] text-slate-950 sm:text-5xl">
            {isArabic ? 'موثوق من أعمال نامية' : 'Trusted by growing businesses'}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg leading-relaxed text-slate-500">
            {isArabic ? 'شركات حقيقية تعتمد على Maqder يومياً لإدارة عملياتها.' : 'Real companies running their operations on Maqder every day.'}
          </p>
        </div>

        <Marquee duration={70} className="[mask-image:linear-gradient(90deg,transparent,black_6%,black_94%,transparent)]">
          {TESTIMONIALS.map((t, idx) => {
            const Icon = TENANT_STORY_ICONS[idx % TENANT_STORY_ICONS.length]
            return (
              <div
                key={t.companyEn}
                className="relative w-[380px] shrink-0 overflow-hidden rounded-[1.75rem] border border-slate-200/80 bg-white p-8 shadow-[0_18px_40px_-28px_rgba(15,23,42,0.35)]"
              >
                <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-20 blur-3xl" style={{ background: t.accent }} />
                <div className="relative mb-5 flex items-center justify-between">
                  <div className="flex items-center gap-0.5">
                    {[...Array(5)].map((_, j) => <Star key={j} className="h-4 w-4 fill-amber-400 text-amber-400" />)}
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100">
                    <Icon className="h-5 w-5" />
                  </div>
                </div>
                <p className="relative min-h-[96px] text-[15px] leading-relaxed text-slate-600">
                  "{isArabic ? t.contentAr : t.content}"
                </p>
                <div className="relative mt-7 flex items-center gap-3 border-t border-slate-100 pt-5">
                  <div
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-sm font-bold text-white shadow-lg"
                    style={{ background: `linear-gradient(135deg, ${t.accent}, ${t.accent}99)` }}
                  >
                    {(isArabic ? t.companyAr : t.companyEn).charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-display text-base font-bold text-slate-950">{isArabic ? t.companyAr : t.companyEn}</p>
                    <p className="text-xs font-semibold text-slate-400">{isArabic ? t.industryAr : t.industryEn}</p>
                  </div>
                </div>
              </div>
            )
          })}
        </Marquee>
      </section>

      {/* ── TRIAL POPOUT ── */}
      <AnimatePresence>
        {trialOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] flex items-end justify-center bg-[#06140f]/70 p-3 backdrop-blur-xl sm:items-center sm:p-6"
            onClick={() => setTrialOpen(false)}
          >
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-[0.06]"
              style={{
                backgroundImage: 'linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)',
                backgroundSize: '48px 48px',
              }}
            />
            <motion.div
              initial={{ opacity: 0, y: 40, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 320, damping: 28 }}
              className="relative flex w-full max-w-[980px] overflow-hidden rounded-[2rem] border border-white/20 bg-white shadow-[0_50px_140px_-24px_rgba(0,0,0,0.65)]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="relative hidden w-[38%] shrink-0 flex-col justify-between overflow-hidden bg-[#0b1f16] px-8 py-10 text-white lg:flex">
                <div aria-hidden className="pointer-events-none absolute -top-24 -left-16 h-64 w-64 rounded-full bg-emerald-500/30 blur-[90px]" />
                <div aria-hidden className="pointer-events-none absolute bottom-0 right-0 h-48 w-48 rounded-full bg-teal-400/20 blur-[80px]" />
                <div className="relative">
                  <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-emerald-300">
                    {isArabic ? 'تجربة مجانية' : 'Free trial'}
                  </p>
                  <h3 className="mt-5 font-display text-[1.85rem] font-bold leading-[1.15] tracking-[-0.03em]">
                    {isArabic ? 'مساحتك جاهزة في أقل من دقيقة' : 'Your workspace in under a minute'}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-white/55">
                    {isArabic
                      ? 'اختر الدولة والشركة والعملة — ثم ادخل لوحة التحكم مباشرة.'
                      : 'Pick country, company, and currency — then land in a live dashboard.'}
                  </p>
                </div>
                <ul className="relative mt-10 space-y-4 text-sm">
                  {[
                    isArabic ? 'سبعة أيام كاملة — كل التطبيقات' : '7 full days — every app included',
                    isArabic ? 'بلا بطاقة ائتمان' : 'No credit card required',
                    isArabic ? 'فواتير وعملاء وتقارير من أول دخول' : 'Invoices, customers, and reports from first login',
                  ].map((line) => (
                    <li key={line} className="flex items-start gap-3 text-white/80">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-400/20 text-emerald-300">
                        <Check className="h-3 w-3" strokeWidth={3} />
                      </span>
                      {line}
                    </li>
                  ))}
                </ul>
                <p className="relative mt-10 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/30">
                  Maqder · Live ERP
                </p>
              </div>

              <div className="relative min-w-0 flex-1 bg-gradient-to-b from-[#f7faf8] to-white">
                <button
                  type="button"
                  onClick={() => setTrialOpen(false)}
                  className="absolute right-4 top-4 z-10 rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>
                <div className="border-b border-slate-100 px-6 pb-4 pt-7 lg:hidden">
                  <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-emerald-600">
                    {isArabic ? 'تجربة مجانية' : 'Free trial'}
                  </p>
                  <h3 className="mt-1 font-display text-xl font-bold tracking-tight text-slate-950">
                    {isArabic ? 'مساحتك جاهزة في أقل من دقيقة' : 'Your workspace in under a minute'}
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

      {/* expose open for header "Try free" via custom event */}
      <TrialOpenBridge onOpen={() => setTrialOpen(true)} />
    </main>
  )
}

function TrialOpenBridge({ onOpen }) {
  useEffect(() => {
    const handler = () => onOpen()
    window.addEventListener('maqder-open-trial', handler)
    return () => window.removeEventListener('maqder-open-trial', handler)
  }, [onOpen])
  return null
}
