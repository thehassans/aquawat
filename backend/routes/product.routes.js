import express from 'express';
import multer from 'multer';
import sharp from 'sharp';
import Product from '../models/Product.js';
import { protect, tenantFilter, checkPermission, requireBusinessType, requireTenantFilter } from '../middleware/auth.js';
import { checkTrialLimits } from '../middleware/trialLimits.js';
import { isStockTrackedProductType, normalizeProductType } from '../utils/productType.js';
import { isInvEngineEnabled } from '../services/inventory/legacyAdapter.js';
import { saveUploadBuffer } from '../utils/objectStorage.js';

const router = express.Router();
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    if (/^image\/(jpeg|png|webp)$/i.test(file.mimetype)) cb(null, true);
    else cb(new Error('Only jpg/png/webp up to 5MB'));
  },
});

router.use(protect);
router.use(tenantFilter);
router.use(requireTenantFilter);
router.use(requireBusinessType('trading', 'laundry'));

const computeTotalStock = (product) => {
  const stocks = Array.isArray(product?.stocks) ? product.stocks : [];
  const computed = stocks.reduce((sum, s) => sum + (Number(s.quantity) || 0), 0);
  product.totalStock = computed;
  return product;
};

const enrichInventory = (product) => {
  computeTotalStock(product);
  const stocks = Array.isArray(product?.stocks) ? product.stocks : [];
  const onHand = stocks.reduce((n, s) => n + (Number(s.quantity) || 0), 0);
  const reserved = stocks.reduce((n, s) => n + (Number(s.reservedQuantity) || 0), 0);
  const available = onHand - reserved;
  const reorderPoint = stocks.reduce((n, s) => {
    const rp = Number(s.reorderPoint);
    return Number.isFinite(rp) ? Math.max(n, rp) : n;
  }, 0);
  const point = reorderPoint > 0 ? reorderPoint : 10;
  const tracked = isStockTrackedProductType(product.productType);
  let health = 'in_stock';
  if (!tracked) health = 'not_tracked';
  else if (available <= 0) health = product.allowNegativeStock ? 'backorder' : 'out_of_stock';
  else if (available <= point) health = 'low_stock';
  product.inventory = {
    onHand: tracked ? onHand : 0,
    reserved: tracked ? reserved : 0,
    available: tracked ? available : 0,
    reorderPoint: tracked ? point : 0,
    health,
    tracked,
    warehouseCount: stocks.length,
  };
  return product;
};

const normalizeProductForClient = (product) => {
  if (!product) return product;

  const p = { ...product };
  p.nameEn = p.nameEn ?? p.name ?? p.productNameEn ?? p.productName ?? '';
  p.nameAr = p.nameAr ?? p.nameArabic ?? p.productNameAr ?? '';
  p.descriptionEn = p.descriptionEn ?? p.description ?? '';
  p.descriptionAr = p.descriptionAr ?? '';
  p.costPrice = p.costPrice ?? p.cost ?? 0;
  p.sellingPrice = p.sellingPrice ?? p.price ?? 0;
  p.taxRate = p.taxRate ?? 15;
  p.unitOfMeasure = p.unitOfMeasure ?? 'PCE';
  p.productType = normalizeProductType(p.productType);
  return p;
};

