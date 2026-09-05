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

/** Saudi VAT: 15 digits, first and last must be 3 (ZATCA). Soft-check for other countries. */
export function validatePartnerVat(vatNumber, countryCode = 'SA') {
  const v = String(vatNumber || '').trim()
  if (!v) return { ok: true }
  if (countryCode === 'SA' || countryCode === 'Saudi Arabia') {
    // Keep in sync with frontend/src/lib/saudiVat.js and backend/utils/saudiVat.js
    const digits = v
      .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
      .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06F0))
      .replace(/\D/g, '')
    if (!/^3\d{13}3$/.test(digits)) {
      return {
        ok: false,
        message: 'VAT number must be 15 digits and start/end with 3',
        messageAr: 'الرقم الضريبي يجب أن يكون 15 رقماً ويبدأ وينتهي بـ 3',
      }
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
