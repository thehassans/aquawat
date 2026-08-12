import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Plus, Search, Edit, Printer, Download, Loader2 } from 'lucide-react'
import api from '../lib/api'
import { useTranslation } from '../lib/translations'
import Money from '../components/ui/Money'
import ExportMenu from '../components/ui/ExportMenu'
import { downloadPurchaseOrderPdf, printPurchaseOrderPdf } from '../lib/invoicePdf'
import toast from 'react-hot-toast'

const STATUS_PILL = {
  received: 'bg-emerald-50 text-emerald-700 ring-emerald-200/70 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/20',
  partially_received: 'bg-amber-50 text-amber-700 ring-amber-200/70 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/20',
  cancelled: 'bg-rose-50 text-rose-700 ring-rose-200/70 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/20',
  approved: 'bg-slate-100 text-slate-700 ring-slate-200/80 dark:bg-white/10 dark:text-slate-200 dark:ring-white/10',
  sent: 'bg-slate-100 text-slate-700 ring-slate-200/80 dark:bg-white/10 dark:text-slate-200 dark:ring-white/10',
  draft: 'bg-slate-50 text-slate-500 ring-slate-200/70 dark:bg-white/[0.04] dark:text-slate-400 dark:ring-white/10',
}

export default function PurchaseOrders() {
  const { language } = useSelector((state) => state.ui)
  const { tenant } = useSelector((state) => state.auth)
  const { t } = useTranslation(language)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState({ status: '', supplierId: '' })
  const [pdfBusyId, setPdfBusyId] = useState(null)

  const exportColumns = [
    {
      key: 'poNumber',
      label: language === 'ar' ? 'رقم الطلب' : 'PO Number',
      value: (r) => r?.poNumber || '',
    },
    {
      key: 'supplier',
      label: language === 'ar' ? 'المورد' : 'Supplier',
      value: (r) => {
        const s = r?.supplierId
        return s ? (language === 'ar' ? s.nameAr || s.nameEn : s.nameEn || s.nameAr) : ''
      },
    },
    {
      key: 'orderDate',
      label: language === 'ar' ? 'تاريخ الطلب' : 'Order Date',
      value: (r) =>
        r?.orderDate ? new Date(r.orderDate).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US') : '',
    },
    {
      key: 'status',
      label: t('status'),
      value: (r) => r?.status || '',
    },
    {
      key: 'grandTotal',
      label: t('total'),
      value: (r) => r?.grandTotal ?? '',
    },
  ]

  const getExportRows = async () => {
    const limit = 200
    let currentPage = 1
    let all = []

    while (true) {
      const res = await api.get('/purchase-orders', {
        params: { page: currentPage, limit, search, status: filters.status, supplierId: filters.supplierId },
      })
      const batch = res.data?.purchaseOrders || []
      all = all.concat(batch)

      const pages = res.data?.pagination?.pages || 1
      if (currentPage >= pages) break
      currentPage += 1

      if (all.length >= 10000) break
    }

    return all
  }

  const { data, isLoading } = useQuery({
    queryKey: ['purchase-orders', page, search, filters],
    queryFn: () =>
      api
        .get('/purchase-orders', {
          params: { page, limit: 25, search, status: filters.status, supplierId: filters.supplierId },
        })
        .then((res) => res.data),
  })

  const { data: stats } = useQuery({
    queryKey: ['purchase-orders-stats'],
    queryFn: () => api.get('/purchase-orders/stats').then((res) => res.data),
  })

  const { data: suppliers } = useQuery({
    queryKey: ['suppliers-lookup'],
    queryFn: () => api.get('/suppliers', { params: { limit: 200 } }).then((res) => res.data.suppliers),
  })

  const totals = stats?.totals?.[0]
  const totalOrders = totals?.count || 0
  const openOrders = totals?.openCount || 0
  const totalValue = totals?.totalValue || 0
  const receivedCount = stats?.byStatus?.find((x) => x._id === 'received')?.count || 0

  const orders = data?.purchaseOrders || []
  const pagination = data?.pagination

  const statusLabel = (status) => {
    if (language === 'ar') {
      if (status === 'draft') return 'مسودة'
      if (status === 'sent') return 'مرسل'
      if (status === 'approved') return 'معتمد'
      if (status === 'partially_received') return 'مستلم جزئياً'
      if (status === 'received') return 'مستلم'
      if (status === 'cancelled') return 'ملغي'
      return status
    }
    if (status === 'partially_received') return 'Partially received'
    return status ? status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ') : status
  }

  const fetchFullOrder = async (po) => {
    const res = await api.get(`/purchase-orders/${po._id}`)
    return res.data
  }

  const handleDownloadPdf = async (po) => {
    const toastId = toast.loading(language === 'ar' ? 'جاري إنشاء PDF...' : 'Generating PDF...')
    setPdfBusyId(`${po._id}:download`)
    try {
      const full = await fetchFullOrder(po)
      await downloadPurchaseOrderPdf({ purchaseOrder: full, language, tenant })
      toast.success(language === 'ar' ? 'تم تنزيل ملف PDF' : 'PDF downloaded', { id: toastId })
    } catch (error) {
      toast.error(language === 'ar' ? 'فشل التنزيل' : 'Download failed', { id: toastId })
    } finally {
      setPdfBusyId(null)
    }
  }

  const handlePrintPdf = async (po) => {
    const toastId = toast.loading(language === 'ar' ? 'جاري التحضير للطباعة...' : 'Preparing print...')
    setPdfBusyId(`${po._id}:print`)
    try {
      const full = await fetchFullOrder(po)
      await printPurchaseOrderPdf({ purchaseOrder: full, language, tenant })
      toast.success(language === 'ar' ? 'جاهز للطباعة' : 'Ready to print', { id: toastId })
    } catch (error) {
      toast.error(language === 'ar' ? 'فشل الطباعة' : 'Print failed', { id: toastId })
    } finally {
      setPdfBusyId(null)
    }
  }

  const shell = 'overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-white/10 dark:bg-[#0c111a]'

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
            {language === 'ar' ? 'سلسلة التوريد' : 'Supply chain'}
          </p>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-[-0.03em] text-slate-900 dark:text-white sm:text-[28px]">
            {language === 'ar' ? 'طلبات الشراء' : 'Purchase Orders'}
          </h1>
          <p className="mt-1.5 text-[13px] text-slate-500 dark:text-slate-400">
            {language === 'ar' ? 'إدارة أوامر الشراء والاستلام' : 'Manage purchase orders and receiving'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ExportMenu
            language={language}
            t={t}
            rows={orders}
            getRows={getExportRows}
            columns={exportColumns}
            fileBaseName={language === 'ar' ? 'طلبات_الشراء' : 'PurchaseOrders'}
            title={language === 'ar' ? 'طلبات الشراء' : 'Purchase Orders'}
            disabled={isLoading || orders.length === 0}
          />
          <Link
            to="/app/dashboard/purchase-orders/new"
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-[13px] font-medium text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
          >
            <Plus className="h-4 w-4 opacity-80" />
            {language === 'ar' ? 'طلب شراء جديد' : 'New purchase order'}
          </Link>
        </div>
      </div>

      {/* Minimal stats strip */}
      <div className={`${shell}`}>
        <div className="grid grid-cols-2 gap-px bg-slate-100 sm:grid-cols-4 dark:bg-white/[0.08]">
          {[
            {
              label: language === 'ar' ? 'الإجمالي' : 'Total',
              value: totalOrders,
            },
            {
              label: language === 'ar' ? 'مفتوحة' : 'Open',
              value: openOrders,
            },
            {
              label: language === 'ar' ? 'القيمة' : 'Value',
              value: <Money value={totalValue} />,
            },
            {
              label: language === 'ar' ? 'مستلمة' : 'Received',
              value: receivedCount,
              accent: true,
            },
          ].map((item) => (
            <div key={item.label} className="bg-white px-4 py-4 sm:px-5 sm:py-5 dark:bg-[#0c111a]">
              <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                {item.label}
              </p>
              <p
                className={`mt-2 text-[20px] font-semibold tabular-nums tracking-tight ${
                  item.accent ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-white'
                }`}
              >
                {item.value}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className={`${shell} p-4 sm:p-5`}>
        <div className="flex flex-col gap-3 lg:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder={language === 'ar' ? 'بحث برقم الطلب...' : 'Search by PO number...'}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              className="input ps-10"
            />
          </div>

          <select
            value={filters.status}
            onChange={(e) => {
              setFilters((f) => ({ ...f, status: e.target.value }))
              setPage(1)
            }}
            className="select w-full lg:w-48"
          >
            <option value="">{language === 'ar' ? 'كل الحالات' : 'All status'}</option>
            <option value="draft">{language === 'ar' ? 'مسودة' : 'Draft'}</option>
            <option value="sent">{language === 'ar' ? 'مرسل' : 'Sent'}</option>
            <option value="approved">{language === 'ar' ? 'معتمد' : 'Approved'}</option>
            <option value="partially_received">{language === 'ar' ? 'مستلم جزئياً' : 'Partially received'}</option>
            <option value="received">{language === 'ar' ? 'مستلم' : 'Received'}</option>
            <option value="cancelled">{language === 'ar' ? 'ملغي' : 'Cancelled'}</option>
          </select>

          <select
            value={filters.supplierId}
            onChange={(e) => {
              setFilters((f) => ({ ...f, supplierId: e.target.value }))
              setPage(1)
            }}
            className="select w-full lg:w-64"
          >
            <option value="">{language === 'ar' ? 'كل الموردين' : 'All suppliers'}</option>
            {(suppliers || []).map((s) => (
              <option key={s._id} value={s._id}>
                {(language === 'ar' ? s.nameAr || s.nameEn : s.nameEn) || s.code}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={shell}>
        {isLoading ? (
          <div className="flex justify-center p-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900 dark:border-slate-600 dark:border-t-white" />
          </div>
        ) : orders.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="text-[14px] font-medium text-slate-700 dark:text-slate-200">
              {language === 'ar' ? 'لا توجد طلبات شراء' : 'No purchase orders yet'}
            </p>
            <p className="mt-1 text-[13px] text-slate-400">
              {language === 'ar' ? 'أنشئ طلب شراء لبدء التتبع' : 'Create a purchase order to get started'}
            </p>
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr className="border-b border-slate-100 dark:border-white/[0.08]">
                  <th className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400">
                    {language === 'ar' ? 'رقم الطلب' : 'PO number'}
                  </th>
                  <th className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400">
                    {language === 'ar' ? 'المورد' : 'Supplier'}
                  </th>
                  <th className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400">
                    {language === 'ar' ? 'تاريخ الطلب' : 'Order date'}
                  </th>
                  <th className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400">{t('status')}</th>
                  <th className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400">{t('total')}</th>
                  <th className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400">{t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((po) => {
                  const busyDownload = pdfBusyId === `${po._id}:download`
                  const busyPrint = pdfBusyId === `${po._id}:print`
                  const anyBusy = Boolean(pdfBusyId)
                  return (
                    <tr
                      key={po._id}
                      className="border-b border-slate-50 last:border-0 dark:border-white/[0.04]"
                    >
                      <td>
                        <Link
                          to={`/app/dashboard/purchase-orders/${po._id}`}
                          className="font-mono text-[13px] font-semibold tracking-tight text-slate-900 transition hover:text-slate-600 dark:text-white dark:hover:text-slate-300"
                        >
                          {po.poNumber}
                        </Link>
                      </td>
                      <td>
                        <span className="text-[13px] font-medium text-slate-800 dark:text-slate-100">
                          {language === 'ar'
                            ? po.supplierId?.nameAr || po.supplierId?.nameEn || '—'
                            : po.supplierId?.nameEn || po.supplierId?.nameAr || '—'}
                        </span>
                      </td>
                      <td>
                        <span className="text-[13px] tabular-nums text-slate-600 dark:text-slate-300">
                          {po.orderDate
                            ? new Date(po.orderDate).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US')
                            : '—'}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1 ring-inset ${
                            STATUS_PILL[po.status] || STATUS_PILL.draft
                          }`}
                        >
                          {statusLabel(po.status)}
                        </span>
                      </td>
                      <td className="text-[13px] font-semibold tabular-nums text-slate-900 dark:text-white">
                        <Money value={po.grandTotal} />
                      </td>
                      <td>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handlePrintPdf(po)}
                            disabled={anyBusy}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 disabled:opacity-40 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
                            title={language === 'ar' ? 'طباعة' : 'Print'}
                          >
                            {busyPrint ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDownloadPdf(po)}
                            disabled={anyBusy}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 disabled:opacity-40 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
                            title={language === 'ar' ? 'تنزيل PDF' : 'Download PDF'}
                          >
                            {busyDownload ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Download className="h-4 w-4" />
                            )}
                          </button>
                          <Link
                            to={`/app/dashboard/purchase-orders/${po._id}`}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
                            title={language === 'ar' ? 'تعديل' : 'Edit'}
                          >
                            <Edit className="h-4 w-4" />
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

      {pagination?.pages > 1 && (
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            className="inline-flex items-center rounded-xl border border-slate-200/80 bg-white px-3.5 py-2 text-[13px] font-medium text-slate-700 transition hover:border-slate-300 disabled:opacity-40 dark:border-white/10 dark:bg-[#0c111a] dark:text-slate-200 dark:hover:border-white/20"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            {language === 'ar' ? 'السابق' : 'Previous'}
          </button>
          <div className="text-[12px] tabular-nums text-slate-500">
            {language === 'ar' ? 'صفحة' : 'Page'} {page} / {pagination.pages}
          </div>
          <button
            type="button"
            className="inline-flex items-center rounded-xl border border-slate-200/80 bg-white px-3.5 py-2 text-[13px] font-medium text-slate-700 transition hover:border-slate-300 disabled:opacity-40 dark:border-white/10 dark:bg-[#0c111a] dark:text-slate-200 dark:hover:border-white/20"
            disabled={page >= pagination.pages}
            onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
          >
            {language === 'ar' ? 'التالي' : 'Next'}
          </button>
        </div>
      )}
    </div>
  )
}
