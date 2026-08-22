import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'
import { useSelector } from 'react-redux'
import {
  ArrowRight,
  BarChart3,
  Bell,
  BookOpen,
  Box,
  Calculator,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  CreditCard,
  FileText,
  Globe,
  Headphones,
  Layers,
  LineChart,
  MessageCircle,
  Package,
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
  Building2,
  UtensilsCrossed,
  Scissors,
  Smartphone,
  Search,
  Check,
  X,
} from 'lucide-react'
import { HighlightText } from '../../components/ui/highlight-text'
import TrialSignup from '../../components/marketing/TrialSignup'

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay: i * 0.05, ease: [0.25, 0.46, 0.45, 0.94] },
  }),
}

/* ─── Module categories ─────────────────────────────────────────────── */
const CATEGORIES = [
  { id: 'all', labelEn: 'All Modules', labelAr: 'كافة الوحدات' },
  { id: 'finance', labelEn: 'Finance & Tax', labelAr: 'المالية والضرائب' },
  { id: 'hr', labelEn: 'HR & Workforce', labelAr: 'الموارد البشرية' },
  { id: 'ops', labelEn: 'Operations & Stock', labelAr: 'العمليات والمخزون' },
  { id: 'sales', labelEn: 'Sales & POS', labelAr: 'المبيعات ونقاط البيع' },
  { id: 'tech', labelEn: 'Platform & AI', labelAr: 'المنصة والذكاء' },
]

