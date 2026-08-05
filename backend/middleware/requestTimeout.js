import logger from '../utils/logger.js';

/**
 * Hard request timeout middleware.
 *
 * Sends a 503 response if the route handler hasn't finished within
 * `timeoutMs` milliseconds. The timeout is cleared as soon as the
 * response headers are sent so normal fast requests are unaffected.
 *
 * @param {number} [timeoutMs=30000] - Maximum allowed request duration in ms.
 */
const requestTimeout = (timeoutMs = 30_000) => (req, res, next) => {
  // Skip health-check endpoints — they must always respond instantly
  if (req.path === '/health' || req.path === '/health/live' || req.path === '/health/ready') {
    return next();
  }

  const timer = setTimeout(() => {
    if (res.headersSent) return;

    logger.warn({
      message: 'Request timeout',
      method: req.method,
      url: req.originalUrl,
      timeoutMs,
    });

    res.status(503).json({
      error: 'Request timed out. Please try again.',
    });
  }, timeoutMs);

  // Ensure the timer is always cleared when the response finishes
  res.on('finish', () => clearTimeout(timer));
  res.on('close', () => clearTimeout(timer));

  next();
};

export default requestTimeout;
