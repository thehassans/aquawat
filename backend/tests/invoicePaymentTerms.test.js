import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeDueDateFromPaymentTerms,
  computePaymentSchedule,
  ensureInvoiceDueDate,
} from '../utils/invoicePaymentTerms.js';
import { buildReceivableDebitLines, buildPayableCreditLines } from '../services/accountingService.js';

test('installment term uses latest tranche due date', () => {
  const issue = new Date('2026-01-01');
  const due = computeDueDateFromPaymentTerms(issue, '30_now_60_balance');
  assert.equal(due.toISOString().slice(0, 10), '2026-03-02');
  const schedule = computePaymentSchedule(issue, '30_now_60_balance', 1000);
  assert.equal(schedule.tranches.length, 2);
  assert.equal(schedule.tranches[0].amount, 300);
  assert.equal(schedule.tranches[1].amount, 700);
});

test('early discount term sets standard due and discount metadata', () => {
  const issue = new Date('2026-01-01');
  const schedule = computePaymentSchedule(issue, '2pct_10_net30', 1000);
  assert.equal(schedule.tranches.length, 2);
  assert.equal(schedule.earlyDiscount.discountedAmount, 980);
  assert.equal(schedule.dueDate.toISOString().slice(0, 10), '2026-01-31');
});

test('ensureInvoiceDueDate attaches payment schedule', () => {
  const data = ensureInvoiceDueDate({
    issueDate: new Date('2026-01-01'),
    paymentTerms: '30_now_60_balance',
    grandTotal: 500,
  });
  assert.ok(data.dueDate);
  assert.equal(data.paymentSchedule.length, 2);
  assert.equal(data.paymentSchedule[0].amount, 150);
});

test('buildReceivableDebitLines splits AR debits by schedule', () => {
  const ar = { _id: 'ar1', code: '1200' };
  const issue = new Date('2026-01-01');
  const schedule = computePaymentSchedule(issue, '30_now_60_balance', 1000).tranches;
  const lines = buildReceivableDebitLines({
    ar,
    gross: 1000,
    paymentSchedule: schedule,
    description: 'Invoice INV-1',
  });
  assert.equal(lines.length, 2);
  assert.equal(lines[0].debit, 300);
  assert.equal(lines[1].debit, 700);
  assert.ok(lines[1].dueDate);
});

test('buildPayableCreditLines splits AP credits by schedule', () => {
  const ap = { _id: 'ap1', code: '2100' };
  const issue = new Date('2026-01-01');
  const schedule = computePaymentSchedule(issue, '30_now_60_balance', 1000).tranches;
  const lines = buildPayableCreditLines({
    ap,
    gross: 1000,
    paymentSchedule: schedule,
    description: 'Bill BILL-1',
  });
  assert.equal(lines.length, 2);
  assert.equal(lines[0].credit, 300);
  assert.equal(lines[1].credit, 700);
  assert.ok(lines[1].dueDate);
});