const MODULES = [
  // Finance
  {
    id: 'invoicing',
    cat: 'finance',
    icon: FileText,
    color: '#059669',
    bgColor: '#05966918',
    titleEn: 'E-Invoicing & ZATCA Phase 2',
    titleAr: 'الفوترة الإلكترونية وZATCA',
    descEn: 'B2B/B2C simplified invoices, QR codes, XML cryptographic signing and direct tax integration.',
    descAr: 'فواتير B2B/B2C وأكواد QR وتوقيع XML وإرسال فوري لهيئات الضرائب.',
    badgeEn: 'ZATCA Phase 2',
    badgeAr: 'جاهز لـ ZATCA',
  },
  {
    id: 'accounting',
    cat: 'finance',
    icon: BookOpen,
    color: '#0891b2',
    bgColor: '#0891b218',
    titleEn: 'Accounting & General Ledger',
    titleAr: 'المحاسبة ودفتر الأستاذ',
    descEn: 'Chart of accounts, automated journal entries, trial balance and real-time financial statements.',
    descAr: 'دليل الحسابات والقيود اليومية وميزان المراجعة والقوائم المالية.',
  },
  {
    id: 'expenses',
    cat: 'finance',
    icon: Receipt,
    color: '#dc2626',
    bgColor: '#dc262618',
    titleEn: 'Expenses & Petty Cash',
    titleAr: 'المصروفات والعهدة النقدية',
    descEn: 'Expense receipt scanning, multi-tier approval workflows, cost centers, and spend analytics.',
    descAr: 'تتبع المصروفات وسير الموافقات والتصنيفات وتحليلات الإنفاق.',
  },
  {
    id: 'payments',
    cat: 'finance',
    icon: CreditCard,
    color: '#059669',
    bgColor: '#05966918',
    titleEn: 'Payment Gateways & POS Terminals',
    titleAr: 'المدفوعات وأجهزة الشبكة',
    descEn: 'Stripe, Mada, Moyasar and Tabby integrations for SaaS, ecommerce, and in-person card payments.',
    descAr: 'تكاملات Stripe وMoyasar وTabby لمدفوعات SaaS ونقاط البيع.',
  },
  // HR
  {
    id: 'hr',
    cat: 'hr',
    icon: Users,
    color: '#0891b2',
    bgColor: '#0891b218',
    titleEn: 'HR Management & Personnel',
    titleAr: 'إدارة الموارد البشرية',
    descEn: 'Digital employee profiles, leave requests, document expiries, and automated reminders.',
    descAr: 'ملفات الموظفين وإدارة الإجازات والمستندات والتنبيهات التلقائية.',
  },
  {
    id: 'payroll',
    cat: 'hr',
    icon: Calculator,
    color: '#d97706',
    bgColor: '#d9770618',
    titleEn: 'Payroll, WPS & GOSI',
    titleAr: 'الرواتب وملفات WPS والتأمينات',
    descEn: 'Automated payroll processing, Saudi GOSI rules, EOSB calculators, and bank-ready WPS files.',
    descAr: 'رواتب آلية وحسابات نهاية الخدمة وتوليد ملفات WPS.',
  },
  {
    id: 'attendance',
    cat: 'hr',
    icon: ClipboardList,
    color: '#059669',
    bgColor: '#05966918',
    titleEn: 'Attendance & Biometrics',
    titleAr: 'الحضور والمناوبات والبصمة',
    descEn: 'Shift scheduling, biometric device sync, geolocation check-in, and overtime tracking.',
    descAr: 'جدولة المناوبات ومزامنة البصمة وإدارة العمل الإضافي.',
  },
  // Operations
  {
    id: 'inventory',
    cat: 'ops',
    icon: Package,
    color: '#dc2626',
    bgColor: '#dc262618',
    titleEn: 'Inventory & Multi-Warehouse',
    titleAr: 'المخزون والمستودعات',
    descEn: 'Real-time multi-branch stock levels, SKU tracking, barcodes, batch expiries, and low-stock alerts.',
    descAr: 'مستويات المخزون متعدد المستودعات وSKU والباركود وتنبيهات النفاد.',
  },
  {
    id: 'warehouses',
    cat: 'ops',
    icon: Warehouse,
    color: '#d97706',
    bgColor: '#d9770618',
    titleEn: 'Warehouse & Bin Tracking',
    titleAr: 'إدارة المستودعات والحاويات',
    descEn: 'Bin locations, stock transfers, cycle counting, shelf management, and pick-pack dispatch.',
    descAr: 'مواقع الحاويات وتحويلات المخزون والجرد الدوري وإدارة الرفوف.',
  },
  {
    id: 'purchases',
    cat: 'ops',
    icon: Truck,
    color: '#2563eb',
    bgColor: '#2563eb18',
    titleEn: 'Purchasing, GRN & Landed Costs',
    titleAr: 'المشتريات والاستلام والتكاليف',
    descEn: 'Purchase orders, supplier ledgers, goods received notes, custom delays, and landed cost allocations.',
    descAr: 'أوامر الشراء وإدارة الموردين وسندات الاستلام وتكاليف الشحن والجمارك.',
  },
  {
    id: 'projects',
    cat: 'ops',
    icon: Box,
    color: '#7c3aed',
    bgColor: '#7c3aed18',
    titleEn: 'Projects & Job Costing',
    titleAr: 'المشاريع وتكاليف العمليات',
    descEn: 'Job cards, milestone tracking, resource costs, material consumption, and task budgeting.',
    descAr: 'بطاقات العمل وتتبع المراحل وتكاليف المواد والميزانيات.',
  },
  // Sales
  {
    id: 'pos',
    cat: 'sales',
    icon: ShoppingCart,
    color: '#059669',
    bgColor: '#05966918',
    titleEn: 'Cloud & Offline POS',
    titleAr: 'نقاط البيع السحابية وبدون إنترنت',
    descEn: 'Lightning-fast checkout, barcode scanning, discount rules, split payments, and thermal receipts.',
    descAr: 'نقطة بيع فائقة السرعة مع قراءة الباركود والخصومات وطباعة الإيصالات الحرارية.',
  },
  {
    id: 'crm',
    cat: 'sales',
    icon: MessageCircle,
    color: '#25d366',
    bgColor: '#25d36618',
    titleEn: 'CRM & Client Communications',
    titleAr: 'إدارة العملاء والمحادثات',
    descEn: 'Customer statements, WhatsApp invoices, automatic payment reminders, and quotation follow-ups.',
    descAr: 'كشوف حسابات العملاء وإرسال الفواتير عبر واتساب وتنبيهات الدفع.',
  },
  {
    id: 'ecommerce',
    cat: 'sales',
    icon: Globe,
    color: '#2563eb',
    bgColor: '#2563eb18',
    titleEn: 'Integrated Online Storefront',
    titleAr: 'المتجر الإلكتروني المتكامل',
    descEn: 'White-label online catalog, customer checkout, coupon codes, and live inventory sync.',
    descAr: 'متجر إلكتروني متكامل مع بوابات الدفع ومزامنة المخزون التلقائية.',
  },
  // Tech & AI
  {
    id: 'integrations',
    cat: 'tech',
    icon: Settings2,
    color: '#0891b2',
    bgColor: '#0891b218',
    titleEn: 'REST APIs & Webhooks',
    titleAr: 'واجهات API والتكاملات',
    descEn: 'Modern REST API, webhook subscriptions, ERP extensions, and delivery aggregator bridges.',
    descAr: 'واجهات API حديثة واشتراكات الويب هوك وتطبيقات الربط مع المنصات الخارجية.',
  },
  {
    id: 'ai',
    cat: 'tech',
    icon: Sparkles,
    color: '#d97706',
    bgColor: '#d9770618',
    titleEn: 'AI Intelligence & Forecasting',
    titleAr: 'المساعد الذكي والتوقعات',
    descEn: 'Natural language queries, revenue predictions, automated reorder recommendations, and anomaly detection.',
    descAr: 'استعلامات بلغة طبيعية وتوقعات الإيرادات والتنبؤ بالطلب وإعادة الطلب التلقائي.',
  },
]

