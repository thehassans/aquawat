/** Normalize inventory list API payloads (bare array or { data|items }). */
export function asInvList(payload) {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.data)) return payload.data
  if (Array.isArray(payload?.items)) return payload.items
  return []
}

export function asInvListMeta(payload, fallback = {}) {
  if (payload?._meta) return { ...fallback, ...payload._meta }
  return {
    total: Array.isArray(payload) ? payload.length : (payload?.total ?? fallback.total ?? 0),
    page: payload?.page ?? fallback.page,
    pageSize: payload?.limit ?? payload?.pageSize ?? fallback.pageSize,
  }
}
