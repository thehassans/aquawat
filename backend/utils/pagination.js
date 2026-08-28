/** Global API pagination — cap page size to protect MongoDB and memory. */
export const MAX_PAGE_LIMIT = Math.max(1, Math.min(500, Number(process.env.API_MAX_PAGE_LIMIT || 100)));

export function parsePage(value, fallback = 1) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.floor(n);
}

export function parseLimit(value, fallback = 50) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return Math.min(fallback, MAX_PAGE_LIMIT);
  return Math.min(Math.floor(n), MAX_PAGE_LIMIT);
}

/** Legacy helper — some routes pass custom def/max caps. */
export function clampLimit(value, { def = 50, max = MAX_PAGE_LIMIT } = {}) {
  const cap = Math.min(max, MAX_PAGE_LIMIT);
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return Math.min(def, cap);
  return Math.min(Math.floor(n), cap);
}

export function parsePagination(query = {}, defaults = {}) {
  const page = parsePage(query.page, defaults.page ?? 1);
  const limit = parseLimit(query.limit ?? query.pageSize, defaults.limit ?? 50);
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}
