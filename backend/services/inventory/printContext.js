import Tenant from '../../models/Tenant.js';
import Invoice from '../../models/Invoice.js';
import DeliveryNote from '../../models/DeliveryNote.js';
import GRN from '../../models/GRN.js';
import InvTransfer from '../../models/inventory/InvTransfer.js';
import { toObjectId } from '../../models/inventory/common.js';
import { InventoryValidationError } from './errors.js';
import { generateZatcaQr } from '../../lib/zatcaQr.js';

/**
 * Resolve linked commercial docs + ZATCA Phase-1 TLV for transfer print.
 * Never invents tax totals — only uses stored invoice QR or invoice grandTotal/totalTax.
 * No ZATCA transmission / clearance client.
 */
export async function getTransferPrintContext(tenantId, transferId) {
  const tid = toObjectId(tenantId);
  const transfer = await InvTransfer.findOne({ _id: transferId, tenantId: tid })
    .populate('operationTypeId', 'code name nameAr')
    .lean();
  if (!transfer) throw new InventoryValidationError('Transfer not found', 'TRANSFER_NOT_FOUND');

  const [tenant, deliveryNote, grn, invoice] = await Promise.all([
    Tenant.findById(tid).select('name nameAr business zatca').lean(),
    DeliveryNote.findOne({ tenantId: tid, inventoryTransferId: transfer._id })
      .select('dnNumber status deliveryDate customerName purchaseOrderId')
      .lean(),
    GRN.findOne({ tenantId: tid, inventoryTransferId: transfer._id })
      .select('grnNumber status receivedDate referenceNumber')
      .lean(),
    Invoice.findOne({
      tenantId: tid,
      'inventory.transferIds': transfer._id,
    })
      .select('invoiceNumber issueDate grandTotal totalTax taxableAmount zatca inventory status')
      .sort({ issueDate: -1 })
      .lean(),
  ]);

  const sellerName = tenant?.business?.legalNameAr
    || tenant?.business?.legalNameEn
    || tenant?.name
    || 'Seller';
  const vatNumber = String(tenant?.business?.vatNumber || '').trim();

  let zatcaQrPayload = invoice?.zatca?.qrCodeData
    || invoice?.zatca?.phase2QrCode
    || null;
  let qrSource = null;
  if (zatcaQrPayload) {
    qrSource = invoice?.zatca?.phase2QrCode && !invoice?.zatca?.qrCodeData
      ? 'invoice_phase2'
      : 'invoice_stored';
  }

  if (!zatcaQrPayload && invoice && invoice.grandTotal != null && invoice.totalTax != null) {
    try {
      zatcaQrPayload = generateZatcaQr({
        sellerName,
        vatNumber,
        invoiceDate: invoice.issueDate || transfer.scheduledDate || new Date(),
        totalAmount: invoice.grandTotal,
        vatAmount: invoice.totalTax,
      });
      qrSource = 'invoice_generated';
    } catch {
      // Invalid VAT / amounts — leave QR empty (print still works)
      zatcaQrPayload = null;
      qrSource = null;
    }
  }

  const { resolveTransferPartner } = await import('./partnerResolve.js');
  const partner = await resolveTransferPartner(
    tid,
    transfer.partnerId,
    transfer.operationTypeId?.code,
  );

  return {
    transferId: transfer._id,
    transferName: transfer.name,
    operationCode: transfer.operationTypeId?.code || null,
    partner: partner
      ? {
        _id: partner._id,
        name: partner.name || partner.nameEn || null,
        nameEn: partner.nameEn || partner.name || null,
        nameAr: partner.nameAr || null,
        kind: partner.kind || null,
      }
      : null,
    linked: {
      invoice: invoice
        ? {
          _id: invoice._id,
          invoiceNumber: invoice.invoiceNumber,
          issueDate: invoice.issueDate,
          grandTotal: invoice.grandTotal,
          totalTax: invoice.totalTax,
          status: invoice.status,
        }
        : null,
      deliveryNote: deliveryNote
        ? {
          _id: deliveryNote._id,
          dnNumber: deliveryNote.dnNumber,
          status: deliveryNote.status,
          customerName: deliveryNote.customerName,
        }
        : null,
      grn: grn
        ? {
          _id: grn._id,
          grnNumber: grn.grnNumber,
          status: grn.status,
          referenceNumber: grn.referenceNumber,
        }
        : null,
    },
    seller: {
      name: sellerName,
      nameEn: tenant?.business?.legalNameEn || tenant?.name,
      nameAr: tenant?.business?.legalNameAr || tenant?.nameAr || sellerName,
      vatNumber: vatNumber || null,
    },
    totals: invoice
      ? {
        totalWithVat: invoice.grandTotal,
        vatTotal: invoice.totalTax,
        taxableAmount: invoice.taxableAmount,
      }
      : null,
    zatcaQrPayload,
    qrSource,
    /** True when a scannable Phase-1/2 payload is available (no live API call). */
    hasZatcaQr: Boolean(zatcaQrPayload),
  };
}
