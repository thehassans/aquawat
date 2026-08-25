/**
 * In-process inventory metrics (§3.5) — p95 latency, query counts, job failures.
 * Reset on process restart; enough for Overview + /stock/metrics.
 */

const MAX_SAMPLES = 500;
const latencyByPath = new Map(); // path -> number[] ms
const queryByPath = new Map();
let writeConflictRetries = 0;
let jobFailures = 0;
let jobSuccesses = 0;
let cacheDriftSamples = [];

function pushSample(map, key, value) {
  const arr = map.get(key) || [];
  arr.push(value);
  if (arr.length > MAX_SAMPLES) arr.shift();
  map.set(key, arr);
}

function percentile(arr, p) {
  if (!arr.length) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)];
}

export function recordInvLatency(path, ms) {
  pushSample(latencyByPath, path || 'unknown', Number(ms) || 0);
}

export function recordInvQueryCount(path, count) {
  pushSample(queryByPath, path || 'unknown', Number(count) || 0);
}

export function recordWriteConflictRetry() {
  writeConflictRetries += 1;
}

export function recordJobOutcome(ok) {
  if (ok) jobSuccesses += 1;
  else jobFailures += 1;
}

export function recordCacheDrift(count) {
  cacheDriftSamples.push(Number(count) || 0);
  if (cacheDriftSamples.length > MAX_SAMPLES) cacheDriftSamples.shift();
}

export function getInvMetricsSnapshot() {
  const endpoints = [];
  for (const [path, samples] of latencyByPath) {
    const queries = queryByPath.get(path) || [];
    endpoints.push({
      path,
      samples: samples.length,
      p50Ms: percentile(samples, 50),
      p95Ms: percentile(samples, 95),
      p99Ms: percentile(samples, 99),
      avgQueryCount: queries.length
        ? Math.round((queries.reduce((a, b) => a + b, 0) / queries.length) * 10) / 10
        : null,
    });
  }
  endpoints.sort((a, b) => (b.p95Ms || 0) - (a.p95Ms || 0));

  return {
    endpoints: endpoints.slice(0, 40),
    writeConflictRetries,
    jobs: {
      successes: jobSuccesses,
      failures: jobFailures,
      failureRate: (jobSuccesses + jobFailures)
        ? jobFailures / (jobSuccesses + jobFailures)
        : 0,
    },
    cacheDrift: {
      samples: cacheDriftSamples.length,
      last: cacheDriftSamples[cacheDriftSamples.length - 1] ?? null,
      avg: cacheDriftSamples.length
        ? Math.round((cacheDriftSamples.reduce((a, b) => a + b, 0) / cacheDriftSamples.length) * 10) / 10
        : null,
    },
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Express middleware — times requests and records query budget when ALS is active.
 */
export function stockMetricsMiddleware() {
  return function invMetrics(req, res, next) {
    const started = Date.now();
    const path = req.route?.path ? `${req.baseUrl || ''}${req.route.path}` : req.path;
    res.on('finish', () => {
      recordInvLatency(path, Date.now() - started);
      try {
        const hdr = res.getHeader('X-Inv-Query-Count');
        if (hdr != null) recordInvQueryCount(path, Number(hdr));
      } catch { /* */ }
    });
    next();
  };
}
