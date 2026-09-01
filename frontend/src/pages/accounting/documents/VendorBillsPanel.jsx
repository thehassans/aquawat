import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Plus, Search, Eye, Download } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../../lib/api'
import Money from '../../../components/ui/Money'
import ExportMenu from '../../../components/ui/ExportMenu'
import ResponsiveDataList from '../../../components/ui/ResponsiveDataList'
import AccountingDocumentBatchBar from './AccountingDocumentBatchBar'
import RegisterPaymentModal from '../../../components/accounting/RegisterPaymentModal'
import BatchVendorPaymentModal from '../../../components/accounting/BatchVendorPaymentModal'
import { downloadSepaBatch, markSepaUploaded } from '../../../lib/vendorApTools'
import {
  canRegisterPaymentOnBill,
  documentStatusLabel,
  invoiceRemainingBalance,
  paymentStatusLabel,
} from '../../../lib/accountingDocumentStatus'
import {
  docLinkClass,
  emptyStateClass,
  fieldControlClass,
  filterBarClass,
  listShellClass,
  rowActionBtnClass,
  rowActionsWrapClass,
  salesTdClass,
  salesThClass,
  salesTrClass,
  salesTableClass,
  softChipClass,
} from '../../sales/salesUi'

const trimName = (party) => {
  const en = String(party?.name || party?.nameEn || '').trim()
  const ar = String(party?.nameAr || '').trim()
  if (en && ar && en !== ar) return `${en} / ${ar}`
  return en || ar || '—'
}

