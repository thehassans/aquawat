/**
 * Three-way match: PO qty vs Received qty vs Billed qty (+ configurable price tolerance).
 */
import PurchaseOrder from '../../models/PurchaseOrder.js';
import { toObjectId } from '../../models/inventory/common.js';
import { InventoryValidationError } from './errors.js';

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export const DEFAULT_THREE_WAY_TOLERANCE = {
  qtyTolerance: 0,
  priceTolerancePct: 5,
  priceToleranceAmount: 50,
  blockQtyOverReceived: true,
};

/**
 * Resolve match tolerances from InvSettings (or defaults).
 * Body overrides win when explicitly provided (including 0).
 */
export function resolveThreeWayOptions(settings, body = {}) {
  const tw = settings?.threeWayMatch || {};
  const has = (k) => body[k] !== undefined && body[k] !== null && body[k] !== '';
  return {
    qtyTolerance: has('qtyTolerance') ? num(body.qtyTolerance) : num(tw.qtyTolerance ?? DEFAULT_THREE_WAY_TOLERANCE.qtyTolerance),
    priceTolerancePct: has('priceTolerancePct')
      ? num(body.priceTolerancePct)
      : num(tw.priceTolerancePct ?? DEFAULT_THREE_WAY_TOLERANCE.priceTolerancePct),
    priceToleranceAmount: has('priceToleranceAmount')
      ? num(body.priceToleranceAmount)
      : num(tw.priceToleranceAmount ?? DEFAULT_THREE_WAY_TOLERANCE.priceToleranceAmount),
    blockQtyOverReceived: has('blockQtyOverReceived')
      ? Boolean(body.blockQtyOverReceived)
      : (tw.blockQtyOverReceived !== false),
  };
}

/**
 * Compute matchingStatus from exceptions + PO remaining after this bill.
 */
export function computeMatchingStatus({ exceptions = [], lines = [], hasPo = true }) {
  if (!hasPo) return 'unmatched';
  const hasBlock = exceptions.some((e) => e.severity === 'block');
  const hasWarn = exceptions.some((e) => e.severity === 'warn');
  if (hasBlock) return 'variance';
  if (hasWarn) return 'variance';
  if (!lines.length) return 'unmatched';

  const anyBilled = lines.some((l) => num(l.billedQty) > 0);
  if (!anyBilled) return 'unmatched';

  const anyOpenReceivable = lines.some((l) => {
    const remainingAfter = Math.max(0, num(l.remainingBillable) - num(l.billedQty));
    return remainingAfter > 1e-9;
  });
  return anyOpenReceivable ? 'partially_matched' : 'fully_matched';
}

/**
 * @param {object} opts
 * @param {string|import('mongoose').Types.ObjectId} opts.tenantId
 * @param {string|import('mongoose').Types.ObjectId} opts.purchaseOrderId
 * @param {Array<{ productId, quantity, unitPrice? }>} opts.billLines
 * @param {number} [opts.qtyTolerance=0]
 * @param {number} [opts.priceTolerancePct=5]
 * @param {number} [opts.priceToleranceAmount=50]
 * @param {boolean} [opts.blockQtyOverReceived=true]
 * @param {string|import('mongoose').Types.ObjectId} [opts.excludeInvoiceId] — subtract this invoice's prior billed qty when editing
 * @returns {{ ok: boolean, exceptions: Array<object>, lines: Array<object>, matchingStatus: string }}
 */
