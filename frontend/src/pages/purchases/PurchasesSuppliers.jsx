import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search,
  Plus,
  Building2,
  Phone,
  Mail,
  FileText,
  CreditCard,
  Package,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Printer,
  Download,
  Send,
  MessageCircle,
  Clock,
  CheckCircle2,
  AlertCircle,
  Warehouse as WarehouseIcon,
  UserPlus,
  Loader2,
  X,
  Save,
  Eye,
  Receipt,
  Sparkles,
  Image as ImageIcon
} from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import { useTranslation } from '../../lib/translations'
import Money from '../../components/ui/Money'
import { downloadPurchaseOrderPdf, printPurchaseOrderPdf } from '../../lib/invoicePdf'
import RecordPoPaymentModal from '../../components/purchases/RecordPoPaymentModal'
import ReceiptLightboxModal from '../../components/purchases/ReceiptLightboxModal'
import { showArabicFields as isArabicTenantMarket } from '../../lib/saudiTenant'

const STATUS_PILL = {
  billed: 'bg-violet-50 text-violet-700 ring-violet-200/70 dark:bg-violet-500/10 dark:text-violet-300 dark:ring-violet-500/20',
  received: 'bg-emerald-50 text-emerald-700 ring-emerald-200/70 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/20',
  partially_received: 'bg-amber-50 text-amber-800 ring-amber-200/70 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/20',
  cancelled: 'bg-rose-50 text-rose-700 ring-rose-200/70 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/20',
  approved: 'bg-teal-50 text-teal-800 ring-teal-200/80 dark:bg-teal-500/10 dark:text-teal-300 dark:ring-teal-500/20',
  sent: 'bg-sky-50 text-sky-800 ring-sky-200/80 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-500/20',
  draft: 'bg-slate-50 text-slate-500 ring-slate-200/70 dark:bg-white/[0.04] dark:text-slate-400 dark:ring-white/10',
}

const PAYMENT_STATUS_PILL = {
  pending: 'bg-slate-50 text-slate-500 ring-slate-200/70 dark:bg-white/[0.04] dark:text-slate-400 dark:ring-white/10',
  partial: 'bg-amber-50 text-amber-800 ring-amber-200/70 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/20',
  paid: 'bg-emerald-50 text-emerald-700 ring-emerald-200/70 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/20',
  overdue: 'bg-rose-50 text-rose-700 ring-rose-200/70 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/20',
}

