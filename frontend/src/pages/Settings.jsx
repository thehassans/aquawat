import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSelector, useDispatch } from 'react-redux'
import { useForm } from 'react-hook-form'
import { motion } from 'framer-motion'
import { Building2, Shield, Globe, Palette, Bell, Save, Key, CheckCircle, Image, Database, Download, FileText, CreditCard, Terminal, Car, UtensilsCrossed, Clock, Printer, MapPin, Briefcase, Receipt, MessageCircle, BookOpen, PanelLeft, Eye, EyeOff, Menu, Monitor, Smartphone, Maximize } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../lib/api'
import { useTranslation } from '../lib/translations'
import { setLanguage, setTheme, setHideSidebar, setHiddenMenuItems, setHiddenMenuItemsForTenant, toggleHiddenMenuItemForTenant, setDisplayMode } from '../store/slices/uiSlice'
import { updateTenant } from '../store/slices/authSlice'
import { useLiveTranslation } from '../lib/liveTranslation'
import { getInvoiceBrandingProfile, getInvoiceTemplateId, getInvoiceTypography, INVOICE_FONT_OPTIONS } from '../lib/invoiceBranding'
import { invoiceTemplateOptions } from '../lib/invoiceTemplates'
import { getNavSections } from '../lib/sidebarConfig'
import { getTenantBusinessTypes } from '../lib/businessTypes'
import PosTerminalSettings from '../components/settings/PosTerminalSettings'
import HardwareSettings from '../components/settings/HardwareSettings'
import CarRentalApiSettings from '../components/settings/CarRentalApiSettings'
import GovernmentIntegrations from './tenant-settings/GovernmentIntegrations'
import InvoiceLivePreview from '../components/invoices/InvoiceLivePreview'

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
  const isZatcaPhase1 = (tenant?.zatca?.phase || 1) === 1
  const business = tenant?.business || {}
  const isZatcaPhase1Ready = isZatcaPhase1 && !!business.vatNumber && !!(business.legalNameEn || business.legalNameAr) && !!(business.address?.city && business.address?.country)
  const hasZatca = si.zatcaConnectionStatus === 'connected' || tenant?.zatca?.isOnboarded || isZatcaPhase1Ready
  const hasElm = si.elmConnectionStatus === 'connected'
  const hasQiwa = si.qiwaConnectionStatus === 'connected'
  const hasGosi = si.gosiConnectionStatus === 'connected'

  const govChildren = []
  if (hasZatca) govChildren.push({ path: '/app/dashboard/tenant-settings/government-integrations/zatca', label: language === 'ar' ? `بوابة زاتكا ${isZatcaPhase1 ? '(المرحلة 1)' : ''}` : `ZATCA${isZatcaPhase1 ? ' Phase 1' : ''} Portal` })
  if (hasElm) govChildren.push({ path: '/app/dashboard/tenant-settings/government-integrations/elm', label: language === 'ar' ? 'بوابة علم / يقين' : 'Elm Portal' })
  if (hasQiwa) govChildren.push({ path: '/app/dashboard/tenant-settings/government-integrations/qiwa', label: language === 'ar' ? 'بوابة قوى' : 'Qiwa Portal' })
  if (hasGosi) govChildren.push({ path: '/app/dashboard/tenant-settings/government-integrations/gosi', label: language === 'ar' ? 'بوابة التأمينات / مدد' : 'GOSI/Mudad Portal' })

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
  const { language, theme, hideSidebar, hiddenMenuItems, displayMode } = useSelector((state) => state.ui)
  const { user } = useSelector((state) => state.auth)
  const { t } = useTranslation(language)
  const [activeTab, setActiveTab] = useState('company')
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
  const [invoiceLogoDataUrl, setInvoiceLogoDataUrl] = useState(null)
  const [stampDataUrl, setStampDataUrl] = useState(null)
  const [signatureDataUrl, setSignatureDataUrl] = useState(null)
  const [letterheadDataUrl, setLetterheadDataUrl] = useState(null)
  const [invoiceHeaderTextEn, setInvoiceHeaderTextEn] = useState('')
  const [invoiceHeaderTextAr, setInvoiceHeaderTextAr] = useState('')
  const [invoiceFooterTextEn, setInvoiceFooterTextEn] = useState('')
  const [invoiceFooterTextAr, setInvoiceFooterTextAr] = useState('')
  const [invoiceBodyFontFamily, setInvoiceBodyFontFamily] = useState('helvetica')
  const [invoiceHeadingFontFamily, setInvoiceHeadingFontFamily] = useState('helvetica')
  const [invoiceBodyFontSize, setInvoiceBodyFontSize] = useState(12)
  const [invoiceHeadingFontSize, setInvoiceHeadingFontSize] = useState(18)
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
    setInvoiceCurrencyDisplay(tenant.settings?.invoiceCurrencyDisplay === 'icon' ? 'icon' : 'text')
    setInvoiceCurrencyPosition(tenant.settings?.invoiceCurrencyPosition === 'before' ? 'before' : 'after')
    setInvoiceLogoDataUrl(tenant.settings?.invoiceBranding?.logo || tenant.branding?.logo || null)
    setStampDataUrl(tenant.settings?.invoiceBranding?.stampImage || null)
    setSignatureDataUrl(tenant.settings?.invoiceBranding?.signatureImage || null)
    setLetterheadDataUrl(tenant.settings?.invoiceBranding?.letterheadImage || null)
    setInvoiceHeaderTextEn(tenant.settings?.invoiceBranding?.headerTextEn || '')
    setInvoiceHeaderTextAr(tenant.settings?.invoiceBranding?.headerTextAr || '')
    setInvoiceFooterTextEn(tenant.settings?.invoiceBranding?.footerTextEn || '')
    setInvoiceFooterTextAr(tenant.settings?.invoiceBranding?.footerTextAr || '')
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
        country: tenant.business?.address?.country || 'SA'
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
    applyImageFile(e.target.files?.[0], setLogoDataUrl)
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

  const handleLetterheadFile = (e) => {
    applyImageFile(e.target.files?.[0], setLetterheadDataUrl)
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
    { id: 'company', label: t('companySettings'), icon: Building2 },
    { id: 'templates', label: language === 'ar' ? 'قوالب الفواتير' : 'Invoice Templates', icon: FileText },
    { id: 'govIntegrations', label: language === 'ar' ? 'التكاملات الحكومية' : 'Government Integrations', icon: Shield },
    { id: 'preferences', label: language === 'ar' ? 'التفضيلات' : 'Preferences', icon: Palette },
    { id: 'setupMachine', label: language === 'ar' ? 'إعداد الدفع الإلكتروني' : 'Payment Terminal', icon: CreditCard },
    { id: 'hardware', label: language === 'ar' ? 'الأجهزة والطباعة' : 'Hardware & Printers', icon: Terminal },
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('settings')}</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          {language === 'ar' ? 'إدارة إعدادات الشركة والنظام' : 'Manage company and system settings'}
        </p>
      </div>

      <div className="space-y-6">
        {/* Horizontal Tabs */}
        <div className="card p-1 flex gap-1 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-3 rounded-xl whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'bg-primary-500 text-white shadow-lg'
                  : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-dark-700'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span className="font-medium">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div>
          {activeTab === 'company' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card p-6">
              <h3 className="text-lg font-semibold mb-6">{t('companySettings')}</h3>
              <form onSubmit={handleSubmit((data) => updateMutation.mutate({
                business: data,
                branding: {
                  ...(tenant?.branding || {}),
                  logo: logoDataUrl || tenant?.branding?.logo || null,
                },
              }))} className="space-y-4">
                <fieldset disabled={user?.role !== 'superadmin'} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="label">{language === 'ar' ? 'الاسم القانوني (EN)' : 'Legal Name (EN)'}</label>
                    <input {...register('legalNameEn')} className="input" />
                  </div>
                  <div>
                    <label className="label">{language === 'ar' ? 'الاسم القانوني (AR)' : 'Legal Name (AR)'}</label>
                    <input {...register('legalNameAr')} className="input" dir="rtl" />
                  </div>
                  <div>
                    <label className="label">{language === 'ar' ? 'الرقم الضريبي' : 'VAT Number'}</label>
                    <input {...register('vatNumber')} className="input" />
                  </div>
                  <div>
                    <label className="label">{language === 'ar' ? 'السجل التجاري' : 'CR Number'}</label>
                    <input {...register('crNumber')} className="input" />
                  </div>
                  <div>
                    <label className="label">{language === 'ar' ? 'المدينة' : 'City'}</label>
                    <input {...register('address.city')} className="input" />
                  </div>
                  <div>
                    <label className="label">{language === 'ar' ? 'المدينة (AR)' : 'City (AR)'}</label>
                    <input {...register('address.cityAr')} className="input" dir="rtl" />
                  </div>
                  <div>
                    <label className="label">{language === 'ar' ? 'الحي' : 'District'}</label>
                    <input {...register('address.district')} className="input" />
                  </div>
                  <div>
                    <label className="label">{language === 'ar' ? 'الحي (AR)' : 'District (AR)'}</label>
                    <input {...register('address.districtAr')} className="input" dir="rtl" />
                  </div>
                  <div>
                    <label className="label">{language === 'ar' ? 'الشارع' : 'Street'}</label>
                    <input {...register('address.street')} className="input" />
                  </div>
                  <div>
                    <label className="label">{language === 'ar' ? 'الشارع (AR)' : 'Street (AR)'}</label>
                    <input {...register('address.streetAr')} className="input" dir="rtl" />
                  </div>
                  <div>
                    <label className="label">{language === 'ar' ? 'الرمز البريدي' : 'Postal Code'}</label>
                    <input {...register('address.postalCode')} className="input" />
                  </div>
                  <div>
                    <label className="label">{language === 'ar' ? 'رقم المبنى' : 'Building Number'}</label>
                    <input {...register('address.buildingNumber')} className="input" />
                  </div>
                  <div>
                    <label className="label">{language === 'ar' ? 'الرقم الإضافي' : 'Additional Number'}</label>
                    <input {...register('address.additionalNumber')} className="input" />
                  </div>
                  <div>
                    <label className="label">{language === 'ar' ? 'الدولة' : 'Country'}</label>
                    <input {...register('address.country')} className="input" placeholder="SA" />
                  </div>
                  <div>
                    <label className="label">{language === 'ar' ? 'البريد الإلكتروني' : 'Email'}</label>
                    <input type="email" {...register('contactEmail')} className="input" />
                  </div>
                  <div>
                    <label className="label">{language === 'ar' ? 'الهاتف' : 'Phone'}</label>
                    <input {...register('contactPhone')} className="input" />
                  </div>
                </div>

                <div className="mt-8 border-t border-gray-200 dark:border-dark-600 pt-6">
                  <h4 className="text-md font-semibold mb-4 text-gray-900 dark:text-white">
                    {language === 'ar' ? 'تفاصيل الحساب البنكي' : 'Bank Account Details'}
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="label">{language === 'ar' ? 'اسم البنك' : 'Bank Name'}</label>
                      <input {...register('bankDetails.bankName')} className="input" />
                    </div>
                    <div>
                      <label className="label">{language === 'ar' ? 'اسم صاحب الحساب' : 'Account Name'}</label>
                      <input {...register('bankDetails.accountName')} className="input" />
                    </div>
                    <div>
                      <label className="label">{language === 'ar' ? 'رقم الحساب' : 'Account Number'}</label>
                      <input {...register('bankDetails.accountNumber')} className="input" />
                    </div>
                    <div>
                      <label className="label">{language === 'ar' ? 'الآيبان' : 'IBAN'}</label>
                      <input {...register('bankDetails.iban')} className="input" />
                    </div>
                  </div>
                </div>

                {/* National Address */}
                <div className="pt-6 border-t border-gray-200 dark:border-dark-600">
                  <h4 className="text-md font-semibold mb-4 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-blue-500" />
                    {language === 'ar' ? 'العنوان الوطني' : 'National Address'}
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="label">{language === 'ar' ? 'رقم الإثبات' : 'Proof Number'}</label>
                      <input {...register('nationalAddress.proofNumber')} className="input" />
                    </div>
                    <div>
                      <label className="label">{language === 'ar' ? 'حساب العميل' : 'Customer Account'}</label>
                      <input {...register('nationalAddress.customerAccount')} className="input" />
                    </div>
                    <div>
                      <label className="label">{language === 'ar' ? 'تاريخ الإصدار الأصلي' : 'Original Date'}</label>
                      <input type="date" {...register('nationalAddress.originalDate')} className="input" />
                    </div>
                    <div>
                      <label className="label">{language === 'ar' ? 'تاريخ الانتهاء' : 'Expiration Date'}</label>
                      <input type="date" {...register('nationalAddress.expirationDate')} className="input" />
                    </div>
                    <div>
                      <label className="label">{language === 'ar' ? 'تاريخ التسجيل' : 'Registration Date'}</label>
                      <input type="date" {...register('nationalAddress.regDate')} className="input" />
                    </div>
                    <div>
                      <label className="label">{language === 'ar' ? 'العنوان المختصر' : 'Short Address'}</label>
                      <input {...register('nationalAddress.shortAddress')} className="input" />
                    </div>
                    <div>
                      <label className="label">{language === 'ar' ? 'رقم المبنى' : 'Building No'}</label>
                      <input {...register('nationalAddress.buildingNo')} className="input" />
                    </div>
                    <div>
                      <label className="label">{language === 'ar' ? 'الحي' : 'Neighborhood'}</label>
                      <input {...register('nationalAddress.neighborhood')} className="input" />
                    </div>
                    <div>
                      <label className="label">{language === 'ar' ? 'المنطقة' : 'Region'}</label>
                      <input {...register('nationalAddress.region')} className="input" />
                    </div>
                    <div className="md:col-span-2">
                      <label className="label">{language === 'ar' ? 'رابط QR للتحقق' : 'QR Verification URL'}</label>
                      <input {...register('nationalAddress.qrCodeUrl')} className="input" />
                    </div>
                  </div>
                </div>

                {/* Commercial Registration */}
                <div className="pt-6 border-t border-gray-200 dark:border-dark-600">
                  <h4 className="text-md font-semibold mb-4 flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-amber-500" />
                    {language === 'ar' ? 'السجل التجاري' : 'Commercial Registration'}
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="label">{language === 'ar' ? 'الرقم الوطني الموحد' : 'CR Number'}</label>
                      <input {...register('commercialRegistration.crNumber')} className="input" />
                    </div>
                    <div>
                      <label className="label">{language === 'ar' ? 'تاريخ الإصدار' : 'Issue Date'}</label>
                      <input type="date" {...register('commercialRegistration.issueDate')} className="input" />
                    </div>
                    <div>
                      <label className="label">{language === 'ar' ? 'نوع الكيان (EN)' : 'Company Type (EN)'}</label>
                      <input {...register('commercialRegistration.companyType')} className="input" />
                    </div>
                    <div>
                      <label className="label">{language === 'ar' ? 'نوع الكيان (AR)' : 'Company Type (AR)'}</label>
                      <input {...register('commercialRegistration.companyTypeAr')} className="input" dir="rtl" />
                    </div>
                    <div>
                      <label className="label">{language === 'ar' ? 'حالة السجل (EN)' : 'Company Status (EN)'}</label>
                      <input {...register('commercialRegistration.companyStatus')} className="input" />
                    </div>
                    <div>
                      <label className="label">{language === 'ar' ? 'حالة السجل (AR)' : 'Company Status (AR)'}</label>
                      <input {...register('commercialRegistration.companyStatusAr')} className="input" dir="rtl" />
                    </div>
                    <div className="md:col-span-2">
                      <label className="label">{language === 'ar' ? 'رابط QR للتحقق' : 'QR Verification URL'}</label>
                      <input {...register('commercialRegistration.qrCodeUrl')} className="input" />
                    </div>
                  </div>
                </div>

                {/* VAT Registration Certificate */}
                <div className="pt-6 border-t border-gray-200 dark:border-dark-600">
                  <h4 className="text-md font-semibold mb-4 flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-teal-500" />
                    {language === 'ar' ? 'شهادة تسجيل ضريبة القيمة المضافة' : 'VAT Registration Certificate'}
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="label">{language === 'ar' ? 'رقم الشهادة' : 'Certificate No'}</label>
                      <input {...register('vatCertificate.certificateNo')} className="input" />
                    </div>
                    <div>
                      <label className="label">{language === 'ar' ? 'تاريخ الشهادة' : 'Certificate Date'}</label>
                      <input type="date" {...register('vatCertificate.certificateDate')} className="input" />
                    </div>
                    <div>
                      <label className="label">{language === 'ar' ? 'تاريخ التسجيل الفعّال' : 'Effective Registration Date'}</label>
                      <input type="date" {...register('vatCertificate.effectiveDate')} className="input" />
                    </div>
                    <div>
                      <label className="label">{language === 'ar' ? 'تاريخ أول إقرار ضريبي' : 'First Filing Due Date'}</label>
                      <input type="date" {...register('vatCertificate.firstFilingDueDate')} className="input" />
                    </div>
                    <div>
                      <label className="label">{language === 'ar' ? 'الفترة الضريبية (EN)' : 'Tax Period (EN)'}</label>
                      <input {...register('vatCertificate.taxPeriod')} className="input" />
                    </div>
                    <div>
                      <label className="label">{language === 'ar' ? 'الفترة الضريبية (AR)' : 'Tax Period (AR)'}</label>
                      <input {...register('vatCertificate.taxPeriodAr')} className="input" dir="rtl" />
                    </div>
                    <div className="md:col-span-2">
                      <label className="label">{language === 'ar' ? 'رابط QR للتحقق' : 'QR Verification URL'}</label>
                      <input {...register('vatCertificate.qrCodeUrl')} className="input" />
                    </div>
                  </div>
                </div>

                </fieldset>
                {user?.role === 'superadmin' && (
                  <div className="flex justify-end pt-4">
                    <button type="submit" disabled={updateMutation.isPending} className="btn btn-primary">
                      {updateMutation.isPending ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><Save className="w-4 h-4" />{t('save')}</>}
                    </button>
                  </div>
                )}
              </form>

              {/* ─── BRANDING SECTION — editable by all users ─── */}
              <div className="mt-8 pt-8 border-t border-gray-200 dark:border-dark-600 space-y-5">
                <div className="flex items-center gap-2 mb-4">
                  <span className="flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow">
                    <Image className="w-4 h-4 text-white" />
                  </span>
                  <div>
                    <h4 className="text-md font-bold text-gray-900 dark:text-white">
                      {language === 'ar' ? 'هوية العلامة التجارية' : 'Brand Identity'}
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {language === 'ar' ? 'الشعار والختم والترويسة — يمكن تعديلها بحرية' : 'Logo, stamp & letterhead — editable by all users'}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Logo */}
                  <label className="relative group cursor-pointer flex flex-col items-center gap-3 p-5 rounded-2xl border-2 border-dashed border-gray-200 dark:border-dark-600 hover:border-primary-400 dark:hover:border-primary-500 bg-gray-50 dark:bg-dark-800/50 transition-all duration-200 hover:shadow-lg">
                    <div className="relative w-16 h-16 rounded-2xl overflow-hidden bg-white dark:bg-dark-700 shadow-md border border-gray-100 dark:border-dark-600 flex items-center justify-center">
                      {(logoDataUrl || tenant?.branding?.logo) ? (
                        <img src={logoDataUrl || tenant?.branding?.logo} alt="" className="w-full h-full object-contain" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center">
                          <Image className="w-6 h-6 text-white" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                        <span className="opacity-0 group-hover:opacity-100 text-white text-xs font-semibold transition-opacity">Change</span>
                      </div>
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">{language === 'ar' ? 'شعار لوحة الإدارة' : 'Admin Logo'}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{language === 'ar' ? 'الشريط الجانبي وترويسة الفاتورة' : 'Sidebar & invoice header'}</p>
                    </div>
                    <input type="file" accept="image/*" onChange={handleLogoFile} className="sr-only" />
                  </label>

                  {/* Stamp */}
                  <label className="relative group cursor-pointer flex flex-col items-center gap-3 p-5 rounded-2xl border-2 border-dashed border-gray-200 dark:border-dark-600 hover:border-teal-400 dark:hover:border-teal-500 bg-gray-50 dark:bg-dark-800/50 transition-all duration-200 hover:shadow-lg">
                    <div className="relative w-16 h-16 rounded-2xl overflow-hidden bg-white dark:bg-dark-700 shadow-md border border-gray-100 dark:border-dark-600 flex items-center justify-center">
                      {(stampDataUrl || tenant?.branding?.stampImage) ? (
                        <img src={stampDataUrl || tenant?.branding?.stampImage} alt="" className="w-full h-full object-contain" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-teal-400 to-emerald-600 flex items-center justify-center">
                          <span className="text-white text-xs font-bold">SEAL</span>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                        <span className="opacity-0 group-hover:opacity-100 text-white text-xs font-semibold transition-opacity">Change</span>
                      </div>
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">{language === 'ar' ? 'الختم الرسمي' : 'Official Stamp'}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{language === 'ar' ? 'يظهر أسفل الفاتورة' : 'Bottom of invoice'}</p>
                    </div>
                    <input type="file" accept="image/*" onChange={handleStampFile} className="sr-only" />
                  </label>

                  {/* Signature */}
                  <label className="relative group cursor-pointer flex flex-col items-center gap-3 p-5 rounded-2xl border-2 border-dashed border-gray-200 dark:border-dark-600 hover:border-blue-400 dark:hover:border-blue-500 bg-gray-50 dark:bg-dark-800/50 transition-all duration-200 hover:shadow-lg">
                    <div className="relative w-20 h-12 rounded-2xl overflow-hidden bg-white dark:bg-dark-700 shadow-md border border-gray-100 dark:border-dark-600 flex items-center justify-center">
                      {(signatureDataUrl || tenant?.branding?.signatureImage || tenant?.settings?.invoiceBranding?.signatureImage) ? (
                        <img src={signatureDataUrl || tenant?.branding?.signatureImage || tenant?.settings?.invoiceBranding?.signatureImage} alt="" className="w-full h-full object-contain mix-blend-multiply dark:mix-blend-normal" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-blue-400 to-cyan-600 flex items-center justify-center">
                          <span className="text-white text-[10px] font-bold">SIGN</span>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                        <span className="opacity-0 group-hover:opacity-100 text-white text-xs font-semibold transition-opacity">Change</span>
                      </div>
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">{language === 'ar' ? 'التوقيع الرسمي' : 'Official Signature'}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{language === 'ar' ? 'بجانب الختم' : 'Next to stamp'}</p>
                    </div>
                    <input type="file" accept="image/*" onChange={handleSignatureFile} className="sr-only" />
                  </label>

                  {/* Letterhead */}
                  <label className="relative group cursor-pointer flex flex-col items-center gap-3 p-5 rounded-2xl border-2 border-dashed border-gray-200 dark:border-dark-600 hover:border-indigo-400 dark:hover:border-indigo-500 bg-gray-50 dark:bg-dark-800/50 transition-all duration-200 hover:shadow-lg">
                    <div className="relative w-16 h-20 rounded overflow-hidden bg-white dark:bg-dark-700 shadow-md border border-gray-100 dark:border-dark-600 flex items-center justify-center">
                      {(letterheadDataUrl || tenant?.branding?.letterheadImage) ? (
                        <img src={letterheadDataUrl || tenant?.branding?.letterheadImage} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-indigo-400 to-violet-600 flex items-center justify-center">
                          <span className="text-white text-[10px] font-bold text-center px-1">A4 BG</span>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                        <span className="opacity-0 group-hover:opacity-100 text-white text-xs font-semibold transition-opacity">Change</span>
                      </div>
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">{language === 'ar' ? 'الترويسة الرسمية' : 'Letterhead'}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{language === 'ar' ? 'خلفية الفاتورة A4' : 'Full-page background'}</p>
                    </div>
                    <input type="file" accept="image/*" onChange={handleLetterheadFile} className="sr-only" />
                  </label>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    disabled={updateMutation.isPending}
                    onClick={() => updateMutation.mutate({
                      branding: {
                        ...(tenant?.branding || {}),
                        logo: logoDataUrl || tenant?.branding?.logo || null,
                        stampImage: stampDataUrl || tenant?.branding?.stampImage || null,
                        signatureImage: signatureDataUrl || tenant?.branding?.signatureImage || null,
                        letterheadImage: letterheadDataUrl || tenant?.branding?.letterheadImage || null,
                      }
                    })}
                    className="btn btn-primary"
                  >
                    {updateMutation.isPending
                      ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      : <><Save className="w-4 h-4" />{language === 'ar' ? 'حفظ هوية العلامة' : 'Save Branding'}</>}
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'templates' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card p-6">
              <h3 className="text-lg font-semibold mb-6 flex items-center gap-2"><FileText className="w-5 h-5 text-primary-500" />{language === 'ar' ? 'قوالب الفواتير' : 'Invoice Templates'}</h3>
              
              <div className="space-y-8">
                {/* Default Invoice Template */}
                <div>
                  <label className="label flex items-center gap-2 mb-4">{language === 'ar' ? 'القالب الافتراضي للفواتير' : 'Default Invoice Template'}</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    {invoiceTemplateOptions.map((tpl) => (
                      <div 
                        key={tpl.id}
                        onClick={() => setInvoicePdfTemplate(tpl.id)}
                        className={`cursor-pointer rounded-2xl border-2 transition-all p-4 ${invoicePdfTemplate === tpl.id ? 'border-primary-500 bg-primary-50/50 dark:bg-primary-900/10' : 'border-gray-200 dark:border-dark-600 hover:border-gray-300 dark:hover:border-dark-500'}`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-bold text-sm text-gray-900 dark:text-white">{language === 'ar' ? tpl.nameAr : tpl.nameEn}</span>
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${invoicePdfTemplate === tpl.id ? 'border-primary-500' : 'border-gray-300'}`}>
                            {invoicePdfTemplate === tpl.id && <div className="w-2.5 h-2.5 bg-primary-500 rounded-full" />}
                          </div>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{language === 'ar' ? tpl.descriptionAr : tpl.descriptionEn}</p>
                      </div>
                    ))}
                  </div>

                  <div className="border border-gray-200 dark:border-dark-600 rounded-2xl p-6 bg-gray-50/50 dark:bg-dark-800/50">
                    <label className="label mb-4">{language === 'ar' ? 'معاينة مباشرة للقالب الافتراضي' : 'Live Preview of Default Template'}</label>
                    <div className="rounded-xl border border-gray-200 dark:border-dark-600 bg-gray-100 dark:bg-dark-900 p-4 md:p-8 flex justify-center h-[500px] md:h-[700px] lg:h-[900px] overflow-y-auto relative custom-scrollbar">
                      <div className="origin-top scale-[0.45] sm:scale-[0.55] md:scale-[0.7] lg:scale-[0.8] transition-all" style={{ width: '1000px' }}>
                        <div className="pointer-events-none shadow-2xl bg-white">
                          <InvoiceLivePreview
                            invoice={{
                              invoiceNumber: 'INV-2026-001',
                              issueDate: new Date(),
                              grandTotal: 1150,
                              totalTax: 150,
                              subtotal: 1000,
                              totalDiscount: 0,
                              currency: tenant?.settings?.currency || 'SAR',
                              buyer: { name: 'Acme Corp', nameAr: 'شركة أكامي', vatNumber: '310000000000003' },
                              seller: { name: tenant?.business?.legalNameEn || 'My Company', nameAr: tenant?.business?.legalNameAr || 'شركتي', vatNumber: tenant?.business?.vatNumber || '300000000000003' },
                              lines: [
                                { raw: { productName: 'Professional Services', productNameAr: 'خدمات احترافية' }, quantity: 1, unitPrice: 1000, lineTotalWithTax: 1150, taxAmount: 150 }
                              ]
                            }}
                            tenant={{
                              ...tenant,
                              branding: { ...tenant?.branding, logo: logoDataUrl || tenant?.branding?.logo },
                              settings: {
                                ...tenant?.settings,
                                invoicePdfTemplate,
                                invoiceBranding: {
                                  logo: invoiceLogoDataUrl || tenant?.settings?.invoiceBranding?.logo || logoDataUrl || tenant?.branding?.logo,
                                  stampImage: stampDataUrl || tenant?.settings?.invoiceBranding?.stampImage || null,
                                  signatureImage: signatureDataUrl || tenant?.settings?.invoiceBranding?.signatureImage || null,
                                  letterheadImage: letterheadDataUrl || tenant?.settings?.invoiceBranding?.letterheadImage || null,
                                }
                              }
                            }}
                            templateId={invoicePdfTemplate}
                            language={language}
                            bilingual={true}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Context-specific Templates */}
                <div className="pt-8 border-t border-gray-100 dark:border-dark-700">
                  <label className="label flex items-center gap-2 mb-4">{language === 'ar' ? 'قوالب مخصصة للأقسام' : 'Context-Specific Templates'}</label>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{language === 'ar' ? 'يمكنك تحديد قالب مختلف لكل قسم عمل' : 'You can define a different template for each business division.'}</p>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {invoiceBrandingContexts.filter(c => tenantBusinessTypes.includes(c.key)).map((context) => {
                      const profile = invoiceBrandingProfiles?.[context.key] || {}
                      return (
                        <div key={context.key} className="p-5 rounded-2xl bg-gray-50 dark:bg-dark-700/50 border border-gray-100 dark:border-dark-600">
                          <div className="font-semibold text-gray-900 dark:text-white mb-4 pb-3 border-b border-gray-200 dark:border-dark-600">{language === 'ar' ? context.labelAr : context.labelEn}</div>
                          
                          <div className="space-y-4">
                            <div>
                              <label className="text-xs text-gray-500 block mb-1.5">{language === 'ar' ? 'القالب' : 'Template'}</label>
                              <select 
                                value={profile.templateId || invoicePdfTemplate}
                                onChange={(e) => setInvoiceBrandingProfiles((curr) => updateInvoiceBrandingProfileState(curr, context.key, { templateId: Number(e.target.value) }))}
                                className="select w-full text-sm"
                              >
                                {invoiceTemplateOptions.map((tpl) => (
                                  <option key={tpl.id} value={tpl.id}>{language === 'ar' ? tpl.nameAr : tpl.nameEn}</option>
                                ))}
                              </select>
                            </div>
                            
                            <div>
                              <label className="text-xs text-gray-500 block mb-1.5">{language === 'ar' ? 'شعار القسم' : 'Division Logo'}</label>
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-white dark:bg-dark-800 border border-gray-200 flex items-center justify-center overflow-hidden">
                                  {profile.logo ? <img src={profile.logo} alt="" className="w-full h-full object-contain" /> : <Image className="w-4 h-4 text-gray-400" />}
                                </div>
                                <input type="file" accept="image/*" onChange={handleInvoiceContextLogoFile(context.key)} className="text-xs file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200 w-full" />
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div className="flex justify-end pt-4 border-t border-gray-100 dark:border-dark-700">
                  <button
                    type="button"
                    disabled={updateMutation.isPending}
                    onClick={() => updateMutation.mutate({
                      settings: {
                        ...(tenant?.settings || {}),
                        invoicePdfTemplate,
                        invoiceBranding: {
                          ...(tenant?.settings?.invoiceBranding || {}),
                          contextProfiles: invoiceBrandingContexts.reduce((acc, item) => {
                            const profile = invoiceBrandingProfiles?.[item.key] || {}
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
                        }
                      }
                    })}
                    className="btn btn-primary"
                  >
                    {updateMutation.isPending ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><Save className="w-4 h-4" />{t('save')}</>}
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'govIntegrations' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <GovernmentIntegrations />
            </motion.div>
          )}

          {activeTab === 'preferences' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card p-6">
              <h3 className="text-lg font-semibold mb-6">{language === 'ar' ? 'التفضيلات' : 'Preferences'}</h3>
              <div className="space-y-6">
                <div>
                  <label className="label flex items-center gap-2"><Globe className="w-4 h-4" />{t('language')}</label>
                  <div className="flex gap-3 mt-2">
                    <button
                      onClick={() => dispatch(setLanguage('en'))}
                      className={`flex-1 p-4 rounded-xl border-2 transition-all ${language === 'en' ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' : 'border-gray-200 dark:border-dark-600'}`}
                    >
                      <span className="font-medium">{t('english')}</span>
                    </button>
                    <button
                      onClick={() => dispatch(setLanguage('ar'))}
                      className={`flex-1 p-4 rounded-xl border-2 transition-all ${language === 'ar' ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' : 'border-gray-200 dark:border-dark-600'}`}
                    >
                      <span className="font-medium">{t('arabic')}</span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="label flex items-center gap-2"><Palette className="w-4 h-4" />{t('theme')}</label>
                  <div className="flex gap-3 mt-2">
                    <button
                      onClick={() => dispatch(setTheme('light'))}
                      className={`flex-1 p-4 rounded-xl border-2 transition-all ${theme === 'light' ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' : 'border-gray-200 dark:border-dark-600'}`}
                    >
                      <span className="font-medium">{t('light')}</span>
                    </button>
                    <button
                      onClick={() => dispatch(setTheme('dark'))}
                      className={`flex-1 p-4 rounded-xl border-2 transition-all ${theme === 'dark' ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' : 'border-gray-200 dark:border-dark-600'}`}
                    >
                      <span className="font-medium">{t('dark')}</span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="label flex items-center gap-2"><Monitor className="w-4 h-4" />{language === 'ar' ? 'وضع الشاشة' : 'Screen View'}</label>
                  <div className="flex gap-3 mt-2">
                    {[
                      { key: 'auto', label: language === 'ar' ? 'تلقائي' : 'Auto', icon: Maximize, desc: language === 'ar' ? 'يتكيف مع حجم الشاشة' : 'Adapts to screen size' },
                      { key: 'desktop', label: language === 'ar' ? 'سطح المكتب' : 'Desktop', icon: Monitor, desc: language === 'ar' ? 'الحجم الافتراضي' : 'Default size' },
                      { key: 'tablet', label: language === 'ar' ? 'تابلت' : 'Tablet', icon: Smartphone, desc: language === 'ar' ? 'تخطيط سطح مكتب أصغر' : 'Smaller desktop layout' },
                    ].map(({ key, label, icon: Icon, desc }) => (
                      <button
                        key={key}
                        onClick={() => dispatch(setDisplayMode({ tenantId: tenant?._id, mode: key }))}
                        className={`flex-1 p-4 rounded-xl border-2 transition-all text-left ${
                          displayMode === key
                            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                            : 'border-gray-200 dark:border-dark-600 hover:bg-gray-50 dark:hover:bg-dark-700/50'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <Icon className="w-4 h-4 text-primary-500" />
                          <span className="font-medium">{label}</span>
                        </div>
                        <p className="text-xs text-gray-500">{desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="label flex items-center gap-2"><PanelLeft className="w-4 h-4" />{language === 'ar' ? 'Sidebar Navigation' : 'Sidebar Navigation'}</label>
                  <label className="mt-2 flex items-center justify-between p-4 rounded-xl border-2 border-gray-200 dark:border-dark-600 cursor-pointer hover:bg-gray-50 dark:hover:bg-dark-700/50 transition-colors">
                    <div>
                      <span className="font-medium text-sm">{language === 'ar' ? 'Hide sidebar navigation' : 'Hide sidebar navigation'}</span>
                      <p className="text-xs text-gray-500 mt-0.5">{language === 'ar' ? 'Hides the sidebar for more screen space. A floating button appears to show it again.' : 'Hides the sidebar for more screen space. A floating button appears to show it again.'}</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={hideSidebar}
                      onChange={(e) => dispatch(setHideSidebar(e.target.checked))}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500 relative" />
                  </label>
                </div>

                <MenuVisibilitySettings />

                <div className="pt-2">
                  <label className="label flex items-center gap-2"><FileText className="w-4 h-4" />{language === 'ar' ? 'تصميم PDF للفواتير' : 'Invoice PDF Design'}</label>
                  <div className="card-glass p-4 mt-2">
                    <div className="mt-3">
                      <label className="text-xs text-gray-500 dark:text-gray-400">{language === 'ar' ? 'عرض العملة' : 'Currency Display'}</label>
                      <select value={invoiceCurrencyDisplay} onChange={(e) => setInvoiceCurrencyDisplay(e.target.value === 'icon' ? 'icon' : 'text')} className="select mt-1 w-full md:w-1/2">
                        <option value="text">{language === 'ar' ? 'نص (SAR)' : 'Text (SAR)'}</option>
                        <option value="icon">{language === 'ar' ? 'رمز الريال السعودي (ï·¼)' : 'Saudi Riyal Icon (ï·¼)'}</option>
                      </select>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                      <div>
                        <label className="text-xs text-gray-500 dark:text-gray-400">{language === 'ar' ? 'نمط تسلسل الإيصالات' : 'Receipt Sequence Pattern'}</label>
                        <input value={invoiceSequencePattern} onChange={(e) => setInvoiceSequencePattern(e.target.value)} placeholder="RCPT-{N}" className="input mt-1" />
                        <p className="text-[10px] text-gray-500 mt-1">{language === 'ar' ? 'استخدم {N} للرقم المتسلسل.' : 'Use {N} for sequential number.'}</p>
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 dark:text-gray-400">{language === 'ar' ? 'لغة واتساب للطلبات' : 'Orders WhatsApp Language'}</label>
                        <select value={khayyatWhatsappLanguage} onChange={(e) => setKhayyatWhatsappLanguage(e.target.value)} className="select mt-1">
                          <option value="both">{language === 'ar' ? 'عربي وإنجليزي' : 'Arabic & English'}</option>
                          <option value="ar">{language === 'ar' ? 'عربي فقط' : 'Arabic Only'}</option>
                          <option value="en">{language === 'ar' ? 'إنجليزي فقط' : 'English Only'}</option>
                        </select>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                      {language === 'ar' ? 'يتم تطبيق هذا القالب عند تحميل PDF من شاشة الفواتير.' : 'This template is used when downloading invoice PDFs.'}
                    </p>
                  </div>
                </div>

                <div className="pt-4">
                  <label className="label flex items-center gap-2"><MessageCircle className="w-4 h-4 text-green-500" />{language === 'ar' ? 'إرسال الفواتير التلقائي عبر واتساب' : 'WhatsApp Invoice Auto-Send'}</label>
                  <div className="card-glass p-4 mt-2 space-y-4">
                    <label className="flex items-center justify-between p-3 rounded-xl border border-gray-200 dark:border-dark-700">
                      <span className="font-medium text-sm">{language === 'ar' ? 'تفعيل الإرسال التلقائي للفواتير' : 'Enable Auto-Send for Invoices'}</span>
                      <input type="checkbox" checked={waAutoInvoiceSend} onChange={(e) => setWaAutoInvoiceSend(e.target.checked)} className="h-4 w-4 rounded" />
                    </label>

                    {waAutoInvoiceSend && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                        <div>
                          <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">{language === 'ar' ? 'رسالة الفاتورة (EN)' : 'Invoice Message (EN)'}</label>
                          <textarea rows={3} value={waInvoiceMsgEn} onChange={(e) => setWaInvoiceMsgEn(e.target.value)} className="input w-full text-sm" placeholder="Variables: {{invoiceNumber}}, {{total}}, {{link}}" />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">{language === 'ar' ? 'رسالة الفاتورة (AR)' : 'Invoice Message (AR)'}</label>
                          <textarea rows={3} value={waInvoiceMsgAr} onChange={(e) => setWaInvoiceMsgAr(e.target.value)} className="input w-full text-sm" dir="rtl" placeholder="Variables: {{invoiceNumber}}, {{total}}, {{link}}" />
                        </div>
                        <div className="md:col-span-2 text-xs text-gray-500 bg-blue-50/50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-100 dark:border-blue-900">
                          {language === 'ar' ? 'المتغيرات المتاحة:' : 'Available Variables:'} {'{{invoiceNumber}}, {{total}}, {{link}}, {{customer_name}}'}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-2">
                  <label className="label flex items-center gap-2"><Palette className="w-4 h-4" />{language === 'ar' ? 'ألوان العلامة' : 'Brand Colors'}</label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                    <div className="card-glass p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{language === 'ar' ? 'اللون الأساسي' : 'Primary'}</span>
                        <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="h-9 w-12 rounded-lg border border-gray-200 dark:border-dark-600 bg-transparent" />
                      </div>
                      <input value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="input mt-3" />
                    </div>
                    <div className="card-glass p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{language === 'ar' ? 'اللون الثانوي' : 'Secondary'}</span>
                        <input type="color" value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} className="h-9 w-12 rounded-lg border border-gray-200 dark:border-dark-600 bg-transparent" />
                      </div>
                      <input value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} className="input mt-3" />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="label flex items-center gap-2"><Palette className="w-4 h-4" />{language === 'ar' ? 'نمط الواجهة' : 'UI Style'}</label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                    <div className="card-glass p-4">
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">{language === 'ar' ? 'الهيدر' : 'Header'}</p>
                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={() => setHeaderStyle('glass')}
                          className={`flex-1 p-3 rounded-xl border-2 transition-all ${headerStyle === 'glass' ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' : 'border-gray-200 dark:border-dark-600'}`}
                        >
                          <span className="font-medium">{language === 'ar' ? 'زجاجي' : 'Glass'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setHeaderStyle('solid')}
                          className={`flex-1 p-3 rounded-xl border-2 transition-all ${headerStyle === 'solid' ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' : 'border-gray-200 dark:border-dark-600'}`}
                        >
                          <span className="font-medium">{language === 'ar' ? 'صلب' : 'Solid'}</span>
                        </button>
                      </div>
                    </div>
                    <div className="card-glass p-4">
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">{language === 'ar' ? 'القائمة الجانبية' : 'Sidebar'}</p>
                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={() => setSidebarStyle('solid')}
                          className={`flex-1 p-3 rounded-xl border-2 transition-all ${sidebarStyle === 'solid' ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' : 'border-gray-200 dark:border-dark-600'}`}
                        >
                          <span className="font-medium">{language === 'ar' ? 'صلب' : 'Solid'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setSidebarStyle('glass')}
                          className={`flex-1 p-3 rounded-xl border-2 transition-all ${sidebarStyle === 'glass' ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' : 'border-gray-200 dark:border-dark-600'}`}
                        >
                          <span className="font-medium">{language === 'ar' ? 'زجاجي' : 'Glass'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    disabled={updateMutation.isPending}
                    onClick={() => updateMutation.mutate({
                      settings: {
                        ...(tenant?.settings || {}),
                        invoicePdfTemplate,
                        invoicePdfPageSize,
                        invoicePdfOrientation,
                        invoiceSequencePattern,
                        khayyat: {
                          ...(tenant?.settings?.khayyat || {}),
                          whatsappLanguage: khayyatWhatsappLanguage,
                        },
                        invoiceWhatsappAutoSend: waAutoInvoiceSend,
                        invoiceWhatsappMessageEn: waInvoiceMsgEn,
                        invoiceWhatsappMessageAr: waInvoiceMsgAr,
                        invoiceCurrencyDisplay,
                        invoiceCurrencyPosition,
                        invoiceBranding: {
                          ...(tenant?.settings?.invoiceBranding || {}),
                          logo: invoiceLogoDataUrl || tenant?.settings?.invoiceBranding?.logo || tenant?.branding?.logo || null,
                          headerTextEn: invoiceHeaderTextEn,
                          headerTextAr: invoiceHeaderTextAr,
                          footerTextEn: invoiceFooterTextEn,
                          footerTextAr: invoiceFooterTextAr,
                          typography: {
                            bodyFontFamily: invoiceBodyFontFamily,
                            headingFontFamily: invoiceHeadingFontFamily,
                            bodyFontSize: Number(invoiceBodyFontSize || 12),
                            headingFontSize: Number(invoiceHeadingFontSize || 18),
                          },
                          showVision2030,
                          vision2030Logo: vision2030LogoDataUrl || tenant?.settings?.invoiceBranding?.vision2030Logo || '/saudi-vision-2030-logo.webp',
                          contextProfiles: invoiceBrandingContexts.reduce((acc, item) => {
                            const profile = invoiceBrandingProfiles?.[item.key] || {}
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
                        }
                      },
                      branding: {
                        ...(tenant?.branding || {}),
                        primaryColor,
                        secondaryColor,
                        headerStyle,
                        sidebarStyle,
                        logo: logoDataUrl || tenant?.branding?.logo
                      }
                    })}
                    className="btn btn-primary"
                  >
                    {updateMutation.isPending ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><Save className="w-4 h-4" />{t('save')}</>}
                  </button>
                </div>
              </div>
            </motion.div>
          )}

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
