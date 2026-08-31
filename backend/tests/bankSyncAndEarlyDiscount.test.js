import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import {
  resolveBankSyncProviders,
  createOAuthState,
  parseOAuthState,
  buildAuthorizeUrl,
} from '../utils/bankSyncOAuth.js';
import { applyPaidAmountStatus } from '../utils/invoicePaymentStatus.js';
import { verifyPaymentWebhookSignature } from '../utils/paymentWebhookAuth.js';

test('bank sync providers: sandbox available; plaid/saltedge gated by env', () => {
  const prevPlaid = process.env.PLAID_CLIENT_ID;
  const prevPlaidSecret = process.env.PLAID_SECRET;
  const prevSaltId = process.env.SALTEDGE_APP_ID;
  const prevSaltSecret = process.env.SALTEDGE_SECRET;
  delete process.env.PLAID_CLIENT_ID;
  delete process.env.PLAID_SECRET;
  delete process.env.SALTEDGE_APP_ID;
  delete process.env.SALTEDGE_SECRET;

  const locked = resolveBankSyncProviders();
  assert.equal(locked.find((p) => p.id === 'sandbox')?.status, 'available');
  assert.equal(locked.find((p) => p.id === 'plaid')?.status, 'coming_soon');
  assert.equal(locked.find((p) => p.id === 'saltedge')?.status, 'coming_soon');

  process.env.PLAID_CLIENT_ID = 'cid';
  process.env.PLAID_SECRET = 'sec';
  const unlocked = resolveBankSyncProviders();
  assert.equal(unlocked.find((p) => p.id === 'plaid')?.status, 'available');

  if (prevPlaid === undefined) delete process.env.PLAID_CLIENT_ID;
  else process.env.PLAID_CLIENT_ID = prevPlaid;
  if (prevPlaidSecret === undefined) delete process.env.PLAID_SECRET;
  else process.env.PLAID_SECRET = prevPlaidSecret;
  if (prevSaltId === undefined) delete process.env.SALTEDGE_APP_ID;
  else process.env.SALTEDGE_APP_ID = prevSaltId;
  if (prevSaltSecret === undefined) delete process.env.SALTEDGE_SECRET;
  else process.env.SALTEDGE_SECRET = prevSaltSecret;
});

test('oauth state round-trips and rejects tampering', () => {
  const state = createOAuthState('tenant-1', 'plaid');
  const parsed = parseOAuthState(state);
  assert.equal(parsed.tenantId, 'tenant-1');
  assert.equal(parsed.provider, 'plaid');
  assert.equal(parseOAuthState(`${state}x`), null);
});

test('buildAuthorizeUrl returns plaid scaffold when credentials present', () => {
  process.env.PLAID_CLIENT_ID = 'cid';
  const { authorizeUrl, mode } = buildAuthorizeUrl('plaid', { state: 'abc' });
  assert.ok(authorizeUrl.includes('plaid.com'));
  assert.equal(mode, 'plaid_link_scaffold');
});

test('applyPaidAmountStatus honors earlyPaymentDiscount.applied', () => {
  const invoice = {
    grandTotal: 1000,
    paidAmount: 980,
    earlyPaymentDiscount: { applied: true, discountedAmount: 980 },
  };
  applyPaidAmountStatus(invoice);
  assert.equal(invoice.paymentStatus, 'paid');
  assert.equal(invoice.paidAmount, 1000);
});

test('stripe signature accepts Buffer rawBody', () => {
  const secret = 'whsec_buf';
  const body = { id: 'evt_buf' };
  const payload = JSON.stringify(body);
  const timestamp = '1700000001';
  const signature = crypto.createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex');
  const result = verifyPaymentWebhookSignature('stripe', {
    body,
    headers: { 'stripe-signature': `t=${timestamp},v1=${signature}` },
    secret,
    rawBody: Buffer.from(payload, 'utf8'),
  });
  assert.equal(result.ok, true);
});
