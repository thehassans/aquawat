import { useEffect, useMemo, useState } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Search } from 'lucide-react'
import { setAppLauncherOpen } from '../../store/slices/uiSlice'
import { getTenantBusinessTypes } from '../../lib/businessTypes'
import { getNavSections } from '../../lib/sidebarConfig'
import { useTranslation } from '../../lib/translations'

// Helper to generate consistent gradients for icons based on title length or first letter
const generateGradient = (title = '') => {
  const gradients = [
    'from-pink-500 to-rose-500',
    'from-purple-500 to-indigo-500',
    'from-blue-500 to-cyan-500',
    'from-emerald-500 to-teal-500',
    'from-amber-400 to-orange-500',
    'from-red-500 to-rose-600',
    'from-violet-500 to-fuchsia-500',
    'from-sky-400 to-blue-600',
    'from-green-400 to-emerald-600',
  ]
  const charCode = title.charCodeAt(0) || 0
  return gradients[charCode % gradients.length]
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
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="fixed inset-0 z-[100] flex flex-col bg-[#272535] sm:bg-[#201d2a] dark:bg-[#1a1824] backdrop-blur-md overflow-hidden"
          style={{ backgroundImage: 'radial-gradient(circle at top right, rgba(120,80,255,0.05), transparent 40%), radial-gradient(circle at bottom left, rgba(80,120,255,0.05), transparent 40%)' }}
        >
          {/* Header Bar */}
          <div className="flex items-center justify-between p-6 h-20 shrink-0">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  autoFocus
                  placeholder={language === 'ar' ? 'بحث عن التطبيقات...' : 'Search apps...'}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full sm:w-80 bg-white/10 border-transparent focus:bg-white/20 focus:border-white/30 text-white placeholder-white/50 rounded-2xl py-2.5 pl-10 pr-4 outline-none transition-all"
                  dir={language === 'ar' ? 'rtl' : 'ltr'}
                />
              </div>
            </div>
            
            <button 
              onClick={() => dispatch(setAppLauncherOpen(false))}
              className="p-2 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition-colors"
            >
              <X className="w-8 h-8" />
            </button>
          </div>

          {/* Apps Grid */}
          <div className="flex-1 overflow-y-auto px-4 pb-12 sm:px-12 pt-4">
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-x-4 gap-y-10 sm:gap-y-12 max-w-7xl mx-auto">
              {filteredApps.map((app, index) => {
                const Icon = app.icon || Search
                const gradient = generateGradient(app.label || '')
                const targetPath = app.path || (app.children && app.children[0]?.path)
                
                return (
                  <motion.button
                    key={index}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.02, duration: 0.3 }}
                    onClick={() => handleAppClick(targetPath)}
                    className="flex flex-col items-center group w-full"
                  >
                    <div className={`w-20 h-20 sm:w-24 sm:h-24 rounded-[2rem] bg-gradient-to-br ${gradient} shadow-lg shadow-black/20 flex items-center justify-center transform transition-transform duration-200 group-hover:scale-110 group-hover:-translate-y-1 group-active:scale-95`}>
                      <Icon className="w-10 h-10 sm:w-12 sm:h-12 text-white drop-shadow-md" strokeWidth={1.5} />
                    </div>
                    <span className="mt-4 text-[13px] sm:text-sm font-medium text-white/90 group-hover:text-white text-center tracking-wide line-clamp-2 max-w-[100px]">
                      {app.label}
                    </span>
                  </motion.button>
                )
              })}
              
              {filteredApps.length === 0 && (
                <div className="col-span-full flex flex-col items-center justify-center py-20 text-white/50">
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
