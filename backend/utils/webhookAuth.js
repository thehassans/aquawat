import crypto from 'crypto';

export const timingSafeEqualString = (a, b) => {
  const left = Buffer.from(String(a || ''), 'utf8');
  const right = Buffer.from(String(b || ''), 'utf8');
  if (left.length === 0 || right.length === 0 || left.length !== right.length) {
    return false;
  }
  return crypto.timingSafeEqual(left, right);
};

export const verifyHmacSha256Hex = (rawBody, secret, signature) => {
  if (!secret || !signature) return false;
  const clean = String(signature).trim().replace(/^sha256=/i, '').replace(/^hmac-sha256=/i, '');
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return timingSafeEqualString(expected, clean);
};

export const getRawBody = (req) => {
  if (Buffer.isBuffer(req.rawBody)) return req.rawBody.toString('utf8');
  if (typeof req.rawBody === 'string') return req.rawBody;
  if (Buffer.isBuffer(req.body)) return req.body.toString('utf8');
  if (typeof req.body === 'string') return req.body;
  return JSON.stringify(req.body || {});
};

/** Moyasar: x-moyasar-signature HMAC or body.secret_token shared-secret match. */
export const verifyMoyasarWebhook = (req, webhookSecret) => {
  if (!webhookSecret) return false;
  const raw = getRawBody(req);
  const headerSig =
    req.headers['x-moyasar-signature'] ||
    req.headers['x-webhook-signature'] ||
    req.headers['moyasar-signature'];

  if (headerSig && verifyHmacSha256Hex(raw, webhookSecret, headerSig)) {
    return true;
  }

  const token =
    req.body?.secret_token ||
    req.body?.secretToken ||
    req.headers['x-moyasar-secret'] ||
    req.headers['authorization']?.replace(/^Bearer\s+/i, '');

  return timingSafeEqualString(token, webhookSecret);
};

/** Tabby: Authorization Bearer secretKey (or Tabby-Signature HMAC). */
export const verifyTabbyWebhook = (req, secretKey) => {
  if (!secretKey) return false;
  const auth = req.headers.authorization || '';
  const bearer = auth.replace(/^Bearer\s+/i, '').trim();
  if (timingSafeEqualString(bearer, secretKey)) return true;

  const raw = getRawBody(req);
  const sig = req.headers['tabby-signature'] || req.headers['x-tabby-signature'];
  return verifyHmacSha256Hex(raw, secretKey, sig);
};

/** Tamara: notification token via Authorization or tamara-token header. */
export const verifyTamaraWebhook = (req, notificationToken) => {
  if (!notificationToken) return false;
  const auth = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  const headerToken = req.headers['tamara-token'] || req.headers['x-tamara-token'] || '';
  return timingSafeEqualString(auth, notificationToken) || timingSafeEqualString(headerToken, notificationToken);
};

/** Meta WhatsApp: X-Hub-Signature-256 = sha256=<hmac>. */
export const verifyMetaHubSignature = (req, appSecret) => {
  if (!appSecret) return false;
  const header = req.headers['x-hub-signature-256'] || '';
  const raw = getRawBody(req);
  const expected = `sha256=${crypto.createHmac('sha256', appSecret).update(raw).digest('hex')}`;
  return timingSafeEqualString(header, expected);
};
