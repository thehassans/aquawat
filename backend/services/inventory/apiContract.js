/**
 * §3.3 response helpers — list/record/error envelopes.
 * Dual-shape lists: `{ data, _meta }` + legacy `{ items, total }`.
 */

import { InventoryError, toErrorBody } from './errors.js';

export function ok(data, extra = {}) {
  return { data, ...extra };
}

export function listEnvelope(items, {
  total = items?.length || 0,
  page,
  pageSize,
  appliedFilters = {},
  nextCursor = null,
  links = {},
  totals,
} = {}) {
  return {
    data: items,
    _meta: {
      total,
      ...(page != null ? { page } : {}),
      ...(pageSize != null ? { pageSize } : {}),
      appliedFilters,
      ...(nextCursor ? { nextCursor } : {}),
      ...(totals != null ? { totals } : {}),
    },
    ...(Object.keys(links).length ? { _links: links } : {}),
  };
}

/**
 * Dual-shape list response for Express.
 */
export function sendList(res, items, {
  total = items?.length || 0,
  page,
  pageSize,
  appliedFilters = {},
  nextCursor = null,
  links = {},
  totals,
  status = 200,
} = {}) {
  const env = listEnvelope(items, {
    total,
    page,
    pageSize,
    appliedFilters,
    nextCursor,
    links,
    totals,
  });
  return res.status(status).json({
    ...env,
    items,
    total: env._meta.total,
    ...(page != null ? { page } : {}),
    ...(pageSize != null ? { limit: pageSize } : {}),
  });
}

export function sendRecord(res, data, { status = 200 } = {}) {
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    return res.status(status).json({ data, ...data });
  }
  return res.status(status).json({ data });
}

export function sendInvError(res, err) {
  if (err instanceof InventoryError) {
    return res.status(err.status || 400).json({ error: toErrorBody(err) });
  }
  if (err?.name === 'ZodError') {
    const details = (err.issues || []).map((i) => ({
      path: (i.path || []).join('.'),
      message: i.message,
      code: i.code,
    }));
    return res.status(400).json({
      error: {
        code: 'VALIDATION',
        message: details[0]?.message || 'Invalid request body',
        messageAr: 'بيانات الطلب غير صالحة',
        field: details[0]?.path || undefined,
        details,
      },
    });
  }
  console.error('[inventory]', err);
  return res.status(500).json({
    error: {
      code: 'INTERNAL',
      message: err?.message || 'Inventory error',
      messageAr: 'خطأ داخلي في المخزون',
    },
  });
}
