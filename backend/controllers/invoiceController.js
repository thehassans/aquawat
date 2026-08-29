import mongoose from 'mongoose';
import DeliveryNote from '../models/DeliveryNote.js';
import Invoice from '../models/Invoice.js';
import PurchaseOrder from '../models/PurchaseOrder.js';
import Customer from '../models/Customer.js';
import Transaction from '../models/Transaction.js';

export const createInvoiceFromMultipleDNs = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const customerId = req.body.customerId;
    const dnIds = req.body.dnIds || req.body.deliveryNoteIds || [];
    const tenantId = req.user.tenantId;

    if (!customerId) {
      throw new Error('customerId is required');
    }
    if (!Array.isArray(dnIds) || !dnIds.length) {
      throw new Error('dnIds is required');
    }

    const dns = await DeliveryNote.find({ _id: { $in: dnIds }, customerId, tenantId }).session(session);
    if (dns.length !== dnIds.length) {
      throw new Error('One or more Delivery Notes are invalid or belong to a different customer');
    }

    // B2B identity gate (VAT + CR)
    const customerForGate = await Customer.findOne({ _id: customerId, tenantId }).session(session);
    if (customerForGate) {
      const isB2b = customerForGate.entityType === 'business'
        || customerForGate.entityType === 'company'
        || customerForGate.type === 'company'
        || customerForGate.type === 'business'
        || customerForGate.isCompany === true
        || Boolean(customerForGate.vatNumber);
      if (isB2b) {
        const { assertB2bInvoiceReady } = await import('../services/sales/creditLimit.js');
        const b2b = assertB2bInvoiceReady({
          isCompany: true,
          entityType: 'business',
          vatNumber: customerForGate.vatNumber,
          crNumber: customerForGate.crNumber,
        });
        if (!b2b.ok) {
          throw Object.assign(new Error(b2b.error), { code: b2b.code, missing: b2b.missing });
        }
      }
    }

    let subtotal = 0;
    const invoiceLineItems = [];
    const deliveryNoteIds = [];
    const poCache = {};

    let lineNumber = 1;

    for (const dn of dns) {
      if (['fully_invoiced', 'cancelled'].includes(dn.status)) {
        throw new Error(`Delivery Note ${dn.dnNumber} is already ${dn.status}`);
      }
      
      deliveryNoteIds.push(dn._id);
      let dnFullyInvoiced = true;

      // Ensure PO is loaded in cache
      if (!poCache[dn.purchaseOrderId]) {
        const po = await PurchaseOrder.findOne({ _id: dn.purchaseOrderId, tenantId }).session(session);
        if (!po) throw new Error(`PO ${dn.purchaseOrderId} not found`);
        poCache[dn.purchaseOrderId] = po;
      }
      const po = poCache[dn.purchaseOrderId];

      for (const dnItem of dn.lineItems) {
        const remainingToInvoice = dnItem.quantityDelivered - (dnItem.quantityInvoiced || 0);
        if (remainingToInvoice <= 0) continue; 

        const poItem = dnItem.poItemId ? po.lineItems.id(dnItem.poItemId) : null;
        const sourcePoItemId = poItem?._id || dnItem.poItemId || null;
        if (!sourcePoItemId) {
          throw new Error(
            `Delivery Note ${dn.dnNumber} line missing poItemId / sourcePoItemId — run sell line id backfill`,
          );
        }
        const unitCost = Number(poItem?.unitCost ?? dnItem.unitPrice ?? 0);
        const taxRate = Number(poItem?.taxRate ?? dnItem.taxRate ?? 15);
        const lineTotal = remainingToInvoice * unitCost;

        invoiceLineItems.push({
          lineNumber: lineNumber++,
          productId: dnItem.productId,
          productName: poItem?.manualName || poItem?.description || dnItem.productName || 'Product',
          quantity: remainingToInvoice,
          unitPrice: unitCost,
          lineTotal: lineTotal,
          lineTotalWithTax: lineTotal * (1 + (taxRate / 100)),
          taxRate,
          taxAmount: lineTotal * (taxRate / 100),
          sourceDnItemId: dnItem._id,
          sourcePoItemId,
        });

        subtotal += lineTotal;

        // Update quantities
        dnItem.quantityInvoiced = (dnItem.quantityInvoiced || 0) + remainingToInvoice;
        if (poItem) {
          poItem.quantityInvoiced = (poItem.quantityInvoiced || 0) + remainingToInvoice;
        }

        if (dnItem.quantityInvoiced < dnItem.quantityDelivered) {
          dnFullyInvoiced = false;
        }
      }

      dn.status = dnFullyInvoiced ? 'fully_invoiced' : 'partially_invoiced';
      await dn.save({ session });
    }

    // Save updated POs
    for (const poId in poCache) {
      await poCache[poId].save({ session });
    }

    // Calculate tax (assuming 15% standard if not line specific, or sum of lines)
    const totalTax = invoiceLineItems.reduce((sum, item) => sum + item.taxAmount, 0);
    const grandTotal = subtotal + totalTax;

    // Generate invoice number
    const lastInvoice = await Invoice.findOne({ tenantId }).sort({ createdAt: -1 }).session(session);
    let seq = 1;
    if (lastInvoice && lastInvoice.invoiceNumber && lastInvoice.invoiceNumber.includes('-')) {
      const parts = lastInvoice.invoiceNumber.split('-');
      seq = parseInt(parts[parts.length - 1], 10) + 1;
    }
    const invoiceNumber = `INV-${new Date().getFullYear()}-${String(seq).padStart(6, '0')}`;

    // Create Invoice
    const invoice = new Invoice({
      tenantId,
      invoiceNumber,
      invoiceTypeCode: '0100000', // Standard B2B
      transactionType: 'B2B',
      flow: 'sell',
      customerId,
      deliveryNoteIds,
      lineItems: invoiceLineItems,
      subtotal,
      totalTax,
      grandTotal,
      issueDate: new Date(),
      status: 'approved',
      createdBy: req.user._id
    });
    
    await invoice.save({ session });

    // Update Customer Balance & Create Ledger Transaction
    const customer = await Customer.findOne({ _id: customerId, tenantId }).session(session);
    if (customer) {
      customer.currentBalance = (customer.currentBalance || 0) + grandTotal;
      await customer.save({ session });

      const transaction = new Transaction({
        tenantId,
        customerId,
        type: 'invoice',
        referenceId: invoice._id,
        amount: grandTotal,
        balanceAfter: customer.currentBalance,
        description: `Consolidated Invoice ${invoiceNumber} across ${dns.length} Delivery Notes`,
        createdBy: req.user._id
      });
      await transaction.save({ session });
    }

    await session.commitTransaction();
    res.status(201).json({ message: 'Invoice generated successfully', invoice });

  } catch (error) {
    await session.abortTransaction();
    res.status(400).json({
      error: error.message,
      ...(error.code ? { code: error.code } : {}),
      ...(error.missing ? { missing: error.missing } : {}),
    });
  } finally {
    session.endSession();
  }
};
