/**
 * Shared Redis-backed helpers for ZATCA rate limiting / circuit breaker.
 * Falls back to in-memory when Redis is unavailable.
 */
import { cacheGet, cacheSet, isRedisReady } from '../lib/redis.js';

export async function redisGetJson(key) {
  if (!isRedisReady()) return null;
  return cacheGet(key);
}

export async function redisSetJson(key, value, ttlSeconds) {
  if (!isRedisReady()) return false;
  await cacheSet(key, value, ttlSeconds);
  return true;
}
