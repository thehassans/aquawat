import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveAccountingSkip,
  connectAccountingMongo,
  disconnectAccountingMongo,
  createAccountingTestTenant,
  createOpenSalesInvoice,
  cleanupAccountingTenant,
  handleAccountingPaymentProviderWebhook,
  startBankSyncOAuth,
  syncBankFeed,
  autoMatchBankStatementLines,
} from './helpers/accountingIntegrationHarness.js';
import Invoice from '../models/Invoice.js';
import { redactBankSyncConnections, sealBankSyncMetadata, unsealBankSyncMetadata } from '../utils/bankSyncSecrets.js';

const skipReason = await resolveAccountingSkip();

test('payment webhook posts receipt and marks invoice paid', { skip: skipReason }, async () => {
  await connectAccountingMongo();
  let tenantId = null;
  try {
    const tenant = await createAccountingTestTenant({
      slugSuffix: `wh-${Date.now().toString(36)}`,
      webhookSecret: 'whsec-integration',
      provider: 'moyasar',
    });
    tenantId = tenant._id;
    const invoice = await createOpenSalesInvoice(tenantId, { grandTotal: 230, subtotal: 200, totalTax: 30 });

    const result = await handleAccountingPaymentProviderWebhook('moyasar', {
      status: 'paid',
      invoiceId: String(invoice._id),
      amount: 230,
      id: `pay-${Date.now()}`,
    }, {
      headers: { 'x-webhook-secret': 'whsec-integration' },
    });

    assert.equal(result.received, true);
    assert.ok(result.journalEntryId);
    assert.equal(result.paymentStatus, 'paid');

    const reloaded = await Invoice.findById(invoice._id).lean();
    assert.equal(reloaded.paymentStatus, 'paid');
    assert.equal(reloaded.paidAmount, 230);
  } finally {
    await cleanupAccountingTenant(tenantId);
    await disconnectAccountingMongo();
  }
});

test('payment webhook rejects bad signature', { skip: skipReason }, async () => {
  await connectAccountingMongo();
  let tenantId = null;
  try {
    const tenant = await createAccountingTestTenant({
      slugSuffix: `auth-${Date.now().toString(36)}`,
      webhookSecret: 'real-secret',
      provider: 'tabby',
    });
    tenantId = tenant._id;
    const invoice = await createOpenSalesInvoice(tenantId);

    await assert.rejects(
      () => handleAccountingPaymentProviderWebhook('tabby', {
        status: 'captured',
        invoiceId: String(invoice._id),
        amount: 115,
        id: 'x1',
      }, {
        headers: { 'x-webhook-secret': 'wrong' },
      }),
      /Invalid webhook|signature|secret/i,
    );
  } finally {
    await cleanupAccountingTenant(tenantId);
    await disconnectAccountingMongo();
  }
});

test('sandbox bank sync creates statement lines and redacts secrets', { skip: skipReason }, async () => {
  await connectAccountingMongo();
  let tenantId = null;
  try {
    const tenant = await createAccountingTestTenant({
      slugSuffix: `sync-${Date.now().toString(36)}`,
    });
    tenantId = tenant._id;

    const connected = await startBankSyncOAuth(tenantId, { provider: 'sandbox' });
    assert.equal(connected.status, 'connected');
    assert.equal(connected.connections[0].metadata?.accessToken, undefined);

    const synced = await syncBankFeed(tenantId, null, { provider: 'sandbox' });
    assert.ok(synced.lineCount >= 1);
    assert.ok(synced.statementId);

    const match = await autoMatchBankStatementLines(tenantId, null, {
      accountId: synced.accountId,
      minScore: 100,
      limit: 20,
    });
    assert.ok(typeof match.matched === 'number');
    assert.ok(typeof match.skipped === 'number');

    // Seal path still works after sync metadata writes
    const sealed = sealBankSyncMetadata({ accessToken: 'tok-live', mode: 'sandbox_stub' });
    const open = unsealBankSyncMetadata(sealed);
    assert.equal(open.accessToken, 'tok-live');
    const redacted = redactBankSyncConnections([{ provider: 'sandbox', metadata: sealed }]);
    assert.equal(redacted[0].metadata.accessToken, undefined);
    assert.equal(redacted[0].metadata.hasAccessToken, true);
  } finally {
    await cleanupAccountingTenant(tenantId);
    await disconnectAccountingMongo();
  }
});
