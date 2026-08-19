import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Building2,
  Settings,
  FileText,
  ArrowUpCircle,
  ArrowDownCircle,
  AlertCircle,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  Award,
  Clock,
  RotateCcw,
  Plus,
  Phone,
  Mail,
  MapPin,
  CreditCard,
  Building,
  CheckCircle2,
  ExternalLink,
  DollarSign,
  Package,
} from 'lucide-react'
import api from '../lib/api'
import { useTranslation } from '../lib/translations'
import Money from '../components/ui/Money'

const GRADE_STYLES = {
  A: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 ring-emerald-500/20',
  B: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 ring-amber-500/20',
  C: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30 ring-rose-500/20',
}

export default function SupplierDashboard() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { language } = useSelector((state) => state.ui)
  const { t } = useTranslation(language)
  const isAr = language === 'ar'
  const [activeTab, setActiveTab] = useState('orders')

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['supplier-dashboard', id],
    queryFn: () => api.get(`/suppliers/${id}/dashboard`).then((res) => res.data),
    enabled: Boolean(id),
  })

  if (isLoading) {
    return (
      <div className="flex h-72 flex-col items-center justify-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-950 dark:border-slate-600 dark:border-t-white" />
        <p className="text-xs text-slate-400">
          {isAr ? 'جاري تحميل بيانات المورد...' : 'Loading supplier performance...'}
        </p>
      </div>
    )
  }

  if (isError || !data || !data.supplier) {
    return (
      <div className="mx-auto max-w-xl py-12">
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-white p-10 text-center shadow-xs dark:border-white/10 dark:bg-[#0c111a]">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">
            <AlertCircle className="h-7 w-7" />
          </div>
          <h3 className="mt-4 text-base font-bold text-slate-900 dark:text-white">
            {isAr ? 'المورد غير موجود' : 'Supplier Not Found'}
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            {isAr
              ? 'لم يتم العثور على المورد المطلوب أو تم حذفه من النظام.'
              : 'The requested supplier record could not be found or may have been deleted.'}
          </p>
          <div className="mt-6 flex gap-3">
            <button
              onClick={() => navigate('/app/dashboard/suppliers')}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
            >
              <ArrowLeft className={`h-4 w-4 ${isAr ? 'rotate-180' : ''}`} />
              {isAr ? 'العودة لقائمة الموردين' : 'Back to Suppliers'}
            </button>
            <button
              onClick={() => refetch()}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
            >
              {isAr ? 'إعادة المحاولة' : 'Retry'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  const { supplier, orders = [], returns = [], grns = [], financials = {}, performance = {} } = data
  const name = isAr ? supplier.nameAr || supplier.nameEn : supplier.nameEn || supplier.nameAr
  const grade = performance.grade || 'A'
  const gradeClass = GRADE_STYLES[grade] || GRADE_STYLES.A

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Actions Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3.5">
          <button
            onClick={() => navigate('/app/dashboard/suppliers')}
            title={isAr ? 'العودة' : 'Back'}
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 shadow-2xs transition hover:bg-slate-50 dark:border-white/10 dark:bg-dark-800 dark:text-slate-300 dark:hover:bg-dark-700"
          >
            <ArrowLeft className={`h-5 w-5 ${isAr ? 'rotate-180' : ''}`} />
          </button>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                {name}
              </h1>
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider ${
                  supplier.isActive
                    ? 'border-emerald-500/20 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
                    : 'border-slate-300 bg-slate-100 text-slate-600 dark:bg-dark-700 dark:text-slate-400'
                }`}
              >
                {supplier.isActive ? (isAr ? 'نشط' : 'Active') : (isAr ? 'غير نشط' : 'Inactive')}
              </span>
            </div>
            <div className="mt-1 flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
              <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                {supplier.code}
              </span>
              {supplier.vatNumber && (
                <span>
                  {isAr ? 'الرقم الضريبي: ' : 'VAT: '}
                  <span className="font-mono">{supplier.vatNumber}</span>
                </span>
              )}
              {supplier.contactPerson && (
                <span>• {supplier.contactPerson}</span>
              )}
            </div>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to={`/app/dashboard/purchases/orders/new?supplierId=${supplier._id}`}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-500"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>{isAr ? 'طلب شراء جديد' : 'New Purchase Order'}</span>
          </Link>

          <Link
            to="/app/dashboard/supplier-performance"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-2xs transition hover:bg-slate-50 dark:border-white/10 dark:bg-dark-800 dark:text-slate-200 dark:hover:bg-dark-700"
          >
            <TrendingUp className="h-3.5 w-3.5 text-blue-500" />
            <span>{isAr ? 'تحليلات الأداء' : 'All Performance'}</span>
          </Link>

          <Link
            to={`/app/dashboard/suppliers/${id}/edit`}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-2xs transition hover:bg-slate-50 dark:border-white/10 dark:bg-dark-800 dark:text-slate-200 dark:hover:bg-dark-700"
          >
            <Settings className="h-3.5 w-3.5 text-slate-500" />
            <span>{isAr ? 'تعديل البيانات' : 'Edit Supplier'}</span>
          </Link>
        </div>
      </div>

      {/* KPI Performance & Financial Summary Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Supplier Score & Grade */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl border border-slate-200/90 bg-white p-5 shadow-xs dark:border-white/10 dark:bg-[#0c111a]"
        >
          <div className="flex items-center justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400">
              <Award className="h-5 w-5" />
            </div>
            <span
              className={`inline-flex items-center gap-1 rounded-xl border px-3 py-1 text-sm font-black ring-1 ${gradeClass}`}
            >
              {isAr ? `الفئة ${grade}` : `Grade ${grade}`}
            </span>
          </div>
          <div className="mt-4">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              {isAr ? 'تقييم الأداء الكلي' : 'Supplier Score'}
            </p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900 dark:text-white">
                {performance.score || 85}
              </span>
              <span className="text-xs font-bold text-slate-400">/ 100</span>
            </div>
            <p className="mt-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
              {isAr
                ? `نسبة التوصيل بالوقت: ${performance.onTimeRate ?? 100}%`
                : `${performance.onTimeRate ?? 100}% On-time delivery`}
            </p>
          </div>
        </motion.div>

        {/* Total Spend */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-3xl border border-slate-200/90 bg-white p-5 shadow-xs dark:border-white/10 dark:bg-[#0c111a]"
        >
          <div className="flex items-center justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
              <DollarSign className="h-5 w-5" />
            </div>
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
              {orders.length} {isAr ? 'طلب' : 'Orders'}
            </span>
          </div>
          <div className="mt-4">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              {isAr ? 'إجمالي المشتريات' : 'Total Spend'}
            </p>
            <div className="mt-1 text-2xl font-black text-slate-900 dark:text-white">
              <Money value={financials.totalCredit || performance.totalSpend || 0} />
            </div>
            <p className="mt-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
              {isAr
                ? `متوسط الطلب: `
                : `Avg order: `}
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                <Money value={performance.avgOrderValue || 0} />
              </span>
            </p>
          </div>
        </motion.div>

        {/* Outstanding Balance */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-3xl border border-slate-200/90 bg-white p-5 shadow-xs dark:border-white/10 dark:bg-[#0c111a]"
        >
          <div className="flex items-center justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
              <Wallet className="h-5 w-5" />
            </div>
            <span className="text-[11px] font-bold text-slate-400">
              {isAr ? 'الرصيد' : 'Ledger'}
            </span>
          </div>
          <div className="mt-4">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              {isAr ? 'الرصيد المتبقي للمورد' : 'Payable Balance'}
            </p>
            <div className="mt-1 text-2xl font-black text-blue-600 dark:text-blue-400">
              <Money value={financials.balance || 0} />
            </div>
            <p className="mt-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
              {isAr ? 'الدائن: ' : 'Credit: '}
              <Money value={financials.totalCredit || 0} />
              {' · '}
              {isAr ? 'المدين: ' : 'Debit: '}
              <Money value={financials.totalDebit || 0} />
            </p>
          </div>
        </motion.div>

        {/* Quality & Returns */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="rounded-3xl border border-slate-200/90 bg-white p-5 shadow-xs dark:border-white/10 dark:bg-[#0c111a]"
        >
          <div className="flex items-center justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
              <RotateCcw className="h-5 w-5" />
            </div>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                (performance.returnRate || 0) < 2
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
                  : 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400'
              }`}
            >
              {returns.length} {isAr ? 'مرتجع' : 'Returns'}
            </span>
          </div>
          <div className="mt-4">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              {isAr ? 'معدل المرتجعات والجودة' : 'Return Rate'}
            </p>
            <div className="mt-1 text-2xl font-black text-slate-900 dark:text-white">
              {performance.returnRate ? `${performance.returnRate}%` : '0%'}
            </div>
            <p className="mt-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
              {isAr
                ? `${grns.length} سند استلام بضاعة مسجل`
                : `${grns.length} GRNs processed successfully`}
            </p>
          </div>
        </motion.div>
      </div>

      {/* Main Grid: Details Sidebar + Interactive Document Tabs */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Supplier Profile & Contact Details */}
        <div className="space-y-6 lg:col-span-1">
          <div className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-xs dark:border-white/10 dark:bg-[#0c111a]">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4 dark:border-white/5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
                <Building2 className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {isAr ? 'بيانات المورد والاتصال' : 'Supplier Profile'}
                </h3>
                <p className="text-[11px] text-slate-500">
                  {supplier.type === 'individual' ? (isAr ? 'فردي' : 'Individual') : (isAr ? 'شركة' : 'Company')}
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-4 text-xs">
              {supplier.phone && (
                <div className="flex items-start gap-3">
                  <Phone className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-slate-400 text-[11px]">{isAr ? 'الهاتف' : 'Phone'}</p>
                    <a href={`tel:${supplier.phone}`} className="font-semibold text-slate-800 hover:text-emerald-600 dark:text-slate-200">
                      {supplier.phone}
                    </a>
                  </div>
                </div>
              )}

              {supplier.email && (
                <div className="flex items-start gap-3">
                  <Mail className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-slate-400 text-[11px]">{isAr ? 'البريد الإلكتروني' : 'Email'}</p>
                    <a href={`mailto:${supplier.email}`} className="font-semibold text-slate-800 hover:text-emerald-600 dark:text-slate-200">
                      {supplier.email}
                    </a>
                  </div>
                </div>
              )}

              {supplier.address?.city && (
                <div className="flex items-start gap-3">
                  <MapPin className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-slate-400 text-[11px]">{isAr ? 'العنوان' : 'Address'}</p>
                    <p className="font-semibold text-slate-800 dark:text-slate-200">
                      {[supplier.address.street, supplier.address.district, supplier.address.city, supplier.address.country].filter(Boolean).join(', ')}
                    </p>
                  </div>
                </div>
              )}

              {supplier.paymentTerms?.term && (
                <div className="flex items-start gap-3">
                  <Clock className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-slate-400 text-[11px]">{isAr ? 'شروط الدفع' : 'Payment Terms'}</p>
                    <p className="font-semibold text-slate-800 dark:text-slate-200 uppercase">
                      {supplier.paymentTerms.term.replace('_', ' ')}
                    </p>
                  </div>
                </div>
              )}

              {supplier.bank?.iban && (
                <div className="flex items-start gap-3 border-t border-slate-100 pt-3 dark:border-white/5">
                  <CreditCard className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-slate-400 text-[11px]">{isAr ? 'بيانات البنك وIBAN' : 'Bank & IBAN'}</p>
                    <p className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200">
                      {supplier.bank.iban}
                    </p>
                    {supplier.bank.bankName && (
                      <p className="text-[11px] text-slate-500 mt-0.5">{supplier.bank.bankName}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Transactions & Activity Hub */}
        <div className="space-y-6 lg:col-span-2">
          <div className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-xs dark:border-white/10 dark:bg-[#0c111a]">
            {/* Tabs Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-white/5">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('orders')}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                    activeTab === 'orders'
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950 shadow-2xs'
                      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-dark-800'
                  }`}
                >
                  <FileText className="h-3.5 w-3.5" />
                  <span>{isAr ? 'طلبات الشراء' : 'Purchase Orders'} ({orders.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('grns')}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                    activeTab === 'grns'
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950 shadow-2xs'
                      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-dark-800'
                  }`}
                >
                  <ArrowDownCircle className="h-3.5 w-3.5" />
                  <span>{isAr ? 'سندات الاستلام (GRN)' : 'GRNs'} ({grns.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('returns')}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                    activeTab === 'returns'
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950 shadow-2xs'
                      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-dark-800'
                  }`}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>{isAr ? 'المرتجعات' : 'Returns'} ({returns.length})</span>
                </button>
              </div>
            </div>

            {/* Tab 1: Orders */}
            {activeTab === 'orders' && (
              <div className="mt-4 space-y-2.5">
                {orders.length === 0 ? (
                  <div className="py-12 text-center text-xs text-slate-400">
                    {isAr ? 'لا توجد طلبات شراء مسجلة لهذا المورد' : 'No purchase orders recorded for this supplier'}
                  </div>
                ) : (
                  orders.map((po) => (
                    <Link
                      to={`/app/dashboard/purchases/orders/${po._id}`}
                      key={po._id}
                      className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5 transition hover:border-slate-300 hover:bg-white dark:border-white/5 dark:bg-white/[0.02] dark:hover:bg-white/[0.05]"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400">
                          <FileText className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                            {po.poNumber}
                          </p>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {po.orderDate ? new Date(po.orderDate).toLocaleDateString() : ''} · {po.lineItems?.length || 0} {isAr ? 'بنود' : 'items'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="rounded-full bg-slate-200/80 px-2.5 py-0.5 text-[10.5px] font-bold text-slate-700 dark:bg-white/10 dark:text-slate-300 capitalize">
                          {po.status ? po.status.replace('_', ' ') : 'draft'}
                        </span>
                        <div className="text-end font-mono text-xs font-black text-slate-900 dark:text-white">
                          <Money value={po.grandTotal || 0} />
                        </div>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            )}

            {/* Tab 2: GRNs */}
            {activeTab === 'grns' && (
              <div className="mt-4 space-y-2.5">
                {grns.length === 0 ? (
                  <div className="py-12 text-center text-xs text-slate-400">
                    {isAr ? 'لا توجد سندات استلام مسجلة لهذا المورد' : 'No GRNs recorded for this supplier'}
                  </div>
                ) : (
                  grns.map((grn) => (
                    <Link
                      to={`/app/dashboard/purchases/grn/${grn._id}`}
                      key={grn._id}
                      className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5 transition hover:border-slate-300 hover:bg-white dark:border-white/5 dark:bg-white/[0.02] dark:hover:bg-white/[0.05]"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
                          <ArrowDownCircle className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                            {grn.grnNumber}
                          </p>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {grn.dateReceived ? new Date(grn.dateReceived).toLocaleDateString() : ''}
                          </p>
                        </div>
                      </div>

                      <span className="rounded-full bg-slate-200/80 px-2.5 py-0.5 text-[10.5px] font-bold text-slate-700 dark:bg-white/10 dark:text-slate-300 capitalize">
                        {grn.status || 'received'}
                      </span>
                    </Link>
                  ))
                )}
              </div>
            )}

            {/* Tab 3: Returns */}
            {activeTab === 'returns' && (
              <div className="mt-4 space-y-2.5">
                {returns.length === 0 ? (
                  <div className="py-12 text-center text-xs text-slate-400">
                    {isAr ? 'لا توجد مرتجعات مسجلة لهذا المورد' : 'No purchase returns recorded for this supplier'}
                  </div>
                ) : (
                  returns.map((ret) => {
                    const returnQty = (ret.lines || []).reduce((sum, l) => sum + (l.quantityReturned || 0), 0)
                    return (
                      <Link
                        to={`/app/dashboard/purchases/returns/${ret._id}`}
                        key={ret._id}
                        className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5 transition hover:border-slate-300 hover:bg-white dark:border-white/5 dark:bg-white/[0.02] dark:hover:bg-white/[0.05]"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">
                            <RotateCcw className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                              {ret.returnNumber}
                            </p>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              {ret.dateReturned ? new Date(ret.dateReturned).toLocaleDateString() : ''} · {returnQty} {isAr ? 'وحدة مرتجعة' : 'units'}
                            </p>
                          </div>
                        </div>

                        <div className="font-mono text-xs font-bold text-rose-600 dark:text-rose-400">
                          <Money value={ret.grandTotal || ret.totalAmount || 0} />
                        </div>
                      </Link>
                    )
                  })
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
