import express from 'express';
import mongoose from 'mongoose';
import Promotion from '../models/Promotion.js';
import BakalaProduct from '../models/BakalaProduct.js';
import { protect, tenantFilter, requireTenantFilter } from '../middleware/auth.js';

const router = express.Router();
router.use(protect);
router.use(tenantFilter);
router.use(requireTenantFilter);

function getTenantFilter(req) {
  return { tenantId: new mongoose.Types.ObjectId(req.user.tenantId) };
}

// @route   GET /api/bakala/promotions
router.get('/', async (req, res) => {
  try {
    const { status, type, page = 1, limit = 25 } = req.query;
    const query = { ...getTenantFilter(req) };
    if (type) query.type = type;

    const now = new Date();
    if (status === 'active') {
      query.isActive = true;
      query.startDate = { $lte: now };
      query.endDate = { $gte: now };
    } else if (status === 'scheduled') {
      query.startDate = { $gt: now };
    } else if (status === 'expired') {
      query.endDate = { $lt: now };
    }

    const [promos, total] = await Promise.all([
      Promotion.find(query).sort({ priority: -1, startDate: -1 }).skip((page - 1) * limit).limit(parseInt(limit)),
      Promotion.countDocuments(query),
    ]);

    res.json({
      promotions: promos.map(p => ({ ...p.toObject(), currentlyActive: p.isCurrentlyActive() })),
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   GET /api/bakala/promotions/active
router.get('/active', async (req, res) => {
  try {
    const promos = await Promotion.find({
      ...getTenantFilter(req),
      isActive: true,
      startDate: { $lte: new Date() },
      endDate: { $gte: new Date() },
    }).sort({ priority: -1 });

    const active = promos.filter(p => p.isCurrentlyActive());
    res.json(active);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   GET /api/bakala/promotions/:id
router.get('/:id', async (req, res) => {
  try {
    const promo = await Promotion.findOne({ _id: req.params.id, ...getTenantFilter(req) });
    if (!promo) return res.status(404).json({ error: 'Promotion not found' });
    res.json(promo);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   POST /api/bakala/promotions
router.post('/', async (req, res) => {
  try {
    const promo = await Promotion.create({
      ...req.body,
      tenantId: req.user.tenantId,
      createdBy: req.user._id,
    });
    res.status(201).json(promo);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   PUT /api/bakala/promotions/:id
router.put('/:id', async (req, res) => {
  try {
    const promo = await Promotion.findOneAndUpdate(
      { _id: req.params.id, ...getTenantFilter(req) },
      req.body,
      { new: true, runValidators: true }
    );
    if (!promo) return res.status(404).json({ error: 'Promotion not found' });
    res.json(promo);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   DELETE /api/bakala/promotions/:id
router.delete('/:id', async (req, res) => {
  try {
    const promo = await Promotion.findOneAndDelete({ _id: req.params.id, ...getTenantFilter(req) });
    if (!promo) return res.status(404).json({ error: 'Promotion not found' });
    res.json({ message: 'Promotion deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   POST /api/bakala/promotions/evaluate
// Evaluate cart items against active promotions and return discounts
router.post('/evaluate', async (req, res) => {
  try {
    const { items = [] } = req.body;
    if (!items.length) return res.json({ discounts: [], totalDiscount: 0 });

    const promos = await Promotion.find({
      ...getTenantFilter(req),
      isActive: true,
      startDate: { $lte: new Date() },
      endDate: { $gte: new Date() },
    }).sort({ priority: -1 });

    const active = promos.filter(p => p.isCurrentlyActive());
    const discounts = [];
    let totalDiscount = 0;

    for (const promo of active) {
      if (promo.type === 'bogo') {
        // Find items matching applicable category or product IDs
        let matching = items;
        if (promo.rules.applicableCategory) {
          matching = items.filter(i => i.category === promo.rules.applicableCategory);
        } else if (promo.rules.applicableProductIds?.length) {
          const ids = promo.rules.applicableProductIds.map(id => id.toString());
          matching = items.filter(i => ids.includes(i.productId?.toString() || i._id?.toString()));
        }
        const totalQty = matching.reduce((s, i) => s + (i.quantity || 1), 0);
        const sets = Math.floor(totalQty / (promo.rules.buyQty + promo.rules.getQtyFree));
        if (sets > 0) {
          const freeQty = sets * promo.rules.getQtyFree;
          const cheapestPrice = Math.min(...matching.map(i => i.unitPrice || i.retailPrice || 0));
          const discount = freeQty * cheapestPrice;
          discounts.push({ promotionId: promo._id, name: promo.name, type: 'bogo', discount: Math.round(discount * 100) / 100, freeQty });
          totalDiscount += discount;
        }
      } else if (promo.type === 'flash_sale' || promo.type === 'product_discount') {
        let matching = items;
        if (promo.rules.applicableProductIds?.length) {
          const ids = promo.rules.applicableProductIds.map(id => id.toString());
          matching = items.filter(i => ids.includes(i.productId?.toString() || i._id?.toString()));
        }
        if (matching.length) {
          const discount = matching.reduce((s, i) => {
            const price = i.unitPrice || i.retailPrice || 0;
            return s + (price * (i.quantity || 1) * promo.rules.discountPercent / 100);
          }, 0);
          if (discount > 0) {
            discounts.push({ promotionId: promo._id, name: promo.name, type: promo.type, discount: Math.round(discount * 100) / 100 });
            totalDiscount += discount;
          }
        }
      } else if (promo.type === 'category_discount') {
        const matching = items.filter(i => i.category === promo.rules.applicableCategory);
        if (matching.length) {
          const discount = matching.reduce((s, i) => {
            const price = i.unitPrice || i.retailPrice || 0;
            return s + (price * (i.quantity || 1) * promo.rules.discountPercent / 100);
          }, 0);
          if (discount > 0) {
            discounts.push({ promotionId: promo._id, name: promo.name, type: 'category_discount', discount: Math.round(discount * 100) / 100 });
            totalDiscount += discount;
          }
        }
      } else if (promo.type === 'happy_hour') {
        const discount = items.reduce((s, i) => {
          const price = i.unitPrice || i.retailPrice || 0;
          return s + (price * (i.quantity || 1) * promo.rules.discountPercent / 100);
        }, 0);
        if (discount > 0) {
          discounts.push({ promotionId: promo._id, name: promo.name, type: 'happy_hour', discount: Math.round(discount * 100) / 100 });
          totalDiscount += discount;
        }
      } else if (promo.type === 'bundle' && promo.rules.applicableProductIds?.length >= 2) {
        const ids = promo.rules.applicableProductIds.map(id => id.toString());
        const bundleItems = items.filter(i => ids.includes(i.productId?.toString() || i._id?.toString()));
        if (bundleItems.length >= 2) {
          const normalTotal = bundleItems.reduce((s, i) => s + (i.unitPrice || i.retailPrice || 0) * (i.quantity || 1), 0);
          const discount = normalTotal - promo.rules.bundlePrice;
          if (discount > 0) {
            discounts.push({ promotionId: promo._id, name: promo.name, type: 'bundle', discount: Math.round(discount * 100) / 100 });
            totalDiscount += discount;
          }
        }
      }
    }

    res.json({
      discounts,
      totalDiscount: Math.round(totalDiscount * 100) / 100,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
