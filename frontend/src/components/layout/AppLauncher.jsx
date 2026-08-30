import { useEffect, useMemo, useState } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Search, Bell, Moon, Sun, Globe, LogOut, Mail, Building2, Settings as SettingsIcon, PanelLeft, LayoutGrid, Loader2, Store, HardHat, Plane, UtensilsCrossed, Car, Shirt, Scissors, ShoppingBag, Factory, Pill } from 'lucide-react'
import { Fragment } from 'react'
import { Transition, Popover, Menu } from '@headlessui/react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../../lib/api'
import { setAppLauncherOpen, setLanguage, setTheme, setNavigationStyle, setHideSidebar, setMobileMenuOpen } from '../../store/slices/uiSlice'
import { logout } from '../../store/slices/authSlice'
import { getTenantBusinessTypes } from '../../lib/businessTypes'
import { getNavSections } from '../../lib/sidebarConfig'
import { isNavItemAppVisible } from '../../lib/appStorePartners'
import { useTranslation } from '../../lib/translations'
import App3DIcon from '../ui/App3DIcon'
import useMaqderWebAppInstall from '../../lib/useMaqderWebAppInstall'
import { tenantHasEmailAddon } from '../../lib/emailAddon'
import { isAppAccessValid } from '../../lib/appStoreTrial'
import { getGovChildren } from '../../lib/saudiTenant'
import { HighlightText } from '../ui/highlight-text'

/** Core trading apps pinned first in the launcher grid. */
const CORE_LAUNCHER_PATHS = [
  '/app/dashboard',
  '/app/dashboard/purchases',
  '/app/dashboard/sales',
  '/app/dashboard/inventory',
  '/app/dashboard/accounting',
]

function launcherAppPath(app) {
  return app?.path || app?.children?.[0]?.path || ''
}

function coreLauncherRank(path) {
  const p = String(path || '')
  const idx = CORE_LAUNCHER_PATHS.findIndex((core) => {
    if (core === '/app/dashboard') return p === '/app/dashboard'
    return p === core || p.startsWith(`${core}/`)
  })
  return idx === -1 ? CORE_LAUNCHER_PATHS.length + 1 : idx
}

