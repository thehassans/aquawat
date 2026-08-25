/**
 * Three-way match: PO qty vs Received qty vs Billed qty (+ optional price tolerance).
 */
import PurchaseOrder from '../../models/PurchaseOrder.js';
import { toObjectId } from '../../models/inventory/common.js';
import { InventoryValidationError } from './errors.js';

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * @param {object} opts
 * @param {string|import('mongoose').Types.ObjectId} opts.tenantId
 * @param {string|import('mongoose').Types.ObjectId} opts.purchaseOrderId
 * @param {Array<{ productId, quantity, unitPrice? }>} opts.billLines
 * @param {number} [opts.qtyTolerance=0]
 * @param {number} [opts.priceTolerancePct=0]
 * @returns {{ ok: boolean, exceptions: Array<object> }}
 */
export async function threeWayMatch({
  tenantId,
  purchaseOrderId,
  billLines,
  qtyTolerance = 0,
  priceTolerancePct = 0,
}) {
  const po = await PurchaseOrder.findOne({
    _id: toObjectId(purchaseOrderId),
    tenantId: toObjectId(tenantId),
  }).lean();

  if (!po) {
    throw new InventoryValidationError('Purchase order not found', 'PO_NOT_FOUND');
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

  for (const [key, bill] of billByProduct) {
    const poLine = poByProduct.get(key);
    if (!poLine) {
      exceptions.push({
        productId: bill.productId,
        type: 'unknown_product',
        message: 'Bill line product is not on the purchase order',
        billedQty: bill.qty,
      });
      continue;
    }

    const netReceived = Math.max(0, poLine.received - poLine.returned);
    const alreadyInvoiced = poLine.invoiced;
    const remainingBillable = Math.max(0, netReceived - alreadyInvoiced);
    const overBy = bill.qty - remainingBillable - qtyTolerance;

    if (overBy > 1e-9) {
      exceptions.push({
        productId: bill.productId,
        type: 'qty_mismatch',
        message: 'Billed quantity exceeds received quantity (net of returns)',
        ordered: poLine.ordered,
        received: netReceived,
        alreadyInvoiced,
        billedQty: bill.qty,
        remainingBillable,
      });
    }

    if (priceTolerancePct >= 0 && poLine.unitCost > 0 && bill.unitPrice > 0) {
      const diffPct = Math.abs(bill.unitPrice - poLine.unitCost) / poLine.unitCost * 100;
      if (diffPct > priceTolerancePct + 1e-9) {
        exceptions.push({
          productId: bill.productId,
          type: 'price_mismatch',
          message: `Bill price differs from PO by ${diffPct.toFixed(2)}%`,
          poPrice: poLine.unitCost,
          billPrice: bill.unitPrice,
          tolerancePct: priceTolerancePct,
        });
      }
    }
  }

  return { ok: exceptions.length === 0, exceptions, purchaseOrderId: po._id, poNumber: po.poNumber };
}

/**
 * Hard-fail wrapper for invoice posting.
 */
export async function assertThreeWayMatchOrThrow(opts) {
  const result = await threeWayMatch(opts);
  if (!result.ok) {
    const err = new InventoryValidationError(
      'Three-way match failed — bill blocked',
      'THREE_WAY_MATCH',
    );
    err.exceptions = result.exceptions;
    err.status = 409;
    throw err;
  }
  return result;
}
