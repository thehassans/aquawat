import PurchaseOrder from '../../models/PurchaseOrder.js';
import Product from '../../models/Product.js';
import Partner from '../../models/Partner.js';
import Warehouse from '../../models/Warehouse.js';
import { nextDailyDocNumber } from '../inventory/sequence.js';

function formatPartnerAddress(partner) {
  const a = partner?.address || {};
  return [
    a.shortAddress,
    a.buildingNumber,
    a.street,
    a.district,
    a.city,
    a.postalCode,
    a.country,
  ].filter(Boolean).join(', ');
}

/**
 * For SO lines marked dropship / mto, create linked docs.
 * MTS lines rely on ensureDraftDeliveryForSellOrder.
 */
export async function orchestrateSellOrderRoutes({
  tenantId,
  userId,
  order,
}) {
  const results = { dropships: [], mto: [], skipped: [] };
  const lines = order.lineItems || [];

  const customerId = order.customerId?._id || order.customerId;
  const customer = customerId
    ? await Partner.findOne({ _id: customerId, tenantId }).lean()
    : null;
  const shipTo = formatPartnerAddress(customer) || customer?.name || customer?.nameEn || '';

  let stockLocationId = null;
  if (order.warehouseId) {
    const wh = await Warehouse.findOne({
      _id: order.warehouseId?._id || order.warehouseId,
      tenantId,
    }).select('stockLocationId').lean();
    stockLocationId = wh?.stockLocationId || null;
  }

  for (const li of lines) {
    const route = String(li.procurementRoute || 'mts').toLowerCase() || 'mts';
    if (route === 'mts' || route === '') {
      results.skipped.push({ lineId: li._id, route: 'mts' });
      continue;
    }

    const productId = li.productId?._id || li.productId;
    const product = li.productId?.costPrice != null
      ? li.productId
      : await Product.findById(productId).select('preferredSupplierId supplierId nameEn costPrice').lean();

    if (route === 'dropship') {
      const vendorId = product?.preferredSupplierId || product?.supplierId;
      if (!vendorId) {
        results.dropships.push({ lineId: li._id, error: 'No default vendor on product' });
        continue;
      }
      const vendor = await Partner.findOne({ _id: vendorId, tenantId }).lean();
      let poNumber;
      try {
        poNumber = await nextDailyDocNumber(tenantId, 'PO');
      } catch {
        poNumber = `PO-DS-${Date.now().toString(36).toUpperCase()}`;
      }

      const qty = Number(li.quantityOrdered || 0);
      const unitCost = Number(product?.costPrice ?? li.unitCost ?? 0);
      const taxRate = Number(li.taxRate ?? 15);
      const lineSubtotal = qty * unitCost;
      const lineTax = lineSubtotal * (taxRate / 100);

      const dropPo = await PurchaseOrder.create({
        tenantId,
        poNumber,
        flow: 'purchase',
        supplierId: vendorId,
        customerId: order.customerId?._id || order.customerId,
        warehouseId: order.warehouseId,
        status: 'draft',
        notes: [
          `Dropship for SO ${order.poNumber} line ${li._id}`,
          shipTo ? `Ship directly to customer: ${shipTo}` : 'Ship directly to customer address',
          customer?.contactPerson?.phone || customer?.phone
            ? `Customer phone: ${customer?.contactPerson?.phone || customer?.phone}`
            : '',
        ].filter(Boolean).join('\n'),
        lineItems: [{
          productId,
          variantId: li.variantId || undefined,
          manualName: li.manualName || product?.nameEn || '',
          description: `Dropship → ${shipTo || 'customer'} (SO ${order.poNumber})`,
          quantityOrdered: qty,
          unitCost,
          taxRate,
          productType: li.productType || 'goods',
          uom: li.uom || '',
          uomId: li.uomId || undefined,
          lineSubtotal,
          lineTax,
          lineTotal: lineSubtotal + lineTax,
        }],
        subtotal: lineSubtotal,
        totalTax: lineTax,
        grandTotal: lineSubtotal + lineTax,
        createdBy: userId,
      });

      results.dropships.push({
        lineId: li._id,
        purchaseOrderId: dropPo._id,
        poNumber: dropPo.poNumber,
        vendorName: vendor?.name || vendor?.nameEn || '',
        shipTo,
      });
      continue;
    }

    if (route === 'mto') {
      try {
        const { runProcurement } = await import('../inventory/procurement.js');
        const procured = await runProcurement({
          tenantId,
          productId,
          variantId: li.variantId || undefined,
          qty: Number(li.quantityOrdered || 0),
          warehouseId: order.warehouseId?._id || order.warehouseId,
          locationId: stockLocationId || undefined,
          userId,
        });
        results.mto.push({ lineId: li._id, procured, locationId: stockLocationId });
      } catch (e) {
        results.mto.push({ lineId: li._id, error: e.message });
      }
    }
  }

  return results;
}
