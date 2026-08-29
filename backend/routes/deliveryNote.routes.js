import express from 'express';
import { protect, tenantFilter, checkPermission, requireTenantFilter } from '../middleware/auth.js';
import { createDeliveryNoteFromPO } from '../controllers/deliveryNoteController.js';
import DeliveryNote from '../models/DeliveryNote.js';

const router = express.Router();

router.use(protect);
router.use(tenantFilter);
router.use(requireTenantFilter);

// @route   POST /api/delivery-notes
router.post('/', checkPermission('invoicing', 'create'), createDeliveryNoteFromPO);

// @route   GET /api/delivery-notes
router.get('/', checkPermission('invoicing', 'read'), async (req, res) => {
  try {
    const { page = 1, limit = 25, status, customerId, purchaseOrderId, quotationId, shipmentId, search } = req.query;
    const query = { ...req.tenantFilter };

    if (status) query.status = status;
    if (customerId) query.customerId = customerId;
    if (purchaseOrderId) query.purchaseOrderId = purchaseOrderId;
    if (quotationId) query.quotationId = quotationId;
    if (shipmentId) query.shipmentId = shipmentId;
    if (search && String(search).trim()) {
      const searchRegex = { $regex: String(search).trim(), $options: 'i' };
      query.$or = [
        { dnNumber: searchRegex },
        { customerName: searchRegex },
        { driverName: searchRegex },
        { trackingNumber: searchRegex },
        { carrier: searchRegex }
      ];
    }

    const deliveryNotes = await DeliveryNote.find(query)
      .populate('customerId', 'code nameEn nameAr phone email')
      .populate('purchaseOrderId', 'poNumber status')
      .populate('quotationId', 'quotationNumber status issueDate')
      .populate('shipmentId', 'shipmentNumber status carrier trackingNumber')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await DeliveryNote.countDocuments(query);

    res.json({
      deliveryNotes,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   GET /api/delivery-notes/:id
router.get('/:id', checkPermission('invoicing', 'read'), async (req, res) => {
  try {
    const deliveryNote = await DeliveryNote.findOne({ _id: req.params.id, ...req.tenantFilter })
      .populate('customerId', 'code nameEn nameAr phone email address vatNumber')
      .populate('purchaseOrderId', 'poNumber status date supplierId customerId lineItems')
      .populate('quotationId', 'quotationNumber status issueDate buyer seller lineItems')
      .populate('shipmentId', 'shipmentNumber status carrier trackingNumber')
      .populate('lineItems.productId', 'sku nameEn nameAr barcode unitPrice unit measureUnit');

    if (!deliveryNote) {
      return res.status(404).json({ error: 'Delivery note not found' });
    }

    res.json(deliveryNote);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/mark-delivered', checkPermission('invoicing', 'update'), async (req, res) => {
  try {
    const dn = await DeliveryNote.findOne({ _id: req.params.id, ...req.tenantFilter });
    if (!dn) return res.status(404).json({ error: 'Delivery note not found' });

    if (dn.inventoryTransferId) {
      const { validateTransfer } = await import('../services/inventory/transferService.js');
      const createBackorder = Object.prototype.hasOwnProperty.call(req.body || {}, 'createBackorder')
        ? req.body.createBackorder
        : null;
      try {
        await validateTransfer(req.user.tenantId, dn.inventoryTransferId, {
          userId: req.user._id,
          createBackorder,
        });
      } catch (err) {
        if (err?.code === 'BACKORDER_REQUIRED' || /BACKORDER_REQUIRED|Partial validation/i.test(String(err.message || ''))) {
          return res.status(409).json({
            error: err.message,
            code: 'BACKORDER_REQUIRED',
            message: 'You are processing less than the initial demand. Create a Backorder?',
          });
        }
        if (!/already done|VALIDATE_LOCK|done/i.test(String(err.message || err.code || ''))) {
          console.warn('[dn] validate transfer:', err.message);
          return res.status(400).json({ error: err.message, code: err.code });
        }
      }
    }

    dn.status = 'delivered';
    await dn.save();

    const { recomputeSellOrderDelivered } = await import('../services/sales/syncDeliveredQty.js');
    const sync = dn.purchaseOrderId
      ? await recomputeSellOrderDelivered(dn.purchaseOrderId)
      : { synced: false };

    const refreshed = await DeliveryNote.findById(dn._id);
    res.json({ deliveryNote: refreshed, sync });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
