import express from 'express';
import LaundryCustomer from '../models/LaundryCustomer.js';
import { protect, tenantFilter, checkPermission, requireBusinessType, requireTenantFilter } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);
router.use(tenantFilter);
router.use(requireTenantFilter);
router.use(requireBusinessType('laundry'));

// GET /api/laundry/customers/search (Quick lookup for POS)
router.get('/search', checkPermission('laundry', 'read'), async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 3) return res.json([]);
    
    const customers = await LaundryCustomer.find({
      tenantId: req.tenant._id,
      isActive: true,
      $or: [
        { mobile: { $regex: q, $options: 'i' } },
        { fullName: { $regex: q, $options: 'i' } }
      ]
    }).limit(10);
    
    res.json(customers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/laundry/customers
router.get('/', checkPermission('laundry', 'read'), async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const skip = (page - 1) * limit;

    const customers = await LaundryCustomer.find({ tenantId: req.tenant._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await LaundryCustomer.countDocuments({ tenantId: req.tenant._id });

    res.json({ customers, total, page, pages: Math.ceil(total / limit) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/laundry/customers
router.post('/', checkPermission('laundry', 'create'), async (req, res) => {
  try {
    const customer = new LaundryCustomer({
      ...req.body,
      tenantId: req.tenant._id,
      createdBy: req.user._id
    });
    await customer.save();
    res.status(201).json(customer);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// PUT /api/laundry/customers/:id
router.put('/:id', checkPermission('laundry', 'update'), async (req, res) => {
  try {
    const customer = await LaundryCustomer.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenant._id },
      req.body,
      { new: true, runValidators: true }
    );
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    res.json(customer);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