// Pre-defined mapping for standard paths to specific gradients and icons to match Odoo-style uniqueness
const APP_STYLE_MAP = {
  // Finance & Accounting Group (Purple / Indigo)
  '/app/dashboard/finance': { gradient: 'from-[#7F00FF] to-[#E100FF]' },
  '/app/dashboard/accounting/invoices': { gradient: 'from-[#FF4E50] to-[#F9D423]' },
  '/app/dashboard/sales': { gradient: 'from-[#FF4E50] to-[#F9D423]' },
  '/app/dashboard/sales/orders': { gradient: 'from-[#0F2027] to-[#2C5364]' },
  '/app/dashboard/letterhead': { gradient: 'from-[#7F00FF] to-[#E100FF]' },
  '/app/dashboard/expenses': { gradient: 'from-[#7F00FF] to-[#E100FF]' },
  '/app/dashboard/vat-returns': { gradient: 'from-[#7F00FF] to-[#E100FF]' },
  '/app/dashboard/vouchers': { gradient: 'from-[#7F00FF] to-[#E100FF]' },
  '/app/dashboard/accounting': { gradient: 'from-[#7F00FF] to-[#E100FF]' },
  
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
  '/app/dashboard/customers/statement': { gradient: 'from-[#FF4E50] to-[#F9D423]' },
  '/app/dashboard/quotations': { gradient: 'from-[#FF4E50] to-[#F9D423]' },
  '/app/dashboard/contacts': { gradient: 'from-[#FF4E50] to-[#F9D423]' },
  '/app/dashboard/calendar': { gradient: 'from-[#E11D48] to-[#FB7185]' },
  '/app/dashboard/crm': { gradient: 'from-[#FF4E50] to-[#F9D423]' },
  '/app/dashboard/leads': { gradient: 'from-[#FF4E50] to-[#F9D423]' },

  // Inventory & Operations Group (Green / Teal)
  '/app/dashboard/inventory': { gradient: 'from-[#11998e] to-[#38ef7d]' },
  '/app/dashboard/inventory/products': { gradient: 'from-[#11998e] to-[#38ef7d]' },
  '/app/dashboard/purchases': { gradient: 'from-[#11998e] to-[#38ef7d]' },
  '/app/dashboard/purchase-orders': { gradient: 'from-[#11998e] to-[#38ef7d]' },
  '/app/dashboard/suppliers': { gradient: 'from-[#11998e] to-[#38ef7d]' },
  '/app/dashboard/shipments': { gradient: 'from-[#11998e] to-[#38ef7d]' },
  '/app/dashboard/landed-costs': { gradient: 'from-[#11998e] to-[#38ef7d]' },
  '/app/dashboard/inventory/warehouses': { gradient: 'from-[#11998e] to-[#38ef7d]' },

  // Project & Task Management (Blue)
  '/app/dashboard/projects': { gradient: 'from-[#00c6ff] to-[#0072ff]' },
  '/app/dashboard/tasks': { gradient: 'from-[#00c6ff] to-[#0072ff]' },
  '/app/dashboard/timesheets': { gradient: 'from-[#00c6ff] to-[#0072ff]' },
  '/app/dashboard/reports': { gradient: 'from-[#00c6ff] to-[#0072ff]' },

  // POS & Restaurant (Amber / Yellow)
  '/app/dashboard/restaurant': { gradient: 'from-[#F2994A] to-[#F2C94C]' },
  '/app/dashboard/pos': { gradient: 'from-[#F2994A] to-[#F2C94C]' },

  // Manufacturing & Industrial Group (Orange / Amber)
  '/app/dashboard/manufacturing': { gradient: 'from-[#F97316] to-[#EA580C]' },
  '/app/dashboard/mrp': { gradient: 'from-[#F97316] to-[#EA580C]' },

  // App Store & Add-ons (Violet / Indigo / Cyan)
  '/app/dashboard/app-store': { gradient: 'from-[#8B5CF6] to-[#3B82F6]' },

  // Settings & System (Gray / Slate / Indigo)
  '/app/dashboard/profile': { gradient: 'from-[#4776E6] to-[#8E54E9]' },
  '/app/dashboard/settings': { gradient: 'from-[#4B79A1] to-[#283E51]' },
  '/app/dashboard/users': { gradient: 'from-[#4B79A1] to-[#283E51]' },
  '/app/dashboard/tenant-settings/government-integrations': { gradient: 'from-[#134E4A] to-[#0F766E]' },

  // Government Integration Apps — each gets a distinct Saudi-palette gradient
  '/app/dashboard/tenant-settings/zatca-dashboard': { gradient: 'from-[#006633] to-[#00A34A]' },
  '/app/dashboard/tenant-settings/nbr-dashboard': { gradient: 'from-[#006A4E] to-[#F42A41]' },
  '/app/dashboard/tenant-settings/fbr-dashboard': { gradient: 'from-[#01411C] to-[#0B8A3C]' },
  '/app/dashboard/tenant-settings/government-integrations/zatca': { gradient: 'from-[#006633] to-[#00A34A]' },
  '/app/dashboard/tenant-settings/government-integrations/elm': { gradient: 'from-[#1D4ED8] to-[#3B82F6]' },
  '/app/dashboard/tenant-settings/government-integrations/qiwa': { gradient: 'from-[#7C3AED] to-[#A855F7]' },
  '/app/dashboard/tenant-settings/government-integrations/gosi': { gradient: 'from-[#B45309] to-[#D97706]' },
  '/app/dashboard/tenant-settings/government-integrations/balady': { gradient: 'from-[#065F46] to-[#10B981]' },
  '/app/dashboard/tenant-settings/government-integrations/saber': { gradient: 'from-[#9D174D] to-[#EC4899]' },
  '/app/dashboard/tenant-settings/government-integrations/etimad': { gradient: 'from-[#1E3A5F] to-[#2563EB]' },

  // Gym & Fitness Club (Emerald / Cyan / Indigo)
  '/app/dashboard/gym/dashboard': { gradient: 'from-[#059669] to-[#10B981]' },
  '/app/dashboard/gym/members': { gradient: 'from-[#059669] to-[#10B981]' },
  '/app/dashboard/gym/plans': { gradient: 'from-[#059669] to-[#10B981]' },
  '/app/dashboard/gym/subscriptions': { gradient: 'from-[#059669] to-[#10B981]' },
  '/app/dashboard/gym/checkin': { gradient: 'from-[#059669] to-[#10B981]' },
  '/app/dashboard/gym/classes': { gradient: 'from-[#059669] to-[#10B981]' },
  '/app/dashboard/gym/trainers': { gradient: 'from-[#059669] to-[#10B981]' },
  '/app/dashboard/gym/pt-packages': { gradient: 'from-[#059669] to-[#10B981]' },
  '/app/dashboard/gym/measurements': { gradient: 'from-[#059669] to-[#10B981]' },
  '/app/dashboard/gym/lockers': { gradient: 'from-[#059669] to-[#10B981]' },
  '/app/dashboard/gym/analytics': { gradient: 'from-[#059669] to-[#10B981]' },

  // Marquee & Wedding Hall Management (Gold / Amber / Rose)
  '/app/dashboard/marquee': { gradient: 'from-[#F59E0B] to-[#D97706]' },
  '/app/dashboard/marquee/packages': { gradient: 'from-[#F59E0B] to-[#B45309]' },
  '/app/dashboard/marquee/appointments': { gradient: 'from-[#EC4899] to-[#BE185D]' },
  '/app/dashboard/marquee/qr-menu': { gradient: 'from-[#10B981] to-[#047857]' },

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

const TENANT_TYPE_META = {
  trading: { Icon: Store, labelEn: 'Trading', labelAr: 'تجارة' },
  construction: { Icon: HardHat, labelEn: 'Construction', labelAr: 'مقاولات' },
  travel_agency: { Icon: Plane, labelEn: 'Travel', labelAr: 'سفر' },
  restaurant: { Icon: UtensilsCrossed, labelEn: 'Restaurant', labelAr: 'مطعم' },
  car_rental: { Icon: Car, labelEn: 'Car Rental', labelAr: 'تأجير' },
  laundry: { Icon: Shirt, labelEn: 'Laundry', labelAr: 'مغسلة' },
  saloon: { Icon: Scissors, labelEn: 'Saloon', labelAr: 'صالون' },
  khayyat: { Icon: Scissors, labelEn: 'Tailor', labelAr: 'خياط' },
  boutique: { Icon: ShoppingBag, labelEn: 'Boutique', labelAr: 'بوتيك' },
  bakala: { Icon: Store, labelEn: 'Retail', labelAr: 'بقالة' },
  pharmacy: { Icon: Pill, labelEn: 'Pharmacy', labelAr: 'صيدلية' },
  manufacturing: { Icon: Factory, labelEn: 'Manufacturing', labelAr: 'تصنيع' },
}

/** Extra keywords so modules resolve when users type shortcuts like PO / GRN */
const MODULE_SEARCH_ALIASES = {
  '/app/dashboard/purchases/orders': ['po', 'purchase order', 'purchase orders', 'طلبات الشراء', 'أمر شراء'],
  '/app/dashboard/purchases/grn': ['grn', 'goods receipt', 'receipt', 'receipts', 'إشعار استلام', 'استلام'],
  '/app/dashboard/purchases/suppliers': ['supplier', 'suppliers', 'vendor', 'مورد', 'موردون'],
  '/app/dashboard/accounting/invoices': ['invoice', 'invoices', 'فاتورة', 'فواتير', 'inv'],
  '/app/dashboard/quotations': ['quotation', 'quotations', 'quote', 'quotes', 'عرض سعر', 'عروض الأسعار'],
  '/app/dashboard/sales/orders': ['sales order', 'sales orders', 'sale order', 'so', 'أمر بيع', 'أوامر البيع'],
  '/app/dashboard/inventory/products': ['product', 'products', 'منتج', 'منتجات'],
  '/app/dashboard/inventory/warehouses': ['warehouse', 'warehouses', 'مستودع', 'مستودعات'],
  '/app/dashboard/customers': ['customer', 'customers', 'عميل', 'عملاء'],
  '/app/dashboard/suppliers': ['supplier', 'suppliers', 'vendor', 'مورد'],
}

function normalizeSearchText(value = '') {
  return String(value).toLowerCase().trim()
}

function matchesSearchQuery(query, ...parts) {
  if (!query) return true
  const haystack = parts
    .flat()
    .filter(Boolean)
    .map(normalizeSearchText)
    .join(' ')
  if (!haystack) return false
  if (haystack.includes(query)) return true
  // Allow short aliases like "po" to match when query is exact alias token
  return parts
    .flat()
    .filter(Boolean)
    .map(normalizeSearchText)
    .some((part) => part === query || (query.length >= 2 && part.startsWith(query)))
}

export default function AppLauncher() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { appLauncherOpen, language, hiddenMenuItems, theme, navigationStyle } = useSelector((state) => state.ui)
  const { tenant, user } = useSelector((state) => state.auth)
  const { t } = useTranslation(language)
  const { install: installMaqderWebApp } = useMaqderWebAppInstall(language)
  const [searchQuery, setSearchQuery] = useState('')
  const [navigatingTo, setNavigatingTo] = useState(null)
  
  const location = useLocation()
  
  const hasEmailAddon = tenantHasEmailAddon(tenant)

  const notificationsQuery = useQuery({
    queryKey: ['header-email-notifications'],
    queryFn: async () => {
      try {
        const { data } = await api.get('/email/messages', { params: { folder: 'all', limit: 8 } })
        return data
      } catch (err) {
        if (err?.response?.status === 403) return { messages: [] }
        throw err
      }
    },
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
  const hiddenMenuKey = useMemo(
    () => (hiddenMenuItems || []).filter((p) => !['/app/dashboard/settings', '/app/dashboard/hidden-navbars'].includes(p)).join('|'),
    [hiddenMenuItems],
  )
  const hiddenMenuSet = useMemo(
    () => new Set(hiddenMenuKey ? hiddenMenuKey.split('|') : []),
    [hiddenMenuKey],
  )

  const govChildren = getGovChildren(tenant, language)
  const hasAccess = (module, action) => {
    if (!user) return false
    if (user.role === 'super_admin' || user.role === 'admin') return true
    const perm = Array.isArray(user.permissions) ? user.permissions.find((p) => p?.module === module) : null
    const actions = Array.isArray(perm?.actions) ? perm.actions : []
    return actions.includes(action)
  }

  // Calculate visible apps (similar to Sidebar logic but flattened)
  const { allApps, allModules } = useMemo(() => {
    if (!appLauncherOpen) return { allApps: [], allModules: [] }
    const navSections = getNavSections({ language, t, tenant, businessTypes, govChildren })
    const apps = []

    navSections.forEach((section) => {
      if (Array.isArray(section.excludeBusinessTypes) && section.excludeBusinessTypes.some((type) => businessTypes.includes(type))) {
        return
      }

      if (!isNavItemAppVisible(tenant, businessTypes, section)) {
        return
      }

      const items = (Array.isArray(section.items) ? section.items : []).filter((item) => {
        if (item.path && hiddenMenuSet.has(item.path)) return false
        const childPath = item.children?.[0]?.path
        if (childPath && hiddenMenuSet.has(childPath)) return false
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

    // Pin Dashboard → Purchases → Sales → Inventory → Accounting at the front
    uniqueApps.sort((a, b) => {
      const ra = coreLauncherRank(launcherAppPath(a))
      const rb = coreLauncherRank(launcherAppPath(b))
      if (ra !== rb) return ra - rb
      return 0
    })

    // Expand nested children into searchable modules (PO, Invoices, Quotations, …)
    const modules = []
    const seenModulePaths = new Set()
    for (const app of uniqueApps) {
      const children = Array.isArray(app.children) ? app.children : []
      children.forEach((child) => {
        if (!child?.path || hiddenMenuSet.has(child.path)) return
        if (Array.isArray(child.excludeBusinessTypes) && child.excludeBusinessTypes.some((type) => businessTypes.includes(type))) {
          return
        }
        if (child.perm && !hasAccess(child.perm.module, child.perm.action)) return
        // Skip overview/duplicate of parent root
        if (child.path === app.path && (child.end || /overview/i.test(child.label || ''))) return
        if (seenModulePaths.has(child.path)) return
        seenModulePaths.add(child.path)
        modules.push({
          ...child,
          icon: child.icon || app.icon,
          parentLabel: app.label,
          parentPath: app.path,
          aliases: MODULE_SEARCH_ALIASES[child.path] || [],
          isModule: true,
        })
      })
    }

    return { allApps: uniqueApps, allModules: modules }
  }, [appLauncherOpen, language, tenant, businessTypes, hiddenMenuSet, user, govChildren, t])

  const filteredApps = useMemo(() => {
    if (!searchQuery.trim()) return allApps

    const query = normalizeSearchText(searchQuery)

    const matchedApps = allApps.filter((app) => {
      const path = app.path || app.children?.[0]?.path
      return matchesSearchQuery(query, app.label, MODULE_SEARCH_ALIASES[path], path)
    })

    // When searching, surface modules (Purchase Orders, Invoices, Quotations, …)
    const matchedModules = allModules.filter((mod) =>
      matchesSearchQuery(query, mod.label, mod.parentLabel, mod.aliases, mod.path)
    )

    const merged = []
    const seen = new Set()
    // Prefer exact module hits first so "PO" → Purchase Orders, not only Purchases app
    ;[...matchedModules, ...matchedApps].forEach((item) => {
      const path = item.path || item.children?.[0]?.path
      if (!path || seen.has(path)) return
      seen.add(path)
      merged.push(item)
    })

    return merged
  }, [allApps, allModules, searchQuery])

  const isSearching = Boolean(searchQuery.trim())

  // Prevent background scrolling when open and support ESC key
  useEffect(() => {
    if (appLauncherOpen) {
      document.body.style.overflow = 'hidden'
      const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
          dispatch(setAppLauncherOpen(false))
        }
      }
      window.addEventListener('keydown', handleKeyDown)
      return () => {
        document.body.style.overflow = ''
        window.removeEventListener('keydown', handleKeyDown)
      }
    } else {
      document.body.style.overflow = ''
      setSearchQuery('')
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [appLauncherOpen, dispatch])

  const handleAppClick = (path) => {
    dispatch(setAppLauncherOpen(false))
    dispatch(setMobileMenuOpen(false))
    setNavigatingTo(null)
    
    if (path) {
      if (location.pathname !== path) {
        navigate(path)
      }
    }
  }

  return (
    <AnimatePresence>
      {appLauncherOpen && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98, y: -12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98, y: 16 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          className="fixed inset-0 z-[100] flex flex-col overflow-hidden bg-[#f4f6f9] dark:bg-[#0c0f14]"
        >
          {/* Ambient atmosphere */}
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div className="absolute -top-32 left-1/2 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-emerald-400/20 blur-[100px] dark:bg-emerald-500/10" />
            <div className="absolute bottom-0 right-0 h-[320px] w-[420px] rounded-full bg-teal-300/15 blur-[90px] dark:bg-teal-500/10" />
            <div className="absolute inset-0 opacity-[0.035] dark:opacity-[0.05]" style={{ backgroundImage: 'linear-gradient(#0f172a 1px,transparent 1px),linear-gradient(90deg,#0f172a 1px,transparent 1px)', backgroundSize: '48px 48px' }} />
          </div>

          {/* Header Bar */}
          <header className="relative z-[120] isolate shrink-0 border-b border-slate-200/70 bg-white/75 backdrop-blur-2xl dark:border-white/[0.06] dark:bg-[#12161d]/80">
            <div className="mx-auto flex h-[4.5rem] max-w-[90rem] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
              <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={() => dispatch(setAppLauncherOpen(false))}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-slate-200/80 bg-white text-slate-500 shadow-sm transition-all hover:border-slate-300 hover:text-slate-900 dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
                  title={language === 'ar' ? 'إغلاق' : 'Close'}
                >
                  <X className="h-5 w-5" />
                </button>

                <div className="relative hidden min-w-0 flex-1 max-w-xl sm:block">
                  <Search className={`pointer-events-none absolute top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400 ${language === 'ar' ? 'right-4' : 'left-4'}`} />
                  <input
                    type="text"
                    autoFocus
                    placeholder={language === 'ar' ? 'بحث عن التطبيقات والوحدات...' : 'Search apps & modules...'}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className={`w-full rounded-2xl border border-slate-200/90 bg-slate-50/80 py-2.5 text-sm font-medium text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 dark:border-white/10 dark:bg-white/[0.06] dark:text-white dark:placeholder:text-white/40 dark:focus:border-emerald-400/50 dark:focus:bg-white/[0.1] ${language === 'ar' ? 'pl-4 pr-11' : 'pl-11 pr-4'}`}
                    dir={language === 'ar' ? 'rtl' : 'ltr'}
                  />
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
                <button
                  type="button"
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
                  className="hidden items-center gap-2 rounded-2xl border border-emerald-200/80 bg-emerald-50 px-3.5 py-2 text-xs font-bold text-emerald-700 shadow-sm transition-all hover:-translate-y-0.5 hover:bg-emerald-100 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300 md:inline-flex"
                  title={language === 'ar' ? 'تغيير شكل القائمة' : 'Toggle Navigation Style'}
                >
                  {navigationStyle === 'sidebar' ? (
                    <>
                      <LayoutGrid className="h-4 w-4" />
                      <span>{language === 'ar' ? 'قائمة الأيقونات' : 'App menu'}</span>
                    </>
                  ) : (
                    <>
                      <PanelLeft className="h-4 w-4" />
                      <span>{language === 'ar' ? 'الشريط الجانبي' : 'Show sidebar'}</span>
                    </>
                  )}
                </button>

                <div className="flex items-center gap-0.5 rounded-2xl border border-slate-200/80 bg-white/90 p-1 shadow-sm dark:border-white/10 dark:bg-white/[0.06]">
                  <button
                    type="button"
                    onClick={() => dispatch(setLanguage(language === 'en' ? 'ar' : 'en'))}
                    className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
                    title={language === 'ar' ? 'English' : 'العربية'}
                  >
                    <Globe className="h-[18px] w-[18px]" />
                  </button>
                  <button
                    type="button"
                    onClick={() => dispatch(setTheme({ tenantId: tenant?._id, theme: theme === 'dark' ? 'light' : 'dark' }))}
                    className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
                    title={theme === 'dark' ? (language === 'ar' ? 'الوضع الفاتح' : 'Light Mode') : (language === 'ar' ? 'الوضع الداكن' : 'Dark Mode')}
                  >
                    {theme === 'dark' ? <Sun className="h-[18px] w-[18px] text-amber-400" /> : <Moon className="h-[18px] w-[18px]" />}
                  </button>

                  <Popover className="relative hidden sm:block">
                    <Popover.Button className="relative flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus:outline-none dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white">
                      <Bell className="h-[18px] w-[18px]" />
                      {unreadCount > 0 && (
                        <span className="absolute top-1 end-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-500 px-1 text-[10px] font-bold text-white ring-2 ring-white dark:ring-[#12161d]">
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
                      <Popover.Panel className="absolute end-0 z-[200] mt-2 w-80 origin-top-right overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xl ring-1 ring-black/5 focus:outline-none dark:border-white/10 dark:bg-[#161b24] dark:ring-white/10">
                        <div className="flex items-center justify-between border-b border-slate-100 p-3 dark:border-white/10">
                          <h3 className="font-semibold text-slate-900 dark:text-white">
                            {language === 'ar' ? 'الإشعارات' : 'Notifications'}
                          </h3>
                          {unreadCount > 0 && (
                            <button
                              type="button"
                              onClick={markAllAsRead}
                              className="text-xs font-bold text-emerald-600 hover:text-emerald-700"
                            >
                              {language === 'ar' ? 'تحديد الكل كمقروء' : 'Mark all read'}
                            </button>
                          )}
                        </div>
                        <div className="max-h-80 overflow-y-auto">
                          {notifications.length === 0 ? (
                            <div className="p-6 text-center text-slate-500 dark:text-slate-400">
                              <Bell className="mx-auto mb-2 h-8 w-8 opacity-50" />
                              <p className="text-sm">{language === 'ar' ? 'لا توجد إشعارات' : 'No notifications'}</p>
                            </div>
                          ) : (
                            notifications.map((notification) => {
                              const Icon = getNotificationIcon(notification.type)
                              return (
                                <button
                                  key={notification.id}
                                  type="button"
                                  onClick={() => markAsRead(notification.id)}
                                  className={`flex w-full items-start gap-3 p-3 text-start transition-colors hover:bg-slate-50 dark:hover:bg-white/[0.04] ${
                                    !notification.read ? 'bg-emerald-50/60 dark:bg-emerald-500/10' : ''
                                  }`}
                                >
                                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
                                    <Icon className="h-4 w-4" />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className={`text-sm ${!notification.read ? 'font-semibold text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-300'}`}>
                                      {notification.title}
                                    </p>
                                    {notification.subtitle ? (
                                      <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">{notification.subtitle}</p>
                                    ) : null}
                                    <p className="mt-0.5 text-xs text-slate-400">{notification.time}</p>
                                  </div>
                                  {!notification.read && (
                                    <span className="mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-emerald-500" />
                                  )}
                                </button>
                              )
                            })
                          )}
                        </div>
                      </Popover.Panel>
                    </Transition>
                  </Popover>
                </div>

                <Menu as="div" className="relative ms-1">
                  <Menu.Button className="flex items-center gap-2.5 rounded-2xl border border-slate-200/80 bg-white py-1.5 pe-2 ps-2.5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md focus:outline-none dark:border-white/10 dark:bg-white/[0.06] dark:hover:border-emerald-500/30 sm:ps-3">
                    <div className="hidden text-end sm:block">
                      <p className="flex items-center justify-end gap-1 text-[13px] font-bold leading-tight text-slate-900 dark:text-white">
                        {language === 'ar' ? 'مرحباً،' : 'Welcome,'}
                        <span className="max-w-[140px] truncate text-emerald-700 dark:text-emerald-300">
                          {language === 'ar'
                            ? (tenant?.business?.legalNameAr || tenant?.name || tenant?.business?.legalNameEn || 'المنشأة')
                            : (tenant?.business?.legalNameEn || tenant?.name || tenant?.business?.legalNameAr || 'Business')}
                        </span>
                      </p>
                      <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">{user?.name}</p>
                    </div>
                    {(() => {
                      const logoSrc = String(tenant?.branding?.logo || '').trim()
                      if (!logoSrc) {
                        return (
                          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-sm font-bold text-white shadow-sm ring-2 ring-white dark:ring-[#12161d]">
                            {user?.name?.charAt(0)?.toUpperCase()}
                          </div>
                        )
                      }
                      return (
                        <img
                          src={logoSrc}
                          alt={tenant?.name || 'Tenant'}
                          className="h-9 w-9 rounded-xl object-contain bg-white p-0.5 ring-1 ring-slate-200/80 dark:ring-white/15"
                        />
                      )
                    })()}
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
                    <Menu.Items className="absolute end-0 z-[200] mt-2 w-[300px] origin-top-right overflow-hidden rounded-[1.35rem] border border-slate-200/80 bg-white shadow-[0_28px_60px_-28px_rgba(15,23,42,0.45)] ring-1 ring-black/5 focus:outline-none dark:border-white/10 dark:bg-[#161b24] dark:ring-white/10">
                      <div className="relative overflow-hidden border-b border-slate-100 bg-gradient-to-br from-emerald-50 via-white to-teal-50/40 px-4 pb-4 pt-4 dark:border-white/10 dark:from-emerald-500/10 dark:via-[#161b24] dark:to-teal-500/5">
                        <div className="flex items-center gap-3">
                          {(tenant?.branding?.logo || tenant?.settings?.invoiceBranding?.logo) ? (
                            <img
                              src={tenant?.branding?.logo || tenant?.settings?.invoiceBranding?.logo}
                              alt="Tenant"
                              className="h-14 w-14 rounded-2xl object-contain bg-white p-1.5 shadow-md ring-1 ring-slate-200/80 dark:ring-white/15"
                            />
                          ) : (
                            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-lg font-black text-white shadow-md">
                              {(language === 'ar'
                                ? (tenant?.business?.legalNameAr || tenant?.name || 'م')
                                : (tenant?.business?.legalNameEn || tenant?.name || 'B')).charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-700/80 dark:text-emerald-300/80">
                              {language === 'ar' ? 'الحساب والمنشأة' : 'Account & Company'}
                            </p>
                            <p className="mt-0.5 truncate text-[15px] font-extrabold tracking-tight text-slate-950 dark:text-white">
                              {language === 'ar'
                                ? (tenant?.business?.legalNameAr || tenant?.name || tenant?.business?.legalNameEn || 'المنشأة')
                                : (tenant?.business?.legalNameEn || tenant?.name || tenant?.business?.legalNameAr || 'Business')}
                            </p>
                            <p className="truncate text-xs font-medium text-slate-500 dark:text-slate-400">{user?.email}</p>
                          </div>
                        </div>

                        {businessTypes?.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {businessTypes.slice(0, 6).map((type) => {
                              const meta = TENANT_TYPE_META[type] || { Icon: Building2, labelEn: type, labelAr: type }
                              const TypeIcon = meta.Icon
                              return (
                                <span
                                  key={type}
                                  className="inline-flex items-center gap-1 rounded-full border border-emerald-200/80 bg-white/90 px-2 py-1 text-[10px] font-bold text-emerald-700 shadow-sm dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300"
                                >
                                  <TypeIcon className="h-3 w-3" />
                                  {language === 'ar' ? meta.labelAr : meta.labelEn}
                                </span>
                              )
                            })}
                          </div>
                        )}
                      </div>

                      <div className="p-1.5">
                        <Menu.Item>
                          {({ active }) => (
                            <button
                              type="button"
                              onClick={() => {
                                dispatch(setMobileMenuOpen(false))
                                dispatch(setAppLauncherOpen(false))
                                installMaqderWebApp()
                              }}
                              className={`${
                                active ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' : 'text-slate-700 dark:text-slate-300'
                              } flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors`}
                            >
                              <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white ring-1 ring-emerald-200/90 shadow-sm dark:bg-white/95 dark:ring-emerald-500/30">
                                <img src="/MaqderFavicon.png" alt="Maqder" className="h-6 w-6 object-contain" />
                              </span>
                              <span className="text-start leading-snug">
                                {language === 'ar' ? 'تثبيت تطبيق مقدر على الويب' : 'Install web based application of Maqder'}
                              </span>
                            </button>
                          )}
                        </Menu.Item>

                        <Menu.Item>
                          {({ active }) => (
                            <button
                              type="button"
                              onClick={() => {
                                dispatch(setNavigationStyle({ tenantId: tenant?._id, style: 'launcher' }))
                                dispatch(setHideSidebar(true))
                                dispatch(setMobileMenuOpen(false))
                                dispatch(setAppLauncherOpen(false))
                                navigate('/app/dashboard/profile')
                              }}
                              className={`${
                                active ? 'bg-slate-100 text-slate-900 dark:bg-white/10 dark:text-white' : 'text-slate-700 dark:text-slate-300'
                              } flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors`}
                            >
                              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400">
                                <Building2 className="h-4 w-4" />
                              </span>
                              <span>{language === 'ar' ? 'ملف المنشأة والشركة' : 'Company Profile'}</span>
                            </button>
                          )}
                        </Menu.Item>

                        <Menu.Item>
                          {({ active }) => (
                            <button
                              type="button"
                              onClick={() => {
                                dispatch(setNavigationStyle({ tenantId: tenant?._id, style: 'launcher' }))
                                dispatch(setHideSidebar(true))
                                dispatch(setMobileMenuOpen(false))
                                dispatch(setAppLauncherOpen(false))
                                navigate('/app/dashboard/settings')
                              }}
                              className={`${
                                active ? 'bg-slate-100 text-slate-900 dark:bg-white/10 dark:text-white' : 'text-slate-700 dark:text-slate-300'
                              } flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors`}
                            >
                              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-500 dark:bg-white/10">
                                <SettingsIcon className="h-4 w-4" />
                              </span>
                              <span>{language === 'ar' ? 'إعدادات النظام' : 'System Settings'}</span>
                            </button>
                          )}
                        </Menu.Item>

                        <div className="my-1 border-t border-slate-100 dark:border-white/10" />

                        <Menu.Item>
                          {({ active }) => (
                            <button
                              type="button"
                              onClick={() => {
                                dispatch(setAppLauncherOpen(false))
                                dispatch(logout())
                                navigate('/login')
                              }}
                              className={`${
                                active ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400' : 'text-red-600 dark:text-red-400'
                              } flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors`}
                            >
                              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-red-50 text-red-500 dark:bg-red-500/10">
                                <LogOut className="h-4 w-4" />
                              </span>
                              <span>{language === 'ar' ? 'تسجيل الخروج' : 'Sign out'}</span>
                            </button>
                          )}
                        </Menu.Item>
                      </div>
                    </Menu.Items>
                  </Transition>
                </Menu>
              </div>
            </div>
          </header>

          {/* Mobile Search */}
          <div className="relative z-30 shrink-0 px-4 pt-4 sm:hidden">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder={language === 'ar' ? 'بحث عن التطبيقات والوحدات...' : 'Search apps & modules...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-2xl border border-slate-200/90 bg-white/90 py-2.5 pl-11 pr-4 text-sm font-medium text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/10 dark:border-white/10 dark:bg-white/[0.06] dark:text-white dark:placeholder:text-white/40"
                dir={language === 'ar' ? 'rtl' : 'ltr'}
              />
            </div>
          </div>

          {/* Apps Grid */}
          <div className="relative z-0 isolate flex-1 overflow-y-auto px-4 pb-14 pt-8 sm:px-10 lg:px-12">
            <div className="mx-auto mb-8 max-w-7xl">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200/70 bg-emerald-50 px-3 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.2em] text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {language === 'ar' ? 'مساحة العمل' : 'Workspace'}
              </span>
              <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-950 dark:text-white sm:text-3xl lg:text-4xl">
                {language === 'ar' ? (
                  isSearching ? (
                    <HighlightText variant="lime">الوحدات</HighlightText>
                  ) : (
                    <HighlightText variant="lime">تطبيقاتك</HighlightText>
                  )
                ) : isSearching ? (
                  <>
                    Matching <HighlightText variant="lime">Modules</HighlightText>
                  </>
                ) : (
                  <>
                    Your <HighlightText variant="lime">Apps</HighlightText>
                  </>
                )}
              </h2>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                {language === 'ar'
                  ? isSearching
                    ? 'نتائج من التطبيقات والوحدات مثل طلبات الشراء والفواتير وعروض الأسعار.'
                    : 'اختر تطبيقاً للبدء — كل شيء في مكان واحد.'
                  : isSearching
                    ? 'Results include modules like Purchase Orders, Invoices, and Quotations.'
                    : 'Pick an app to get started — everything in one place.'}
              </p>
            </div>

            <div className="mx-auto grid max-w-7xl grid-cols-3 gap-x-3 gap-y-9 sm:grid-cols-4 sm:gap-x-5 sm:gap-y-11 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8">
              {filteredApps.map((app, index) => {
                const targetPath = app.path || (app.children && app.children[0]?.path)
                const title = app.label || ''
                const subtitle = app.isModule && app.parentLabel ? app.parentLabel : null

                return (
                  <motion.button
                    key={targetPath || index}
                    type="button"
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(index * 0.015, 0.35), duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                    onClick={() => handleAppClick(targetPath)}
                    className="group flex w-full flex-col items-center outline-none"
                  >
                    <div className="relative flex h-[76px] w-[76px] items-center justify-center rounded-[22%] bg-gradient-to-b from-white to-[#f3f5f8] shadow-[0_1px_2px_rgba(15,23,42,0.05),0_14px_36px_-16px_rgba(15,23,42,0.28),inset_0_1px_0_rgba(255,255,255,0.95)] ring-1 ring-black/[0.04] transition-all duration-300 ease-out group-hover:-translate-y-1.5 group-hover:scale-[1.06] group-hover:shadow-[0_18px_40px_-18px_rgba(5,150,105,0.35),0_8px_20px_-10px_rgba(15,23,42,0.2)] group-hover:ring-emerald-400/30 group-active:translate-y-0 group-active:scale-95 dark:from-[#1a2030] dark:to-[#121722] dark:shadow-[0_12px_32px_-14px_rgba(0,0,0,0.65)] dark:ring-white/[0.08] dark:group-hover:ring-emerald-400/25 sm:h-[88px] sm:w-[88px]">
                      <div className="pointer-events-none absolute inset-[1px] rounded-[21%] bg-gradient-to-b from-white/90 via-white/15 to-transparent dark:from-white/[0.08] dark:via-transparent" />
                      <App3DIcon
                        path={targetPath || ''}
                        label={title}
                        className="relative h-12 w-12 drop-shadow-[0_2px_6px_rgba(15,23,42,0.12)] transition-transform duration-300 group-hover:scale-105 sm:h-[3.35rem] sm:w-[3.35rem]"
                      />
                      {navigatingTo === targetPath && (
                        <div className="absolute inset-0 z-20 flex items-center justify-center rounded-[22%] bg-white/70 backdrop-blur-sm dark:bg-black/45">
                          <Loader2 className="h-6 w-6 animate-spin text-emerald-600 dark:text-emerald-300" />
                        </div>
                      )}
                    </div>
                    <span className="mt-3 max-w-[96px] text-center text-[11.5px] font-semibold leading-snug tracking-wide text-slate-600 transition-colors line-clamp-2 group-hover:text-slate-950 dark:text-slate-300 dark:group-hover:text-white sm:text-[12.5px]">
                      {title}
                    </span>
                    {subtitle ? (
                      <span className="mt-0.5 max-w-[96px] text-center text-[10px] font-medium text-slate-400 line-clamp-1 dark:text-slate-500">
                        {subtitle}
                      </span>
                    ) : null}
                  </motion.button>
                )
              })}

              {filteredApps.length === 0 && (
                <div className="col-span-full flex flex-col items-center justify-center py-20 text-slate-400 dark:text-white/50">
                  <Search className="mb-4 h-14 w-14 opacity-50" />
                  <p className="text-lg font-semibold">
                    {language === 'ar' ? 'لا توجد تطبيقات أو وحدات مطابقة' : 'No apps or modules found'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
