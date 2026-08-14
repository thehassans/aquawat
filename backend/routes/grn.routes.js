import express from 'express';
import { protect, tenantFilter, requireTenantFilter } from '../middleware/auth.js';
import GRN from '../models/GRN.js';
import PurchaseOrder from '../models/PurchaseOrder.js';
import { adjustProductStock, findCatalogProduct } from '../services/inventoryAdjust.js';

const router = express.Router();
router.use(protect);
router.use(tenantFilter);
router.use(requireTenantFilter);

// Generate GRN Number
const generateGrnNumber = async (tenantId) => {
  const count = await GRN.countDocuments({ tenantId });
  return `GRN-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;
};

// Get all GRNs
router.get('/', async (req, res) => {
  try {
    const grns = await GRN.find({ tenantId: req.user.tenantId })
      .populate('supplierId', 'nameEn nameAr')
      .populate('purchaseOrderId', 'poNumber')
      .sort('-createdAt');
    res.json(grns);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create GRN and update stock
router.post('/', async (req, res) => {
  try {
    const { supplierId, purchaseOrderId, referenceNumber, lines, notes } = req.body;

    for (const line of lines || []) {
      if (!line.productId) continue;
      const found = await findCatalogProduct(req.user.tenantId, line.productId);
      if (!found) {
        return res.status(400).json({ error: `Product not found: ${line.productName || line.productId}` });
      }
    }

    const grnNumber = await generateGrnNumber(req.user.tenantId);

    const grn = new GRN({
      tenantId: req.user.tenantId,
      grnNumber,
      supplierId,
      purchaseOrderId,
      referenceNumber,
      notes,
      receivedBy: req.user._id,
      lines: lines || []
    });

    await grn.save();

    for (const line of grn.lines) {
      if (!line.productId) continue;
      const updated = await adjustProductStock({
        tenantId: req.user.tenantId,
        productId: line.productId,
        delta: line.quantityReceived,
        setFields: {
          costPrice: line.costPrice,
          expiryDate: line.expiryDate,
          batchNumber: line.batchNumber,
        },
      });
      if (!updated) {
        throw new Error(`Product not found: ${line.productName || line.productId}`);
      }
    }

    // Optionally mark PO as fulfilled if linked
    if (purchaseOrderId) {
      await PurchaseOrder.findByIdAndUpdate(purchaseOrderId, { status: 'fulfilled' });
    }

    res.status(201).json(grn);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get Single GRN
router.get('/:id', async (req, res) => {
  try {
    const grn = await GRN.findOne({ _id: req.params.id, tenantId: req.user.tenantId })
      .populate('supplierId', 'nameEn nameAr email phone')
      .populate('purchaseOrderId', 'poNumber')
      .populate('receivedBy', 'name');
    
    if (!grn) return res.status(404).json({ error: 'GRN not found' });
    res.json(grn);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
