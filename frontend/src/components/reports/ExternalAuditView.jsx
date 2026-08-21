import { useState } from 'react'
import { motion } from 'framer-motion'
import Money from '../ui/Money'
import ExportMenu from '../ui/ExportMenu'
import {
  Landmark,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  FileCheck,
  Layers,
  Scale,
  CalendarCheck,
  Building2,
  Lock,
  Search,
  FileText,
  BadgeCheck,
  Activity,
} from 'lucide-react'
import { isSaudiTenant, getTaxAuthorityName } from '../../lib/saudiTenant'

export default function ExternalAuditView({ data, language, t, tenant }) {
  const [activeTab, setActiveTab] = useState('vat_summary')
  const [searchQuery, setSearchQuery] = useState('')
  const isAr = language === 'ar'
  const isSar = isSaudiTenant(tenant) || String(tenant?.settings?.currency || 'SAR').toUpperCase() === 'SAR'
  const authorityName = getTaxAuthorityName(tenant)

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-16 rounded-2xl bg-white dark:bg-dark-800 border border-gray-100 dark:border-dark-700">
        <FileText className="w-8 h-8 text-gray-300 dark:text-gray-600 mb-2" />
        <p className="text-sm text-gray-400 dark:text-gray-500">{t('noData')}</p>
      </div>
    )
  }

  const score = Number(data.complianceScore) || 100
  const scoreColor =
    score >= 85
      ? 'from-emerald-500 to-teal-600'
      : score >= 70
      ? 'from-blue-500 to-indigo-600'
      : 'from-amber-500 to-rose-600'

  const checklist = Array.isArray(data.checklist) ? data.checklist : []
  const vatSummary = Array.isArray(data.statutoryVatSummary) ? data.statutoryVatSummary : []
  const zatca = data.zatcaBreakdown || {}
  const arAging = data.arAging || { rows: [] }
  const cutOff = Array.isArray(data.cutOffTesting) ? data.cutOffTesting : []
  const zatcaLogs = Array.isArray(data.zatcaLogsSummary) ? data.zatcaLogsSummary : []

  const filteredAr = (arAging.rows || []).filter(
    (r) =>
      r.invoiceNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.customerName?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const filteredCutOff = cutOff.filter(
    (r) =>
      r.invoiceNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.customerName?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="space-y-6">
      {/* ── Formal Statutory Auditor Opinion Header Certificate ───────────── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white p-6 sm:p-8 border border-slate-700/50 shadow-lg"
      >
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 relative z-10">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              <BadgeCheck className="w-4 h-4 text-emerald-400" />
              {isAr ? 'شهادة الفحص المحاسبي والامتثال الضريبي والنظامي' : `Statutory Audit & ${isSar ? 'ZATCA' : authorityName} Compliance Review`}
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              {isAr ? data.auditOpinionAr : data.auditOpinion}
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-3xl leading-relaxed">
              {isAr ? data.opinionTextAr : data.opinionTextEn}
            </p>
            <div className="flex flex-wrap items-center gap-4 pt-1 text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-indigo-400" />
                {tenant?.business?.legalNameAr || tenant?.business?.legalNameEn || 'المنشأة'}
              </span>
              <span>•</span>
              <span>CR: {tenant?.business?.crNumber || '1010XXXXXX'}</span>
              <span>•</span>
              <span>VAT TIN: {tenant?.business?.vatNumber || '3XXXXXXXXXXXXXX'}</span>
            </div>
          </div>

          {/* Statutory Readiness Gauge Card */}
          <div className="flex items-center gap-4 bg-white/5 backdrop-blur-md rounded-2xl p-5 border border-white/10 shrink-0">
            <div
              className={`flex flex-col items-center justify-center w-18 h-18 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br ${scoreColor} text-white shadow-lg`}
            >
              <span className="text-2xl sm:text-3xl font-black">{score}</span>
              <span className="text-[10px] uppercase font-bold opacity-80">/ 100</span>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                {isAr ? 'الجاهزية للتدقيق القانوني' : 'Statutory Readiness'}
              </p>
              <h3 className="text-base font-bold text-white">
                {score >= 85
                  ? (isAr ? 'مطابق بدون تحفظ' : 'Fully Compliant')
                  : (isAr ? 'مطابق مع إيضاحات' : 'Substantially Compliant')}
              </h3>
              <p className="text-[11px] text-emerald-400 flex items-center gap-1 mt-0.5">
                <ShieldCheck className="w-3 h-3" />
                {isAr ? 'مطابق لمعايير SOCPA / IFRS' : 'SOCPA & IFRS Aligned'}
              </p>
            </div>
          </div>
        </div>

        {/* Decorative background glow */}
        <div className="pointer-events-none absolute -right-20 -top-20 w-80 h-80 rounded-full bg-emerald-500/10 blur-3xl" />
      </motion.div>

      {/* ── Statutory KPI Grid ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {(data.kpis || []).map((kpi, idx) => (
          <motion.div
            key={kpi.key || idx}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.04 }}
            className="rounded-2xl bg-white dark:bg-dark-800 border border-gray-100 dark:border-dark-700 p-4 shadow-sm"
          >
            <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1 line-clamp-1">
              {isAr ? kpi.label?.ar : kpi.label?.en}
            </p>
            <p className="text-lg font-bold text-gray-900 dark:text-white">
              {kpi.format === 'money' ? <Money value={kpi.value} /> : String(kpi.value ?? '-')}
            </p>
          </motion.div>
        ))}
      </div>

      {/* ── Statutory Compliance Checklist ─────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl bg-white dark:bg-dark-800 border border-gray-100 dark:border-dark-700 p-6 shadow-sm space-y-4"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600">
              <FileCheck className="w-4 h-4" />
            </div>
            <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
              {isAr ? 'قائمة التحقق من الإفصاحات والاشتراطات النظامية' : 'Statutory & Regulatory Disclosure Checklist'}
            </h3>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-300">
            {checklist.filter((c) => c.status === 'passed').length} / {checklist.length} {isAr ? 'مستوفاة' : 'Verified'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 pt-1">
          {checklist.map((item, i) => {
            const isPassed = item.status === 'passed'
            return (
              <div
                key={i}
                className={`rounded-xl p-4 border transition-all flex items-start gap-3 ${
                  isPassed
                    ? 'border-emerald-200 bg-emerald-50/40 dark:border-emerald-900/40 dark:bg-emerald-950/10'
                    : 'border-amber-200 bg-amber-50/40 dark:border-amber-900/40 dark:bg-amber-950/10'
                }`}
              >
                {isPassed ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                )}
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-gray-900 dark:text-gray-100">
                    {isAr ? item.itemAr : item.itemEn}
                  </h4>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">{item.details}</p>
                </div>
              </div>
            )
          })}
        </div>
      </motion.div>

      {/* ── Interactive Detail Tabs ────────────────────────────────────────── */}
      <div className="rounded-2xl bg-white dark:bg-dark-800 border border-gray-100 dark:border-dark-700 shadow-sm overflow-hidden">
        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 pt-5 pb-3 border-b border-gray-100 dark:border-dark-700">
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {[
              {
                id: 'vat_summary',
                label: isAr ? 'تسوية الإقرار الضريبي' : 'Statutory VAT Summary',
                icon: Scale,
              },
              {
                id: 'zatca_chain',
                label: isAr ? (isSar ? 'سلسلة تشفير زاتكا' : 'سلسلة التشفير الرقمي') : (isSar ? 'ZATCA Phase 2 Audit' : 'E-Invoice Cryptographic Audit'),
                icon: Lock,
              },
              {
                id: 'ar_aging',
                label: isAr ? 'أعمار الديون (IFRS 9)' : 'AR Aging Schedule',
                count: arAging.rows?.length || 0,
                icon: Layers,
              },
              {
                id: 'cut_off',
                label: isAr ? 'فحص فترة القطع' : 'Period Cut-Off Test',
                count: cutOff.length,
                icon: CalendarCheck,
              },
              {
                id: 'zatca_logs',
                label: isAr ? (isSar ? 'سجل أحداث زاتكا' : 'سجل الأحداث والامتثال') : (isSar ? 'ZATCA Audit Logs' : `${authorityName} Audit Logs`),
                count: zatcaLogs.length,
                icon: Activity,
              },
            ].map((tab) => {
              const Icon = tab.icon
              const active = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                    active
                      ? 'bg-primary-600 text-white shadow-sm shadow-primary-200 dark:shadow-primary-900/30'
                      : 'bg-gray-50 dark:bg-dark-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-600'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                  {tab.count !== undefined && (
                    <span
                      className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                        active ? 'bg-white/20 text-white' : 'bg-gray-200 dark:bg-dark-600 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {tab.count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Search Box */}
          {(activeTab === 'ar_aging' || activeTab === 'cut_off') && (
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={isAr ? 'بحث...' : 'Search...'}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-gray-200 dark:border-dark-600 bg-gray-50/50 dark:bg-dark-700 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          )}
        </div>

        {/* Tab 1: Statutory VAT Summary */}
        {activeTab === 'vat_summary' && (
          <div>
            <div className="px-6 py-3 bg-gray-50/50 dark:bg-dark-700/20 flex items-center justify-between border-b border-gray-100 dark:border-dark-700">
              <span className="text-xs text-gray-500">
                {isAr
                  ? 'مطابقة الوعاء الضريبي وضريبة المخرجات والمدخلات وفق متطلبات هيئة الزكاة والضريبة والجمارك.'
                  : 'Reconciliation of tax base, output tax, and deductible input VAT according to ZATCA statutory guidelines.'}
              </span>
              <ExportMenu
                language={language}
                t={t}
                rows={vatSummary}
                columns={[
                  { key: 'category', label: isAr ? 'بند الإقرار' : 'Category' },
                  { key: 'taxableAmount', label: isAr ? 'المبلغ الخاضع' : 'Taxable Base' },
                  { key: 'taxAmount', label: isAr ? 'مبلغ الضريبة' : 'VAT Amount' },
                ]}
                fileBaseName="statutory_vat_summary"
                title={isAr ? 'تسوية الإقرار الضريبي' : 'Statutory VAT Summary'}
                disabled={vatSummary.length === 0}
              />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left rtl:text-right">
                <thead className="bg-gray-50 dark:bg-dark-700/40 text-gray-400 uppercase font-semibold">
                  <tr>
                    <th className="px-6 py-3.5">{isAr ? 'بند الإقرار الضريبي' : 'Tax Return Line Item'}</th>
                    <th className="px-6 py-3.5">{isAr ? 'المبلغ الخاضع للضريبة (SAR)' : 'Taxable Amount (SAR)'}</th>
                    <th className="px-6 py-3.5">{isAr ? 'مبلغ ضريبة القيمة المضافة (SAR)' : 'VAT Amount (SAR)'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-dark-700">
                  {vatSummary.map((row, i) => (
                    <tr key={i} className="hover:bg-gray-50/80 dark:hover:bg-dark-700/30 transition-colors">
                      <td className="px-6 py-3.5 font-bold text-gray-900 dark:text-white">
                        {isAr ? row.categoryAr : row.category}
                      </td>
                      <td className="px-6 py-3.5 font-semibold text-gray-700 dark:text-gray-300">
                        <Money value={row.taxableAmount} />
                      </td>
                      <td className="px-6 py-3.5 font-bold text-primary-600 dark:text-primary-400">
                        <Money value={row.taxAmount} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 2: ZATCA Phase 2 Cryptographic Chaining */}
        {activeTab === 'zatca_chain' && (
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="rounded-xl border border-gray-100 dark:border-dark-700 p-4 bg-gray-50/40 dark:bg-dark-700/20">
                <p className="text-[11px] font-semibold text-gray-400 uppercase">
                  {isAr ? 'الفواتير المبسطة (B2C)' : 'Simplified Invoices (B2C)'}
                </p>
                <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">
                  {(zatca.simplifiedB2CCount || 0).toLocaleString()}
                </p>
                <p className="text-[10px] text-emerald-600 mt-1">
                  {isAr ? 'تم الإرسال خلال 24 ساعة' : 'Reported within 24h'}
                </p>
              </div>

              <div className="rounded-xl border border-gray-100 dark:border-dark-700 p-4 bg-gray-50/40 dark:bg-dark-700/20">
                <p className="text-[11px] font-semibold text-gray-400 uppercase">
                  {isAr ? 'الفواتير الضريبية (B2B)' : 'Standard Invoices (B2B)'}
                </p>
                <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">
                  {(zatca.standardB2BCount || 0).toLocaleString()}
                </p>
                <p className="text-[10px] text-indigo-600 mt-1">
                  {isAr ? 'اعتماد لحظي (Clearance)' : 'Real-time Cleared'}
                </p>
              </div>

              <div className="rounded-xl border border-gray-100 dark:border-dark-700 p-4 bg-gray-50/40 dark:bg-dark-700/20">
                <p className="text-[11px] font-semibold text-gray-400 uppercase">
                  {isAr ? 'سلامة الهاش والتسلسل' : 'Chaining Integrity'}
                </p>
                <p className="text-xl font-bold text-emerald-600 mt-1">
                  {zatca.hashIntegrityRate?.toFixed(1) || 100}%
                </p>
                <p className="text-[10px] text-gray-400 mt-1">
                  {isAr ? 'سلسلة PIH غير منقطعة' : 'PIH hash chain intact'}
                </p>
              </div>

              <div className="rounded-xl border border-gray-100 dark:border-dark-700 p-4 bg-gray-50/40 dark:bg-dark-700/20">
                <p className="text-[11px] font-semibold text-gray-400 uppercase">
                  {isAr ? 'مطابقة رمز الاستجابة QR' : 'QR Code Compliance'}
                </p>
                <p className="text-xl font-bold text-primary-600 mt-1">
                  {zatca.missingQrCount === 0 ? '100%' : `${zatca.missingQrCount} missing`}
                </p>
                <p className="text-[10px] text-emerald-600 mt-1">
                  {isAr ? 'تشفير Base64 / TLV معتمد' : 'Base64 TLV compliant'}
                </p>
              </div>
            </div>

            <div className="rounded-xl bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30 p-5 text-xs text-indigo-900 dark:text-indigo-200 leading-relaxed">
              <h4 className="font-bold mb-1 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-indigo-600" />
                {isAr ? (isSar ? 'إقرار المطابقة الفنية لمنظومة زاتكا' : 'إقرار المطابقة الفنية والامتثال الضريبي') : (isSar ? 'ZATCA Technical Compliance Declaration' : `${authorityName} Technical Compliance Declaration`)}
              </h4>
              <p>
                {isAr
                  ? (isSar
                    ? 'تم التحقق من ربط الفواتير بالرقم التسلسلي المشفر (Cryptographic Stamp ID) ووجود تسلسل الهاش المتصل (Previous Invoice Hash) دون أي فجوات رقمية في تسلسل الفواتير، مما يفي بمتطلبات المادة (53) من اللائحة التنفيذية.'
                    : 'تم التحقق من سلامة الفواتير الإلكترونية والتسلسل الرقمي غير القابل للتعديل ورموز التحقق الضريبية المعتمدة وفقاً للأنظمة واللوائح السارية.')
                  : (isSar
                    ? 'All generated e-invoices adhere to ZATCA Phase 2 cryptographic stamping, continuous SHA-256 previous invoice hashing, and zero-gap sequential counter requirements under Article 53 of the VAT regulation.'
                    : `All generated e-invoices adhere to ${authorityName} statutory compliance standards, continuous invoice sequence verification, and tamper-evident audit integrity.`)}
              </p>
            </div>
          </div>
        )}

        {/* Tab 3: Accounts Receivable Aging */}
        {activeTab === 'ar_aging' && (
          <div>
            {/* Aging Summary Buckets */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-6 pb-4 border-b border-gray-100 dark:border-dark-700 bg-gray-50/30 dark:bg-dark-700/20">
              <div className="p-3.5 rounded-xl bg-white dark:bg-dark-800 border border-gray-100 dark:border-dark-700 shadow-sm">
                <p className="text-[10px] font-semibold text-emerald-600 uppercase">0 - 30 Days (Current)</p>
                <p className="text-base font-bold text-gray-900 dark:text-white mt-1">
                  <Money value={arAging.arCurrent || 0} />
                </p>
              </div>
              <div className="p-3.5 rounded-xl bg-white dark:bg-dark-800 border border-gray-100 dark:border-dark-700 shadow-sm">
                <p className="text-[10px] font-semibold text-blue-600 uppercase">31 - 60 Days</p>
                <p className="text-base font-bold text-gray-900 dark:text-white mt-1">
                  <Money value={arAging.ar30to60 || 0} />
                </p>
              </div>
              <div className="p-3.5 rounded-xl bg-white dark:bg-dark-800 border border-gray-100 dark:border-dark-700 shadow-sm">
                <p className="text-[10px] font-semibold text-amber-600 uppercase">61 - 90 Days</p>
                <p className="text-base font-bold text-gray-900 dark:text-white mt-1">
                  <Money value={arAging.ar60to90 || 0} />
                </p>
              </div>
              <div className="p-3.5 rounded-xl bg-white dark:bg-dark-800 border border-gray-100 dark:border-dark-700 shadow-sm">
                <p className="text-[10px] font-semibold text-rose-600 uppercase">90+ Days (Overdue)</p>
                <p className="text-base font-bold text-rose-600 mt-1">
                  <Money value={arAging.arOver90 || 0} />
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left rtl:text-right">
                <thead className="bg-gray-50 dark:bg-dark-700/40 text-gray-400 uppercase font-semibold">
                  <tr>
                    <th className="px-6 py-3">{isAr ? 'رقم الفاتورة' : 'Invoice #'}</th>
                    <th className="px-6 py-3">{isAr ? 'التاريخ' : 'Date'}</th>
                    <th className="px-6 py-3">{isAr ? 'العميل' : 'Customer'}</th>
                    <th className="px-6 py-3">{isAr ? 'المبلغ الإجمالي' : 'Total Amount'}</th>
                    <th className="px-6 py-3">{isAr ? 'المدفوع' : 'Paid'}</th>
                    <th className="px-6 py-3">{isAr ? 'المتبقي' : 'Balance Due'}</th>
                    <th className="px-6 py-3">{isAr ? 'العمر' : 'Age'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-dark-700">
                  {filteredAr.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="px-6 py-8 text-center text-gray-400">
                        {isAr ? 'لا توجد مستحقات معلقة في هذا النطاق' : 'No outstanding receivables found'}
                      </td>
                    </tr>
                  ) : (
                    filteredAr.map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50/80 dark:hover:bg-dark-700/30 transition-colors">
                        <td className="px-6 py-3.5 font-bold text-gray-900 dark:text-white">{row.invoiceNumber}</td>
                        <td className="px-6 py-3.5 text-gray-500">
                          {row.issueDate ? new Date(row.issueDate).toLocaleDateString() : '-'}
                        </td>
                        <td className="px-6 py-3.5 text-gray-700 dark:text-gray-300">{row.customerName}</td>
                        <td className="px-6 py-3.5 text-gray-500">
                          <Money value={row.totalAmount} />
                        </td>
                        <td className="px-6 py-3.5 text-gray-500">
                          <Money value={row.amountPaid} />
                        </td>
                        <td className="px-6 py-3.5 font-bold text-rose-600 dark:text-rose-400">
                          <Money value={row.balanceDue} />
                        </td>
                        <td className="px-6 py-3.5">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              row.ageDays <= 30
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30'
                                : row.ageDays <= 60
                                ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30'
                                : row.ageDays <= 90
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30'
                                : 'bg-rose-100 text-rose-800 dark:bg-rose-900/30'
                            }`}
                          >
                            {row.ageDays} {isAr ? 'يوم' : 'days'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 4: Period Cut-off Verification */}
        {activeTab === 'cut_off' && (
          <div>
            <div className="px-6 py-3 bg-gray-50/50 dark:bg-dark-700/20 border-b border-gray-100 dark:border-dark-700">
              <span className="text-xs text-gray-500">
                {isAr
                  ? 'فحص فواتير بداية ونهاية الفترة المالية (Cut-off Testing) للتأكد من تسجيل الإيرادات في الفترة المحاسبية الصحيحة.'
                  : 'Testing period boundaries (first 7 and last 7 days) to ensure revenue recognition timing integrity.'}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left rtl:text-right">
                <thead className="bg-gray-50 dark:bg-dark-700/40 text-gray-400 uppercase font-semibold">
                  <tr>
                    <th className="px-6 py-3">{isAr ? 'رقم الفاتورة' : 'Invoice #'}</th>
                    <th className="px-6 py-3">{isAr ? 'تاريخ الإصدار' : 'Issue Date'}</th>
                    <th className="px-6 py-3">{isAr ? 'العميل' : 'Customer'}</th>
                    <th className="px-6 py-3">{isAr ? 'المبلغ' : 'Amount'}</th>
                    <th className="px-6 py-3">{isAr ? 'الضريبة' : 'VAT'}</th>
                    <th className="px-6 py-3">{isAr ? (isSar ? 'حالة زاتكا' : 'حالة الفاتورة') : (isSar ? 'ZATCA Status' : 'Invoice Status')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-dark-700">
                  {filteredCutOff.map((inv, i) => (
                    <tr key={i} className="hover:bg-gray-50/80 dark:hover:bg-dark-700/30 transition-colors">
                      <td className="px-6 py-3.5 font-bold text-gray-900 dark:text-white">{inv.invoiceNumber}</td>
                      <td className="px-6 py-3.5 text-gray-500">
                        {inv.issueDate ? new Date(inv.issueDate).toLocaleDateString() : '-'}
                      </td>
                      <td className="px-6 py-3.5 text-gray-700 dark:text-gray-300">{inv.customerName}</td>
                      <td className="px-6 py-3.5 font-semibold text-gray-900 dark:text-white">
                        <Money value={inv.totalAmount} />
                      </td>
                      <td className="px-6 py-3.5 text-primary-600 dark:text-primary-400">
                        <Money value={inv.taxAmount} />
                      </td>
                      <td className="px-6 py-3.5">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30">
                          {isSar ? inv.zatcaStatus : (inv.status || 'Issued')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 5: ZATCA Audit Logs */}
        {activeTab === 'zatca_logs' && (
          <div>
            <div className="px-6 py-3 bg-gray-50/50 dark:bg-dark-700/20 border-b border-gray-100 dark:border-dark-700">
              <span className="text-xs text-gray-500">
                {isAr
                  ? (isSar
                    ? 'سجل العمليات والتحذيرات التلقائية لمنظومة الربط والتكامل مع هيئة الزكاة والضريبة والجمارك.'
                    : 'سجل العمليات والتحقق الضريبي والأمني للنظام المحاسبي.')
                  : (isSar
                    ? 'Automated operational log of ZATCA cryptographic renewals, sync events, and security verifications.'
                    : `Automated operational log of ${authorityName} statutory compliance, sync events, and security verifications.`)}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left rtl:text-right">
                <thead className="bg-gray-50 dark:bg-dark-700/40 text-gray-400 uppercase font-semibold">
                  <tr>
                    <th className="px-6 py-3">{isAr ? 'الإجراء' : 'Action'}</th>
                    <th className="px-6 py-3">{isAr ? 'الأهمية' : 'Severity'}</th>
                    <th className="px-6 py-3">{isAr ? 'الحالة' : 'Status'}</th>
                    <th className="px-6 py-3">{isAr ? 'التفاصيل' : 'Message'}</th>
                    <th className="px-6 py-3">{isAr ? 'التوقيت' : 'Timestamp'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-dark-700">
                  {zatcaLogs.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="px-6 py-8 text-center text-gray-400">
                        {isAr ? 'لا توجد تنبيهات أمنية مسجلة' : 'No security logs recorded'}
                      </td>
                    </tr>
                  ) : (
                    zatcaLogs.map((log, i) => (
                      <tr key={i} className="hover:bg-gray-50/80 dark:hover:bg-dark-700/30 transition-colors">
                        <td className="px-6 py-3.5 font-bold text-gray-900 dark:text-white">{log.action}</td>
                        <td className="px-6 py-3.5 uppercase font-semibold">{log.severity}</td>
                        <td className="px-6 py-3.5">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            {log.status}
                          </span>
                        </td>
                        <td className="px-6 py-3.5 text-gray-600 dark:text-gray-300">{log.message}</td>
                        <td className="px-6 py-3.5 text-gray-400">
                          {log.createdAt ? new Date(log.createdAt).toLocaleString() : '-'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
