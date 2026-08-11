import { useState } from 'react'
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
} from 'lucide-react'

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.5, delay: i * 0.05, ease: [0.25, 0.46, 0.45, 0.94] },
  }),
}

/* ─── Module categories ─────────────────────────────────────────────── */
const CATEGORIES = [
  { id: 'all',      labelEn: 'All',         labelAr: 'الكل' },
  { id: 'finance',  labelEn: 'Finance',     labelAr: 'المالية' },
  { id: 'hr',       labelEn: 'HR',          labelAr: 'الموارد البشرية' },
  { id: 'ops',      labelEn: 'Operations',  labelAr: 'العمليات' },
  { id: 'sales',    labelEn: 'Sales',       labelAr: 'المبيعات' },
  { id: 'tech',     labelEn: 'Platform',    labelAr: 'المنصة' },
]

const MODULES = [
  // Finance
  {
    id: 'invoicing', cat: 'finance', icon: FileText, color: '#059669', bgColor: '#05966918',
    titleEn: 'E-Invoicing & Tax', titleAr: 'الفوترة الإلكترونية والضرائب',
    descEn: 'B2B/B2C invoices, QR codes, XML signing and real-time tax authority submission.',
    descAr: 'فواتير B2B/B2C وأكواد QR وتوقيع XML وإرسال فوري لهيئات الضرائب.',
    badgeEn: 'ZATCA Ready', badgeAr: 'جاهز لـ ZATCA',
  },
  {
    id: 'accounting', cat: 'finance', icon: BookOpen, color: '#0891b2', bgColor: '#0891b218',
    titleEn: 'Accounting & Ledger', titleAr: 'المحاسبة ودفتر الأستاذ',
    descEn: 'Chart of accounts, journal entries, trial balance and financial statements.',
    descAr: 'دليل الحسابات والقيود اليومية وميزان المراجعة والقوائم المالية.',
  },
  {
    id: 'expenses', cat: 'finance', icon: Receipt, color: '#dc2626', bgColor: '#dc262618',
    titleEn: 'Expenses & Finance', titleAr: 'المصروفات والمالية',
    descEn: 'Expense tracking, approval workflows, categories and spend analytics.',
    descAr: 'تتبع المصروفات وسير الموافقات والتصنيفات وتحليلات الإنفاق.',
  },
  {
    id: 'payments', cat: 'finance', icon: CreditCard, color: '#059669', bgColor: '#05966918',
    titleEn: 'Payments', titleAr: 'المدفوعات',
    descEn: 'Stripe, Moyasar and Tabby integrations for SaaS and POS payments.',
    descAr: 'تكاملات Stripe وMoyasar وTabby لمدفوعات SaaS ونقاط البيع.',
  },
  // HR
  {
    id: 'hr', cat: 'hr', icon: Users, color: '#0891b2', bgColor: '#0891b218',
    titleEn: 'HR Management', titleAr: 'إدارة الموارد البشرية',
    descEn: 'Employee profiles, leave management, documents and automated reminders.',
    descAr: 'ملفات الموظفين وإدارة الإجازات والمستندات والتنبيهات التلقائية.',
  },
  {
    id: 'payroll', cat: 'hr', icon: Calculator, color: '#d97706', bgColor: '#d9770618',
    titleEn: 'Payroll & WPS', titleAr: 'الرواتب وملفات WPS',
    descEn: 'Automated payroll, EOSB calculations and WPS file generation.',
    descAr: 'رواتب آلية وحسابات نهاية الخدمة وتوليد ملفات WPS.',
  },
  {
    id: 'attendance', cat: 'hr', icon: ClipboardList, color: '#059669', bgColor: '#05966918',
    titleEn: 'Attendance & Shifts', titleAr: 'الحضور والمناوبات',
    descEn: 'Shift scheduling, biometric sync and overtime management.',
    descAr: 'جدولة المناوبات ومزامنة البصمة وإدارة العمل الإضافي.',
  },
  // Operations
  {
    id: 'inventory', cat: 'ops', icon: Package, color: '#dc2626', bgColor: '#dc262618',
    titleEn: 'Inventory & Stock', titleAr: 'المخزون والمستودعات',
    descEn: 'Multi-warehouse stock levels, SKU, barcodes and low-stock alerts.',
    descAr: 'مستويات المخزون متعدد المستودعات وSKU والباركود وتنبيهات النفاد.',
  },
  {
    id: 'warehouses', cat: 'ops', icon: Warehouse, color: '#d97706', bgColor: '#d9770618',
    titleEn: 'Warehouse Management', titleAr: 'إدارة المستودعات',
    descEn: 'Bin locations, stock transfers, cycle counting and shelf management.',
    descAr: 'مواقع الحاويات وتحويلات المخزون والجرد الدوري وإدارة الرفوف.',
  },
  {
    id: 'purchases', cat: 'ops', icon: Truck, color: '#2563eb', bgColor: '#2563eb18',
    titleEn: 'Purchases & Receiving', titleAr: 'المشتريات والاستلام',
    descEn: 'Purchase orders, supplier management, GRN and landed costs.',
    descAr: 'أوامر الشراء وإدارة الموردين وسندات الاستلام والتكاليف المُهبَّطة.',
  },
  {
    id: 'projects', cat: 'ops', icon: ClipboardList, color: '#0891b2', bgColor: '#0891b218',
    titleEn: 'Projects & Tasks', titleAr: 'المشاريع والمهام',
    descEn: 'Project boards, task tracking, milestones and time logging.',
    descAr: 'لوحات المشاريع وتتبع المهام والمعالم وتسجيل الوقت.',
  },
  // Sales
  {
    id: 'pos', cat: 'sales', icon: ShoppingCart, color: '#059669', bgColor: '#05966918',
    titleEn: 'Point of Sale', titleAr: 'نقاط البيع',
    descEn: 'Touch POS for retail, restaurants and service businesses.',
    descAr: 'نقطة بيع لمس للتجزئة والمطاعم وشركات الخدمات.',
  },
  {
    id: 'ecommerce', cat: 'sales', icon: Globe, color: '#059669', bgColor: '#05966918',
    titleEn: 'eCommerce', titleAr: 'التجارة الإلكترونية',
    descEn: 'Online storefront, product catalog, orders and courier integrations.',
    descAr: 'متجر إلكتروني وكتالوج منتجات وطلبات وتكاملات شركات الشحن.',
  },
  {
    id: 'crm', cat: 'sales', icon: MessageCircle, color: '#dc2626', bgColor: '#dc262618',
    titleEn: 'CRM & Leads', titleAr: 'CRM والعملاء المحتملون',
    descEn: 'Contacts, deal pipelines, lead tracking and WhatsApp follow-ups.',
    descAr: 'جهات الاتصال وخطوط الصفقات وتتبع العملاء المحتملين والمتابعة عبر واتساب.',
  },
  {
    id: 'whatsapp', cat: 'sales', icon: MessageCircle, color: '#25d366', bgColor: '#25d36618',
    titleEn: 'WhatsApp & Notifications', titleAr: 'واتساب والإشعارات',
    descEn: 'Automated customer messages, invoice delivery and smart follow-ups.',
    descAr: 'رسائل عملاء آلية وتسليم فواتير ومتابعة ذكية.',
  },
  // Platform
  {
    id: 'analytics', cat: 'tech', icon: BarChart3, color: '#0891b2', bgColor: '#0891b218',
    titleEn: 'Reports & Analytics', titleAr: 'التقارير والتحليلات',
    descEn: 'Live KPI dashboards, P&L, revenue and HR analytics.',
    descAr: 'لوحات KPI المباشرة والأرباح والخسائر والإيرادات وتحليلات الموارد البشرية.',
  },
  {
    id: 'compliance', cat: 'tech', icon: ShieldCheck, color: '#2563eb', bgColor: '#2563eb18',
    titleEn: 'Compliance & Tax', titleAr: 'الامتثال والضرائب',
    descEn: 'Country-specific tax rules, ZATCA, NBR and government portal integrations.',
    descAr: 'قواعد ضريبية حسب الدولة وZATCA وNBR وتكاملات البوابات الحكومية.',
    badgeEn: 'ZATCA + NBR', badgeAr: 'ZATCA + NBR',
  },
  {
    id: 'integrations', cat: 'tech', icon: Layers, color: '#059669', bgColor: '#05966918',
    titleEn: 'Integrations', titleAr: 'التكاملات',
    descEn: 'API, webhooks, Zapier, Stripe, shipping providers and more.',
    descAr: 'API وwebhooks وZapier وStripe وشركات الشحن والمزيد.',
  },
  {
    id: 'ai', cat: 'tech', icon: Sparkles, color: '#d97706', bgColor: '#d9770618',
    titleEn: 'AI Assistant', titleAr: 'المساعد الذكي',
    descEn: 'Ask questions in plain language — get instant data, forecasts and alerts.',
    descAr: 'اسأل بلغة طبيعية واحصل على بيانات فورية وتوقعات وتنبيهات.',
  },
  {
    id: 'support', cat: 'tech', icon: Headphones, color: '#dc2626', bgColor: '#dc262618',
    titleEn: 'Support & SLA', titleAr: 'الدعم وضمان الخدمة',
    descEn: '24/7 support, ticketing, dedicated managers and SLA guarantees.',
    descAr: 'دعم 24/7 ونظام تذاكر ومديرون مخصصون وضمانات SLA.',
  },
]

