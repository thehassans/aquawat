/**
 * Response-time middleware.
 *
 * Attaches an `x-response-time` header (in milliseconds) to every response.
 * This is read by Nginx logs, APM tools, and browser DevTools for latency
 * tracking without any external dependency.
 */
const responseTime = () => (req, res, next) => {
  const startAt = process.hrtime.bigint();

  const writeHeader = () => {
    if (res.headersSent) return;
    const elapsed = Number(process.hrtime.bigint() - startAt) / 1_000_000;
    res.setHeader('x-response-time', `${elapsed.toFixed(2)}ms`);
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
