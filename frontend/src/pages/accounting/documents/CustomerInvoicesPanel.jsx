import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowDown, ArrowUp, Plus, RefreshCw, Search, Eye, FileText } from 'lucide-react'
import toast from 'react-hot-toast'
import { useSelector } from 'react-redux'
import api from '../../../lib/api'
import Money from '../../../components/ui/Money'
import ExportMenu from '../../../components/ui/ExportMenu'
import ResponsiveDataList from '../../../components/ui/ResponsiveDataList'
import EmptyState from '../../../components/ui/EmptyState'
import AccountingDocumentBatchBar from './AccountingDocumentBatchBar'
import RegisterPaymentModal from '../../../components/accounting/RegisterPaymentModal'
import BatchCustomerPaymentModal from '../../../components/accounting/BatchCustomerPaymentModal'
import { downloadInvoicePdf } from '../../../lib/invoicePdfActions'
import { getZatcaStatusMeta } from '../../../lib/zatcaStatus'
import { isSaudiTenant } from '../../../lib/saudiTenant'
import {
  canRegisterPaymentOnDocument,
  documentStatusLabel,
  invoiceRemainingBalance,
  isDraftDocument,
  paymentStatusLabel,
} from '../../../lib/accountingDocumentStatus'
import { resolveInvoiceListNumber } from '../../../lib/commercialDocumentLabels'
import { extractDateOnly, formatDateOnlyDisplay } from '../../../lib/dateOnly'
import {
  docLinkClass,
  emptyStateClass,
  fieldControlClass,
  filterBarClass,
  filterControlClass,
  listShellClass,
  paginationBarClass,
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

const computeNextActivity = (row, isAr) => {
  if (isDraftDocument(row)) {
    return { label: isAr ? 'بانتظار الترحيل' : 'Awaiting post', tone: 'muted' }
  }
  if (String(row.paymentStatus || '').toLowerCase() === 'paid') {
    return { label: isAr ? 'لا نشاط' : 'No follow-up', tone: 'muted' }
  }
  const dueOnly = extractDateOnly(row.dueDate)
  if (!dueOnly) {
    return { label: '—', tone: 'muted' }
  }
  const todayOnly = extractDateOnly(new Date())
  const diffDays = (() => {
    const [y1, m1, d1] = dueOnly.split('-').map(Number)
    const [y2, m2, d2] = todayOnly.split('-').map(Number)
    return Math.round((Date.UTC(y1, m1 - 1, d1) - Date.UTC(y2, m2 - 1, d2)) / 86400000)
  })()
  if (diffDays < 0) {
    const overdue = Math.abs(diffDays)
    return {
      label: isAr ? `متابعة — متأخر ${overdue} يوم` : `Follow-up — ${overdue}d overdue`,
      tone: 'danger',
      overdueDays: overdue,
    }
  }
  if (diffDays === 0) return { label: isAr ? 'متابعة — مستحق اليوم' : 'Follow-up — due today', tone: 'warn' }
  if (diffDays <= 7) return { label: isAr ? `تذكير خلال ${diffDays} يوم` : `Remind in ${diffDays}d`, tone: 'warn' }
  return { label: isAr ? `جدولة خلال ${diffDays} يوم` : `Schedule in ${diffDays}d`, tone: 'muted' }
}

const nextActivityClass = (tone) => {
  if (tone === 'danger') return 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
  if (tone === 'warn') return 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200'
  return 'bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-slate-400'
}

const zatcaToneClass = (tone) => {
  if (tone === 'success') return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
  if (tone === 'danger') return 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
  if (tone === 'warning') return 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200'
  if (tone === 'info') return 'bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300'
  return 'bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-slate-400'
}

const isOverdueRow = (row) => {
  if (isDraftDocument(row)) return false
  if (String(row.paymentStatus || '').toLowerCase() === 'paid') return false
  const dueOnly = extractDateOnly(row.dueDate)
  const todayOnly = extractDateOnly(new Date())
  if (!dueOnly || !todayOnly) return false
  return dueOnly < todayOnly
}

export default function CustomerInvoicesPanel({ language: languageProp, embedded = false }) {
  const { language: uiLanguage } = useSelector((s) => s.ui)
  const { tenant } = useSelector((s) => s.auth)
  const language = languageProp || uiLanguage
  const isAr = language === 'ar'
  const isSar = isSaudiTenant(tenant)
  const zatcaPhase = tenant?.zatca?.phase || 2
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [paymentFilter, setPaymentFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [zatcaFilter, setZatcaFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const [limit] = useState(25)
  const [sortBy, setSortBy] = useState('issueDate')
  const [sortDir, setSortDir] = useState('desc')
  const customerIdFilter = String(searchParams.get('customerId') || '').trim()
  const productIdFilter = String(searchParams.get('productId') || '').trim()
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const [batchPayInvoice, setBatchPayInvoice] = useState(null)
  const [batchPayOpen, setBatchPayOpen] = useState(false)
  const [multiPayOpen, setMultiPayOpen] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: [
      'customer-invoices',
      page,
      limit,
      search,
      statusFilter,
      paymentFilter,
      typeFilter,
      zatcaFilter,
      dateFrom,
      dateTo,
      sortBy,
      sortDir,
      customerIdFilter,
      productIdFilter,
    ],
    queryFn: () => api.get('/accounting/invoices', {
      params: {
        page,
        limit,
        search: search || undefined,
        status: statusFilter || undefined,
        paymentStatus: paymentFilter || undefined,
        transactionType: typeFilter || undefined,
        zatcaFilter: zatcaFilter || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        sortBy,
        sortDir,
        customerId: customerIdFilter || undefined,
        productId: productIdFilter || undefined,
      },
    }).then((r) => r.data),
  })

  const rows = data?.invoices || []
  const pagination = data?.pagination || { page: 1, pages: 1, total: 0, limit }
  const selectedRows = useMemo(
    () => rows.filter((row) => selectedIds.has(String(row._id))),
    [rows, selectedIds],
  )

  const toggleSort = (field) => {
    setPage(1)
    if (sortBy === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortBy(field)
    setSortDir(field === 'invoiceNumber' ? 'asc' : 'desc')
  }

  const SortHeader = ({ field, children }) => {
    const active = sortBy === field
    return (
      <button
        type="button"
        className="inline-flex items-center gap-1 font-semibold"
        onClick={() => toggleSort(field)}
      >
        {children}
        {active ? (sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : null}
      </button>
    )
  }

  const batchPayMutation = useMutation({
    mutationFn: ({ invoiceId, payload }) => api.post(`/invoices/${invoiceId}/payments`, payload),
    onSuccess: () => {
      toast.success(isAr ? 'تم تسجيل الدفعة' : 'Payment recorded')
      setBatchPayOpen(false)
      setBatchPayInvoice(null)
      setSelectedIds(new Set())
      queryClient.invalidateQueries({ queryKey: ['customer-invoices'] })
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
    },
    onError: (err) => toast.error(err.response?.data?.error || (isAr ? 'فشل تسجيل الدفعة' : 'Failed to record payment')),
  })

  const multiPayMutation = useMutation({
    mutationFn: async ({ method, memo, paymentDate, invoices: targets }) => {
      const results = []
      for (const row of targets) {
        const res = await api.post(`/invoices/${row.invoiceId}/payments`, {
          amount: row.amount,
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
      queryClient.invalidateQueries({ queryKey: ['customer-invoices'] })
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
    },
    onError: (err) => toast.error(err.response?.data?.error || (isAr ? 'فشل الدفع الجماعي' : 'Batch payment failed')),
  })

  const retryZatcaMutation = useMutation({
    mutationFn: (invoiceId) => api.post(`/invoices/${invoiceId}/sign`, undefined, { timeout: 120000 }),
    onSuccess: () => {
      toast.success(isAr ? 'تمت إعادة الإرسال' : 'Resubmitted to ZATCA')
      queryClient.invalidateQueries({ queryKey: ['customer-invoices'] })
    },
    onError: (err) => toast.error(err.response?.data?.error || (isAr ? 'فشل الإرسال' : 'Resubmit failed')),
  })

  const exportColumns = useMemo(() => [
    { key: 'invoiceNumber', label: isAr ? 'الرقم' : 'Number' },
    { key: 'customer', label: isAr ? 'العميل' : 'Customer', value: (r) => trimName(r.buyer) },
    { key: 'issueDate', label: isAr ? 'تاريخ الفاتورة' : 'Invoice date' },
    { key: 'dueDate', label: isAr ? 'الاستحقاق' : 'Due date' },
    { key: 'taxExcluded', label: isAr ? 'بدون ضريبة' : 'Tax excluded', value: (r) => Number(r.taxableAmount ?? r.subtotal ?? 0) },
    { key: 'grandTotal', label: isAr ? 'الإجمالي' : 'Total' },
    { key: 'paymentStatus', label: isAr ? 'حالة الدفع' : 'Payment status' },
    { key: 'zatcaStatus', label: isAr ? 'زاتكا' : 'ZATCA', value: (r) => getZatcaStatusMeta(r, language, zatcaPhase).label },
    { key: 'nextActivity', label: isAr ? 'النشاط التالي' : 'Next activity', value: (r) => computeNextActivity(r, isAr).label },
    { key: 'status', label: isAr ? 'الحالة' : 'Status' },
  ], [isAr, language, zatcaPhase])

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
    const payable = selectedRows.filter((row) => canRegisterPaymentOnDocument(row))
    if (!payable.length) {
      toast.error(isAr ? 'لا توجد فواتير قابلة للدفع' : 'No payable invoices in selection')
      return
    }
    if (payable.length === 1) {
      setBatchPayInvoice(payable[0])
      setBatchPayOpen(true)
      return
    }
    setMultiPayOpen(true)
  }

  const handleSendPrint = async () => {
    const targets = selectedRows.length ? selectedRows : rows.slice(0, 1)
    if (!targets.length) {
      toast.error(isAr ? 'حدد فواتير' : 'Select invoices')
      return
    }
    try {
      for (const inv of targets) {
        const { data: full } = await api.get(`/invoices/${inv._id}`)
        await downloadInvoicePdf({ invoice: full, language, tenant })
      }
      toast.success(isAr ? 'تم تنزيل PDF' : 'PDF downloaded')
    } catch (err) {
      toast.error(err.response?.data?.error || (isAr ? 'فشل التنزيل' : 'Download failed'))
    }
  }

  const resetPagingFilters = (fn) => {
    setPage(1)
    setSelectedIds(new Set())
    fn()
  }

  return (
    <div className="space-y-4">
      {!embedded ? (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
            {isAr ? 'العملاء' : 'Customers'}
          </p>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            {isAr ? 'فواتير العملاء' : 'Customer invoices'}
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ExportMenu
            columns={exportColumns}
            filename="customer-invoices"
            getRows={() => Promise.resolve(selectedRows.length ? selectedRows : rows)}
            label={isAr ? 'تصدير' : 'Export'}
          />
        </div>
      </div>
      ) : (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <ExportMenu
            columns={exportColumns}
            filename="customer-invoices"
            getRows={() => Promise.resolve(selectedRows.length ? selectedRows : rows)}
            label={isAr ? 'تصدير' : 'Export'}
          />
        </div>
      )}

      <div className={filterBarClass}>
        <div className="relative min-w-[180px] flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => resetPagingFilters(() => setSearch(e.target.value))}
            placeholder={isAr ? 'بحث…' : 'Search…'}
            className={`${fieldControlClass} !py-2 ps-10`}
          />
        </div>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => resetPagingFilters(() => setDateFrom(e.target.value))}
          className={filterControlClass}
          title={isAr ? 'من تاريخ' : 'From date'}
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => resetPagingFilters(() => setDateTo(e.target.value))}
          className={filterControlClass}
          title={isAr ? 'إلى تاريخ' : 'To date'}
        />
        <select
          value={typeFilter}
          onChange={(e) => resetPagingFilters(() => setTypeFilter(e.target.value))}
          className={filterControlClass}
        >
          <option value="">{isAr ? 'كل الأنواع' : 'All types'}</option>
          <option value="B2B">{isAr ? 'قياسية (B2B)' : 'Tax / B2B'}</option>
          <option value="B2C">{isAr ? 'مبسطة (B2C)' : 'Simplified / B2C'}</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => resetPagingFilters(() => setStatusFilter(e.target.value))}
          className={filterControlClass}
        >
          <option value="">{isAr ? 'كل الحالات' : 'All statuses'}</option>
          <option value="draft">{isAr ? 'مسودة' : 'Draft'}</option>
          <option value="issued">{isAr ? 'مرحّلة' : 'Posted'}</option>
          <option value="cancelled">{isAr ? 'ملغاة' : 'Cancelled'}</option>
        </select>
        <select
          value={paymentFilter}
          onChange={(e) => resetPagingFilters(() => setPaymentFilter(e.target.value))}
          className={filterControlClass}
        >
          <option value="">{isAr ? 'كل المدفوعات' : 'All payments'}</option>
          <option value="pending">{isAr ? 'غير مدفوعة' : 'Unpaid'}</option>
          <option value="partial">{isAr ? 'جزئي' : 'Partial'}</option>
          <option value="paid">{isAr ? 'مدفوعة' : 'Paid'}</option>
        </select>
        {isSar ? (
          <select
            value={zatcaFilter}
            onChange={(e) => resetPagingFilters(() => setZatcaFilter(e.target.value))}
            className={filterControlClass}
          >
            <option value="">{isAr ? 'كل زاتكا' : 'All ZATCA'}</option>
            <option value="not_submitted">{isAr ? 'غير مرسلة' : 'Not submitted'}</option>
            <option value="reported">{isAr ? 'تم الإبلاغ' : 'Reported'}</option>
            <option value="cleared">{isAr ? 'تمت التصفية' : 'Cleared'}</option>
            <option value="failed">{isAr ? 'فشل / مرفوضة' : 'Failed'}</option>
          </select>
        ) : null}
        {(customerIdFilter || productIdFilter || dateFrom || dateTo || zatcaFilter) ? (
          <button
            type="button"
            className={`${softChipClass} !px-3`}
            onClick={() => {
              const next = new URLSearchParams(searchParams)
              next.delete('customerId')
              next.delete('productId')
              setSearchParams(next)
              setDateFrom('')
              setDateTo('')
              setZatcaFilter('')
              setPage(1)
            }}
          >
            {isAr ? 'مسح الفلتر' : 'Clear filter'}
          </button>
        ) : null}
        {!embedded ? (
        <button
          type="button"
          className="btn btn-primary btn-sm ms-auto"
          onClick={() => navigate('/app/dashboard/accounting/invoices/new/sell')}
        >
          <Plus className="h-4 w-4" />
          {isAr ? 'فاتورة جديدة' : 'New invoice'}
        </button>
        ) : null}
      </div>

      <AccountingDocumentBatchBar
        count={selectedIds.size}
        language={language}
        onRegisterPayment={handleBatchRegisterPayment}
        onSendPrint={handleSendPrint}
        registerDisabled={!selectedRows.some((row) => canRegisterPaymentOnDocument(row))}
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
                title="No customer invoices yet"
                titleAr="لا توجد فواتير عملاء بعد"
                description="Create a sales invoice to start tracking receivables and ZATCA compliance."
                descriptionAr="أنشئ فاتورة مبيعات لبدء تتبع الذمم والامتثال لـ ZATCA."
                action={() => navigate('/app/dashboard/accounting/invoices/new/sell')}
                actionLabel="New invoice"
                actionLabelAr="فاتورة جديدة"
              />
            )}
            renderCard={(row) => {
              const overdue = isOverdueRow(row)
              const activity = computeNextActivity(row, isAr)
              const zatca = getZatcaStatusMeta(row, language, zatcaPhase)
              const numberMeta = resolveInvoiceListNumber(row, language)
              return (
                <div
                  key={row._id}
                  className={`space-y-2 rounded-2xl border p-4 ${
                    overdue
                      ? 'border-rose-200 bg-rose-50/70 dark:border-rose-900/50 dark:bg-rose-950/20'
                      : 'border-slate-200/80 bg-white dark:border-white/10 dark:bg-dark-800'
                  }`}
                >
                  <Link to={`/app/dashboard/accounting/invoices/${row._id}`} className={`${docLinkClass} text-base`}>
                    {numberMeta.isDraft ? (
                      <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                        {numberMeta.label}
                      </span>
                    ) : numberMeta.label}
                  </Link>
                  <p className="text-sm text-slate-500">{trimName(row.buyer)}</p>
                  {overdue && activity.overdueDays ? (
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${nextActivityClass('danger')}`}>
                      {isAr ? `متأخر ${activity.overdueDays} يوم` : `${activity.overdueDays}d overdue`}
                    </span>
                  ) : null}
                  {isSar ? (
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${zatcaToneClass(zatca.tone)}`}>
                      {zatca.label}
                    </span>
                  ) : null}
                  <div className="flex items-center justify-between text-sm">
                    <Money value={row.grandTotal} />
                    <span className={softChipClass}>{paymentStatusLabel(row.paymentStatus, language, row)}</span>
                  </div>
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
                  <th className={salesThClass}><SortHeader field="invoiceNumber">{isAr ? 'الرقم' : 'Number'}</SortHeader></th>
                  <th className={salesThClass}>{isAr ? 'العميل' : 'Customer'}</th>
                  <th className={salesThClass}><SortHeader field="issueDate">{isAr ? 'تاريخ الفاتورة' : 'Invoice date'}</SortHeader></th>
                  <th className={salesThClass}><SortHeader field="dueDate">{isAr ? 'الاستحقاق' : 'Due date'}</SortHeader></th>
                  <th className={salesThClass}>{isAr ? 'بدون ضريبة' : 'Tax excl.'}</th>
                  <th className={salesThClass}><SortHeader field="grandTotal">{isAr ? 'الإجمالي' : 'Total'}</SortHeader></th>
                  <th className={salesThClass}>{isAr ? 'المتبقي' : 'Due'}</th>
                  <th className={salesThClass}><SortHeader field="paymentStatus">{isAr ? 'حالة الدفع' : 'Payment'}</SortHeader></th>
                  {isSar ? <th className={salesThClass}>{isAr ? 'زاتكا' : 'ZATCA'}</th> : null}
                  <th className={salesThClass}>{isAr ? 'النشاط التالي' : 'Next activity'}</th>
                  <th className={salesThClass}><SortHeader field="status">{isAr ? 'الحالة' : 'Status'}</SortHeader></th>
                  <th className={salesThClass} />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const overdue = isOverdueRow(row)
                  const activity = computeNextActivity(row, isAr)
                  const zatca = getZatcaStatusMeta(row, language, zatcaPhase)
                  const failed = ['rejected', 'warning'].includes(zatca.status)
                  const numberMeta = resolveInvoiceListNumber(row, language)
                  return (
                    <tr
                      key={row._id}
                      className={`${salesTrClass} ${overdue ? 'bg-rose-50/80 dark:bg-rose-950/20' : ''}`}
                    >
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
                        {overdue && activity.overdueDays ? (
                          <div className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${nextActivityClass('danger')}`}>
                            {isAr ? `متأخر ${activity.overdueDays} يوم` : `${activity.overdueDays}d overdue`}
                          </div>
                        ) : null}
                      </td>
                      <td className={salesTdClass}>{trimName(row.buyer)}</td>
                      <td className={salesTdClass}>
                        {formatDateOnlyDisplay(row.issueDate, isAr ? 'ar-SA' : 'en-GB') || '—'}
                      </td>
                      <td className={salesTdClass}>
                        {formatDateOnlyDisplay(row.dueDate, isAr ? 'ar-SA' : 'en-GB') || '—'}
                      </td>
                      <td className={salesTdClass}>
                        <Money value={Number(row.taxableAmount ?? row.subtotal ?? 0)} />
                      </td>
                      <td className={salesTdClass}>
                        <Money value={row.grandTotal} />
                      </td>
                      <td className={salesTdClass}>
                        {isDraftDocument(row) ? (
                          <span className="text-slate-400">—</span>
                        ) : (
                          <Money value={invoiceRemainingBalance(row)} />
                        )}
                      </td>
                      <td className={salesTdClass}>
                        <span className={softChipClass}>{paymentStatusLabel(row.paymentStatus, language, row)}</span>
                      </td>
                      {isSar ? (
                        <td className={salesTdClass}>
                          <div className="flex flex-wrap items-center gap-1">
                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${zatcaToneClass(zatca.tone)}`}>
                              {zatca.label}
                            </span>
                            {failed ? (
                              <button
                                type="button"
                                className={rowActionBtnClass}
                                title={isAr ? 'إعادة الإرسال' : 'Retry'}
                                onClick={() => retryZatcaMutation.mutate(row._id)}
                                disabled={retryZatcaMutation.isPending}
                              >
                                <RefreshCw className="h-3.5 w-3.5" />
                              </button>
                            ) : null}
                          </div>
                        </td>
                      ) : null}
                      <td className={salesTdClass}>
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${nextActivityClass(activity.tone)}`}>
                          {activity.label}
                        </span>
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
                  )
                })}
              </tbody>
            </table>
          </ResponsiveDataList>
        )}

        {!isLoading && pagination.total > 0 ? (
          <div className={paginationBarClass}>
            <p className="text-xs text-slate-500">
              {isAr
                ? `${pagination.total} فاتورة · صفحة ${pagination.page} من ${pagination.pages}`
                : `${pagination.total} invoices · page ${pagination.page} of ${pagination.pages}`}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                {isAr ? 'السابق' : 'Previous'}
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={page >= (pagination.pages || 1)}
                onClick={() => setPage((p) => p + 1)}
              >
                {isAr ? 'التالي' : 'Next'}
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <RegisterPaymentModal
        isOpen={batchPayOpen}
        onClose={() => { setBatchPayOpen(false); setBatchPayInvoice(null) }}
        invoice={batchPayInvoice}
        language={language}
        isPending={batchPayMutation.isPending}
        onSubmit={(payload) => {
          if (!batchPayInvoice?._id) return
          batchPayMutation.mutate({ invoiceId: batchPayInvoice._id, payload })
        }}
      />

      <BatchCustomerPaymentModal
        isOpen={multiPayOpen}
        onClose={() => setMultiPayOpen(false)}
        invoices={selectedRows}
        language={language}
        isPending={multiPayMutation.isPending}
        onSubmit={(payload) => multiPayMutation.mutate(payload)}
      />
    </div>
  )
}
