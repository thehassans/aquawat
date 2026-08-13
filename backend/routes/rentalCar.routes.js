import express from 'express';
import RentalCar from '../models/RentalCar.js';
import { protect, tenantFilter, checkPermission, requireBusinessType, requireTenantFilter } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);
router.use(tenantFilter);
router.use(requireTenantFilter);
router.use(requireBusinessType('car_rental'));

// ─── Stats ─────────────────────────────────────────────────────────────────────

router.get('/stats', async (req, res) => {
  try {
    const now = new Date();
    const day30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const [statusAgg, expiryAlerts] = await Promise.all([
      RentalCar.aggregate([
        { $match: { ...req.tenantFilter, isActive: true } },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      RentalCar.countDocuments({
        ...req.tenantFilter,
        isActive: true,
        $or: [
          { insuranceExpiry: { $lte: day30 } },
          { fahasExpiry: { $lte: day30 } },
          { licenseExpiry: { $lte: day30 } },
        ]
      })
    ]);

    const statusMap = {};
    statusAgg.forEach(s => { statusMap[s._id] = s.count; });
    const total = Object.values(statusMap).reduce((s, v) => s + v, 0);

    res.json({
      total,
      available: statusMap['AVAILABLE'] || 0,
      rented: statusMap['RENTED'] || 0,
      reserved: statusMap['RESERVED'] || 0,
      maintenance: statusMap['MAINTENANCE'] || 0,
      expiryAlerts,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── List ──────────────────────────────────────────────────────────────────────

router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 25, status, search, category } = req.query;
    const query = { ...req.tenantFilter, isActive: true };

    if (status) query.status = status;
    if (category) query.category = category;
    if (search) {
      query.$or = [
        { plateNumber: { $regex: search, $options: 'i' } },
        { make: { $regex: search, $options: 'i' } },
        { model: { $regex: search, $options: 'i' } },
        { vin: { $regex: search, $options: 'i' } },
        { plateEnglishLetters: { $regex: search, $options: 'i' } },
      ];
    }

    const [cars, total] = await Promise.all([
      RentalCar.find(query)
        .sort({ status: 1, make: 1, model: 1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit)),
      RentalCar.countDocuments(query)
    ]);

    res.json({ cars, pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── Single ────────────────────────────────────────────────────────────────────

router.get('/:id', async (req, res) => {
  try {
    const car = await RentalCar.findOne({ _id: req.params.id, ...req.tenantFilter });
    if (!car) return res.status(404).json({ error: 'Car not found' });
    res.json(car);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── Create ────────────────────────────────────────────────────────────────────

router.post('/', async (req, res) => {
  try {
    const car = await RentalCar.create({
      ...req.body,
      tenantId: req.user.tenantId,
      createdBy: req.user._id
    });
    res.status(201).json(car);
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(400).json({ error: 'A car with this plate number already exists' });
    }
    res.status(500).json({ error: error.message });
  }
});

// ─── Update ────────────────────────────────────────────────────────────────────

router.put('/:id', async (req, res) => {
  try {
    // Prevent manually overriding status to RENTED/RESERVED (use contract endpoints)
    const safeBody = { ...req.body };
    const car = await RentalCar.findOneAndUpdate(
      { _id: req.params.id, ...req.tenantFilter },
      safeBody,
      { new: true, runValidators: true }
    );
    if (!car) return res.status(404).json({ error: 'Car not found' });
    res.json(car);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── Delete (soft) ─────────────────────────────────────────────────────────────

router.delete('/:id', async (req, res) => {
  try {
    const car = await RentalCar.findOne({ _id: req.params.id, ...req.tenantFilter });
    if (!car) return res.status(404).json({ error: 'Car not found' });
    if (car.status === 'RENTED') {
      return res.status(400).json({ error: 'Cannot deactivate a car that is currently rented' });
    }
    car.isActive = false;
    await car.save();
    res.json({ message: 'Car deactivated', car });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
