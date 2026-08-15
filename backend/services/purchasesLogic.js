import { isStockTrackedProductType, normalizeProductType } from '../utils/productType.js';

export class PurchasesValidationError extends Error {
  constructor(message, code = 'VALIDATION') {
    super(message);
    this.name = 'PurchasesValidationError';
    this.code = code;
  }
}

export function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function round2(value) {
  return Math.round((toNumber(value) + Number.EPSILON) * 100) / 100;
}

export function remainingReceivable(line = {}) {
  return Math.max(0, toNumber(line.quantityOrdered) - toNumber(line.quantityReceived));
}

export function remainingReturnable(line = {}) {
  return Math.max(0, toNumber(line.quantityReceived) - toNumber(line.quantityReturned));
}

export function poReceiveStatus(lines = []) {
  const stockLines = (lines || []).filter((line) => isStockTrackedProductType(line.productType));
  const relevant = stockLines.length ? stockLines : (lines || []);
  if (!relevant.length) return 'received';
  const anyReceived = relevant.some((line) => toNumber(line.quantityReceived) > 0);
  const fullyReceived = relevant.every(
    (line) => toNumber(line.quantityReceived) >= toNumber(line.quantityOrdered)
  );
  if (fullyReceived) return 'received';
  if (anyReceived) return 'partially_received';
  return null;
}

export function matchPoLine(poLines, receiveLine, index) {
  const lines = Array.isArray(poLines) ? poLines : [];
  if (receiveLine?.poLineIndex != null && lines[receiveLine.poLineIndex]) {
    return lines[receiveLine.poLineIndex];
  }
  const productId = receiveLine?.productId ? String(receiveLine.productId) : '';
  if (productId) {
    const match = lines.find((line) => String(line.productId || '') === productId);
    if (match) return match;
  }
  if (index != null && lines[index]) return lines[index];
  return null;
}

/**
 * Apply GRN receive quantities onto PO lines. Throws if any goods/service line over-receives.
 * Services still consume ordered qty on the PO; callers skip stock for them separately.
 */
export function applyGrnReceiveToPoLines(poLines, receiveLines) {
  const updated = (Array.isArray(poLines) ? poLines : []).map((line) => ({ ...line }));
  const applied = [];

  for (let i = 0; i < (receiveLines || []).length; i += 1) {
    const receiveLine = receiveLines[i] || {};
    const qty = toNumber(receiveLine.quantityReceived ?? receiveLine.quantity, 0);
    if (qty <= 0) continue;

    const target = matchPoLine(updated, receiveLine, i);
    if (!target) {
      throw new PurchasesValidationError('Received line does not match a purchase order line', 'PO_LINE_MISMATCH');
    }

    const remaining = remainingReceivable(target);
    if (qty > remaining + 1e-9) {
      throw new PurchasesValidationError('Received quantity exceeds remaining quantity', 'OVER_RECEIVE');
    }

    target.quantityReceived = round2(toNumber(target.quantityReceived) + qty);
    applied.push({
      productId: receiveLine.productId || target.productId,
      productType: normalizeProductType(receiveLine.productType || target.productType),
      quantity: qty,
      unitCost: toNumber(receiveLine.costPrice ?? receiveLine.unitCost ?? target.unitCost),
    });
  }

  return {
    lines: updated,
    applied,
    status: poReceiveStatus(updated),
  };
}

export function applyReturnToReceivedLines(receivedLines, returnLines) {
  const updated = (Array.isArray(receivedLines) ? receivedLines : []).map((line) => ({ ...line }));
  const applied = [];

  for (let i = 0; i < (returnLines || []).length; i += 1) {
    const returnLine = returnLines[i] || {};
    const qty = toNumber(returnLine.quantityReturned ?? returnLine.quantity, 0);
    if (qty <= 0) continue;

    let target = null;
    if (returnLine.grnLineIndex != null && updated[returnLine.grnLineIndex]) {
      target = updated[returnLine.grnLineIndex];
    } else if (returnLine.productId) {
      target = updated.find((line) => String(line.productId || '') === String(returnLine.productId));
    } else if (updated[i]) {
      target = updated[i];
    }

    if (!target) {
      throw new PurchasesValidationError('Return line does not match a received line', 'RETURN_LINE_MISMATCH');
    }

    const remaining = remainingReturnable(target);
    if (qty > remaining + 1e-9) {
      throw new PurchasesValidationError('Return quantity exceeds received quantity', 'OVER_RETURN');
    }

    target.quantityReturned = round2(toNumber(target.quantityReturned) + qty);
    applied.push({
      productId: returnLine.productId || target.productId,
      productType: normalizeProductType(returnLine.productType || target.productType),
      quantity: qty,
    });
  }

  return { lines: updated, applied };
}

export function stockDeltaForLine({ productType, quantity, direction = 'in' } = {}) {
  const qty = toNumber(quantity, 0);
  if (qty <= 0) return 0;
  if (!isStockTrackedProductType(productType)) return 0;
  return direction === 'out' ? -qty : qty;
}

/**
 * Allocate extra landed cost across goods lines. Last line absorbs rounding so the
 * allocated amounts always sum to the extra cost.
 */
export function allocateLandedCosts({ totalCost, allocations = [], method = 'by_value' } = {}) {
  const total = round2(totalCost);
  const rows = (Array.isArray(allocations) ? allocations : []).map((row) => ({ ...row }));
  if (!rows.length) {
    return { allocations: [], totalAllocated: 0 };
  }

  const bases = rows.map((row) => {
    if (method === 'by_quantity') return Math.max(0, toNumber(row.quantity));
    if (method === 'by_weight') return Math.max(0, toNumber(row.weight));
    if (method === 'equal') return 1;
    return Math.max(0, toNumber(row.lineValue));
  });
  const totalBasis = bases.reduce((sum, basis) => sum + basis, 0);

  let allocatedSoFar = 0;
  const result = rows.map((row, idx) => {
    const isLast = idx === rows.length - 1;
    let allocatedCost;
    if (totalBasis <= 0) {
      allocatedCost = isLast ? round2(total - allocatedSoFar) : round2(total / rows.length);
    } else if (isLast) {
      allocatedCost = round2(total - allocatedSoFar);
    } else {
      allocatedCost = round2(total * (bases[idx] / totalBasis));
    }
    allocatedSoFar = round2(allocatedSoFar + allocatedCost);
    const qty = toNumber(row.quantity, 1) || 1;
    const unitLandedCost = round2(allocatedCost / qty);
    const totalLandedUnitCost = round2(toNumber(row.unitCostBeforeLanded) + unitLandedCost);
    return {
      ...row,
      allocatedCost,
      unitLandedCost,
      totalLandedUnitCost,
    };
  });

  return { allocations: result, totalAllocated: allocatedSoFar };
}

export function nextDocumentNumber(prefix, lastNumber, pad = 3) {
  let seq = 1;
  if (lastNumber) {
    const parts = String(lastNumber).split('-');
    const lastSeq = Number(parts[parts.length - 1]);
    if (Number.isFinite(lastSeq)) seq = lastSeq + 1;
  }
  return `${prefix}-${String(seq).padStart(pad, '0')}`;
}
