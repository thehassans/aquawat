import { useDispatch, useSelector } from 'react-redux'
import { LayoutGrid } from 'lucide-react'
import { setAppLauncherOpen, setHideSidebar, setMobileMenuOpen, setNavigationStyle } from '../../store/slices/uiSlice'

/**
 * Header app-grid control — opens the full app navbar (recent apps live there).
 */
export default function RecentAppsMenu() {
  const dispatch = useDispatch()
  const { language, appLauncherOpen } = useSelector((s) => s.ui)
  const { tenant } = useSelector((s) => s.auth)
  const isAr = language === 'ar'
  const tenantId = tenant?._id

  const openAppNavbar = () => {
    dispatch(setNavigationStyle({ tenantId, style: 'launcher' }))
    dispatch(setHideSidebar(true))
    dispatch(setMobileMenuOpen(false))
    dispatch(setAppLauncherOpen(true))
  }

  return (
    <button
      type="button"
      aria-haspopup="dialog"
      aria-expanded={Boolean(appLauncherOpen)}
      onClick={openAppNavbar}
      className={`relative p-2 rounded-xl transition-colors ${
        appLauncherOpen
          ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/80 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/30'
          : 'hover:bg-gray-100 dark:hover:bg-dark-700'
      }`}
      title={isAr ? 'قائمة التطبيقات' : 'App navbar'}
    >
      <LayoutGrid className={`w-5 h-5 ${appLauncherOpen ? '' : 'text-gray-600 dark:text-gray-400'}`} />
    </button>
  )
}
