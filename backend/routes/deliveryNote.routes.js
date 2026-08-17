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

export default router;
