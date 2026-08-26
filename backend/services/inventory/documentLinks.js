import Warehouse from '../../models/Warehouse.js';
import GRN from '../../models/GRN.js';
import DeliveryNote from '../../models/DeliveryNote.js';
import InvTransfer from '../../models/inventory/InvTransfer.js';
import InvOperationType from '../../models/inventory/InvOperationType.js';
import { toObjectId } from '../../models/inventory/common.js';
import { isInvEngineEnabled } from './legacyAdapter.js';
import { ensureInventoryBootstrap, bootstrapWarehouse, getDefaultUom } from './bootstrap.js';
import { createTransfer } from './createTransfer.js';
import { cancelTransfer } from './transferService.js';

async function nextDnNumber(tenantFilter) {
  const last = await DeliveryNote.findOne(tenantFilter).sort({ createdAt: -1 }).select('dnNumber').lean();
  const match = String(last?.dnNumber || '').match(/(\d+)\s*$/);
  const n = match ? Number(match[1]) + 1 : 1;
  return `DN-${String(n).padStart(5, '0')}`;
}

/**
 * After PO approve + draft GRN: create draft incoming transfer linked both ways.
 */
export async function linkDraftReceiptToGrn({
  tenantId,
  userId,
  purchaseOrder,
  grn,
}) {
  if (!grn?._id || !purchaseOrder?._id) return { transfer: null };
  if (grn.inventoryTransferId) {
    const existing = await InvTransfer.findById(grn.inventoryTransferId).lean();
    return { transfer: existing, created: false };
  }
  if (!(await isInvEngineEnabled(tenantId))) return { transfer: null };

  const warehouseId = grn.warehouseId || purchaseOrder.warehouseId;
  if (!warehouseId) return { transfer: null };

  const tid = toObjectId(tenantId);
  await ensureInventoryBootstrap(tid, userId);
  let wh = await Warehouse.findOne({ _id: warehouseId, tenantId: tid });
  if (!wh) return { transfer: null };
  if (!wh.stockLocationId || !wh.engineBootstrappedAt) {
    await bootstrapWarehouse(tid, wh, null, userId);
    wh = await Warehouse.findById(wh._id);
  }

  const opType = await InvOperationType.findOne({
    tenantId: tid,
    warehouseId: wh._id,
    code: 'incoming',
    active: true,
    sequenceCode: { $not: /\/ADJ$/ },
  });
  if (!opType) return { transfer: null };

  const defaultUom = await getDefaultUom(tid);
  const lines = (grn.lines || [])
    .filter((l) => l.productId && Number(l.quantityReceived || l.quantityOrdered || 0) > 0)
    .map((l) => ({
      productId: l.productId,
      demandQty: String(l.quantityReceived || l.quantityOrdered || 0),
      uomId: defaultUom?._id,
      unitCost: l.costPrice != null && l.costPrice !== ''
        ? String(l.costPrice)
        : (l.unitCost != null ? String(l.unitCost) : undefined),
    }));
  if (!lines.length) return { transfer: null };

  const transfer = await createTransfer(tid, {
    operationTypeId: opType._id,
    partnerId: purchaseOrder.supplierId?._id || purchaseOrder.supplierId,
    origin: purchaseOrder.poNumber,
    note: [
      `Linked PO ${purchaseOrder.poNumber}`,
      `GRN ${grn.grnNumber}`,
      `/app/dashboard/purchases/orders/${purchaseOrder._id}`,
    ].join('\n'),
    sourceModel: 'grn',
    sourceDocId: grn._id,
    lines,
  }, userId);

  await GRN.updateOne(
    { _id: grn._id },
    { $set: { inventoryTransferId: transfer._id } },
  );

  return { transfer, created: true };
}

/**
 * Sell-order approve: draft DeliveryNote + draft outgoing InvTransfer, linked both ways.
 */