export default function VendorBillsPanel({ language = 'en' }) {
  const isAr = language === 'ar'
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [paymentFilter, setPaymentFilter] = useState('')
  const productIdFilter = String(searchParams.get('productId') || '').trim()
  const supplierIdFilter = String(searchParams.get('supplierId') || '').trim()
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const [batchPayBill, setBatchPayBill] = useState(null)
  const [batchPayOpen, setBatchPayOpen] = useState(false)
  const [multiPayOpen, setMultiPayOpen] = useState(false)
  const [sepaUploadIds, setSepaUploadIds] = useState([])
  const [sepaUploadOpen, setSepaUploadOpen] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['vendor-bills', search, statusFilter, paymentFilter, productIdFilter, supplierIdFilter],
    queryFn: () => api.get('/invoices', {
      params: {
        limit: 100,
        flow: 'purchase',
        invoiceType: '388',
        search: search || undefined,
        status: statusFilter || undefined,
        paymentStatus: paymentFilter || undefined,
        productId: productIdFilter || undefined,
        supplierId: supplierIdFilter || undefined,
      },
    }).then((r) => r.data),
  })

  const rows = data?.invoices || []
  const selectedRows = useMemo(
    () => rows.filter((row) => selectedIds.has(String(row._id))),
    [rows, selectedIds],
  )

  const batchPayMutation = useMutation({
    mutationFn: ({ invoiceId, payload }) => api.post(`/invoices/${invoiceId}/payments`, payload),
    onSuccess: () => {
      toast.success(isAr ? 'تم تسجيل الدفعة' : 'Payment recorded')
      setBatchPayOpen(false)
      setBatchPayBill(null)
      setSelectedIds(new Set())
      queryClient.invalidateQueries({ queryKey: ['vendor-bills'] })
    },
    onError: (err) => toast.error(err.response?.data?.error || (isAr ? 'فشل تسجيل الدفعة' : 'Failed to record payment')),
  })

  const multiPayMutation = useMutation({
    mutationFn: async ({ method, memo, paymentDate, bills }) => {
      const results = []
      for (const bill of bills) {
        const res = await api.post(`/invoices/${bill.invoiceId}/payments`, {
          amount: bill.amount,
          method,
          memo,
          paymentDate,
        })
        results.push(res.data)
      }
      return results
    },
    onSuccess: (results) => {
      toast.success(isAr ? `تم تسجيل ${results.length} دفعات` : `Recorded ${results.length} payments`)
      setMultiPayOpen(false)
      setSelectedIds(new Set())
      queryClient.invalidateQueries({ queryKey: ['vendor-bills'] })
    },
    onError: (err) => toast.error(err.response?.data?.error || (isAr ? 'فشل الدفع الجماعي' : 'Batch payment failed')),
  })

  const exportColumns = useMemo(() => [
    { key: 'invoiceNumber', label: isAr ? 'الرقم' : 'Number' },
    { key: 'vendor', label: isAr ? 'المورد' : 'Vendor', value: (r) => trimName(r.seller) },
    { key: 'issueDate', label: isAr ? 'تاريخ الفاتورة' : 'Bill date' },
    { key: 'contractNumber', label: isAr ? 'مرجع المورد' : 'Reference' },
    { key: 'taxExcluded', label: isAr ? 'بدون ضريبة' : 'Tax excluded', value: (r) => Number(r.taxableAmount ?? r.subtotal ?? 0) },
    { key: 'grandTotal', label: isAr ? 'الإجمالي' : 'Total' },
    { key: 'paymentStatus', label: isAr ? 'حالة الدفع' : 'Payment status' },
    { key: 'status', label: isAr ? 'الحالة' : 'Status' },
  ], [isAr])

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      const key = String(id)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const handleBatchRegisterPayment = () => {
    const payable = selectedRows.filter((row) => canRegisterPaymentOnBill(row))
    if (!payable.length) {
      toast.error(isAr ? 'لا توجد فواتير قابلة للدفع' : 'No payable bills in selection')
      return
    }
    if (payable.length === 1) {
      setBatchPayBill(payable[0])
      setBatchPayOpen(true)
      return
    }
    setMultiPayOpen(true)
  }

  const handleSepaExport = async () => {
    const payable = selectedRows.filter((row) => canRegisterPaymentOnBill(row))
    const ids = (payable.length ? payable : selectedRows).map((row) => row._id)
    if (!ids.length) {
      toast.error(isAr ? 'حدد فواتير للتصدير' : 'Select bills to export')
      return
    }
    try {
      const result = await downloadSepaBatch(ids)
      toast.success(isAr ? 'تم تنزيل ملف SEPA' : 'SEPA file downloaded')
      setSepaUploadIds(result?.invoiceIds || ids)
      setSepaUploadOpen(true)
      queryClient.invalidateQueries({ queryKey: ['vendor-bills'] })
    } catch (err) {
      toast.error(err.response?.data?.error || (isAr ? 'فشل تصدير SEPA' : 'SEPA export failed'))
    }
  }

  const handleMarkSepaUploaded = async () => {
    try {
      await markSepaUploaded(sepaUploadIds)
      toast.success(isAr ? 'تم تسجيل الرفع إلى البنك' : 'Marked as uploaded to bank')
      setSepaUploadOpen(false)
      setSepaUploadIds([])
      queryClient.invalidateQueries({ queryKey: ['vendor-bills'] })
    } catch (err) {
      toast.error(err.response?.data?.error || (isAr ? 'فشل التأكيد' : 'Failed to confirm upload'))
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
            {isAr ? 'الموردون' : 'Vendors'}
          </p>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            {isAr ? 'فواتير الموردين' : 'Vendor bills'}
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ExportMenu
            columns={exportColumns}
            filename="vendor-bills"
            getRows={() => Promise.resolve(selectedRows.length ? selectedRows : rows)}
            label={isAr ? 'تصدير' : 'Export'}
          />
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleSepaExport}
            disabled={!selectedIds.size}
          >
            <Download className="h-4 w-4" />
            {isAr ? 'SEPA' : 'SEPA export'}
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => navigate('/app/dashboard/accounting/invoices/new/purchase')}
          >
            <Plus className="h-4 w-4" />
            {isAr ? 'فاتورة جديدة' : 'New bill'}
          </button>
        </div>
      </div>

      <div className={filterBarClass}>
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={isAr ? 'بحث…' : 'Search…'}
            className={`${fieldControlClass} ps-10`}
          />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={fieldControlClass}>
          <option value="">{isAr ? 'كل الحالات' : 'All statuses'}</option>
          <option value="draft">{isAr ? 'مسودة' : 'Draft'}</option>
          <option value="issued">{isAr ? 'مرحّلة' : 'Posted'}</option>
          <option value="cancelled">{isAr ? 'ملغاة' : 'Cancelled'}</option>
        </select>
        <select value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)} className={fieldControlClass}>
          <option value="">{isAr ? 'كل المدفوعات' : 'All payments'}</option>
          <option value="pending">{isAr ? 'غير مدفوعة' : 'Unpaid'}</option>
          <option value="partial">{isAr ? 'جزئي' : 'Partial'}</option>
          <option value="paid">{isAr ? 'مدفوعة' : 'Paid'}</option>
        </select>
        {(productIdFilter || supplierIdFilter) ? (
          <button
            type="button"
            className={`${softChipClass} !px-3`}
            onClick={() => {
              const next = new URLSearchParams(searchParams)
              next.delete('productId')
              next.delete('supplierId')
              setSearchParams(next)
            }}
          >
            {isAr ? 'مسح الفلتر' : 'Clear product/vendor filter'}
          </button>
        ) : null}
      </div>

      <AccountingDocumentBatchBar
        count={selectedIds.size}
        language={language}
        onRegisterPayment={handleBatchRegisterPayment}
        onSendPrint={handleSepaExport}
        onSepaExport={handleSepaExport}
        registerDisabled={!selectedRows.some((row) => canRegisterPaymentOnBill(row))}
      />

      <div className={listShellClass}>
        {isLoading ? (
          <p className={emptyStateClass}>{isAr ? 'جارٍ التحميل…' : 'Loading…'}</p>
        ) : (
          <ResponsiveDataList
            items={rows}
            empty={<p className={emptyStateClass}>{isAr ? 'لا توجد فواتير موردين' : 'No vendor bills yet'}</p>}
            renderCard={(row) => (
              <div key={row._id} className="space-y-2 rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-white/10 dark:bg-dark-800">
                <Link to={`/app/dashboard/accounting/invoices/${row._id}`} className={`${docLinkClass} text-base`}>
                  {row.invoiceNumber}
                </Link>
                <p className="text-sm text-slate-500">{trimName(row.seller)}</p>
                <div className="flex items-center justify-between text-sm">
                  <Money value={row.grandTotal} />
                  <span className={softChipClass}>{paymentStatusLabel(row.paymentStatus, language)}</span>
                </div>
              </div>
            )}
          >
            <table className={salesTableClass}>
              <thead>
                <tr>
                  <th className={`${salesThClass} w-10`}>
                    <input
                      type="checkbox"
                      aria-label={isAr ? 'تحديد الكل' : 'Select all'}
                      checked={rows.length > 0 && selectedIds.size === rows.length}
                      onChange={() => {
                        setSelectedIds((prev) => (
                          prev.size === rows.length && rows.length > 0
                            ? new Set()
                            : new Set(rows.map((row) => String(row._id)))
                        ))
                      }}
                    />
                  </th>
                  <th className={salesThClass}>{isAr ? 'الرقم' : 'Number'}</th>
                  <th className={salesThClass}>{isAr ? 'المورد' : 'Vendor'}</th>
                  <th className={salesThClass}>{isAr ? 'تاريخ الفاتورة' : 'Bill date'}</th>
                  <th className={salesThClass}>{isAr ? 'الاستحقاق' : 'Due date'}</th>
                  <th className={salesThClass}>{isAr ? 'مرجع المورد' : 'Reference'}</th>
                  <th className={salesThClass}>{isAr ? 'بدون ضريبة' : 'Tax excl.'}</th>
                  <th className={salesThClass}>{isAr ? 'الإجمالي' : 'Total'}</th>
                  <th className={salesThClass}>{isAr ? 'حالة الدفع' : 'Payment'}</th>
                  <th className={salesThClass}>{isAr ? 'الحالة' : 'Status'}</th>
                  <th className={salesThClass} />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row._id} className={salesTrClass}>
                    <td className={salesTdClass}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(String(row._id))}
                        onChange={() => toggleSelect(row._id)}
                        aria-label={row.invoiceNumber}
                      />
                    </td>
                    <td className={salesTdClass}>
                      <Link to={`/app/dashboard/accounting/invoices/${row._id}`} className={docLinkClass}>
                        {row.invoiceNumber}
                      </Link>
                    </td>
                    <td className={salesTdClass}>{trimName(row.seller)}</td>
                    <td className={salesTdClass}>
                      {row.issueDate ? new Date(row.issueDate).toLocaleDateString(isAr ? 'ar-SA' : 'en-GB') : '—'}
                    </td>
                    <td className={salesTdClass}>
                      {row.dueDate ? new Date(row.dueDate).toLocaleDateString(isAr ? 'ar-SA' : 'en-GB') : '—'}
                    </td>
                    <td className={salesTdClass}>{row.contractNumber || row.purchaseOrderNumber || '—'}</td>
                    <td className={`${salesTdClass} tabular-nums`}>
                      <Money value={Number(row.taxableAmount ?? row.subtotal ?? 0)} />
                    </td>
                    <td className={`${salesTdClass} tabular-nums`}><Money value={row.grandTotal} /></td>
                    <td className={salesTdClass}>
                      <span className={softChipClass}>{paymentStatusLabel(row.paymentStatus, language)}</span>
                    </td>
                    <td className={salesTdClass}>
                      <span className={softChipClass}>{documentStatusLabel(row.status, language)}</span>
                    </td>
                    <td className={salesTdClass}>
                      <div className={rowActionsWrapClass}>
                        <Link to={`/app/dashboard/accounting/invoices/${row._id}`} className={rowActionBtnClass}>
                          <Eye className="h-4 w-4" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ResponsiveDataList>
        )}
      </div>

      <RegisterPaymentModal
        isOpen={batchPayOpen}
        onClose={() => { setBatchPayOpen(false); setBatchPayBill(null) }}
        invoice={batchPayBill}
        language={language}
        title={isAr ? 'تسجيل دفعة للمورد' : 'Register vendor payment'}
        isPending={batchPayMutation.isPending}
        onSubmit={(payload) => {
          if (!batchPayBill?._id) return
          batchPayMutation.mutate({
            invoiceId: batchPayBill._id,
            payload: {
              amount: payload.amount,
              method: payload.method,
              memo: payload.memo,
            },
          })
        }}
      />

      <BatchVendorPaymentModal
        isOpen={multiPayOpen}
        onClose={() => setMultiPayOpen(false)}
        bills={selectedRows}
        language={language}
        isPending={multiPayMutation.isPending}
        onSubmit={(payload) => multiPayMutation.mutate(payload)}
      />

      {sepaUploadOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-dark-600 dark:bg-dark-800">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
              {isAr ? 'رفع SEPA إلى بوابة البنك' : 'Upload SEPA to bank portal'}
            </h3>
            <ol className="mt-3 list-decimal space-y-1.5 ps-5 text-sm text-slate-600 dark:text-slate-300">
              <li>{isAr ? 'افتح بوابة الخدمات البنكية لشركتك.' : 'Open your company bank portal.'}</li>
              <li>{isAr ? 'اختر مدفوعات / SEPA Credit Transfer / pain.001.' : 'Choose Payments / SEPA Credit Transfer / pain.001.'}</li>
              <li>{isAr ? 'ارفع ملف XML الذي تم تنزيله للتو.' : 'Upload the XML file just downloaded.'}</li>
              <li>{isAr ? 'بعد قبول البنك، أكّد أدناه.' : 'After the bank accepts it, confirm below.'}</li>
            </ol>
            <p className="mt-3 text-xs text-slate-400">
              {isAr ? `فواتير في الملف: ${sepaUploadIds.length}` : `Bills in file: ${sepaUploadIds.length}`}
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold dark:border-dark-600"
                onClick={() => { setSepaUploadOpen(false); setSepaUploadIds([]) }}
              >
                {isAr ? 'لاحقاً' : 'Later'}
              </button>
              <button
                type="button"
                className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white"
                onClick={handleMarkSepaUploaded}
              >
                {isAr ? 'تم الرفع إلى البنك' : 'Mark uploaded to bank'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
