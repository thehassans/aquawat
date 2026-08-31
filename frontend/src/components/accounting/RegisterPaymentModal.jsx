import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { X, Printer } from 'lucide-react'
import api from '../../lib/api'
import Money from '../ui/Money'
import { invoiceRemainingBalance } from '../../lib/accountingDocumentStatus'
import { printVendorCheck } from '../../lib/vendorApTools'

const METHODS = [
  { id: 'bank_transfer', en: 'Bank transfer', ar: 'تحويل بنكي' },
  { id: 'cheque', en: 'Check', ar: 'شيك' },
  { id: 'cash', en: 'Cash', ar: 'نقداً' },
  { id: 'card', en: 'Card', ar: 'بطاقة' },
  { id: 'other', en: 'Other', ar: 'أخرى' },
]

export default function RegisterPaymentModal({
  isOpen,
  onClose,
  onSubmit,
  isPending = false,
  invoice,
  language = 'en',
  title,
}) {
  const isAr = language === 'ar'
  const remaining = invoiceRemainingBalance(invoice)
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('bank_transfer')
  const [memo, setMemo] = useState('')
  const [differenceMode, setDifferenceMode] = useState('keep_open')
  const [differenceAccountId, setDifferenceAccountId] = useState('')

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounting-accounts-active'],
    queryFn: () => api.get('/accounting/accounts').then((r) => r.data || []),
    enabled: isOpen,
    staleTime: 60_000,
  })

  useEffect(() => {
    if (!isOpen) return
    setAmount(remaining > 0 ? remaining.toFixed(2) : '')
    setMethod('bank_transfer')
    setMemo('')
    setDifferenceMode('keep_open')
    setDifferenceAccountId('')
  }, [isOpen, remaining, invoice?._id])

  const numericAmount = Number(amount)
  const difference = useMemo(() => {
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) return 0
    return Math.round((remaining - numericAmount) * 100) / 100
  }, [numericAmount, remaining])

  const showDifference = difference > 0.005 && numericAmount < remaining - 0.005

  if (!isOpen) return null

  const handleSubmit = () => {
    onSubmit?.({
      amount: numericAmount,
      method,
      memo,
      differenceMode: showDifference ? differenceMode : 'keep_open',
      differenceAccountId: showDifference && differenceMode === 'mark_paid' ? differenceAccountId : undefined,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl dark:bg-dark-800">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {title || (isAr ? 'تسجيل دفعة' : 'Register payment')}
            </h3>
            {invoice?.invoiceNumber ? (
              <p className="mt-0.5 text-sm text-gray-500">{invoice.invoiceNumber}</p>
            ) : null}
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="text-sm text-gray-500">
          {isAr ? 'المتبقي' : 'Remaining'}: <span className="font-semibold text-gray-900 dark:text-white"><Money value={remaining} /></span>
        </p>

        <label className="label mt-4">{isAr ? 'المبلغ' : 'Amount'}</label>
        <input
          type="number"
          min="0.01"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="input"
        />

        <label className="label mt-3">{isAr ? 'طريقة الدفع' : 'Payment method'}</label>
        <select value={method} onChange={(e) => setMethod(e.target.value)} className="select">
          {METHODS.map((m) => (
            <option key={m.id} value={m.id}>{isAr ? m.ar : m.en}</option>
          ))}
        </select>

        <label className="label mt-3">{isAr ? 'مرجع / مذكرة' : 'Memo / reference'}</label>
        <input
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          className="input"
          placeholder={isAr ? 'رقم الشيك أو معرف المعاملة' : 'Check number or transaction ID'}
        />

        {showDifference ? (
          <div className="mt-4 space-y-3 rounded-xl border border-amber-200 bg-amber-50/80 p-3 dark:border-amber-900/40 dark:bg-amber-950/20">
            <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
              {isAr ? `فرق الدفع: ${difference.toFixed(2)}` : `Payment difference: ${difference.toFixed(2)}`}
            </p>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="differenceMode"
                  checked={differenceMode === 'keep_open'}
                  onChange={() => setDifferenceMode('keep_open')}
                />
                {isAr ? 'إبقاء المبلغ مفتوحاً' : 'Keep open'}
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="differenceMode"
                  checked={differenceMode === 'mark_paid'}
                  onChange={() => setDifferenceMode('mark_paid')}
                />
                {isAr ? 'اعتبارها مدفوعة بالكامل (شطب الفرق)' : 'Mark as fully paid (write off difference)'}
              </label>
            </div>
            {differenceMode === 'mark_paid' ? (
              <>
                <label className="label">{isAr ? 'ترحيل الفرق إلى' : 'Post difference to'}</label>
                <select
                  value={differenceAccountId}
                  onChange={(e) => setDifferenceAccountId(e.target.value)}
                  className="select"
                >
                  <option value="">{isAr ? 'اختر حساباً…' : 'Select account…'}</option>
                  {accounts.map((acc) => (
                    <option key={acc._id} value={acc._id}>
                      {acc.code} — {isAr ? (acc.nameAr || acc.name) : acc.name}
                    </option>
                  ))}
                </select>
              </>
            ) : null}
          </div>
        ) : null}

        <div className="mt-5 flex flex-wrap gap-3">
          {method === 'cheque' && invoice?.flow === 'purchase' ? (
            <button
              type="button"
              className="btn btn-secondary inline-flex items-center gap-2"
              onClick={async () => {
                try {
                  await printVendorCheck({
                    payeeName: invoice?.seller?.name || invoice?.seller?.nameAr,
                    amount: numericAmount,
                    currency: invoice?.currency || 'SAR',
                    memo: memo || invoice?.invoiceNumber,
                    paymentDate: new Date().toISOString().slice(0, 10),
                  })
                } catch (err) {
                  window.alert(err.message || 'Check print failed')
                }
              }}
            >
              <Printer className="h-4 w-4" />
              {isAr ? 'طباعة الشيك' : 'Print check'}
            </button>
          ) : null}
          <button type="button" className="btn btn-secondary flex-1" onClick={onClose}>
            {isAr ? 'إلغاء' : 'Cancel'}
          </button>
          <button
            type="button"
            className="btn btn-primary flex-1"
            disabled={isPending || !Number.isFinite(numericAmount) || numericAmount <= 0}
            onClick={handleSubmit}
          >
            {isPending ? (isAr ? 'جارٍ الإنشاء…' : 'Creating…') : (isAr ? 'إنشاء الدفعة' : 'Create payment')}
          </button>
        </div>
      </div>
    </div>
  )
}
