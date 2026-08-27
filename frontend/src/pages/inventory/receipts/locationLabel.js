/**
 * Location path helpers for receipts UI.
 * API returns Odoo-style hierarchical paths like:
 *   Physical Locations/WH-54897/Stock
 * We render clean labels and hide virtual locations from pickers.
 */

const VIRTUAL_USAGES = new Set([
  'view',
  'inventoryLoss',
  'scrap',
  'production',
  'transit',
])

/**
 * Format a completePath into a human-readable breadcrumb label.
 * "Physical Locations/WH-54897/Stock" → "WH-54897 > Stock"
 * Strips leading "Physical Locations" / "Virtual Locations" roots.
 */
export function formatLocationLabel(completePath, fallback = '—') {
  if (!completePath || typeof completePath !== 'string') return fallback
  const parts = completePath
    .split('/')
    .map((p) => p.trim())
    .filter(Boolean)
  if (!parts.length) return fallback

  const root = parts[0].toLowerCase()
  const skipRoot =
    root === 'physical locations'
    || root === 'physical location'
    || root === 'virtual locations'
    || root === 'virtual location'
    || root === 'locations'
    || root === 'المواقع الفعلية'
    || root === 'المواقع الافتراضية'

  const cleaned = skipRoot ? parts.slice(1) : parts
  if (!cleaned.length) return parts[parts.length - 1] || fallback
  return cleaned.join(' > ')
}

/** True for locations that should stay out of the standard receipt location picker. */
export function isVirtualLocation(loc) {
  if (!loc) return true
  if (VIRTUAL_USAGES.has(loc.usage)) return true
  const path = String(loc.completePath || '').toLowerCase()
  return path.startsWith('virtual locations') || path.startsWith('virtual location/')
}

/**
 * Locations shown in receipt Source/Dest pickers.
 * Always keep vendor locations (source) and internal stock (dest).
 * Optionally include a selected id even if it would otherwise be filtered.
 */
export function filterReceiptLocations(locations, { includeIds = [] } = {}) {
  const keep = new Set((includeIds || []).filter(Boolean).map(String))
  return (Array.isArray(locations) ? locations : []).filter((loc) => {
    if (keep.has(String(loc._id))) return true
    if (loc.active === false) return false
    if (loc.usage === 'vendor' || loc.usage === 'customer') return true
    if (loc.usage === 'internal') return true
    return !isVirtualLocation(loc)
  })
}

export function locationOptionLabel(loc, ar = false) {
  if (!loc) return '—'
  if (ar && loc.nameAr) {
    const path = formatLocationLabel(loc.completePath, loc.nameAr)
    return path
  }
  return formatLocationLabel(loc.completePath, loc.name || '—')
}
