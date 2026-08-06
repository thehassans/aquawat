import { Outlet, Link, useLocation } from 'react-router-dom'
import { useMemo, useState, Suspense } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Globe, Menu, X, Phone, Mail, MapPin } from 'lucide-react'
import { useSelector, useDispatch } from 'react-redux'
import { setLanguage } from '../store/slices/uiSlice'
import { usePublicWebsiteSettings } from '../lib/website'
import PageLoader from '../components/ui/PageLoader'

function WhatsAppIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.945C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 018.413 3.488 11.824 11.824 0 013.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.866 9.866 0 001.519 5.256l-.999 3.648 3.74-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.096 3.2 5.077 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413z"/>
    </svg>
  )
}

export default function MarketingLayout() {
  const location = useLocation()
  const dispatch = useDispatch()
  const { language } = useSelector((state) => state.ui)
  const { data } = usePublicWebsiteSettings()
  const [open, setOpen] = useState(false)

  const isArabic = language === 'ar'

  const navItems = useMemo(
    () => [
      { to: '/', labelEn: 'Home', labelAr: 'الرئيسية' },
      { to: '/solutions', labelEn: 'Solutions', labelAr: 'الحلول' },
      { to: '/pricing', labelEn: 'Pricing', labelAr: 'الأسعار' },
      { to: '/about', labelEn: 'About', labelAr: 'من نحن' },
      { to: '/contact', labelEn: 'Contact', labelAr: 'تواصل معنا' },
    ],
    []
  )

  const phone = data?.contactPhone || '+966596775485'
  const whatsappNumber = phone.replace(/\D/g, '')

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8faf7_0%,#f4f8f4_40%,#ffffff_100%)] text-slate-900" dir={isArabic ? 'rtl' : 'ltr'}>
      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="h-28 flex items-center justify-between gap-3">
            <Link to="/" className="flex items-center gap-3">
              <div className="w-full h-24 flex items-center justify-center flex-shrink-0">
                <img src="/maqderlogolandingpage.webp" alt="Maqder" className="h-full w-auto object-contain" />
              </div>
            </Link>

            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
                const active = location.pathname === item.to
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition ${active ? 'bg-emerald-50 text-emerald-800' : 'text-slate-600 hover:text-slate-950 hover:bg-slate-100'}`}
                  >
                    {isArabic ? item.labelAr : item.labelEn}
                  </Link>
                )
              })}
            </nav>

            <div className="flex items-center gap-2">
              <a
                href={`https://wa.me/${whatsappNumber}`}
                target="_blank"
                rel="noreferrer"
                title={`WhatsApp ${phone}`}
                aria-label="WhatsApp"
                className="group hidden sm:inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#25D366]/10 text-[#1da851] ring-1 ring-[#25D366]/20 transition-all hover:bg-[#25D366] hover:text-white hover:ring-[#25D366] hover:shadow-lg hover:shadow-[#25D366]/30"
              >
                <WhatsAppIcon className="h-[18px] w-[18px]" />
              </a>

              <a
                href={`tel:${phone.replace(/\s+/g, '')}`}
                title={phone}
                aria-label={`Call ${phone}`}
                className="group hidden sm:inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-600/10 text-emerald-700 ring-1 ring-emerald-600/20 transition-all hover:bg-emerald-600 hover:text-white hover:ring-emerald-600 hover:shadow-lg hover:shadow-emerald-600/30"
              >
                <Phone className="h-[18px] w-[18px]" />
              </a>

              <span className="hidden lg:block h-6 w-px bg-slate-200" />

              <button
                onClick={() => dispatch(setLanguage(isArabic ? 'en' : 'ar'))}
                aria-label="Toggle language"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
              >
                <Globe className="w-5 h-5" />
              </button>

              <Link
                to="/login"
                className="hidden sm:inline-flex items-center rounded-full bg-gradient-to-r from-[#1f6b43] to-[#155234] px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-900/20 transition-all hover:from-[#185636] hover:to-[#12472d] hover:shadow-xl hover:shadow-emerald-900/30 hover:-translate-y-0.5"
              >
                {isArabic ? 'تسجيل الدخول' : 'Login'}
              </Link>

              <button
                onClick={() => setOpen((v) => !v)}
                className="md:hidden rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
              >
                {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="md:hidden border-t border-slate-200 bg-white"
            >
              <div className="max-w-7xl mx-auto px-4 py-4 space-y-2">
                {navItems.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setOpen(false)}
                    className="block rounded-xl px-3 py-2 text-slate-600 transition hover:bg-slate-100 hover:text-slate-950"
                  >
                    {isArabic ? item.labelAr : item.labelEn}
                  </Link>
                ))}
                <Link
                  to="/login"
                  onClick={() => setOpen(false)}
                  className="block rounded-xl bg-gradient-to-r from-[#1f6b43] to-[#155234] px-4 py-2 text-center font-semibold text-white"
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

      <footer className="border-t border-slate-200 bg-white/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="w-auto h-20 flex items-center justify-start">
                <img src="/maqderlogolandingpage.webp" alt="Maqder" className="h-full w-auto object-contain" />
              </div>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">
                {isArabic
                  ? 'منصة ERP متكاملة للشركات السعودية مع امتثال كامل لهيئة الزكاة والضريبة والجمارك.'
                  : 'A complete ERP platform for Saudi businesses with full ZATCA compliance.'}
              </p>
            </div>

            <div>
              <div className="mb-3 font-semibold text-slate-900">{isArabic ? 'الروابط' : 'Links'}</div>
              <div className="space-y-2 text-sm">
                <Link to="/pricing" className="block text-slate-500 transition hover:text-slate-950">{isArabic ? 'الأسعار' : 'Pricing'}</Link>
                <Link to="/about" className="block text-slate-500 transition hover:text-slate-950">{isArabic ? 'من نحن' : 'About'}</Link>
                <Link to="/contact" className="block text-slate-500 transition hover:text-slate-950">{isArabic ? 'تواصل معنا' : 'Contact'}</Link>
              </div>
            </div>

            <div>
              <div className="mb-3 font-semibold text-slate-900">{isArabic ? 'قانوني' : 'Legal'}</div>
              <div className="space-y-2 text-sm">
                <Link to="/privacy" className="block text-slate-500 transition hover:text-slate-950">{isArabic ? 'سياسة الخصوصية' : 'Privacy'}</Link>
                <Link to="/terms" className="block text-slate-500 transition hover:text-slate-950">{isArabic ? 'الشروط' : 'Terms'}</Link>
              </div>
            </div>

            <div>
              <div className="mb-3 font-semibold text-slate-900">{isArabic ? 'تواصل' : 'Contact'}</div>
              <div className="space-y-2 text-sm text-slate-500">
                <div>{phone}</div>
                <div>{data?.contactEmail || 'info@maqder.com'}</div>
                <div>{isArabic ? data?.contactAddressAr : data?.contactAddressEn}</div>
              </div>
            </div>
          </div>

          <div className="mt-10 flex flex-col justify-between gap-3 border-t border-slate-200 pt-6 text-xs text-slate-400 sm:flex-row">
            <div> {new Date().getFullYear()} {data?.brandName || 'Maqder ERP'}</div>
            <div>{isArabic ? 'جميع الحقوق محفوظة' : 'All rights reserved'}</div>
          </div>
        </div>
      </footer>
    </div>
  )
}
