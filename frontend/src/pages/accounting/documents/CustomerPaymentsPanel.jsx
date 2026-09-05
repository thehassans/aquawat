import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, AlertTriangle, Wallet } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../../lib/api'
import Money from '../../../components/ui/Money'
import ResponsiveDataList from '../../../components/ui/ResponsiveDataList'
import EmptyState from '../../../components/ui/EmptyState'
import { useAccountingQuery } from '../../../hooks/useAccountingQuery'
import AccountingQueryState from '../AccountingQueryState'
import {
  emptyStateClass,
  fieldControlClass,
  filterBarClass,
  listShellClass,
  salesTdClass,
  salesThClass,
  salesTrClass,
  salesTableClass,
  softChipClass,
} from '../../sales/salesUi'
import { formatDateOnlyDisplay } from '../../../lib/dateOnly'

const METHODS = [
  { id: 'bank_transfer', en: 'Bank transfer', ar: 'تحويل بنكي' },
  { id: 'cash', en: 'Cash', ar: 'نقداً' },
  { id: 'card', en: 'Card', ar: 'بطاقة' },
  { id: 'cheque', en: 'Check', ar: 'شيك' },
  { id: 'other', en: 'Other', ar: 'أخرى' },
]

const methodLabel = (method, isAr) => {
  const row = METHODS.find((m) => m.id === method)
  if (row) return isAr ? row.ar : row.en
  return method || '—'
}

