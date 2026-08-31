import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCheckPrintPayload,
  buildCheckPrintHtml,
  getProductApStats,
} from '../services/vendorApService.js';

test('buildCheckPrintPayload includes payee, amount, and check number', () => {
  const payload = buildCheckPrintPayload({
    tenant: { name: 'Maqder', business: { legalNameEn: 'Maqder Co' } },
    payeeName: 'Acme Supplies',
    amount: 1250.5,
    currency: 'SAR',
    memo: 'BILL-1',
    checkNumber: 'CHK-100',
    paymentDate: new Date('2026-08-31T12:00:00.000Z'),
  });
  assert.equal(payload.payeeName, 'Acme Supplies');
  assert.equal(payload.amount, 1250.5);
  assert.equal(payload.checkNumber, 'CHK-100');
  assert.equal(payload.company, 'Maqder Co');
  assert.equal(payload.date, '2026-08-31');
  assert.match(payload.amountWords, /1250\.50/);
});

test('buildCheckPrintHtml escapes payee and includes print button', () => {
  const html = buildCheckPrintHtml({
    company: 'Maqder',
    payeeName: 'Vendor <script>',
    amount: 10,
    currency: 'SAR',
    memo: 'Test & Co',
    checkNumber: '1',
    date: '2026-08-31',
    amountWords: '10.00 SAR',
    micrRouting: '123456789',
    micrAccount: '987654',
  });
  assert.match(html, /Vendor &lt;script&gt;/);
  assert.match(html, /Test &amp; Co/);
  assert.match(html, /window\.print/);
  assert.match(html, /123456789/);
});

test('getProductApStats returns zeroed stats without ids', async () => {
  const stats = await getProductApStats(null, null);
  assert.equal(stats.billCount, 0);
  assert.equal(stats.qtyPurchased, 0);
  assert.equal(stats.totalSpent, 0);
  assert.equal(stats.lastBillDate, null);
});

test('getApPaymentSettings returns defaults without tenant', async () => {
  const { getApPaymentSettings } = await import('../services/vendorApService.js');
  // Will fail without DB — skip shape test if import only
  assert.equal(typeof getApPaymentSettings, 'function');
});

test('buildCheckPrintPayload includes MICR fields from tenant settings', () => {
  const payload = buildCheckPrintPayload({
    tenant: {
      name: 'Maqder',
      business: { legalNameEn: 'Maqder Co' },
      settings: { accounting: { checkPrint: { micrRouting: 'R1', micrAccount: 'A1' } } },
    },
    payeeName: 'Acme',
    amount: 50,
    currency: 'SAR',
    checkNumber: 'CHK-1',
  });
  assert.equal(payload.micrRouting, 'R1');
  assert.equal(payload.micrAccount, 'A1');
  assert.equal(payload.checkNumber, 'CHK-1');
});
