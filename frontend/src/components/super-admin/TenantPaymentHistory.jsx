import { useEffect, useState } from 'react'
import { Check, Pencil, Trash2, X } from 'lucide-react'
import { formatSubscriptionDate } from '../../lib/subscriptionState'

const methodLabel = (method, language) => {
  const isAr = language === 'ar'
  switch (String(method || '').toLowerCase()) {
    case 'bank_transfer':
      return isAr ? 'تحويل بنكي' : 'Bank transfer'
    case 'cash':
      return isAr ? 'نقداً' : 'Cash'
    case 'card':
      return isAr ? 'بطاقة' : 'Card'
    case 'stc_pay':
      return 'STC Pay'
    default:
      return method || (isAr ? 'أخرى' : 'Other')
  }
}

const toDateInputValue = (value) => {
  if (!value) return ''
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

/**
 * Full SaaS payment ledger for a tenant subscription.
 */
export default function TenantPaymentHistory({
  history = [],
  language = 'en',
  dense = false,
  maxRows = null,
  onRemove = null,
  removingId = null,
  onUpdatePeriod = null,
  updatingId = null,
}) {
  const isAr = language === 'ar'
  const sorted = [...(Array.isArray(history) ? history : [])].sort((a, b) => {
    const ta = a?.recordedAt ? new Date(a.recordedAt).getTime() : 0
    const tb = b?.recordedAt ? new Date(b.recordedAt).getTime() : 0
    return tb - ta
  })
  const rows = Number.isFinite(maxRows) && maxRows > 0 ? sorted.slice(0, maxRows) : sorted
  const totalPaid = sorted.reduce((sum, row) => sum + (Number(row?.amount) || 0), 0)
  const currency = sorted[0]?.currency || 'SAR'
  const canRemove = typeof onRemove === 'function'
  const canEditPeriod = typeof onUpdatePeriod === 'function'

  const [editingId, setEditingId] = useState(null)
  const [draft, setDraft] = useState({ periodStart: '', periodEnd: '' })

  useEffect(() => {
    setEditingId(null)
    setDraft({ periodStart: '', periodEnd: '' })
  }, [history])

  const startEdit = (row) => {
    if (!row?._id) return
    setEditingId(String(row._id))
    setDraft({
      periodStart: toDateInputValue(row.periodStart),
      periodEnd: toDateInputValue(row.periodEnd),
    })
  }

  const cancelEdit = () => {
    setEditingId(null)
    setDraft({ periodStart: '', periodEnd: '' })
  }

  const saveEdit = (row) => {
    if (!row?._id || !draft.periodStart || !draft.periodEnd) return
    onUpdatePeriod?.(row, {
      periodStart: draft.periodStart,
      periodEnd: draft.periodEnd,
    })
  }

  if (sorted.length === 0) {
    return (
      <div className={`rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-8 text-center dark:border-dark-600 dark:bg-dark-700/30 ${dense ? 'text-sm' : ''}`}>
        <p className="font-medium text-gray-700 dark:text-gray-200">
          {isAr ? 'لا يوجد سجل مدفوعات بعد' : 'No payment history yet'}
        </p>
        <p className="mt-1 text-sm text-gray-500">
          {isAr
            ? 'ستظهر هنا الدفعات المسجّلة عند قبول التحويل أو تجديد الاشتراك.'
            : 'Accepted transfers and renewals will appear here.'}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-widest text-gray-400">
          {isAr ? `سجل المدفوعات (${sorted.length})` : `Payment history (${sorted.length})`}
        </p>
        <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">
          {isAr ? 'الإجمالي المسجّل:' : 'Total recorded:'}{' '}
          {totalPaid.toFixed(2)} {currency}
        </p>
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-dark-600">
        <table className={`table text-sm ${dense ? 'text-xs' : ''}`}>
          <thead>
            <tr>
              <th>{isAr ? 'التاريخ' : 'Date'}</th>
              <th>{isAr ? 'المبلغ' : 'Amount'}</th>
              <th>{isAr ? 'سعر الدورة' : 'Unit price'}</th>
              <th>{isAr ? 'الخطة' : 'Plan'}</th>
              <th>{isAr ? 'الدورات' : 'Cycles'}</th>
              <th>{isAr ? 'الطريقة' : 'Method'}</th>
              <th>{isAr ? 'المرجع' : 'Reference'}</th>
              <th>{isAr ? 'الفترة' : 'Period'}</th>
              <th>{isAr ? 'ملاحظة' : 'Note'}</th>
              {canRemove ? <th className="w-12">{isAr ? 'حذف' : 'Remove'}</th> : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const cycles = Math.max(1, Number(row.cycles) || 1)
              const unit = Number.isFinite(Number(row.unitPrice))
                ? Number(row.unitPrice)
                : (Number(row.amount) || 0) / cycles
              const rowId = row._id || `${row.recordedAt || 'pay'}-${idx}`
              const isRemoving = removingId && String(removingId) === String(row._id)
              const isEditing = editingId && String(editingId) === String(row._id)
              const isUpdating = updatingId && String(updatingId) === String(row._id)
              return (
                <tr key={rowId}>
                  <td className="whitespace-nowrap">
                    {row.recordedAt ? formatSubscriptionDate(row.recordedAt, language) : '—'}
                  </td>
                  <td className="whitespace-nowrap font-semibold tabular-nums">
                    {Number(row.amount || 0).toFixed(2)} {row.currency || currency}
                  </td>
                  <td className="whitespace-nowrap tabular-nums text-gray-600 dark:text-gray-300">
                    {unit.toFixed(2)} {row.currency || currency}
                    <span className="text-gray-400">
                      {' / '}
                      {row.billingCycle === 'yearly' ? (isAr ? 'سنة' : 'yr') : (isAr ? 'شهر' : 'mo')}
                    </span>
                  </td>
                  <td className="capitalize whitespace-nowrap">
                    {row.plan || '—'}
                    {row.billingCycle ? (
                      <span className="text-gray-400"> · {row.billingCycle}</span>
                    ) : null}
                  </td>
                  <td className="tabular-nums">{cycles}</td>
                  <td>{methodLabel(row.method, language)}</td>
                  <td className="font-mono text-xs max-w-[10rem] truncate" title={row.reference || ''}>
                    {row.reference || '—'}
                  </td>
                  <td className="min-w-[14rem] text-xs text-gray-600 dark:text-gray-300">
                    {isEditing ? (
                      <div className="flex flex-col gap-1.5 py-1">
                        <div className="flex items-center gap-1.5">
                          <input
                            type="date"
                            lang="en-GB"
                            className="input input-sm py-1 text-xs"
                            value={draft.periodStart}
                            onChange={(e) => setDraft((d) => ({ ...d, periodStart: e.target.value }))}
                          />
                          <span className="text-gray-400">→</span>
                          <input
                            type="date"
                            lang="en-GB"
                            className="input input-sm py-1 text-xs"
                            value={draft.periodEnd}
                            onChange={(e) => setDraft((d) => ({ ...d, periodEnd: e.target.value }))}
                          />
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            className="rounded-lg bg-emerald-600 px-2 py-1 text-white hover:bg-emerald-700 disabled:opacity-50"
                            disabled={isUpdating || !draft.periodStart || !draft.periodEnd}
                            onClick={() => saveEdit(row)}
                            title={isAr ? 'حفظ' : 'Save'}
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            className="rounded-lg px-2 py-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-dark-700"
                            disabled={isUpdating}
                            onClick={cancelEdit}
                            title={isAr ? 'إلغاء' : 'Cancel'}
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                          <span className="text-[10px] text-gray-400">dd mm yyyy</span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 whitespace-nowrap">
                        <span>
                          {row.periodStart || row.periodEnd
                            ? `${formatSubscriptionDate(row.periodStart, language)} → ${formatSubscriptionDate(row.periodEnd, language)}`
                            : '—'}
                        </span>
                        {canEditPeriod && row._id ? (
                          <button
                            type="button"
                            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-emerald-600 dark:hover:bg-dark-700"
                            title={isAr ? 'تعديل الفترة' : 'Edit period'}
                            onClick={() => startEdit(row)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        ) : null}
                      </div>
                    )}
                  </td>
                  <td className="max-w-[12rem] truncate text-gray-500" title={row.note || ''}>
                    {row.note || '—'}
                  </td>
                  {canRemove ? (
                    <td>
                      <button
                        type="button"
                        className="rounded-lg p-1.5 text-red-600 hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-950/30"
                        title={isAr ? 'حذف الدفعة' : 'Remove payment'}
                        disabled={!row._id || isRemoving}
                        onClick={() => onRemove(row)}
                      >
                        <Trash2 className={`h-4 w-4 ${isRemoving ? 'animate-pulse' : ''}`} />
                      </button>
                    </td>
                  ) : null}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {Number.isFinite(maxRows) && maxRows > 0 && sorted.length > maxRows ? (
        <p className="text-xs text-gray-500">
          {isAr
            ? `عرض أحدث ${maxRows} من ${sorted.length}`
            : `Showing latest ${maxRows} of ${sorted.length}`}
        </p>
      ) : null}
    </div>
  )
}
