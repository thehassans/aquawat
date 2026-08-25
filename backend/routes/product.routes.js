import express from 'express';
import Product from '../models/Product.js';
import { protect, tenantFilter, checkPermission, requireBusinessType, requireTenantFilter } from '../middleware/auth.js';
import { checkTrialLimits } from '../middleware/trialLimits.js';
import { isStockTrackedProductType, normalizeProductType } from '../utils/productType.js';

const router = express.Router();

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
    const { page = 1, limit = 50, category, status, search, lowStock, allowNegativeStock, stockHealth, productType } = req.query;

    const query = { ...req.tenantFilter };
    if (category) query.category = category;
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
        { barcode: { $regex: search, $options: 'i' } }
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
    const productData = {
      ...req.body,
      productType: normalizeProductType(req.body?.productType),
      tenantId: req.user.tenantId,
      createdBy: req.user._id
    };
    
    const product = await Product.create(productData);
    res.status(201).json(computeTotalStock(product));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   PUT /api/products/:id
router.put('/:id', checkPermission('inventory', 'update'), async (req, res) => {
  try {
    const product = await Product.findOne({ _id: req.params.id, ...req.tenantFilter });
    
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    Object.assign(product, req.body);
    product.productType = normalizeProductType(product.productType);
    await product.save();
    
    res.json(computeTotalStock(product));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/stock/set', checkPermission('inventory', 'update'), async (req, res) => {
  try {
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
