import test from 'node:test';
import assert from 'node:assert/strict';
import {
  deriveInventoryAccountingMode,
  flagsForInventoryAccountingMode,
  resolveInventoryAccountingMode,
  isFullInventoryAccounting,
  isInventoryEvaluationOn,
  isStockGlOn,
} from '../services/inventory/accountingMode.js';

test('derive mode from legacy booleans', () => {
  assert.equal(deriveInventoryAccountingMode({
    inventoryEvaluationEnabled: true,
    stockAccountingEnabled: true,
  }), 'full_accounting');
  assert.equal(deriveInventoryAccountingMode({
    inventoryEvaluationEnabled: true,
    stockAccountingEnabled: false,
  }), 'costing');
  assert.equal(deriveInventoryAccountingMode({
    inventoryEvaluationEnabled: false,
    stockAccountingEnabled: false,
  }), 'ops_only');
});

test('stored mode wins over booleans', () => {
  assert.equal(resolveInventoryAccountingMode({
    inventoryAccountingMode: 'ops_only',
    inventoryEvaluationEnabled: true,
    stockAccountingEnabled: true,
  }), 'ops_only');
});

test('flagsForInventoryAccountingMode syncs booleans', () => {
  assert.deepEqual(flagsForInventoryAccountingMode('full_accounting'), {
    inventoryEvaluationEnabled: true,
    stockAccountingEnabled: true,
  });
  assert.deepEqual(flagsForInventoryAccountingMode('costing'), {
    inventoryEvaluationEnabled: true,
    stockAccountingEnabled: false,
  });
  assert.deepEqual(flagsForInventoryAccountingMode('ops_only'), {
    inventoryEvaluationEnabled: false,
    stockAccountingEnabled: false,
  });
});

test('helpers for evaluation and GL', () => {
  assert.equal(isFullInventoryAccounting({ inventoryAccountingMode: 'full_accounting' }), true);
  assert.equal(isInventoryEvaluationOn({ inventoryAccountingMode: 'costing' }), true);
  assert.equal(isStockGlOn({ inventoryAccountingMode: 'costing' }), false);
  assert.equal(isStockGlOn({ inventoryAccountingMode: 'ops_only' }), false);
});

test('ops_only disables evaluation even if legacy booleans were true when mode stored', () => {
  assert.equal(isInventoryEvaluationOn({
    inventoryAccountingMode: 'ops_only',
    inventoryEvaluationEnabled: true,
  }), false);
});

test('missing mode derives full_accounting from legacy defaults (both on)', () => {
  assert.equal(resolveInventoryAccountingMode({}), 'full_accounting');
  assert.equal(resolveInventoryAccountingMode({
    inventoryEvaluationEnabled: false,
    stockAccountingEnabled: false,
  }), 'ops_only');
});

test('valuation menu flag respects accounting mode', async () => {
  const { FLAG_MAP } = await import('../services/inventory/menu.js');
  const valuation = FLAG_MAP.valuation;
  assert.equal(valuation({ inventoryAccountingMode: 'ops_only', groupLandedCosts: false }), false);
  assert.equal(valuation({ inventoryAccountingMode: 'ops_only', groupLandedCosts: true }), true);
  assert.equal(valuation({ inventoryAccountingMode: 'costing' }), true);
  assert.equal(valuation({ inventoryAccountingMode: 'full_accounting' }), true);
  // Missing mode + evaluation off → ops_only via derive → hide unless landed costs
  assert.equal(valuation({
    inventoryEvaluationEnabled: false,
    stockAccountingEnabled: false,
    groupLandedCosts: false,
  }), false);
  // Missing mode + both legacy flags on → full_accounting
  assert.equal(valuation({}), true);
});
