import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { motion, useInView } from 'framer-motion'
import { usePublicWebsiteSettings } from '../../lib/website'
import TrialSignup from '../../components/marketing/TrialSignup'
import {
  ArrowRight,
  BarChart3,
  Bell,
  BookOpen,
  Box,
  Briefcase,
  Calculator,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  CreditCard,
  FileText,
  Headphones,
  Layers,
  LineChart,
  MessageCircle,
  Package,
  PieChart,
  Receipt,
  Settings2,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Star,
  Truck,
  Users,
  Warehouse,
  Zap,
} from 'lucide-react'

/* ─── animated counter ──────────────────────────────────────────────── */
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

/* ─── stagger helpers ───────────────────────────────────────────────── */
const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.55, delay: i * 0.07, ease: [0.25, 0.46, 0.45, 0.94] } }),
}

/* ─── app modules grid data ─────────────────────────────────────────── */
const APPS = [
  { icon: FileText,     color: '#7c3aed', labelEn: 'Invoicing',     labelAr: 'الفوترة' },
  { icon: Users,        color: '#0891b2', labelEn: 'HR',             labelAr: 'الموارد البشرية' },
  { icon: Calculator,   color: '#059669', labelEn: 'Payroll',        labelAr: 'الرواتب' },
  { icon: Package,      color: '#dc2626', labelEn: 'Inventory',      labelAr: 'المخزون' },
  { icon: Warehouse,    color: '#d97706', labelEn: 'Warehouses',     labelAr: 'المستودعات' },
  { icon: Truck,        color: '#2563eb', labelEn: 'Purchases',      labelAr: 'المشتريات' },
  { icon: Receipt,      color: '#7c3aed', labelEn: 'Expenses',       labelAr: 'المصروفات' },
  { icon: ClipboardList,color: '#0891b2', labelEn: 'Projects',       labelAr: 'المشاريع' },
  { icon: BarChart3,    color: '#059669', labelEn: 'Reports',        labelAr: 'التقارير' },
  { icon: MessageCircle,color: '#dc2626', labelEn: 'WhatsApp',       labelAr: 'واتساب' },
  { icon: ShoppingCart, color: '#d97706', labelEn: 'eCommerce',      labelAr: 'التجارة الإلكترونية' },
  { icon: ShieldCheck,  color: '#2563eb', labelEn: 'Compliance',     labelAr: 'الامتثال' },
  { icon: CreditCard,   color: '#7c3aed', labelEn: 'Payments',       labelAr: 'المدفوعات' },
  { icon: LineChart,    color: '#0891b2', labelEn: 'Analytics',      labelAr: 'التحليلات' },
  { icon: BookOpen,     color: '#059669', labelEn: 'Accounting',     labelAr: 'المحاسبة' },
  { icon: Headphones,   color: '#dc2626', labelEn: 'Support',        labelAr: 'الدعم' },
  { icon: Settings2,    color: '#d97706', labelEn: 'Settings',       labelAr: 'الإعدادات' },
  { icon: Layers,       color: '#2563eb', labelEn: 'Integrations',   labelAr: 'التكاملات' },
]

/* ─── feature highlights ────────────────────────────────────────────── */
const FEATURES = [
  {
    icon: ShieldCheck,
    accent: '#059669',
    titleEn: 'Automatic Compliance',
    titleAr: 'امتثال تلقائي',
    descEn: 'Country-specific tax rules, e-invoicing standards, and government portals handled seamlessly.',
    descAr: 'قواعد الضرائب حسب الدولة والفوترة الإلكترونية والبوابات الحكومية تُعالَج بسلاسة.',
  },
  {
    icon: Zap,
    accent: '#7c3aed',
    titleEn: 'Instant Deployment',
    titleAr: 'نشر فوري',
    descEn: 'Your cloud workspace is ready in under a minute. No installation, no complexity.',
    descAr: 'مساحة عملك السحابية جاهزة في أقل من دقيقة. بدون تثبيت أو تعقيد.',
  },
  {
    icon: LineChart,
    accent: '#0891b2',
    titleEn: 'Real-time Insights',
    titleAr: 'رؤى فورية',
    descEn: 'Revenue, cash flow, inventory, and HR dashboards update live as your business moves.',
    descAr: 'لوحات الإيرادات والتدفق النقدي والمخزون تتحدث لحظة بلحظة.',
  },
  {
    icon: Users,
    accent: '#d97706',
    titleEn: 'Built for Teams',
    titleAr: 'مبني للفرق',
    descEn: 'Role-based access, multi-user collaboration, and audit trails out of the box.',
    descAr: 'صلاحيات حسب الدور وتعاون متعدد المستخدمين وسجلات مراجعة جاهزة.',
  },
]

