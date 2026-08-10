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

export default function Sidebar() {
  const dispatch = useDispatch()
  const { sidebarCollapsed, mobileMenuOpen, language, hiddenMenuItems } = useSelector((state) => state.ui)
  const { tenant, user } = useSelector((state) => state.auth)
  const { t } = useTranslation(language)

  const [pendingQuestions, setPendingQuestions] = useState(0)
  const [pendingReviews, setPendingReviews] = useState(0)

  const si = tenant?.settings?.saudiIntegrations || {};
  const isSarCurrencyTenant = String(tenant?.settings?.currency || 'SAR').toUpperCase() === 'SAR';
  const isZatcaPhase1 = (tenant?.zatca?.phase || 1) === 1;
  const business = tenant?.business || {};
  const isZatcaPhase1Ready = isZatcaPhase1 && !!business.vatNumber && !!(business.legalNameEn || business.legalNameAr) && !!(business.address?.city && business.address?.country);
  const hasZatca = isSarCurrencyTenant && (si.zatcaConnectionStatus === 'connected' || tenant?.zatca?.isOnboarded || isZatcaPhase1Ready);
  const hasElm = isSarCurrencyTenant && si.elmConnectionStatus === 'connected';
  const hasQiwa = isSarCurrencyTenant && si.qiwaConnectionStatus === 'connected';
  const hasGosi = isSarCurrencyTenant && si.gosiConnectionStatus === 'connected';

  const govChildren = [];
  if (hasZatca) govChildren.push({ path: '/app/dashboard/tenant-settings/government-integrations/zatca', label: language === 'ar' ? `بوابة زاتكا ${isZatcaPhase1 ? '(المرحلة 1)' : ''}` : `ZATCA${isZatcaPhase1 ? ' Phase 1' : ''} Portal` });
  if (hasElm) govChildren.push({ path: '/app/dashboard/tenant-settings/government-integrations/elm', label: language === 'ar' ? 'بوابة علم / يقين' : 'Elm Portal' });
  if (hasQiwa) govChildren.push({ path: '/app/dashboard/tenant-settings/government-integrations/qiwa', label: language === 'ar' ? 'بوابة قوى' : 'Qiwa Portal' });
  if (hasGosi) govChildren.push({ path: '/app/dashboard/tenant-settings/government-integrations/gosi', label: language === 'ar' ? 'بوابة التأمينات / مدد' : 'GOSI/Mudad Portal' });

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
      if (Array.isArray(section.businessTypes) && !section.businessTypes.some((type) => businessTypes.includes(type))) {
        return { ...section, items: [] }
      }

      if (Array.isArray(section.excludeBusinessTypes) && section.excludeBusinessTypes.some((type) => businessTypes.includes(type))) {
        return { ...section, items: [] }
      }

      // App Store gating: hide sections requiring an installed app
      if (section.requireApp) {
        const appStatus = tenant?.settings?.installedApps?.[section.requireApp]
        if (!appStatus?.isInstalled || !appStatus?.isEnabled) {
          return { ...section, items: [] }
        }
      }

      const items = (Array.isArray(section.items) ? section.items : []).filter((item) => {
        if (item.path && hiddenMenuSet.has(item.path)) return false
        const childPath = item.children?.[0]?.path
        if (childPath && hiddenMenuSet.has(childPath)) return false
        if (Array.isArray(item?.businessTypes) && !item.businessTypes.some((type) => businessTypes.includes(type))) {
          return false
        }
        if (Array.isArray(item?.excludeBusinessTypes) && item.excludeBusinessTypes.some((type) => businessTypes.includes(type))) {
          return false
        }
        if (item.requireAddon && !tenant?.subscription?.[item.requireAddon]) {
          return false
        }
        // Per-item App Store gating
        if (item.requireApp) {
          const appStatus = tenant?.settings?.installedApps?.[item.requireApp]
          if (!appStatus?.isInstalled || !appStatus?.isEnabled) return false
        }
        if (!item?.perm) return true
        return hasAccess(item.perm.module, item.perm.action)
      })

      return { ...section, items }
    })
    .filter((section) => (Array.isArray(section.items) ? section.items.length > 0 : false))

  const SidebarContent = () => (
    <>
      {/* Logo */}
      <div className="flex items-center justify-center px-4 h-16 bg-[#1a3d28] relative overflow-hidden">
        <div className="w-full h-12 flex items-center justify-center flex-shrink-0">
          <img src={`${import.meta.env.BASE_URL}maqdernewlogo.webp`} alt="Maqder" className="h-full w-auto object-contain scale-[2] origin-center" />
        </div>
        
        {/* Mobile close button */}
        <button
          onClick={() => dispatch(setMobileMenuOpen(false))}
          className="lg:hidden absolute right-4 p-2 rounded-lg hover:bg-white/10 text-white"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Tenant Info */}
      {!sidebarCollapsed && tenant && (
        <div className="px-6 py-6 border-b border-gray-100 dark:border-dark-700 flex flex-col items-center text-center">
          {(tenant?.branding?.logo || tenant?.settings?.invoiceBranding?.logo) ? (
            <div className="w-full h-20 mb-5 flex items-center justify-center">
              <img src={tenant?.branding?.logo || tenant?.settings?.invoiceBranding?.logo} alt="Company Logo" className="max-h-full max-w-[85%] object-contain dark:mix-blend-normal" />
            </div>
          ) : (
            <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-dark-700 text-gray-900 dark:text-white flex items-center justify-center font-light text-2xl mb-4">
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
                                  ? 'bg-primary-50 text-primary-600 dark:bg-primary-950/20 dark:text-primary-400 font-semibold'
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
            <span>{language === 'ar' ? 'إخÙاء الشريط' : 'Hide sidebar'}</span>
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

