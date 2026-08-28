import { useState } from 'react'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import { fieldControlClass, ghostActionClass, sectionCardClass } from '../../pages/sales/salesUi'

export default function ApplyPromoPanel({ subtotal = 0, onApplyDiscountLine }) {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)

  const apply = async () => {
    if (!code.trim()) return
    setLoading(true)
    try {
      const { data } = await api.post('/sales/promotions/apply', { code: code.trim(), subtotal })
      onApplyDiscountLine?.(data.discountLine, data)
      toast.success(`Applied: ${data.name} (−${data.discountAmount.toFixed(2)})`)
      setCode('')
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Invalid promo')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={`${sectionCardClass} !py-2.5 flex flex-wrap items-end gap-2`}>
      <div className="min-w-[180px] flex-1">
        <label className="mb-1 block text-xs font-semibold text-slate-600">Promo / coupon</label>
        <input
          className={fieldControlClass}
          placeholder="Enter code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && apply()}
        />
      </div>
      <button type="button" className={ghostActionClass} onClick={apply} disabled={loading}>
        Apply
      </button>
    </div>
  )
}
