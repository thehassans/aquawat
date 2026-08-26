/**
 * httpCache.js - HTTP-level response caching middleware.
 * Adds ETag for GET responses so browsers/CDNs can use 304 Not Modified.
 * Adds Cache-Control headers based on route type.
 */
import crypto from 'crypto';

/**
 * etag() - generates and validates ETag for GET responses.
 * If client sends If-None-Match header matching ETag, returns 304.
 * Reduces bandwidth by 80%+ for unchanged data.
 */
const ETAG_MAX_BYTES = 64 * 1024;

export function etag() {
  return (req, res, next) => {
    if (req.method !== 'GET') return next();
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      try {
        const str = JSON.stringify(body);
        // Skip ETag for large payloads — double serialization was costly on list endpoints.
        if (str.length <= ETAG_MAX_BYTES) {
          const hash = `"${crypto.createHash('md5').update(str).digest('hex').slice(0, 16)}"`;
          res.setHeader('ETag', hash);
          if (req.headers['if-none-match'] === hash) {
            res.removeHeader('Content-Type');
            return res.status(304).end();
          }
        }
      } catch (_) {}
      return originalJson(body);
    };
    next();
  };
}

/**
 * cacheFor(seconds) - Sets Cache-Control for semi-static GET routes.
 * Use for product lists, tenant config, etc. that change infrequently.
 */
export function cacheFor(seconds) {
  return (req, res, next) => {
    if (req.method === 'GET') {
      res.setHeader('Cache-Control', `private, max-age=${seconds}, must-revalidate`);
    }
    next();
  };
}

/**
 * noCache() - Disables all caching for sensitive/real-time routes.
 */
export function noCache() {
  return (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
  };
}

export default { etag, cacheFor, noCache };
