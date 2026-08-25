import { useMemo, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { ChevronDown, Package } from 'lucide-react'
import { INV_NAV_MORE, INV_NAV_PRIMARY } from './inventoryUi'

function tabClass(isActive) {
  return `relative px-3 py-2.5 text-sm font-medium transition-colors ${
    isActive
      ? 'text-primary-700 after:absolute after:inset-x-1 after:bottom-0 after:h-0.5 after:rounded-full after:bg-primary-500 dark:text-primary-300'
      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'
  }`
}

export default function InventoryLayout() {
  const { language } = useSelector((s) => s.ui)
  const navigate = useNavigate()
  const location = useLocation()
  const [moreOpen, setMoreOpen] = useState(false)

  const moreActive = useMemo(
    () => INV_NAV_MORE.some((item) => location.pathname === item.path || location.pathname.startsWith(`${item.path}/`)),
    [location.pathname],
  )

  return (
    <div className="min-h-[calc(100vh-4rem)]">
      <div className="border-b border-slate-200/80 bg-white/80 backdrop-blur-sm dark:border-dark-600 dark:bg-dark-900/80">
        <div className="flex flex-wrap items-end justify-between gap-4 px-1 pb-0 pt-2">
          <div className="flex items-center gap-3 px-3 pb-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-500/10 text-primary-600 dark:text-primary-400">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white">
                {language === 'ar' ? 'المخزون' : 'Inventory'}
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {language === 'ar' ? 'حركات ومواقع وكميات' : 'Moves, locations, and on-hand'}
              </p>
            </div>
          </div>
          <nav className="flex flex-wrap items-center gap-1 px-2">
            {INV_NAV_PRIMARY.map((item) => (
              <NavLink key={item.id} to={item.path} end={item.end} className={({ isActive }) => tabClass(isActive)}>
                {language === 'ar' ? item.ar : item.en}
              </NavLink>
            ))}
            <div className="relative">
              <button
                type="button"
                className={`${tabClass(moreActive)} inline-flex items-center gap-1`}
                onClick={() => setMoreOpen((v) => !v)}
                aria-expanded={moreOpen}
              >
                {language === 'ar' ? 'المزيد' : 'More'}
                <ChevronDown className={`h-3.5 w-3.5 transition ${moreOpen ? 'rotate-180' : ''}`} />
              </button>
              {moreOpen && (
                <>
                  <button type="button" className="fixed inset-0 z-20 cursor-default" aria-label="Close" onClick={() => setMoreOpen(false)} />
                  <div className="absolute end-0 z-30 mt-1 min-w-[11rem] overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg dark:border-dark-600 dark:bg-dark-800">
                    {INV_NAV_MORE.map((item) => (
                      <NavLink
                        key={item.id}
                        to={item.path}
                        onClick={() => setMoreOpen(false)}
                        className={({ isActive }) =>
                          `block px-3 py-2 text-sm ${
                            isActive
                              ? 'bg-primary-50 font-medium text-primary-700 dark:bg-primary-950/40 dark:text-primary-300'
                              : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-dark-700'
                          }`
                        }
                      >
                        {language === 'ar' ? item.ar : item.en}
                      </NavLink>
                    ))}
                  </div>
                </>
              )}
            </div>
          </nav>
        </div>
      </div>
      <div className="px-1 py-6">
        <Outlet context={{ navigate, language }} />
      </div>
    </div>
  )
}
