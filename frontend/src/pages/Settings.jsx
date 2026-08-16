import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSelector, useDispatch } from 'react-redux'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Building2, Globe, Palette, Bell, Save, Key, CheckCircle, Image, Database, Download, FileText, CreditCard, Terminal, Car, UtensilsCrossed, Clock, Printer, MapPin, Briefcase, Receipt, MessageCircle, BookOpen, PanelLeft, Eye, EyeOff, Menu, Monitor, Smartphone, Maximize, LayoutGrid, ChevronDown, Info } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../lib/api'
import { useTranslation } from '../lib/translations'
import { setLanguage, setTheme, setHideSidebar, setHiddenMenuItems, setHiddenMenuItemsForTenant, toggleHiddenMenuItemForTenant, setDisplayMode, setNavigationStyle } from '../store/slices/uiSlice'
import { updateTenant, getMe } from '../store/slices/authSlice'
import { useLiveTranslation } from '../lib/liveTranslation'
import { getInvoiceBrandingProfile, getInvoiceTemplateId, getInvoiceTypography, INVOICE_FONT_OPTIONS } from '../lib/invoiceBranding'
import { CURRENCIES, CURRENCY_CODE } from '../lib/currency'
import { INVOICE_LANGUAGE_OPTIONS, isGccArabicMarket } from '../lib/invoiceLanguage'
import { getTenantAliasUrl } from '../lib/tenantHost'
import { showArabicFields, isBangladeshTenant, isSaudiTenant, showArabicUi } from '../lib/saudiTenant'
import { COUNTRY_OPTIONS } from '../lib/countryCurrency'
import { getNavSections } from '../lib/sidebarConfig'
import { getTenantBusinessTypes } from '../lib/businessTypes'
import PosTerminalSettings from '../components/settings/PosTerminalSettings'
import HardwareSettings from '../components/settings/HardwareSettings'
import CarRentalApiSettings from '../components/settings/CarRentalApiSettings'

const invoiceBrandingContexts = [
  { key: 'trading', labelEn: 'Trading Invoice', labelAr: 'فاتورة تجارة' },
  { key: 'construction', labelEn: 'Contracting Invoice', labelAr: 'فاتورة مقاولات' },
  { key: 'travel_agency', labelEn: 'Travel Agency Invoice', labelAr: 'فاتورة وكالة سفر' },
]

const buildInvoiceBrandingProfilesState = (tenant) => invoiceBrandingContexts.reduce((acc, item) => {
  const profile = getInvoiceBrandingProfile(tenant, item.key)
  acc[item.key] = {
    templateId: Number(profile.templateId || getInvoiceTemplateId(tenant, item.key)),
    logo: profile.logo || '',
    headerTextEn: profile.headerTextEn || '',
    headerTextAr: profile.headerTextAr || '',
    footerTextEn: profile.footerTextEn || '',
    footerTextAr: profile.footerTextAr || '',
  }
  return acc
}, {})

const updateInvoiceBrandingProfileState = (profiles, contextKey, patch) => ({
  ...profiles,
  [contextKey]: {
    ...(profiles?.[contextKey] || {}),
    ...patch,
  },
})

function SettingsAccordion({ id, title, icon: Icon, open, onToggle, children }) {
  return (
    <div className="border border-gray-200 dark:border-dark-600 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => onToggle(id)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left bg-gray-50/80 dark:bg-dark-800/60 hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
          {Icon ? <Icon className="w-4 h-4 text-gray-500" /> : null}
          {title}
        </span>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open ? <div className="p-4 border-t border-gray-200 dark:border-dark-600">{children}</div> : null}
    </div>
  )
}

