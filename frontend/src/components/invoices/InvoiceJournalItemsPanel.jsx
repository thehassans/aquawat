import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link2, RefreshCw } from 'lucide-react'
import api from '../../lib/api'
import Money from '../ui/Money'
import { sectionCardClass } from '../../pages/sales/salesUi'
import { PURCHASES_PATH } from '../../pages/purchases/purchasesUi'

/**
 * Journal items panel — auto-previews GL lines for sell/purchase invoices,
 * allows account overrides, and exposes lines for the save payload.
 */
export default function InvoiceJournalItemsPanel({
  flow = 'sell',
  language = 'en',
  totals = {},
  lineItems = [],
  sourcePurchaseOrderId = '',
  sourceGrnIds = [],
  value = null,
  onChange,
}) {
  const isAr = language === 'ar'
  const [localLines, setLocalLines] = useState([])
  const [dirty, setDirty] = useState(false)

  const previewKey = useMemo(() => JSON.stringify({
    flow,
    grandTotal: Number(totals.grandTotal || 0),
    totalTax: Number(totals.totalTax || 0),
    taxableAmount: Number(totals.taxableAmount || 0),
    lines: (lineItems || []).map((l) => ({
      productId: l.productId || '',
      productType: l.productType || 'goods',
      lineTotal: Number(l.lineTotal || 0),
      taxAmount: Number(l.taxAmount || 0),
      lineTotalWithTax: Number(l.lineTotalWithTax || 0),
    })),
    sourcePurchaseOrderId: sourcePurchaseOrderId || '',
    sourceGrnIds: sourceGrnIds || [],
  }), [flow, totals, lineItems, sourcePurchaseOrderId, sourceGrnIds])

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounting-accounts-active'],
    queryFn: () => api.get('/accounting/accounts').then((r) => r.data || []),
    staleTime: 60_000,
  })

  const { data: preview, isFetching, refetch } = useQuery({
    queryKey: ['invoice-preview-journal', previewKey],
    queryFn: async () => {
      const body = JSON.parse(previewKey)
      const { data } = await api.post('/invoices/preview-journal', {
        flow: body.flow,
        grandTotal: body.grandTotal,
        totalTax: body.totalTax,
        taxableAmount: body.taxableAmount,
        lineItems: body.lines.map((l, i) => ({
          ...l,
          productId: lineItems[i]?.productId || undefined,
          productType: lineItems[i]?.productType || 'goods',
          lineTotal: lineItems[i]?.lineTotal ?? l.lineTotal,
          taxAmount: lineItems[i]?.taxAmount ?? l.taxAmount,
          lineTotalWithTax: lineItems[i]?.lineTotalWithTax ?? l.lineTotalWithTax,
        })),
        sourcePurchaseOrderId: body.sourcePurchaseOrderId || undefined,
        sourceGrnIds: body.sourceGrnIds || undefined,
      })
      return data
    },
    enabled: Number(totals.grandTotal || 0) > 0,
    staleTime: 5_000,
  })

  useEffect(() => {
    if (dirty) return
    if (Array.isArray(preview?.lines)) {
      setLocalLines(preview.lines)
      onChange?.(preview.lines)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-sync when server preview changes
  }, [preview, dirty])

  useEffect(() => {
    if (dirty) return
    if (Array.isArray(value) && value.length && !preview?.lines?.length) {
      setLocalLines(value)
    }
  }, [value, dirty, preview])

  const debit = localLines.reduce((s, l) => s + Number(l.debit || 0), 0)
  const credit = localLines.reduce((s, l) => s + Number(l.credit || 0), 0)
  const balanced = Math.abs(debit - credit) < 0.02 && localLines.length >= 2

  const updateLine = (index, patch) => {
    setDirty(true)
    setLocalLines((prev) => {
      const next = prev.map((line, i) => {
        if (i !== index) return line
        const merged = { ...line, ...patch }
        if (patch.accountId) {
          const acct = accounts.find((a) => String(a._id) === String(patch.accountId))
          if (acct) {
            merged.accountCode = acct.code
            merged.accountName = acct.name
            merged.accountNameAr = acct.nameAr || ''
          }
        }
        return merged
      })
      onChange?.(next)
      return next
    })
  }

  const resetToPreview = () => {
    setDirty(false)
    const lines = preview?.lines || []
    setLocalLines(lines)
    onChange?.(lines)
    refetch()
  }

  if (Number(totals.grandTotal || 0) <= 0) {
    return (
      <div className={`${sectionCardClass} !p-3.5`}>
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
          {isAr ? 'قيود اليومية' : 'Journal items'}
        </p>
        <p className="mt-2 text-xs text-slate-400">
          {isAr ? 'أضف بنوداً لإظهار القيود المحاسبية تلقائياً' : 'Add lines to preview accounting entries'}
        </p>
      </div>
    )
  }

  return (
    <div className={`${sectionCardClass} !p-0 overflow-hidden`}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 dark:border-white/5">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            {isAr ? 'قيود اليومية' : 'Journal items'}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {flow === 'purchase'
              ? (isAr ? 'ذمم دائنة / مخزون أو مصروف / ضريبة مدخلات' : 'AP / stock or expense / VAT input')
              : (isAr ? 'ذمم مدينة / إيراد / ضريبة مخرجات' : 'AR / revenue / VAT output')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded-lg px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${
            balanced ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' : 'bg-amber-50 text-amber-700'
          }`}
          >
            {balanced ? (isAr ? 'متوازن' : 'Balanced') : (isAr ? 'غير متوازن' : 'Unbalanced')}
          </span>
          <button
            type="button"
            onClick={resetToPreview}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5"
            title={isAr ? 'إعادة الحساب' : 'Recalculate'}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            {isAr ? 'إعادة' : 'Reset'}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400 dark:border-white/5">
              <th className="px-4 py-2 text-start">{isAr ? 'الحساب' : 'Account'}</th>
              <th className="px-3 py-2 text-start">{isAr ? 'البيان' : 'Label'}</th>
              <th className="px-3 py-2 text-end">{isAr ? 'مدين' : 'Debit'}</th>
              <th className="px-3 py-2 text-end">{isAr ? 'دائن' : 'Credit'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/5">
            {localLines.map((line, index) => (
              <tr key={`${line.role}-${index}`} className="hover:bg-slate-50/60 dark:hover:bg-white/[0.02]">
                <td className="px-4 py-2">
                  <select
                    value={line.accountId || ''}
                    onChange={(e) => updateLine(index, { accountId: e.target.value })}
                    className="w-full max-w-xs rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium dark:border-dark-600 dark:bg-dark-800"
                  >
                    <option value="">{isAr ? 'اختر حساب…' : 'Select account…'}</option>
                    {accounts.map((a) => (
                      <option key={a._id} value={a._id}>
                        {a.code} — {isAr ? (a.nameAr || a.name) : a.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2 text-xs text-slate-600 dark:text-slate-300">
                  {line.description || line.role || '—'}
                </td>
                <td className="px-3 py-2 text-end tabular-nums font-medium">
                  {Number(line.debit || 0) > 0 ? <Money value={line.debit} /> : '—'}
                </td>
                <td className="px-3 py-2 text-end tabular-nums font-medium">
                  {Number(line.credit || 0) > 0 ? <Money value={line.credit} /> : '—'}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-slate-200 bg-slate-50/80 text-xs font-semibold dark:border-dark-600 dark:bg-dark-900/40">
              <td className="px-4 py-2" colSpan={2}>{isAr ? 'الإجمالي' : 'Total'}</td>
              <td className="px-3 py-2 text-end tabular-nums"><Money value={debit} /></td>
              <td className="px-3 py-2 text-end tabular-nums"><Money value={credit} /></td>
            </tr>
          </tfoot>
        </table>
      </div>
      {preview?.error ? (
        <p className="px-4 py-2 text-xs text-amber-700">{preview.error}</p>
      ) : null}
    </div>
  )
}

export function InvoiceDocumentReferencesBar({ references = [], language = 'en' }) {
  const isAr = language === 'ar'
  if (!Array.isArray(references) || !references.length) return null

  const hrefFor = (ref) => {
    if (!ref?.docId) return null
    if (ref.kind === 'sales_order') return `/app/dashboard/sales/orders/${ref.docId}`
    if (ref.kind === 'purchase_order') return `${PURCHASES_PATH.orders}/${ref.docId}`
    if (ref.kind === 'delivery_note') return `/app/dashboard/delivery-notes/${ref.docId}`
    if (ref.kind === 'grn') return `${PURCHASES_PATH.grn}/${ref.docId}`
    return null
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
        <Link2 className="h-3 w-3" />
        {isAr ? 'مراجع' : 'References'}
      </span>
      {references.map((ref, i) => {
        const href = hrefFor(ref)
        const label = ref.label || ref.number || ref.kind
        const chip = (
          <span
            key={`${ref.kind}-${ref.docId || i}`}
            className="inline-flex items-center rounded-lg border border-slate-200/80 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-700 dark:border-dark-600 dark:bg-dark-800 dark:text-slate-200"
          >
            {label}
          </span>
        )
        return href ? (
          <a key={`${ref.kind}-${ref.docId || i}`} href={href} className="hover:opacity-80">
            {chip}
          </a>
        ) : chip
      })}
    </div>
  )
}
