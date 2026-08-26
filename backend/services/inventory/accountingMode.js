/**
 * Tenant inventory accounting maturity modes (2026).
 *
 * ops_only     — qty / transfers only; no layers, no stock journals
 * costing      — AVCO/FIFO layers for ops reports; no stock GL
 * full_accounting — layers + Anglo-Saxon stock journals (valuation / interim / output)
 */

export const INVENTORY_ACCOUNTING_MODES = Object.freeze([
  'ops_only',
  'costing',
  'full_accounting',
]);

export function deriveInventoryAccountingMode(settings = {}) {
  const evaluationOn = settings.inventoryEvaluationEnabled !== false;
  const stockGlOn = settings.stockAccountingEnabled !== false;
  if (evaluationOn && stockGlOn) return 'full_accounting';
  if (evaluationOn && !stockGlOn) return 'costing';
  return 'ops_only';
}

/**
 * Map a mode to the two underlying boolean flags.
 */
export function flagsForInventoryAccountingMode(mode) {
  switch (mode) {
    case 'full_accounting':
      return { inventoryEvaluationEnabled: true, stockAccountingEnabled: true };
    case 'costing':
      return { inventoryEvaluationEnabled: true, stockAccountingEnabled: false };
    case 'ops_only':
    default:
      return { inventoryEvaluationEnabled: false, stockAccountingEnabled: false };
  }
}

export function resolveInventoryAccountingMode(settings = {}) {
  const stored = settings.inventoryAccountingMode;
  if (INVENTORY_ACCOUNTING_MODES.includes(stored)) return stored;
  return deriveInventoryAccountingMode(settings);
}

export function isFullInventoryAccounting(settings = {}) {
  return resolveInventoryAccountingMode(settings) === 'full_accounting';
}

export function isInventoryEvaluationOn(settings = {}) {
  const mode = resolveInventoryAccountingMode(settings);
  return mode === 'costing' || mode === 'full_accounting';
}

export function isStockGlOn(settings = {}) {
  return resolveInventoryAccountingMode(settings) === 'full_accounting';
}