// @route   GET /api/products
router.get('/', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    // Ensure legacy rows get P00001 codes (idempotent; no-op when complete)
    try {
      const missing = await Product.exists({
        ...req.tenantFilter,
        $or: [{ productId: { $exists: false } }, { productId: null }, { productId: '' }],
      });
      if (missing) {
        const { backfillProductIds } = await import('../services/inventory/productIdentity.js');
        await backfillProductIds(req.user.tenantId);
      }
    } catch {
      // ignore backfill errors — list still returns
    }

    const { page = 1, limit = 50, category, categoryId, status, search, lowStock, allowNegativeStock, stockHealth, productType } = req.query;

    const query = { ...req.tenantFilter };
    if (category) query.category = category;
    if (categoryId) query.categoryId = categoryId;
    if (status) query.status = status;
    if (productType === 'service') {
      query.productType = 'service';
    } else if (productType === 'goods') {
      query.$and = (query.$and || []).concat([{
        $or: [{ productType: 'goods' }, { productType: { $exists: false } }, { productType: null }]
      }]);
    }
    if (allowNegativeStock === 'true') {
      query.allowNegativeStock = true;
    } else if (allowNegativeStock === 'false') {
      query.allowNegativeStock = { $ne: true };
    }
    if (search) {
      query.$or = [
        { nameEn: { $regex: search, $options: 'i' } },
        { nameAr: { $regex: search, $options: 'i' } },
        { sku: { $regex: search, $options: 'i' } },
        { barcode: { $regex: search, $options: 'i' } },
        { productId: { $regex: search, $options: 'i' } },
      ];
    }

    const healthFilter = stockHealth || (lowStock === 'true' ? 'low_stock' : '');
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(200, parseInt(limit, 10) || 50));

    const found = await Product.find(query)
      .select('-landedCostHistory')
      .sort({ createdAt: -1 })
      .lean();

    let filteredProducts = found.map((p) => enrichInventory(normalizeProductForClient(p)));
    if (healthFilter) {
      filteredProducts = filteredProducts.filter((p) => p.inventory?.health === healthFilter);
    }

    const total = filteredProducts.length;
    const paged = filteredProducts.slice((pageNum - 1) * limitNum, pageNum * limitNum);

    res.json({
      products: paged,
      pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   GET /api/products/lookup
router.get('/lookup', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const { barcode, sku, qrCode } = req.query;
    
    let query = { ...req.tenantFilter };
    if (barcode) query.barcode = barcode;
    else if (sku) query.sku = sku;
    else if (qrCode) query.qrCode = qrCode;
    else return res.status(400).json({ error: 'Provide barcode, sku, or qrCode' });
    
    const product = await Product.findOne(query).populate('stocks.warehouseId', 'nameEn nameAr code');
    
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    res.json(normalizeProductForClient(enrichInventory(product.toObject ? product.toObject() : product)));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   GET /api/products/stats
router.get('/stats', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const products = await Product.find({ ...req.tenantFilter, isActive: { $ne: false } })
      .select('stocks allowNegativeStock costPrice sellingPrice category status productType')
      .lean();

    const rows = products.map((p) => enrichInventory(p));
    const byHealth = { in_stock: 0, low_stock: 0, out_of_stock: 0, backorder: 0, not_tracked: 0 };
    const byType = { goods: 0, service: 0 };
    let totalStock = 0;
    let totalValue = 0;
    for (const p of rows) {
      const health = p.inventory?.health || 'in_stock';
      byHealth[health] = (byHealth[health] || 0) + 1;
      const type = normalizeProductType(p.productType);
      byType[type] = (byType[type] || 0) + 1;
      if (p.inventory?.tracked !== false) {
        totalStock += p.inventory?.onHand || 0;
        totalValue += (Number(p.costPrice) || 0) * (p.inventory?.onHand || 0);
      }
    }

    res.json({
      byHealth,
      byType,
      totals: [{
        totalProducts: rows.length,
        totalStock,
        totalValue,
        inStock: byHealth.in_stock,
        lowStock: byHealth.low_stock,
        outOfStock: byHealth.out_of_stock,
        backorder: byHealth.backorder,
        services: byType.service,
        goods: byType.goods,
      }],
      lowStock: [{ count: byHealth.low_stock }],
      allowNegativeStock: [{ count: byHealth.backorder }],
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   GET /api/products/:id
router.get('/:id', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const product = await Product.findOne({ _id: req.params.id, ...req.tenantFilter })
      .populate('stocks.warehouseId', 'nameEn nameAr code')
      .populate('suppliers.supplierId', 'name')
      .populate('bomComponents.productId', 'sku nameEn nameAr costPrice')
      .lean();
    
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    res.json(normalizeProductForClient(enrichInventory(product.toObject ? product.toObject() : product)));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   POST /api/products
router.post('/', checkTrialLimits('products'), checkPermission('inventory', 'create'), async (req, res) => {
  try {
    const { nextProductId } = await import('../services/inventory/productIdentity.js');
    const productData = {
      ...req.body,
      productType: normalizeProductType(req.body?.productType),
      tenantId: req.user.tenantId,
      createdBy: req.user._id,
    };
    // Immutable sequential code — never trust client
    delete productData.productId;
    productData.productId = await nextProductId(req.user.tenantId);

    const { assertProductAccountingAccounts } = await import('../services/inventory/productAccounting.js');
    await assertProductAccountingAccounts(req.user.tenantId, productData);

    const product = await Product.create(productData);
    res.status(201).json(computeTotalStock(product));
  } catch (error) {
    const status = error?.status || (error?.code === 'PRODUCT_ACCOUNTS_REQUIRED' ? 400 : 500);
    res.status(status).json({ error: error.message, code: error.code, details: error.details });
  }
});

// @route   PUT /api/products/:id
router.put('/:id', checkPermission('inventory', 'update'), async (req, res) => {
  try {
    const product = await Product.findOne({ _id: req.params.id, ...req.tenantFilter });
    
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Block turning off inventory tracking while stock exists
    if (req.body.trackInventory === false && product.trackInventory !== false) {
      const stocks = Array.isArray(product.stocks) ? product.stocks : [];
      const hasLegacy = stocks.some((s) => Number(s.quantity) > 0);
      let hasEngine = false;
      try {
        const { isInvEngineEnabled } = await import('../services/inventory/legacyAdapter.js');
        if (await isInvEngineEnabled(req.user.tenantId)) {
          const { computeOnHand } = await import('../services/inventory/forecast.js');
          const oh = await computeOnHand(req.user.tenantId, product._id);
          hasEngine = Number(oh.onHand) !== 0;
        }
      } catch {
        // ignore
      }
      if (hasLegacy || hasEngine) {
        return res.status(400).json({
          error: 'Cannot disable Track Inventory while stock exists',
          code: 'HAS_STOCK',
        });
      }
    }

    const lockedProductId = product.productId;
    const { productId: _dropProductId, ...safeBody } = req.body || {};
    void _dropProductId;
    Object.assign(product, safeBody);
    product.productId = lockedProductId;
    if (!product.productId) {
      const { nextProductId } = await import('../services/inventory/productIdentity.js');
      product.productId = await nextProductId(req.user.tenantId);
    }
    product.productType = normalizeProductType(product.productType);

    const { assertProductAccountingAccounts } = await import('../services/inventory/productAccounting.js');
    await assertProductAccountingAccounts(req.user.tenantId, product);

    await product.save();
    
    res.json(computeTotalStock(product));
  } catch (error) {
    const status = error?.status || (error?.code === 'PRODUCT_ACCOUNTS_REQUIRED' ? 400 : 500);
    res.status(status).json({ error: error.message, code: error.code, details: error.details });
  }
});

router.post('/:id/stock/set', checkPermission('inventory', 'update'), async (req, res) => {
  try {
    if (await isInvEngineEnabled(req.user.tenantId)) {
      return res.status(409).json({
        error: 'Inventory engine is enabled — adjust on-hand via Stock Report (adjustment transfer)',
        code: 'ENGINE_BLOCKS_LEGACY_STOCK',
      });
    }
    const { warehouseId, quantity, reorderPoint } = req.body;

    const safeQuantity = Number(quantity);
    const safeReorderPoint = reorderPoint === undefined || reorderPoint === null ? null : Number(reorderPoint);
    if (!warehouseId) {
      return res.status(400).json({ error: 'warehouseId is required' });
    }
    if (!Number.isFinite(safeQuantity) || safeQuantity < 0) {
      return res.status(400).json({ error: 'quantity must be a non-negative number' });
    }
    if (safeReorderPoint !== null && (!Number.isFinite(safeReorderPoint) || safeReorderPoint < 0)) {
      return res.status(400).json({ error: 'reorderPoint must be a non-negative number' });
    }

    const product = await Product.findOne({ _id: req.params.id, ...req.tenantFilter });
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const idx = product.stocks.findIndex((s) => String(s.warehouseId) === String(warehouseId));
    if (idx === -1) {
      product.stocks.push({
        warehouseId,
        quantity: safeQuantity,
        ...(safeReorderPoint === null ? {} : { reorderPoint: safeReorderPoint }),
      });
    } else {
      product.stocks[idx].quantity = safeQuantity;
      if (safeReorderPoint !== null) product.stocks[idx].reorderPoint = safeReorderPoint;
      product.stocks[idx].lastStockUpdate = new Date();
    }

    await product.save();
    res.json(computeTotalStock(product));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   POST /api/products/:id/stock
router.post('/:id/stock', checkPermission('inventory', 'update'), async (req, res) => {
  try {
    if (await isInvEngineEnabled(req.user.tenantId)) {
      return res.status(409).json({
        error: 'Inventory engine is enabled — adjust on-hand via Stock Report (adjustment transfer)',
        code: 'ENGINE_BLOCKS_LEGACY_STOCK',
      });
    }
    const { warehouseId, quantity, type = 'add' } = req.body;

    const safeQuantity = Number(quantity);
    if (!warehouseId) {
      return res.status(400).json({ error: 'warehouseId is required' });
    }
    if (!Number.isFinite(safeQuantity) || safeQuantity <= 0) {
      return res.status(400).json({ error: 'quantity must be a positive number' });
    }
    
    const product = await Product.findOne({ _id: req.params.id, ...req.tenantFilter });
    
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    const quantityChange = type === 'add' ? safeQuantity : -safeQuantity;
    product.updateStock(warehouseId, quantityChange);
    await product.save();
    
    res.json(computeTotalStock(product));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   POST /api/products/:id/landed-cost
router.post('/:id/landed-cost', checkPermission('inventory', 'update'), async (req, res) => {
  try {
    const product = await Product.findOne({ _id: req.params.id, ...req.tenantFilter });
    
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    const unitCost = product.calculateLandedCost(req.body);
    await product.save();
    
    res.json({
      unitLandedCost: unitCost,
      averageLandedCost: product.averageLandedCost,
      product
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   POST /api/products/:id/transfer
router.post('/:id/transfer', checkPermission('inventory', 'update'), async (req, res) => {
  try {
    const { fromWarehouseId, toWarehouseId, quantity } = req.body;
    
    const product = await Product.findOne({ _id: req.params.id, ...req.tenantFilter });
    
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    const fromStock = product.stocks.find(s => s.warehouseId.toString() === fromWarehouseId);
    if (!fromStock || fromStock.quantity < quantity) {
      return res.status(400).json({ error: 'Insufficient stock in source warehouse' });
    }
    
    product.updateStock(fromWarehouseId, -quantity);
    product.updateStock(toWarehouseId, quantity);
    await product.save();
    
    res.json(product);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   POST /api/products/:id/images
router.post('/:id/images', checkPermission('inventory', 'update'), imageUpload.single('image'), async (req, res) => {
  try {
    const product = await Product.findOne({ _id: req.params.id, ...req.tenantFilter });
    if (!product) return res.status(404).json({ error: 'Product not found' });
    if (!req.file) return res.status(400).json({ error: 'No image uploaded' });

    const images = Array.isArray(product.images) ? product.images : [];
    if (images.length >= 9) {
      return res.status(400).json({ error: 'Maximum 9 images (1 main + 8)', code: 'IMAGE_LIMIT' });
    }

    const tenantIdStr = String(req.user.tenantId);
    const stamp = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const fullKey = `products/${tenantIdStr}/${stamp}.webp`;
    const thumbKey = `products/${tenantIdStr}/${stamp}-thumb.webp`;

    // Strip EXIF via sharp pipeline; full + thumb WebP
    const fullBuf = await sharp(req.file.buffer)
      .rotate()
      .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
    const thumbBuf = await sharp(req.file.buffer)
      .rotate()
      .resize({ width: 256, height: 256, fit: 'cover' })
      .webp({ quality: 75 })
      .toBuffer();

    const [{ url }, { url: thumbUrl }] = await Promise.all([
      saveUploadBuffer({ buffer: fullBuf, key: fullKey, contentType: 'image/webp', publicUrlPath: `/uploads/${fullKey}` }),
      saveUploadBuffer({ buffer: thumbBuf, key: thumbKey, contentType: 'image/webp', publicUrlPath: `/uploads/${thumbKey}` }),
    ]);

    const isPrimary = images.length === 0 || req.body.isPrimary === 'true' || req.body.isPrimary === true;
    if (isPrimary) {
      images.forEach((img) => { img.isPrimary = false; });
    }
    images.push({
      url,
      thumbUrl,
      isPrimary,
      alt: req.body.alt || product.nameEn || '',
      sortOrder: images.length,
    });
    product.images = images;
    await product.save();
    res.status(201).json({ images: product.images });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/:id/images', checkPermission('inventory', 'update'), async (req, res) => {
  try {
    const product = await Product.findOne({ _id: req.params.id, ...req.tenantFilter });
    if (!product) return res.status(404).json({ error: 'Product not found' });
    let images = Array.isArray(product.images) ? [...product.images] : [];

    if (Array.isArray(req.body.order)) {
      const byUrl = new Map(images.map((img) => [img.url, img]));
      images = req.body.order.map((url, i) => {
        const img = byUrl.get(url);
        if (!img) return null;
        return { ...img.toObject?.() || img, sortOrder: i };
      }).filter(Boolean);
    }
    if (req.body.primaryUrl) {
      images = images.map((img) => ({
        ...img.toObject?.() || img,
        isPrimary: img.url === req.body.primaryUrl,
      }));
    }
    if (req.body.removeUrl) {
      images = images.filter((img) => img.url !== req.body.removeUrl);
      if (images.length && !images.some((img) => img.isPrimary)) {
        images[0].isPrimary = true;
      }
    }
    product.images = images;
    await product.save();
    res.json({ images: product.images });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   DELETE /api/products/:id
router.delete('/:id', checkPermission('inventory', 'delete'), async (req, res) => {
  try {
    const product = await Product.findOneAndUpdate(
      { _id: req.params.id, ...req.tenantFilter },
      { isActive: false, status: 'discontinued' },
      { new: true }
    );
    
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    res.json({ message: 'Product deactivated', product });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
