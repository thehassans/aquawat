import { useState } from 'react'
import { motion } from 'framer-motion'
import Money from '../ui/Money'
import ExportMenu from '../ui/ExportMenu'
import {
  ShieldCheck,
  AlertTriangle,
  AlertCircle,
  FileText,
  Percent,
  Receipt,
  Users,
  CreditCard,
  CheckCircle2,
  XCircle,
  TrendingUp,
  Search,
  Sparkles,
} from 'lucide-react'

export default function InternalAuditView({ data, language, t, tenant }) {
  const [activeTab, setActiveTab] = useState('findings')
  const [searchQuery, setSearchQuery] = useState('')
  const isAr = language === 'ar'

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-16 rounded-2xl bg-white dark:bg-dark-800 border border-gray-100 dark:border-dark-700">
        <FileText className="w-8 h-8 text-gray-300 dark:text-gray-600 mb-2" />
        <p className="text-sm text-gray-400 dark:text-gray-500">{t('noData')}</p>
      </div>
    )
  }

  const score = Number(data.score) || 100
  const scoreColor =
    score >= 85
      ? 'from-emerald-500 to-teal-600'
      : score >= 65
      ? 'from-amber-500 to-orange-600'
      : 'from-rose-500 to-red-600'

  const scoreBadgeBg =
    score >= 85
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800/40'
      : score >= 65
      ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800/40'
      : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/20 dark:text-rose-300 dark:border-rose-800/40'

  const findings = Array.isArray(data.findings) ? data.findings : []
  const cancelledList = Array.isArray(data.cancelledInvoicesList) ? data.cancelledInvoicesList : []
  const highDiscountsList = Array.isArray(data.highDiscountsList) ? data.highDiscountsList : []
  const expensesList = Array.isArray(data.expensesAuditList) ? data.expensesAuditList : []
  const paymentMethods = Array.isArray(data.paymentMethodsBreakdown) ? data.paymentMethodsBreakdown : []
  const usersList = Array.isArray(data.usersGovernance) ? data.usersGovernance : []

  const filteredCancelled = cancelledList.filter(
    (i) =>
      i.invoiceNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      i.customerName?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const filteredDiscounts = highDiscountsList.filter(
    (i) =>
      i.invoiceNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      i.customerName?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const filteredExpenses = expensesList.filter(
    (e) =>
      e.expenseNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.category?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="space-y-6">
      {/* ── Top Executive Health & Control Banner ──────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 sm:p-8 shadow-md"
      >
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-white/10 text-indigo-200 border border-white/10">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
              {isAr ? 'نظام التدقيق والرقابة المالية الداخلية' : 'Internal Financial Audit & Control System'}
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              {isAr ? 'تقييم كفاءة الرقابة الداخلية وإدارة المخاطر' : 'Internal Control Assessment & Risk Governance'}
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              {isAr
                ? 'فحص شامل للفواتير الملغاة، الخصومات الاستثنائية، توثيق المصروفات، وتسوية المقبوضات النقدية والبنكية.'
                : 'Thorough evaluation of cancelled transactions, abnormal discounts, expense verification, and cash-to-bank ledger integrity.'}
            </p>
          </div>

          {/* Score Display Card */}
          <div className="flex items-center gap-4 bg-white/5 backdrop-blur-md rounded-2xl p-4 sm:p-5 border border-white/10 shrink-0">
            <div
              className={`flex flex-col items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br ${scoreColor} text-white shadow-lg`}
            >
              <span className="text-2xl sm:text-3xl font-black">{score}</span>
              <span className="text-[10px] uppercase font-bold opacity-80">/ 100</span>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                {isAr ? 'مستوى الرقابة' : 'Control Grade'}
              </p>
              <h3 className="text-base sm:text-lg font-bold text-white">
                {isAr ? data.controlGradeAr : data.controlGrade}
              </h3>
              <p className="text-[11px] text-slate-300">
                {findings.length === 0
                  ? (isAr ? 'لا توجد ملاحظات حرجة' : 'No critical findings')
                  : (isAr ? `${findings.length} ملاحظات تتطلب المتابعة` : `${findings.length} findings identified`)}
              </p>
            </div>
          </div>
        </div>

        {/* Decorative background glow */}
        <div className="pointer-events-none absolute -right-20 -top-20 w-80 h-80 rounded-full bg-indigo-500/10 blur-3xl" />
      </motion.div>

      {/* ── KPI Grid ──────────────────────────────────────────────────────── */}
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

      {/* ── Findings & Actionable Recommendations ─────────────────────────── */}
      {findings.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl bg-white dark:bg-dark-800 border border-gray-100 dark:border-dark-700 p-6 shadow-sm space-y-4"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-900/30 text-amber-600">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
                {isAr ? 'ملاحظات وتوصيات التدقيق الداخلي' : 'Internal Audit Findings & Remediation'}
              </h3>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-900/20 dark:text-amber-300">
              {findings.length} {isAr ? 'ملاحظات مرصودة' : 'Action Items'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            {findings.map((f, i) => {
              const isHigh = f.severity === 'high'
              return (
                <div
                  key={i}
                  className={`rounded-xl p-4 border transition-all ${
                    isHigh
                      ? 'border-rose-200 bg-rose-50/40 dark:border-rose-900/40 dark:bg-rose-950/10'
                      : 'border-amber-200 bg-amber-50/40 dark:border-amber-900/40 dark:bg-amber-950/10'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          isHigh ? 'bg-rose-500' : 'bg-amber-500'
                        }`}
                      />
                      {isAr ? f.titleAr : f.titleEn}
                    </h4>
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                        isHigh
                          ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'
                          : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                      }`}
                    >
                      {f.severity}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-300 mb-2 leading-relaxed">
                    {isAr ? f.descAr : f.descEn}
                  </p>
                  <div className="pt-2 border-t border-gray-200/50 dark:border-dark-700 text-xs text-gray-700 dark:text-gray-300 flex items-start gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-primary-500 shrink-0 mt-0.5" />
                    <span>
                      <strong>{isAr ? 'التوصية: ' : 'Recommendation: '}</strong>
                      {isAr ? f.recommendationAr : f.recommendationEn}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </motion.div>
      )}

      {/* ── Interactive Tabbed Audit Sections ─────────────────────────────── */}
      <div className="rounded-2xl bg-white dark:bg-dark-800 border border-gray-100 dark:border-dark-700 shadow-sm overflow-hidden">
        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 pt-5 pb-3 border-b border-gray-100 dark:border-dark-700">
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {[
              {
                id: 'cancelled',
                label: isAr ? 'الفواتير الملغاة' : 'Voided Invoices',
                count: cancelledList.length,
                icon: XCircle,
              },
              {
                id: 'discounts',
                label: isAr ? 'تدقيق الخصومات' : 'Discounts Audit',
                count: highDiscountsList.length,
                icon: Percent,
              },
              {
                id: 'expenses',
                label: isAr ? 'توثيق المصروفات' : 'Expense Verification',
                count: expensesList.length,
                icon: Receipt,
              },
              {
                id: 'payments',
                label: isAr ? 'وسائل الدفع والسندات' : 'Payments & Methods',
                count: paymentMethods.length,
                icon: CreditCard,
              },
              {
                id: 'users',
                label: isAr ? 'حوكمة المستخدمين' : 'User Governance',
                count: usersList.length,
                icon: Users,
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
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                      active ? 'bg-white/20 text-white' : 'bg-gray-200 dark:bg-dark-600 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isAr ? 'بحث في السجلات...' : 'Search records...'}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-gray-200 dark:border-dark-600 bg-gray-50/50 dark:bg-dark-700 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>

        {/* Tab 1: Cancelled / Voided Invoices */}
        {activeTab === 'cancelled' && (
          <div>
            <div className="px-6 py-3 bg-gray-50/50 dark:bg-dark-700/20 flex items-center justify-between border-b border-gray-100 dark:border-dark-700">
              <span className="text-xs text-gray-500">
                {isAr
                  ? 'سجل تفصيلي بالفواتير الملغاة أو المرتجعة للتحقق من أسباب الإلغاء ومنع تسرب الإيرادات.'
                  : 'Detailed audit log of voided/credited invoices to prevent unauthorized revenue leakage.'}
              </span>
              <ExportMenu
                language={language}
                t={t}
                rows={filteredCancelled}
                columns={[
                  { key: 'invoiceNumber', label: isAr ? 'رقم الفاتورة' : 'Invoice #' },
                  { key: 'issueDate', label: isAr ? 'التاريخ' : 'Date', value: (r) => new Date(r.issueDate).toLocaleDateString() },
                  { key: 'customerName', label: isAr ? 'العميل' : 'Customer' },
                  { key: 'amount', label: isAr ? 'المبلغ' : 'Amount' },
                  { key: 'cancelReason', label: isAr ? 'سبب الإلغاء' : 'Reason' },
                  { key: 'cancelledBy', label: isAr ? 'ألغيت بواسطة' : 'Cancelled By' },
                ]}
                fileBaseName="internal_audit_cancelled_invoices"
                title={isAr ? 'الفواتير الملغاة' : 'Voided Invoices'}
                disabled={filteredCancelled.length === 0}
              />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left rtl:text-right">
                <thead className="bg-gray-50 dark:bg-dark-700/40 text-gray-400 uppercase font-semibold">
                  <tr>
                    <th className="px-6 py-3">{isAr ? 'رقم الفاتورة' : 'Invoice #'}</th>
                    <th className="px-6 py-3">{isAr ? 'التاريخ' : 'Date'}</th>
                    <th className="px-6 py-3">{isAr ? 'العميل' : 'Customer'}</th>
                    <th className="px-6 py-3">{isAr ? 'المبلغ' : 'Amount'}</th>
                    <th className="px-6 py-3">{isAr ? 'سبب الإلغاء' : 'Reason'}</th>
                    <th className="px-6 py-3">{isAr ? 'ألغيت بواسطة' : 'Cancelled By'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-dark-700">
                  {filteredCancelled.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="px-6 py-8 text-center text-gray-400">
                        {isAr ? 'لا توجد فواتير ملغاة في هذه الفترة (ممتاز)' : 'No voided invoices in this period (Excellent)'}
                      </td>
                    </tr>
                  ) : (
                    filteredCancelled.map((inv, i) => (
                      <tr key={i} className="hover:bg-gray-50/80 dark:hover:bg-dark-700/30 transition-colors">
                        <td className="px-6 py-3.5 font-bold text-gray-900 dark:text-white">{inv.invoiceNumber}</td>
                        <td className="px-6 py-3.5 text-gray-500">
                          {inv.issueDate ? new Date(inv.issueDate).toLocaleDateString() : '-'}
                        </td>
                        <td className="px-6 py-3.5 text-gray-700 dark:text-gray-300">{inv.customerName}</td>
                        <td className="px-6 py-3.5 font-semibold text-rose-600 dark:text-rose-400">
                          <Money value={inv.amount} />
                        </td>
                        <td className="px-6 py-3.5 text-gray-600 dark:text-gray-400">{inv.cancelReason}</td>
                        <td className="px-6 py-3.5 text-gray-500">{inv.cancelledBy}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 2: High Discounts Audit */}
        {activeTab === 'discounts' && (
          <div>
            <div className="px-6 py-3 bg-gray-50/50 dark:bg-dark-700/20 flex items-center justify-between border-b border-gray-100 dark:border-dark-700">
              <span className="text-xs text-gray-500">
                {isAr
                  ? 'فحص الفواتير التي تحتوي على خصومات مباشرة للتحقق من عدم تجاوز صلاحيات البيع.'
                  : 'Scrutiny of invoices with high discounts or price reductions to ensure pricing compliance.'}
              </span>
              <ExportMenu
                language={language}
                t={t}
                rows={filteredDiscounts}
                columns={[
                  { key: 'invoiceNumber', label: isAr ? 'رقم الفاتورة' : 'Invoice #' },
                  { key: 'issueDate', label: isAr ? 'التاريخ' : 'Date', value: (r) => new Date(r.issueDate).toLocaleDateString() },
                  { key: 'customerName', label: isAr ? 'العميل' : 'Customer' },
                  { key: 'subtotal', label: isAr ? 'المبلغ قبل الخصم' : 'Subtotal' },
                  { key: 'discountAmount', label: isAr ? 'الخصم' : 'Discount' },
                  { key: 'discountPct', label: isAr ? 'نسبة الخصم' : 'Discount %' },
                  { key: 'totalAmount', label: isAr ? 'الإجمالي النهائي' : 'Total' },
                ]}
                fileBaseName="internal_audit_high_discounts"
                title={isAr ? 'تدقيق الخصومات' : 'Discounts Audit'}
                disabled={filteredDiscounts.length === 0}
              />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left rtl:text-right">
                <thead className="bg-gray-50 dark:bg-dark-700/40 text-gray-400 uppercase font-semibold">
                  <tr>
                    <th className="px-6 py-3">{isAr ? 'رقم الفاتورة' : 'Invoice #'}</th>
                    <th className="px-6 py-3">{isAr ? 'التاريخ' : 'Date'}</th>
                    <th className="px-6 py-3">{isAr ? 'العميل' : 'Customer'}</th>
                    <th className="px-6 py-3">{isAr ? 'قبل الخصم' : 'Subtotal'}</th>
                    <th className="px-6 py-3">{isAr ? 'قيمة الخصم' : 'Discount'}</th>
                    <th className="px-6 py-3">{isAr ? 'النسبة' : 'Discount %'}</th>
                    <th className="px-6 py-3">{isAr ? 'الإجمالي بعد الخصم' : 'Net Total'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-dark-700">
                  {filteredDiscounts.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="px-6 py-8 text-center text-gray-400">
                        {isAr ? 'لا توجد خصومات استثنائية مسجلة' : 'No abnormal discounts recorded'}
                      </td>
                    </tr>
                  ) : (
                    filteredDiscounts.map((inv, i) => (
                      <tr key={i} className="hover:bg-gray-50/80 dark:hover:bg-dark-700/30 transition-colors">
                        <td className="px-6 py-3.5 font-bold text-gray-900 dark:text-white">{inv.invoiceNumber}</td>
                        <td className="px-6 py-3.5 text-gray-500">
                          {inv.issueDate ? new Date(inv.issueDate).toLocaleDateString() : '-'}
                        </td>
                        <td className="px-6 py-3.5 text-gray-700 dark:text-gray-300">{inv.customerName}</td>
                        <td className="px-6 py-3.5 text-gray-500">
                          <Money value={inv.subtotal} />
                        </td>
                        <td className="px-6 py-3.5 font-bold text-amber-600 dark:text-amber-400">
                          <Money value={inv.discountAmount} />
                        </td>
                        <td className="px-6 py-3.5">
                          <span className="px-2 py-0.5 rounded-md font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 text-[10px]">
                            {inv.discountPct}
                          </span>
                        </td>
                        <td className="px-6 py-3.5 font-bold text-gray-900 dark:text-white">
                          <Money value={inv.totalAmount} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 3: Expense Policy Verification */}
        {activeTab === 'expenses' && (
          <div>
            <div className="px-6 py-3 bg-gray-50/50 dark:bg-dark-700/20 flex items-center justify-between border-b border-gray-100 dark:border-dark-700">
              <span className="text-xs text-gray-500">
                {isAr
                  ? 'مراجعة سندات الصرف الكبرى والتأكد من إرفاق الفواتير الضريبية والإيصالات الثبوتية.'
                  : 'Verification of high-value expenses and digital receipt/attachment policy compliance.'}
              </span>
              <ExportMenu
                language={language}
                t={t}
                rows={filteredExpenses}
                columns={[
                  { key: 'expenseNumber', label: isAr ? 'رقم السند' : 'Expense #' },
                  { key: 'date', label: isAr ? 'التاريخ' : 'Date', value: (r) => new Date(r.date).toLocaleDateString() },
                  { key: 'category', label: isAr ? 'التصنيف' : 'Category' },
                  { key: 'totalAmount', label: isAr ? 'المبلغ' : 'Amount' },
                  { key: 'hasReceipt', label: isAr ? 'المرفق' : 'Receipt', value: (r) => (r.hasReceipt ? 'Yes' : 'No') },
                  { key: 'createdBy', label: isAr ? 'المستخدم' : 'Created By' },
                ]}
                fileBaseName="internal_audit_expenses"
                title={isAr ? 'توثيق المصروفات' : 'Expense Verification'}
                disabled={filteredExpenses.length === 0}
              />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left rtl:text-right">
                <thead className="bg-gray-50 dark:bg-dark-700/40 text-gray-400 uppercase font-semibold">
                  <tr>
                    <th className="px-6 py-3">{isAr ? 'رقم السند' : 'Expense #'}</th>
                    <th className="px-6 py-3">{isAr ? 'التاريخ' : 'Date'}</th>
                    <th className="px-6 py-3">{isAr ? 'التصنيف' : 'Category'}</th>
                    <th className="px-6 py-3">{isAr ? 'المبلغ الإجمالي' : 'Total Amount'}</th>
                    <th className="px-6 py-3">{isAr ? 'حالة المرفق / الإيصال' : 'Receipt Status'}</th>
                    <th className="px-6 py-3">{isAr ? 'سجل بواسطة' : 'Recorded By'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-dark-700">
                  {filteredExpenses.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="px-6 py-8 text-center text-gray-400">
                        {isAr ? 'لا توجد مصروفات مسجلة' : 'No expenses recorded'}
                      </td>
                    </tr>
                  ) : (
                    filteredExpenses.map((exp, i) => (
                      <tr key={i} className="hover:bg-gray-50/80 dark:hover:bg-dark-700/30 transition-colors">
                        <td className="px-6 py-3.5 font-bold text-gray-900 dark:text-white">{exp.expenseNumber}</td>
                        <td className="px-6 py-3.5 text-gray-500">
                          {exp.date ? new Date(exp.date).toLocaleDateString() : '-'}
                        </td>
                        <td className="px-6 py-3.5 text-gray-700 dark:text-gray-300">{exp.category}</td>
                        <td className="px-6 py-3.5 font-semibold text-gray-900 dark:text-white">
                          <Money value={exp.totalAmount} />
                        </td>
                        <td className="px-6 py-3.5">
                          {exp.hasReceipt ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              {isAr ? 'مرفق وموثق' : 'Attached'}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                              <XCircle className="w-3.5 h-3.5" />
                              {isAr ? 'غير مرفق (مخالفة)' : 'Missing Receipt'}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-3.5 text-gray-500">{exp.createdBy}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 4: Payments & Methods */}
        {activeTab === 'payments' && (
          <div>
            <div className="px-6 py-3 bg-gray-50/50 dark:bg-dark-700/20 border-b border-gray-100 dark:border-dark-700">
              <span className="text-xs text-gray-500">
                {isAr
                  ? 'توزيع الإيرادات المحصلة حسب قناة الدفع لمطابقة اليومية النقدية والبنكية.'
                  : 'Revenue distribution across payment methods for daily cash and bank reconciliation.'}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left rtl:text-right">
                <thead className="bg-gray-50 dark:bg-dark-700/40 text-gray-400 uppercase font-semibold">
                  <tr>
                    <th className="px-6 py-3">{isAr ? 'وسيلة الدفع' : 'Payment Method'}</th>
                    <th className="px-6 py-3">{isAr ? 'عدد العمليات' : 'Transactions'}</th>
                    <th className="px-6 py-3">{isAr ? 'إجمالي المبالغ' : 'Total Amount'}</th>
                    <th className="px-6 py-3">{isAr ? 'نسبة المساهمة' : 'Revenue Share'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-dark-700">
                  {paymentMethods.map((pm, i) => (
                    <tr key={i} className="hover:bg-gray-50/80 dark:hover:bg-dark-700/30 transition-colors">
                      <td className="px-6 py-3.5 font-bold text-gray-900 dark:text-white uppercase">{pm.method}</td>
                      <td className="px-6 py-3.5 text-gray-700 dark:text-gray-300">{pm.count}</td>
                      <td className="px-6 py-3.5 font-semibold text-primary-600 dark:text-primary-400">
                        <Money value={pm.totalAmount} />
                      </td>
                      <td className="px-6 py-3.5 font-bold text-gray-900 dark:text-white">{pm.percentage}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 5: User Governance */}
        {activeTab === 'users' && (
          <div>
            <div className="px-6 py-3 bg-gray-50/50 dark:bg-dark-700/20 border-b border-gray-100 dark:border-dark-700">
              <span className="text-xs text-gray-500">
                {isAr
                  ? 'مراجعة صلاحيات الوصول وتوزيع المهام المالية والفصل بين المسؤوليات (Segregation of Duties).'
                  : 'Review user access permissions, financial roles, and segregation of duties.'}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left rtl:text-right">
                <thead className="bg-gray-50 dark:bg-dark-700/40 text-gray-400 uppercase font-semibold">
                  <tr>
                    <th className="px-6 py-3">{isAr ? 'المستخدم' : 'User'}</th>
                    <th className="px-6 py-3">{isAr ? 'البريد الإلكتروني' : 'Email'}</th>
                    <th className="px-6 py-3">{isAr ? 'الدور والصلاحية' : 'Role'}</th>
                    <th className="px-6 py-3">{isAr ? 'الحالة' : 'Status'}</th>
                    <th className="px-6 py-3">{isAr ? 'آخر تسجيل دخول' : 'Last Login'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-dark-700">
                  {usersList.map((u, i) => (
                    <tr key={i} className="hover:bg-gray-50/80 dark:hover:bg-dark-700/30 transition-colors">
                      <td className="px-6 py-3.5 font-bold text-gray-900 dark:text-white">{u.name}</td>
                      <td className="px-6 py-3.5 text-gray-500">{u.email}</td>
                      <td className="px-6 py-3.5 font-semibold text-indigo-600 dark:text-indigo-400">{u.role}</td>
                      <td className="px-6 py-3.5">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
                          {u.status}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-gray-400">
                        {u.lastLogin ? new Date(u.lastLogin).toLocaleString() : (isAr ? 'غير مسجل' : 'Never')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
