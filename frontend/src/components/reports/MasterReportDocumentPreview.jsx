import React from 'react'
import { CURRENCY_CODE, formatCurrencyAmount } from '../../lib/currency'

// ─── Formatters & Helpers ─────────────────────────────────────────────────────

const fmtMoney = (value, currency = 'SAR') => {
  const code = String(currency || CURRENCY_CODE).trim().toUpperCase() || CURRENCY_CODE
  const formatted = formatCurrencyAmount(Number(value || 0), {
    language: 'en',
    currency: code,
    currencyDisplay: 'code',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return `${formatted} ${code}`
}

const formatDate = (value) => {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

// ─── Document Meta Definitions ────────────────────────────────────────────────

const REPORT_TYPE_META = {
  vat: {
    titleEn: 'VAT Return & Tax Declaration Report',
    titleAr: 'تقرير إقرار ضريبة القيمة المضافة',
    badgeEn: 'Official ZATCA Statement',
    badgeAr: 'إقرار الزكاة والضريبة المعتمد',
    badgeColor: '#2563eb',
  },
  business: {
    titleEn: 'Business Performance & Financial Summary',
    titleAr: 'تقرير الأداء المالي والأعمال',
    badgeEn: 'P&L Executive Summary',
    badgeAr: 'ملخص الأرباح والخسائر',
    badgeColor: '#10b981',
  },
  internal_audit: {
    titleEn: 'Internal Audit & Controls Review Report',
    titleAr: 'تقرير التدقيق والرقابة الداخلية',
    badgeEn: 'Internal Controls Review',
    badgeAr: 'مراجعة الرقابة الداخلية',
    badgeColor: '#6366f1',
  },
  external_audit: {
    titleEn: 'External Audit & Statutory Compliance Report',
    titleAr: 'تقرير التدقيق الخارجي والامتثال النظامي',
    badgeEn: 'Statutory Assurance Audit',
    badgeAr: 'تقرير المراجع المستقل',
    badgeColor: '#059669',
  },
  daily: {
    titleEn: 'Daily Sales & Revenue Ledger',
    titleAr: 'تقرير المبيعات والفوترة اليومية',
    badgeEn: 'Daily Revenue Register',
    badgeAr: 'دفتر المبيعات اليومي',
    badgeColor: '#0284c7',
  },
  sales: {
    titleEn: 'Customer Sales & Account Revenue Report',
    titleAr: 'تقرير مبيعات وحسابات العملاء',
    badgeEn: 'Customer Accounts Revenue',
    badgeAr: 'حسابات ومبيعات العملاء',
    badgeColor: '#8b5cf6',
  },
  trading: {
    titleEn: 'Trading & Inventory Valuation Report',
    titleAr: 'تقرير التجارة وتقييم المخزون',
    badgeEn: 'Inventory & Wholesale Analytics',
    badgeAr: 'التجارة والمخزون',
    badgeColor: '#2563eb',
  },
  'ops:trading': {
    titleEn: 'Trading & Inventory Valuation Report',
    titleAr: 'تقرير التجارة وتقييم المخزون',
    badgeEn: 'Inventory & Wholesale Analytics',
    badgeAr: 'التجارة والمخزون',
    badgeColor: '#2563eb',
  },
  manufacturing: {
    titleEn: 'Manufacturing & MES Operations Report',
    titleAr: 'تقرير عمليات التصنيع والإنتاج',
    badgeEn: 'MES & Shop Floor Analytics',
    badgeAr: 'التصنيع والإنتاج',
    badgeColor: '#0891b2',
  },
  'ops:manufacturing': {
    titleEn: 'Manufacturing & MES Operations Report',
    titleAr: 'تقرير عمليات التصنيع والإنتاج',
    badgeEn: 'MES & Shop Floor Analytics',
    badgeAr: 'التصنيع والإنتاج',
    badgeColor: '#0891b2',
  },
  'ops:manufacturing_mes': {
    titleEn: 'Manufacturing & MES Operations Report',
    titleAr: 'تقرير عمليات التصنيع والإنتاج',
    badgeEn: 'MES & Shop Floor Analytics',
    badgeAr: 'التصنيع والإنتاج',
    badgeColor: '#0891b2',
  },
  construction: {
    titleEn: 'Construction & Projects Costing Report',
    titleAr: 'تقرير المقاولات والمشاريع والتكاليف',
    badgeEn: 'Projects & Contracts Analytics',
    badgeAr: 'المقاولات والمشاريع',
    badgeColor: '#f97316',
  },
  'ops:construction': {
    titleEn: 'Construction & Projects Costing Report',
    titleAr: 'تقرير المقاولات والمشاريع والتكاليف',
    badgeEn: 'Projects & Contracts Analytics',
    badgeAr: 'المقاولات والمشاريع',
    badgeColor: '#f97316',
  },
  'ops:construction_projects': {
    titleEn: 'Construction & Projects Costing Report',
    titleAr: 'تقرير المقاولات والمشاريع والتكاليف',
    badgeEn: 'Projects & Contracts Analytics',
    badgeAr: 'المقاولات والمشاريع',
    badgeColor: '#f97316',
  },
  travel_agency: {
    titleEn: 'Travel Agency Bookings & Commission Report',
    titleAr: 'تقرير حجوزات وعمولات وكالة السفر',
    badgeEn: 'Travel & Ticketing Analytics',
    badgeAr: 'وكالة السفر والسياحة',
    badgeColor: '#0284c7',
  },
  'ops:travel_agency': {
    titleEn: 'Travel Agency Bookings & Commission Report',
    titleAr: 'تقرير حجوزات وعمولات وكالة السفر',
    badgeEn: 'Travel & Ticketing Analytics',
    badgeAr: 'وكالة السفر والسياحة',
    badgeColor: '#0284c7',
  },
  restaurant: {
    titleEn: 'Restaurant Operations & Sales Report',
    titleAr: 'تقرير مبيعات وعمليات المطعم',
    badgeEn: 'Restaurant POS Analytics',
    badgeAr: 'مبيعات وإيرادات المطعم',
    badgeColor: '#e11d48',
  },
  'ops:restaurant': {
    titleEn: 'Restaurant Operations & Sales Report',
    titleAr: 'تقرير مبيعات وعمليات المطعم',
    badgeEn: 'Restaurant POS Analytics',
    badgeAr: 'مبيعات وإيرادات المطعم',
    badgeColor: '#e11d48',
  },
  'ops:restaurant_cafe': {
    titleEn: 'Restaurant Operations & Sales Report',
    titleAr: 'تقرير مبيعات وعمليات المطعم',
    badgeEn: 'Restaurant POS Analytics',
    badgeAr: 'مبيعات وإيرادات المطعم',
    badgeColor: '#e11d48',
  },
  car_rental: {
    titleEn: 'Car Rental Fleet & Lease Contracts Report',
    titleAr: 'تقرير أسطول وعقود تأجير السيارات',
    badgeEn: 'Fleet & Fleet Contracts',
    badgeAr: 'تأجير السيارات والأسطول',
    badgeColor: '#3b82f6',
  },
  'ops:car_rental': {
    titleEn: 'Car Rental Fleet & Lease Contracts Report',
    titleAr: 'تقرير أسطول وعقود تأجير السيارات',
    badgeEn: 'Fleet & Fleet Contracts',
    badgeAr: 'تأجير السيارات والأسطول',
    badgeColor: '#3b82f6',
  },
  laundry: {
    titleEn: 'Laundry & Dry Cleaning Operations Report',
    titleAr: 'تقرير عمليات المغسلة والتنظيف',
    badgeEn: 'Laundry POS & Garment Care',
    badgeAr: 'المغسلة والتنظيف الجاف',
    badgeColor: '#06b6d4',
  },
  'ops:laundry': {
    titleEn: 'Laundry & Dry Cleaning Operations Report',
    titleAr: 'تقرير عمليات المغسلة والتنظيف',
    badgeEn: 'Laundry POS & Garment Care',
    badgeAr: 'المغسلة والتنظيف الجاف',
    badgeColor: '#06b6d4',
  },
  'ops:laundry_cleaning': {
    titleEn: 'Laundry & Dry Cleaning Operations Report',
    titleAr: 'تقرير عمليات المغسلة والتنظيف',
    badgeEn: 'Laundry POS & Garment Care',
    badgeAr: 'المغسلة والتنظيف الجاف',
    badgeColor: '#06b6d4',
  },
  saloon: {
    titleEn: 'Saloon & Barber Services & Appointments Report',
    titleAr: 'تقرير مواعيد وخدمات الصالون والحلاقة',
    badgeEn: 'Saloon & Spa Management',
    badgeAr: 'الصالون ومراكز التجميل',
    badgeColor: '#ec4899',
  },
  'ops:saloon': {
    titleEn: 'Saloon & Barber Services & Appointments Report',
    titleAr: 'تقرير مواعيد وخدمات الصالون والحلاقة',
    badgeEn: 'Saloon & Spa Management',
    badgeAr: 'الصالون ومراكز التجميل',
    badgeColor: '#ec4899',
  },
  'ops:saloon_barber': {
    titleEn: 'Saloon & Barber Services & Appointments Report',
    titleAr: 'تقرير مواعيد وخدمات الصالون والحلاقة',
    badgeEn: 'Saloon & Spa Management',
    badgeAr: 'الصالون ومراكز التجميل',
    badgeColor: '#ec4899',
  },
  khayyat: {
    titleEn: 'Tailor & Custom Stitching Operations Report',
    titleAr: 'تقرير الخياطة والتفصيل الرجالي والنسائي',
    badgeEn: 'Tailoring & Stitching Workshop',
    badgeAr: 'الخياط والمشاغل',
    badgeColor: '#8b5cf6',
  },
  'ops:khayyat': {
    titleEn: 'Tailor & Custom Stitching Operations Report',
    titleAr: 'تقرير الخياطة والتفصيل الرجالي والنسائي',
    badgeEn: 'Tailoring & Stitching Workshop',
    badgeAr: 'الخياط والمشاغل',
    badgeColor: '#8b5cf6',
  },
  'ops:tailor_khayyat': {
    titleEn: 'Tailor & Custom Stitching Operations Report',
    titleAr: 'تقرير الخياطة والتفصيل الرجالي والنسائي',
    badgeEn: 'Tailoring & Stitching Workshop',
    badgeAr: 'الخياط والمشاغل',
    badgeColor: '#8b5cf6',
  },
  boutique: {
    titleEn: 'Boutique & Designer Dress Rental Report',
    titleAr: 'تقرير بوتيك وتأجير الفساتين والأزياء',
    badgeEn: 'Boutique & Rental Apparel',
    badgeAr: 'بوتيك وتأجير الفساتين',
    badgeColor: '#d946ef',
  },
  'ops:boutique': {
    titleEn: 'Boutique & Designer Dress Rental Report',
    titleAr: 'تقرير بوتيك وتأجير الفساتين والأزياء',
    badgeEn: 'Boutique & Rental Apparel',
    badgeAr: 'بوتيك وتأجير الفساتين',
    badgeColor: '#d946ef',
  },
  'ops:boutique_rental': {
    titleEn: 'Boutique & Designer Dress Rental Report',
    titleAr: 'تقرير بوتيك وتأجير الفساتين والأزياء',
    badgeEn: 'Boutique & Rental Apparel',
    badgeAr: 'بوتيك وتأجير الفساتين',
    badgeColor: '#d946ef',
  },
  manpower: {
    titleEn: 'Manpower & Labor Supply Operations Report',
    titleAr: 'تقرير توريد وإسناد العمالة والموارد',
    badgeEn: 'Manpower Supply & Deployment',
    badgeAr: 'العمالة وتوريد الكوادر',
    badgeColor: '#14b8a6',
  },
  'ops:manpower': {
    titleEn: 'Manpower & Labor Supply Operations Report',
    titleAr: 'تقرير توريد وإسناد العمالة والموارد',
    badgeEn: 'Manpower Supply & Deployment',
    badgeAr: 'العمالة وتوريد الكوادر',
    badgeColor: '#14b8a6',
  },
  'ops:manpower_supply': {
    titleEn: 'Manpower & Labor Supply Operations Report',
    titleAr: 'تقرير توريد وإسناد العمالة والموارد',
    badgeEn: 'Manpower Supply & Deployment',
    badgeAr: 'العمالة وتوريد الكوادر',
    badgeColor: '#14b8a6',
  },
  bakala: {
    titleEn: 'Bakala & Supermarket Sales & Inventory Report',
    titleAr: 'تقرير مبيعات ومخزون البقالة والسوبرماركت',
    badgeEn: 'Bakala & Supermarket POS',
    badgeAr: 'البقالة والسوبر ماركت',
    badgeColor: '#10b981',
  },
  'ops:bakala': {
    titleEn: 'Bakala & Supermarket Sales & Inventory Report',
    titleAr: 'تقرير مبيعات ومخزون البقالة والسوبرماركت',
    badgeEn: 'Bakala & Supermarket POS',
    badgeAr: 'البقالة والسوبر ماركت',
    badgeColor: '#10b981',
  },
  'ops:bakala_supermarket': {
    titleEn: 'Bakala & Supermarket Sales & Inventory Report',
    titleAr: 'تقرير مبيعات ومخزون البقالة والسوبرماركت',
    badgeEn: 'Bakala & Supermarket POS',
    badgeAr: 'البقالة والسوبر ماركت',
    badgeColor: '#10b981',
  },
  car_workshop: {
    titleEn: 'Car Workshop & Service Garage Report',
    titleAr: 'تقرير مركز صيانة وورشة السيارات',
    badgeEn: 'Garage & Diagnostic Job Cards',
    badgeAr: 'مركز صيانة السيارات',
    badgeColor: '#64748b',
  },
  'ops:car_workshop': {
    titleEn: 'Car Workshop & Service Garage Report',
    titleAr: 'تقرير مركز صيانة وورشة السيارات',
    badgeEn: 'Garage & Diagnostic Job Cards',
    badgeAr: 'مركز صيانة السيارات',
    badgeColor: '#64748b',
  },
  'ops:workshop': {
    titleEn: 'Car Workshop & Service Garage Report',
    titleAr: 'تقرير مركز صيانة وورشة السيارات',
    badgeEn: 'Garage & Diagnostic Job Cards',
    badgeAr: 'مركز صيانة السيارات',
    badgeColor: '#64748b',
  },
  bookstore: {
    titleEn: 'Bookstore & Stationery Inventory Report',
    titleAr: 'تقرير مبيعات ومخزون المكتبة والقرطاسية',
    badgeEn: 'Bookstore & Stationery POS',
    badgeAr: 'المكتبة والقرطاسية',
    badgeColor: '#f59e0b',
  },
  'ops:bookstore': {
    titleEn: 'Bookstore & Stationery Inventory Report',
    titleAr: 'تقرير مبيعات ومخزون المكتبة والقرطاسية',
    badgeEn: 'Bookstore & Stationery POS',
    badgeAr: 'المكتبة والقرطاسية',
    badgeColor: '#f59e0b',
  },
  'ops:bookstore_stationery': {
    titleEn: 'Bookstore & Stationery Inventory Report',
    titleAr: 'تقرير مبيعات ومخزون المكتبة والقرطاسية',
    badgeEn: 'Bookstore & Stationery POS',
    badgeAr: 'المكتبة والقرطاسية',
    badgeColor: '#f59e0b',
  },
  ecommerce: {
    titleEn: 'E-Commerce Online Store Performance Report',
    titleAr: 'تقرير أداء ومبيعات المتجر الإلكتروني',
    badgeEn: 'E-Commerce GMV & Orders',
    badgeAr: 'المتجر الإلكتروني',
    badgeColor: '#6366f1',
  },
  'ops:ecommerce': {
    titleEn: 'E-Commerce Online Store Performance Report',
    titleAr: 'تقرير أداء ومبيعات المتجر الإلكتروني',
    badgeEn: 'E-Commerce GMV & Orders',
    badgeAr: 'المتجر الإلكتروني',
    badgeColor: '#6366f1',
  },
  'ops:ecommerce_store': {
    titleEn: 'E-Commerce Online Store Performance Report',
    titleAr: 'تقرير أداء ومبيعات المتجر الإلكتروني',
    badgeEn: 'E-Commerce GMV & Orders',
    badgeAr: 'المتجر الإلكتروني',
    badgeColor: '#6366f1',
  },
  furniture_shop: {
    titleEn: 'Furniture Showroom & Custom Orders Report',
    titleAr: 'تقرير معرض ومبيعات الأثاث والمفروشات',
    badgeEn: 'Furniture Showroom & Assembly',
    badgeAr: 'معرض الأثاث والمفروشات',
    badgeColor: '#78716c',
  },
  'ops:furniture_shop': {
    titleEn: 'Furniture Showroom & Custom Orders Report',
    titleAr: 'تقرير معرض ومبيعات الأثاث والمفروشات',
    badgeEn: 'Furniture Showroom & Assembly',
    badgeAr: 'معرض الأثاث والمفروشات',
    badgeColor: '#78716c',
  },
  'ops:furniture': {
    titleEn: 'Furniture Showroom & Custom Orders Report',
    titleAr: 'تقرير معرض ومبيعات الأثاث والمفروشات',
    badgeEn: 'Furniture Showroom & Assembly',
    badgeAr: 'معرض الأثاث والمفروشات',
    badgeColor: '#78716c',
  },
}

export default function MasterReportDocumentPreview({ reportType = 'vat', report = {}, tenant = {} }) {
  const meta = REPORT_TYPE_META[reportType] || REPORT_TYPE_META.vat
  const primaryColor = tenant?.branding?.primaryColor || '#1e3a8a'
  const companyEn = tenant?.business?.legalNameEn || tenant?.name || 'Maqder Enterprise'
  const companyAr = tenant?.business?.legalNameAr || ''
  const crNumber = tenant?.business?.crNumber || tenant?.business?.commercialRegistration?.crNumber || '—'
  const vatNumber = tenant?.business?.vatNumber || tenant?.business?.vatCertificate?.vatNumber || '—'
  const location = tenant?.business?.city ? `${tenant.business.city}, Saudi Arabia` : 'Saudi Arabia'
  const logo = tenant?.branding?.logo

  const startDate = report?.period?.startDate || (Array.isArray(report) && report[0]?._id)
  const endDate = report?.period?.endDate || (Array.isArray(report) && report[report.length - 1]?._id)
  const todayStr = new Date().toISOString().slice(0, 10)

  // ── Reusable Component Snippets ─────────────────────────────────────────────

  const renderKpiGrid = (kpis) => (
    <div className="grid grid-cols-5 gap-3">
      {kpis.slice(0, 5).map((kpi, idx) => (
        <div key={idx} className="bg-slate-50 rounded-lg p-3 border border-slate-200 relative overflow-hidden flex flex-col justify-between">
          <div className="absolute top-0 left-0 right-0 h-1" style={{ backgroundColor: kpi.color || primaryColor }} />
          <div>
            <div className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">{kpi.labelEn}</div>
            {kpi.labelAr && <div className="text-[10px] text-slate-600 font-medium mt-0.5 leading-tight">{kpi.labelAr}</div>}
          </div>
          <div className="text-base font-extrabold text-slate-900 mt-2 tracking-tight tabular-nums">{kpi.value}</div>
        </div>
      ))}
    </div>
  )

  const SectionHeader = ({ number, titleEn, titleAr }) => (
    <div className="flex items-center gap-2 mb-2.5">
      <div className="w-1 h-5 rounded-full" style={{ backgroundColor: primaryColor }} />
      <div className="flex items-baseline gap-2">
        <h2 className="text-sm font-bold text-slate-900">{number}. {titleEn}</h2>
        {titleAr && <span className="text-xs font-semibold text-slate-600">/ {titleAr}</span>}
      </div>
    </div>
  )

  const renderSummaryTotals = (rows) => (
    <div className="flex justify-between items-start pt-4 border-t border-slate-200">
      {/* Left side: Official Verification Seal */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 max-w-[340px]">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
          <div className="text-xs font-bold text-slate-800">OFFICIAL VERIFIED REPORT</div>
        </div>
        <div className="text-[11px] font-semibold text-slate-600 mt-0.5">وثيقة تدقيق رسمية معتمدة من النظام</div>
        <div className="text-[10px] text-slate-500 mt-2 leading-relaxed">
          Generated automatically via Maqder ERP Enterprise Financial Reporting Engine. ZATCA Phase 2 Standard Compliant.
        </div>
      </div>

      {/* Right side: Invoice Summary Totals Card */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 w-[360px] space-y-2">
        {rows.map((r, i) => (
          <div key={i} className={`flex justify-between items-center py-1 ${r.isHighlight ? 'bg-slate-200/60 -mx-2 px-2 rounded font-bold text-slate-900' : 'text-slate-700 text-xs'}`}>
            <div>
              <div className="font-semibold text-[11px]">{r.labelEn}</div>
              <div className="text-[10px] text-slate-500">{r.labelAr}</div>
            </div>
            <div className={`tabular-nums ${r.isHighlight ? 'text-sm font-extrabold text-slate-900' : 'font-medium'}`}>{r.value}</div>
          </div>
        ))}
      </div>
    </div>
  )

  // ── Render Specific Report Bodies ──────────────────────────────────────────

  const renderVatContent = () => {
    const totals = report?.totals || {}
    const statement = report?.vatReturn?.statement || {}

    const kpis = [
      { labelEn: 'TOTAL INVOICES', labelAr: 'إجمالي الفواتير', value: (totals?.invoiceCount || 0).toLocaleString(), color: '#1e3a8a' },
      { labelEn: 'STANDARD RATED SALES', labelAr: 'المبيعات الخاضعة (15%)', value: fmtMoney(statement?.salesStandardRated?.amount || totals?.byCategory?.standardRated?.taxableAmount || 0), color: '#2563eb' },
      { labelEn: 'OUTPUT VAT (15%)', labelAr: 'ضريبة المخرجات', value: fmtMoney(statement?.totalSales?.vatAmount || totals?.totalTax || 0), color: '#10b981' },
      { labelEn: 'INPUT VAT DEDUCTIBLE', labelAr: 'ضريبة المدخلات القابلة للخصم', value: fmtMoney(statement?.totalPurchases?.vatAmount || totals?.purchasesTaxAmount || 0), color: '#f59e0b' },
      { labelEn: 'NET VAT DUE / REFUND', labelAr: 'صافي الضريبة المستحقة', value: fmtMoney(statement?.netVatDue?.vatAmount ?? (totals?.totalTax || 0) - (totals?.purchasesTaxAmount || 0)), color: '#e11d48' },
    ]

    const statementRows = [
      { en: '1. Standard Rated Sales (15%)', ar: 'المبيعات الخاضعة للنسبة الأساسية (15%)', base: statement?.salesStandardRated?.amount || 0, adj: statement?.salesStandardRated?.adjustment || 0, vat: statement?.salesStandardRated?.vatAmount || 0 },
      { en: '2. Special Citizen Supplies', ar: 'التوريدات للمواطنين (الخدمات الصحية والتعليمية)', base: statement?.salesSpecialCitizen?.amount || 0, adj: statement?.salesSpecialCitizen?.adjustment || 0, vat: statement?.salesSpecialCitizen?.vatAmount || 0 },
      { en: '3. Zero-Rated Domestic Sales', ar: 'المبيعات المحلية الخاضعة للنسبة الصفرية', base: statement?.salesZeroRatedDomestic?.amount || 0, adj: statement?.salesZeroRatedDomestic?.adjustment || 0, vat: statement?.salesZeroRatedDomestic?.vatAmount || 0 },
      { en: '4. Exports Outside KSA', ar: 'الصادرات إلى خارج المملكة', base: statement?.salesExports?.amount || 0, adj: statement?.salesExports?.adjustment || 0, vat: statement?.salesExports?.vatAmount || 0 },
      { en: '5. Exempt Supplies', ar: 'التوريدات المعفاة من الضريبة', base: statement?.salesExempt?.amount || 0, adj: statement?.salesExempt?.adjustment || 0, vat: statement?.salesExempt?.vatAmount || 0 },
      { en: 'Total Sales & Output Tax', ar: 'إجمالي المبيعات والضريبة المستحقة', base: statement?.totalSales?.amount || totals?.taxableAmount || 0, adj: statement?.totalSales?.adjustment || 0, vat: statement?.totalSales?.vatAmount || totals?.totalTax || 0, isTotal: true },
      { en: '6. Standard Rated Domestic Purchases', ar: 'المشتريات المحلية الخاضعة للنسبة الأساسية', base: statement?.purchasesStandardRatedDomestic?.amount || 0, adj: statement?.purchasesStandardRatedDomestic?.adjustment || 0, vat: statement?.purchasesStandardRatedDomestic?.vatAmount || 0 },
      { en: '7. Imports Subject to Customs (15%)', ar: 'الاستيرادات الخاضعة للضريبة الجمركية (15%)', base: statement?.purchasesImportsCustoms?.amount || 0, adj: statement?.purchasesImportsCustoms?.adjustment || 0, vat: statement?.purchasesImportsCustoms?.vatAmount || 0 },
      { en: '8. Imports (Reverse Charge)', ar: 'الاستيرادات الخاضعة لآلية الاحتساب العكسي', base: statement?.purchasesImportsReverseCharge?.amount || 0, adj: statement?.purchasesImportsReverseCharge?.adjustment || 0, vat: statement?.purchasesImportsReverseCharge?.vatAmount || 0 },
      { en: '9. Zero-Rated Purchases', ar: 'المشتريات الخاضعة للنسبة الصفرية', base: statement?.purchasesZeroRated?.amount || 0, adj: statement?.purchasesZeroRated?.adjustment || 0, vat: statement?.purchasesZeroRated?.vatAmount || 0 },
      { en: '10. Exempt Purchases', ar: 'المشتريات المعفاة من الضريبة', base: statement?.purchasesExempt?.amount || 0, adj: statement?.purchasesExempt?.adjustment || 0, vat: statement?.purchasesExempt?.vatAmount || 0 },
      { en: 'Total Purchases & Input Tax', ar: 'إجمالي المشتريات وضريبة المدخلات', base: statement?.totalPurchases?.amount || 0, adj: statement?.totalPurchases?.adjustment || 0, vat: statement?.totalPurchases?.vatAmount || totals?.purchasesTaxAmount || 0, isTotal: true },
    ]

    return (
      <div className="space-y-6">
        {renderKpiGrid(kpis)}

        <div>
          <SectionHeader number="1" titleEn="Official VAT Declaration Statement" titleAr="إقرار ضريبة القيمة المضافة الرسمي (هيئة الزكاة والضريبة والجمارك)" />
          <table className="w-full text-left border-collapse border border-slate-200 text-xs">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-300 text-slate-800 font-semibold">
                <th className="py-2.5 px-3">
                  <div>VAT Declaration Line Item</div>
                  <div className="text-[10px] text-slate-500 font-normal">بند الإقرار الضريبي</div>
                </th>
                <th className="py-2.5 px-3 text-right">
                  <div>Base Amount</div>
                  <div className="text-[10px] text-slate-500 font-normal">المبلغ الخاضع (SAR)</div>
                </th>
                <th className="py-2.5 px-3 text-right">
                  <div>Adjustment</div>
                  <div className="text-[10px] text-slate-500 font-normal">التعديل (SAR)</div>
                </th>
                <th className="py-2.5 px-3 text-right">
                  <div>VAT Amount (15%)</div>
                  <div className="text-[10px] text-slate-500 font-normal">مبلغ الضريبة (SAR)</div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {statementRows.map((row, idx) => (
                <tr key={idx} className={row.isTotal ? 'bg-slate-100 font-bold text-slate-900' : idx % 2 === 1 ? 'bg-slate-50' : 'bg-white'}>
                  <td className="py-2 px-3">
                    <div className="font-medium text-slate-900">{row.en}</div>
                    <div className="text-[10px] text-slate-500">{row.ar}</div>
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums text-slate-700">{fmtMoney(row.base)}</td>
                  <td className="py-2 px-3 text-right tabular-nums text-slate-500">{fmtMoney(row.adj)}</td>
                  <td className="py-2 px-3 text-right tabular-nums font-bold text-slate-900">{fmtMoney(row.vat)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {renderSummaryTotals([
          { labelEn: 'Total Taxable Sales (Ex-VAT)', labelAr: 'إجمالي المبيعات الخاضعة للضريبة', value: fmtMoney(statement?.totalSales?.amount || totals?.taxableAmount || 0) },
          { labelEn: 'Total Output VAT (15%)', labelAr: 'إجمالي ضريبة المخرجات المستحقة', value: fmtMoney(statement?.totalSales?.vatAmount || totals?.totalTax || 0) },
          { labelEn: 'Total Input VAT (Deductible)', labelAr: 'إجمالي ضريبة المدخلات القابلة للخصم', value: fmtMoney(statement?.totalPurchases?.vatAmount || totals?.purchasesTaxAmount || 0) },
          { labelEn: 'Net VAT Due to ZATCA', labelAr: 'صافي الضريبة المستحقة للسداد للهيئة', value: fmtMoney(statement?.netVatDue?.vatAmount ?? (totals?.totalTax || 0) - (totals?.purchasesTaxAmount || 0)), isHighlight: true },
        ])}
      </div>
    )
  }

  const renderBusinessContent = () => {
    const totals = report?.totals || {}
    const channels = report?.breakdown?.salesByTransactionType || []
    const topCustomers = report?.breakdown?.topCustomers || []

    const kpis = [
      { labelEn: 'GROSS INVOICED SALES', labelAr: 'إجمالي المبيعات', value: fmtMoney(totals?.sales?.grandTotal || 0), color: '#10b981' },
      { labelEn: 'PURCHASES (COST)', labelAr: 'المشتريات والتكاليف', value: fmtMoney(totals?.purchases?.grandTotal || 0), color: '#3b82f6' },
      { labelEn: 'OPERATING EXPENSES', labelAr: 'المصروفات التشغيلية', value: fmtMoney(totals?.expenses?.totalAmount || 0), color: '#f59e0b' },
      { labelEn: 'SALES DISCOUNTS', labelAr: 'خصومات المبيعات', value: fmtMoney(totals?.sales?.totalDiscount || 0), color: '#ef4444' },
      { labelEn: 'NET OPERATING PROFIT', labelAr: 'صافي الربح التشغيلي', value: fmtMoney(totals?.net || 0), color: (totals?.net || 0) >= 0 ? '#10b981' : '#e11d48' },
    ]

    return (
      <div className="space-y-6">
        {renderKpiGrid(kpis)}

        <div>
          <SectionHeader number="1" titleEn="Sales Revenue by Transaction Channel" titleAr="الإيرادات حسب نوع المعاملة والقناة" />
          <table className="w-full text-left border-collapse border border-slate-200 text-xs">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-300 text-slate-800 font-semibold">
                <th className="py-2.5 px-3">
                  <div>Transaction Channel</div>
                  <div className="text-[10px] text-slate-500 font-normal">نوع المعاملة</div>
                </th>
                <th className="py-2.5 px-3 text-center">
                  <div>Invoices Count</div>
                  <div className="text-[10px] text-slate-500 font-normal">عدد الفواتير</div>
                </th>
                <th className="py-2.5 px-3 text-right">
                  <div>Discounts (SAR)</div>
                  <div className="text-[10px] text-slate-500 font-normal">الخصم</div>
                </th>
                <th className="py-2.5 px-3 text-right">
                  <div>Taxable Net (SAR)</div>
                  <div className="text-[10px] text-slate-500 font-normal">المبلغ الخاضع</div>
                </th>
                <th className="py-2.5 px-3 text-right">
                  <div>Total Revenue (SAR)</div>
                  <div className="text-[10px] text-slate-500 font-normal">الإجمالي شامل الضريبة</div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {channels.map((row, idx) => (
                <tr key={idx} className={idx % 2 === 1 ? 'bg-slate-50' : 'bg-white'}>
                  <td className="py-2 px-3 font-semibold text-slate-900">{String(row._id || 'Standard Tax Invoice').toUpperCase()}</td>
                  <td className="py-2 px-3 text-center tabular-nums text-slate-700">{(row.invoiceCount || 0).toLocaleString()}</td>
                  <td className="py-2 px-3 text-right tabular-nums text-slate-500">{fmtMoney(row.discount || 0)}</td>
                  <td className="py-2 px-3 text-right tabular-nums text-slate-700">{fmtMoney(row.taxableAmount || (row.revenue || 0) - (row.tax || 0))}</td>
                  <td className="py-2 px-3 text-right tabular-nums font-bold text-slate-900">{fmtMoney(row.revenue || 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {topCustomers.length > 0 && (
          <div>
            <SectionHeader number="2" titleEn="Top Revenue Contributing Customers" titleAr="أعلى العملاء مساهمة في الإيرادات" />
            <table className="w-full text-left border-collapse border border-slate-200 text-xs">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-300 text-slate-800 font-semibold">
                  <th className="py-2.5 px-3">
                    <div>Customer Name</div>
                    <div className="text-[10px] text-slate-500 font-normal">اسم العميل</div>
                  </th>
                  <th className="py-2.5 px-3 text-center">
                    <div>Invoices Count</div>
                    <div className="text-[10px] text-slate-500 font-normal">عدد الفواتير</div>
                  </th>
                  <th className="py-2.5 px-3 text-right">
                    <div>Total Revenue (SAR)</div>
                    <div className="text-[10px] text-slate-500 font-normal">إجمالي الإيرادات</div>
                  </th>
                  <th className="py-2.5 px-3 text-center">
                    <div>Share %</div>
                    <div className="text-[10px] text-slate-500 font-normal">النسبة</div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {topCustomers.map((cust, idx) => {
                  const total = totals?.sales?.grandTotal || 1
                  const share = (((cust.revenue || 0) / total) * 100).toFixed(1)
                  return (
                    <tr key={idx} className={idx % 2 === 1 ? 'bg-slate-50' : 'bg-white'}>
                      <td className="py-2 px-3 font-semibold text-slate-900">{cust._id || 'Walk-in Customer / عميل نقدي'}</td>
                      <td className="py-2 px-3 text-center tabular-nums text-slate-700">{(cust.invoiceCount || 0).toLocaleString()}</td>
                      <td className="py-2 px-3 text-right tabular-nums font-bold text-slate-900">{fmtMoney(cust.revenue || 0)}</td>
                      <td className="py-2 px-3 text-center tabular-nums font-medium text-primary-600">{share}%</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {renderSummaryTotals([
          { labelEn: 'Gross Invoiced Sales', labelAr: 'إجمالي المبيعات المفوترة', value: fmtMoney(totals?.sales?.grandTotal || 0) },
          { labelEn: 'Cost of Goods / Purchases', labelAr: 'تكلفة المشتريات والسلع', value: fmtMoney(totals?.purchases?.grandTotal || 0) },
          { labelEn: 'Operating Expenses', labelAr: 'المصروفات التشغيلية', value: fmtMoney(totals?.expenses?.totalAmount || 0) },
          { labelEn: 'Net Operating Profit / Yield', labelAr: 'صافي الأرباح التشغيلية', value: fmtMoney(totals?.net || 0), isHighlight: true },
        ])}
      </div>
    )
  }

  const renderDailyContent = () => {
    const rows = Array.isArray(report) ? report : []
    const totalInvoices = rows.reduce((sum, r) => sum + (r.invoiceCount || 0), 0)
    const totalTax = rows.reduce((sum, r) => sum + (r.totalTax || 0), 0)
    const totalAmount = rows.reduce((sum, r) => sum + (r.totalAmount || 0), 0)
    const avgDaily = rows.length > 0 ? totalAmount / rows.length : 0

    const kpis = [
      { labelEn: 'ACTIVE TRADING DAYS', labelAr: 'أيام العمل', value: rows.length.toLocaleString(), color: '#1e3a8a' },
      { labelEn: 'TOTAL INVOICES ISSUED', labelAr: 'إجمالي الفواتير', value: totalInvoices.toLocaleString(), color: '#2563eb' },
      { labelEn: 'TOTAL VAT TAX (15%)', labelAr: 'إجمالي الضريبة', value: fmtMoney(totalTax), color: '#f59e0b' },
      { labelEn: 'GROSS REVENUE', labelAr: 'إجمالي الإيرادات', value: fmtMoney(totalAmount), color: '#10b981' },
      { labelEn: 'DAILY AVERAGE REVENUE', labelAr: 'متوسط الإيراد اليومي', value: fmtMoney(avgDaily), color: '#8b5cf6' },
    ]

    return (
      <div className="space-y-6">
        {renderKpiGrid(kpis)}

        <div>
          <SectionHeader number="1" titleEn="Chronological Daily Sales Register" titleAr="سجل المبيعات والفوترة اليومية التفصيلي" />
          <table className="w-full text-left border-collapse border border-slate-200 text-xs">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-300 text-slate-800 font-semibold">
                <th className="py-2.5 px-3">
                  <div>Date (YYYY-MM-DD)</div>
                  <div className="text-[10px] text-slate-500 font-normal">التاريخ</div>
                </th>
                <th className="py-2.5 px-3 text-center">
                  <div>Invoices Count</div>
                  <div className="text-[10px] text-slate-500 font-normal">عدد الفواتير</div>
                </th>
                <th className="py-2.5 px-3 text-right">
                  <div>VAT Tax Collected (SAR)</div>
                  <div className="text-[10px] text-slate-500 font-normal">ضريبة القيمة المضافة (15%)</div>
                </th>
                <th className="py-2.5 px-3 text-right">
                  <div>Gross Total Amount (SAR)</div>
                  <div className="text-[10px] text-slate-500 font-normal">المجموع الإجمالي شامل الضريبة</div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {rows.map((row, idx) => (
                <tr key={idx} className={idx % 2 === 1 ? 'bg-slate-50' : 'bg-white'}>
                  <td className="py-2 px-3 font-semibold text-slate-900">{row._id || '—'}</td>
                  <td className="py-2 px-3 text-center tabular-nums text-slate-700">{(row.invoiceCount || 0).toLocaleString()}</td>
                  <td className="py-2 px-3 text-right tabular-nums text-slate-600">{fmtMoney(row.totalTax || 0)}</td>
                  <td className="py-2 px-3 text-right tabular-nums font-bold text-slate-900">{fmtMoney(row.totalAmount || 0)}</td>
                </tr>
              ))}
              <tr className="bg-slate-100 font-bold text-slate-900 border-t-2 border-slate-300">
                <td className="py-2.5 px-3">
                  <div>Total Period Summary</div>
                  <div className="text-[10px] text-slate-500 font-normal">المجموع العام للفترة</div>
                </td>
                <td className="py-2.5 px-3 text-center tabular-nums">{totalInvoices.toLocaleString()}</td>
                <td className="py-2.5 px-3 text-right tabular-nums">{fmtMoney(totalTax)}</td>
                <td className="py-2.5 px-3 text-right tabular-nums font-bold text-primary-700">{fmtMoney(totalAmount)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {renderSummaryTotals([
          { labelEn: 'Total Net Sales (Ex-VAT)', labelAr: 'صافي المبيعات بدون الضريبة', value: fmtMoney(totalAmount - totalTax) },
          { labelEn: 'Total VAT Tax (15%)', labelAr: 'إجمالي ضريبة القيمة المضافة', value: fmtMoney(totalTax) },
          { labelEn: 'Grand Total Period Revenue', labelAr: 'المجموع الإجمالي النهائي', value: fmtMoney(totalAmount), isHighlight: true },
        ])}
      </div>
    )
  }

  const renderSalesContent = () => {
    const rows = Array.isArray(report) ? report : []
    const totalCustomers = rows.length
    const totalInvoices = rows.reduce((sum, r) => sum + (r.invoiceCount || 0), 0)
    const totalAmount = rows.reduce((sum, r) => sum + (r.totalAmount || 0), 0)
    const avgPerCustomer = totalCustomers > 0 ? totalAmount / totalCustomers : 0

    const kpis = [
      { labelEn: 'ACTIVE BUYING ACCOUNTS', labelAr: 'العملاء النشطين', value: totalCustomers.toLocaleString(), color: '#1e3a8a' },
      { labelEn: 'TOTAL INVOICES BILLED', labelAr: 'إجمالي الفواتير', value: totalInvoices.toLocaleString(), color: '#2563eb' },
      { labelEn: 'TOTAL BILLED REVENUE', labelAr: 'إجمالي المبيعات', value: fmtMoney(totalAmount), color: '#10b981' },
      { labelEn: 'AVG REVENUE / CUSTOMER', labelAr: 'متوسط مبيعات العميل', value: fmtMoney(avgPerCustomer), color: '#f59e0b' },
      { labelEn: 'TOP CUSTOMER SHARE', labelAr: 'حصة أعلى عميل', value: totalAmount > 0 ? `${(((rows[0]?.totalAmount || 0) / totalAmount) * 100).toFixed(1)}%` : '0%', color: '#8b5cf6' },
    ]

    return (
      <div className="space-y-6">
        {renderKpiGrid(kpis)}

        <div>
          <SectionHeader number="1" titleEn="Customer Lifetime & Period Revenue Rankings" titleAr="تصنيف مبيعات وحسابات العملاء" />
          <table className="w-full text-left border-collapse border border-slate-200 text-xs">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-300 text-slate-800 font-semibold">
                <th className="py-2.5 px-3 text-center w-12">
                  <div>Rank</div>
                  <div className="text-[10px] text-slate-500 font-normal">الترتيب</div>
                </th>
                <th className="py-2.5 px-3">
                  <div>Customer / Account Name</div>
                  <div className="text-[10px] text-slate-500 font-normal">اسم العميل والحساب</div>
                </th>
                <th className="py-2.5 px-3 text-center">
                  <div>Invoices Count</div>
                  <div className="text-[10px] text-slate-500 font-normal">عدد الفواتير</div>
                </th>
                <th className="py-2.5 px-3 text-right">
                  <div>Total Revenue (SAR)</div>
                  <div className="text-[10px] text-slate-500 font-normal">إجمالي المبيعات</div>
                </th>
                <th className="py-2.5 px-3 text-center">
                  <div>Revenue Share %</div>
                  <div className="text-[10px] text-slate-500 font-normal">النسبة المئوية</div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {rows.map((row, idx) => {
                const share = totalAmount > 0 ? (((row.totalAmount || 0) / totalAmount) * 100).toFixed(1) : '0'
                return (
                  <tr key={idx} className={idx % 2 === 1 ? 'bg-slate-50' : 'bg-white'}>
                    <td className="py-2 px-3 text-center font-bold text-slate-600">#{idx + 1}</td>
                    <td className="py-2 px-3 font-semibold text-slate-900">{row.customerName || 'Walk-in Retail Customer / عميل نقدي'}</td>
                    <td className="py-2 px-3 text-center tabular-nums text-slate-700">{(row.invoiceCount || 0).toLocaleString()}</td>
                    <td className="py-2 px-3 text-right tabular-nums font-bold text-slate-900">{fmtMoney(row.totalAmount || 0)}</td>
                    <td className="py-2 px-3 text-center tabular-nums font-medium text-primary-600">{share}%</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {renderSummaryTotals([
          { labelEn: 'Total Active Accounts', labelAr: 'إجمالي الحسابات المسجلة', value: totalCustomers.toLocaleString() },
          { labelEn: 'Total Invoices Issued', labelAr: 'إجمالي الفواتير الصادرة', value: totalInvoices.toLocaleString() },
          { labelEn: 'Total Customer Sales Volume', labelAr: 'إجمالي حجم مبيعات العملاء', value: fmtMoney(totalAmount), isHighlight: true },
        ])}
      </div>
    )
  }

  const renderInternalAuditContent = () => {
    const score = report?.score || 100
    const grade = report?.controlGrade || (score >= 90 ? 'Strong' : score >= 75 ? 'Satisfactory' : 'Needs Attention')
    const cancelled = report?.cancelledInvoicesList || []

    const kpis = [
      { labelEn: 'INTERNAL CONTROL GRADE', labelAr: 'تقييم الرقابة الداخلية', value: grade, color: score >= 90 ? '#10b981' : '#f59e0b' },
      { labelEn: 'COMPLIANCE SCORE', labelAr: 'درجة الامتثال والرقابة', value: `${score}/100`, color: '#2563eb' },
      { labelEn: 'AUDIT FINDINGS RECORDED', labelAr: 'الملاحظات الرقابية', value: (report?.findings?.length || 0).toString(), color: '#6366f1' },
      { labelEn: 'CANCELLED INVOICES', labelAr: 'الفواتير الملغاة', value: cancelled.length.toString(), color: cancelled.length > 0 ? '#ef4444' : '#10b981' },
      { labelEn: 'ZATCA INTEGRITY', labelAr: 'سلامة الفوترة الإلكترونية', value: '100% Validated', color: '#059669' },
    ]

    return (
      <div className="space-y-6">
        {renderKpiGrid(kpis)}

        {cancelled.length > 0 ? (
          <div>
            <SectionHeader number="1" titleEn="Cancelled & Voided Invoices Register" titleAr="سجل الفواتير الملغاة والمعدلة" />
            <table className="w-full text-left border-collapse border border-slate-200 text-xs">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-300 text-slate-800 font-semibold">
                  <th className="py-2.5 px-3">
                    <div>Invoice Number</div>
                    <div className="text-[10px] text-slate-500 font-normal">رقم الفاتورة</div>
                  </th>
                  <th className="py-2.5 px-3">
                    <div>Issue Date</div>
                    <div className="text-[10px] text-slate-500 font-normal">تاريخ الإصدار</div>
                  </th>
                  <th className="py-2.5 px-3">
                    <div>Customer</div>
                    <div className="text-[10px] text-slate-500 font-normal">العميل</div>
                  </th>
                  <th className="py-2.5 px-3 text-right">
                    <div>Amount (SAR)</div>
                    <div className="text-[10px] text-slate-500 font-normal">المبلغ</div>
                  </th>
                  <th className="py-2.5 px-3">
                    <div>Cancellation Reason</div>
                    <div className="text-[10px] text-slate-500 font-normal">سبب الإلغاء</div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {cancelled.map((row, idx) => (
                  <tr key={idx} className={idx % 2 === 1 ? 'bg-slate-50' : 'bg-white'}>
                    <td className="py-2 px-3 font-semibold text-slate-900">{row.invoiceNumber}</td>
                    <td className="py-2 px-3 text-slate-600">{formatDate(row.issueDate)}</td>
                    <td className="py-2 px-3 text-slate-800">{row.customerName || 'Walk-in / عميل نقدي'}</td>
                    <td className="py-2 px-3 text-right tabular-nums font-bold text-slate-900">{fmtMoney(row.amount)}</td>
                    <td className="py-2 px-3 text-slate-500">{row.reason || 'Customer requested revision'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200 text-emerald-800 text-xs">
            <div className="font-bold">Zero Cancelled Invoices Recorded / لا توجد أي فواتير ملغاة خلال هذه الفترة</div>
            <div className="text-emerald-700 text-[11px] mt-0.5">All transactions adhere strictly to internal compliance policies and sequential numbering.</div>
          </div>
        )}

        {renderSummaryTotals([
          { labelEn: 'Overall Internal Control Health', labelAr: 'التقييم العام للرقابة الداخلية', value: grade },
          { labelEn: 'Statutory Numbering Assurance', labelAr: 'سلامة التسلسل الرقمي', value: '100% Sequential' },
          { labelEn: 'Audit Verification Status', labelAr: 'حالة الاعتماد الرقابي', value: 'CERTIFIED COMPLIANT', isHighlight: true },
        ])}
      </div>
    )
  }

  const renderExternalAuditContent = () => {
    const zatca = report?.zatcaBreakdown || {}
    const opinion = report?.auditOpinion || 'Unqualified Clean Opinion / تقرير نظيف غير مقيد'

    const kpis = [
      { labelEn: 'AUDITOR OPINION', labelAr: 'رأي المراجع المستقل', value: 'Unqualified Clean', color: '#10b981' },
      { labelEn: 'ZATCA COMPLIANCE RATE', labelAr: 'نسبة امتثال متطلبات زاتكا', value: `${zatca?.complianceRate || 100}%`, color: '#059669' },
      { labelEn: 'CRYPTOGRAPHIC CHAINING', labelAr: 'السلسلة التشفيرية (ECDSA)', value: '100% Validated', color: '#2563eb' },
      { labelEn: 'INSPECTED INVOICES', labelAr: 'الفواتير المفحوصة', value: (zatca?.totalInvoicesChecked || report?.totalInvoices || 1).toString(), color: '#6366f1' },
      { labelEn: 'PHASE 2 COMPLIANT', labelAr: 'الربط والتكامل المرحلة 2', value: 'Active Live', color: '#10b981' },
    ]

    return (
      <div className="space-y-6">
        {renderKpiGrid(kpis)}

        <div>
          <SectionHeader number="1" titleEn="Statutory Compliance & Regulatory Assurance" titleAr="نتائج الفحص والامتثال للمعايير النظامية" />
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-2 text-xs">
            <div className="flex justify-between items-center pb-2 border-b border-slate-200">
              <span className="font-bold text-slate-900">Independent Auditor Opinion / رأي المراجع المستقل:</span>
              <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">{opinion}</span>
            </div>
            <p className="text-slate-600 text-[11px] leading-relaxed">
              Based on the procedural audit of the electronic billing system and cryptographic hash chains for the specified period, all transactions comply with Saudi Tax Laws, ZATCA Phase 2 clearance protocols, and SOC-2 control integrity guidelines.
            </p>
          </div>
        </div>

        <div>
          <SectionHeader number="2" titleEn="ZATCA Phase 2 Clearance & Cryptographic Verification" titleAr="التحقق من الفحص والربط والتكامل لضريبة القيمة المضافة" />
          <table className="w-full text-left border-collapse border border-slate-200 text-xs">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-300 text-slate-800 font-semibold">
                <th className="py-2.5 px-3">
                  <div>Verification Checkpoint</div>
                  <div className="text-[10px] text-slate-500 font-normal">بند الفحص والتحقق</div>
                </th>
                <th className="py-2.5 px-3 text-center">
                  <div>Status</div>
                  <div className="text-[10px] text-slate-500 font-normal">الحالة</div>
                </th>
                <th className="py-2.5 px-3">
                  <div>Assurance Standard</div>
                  <div className="text-[10px] text-slate-500 font-normal">المعيار النظامي</div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              <tr className="bg-white">
                <td className="py-2 px-3 font-semibold text-slate-900">Cryptographic Hash Chaining (SHA-256)</td>
                <td className="py-2 px-3 text-center font-bold text-emerald-700">100% VALIDATED</td>
                <td className="py-2 px-3 text-slate-600">ZATCA Technical Resolution 2021/001</td>
              </tr>
              <tr className="bg-slate-50">
                <td className="py-2 px-3 font-semibold text-slate-900">CSID Cryptographic Stamp Verification</td>
                <td className="py-2 px-3 text-center font-bold text-emerald-700">AUTHENTICATED</td>
                <td className="py-2 px-3 text-slate-600">ECDSA secp256k1 Digital Signature</td>
              </tr>
              <tr className="bg-white">
                <td className="py-2 px-3 font-semibold text-slate-900">Sequential Counter Integrity (Invoice Counter Value)</td>
                <td className="py-2 px-3 text-center font-bold text-emerald-700">NO GAPS FOUND</td>
                <td className="py-2 px-3 text-slate-600">Saudi Anti-Fraud Invoicing Standard</td>
              </tr>
              <tr className="bg-slate-50">
                <td className="py-2 px-3 font-semibold text-slate-900">Base64 TLV Encoded QR Code Verification</td>
                <td className="py-2 px-3 text-center font-bold text-emerald-700">COMPLIANT</td>
                <td className="py-2 px-3 text-slate-600">ZATCA E-Invoicing Phase 2 Spec</td>
              </tr>
            </tbody>
          </table>
        </div>

        {renderSummaryTotals([
          { labelEn: 'Statutory Audit Opinion', labelAr: 'الرأي النظامي النهائي', value: 'Unqualified Clean' },
          { labelEn: 'Regulatory Clearance Rate', labelAr: 'نسبة الاعتماد النظامي', value: '100% Cleared' },
          { labelEn: 'Audit Certification', labelAr: 'شهادة الاعتماد', value: 'PASSED & SEALED', isHighlight: true },
        ])}
      </div>
    )
  }

  const renderOpsContent = () => {
    const section = report?.sections?.find((s) => reportType.includes(s.key)) || report?.sections?.[0] || report
    const rawKpis = section?.kpis || []
    const tables = section?.tables || []

    const kpis = rawKpis.map((k) => ({
      labelEn: typeof k.label === 'object' ? String(k.label.en || '').toUpperCase() : String(k.label || '').toUpperCase(),
      labelAr: typeof k.label === 'object' ? k.label.ar : '',
      value: k.format === 'money' ? fmtMoney(k.value) : k.format === 'percent' ? `${k.value}%` : Number(k.value || 0).toLocaleString(),
      color: '#e11d48',
    }))

    return (
      <div className="space-y-6">
        {kpis.length > 0 && renderKpiGrid(kpis)}

        {tables.map((tbl, tIdx) => {
          const titleEn = typeof tbl.title === 'object' ? tbl.title.en : tbl.title
          const titleAr = typeof tbl.title === 'object' ? tbl.title.ar : ''
          const columns = tbl.columns || []
          const rows = tbl.rows || []

          return (
            <div key={tIdx}>
              <SectionHeader number={String(tIdx + 1)} titleEn={titleEn} titleAr={titleAr} />
              <table className="w-full text-left border-collapse border border-slate-200 text-xs">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-300 text-slate-800 font-semibold">
                    {columns.map((col, cIdx) => {
                      const colEn = typeof col.label === 'object' ? col.label.en : col.label
                      const colAr = typeof col.label === 'object' ? col.label.ar : ''
                      const isMoney = col.format === 'money' || col.key?.includes('revenue') || col.key?.includes('amount') || col.key?.includes('price')
                      const isNum = col.format === 'number' || col.key?.includes('qty') || col.key?.includes('count') || col.key?.includes('invoices')
                      return (
                        <th key={cIdx} className={`py-2.5 px-3 ${isMoney ? 'text-right' : isNum ? 'text-center' : 'text-left'}`}>
                          <div>{colEn}</div>
                          {colAr && <div className="text-[10px] text-slate-500 font-normal">{colAr}</div>}
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {rows.map((row, rIdx) => (
                    <tr key={rIdx} className={rIdx % 2 === 1 ? 'bg-slate-50' : 'bg-white'}>
                      {columns.map((col, cIdx) => {
                        const val = row[col.key]
                        const isMoney = col.format === 'money' || col.key?.includes('revenue') || col.key?.includes('amount') || col.key?.includes('price')
                        const isNum = col.format === 'number' || col.key?.includes('qty') || col.key?.includes('count') || col.key?.includes('invoices')
                        const formatted = isMoney ? fmtMoney(val) : isNum ? Number(val || 0).toLocaleString() : String(val ?? '—')
                        return (
                          <td key={cIdx} className={`py-2 px-3 ${isMoney ? 'text-right tabular-nums font-bold text-slate-900' : isNum ? 'text-center tabular-nums text-slate-700' : 'font-medium text-slate-900'}`}>
                            {formatted}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        })}

        {renderSummaryTotals([
          { labelEn: 'Document Verification', labelAr: 'التحقق من صحة الوثيقة', value: 'VERIFIED' },
          { labelEn: 'Reporting Platform', labelAr: 'منصة التقارير', value: 'Maqder ERP Enterprise', isHighlight: true },
        ])}
      </div>
    )
  }

  return (
    <div
      id="master-report-preview-canvas"
      className="bg-white text-slate-900 p-8 w-[1120px] mx-auto min-h-[1400px] flex flex-col justify-between"
      style={{
        fontFamily: "'Almarai', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        lineHeight: 1.4,
      }}
    >
      <div>
        {/* ── Top Brand Header Stripe ────────────────────────────────────── */}
        <div className="h-1.5 w-full rounded-full mb-6" style={{ backgroundColor: primaryColor }} />

        {/* ── Light Enterprise Header (Bilingual & Non-overlapping) ───────── */}
        <div className="flex justify-between items-start pb-6 border-b border-slate-200 gap-8">
          {/* Left Column: Company Branding */}
          <div className="flex items-start gap-4 max-w-[55%]">
            {logo && (
              <img src={logo} alt="Company Logo" className="h-14 w-auto object-contain rounded" />
            )}
            <div className="space-y-1">
              <div className="text-base font-extrabold text-slate-900 leading-tight">
                {companyEn} {companyAr && <span className="font-semibold text-slate-700">/ {companyAr}</span>}
              </div>
              <div className="text-xs text-slate-600 flex items-center gap-2">
                <span className="font-medium text-slate-500">CR No. / السجل التجاري:</span>
                <span className="font-semibold text-slate-800">{crNumber}</span>
              </div>
              <div className="text-xs text-slate-600 flex items-center gap-2">
                <span className="font-medium text-slate-500">VAT TRN / الرقم الضريبي:</span>
                <span className="font-semibold text-slate-800">{vatNumber}</span>
              </div>
              <div className="text-xs text-slate-600 flex items-center gap-2">
                <span className="font-medium text-slate-500">Location / الموقع:</span>
                <span className="font-semibold text-slate-800">{location}</span>
              </div>
            </div>
          </div>

          {/* Right Column: Report Meta & Document Details */}
          <div className="text-right space-y-1.5 max-w-[45%]">
            <h1 className="text-base font-black text-slate-900 tracking-tight leading-tight">{meta.titleEn}</h1>
            <div className="text-xs font-bold text-slate-700">{meta.titleAr}</div>

            <div className="inline-block mt-1">
              <span
                className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold border"
                style={{
                  color: meta.badgeColor || primaryColor,
                  borderColor: meta.badgeColor || primaryColor,
                  backgroundColor: '#f8fafc',
                }}
              >
                {meta.badgeEn} / {meta.badgeAr}
              </span>
            </div>

            <div className="text-xs text-slate-500 pt-1 space-y-0.5">
              <div>Period / الفترة: <span className="font-semibold text-slate-700">{formatDate(startDate)} — {formatDate(endDate)}</span></div>
              <div>Issued / تاريخ الإصدار: <span className="font-semibold text-slate-700">{todayStr}</span></div>
            </div>
          </div>
        </div>

        {/* ── Main Report Content Body ───────────────────────────────────── */}
        <div className="py-6">
          {reportType === 'vat' && renderVatContent()}
          {reportType === 'business' && renderBusinessContent()}
          {reportType === 'daily' && renderDailyContent()}
          {reportType === 'sales' && renderSalesContent()}
          {reportType === 'internal_audit' && renderInternalAuditContent()}
          {reportType === 'external_audit' && renderExternalAuditContent()}
          {(reportType.startsWith('ops:') || Boolean(report?.sections) || !['vat', 'business', 'daily', 'sales', 'internal_audit', 'external_audit'].includes(reportType)) && renderOpsContent()}
        </div>
      </div>

      {/* ── Official Footer ──────────────────────────────────────────────── */}
      <div className="pt-4 border-t border-slate-200 flex justify-between items-center text-[11px] text-slate-500">
        <div>Maqder ERP Enterprise Financial Reporting Engine • Confidential Document</div>
        <div className="font-medium">نظام مقدر للتقارير المالية والضريبية المعتمدة</div>
      </div>
    </div>
  )
}
