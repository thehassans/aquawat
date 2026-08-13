/**
 * DBA verification: invoice covering indexes for multi-tenant 1M+ collections.
 *
 * GET /api/invoices/stats pipeline:
 *   $match { tenantId, optional issueDate range }
 *   $facet { byStatus, byPaymentStatus, byZatcaStatus, byTransactionType, monthly, totals }
 *
 * Verdict:
 *   secondaryPreferred is correct for these reads. Redis cacheAside 60s absorbs replica lag.
 *   allowDiskUse is on via Invoice.statsAggregate (facet + 1M docs can spill).
 *
 *   flow+status+issueDate is the right ESR compound for filtered lists, NOT a true
 *   covering index for $facet: grouping still needs grandTotal / totalTax / zatca
 *   from the document. The winning index for stats is the prefix
 *   { tenantId: 1, issueDate: -1 } of { tenantId, issueDate, _id }.
 *
 *   Atlas $search stays on the default connection (do not force secondaryPreferred).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import Invoice from '../models/Invoice.js';
import { statsReadPreference } from '../utils/mongoReadPreference.js';

function indexKeys() {
  return Invoice.schema.indexes().map(([keys]) => JSON.stringify(keys));
}

test('stats reads use secondaryPreferred by default', () => {
  const prev = process.env.MONGODB_STATS_READ_PREFERENCE;
  delete process.env.MONGODB_STATS_READ_PREFERENCE;
  assert.equal(statsReadPreference(), 'secondaryPreferred');
  if (prev === undefined) delete process.env.MONGODB_STATS_READ_PREFERENCE;
  else process.env.MONGODB_STATS_READ_PREFERENCE = prev;
});

test('tenantId is the leading key on tenant-scoped invoice indexes', () => {
  const keys = Invoice.schema.indexes().map(([k]) => k);
  const tenantScoped = keys.filter((k) => k.tenantId);
  assert.ok(tenantScoped.length >= 8);
  for (const spec of tenantScoped) {
    const ordered = Object.keys(spec);
    assert.equal(ordered[0], 'tenantId', `expected tenantId first in ${JSON.stringify(spec)}`);
  }
});

test('cursor list covering index tenantId+issueDate+_id exists', () => {
  assert.ok(indexKeys().includes(JSON.stringify({ tenantId: 1, issueDate: -1, _id: -1 })));
});

test('stats/list compound flow+status+issueDate exists', () => {
  assert.ok(indexKeys().includes(JSON.stringify({ tenantId: 1, flow: 1, status: 1, issueDate: -1 })));
});

test('paymentStatus+issueDate exists for money-status filters at 1M scale', () => {
  assert.ok(indexKeys().includes(JSON.stringify({ tenantId: 1, paymentStatus: 1, issueDate: -1 })));
});

test('overdue job platform index paymentStatus+dueDate+status+flow exists', () => {
  assert.ok(indexKeys().includes(JSON.stringify({ paymentStatus: 1, dueDate: 1, status: 1, flow: 1 })));
});

test('searchText remains tenant-prefixed (not a global text index)', () => {
  assert.ok(indexKeys().includes(JSON.stringify({ tenantId: 1, searchText: 1 })));
});

test('list filters transactionType and zatca include issueDate (ESR)', () => {
  assert.ok(indexKeys().includes(JSON.stringify({ tenantId: 1, transactionType: 1, issueDate: -1 })));
  assert.ok(indexKeys().includes(JSON.stringify({ tenantId: 1, 'zatca.submissionStatus': 1, issueDate: -1 })));
});
