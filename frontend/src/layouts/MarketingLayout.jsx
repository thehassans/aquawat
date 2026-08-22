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
  ArrowRight,
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
              title="Chat on WhatsApp (+966 59 391 4916)"
            >
              <WAIcon className="h-5 w-5" />
            </a>

            <a
              href={`tel:${phone}`}
              aria-label="Call Direct"
              className="hidden h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-700 ring-1 ring-slate-200 transition-all hover:bg-slate-200 sm:inline-flex shadow-sm"
              title="Call +966 59 391 4916"
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

      {/* ── ULTRA MINIMALISTIC LIGHT THEMED PREMIUM FOOTER ── */}
      <footer className="border-t border-slate-200/80 bg-white text-slate-600 antialiased">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-12">
            {/* Brand & Bio (4 cols) */}
            <div className="lg:col-span-4 space-y-5">
              <Link to="/" className="inline-block">
                <img src="/maqderlogolandingpage.webp" alt="Maqder" className="h-16 w-auto object-contain" />
              </Link>
              <p className="text-sm leading-relaxed text-slate-500 max-w-sm">
                Unified modern cloud ERP built for high-growth businesses. Connecting e-invoicing, HR, payroll, inventory, and point of sale into one seamless experience.
              </p>
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <span>All systems operational · 99.99% uptime</span>
              </div>
            </div>

            {/* Product & Solutions (3 cols) */}
            <div className="lg:col-span-3">
              <p className="mb-4 text-xs font-black uppercase tracking-[0.2em] text-slate-400">
                Product & Solutions
              </p>
              <ul className="space-y-2.5 text-sm">
                <li>
                  <Link to="/solutions" className="text-slate-600 hover:text-emerald-700 transition font-medium">
                    ZATCA Phase 2 E-Invoicing
                  </Link>
                </li>
                <li>
                  <Link to="/solutions" className="text-slate-600 hover:text-emerald-700 transition font-medium">
                    HR, Payroll & WPS GOSI
                  </Link>
                </li>
                <li>
                  <Link to="/solutions" className="text-slate-600 hover:text-emerald-700 transition font-medium">
                    Inventory & Multi-Warehouse
                  </Link>
                </li>
                <li>
                  <Link to="/solutions" className="text-slate-600 hover:text-emerald-700 transition font-medium">
                    Cloud POS & Kitchen KDS
                  </Link>
                </li>
                <li>
                  <Link to="/solutions" className="text-slate-600 hover:text-emerald-700 transition font-medium">
                    Accounting & General Ledger
                  </Link>
                </li>
              </ul>
            </div>

            {/* Company & Legal (2 cols) */}
            <div className="lg:col-span-2">
              <p className="mb-4 text-xs font-black uppercase tracking-[0.2em] text-slate-400">
                Company
              </p>
              <ul className="space-y-2.5 text-sm">
                <li>
                  <Link to="/about" className="text-slate-600 hover:text-emerald-700 transition font-medium">
                    About Us
                  </Link>
                </li>
                <li>
                  <Link to="/pricing" className="text-slate-600 hover:text-emerald-700 transition font-medium">
                    Pricing & Plans
                  </Link>
                </li>
                <li>
                  <Link to="/contact" className="text-slate-600 hover:text-emerald-700 transition font-medium">
                    Contact & Support
                  </Link>
                </li>
                <li>
                  <Link to="/privacy" className="text-slate-600 hover:text-emerald-700 transition font-medium">
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link to="/terms" className="text-slate-600 hover:text-emerald-700 transition font-medium">
                    Terms of Service
                  </Link>
                </li>
              </ul>
            </div>

            {/* Direct Contact (3 cols) */}
            <div className="lg:col-span-3 space-y-3">
              <p className="mb-4 text-xs font-black uppercase tracking-[0.2em] text-slate-400">
                Contact & Support
              </p>
              <div className="space-y-2.5 text-sm text-slate-600">
                <a
                  href={`tel:${phone}`}
                  className="flex items-center gap-2.5 font-bold text-slate-900 hover:text-emerald-700 transition"
                  dir="ltr"
                >
                  <Phone className="h-4 w-4 text-emerald-600" />
                  <span>+966 59 391 4916</span>
                </a>
                <a
                  href={`https://wa.me/${waNumber}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2.5 font-bold text-slate-900 hover:text-[#25D366] transition"
                >
                  <WAIcon className="h-4 w-4 text-[#25D366]" />
                  <span>WhatsApp: +966 59 391 4916</span>
                </a>
                <a
                  href={`mailto:${email}`}
                  className="flex items-center gap-2.5 text-slate-500 hover:text-slate-900 transition"
                >
                  <Mail className="h-4 w-4 text-slate-400" />
                  <span>{email}</span>
                </a>
                <div className="flex items-start gap-2.5 text-xs text-slate-500 pt-1">
                  <MapPin className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                  <span>{address}</span>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={openTrial}
                  className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-5 py-2 text-xs font-bold text-emerald-800 transition hover:bg-emerald-100 hover:border-emerald-300"
                >
                  <span>Start 7-Day Free Trial</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Minimalist Bottom Bar */}
          <div className="mt-14 border-t border-slate-100 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400 font-medium">
            <div>
              © {new Date().getFullYear()} Maqder ERP. All rights reserved.
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-slate-500">
              <span className="font-semibold text-emerald-800">🇸🇦 ZATCA Phase 2 Certified</span>
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