/* ─── Industry verticals ─────────────────────────────────────────────── */
const VERTICALS = [
  {
    icon: Building2,
    color: '#059669',
    bgColor: '#05966918',
    titleEn: 'Wholesale & Distribution',
    titleAr: 'الجملة والتوزيع',
    descEn: 'Bulk orders, tiered price lists, credit limits, multi-warehouse routing, and ZATCA compliance.',
    descAr: 'الطلبات الكبيرة وقوائم الأسعار المتعددة وحدود الائتمان والفوترة الضريبية.',
  },
  {
    icon: UtensilsCrossed,
    color: '#dc2626',
    bgColor: '#dc262618',
    titleEn: 'Restaurants, Cafes & F&B',
    titleAr: 'المطاعم والمقاهي',
    descEn: 'Table layouts, visual KDS prep screens, delivery integrations, recipes, and cashier drawers.',
    descAr: 'إدارة الطاولات وشاشات المطبخ الذكية (KDS) ومنصات التوصيل وإيصالات الدفع.',
  },
  {
    icon: Scissors,
    color: '#0891b2',
    bgColor: '#0891b218',
    titleEn: 'Salons & Spas',
    titleAr: 'الصالونات ومراكز التجميل',
    descEn: 'Staff commission tracking, appointment calendars, service packages, and client loyalty.',
    descAr: 'حساب عمولات الموظفين وجداول المواعيد وباقات الخدمات وبرامج ولاء العملاء.',
  },
  {
    icon: ShoppingCart,
    color: '#059669',
    bgColor: '#05966918',
    titleEn: 'Retail & Supermarkets',
    titleAr: 'التجزئة والسوبرماركت',
    descEn: 'Touch POS, barcode label printing, fast return policies, and register shift balancing.',
    descAr: 'نقاط بيع سريعة مع قراءة الباركود والموازين وإدارة نوبات الكاشير.',
  },
  {
    icon: Users,
    color: '#d97706',
    bgColor: '#d9770618',
    titleEn: 'HR & Manpower Contracting',
    titleAr: 'الموارد البشرية والمقاولات',
    descEn: 'Workforce deployment, iqama/passport tracking, client billing, WPS files, and GOSI sync.',
    descAr: 'توزيع القوى العاملة ومتابعة الوثائق والإقامات وملفات حماية الأجور.',
  },
  {
    icon: Globe,
    color: '#2563eb',
    bgColor: '#2563eb18',
    titleEn: 'Boutiques & Fashion',
    titleAr: 'الأزياء والخياطة والفساتين',
    descEn: 'Custom tailoring measurements, rental booking calendars, alterations, and boutique POS.',
    descAr: 'مقاسات الخياطة المخصصة وجداول حجز وتأجير الفساتين ونقاط بيع الأزياء.',
  },
]

