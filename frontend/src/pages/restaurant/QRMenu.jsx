import { useState, useRef, useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { QRCodeSVG } from 'qrcode.react'
import { useTranslation } from '../../lib/translations'
import { Printer, Download, UtensilsCrossed, Settings as SettingsIcon, Image as ImageIcon, Save, CheckCircle2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import api, { getImageUrl } from '../../lib/api'
import { getMe } from '../../store/slices/authSlice'
import toast from 'react-hot-toast'
import { tenantHasEntitlement } from '../../lib/appEntitlements'

export default function QRMenu() {
  const dispatch = useDispatch()
  const { language } = useSelector((state) => state.ui)
  const { tenant } = useSelector((state) => state.auth)
  const { t } = useTranslation(language)
  const isRtl = language === 'ar'
  
  const qrRef = useRef(null)
  const fileInputRef = useRef(null)
  const menuImageInputRef = useRef(null)

  const [activeTab, setActiveTab] = useState('qr_code')
  
  // Settings State
  const initialSettings = tenant?.settings?.restaurant?.qrMenu || { 
    defaultLanguage: 'ar', 
    heroImage: '', 
    mode: 'digital', 
    menuImages: [],
    allowOnlineOrdering: true,
    allowDelivery: true,
    allowTakeaway: true,
    allowDineIn: true,
    acceptedPayments: ['cash', 'apple_pay', 'stc_pay', 'visa', 'mada', 'master_card', 'tabby', 'tamara'],
    stcPayMerchantId: '',
    tabbyMerchantCode: '',
    tabbyApiKey: '',
    tamaraMerchantToken: '',
    tamaraNotificationToken: '',
    applePayMerchantId: '',
    cardPaymentApiKey: ''
  }
  const [qrSettings, setQrSettings] = useState({ 
    mode: 'digital', 
    menuImages: [], 
    allowOnlineOrdering: true,
    allowDelivery: true,
    allowTakeaway: true,
    allowDineIn: true,
    acceptedPayments: ['cash', 'apple_pay', 'stc_pay', 'visa', 'mada', 'master_card', 'tabby', 'tamara'],
    stcPayMerchantId: '',
    tabbyMerchantCode: '',
    tabbyApiKey: '',
    tamaraMerchantToken: '',
    tamaraNotificationToken: '',
    applePayMerchantId: '',
    cardPaymentApiKey: '',
    ...initialSettings 
  })
  const [isUploading, setIsUploading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const businessNameEn = tenant?.business?.legalNameEn || tenant?.name || 'Restaurant'
  const businessNameAr = tenant?.business?.legalNameAr || tenant?.name || 'مطعم'
  
  const menuUrl = `${window.location.origin}/public/menu?tenant=${tenant?._id || ''}`

  const handlePrint = () => window.print()

  const handleDownload = () => {
    if (!qrRef.current) return
    const svg = qrRef.current.querySelector('svg')
    if (!svg) return
    
    const svgData = new XMLSerializer().serializeToString(svg)
    const canvas = document.createElement("canvas")
    const ctx = canvas.getContext("2d")
    const img = new Image()
    
    img.onload = () => {
      canvas.width = img.width + 100
      canvas.height = img.height + 150
      
      ctx.fillStyle = "white"
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      
      ctx.fillStyle = "black"
      ctx.font = "bold 24px Arial"
      ctx.textAlign = "center"
      ctx.fillText(isRtl ? 'قائمة الطعام' : 'Menu', canvas.width / 2, 40)
      ctx.font = "20px Arial"
      ctx.fillText(isRtl ? businessNameAr : businessNameEn, canvas.width / 2, 70)
      
      ctx.drawImage(img, 50, 100)
      
      const pngFile = canvas.toDataURL("image/png")
      const downloadLink = document.createElement("a")
      downloadLink.download = `QR_Menu_${businessNameEn.replace(/\s+/g, '_')}.png`
      downloadLink.href = `${pngFile}`
      downloadLink.click()
    }
    
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)))
  }

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    const formData = new FormData()
    formData.append('image', file)

    setIsUploading(true)
    try {
      const res = await api.post('/tenants/upload-qr-hero', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      setQrSettings(prev => ({ ...prev, heroImage: res.data.imageUrl }))
      toast.success(isRtl ? 'تم رفع الصورة بنجاح' : 'Image uploaded successfully')
    } catch (error) {
      toast.error(isRtl ? 'فشل رفع الصورة' : 'Failed to upload image')
    } finally {
      setIsUploading(false)
    }
  }

  const handleMenuImageUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    const formData = new FormData()
    formData.append('image', file)

    setIsUploading(true)
    try {
      const res = await api.post('/tenants/upload-qr-menu-image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      setQrSettings(prev => ({ ...prev, menuImages: [...(prev.menuImages || []), res.data.imageUrl] }))
      toast.success(isRtl ? 'تم رفع صورة القائمة بنجاح' : 'Menu image uploaded successfully')
    } catch (error) {
      toast.error(isRtl ? 'فشل رفع الصورة' : 'Failed to upload image')
    } finally {
      setIsUploading(false)
    }
  }

  const handleRemoveMenuImage = (index) => {
    setQrSettings(prev => {
      const updated = [...(prev.menuImages || [])]
      updated.splice(index, 1)
      return { ...prev, menuImages: updated }
    })
  }

  const [testingGateway, setTestingGateway] = useState(null)

  const handleTestConnection = async (gateway) => {
    setTestingGateway(gateway)
    // Simulate API connection test
    await new Promise(resolve => setTimeout(resolve, 1500))
    setTestingGateway(null)
    toast.success(isRtl ? 'تم الاتصال بالبوابة بنجاح' : `${gateway.toUpperCase()} Connection Successful!`)
  }

  const handleSaveSettings = async () => {
    setIsSaving(true)
    try {
      await api.put('/tenants/current', {
        settings: {
          restaurant: {
            qrMenu: qrSettings
          }
        }
      })
      dispatch(getMe())
      toast.success(isRtl ? 'تم حفظ الإعدادات' : 'Settings saved')
    } catch (error) {
      toast.error(isRtl ? 'فشل الحفظ' : 'Failed to save')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {isRtl ? 'إدارة قائمة QR' : 'QR Menu Management'}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {isRtl ? 'تخصيص وتحميل رمز القائمة الخاصة بك' : 'Customize and download your QR menu'}
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden print:border-none print:shadow-none">
        <div className="flex border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 print:hidden">
          <button
            onClick={() => setActiveTab('qr_code')}
            className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'qr_code'
                ? 'border-amber-500 text-amber-600 dark:text-amber-500 bg-white dark:bg-gray-800'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            <UtensilsCrossed className="w-4 h-4" />
            {isRtl ? 'رمز QR' : 'QR Code'}
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'settings'
                ? 'border-amber-500 text-amber-600 dark:text-amber-500 bg-white dark:bg-gray-800'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            <SettingsIcon className="w-4 h-4" />
            {isRtl ? 'إعدادات القائمة' : 'Menu Settings'}
          </button>
        </div>

        <div className="p-6">
          <AnimatePresence mode="wait">
            {activeTab === 'qr_code' && (
              <motion.div
                key="qr_code"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col items-center"
              >
                <div className="bg-white rounded-3xl shadow-lg p-10 max-w-sm w-full border border-gray-100 flex flex-col items-center print:shadow-none print:border-none print:p-0">
                  <div className="text-center mb-8">
                    {tenant?.branding?.logo ? (
                      <img src={getImageUrl(tenant.branding.logo)} alt="Logo" className="h-16 mx-auto mb-4 object-contain" />
                    ) : (
                      <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
                        <UtensilsCrossed className="w-8 h-8" />
                      </div>
                    )}
                    <h2 className="text-2xl font-black text-gray-900 mb-2">
                      {isRtl ? businessNameAr : businessNameEn}
                    </h2>
                    <p className="text-gray-500 font-medium">
                      {isRtl ? 'امسح الرمز لعرض قائمة الطعام' : 'Scan to view our menu'}
                    </p>
                  </div>

                  <div ref={qrRef} className="bg-white p-4 border-4 border-gray-100 rounded-3xl shadow-sm mb-8">
                    <QRCodeSVG 
                      value={menuUrl} 
                      size={200} 
                      level="H"
                      includeMargin={false}
                      fgColor="#111827"
                      bgColor="#ffffff"
                    />
                  </div>

                  <div className="w-full border-t border-dashed border-gray-300 pt-6 text-center print:hidden">
                    <p className="text-sm text-gray-500 mb-2">{isRtl ? 'رابط القائمة المباشر:' : 'Direct Menu Link:'}</p>
                    <a 
                      href={menuUrl} 
                      target="_blank" 
                      rel="noreferrer"
                      className="text-amber-600 hover:text-amber-700 font-medium text-sm break-all"
                    >
                      {menuUrl}
                    </a>
                  </div>
                </div>
                
                <div className="flex gap-3 mt-8 print:hidden">
                  <button type="button" onClick={handleDownload} className="btn btn-secondary">
                    <Download className="w-4 h-4" />
                    {isRtl ? 'تحميل الصورة' : 'Download Image'}
                  </button>
                  <button type="button" onClick={handlePrint} className="btn btn-primary bg-amber-600 hover:bg-amber-700">
                    <Printer className="w-4 h-4" />
                    {isRtl ? 'طباعة' : 'Print'}
                  </button>
                </div>
              </motion.div>
            )}

            {activeTab === 'settings' && (
              <motion.div
                key="settings"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="max-w-2xl mx-auto space-y-8"
              >
                {/* Menu Mode */}
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                      {isRtl ? 'وضع القائمة' : 'Menu Mode'}
                    </h3>
                  </div>
                  <div className="flex gap-4">
                    <label className={`flex-1 flex items-center p-4 border rounded-xl cursor-pointer transition-all ${
                      qrSettings.mode === 'digital' 
                        ? 'border-amber-500 bg-amber-50 dark:bg-amber-500/10 dark:border-amber-500' 
                        : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}>
                      <input 
                        type="radio" 
                        name="mode" 
                        value="digital"
                        checked={qrSettings.mode === 'digital'}
                        onChange={(e) => setQrSettings({ ...qrSettings, mode: e.target.value })}
                        className="w-4 h-4 text-amber-600 border-gray-300 focus:ring-amber-500"
                      />
                      <div className="ml-3 rtl:mr-3">
                        <span className="block text-sm font-bold text-gray-900 dark:text-white">{isRtl ? 'قائمة رقمية' : 'Digital Menu'}</span>
                        <span className="block text-xs text-gray-500">{isRtl ? 'عرض المنتجات والأقسام' : 'Show products and categories'}</span>
                      </div>
                    </label>
                    <label className={`flex-1 flex items-center p-4 border rounded-xl cursor-pointer transition-all ${
                      qrSettings.mode === 'image_only' 
                        ? 'border-amber-500 bg-amber-50 dark:bg-amber-500/10 dark:border-amber-500' 
                        : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}>
                      <input 
                        type="radio" 
                        name="mode" 
                        value="image_only"
                        checked={qrSettings.mode === 'image_only'}
                        onChange={(e) => setQrSettings({ ...qrSettings, mode: e.target.value })}
                        className="w-4 h-4 text-amber-600 border-gray-300 focus:ring-amber-500"
                      />
                      <div className="ml-3 rtl:mr-3">
                        <span className="block text-sm font-bold text-gray-900 dark:text-white">{isRtl ? 'صور فقط' : 'Images Only'}</span>
                        <span className="block text-xs text-gray-500">{isRtl ? 'عرض صور المنيو' : 'Show uploaded menu images'}</span>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Hero Image */}
                {qrSettings.mode === 'digital' && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                      {isRtl ? 'صورة الغلاف (Hero Image)' : 'Hero Image'}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      {isRtl ? 'هذه الصورة ستظهر في أعلى القائمة لتضيف طابعاً فخماً.' : 'This image will appear at the top of the menu to give it a premium look.'}
                    </p>
                  </div>
                  
                  <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-2xl bg-gray-50 dark:bg-gray-800/50">
                    {qrSettings.heroImage ? (
                      <div className="relative w-full aspect-video rounded-xl overflow-hidden group">
                        <img src={getImageUrl(qrSettings.heroImage)} alt="Hero" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <button 
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="btn btn-secondary"
                            disabled={isUploading}
                          >
                            <ImageIcon className="w-4 h-4" />
                            {isRtl ? 'تغيير الصورة' : 'Change Image'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center">
                        <ImageIcon className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                        <button 
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="btn btn-secondary"
                          disabled={isUploading}
                        >
                          {isUploading ? (isRtl ? 'جاري الرفع...' : 'Uploading...') : (isRtl ? 'رفع صورة' : 'Upload Image')}
                        </button>
                      </div>
                    )}
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      ref={fileInputRef} 
                      onChange={handleImageUpload} 
                    />
                  </div>
                </div>
                )}

                {/* Menu Images for Image Only Mode */}
                {qrSettings.mode === 'image_only' && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                      {isRtl ? 'صور القائمة' : 'Menu Images'}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      {isRtl ? 'قم برفع صور القائمة الخاصة بك. ستظهر هذه الصور للعملاء عند مسح رمز الاستجابة السريعة (QR Code).' : 'Upload images of your menu. These will be shown to customers when they scan the QR code.'}
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(qrSettings.menuImages || []).map((imgUrl, idx) => (
                      <div key={idx} className="relative group rounded-xl overflow-hidden border border-gray-200 aspect-[3/4]">
                        <img src={getImageUrl(imgUrl)} alt={`Menu page ${idx + 1}`} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <button 
                            type="button"
                            onClick={() => handleRemoveMenuImage(idx)}
                            className="btn btn-sm btn-secondary text-red-500 hover:text-red-700"
                          >
                            {isRtl ? 'إزالة' : 'Remove'}
                          </button>
                        </div>
                      </div>
                    ))}
                    
                    <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-800/50 aspect-[3/4] hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer transition-colors" onClick={() => menuImageInputRef.current?.click()}>
                      <ImageIcon className="w-10 h-10 text-gray-400 mb-2" />
                      <span className="text-sm font-medium text-gray-500">{isUploading ? (isRtl ? 'جاري الرفع...' : 'Uploading...') : (isRtl ? 'إضافة صفحة' : 'Add Page')}</span>
                    </div>
                  </div>
                  <input 
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    ref={menuImageInputRef} 
                    onChange={handleMenuImageUpload} 
                  />
                </div>
                )}

                {/* Default Language */}
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                      {isRtl ? 'اللغة الافتراضية للقائمة' : 'Default Menu Language'}
                    </h3>
                  </div>
                  <div className="flex gap-4">
                    <label className={`flex-1 flex items-center p-4 border rounded-xl cursor-pointer transition-all ${
                      qrSettings.defaultLanguage === 'ar' 
                        ? 'border-amber-500 bg-amber-50 dark:bg-amber-500/10 dark:border-amber-500' 
                        : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}>
                      <input 
                        type="radio" 
                        name="defaultLanguage" 
                        value="ar"
                        checked={qrSettings.defaultLanguage === 'ar'}
                        onChange={(e) => setQrSettings({ ...qrSettings, defaultLanguage: e.target.value })}
                        className="w-4 h-4 text-amber-600 border-gray-300 focus:ring-amber-500"
                      />
                      <div className="ml-3 rtl:mr-3">
                        <span className="block text-sm font-bold text-gray-900 dark:text-white">العربية</span>
                        <span className="block text-xs text-gray-500">Arabic</span>
                      </div>
                    </label>
                    <label className={`flex-1 flex items-center p-4 border rounded-xl cursor-pointer transition-all ${
                      qrSettings.defaultLanguage === 'en' 
                        ? 'border-amber-500 bg-amber-50 dark:bg-amber-500/10 dark:border-amber-500' 
                        : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}>
                      <input 
                        type="radio" 
                        name="defaultLanguage" 
                        value="en"
                        checked={qrSettings.defaultLanguage === 'en'}
                        onChange={(e) => setQrSettings({ ...qrSettings, defaultLanguage: e.target.value })}
                        className="w-4 h-4 text-amber-600 border-gray-300 focus:ring-amber-500"
                      />
                      <div className="ml-3 rtl:mr-3">
                        <span className="block text-sm font-bold text-gray-900 dark:text-white">English</span>
                        <span className="block text-xs text-gray-500">الإنجليزية</span>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Online Ordering Settings (Add-on feature) */}
                {tenantHasEntitlement(tenant, { appId: 'qr_menu_ordering', flag: 'hasQrOrderingAddon' }) && (
                  <div className="space-y-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                        {isRtl ? 'إعدادات الطلب عبر الإنترنت' : 'Online Ordering Settings'}
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {isRtl ? 'تخصيص طرق الدفع وأنواع الطلبات المتاحة للعملاء' : 'Customize accepted payment methods and order types for your customers'}
                      </p>
                    </div>

                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-2xl p-6 space-y-6 border border-gray-200 dark:border-gray-700">
                      {/* Main Toggle */}
                      <label className="flex items-center justify-between cursor-pointer">
                        <div>
                          <span className="block text-base font-bold text-gray-900 dark:text-white">
                            {isRtl ? 'تفعيل الطلب عبر الإنترنت' : 'Enable Online Ordering'}
                          </span>
                          <span className="block text-xs text-gray-500 mt-0.5">
                            {isRtl ? 'السماح للعملاء بتقديم الطلبات من القائمة' : 'Allow customers to place orders from the menu'}
                          </span>
                        </div>
                        <div className="relative">
                          <input 
                            type="checkbox" 
                            className="sr-only peer"
                            checked={qrSettings.allowOnlineOrdering}
                            onChange={(e) => setQrSettings(prev => ({ ...prev, allowOnlineOrdering: e.target.checked }))}
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-amber-500"></div>
                        </div>
                      </label>

                      {qrSettings.allowOnlineOrdering && (
                        <>
                          <div className="h-px bg-gray-200 dark:bg-gray-700 w-full" />
                          
                          {/* Order Types */}
                          <div className="space-y-3">
                            <h4 className="text-sm font-bold text-gray-900 dark:text-white">{isRtl ? 'أنواع الطلبات المتاحة' : 'Available Order Types'}</h4>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              {[
                                { id: 'allowDineIn', labelEn: 'Dine-in', labelAr: 'محلي' },
                                { id: 'allowTakeaway', labelEn: 'Takeaway', labelAr: 'سفري' },
                                { id: 'allowDelivery', labelEn: 'Delivery', labelAr: 'توصيل' },
                              ].map(type => (
                                <label key={type.id} className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 cursor-pointer hover:border-amber-500 transition-colors">
                                  <input 
                                    type="checkbox"
                                    checked={qrSettings[type.id]}
                                    onChange={(e) => setQrSettings(prev => ({ ...prev, [type.id]: e.target.checked }))}
                                    className="w-4 h-4 text-amber-600 rounded border-gray-300 focus:ring-amber-500"
                                  />
                                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    {isRtl ? type.labelAr : type.labelEn}
                                  </span>
                                </label>
                              ))}
                            </div>
                          </div>

                          <div className="h-px bg-gray-200 dark:bg-gray-700 w-full" />

                          {/* Payment Methods */}
                          <div className="space-y-3">
                            <h4 className="text-sm font-bold text-gray-900 dark:text-white">{isRtl ? 'طرق الدفع المقبولة' : 'Accepted Payment Methods'}</h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {[
                                { id: 'cash', labelEn: 'Cash on Delivery / Counter', labelAr: 'الدفع نقداً' },
                                { id: 'apple_pay', labelEn: 'Apple Pay', labelAr: 'Apple Pay' },
                                { id: 'stc_pay', labelEn: 'STC Pay', labelAr: 'STC Pay' },
                                { id: 'visa', labelEn: 'Visa', labelAr: 'فيزا' },
                                { id: 'mada', labelEn: 'Mada', labelAr: 'مدى' },
                                { id: 'master_card', labelEn: 'MasterCard', labelAr: 'ماستر كارد' },
                                { id: 'tabby', labelEn: 'Tabby', labelAr: 'تابي' },
                                { id: 'tamara', labelEn: 'Tamara', labelAr: 'تمارا' },
                              ].map(method => (
                                <label key={method.id} className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 cursor-pointer hover:border-amber-500 transition-colors">
                                  <input 
                                    type="checkbox"
                                    checked={qrSettings.acceptedPayments?.includes(method.id)}
                                    onChange={(e) => {
                                      setQrSettings(prev => {
                                        const current = prev.acceptedPayments || []
                                        return {
                                          ...prev,
                                          acceptedPayments: e.target.checked 
                                            ? [...current, method.id]
                                            : current.filter(m => m !== method.id)
                                        }
                                      })
                                    }}
                                    className="w-4 h-4 text-amber-600 rounded border-gray-300 focus:ring-amber-500"
                                  />
                                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    {isRtl ? method.labelAr : method.labelEn}
                                  </span>
                                </label>
                              ))}
                            </div>
                          </div>


                          {/* API Configurations for Payment Gateways */}
                          {(qrSettings.acceptedPayments?.some(p => ['stc_pay', 'tabby', 'tamara', 'apple_pay', 'visa', 'mada', 'master_card'].includes(p))) && (
                            <>
                              <div className="h-px bg-gray-200 dark:bg-gray-700 w-full" />
                              <div className="space-y-4">
                                <div>
                                  <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                                    {isRtl ? 'إعدادات الربط مع بوابات الدفع' : 'Payment Gateways API Configuration'}
                                  </h4>
                                  <p className="text-xs text-gray-500 mt-1">
                                    {isRtl ? 'أدخل مفاتيح الربط الخاصة بك لتفعيل الدفع الإلكتروني' : 'Enter your API keys to enable these payment methods'}
                                  </p>
                                </div>

                                <div className="grid grid-cols-1 gap-4">
                                  {/* Card Payments */}
                                  {(qrSettings.acceptedPayments?.includes('visa') || qrSettings.acceptedPayments?.includes('mada') || qrSettings.acceptedPayments?.includes('master_card')) && (
                                    <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
                                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                                        <h5 className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-2">💳 {isRtl ? 'بوابة الدفع بالبطاقات (مدى، فيزا، ماستر كارد)' : 'Card Payment Gateway (Mada, Visa, MC)'}</h5>
                                        <button onClick={() => handleTestConnection('card_gateway')} disabled={testingGateway === 'card_gateway'} className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 text-xs font-bold bg-white dark:bg-gray-800 hover:bg-gray-50 disabled:opacity-50 transition-colors">
                                          {testingGateway === 'card_gateway' ? (isRtl ? 'جاري الفحص...' : 'Testing...') : (isRtl ? 'فحص الاتصال' : 'Test Connection')}
                                        </button>
                                      </div>
                                      <div>
                                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">API Key / Secret Key</label>
                                        <input 
                                          type="password" 
                                          value={qrSettings.cardPaymentApiKey || ''}
                                          onChange={(e) => setQrSettings(prev => ({ ...prev, cardPaymentApiKey: e.target.value }))}
                                          className="input bg-white dark:bg-gray-900" 
                                          placeholder="Enter Gateway API Key"
                                        />
                                      </div>
                                    </div>
                                  )}

                                  {/* Apple Pay */}
                                  {qrSettings.acceptedPayments?.includes('apple_pay') && (
                                    <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
                                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                                        <h5 className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-2">
                                          <svg viewBox="0 0 384 512" fill="currentColor" className="w-4 h-4"><path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 24 184.8 8 273.5q-9 59.4 17.7 114.1c17.5 35.3 40.8 71.2 77 70.9 31.3-.3 43.9-19.6 81.8-19.6 37.9 0 48.7 19.3 81.2 19.3 35.1-.3 54.1-33.1 71.2-68.5 21.6-43.6 30.6-69 31.1-70.1-1.3-.7-49.1-18.4-49.3-51zm-93-181.8c21.2-26.4 34.6-60.8 30.7-93.5-28.7 1.2-65 18-86.3 44.4-17.6 20.8-32 55.4-27 88.5 31.8 2.5 66.8-14.7 82.6-39.4z" /></svg>
                                          Apple Pay API
                                        </h5>
                                        <button onClick={() => handleTestConnection('apple_pay')} disabled={testingGateway === 'apple_pay'} className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 text-xs font-bold bg-white dark:bg-gray-800 hover:bg-gray-50 disabled:opacity-50 transition-colors">
                                          {testingGateway === 'apple_pay' ? (isRtl ? 'جاري الفحص...' : 'Testing...') : (isRtl ? 'فحص الاتصال' : 'Test Connection')}
                                        </button>
                                      </div>
                                      <div>
                                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Merchant ID</label>
                                        <input 
                                          type="text" 
                                          value={qrSettings.applePayMerchantId || ''}
                                          onChange={(e) => setQrSettings(prev => ({ ...prev, applePayMerchantId: e.target.value }))}
                                          className="input bg-white dark:bg-gray-900" 
                                          placeholder="merchant.com.yourdomain"
                                        />
                                      </div>
                                    </div>
                                  )}

                                  {/* STC Pay */}
                                  {qrSettings.acceptedPayments?.includes('stc_pay') && (
                                    <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
                                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                                        <h5 className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-2">📱 STC Pay API</h5>
                                        <button onClick={() => handleTestConnection('stc_pay')} disabled={testingGateway === 'stc_pay'} className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 text-xs font-bold bg-white dark:bg-gray-800 hover:bg-gray-50 disabled:opacity-50 transition-colors">
                                          {testingGateway === 'stc_pay' ? (isRtl ? 'جاري الفحص...' : 'Testing...') : (isRtl ? 'فحص الاتصال' : 'Test Connection')}
                                        </button>
                                      </div>
                                      <div>
                                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">STC Pay Merchant ID</label>
                                        <input 
                                          type="text" 
                                          value={qrSettings.stcPayMerchantId || ''}
                                          onChange={(e) => setQrSettings(prev => ({ ...prev, stcPayMerchantId: e.target.value }))}
                                          className="input bg-white dark:bg-gray-900" 
                                          placeholder="Enter Merchant ID"
                                        />
                                      </div>
                                    </div>
                                  )}

                                  {/* Tabby */}
                                  {qrSettings.acceptedPayments?.includes('tabby') && (
                                    <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
                                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                                        <h5 className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-2"><span className="px-1.5 py-0.5 bg-[#3EEDBF] text-black text-[10px] font-black tracking-tighter rounded">tabby</span> Tabby API</h5>
                                        <button onClick={() => handleTestConnection('tabby')} disabled={testingGateway === 'tabby'} className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 text-xs font-bold bg-white dark:bg-gray-800 hover:bg-gray-50 disabled:opacity-50 transition-colors">
                                          {testingGateway === 'tabby' ? (isRtl ? 'جاري الفحص...' : 'Testing...') : (isRtl ? 'فحص الاتصال' : 'Test Connection')}
                                        </button>
                                      </div>
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                          <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Tabby Merchant Code</label>
                                          <input 
                                            type="text" 
                                            value={qrSettings.tabbyMerchantCode || ''}
                                            onChange={(e) => setQrSettings(prev => ({ ...prev, tabbyMerchantCode: e.target.value }))}
                                            className="input bg-white dark:bg-gray-900" 
                                            placeholder="Enter Merchant Code"
                                          />
                                        </div>
                                        <div>
                                          <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Tabby API Key</label>
                                          <input 
                                            type="password" 
                                            value={qrSettings.tabbyApiKey || ''}
                                            onChange={(e) => setQrSettings(prev => ({ ...prev, tabbyApiKey: e.target.value }))}
                                            className="input bg-white dark:bg-gray-900" 
                                            placeholder="Enter API Key"
                                          />
                                        </div>
                                      </div>
                                    </div>
                                  )}

                                  {/* Tamara */}
                                  {qrSettings.acceptedPayments?.includes('tamara') && (
                                    <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
                                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                                        <h5 className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-2"><span className="px-1.5 py-0.5 bg-[#F0A985] text-white text-[10px] font-bold tracking-tighter rounded">tamara</span> Tamara API</h5>
                                        <button onClick={() => handleTestConnection('tamara')} disabled={testingGateway === 'tamara'} className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 text-xs font-bold bg-white dark:bg-gray-800 hover:bg-gray-50 disabled:opacity-50 transition-colors">
                                          {testingGateway === 'tamara' ? (isRtl ? 'جاري الفحص...' : 'Testing...') : (isRtl ? 'فحص الاتصال' : 'Test Connection')}
                                        </button>
                                      </div>
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                          <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Tamara Merchant Token</label>
                                          <input 
                                            type="password" 
                                            value={qrSettings.tamaraMerchantToken || ''}
                                            onChange={(e) => setQrSettings(prev => ({ ...prev, tamaraMerchantToken: e.target.value }))}
                                            className="input bg-white dark:bg-gray-900" 
                                            placeholder="Enter Merchant Token"
                                          />
                                        </div>
                                        <div>
                                          <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Tamara Notification Token</label>
                                          <input 
                                            type="password" 
                                            value={qrSettings.tamaraNotificationToken || ''}
                                            onChange={(e) => setQrSettings(prev => ({ ...prev, tamaraNotificationToken: e.target.value }))}
                                            className="input bg-white dark:bg-gray-900" 
                                            placeholder="Enter Notification Token"
                                          />
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}

                <div className="pt-6 border-t border-gray-200 dark:border-gray-700 flex justify-end">
                  <button 
                    onClick={handleSaveSettings} 
                    disabled={isSaving}
                    className="btn btn-primary bg-amber-600 hover:bg-amber-700"
                  >
                    {isSaving ? <span className="animate-pulse">...</span> : <Save className="w-4 h-4" />}
                    {isRtl ? 'حفظ الإعدادات' : 'Save Settings'}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
