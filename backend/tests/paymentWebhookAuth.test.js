import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { verifyPaymentWebhookSignature } from '../utils/paymentWebhookAuth.js';

test('shared secret header passes verification', () => {
  const result = verifyPaymentWebhookSignature('moyasar', {
    body: { amount: 100 },
    headers: { 'x-webhook-secret': 'test-secret' },
    secret: 'test-secret',
  });
  assert.equal(result.ok, true);
  assert.equal(result.mode, 'shared_secret');
});

test('stripe signature verifies timestamped payload', () => {
  const secret = 'whsec_test';
  const body = { id: 'evt_1', amount: 500 };
  const payload = JSON.stringify(body);
  const timestamp = '1700000000';
  const signature = crypto.createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex');
  const result = verifyPaymentWebhookSignature('stripe', {
    body,
    headers: { 'stripe-signature': `t=${timestamp},v1=${signature}` },
    secret,
  });
  assert.equal(result.ok, true);
  assert.equal(result.mode, 'stripe');
});

test('moyasar HMAC signature verifies body', () => {
  const secret = 'moyasar-secret';
  const body = { status: 'paid', amount: 2500 };
  const payload = JSON.stringify(body);
  const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  const result = verifyPaymentWebhookSignature('moyasar', {
    body,
    headers: { 'x-moyasar-signature': signature },
    secret,
  });
  assert.equal(result.ok, true);
  assert.equal(result.mode, 'moyasar');
});

test('rejects invalid provider signature when secret configured', () => {
  const result = verifyPaymentWebhookSignature('tabby', {
    body: { status: 'captured' },
    headers: {},
    secret: 'tabby-secret',
  });
  assert.equal(result.ok, false);
});
