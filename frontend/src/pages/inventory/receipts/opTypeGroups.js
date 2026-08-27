/**
 * Group incoming operation types by warehouse so the dropdown
 * shows "WH-54897: Receipts" instead of many identical "Receipts" rows.
 */

function warehouseKey(ot) {
  const wh = ot?.warehouseId
  if (!wh) return 'unknown'
  if (typeof wh === 'object') return String(wh._id || wh.id || 'unknown')
  return String(wh)
}

function warehouseLabel(ot, warehousesById, ar = false) {
  const wh = ot?.warehouseId
  if (wh && typeof wh === 'object') {
    const code = wh.code || ''
    const name = ar && wh.nameAr ? wh.nameAr : (wh.nameEn || wh.name || '')
    if (code && name) return `${code}: ${name}`
    return code || name || 'Warehouse'
  }
  const id = warehouseKey(ot)
  const found = warehousesById?.get?.(id)
  if (found) {
    const code = found.code || ''
    const name = ar && found.nameAr ? found.nameAr : (found.nameEn || found.name || '')
    if (code && name) return `${code}`
    return code || name || id.slice(-6)
  }
  return id === 'unknown' ? '—' : id.slice(-6)
}

/**
 * @returns {{ warehouseId: string, warehouseLabel: string, options: object[] }[]}
 */
export function groupOperationTypesByWarehouse(opTypes, warehouses = [], ar = false) {
  const warehousesById = new Map(
    (Array.isArray(warehouses) ? warehouses : []).map((w) => [String(w._id), w]),
  )
  const groups = new Map()

  for (const ot of Array.isArray(opTypes) ? opTypes : []) {
    const key = warehouseKey(ot)
    if (!groups.has(key)) {
      groups.set(key, {
        warehouseId: key,
        warehouseLabel: warehouseLabel(ot, warehousesById, ar),
        options: [],
      })
    }
    groups.get(key).options.push(ot)
  }

  return [...groups.values()].sort((a, b) =>
    String(a.warehouseLabel).localeCompare(String(b.warehouseLabel)),
  )
}

/** Label for a single option inside an optgroup, e.g. "Receipts". */
export function operationTypeOptionLabel(ot, ar = false) {
  if (!ot) return '—'
  return (ar && ot.nameAr ? ot.nameAr : ot.name) || 'Receipts'
}

/**
 * Map backend transfer.state → receipt UI state used by the action bar.
 * draft | waiting | ready | done | cancelled
 */
export function toReceiptUiState(state) {
  if (!state) return 'draft'
  if (state === 'draft') return 'draft'
  if (state === 'waiting') return 'waiting'
  if (state === 'done') return 'done'
  if (state === 'cancelled') return 'cancelled'
  // confirmed | assigned | partiallyAvailable → Ready
  return 'ready'
}
