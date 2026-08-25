import rateLimit from 'express-rate-limit';
import { makeRateLimitStore } from '../utils/hybridRateLimitStore.js';

/**
 * Per-tenant limiter for expensive inventory endpoints
 * (exports, scheduler, integrity, heavy reports).
 */
export const stockHeavyLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.STOCK_HEAVY_RATE_MAX || 30),
  standardHeaders: true,
  legacyHeaders: false,
  store: makeRateLimitStore('stock-heavy'),
  keyGenerator: (req) => `stock-heavy:${req.user?.tenantId || req.ip || 'unknown'}`,
  message: {
    error: 'Too many inventory heavy requests — try again shortly',
    code: 'RATE_LIMIT',
  },
});
