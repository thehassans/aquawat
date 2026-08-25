import Invoice from '../../models/Invoice.js';
import InvTransfer from '../../models/inventory/InvTransfer.js';
import InvMoveLine from '../../models/inventory/InvMoveLine.js';
import DeliveryNote from '../../models/DeliveryNote.js';
import { toObjectId } from '../../models/inventory/common.js';
import { InventoryValidationError } from './errors.js';
import { getInvSettings } from './settingsService.js';
import { D, decStr } from '../../utils/decimal.js';

/**
 * Lot lines for an invoice when showLotsOnInvoices is on.
 * Reads move lines from linked engine transfers — never writes stock.
 */
export async function getInvoiceLotLines(tenantId, invoiceId) {
  const tid = toObjectId(tenantId);
  const settings = await getInvSettings(tid);
  const enabled = !!(settings.showLotsOnInvoices || settings.groupLotOnInvoice);
  if (!enabled) {
    return { enabled: false, items: [], byProduct: {} };
  }

  const invoice = await Invoice.findOne({ _id: invoiceId, tenantId: tid })
    .select('invoiceNumber inventory lineItems customerId purchaseOrderId deliveryNoteIds')
    .lean();
  if (!invoice) throw new InventoryValidationError('Invoice not found', 'INVOICE_NOT_FOUND');

  const idSet = new Set(
    (invoice.inventory?.transferIds || []).map((id) => String(id)),
  );

  // Transfers posted for this invoice
  const linked = await InvTransfer.find({
    tenantId: tid,
    $or: [
      { sourceModel: 'invoice', sourceDocId: invoice._id },
      { origin: invoice.invoiceNumber },
    ],
  }).select('_id').lean();
  for (const t of linked) idSet.add(String(t._id));

  // Delivery notes linked on the invoice or via PO
  const dnFilter = {
    tenantId: tid,
    inventoryTransferId: { $ne: null },
    $or: [],
  };
  if (invoice.deliveryNoteIds?.length) {
    dnFilter.$or.push({ _id: { $in: invoice.deliveryNoteIds } });
  }
  if (invoice.purchaseOrderId) {
    dnFilter.$or.push({ purchaseOrderId: invoice.purchaseOrderId });
  }
  if (dnFilter.$or.length) {
    const dns = await DeliveryNote.find(dnFilter).select('inventoryTransferId').lean();
    for (const dn of dns) {
      if (dn.inventoryTransferId) idSet.add(String(dn.inventoryTransferId));
    }
  }

  const transferIds = [...idSet].map(toObjectId);
  if (!transferIds.length) {
    return { enabled: true, items: [], byProduct: {}, transferCount: 0 };
  }

  const lines = await InvMoveLine.find({
    tenantId: tid,
    transferId: { $in: transferIds },
    state: { $ne: 'cancelled' },
    lotId: { $ne: null },
  })
    .populate('lotId', 'name expirationDate')
    .populate('productId', 'nameEn nameAr sku')
    .populate('transferId', 'name')
    .lean();

  const items = [];
  const byProduct = {};

  for (const line of lines) {
    const productId = String(line.productId?._id || line.productId || '');
    const lotName = line.lotId?.name || '';
    if (!lotName) continue;
    const qty = decStr(line.quantityInProductUom || line.quantity || 0);
    const row = {
      productId: line.productId?._id || line.productId,
      productName: line.productId?.nameEn || line.productId?.sku || '—',
      productNameAr: line.productId?.nameAr || '',
      sku: line.productId?.sku || '',
      lotId: line.lotId?._id || line.lotId,
      lotName,
      expirationDate: line.lotId?.expirationDate || null,
      qty,
      transferId: line.transferId?._id || line.transferId,
      transferName: line.transferId?.name || '',
    };
    items.push(row);
    if (!byProduct[productId]) byProduct[productId] = [];
    byProduct[productId].push(lotName);
  }

  // Collapse lot names per product for line-item hints
  const lotHintByProduct = {};
  for (const [pid, names] of Object.entries(byProduct)) {
    lotHintByProduct[pid] = [...new Set(names)].join(', ');
  }

  return {
    enabled: true,
    items,
    byProduct: lotHintByProduct,
    transferCount: transferIds.length,
    totals: {
      lines: items.length,
      qty: decStr(items.reduce((s, r) => D(s).plus(D(r.qty)), D(0))),
    },
  };
}
