/** Lightweight POS/thermal format check — safe to import on list pages without PDF deps. */
export function isThermalInvoice(invoice) {
  if (invoice?.printFormat === 'thermal') return true
  if (invoice?.printFormat === 'a4') return false
  return ['restaurant', 'bakala', 'saloon', 'laundry', 'khayyat'].includes(invoice?.businessContext)
}
