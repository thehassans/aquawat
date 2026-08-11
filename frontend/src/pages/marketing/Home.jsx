import { useState } from 'react'
import { motion } from 'framer-motion'
import { Link, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import {
  ArrowRight,
  BarChart3,
  Building2,
  Calculator,
  CheckCircle2,
  ClipboardList,
  FileText,
  Globe,
  Landmark,
  MessageCircle,
  Package,
  Phone,
  PieChart,
  PlayCircle,
  Receipt,
  ShieldCheck,
  Sparkles,
  Star,
  Truck,
  Users,
  Warehouse,
  Zap,
} from 'lucide-react'
import { usePublicWebsiteSettings } from '../../lib/website'
import TrialSignup from '../../components/marketing/TrialSignup'

const fade = {
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
}

export default function MarketingHome() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { language } = useSelector((state) => state.ui)
  const { data } = usePublicWebsiteSettings()

  const isArabic = language === 'ar'

  const phone = data?.contactPhone || '+966596775485'

  const rawSubtitle = isArabic ? data?.hero?.subtitleAr : data?.hero?.subtitleEn
  const looksSaudiCentric = /zatca|saudi|vision\s*2030|gosi/i.test(String(rawSubtitle || ''))
  const heroSubtitle = looksSaudiCentric
    ? null
    : rawSubtitle
  const defaultSubtitle = isArabic
    ? 'الفوترة، الموارد البشرية، المخزون والتقارير — في منصة واحدة سريعة ومرنة حسب دولتك.'
    : 'Invoicing, HR, payroll, inventory and reporting in one fast platform — tuned to your country and currency.'

  const modules = [
    { icon: FileText, titleEn: 'E-Invoicing & Tax', titleAr: 'الفوترة الإلكترونية والضرائب', descEn: 'B2B/B2C invoices, tax compliance per country, and real-time submission where required.', descAr: 'فواتير B2B/B2C، الامتثال الضريبي حسب الدولة، والإرسال الفوري عند الحاجة.' },
    { icon: Users, titleEn: 'HR Management', titleAr: 'الموارد البشرية', descEn: 'Employees, leave, documents and automated reminders.', descAr: 'الموظفون، الإجازات، المستندات والتنبيهات التلقائية.' },
    { icon: Calculator, titleEn: 'Payroll & WPS', titleAr: 'الرواتب وملفات WPS', descEn: 'Payroll calculations, EOSB tools and WPS generation workflows.', descAr: 'حساب الرواتب، نهاية الخدمة، وتوليد ملفات WPS.' },
    { icon: Package, titleEn: 'Products & Catalog', titleAr: 'المنتجات', descEn: 'SKU, barcode, pricing, categories and product performance.', descAr: 'SKU والباركود والتسعير والتصنيفات وأداء المنتجات.' },
    { icon: Warehouse, titleEn: 'Warehouses & Stock', titleAr: 'المستودعات والمخزون', descEn: 'Multi-warehouse quantities, reserved stock and low stock alerts.', descAr: 'مخزون متعدد المستودعات، كميات محجوزة وتنبيهات نفاد.' },
    { icon: Truck, titleEn: 'Purchases & Shipments', titleAr: 'المشتريات والشحنات', descEn: 'Purchase orders, suppliers, receiving and shipment management.', descAr: 'طلبات شراء، موردين، استلام وإدارة الشحنات.' },
    { icon: Receipt, titleEn: 'Expenses & Finance', titleAr: 'المصروفات والمالية', descEn: 'Expense tracking, approvals, categories and analytics.', descAr: 'تتبع المصروفات، موافقات، تصنيفات وتحليلات.' },
    { icon: ClipboardList, titleEn: 'Projects & Tasks', titleAr: 'المشاريع والمهام', descEn: 'Project planning, task workflow and operational visibility.', descAr: 'تخطيط المشاريع، سير عمل المهام ووضوح العمليات.' },
    { icon: MessageCircle, titleEn: 'WhatsApp & Automation', titleAr: 'واتساب والأتمتة', descEn: 'Customer communications, notifications and follow-ups.', descAr: 'تواصل مع العملاء، إشعارات ومتابعة سلسة.' },
    { icon: BarChart3, titleEn: 'Reports & Dashboards', titleAr: 'التقارير ولوحات التحكم', descEn: 'Real-time KPIs for revenue, expenses, HR and inventory.', descAr: 'مؤشرات مباشرة للإيرادات والمصروفات والموارد والمخزون.' },
  ]

  const testimonials = [
    { name: 'Ahmed Al-Rashid', nameAr: 'أحمد الراشد', role: 'CFO, Tech Solutions', roleAr: 'المدير المالي', content: 'Month-end close is faster and cleaner. Finance, inventory, and reporting finally live in one place — Maqder handles the busywork.', contentAr: 'إقفال الشهر أصبح أسرع وأنظف. المالية والمخزون والتقارير في مكان واحد — Maqder يتولى الأعمال الروتينية.' },
    { name: 'Sara Mohammed', nameAr: 'سارة محمد', role: 'HR Director, Retail Group', roleAr: 'مديرة الموارد البشرية', content: 'Payroll and leave that used to take hours now run in minutes. Our HR team finally has time for people, not spreadsheets.', contentAr: 'الرواتب والإجازات التي كانت تستغرق ساعات تعمل الآن في دقائق. فريق الموارد البشرية يركز على الناس لا على الجداول.' },
    { name: 'Khalid Hassan', nameAr: 'خالد حسن', role: 'Operations Manager', roleAr: 'مدير العمليات', content: 'Multi-warehouse inventory with real-time tracking changed how we operate. Finally a system that grows with us.', contentAr: 'تتبع المخزون متعدد المستودعات غيّر طريقة عملنا. أخيراً نظام ينمو معنا.' },
  ]

  return (
    <main className="bg-white text-slate-900 overflow-hidden">

      {/* ── HERO ── */}
      <section className="relative bg-[#030c06] text-white overflow-hidden">
        {/* Grid texture */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.18]"
          style={{
            backgroundImage:
              'linear-gradient(to right, rgba(16,185,129,0.07) 1px, transparent 1px), linear-gradient(to bottom, rgba(16,185,129,0.07) 1px, transparent 1px)',
            backgroundSize: '56px 56px',
            maskImage: 'radial-gradient(ellipse 80% 60% at 50% 0%, black 40%, transparent 100%)',
            WebkitMaskImage: 'radial-gradient(ellipse 80% 60% at 50% 0%, black 40%, transparent 100%)',
          }}
        />
        <div className="pointer-events-none absolute -top-32 -left-32 h-[700px] w-[700px] rounded-full bg-emerald-500/[0.09] blur-[130px]" />
        <div className="pointer-events-none absolute top-40 right-0 h-[500px] w-[500px] rounded-full bg-emerald-700/[0.08] blur-[110px]" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent" />

        <div className="relative mx-auto max-w-7xl px-4 pb-28 pt-16 sm:px-6 lg:px-8 lg:pb-36 lg:pt-24">
          <div className="grid items-center gap-14 lg:grid-cols-12">

            {/* Copy */}
            <motion.div initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.75 }} className="lg:col-span-5">
              <div className="inline-flex items-center gap-2.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-300 backdrop-blur-sm">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                </span>
                {isArabic ? 'منصة ERP متعددة الدول' : 'Built for growing businesses'}
              </div>

              <h1 className="mt-7 text-5xl font-black leading-[1.0] tracking-tight sm:text-6xl lg:text-[3.75rem] xl:text-6xl">
                <span className="block bg-gradient-to-b from-white to-white/75 bg-clip-text text-transparent">
                  {isArabic ? 'منصة ERP' : 'The modern ERP'}
                </span>
                <span className="block bg-gradient-to-r from-emerald-300 via-emerald-200 to-teal-300 bg-clip-text text-transparent">
                  {isArabic ? 'للأعمال النامية' : 'businesses trust'}
                </span>
              </h1>

              <p className="mt-6 max-w-md text-lg leading-relaxed text-white/55">
                {heroSubtitle || defaultSubtitle}
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  to="/login"
                  className="group inline-flex items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-[#0f3d2e] to-[#1a5d44] px-7 py-4 font-semibold text-white shadow-[0_0_0_1px_rgba(15,61,46,0.15),0_8px_32px_-8px_rgba(15,61,46,0.45)] transition-all hover:-translate-y-0.5 hover:shadow-[0_0_0_1px_rgba(15,61,46,0.3),0_12px_40px_-8px_rgba(15,61,46,0.6)]"
                >
                  {isArabic ? 'ابدأ الآن' : 'Get started'}
                  <ArrowRight className={`h-5 w-5 transition-transform group-hover:translate-x-0.5 ${isArabic ? 'rotate-180 group-hover:-translate-x-0.5' : ''}`} />
                </Link>
                <a
                  href="#trial"
                  onClick={(e) => {
                    e.preventDefault();
                    document.getElementById('trial').scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="inline-flex items-center justify-center gap-2.5 rounded-2xl border border-white/12 bg-white/[0.06] px-7 py-4 font-semibold text-white backdrop-blur-sm transition-all hover:border-white/20 hover:bg-white/10"
                >
                  <PlayCircle className="h-5 w-5 text-emerald-300" />
                  {isArabic ? 'تجربة مجانية' : 'Free trial'}
                </a>
                <a
                  href="https://maqder.com/downloads/MaqderDesktop-Setup-1.0.0.exe"
                  download="MaqderDesktop-Setup-1.0.0.exe"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2.5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-7 py-4 font-semibold text-white backdrop-blur-sm transition-all hover:border-emerald-500/50 hover:bg-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.15)]"
                >
                  <svg className="h-5 w-5 text-emerald-300" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.951-1.801"/>
                  </svg>
                  {isArabic ? 'تنزيل لويندوز' : 'Download App'}
                </a>
              </div>

              {/* Rating / social proof */}
              <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3">
                <div className="flex items-center gap-2">
                  <div className="flex -space-x-2.5">
                    {['A', 'S', 'K', 'M'].map((c, i) => (
                      <div key={i} className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#030c06] bg-gradient-to-br from-[#1a5d44] to-[#0f3d2e] text-[11px] font-bold text-white">
                        {c}
                      </div>
                    ))}
                  </div>
                  <div className="text-sm">
                    <div className="flex items-center gap-1">
                      {[...Array(5)].map((_, j) => <Star key={j} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />)}
                    </div>
                    <p className="text-white/45">{isArabic ? '500+ شركة تثق بنا' : 'Trusted by 500+ companies'}</p>
                  </div>
                </div>
              </div>

              <div className="mt-7 flex flex-wrap gap-2">
                {[
                  { icon: Sparkles, label: isArabic ? 'واجهة أنيقة' : 'Clean UI' },
                  { icon: Globe, label: isArabic ? 'عربي / English' : 'Arabic / English' },
                  { icon: Landmark, label: isArabic ? 'متعدد العملات' : 'Multi-currency' },
                ].map((item, i) => (
                  <div key={i} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-white/60">
                    <item.icon className="h-3.5 w-3.5 text-emerald-400" />
                    {item.label}
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Dashboard mockup */}
            <motion.div initial={{ opacity: 0, y: 36 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.75, delay: 0.15 }} className="lg:col-span-7">
              <div className="relative">
                <div className="pointer-events-none absolute inset-0 scale-110 rounded-3xl bg-emerald-500/[0.08] blur-3xl" />
                <div className="relative overflow-hidden rounded-[2rem] border border-white/[0.08] bg-white/[0.04] p-1 shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_40px_100px_-20px_rgba(0,0,0,0.9)] backdrop-blur-sm">
                  <div className="rounded-[1.75rem] border border-white/[0.05] bg-[#071209] p-5">

                    <div className="mb-5 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
                        <span className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-400">{isArabic ? 'لوحة التحكم' : 'Dashboard'}</span>
                      </div>
                      <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/12 px-3 py-1.5 text-xs font-bold text-emerald-300">{isArabic ? 'مباشر' : 'Live'}</div>
                    </div>

                    <div className="mb-4 grid grid-cols-2 gap-3">
                      {[
                        { label: isArabic ? 'الفواتير اليوم' : 'Invoices today', value: '284', trend: '+18%', up: true },
                        { label: isArabic ? 'الإيراد الشهري' : 'Monthly revenue', value: '$1.2M', trend: '+24%', up: true },
                        { label: isArabic ? 'الموظفون النشطون' : 'Active employees', value: '142', trend: '+3', up: true },
                        { label: isArabic ? 'أصناف المخزون' : 'Stock items', value: '4,280', trend: 'Low: 12', up: false },
                      ].map((metric, i) => (
                        <div key={i} className="rounded-2xl border border-white/[0.05] bg-white/[0.03] p-4">
                          <p className="text-xs text-white/40">{metric.label}</p>
                          <p className="mt-2 text-xl font-black text-white">{metric.value}</p>
                          <p className={`mt-1 text-xs font-semibold ${metric.up ? 'text-emerald-400' : 'text-amber-400'}`}>{metric.trend}</p>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center justify-between rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.08] px-4 py-3">
                      <div className="flex items-center gap-3">
                        <ShieldCheck className="h-5 w-5 text-emerald-400" />
                        <div>
                          <p className="text-xs font-semibold text-emerald-300">{isArabic ? 'الامتثال الضريبي مفعّل' : 'Tax compliance active'}</p>
                          <p className="text-[11px] text-white/35">{isArabic ? 'آخر مزامنة: للتو' : 'Last sync: just now'}</p>
                        </div>
                      </div>
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/15">
                        <div className="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-400" />
                      </div>
                    </div>
                  </div>
                </div>

                <motion.div animate={{ y: [0, -10, 0] }} transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
                  className="absolute -top-5 -right-5 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 shadow-2xl backdrop-blur-xl">
                  <p className="text-[11px] text-white/50">{isArabic ? 'الامتثال' : 'Compliance'}</p>
                  <p className="mt-0.5 text-sm font-bold text-white">{isArabic ? '✓ ضرائب حسب الدولة' : '✓ Regional tax ready'}</p>
                </motion.div>

                <motion.div animate={{ y: [0, 10, 0] }} transition={{ duration: 3.8, repeat: Infinity, ease: 'easeInOut', delay: 0.6 }}
                  className="absolute -bottom-5 -left-5 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 shadow-2xl backdrop-blur-xl">
                  <p className="text-[11px] text-white/50">{isArabic ? 'الدعم' : 'Support'}</p>
                  <p className="mt-0.5 text-sm font-bold text-white">24 / 7 Available</p>
                </motion.div>
              </div>
            </motion.div>
          </div>

          {/* Live demo — premium panel under hero copy */}
          <div id="trial" className="relative mx-auto mt-16 max-w-3xl scroll-mt-24">
            <div className="mb-6 text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-300/80">
                {isArabic ? 'تجربة مباشرة' : 'Live demo'}
              </p>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-white sm:text-3xl">
                {isArabic ? 'أنشئ حسابك في أقل من دقيقة' : 'Spin up your workspace in under a minute'}
              </h2>
              <p className="mx-auto mt-2 max-w-xl text-sm text-white/45">
                {isArabic
                  ? 'اختر الدولة والعملة واسم الشركة — ثم ادخل لوحة التحكم مباشرة.'
                  : 'Choose country, currency, and company name — then land in your tenant dashboard.'}
              </p>
            </div>
            <TrialSignup variant="premium" />
          </div>
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-white to-transparent" />
      </section>

      {/* ── TRUST STRIP ── */}
      <section className="border-b border-slate-100 bg-white py-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <p className="mb-7 text-center text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
            {isArabic ? 'لماذا تثق الشركات بـ Maqder' : 'Why businesses trust Maqder'}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6">
            {[
              { icon: ShieldCheck, label: isArabic ? 'أمان مؤسسي' : 'Enterprise security' },
              { icon: Globe, label: isArabic ? 'متعدد العملات' : 'Multi-currency' },
              { icon: Building2, label: isArabic ? 'ERP سحابي' : 'Cloud ERP' },
            ].map((item) => (
              <div
                key={item.label}
                className="flex h-20 min-w-[150px] items-center justify-center gap-3 rounded-2xl border border-slate-200/70 bg-slate-50/50 px-6 transition-all duration-300 hover:border-emerald-200 hover:bg-white hover:shadow-md"
              >
                <item.icon className="h-5 w-5 text-emerald-600" />
                <span className="text-sm font-semibold text-slate-700">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── STATS ── */}
      <section className="bg-white py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-6">
            {[
              { value: '500+', label: isArabic ? 'شركة تثق بنا' : 'Companies trust us' },
              { value: '50K+', label: isArabic ? 'فاتورة يومياً' : 'Invoices processed daily' },
              { value: '99.9%', label: isArabic ? 'وقت تشغيل المنصة' : 'Platform uptime' },
              { value: '24/7', label: isArabic ? 'دعم فني متواصل' : 'Customer support' },
            ].map((stat, i) => (
              <motion.div
                key={i}
                variants={fade}
                initial="initial"
                whileInView="animate"
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                className="group relative overflow-hidden rounded-3xl border border-slate-200/80 bg-gradient-to-b from-white to-slate-50/60 p-6 text-center shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-emerald-300/60 hover:shadow-xl hover:shadow-emerald-100/50 sm:p-8"
              >
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/40 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                <p className="bg-gradient-to-b from-slate-900 to-slate-700 bg-clip-text text-4xl font-black tracking-tight text-transparent sm:text-5xl">{stat.value}</p>
                <p className="mt-2 text-sm font-medium text-slate-500">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <div className="border-t border-slate-100" />

      {/* ── MODULES GRID ── */}
      <section className="bg-slate-50/70 py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-16 text-center">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800">
              <Building2 className="h-4 w-4" />
              {isArabic ? 'وحدات ERP متكاملة' : 'Integrated ERP modules'}
            </div>
            <h2 className="text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
              {isArabic ? 'كل أدوات عملك في مكان واحد' : 'Every tool your business needs'}
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-500">
              {isArabic
                ? 'من الفوترة إلى الرواتب والمخزون — بنية واحدة مصممة للأعمال الحديثة.'
                : 'From invoicing to payroll and inventory — one seamless architecture built for modern businesses.'}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 xl:gap-5">
            {modules.map((m, idx) => (
              <motion.div key={idx} variants={fade} initial="initial" whileInView="animate" viewport={{ once: true }} transition={{ duration: 0.4, delay: (idx % 4) * 0.07 }}
                className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:border-emerald-300/60 hover:shadow-xl hover:shadow-emerald-100/60">
                <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-emerald-400/0 blur-2xl transition-all duration-500 group-hover:bg-emerald-400/20" />
                <div className="relative mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-600 ring-1 ring-slate-200/80 transition-all duration-300 group-hover:bg-gradient-to-br group-hover:from-emerald-500 group-hover:to-emerald-600 group-hover:text-white group-hover:ring-emerald-500/20 group-hover:shadow-lg group-hover:shadow-emerald-500/25">
                  <m.icon className="h-5 w-5" />
                </div>
                <p className="relative font-bold text-slate-950">{isArabic ? m.titleAr : m.titleEn}</p>
                <p className="relative mt-2 text-sm leading-relaxed text-slate-500">{isArabic ? m.descAr : m.descEn}</p>
                <div className={`relative mt-4 flex items-center gap-1 text-sm font-semibold text-emerald-600 opacity-0 transition-all duration-300 group-hover:opacity-100 ${isArabic ? 'group-hover:-translate-x-1' : 'group-hover:translate-x-1'}`}>
                  {isArabic ? 'اعرف المزيد' : 'Learn more'}
                  <ArrowRight className={`h-3.5 w-3.5 ${isArabic ? 'rotate-180' : ''}`} />
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── DARK FEATURES ── */}
      <section className="bg-slate-950 py-24 text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-center gap-16 lg:grid-cols-2">
            <div>
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-300">
                <Zap className="h-4 w-4" />
                {isArabic ? 'مبني للنمو' : 'Built for growth'}
              </div>
              <h2 className="text-4xl font-black leading-tight sm:text-5xl">
                {isArabic
                  ? 'امتثال تلقائي.\nنمو واضح.'
                  : <>{isArabic ? 'امتثال تلقائي.' : 'Automatic compliance.'}<br /><span className="text-emerald-400">{isArabic ? 'نمو واضح.' : 'Clear growth.'}</span></>}
              </h2>
              <p className="mt-5 max-w-lg text-lg leading-relaxed text-white/55">
                {isArabic
                  ? 'من أول فاتورة إلى التقارير الضريبية الربع سنوية — النظام يعمل بينما أنت تتطور.'
                  : 'From your first invoice to quarterly tax returns — the system works while your business grows.'}
              </p>
              <div className="mt-9 space-y-4">
                {[
                  isArabic ? 'امتثال ضريبي حسب الدولة في القلب' : 'Country-aware tax compliance at the core',
                  isArabic ? 'حسابات الرواتب ونهاية الخدمة التلقائية' : 'Automatic payroll & end-of-service calculations',
                  isArabic ? 'دعم كامل للعربية والإنجليزية' : 'Full bilingual Arabic / English support',
                  isArabic ? 'قابل للتوسع من شركة ناشئة إلى مؤسسة' : 'Scales from startup to enterprise',
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 ring-1 ring-emerald-500/25">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                    </div>
                    <span className="font-medium text-white/80">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              {[
                { icon: FileText, title: isArabic ? 'الفوترة الإلكترونية' : 'E-Invoicing', desc: isArabic ? 'توليد QR وتوقيع XML وإرسال فوري حسب متطلبات الدولة' : 'QR generation, XML signing and instant tax authority submission', borderColor: 'border-emerald-500/20', bgColor: 'bg-gradient-to-br from-emerald-500/10 to-teal-500/10' },
                { icon: Users, title: isArabic ? 'الموارد البشرية' : 'HR & Payroll', desc: isArabic ? 'الموظفون والرواتب وملفات الرواتب والتأمينات' : 'Employees, payroll, salary files and social insurance coverage', borderColor: 'border-blue-500/20', bgColor: 'bg-gradient-to-br from-blue-500/10 to-indigo-500/10' },
                { icon: Package, title: isArabic ? 'المخزون' : 'Inventory', desc: isArabic ? 'مستودعات متعددة وتنبيهات نفاد المخزون' : 'Multi-warehouse management with low stock alerts', borderColor: 'border-violet-500/20', bgColor: 'bg-gradient-to-br from-violet-500/10 to-purple-500/10' },
              ].map((item, i) => (
                <motion.div key={i} variants={fade} initial="initial" whileInView="animate" viewport={{ once: true }} transition={{ duration: 0.5, delay: i * 0.12 }}
                  className={`rounded-2xl border ${item.borderColor} ${item.bgColor} p-5`}>
                  <div className="flex items-start gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/[0.05]">
                      <item.icon className="h-5 w-5 text-white/75" />
                    </div>
                    <div>
                      <p className="font-bold text-white">{item.title}</p>
                      <p className="mt-1.5 text-sm text-white/45">{item.desc}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section className="bg-white py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-14 text-center">
            <h2 className="text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
              {isArabic ? 'ماذا يقول عملاؤنا' : 'Trusted by growing businesses'}
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-slate-500">
              {isArabic ? 'آراء حقيقية من شركات تعمل مع Maqder يومياً.' : 'Real feedback from companies using Maqder every day.'}
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {testimonials.map((t, i) => (
              <motion.div key={i} variants={fade} initial="initial" whileInView="animate" viewport={{ once: true }} transition={{ duration: 0.5, delay: i * 0.1 }}
                className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-4 flex gap-1">
                  {[...Array(5)].map((_, j) => <Star key={j} className="h-4 w-4 fill-amber-400 text-amber-400" />)}
                </div>
                <p className="flex-1 text-slate-700 leading-relaxed">{isArabic ? t.contentAr : t.content}</p>
                <div className="mt-6 flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 text-sm font-bold text-white">
                    {(isArabic ? t.nameAr : t.name).charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">{isArabic ? t.nameAr : t.name}</p>
                    <p className="text-xs text-slate-500">{isArabic ? t.roleAr : t.role}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="pb-24 pt-4">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-[2rem] bg-[#030c06] p-10 text-white shadow-[0_40px_100px_-30px_rgba(0,0,0,0.7)] lg:p-16">
            <div className="pointer-events-none absolute -top-24 left-1/3 h-96 w-96 rounded-full bg-emerald-500/10 blur-[100px]" />
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-500/35 to-transparent" />

            <div className="relative flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-2xl">
                <p className="text-xs font-semibold uppercase tracking-[0.32em] text-emerald-400">
                  {isArabic ? 'جاهز للانطلاق' : 'Ready to launch'}
                </p>
                <h2 className="mt-3 text-4xl font-black leading-tight lg:text-5xl">
                  {isArabic ? 'ابدأ رحلتك مع Maqder اليوم' : <>Start your ERP<br /><span className="text-emerald-400">journey today</span></>}
                </h2>
                <p className="mt-4 text-lg text-white/55">
                  {isArabic
                    ? 'سجّل الدخول أو جرّب النظام مباشرةً وشاهد كيف تبدو إدارة الأعمال الحديثة.'
                    : 'Log in or open the live demo and see what modern business management feels like.'}
                </p>
              </div>

              <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
                <Link
                  to="/login"
                  className="group inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#0f3d2e] to-[#1a5d44] px-8 py-4 font-semibold text-white shadow-[0_0_40px_-8px_rgba(15,61,46,0.35)] transition-all hover:shadow-[0_0_50px_-8px_rgba(15,61,46,0.55)]"
                >
                  {isArabic ? 'ابدأ الآن' : 'Get started'}
                  <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5" />
                </Link>
                <a
                  href="#trial"
                  onClick={(e) => {
                    e.preventDefault();
                    document.getElementById('trial').scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/12 bg-white/[0.05] px-8 py-4 font-semibold text-white transition-all hover:bg-white/10"
                >
                  <PlayCircle className="h-5 w-5 text-emerald-300" />
                  {isArabic ? 'تجربة مجانية' : 'Free trial'}
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

    </main>
  )
}
