import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useState, Suspense } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useDispatch } from 'react-redux'
import { Menu, Phone, X } from 'lucide-react'
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
  const phone = data?.contactPhone || '+966596775485'
  const waNumber = phone.replace(/\D/g, '')

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
    <div className="min-h-screen bg-white text-slate-900 antialiased font-body" dir="ltr" lang="en">
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

          <nav className="hidden items-center gap-0.5 md:flex">
            {navLinks.map((item) => {
              const active = location.pathname === item.to
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`rounded-xl px-3.5 py-2 text-sm font-semibold transition-all ${
                    active ? 'bg-emerald-50 text-emerald-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  {isArabic ? item.labelAr : item.labelEn}
                </Link>
              )
            })}
          </nav>

          <div className="flex items-center gap-2">
            <a
              href={`https://wa.me/${waNumber}`}
              target="_blank"
              rel="noreferrer"
              aria-label="WhatsApp"
              className="hidden h-9 w-9 items-center justify-center rounded-full bg-[#25D366]/10 text-[#1da851] ring-1 ring-[#25D366]/25 transition-all hover:bg-[#25D366] hover:text-white sm:inline-flex"
            >
              <WAIcon className="h-[17px] w-[17px]" />
            </a>
            <a
              href={`tel:${phone.replace(/\s+/g, '')}`}
              aria-label="Call"
              className="hidden h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 ring-1 ring-slate-200 transition-all hover:bg-slate-200 sm:inline-flex"
            >
              <Phone className="h-4 w-4" />
            </a>

            <span className="hidden h-5 w-px bg-slate-200 lg:block" />

            <button
              type="button"
              onClick={openTrial}
              className="hidden rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-700 transition-all hover:-translate-y-0.5 hover:bg-emerald-100 sm:inline-flex"
            >
              Try free
            </button>

            <Link
              to="/login"
              className="hidden items-center rounded-full bg-emerald-600 px-5 py-2 text-sm font-bold text-white shadow-[0_4px_12px_-4px_rgba(5,150,105,0.5)] transition-all hover:-translate-y-0.5 hover:bg-emerald-700 sm:inline-flex"
            >
              Login
            </Link>

            <button
              onClick={() => setMobileOpen((v) => !v)}
              className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 md:hidden"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
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
              <div className="mx-auto max-w-7xl space-y-1 px-4 py-4">
                {navLinks.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileOpen(false)}
                    className={`block rounded-xl px-3 py-2.5 text-sm font-semibold ${
                      location.pathname === item.to ? 'bg-emerald-50 text-emerald-700' : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {isArabic ? item.labelAr : item.labelEn}
                  </Link>
                ))}
                <button
                  type="button"
                  onClick={openTrial}
                  className="mt-2 block w-full rounded-full border border-emerald-200 bg-emerald-50 py-3 text-center text-sm font-bold text-emerald-700"
                >
                  {isArabic ? 'تجربة مجانية' : 'Try free'}
                </button>
                <Link
                  to="/login"
                  onClick={() => setMobileOpen(false)}
                  className="block w-full rounded-full bg-emerald-600 py-3 text-center text-sm font-bold text-white"
                >
                  {isArabic ? 'تسجيل الدخول' : 'Login'}
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <Suspense fallback={<PageLoader />}>
        <Outlet />
      </Suspense>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="grid gap-10 md:grid-cols-4">
            <div>
              <img src="/maqderlogolandingpage.webp" alt="Maqder" className="h-20 w-auto object-contain" />
              <p className="mt-4 text-sm leading-relaxed text-slate-500">
                {isArabic
                  ? 'منصة ERP سحابية متكاملة — مالية وموارد بشرية ومخزون في مكان واحد.'
                  : 'All-in-one cloud ERP — finance, HR, and inventory in one place.'}
              </p>
            </div>
            <div>
              <p className="mb-4 text-xs font-black uppercase tracking-widest text-slate-400">{isArabic ? 'المنتج' : 'Product'}</p>
              <div className="space-y-2.5 text-sm">
                <Link to="/solutions" className="block text-slate-500 hover:text-emerald-600">{isArabic ? 'الحلول' : 'Solutions'}</Link>
                <Link to="/pricing" className="block text-slate-500 hover:text-emerald-600">{isArabic ? 'الأسعار' : 'Pricing'}</Link>
              </div>
            </div>
            <div>
              <p className="mb-4 text-xs font-black uppercase tracking-widest text-slate-400">{isArabic ? 'الشركة' : 'Company'}</p>
              <div className="space-y-2.5 text-sm">
                <Link to="/about" className="block text-slate-500 hover:text-emerald-600">{isArabic ? 'من نحن' : 'About'}</Link>
                <Link to="/contact" className="block text-slate-500 hover:text-emerald-600">{isArabic ? 'تواصل معنا' : 'Contact'}</Link>
                <Link to="/privacy" className="block text-slate-500 hover:text-emerald-600">{isArabic ? 'الخصوصية' : 'Privacy'}</Link>
                <Link to="/terms" className="block text-slate-500 hover:text-emerald-600">{isArabic ? 'الشروط' : 'Terms'}</Link>
              </div>
            </div>
            <div>
              <p className="mb-4 text-xs font-black uppercase tracking-widest text-slate-400">{isArabic ? 'التواصل' : 'Contact'}</p>
              <div className="space-y-2.5 text-sm text-slate-500">
                <p dir="ltr">{phone}</p>
                <p>{data?.contactEmail || 'info@maqder.com'}</p>
              </div>
            </div>
          </div>
          <div className="mt-12 border-t border-slate-100 pt-6 text-xs text-slate-400">
            © {new Date().getFullYear()} {data?.brandName || 'Maqder ERP'}. {isArabic ? 'جميع الحقوق محفوظة.' : 'All rights reserved.'}
          </div>
        </div>
      </footer>
    </div>
  )
}
