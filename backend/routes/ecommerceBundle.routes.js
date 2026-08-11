import express from 'express';
import { resolveTenantId, handleTenantScopeError } from '../utils/tenantScope.js';
import mongoose from 'mongoose';
import { protect } from '../middleware/auth.js';
import { resolveTenantByHost } from '../middleware/resolveTenantByHost.js';
import Tenant from '../models/Tenant.js';
import EcommerceBundle from '../models/EcommerceBundle.js';
import EcommerceProduct from '../models/EcommerceProduct.js';
import EcommerceOrder from '../models/EcommerceOrder.js';

const router = express.Router();

const getTargetTenantId = (user, req) => resolveTenantId(user, req);

// ==================== PUBLIC: Get active bundles ====================
router.get('/active', resolveTenantByHost, async (req, res) => {
  try {
    const tenantId = req.storeTenant._id;
    const now = new Date();
    const bundles = await EcommerceBundle.find({
      tenantId, isActive: true,
      $or: [
        { startsAt: null },
        { startsAt: { $lte: now } },
      ],
      $and: [
        { $or: [{ endsAt: null }, { endsAt: { $gte: now } }] },
      ],
    }).lean();

    // Populate product details
    const productIds = [...new Set(bundles.flatMap(b => b.items.map(i => i.productId)))];
    const products = await EcommerceProduct.find({ _id: { $in: productIds } })
      .select('title basePrice images seo.slug')
      .lean();
    const productMap = {};
    products.forEach(p => { productMap[p._id] = p; });

    const enriched = bundles.map(b => ({
      ...b,
      items: b.items.map(item => ({
        ...item,
        product: productMap[item.productId] || null,
      })),
    }));

    res.json({ bundles: enriched });
  } catch (error) {
    if (handleTenantScopeError(res, error)) return;
    res.status(500).json({ error: error.message });
  }
});

// ==================== PUBLIC: Get bundle by slug ====================
router.get('/slug/:slug', resolveTenantByHost, async (req, res) => {
  try {
    const tenantId = req.storeTenant._id;
    const bundle = await EcommerceBundle.findOne({ tenantId, slug: req.params.slug, isActive: true }).lean();
    if (!bundle) return res.status(404).json({ error: 'Bundle not found' });

    EcommerceBundle.updateOne({ _id: bundle._id }, { $inc: { viewsCount: 1 } }).exec();

    const productIds = bundle.items.map(i => i.productId);
    const products = await EcommerceProduct.find({ _id: { $in: productIds } })
      .select('title basePrice images seo.slug')
      .lean();
    const productMap = {};
    products.forEach(p => { productMap[p._id] = p; });

    bundle.items = bundle.items.map(item => ({
      ...item,
      product: productMap[item.productId] || null,
    }));

    res.json(bundle);
  } catch (error) {
    if (handleTenantScopeError(res, error)) return;
    res.status(500).json({ error: error.message });
  }
});

// ==================== PUBLIC: "Frequently bought together" ====================
// Returns products frequently ordered together with the given product
router.get('/frequently-bought/:productId', resolveTenantByHost, async (req, res) => {
  try {
    const tenantId = req.storeTenant._id;
    const productId = new mongoose.Types.ObjectId(req.params.productId);

    // Find orders containing this product
    const orders = await EcommerceOrder.find({
      tenantId,
      'lineItems.productId': productId,
    }).select('lineItems.productId').limit(200).lean();

    // Count co-occurring products
    const coOccurrence = {};
    orders.forEach(order => {
      order.lineItems.forEach(item => {
        const id = item.productId?.toString();
        if (id && id !== req.params.productId) {
          coOccurrence[id] = (coOccurrence[id] || 0) + 1;
        }
      });
    });

    const sortedIds = Object.entries(coOccurrence)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([id]) => id);

    if (sortedIds.length === 0) {
      // Fallback: return products from same category
      const currentProduct = await EcommerceProduct.findById(productId).select('category').lean();
      if (currentProduct) {
        const related = await EcommerceProduct.find({
          tenantId, status: 'active', category: currentProduct.category, _id: { $ne: productId },
        }).select('title basePrice images seo.slug').limit(4).lean();
        return res.json({ products: related, source: 'category' });
      }
      return res.json({ products: [], source: 'none' });
    }

    const products = await EcommerceProduct.find({
      _id: { $in: sortedIds.map(id => new mongoose.Types.ObjectId(id)) },
      status: 'active',
    }).select('title basePrice images seo.slug').lean();

    // Sort by co-occurrence count
    const productMap = {};
    products.forEach(p => { productMap[p._id.toString()] = p; });
    const sorted = sortedIds.map(id => productMap[id]).filter(Boolean);

    res.json({ products: sorted, source: 'orders' });
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
    const [bundles, total] = await Promise.all([
      EcommerceBundle.find({ tenantId }).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).lean(),
      EcommerceBundle.countDocuments({ tenantId }),
    ]);
    res.json({ bundles, total, page: Number(page), totalPages: Math.ceil(total / Number(limit)) });
  } catch (error) {
    if (handleTenantScopeError(res, error)) return;
    res.status(500).json({ error: error.message });
  }
});

router.post('/', protect, async (req, res) => {
  try {
    const tenantId = getTargetTenantId(req.user, req);
    if (!tenantId) return res.status(400).json({ error: 'No tenant found.' });

    const { title, description, slug, items, bundlePrice, compareAtPrice, image, badgeText, isActive, startsAt, endsAt } = req.body;

    if (!title || !items?.length || bundlePrice === undefined) {
      return res.status(400).json({ error: 'Title, items, and bundle price are required' });
    }

    const bundle = new EcommerceBundle({
      tenantId,
      title,
      description: description || '',
      slug: slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
      items: items.map(i => ({ productId: i.productId, quantity: i.quantity || 1 })),
      bundlePrice,
      compareAtPrice: compareAtPrice || 0,
      image: image || '',
      badgeText: badgeText || '',
      isActive: isActive !== false,
      startsAt: startsAt || null,
      endsAt: endsAt || null,
      createdBy: req.user._id,
    });

    await bundle.save();
    res.status(201).json(bundle);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.put('/:id', protect, async (req, res) => {
  try {
    const tenantId = getTargetTenantId(req.user, req);
    if (!tenantId) return res.status(400).json({ error: 'No tenant found.' });

    const updates = {};
    const allowed = ['title', 'description', 'slug', 'items', 'bundlePrice', 'compareAtPrice', 'image', 'badgeText', 'isActive', 'startsAt', 'endsAt'];
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    if (updates.items) {
      updates.items = updates.items.map(i => ({ productId: i.productId, quantity: i.quantity || 1 }));
    }

    const bundle = await EcommerceBundle.findOneAndUpdate(
      { _id: req.params.id, tenantId },
      { $set: updates },
      { new: true }
    );
    if (!bundle) return res.status(404).json({ error: 'Bundle not found' });
    res.json(bundle);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.delete('/:id', protect, async (req, res) => {
  try {
    const tenantId = getTargetTenantId(req.user, req);
    if (!tenantId) return res.status(400).json({ error: 'No tenant found.' });

    const bundle = await EcommerceBundle.findOneAndDelete({ _id: req.params.id, tenantId });
    if (!bundle) return res.status(404).json({ error: 'Bundle not found' });
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
