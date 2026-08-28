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

export function computePurchaseLineTotals(lineItems = []) {
  const items = Array.isArray(lineItems) ? lineItems : [];
  let subtotal = 0;
  let totalTax = 0;
  const lines = items.map((li) => {
    const quantityOrdered = toNumber(li?.quantityOrdered ?? li?.quantity, 0);
    const unitCost = toNumber(li?.unitCost, 0);
    const taxRate = toNumber(li?.taxRate, 15);
    const lineSubtotal = quantityOrdered * unitCost;
    const lineTax = lineSubtotal * (taxRate / 100);
    const lineTotal = lineSubtotal + lineTax;
    subtotal += lineSubtotal;
    totalTax += lineTax;
    return { lineSubtotal, lineTax, lineTotal };
  });
  return { subtotal, totalTax, grandTotal: subtotal + totalTax, lines };
}

export function round2(value) {
  return Math.round((toNumber(value) + Number.EPSILON) * 100) / 100;
}

export function remainingReceivable(line = {}) {
  const netReceived = Math.max(0, toNumber(line.quantityReceived) - toNumber(line.quantityReturned));
  return Math.max(0, toNumber(line.quantityOrdered) - netReceived);
}

export function buildOpenReceiveLines(po) {
  return (Array.isArray(po?.lineItems) ? po.lineItems : []).map((li) => {
    const product = li?.productId && typeof li.productId === 'object' && li.productId._id ? li.productId : null;
    const ordered = toNumber(li?.quantityOrdered ?? li?.quantity);
    const remaining = remainingReceivable(li);
    return {
      productId: product?._id || li?.productId || undefined,
      variantId: li?.variantId?._id || li?.variantId || undefined,
      productName: product?.nameEn || product?.nameAr || li?.manualName || li?.description || '',
      barcode: product?.barcode || '',
      productType: normalizeProductType(li?.productType || product?.productType),
      uom: li?.uom || product?.unitOfMeasure || '',
      quantityOrdered: ordered,
      quantityReceived: remaining,
      remaining,
      costPrice: toNumber(li?.unitCost ?? li?.costPrice),
    };
  }).filter((line) => line.remaining > 0);
}

export function summarizeOpenPo(po) {
  const lines = buildOpenReceiveLines(po);
  return {
    lines,
    remainingQty: lines.reduce((sum, line) => sum + toNumber(line.remaining), 0),
    remainingValue: round2(lines.reduce((sum, line) => sum + toNumber(line.remaining) * toNumber(line.costPrice), 0)),
  };
}

export function assertDelayedLines(lines = []) {
  for (const line of Array.isArray(lines) ? lines : []) {
    if (!line?.isDelayed) continue;
    if (!String(line.delayReason || '').trim()) {
      throw new PurchasesValidationError('Each delayed line needs a delay reason', 'DELAY_REASON_REQUIRED');
    }
  }
}

function idOf(value) {
  if (value == null || value === '') return '';
  if (typeof value === 'object' && value._id) return String(value._id);
  return String(value);
}

/** Match PO/GRN line by productId, preferring variantId when provided. */
export function matchPurchaseLine(row, { productId, variantId } = {}) {
  if (String(row?.productId || '') !== String(productId || '')) return false;
  const wantVariant = variantId ? String(variantId) : '';
  const rowVariant = row?.variantId ? String(row.variantId) : '';
  if (wantVariant) return rowVariant === wantVariant;
  return true;
}

function nameSet(values) {
  return new Set(
    (Array.isArray(values) ? values : [])
      .map((value) => String(value || '').trim().toLowerCase())
      .filter(Boolean)
  );
}

