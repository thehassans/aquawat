import { useEffect, useMemo, useState } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Search, Bell, Moon, Sun, Globe, LogOut, Mail, Menu as MenuIcon, Building2, Settings as SettingsIcon, PanelLeft, LayoutGrid, LayoutList } from 'lucide-react'
import { Fragment } from 'react'
import { Transition, Popover, Menu } from '@headlessui/react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../../lib/api'
import { setAppLauncherOpen, setLanguage, setTheme, setNavigationStyle, setHideSidebar, setMobileMenuOpen } from '../../store/slices/uiSlice'
import { logout } from '../../store/slices/authSlice'
import { getTenantBusinessTypes } from '../../lib/businessTypes'
import { getNavSections } from '../../lib/sidebarConfig'
import { useTranslation } from '../../lib/translations'
import App3DIcon from '../ui/App3DIcon'

// Pre-defined mapping for standard paths to specific gradients and icons to match Odoo-style uniqueness
const APP_STYLE_MAP = {
  // Finance & Accounting Group (Purple / Indigo)
  '/app/dashboard/finance': { gradient: 'from-[#7F00FF] to-[#E100FF]' },
  '/app/dashboard/invoices': { gradient: 'from-[#7F00FF] to-[#E100FF]' },
  '/app/dashboard/expenses': { gradient: 'from-[#7F00FF] to-[#E100FF]' },
  '/app/dashboard/vat-returns': { gradient: 'from-[#7F00FF] to-[#E100FF]' },
  '/app/dashboard/vouchers': { gradient: 'from-[#7F00FF] to-[#E100FF]' },
  
  // HR & Payroll Group (Pink / Magenta)
  '/app/dashboard/employees': { gradient: 'from-[#FF0080] to-[#FF8C00]' },
  '/app/dashboard/attendance': { gradient: 'from-[#FF0080] to-[#FF8C00]' },
  '/app/dashboard/payroll': { gradient: 'from-[#FF0080] to-[#FF8C00]' },
  '/app/dashboard/hr-reports': { gradient: 'from-[#FF0080] to-[#FF8C00]' },
  '/app/dashboard/leaves': { gradient: 'from-[#FF0080] to-[#FF8C00]' },
  '/app/dashboard/workers': { gradient: 'from-[#FF0080] to-[#FF8C00]' },
  '/app/dashboard/assignments': { gradient: 'from-[#FF0080] to-[#FF8C00]' },
  '/app/dashboard/contracts': { gradient: 'from-[#FF0080] to-[#FF8C00]' },

  // Sales & CRM Group (Orange / Red)
  '/app/dashboard/customers': { gradient: 'from-[#FF4E50] to-[#F9D423]' },
  '/app/dashboard/quotations': { gradient: 'from-[#FF4E50] to-[#F9D423]' },
  '/app/dashboard/contacts': { gradient: 'from-[#FF4E50] to-[#F9D423]' },
  '/app/dashboard/crm': { gradient: 'from-[#FF4E50] to-[#F9D423]' },
  '/app/dashboard/leads': { gradient: 'from-[#FF4E50] to-[#F9D423]' },

  // Inventory & Operations Group (Green / Teal)
  '/app/dashboard/inventory': { gradient: 'from-[#11998e] to-[#38ef7d]' },
  '/app/dashboard/products': { gradient: 'from-[#11998e] to-[#38ef7d]' },
  '/app/dashboard/purchase-orders': { gradient: 'from-[#11998e] to-[#38ef7d]' },
  '/app/dashboard/suppliers': { gradient: 'from-[#11998e] to-[#38ef7d]' },
  '/app/dashboard/shipments': { gradient: 'from-[#11998e] to-[#38ef7d]' },
  '/app/dashboard/warehouses': { gradient: 'from-[#11998e] to-[#38ef7d]' },

  // Project & Task Management (Blue)
  '/app/dashboard/projects': { gradient: 'from-[#00c6ff] to-[#0072ff]' },
  '/app/dashboard/tasks': { gradient: 'from-[#00c6ff] to-[#0072ff]' },
  '/app/dashboard/timesheets': { gradient: 'from-[#00c6ff] to-[#0072ff]' },
  '/app/dashboard/reports': { gradient: 'from-[#00c6ff] to-[#0072ff]' },

  // POS & Restaurant (Amber / Yellow)
  '/app/dashboard/restaurant': { gradient: 'from-[#F2994A] to-[#F2C94C]' },
  '/app/dashboard/pos': { gradient: 'from-[#F2994A] to-[#F2C94C]' },

  // Settings & System (Gray / Slate / Indigo)
  '/app/dashboard/profile': { gradient: 'from-[#4776E6] to-[#8E54E9]' },
  '/app/dashboard/settings': { gradient: 'from-[#4B79A1] to-[#283E51]' },
  '/app/dashboard/users': { gradient: 'from-[#4B79A1] to-[#283E51]' },
  '/app/dashboard/tenant-settings/government-integrations': { gradient: 'from-[#4B79A1] to-[#283E51]' },

  // Dashboard (Cyan / Bright Blue)
  '/app/dashboard': { gradient: 'from-[#4facfe] to-[#00f2fe]' },
}

