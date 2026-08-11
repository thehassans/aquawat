import express from 'express';
import { resolveTenantId, handleTenantScopeError } from '../utils/tenantScope.js';
import mongoose from 'mongoose';
import { protect } from '../middleware/auth.js';
import { resolveTenantByHost } from '../middleware/resolveTenantByHost.js';
import Tenant from '../models/Tenant.js';
import EcommerceCoupon from '../models/EcommerceCoupon.js';
import EcommerceOrder from '../models/EcommerceOrder.js';

const router = express.Router();

const getTargetTenantId = (user, req) => resolveTenantId(user, req);

// ==================== PUBLIC: Validate & apply coupon ====================

// Public: validate a coupon code
router.post('/validate', resolveTenantByHost, async (req, res) => {
  try {
    const tenantId = req.storeTenant._id;
    const { code, subtotal } = req.body;

    if (!code) return res.status(400).json({ error: 'Coupon code is required' });

    const coupon = await EcommerceCoupon.findOne({
      tenantId, code: code.toUpperCase().trim(), isActive: true,
    });

    if (!coupon) return res.status(404).json({ error: 'Invalid coupon code' });

    const now = new Date();
    if (coupon.startsAt && now < coupon.startsAt) return res.status(400).json({ error: 'Coupon not yet active' });
    if (coupon.endsAt && now > coupon.endsAt) return res.status(400).json({ error: 'Coupon has expired' });
    if (coupon.usageLimit > 0 && coupon.usedCount >= coupon.usageLimit) return res.status(400).json({ error: 'Coupon usage limit reached' });
    if (coupon.minSubtotal > 0 && subtotal < coupon.minSubtotal) {
      return res.status(400).json({ error: `Minimum order amount is ${coupon.minSubtotal}` });
    }

    let discountAmount = 0;
    let freeShipping = false;

    switch (coupon.type) {
      case 'percentage':
        discountAmount = (subtotal * coupon.value) / 100;
        if (coupon.maxDiscount > 0) discountAmount = Math.min(discountAmount, coupon.maxDiscount);
        break;
      case 'fixed':
        discountAmount = Math.min(coupon.value, subtotal);
        break;
      case 'free_shipping':
        freeShipping = true;
        break;
    }

    res.json({
      valid: true,
      couponId: coupon._id,
      code: coupon.code,
      type: coupon.type,
      value: coupon.value,
      discountAmount: Math.round(discountAmount * 100) / 100,
      freeShipping,
      description: coupon.description,
    });
  } catch (error) {
    if (handleTenantScopeError(res, error)) return;
    res.status(500).json({ error: error.message });
  }
});

// ==================== ADMIN CRUD ====================

router.get('/', protect, async (req, res) => {
  try {
    const tenantId = getTargetTenantId(req.user, req);
    if (!tenantId) return res.status(400).json({ error: 'No tenant found.' });

    const { page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const [coupons, total] = await Promise.all([
      EcommerceCoupon.find({ tenantId }).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).lean(),
      EcommerceCoupon.countDocuments({ tenantId }),
    ]);
    res.json({ coupons, total, page: Number(page), totalPages: Math.ceil(total / Number(limit)) });
  } catch (error) {
    if (handleTenantScopeError(res, error)) return;
    res.status(500).json({ error: error.message });
  }
});

router.post('/', protect, async (req, res) => {
  try {
    const tenantId = getTargetTenantId(req.user, req);
    if (!tenantId) return res.status(400).json({ error: 'No tenant found.' });

    const { code, description, type, value, minSubtotal, maxDiscount, usageLimit, perCustomerLimit, startsAt, endsAt, appliesTo, productIds, categories } = req.body;

    if (!code || !type || value === undefined) return res.status(400).json({ error: 'Code, type, and value are required' });

    const existing = await EcommerceCoupon.findOne({ tenantId, code: code.toUpperCase().trim() });
    if (existing) return res.status(409).json({ error: 'Coupon code already exists' });

    const coupon = new EcommerceCoupon({
      tenantId,
      code: code.toUpperCase().trim(),
      description: description || '',
      type,
      value,
      minSubtotal: minSubtotal || 0,
      maxDiscount: maxDiscount || 0,
      usageLimit: usageLimit || 0,
      perCustomerLimit: perCustomerLimit || 0,
      startsAt: startsAt || Date.now(),
      endsAt: endsAt || null,
      appliesTo: appliesTo || 'all',
      productIds: productIds || [],
      categories: categories || [],
    });

    await coupon.save();
    res.status(201).json(coupon);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.put('/:id', protect, async (req, res) => {
  try {
    const tenantId = getTargetTenantId(req.user, req);
    if (!tenantId) return res.status(400).json({ error: 'No tenant found.' });

    const updates = {};
    const allowed = ['description', 'type', 'value', 'minSubtotal', 'maxDiscount', 'usageLimit', 'perCustomerLimit', 'startsAt', 'endsAt', 'isActive', 'appliesTo', 'productIds', 'categories'];
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    const coupon = await EcommerceCoupon.findOneAndUpdate(
      { _id: req.params.id, tenantId },
      { $set: updates },
      { new: true }
    );
    if (!coupon) return res.status(404).json({ error: 'Coupon not found' });
    res.json(coupon);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.delete('/:id', protect, async (req, res) => {
  try {
    const tenantId = getTargetTenantId(req.user, req);
    if (!tenantId) return res.status(400).json({ error: 'No tenant found.' });

    const coupon = await EcommerceCoupon.findOneAndDelete({ _id: req.params.id, tenantId });
    if (!coupon) return res.status(404).json({ error: 'Coupon not found' });
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// --- COUPON ANALYTICS ---
router.get('/analytics', protect, async (req, res) => {
  try {
    const tenantId = getTargetTenantId(req.user, req);
    if (!tenantId) return res.status(400).json({ error: 'No tenant found.' });

    const coupons = await EcommerceCoupon.find({ tenantId }).lean();
    const couponIds = coupons.map(c => c._id);

    const orderStats = await EcommerceOrder.aggregate([
      { $match: { tenantId: new mongoose.Types.ObjectId(tenantId), 'coupon.code': { $exists: true, $ne: null } } },
      { $group: {
        _id: '$coupon.code',
        orderCount: { $sum: 1 },
        totalRevenue: { $sum: '$grandTotal' },
        totalDiscount: { $sum: { $ifNull: ['$discount', 0] } },
      }},
    ]);

    const analyticsMap = {};
    orderStats.forEach(s => { analyticsMap[s._id] = s; });

    const result = coupons.map(c => ({
      _id: c._id,
      code: c.code,
      usedCount: c.usedCount,
      usageLimit: c.usageLimit,
      isActive: c.isActive,
      ...analyticsMap[c.code] ? {
        orderCount: analyticsMap[c.code].orderCount,
        totalRevenue: analyticsMap[c.code].totalRevenue,
        totalDiscount: analyticsMap[c.code].totalDiscount,
      } : { orderCount: 0, totalRevenue: 0, totalDiscount: 0 },
    }));

    res.json({ analytics: result });
  } catch (error) {
    if (handleTenantScopeError(res, error)) return;
    res.status(500).json({ error: error.message });
  }
});

export default router;
