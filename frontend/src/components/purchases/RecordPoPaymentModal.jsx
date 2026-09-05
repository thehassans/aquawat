import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  CreditCard,
  Building2,
  Calendar,
  DollarSign,
  UploadCloud,
  FileText,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Trash2,
  Sparkles,
  Banknote,
  ArrowRight
} from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import Money from '../ui/Money'
import { handleNegativeCashPaymentError, runLiquidityPreflight } from '../../lib/negativeCashBalance'

export default function RecordPoPaymentModal({ isOpen, onClose, order, isAr, onSuccess }) {
  const fileInputRef = useRef(null)

  const grandTotal = Number(order?.grandTotal || 0)
  const paidAmount = Number(order?.paidAmount || 0)
  const balanceDue = Math.max(0, Math.round((order?.balanceDue != null ? Number(order.balanceDue) : (grandTotal - paidAmount)) * 100) / 100)
  const hasVendorBill = Boolean(order?.billedInvoiceId)

  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0])
  const [method, setMethod] = useState('transfer')
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [receiptFile, setReceiptFile] = useState(null)
  const [receiptPreview, setReceiptPreview] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [asAdvance, setAsAdvance] = useState(false)

  useEffect(() => {
    if (isOpen && order) {
      // Default amount to remaining balance if > 0
      setAmount(balanceDue > 0 ? String(balanceDue) : '')
      setDate(new Date().toISOString().split('T')[0])
      setMethod('transfer')
      setReference('')
      setNotes('')
      setReceiptFile(null)
      setReceiptPreview(null)
      setAsAdvance(false)
    }
  }, [isOpen, order, balanceDue])

  // Handle receipt file selection
  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 15 * 1024 * 1024) {
      toast.error(isAr ? 'حجم الملف يتجاوز 15 ميجابايت' : 'File size exceeds 15MB')
      return
    }

    setReceiptFile(file)
    if (file.type.startsWith('image/')) {
      const previewUrl = URL.createObjectURL(file)
      setReceiptPreview(previewUrl)
    } else {
      setReceiptPreview(null)
    }
  }

  const handleRemoveReceipt = () => {
    setReceiptFile(null)
    if (receiptPreview) {
      URL.revokeObjectURL(receiptPreview)
      setReceiptPreview(null)
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const numAmount = Math.round(Number(amount || 0) * 100) / 100
    if (numAmount <= 0) {
      toast.error(isAr ? 'يرجى إدخال مبلغ دفع صالح' : 'Please enter a valid payment amount')
      return
    }

    if (!hasVendorBill && !asAdvance) {
      toast.error(
        isAr
          ? 'أنشئ فاتورة مورد أولاً، أو فعّل "دفعة مقدمة للمورد"'
          : 'Create a vendor bill first, or enable “Advance to supplier”',
      )
      return
    }

    setIsSubmitting(true)
    try {
      const pre = await runLiquidityPreflight(api, { amount: numAmount, method }, isAr)
      if (!pre.ok) {
        setIsSubmitting(false)
        return
      }

      const formData = new FormData()
      formData.append('amount', String(numAmount))
      formData.append('date', date)
      formData.append('method', method)
      formData.append('reference', reference.trim())
      formData.append('notes', notes.trim())
      if (pre.confirmNegativeCash) {
        formData.append('confirmNegativeCash', 'true')
      }
      if (!hasVendorBill && asAdvance) {
        formData.append('asAdvance', 'true')
      }
      if (receiptFile) {
        formData.append('receipt', receiptFile)
      }

      await api.post(`/purchase-orders/${order._id}/payment`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })

      toast.success(isAr ? 'تم تسجيل الدفعة بنجاح' : 'Payment recorded successfully')
      if (onSuccess) onSuccess()
      onClose()
    } catch (err) {
      const handled = handleNegativeCashPaymentError(err, isAr)
      if (handled.handled && handled.retry) {
        try {
          const formData = new FormData()
          formData.append('amount', String(numAmount))
          formData.append('date', date)
          formData.append('method', method)
          formData.append('reference', reference.trim())
          formData.append('notes', notes.trim())
          formData.append('confirmNegativeCash', 'true')
          if (!hasVendorBill && asAdvance) {
            formData.append('asAdvance', 'true')
          }
          if (receiptFile) {
            formData.append('receipt', receiptFile)
          }
          await api.post(`/purchase-orders/${order._id}/payment`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          })
          toast.success(isAr ? 'تم تسجيل الدفعة بنجاح' : 'Payment recorded successfully')
          if (onSuccess) onSuccess()
          onClose()
          return
        } catch (retryErr) {
          toast.error(retryErr.response?.data?.error || (isAr ? 'فشل تسجيل الدفعة' : 'Failed to record payment'))
          return
        }
      }
      if (handled.handled) return
      toast.error(err.response?.data?.error || (isAr ? 'فشل تسجيل الدفعة' : 'Failed to record payment'))
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen || !order) return null

  const supplierName = isAr
    ? order.supplierId?.nameAr || order.supplierId?.nameEn || '—'
    : order.supplierId?.nameEn || order.supplierId?.nameAr || '—'

  const enteredAmount = Number(amount || 0)
  const isOverpayment = enteredAmount > balanceDue && balanceDue > 0
  const advanceAmount = Math.max(0, Math.round((enteredAmount - balanceDue) * 100) / 100)
  const accountCodeMap = {
    transfer: { code: '1100', nameEn: 'Bank Accounts', nameAr: 'الحسابات البنكية' },
    cash: { code: '1000', nameEn: 'Cash on Hand', nameAr: 'النقدية بالصندوق' },
    card: { code: '1100', nameEn: 'Bank / POS Terminal', nameAr: 'الحساب البنكي / شبكة' },
    check: { code: '1100', nameEn: 'Bank Cheque Clearing', nameAr: 'شيكات صادرة / البنك' },
  }
  const selectedCashAccount = accountCodeMap[method] || accountCodeMap.transfer

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4 backdrop-blur-md overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          className="relative w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl dark:bg-[#111827] border border-gray-100 dark:border-white/10 space-y-5 my-6 max-h-[92vh] overflow-y-auto"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-100 pb-4 dark:border-white/10">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                <CreditCard className="h-5 w-5" />
              </span>
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white">
                  {isAr ? 'تسجيل دفعة مورد' : 'Record Supplier Payment'}
                </h3>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  {order.poNumber} {supplierName !== '—' ? `• ${supplierName}` : ''}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/10 dark:hover:text-gray-200"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Ultra-Clean Financial Summary Cards */}
          <div className="grid grid-cols-3 gap-2 rounded-2xl bg-slate-50 p-3 text-center dark:bg-white/[0.03] border border-slate-100 dark:border-white/5">
            <div>
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {isAr ? 'إجمالي الطلب' : 'Grand Total'}
              </span>
              <span className="text-sm font-bold text-slate-900 dark:text-white tabular-nums">
                <Money value={grandTotal} />
              </span>
            </div>
            <div>
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {isAr ? 'المدفوع سابقاً' : 'Already Paid'}
              </span>
              <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                <Money value={paidAmount} />
              </span>
            </div>
            <div className="border-s border-slate-200/60 dark:border-white/10">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {grandTotal - paidAmount < 0
                  ? (isAr ? 'رصيد دائن (-)' : 'Advance (-)')
                  : (isAr ? 'المتبقي للسداد' : 'Balance Due')}
              </span>
              <span className={`text-sm font-black tabular-nums ${
                grandTotal - paidAmount > 0
                  ? 'text-rose-600 dark:text-rose-400'
                  : grandTotal - paidAmount < 0
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-emerald-600 dark:text-emerald-400'
              }`}>
                <Money value={Math.round((grandTotal - paidAmount) * 100) / 100} />
              </span>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            {/* Amount with 1-Click Pay Full Balance */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="font-bold text-slate-700 dark:text-slate-200">
                  {isAr ? 'مبلغ الدفعة' : 'Payment Amount'} *
                </label>
                {balanceDue > 0 && (
                  <button
                    type="button"
                    onClick={() => setAmount(String(balanceDue))}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:underline dark:text-emerald-400"
                  >
                    <Sparkles className="h-3 w-3" />
                    <span>
                      {isAr ? `سداد كامل المتبقي (${balanceDue.toFixed(2)} SAR)` : `Pay Full Balance (${balanceDue.toFixed(2)} SAR)`}
                    </span>
                  </button>
                )}
              </div>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  required
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-bold text-slate-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-white/10 dark:bg-[#0c111a] dark:text-white tabular-nums"
                />
                <span className="absolute end-3.5 top-3 text-[11px] font-bold text-slate-400">
                  {order.currency || 'SAR'}
                </span>
              </div>
            </div>

            {/* Date & Method */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                  {isAr ? 'تاريخ الدفعة' : 'Payment Date'} *
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-white/10 dark:bg-[#0c111a] dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                  {isAr ? 'طريقة الدفع' : 'Payment Method'} *
                </label>
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-white/10 dark:bg-[#0c111a] dark:text-white"
                >
                  <option value="transfer">{isAr ? 'حوالة بنكية' : 'Bank Transfer'}</option>
                  <option value="cash">{isAr ? 'نقدي' : 'Cash'}</option>
                  <option value="card">{isAr ? 'بطاقة مدى / ائتمان' : 'Card / Mada'}</option>
                  <option value="check">{isAr ? 'شيك مصرفي' : 'Bank Cheque'}</option>
                </select>
              </div>
            </div>

            {/* Reference */}
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                {isAr ? 'رقم المرجع / الحوالة / الشيك (اختياري)' : 'Reference / Transfer No / Cheque (Optional)'}
              </label>
              <input
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder={isAr ? 'مثال: TRX-98412 أو رقم الشيك' : 'e.g. TRX-98412 or Cheque #'}
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-800 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-white/10 dark:bg-[#0c111a] dark:text-white"
              />
            </div>

            {/* Transaction Screenshot / Receipt Upload */}
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                {isAr ? 'لقطة شاشة للتحويل / إيصال السداد (اختياري)' : 'Transaction Screenshot / Receipt (Optional)'}
              </label>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf"
                onChange={handleFileChange}
                className="hidden"
              />

              {receiptFile ? (
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/50 p-3 dark:border-emerald-500/20 dark:bg-emerald-500/10">
                  <div className="flex items-center gap-3 min-w-0">
                    {receiptPreview ? (
                      <img
                        src={receiptPreview}
                        alt="Receipt preview"
                        className="h-12 w-12 rounded-xl object-cover border border-emerald-300 dark:border-emerald-500/40 shrink-0"
                      />
                    ) : (
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 shrink-0">
                        <FileText className="h-5 w-5" />
                      </span>
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-slate-900 dark:text-white">
                        {receiptFile.name}
                      </p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">
                        {(receiptFile.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleRemoveReceipt}
                    className="rounded-xl p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition shrink-0"
                    title={isAr ? 'حذف الملف' : 'Remove file'}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 p-4 text-center cursor-pointer hover:border-emerald-500 hover:bg-emerald-50/30 transition dark:border-white/10 dark:hover:border-emerald-500/40 dark:hover:bg-emerald-500/5"
                >
                  <UploadCloud className="h-6 w-6 text-slate-400 group-hover:text-emerald-500 mb-1" />
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                    {isAr ? 'انقر لرفع إيصال التحويل أو اسحب الصورة هنا' : 'Click to upload receipt or drag screenshot here'}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    PNG, JPG, JPEG, WEBP, PDF (Max 15MB)
                  </p>
                </div>
              )}
            </div>

            {!hasVendorBill ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-3 dark:border-amber-500/30 dark:bg-amber-500/10 space-y-2">
                <p className="text-xs font-semibold text-amber-900 dark:text-amber-200">
                  {isAr
                    ? 'لا توجد فاتورة مورد مرحّلة لهذا الطلب. الدفع على الذمم الدائنة (2000) غير مسموح بدون فاتورة.'
                    : 'No posted vendor bill on this PO. Paying Accounts Payable (2000) without a bill is blocked.'}
                </p>
                <label className="flex items-start gap-2 text-xs text-amber-900 dark:text-amber-100 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={asAdvance}
                    onChange={(e) => setAsAdvance(e.target.checked)}
                    className="mt-0.5 rounded border-amber-300"
                  />
                  <span>
                    {isAr
                      ? 'تسجيل كدفعة مقدمة للمورد (مدين 1290) — وليس تخفيض الذمم الدائنة'
                      : 'Record as Advance to supplier (Dr 1290) — do not debit Accounts Payable'}
                  </span>
                </label>
              </div>
            ) : (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 px-3 py-2 text-[11px] font-medium text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
                {isAr ? 'سيتم تسجيل الدفعة على فاتورة المورد (مدين ذمم دائنة)' : 'Payment will settle the vendor bill (Dr Accounts Payable)'}
              </div>
            )}

            {/* Notes */}
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                {isAr ? 'ملاحظات إضافية' : 'Notes / Memo'}
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={isAr ? 'أي تفاصيل أو ملاحظات حول الدفعة...' : 'Any details or notes regarding this payment...'}
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-800 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-white/10 dark:bg-[#0c111a] dark:text-white"
              />
            </div>

            {/* Double-Entry Ledger Preview (Debit / Credit) */}
            {enteredAmount > 0 && (
              <div className="rounded-2xl border border-teal-100 bg-gradient-to-br from-teal-50/50 via-white to-slate-50/50 p-3.5 dark:border-teal-500/20 dark:bg-white/[0.02] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-teal-800 dark:text-teal-300">
                    <Sparkles className="h-3 w-3" />
                    {isAr ? 'الأثر المحاسبي التلقائي (قيد اليومية وسند الصرف)' : 'Double-Entry Accounting & Ledger Impact'}
                  </span>
                  <span className="font-mono text-[10px] font-bold text-slate-500">
                    {enteredAmount.toFixed(2)} SAR
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  {/* Debit Line */}
                  <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/50 p-2.5 dark:border-emerald-500/20 dark:bg-emerald-500/5">
                    <div className="flex items-center justify-between text-emerald-800 dark:text-emerald-300 font-bold">
                      <span>{isAr ? 'مدين (Debit Dr.)' : 'Debit (Dr.)'}</span>
                      <span className="font-mono tabular-nums">+{enteredAmount.toFixed(2)}</span>
                    </div>
                    <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5 text-[11px]">
                      {!hasVendorBill && asAdvance
                        ? `1290 • ${isAr ? 'دفعات مقدمة للموردين' : 'Advance to Suppliers'}`
                        : `2000 • ${isAr ? 'الذمم الدائنة للمورد' : 'Accounts Payable (AP)'}`}
                    </p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">
                      {!hasVendorBill && asAdvance
                        ? (isAr ? 'أصل — دفعة مقدمة' : 'Asset — supplier prepayment')
                        : (isAr ? 'تخفيض التزام المورد' : 'Reduces vendor liability')}
                    </p>
                  </div>

                  {/* Credit Line */}
                  <div className="rounded-xl border border-blue-200/80 bg-blue-50/50 p-2.5 dark:border-blue-500/20 dark:bg-blue-500/5">
                    <div className="flex items-center justify-between text-blue-800 dark:text-blue-300 font-bold">
                      <span>{isAr ? 'دائن (Credit Cr.)' : 'Credit (Cr.)'}</span>
                      <span className="font-mono tabular-nums">-{enteredAmount.toFixed(2)}</span>
                    </div>
                    <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5 text-[11px]">
                      {selectedCashAccount.code} • {isAr ? selectedCashAccount.nameAr : selectedCashAccount.nameEn}
                    </p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">
                      {isAr ? 'صرف أموال من الحساب' : 'Disbursed from account'}
                    </p>
                  </div>
                </div>

                {isOverpayment && (
                  <div className="flex items-center gap-2 rounded-xl bg-amber-50 px-2.5 py-1.5 text-[11px] font-semibold text-amber-800 ring-1 ring-inset ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/20">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    <span>
                      {isAr
                        ? `سيتم قيد الفائض (${advanceAmount.toFixed(2)} SAR) كرصيد دفع مقدم للمورد في كشف حسابه.`
                        : `Excess payment (${advanceAmount.toFixed(2)} SAR) will be recorded as supplier advance credit.`}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 border-t border-gray-100 pt-4 dark:border-white/10">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !amount || Number(amount) <= 0}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-emerald-600/20 transition hover:bg-emerald-700 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                <span>{isAr ? 'حفظ وتأكيد الدفعة' : 'Save & Confirm Payment'}</span>
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
