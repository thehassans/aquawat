import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { LayoutGrid, ArrowUpRight, Sparkles, Clock3 } from 'lucide-react'
import App3DIcon from '../ui/App3DIcon'
import { setAppLauncherOpen, setHideSidebar, setMobileMenuOpen, setNavigationStyle } from '../../store/slices/uiSlice'
import { getRecentApps, pushRecentApp, labelForAppPath } from '../../lib/recentApps'

/**
 * Header app-grid control: premium recent-apps dropdown + full app navbar launch.
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
    () => getRecentApps(tenantId, { language, limit: 8 }),
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
    const top = Math.min(rect.bottom + 10, window.innerHeight - 24)
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
          initial={{ opacity: 0, y: 8, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 6, scale: 0.97 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          className="fixed z-[80] w-[min(22.5rem,calc(100vw-1.5rem))] overflow-hidden rounded-[1.35rem] border border-white/70 bg-white/90 shadow-[0_28px_80px_-28px_rgba(15,23,42,0.55),0_0_0_1px_rgba(15,23,42,0.04)] backdrop-blur-2xl dark:border-white/10 dark:bg-[#12161d]/92 dark:shadow-[0_28px_80px_-20px_rgba(0,0,0,0.75)]"
          style={panelPosition}
        >
            <div aria-hidden className="pointer-events-none absolute inset-0">
              <div className="absolute -top-16 start-8 h-40 w-40 rounded-full bg-emerald-400/25 blur-3xl dark:bg-emerald-500/15" />
              <div className="absolute -bottom-20 end-0 h-36 w-36 rounded-full bg-teal-300/20 blur-3xl dark:bg-teal-500/10" />
              <div
                className="absolute inset-0 opacity-[0.04] dark:opacity-[0.06]"
                style={{
                  backgroundImage:
                    'linear-gradient(#0f172a 1px,transparent 1px),linear-gradient(90deg,#0f172a 1px,transparent 1px)',
                  backgroundSize: '28px 28px',
                }}
              />
            </div>

            <div className="relative border-b border-slate-200/70 px-4 pb-3 pt-4 dark:border-white/10">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-700/80 dark:text-emerald-300/90">
                    {isAr ? 'مساحة العمل' : 'Workspace'}
                  </p>
                  <h3 className="mt-0.5 truncate text-[15px] font-semibold tracking-tight text-slate-900 dark:text-white">
                    {isAr ? 'التطبيقات الأخيرة' : 'Recent apps'}
                  </h3>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full border border-slate-200/80 bg-white/80 px-2 py-1 text-[10px] font-semibold text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                  <Clock3 className="h-3 w-3" />
                  {recent.filter((a) => !a.isSeed).length || '—'}
                </span>
              </div>
            </div>

            <div className="relative grid grid-cols-4 gap-2 px-3 py-3">
              {recent.map((app, index) => {
                const label = isAr ? (app.labelAr || app.labelEn) : (app.labelEn || app.labelAr || labelForAppPath(app.path, language))
                return (
                  <button
                    key={`${app.path}-${index}`}
                    type="button"
                    role="menuitem"
                    onClick={() => openApp(app)}
                    className="group flex flex-col items-center gap-1.5 rounded-2xl px-1.5 py-2 text-center transition hover:bg-slate-900/[0.04] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 dark:hover:bg-white/[0.06]"
                  >
                    <span className="relative flex h-12 w-12 items-center justify-center transition duration-200 group-hover:-translate-y-0.5 group-hover:scale-[1.04]">
                      <span className="absolute inset-0 rounded-[1.05rem] bg-gradient-to-br from-slate-100 to-slate-50 opacity-90 shadow-inner dark:from-white/10 dark:to-white/[0.03]" />
                      <App3DIcon path={app.path} label={label} className="relative h-10 w-10 drop-shadow-sm" />
                    </span>
                    <span className="line-clamp-2 max-w-[4.6rem] text-[10px] font-semibold leading-tight text-slate-600 group-hover:text-slate-900 dark:text-slate-300 dark:group-hover:text-white">
                      {label}
                    </span>
                  </button>
                )
              })}
            </div>

            <div className="relative border-t border-slate-200/70 p-3 dark:border-white/10">
              <button
                type="button"
                role="menuitem"
                onClick={openFullNavbar}
                className="group flex w-full items-center gap-3 rounded-2xl border border-emerald-200/70 bg-gradient-to-r from-emerald-50 via-white to-teal-50 px-3.5 py-3 text-start shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md dark:border-emerald-500/20 dark:from-emerald-500/15 dark:via-[#161b24] dark:to-teal-500/10"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-lg shadow-emerald-600/25">
                  <LayoutGrid className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-900 dark:text-white">
                    {isAr ? 'فتح قائمة التطبيقات' : 'Open app navbar'}
                    <Sparkles className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-300" />
                  </span>
                  <span className="mt-0.5 block text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    {isAr ? 'جميع الوحدات والبحث الكامل' : 'All modules & full search'}
                  </span>
                </span>
                <ArrowUpRight className="h-4 w-4 shrink-0 text-emerald-700 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 dark:text-emerald-300" />
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
        className={`relative p-2 rounded-xl transition-colors ${
          open
            ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/80 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/30'
            : 'hover:bg-gray-100 dark:hover:bg-dark-700'
        }`}
        title={isAr ? 'التطبيقات الأخيرة' : 'Recent apps'}
      >
        <LayoutGrid className={`w-5 h-5 ${open ? '' : 'text-gray-600 dark:text-gray-400'}`} />
      </button>
      {panel}
    </Fragment>
  )
}
