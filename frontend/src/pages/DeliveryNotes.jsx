import { useState } from 'react'
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
  ShoppingBag
} from 'lucide-react'
import api from '../lib/api'
import { useTranslation } from '../lib/translations'

export default function DeliveryNotes() {
  const navigate = useNavigate()
  const { language } = useSelector((state) => state.ui)
  const { t } = useTranslation(language)
  const [searchParams, setSearchParams] = useSearchParams()

  const page = parseInt(searchParams.get('page') || '1')
  const statusFilter = searchParams.get('status') || ''
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['delivery-notes', page, statusFilter, search],
    queryFn: () =>
      api.get('/delivery-notes', { params: { page, status: statusFilter, search: search || undefined } }).then((res) => res.data),
  })

  const deliveryNotes = data?.deliveryNotes || []
  const totalNotes = data?.pagination?.total || deliveryNotes.length

  const stats = {
    total: totalNotes,
    pending: deliveryNotes.filter((d) => d.status === 'pending_invoice').length,
    invoiced: deliveryNotes.filter((d) => d.status === 'fully_invoiced' || d.status === 'delivered').length,
    withShipment: deliveryNotes.filter((d) => Boolean(d.shipmentId || d.trackingNumber)).length,
  }

  const formatStatus = (status) => {
    if (language === 'ar') {
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
        return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
      case 'partially_invoiced':
        return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
      case 'pending_invoice':
        return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
      case 'cancelled':
        return 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
      default:
        return 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20'
    }
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary-500/10 text-primary-600 dark:bg-primary-500/20 dark:text-primary-400">
              <Truck className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                {language === 'ar' ? 'سندات التسليم (Delivery Notes)' : 'Delivery Notes'}
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                {language === 'ar'
                  ? 'إثباتات تسليم البضائع والخدمات للعملاء والربط مع عروض الأسعار وأوامر الشراء'
                  : 'Manage proof of deliveries, link to Quotations or POs, and consolidate into Invoices'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => navigate('/app/dashboard/delivery-notes/new')}
            className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-600/25 transition hover:bg-emerald-500"
          >
            <Plus className="h-4 w-4" />
            <span>{language === 'ar' ? 'إنشاء سند تسليم' : 'New Delivery Note'}</span>
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <div className="rounded-3xl border border-slate-200/80 bg-white p-4.5 shadow-sm dark:border-white/10 dark:bg-dark-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              {language === 'ar' ? 'إجمالي السندات' : 'Total Notes'}
            </span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-200">
              <Layers className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">{stats.total}</p>
        </div>

        <div className="rounded-3xl border border-amber-200/80 bg-amber-50/50 p-4.5 shadow-sm dark:border-amber-500/20 dark:bg-amber-500/5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
              {language === 'ar' ? 'بانتظار الفوترة' : 'Pending Invoice'}
            </span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
              <Clock className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-2 text-2xl font-black text-amber-700 dark:text-amber-400">{stats.pending}</p>
        </div>

        <div className="rounded-3xl border border-emerald-200/80 bg-emerald-50/50 p-4.5 shadow-sm dark:border-emerald-500/20 dark:bg-emerald-500/5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              {language === 'ar' ? 'مفوتر بالكامل' : 'Invoiced / Delivered'}
            </span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-2 text-2xl font-black text-emerald-700 dark:text-emerald-400">{stats.invoiced}</p>
        </div>

        <div className="rounded-3xl border border-sky-200/80 bg-sky-50/50 p-4.5 shadow-sm dark:border-sky-500/20 dark:bg-sky-500/5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-sky-700 dark:text-sky-400">
              {language === 'ar' ? 'مع شحنة أو تتبع' : 'With Logistics'}
            </span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300">
              <Truck className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-2 text-2xl font-black text-sky-700 dark:text-sky-400">{stats.withShipment}</p>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-dark-800">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute start-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={language === 'ar' ? 'بحث برقم السند، العميل، السائق، التتبع...' : 'Search by DN number, customer, driver, tracking...'}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 ps-10 pe-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:bg-white focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-white"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto">
            <button
              type="button"
              onClick={() => setSearchParams((prev) => { prev.delete('status'); prev.set('page', '1'); return prev; })}
              className={`rounded-2xl px-3.5 py-2 text-xs font-semibold transition ${
                !statusFilter
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950 shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/5 dark:text-slate-300'
              }`}
            >
              {language === 'ar' ? 'الكل' : 'All'}
            </button>
            <button
              type="button"
              onClick={() => setSearchParams((prev) => { prev.set('status', 'pending_invoice'); prev.set('page', '1'); return prev; })}
              className={`rounded-2xl px-3.5 py-2 text-xs font-semibold transition ${
                statusFilter === 'pending_invoice'
                  ? 'bg-amber-600 text-white shadow-sm shadow-amber-600/20'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/5 dark:text-slate-300'
              }`}
            >
              {language === 'ar' ? 'بانتظار الفوترة' : 'Pending Invoice'}
            </button>
            <button
              type="button"
              onClick={() => setSearchParams((prev) => { prev.set('status', 'partially_invoiced'); prev.set('page', '1'); return prev; })}
              className={`rounded-2xl px-3.5 py-2 text-xs font-semibold transition ${
                statusFilter === 'partially_invoiced'
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/20'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/5 dark:text-slate-300'
              }`}
            >
              {language === 'ar' ? 'مفوتر جزئياً' : 'Partially Invoiced'}
            </button>
            <button
              type="button"
              onClick={() => setSearchParams((prev) => { prev.set('status', 'fully_invoiced'); prev.set('page', '1'); return prev; })}
              className={`rounded-2xl px-3.5 py-2 text-xs font-semibold transition ${
                statusFilter === 'fully_invoiced'
                  ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/20'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/5 dark:text-slate-300'
              }`}
            >
              {language === 'ar' ? 'مفوتر بالكامل' : 'Fully Invoiced'}
            </button>
          </div>
        </div>

        {/* Table View */}
        <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-100 dark:border-white/5">
          <table className="w-full text-start text-sm">
            <thead className="border-b border-slate-100 bg-slate-50/70 text-xs uppercase tracking-wider text-slate-500 dark:border-white/5 dark:bg-white/[0.02] dark:text-slate-400">
              <tr>
                <th className="px-4 py-3.5 text-start">{language === 'ar' ? 'رقم السند والتاريخ' : 'DN Number & Date'}</th>
                <th className="px-4 py-3.5 text-start">{language === 'ar' ? 'العميل' : 'Customer'}</th>
                <th className="px-4 py-3.5 text-start">{language === 'ar' ? 'المستند المصدري' : 'Source Document'}</th>
                <th className="px-4 py-3.5 text-start">{language === 'ar' ? 'اللوجستيات والتتبع' : 'Logistics & Tracking'}</th>
                <th className="px-4 py-3.5 text-start">{t('status')}</th>
                <th className="px-4 py-3.5 text-end">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {isLoading ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center">
                    <div className="mx-auto h-7 w-7 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
                  </td>
                </tr>
              ) : deliveryNotes.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-16 text-center">
                    <div className="mx-auto max-w-sm space-y-3">
                      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-slate-100 text-slate-400 dark:bg-white/5 dark:text-slate-500">
                        <Truck className="h-7 w-7" />
                      </div>
                      <p className="text-base font-bold text-slate-800 dark:text-white">
                        {language === 'ar' ? 'لا توجد سندات تسليم' : 'No Delivery Notes Found'}
                      </p>
                      <p className="text-xs text-slate-500">
                        {language === 'ar'
                          ? 'أنشئ سند تسليم جديد من عرض سعر معتمد أو أمر شراء لتسليم البضائع للعميل.'
                          : 'Create a delivery note from an approved Quotation or Purchase Order to dispatch items.'}
                      </p>
                      <button
                        type="button"
                        onClick={() => navigate('/app/dashboard/delivery-notes/new')}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-primary-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-primary-500"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>{language === 'ar' ? 'إنشاء أول سند تسليم' : 'Create Delivery Note'}</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                deliveryNotes.map((dn) => {
                  const customerName =
                    language === 'ar'
                      ? dn.customerId?.nameAr || dn.customerId?.nameEn || dn.customerName
                      : dn.customerId?.nameEn || dn.customerId?.nameAr || dn.customerName || '—'
                  const dateStr = dn.deliveryDate ? new Date(dn.deliveryDate).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US') : '—'

                  return (
                    <tr
                      key={dn._id}
                      className="group transition hover:bg-slate-50/80 dark:hover:bg-white/[0.02]"
                    >
                      {/* DN Number & Date */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 font-mono text-xs font-bold text-slate-700 group-hover:bg-primary-500/10 group-hover:text-primary-600 dark:bg-white/5 dark:text-slate-300">
                            <Truck className="h-4 w-4" />
                          </span>
                          <div>
                            <Link
                              to={`/app/dashboard/delivery-notes/${dn._id}`}
                              className="font-bold text-slate-900 transition hover:text-primary-600 dark:text-white dark:hover:text-primary-400"
                            >
                              {dn.dnNumber}
                            </Link>
                            <p className="text-[11px] text-slate-400 mt-0.5">{dateStr}</p>
                          </div>
                        </div>
                      </td>

                      {/* Customer */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <User className="h-3.5 w-3.5 text-slate-400" />
                          <span className="font-semibold text-slate-900 dark:text-slate-100">{customerName}</span>
                        </div>
                        {dn.customerId?.code && (
                          <span className="text-[10px] font-mono text-slate-400 mt-0.5 block">{dn.customerId.code}</span>
                        )}
                      </td>

                      {/* Source Document */}
                      <td className="px-4 py-3.5">
                        {dn.quotationId ? (
                          <Link
                            to={`/app/dashboard/quotations/${dn.quotationId._id || dn.quotationId}`}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-sky-200 bg-sky-50/70 px-2.5 py-1 text-xs font-semibold text-sky-700 transition hover:bg-sky-100 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-300"
                          >
                            <FileText className="h-3 w-3" />
                            <span>{dn.quotationId.quotationNumber || 'Quotation'}</span>
                          </Link>
                        ) : dn.purchaseOrderId ? (
                          <Link
                            to={`/app/dashboard/purchases/orders/${dn.purchaseOrderId._id || dn.purchaseOrderId}`}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50/70 px-2.5 py-1 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100 dark:border-indigo-500/20 dark:bg-indigo-500/10 dark:text-indigo-300"
                          >
                            <ShoppingBag className="h-3 w-3" />
                            <span>{dn.purchaseOrderId.poNumber || 'Order'}</span>
                          </Link>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                            {language === 'ar' ? 'مباشر / يدوي' : 'Direct'}
                          </span>
                        )}
                      </td>

                      {/* Logistics */}
                      <td className="px-4 py-3.5">
                        {dn.shipmentId || dn.trackingNumber ? (
                          <div className="space-y-0.5">
                            <span className="flex items-center gap-1 font-mono text-xs font-semibold text-slate-700 dark:text-slate-300">
                              <Truck className="h-3 w-3 text-sky-500" />
                              {dn.shipmentId?.shipmentNumber || dn.trackingNumber}
                            </span>
                            {dn.carrier && <p className="text-[10px] text-slate-400">{dn.carrier}</p>}
                          </div>
                        ) : dn.driverName ? (
                          <div className="text-xs">
                            <p className="font-medium text-slate-700 dark:text-slate-300">{dn.driverName}</p>
                            {dn.vehicleNumber && <p className="text-[10px] text-slate-400">{dn.vehicleNumber}</p>}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold ${getStatusBadge(dn.status)}`}>
                          {formatStatus(dn.status)}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5 text-end">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => navigate(`/app/dashboard/delivery-notes/${dn._id}`)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-white"
                            title={language === 'ar' ? 'عرض السند' : 'View Delivery Note'}
                          >
                            <Eye className="h-4 w-4" />
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
      </div>
    </div>
  )
}

