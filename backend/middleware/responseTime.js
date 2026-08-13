import { recordRequest } from '../utils/sloMetrics.js';

/**
 * Response-time middleware.
 *
 * Attaches an `x-response-time` header (in milliseconds) to every response.
 * Feeds the 5-minute SLO window used by /api/health/slo and ALERT_WEBHOOK_URL.
 */
const responseTime = () => (req, res, next) => {
  const startAt = process.hrtime.bigint();
  const skipSlo = String(req.path || '').startsWith('/api/health');

  const writeHeader = () => {
    if (res.headersSent) return;
    const elapsed = Number(process.hrtime.bigint() - startAt) / 1_000_000;
    res.setHeader('x-response-time', `${elapsed.toFixed(2)}ms`);
    if (String(req.path || '').startsWith('/api')) {
      res.setHeader('Cache-Control', 'private, no-store');
    }
    if (!skipSlo) recordRequest(elapsed, res.statusCode);
  };

  // Patch both write and end so the header is set before the body is flushed
  const originalWrite = res.write.bind(res);
  const originalEnd = res.end.bind(res);

  res.write = (...args) => {
    writeHeader();
    return originalWrite(...args);
  };

  res.end = (...args) => {
    writeHeader();
    return originalEnd(...args);
  };

  next();
};

export default responseTime;
