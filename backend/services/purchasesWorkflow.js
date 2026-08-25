import PurchaseOrder from '../models/PurchaseOrder.js';
import GRN from '../models/GRN.js';
import PurchaseReturn from '../models/PurchaseReturn.js';
import LandedCost from '../models/LandedCost.js';
import Product from '../models/Product.js';
import BakalaProduct from '../models/BakalaProduct.js';
import Warehouse from '../models/Warehouse.js';
import { adjustProductStock, findCatalogProduct } from './inventoryAdjust.js';
import { normalizeProductType } from '../utils/productType.js';
import {
  PurchasesValidationError,
  applyGrnReceiveToPoLines,
  applyReturnToReceivedLines,
  allocateLandedCosts,
  nextDocumentNumber,
  stockDeltaForLine,
  toNumber,
  round2,
} from './purchasesLogic.js';

function datePrefix(code) {
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const d = String(today.getDate()).padStart(2, '0');
  return `${code}-${y}${m}${d}`;
}

async function nextNumber(Model, field, tenantFilter, code) {
  const prefix = datePrefix(code);
  const last = await Model.findOne({ ...tenantFilter, [field]: { $regex: `^${prefix}-` } })
    .sort({ createdAt: -1 })
    .select(field);
  return nextDocumentNumber(prefix, last?.[field]);
}

export async function generateGrnNumber(tenantFilter) {
  return nextNumber(GRN, 'grnNumber', tenantFilter, 'GRN');
}

export async function generateReturnNumber(tenantFilter) {
  return nextNumber(PurchaseReturn, 'returnNumber', tenantFilter, 'PR');
}

export async function generateLcNumber(tenantFilter) {
  return nextNumber(LandedCost, 'lcNumber', tenantFilter, 'LC');
}

export async function upsertDraftLandedCostForPo({ tenantId, tenantFilter, userId, purchaseOrder, costLines }) {
  const lines = (Array.isArray(costLines) ? costLines : [])
    .map((line) => ({
      type: ['customs_duty', 'freight', 'insurance', 'port_handling', 'clearance_fees', 'other'].includes(line?.type)
        ? line.type
        : 'other',
      description: line?.description || '',
      amount: toNumber(line?.amount, 0),
      currency: line?.currency || purchaseOrder?.currency || 'SAR',
      exchangeRate: toNumber(line?.exchangeRate, 1) || 1,
    }))
    .filter((line) => line.amount > 0);
  if (!lines.length || !purchaseOrder?._id) return null;

  const allocations = (purchaseOrder.lineItems || []).map((li) => {
    const product = li.productId && typeof li.productId === 'object' ? li.productId : null;
    const qty = toNumber(li.quantityOrdered);
    const unit = toNumber(li.unitCost);
    return {
      productId: product?._id || li.productId || undefined,
      productName: product?.nameEn || product?.nameAr || li.manualName || li.description || '',
      productCode: product?.sku || '',
      quantity: qty,
      unitCostBeforeLanded: unit,
      lineValue: round2(qty * unit),
    };
  }).filter((row) => row.quantity > 0 || row.lineValue > 0);

  const payload = {
    vendor: purchaseOrder.supplierId?.nameEn || purchaseOrder.supplierId?.nameAr || '',
    costLines: lines,
    allocationMethod: 'by_value',
    purchaseOrder: purchaseOrder._id,
    allocations,
    notes: purchaseOrder.notes || '',
  };

  const lc = await LandedCost.findOne({
    ...tenantFilter,
    purchaseOrder: purchaseOrder._id,
    isActive: true,
    status: { $in: ['draft', 'calculated'] },
  });
  if (lc) {
    Object.assign(lc, payload);
    await lc.save();
    return lc;
  }
  return LandedCost.create({
    ...payload,
    lcNumber: await generateLcNumber(tenantFilter),
    tenantId,
    createdBy: userId,
    status: 'draft',
  });
}

async function resolveWarehouse(tenantFilter, warehouseId) {
  if (!warehouseId) return null;
  return Warehouse.findOne({ _id: warehouseId, ...tenantFilter, isActive: true });
}

async function postLineStock({ tenantId, warehouseId, line, direction }) {
  const productType = normalizeProductType(line.productType);
  if (line.isDelayed) return { kind: 'skip' };
  const qty = toNumber(line.quantityReceived ?? line.quantityReturned ?? line.quantity, 0);
  const delta = stockDeltaForLine({ productType, quantity: qty, direction });
  if (!delta || !line.productId) return { kind: 'skip' };

  const found = await findCatalogProduct(tenantId, line.productId);
  if (!found) {
    throw new PurchasesValidationError(`Product not found: ${line.productName || line.productId}`, 'PRODUCT_NOT_FOUND');
  }

  const updated = await adjustProductStock({
    tenantId,
    productId: line.productId,
    warehouseId,
    delta,
    setFields: direction === 'in' ? {
      costPrice: line.costPrice,
      expiryDate: line.expiryDate,
      batchNumber: line.batchNumber,
    } : {},
  });
  if (!updated) {
    throw new PurchasesValidationError(`Product not found: ${line.productName || line.productId}`, 'PRODUCT_NOT_FOUND');
  }
  return updated;
}

