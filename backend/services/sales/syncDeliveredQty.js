import DeliveryNote from '../../models/DeliveryNote.js';
import PurchaseOrder from '../../models/PurchaseOrder.js';
import InvMove from '../../models/inventory/InvMove.js';

/**
 * Recompute quantityDelivered on sell PO lines from all delivered DNs / done transfers.
 */
export async function syncSellOrderDeliveredFromTransfer(transfer) {
  if (!transfer || transfer.sourceModel !== 'delivery_note' || !transfer.sourceDocId) {
    return { synced: false };
  }

  const dn = await DeliveryNote.findById(transfer.sourceDocId);
  if (!dn?.purchaseOrderId) return { synced: false };

  if (String(transfer.state) === 'done' && dn.status !== 'delivered') {
    dn.status = 'delivered';
    await dn.save();
  }

  return recomputeSellOrderDelivered(dn.purchaseOrderId);
}

export async function recomputeSellOrderDelivered(purchaseOrderId) {
  const po = await PurchaseOrder.findOne({ _id: purchaseOrderId, flow: 'sell' });
  if (!po) return { synced: false };

  const notes = await DeliveryNote.find({
    purchaseOrderId: po._id,
    status: { $in: ['delivered', 'fully_invoiced', 'partially_invoiced'] },
  }).select('lineItems inventoryTransferId').lean();

  const deliveredByKey = new Map();

  for (const note of notes) {
    if (note.inventoryTransferId) {
      const moves = await InvMove.find({
        transferId: note.inventoryTransferId,
        state: 'done',
      }).select('productId variantId qtyDone demandQty').lean();
      for (const m of moves) {
        const key = `${m.productId}:${m.variantId || ''}`;
        deliveredByKey.set(key, (deliveredByKey.get(key) || 0) + Number(m.qtyDone ?? m.demandQty ?? 0));
      }
    } else {
      for (const line of note.lineItems || []) {
        const key = `${line.productId}:${line.variantId || ''}`;
        deliveredByKey.set(key, (deliveredByKey.get(key) || 0) + Number(line.quantityDelivered || 0));
      }
    }
  }

  let allDone = true;
  let any = false;
  for (const li of po.lineItems || []) {
    if ((li.productType || 'goods') === 'service') continue;
    const key = `${li.productId}:${li.variantId || ''}`;
    const qty = deliveredByKey.get(key) || 0;
    li.quantityDelivered = Math.min(Number(li.quantityOrdered || 0), qty);
    if (li.quantityDelivered > 0) any = true;
    if (Number(li.quantityDelivered || 0) < Number(li.quantityOrdered || 0)) allDone = false;
  }

  if (allDone && any) po.status = 'delivered';
  else if (any) po.status = 'partially_delivered';

  await po.save();
  return { synced: true, purchaseOrderId: po._id, status: po.status };
}

export default { syncSellOrderDeliveredFromTransfer, recomputeSellOrderDelivered };
