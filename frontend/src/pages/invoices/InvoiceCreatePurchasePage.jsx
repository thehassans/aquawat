import { Navigate, useSearchParams } from 'react-router-dom'

/**
 * Legacy /invoices/new/purchase → bills/new or vendor-refunds/new.
 * Preserves poId / partnerId; strips refund= into the refund route.
 */
export default function InvoiceCreatePurchasePage() {
  const [params] = useSearchParams()
  const refund = ['1', 'true', 'refund', '381'].includes(String(params.get('refund') || '').toLowerCase())
  const next = new URLSearchParams(params)
  next.delete('refund')
  if (refund) {
    const original = String(params.get('originalInvoiceId') || params.get('billId') || '').trim()
    if (original) next.set('originalInvoiceId', original)
    const q = next.toString()
    return <Navigate to={`/app/dashboard/accounting/vendor-refunds/new${q ? `?${q}` : ''}`} replace />
  }
  const q = next.toString()
  return <Navigate to={`/app/dashboard/accounting/bills/new${q ? `?${q}` : ''}`} replace />
}
