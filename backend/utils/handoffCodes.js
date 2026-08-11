import { randomBytes } from 'crypto';
import { cacheGet, cacheSet, cacheDel, isRedisReady } from '../lib/redis.js';

const memoryStore = new Map();
const TTL_MS = 120_000;

const pruneMemory = () => {
  const now = Date.now();
  for (const [key, val] of memoryStore.entries()) {
    if (val.exp <= now) memoryStore.delete(key);
  }
};

setInterval(pruneMemory, 60_000).unref?.();

/**
 * Issue a one-time handoff code that maps to a JWT (2 minute TTL).
 * Prefer Redis; fall back to in-process memory.
 */
export async function issueHandoffCode(token) {
  const code = randomBytes(24).toString('hex');
  const payload = { token: String(token), exp: Date.now() + TTL_MS };

  if (isRedisReady()) {
    await cacheSet(`handoff:${code}`, { token: payload.token }, 120);
  } else {
    memoryStore.set(code, payload);
  }
  return code;
}

/** Consume a handoff code once. Returns token or null. */
export async function consumeHandoffCode(code) {
  const key = String(code || '').trim();
  if (!key || key.length < 16) return null;

  if (isRedisReady()) {
    const data = await cacheGet(`handoff:${key}`);
    await cacheDel(`handoff:${key}`);
    if (data?.token) return data.token;
  }

  const mem = memoryStore.get(key);
  memoryStore.delete(key);
  if (!mem || mem.exp <= Date.now()) return null;
  return mem.token;
}

export default { issueHandoffCode, consumeHandoffCode };
