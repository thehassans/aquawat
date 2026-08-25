import test from 'node:test';
import assert from 'node:assert/strict';
import { listEnvelope, sendList } from '../services/inventory/apiContract.js';
import {
  recordInvLatency,
  recordJobOutcome,
  getInvMetricsSnapshot,
} from '../services/inventory/invMetrics.js';
import { processInventoryJob } from '../services/inventory/jobHandlers.js';

test('sendList dual shape', () => {
  const chunks = [];
  const res = {
    status() { return this; },
    json(body) { chunks.push(body); return body; },
  };
  sendList(res, [{ a: 1 }], { total: 10, page: 1, pageSize: 5, appliedFilters: { q: 'x' } });
  assert.equal(chunks[0].items.length, 1);
  assert.equal(chunks[0].data.length, 1);
  assert.equal(chunks[0]._meta.total, 10);
  assert.equal(chunks[0].total, 10);
  assert.equal(chunks[0].page, 1);
});

test('listEnvelope nextCursor', () => {
  const env = listEnvelope([], { nextCursor: 'abc', total: 0 });
  assert.equal(env._meta.nextCursor, 'abc');
});

test('metrics records latency and jobs', () => {
  recordInvLatency('/stock/transfers', 12);
  recordInvLatency('/stock/transfers', 40);
  recordJobOutcome(true);
  recordJobOutcome(false);
  const snap = getInvMetricsSnapshot();
  assert.ok(snap.endpoints.some((e) => e.path === '/stock/transfers'));
  assert.equal(snap.jobs.successes >= 1, true);
  assert.equal(snap.jobs.failures >= 1, true);
});

test('processInventoryJob rejects unknown type', async () => {
  await assert.rejects(
    () => processInventoryJob({ jobType: 'nope', tenantId: 'aaaaaaaaaaaaaaaaaaaaaaaa' }),
    /Unknown inventory jobType/,
  );
});

test('enqueueInventoryJob falls back inline without redis crash', async () => {
  process.env.REDIS_ENABLED = 'false';
  const { enqueueInventoryJob } = await import('../services/inventory/inventoryQueue.js');
  const q = await enqueueInventoryJob({
    jobType: 'delivery_notify',
    tenantId: 'aaaaaaaaaaaaaaaaaaaaaaaa',
    trigger: 'api',
    payload: {},
  });
  assert.equal(q.queued, true);
  assert.equal(q.mode, 'inline');
});