function MenuVisibilitySettings() {
  const dispatch = useDispatch()
  const { language, hiddenMenuItems } = useSelector((state) => state.ui)
  const { tenant, user } = useSelector((state) => state.auth)
  const { t } = useTranslation(language)
  const [expandedSections, setExpandedSections] = useState({})
  const [searchQuery, setSearchQuery] = useState('')
  const hiddenSet = new Set(hiddenMenuItems || [])
  const NON_HIDEABLE_PATHS = new Set(['/app/dashboard/settings', '/app/dashboard/hidden-navbars'])

  if (!tenant) return null

  const si = tenant?.settings?.saudiIntegrations || {}
  const isSarCurrencyTenant = String(tenant?.settings?.currency || 'SAR').toUpperCase() === 'SAR'
  const isBdtCurrencyTenant = String(tenant?.settings?.currency || 'SAR').toUpperCase() === 'BDT'
  const isPkrCurrencyTenant = String(tenant?.settings?.currency || 'SAR').toUpperCase() === 'PKR'
  const isZatcaPhase1 = (tenant?.zatca?.phase || 1) === 1
  const business = tenant?.business || {}
  const isZatcaPhase1Ready = isZatcaPhase1 && !!business.vatNumber && !!(business.legalNameEn || business.legalNameAr) && !!(business.address?.city && business.address?.country)
  const hasZatca = isSarCurrencyTenant && (si.zatcaConnectionStatus === 'connected' || tenant?.zatca?.isOnboarded || isZatcaPhase1Ready)
  const hasElm = isSarCurrencyTenant && si.elmConnectionStatus === 'connected'
  const hasQiwa = isSarCurrencyTenant && si.qiwaConnectionStatus === 'connected'
  const hasGosi = isSarCurrencyTenant && si.gosiConnectionStatus === 'connected'
  const hasNbr = isBdtCurrencyTenant && (tenant?.nbr?.isOnboarded || tenant?.nbr?.connectionStatus === 'connected' || !!tenant?.nbr?.binNumber || !!business.binNumber)
  const hasFbr = isPkrCurrencyTenant

  const govChildren = []
  if (hasZatca) govChildren.push({ path: '/app/dashboard/tenant-settings/government-integrations/zatca', label: language === 'ar' ? `بوابة زاتكا ${isZatcaPhase1 ? '(المرحلة 1)' : ''}` : `ZATCA${isZatcaPhase1 ? ' Phase 1' : ''} Portal` })
  if (hasElm) govChildren.push({ path: '/app/dashboard/tenant-settings/government-integrations/elm', label: language === 'ar' ? 'بوابة علم / يقين' : 'Elm Portal' })
  if (hasQiwa) govChildren.push({ path: '/app/dashboard/tenant-settings/government-integrations/qiwa', label: language === 'ar' ? 'بوابة قوى' : 'Qiwa Portal' })
  if (hasGosi) govChildren.push({ path: '/app/dashboard/tenant-settings/government-integrations/gosi', label: language === 'ar' ? 'بوابة التأمينات / مدد' : 'GOSI/Mudad Portal' })
  if (hasNbr) govChildren.push({ path: '/app/dashboard/tenant-settings/nbr-dashboard', label: language === 'ar' ? 'بوابة NBR / Mushak' : 'NBR / Mushak Portal' })
  if (hasFbr) govChildren.push({ path: '/app/dashboard/tenant-settings/fbr-dashboard', label: language === 'ar' ? 'بوابة FBR' : 'FBR Portal' })

  const businessTypes = getTenantBusinessTypes(tenant)
  const navSections = getNavSections({ language, t, tenant, businessTypes, govChildren })

  const hasAccess = (module, action) => {
    if (!user?.role) return false
    if (user.role === 'admin' || user.role === 'superadmin') return true
    if (user.role === 'owner') return true
    if (!user.permissions?.[module]) return false
    const perm = user.permissions[module]
    if (perm === true) return true
    if (perm === false) return false
    if (typeof perm === 'object' && !Array.isArray(perm)) {
      const actions = Array.isArray(perm.actions) ? perm.actions : []
      return actions.includes(action)
    }
    const actions = Array.isArray(perm?.actions) ? perm.actions : []
    return actions.includes(action)
  }

  const visibleSections = navSections.map((section) => {
    if (Array.isArray(section.businessTypes) && !section.businessTypes.some((type) => businessTypes.includes(type))) {
      return { ...section, items: [] }
    }
    if (Array.isArray(section.excludeBusinessTypes) && section.excludeBusinessTypes.some((type) => businessTypes.includes(type))) {
      return { ...section, items: [] }
    }
    const items = (Array.isArray(section.items) ? section.items : []).filter((item) => {
      if (item.path && NON_HIDEABLE_PATHS.has(item.path)) return false
      if (Array.isArray(item?.businessTypes) && !item.businessTypes.some((type) => businessTypes.includes(type))) return false
      if (Array.isArray(item?.excludeBusinessTypes) && item.excludeBusinessTypes.some((type) => businessTypes.includes(type))) return false
      if (item.requireAddon && !tenant?.subscription?.[item.requireAddon]) return false
      if (!item?.perm) return true
      return hasAccess(item.perm.module, item.perm.action)
    })
    return { ...section, items }
  }).filter((section) => section.items?.length > 0)

  const toggleSection = (title) => {
    setExpandedSections((prev) => ({ ...prev, [title]: !prev[title] }))
  }

  const toggleItem = (path) => {
    if (NON_HIDEABLE_PATHS.has(path)) return
    dispatch(toggleHiddenMenuItemForTenant({ tenantId: tenant._id, path }))
  }

  const showAll = () => {
    const visiblePaths = new Set()
    visibleSections.forEach((section) => {
      section.items.forEach((item) => {
        if (item.path) visiblePaths.add(item.path)
      })
    })
    const items = Array.from(new Set((hiddenMenuItems || []).filter((p) => !visiblePaths.has(p))))
    dispatch(setHiddenMenuItemsForTenant({ tenantId: tenant._id, items }))
  }

  const filteredSections = visibleSections.map((section) => {
    if (!searchQuery) return section
    const q = searchQuery.toLowerCase()
    const items = section.items.filter((item) => {
      const label = typeof item.label === 'string' ? item.label.toLowerCase() : ''
      const title = typeof section.title === 'string' ? section.title.toLowerCase() : ''
      return label.includes(q) || title.includes(q)
    })
    return { ...section, items }
  }).filter((section) => section.items?.length > 0)

  return (
    <div className="border-t border-gray-100 dark:border-dark-700 pt-6">
      <div className="flex items-center justify-between mb-4">
        <label className="label flex items-center gap-2"><Menu className="w-4 h-4" />{language === 'ar' ? 'إظهار/إخفاء عناصر القائمة' : 'Menu Item Visibility'}</label>
        <button
          onClick={showAll}
          className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 dark:border-dark-600 hover:bg-gray-50 dark:hover:bg-dark-700/50 transition-colors"
        >
          {language === 'ar' ? 'إظهار الكل' : 'Show All'}
        </button>
      </div>
      <p className="text-xs text-gray-500 mb-3">{language === 'ar' ? 'أخفِ العناصر التي لا تستخدمها من شريط التنقل الجانبي.' : 'Hide items you do not use from the sidebar navigation.'}</p>
      <input
        type="text"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder={language === 'ar' ? 'ابحث في القائمة...' : 'Search menu items...'}
        className="input mb-4 w-full md:w-1/2"
      />
      <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
        {filteredSections.map((section) => (
          <div key={section.title} className="rounded-xl border border-gray-200 dark:border-dark-600 overflow-hidden">
            <button
              onClick={() => toggleSection(section.title)}
              className="w-full flex items-center justify-between p-3 text-sm font-medium bg-gray-50 dark:bg-dark-700/50 hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors"
            >
              <span>{section.title}</span>
              <span className="text-xs text-gray-400">{section.items.length}</span>
            </button>
            {(expandedSections[section.title] || searchQuery) && (
              <div className="p-2 space-y-1">
                {section.items.map((item) => {
                  const Icon = item.icon
                  const path = item.path
                  const isHidden = path ? hiddenSet.has(path) : false
                  return (
                    <button
                      key={path || item.label}
                      onClick={() => toggleItem(path)}
                      className={`w-full flex items-center justify-between p-2 rounded-lg text-sm transition-colors ${isHidden ? 'text-gray-400 hover:bg-gray-50 dark:hover:bg-dark-700/50' : 'hover:bg-primary-50 dark:hover:bg-primary-900/10'}`}
                    >
                      <div className="flex items-center gap-2">
                        {Icon && <Icon className="w-4 h-4" />}
                        <span>{item.label}</span>
                      </div>
                      {isHidden ? <EyeOff className="w-4 h-4 text-gray-400" /> : <Eye className="w-4 h-4 text-primary-500" />}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        ))}
        {filteredSections.length === 0 && (
          <p className="text-sm text-gray-500 text-center py-6">{language === 'ar' ? 'لا توجد عناصر مطابقة' : 'No matching menu items'}</p>
        )}
      </div>
    </div>
  )
}

export default function Settings() {
  const dispatch = useDispatch()
  const queryClient = useQueryClient()
  const { language, theme, hideSidebar, hiddenMenuItems, displayMode, navigationStyle } = useSelector((state) => state.ui)
  const { user } = useSelector((state) => state.auth)
  const { t } = useTranslation(language)
  const [activeTab, setActiveTab] = useState('hardware')
  const [companySections, setCompanySections] = useState({ basics: true })
  const [downloadingBackup, setDownloadingBackup] = useState(false)
  const [primaryColor, setPrimaryColor] = useState('#14B8A6')
  const [secondaryColor, setSecondaryColor] = useState('#D946EF')
  const [headerStyle, setHeaderStyle] = useState('glass')
  const [sidebarStyle, setSidebarStyle] = useState('solid')
  const [logoDataUrl, setLogoDataUrl] = useState(null)
  const [invoicePdfTemplate, setInvoicePdfTemplate] = useState(1)
  const [invoicePdfPageSize, setInvoicePdfPageSize] = useState('a4')
  const [invoicePdfOrientation, setInvoicePdfOrientation] = useState('portrait')
  const [invoiceSequencePattern, setInvoiceSequencePattern] = useState('RCPT-{N}')
  const [khayyatWhatsappLanguage, setKhayyatWhatsappLanguage] = useState('both')
  const [invoiceCurrencyDisplay, setInvoiceCurrencyDisplay] = useState('text')
  const [invoiceCurrencyPosition, setInvoiceCurrencyPosition] = useState('after')
  const [defaultCurrency, setDefaultCurrency] = useState(CURRENCY_CODE)
  const [invoiceLanguage, setInvoiceLanguage] = useState('auto')
  const [invoiceLogoDataUrl, setInvoiceLogoDataUrl] = useState(null)
  const [stampDataUrl, setStampDataUrl] = useState(null)
  const [signatureDataUrl, setSignatureDataUrl] = useState(null)
  const [invoiceHeaderTextEn, setInvoiceHeaderTextEn] = useState('')
  const [invoiceHeaderTextAr, setInvoiceHeaderTextAr] = useState('')
  const [invoiceFooterTextEn, setInvoiceFooterTextEn] = useState('')
  const [invoiceFooterTextAr, setInvoiceFooterTextAr] = useState('')
  const [invoiceBodyFontFamily, setInvoiceBodyFontFamily] = useState('helvetica')
  const [invoiceHeadingFontFamily, setInvoiceHeadingFontFamily] = useState('helvetica')
  const [invoiceBodyFontSize, setInvoiceBodyFontSize] = useState(12)
  const [invoiceHeadingFontSize, setInvoiceHeadingFontSize] = useState(18)
  const [invoiceLogoSize, setInvoiceLogoSize] = useState(112)
  const [invoiceHeadingSize, setInvoiceHeadingSize] = useState(24)
  const [invoiceSingleLineHeading, setInvoiceSingleLineHeading] = useState(false)
  const [showVision2030, setShowVision2030] = useState(true)
  const [vision2030LogoDataUrl, setVision2030LogoDataUrl] = useState('/saudi-vision-2030-logo.webp')
  const [invoiceBrandingProfiles, setInvoiceBrandingProfiles] = useState(() => buildInvoiceBrandingProfilesState(null))
  // Restaurant settings
  const [restAutoStatus, setRestAutoStatus] = useState(false)
  const [restOpenTime, setRestOpenTime] = useState('08:00')
  const [restCloseTime, setRestCloseTime] = useState('23:00')
  const [restNotify, setRestNotify] = useState(false)
  const [restNotifyPhone, setRestNotifyPhone] = useState('')
  const [restPrinters, setRestPrinters] = useState([])
  const [restPrintKitchenReceipt, setRestPrintKitchenReceipt] = useState(true)
  // WhatsApp auto-send settings
  const [waAutoSend, setWaAutoSend] = useState(false)
  const [waOnOpen, setWaOnOpen] = useState(false)
  const [waOnOrderPlaced, setWaOnOrderPlaced] = useState(false)
  const [waOnOrderReady, setWaOnOrderReady] = useState(false)
  const [waOnOrderServed, setWaOnOrderServed] = useState(false)
  const [waOpenMsgEn, setWaOpenMsgEn] = useState('We are now open! Visit us today.')
  const [waOpenMsgAr, setWaOpenMsgAr] = useState('نحن الآن مفتوحون! زورنا اليوم.')
  const [waOrderPlacedMsgEn, setWaOrderPlacedMsgEn] = useState('Your order has been placed. Order #: {{orderNumber}}')
  const [waOrderPlacedMsgAr, setWaOrderPlacedMsgAr] = useState('تم استلام طلبك. رقم الطلب: {{orderNumber}}')
  const [waOrderReadyMsgEn, setWaOrderReadyMsgEn] = useState('Your order is ready for pickup/delivery. Order #: {{orderNumber}}')
  const [waOrderReadyMsgAr, setWaOrderReadyMsgAr] = useState('طلبك جاهز للاستلام/التوصيل. رقم الطلب: {{orderNumber}}')
  const [waOrderServedMsgEn, setWaOrderServedMsgEn] = useState('Your order has been served. Thank you! Order #: {{orderNumber}}')
  const [waOrderServedMsgAr, setWaOrderServedMsgAr] = useState('تم تقديم طلبك. شكراً لك! رقم الطلب: {{orderNumber}}')
  const [waNotifyPhones, setWaNotifyPhones] = useState('')
  // Invoice WhatsApp auto-send settings
  const [waAutoInvoiceSend, setWaAutoInvoiceSend] = useState(false)
  const [waInvoiceMsgEn, setWaInvoiceMsgEn] = useState('Dear customer, your invoice {{invoiceNumber}} is ready. Amount: {{total}} SAR. Link: {{link}}')
  const [waInvoiceMsgAr, setWaInvoiceMsgAr] = useState('عزيزي العميل، فاتورتك رقم {{invoiceNumber}} جاهزة. المبلغ: {{total}} ريال. الرابط: {{link}}')
  // Bakala settings
  const [bakalaRequireShift, setBakalaRequireShift] = useState(true)
  const [bakalaTaxEnabled, setBakalaTaxEnabled] = useState(true)
  const [bakalaAutoInvoicePrint, setBakalaAutoInvoicePrint] = useState(true)
  // Bookstore settings
  const [bookstoreRequireShift, setBookstoreRequireShift] = useState(true)

  const { data: tenant } = useQuery({
    queryKey: ['tenant-settings'],
    queryFn: () => api.get('/tenants/current').then(res => res.data)
  })

  useEffect(() => {
    if (!tenant) return

    setPrimaryColor(tenant.branding?.primaryColor || '#14B8A6')
    setSecondaryColor(tenant.branding?.secondaryColor || '#D946EF')
    setHeaderStyle(tenant.branding?.headerStyle || 'glass')
    setSidebarStyle(tenant.branding?.sidebarStyle || 'solid')
    setLogoDataUrl(tenant.branding?.logo || null)
    setInvoicePdfTemplate(Number(tenant.settings?.invoicePdfTemplate || 1))
    setInvoicePdfPageSize(tenant.settings?.invoicePdfPageSize || 'a4')
    setInvoicePdfOrientation(tenant.settings?.invoicePdfOrientation || 'portrait')
    setInvoiceSequencePattern(tenant.settings?.invoiceSequencePattern || 'RCPT-{N}')
    setKhayyatWhatsappLanguage(tenant.settings?.khayyat?.whatsappLanguage || 'both')
    setDefaultCurrency(String(tenant.settings?.currency || CURRENCY_CODE).toUpperCase())
    setInvoiceCurrencyDisplay(tenant.settings?.invoiceCurrencyDisplay === 'icon' ? 'icon' : 'text')
    setInvoiceCurrencyPosition(tenant.settings?.invoiceCurrencyPosition === 'before' ? 'before' : 'after')
    setInvoiceLanguage(['en', 'en_ar', 'en_ur', 'en_bn'].includes(tenant.settings?.invoiceLanguage) ? tenant.settings.invoiceLanguage : 'auto')
    setInvoiceLogoDataUrl(tenant.settings?.invoiceBranding?.logo || tenant.branding?.logo || null)
    setStampDataUrl(tenant.settings?.invoiceBranding?.presetStamp || tenant.settings?.invoiceBranding?.stampImage || null)
    setSignatureDataUrl(tenant.settings?.invoiceBranding?.presetSignature || tenant.settings?.invoiceBranding?.signatureImage || null)
    setInvoiceHeaderTextEn(tenant.settings?.invoiceBranding?.headerTextEn || '')
    setInvoiceHeaderTextAr(tenant.settings?.invoiceBranding?.headerTextAr || '')
    setInvoiceFooterTextEn(tenant.settings?.invoiceBranding?.footerTextEn || '')
    setInvoiceFooterTextAr(tenant.settings?.invoiceBranding?.footerTextAr || '')
    setInvoiceLogoSize(tenant.settings?.invoiceBranding?.logoSize || 112)
    setInvoiceHeadingSize(tenant.settings?.invoiceBranding?.headingSize || 24)
    setInvoiceSingleLineHeading(tenant.settings?.invoiceBranding?.singleLineHeading || false)
    setWaAutoInvoiceSend(tenant.settings?.invoiceWhatsappAutoSend || false)
    setWaInvoiceMsgEn(tenant.settings?.invoiceWhatsappMessageEn || 'Dear customer, your invoice {{invoiceNumber}} is ready. Amount: {{total}} SAR. Link: {{link}}')
    setWaInvoiceMsgAr(tenant.settings?.invoiceWhatsappMessageAr || 'عزيزي العميل، فاتورتك رقم {{invoiceNumber}} جاهزة. المبلغ: {{total}} ريال. الرابط: {{link}}')
    const typography = getInvoiceTypography(tenant)
    setInvoiceBodyFontFamily(typography.bodyFontFamily)
    setInvoiceHeadingFontFamily(typography.headingFontFamily)
    setInvoiceBodyFontSize(typography.bodyFontSize)
    setInvoiceHeadingFontSize(typography.headingFontSize)
    setShowVision2030(tenant.settings?.invoiceBranding?.showVision2030 !== false)
    setVision2030LogoDataUrl(tenant.settings?.invoiceBranding?.vision2030Logo || '/saudi-vision-2030-logo.webp')
    setInvoiceBrandingProfiles(buildInvoiceBrandingProfilesState(tenant))
    // Restaurant settings init
    const rs = tenant.settings?.restaurant || {}
    setRestAutoStatus(rs.autoStatusUpdate || false)
    setRestOpenTime(rs.openingTime || '08:00')
    setRestCloseTime(rs.closingTime || '23:00')
    setRestNotify(rs.notifyOnStatusChange || false)
    setRestNotifyPhone(rs.statusNotificationPhone || '')
    setRestPrinters(rs.printers || [])
    setRestPrintKitchenReceipt(rs.printKitchenReceipt !== false)
    // WhatsApp auto-send init
    const wa = rs.whatsapp || {}
    setWaAutoSend(wa.autoSendEnabled || false)
    setWaOnOpen(wa.autoSendOnOpen || false)
    setWaOnOrderPlaced(wa.autoSendOnOrderPlaced || false)
    setWaOnOrderReady(wa.autoSendOnOrderReady || false)
    setWaOnOrderServed(wa.autoSendOnOrderServed || false)
    setWaOpenMsgEn(wa.openMessageEn || 'We are now open! Visit us today.')
    setWaOpenMsgAr(wa.openMessageAr || 'نحن الآن مفتوحون! زورنا اليوم.')
    setWaOrderPlacedMsgEn(wa.orderPlacedMessageEn || 'Your order has been placed. Order #: {{orderNumber}}')
    setWaOrderPlacedMsgAr(wa.orderPlacedMessageAr || 'تم استلام طلبك. رقم الطلب: {{orderNumber}}')
    setWaOrderReadyMsgEn(wa.orderReadyMessageEn || 'Your order is ready for pickup/delivery. Order #: {{orderNumber}}')
    setWaOrderReadyMsgAr(wa.orderReadyMessageAr || 'طلبك جاهز للاستلام/التوصيل. رقم الطلب: {{orderNumber}}')
    setWaOrderServedMsgEn(wa.orderServedMessageEn || 'Your order has been served. Thank you! Order #: {{orderNumber}}')
    setWaOrderServedMsgAr(wa.orderServedMessageAr || 'تم تقديم طلبك. شكراً لك! رقم الطلب: {{orderNumber}}')
    setWaNotifyPhones(Array.isArray(wa.notifyPhoneList) ? wa.notifyPhoneList.join(', ') : '')
    // Bakala settings init
    setBakalaRequireShift(tenant.settings?.bakala?.requireShift !== false)
    setBakalaTaxEnabled(tenant.settings?.bakala?.taxEnabled !== false)
    setBakalaAutoInvoicePrint(tenant.settings?.bakala?.autoInvoicePrint !== false)
    // Bookstore settings init
    setBookstoreRequireShift(tenant.settings?.bookstore?.requireShift !== false)
  }, [tenant])

  const { register, handleSubmit, reset, watch, setValue, control } = useForm()

  useEffect(() => {
    if (!tenant) return
    reset({
      legalNameEn: tenant.business?.legalNameEn || '',
      legalNameAr: tenant.business?.legalNameAr || '',
      vatNumber: tenant.business?.vatNumber || '',
      binNumber: tenant.business?.binNumber || tenant.nbr?.binNumber || '',
      crNumber: tenant.business?.crNumber || '',
      address: {
        city: tenant.business?.address?.city || '',
        cityAr: tenant.business?.address?.cityAr || '',
        district: tenant.business?.address?.district || '',
        districtAr: tenant.business?.address?.districtAr || '',
        street: tenant.business?.address?.street || '',
        streetAr: tenant.business?.address?.streetAr || '',
        postalCode: tenant.business?.address?.postalCode || '',
        buildingNumber: tenant.business?.address?.buildingNumber || '',
        additionalNumber: tenant.business?.address?.additionalNumber || '',
        country: tenant.business?.address?.country || ''
      },
      contactEmail: tenant.business?.contactEmail || '',
      contactPhone: tenant.business?.contactPhone || '',
      bankDetails: {
        bankName: tenant.business?.bankDetails?.bankName || '',
        accountName: tenant.business?.bankDetails?.accountName || '',
        accountNumber: tenant.business?.bankDetails?.accountNumber || '',
        iban: tenant.business?.bankDetails?.iban || '',
      },
      nationalAddress: {
        proofNumber: tenant.business?.nationalAddress?.proofNumber || '',
        originalDate: tenant.business?.nationalAddress?.originalDate ? new Date(tenant.business.nationalAddress.originalDate).toISOString().split('T')[0] : '',
        expirationDate: tenant.business?.nationalAddress?.expirationDate ? new Date(tenant.business.nationalAddress.expirationDate).toISOString().split('T')[0] : '',
        customerAccount: tenant.business?.nationalAddress?.customerAccount || '',
        regDate: tenant.business?.nationalAddress?.regDate ? new Date(tenant.business.nationalAddress.regDate).toISOString().split('T')[0] : '',
        shortAddress: tenant.business?.nationalAddress?.shortAddress || '',
        buildingNo: tenant.business?.nationalAddress?.buildingNo || '',
        neighborhood: tenant.business?.nationalAddress?.neighborhood || '',
        region: tenant.business?.nationalAddress?.region || '',
        qrCodeUrl: tenant.business?.nationalAddress?.qrCodeUrl || '',
      },
      commercialRegistration: {
        crNumber: tenant.business?.commercialRegistration?.crNumber || '',
        issueDate: tenant.business?.commercialRegistration?.issueDate ? new Date(tenant.business.commercialRegistration.issueDate).toISOString().split('T')[0] : '',
        companyType: tenant.business?.commercialRegistration?.companyType || '',
        companyTypeAr: tenant.business?.commercialRegistration?.companyTypeAr || '',
        companyStatus: tenant.business?.commercialRegistration?.companyStatus || '',
        companyStatusAr: tenant.business?.commercialRegistration?.companyStatusAr || '',
        qrCodeUrl: tenant.business?.commercialRegistration?.qrCodeUrl || '',
      },
      vatCertificate: {
        certificateNo: tenant.business?.vatCertificate?.certificateNo || '',
        certificateDate: tenant.business?.vatCertificate?.certificateDate ? new Date(tenant.business.vatCertificate.certificateDate).toISOString().split('T')[0] : '',
        effectiveDate: tenant.business?.vatCertificate?.effectiveDate ? new Date(tenant.business.vatCertificate.effectiveDate).toISOString().split('T')[0] : '',
        taxPeriod: tenant.business?.vatCertificate?.taxPeriod || '',
        taxPeriodAr: tenant.business?.vatCertificate?.taxPeriodAr || '',
        firstFilingDueDate: tenant.business?.vatCertificate?.firstFilingDueDate ? new Date(tenant.business.vatCertificate.firstFilingDueDate).toISOString().split('T')[0] : '',
        qrCodeUrl: tenant.business?.vatCertificate?.qrCodeUrl || '',
      },
    })
  }, [tenant, reset])

  useLiveTranslation({
    control,
    watch,
    setValue,
    sourceField: 'legalNameEn',
    targetField: 'legalNameAr',
    sourceLang: 'en',
    targetLang: 'ar'
  })

  useLiveTranslation({
    control,
    watch,
    setValue,
    sourceField: 'legalNameAr',
    targetField: 'legalNameEn',
    sourceLang: 'ar',
    targetLang: 'en'
  })

  const updateMutation = useMutation({
    mutationFn: (data) => api.put('/tenants/current', data),
    onSuccess: (res) => {
      const updated = res?.data
      toast.success(language === 'ar' ? 'تم حفظ الإعدادات' : 'Settings saved')
      if (updated) {
        queryClient.setQueryData(['tenant-settings'], updated)
        dispatch(updateTenant(updated))
      }
      queryClient.invalidateQueries(['tenant-settings'])
      dispatch(getMe())
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Error saving')
  })

  const applyImageFile = (file, setter) => {
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      setter(reader.result)
    }
    reader.readAsDataURL(file)
  }

  const handleLogoFile = (e) => {
    applyImageFile(e.target.files?.[0], (result) => {
      setLogoDataUrl(result)
      setInvoiceLogoDataUrl(result)
    })
  }

  const handleInvoiceLogoFile = (e) => {
    applyImageFile(e.target.files?.[0], setInvoiceLogoDataUrl)
  }

  const handleStampFile = (e) => {
    applyImageFile(e.target.files?.[0], setStampDataUrl)
  }

  const handleSignatureFile = (e) => {
    applyImageFile(e.target.files?.[0], setSignatureDataUrl)
  }

  const handleVision2030LogoFile = (e) => {
    applyImageFile(e.target.files?.[0], setVision2030LogoDataUrl)
  }

  const handleInvoiceContextLogoFile = (contextKey) => (e) => {
    applyImageFile(e.target.files?.[0], (result) => {
      setInvoiceBrandingProfiles((current) => updateInvoiceBrandingProfileState(current, contextKey, { logo: result }))
    })
  }


  const tenantBusinessTypes = tenant?.businessTypes || []
  const hasRestaurant = tenantBusinessTypes.includes('restaurant')
  const hasBakala = tenantBusinessTypes.includes('bakala')
  const hasBookstore = tenantBusinessTypes.includes('bookstore')

  const tabs = [
    { id: 'hardware', label: language === 'ar' ? 'الأجهزة والطباعة' : 'Hardware & Printers', icon: Terminal },
    { id: 'branding', label: language === 'ar' ? 'إعدادات الفواتير والخطابات' : 'Invoice & Letterhead Settings', icon: FileText },
    ...(hasRestaurant ? [{ id: 'restaurant', label: language === 'ar' ? 'إعدادات المطعم' : 'Restaurant', icon: UtensilsCrossed }] : []),
    ...(hasBakala ? [{ id: 'bakala', label: language === 'ar' ? 'إعدادات البقالة' : 'Bakala', icon: Building2 }] : []),
    ...(hasBookstore ? [{ id: 'bookstore', label: language === 'ar' ? 'إعدادات المكتبة' : 'Bookstore', icon: BookOpen }] : []),
    { id: 'backup', label: language === 'ar' ? 'النسخ الاحتياطي' : 'Backup', icon: Database },
  ]

  const downloadBackup = async () => {
    try {
      setDownloadingBackup(true)
      const res = await api.get('/tenants/backup', { responseType: 'blob' })

      const blob = new Blob([res.data], { type: 'application/gzip' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')

      const d = new Date()
      const dateStr = d.toISOString().slice(0, 10)
      const safeSlug = tenant?.slug || 'tenant'
      a.href = url
      a.download = `backup_${safeSlug}_${dateStr}.jsonl.gz`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      toast.error(err.response?.data?.error || (language === 'ar' ? 'فشل تحميل النسخة الاحتياطية' : 'Failed to download backup'))
    } finally {
      setDownloadingBackup(false)
    }
  }

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white tracking-tight">{t('settings')}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {language === 'ar' ? 'إعدادات الشركة والنظام' : 'Company & system'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/app/dashboard/maqder-updates"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:border-slate-300 dark:border-dark-600 dark:bg-dark-800 dark:text-slate-200"
          >
            <Info className="h-4 w-4" />
            {language === 'ar' ? 'تحديثات مقدر' : 'Maqder Updates'}
          </Link>
          <Link
            to="/app/dashboard/profile"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:border-slate-300 dark:border-dark-600 dark:bg-dark-800 dark:text-slate-200"
          >
            <Building2 className="h-4 w-4" />
            {language === 'ar' ? 'الملف التعريفي للمنشأة' : 'Company profile'}
          </Link>
        </div>
      </div>

      <div className="space-y-5">
        <div className="flex gap-1 overflow-x-auto border-b border-gray-200 dark:border-dark-600 pb-px">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm whitespace-nowrap border-b-2 -mb-px transition-colors ${
                activeTab === tab.id
                  ? 'border-primary-600 text-primary-700 dark:text-primary-300 font-medium'
                  : 'border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div>

          {activeTab === 'setupMachine' && (
            <PosTerminalSettings
              tenant={tenant}
              language={language}
              onSave={(posSettings) =>
                updateMutation.mutate({ settings: { posTerminal: posSettings } })
              }
            />
          )}

          {activeTab === 'hardware' && (
            <HardwareSettings
              tenant={tenant}
              language={language}
              onSave={(hardwareSettings, thermalPrinter) =>
                updateMutation.mutate({ settings: { hardwareSettings, thermalPrinter } })
              }
              isSaving={updateMutation.isPending}
            />
          )}

          {activeTab === 'carRentalApis' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card p-6">
              <CarRentalApiSettings tenant={tenant} isAr={language === 'ar'} />
            </motion.div>
          )}

          {activeTab === 'branding' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card p-6 space-y-8">
              <div>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary-500" />
                  {language === 'ar' ? 'إعدادات الفواتير والخطابات' : 'Invoice & Letterhead Settings'}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="label">{language === 'ar' ? 'حجم الشعار (بكسل)' : 'Logo Size (px)'}</label>
                    <input
                      type="number"
                      value={invoiceLogoSize}
                      onChange={(e) => setInvoiceLogoSize(Number(e.target.value))}
                      className="input"
                      min="20"
                      max="300"
                    />
                    <p className="text-xs text-gray-500 mt-1">{language === 'ar' ? 'الافتراضي 112' : 'Default 112'}</p>
                  </div>
                  <div>
                    <label className="label">{language === 'ar' ? 'حجم النص الأساسي للترويسة (بكسل)' : 'Heading Font Size (px)'}</label>
                    <input
                      type="number"
                      value={invoiceHeadingSize}
                      onChange={(e) => setInvoiceHeadingSize(Number(e.target.value))}
                      className="input"
                      min="10"
                      max="72"
                    />
                    <p className="text-xs text-gray-500 mt-1">{language === 'ar' ? 'الافتراضي 24' : 'Default 24'}</p>
                  </div>
                  <div className="md:col-span-2">
                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={invoiceSingleLineHeading}
                        onChange={(e) => setInvoiceSingleLineHeading(e.target.checked)}
                        className="w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {language === 'ar' ? 'عرض الترويسة في سطر واحد (بجوار الشعار)' : 'Display Heading in a single line (next to logo)'}
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-100 dark:border-dark-700 flex justify-end">
                <button
                  disabled={updateMutation.isPending}
                  onClick={() => updateMutation.mutate({
                    settings: {
                      ...tenant?.settings,
                      invoiceBranding: {
                        ...(tenant?.settings?.invoiceBranding || {}),
                        logoSize: invoiceLogoSize,
                        headingSize: invoiceHeadingSize,
                        singleLineHeading: invoiceSingleLineHeading
                      }
                    }
                  })}
                  className="btn btn-primary"
                >
                  {updateMutation.isPending ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><Save className="w-4 h-4" /> {t('save')}</>}
                </button>
              </div>
            </motion.div>
          )}

          {activeTab === 'restaurant' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card p-6 space-y-8">
              {/* Auto Open/Close */}
              <div>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-primary-500" />
                  {language === 'ar' ? 'الفتح والإغلاق التلقائي' : 'Auto Open / Close'}
                </h3>
                <div className="space-y-4">
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={restAutoStatus}
                      onChange={(e) => setRestAutoStatus(e.target.checked)}
                      className="w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {language === 'ar' ? 'تفعيل التحديث التلقائي للحالة (مفتوح/مغلق)' : 'Enable automatic status update (Open/Closed)'}
                    </span>
                  </label>
                  {restAutoStatus && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pl-8">
                      <div>
                        <label className="label text-sm">{language === 'ar' ? 'وقت الفتح' : 'Opening Time'}</label>
                        <input type="time" value={restOpenTime} onChange={(e) => setRestOpenTime(e.target.value)} className="input" />
                      </div>
                      <div>
                        <label className="label text-sm">{language === 'ar' ? 'وقت الإغلاق' : 'Closing Time'}</label>
                        <input type="time" value={restCloseTime} onChange={(e) => setRestCloseTime(e.target.value)} className="input" />
                      </div>
                      <label className="flex items-center gap-3 sm:col-span-2">
                        <input
                          type="checkbox"
                          checked={restNotify}
                          onChange={(e) => setRestNotify(e.target.checked)}
                          className="w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          {language === 'ar' ? 'إرسال إشعار عند تغيير الحالة' : 'Send notification on status change'}
                        </span>
                      </label>
                      {restNotify && (
                        <div className="sm:col-span-2">
                          <label className="label text-sm">{language === 'ar' ? 'رقم الهاتف للإشعارات' : 'Notification Phone'}</label>
                          <input
                            type="tel"
                            value={restNotifyPhone}
                            onChange={(e) => setRestNotifyPhone(e.target.value)}
                            placeholder={language === 'ar' ? 'مثال: 9665XXXXXXXX' : 'e.g. 9665XXXXXXXX'}
                            className="input"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* WhatsApp Auto-Send */}
              <div>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <MessageCircle className="w-5 h-5 text-green-500" />
                  {language === 'ar' ? 'إرسال واتساب التلقائي' : 'WhatsApp Auto-Send'}
                </h3>
                <div className="space-y-4">
                  <label className="flex items-center justify-between p-3 rounded-xl border border-gray-200 dark:border-dark-700">
                    <span className="font-medium text-sm">{language === 'ar' ? 'تفعيل الإرسال التلقائي' : 'Enable Auto-Send'}</span>
                    <input type="checkbox" checked={waAutoSend} onChange={(e) => setWaAutoSend(e.target.checked)} className="h-4 w-4 rounded" />
                  </label>

                  {waAutoSend && (
                    <div className="space-y-3 pl-4 border-s-2 border-green-200 dark:border-green-900">
                      <label className="flex items-center justify-between p-2 rounded-lg bg-gray-50 dark:bg-dark-800">
                        <span className="text-sm">{language === 'ar' ? 'إرسال عند فتح المطعم' : 'Send on Restaurant Open'}</span>
                        <input type="checkbox" checked={waOnOpen} onChange={(e) => setWaOnOpen(e.target.checked)} className="h-4 w-4 rounded" />
                      </label>
                      <label className="flex items-center justify-between p-2 rounded-lg bg-gray-50 dark:bg-dark-800">
                        <span className="text-sm">{language === 'ar' ? 'إرسال عند إنشاء طلب' : 'Send on Order Placed'}</span>
                        <input type="checkbox" checked={waOnOrderPlaced} onChange={(e) => setWaOnOrderPlaced(e.target.checked)} className="h-4 w-4 rounded" />
                      </label>
                      <label className="flex items-center justify-between p-2 rounded-lg bg-gray-50 dark:bg-dark-800">
                        <span className="text-sm">{language === 'ar' ? 'إرسال عند جاهزية الطلب' : 'Send on Order Ready'}</span>
                        <input type="checkbox" checked={waOnOrderReady} onChange={(e) => setWaOnOrderReady(e.target.checked)} className="h-4 w-4 rounded" />
                      </label>
                      <label className="flex items-center justify-between p-2 rounded-lg bg-gray-50 dark:bg-dark-800">
                        <span className="text-sm">{language === 'ar' ? 'إرسال عند تقديم الطلب' : 'Send on Order Served'}</span>
                        <input type="checkbox" checked={waOnOrderServed} onChange={(e) => setWaOnOrderServed(e.target.checked)} className="h-4 w-4 rounded" />
                      </label>

                      {waOnOpen && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="label text-xs">{language === 'ar' ? 'رسالة الفتح (EN)' : 'Open Message (EN)'}</label>
                            <textarea className="input text-sm" rows={2} value={waOpenMsgEn} onChange={(e) => setWaOpenMsgEn(e.target.value)} />
                          </div>
                          <div>
                            <label className="label text-xs">{language === 'ar' ? 'رسالة الفتح (AR)' : 'Open Message (AR)'}</label>
                            <textarea className="input text-sm" rows={2} value={waOpenMsgAr} onChange={(e) => setWaOpenMsgAr(e.target.value)} dir="rtl" />
                          </div>
                        </div>
                      )}

                      {waOnOrderPlaced && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="label text-xs">{language === 'ar' ? 'رسالة الطلب (EN)' : 'Order Placed (EN)'}</label>
                            <textarea className="input text-sm" rows={2} value={waOrderPlacedMsgEn} onChange={(e) => setWaOrderPlacedMsgEn(e.target.value)} />
                          </div>
                          <div>
                            <label className="label text-xs">{language === 'ar' ? 'رسالة الطلب (AR)' : 'Order Placed (AR)'}</label>
                            <textarea className="input text-sm" rows={2} value={waOrderPlacedMsgAr} onChange={(e) => setWaOrderPlacedMsgAr(e.target.value)} dir="rtl" />
                          </div>
                        </div>
                      )}

                      {waOnOrderReady && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="label text-xs">{language === 'ar' ? 'رسالة الجاهزية (EN)' : 'Order Ready (EN)'}</label>
                            <textarea className="input text-sm" rows={2} value={waOrderReadyMsgEn} onChange={(e) => setWaOrderReadyMsgEn(e.target.value)} />
                          </div>
                          <div>
                            <label className="label text-xs">{language === 'ar' ? 'رسالة الجاهزية (AR)' : 'Order Ready (AR)'}</label>
                            <textarea className="input text-sm" rows={2} value={waOrderReadyMsgAr} onChange={(e) => setWaOrderReadyMsgAr(e.target.value)} dir="rtl" />
                          </div>
                        </div>
                      )}

                      {waOnOrderServed && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="label text-xs">{language === 'ar' ? 'رسالة التقديم (EN)' : 'Order Served (EN)'}</label>
                            <textarea className="input text-sm" rows={2} value={waOrderServedMsgEn} onChange={(e) => setWaOrderServedMsgEn(e.target.value)} />
                          </div>
                          <div>
                            <label className="label text-xs">{language === 'ar' ? 'رسالة التقديم (AR)' : 'Order Served (AR)'}</label>
                            <textarea className="input text-sm" rows={2} value={waOrderServedMsgAr} onChange={(e) => setWaOrderServedMsgAr(e.target.value)} dir="rtl" />
                          </div>
                        </div>
                      )}

                      {waOnOpen && (
                        <div>
                          <label className="label text-xs">{language === 'ar' ? 'أرقام الإشعار (مفصولة بفواصل)' : 'Notification Phones (comma-separated)'}</label>
                          <input className="input text-sm" value={waNotifyPhones} onChange={(e) => setWaNotifyPhones(e.target.value)} placeholder="+9665xxxxxxxx, +9665yyyyyyyy" />
                          <p className="text-xs text-gray-400 mt-1">{language === 'ar' ? 'سيتم إرسال رسالة الفتح لهذه الأرقام يومياً' : 'Open notification will be sent to these numbers daily'}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Print Behaviour */}
              <div>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Printer className="w-5 h-5 text-primary-500" />
                  {language === 'ar' ? 'إعدادات الطباعة' : 'Print Settings'}
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-dark-700/50 rounded-xl">
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white text-sm">
                        {language === 'ar' ? 'طباعة تذكرة المطبخ تلقائياً' : 'Auto-print Kitchen Ticket'}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {language === 'ar'
                          ? 'عند إرسال الطلب للمطبخ، تُطبع تذكرة المطبخ تلقائياً'
                          : 'When sending an order to kitchen, the kitchen ticket is automatically printed'}
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={restPrintKitchenReceipt}
                        onChange={(e) => setRestPrintKitchenReceipt(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600" />
                    </label>
                  </div>
                </div>
              </div>

              {/* Printers */}
              <div>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Printer className="w-5 h-5 text-primary-500" />
                  {language === 'ar' ? 'إعدادات الطابعات' : 'Printer Settings'}
                </h3>
                <div className="space-y-4">
                  {(restPrinters || []).map((printer, idx) => (
                    <div key={idx} className="border rounded-xl p-4 space-y-3 bg-gray-50 dark:bg-dark-800">
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-sm">{language === 'ar' ? `الطابعة ${idx + 1}` : `Printer ${idx + 1}`}</span>
                        <button
                          onClick={() => setRestPrinters(prev => prev.filter((_, i) => i !== idx))}
                          className="text-red-500 hover:text-red-700 text-sm"
                        >
                          {language === 'ar' ? 'حذف' : 'Remove'}
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <input
                          value={printer.name || ''}
                          onChange={(e) => {
                            const next = [...restPrinters]
                            next[idx] = { ...next[idx], name: e.target.value }
                            setRestPrinters(next)
                          }}
                          placeholder={language === 'ar' ? 'اسم الطابعة' : 'Printer Name'}
                          className="input text-sm"
                        />
                        <select
                          value={printer.role || 'kitchen'}
                          onChange={(e) => {
                            const next = [...restPrinters]
                            next[idx] = { ...next[idx], role: e.target.value }
                            setRestPrinters(next)
                          }}
                          className="input text-sm"
                        >
                          <option value="kitchen">{language === 'ar' ? 'مطبخ' : 'Kitchen'}</option>
                          <option value="receipt">{language === 'ar' ? 'فاتورة' : 'Receipt'}</option>
                        </select>
                        <select
                          value={printer.type || 'network'}
                          onChange={(e) => {
                            const next = [...restPrinters]
                            next[idx] = { ...next[idx], type: e.target.value }
                            setRestPrinters(next)
                          }}
                          className="input text-sm"
                        >
                          <option value="network">{language === 'ar' ? 'شبكة (IP)' : 'Network (IP)'}</option>
                          <option value="usb">USB</option>
                          <option value="bluetooth">Bluetooth</option>
                        </select>
                        <input
                          value={printer.ipAddress || ''}
                          onChange={(e) => {
                            const next = [...restPrinters]
                            next[idx] = { ...next[idx], ipAddress: e.target.value }
                            setRestPrinters(next)
                          }}
                          placeholder={language === 'ar' ? 'عنوان IP' : 'IP Address'}
                          className="input text-sm"
                        />
                        <input
                          type="number"
                          value={printer.port || 9100}
                          onChange={(e) => {
                            const next = [...restPrinters]
                            next[idx] = { ...next[idx], port: Number(e.target.value) }
                            setRestPrinters(next)
                          }}
                          placeholder="Port"
                          className="input text-sm"
                        />
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={printer.enabled || false}
                            onChange={(e) => {
                              const next = [...restPrinters]
                              next[idx] = { ...next[idx], enabled: e.target.checked }
                              setRestPrinters(next)
                            }}
                            className="rounded"
                          />
                          {language === 'ar' ? 'مفعّلة' : 'Enabled'}
                        </label>
                      </div>
                    </div>
                  ))}
                  <button
                    onClick={() => setRestPrinters([...restPrinters, { name: '', role: 'kitchen', type: 'network', ipAddress: '', port: 9100, enabled: false, paperWidth: 80 }])}
                    className="btn btn-outline text-sm w-full"
                  >
                    + {language === 'ar' ? 'إضافة طابعة' : 'Add Printer'}
                  </button>
                </div>
              </div>

              {/* Save */}
              <div className="pt-4 border-t">
                <button
                  disabled={updateMutation.isPending}
                  onClick={() => updateMutation.mutate({
                    settings: {
                      ...(tenant?.settings || {}),
                      restaurant: {
                        ...(tenant?.settings?.restaurant || {}),
                        autoStatusUpdate: restAutoStatus,
                        openingTime: restOpenTime,
                        closingTime: restCloseTime,
                        notifyOnStatusChange: restNotify,
                        statusNotificationPhone: restNotifyPhone,
                        printers: restPrinters,
                        printKitchenReceipt: restPrintKitchenReceipt,
                        whatsapp: {
                          autoSendEnabled: waAutoSend,
                          autoSendOnOpen: waOnOpen,
                          autoSendOnOrderPlaced: waOnOrderPlaced,
                          autoSendOnOrderReady: waOnOrderReady,
                          autoSendOnOrderServed: waOnOrderServed,
                          openMessageEn: waOpenMsgEn,
                          openMessageAr: waOpenMsgAr,
                          orderPlacedMessageEn: waOrderPlacedMsgEn,
                          orderPlacedMessageAr: waOrderPlacedMsgAr,
                          orderReadyMessageEn: waOrderReadyMsgEn,
                          orderReadyMessageAr: waOrderReadyMsgAr,
                          orderServedMessageEn: waOrderServedMsgEn,
                          orderServedMessageAr: waOrderServedMsgAr,
                          notifyPhoneList: waNotifyPhones.split(',').map(p => p.trim()).filter(Boolean),
                        },
                      },
                    },
                  })}
                  className="btn btn-primary"
                >
                  {updateMutation.isPending ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><Save className="w-4 h-4" /> {t('save')}</>}
                </button>
              </div>
            </motion.div>
          )}

          {activeTab === 'bakala' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card p-6 space-y-8">
              <div>
                <h3 className="text-lg font-semibold mb-2">{language === 'ar' ? 'إعدادات البقالة' : 'Bakala Settings'}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                  {language === 'ar' ? 'إدارة إعدادات نقاط البيع والورديات' : 'Manage POS and shift settings'}
                </p>
              </div>

              <div className="space-y-6">
                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-dark-700/50 rounded-xl">
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">{language === 'ar' ? 'اشتراط فتح الوردية' : 'Require Shift Open'}</p>
                    <p className="text-sm text-gray-500">
                      {language === 'ar'
                        ? 'عند التفعيل، يجب فتح الوردية قبل استخدام نقاط البيع'
                        : 'When enabled, a shift must be opened before using the POS'}
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={bakalaRequireShift}
                      onChange={(e) => setBakalaRequireShift(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600" />
                  </label>
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-dark-700/50 rounded-xl">
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">{language === 'ar' ? 'ضريبة القيمة المضافة (15%)' : 'VAT Tax (15%)'}</p>
                    <p className="text-sm text-gray-500">
                      {language === 'ar'
                        ? 'عند التفعيل، تظهر الضريبة على الفواتير والإيصالات'
                        : 'When enabled, tax is shown on invoices and receipts'}
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={bakalaTaxEnabled}
                      onChange={(e) => setBakalaTaxEnabled(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600" />
                  </label>
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-dark-700/50 rounded-xl">
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">{language === 'ar' ? 'الطباعة التلقائية للفواتير' : 'Auto Invoice Print'}</p>
                    <p className="text-sm text-gray-500">
                      {language === 'ar'
                        ? 'عند التفعيل، تتم طباعة الإيصال تلقائياً بعد كل عملية بيع'
                        : 'When enabled, receipt prints automatically after each checkout'}
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={bakalaAutoInvoicePrint}
                      onChange={(e) => setBakalaAutoInvoicePrint(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600" />
                  </label>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-100 dark:border-dark-700">
                <button
                  onClick={() =>
                    updateMutation.mutate({
                      settings: {
                        bakala: {
                          requireShift: bakalaRequireShift,
                          taxEnabled: bakalaTaxEnabled,
                          autoInvoicePrint: bakalaAutoInvoicePrint,
                        },
                      },
                    })
                  }
                  className="btn btn-primary"
                >
                  {updateMutation.isPending ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Save className="w-4 h-4" /> {t('save')}
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          )}

          {activeTab === 'bookstore' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card p-6 space-y-8">
              <div>
                <h3 className="text-lg font-semibold mb-2">{language === 'ar' ? 'إعدادات المكتبة' : 'Bookstore Settings'}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                  {language === 'ar' ? 'إدارة إعدادات نقاط البيع والورديات في المكتبة' : 'Manage bookstore POS and shift settings'}
                </p>
              </div>

              <div className="space-y-6">
                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-dark-700/50 rounded-xl">
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">{language === 'ar' ? 'اشتراط فتح الوردية' : 'Require Shift Open'}</p>
                    <p className="text-sm text-gray-500">
                      {language === 'ar'
                        ? 'عند التفعيل، يجب فتح الوردية قبل استخدام نقاط البيع في المكتبة'
                        : 'When enabled, a shift must be opened before using the bookstore POS'}
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={bookstoreRequireShift}
                      onChange={(e) => setBookstoreRequireShift(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600" />
                  </label>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-100 dark:border-dark-700">
                <button
                  onClick={() =>
                    updateMutation.mutate({
                      settings: {
                        bookstore: {
                          requireShift: bookstoreRequireShift,
                        },
                      },
                    })
                  }
                  className="btn btn-primary"
                >
                  {updateMutation.isPending ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Save className="w-4 h-4" /> {t('save')}
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          )}

          {activeTab === 'backup' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card p-6">
              <h3 className="text-lg font-semibold mb-2">{language === 'ar' ? 'النسخ الاحتياطي' : 'Backup'}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {language === 'ar'
                  ? 'قم بتنزيل نسخة احتياطية كاملة من بيانات المستأجر. قد يستغرق التحميل وقتاً حسب حجم البيانات.'
                  : 'Download a full tenant backup. Download time depends on dataset size.'}
              </p>

              <div className="mt-6 flex items-center gap-3">
                <button onClick={downloadBackup} disabled={downloadingBackup} className="btn btn-primary">
                  {downloadingBackup ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      {language === 'ar' ? 'تنزيل النسخة الاحتياطية' : 'Download Backup'}
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  )
}