export async function threeWayMatch({
  tenantId,
  purchaseOrderId,
  billLines,
  qtyTolerance = DEFAULT_THREE_WAY_TOLERANCE.qtyTolerance,
  priceTolerancePct = DEFAULT_THREE_WAY_TOLERANCE.priceTolerancePct,
  priceToleranceAmount = DEFAULT_THREE_WAY_TOLERANCE.priceToleranceAmount,
  blockQtyOverReceived = DEFAULT_THREE_WAY_TOLERANCE.blockQtyOverReceived,
  excludeInvoiceId = null,
}) {
  const po = await PurchaseOrder.findOne({
    _id: toObjectId(purchaseOrderId),
    tenantId: toObjectId(tenantId),
  }).lean();

  if (!po) {
    throw new InventoryValidationError('Purchase order not found', 'PO_NOT_FOUND');
  }

  /** When editing a bill, subtract that invoice's quantities already counted in quantityInvoiced */
  let excludeByProduct = new Map();
  if (excludeInvoiceId) {
    try {
      const Invoice = (await import('../../models/Invoice.js')).default;
      const prior = await Invoice.findOne({
        _id: toObjectId(excludeInvoiceId),
        tenantId: toObjectId(tenantId),
        flow: 'purchase',
      }).select('lineItems').lean();
      for (const li of prior?.lineItems || []) {
        if (!li.productId) continue;
        const key = String(li.productId);
        excludeByProduct.set(key, (excludeByProduct.get(key) || 0) + num(li.quantity));
      }
    } catch {
      excludeByProduct = new Map();
    }
  }

  const exceptions = [];
  const poByProduct = new Map();
  for (const line of po.lineItems || []) {
    if (!line.productId) continue;
    const key = String(line.productId);
    const prev = poByProduct.get(key) || {
      productId: line.productId,
      ordered: 0,
      received: 0,
      returned: 0,
      invoiced: 0,
      unitCost: num(line.unitCost),
      name: line.manualName || line.description,
    };
    prev.ordered += num(line.quantityOrdered);
    prev.received += num(line.quantityReceived);
    prev.returned += num(line.quantityReturned);
    prev.invoiced += num(line.quantityInvoiced);
    prev.unitCost = num(line.unitCost);
    poByProduct.set(key, prev);
  }

  // Adjust invoiced for exclude
  for (const [key, subtract] of excludeByProduct) {
    const row = poByProduct.get(key);
    if (row) row.invoiced = Math.max(0, row.invoiced - subtract);
  }

  const billByProduct = new Map();
  for (const line of billLines || []) {
    if (!line.productId) continue;
    const key = String(line.productId);
    const prev = billByProduct.get(key) || { productId: line.productId, qty: 0, unitPrice: num(line.unitPrice ?? line.unitCost) };
    prev.qty += num(line.quantity);
    if (line.unitPrice != null || line.unitCost != null) {
      prev.unitPrice = num(line.unitPrice ?? line.unitCost);
    }
    billByProduct.set(key, prev);
  }

  const lines = [];

  for (const [key, poLine] of poByProduct) {
    const bill = billByProduct.get(key) || { productId: poLine.productId, qty: 0, unitPrice: 0 };
    const netReceived = Math.max(0, poLine.received - poLine.returned);
    const alreadyInvoiced = poLine.invoiced;
    const remainingBillable = Math.max(0, netReceived - alreadyInvoiced);
    const remainingOrderable = Math.max(0, poLine.ordered - alreadyInvoiced);

    lines.push({
      productId: poLine.productId,
      name: poLine.name,
      ordered: poLine.ordered,
      received: netReceived,
      returned: poLine.returned,
      alreadyInvoiced,
      remainingBillable,
      remainingOrderable,
      unitCost: poLine.unitCost,
      billedQty: bill.qty,
      billUnitPrice: bill.unitPrice,
    });
  }

  for (const [key, bill] of billByProduct) {
    const poLine = poByProduct.get(key);
    if (!poLine) {
      exceptions.push({
        productId: bill.productId,
        type: 'unknown_product',
        severity: 'block',
        message: 'Bill line product is not on the purchase order',
        billedQty: bill.qty,
      });
      continue;
    }

    const netReceived = Math.max(0, poLine.received - poLine.returned);
    const alreadyInvoiced = poLine.invoiced;
    const remainingBillable = Math.max(0, netReceived - alreadyInvoiced);
    const remainingOrderable = Math.max(0, poLine.ordered - alreadyInvoiced);
    const qtyTol = num(qtyTolerance);

    // Hard cap: never bill more than ordered (cumulative)
    const overOrderedBy = bill.qty - remainingOrderable - qtyTol;
    if (overOrderedBy > 1e-9) {
      exceptions.push({
        productId: bill.productId,
        type: 'over_ordered',
        severity: 'block',
        message: 'Billed quantity exceeds ordered quantity on the purchase order',
        ordered: poLine.ordered,
        received: netReceived,
        alreadyInvoiced,
        billedQty: bill.qty,
        remainingOrderable,
      });
    }

    // Block billing more than received (when enabled)
    if (blockQtyOverReceived !== false) {
      const overBy = bill.qty - remainingBillable - qtyTol;
      if (overBy > 1e-9) {
        exceptions.push({
          productId: bill.productId,
          type: 'qty_mismatch',
          severity: 'block',
          message: 'Billed quantity exceeds received quantity (net of returns)',
          ordered: poLine.ordered,
          received: netReceived,
          alreadyInvoiced,
          billedQty: bill.qty,
          remainingBillable,
        });
      }
    }

    // Price variance: warn only when beyond BOTH pct and absolute (auto-accept if either within)
    if (poLine.unitCost > 0 && bill.unitPrice > 0) {
      const absDiff = Math.abs(bill.unitPrice - poLine.unitCost);
      const diffPct = (absDiff / poLine.unitCost) * 100;
      const withinPct = diffPct <= num(priceTolerancePct) + 1e-9;
      const withinAmt = absDiff <= num(priceToleranceAmount) + 1e-9;
      if (!withinPct && !withinAmt) {
        exceptions.push({
          productId: bill.productId,
          type: 'price_mismatch',
          severity: 'warn',
          message: `Bill price differs from PO by ${diffPct.toFixed(2)}% (${absDiff.toFixed(2)})`,
          poPrice: poLine.unitCost,
          billPrice: bill.unitPrice,
          diffPct: Math.round(diffPct * 100) / 100,
          absDiff: Math.round(absDiff * 100) / 100,
          tolerancePct: num(priceTolerancePct),
          toleranceAmount: num(priceToleranceAmount),
        });
      }
    }
  }

  // Include bill-only products already pushed; also add lines for bill products not on PO map above
  for (const [key, bill] of billByProduct) {
    if (poByProduct.has(key)) continue;
    lines.push({
      productId: bill.productId,
      ordered: 0,
      received: 0,
      alreadyInvoiced: 0,
      remainingBillable: 0,
      remainingOrderable: 0,
      billedQty: bill.qty,
      billUnitPrice: bill.unitPrice,
    });
  }

  const blocking = exceptions.filter((e) => e.severity === 'block');
  const matchingStatus = computeMatchingStatus({
    exceptions,
    lines,
    hasPo: true,
  });

  return {
    ok: blocking.length === 0,
    exceptions,
    lines,
    matchingStatus,
    purchaseOrderId: po._id,
    poNumber: po.poNumber,
    tolerances: {
      qtyTolerance: num(qtyTolerance),
      priceTolerancePct: num(priceTolerancePct),
      priceToleranceAmount: num(priceToleranceAmount),
      blockQtyOverReceived: blockQtyOverReceived !== false,
    },
  };
}

/**
 * Hard-fail wrapper for invoice posting — only severity=block fails.
 */
export async function assertThreeWayMatchOrThrow(opts) {
  const result = await threeWayMatch(opts);
  if (!result.ok) {
    const err = new InventoryValidationError(
      'Three-way match failed — bill blocked',
      'THREE_WAY_MATCH',
    );
    err.exceptions = result.exceptions.filter((e) => e.severity === 'block');
    err.allExceptions = result.exceptions;
    err.matchingStatus = result.matchingStatus;
    err.lines = result.lines;
    err.status = 409;
    throw err;
  }
  return result;
}
