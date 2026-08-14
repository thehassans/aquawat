import express from 'express';
import mongoose from 'mongoose';
import Tenant from '../models/Tenant.js';
import EcommerceProduct from '../models/EcommerceProduct.js';
import EcommerceOrder from '../models/EcommerceOrder.js';
import EcommerceReview from '../models/EcommerceReview.js';
import EcommerceBundle from '../models/EcommerceBundle.js';
import { resolveTenantByHost } from '../middleware/resolveTenantByHost.js';
import { createCheckoutSession } from '../services/paymentService.js';
import { fireServerSideEvents, getPublicPixelConfig } from '../services/pixelService.js';
import { sendOrderConfirmationEmail } from '../utils/tenantEmailService.js';
import EcommerceGiftCard from '../models/EcommerceGiftCard.js';

const router = express.Router();

// All storefront routes use host-based tenant resolution (no JWT auth)
router.use(resolveTenantByHost);

// --- STORE INFO (theme, store name, SEO) ---
router.get('/info', async (req, res) => {
  try {
    const tenant = req.storeTenant;
    const ecommerce = tenant.ecommerce || {};
    const theme = ecommerce.theme?.published || {};
    res.json({
      storeName: ecommerce.storeName || tenant.name,
      storeNameAr: ecommerce.storeNameAr || '',
      storeStatus: ecommerce.storeStatus,
      currency: ecommerce.currency || 'SAR',
      theme,
      seo: ecommerce.seo || {},
      logo: theme.header?.logoImageUrl || '',
      logoText: theme.header?.logoText || ecommerce.storeName || tenant.name,
      pixels: getPublicPixelConfig(ecommerce.pixels),
      paymentMethods: [
        ecommerce.payments?.codEnabled !== false ? 'cod' : null,
        ecommerce.payments?.moyasar?.enabled ? 'moyasar' : null,
        ecommerce.payments?.tap?.enabled ? 'tap' : null,
        ecommerce.payments?.paytabs?.enabled ? 'paytabs' : null,
        ecommerce.payments?.stripe?.enabled ? 'stripe' : null,
        ecommerce.payments?.tabby?.enabled ? 'tabby' : null,
        ecommerce.payments?.tamara?.enabled ? 'tamara' : null,
      ].filter(Boolean),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- AUTOCOMPLETE SEARCH (lightweight, fuzzy) ---
router.get('/search/autocomplete', async (req, res) => {
  try {
    const tenantId = req.storeTenant._id;
    const { q, limit = 6 } = req.query;
    if (!q || q.trim().length < 1) return res.json({ products: [], suggestions: [] });

    const query = q.trim();
    // Fuzzy matching: escape regex special chars, then build a flexible pattern
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Match products where title starts with or contains the query (case-insensitive)
    const titleRegex = new RegExp(escaped, 'i');

    const products = await EcommerceProduct.find({
      tenantId, status: 'active',
      $or: [
        { title: titleRegex },
        { tags: { $in: [titleRegex] } },
        { category: titleRegex },
        { brand: titleRegex },
      ],
    })
      .select('title basePrice compareAtPrice images category brand seo.slug hasVariants variants.sku variants.price variants.stockQuantity')
      .limit(Number(limit))
      .lean();

    // Also return category/brand suggestions
    const categories = await EcommerceProduct.distinct('category', {
      tenantId, status: 'active', category: titleRegex,
    });
    const brands = await EcommerceProduct.distinct('brand', {
      tenantId, status: 'active', brand: titleRegex, brand: { $ne: '' },
    });

    res.json({
      products,
      suggestions: {
        categories: categories.slice(0, 3),
        brands: brands.filter(Boolean).slice(0, 3),
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- POPULAR SEARCHES ---
router.get('/search/popular', async (req, res) => {
  try {
    const tenantId = req.storeTenant._id;
    // Aggregate top-selling product titles as popular searches
    const popular = await EcommerceProduct.find({ tenantId, status: 'active', salesCount: { $gt: 0 } })
      .select('title')
      .sort({ salesCount: -1 })
      .limit(8)
      .lean();
    res.json({ terms: popular.map(p => p.title) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- LIST PRODUCTS (public, active only) ---
router.get('/products', async (req, res) => {
  try {
    const tenantId = req.storeTenant._id;
    const { search, category, sort, page = 1, limit = 24, minPrice, maxPrice, inStock, brand, minRating } = req.query;
    const filter = { tenantId, status: 'active' };

    if (search) filter.$text = { $search: search };
    if (category) filter.category = category;
    if (brand) filter.brand = brand;
    if (minPrice || maxPrice) {
      filter.basePrice = {};
      if (minPrice) filter.basePrice.$gte = Number(minPrice);
      if (maxPrice) filter.basePrice.$lte = Number(maxPrice);
    }
    if (inStock === 'true') {
      filter.$or = [
        { trackInventory: false },
        { trackInventory: true, stockQuantity: { $gt: 0 } },
        { hasVariants: true, 'variants.stockQuantity': { $gt: 0 } },
      ];
    }

    // Rating filter requires aggregation — fetch product IDs with sufficient rating
    let ratingProductIds = null;
    if (minRating && Number(minRating) > 0) {
      const ratingStats = await EcommerceReview.aggregate([
        { $match: { tenantId, status: 'approved' } },
        { $group: { _id: '$productId', avgRating: { $avg: '$rating' }, count: { $sum: 1 } } },
        { $match: { avgRating: { $gte: Number(minRating) } } },
      ]);
      ratingProductIds = ratingStats.map(s => s._id);
      if (ratingProductIds.length === 0) {
        return res.json({ products: [], total: 0, page: Number(page), totalPages: 0, categories: [], brands: [] });
      }
      filter._id = { $in: ratingProductIds };
    }

    const sortOptions = {
      newest: { createdAt: -1 },
      'price-low': { basePrice: 1 },
      'price-high': { basePrice: -1 },
      popular: { salesCount: -1 },
      'top-rated': { rating: -1 },
    };
    const sortBy = sortOptions[sort] || sortOptions.newest;

    const skip = (Number(page) - 1) * Number(limit);
    const [products, total] = await Promise.all([
      EcommerceProduct.find(filter)
        .select('title titleAr basePrice compareAtPrice images category brand hasVariants variants.sku variants.price variants.stockQuantity seo.slug salesCount rating')
        .sort(sortBy)
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      EcommerceProduct.countDocuments(filter),
    ]);

    // Get distinct categories and brands for filters
    const [categories, brands] = await Promise.all([
      EcommerceProduct.distinct('category', { tenantId, status: 'active' }),
      EcommerceProduct.distinct('brand', { tenantId, status: 'active', brand: { $exists: true, $ne: '' } }),
    ]);

    res.json({ products, total, page: Number(page), totalPages: Math.ceil(total / Number(limit)), categories, brands: brands.filter(Boolean) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- BATCH REVIEW STATS (for product cards) ---
router.get('/review-stats', async (req, res) => {
  try {
    const tenantId = req.storeTenant._id;
    const { productIds } = req.query;
    if (!productIds) return res.json({});
    const ids = productIds.split(',').filter(Boolean);
    const stats = await EcommerceReview.aggregate([
      { $match: { tenantId, productId: { $in: ids.map(id => new mongoose.Types.ObjectId(id)) }, status: 'approved' } },
      { $group: { _id: '$productId', avgRating: { $avg: '$rating' }, count: { $sum: 1 } } },
    ]);
    const result = {};
    stats.forEach(s => { result[s._id] = { avgRating: Math.round(s.avgRating * 10) / 10, count: s.count }; });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- ACTIVE BUNDLES (public) ---
router.get('/bundles', async (req, res) => {
  try {
    const tenantId = req.storeTenant._id;
    const now = new Date();
    const bundles = await EcommerceBundle.find({
      tenantId, isActive: true,
      $or: [{ startsAt: null }, { startsAt: { $lte: now } }],
      $or: [{ endsAt: null }, { endsAt: { $gte: now } }],
    }).lean();

    const productIds = [...new Set(bundles.flatMap(b => b.items.map(i => i.productId)))];
    const products = await EcommerceProduct.find({ _id: { $in: productIds } })
      .select('title basePrice images seo.slug').lean();
    const productMap = {};
    products.forEach(p => { productMap[p._id] = p; });

    const enriched = bundles.map(b => ({
      ...b,
      items: b.items.map(item => ({ ...item, product: productMap[item.productId] || null })),
    }));
    res.json({ bundles: enriched });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- FREQUENTLY BOUGHT TOGETHER (public) ---
router.get('/frequently-bought/:productId', async (req, res) => {
  try {
    const tenantId = req.storeTenant._id;
    const productId = new mongoose.Types.ObjectId(req.params.productId);

    const orders = await EcommerceOrder.find({
      tenantId, 'lineItems.productId': productId,
    }).select('lineItems.productId').limit(200).lean();

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
      _id: { $in: sortedIds.map(id => new mongoose.Types.ObjectId(id)) }, status: 'active',
    }).select('title basePrice images seo.slug').lean();

    const productMap = {};
    products.forEach(p => { productMap[p._id.toString()] = p; });
    const sorted = sortedIds.map(id => productMap[id]).filter(Boolean);

    res.json({ products: sorted, source: 'orders' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- RECENT SALES (for social proof popups) ---
router.get('/recent-sales', async (req, res) => {
  try {
    const tenantId = req.storeTenant._id;
    const recentOrders = await EcommerceOrder.find({
      tenantId,
      status: { $nin: ['cancelled', 'refunded'] },
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    })
      .select('orderNumber customer.city customer.name lineItems.createdAt')
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    const sales = recentOrders.flatMap(order =>
      (order.lineItems || []).slice(0, 1).map(item => ({
        orderNumber: order.orderNumber,
        customerName: order.customer?.name || 'Someone',
        city: order.customer?.city || '',
        productId: item.productId,
        productTitle: item.title,
        productImage: item.image || '',
        timeAgo: Math.round((Date.now() - new Date(order.createdAt).getTime()) / 60000),
      }))
    );

    res.json({ sales: sales.slice(0, 10) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- GET REVIEWS FOR A PRODUCT (public, approved only) ---
router.get('/reviews/product/:slug', async (req, res) => {
  try {
    const tenantId = req.storeTenant._id;
    const { slug } = req.params;

    // Find product by slug
    const product = await EcommerceProduct.findOne({ 'seo.slug': slug, tenantId, status: 'active' }).select('_id').lean();
    if (!product) return res.status(404).json({ error: 'Product not found' });

    const reviews = await EcommerceReview.find({ tenantId, productId: product._id, status: 'approved' })
      .sort({ createdAt: -1 })
      .lean();

    const totalReviews = reviews.length;
    const avgRating = totalReviews > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews : 0;

    res.json({
      reviews,
      totalReviews,
      avgRating: Math.round(avgRating * 10) / 10,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- CATEGORY LANDING PAGE DATA ---
router.get('/category/:slug', async (req, res) => {
  try {
    const tenantId = req.storeTenant._id;
    const { slug } = req.params;
    const category = decodeURIComponent(slug);

    const [products, total, subCategories] = await Promise.all([
      EcommerceProduct.find({ tenantId, status: 'active', category })
        .select('title titleAr basePrice compareAtPrice images category hasVariants variants.sku variants.price variants.stockQuantity seo.slug salesCount')
        .sort({ salesCount: -1, createdAt: -1 })
        .limit(24)
        .lean(),
      EcommerceProduct.countDocuments({ tenantId, status: 'active', category }),
      EcommerceProduct.distinct('subcategory', { tenantId, status: 'active', category }),
    ]);

    if (total === 0) return res.status(404).json({ error: 'Category not found' });

    res.json({
      category,
      products,
      total,
      subCategories: subCategories.filter(Boolean),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- GET SINGLE PRODUCT (by ID or slug) ---
router.get('/products/:id', async (req, res) => {
  try {
    const tenantId = req.storeTenant._id;
    const { id } = req.params;
    let product;

    // Try by ID first, then by slug
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      product = await EcommerceProduct.findOne({ _id: id, tenantId, status: 'active' }).lean();
    }
    if (!product) {
      product = await EcommerceProduct.findOne({ 'seo.slug': id, tenantId, status: 'active' }).lean();
    }

    if (!product) return res.status(404).json({ error: 'Product not found' });

    // Increment views
    EcommerceProduct.updateOne({ _id: product._id }, { $inc: { viewsCount: 1 } }).exec();

    // Get related products (same category, exclude current)
    const related = await EcommerceProduct.find({
      tenantId, status: 'active', category: product.category, _id: { $ne: product._id },
    })
      .select('title basePrice images seo.slug')
      .limit(4)
      .lean();

    res.json({ product, related });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- SHIPPING ESTIMATE (public, for checkout preview) ---
router.post('/shipping/estimate', async (req, res) => {
  try {
    const ecommerce = req.storeTenant.ecommerce || {};
    const { subtotal } = req.body;
    const flatRate = ecommerce.couriers?.flatRate || {};
    let shippingCost = 0;
    let freeShipping = false;
    if (flatRate.enabled) {
      const threshold = flatRate.freeShippingThreshold || 0;
      const cartSubtotal = Number(subtotal) || 0;
      if (threshold > 0 && cartSubtotal >= threshold) {
        shippingCost = 0;
        freeShipping = true;
      } else {
        shippingCost = flatRate.price || 0;
      }
    }
    res.json({ shippingCost, freeShipping, flatRateEnabled: !!flatRate.enabled });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- CREATE ORDER (public checkout) ---
router.post('/orders', async (req, res) => {
  try {
    const tenantId = req.storeTenant._id;
    const ecommerce = req.storeTenant.ecommerce || {};
    const { customer, items, paymentMethod, giftCardCode } = req.body;

    if (!customer || !customer.name) return res.status(400).json({ error: 'Customer name is required' });
    if (!items || !items.length) return res.status(400).json({ error: 'Cart is empty' });

    const method = paymentMethod || 'cod';
    const payments = ecommerce.payments || {};
    const methodOk = method === 'cod'
      ? payments.codEnabled !== false
      : Boolean(payments[method]?.enabled);
    if (!methodOk) return res.status(400).json({ error: 'That payment method is not enabled' });

    // Validate products and compute totals with atomic stock deduction
    let subtotal = 0;
    let taxTotal = 0;
    const processedItems = [];
    const currency = ecommerce.currency || 'SAR';
    const defaultTaxRate = ecommerce.defaultTaxRate || 15;
    const pricesIncludeTax = ecommerce.pricesIncludeTax ?? true;

    for (const item of items) {
      const product = await EcommerceProduct.findOne({ _id: item.productId, tenantId, status: 'active' });
      if (!product) return res.status(400).json({ error: `Product not found` });

      const qty = Math.max(1, parseInt(item.quantity) || 1);
      let unitPrice = product.basePrice;
      let variantLabel = '';
      let variantId = null;

      if (product.hasVariants && item.variantId) {
        const variant = product.variants.id(item.variantId);
        if (!variant || !variant.isActive) return res.status(400).json({ error: `Variant not available for ${product.title}` });
        unitPrice = variant.price || product.basePrice;
        variantId = variant._id;
        variantLabel = [variant.option1Value, variant.option2Value, variant.option3Value].filter(Boolean).join(' / ');

        if (variant.trackInventory && variant.stockQuantity < qty && !product.continueSellingWhenOOS) {
          return res.status(400).json({ error: `Out of stock: ${product.title} (${variantLabel})` });
        }
        await EcommerceProduct.updateOne(
          { _id: product._id, 'variants._id': variant._id, 'variants.stockQuantity': { $gte: qty } },
          { $inc: { 'variants.$.stockQuantity': -qty } }
        );
      } else {
        if (product.trackInventory && product.stockQuantity < qty && !product.continueSellingWhenOOS) {
          return res.status(400).json({ error: `Out of stock: ${product.title}` });
        }
        await EcommerceProduct.updateOne(
          { _id: product._id, stockQuantity: { $gte: qty } },
          { $inc: { stockQuantity: -qty } }
        );
      }

      const taxRate = product.taxRate || defaultTaxRate;
      const lineTotal = unitPrice * qty;
      const lineTax = pricesIncludeTax ? 0 : lineTotal * (taxRate / 100);
      subtotal += lineTotal;
      taxTotal += lineTax;

      processedItems.push({
        productId: product._id,
        productTitle: product.title,
        productImage: product.images?.[0]?.url || '',
        variantId,
        variantLabel,
        sku: product.hasVariants ? '' : product.sku,
        price: unitPrice,
        quantity: qty,
        taxRate,
        taxAmount: Math.round(lineTax * 100) / 100,
        lineTotal: Math.round(lineTotal * 100) / 100,
      });

      EcommerceProduct.updateOne({ _id: product._id }, { $inc: { salesCount: qty } }).exec();
    }

    // Calculate shipping (flat rate for now)
    const flatRate = ecommerce.couriers?.flatRate || {};
    let shippingCost = 0;
    if (flatRate.enabled) {
      shippingCost = subtotal >= (flatRate.freeShippingThreshold || Infinity) ? 0 : (flatRate.price || 0);
    }

    const discount = 0;
    let giftCardAmount = 0;
    let giftCardDoc = null;
    if (giftCardCode) {
      giftCardDoc = await EcommerceGiftCard.findOne({ code: giftCardCode.toUpperCase().trim(), tenantId });
      if (!giftCardDoc) return res.status(400).json({ error: 'Invalid gift card code' });
      if (giftCardDoc.status === 'disabled') return res.status(400).json({ error: 'Gift card has been disabled' });
      if (giftCardDoc.expiresAt && new Date(giftCardDoc.expiresAt) < new Date()) return res.status(400).json({ error: 'Gift card has expired' });
      if (giftCardDoc.balance <= 0) return res.status(400).json({ error: 'Gift card has no remaining balance' });
    }
    const preGiftTotal = Math.round((subtotal + shippingCost + taxTotal - discount) * 100) / 100;
    if (giftCardDoc) {
      giftCardAmount = Math.min(giftCardDoc.balance, preGiftTotal);
    }
    const grandTotal = Math.round((preGiftTotal - giftCardAmount) * 100) / 100;

    const order = new EcommerceOrder({
      tenantId,
      customer,
      lineItems: processedItems,
      subtotal: Math.round(subtotal * 100) / 100,
      discount,
      shippingCost,
      taxTotal: Math.round(taxTotal * 100) / 100,
      grandTotal,
      currency,
      payment: {
        method: paymentMethod || 'cod',
        status: 'pending',
        amount: grandTotal,
        currency,
      },
      shipping: {
        method: flatRate.enabled ? 'flat_rate' : 'pickup',
        cost: shippingCost,
        status: 'unfulfilled',
      },
      source: 'storefront',
      customerIp: req.ip || '',
    });

    await order.save();

    // Deduct gift card balance if used
    if (giftCardDoc && giftCardAmount > 0) {
      giftCardDoc.balance = Math.round((giftCardDoc.balance - giftCardAmount) * 100) / 100;
      giftCardDoc.redeemedOrders.push({ orderId: order._id, amount: giftCardAmount });
      if (giftCardDoc.balance <= 0) giftCardDoc.status = 'redeemed';
      await giftCardDoc.save();
    }

    // Fire server-side pixel events (CAPI)
    const pixelConfig = ecommerce.pixels || {};
    fireServerSideEvents('Purchase', {
      eventId: `purchase_${order.orderNumber}`,
      customData: { value: order.grandTotal, currency: order.currency, content_ids: processedItems.map(i => i.productId.toString()), content_type: 'product', num_items: processedItems.length },
      userData: { email: order.customer.email, phone: order.customer.phone },
    }, pixelConfig).catch(() => {});

    // Send order confirmation email to customer
    if (order.customer?.email) {
      try {
        const tenant = await Tenant.findById(tenantId).lean();
        if (tenant) sendOrderConfirmationEmail({ tenant, order }).catch(() => {});
      } catch {}
    }

    res.status(201).json({ order, orderId: order._id, orderNumber: order.orderNumber });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// --- INITIATE PAYMENT FOR ORDER ---
router.post('/checkout/:orderId', async (req, res) => {
  try {
    const tenantId = req.storeTenant._id;
    const ecommerce = req.storeTenant.ecommerce || {};
    const order = await EcommerceOrder.findOne({ _id: req.params.orderId, tenantId });
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const provider = req.body.provider || ecommerce.payments?.defaultProvider;
    if (!provider || provider === 'cod') {
      order.payment.method = 'cod';
      order.payment.status = 'pending';
      await order.save();
      return res.json({ provider: 'cod', checkoutUrl: null });
    }

    const config = ecommerce.payments?.[provider];
    if (!config?.enabled) return res.status(400).json({ error: `${provider} is not enabled` });

    // Prefer Express hostname (respects trust proxy); never prefer raw X-Forwarded-Host from clients
    const host = String(req.hostname || req.headers.host || '')
      .split(':')[0]
      .trim()
      .toLowerCase();
    const origin = `https://${host}`;
    const result = await createCheckoutSession(provider, {
      amount: order.grandTotal,
      currency: order.currency,
      orderId: order._id.toString(),
      orderNumber: order.orderNumber,
      customer: order.customer,
      items: order.lineItems,
      successUrl: `${origin}/checkout/success?order=${order.orderNumber}`,
      cancelUrl: `${origin}/checkout/cancel?order=${order.orderNumber}`,
    }, config);

    order.payment.method = provider;
    order.payment.provider = provider;
    order.payment.providerTransactionId = result.providerPaymentId;
    await order.save();

    res.json({ provider, checkoutUrl: result.checkoutUrl, paymentId: result.providerPaymentId });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// --- ORDER TRACKING (public, lookup by order number + phone/email) ---
router.post('/track-order', async (req, res) => {
  try {
    const tenantId = req.storeTenant._id;
    const { orderNumber, phone, email } = req.body;

    if (!orderNumber) return res.status(400).json({ error: 'Order number is required' });

    const order = await EcommerceOrder.findOne({ tenantId, orderNumber: orderNumber.trim() }).lean();
    if (!order) return res.status(404).json({ error: 'Order not found' });

    // Verify phone or email matches
    const phoneMatch = phone && order.customer.phone && order.customer.phone.replace(/\s/g, '') === phone.replace(/\s/g, '');
    const emailMatch = email && order.customer.email && order.customer.email.toLowerCase() === email.toLowerCase().trim();
    if (!phoneMatch && !emailMatch) {
      return res.status(403).json({ error: 'Phone or email does not match this order' });
    }

    // Return sanitized order info (no sensitive data)
    res.json({
      _id: order._id,
      orderNumber: order.orderNumber,
      status: order.status,
      createdAt: order.createdAt,
      total: order.grandTotal,
      currency: order.currency || 'SAR',
      itemCount: order.lineItems?.length || 0,
      items: order.lineItems?.map(i => ({ title: i.title, quantity: i.quantity, price: i.price })) || [],
      shippingStatus: order.shipping?.status || 'unfulfilled',
      trackingNumber: order.shipping?.trackingNumber || '',
      paymentStatus: order.payment?.status || 'pending',
      paymentMethod: order.payment?.method || '',
      statusHistory: order.statusHistory?.map(h => ({ status: h.status, date: h.changedAt, note: h.note })) || [],
      estimatedDelivery: order.shipping?.estimatedDelivery || null,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- BULK ORDER LOOKUP (find all orders by phone or email) ---
router.post('/track-orders', async (req, res) => {
  try {
    const tenantId = req.storeTenant._id;
    const { phone, email } = req.body;
    if (!phone && !email) return res.status(400).json({ error: 'Phone or email is required' });

    const filter = { tenantId };
    if (phone) filter['customer.phone'] = { $regex: phone.replace(/\s/g, ''), $options: 'i' };
    else if (email) filter['customer.email'] = email.toLowerCase().trim();

    const orders = await EcommerceOrder.find(filter)
      .select('orderNumber status createdAt grandTotal currency lineItems shipping.status shipping.trackingNumber payment.status')
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    if (orders.length === 0) return res.status(404).json({ error: 'No orders found' });

    res.json({
      orders: orders.map(o => ({
        orderNumber: o.orderNumber,
        status: o.status,
        createdAt: o.createdAt,
        total: o.grandTotal,
        currency: o.currency || 'SAR',
        itemCount: o.lineItems?.length || 0,
        shippingStatus: o.shipping?.status || 'unfulfilled',
        trackingNumber: o.shipping?.trackingNumber || '',
        paymentStatus: o.payment?.status || 'pending',
      })),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- RETURN REQUEST (public, customer submits return) ---
router.post('/returns/request', async (req, res) => {
  try {
    const tenantId = req.storeTenant._id;
    const { orderId, orderNumber, phone, email, items, reason, reasonDetails, images } = req.body;

    if (!orderId || !items || items.length === 0) {
      return res.status(400).json({ error: 'Order ID and items are required' });
    }

    const order = await EcommerceOrder.findOne({ tenantId, _id: orderId });
    if (!order) return res.status(404).json({ error: 'Order not found' });

    // Verify phone or email matches
    const phoneMatch = phone && order.customer.phone && order.customer.phone.replace(/\s/g, '') === phone.replace(/\s/g, '');
    const emailMatch = email && order.customer.email && order.customer.email.toLowerCase() === email.toLowerCase().trim();
    if (!phoneMatch && !emailMatch) {
      return res.status(403).json({ error: 'Phone or email does not match this order' });
    }

    if (!['delivered', 'completed'].includes(order.status)) {
      return res.status(400).json({ error: 'Returns can only be requested for delivered orders' });
    }

    // Check for existing pending return
    const EcommerceReturn = (await import('../models/EcommerceReturn.js')).default;
    const existing = await EcommerceReturn.findOne({
      tenantId, orderId, status: { $in: ['requested', 'approved', 'received'] },
    });
    if (existing) {
      return res.status(400).json({ error: 'A return request is already in progress for this order' });
    }

    const refundAmount = items.reduce((sum, i) => sum + (i.price * i.quantity), 0);

    const ret = await EcommerceReturn.create({
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

    res.json({ success: true, returnNumber: ret.returnNumber });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- RETURN STATUS CHECK (public) ---
router.post('/returns/status', async (req, res) => {
  try {
    const tenantId = req.storeTenant._id;
    const { orderId, phone, email } = req.body;

    const EcommerceReturn = (await import('../models/EcommerceReturn.js')).default;
    const ret = await EcommerceReturn.findOne({ tenantId, orderId }).sort({ createdAt: -1 }).lean();
    if (!ret) return res.json({ return: null });

    // Verify phone or email
    const phoneMatch = phone && ret.customerPhone && ret.customerPhone.replace(/\s/g, '') === phone.replace(/\s/g, '');
    const emailMatch = email && ret.customerEmail && ret.customerEmail.toLowerCase() === email.toLowerCase().trim();
    if (!phoneMatch && !emailMatch) {
      return res.status(403).json({ error: 'Phone or email does not match' });
    }

    res.json({
      return: {
        returnNumber: ret.returnNumber,
        status: ret.status,
        reason: ret.reason,
        refundAmount: ret.refundAmount,
        createdAt: ret.createdAt,
        items: ret.items,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- NEWSLETTER SUBSCRIPTION ---
router.post('/newsletter/subscribe', async (req, res) => {
  try {
    const tenantId = req.storeTenant._id;
    const { email } = req.body;

    if (!email || !email.includes('@')) return res.status(400).json({ error: 'Valid email is required' });

    // Store subscriber on tenant ecommerce config
    const tenant = await Tenant.findById(tenantId);
    if (!tenant) return res.status(404).json({ error: 'Store not found' });

    tenant.ecommerce = tenant.ecommerce || {};
    tenant.ecommerce.newsletterSubscribers = tenant.ecommerce.newsletterSubscribers || [];

    const exists = tenant.ecommerce.newsletterSubscribers.find(s => s.email.toLowerCase() === email.toLowerCase().trim());
    if (exists) {
      if (!exists.isActive) {
        exists.isActive = true;
        exists.resubscribedAt = new Date();
        await tenant.save();
      }
      return res.json({ subscribed: true, message: 'Already subscribed' });
    }

    tenant.ecommerce.newsletterSubscribers.push({
      email: email.toLowerCase().trim(),
      subscribedAt: new Date(),
      isActive: true,
    });

    await tenant.save();
    res.json({ subscribed: true, message: 'Subscribed successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- NEWSLETTER UNSUBSCRIBE ---
router.post('/newsletter/unsubscribe', async (req, res) => {
  try {
    const tenantId = req.storeTenant._id;
    const { email } = req.body;

    if (!email) return res.status(400).json({ error: 'Email is required' });

    const tenant = await Tenant.findById(tenantId);
    if (!tenant) return res.status(404).json({ error: 'Store not found' });

    const subscriber = (tenant.ecommerce?.newsletterSubscribers || []).find(s => s.email === email.toLowerCase().trim());
    if (subscriber) {
      subscriber.isActive = false;
      subscriber.unsubscribedAt = new Date();
      await tenant.save();
    }

    res.json({ unsubscribed: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- PRODUCT Q&A (public) ---
router.get('/products/:id/questions', async (req, res) => {
  try {
    const tenantId = req.storeTenant._id;
    const product = await EcommerceProduct.findOne({ _id: req.params.id, tenantId, status: 'active' })
      .select('questions');
    if (!product) return res.status(404).json({ error: 'Product not found' });
    const publicQs = product.questions.filter(q => q.isPublic && q.answer).map(q => ({
      _id: q._id, question: q.question, askerName: q.askerName, answer: q.answer, createdAt: q.createdAt, answeredAt: q.answeredAt,
    }));
    res.json({ questions: publicQs });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/products/:id/questions', async (req, res) => {
  try {
    const tenantId = req.storeTenant._id;
    const { question, askerName, askerEmail } = req.body;
    if (!question || !question.trim()) return res.status(400).json({ error: 'Question is required' });

    const product = await EcommerceProduct.findOne({ _id: req.params.id, tenantId, status: 'active' });
    if (!product) return res.status(404).json({ error: 'Product not found' });

    product.questions.push({
      question: question.trim(),
      askerName: askerName || '',
      askerEmail: askerEmail || '',
    });
    await product.save();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- BACK IN STOCK NOTIFICATION (public) ---
router.post('/products/:id/notify-stock', async (req, res) => {
  try {
    const tenantId = req.storeTenant._id;
    const { email, variantId } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const product = await EcommerceProduct.findOne({ _id: req.params.id, tenantId, status: 'active' });
    if (!product) return res.status(404).json({ error: 'Product not found' });

    const existing = product.stockNotifications.find(n => n.email === email && String(n.variantId || '') === String(variantId || ''));
    if (existing) return res.json({ success: true, message: 'Already signed up' });

    product.stockNotifications.push({ email, variantId: variantId || null });
    await product.save();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- CONTACT FORM (public) ---
router.post('/contact', async (req, res) => {
  try {
    const tenantId = req.storeTenant._id;
    const { name, email, phone, subject, message } = req.body;
    if (!name || !email || !message) return res.status(400).json({ error: 'Name, email, and message are required' });

    const tenant = await Tenant.findById(tenantId).lean();
    const storeName = tenant?.name || 'Store';
    const notifyEmail = tenant?.ecommerce?.contactEmail || tenant?.email || '';

    if (notifyEmail) {
      const { sendTenantEmail } = await import('../utils/tenantEmailService.js');
      sendTenantEmail({
        tenant,
        to: notifyEmail,
        replyTo: email,
        subject: `[Contact Form] ${subject || 'New inquiry from ' + name}`,
        html: `
          <h2>New Contact Form Submission</h2>
          <p><strong>From:</strong> ${name}</p>
          <p><strong>Email:</strong> ${email}</p>
          ${phone ? `<p><strong>Phone:</strong> ${phone}</p>` : ''}
          ${subject ? `<p><strong>Subject:</strong> ${subject}</p>` : ''}
          <hr>
          <p><strong>Message:</strong></p>
          <p style="white-space: pre-wrap;">${message}</p>
        `,
        text: `New contact form submission from ${name} (${email}${phone ? ', ' + phone : ''})\n\nSubject: ${subject || 'N/A'}\n\nMessage: ${message}`,
      }).catch(() => {});
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- GIFT CARD CHECK (public, for checkout) ---
router.post('/gift-card/check', async (req, res) => {
  try {
    const tenantId = req.storeTenant._id;
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'Gift card code is required' });

    const card = await EcommerceGiftCard.findOne({ code: code.toUpperCase().trim(), tenantId });
    if (!card) return res.status(404).json({ error: 'Invalid gift card code' });

    if (card.status === 'disabled') return res.status(400).json({ error: 'This gift card has been disabled' });
    if (card.status === 'redeemed') return res.status(400).json({ error: 'This gift card has been fully redeemed' });
    if (card.expiresAt && new Date(card.expiresAt) < new Date()) return res.status(400).json({ error: 'This gift card has expired' });

    res.json({ code: card.code, balance: card.balance, currency: card.currency, amount: card.amount });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
