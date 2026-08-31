import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { LayoutGrid, ChevronDown } from 'lucide-react'
import App3DIcon from '../ui/App3DIcon'
import { setAppLauncherOpen, setHideSidebar, setMobileMenuOpen, setNavigationStyle } from '../../store/slices/uiSlice'
import { getRecentApps, pushRecentApp, labelForAppPath } from '../../lib/recentApps'

const RECENT_LIMIT = 3

/**
 * Header recent-apps control — ultra-premium vertical dropdown of the last 3 apps.
 * Trigger previews live app icons instead of a generic grid / close glyph.
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
    () => getRecentApps(tenantId, { language, limit: RECENT_LIMIT }),
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

  const appLabel = (app) =>
    isAr
      ? (app.labelAr || app.labelEn)
      : (app.labelEn || app.labelAr || labelForAppPath(app.path, language))

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

  const preview = recent.slice(0, RECENT_LIMIT)

  const panel = createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          key="recent-apps-menu"
          ref={panelRef}
          role="menu"
          aria-label={isAr ? 'التطبيقات الأخيرة' : 'Recent apps'}
          initial={{ opacity: 0, y: 8, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 4, scale: 0.99 }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="fixed z-[80] w-[min(15.5rem,calc(100vw-1.5rem))] overflow-hidden rounded-[1.35rem] border border-white/70 bg-white/90 shadow-[0_28px_64px_-36px_rgba(15,23,42,0.55),0_1px_0_rgba(255,255,255,0.65)_inset] backdrop-blur-2xl dark:border-white/[0.07] dark:bg-[#0f1319]/92 dark:shadow-[0_32px_72px_-28px_rgba(0,0,0,0.85)]"
          style={panelPosition}
        >
          <div className="px-3.5 pb-1 pt-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400/90 dark:text-slate-500">
              {isAr ? 'الأخيرة' : 'Recent'}
            </p>
          </div>

          <div className="flex flex-col gap-0.5 px-1.5 pb-1.5">
            {preview.map((app, index) => {
              const label = appLabel(app)
              return (
                <motion.button
                  key={`${app.path}-${index}`}
                  type="button"
                  role="menuitem"
                  initial={{ opacity: 0, x: isAr ? 6 : -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.03 * index, duration: 0.18 }}
                  onClick={() => openApp(app)}
                  className="group flex w-full items-center gap-2.5 rounded-2xl px-2 py-2 text-start transition-colors hover:bg-slate-900/[0.04] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/25 dark:hover:bg-white/[0.05]"
                >
                  <span className="relative shrink-0">
                    <span className="absolute inset-0 rounded-xl bg-slate-900/[0.04] blur-[6px] dark:bg-white/[0.06]" aria-hidden />
                    <App3DIcon
                      path={app.path}
                      label={label}
                      className="relative h-9 w-9 transition duration-200 group-hover:-translate-y-0.5 group-hover:scale-[1.03]"
                    />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold tracking-tight text-slate-800 dark:text-slate-100">
                      {label}
                    </span>
                    <span className="mt-0.5 block text-[10px] font-medium tabular-nums text-slate-400 dark:text-slate-500">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                  </span>
                </motion.button>
              )
            })}
          </div>

          <div className="border-t border-slate-100/90 px-1.5 py-1.5 dark:border-white/[0.06]">
            <button
              type="button"
              role="menuitem"
              onClick={openFullNavbar}
              className="group flex w-full items-center gap-2.5 rounded-2xl px-2 py-2 text-start transition-colors hover:bg-slate-900/[0.04] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/25 dark:hover:bg-white/[0.05]"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-white shadow-[0_8px_18px_-10px_rgba(15,23,42,0.7)] dark:bg-white dark:text-slate-950">
                <LayoutGrid className="h-3.5 w-3.5" strokeWidth={1.75} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-semibold tracking-tight text-slate-800 dark:text-slate-100">
                  {isAr ? 'كل التطبيقات' : 'All apps'}
                </span>
                <span className="mt-0.5 block text-[10px] text-slate-400 dark:text-slate-500">
                  {isAr ? 'فتح القائمة' : 'Open launcher'}
                </span>
              </span>
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
        className={`group relative inline-flex h-10 items-center gap-1.5 rounded-2xl border px-1.5 pe-2 transition-all duration-200 ${
          open
            ? 'border-slate-200/90 bg-white shadow-[0_10px_28px_-18px_rgba(15,23,42,0.45)] dark:border-white/10 dark:bg-white/[0.08]'
            : 'border-transparent hover:border-slate-200/80 hover:bg-white/80 dark:hover:border-white/10 dark:hover:bg-white/[0.05]'
        }`}
        title={isAr ? 'التطبيقات الأخيرة' : 'Recent apps'}
      >
        <span className="flex flex-col items-center gap-[3px] py-1" aria-hidden>
          {preview.length ? (
            preview.map((app, index) => (
              <App3DIcon
                key={`preview-${app.path}-${index}`}
                path={app.path}
                label={appLabel(app)}
                className={`h-[11px] w-[11px] rounded-[3px] shadow-sm ring-1 ring-white/70 dark:ring-white/10 ${
                  index === 0 ? 'opacity-100' : index === 1 ? 'opacity-80' : 'opacity-60'
                }`}
              />
            ))
          ) : (
            <LayoutGrid className="h-4 w-4 text-slate-500" strokeWidth={1.75} />
          )}
        </span>
        <ChevronDown
          className={`h-3 w-3 text-slate-400 transition duration-200 ${open ? 'rotate-180 text-slate-600 dark:text-slate-300' : 'group-hover:text-slate-500'}`}
          strokeWidth={2}
        />
      </button>
      {panel}
    </Fragment>
  )
}
