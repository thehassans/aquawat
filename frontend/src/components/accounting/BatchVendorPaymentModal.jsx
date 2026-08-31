import { useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import Money from '../ui/Money'
import { canRegisterPaymentOnBill, invoiceRemainingBalance } from '../../lib/accountingDocumentStatus'

const METHODS = [
  { id: 'bank_transfer', en: 'Bank transfer', ar: 'تحويل بنكي' },
  { id: 'cheque', en: 'Check', ar: 'شيك' },
  { id: 'cash', en: 'Cash', ar: 'نقداً' },
  { id: 'card', en: 'Card', ar: 'بطاقة' },
]

/**
 * Pay multiple open vendor bills in one action (same method / memo / date).
 */
export default function BatchVendorPaymentModal({
  isOpen,
  onClose,
  onSubmit,
  isPending = false,
  bills = [],
  language = 'en',
}) {
  const isAr = language === 'ar'
  const payable = useMemo(
    () => (Array.isArray(bills) ? bills : []).filter((b) => canRegisterPaymentOnBill(b)),
    [bills],
  )
  const [method, setMethod] = useState('bank_transfer')
  const [memo, setMemo] = useState('')
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 10))

  useEffect(() => {
    if (!isOpen) return
    setMethod('bank_transfer')
    setMemo('')
    setPaymentDate(new Date().toISOString().slice(0, 10))
  }, [isOpen])

  const total = useMemo(
    () => payable.reduce((s, b) => s + invoiceRemainingBalance(b), 0),
    [payable],
  )

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl dark:bg-dark-800">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {isAr ? 'دفعة جماعية للموردين' : 'Batch vendor payment'}
            </h3>
            <p className="mt-0.5 text-sm text-gray-500">
              {isAr ? `${payable.length} فاتورة · الإجمالي ` : `${payable.length} bills · total `}
              <Money value={total} />
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-4 max-h-40 space-y-1 overflow-y-auto rounded-xl border border-slate-100 p-3 text-sm dark:border-white/10">
          {payable.map((b) => (
            <div key={b._id} className="flex items-center justify-between gap-2">
              <span className="truncate font-medium">{b.invoiceNumber}</span>
              <span className="tabular-nums text-slate-600 dark:text-slate-300">
                <Money value={invoiceRemainingBalance(b)} />
              </span>
            </div>
          ))}
          {!payable.length ? (
            <p className="text-slate-400">{isAr ? 'لا فواتير قابلة للدفع' : 'No payable bills'}</p>
          ) : null}
        </div>

        <div className="space-y-3">
          <div>
            <label className="label">{isAr ? 'التاريخ' : 'Date'}</label>
            <input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} className="input" />
          </div>
          <div>
            <label className="label">{isAr ? 'الطريقة' : 'Method'}</label>
            <select value={method} onChange={(e) => setMethod(e.target.value)} className="select">
              {METHODS.map((m) => (
                <option key={m.id} value={m.id}>{isAr ? m.ar : m.en}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">{isAr ? 'مذكرة' : 'Memo'}</label>
            <input value={memo} onChange={(e) => setMemo(e.target.value)} className="input" />
          </div>
        </div>

        <div className="mt-5 flex gap-3">
          <button type="button" className="btn btn-secondary flex-1" onClick={onClose}>
            {isAr ? 'إلغاء' : 'Cancel'}
          </button>
          <button
            type="button"
            className="btn btn-primary flex-1"
            disabled={isPending || !payable.length}
            onClick={() => onSubmit?.({
              method,
              memo,
              paymentDate,
              bills: payable.map((b) => ({
                invoiceId: b._id,
                amount: invoiceRemainingBalance(b),
              })),
            })}
          >
            {isPending
              ? (isAr ? 'جارٍ التسجيل…' : 'Recording…')
              : (isAr ? `تسجيل ${payable.length} دفعات` : `Record ${payable.length} payments`)}
          </button>
        </div>
      </div>
    </div>
  )
}
