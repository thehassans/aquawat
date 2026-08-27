/**
 * Manufacturing transfer UI state: Draft → Ready → Done
 * (Waiting/Confirmed collapse into Ready for the simplified stepper.)
 */
export function toManufacturingUiState(state) {
  if (!state) return 'draft'
  if (state === 'draft') return 'draft'
  if (state === 'done') return 'done'
  if (state === 'cancelled') return 'cancelled'
  // waiting | confirmed | assigned | partiallyAvailable → Ready
  return 'ready'
}
