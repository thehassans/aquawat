import { useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import Money from '../ui/Money'

const ACTIONS = [
  { id: 'partial', en: 'Partial refund', ar: 'استرداد جزئي' },
  { id: 'full', en: 'Full refund', ar: 'استرداد كامل' },
  { id: 'full_and_draft', en: 'Full refund & new draft invoice', ar: 'استرداد كامل وفاتورة مسودة جديدة' },
]

const REASON_PRESETS = [
  { id: 'return', en: 'Goods returned', ar: 'إرجاع بضاعة' },
  { id: 'damage', en: 'Damaged goods', ar: 'بضاعة تالفة' },
  { id: 'price_correction', en: 'Price correction', ar: 'تصحيح سعر' },
  { id: 'partial_refund', en: 'Partial refund', ar: 'استرداد جزئي' },
  { id: 'full_refund', en: 'Full refund', ar: 'استرداد كامل' },
  { id: 'other', en: 'Other', ar: 'أخرى' },
]

export default function CreditNoteFromInvoiceModal({
  isOpen,
  onClose,
  onSubmit,
  isPending = false,
  invoice,
  language = 'en',
  title,
  documentLabelEn = 'invoice',
  documentLabelAr = 'الفاتورة',
  createLabelEn = 'Create credit note',
  createLabelAr = 'إنشاء إشعار دائن',
  allowPartialLines = false,
}) {
  const isAr = language === 'ar'
  const [reasonPreset, setReasonPreset] = useState('return')
  const [reason, setReason] = useState('')
  const [reversalDate, setReversalDate] = useState('')
  const [useJournalDate, setUseJournalDate] = useState(true)
  const [action, setAction] = useState('full')
  const [refundQtyByLine, setRefundQtyByLine] = useState({})

  const sourceLines = useMemo(
    () => (Array.isArray(invoice?.lineItems) ? invoice.lineItems : []).filter((line) => Math.abs(Number(line.quantity || 0)) > 0),
    [invoice?.lineItems],
  )

  useEffect(() => {
    if (!isOpen) return
    setReasonPreset('return')
    setReason(isAr ? REASON_PRESETS[0].ar : REASON_PRESETS[0].en)
    setReversalDate(new Date().toISOString().slice(0, 10))
    setUseJournalDate(true)
    setAction('full')
    const next = {}
    for (const line of sourceLines) {
      const key = String(line.lineNumber || line._id || line.productId || '')
      next[key] = Math.abs(Number(line.quantity || 0))
    }
    setRefundQtyByLine(next)
  }, [isOpen, invoice?._id, sourceLines, isAr])

  if (!isOpen) return null

  const buildRefundLines = () => sourceLines
    .map((line, index) => {
      const key = String(line.lineNumber || line._id || line.productId || index)
      const maxQty = Math.abs(Number(line.quantity || 0))
      const qty = Math.min(maxQty, Math.abs(Number(refundQtyByLine[key] || 0)))
      if (qty <= 0) return null
      return {
        lineNumber: line.lineNumber || index + 1,
        productId: line.productId || undefined,
        quantity: qty,
      }
    })
    .filter(Boolean)

  const handleSubmit = () => {
    const payload = {
      reason: reason.trim(),
      creditNoteType: reasonPreset,
      reversalDate: useJournalDate ? null : reversalDate,
      action,
    }
    if (action === 'partial' && allowPartialLines) {
      payload.refundLines = buildRefundLines()
    }
    onSubmit?.(payload)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl dark:bg-dark-800">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {title || (isAr ? 'إشعار دائن' : 'Credit note')}
            </h3>
            <p className="mt-0.5 text-sm text-gray-500">
              {isAr ? `من ${documentLabelAr}` : `From ${documentLabelEn}`} {invoice?.invoiceNumber || ''}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        <label className="label">{isAr ? 'نوع السبب' : 'Reason type'}</label>
        <select
          value={reasonPreset}
          onChange={(e) => {
            const id = e.target.value
            setReasonPreset(id)
            const preset = REASON_PRESETS.find((r) => r.id === id)
            if (preset) setReason(isAr ? preset.ar : preset.en)
          }}
          className="input"
        >
          {REASON_PRESETS.map((r) => (
            <option key={r.id} value={r.id}>{isAr ? r.ar : r.en}</option>
          ))}
        </select>

        <label className="label mt-3">{isAr ? 'السبب (مطلوب)' : 'Reason (required)'}</label>
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="input"
          placeholder={isAr ? 'مثال: بضاعة تالفة' : 'e.g. Damaged goods'}
        />

        <div className="mt-4 space-y-2">
          <label className="label">{isAr ? 'تاريخ العكس' : 'Reversal date'}</label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              checked={useJournalDate}
              onChange={() => setUseJournalDate(true)}
            />
            {isAr ? 'تاريخ قيد اليومية' : 'Journal entry date'}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              checked={!useJournalDate}
              onChange={() => setUseJournalDate(false)}
            />
            {isAr ? 'تاريخ محدد' : 'Specific date'}
          </label>
          {!useJournalDate ? (
            <input
              type="date"
              value={reversalDate}
              onChange={(e) => setReversalDate(e.target.value)}
              className="input"
            />
          ) : null}
        </div>

        <fieldset className="mt-4 space-y-2">
          <legend className="label">{isAr ? 'الإجراء' : 'Action'}</legend>
          {ACTIONS.map((opt) => (
            <label key={opt.id} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="cnAction"
                checked={action === opt.id}
                onChange={() => setAction(opt.id)}
              />
              {isAr ? opt.ar : opt.en}
            </label>
          ))}
        </fieldset>

        {action === 'partial' && allowPartialLines && sourceLines.length ? (
          <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 dark:border-dark-600">
            <table className="w-full min-w-[420px] text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:border-dark-600">
                  <th className="px-3 py-2 text-start">{isAr ? 'البند' : 'Line'}</th>
                  <th className="px-3 py-2 text-end">{isAr ? 'الأصل' : 'Original'}</th>
                  <th className="px-3 py-2 text-end">{isAr ? 'استرداد' : 'Refund qty'}</th>
                </tr>
              </thead>
              <tbody>
                {sourceLines.map((line, index) => {
                  const key = String(line.lineNumber || line._id || line.productId || index)
                  const maxQty = Math.abs(Number(line.quantity || 0))
                  return (
                    <tr key={key} className="border-b border-slate-50 dark:border-dark-700">
                      <td className="px-3 py-2">{line.productName || line.description || `#${index + 1}`}</td>
                      <td className="px-3 py-2 text-end tabular-nums">{maxQty}</td>
                      <td className="px-3 py-2 text-end">
                        <input
                          type="number"
                          min="0"
                          max={maxQty}
                          step="any"
                          value={refundQtyByLine[key] ?? 0}
                          onChange={(e) => setRefundQtyByLine((prev) => ({
                            ...prev,
                            [key]: Math.min(maxQty, Math.max(0, Number(e.target.value || 0))),
                          }))}
                          className="input !w-24 !py-1 text-end tabular-nums"
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td className="px-3 py-2 text-xs text-slate-500" colSpan={3}>
                    {isAr ? 'إجمالي الاسترداد:' : 'Refund total:'}{' '}
                    <Money
                      value={sourceLines.reduce((sum, line, index) => {
                        const key = String(line.lineNumber || line._id || line.productId || index)
                        const qty = Math.min(
                          Math.abs(Number(line.quantity || 0)),
                          Math.abs(Number(refundQtyByLine[key] || 0)),
                        )
                        const unit = Number(line.unitPrice || 0)
                        const taxRate = Number(line.taxRate || 0)
                        const net = qty * unit
                        return sum + net + (net * taxRate / 100)
                      }, 0)}
                    />
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : null}

        <div className="mt-5 flex gap-3">
          <button type="button" className="btn btn-secondary flex-1" onClick={onClose}>
            {isAr ? 'إلغاء' : 'Cancel'}
          </button>
          <button
            type="button"
            className="btn btn-primary flex-1"
            disabled={isPending || !reason.trim() || (action === 'partial' && allowPartialLines && !buildRefundLines().length)}
            onClick={handleSubmit}
          >
            {isPending ? (isAr ? 'جارٍ الإنشاء…' : 'Creating…') : (isAr ? createLabelAr : createLabelEn)}
          </button>
        </div>
      </div>
    </div>
  )
}
