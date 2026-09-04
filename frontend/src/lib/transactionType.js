/**
 * Unify ZATCA B2B / B2C with contact entity type.
 * Company (business) → B2B (standard tax invoice)
 * Individual → B2C (simplified)
 */

export function isBusinessParty(party = {}) {
  const type = String(party?.type || party?.entityType || party?.entity || '').toLowerCase()
  if (type === 'individual' || type === 'person') return false
  if (type === 'business' || type === 'company' || type === 'organization') return true
  if (party?.isCompany === true) return true
  if (party?.isCompany === false) return false
  // Heuristic: VAT or CR usually means company
  const vat = String(party?.vatNumber || party?.taxNumber || '').trim()
  const cr = String(party?.crNumber || party?.commercialRegistration?.crNumber || '').trim()
  if (vat || cr) return true
  return false
}

export function resolveTransactionTypeFromParty(party, fallback = 'B2C') {
  if (!party) return fallback === 'B2B' ? 'B2B' : 'B2C'
  return isBusinessParty(party) ? 'B2B' : 'B2C'
}

export function invoiceTypeCodeForTransaction(txn) {
  return txn === 'B2B' ? '0100000' : '0200000'
}
