import express from 'express';
import mongoose from 'mongoose';
import RestaurantKDSStation from '../models/RestaurantKDSStation.js';
import RestaurantOrder from '../models/RestaurantOrder.js';
import RestaurantMenuItem from '../models/RestaurantMenuItem.js';
import { protect, tenantFilter, checkPermission, requireBusinessType, requireTenantFilter } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);
router.use(tenantFilter);
router.use(requireTenantFilter);
router.use(requireBusinessType('restaurant'));

function getTenantFilter(req) {
  return { tenantId: new mongoose.Types.ObjectId(req.user.tenantId) };
}

// =================== Station Configuration ===================

// @route   GET /api/restaurant/kds/stations
router.get('/stations', checkPermission('restaurant', 'read'), async (req, res) => {
  try {
    const stations = await RestaurantKDSStation.find({ ...getTenantFilter(req), isActive: true }).sort({ sortOrder: 1 });
    res.json(stations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   POST /api/restaurant/kds/stations
router.post('/stations', checkPermission('restaurant', 'create'), async (req, res) => {
  try {
    const station = await RestaurantKDSStation.create({
      ...req.body,
      tenantId: req.user.tenantId,
      createdBy: req.user._id,
    });
    res.status(201).json(station);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   PUT /api/restaurant/kds/stations/:id
router.put('/stations/:id', checkPermission('restaurant', 'update'), async (req, res) => {
  try {
    const station = await RestaurantKDSStation.findOneAndUpdate(
      { _id: req.params.id, ...getTenantFilter(req) },
      req.body,
      { new: true, runValidators: true }
    );
    if (!station) return res.status(404).json({ error: 'Station not found' });
    res.json(station);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   DELETE /api/restaurant/kds/stations/:id
router.delete('/stations/:id', checkPermission('restaurant', 'delete'), async (req, res) => {
  try {
    const station = await RestaurantKDSStation.findOneAndUpdate(
      { _id: req.params.id, ...getTenantFilter(req) },
      { isActive: false },
      { new: true }
    );
    if (!station) return res.status(404).json({ error: 'Station not found' });
    res.json({ message: 'Station deactivated' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// =================== KDS Board ===================

// @route   GET /api/restaurant/kds/board?stationId=...
router.get('/board', checkPermission('restaurant', 'read'), async (req, res) => {
  try {
    const { stationId } = req.query;

    // Get active stations
    const stations = await RestaurantKDSStation.find({ ...getTenantFilter(req), isActive: true }).sort({ sortOrder: 1 });

    // Get all active kitchen orders (not served/cancelled)
    const orders = await RestaurantOrder.find({
      ...getTenantFilter(req),
      isActive: true,
      kitchenStatus: { $in: ['new', 'preparing', 'ready'] },
    })
      .select('orderNumber orderType tableNumber customerName customerPhone kitchenStatus kitchenStatusUpdatedAt kitchenPrintedAt createdAt lineItems notes')
      .sort({ createdAt: 1 })
      .lean();

    // Get menu items for category lookup
    const menuItemIds = orders.flatMap(o => o.lineItems?.map(li => li.menuItemId).filter(Boolean) || []);
    const menuItems = menuItemIds.length > 0
      ? await RestaurantMenuItem.find({ _id: { $in: menuItemIds } }).select('category nameEn')
      : [];
    const categoryMap = new Map(menuItems.map(m => [String(m._id), m.category || 'Uncategorized']));

    // Enrich line items with categories
    orders.forEach(order => {
      order.lineItems?.forEach(li => {
        if (li.menuItemId) li.category = categoryMap.get(String(li.menuItemId)) || 'Uncategorized';
        else li.category = 'Uncategorized';
      });
    });

    // Group orders by station
    const stationCategories = new Map();
    stations.forEach(s => {
      s.categories.forEach(c => stationCategories.set(c, s._id.toString()));
    });

    // If stationId filter is provided, filter orders to only those with items matching that station
    let filteredOrders = orders;
    if (stationId) {
      const station = stations.find(s => String(s._id) === String(stationId));
      if (station) {
        const stationCats = new Set(station.categories);
        filteredOrders = orders.map(order => ({
          ...order,
          lineItems: order.lineItems?.filter(li => stationCats.has(li.category)) || [],
        })).filter(order => order.lineItems.length > 0);
      }
    }

    // Compute elapsed time and urgency for each order
    const now = Date.now();
    const enriched = filteredOrders.map(order => {
      const elapsed = Math.floor((now - new Date(order.kitchenStatusUpdatedAt || order.createdAt).getTime()) / 1000);
      const elapsedMinutes = Math.floor(elapsed / 60);
      const elapsedSeconds = elapsed % 60;

      // Determine urgency based on elapsed time since order was placed
      let urgency = 'normal';
      if (elapsedMinutes >= 20) urgency = 'critical';
      else if (elapsedMinutes >= 10) urgency = 'warning';

      // If status is ready, urgency is 'ready' regardless of time
      if (order.kitchenStatus === 'ready') urgency = 'ready';

      return {
        ...order,
        elapsedMinutes,
        elapsedSeconds,
        elapsedDisplay: `${elapsedMinutes}:${String(elapsedSeconds).padStart(2, '0')}`,
        urgency,
      };
    });

    // Group by status
    const board = {
      new: enriched.filter(o => o.kitchenStatus === 'new'),
      preparing: enriched.filter(o => o.kitchenStatus === 'preparing'),
      ready: enriched.filter(o => o.kitchenStatus === 'ready'),
    };

    // Summary
    const summary = {
      total: enriched.length,
      new: board.new.length,
      preparing: board.preparing.length,
      ready: board.ready.length,
      critical: enriched.filter(o => o.urgency === 'critical').length,
      avgWaitTime: enriched.length > 0
        ? Math.round(enriched.reduce((sum, o) => sum + o.elapsedMinutes, 0) / enriched.length)
        : 0,
    };

    res.json({ stations, board, summary });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   PUT /api/restaurant/kds/orders/:id/status
router.put('/orders/:id/status', checkPermission('restaurant', 'update'), async (req, res) => {
  try {
    const { kitchenStatus } = req.body;
    const order = await RestaurantOrder.findOne({ _id: req.params.id, ...getTenantFilter(req) });
    if (!order) return res.status(404).json({ error: 'Order not found' });

    order.kitchenStatus = kitchenStatus;
    order.kitchenStatusUpdatedAt = new Date();

    await order.save();
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   PUT /api/restaurant/kds/orders/:id/priority
router.put('/orders/:id/priority', checkPermission('restaurant', 'update'), async (req, res) => {
  try {
    const { priority } = req.body; // 'high', 'normal', 'low'
    const order = await RestaurantOrder.findOneAndUpdate(
      { _id: req.params.id, ...getTenantFilter(req) },
      { $set: { 'notes.priority': priority } },
      { new: true }
    );
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   PUT /api/restaurant/kds/orders/bump-all-ready
router.put('/orders/bump-all-ready', checkPermission('restaurant', 'update'), async (req, res) => {
  try {
    const result = await RestaurantOrder.updateMany(
      { ...getTenantFilter(req), kitchenStatus: 'ready', isActive: true },
      { kitchenStatus: 'served', kitchenStatusUpdatedAt: new Date() }
    );
    res.json({ message: `${result.modifiedCount} orders bumped to served` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
