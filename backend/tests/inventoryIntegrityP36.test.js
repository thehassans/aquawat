import test from 'node:test';
import assert from 'node:assert/strict';

test('integrityChecks exports runIntegrityChecks', async () => {
  const mod = await import('../services/inventory/integrityChecks.js');
  assert.equal(typeof mod.runIntegrityChecks, 'function');
});

test('jobRunner exports integrity + list helpers', async () => {
  const mod = await import('../services/inventory/jobRunner.js');
  assert.equal(typeof mod.runIntegrityJob, 'function');
  assert.equal(typeof mod.listJobRuns, 'function');
  assert.equal(typeof mod.latestIntegrityFailures, 'function');
  assert.equal(typeof mod.startJobRun, 'function');
  assert.equal(typeof mod.finishJobRun, 'function');
});

test('stockHeavyLimiter is a middleware function', async () => {
  const { stockHeavyLimiter } = await import('../middleware/stockHeavyLimit.js');
  assert.equal(typeof stockHeavyLimiter, 'function');
});

test('InvJobRun model has integrity jobType enum', async () => {
  const InvJobRun = (await import('../models/inventory/InvJobRun.js')).default;
  const jobType = InvJobRun.schema.path('jobType');
  assert.ok(jobType.enumValues.includes('integrity'));
  assert.ok(jobType.enumValues.includes('scheduler'));
});
