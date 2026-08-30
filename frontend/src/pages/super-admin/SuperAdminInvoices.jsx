import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Plus, Search, Building2, User, FileText, Receipt, ShieldCheck, 
  CheckCircle2, Trash2, Eye, Printer, Download, ArrowLeft, 
  Calendar, RefreshCw, X, AlertCircle, Sparkles, Sliders, ExternalLink
} from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import { generateZatcaQrValue } from '../../lib/zatcaQr'
import SuperAdminPortal, { SA_MODAL_Z } from '../../components/super-admin/SuperAdminPortal'

export default function SuperAdminInvoices() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { language } = useSelector((state) => state.ui)
  const isAr = language === 'ar'

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [page, setPage] = useState(1)
  const [previewInvoice, setPreviewInvoice] = useState(null)

  // Fetch Invoices
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['super-admin-invoices', page, search, statusFilter, typeFilter],
    queryFn: async () => {
      const res = await api.get('/super-admin/invoices', {
        params: {
          page,
          search,
          status: statusFilter || undefined,
          transactionType: typeFilter || undefined,
          limit: 15
        }
      })
      return res.data
    },
    staleTime: 30 * 1000,
  })

  const invoices = data?.invoices || []
  const pagination = data?.pagination || { page: 1, pages: 1, total: 0 }
  const stats = data?.stats || { totalRevenue: 0, totalTax: 0, totalInvoices: 0 }

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/super-admin/invoices/${id}`),
    onSuccess: () => {
      toast.success(isAr ? 'تم حذف الفاتورة بنجاح' : 'Invoice deleted successfully')
      queryClient.invalidateQueries(['super-admin-invoices'])
      if (previewInvoice) setPreviewInvoice(null)
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || (isAr ? 'فشل حذف الفاتورة' : 'Failed to delete invoice'))
    }
  })

  const handleDelete = (id, invoiceNum) => {
    if (window.confirm(isAr ? `هل أنت متأكد من حذف الفاتورة ${invoiceNum}؟` : `Are you sure you want to delete invoice ${invoiceNum}?`)) {
      deleteMutation.mutate(id)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="space-y-8 animate-fade-in pb-16">
      {/* Header with Title and Create Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-sm">
            <Receipt className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
              {isAr ? 'فواتير المبيعات (ZATCA)' : 'Sell Invoices (ZATCA)'}
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {isAr ? 'إنشاء وإدارة فواتير المبيعات المتوافقة كلياً مع متطلبات هيئة الزكاة والضريبة والجمارك' : 'Create and manage ZATCA-compliant B2B & B2C sell invoices with instant tenant autofill'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="btn btn-secondary text-xs flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
            {isAr ? 'تحديث' : 'Refresh'}
          </button>

          <Link
            to="/super-admin/invoices/new"
            className="btn btn-primary text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-500/20 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <Plus className="w-4 h-4" />
            {isAr ? 'إنشاء فاتورة مبيعات جديدة' : 'Create Sell Invoice'}
          </Link>
        </div>
      </div>

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="card p-5 border border-gray-100 dark:border-dark-700 rounded-3xl bg-white dark:bg-dark-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                {isAr ? 'إجمالي الفواتير' : 'Total Invoices'}
              </p>
              <p className="text-2xl font-black text-gray-900 dark:text-white">
                {stats.totalInvoices || pagination.total || 0}
              </p>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="card p-5 border border-gray-100 dark:border-dark-700 rounded-3xl bg-white dark:bg-dark-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                {isAr ? 'إجمالي المبيعات' : 'Total Revenue'}
              </p>
              <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                {(stats.totalRevenue || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-xs font-bold text-gray-500">SAR</span>
              </p>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Receipt className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="card p-5 border border-gray-100 dark:border-dark-700 rounded-3xl bg-white dark:bg-dark-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                {isAr ? 'إجمالي ضريبة القيمة المضافة' : 'Total VAT (15%)'}
              </p>
              <p className="text-2xl font-black text-amber-600 dark:text-amber-400">
                {(stats.totalTax || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-xs font-bold text-gray-500">SAR</span>
              </p>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="card p-5 border border-gray-100 dark:border-dark-700 rounded-3xl bg-white dark:bg-dark-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                {isAr ? 'التوافق مع هيئة الزكاة' : 'ZATCA Integration'}
              </p>
              <p className="text-sm font-bold text-teal-600 dark:text-teal-400 flex items-center gap-1.5 mt-1">
                <ShieldCheck className="w-4 h-4" />
                {isAr ? 'ترميز TLV & QR مدعوم كلياً' : 'Phase 1 & 2 Ready'}
              </p>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="card p-5 border border-gray-100 dark:border-dark-700 rounded-3xl bg-white dark:bg-dark-800 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2 relative">
            <Search className="w-4 h-4 text-gray-400 absolute start-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder={isAr ? 'بحث برقم الفاتورة، اسم البائع، اسم المشتري، الرقم الضريبي...' : 'Search by invoice #, seller, buyer, VAT number, CR...'}
              className="input ps-10"
            />
          </div>

          <div>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="select"
            >
              <option value="">{isAr ? 'جميع الحالات' : 'All Statuses'}</option>
              <option value="issued">{isAr ? 'مصدرة (Issued)' : 'Issued'}</option>
              <option value="paid">{isAr ? 'مدفوعة (Paid)' : 'Paid'}</option>
              <option value="draft">{isAr ? 'مسودة (Draft)' : 'Draft'}</option>
              <option value="pending">{isAr ? 'معلقة (Pending)' : 'Pending'}</option>
            </select>
          </div>

          <div>
            <select
              value={typeFilter}
              onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
              className="select"
            >
              <option value="">{isAr ? 'جميع الأنواع (B2B & B2C)' : 'All Types (B2B & B2C)'}</option>
              <option value="B2B">{isAr ? 'فاتورة ضريبية قياسية (B2B)' : 'Standard Tax Invoice (B2B)'}</option>
              <option value="B2C">{isAr ? 'فاتورة ضريبية مبسطة (B2C)' : 'Simplified Tax Invoice (B2C)'}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="card border border-gray-100 dark:border-dark-700 rounded-3xl bg-white dark:bg-dark-800 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="py-20 text-center">
            <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin mx-auto mb-3" />
            <p className="text-sm text-gray-500">{isAr ? 'جاري تحميل الفواتير...' : 'Loading sell invoices...'}</p>
          </div>
        ) : invoices.length === 0 ? (
          <div className="py-20 text-center">
            <FileText className="w-12 h-12 text-gray-300 dark:text-dark-600 mx-auto mb-4" />
            <h3 className="text-base font-bold text-gray-800 dark:text-gray-200 mb-1">
              {isAr ? 'لا توجد فواتير مبيعات بعد' : 'No sell invoices found'}
            </h3>
            <p className="text-xs text-gray-500 max-w-sm mx-auto mb-6">
              {isAr ? 'ابدأ بإنشاء أول فاتورة مبيعات مع ملء تلقائي لبيانات البائع والمشتري من المنشآت المسجلة' : 'Create your first sell invoice with automatic buyer & seller tenant selection'}
            </p>
            <Link
              to="/super-admin/invoices/new"
              className="btn btn-primary text-xs font-bold inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Plus className="w-4 h-4" />
              {isAr ? 'إنشاء فاتورة الآن' : 'Create Invoice Now'}
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-start">
              <thead className="bg-gray-50/80 dark:bg-dark-700/50 text-gray-600 dark:text-gray-300 text-xs uppercase font-bold border-b border-gray-100 dark:border-dark-700">
                <tr>
                  <th className="py-3.5 px-4 text-start">{isAr ? 'رقم الفاتورة' : 'Invoice #'}</th>
                  <th className="py-3.5 px-4 text-start">{isAr ? 'النوع' : 'Type'}</th>
                  <th className="py-3.5 px-4 text-start">{isAr ? 'البائع (Seller)' : 'Seller'}</th>
                  <th className="py-3.5 px-4 text-start">{isAr ? 'المشتري (Buyer)' : 'Buyer'}</th>
                  <th className="py-3.5 px-4 text-start">{isAr ? 'تاريخ الإصدار' : 'Issue Date'}</th>
                  <th className="py-3.5 px-4 text-end">{isAr ? 'الإجمالي (مع الضريبة)' : 'Grand Total'}</th>
                  <th className="py-3.5 px-4 text-center">{isAr ? 'حالة زاتكا' : 'ZATCA'}</th>
                  <th className="py-3.5 px-4 text-center">{isAr ? 'الحالة' : 'Status'}</th>
                  <th className="py-3.5 px-4 text-end">{isAr ? 'الإجراءات' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-dark-700">
                {invoices.map((inv) => {
                  const isB2B = inv.transactionType === 'B2B' || inv.invoiceTypeCode === '0100000'
                  return (
                    <tr key={inv._id} className="hover:bg-gray-50/60 dark:hover:bg-dark-700/40 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-gray-900 dark:text-white">
                        {inv.invoiceNumber}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${
                          isB2B 
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300' 
                            : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                        }`}>
                          {isB2B ? 'B2B' : 'B2C'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div>
                          <p className="font-semibold text-gray-900 dark:text-white truncate max-w-[180px]">
                            {isAr ? (inv.seller?.nameAr || inv.seller?.name) : (inv.seller?.name || inv.seller?.nameAr)}
                          </p>
                          {inv.seller?.vatNumber && (
                            <p className="text-[11px] font-mono text-gray-400">
                              VAT: {inv.seller.vatNumber}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div>
                          <p className="font-semibold text-gray-900 dark:text-white truncate max-w-[180px]">
                            {isAr ? (inv.buyer?.nameAr || inv.buyer?.name) : (inv.buyer?.name || inv.buyer?.nameAr)}
                          </p>
                          {inv.buyer?.vatNumber && (
                            <p className="text-[11px] font-mono text-gray-400">
                              VAT: {inv.buyer.vatNumber}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap">
                        {inv.issueDate ? new Date(inv.issueDate).toLocaleDateString(isAr ? 'ar-SA' : 'en-US') : '—'}
                      </td>
                      <td className="py-3.5 px-4 text-end font-bold text-gray-900 dark:text-white whitespace-nowrap">
                        {(inv.grandTotal || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-[10px] text-gray-400">SAR</span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {inv.zatca?.qrCodeData || inv.zatca?.qrCodeImage ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/60">
                            <CheckCircle2 className="w-3 h-3" />
                            {isAr ? 'متوافقة (TLV)' : 'TLV QR'}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/60">
                            <AlertCircle className="w-3 h-3" />
                            {isAr ? 'مسودة' : 'Draft'}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          inv.paymentStatus === 'paid' || inv.status === 'paid'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                            : inv.paymentStatus === 'partial'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                            : 'bg-slate-100 text-slate-800 dark:bg-dark-700 dark:text-slate-300'
                        }`}>
                          {inv.paymentStatus === 'paid' ? (isAr ? 'مدفوعة' : 'Paid') : inv.paymentStatus === 'partial' ? (isAr ? 'مدفوعة جزئياً' : 'Partial') : (isAr ? 'مستحقة' : 'Pending')}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-end">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setPreviewInvoice(inv)}
                            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-700 text-gray-600 dark:text-gray-300 transition-colors"
                            title={isAr ? 'معاينة الفاتورة' : 'Preview Invoice'}
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(inv._id, inv.invoiceNumber)}
                            className="p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 text-rose-500 transition-colors"
                            title={isAr ? 'حذف الفاتورة' : 'Delete Invoice'}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {pagination.pages > 1 && (
          <div className="p-4 border-t border-gray-100 dark:border-dark-700 flex items-center justify-between">
            <p className="text-xs text-gray-500">
              {isAr ? `صفحة ${pagination.page} من ${pagination.pages} (${pagination.total} فاتورة)` : `Page ${pagination.page} of ${pagination.pages} (${pagination.total} invoices)`}
            </p>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                className="btn btn-secondary text-xs px-3 py-1.5 disabled:opacity-40"
              >
                {isAr ? 'السابق' : 'Previous'}
              </button>
              <button
                disabled={page >= pagination.pages}
                onClick={() => setPage(p => p + 1)}
                className="btn btn-secondary text-xs px-3 py-1.5 disabled:opacity-40"
              >
                {isAr ? 'التالي' : 'Next'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* PREVIEW INVOICE MODAL */}
      <SuperAdminPortal>
      <AnimatePresence>
        {previewInvoice && (
          <div className={`fixed inset-0 ${SA_MODAL_Z} flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto`}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-dark-800 rounded-3xl shadow-2xl border border-gray-100 dark:border-dark-700 w-full max-w-3xl overflow-hidden my-8"
            >
              {/* Modal Header */}
              <div className="p-6 border-b border-gray-100 dark:border-dark-700 flex items-center justify-between bg-gray-50/60 dark:bg-dark-900/40">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold font-mono">
                    <Receipt className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                      <span>{previewInvoice.invoiceNumber}</span>
                      <span className="text-xs px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
                        {previewInvoice.transactionType === 'B2B' ? 'B2B Tax Invoice' : 'B2C Simplified'}
                      </span>
                    </h3>
                    <p className="text-xs text-gray-400">
                      {new Date(previewInvoice.issueDate).toLocaleDateString(isAr ? 'ar-SA' : 'en-US')}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handlePrint}
                    className="btn btn-secondary text-xs flex items-center gap-1.5"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    {isAr ? 'طباعة' : 'Print'}
                  </button>
                  <button
                    onClick={() => setPreviewInvoice(null)}
                    className="btn btn-ghost btn-icon"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Modal Invoice Content (Printable) */}
              <div className="p-6 sm:p-8 space-y-6 max-h-[75vh] overflow-y-auto" id="printable-invoice">
                {/* Header Seller + QR Code */}
                <div className="flex flex-col sm:flex-row justify-between items-start gap-6 pb-6 border-b border-gray-100 dark:border-dark-700">
                  <div className="space-y-1">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                      {previewInvoice.seller?.nameAr || previewInvoice.seller?.name}
                    </h2>
                    {previewInvoice.seller?.name && previewInvoice.seller?.nameAr && (
                      <p className="text-sm text-gray-500">{previewInvoice.seller.name}</p>
                    )}
                    <p className="text-xs font-mono text-gray-600 dark:text-gray-300">
                      <strong>VAT:</strong> {previewInvoice.seller?.vatNumber || '—'}
                    </p>
                    <p className="text-xs font-mono text-gray-600 dark:text-gray-300">
                      <strong>CR:</strong> {previewInvoice.seller?.crNumber || '—'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {[
                        previewInvoice.seller?.address?.buildingNumber,
                        previewInvoice.seller?.address?.street || previewInvoice.seller?.address?.streetAr,
                        previewInvoice.seller?.address?.district || previewInvoice.seller?.address?.districtAr,
                        previewInvoice.seller?.address?.city || previewInvoice.seller?.address?.cityAr,
                        previewInvoice.seller?.address?.postalCode
                      ].filter(Boolean).join(', ')}
                    </p>
                  </div>

                  {/* QR Code Container */}
                  <div className="flex flex-col items-center p-3 rounded-2xl bg-slate-50 dark:bg-dark-900 border border-slate-200 dark:border-dark-700 self-center sm:self-start">
                    {previewInvoice.zatca?.qrCodeData ? (
                      <QRCodeSVG
                        value={previewInvoice.zatca.qrCodeData}
                        size={110}
                        level="M"
                        includeMargin={false}
                      />
                    ) : (
                      <div className="w-28 h-28 flex items-center justify-center text-xs text-gray-400">
                        {isAr ? 'رمز QR غير متوفر' : 'QR Not Available'}
                      </div>
                    )}
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mt-2">
                      ZATCA E-INVOICE
                    </span>
                  </div>
                </div>

                {/* Buyer Card */}
                <div className="p-4 rounded-2xl bg-gray-50/80 dark:bg-dark-700/40 border border-gray-100 dark:border-dark-600/50 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-gray-400 font-semibold block mb-1 uppercase tracking-wider text-[10px]">
                      {isAr ? 'بيانات المشتري (Buyer)' : 'Buyer Details'}
                    </span>
                    <p className="font-bold text-gray-900 dark:text-white text-sm">
                      {previewInvoice.buyer?.nameAr || previewInvoice.buyer?.name || 'Cash Customer'}
                    </p>
                    {previewInvoice.buyer?.name && previewInvoice.buyer?.nameAr && (
                      <p className="text-gray-500">{previewInvoice.buyer.name}</p>
                    )}
                    {previewInvoice.buyer?.contactEmail && (
                      <p className="text-gray-500">{previewInvoice.buyer.contactEmail}</p>
                    )}
                  </div>
                  <div className="space-y-0.5">
                    <p className="font-mono text-gray-700 dark:text-gray-300">
                      <strong>VAT:</strong> {previewInvoice.buyer?.vatNumber || '—'}
                    </p>
                    <p className="font-mono text-gray-700 dark:text-gray-300">
                      <strong>CR:</strong> {previewInvoice.buyer?.crNumber || '—'}
                    </p>
                    <p className="text-gray-500">
                      {[
                        previewInvoice.buyer?.address?.buildingNumber,
                        previewInvoice.buyer?.address?.street || previewInvoice.buyer?.address?.streetAr,
                        previewInvoice.buyer?.address?.district || previewInvoice.buyer?.address?.districtAr,
                        previewInvoice.buyer?.address?.city || previewInvoice.buyer?.address?.cityAr,
                      ].filter(Boolean).join(', ') || 'Saudi Arabia'}
                    </p>
                  </div>
                </div>

                {/* Line Items Table */}
                <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-dark-700">
                  <table className="w-full text-xs text-start">
                    <thead className="bg-gray-50 dark:bg-dark-700 text-gray-600 dark:text-gray-300 uppercase font-bold">
                      <tr>
                        <th className="py-2.5 px-3 text-start">#</th>
                        <th className="py-2.5 px-3 text-start">{isAr ? 'الوصف / البند' : 'Description'}</th>
                        <th className="py-2.5 px-3 text-center">{isAr ? 'الكمية' : 'Qty'}</th>
                        <th className="py-2.5 px-3 text-end">{isAr ? 'سعر الوحدة' : 'Unit Price'}</th>
                        <th className="py-2.5 px-3 text-end">{isAr ? 'الضريبة (15%)' : 'VAT'}</th>
                        <th className="py-2.5 px-3 text-end">{isAr ? 'الإجمالي' : 'Total'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-dark-700">
                      {(previewInvoice.lineItems || []).map((li, idx) => (
                        <tr key={idx}>
                          <td className="py-2.5 px-3 text-gray-400">{idx + 1}</td>
                          <td className="py-2.5 px-3 font-semibold text-gray-900 dark:text-white">
                            {li.productNameAr || li.productName}
                            {li.unitCode ? <span className="ms-1.5 text-[10px] text-gray-400 font-mono">({li.unitCode})</span> : null}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono">{li.quantity}</td>
                          <td className="py-2.5 px-3 text-end font-mono">{(li.unitPrice || 0).toFixed(2)}</td>
                          <td className="py-2.5 px-3 text-end font-mono">{(li.taxAmount || 0).toFixed(2)}</td>
                          <td className="py-2.5 px-3 text-end font-bold font-mono">{(li.lineTotalWithTax || li.lineTotal || 0).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Financial Summary */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 pt-4 border-t border-gray-100 dark:border-dark-700">
                  <div className="text-xs text-gray-500 space-y-1">
                    <p><strong>{isAr ? 'طريقة الدفع:' : 'Payment Method:'}</strong> {previewInvoice.paymentMethod || 'Bank Transfer'}</p>
                    {previewInvoice.notes && <p><strong>{isAr ? 'ملاحظات:' : 'Notes:'}</strong> {previewInvoice.notes}</p>}
                  </div>

                  <div className="w-full sm:w-64 space-y-1.5 text-xs">
                    <div className="flex justify-between text-gray-600 dark:text-gray-400">
                      <span>{isAr ? 'المجموع الفرعي:' : 'Subtotal:'}</span>
                      <span className="font-mono">{(previewInvoice.subtotal || 0).toFixed(2)} SAR</span>
                    </div>
                    {previewInvoice.totalDiscount > 0 && (
                      <div className="flex justify-between text-rose-600">
                        <span>{isAr ? 'الخصم:' : 'Discount:'}</span>
                        <span className="font-mono">-{(previewInvoice.totalDiscount || 0).toFixed(2)} SAR</span>
                      </div>
                    )}
                    <div className="flex justify-between text-gray-600 dark:text-gray-400">
                      <span>{isAr ? 'ضريبة القيمة المضافة (15%):' : 'VAT (15%):'}</span>
                      <span className="font-mono">{(previewInvoice.totalTax || 0).toFixed(2)} SAR</span>
                    </div>
                    <div className="flex justify-between text-base font-black text-gray-900 dark:text-white pt-2 border-t border-gray-200 dark:border-dark-600">
                      <span>{isAr ? 'المجموع الكلي:' : 'Grand Total:'}</span>
                      <span className="font-mono text-emerald-600 dark:text-emerald-400">{(previewInvoice.grandTotal || 0).toFixed(2)} SAR</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      </SuperAdminPortal>
    </div>
  )
}
