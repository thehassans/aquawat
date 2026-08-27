import { NavLink, Outlet, useLocation, Link } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { Users, FileSpreadsheet, Contact } from 'lucide-react'

const TABS = [
  { to: '/app/dashboard/contacts?types=customer,supplier', end: false, en: 'Partners', ar: 'الشركاء', icon: Contact, external: true },
  { to: '/app/dashboard/customers', end: true, en: 'Customer Directory', ar: 'دليل العملاء', icon: Users },
  { to: '/app/dashboard/customers/statement', en: 'Account Statements', ar: 'كشوفات الحساب', icon: FileSpreadsheet },
]

export default function CustomersLayout() {
  const { language } = useSelector((state) => state.ui)
  const { pathname } = useLocation()
  const isAr = language === 'ar'

  return (
    <div className="space-y-6">
      {/* Top Floating Glass Minimalist Navigation Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 pb-4 dark:border-white/10">
        <div className="inline-flex items-center gap-1.5 rounded-2xl border border-slate-200/90 bg-slate-100/80 p-1.5 shadow-2xs backdrop-blur-md dark:border-white/10 dark:bg-dark-800/80">
          {TABS.map((tab) => {
            const Icon = tab.icon
            if (tab.external) {
              return (
                <Link
                  key={tab.to}
                  to={tab.to}
                  className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold text-slate-600 transition-all duration-200 hover:bg-white/60 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white"
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{isAr ? tab.ar : tab.en}</span>
                </Link>
              )
            }
            const active = tab.end
              ? pathname === tab.to
              : pathname === tab.to || pathname.startsWith(`${tab.to}`) || /\/customers\/[^/]+\/statement$/.test(pathname)
            return (
              <NavLink
                key={tab.to}
                to={tab.to}
                end={Boolean(tab.end)}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all duration-200 ${
                  active
                    ? 'bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-950'
                    : 'text-slate-600 hover:bg-white/60 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{isAr ? tab.ar : tab.en}</span>
              </NavLink>
            )
          })}
        </div>

        <div className="hidden items-center gap-2 text-xs text-slate-500 sm:flex dark:text-slate-400">
          <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-medium">
            {isAr ? 'قاعدة بيانات العملاء المتزامنة' : 'Live Sync Customer Registry'}
          </span>
        </div>
      </div>

      <Outlet />
    </div>
  )
}
