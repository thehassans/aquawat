import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_PRODUCT_TYPE,
  formatProductTypeBilingual,
  isStockTrackedProductType,
  normalizeProductType,
  stampLineProductTypes,
} from '../utils/productType.js';

test('normalizeProductType defaults missing and unknown values to goods', () => {
  assert.equal(normalizeProductType(undefined), DEFAULT_PRODUCT_TYPE);
  assert.equal(normalizeProductType(''), 'goods');
  assert.equal(normalizeProductType('GOODS'), 'goods');
  assert.equal(normalizeProductType('service'), 'service');
  assert.equal(normalizeProductType('book'), 'goods');
});

test('services are not stock-tracked; goods are', () => {
  assert.equal(isStockTrackedProductType('service'), false);
  assert.equal(isStockTrackedProductType('goods'), true);
  assert.equal(isStockTrackedProductType(null), true);
});

test('stampLineProductTypes copies catalog type when the line is missing it', () => {
  const catalog = new Map([
    ['p1', { productType: 'service' }],
    ['p2', { productType: 'goods' }],
  ]);
  const stamped = stampLineProductTypes([
    { productId: 'p1', productName: 'Install' },
    { productId: 'p2', productName: 'Cable', productType: 'service' },
    { productName: 'Ad-hoc' },
  ], catalog);

  assert.equal(stamped[0].productType, 'service');
  assert.equal(stamped[1].productType, 'service');
  assert.equal(stamped[2].productType, 'goods');
});

test('bilingual type labels stay goods vs service', () => {
  assert.equal(formatProductTypeBilingual('goods'), 'Goods / بضاعة');
  assert.equal(formatProductTypeBilingual('service'), 'Service / خدمة');
});
