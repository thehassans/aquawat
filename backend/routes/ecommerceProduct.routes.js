import express from 'express';
import { resolveTenantId, handleTenantScopeError } from '../utils/tenantScope.js';
import sharp from 'sharp';
import { protect } from '../middleware/auth.js';
import Tenant from '../models/Tenant.js';
import EcommerceProduct from '../models/EcommerceProduct.js';
import { imageUpload } from '../utils/uploadMime.js';
import { saveUploadBuffer } from '../utils/objectStorage.js';

const router = express.Router();
const upload = imageUpload;

const getTargetTenantId = (user, req) => resolveTenantId(user, req);

// --- LIST PRODUCTS ---
router.get('/', protect, async (req, res) => {
  try {
    const tenantId = getTargetTenantId(req.user, req);
    if (!tenantId) return res.status(400).json({ error: 'No tenant found.' });

    const { search, status, category, sort, page = 1, limit = 20 } = req.query;
    const filter = { tenantId };

    if (status) filter.status = status;
    if (category) filter.category = category;
    if (search) {
      filter.$text = { $search: search };
    }

    const sortOptions = {
      newest: { createdAt: -1 },
      oldest: { createdAt: 1 },
      'title-az': { title: 1 },
      'title-za': { title: -1 },
      'price-low': { basePrice: 1 },
      'price-high': { basePrice: -1 },
      'best-selling': { salesCount: -1 },
    };
    const sortBy = sortOptions[sort] || sortOptions.newest;

    const skip = (Number(page) - 1) * Number(limit);
    const [products, total] = await Promise.all([
      EcommerceProduct.find(filter).sort(sortBy).skip(skip).limit(Number(limit)).lean(),
      EcommerceProduct.countDocuments(filter),
    ]);

    res.json({
      products,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / Number(limit)),
    });
  } catch (error) {
    if (handleTenantScopeError(res, error)) return;
    res.status(500).json({ error: error.message });
  }
});

// --- GET SINGLE PRODUCT ---
router.get('/:id', protect, async (req, res) => {
  try {
    const tenantId = getTargetTenantId(req.user, req);
    if (!tenantId) return res.status(400).json({ error: 'No tenant found.' });
    const product = await EcommerceProduct.findOne({ _id: req.params.id, tenantId }).lean();
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  } catch (error) {
    if (handleTenantScopeError(res, error)) return;
    res.status(500).json({ error: error.message });
  }
});

