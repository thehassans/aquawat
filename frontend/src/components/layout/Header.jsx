import { useSelector, useDispatch } from 'react-redux'
import { Menu, Search, Bell, Moon, Sun, Globe, LogOut, X, Mail, Crown, LayoutGrid, PanelLeft, LayoutList, User, Settings as SettingsIcon, Building2, Store, HardHat, Plane, UtensilsCrossed, Car, Shirt, Scissors, ShoppingBag, Factory, Pill } from 'lucide-react'
import { Fragment, useState, useEffect, useRef, useMemo } from 'react'
import { Transition, Popover, Menu as HeadlessMenu } from '@headlessui/react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useLocation } from 'react-router-dom'
import api from '../../lib/api'
import { logout } from '../../store/slices/authSlice'
import { setTheme, setLanguage, setMobileMenuOpen, setAppLauncherOpen, setNavigationStyle, setHideSidebar } from '../../store/slices/uiSlice'
import { useTranslation } from '../../lib/translations'
import DemoBanner from './DemoBanner'
import TrialLimitModal from './TrialLimitModal'
import GlobalSearch from './GlobalSearch'
import SubscriptionBadge from './SubscriptionBadge'
import { showArabicUi } from '../../lib/saudiTenant'
import { getTenantBusinessTypes } from '../../lib/businessTypes'
import useMaqderWebAppInstall from '../../lib/useMaqderWebAppInstall'
import { tenantHasEmailAddon } from '../../lib/emailAddon'

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
  ecommerce: { Icon: ShoppingBag, labelEn: 'eCommerce', labelAr: 'متجر' },
}