export function buildPoReceivingLedger({ lineItems = [], grns = [] } = {}) {
  const lines = (Array.isArray(lineItems) ? lineItems : []).map((li, index) => {
    const product = li?.productId && typeof li.productId === 'object' ? li.productId : null;
    return {
      index,
      productId: idOf(product || li?.productId),
      variantId: idOf(li?.variantId),
      sku: product?.sku || '',
      productName: product?.nameEn || li?.manualName || li?.description || '',
      productNameAr: product?.nameAr || li?.manualName || li?.description || '',
      uom: li?.uom || product?.unitOfMeasure || '',
      quantityOrdered: toNumber(li?.quantityOrdered ?? li?.quantity),
      quantityReceived: toNumber(li?.quantityReceived),
      quantityReturned: toNumber(li?.quantityReturned),
      remaining: remainingReceivable(li),
      names: nameSet([product?.nameEn, product?.nameAr, li?.manualName, li?.description]),
      receivedEvents: [],
      delayedEvents: [],
    };
  });

  const unmatched = [];
  for (const grn of Array.isArray(grns) ? grns : []) {
    if (grn?.status === 'cancelled') continue;
    for (const line of Array.isArray(grn?.lines) ? grn.lines : []) {
      const event = {
        grnId: grn._id,
        grnNumber: grn.grnNumber || '',
        date: grn.dateReceived || grn.createdAt || null,
        warehouse: grn.warehouseId || null,
        productName: line.productName || '',
        quantity: toNumber(line.isDelayed ? Math.max(0, line.quantityOrdered - line.quantityReceived) : line.quantityReceived),
        quantityReceived: toNumber(line.quantityReceived),
        quantityOrdered: toNumber(line.quantityOrdered),
        isDelayed: Boolean(line.isDelayed),
        delayedUntil: line.delayedUntil || null,
        delayReason: String(line.delayReason || '').trim(),
        notes: String(line.notes || '').trim(),
        status: grn.status,
      };
      const pid = idOf(line.productId);
      const vid = idOf(line.variantId);
      const pname = String(line.productName || '').trim().toLowerCase();
      const match = lines.find((row) =>
        matchPurchaseLine(row, { productId: pid, variantId: vid })
        || ((pid && row.productId && pid === String(row.productId) && !vid && !row.variantId)
          || (pname && row.names.has(pname)))
      );
      if (!match) {
        unmatched.push(event);
        continue;
      }
      if (event.isDelayed && match.remaining > 0) match.delayedEvents.push(event);
      else if (event.quantityReceived > 0) match.receivedEvents.push(event);
    }
  }

  const displayLines = lines.map(({ names, ...rest }) => rest);
  const delayedCount = displayLines.reduce((sum, row) => sum + row.delayedEvents.length, 0);
  const receivedCount = displayLines.reduce((sum, row) => sum + row.receivedEvents.length, 0);

  return {
    lines: displayLines,
    unmatched,
    delayedCount,
    receivedCount,
    hasActivity: delayedCount + receivedCount + unmatched.length > 0,
  };
}

export function remainingReturnable(line = {}) {
  return Math.max(0, toNumber(line.quantityReceived) - toNumber(line.quantityReturned));
}

export function poReceiveStatus(lines = []) {
  const stockLines = (lines || []).filter((line) => isStockTrackedProductType(line.productType));
  const relevant = stockLines.length ? stockLines : (lines || []);
  if (!relevant.length) return 'approved';
  const totalOrdered = relevant.reduce((sum, line) => sum + toNumber(line.quantityOrdered ?? line.quantity, 0), 0);
  const totalReceived = relevant.reduce((sum, line) => sum + toNumber(line.quantityReceived, 0), 0);
  const totalReturned = relevant.reduce((sum, line) => sum + toNumber(line.quantityReturned, 0), 0);
  
  if (totalReceived <= 0 && totalReturned >= totalOrdered && totalOrdered > 0) return 'refunded';
  if (totalReceived <= 0) return 'approved';
  const allLinesFulfilled = relevant.every(
    (line) => (toNumber(line.quantityReceived) + toNumber(line.quantityReturned)) >= toNumber(line.quantityOrdered ?? line.quantity) && toNumber(line.quantityOrdered ?? line.quantity) > 0
  );
  if (allLinesFulfilled && (totalReceived + totalReturned) >= totalOrdered) return 'received';
  return 'partially_received';
}

export function matchPoLine(poLines, receiveLine, index) {
  const lines = Array.isArray(poLines) ? poLines : [];
  if (receiveLine?.poLineIndex != null && lines[receiveLine.poLineIndex]) {
    return lines[receiveLine.poLineIndex];
  }
  const productId = receiveLine?.productId ? String(receiveLine.productId) : '';
  const variantId = receiveLine?.variantId ? String(receiveLine.variantId) : '';
  if (productId) {
    if (variantId) {
      const variantMatch = lines.find(
        (line) => String(line.productId || '') === productId && String(line.variantId || '') === variantId,
      );
      if (variantMatch) return variantMatch;
    }
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

    target.quantityReceived = round2(toNumber(target.quantityReceived) + qty);
    applied.push({
      productId: receiveLine.productId || target.productId,
      variantId: receiveLine.variantId || target.variantId,
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
      const variantId = returnLine?.variantId ? String(returnLine.variantId) : '';
      if (variantId) {
        target = updated.find(
          (line) => String(line.productId || '') === String(returnLine.productId)
            && String(line.variantId || '') === variantId,
        );
      }
      if (!target) {
        target = updated.find((line) => String(line.productId || '') === String(returnLine.productId));
      }
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
      variantId: returnLine.variantId || target.variantId,
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
