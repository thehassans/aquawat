import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import {
  Plus,
  Search,
  Edit,
  Eye,
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  Download,
  Printer,
  MessageCircle,
  ShoppingCart,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import { useTranslation } from '../../lib/translations'
import Money from '../../components/ui/Money'
import ExportMenu from '../../components/ui/ExportMenu'
import SalesCreateMenu from '../../components/sales/SalesCreateMenu'
import { downloadQuotationPdf, printQuotationSnapshot } from '../../lib/invoicePdfActions'
import {
  docLinkClass,
  emptyStateClass,
  fieldControlClass,
  filterBarClass,
  listShellClass,
  pageSubtitleClass,
  pageTitleClass,
  paginationBarClass,
  rowActionBtnClass,
  rowActionPrimaryClass,
  rowActionsWrapClass,
  salesTdClass,
  salesThClass,
  salesTrClass,
  salesTableClass,
  sectionEyebrowClass,
} from '../sales/salesUi'

// ─── helpers ─────────────────────────────────────────────────────────────────

const trimPartyName = (value) => String(value || '').trim()

const formatPartyNames = (party, { fallback = '', joiner = ' / ' } = {}) => {
  const en = trimPartyName(party?.name)
  const ar = trimPartyName(party?.nameAr)
  if (en && ar && en !== ar) return `${en}${joiner}${ar}`
  return en || ar || fallback
}

function PartyNames({ party, fallback = '-' }) {
  const en = trimPartyName(party?.name)
  const ar = trimPartyName(party?.nameAr)
  if (en && ar && en !== ar) {
    return (
      <span className="block leading-snug">
        <span className="block font-semibold text-gray-900 dark:text-white">{en}</span>
        <span className="block font-medium text-gray-800 dark:text-slate-100" dir="rtl">{ar}</span>
      </span>
    )
  }
  return <span className="font-semibold text-gray-900 dark:text-white">{en || ar || fallback}</span>
}

const isEditableQuotation = (q) =>
  ['draft', 'sent', 'rejected'].includes(String(q?.status || '').toLowerCase())
const hasConvertedOrder = (q) => Boolean(q?.convertedOrderId)
const canApproveQuotation = (q) =>
  ['draft', 'sent', 'accepted', 'rejected'].includes(String(q?.status || '').toLowerCase()) &&
  !q?.convertedInvoiceId &&
  !q?.convertedOrderId
const canRejectQuotation = (q) =>
  ['draft', 'sent', 'accepted', 'approved'].includes(String(q?.status || '').toLowerCase()) &&
  !q?.convertedInvoiceId &&
  !q?.convertedOrderId

const getQuotationStatusMeta = (q, language = 'en') => {
  const status = String(q?.status || 'draft').toLowerCase()
  const labels = {
    draft: language === 'ar' ? 'مسودة' : 'Draft',
    sent: language === 'ar' ? 'مرسل' : 'Sent',
    accepted: language === 'ar' ? 'مقبول' : 'Accepted',
    approved: language === 'ar' ? 'معتمد' : 'Approved',
    rejected: language === 'ar' ? 'مرفوض' : 'Rejected',
    expired: language === 'ar' ? 'منتهي' : 'Expired',
    cancelled: language === 'ar' ? 'ملغي' : 'Cancelled',
    converted: language === 'ar' ? 'تم التحويل' : 'Converted',
  }
  const tone =
    status === 'approved' || status === 'accepted' || status === 'converted'
      ? 'success'
      : status === 'rejected' || status === 'cancelled' || status === 'expired'
      ? 'danger'
      : status === 'sent'
      ? 'info'
      : 'neutral'

  return { label: labels[status] || q?.status || 'Draft', tone }
}

// ─── component ───────────────────────────────────────────────────────────────

export default function Quotations() {
  const { language } = useSelector((s) => s.ui)
  const { tenant } = useSelector((s) => s.auth)
  const { t } = useTranslation(language)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const printRef = useRef(null)

  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [pdfLoadingId, setPdfLoadingId] = useState(null)
  const [printLoadingId, setPrintLoadingId] = useState(null)
  const [waLoadingId, setWaLoadingId] = useState(null)
  const [approveModalQ, setApproveModalQ] = useState(null)
  const [rejectModalQ, setRejectModalQ] = useState(null)

  const handleWaClick = async (q) => {
    try {
      setWaLoadingId(q._id)
      const res = await api.post(`/quotations/${q._id}/send-whatsapp`, { language })
      const resData = res?.data || {}
      if (resData?.channel === 'direct_whatsapp') {
        toast.success(language === 'ar' ? 'تم إرسال عرض السعر عبر واتساب بنجاح' : 'Quotation sent via WhatsApp successfully')
      } else if (resData?.waLink) {
        window.open(resData.waLink, '_blank')
        toast.success(language === 'ar' ? 'جاري فتح واتساب لإرسال عرض السعر...' : 'Opening WhatsApp...')
      } else {
        toast.success(language === 'ar' ? 'تم إرسال عرض السعر عبر واتساب' : 'Quotation sent via WhatsApp')
      }
    } catch (e) {
      toast.error(e?.response?.data?.error || e?.message || (language === 'ar' ? 'فشل إرسال واتساب' : 'Failed to send WhatsApp'))
    } finally {
      setWaLoadingId(null)
    }
  }

  // Debounce search
  useEffect(() => {
    const h = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(h)
  }, [search])

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['quotations', page, debouncedSearch, statusFilter],
    queryFn: () =>
      api
        .get('/quotations', { params: { page, limit: 20, search: debouncedSearch, status: statusFilter } })
        .then((r) => r.data),
    placeholderData: (prev) => prev,
    staleTime: 30_000,
  })

  const approveMutation = useMutation({
    mutationFn: (id) => api.post(`/quotations/${id}/approve`),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['quotations'] })
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] })
      toast.success(
        language === 'ar'
          ? 'تم الاعتماد وإنشاء أمر البيع'
          : 'Approved — sales order created',
      )
      setApproveModalQ(null)
      const orderId = response?.data?.orderId
      if (orderId) navigate(`/app/dashboard/sales/orders/${orderId}`)
    },
    onError: (e) =>
      toast.error(
        e?.response?.data?.error || (language === 'ar' ? 'تعذر الاعتماد' : 'Unable to approve'),
      ),
  })

  const rejectMutation = useMutation({
    mutationFn: (id) => api.post(`/quotations/${id}/reject`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotations'] })
      toast.success(language === 'ar' ? 'تم رفض عرض السعر' : 'Quotation rejected')
      setRejectModalQ(null)
    },
    onError: (e) =>
      toast.error(
        e?.response?.data?.error || (language === 'ar' ? 'تعذر الرفض' : 'Unable to reject'),
      ),
  })

  // Export rows for Excel/CSV
  const exportRows = useMemo(
    () =>
      (data?.quotations || []).map((q) => ({
        quotationNumber: q?.quotationNumber || '',
        customer: formatPartyNames(q?.buyer),
        status: q?.status || '',
        issueDate: q?.issueDate
          ? new Date(q.issueDate).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US')
          : '',
        validUntil: q?.validUntil
          ? new Date(q.validUntil).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US')
          : '',
        total: Number(q?.grandTotal || 0),
      })),
    [data?.quotations, language],
  )

  const getExportRows = useCallback(async () => {
    let currentPage = 1
    let all = []
    while (true) {
      const res = await api.get('/quotations', {
        params: { page: currentPage, limit: 200, search: debouncedSearch, status: statusFilter },
      })
      const batch = res.data?.quotations || []
      all = all.concat(batch)
      if (currentPage >= (res.data?.pagination?.pages || 1)) break
      currentPage++
      if (all.length >= 5000) break
    }
    return all.map((q) => ({
      quotationNumber: q?.quotationNumber || '',
      customer: formatPartyNames(q?.buyer),
      status: q?.status || '',
      issueDate: q?.issueDate
        ? new Date(q.issueDate).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US')
        : '',
      validUntil: q?.validUntil
        ? new Date(q.validUntil).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US')
        : '',
      total: Number(q?.grandTotal || 0),
    }))
  }, [debouncedSearch, statusFilter, language])

  const exportColumns = [
    { key: 'quotationNumber', label: language === 'ar' ? 'رقم عرض السعر' : 'Quotation #' },
    { key: 'customer', label: language === 'ar' ? 'العميل' : 'Customer' },
    { key: 'status', label: language === 'ar' ? 'الحالة' : 'Status' },
    { key: 'issueDate', label: language === 'ar' ? 'تاريخ الإصدار' : 'Issue Date' },
    { key: 'validUntil', label: language === 'ar' ? 'صالح حتى' : 'Valid Until' },
    { key: 'total', label: language === 'ar' ? 'الإجمالي' : 'Total' },
  ]

  const pagination = data?.pagination || { page: 1, pages: 1 }

  const getStatusBadge = useCallback(
    (q) => {
      const meta = getQuotationStatusMeta(q, language)
      const cls =
        meta.tone === 'success'
          ? 'badge-success'
          : meta.tone === 'danger'
          ? 'badge-danger'
          : meta.tone === 'info'
          ? 'badge-info'
          : 'badge-neutral'
      const icon =
        meta.tone === 'success' ? (
          <CheckCircle className="w-3 h-3 me-1" />
        ) : meta.tone === 'danger' ? (
          <XCircle className="w-3 h-3 me-1" />
        ) : (
          <Clock className="w-3 h-3 me-1" />
        )
      return (
        <span className={`badge ${cls}`}>
          {icon}
          {meta.label}
        </span>
      )
    },
    [language],
  )

  // ─── render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* ── Approve confirm modal ── */}
      <AnimatePresence>
        {approveModalQ && (
          <motion.div
            key="approve-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={(e) => { if (e.target === e.currentTarget) setApproveModalQ(null) }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              className="relative w-full max-w-md rounded-2xl bg-white dark:bg-dark-800 shadow-2xl ring-1 ring-black/10 dark:ring-white/10"
            >
              <div className="flex items-center gap-3 p-5 border-b border-gray-100 dark:border-dark-700">
                <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
                  <CheckCircle className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    {language === 'ar' ? 'اعتماد عرض السعر' : 'Approve Quotation'}
                  </p>
                  <p className="text-xs text-gray-500 font-mono mt-0.5">{approveModalQ.quotationNumber}</p>
                </div>
              </div>
              <div className="p-5">
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  {language === 'ar'
                    ? 'هل تريد اعتماد عرض السعر هذا؟ سيتم إنشاء أمر بيع تلقائياً.'
                    : 'Approve this quotation? A sales order will be created automatically.'}
                </p>
              </div>
              <div className="flex gap-3 p-5 pt-0">
                <button
                  className="flex-1 btn btn-secondary"
                  disabled={approveMutation.isPending}
                  onClick={() => setApproveModalQ(null)}
                >
                  {language === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  className="flex-1 btn btn-primary"
                  disabled={approveMutation.isPending}
                  onClick={() => approveMutation.mutate(approveModalQ._id)}
                >
                  {approveMutation.isPending ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <CheckCircle className="w-4 h-4" />
                  )}
                  {language === 'ar' ? 'اعتماد' : 'Approve'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Reject confirm modal ── */}
      <AnimatePresence>
        {rejectModalQ && (
          <motion.div
            key="reject-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={(e) => { if (e.target === e.currentTarget) setRejectModalQ(null) }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              className="relative w-full max-w-md rounded-2xl bg-white dark:bg-dark-800 shadow-2xl ring-1 ring-black/10 dark:ring-white/10"
            >
              <div className="flex items-center gap-3 p-5 border-b border-gray-100 dark:border-dark-700">
                <div className="p-2 rounded-xl bg-rose-100 dark:bg-rose-900/30">
                  <XCircle className="w-5 h-5 text-rose-600" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    {language === 'ar' ? 'رفض عرض السعر' : 'Reject Quotation'}
                  </p>
                  <p className="text-xs text-gray-500 font-mono mt-0.5">{rejectModalQ.quotationNumber}</p>
                </div>
              </div>
              <div className="p-5">
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  {language === 'ar'
                    ? 'هل تريد رفض هذا العرض؟'
                    : 'Are you sure you want to reject this quotation?'}
                </p>
              </div>
              <div className="flex gap-3 p-5 pt-0">
                <button
                  className="flex-1 btn btn-secondary"
                  disabled={rejectMutation.isPending}
                  onClick={() => setRejectModalQ(null)}
                >
                  {language === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  className="flex-1 btn bg-rose-600 hover:bg-rose-700 text-white"
                  disabled={rejectMutation.isPending}
                  onClick={() => rejectMutation.mutate(rejectModalQ._id)}
                >
                  {rejectMutation.isPending ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <XCircle className="w-4 h-4" />
                  )}
                  {language === 'ar' ? 'رفض' : 'Reject'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className={sectionEyebrowClass}>{language === 'ar' ? 'المبيعات' : 'Sales'}</p>
          <h1 className={pageTitleClass}>
            {language === 'ar' ? 'عروض الأسعار' : 'Quotations'}
          </h1>
          <p className={pageSubtitleClass}>
            {language === 'ar'
              ? 'إدارة عروض الأسعار وتحويلها إلى فواتير'
              : 'Manage quotations and convert them to sales orders'}
          </p>
        </div>
        <div className="flex gap-2">
          <ExportMenu
            language={language}
            t={t}
            rows={exportRows}
            getRows={getExportRows}
            columns={exportColumns}
            fileBaseName={language === 'ar' ? 'عروض-الأسعار' : 'Quotations'}
            title={language === 'ar' ? 'عروض الأسعار' : 'Quotations'}
            disabled={isLoading || (data?.quotations || []).length === 0}
          />
          <Link to="/app/dashboard/quotations/new" className="btn btn-secondary">
            {language === 'ar' ? 'عرض سعر سريع' : 'Quick quotation'}
          </Link>
          <SalesCreateMenu language={language} labelEn="Create" labelAr="إنشاء" />
        </div>
      </div>

      {/* ── Filters ── */}
      <div className={filterBarClass}>
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder={language === 'ar' ? 'بحث برقم العرض أو العميل...' : 'Search by number or customer...'}
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              className={`${fieldControlClass} ps-10`}
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
            className={`${fieldControlClass} w-full sm:w-48`}
          >
            <option value="">{language === 'ar' ? 'كل الحالات' : 'All Statuses'}</option>
            <option value="draft">{language === 'ar' ? 'مسودة' : 'Draft'}</option>
            <option value="sent">{language === 'ar' ? 'مرسل' : 'Sent'}</option>
            <option value="accepted">{language === 'ar' ? 'مقبول' : 'Accepted'}</option>
            <option value="approved">{language === 'ar' ? 'معتمد' : 'Approved'}</option>
            <option value="converted">{language === 'ar' ? 'تم التحويل' : 'Converted'}</option>
            <option value="rejected">{language === 'ar' ? 'مرفوض' : 'Rejected'}</option>
            <option value="expired">{language === 'ar' ? 'منتهي' : 'Expired'}</option>
          </select>
          {(isFetching && !isLoading) && (
            <span className="inline-flex items-center gap-1.5 self-center px-3 py-1.5 text-xs text-slate-400">
              <div className="h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-transparent" />
              {language === 'ar' ? 'جارٍ التحديث...' : 'Updating...'}
            </span>
          )}
        </div>
      </div>

      {/* ── Table ── */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={listShellClass}>
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="inline-block w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className={salesTableClass}>
                <thead>
                  <tr>
                    <th className={salesThClass}>{language === 'ar' ? 'رقم العرض' : 'Quotation #'}</th>
                    <th className={salesThClass}>{language === 'ar' ? 'العميل' : 'Customer'}</th>
                    <th className={salesThClass}>{language === 'ar' ? 'تاريخ الإصدار' : 'Issue Date'}</th>
                    <th className={salesThClass}>{language === 'ar' ? 'صالح حتى' : 'Valid Until'}</th>
                    <th className={salesThClass}>{language === 'ar' ? 'الإجمالي' : 'Total'}</th>
                    <th className={salesThClass}>{language === 'ar' ? 'الحالة' : 'Status'}</th>
                    <th className={salesThClass}>{language === 'ar' ? 'الإجراءات' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.quotations || []).length === 0 ? (
                    <tr>
                      <td colSpan={7} className={emptyStateClass}>
                        {language === 'ar' ? 'لا توجد عروض أسعار' : 'No quotations found'}
                      </td>
                    </tr>
                  ) : (
                    (data?.quotations || []).map((q) => (
                      <tr key={q._id} className={salesTrClass}>
                        <td className={salesTdClass}>
                          <button
                            type="button"
                            onClick={() => navigate(`/app/dashboard/quotations/${q._id}`)}
                            className={docLinkClass}
                          >
                            <FileText className="h-4 w-4 shrink-0 text-slate-400" strokeWidth={1.75} />
                            {q.quotationNumber}
                          </button>
                        </td>

                        <td className={salesTdClass}>
                          <PartyNames party={q?.buyer} fallback="—" />
                        </td>

                        <td className={`${salesTdClass} text-sm text-slate-600 dark:text-slate-300`}>
                          {q?.issueDate
                            ? new Date(q.issueDate).toLocaleDateString(
                                language === 'ar' ? 'ar-SA' : 'en-US',
                              )
                            : '—'}
                        </td>

                        <td className={`${salesTdClass} text-sm text-slate-600 dark:text-slate-300`}>
                          {q?.validUntil
                            ? new Date(q.validUntil).toLocaleDateString(
                                language === 'ar' ? 'ar-SA' : 'en-US',
                              )
                            : '—'}
                        </td>

                        <td className={`${salesTdClass} text-sm font-semibold text-slate-900 dark:text-white`}>
                          <Money value={q?.grandTotal || 0} />
                        </td>

                        <td className={salesTdClass}>{getStatusBadge(q)}</td>

                        <td className={salesTdClass}>
                          <div className={rowActionsWrapClass}>
                            <Link
                              to={`/app/dashboard/quotations/${q._id}`}
                              className={rowActionBtnClass}
                              title={language === 'ar' ? 'عرض' : 'View'}
                            >
                              <Eye className="w-4 h-4" />
                            </Link>

                            {isEditableQuotation(q) && (
                              <Link
                                to={`/app/dashboard/quotations/${q._id}/edit`}
                                className={rowActionBtnClass}
                                title={language === 'ar' ? 'تعديل' : 'Edit'}
                              >
                                <Edit className="w-4 h-4" />
                              </Link>
                            )}

                            {canApproveQuotation(q) && (
                              <button
                                type="button"
                                className={rowActionPrimaryClass}
                                title={language === 'ar' ? 'اعتماد' : 'Approve'}
                                onClick={() => setApproveModalQ(q)}
                              >
                                <CheckCircle className="w-4 h-4" />
                              </button>
                            )}

                            {canRejectQuotation(q) && (
                              <button
                                type="button"
                                className={rowActionBtnClass}
                                title={language === 'ar' ? 'رفض' : 'Reject'}
                                onClick={() => setRejectModalQ(q)}
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                            )}

                            {hasConvertedOrder(q) && (
                              <Link
                                to={`/app/dashboard/sales/orders/${q.convertedOrderId?._id || q.convertedOrderId}`}
                                className={rowActionBtnClass}
                                title={language === 'ar' ? 'عرض أمر البيع' : 'View sales order'}
                              >
                                <ShoppingCart className="w-4 h-4" />
                              </Link>
                            )}

                            <button
                              type="button"
                              className={rowActionBtnClass}
                              title={language === 'ar' ? 'طباعة' : 'Print'}
                              disabled={printLoadingId === q._id}
                              onClick={async () => {
                                try {
                                  setPrintLoadingId(q._id)
                                  const full = await api
                                    .get(`/quotations/${q._id}`)
                                    .then((r) => r.data)
                                  const ok = await printQuotationSnapshot({
                                    quotation: full,
                                    language,
                                    tenant,
                                  })
                                  if (!ok) throw new Error('print failed')
                                } catch {
                                  toast.error(
                                    language === 'ar'
                                      ? 'تعذر تجهيز الطباعة'
                                      : 'Unable to prepare print view',
                                  )
                                } finally {
                                  setPrintLoadingId(null)
                                }
                              }}
                            >
                              {printLoadingId === q._id ? (
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
                              ) : (
                                <Printer className="w-4 h-4" />
                              )}
                            </button>

                            <button
                              type="button"
                              className={rowActionBtnClass}
                              title={language === 'ar' ? 'تنزيل PDF' : 'Download PDF'}
                              disabled={pdfLoadingId === q._id}
                              onClick={async () => {
                                try {
                                  setPdfLoadingId(q._id)
                                  const full = await api
                                    .get(`/quotations/${q._id}`)
                                    .then((r) => r.data)
                                  await downloadQuotationPdf({ quotation: full, language, tenant })
                                } catch {
                                  toast.error(
                                    language === 'ar' ? 'فشل تحميل PDF' : 'Failed to download PDF',
                                  )
                                } finally {
                                  setPdfLoadingId(null)
                                }
                              }}
                            >
                              {pdfLoadingId === q._id ? (
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
                              ) : (
                                <Download className="w-4 h-4" />
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() => handleWaClick(q)}
                              disabled={waLoadingId === q._id}
                              className={rowActionBtnClass}
                              title={language === 'ar' ? 'إرسال عبر واتساب' : 'Send via WhatsApp'}
                            >
                              {waLoadingId === q._id ? (
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
                              ) : (
                                <MessageCircle className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className={paginationBarClass}>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {language === 'ar'
                  ? `الصفحة ${pagination.page} من ${pagination.pages || 1}`
                  : `Page ${pagination.page} of ${pagination.pages || 1}`}
              </p>
              <div className="flex gap-2">
                <button
                  className="btn btn-secondary"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={pagination.page <= 1}
                >
                  {language === 'ar' ? 'السابق' : 'Previous'}
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => setPage((p) => Math.min(pagination.pages || 1, p + 1))}
                  disabled={pagination.page >= (pagination.pages || 1)}
                >
                  {language === 'ar' ? 'التالي' : 'Next'}
                </button>
              </div>
            </div>
          </>
        )}
      </motion.div>
    </div>
  )
}