export async function syncPurchaseOrderFromGrn({ tenantFilter, purchaseOrderId, receiveLines, warehouseId, userId }) {
  if (!purchaseOrderId) return null;
  const order = await PurchaseOrder.findOne({ _id: purchaseOrderId, ...tenantFilter });
  if (!order) {
    throw new PurchasesValidationError('Purchase order not found', 'PO_NOT_FOUND');
  }
  if (order.status === 'cancelled') {
    throw new PurchasesValidationError('Cannot receive against a cancelled order', 'PO_CANCELLED');
  }

  const result = applyGrnReceiveToPoLines(
    (order.lineItems || []).map((line) => (line.toObject ? line.toObject() : line)),
    receiveLines
  );
  for (const line of order.lineItems || []) {
    const updated = result.lines.find((row) => String(row.productId || '') === String(line.productId || ''));
    if (updated) line.quantityReceived = updated.quantityReceived;
  }
  if (result.status) order.status = result.status;

  const receivingItems = result.applied
    .filter((item) => item.productId)
    .map((item) => ({ productId: item.productId, quantity: item.quantity }));
  if (warehouseId && receivingItems.length) {
    order.receiving.push({
      receivedAt: new Date(),
      warehouseId,
      receivedBy: userId,
      items: receivingItems,
    });
  }
  await order.save();
  return order;
}

export async function reversePurchaseOrderReceive({ tenantFilter, purchaseOrderId, receiveLines }) {
  if (!purchaseOrderId) return null;
  const order = await PurchaseOrder.findOne({ _id: purchaseOrderId, ...tenantFilter });
  if (!order) return null;
  for (const line of receiveLines || []) {
    const qty = toNumber(line.quantityReceived ?? line.quantity, 0);
    if (qty <= 0) continue;
    const target = (order.lineItems || []).find((li) => String(li.productId || '') === String(line.productId || ''));
    if (!target) continue;
    target.quantityReceived = Math.max(0, round2(toNumber(target.quantityReceived) - qty));
  }
  const anyReceived = (order.lineItems || []).some((li) => toNumber(li.quantityReceived) > 0);
  const fullyReceived = (order.lineItems || []).every(
    (li) => toNumber(li.quantityReceived) >= toNumber(li.quantityOrdered)
  );
  if (fullyReceived && anyReceived) order.status = 'received';
  else if (anyReceived) order.status = 'partially_received';
  else if (['partially_received', 'received'].includes(order.status)) order.status = 'approved';
  await order.save();
  return order;
}

export async function postGrnStock({ tenantId, warehouseId, lines, direction = 'in' }) {
  const posted = [];
  for (const line of lines || []) {
    posted.push(await postLineStock({ tenantId, warehouseId, line, direction }));
  }
  return posted;
}

export async function confirmGrnReceive({ tenantFilter, user, grn, warehouseId }) {
  if (grn.stockPostedAt) return grn;
  const whId = warehouseId || grn.warehouseId;
  await postGrnStock({
    tenantId: user.tenantId,
    warehouseId: whId,
    lines: grn.lines,
    direction: 'in',
  });
  if (grn.purchaseOrderId) {
    await syncPurchaseOrderFromGrn({
      tenantFilter,
      purchaseOrderId: grn.purchaseOrderId,
      receiveLines: grn.lines,
      warehouseId: whId,
      userId: user._id,
    });
  }
  const totalReceivedInGrn = (grn.lines || []).reduce((sum, l) => sum + (l.isDelayed ? 0 : toNumber(l.quantityReceived, 0)), 0);
  if (totalReceivedInGrn > 0) {
    grn.status = grn.status === 'draft' ? 'received' : grn.status;
  }
  grn.stockPostedAt = new Date();
  grn.receivedBy = user._id;
  grn.dateReceived = grn.dateReceived || new Date();
  if (whId) grn.warehouseId = whId;
  await grn.save();
  return grn;
}

export async function cancelGrn({ tenantFilter, user, grn }) {
  if (grn.status === 'cancelled') return grn;
  if (grn.stockPostedAt) {
    await postGrnStock({
      tenantId: user.tenantId,
      warehouseId: grn.warehouseId,
      lines: grn.lines,
      direction: 'out',
    });
    await reversePurchaseOrderReceive({
      tenantFilter,
      purchaseOrderId: grn.purchaseOrderId,
      receiveLines: grn.lines,
    });
    grn.stockPostedAt = null;
  }
  grn.status = 'cancelled';
  grn.cancelledAt = new Date();
  await grn.save();
  return grn;
}

