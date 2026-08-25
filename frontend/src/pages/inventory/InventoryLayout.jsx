import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { motion } from 'framer-motion'
import { Package } from 'lucide-react'
import { INV_NAV } from './inventoryUi'

export default function InventoryLayout() {
  const { language } = useSelector((s) => s.ui)
  const navigate = useNavigate()

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
          <nav className="flex flex-wrap gap-1 px-2">
            {INV_NAV.map((item) => (
              <NavLink
                key={item.id}
                to={item.path}
                end={item.end}
                className={({ isActive }) =>
                  `relative px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive
                      ? 'text-primary-700 dark:text-primary-300'
                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {language === 'ar' ? item.ar : item.en}
                    {isActive && (
                      <motion.span
                        layoutId="invNavUnderline"
                        className="absolute inset-x-1 bottom-0 h-0.5 rounded-full bg-primary-500"
                      />
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </nav>
        </div>
      </div>
      <div className="px-1 py-6">
        <Outlet context={{ navigate, language }} />
      </div>
    </div>
  )
}
