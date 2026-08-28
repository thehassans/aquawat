/** Normalize API payloads that may be a raw array or paginated { items, data, rows }. */
export function asArray(value) {
  if (Array.isArray(value)) return value
  if (value && Array.isArray(value.items)) return value.items
  if (value && Array.isArray(value.data)) return value.data
  if (value && Array.isArray(value.rows)) return value.rows
  return []
}
