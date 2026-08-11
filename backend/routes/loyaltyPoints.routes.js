import express from 'express';
import { resolveTenantId, handleTenantScopeError } from '../utils/tenantScope.js';
import { protect } from '../middleware/auth.js';
import LoyaltyPoints from '../models/LoyaltyPoints.js';
import EcommerceOrder from '../models/EcommerceOrder.js';

const router = express.Router();

const getTargetTenantId = (user, req) => resolveTenantId(user, req);

// GET /api/ecommerce/loyalty — list all loyalty accounts
router.get('/', protect, async (req, res) => {
  try {
    const tenantId = getTargetTenantId(req.user, req);
    if (!tenantId) return res.status(400).json({ error: 'No tenant found' });

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const search = req.query.search || '';

    const filter = { tenantId };
    if (search) {
      filter.$or = [
        { customerEmail: { $regex: search, $options: 'i' } },
        { customerName: { $regex: search, $options: 'i' } },
        { customerPhone: { $regex: search, $options: 'i' } },
      ];
    }

    const [accounts, total] = await Promise.all([
      LoyaltyPoints.find(filter).sort({ lifetimePoints: -1 }).skip(skip).limit(limit).lean(),
      LoyaltyPoints.countDocuments(filter),
    ]);

    res.json({ accounts, total, page, totalPages: Math.ceil(total / limit) });
  } catch (error) {
    if (handleTenantScopeError(res, error)) return;
    res.status(500).json({ error: error.message });
  }
});

// GET /api/ecommerce/loyalty/stats — summary stats
router.get('/stats', protect, async (req, res) => {
  try {
    const tenantId = getTargetTenantId(req.user, req);
    if (!tenantId) return res.status(400).json({ error: 'No tenant found' });

    const [totalAccounts, totalPointsInCirculation, totalLifetimePoints, tierCounts] = await Promise.all([
      LoyaltyPoints.countDocuments({ tenantId }),
      LoyaltyPoints.aggregate([
        { $match: { tenantId: new (require('mongoose').Types.ObjectId)(tenantId) } },
        { $group: { _id: null, total: { $sum: '$points' } } },
      ]),
      LoyaltyPoints.aggregate([
        { $match: { tenantId: new (require('mongoose').Types.ObjectId)(tenantId) } },
        { $group: { _id: null, total: { $sum: '$lifetimePoints' } } },
      ]),
      LoyaltyPoints.aggregate([
        { $match: { tenantId: new (require('mongoose').Types.ObjectId)(tenantId) } },
        { $group: { _id: '$tier', count: { $sum: 1 } } },
      ]),
    ]);

    const tierMap = {};
    tierCounts.forEach(t => { tierMap[t._id] = t.count; });

    res.json({
      totalAccounts,
      totalPointsInCirculation: totalPointsInCirculation[0]?.total || 0,
      totalLifetimePoints: totalLifetimePoints[0]?.total || 0,
      tiers: tierMap,
    });
  } catch (error) {
    if (handleTenantScopeError(res, error)) return;
    res.status(500).json({ error: error.message });
  }
});

// GET /api/ecommerce/loyalty/:email — get a customer's loyalty account
router.get('/:email', protect, async (req, res) => {
  try {
    const tenantId = getTargetTenantId(req.user, req);
    if (!tenantId) return res.status(400).json({ error: 'No tenant found' });

    const account = await LoyaltyPoints.findOne({
      tenantId,
      customerEmail: req.params.email.toLowerCase(),
    }).lean();

    if (!account) return res.status(404).json({ error: 'No loyalty account found' });
    res.json(account);
  } catch (error) {
    if (handleTenantScopeError(res, error)) return;
    res.status(500).json({ error: error.message });
  }
});

// POST /api/ecommerce/loyalty/earn — award points to a customer
router.post('/earn', protect, async (req, res) => {
  try {
    const tenantId = getTargetTenantId(req.user, req);
    if (!tenantId) return res.status(400).json({ error: 'No tenant found' });

    const { customerEmail, customerName, customerPhone, points, reason, orderId } = req.body;
    if (!customerEmail || !points || points <= 0) {
      return res.status(400).json({ error: 'customerEmail and positive points are required' });
    }

    let account = await LoyaltyPoints.findOne({ tenantId, customerEmail: customerEmail.toLowerCase() });
    if (!account) {
      account = new LoyaltyPoints({ tenantId, customerEmail: customerEmail.toLowerCase(), customerName, customerPhone });
    }
    account.addPoints(Math.floor(points), reason || 'Manual adjustment', orderId);
    await account.save();

    res.json(account);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// POST /api/ecommerce/loyalty/redeem — redeem points from a customer
router.post('/redeem', protect, async (req, res) => {
  try {
    const tenantId = getTargetTenantId(req.user, req);
    if (!tenantId) return res.status(400).json({ error: 'No tenant found' });

    const { customerEmail, points, reason, orderId } = req.body;
    if (!customerEmail || !points || points <= 0) {
      return res.status(400).json({ error: 'customerEmail and positive points are required' });
    }

    const account = await LoyaltyPoints.findOne({ tenantId, customerEmail: customerEmail.toLowerCase() });
    if (!account) return res.status(404).json({ error: 'No loyalty account found' });

    account.redeemPoints(Math.floor(points), reason || 'Redemption', orderId);
    await account.save();

    res.json(account);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// POST /api/ecommerce/loyalty/award-from-order — auto-award points based on order total
router.post('/award-from-order', protect, async (req, res) => {
  try {
    const tenantId = getTargetTenantId(req.user, req);
    if (!tenantId) return res.status(400).json({ error: 'No tenant found' });

    const { orderId, pointsPerCurrency = 1 } = req.body;
    if (!orderId) return res.status(400).json({ error: 'orderId is required' });

    const order = await EcommerceOrder.findOne({ _id: orderId, tenantId });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (!order.customer?.email) return res.status(400).json({ error: 'Order has no customer email' });

    const pointsToAward = Math.floor(order.grandTotal * pointsPerCurrency);
    if (pointsToAward <= 0) return res.json({ skipped: true, reason: 'no points to award' });

    let account = await LoyaltyPoints.findOne({ tenantId, customerEmail: order.customer.email.toLowerCase() });
    if (!account) {
      account = new LoyaltyPoints({
        tenantId,
        customerEmail: order.customer.email.toLowerCase(),
        customerName: order.customer.name,
        customerPhone: order.customer.phone,
      });
    }
    account.addPoints(pointsToAward, `Order ${order.orderNumber}`, order._id);
    await account.save();

    res.json({ awarded: pointsToAward, account });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// PUT /api/ecommerce/loyalty/adjust — manual points adjustment
router.put('/adjust', protect, async (req, res) => {
  try {
    const tenantId = getTargetTenantId(req.user, req);
    if (!tenantId) return res.status(400).json({ error: 'No tenant found' });

    const { customerEmail, points, reason } = req.body;
    if (!customerEmail || points === undefined) {
      return res.status(400).json({ error: 'customerEmail and points are required' });
    }

    const account = await LoyaltyPoints.findOne({ tenantId, customerEmail: customerEmail.toLowerCase() });
    if (!account) return res.status(404).json({ error: 'No loyalty account found' });

    const pts = parseInt(points);
    if (pts > 0) {
      account.addPoints(pts, reason || 'Manual adjustment');
    } else if (pts < 0) {
      account.points = Math.max(0, account.points + pts);
      account.transactions.push({ type: 'adjust', points: pts, reason: reason || 'Manual adjustment' });
    }
    await account.save();

    res.json(account);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
