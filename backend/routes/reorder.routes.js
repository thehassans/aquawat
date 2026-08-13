import express from 'express';
import mongoose from 'mongoose';
import BakalaProduct from '../models/BakalaProduct.js';
import Invoice from '../models/Invoice.js';
import Supplier from '../models/Supplier.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();
router.use(protect);

function getTenantFilter(req) {
  return { tenantId: new mongoose.Types.ObjectId(req.user.tenantId) };
}

// @route   GET /api/bakala/reorder/dashboard
router.get('/dashboard', async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const tenantFilter = getTenantFilter(req);

    // Get all active products below or near their alert level
    const products = await BakalaProduct.find({
      ...tenantFilter,
      isActive: { $ne: false },
    }).select('name nameAr primaryBarcode category brand unit stockQuantity minimumStockAlertLevel costPrice retailPrice barcodes').lean();

    // Calculate sales velocity from invoices
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const salesData = await Invoice.statsAggregate([
      {
        $match: {
          ...tenantFilter,
          businessContext: 'bakala',
          flow: 'sell',
          issueDate: { $gte: startDate },
          status: { $nin: ['draft', 'cancelled', 'credited'] },
        },
      },
      { $unwind: '$lineItems' },
      {
        $group: {
          _id: '$lineItems.productId',
          totalQty: { $sum: { $ifNull: ['$lineItems.quantity', 0] } },
          revenue: { $sum: { $ifNull: ['$lineItems.lineTotal', 0] } },
        },
      },
    ]);

    const salesMap = {};
    salesData.forEach(s => {
      if (s._id) salesMap[s._id.toString()] = { totalQty: s.totalQty, revenue: s.revenue };
    });

    // Get suppliers for matching
    const suppliers = await Supplier.find({ ...tenantFilter, isActive: { $ne: false } })
      .select('name nameAr').lean();
    const supplierMap = {};
    suppliers.forEach(s => { supplierMap[s._id.toString()] = s; });

    const reorderItems = [];
    let totalReorderValue = 0;

    for (const p of products) {
      const stock = Number(p.stockQuantity) || 0;
      const alertLevel = Number(p.minimumStockAlertLevel) || 10;
      const sales = salesMap[p._id?.toString()] || { totalQty: 0, revenue: 0 };

      const dailyVelocity = sales.totalQty / parseInt(days);
      const daysOfStock = dailyVelocity > 0 ? stock / dailyVelocity : Infinity;
      const needsReorder = stock <= alertLevel;

      if (needsReorder) {
        // Suggested reorder qty: cover 30 days of sales, minimum alert level * 2
        const suggestedQty = Math.max(
          Math.ceil(dailyVelocity * 30),
          alertLevel * 2,
          10
        );

        const reorderValue = suggestedQty * (Number(p.costPrice) || 0);
        totalReorderValue += reorderValue;

        reorderItems.push({
          _id: p._id,
          name: p.name,
          nameAr: p.nameAr,
          primaryBarcode: p.primaryBarcode,
          category: p.category,
          brand: p.brand,
          unit: p.unit,
          stockQuantity: stock,
          minimumStockAlertLevel: alertLevel,
          costPrice: Number(p.costPrice) || 0,
          retailPrice: Number(p.retailPrice) || 0,
          salesQty30d: sales.totalQty,
          salesRevenue30d: Math.round(sales.revenue * 100) / 100,
          dailyVelocity: Math.round(dailyVelocity * 100) / 100,
          daysOfStock: daysOfStock === Infinity ? null : Math.round(daysOfStock),
          suggestedReorderQty: suggestedQty,
          reorderValue: Math.round(reorderValue * 100) / 100,
          urgency: stock === 0 ? 'critical' : stock <= alertLevel * 0.5 ? 'high' : 'medium',
        });
      }
    }

    // Sort by urgency then by daysOfStock
    const urgencyOrder = { critical: 0, high: 1, medium: 2 };
    reorderItems.sort((a, b) => {
      if (urgencyOrder[a.urgency] !== urgencyOrder[b.urgency]) {
        return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
      }
      return (a.daysOfStock ?? 999) - (b.daysOfStock ?? 999);
    });

    res.json({
      generatedAt: new Date().toISOString(),
      summary: {
        totalProducts: products.length,
        needsReorder: reorderItems.length,
        criticalCount: reorderItems.filter(i => i.urgency === 'critical').length,
        totalReorderValue: Math.round(totalReorderValue * 100) / 100,
      },
      suppliers: suppliers.map(s => ({ _id: s._id, name: s.name, nameAr: s.nameAr })),
      reorderItems,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
