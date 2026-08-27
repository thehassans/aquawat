import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { X } from 'lucide-react'
import api from '../../lib/api'
import { asInvList } from '../../lib/invList'
import EmptyState from '../../components/ui/EmptyState'
import PartnerCombobox from '../../components/inventory/PartnerCombobox'
import { formatInvError } from '../../lib/invError'

const TYPE_LABEL = {
  waiting_past_deadline: { en: 'Waiting past deadline', ar: 'متأخر عن الموعد' },
  no_rule: { en: 'No rule found', ar: 'لا قاعدة' },
  no_vendor: { en: 'No vendor', ar: 'لا مورد' },
  procurement_failed: { en: 'Procurement failed', ar: 'فشل التوريد' },
  negative_forecast: { en: 'Negative forecast', ar: 'توقع سالب' },
  expired_lot_on_hand: { en: 'Expired lot on hand', ar: 'دفعة منتهية بالمخزن' },
  integrity: { en: 'Integrity', ar: 'سلامة البيانات' },
}

function ResolveVendorModal({ open, row, ar, language, onClose, onSaved }) {
  const [vendorId, setVendorId] = useState(null)
  const [vendor, setVendor] = useState(null)

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!vendorId) throw new Error(ar ? 'اختر مورداً' : 'Select a vendor')
      const ruleId = row?.ref?.reorderRuleId
      const productId = row?.productId || row?.ref?.productId
      if (ruleId) {
        await api.patch(`/stock/reorder-rules/${ruleId}`, { preferredVendorId: vendorId })
      }
      if (productId) {
        const product = await api.get(`/products/${productId}`).then((r) => r.data)
        const suppliers = Array.isArray(product.suppliers) ? [...product.suppliers] : []
        const already = suppliers.some((s) => String(s.supplierId?._id || s.supplierId) === String(vendorId))
        if (!already) {
          suppliers.push({ supplierId: vendorId, sequence: suppliers.length })
          await api.put(`/products/${productId}`, { suppliers })
        }
      }
      if (!ruleId && !productId) throw new Error('Missing rule or product')
      return { ok: true }
    },
    onSuccess: () => {
      toast.success(ar ? 'تم تعيين المورد' : 'Vendor assigned')
      onSaved?.()
      onClose?.()
    },
    onError: (e) => toast.error(formatInvError(e, language) || e.message),
  })

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-dark-600 dark:bg-dark-800">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
              {ar ? 'تعيين مورد' : 'Assign vendor'}
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              {row?.productName || '—'} · {ar ? 'حتى يعيد المجدول المحاولة' : 'So the scheduler can retry'}
            </p>
          </div>
          <button type="button" className="rounded-lg p-1 text-slate-400 hover:bg-slate-100" onClick={onClose}>
            <X className="h-4 w-4" />
          </button>
        </div>
        <PartnerCombobox
          role="vendor"
          value={vendorId}
          selectedOption={vendor}
          language={language}
          ar={ar}
          onChange={(id, opt) => {
            setVendorId(id || null)
            setVendor(opt || null)
          }}
        />
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>{ar ? 'إلغاء' : 'Cancel'}</button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={saveMut.isPending || !vendorId}
            onClick={() => saveMut.mutate()}
          >
            {ar ? 'حفظ وإعادة المحاولة' : 'Save & resolve'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ExceptionsQueuePage() {
  const { language } = useSelector((s) => s.ui)
  const ar = language === 'ar'
  const qc = useQueryClient()
  const [resolveRow, setResolveRow] = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: ['inv-exceptions'],
    queryFn: () => api.get('/stock/exceptions').then((r) => asInvList(r.data)),
    refetchInterval: 60_000,
  })

  const runChecks = useMutation({
    mutationFn: () => api.post('/stock/integrity/run').then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inv-exceptions'] })
      qc.invalidateQueries({ queryKey: ['inv-jobs'] })
    },
  })

  const items = data || []

  const canResolveVendor = (row) =>
    row.type === 'no_vendor'
    || (row.type === 'procurement_failed' && /vendor|supplier|مورد/i.test(String(row.message || '')))
    || row.code === 'NO_VENDOR'

  return (
    <div className="space-y-4" dir={ar ? 'rtl' : 'ltr'}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            {ar ? 'قائمة الاستثناءات' : 'Exception queue'}
          </h2>
          <p className="text-sm text-slate-500">
            {ar
              ? 'فشل إعادة الطلب، مورد ناقص، حركات متأخرة'
              : 'Failed reordering, missing vendors, late moves'}
          </p>
        </div>
        <button
          type="button"
          disabled={runChecks.isPending}
          onClick={() => runChecks.mutate()}
          className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900"
        >
          {runChecks.isPending ? (ar ? 'جاري الفحص…' : 'Running…') : (ar ? 'تشغيل الفحوصات' : 'Run checks')}
        </button>
      </div>

      {isLoading ? (
        <div className="text-sm text-slate-500">…</div>
      ) : !items.length ? (
        <EmptyState title={ar ? 'لا استثناءات' : 'No exceptions'} />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200/80 dark:border-dark-600">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-dark-800">
              <tr>
                <th className="min-w-[160px] px-3 py-2">{ar ? 'المنتج' : 'Product'}</th>
                <th className="min-w-[140px] px-3 py-2">{ar ? 'الموقع' : 'Location'}</th>
                <th className="min-w-[160px] px-3 py-2">{ar ? 'المستند / المصدر' : 'Failed document / origin'}</th>
                <th className="min-w-[220px] px-3 py-2">{ar ? 'سبب الاستثناء' : 'Exception reason'}</th>
                <th className="min-w-[100px] px-3 py-2 text-right">{ar ? 'إجراء' : 'Action'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-dark-700">
              {items.map((row, i) => (
                <tr key={`${row.type}-${row.code || ''}-${i}`}>
                  <td className="px-3 py-2.5 font-medium text-slate-900 dark:text-white">
                    {row.productName || '—'}
                    <div className="text-[10px] uppercase text-slate-400">
                      {ar ? TYPE_LABEL[row.type]?.ar : TYPE_LABEL[row.type]?.en || row.type}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300">
                    {row.locationName || '—'}
                  </td>
                  <td className="px-3 py-2.5 text-slate-600">
                    {row.ref?.transferId ? (
                      <Link
                        className="text-sky-700 hover:underline"
                        to={`/app/dashboard/inventory/receipts/${row.ref.transferId}`}
                      >
                        {String(row.ref.transferId).slice(-8)}
                      </Link>
                    ) : row.ref?.reorderRuleId ? (
                      <span className="text-xs">Rule {String(row.ref.reorderRuleId).slice(-6)}</span>
                    ) : row.ref?.schedulerRunId ? (
                      <span className="text-xs">Scheduler</span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-slate-700 dark:text-slate-200">
                    <span className={row.severity === 'error' ? 'text-rose-700' : ''}>
                      {ar && row.messageAr ? row.messageAr : row.message}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {canResolveVendor(row) ? (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => setResolveRow(row)}
                      >
                        {ar ? 'حل' : 'Resolve'}
                      </button>
                    ) : row.ref?.transferId ? (
                      <Link
                        className="text-xs font-medium text-sky-700 hover:underline"
                        to={`/app/dashboard/inventory/transfers/${row.ref.transferId}`}
                      >
                        {ar ? 'فتح' : 'Open'}
                      </Link>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ResolveVendorModal
        open={Boolean(resolveRow)}
        row={resolveRow}
        ar={ar}
        language={language}
        onClose={() => setResolveRow(null)}
        onSaved={() => qc.invalidateQueries({ queryKey: ['inv-exceptions'] })}
      />
    </div>
  )
}
