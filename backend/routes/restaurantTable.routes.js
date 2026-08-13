import express from 'express';
import RestaurantTable from '../models/RestaurantTable.js';
import { protect, tenantFilter, checkPermission, requireBusinessType, requireTenantFilter } from '../middleware/auth.js';
import { checkTrialLimits } from '../middleware/trialLimits.js';

const router = express.Router();

router.use(protect);
router.use(tenantFilter);
router.use(requireTenantFilter);
router.use(requireBusinessType('restaurant'));

// Get all tables
router.get('/', checkPermission('restaurant', 'read'), async (req, res) => {
  try {
    const { status, isActive = 'true' } = req.query;
    const query = { ...req.tenantFilter };

    if (isActive === 'false') query.isActive = false;
    else if (isActive === 'all') {} 
    else query.isActive = true;

    if (status) query.status = status;

    const tables = await RestaurantTable.find(query).sort({ tableNumber: 1 });
    res.json(tables);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create a new table
router.post('/', checkTrialLimits('restaurantTables'), checkPermission('restaurant', 'create'), async (req, res) => {
  try {
    const table = await RestaurantTable.create({
      ...req.body,
      tenantId: req.user.tenantId,
      createdBy: req.user._id,
    });
    res.status(201).json(table);
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(400).json({ error: 'Table number already exists' });
    }
    res.status(500).json({ error: error.message });
  }
});

// Update a table
router.put('/:id', checkPermission('restaurant', 'update'), async (req, res) => {
  try {
    const table = await RestaurantTable.findOneAndUpdate(
      { _id: req.params.id, ...req.tenantFilter },
      req.body,
      { new: true, runValidators: true }
    );
    if (!table) return res.status(404).json({ error: 'Table not found' });
    res.json(table);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Deactivate a table
router.delete('/:id', checkPermission('restaurant', 'delete'), async (req, res) => {
  try {
    const table = await RestaurantTable.findOneAndUpdate(
      { _id: req.params.id, ...req.tenantFilter },
      { isActive: false },
      { new: true }
    );
    if (!table) return res.status(404).json({ error: 'Table not found' });
    res.json({ message: 'Table deactivated', table });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Seed initial tables for new restaurant
router.post('/seed', checkPermission('restaurant', 'create'), async (req, res) => {
  try {
    const existing = await RestaurantTable.countDocuments(req.tenantFilter);
    if (existing > 0) {
      return res.status(400).json({ error: 'Tables already seeded for this tenant' });
    }

    const seedData = [
      { tableNumber: '1', name: 'Window 1', seats: 2, shape: 'circle', positionX: 50, positionY: 50, width: 80, height: 80 },
      { tableNumber: '2', name: 'Window 2', seats: 2, shape: 'circle', positionX: 200, positionY: 50, width: 80, height: 80 },
      { tableNumber: '3', name: 'Center 1', seats: 4, shape: 'rectangle', positionX: 100, positionY: 200, width: 120, height: 80 },
      { tableNumber: '4', name: 'Center 2', seats: 4, shape: 'rectangle', positionX: 300, positionY: 200, width: 120, height: 80 },
      { tableNumber: '5', name: 'Booth A', seats: 6, shape: 'rectangle', positionX: 50, positionY: 350, width: 160, height: 100 },
      { tableNumber: '6', name: 'Booth B', seats: 6, shape: 'rectangle', positionX: 250, positionY: 350, width: 160, height: 100 },
      { tableNumber: 'VIP', name: 'VIP Room', seats: 10, shape: 'rectangle', positionX: 450, positionY: 100, width: 200, height: 150 },
    ];

    const tablesToInsert = seedData.map(t => ({
      ...t,
      tenantId: req.user.tenantId,
      createdBy: req.user._id,
      status: 'available',
      isActive: true,
    }));

    await RestaurantTable.insertMany(tablesToInsert);
    res.json({ message: 'Tables seeded successfully' });
  } catch (error) {
    console.error('Table seed error:', error);
    res.status(500).json({ error: 'Failed to seed tables' });
  }
});

export default router;
