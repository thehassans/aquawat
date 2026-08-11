import { randomUUID } from 'crypto';

/** Attach x-request-id for log correlation. */
export function requestIdMiddleware(req, res, next) {
  const incoming = String(req.headers['x-request-id'] || '').trim();
  const id = incoming && incoming.length <= 128 ? incoming : randomUUID();
  req.requestId = id;
  res.setHeader('x-request-id', id);
  next();
}

export default requestIdMiddleware;
