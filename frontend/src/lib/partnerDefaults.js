import api from './api'

/**
 * Resolve default Accounts Receivable / Payable for partner create flows.
 * Uses first active account of the matching subtype (system chart defaults).
 */
export async function fetchDefaultReceivableAccountId() {
  const rows = await api
    .get('/accounting/accounts', { params: { type: 'asset', subtype: 'receivable' } })
    .then((r) => (Array.isArray(r.data) ? r.data : []))
    .catch(() => [])
  const active = rows.find((a) => a.isActive !== false) || rows[0]
  return active?._id || null
}

export async function fetchDefaultPayableAccountId() {
  const rows = await api
    .get('/accounting/accounts', { params: { type: 'liability', subtype: 'payable' } })
    .then((r) => (Array.isArray(r.data) ? r.data : []))
    .catch(() => [])
  const active = rows.find((a) => a.isActive !== false) || rows[0]
  return active?._id || null
}

/** Saudi VAT: exactly 15 digits (ZATCA). Soft-check for other countries. */
export function validatePartnerVat(vatNumber, countryCode = 'SA') {
  const v = String(vatNumber || '').trim()
  if (!v) return { ok: true }
  if (countryCode === 'SA' || countryCode === 'Saudi Arabia') {
    if (!/^\d{15}$/.test(v)) {
      return { ok: false, message: 'VAT number must be exactly 15 digits', messageAr: 'الرقم الضريبي يجب أن يكون 15 رقمًا' }
    }
  }
  return { ok: true }
}

export function buildFullFormUrl({ role = 'customer', name = '', email = '', phone = '', entity = '', returnTo = '' } = {}) {
  const base = role === 'vendor' ? '/app/dashboard/suppliers/new' : '/app/dashboard/customers/new'
  const params = new URLSearchParams()
  if (name) params.set('name', name)
  if (email) params.set('email', email)
  if (phone) params.set('phone', phone)
  if (entity) params.set('entity', entity)
  if (role) params.set('role', role)
  if (returnTo) params.set('returnTo', returnTo)
  const q = params.toString()
  return q ? `${base}?${q}` : base
}
