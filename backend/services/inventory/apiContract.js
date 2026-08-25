/**
 * §3.3 response helpers — list/record/error envelopes.
 * Existing `{ items }` responses remain valid; prefer these for new surfaces.
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
} = {}) {
  return {
    data: items,
    _meta: {
      total,
      ...(page != null ? { page } : {}),
      ...(pageSize != null ? { pageSize } : {}),
      appliedFilters,
      ...(nextCursor ? { nextCursor } : {}),
    },
    ...(Object.keys(links).length ? { _links: links } : {}),
  };
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
