import api from '../../../lib/api'

const WALK_IN_NAME = 'Walk-in Customer'
const WALK_IN_NAME_AR = 'عميل نقدي'

/**
 * Resolve (or create) the generic Walk-in Customer for PoS transfers.
 */
export async function ensureWalkInCustomer() {
  try {
    const { customers = [] } = await api.get('/customers', {
      params: { search: 'Walk-in', limit: 10 },
    }).then((r) => r.data || {})
    const hit = (customers || []).find((c) => {
      const n = String(c.name || '').toLowerCase()
      const ar = String(c.nameAr || '')
      return n.includes('walk-in') || n.includes('walk in') || ar.includes('عميل نقدي') || n.includes('cash customer')
    })
    if (hit) return hit
  } catch { /* create below */ }

  try {
    const created = await api.post('/customers', {
      type: 'individual',
      name: WALK_IN_NAME,
      nameAr: WALK_IN_NAME_AR,
      customerCode: 'WALKIN',
      isActive: true,
    }).then((r) => r.data)
    return created
  } catch (e) {
    // Likely duplicate code — search again
    try {
      const rows = await api.get('/customers/search', { params: { q: 'Walk' } }).then((r) => r.data || [])
      if (Array.isArray(rows) && rows[0]) return rows[0]
    } catch { /* ignore */ }
    throw e
  }
}
