import express from 'express';
import RestaurantInventory from '../models/RestaurantInventory.js';
import { protect, tenantFilter, checkPermission, requireBusinessType, requireTenantFilter } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);
router.use(tenantFilter);
router.use(requireTenantFilter);
router.use(requireBusinessType('restaurant'));

// Get all inventory items
router.get('/', checkPermission('restaurant', 'read'), async (req, res) => {
  try {
    const { category, search, isActive = 'true' } = req.query;
    const query = { ...req.tenantFilter };

    if (isActive === 'false') query.isActive = false;
    else if (isActive === 'all') {} 
    else query.isActive = true;

    if (category) query.category = category;
    if (search) {
      query.$or = [
        { nameEn: { $regex: search, $options: 'i' } },
        { nameAr: { $regex: search, $options: 'i' } },
      ];
    }

    const items = await RestaurantInventory.find(query).sort({ nameEn: 1 });
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create inventory item
router.post('/', checkPermission('restaurant', 'create'), async (req, res) => {
  try {
    const item = await RestaurantInventory.create({
      ...req.body,
      tenantId: req.user.tenantId,
      createdBy: req.user._id,
    });
    res.status(201).json(item);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update inventory item
router.put('/:id', checkPermission('restaurant', 'update'), async (req, res) => {
  try {
    const item = await RestaurantInventory.findOneAndUpdate(
      { _id: req.params.id, ...req.tenantFilter },
      req.body,
      { new: true, runValidators: true }
    );
    if (!item) return res.status(404).json({ error: 'Inventory item not found' });
    res.json(item);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Deactivate inventory item
router.delete('/:id', checkPermission('restaurant', 'delete'), async (req, res) => {
  try {
    const item = await RestaurantInventory.findOneAndUpdate(
      { _id: req.params.id, ...req.tenantFilter },
      { isActive: false },
      { new: true }
    );
    if (!item) return res.status(404).json({ error: 'Inventory item not found' });
    res.json({ message: 'Inventory item deactivated', item });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