export async function ensureDraftDeliveryForSellOrder({
  tenantId,
  userId,
  purchaseOrder,
  tenantFilter,
}) {
  const order = purchaseOrder;
  if (!order?._id || order.flow !== 'sell') return { deliveryNote: null, transfer: null, created: false };
  if (['cancelled', 'delivered', 'closed'].includes(order.status)) {
    return { deliveryNote: null, transfer: null, created: false };
  }

  const existingDn = await DeliveryNote.findOne({
    ...tenantFilter,
    purchaseOrderId: order._id,
    status: { $ne: 'cancelled' },
  }).sort({ createdAt: 1 });

  if (existingDn) {
    return { deliveryNote: existingDn, transfer: existingDn.inventoryTransferId
      ? await InvTransfer.findById(existingDn.inventoryTransferId).lean()
      : null, created: false };
  }

  const goodsLines = (order.lineItems || []).filter((li) => {
    const remaining = Number(li.quantityOrdered || 0) - Number(li.quantityDelivered || 0);
    return remaining > 0 && (li.productType || 'goods') !== 'service' && li.productId;
  });
  if (!goodsLines.length) return { deliveryNote: null, transfer: null, created: false };

  const warehouseId = order.warehouseId?._id || order.warehouseId;
  const dnNumber = await nextDnNumber(tenantFilter);

  const dn = await DeliveryNote.create({
    tenantId: tenantId || order.tenantId,
    dnNumber,
    customerId: order.customerId?._id || order.customerId,
    customerName: order.customerId?.name
      || order.customerId?.nameEn
      || order.customerId?.nameAr
      || '',
    purchaseOrderId: order._id,
    sourceDocType: 'purchase_order',
    status: 'pending_invoice',
    warehouseId: warehouseId || undefined,
    notes: `Draft delivery for ${order.poNumber}`,
    lineItems: goodsLines.map((li) => ({
      productId: li.productId?._id || li.productId,
      description: li.description || li.manualName || 'Item',
      unitCode: li.uom || 'PCE',
      quantityDelivered: Number(li.quantityOrdered || 0) - Number(li.quantityDelivered || 0),
      quantityInvoiced: 0,
    })),
    createdBy: userId,
  });

  let transfer = null;
  if (warehouseId && (await isInvEngineEnabled(tenantId))) {
    const tid = toObjectId(tenantId);
    await ensureInventoryBootstrap(tid, userId);
    let wh = await Warehouse.findOne({ _id: warehouseId, tenantId: tid });
    if (wh && (!wh.stockLocationId || !wh.engineBootstrappedAt)) {
      await bootstrapWarehouse(tid, wh, null, userId);
      wh = await Warehouse.findById(wh._id);
    }
    if (wh) {
      const opType = await InvOperationType.findOne({
        tenantId: tid,
        warehouseId: wh._id,
        code: 'outgoing',
        active: true,
        sequenceCode: { $not: /\/ADJ$/ },
      });
      const defaultUom = await getDefaultUom(tid);
      if (opType) {
        transfer = await createTransfer(tid, {
          operationTypeId: opType._id,
          partnerId: order.customerId?._id || order.customerId,
          origin: order.poNumber,
          note: [
            `Linked SO ${order.poNumber}`,
            `DN ${dn.dnNumber}`,
            `/app/dashboard/sales/orders/${order._id}`,
          ].join('\n'),
          sourceModel: 'delivery_note',
          sourceDocId: dn._id,
          lines: dn.lineItems.map((l) => ({
            productId: l.productId,
            demandQty: String(l.quantityDelivered),
            uomId: defaultUom?._id,
          })),
        }, userId);
        dn.inventoryTransferId = transfer._id;
        await dn.save();
      }
    }
  }

  return { deliveryNote: dn, transfer, created: true };
}

/**
 * Cancel unstarted deliveries / receipts linked to a cancelled order.
 */
export async function cancelUnstartedStockDocsForOrder({
  tenantId,
  userId,
  purchaseOrderId,
  tenantFilter,
}) {
  const cancelled = { grns: 0, deliveryNotes: 0, transfers: 0 };

  const grns = await GRN.find({
    ...tenantFilter,
    purchaseOrderId,
    status: 'draft',
    stockPostedAt: null,
  });
  for (const grn of grns) {
    grn.status = 'cancelled';
    grn.cancelledAt = new Date();
    await grn.save();
    cancelled.grns += 1;
    if (grn.inventoryTransferId) {
      try {
        await cancelTransfer(tenantId, grn.inventoryTransferId, userId);
        cancelled.transfers += 1;
      } catch {
        /* already done / missing */
      }
    }
  }

  const dns = await DeliveryNote.find({
    ...tenantFilter,
    purchaseOrderId,
    status: { $in: ['pending_invoice', 'partially_invoiced'] },
    stockPostedAt: null,
  });
  for (const dn of dns) {
    const transfer = dn.inventoryTransferId
      ? await InvTransfer.findById(dn.inventoryTransferId).lean()
      : null;
    if (transfer && transfer.state === 'done') continue;
    dn.status = 'cancelled';
    await dn.save();
    cancelled.deliveryNotes += 1;
    if (dn.inventoryTransferId) {
      try {
        await cancelTransfer(tenantId, dn.inventoryTransferId, userId);
        cancelled.transfers += 1;
      } catch {
        /* ignore */
      }
    }
  }

  return cancelled;
}
