import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, LayoutGrid, X } from 'lucide-react'
import App3DIcon from '../ui/App3DIcon'
import { setAppLauncherOpen, setHideSidebar, setMobileMenuOpen, setNavigationStyle } from '../../store/slices/uiSlice'
import { getRecentApps, pushRecentApp, labelForAppPath } from '../../lib/recentApps'

/**
 * Ultra-minimal recent-apps dropdown — vertical list of the last 3 apps.
 * `variant="launcher"` replaces the App Launcher close (X) control.
 */
export default function RecentAppsMenu({ variant = 'header' }) {
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
  const inLauncher = variant === 'launcher'

  const recent = useMemo(
    () => getRecentApps(tenantId, { language, limit: 3 }),
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

  const closeLauncher = () => {
    setOpen(false)
    dispatch(setAppLauncherOpen(false))
  }

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
    if (inLauncher) dispatch(setAppLauncherOpen(false))
    navigate(path)
  }

  const panelPosition = (() => {
    const rect = buttonRef.current?.getBoundingClientRect()
    if (!rect) return { top: 64, left: 16 }
    const rtl = document.documentElement.dir === 'rtl'
    const top = Math.min(rect.bottom + 10, window.innerHeight - 24)
    if (rtl) {
      return { top, right: Math.max(12, window.innerWidth - rect.right) }
    }
    return { top, left: Math.max(12, rect.left) }
  })()

  const triggerClass = inLauncher
    ? `inline-flex h-10 items-center gap-1.5 rounded-2xl border px-2.5 transition-all ${
        open
          ? 'border-slate-300 bg-slate-50 text-slate-900 shadow-sm dark:border-white/15 dark:bg-white/[0.08] dark:text-white'
          : 'border-slate-200/80 bg-white text-slate-600 shadow-sm hover:border-slate-300 hover:text-slate-900 dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white'
      }`
    : `relative inline-flex items-center gap-1 rounded-xl p-2 transition-colors ${
        open
          ? 'bg-slate-100 text-slate-900 ring-1 ring-slate-200/80 dark:bg-white/10 dark:text-white dark:ring-white/10'
          : 'hover:bg-gray-100 dark:hover:bg-dark-700'
      }`

  const panel = createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          key={`recent-apps-${variant}`}
          ref={panelRef}
          role="menu"
          aria-label={isAr ? 'التطبيقات الأخيرة' : 'Recent apps'}
          initial={{ opacity: 0, y: 8, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 4, scale: 0.99 }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="fixed z-[130] w-[min(15.5rem,calc(100vw-1.5rem))] overflow-hidden rounded-[1.35rem] border border-slate-200/60 bg-white/95 shadow-[0_28px_70px_-36px_rgba(15,23,42,0.55)] backdrop-blur-2xl dark:border-white/[0.08] dark:bg-[#0f1319]/96 dark:shadow-[0_28px_70px_-28px_rgba(0,0,0,0.85)]"
          style={panelPosition}
        >
          <div className="border-b border-slate-100/90 px-2 pb-2 pt-2 dark:border-white/[0.06]">
            {inLauncher ? (
              <button
                type="button"
                role="menuitem"
                onClick={closeLauncher}
                className="group flex w-full items-center gap-3 rounded-2xl px-2.5 py-2.5 text-start transition-colors hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/25 dark:hover:bg-white/[0.045]"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 dark:bg-white/[0.06] dark:text-slate-400">
                  <X className="h-3.5 w-3.5" strokeWidth={2} />
                </span>
                <span className="text-[13px] font-semibold tracking-tight text-slate-600 dark:text-slate-300">
                  {isAr ? 'إغلاق القائمة' : 'Close launcher'}
                </span>
              </button>
            ) : (
              <button
                type="button"
                role="menuitem"
                onClick={openFullNavbar}
                className="group flex w-full items-center gap-3 rounded-2xl px-2.5 py-2.5 text-start transition-colors hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/25 dark:hover:bg-white/[0.045]"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900">
                  <LayoutGrid className="h-3.5 w-3.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-semibold tracking-tight text-slate-900 dark:text-white">
                    {isAr ? 'كل التطبيقات' : 'All apps'}
                  </span>
                  <span className="block text-[10px] text-slate-400 dark:text-slate-500">
                    {isAr ? 'فتح قائمة التطبيقات' : 'Open app navbar'}
                  </span>
                </span>
              </button>
            )}
          </div>

          <div className="px-4 pb-1 pt-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
              {isAr ? 'الأخيرة' : 'Recent'}
            </p>
          </div>

          <div className="flex flex-col gap-0.5 px-2 pb-2 pt-1">
            {recent.length ? (
              recent.map((app, index) => {
                const label = isAr
                  ? (app.labelAr || app.labelEn)
                  : (app.labelEn || app.labelAr || labelForAppPath(app.path, language))
                return (
                  <button
                    key={`${app.path}-${index}`}
                    type="button"
                    role="menuitem"
                    onClick={() => openApp(app)}
                    className="group flex w-full items-center gap-3 rounded-2xl px-2.5 py-2.5 text-start transition-colors hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/25 dark:hover:bg-white/[0.045]"
                  >
                    <App3DIcon
                      path={app.path}
                      label={label}
                      className="h-9 w-9 shrink-0 transition duration-200 group-hover:-translate-y-px"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold tracking-tight text-slate-800 group-hover:text-slate-950 dark:text-slate-100 dark:group-hover:text-white">
                        {label}
                      </span>
                      <span className="mt-0.5 block text-[10px] font-medium tabular-nums text-slate-400 dark:text-slate-500">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                    </span>
                  </button>
                )
              })
            ) : (
              <p className="px-3 py-6 text-center text-xs text-slate-400">
                {isAr ? 'لا تطبيقات حديثة' : 'No recent apps yet'}
              </p>
            )}
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
        className={triggerClass}
        title={isAr ? 'التطبيقات الأخيرة' : 'Recent apps'}
      >
        {inLauncher ? (
          <>
            <App3DIcon
              path={recent[0]?.path || '/app/dashboard'}
              label={recent[0] ? (isAr ? recent[0].labelAr || recent[0].labelEn : recent[0].labelEn) : 'Apps'}
              className="h-6 w-6"
            />
            <ChevronDown className={`h-3.5 w-3.5 opacity-60 transition-transform ${open ? 'rotate-180' : ''}`} />
          </>
        ) : (
          <>
            <LayoutGrid className={`h-5 w-5 ${open ? '' : 'text-gray-600 dark:text-gray-400'}`} />
            <ChevronDown className={`h-3 w-3 opacity-50 transition-transform ${open ? 'rotate-180' : 'text-gray-500'}`} />
          </>
        )}
      </button>
      {panel}
    </Fragment>
  )
}
