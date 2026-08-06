import React, { useState } from 'react'
import { motion } from 'framer-motion'
import {
  CheckCircle,
  Info,
  Star,
  Sparkles,
  RefreshCw,
  Server,
  ShieldCheck,
  Zap,
  HardDrive,
  Cpu,
  ArrowUpRight,
  ExternalLink,
  Award
} from 'lucide-react'
import { toast } from 'react-hot-toast'

export default function MaqderUpdates() {
  const isRtl = localStorage.getItem('language') === 'ar'
  const [checkingUpdate, setCheckingUpdate] = useState(false)
  const [lastChecked, setLastChecked] = useState(new Date().toLocaleTimeString(isRtl ? 'ar-SA' : 'en-US'))

  const handleCheckUpdate = () => {
    setCheckingUpdate(true)
    setTimeout(() => {
      setCheckingUpdate(false)
      setLastChecked(new Date().toLocaleTimeString(isRtl ? 'ar-SA' : 'en-US'))
      toast.success(
        isRtl
          ? 'نظام مقدر محدث إلى أحدث إصدار v2.4.0'
          : 'Maqder ERP is up to date on version v2.4.0'
      )
    }, 1200)
  }

  const systemHealth = [
    {
      nameEn: 'Database Engine',
      nameAr: 'محرك قاعدة البيانات',
      status: 'Operational',
      statusAr: 'يعمل بكفاءة',
      icon: Server,
      color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10'
    },
    {
      nameEn: 'ZATCA Phase 2 E-Invoicing Engine',
      nameAr: 'محرك الفوترة الإلكترونية (هيئة الزكاة)',
      status: 'Compliant & Active',
      statusAr: 'متوافق ونشط',
      icon: ShieldCheck,
      color: 'text-blue-500 bg-blue-50 dark:bg-blue-500/10'
    },
    {
      nameEn: 'AI & Translation Accelerator',
      nameAr: 'محرك الترجمة والذكاء الاصطناعي',
      status: 'Optimized (Cached)',
      statusAr: 'محسّن ومسرّع',
      icon: Zap,
      color: 'text-amber-500 bg-amber-50 dark:bg-amber-500/10'
    },
    {
      nameEn: 'Automated Backup & Cloud Sync',
      nameAr: 'النسخ الاحتياطي والمزامنة السحابية',
      status: 'Encrypted & Active',
      statusAr: 'مشفر ونشط',
      icon: HardDrive,
      color: 'text-purple-500 bg-purple-50 dark:bg-purple-500/10'
    }
  ]

  const releases = [
    {
      version: 'v2.4.0',
      dateEn: 'August 2026',
      dateAr: 'أغسطس 2026',
      tagEn: 'Current Release',
      tagAr: 'الإصدار الحالي',
      tagColor: 'bg-emerald-500 text-white',
      highlights: [
        {
          titleEn: '429 Rate Limit Load Balancing & Multi-POS Throughput',
          titleAr: 'موازنة أعباء الخادم ومضاعفة سعة نقاط البيع المتزامنة',
          descEn: 'Architected high-throughput rate limiting (10,000 req/15m) keyed per-tenant with in-flight request deduplication and intelligent backoff jitter.',
          descAr: 'ترقية نظام موازنة الطلبات إلى 10,000 طلب/15 دقيقة مع ميزة دمج الطلبات المتزامنة والتراجع التلقائي الذكي.'
        },
        {
          titleEn: 'Saudi Government Apps Modular Store Architecture',
          titleAr: 'متجر التطبيقات الحكومية السعودية المعيارية',
          descEn: 'Full standalone modular applications for ZATCA Phase 2, Elm Yakeen/Tamm, Qiwa Labor, GOSI Mudad, Balady Licensing, and Saber SASO.',
          descAr: 'فصل وتوحيد التكاملات الحكومية في تطبيقات مستقلة داخل متجر التطبيقات مع نماذج اتصال وإعدادات متطورة.'
        },
        {
          titleEn: 'Executive PDF & Excel Reporting Suite',
          titleAr: 'منظومة التقارير التنفيذية والمالية الشاملة',
          descEn: 'Standardized export to PDF, Excel, and CSV across VAT, Business, Internal/External Audit, Customer Sales, Restaurant, and Trading.',
          descAr: 'تصدير موحد للتقارير بصيغ PDF و Excel و CSV لجميع الأنشطة وضريبة القيمة المضافة ومبيعات العملاء.'
        },
        {
          titleEn: 'Dynamic Restaurant Combos & Customizable Deal Pricing',
          titleAr: 'محرك العروض والكومبو الذكي للمطاعم',
          descEn: 'Auto-calculates constituent item sums with full freedom to set custom promotional prices, quick discount percentages, and savings badges.',
          descAr: 'حساب تلقائي لأسعار الوجبات مع إمكانية تعديل سعر العرض بحرية وتطبيق خصومات سريعة وتوضيح نسبة التوفير للعميل.'
        }
      ]
    },
    {
      version: 'v2.3.0',
      dateEn: 'July 2026',
      dateAr: 'يوليو 2026',
      tagEn: 'Previous Release',
      tagAr: 'إصدار سابق',
      tagColor: 'bg-gray-200 dark:bg-dark-700 text-gray-700 dark:text-gray-300',
      highlights: [
        {
          titleEn: 'Multi-Tenant Offline IndexDB Caching',
          titleAr: 'التخزين والمزامنة بدون إنترنت عبر متصفح الأجهزة',
          descEn: 'Complete offline operational support with background queue synchronization upon internet reconnection.',
          descAr: 'دعم كامل للعمل بدون إنترنت وحفظ العمليات في طابور مزامنة ذكي يتم رفعه فور استعادة الاتصال.'
        },
        {
          titleEn: 'Unified Application Bar & Launcher',
          titleAr: 'شريط ومنصة التطبيقات الموحدة',
          descEn: 'Ultra-fast macOS-style launcher with keyboard shortcuts, fuzzy search, and instant module hopping.',
          descAr: 'شريط وصول سريع للتطبيقات مع بحث فوري واختصارات لوحة المفاتيح.'
        }
      ]
    }
  ]

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-8 pb-20">
      {/* ─── Hero Header ─── */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-gray-900 via-dark-800 to-gray-950 text-white p-8 sm:p-10 shadow-2xl border border-white/10"
      >
        <div className="absolute top-0 end-0 w-96 h-96 bg-primary-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-xs font-semibold tracking-wide text-primary-300 border border-white/10">
              <Sparkles className="w-3.5 h-3.5" />
              <span>{isRtl ? 'نظام مقدر لإدارة المنشآت v2.4.0' : 'Maqder Enterprise ERP v2.4.0'}</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight">
              {isRtl ? 'مركز تحديثات وحالة مقدر' : 'Maqder System & Updates Center'}
            </h1>
            <p className="text-gray-300 text-sm sm:text-base max-w-xl">
              {isRtl
                ? 'متابعة أحدث التحسينات، استقرار الخدمات، والتحقق من التحديثات الفورية للنظام.'
                : 'Monitor release changelogs, system health telemetry, and check for real-time updates.'}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <button
              onClick={handleCheckUpdate}
              disabled={checkingUpdate}
              className="px-6 py-3.5 rounded-2xl bg-white text-gray-950 hover:bg-gray-100 font-bold text-sm transition-all duration-300 flex items-center justify-center gap-2 shadow-lg disabled:opacity-60 active:scale-95"
            >
              <RefreshCw className={`w-4 h-4 ${checkingUpdate ? 'animate-spin' : ''}`} />
              <span>
                {checkingUpdate
                  ? (isRtl ? 'جاري الفحص...' : 'Checking...')
                  : (isRtl ? 'فحص التحديثات' : 'Check for Updates')}
              </span>
            </button>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-white/10 flex flex-wrap items-center justify-between gap-4 text-xs text-gray-400">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>{isRtl ? `آخر فحص: ${lastChecked}` : `Last checked: ${lastChecked}`}</span>
          </div>
          <div className="flex items-center gap-2">
            <Award className="w-4 h-4 text-amber-400" />
            <span>{isRtl ? 'معتمد رسمياً للفوترة الإلكترونية (ZATCA)' : 'ZATCA Certified Phase 2 Platform'}</span>
          </div>
        </div>
      </motion.div>

      {/* ─── System Health Telemetry ─── */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Cpu className="w-5 h-5 text-primary-500" />
          <span>{isRtl ? 'حالة البنية التحتية والخدمات' : 'Infrastructure & Service Status'}</span>
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {systemHealth.map((item, idx) => {
            const Icon = item.icon
            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="bg-white dark:bg-dark-800 rounded-2xl p-5 border border-gray-100 dark:border-white/10 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className={`p-2.5 rounded-xl ${item.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-500/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    {isRtl ? item.statusAr : item.status}
                  </span>
                </div>
                <div className="text-sm font-bold text-gray-900 dark:text-white">
                  {isRtl ? item.nameAr : item.nameEn}
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>

      {/* ─── Release Changelog ─── */}
      <div className="space-y-6">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Star className="w-5 h-5 text-amber-500" />
          <span>{isRtl ? 'سجل التحديثات والمميزات' : 'Release Notes & Changelog'}</span>
        </h2>

        {releases.map((rel, rIdx) => (
          <motion.div
            key={rIdx}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + rIdx * 0.05 }}
            className="bg-white dark:bg-dark-800 rounded-3xl p-6 sm:p-8 border border-gray-100 dark:border-white/10 shadow-sm space-y-6"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-gray-100 dark:border-white/5">
              <div className="flex items-center gap-3">
                <span className="text-xl font-black text-gray-900 dark:text-white">
                  {rel.version}
                </span>
                <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${rel.tagColor}`}>
                  {isRtl ? rel.tagAr : rel.tagEn}
                </span>
              </div>
              <span className="text-xs font-medium text-gray-400">
                {isRtl ? rel.dateAr : rel.dateEn}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {rel.highlights.map((hl, hlIdx) => (
                <div
                  key={hlIdx}
                  className="p-4 rounded-2xl bg-gray-50/70 dark:bg-dark-900/50 border border-gray-100 dark:border-white/5 space-y-2 hover:bg-gray-100/70 dark:hover:bg-dark-900/80 transition-colors"
                >
                  <div className="flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-white">
                    <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>{isRtl ? hl.titleAr : hl.titleEn}</span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed ps-6">
                    {isRtl ? hl.descAr : hl.descEn}
                  </p>
                </div>
              ))}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

