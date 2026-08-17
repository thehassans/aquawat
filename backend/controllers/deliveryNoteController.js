import mongoose from 'mongoose';
import PurchaseOrder from '../models/PurchaseOrder.js';
import Quotation from '../models/Quotation.js';
import DeliveryNote from '../models/DeliveryNote.js';

export const createDeliveryNoteFromPO = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      poId,
      purchaseOrderId,
      quotationId,
      customerId,
      customerName,
      deliveryItems,
      lineItems: rawLineItems,
      driverName,
      driverPhone,
      vehicleNumber,
      carrier,
      trackingNumber,
      deliveryDate,
      notes
    } = req.body;

    const tenantId = req.user.tenantId;
    const targetPoId = poId || purchaseOrderId;

    let targetCustomerId = customerId;
    let targetCustomerName = customerName || '';
    let dnItems = [];
    let sourceDocType = 'manual';
    let po = null;
    let quotation = null;

    if (targetPoId) {
      sourceDocType = 'purchase_order';
      po = await PurchaseOrder.findOne({ _id: targetPoId, tenantId }).session(session);
      if (!po) {
        throw new Error('Purchase / Sales Order not found');
      }
      if (['delivered', 'closed', 'cancelled'].includes(po.status)) {
        throw new Error(`Order is already ${po.status}`);
      }

      targetCustomerId = po.customerId || po.supplierId;
      const itemsToProcess = deliveryItems || rawLineItems || [];

      let isFullyDelivered = true;
      for (const dItem of itemsToProcess) {
        const poItemId = dItem.poItemId || dItem.sourcePoItemId || dItem._id;
        const poItem = po.lineItems?.id ? po.lineItems.id(poItemId) : (po.lineItems || []).find(i => String(i._id) === String(poItemId));
        
        const qty = Number(dItem.quantityDelivered || dItem.quantity || 0);
        if (qty <= 0) continue;

        if (poItem) {
          const remainingQty = (poItem.quantityOrdered || 0) - (poItem.quantityDelivered || 0);
          poItem.quantityDelivered = (poItem.quantityDelivered || 0) + qty;
          dnItems.push({
            productId: poItem.productId,
            description: poItem.description || poItem.productName || poItem.productNameAr || 'Item',
            unitCode: poItem.uom || poItem.unitCode || 'PCE',
            poItemId: poItem._id,
            quantityDelivered: qty,
            quantityInvoiced: 0
          });
        } else {
          dnItems.push({
            productId: dItem.productId,
            description: dItem.description || dItem.productName || 'Item',
            unitCode: dItem.uom || dItem.unitCode || 'PCE',
            quantityDelivered: qty,
            quantityInvoiced: 0
          });
        }
      }

      if (po.lineItems && po.lineItems.length > 0) {
        po.lineItems.forEach(item => {
          if ((item.quantityDelivered || 0) < (item.quantityOrdered || 0)) {
            isFullyDelivered = false;
          }
        });
        po.status = isFullyDelivered ? 'delivered' : 'partially_delivered';
        await po.save({ session });
      }
    } else if (quotationId) {
      sourceDocType = 'quotation';
      quotation = await Quotation.findOne({ _id: quotationId, tenantId }).session(session);
      if (!quotation) {
        throw new Error('Quotation not found');
      }

      targetCustomerId = quotation.customerId || quotation.buyerId;
      targetCustomerName = quotation.buyer?.name || quotation.buyer?.nameAr || '';

      const itemsToProcess = deliveryItems || rawLineItems || [];
      if (itemsToProcess.length > 0) {
        for (const dItem of itemsToProcess) {
          const qItemId = dItem.quotationItemId || dItem.sourceQuotationItemId || dItem._id;
          const qItem = quotation.lineItems?.id ? quotation.lineItems.id(qItemId) : (quotation.lineItems || []).find(l => String(l._id) === String(qItemId));
          
          const qty = Number(dItem.quantityDelivered || dItem.quantity || 0);
          if (qty <= 0) continue;

          dnItems.push({
            productId: qItem?.productId || dItem.productId,
            description: qItem?.productName || qItem?.productNameAr || dItem.description || dItem.productName || 'Item',
            unitCode: qItem?.unitCode || dItem.unitCode || 'PCE',
            quotationItemId: qItem?._id,
            quantityDelivered: qty,
            quantityInvoiced: 0
          });
        }
      } else {
        for (const qItem of (quotation.lineItems || [])) {
          const qty = Number(qItem.quantity || 0);
          if (qty <= 0) continue;
          dnItems.push({
            productId: qItem.productId,
            description: qItem.productName || qItem.productNameAr || 'Item',
            unitCode: qItem.unitCode || 'PCE',
            quotationItemId: qItem._id,
            quantityDelivered: qty,
            quantityInvoiced: 0
          });
        }
      }
    } else {
      sourceDocType = 'manual';
      const itemsToProcess = rawLineItems || deliveryItems || [];
      for (const item of itemsToProcess) {
        const qty = Number(item.quantityDelivered || item.quantity || 0);
        if (qty <= 0) continue;
        dnItems.push({
          productId: item.productId || undefined,
          description: item.description || item.productName || 'Item',
          unitCode: item.unitCode || 'PCE',
          quantityDelivered: qty,
          quantityInvoiced: 0
        });
      }
    }

    if (dnItems.length === 0) {
      throw new Error('At least one item must be delivered');
    }

    // Generate DN Number
    const lastDn = await DeliveryNote.findOne({ tenantId }).sort({ createdAt: -1 }).session(session);
    let seq = 1;
    if (lastDn && lastDn.dnNumber && lastDn.dnNumber.includes('-')) {
      const parts = lastDn.dnNumber.split('-');
      const num = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(num)) seq = num + 1;
    }
    const dnNumber = `DN-${new Date().getFullYear()}-${String(seq).padStart(5, '0')}`;

    // Create Delivery Note
    const dn = new DeliveryNote({
      tenantId,
      dnNumber,
      customerId: targetCustomerId || undefined,
      customerName: targetCustomerName,
      purchaseOrderId: po?._id || undefined,
      quotationId: quotation?._id || undefined,
      sourceDocType,
      status: 'pending_invoice',
      lineItems: dnItems,
      driverName,
      driverPhone,
      vehicleNumber,
      carrier,
      trackingNumber,
      deliveryDate: deliveryDate ? new Date(deliveryDate) : new Date(),
      notes,
      createdBy: req.user._id
    });
    
    await dn.save({ session });

    await session.commitTransaction();
    res.status(201).json({
      message: 'Delivery Note created successfully',
      deliveryNote: dn,
      poStatus: po?.status
    });

  } catch (error) {
    await session.abortTransaction();
    res.status(400).json({ error: error.message });
  } finally {
    session.endSession();
  }
};
