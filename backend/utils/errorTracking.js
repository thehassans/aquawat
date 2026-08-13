import logger from './logger.js';

let sentry = null;

export function sentryTracesSampleRate() {
  const raw = process.env.SENTRY_TRACES_SAMPLE_RATE;
  if (raw !== undefined && String(raw).trim() !== '') {
    const n = Number(raw);
    return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0;
  }
  return process.env.NODE_ENV === 'production' ? 0.05 : 0;
}

export async function initErrorTracking(settings) {
  const tracking = settings?.errorTracking || {};
  const dsn = String(tracking.dsn || process.env.SENTRY_DSN || '').trim();
  const enabled = tracking.enabled === true || Boolean(process.env.SENTRY_DSN);
  if (!enabled || !dsn) return false;
  if (tracking.provider && tracking.provider !== 'sentry') {
    logger.warn(`[errorTracking] provider ${tracking.provider} is not implemented; only Sentry is supported`);
    return false;
  }

  try {
    const Sentry = await import('@sentry/node');
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV || 'development',
      tracesSampleRate: sentryTracesSampleRate(),
    });
    sentry = Sentry;
    logger.info('[errorTracking] Sentry initialized');
    return true;
  } catch (error) {
    logger.warn(`[errorTracking] Sentry SDK unavailable (${error.message}). Install @sentry/node to capture errors.`);
    return false;
  }
}

export function captureException(error, context = {}) {
  if (!sentry) return;
  try {
    sentry.withScope?.((scope) => {
      if (context.user) scope.setUser({ id: String(context.user) });
      if (context.url) scope.setTag('url', context.url);
      if (context.method) scope.setTag('method', context.method);
      if (context.requestId) scope.setTag('requestId', context.requestId);
      sentry.captureException(error);
    });
  } catch {
    // never throw from error reporting
  }
}
