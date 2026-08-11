import express from 'express';
import { protect } from '../middleware/auth.js';
import BookStoreProduct from '../models/BookStoreProduct.js';
import SchoolSupplyList from '../models/SchoolSupplyList.js';
import BookRental from '../models/BookRental.js';
import CourseEnrollment from '../models/CourseEnrollment.js';
import Invoice from '../models/Invoice.js';
import Tenant from '../models/Tenant.js';
import PosSession from '../models/PosSession.js';
import ZatcaService from '../utils/zatca/ZatcaService.js';
import { isZatcaCurrency } from '../utils/zatcaCurrency.js';
import { clampLimit } from '../utils/pagination.js';
import mongoose from 'mongoose';
import multer from 'multer';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { imageUpload } from '../utils/uploadMime.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const getTargetTenantId = async (user) => {
  if (user.tenantId) return user.tenantId;
  if (user.role === 'super_admin') {
    const tenant = await Tenant.findOne({ businessTypes: 'bookstore' });
    return tenant ? tenant._id : null;
  }
  return null;
};

// --- PRODUCTS ---

router.get('/products', protect, async (req, res) => {
  try {
    const tenantId = await getTargetTenantId(req.user);
    const filter = tenantId ? { tenantId, isActive: true } : {};
    // Inventory/POS UIs load the catalog in one request; keep a hard cap without truncating typical stores.
    const limit = clampLimit(req.query.limit, { def: 1000, max: 5000 });
    const products = await BookStoreProduct.find(filter)
      .select('name nameAr isbn primaryBarcode author publisher genre language retailPrice discountPrice taxRate unit stockQuantity category coverImage seriesName seriesNumber seriesTotal productType uniformSize uniformColor uniformGender uniformGradeLevel uniformSchoolName courseName courseLevel courseSubject courseDurationWeeks courseStartDate courseEndDate courseInstructor courseSchedule courseCapacity courseEnrolledCount courseLocation courseIsComplete courseBooks bundleItems bundleOriginalPrice bundleDiscountPercent')
      .limit(limit)
      .lean();
    res.json({ success: true, products });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/products/all', protect, async (req, res) => {
  try {
    const tenantId = await getTargetTenantId(req.user);
    const filter = tenantId ? { tenantId } : {};
    const limit = clampLimit(req.query.limit, { def: 1000, max: 5000 });
    const products = await BookStoreProduct.find(filter).sort('-createdAt').limit(limit);
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/products/barcode/:code', protect, async (req, res) => {
  try {
    const tenantId = await getTargetTenantId(req.user);
    if (!tenantId) return res.status(400).json({ error: 'No tenant found.' });
    const code = String(req.params.code || '').trim();
    if (!code) return res.status(400).json({ error: 'Barcode/ISBN required' });
    const product = await BookStoreProduct.findOne({
      tenantId,
      $or: [{ primaryBarcode: code }, { barcodes: code }, { isbn: code }],
    });
    if (!product) return res.status(404).json({ error: 'Product not found', found: false });
    res.json({ found: true, product });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/products', protect, async (req, res) => {
  try {
    const tenantId = await getTargetTenantId(req.user);
    if (!tenantId) return res.status(400).json({ error: 'No tenant found for this user.' });

    const body = { ...req.body };
    if (!body.primaryBarcode || !String(body.primaryBarcode).trim()) {
      body.primaryBarcode = body.isbn || `INT${Date.now()}${Math.floor(Math.random() * 100)}`;
    }
    if (!Array.isArray(body.barcodes) || body.barcodes.length === 0) {
      body.barcodes = [body.primaryBarcode];
    }

    const exists = await BookStoreProduct.findOne({ tenantId, primaryBarcode: body.primaryBarcode });
    if (exists) {
      return res.status(409).json({ error: 'A product with this barcode/ISBN already exists.', product: exists });
    }

    const product = new BookStoreProduct({ ...body, tenantId, createdBy: req.user._id });
    await product.save();
    res.status(201).json(product);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/products/:id/add-stock', protect, async (req, res) => {
  try {
    const tenantId = await getTargetTenantId(req.user);
    const { quantity, costPrice } = req.body;
    const qty = Number(quantity);
    if (!qty || qty <= 0) return res.status(400).json({ error: 'Quantity must be greater than zero.' });

    const product = await BookStoreProduct.findOne({ _id: req.params.id, ...(tenantId ? { tenantId } : {}) });
    if (!product) return res.status(404).json({ error: 'Product not found' });

    product.stockQuantity = (Number(product.stockQuantity) || 0) + qty;
    if (costPrice !== undefined && costPrice !== null && costPrice !== '') {
      product.costPrice = Number(costPrice) || product.costPrice;
    }
    await product.save();
    res.json({ success: true, product });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.put('/products/:id', protect, async (req, res) => {
  try {
    const tenantId = await getTargetTenantId(req.user);
    const product = await BookStoreProduct.findOneAndUpdate(
      { _id: req.params.id, ...(tenantId ? { tenantId } : {}) },
      req.body,
      { new: true, runValidators: true }
    );
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.delete('/products/:id', protect, async (req, res) => {
  try {
    const tenantId = await getTargetTenantId(req.user);
    const product = await BookStoreProduct.findOneAndDelete({ _id: req.params.id, ...(tenantId ? { tenantId } : {}) });
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/products/inventory-alerts', protect, async (req, res) => {
  try {
    const tenantId = await getTargetTenantId(req.user);
    if (!tenantId) return res.status(400).json({ error: 'No tenant found.' });

    const products = await BookStoreProduct.find({ tenantId, isActive: { $ne: false } })
      .select('name nameAr isbn primaryBarcode author stockQuantity minimumStockAlertLevel costPrice retailPrice')
      .lean();

    const lowStock = [];
    const outOfStock = [];

    for (const p of products) {
      const stock = Number(p.stockQuantity) || 0;
      const alertLevel = p.minimumStockAlertLevel != null ? Number(p.minimumStockAlertLevel) : 5;

      if (stock <= 0) {
        outOfStock.push(p);
      } else if (stock <= alertLevel) {
        lowStock.push(p);
      }
    }

    lowStock.sort((a, b) => (Number(a.stockQuantity) || 0) - (Number(b.stockQuantity) || 0));
    outOfStock.sort((a, b) => (Number(a.stockQuantity) || 0) - (Number(b.stockQuantity) || 0));

    res.json({
      summary: {
        totalProducts: products.length,
        lowStock: lowStock.length,
        outOfStock: outOfStock.length,
      },
      lowStock,
      outOfStock,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- POS SYNC (offline invoices) ---

router.post('/sync', protect, async (req, res) => {
  try {
    const { invoices } = req.body;
    const tenantId = req.user.tenantId;

    if (!Array.isArray(invoices) || invoices.length === 0) {
      return res.status(400).json({ success: false, message: 'No invoices provided' });
    }

    const tenant = await Tenant.findById(tenantId);
    if (!tenant) return res.status(404).json({ success: false, message: 'Tenant not found' });

    const zatcaConfig = tenant.zatca || {};
    const zatcaService = new ZatcaService({
      privateKey: zatcaConfig.privateKey,
      certificate: zatcaConfig.certificateSerialNumber,
      csid: zatcaConfig.productionCsid || zatcaConfig.complianceCsid,
      previousInvoiceHash: zatcaConfig.lastInvoiceHash,
    });

    const syncedInvoices = [];
    const errors = [];

    for (const offlineInvoice of invoices) {
      try {
        const cleanedInvoice = {
          ...offlineInvoice,
          paymentMethod: offlineInvoice.paymentMethod === 'split' ? 'split' : (['mada', 'apple_pay'].includes(offlineInvoice.paymentMethod) ? 'card' : (offlineInvoice.paymentMethod === 'khata' ? 'khata' : (offlineInvoice.paymentMethod || 'cash'))),
          payments: offlineInvoice.payments || [],
          lineItems: offlineInvoice.lineItems?.map(line => {
            const l = { ...line };
            if (l.productId && !mongoose.Types.ObjectId.isValid(l.productId)) {
              delete l.productId;
            }
            return l;
          }) || [],
        };

        const isDraft = String(cleanedInvoice.status || '').trim().toLowerCase() === 'draft';
        const initialStatus = isDraft ? 'draft' : (tenant.zatca?.phase === 1 ? 'approved' : 'pending');

        const newInvoice = new Invoice({
          ...cleanedInvoice,
          tenantId,
          flow: 'sell',
          businessContext: 'bookstore',
          transactionType: 'B2C',
          invoiceTypeCode: '0200000',
          status: initialStatus,
          createdBy: req.user._id,
        });

        if (!newInvoice.invoiceNumber) {
          const lastInvoice = await Invoice.findOne({ tenantId, invoiceNumber: { $regex: '^BOOK-' } })
            .sort({ createdAt: -1 })
            .select('invoiceNumber');

          let seq = 1;
          if (lastInvoice && lastInvoice.invoiceNumber) {
            const parts = lastInvoice.invoiceNumber.split('-');
            const lastSeq = parseInt(parts[1], 10);
            if (!isNaN(lastSeq)) seq = lastSeq + 1;
          }
          newInvoice.invoiceNumber = `BOOK-${seq}`;
        }

        if (zatcaConfig.isOnboarded && zatcaConfig.privateKey && isZatcaCurrency(tenant)) {
          const processed = await zatcaService.processInvoice(newInvoice.toObject(), tenant.business, true);
          newInvoice.zatca = { ...processed, submissionStatus: 'pending' };
          tenant.zatca.lastInvoiceHash = processed.invoiceHash;
          tenant.zatca.invoiceCounter = processed.invoiceCounter;
        }

        await newInvoice.save();

        for (const line of newInvoice.lineItems) {
          if (line.productId) {
            await BookStoreProduct.findByIdAndUpdate(line.productId, {
              $inc: { stockQuantity: -line.quantity },
            });
          }
        }

        syncedInvoices.push({ offlineId: offlineInvoice.offlineId, uuid: newInvoice.zatca?.uuid || newInvoice._id });
      } catch (err) {
        console.error('BookStore Invoice Sync Error:', err);
        errors.push({ offlineId: offlineInvoice.offlineId, error: err.message });
      }
    }

    if (zatcaConfig.isOnboarded && zatcaConfig.privateKey) {
      await tenant.save();
    }

    res.status(201).json({ success: true, syncedInvoices, errors });
  } catch (error) {
    console.error('BookStore Sync Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// --- POS SESSION / SHIFT MANAGEMENT ---

router.get('/shift/current', protect, async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.user.tenantId);
    const requireShift = tenant?.settings?.bookstore?.requireShift !== false;

    if (!requireShift) {
      return res.json({
        success: true,
        session: {
          _id: 'auto',
          tenantId: req.user.tenantId,
          userId: req.user._id,
          status: 'open',
          openingBalance: 0,
          openedAt: new Date(),
          cashDrops: [],
        },
      });
    }

    const session = await PosSession.findOne({
      tenantId: req.user.tenantId,
      userId: req.user._id,
      status: 'open',
    });
    res.json({ success: true, session });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/shift/open', protect, async (req, res) => {
  try {
    const existing = await PosSession.findOne({
      tenantId: req.user.tenantId,
      userId: req.user._id,
      status: 'open',
    });
    if (existing) return res.status(400).json({ success: false, message: 'Shift already open' });

    const session = new PosSession({
      tenantId: req.user.tenantId,
      userId: req.user._id,
      openingBalance: req.body.openingBalance || 0,
    });
    await session.save();
    res.json({ success: true, session });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/shift/drop', protect, async (req, res) => {
  try {
    const session = await PosSession.findOne({
      tenantId: req.user.tenantId,
      userId: req.user._id,
      status: 'open',
    });
    if (!session) return res.status(400).json({ success: false, message: 'No open shift' });

    session.cashDrops.push({ amount: req.body.amount, reason: req.body.reason });
    await session.save();
    res.json({ success: true, session });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/shift/close', protect, async (req, res) => {
  try {
    const session = await PosSession.findOne({
      tenantId: req.user.tenantId,
      userId: req.user._id,
      status: 'open',
    });
    if (!session) return res.status(400).json({ success: false, message: 'No open shift' });

    session.closedAt = new Date();
    session.actualClosingBalance = req.body.actualClosingBalance || 0;
    session.totalSales = req.body.totalSales || 0;
    session.totalCash = req.body.totalCash || 0;
    session.totalCard = req.body.totalCard || 0;

    const dropsTotal = session.cashDrops.reduce((acc, d) => acc + d.amount, 0);
    session.expectedClosingBalance = session.openingBalance + session.totalCash - dropsTotal;
    session.cashDiscrepancy = session.actualClosingBalance - session.expectedClosingBalance;

    session.status = 'closed';
    await session.save();

    res.json({ success: true, session });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// --- COVER IMAGE UPLOAD ---

router.post('/upload-cover', protect, imageUpload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image uploaded' });

    const tenantIdStr = req.user.tenantId.toString();
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'bookstore', tenantIdStr);
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const filename = `cover-${Date.now()}-${Math.round(Math.random() * 1E9)}.webp`;
    const filepath = path.join(uploadsDir, filename);

    await sharp(req.file.buffer)
      .resize({ width: 600, height: 900, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80 })
      .toFile(filepath);

    const imageUrl = `/uploads/bookstore/${tenantIdStr}/${filename}`;
    res.json({ imageUrl });
  } catch (error) {
    console.error('BookStore cover upload error:', error);
    res.status(500).json({ error: 'Failed to process image' });
  }
});

// --- CSV / EXCEL IMPORT ---

router.post('/import-csv', protect, upload.single('file'), async (req, res) => {
  try {
    const tenantId = await getTargetTenantId(req.user);
    if (!tenantId) return res.status(400).json({ error: 'No tenant found.' });
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const results = [];
    const buffer = req.file.buffer.toString('utf-8');
    const lines = buffer.split(/\r?\n/);
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());

    let count = 0;
    let errors = 0;

    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      const values = lines[i].split(',');
      const row = {};
      headers.forEach((h, idx) => { row[h] = (values[idx] || '').trim(); });

      const name = row['name'] || row['title'] || row['english_name'] || '';
      if (!name) { errors++; continue; }

      const barcode = row['barcode'] || row['isbn'] || `INT${Date.now()}${Math.floor(Math.random() * 10000)}`;
      const existing = await BookStoreProduct.findOne({ tenantId, primaryBarcode: barcode });
      if (existing) { errors++; continue; }

      try {
        await BookStoreProduct.findOneAndUpdate(
          { tenantId, primaryBarcode: barcode },
          {
            tenantId,
            name,
            nameAr: row['name_ar'] || row['arabic_name'] || '',
            isbn: row['isbn'] || '',
            primaryBarcode: barcode,
            barcodes: [barcode],
            author: row['author'] || '',
            authorAr: row['author_ar'] || '',
            publisher: row['publisher'] || '',
            publisherAr: row['publisher_ar'] || '',
            genre: row['genre'] || row['category'] || '',
            category: row['category'] || '',
            language: row['language'] || 'English',
            edition: row['edition'] || '',
            publicationYear: parseInt(row['publication_year']) || null,
            coverType: row['cover_type'] || 'paperback',
            seriesName: row['series_name'] || row['series'] || '',
            seriesNumber: parseInt(row['series_number']) || null,
            seriesTotal: parseInt(row['series_total']) || null,
            isStationery: row['is_stationery'] === 'true' || row['is_stationery'] === '1',
            costPrice: parseFloat(row['cost_price']) || 0,
            retailPrice: parseFloat(row['retail_price']) || parseFloat(row['price']) || 0,
            discountPrice: parseFloat(row['discount_price']) || 0,
            stockQuantity: parseInt(row['stock_quantity']) || 0,
            minimumStockAlertLevel: parseInt(row['min_stock_alert']) || 5,
            taxRate: parseFloat(row['tax_rate']) || 15,
            coverImage: row['cover_image_url'] || '',
            createdBy: req.user._id,
          },
          { upsert: true, new: true }
        );
        count++;
      } catch (err) {
        console.error('Import error row', i, ':', err);
        errors++;
      }
    }

    res.json({ success: true, imported: count, errors, total: lines.length - 1 });
  } catch (error) {
    console.error('CSV import error:', error);
    res.status(500).json({ error: error.message });
  }
});

// --- SERIES TRACKING ---

router.get('/series/:seriesName/next-volume', protect, async (req, res) => {
  try {
    const tenantId = await getTargetTenantId(req.user);
    if (!tenantId) return res.status(400).json({ error: 'No tenant found.' });

    const seriesName = decodeURIComponent(req.params.seriesName);
    const books = await BookStoreProduct.find({ tenantId, seriesName })
      .sort({ seriesNumber: 1 })
      .select('name nameAr isbn primaryBarcode author seriesName seriesNumber seriesTotal retailPrice discountPrice coverImage stockQuantity')
      .lean();

    if (books.length === 0) return res.json({ books: [], nextVolume: null });

    const maxNumber = Math.max(...books.map(b => b.seriesNumber || 0));
    const seriesTotal = books[0]?.seriesTotal || null;
    const nextVolume = seriesTotal && maxNumber < seriesTotal ? maxNumber + 1 : null;

    res.json({ books, nextVolume, seriesTotal, currentMax: maxNumber });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/series', protect, async (req, res) => {
  try {
    const tenantId = await getTargetTenantId(req.user);
    if (!tenantId) return res.status(400).json({ error: 'No tenant found.' });

    const series = await BookStoreProduct.aggregate([
      { $match: { tenantId: new mongoose.Types.ObjectId(tenantId), seriesName: { $exists: true, $ne: '' } } },
      { $group: { _id: '$seriesName', count: { $sum: 1 }, books: { $push: { name: '$name', seriesNumber: '$seriesNumber', _id: '$_id' } } } },
      { $sort: { _id: 1 } },
    ]);

    res.json({ series });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- BESTSELLER REPORT ---

router.get('/reports/bestsellers', protect, async (req, res) => {
  try {
    const tenantId = await getTargetTenantId(req.user);
    if (!tenantId) return res.status(400).json({ error: 'No tenant found.' });

    const { startDate, endDate } = req.query;
    const matchStage = {
      tenantId: new mongoose.Types.ObjectId(tenantId),
      businessContext: 'bookstore',
    };
    if (startDate || endDate) {
      matchStage.issueDate = {};
      if (startDate) matchStage.issueDate.$gte = new Date(startDate);
      if (endDate) matchStage.issueDate.$lte = new Date(endDate);
    }

    const [byGenre, byAuthor, byProduct] = await Promise.all([
      Invoice.aggregate([
        { $match: matchStage },
        { $unwind: '$lineItems' },
        { $lookup: { from: 'bookstoreproducts', localField: 'lineItems.productId', foreignField: '_id', as: 'product' } },
        { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
        { $group: {
          _id: { $ifNull: ['$product.genre', 'Unknown'] },
          totalSold: { $sum: '$lineItems.quantity' },
          revenue: { $sum: '$lineItems.lineTotalWithTax' },
          count: { $sum: 1 },
        }},
        { $sort: { totalSold: -1 } },
        { $limit: 20 },
      ]),
      Invoice.aggregate([
        { $match: matchStage },
        { $unwind: '$lineItems' },
        { $lookup: { from: 'bookstoreproducts', localField: 'lineItems.productId', foreignField: '_id', as: 'product' } },
        { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
        { $group: {
          _id: { $ifNull: ['$product.author', 'Unknown'] },
          totalSold: { $sum: '$lineItems.quantity' },
          revenue: { $sum: '$lineItems.lineTotalWithTax' },
          count: { $sum: 1 },
        }},
        { $sort: { totalSold: -1 } },
        { $limit: 20 },
      ]),
      Invoice.aggregate([
        { $match: matchStage },
        { $unwind: '$lineItems' },
        { $group: {
          _id: '$lineItems.productName',
          totalSold: { $sum: '$lineItems.quantity' },
          revenue: { $sum: '$lineItems.lineTotalWithTax' },
          count: { $sum: 1 },
        }},
        { $sort: { totalSold: -1 } },
        { $limit: 20 },
      ]),
    ]);

    res.json({ byGenre, byAuthor, byProduct });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- SCHOOL SUPPLY LISTS ---

router.get('/supply-lists', protect, async (req, res) => {
  try {
    const tenantId = await getTargetTenantId(req.user);
    if (!tenantId) return res.status(400).json({ error: 'No tenant found.' });
    const lists = await SchoolSupplyList.find({ tenantId, isActive: true }).sort('schoolName grade').lean();
    res.json(lists);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/supply-lists', protect, async (req, res) => {
  try {
    const tenantId = await getTargetTenantId(req.user);
    if (!tenantId) return res.status(400).json({ error: 'No tenant found.' });

    const items = req.body.items || [];
    const totalEstimatedPrice = items.reduce((sum, item) => sum + (item.estimatedPrice || 0) * (item.quantity || 1), 0);

    const list = new SchoolSupplyList({
      ...req.body,
      tenantId,
      items,
      totalEstimatedPrice,
      createdBy: req.user._id,
    });
    await list.save();
    res.status(201).json(list);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.put('/supply-lists/:id', protect, async (req, res) => {
  try {
    const tenantId = await getTargetTenantId(req.user);
    const items = req.body.items || [];
    const totalEstimatedPrice = items.reduce((sum, item) => sum + (item.estimatedPrice || 0) * (item.quantity || 1), 0);

    const list = await SchoolSupplyList.findOneAndUpdate(
      { _id: req.params.id, tenantId },
      { ...req.body, items, totalEstimatedPrice },
      { new: true, runValidators: true }
    );
    if (!list) return res.status(404).json({ error: 'Supply list not found' });
    res.json(list);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.delete('/supply-lists/:id', protect, async (req, res) => {
  try {
    const tenantId = await getTargetTenantId(req.user);
    const list = await SchoolSupplyList.findOneAndUpdate(
      { _id: req.params.id, tenantId },
      { isActive: false },
      { new: true }
    );
    if (!list) return res.status(404).json({ error: 'Supply list not found' });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- COURSES ---

router.get('/courses', protect, async (req, res) => {
  try {
    const tenantId = await getTargetTenantId(req.user);
    if (!tenantId) return res.status(400).json({ error: 'No tenant found.' });
    const courses = await BookStoreProduct.find({ tenantId, productType: 'course', isActive: true })
      .populate('courseBooks', 'name nameAr isbn primaryBarcode author retailPrice discountPrice coverImage stockQuantity productType')
      .sort('-createdAt')
      .lean();
    res.json(courses);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/courses/:id/books', protect, async (req, res) => {
  try {
    const tenantId = await getTargetTenantId(req.user);
    if (!tenantId) return res.status(400).json({ error: 'No tenant found.' });
    const course = await BookStoreProduct.findOne({ _id: req.params.id, tenantId, productType: 'course' })
      .populate('courseBooks', 'name nameAr isbn primaryBarcode author retailPrice discountPrice coverImage stockQuantity productType taxRate')
      .lean();
    if (!course) return res.status(404).json({ error: 'Course not found' });
    res.json({ success: true, books: course.courseBooks || [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/books/list', protect, async (req, res) => {
  try {
    const tenantId = await getTargetTenantId(req.user);
    if (!tenantId) return res.status(400).json({ error: 'No tenant found.' });
    const books = await BookStoreProduct.find({ tenantId, isActive: true, $or: [{ productType: 'book' }, { productType: { $exists: false } }, { productType: null }] })
      .select('name nameAr isbn primaryBarcode author retailPrice discountPrice coverImage stockQuantity')
      .sort('name')
      .lean();
    res.json(books);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/courses/:id/enroll', protect, async (req, res) => {
  try {
    const tenantId = await getTargetTenantId(req.user);
    const course = await BookStoreProduct.findOne({ _id: req.params.id, tenantId, productType: 'course' });
    if (!course) return res.status(404).json({ error: 'Course not found' });
    if (course.courseEnrolledCount >= course.courseCapacity && course.courseCapacity > 0) {
      return res.status(400).json({ error: 'Course is full' });
    }
    course.courseEnrolledCount = (course.courseEnrolledCount || 0) + 1;
    await course.save();
    res.json({ success: true, course });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/courses/:id/complete', protect, async (req, res) => {
  try {
    const tenantId = await getTargetTenantId(req.user);
    const course = await BookStoreProduct.findOne({ _id: req.params.id, tenantId, productType: 'course' });
    if (!course) return res.status(404).json({ error: 'Course not found' });
    course.courseIsComplete = true;
    await course.save();
    res.json({ success: true, course });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// --- UNIFORMS ---

router.get('/uniforms', protect, async (req, res) => {
  try {
    const tenantId = await getTargetTenantId(req.user);
    if (!tenantId) return res.status(400).json({ error: 'No tenant found.' });
    const uniforms = await BookStoreProduct.find({ tenantId, productType: 'uniform', isActive: true })
      .sort('-createdAt')
      .lean();
    res.json(uniforms);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- USED BOOKS / BUY-BACK ---

router.post('/buyback', protect, async (req, res) => {
  try {
    const tenantId = await getTargetTenantId(req.user);
    if (!tenantId) return res.status(400).json({ error: 'No tenant found.' });

    const { isbn, title, author, publisher, condition, buyBackPrice, resalePrice, customerName, customerPhone, coverImage } = req.body;

    if (!title) return res.status(400).json({ error: 'Book title is required' });
    if (!buyBackPrice || buyBackPrice <= 0) return res.status(400).json({ error: 'Buy-back price must be greater than zero' });

    const barcode = isbn || `USED-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

    const existing = await BookStoreProduct.findOne({ tenantId, primaryBarcode: barcode });
    if (existing) {
      existing.stockQuantity += 1;
      existing.buyBackPrice = buyBackPrice;
      existing.condition = condition || 'good';
      existing.isUsedBook = true;
      await existing.save();
      return res.json({ success: true, product: existing, message: 'Stock added to existing used book' });
    }

    const product = new BookStoreProduct({
      tenantId,
      name: title,
      isbn: isbn || '',
      primaryBarcode: barcode,
      barcodes: [barcode],
      author: author || '',
      publisher: publisher || '',
      isUsedBook: true,
      condition: condition || 'good',
      buyBackPrice: Number(buyBackPrice),
      costPrice: Number(buyBackPrice),
      originalRetailPrice: Number(resalePrice) || 0,
      retailPrice: Number(resalePrice) || Number(buyBackPrice) * 1.5,
      stockQuantity: 1,
      minimumStockAlertLevel: 1,
      coverImage: coverImage || '',
      createdBy: req.user._id,
    });
    await product.save();

    const buyBackInvoice = new Invoice({
      tenantId,
      flow: 'purchase',
      businessContext: 'bookstore',
      invoiceNumber: `BUYBACK-${Date.now()}`,
      issueDate: new Date(),
      lineItems: [{
        productId: product._id,
        productName: title,
        quantity: 1,
        unitPrice: Number(buyBackPrice),
        lineTotal: Number(buyBackPrice),
        lineTotalWithTax: Number(buyBackPrice),
        taxRate: 0,
      }],
      subtotal: Number(buyBackPrice),
      totalTax: 0,
      grandTotal: Number(buyBackPrice),
      paymentMethod: 'cash',
      customerName: customerName || 'Walk-in',
      customerPhone: customerPhone || '',
      notes: `Buy-back: ${condition || 'good'} condition`,
      status: 'approved',
      createdBy: req.user._id,
    });
    await buyBackInvoice.save();

    res.status(201).json({ success: true, product, invoice: buyBackInvoice });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/used-books', protect, async (req, res) => {
  try {
    const tenantId = await getTargetTenantId(req.user);
    if (!tenantId) return res.status(400).json({ error: 'No tenant found.' });
    const books = await BookStoreProduct.find({ tenantId, isUsedBook: true, isActive: true })
      .sort('-createdAt')
      .lean();
    res.json(books);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- BOOK RENTAL / LENDING ---

router.get('/rentals', protect, async (req, res) => {
  try {
    const tenantId = await getTargetTenantId(req.user);
    if (!tenantId) return res.status(400).json({ error: 'No tenant found.' });

    const { status } = req.query;
    const filter = { tenantId };
    if (status) filter.status = status;

    const rentals = await BookRental.find(filter).sort('-createdAt').lean();
    res.json(rentals);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/rentals', protect, async (req, res) => {
  try {
    const tenantId = await getTargetTenantId(req.user);
    if (!tenantId) return res.status(400).json({ error: 'No tenant found.' });

    const { productId, customerName, customerPhone, customerNameAr, rentalFee, depositAmount, rentalDays, notes } = req.body;

    const product = await BookStoreProduct.findOne({ _id: productId, tenantId });
    if (!product) return res.status(404).json({ error: 'Product not found' });
    if (product.stockQuantity <= 0) return res.status(400).json({ error: 'Book out of stock' });

    const days = parseInt(rentalDays) || product.maxRentalDays || 14;
    const rentDate = new Date();
    const dueDate = new Date(rentDate);
    dueDate.setDate(dueDate.getDate() + days);

    const rental = new BookRental({
      tenantId,
      productId: product._id,
      productName: product.name,
      productIsbn: product.isbn,
      customerName,
      customerPhone: customerPhone || '',
      customerNameAr: customerNameAr || '',
      rentDate,
      dueDate,
      rentalFee: Number(rentalFee) || product.rentalPrice || 0,
      depositAmount: Number(depositAmount) || product.rentalDeposit || 0,
      lateFeePerDay: 5,
      totalCharge: Number(rentalFee) || product.rentalPrice || 0,
      notes: notes || '',
      status: 'active',
      createdBy: req.user._id,
    });
    await rental.save();

    product.stockQuantity -= 1;
    await product.save();

    res.status(201).json({ success: true, rental });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/rentals/:id/return', protect, async (req, res) => {
  try {
    const tenantId = await getTargetTenantId(req.user);
    const rental = await BookRental.findOne({ _id: req.params.id, tenantId });
    if (!rental) return res.status(404).json({ error: 'Rental not found' });
    if (rental.status === 'returned') return res.status(400).json({ error: 'Book already returned' });

    const returnDate = new Date();
    const dueDate = new Date(rental.dueDate);
    const lateDays = Math.max(0, Math.ceil((returnDate - dueDate) / (1000 * 60 * 60 * 24)));
    const lateFee = lateDays * (rental.lateFeePerDay || 5);

    rental.returnDate = returnDate;
    rental.lateFee = lateFee;
    rental.totalCharge = rental.rentalFee + lateFee;
    rental.depositRefunded = true;
    rental.status = 'returned';
    await rental.save();

    await BookStoreProduct.findByIdAndUpdate(rental.productId, { $inc: { stockQuantity: 1 } });

    res.json({ success: true, rental, lateDays, lateFee });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/rentals/:id/mark-lost', protect, async (req, res) => {
  try {
    const tenantId = await getTargetTenantId(req.user);
    const rental = await BookRental.findOne({ _id: req.params.id, tenantId });
    if (!rental) return res.status(404).json({ error: 'Rental not found' });
    if (rental.status === 'returned') return res.status(400).json({ error: 'Book already returned' });

    rental.status = 'lost';
    rental.totalCharge = rental.rentalFee + rental.depositAmount;
    rental.notes = (rental.notes || '') + ' | Marked as lost';
    await rental.save();

    res.json({ success: true, rental });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/rentals/overdue', protect, async (req, res) => {
  try {
    const tenantId = await getTargetTenantId(req.user);
    if (!tenantId) return res.status(400).json({ error: 'No tenant found.' });

    const now = new Date();
    const overdue = await BookRental.find({
      tenantId,
      status: 'active',
      dueDate: { $lt: now },
    }).lean();

    for (const r of overdue) {
      const lateDays = Math.ceil((now - new Date(r.dueDate)) / (1000 * 60 * 60 * 24));
      r.lateDays = lateDays;
      r.estimatedLateFee = lateDays * (r.lateFeePerDay || 5);
    }

    res.json(overdue);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- BUNDLES ---

router.get('/bundles', protect, async (req, res) => {
  try {
    const tenantId = await getTargetTenantId(req.user);
    if (!tenantId) return res.status(400).json({ error: 'No tenant found.' });
    const bundles = await BookStoreProduct.find({ tenantId, productType: 'bundle', isActive: true })
      .populate('bundleItems.productId', 'name nameAr isbn primaryBarcode retailPrice coverImage stockQuantity productType')
      .sort('-createdAt')
      .lean();
    res.json(bundles);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/bundles/:id/items', protect, async (req, res) => {
  try {
    const tenantId = await getTargetTenantId(req.user);
    if (!tenantId) return res.status(400).json({ error: 'No tenant found.' });
    const bundle = await BookStoreProduct.findOne({ _id: req.params.id, tenantId, productType: 'bundle' })
      .populate('bundleItems.productId', 'name nameAr isbn primaryBarcode retailPrice discountPrice coverImage stockQuantity productType taxRate')
      .lean();
    if (!bundle) return res.status(404).json({ error: 'Bundle not found' });
    res.json({ success: true, items: bundle.bundleItems || [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- COURSE ENROLLMENTS ---

router.get('/courses/:id/enrollments', protect, async (req, res) => {
  try {
    const tenantId = await getTargetTenantId(req.user);
    if (!tenantId) return res.status(400).json({ error: 'No tenant found.' });
    const enrollments = await CourseEnrollment.find({ tenantId, courseId: req.params.id })
      .sort('-enrollmentDate')
      .lean();
    res.json(enrollments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/courses/:id/enroll', protect, async (req, res) => {
  try {
    const tenantId = await getTargetTenantId(req.user);
    if (!tenantId) return res.status(400).json({ error: 'No tenant found.' });
    const course = await BookStoreProduct.findOne({ _id: req.params.id, tenantId, productType: 'course' });
    if (!course) return res.status(404).json({ error: 'Course not found' });

    const existingCount = await CourseEnrollment.countDocuments({ tenantId, courseId: course._id, status: { $in: ['enrolled', 'completed'] } });
    if (course.courseCapacity > 0 && existingCount >= course.courseCapacity) {
      return res.status(400).json({ error: 'Course is full' });
    }

    const { studentName, studentNameAr, studentPhone, studentEmail, studentGrade, parentName, parentPhone, paymentStatus, amountPaid, notes } = req.body;
    if (!studentName) return res.status(400).json({ error: 'Student name is required' });

    const enrollment = new CourseEnrollment({
      tenantId,
      courseId: course._id,
      studentName,
      studentNameAr,
      studentPhone,
      studentEmail,
      studentGrade,
      parentName,
      parentPhone,
      paymentStatus: paymentStatus || 'unpaid',
      amountPaid: amountPaid || 0,
      notes,
      enrolledBy: req.user._id,
    });
    await enrollment.save();
    course.courseEnrolledCount = existingCount + 1;
    await course.save();
    res.status(201).json(enrollment);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.put('/enrollments/:id', protect, async (req, res) => {
  try {
    const tenantId = await getTargetTenantId(req.user);
    if (!tenantId) return res.status(400).json({ error: 'No tenant found.' });
    const enrollment = await CourseEnrollment.findOneAndUpdate(
      { _id: req.params.id, tenantId },
      req.body,
      { new: true, runValidators: true }
    );
    if (!enrollment) return res.status(404).json({ error: 'Enrollment not found' });
    res.json(enrollment);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.delete('/enrollments/:id', protect, async (req, res) => {
  try {
    const tenantId = await getTargetTenantId(req.user);
    if (!tenantId) return res.status(400).json({ error: 'No tenant found.' });
    const enrollment = await CourseEnrollment.findOneAndDelete({ _id: req.params.id, tenantId });
    if (!enrollment) return res.status(404).json({ error: 'Enrollment not found' });
    const course = await BookStoreProduct.findById(enrollment.courseId);
    if (course) {
      const activeCount = await CourseEnrollment.countDocuments({ tenantId, courseId: course._id, status: { $in: ['enrolled', 'completed'] } });
      course.courseEnrolledCount = activeCount;
      await course.save();
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- REPORTS: PROFIT MARGINS ---

router.get('/reports/profit-margins', protect, async (req, res) => {
  try {
    const tenantId = await getTargetTenantId(req.user);
    if (!tenantId) return res.status(400).json({ error: 'No tenant found.' });
    const products = await BookStoreProduct.find({ tenantId, isActive: true })
      .select('name productType costPrice retailPrice discountPrice category stockQuantity')
      .lean();
    const data = products.map(p => {
      const sellPrice = (p.discountPrice > 0 ? p.discountPrice : p.retailPrice) || 0;
      const cost = p.costPrice || 0;
      const profit = sellPrice - cost;
      const margin = sellPrice > 0 ? (profit / sellPrice) * 100 : 0;
      return {
        _id: p._id,
        name: p.name,
        productType: p.productType || 'book',
        category: p.category || '—',
        costPrice: cost,
        retailPrice: p.retailPrice || 0,
        discountPrice: p.discountPrice || 0,
        sellPrice,
        profit,
        margin: Math.round(margin * 100) / 100,
        stockQuantity: p.stockQuantity || 0,
        stockValue: cost * (p.stockQuantity || 0),
        potentialRevenue: sellPrice * (p.stockQuantity || 0),
        potentialProfit: profit * (p.stockQuantity || 0),
      };
    });
    data.sort((a, b) => b.margin - a.margin);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- REPORTS: SLOW-MOVING INVENTORY ---

router.get('/reports/slow-moving', protect, async (req, res) => {
  try {
    const tenantId = await getTargetTenantId(req.user);
    if (!tenantId) return res.status(400).json({ error: 'No tenant found.' });
    const { days = 90 } = req.query;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - Number(days));

    const products = await BookStoreProduct.find({ tenantId, isActive: true, stockQuantity: { $gt: 0 } })
      .select('name productType category stockQuantity costPrice retailPrice discountPrice createdAt')
      .lean();

    const productIds = products.map(p => p._id);
    const salesData = await Invoice.aggregate([
      { $match: { tenantId: new mongoose.Types.ObjectId(tenantId), businessContext: 'bookstore', issueDate: { $gte: cutoff } } },
      { $unwind: '$lineItems' },
      { $match: { 'lineItems.productId': { $in: productIds.map(id => new mongoose.Types.ObjectId(id)) } } },
      { $group: { _id: '$lineItems.productId', totalSold: { $sum: '$lineItems.quantity' }, lastSold: { $max: '$issueDate' } } },
    ]);
    const salesMap = {};
    salesData.forEach(s => { salesMap[s._id.toString()] = s; });

    const data = products.map(p => {
      const sale = salesMap[p._id.toString()];
      const sellPrice = (p.discountPrice > 0 ? p.discountPrice : p.retailPrice) || 0;
      return {
        _id: p._id,
        name: p.name,
        productType: p.productType || 'book',
        category: p.category || '—',
        stockQuantity: p.stockQuantity || 0,
        stockValue: (p.costPrice || 0) * (p.stockQuantity || 0),
        sellPrice,
        unitsSold: sale?.totalSold || 0,
        lastSoldDate: sale?.lastSold || null,
        daysSinceLastSale: sale ? Math.ceil((new Date() - new Date(sale.lastSold)) / (1000 * 60 * 60 * 24)) : null,
        isSlowMoving: !sale || sale.totalSold === 0,
      };
    });
    data.sort((a, b) => (b.daysSinceLastSale || 99999) - (a.daysSinceLastSale || 99999));
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- REPORTS: SALES BY CATEGORY ---

router.get('/reports/sales-by-category', protect, async (req, res) => {
  try {
    const tenantId = await getTargetTenantId(req.user);
    if (!tenantId) return res.status(400).json({ error: 'No tenant found.' });
    const { startDate, endDate } = req.query;
    const matchStage = {
      tenantId: new mongoose.Types.ObjectId(tenantId),
      businessContext: 'bookstore',
    };
    if (startDate || endDate) {
      matchStage.issueDate = {};
      if (startDate) matchStage.issueDate.$gte = new Date(startDate);
      if (endDate) matchStage.issueDate.$lte = new Date(endDate);
    }

    const [byCategory, byProductType, byGrade] = await Promise.all([
      Invoice.aggregate([
        { $match: matchStage },
        { $unwind: '$lineItems' },
        { $lookup: { from: 'bookstoreproducts', localField: 'lineItems.productId', foreignField: '_id', as: 'product' } },
        { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
        { $group: {
          _id: { $ifNull: ['$product.category', 'Uncategorized'] },
          totalSold: { $sum: '$lineItems.quantity' },
          revenue: { $sum: { $ifNull: ['$lineItems.lineTotal', 0] } },
          revenueWithTax: { $sum: { $ifNull: ['$lineItems.lineTotalWithTax', 0] } },
          count: { $sum: 1 },
        }},
        { $sort: { revenue: -1 } },
      ]),
      Invoice.aggregate([
        { $match: matchStage },
        { $unwind: '$lineItems' },
        { $lookup: { from: 'bookstoreproducts', localField: 'lineItems.productId', foreignField: '_id', as: 'product' } },
        { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
        { $group: {
          _id: { $ifNull: ['$product.productType', 'book'] },
          totalSold: { $sum: '$lineItems.quantity' },
          revenue: { $sum: { $ifNull: ['$lineItems.lineTotal', 0] } },
          count: { $sum: 1 },
        }},
        { $sort: { revenue: -1 } },
      ]),
      Invoice.aggregate([
        { $match: matchStage },
        { $unwind: '$lineItems' },
        { $lookup: { from: 'bookstoreproducts', localField: 'lineItems.productId', foreignField: '_id', as: 'product' } },
        { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
        { $group: {
          _id: { $ifNull: ['$product.courseLevel', { $ifNull: ['$product.uniformGradeLevel', 'Other'] }] },
          totalSold: { $sum: '$lineItems.quantity' },
          revenue: { $sum: { $ifNull: ['$lineItems.lineTotal', 0] } },
          count: { $sum: 1 },
        }},
        { $sort: { revenue: -1 } },
      ]),
    ]);

    res.json({ byCategory, byProductType, byGrade });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- REPORTS: SALES DASHBOARD ---

router.get('/reports/dashboard', protect, async (req, res) => {
  try {
    const tenantId = await getTargetTenantId(req.user);
    if (!tenantId) return res.status(400).json({ error: 'No tenant found.' });
    const { range = '30d' } = req.query;

    const now = new Date();
    let startDate;
    switch (range) {
      case '7d': startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); break;
      case '30d': startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); break;
      case '90d': startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000); break;
      case '1y': startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000); break;
      default: startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    const matchStage = {
      tenantId: new mongoose.Types.ObjectId(tenantId),
      businessContext: 'bookstore',
      issueDate: { $gte: startDate, $lte: now },
    };

    const [summary, dailySales, topProducts, paymentBreakdown] = await Promise.all([
      Invoice.aggregate([
        { $match: matchStage },
        { $group: {
          _id: null,
          totalRevenue: { $sum: { $ifNull: ['$grandTotal', 0] } },
          totalTax: { $sum: { $ifNull: ['$totalTax', 0] } },
          totalSubtotal: { $sum: { $ifNull: ['$subtotal', 0] } },
          totalDiscount: { $sum: { $ifNull: ['$totalDiscount', 0] } },
          invoiceCount: { $sum: 1 },
          avgInvoiceValue: { $avg: { $ifNull: ['$grandTotal', 0] } },
        }},
      ]),
      Invoice.aggregate([
        { $match: matchStage },
        { $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$issueDate' } },
          revenue: { $sum: { $ifNull: ['$grandTotal', 0] } },
          invoiceCount: { $sum: 1 },
        }},
        { $sort: { _id: 1 } },
      ]),
      Invoice.aggregate([
        { $match: matchStage },
        { $unwind: '$lineItems' },
        { $group: {
          _id: '$lineItems.productName',
          totalSold: { $sum: '$lineItems.quantity' },
          revenue: { $sum: { $ifNull: ['$lineItems.lineTotal', 0] } },
        }},
        { $sort: { totalSold: -1 } },
        { $limit: 10 },
      ]),
      Invoice.aggregate([
        { $match: matchStage },
        { $unwind: { path: '$payments', preserveNullAndEmptyArrays: true } },
        { $group: {
          _id: { $ifNull: ['$payments.method', 'unknown'] },
          total: { $sum: { $ifNull: ['$payments.amount', 0] } },
          count: { $sum: 1 },
        }},
        { $sort: { total: -1 } },
      ]),
    ]);

    res.json({
      summary: summary[0] || { totalRevenue: 0, totalTax: 0, totalSubtotal: 0, totalDiscount: 0, invoiceCount: 0, avgInvoiceValue: 0 },
      dailySales,
      topProducts,
      paymentBreakdown,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- REPORTS: VAT / TAX ---

router.get('/reports/vat', protect, async (req, res) => {
  try {
    const tenantId = await getTargetTenantId(req.user);
    if (!tenantId) return res.status(400).json({ error: 'No tenant found.' });

    const tenant = await Tenant.findById(tenantId).select('business.vatNumber business.legalNameEn business.legalNameAr');
    const { startDate, endDate } = req.query;

    const now = new Date();
    const start = startDate ? new Date(startDate) : new Date(now.getFullYear(), now.getMonth(), 1);
    const end = endDate ? new Date(endDate) : now;

    const matchStage = {
      tenantId: new mongoose.Types.ObjectId(tenantId),
      businessContext: 'bookstore',
      issueDate: { $gte: start, $lte: end },
    };

    const [summary, byTaxRate, invoices] = await Promise.all([
      Invoice.aggregate([
        { $match: matchStage },
        { $group: {
          _id: null,
          totalSubtotal: { $sum: { $ifNull: ['$subtotal', 0] } },
          totalDiscount: { $sum: { $ifNull: ['$totalDiscount', 0] } },
          totalTax: { $sum: { $ifNull: ['$totalTax', 0] } },
          totalGrand: { $sum: { $ifNull: ['$grandTotal', 0] } },
          invoiceCount: { $sum: 1 },
          taxableAmount: { $sum: { $ifNull: ['$subtotal', 0] } },
        }},
      ]),
      Invoice.aggregate([
        { $match: matchStage },
        { $unwind: '$lineItems' },
        { $group: {
          _id: { $ifNull: ['$lineItems.taxRate', 15] },
          taxableAmount: { $sum: { $ifNull: ['$lineItems.lineTotal', 0] } },
          taxAmount: { $sum: { $ifNull: ['$lineItems.taxAmount', 0] } },
          lineCount: { $sum: 1 },
        }},
        { $sort: { _id: 1 } },
      ]),
      Invoice.find(matchStage)
        .select('invoiceNumber issueDate subtotal totalDiscount totalTax grandTotal status')
        .sort('issueDate')
        .limit(500)
        .lean(),
    ]);

    res.json({
      tenant: { vatNumber: tenant?.business?.vatNumber || '', nameEn: tenant?.business?.legalNameEn || '', nameAr: tenant?.business?.legalNameAr || '' },
      period: { startDate: start, endDate: end },
      summary: summary[0] || { totalSubtotal: 0, totalDiscount: 0, totalTax: 0, totalGrand: 0, invoiceCount: 0, taxableAmount: 0 },
      byTaxRate,
      invoices,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