export default function PurchasesSuppliers() {
  const { language } = useSelector((state) => state.ui)
  const { tenant } = useSelector((state) => state.auth)
  const { t } = useTranslation(language)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [search, setSearch] = useState('')
  const [balanceFilter, setBalanceFilter] = useState('all') // 'all', 'has_balance', 'zero_balance'
  const [expandedSupplierId, setExpandedSupplierId] = useState(null)
  const [showAddSupplierModal, setShowAddSupplierModal] = useState(false)
  const [selectedPoForPayment, setSelectedPoForPayment] = useState(null)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [receiptModalUrl, setReceiptModalUrl] = useState(null)
  const [receiptModalTitle, setReceiptModalTitle] = useState('')
  const [supplierForm, setSupplierForm] = useState({
    code: '',
    nameEn: '',
    nameAr: '',
    contactPerson: '',
    phone: '',
    email: '',
    vatNumber: '',
  })

  // Queries
  const { data: suppliersData, isLoading: suppliersLoading } = useQuery({
    queryKey: ['suppliers-list'],
    queryFn: () => api.get('/suppliers', { params: { limit: 500 } }).then((res) => res.data.suppliers || []),
  })

  const { data: financialsData } = useQuery({
    queryKey: ['suppliers-financials'],
    queryFn: () => api.get('/suppliers/financials').then((res) => res.data || []),
  })

  const { data: allOrdersData, isLoading: ordersLoading } = useQuery({
    queryKey: ['purchase-orders-all'],
    queryFn: () => api.get('/purchase-orders', { params: { limit: 1000 } }).then((res) => res.data.purchaseOrders || []),
  })

  const addSupplierMutation = useMutation({
    mutationFn: (data) => api.post('/suppliers', data),
    onSuccess: () => {
      toast.success(language === 'ar' ? 'تم إضافة المورد بنجاح' : 'Supplier added successfully')
      queryClient.invalidateQueries(['suppliers-list'])
      queryClient.invalidateQueries(['suppliers-financials'])
      setShowAddSupplierModal(false)
      setSupplierForm({ code: '', nameEn: '', nameAr: '', contactPerson: '', phone: '', email: '', vatNumber: '' })
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Error adding supplier'),
  })

  // Map POs and financials by Supplier ID
  const suppliersWithPOs = useMemo(() => {
    const financialsMap = new Map((financialsData || []).map((f) => [String(f._id), f]))
    const ordersList = allOrdersData || []

    return (suppliersData || []).map((supp) => {
      const suppId = String(supp._id)
      const suppOrders = ordersList.filter((o) => String(o.supplierId?._id || o.supplierId) === suppId)

      const totalSpend = Math.round(suppOrders.reduce((sum, o) => sum + Number(o.grandTotal || 0), 0) * 100) / 100
      const totalPaid = Math.round(suppOrders.reduce((sum, o) => sum + Number(o.paidAmount || 0), 0) * 100) / 100
      const totalBalance = Math.round((totalSpend - totalPaid) * 100) / 100

      const statusCounts = {
        draft: 0,
        approved: 0,
        sent: 0,
        partially_received: 0,
        received: 0,
        cancelled: 0,
      }
      suppOrders.forEach((o) => {
        if (statusCounts[o.status] != null) statusCounts[o.status] += 1
      })

      return {
        ...supp,
        orders: suppOrders,
        totalSpend,
        totalPaid,
        totalBalance,
        totalPOsCount: suppOrders.length,
        openPOsCount: suppOrders.filter((o) => ['draft', 'approved', 'sent', 'partially_received'].includes(o.status)).length,
        statusCounts,
      }
    })
  }, [suppliersData, financialsData, allOrdersData])

  // Filtered suppliers
  const filteredSuppliers = useMemo(() => {
    const q = search.trim().toLowerCase()
    return suppliersWithPOs.filter((s) => {
      const matchSearch =
        !q ||
        (s.nameEn && s.nameEn.toLowerCase().includes(q)) ||
        (s.nameAr && s.nameAr.toLowerCase().includes(q)) ||
        (s.code && s.code.toLowerCase().includes(q)) ||
        (s.phone && s.phone.includes(q)) ||
        (s.email && s.email.toLowerCase().includes(q)) ||
        (s.vatNumber && s.vatNumber.includes(q))

      let matchBalance = true
      if (balanceFilter === 'has_balance') matchBalance = s.totalBalance > 0
      if (balanceFilter === 'advance') matchBalance = s.totalBalance < 0
      if (balanceFilter === 'zero_balance') matchBalance = s.totalBalance === 0 && s.totalSpend > 0

      return matchSearch && matchBalance
    })
  }, [suppliersWithPOs, search, balanceFilter])

  // Aggregate KPIs
  const totalSuppliersCount = suppliersWithPOs.length
  const totalSpendAll = Math.round(suppliersWithPOs.reduce((sum, s) => sum + s.totalSpend, 0) * 100) / 100
  const totalPaidAll = Math.round(suppliersWithPOs.reduce((sum, s) => sum + s.totalPaid, 0) * 100) / 100
  const totalBalanceAll = Math.round((totalSpendAll - totalPaidAll) * 100) / 100
  const totalOpenPOsAll = suppliersWithPOs.reduce((sum, s) => sum + s.openPOsCount, 0)
  const withBalanceCount = suppliersWithPOs.filter((s) => s.totalBalance > 0).length
  const advanceCreditCount = suppliersWithPOs.filter((s) => s.totalBalance < 0).length
  const clearedCount = suppliersWithPOs.filter((s) => s.totalBalance === 0 && s.totalSpend > 0).length

  const statusLabel = (status) => {
    const ar = {
      draft: 'مسودة',
      sent: 'مرسل',
      approved: 'معتمد',
      partially_received: 'مستلم جزئياً',
      received: 'مستلم',
      billed: 'مفوتر',
      cancelled: 'ملغي',
    }
    if (language === 'ar') return ar[status] || status
    if (status === 'partially_received') return 'Partially received'
    return status ? status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ') : status
  }

  const sendWhatsApp = (supp) => {
    if (!supp.phone) {
      toast.error(language === 'ar' ? 'لا يوجد رقم هاتف مسجل للمورد' : 'No phone number for this supplier')
      return
    }
    const cleanPhone = supp.phone.replace(/[^0-9]/g, '')
    const msg = encodeURIComponent(
      `${language === 'ar' ? 'مرحباً' : 'Hello'} ${supp.nameEn || supp.nameAr},\n` +
      `${language === 'ar' ? 'تحية طيبة من' : 'Greetings from'} ${tenant?.business?.legalNameEn || tenant?.name || 'our company'}.\n` +
      `${language === 'ar' ? 'إجمالي الطلبات:' : 'Total Orders:'} ${supp.totalPOsCount}\n` +
      `${language === 'ar' ? 'الرصيد القائم:' : 'Outstanding Balance:'} ${supp.totalBalance} SAR`
    )
    window.open(`https://api.whatsapp.com/send?phone=${cleanPhone}&text=${msg}`, '_blank')
  }

  const shell =
    'overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_16px_40px_-32px_rgba(15,23,42,0.45)] dark:border-white/10 dark:bg-[#0c111a]'
  const ghostBtn =
    'inline-flex items-center gap-1.5 rounded-xl border border-slate-200/80 bg-white px-3 py-1.5 text-[12px] font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-40 dark:border-white/10 dark:bg-transparent dark:text-slate-200 dark:hover:border-white/20'
  const primaryBtn =
    'inline-flex items-center gap-1.5 rounded-xl bg-slate-950 px-3.5 py-1.5 text-[12px] font-medium text-white transition hover:bg-slate-800 disabled:opacity-40 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100'

  return (
    <div className="space-y-6">
      {/* Top Header & Action */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-teal-700 dark:text-teal-300">
            {language === 'ar' ? 'الموردون والمشتريات' : 'Suppliers Hub'}
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-3xl">
            {language === 'ar' ? 'الموردون وطلبات الشراء' : 'Suppliers & Purchase Orders'}
          </h1>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {language === 'ar'
              ? 'تتبع جميع الموردين، أرصدتهم، وطلبات الشراء الخاصة بهم وحالاتها من مكان واحد.'
              : 'Track all suppliers, their committed spend, balances, and associated purchase orders.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowAddSupplierModal(true)}
            className={primaryBtn}
          >
            <UserPlus className="h-4 w-4 opacity-80" />
            {language === 'ar' ? 'إضافة مورد جديد' : 'Add Supplier'}
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className={shell}>
        <div className="grid grid-cols-2 gap-px bg-slate-100 sm:grid-cols-4 dark:bg-white/[0.08]">
          <div className="bg-white p-4 sm:p-5 dark:bg-[#0c111a]">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {language === 'ar' ? 'عدد الموردين' : 'Total Suppliers'}
              </span>
              <Building2 className="h-4 w-4 text-slate-300" />
            </div>
            <p className="mt-2 text-2xl font-bold text-slate-950 dark:text-white tabular-nums">
              {totalSuppliersCount}
            </p>
            <span className="text-[11px] text-slate-400">{language === 'ar' ? 'مورد معتمد' : 'Active Vendors'}</span>
          </div>

          <div className="bg-white p-4 sm:p-5 dark:bg-[#0c111a]">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {language === 'ar' ? 'إجمالي المشتريات' : 'Total Purchases Spend'}
              </span>
              <CreditCard className="h-4 w-4 text-teal-600" />
            </div>
            <p className="mt-2 text-2xl font-bold text-slate-950 dark:text-white tabular-nums">
              <Money value={totalSpendAll} />
            </p>
            <div className="mt-1 flex items-center gap-1.5 text-[11px]">
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                {language === 'ar' ? 'المدفوع:' : 'Paid:'} <Money value={totalPaidAll} />
              </span>
            </div>
          </div>

          <div className="bg-white p-4 sm:p-5 dark:bg-[#0c111a]">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {totalBalanceAll > 0
                  ? (language === 'ar' ? 'الذمم المستحقة' : 'Pending Payables')
                  : totalBalanceAll < 0
                  ? (language === 'ar' ? 'صافي الرصيد المقدم (-)' : 'Net Advance Credit (-)')
                  : (language === 'ar' ? 'الرصيد المستحق' : 'Pending Balance')}
              </span>
              <AlertCircle className={`h-4 w-4 ${totalBalanceAll > 0 ? 'text-rose-500' : totalBalanceAll < 0 ? 'text-amber-500' : 'text-slate-300'}`} />
            </div>
            <p className={`mt-2 text-2xl font-bold tabular-nums ${totalBalanceAll > 0 ? 'text-rose-600 dark:text-rose-400' : totalBalanceAll < 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-950 dark:text-white'}`}>
              <Money value={totalBalanceAll} />
            </p>
            <span className="text-[11px] text-slate-400">
              {totalBalanceAll > 0
                ? (language === 'ar' ? 'ذمم موردين مستحقة للسداد' : 'Outstanding payables')
                : totalBalanceAll < 0
                ? (language === 'ar' ? 'فائض دفعات مقدمة للموردين' : 'Supplier advance credits')
                : (language === 'ar' ? 'جميع الحسابات مسددة' : 'All accounts settled')}
            </span>
          </div>

          <div className="bg-white p-4 sm:p-5 dark:bg-[#0c111a]">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {language === 'ar' ? 'طلبات مفتوحة' : 'Open Purchase Orders'}
              </span>
              <Package className="h-4 w-4 text-amber-500" />
            </div>
            <p className="mt-2 text-2xl font-bold text-amber-600 dark:text-amber-400 tabular-nums">
              {totalOpenPOsAll}
            </p>
            <span className="text-[11px] text-slate-400">{language === 'ar' ? 'قيد التنفيذ والاستلام' : 'Pending fulfillment'}</span>
          </div>
        </div>
      </div>

      {/* Search & Filter Shelf */}
      <div className={`${shell} p-4 space-y-3`}>
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative flex-1 w-full">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder={language === 'ar' ? 'بحث بالاسم، الرمز، الجوال، البريد، أو الرقم الضريبي...' : 'Search supplier name, code, phone, email, or VAT #...'}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input ps-9 !py-2 text-xs"
            />
          </div>

          <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
            <button
              type="button"
              onClick={() => setBalanceFilter('all')}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold ring-1 ring-inset transition whitespace-nowrap ${
                balanceFilter === 'all'
                  ? 'bg-slate-900 text-white ring-slate-900 dark:bg-white dark:text-slate-900'
                  : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50 dark:bg-transparent dark:text-slate-300'
              }`}
            >
              {language === 'ar' ? 'جميع الموردين' : 'All'} ({suppliersWithPOs.length})
            </button>
            <button
              type="button"
              onClick={() => setBalanceFilter('has_balance')}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold ring-1 ring-inset transition whitespace-nowrap ${
                balanceFilter === 'has_balance'
                  ? 'bg-rose-600 text-white ring-rose-600'
                  : 'bg-white text-rose-700 ring-rose-200 hover:bg-rose-50 dark:bg-transparent dark:text-rose-300'
              }`}
            >
              {language === 'ar' ? 'عليهم مستحقات' : 'With Balance'} ({withBalanceCount})
            </button>
            {advanceCreditCount > 0 && (
              <button
                type="button"
                onClick={() => setBalanceFilter('advance')}
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold ring-1 ring-inset transition whitespace-nowrap ${
                  balanceFilter === 'advance'
                    ? 'bg-amber-600 text-white ring-amber-600'
                    : 'bg-white text-amber-700 ring-amber-200 hover:bg-amber-50 dark:bg-transparent dark:text-amber-300'
                }`}
              >
                {language === 'ar' ? 'رصيد دفع مقدم (-)' : 'Advance Credit (-)'} ({advanceCreditCount})
              </button>
            )}
            <button
              type="button"
              onClick={() => setBalanceFilter('zero_balance')}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold ring-1 ring-inset transition whitespace-nowrap ${
                balanceFilter === 'zero_balance'
                  ? 'bg-emerald-600 text-white ring-emerald-600'
                  : 'bg-white text-emerald-700 ring-emerald-200 hover:bg-emerald-50 dark:bg-transparent dark:text-emerald-300'
              }`}
            >
              {language === 'ar' ? 'مسدد بالكامل' : 'Cleared'} ({clearedCount})
            </button>
          </div>
        </div>
      </div>

      {/* Suppliers Accordion List */}
      <div className="space-y-3">
        {suppliersLoading ? (
          <div className="flex justify-center p-12">
            <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
          </div>
        ) : filteredSuppliers.length === 0 ? (
          <div className={`${shell} p-12 text-center text-slate-400 text-xs`}>
            {language === 'ar' ? 'لا توجد نتائج مطابقة' : 'No matching suppliers found'}
          </div>
        ) : (
          filteredSuppliers.map((supp) => {
            const isExpanded = expandedSupplierId === supp._id
            const name = language === 'ar' ? supp.nameAr || supp.nameEn : supp.nameEn || supp.nameAr
            const isFullyCleared = supp.totalBalance === 0 && supp.totalSpend > 0

            return (
              <motion.div
                key={supp._id}
                layout
                className={`${shell} transition-all duration-200 ${isExpanded ? 'ring-2 ring-teal-600/30' : ''}`}
              >
                {/* Supplier Summary Row */}
                <div className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-200 font-bold text-sm">
                      {supp.code ? supp.code.slice(-3) : <Building2 className="h-5 w-5" />}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-slate-950 dark:text-white text-base">
                          {name}
                        </h3>
                        {supp.code && (
                          <span className="font-mono text-[11px] font-semibold text-slate-400">
                            {supp.code}
                          </span>
                        )}
                        {supp.totalBalance > 0 && (
                          <span className="inline-flex rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700 ring-1 ring-inset ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300">
                            {language === 'ar' ? 'مستحق' : 'Due'}: <Money value={supp.totalBalance} />
                          </span>
                        )}
                        {supp.totalBalance < 0 && (
                          <span className="inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800 ring-1 ring-inset ring-amber-300 dark:bg-amber-500/10 dark:text-amber-300">
                            {language === 'ar' ? 'رصيد دائن' : 'Advance'}: <Money value={supp.totalBalance} />
                          </span>
                        )}
                        {isFullyCleared && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 ring-1 ring-inset ring-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
                            <CheckCircle2 className="h-3 w-3" />
                            {language === 'ar' ? 'مسدد بالكامل' : 'Cleared'}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                        {supp.contactPerson && <span>{supp.contactPerson}</span>}
                        {supp.phone && (
                          <span className="inline-flex items-center gap-1">
                            <Phone className="h-3 w-3 text-slate-400" />
                            {supp.phone}
                          </span>
                        )}
                        {supp.email && (
                          <span className="inline-flex items-center gap-1">
                            <Mail className="h-3 w-3 text-slate-400" />
                            {supp.email}
                          </span>
                        )}
                        {supp.vatNumber && (
                          <span className="font-mono text-[11px]">VAT: {supp.vatNumber}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Financials & Status Counters */}
                  <div className="flex flex-wrap items-center gap-4 lg:gap-6 border-t lg:border-t-0 pt-3 lg:pt-0 border-slate-100 dark:border-white/[0.06]">
                    <div className="text-start lg:text-end">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                        {language === 'ar' ? 'إجمالي المشتريات' : 'Total Spend'}
                      </span>
                      <span className="font-bold text-slate-900 dark:text-white text-sm tabular-nums">
                        <Money value={supp.totalSpend} />
                      </span>
                    </div>

                    <div className="text-start lg:text-end">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                        {language === 'ar' ? 'المدفوع' : 'Paid'}
                      </span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm tabular-nums">
                        <Money value={supp.totalPaid} />
                      </span>
                    </div>

                    <div className="text-start lg:text-end">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                        {supp.totalBalance < 0
                          ? (language === 'ar' ? 'رصيد مقدم دائن' : 'Advance Balance')
                          : (language === 'ar' ? 'الرصيد المتبقي' : 'Balance Due')}
                      </span>
                      <span className={`font-bold text-sm tabular-nums ${
                        supp.totalBalance > 0
                          ? 'text-rose-600 dark:text-rose-400'
                          : supp.totalBalance < 0
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-emerald-600 dark:text-emerald-400'
                      }`}>
                        <Money value={supp.totalBalance} />
                      </span>
                    </div>

                    <div className="text-start lg:text-end">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                        {language === 'ar' ? 'طلبات الشراء' : 'Orders'}
                      </span>
                      <span className="font-bold text-slate-900 dark:text-white text-sm tabular-nums">
                        {supp.totalPOsCount} ({supp.openPOsCount} {language === 'ar' ? 'مفتوح' : 'open'})
                      </span>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1.5 ms-auto">
                      {supp.phone && (
                        <button
                          type="button"
                          onClick={() => sendWhatsApp(supp)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300"
                          title={language === 'ar' ? 'إرسال واتساب' : 'WhatsApp'}
                        >
                          <MessageCircle className="h-4 w-4" />
                        </button>
                      )}
                      <Link
                        to={`/app/dashboard/purchases/orders/new?supplierId=${supp._id}`}
                        className="inline-flex items-center gap-1 rounded-xl bg-teal-50 px-2.5 py-1.5 text-xs font-semibold text-teal-800 hover:bg-teal-100 dark:bg-teal-900/30 dark:text-teal-300"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        {language === 'ar' ? 'طلب جديد' : 'New PO'}
                      </Link>
                      <button
                        type="button"
                        onClick={() => setExpandedSupplierId(isExpanded ? null : supp._id)}
                        className={ghostBtn}
                      >
                        {isExpanded ? (
                          <>
                            <ChevronUp className="h-3.5 w-3.5" />
                            {language === 'ar' ? 'إخفاء الطلبات' : 'Hide POs'}
                          </>
                        ) : (
                          <>
                            <ChevronDown className="h-3.5 w-3.5" />
                            {language === 'ar' ? 'عرض الطلبات' : 'View POs'} ({supp.totalPOsCount})
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expanded POs Table for this Supplier */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="border-t border-slate-100 bg-slate-50/50 p-4 sm:p-5 dark:border-white/[0.08] dark:bg-white/[0.02]"
                    >
                      <div className="mb-3 flex items-center justify-between">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                          {language === 'ar' ? `طلبات الشراء الخاصة بالمورد (${supp.orders.length})` : `Purchase Orders (${supp.orders.length})`}
                        </h4>
                        <Link
                          to={`/app/dashboard/purchases/orders/new?supplierId=${supp._id}`}
                          className="text-xs font-semibold text-teal-700 hover:underline dark:text-teal-400"
                        >
                          + {language === 'ar' ? 'إنشاء طلب شراء لهذا المورد' : 'Create PO for this supplier'}
                        </Link>
                      </div>

                      {supp.orders.length === 0 ? (
                        <div className="py-6 text-center text-slate-400 text-xs">
                          {language === 'ar' ? 'لا توجد طلبات شراء مسجلة لهذا المورد حتى الآن' : 'No purchase orders recorded for this supplier yet'}
                        </div>
                      ) : (
                        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-[#0c111a]">
                          <table className="w-full text-start text-xs">
                            <thead className="bg-slate-100/70 font-bold uppercase tracking-wider text-slate-500 dark:bg-white/[0.04] dark:text-slate-400">
                              <tr>
                                <th className="p-3 text-start">{language === 'ar' ? 'رقم الطلب' : 'PO Number'}</th>
                                <th className="p-3 text-start">{language === 'ar' ? 'تاريخ الطلب' : 'Order Date'}</th>
                                <th className="p-3 text-start">{language === 'ar' ? 'المستودع' : 'Warehouse'}</th>
                                <th className="p-3 text-center">{language === 'ar' ? 'حالة الطلب' : 'Status'}</th>
                                <th className="p-3 text-center">{language === 'ar' ? 'حالة الدفع' : 'Payment'}</th>
                                <th className="p-3 text-end">{language === 'ar' ? 'المبلغ الإجمالي' : 'Grand Total'}</th>
                                <th className="p-3 text-end">{language === 'ar' ? 'المدفوع' : 'Paid'}</th>
                                <th className="p-3 text-end">{language === 'ar' ? 'المتبقي / الفائض' : 'Balance'}</th>
                                <th className="p-3 text-end">{language === 'ar' ? 'الإجراءات' : 'Actions'}</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
                              {supp.orders.map((po) => {
                                const poGrandTotal = Number(po.grandTotal || 0)
                                const poPaidAmount = Number(po.paidAmount || 0)
                                const netPoBalance = Math.round((poGrandTotal - poPaidAmount) * 100) / 100
                                const hasReceipts = (po.payments || []).some((p) => p.receiptUrl)

                                return (
                                  <tr key={po._id} className="hover:bg-slate-50/60 dark:hover:bg-white/[0.02]">
                                    <td className="p-3">
                                      <Link
                                        to={`/app/dashboard/purchases/orders/${po._id}`}
                                        className="font-mono font-bold text-teal-700 hover:underline dark:text-teal-400"
                                      >
                                        {po.poNumber}
                                      </Link>
                                    </td>
                                    <td className="p-3 text-slate-600 dark:text-slate-300">
                                      {po.orderDate ? new Date(po.orderDate).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-GB') : '—'}
                                    </td>
                                    <td className="p-3 text-slate-600 dark:text-slate-300">
                                      {po.warehouseId?.nameEn || po.warehouseId?.nameAr || '—'}
                                    </td>
                                    <td className="p-3 text-center">
                                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${STATUS_PILL[po.status] || STATUS_PILL.draft}`}>
                                        {statusLabel(po.status)}
                                      </span>
                                    </td>
                                    <td className="p-3 text-center">
                                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${PAYMENT_STATUS_PILL[po.paymentStatus || 'pending']}`}>
                                        {po.paymentStatus || 'pending'}
                                      </span>
                                    </td>
                                    <td className="p-3 text-end font-bold text-slate-900 dark:text-white tabular-nums">
                                      <Money value={poGrandTotal} />
                                    </td>
                                    <td className="p-3 text-end font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                                      <Money value={poPaidAmount} />
                                    </td>
                                    <td className="p-3 text-end font-semibold tabular-nums">
                                      {netPoBalance > 0 ? (
                                        <span className="text-rose-600 dark:text-rose-400">
                                          <Money value={netPoBalance} />
                                        </span>
                                      ) : netPoBalance < 0 ? (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800 ring-1 ring-inset ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300">
                                          <Money value={netPoBalance} />
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                                          <CheckCircle2 className="h-3 w-3" />
                                          {language === 'ar' ? 'مسدد' : 'Cleared'}
                                        </span>
                                      )}
                                    </td>
                                    <td className="p-3 text-end">
                                      <div className="flex items-center justify-end gap-1.5">
                                        {netPoBalance > 0 && (
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setSelectedPoForPayment(po)
                                              setShowPaymentModal(true)
                                            }}
                                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-800 transition hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300"
                                            title={language === 'ar' ? 'تسجيل دفعة لهذا الطلب' : 'Record payment for this PO'}
                                          >
                                            <CreditCard className="h-3 w-3" />
                                            <span>{language === 'ar' ? 'دفع' : 'Pay'}</span>
                                          </button>
                                        )}
                                        {hasReceipts && (
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const pWithReceipt = (po.payments || []).find((p) => p.receiptUrl)
                                              if (pWithReceipt?.receiptUrl) {
                                                setReceiptModalUrl(pWithReceipt.receiptUrl)
                                                setReceiptModalTitle(pWithReceipt.receiptName || (language === 'ar' ? `إيصال دفع ${po.poNumber}` : `Payment Receipt ${po.poNumber}`))
                                              }
                                            }}
                                            className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-950/30 transition"
                                            title={language === 'ar' ? 'عرض إيصال التحويل' : 'View Payment Receipt'}
                                          >
                                            <Receipt className="h-3.5 w-3.5" />
                                          </button>
                                        )}
                                        <Link
                                          to={`/app/dashboard/purchases/orders/${po._id}`}
                                          className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-white/10"
                                          title={language === 'ar' ? 'عرض الطلب' : 'View PO'}
                                        >
                                          <Eye className="h-3.5 w-3.5" />
                                        </Link>
                                      </div>
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )
          })
        )}
      </div>

      {/* Ultra-Premium Quick Add Supplier Modal */}
      <AnimatePresence>
        {showAddSupplierModal && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-md overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl dark:bg-[#111827] border border-gray-100 dark:border-white/10 space-y-5 my-6 max-h-[92vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-gray-100 pb-4 dark:border-white/10">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500/10 via-emerald-500/15 to-teal-500/5 text-teal-700 dark:text-teal-300 ring-1 ring-inset ring-teal-500/20">
                    <UserPlus className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-teal-700 dark:text-teal-400">
                      {language === 'ar' ? 'الموردون والمشتريات' : 'Vendors & Suppliers'}
                    </p>
                    <h3 className="text-base font-bold text-slate-950 dark:text-white">
                      {language === 'ar' ? 'إضافة مورد جديد' : 'Add New Supplier'}
                    </h3>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddSupplierModal(false)}
                  className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-slate-200 transition"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-4 text-xs">
                <div className={showArabicFields ? "grid grid-cols-1 sm:grid-cols-2 gap-3" : ""}>
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-200 flex items-center justify-between">
                      <span>{showArabicFields ? (language === 'ar' ? 'اسم المورد (EN)' : 'Supplier Name (EN)') : (language === 'ar' ? 'اسم المورد' : 'Supplier Name')} *</span>
                      {showArabicFields ? <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-mono font-bold text-slate-500 dark:bg-white/10 dark:text-slate-400">EN</span> : null}
                    </label>
                    <input
                      type="text"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-900 shadow-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:border-white/10 dark:bg-[#0c111a] dark:text-white"
                      placeholder="e.g. Al-Marai Co."
                      value={supplierForm.nameEn}
                      onChange={(e) => setSupplierForm((p) => ({ ...p, nameEn: e.target.value }))}
                      autoFocus
                    />
                  </div>
                  {showArabicFields ? (
                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-200 flex items-center justify-between">
                        <span>{language === 'ar' ? 'اسم المورد (AR)' : 'Supplier Name (AR)'}</span>
                        <span className="rounded bg-teal-50 px-1.5 py-0.5 text-[9px] font-mono font-bold text-teal-700 dark:bg-teal-500/10 dark:text-teal-300">AR</span>
                      </label>
                      <input
                        type="text"
                        dir="rtl"
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-900 shadow-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:border-white/10 dark:bg-[#0c111a] dark:text-white"
                        placeholder="مثال: شركة المراعي"
                        value={supplierForm.nameAr}
                        onChange={(e) => setSupplierForm((p) => ({ ...p, nameAr: e.target.value }))}
                      />
                    </div>
                  ) : null}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                      <Phone className="h-3 w-3 text-slate-400" />
                      <span>{language === 'ar' ? 'رقم الجوال' : 'Phone'}</span>
                    </label>
                    <input
                      type="text"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-900 shadow-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:border-white/10 dark:bg-[#0c111a] dark:text-white"
                      placeholder="+966 5X XXX XXXX"
                      value={supplierForm.phone}
                      onChange={(e) => setSupplierForm((p) => ({ ...p, phone: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                      <Mail className="h-3 w-3 text-slate-400" />
                      <span>{language === 'ar' ? 'البريد الإلكتروني' : 'Email'}</span>
                    </label>
                    <input
                      type="email"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-900 shadow-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:border-white/10 dark:bg-[#0c111a] dark:text-white"
                      placeholder="supplier@example.com"
                      value={supplierForm.email}
                      onChange={(e) => setSupplierForm((p) => ({ ...p, email: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-200 flex items-center justify-between">
                    <span>{language === 'ar' ? 'الرقم الضريبي' : 'VAT Number'}</span>
                    <span className="text-[10px] font-mono text-slate-400">15 digits</span>
                  </label>
                  <input
                    type="text"
                    maxLength={15}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-xs font-medium text-slate-900 shadow-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:border-white/10 dark:bg-[#0c111a] dark:text-white"
                    placeholder="300000000000003"
                    value={supplierForm.vatNumber}
                    onChange={(e) => setSupplierForm((p) => ({ ...p, vatNumber: e.target.value }))}
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-gray-100 pt-4 dark:border-white/10">
                <button
                  type="button"
                  onClick={() => setShowAddSupplierModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/5 transition"
                >
                  {t('cancel')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!supplierForm.nameEn?.trim() && !supplierForm.nameAr?.trim()) {
                      toast.error(language === 'ar' ? 'اسم المورد مطلوب' : 'Supplier name is required')
                      return
                    }
                    addSupplierMutation.mutate({
                      ...supplierForm,
                      nameEn: supplierForm.nameEn || supplierForm.nameAr,
                      code: supplierForm.code || `SUP-${Math.floor(Date.now() / 1000).toString().slice(-5)}`,
                    })
                  }}
                  disabled={addSupplierMutation.isPending}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-slate-950 px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-slate-800 disabled:opacity-40 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100 transition"
                >
                  {addSupplierMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5 text-teal-400 dark:text-teal-600" />
                  )}
                  <span>{language === 'ar' ? 'حفظ المورد' : 'Save Supplier'}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Record Payment Modal */}
      {selectedPoForPayment && (
        <RecordPoPaymentModal
          isOpen={showPaymentModal}
          onClose={() => {
            setShowPaymentModal(false)
            setSelectedPoForPayment(null)
          }}
          order={selectedPoForPayment}
          isAr={language === 'ar'}
          onSuccess={() => {
            queryClient.invalidateQueries(['purchase-orders-all'])
            queryClient.invalidateQueries(['suppliers-list'])
            queryClient.invalidateQueries(['suppliers-financials'])
          }}
        />
      )}

      {/* Receipt Lightbox Modal */}
      <ReceiptLightboxModal
        isOpen={Boolean(receiptModalUrl)}
        onClose={() => setReceiptModalUrl(null)}
        url={receiptModalUrl}
        title={receiptModalTitle}
        isAr={language === 'ar'}
      />
    </div>
  )
}
