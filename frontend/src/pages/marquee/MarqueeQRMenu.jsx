import { useState, useRef } from 'react'
import { useSelector } from 'react-redux'
import { QRCodeSVG } from 'qrcode.react'
import {
  QrCode, Printer, Download, Copy, Check, ExternalLink,
  Sparkles, UtensilsCrossed, Wifi, Share2, Building
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useTranslation } from '../../lib/translations'

export default function MarqueeQRMenu() {
  const { language } = useSelector((s) => s.ui)
  const { tenant } = useSelector((s) => s.auth)
  const { t } = useTranslation(language)
  const isAr = language === 'ar'

  const [copied, setCopied] = useState(false)
  const [tableNumber, setTableNumber] = useState('VIP Table 01')
  const [wifiName, setWifiName] = useState('Marquee_Guest_WiFi')
  const [wifiPass, setWifiPass] = useState('Guest2026')
  const qrRef = useRef(null)

  const tenantSlug = tenant?.slug || 'hall'
  const publicUrl = `${window.location.origin}/public/marquee/${tenantSlug}?table=${encodeURIComponent(tableNumber)}`

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

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white sm:text-3xl">
              {isAr ? 'قائمة طعام الطاولات الرقمية (QR Code)' : 'Table Digital Menu & QR Code'}
            </h1>
            <span className="rounded-full bg-purple-50 px-2.5 py-0.5 text-xs font-bold text-purple-700 dark:bg-purple-500/10 dark:text-purple-300">
              {isAr ? 'تفاعلي للضيوف' : 'Guest Interactive'}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {isAr
              ? 'توليد رموز QR لطاولات القاعة والمدخل لتمكين الضيوف من استعراض قائمة البوفيه والأطعمة، جدول الفعالية وكلمة سر الواي فاي.'
              : 'Generate table QR tents for guests to browse live buffet menus, stage schedule, and WiFi credentials.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleDownload}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-white/10 dark:bg-dark-800 dark:text-slate-200"
          >
            <Download className="h-4 w-4" />
            <span>{isAr ? 'تحميل PNG' : 'Download PNG'}</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-2.5 text-xs font-bold text-white shadow-md transition-all hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
          >
            <Printer className="h-4 w-4 stroke-[2.5]" />
            <span>{isAr ? 'طباعة بطاقة الطاولة' : 'Print Table Card'}</span>
          </button>
        </div>
      </div>

      {/* Main Container */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Side: Table & QR Settings */}
        <div className="lg:col-span-5 space-y-5">
          <div className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-xs dark:border-white/10 dark:bg-[#0c111a] space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider text-xs">
              {isAr ? 'تخصيص بطاقة الطاولة' : 'Table Tent Customization'}
            </h3>

            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                {isAr ? 'رقم / اسم الطاولة أو المدخل' : 'Table / Area Label'}
              </label>
              <input
                type="text"
                value={tableNumber}
                onChange={(e) => setTableNumber(e.target.value)}
                placeholder="VIP Table 01 / Main Entrance"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-medium text-slate-900 focus:border-slate-900 focus:outline-none dark:border-white/10 dark:bg-dark-800 dark:text-white"
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
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-900 focus:border-slate-900 focus:outline-none dark:border-white/10 dark:bg-dark-800 dark:text-white"
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
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-900 focus:border-slate-900 focus:outline-none dark:border-white/10 dark:bg-dark-800 dark:text-white"
                />
              </div>
            </div>

            {/* Live Link Box */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3 dark:border-white/5 dark:bg-dark-800/60 space-y-2">
              <span className="text-[11px] font-bold text-slate-500">
                {isAr ? 'رابط القائمة الرقمية المباشر:' : 'Direct Live URL:'}
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={publicUrl}
                  className="flex-1 truncate rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 dark:border-white/10 dark:bg-dark-900 dark:text-slate-300 font-mono"
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
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-md">
                <Sparkles className="h-6 w-6 text-amber-400" />
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
                  imageSettings={{
                    src: '/favicon.ico',
                    x: undefined,
                    y: undefined,
                    height: 28,
                    width: 28,
                    excavate: true,
                  }}
                />
              </div>

              <p className="mt-3 text-xs font-bold text-slate-800">
                {isAr ? 'امسح الرمز بالجوال لاستعراض قائمة الطعام والجدول' : 'Scan with your smartphone camera'}
              </p>
              <p className="text-[10px] text-slate-400">
                {isAr ? 'قائمة البوفيه • جدول الحفل • طلب الخدمة' : 'View Banquet Menu & Event Timeline'}
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
    </div>
  )
}
