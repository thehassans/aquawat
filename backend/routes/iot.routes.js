import express from 'express';
import IoTDevice from '../models/IoTDevice.js';
import IoTReading from '../models/IoTReading.js';
import { protect, tenantFilter, checkPermission, requireBusinessType, requireTenantFilter } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);
router.use(tenantFilter);
router.use(requireTenantFilter);
router.use(requireBusinessType('trading'));

router.get('/devices', checkPermission('iot', 'read'), async (req, res) => {
  try {
    const { page = 1, limit = 25, status, type, search, isActive } = req.query;

    const query = { ...req.tenantFilter };

    if (isActive === 'false') {
      query.isActive = false;
    } else if (isActive === 'all') {
      // no filter
    } else {
      query.isActive = true;
    }

    if (status) query.status = status;
    if (type) query.type = type;

    if (search) {
      query.$or = [
        { code: { $regex: search, $options: 'i' } },
        { nameEn: { $regex: search, $options: 'i' } },
        { nameAr: { $regex: search, $options: 'i' } },
        { 'location.name': { $regex: search, $options: 'i' } },
        { 'location.zone': { $regex: search, $options: 'i' } }
      ];
    }

    const devices = await IoTDevice.find(query)
      .sort({ updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await IoTDevice.countDocuments(query);

    res.json({
      devices,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/devices/stats', checkPermission('iot', 'read'), async (req, res) => {
  try {
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const stats = await IoTDevice.aggregate([
      { $match: { ...req.tenantFilter, isActive: true } },
      {
        $facet: {
          totals: [
            {
              $group: {
                _id: null,
                total: { $sum: 1 },
                active: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
                inactive: { $sum: { $cond: [{ $eq: ['$status', 'inactive'] }, 1, 0] } },
                maintenance: { $sum: { $cond: [{ $eq: ['$status', 'maintenance'] }, 1, 0] } }
              }
            }
          ],
          byStatus: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
          byType: [{ $group: { _id: '$type', count: { $sum: 1 } } }],
          recentlySeen: [
            { $match: { lastSeenAt: { $gte: last24h } } },
            { $count: 'count' }
          ]
        }
      }
    ]);

    res.json(stats[0] || {});
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/devices/:id', checkPermission('iot', 'read'), async (req, res) => {
  try {
    const device = await IoTDevice.findOne({ _id: req.params.id, ...req.tenantFilter });

    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    res.json(device);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/devices', checkPermission('iot', 'create'), async (req, res) => {
  try {
    const { tags } = req.body;

    const data = {
      ...req.body,
      tags: Array.isArray(tags) ? tags : undefined,
      tenantId: req.user.tenantId,
      createdBy: req.user._id
    };

    const device = await IoTDevice.create(data);
    res.status(201).json(device);
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(400).json({ error: 'Duplicate device code' });
    }
    res.status(500).json({ error: error.message });
  }
});

router.put('/devices/:id', checkPermission('iot', 'update'), async (req, res) => {
  try {
    const existing = await IoTDevice.findOne({ _id: req.params.id, ...req.tenantFilter });
    if (!existing) {
      return res.status(404).json({ error: 'Device not found' });
    }

    const { tags } = req.body;

    const updateData = {
      ...req.body,
      ...(Array.isArray(tags) ? { tags } : {})
    };

    const device = await IoTDevice.findOneAndUpdate(
      { _id: req.params.id, ...req.tenantFilter },
      updateData,
      { new: true, runValidators: true }
    );

    res.json(device);
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(400).json({ error: 'Duplicate device code' });
    }
    res.status(500).json({ error: error.message });
  }
});

router.delete('/devices/:id', checkPermission('iot', 'delete'), async (req, res) => {
  try {
    const device = await IoTDevice.findOneAndUpdate(
      { _id: req.params.id, ...req.tenantFilter },
      { isActive: false, status: 'inactive' },
      { new: true }
    );

    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    res.json({ message: 'Device deactivated', device });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/devices/:id/readings', checkPermission('iot', 'read'), async (req, res) => {
  try {
    const { page = 1, limit = 50, startDate, endDate, status } = req.query;

    const device = await IoTDevice.findOne({ _id: req.params.id, ...req.tenantFilter });
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    const query = { ...req.tenantFilter, deviceId: device._id };

    if (status) query.status = status;

    if (startDate || endDate) {
      query.recordedAt = {};
      if (startDate) query.recordedAt.$gte = new Date(startDate);
      if (endDate) query.recordedAt.$lte = new Date(endDate);
    }

    const readings = await IoTReading.find(query)
      .sort({ recordedAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await IoTReading.countDocuments(query);

    res.json({
      readings,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/devices/:id/readings', checkPermission('iot', 'create'), async (req, res) => {
  try {
    const device = await IoTDevice.findOne({ _id: req.params.id, ...req.tenantFilter });
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    const recordedAt = req.body.recordedAt ? new Date(req.body.recordedAt) : new Date();

    const reading = await IoTReading.create({
      tenantId: req.user.tenantId,
      deviceId: device._id,
      recordedAt,
      metrics: req.body.metrics || {},
      battery: typeof req.body.battery === 'number' ? req.body.battery : undefined,
      signal: typeof req.body.signal === 'number' ? req.body.signal : undefined,
      status: req.body.status || 'ok',
      notes: req.body.notes,
      createdBy: req.user._id
    });

    device.lastSeenAt = recordedAt;
    await device.save();

    res.status(201).json(reading);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
