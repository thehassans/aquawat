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