// --- CREATE PRODUCT ---
router.post('/', protect, async (req, res) => {
  try {
    const tenantId = getTargetTenantId(req.user, req);
    if (!tenantId) return res.status(400).json({ error: 'No tenant found.' });

    const body = req.body;
    if (!body.title || !body.title.trim()) {
      return res.status(400).json({ error: 'Product title is required' });
    }

    const product = new EcommerceProduct({
      tenantId,
      title: body.title.trim(),
      titleAr: body.titleAr || '',
      description: body.description || '',
      descriptionAr: body.descriptionAr || '',
      productType: body.productType || 'physical',
      status: body.status || 'draft',
      category: body.category || '',
      tags: body.tags || [],
      vendor: body.vendor || '',
      brand: body.brand || '',
      basePrice: body.basePrice || 0,
      compareAtPrice: body.compareAtPrice || 0,
      costPrice: body.costPrice || 0,
      taxRate: body.taxRate ?? 15,
      taxIncluded: body.taxIncluded ?? true,
      currency: body.currency || 'SAR',
      hasVariants: body.hasVariants || false,
      option1Name: body.option1Name || '',
      option2Name: body.option2Name || '',
      option3Name: body.option3Name || '',
      variants: body.variants || [],
      stockQuantity: body.stockQuantity || 0,
      trackInventory: body.trackInventory ?? true,
      continueSellingWhenOOS: body.continueSellingWhenOOS || false,
      sku: body.sku || '',
      barcode: body.barcode || '',
      weight: body.weight || 0,
      weightUnit: body.weightUnit || 'g',
      requiresShipping: body.requiresShipping ?? true,
      images: body.images || [],
      seo: body.seo || {},
      specifications: body.specifications || {},
      shortDescription: body.shortDescription || '',
      createdBy: req.user._id,
    });

    await product.save();
    res.status(201).json(product);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// --- UPDATE PRODUCT ---
router.put('/:id', protect, async (req, res) => {
  try {
    const tenantId = getTargetTenantId(req.user, req);
    if (!tenantId) return res.status(400).json({ error: 'No tenant found.' });

    const body = req.body;
    const allowed = [
      'title', 'titleAr', 'description', 'descriptionAr', 'productType', 'status',
      'category', 'tags', 'vendor', 'brand', 'basePrice', 'compareAtPrice', 'costPrice',
      'taxRate', 'taxIncluded', 'currency', 'hasVariants', 'option1Name', 'option2Name',
      'option3Name', 'variants', 'stockQuantity', 'trackInventory', 'continueSellingWhenOOS',
      'sku', 'barcode', 'weight', 'weightUnit', 'requiresShipping', 'images', 'seo',
      'specifications', 'shortDescription',
    ];

    const update = { updatedBy: req.user._id };
    for (const key of allowed) {
      if (body[key] !== undefined) update[key] = body[key];
    }

    // Fetch current product to detect stock changes
    const oldProduct = await EcommerceProduct.findOne({ _id: req.params.id, tenantId }).lean();

    const product = await EcommerceProduct.findOneAndUpdate(
      { _id: req.params.id, tenantId },
      { $set: update },
      { new: true, runValidators: true }
    );
    if (!product) return res.status(404).json({ error: 'Product not found' });

    // Back-in-stock notification logic
    if (oldProduct && update.stockQuantity !== undefined) {
      const wasOOS = oldProduct.trackInventory && oldProduct.stockQuantity <= 0;
      const nowInStock = product.trackInventory && product.stockQuantity > 0;
      if (wasOOS && nowInStock && oldProduct.stockNotifications?.length > 0) {
        const unnotified = oldProduct.stockNotifications.filter(n => !n.notified);
        if (unnotified.length > 0) {
          try {
            const tenant = await Tenant.findById(tenantId).lean();
            const { sendTenantEmail } = await import('../utils/tenantEmailService.js');
            const storeName = tenant?.ecommerce?.storeName || tenant?.name || 'Store';
            const productUrl = `${tenant?.ecommerce?.domain || ''}/store/products/${product.seo?.slug || product._id}`;
            for (const notif of unnotified) {
              sendTenantEmail({
                tenant,
                to: notif.email,
                subject: `Back in Stock — ${product.title}`,
                html: `
                  <h2>Good news! ${product.title} is back in stock!</h2>
                  <p>The item you were interested in is now available again at ${storeName}.</p>
                  <p><a href="${productUrl}" style="display:inline-block;padding:12px 28px;background:#4f46e5;color:#fff;border-radius:8px;text-decoration:none;font-weight:bold;margin-top:12px;">Shop Now</a></p>
                `,
                text: `${product.title} is back in stock at ${storeName}. Visit ${productUrl} to shop now.`,
              }).catch(() => {});
            }
            // Mark all as notified
            await EcommerceProduct.updateOne(
              { _id: product._id },
              { $set: { 'stockNotifications.$[].notified': true } }
            );
          } catch {}
        }
      }

      // Also check variant stock changes
      if (oldProduct.hasVariants && update.variants) {
        const oldVariants = new Map(oldProduct.variants.map(v => [String(v._id), v]));
        for (const newVariant of update.variants) {
          const oldVariant = oldVariants.get(String(newVariant._id));
          if (oldVariant && oldVariant.trackInventory && oldVariant.stockQuantity <= 0
              && newVariant.trackInventory && newVariant.stockQuantity > 0
              && oldProduct.stockNotifications?.length > 0) {
            const unnotified = oldProduct.stockNotifications.filter(n => !n.notified && String(n.variantId) === String(newVariant._id));
            if (unnotified.length > 0) {
              try {
                const tenant = await Tenant.findById(tenantId).lean();
                const { sendTenantEmail } = await import('../utils/tenantEmailService.js');
                const storeName = tenant?.ecommerce?.storeName || tenant?.name || 'Store';
                const productUrl = `${tenant?.ecommerce?.domain || ''}/store/products/${product.seo?.slug || product._id}`;
                for (const notif of unnotified) {
                  sendTenantEmail({
                    tenant,
                    to: notif.email,
                    subject: `Back in Stock — ${product.title}`,
                    html: `<h2>Good news! ${product.title} is back in stock!</h2><p>The item you were interested in is now available again at ${storeName}.</p><p><a href="${productUrl}" style="display:inline-block;padding:12px 28px;background:#4f46e5;color:#fff;border-radius:8px;text-decoration:none;font-weight:bold;">Shop Now</a></p>`,
                    text: `${product.title} is back in stock at ${storeName}. Visit ${productUrl} to shop now.`,
                  }).catch(() => {});
                }
              } catch {}
            }
          }
        }
        // Mark variant-specific notifications as notified
        await EcommerceProduct.updateOne(
          { _id: product._id },
          { $set: { 'stockNotifications.$[].notified': true } }
        );
      }
    }

    res.json(product);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// --- DELETE PRODUCT ---
router.delete('/:id', protect, async (req, res) => {
  try {
    const tenantId = getTargetTenantId(req.user, req);
    if (!tenantId) return res.status(400).json({ error: 'No tenant found.' });
    const result = await EcommerceProduct.deleteOne({ _id: req.params.id, tenantId });
    if (result.deletedCount === 0) return res.status(404).json({ error: 'Product not found' });
    res.json({ success: true });
  } catch (error) {
    if (handleTenantScopeError(res, error)) return;
    res.status(500).json({ error: error.message });
  }
});

// --- TOGGLE STATUS (quick activate/archive) ---
router.patch('/:id/status', protect, async (req, res) => {
  try {
    const tenantId = getTargetTenantId(req.user, req);
    if (!tenantId) return res.status(400).json({ error: 'No tenant found.' });
    const { status } = req.body;
    if (!['draft', 'active', 'archived'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    const product = await EcommerceProduct.findOneAndUpdate(
      { _id: req.params.id, tenantId },
      { $set: { status, updatedBy: req.user._id } },
      { new: true }
    );
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// --- GET CATEGORIES (distinct) ---
router.get('/meta/categories', protect, async (req, res) => {
  try {
    const tenantId = getTargetTenantId(req.user, req);
    if (!tenantId) return res.status(400).json({ error: 'No tenant found.' });
    const categories = await EcommerceProduct.distinct('category', { tenantId, category: { $ne: '' } });
    res.json(categories.sort());
  } catch (error) {
    if (handleTenantScopeError(res, error)) return;
    res.status(500).json({ error: error.message });
  }
});

// --- LIST UNANSWERED QUESTIONS (admin) ---
router.get('/questions/pending', protect, async (req, res) => {
  try {
    const tenantId = getTargetTenantId(req.user, req);
    if (!tenantId) return res.status(400).json({ error: 'No tenant found.' });
    const products = await EcommerceProduct.find({ tenantId, 'questions.answer': '' })
      .select('title questions')
      .lean();
    const pending = [];
    products.forEach(p => {
      p.questions.forEach(q => {
        if (!q.answer) pending.push({ productId: p._id, productTitle: p.title, ...q });
      });
    });
    res.json({ questions: pending });
  } catch (error) {
    if (handleTenantScopeError(res, error)) return;
    res.status(500).json({ error: error.message });
  }
});

// --- ANSWER QUESTION (admin) ---
router.put('/:productId/questions/:questionId/answer', protect, async (req, res) => {
  try {
    const tenantId = getTargetTenantId(req.user, req);
    if (!tenantId) return res.status(400).json({ error: 'No tenant found.' });
    const { answer } = req.body;
    if (!answer || !answer.trim()) return res.status(400).json({ error: 'Answer is required' });

    const product = await EcommerceProduct.findOne({ _id: req.params.productId, tenantId });
    if (!product) return res.status(404).json({ error: 'Product not found' });

    const q = product.questions.id(req.params.questionId);
    if (!q) return res.status(404).json({ error: 'Question not found' });

    q.answer = answer.trim();
    q.answeredBy = req.user._id;
    q.answeredAt = new Date();
    q.isPublic = true;
    await product.save();
    res.json({ success: true });
  } catch (error) {
    if (handleTenantScopeError(res, error)) return;
    res.status(500).json({ error: error.message });
  }
});

// --- DELETE QUESTION (admin) ---
router.delete('/:productId/questions/:questionId', protect, async (req, res) => {
  try {
    const tenantId = getTargetTenantId(req.user, req);
    if (!tenantId) return res.status(400).json({ error: 'No tenant found.' });

    const product = await EcommerceProduct.findOne({ _id: req.params.productId, tenantId });
    if (!product) return res.status(404).json({ error: 'Product not found' });

    product.questions.id(req.params.questionId)?.deleteOne();
    await product.save();
    res.json({ success: true });
  } catch (error) {
    if (handleTenantScopeError(res, error)) return;
    res.status(500).json({ error: error.message });
  }
});

// --- UPLOAD PRODUCT IMAGE (WebP conversion) ---
router.post('/upload-image', protect, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image uploaded' });
    const tenantId = getTargetTenantId(req.user, req);
    if (!tenantId) return res.status(400).json({ error: 'No tenant found.' });
    const tenantIdStr = tenantId.toString();
    const filename = `product-${Date.now()}-${Math.round(Math.random() * 1E9)}.webp`;
    const key = `ecommerce/${tenantIdStr}/products/${filename}`;

    const buffer = await sharp(req.file.buffer)
      .resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer();

    const { url: imageUrl } = await saveUploadBuffer({
      buffer,
      key,
      contentType: 'image/webp',
      publicUrlPath: `/uploads/${key}`,
    });
    res.json({ imageUrl });
  } catch (error) {
    res.status(500).json({ error: 'Failed to process image' });
  }
});

export default router;
