import DeliveryNote from '../../models/DeliveryNote.js';
import PurchaseOrder from '../../models/PurchaseOrder.js';
import InvMove from '../../models/inventory/InvMove.js';
import { getSalesSettings } from './salesLifecycle.js';
import { clampInvoiceLinesToDelivered } from './invoicingPolicyPure.js';

const DELIVERED_DN_STATUSES = ['delivered', 'fully_invoiced', 'partially_invoiced'];

/**
 * Build map of delivered qty per productId:variantId.
 * Prefers SO line quantityDelivered (synced on transfer done); falls back to DN/move math.
 */
export async function getDeliveredQuantities(tenantId, purchaseOrderId) {
  const po = await PurchaseOrder.findOne({
    _id: purchaseOrderId,
    tenantId,
    flow: 'sell',
  })
    .select('lineItems')
    .lean();

  const delivered = new Map();

  if (po?.lineItems?.length) {
    let anySynced = false;
    for (const li of po.lineItems) {
      const qty = Number(li.quantityDelivered || 0);
      if (qty > 0) anySynced = true;
      const key = `${li.productId}:${li.variantId || ''}`;
      delivered.set(key, (delivered.get(key) || 0) + qty);
    }
    if (anySynced) return delivered;
    delivered.clear();
  }

  const notes = await DeliveryNote.find({
    tenantId,
    purchaseOrderId,
    status: { $in: DELIVERED_DN_STATUSES },
  })
    .select('lineItems inventoryTransferId')
    .lean();

  for (const note of notes) {
    if (note.inventoryTransferId) {
      const moves = await InvMove.find({
        transferId: note.inventoryTransferId,
        state: 'done',
      })
        .select('productId variantId qtyDone demandQty')
        .lean();
      for (const m of moves) {
        const key = `${m.productId}:${m.variantId || ''}`;
        delivered.set(key, (delivered.get(key) || 0) + Number(m.qtyDone ?? m.demandQty ?? 0));
      }
    } else {
      for (const line of note.lineItems || []) {
        const key = `${line.productId}:${line.variantId || ''}`;
        delivered.set(key, (delivered.get(key) || 0) + Number(line.quantityDelivered || line.quantity || 0));
      }
    }
  }

  return delivered;
}

/**
 * When invoicing policy is "delivered", clamp invoice line quantities to delivered amounts.
 * Returns { lineItems, warnings } or throws if no qty remains invoiceable.
 */
export async function applyDeliveredInvoicingPolicy({
  tenantId,
  purchaseOrderId,
  lineItems = [],
  policyOverride,
}) {
  const settings = await getSalesSettings(tenantId);
  const policy = policyOverride || settings.defaultInvoicingPolicy || 'ordered';
  if (policy !== 'delivered' || !purchaseOrderId) {
    return { lineItems, policy, applied: false, warnings: [] };
  }

  const po = await PurchaseOrder.findOne({ _id: purchaseOrderId, tenantId, flow: 'sell' }).lean();
  if (!po) {
    return { lineItems, policy, applied: false, warnings: ['Sales order not found — policy not applied'] };
  }

  const delivered = await getDeliveredQuantities(tenantId, purchaseOrderId);
  const { adjusted, warnings } = clampInvoiceLinesToDelivered(lineItems, delivered);

  if (!adjusted.length) {
    const err = new Error('No invoiceable quantities — deliver goods before invoicing (delivered policy active)');
    err.code = 'INVOICING_POLICY_DELIVERED';
    throw err;
  }

  return { lineItems: adjusted, policy, applied: true, warnings };
}
