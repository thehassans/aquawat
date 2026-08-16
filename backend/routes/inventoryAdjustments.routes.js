import express from 'express';
import { protect, tenantFilter, requireTenantFilter } from '../middleware/auth.js';
import InventoryAdjustment from '../models/InventoryAdjustment.js';
import { adjustProductStock } from '../services/inventoryAdjust.js';
import { resolveTenantId, withTenant, handleTenantScopeError } from '../utils/tenantScope.js';

const router = express.Router();
router.use(protect);
router.use(tenantFilter);
router.use(requireTenantFilter);

const getTargetTenantId = (user, req) => resolveTenantId(user, req);

const generateAdjustmentNumber = async (tenantId) => {
  const count = await InventoryAdjustment.countDocuments({ tenantId });
  return `ADJ-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;
};

router.get('/', protect, async (req, res) => {
  try {
    const tenantId = getTargetTenantId(req.user, req);
    const adjustments = await InventoryAdjustment.find(withTenant(tenantId))
      .populate('adjustedBy', 'name')
      .sort('-createdAt')
      .limit(200);
    res.json(adjustments);
  } catch (error) {
    if (handleTenantScopeError(res, error)) return;
    res.status(500).json({ error: error.message });
  }
});

router.post('/', protect, async (req, res) => {
  try {
    const { reason, notes, lines } = req.body;
    const tenantId = getTargetTenantId(req.user, req);
    const adjustmentNumber = await generateAdjustmentNumber(tenantId);

    const adjustment = new InventoryAdjustment({
      tenantId,
      adjustmentNumber,
      reason,
      notes,
      adjustedBy: req.user._id,
      lines: lines || [],
    });

    await adjustment.save();

    for (const line of adjustment.lines) {
      if (line.productId && line.difference !== undefined) {
        await adjustProductStock({
          tenantId,
          productId: line.productId,
          delta: line.difference
        });
      }
    }

    res.status(201).json(adjustment);
  } catch (error) {
    if (handleTenantScopeError(res, error)) return;
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', protect, async (req, res) => {
  try {
    const tenantId = getTargetTenantId(req.user, req);
    const adjustment = await InventoryAdjustment.findOne({
      _id: req.params.id,
      ...withTenant(tenantId),
    }).populate('adjustedBy', 'name');

    if (!adjustment) return res.status(404).json({ error: 'Adjustment not found' });
    res.json(adjustment);
  } catch (error) {
    if (handleTenantScopeError(res, error)) return;
    res.status(500).json({ error: error.message });
  }
});

export default router;
