import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useSelector } from 'react-redux'

const TABS = [
  { to: '/app/dashboard/customers', end: true, en: 'Customers', ar: 'العملاء' },
  { to: '/app/dashboard/customers/statement', en: 'Statements', ar: 'كشوف الحساب' },
]

export default function CustomersLayout() {
  const { language } = useSelector((state) => state.ui)
  const { pathname } = useLocation()

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-1 rounded-2xl border border-slate-200/80 bg-white p-1.5 shadow-[0_12px_32px_-28px_rgba(15,23,42,0.4)] dark:border-white/10 dark:bg-[#0c111a]">
        {TABS.map((tab) => {
          const active = tab.end
            ? pathname === tab.to
            : pathname === tab.to || pathname.startsWith(`${tab.to}`) || /\/customers\/[^/]+\/statement$/.test(pathname)
          return (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={Boolean(tab.end)}
              className={`rounded-xl px-4 py-2 text-[13px] font-medium transition ${
                active
                  ? 'bg-teal-700 text-white shadow-sm dark:bg-teal-500 dark:text-slate-950'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/[0.04]'
              }`}
            >
              {language === 'ar' ? tab.ar : tab.en}
            </NavLink>
          )
        })}
      </div>
      <Outlet />
    </div>
  )
}
