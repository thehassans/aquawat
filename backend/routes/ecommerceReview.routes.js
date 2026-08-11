import express from 'express';
import mongoose from 'mongoose';
import sharp from 'sharp';
import { protect } from '../middleware/auth.js';
import Tenant from '../models/Tenant.js';
import EcommerceProduct from '../models/EcommerceProduct.js';
import EcommerceReview from '../models/EcommerceReview.js';
import { resolveTenantByHost } from '../middleware/resolveTenantByHost.js';
import { createImageUpload } from '../utils/uploadMime.js';
import { saveUploadBuffer } from '../utils/objectStorage.js';

const router = express.Router();
const upload = createImageUpload({ fileSize: 5 * 1024 * 1024 });

const getTargetTenantId = async (user) => {
  if (user.tenantId) return user.tenantId;
  if (user.role === 'super_admin') {
    const tenant = await Tenant.findOne({ businessTypes: 'ecommerce' });
    return tenant ? tenant._id : null;
  }
  return null;
};

// ==================== PUBLIC (storefront) ====================

// Public: list approved reviews for a product
router.get('/product/:productId', resolveTenantByHost, async (req, res) => {
  try {
    const tenantId = req.storeTenant._id;
    const reviews = await EcommerceReview.find({
      tenantId, productId: req.params.productId, status: 'approved',
    }).sort({ createdAt: -1 }).limit(50).lean();

    const stats = await EcommerceReview.aggregate([
      { $match: { tenantId: tenantId, productId: mongoose.Types.ObjectId(req.params.productId), status: 'approved' } },
      { $group: { _id: null, avgRating: { $avg: '$rating' }, count: { $sum: 1 } } },
    ]);

    res.json({ reviews, avgRating: stats[0]?.avgRating || 0, totalReviews: stats[0]?.count || 0 });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Public: upload review image
router.post('/product/:productId/upload-image', resolveTenantByHost, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image uploaded' });
    const tenantId = req.storeTenant._id;
    const tenantIdStr = tenantId.toString();
    const filename = `review-${Date.now()}-${Math.round(Math.random() * 1E9)}.webp`;
    const key = `ecommerce/${tenantIdStr}/reviews/${filename}`;

    const buffer = await sharp(req.file.buffer)
      .resize({ width: 800, height: 800, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();

    const { url: imageUrl } = await saveUploadBuffer({
      buffer,
      key,
      contentType: 'image/webp',
      publicUrlPath: `/uploads/${key}`,
    });
    res.json({ imageUrl });
  } catch (error) {
    res.status(500).json({ error: 'Failed to upload image' });
  }
});

// Public: vote a review as helpful
router.post('/:id/helpful', resolveTenantByHost, async (req, res) => {
  try {
    const tenantId = req.storeTenant._id;
    const voterId = req.body.voterId || req.ip || 'anonymous';
    const review = await EcommerceReview.findOne({ _id: req.params.id, tenantId, status: 'approved' });
    if (!review) return res.status(404).json({ error: 'Review not found' });

    if (review.helpfulVoterIds.includes(voterId)) {
      return res.json({ helpfulVotes: review.helpfulVotes, alreadyVoted: true });
    }

    review.helpfulVotes += 1;
    review.helpfulVoterIds.push(voterId);
    await review.save();
    res.json({ helpfulVotes: review.helpfulVotes, alreadyVoted: false });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Public: submit a review
router.post('/product/:productId', resolveTenantByHost, async (req, res) => {
  try {
    const tenantId = req.storeTenant._id;
    const { customerName, customerEmail, rating, title, body, orderId, images } = req.body;

    if (!customerName || !rating) return res.status(400).json({ error: 'Name and rating are required' });
    if (rating < 1 || rating > 5) return res.status(400).json({ error: 'Rating must be 1-5' });

    // Verify product exists
    const product = await EcommerceProduct.findOne({ _id: req.params.productId, tenantId, status: 'active' });
    if (!product) return res.status(404).json({ error: 'Product not found' });

    // Check for duplicate
    if (customerEmail) {
      const existing = await EcommerceReview.findOne({ tenantId, productId: req.params.productId, customerEmail });
      if (existing) return res.status(409).json({ error: 'You have already reviewed this product' });
    }

    // Check if verified purchase
    let verifiedPurchase = false;
    if (orderId) {
      const EcommerceOrder = (await import('../models/EcommerceOrder.js')).default;
      const order = await EcommerceOrder.findOne({ _id: orderId, tenantId });
      if (order && order.lineItems.some(i => i.productId.toString() === req.params.productId)) {
        verifiedPurchase = true;
      }
    }

    const review = new EcommerceReview({
      tenantId,
      productId: req.params.productId,
      orderId: orderId || null,
      customerName,
      customerEmail: customerEmail || '',
      rating,
      title: title || '',
      body: body || '',
      images: (images || []).slice(0, 5).map(url => ({ url })),
      verifiedPurchase,
      status: 'pending', // Reviews start as pending for moderation
    });

    await review.save();
    res.status(201).json({ message: 'Review submitted successfully', review });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ==================== ADMIN (protected) ====================

// Admin: list all reviews with filters
router.get('/', protect, async (req, res) => {
  try {
    const tenantId = await getTargetTenantId(req.user);
    if (!tenantId) return res.status(400).json({ error: 'No tenant found.' });

    const { status, productId, page = 1, limit = 20 } = req.query;
    const filter = { tenantId };
    if (status) filter.status = status;
    if (productId) filter.productId = productId;

    const skip = (Number(page) - 1) * Number(limit);
    const [reviews, total] = await Promise.all([
      EcommerceReview.find(filter)
        .populate('productId', 'title images')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      EcommerceReview.countDocuments(filter),
    ]);

    res.json({ reviews, total, page: Number(page), totalPages: Math.ceil(total / Number(limit)) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin: approve a review
router.put('/:id/approve', protect, async (req, res) => {
  try {
    const tenantId = await getTargetTenantId(req.user);
    if (!tenantId) return res.status(400).json({ error: 'No tenant found.' });

    const review = await EcommerceReview.findOneAndUpdate(
      { _id: req.params.id, tenantId },
      { status: 'approved' },
      { new: true }
    );
    if (!review) return res.status(404).json({ error: 'Review not found' });
    res.json(review);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Admin: reject a review
router.put('/:id/reject', protect, async (req, res) => {
  try {
    const tenantId = await getTargetTenantId(req.user);
    if (!tenantId) return res.status(400).json({ error: 'No tenant found.' });

    const review = await EcommerceReview.findOneAndUpdate(
      { _id: req.params.id, tenantId },
      { status: 'rejected' },
      { new: true }
    );
    if (!review) return res.status(404).json({ error: 'Review not found' });
    res.json(review);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Admin: delete a review
router.delete('/:id', protect, async (req, res) => {
  try {
    const tenantId = await getTargetTenantId(req.user);
    if (!tenantId) return res.status(400).json({ error: 'No tenant found.' });

    const review = await EcommerceReview.findOneAndDelete({ _id: req.params.id, tenantId });
    if (!review) return res.status(404).json({ error: 'Review not found' });
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
