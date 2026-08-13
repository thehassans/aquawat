import { isAllowedWebOrigin, originFromRequest } from '../utils/allowedOrigins.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * CSRF guard for cookie-authenticated mutating requests.
 * Bearer Authorization is not CSRF-vulnerable (custom header).
 * Native clients with no Origin/Referer are allowed (same as CORS).
 * Browsers always send Origin on cross-site POST — those must match FRONTEND_URL.
 */
export function csrfCookieGuard(req, res, next) {
  if (SAFE_METHODS.has(String(req.method || '').toUpperCase())) return next();
  if (String(req.headers.authorization || '').startsWith('Bearer')) return next();
  if (!req.cookies?.maqder_token) return next();

  const origin = originFromRequest(req);
  if (!origin) return next();
  if (!isAllowedWebOrigin(origin)) {
    return res.status(403).json({ error: 'CSRF origin check failed' });
  }
  return next();
}

export default { csrfCookieGuard };
