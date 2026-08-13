import express from 'express';
import { protect, tenantFilter, requireTenantFilter } from '../middleware/auth.js';
import GRN from '../models/GRN.js';
import BakalaProduct from '../models/BakalaProduct.js';
import PurchaseOrder from '../models/PurchaseOrder.js';

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

    // Update Inventory
    for (const line of grn.lines) {
      if (line.productId) {
        const updateData = {
          $inc: { stockQuantity: line.quantityReceived }
        };
        // Update cost price and expiry if provided
        if (line.costPrice) {
          updateData.$set = updateData.$set || {};
          updateData.$set.costPrice = line.costPrice;
        }
        if (line.expiryDate) {
          updateData.$set = updateData.$set || {};
          updateData.$set.expiryDate = line.expiryDate;
        }
        if (line.batchNumber) {
          updateData.$set = updateData.$set || {};
          updateData.$set.batchNumber = line.batchNumber;
        }

        await BakalaProduct.findOneAndUpdate(
          { _id: line.productId, tenantId: req.user.tenantId },
          updateData
        );
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
