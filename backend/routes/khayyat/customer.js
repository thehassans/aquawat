import express from 'express';
import Customer from '../../models/Customer.js';
import { protect, tenantFilter, checkPermission, requireBusinessType, requireTenantFilter } from '../../middleware/auth.js';

const router = express.Router();

router.use(protect);
router.use(tenantFilter);
router.use(requireTenantFilter);
router.use(requireBusinessType('khayyat'));

// GET /api/khayyat/customers/search
router.get('/search', checkPermission('invoicing', 'read'), async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || String(q).trim().length < 2) {
      return res.json({ customers: [] });
    }

    const cleanQ = String(q).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const customers = await Customer.find({
      ...req.tenantFilter,
      isActive: true,
      $or: [
        { customerCode: { $regex: cleanQ, $options: 'i' } },
        { name: { $regex: cleanQ, $options: 'i' } },
        { nameAr: { $regex: cleanQ, $options: 'i' } },
        { vatNumber: { $regex: cleanQ, $options: 'i' } },
        { phone: { $regex: cleanQ, $options: 'i' } },
        { mobile: { $regex: cleanQ, $options: 'i' } },
        { khayyatReceiptNumbers: { $regex: cleanQ, $options: 'i' } }
      ]
    })
      .select('customerCode name nameAr email phone mobile vatNumber type address khayyatMeasurements khayyatReceiptNumbers khayyatHijriDate')
      .limit(10);

    res.json({ customers });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/khayyat/customers/loyalty
router.get('/loyalty', checkPermission('invoicing', 'read'), async (req, res) => {
  try {
    const { search, page = 1, limit = 20 } = req.query;
    const query = { ...req.tenantFilter, isActive: true };

    if (search) {
      const cleanSearch = String(search).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { name: { $regex: cleanSearch, $options: 'i' } },
        { nameAr: { $regex: cleanSearch, $options: 'i' } },
        { phone: { $regex: cleanSearch, $options: 'i' } },
        { customerCode: { $regex: cleanSearch, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const customers = await Customer.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10))
      .select('customerCode name nameAr phone mobile loyaltyPoints currentBalance totalRevenue totalInvoices');

    const total = await Customer.countDocuments(query);
    const totalSpent = await Customer.aggregate([
      { $match: query },
      { $group: { _id: null, total: { $sum: '$totalRevenue' } } }
    ]);

    res.json({
      customers,
      total,
      page: parseInt(page, 10),
      pages: Math.ceil(total / parseInt(limit, 10)),
      stats: {
        totalCustomers: total,
        totalSpent: totalSpent[0]?.total || 0
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/khayyat/customers
router.get('/', checkPermission('invoicing', 'read'), async (req, res) => {
  try {
    const { page = 1, limit = 200 } = req.query;
    const query = { ...req.tenantFilter, isActive: true };

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const customers = await Customer.find(query)
      .sort({ name: 1 })
      .skip(skip)
      .limit(parseInt(limit, 10))
      .select('customerCode name nameAr phone mobile email address khayyatMeasurements khayyatRelations khayyatReceiptNumbers khayyatHijriDate');

    const total = await Customer.countDocuments(query);

    const mappedCustomers = customers.map(c => {
      const obj = c.toObject();
      obj.measurements = obj.khayyatMeasurements || {};
      obj.relations = obj.khayyatRelations || [];
      return obj;
    });

    res.json({ customers: mappedCustomers, total, page: parseInt(page, 10), pages: Math.ceil(total / parseInt(limit, 10)) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/khayyat/customers/:id
router.get('/:id', checkPermission('invoicing', 'read'), async (req, res) => {
  try {
    const customer = await Customer.findOne({ _id: req.params.id, ...req.tenantFilter })
      .select('customerCode name nameAr email phone mobile vatNumber crNumber address contactPerson khayyatMeasurements khayyatRelations khayyatReceiptNumbers khayyatHijriDate notes currentBalance');

    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const obj = customer.toObject();
    obj.measurements = obj.khayyatMeasurements || {};
    obj.relations = obj.khayyatRelations || [];

    res.json({ customer: obj });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/khayyat/customers
router.post('/', checkPermission('invoicing', 'create'), async (req, res) => {
  try {
    const body = { ...req.body };
    if (body.measurements) body.khayyatMeasurements = body.measurements;
    if (body.relations) body.khayyatRelations = body.relations;

    const customer = new Customer({
      ...body,
      tenantId: req.user.tenantId,
      type: 'individual',
      isActive: true
    });
    await customer.save();

    const obj = customer.toObject();
    obj.measurements = obj.khayyatMeasurements || {};
    obj.relations = obj.khayyatRelations || [];

    res.status(201).json({ customer: obj });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/khayyat/customers/:id
router.put('/:id', checkPermission('invoicing', 'update'), async (req, res) => {
  try {
    const body = { ...req.body };
    if (body.measurements) {
      body.khayyatMeasurements = body.measurements;
      delete body.measurements;
    }
    if (body.relations) {
      body.khayyatRelations = body.relations;
      delete body.relations;
    }

    const customer = await Customer.findOneAndUpdate(
      { _id: req.params.id, ...req.tenantFilter },
      { $set: body },
      { new: true, runValidators: true }
    );

    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const obj = customer.toObject();
    obj.measurements = obj.khayyatMeasurements || {};
    obj.relations = obj.khayyatRelations || [];

    res.json({ customer: obj });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
