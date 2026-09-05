import InvoicePurchaseComposer from '../../../components/invoices/InvoicePurchaseComposer'

/** Vendors → Bills → New bill (never a refund). */
export default function VendorBillCreatePage() {
  return <InvoicePurchaseComposer mode="bill" />
}
