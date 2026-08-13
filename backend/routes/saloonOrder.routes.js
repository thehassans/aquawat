import express from 'express';
import SaloonOrder from '../models/SaloonOrder.js';
import { protect, tenantFilter, checkPermission, requireBusinessType, requireTenantFilter } from '../middleware/auth.js';
import mongoose from 'mongoose';

const router = express.Router();

router.use(protect);
router.use(tenantFilter);
router.use(requireTenantFilter);
router.use(requireBusinessType('saloon'));

// @route   GET /api/saloon/orders/kanban
router.get('/kanban', checkPermission('saloon', 'read'), async (req, res) => {
  try {
    const orders = await SaloonOrder.find({
      tenantId: req.user.tenantId,
      status: { $in: ['waiting', 'in_progress'] }
    }).sort({ createdAt: 1 });
    
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   GET /api/saloon/orders
router.get('/', checkPermission('saloon', 'read'), async (req, res) => {
  try {
    const { page = 1, limit = 20, status, search } = req.query;
    const query = { tenantId: req.user.tenantId };
    
    if (status && status !== 'all') query.status = status;
    
    if (search) {
      query.$or = [
        { orderNumber: { $regex: search, $options: 'i' } },
        { customerName: { $regex: search, $options: 'i' } },
        { customerPhone: { $regex: search, $options: 'i' } }
      ];
    }
    
    const orders = await SaloonOrder.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));
      
    const total = await SaloonOrder.countDocuments(query);
    
    res.json({
      orders,
      totalPages: Math.ceil(total / limit),
      currentPage: Number(page)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   POST /api/saloon/orders/checkout
router.post('/checkout', checkPermission('saloon', 'create'), async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { items, customerName, customerPhone, paymentMethod, amountPaid, notes } = req.body;
    
    let subtotal = 0;
    let totalVat = 0;
    let grandTotal = 0;
    
    const orderItems = items.map(item => {
      const itemSubtotal = item.unitPrice * item.quantity;
      const itemTaxAmount = itemSubtotal * (item.taxRate / 100);
      const itemTotal = itemSubtotal + itemTaxAmount;
      
      subtotal += itemSubtotal;
      totalVat += itemTaxAmount;
      grandTotal += itemTotal;
      
      return {
        service: item.serviceId,
        nameEn: item.nameEn,
        nameAr: item.nameAr,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        taxRate: item.taxRate,
        subtotal: itemSubtotal,
        taxAmount: itemTaxAmount,
        total: itemTotal,
        staff: item.staff || ''
      };
    });
    
    // Generate Queue Number (Daily sequence)
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const todayOrdersCount = await SaloonOrder.countDocuments({
      tenantId: req.user.tenantId,
      createdAt: { $gte: startOfDay, $lte: endOfDay }
    }).session(session);

    const queueNumber = String(todayOrdersCount + 1).padStart(3, '0');
    
    let paymentStatus = 'unpaid';
    if (amountPaid >= grandTotal) paymentStatus = 'paid';
    else if (amountPaid > 0) paymentStatus = 'partial';
    
    // Default status: if paid directly, maybe complete, but let's say it always starts as waiting unless specified.
    // If it's a quick walk-in and already done, it can be marked completed in the UI. For now, default to 'waiting'
    const status = paymentStatus === 'paid' ? 'completed' : 'waiting';

    const order = new SaloonOrder({
      tenantId: req.user.tenantId,
      orderNumber: `SLN-${Date.now()}`,
      queueNumber,
      customerName,
      customerPhone,
      items: orderItems,
      subtotal,
      totalVat,
      grandTotal,
      amountPaid: amountPaid || 0,
      paymentMethod: paymentMethod || 'none',
      paymentStatus,
      status,
      notes,
      createdBy: req.user._id
    });
    
    await order.save({ session });
    
    // Log removed
    
    await session.commitTransaction();
    res.status(201).json(order);
  } catch (error) {
    await session.abortTransaction();
    res.status(400).json({ error: error.message });
  } finally {
    session.endSession();
  }
});

// @route   PUT /api/saloon/orders/:id/status
router.put('/:id/status', checkPermission('saloon', 'update'), async (req, res) => {
  try {
    const { status } = req.body;
    
    const order = await SaloonOrder.findOne({ _id: req.params.id, tenantId: req.user.tenantId });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    
    order.status = status;
    await order.save();
    
    // Log removed
    
    res.json(order);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// @route   GET /api/saloon/orders/:id
router.get('/:id', checkPermission('saloon', 'read'), async (req, res) => {
  try {
    const order = await SaloonOrder.findOne({ _id: req.params.id, tenantId: req.user.tenantId });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/saloon/orders/:id/payment
router.patch('/:id/payment', checkPermission('saloon', 'update'), async (req, res) => {
  try {
    const { paymentMethod, posPaymentId, status } = req.body;
    const order = await SaloonOrder.findOne({ _id: req.params.id, tenantId: req.user.tenantId });
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
