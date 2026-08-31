import test from 'node:test';
import assert from 'node:assert/strict';
import {
  encryptSecret,
  decryptSecret,
  sealBankSyncMetadata,
  unsealBankSyncMetadata,
  redactBankSyncConnections,
} from '../utils/bankSyncSecrets.js';
import { normalizeProviderTransactions } from '../services/bankSyncProviderClient.js';
import { scoreBankMatchCandidate } from '../utils/bankMatchScore.js';
import { computePaymentSettlement, computePaymentSchedule } from '../utils/invoicePaymentTerms.js';
import { applyPaidAmountStatus } from '../utils/invoicePaymentStatus.js';

test('bank sync secrets encrypt and decrypt round-trip', () => {
  const sealed = encryptSecret('access-sandbox-abc');
  assert.ok(sealed.startsWith('enc:'));
  assert.equal(decryptSecret(sealed), 'access-sandbox-abc');
  assert.equal(encryptSecret(sealed), sealed);
});

test('seal/unseal/redact bank sync metadata', () => {
  const sealed = sealBankSyncMetadata({
    accessToken: 'secret-token',
    publicToken: 'public-token',
    oauthState: 'state.sig',
    linkToken: 'link-sandbox',
    mode: 'plaid_live',
  });
  assert.ok(sealed.accessToken.startsWith('enc:'));
  assert.ok(sealed.publicToken.startsWith('enc:'));
  assert.equal(sealed.linkToken, 'link-sandbox');

  const open = unsealBankSyncMetadata(sealed);
  assert.equal(open.accessToken, 'secret-token');
  assert.equal(open.publicToken, 'public-token');

  const redacted = redactBankSyncConnections([{ provider: 'plaid', metadata: sealed }]);
  assert.equal(redacted[0].metadata.accessToken, undefined);
  assert.equal(redacted[0].metadata.hasAccessToken, true);
  assert.equal(redacted[0].metadata.linkToken, 'link-sandbox');
});

test('provider normalize → match score pipeline for mirrored fee', () => {
  const lines = normalizeProviderTransactions([
    {
      amount: 12,
      iso_currency_code: 'SAR',
      name: 'Bank fee INV-22',
      date: '2026-08-10',
      transaction_id: 'fee1',
    },
  ], { provider: 'plaid' });
  assert.equal(lines[0].amount, -12);

  const scored = scoreBankMatchCandidate(
    lines[0],
    {
      id: 'ji1',
      bucket: 'journal',
      amount: -12,
      item: {
        entryDate: '2026-08-10',
        description: 'Bank fee INV-22',
        entryNumber: 'INV-22',
      },
    },
    [{ name: 'Fees', labelContains: 'fee', autoMatchExactAmount: true, priority: 2 }],
  );
  assert.ok(scored.score >= 100);
  assert.ok(scored.reasons.includes('exact_amount'));
});

test('early discount settlement + applied status marks invoice paid', () => {
  const issue = new Date('2026-01-01');
  const schedule = computePaymentSchedule(issue, '2pct_10_net30', 1000);
  const invoice = {
    grandTotal: 1000,
    paidAmount: 0,
    paymentSchedule: schedule.tranches,
    earlyPaymentDiscount: schedule.earlyDiscount,
  };
  const settlement = computePaymentSettlement(invoice, {
    amount: 1000,
    paymentDate: new Date('2026-01-05'),
  });
  assert.ok(settlement.applyEarlyDiscount);
  assert.equal(settlement.cashAmount, 980);
  assert.equal(settlement.targetPaidAmount, 1000);
  invoice.paidAmount = settlement.targetPaidAmount;
  invoice.earlyPaymentDiscount = { ...invoice.earlyPaymentDiscount, applied: true };
  applyPaidAmountStatus(invoice);
  assert.equal(invoice.paymentStatus, 'paid');
  assert.equal(invoice.paidAmount, 1000);
});
