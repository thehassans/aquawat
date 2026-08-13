import express from 'express';
import LaundryOrder from '../models/LaundryOrder.js';
import LaundryCustomer from '../models/LaundryCustomer.js';
import { protect, tenantFilter, checkPermission, requireBusinessType, requireTenantFilter } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);
router.use(tenantFilter);
router.use(requireTenantFilter);
router.use(requireBusinessType('laundry'));

// GET /api/laundry/orders/kanban (Active orders)
router.get('/kanban', checkPermission('laundry', 'read'), async (req, res) => {
  try {
    const orders = await LaundryOrder.find({
      tenantId: req.tenant._id,
      status: { $nin: ['delivered', 'cancelled'] }
    })
    .populate('customer', 'fullName mobile')
    .sort({ createdAt: 1 });
    
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/laundry/orders (All with pagination)
router.get('/', checkPermission('laundry', 'read'), async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const skip = (page - 1) * limit;

    const orders = await LaundryOrder.find({ tenantId: req.tenant._id })
      .populate('customer', 'fullName mobile')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await LaundryOrder.countDocuments({ tenantId: req.tenant._id });

    res.json({ orders, total, page, pages: Math.ceil(total / limit) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/laundry/orders/checkout (Create order)
router.post('/checkout', checkPermission('laundry', 'create'), async (req, res) => {
  try {
    const orderData = {
      ...req.body,
      tenantId: req.tenant._id,
      createdBy: req.user._id,
      status: 'received'
    };

    // Generate garment tags (1 tag per item quantity if piece-based, else 1 tag per service)
    let tagCounter = 1;
    const garmentTags = [];
    if (orderData.items) {
      orderData.items.forEach(item => {
        const numTags = item.billingType === 'per_piece' ? Math.ceil(item.quantity) : 1;
        for (let i = 0; i < numTags; i++) {
          garmentTags.push(`TAG-${Date.now().toString().slice(-6)}-${tagCounter++}`);
        }
      });
    }
    orderData.garmentTags = garmentTags;

    const order = new LaundryOrder(orderData);
    await order.save();

    // Update customer stats
    if (order.customer) {
      await LaundryCustomer.findByIdAndUpdate(order.customer, {
        $inc: { totalOrders: 1, totalSpent: order.grandTotal, outstandingBalance: (order.grandTotal - order.amountPaid) }
      });
    }

    res.status(201).json(order);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// PUT /api/laundry/orders/:id/status
router.put('/:id/status', checkPermission('laundry', 'update'), async (req, res) => {
  try {
    const { status } = req.body;
    const order = await LaundryOrder.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenant._id },
      { status },
      { new: true }
    );
    if (!order) return res.status(404).json({ error: 'Order not found' });
    
    // Here you would trigger SMS/WhatsApp if status === 'ready'
    
    res.json(order);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// GET /api/laundry/orders/:id
router.get('/:id', checkPermission('laundry', 'read'), async (req, res) => {
  try {
    const order = await LaundryOrder.findOne({ _id: req.params.id, tenantId: req.tenant._id })
      .populate('customer')
      .populate('items.service');
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/laundry/orders/:id/payment
router.patch('/:id/payment', checkPermission('laundry', 'update'), async (req, res) => {
  try {
    const { paymentMethod, posPaymentId, status } = req.body;
    const order = await LaundryOrder.findOne({ _id: req.params.id, ...req.tenantFilter });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (paymentMethod) order.paymentMethod = paymentMethod;
    if (posPaymentId) order.posPaymentId = posPaymentId;
    if (status) order.status = status;
    await order.save();
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
