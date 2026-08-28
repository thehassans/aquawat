import DeliveryNote from '../../models/DeliveryNote.js';
import PurchaseOrder from '../../models/PurchaseOrder.js';
import { getSalesSettings } from './salesLifecycle.js';

/** Build map of delivered qty per productId:variantId from done delivery notes */
export async function getDeliveredQuantities(tenantId, purchaseOrderId) {
  const notes = await DeliveryNote.find({
    tenantId,
    purchaseOrderId,
    status: 'done',
  }).select('lines').lean();

  const delivered = new Map();
  for (const dn of notes) {
    for (const line of dn.lines || []) {
      const key = `${line.productId}:${line.variantId || ''}`;
      delivered.set(key, (delivered.get(key) || 0) + Number(line.quantity || 0));
    }
  }
  return delivered;
}

/**
 * When invoicing policy is "delivered", clamp invoice line quantities to delivered amounts.
 * Returns { lineItems, warnings } or throws if no qty remains deliverable.
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
  const warnings = [];
  const adjusted = [];

  for (const line of lineItems) {
    const key = `${line.productId}:${line.variantId || ''}`;
    const maxQty = delivered.get(key) ?? 0;
    const requested = Number(line.quantity || 0);

    if (!line.productId) {
      adjusted.push(line);
      continue;
    }

    if (maxQty <= 0) {
      warnings.push(`No delivered quantity for ${line.productName || line.productId} — line skipped`);
      continue;
    }

    if (requested > maxQty) {
      warnings.push(`Quantity for ${line.productName || line.productId} reduced from ${requested} to ${maxQty} (delivered)`);
    }

    adjusted.push({ ...line, quantity: Math.min(requested, maxQty) });
  }

  if (!adjusted.length) {
    const err = new Error('No invoiceable quantities — deliver goods before invoicing (delivered policy active)');
    err.code = 'INVOICING_POLICY_DELIVERED';
    throw err;
  }

  return { lineItems: adjusted, policy, applied: true, warnings };
}
