import CreditNoteFromInvoiceModal from './CreditNoteFromInvoiceModal'

/** Vendor refund (AP credit note) modal — same workflow as customer credit notes. */
export default function VendorRefundFromBillModal(props) {
  const isAr = props.language === 'ar'
  return (
    <CreditNoteFromInvoiceModal
      {...props}
      allowPartialLines
      title={isAr ? 'مرتجع مورد' : 'Vendor refund'}
      documentLabelEn="bill"
      documentLabelAr="فاتورة المورد"
      createLabelEn="Create refund"
      createLabelAr="إنشاء مرتجع"
    />
  )
}