export async function confirmPurchaseReturn({ tenantFilter, user, purchaseReturn }) {
  if (purchaseReturn.stockPostedAt) return purchaseReturn;

  let grn = null;
  if (purchaseReturn.grnId) {
    grn = await GRN.findOne({ _id: purchaseReturn.grnId, ...tenantFilter });
    if (!grn) throw new PurchasesValidationError('GRN not found', 'GRN_NOT_FOUND');
    const result = applyReturnToReceivedLines(
      (grn.lines || []).map((line) => (line.toObject ? line.toObject() : line)),
      purchaseReturn.lines
    );
    for (const line of grn.lines || []) {
      const updated = result.lines.find((row) => String(row.productId || '') === String(line.productId || ''));
      if (updated) line.quantityReturned = updated.quantityReturned;
    }
    await grn.save();
  }

  if (purchaseReturn.purchaseOrderId) {
    const order = await PurchaseOrder.findOne({ _id: purchaseReturn.purchaseOrderId, ...tenantFilter });
    if (order) {
      const result = applyReturnToReceivedLines(
        (order.lineItems || []).map((li) => ({
          productId: li.productId,
          productType: li.productType,
          quantityReceived: li.quantityReceived,
          quantityReturned: li.quantityReturned,
        })),
        purchaseReturn.lines
      );
      for (const line of order.lineItems || []) {
        const updated = result.lines.find((row) => String(row.productId || '') === String(line.productId || ''));
        if (updated) line.quantityReturned = updated.quantityReturned;
      }
      await order.save();
    }
  }

  await postGrnStock({
    tenantId: user.tenantId,
    warehouseId: purchaseReturn.warehouseId,
    lines: (purchaseReturn.lines || []).map((line) => ({
      ...line.toObject?.() || line,
      quantityReceived: line.quantityReturned,
    })),
    direction: 'out',
  });

  purchaseReturn.status = 'completed';
  purchaseReturn.stockPostedAt = new Date();
  purchaseReturn.returnedBy = user._id;
  purchaseReturn.dateReturned = purchaseReturn.dateReturned || new Date();
  await purchaseReturn.save();
  return purchaseReturn;
}

export async function cancelPurchaseReturn({ tenantFilter, user, purchaseReturn }) {
  if (purchaseReturn.status === 'cancelled') return purchaseReturn;
  if (purchaseReturn.stockPostedAt) {
    await postGrnStock({
      tenantId: user.tenantId,
      warehouseId: purchaseReturn.warehouseId,
      lines: (purchaseReturn.lines || []).map((line) => ({
        ...line.toObject?.() || line,
        quantityReceived: line.quantityReturned,
      })),
      direction: 'in',
    });
    if (purchaseReturn.grnId) {
      const grn = await GRN.findOne({ _id: purchaseReturn.grnId, ...tenantFilter });
      if (grn) {
        for (const line of purchaseReturn.lines || []) {
          const target = (grn.lines || []).find((row) => String(row.productId || '') === String(line.productId || ''));
          if (target) {
            target.quantityReturned = Math.max(0, round2(toNumber(target.quantityReturned) - toNumber(line.quantityReturned)));
          }
        }
        await grn.save();
      }
    }
    if (purchaseReturn.purchaseOrderId) {
      const order = await PurchaseOrder.findOne({ _id: purchaseReturn.purchaseOrderId, ...tenantFilter });
      if (order) {
        for (const line of purchaseReturn.lines || []) {
          const target = (order.lineItems || []).find((row) => String(row.productId || '') === String(line.productId || ''));
          if (target) {
            target.quantityReturned = Math.max(0, round2(toNumber(target.quantityReturned) - toNumber(line.quantityReturned)));
          }
        }
        await order.save();
      }
    }
    purchaseReturn.stockPostedAt = null;
  }
  purchaseReturn.status = 'cancelled';
  purchaseReturn.cancelledAt = new Date();
  await purchaseReturn.save();
  return purchaseReturn;
}

export async function applyLandedCostToProducts({ tenantFilter, landedCost }) {
  for (const alloc of landedCost.allocations || []) {
    if (!alloc.productId || toNumber(alloc.allocatedCost) <= 0) continue;
    const qty = toNumber(alloc.quantity, 1) || 1;
    const product = await Product.findOne({ _id: alloc.productId, ...tenantFilter });
    if (product && typeof product.calculateLandedCost === 'function') {
      product.calculateLandedCost({
        purchasePrice: toNumber(alloc.unitCostBeforeLanded),
        otherCosts: toNumber(alloc.allocatedCost),
        quantity: qty,
        notes: `Landed cost ${landedCost.lcNumber}`,
      });
      await product.save();
      continue;
    }
    const bakala = await BakalaProduct.findOne({ _id: alloc.productId, ...tenantFilter });
    if (bakala) {
      const extraUnit = toNumber(alloc.unitLandedCost);
      bakala.costPrice = round2(toNumber(bakala.costPrice) + extraUnit);
      await bakala.save();
    }
  }
}

export { resolveWarehouse, PurchasesValidationError, allocateLandedCosts };
