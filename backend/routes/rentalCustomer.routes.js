import express from 'express';
import RentalCustomer from '../models/RentalCustomer.js';
import { protect, tenantFilter, requireBusinessType, requireTenantFilter } from '../middleware/auth.js';

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

    const [total, blacklisted, expiringIds, expiringLicenses] = await Promise.all([
      RentalCustomer.countDocuments({ ...req.tenantFilter, isActive: true }),
      RentalCustomer.countDocuments({ ...req.tenantFilter, isActive: true, isBlacklisted: true }),
      RentalCustomer.countDocuments({ ...req.tenantFilter, isActive: true, idExpiry: { $lte: day30 } }),
      RentalCustomer.countDocuments({ ...req.tenantFilter, isActive: true, licenseExpiry: { $lte: day30 } }),
    ]);

    res.json({ total, blacklisted, expiringIds, expiringLicenses });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── Search (for POS quick-lookup) ────────────────────────────────────────────

router.get('/search', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) return res.json([]);

    const customers = await RentalCustomer.find({
      ...req.tenantFilter,
      isActive: true,
      $or: [
        { idNumber: { $regex: q, $options: 'i' } },
        { mobile: { $regex: q, $options: 'i' } },
        { fullName: { $regex: q, $options: 'i' } },
        { licenseNumber: { $regex: q, $options: 'i' } },
      ]
    })
      .limit(10)
      .select('fullName fullNameAr mobile idNumber idType idExpiry licenseNumber licenseExpiry isBlacklisted nationality');

    res.json(customers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── List ──────────────────────────────────────────────────────────────────────

router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 25, search, blacklisted } = req.query;
    const query = { ...req.tenantFilter, isActive: true };

    if (blacklisted === 'true') query.isBlacklisted = true;
    else if (blacklisted === 'false') query.isBlacklisted = false;

    if (search) {
      query.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { mobile: { $regex: search, $options: 'i' } },
        { idNumber: { $regex: search, $options: 'i' } },
        { licenseNumber: { $regex: search, $options: 'i' } },
      ];
    }

    const [customers, total] = await Promise.all([
      RentalCustomer.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit)),
      RentalCustomer.countDocuments(query)
    ]);

    res.json({ customers, pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── Single ────────────────────────────────────────────────────────────────────

router.get('/:id', async (req, res) => {
  try {
    const customer = await RentalCustomer.findOne({ _id: req.params.id, ...req.tenantFilter });
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    res.json(customer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── Create ────────────────────────────────────────────────────────────────────

router.post('/', async (req, res) => {
  try {
    const customer = await RentalCustomer.create({
      ...req.body,
      tenantId: req.user.tenantId,
      createdBy: req.user._id
    });
    res.status(201).json(customer);
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(400).json({ error: 'A customer with this ID number already exists' });
    }
    res.status(500).json({ error: error.message });
  }
});

// ─── Update ────────────────────────────────────────────────────────────────────

router.put('/:id', async (req, res) => {
  try {
    // Blacklist changes should go through dedicated endpoint
    const { isBlacklisted, blacklistReason, blacklistedAt, blacklistedBy, ...rest } = req.body;
    const customer = await RentalCustomer.findOneAndUpdate(
      { _id: req.params.id, ...req.tenantFilter },
      rest,
      { new: true, runValidators: true }
    );
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    res.json(customer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── Toggle Blacklist ──────────────────────────────────────────────────────────

router.put('/:id/toggle-blacklist', async (req, res) => {
  try {
    const customer = await RentalCustomer.findOne({ _id: req.params.id, ...req.tenantFilter });
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    customer.isBlacklisted = !customer.isBlacklisted;
    if (customer.isBlacklisted) {
      customer.blacklistReason = req.body.reason || '';
      customer.blacklistedAt = new Date();
      customer.blacklistedBy = req.user._id;
    } else {
      customer.blacklistReason = undefined;
      customer.blacklistedAt = undefined;
      customer.blacklistedBy = undefined;
    }
    await customer.save();
    res.json(customer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── Delete (soft) ─────────────────────────────────────────────────────────────

router.delete('/:id', async (req, res) => {
  try {
    const customer = await RentalCustomer.findOneAndUpdate(
      { _id: req.params.id, ...req.tenantFilter },
      { isActive: false },
      { new: true }
    );
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    res.json({ message: 'Customer deactivated', customer });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
