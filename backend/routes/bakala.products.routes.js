import express from 'express';
import { protect, checkPermission, tenantFilter, requireTenantFilter } from '../middleware/auth.js';
import BakalaProduct from '../models/BakalaProduct.js';
import BakalaCategory from '../models/BakalaCategory.js';
import BakalaBrand from '../models/BakalaBrand.js';
import BakalaUnit from '../models/BakalaUnit.js';
import { clampLimit } from '../utils/pagination.js';
import { resolveTenantId, withTenant, handleTenantScopeError } from '../utils/tenantScope.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import csv from 'csv-parser';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();
router.use(protect);
router.use(tenantFilter);
router.use(requireTenantFilter);

// --- PRODUCTS ---

// Temporary route to trigger CSV import
router.get('/trigger-import', protect, async (req, res) => {
  try {
    const targetTenantId = resolveTenantId(req.user, req);

    const csvFilePath = path.join(__dirname, '../scripts/bakala_products.csv');
    if (!fs.existsSync(csvFilePath)) {
      return res.status(404).json({ error: 'CSV file not found at ' + csvFilePath });
    }

    const results = [];
    fs.createReadStream(csvFilePath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', async () => {
        let count = 0;
        for (const row of results) {
          const name = row['english items'] || row['english_items'] || 'Unknown Item';
          const nameAr = row['arabic items'] || row['arabic_items'] || '';
          const barcode = row['bracode'] || row['barcode'];
          const costPrice = parseFloat(row['purchase_price']) || 0;
          const retailPrice = parseFloat(row['sale_price']) || 0;
          const minimumStockAlertLevel = parseInt(row['alert_quantity']) || 0;
          const isActive = row['active'] === '1' || row['active'] === 'true' || row['active'] === '';

          if (!barcode) continue;

          try {
            await BakalaProduct.findOneAndUpdate(
              { tenantId: targetTenantId, primaryBarcode: barcode },
              {
                tenantId: targetTenantId,
                name,
                nameAr,
                primaryBarcode: barcode,
                barcodes: [barcode],
                costPrice,
                retailPrice,
                minimumStockAlertLevel,
                isActive,
                taxRate: 15,
                createdBy: req.user._id
              },
              { upsert: true, new: true }
            );
            count++;
          } catch (err) {
            console.error('Import error:', err);
          }
        }
        res.json({ success: true, message: `Successfully imported/updated ${count} products!` });
      });
  } catch (error) {
    if (handleTenantScopeError(res, error)) return;
    res.status(500).json({ error: error.message });
  }
});

const getTargetTenantId = (user, req) => resolveTenantId(user, req);

router.get('/', protect, async (req, res) => {
  try {
    const tenantId = getTargetTenantId(req.user, req);
    const filter = withTenant(tenantId);
    // Inventory/POS UIs load the catalog in one request; keep a hard cap without truncating typical stores.
    const limit = clampLimit(req.query.limit, { def: 200, max: 500 });
    const products = await BakalaProduct.find(filter).sort('-createdAt').limit(limit);
    res.json(products);
  } catch (error) {
    if (handleTenantScopeError(res, error)) return;
    res.status(500).json({ error: error.message });
  }
});

