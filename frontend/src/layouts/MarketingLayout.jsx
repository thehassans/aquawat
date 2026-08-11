import { Outlet, Link, useLocation } from 'react-router-dom'
import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useDispatch, useSelector } from 'react-redux'
import {
  BarChart3,
  Bell,
  BookOpen,
  Calculator,
  ChevronDown,
  ClipboardList,
  CreditCard,
  FileText,
  Globe,
  Headphones,
  Layers,
  LineChart,
  Mail,
  Menu,
  MessageCircle,
  Package,
  Phone,
  Receipt,
  Settings2,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Truck,
  Users,
  Warehouse,
  X,
  Zap,
} from 'lucide-react'
import { setLanguage } from '../store/slices/uiSlice'
import { usePublicWebsiteSettings } from '../lib/website'
import { Suspense } from 'react'
import PageLoader from '../components/ui/PageLoader'

/* ── WhatsApp icon ─────────────────────────────────────────────────── */
function WAIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.945C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 018.413 3.488 11.824 11.824 0 013.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.866 9.866 0 001.519 5.256l-.999 3.648 3.74-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.096 3.2 5.077 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413z" />
    </svg>
  )
}

/* ── Apps mega-menu data ────────────────────────────────────────────── */
const MENU_APPS = [
  {
    groupEn: 'Finance', groupAr: 'المالية', color: '#7c3aed',
    apps: [
      { icon: FileText,   color: '#7c3aed', titleEn: 'E-Invoicing',   titleAr: 'الفوترة الإلكترونية', descEn: 'ZATCA-ready invoices & tax', descAr: 'فواتير جاهزة لـ ZATCA وضريبة' },
      { icon: BookOpen,   color: '#0891b2', titleEn: 'Accounting',     titleAr: 'المحاسبة',             descEn: 'Ledger, journals & reports', descAr: 'دفتر الأستاذ والقيود والتقارير' },
      { icon: Receipt,    color: '#dc2626', titleEn: 'Expenses',       titleAr: 'المصروفات',            descEn: 'Approvals & spend analytics', descAr: 'الموافقات وتحليلات الإنفاق' },
      { icon: CreditCard, color: '#059669', titleEn: 'Payments',       titleAr: 'المدفوعات',            descEn: 'Stripe, Moyasar & Tabby',    descAr: 'Stripe وMoyasar وTabby' },
    ],
  },
  {
    groupEn: 'HR', groupAr: 'الموارد البشرية', color: '#0891b2',
    apps: [
      { icon: Users,        color: '#0891b2', titleEn: 'HR Management', titleAr: 'إدارة الموارد البشرية', descEn: 'Employees, leave & documents', descAr: 'الموظفون والإجازات والمستندات' },
      { icon: Calculator,   color: '#d97706', titleEn: 'Payroll & WPS', titleAr: 'الرواتب وWPS',          descEn: 'Automated payroll & WPS files', descAr: 'رواتب آلية وملفات WPS' },
      { icon: ClipboardList,color: '#7c3aed', titleEn: 'Attendance',    titleAr: 'الحضور والمناوبات',     descEn: 'Shifts, biometric & overtime', descAr: 'مناوبات وبصمة وعمل إضافي' },
    ],
  },
  {
    groupEn: 'Operations', groupAr: 'العمليات', color: '#dc2626',
    apps: [
      { icon: Package,   color: '#dc2626', titleEn: 'Inventory',  titleAr: 'المخزون',       descEn: 'SKU, barcodes & stock alerts', descAr: 'SKU والباركود وتنبيهات المخزون' },
      { icon: Warehouse, color: '#d97706', titleEn: 'Warehouses', titleAr: 'المستودعات',     descEn: 'Multi-warehouse management',  descAr: 'إدارة مستودعات متعددة' },
      { icon: Truck,     color: '#2563eb', titleEn: 'Purchases',  titleAr: 'المشتريات',      descEn: 'POs, suppliers & GRN',         descAr: 'أوامر الشراء والموردين وGRN' },
      { icon: ClipboardList, color: '#059669', titleEn: 'Projects', titleAr: 'المشاريع',    descEn: 'Tasks, milestones & time logs', descAr: 'مهام ومعالم وسجلات الوقت' },
    ],
  },
  {
    groupEn: 'Sales', groupAr: 'المبيعات', color: '#059669',
    apps: [
      { icon: ShoppingCart,  color: '#7c3aed', titleEn: 'Point of Sale', titleAr: 'نقاط البيع',          descEn: 'Touch POS for any business',    descAr: 'نقطة بيع لمس لأي نشاط' },
      { icon: Globe,         color: '#059669', titleEn: 'eCommerce',     titleAr: 'التجارة الإلكترونية', descEn: 'Online store & delivery',       descAr: 'متجر إلكتروني وتوصيل' },
      { icon: MessageCircle, color: '#dc2626', titleEn: 'CRM',           titleAr: 'CRM',                 descEn: 'Contacts, deals & follow-ups',  descAr: 'جهات اتصال وصفقات ومتابعة' },
      { icon: MessageCircle, color: '#25d366', titleEn: 'WhatsApp',      titleAr: 'واتساب',              descEn: 'Automated customer messaging',  descAr: 'رسائل عملاء آلية' },
    ],
  },
  {
    groupEn: 'Platform', groupAr: 'المنصة', color: '#2563eb',
    apps: [
      { icon: BarChart3,  color: '#0891b2', titleEn: 'Analytics',     titleAr: 'التحليلات',      descEn: 'Live KPIs, P&L & dashboards', descAr: 'مؤشرات حية وأرباح وخسائر' },
      { icon: ShieldCheck,color: '#2563eb', titleEn: 'Compliance',    titleAr: 'الامتثال',       descEn: 'ZATCA, NBR & tax rules',      descAr: 'ZATCA وNBR وقواعد ضريبية' },
      { icon: Sparkles,   color: '#d97706', titleEn: 'AI Assistant',  titleAr: 'المساعد الذكي', descEn: 'Natural language data queries', descAr: 'استعلامات البيانات بالعربي' },
      { icon: Layers,     color: '#7c3aed', titleEn: 'Integrations',  titleAr: 'التكاملات',     descEn: 'API, webhooks & third-party',  descAr: 'API وwebhooks وتكاملات خارجية' },
    ],
  },
]

