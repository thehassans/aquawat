import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { clampInvoiceLinesToDelivered } from '../services/sales/invoicingPolicyPure.js';
import { evaluatePriceRules } from '../services/sales/pricingEngine.js';
import { computeQuotationValidUntil, shouldLockSellOrder } from '../services/sales/salesLifecycle.js';
import {
  generateZatcaQr,
  validateZatcaQrFields,
  decodeZatcaQr,
} from '../lib/zatcaQr.js';

describe('Sales blueprint — delivered invoicing clamp', () => {
  it('caps goods qty to delivered and skips undelivered goods', () => {
    const delivered = new Map([
      ['p1:', 3],
      ['p2:v1', 1],
    ]);
    const { adjusted, warnings } = clampInvoiceLinesToDelivered(
      [
        { productId: 'p1', quantity: 10, productName: 'A' },
        { productId: 'p2', variantId: 'v1', quantity: 5, productName: 'B' },
        { productId: 'p3', quantity: 2, productName: 'C' },
        { productId: 'svc', quantity: 1, productType: 'service', productName: 'Install' },
      ],
      delivered,
    );

    assert.equal(adjusted.length, 3);
    assert.equal(adjusted[0].quantity, 3);
    assert.equal(adjusted[1].quantity, 1);
    assert.equal(adjusted[2].productType, 'service');
    assert.ok(warnings.some((w) => w.includes('reduced from 10 to 3')));
    assert.ok(warnings.some((w) => w.includes('No delivered quantity for C')));
  });

  it('returns empty adjusted when nothing delivered', () => {
    const { adjusted } = clampInvoiceLinesToDelivered(
      [{ productId: 'p1', quantity: 2 }],
      new Map(),
    );
    assert.equal(adjusted.length, 0);
  });
});

describe('Sales blueprint — pricing engine', () => {
  it('prefers highest matching volume tier and ignores future promos', () => {
    const price = evaluatePriceRules({
      basePrice: 100,
      cost: 50,
      quantity: 20,
      rules: [
        { minQuantity: 10, discountPercent: 10 },
        { minQuantity: 1, discountPercent: 5 },
        { minQuantity: 50, validFrom: new Date(Date.now() + 86400000).toISOString(), discountPercent: 50 },
      ],
    });
    assert.equal(price, 90);
  });

  it('evaluates cost-plus formula', () => {
    const price = evaluatePriceRules({
      basePrice: 100,
      cost: 50,
      quantity: 1,
      rules: [{ minQuantity: 1, ruleType: 'formula', formula: 'cost * 1.2' }],
    });
    assert.equal(price, 60);
  });
});

describe('Sales blueprint — lifecycle helpers', () => {
  it('adds quotation validity days', () => {
    const until = computeQuotationValidUntil(new Date('2026-01-01T00:00:00.000Z'), 15);
    assert.ok(until.toISOString().startsWith('2026-01-16'));
  });

  it('locks only approved sell orders when setting enabled', () => {
    assert.equal(shouldLockSellOrder({ flow: 'sell', status: 'approved' }, { lockConfirmedOrders: true }), true);
    assert.equal(shouldLockSellOrder({ flow: 'sell', status: 'draft' }, { lockConfirmedOrders: true }), false);
  });
});

describe('Sales blueprint — ZATCA TLV QR', () => {
  it('validates and round-trips TLV payload', () => {
    const fields = {
      sellerName: 'Maqder',
      vatNumber: '300000000000003',
      invoiceDate: '2026-01-15T10:00:00Z',
      totalAmount: 115,
      vatAmount: 15,
    };
    const v = validateZatcaQrFields(fields);
    assert.equal(v.valid, true);
    const qr = generateZatcaQr(fields);
    assert.equal(typeof qr, 'string');
    assert.ok(qr.length > 20);
    const decoded = decodeZatcaQr(qr);
    assert.equal(decoded.sellerName, 'Maqder');
    assert.equal(decoded.vatNumber, '300000000000003');
    assert.equal(decoded.totalAmount, '115.00');
    assert.equal(decoded.vatAmount, '15.00');
  });
});
