import { Link, Outlet, useLocation } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { INVENTORY_PATH } from './inventoryUi'

const SUB = [
  { to: INVENTORY_PATH.products, en: 'Templates', ar: 'القوالب', match: 'templates' },
  { to: INVENTORY_PATH.variants, en: 'Variants', ar: 'المتغيرات', match: 'variants' },
  { to: INVENTORY_PATH.lots, en: 'Lots / Serials', ar: 'الدفعات / التسلسل', match: 'lots' },
  { to: INVENTORY_PATH.packages, en: 'Packages', ar: 'الطرود', match: 'packages' },
  { to: INVENTORY_PATH.movesHistory, en: 'Moves History', ar: 'سجل الحركات', match: 'moves' },
]

function tabActive(pathname, tab) {
  if (tab.match === 'templates') {
    return pathname === INVENTORY_PATH.products
      || (/\/products\/[a-f0-9]{24}$/i.test(pathname) && !pathname.includes('/lots/'))
  }
  if (tab.match === 'variants') return pathname.startsWith(INVENTORY_PATH.variants)
  if (tab.match === 'lots') return pathname.startsWith(INVENTORY_PATH.lots)
  if (tab.match === 'packages') return pathname.startsWith(INVENTORY_PATH.packages)
  if (tab.match === 'moves') return pathname.startsWith(INVENTORY_PATH.movesHistory)
  return pathname.startsWith(tab.to)
}

export default function ProductsHub() {
  const { language } = useSelector((state) => state.ui)
  const { pathname } = useLocation()
  const isAr = language === 'ar'

  const isFormOrDetail = pathname.endsWith('/new')
    || /\/products\/[a-f0-9]{24}$/i.test(pathname)
    || /\/products\/lots\/[a-f0-9]{24}$/i.test(pathname)

  return (
    <div className="w-full space-y-6">
      {!isFormOrDetail && (
        <>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
              {isAr ? 'المنتجات' : 'Products'}
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {isAr ? 'قوالب المنتجات والمتغيرات' : 'Stock product templates & variants'}
            </p>
          </div>
          <nav className="flex gap-1 overflow-x-auto rounded-2xl border border-slate-200/80 bg-slate-50/80 p-1.5 dark:border-white/10 dark:bg-white/[0.03]">
            {SUB.map((tab) => {
              const active = tabActive(pathname, tab)
              return (
                <Link
                  key={tab.to}
                  to={tab.to}
                  className={`whitespace-nowrap rounded-xl px-3.5 py-2 text-[13px] font-medium transition ${
                    active
                      ? 'bg-white text-teal-800 shadow-sm dark:bg-teal-500/15 dark:text-teal-200'
                      : 'text-slate-600 hover:bg-white/70 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white'
                  }`}
                >
                  {isAr ? tab.ar : tab.en}
                </Link>
              )
            })}
          </nav>
        </>
      )}
      <Outlet />
    </div>
  )
}
