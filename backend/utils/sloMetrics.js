const WINDOW_MS = 5 * 60 * 1000;
const samples = [];

function prune(now = Date.now()) {
  const cutoff = now - WINDOW_MS;
  while (samples.length && samples[0].t < cutoff) samples.shift();
}

export function recordRequest(durationMs, statusCode) {
  const ms = Number(durationMs);
  const status = Number(statusCode);
  if (!Number.isFinite(ms) || ms < 0) return;
  samples.push({ t: Date.now(), ms, status: Number.isFinite(status) ? status : 0 });
  if (samples.length > 20_000) prune();
}

export function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1));
  return sorted[idx];
}

export function sloSnapshot(now = Date.now()) {
  prune(now);
  const durations = samples.map((s) => s.ms).sort((a, b) => a - b);
  const errors5xx = samples.filter((s) => s.status >= 500).length;
  const count = samples.length;
  return {
    windowMs: WINDOW_MS,
    count,
    p95Ms: percentile(durations, 0.95),
    errorRate: count ? errors5xx / count : 0,
    errors5xx,
  };
}

export function sloBreached(snap, { p95Ms = 2000, errorRate = 0.05, minSamples = 20 } = {}) {
  if (!snap || snap.count < minSamples) return null;
  if (snap.p95Ms > p95Ms) return 'p95';
  if (snap.errorRate > errorRate) return 'error_rate';
  return null;
}

export function resetSloSamples() {
  samples.length = 0;
}

export default { recordRequest, sloSnapshot, sloBreached, resetSloSamples };
