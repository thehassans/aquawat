/**
 * Delivery Order UI state mapping.
 * Draft → Waiting/Confirmed → Ready → Done
 */

export function toDeliveryUiState(state) {
  if (!state) return 'draft'
  if (state === 'draft') return 'draft'
  if (state === 'waiting' || state === 'confirmed') return 'waiting'
  if (state === 'assigned' || state === 'partiallyAvailable') return 'ready'
  if (state === 'done') return 'done'
  if (state === 'cancelled') return 'cancelled'
  return 'waiting'
}

/** Sum reserved qty from move lines for a move (non-cancelled). */
export function reservedQtyForMove(moveId, moveLines = []) {
  let sum = 0
  for (const ln of moveLines) {
    if (String(ln.moveId) !== String(moveId)) continue
    if (ln.state === 'cancelled') continue
    // After done, reservation is consumed — still show line qty as reserved for history if needed
    sum += Number(ln.quantity || ln.quantityInProductUom || 0)
  }
  return sum
}

export function enrichMovesWithReserved(moves = [], moveLines = []) {
  return moves.map((m) => ({
    ...m,
    reservedQty: reservedQtyForMove(m._id, moveLines),
  }))
}
