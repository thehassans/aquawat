import { useEffect, useMemo, useState } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Search } from 'lucide-react'
import { setAppLauncherOpen } from '../../store/slices/uiSlice'
import { getTenantBusinessTypes } from '../../lib/businessTypes'
import { getNavSections } from '../../lib/sidebarConfig'
import { useTranslation } from '../../lib/translations'

// Pre-defined mapping for standard paths to specific gradients and icons to match Odoo-style uniqueness
const APP_STYLE_MAP = {
  // Finance / Accounting
  '/app/dashboard': { gradient: 'from-[#4facfe] to-[#00f2fe]' },
  '/app/dashboard/invoices': { gradient: 'from-[#7F00FF] to-[#E100FF]' },
  '/app/dashboard/quotations': { gradient: 'from-[#f83600] to-[#f9d423]' },
  '/app/dashboard/expenses': { gradient: 'from-[#11998e] to-[#38ef7d]' },
  '/app/dashboard/vat-returns': { gradient: 'from-[#FF416C] to-[#FF4B2B]' },
  '/app/dashboard/finance': { gradient: 'from-[#3a1c71] to-[#d76d77]' },
  '/app/dashboard/vouchers': { gradient: 'from-[#FF8008] to-[#FFA081]' },
  
  // HR / Employees
  '/app/dashboard/employees': { gradient: 'from-[#b224ef] to-[#7579ff]' },
  '/app/dashboard/attendance': { gradient: 'from-[#00c6ff] to-[#0072ff]' },
  '/app/dashboard/payroll': { gradient: 'from-[#16A085] to-[#F4D03F]' },
  '/app/dashboard/hr-reports': { gradient: 'from-[#DCE35B] to-[#45B649]' },

  // CRM / Sales
  '/app/dashboard/customers': { gradient: 'from-[#FF4E50] to-[#F9D423]' },
  '/app/dashboard/contacts': { gradient: 'from-[#f12711] to-[#f5af19]' },
  '/app/dashboard/crm': { gradient: 'from-[#F3904F] to-[#3B4371]' },
  '/app/dashboard/leads': { gradient: 'from-[#FDFC47] to-[#24FE41]' },

  // Inventory / Operations
  '/app/dashboard/projects': { gradient: 'from-[#00b09b] to-[#96c93d]' },
  '/app/dashboard/tasks': { gradient: 'from-[#8E2DE2] to-[#4A00E0]' },
  '/app/dashboard/products': { gradient: 'from-[#1D976C] to-[#93F9B9]' },
  '/app/dashboard/inventory': { gradient: 'from-[#EB3349] to-[#F45C43]' },
  '/app/dashboard/purchase-orders': { gradient: 'from-[#4CB8C4] to-[#3CD3AD]' },

  // Settings
  '/app/dashboard/settings': { gradient: 'from-[#616161] to-[#9bc5c3]' },
  '/app/dashboard/tenant-settings/government-integrations/zatca': { gradient: 'from-[#2C3E50] to-[#3498DB]' },
}

const getAppStyle = (path = '', title = '') => {
  // Find exact or partial match
  const match = Object.keys(APP_STYLE_MAP).find(k => path.includes(k))
  if (match) return APP_STYLE_MAP[match].gradient

  // Fallback to deterministic gradient
  const fallbackGradients = [
    'from-[#FF512F] to-[#DD2476]',
    'from-[#1A2980] to-[#26D0CE]',
    'from-[#FFB75E] to-[#ED8F03]',
    'from-[#8E2DE2] to-[#4A00E0]',
    'from-[#1D976C] to-[#93F9B9]',
    'from-[#CC95C0] to-[#DBD4B4]',
    'from-[#314755] to-[#26a0da]',
    'from-[#2b5876] to-[#4e4376]',
    'from-[#e65c00] to-[#F9D423]',
  ]
  const charCode = title.charCodeAt(0) || 0
  return fallbackGradients[charCode % fallbackGradients.length]
}

