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

/**
 * Full SaaS payment ledger for a tenant subscription.
 */
export default function TenantPaymentHistory({
  history = [],
  language = 'en',
  dense = false,
  maxRows = null,
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
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const cycles = Math.max(1, Number(row.cycles) || 1)
              const unit = Number.isFinite(Number(row.unitPrice))
                ? Number(row.unitPrice)
                : (Number(row.amount) || 0) / cycles
              return (
                <tr key={row._id || `${row.recordedAt || 'pay'}-${idx}`}>
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
                  <td className="whitespace-nowrap text-xs text-gray-600 dark:text-gray-300">
                    {row.periodStart || row.periodEnd
                      ? `${formatSubscriptionDate(row.periodStart, language)} → ${formatSubscriptionDate(row.periodEnd, language)}`
                      : '—'}
                  </td>
                  <td className="max-w-[12rem] truncate text-gray-500" title={row.note || ''}>
                    {row.note || '—'}
                  </td>
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