export default function MarketingSolutions() {
  const { language } = useSelector((s) => s.ui)
  const isArabic = false
  const dir = 'ltr'

  const [activeCategory, setActiveCategory] = useState('all')
  const [query, setQuery] = useState('')
  const [trialOpen, setTrialOpen] = useState(false)

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

  const filtered = MODULES.filter((m) => {
    const matchCat = activeCategory === 'all' || m.cat === activeCategory
    const q = query.toLowerCase()
    const matchQuery =
      !q ||
      m.titleEn.toLowerCase().includes(q) ||
      m.titleAr.includes(q) ||
      m.descEn.toLowerCase().includes(q)
    return matchCat && matchQuery
  })

  return (
    <main dir={dir} className="bg-white text-slate-900 antialiased overflow-x-hidden font-body">
      {/* ── HERO WITH COLORFUL HIGHLIGHT TEXT ── */}
      <section className="relative overflow-hidden bg-white pt-24 pb-16">
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
              <Layers className="h-3.5 w-3.5" />
              {isArabic ? 'التطبيقات والوحدات' : 'All-in-One Cloud Suite'}
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.65 }}
            className="mt-6 font-display text-4xl font-bold tracking-tight text-slate-950 sm:text-6xl lg:text-7xl leading-[1.12] text-balance max-w-4xl mx-auto"
          >
            {isArabic ? (
              <>منصة واحدة. <HighlightText variant="lime">كل ما تحتاجه</HighlightText></>
            ) : (
              <>One Platform. <HighlightText variant="lime">Everything you need</HighlightText></>
            )}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-500 sm:text-xl"
          >
            {isArabic
              ? '20+ وحدة متكاملة للمالية والموارد البشرية والمخزون والمبيعات والعمليات.'
              : '20+ integrated modules designed to feel effortless for every team across finance, HR, inventory, and operations.'}
          </motion.p>

          {/* Highlight Feature Banner */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="mt-8 mx-auto max-w-3xl flex items-center justify-center rounded-2xl border border-slate-200/90 bg-white/90 backdrop-blur-md px-6 py-4 shadow-sm"
          >
            <p className="text-center text-sm sm:text-base font-semibold text-slate-800">
              Explore modules built to <HighlightText variant="lime">automate</HighlightText>,{' '}
              <HighlightText variant="yellow">streamline</HighlightText>, and{' '}
              <HighlightText variant="pink">grow</HighlightText> your operations.
            </p>
          </motion.div>

          {/* Search bar */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mx-auto mt-8 max-w-md"
          >
            <div className="relative shadow-sm">
              <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={isArabic ? 'ابحث عن وحدة أو ميزة...' : 'Search modules or features...'}
                className="w-full rounded-full border border-slate-200 bg-white py-3.5 pl-12 pr-5 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all shadow-sm"
              />
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── MODULES GRID ── */}
      <section className="bg-slate-50/60 pb-28 pt-8 border-y border-slate-100">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* Category pills */}
          <div className="mb-10 flex flex-wrap gap-2 justify-center">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`rounded-full px-5 py-2.5 text-xs sm:text-sm font-bold transition-all ${
                  activeCategory === cat.id
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                    : 'border border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:text-emerald-700'
                }`}
              >
                {isArabic ? cat.labelAr : cat.labelEn}
              </button>
            ))}
          </div>

          {/* Grid */}
          <AnimatePresence mode="popLayout">
            <motion.div layout className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 items-stretch">
              {filtered.map((mod, idx) => (
                <motion.div
                  key={mod.id}
                  layout
                  custom={idx % 4}
                  variants={fadeUp}
                  initial="hidden"
                  animate="show"
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="group relative flex flex-col justify-between rounded-3xl border border-slate-200/90 bg-white p-7 shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:border-emerald-400/60 hover:shadow-xl hover:shadow-emerald-100/70"
                >
                  <div>
                    <div className="mb-5 flex items-start justify-between">
                      <div
                        className="flex h-13 w-13 items-center justify-center rounded-2xl ring-1 ring-black/[0.04] transition-transform duration-300 group-hover:scale-110"
                        style={{ background: mod.bgColor }}
                      >
                        <mod.icon className="h-6 w-6" style={{ color: mod.color }} />
                      </div>
                      {mod.badgeEn && (
                        <span
                          className="rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider shadow-sm"
                          style={{ background: mod.bgColor, color: mod.color }}
                        >
                          {isArabic ? mod.badgeAr : mod.badgeEn}
                        </span>
                      )}
                    </div>

                    <h3 className="text-base font-black text-slate-950 group-hover:text-emerald-700 transition">
                      {isArabic ? mod.titleAr : mod.titleEn}
                    </h3>
                    <p className="mt-2.5 text-xs sm:text-sm leading-relaxed text-slate-500">
                      {isArabic ? mod.descAr : mod.descEn}
                    </p>
                  </div>

                  <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400">Included in All Plans</span>
                    <div className="flex items-center gap-1 text-xs font-bold text-emerald-600 transition-all duration-200 group-hover:translate-x-1">
                      <span>Explore</span>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </AnimatePresence>

          {filtered.length === 0 && (
            <div className="py-20 text-center text-slate-400">
              <Search className="mx-auto mb-3 h-10 w-10 opacity-30" />
              <p className="text-lg font-semibold">{isArabic ? 'لا توجد نتائج' : 'No matching modules found'}</p>
              <p className="text-sm">{isArabic ? 'جرّب كلمة بحث مختلفة' : 'Try searching a different keyword'}</p>
            </div>
          )}
        </div>
      </section>

      {/* ── INDUSTRY VERTICALS WITH COLORFUL HIGHLIGHT TEXT ── */}
      <section className="bg-white py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-16 text-center">
            <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-emerald-700 shadow-sm">
              <Building2 className="h-3.5 w-3.5" />
              {isArabic ? 'حلول حسب النشاط' : 'Industry Blueprints'}
            </span>
            <h2 className="mt-4 font-display text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl">
              Solutions Built for <HighlightText variant="lime">Your Industry</HighlightText>
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-slate-500 leading-relaxed">
              Pre-configured workflows, compliance templates, and tailored interfaces for your exact business model.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 items-stretch">
            {VERTICALS.map((v, idx) => (
              <motion.div
                key={idx}
                custom={idx % 3}
                variants={fadeUp}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true }}
                className="group relative overflow-hidden rounded-3xl border border-slate-200/90 bg-white p-8 shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl hover:shadow-slate-200/80 hover:border-emerald-300"
              >
                <div
                  className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full blur-3xl transition-all duration-500 group-hover:scale-125"
                  style={{ background: v.bgColor }}
                />

                <div
                  className="relative mb-5 flex h-14 w-14 items-center justify-center rounded-2xl shadow-sm"
                  style={{ background: v.bgColor }}
                >
                  <v.icon className="h-7 w-7" style={{ color: v.color }} />
                </div>
                <h3 className="relative text-lg font-black text-slate-950 group-hover:text-emerald-700 transition">
                  {isArabic ? v.titleAr : v.titleEn}
                </h3>
                <p className="relative mt-2.5 text-sm leading-relaxed text-slate-500">
                  {isArabic ? v.descAr : v.descEn}
                </p>
                <div className="relative mt-6 flex items-center gap-1.5 text-xs font-bold text-emerald-600 transition-all duration-200 group-hover:translate-x-1">
                  <span>Learn how it works</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── DARK STATS STRIP WITH COLORFUL NUMBERS ── */}
      <section className="bg-slate-950 py-24 text-white relative overflow-hidden">
        <div className="pointer-events-none absolute -top-40 left-1/3 h-80 w-80 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative">
          <div className="grid grid-cols-2 gap-8 lg:grid-cols-4">
            {[
              { v: '20+', lEn: 'Integrated Modules', lAr: 'وحدة متكاملة' },
              { v: '500+', lEn: 'Companies on Maqder', lAr: 'شركة على Maqder' },
              { v: '15+', lEn: 'Countries & Currencies', lAr: 'دولة وعملة' },
              { v: '99.99%', lEn: 'Platform Uptime SLA', lAr: 'ضمان تشغيل المنصة' },
            ].map((s, i) => (
              <motion.div
                key={i}
                custom={i}
                variants={fadeUp}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true }}
                className="text-center"
              >
                <p className="text-5xl font-black tracking-tight text-white">{s.v}</p>
                <p className="mt-2 text-sm font-bold text-emerald-400/80">{isArabic ? s.lAr : s.lEn}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA BANNER WITH COLORFUL HIGHLIGHT TEXT ── */}
      <section className="bg-white pb-24 pt-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-950 p-10 text-white shadow-[0_40px_100px_-30px_rgba(5,150,105,0.4)] lg:p-16">
            <div className="pointer-events-none absolute -top-24 -right-24 h-80 w-80 rounded-full bg-white/10 blur-3xl" />
            <div className="relative flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-xl">
                <h2 className="text-3xl font-black lg:text-4xl">
                  {isArabic ? 'جاهز لتجربة Maqder؟' : 'Ready to explore all modules?'}
                </h2>
                <p className="mt-3 text-lg text-white/75 leading-relaxed">
                  Start your 7-day all-inclusive trial. Your workspace with all apps is live in under a minute.
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
                  to="/pricing"
                  className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-8 py-4 text-sm font-bold text-white transition-all hover:bg-white/20"
                >
                  {isArabic ? 'الأسعار' : 'View Pricing'}
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