export default function AppLauncher() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { appLauncherOpen, language, hiddenMenuItems } = useSelector((state) => state.ui)
  const { tenant, user } = useSelector((state) => state.auth)
  const { t } = useTranslation(language)
  const [searchQuery, setSearchQuery] = useState('')

  const businessTypes = getTenantBusinessTypes(tenant)
  const hiddenMenuSet = new Set((hiddenMenuItems || []).filter((p) => !['/app/dashboard/settings', '/app/dashboard/hidden-navbars'].includes(p)))

  const si = tenant?.settings?.saudiIntegrations || {};
  const isZatcaPhase1 = (tenant?.zatca?.phase || 1) === 1;
  const business = tenant?.business || {};
  const isZatcaPhase1Ready = isZatcaPhase1 && !!business.vatNumber && !!(business.legalNameEn || business.legalNameAr) && !!(business.address?.city && business.address?.country);
  const hasZatca = si.zatcaConnectionStatus === 'connected' || tenant?.zatca?.isOnboarded || isZatcaPhase1Ready;
  const hasElm = si.elmConnectionStatus === 'connected';
  const hasQiwa = si.qiwaConnectionStatus === 'connected';
  const hasGosi = si.gosiConnectionStatus === 'connected';

  const govChildren = [];
  if (hasZatca) govChildren.push({ path: '/app/dashboard/tenant-settings/government-integrations/zatca', label: language === 'ar' ? `بوابة زاتكا ${isZatcaPhase1 ? '(المرحلة 1)' : ''}` : `ZATCA${isZatcaPhase1 ? ' Phase 1' : ''} Portal` });
  if (hasElm) govChildren.push({ path: '/app/dashboard/tenant-settings/government-integrations/elm', label: language === 'ar' ? 'بوابة علم / يقين' : 'Elm Portal' });
  if (hasQiwa) govChildren.push({ path: '/app/dashboard/tenant-settings/government-integrations/qiwa', label: language === 'ar' ? 'بوابة قوى' : 'Qiwa Portal' });
  if (hasGosi) govChildren.push({ path: '/app/dashboard/tenant-settings/government-integrations/gosi', label: language === 'ar' ? 'بوابة التأمينات / مدد' : 'GOSI/Mudad Portal' });

  const hasAccess = (module, action) => {
    if (!user) return false
    if (user.role === 'super_admin' || user.role === 'admin') return true
    const perm = Array.isArray(user.permissions) ? user.permissions.find((p) => p?.module === module) : null
    const actions = Array.isArray(perm?.actions) ? perm.actions : []
    return actions.includes(action)
  }

  // Calculate visible apps (similar to Sidebar logic but flattened)
  const allApps = useMemo(() => {
    const navSections = getNavSections({ language, t, tenant, businessTypes, govChildren })
    const apps = []

    navSections.forEach((section) => {
      if (Array.isArray(section.businessTypes) && !section.businessTypes.some((type) => businessTypes.includes(type))) {
        return
      }
      if (Array.isArray(section.excludeBusinessTypes) && section.excludeBusinessTypes.some((type) => businessTypes.includes(type))) {
        return
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
        if (!item?.perm) return true
        return hasAccess(item.perm.module, item.perm.action)
      })

      apps.push(...items)
    })

    // Remove duplicates based on path
    const uniqueApps = []
    const seenPaths = new Set()
    for (const app of apps) {
      const p = app.path || (app.children && app.children[0]?.path)
      if (p && !seenPaths.has(p)) {
        seenPaths.add(p)
        uniqueApps.push(app)
      }
    }

    return uniqueApps
  }, [language, tenant, businessTypes, hiddenMenuSet, user, govChildren])

  const filteredApps = useMemo(() => {
    if (!searchQuery) return allApps
    const query = searchQuery.toLowerCase()
    return allApps.filter(app => app.label?.toLowerCase().includes(query))
  }, [allApps, searchQuery])

  // Prevent background scrolling when open
  useEffect(() => {
    if (appLauncherOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
      setSearchQuery('')
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [appLauncherOpen])

  const handleAppClick = (path) => {
    dispatch(setAppLauncherOpen(false))
    if (path) {
      navigate(path)
    }
  }

  return (
    <AnimatePresence>
      {appLauncherOpen && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: -20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.25, ease: "easeInOut" }}
          className="fixed inset-0 z-[100] flex flex-col bg-gray-50/95 dark:bg-[#1a1824]/95 backdrop-blur-xl overflow-hidden"
        >
          {/* Header Bar */}
          <div className="flex items-center justify-between p-6 h-20 shrink-0">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 dark:text-gray-400" />
                <input
                  type="text"
                  autoFocus
                  placeholder={language === 'ar' ? 'بحث عن التطبيقات...' : 'Search apps...'}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full sm:w-80 bg-white dark:bg-white/10 border border-gray-200 dark:border-transparent focus:bg-white dark:focus:bg-white/20 focus:border-primary-500 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/50 rounded-2xl py-2.5 pl-10 pr-4 outline-none transition-all shadow-sm dark:shadow-none"
                  dir={language === 'ar' ? 'rtl' : 'ltr'}
                />
              </div>
            </div>
            
            <button 
              onClick={() => dispatch(setAppLauncherOpen(false))}
              className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-white/10 text-gray-500 dark:text-white/80 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              <X className="w-8 h-8" />
            </button>
          </div>

          {/* Apps Grid */}
          <div className="flex-1 overflow-y-auto px-4 pb-12 sm:px-12 pt-8">
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-x-4 gap-y-10 sm:gap-y-12 max-w-7xl mx-auto">
              {filteredApps.map((app, index) => {
                const Icon = app.icon || Search
                const targetPath = app.path || (app.children && app.children[0]?.path)
                const gradient = getAppStyle(targetPath, app.label || '')
                
                return (
                  <motion.button
                    key={index}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.02, duration: 0.3 }}
                    onClick={() => handleAppClick(targetPath)}
                    className="flex flex-col items-center group w-full outline-none"
                  >
                    <div className={`w-20 h-20 sm:w-24 sm:h-24 rounded-[2rem] bg-gradient-to-br ${gradient} shadow-lg shadow-black/10 dark:shadow-black/30 flex items-center justify-center transform transition-all duration-300 group-hover:scale-105 group-hover:-translate-y-2 group-focus:scale-105 group-active:scale-95 group-active:-translate-y-0 border border-white/20 dark:border-white/10`}>
                      <Icon className="w-10 h-10 sm:w-11 sm:h-11 text-white drop-shadow-sm" strokeWidth={1.5} />
                    </div>
                    <span className="mt-4 text-[13px] sm:text-sm font-semibold text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white text-center tracking-wide line-clamp-2 max-w-[100px] transition-colors">
                      {app.label}
                    </span>
                  </motion.button>
                )
              })}
              
              {filteredApps.length === 0 && (
                <div className="col-span-full flex flex-col items-center justify-center py-20 text-gray-400 dark:text-white/50">
                  <Search className="w-16 h-16 mb-4 opacity-50" />
                  <p className="text-lg">{language === 'ar' ? 'لا توجد تطبيقات مطابقة' : 'No apps found'}</p>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
