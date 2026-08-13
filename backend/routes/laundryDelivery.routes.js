import express from 'express';
import mongoose from 'mongoose';
import LaundryDeliveryRoute from '../models/LaundryDeliveryRoute.js';
import LaundryOrder from '../models/LaundryOrder.js';
import { protect, tenantFilter, requireTenantFilter } from '../middleware/auth.js';

const router = express.Router();
router.use(protect);
router.use(tenantFilter);
router.use(requireTenantFilter);

function getTenantFilter(req) {
  return { tenantId: new mongoose.Types.ObjectId(req.user.tenantId) };
}

// @route   GET /api/laundry/routes?date=YYYY-MM-DD
router.get('/', async (req, res) => {
  try {
    const { date, status, page = 1, limit = 25 } = req.query;
    const query = { ...getTenantFilter(req) };

    if (date) {
      const d = new Date(date);
      const next = new Date(d);
      next.setDate(next.getDate() + 1);
      query.routeDate = { $gte: d, $lt: next };
    }
    if (status) query.status = status;

    const [routes, total] = await Promise.all([
      LaundryDeliveryRoute.find(query).sort({ routeDate: -1 }).skip((page - 1) * limit).limit(parseInt(limit)),
      LaundryDeliveryRoute.countDocuments(query),
    ]);

    res.json({ routes, pagination: { page: parseInt(page), limit: parseInt(limit), total } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   GET /api/laundry/routes/:id
router.get('/:id', async (req, res) => {
  try {
    const route = await LaundryDeliveryRoute.findOne({ _id: req.params.id, ...getTenantFilter(req) });
    if (!route) return res.status(404).json({ error: 'Route not found' });
    res.json(route);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   POST /api/laundry/routes
router.post('/', async (req, res) => {
  try {
    const { stops = [], driverId, driverName, routeDate } = req.body;

    // Generate route number
    const dateStr = new Date(routeDate || Date.now()).toISOString().slice(0, 10).replace(/-/g, '');
    const count = await LaundryDeliveryRoute.countDocuments({
      ...getTenantFilter(req),
      routeDate: { $gte: new Date(routeDate || Date.now()) },
    });
    const routeNumber = `RTE-${dateStr}-${String(count + 1).padStart(3, '0')}`;

    const route = await LaundryDeliveryRoute.create({
      tenantId: req.user.tenantId,
      routeNumber,
      routeDate: routeDate || new Date(),
      driverId,
      driverName,
      stops: stops.map((s, i) => ({ ...s, sequence: i + 1 })),
      totalStops: stops.length,
      createdBy: req.user._id,
    });

    res.status(201).json(route);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   PUT /api/laundry/routes/:id
router.put('/:id', async (req, res) => {
  try {
    const route = await LaundryDeliveryRoute.findOneAndUpdate(
      { _id: req.params.id, ...getTenantFilter(req) },
      req.body,
      { new: true, runValidators: true }
    );
    if (!route) return res.status(404).json({ error: 'Route not found' });
    res.json(route);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   PUT /api/laundry/routes/:id/start
router.put('/:id/start', async (req, res) => {
  try {
    const route = await LaundryDeliveryRoute.findOne({ _id: req.params.id, ...getTenantFilter(req) });
    if (!route) return res.status(404).json({ error: 'Route not found' });

    route.status = 'in_progress';
    route.startedAt = new Date();
    await route.save();
    res.json(route);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   PUT /api/laundry/routes/:id/stop/:stopId
router.put('/:id/stop/:stopId', async (req, res) => {
  try {
    const { status, failedReason, notes } = req.body;
    const route = await LaundryDeliveryRoute.findOne({ _id: req.params.id, ...getTenantFilter(req) });
    if (!route) return res.status(404).json({ error: 'Route not found' });

    const stop = route.stops.id(req.params.stopId);
    if (!stop) return res.status(404).json({ error: 'Stop not found' });

    stop.status = status;
    if (status === 'completed') stop.completedAt = new Date();
    if (status === 'failed') stop.failedReason = failedReason || '';
    if (notes) stop.notes = notes;

    // Update laundry order status
    if (stop.orderId) {
      let orderStatus = null;
      if (status === 'completed' && stop.stopType === 'pickup') orderStatus = 'processing';
      else if (status === 'completed' && stop.stopType === 'delivery') orderStatus = 'delivered';
      else if (status === 'completed' && stop.stopType === 'pickup') orderStatus = 'processing';

      if (orderStatus) {
        await LaundryOrder.findByIdAndUpdate(stop.orderId, { status: orderStatus });
      }
    }

    // Update route counts
    route.completedStops = route.stops.filter(s => s.status === 'completed').length;
    route.failedStops = route.stops.filter(s => s.status === 'failed').length;

    // Check if all stops are done
    const pendingStops = route.stops.filter(s => s.status === 'pending').length;
    if (pendingStops === 0) {
      route.status = 'completed';
      route.completedAt = new Date();
    }

    await route.save();
    res.json(route);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   GET /api/laundry/routes/available-orders
router.get('/available-orders/list', async (req, res) => {
  try {
    const { stopType } = req.query;
    const query = { ...getTenantFilter(req) };

    if (stopType === 'pickup') {
      query.status = 'received';
      query.deliveryType = 'delivery';
    } else if (stopType === 'delivery') {
      query.status = 'ready';
      query.deliveryType = 'delivery';
    }

    const orders = await LaundryOrder.find(query)
      .select('orderNumber customerName customerPhone status grandTotal promisedDate deliveryType')
      .sort({ createdAt: 1 })
      .limit(50);

    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   DELETE /api/laundry/routes/:id
router.delete('/:id', async (req, res) => {
  try {
    const route = await LaundryDeliveryRoute.findOneAndDelete({ _id: req.params.id, ...getTenantFilter(req) });
    if (!route) return res.status(404).json({ error: 'Route not found' });
    res.json({ message: 'Route deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
