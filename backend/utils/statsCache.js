import { cacheAside } from '../lib/redis.js';

export const STATS_CACHE_TTL_SECONDS = 90;
export const STATS_STALE_TTL_SECONDS = 300;

export function statsCacheKey(namespace, req, suffix = '') {
  const tenantId = req.tenant?._id
    || req.tenantFilter?.tenantId
    || req.user?.tenantId
    || 'unknown';
  const extra = suffix ? `:${suffix}` : '';
  return `stats:${namespace}:v1:${tenantId}${extra}`;
}

/**
 * Redis cache-aside wrapper for dashboard/stat endpoints (per-tenant).
 */
export async function cachedTenantStats(req, namespace, fetchFn, options = {}) {
  const suffix = options.querySuffix ?? '';
  const ttl = options.ttlSeconds ?? STATS_CACHE_TTL_SECONDS;
  const staleTtl = options.staleTtlSeconds ?? STATS_STALE_TTL_SECONDS;
  const key = statsCacheKey(namespace, req, suffix);
  return cacheAside(key, ttl, fetchFn, {
    staleTtlSeconds: staleTtl,
    fetchTimeoutMs: options.fetchTimeoutMs ?? 12_000,
  });
}
