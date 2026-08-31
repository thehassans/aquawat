import { Outlet, useLocation } from 'react-router-dom'
import { Suspense, useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import Sidebar from '../components/layout/Sidebar'
import Header from '../components/layout/Header'
import DemoWelcome from '../components/layout/DemoWelcome'
import OfflineBanner from '../components/ui/OfflineBanner'
import PageLoader from '../components/ui/PageLoader'
import TerminationBanner, { TerminationBlocker, InactiveBlocker, isTenantTerminated, isTenantInactive } from '../components/ui/TerminationBanner'
import SubscriptionEndedBlocker, { shouldBlockExpiredSubscription } from '../components/layout/SubscriptionEndedBlocker'
import { getTenantBusinessTypes } from '../lib/businessTypes'
import { setHideSidebar } from '../store/slices/uiSlice'
import { PanelLeft } from 'lucide-react'
import { useOfflineSync } from '../hooks/useOfflineSync'
import { preloadCriticalRoutes } from '../lib/routePreloader'
import { ErrorBoundary } from '../lib/errorBoundary'
import { lazyRetry } from '../lib/lazyRetry'
import { pushRecentApp } from '../lib/recentApps'

const AppLauncher = lazyRetry(() => import('../components/layout/AppLauncher'))

export default function MainLayout() {
  useOfflineSync()
  const { sidebarCollapsed, hideSidebar, navigationStyle } = useSelector((state) => state.ui)
  const dispatch = useDispatch()
  const { tenant } = useSelector((state) => state.auth)
  const location = useLocation()

  // Preload common route chunks in idle background for instant subsequent transitions
  useEffect(() => {
    preloadCriticalRoutes(tenant)
  }, [tenant?._id])

  // Track module visits for the header recent-apps dropdown
  useEffect(() => {
    if (!location.pathname?.startsWith('/app/dashboard')) return
    pushRecentApp(tenant?._id, { path: location.pathname })
  }, [location.pathname, tenant?._id])

  const businessTypes = getTenantBusinessTypes(tenant)

  if (isTenantTerminated(tenant)) {
    return <TerminationBlocker />
  }

  if (isTenantInactive(tenant)) {
    return <InactiveBlocker />
  }

  if (shouldBlockExpiredSubscription(tenant)) {
    return <SubscriptionEndedBlocker />
  }

  const isSidebarVisible = navigationStyle === 'sidebar' && !hideSidebar
  const showRestoreButton = navigationStyle === 'sidebar' && hideSidebar

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-900 flex flex-col overflow-x-hidden w-full max-w-full">
      <DemoWelcome />
      <div className="print:hidden">
        <OfflineBanner />
        <Suspense fallback={null}>
          <AppLauncher />
        </Suspense>
      </div>
      <div className="flex flex-1 w-full max-w-full">
        {isSidebarVisible && (
          <div className="print:hidden">
            <Sidebar />
          </div>
        )}
        {showRestoreButton && (
          <button
            onClick={() => dispatch(setHideSidebar(false))}
            className="hidden lg:flex fixed top-20 left-2 z-50 p-2.5 rounded-xl bg-white dark:bg-dark-800 shadow-lg border border-gray-200 dark:border-dark-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-700 transition-colors print:hidden"
            title="Show sidebar"
          >
            <PanelLeft className="w-5 h-5" />
          </button>
        )}
        <div
          className={`flex-1 transition-all duration-300 flex flex-col min-w-0 ${
            !isSidebarVisible ? '' : (sidebarCollapsed ? 'lg:ms-20' : 'lg:ms-72')
          } print:!ms-0`}
        >
          <div className="print:hidden">
            <TerminationBanner />
            <Header />
          </div>
          <main className="p-4 lg:p-6 print:p-0 print:bg-white">
            <ErrorBoundary soft resetKey={location.pathname}>
              <Suspense fallback={<PageLoader />}>
                <Outlet />
              </Suspense>
            </ErrorBoundary>
          </main>
        </div>
      </div>
    </div>
  )
}
