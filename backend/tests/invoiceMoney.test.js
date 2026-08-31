import test from 'node:test';
import assert from 'node:assert/strict';
import { roundMoney, vatHalala } from '../utils/money.js';
import {
  applyPaidAmountStatus,
  resolvePaymentStatus,
  isOverpay,
  paymentExceedsRemaining,
  canRecordPayment,
  canRecordBillPayment,
} from '../utils/invoicePaymentStatus.js';
import { computeDueDateFromPaymentTerms } from '../utils/invoicePaymentTerms.js';
import { isPastDueInRiyadh, startOfDayInRiyadh } from '../utils/riyadhTime.js';

test('IEEE: 15% VAT on 10.01 is 1.50 halalas, not 1.5014999999999998', () => {
  const ieee = 10.01 * 0.15;
  assert.notEqual(ieee, 1.5);
  assert.equal(vatHalala(10.01, 15), 1.5);
  assert.equal(roundMoney(ieee), 1.5);
});

test('IEEE: 0.1 + 0.2', () => {
  assert.equal(roundMoney(0.1 + 0.2), 0.3);
});

test('line VAT then sum matches invoice totals for two 10.01 lines at 15%', () => {
  const lineTax = vatHalala(10.01, 15);
  const totalTax = roundMoney(lineTax + lineTax);
  const taxable = roundMoney(10.01 + 10.01);
  const grand = roundMoney(taxable + totalTax);
  assert.equal(lineTax, 1.5);
  assert.equal(totalTax, 3);
  assert.equal(grand, 23.02);
});

test('draft invoices stay unposted regardless of payment method', () => {
  for (const paymentMethod of ['cash', 'card', 'credit']) {
    const invoice = { status: 'draft', paymentMethod, grandTotal: 100, paidAmount: 50 };
    resolvePaymentStatus(invoice);
    assert.equal(invoice.paymentStatus, 'unposted', paymentMethod);
    assert.equal(invoice.paidAmount, 0, paymentMethod);
  }
});

test('resolvePaymentStatus: cash / card / bank_transfer mark paid in full', () => {
  for (const paymentMethod of ['cash', 'card', 'bank_transfer']) {
    const invoice = { paymentMethod, grandTotal: 115.5, paidAmount: 0 };
    resolvePaymentStatus(invoice);
    assert.equal(invoice.paymentStatus, 'paid', paymentMethod);
    assert.equal(invoice.paidAmount, 115.5, paymentMethod);
  }
});

test('credit: zero paid stays pending; partial stays partial; full becomes paid', () => {
  const pending = resolvePaymentStatus({ paymentMethod: 'credit', grandTotal: 100, paidAmount: 0 });
  assert.equal(pending.paymentStatus, 'pending');

  const partial = resolvePaymentStatus({ paymentMethod: 'credit', grandTotal: 100, paidAmount: 40.5 });
  assert.equal(partial.paymentStatus, 'partial');
  assert.equal(partial.paidAmount, 40.5);

  const paid = resolvePaymentStatus({ paymentMethod: 'credit', grandTotal: 100, paidAmount: 100 });
  assert.equal(paid.paymentStatus, 'paid');
});

test('khata / split use paidAmount, not auto-paid', () => {
  const invoice = { paymentMethod: 'khata', grandTotal: 200, paidAmount: 50 };
  resolvePaymentStatus(invoice);
  assert.equal(invoice.paymentStatus, 'partial');
  assert.equal(invoice.paidAmount, 50);
});

test('sequential partials: 30 then +70 => paid', () => {
  const invoice = { paymentMethod: 'credit', grandTotal: 100, paidAmount: 30 };
  applyPaidAmountStatus(invoice);
  assert.equal(invoice.paymentStatus, 'partial');
  invoice.paidAmount = 100;
  applyPaidAmountStatus(invoice);
  assert.equal(invoice.paymentStatus, 'paid');
});

test('applyPaidAmountStatus: overdue when due before Riyadh start of day', () => {
  const due = new Date(startOfDayInRiyadh().getTime() - 24 * 60 * 60 * 1000);
  const invoice = { paymentMethod: 'credit', grandTotal: 100, paidAmount: 0, dueDate: due };
  applyPaidAmountStatus(invoice);
  assert.equal(invoice.paymentStatus, 'overdue');
});

test('overpay: 100.01 on 100 is 400; 100.004 is allowed (halala epsilon)', () => {
  assert.equal(isOverpay(100.01, 100), true);
  assert.equal(isOverpay(100.004, 100), false);
  assert.equal(isOverpay(100, 100), false);
  assert.equal(isOverpay(0, 100), false);
});