function NewPaymentForm({ language, onCancel, onCreated }) {
  const isAr = language === 'ar'
  const [customerId, setCustomerId] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('bank_transfer')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [memo, setMemo] = useState('')
  const [alloc, setAlloc] = useState({}) // invoiceId → amount string

  const { data: customers = [] } = useQuery({
    queryKey: ['accounting-parties-customers-pay'],
    queryFn: () => api.get('/accounting/parties/customers', { params: { limit: 200 } })
      .then((r) => (Array.isArray(r.data) ? r.data : r.data?.customers || []))
      .catch(() => []),
  })

  const { data: openData } = useQuery({
    queryKey: ['open-invoices-for-payment', customerId],
    queryFn: () => api.get('/accounting/customer-payments/open-invoices', {
      params: { customerId },
    }).then((r) => r.data),
    enabled: Boolean(customerId),
  })

  const openInvoices = openData?.invoices || []

  useEffect(() => {
    setAlloc({})
  }, [customerId])

  const allocSum = useMemo(
    () => Object.values(alloc).reduce((s, v) => s + (Number(v) || 0), 0),
    [alloc],
  )
  const payAmt = Number(amount) || 0
  const unallocated = Math.round((payAmt - allocSum) * 100) / 100

  const autoAllocate = () => {
    let left = payAmt
    if (left <= 0) {
      toast.error(isAr ? 'أدخل المبلغ أولاً' : 'Enter amount first')
      return
    }
    const next = {}
    for (const inv of openInvoices) {
      if (left <= 0.005) break
      const take = Math.min(Number(inv.residual) || 0, left)
      if (take > 0.005) {
        next[String(inv._id)] = take.toFixed(2)
        left = Math.round((left - take) * 100) / 100
      }
    }
    setAlloc(next)
  }

  const create = useMutation({
    mutationFn: () => {
      const allocations = Object.entries(alloc)
        .map(([invoiceId, amt]) => ({ invoiceId, amount: Number(amt) }))
        .filter((a) => a.amount > 0.005)
      return api.post('/accounting/customer-payments', {
        customerId: customerId || undefined,
        customerName: customerName || undefined,
        amount: payAmt,
        method,
        date,
        memo,
        allocations,
        source: 'payments_page',
      }).then((r) => r.data)
    },
    onSuccess: (payment) => {
      toast.success(isAr ? 'تم تسجيل الدفعة' : 'Payment recorded')
      onCreated?.(payment)
    },
    onError: (err) => toast.error(err.response?.data?.error || err.message),
  })

  return (
    <div className="space-y-4 rounded-2xl border border-slate-200/80 bg-white p-5 dark:border-white/10 dark:bg-dark-800">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold">{isAr ? 'دفعة جديدة' : 'New payment'}</h3>
        <button type="button" className="btn btn-secondary btn-sm" onClick={onCancel}>
          {isAr ? 'إلغاء' : 'Cancel'}
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <label className="label">{isAr ? 'العميل' : 'Customer'}</label>
          <select
            className="select"
            value={customerId}
            onChange={(e) => {
              const id = e.target.value
              setCustomerId(id)
              const c = customers.find((x) => String(x._id) === id)
              setCustomerName(c ? (isAr ? (c.nameAr || c.nameEn || c.name) : (c.nameEn || c.nameAr || c.name)) : '')
            }}
          >
            <option value="">{isAr ? 'اختر عميلاً…' : 'Select customer…'}</option>
            {customers.map((c) => (
              <option key={c._id} value={c._id}>
                {isAr ? (c.nameAr || c.nameEn || c.name) : (c.nameEn || c.nameAr || c.name)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">{isAr ? 'التاريخ' : 'Date'}</label>
          <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <label className="label">{isAr ? 'طريقة الدفع' : 'Method'}</label>
          <select className="select" value={method} onChange={(e) => setMethod(e.target.value)}>
            {METHODS.map((m) => (
              <option key={m.id} value={m.id}>{isAr ? m.ar : m.en}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">{isAr ? 'المبلغ' : 'Amount'}</label>
          <input
            type="number"
            min="0.01"
            step="0.01"
            className="input"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <div>
          <label className="label">{isAr ? 'مذكرة' : 'Memo'}</label>
          <input className="input" value={memo} onChange={(e) => setMemo(e.target.value)} />
        </div>
      </div>

      {customerId ? (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold">{isAr ? 'الفواتير المفتوحة' : 'Open invoices'}</p>
            <button type="button" className="btn btn-secondary btn-sm" onClick={autoAllocate}>
              {isAr ? 'توزيع تلقائي (الأقدم أولاً)' : 'Auto-allocate oldest first'}
            </button>
          </div>
          <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-dark-600">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-[11px] uppercase text-slate-400 dark:bg-dark-900">
                <tr>
                  <th className="px-3 py-2 text-start">{isAr ? 'الفاتورة' : 'Invoice'}</th>
                  <th className="px-3 py-2 text-start">{isAr ? 'الاستحقاق' : 'Due'}</th>
                  <th className="px-3 py-2 text-end">{isAr ? 'المتبقي' : 'Residual'}</th>
                  <th className="px-3 py-2 text-end">{isAr ? 'التخصيص' : 'Allocate'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {openInvoices.map((inv) => {
                  const id = String(inv._id)
                  return (
                    <tr key={id}>
                      <td className="px-3 py-2 font-mono text-xs">{inv.invoiceNumber}</td>
                      <td className="px-3 py-2">
                        {formatDateOnlyDisplay(inv.dueDate, isAr ? 'ar-SA' : 'en-GB') || '—'}
                      </td>
                      <td className="px-3 py-2 text-end"><Money value={inv.residual} /></td>
                      <td className="px-3 py-2 text-end">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          className="input input-sm w-28 text-end"
                          value={alloc[id] || ''}
                          onChange={(e) => setAlloc((p) => ({ ...p, [id]: e.target.value }))}
                        />
                      </td>
                    </tr>
                  )
                })}
                {!openInvoices.length ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center text-slate-400">
                      {isAr ? 'لا فواتير مفتوحة' : 'No open invoices'}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <p className={`text-sm font-semibold ${unallocated > 0.005 ? 'text-amber-700' : 'text-emerald-700'}`}>
            {isAr ? 'غير مخصص: ' : 'Unallocated: '}
            <Money value={Math.max(0, unallocated)} />
          </p>
        </div>
      ) : null}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          className="btn btn-primary"
          disabled={create.isPending || payAmt <= 0 || (!customerId && !customerName)}
          onClick={() => create.mutate()}
        >
          {create.isPending ? '…' : (isAr ? 'تأكيد الدفعة' : 'Confirm payment')}
        </button>
      </div>
    </div>
  )
}

export default function CustomerPaymentsPanel({ language = 'en' }) {
  const isAr = language === 'ar'
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)

  const { data, isLoading, isError, error, refetch } = useAccountingQuery({
    queryKey: ['customer-payments', search],
    queryFn: () => api.get('/accounting/customer-payments', {
      params: { search: search.trim() || undefined, limit: 100 },
    }).then((r) => r.data),
  })

  const rows = data?.payments || []

  const backfill = useMutation({
    mutationFn: ({ dryRun }) => api.post('/accounting/customer-payments/backfill', { dryRun })
      .then((r) => r.data),
    onSuccess: (report, vars) => {
      if (vars?.dryRun) {
        const msg = isAr
          ? `تجريبي: ${report.wouldCreate || 0} دفعة · مرتبطة بفاتورة ${report.linkedToInvoice || 0} · غامضة ${report.ambiguous || 0}`
          : `Dry-run: ${report.wouldCreate || 0} payments · invoice-linked ${report.linkedToInvoice || 0} · ambiguous ${report.ambiguous || 0}`
        toast(msg, { duration: 6000 })
        if ((report.wouldCreate || 0) > 0 && window.confirm(isAr
          ? `تطبيق الاستعادة لـ ${report.wouldCreate} دفعة؟`
          : `Apply backfill for ${report.wouldCreate} payments?`)) {
          backfill.mutate({ dryRun: false })
        }
        return
      }
      toast.success(isAr
        ? `تمت استعادة ${report.created} دفعة`
        : `Backfilled ${report.created} payments`)
      queryClient.invalidateQueries({ queryKey: ['customer-payments'] })
    },
    onError: (e) => toast.error(e.response?.data?.error || e.message),
  })

  if (showForm) {
    return (
      <NewPaymentForm
        language={language}
        onCancel={() => setShowForm(false)}
        onCreated={() => {
          setShowForm(false)
          queryClient.invalidateQueries({ queryKey: ['customer-payments'] })
          queryClient.invalidateQueries({ queryKey: ['accounting-dashboard'] })
        }}
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={backfill.isPending}
            onClick={() => backfill.mutate({ dryRun: true })}
          >
            {isAr ? 'استعادة من القيود' : 'Backfill from journals'}
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4" />
            {isAr ? 'دفعة جديدة' : 'New payment'}
          </button>
      </div>

      <div className={filterBarClass}>
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={isAr ? 'بحث برقم / عميل…' : 'Search number / customer…'}
            className={`${fieldControlClass} ps-10`}
          />
        </div>
      </div>

      <AccountingQueryState
        language={language}
        isLoading={isLoading && !data}
        isError={isError}
        error={error}
        onRetry={() => refetch()}
      >
        <div className={listShellClass}>
          <ResponsiveDataList
            items={rows}
            empty={(
              <EmptyState
                icon={Wallet}
                language={language}
                title="No customer payments yet"
                titleAr="لا توجد مدفوعات عملاء بعد"
                description="Record a receipt against open invoices, or backfill from orphan payment journals after reviewing the dry-run report."
                descriptionAr="سجّل قبضاً مقابل فواتير مفتوحة، أو استعد من قيود اليومية بعد مراجعة التقرير التجريبي."
                action={() => setShowForm(true)}
                actionLabel="New payment"
                actionLabelAr="دفعة جديدة"
              />
            )}
            renderCard={(row) => (
              <div key={row._id} className="space-y-2 rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-white/10 dark:bg-dark-800">
                <p className="font-semibold">{row.number}</p>
                <p className="text-sm text-slate-500">{row.partnerName || '—'}</p>
                <div className="flex items-center justify-between text-sm">
                  <Money value={row.amount} currency={row.currency} />
                  {row.unallocatedAmount > 0.005 ? (
                    <span className={`${softChipClass} !border-amber-200 !text-amber-800`}>
                      <AlertTriangle className="h-3 w-3" />
                      {isAr ? 'غير مخصص' : 'Unallocated'}
                    </span>
                  ) : (
                    <span className={softChipClass}>{isAr ? 'مرحّلة' : 'Posted'}</span>
                  )}
                </div>
              </div>
            )}
          >
            <table className={salesTableClass}>
              <thead>
                <tr>
                  <th className={salesThClass}>{isAr ? 'التاريخ' : 'Date'}</th>
                  <th className={salesThClass}>{isAr ? 'الرقم' : 'Number'}</th>
                  <th className={salesThClass}>{isAr ? 'العميل' : 'Customer'}</th>
                  <th className={salesThClass}>{isAr ? 'الطريقة' : 'Method'}</th>
                  <th className={salesThClass}>{isAr ? 'المبلغ' : 'Amount'}</th>
                  <th className={salesThClass}>{isAr ? 'مخصص' : 'Allocated'}</th>
                  <th className={salesThClass}>{isAr ? 'غير مخصص' : 'Unallocated'}</th>
                  <th className={salesThClass}>{isAr ? 'اليومية' : 'Journal'}</th>
                  <th className={salesThClass}>{isAr ? 'مطابقة' : 'Reconciled'}</th>
                  <th className={salesThClass}>{isAr ? 'الحالة' : 'Status'}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row._id} className={salesTrClass}>
                    <td className={salesTdClass}>
                      {row.date ? new Date(row.date).toLocaleDateString(isAr ? 'ar-SA' : 'en-GB') : '—'}
                    </td>
                    <td className={salesTdClass}>{row.number || '—'}</td>
                    <td className={salesTdClass}>{row.partnerName || '—'}</td>
                    <td className={salesTdClass}>{row.methodLabelAr && isAr ? row.methodLabelAr : (row.methodLabel || methodLabel(row.method, isAr))}</td>
                    <td className={`${salesTdClass} tabular-nums`}>
                      <Money value={row.amount} currency={row.currency} />
                    </td>
                    <td className={`${salesTdClass} tabular-nums`}>
                      <Money value={row.allocatedAmount} />
                    </td>
                    <td className={`${salesTdClass} tabular-nums`}>
                      {row.unallocatedAmount > 0.005 ? (
                        <span className="inline-flex items-center gap-1 font-semibold text-amber-700">
                          <AlertTriangle className="h-3 w-3" />
                          <Money value={row.unallocatedAmount} />
                        </span>
                      ) : (
                        <Money value={0} />
                      )}
                    </td>
                    <td className={salesTdClass}>{row.journalLabel || row.journalId?.code || '—'}</td>
                    <td className={salesTdClass}>
                      {row.reconciliationStatus === 'reconciled'
                        ? (isAr ? 'مطابق' : 'Yesed')
                        : (isAr ? 'غير مطابق' : 'Open')}
                    </td>
                    <td className={salesTdClass}>
                      <span className={softChipClass}>
                        {row.status === 'draft' ? (isAr ? 'مسودة' : 'Draft') : (isAr ? 'مرحّلة' : 'Posted')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ResponsiveDataList>
        </div>
      </AccountingQueryState>
    </div>
  )
}
