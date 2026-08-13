import express from 'express';
import mongoose from 'mongoose';
import KhayyatMeasurementProfile from '../models/khayyat/KhayyatMeasurementProfile.js';
import KhayyatDelivery from '../models/khayyat/KhayyatDelivery.js';
import KhayyatStitching from '../models/khayyat/KhayyatStitching.js';
import { protect, tenantFilter, requireTenantFilter } from '../middleware/auth.js';

const router = express.Router();
router.use(protect);
router.use(tenantFilter);
router.use(requireTenantFilter);

function getTenantFilter(req) {
  return { tenantId: new mongoose.Types.ObjectId(req.user.tenantId) };
}

// =================== Measurement Profiles ===================

// @route   GET /api/khayyat/measurements?customerId=...
router.get('/measurements', async (req, res) => {
  try {
    const { customerId, page = 1, limit = 50 } = req.query;
    const query = { ...getTenantFilter(req), isActive: true };
    if (customerId) query.customerId = new mongoose.Types.ObjectId(customerId);

    const [profiles, total] = await Promise.all([
      KhayyatMeasurementProfile.find(query).sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(parseInt(limit)),
      KhayyatMeasurementProfile.countDocuments(query),
    ]);

    res.json({ profiles, pagination: { page: parseInt(page), limit: parseInt(limit), total } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   GET /api/khayyat/measurements/customer/:customerId
router.get('/measurements/customer/:customerId', async (req, res) => {
  try {
    const profiles = await KhayyatMeasurementProfile.find({
      ...getTenantFilter(req),
      customerId: new mongoose.Types.ObjectId(req.params.customerId),
      isActive: true,
    }).sort({ profileName: 1 });
    res.json(profiles);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   POST /api/khayyat/measurements
router.post('/measurements', async (req, res) => {
  try {
    const { customerId, measurements, notes } = req.body;

    // Check if profile already exists for this customer + profileName
    const existing = await KhayyatMeasurementProfile.findOne({
      ...getTenantFilter(req),
      customerId: new mongoose.Types.ObjectId(customerId),
      profileName: req.body.profileName || 'Self',
    });

    if (existing) {
      // Add to history and update current
      existing.history.push({
        recordedAt: new Date(),
        recordedBy: req.user._id,
        measurements: existing.measurements,
        notes: 'Previous measurements',
      });
      existing.measurements = measurements || existing.measurements;
      if (notes) existing.notes = notes;
      if (req.body.defaultThawbType) existing.defaultThawbType = req.body.defaultThawbType;
      if (req.body.defaultFabricColor) existing.defaultFabricColor = req.body.defaultFabricColor;
      if (req.body.measurementImage) existing.measurementImage = req.body.measurementImage;
      await existing.save();
      return res.json(existing);
    }

    const profile = await KhayyatMeasurementProfile.create({
      ...req.body,
      tenantId: req.user.tenantId,
      createdBy: req.user._id,
      history: [{
        recordedAt: new Date(),
        recordedBy: req.user._id,
        measurements: measurements || {},
        notes: 'Initial measurements',
      }],
    });

    res.status(201).json(profile);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   PUT /api/khayyat/measurements/:id
router.put('/measurements/:id', async (req, res) => {
  try {
    const { measurements, notes } = req.body;
    const profile = await KhayyatMeasurementProfile.findOne({ _id: req.params.id, ...getTenantFilter(req) });
    if (!profile) return res.status(404).json({ error: 'Profile not found' });

    // Push old measurements to history
    if (measurements) {
      profile.history.push({
        recordedAt: new Date(),
        recordedBy: req.user._id,
        measurements: profile.measurements,
        notes: notes || 'Updated measurements',
      });
      profile.measurements = measurements;
    }

    if (notes !== undefined) profile.notes = notes;
    if (req.body.profileName) profile.profileName = req.body.profileName;
    if (req.body.defaultThawbType) profile.defaultThawbType = req.body.defaultThawbType;
    if (req.body.defaultFabricColor) profile.defaultFabricColor = req.body.defaultFabricColor;
    if (req.body.measurementImage) profile.measurementImage = req.body.measurementImage;

    await profile.save();
    res.json(profile);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   DELETE /api/khayyat/measurements/:id
router.delete('/measurements/:id', async (req, res) => {
  try {
    const profile = await KhayyatMeasurementProfile.findOneAndUpdate(
      { _id: req.params.id, ...getTenantFilter(req) },
      { isActive: false },
      { new: true }
    );
    if (!profile) return res.status(404).json({ error: 'Profile not found' });
    res.json({ message: 'Profile archived' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   POST /api/khayyat/measurements/:id/apply-to-stitching
router.post('/measurements/:id/apply-to-stitching', async (req, res) => {
  try {
    const { stitchingId } = req.body;
    const profile = await KhayyatMeasurementProfile.findOne({ _id: req.params.id, ...getTenantFilter(req) });
    if (!profile) return res.status(404).json({ error: 'Profile not found' });

    const stitching = await KhayyatStitching.findOne({ _id: stitchingId, ...getTenantFilter(req) });
    if (!stitching) return res.status(404).json({ error: 'Stitching order not found' });

    stitching.measurements = profile.measurements;
    if (!stitching.thawbType || stitching.thawbType === 'saudi') stitching.thawbType = profile.defaultThawbType;
    await stitching.save();

    res.json({ message: 'Measurements applied', stitching });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// =================== Delivery Scheduling ===================

// @route   GET /api/khayyat/deliveries?date=...&status=...
router.get('/deliveries', async (req, res) => {
  try {
    const { date, status, customerId, page = 1, limit = 50 } = req.query;
    const query = { ...getTenantFilter(req) };

    if (date) {
      const d = new Date(date);
      const next = new Date(d);
      next.setDate(next.getDate() + 1);
      query.scheduledDate = { $gte: d, $lt: next };
    }
    if (status) query.status = status;
    if (customerId) query.customerId = new mongoose.Types.ObjectId(customerId);

    const [deliveries, total] = await Promise.all([
      KhayyatDelivery.find(query).sort({ scheduledDate: 1 }).skip((page - 1) * limit).limit(parseInt(limit)),
      KhayyatDelivery.countDocuments(query),
    ]);

    res.json({ deliveries, pagination: { page: parseInt(page), limit: parseInt(limit), total } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   GET /api/khayyat/deliveries/dashboard
router.get('/deliveries/dashboard', async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date ? new Date(date) : new Date();
    const next = new Date(targetDate);
    next.setDate(next.getDate() + 1);

    const filter = { ...getTenantFilter(req), scheduledDate: { $gte: targetDate, $lt: next } };

    const [deliveries, stats] = await Promise.all([
      KhayyatDelivery.find(filter).sort({ timeSlot: 1 }),
      KhayyatDelivery.aggregate([
        { $match: filter },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
    ]);

    const statusCounts = {};
    stats.forEach(s => { statusCounts[s._id] = s.count; });

    // Overdue (past scheduled date, not delivered)
    const overdue = await KhayyatDelivery.find({
      ...getTenantFilter(req),
      scheduledDate: { $lt: targetDate },
      status: { $in: ['scheduled', 'ready_for_pickup', 'out_for_delivery'] },
    }).sort({ scheduledDate: 1 });

    res.json({
      date: targetDate.toISOString(),
      deliveries,
      summary: {
        total: deliveries.length,
        scheduled: statusCounts.scheduled || 0,
        readyForPickup: statusCounts.ready_for_pickup || 0,
        outForDelivery: statusCounts.out_for_delivery || 0,
        delivered: statusCounts.delivered || 0,
        failed: statusCounts.failed || 0,
        overdueCount: overdue.length,
      },
      overdue,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   POST /api/khayyat/deliveries
router.post('/deliveries', async (req, res) => {
  try {
    const { items = [] } = req.body;

    // Generate delivery number
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const count = await KhayyatDelivery.countDocuments({
      ...getTenantFilter(req),
      createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) },
    });
    const deliveryNumber = `DLV-${dateStr}-${String(count + 1).padStart(3, '0')}`;

    // Validate stitching items
    if (items.length > 0) {
      const stitchingIds = items.map(i => i.stitchingId).filter(Boolean);
      if (stitchingIds.length > 0) {
        const stitchings = await KhayyatStitching.find({
          _id: { $in: stitchingIds },
          ...getTenantFilter(req),
        }).select('receiptNumber thawbType fabricColor quantity price status');

        const stitchingMap = new Map(stitchings.map(s => [s._id.toString(), s]));
        items.forEach(item => {
          if (item.stitchingId) {
            const s = stitchingMap.get(item.stitchingId);
            if (s) {
              item.receiptNumber = s.receiptNumber;
              item.thawbType = s.thawbType;
              item.fabricColor = s.fabricColor;
              item.quantity = s.quantity;
              item.price = s.price;
            }
          }
        });
      }
    }

    const delivery = await KhayyatDelivery.create({
      ...req.body,
      items,
      deliveryNumber,
      tenantId: req.user.tenantId,
      createdBy: req.user._id,
    });

    res.status(201).json(delivery);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   PUT /api/khayyat/deliveries/:id
router.put('/deliveries/:id', async (req, res) => {
  try {
    const delivery = await KhayyatDelivery.findOneAndUpdate(
      { _id: req.params.id, ...getTenantFilter(req) },
      req.body,
      { new: true, runValidators: true }
    );
    if (!delivery) return res.status(404).json({ error: 'Delivery not found' });
    res.json(delivery);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   PUT /api/khayyat/deliveries/:id/status
router.put('/deliveries/:id/status', async (req, res) => {
  try {
    const { status, deliveredTo, failedReason } = req.body;
    const delivery = await KhayyatDelivery.findOne({ _id: req.params.id, ...getTenantFilter(req) });
    if (!delivery) return res.status(404).json({ error: 'Delivery not found' });

    delivery.status = status;
    if (status === 'delivered') {
      delivery.deliveredAt = new Date();
      delivery.deliveredTo = deliveredTo || '';
      // Update linked stitching orders to 'delivered'
      for (const item of delivery.items) {
        if (item.stitchingId) {
          await KhayyatStitching.findByIdAndUpdate(item.stitchingId, { status: 'delivered', deliveredDate: new Date() });
        }
      }
    } else if (status === 'failed') {
      delivery.failedReason = failedReason || '';
    } else if (status === 'ready_for_pickup') {
      delivery.readyNotificationSent = true;
      delivery.readyNotificationSentAt = new Date();
    }

    await delivery.save();
    res.json(delivery);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   PUT /api/khayyat/deliveries/:id/reminder
router.put('/deliveries/:id/reminder', async (req, res) => {
  try {
    const delivery = await KhayyatDelivery.findOne({ _id: req.params.id, ...getTenantFilter(req) });
    if (!delivery) return res.status(404).json({ error: 'Delivery not found' });

    delivery.reminderSent = true;
    delivery.reminderSentAt = new Date();
    await delivery.save();

    res.json({ message: 'Reminder sent', delivery });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   DELETE /api/khayyat/deliveries/:id
router.delete('/deliveries/:id', async (req, res) => {
  try {
    const delivery = await KhayyatDelivery.findOneAndDelete({ _id: req.params.id, ...getTenantFilter(req) });
    if (!delivery) return res.status(404).json({ error: 'Delivery not found' });
    res.json({ message: 'Delivery deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   GET /api/khayyat/deliveries/ready-stitchings
router.get('/deliveries/ready-stitchings/list', async (req, res) => {
  try {
    const stitchings = await KhayyatStitching.find({
      ...getTenantFilter(req),
      status: { $in: ['completed', 'done'] },
    })
      .select('receiptNumber customerName customerPhone thawbType fabricColor quantity price status dueDate completedDate')
      .sort({ completedDate: -1 })
      .limit(50);

    res.json(stitchings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
