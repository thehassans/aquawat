import { useState, useRef, useEffect } from 'react'
import { useSelector } from 'react-redux'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { QRCodeSVG } from 'qrcode.react'
import {
  QrCode, Printer, Download, Copy, Check, ExternalLink,
  Sparkles, UtensilsCrossed, Wifi, Share2, Building,
  Image as ImageIcon, Upload, Settings as SettingsIcon, Save,
  CheckCircle2, Loader2, Phone, MessageSquare
} from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import { useTranslation } from '../../lib/translations'
import { showArabicFields, isPakistanTenant } from '../../lib/saudiTenant'

export default function MarqueeQRMenu() {
  const queryClient = useQueryClient()
  const { language } = useSelector((s) => s.ui)
  const { tenant } = useSelector((s) => s.auth)
  const { t } = useTranslation(language)
  
  const showArabic = showArabicFields(tenant)
  const isAr = showArabic && language === 'ar'
  const isPk = isPakistanTenant(tenant)

  const [activeTab, setActiveTab] = useState('qr_code')
  const [copied, setCopied] = useState(false)
  const [tableNumber, setTableNumber] = useState('VIP Banquet Table 01')
  const [wifiName, setWifiName] = useState('Marquee_Guest_WiFi')
  const [wifiPass, setWifiPass] = useState('Guest2026')
  
  // Customization Settings State
  const [heroImage, setHeroImage] = useState('')
  const [welcomeTitle, setWelcomeTitle] = useState('')
  const [welcomeSubtitle, setWelcomeSubtitle] = useState('')
  const [whatsappNumber, setWhatsappNumber] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [showPricing, setShowPricing] = useState(true)
  const [isUploadingHero, setIsUploadingHero] = useState(false)

  const qrRef = useRef(null)
  const heroInputRef = useRef(null)

  const tenantSlug = tenant?.slug || 'hall'
  const publicUrl = `${window.location.origin}/public/marquee/${tenantSlug}?table=${encodeURIComponent(tableNumber)}`

  // Fetch saved settings
  const { data: savedSettings, isLoading: isLoadingSettings } = useQuery({
    queryKey: ['marquee-qr-settings'],
    queryFn: () => api.get('/marquee/qr-settings').then((r) => r.data),
  })

  useEffect(() => {
    if (savedSettings) {
      if (savedSettings.heroImage) setHeroImage(savedSettings.heroImage)
      if (savedSettings.welcomeTitle) setWelcomeTitle(savedSettings.welcomeTitle)
      if (savedSettings.welcomeSubtitle) setWelcomeSubtitle(savedSettings.welcomeSubtitle)
      if (savedSettings.whatsappNumber) setWhatsappNumber(savedSettings.whatsappNumber)
      if (savedSettings.contactPhone) setContactPhone(savedSettings.contactPhone)
      if (typeof savedSettings.showPricing === 'boolean') setShowPricing(savedSettings.showPricing)
      if (savedSettings.wifiName) setWifiName(savedSettings.wifiName)
      if (savedSettings.wifiPass) setWifiPass(savedSettings.wifiPass)
    }
  }, [savedSettings])

  const saveSettingsMutation = useMutation({
    mutationFn: (payload) => api.put('/marquee/qr-settings', payload),
    onSuccess: () => {
      queryClient.invalidateQueries(['marquee-qr-settings'])
      toast.success(isAr ? 'تم حفظ إعدادات القائمة الرقمية بنجاح' : 'Marquee QR Menu settings saved!')
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || 'Failed to save settings')
    },
  })

  const handleCopy = () => {
    navigator.clipboard.writeText(publicUrl)
    setCopied(true)
    toast.success(isAr ? 'تم نسخ الرابط بنجاح' : 'Public QR Menu URL copied!')
    setTimeout(() => setCopied(false), 2000)
  }

  const handlePrint = () => {
    window.print()
  }

  const handleDownload = () => {
    const svg = qrRef.current?.querySelector('svg')
    if (!svg) return

    const svgData = new XMLSerializer().serializeToString(svg)
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const img = new Image()

    img.onload = () => {
      canvas.width = 600
      canvas.height = 600
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, 600, 600)
      ctx.drawImage(img, 50, 50, 500, 500)
      const pngFile = canvas.toDataURL('image/png')

      const downloadLink = document.createElement('a')
      downloadLink.download = `Marquee-QR-${tableNumber.replace(/\s+/g, '-')}.png`
      downloadLink.href = pngFile
      downloadLink.click()
      toast.success(isAr ? 'تم تحميل رمز الاستجابة السريعة' : 'QR code downloaded')
    }

    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)))
  }

  const handleHeroUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    const formData = new FormData()
    formData.append('image', file)

    setIsUploadingHero(true)
    try {
      const res = await api.post('/marquee/upload-hero', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setHeroImage(res.data.imageUrl)
      toast.success(isAr ? 'تم رفع صورة الغلاف بنجاح' : 'Cover banner photo uploaded!')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to upload photo')
    } finally {
      setIsUploadingHero(false)
    }
  }

  const handleSaveSettings = () => {
    saveSettingsMutation.mutate({
      heroImage,
      welcomeTitle: welcomeTitle.trim() || undefined,
      welcomeSubtitle: welcomeSubtitle.trim() || undefined,
      whatsappNumber: whatsappNumber.trim() || undefined,
      contactPhone: contactPhone.trim() || undefined,
      showPricing,
      wifiName: wifiName.trim() || undefined,
      wifiPass: wifiPass.trim() || undefined,
    })
  }

  return (
    <div className="space-y-6 pb-16 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white sm:text-3xl">
              {isAr ? 'قائمة طعام الطاولات الرقمية والكتالوج (QR Code)' : 'Table QR Menu & Digital Catalog'}
            </h1>
            <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
              {isAr ? 'تفاعلي للضيوف' : 'Guest Interactive'}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {isAr
              ? 'توليد رموز QR لطاولات القاعة والمدخل لتمكين الضيوف من استعراض باقات المناسبات، قائمة الأطعمة، وكلمة سر الواي فاي.'
              : 'Generate table QR cards for banquet guests and customize your public event packages showcase.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <a
            href={publicUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-white/10 dark:bg-dark-800 dark:text-slate-200 transition"
          >
            <ExternalLink className="h-4 w-4 text-emerald-600" />
            <span>{isAr ? 'معاينة القائمة المباشرة' : 'Live Preview'}</span>
          </a>

          <button
            type="button"
            onClick={handleDownload}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-white/10 dark:bg-dark-800 dark:text-slate-200 transition"
          >
            <Download className="h-4 w-4" />
            <span>{isAr ? 'تحميل PNG' : 'Download PNG'}</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-5 py-2.5 text-xs font-bold text-white shadow-md hover:bg-slate-800 dark:bg-white dark:text-slate-950 transition"
          >
            <Printer className="h-4 w-4 stroke-[2.5]" />
            <span>{isAr ? 'طباعة بطاقة الطاولة' : 'Print Table Card'}</span>
          </button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-slate-200 dark:border-white/10">
        <button
          type="button"
          onClick={() => setActiveTab('qr_code')}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-xs font-black transition ${
            activeTab === 'qr_code'
              ? 'border-emerald-600 text-emerald-600 dark:border-emerald-400 dark:text-emerald-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'
          }`}
        >
          <QrCode className="w-4 h-4" />
          <span>{isAr ? 'بطاقات الطاولات ورمز QR' : 'Table QR Tent & Cards'}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('customization')}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-xs font-black transition ${
            activeTab === 'customization'
              ? 'border-emerald-600 text-emerald-600 dark:border-emerald-400 dark:text-emerald-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'
          }`}
        >
          <ImageIcon className="w-4 h-4" />
          <span>{isAr ? 'تخصيص الكتالوج وصور القاعة' : 'Public Catalog & Banner Image'}</span>
        </button>
      </div>

      {/* ─── TAB 1: QR CODE & TABLE CARDS ─── */}
      {activeTab === 'qr_code' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left Side: Table & QR Settings */}
          <div className="lg:col-span-5 space-y-5">
            <div className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-xs dark:border-white/10 dark:bg-[#0c111a] space-y-4">
              <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {isAr ? 'تخصيص بطاقة الطاولة' : 'Table Tent Customization'}
              </h3>

              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">
                  {isAr ? 'رقم / اسم الطاولة أو المدخل' : 'Table / Area Label'}
                </label>
                <input
                  type="text"
                  value={tableNumber}
                  onChange={(e) => setTableNumber(e.target.value)}
                  placeholder="VIP Table 01 / Main Entrance"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs font-semibold text-slate-900 focus:border-emerald-500 focus:bg-white focus:outline-none dark:border-white/10 dark:bg-dark-800 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                    {isAr ? 'شبكة الواي فاي' : 'Guest WiFi SSID'}
                  </label>
                  <input
                    type="text"
                    value={wifiName}
                    onChange={(e) => setWifiName(e.target.value)}
                    placeholder="Marquee_WiFi"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs font-medium text-slate-900 focus:border-emerald-500 focus:bg-white focus:outline-none dark:border-white/10 dark:bg-dark-800 dark:text-white"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                    {isAr ? 'كلمة سر الواي فاي' : 'WiFi Password'}
                  </label>
                  <input
                    type="text"
                    value={wifiPass}
                    onChange={(e) => setWifiPass(e.target.value)}
                    placeholder="Password123"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs font-medium text-slate-900 focus:border-emerald-500 focus:bg-white focus:outline-none dark:border-white/10 dark:bg-dark-800 dark:text-white"
                  />
                </div>
              </div>

              {/* Live Link Box */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3.5 dark:border-white/5 dark:bg-dark-800/60 space-y-2">
                <span className="text-[11px] font-bold text-slate-500">
                  {isAr ? 'رابط القائمة الرقمية المباشر:' : 'Direct Live URL:'}
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={publicUrl}
                    className="flex-1 truncate rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 dark:border-white/10 dark:bg-dark-900 dark:text-slate-300 font-mono"
                  />
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="rounded-xl border border-slate-200 bg-white p-2 text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:bg-dark-800 dark:text-slate-300"
                  >
                    {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                  </button>
                  <a
                    href={publicUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-xl border border-slate-200 bg-white p-2 text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:bg-dark-800 dark:text-slate-300"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Right Side: Visual Printable Table Stand Mockup */}
          <div className="lg:col-span-7 flex justify-center">
            <div className="w-full max-w-sm rounded-[2.5rem] border-4 border-slate-900/10 bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 p-6 text-white shadow-2xl dark:border-white/10">
              {/* Top Emblem */}
              <div className="text-center space-y-1">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-400/10 text-amber-400 border border-amber-400/20 shadow-lg">
                  <Sparkles className="h-6 w-6" />
                </div>
                <h2 className="text-base font-black tracking-tight">
                  {tenant?.name || 'Grand Palace Marquee'}
                </h2>
                <p className="text-[11px] font-semibold text-amber-400/90 uppercase tracking-widest">
                  {isAr ? 'أهلاً بكم في مناسبتنا الكريمة' : 'Welcome to the Celebration'}
                </p>
              </div>

              {/* QR Card Frame */}
              <div className="mt-5 rounded-3xl bg-white p-6 text-center text-slate-900 shadow-xl" ref={qrRef}>
                <span className="inline-block rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-800 uppercase tracking-wider mb-4">
                  {tableNumber}
                </span>

                <div className="flex justify-center my-2">
                  <QRCodeSVG
                    value={publicUrl}
                    size={190}
                    level="H"
                    includeMargin={true}
                  />
                </div>

                <p className="mt-3 text-xs font-bold text-slate-800">
                  {isAr ? 'امسح الرمز بالجوال لاستعراض قائمة الطعام وباقات الحفل' : 'Scan with your camera to view Banquet Packages'}
                </p>
                <p className="text-[10px] text-slate-400">
                  {isAr ? 'قائمة البوفيه • جدول الحفل • التواصل' : 'Buffet Selections & Event Details'}
                </p>
              </div>

              {/* WiFi Credentials on Table */}
              {wifiName && (
                <div className="mt-5 flex items-center justify-between rounded-2xl bg-white/10 px-4 py-2.5 text-xs">
                  <div className="flex items-center gap-2">
                    <Wifi className="h-4 w-4 text-emerald-400" />
                    <span className="font-semibold text-slate-300">{wifiName}</span>
                  </div>
                  <span className="font-mono text-[11px] font-bold text-amber-300">{wifiPass}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 2: PUBLIC CATALOG & HERO IMAGE UPLOAD ─── */}
      {activeTab === 'customization' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Customization Form */}
          <div className="lg:col-span-6 space-y-5">
            <div className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-xs dark:border-white/10 dark:bg-[#0c111a] space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  {isAr ? 'صورة الغلاف والبانر الترحيبي' : 'Marquee Hero Banner / Cover Photo'}
                </h3>
                {heroImage && (
                  <button
                    type="button"
                    onClick={() => setHeroImage('')}
                    className="text-[11px] font-bold text-rose-600 hover:underline"
                  >
                    {isAr ? 'إزالة الصورة' : 'Remove Photo'}
                  </button>
                )}
              </div>

              <input
                ref={heroInputRef}
                type="file"
                accept="image/*"
                onChange={handleHeroUpload}
                className="hidden"
              />

              {heroImage ? (
                <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 dark:border-white/10">
                  <img src={heroImage} alt="Marquee Cover" className="h-48 w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => heroInputRef.current?.click()}
                    disabled={isUploadingHero}
                    className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-xl bg-slate-950/80 px-3 py-1.5 text-xs font-bold text-white backdrop-blur shadow hover:bg-slate-950"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{isAr ? 'تغيير الصورة' : 'Change Photo'}</span>
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => heroInputRef.current?.click()}
                  className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 p-8 text-center cursor-pointer hover:border-emerald-500 hover:bg-emerald-50/20 transition dark:border-white/10 dark:hover:border-emerald-500/50"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10">
                    {isUploadingHero ? <Loader2 className="w-6 h-6 animate-spin" /> : <ImageIcon className="w-6 h-6" />}
                  </div>
                  <p className="mt-3 text-xs font-bold text-slate-800 dark:text-white">
                    {isUploadingHero ? (isAr ? 'جاري الرفع...' : 'Uploading banner...') : (isAr ? 'اضغط لرفع صورة واجهة القاعة' : 'Click to Upload Banquet Hall Cover Photo')}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">High-resolution banner (16:9 ratio recommended)</p>
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">
                  {isAr ? 'عنوان الترحيب المخصص' : 'Custom Welcome Headline'}
                </label>
                <input
                  type="text"
                  value={welcomeTitle}
                  onChange={(e) => setWelcomeTitle(e.target.value)}
                  placeholder="Welcome to Grand Royal Banquets"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs font-medium text-slate-900 focus:border-emerald-500 focus:bg-white focus:outline-none dark:border-white/10 dark:bg-dark-800 dark:text-white"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">
                  {isAr ? 'نص الترحيب والضيافة' : 'Welcome Subtitle / Hospitality Note'}
                </label>
                <textarea
                  rows={2}
                  value={welcomeSubtitle}
                  onChange={(e) => setWelcomeSubtitle(e.target.value)}
                  placeholder="Honored guests, please explore our bespoke banquet packages and buffet selections."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-xs font-medium text-slate-900 focus:border-emerald-500 focus:bg-white focus:outline-none dark:border-white/10 dark:bg-dark-800 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                    {isAr ? 'رقم الواتساب للحجز' : 'WhatsApp for Bookings'}
                  </label>
                  <input
                    type="text"
                    value={whatsappNumber}
                    onChange={(e) => setWhatsappNumber(e.target.value)}
                    placeholder="+92 300 1234567"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs font-medium text-slate-900 focus:border-emerald-500 focus:bg-white focus:outline-none dark:border-white/10 dark:bg-dark-800 dark:text-white"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                    {isAr ? 'هاتف الاستقبال' : 'Reception Phone'}
                  </label>
                  <input
                    type="text"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    placeholder="051 1234567"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs font-medium text-slate-900 focus:border-emerald-500 focus:bg-white focus:outline-none dark:border-white/10 dark:bg-dark-800 dark:text-white"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-white/5 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {isAr ? 'إظهار الأسعار للشخص الواحد في القائمة العامة' : 'Display Per-Head Pricing to Public'}
                </span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showPricing}
                    onChange={(e) => setShowPricing(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>

              <div className="pt-3">
                <button
                  type="button"
                  onClick={handleSaveSettings}
                  disabled={saveSettingsMutation.isPending}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-xs font-bold text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 transition"
                >
                  {saveSettingsMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  <span>{isAr ? 'حفظ إعدادات الكتالوج' : 'Save Catalog Settings'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Right Side: Live Mobile Preview */}
          <div className="lg:col-span-6 flex justify-center">
            <div className="w-full max-w-sm overflow-hidden rounded-[2.5rem] border-8 border-slate-900 bg-slate-950 text-white shadow-2xl">
              {/* Cover Banner Mockup */}
              <div className="relative h-44 w-full bg-slate-900">
                {heroImage ? (
                  <img src={heroImage} alt="Hero" className="h-full w-full object-cover opacity-80" />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center bg-gradient-to-br from-amber-600/20 via-slate-900 to-slate-950 text-center p-4">
                    <Sparkles className="h-8 w-8 text-amber-400 mb-1" />
                    <span className="text-xs font-bold text-slate-300">Marquee Banner Photo</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
                <div className="absolute bottom-3 left-4 right-4">
                  <h4 className="text-sm font-black text-white">{welcomeTitle || tenant?.name || 'Grand Palace Banquets'}</h4>
                  <p className="text-[10px] text-amber-300/90 font-medium line-clamp-1">{welcomeSubtitle || 'Exquisite hospitality and gourmet catering.'}</p>
                </div>
              </div>

              {/* Sample Package Card */}
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-400">
                  <span>Available Packages:</span>
                  <span className="text-amber-400 text-[10px]">✨ Royal Selection</span>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-white">Diamond Wedding Feast</span>
                    {showPricing && <span className="text-xs font-mono font-bold text-amber-400">2,800 PKR/head</span>}
                  </div>
                  <p className="text-[10px] text-slate-400">Live BBQ, Mutton Biryani, Kashmiri Chai & Royal Stage Decor</p>
                  <div className="flex items-center justify-between pt-1 border-t border-white/5 text-[9.5px] text-slate-500">
                    <span>150 - 1000 Guests</span>
                    <span className="text-emerald-400 font-bold">11 Items Included</span>
                  </div>
                </div>

                {whatsappNumber && (
                  <div className="pt-2">
                    <div className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600/20 border border-emerald-500/30 p-2 text-xs font-bold text-emerald-400">
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Inquire via WhatsApp</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
