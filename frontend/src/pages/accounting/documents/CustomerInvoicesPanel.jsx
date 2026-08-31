import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Plus, Search, Eye } from 'lucide-react'
import toast from 'react-hot-toast'
import { useSelector } from 'react-redux'
import api from '../../../lib/api'
import Money from '../../../components/ui/Money'
import ExportMenu from '../../../components/ui/ExportMenu'
import ResponsiveDataList from '../../../components/ui/ResponsiveDataList'
import AccountingDocumentBatchBar from './AccountingDocumentBatchBar'
import RegisterPaymentModal from '../../../components/accounting/RegisterPaymentModal'
import BatchCustomerPaymentModal from '../../../components/accounting/BatchCustomerPaymentModal'
import { downloadInvoicePdf } from '../../../lib/invoicePdfActions'
import {
  canRegisterPaymentOnDocument,
  documentStatusLabel,
  invoiceRemainingBalance,
  isDraftDocument,
  paymentStatusLabel,
} from '../../../lib/accountingDocumentStatus'
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
  const due = row.dueDate ? new Date(row.dueDate) : null
  if (!due || Number.isNaN(due.getTime())) {
    return { label: '—', tone: 'muted' }
  }
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  due.setHours(0, 0, 0, 0)
  const diffDays = Math.round((due.getTime() - today.getTime()) / 86400000)
  if (diffDays < 0) {
    const overdue = Math.abs(diffDays)
    return {
      label: isAr ? `متابعة — متأخر ${overdue} يوم` : `Follow-up — ${overdue}d overdue`,
      tone: 'danger',
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

export default function CustomerInvoicesPanel({ language: languageProp }) {
  const { language: uiLanguage } = useSelector((s) => s.ui)
  const { tenant } = useSelector((s) => s.auth)
  const language = languageProp || uiLanguage
  const isAr = language === 'ar'
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [paymentFilter, setPaymentFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const customerIdFilter = String(searchParams.get('customerId') || '').trim()
  const productIdFilter = String(searchParams.get('productId') || '').trim()
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const [batchPayInvoice, setBatchPayInvoice] = useState(null)
  const [batchPayOpen, setBatchPayOpen] = useState(false)
  const [multiPayOpen, setMultiPayOpen] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['customer-invoices', search, statusFilter, paymentFilter, typeFilter, customerIdFilter, productIdFilter],
    queryFn: () => api.get('/invoices', {
      params: {
        limit: 100,
        flow: 'sell',
        invoiceType: '388',
        search: search || undefined,
        status: statusFilter || undefined,
        paymentStatus: paymentFilter || undefined,
        transactionType: typeFilter || undefined,
        customerId: customerIdFilter || undefined,
        productId: productIdFilter || undefined,
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

  const exportColumns = useMemo(() => [
    { key: 'invoiceNumber', label: isAr ? 'الرقم' : 'Number' },
    { key: 'customer', label: isAr ? 'العميل' : 'Customer', value: (r) => trimName(r.buyer) },
    { key: 'issueDate', label: isAr ? 'تاريخ الفاتورة' : 'Invoice date' },
    { key: 'dueDate', label: isAr ? 'الاستحقاق' : 'Due date' },
    { key: 'taxExcluded', label: isAr ? 'بدون ضريبة' : 'Tax excluded', value: (r) => Number(r.taxableAmount ?? r.subtotal ?? 0) },
    { key: 'grandTotal', label: isAr ? 'الإجمالي' : 'Total' },
    { key: 'paymentStatus', label: isAr ? 'حالة الدفع' : 'Payment status' },
    { key: 'nextActivity', label: isAr ? 'النشاط التالي' : 'Next activity', value: (r) => computeNextActivity(r, isAr).label },
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

  return (
    <div className="space-y-4">
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

      <div className={filterBarClass}>
        <div className="relative min-w-[180px] flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={isAr ? 'بحث…' : 'Search…'}
            className={`${fieldControlClass} !py-2 ps-10`}
          />
        </div>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className={filterControlClass}>
          <option value="">{isAr ? 'كل الأنواع' : 'All types'}</option>
          <option value="B2B">B2B</option>
          <option value="B2C">B2C</option>
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={filterControlClass}>
          <option value="">{isAr ? 'كل الحالات' : 'All statuses'}</option>
          <option value="draft">{isAr ? 'مسودة' : 'Draft'}</option>
          <option value="issued">{isAr ? 'مرحّلة' : 'Posted'}</option>
          <option value="cancelled">{isAr ? 'ملغاة' : 'Cancelled'}</option>
        </select>
        <select value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)} className={filterControlClass}>
          <option value="">{isAr ? 'كل المدفوعات' : 'All payments'}</option>
          <option value="pending">{isAr ? 'غير مدفوعة' : 'Unpaid'}</option>
          <option value="partial">{isAr ? 'جزئي' : 'Partial'}</option>
          <option value="paid">{isAr ? 'مدفوعة' : 'Paid'}</option>
        </select>
        {(customerIdFilter || productIdFilter) ? (
          <button
            type="button"
            className={`${softChipClass} !px-3`}
            onClick={() => {
              const next = new URLSearchParams(searchParams)
              next.delete('customerId')
              next.delete('productId')
              setSearchParams(next)
            }}
          >
            {isAr ? 'مسح الفلتر' : 'Clear filter'}
          </button>
        ) : null}
        <button
          type="button"
          className="btn btn-primary btn-sm ms-auto"
          onClick={() => navigate('/app/dashboard/accounting/invoices/new/sell')}
        >
          <Plus className="h-4 w-4" />
          {isAr ? 'فاتورة جديدة' : 'New invoice'}
        </button>
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
            empty={<p className={emptyStateClass}>{isAr ? 'لا توجد فواتير عملاء' : 'No customer invoices yet'}</p>}
            renderCard={(row) => (
              <div key={row._id} className="space-y-2 rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-white/10 dark:bg-dark-800">
                <Link to={`/app/dashboard/accounting/invoices/${row._id}`} className={`${docLinkClass} text-base`}>
                  {row.invoiceNumber}
                </Link>
                <p className="text-sm text-slate-500">{trimName(row.buyer)}</p>
                <div className="flex items-center justify-between text-sm">
                  <Money value={row.grandTotal} />
                  <span className={softChipClass}>{paymentStatusLabel(row.paymentStatus, language, row)}</span>
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
                  <th className={salesThClass}>{isAr ? 'العميل' : 'Customer'}</th>
                  <th className={salesThClass}>{isAr ? 'تاريخ الفاتورة' : 'Invoice date'}</th>
                  <th className={salesThClass}>{isAr ? 'الاستحقاق' : 'Due date'}</th>
                  <th className={salesThClass}>{isAr ? 'بدون ضريبة' : 'Tax excl.'}</th>
                  <th className={salesThClass}>{isAr ? 'الإجمالي' : 'Total'}</th>
                  <th className={salesThClass}>{isAr ? 'المتبقي' : 'Due'}</th>
                  <th className={salesThClass}>{isAr ? 'حالة الدفع' : 'Payment'}</th>
                  <th className={salesThClass}>{isAr ? 'النشاط التالي' : 'Next activity'}</th>
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
                    <td className={salesTdClass}>{trimName(row.buyer)}</td>
                    <td className={salesTdClass}>
                      {row.issueDate ? new Date(row.issueDate).toLocaleDateString(isAr ? 'ar-SA' : 'en-GB') : '—'}
                    </td>
                    <td className={salesTdClass}>
                      {row.dueDate ? new Date(row.dueDate).toLocaleDateString(isAr ? 'ar-SA' : 'en-GB') : '—'}
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
                    <td className={salesTdClass}>
                      {(() => {
                        const activity = computeNextActivity(row, isAr)
                        return (
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${nextActivityClass(activity.tone)}`}>
                            {activity.label}
                          </span>
                        )
                      })()}
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
