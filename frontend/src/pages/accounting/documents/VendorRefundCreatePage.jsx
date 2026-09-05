import InvoicePurchaseComposer from '../../components/invoices/InvoicePurchaseComposer'

/** Vendors → Refunds → New refund (requires original bill). */
export default function VendorRefundCreatePage() {
  return <InvoicePurchaseComposer mode="refund" />
}