const STATS = [
  { to: 500, suffix: '+', labelEn: 'Companies', labelAr: 'شركة' },
  { to: 50000, suffix: '+', labelEn: 'Daily invoices', labelAr: 'فاتورة يومياً' },
  { to: 99, suffix: '.9%', labelEn: 'Uptime', labelAr: 'وقت التشغيل' },
  { to: 24, suffix: '/7', labelEn: 'Support', labelAr: 'دعم متواصل' },
]

const TESTIMONIALS = [
  { name: 'Ahmed Al-Rashid', nameAr: 'أحمد الراشد', role: 'CFO, Tech Solutions', roleAr: 'المدير المالي', content: 'Month-end close is faster and cleaner. Finance, inventory, and reporting finally live in one place.', contentAr: 'إقفال الشهر أسرع وأنظف. المالية والمخزون والتقارير في مكان واحد.' },
  { name: 'Sara Mohammed', nameAr: 'سارة محمد', role: 'HR Director', roleAr: 'مديرة الموارد البشرية', content: 'Payroll and leave that used to take hours now run in minutes. The team finally focuses on people.', contentAr: 'الرواتب والإجازات أصبحت تعمل في دقائق. الفريق يركز على الناس الآن.' },
  { name: 'Khalid Hassan', nameAr: 'خالد حسن', role: 'Operations Manager', roleAr: 'مدير العمليات', content: 'Multi-warehouse tracking with real-time alerts changed how we operate at scale.', contentAr: 'تتبع المستودعات المتعددة غيّر طريقة عملنا.' },
]