/* ─── Industry verticals ─────────────────────────────────────────────── */
const VERTICALS = [
  { icon: Building2,        color: '#059669', bgColor: '#05966918', titleEn: 'Trading & Distribution', titleAr: 'التجارة والتوزيع', descEn: 'Inventory, purchasing and tax compliance for wholesalers & retailers.', descAr: 'المخزون والمشتريات والامتثال الضريبي للجملة والتجزئة.' },
  { icon: UtensilsCrossed,  color: '#dc2626', bgColor: '#dc262618', titleEn: 'Restaurant & F&B',        titleAr: 'المطاعم والأغذية',    descEn: 'Table management, KDS, delivery integrations and ZATCA receipts.', descAr: 'إدارة الطاولات وشاشة المطبخ والتوصيل وإيصالات ZATCA.' },
  { icon: Scissors,         color: '#0891b2', bgColor: '#0891b218', titleEn: 'Salon & Beauty',          titleAr: 'الصالون والجمال',     descEn: 'Appointments, services, client management and loyalty programs.', descAr: 'المواعيد والخدمات وإدارة العملاء وبرامج الولاء.' },
  { icon: ShoppingCart,     color: '#059669', bgColor: '#05966918', titleEn: 'Retail & POS',            titleAr: 'التجزئة ونقاط البيع', descEn: 'Touch POS, barcode scanning, returns and shift management.', descAr: 'نقطة بيع لمس وقراءة الباركود والمرتجعات وإدارة المناوبات.' },
  { icon: Users,            color: '#d97706', bgColor: '#d9770618', titleEn: 'HR & Manpower',           titleAr: 'الموارد البشرية والعمالة', descEn: 'Workforce management, contracts, WPS and GOSI compliance.', descAr: 'إدارة القوى العاملة والعقود وWPS والامتثال لـ GOSI.' },
  { icon: Globe,            color: '#2563eb', bgColor: '#2563eb18', titleEn: 'eCommerce',              titleAr: 'التجارة الإلكترونية',  descEn: 'Full online store with inventory sync, coupons and delivery.', descAr: 'متجر إلكتروني متكامل مع مزامنة المخزون والكوبونات والتوصيل.' },
]

