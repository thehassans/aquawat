import InvJobRun from '../../models/inventory/InvJobRun.js';
import { toObjectId } from '../../models/inventory/common.js';
import { runIntegrityChecks } from './integrityChecks.js';

/**
 * Persist a job run row (start → finish).
 */
export async function startJobRun(tenantId, {
  jobType,
  trigger = 'manual',
  userId = null,
} = {}) {
  const [doc] = await InvJobRun.create([{
    tenantId: toObjectId(tenantId),
    jobType,
    trigger,
    status: 'running',
    startedAt: new Date(),
    createdBy: userId || undefined,
  }]);
  return doc;
}

export async function finishJobRun(job, {
  status = 'ok',
  counts = {},
  errors = [],
  result = null,
} = {}) {
  const finishedAt = new Date();
  job.status = status;
  job.finishedAt = finishedAt;
  job.durationMs = finishedAt - (job.startedAt || finishedAt);
  job.counts = counts;
  job.errors = errors;
  job.result = result;
  await job.save();
  try {
    const { recordJobOutcome, recordCacheDrift } = await import('./invMetrics.js');
    recordJobOutcome(status === 'ok' || status === 'partial');
    if (counts?.cacheAssertMismatches != null || counts?.mismatchCount != null) {
      recordCacheDrift(counts.cacheAssertMismatches ?? counts.mismatchCount);
    }
  } catch (err) {
    console.warn('[inventory] job metrics recording failed:', err?.message || err);
  }
}

export async function runIntegrityJob(tenantId, {
  trigger = 'manual',
  userId = null,
  limit,
} = {}) {
  const job = await startJobRun(tenantId, { jobType: 'integrity', trigger, userId });
  try {
    const report = await runIntegrityChecks(tenantId, { limit });
    await finishJobRun(job, {
      status: report.ok ? 'ok' : 'failed',
      counts: {
        failureCount: report.failureCount,
        checks: Object.keys(report.checks || {}).length,
      },
      errors: (report.failures || []).slice(0, 100).map((f) => ({
        code: f.code,
        message: f.message,
        messageAr: f.messageAr,
        ref: f.ref,
        at: f.at,
      })),
      result: {
        ok: report.ok,
        checks: report.checks,
        durationMs: report.durationMs,
        generatedAt: report.generatedAt,
      },
    });
    return { job, report };
  } catch (err) {
    await finishJobRun(job, {
      status: 'failed',
      errors: [{ code: 'INTEGRITY_CRASH', message: err.message }],
    });
    throw err;
  }
}

export async function listJobRuns(tenantId, {
  jobType,
  limit = 40,
} = {}) {
  const filter = { tenantId: toObjectId(tenantId) };
  if (jobType) filter.jobType = jobType;
  const items = await InvJobRun.find(filter)
    .sort({ startedAt: -1 })
    .limit(Math.min(100, Number(limit) || 40))
    .select('jobType trigger status startedAt finishedAt durationMs counts errors result createdBy')
    .lean();
  return { items, total: items.length };
}

export async function latestIntegrityFailures(tenantId, { limit = 50 } = {}) {
  const job = await InvJobRun.findOne({
    tenantId: toObjectId(tenantId),
    jobType: 'integrity',
    status: { $in: ['failed', 'ok', 'partial'] },
  }).sort({ startedAt: -1 }).lean();
  if (!job) return { job: null, items: [] };
  const items = (job.errors || []).slice(0, limit).map((e) => ({
    type: 'integrity',
    code: e.code,
    severity: 'error',
    message: e.message,
    messageAr: e.messageAr || e.message,
    at: e.at || job.finishedAt || job.startedAt,
    ref: e.ref || {},
  }));
  return { job, items };
}
