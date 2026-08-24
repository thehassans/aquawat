const TERMINAL = new Set(['done', 'cancel']);

/**
 * Compute picking state from its moves (non-cancelled moves considered).
 * @param {Array<{ state: string }>} moves
 */
export function computePickingState(moves) {
  const active = (moves || []).filter((m) => m.state !== 'cancel');
  if (active.length === 0) return 'cancel';
  if (active.every((m) => m.state === 'draft')) return 'draft';
  if (active.every((m) => TERMINAL.has(m.state)) && active.some((m) => m.state === 'done')) return 'done';
  if (active.every((m) => m.state === 'assigned')) return 'assigned';
  if (active.some((m) => m.state === 'waiting')) return 'waiting';
  if (active.some((m) => ['confirmed', 'partially_available'].includes(m.state))) return 'confirmed';
  return 'confirmed';
}

/**
 * After move state change, derive move picking contribution.
 */
export function isMoveReserved(state) {
  return state === 'assigned' || state === 'partially_available';
}
