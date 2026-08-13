import test from 'node:test';
import assert from 'node:assert/strict';
import { roundMoney } from '../utils/money.js';
import { applyPaidAmountStatus, resolvePaymentStatus, isOverpay } from '../utils/invoicePaymentStatus.js';
import { computeDueDateFromPaymentTerms } from '../utils/invoicePaymentTerms.js';
import { isPastDueInRiyadh, startOfDayInRiyadh } from '../utils/riyadhTime.js';

test('roundMoney: 15% of 10.01 is 1.50 (halala), not IEEE 1.5015', () => {
  assert.equal(roundMoney(10.01 * 0.15), 1.5);
});

test('roundMoney: 0.1 + 0.2', () => {
  assert.equal(roundMoney(0.1 + 0.2), 0.3);
});

test('resolvePaymentStatus: cash sell is paid in full', () => {
  const invoice = { paymentMethod: 'cash', grandTotal: 115, paidAmount: 0 };
  resolvePaymentStatus(invoice);
  assert.equal(invoice.paymentStatus, 'paid');
  assert.equal(invoice.paidAmount, 115);
});

test('resolvePaymentStatus: credit partial stays partial', () => {
  const invoice = { paymentMethod: 'credit', grandTotal: 100, paidAmount: 40 };
  resolvePaymentStatus(invoice);
  assert.equal(invoice.paymentStatus, 'partial');
  assert.equal(invoice.paidAmount, 40);
});

test('applyPaidAmountStatus: overdue when due before Riyadh start of day', () => {
  const due = new Date(startOfDayInRiyadh().getTime() - 24 * 60 * 60 * 1000);
  const invoice = { paymentMethod: 'credit', grandTotal: 100, paidAmount: 0, dueDate: due };
  applyPaidAmountStatus(invoice);
  assert.equal(invoice.paymentStatus, 'overdue');
});

test('isOverpay: 100.01 on 100 is rejected; 100.004 is not', () => {
  assert.equal(isOverpay(100.01, 100), true);
  assert.equal(isOverpay(100.004, 100), false);
  assert.equal(isOverpay(100, 100), false);
});

test('computeDueDateFromPaymentTerms: net30', () => {
  const issue = new Date('2026-08-01T00:00:00.000Z');
  const due = computeDueDateFromPaymentTerms(issue, 'net30');
  assert.equal(due.getUTCDate(), 31);
  assert.equal(due.getUTCMonth(), 7);
});

test('isPastDueInRiyadh: future due is not past', () => {
  const tomorrow = new Date(Date.now() + 36 * 60 * 60 * 1000);
  assert.equal(isPastDueInRiyadh(tomorrow), false);
});
