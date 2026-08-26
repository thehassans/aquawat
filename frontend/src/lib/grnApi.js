/** Normalize GRN list API — supports legacy array and paginated `{ grns }` payloads. */
export function normalizeGrnList(payload) {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.grns)) return payload.grns
  return []
}
