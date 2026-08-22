import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useState, Suspense } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useDispatch } from 'react-redux'
import {
  Menu,
  Phone,
  X,
  Mail,
  MapPin,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Clock,
  Lock,
  Building2,
  Check,
} from 'lucide-react'
import { setLanguage } from '../store/slices/uiSlice'
import { usePublicWebsiteSettings } from '../lib/website'
import PageLoader from '../components/ui/PageLoader'

function WAIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.945C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 018.413 3.488 11.824 11.824 0 013.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.866 9.866 0 001.519 5.256l-.999 3.648 3.74-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.096 3.2 5.077 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413z" />
    </svg>
  )
}

export default function MarketingLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const { data } = usePublicWebsiteSettings()

  const [mobileOpen, setMobileOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  // Marketing site is English-only.
  const isArabic = false
  const phone = '+966593914916'
  const waNumber = '966593914916'
  const email = data?.contactEmail || 'info@maqder.com'
  const address = 'Dammam, Madinat Al Ummal Dist. 18, Saudi Arabia'

  useEffect(() => {
    dispatch(setLanguage('en'))
  }, [dispatch])

  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 8)
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  const openTrial = () => {
    setMobileOpen(false)
    if (location.pathname === '/') {
      window.dispatchEvent(new Event('maqder-open-trial'))
      return
    }
    navigate('/?trial=1')
  }

  const navLinks = [
    { to: '/', labelEn: 'Home', labelAr: 'الرئيسية' },
    { to: '/solutions', labelEn: 'Solutions', labelAr: 'الحلول' },
    { to: '/pricing', labelEn: 'Pricing', labelAr: 'الأسعار' },
    { to: '/about', labelEn: 'About', labelAr: 'من نحن' },
    { to: '/contact', labelEn: 'Contact', labelAr: 'تواصل معنا' },
  ]

  return (
    <div className="min-h-screen bg-white text-slate-900 antialiased font-body flex flex-col justify-between" dir="ltr" lang="en">
      {/* ── STICKY MODERN HEADER ── */}
      <header
        className={`sticky top-0 z-50 transition-all duration-300 ${
          scrolled
            ? 'border-b border-slate-200/80 bg-white/95 shadow-[0_2px_24px_-8px_rgba(0,0,0,0.12)] backdrop-blur-xl'
            : 'border-b border-transparent bg-white'
        }`}
      >
        <div className="mx-auto flex h-24 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link to="/" className="shrink-0">
            <img src="/maqderlogolandingpage.webp" alt="Maqder" className="h-20 w-auto object-contain" />
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {navLinks.map((item) => {
              const active = location.pathname === item.to
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`rounded-xl px-4 py-2 text-sm font-bold transition-all ${
                    active
                      ? 'bg-emerald-50 text-emerald-700 shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-950'
                  }`}
                >
                  {isArabic ? item.labelAr : item.labelEn}
                </Link>
              )
            })}
          </nav>

          <div className="flex items-center gap-2.5">
            <a
              href={`https://wa.me/${waNumber}`}
              target="_blank"
              rel="noreferrer"
              aria-label="WhatsApp"
              className="hidden h-10 w-10 items-center justify-center rounded-full bg-[#25D366]/10 text-[#1da851] ring-1 ring-[#25D366]/25 transition-all hover:bg-[#25D366] hover:text-white sm:inline-flex shadow-sm"
              title="Chat on WhatsApp (+966593914916)"
            >
              <WAIcon className="h-5 w-5" />
            </a>

            <a
              href={`tel:${phone}`}
              aria-label="Call Direct"
              className="hidden h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-700 ring-1 ring-slate-200 transition-all hover:bg-slate-200 sm:inline-flex shadow-sm"
              title="Call +966593914916"
            >
              <Phone className="h-4 w-4" />
            </a>

            <span className="hidden h-6 w-px bg-slate-200 lg:block" />

            <button
              type="button"
              onClick={openTrial}
              className="hidden rounded-full border border-emerald-200 bg-emerald-50 px-5 py-2.5 text-sm font-black text-emerald-800 transition-all hover:-translate-y-0.5 hover:bg-emerald-100 sm:inline-flex shadow-sm"
            >
              Try free
            </button>

            <Link
              to="/login"
              className="hidden items-center rounded-full bg-emerald-600 px-6 py-2.5 text-sm font-black text-white shadow-[0_4px_16px_-4px_rgba(5,150,105,0.5)] transition-all hover:-translate-y-0.5 hover:bg-emerald-700 sm:inline-flex"
            >
              Login
            </Link>

            <button
              onClick={() => setMobileOpen((v) => !v)}
              className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 md:hidden"
            >
              {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden border-t border-slate-100 bg-white md:hidden"
            >
              <div className="mx-auto max-w-7xl space-y-1.5 px-4 py-4">
                {navLinks.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileOpen(false)}
                    className={`block rounded-xl px-4 py-3 text-sm font-bold ${
                      location.pathname === item.to
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {isArabic ? item.labelAr : item.labelEn}
                  </Link>
                ))}

                <div className="pt-2 border-t border-slate-100 space-y-2">
                  <a
                    href={`tel:${phone}`}
                    className="flex items-center gap-3 rounded-xl bg-slate-100 px-4 py-3 text-sm font-bold text-slate-800"
                  >
                    <Phone className="h-4 w-4 text-emerald-600" />
                    <span>Call: +966 59 391 4916</span>
                  </a>
                  <a
                    href={`https://wa.me/${waNumber}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-3 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800"
                  >
                    <WAIcon className="h-4 w-4 text-[#25D366]" />
                    <span>WhatsApp: +966 59 391 4916</span>
                  </a>
                  <button
                    type="button"
                    onClick={openTrial}
                    className="block w-full rounded-full border border-emerald-200 bg-emerald-50 py-3 text-center text-sm font-black text-emerald-800"
                  >
                    Start Free Trial
                  </button>
                  <Link
                    to="/login"
                    onClick={() => setMobileOpen(false)}
                    className="block w-full rounded-full bg-emerald-600 py-3 text-center text-sm font-black text-white"
                  >
                    Login
                  </Link>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* ── OUTLET MAIN CONTENT ── */}
      <div className="flex-1">
        <Suspense fallback={<PageLoader />}>
          <Outlet />
        </Suspense>
      </div>

      {/* ── ULTRA PREMIUM FOOTER ── */}
      <footer className="relative overflow-hidden bg-slate-950 text-slate-300 border-t border-slate-800/80">
        {/* Ambient Gradient Glows */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.5) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.5) 1px,transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />
        <div className="pointer-events-none absolute -top-40 left-1/4 h-80 w-80 rounded-full bg-emerald-500/10 blur-[120px]" />
        <div className="pointer-events-none absolute bottom-0 right-10 h-72 w-72 rounded-full bg-teal-500/10 blur-[100px]" />

        {/* Top Live Status & Direct Contact Ribbon */}
        <div className="relative border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-950/60 px-3.5 py-1 text-xs font-bold text-emerald-400 shadow-sm">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                All Systems Live · 99.99% Uptime SLA
              </span>
              <span className="hidden text-xs text-slate-400 sm:inline-block">
                ZATCA Phase 2 E-Invoicing Certified
              </span>
            </div>

            <div className="flex items-center gap-4 text-xs font-bold">
              <a
                href={`tel:${phone}`}
                className="flex items-center gap-1.5 text-slate-300 hover:text-emerald-400 transition"
              >
                <Phone className="h-3.5 w-3.5 text-emerald-400" />
                <span dir="ltr">+966 59 391 4916</span>
              </a>
              <span className="text-slate-700">|</span>
              <a
                href={`https://wa.me/${waNumber}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 text-slate-300 hover:text-[#25D366] transition"
              >
                <WAIcon className="h-3.5 w-3.5 text-[#25D366]" />
                <span>WhatsApp Live Chat</span>
              </a>
            </div>
          </div>
        </div>

        {/* Main Footer Multi-Column Grid */}
        <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-12">
            {/* Column 1: Brand & Bio (4 cols) */}
            <div className="lg:col-span-4 space-y-6">
              <Link to="/" className="inline-block bg-white/95 p-2.5 rounded-2xl shadow-md">
                <img src="/maqderlogolandingpage.webp" alt="Maqder" className="h-14 w-auto object-contain" />
              </Link>
              <p className="text-sm leading-relaxed text-slate-400 max-w-sm">
                The next-generation unified cloud ERP for growing enterprises across Saudi Arabia & the GCC. Combining beauty, lightning velocity, and strict ZATCA compliance.
              </p>

              {/* Compliance & Trust Badges */}
              <div className="space-y-2.5 pt-2">
                <div className="flex items-center gap-2.5 text-xs text-slate-300">
                  <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span>ZATCA Phase 2 Cryptographic XML & QR Compliant</span>
                </div>
                <div className="flex items-center gap-2.5 text-xs text-slate-300">
                  <Lock className="h-4 w-4 text-teal-400 shrink-0" />
                  <span>256-Bit Bank-Grade Cloud Encryption</span>
                </div>
                <div className="flex items-center gap-2.5 text-xs text-slate-300">
                  <Building2 className="h-4 w-4 text-yellow-400 shrink-0" />
                  <span>Saudi Vision 2030 Business Ready</span>
                </div>
              </div>
            </div>

            {/* Column 2: Solutions (2 cols) */}
            <div className="lg:col-span-2">
              <p className="mb-4 text-xs font-black uppercase tracking-[0.2em] text-emerald-400">
                Solutions
              </p>
              <ul className="space-y-3 text-sm font-medium">
                <li>
                  <Link to="/solutions" className="text-slate-400 hover:text-white transition">
                    E-Invoicing & ZATCA
                  </Link>
                </li>
                <li>
                  <Link to="/solutions" className="text-slate-400 hover:text-white transition">
                    Accounting & Ledger
                  </Link>
                </li>
                <li>
                  <Link to="/solutions" className="text-slate-400 hover:text-white transition">
                    HR, Payroll & WPS
                  </Link>
                </li>
                <li>
                  <Link to="/solutions" className="text-slate-400 hover:text-white transition">
                    Inventory & Stock
                  </Link>
                </li>
                <li>
                  <Link to="/solutions" className="text-slate-400 hover:text-white transition">
                    POS & Kitchen (KDS)
                  </Link>
                </li>
                <li>
                  <Link to="/solutions" className="text-slate-400 hover:text-white transition">
                    Ecommerce Storefront
                  </Link>
                </li>
              </ul>
            </div>

            {/* Column 3: Industries (2 cols) */}
            <div className="lg:col-span-2">
              <p className="mb-4 text-xs font-black uppercase tracking-[0.2em] text-emerald-400">
                Industries
              </p>
              <ul className="space-y-3 text-sm font-medium">
                <li>
                  <Link to="/solutions" className="text-slate-400 hover:text-white transition">
                    Wholesale & Supply
                  </Link>
                </li>
                <li>
                  <Link to="/solutions" className="text-slate-400 hover:text-white transition">
                    Restaurants & Cafes
                  </Link>
                </li>
                <li>
                  <Link to="/solutions" className="text-slate-400 hover:text-white transition">
                    Retail Supermarkets
                  </Link>
                </li>
                <li>
                  <Link to="/solutions" className="text-slate-400 hover:text-white transition">
                    Salons & Spas
                  </Link>
                </li>
                <li>
                  <Link to="/solutions" className="text-slate-400 hover:text-white transition">
                    Contracting & Labor
                  </Link>
                </li>
                <li>
                  <Link to="/solutions" className="text-slate-400 hover:text-white transition">
                    Fashion Boutiques
                  </Link>
                </li>
              </ul>
            </div>

            {/* Column 4: Company & Trust (2 cols) */}
            <div className="lg:col-span-2">
              <p className="mb-4 text-xs font-black uppercase tracking-[0.2em] text-emerald-400">
                Company
              </p>
              <ul className="space-y-3 text-sm font-medium">
                <li>
                  <Link to="/about" className="text-slate-400 hover:text-white transition">
                    About Maqder
                  </Link>
                </li>
                <li>
                  <Link to="/pricing" className="text-slate-400 hover:text-white transition">
                    Pricing & Plans
                  </Link>
                </li>
                <li>
                  <Link to="/contact" className="text-slate-400 hover:text-white transition">
                    Contact & Demos
                  </Link>
                </li>
                <li>
                  <Link to="/privacy" className="text-slate-400 hover:text-white transition">
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link to="/terms" className="text-slate-400 hover:text-white transition">
                    Terms of Service
                  </Link>
                </li>
              </ul>
            </div>

            {/* Column 5: Direct Contact Card (2 cols) */}
            <div className="lg:col-span-2 space-y-4">
              <p className="mb-4 text-xs font-black uppercase tracking-[0.2em] text-emerald-400">
                Headquarters
              </p>
              <div className="space-y-3 text-xs text-slate-400">
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>{address}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-emerald-400 shrink-0" />
                  <a href={`tel:${phone}`} className="hover:text-white font-bold" dir="ltr">
                    +966 59 391 4916
                  </a>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-emerald-400 shrink-0" />
                  <a href={`mailto:${email}`} className="hover:text-white">
                    {email}
                  </a>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span>Sun–Thu: 9AM – 6PM</span>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={openTrial}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-black text-white shadow-lg shadow-emerald-600/30 hover:bg-emerald-500 transition-all hover:-translate-y-0.5"
                >
                  <span>Start Free Trial</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Bottom Bar with Copyright and Accepted Payments */}
          <div className="mt-16 border-t border-slate-800/80 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
            <div>
              © {new Date().getFullYear()} Maqder ERP. All rights reserved. Built with precision for growing businesses.
            </div>

            <div className="flex items-center gap-3 text-slate-400 font-bold">
              <span>🇸🇦 KSA</span>
              <span>•</span>
              <span>Mada</span>
              <span>•</span>
              <span>Visa</span>
              <span>•</span>
              <span>Mastercard</span>
              <span>•</span>
              <span>Apple Pay</span>
              <span>•</span>
              <span>Tabby</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
