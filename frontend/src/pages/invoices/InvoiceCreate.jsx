import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  ShoppingCart,
  Package,
  FileClock,
  RotateCcw,
  FileText,
  Sparkles,
  ShieldCheck,
  Zap,
  CheckCircle2,
  Printer,
  QrCode,
  Layers,
  Coins,
  Repeat,
  FilePlus2,
  BadgeCheck,
  Building2,
  FileCheck,
  ArrowUpRight,
  TrendingUp,
} from 'lucide-react'
import { useTranslation } from '../../lib/translations'
import { getTenantBusinessTypes } from '../../lib/businessTypes'

export default function InvoiceCreate() {
  const navigate = useNavigate()
  const { language } = useSelector((state) => state.ui)
  const { tenant } = useSelector((state) => state.auth)
  const { t } = useTranslation(language)
  const isAr = language === 'ar'

  const currency = tenant?.currency || 'SAR'
  const isKsa = currency === 'SAR'
  const isBd = currency === 'BDT'
  const isPk = currency === 'PKR'

  const businessTypes = getTenantBusinessTypes(tenant)
  const canCreatePurchase = businessTypes.some((type) =>
    ['trading', 'construction', 'travel_agency', 'bakala', 'pharmacy', 'restaurant'].includes(type)
  )
  const canCreateProforma = businessTypes.some((type) =>
    ['trading', 'construction', 'manpower', 'travel_agency', 'service'].includes(type)
  )

  const taxAuthorityBadge = isKsa
    ? { name: isAr ? 'هيئة الزكاة والضريبة والجمارك (ZATCA)' : 'ZATCA Phase 2 Ready', icon: ShieldCheck }
    : isBd
    ? { name: isAr ? 'هيئة الإيرادات NBR Mushak 6.3' : 'NBR Mushak 6.3 Ready', icon: ShieldCheck }
    : isPk
    ? { name: isAr ? 'هيئة الإيرادات FBR Digital Invoicing' : 'FBR Digital Invoicing Ready', icon: ShieldCheck }
    : { name: isAr ? 'معايير الفوترة الدولية' : 'Global Tax Standards', icon: ShieldCheck }

  const primaryCards = [
    {
      id: 'sell',
      route: '/app/dashboard/invoices/new/sell',
      titleEn: 'Sales Tax Invoice',
      titleAr: 'فاتورة مبيعات ضريبية',
      badgeEn: 'Most Popular',
      badgeAr: 'الأكثر استخداماً',
      descEn:
        'Issue a compliant sales invoice to a customer or business. Generates real-time tax QR codes, updates accounts receivable, and automatically reconciles inventory.',
      descAr:
        'إصدار فاتورة مبيعات ضريبية متوافقة لعميل أو شركة. توليد فوري لرمز QR الضريبي، تحديث دفتر المدينين ومزامنة المخزون فورياً.',
      accent: 'emerald',
      gradient: 'from-emerald-500/15 via-teal-500/5 to-transparent',
      borderHover: 'hover:border-emerald-500/50 hover:shadow-emerald-500/10',
      iconBg: 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-emerald-500/25',
      icon: ShoppingCart,
      bullets: [
        isAr ? 'متوافق مع المرحلة الثانية ومتطلبات الضريبة' : 'Certified Tax & E-Invoicing Compliant',
        isAr ? 'توليد تلقائي لرمز QR الضريبي المعتمد' : 'Instant Verification QR Code Generation',
        isAr ? 'دعم معاملات الأفراد B2C والشركات B2B' : 'Full Support for B2B & B2C Customers',
        isAr ? 'معاينة فورية وطباعة حرارية وPDF فخم' : 'Live Preview, Custom PDF & Thermal POS Receipts',
      ],
      tags: [
        { en: 'B2B & B2C', ar: 'أفراد وشركات' },
        { en: 'Live QR Code', ar: 'رمز QR فوري' },
        { en: 'Auto Inventory', ar: 'تحديث المخزون' },
        { en: 'Multi-Currency', ar: 'متعدد العملات' },
      ],
    },
    {
      id: 'purchase',
      route: '/app/dashboard/invoices/new/purchase',
      titleEn: 'Purchase / Vendor Bill',
      titleAr: 'فاتورة مشتريات وتوريد',
      badgeEn: 'Inbound Supply',
      badgeAr: 'توريد ومشتريات',
      descEn:
        'Record goods and services received from suppliers. Instantly increases warehouse stock, records VAT input credits, and updates supplier balance ledgers.',
      descAr:
        'تسجيل البضائع والخدمات المستلمة من الموردين. زيادة فورية للمخزون في المستودعات، واحتساب رصيد ضريبة المدخلات وتحديث كشف حساب المورد.',
      accent: 'amber',
      gradient: 'from-amber-500/15 via-orange-500/5 to-transparent',
      borderHover: 'hover:border-amber-500/50 hover:shadow-amber-500/10',
      iconBg: 'bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-amber-500/25',
      icon: Package,
      bullets: [
        isAr ? 'تحديث فوري لأرصدة وتكاليف المنتجات بالمستودعات' : 'Instant Warehouse Stock & Landed Cost Updates',
        isAr ? 'مطابقة مع أوامر الشراء (PO) وسندات الاستلام (GRN)' : 'Match with Purchase Orders & Receiving Slips',
        isAr ? 'حساب دقيق لضريبة المدخلات القابلة للاسترداد' : 'Reconcile Input Tax Credit & Expenses',
        isAr ? 'تتبع الدفعات وتواريخ استحقاق الموردين' : 'Track Supplier Balances & Due Payment Terms',
      ],
      tags: [
        { en: 'Supplier Ledger', ar: 'كشف الموردين' },
        { en: 'Inventory Restock', ar: 'تغذية المخزون' },
        { en: 'Tax Credit', ar: 'ضريبة المدخلات' },
      ],
    },
    {
      id: 'proforma',
      route: '/app/dashboard/invoices/new/sell?proforma=1',
      titleEn: 'Proforma Invoice (Quote Bill)',
      titleAr: 'فاتورة مبدئية (Proforma)',
      badgeEn: 'Non-Taxable Draft',
      badgeAr: 'مسودة تقديرية',
      descEn:
        'Provide customers with a binding preliminary estimate before delivery or payment. Converts seamlessly into a signed tax invoice with 1 click.',
      descAr:
        'تقديم مستند تقديري تمهيدي للعميل قبل التوريد أو الدفع. يمكن تحويلها بنقرة واحدة إلى فاتورة ضريبية رسمية نهائية عند تأكيد الاتفاق.',
      accent: 'indigo',
      gradient: 'from-indigo-500/15 via-blue-500/5 to-transparent',
      borderHover: 'hover:border-indigo-500/50 hover:shadow-indigo-500/10',
      iconBg: 'bg-gradient-to-br from-indigo-500 to-blue-600 text-white shadow-indigo-500/25',
      icon: FileClock,
      bullets: [
        isAr ? 'لا تؤثر على الإقرار الضريبي لحين تأكيد التحويل' : 'Zero Tax Liability Until Formally Approved',
        isAr ? 'لا تخصم من كميات المخزون في المستودعات' : 'Does Not Deduct Real-Time Warehouse Inventory',
        isAr ? 'تحويل فوري بنقرة زر إلى فاتورة مبيعات نهائية' : '1-Click Fast Conversion to Official Tax Invoice',
        isAr ? 'مثالية للطلبات المؤكدة والاعتمادات البنكية' : 'Ideal for Advance Deposits & Commercial Approvals',
      ],
      tags: [
        { en: 'Convertible', ar: 'قابلة للتحويل' },
        { en: 'No Tax Impact', ar: 'بدون أثر ضريبي' },
        { en: 'Draft Quote', ar: 'مسودة عرض' },
      ],
    },
  ]

  const secondaryShortcuts = [
    {
      titleEn: 'Credit Note (Return)',
      titleAr: 'إشعار دائن (مرتجع)',
      descEn: 'Issue a credit note against an invoice for customer refunds or returns.',
      descAr: 'إصدار إشعار دائن لمعالجة مرتجعات المبيعات واسترداد المبالغ.',
      icon: RotateCcw,
      route: '/app/dashboard/invoices/new/sell?invoiceType=credit_note',
      color: 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20',
    },
    {
      titleEn: 'Debit Note (Adjustment)',
      titleAr: 'إشعار مدين (تعديل إضافي)',
      descEn: 'Issue a debit note to increase the invoice value or add extra charges.',
      descAr: 'إصدار إشعار مدين لزيادة قيمة الفاتورة أو تطبيق رسوم إضافية.',
      icon: FileText,
      route: '/app/dashboard/invoices/new/sell?invoiceType=debit_note',
      color: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20',
    },
    {
      titleEn: 'Price Quotation',
      titleAr: 'عرض سعر رسمي',
      descEn: 'Create and send branded price quotations with line item proposals.',
      descAr: 'إنشاء عروض أسعار رسمية متكاملة وإرسالها للعملاء للتوقيع.',
      icon: FilePlus2,
      route: '/app/dashboard/quotations/new',
      color: 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-500/10 border-purple-200 dark:border-purple-500/20',
    },
  ]

  return (
    <div className="mx-auto max-w-7xl space-y-8 pb-12">
      {/* Ultra-Premium Hero Header */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-200/90 bg-gradient-to-b from-white to-slate-50/70 p-6 shadow-xs dark:border-white/10 dark:from-[#0c111a] dark:to-[#080d14] sm:p-8">
        {/* Glow ambient background element */}
        <div className="pointer-events-none absolute -end-24 -top-24 h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl dark:bg-emerald-500/15" />
        <div className="pointer-events-none absolute -bottom-24 -start-24 h-72 w-72 rounded-full bg-blue-500/10 blur-3xl dark:bg-blue-500/15" />

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/app/dashboard/invoices')}
                title={isAr ? 'العودة للفواتير' : 'Back to Invoices'}
                className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-2xs transition hover:bg-slate-50 hover:shadow-xs dark:border-white/10 dark:bg-dark-800 dark:text-slate-300 dark:hover:bg-dark-700"
              >
                <ArrowLeft className={`h-4 w-4 ${isAr ? 'rotate-180' : ''}`} />
              </button>

              <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-50/80 px-3 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
                <taxAuthorityBadge.icon className="h-3.5 w-3.5" />
                <span>{taxAuthorityBadge.name}</span>
              </div>
            </div>

            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white sm:text-3xl">
              {isAr ? 'إنشاء فاتورة ومستند مالي جديد' : 'Create New Invoice & Commercial Document'}
            </h1>
            <p className="max-w-2xl text-xs font-medium text-slate-500 dark:text-slate-400 sm:text-sm">
              {isAr
                ? 'اختر نوع الفاتورة المناسب لعمليتك التجارية. يضمن النظام الالتزام الضريبي الكامل، الحساب التلقائي للضريبة، وتحديث الأرصدة والمخازن فورياً.'
                : 'Select the invoice type to initiate. Guaranteed tax compliance, automatic VAT calculation, real-time ledger posting, and warehouse stock synchronization.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              to="/app/dashboard/invoices"
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-2xs transition hover:bg-slate-50 dark:border-white/10 dark:bg-dark-800 dark:text-slate-200 dark:hover:bg-dark-700"
            >
              <FileCheck className="h-4 w-4 text-slate-400" />
              <span>{isAr ? 'سجل الفواتير' : 'View All Invoices'}</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Main 3 Invoicing Cards Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {primaryCards.map((card, index) => {
          const Icon = card.icon
          return (
            <motion.div
              key={card.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.08 }}
              onClick={() => navigate(card.route)}
              className={`group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-slate-200/90 bg-white p-7 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl dark:border-white/10 dark:bg-[#0c111a] cursor-pointer ${card.borderHover}`}
            >
              {/* Subtle top ambient glow inside card */}
              <div
                className={`pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b ${card.gradient} opacity-70 transition-opacity group-hover:opacity-100`}
              />

              <div className="relative space-y-5">
                {/* Header of card: Icon + Badge */}
                <div className="flex items-center justify-between">
                  <div
                    className={`flex h-14 w-14 items-center justify-center rounded-2xl shadow-lg transition-transform duration-300 group-hover:scale-110 ${card.iconBg}`}
                  >
                    <Icon className="h-7 w-7" />
                  </div>

                  <span className="rounded-full border border-slate-200/80 bg-slate-50 px-3 py-1 text-[11px] font-bold text-slate-700 shadow-2xs dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                    {isAr ? card.badgeAr : card.badgeEn}
                  </span>
                </div>

                {/* Title and Description */}
                <div>
                  <h2 className="text-xl font-black text-slate-900 transition-colors group-hover:text-slate-950 dark:text-white dark:group-hover:text-white">
                    {isAr ? card.titleAr : card.titleEn}
                  </h2>
                  <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                    {isAr ? card.descAr : card.descEn}
                  </p>
                </div>

                {/* Feature Bullet Points */}
                <div className="space-y-2 border-t border-slate-100 pt-4 dark:border-white/5">
                  {card.bullets.map((bullet, bIdx) => (
                    <div key={bIdx} className="flex items-start gap-2 text-[11.5px] font-medium text-slate-700 dark:text-slate-300">
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                      <span>{bullet}</span>
                    </div>
                  ))}
                </div>

                {/* Pill Tags */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {card.tags.map((tag, tIdx) => (
                    <span
                      key={tIdx}
                      className="rounded-lg bg-slate-100/90 px-2 py-0.5 text-[10.5px] font-bold text-slate-600 dark:bg-white/[0.06] dark:text-slate-300"
                    >
                      {isAr ? tag.ar : tag.en}
                    </span>
                  ))}
                </div>
              </div>

              {/* Bottom Action Button Trigger */}
              <div className="relative mt-8 pt-4 border-t border-slate-100 dark:border-white/5">
                <div className="flex items-center justify-between rounded-2xl bg-slate-950 px-5 py-3 text-xs font-bold text-white shadow-md transition-all group-hover:bg-emerald-600 dark:bg-white dark:text-slate-950 dark:group-hover:bg-emerald-400 dark:group-hover:text-slate-950">
                  <span>{isAr ? 'ابدأ الإنشاء الآن' : 'Create Document'}</span>
                  <ArrowRight className={`h-4 w-4 transition-transform duration-300 group-hover:translate-x-1 ${isAr ? 'rotate-180 group-hover:-translate-x-1' : ''}`} />
                </div>
              </div>
            </motion.div>
          )
        })}
      </div>

      {/* Secondary Quick Commercial Actions */}
      <div className="space-y-4 pt-2">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              {isAr ? 'مستندات ووثائق تجارية مرافقة' : 'Associated Commercial Documents'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isAr
                ? 'إشعارات التسوية والمرتجعات وتوليد عروض الأسعار التمهيدية'
                : 'Credit/Debit settlement adjustments and quotation proposal creators'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {secondaryShortcuts.map((sec, idx) => {
            const SecIcon = sec.icon
            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 + idx * 0.05 }}
                onClick={() => navigate(sec.route)}
                className="group flex items-start gap-4 rounded-3xl border border-slate-200/90 bg-white p-5 shadow-2xs transition-all hover:border-slate-300 hover:shadow-md dark:border-white/10 dark:bg-[#0c111a] dark:hover:border-white/20 cursor-pointer"
              >
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border transition-transform group-hover:scale-110 ${sec.color}`}>
                  <SecIcon className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white text-xs">
                    <span>{isAr ? sec.titleAr : sec.titleEn}</span>
                    <ArrowUpRight className="h-3.5 w-3.5 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </div>
                  <p className="text-[11.5px] leading-relaxed text-slate-500 dark:text-slate-400">
                    {isAr ? sec.descAr : sec.descEn}
                  </p>
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>

      {/* Trust & Enterprise Compliance Footer Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200/80 bg-slate-50/80 px-6 py-4 dark:border-white/5 dark:bg-white/[0.02]">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <Zap className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
              {isAr ? 'محرك الفوترة الذكي السريع' : 'High-Speed Enterprise Billing Engine'}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {isAr
                ? 'توليد فوري للبيانات، دقة محاسبية 100%، وتشفير آمن للبيانات والمعاملات.'
                : 'Instant data processing, 100% double-entry accuracy, and cryptographically verified tax compliance.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs font-semibold text-slate-600 dark:text-slate-400">
          <span className="flex items-center gap-1.5">
            <Printer className="h-3.5 w-3.5 text-slate-400" />
            {isAr ? 'طباعة حرارية A4/80mm' : 'A4 & 80mm Thermal Print'}
          </span>
          <span className="flex items-center gap-1.5">
            <QrCode className="h-3.5 w-3.5 text-slate-400" />
            {isAr ? 'رمز QR مشفر' : 'Encrypted QR Code'}
          </span>
        </div>
      </div>
    </div>
  )
}