test('computeDueDateFromPaymentTerms: net30', () => {
  const issue = new Date('2026-08-01T00:00:00.000Z');
  const due = computeDueDateFromPaymentTerms(issue, 'net30');
  assert.equal(due.getUTCDate(), 31);
  assert.equal(due.getUTCMonth(), 7);
});

test('IEEE: 15% VAT on 99.99 and 1.33 (halala, not binary leftover)', () => {
  assert.equal(vatHalala(99.99, 15), 15);
  assert.equal(vatHalala(1.33, 15), 0.2);
  assert.equal(roundMoney(1.33 * 0.15), 0.2);
});

test('state machine: draft / cancelled / credited block payment; vendor bills use canRecordBillPayment', () => {
  assert.equal(canRecordPayment({ flow: 'sell', status: 'draft' }), false);
  assert.equal(canRecordPayment({ flow: 'sell', status: 'cancelled' }), false);
  assert.equal(canRecordPayment({ flow: 'sell', status: 'credited' }), false);
  assert.equal(canRecordPayment({ flow: 'sell', status: 'approved' }), true);
  assert.equal(canRecordPayment({ flow: 'sell', status: 'pending' }), true);
  assert.equal(canRecordPayment({ flow: 'sell', status: 'sent' }), true);

  assert.equal(canRecordBillPayment({ flow: 'purchase', status: 'draft', invoiceType: '388' }), false);
  assert.equal(canRecordBillPayment({ flow: 'purchase', status: 'approved', invoiceType: '381' }), false);
  assert.equal(canRecordBillPayment({ flow: 'purchase', status: 'approved', invoiceType: '388' }), true);
  assert.equal(canRecordPayment({ flow: 'purchase', status: 'approved', invoiceType: '388' }), true);
});

test('partial payment remaining: 40 then +70 on 100 is 400; +60 is allowed', () => {
  assert.equal(paymentExceedsRemaining(70, 100, 40), true);
  assert.equal(paymentExceedsRemaining(60, 100, 40), false);
  assert.equal(paymentExceedsRemaining(60.01, 100, 40), true);
  assert.equal(paymentExceedsRemaining(0.004, 100, 99.996), false);
});

test('overpay on create maps to HTTP 400 contract', () => {
  const paidAmount = 100.01;
  const grandTotal = 100;
  assert.equal(isOverpay(paidAmount, grandTotal), true);
  const status = isOverpay(paidAmount, grandTotal) ? 400 : 201;
  assert.equal(status, 400);
});

test('isPastDueInRiyadh: future due is not past', () => {
  const tomorrow = new Date(Date.now() + 36 * 60 * 60 * 1000);
  assert.equal(isPastDueInRiyadh(tomorrow), false);
});

test('explicit pending is honored for cash / card / bank_transfer (not forced paid)', () => {
  for (const paymentMethod of ['cash', 'card', 'bank_transfer']) {
    const invoice = { paymentMethod, grandTotal: 100, paidAmount: 0, paymentStatus: 'pending' };
    resolvePaymentStatus(invoice);
    assert.equal(invoice.paymentStatus, 'pending', paymentMethod);
    assert.equal(invoice.paidAmount, 0, paymentMethod);
  }
});

test('explicit unpaid maps to pending and zeros a full paidAmount', () => {
  const invoice = { paymentMethod: 'cash', grandTotal: 100, paidAmount: 100, paymentStatus: 'unpaid' };
  resolvePaymentStatus(invoice);
  assert.equal(invoice.paymentStatus, 'pending');
  assert.equal(invoice.paidAmount, 0);
});

test('explicit paid sets paidAmount to grandTotal even on credit', () => {
  const invoice = { paymentMethod: 'credit', grandTotal: 115.5, paidAmount: 10, paymentStatus: 'paid' };
  resolvePaymentStatus(invoice);
  assert.equal(invoice.paymentStatus, 'paid');
  assert.equal(invoice.paidAmount, 115.5);
});

test('explicit pending with advance paidAmount stays partial', () => {
  const invoice = { paymentMethod: 'cash', grandTotal: 100, paidAmount: 40, paymentStatus: 'pending' };
  resolvePaymentStatus(invoice);
  assert.equal(invoice.paymentStatus, 'partial');
  assert.equal(invoice.paidAmount, 40);
});

test('no explicit status still auto-pays cash', () => {
  const invoice = { paymentMethod: 'cash', grandTotal: 100, paidAmount: 0 };
  resolvePaymentStatus(invoice);
  assert.equal(invoice.paymentStatus, 'paid');
  assert.equal(invoice.paidAmount, 100);
});
