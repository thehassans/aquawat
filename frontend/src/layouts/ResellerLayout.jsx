import { Outlet, NavLink } from 'react-router-dom'
import { Suspense } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { logout } from '../store/slices/authSlice'
import { setTheme, setLanguage } from '../store/slices/uiSlice'
import { useTranslation } from '../lib/translations'
import { Building2, LogOut, Moon, Sun, Globe, LayoutDashboard, Users, Settings } from 'lucide-react'
import PageLoader from '../components/ui/PageLoader'

export default function ResellerLayout() {
  const dispatch = useDispatch()
  const { theme, language } = useSelector((state) => state.ui)
  const { t } = useTranslation(language)

  const navItems = [
    { path: '/reseller', icon: LayoutDashboard, label: t('dashboard'), end: true },
    { path: '/reseller/tenants', icon: Users, label: t('tenants') },
    { path: '/reseller/leads', icon: Globe, label: language === 'ar' ? 'جلب العملاء' : 'Leads Gen' },
    { path: '/reseller/lead-setup', icon: Settings, label: language === 'ar' ? 'إعدادات العملاء' : 'Lead Setup' },
  ]

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-900">
      <header className="sticky top-0 z-50 bg-[#1a3d28] text-white">
        <div className="flex items-center justify-between px-6 h-16">
          <div className="flex items-center gap-6">
            <img src="/maqdermainloo.png" alt="Maqder" className="h-10 w-auto object-contain bg-white/90 px-2 py-1 rounded-xl" />
            <span className="text-sm font-medium bg-white/20 text-white px-3 py-1 rounded-full whitespace-nowrap">
              {language === 'ar' ? 'لوحة الموزع' : 'Reseller Panel'}
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : 'text-white/70 hover:bg-white/10 hover:text-white'
                  }`
                }
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <button
              onClick={() => dispatch(setLanguage(language === 'en' ? 'ar' : 'en'))}
              className="p-2 rounded-lg text-white/70 hover:bg-white/10 hover:text-white transition-colors"
            >
              <Globe className="w-5 h-5" />
            </button>
            <button
              onClick={() => dispatch(setTheme(theme === 'dark' ? 'light' : 'dark'))}
              className="p-2 rounded-lg text-white/70 hover:bg-white/10 hover:text-white transition-colors"
            >
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <div className="w-px h-6 bg-white/20" />
            <button
              onClick={() => dispatch(logout())}
              className="p-2 rounded-lg text-gray-300 hover:bg-red-500/20 hover:text-red-400 transition-colors"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="p-6">
        <Suspense fallback={<PageLoader />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  )
}