export default function Header() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const { tenant, user } = useSelector((state) => state.auth)
  const { theme, language, navigationStyle } = useSelector((state) => state.ui)
  const { t } = useTranslation(language)
  const { install: installMaqderWebApp } = useMaqderWebAppInstall(language)
  const arabicUi = showArabicUi(tenant)
  const tenantBusinessTypes = getTenantBusinessTypes(tenant)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const searchRef = useRef(null)
  const hasEmailAddon = tenantHasEmailAddon(tenant)

  const notificationsQuery = useQuery({
    queryKey: ['header-email-notifications'],
    queryFn: async () => {
      try {
        const { data } = await api.get('/email/messages', { params: { folder: 'all', limit: 8 } })
        return data
      } catch (err) {
        // Addon not enabled / not entitled — keep the header quiet.
        if (err?.response?.status === 403) return { messages: [] }
        throw err
      }
    },
    enabled: hasEmailAddon,
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
    } catch {
    }
    queryClient.invalidateQueries({ queryKey: ['header-email-notifications'] })
    queryClient.invalidateQueries({ queryKey: ['tenant-email-messages'] })
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

  const handleSearch = (e) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      if (query.includes('invoice') || query.includes('فاتورة')) {
        navigate('/app/dashboard/invoices')
      } else if (query.includes('expense') || query.includes('expenses') || query.includes('مصروف') || query.includes('مصاريف')) {
        navigate('/app/dashboard/expenses')
      } else if (query.includes('employee') || query.includes('موظف')) {
        navigate('/app/dashboard/employees')
      } else if (query.includes('customer') || query.includes('عميل')) {
        navigate('/app/dashboard/customers')
      } else if (query.includes('contact') || query.includes('contacts') || query.includes('جهات') || query.includes('اتصال')) {
        navigate('/app/dashboard/contacts')
      } else if (query.includes('product') || query.includes('منتج')) {
        navigate('/app/dashboard/products')
      } else if (query.includes('report') || query.includes('تقرير')) {
        navigate('/app/dashboard/reports')
      }
      setSearchQuery('')
      setSearchOpen(false)
    }
  }

  const headerStyle = tenant?.branding?.headerStyle || 'glass'
  const headerClassName =
    headerStyle === 'solid'
      ? 'sticky top-0 z-30 bg-white dark:bg-dark-800 border-b border-gray-200 dark:border-dark-700'
      : 'sticky top-0 z-30 bg-white/80 dark:bg-dark-800/80 backdrop-blur-xl border-b border-gray-200 dark:border-dark-700'

  return (
    <header className={headerClassName}>
      <DemoBanner />
      <TrialLimitModal />
      <div className="flex items-center justify-between px-4 lg:px-6 h-16">
        {/* Left Side */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => dispatch(setMobileMenuOpen(true))}
            className="lg:hidden p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors"
          >
            <Menu className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
          
          <button
            onClick={() => {
              dispatch(setNavigationStyle({ tenantId: tenant?._id, style: 'launcher' }))
              dispatch(setHideSidebar(true))
              dispatch(setMobileMenuOpen(false))
              dispatch(setAppLauncherOpen(true))
            }}
            className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors"
            title={language === 'ar' ? 'قائمة التطبيقات (إخفاء الشريط الجانبي)' : 'App Menu (Hide Sidebar)'}
          >
            <LayoutGrid className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>

          {/* Search */}
          <div className="hidden sm:flex items-center">
            <GlobalSearch language={language} />
          </div>
        </div>

        {/* Right Side */}
        <div className="flex items-center gap-2">
          <SubscriptionBadge tenant={tenant} language={language} />
          {/* Get Full Version CTA — demo/trial users */}
          {((tenant?.isDemo === true && tenant?.demoUpgraded !== true) || tenant?.subscription?.plan === 'trial' || tenant?.subscription?.status === 'expired') && (
            <button
              onClick={() => navigate('/demo-checkout')}
              className="hidden sm:inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-3 py-2 text-xs font-bold text-white shadow-sm transition hover:shadow-md"
            >
              <Crown className="h-3.5 w-3.5" />
              {language === 'ar' ? 'اشترك الآن' : 'Subscribe'}
            </button>
          )}

          {/* Language Toggle — Arabic only for GCC / Middle East tenants */}
          {arabicUi && (
            <button
              onClick={() => dispatch(setLanguage(language === 'en' ? 'ar' : 'en'))}
              className="p-2.5 rounded-xl hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors group relative"
            >
              <Globe className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              <span className="tooltip -bottom-10 start-1/2 -translate-x-1/2 whitespace-nowrap">
                {language === 'en' ? 'العربية' : 'English'}
              </span>
            </button>
          )}

          {/* Navigation Style Toggle */}
          <button
            onClick={() => {
              const nextStyle = navigationStyle === 'sidebar' ? 'launcher' : 'sidebar'
              dispatch(setNavigationStyle({ tenantId: tenant?._id, style: nextStyle }))
              if (nextStyle === 'launcher') {
                dispatch(setHideSidebar(true))
                dispatch(setMobileMenuOpen(false))
                dispatch(setAppLauncherOpen(true))
              } else {
                dispatch(setHideSidebar(false))
                dispatch(setAppLauncherOpen(false))
              }
            }}
            className={`p-2.5 rounded-xl transition-colors group relative flex items-center gap-1.5 ${
              navigationStyle === 'launcher'
                ? 'bg-primary-50 hover:bg-primary-100 dark:bg-primary-950/40 dark:hover:bg-primary-900/50 border border-primary-200 dark:border-primary-800/60 text-primary-600 dark:text-primary-400'
                : 'hover:bg-gray-100 dark:hover:bg-dark-700 text-gray-600 dark:text-gray-400'
            }`}
            title={navigationStyle === 'sidebar' ? (language === 'ar' ? 'إخفاء الشريط الجانبي (قائمة التطبيقات)' : 'App Menu Mode (Hide Sidebar)') : (language === 'ar' ? 'إظهار الشريط الجانبي' : 'Show Sidebar Navigation')}
          >
            {navigationStyle === 'sidebar' ? (
              <LayoutGrid className="w-5 h-5" />
            ) : (
              <PanelLeft className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            )}
            <span className="tooltip -bottom-10 start-1/2 -translate-x-1/2 whitespace-nowrap">
              {navigationStyle === 'sidebar'
                ? (language === 'ar' ? 'إخفاء الشريط الجانبي' : 'App Menu Mode')
                : (language === 'ar' ? 'إظهار الشريط الجانبي' : 'Sidebar Mode')}
            </span>
          </button>

          {/* Theme Toggle */}
          <button
            onClick={() => dispatch(setTheme({ tenantId: tenant?._id, theme: theme === 'dark' ? 'light' : 'dark' }))}
            className="p-2.5 rounded-xl hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors"
            title={theme === 'dark' ? (language === 'ar' ? 'الوضع الفاتح' : 'Light Mode') : (language === 'ar' ? 'الوضع الداكن' : 'Dark Mode')}
          >
            {theme === 'dark' ? (
              <Sun className="w-5 h-5 text-amber-500" />
            ) : (
              <Moon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            )}
          </button>

          {/* Notifications */}
          <Popover className="relative">
            <Popover.Button className="relative p-2.5 rounded-xl hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors focus:outline-none">
              <Bell className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              {unreadCount > 0 && (
                <span className="absolute top-1 end-1 w-4 h-4 bg-red-500 rounded-full text-[10px] text-white font-medium flex items-center justify-center">
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
              <Popover.Panel className="absolute end-0 mt-2 w-80 origin-top-right bg-white dark:bg-dark-800 rounded-xl shadow-lg ring-1 ring-black/5 dark:ring-white/10 focus:outline-none overflow-hidden z-50">
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
                          <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                            'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'
                          }`}>
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

                <div className="p-2 border-t border-gray-100 dark:border-dark-700">
                  <button onClick={() => navigate('/app/dashboard/email')} className="w-full p-2 text-sm text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg font-medium transition-colors">
                    {language === 'ar' ? 'عرض كل الإشعارات' : 'View all notifications'}
                  </button>
                </div>
              </Popover.Panel>
            </Transition>
          </Popover>

          {/* User Profile */}
          <HeadlessMenu as="div" className="relative ms-2">
            <HeadlessMenu.Button className="flex items-center gap-2 sm:gap-3 p-1.5 sm:p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors focus:outline-none group">
              <div className="hidden sm:block text-end">
                <p className="text-sm font-semibold text-gray-900 dark:text-white leading-tight flex items-center gap-1 justify-end">
                  {language === 'ar' ? 'مرحباً،' : 'Welcome,'} <span className="max-w-[150px] truncate">{language === 'ar' ? (tenant?.business?.legalNameAr || tenant?.name || tenant?.business?.legalNameEn || 'المنشأة') : (tenant?.business?.legalNameEn || tenant?.name || tenant?.business?.legalNameAr || 'Business')}</span>
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-300">{user?.name}</p>
              </div>
              {(tenant?.branding?.logo || tenant?.settings?.invoiceBranding?.logo) ? (
                <img 
                  src={tenant?.branding?.logo || tenant?.settings?.invoiceBranding?.logo} 
                  alt="Tenant Logo" 
                  className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl object-contain bg-white dark:bg-white/10 p-1 shadow-sm ring-2 ring-transparent group-hover:ring-gray-200 dark:group-hover:ring-white/20 transition-all"
                />
              ) : (
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 text-white flex items-center justify-center font-bold text-sm sm:text-base shadow-sm ring-2 ring-white dark:ring-dark-800">
                  {user?.name?.charAt(0)?.toUpperCase()}
                </div>
              )}
            </HeadlessMenu.Button>
            
            <Transition
              as={Fragment}
              enter="transition ease-out duration-100"
              enterFrom="transform opacity-0 scale-95"
              enterTo="transform opacity-100 scale-100"
              leave="transition ease-in duration-75"
              leaveFrom="transform opacity-100 scale-100"
              leaveTo="transform opacity-0 scale-95"
            >
              <HeadlessMenu.Items className="absolute end-0 z-[200] mt-2 w-[300px] origin-top-right overflow-hidden rounded-[1.35rem] border border-slate-200/80 bg-white shadow-[0_28px_60px_-28px_rgba(15,23,42,0.45)] ring-1 ring-black/5 focus:outline-none dark:border-white/10 dark:bg-dark-800 dark:ring-white/10">
                <div className="relative overflow-hidden border-b border-slate-100 bg-gradient-to-br from-emerald-50 via-white to-teal-50/40 px-4 pb-4 pt-4 dark:border-dark-700 dark:from-emerald-500/10 dark:via-dark-800 dark:to-teal-500/5">
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
                        {language === 'ar' ? (tenant?.business?.legalNameAr || tenant?.name || tenant?.business?.legalNameEn || 'المنشأة') : (tenant?.business?.legalNameEn || tenant?.name || tenant?.business?.legalNameAr || 'Business')}
                      </p>
                      <p className="truncate text-xs font-medium text-slate-500 dark:text-slate-400">{user?.email}</p>
                    </div>
                  </div>
                  {tenantBusinessTypes?.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {tenantBusinessTypes.slice(0, 6).map((type) => {
                        const meta = TENANT_TYPE_META[type] || { Icon: Building2, labelEn: type, labelAr: type }
                        const TypeIcon = meta.Icon
                        return (
                          <span key={type} className="inline-flex items-center gap-1 rounded-full border border-emerald-200/80 bg-white/90 px-2 py-1 text-[10px] font-bold text-emerald-700 shadow-sm dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
                            <TypeIcon className="h-3 w-3" />
                            {language === 'ar' ? meta.labelAr : meta.labelEn}
                          </span>
                        )
                      })}
                    </div>
                  )}
                </div>

                <div className="p-1.5">
                  <HeadlessMenu.Item>
                    {({ active }) => (
                      <button
                        onClick={() => navigate('/app/dashboard/profile')}
                        className={`${
                          active ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300' : 'text-gray-700 dark:text-gray-300'
                        } flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors`}
                      >
                        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300">
                          <Building2 className="h-4 w-4" />
                        </span>
                        <span>{language === 'ar' ? 'الملف التعريفي والمنشأة' : 'My Profile & Company'}</span>
                      </button>
                    )}
                  </HeadlessMenu.Item>

                  <HeadlessMenu.Item>
                    {({ active }) => (
                      <button
                        type="button"
                        onClick={() => installMaqderWebApp()}
                        className={`${
                          active ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300' : 'text-gray-700 dark:text-gray-300'
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
                  </HeadlessMenu.Item>

                  <HeadlessMenu.Item>
                    {({ active }) => (
                      <button
                        onClick={() => navigate('/app/dashboard/settings')}
                        className={`${
                          active ? 'bg-gray-100 dark:bg-dark-700 text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'
                        } flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors`}
                      >
                        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gray-100 text-gray-500 dark:bg-dark-700">
                          <SettingsIcon className="h-4 w-4" />
                        </span>
                        <span>{language === 'ar' ? 'إعدادات النظام' : 'System Settings'}</span>
                      </button>
                    )}
                  </HeadlessMenu.Item>

                  <div className="my-1 border-t border-gray-100 dark:border-dark-700" />

                  <HeadlessMenu.Item>
                    {({ active }) => (
                      <button
                        onClick={() => dispatch(logout())}
                        className={`${
                          active ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400' : 'text-red-600 dark:text-red-400'
                        } flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors`}
                      >
                        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-red-50 text-red-500 dark:bg-red-900/20">
                          <LogOut className="h-4 w-4" />
                        </span>
                        <span>{language === 'ar' ? 'تسجيل الخروج' : 'Sign out'}</span>
                      </button>
                    )}
                  </HeadlessMenu.Item>
                </div>
              </HeadlessMenu.Items>
            </Transition>
          </HeadlessMenu>

          <div className="w-px h-6 bg-gray-200 dark:bg-dark-600 mx-1 hidden sm:block" />

          <button
            onClick={() => dispatch(logout())}
            className="p-2.5 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors group relative hidden sm:flex"
          >
            <LogOut className="w-5 h-5 text-gray-600 dark:text-gray-400 group-hover:text-red-600 dark:group-hover:text-red-400" />
            <span className="tooltip -bottom-10 start-1/2 -translate-x-1/2 whitespace-nowrap">
              {t('logout')}
            </span>
          </button>
        </div>
      </div>
    </header>
  )
}
