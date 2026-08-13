import express from 'express';
import LaundryInventory from '../models/LaundryInventory.js';
import { protect, tenantFilter, checkPermission, requireBusinessType, requireTenantFilter } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);
router.use(tenantFilter);
router.use(requireTenantFilter);
router.use(requireBusinessType('laundry'));

// GET /api/laundry/inventory
router.get('/', checkPermission('laundry', 'read'), async (req, res) => {
  try {
    const inventory = await LaundryInventory.find({ tenantId: req.tenant._id }).sort({ itemNameEn: 1 });
    res.json(inventory);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/laundry/inventory
router.post('/', checkPermission('laundry', 'create'), async (req, res) => {
  try {
    const item = new LaundryInventory({
      ...req.body,
      tenantId: req.tenant._id,
      createdBy: req.user._id
    });
    await item.save();
    res.status(201).json(item);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// PUT /api/laundry/inventory/:id
router.put('/:id', checkPermission('laundry', 'update'), async (req, res) => {
  try {
    const item = await LaundryInventory.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenant._id },
      req.body,
      { new: true, runValidators: true }
    );
    if (!item) return res.status(404).json({ error: 'Item not found' });
    res.json(item);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// POST /api/laundry/inventory/:id/consume
router.post('/:id/consume', checkPermission('laundry', 'update'), async (req, res) => {
  try {
    const { amount } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ error: 'Invalid consumption amount' });
    
    const item = await LaundryInventory.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenant._id },
      { $inc: { stockLevel: -amount } },
      { new: true }
    );
    if (!item) return res.status(404).json({ error: 'Item not found' });
    res.json(item);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
