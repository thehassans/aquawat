import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, AlertTriangle, Printer } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../../lib/api'
import Money from '../../../components/ui/Money'
import ResponsiveDataList from '../../../components/ui/ResponsiveDataList'
import { useAccountingQuery } from '../../../hooks/useAccountingQuery'
import AccountingQueryState from '../AccountingQueryState'
import { printVendorCheck } from '../../../lib/vendorApTools'
import { formatDateOnlyDisplay } from '../../../lib/dateOnly'
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

function NewVendorPaymentForm({ language, onCancel, onCreated }) {
  const isAr = language === 'ar'
  const [vendorId, setVendorId] = useState('')
  const [vendorName, setVendorName] = useState('')
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('bank_transfer')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [memo, setMemo] = useState('')
  const [selected, setSelected] = useState({}) // billId → boolean
  const [alloc, setAlloc] = useState({}) // billId → amount string

  const { data: vendors = [] } = useQuery({
    queryKey: ['accounting-parties-suppliers-pay'],
    queryFn: () => api.get('/accounting/parties/suppliers', { params: { limit: 200 } })
      .then((r) => (Array.isArray(r.data) ? r.data : r.data?.suppliers || []))
      .catch(() => []),
  })

  const { data: openData } = useQuery({
    queryKey: ['open-bills-for-payment', vendorId],
    queryFn: () => api.get('/accounting/vendor-payments/open-bills', {
      params: { vendorId },
    }).then((r) => r.data),
    enabled: Boolean(vendorId),
  })

  const openBills = openData?.bills || []

  useEffect(() => {
    setSelected({})
    setAlloc({})
  }, [vendorId])

  const payAmt = Number(amount) || 0

  const allocSum = useMemo(
    () => Object.entries(alloc).reduce((s, [id, v]) => {
      if (!selected[id]) return s
      return s + (Number(v) || 0)
    }, 0),
    [alloc, selected],
  )
  const unallocated = Math.round((payAmt - allocSum) * 100) / 100

  const autoAllocateOldest = (nextAmount = payAmt, bills = openBills) => {
    let left = nextAmount
    const nextSelected = {}
    const nextAlloc = {}
    for (const bill of bills) {
      if (left <= 0.005) break
      const take = Math.min(Number(bill.residual) || 0, left)
      if (take > 0.005) {
        const id = String(bill._id)
        nextSelected[id] = true
        nextAlloc[id] = take.toFixed(2)
        left = Math.round((left - take) * 100) / 100
      }
    }
    setSelected(nextSelected)
    setAlloc(nextAlloc)
  }

  const toggleBill = (bill) => {
    const id = String(bill._id)
    setSelected((prev) => {
      const on = !prev[id]
      const next = { ...prev, [id]: on }
      if (!on) {
        setAlloc((a) => {
          const copy = { ...a }
          delete copy[id]
          return copy
        })
      } else if (!alloc[id]) {
        const residual = Number(bill.residual) || 0
        const left = Math.max(0, payAmt - Object.entries(alloc).reduce((s, [k, v]) => {
          if (!prev[k]) return s
          return s + (Number(v) || 0)
        }, 0))
        const take = Math.min(residual, left || residual)
        setAlloc((a) => ({ ...a, [id]: take > 0 ? take.toFixed(2) : '' }))
      }
      return next
    })
  }

  const create = useMutation({
    mutationFn: () => {
      const allocations = Object.entries(alloc)
        .filter(([id]) => selected[id])
        .map(([billId, amt]) => ({ billId, amount: Number(amt) }))
        .filter((a) => a.amount > 0.005)
      return api.post('/accounting/vendor-payments', {
        vendorId: vendorId || undefined,
        vendorName: vendorName || undefined,
        amount: payAmt,
        method,
        date,
        memo,
        allocations,
        source: 'payments_page',
      }).then((r) => r.data)
    },
    onSuccess: async (payment) => {
      toast.success(isAr ? 'تم تسجيل الدفعة' : 'Payment recorded')
      if (method === 'cheque') {
        try {
          await printVendorCheck({
            payeeName: vendorName || payment.partnerName,
            amount: payAmt,
            memo,
            paymentDate: date,
          })
        } catch {
          /* optional */
        }
      }
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
          <label className="label">{isAr ? 'المورد' : 'Vendor'}</label>
          <select
            className="select"
            value={vendorId}
            onChange={(e) => {
              const id = e.target.value
              setVendorId(id)
              const v = vendors.find((x) => String(x._id) === id)
              setVendorName(v
                ? (isAr ? (v.nameAr || v.nameEn || v.name) : (v.nameEn || v.nameAr || v.name))
                : '')
            }}
          >
            <option value="">{isAr ? 'اختر مورداً…' : 'Select vendor…'}</option>
            {vendors.map((v) => (
              <option key={v._id} value={v._id}>
                {isAr ? (v.nameAr || v.nameEn || v.name) : (v.nameEn || v.nameAr || v.name)}
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
            onChange={(e) => {
              setAmount(e.target.value)
              const next = Number(e.target.value) || 0
              if (vendorId && openBills.length && next > 0) {
                autoAllocateOldest(next, openBills)
              }
            }}
          />
        </div>
        <div>
          <label className="label">{isAr ? 'مذكرة' : 'Memo'}</label>
          <div className="flex gap-2">
            <input className="input flex-1" value={memo} onChange={(e) => setMemo(e.target.value)} />
            {method === 'cheque' ? (
              <button
                type="button"
                className="btn btn-secondary btn-sm inline-flex items-center gap-1"
                onClick={() => printVendorCheck({
                  payeeName: vendorName,
                  amount: payAmt,
                  memo,
                  paymentDate: date,
                }).catch((err) => toast.error(err.message))}
              >
                <Printer className="h-4 w-4" />
                {isAr ? 'طباعة' : 'Print'}
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {vendorId ? (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold">{isAr ? 'الفواتير المفتوحة' : 'Open bills'}</p>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                if (payAmt <= 0) {
                  toast.error(isAr ? 'أدخل المبلغ أولاً' : 'Enter amount first')
                  return
                }
                autoAllocateOldest()
              }}
            >
              {isAr ? 'توزيع تلقائي (الأقدم أولاً)' : 'Auto-allocate oldest first'}
            </button>
          </div>
          <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-dark-600">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-[11px] uppercase text-slate-400 dark:bg-dark-900">
                <tr>
                  <th className="px-3 py-2 text-start w-10" />
                  <th className="px-3 py-2 text-start">{isAr ? 'الفاتورة' : 'Bill'}</th>
                  <th className="px-3 py-2 text-start">{isAr ? 'الاستحقاق' : 'Due'}</th>
                  <th className="px-3 py-2 text-end">{isAr ? 'المتبقي' : 'Residual'}</th>
                  <th className="px-3 py-2 text-end">{isAr ? 'التخصيص' : 'Allocate'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {openBills.map((bill) => {
                  const id = String(bill._id)
                  return (
                    <tr key={id}>
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={!!selected[id]}
                          onChange={() => toggleBill(bill)}
                        />
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">{bill.invoiceNumber}</td>
                      <td className="px-3 py-2">
                        {formatDateOnlyDisplay(bill.dueDate, isAr ? 'ar-SA' : 'en-GB') || '—'}
                      </td>
                      <td className="px-3 py-2 text-end"><Money value={bill.residual} /></td>
                      <td className="px-3 py-2 text-end">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          disabled={!selected[id]}
                          className="input input-sm w-28 text-end"
                          value={alloc[id] || ''}
                          onChange={(e) => setAlloc((p) => ({ ...p, [id]: e.target.value }))}
                        />
                      </td>
                    </tr>
                  )
                })}
                {!openBills.length ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-slate-400">
                      {isAr ? 'لا فواتير مفتوحة' : 'No open bills'}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <p className={`text-sm font-semibold ${unallocated > 0.005 ? 'text-amber-700' : 'text-emerald-700'}`}>
            {isAr ? 'غير مخصص: ' : 'Unallocated: '}
            <Money value={Math.max(0, unallocated)} />
            {unallocated > 0.005 ? (
              <span className="ms-2 font-normal text-amber-600">
                {isAr ? '(دفعة مقدمة للمورد)' : '(Advance to supplier)'}
              </span>
            ) : null}
          </p>
        </div>
      ) : null}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          className="btn btn-primary"
          disabled={create.isPending || payAmt <= 0 || (!vendorId && !vendorName)}
          onClick={() => create.mutate()}
        >
          {create.isPending ? '…' : (isAr ? 'تأكيد الدفعة' : 'Confirm payment')}
        </button>
      </div>
    </div>
  )
}

export default function VendorPaymentsPanel({ language = 'en' }) {
  const isAr = language === 'ar'
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)

  const { data, isLoading, isError, error, refetch } = useAccountingQuery({
    queryKey: ['vendor-payments', search],
    queryFn: () => api.get('/accounting/vendor-payments', {
      params: { search: search.trim() || undefined, limit: 100 },
    }).then((r) => r.data),
  })

  const rows = data?.payments || []

  const backfill = useMutation({
    mutationFn: () => api.post('/accounting/vendor-payments/backfill', { dryRun: false })
      .then((r) => r.data),
    onSuccess: (report) => {
      toast.success(isAr
        ? `تمت استعادة ${report.created} دفعة`
        : `Backfilled ${report.created} payments`)
      queryClient.invalidateQueries({ queryKey: ['vendor-payments'] })
    },
    onError: (e) => toast.error(e.response?.data?.error || e.message),
  })

  if (showForm) {
    return (
      <NewVendorPaymentForm
        language={language}
        onCancel={() => setShowForm(false)}
        onCreated={() => {
          setShowForm(false)
          queryClient.invalidateQueries({ queryKey: ['vendor-payments'] })
          queryClient.invalidateQueries({ queryKey: ['accounting-dashboard'] })
          queryClient.invalidateQueries({ queryKey: ['vendor-bills'] })
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
          onClick={() => {
            if (window.confirm(isAr
              ? 'استعادة المدفوعات من قيود اليومية اليتيمة؟'
              : 'Backfill payments from orphan payment journals?')) {
              backfill.mutate()
            }
          }}
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
            placeholder={isAr ? 'بحث برقم / مورد…' : 'Search number / vendor…'}
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
              <div className="space-y-3 py-10 text-center">
                <p className={emptyStateClass}>{isAr ? 'لا توجد مدفوعات بعد' : 'No vendor payments yet'}</p>
                <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowForm(true)}>
                  <Plus className="h-4 w-4" />
                  {isAr ? 'دفعة جديدة' : 'New payment'}
                </button>
              </div>
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
                  <th className={salesThClass}>{isAr ? 'المورد' : 'Vendor'}</th>
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
                    <td className={salesTdClass}>
                      {row.methodLabelAr && isAr
                        ? row.methodLabelAr
                        : (row.methodLabel || methodLabel(row.method, isAr))}
                    </td>
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
                        ? (isAr ? 'مطابق' : 'Reconciled')
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
