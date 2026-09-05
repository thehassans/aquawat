import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Download, CheckCircle2, Search } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../../lib/api'
import Money from '../../../components/ui/Money'
import ResponsiveDataList from '../../../components/ui/ResponsiveDataList'
import { downloadPaymentBatchCsv, confirmPaymentBatch } from '../../../lib/vendorApTools'
import { formatDateOnlyDisplay } from '../../../lib/dateOnly'
import {
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

const STATUS_LABEL = {
  draft: { en: 'Draft', ar: 'مسودة' },
  exported: { en: 'Exported', ar: 'مُصدَّر' },
  confirmed: { en: 'Confirmed', ar: 'مؤكد' },
  cancelled: { en: 'Cancelled', ar: 'ملغى' },
}

function statusLabel(status, isAr) {
  const row = STATUS_LABEL[status] || { en: status || '—', ar: status || '—' }
  return isAr ? row.ar : row.en
}

export default function PaymentBatchesPanel({ language: languageProp }) {
  const isAr = languageProp === 'ar'
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['payment-batches', statusFilter],
    queryFn: () => api.get('/accounting/payment-batches', {
      params: { status: statusFilter || undefined, limit: 50 },
    }).then((r) => r.data),
  })

  const rows = (data?.batches || []).filter((b) => {
    if (!search.trim()) return true
    const q = search.trim().toLowerCase()
    return String(b.number || '').toLowerCase().includes(q)
      || String(b.exportFilename || '').toLowerCase().includes(q)
  })

  const exportMutation = useMutation({
    mutationFn: (batchId) => downloadPaymentBatchCsv(batchId),
    onSuccess: () => {
      toast.success(isAr ? 'تم تنزيل CSV' : 'CSV downloaded')
      queryClient.invalidateQueries({ queryKey: ['payment-batches'] })
    },
    onError: (err) => toast.error(err.response?.data?.error || (isAr ? 'فشل التصدير' : 'Export failed')),
  })

  const confirmMutation = useMutation({
    mutationFn: (batchId) => confirmPaymentBatch(batchId),
    onSuccess: () => {
      toast.success(isAr ? 'تم تأكيد الدفعة من كشف البنك' : 'Batch confirmed against bank statement')
      queryClient.invalidateQueries({ queryKey: ['payment-batches'] })
    },
    onError: (err) => toast.error(err.response?.data?.error || (isAr ? 'فشل التأكيد' : 'Confirm failed')),
  })

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        {isAr
          ? 'مسودة → مُصدَّر (ملف CSV) → مؤكد بعد مطابقة كشف البنك. اختر فواتير من قائمة فواتير الموردين لإنشاء دفعة.'
          : 'Draft → Exported (CSV file) → Confirmed after bank statement match. Create batches from Vendor Bills selection.'}
      </p>

      <div className={filterBarClass}>
        <div className="relative min-w-[180px] flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={isAr ? 'بحث برقم الدفعة…' : 'Search batch number…'}
            className={`${fieldControlClass} ps-10`}
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className={fieldControlClass}
        >
          <option value="">{isAr ? 'كل الحالات' : 'All statuses'}</option>
          <option value="draft">{isAr ? 'مسودة' : 'Draft'}</option>
          <option value="exported">{isAr ? 'مُصدَّر' : 'Exported'}</option>
          <option value="confirmed">{isAr ? 'مؤكد' : 'Confirmed'}</option>
        </select>
      </div>

      <div className={listShellClass}>
        {isLoading ? (
          <p className={emptyStateClass}>{isAr ? 'جارٍ التحميل…' : 'Loading…'}</p>
        ) : (
          <ResponsiveDataList
            items={rows}
            empty={<p className={emptyStateClass}>{isAr ? 'لا توجد دفعات بعد' : 'No payment batches yet'}</p>}
            renderCard={(row) => (
              <div key={row._id} className="space-y-2 rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-white/10 dark:bg-dark-800">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-slate-900 dark:text-white">{row.number}</span>
                  <span className={softChipClass}>{statusLabel(row.status, isAr)}</span>
                </div>
                <p className="text-sm text-slate-500">
                  {row.lineCount} {isAr ? 'سطر' : 'lines'} · <Money value={row.totalAmount} />
                </p>
                <p className="text-xs text-slate-400">
                  {formatDateOnlyDisplay(row.executionDate || row.createdAt)}
                </p>
                <div className={rowActionsWrapClass}>
                  {row.status !== 'cancelled' && row.status !== 'confirmed' ? (
                    <button
                      type="button"
                      className={rowActionBtnClass}
                      disabled={exportMutation.isPending}
                      onClick={() => exportMutation.mutate(row._id)}
                    >
                      <Download className="h-4 w-4" />
                      CSV
                    </button>
                  ) : null}
                  {row.status === 'exported' ? (
                    <button
                      type="button"
                      className={rowActionBtnClass}
                      disabled={confirmMutation.isPending}
                      onClick={() => confirmMutation.mutate(row._id)}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      {isAr ? 'تأكيد' : 'Confirm'}
                    </button>
                  ) : null}
                </div>
              </div>
            )}
            table={(
              <table className={salesTableClass}>
                <thead>
                  <tr className={salesTrClass}>
                    <th className={salesThClass}>{isAr ? 'الرقم' : 'Number'}</th>
                    <th className={salesThClass}>{isAr ? 'الحالة' : 'Status'}</th>
                    <th className={salesThClass}>{isAr ? 'الأسطر' : 'Lines'}</th>
                    <th className={salesThClass}>{isAr ? 'المبلغ' : 'Amount'}</th>
                    <th className={salesThClass}>{isAr ? 'التاريخ' : 'Date'}</th>
                    <th className={salesThClass}>{isAr ? 'إجراءات' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row._id} className={salesTrClass}>
                      <td className={salesTdClass}>
                        <span className="font-mono text-sm font-semibold">{row.number}</span>
                      </td>
                      <td className={salesTdClass}>
                        <span className={softChipClass}>{statusLabel(row.status, isAr)}</span>
                      </td>
                      <td className={salesTdClass}>{row.lineCount}</td>
                      <td className={salesTdClass}><Money value={row.totalAmount} /></td>
                      <td className={salesTdClass}>
                        {formatDateOnlyDisplay(row.executionDate || row.createdAt)}
                      </td>
                      <td className={salesTdClass}>
                        <div className={rowActionsWrapClass}>
                          {row.status !== 'cancelled' && row.status !== 'confirmed' ? (
                            <button
                              type="button"
                              className={rowActionBtnClass}
                              disabled={exportMutation.isPending}
                              onClick={() => exportMutation.mutate(row._id)}
                            >
                              <Download className="h-4 w-4" />
                              CSV
                            </button>
                          ) : null}
                          {row.status === 'exported' ? (
                            <button
                              type="button"
                              className={rowActionBtnClass}
                              disabled={confirmMutation.isPending}
                              onClick={() => confirmMutation.mutate(row._id)}
                            >
                              <CheckCircle2 className="h-4 w-4" />
                              {isAr ? 'تأكيد' : 'Confirm'}
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          />
        )}
      </div>
    </div>
  )
}
