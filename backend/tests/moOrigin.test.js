import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatMoOrigin, moProduceOrigin, parseMoOrigin } from '../services/inventory/moOrigin.js';

test('parseMoOrigin — product only', () => {
  assert.deepEqual(parseMoOrigin('MO:abc123'), {
    productId: 'abc123',
    variantId: null,
    qty: '1',
  });
});

test('parseMoOrigin — product + variant (legacy)', () => {
  const vid = 'a'.repeat(24);
  assert.deepEqual(parseMoOrigin(`MO:abc123:${vid}`), {
    productId: 'abc123',
    variantId: vid,
    qty: '1',
  });
});

test('parseMoOrigin — full origin with qty', () => {
  const vid = 'b'.repeat(24);
  assert.deepEqual(parseMoOrigin(`MO:abc123:${vid}:5`), {
    productId: 'abc123',
    variantId: vid,
    qty: '5',
  });
});

test('formatMoOrigin round-trip', () => {
  const vid = 'c'.repeat(24);
  const origin = formatMoOrigin({ productId: 'abc123', variantId: vid, qty: '3' });
  assert.equal(origin, `MO:abc123:${vid}:3`);
  assert.deepEqual(parseMoOrigin(origin), {
    productId: 'abc123',
    variantId: vid,
    qty: '3',
  });
});

test('moProduceOrigin links consume transfer', () => {
  assert.equal(moProduceOrigin('tid123'), 'MO-produce:tid123');
});
