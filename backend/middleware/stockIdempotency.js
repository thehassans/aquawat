import InvIdempotencyKey from '../models/inventory/InvIdempotencyKey.js';

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Replay cached responses when clients send Idempotency-Key on stock mutations.
 * Mount after auth on /api/stock.
 */
export function stockIdempotency() {
  return async function stockIdempotencyMiddleware(req, res, next) {
    if (!MUTATING.has(req.method)) return next();
    const key = req.get('Idempotency-Key') || req.get('idempotency-key');
    if (!key || !req.user?.tenantId) return next();

    const tenantId = req.user.tenantId;
    const path = req.originalUrl || req.url;

    try {
      const existing = await InvIdempotencyKey.findOne({ tenantId, key }).lean();
      if (existing) {
        res.setHeader('Idempotency-Replayed', 'true');
        return res.status(existing.statusCode).json(existing.body);
      }
    } catch (err) {
      console.warn('[idempotency] lookup', err.message);
    }

    const originalJson = res.json.bind(res);
    res.json = function idempotentJson(body) {
      const statusCode = res.statusCode || 200;
      if (statusCode >= 200 && statusCode < 500) {
        InvIdempotencyKey.findOneAndUpdate(
          { tenantId, key },
          {
            $setOnInsert: {
              tenantId,
              key,
              method: req.method,
              path,
              statusCode,
              body,
              expiresAt: new Date(Date.now() + TTL_MS),
              createdBy: req.user._id,
            },
          },
          { upsert: true },
        ).catch((e) => console.warn('[idempotency] save', e.message));
      }
      return originalJson(body);
    };

    return next();
  };
}
