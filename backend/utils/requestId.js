import { randomUUID } from 'crypto';
import { AsyncLocalStorage } from 'async_hooks';

const requestContext = new AsyncLocalStorage();

export function getRequestId() {
  return requestContext.getStore()?.requestId;
}

/** Attach x-request-id for log correlation. */
export function requestIdMiddleware(req, res, next) {
  const incoming = String(req.headers['x-request-id'] || '').trim();
  const id = incoming && incoming.length <= 128 ? incoming : randomUUID();
  req.requestId = id;
  res.setHeader('x-request-id', id);
  requestContext.run({ requestId: id }, () => next());
}

export default requestIdMiddleware;
