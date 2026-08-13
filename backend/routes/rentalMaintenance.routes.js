import express from 'express';
import mongoose from 'mongoose';
import RentalMaintenance from '../models/RentalMaintenance.js';
import RentalCar from '../models/RentalCar.js';
import RentalContract from '../models/RentalContract.js';
import { protect, tenantFilter, requireTenantFilter } from '../middleware/auth.js';

const router = express.Router();
router.use(protect);
router.use(tenantFilter);
router.use(requireTenantFilter);

function getTenantFilter(req) {
  return { tenantId: new mongoose.Types.ObjectId(req.user.tenantId) };
}

// @route   GET /api/rental/maintenance/dashboard
router.get('/dashboard', async (req, res) => {
  try {
    const tenantFilter = getTenantFilter(req);
    const cars = await RentalCar.find({ ...tenantFilter, isActive: true })
      .select('make model year plateNumber plateEnglishLetters status currentOdometer nextOilChangeKm insuranceExpiry fahasExpiry istimaraExpiry category dailyRateDefault')
      .lean();

    const now = new Date();
    const dayMs = 24 * 60 * 60 * 1000;
    const in30Days = new Date(now.getTime() + 30 * dayMs);

    // Compliance alerts
    const alerts = [];
    for (const car of cars) {
      const display = `${car.make} ${car.model} ${car.year} - ${car.plateNumber} ${car.plateEnglishLetters || ''}`;
      if (car.insuranceExpiry && new Date(car.insuranceExpiry) <= in30Days) {
        alerts.push({ carId: car._id, carDisplay: display, type: 'insurance', expiryDate: car.insuranceExpiry, daysLeft: Math.ceil((new Date(car.insuranceExpiry) - now) / dayMs) });
      }
      if (car.fahasExpiry && new Date(car.fahasExpiry) <= in30Days) {
        alerts.push({ carId: car._id, carDisplay: display, type: 'fahas', expiryDate: car.fahasExpiry, daysLeft: Math.ceil((new Date(car.fahasExpiry) - now) / dayMs) });
      }
      if (car.istimaraExpiry && new Date(car.istimaraExpiry) <= in30Days) {
        alerts.push({ carId: car._id, carDisplay: display, type: 'istimara', expiryDate: car.istimaraExpiry, daysLeft: Math.ceil((new Date(car.istimaraExpiry) - now) / dayMs) });
      }
      if (car.nextOilChangeKm > 0 && car.currentOdometer >= car.nextOilChangeKm - 500) {
        alerts.push({ carId: car._id, carDisplay: display, type: 'oil_change', kmLeft: car.nextOilChangeKm - car.currentOdometer, nextKm: car.nextOilChangeKm });
      }
    }

    alerts.sort((a, b) => {
      const aVal = a.daysLeft ?? a.kmLeft ?? 999;
      const bVal = b.daysLeft ?? b.kmLeft ?? 999;
      return aVal - bVal;
    });

    // Fleet utilization
    const statusCounts = { AVAILABLE: 0, RENTED: 0, RESERVED: 0, MAINTENANCE: 0, PENDING_INSPECTION: 0 };
    cars.forEach(c => { statusCounts[c.status] = (statusCounts[c.status] || 0) + 1; });

    // Active rentals
    const activeRentals = await RentalContract.find({
      ...tenantFilter,
      status: 'active',
    }).select('carId carDisplay customerName startDate endDate').populate('carId', 'make model plateNumber').lean();

    // Maintenance records
    const upcomingMaintenance = await RentalMaintenance.find({
      ...tenantFilter,
      status: { $in: ['scheduled', 'in_progress'] },
    }).sort({ scheduledDate: 1 }).limit(20).lean();

    // Maintenance cost summary (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const costSummary = await RentalMaintenance.aggregate([
      { $match: { ...tenantFilter, status: 'completed', completedDate: { $gte: sixMonthsAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$completedDate' } },
          totalCost: { $sum: '$cost' },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const costByCar = await RentalMaintenance.aggregate([
      { $match: { ...tenantFilter, status: 'completed', completedDate: { $gte: sixMonthsAgo } } },
      {
        $group: {
          _id: { carId: '$carId', carDisplay: '$carDisplay' },
          totalCost: { $sum: '$cost' },
          count: { $sum: 1 },
        },
      },
      { $sort: { totalCost: -1 } },
      { $limit: 10 },
    ]);

    res.json({
      summary: {
        totalCars: cars.length,
        available: statusCounts.AVAILABLE,
        rented: statusCounts.RENTED,
        reserved: statusCounts.RESERVED,
        maintenance: statusCounts.MAINTENANCE,
        utilizationRate: cars.length > 0 ? Math.round((statusCounts.RENTED / cars.length) * 10000) / 100 : 0,
        activeAlerts: alerts.length,
      },
      alerts,
      statusCounts,
      activeRentals,
      upcomingMaintenance,
      costSummary,
      costByCar,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   GET /api/rental/maintenance
router.get('/', async (req, res) => {
  try {
    const { carId, status, page = 1, limit = 25 } = req.query;
    const query = { ...getTenantFilter(req) };
    if (carId) query.carId = new mongoose.Types.ObjectId(carId);
    if (status) query.status = status;

    const [records, total] = await Promise.all([
      RentalMaintenance.find(query).sort({ scheduledDate: -1, createdAt: -1 }).skip((page - 1) * limit).limit(parseInt(limit)),
      RentalMaintenance.countDocuments(query),
    ]);

    res.json({ records, pagination: { page: parseInt(page), limit: parseInt(limit), total } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   POST /api/rental/maintenance
router.post('/', async (req, res) => {
  try {
    const car = await RentalCar.findOne({ _id: req.body.carId, ...getTenantFilter(req) });
    if (!car) return res.status(404).json({ error: 'Car not found' });

    const carDisplay = `${car.make} ${car.model} ${car.year} - ${car.plateNumber} ${car.plateEnglishLetters || ''}`;

    const record = await RentalMaintenance.create({
      ...req.body,
      carDisplay,
      tenantId: req.user.tenantId,
      createdBy: req.user._id,
    });

    // If scheduled, set car to maintenance
    if (record.status === 'scheduled' || record.status === 'in_progress') {
      await RentalCar.findByIdAndUpdate(car._id, { status: 'MAINTENANCE' });
    }

    res.status(201).json(record);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   PUT /api/rental/maintenance/:id
router.put('/:id', async (req, res) => {
  try {
    const record = await RentalMaintenance.findOneAndUpdate(
      { _id: req.params.id, ...getTenantFilter(req) },
      req.body,
      { new: true, runValidators: true }
    );
    if (!record) return res.status(404).json({ error: 'Maintenance record not found' });

    // If completed, update car odometer and set available
    if (req.body.status === 'completed' && req.body.odometerAtService) {
      await RentalCar.findByIdAndUpdate(record.carId, {
        currentOdometer: req.body.odometerAtService,
        status: 'AVAILABLE',
        ...(req.body.nextServiceOdometer ? { nextOilChangeKm: req.body.nextServiceOdometer } : {}),
      });
    }

    res.json(record);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   DELETE /api/rental/maintenance/:id
router.delete('/:id', async (req, res) => {
  try {
    const record = await RentalMaintenance.findOneAndDelete({ _id: req.params.id, ...getTenantFilter(req) });
    if (!record) return res.status(404).json({ error: 'Maintenance record not found' });
    res.json({ message: 'Maintenance record deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
