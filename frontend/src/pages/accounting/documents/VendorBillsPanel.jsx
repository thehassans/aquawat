import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Plus, Search, Eye, Download, CreditCard, FileText } from 'lucide-react'
import toast from 'react-hot-toast'
import { useSelector } from 'react-redux'
import api from '../../../lib/api'
import Money from '../../../components/ui/Money'
import ExportMenu from '../../../components/ui/ExportMenu'
import ResponsiveDataList from '../../../components/ui/ResponsiveDataList'
import AccountingDocumentBatchBar from './AccountingDocumentBatchBar'
import RegisterPaymentModal from '../../../components/accounting/RegisterPaymentModal'
import BatchVendorPaymentModal from '../../../components/accounting/BatchVendorPaymentModal'
import { downloadSepaBatch, markSepaUploaded, createAndExportPaymentBatchCsv } from '../../../lib/vendorApTools'
import {
  canRegisterPaymentOnBill,
  documentStatusLabel,
  invoiceRemainingBalance,
  paymentStatusLabel,
} from '../../../lib/accountingDocumentStatus'
import { resolveInvoiceListNumber } from '../../../lib/commercialDocumentLabels'
import {
  docLinkClass,
  emptyStateClass,
  fieldControlClass,
  filterBarClass,
  filterControlClass,
  listShellClass,
  rowActionBtnClass,
  rowActionsWrapClass,
  salesTdClass,
  salesThClass,
  salesTrClass,
  salesTableClass,
  softChipClass,
} from '../../sales/salesUi'
import { formatDateOnlyDisplay } from '../../../lib/dateOnly'
import EmptyState from '../../../components/ui/EmptyState'

const trimName = (party) => {
  const en = String(party?.name || party?.nameEn || '').trim()
  const ar = String(party?.nameAr || '').trim()
  if (en && ar && en !== ar) return `${en} / ${ar}`
  return en || ar || '—'
}

function matchingStatusLabel(status, language) {
  const isAr = language === 'ar'
  switch (status) {
    case 'fully_matched':
      return isAr ? 'مطابق بالكامل' : 'Fully matched'
    case 'partially_matched':
      return isAr ? 'مطابق جزئياً' : 'Partially matched'
    case 'variance':
      return isAr ? 'تفاوت' : 'Variance'
    case 'unmatched':
      return isAr ? 'غير مطابق' : 'Unmatched'
    default:
      return null
  }
}

function matchingStatusChipClass(status) {
  switch (status) {
    case 'fully_matched':
      return 'border-teal-200 bg-teal-50 text-teal-800 dark:border-teal-500/30 dark:bg-teal-500/10 dark:text-teal-200'
    case 'partially_matched':
      return 'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200'
    case 'variance':
      return 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200'
    case 'unmatched':
      return 'border-slate-200 bg-slate-50 text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300'
    default:
      return softChipClass
  }
}

