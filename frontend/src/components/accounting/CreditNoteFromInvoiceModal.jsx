import { useEffect, useState } from 'react'
import { X } from 'lucide-react'

const ACTIONS = [
  { id: 'partial', en: 'Partial refund', ar: 'استرداد جزئي' },
  { id: 'full', en: 'Full refund', ar: 'استرداد كامل' },
  { id: 'full_and_draft', en: 'Full refund & new draft invoice', ar: 'استرداد كامل وفاتورة مسودة جديدة' },
]

export default function CreditNoteFromInvoiceModal({
  isOpen,
  onClose,
  onSubmit,
  isPending = false,
  invoice,
  language = 'en',
}) {
  const isAr = language === 'ar'
  const [reason, setReason] = useState('')
  const [reversalDate, setReversalDate] = useState('')
  const [useJournalDate, setUseJournalDate] = useState(true)
  const [action, setAction] = useState('full')

  useEffect(() => {
    if (!isOpen) return
    setReason('')
    setReversalDate(new Date().toISOString().slice(0, 10))
    setUseJournalDate(true)
    setAction('full')
  }, [isOpen, invoice?._id])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl dark:bg-dark-800">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {isAr ? 'إشعار دائن' : 'Credit note'}
            </h3>
            <p className="mt-0.5 text-sm text-gray-500">
              {isAr ? 'من الفاتورة' : 'From invoice'} {invoice?.invoiceNumber || ''}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        <label className="label">{isAr ? 'السبب' : 'Reason'}</label>
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

        <div className="mt-5 flex gap-3">
          <button type="button" className="btn btn-secondary flex-1" onClick={onClose}>
            {isAr ? 'إلغاء' : 'Cancel'}
          </button>
          <button
            type="button"
            className="btn btn-primary flex-1"
            disabled={isPending || !reason.trim()}
            onClick={() => onSubmit?.({
              reason: reason.trim(),
              reversalDate: useJournalDate ? null : reversalDate,
              action,
            })}
          >
            {isPending ? (isAr ? 'جارٍ الإنشاء…' : 'Creating…') : (isAr ? 'إنشاء إشعار دائن' : 'Create credit note')}
          </button>
        </div>
      </div>
    </div>
  )
}