const getAppStyle = (path = '', title = '') => {
  // Find exact match first
  let match = Object.keys(APP_STYLE_MAP).find(k => path === k)
  
  // If no exact match, find the longest prefix match (excluding just '/app/dashboard')
  if (!match) {
    match = Object.keys(APP_STYLE_MAP)
      .filter(k => k !== '/app/dashboard' && path.startsWith(k))
      .sort((a, b) => b.length - a.length)[0]
  }

  if (match) return APP_STYLE_MAP[match].gradient

  // Fallback to deterministic gradient using full string hash
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
    'from-[#56ab2f] to-[#a8e063]',
    'from-[#f85032] to-[#e73827]',
    'from-[#4ca1af] to-[#c4e0e5]',
    'from-[#ff4b1f] to-[#ff9068]',
    'from-[#1f4037] to-[#99f2c8]',
  ]
  const hash = title.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  return fallbackGradients[hash % fallbackGradients.length]
}

export default function AppLauncher() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { appLauncherOpen, language, hiddenMenuItems, theme, navigationStyle } = useSelector((state) => state.ui)
  const { tenant, user } = useSelector((state) => state.auth)
  const { t } = useTranslation(language)
  const [searchQuery, setSearchQuery] = useState('')

  const hasEmailAddon = tenant?.subscription?.hasEmailAddon === true || (Array.isArray(tenant?.subscription?.features) && tenant.subscription.features.includes('email_automation'))

  const notificationsQuery = useQuery({
    queryKey: ['header-email-notifications'],
    queryFn: () => api.get('/email/messages', { params: { folder: 'all', limit: 8 } }).then((res) => res.data),
    enabled: hasEmailAddon && appLauncherOpen,
    refetchInterval: hasEmailAddon ? 60000 : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
    staleTime: 55000,
    retry: false,
  })

  const notifications = useMemo(() => {
    const messages = notificationsQuery.data?.messages || []
    return messages
      .filter((message) => message.type === 'inbox' && !message.isRead)
      .slice(0, 6)
      .map((message) => ({
        id: message._id,
        type: 'email',
        title: message.subject || (language === 'ar' ? 'رسالة جديدة' : 'New email'),
        subtitle: message.from || '',
        time: new Date(message.createdAt).toLocaleString(language === 'ar' ? 'ar-SA' : 'en-GB', {
          day: '2-digit',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        }),
        read: false,
      }))
  }, [language, notificationsQuery.data])

  const unreadCount = notifications.length

  const markAsRead = async (id) => {
    if (!id) return
    try {
      await api.patch(`/email/messages/${id}/read`, { isRead: true })
    } catch {}
    queryClient.invalidateQueries({ queryKey: ['header-email-notifications'] })
    queryClient.invalidateQueries({ queryKey: ['tenant-email-messages'] })
    dispatch(setAppLauncherOpen(false))
    navigate('/app/dashboard/email')
  }

  const markAllAsRead = async () => {
    await Promise.all(notifications.map((notification) => api.patch(`/email/messages/${notification.id}/read`, { isRead: true }).catch(() => null)))
    queryClient.invalidateQueries({ queryKey: ['header-email-notifications'] })
    queryClient.invalidateQueries({ queryKey: ['tenant-email-messages'] })
  }

  const getNotificationIcon = (type) => {
    switch(type) {
      case 'email': return Mail
      default: return Bell
    }
  }

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
    // When opening any page from here, shift to launcher mode so sidebar is hidden across screens
    dispatch(setNavigationStyle({ tenantId: tenant?._id, style: 'launcher' }))
    dispatch(setHideSidebar(true))
    dispatch(setMobileMenuOpen(false))
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
          <div className="flex items-center justify-between p-4 sm:p-6 h-20 shrink-0 border-b border-gray-200/30 dark:border-white/5 shadow-sm dark:shadow-none">
            <div className="flex items-center gap-2 sm:gap-4 flex-1">
              <button 
                onClick={() => dispatch(setAppLauncherOpen(false))}
                className="p-2 sm:p-2.5 rounded-xl hover:bg-gray-200/50 dark:hover:bg-white/10 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                title={language === 'ar' ? 'إغلاق' : 'Close'}
              >
                <X className="w-6 h-6 sm:w-7 sm:h-7" />
              </button>
              
              <div className="relative flex-1 max-w-md hidden sm:block">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 dark:text-gray-400" />
                <input
                  type="text"
                  autoFocus
                  placeholder={language === 'ar' ? 'بحث عن التطبيقات...' : 'Search apps...'}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white dark:bg-white/10 border border-gray-200 dark:border-transparent focus:bg-white dark:focus:bg-white/20 focus:border-primary-500 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/50 rounded-2xl py-2.5 pl-10 pr-4 outline-none transition-all shadow-sm dark:shadow-none"
                  dir={language === 'ar' ? 'rtl' : 'ltr'}
                />
              </div>
            </div>

            <div className="flex items-center gap-1 sm:gap-2">
              {/* Navigation Style Toggle */}
              <button
                onClick={() => {
                  const next = navigationStyle === 'sidebar' ? 'launcher' : 'sidebar'
                  dispatch(setNavigationStyle({ tenantId: tenant?._id, style: next }))
                  if (next === 'launcher') {
                    dispatch(setHideSidebar(true))
                    dispatch(setMobileMenuOpen(false))
                  } else {
                    dispatch(setHideSidebar(false))
                    dispatch(setAppLauncherOpen(false))
                  }
                }}
                className="hidden md:flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-white/10 border border-gray-200/80 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/20 text-xs font-bold text-gray-700 dark:text-gray-200 shadow-xs transition-colors"
                title={language === 'ar' ? 'تغيير شكل القائمة' : 'Toggle Navigation Style'}
              >
                {navigationStyle === 'sidebar' ? (
                  <>
                    <LayoutGrid className="w-4 h-4 text-primary-500" />
                    <span>{language === 'ar' ? 'إخفاء الشريط الجانبي (قائمة الأيقونات)' : 'Hide Sidebar (App Menu)'}</span>
                  </>
                ) : (
                  <>
                    <PanelLeft className="w-4 h-4 text-emerald-500" />
                    <span>{language === 'ar' ? 'إظهار الشريط الجانبي' : 'Show Sidebar Navigation'}</span>
                  </>
                )}
              </button>

              {/* Language Toggle */}
              <button
                onClick={() => dispatch(setLanguage(language === 'en' ? 'ar' : 'en'))}
                className="p-2 sm:p-2.5 rounded-xl hover:bg-gray-200/50 dark:hover:bg-white/10 transition-colors group relative"
              >
                <Globe className="w-5 h-5 text-gray-600 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-white" />
              </button>

              {/* Theme Toggle */}
              <button
                onClick={() => dispatch(setTheme({ tenantId: tenant?._id, theme: theme === 'dark' ? 'light' : 'dark' }))}
                className="p-2 sm:p-2.5 rounded-xl hover:bg-gray-200/50 dark:hover:bg-white/10 transition-colors group"
                title={theme === 'dark' ? (language === 'ar' ? 'الوضع الفاتح' : 'Light Mode') : (language === 'ar' ? 'الوضع الداكن' : 'Dark Mode')}
              >
                {theme === 'dark' ? (
                  <Sun className="w-5 h-5 text-amber-500 group-hover:text-amber-400" />
                ) : (
                  <Moon className="w-5 h-5 text-gray-600 dark:text-gray-900 group-hover:text-gray-900" />
                )}
              </button>

              {/* Notifications */}
              <Popover className="relative hidden sm:block">
                <Popover.Button className="relative p-2 sm:p-2.5 rounded-xl hover:bg-gray-200/50 dark:hover:bg-white/10 transition-colors focus:outline-none group">
                  <Bell className="w-5 h-5 text-gray-600 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-white" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1 end-1 w-4 h-4 bg-red-500 rounded-full text-[10px] text-white font-medium flex items-center justify-center border-2 border-white dark:border-[#1a1824]">
                      {unreadCount}
                    </span>
                  )}
                </Popover.Button>

                <Transition
                  as={Fragment}
                  enter="transition ease-out duration-100"
                  enterFrom="transform opacity-0 scale-95"
                  enterTo="transform opacity-100 scale-100"
                  leave="transition ease-in duration-75"
                  leaveFrom="transform opacity-100 scale-100"
                  leaveTo="transform opacity-0 scale-95"
                >
                  <Popover.Panel className="absolute end-0 mt-2 w-80 origin-top-right bg-white dark:bg-dark-800 rounded-xl shadow-xl ring-1 ring-black/5 dark:ring-white/10 focus:outline-none overflow-hidden z-50">
                    <div className="p-3 border-b border-gray-100 dark:border-dark-700 flex items-center justify-between">
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        {language === 'ar' ? 'الإشعارات' : 'Notifications'}
                      </h3>
                      {unreadCount > 0 && (
                        <button
                          onClick={markAllAsRead}
                          className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                        >
                          {language === 'ar' ? 'تحديد الكل كمقروء' : 'Mark all read'}
                        </button>
                      )}
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="p-6 text-center text-gray-500 dark:text-gray-400">
                          <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">{language === 'ar' ? 'لا توجد إشعارات' : 'No notifications'}</p>
                        </div>
                      ) : (
                        notifications.map((notification) => {
                          const Icon = getNotificationIcon(notification.type)
                          return (
                            <button
                              key={notification.id}
                              onClick={() => markAsRead(notification.id)}
                              className={`w-full p-3 flex items-start gap-3 hover:bg-gray-50 dark:hover:bg-dark-700 transition-colors text-start ${
                                !notification.read ? 'bg-primary-50/50 dark:bg-primary-900/10' : ''
                              }`}
                            >
                              <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400`}>
                                <Icon className="w-4 h-4" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className={`text-sm ${!notification.read ? 'font-medium text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-300'}`}>
                                  {notification.title}
                                </p>
                                {notification.subtitle ? (
                                  <p className="truncate text-xs text-gray-500 dark:text-gray-400 mt-0.5">{notification.subtitle}</p>
                                ) : null}
                                <p className="text-xs text-gray-400 mt-0.5">{notification.time}</p>
                              </div>
                              {!notification.read && (
                                <span className="w-2 h-2 bg-primary-500 rounded-full flex-shrink-0 mt-2" />
                              )}
                            </button>
                          )
                        })
                      )}
                    </div>
                  </Popover.Panel>
                </Transition>
              </Popover>

              {/* User Profile */}
              <Menu as="div" className="relative ms-2">
                <Menu.Button className="flex items-center gap-2 sm:gap-3 p-1.5 sm:p-2 rounded-xl hover:bg-gray-200/50 dark:hover:bg-white/10 transition-colors focus:outline-none group">
                  <div className="hidden sm:block text-end">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white leading-tight flex items-center gap-1 justify-end">
                      {language === 'ar' ? 'مرحباً،' : 'Welcome,'} <span className="max-w-[150px] truncate">{language === 'ar' ? (tenant?.business?.legalNameAr || tenant?.name || tenant?.business?.legalNameEn || 'المنشأة') : (tenant?.business?.legalNameEn || tenant?.name || tenant?.business?.legalNameAr || 'Business')}</span>
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-300">{user?.name}</p>
                  </div>
                  {tenant?.branding?.logo ? (
                    <img 
                      src={tenant.branding.logo} 
                      alt="Tenant Logo" 
                      className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl object-contain bg-white/10 p-1 shadow-sm ring-2 ring-transparent group-hover:ring-gray-300 dark:group-hover:ring-white/20 transition-all"
                    />
                  ) : (
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 text-white flex items-center justify-center font-bold text-sm sm:text-base shadow-sm ring-2 ring-white dark:ring-dark-800">
                      {user?.name?.charAt(0)?.toUpperCase()}
                    </div>
                  )}
                </Menu.Button>
                
                <Transition
                  as={Fragment}
                  enter="transition ease-out duration-100"
                  enterFrom="transform opacity-0 scale-95"
                  enterTo="transform opacity-100 scale-100"
                  leave="transition ease-in duration-75"
                  leaveFrom="transform opacity-100 scale-100"
                  leaveTo="transform opacity-0 scale-95"
                >
                  <Menu.Items className="absolute end-0 mt-2 w-64 origin-top-right bg-white dark:bg-dark-800 rounded-2xl shadow-2xl ring-1 ring-black/5 dark:ring-white/10 focus:outline-none p-1.5 z-50 border border-gray-100 dark:border-dark-700">
                    <div className="px-3 py-2.5 border-b border-gray-100 dark:border-dark-700/80 mb-1">
                      <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                        {language === 'ar' ? 'الحساب والمنشأة' : 'Account & Company'}
                      </p>
                      <p className="text-sm font-bold text-gray-900 dark:text-white truncate mt-0.5">
                        {language === 'ar' ? (tenant?.business?.legalNameAr || tenant?.name || tenant?.business?.legalNameEn || 'المنشأة') : (tenant?.business?.legalNameEn || tenant?.name || tenant?.business?.legalNameAr || 'Business')}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {user?.email}
                      </p>
                    </div>

                    {/* My Profile */}
                    <Menu.Item>
                      {({ active }) => (
                        <button
                          onClick={() => {
                            dispatch(setNavigationStyle({ tenantId: tenant?._id, style: 'launcher' }))
                            dispatch(setHideSidebar(true))
                            dispatch(setMobileMenuOpen(false))
                            dispatch(setAppLauncherOpen(false))
                            navigate('/app/dashboard/profile')
                          }}
                          className={`${
                            active ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400' : 'text-gray-700 dark:text-gray-300'
                          } flex w-full items-center gap-2.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-colors`}
                        >
                          <Building2 className="w-4 h-4 text-primary-500" />
                          <span>{language === 'ar' ? 'الملف التعريفي والمنشأة' : 'My Profile & Company'}</span>
                        </button>
                      )}
                    </Menu.Item>

                    {/* Settings */}
                    <Menu.Item>
                      {({ active }) => (
                        <button
                          onClick={() => {
                            dispatch(setNavigationStyle({ tenantId: tenant?._id, style: 'launcher' }))
                            dispatch(setHideSidebar(true))
                            dispatch(setMobileMenuOpen(false))
                            dispatch(setAppLauncherOpen(false))
                            navigate('/app/dashboard/settings')
                          }}
                          className={`${
                            active ? 'bg-gray-100 dark:bg-dark-700 text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'
                          } flex w-full items-center gap-2.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-colors`}
                        >
                          <SettingsIcon className="w-4 h-4 text-gray-500" />
                          <span>{language === 'ar' ? 'إعدادات النظام' : 'System Settings'}</span>
                        </button>
                      )}
                    </Menu.Item>

                    <div className="my-1 border-t border-gray-100 dark:border-dark-700" />

                    {/* Sign out */}
                    <Menu.Item>
                      {({ active }) => (
                        <button
                          onClick={() => {
                            dispatch(setAppLauncherOpen(false))
                            dispatch(logout())
                            navigate('/login')
                          }}
                          className={`${
                            active ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400' : 'text-red-600 dark:text-red-400'
                          } flex w-full items-center gap-2.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-colors`}
                        >
                          <LogOut className="w-4 h-4" />
                          <span>{language === 'ar' ? 'تسجيل الخروج' : 'Sign out'}</span>
                        </button>
                      )}
                    </Menu.Item>
                  </Menu.Items>
                </Transition>
              </Menu>
            </div>
          </div>
          
          {/* Mobile Search - Only visible on small screens */}
          <div className="sm:hidden px-4 pt-4 shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 dark:text-gray-400" />
              <input
                type="text"
                placeholder={language === 'ar' ? 'بحث عن التطبيقات...' : 'Search apps...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white dark:bg-white/10 border border-gray-200 dark:border-transparent focus:bg-white dark:focus:bg-white/20 focus:border-primary-500 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/50 rounded-2xl py-2.5 pl-10 pr-4 outline-none transition-all shadow-sm dark:shadow-none"
                dir={language === 'ar' ? 'rtl' : 'ltr'}
              />
            </div>
          </div>

          {/* Apps Grid */}
          <div className="flex-1 overflow-y-auto px-4 pb-12 sm:px-12 pt-8">
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-x-4 gap-y-10 sm:gap-y-12 max-w-7xl mx-auto">
              {filteredApps.map((app, index) => {
                const targetPath = app.path || (app.children && app.children[0]?.path)
                
                return (
                  <motion.button
                    key={index}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.02, duration: 0.3 }}
                    onClick={() => handleAppClick(targetPath)}
                    className="flex flex-col items-center group w-full outline-none"
                  >
                    {/* Ultra-professional 3D Glowing Icon Container */}
                    <div className="relative w-[78px] h-[78px] sm:w-[88px] sm:h-[88px] rounded-[22px] sm:rounded-[26px] bg-gradient-to-b from-[#1E202E] to-[#12131A] dark:from-[#181A26] dark:to-[#0D0E15] shadow-[0_8px_30px_rgba(0,0,0,0.5),0_0_15px_rgba(255,255,255,0.03)] border border-white/10 dark:border-white/10 flex items-center justify-center transform transition-all duration-300 ease-out group-hover:scale-110 group-hover:-translate-y-2 group-hover:shadow-[0_20px_48px_rgba(0,0,0,0.6),0_0_25px_rgba(99,102,241,0.25)] group-hover:border-white/20 group-active:scale-95 group-active:translate-y-0">
                      {/* Subtle top inner reflection */}
                      <div className="absolute inset-0 rounded-[22px] sm:rounded-[26px] bg-gradient-to-b from-white/[0.08] via-transparent to-transparent pointer-events-none" />
                      <App3DIcon
                        path={targetPath || ''}
                        label={app.label || ''}
                        className="w-11 h-11 sm:w-12 sm:h-12 relative z-10 transition-transform duration-300 group-hover:scale-105"
                      />
                    </div>
                    <span className="mt-3.5 text-[12px] sm:text-[13px] font-semibold text-gray-600 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white text-center tracking-wide line-clamp-2 max-w-[90px] transition-colors leading-snug">
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
