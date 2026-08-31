import crypto from 'crypto';

function timingSafeEqual(a, b) {
  const left = Buffer.from(String(a || ''), 'utf8');
  const right = Buffer.from(String(b || ''), 'utf8');
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function verifyStripeSignature(payload, header, secret) {
  const parts = Object.fromEntries(
    String(header || '')
      .split(',')
      .map((chunk) => chunk.split('='))
      .filter(([key, value]) => key && value != null)
      .map(([key, value]) => [key.trim(), value.trim()]),
  );
  const timestamp = parts.t;
  const signature = parts.v1;
  if (!timestamp || !signature) {
    return { ok: false, mode: 'stripe', error: 'Malformed stripe-signature header' };
  }
  const signed = `${timestamp}.${payload}`;
  const expected = crypto.createHmac('sha256', secret).update(signed).digest('hex');
  if (!timingSafeEqual(signature, expected)) {
    return { ok: false, mode: 'stripe', error: 'Invalid Stripe webhook signature' };
  }
  return { ok: true, mode: 'stripe' };
}

function verifyHmacHex(payload, signature, secret, mode) {
  if (!signature) {
    return { ok: false, mode, error: `Missing ${mode} signature header` };
  }
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  const normalized = String(signature).replace(/^sha256=/i, '').trim();
  if (!timingSafeEqual(normalized, expected)) {
    return { ok: false, mode, error: `Invalid ${mode} webhook signature` };
  }
  return { ok: true, mode };
}

/**
 * Verify payment gateway webhook authenticity.
 * Supports shared secret header plus Stripe / Moyasar / Tabby HMAC signatures.
 */
export function verifyPaymentWebhookSignature(provider, {
  body = {},
  headers = {},
  secret = '',
  rawBody = null,
} = {}) {
  if (!secret) return { ok: true, mode: 'none' };

  const slug = String(provider || '').trim().toLowerCase();
  const payload = rawBody != null
    ? (Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody))
    : JSON.stringify(body);
  const normalizedHeaders = Object.fromEntries(
    Object.entries(headers || {}).map(([key, value]) => [String(key).toLowerCase(), value]),
  );

  const generic = normalizedHeaders['x-webhook-secret'];
  if (generic && timingSafeEqual(generic, secret)) {
    return { ok: true, mode: 'shared_secret' };
  }

  if (slug === 'stripe') {
    const stripeHeader = normalizedHeaders['stripe-signature'];
    if (stripeHeader) return verifyStripeSignature(payload, stripeHeader, secret);
    return { ok: false, mode: 'stripe', error: 'Missing stripe-signature header' };
  }

  if (slug === 'moyasar') {
    return verifyHmacHex(payload, normalizedHeaders['x-moyasar-signature'], secret, 'moyasar');
  }

  if (slug === 'tabby') {
    return verifyHmacHex(payload, normalizedHeaders['x-tabby-signature'], secret, 'tabby');
  }

  if (generic) {
    return { ok: false, mode: 'shared_secret', error: 'Invalid webhook secret' };
  }

  return { ok: false, mode: slug || 'unknown', error: 'Unsupported webhook signature for provider' };
}

export default verifyPaymentWebhookSignature;
