import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { LayoutGrid, ArrowUpRight } from 'lucide-react'
import App3DIcon from '../ui/App3DIcon'
import { setAppLauncherOpen, setHideSidebar, setMobileMenuOpen, setNavigationStyle } from '../../store/slices/uiSlice'
import { getRecentApps, pushRecentApp, labelForAppPath } from '../../lib/recentApps'

/**
 * Top-left recent-apps dropdown — ultra-minimal, with one-click open to full app navbar.
 */
export default function RecentAppsMenu() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const location = useLocation()
  const { language } = useSelector((s) => s.ui)
  const { tenant } = useSelector((s) => s.auth)
  const isAr = language === 'ar'
  const tenantId = tenant?._id
  const buttonRef = useRef(null)
  const panelRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [tick, setTick] = useState(0)

  const recent = useMemo(
    () => getRecentApps(tenantId, { language, limit: 6 }),
    [tenantId, language, tick, location.pathname],
  )

  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    const onPointer = (e) => {
      const t = e.target
      if (buttonRef.current?.contains(t) || panelRef.current?.contains(t)) return
      setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onPointer)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onPointer)
    }
  }, [open])

  const openFullNavbar = () => {
    setOpen(false)
    dispatch(setNavigationStyle({ tenantId, style: 'launcher' }))
    dispatch(setHideSidebar(true))
    dispatch(setMobileMenuOpen(false))
    dispatch(setAppLauncherOpen(true))
  }

  const openApp = (app) => {
    const path = app.path || '/app/dashboard'
    pushRecentApp(tenantId, {
      path,
      labelEn: app.labelEn,
      labelAr: app.labelAr,
    })
    setTick((n) => n + 1)
    setOpen(false)
    navigate(path)
  }

  const panelPosition = (() => {
    const rect = buttonRef.current?.getBoundingClientRect()
    if (!rect) return { top: 64, left: 16 }
    const rtl = document.documentElement.dir === 'rtl'
    const top = Math.min(rect.bottom + 8, window.innerHeight - 24)
    if (rtl) {
      return { top, right: Math.max(12, window.innerWidth - rect.right) }
    }
    return { top, left: Math.max(12, rect.left) }
  })()

  const panel = createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          key="recent-apps-menu"
          ref={panelRef}
          role="menu"
          aria-label={isAr ? 'التطبيقات الأخيرة' : 'Recent apps'}
          initial={{ opacity: 0, y: 6, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 4, scale: 0.99 }}
          transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
          className="fixed z-[80] w-[min(17.5rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-slate-200/70 bg-white/95 shadow-[0_20px_50px_-28px_rgba(15,23,42,0.45)] backdrop-blur-xl dark:border-white/[0.08] dark:bg-[#12161d]/95 dark:shadow-[0_24px_60px_-24px_rgba(0,0,0,0.8)]"
          style={panelPosition}
        >
          <div className="flex items-baseline justify-between gap-3 px-3.5 pb-1 pt-3.5">
            <p className="text-[11px] font-medium tracking-wide text-slate-400 dark:text-slate-500">
              {isAr ? 'الأخيرة' : 'Recent'}
            </p>
            <span className="text-[10px] tabular-nums text-slate-300 dark:text-slate-600">
              {recent.filter((a) => !a.isSeed).length || recent.length}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-0.5 px-2 pb-2 pt-1">
            {recent.map((app, index) => {
              const label = isAr
                ? (app.labelAr || app.labelEn)
                : (app.labelEn || app.labelAr || labelForAppPath(app.path, language))
              return (
                <button
                  key={`${app.path}-${index}`}
                  type="button"
                  role="menuitem"
                  onClick={() => openApp(app)}
                  className="group flex flex-col items-center gap-1.5 rounded-xl px-1.5 py-2.5 text-center transition-colors hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30 dark:hover:bg-white/[0.04]"
                >
                  <App3DIcon
                    path={app.path}
                    label={label}
                    className="h-9 w-9 transition duration-200 group-hover:-translate-y-0.5"
                  />
                  <span className="line-clamp-1 max-w-[4.4rem] text-[10px] font-medium leading-tight text-slate-500 group-hover:text-slate-800 dark:text-slate-400 dark:group-hover:text-slate-100">
                    {label}
                  </span>
                </button>
              )
            })}
          </div>

          <div className="border-t border-slate-100 px-2 py-2 dark:border-white/[0.06]">
            <button
              type="button"
              role="menuitem"
              onClick={openFullNavbar}
              className="group flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-start transition-colors hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30 dark:hover:bg-white/[0.04]"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white dark:bg-white dark:text-slate-900">
                <LayoutGrid className="h-3.5 w-3.5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[12px] font-semibold tracking-tight text-slate-900 dark:text-white">
                  {isAr ? 'كل التطبيقات' : 'All apps'}
                </span>
                <span className="block text-[10px] text-slate-400 dark:text-slate-500">
                  {isAr ? 'فتح قائمة التطبيقات' : 'Open app navbar'}
                </span>
              </span>
              <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-slate-500 dark:text-slate-600 dark:group-hover:text-slate-400" />
            </button>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  )

  return (
    <Fragment>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`relative rounded-xl p-2 transition-colors ${
          open
            ? 'bg-slate-100 text-slate-900 ring-1 ring-slate-200/80 dark:bg-white/10 dark:text-white dark:ring-white/10'
            : 'hover:bg-gray-100 dark:hover:bg-dark-700'
        }`}
        title={isAr ? 'التطبيقات الأخيرة' : 'Recent apps'}
      >
        <LayoutGrid className={`h-5 w-5 ${open ? '' : 'text-gray-600 dark:text-gray-400'}`} />
      </button>
      {panel}
    </Fragment>
  )
}
