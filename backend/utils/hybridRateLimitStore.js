import { MemoryStore } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { getRedisClient, isRedisReady } from '../lib/redis.js';

/**
 * Redis-backed shared rate-limit store with in-memory fallback.
 * Re-checks Redis on every increment so a late Redis connect still
 * becomes the shared store across cluster workers.
 */
export class HybridRateLimitStore {
  constructor(prefix) {
    this.prefix = prefix;
    this.memoryStore = new MemoryStore();
    this.redisStore = null;
    this.options = null;
  }

  init(options) {
    this.options = options;
    this.memoryStore.init?.(options);
  }

  _activeStore() {
    if (isRedisReady()) {
      if (!this.redisStore) {
        this.redisStore = new RedisStore({
          prefix: `rl:${this.prefix}:`,
          sendCommand: (...args) => getRedisClient().call(...args),
        });
        if (this.options) this.redisStore.init?.(this.options);
      }
      return this.redisStore;
    }
    return this.memoryStore;
  }

  async increment(key) {
    try {
      return await this._activeStore().increment(key);
    } catch {
      return this.memoryStore.increment(key);
    }
  }

  async decrement(key) {
    try {
      return await this._activeStore().decrement(key);
    } catch {
      return this.memoryStore.decrement(key);
    }
  }

  async resetKey(key) {
    try {
      return await this._activeStore().resetKey(key);
    } catch {
      return this.memoryStore.resetKey(key);
    }
  }
}

export const makeRateLimitStore = (prefix) => new HybridRateLimitStore(prefix);

export default { HybridRateLimitStore, makeRateLimitStore };
