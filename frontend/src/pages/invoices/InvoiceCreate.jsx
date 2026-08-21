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
  Sparkles,
  ShieldCheck,
  Check,
  Zap,
  Receipt,
  FileText,
  ChevronRight,
  Layers,
  Plane,
  Building2,
  RefreshCw,
  Percent,
  Compass,
} from 'lucide-react'
import { useTranslation } from '../../lib/translations'
import { getTenantBusinessTypes } from '../../lib/businessTypes'
import { isSaudiTenant } from '../../lib/saudiTenant'

export default function InvoiceCreate() {
  const navigate = useNavigate()
  const { language } = useSelector((state) => state.ui)
  const { tenant } = useSelector((state) => state.auth)
  const { t } = useTranslation(language)
  const isAr = language === 'ar'

  const businessTypes = getTenantBusinessTypes(tenant)
  const canCreatePurchase = businessTypes.some((type) =>
    ['trading', 'construction', 'travel_agency', 'bakala', 'pharmacy', 'furniture_shop', 'supermarket'].includes(type)
  )
  const canCreateProforma = businessTypes.some((type) =>
    ['trading', 'construction', 'manpower', 'travel_agency', 'real_estate'].includes(type)
  )
  const hasTravel = businessTypes.includes('travel_agency')
  const isSaudi = isSaudiTenant(tenant)

  const [activeFilter, setActiveFilter] = useState('all')

  // Keyboard shortcut listener (1: Sales, 2: Purchase, 3: Proforma)
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore if typing in an input
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
      titleEn: 'Sales & Tax Invoice',
      titleAr: 'فاتورة مبيعات ضريبية',
      taglineEn: isSaudi
        ? 'Standard B2B & Simplified B2C tax invoice with live QR code and ZATCA compliance.'
        : 'Standard B2B & Simplified B2C tax invoice with live QR code and tax compliance.',
      taglineAr: 'فاتورة ضريبية قياسية (B2B) أو مبسطة (B2C) مع رمز QR التفاعلي والتوقيع الرقمي.',
      icon: ShoppingCart,
      gradient: 'from-emerald-500 via-teal-500 to-emerald-600',
      glowColor: 'rgba(16, 185, 129, 0.18)',
      badgeEn: isSaudi ? 'ZATCA Phase 2 Ready' : 'Tax Compliant',
      badgeAr: isSaudi ? 'معتمد للمرحلة الثانية' : 'معتمد للضريبة',
      badgeColor: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20',
      keyShortcut: '1',
      route: '/app/dashboard/invoices/new/sell',
      highlightsEn: [
        isSaudi ? 'Automatic 15% VAT calculation with bilingual titles' : 'Automatic tax calculation with itemized breakdown',
        'Cryptographic QR code generation for thermal & A4',
        'Real-time inventory deduction & cost of goods ledger',
        'Direct PDF, WhatsApp & thermal receipt sharing'
      ],
      highlightsAr: [
        isSaudi ? 'حساب تلقائي لضريبة 15% مع عناوين ثنائية اللغة' : 'حساب تلقائي للضريبة مع تفصيل البنود',
        'توليد رمز QR المعتمد لإيصالات الكاشير وA4',
        'خصم فوري من المخزون وقيد تكلفة المبيعات',
        'مشاركة عبر واتساب والبريد وطباعة فورية'
      ],
      tags: ['B2B / B2C', isSaudi ? 'ZATCA Phase 2' : 'Tax Compliant', 'Live Stock Sync', 'POS & Thermal'],
    },
    {
      id: 'purchase',
      category: 'procurement',
      visible: canCreatePurchase,
      titleEn: 'Vendor Purchase Bill',
      titleAr: 'فاتورة مشتريات وتكاليف',
      taglineEn: 'Record incoming supplier purchases, receive goods, and record input VAT deductions.',
      taglineAr: 'تسجيل فواتير المشتريات من الموردين وتحديث المخزون وخصم ضريبة المدخلات.',
      icon: Package,
      gradient: 'from-amber-500 via-orange-500 to-amber-600',
      glowColor: 'rgba(245, 158, 11, 0.18)',
      badgeEn: 'Procurement & Stock',
      badgeAr: 'مشتريات ومخزون',
      badgeColor: 'bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-500/20',
      keyShortcut: '2',
      route: '/app/dashboard/invoices/new/purchase',
      highlightsEn: [
        'Supplier payable balance & ledger reconciliation',
        'Weighted Average Cost (WAC) warehouse auto-update',
        'Multi-currency and freight landed cost tracking',
        'Input VAT recovery for periodic tax returns'
      ],
      highlightsAr: [
        'تسوية حسابات الموردين وجداول الأرصدة الدائنة',
        'تحديث المتوسط المرجح لتكلفة الأصناف بالمستودع',
        'دعم العملات الأجنبية وتكاليف الشحن والتخليص',
        'استرداد ضريبة المدخلات في الإقرار الضريبي'
      ],
      tags: ['Supplier PO', 'Input Tax', 'Weighted Cost', 'GRN & Receiving'],
    },
    {
      id: 'proforma',
      category: 'sales',
      visible: canCreateProforma,
      titleEn: 'Proforma & Advance Invoice',
      titleAr: 'فاتورة مبدئية (Proforma)',
      taglineEn: 'Commercial estimate for advance deposits and customs clearance. 1-click convert to Tax Invoice.',
      taglineAr: 'فاتورة تجارية مبدئية لطلب الدفع المسبق والتخليص. قابلة للتحويل لفاتورة ضريبية بنقرة واحدة.',
      icon: FileClock,
      gradient: 'from-blue-600 via-indigo-600 to-violet-600',
      glowColor: 'rgba(99, 102, 241, 0.18)',
      badgeEn: 'Non-Fiscal Estimate',
      badgeAr: 'غير ملزمة للضريبة',
      badgeColor: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/20',
      keyShortcut: '3',
      route: '/app/dashboard/invoices/new/sell?proforma=1',
      highlightsEn: [
        'Zero tax commitment until formal sales execution',
        'Does not hold or reduce warehouse stock balances',
        'Professional commercial quotation & payment terms',
        'Instant conversion to final tax invoice'
      ],
      highlightsAr: [
        'بدون أي التزام ضريبي حتى اعتماد البيع الفعلي',
        'لا تخصم المخزون ولا تؤثر على المستودعات',
        'عرض تجاري احترافي مع بيانات الحساب البنكي',
        'تحويل فوري إلى فاتورة ضريبية معتمدة'
      ],
      tags: ['Commercial Draft', 'Advance Payment', '1-Click Convert', isSaudi ? 'Non-ZATCA' : 'Draft Mode'],
    },
    {
      id: 'quotation',
      category: 'offers',
      titleEn: 'Price Quotation / Offer',
      titleAr: 'عرض سعر رسمي',
      taglineEn: 'Present proposals with itemized breakdown, validity expiry, and company terms.',
      taglineAr: 'إعداد عروض أسعار رسمية مع تفصيل البنود وفترة الصلاحية وشروط الدفع.',
      icon: FileText,
      gradient: 'from-purple-600 via-pink-600 to-purple-700',
      glowColor: 'rgba(168, 85, 247, 0.18)',
      badgeEn: 'Commercial Offer',
      badgeAr: 'عرض تجاري',
      badgeColor: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20',
      route: '/app/dashboard/quotations/new',
      highlightsEn: [
        'Itemized discounts, warranty & validity periods',
        'Digital client acceptance & signature pad',
        'Convert to Sales Invoice with 1 single click',
        'Modern branded PDF with company letterhead'
      ],
      highlightsAr: [
        'خصومات مفصلة وفترات صلاحية وضمان واضحة',
        'توقيع إلكتروني للعميل واعتماد العرض',
        'تحويل مباشر إلى فاتورة مبيعات بنقرة واحدة',
        'تصدير PDF بتصميم الهوية والترويسة الرسمية'
      ],
      tags: ['Price Proposal', 'Valid Period', 'Convertible', 'Letterhead'],
    },
  ]

  const visibleCards = DOCUMENT_CARDS.filter((card) => card.visible !== false)
  const filteredCards =
    activeFilter === 'all'
      ? visibleCards
      : visibleCards.filter((card) => card.category === activeFilter)

  return (
    <div className="mx-auto max-w-7xl space-y-8 pb-12">
      {/* Top Breadcrumb & Clean Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3.5">
          <button
            onClick={() => navigate('/app/dashboard/invoices')}
            title={isAr ? 'العودة لقائمة الفواتير' : 'Back to Invoices'}
            className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200/90 bg-white text-slate-700 shadow-2xs transition hover:border-slate-300 hover:bg-slate-50 dark:border-white/10 dark:bg-dark-800 dark:text-slate-200 dark:hover:bg-dark-700"
          >
            <ArrowLeft className={`h-5 w-5 ${isAr ? 'rotate-180' : ''}`} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-50/80 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300">
                <Sparkles className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                {isAr ? 'مركز إصدار المستندات' : 'Document Studio'}
              </span>
              <span className="text-xs text-slate-400 dark:text-slate-500">•</span>
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                {isSaudi ? 'ZATCA Phase 2 E-Invoicing' : (isAr ? 'الفوترة الإلكترونية المتوافقة' : 'E-Invoicing Compliant')}
              </span>
            </div>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-900 dark:text-white sm:text-3xl">
              {isAr ? 'إنشاء مستند فوترة جديد' : 'Create Billing Document'}
            </h1>
          </div>
        </div>

        {/* Minimal Category Tabs Filter */}
        <div className="inline-flex items-center gap-1 rounded-2xl border border-slate-200/90 bg-slate-100/80 p-1 dark:border-white/10 dark:bg-dark-800">
          {[
            { id: 'all', en: 'All Documents', ar: 'كافة المستندات' },
            { id: 'sales', en: 'Sales & Revenue', ar: 'المبيعات والإيرادات' },
            { id: 'procurement', en: 'Procurement', ar: 'المشتريات' },
            { id: 'offers', en: 'Quotations', ar: 'عروض الأسعار' },
          ].map((tab) => {
            const active = activeFilter === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveFilter(tab.id)}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                  active
                    ? 'bg-white text-slate-950 shadow-2xs dark:bg-white/15 dark:text-white'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                {isAr ? tab.ar : tab.en}
              </button>
            )
          })}
        </div>
      </div>

      {/* Main Luxury Bento Cards Grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-2">
        <AnimatePresence mode="popLayout">
          {filteredCards.map((card, idx) => {
            const Icon = card.icon
            return (
              <motion.div
                key={card.id}
                layout
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.25, delay: idx * 0.05 }}
                onClick={() => navigate(card.route)}
                className="group relative flex cursor-pointer flex-col justify-between overflow-hidden rounded-3xl border border-slate-200/90 bg-white p-7 shadow-xs transition-all duration-300 hover:-translate-y-1 hover:border-slate-400 hover:shadow-xl dark:border-white/10 dark:bg-[#0c111a] dark:hover:border-white/25 dark:hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.7)]"
                style={{
                  boxShadow: `0 10px 30px -15px ${card.glowColor}`,
                }}
              >
                {/* Subtle Ambient Background Gradient on Hover */}
                <div
                  className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-40"
                  style={{ background: `radial-gradient(circle, ${card.glowColor} 0%, transparent 70%)` }}
                />

                <div>
                  {/* Card Header: Icon, Badge, and Shortcut Pill */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3.5">
                      <div
                        className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${card.gradient} text-white shadow-md transition-transform duration-300 group-hover:scale-108`}
                      >
                        <Icon className="h-7 w-7 stroke-[2.2]" />
                      </div>
                      <div>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${card.badgeColor}`}
                        >
                          <ShieldCheck className="h-3 w-3 shrink-0" />
                          {isAr ? card.badgeAr : card.badgeEn}
                        </span>
                      </div>
                    </div>

                    {/* Quick Keyboard Shortcut Key */}
                    {card.keyShortcut && (
                      <span
                        title={isAr ? `اضغط ${card.keyShortcut} للمتابعة` : `Press ${card.keyShortcut} to launch`}
                        className="flex h-7 w-7 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 font-mono text-xs font-black text-slate-500 shadow-2xs transition group-hover:border-slate-400 group-hover:bg-white group-hover:text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-slate-400 dark:group-hover:text-white"
                      >
                        {card.keyShortcut}
                      </span>
                    )}
                  </div>

                  {/* Title & Tagline */}
                  <div className="mt-5">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xl font-black text-slate-900 transition-colors group-hover:text-emerald-700 dark:text-white dark:group-hover:text-emerald-400">
                        {isAr ? card.titleAr : card.titleEn}
                      </h3>
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition-all duration-300 group-hover:translate-x-1 group-hover:bg-slate-900 group-hover:text-white dark:bg-white/10 dark:text-slate-300 dark:group-hover:bg-white dark:group-hover:text-slate-950">
                        <ArrowUpRight className={`h-4 w-4 ${isAr ? '-scale-x-100' : ''}`} />
                      </div>
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                      {isAr ? card.taglineAr : card.taglineEn}
                    </p>
                  </div>

                  {/* Bullet Highlights List */}
                  <div className="mt-5 space-y-2 border-t border-slate-100 pt-4 dark:border-white/5">
                    {(isAr ? card.highlightsAr : card.highlightsEn).map((item, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300">
                        <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400">
                          <Check className="h-2.5 w-2.5 stroke-[3]" />
                        </div>
                        <span className="leading-snug">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Footer Tag Chips */}
                <div className="mt-6 flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-4 dark:border-white/5">
                  {card.tags.map((tag, tIdx) => (
                    <span
                      key={tIdx}
                      className="rounded-lg bg-slate-100 px-2 py-0.5 text-[10.5px] font-semibold text-slate-600 dark:bg-white/5 dark:text-slate-400"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>

      {/* Quick Status Bar & Quick Actions Strip */}
      <div className="flex flex-col gap-4 rounded-3xl border border-slate-200/90 bg-slate-50/90 p-5 shadow-2xs sm:flex-row sm:items-center sm:justify-between dark:border-white/10 dark:bg-dark-800/60">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <Zap className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-900 dark:text-white">
              {isAr ? 'نظام الفوترة السريع والمتوافق' : 'Instant & Compliant Billing Hub'}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {isAr
                ? 'تدعم جميع الفواتير رموز الاستجابة السريعة (QR) وتوليد ملفات PDF الفورية وتعدد العملات.'
                : 'All documents support real-time QR generation, multi-currency pricing, and A4/Thermal printing.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/app/dashboard/invoices"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-2xs transition hover:bg-slate-50 dark:border-white/10 dark:bg-dark-700 dark:text-slate-200 dark:hover:bg-dark-600"
          >
            <Receipt className="h-3.5 w-3.5 text-slate-500" />
            <span>{isAr ? 'سجل الفواتير السابقة' : 'Invoice Archive'}</span>
          </Link>

          <Link
            to="/app/dashboard/vat-returns"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-2xs transition hover:bg-slate-50 dark:border-white/10 dark:bg-dark-700 dark:text-slate-200 dark:hover:bg-dark-600"
          >
            <Percent className="h-3.5 w-3.5 text-amber-500" />
            <span>{isAr ? 'الإقرار الضريبي (VAT)' : 'VAT Ledger'}</span>
          </Link>
        </div>
      </div>
    </div>
  )
}
