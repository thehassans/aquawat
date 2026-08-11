/**
 * lib/redis.js — Shared Redis client singleton.
 *
 * All modules that need Redis (rate limiters, cache, pub/sub) import from here
 * so we maintain a single connection pool rather than per-route connections.
 *
 * Redis is OPTIONAL — if REDIS_URL is not set the client emits a warning but
 * the app keeps running without it (in-memory fallback for rate limiting).
 */

import Redis from 'ioredis';
import logger from '../utils/logger.js';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const REDIS_ENABLED = process.env.REDIS_ENABLED !== 'false'; // default enabled

let redisClient = null;
let isRedisAvailable = false;

const createRedisClient = () => {
  if (!REDIS_ENABLED) {
    logger.info('[Redis] Disabled via REDIS_ENABLED=false — using in-memory fallback');
    return null;
  }

  const client = new Redis(REDIS_URL, {
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    connectTimeout: 3000,
    lazyConnect: true,
    retryStrategy: (times) => {
      if (times > 3) {
        logger.warn('[Redis] Could not connect after 3 attempts — disabling Redis');
        isRedisAvailable = false;
        return null; // stop retrying
      }
      return Math.min(times * 500, 2000);
    },
  });

  client.on('connect', () => {
    isRedisAvailable = true;
    logger.info('[Redis] Connected');
  });

  client.on('ready', () => {
    isRedisAvailable = true;
  });

  client.on('error', (err) => {
    if (isRedisAvailable) {
      logger.warn('[Redis] Connection error — falling back to in-memory:', err.message);
      isRedisAvailable = false;
    }
  });

  client.on('close', () => {
    isRedisAvailable = false;
  });

  // Try to connect (non-blocking — won't crash server if Redis is down)
  client.connect().catch((err) => {
    logger.warn('[Redis] Initial connect failed — running without Redis cache:', err.message);
    isRedisAvailable = false;
  });

  return client;
};

// Singleton
redisClient = createRedisClient();

export const getRedisClient = () => redisClient;
export const isRedisReady = () => isRedisAvailable && redisClient !== null;

/**
 * Simple get/set cache helper with JSON serialization.
 * Returns null if Redis is unavailable (graceful degradation).
 */
export async function cacheGet(key) {
  if (!isRedisReady()) return null;
  try {
    const val = await redisClient.get(key);
    return val ? JSON.parse(val) : null;
  } catch {
    return null;
  }
}

export async function cacheSet(key, value, ttlSeconds = 60) {
  if (!isRedisReady()) return;
  try {
    await redisClient.setex(key, ttlSeconds, JSON.stringify(value));
  } catch {
    // non-fatal
  }
}

/** SET key NX EX ttl — returns true if this caller acquired the lock. */
export async function cacheSetNx(key, value, ttlSeconds = 60) {
  if (!isRedisReady()) return false;
  try {
    const result = await redisClient.set(key, JSON.stringify(value), 'EX', ttlSeconds, 'NX');
    return result === 'OK';
  } catch {
    return false;
  }
}

export async function cacheDel(key) {
  if (!isRedisReady()) return;
  try {
    await redisClient.del(key);
  } catch {
    // non-fatal
  }
}

/**
 * Cache-aside pattern: fetch from cache, fallback to fetchFn, repopulate.
 */
export async function cacheAside(key, ttlSeconds, fetchFn) {
  const cached = await cacheGet(key);
  if (cached !== null) return cached;
  const data = await fetchFn();
  if (data !== null && data !== undefined) {
    await cacheSet(key, data, ttlSeconds);
  }
  return data;
}

export default redisClient;
