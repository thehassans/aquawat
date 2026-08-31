import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeProviderTransactions,
  demoTransactions,
} from '../services/bankSyncProviderClient.js';
import { scoreBankMatchCandidate, tokenizeMatchText } from '../utils/bankMatchScore.js';

test('tokenizeMatchText splits bilingual labels', () => {
  const tokens = tokenizeMatchText('INV-100 Stripe fee', 'payment');
  assert.ok(tokens.includes('inv-100') || tokens.includes('stripe'));
  assert.ok(tokens.includes('payment'));
});

test('scoreBankMatchCandidate exact amount + direction scores high', () => {
  const scored = scoreBankMatchCandidate(
    { amount: -500, date: '2026-08-01', label: 'Vendor pay INV-9', reference: 'INV-9' },
    {
      id: '1',
      bucket: 'journal',
      amount: -500,
      item: {
        entryDate: '2026-08-01',
        description: 'Vendor pay INV-9',
        entryNumber: 'INV-9',
      },
    },
    [],
  );
  assert.ok(scored.score >= 100);
  assert.ok(scored.reasons.includes('exact_amount'));
  assert.ok(scored.reasons.includes('direction'));
});

test('scoreBankMatchCandidate wrong direction is penalized', () => {
  const scored = scoreBankMatchCandidate(
    { amount: 100, date: '2026-08-01', label: 'Deposit' },
    {
      id: '2',
      bucket: 'journal',
      amount: -100,
      item: { entryDate: '2026-08-01', description: 'Deposit' },
    },
    [],
  );
  assert.ok(scored.reasons.includes('wrong_direction'));
  const aligned = scoreBankMatchCandidate(
    { amount: 100, date: '2026-08-01', label: 'Deposit' },
    {
      id: '2b',
      bucket: 'journal',
      amount: 100,
      item: { entryDate: '2026-08-01', description: 'Deposit' },
    },
    [],
  );
  assert.ok(scored.score < aligned.score);
});

test('normalizeProviderTransactions inverts Plaid outflow convention', () => {
  const lines = normalizeProviderTransactions([
    {
      amount: 25.5,
      iso_currency_code: 'SAR',
      name: 'Bank fee',
      date: '2026-08-01',
      transaction_id: 'tx1',
    },
    {
      amount: -100,
      iso_currency_code: 'SAR',
      name: 'Deposit',
      date: '2026-08-02',
      transaction_id: 'tx2',
    },
  ], { provider: 'plaid' });
  assert.equal(lines.length, 2);
  assert.equal(lines[0].amount, -25.5);
  assert.equal(lines[1].amount, 100);
});

test('demoTransactions returns usable statement lines', () => {
  const lines = demoTransactions('plaid');
  assert.ok(lines.length >= 2);
  assert.ok(lines.every((l) => Math.abs(l.amount) > 0));
});

test('recon models boost exact-amount auto-match', () => {
  const scored = scoreBankMatchCandidate(
    { amount: 200, date: '2026-08-01', label: 'Stripe payout', reference: '' },
    {
      id: '3',
      bucket: 'outstanding_receipt',
      amount: 200,
      item: { entryDate: '2026-08-01', description: 'Receipt' },
    },
    [{ name: 'Stripe', labelContains: 'stripe', autoMatchExactAmount: true, priority: 5 }],
  );
  assert.ok(scored.reasons.some((r) => r.startsWith('model:')));
  assert.ok(scored.reasons.some((r) => r.startsWith('model_exact:')));
  assert.ok(scored.score >= 115);
});