/* ═══════════════════════════════════════════════════════════════════════
   PAGE COMPONENT
═══════════════════════════════════════════════════════════════════════ */
export default function MarketingHome() {
  const { language } = useSelector((s) => s.ui)
  const { data } = usePublicWebsiteSettings()
  const isArabic = language === 'ar'
  const dir = isArabic ? 'rtl' : 'ltr'
  const phone = data?.contactPhone || '+966596775485'

  return (
    <main dir={dir} className="bg-white text-slate-900 antialiased overflow-x-hidden font-sans">

      {/* ══════════════════════════════════════════════════════
          HERO
      ══════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden bg-white">
        {/* Very subtle warm grid */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage: 'linear-gradient(#000 1px,transparent 1px),linear-gradient(90deg,#000 1px,transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />

        {/* Accent glows */}
        <div className="pointer-events-none absolute -top-40 -right-40 h-[600px] w-[600px] rounded-full bg-violet-500/10 blur-[120px]" />
        <div className="pointer-events-none absolute top-60 -left-20 h-[400px] w-[400px] rounded-full bg-emerald-400/10 blur-[90px]" />

        <div className="relative mx-auto max-w-7xl px-4 pt-20 pb-8 sm:px-6 lg:px-8 lg:pt-28 lg:pb-12">

          {/* ── BADGE ── */}
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
            className="mb-6 flex justify-center"
          >
            <span className="inline-flex items-center gap-2 rounded-full border border-violet-200/70 bg-violet-50 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-violet-700">
              <span className="flex h-1.5 w-1.5 rounded-full bg-violet-500" />
              {isArabic ? 'نظام ERP سحابي متكامل' : 'All-in-one cloud ERP platform'}
            </span>
          </motion.div>

          {/* ── HEADLINE ── */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.65, delay: 0.08 }}
            className="mx-auto max-w-5xl text-center text-[2.6rem] font-extrabold leading-[1.08] tracking-[-0.03em] text-slate-950 sm:text-5xl lg:text-7xl"
            style={{ fontVariantLigatures: 'common-ligatures' }}
          >
            {isArabic ? (
              <>كل أعمالك على<br /><span className="relative inline-block">
                <span className="relative z-10 text-violet-600">منصة واحدة.</span>
                <span className="absolute inset-x-0 bottom-1 h-[0.22em] rounded-full bg-violet-200/60 z-0" />
              </span><br />بسيطة، فعّالة، بأسعار مناسبة.</>
            ) : (
              <>All your business on<br />
                <span className="relative inline-block">
                  <span className="relative z-10 text-violet-600">one platform.</span>
                  <span className="absolute inset-x-0 bottom-1 h-[0.22em] rounded-full bg-violet-200/60 z-0" />
                </span><br />
                <em className="font-extrabold not-italic text-slate-700">Simple, efficient, yet affordable!</em>
              </>
            )}
          </motion.h1>

          {/* ── Price hint ── */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.25, duration: 0.5 }}
            className={`mt-5 flex justify-center ${isArabic ? '' : ''}`}
          >
            <div className="relative flex items-center gap-2">
              <svg viewBox="0 0 48 36" className="h-7 w-7 text-slate-500 -mr-1 mt-1" fill="none">
                <path d="M4 28 C14 10, 34 10, 44 28" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
                <path d="M40 32 L44 28 L46 34" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
              </svg>
              <span className="font-handwriting text-base font-bold text-slate-600 italic">
                {isArabic ? 'من 29.99 دولار / شهرياً لجميع التطبيقات' : 'US$ 29.99 / month for ALL apps'}
              </span>
            </div>
          </motion.div>

          {/* ── CTAs ── */}
          <motion.div
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35, duration: 0.55 }}
            className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row"
          >
            <a
              href="#trial"
              onClick={(e) => { e.preventDefault(); document.getElementById('trial')?.scrollIntoView({ behavior: 'smooth' }) }}
              className="group inline-flex items-center gap-2.5 rounded-full bg-violet-600 px-8 py-4 text-base font-bold text-white shadow-[0_8px_32px_-8px_rgba(124,58,237,0.55)] transition-all hover:-translate-y-0.5 hover:bg-violet-700 hover:shadow-[0_12px_40px_-8px_rgba(124,58,237,0.65)]"
            >
              {isArabic ? 'ابدأ الآن — مجاناً' : 'Start now — It\'s free'}
              <ArrowRight className={`h-5 w-5 transition-transform group-hover:translate-x-0.5 ${isArabic ? 'rotate-180 group-hover:-translate-x-0.5 group-hover:translate-x-0' : ''}`} />
            </a>
            <Link
              to="/pricing"
              className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-8 py-4 text-base font-bold text-slate-700 shadow-sm transition-all hover:border-slate-400 hover:bg-slate-50"
            >
              {isArabic ? 'تعرف على المزيد' : 'Meet an advisor'}
            </Link>
          </motion.div>

          {/* ── Rating ── */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
            className="mt-6 flex items-center justify-center gap-3 text-sm text-slate-500"
          >
            <div className="flex items-center gap-0.5">
              {[...Array(5)].map((_, j) => <Star key={j} className="h-4 w-4 fill-amber-400 text-amber-400" />)}
            </div>
            <span>{isArabic ? '٤.٩/٥ · أكثر من ٥٠٠ شركة' : '4.9 / 5 · 500+ companies'}</span>
          </motion.div>
        </div>

        {/* ── APP GRID ── */}
        <div className="relative mx-auto max-w-6xl px-4 pb-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 32 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45, duration: 0.7 }}
            className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-9"
          >
            {APPS.map((app, i) => (
              <motion.div
                key={i}
                custom={i}
                variants={fadeUp}
                initial="hidden"
                animate="show"
                whileHover={{ y: -4, scale: 1.06 }}
                transition={{ type: 'spring', stiffness: 300 }}
                className="flex flex-col items-center gap-2 cursor-default select-none"
              >
                <div
                  className="flex h-14 w-14 items-center justify-center rounded-2xl shadow-[0_4px_18px_-4px_rgba(0,0,0,0.18)] ring-1 ring-black/[0.04]"
                  style={{ background: `${app.color}18` }}
                >
                  <app.icon className="h-7 w-7" style={{ color: app.color }} />
                </div>
                <span className="text-center text-[11px] font-semibold leading-tight text-slate-600">
                  {isArabic ? app.labelAr : app.labelEn}
                </span>
              </motion.div>
            ))}
          </motion.div>

          {/* "View all apps" */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}
            className="mt-6 flex items-center justify-between border-t border-slate-100 pt-5"
          >
            <p className="text-sm text-slate-500 italic">
              {isArabic ? 'تخيّل عملك بدون Maqder' : 'Imagine without Maqder'}
            </p>
            <a
              href="#modules"
              onClick={(e) => { e.preventDefault(); document.getElementById('modules')?.scrollIntoView({ behavior: 'smooth' }) }}
              className="inline-flex items-center gap-1.5 text-sm font-bold text-violet-600 hover:text-violet-700"
            >
              {isArabic ? 'عرض كل التطبيقات' : 'View all Apps'}
              <ArrowRight className={`h-4 w-4 ${isArabic ? 'rotate-180' : ''}`} />
            </a>
          </motion.div>
        </div>

        {/* gradient fade into next section */}
        <div className="pointer-events-none h-20 bg-gradient-to-b from-white to-slate-50" />
      </section>

      {/* ══════════════════════════════════════════════════════
          OPTIMIZED FOR PRODUCTIVITY — DARK IMMERSIVE
      ══════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden bg-slate-950 py-28 text-white">
        <div className="pointer-events-none absolute inset-0 opacity-20"
          style={{ backgroundImage: 'radial-gradient(circle at 30% 50%, #7c3aed22 0%, transparent 60%), radial-gradient(circle at 75% 20%, #05966920 0%, transparent 50%)' }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.4) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.4) 1px,transparent 1px)', backgroundSize: '64px 64px' }}
        />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-16 text-center">
            <p className="mb-4 text-xs font-bold uppercase tracking-[0.28em] text-violet-400">
              {isArabic ? 'مُحسَّن للإنتاجية' : 'Optimized for productivity'}
            </p>
            <h2 className="text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
              {isArabic ? 'واجهة احترافية، نتائج حقيقية' : 'Professional interface,\nreal results.'}
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-lg text-white/50">
              {isArabic
                ? 'من أول فاتورة إلى تقرير الأرباح السنوي — النظام يعمل أثناء نموك.'
                : 'From your first invoice to your annual P&L — the system works while your business grows.'}
            </p>
          </div>

          {/* Dashboard mockup cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {/* big card — KPI */}
            <motion.div
              variants={fadeUp} custom={0} initial="hidden" whileInView="show" viewport={{ once: true }}
              className="col-span-1 rounded-3xl border border-white/[0.07] bg-white/[0.03] p-6 md:col-span-2 lg:col-span-2"
            >
              <p className="mb-5 text-xs font-bold uppercase tracking-widest text-white/40">{isArabic ? 'لوحة التحكم' : 'Live Dashboard'}</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { label: isArabic ? 'الإيراد اليوم' : 'Revenue today', value: '$284K', trend: '+18%', up: true },
                  { label: isArabic ? 'الفواتير' : 'Invoices', value: '1,240', trend: '+24%', up: true },
                  { label: isArabic ? 'الموظفون' : 'Employees', value: '142', trend: '+3', up: true },
                  { label: isArabic ? 'نفاد المخزون' : 'Low stock', value: '12', trend: '⚠ check', up: false },
                ].map((m, i) => (
                  <div key={i} className="rounded-2xl border border-white/[0.06] bg-white/[0.04] p-4">
                    <p className="text-[11px] text-white/35">{m.label}</p>
                    <p className="mt-2 text-2xl font-black text-white">{m.value}</p>
                    <p className={`mt-1 text-xs font-bold ${m.up ? 'text-emerald-400' : 'text-amber-400'}`}>{m.trend}</p>
                  </div>
                ))}
              </div>
              {/* mini bar chart */}
              <div className="mt-5 flex items-end gap-1.5 h-16">
                {[40, 65, 52, 80, 70, 90, 75, 88, 60, 95, 72, 100].map((h, i) => (
                  <div key={i} className="flex-1 rounded-t-sm bg-violet-500/30 transition-all hover:bg-violet-500/60" style={{ height: `${h}%` }} />
                ))}
              </div>
            </motion.div>

            {/* compliance card */}
            <motion.div
              variants={fadeUp} custom={1} initial="hidden" whileInView="show" viewport={{ once: true }}
              className="rounded-3xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 to-teal-500/5 p-6"
            >
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/20">
                <ShieldCheck className="h-5 w-5 text-emerald-400" />
              </div>
              <h3 className="text-lg font-bold">{isArabic ? 'الامتثال الضريبي' : 'Tax Compliance'}</h3>
              <p className="mt-2 text-sm text-white/45">
                {isArabic ? 'متوافق مع المتطلبات الحكومية في كل دولة — بدون إعداد يدوي.' : 'Government-ready for every supported country — zero manual setup.'}
              </p>
              <div className="mt-5 space-y-2">
                {['ZATCA Phase 2', 'NBR Bangladesh', 'VAT Compliance'].map((t) => (
                  <div key={t} className="flex items-center gap-2.5">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                    <span className="text-sm font-medium text-white/70">{t}</span>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* AI chat card */}
            <motion.div
              variants={fadeUp} custom={2} initial="hidden" whileInView="show" viewport={{ once: true }}
              className="rounded-3xl border border-violet-500/20 bg-gradient-to-br from-violet-500/10 to-purple-500/5 p-6"
            >
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-500/20">
                <Sparkles className="h-5 w-5 text-violet-400" />
              </div>
              <h3 className="text-lg font-bold">{isArabic ? 'ذكاء اصطناعي مدمج' : 'Built-in AI'}</h3>
              <div className="mt-4 space-y-2.5">
                <div className="rounded-xl bg-white/[0.06] px-3.5 py-2.5 text-sm text-white/70">
                  {isArabic ? 'ما هو أكثر منتج مبيعاً هذا الشهر؟' : "What's my best-selling product this month?"}
                </div>
                <div className="rounded-xl bg-violet-500/15 px-3.5 py-2.5 text-sm text-violet-200">
                  {isArabic ? 'المنتج: "ملف الألومنيوم A4" — 410 وحدة مُباعة، إجمالي $2,829.' : '"Aluminium File A4" — 410 units sold, total $2,829.'}
                </div>
              </div>
            </motion.div>

            {/* HR card */}
            <motion.div
              variants={fadeUp} custom={3} initial="hidden" whileInView="show" viewport={{ once: true }}
              className="rounded-3xl border border-blue-500/20 bg-gradient-to-br from-blue-500/10 to-indigo-500/5 p-6"
            >
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-500/20">
                <Users className="h-5 w-5 text-blue-400" />
              </div>
              <h3 className="text-lg font-bold">{isArabic ? 'الموارد البشرية' : 'HR & Payroll'}</h3>
              <p className="mt-2 text-sm text-white/45">
                {isArabic ? 'الرواتب وملفات WPS والإجازات والوثائق في مكان واحد.' : 'Payroll, WPS files, leave, and documents all in one place.'}
              </p>
              <div className="mt-5 flex -space-x-2">
                {['A','S','K','R','M','H'].map((c,i) => (
                  <div key={i} className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-slate-950 bg-gradient-to-br from-blue-500 to-indigo-600 text-[11px] font-bold text-white">
                    {c}
                  </div>
                ))}
                <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-slate-950 bg-white/10 text-[10px] font-bold text-white/60">+136</div>
              </div>
            </motion.div>

            {/* notifications / activity */}
            <motion.div
              variants={fadeUp} custom={4} initial="hidden" whileInView="show" viewport={{ once: true }}
              className="rounded-3xl border border-amber-500/20 bg-gradient-to-br from-amber-500/10 to-orange-500/5 p-6"
            >
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/20">
                <Bell className="h-5 w-5 text-amber-400" />
              </div>
              <h3 className="text-lg font-bold">{isArabic ? 'تنبيهات ذكية' : 'Smart Alerts'}</h3>
              <div className="mt-4 space-y-2">
                {[
                  { t: isArabic ? 'مخزون منخفض: قاطع A4' : 'Low stock: Cutter A4', c: 'text-amber-300' },
                  { t: isArabic ? 'فاتورة جديدة: عميل XYZ' : 'New invoice: Client XYZ', c: 'text-emerald-300' },
                  { t: isArabic ? 'موافقة إجازة معلقة' : 'Leave approval pending', c: 'text-blue-300' },
                ].map((n, i) => (
                  <div key={i} className="flex items-center gap-2.5 rounded-xl bg-white/[0.05] px-3 py-2 text-sm">
                    <div className={`h-2 w-2 shrink-0 rounded-full ${n.c === 'text-amber-300' ? 'bg-amber-400' : n.c === 'text-emerald-300' ? 'bg-emerald-400' : 'bg-blue-400'}`} />
                    <span className={`font-medium ${n.c}`}>{n.t}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          STATS
      ══════════════════════════════════════════════════════ */}
      <section className="bg-white py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {STATS.map((s, i) => (
              <motion.div
                key={i} custom={i} variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }}
                className="group rounded-3xl border border-slate-200 bg-gradient-to-b from-white to-slate-50/50 p-6 text-center shadow-sm hover:-translate-y-1 hover:border-violet-300 hover:shadow-xl hover:shadow-violet-100/50 transition-all duration-300"
              >
                <p className="text-5xl font-black tracking-tight text-slate-950">
                  <Counter to={s.to} suffix={s.suffix} />
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-500">{isArabic ? s.labelAr : s.labelEn}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          MODULES GRID (id=modules)
      ══════════════════════════════════════════════════════ */}
      <section id="modules" className="scroll-mt-20 bg-slate-50/80 py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-16 text-center">
            <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-violet-700">
              <Layers className="h-3.5 w-3.5" />
              {isArabic ? 'وحدات ERP متكاملة' : 'Integrated ERP modules'}
            </span>
            <h2 className="text-4xl font-extrabold tracking-tight text-slate-950 sm:text-5xl">
              {isArabic ? 'كل أدوات عملك في مكان واحد' : 'Every tool your business needs'}
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-slate-500">
              {isArabic
                ? 'من الفوترة إلى الرواتب والمخزون — بنية واحدة مصممة للأعمال الحديثة.'
                : 'From invoicing to payroll and inventory — one seamless architecture.'}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {APPS.map((app, idx) => (
              <motion.div
                key={idx}
                custom={idx % 4}
                variants={fadeUp}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true, margin: '-40px' }}
                className="group relative flex items-start gap-4 overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:border-violet-300/60 hover:shadow-xl hover:shadow-violet-100/60"
              >
                <div
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ring-1 ring-black/[0.04] transition-all duration-300 group-hover:scale-110"
                  style={{ background: `${app.color}18` }}
                >
                  <app.icon className="h-5 w-5" style={{ color: app.color }} />
                </div>
                <div>
                  <p className="font-bold text-slate-900">{isArabic ? app.labelAr : app.labelEn}</p>
                  <div className={`mt-1.5 flex items-center gap-1 text-xs font-semibold text-violet-600 opacity-0 transition-all duration-200 group-hover:opacity-100 ${isArabic ? 'group-hover:-translate-x-0.5' : 'group-hover:translate-x-0.5'}`}>
                    {isArabic ? 'استكشف' : 'Explore'}
                    <ChevronRight className={`h-3 w-3 ${isArabic ? 'rotate-180' : ''}`} />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          FEATURE HIGHLIGHTS
      ══════════════════════════════════════════════════════ */}
      <section className="bg-white py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-16 text-center">
            <h2 className="text-4xl font-extrabold tracking-tight text-slate-950 sm:text-5xl">
              {isArabic ? 'لماذا تختار Maqder؟' : 'Why choose Maqder?'}
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-slate-500">
              {isArabic ? 'مبني من الأساس للشركات الحديثة.' : 'Built from the ground up for modern businesses.'}
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f, i) => (
              <motion.div
                key={i} custom={i} variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }}
                className="group rounded-3xl border border-slate-200 bg-white p-7 shadow-sm transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl"
                style={{ '--accent': f.accent }}
              >
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: `${f.accent}18` }}>
                  <f.icon className="h-6 w-6" style={{ color: f.accent }} />
                </div>
                <h3 className="text-lg font-bold text-slate-900">{isArabic ? f.titleAr : f.titleEn}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-500">{isArabic ? f.descAr : f.descEn}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          TESTIMONIALS
      ══════════════════════════════════════════════════════ */}
      <section className="bg-slate-950 py-28 text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-14 text-center">
            <h2 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
              {isArabic ? 'ماذا يقول عملاؤنا' : 'Trusted by growing businesses'}
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-white/45">
              {isArabic ? 'آراء حقيقية من شركات تعمل مع Maqder يومياً.' : 'Real feedback from companies that run on Maqder every day.'}
            </p>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {TESTIMONIALS.map((t, i) => (
              <motion.div
                key={i} custom={i} variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }}
                className="flex flex-col rounded-3xl border border-white/[0.07] bg-white/[0.03] p-7 backdrop-blur-sm"
              >
                <div className="mb-5 flex gap-0.5">
                  {[...Array(5)].map((_, j) => <Star key={j} className="h-4 w-4 fill-amber-400 text-amber-400" />)}
                </div>
                <p className="flex-1 text-base leading-relaxed text-white/65">
                  "{isArabic ? t.contentAr : t.content}"
                </p>
                <div className="mt-7 flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-sm font-bold text-white">
                    {(isArabic ? t.nameAr : t.name).charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">{isArabic ? t.nameAr : t.name}</p>
                    <p className="text-xs text-white/40">{isArabic ? t.roleAr : t.role}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          LIVE TRIAL SIGNUP
      ══════════════════════════════════════════════════════ */}
      <section id="trial" className="scroll-mt-20 bg-white py-28">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="mb-10 text-center">
            <span className="mb-4 inline-block text-xs font-bold uppercase tracking-[0.28em] text-violet-500">
              {isArabic ? 'تجربة مجانية' : 'Live trial'}
            </span>
            <h2 className="text-4xl font-extrabold tracking-tight text-slate-950 sm:text-5xl">
              {isArabic ? 'جرّب Maqder في أقل من دقيقة' : 'Spin up Maqder in under a minute'}
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-slate-500">
              {isArabic
                ? 'اختر الدولة واسم الشركة والعملة — ثم ادخل لوحة التحكم مباشرةً.'
                : 'Choose country, company name, and currency — then land in your live dashboard.'}
            </p>
          </div>
          <TrialSignup variant="premium" />
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          CTA BANNER
      ══════════════════════════════════════════════════════ */}
      <section className="pb-24 pt-0">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-violet-600 via-violet-700 to-indigo-800 p-10 text-white shadow-[0_40px_100px_-30px_rgba(124,58,237,0.4)] lg:p-16">
            <div className="pointer-events-none absolute -top-24 -right-24 h-80 w-80 rounded-full bg-white/10 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-16 -left-16 h-60 w-60 rounded-full bg-white/10 blur-2xl" />
            <div className="relative flex flex-col items-start gap-8 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-2xl">
                <p className="text-xs font-bold uppercase tracking-[0.32em] text-white/60">
                  {isArabic ? 'جاهز للانطلاق' : 'Ready to launch'}
                </p>
                <h2 className="mt-3 text-4xl font-extrabold leading-tight lg:text-5xl">
                  {isArabic ? (
                    'ابدأ رحلتك مع Maqder اليوم'
                  ) : (
                    <>Start your ERP<br /><span className="text-white/80">journey today.</span></>
                  )}
                </h2>
                <p className="mt-4 text-lg text-white/60">
                  {isArabic
                    ? 'سجّل الدخول أو جرّب النظام مباشرةً.'
                    : 'Log in or start a free trial and see modern business management.'}
                </p>
              </div>
              <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
                <a
                  href="#trial"
                  onClick={(e) => { e.preventDefault(); document.getElementById('trial')?.scrollIntoView({ behavior: 'smooth' }) }}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-8 py-4 text-base font-bold text-violet-700 shadow-lg transition-all hover:-translate-y-0.5 hover:shadow-xl"
                >
                  {isArabic ? 'ابدأ الآن مجاناً' : 'Start for free'}
                  <ArrowRight className={`h-5 w-5 ${isArabic ? 'rotate-180' : ''}`} />
                </a>
                <Link
                  to="/pricing"
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-white/30 bg-white/10 px-8 py-4 text-base font-bold text-white backdrop-blur-sm transition-all hover:bg-white/20"
                >
                  {isArabic ? 'الأسعار' : 'View pricing'}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

    </main>
  )
}
