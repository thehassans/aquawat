export function computePurchaseLineTotals(lineItems = []) {
  const items = Array.isArray(lineItems) ? lineItems : []
  let subtotal = 0
  let totalTax = 0

  items.forEach((li) => {
    const qty = Number(li?.quantityOrdered ?? li?.quantity ?? 0)
    const unit = Number(li?.unitCost ?? 0)
    const taxRate = Number(li?.taxRate ?? 15)
    const safeQty = Number.isFinite(qty) ? qty : 0
    const safeUnit = Number.isFinite(unit) ? unit : 0
    const safeRate = Number.isFinite(taxRate) ? taxRate : 15
    const lineSubtotal = safeQty * safeUnit
    const lineTax = lineSubtotal * (safeRate / 100)
    subtotal += lineSubtotal
    totalTax += lineTax
  })

  return { subtotal, totalTax, grandTotal: subtotal + totalTax }
}
