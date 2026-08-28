import { useState } from 'react'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import { fieldControlClass, fieldLabelClass, sectionCardClass } from '../../pages/sales/salesUi'

/**
 * Down payment modal — creates draft invoice with virtual down-payment product.
 */
export default function DownPaymentModal({ open, onClose, purchaseOrderId, grandTotal = 0, language = 'en', onCreated }) {
  const isAr = language === 'ar'
  const [mode, setMode] = useState('percent')
  const [value, setValue] = useState(30)
  const [loading, setLoading] = useState(false)

  if (!open) return null

  const amount = mode === 'percent'
    ? (Number(grandTotal) * Number(value)) / 100
    : Number(value)

  const submit = async () => {
    setLoading(true)
    try {
      const { data } = await api.post(`/purchase-orders/${purchaseOrderId}/down-payment-invoice`, {
        percent: mode === 'percent' ? Number(value) : 0,
        amount: mode === 'fixed' ? Number(value) : amount,
      })
      toast.success(isAr ? 'تم إنشاء فاتورة الدفعة المقدمة' : 'Down payment invoice created')
      onCreated?.(data)
      onClose?.()
    } catch (e) {
      toast.error(e?.response?.data?.error || e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className={`${sectionCardClass} w-full max-w-md space-y-4`}>
        <h3 className="text-lg font-semibold">{isAr ? 'دفعة مقدمة' : 'Down payment'}</h3>
        <div>
          <label className={fieldLabelClass}>{isAr ? 'النوع' : 'Type'}</label>
          <select className={fieldControlClass} value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="percent">{isAr ? 'نسبة مئوية' : 'Percentage'}</option>
            <option value="fixed">{isAr ? 'مبلغ ثابت' : 'Fixed amount'}</option>
          </select>
        </div>
        <div>
          <label className={fieldLabelClass}>{mode === 'percent' ? (isAr ? 'النسبة %' : 'Percent %') : (isAr ? 'المبلغ' : 'Amount')}</label>
          <input type="number" min={0} className={fieldControlClass} value={value} onChange={(e) => setValue(e.target.value)} />
        </div>
        <p className="text-sm text-slate-500">
          {isAr ? 'المبلغ المحسوب' : 'Calculated amount'}: <strong>{amount.toFixed(2)}</strong>
        </p>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>{isAr ? 'إلغاء' : 'Cancel'}</button>
          <button type="button" className="btn btn-primary btn-sm" onClick={submit} disabled={loading || !purchaseOrderId}>
            {loading ? '…' : (isAr ? 'إنشاء فاتورة' : 'Create invoice')}
          </button>
        </div>
      </div>
    </div>
  )
}