// GET Expiry Report (for Balady/Municipality compliance)
router.get('/expiry-report', protect, async (req, res) => {
  try {
    const tenantId = getTargetTenantId(req.user, req);
    if (!tenantId) return res.status(400).json({ error: 'No tenant found.' });
    
    // Find products that have an expiryDate
    const products = await BakalaProduct.find({ 
      tenantId, 
      expiryDate: { $exists: true, $ne: null } 
    }).sort('expiryDate');

    res.json(products);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET Inventory Alerts (low-stock, out-of-stock, expiry) for the Bakala alerts dashboard
router.get('/inventory-alerts', protect, async (req, res) => {
  try {
    const tenantId = getTargetTenantId(req.user, req);
    if (!tenantId) return res.status(400).json({ error: 'No tenant found.' });

    const expiryWindowDays = Math.max(1, parseInt(req.query.expiryWindowDays, 10) || 30);
    const alertLimit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 100));
    const now = new Date();
    const expiryThreshold = new Date(now.getTime() + expiryWindowDays * 24 * 60 * 60 * 1000);
    const select = 'name nameAr primaryBarcode category brand unit stockQuantity minimumStockAlertLevel costPrice retailPrice expiryDate batchNumber genericName sfdaRegisterNumber dosageForm strength manufacturer requiresPrescription isControlled';
    const base = { tenantId, isActive: { $ne: false } };

    const [
      totalProducts,
      outOfStockCount,
      lowStockCount,
      expiredCount,
      expiringSoonCount,
      outOfStock,
      lowStock,
      expired,
      expiringSoon,
      stockValueAgg,
    ] = await Promise.all([
      BakalaProduct.countDocuments(base),
      BakalaProduct.countDocuments({ ...base, stockQuantity: { $lte: 0 } }),
      BakalaProduct.countDocuments({
        ...base,
        stockQuantity: { $gt: 0 },
        $expr: { $lte: ['$stockQuantity', { $ifNull: ['$minimumStockAlertLevel', 10] }] },
      }),
      BakalaProduct.countDocuments({ ...base, expiryDate: { $lte: now, $ne: null } }),
      BakalaProduct.countDocuments({ ...base, expiryDate: { $gt: now, $lte: expiryThreshold } }),
      BakalaProduct.find({ ...base, stockQuantity: { $lte: 0 } }).select(select).sort({ stockQuantity: 1 }).limit(alertLimit).lean(),
      BakalaProduct.find({
        ...base,
        stockQuantity: { $gt: 0 },
        $expr: { $lte: ['$stockQuantity', { $ifNull: ['$minimumStockAlertLevel', 10] }] },
      }).select(select).sort({ stockQuantity: 1 }).limit(alertLimit).lean(),
      BakalaProduct.find({ ...base, expiryDate: { $lte: now, $ne: null } }).select(select).sort({ expiryDate: 1 }).limit(alertLimit).lean(),
      BakalaProduct.find({ ...base, expiryDate: { $gt: now, $lte: expiryThreshold } }).select(select).sort({ expiryDate: 1 }).limit(alertLimit).lean(),
      BakalaProduct.aggregate([
        { $match: { ...base, stockQuantity: { $gt: 0 } } },
        {
          $addFields: {
            alertLevel: { $ifNull: ['$minimumStockAlertLevel', 10] },
          },
        },
        { $match: { $expr: { $lte: ['$stockQuantity', '$alertLevel'] } } },
        {
          $group: {
            _id: null,
            value: {
              $sum: {
                $multiply: ['$stockQuantity', { $ifNull: ['$costPrice', 0] }],
              },
            },
          },
        },
      ]),
    ]);

    const stockValueAtRisk = Math.round((stockValueAgg[0]?.value || 0) * 100) / 100;

    res.json({
      generatedAt: now.toISOString(),
      expiryWindowDays,
      summary: {
        totalProducts,
        lowStock: lowStockCount,
        outOfStock: outOfStockCount,
        expired: expiredCount,
        expiringSoon: expiringSoonCount,
        stockValueAtRisk,
      },
      lowStock,
      outOfStock,
      expired,
      expiringSoon,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET product by barcode (for scan-to-find during product entry / stock-in)
router.get('/barcode/:code', protect, async (req, res) => {
  try {
    const tenantId = getTargetTenantId(req.user, req);
    if (!tenantId) return res.status(400).json({ error: 'No tenant found.' });
    const code = String(req.params.code || '').trim();
    if (!code) return res.status(400).json({ error: 'Barcode required' });
    const product = await BakalaProduct.findOne({
      tenantId,
      $or: [{ primaryBarcode: code }, { barcodes: code }],
    });
    if (!product) return res.status(404).json({ error: 'Product not found', found: false });
    res.json({ found: true, product });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', protect, async (req, res) => {
  try {
    const tenantId = getTargetTenantId(req.user, req);
    if (!tenantId) return res.status(400).json({ error: 'No tenant found for this user.' });

    const body = { ...req.body };
    // Auto-generate an internal barcode for items that don't have one
    if (!body.primaryBarcode || !String(body.primaryBarcode).trim()) {
      body.primaryBarcode = `INT${Date.now()}${Math.floor(Math.random() * 100)}`;
    }
    if (!Array.isArray(body.barcodes) || body.barcodes.length === 0) {
      body.barcodes = [body.primaryBarcode];
    }

    // Prevent duplicate barcode within the tenant
    const exists = await BakalaProduct.findOne({ tenantId, primaryBarcode: body.primaryBarcode });
    if (exists) {
      return res.status(409).json({ error: 'A product with this barcode already exists.', product: exists });
    }

    const product = new BakalaProduct({ ...body, tenantId, createdBy: req.user._id });
    await product.save();
    res.status(201).json(product);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// POST add stock (stock-in) — increments stock quantity and optionally updates cost/expiry/batch
router.post('/:id/add-stock', protect, async (req, res) => {
  try {
    const tenantId = getTargetTenantId(req.user, req);
    const { quantity, costPrice, expiryDate, batchNumber } = req.body;
    const qty = Number(quantity);
    if (!qty || qty <= 0) return res.status(400).json({ error: 'Quantity must be greater than zero.' });

    const product = await BakalaProduct.findOne({ _id: req.params.id, ...withTenant(tenantId) });
    if (!product) return res.status(404).json({ error: 'Product not found' });

    product.stockQuantity = (Number(product.stockQuantity) || 0) + qty;
    if (costPrice !== undefined && costPrice !== null && costPrice !== '') {
      product.costPrice = Number(costPrice) || product.costPrice;
    }
    if (expiryDate) product.expiryDate = expiryDate;
    if (batchNumber) {
      product.batchNumber = batchNumber;
      product.batches = product.batches || [];
      product.batches.push({ batchNumber, expiryDate: expiryDate || null, quantity: qty });
    }
    await product.save();
    res.json({ success: true, product });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.put('/:id', protect, async (req, res) => {
  try {
    const tenantId = getTargetTenantId(req.user, req);
    const product = await BakalaProduct.findOneAndUpdate(
      { _id: req.params.id, ...withTenant(tenantId) },
      req.body,
      { new: true, runValidators: true }
    );
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.delete('/:id', protect, async (req, res) => {
  try {
    const tenantId = getTargetTenantId(req.user, req);
    const product = await BakalaProduct.findOneAndDelete({ _id: req.params.id, ...withTenant(tenantId) });
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST sync-pending — bulk sync offline-created products
router.post('/sync-pending', protect, async (req, res) => {
  try {
    const tenantId = getTargetTenantId(req.user, req);
    if (!tenantId) return res.status(400).json({ error: 'No tenant found for this user.' });

    const { products } = req.body;
    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ error: 'No products provided' });
    }

    const synced = [];
    const errors = [];

    for (const pending of products) {
      try {
        const body = { ...pending };
        // Auto-generate barcode if missing
        if (!body.primaryBarcode || !String(body.primaryBarcode).trim()) {
          body.primaryBarcode = `INT${Date.now()}${Math.floor(Math.random() * 100)}`;
        }
        if (!Array.isArray(body.barcodes) || body.barcodes.length === 0) {
          body.barcodes = [body.primaryBarcode];
        }

        // Check for duplicate barcode
        const exists = await BakalaProduct.findOne({ tenantId, primaryBarcode: body.primaryBarcode });
        if (exists) {
          errors.push({ pendingId: pending.pendingId, error: 'Barcode already exists', product: exists });
          continue;
        }

        // Remove fields that shouldn't be passed directly
        delete body.pendingId;
        delete body.timestamp;
        delete body._id;

        const product = new BakalaProduct({
          ...body,
          tenantId,
          createdBy: req.user._id,
        });
        await product.save();
        synced.push({ pendingId: pending.pendingId, product });
      } catch (err) {
        errors.push({ pendingId: pending.pendingId, error: err.message });
      }
    }

    res.status(201).json({ success: true, synced, errors });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- CATEGORIES ---
router.get('/categories', protect, async (req, res) => {
  try {
    const tenantId = getTargetTenantId(req.user, req);
    const filter = withTenant(tenantId);
    const categories = await BakalaCategory.find(filter).sort('name');
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/categories', protect, async (req, res) => {
  try {
    const tenantId = getTargetTenantId(req.user, req);
    if (!tenantId) return res.status(400).json({ error: 'No tenant found for this user.' });
    const category = new BakalaCategory({ ...req.body, tenantId });
    await category.save();
    res.status(201).json(category);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.put('/categories/:id', protect, async (req, res) => {
  try {
    const tenantId = getTargetTenantId(req.user, req);
    const category = await BakalaCategory.findOneAndUpdate(
      { _id: req.params.id, ...withTenant(tenantId) },
      req.body,
      { new: true, runValidators: true }
    );
    if (!category) return res.status(404).json({ error: 'Category not found' });
    res.json(category);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.delete('/categories/:id', protect, async (req, res) => {
  try {
    const tenantId = getTargetTenantId(req.user, req);
    await BakalaCategory.findOneAndDelete({ _id: req.params.id, ...withTenant(tenantId) });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- BRANDS ---
router.get('/brands', protect, async (req, res) => {
  try {
    const tenantId = getTargetTenantId(req.user, req);
    const filter = withTenant(tenantId);
    const brands = await BakalaBrand.find(filter).sort('name');
    res.json(brands);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/brands', protect, async (req, res) => {
  try {
    const tenantId = getTargetTenantId(req.user, req);
    if (!tenantId) return res.status(400).json({ error: 'No tenant found for this user.' });
    const brand = new BakalaBrand({ ...req.body, tenantId });
    await brand.save();
    res.status(201).json(brand);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.put('/brands/:id', protect, async (req, res) => {
  try {
    const tenantId = getTargetTenantId(req.user, req);
    const brand = await BakalaBrand.findOneAndUpdate(
      { _id: req.params.id, ...withTenant(tenantId) },
      req.body,
      { new: true, runValidators: true }
    );
    if (!brand) return res.status(404).json({ error: 'Brand not found' });
    res.json(brand);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.delete('/brands/:id', protect, async (req, res) => {
  try {
    const tenantId = getTargetTenantId(req.user, req);
    await BakalaBrand.findOneAndDelete({ _id: req.params.id, ...withTenant(tenantId) });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- UNITS ---
router.get('/units', protect, async (req, res) => {
  try {
    const tenantId = getTargetTenantId(req.user, req);
    const filter = withTenant(tenantId);
    const units = await BakalaUnit.find(filter).sort('name');
    res.json(units);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/units', protect, async (req, res) => {
  try {
    const tenantId = getTargetTenantId(req.user, req);
    if (!tenantId) return res.status(400).json({ error: 'No tenant found for this user.' });
    const unit = new BakalaUnit({ ...req.body, tenantId });
    await unit.save();
    res.status(201).json(unit);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.put('/units/:id', protect, async (req, res) => {
  try {
    const tenantId = getTargetTenantId(req.user, req);
    const unit = await BakalaUnit.findOneAndUpdate(
      { _id: req.params.id, ...withTenant(tenantId) },
      req.body,
      { new: true, runValidators: true }
    );
    if (!unit) return res.status(404).json({ error: 'Unit not found' });
    res.json(unit);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.delete('/units/:id', protect, async (req, res) => {
  try {
    const tenantId = getTargetTenantId(req.user, req);
    await BakalaUnit.findOneAndDelete({ _id: req.params.id, ...withTenant(tenantId) });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