export default function VendorBillsPanel({ language: languageProp, embedded = false }) {
  const { language: uiLanguage } = useSelector((s) => s.ui)
  const language = languageProp || uiLanguage
  const isAr = language === 'ar'
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [paymentFilter, setPaymentFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const productIdFilter = String(searchParams.get('productId') || '').trim()
  const supplierIdFilter = String(searchParams.get('supplierId') || '').trim()
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const [batchPayBill, setBatchPayBill] = useState(null)
  const [batchPayOpen, setBatchPayOpen] = useState(false)
  const [multiPayOpen, setMultiPayOpen] = useState(false)
  const [sepaUploadIds, setSepaUploadIds] = useState([])
  const [sepaUploadOpen, setSepaUploadOpen] = useState(false)

  const { data: suppliersData } = useQuery({
    queryKey: ['vendors-for-bills-filter'],
    queryFn: () => api.get('/suppliers', { params: { limit: 200 } }).then((r) => r.data),
    staleTime: 60_000,
  })
  const suppliers = suppliersData?.suppliers || suppliersData?.items || suppliersData || []

  const { data, isLoading } = useQuery({
    queryKey: ['vendor-bills', search, statusFilter, paymentFilter, productIdFilter, supplierIdFilter, dateFrom, dateTo, page],
    queryFn: () => api.get('/invoices', {
      params: {
        page,
        limit: 25,
        flow: 'purchase',
        invoiceType: '388',
        search: search || undefined,
        status: statusFilter || undefined,
        paymentStatus: paymentFilter || undefined,
        productId: productIdFilter || undefined,
        supplierId: supplierIdFilter || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      },
    }).then((r) => r.data),
  })

  const rows = data?.invoices || []
  const pagination = data?.pagination || {}
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
      queryClient.invalidateQueries({ queryKey: ['vendor-payments'] })
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
      queryClient.invalidateQueries({ queryKey: ['vendor-payments'] })
    },
    onError: (err) => toast.error(err.response?.data?.error || (isAr ? 'فشل الدفع الجماعي' : 'Batch payment failed')),
  })

  const exportColumns = useMemo(() => [
    { key: 'invoiceNumber', label: isAr ? 'رقم الفاتورة' : 'Bill No' },
    { key: 'vendorInvoice', label: isAr ? 'رقم فاتورة المورد' : 'Vendor Invoice No', value: (r) => r.vendorInvoiceNumber || r.contractNumber || '' },
    { key: 'vendor', label: isAr ? 'المورد' : 'Vendor', value: (r) => trimName(r.seller) },
    { key: 'issueDate', label: isAr ? 'تاريخ الفاتورة' : 'Bill date' },
    { key: 'dueDate', label: isAr ? 'الاستحقاق' : 'Due date' },
    { key: 'taxExcluded', label: isAr ? 'بدون ضريبة' : 'Untaxed', value: (r) => Number(r.taxableAmount ?? r.subtotal ?? 0) },
    { key: 'vat', label: isAr ? 'الضريبة' : 'VAT', value: (r) => Number(r.totalTax ?? 0) },
    { key: 'grandTotal', label: isAr ? 'الإجمالي' : 'Total' },
    { key: 'due', label: isAr ? 'المستحق' : 'Due', value: (r) => invoiceRemainingBalance(r) },
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

  const handlePaymentBatchCsv = async () => {
    const payable = selectedRows.filter((row) => canRegisterPaymentOnBill(row))
    const ids = (payable.length ? payable : selectedRows).map((row) => row._id)
    if (!ids.length) {
      toast.error(isAr ? 'حدد فواتير للدفع الجماعي' : 'Select bills for payment batch')
      return
    }
    try {
      const result = await createAndExportPaymentBatchCsv(ids)
      toast.success(
        isAr
          ? `دفعة ${result.batch?.number || ''} — تم تصدير CSV`
          : `Batch ${result.batch?.number || ''} — CSV exported`,
      )
      setSelectedIds(new Set())
      queryClient.invalidateQueries({ queryKey: ['vendor-bills'] })
      queryClient.invalidateQueries({ queryKey: ['payment-batches'] })
    } catch (err) {
      toast.error(err.response?.data?.error || (isAr ? 'فشل تصدير دفعة الدفع' : 'Payment batch export failed'))
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

  const totalPages = pagination.pages || Math.max(1, Math.ceil((pagination.total || rows.length) / (pagination.limit || 25)))

  return (
    <div className="space-y-4">
      {!embedded ? (
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
            {isAr ? 'المحاسبة · الموردون' : 'Accounting · Vendors'}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
            {isAr ? 'فواتير المشتريات' : 'Bills'}
          </h1>
        </div>
      ) : null}
      <div className="flex flex-wrap items-center justify-end gap-2">
          <ExportMenu
            columns={exportColumns}
            filename="vendor-bills"
            getRows={() => Promise.resolve(selectedRows.length ? selectedRows : rows)}
            label={isAr ? 'تصدير' : 'Export'}
          />
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={handlePaymentBatchCsv}
            disabled={!selectedIds.size}
          >
            <Download className="h-4 w-4" />
            {isAr ? 'دفعة CSV' : 'Payment batch CSV'}
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm opacity-70"
            onClick={handleSepaExport}
            disabled={!selectedIds.size}
            title={isAr
              ? 'تصدير SEPA اختياري (أوروبا) — السعودية تحتاج SARIE / صيغة البنك'
              : 'Optional legacy SEPA (Europe) — KSA needs SARIE / bank-specific formats'}
          >
            <Download className="h-4 w-4" />
            {isAr ? 'تصدير (SEPA · اختياري)' : 'Export (SEPA · optional)'}
          </button>
          {!embedded ? (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => navigate('/app/dashboard/accounting/bills/new')}
          >
            <Plus className="h-4 w-4" />
            {isAr ? 'فاتورة مورد جديدة' : 'New bill'}
          </button>
          ) : null}
      </div>

      <div className={filterBarClass}>
        <div className="relative min-w-[180px] flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder={isAr ? 'بحث…' : 'Search…'}
            className={`${fieldControlClass} !py-2 ps-10`}
          />
        </div>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => { setDateFrom(e.target.value); setPage(1) }}
          className={filterControlClass}
          title={isAr ? 'من تاريخ' : 'From date'}
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => { setDateTo(e.target.value); setPage(1) }}
          className={filterControlClass}
          title={isAr ? 'إلى تاريخ' : 'To date'}
        />
        <select
          value={supplierIdFilter}
          onChange={(e) => {
            const next = new URLSearchParams(searchParams)
            if (e.target.value) next.set('supplierId', e.target.value)
            else next.delete('supplierId')
            setSearchParams(next)
            setPage(1)
          }}
          className={filterControlClass}
        >
          <option value="">{isAr ? 'كل الموردين' : 'All vendors'}</option>
          {(Array.isArray(suppliers) ? suppliers : []).map((s) => (
            <option key={s._id} value={s._id}>
              {s.nameEn || s.name || s.nameAr || s._id}
            </option>
          ))}
        </select>
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }} className={filterControlClass}>
          <option value="">{isAr ? 'كل الحالات' : 'All statuses'}</option>
          <option value="draft">{isAr ? 'مسودة' : 'Draft'}</option>
          <option value="approved">{isAr ? 'مرحّلة' : 'Posted'}</option>
          <option value="cancelled">{isAr ? 'ملغاة' : 'Cancelled'}</option>
        </select>
        <select value={paymentFilter} onChange={(e) => { setPaymentFilter(e.target.value); setPage(1) }} className={filterControlClass}>
          <option value="">{isAr ? 'كل المدفوعات' : 'All payments'}</option>
          <option value="pending">{isAr ? 'غير مدفوعة' : 'Unpaid'}</option>
          <option value="partial">{isAr ? 'جزئي' : 'Partial'}</option>
          <option value="paid">{isAr ? 'مدفوعة' : 'Paid'}</option>
        </select>
        {(productIdFilter || supplierIdFilter || dateFrom || dateTo) ? (
          <button
            type="button"
            className={`${softChipClass} !px-3`}
            onClick={() => {
              const next = new URLSearchParams(searchParams)
              next.delete('productId')
              next.delete('supplierId')
              setSearchParams(next)
              setDateFrom('')
              setDateTo('')
              setPage(1)
            }}
          >
            {isAr ? 'مسح الفلاتر' : 'Clear filters'}
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
            empty={(
              <EmptyState
                icon={FileText}
                language={language}
                title="No vendor bills yet"
                titleAr="لا توجد فواتير مورد بعد"
                description="Create a bill from a received PO (Create Bill) or start a new purchase invoice. Bills post Dr Stock Interim / expense + VAT Input, Cr Accounts Payable."
                descriptionAr="أنشئ فاتورة من أمر شراء مستلم أو فاتورة مشتريات جديدة. الترحيل: مدين مخزون وسيط/مصروف + ضريبة مدخلات، دائن ذمم دائنة."
                action={() => navigate('/app/dashboard/accounting/bills/new')}
                actionLabel="New bill"
                actionLabelAr="فاتورة مورد جديدة"
              />
            )}
            renderCard={(row) => {
              const numberMeta = resolveInvoiceListNumber(row, language)
              return (
              <div key={row._id} className="space-y-2 rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-white/10 dark:bg-dark-800">
                <Link to={`/app/dashboard/accounting/invoices/${row._id}`} className={`${docLinkClass} text-base`}>
                  {numberMeta.isDraft ? (
                    <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                      {numberMeta.label}
                    </span>
                  ) : numberMeta.label}
                </Link>
                <p className="text-sm text-slate-500">{trimName(row.seller)}</p>
                <p className="text-xs text-slate-400">{row.vendorInvoiceNumber || row.contractNumber || '—'}</p>
                <div className="flex items-center justify-between text-sm">
                  <Money value={row.grandTotal} />
                  <span className={softChipClass}>{paymentStatusLabel(row.paymentStatus, language)}</span>
                </div>
                {matchingStatusLabel(row.matchingStatus, language) ? (
                  <span className={`${softChipClass} ${matchingStatusChipClass(row.matchingStatus)}`}>
                    {matchingStatusLabel(row.matchingStatus, language)}
                  </span>
                ) : null}
                {canRegisterPaymentOnBill(row) ? (
                  <button
                    type="button"
                    className={`${rowActionBtnClass} w-full justify-center`}
                    onClick={() => { setBatchPayBill(row); setBatchPayOpen(true) }}
                  >
                    <CreditCard className="h-4 w-4" />
                    {isAr ? 'تسجيل دفعة' : 'Register payment'}
                  </button>
                ) : null}
              </div>
              )
            }}
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
                  <th className={salesThClass}>{isAr ? 'رقم الفاتورة' : 'Bill No'}</th>
                  <th className={salesThClass}>{isAr ? 'رقم فاتورة المورد' : 'Vendor Invoice No'}</th>
                  <th className={salesThClass}>{isAr ? 'المورد' : 'Vendor'}</th>
                  <th className={salesThClass}>{isAr ? 'تاريخ الفاتورة' : 'Bill Date'}</th>
                  <th className={salesThClass}>{isAr ? 'الاستحقاق' : 'Due Date'}</th>
                  <th className={salesThClass}>{isAr ? 'بدون ضريبة' : 'Untaxed'}</th>
                  <th className={salesThClass}>{isAr ? 'الضريبة' : 'VAT'}</th>
                  <th className={salesThClass}>{isAr ? 'الإجمالي' : 'Total'}</th>
                  <th className={salesThClass}>{isAr ? 'المستحق' : 'Due'}</th>
                  <th className={salesThClass}>{isAr ? 'المطابقة' : 'Match'}</th>
                  <th className={salesThClass}>{isAr ? 'الحالة' : 'Status'}</th>
                  <th className={salesThClass} />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const due = invoiceRemainingBalance(row)
                  const numberMeta = resolveInvoiceListNumber(row, language)
                  return (
                  <tr key={row._id} className={salesTrClass}>
                    <td className={salesTdClass}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(String(row._id))}
                        onChange={() => toggleSelect(row._id)}
                        aria-label={numberMeta.label}
                      />
                    </td>
                    <td className={salesTdClass}>
                      <Link to={`/app/dashboard/accounting/invoices/${row._id}`} className={docLinkClass}>
                        {numberMeta.isDraft ? (
                          <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                            {numberMeta.label}
                          </span>
                        ) : numberMeta.label}
                      </Link>
                    </td>
                    <td className={salesTdClass}>{row.vendorInvoiceNumber || row.contractNumber || '—'}</td>
                    <td className={salesTdClass}>{trimName(row.seller)}</td>
                    <td className={salesTdClass}>
                      {formatDateOnlyDisplay(row.issueDate, isAr ? 'ar-SA' : 'en-GB') || '—'}
                    </td>
                    <td className={salesTdClass}>
                      {formatDateOnlyDisplay(row.dueDate, isAr ? 'ar-SA' : 'en-GB') || '—'}
                    </td>
                    <td className={`${salesTdClass} tabular-nums`}>
                      <Money value={Number(row.taxableAmount ?? row.subtotal ?? 0)} />
                    </td>
                    <td className={`${salesTdClass} tabular-nums`}>
                      <Money value={Number(row.totalTax ?? 0)} />
                    </td>
                    <td className={`${salesTdClass} tabular-nums`}><Money value={row.grandTotal} /></td>
                    <td className={`${salesTdClass} tabular-nums`}><Money value={due} /></td>
                    <td className={salesTdClass}>
                      {matchingStatusLabel(row.matchingStatus, language) ? (
                        <span className={`${softChipClass} ${matchingStatusChipClass(row.matchingStatus)}`}>
                          {matchingStatusLabel(row.matchingStatus, language)}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className={salesTdClass}>
                      <span className={softChipClass}>{documentStatusLabel(row.status, language)}</span>
                      <span className={`${softChipClass} ms-1`}>{paymentStatusLabel(row.paymentStatus, language)}</span>
                    </td>
                    <td className={salesTdClass}>
                      <div className={rowActionsWrapClass}>
                        <Link to={`/app/dashboard/accounting/invoices/${row._id}`} className={rowActionBtnClass}>
                          <Eye className="h-4 w-4" />
                        </Link>
                        {canRegisterPaymentOnBill(row) ? (
                          <button
                            type="button"
                            className={rowActionBtnClass}
                            title={isAr ? 'تسجيل دفعة' : 'Register payment'}
                            onClick={() => { setBatchPayBill(row); setBatchPayOpen(true) }}
                          >
                            <CreditCard className="h-4 w-4" />
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
          </ResponsiveDataList>
        )}
      </div>

      {totalPages > 1 ? (
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            {isAr ? 'السابق' : 'Prev'}
          </button>
          <span className="text-sm text-slate-500">{page} / {totalPages}</span>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            {isAr ? 'التالي' : 'Next'}
          </button>
        </div>
      ) : null}

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
              confirmNegativeCash: payload.confirmNegativeCash === true,
            },
          })
        }}
      />

      <BatchVendorPaymentModal
        isOpen={multiPayOpen}
        onClose={() => setMultiPayOpen(false)}
        bills={selectedRows.filter((row) => canRegisterPaymentOnBill(row))}
        language={language}
        isPending={multiPayMutation.isPending}
        onSubmit={(payload) => multiPayMutation.mutate(payload)}
      />

      {sepaUploadOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-dark-800">
            <p className="text-sm text-slate-700 dark:text-slate-200">
              {isAr ? 'هل رفعت ملف SEPA إلى البنك؟' : 'Did you upload the SEPA file to the bank?'}
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setSepaUploadOpen(false)}>
                {isAr ? 'لاحقاً' : 'Later'}
              </button>
              <button type="button" className="btn btn-primary btn-sm" onClick={handleMarkSepaUploaded}>
                {isAr ? 'نعم، تم الرفع' : 'Yes uploaded'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
