import React, { useState } from 'react'
import {
  CreditCard,
  Building2,
  Calendar,
  FileText,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Receipt,
  Eye,
  Sparkles,
  Plus
} from 'lucide-react'
import Money from '../ui/Money'
import ReceiptLightboxModal from './ReceiptLightboxModal'

const METHOD_LABELS = {
  transfer: { en: 'Bank Transfer', ar: 'حوالة بنكية', badge: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300' },
  cash: { en: 'Cash', ar: 'نقدي', badge: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' },
  card: { en: 'Card / Mada', ar: 'بطاقة مدى / ائتمان', badge: 'bg-purple-50 text-purple-700 dark:bg-purple-500/10 dark:text-purple-300' },
  check: { en: 'Bank Cheque', ar: 'شيك مصرفي', badge: 'bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300' },
}

export default function PurchasePaymentsLedger({ order, isAr, onOpenRecordPayment }) {
  const [lightboxUrl, setLightboxUrl] = useState(null)
  const [lightboxTitle, setLightboxTitle] = useState('')

  if (!order) return null

  const payments = order.payments || []
  const grandTotal = Number(order.grandTotal || 0)
  const paidAmount = Number(order.paidAmount || 0)
  const balanceDue = Math.max(0, Math.round((order.balanceDue != null ? Number(order.balanceDue) : (grandTotal - paidAmount)) * 100) / 100)
  const isCleared = balanceDue <= 0 && grandTotal > 0

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
            <Receipt className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-[14px] font-semibold text-slate-950 dark:text-white">
              {isAr ? 'سجل الدفعات والمستندات المالية' : 'Payment & Settlement History'}
            </h3>
            <p className="text-[11px] text-slate-400">
              {isAr ? 'الدفعات المحولة للمورد وإيصالات التحويل البنكي' : 'Recorded vendor payments and transaction screenshots'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isCleared ? (
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 ring-1 ring-inset ring-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>{isAr ? 'تم السداد بالكامل (Cleared)' : 'Fully Paid / Cleared'}</span>
            </span>
          ) : (
            <button
              type="button"
              onClick={onOpenRecordPayment}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-md shadow-emerald-600/20 transition hover:bg-emerald-700 active:scale-95"
            >
              <CreditCard className="h-3.5 w-3.5" />
              <span>{isAr ? 'تسجيل دفعة جديدة' : 'Record Payment'}</span>
            </button>
          )}
        </div>
      </div>

      {payments.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center dark:border-white/10 dark:bg-white/[0.01]">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400 mb-2">
            <CreditCard className="h-5 w-5" />
          </div>
          <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
            {isAr ? 'لم يتم تسجيل أي دفعات لهذا الطلب بعد' : 'No payments recorded for this PO yet'}
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {isAr
              ? `المبلغ المستحق القائم: ${balanceDue.toFixed(2)} SAR`
              : `Total outstanding balance: ${balanceDue.toFixed(2)} SAR`}
          </p>
          <button
            type="button"
            onClick={onOpenRecordPayment}
            className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 transition dark:bg-white dark:text-slate-900 dark:hover:bg-emerald-300"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>{isAr ? 'تسجيل أول دفعة' : 'Record First Payment'}</span>
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-100 dark:border-white/[0.08] bg-white dark:bg-[#0c111a]">
          <table className="w-full text-start text-xs">
            <thead className="bg-slate-50/80 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:bg-white/[0.03]">
              <tr>
                <th className="px-3.5 py-2.5 text-start w-10">#</th>
                <th className="px-3.5 py-2.5 text-start">{isAr ? 'تاريخ الدفعة' : 'Payment Date'}</th>
                <th className="px-3.5 py-2.5 text-start">{isAr ? 'طريقة الدفع' : 'Method'}</th>
                <th className="px-3.5 py-2.5 text-start">{isAr ? 'سند الصرف / المرجع' : 'Voucher / Reference'}</th>
                <th className="px-3.5 py-2.5 text-center">{isAr ? 'مستند / إيصال التحويل' : 'Receipt / Screenshot'}</th>
                <th className="px-3.5 py-2.5 text-start">{isAr ? 'الأثر المحاسبي / ملاحظات' : 'Accounting & Notes'}</th>
                <th className="px-3.5 py-2.5 text-end">{isAr ? 'مبلغ الدفعة' : 'Amount Paid'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
              {payments.map((p, idx) => {
                const methodInfo = METHOD_LABELS[p.method] || METHOD_LABELS.transfer
                const isCash = p.method === 'cash'
                return (
                  <tr key={idx} className="hover:bg-slate-50/60 dark:hover:bg-white/[0.02]">
                    <td className="px-3.5 py-3 font-mono text-[11px] text-slate-400">{idx + 1}</td>
                    <td className="px-3.5 py-3 font-medium text-slate-900 dark:text-white">
                      {p.date ? new Date(p.date).toLocaleDateString(isAr ? 'ar-SA' : 'en-GB') : '—'}
                    </td>
                    <td className="px-3.5 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${methodInfo.badge}`}>
                        {isAr ? methodInfo.ar : methodInfo.en}
                      </span>
                    </td>
                    <td className="px-3.5 py-3 font-mono font-semibold text-slate-700 dark:text-slate-300">
                      <div>
                        {p.voucherNumber && (
                          <span className="inline-flex rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-700 dark:bg-white/10 dark:text-slate-300 me-1.5">
                            {p.voucherNumber}
                          </span>
                        )}
                        <span>{p.reference || (p.voucherNumber ? '' : '—')}</span>
                      </div>
                    </td>
                    <td className="px-3.5 py-3 text-center">
                      {p.receiptUrl ? (
                        <button
                          type="button"
                          onClick={() => {
                            setLightboxUrl(p.receiptUrl)
                            setLightboxTitle(p.receiptName || (isAr ? `إيصال دفعة - ${p.reference || p.voucherNumber || order.poNumber}` : `Payment Receipt - ${p.reference || p.voucherNumber || order.poNumber}`))
                          }}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-teal-200 bg-teal-50/70 px-2.5 py-1 text-[11px] font-bold text-teal-800 transition hover:bg-teal-100 dark:border-teal-500/30 dark:bg-teal-500/10 dark:text-teal-300"
                        >
                          <ImageIcon className="h-3 w-3 text-teal-600 dark:text-teal-400" />
                          <span>{isAr ? 'عرض الإيصال' : 'View Receipt'}</span>
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-3.5 py-3 text-[11px] max-w-xs">
                      <div className="flex flex-col gap-0.5">
                        <span className="inline-flex items-center gap-1 font-mono text-[10px] text-emerald-700 dark:text-emerald-400">
                          <span className="font-bold">Dr: 2000 AP</span> | <span className="font-bold">Cr: {isCash ? '1000' : '1100'}</span>
                        </span>
                        {p.notes && <span className="text-slate-500 dark:text-slate-400 truncate">{p.notes}</span>}
                      </div>
                    </td>
                    <td className="px-3.5 py-3 text-end font-bold text-emerald-600 dark:text-emerald-400 tabular-nums text-xs">
                      <Money value={p.amount} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot className="border-t border-slate-200 bg-slate-50/60 dark:border-white/10 dark:bg-white/[0.02] font-bold">
              <tr>
                <td colSpan={6} className="px-3.5 py-2.5 text-end text-[11px] text-slate-500 uppercase">
                  {isAr ? 'إجمالي المدفوع حتى الآن:' : 'Total Paid So Far:'}
                </td>
                <td className="px-3.5 py-2.5 text-end text-emerald-600 dark:text-emerald-400 tabular-nums">
                  <Money value={paidAmount} />
                </td>
              </tr>
              {paidAmount > grandTotal && (
                <tr className="bg-amber-50/50 dark:bg-amber-500/10 text-amber-900 dark:text-amber-300">
                  <td colSpan={6} className="px-3.5 py-2 text-end text-[11px] uppercase font-bold">
                    {isAr ? 'رصيد دفعة مقدمة للمورد (Advance Credit):' : 'Supplier Advance Credit Balance:'}
                  </td>
                  <td className="px-3.5 py-2 text-end font-mono font-bold tabular-nums">
                    <Money value={paidAmount - grandTotal} />
                  </td>
                </tr>
              )}
            </tfoot>
          </table>
        </div>
      )}

      {/* Lightbox Modal */}
      <ReceiptLightboxModal
        isOpen={Boolean(lightboxUrl)}
        onClose={() => setLightboxUrl(null)}
        url={lightboxUrl}
        title={lightboxTitle}
        isAr={isAr}
      />
    </div>
  )
}
