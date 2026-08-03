import { Outlet } from 'react-router-dom'
import { Suspense } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import Sidebar from '../components/layout/Sidebar'
import Header from '../components/layout/Header'
import AppLauncher from '../components/layout/AppLauncher'
import LoadingScreen from '../components/ui/LoadingScreen'
import { setHideSidebar } from '../store/slices/uiSlice'
import { PanelLeft } from 'lucide-react'

export default function WorkshopLayout() {
  const { sidebarCollapsed, hideSidebar, navigationStyle } = useSelector((state) => state.ui)
  const dispatch = useDispatch()

  const isSidebarVisible = navigationStyle === 'sidebar' && !hideSidebar
  const showRestoreButton = navigationStyle === 'sidebar' && hideSidebar

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-900 flex flex-col overflow-x-hidden w-full max-w-full">
      <AppLauncher />
      <div className="flex flex-1 w-full max-w-full">
        {isSidebarVisible && <Sidebar />}
        {showRestoreButton && (
          <button
            onClick={() => dispatch(setHideSidebar(false))}
            className="hidden lg:flex fixed top-20 left-2 z-50 p-2.5 rounded-xl bg-white dark:bg-dark-800 shadow-lg border border-gray-200 dark:border-dark-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-700 transition-colors"
            title="Show sidebar"
          >
            <PanelLeft className="w-5 h-5" />
          </button>
        )}
        <div
          className={`flex-1 transition-all duration-300 flex flex-col min-w-0 ${
            !isSidebarVisible ? '' : (sidebarCollapsed ? 'lg:ms-20' : 'lg:ms-72')
          }`}
        >
          <Header />
          <main className="p-4 lg:p-6">
            <Suspense fallback={<LoadingScreen />}>
              <Outlet />
            </Suspense>
          </main>
        </div>
      </div>
    </div>
  )
}