export default function MarketingSolutions() {
  const { language } = useSelector((s) => s.ui)
  const isArabic = language === 'ar'
  const dir = isArabic ? 'rtl' : 'ltr'

  const [activeCategory, setActiveCategory] = useState('all')
  const [query, setQuery] = useState('')

  const filtered = MODULES.filter((m) => {
    const matchCat = activeCategory === 'all' || m.cat === activeCategory
    const q = query.toLowerCase()
    const matchQuery = !q ||
      m.titleEn.toLowerCase().includes(q) ||
      m.titleAr.includes(q) ||
      m.descEn.toLowerCase().includes(q)
    return matchCat && matchQuery
  })

  return (
    <main dir={dir} className="bg-white text-slate-900 antialiased overflow-x-hidden">

      {/* ── HERO ── */}
      <section className="relative overflow-hidden bg-slate-950 pb-0 pt-24 text-white">
        <div className="pointer-events-none absolute inset-0 opacity-20"
          style={{ backgroundImage: 'radial-gradient(circle at 25% 50%, #05966922 0%, transparent 55%), radial-gradient(circle at 75% 20%, #0891b220 0%, transparent 50%)' }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.5) 1px,transparent 1px)', backgroundSize: '64px 64px' }}
        />
        <div className="relative mx-auto max-w-5xl px-4 pb-16 text-center sm:px-6 lg:px-8">
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-emerald-300">
              <Layers className="h-3.5 w-3.5" />
              {isArabic ? 'التطبيقات والوحدات' : 'Apps & Modules'}
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.65 }}
            className="mt-5 text-5xl font-black tracking-[-0.03em] sm:text-6xl lg:text-[4.5rem]"
          >
            {isArabic ? (
              <>منصة واحدة.<br /><span className="text-emerald-400">كل شيء تحتاجه.</span></>
            ) : (
              <>One platform.<br /><span className="text-emerald-400">Everything you need.</span></>
            )}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2, duration: 0.5 }}
            className="mx-auto mt-5 max-w-2xl text-lg text-white/55"
          >
            {isArabic
              ? '20+ وحدة متكاملة تعمل معاً — للمالية والموارد البشرية والمبيعات والعمليات.'
              : '20+ integrated modules working together — finance, HR, sales, and operations.'}
          </motion.p>

          {/* Search bar */}
          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            className="mx-auto mt-8 max-w-md"
          >
            <div className="relative">
              <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/30" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={isArabic ? 'ابحث عن وحدة...' : 'Search modules...'}
                className="w-full rounded-full border border-white/15 bg-white/10 py-3.5 pl-12 pr-5 text-sm text-white placeholder:text-white/35 outline-none focus:border-emerald-400/50 focus:ring-2 focus:ring-emerald-400/15 backdrop-blur-sm transition-all"
                dir="auto"
              />
            </div>
          </motion.div>
        </div>

        {/* Gradient fade */}
        <div className="pointer-events-none h-16 bg-gradient-to-b from-slate-950 to-white" />
      </section>

      {/* ── MODULES GRID ── */}
      <section className="bg-white pb-28 pt-4">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

          {/* Category pills */}
          <div className="mb-10 flex flex-wrap gap-2 justify-center">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`rounded-full px-5 py-2 text-sm font-bold transition-all ${
                  activeCategory === cat.id
                    ? 'bg-emerald-600 text-white shadow-[0_4px_12px_-4px_rgba(5,150,105,0.4)]'
                    : 'border border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:text-emerald-600'
                }`}
              >
                {isArabic ? cat.labelAr : cat.labelEn}
              </button>
            ))}
          </div>

          {/* Grid */}
          <AnimatePresence mode="popLayout">
            <motion.div layout className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filtered.map((mod, idx) => (
                <motion.div
                  key={mod.id}
                  layout
                  custom={idx % 4}
                  variants={fadeUp}
                  initial="hidden"
                  animate="show"
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="group relative flex flex-col rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:border-emerald-300/60 hover:shadow-xl hover:shadow-emerald-100/60"
                >
                  {/* Top glow on hover */}
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-px rounded-t-3xl bg-gradient-to-r from-transparent via-emerald-400/40 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />

                  <div className="mb-4 flex items-start justify-between">
                    <div
                      className="flex h-12 w-12 items-center justify-center rounded-2xl ring-1 ring-black/[0.04] transition-transform duration-300 group-hover:scale-110"
                      style={{ background: mod.bgColor }}
                    >
                      <mod.icon className="h-5 w-5" style={{ color: mod.color }} />
                    </div>
                    {mod.badgeEn && (
                      <span
                        className="rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider"
                        style={{ background: mod.bgColor, color: mod.color }}
                      >
                        {isArabic ? mod.badgeAr : mod.badgeEn}
                      </span>
                    )}
                  </div>

                  <h3 className="text-base font-black text-slate-950">
                    {isArabic ? mod.titleAr : mod.titleEn}
                  </h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-500">
                    {isArabic ? mod.descAr : mod.descEn}
                  </p>

                  <div className={`mt-4 flex items-center gap-1.5 text-xs font-bold text-emerald-600 opacity-0 transition-all duration-200 group-hover:opacity-100 ${isArabic ? 'group-hover:-translate-x-0.5' : 'group-hover:translate-x-0.5'}`}>
                    {isArabic ? 'تعرف أكثر' : 'Learn more'}
                    <ChevronRight className={`h-3.5 w-3.5 ${isArabic ? 'rotate-180' : ''}`} />
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </AnimatePresence>

          {filtered.length === 0 && (
            <div className="py-20 text-center text-slate-400">
              <Search className="mx-auto mb-3 h-10 w-10 opacity-30" />
              <p className="text-lg font-semibold">{isArabic ? 'لا نتائج' : 'No results found'}</p>
              <p className="text-sm">{isArabic ? 'جرّب كلمة بحث مختلفة' : 'Try a different search term'}</p>
            </div>
          )}
        </div>
      </section>

      {/* ── INDUSTRY VERTICALS ── */}
      <section className="bg-slate-50/80 py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-16 text-center">
            <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-emerald-700">
              <Building2 className="h-3.5 w-3.5" />
              {isArabic ? 'حلول حسب الصناعة' : 'Industry solutions'}
            </span>
            <h2 className="mt-4 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
              {isArabic ? 'مبني لكل صناعة' : 'Built for your industry'}
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-slate-500">
              {isArabic
                ? 'وحدات مُعدَّة مسبقاً ومُصمَّمة لكل نشاط تجاري.'
                : 'Pre-configured modules designed for every business type.'}
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {VERTICALS.map((v, idx) => (
              <motion.div
                key={idx}
                custom={idx % 3}
                variants={fadeUp}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true }}
                className="group relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-7 shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl hover:shadow-slate-200/70"
              >
                <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full blur-3xl transition-all duration-500 group-hover:scale-125"
                  style={{ background: v.bgColor }} />

                <div className="relative mb-5 flex h-13 w-13 items-center justify-center rounded-2xl" style={{ background: v.bgColor }}>
                  <v.icon className="h-6 w-6" style={{ color: v.color }} />
                </div>
                <h3 className="relative text-lg font-black text-slate-950">
                  {isArabic ? v.titleAr : v.titleEn}
                </h3>
                <p className="relative mt-2 text-sm leading-relaxed text-slate-500">
                  {isArabic ? v.descAr : v.descEn}
                </p>
                <div className={`relative mt-5 flex items-center gap-1.5 text-sm font-bold text-emerald-600 opacity-0 transition-all duration-200 group-hover:opacity-100 ${isArabic ? 'group-hover:-translate-x-0.5' : 'group-hover:translate-x-0.5'}`}>
                  {isArabic ? 'استكشف' : 'Explore'}
                  <ArrowRight className={`h-4 w-4 ${isArabic ? 'rotate-180' : ''}`} />
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── DARK STATS STRIP ── */}
      <section className="bg-slate-950 py-20 text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
            {[
              { v: '20+', lEn: 'Integrated modules', lAr: 'وحدة متكاملة' },
              { v: '500+', lEn: 'Companies on Maqder', lAr: 'شركة على Maqder' },
              { v: '15+', lEn: 'Countries supported', lAr: 'دولة مدعومة' },
              { v: '99.9%', lEn: 'Platform uptime', lAr: 'وقت تشغيل المنصة' },
            ].map((s, i) => (
              <motion.div key={i} custom={i} variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }}
                className="text-center"
              >
                <p className="text-5xl font-black tracking-tight text-white">{s.v}</p>
                <p className="mt-2 text-sm font-semibold text-white/50">{isArabic ? s.lAr : s.lEn}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="bg-white pb-24 pt-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-900 p-10 text-white shadow-[0_40px_100px_-30px_rgba(5,150,105,0.4)] lg:p-16">
            <div className="pointer-events-none absolute -top-24 -right-24 h-80 w-80 rounded-full bg-white/10 blur-3xl" />
            <div className="relative flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-xl">
                <h2 className="text-3xl font-black lg:text-4xl">
                  {isArabic ? 'جاهز لتجربة Maqder؟' : 'Ready to explore Maqder?'}
                </h2>
                <p className="mt-3 text-lg text-white/65">
                  {isArabic ? 'ابدأ تجربتك المجانية — النظام جاهز في أقل من دقيقة.' : 'Start your free trial — your workspace is ready in under a minute.'}
                </p>
              </div>
              <div className="flex shrink-0 gap-3">
                <Link
                  to="/"
                  onClick={(e) => { e.preventDefault(); window.location.replace('/#trial') }}
                  className="inline-flex items-center gap-2 rounded-full bg-white px-8 py-4 text-sm font-black text-emerald-700 shadow-lg transition-all hover:-translate-y-0.5"
                >
                  {isArabic ? 'ابدأ مجاناً' : 'Start for free'}
                  <ArrowRight className={`h-4 w-4 ${isArabic ? 'rotate-180' : ''}`} />
                </Link>
                <Link to="/pricing" className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-8 py-4 text-sm font-bold text-white transition-all hover:bg-white/20">
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