/* ── Mega-menu dropdown ─────────────────────────────────────────────── */
function MegaMenu({ isArabic, onClose }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.98 }}
      transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="absolute left-1/2 top-full mt-2 w-[min(96vw,880px)] -translate-x-1/2 overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-[0_20px_80px_-20px_rgba(0,0,0,0.22)] ring-1 ring-black/[0.03]"
    >
      {/* top accent line */}
      <div className="h-0.5 w-full bg-gradient-to-r from-violet-500 via-indigo-500 to-violet-600" />

      <div className="p-6">
        <div className="grid grid-cols-5 gap-1">
          {MENU_APPS.map((group) => (
            <div key={group.groupEn}>
              <p className="mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                {isArabic ? group.groupAr : group.groupEn}
              </p>
              <div className="space-y-0.5">
                {group.apps.map((app) => (
                  <Link
                    key={app.titleEn}
                    to="/solutions"
                    onClick={onClose}
                    className="group flex items-start gap-2.5 rounded-xl p-2 transition-all hover:bg-slate-50"
                  >
                    <div
                      className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-transform group-hover:scale-110"
                      style={{ background: `${app.color}18` }}
                    >
                      <app.icon className="h-3.5 w-3.5" style={{ color: app.color }} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[12px] font-bold leading-tight text-slate-900">
                        {isArabic ? app.titleAr : app.titleEn}
                      </p>
                      <p className="mt-0.5 text-[10px] leading-tight text-slate-400">
                        {isArabic ? app.descAr : app.descEn}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* footer strip */}
        <div className="mt-5 flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50/80 px-5 py-3">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Layers className="h-4 w-4 text-violet-500" />
            {isArabic ? '20+ وحدة متكاملة — كل شيء في منصة واحدة' : '20+ integrated modules — everything in one platform'}
          </div>
          <Link
            to="/solutions"
            onClick={onClose}
            className="rounded-full bg-violet-600 px-4 py-1.5 text-xs font-bold text-white shadow-sm transition-all hover:bg-violet-700 hover:-translate-y-0.5"
          >
            {isArabic ? 'عرض الكل' : 'View all'}
          </Link>
        </div>
      </div>
    </motion.div>
  )
}

/* ══════════════════════════════════════════════════════════════════════
   LAYOUT
══════════════════════════════════════════════════════════════════════ */
export default function MarketingLayout() {
  const location = useLocation()
  const dispatch = useDispatch()
  const { language } = useSelector((s) => s.ui)
  const { data } = usePublicWebsiteSettings()

  const [mobileOpen, setMobileOpen] = useState(false)
  const [appsOpen, setAppsOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const appsRef = useRef(null)

  const isArabic = language === 'ar'
  const phone = data?.contactPhone || '+966596775485'
  const waNumber = phone.replace(/\D/g, '')

  /* close mega-menu on outside click */
  useEffect(() => {
    const handler = (e) => {
      if (appsRef.current && !appsRef.current.contains(e.target)) setAppsOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  /* close mega-menu on route change */
  useEffect(() => {
    setAppsOpen(false)
    setMobileOpen(false)
  }, [location.pathname])

  /* scroll shadow */
  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 8)
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  const navLinks = [
    { to: '/',        labelEn: 'Home',     labelAr: 'الرئيسية' },
    { to: '/pricing', labelEn: 'Pricing',  labelAr: 'الأسعار' },
    { to: '/about',   labelEn: 'About',    labelAr: 'من نحن' },
    { to: '/contact', labelEn: 'Contact',  labelAr: 'تواصل معنا' },
  ]

  return (
    <div
      className="min-h-screen bg-white text-slate-900 antialiased"
      dir={isArabic ? 'rtl' : 'ltr'}
    >
      {/* ══ HEADER ══════════════════════════════════════════════════════ */}
      <header
        className={`sticky top-0 z-50 transition-all duration-300 ${
          scrolled
            ? 'border-b border-slate-200/80 bg-white/95 shadow-[0_2px_24px_-8px_rgba(0,0,0,0.12)] backdrop-blur-xl'
            : 'border-b border-transparent bg-white'
        }`}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">

          {/* ── Logo ── */}
          <Link to="/" className="shrink-0">
            <img
              src="/maqderlogolandingpage.webp"
              alt="Maqder"
              className="h-10 w-auto object-contain"
            />
          </Link>

          {/* ── Desktop nav ── */}
          <nav className="hidden items-center gap-0.5 md:flex">

            {/* Apps mega-menu trigger */}
            <div ref={appsRef} className="relative">
              <button
                onClick={() => setAppsOpen((v) => !v)}
                className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-semibold transition-all ${
                  appsOpen
                    ? 'bg-violet-50 text-violet-700'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Layers className="h-4 w-4" />
                {isArabic ? 'التطبيقات' : 'Apps'}
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform duration-200 ${appsOpen ? 'rotate-180' : ''}`}
                />
              </button>

              <AnimatePresence>
                {appsOpen && (
                  <MegaMenu isArabic={isArabic} onClose={() => setAppsOpen(false)} />
                )}
              </AnimatePresence>
            </div>

            {/* Regular links */}
            {navLinks.map((item) => {
              const active = location.pathname === item.to
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`rounded-xl px-3.5 py-2 text-sm font-semibold transition-all ${
                    active
                      ? 'bg-violet-50 text-violet-700'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  {isArabic ? item.labelAr : item.labelEn}
                </Link>
              )
            })}
          </nav>

          {/* ── Right actions ── */}
          <div className="flex items-center gap-2">

            {/* WhatsApp */}
            <a
              href={`https://wa.me/${waNumber}`}
              target="_blank"
              rel="noreferrer"
              aria-label="WhatsApp"
              className="hidden h-9 w-9 items-center justify-center rounded-full bg-[#25D366]/10 text-[#1da851] ring-1 ring-[#25D366]/25 transition-all hover:bg-[#25D366] hover:text-white hover:shadow-lg hover:shadow-[#25D366]/30 sm:inline-flex"
            >
              <WAIcon className="h-[17px] w-[17px]" />
            </a>

            {/* Phone */}
            <a
              href={`tel:${phone.replace(/\s+/g, '')}`}
              aria-label="Call"
              className="hidden h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 ring-1 ring-slate-200 transition-all hover:bg-slate-200 hover:text-slate-900 sm:inline-flex"
            >
              <Phone className="h-4 w-4" />
            </a>

            {/* Language */}
            <button
              onClick={() => dispatch(setLanguage(isArabic ? 'en' : 'ar'))}
              aria-label="Toggle language"
              className="hidden h-9 w-9 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 sm:inline-flex"
            >
              <Globe className="h-4 w-4" />
            </button>

            <span className="hidden h-5 w-px bg-slate-200 lg:block" />

            {/* Login CTA */}
            <Link
              to="/login"
              className="hidden rounded-full bg-violet-600 px-5 py-2 text-sm font-bold text-white shadow-[0_4px_12px_-4px_rgba(124,58,237,0.5)] transition-all hover:-translate-y-0.5 hover:bg-violet-700 hover:shadow-[0_6px_20px_-4px_rgba(124,58,237,0.55)] sm:inline-flex items-center"
            >
              {isArabic ? 'تسجيل الدخول' : 'Login'}
            </Link>

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileOpen((v) => !v)}
              className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 md:hidden"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* ── Mobile menu ── */}
        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden border-t border-slate-100 bg-white md:hidden"
            >
              <div className="mx-auto max-w-7xl space-y-1 px-4 py-4">
                {/* Apps accordion in mobile */}
                <div>
                  <button
                    onClick={() => setAppsOpen((v) => !v)}
                    className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <span className="flex items-center gap-2">
                      <Layers className="h-4 w-4 text-violet-500" />
                      {isArabic ? 'التطبيقات' : 'Apps'}
                    </span>
                    <ChevronDown className={`h-4 w-4 transition-transform ${appsOpen ? 'rotate-180' : ''}`} />
                  </button>
                  <AnimatePresence>
                    {appsOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden pl-4"
                      >
                        <div className="space-y-3 py-3">
                          {MENU_APPS.map((group) => (
                            <div key={group.groupEn}>
                              <p className="mb-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400 px-2">
                                {isArabic ? group.groupAr : group.groupEn}
                              </p>
                              {group.apps.map((app) => (
                                <Link
                                  key={app.titleEn}
                                  to="/solutions"
                                  onClick={() => { setMobileOpen(false); setAppsOpen(false) }}
                                  className="flex items-center gap-2.5 rounded-xl px-2 py-2 text-sm text-slate-700 hover:bg-slate-50"
                                >
                                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg" style={{ background: `${app.color}18` }}>
                                    <app.icon className="h-3.5 w-3.5" style={{ color: app.color }} />
                                  </div>
                                  <span className="font-semibold">{isArabic ? app.titleAr : app.titleEn}</span>
                                </Link>
                              ))}
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {navLinks.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileOpen(false)}
                    className={`block rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                      location.pathname === item.to
                        ? 'bg-violet-50 text-violet-700'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    {isArabic ? item.labelAr : item.labelEn}
                  </Link>
                ))}

                <div className="pt-2">
                  <Link
                    to="/login"
                    onClick={() => setMobileOpen(false)}
                    className="block w-full rounded-full bg-violet-600 py-3 text-center text-sm font-bold text-white"
                  >
                    {isArabic ? 'تسجيل الدخول' : 'Login'}
                  </Link>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* ══ PAGE CONTENT ════════════════════════════════════════════════ */}
      <Suspense fallback={<PageLoader />}>
        <Outlet />
      </Suspense>

      {/* ══ FOOTER ══════════════════════════════════════════════════════ */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="grid gap-10 md:grid-cols-4">
            {/* Brand */}
            <div className="md:col-span-1">
              <img src="/maqderlogolandingpage.webp" alt="Maqder" className="h-10 w-auto object-contain" />
              <p className="mt-4 text-sm leading-relaxed text-slate-500">
                {isArabic
                  ? 'منصة ERP سحابية متكاملة — مالية وموارد بشرية ومخزون في مكان واحد.'
                  : 'All-in-one cloud ERP — finance, HR, and inventory in one place.'}
              </p>
              <div className="mt-5 flex items-center gap-2">
                <a href={`https://wa.me/${waNumber}`} target="_blank" rel="noreferrer"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-[#25D366]/10 text-[#1da851] ring-1 ring-[#25D366]/20 transition hover:bg-[#25D366] hover:text-white">
                  <WAIcon className="h-4 w-4" />
                </a>
                <a href={`tel:${phone.replace(/\s+/g, '')}`}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 ring-1 ring-slate-200 transition hover:bg-slate-200">
                  <Phone className="h-4 w-4" />
                </a>
              </div>
            </div>

            {/* Product */}
            <div>
              <p className="mb-4 text-xs font-black uppercase tracking-widest text-slate-400">
                {isArabic ? 'المنتج' : 'Product'}
              </p>
              <div className="space-y-2.5 text-sm">
                <button
                  onClick={() => { /* trigger apps menu */ }}
                  className="block text-slate-500 transition hover:text-violet-600"
                >
                  <Link to="/solutions">{isArabic ? 'التطبيقات' : 'Apps & Modules'}</Link>
                </button>
                <Link to="/pricing" className="block text-slate-500 transition hover:text-violet-600">{isArabic ? 'الأسعار' : 'Pricing'}</Link>
                <Link to="/solutions" className="block text-slate-500 transition hover:text-violet-600">{isArabic ? 'الحلول' : 'Solutions'}</Link>
              </div>
            </div>

            {/* Company */}
            <div>
              <p className="mb-4 text-xs font-black uppercase tracking-widest text-slate-400">
                {isArabic ? 'الشركة' : 'Company'}
              </p>
              <div className="space-y-2.5 text-sm">
                <Link to="/about" className="block text-slate-500 transition hover:text-violet-600">{isArabic ? 'من نحن' : 'About'}</Link>
                <Link to="/contact" className="block text-slate-500 transition hover:text-violet-600">{isArabic ? 'تواصل معنا' : 'Contact'}</Link>
                <Link to="/privacy" className="block text-slate-500 transition hover:text-violet-600">{isArabic ? 'الخصوصية' : 'Privacy'}</Link>
                <Link to="/terms" className="block text-slate-500 transition hover:text-violet-600">{isArabic ? 'الشروط' : 'Terms'}</Link>
              </div>
            </div>

            {/* Contact */}
            <div>
              <p className="mb-4 text-xs font-black uppercase tracking-widest text-slate-400">
                {isArabic ? 'التواصل' : 'Contact'}
              </p>
              <div className="space-y-2.5 text-sm text-slate-500">
                <p dir="ltr">{phone}</p>
                <p>{data?.contactEmail || 'info@maqder.com'}</p>
                <p className="leading-relaxed">
                  {isArabic ? (data?.contactAddressAr || 'الدمام، المملكة العربية السعودية') : (data?.contactAddressEn || 'Dammam, Saudi Arabia')}
                </p>
              </div>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-slate-100 pt-6 text-xs text-slate-400 sm:flex-row">
            <p>© {new Date().getFullYear()} {data?.brandName || 'Maqder ERP'}. {isArabic ? 'جميع الحقوق محفوظة.' : 'All rights reserved.'}</p>
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <p>{isArabic ? 'جميع الأنظمة تعمل' : 'All systems operational'}</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
