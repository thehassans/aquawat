import { useState, useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux'
import { motion, AnimatePresence } from 'framer-motion'
import api from '../../lib/api'
import { ChevronLeft, ChevronRight, X, PanelLeftClose } from 'lucide-react'
import { toggleSidebarCollapse, setMobileMenuOpen, setHideSidebar } from '../../store/slices/uiSlice'
import { useTranslation } from '../../lib/translations'
import { getTenantBusinessTypes } from '../../lib/businessTypes'
import { getNavSections } from '../../lib/sidebarConfig'
import { isNavItemAppVisible } from '../../lib/appStorePartners'
import { getGovChildren } from '../../lib/saudiTenant'

export default function Sidebar() {
  const dispatch = useDispatch()
  const { sidebarCollapsed, mobileMenuOpen, language, hiddenMenuItems } = useSelector((state) => state.ui)
  const { tenant, user } = useSelector((state) => state.auth)
  const { t } = useTranslation(language)

  const [pendingQuestions, setPendingQuestions] = useState(0)
  const [pendingReviews, setPendingReviews] = useState(0)

  const govChildren = getGovChildren(tenant, language)

  const hiddenMenuSet = new Set((hiddenMenuItems || []).filter((p) => !['/app/dashboard/settings', '/app/dashboard/hidden-navbars'].includes(p)))

  const businessTypes = getTenantBusinessTypes(tenant)

  useEffect(() => {
    if (businessTypes.includes('ecommerce')) {
      api.get('/ecommerce/products/questions/pending').then(res => setPendingQuestions(res.data?.questions?.length || 0)).catch(() => {})
      api.get('/ecommerce/reviews?status=pending&limit=1').then(res => setPendingReviews(res.data?.total || 0)).catch(() => {})
      const interval = setInterval(() => {
        api.get('/ecommerce/products/questions/pending').then(res => setPendingQuestions(res.data?.questions?.length || 0)).catch(() => {})
        api.get('/ecommerce/reviews?status=pending&limit=1').then(res => setPendingReviews(res.data?.total || 0)).catch(() => {})
      }, 60000)
      return () => clearInterval(interval)
    }
  }, [businessTypes])

  const hasAccess = (module, action) => {
    if (!user) return false
    if (user.role === 'super_admin' || user.role === 'admin') return true
    const perm = Array.isArray(user.permissions) ? user.permissions.find((p) => p?.module === module) : null
    const actions = Array.isArray(perm?.actions) ? perm.actions : []
    return actions.includes(action)
  }

  const sidebarStyle = tenant?.branding?.sidebarStyle || 'solid'
  const sidebarClassName =
    sidebarStyle === 'glass'
      ? 'bg-white/70 dark:bg-dark-800/70 backdrop-blur-xl'
      : 'bg-white dark:bg-dark-800'

  const navSections = getNavSections({ language, t, tenant, businessTypes, govChildren })

  const visibleNavSections = navSections
    .map((section) => {
      if (Array.isArray(section.excludeBusinessTypes) && section.excludeBusinessTypes.some((type) => businessTypes.includes(type))) {
        return { ...section, items: [] }
      }

      if (!isNavItemAppVisible(tenant, businessTypes, section)) {
        return { ...section, items: [] }
      }

      const items = (Array.isArray(section.items) ? section.items : [])
        .map((item) => {
          if (!Array.isArray(item.children) || item.children.length === 0) return item
          const validChildren = item.children.filter((child) => {
            if (child.path && hiddenMenuSet.has(child.path)) return false
            if (child.perm && !hasAccess(child.perm.module, child.perm.action)) return false
            if (Array.isArray(child.excludeBusinessTypes) && child.excludeBusinessTypes.some((type) => businessTypes.includes(type))) {
              return false
            }
            if (!isNavItemAppVisible(tenant, businessTypes, child)) return false
            return true
          })
          return { ...item, children: validChildren }
        })
        .filter((item) => {
          if (item.path && hiddenMenuSet.has(item.path)) return false
          if (Array.isArray(item.children) && item.children.length === 0 && !item.path) return false
          const childPath = item.children?.[0]?.path
          if (childPath && hiddenMenuSet.has(childPath) && !item.path) return false
          if (Array.isArray(item?.excludeBusinessTypes) && item.excludeBusinessTypes.some((type) => businessTypes.includes(type))) {
            return false
          }
          if (item.requireAddon && !tenant?.subscription?.[item.requireAddon]) {
            return false
          }
          if (!isNavItemAppVisible(tenant, businessTypes, item)) return false
          if (!item?.perm) return true
          return hasAccess(item.perm.module, item.perm.action)
        })

      return { ...section, items }
    })
    .filter((section) => (Array.isArray(section.items) ? section.items.length > 0 : false))

  const SidebarContent = () => (
    <>
      {/* Logo */}
      <div className="relative flex h-16 items-center justify-center border-b border-slate-200/80 bg-white px-4 dark:border-dark-700 dark:bg-dark-800">
        <div className="flex h-10 w-full items-center justify-center">
          <img
            src={`${import.meta.env.BASE_URL}maqderlogolandingpage.webp`}
            alt="Maqder"
            className="h-full w-auto max-h-10 object-contain dark:brightness-0 dark:invert"
          />
        </div>
        
        {/* Mobile close button */}
        <button
          onClick={() => dispatch(setMobileMenuOpen(false))}
          className="absolute right-3 rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden dark:text-slate-300 dark:hover:bg-dark-700"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Tenant Info */}
        {!sidebarCollapsed && tenant && (
        <div className="flex flex-col items-center border-b border-slate-100 px-5 py-4 text-center dark:border-dark-700">
          {(tenant?.branding?.logo || tenant?.settings?.invoiceBranding?.logo) ? (
            <div className="mb-3 flex h-14 w-full items-center justify-center">
              <img src={tenant?.branding?.logo || tenant?.settings?.invoiceBranding?.logo} alt="Company Logo" className="max-h-full max-w-[80%] object-contain" />
            </div>
          ) : (
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-sm font-semibold text-slate-800 dark:bg-dark-700 dark:text-white">
              {(tenant.business?.legalNameEn || tenant.name || tenant.business?.legalNameAr || 'M').charAt(0).toUpperCase()}
            </div>
          )}
          
          <h3 className="font-bold text-gray-900 dark:text-white text-xs leading-snug tracking-widest uppercase">
            {language === 'ar'
              ? (tenant.business?.legalNameAr || tenant.name || tenant.business?.legalNameEn)
              : (tenant.business?.legalNameEn || tenant.name || tenant.business?.legalNameAr)}
          </h3>
          {tenant.business?.vatNumber && (
            <div className="mt-1.5 text-[9px] text-gray-400 tracking-widest font-mono uppercase">
              VAT {tenant.business?.vatNumber}
            </div>
          )}
          {user?.branchId && (
            <div className="mt-2 px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-[10px] font-semibold">
              {language === 'ar' ? 'فرع' : 'Branch'}
            </div>
          )}
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-4">
        {visibleNavSections.map((section, idx) => (
          <div key={idx}>
            {!sidebarCollapsed && (
              <h3 className="px-3 mb-2 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                {section.title}
              </h3>
            )}
            <div className="space-y-1">
              {section.items.map((item) => {
                const hasChildren = Array.isArray(item.children) && item.children.length > 0;
                return (
                  <div key={item.path} className="space-y-1">
                    <NavLink
                      to={item.path}
                      end={item.end}
                      onClick={() => dispatch(setMobileMenuOpen(false))}
                      className={({ isActive }) =>
                        `sidebar-link ${isActive ? 'active' : ''} ${sidebarCollapsed ? 'justify-center px-3' : ''}`
                      }
                    >
                      <item.icon className="w-5 h-5 flex-shrink-0" />
                      {!sidebarCollapsed && (
                        <motion.span
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="flex-1 flex justify-between items-center"
                        >
                          <span>{item.label}</span>
                          {item.path === '/app/dashboard/ecommerce/questions' && pendingQuestions > 0 && (
                            <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-amber-500 text-white text-[10px] font-bold">{pendingQuestions}</span>
                          )}
                          {item.path === '/app/dashboard/ecommerce/reviews' && pendingReviews > 0 && (
                            <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-amber-500 text-white text-[10px] font-bold">{pendingReviews}</span>
                          )}
                        </motion.span>
                      )}
                    </NavLink>
                    {hasChildren && !sidebarCollapsed && (
                      <div className="ps-6 ml-6 border-l border-gray-200 dark:border-dark-600 space-y-1 mt-1">
                        {item.children.map((child) => (
                          <NavLink
                            key={child.path}
                            to={child.path}
                            onClick={() => dispatch(setMobileMenuOpen(false))}
                            className={({ isActive }) =>
                              `block py-1.5 px-3 rounded-lg text-[11px] font-medium transition-all ${
                                isActive
                                  ? 'bg-slate-100 text-slate-900 dark:bg-dark-700 dark:text-white font-semibold'
                                  : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-dark-700/50'
                              }`
                            }
                          >
                            {child.label}
                          </NavLink>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Collapse Button (Desktop) */}
      <div className="hidden lg:block p-3 border-t border-gray-200 dark:border-dark-700">
        <button
          onClick={() => dispatch(toggleSidebarCollapse())}
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-xl transition-colors"
        >
          {sidebarCollapsed ? (
            <ChevronRight className="w-5 h-5" />
          ) : (
            <>
              <ChevronLeft className="w-5 h-5" />
              <span>{language === 'ar' ? 'طي القائمة' : 'Collapse'}</span>
            </>
          )}
        </button>
        {!sidebarCollapsed && (
          <button
            onClick={() => dispatch(setHideSidebar(true))}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 mt-1 text-xs text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-xl transition-colors"
          >
            <PanelLeftClose className="w-4 h-4" />
            <span>{language === 'ar' ? 'إخفاء الشريط' : 'Hide sidebar'}</span>
          </button>
        )}
      </div>
    </>
  )

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={`hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 ${sidebarClassName} border-e border-gray-200 dark:border-dark-700 z-40 transition-all duration-300 ${
          sidebarCollapsed ? 'lg:w-20' : 'lg:w-72'
        }`}
      >
        {SidebarContent()}
      </aside>

      {/* Mobile Sidebar */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => dispatch(setMobileMenuOpen(false))}
              className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            />
            <motion.aside
              initial={{ x: language === 'ar' ? '100%' : '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: language === 'ar' ? '100%' : '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className={`fixed inset-y-0 ${language === 'ar' ? 'right-0' : 'left-0'} w-72 ${sidebarClassName} border-e border-gray-200 dark:border-dark-700 z-50 lg:hidden flex flex-col`}
            >
              {SidebarContent()}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  )
}

