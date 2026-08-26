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
const REDIS_OP_TIMEOUT_MS = Math.max(200, Number(process.env.REDIS_OP_TIMEOUT_MS || 800));

let redisClient = null;
let isRedisAvailable = false;

const withRedisTimeout = async (promise, fallback = null) => {
  try {
    return await Promise.race([
      promise,
      new Promise((resolve) => setTimeout(() => resolve(fallback), REDIS_OP_TIMEOUT_MS)),
    ]);
  } catch {
    return fallback;
  }
};

const createRedisClient = () => {
  if (!REDIS_ENABLED) {
    logger.info('[Redis] Disabled via REDIS_ENABLED=false — using in-memory fallback');
    return null;
  }

  const client = new Redis(REDIS_URL, {
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    connectTimeout: 3000,
    commandTimeout: REDIS_OP_TIMEOUT_MS,
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
    const val = await withRedisTimeout(redisClient.get(key));
    return val ? JSON.parse(val) : null;
  } catch {
    return null;
  }
}

export async function cacheSet(key, value, ttlSeconds = 60) {
  if (!isRedisReady()) return;
  try {
    await withRedisTimeout(
      redisClient.setex(key, ttlSeconds, JSON.stringify(value)),
      undefined
    );
  } catch {
    // non-fatal
  }
}

/** SET key NX EX ttl — returns true if this caller acquired the lock. */
export async function cacheSetNx(key, value, ttlSeconds = 60) {
  if (!isRedisReady()) return false;
  try {
    const result = await withRedisTimeout(
      redisClient.set(key, JSON.stringify(value), 'EX', ttlSeconds, 'NX'),
      null
    );
    return result === 'OK';
  } catch {
    return false;
  }
}

export async function cacheDel(key) {
  if (!isRedisReady()) return;
  try {
    await withRedisTimeout(redisClient.del(key), undefined);
  } catch {
    // non-fatal
  }
}

export async function cacheDelPrefix(prefix) {
  if (!isRedisReady() || !prefix) return 0;
  try {
    let cursor = '0';
    let deleted = 0;
    do {
      const [next, keys] = await withRedisTimeout(
        redisClient.scan(cursor, 'MATCH', `${prefix}*`, 'COUNT', 100),
        ['0', []]
      );
      cursor = next;
      if (keys?.length) {
        deleted += await withRedisTimeout(redisClient.del(...keys), 0);
      }
    } while (cursor !== '0');
    return deleted;
  } catch {
    return 0;
  }
}

const inflight = new Map();

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Cache-aside with single-flight + stale-while-revalidate.
 * - Returns fresh Redis hit immediately.
 * - On miss, serves `:stale` bucket while one worker recomputes (others don't pile up).
 * - fetchFn is capped so a slow Mongo query can't block the pool indefinitely.
 */
export async function cacheAside(key, ttlSeconds, fetchFn, options = {}) {
  const staleTtl = options.staleTtlSeconds ?? Math.max(ttlSeconds * 3, 120);
  const fetchTimeoutMs = options.fetchTimeoutMs ?? Math.min(20_000, Math.max(8000, ttlSeconds * 200));
  const staleKey = `${key}:stale`;

  const cached = await cacheGet(key);
  if (cached !== null) return cached;

  const stale = await cacheGet(staleKey);

  const existing = inflight.get(key);
  if (existing) {
    if (stale !== null) return stale;
    return existing;
  }

  const run = (async () => {
    const lockKey = `lock:${key}`;
    const lockTtl = Math.min(30, Math.max(8, Number(ttlSeconds) || 60));
    const acquired = await cacheSetNx(lockKey, { at: Date.now() }, lockTtl);

    if (!acquired) {
      for (let i = 0; i < 12; i++) {
        await sleep(30 + i * 15);
        const again = await cacheGet(key);
        if (again !== null) return again;
      }
      if (stale !== null) return stale;
    }

    try {
      const data = await Promise.race([
        fetchFn(),
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error('CACHE_FETCH_TIMEOUT')), fetchTimeoutMs);
        }),
      ]);
      if (data !== null && data !== undefined) {
        await cacheSet(key, data, ttlSeconds);
        await cacheSet(staleKey, data, staleTtl);
      }
      return data;
    } catch (err) {
      if (stale !== null) {
        logger.warn(`[cacheAside] fetch failed for ${key} — serving stale: ${err.message}`);
        return stale;
      }
      throw err;
    } finally {
      await cacheDel(lockKey);
    }
  })();

  inflight.set(key, run);
  try {
    return await run;
  } finally {
    inflight.delete(key);
  }
}

export default redisClient;
