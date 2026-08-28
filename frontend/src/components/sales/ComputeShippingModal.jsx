import { useState } from 'react'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import { fieldControlClass, sectionCardClass } from '../../pages/sales/salesUi'

export default function ComputeShippingModal({ open, onClose, orderPayload, onSelectRate }) {
  const [rates, setRates] = useState([])
  const [loading, setLoading] = useState(false)

  const compute = async () => {
    setLoading(true)
    try {
      const { data } = await api.post('/sales/shipping/rates', orderPayload || {})
      setRates(data.rates || [])
      if (!data.rates?.length) toast.error('No rates returned — activate a shipping connector')
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Rate shop failed')
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className={`${sectionCardClass} w-full max-w-lg`}>
        <h3 className="text-lg font-semibold">Compute shipping</h3>
        <p className="mt-1 text-sm text-slate-500">Live rates from active carrier connectors</p>
        <button type="button" className="btn btn-primary btn-sm mt-4" onClick={compute} disabled={loading}>
          {loading ? 'Querying…' : 'Fetch rates'}
        </button>
        <ul className="mt-4 space-y-2">
          {rates.map((r) => (
            <li key={`${r.connectorId}-${r.serviceName}`}>
              <button
                type="button"
                className="flex w-full items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-sm hover:border-teal-600"
                onClick={() => { onSelectRate?.(r); onClose?.() }}
              >
                <span>{r.provider} — {r.serviceName}</span>
                <span className="font-semibold">{r.amount} {r.currency}</span>
              </button>
            </li>
          ))}
        </ul>
        <button type="button" className="btn btn-secondary btn-sm mt-4" onClick={onClose}>Close</button>
      </div>
    </div>
  )
}
