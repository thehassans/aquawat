import { useState, useMemo } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus,
  Eye,
  Truck,
  Search,
  FileText,
  PackageCheck,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Layers,
  ArrowUpRight,
  Filter,
  User,
  ShoppingBag,
  RefreshCw,
  Printer,
  Receipt,
  X,
  ExternalLink,
  MapPin,
  Calendar,
  Phone,
  ShieldCheck,
  ChevronRight,
  Sparkles,
  ArrowRight,
  Download
} from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../lib/api'
import { useTranslation } from '../lib/translations'
import { getUomLabel } from '../lib/uomOptions'
import { getDeliveryWindowLabel } from '../lib/deliveryWindows'
import { downloadDeliveryNotePdf } from '../lib/deliveryNotePdf'

export default function DeliveryNotes() {
  const navigate = useNavigate()
  const { language } = useSelector((state) => state.ui)
  const tenant = useSelector((state) => state.auth?.tenant || state.auth?.user?.tenant)
  const isAr = language === 'ar'
  const { t } = useTranslation(language)
  const [searchParams, setSearchParams] = useSearchParams()

  const page = parseInt(searchParams.get('page') || '1')
  const statusFilter = searchParams.get('status') || ''
  const [search, setSearch] = useState('')
  const [selectedCarrier, setSelectedCarrier] = useState('')
  const [quickViewDn, setQuickViewDn] = useState(null)

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['delivery-notes', page, statusFilter, search],
    queryFn: () =>
      api.get('/delivery-notes', {
        params: {
          page,
          status: statusFilter || undefined,
          search: search || undefined,
          limit: 15
        }
      }).then((res) => res.data),
    staleTime: 30 * 1000
  })

  const deliveryNotes = data?.deliveryNotes || []
  const totalNotes = data?.pagination?.total || deliveryNotes.length
  const totalPages = data?.pagination?.pages || 1

  // Filter by carrier locally if selected
  const filteredNotes = useMemo(() => {
    if (!selectedCarrier) return deliveryNotes
    return deliveryNotes.filter(d => (d.carrier || '').toLowerCase().includes(selectedCarrier.toLowerCase()))
  }, [deliveryNotes, selectedCarrier])

  // Extract unique carriers for filter
  const availableCarriers = useMemo(() => {
    const set = new Set()
    deliveryNotes.forEach(d => {
      if (d.carrier) set.add(d.carrier)
    })
    return Array.from(set)
  }, [deliveryNotes])

  // Calculate live stats
  const stats = useMemo(() => {
    const total = totalNotes
    const pending = deliveryNotes.filter((d) => d.status === 'pending_invoice').length
    const invoiced = deliveryNotes.filter((d) => d.status === 'fully_invoiced' || d.status === 'delivered').length
    const withShipment = deliveryNotes.filter((d) => Boolean(d.shipmentId || d.trackingNumber || d.driverName)).length

    return { total, pending, invoiced, withShipment }
  }, [totalNotes, deliveryNotes])

  const formatStatus = (status) => {
    if (isAr) {
      if (status === 'pending_invoice') return 'بانتظار الفوترة'
      if (status === 'partially_invoiced') return 'مفوتر جزئياً'
      if (status === 'fully_invoiced') return 'مفوتر بالكامل'
      if (status === 'delivered') return 'تم التسليم'
      if (status === 'cancelled') return 'ملغي'
    }
    return String(status || '').replace(/_/g, ' ')
  }

  const getStatusBadge = (status) => {
    switch (status) {
      case 'fully_invoiced':
      case 'delivered':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/40'
      case 'partially_invoiced':
        return 'bg-blue-50 text-blue-700 border-blue-200/80 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/40'
      case 'pending_invoice':
        return 'bg-amber-50 text-amber-700 border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/40'
      case 'cancelled':
        return 'bg-rose-50 text-rose-700 border-rose-200/80 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/40'
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200/80 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
    }
  }

  const getStatusDot = (status) => {
    switch (status) {
      case 'fully_invoiced':
      case 'delivered':
        return 'bg-emerald-500'
      case 'partially_invoiced':
        return 'bg-blue-500'
      case 'pending_invoice':
        return 'bg-amber-500'
      case 'cancelled':
        return 'bg-rose-500'
      default:
        return 'bg-slate-400'
    }
  }

  const handleExportCsv = () => {
    if (!deliveryNotes.length) {
      toast.error(isAr ? 'لا توجد بيانات للتصدير' : 'No data to export')
      return
    }

    const headers = ['DN Number', 'Date', 'Customer', 'Source Ref', 'Driver', 'Carrier', 'Tracking', 'Status']
    const rows = deliveryNotes.map(dn => [
      dn.dnNumber,
      dn.deliveryDate ? new Date(dn.deliveryDate).toISOString().slice(0, 10) : '',
      dn.customerName || dn.customerId?.nameEn || dn.customerId?.nameAr || '',
      dn.quotationId?.quotationNumber || dn.purchaseOrderId?.poNumber || 'Direct',
      dn.driverName || '',
      dn.carrier || '',
      dn.trackingNumber || '',
      dn.status
    ])

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.map(i => `"${i}"`).join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `delivery_notes_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success(isAr ? 'تم تصدير ملف البيانات بنجاح' : 'Delivery notes exported to CSV')
  }

  return (
    <div className="space-y-7 pb-16 animate-fade-in">
      {/* ── TOP HERO HEADER ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-emerald-50/60 via-white to-sky-50/40 dark:from-dark-800 dark:via-dark-850 dark:to-dark-800 p-6 sm:p-7 rounded-3xl border border-emerald-100/60 dark:border-dark-700 shadow-sm relative overflow-hidden">
        {/* Subtle decorative background glow */}
        <div className="absolute top-0 end-0 w-80 h-full bg-gradient-to-l from-emerald-100/40 via-sky-100/20 to-transparent dark:from-emerald-950/20 pointer-events-none" />

        <div className="flex items-center gap-4 relative z-10">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center shadow-lg shadow-emerald-500/25 ring-4 ring-emerald-50 dark:ring-dark-700">
            <Truck className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                {isAr ? 'سندات التسليم والشحن' : 'Delivery Notes & Logistics'}
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                {totalNotes} {isAr ? 'سند' : 'Notes'}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-xl">
              {isAr
                ? 'إدارة إثباتات التسليم والربط مع عروض الأسعار وأوامر الشراء وتتبع الشحنات والتحويل إلى فواتير بضغطة زر'
                : 'Track dispatch receipts, link quotations & POs, manage courier logistics, and convert to invoices in one click'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 relative z-10 flex-wrap">
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="p-2.5 rounded-2xl border border-slate-200/80 bg-white text-slate-700 hover:bg-slate-50 dark:border-dark-700 dark:bg-dark-800 dark:text-slate-300 shadow-xs transition-all"
            title={isAr ? 'تحديث البيانات' : 'Refresh data'}
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin text-emerald-600' : ''}`} />
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            className="px-3.5 py-2.5 rounded-2xl border border-slate-200/80 bg-white text-slate-700 hover:bg-slate-50 dark:border-dark-700 dark:bg-dark-800 dark:text-slate-300 text-xs font-bold shadow-xs transition-all flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>{isAr ? 'تصدير CSV' : 'Export CSV'}</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/app/dashboard/delivery-notes/new')}
            className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-extrabold shadow-md shadow-emerald-600/25 transition-all flex items-center gap-2 transform active:scale-95"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>{isAr ? 'إنشاء سند تسليم جديد' : 'New Delivery Note'}</span>
          </button>
        </div>
      </div>

      {/* ── METRIC KPI CARDS ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Notes */}
        <div className="card p-5 rounded-3xl bg-white dark:bg-dark-800 border border-slate-100 dark:border-dark-700 shadow-sm relative overflow-hidden group hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {isAr ? 'إجمالي السندات' : 'Total Notes'}
            </span>
            <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-dark-700 text-slate-700 dark:text-slate-300 flex items-center justify-center shadow-xs">
              <Layers className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white font-mono">
              {stats.total}
            </p>
            <span className="text-[11px] font-semibold text-slate-400">
              {isAr ? 'سند مسجل' : 'Registered'}
            </span>
          </div>
        </div>

        {/* Pending Invoice */}
        <div className="card p-5 rounded-3xl bg-gradient-to-br from-amber-50/70 to-white dark:from-dark-800 dark:to-dark-800 border border-amber-200/70 dark:border-amber-900/30 shadow-sm relative overflow-hidden group hover:border-amber-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
              {isAr ? 'بانتظار الفوترة' : 'Pending Invoice'}
            </span>
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shadow-xs">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <p className="text-2xl sm:text-3xl font-black text-amber-700 dark:text-amber-400 font-mono">
              {stats.pending}
            </p>
            <span className="text-[11px] font-semibold text-amber-700/80 dark:text-amber-400/80">
              {isAr ? 'جاهزة للتحويل' : 'Ready to Bill'}
            </span>
          </div>
        </div>

        {/* Invoiced / Fulfilled */}
        <div className="card p-5 rounded-3xl bg-gradient-to-br from-emerald-50/70 to-white dark:from-dark-800 dark:to-dark-800 border border-emerald-200/70 dark:border-emerald-900/30 shadow-sm relative overflow-hidden group hover:border-emerald-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
              {isAr ? 'مفوتر بالكامل' : 'Invoiced & Completed'}
            </span>
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-xs">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <p className="text-2xl sm:text-3xl font-black text-emerald-700 dark:text-emerald-400 font-mono">
              {stats.invoiced}
            </p>
            <span className="text-[11px] font-semibold text-emerald-700/80 dark:text-emerald-400/80">
              {isAr ? 'مغلقة ومسددة' : 'Billed'}
            </span>
          </div>
        </div>

        {/* Logistics & Tracking */}
        <div className="card p-5 rounded-3xl bg-gradient-to-br from-sky-50/70 to-white dark:from-dark-800 dark:to-dark-800 border border-sky-200/70 dark:border-sky-900/30 shadow-sm relative overflow-hidden group hover:border-sky-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-sky-800 dark:text-sky-300">
              {isAr ? 'لوجستيات وتتبع' : 'With Logistics & Driver'}
            </span>
            <div className="w-10 h-10 rounded-2xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center shadow-xs">
              <Truck className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <p className="text-2xl sm:text-3xl font-black text-sky-700 dark:text-sky-400 font-mono">
              {stats.withShipment}
            </p>
            <span className="text-[11px] font-semibold text-sky-700/80 dark:text-sky-400/80">
              {isAr ? 'شحنات وسائقين' : 'In-Transit'}
            </span>
          </div>
        </div>
      </div>

      {/* ── FILTER & SEARCH SECTION ────────────────────────────────────────────────── */}
      <div className="card p-4 sm:p-5 rounded-3xl bg-white dark:bg-dark-800 border border-slate-100 dark:border-dark-700 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row gap-3 md:items-center justify-between">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute start-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={isAr ? 'بحث برقم السند، العميل، السائق، التتبع AWB...' : 'Search by DN number, customer, driver, tracking AWB...'}
              className="input ps-10 pe-9 !py-2 text-xs sm:text-sm font-medium w-full"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute end-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Carrier filter if available */}
          {availableCarriers.length > 0 && (
            <div className="w-full md:w-auto">
              <select
                value={selectedCarrier}
                onChange={(e) => setSelectedCarrier(e.target.value)}
                className="select !py-2 text-xs"
              >
                <option value="">{isAr ? 'جميع شركات الشحن' : 'All Carriers'}</option>
                {availableCarriers.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          )}

          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            <button
              type="button"
              onClick={() => setSearchParams((prev) => { prev.delete('status'); prev.set('page', '1'); return prev; })}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition whitespace-nowrap ${
                !statusFilter
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950 shadow-sm'
                  : 'bg-slate-100/80 text-slate-600 hover:bg-slate-200 dark:bg-dark-700 dark:text-slate-300'
              }`}
            >
              {isAr ? 'الكل' : 'All'}
            </button>

            <button
              type="button"
              onClick={() => setSearchParams((prev) => { prev.set('status', 'pending_invoice'); prev.set('page', '1'); return prev; })}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 ${
                statusFilter === 'pending_invoice'
                  ? 'bg-amber-600 text-white shadow-sm shadow-amber-600/20'
                  : 'bg-slate-100/80 text-slate-600 hover:bg-slate-200 dark:bg-dark-700 dark:text-slate-300'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
              <span>{isAr ? 'بانتظار الفوترة' : 'Pending Invoice'}</span>
            </button>

            <button
              type="button"
              onClick={() => setSearchParams((prev) => { prev.set('status', 'partially_invoiced'); prev.set('page', '1'); return prev; })}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 ${
                statusFilter === 'partially_invoiced'
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/20'
                  : 'bg-slate-100/80 text-slate-600 hover:bg-slate-200 dark:bg-dark-700 dark:text-slate-300'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />
              <span>{isAr ? 'مفوتر جزئياً' : 'Partially Invoiced'}</span>
            </button>

            <button
              type="button"
              onClick={() => setSearchParams((prev) => { prev.set('status', 'fully_invoiced'); prev.set('page', '1'); return prev; })}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 ${
                statusFilter === 'fully_invoiced'
                  ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/20'
                  : 'bg-slate-100/80 text-slate-600 hover:bg-slate-200 dark:bg-dark-700 dark:text-slate-300'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
              <span>{isAr ? 'مفوتر بالكامل' : 'Fully Invoiced'}</span>
            </button>
          </div>
        </div>

        {/* ── TABLE VIEW ───────────────────────────────────────────────────────────── */}
        <div className="overflow-x-auto rounded-2xl border border-slate-100 dark:border-dark-700">
          <table className="w-full text-start text-xs sm:text-sm">
            <thead className="border-b border-slate-100 bg-slate-50/80 text-[11px] uppercase tracking-wider text-slate-500 dark:border-dark-700 dark:bg-dark-900/60 dark:text-slate-400 font-bold">
              <tr>
                <th className="px-4 py-3.5 text-start">{isAr ? 'رقم السند والتاريخ' : 'DN Number & Date'}</th>
                <th className="px-4 py-3.5 text-start">{isAr ? 'العميل والوجهة' : 'Customer & Destination'}</th>
                <th className="px-4 py-3.5 text-start">{isAr ? 'المستند المصدري' : 'Source Document'}</th>
                <th className="px-4 py-3.5 text-start">{isAr ? 'اللوجستيات وموعد التسليم' : 'Logistics & Arrival'}</th>
                <th className="px-4 py-3.5 text-center">{t('status')}</th>
                <th className="px-4 py-3.5 text-end">{t('actions')}</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 dark:divide-dark-700">
              {isLoading ? (
                <tr>
                  <td colSpan="6" className="py-16 text-center">
                    <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent mb-2" />
                    <p className="text-xs text-slate-400">{isAr ? 'جاري تحميل سندات التسليم...' : 'Loading delivery notes...'}</p>
                  </td>
                </tr>
              ) : filteredNotes.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-20 text-center">
                    <div className="mx-auto max-w-md space-y-4">
                      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300 ring-8 ring-emerald-50/50">
                        <Truck className="h-8 w-8" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-slate-900 dark:text-white">
                          {isAr ? 'لا توجد سندات تسليم مسجلة' : 'No Delivery Notes Found'}
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                          {isAr
                            ? 'يمكنك إنشاء سند تسليم جديد من عرض سعر معتمد أو أمر شراء لترحيل البضائع للعميل مع تحديد موعد الوصول وسائق التوصيل.'
                            : 'Create a delivery note from an approved Quotation or Purchase Order to dispatch items to your client with logistics tracking.'}
                        </p>
                      </div>

                      <div className="flex items-center justify-center gap-3 pt-2">
                        <button
                          type="button"
                          onClick={() => navigate('/app/dashboard/delivery-notes/new')}
                          className="px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition-all flex items-center gap-2"
                        >
                          <Plus className="h-4 w-4" />
                          <span>{isAr ? 'إنشاء أول سند تسليم' : 'Create Delivery Note'}</span>
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredNotes.map((dn) => {
                  const customerName =
                    isAr
                      ? dn.customerId?.nameAr || dn.customerId?.nameEn || dn.customerName
                      : dn.customerId?.nameEn || dn.customerId?.nameAr || dn.customerName || '—'
                  const dateStr = dn.deliveryDate ? new Date(dn.deliveryDate).toLocaleDateString(isAr ? 'ar-SA' : 'en-US') : '—'
                  const itemsCount = dn.lineItems?.length || 0

                  return (
                    <tr
                      key={dn._id}
                      className="group transition-colors hover:bg-slate-50/80 dark:hover:bg-dark-700/30"
                    >
                      {/* DN Number & Date */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 flex items-center justify-center font-bold text-xs shadow-xs group-hover:scale-105 transition-transform">
                            <Truck className="w-5 h-5" />
                          </div>
                          <div>
                            <Link
                              to={`/app/dashboard/delivery-notes/${dn._id}`}
                              className="font-bold font-mono text-slate-900 hover:text-emerald-600 dark:text-white dark:hover:text-emerald-400 transition-colors block"
                            >
                              {dn.dnNumber}
                            </Link>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[11px] text-slate-400 flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {dateStr}
                              </span>
                              <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-slate-100 dark:bg-dark-700 text-slate-500 font-medium">
                                {itemsCount} {isAr ? 'بنود' : 'items'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Customer & Destination */}
                      <td className="px-4 py-3.5">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-slate-100">
                            <User className="h-3.5 w-3.5 text-slate-400" />
                            <span>{customerName}</span>
                          </div>
                          {(dn.destinationCity || dn.shippingAddress) && (
                            <p className="text-[11px] text-slate-400 flex items-center gap-1 truncate max-w-[200px]">
                              <MapPin className="w-3 h-3 text-rose-400 shrink-0" />
                              <span>{dn.destinationCity ? `${dn.destinationCity} • ` : ''}{dn.shippingAddress || ''}</span>
                            </p>
                          )}
                        </div>
                      </td>

                      {/* Source Document */}
                      <td className="px-4 py-3.5">
                        {dn.quotationId ? (
                          <Link
                            to={`/app/dashboard/quotations/${dn.quotationId._id || dn.quotationId}`}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-sky-200 bg-sky-50/80 px-2.5 py-1 text-xs font-bold text-sky-700 hover:bg-sky-100 dark:border-sky-800/40 dark:bg-sky-950/40 dark:text-sky-300 transition-colors"
                          >
                            <FileText className="h-3 w-3 text-sky-500" />
                            <span>{dn.quotationId.quotationNumber || 'Quotation'}</span>
                          </Link>
                        ) : dn.purchaseOrderId ? (
                          <Link
                            to={`/app/dashboard/purchases/orders/${dn.purchaseOrderId._id || dn.purchaseOrderId}`}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50/80 px-2.5 py-1 text-xs font-bold text-indigo-700 hover:bg-indigo-100 dark:border-indigo-800/40 dark:bg-indigo-950/40 dark:text-indigo-300 transition-colors"
                          >
                            <ShoppingBag className="h-3 w-3 text-indigo-500" />
                            <span>{dn.purchaseOrderId.poNumber || 'Order'}</span>
                          </Link>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-slate-400 font-medium">
                            {isAr ? 'مباشر / يدوي' : 'Direct Entry'}
                          </span>
                        )}
                      </td>

                      {/* Logistics & Estimated Arrival */}
                      <td className="px-4 py-3.5">
                        <div className="space-y-1">
                          {(dn.estimatedDeliveryTime || dn.deliveryWindow) && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold">
                              <Clock className="w-3 h-3" />
                              <span>{dn.estimatedDeliveryTime || dn.deliveryWindow}</span>
                            </span>
                          )}

                          {dn.trackingNumber || dn.carrier ? (
                            <div className="flex items-center gap-1 text-[11px] font-mono font-semibold text-slate-700 dark:text-slate-300">
                              <Truck className="h-3 w-3 text-sky-500 shrink-0" />
                              <span>{dn.carrier ? `${dn.carrier}: ` : ''}{dn.trackingNumber || ''}</span>
                            </div>
                          ) : dn.driverName ? (
                            <p className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                              {dn.driverName} {dn.driverPhone ? `(${dn.driverPhone})` : ''}
                            </p>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </div>
                      </td>

                      {/* Status Badge */}
                      <td className="px-4 py-3.5 text-center">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold border ${getStatusBadge(dn.status)}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${getStatusDot(dn.status)}`} />
                          <span>{formatStatus(dn.status)}</span>
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5 text-end">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Quick View Button */}
                          <button
                            type="button"
                            onClick={() => setQuickViewDn(dn)}
                            className="p-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 dark:border-dark-700 dark:bg-dark-800 dark:text-slate-300 transition-colors shadow-xs"
                            title={isAr ? 'معاينة سريعة' : 'Quick Preview'}
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {/* Download PDF Button */}
                          <button
                            type="button"
                            onClick={() => downloadDeliveryNotePdf({ deliveryNote: dn, tenant, language })}
                            className="p-1.5 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:border-emerald-800/40 dark:bg-emerald-950/40 dark:text-emerald-300 transition-colors shadow-xs"
                            title={isAr ? 'تنزيل ملف PDF' : 'Download PDF'}
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>

                          {/* Convert to Invoice Button */}
                          <button
                            type="button"
                            onClick={() => navigate(`/app/dashboard/invoices/new?deliveryNoteId=${dn._id}`)}
                            className="p-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900 text-xs font-bold transition-all shadow-xs inline-flex items-center gap-1"
                            title={isAr ? 'تحويل إلى فاتورة' : 'Convert to Invoice'}
                          >
                            <Receipt className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline text-[11px]">{isAr ? 'فوترة' : 'Bill'}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ── PAGINATION ───────────────────────────────────────────────────────────── */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-2 text-xs text-slate-500">
            <p>
              {isAr ? `صفحة ${page} من ${totalPages} (${totalNotes} سند)` : `Page ${page} of ${totalPages} (${totalNotes} notes)`}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setSearchParams((prev) => { prev.set('page', String(page - 1)); return prev; })}
                className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 font-bold"
              >
                {isAr ? 'السابق' : 'Previous'}
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setSearchParams((prev) => { prev.set('page', String(page + 1)); return prev; })}
                className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 font-bold"
              >
                {isAr ? 'التالي' : 'Next'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── QUICK PREVIEW MODAL ───────────────────────────────────────────────────── */}
      <AnimatePresence>
        {quickViewDn && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-dark-800 rounded-3xl shadow-2xl border border-slate-200/80 dark:border-dark-700 w-full max-w-2xl overflow-hidden my-8"
            >
              {/* Modal Header */}
              <div className="p-5 border-b border-slate-100 dark:border-dark-700 flex items-center justify-between bg-slate-50/70 dark:bg-dark-900/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                    <Truck className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-black text-slate-900 dark:text-white font-mono">
                        {quickViewDn.dnNumber}
                      </h3>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getStatusBadge(quickViewDn.status)}`}>
                        {formatStatus(quickViewDn.status)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {isAr ? 'تاريخ التسليم:' : 'Delivery Date:'} {new Date(quickViewDn.deliveryDate || quickViewDn.createdAt).toLocaleDateString(isAr ? 'ar-SA' : 'en-US')}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setQuickViewDn(null)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-dark-700 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
                {/* Logistics & Parties Box */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-2xl bg-slate-50/70 dark:bg-dark-700/40 border border-slate-100 dark:border-dark-600/50 text-xs">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                      {isAr ? 'المستلم / العميل والوجهة' : 'Customer & Destination'}
                    </span>
                    <p className="font-bold text-slate-900 dark:text-white text-sm">
                      {quickViewDn.customerName || quickViewDn.customerId?.nameEn || quickViewDn.customerId?.nameAr}
                    </p>
                    {quickViewDn.recipientName && quickViewDn.recipientName !== quickViewDn.customerName && (
                      <p className="text-slate-600 dark:text-slate-300 mt-0.5"><span className="text-slate-400">{isAr ? 'المستلم:' : 'Attn:'}</span> {quickViewDn.recipientName}</p>
                    )}
                    {quickViewDn.recipientPhone && (
                      <p className="text-slate-500 mt-0.5 flex items-center gap-1 font-mono">
                        <Phone className="w-3 h-3 text-slate-400" />
                        {quickViewDn.recipientPhone}
                      </p>
                    )}
                    {(quickViewDn.destinationCity || quickViewDn.shippingAddress) && (
                      <p className="text-slate-500 mt-1 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-rose-400 shrink-0" />
                        <span>{quickViewDn.destinationCity ? `${quickViewDn.destinationCity} • ` : ''}{quickViewDn.shippingAddress || ''}</span>
                      </p>
                    )}
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                      {isAr ? 'بيانات الشحن والسائق والموعد' : 'Logistics, Driver & Timing'}
                    </span>
                    {(quickViewDn.estimatedDeliveryDate || quickViewDn.estimatedDeliveryTime) && (
                      <p className="font-bold text-emerald-600 dark:text-emerald-400">
                        {isAr ? 'تاريخ التسليم المتوقع:' : 'Est. Delivered:'}{' '}
                        {quickViewDn.estimatedDeliveryDate ? new Date(quickViewDn.estimatedDeliveryDate).toLocaleDateString(isAr ? 'ar-SA' : 'en-US') : ''}{' '}
                        {quickViewDn.estimatedDeliveryTime ? `(${quickViewDn.estimatedDeliveryTime})` : ''}
                      </p>
                    )}
                    {quickViewDn.deliveryWindow && (
                      <p className="text-slate-600 dark:text-slate-300 mt-0.5">
                        <span className="text-slate-400">{isAr ? 'فترة التسليم:' : 'Window:'}</span> {getDeliveryWindowLabel(quickViewDn.deliveryWindow, language)}
                      </p>
                    )}
                    {quickViewDn.dispatchTime && (
                      <p className="text-slate-600 dark:text-slate-300 mt-0.5">
                        <span className="text-slate-400">{isAr ? 'وقت الانطلاق:' : 'Dispatch:'}</span> {quickViewDn.dispatchTime}
                      </p>
                    )}
                    {quickViewDn.driverName && (
                      <p className="text-slate-700 dark:text-slate-200 mt-0.5 font-medium">
                        <span className="text-slate-400">{isAr ? 'السائق:' : 'Driver:'}</span> {quickViewDn.driverName} {quickViewDn.driverPhone ? `(${quickViewDn.driverPhone})` : ''}
                      </p>
                    )}
                    {quickViewDn.vehicleNumber && (
                      <p className="text-slate-600 dark:text-slate-400 mt-0.5">
                        <span className="text-slate-400">{isAr ? 'المركبة:' : 'Vehicle:'}</span> {quickViewDn.vehicleNumber}
                      </p>
                    )}
                    {quickViewDn.carrier && (
                      <p className="text-slate-600 dark:text-slate-300 mt-0.5">
                        <span className="text-slate-400">{isAr ? 'شركة الشحن:' : 'Carrier:'}</span> {quickViewDn.carrier} {quickViewDn.trackingNumber ? `• AWB: ${quickViewDn.trackingNumber}` : ''}
                      </p>
                    )}
                  </div>
                </div>

                {/* Items Summary Table */}
                <div className="space-y-2">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                    {isAr ? 'البنود المسلمة' : 'Delivered Items'}
                  </span>
                  <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-dark-700">
                    <table className="w-full text-start text-xs">
                      <thead className="bg-slate-50 dark:bg-dark-900 text-slate-500 font-bold uppercase tracking-wider">
                        <tr>
                          <th className="px-3 py-2 text-start">#</th>
                          <th className="px-3 py-2 text-start">{isAr ? 'الوصف' : 'Description'}</th>
                          <th className="px-3 py-2 text-center">{isAr ? 'الوحدة' : 'UOM'}</th>
                          <th className="px-3 py-2 text-end">{isAr ? 'الكمية المسلمة' : 'Qty Delivered'}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-dark-700">
                        {(quickViewDn.lineItems || []).map((item, idx) => (
                          <tr key={idx}>
                            <td className="px-3 py-2 text-slate-400 font-mono">{idx + 1}</td>
                            <td className="px-3 py-2 font-semibold text-slate-900 dark:text-white">
                              {item.description || item.productName || item.productNameAr || 'Item'}
                            </td>
                            <td className="px-3 py-2 text-center font-mono text-slate-500">
                              {getUomLabel(item.unitCode || 'PCE', language)}
                            </td>
                            <td className="px-3 py-2 text-end font-bold text-slate-900 dark:text-white font-mono">
                              {item.quantityDelivered}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {quickViewDn.notes && (
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-dark-900 text-xs text-slate-600 dark:text-slate-300">
                    <span className="font-bold">{isAr ? 'ملاحظات: ' : 'Notes: '}</span>
                    {quickViewDn.notes}
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-slate-100 dark:border-dark-700 flex items-center justify-between bg-slate-50/50 dark:bg-dark-900/30 flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => navigate(`/app/dashboard/delivery-notes/${quickViewDn._id}`)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-100 dark:border-dark-700 dark:text-slate-300"
                >
                  {isAr ? 'فتح السند الكامل' : 'Open Full Slip'}
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => downloadDeliveryNotePdf({ deliveryNote: quickViewDn, tenant, language })}
                    className="px-4 py-2 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:border-emerald-800/40 dark:bg-emerald-950/40 dark:text-emerald-300 text-xs font-bold flex items-center gap-1.5 shadow-sm"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{isAr ? 'تنزيل PDF' : 'Download PDF'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => navigate(`/app/dashboard/invoices/new?deliveryNoteId=${quickViewDn._id}`)}
                    className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900 text-xs font-bold flex items-center gap-1.5 shadow-sm"
                  >
                    <Receipt className="w-3.5 h-3.5" />
                    <span>{isAr ? 'تحويل إلى فاتورة' : 'Convert to Invoice'}</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
