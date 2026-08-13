import express from 'express';
import mongoose from 'mongoose';
import BakalaProduct from '../models/BakalaProduct.js';
import WasteEntry from '../models/WasteEntry.js';
import Invoice from '../models/Invoice.js';
import { protect, tenantFilter, requireTenantFilter } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);
router.use(tenantFilter);
router.use(requireTenantFilter);

function getTenantFilter(req) {
  return { tenantId: new mongoose.Types.ObjectId(req.user.tenantId) };
}

// @route   GET /api/bakala/expiry-dashboard
router.get('/expiry-dashboard', async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const tenantFilter = getTenantFilter(req);

    const now = new Date();
    const dayMs = 24 * 60 * 60 * 1000;
    const d7 = new Date(now.getTime() + 7 * dayMs);
    const d14 = new Date(now.getTime() + 14 * dayMs);
    const d30 = new Date(now.getTime() + parseInt(days) * dayMs);

    const products = await BakalaProduct.find({
      ...tenantFilter,
      isActive: { $ne: false },
      expiryDate: { $exists: true, $ne: null },
      stockQuantity: { $gt: 0 },
    })
      .select('name nameAr primaryBarcode category brand unit stockQuantity costPrice retailPrice expiryDate batchNumber minimumStockAlertLevel')
      .lean();

    const expired = [];
    const expiring7 = [];
    const expiring14 = [];
    const expiring30 = [];

    let totalValueAtRisk = 0;
    let expiredValue = 0;

    for (const p of products) {
      const exp = new Date(p.expiryDate);
      const cost = Number(p.costPrice) || 0;
      const stock = Number(p.stockQuantity) || 0;
      const valueAtRisk = stock * cost;

      if (exp <= now) {
        expired.push({ ...p, daysOverdue: Math.floor((now - exp) / dayMs) });
        expiredValue += valueAtRisk;
        totalValueAtRisk += valueAtRisk;
      } else if (exp <= d7) {
        expiring7.push({ ...p, daysLeft: Math.ceil((exp - now) / dayMs) });
        totalValueAtRisk += valueAtRisk;
      } else if (exp <= d14) {
        expiring14.push({ ...p, daysLeft: Math.ceil((exp - now) / dayMs) });
      } else if (exp <= d30) {
        expiring30.push({ ...p, daysLeft: Math.ceil((exp - now) / dayMs) });
      }
    }

    expired.sort((a, b) => a.daysOverdue - b.daysOverdue);
    expiring7.sort((a, b) => a.daysLeft - b.daysLeft);
    expiring14.sort((a, b) => a.daysLeft - b.daysLeft);
    expiring30.sort((a, b) => a.daysLeft - b.daysLeft);

    res.json({
      generatedAt: now.toISOString(),
      summary: {
        totalProducts: products.length,
        expired: expired.length,
        expiring7: expiring7.length,
        expiring14: expiring14.length,
        expiring30: expiring30.length,
        totalValueAtRisk: Math.round(totalValueAtRisk * 100) / 100,
        expiredValue: Math.round(expiredValue * 100) / 100,
      },
      expired,
      expiring7,
      expiring14,
      expiring30,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   GET /api/bakala/waste/stats
router.get('/waste/stats', async (req, res) => {
  try {
    const { months = 6 } = req.query;
    const tenantFilter = getTenantFilter(req);
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - parseInt(months));

    const stats = await WasteEntry.aggregate([
      { $match: { ...tenantFilter, recordedAt: { $gte: startDate } } },
      {
        $facet: {
          totals: [{
            $group: {
              _id: null,
              totalEntries: { $sum: 1 },
              totalQuantity: { $sum: '$quantity' },
              totalWasteValue: { $sum: '$wasteValue' },
            },
          }],
          byReason: [
            { $group: { _id: '$reason', count: { $sum: 1 }, value: { $sum: '$wasteValue' } } },
            { $sort: { value: -1 } },
          ],
          byAction: [
            { $group: { _id: '$action', count: { $sum: 1 }, value: { $sum: '$wasteValue' } } },
          ],
          byMonth: [
            {
              $group: {
                _id: { $dateToString: { format: '%Y-%m', date: '$recordedAt' } },
                count: { $sum: 1 },
                value: { $sum: '$wasteValue' },
              },
            },
            { $sort: { _id: 1 } },
          ],
          byProduct: [
            { $group: { _id: '$productName', count: { $sum: 1 }, quantity: { $sum: '$quantity' }, value: { $sum: '$wasteValue' } } },
            { $sort: { value: -1 } },
            { $limit: 10 },
          ],
        },
      },
    ]);

    res.json(stats[0] || {});
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   GET /api/bakala/waste
router.get('/waste', async (req, res) => {
  try {
    const { page = 1, limit = 25, reason, startDate, endDate } = req.query;
    const tenantFilter = getTenantFilter(req);
    const query = { ...tenantFilter };

    if (reason) query.reason = reason;
    if (startDate || endDate) {
      query.recordedAt = {};
      if (startDate) query.recordedAt.$gte = new Date(startDate);
      if (endDate) query.recordedAt.$lte = new Date(endDate);
    }

    const [entries, total] = await Promise.all([
      WasteEntry.find(query)
        .populate('recordedBy', 'firstName lastName')
        .sort({ recordedAt: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit)),
      WasteEntry.countDocuments(query),
    ]);

    res.json({
      entries,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   POST /api/bakala/waste
router.post('/waste', async (req, res) => {
  try {
    const product = await BakalaProduct.findOne({
      _id: req.body.productId,
      ...getTenantFilter(req),
    }).select('name nameAr primaryBarcode category unit costPrice retailPrice stockQuantity expiryDate batchNumber');

    if (!product) return res.status(404).json({ error: 'Product not found' });

    const qty = Number(req.body.quantity) || 0;
    if (qty <= 0) return res.status(400).json({ error: 'Quantity must be positive' });
    if (qty > product.stockQuantity) {
      return res.status(400).json({ error: `Only ${product.stockQuantity} ${product.unit} in stock` });
    }

    const cost = Number(product.costPrice) || 0;
    const wasteValue = Math.round(qty * cost * 100) / 100;

    const entry = await WasteEntry.create({
      tenantId: req.user.tenantId,
      productId: product._id,
      productName: product.name,
      primaryBarcode: product.primaryBarcode,
      category: product.category,
      quantity: qty,
      unit: product.unit,
      costPrice: cost,
      retailPrice: Number(product.retailPrice) || 0,
      wasteValue,
      reason: req.body.reason || 'expired',
      reasonDetail: req.body.reasonDetail || '',
      batchNumber: req.body.batchNumber || product.batchNumber,
      expiryDate: req.body.expiryDate || product.expiryDate,
      action: req.body.action || 'disposed',
      discountPercent: Number(req.body.discountPercent) || 0,
      recordedBy: req.user._id,
      notes: req.body.notes || '',
    });

    // Reduce stock
    product.stockQuantity = Math.max(0, product.stockQuantity - qty);
    await product.save();

    res.status(201).json(entry);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   POST /api/bakala/waste/:id/discount
router.post('/waste/:id/discount', async (req, res) => {
  try {
    const { discountPercent } = req.body;
    const pct = Math.min(Math.max(Number(discountPercent) || 0, 0), 100);

    const entry = await WasteEntry.findOne({
      _id: req.params.id,
      ...getTenantFilter(req),
    });

    if (!entry) return res.status(404).json({ error: 'Waste entry not found' });
    if (entry.action !== 'discounted') {
      return res.status(400).json({ error: 'Only entries marked for discount can be updated' });
    }

    entry.discountPercent = pct;
    await entry.save();

    // Update product retail price with discount
    const product = await BakalaProduct.findOne({
      _id: entry.productId,
      ...getTenantFilter(req),
    });

    if (product) {
      const newPrice = Math.round((product.retailPrice * (1 - pct / 100)) * 100) / 100;
      product.retailPrice = newPrice;
      await product.save();
    }

    res.json({ message: `Discount of ${pct}% applied`, entry, newPrice: product?.retailPrice });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   DELETE /api/bakala/waste/:id
router.delete('/waste/:id', async (req, res) => {
  try {
    const entry = await WasteEntry.findOne({
      _id: req.params.id,
      ...getTenantFilter(req),
    });

    if (!entry) return res.status(404).json({ error: 'Waste entry not found' });

    // Restore stock
    const product = await BakalaProduct.findOne({
      _id: entry.productId,
      ...getTenantFilter(req),
    });

    if (product) {
      product.stockQuantity += entry.quantity;
      await product.save();
    }

    await WasteEntry.deleteOne({ _id: entry._id });
    res.json({ message: 'Waste entry deleted, stock restored' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
