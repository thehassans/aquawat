import React, { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ShoppingCart,
  Package,
  FileClock,
  ArrowUpRight,
  ShieldCheck,
  Check,
  Receipt,
  FileText,
} from 'lucide-react'
import { getTenantBusinessTypes } from '../../lib/businessTypes'
import { isSaudiTenant } from '../../lib/saudiTenant'
import {
  backBtnClass,
  pageTitleClass,
  pageSubtitleClass,
  sectionCardClass,
  sectionEyebrowClass,
  softChipClass,
} from '../sales/salesUi'

export default function InvoiceCreate() {
  const navigate = useNavigate()
  const { language } = useSelector((state) => state.ui)
  const { tenant } = useSelector((state) => state.auth)
  const isAr = language === 'ar'

  const businessTypes = getTenantBusinessTypes(tenant)
  const canCreatePurchase = businessTypes.some((type) =>
    ['trading', 'construction', 'travel_agency', 'bakala', 'pharmacy', 'furniture_shop', 'supermarket'].includes(type)
  )
  const canCreateProforma = businessTypes.some((type) =>
    ['trading', 'construction', 'manpower', 'travel_agency', 'real_estate'].includes(type)
  )
  const isSaudi = isSaudiTenant(tenant)

  const [activeFilter, setActiveFilter] = useState('all')

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['input', 'textarea'].includes(e.target.tagName.toLowerCase())) return
      if (e.key === '1') navigate('/app/dashboard/invoices/new/sell')
      if (e.key === '2' && canCreatePurchase) navigate('/app/dashboard/invoices/new/purchase')
      if (e.key === '3' && canCreateProforma) navigate('/app/dashboard/invoices/new/sell?proforma=1')
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [navigate, canCreatePurchase, canCreateProforma])

  const DOCUMENT_CARDS = [
    {
      id: 'sell',
      category: 'sales',
      titleEn: 'Sales Invoice',
      titleAr: 'فاتورة مبيعات',
      taglineEn: isSaudi
        ? 'B2B standard or B2C simplified tax invoice with live QR and ZATCA readiness.'
        : 'B2B standard or B2C simplified tax invoice with live QR and tax compliance.',
      taglineAr: 'فاتورة ضريبية قياسية أو مبسطة مع رمز QR والتوافق الضريبي.',
      icon: ShoppingCart,
      badgeEn: isSaudi ? 'ZATCA ready' : 'Tax compliant',
      badgeAr: isSaudi ? 'جاهز لزاتكا' : 'متوافق ضريبياً',
      keyShortcut: '1',
      route: '/app/dashboard/invoices/new/sell',
      highlightsEn: [
        'VAT calculated automatically with bilingual line items',
        'Live PDF preview, WhatsApp share, and thermal print',
        'Stock deduction synced on issue',
      ],
      highlightsAr: [
        'حساب ضريبة تلقائي مع بنود ثنائية اللغة',
        'معاينة PDF ومشاركة واتساب وطباعة حرارية',
        'خصم المخزون عند الإصدار',
      ],
    },
    {
      id: 'purchase',
      category: 'procurement',
      visible: canCreatePurchase,
      titleEn: 'Purchase Invoice',
      titleAr: 'فاتورة مشتريات',
      taglineEn: 'Record supplier bills, receive goods, and track input tax.',
      taglineAr: 'تسجيل فواتير الموردين واستلام البضاعة وتتبع ضريبة المدخلات.',
      icon: Package,
      badgeEn: 'Procurement',
      badgeAr: 'مشتريات',
      keyShortcut: '2',
      route: '/app/dashboard/invoices/new/purchase',
      highlightsEn: [
        'Link purchase orders and warehouses',
        'Supplier payables and cost updates',
        'Input VAT ready for returns',
      ],
      highlightsAr: [
        'ربط طلبات الشراء والمستودعات',
        'ذمم الموردين وتحديث التكلفة',
        'ضريبة مدخلات جاهزة للإقرار',
      ],
    },
    {
      id: 'proforma',
      category: 'sales',
      visible: canCreateProforma,
      titleEn: 'Proforma Invoice',
      titleAr: 'فاتورة مبدئية',
      taglineEn: 'Commercial estimate for deposits — convert to tax invoice in one click.',
      taglineAr: 'تقدير تجاري للدفعات المقدمة — تحويل لفاتورة ضريبية بنقرة.',
      icon: FileClock,
      badgeEn: 'Non-fiscal',
      badgeAr: 'غير ملزمة',
      keyShortcut: '3',
      route: '/app/dashboard/invoices/new/sell?proforma=1',
      highlightsEn: [
        'No tax commitment until conversion',
        'Does not reduce warehouse stock',
        'Professional terms and bank details',
      ],
      highlightsAr: [
        'بدون التزام ضريبي حتى التحويل',
        'لا يخصم من المخزون',
        'شروط وبيانات بنكية احترافية',
      ],
    },
    {
      id: 'quotation',
      category: 'offers',
      titleEn: 'Quotation',
      titleAr: 'عرض سعر',
      taglineEn: 'Itemized offer with validity, terms, and one-click convert to invoice.',
      taglineAr: 'عرض مفصل مع صلاحية وشروط وتحويل مباشر إلى فاتورة.',
      icon: FileText,
      badgeEn: 'Commercial offer',
      badgeAr: 'عرض تجاري',
      route: '/app/dashboard/quotations/new',
      highlightsEn: [
        'Validity period and payment terms',
        'Branded letterhead PDF',
        'Convert approved quotes to sales invoices',
      ],
      highlightsAr: [
        'فترة صلاحية وشروط دفع',
        'PDF بترويسة الشركة',
        'تحويل العروض المعتمدة إلى فواتير',
      ],
    },
  ]

  const visibleCards = DOCUMENT_CARDS.filter((card) => card.visible !== false)
  const filteredCards =
    activeFilter === 'all'
      ? visibleCards
      : visibleCards.filter((card) => card.category === activeFilter)

  const tabs = [
    { id: 'all', en: 'All', ar: 'الكل' },
    { id: 'sales', en: 'Sales', ar: 'المبيعات' },
    { id: 'procurement', en: 'Purchases', ar: 'المشتريات' },
    { id: 'offers', en: 'Quotations', ar: 'عروض الأسعار' },
  ]

  return (
    <div className="mx-auto max-w-6xl space-y-8 pb-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-center gap-3.5">
          <button
            type="button"
            onClick={() => navigate('/app/dashboard/invoices')}
            title={isAr ? 'العودة لقائمة الفواتير' : 'Back to Invoices'}
            className={backBtnClass}
          >
            <ArrowLeft className={`h-5 w-5 ${isAr ? 'rotate-180' : ''}`} />
          </button>
          <div>
            <p className={sectionEyebrowClass}>
              {isAr ? 'المبيعات' : 'Sales'}
            </p>
            <h1 className={pageTitleClass}>
              {isAr ? 'مستند جديد' : 'New document'}
            </h1>
            <p className={pageSubtitleClass}>
              {isSaudi
                ? (isAr ? 'اختر نوع الفاتورة أو عرض السعر للمتابعة' : 'Choose an invoice or quotation to continue')
                : (isAr ? 'اختر نوع المستند للمتابعة' : 'Choose a document type to continue')}
            </p>
          </div>
        </div>

        <div className="inline-flex items-center gap-1 rounded-2xl border border-slate-200/90 bg-slate-50/80 p-1 dark:border-white/10 dark:bg-dark-800">
          {tabs.map((tab) => {
            const active = activeFilter === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveFilter(tab.id)}
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                  active
                    ? 'bg-white text-slate-950 shadow-sm dark:bg-white/15 dark:text-white'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                {isAr ? tab.ar : tab.en}
              </button>
            )
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <AnimatePresence mode="popLayout">
          {filteredCards.map((card, idx) => {
            const Icon = card.icon
            return (
              <motion.button
                key={card.id}
                type="button"
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.2, delay: idx * 0.04 }}
                onClick={() => navigate(card.route)}
                className={`${sectionCardClass} group flex cursor-pointer flex-col text-start transition hover:border-slate-300 hover:shadow-[0_16px_44px_-28px_rgba(15,23,42,0.45)] dark:hover:border-white/20`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-slate-950 text-white dark:bg-white dark:text-slate-950">
                      <Icon className="h-5 w-5" strokeWidth={1.75} />
                    </span>
                    <span className={softChipClass}>
                      <ShieldCheck className="h-3 w-3 text-teal-600 dark:text-teal-400" />
                      {isAr ? card.badgeAr : card.badgeEn}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {card.keyShortcut ? (
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white font-mono text-[11px] font-bold text-slate-500 dark:border-white/10 dark:bg-dark-700 dark:text-slate-400">
                        {card.keyShortcut}
                      </span>
                    ) : null}
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition group-hover:bg-slate-950 group-hover:text-white dark:bg-white/10 dark:text-slate-300 dark:group-hover:bg-white dark:group-hover:text-slate-950">
                      <ArrowUpRight className={`h-4 w-4 ${isAr ? '-scale-x-100' : ''}`} />
                    </span>
                  </div>
                </div>

                <h3 className="mt-5 text-lg font-semibold tracking-tight text-slate-900 dark:text-white">
                  {isAr ? card.titleAr : card.titleEn}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                  {isAr ? card.taglineAr : card.taglineEn}
                </p>

                <ul className="mt-5 space-y-2 border-t border-slate-100 pt-4 dark:border-white/5">
                  {(isAr ? card.highlightsAr : card.highlightsEn).map((item) => (
                    <li key={item} className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-600 dark:text-teal-400" strokeWidth={2.5} />
                      <span className="leading-snug">{item}</span>
                    </li>
                  ))}
                </ul>
              </motion.button>
            )
          })}
        </AnimatePresence>
      </div>

      <div className={`${sectionCardClass} flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between !py-4`}>
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300">
            <Receipt className="h-4.5 w-4.5" strokeWidth={1.75} />
          </span>
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">
              {isAr ? 'أرشيف الفواتير' : 'Invoice archive'}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isAr ? 'عرض وإدارة الفواتير الصادرة سابقاً' : 'Browse and manage previously issued documents'}
            </p>
          </div>
        </div>
        <Link to="/app/dashboard/invoices" className="btn btn-secondary btn-sm">
          {isAr ? 'فتح القائمة' : 'Open list'}
        </Link>
      </div>
    </div>
  )
}
