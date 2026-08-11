import express from 'express';
import { resolveTenantId, handleTenantScopeError } from '../utils/tenantScope.js';
import mongoose from 'mongoose';
import { protect } from '../middleware/auth.js';
import { resolveTenantByHost } from '../middleware/resolveTenantByHost.js';
import EcommerceReturn from '../models/EcommerceReturn.js';
import EcommerceOrder from '../models/EcommerceOrder.js';
import Tenant from '../models/Tenant.js';

const router = express.Router();

const getTargetTenantId = (user, req) => resolveTenantId(user, req);

// --- STOREFRONT: Customer submits a return request ---
router.post('/request', resolveTenantByHost, async (req, res) => {
  try {
    const tenantId = req.storeTenant._id;
    const { orderId, items, reason, reasonDetails, images } = req.body;

    if (!orderId || !items || items.length === 0) {
      return res.status(400).json({ error: 'Order ID and items are required' });
    }

    const order = await EcommerceOrder.findOne({ tenantId, _id: orderId });
    if (!order) return res.status(404).json({ error: 'Order not found' });

    // Only allow returns for delivered/completed orders
    if (!['delivered', 'completed'].includes(order.status)) {
      return res.status(400).json({ error: 'Returns can only be requested for delivered orders' });
    }

    // Check for existing pending return
    const existing = await EcommerceReturn.findOne({
      tenantId, orderId, status: { $in: ['requested', 'approved', 'received'] },
    });
    if (existing) {
      return res.status(400).json({ error: 'A return request is already in progress for this order' });
    }

    const refundAmount = items.reduce((sum, i) => sum + (i.price * i.quantity), 0);

    const returnReq = await EcommerceReturn.create({
      tenantId,
      orderId,
      orderNumber: order.orderNumber,
      customerName: order.customer?.name || '',
      customerEmail: order.customer?.email || '',
      customerPhone: order.customer?.phone || '',
      items,
      reason: reason || 'other',
      reasonDetails: reasonDetails || '',
      refundAmount,
      images: images || [],
    });

    res.json({ success: true, returnNumber: returnReq.returnNumber, returnId: returnReq._id });
  } catch (error) {
    if (handleTenantScopeError(res, error)) return;
    res.status(500).json({ error: error.message });
  }
});

// --- STOREFRONT: Check return status ---
router.get('/status/:orderId', resolveTenantByHost, async (req, res) => {
  try {
    const tenantId = req.storeTenant._id;
    const ret = await EcommerceReturn.findOne({ tenantId, orderId: req.params.orderId }).sort({ createdAt: -1 }).lean();
    if (!ret) return res.json({ return: null });
    res.json({ return: ret });
  } catch (error) {
    if (handleTenantScopeError(res, error)) return;
    res.status(500).json({ error: error.message });
  }
});

// --- ADMIN: List all returns ---
router.get('/', protect, async (req, res) => {
  try {
    const tenantId = getTargetTenantId(req.user, req);
    if (!tenantId) return res.status(400).json({ error: 'No tenant found' });
    const { status, page = 1, limit = 20 } = req.query;
    const filter = { tenantId };
    if (status) filter.status = status;

    const skip = (Number(page) - 1) * Number(limit);
    const [returns, total] = await Promise.all([
      EcommerceReturn.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).lean(),
      EcommerceReturn.countDocuments(filter),
    ]);

    res.json({ returns, total, page: Number(page), totalPages: Math.ceil(total / Number(limit)) });
  } catch (error) {
    if (handleTenantScopeError(res, error)) return;
    res.status(500).json({ error: error.message });
  }
});

// --- ADMIN: Get single return ---
router.get('/:id', protect, async (req, res) => {
  try {
    const tenantId = getTargetTenantId(req.user, req);
    if (!tenantId) return res.status(400).json({ error: 'No tenant found' });
    const ret = await EcommerceReturn.findOne({ tenantId, _id: req.params.id }).lean();
    if (!ret) return res.status(404).json({ error: 'Return not found' });
    res.json(ret);
  } catch (error) {
    if (handleTenantScopeError(res, error)) return;
    res.status(500).json({ error: error.message });
  }
});

// --- ADMIN: Update return status (approve, reject, mark received, refund) ---
router.patch('/:id', protect, async (req, res) => {
  try {
    const tenantId = getTargetTenantId(req.user, req);
    if (!tenantId) return res.status(400).json({ error: 'No tenant found' });
    const { status, adminNotes, refundMethod, returnTrackingNumber, returnCourier } = req.body;

    const ret = await EcommerceReturn.findOne({ tenantId, _id: req.params.id });
    if (!ret) return res.status(404).json({ error: 'Return not found' });

    const validTransitions = {
      requested: ['approved', 'rejected'],
      approved: ['received', 'rejected'],
      received: ['refunded'],
      refunded: ['completed'],
    };

    if (status && status !== ret.status) {
      const allowed = validTransitions[ret.status] || [];
      if (!allowed.includes(status)) {
        return res.status(400).json({ error: `Cannot transition from ${ret.status} to ${status}` });
      }
      ret.status = status;
      ret.reviewedBy = req.user._id;
      ret.reviewedAt = new Date();
      if (status === 'received') ret.receivedAt = new Date();
      if (status === 'refunded') ret.refundedAt = new Date();
      if (status === 'completed') ret.completedAt = new Date();
    }

    if (adminNotes !== undefined) ret.adminNotes = adminNotes;
    if (refundMethod) ret.refundMethod = refundMethod;
    if (returnTrackingNumber !== undefined) ret.returnTrackingNumber = returnTrackingNumber;
    if (returnCourier !== undefined) ret.returnCourier = returnCourier;

    await ret.save();

    // If refunded or completed, update the order status to 'returned'
    if (status === 'completed') {
      await EcommerceOrder.findByIdAndUpdate(ret.orderId, { status: 'returned' });
    }

    res.json(ret);
  } catch (error) {
    if (handleTenantScopeError(res, error)) return;
    res.status(500).json({ error: error.message });
  }
});

// --- ADMIN: Return stats ---
router.get('/stats/summary', protect, async (req, res) => {
  try {
    const tenantId = getTargetTenantId(req.user, req);
    if (!tenantId) return res.status(400).json({ error: 'No tenant found' });
    const [requested, approved, received, refunded, completed, rejected] = await Promise.all([
      EcommerceReturn.countDocuments({ tenantId, status: 'requested' }),
      EcommerceReturn.countDocuments({ tenantId, status: 'approved' }),
      EcommerceReturn.countDocuments({ tenantId, status: 'received' }),
      EcommerceReturn.countDocuments({ tenantId, status: 'refunded' }),
      EcommerceReturn.countDocuments({ tenantId, status: 'completed' }),
      EcommerceReturn.countDocuments({ tenantId, status: 'rejected' }),
    ]);
    const refundTotal = await EcommerceReturn.aggregate([
      { $match: { tenantId: new mongoose.Types.ObjectId(tenantId), status: { $in: ['refunded', 'completed'] } } },
      { $group: { _id: null, total: { $sum: '$refundAmount' } } },
    ]);
    res.json({
      requested, approved, received, refunded, completed, rejected,
      totalRefunded: refundTotal[0]?.total || 0,
    });
  } catch (error) {
    if (handleTenantScopeError(res, error)) return;
    res.status(500).json({ error: error.message });
  }
});

export default router;
