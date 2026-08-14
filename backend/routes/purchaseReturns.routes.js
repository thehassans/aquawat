import express from 'express';
import { protect, tenantFilter, requireTenantFilter } from '../middleware/auth.js';
import { checkTrialLimits } from '../middleware/trialLimits.js';
import PurchaseReturn from '../models/PurchaseReturn.js';
import { adjustProductStock, findCatalogProduct } from '../services/inventoryAdjust.js';

const router = express.Router();
router.use(protect);
router.use(tenantFilter);
router.use(requireTenantFilter);

// Generate Return Number
const generateReturnNumber = async (tenantId) => {
  const count = await PurchaseReturn.countDocuments({ tenantId });
  return `PR-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;
};

// Get all Purchase Returns
router.get('/', protect, async (req, res) => {
  try {
    const returns = await PurchaseReturn.find({ tenantId: req.user.tenantId })
      .populate('supplierId', 'nameEn nameAr')
      .sort('-createdAt');
    res.json(returns);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create Purchase Return and update stock
router.post('/', checkTrialLimits('purchaseReturns'), protect, async (req, res) => {
  try {
    const { supplierId, referenceNumber, lines, notes } = req.body;

    for (const line of lines || []) {
      if (!line.productId) continue;
      const found = await findCatalogProduct(req.user.tenantId, line.productId);
      if (!found) {
        return res.status(400).json({ error: `Product not found: ${line.productName || line.productId}` });
      }
    }

    const returnNumber = await generateReturnNumber(req.user.tenantId);

    const purchaseReturn = new PurchaseReturn({
      tenantId: req.user.tenantId,
      returnNumber,
      supplierId,
      referenceNumber,
      notes,
      returnedBy: req.user._id,
      lines: lines || []
    });

    await purchaseReturn.save();

    for (const line of purchaseReturn.lines) {
      if (!line.productId) continue;
      const updated = await adjustProductStock({
        tenantId: req.user.tenantId,
        productId: line.productId,
        delta: -line.quantityReturned,
      });
      if (!updated) {
        throw new Error(`Product not found: ${line.productName || line.productId}`);
      }
    }

    res.status(201).json(purchaseReturn);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get Single Purchase Return
router.get('/:id', protect, async (req, res) => {
  try {
    const purchaseReturn = await PurchaseReturn.findOne({ _id: req.params.id, tenantId: req.user.tenantId })
      .populate('supplierId', 'nameEn nameAr email phone')
      .populate('returnedBy', 'name');
    
    if (!purchaseReturn) return res.status(404).json({ error: 'Purchase Return not found' });
    res.json(purchaseReturn);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
