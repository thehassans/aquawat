import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { csrfCookieGuard } from '../middleware/csrfOrigin.js';
import { isAllowedWebOrigin, originFromRequest } from '../utils/allowedOrigins.js';
import {
  isStripeFulfillmentEvent,
  isStripePaymentFailedEvent,
  stripeFailureContext,
} from '../services/platformStripe.js';

function mockRes() {
  const res = { statusCode: 200, body: null };
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (payload) => {
    res.body = payload;
    return res;
  };
  return res;
}

test('tenant subdomain of FRONTEND_URL host is allowed', () => {
  const prev = process.env.FRONTEND_URL;
  process.env.FRONTEND_URL = 'https://maqder.com';
  assert.equal(isAllowedWebOrigin('https://demo.maqder.com'), true);
  assert.equal(isAllowedWebOrigin('https://evil.example'), false);
  if (prev === undefined) delete process.env.FRONTEND_URL;
  else process.env.FRONTEND_URL = prev;
});

test('originFromRequest prefers Origin then Referer', () => {
  assert.equal(originFromRequest({ headers: { origin: 'https://a.example' } }), 'https://a.example');
  assert.equal(
    originFromRequest({ headers: { referer: 'https://b.example/invoices' } }),
    'https://b.example'
  );
});

test('CSRF: cookie POST from foreign origin is 403', () => {
  const prev = process.env.FRONTEND_URL;
  process.env.FRONTEND_URL = 'https://maqder.com';
  const req = {
    method: 'PUT',
    headers: { origin: 'https://evil.example' },
    cookies: { maqder_token: 'jwt' },
  };
  const res = mockRes();
  let next = false;
  csrfCookieGuard(req, res, () => { next = true; });
  assert.equal(next, false);
  assert.equal(res.statusCode, 403);
  if (prev === undefined) delete process.env.FRONTEND_URL;
  else process.env.FRONTEND_URL = prev;
});

test('CSRF: Bearer Authorization skips origin check', () => {
  const req = {
    method: 'POST',
    headers: { authorization: 'Bearer abc', origin: 'https://evil.example' },
    cookies: { maqder_token: 'jwt' },
  };
  const res = mockRes();
  let next = false;
  csrfCookieGuard(req, res, () => { next = true; });
  assert.equal(next, true);
});

test('CSRF: native client with cookie and no Origin is allowed', () => {
  const req = { method: 'POST', headers: {}, cookies: { maqder_token: 'jwt' } };
  const res = mockRes();
  let next = false;
  csrfCookieGuard(req, res, () => { next = true; });
  assert.equal(next, true);
});

test('Stripe fulfillment vs payment-failed event types', () => {
  assert.equal(isStripeFulfillmentEvent('checkout.session.completed'), true);
  assert.equal(isStripeFulfillmentEvent('checkout.session.async_payment_succeeded'), true);
  assert.equal(isStripePaymentFailedEvent('invoice.payment_failed'), true);
  assert.equal(isStripePaymentFailedEvent('checkout.session.async_payment_failed'), true);
  assert.equal(isStripePaymentFailedEvent('checkout.session.completed'), false);
});

test('stripeFailureContext reads metadata and customer email', () => {
  const ctx = stripeFailureContext({
    type: 'invoice.payment_failed',
    data: {
      object: {
        customer_email: 'owner@tenant.test',
        metadata: { tenantId: 'aaaaaaaaaaaaaaaaaaaaaaaa', plan: 'professional' },
        last_payment_error: { message: 'card_declined' },
      },
    },
  });
  assert.equal(ctx.email, 'owner@tenant.test');
  assert.equal(ctx.tenantId, 'aaaaaaaaaaaaaaaaaaaaaaaa');
  assert.equal(ctx.plan, 'professional');
  assert.equal(ctx.reason, 'card_declined');
});

test('CORS deny uses callback(null, false) so csrfCookieGuard can still return 403', () => {
  const src = fs.readFileSync(
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../server.js'),
    'utf8'
  );
  assert.match(src, /callback\(null, false\)/);
  assert.equal((src.match(/callback\(new Error\('Not allowed by CORS'\)\)/g) || []).length, 0);
});
