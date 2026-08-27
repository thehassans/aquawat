/**
 * Helpers for reverse / return transfers.
 */

export function inventoryPathForOpCode(code) {
  if (code === 'incoming') return 'receipts'
  if (code === 'outgoing') return 'deliveries'
  if (code === 'pos') return 'pos'
  if (code === 'manufacturing') return 'manufacturing'
  return 'internal'
}

/**
 * Prefer WH/…/Returns under the original source warehouse; else original Stock source.
 */
export function defaultReturnDestinationId(transfer, locations = []) {
  const origSrc = transfer?.sourceLocationId
  const origSrcId = typeof origSrc === 'object' ? origSrc?._id : origSrc
  const whId = String(
    (typeof origSrc === 'object' && (origSrc?.warehouseId?._id || origSrc?.warehouseId))
    || '',
  )

  const list = Array.isArray(locations) ? locations : []
  const returnsLoc = list.find((l) => {
    if (l.active === false) return false
    if (l.usage && l.usage !== 'internal') return false
    const path = String(l.completePath || l.name || '').toLowerCase()
    if (!(path.includes('return') || path.includes('مرتجع'))) return false
    if (whId && String(l.warehouseId?._id || l.warehouseId || '') !== whId) return false
    return true
  })

  return returnsLoc?._id || origSrcId || ''
}

/** Physical destinations for returned goods (internal stock / returns). */
export function filterReturnDestLocations(locations, { includeIds = [], warehouseId } = {}) {
  const keep = new Set((includeIds || []).filter(Boolean).map(String))
  const whId = warehouseId ? String(warehouseId) : ''
  return (Array.isArray(locations) ? locations : []).filter((loc) => {
    if (keep.has(String(loc._id))) return true
    if (!loc || loc.active === false) return false
    if (loc.usage !== 'internal') return false
    if (whId && String(loc.warehouseId?._id || loc.warehouseId || '') !== whId) return false
    return true
  })
}
