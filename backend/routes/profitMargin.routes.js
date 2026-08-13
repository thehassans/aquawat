import express from 'express';
import mongoose from 'mongoose';
import BakalaProduct from '../models/BakalaProduct.js';
import Invoice from '../models/Invoice.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();
router.use(protect);

function getTenantFilter(req) {
  return { tenantId: new mongoose.Types.ObjectId(req.user.tenantId) };
}

// @route   GET /api/bakala/margins/overview
router.get('/overview', async (req, res) => {
  try {
    const { months = 6 } = req.query;
    const tenantFilter = getTenantFilter(req);

    // Product-level margins
    const products = await BakalaProduct.find({
      ...tenantFilter,
      isActive: { $ne: false },
    }).select('name primaryBarcode category costPrice retailPrice stockQuantity unit').lean();

    let totalCostValue = 0;
    let totalRetailValue = 0;
    let totalPotentialProfit = 0;
    let lowMarginCount = 0;
    let negativeMarginCount = 0;
    const categoryStats = {};

    const productMargins = products.map(p => {
      const cost = Number(p.costPrice) || 0;
      const retail = Number(p.retailPrice) || 0;
      const margin = retail > 0 ? ((retail - cost) / retail) * 100 : 0;
      const profitPerUnit = retail - cost;
      const stockValueCost = cost * (p.stockQuantity || 0);
      const stockValueRetail = retail * (p.stockQuantity || 0);
      const potentialProfit = profitPerUnit * (p.stockQuantity || 0);

      totalCostValue += stockValueCost;
      totalRetailValue += stockValueRetail;
      totalPotentialProfit += potentialProfit;

      if (margin < 0) negativeMarginCount++;
      else if (margin < 15) lowMarginCount++;

      const cat = p.category || 'uncategorized';
      if (!categoryStats[cat]) {
        categoryStats[cat] = { count: 0, totalCost: 0, totalRetail: 0, totalProfit: 0 };
      }
      categoryStats[cat].count++;
      categoryStats[cat].totalCost += stockValueCost;
      categoryStats[cat].totalRetail += stockValueRetail;
      categoryStats[cat].totalProfit += potentialProfit;

      return {
        _id: p._id,
        name: p.name,
        primaryBarcode: p.primaryBarcode,
        category: cat,
        costPrice: cost,
        retailPrice: retail,
        margin: Math.round(margin * 100) / 100,
        profitPerUnit: Math.round(profitPerUnit * 100) / 100,
        stockQuantity: p.stockQuantity || 0,
        stockValueCost: Math.round(stockValueCost * 100) / 100,
        stockValueRetail: Math.round(stockValueRetail * 100) / 100,
        potentialProfit: Math.round(potentialProfit * 100) / 100,
      };
    });

    // Sales-based profit from invoices
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - parseInt(months));

    const salesProfit = await Invoice.statsAggregate([
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
          _id: { $dateToString: { format: '%Y-%m', date: '$issueDate' } },
          revenue: { $sum: { $ifNull: ['$lineItems.lineTotal', 0] } },
          tax: { $sum: { $ifNull: ['$lineItems.taxAmount', 0] } },
          lineItems: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Top/bottom margin products
    const sortedByMargin = [...productMargins].sort((a, b) => a.margin - b.margin);
    const worstMargins = sortedByMargin.slice(0, 10);
    const bestMargins = sortedByMargin.reverse().slice(0, 10);

    // Category breakdown
    const byCategory = Object.entries(categoryStats).map(([cat, s]) => ({
      category: cat,
      count: s.count,
      avgMargin: s.totalRetail > 0 ? Math.round(((s.totalRetail - s.totalCost) / s.totalRetail) * 10000) / 100 : 0,
      totalProfit: Math.round(s.totalProfit * 100) / 100,
      stockValue: Math.round(s.totalRetail * 100) / 100,
    })).sort((a, b) => b.totalProfit - a.totalProfit);

    res.json({
      summary: {
        totalProducts: products.length,
        totalCostValue: Math.round(totalCostValue * 100) / 100,
        totalRetailValue: Math.round(totalRetailValue * 100) / 100,
        totalPotentialProfit: Math.round(totalPotentialProfit * 100) / 100,
        avgMargin: totalRetailValue > 0 ? Math.round(((totalRetailValue - totalCostValue) / totalRetailValue) * 10000) / 100 : 0,
        lowMarginCount,
        negativeMarginCount,
      },
      byCategory,
      bestMargins,
      worstMargins,
      salesProfit,
      productMargins: productMargins.sort((a, b) => b.potentialProfit - a.potentialProfit),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
