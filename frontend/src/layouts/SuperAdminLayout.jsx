import { Outlet, NavLink, useLocation } from 'react-router-dom'
import { Suspense, useState } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { 
  LayoutDashboard, 
  Building2, 
  Users, 
  Settings, 
  Mail,
  Inbox,
  ShieldCheck,
  LogOut,
  Moon,
  Sun,
  Globe,
  Smartphone,
  HelpCircle,
  Store,
  ChevronDown,
  Monitor,
  CreditCard,
  Crown,
  Target
} from 'lucide-react'
import { logout } from '../store/slices/authSlice'
import { setTheme, setLanguage } from '../store/slices/uiSlice'
import { useTranslation } from '../lib/translations'
import LoadingScreen from '../components/ui/LoadingScreen'

export default function SuperAdminLayout() {
  const dispatch = useDispatch()
  const location = useLocation()
  const { theme, language } = useSelector((state) => state.ui)
  const { t } = useTranslation(language)

  const primaryNavItems = [
    { path: '/super-admin', icon: LayoutDashboard, label: t('dashboard'), end: true },
    { path: '/super-admin/tenants', icon: Building2, label: t('tenants') },
    { path: '/super-admin/pos-sessions', icon: Monitor, label: language === 'ar' ? 'جلسات نقاط البيع' : 'POS Sessions' },
    { path: '/super-admin/resellers', icon: Store, label: language === 'ar' ? 'الموزعون' : 'Resellers' },
    { path: '/super-admin/queries', icon: HelpCircle, label: t('queries') },
    { path: '/super-admin/leads', icon: Target, label: language === 'ar' ? 'استخراج العملاء' : 'Leads Generation' },
    { path: '/super-admin/zatca', icon: ShieldCheck, label: 'ZATCA' },
  ]

  const moreNavItems = [
    { path: '/super-admin/demo-users', icon: Crown, label: language === 'ar' ? 'مستخدمو التجربة' : 'Demo Users' },
    { path: '/super-admin/payment-settings', icon: CreditCard, label: language === 'ar' ? 'إعدادات الدفع' : 'Payment Settings' },
    { path: '/super-admin/website', icon: Globe, label: t('websiteSettings') },
    { path: '/super-admin/email', icon: Mail, label: t('email') },
    { path: '/super-admin/mailbox', icon: Inbox, label: t('mailbox') },
    { path: '/super-admin/whatsapp', icon: Smartphone, label: t('whatsapp') },
    { path: '/super-admin/identity', icon: ShieldCheck, label: t('identitySettings') },
    { path: '/super-admin/gemini', icon: Settings, label: t('geminiSettings') },
    { path: '/super-admin/system-settings', icon: Settings, label: t('systemSettings') },
  ]

  const [moreOpen, setMoreOpen] = useState(false)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-900">
      {/* Top Header */}
      <header className="sticky top-0 z-50 bg-[#1a3d28] text-white">
        <div className="flex items-center justify-between px-6 h-16">
          <div className="flex items-center gap-6">
            <img src="/maqdernewlogo.webp" alt="Maqder" className="h-14 w-auto object-contain transform scale-150 origin-left" />
            <span className="text-sm font-medium bg-white/20 text-white px-3 py-1 rounded-full whitespace-nowrap ml-8">
              {t('superAdmin')}
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-1">
            {primaryNavItems.map((item) => (
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

            <div className="relative">
              <button
                onClick={() => setMoreOpen(!moreOpen)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  moreOpen || moreNavItems.some(item => location.pathname === item.path || location.pathname.startsWith(item.path + '/'))
                    ? 'bg-white/20 text-white'
                    : 'text-white/70 hover:bg-white/10 hover:text-white'
                }`}
              >
                More
                <ChevronDown className={`w-4 h-4 transition-transform ${moreOpen ? 'rotate-180' : ''}`} />
              </button>
              {moreOpen && (
                <div className="absolute top-full right-0 mt-2 w-56 bg-white dark:bg-dark-800 rounded-xl shadow-xl border border-gray-100 dark:border-dark-700 py-2 z-50">
                  {moreNavItems.map((item) => (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      end={item.end}
                      onClick={() => setMoreOpen(false)}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                          isActive
                            ? 'bg-[#1a3d28]/10 text-[#1a3d28] dark:bg-white/10 dark:text-white font-medium'
                            : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-dark-700'
                        }`
                      }
                    >
                      <item.icon className="w-4 h-4" />
                      {item.label}
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
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

      {/* Main Content */}
      <main className="p-6">
        <Suspense fallback={<LoadingScreen />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  )
}
