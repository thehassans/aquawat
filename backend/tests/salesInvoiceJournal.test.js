import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSalesInvoiceJournalLines } from '../services/accountingService.js';

test('sales invoice journal with default sales account balances', () => {
  const lines = buildSalesInvoiceJournalLines({
    netAmount: 100,
    taxAmount: 15,
    ar: { _id: 'ar', code: '1200' },
    vatOut: { _id: 'vat', code: '2100' },
    defaultSales: { _id: 'sales', code: '4000' },
  });
  const debit = lines.reduce((s, l) => s + l.debit, 0);
  const credit = lines.reduce((s, l) => s + l.credit, 0);
  assert.equal(debit, credit);
  assert.equal(debit, 115);
});

test('sales invoice journal splits revenue by product income accounts', () => {
  const lines = buildSalesInvoiceJournalLines({
    netAmount: 100,
    taxAmount: 15,
    ar: { _id: 'ar', code: '1200' },
    vatOut: { _id: 'vat', code: '2100' },
    revenueCredits: [
      { account: { _id: 'inc-a', code: '4000' }, amount: 60 },
      { account: { _id: 'inc-b', code: '4100' }, amount: 40 },
    ],
  });
  assert.equal(lines.filter((l) => l.credit > 0 && l.accountCode !== '2100').length, 2);
  const debit = lines.reduce((s, l) => s + l.debit, 0);
  const credit = lines.reduce((s, l) => s + l.credit, 0);
  assert.equal(debit, credit);
});
