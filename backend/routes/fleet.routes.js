import express from 'express';
import FleetAsset from '../models/FleetAsset.js';
import FuelLog from '../models/FuelLog.js';
import MaintenanceRecord from '../models/MaintenanceRecord.js';
import { protect, tenantFilter, checkPermission, requireBusinessType, requireTenantFilter } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);
router.use(tenantFilter);
router.use(requireTenantFilter);
router.use(requireBusinessType('construction', 'trading'));

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function generateAssetNumber(tenantFilter) {
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const d = String(today.getDate()).padStart(2, '0');
  const prefix = `FLEET-${y}${m}${d}`;
  const last = await FleetAsset.findOne({ ...tenantFilter, assetNumber: { $regex: `^${prefix}-` } })
    .sort({ createdAt: -1 })
    .select('assetNumber');
  let seq = 1;
  if (last?.assetNumber) {
    const parts = last.assetNumber.split('-');
    const lastSeq = Number(parts[parts.length - 1]);
    if (Number.isFinite(lastSeq)) seq = lastSeq + 1;
  }
  return `${prefix}-${String(seq).padStart(3, '0')}`;
}

// ─── Asset Routes ─────────────────────────────────────────────────────────────

// GET /api/fleet/stats
router.get('/stats', checkPermission('fleet', 'read'), async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const thirtyDaysOut = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const [totalAssets, activeAssets, inMaintenance, fuelAgg, upcomingMaintenance, overdueAlerts] = await Promise.all([
      FleetAsset.countDocuments({ ...req.tenantFilter, isActive: true }),
      FleetAsset.countDocuments({ ...req.tenantFilter, isActive: true, status: 'active' }),
      FleetAsset.countDocuments({ ...req.tenantFilter, isActive: true, status: 'in_maintenance' }),
      FuelLog.aggregate([
        { $match: { tenantId: req.tenantFilter.tenantId, date: { $gte: startOfMonth } } },
        { $group: { _id: null, total: { $sum: '$totalCost' } } }
      ]),
      MaintenanceRecord.countDocuments({
        ...req.tenantFilter,
        status: 'scheduled',
        nextServiceDate: { $gte: now, $lte: thirtyDaysOut }
      }),
      MaintenanceRecord.countDocuments({
        ...req.tenantFilter,
        nextServiceDate: { $lt: now },
        status: { $nin: ['completed', 'cancelled'] }
      })
    ]);

    res.json({
      totalAssets,
      activeAssets,
      inMaintenance,
      monthlyFuelCost: fuelAgg[0]?.total || 0,
      upcomingMaintenance,
      overdueAlerts
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/fleet/alerts
router.get('/alerts', checkPermission('fleet', 'read'), async (req, res) => {
  try {
    const now = new Date();
    const thirtyDaysOut = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const alerts = await MaintenanceRecord.find({
      ...req.tenantFilter,
      $or: [
        { nextServiceDate: { $lte: thirtyDaysOut }, status: { $nin: ['completed', 'cancelled'] } },
        { status: 'in_progress' }
      ]
    })
      .sort({ nextServiceDate: 1 })
      .populate('asset', 'name assetNumber registrationNumber assetType')
      .populate('project', 'nameEn code');

    res.json({ alerts });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/fleet/maintenance/:id  — must come BEFORE /:id
router.put('/maintenance/:id', checkPermission('fleet', 'update'), async (req, res) => {
  try {
    const record = await MaintenanceRecord.findOne({ _id: req.params.id, ...req.tenantFilter });
    if (!record) return res.status(404).json({ error: 'Maintenance record not found' });

    const updateData = { ...req.body };
    if (updateData.status === 'completed' && !record.completedDate) {
      updateData.completedDate = new Date();
    }
    Object.assign(record, updateData);
    await record.save();
    res.json(record);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/fleet
router.get('/', checkPermission('fleet', 'read'), async (req, res) => {
  try {
    const { page = 1, limit = 25, search, status, assetType, isActive } = req.query;
    const query = { ...req.tenantFilter };

    if (isActive === 'false') query.isActive = false;
    else if (isActive === 'all') { /* no filter */ }
    else query.isActive = true;

    if (status) query.status = status;
    if (assetType) query.assetType = assetType;
    if (search) {
      query.$or = [
        { assetNumber: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } },
        { registrationNumber: { $regex: search, $options: 'i' } },
        { make: { $regex: search, $options: 'i' } }
      ];
    }

    const [assets, total] = await Promise.all([
      FleetAsset.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit))
        .populate('assignedProject', 'nameEn code')
        .populate('assignedTo', 'firstNameEn lastNameEn'),
      FleetAsset.countDocuments(query)
    ]);

    res.json({
      assets,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/fleet/:id
router.get('/:id', checkPermission('fleet', 'read'), async (req, res) => {
  try {
    const asset = await FleetAsset.findOne({ _id: req.params.id, ...req.tenantFilter })
      .populate('assignedProject', 'nameEn code')
      .populate('assignedTo', 'firstNameEn lastNameEn');
    if (!asset) return res.status(404).json({ error: 'Asset not found' });

    const [recentFuelLogs, recentMaintenance] = await Promise.all([
      FuelLog.find({ ...req.tenantFilter, asset: req.params.id }).sort({ date: -1 }).limit(10),
      MaintenanceRecord.find({ ...req.tenantFilter, asset: req.params.id }).sort({ date: -1 }).limit(10)
    ]);

    res.json({ asset, recentFuelLogs, recentMaintenance });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/fleet
router.post('/', checkPermission('fleet', 'create'), async (req, res) => {
  try {
    const assetNumber = req.body.assetNumber || (await generateAssetNumber(req.tenantFilter));
    const asset = await FleetAsset.create({
      ...req.body,
      assetNumber,
      tenantId: req.user.tenantId,
      createdBy: req.user._id
    });
    res.status(201).json(asset);
  } catch (error) {
    if (error?.code === 11000) return res.status(400).json({ error: 'Duplicate asset number' });
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/fleet/:id
router.put('/:id', checkPermission('fleet', 'update'), async (req, res) => {
  try {
    const asset = await FleetAsset.findOneAndUpdate(
      { _id: req.params.id, ...req.tenantFilter },
      req.body,
      { new: true, runValidators: true }
    );
    if (!asset) return res.status(404).json({ error: 'Asset not found' });
    res.json(asset);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/fleet/:id
router.delete('/:id', checkPermission('fleet', 'delete'), async (req, res) => {
  try {
    const asset = await FleetAsset.findOneAndUpdate(
      { _id: req.params.id, ...req.tenantFilter },
      { isActive: false },
      { new: true }
    );
    if (!asset) return res.status(404).json({ error: 'Asset not found' });
    res.json({ message: 'Asset deactivated', asset });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── Fuel Log Routes ───────────────────────────────────────────────────────────

// GET /api/fleet/:id/fuel-logs
router.get('/:id/fuel-logs', checkPermission('fleet', 'read'), async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const [logs, total] = await Promise.all([
      FuelLog.find({ ...req.tenantFilter, asset: req.params.id })
        .sort({ date: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit)),
      FuelLog.countDocuments({ ...req.tenantFilter, asset: req.params.id })
    ]);
    res.json({ logs, pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/fleet/:id/fuel-logs
router.post('/:id/fuel-logs', checkPermission('fleet', 'create'), async (req, res) => {
  try {
    const asset = await FleetAsset.findOne({ _id: req.params.id, ...req.tenantFilter });
    if (!asset) return res.status(404).json({ error: 'Asset not found' });

    const logData = {
      ...req.body,
      asset: req.params.id,
      tenantId: req.user.tenantId,
      createdBy: req.user._id
    };
    const log = await FuelLog.create(logData);

    // Update asset odometer if provided
    if (req.body.odometerReading && req.body.odometerReading > asset.currentMeterReading) {
      asset.currentMeterReading = req.body.odometerReading;
      await asset.save();
    }

    res.status(201).json(log);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── Maintenance Routes ────────────────────────────────────────────────────────

// GET /api/fleet/:id/maintenance
router.get('/:id/maintenance', checkPermission('fleet', 'read'), async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const [records, total] = await Promise.all([
      MaintenanceRecord.find({ ...req.tenantFilter, asset: req.params.id })
        .sort({ date: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit)),
      MaintenanceRecord.countDocuments({ ...req.tenantFilter, asset: req.params.id })
    ]);
    res.json({ records, pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/fleet/:id/maintenance
router.post('/:id/maintenance', checkPermission('fleet', 'create'), async (req, res) => {
  try {
    const asset = await FleetAsset.findOne({ _id: req.params.id, ...req.tenantFilter });
    if (!asset) return res.status(404).json({ error: 'Asset not found' });

    const record = await MaintenanceRecord.create({
      ...req.body,
      asset: req.params.id,
      tenantId: req.user.tenantId,
      createdBy: req.user._id
    });

    // If status is in_progress or scheduled, mark asset as in_maintenance
    if (['scheduled', 'in_progress'].includes(record.status) && asset.status === 'active') {
      asset.status = 'in_maintenance';
      await asset.save();
    }

    res.status(201).json(record);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
