/**
 * Escape user input for MongoDB RegExp search.
 * @param {string} q
 */
export function escapeRegex(q) {
  return String(q || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Build tenant-scoped stock search filters (pickings, templates, locations).
 * @param {object} tenantFilter - e.g. { tenantId: ObjectId }
 * @param {string} q
 */
export function buildStockSearchFilters(tenantFilter, q) {
  const trimmed = String(q || '').trim();
  if (trimmed.length < 2) {
    return { pickings: null, templates: null, locations: null };
  }
  const re = new RegExp(escapeRegex(trimmed), 'i');
  return {
    pickings: { ...tenantFilter, name: re },
    templates: {
      ...tenantFilter,
      $or: [{ name: re }, { defaultCode: re }, { barcode: re }],
    },
    locations: {
      ...tenantFilter,
      $or: [{ name: re }, { completeName: re }],
    },
  };
}

/**
 * Contract: every stock collection query MUST spread tenantFilter.
 */
export function stockQueryIncludesTenant(baseFilter, tenantId) {
  return String(baseFilter.tenantId) === String(tenantId);
}
