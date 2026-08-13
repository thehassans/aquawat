import './forceRedisOff.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { HybridRateLimitStore, makeRateLimitStore } from '../utils/hybridRateLimitStore.js';

test('invoice-write store falls back to memory when Redis is disabled', async () => {
  const store = makeRateLimitStore('invoice-write');
  store.init({ windowMs: 60_000 });
  const key = 'invoice-write:tenant-a';
  const hits = [];
  for (let i = 0; i < 40; i += 1) {
    hits.push(await store.increment(key));
  }
  const lastAllowed = hits[39];
  assert.ok(lastAllowed.totalHits === 40 || lastAllowed.totalHits >= 40);
  const over = await store.increment(key);
  assert.ok(over.totalHits >= 41);
});

test('HybridRateLimitStore uses distinct prefixes per limiter', () => {
  const a = new HybridRateLimitStore('invoice-write');
  const b = new HybridRateLimitStore('auth');
  assert.equal(a.prefix, 'invoice-write');
  assert.equal(b.prefix, 'auth');
  assert.notEqual(a.prefix, b.prefix);
});
