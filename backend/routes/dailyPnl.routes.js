import express from 'express';
import mongoose from 'mongoose';
import DailyPnL from '../models/DailyPnL.js';
import Invoice from '../models/Invoice.js';
import BakalaProduct from '../models/BakalaProduct.js';
import { protect, tenantFilter, requireTenantFilter } from '../middleware/auth.js';

const router = express.Router();
router.use(protect);
router.use(tenantFilter);
router.use(requireTenantFilter);

function getTenantFilter(req) {
  return { tenantId: new mongoose.Types.ObjectId(req.user.tenantId) };
}

function getDateOnly(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

// @route   GET /api/bakala/pnl/daily?date=YYYY-MM-DD
router.get('/daily', async (req, res) => {
  try {
    const dateStr = req.query.date || new Date().toISOString().split('T')[0];
    const date = getDateOnly(dateStr);
    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);

    const tenantFilter = getTenantFilter(req);

    // Get or create daily PnL record
    let pnl = await DailyPnL.findOne({ ...tenantFilter, date });

    // Aggregate sales from invoices for this day
    const salesAgg = await Invoice.statsAggregate([
      {
        $match: {
          ...tenantFilter,
          businessContext: 'bakala',
          flow: 'sell',
          issueDate: { $gte: date, $lt: nextDay },
          status: { $nin: ['draft', 'cancelled'] },
        },
      },
      {
        $group: {
          _id: null,
          totalSales: { $sum: { $ifNull: ['$grandTotal', 0] } },
          salesCount: { $sum: 1 },
          cashSales: { $sum: { $cond: [{ $eq: ['$paymentMethod', 'cash'] }, { $ifNull: ['$grandTotal', 0] }, 0] } },
          cardSales: { $sum: { $cond: [{ $eq: ['$paymentMethod', 'card'] }, { $ifNull: ['$grandTotal', 0] }, 0] } },
          khataSales: { $sum: { $cond: [{ $eq: ['$paymentMethod', 'khata'] }, { $ifNull: ['$grandTotal', 0] }, 0] } },
          splitSales: { $sum: { $cond: [{ $eq: ['$paymentMethod', 'split'] }, { $ifNull: ['$grandTotal', 0] }, 0] } },
        },
      },
    ]);

    // Get sales returns
    const returnsAgg = await Invoice.statsAggregate([
      {
        $match: {
          ...tenantFilter,
          businessContext: 'bakala',
          flow: 'sell',
          issueDate: { $gte: date, $lt: nextDay },
          status: 'credited',
        },
      },
      { $group: { _id: null, totalReturns: { $sum: { $ifNull: ['$grandTotal', 0] } } } },
    ]);

    // Calculate COGS from line items
    const lineItems = await Invoice.statsAggregate([
      {
        $match: {
          ...tenantFilter,
          businessContext: 'bakala',
          flow: 'sell',
          issueDate: { $gte: date, $lt: nextDay },
          status: { $nin: ['draft', 'cancelled'] },
        },
      },
      { $unwind: '$lineItems' },
      {
        $lookup: {
          from: 'bakalaproducts',
          localField: 'lineItems.productId',
          foreignField: '_id',
          as: 'product',
        },
      },
      { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: null,
          cogs: {
            $sum: {
              $multiply: [
                { $ifNull: ['$lineItems.quantity', 0] },
                { $ifNull: ['$product.costPrice', 0] },
              ],
            },
          },
        },
      },
    ]);

    const sales = salesAgg[0] || { totalSales: 0, salesCount: 0, cashSales: 0, cardSales: 0, khataSales: 0, splitSales: 0 };
    const returns = returnsAgg[0]?.totalReturns || 0;
    const cogs = Math.round((lineItems[0]?.cogs || 0) * 100) / 100;
    const netSales = (sales.totalSales || 0) - returns;
    const grossProfit = netSales - cogs;

    // Get cash movements for this day (if pnl exists)
    const cashMovements = pnl?.cashMovements || [];
    const totalExpenses = cashMovements
      .filter(m => m.type === 'out')
      .reduce((s, m) => s + m.amount, 0);
    const cashIn = cashMovements
      .filter(m => m.type === 'in')
      .reduce((s, m) => s + m.amount, 0);
    const cashOut = cashMovements
      .filter(m => m.type === 'out')
      .reduce((s, m) => s + m.amount, 0);

    const expensesByCategory = {};
    cashMovements.filter(m => m.type === 'out').forEach(m => {
      expensesByCategory[m.category] = (expensesByCategory[m.category] || 0) + m.amount;
    });

    const netProfit = grossProfit - totalExpenses;
    const netCashFlow = cashIn - cashOut + sales.cashSales;

    res.json({
      date: date.toISOString(),
      sales: {
        totalSales: Math.round((sales.totalSales || 0) * 100) / 100,
        salesCount: sales.salesCount || 0,
        cashSales: Math.round((sales.cashSales || 0) * 100) / 100,
        cardSales: Math.round((sales.cardSales || 0) * 100) / 100,
        khataSales: Math.round((sales.khataSales || 0) * 100) / 100,
        splitSales: Math.round((sales.splitSales || 0) * 100) / 100,
        salesReturns: Math.round(returns * 100) / 100,
        netSales: Math.round(netSales * 100) / 100,
      },
      cogs,
      grossProfit: Math.round(grossProfit * 100) / 100,
      grossMargin: netSales > 0 ? Math.round((grossProfit / netSales) * 10000) / 100 : 0,
      expenses: {
        total: Math.round(totalExpenses * 100) / 100,
        byCategory: expensesByCategory,
      },
      netProfit: Math.round(netProfit * 100) / 100,
      cash: {
        cashIn: Math.round(cashIn * 100) / 100,
        cashOut: Math.round(cashOut * 100) / 100,
        netCashFlow: Math.round(netCashFlow * 100) / 100,
      },
      cashMovements,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   GET /api/bakala/pnl/monthly?month=YYYY-MM
router.get('/monthly', async (req, res) => {
  try {
    const monthStr = req.query.month || new Date().toISOString().slice(0, 7);
    const [year, month] = monthStr.split('-').map(Number);
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 1);

    const tenantFilter = getTenantFilter(req);

    // Daily breakdown
    const dailySales = await Invoice.statsAggregate([
      {
        $match: {
          ...tenantFilter,
          businessContext: 'bakala',
          flow: 'sell',
          issueDate: { $gte: startDate, $lt: endDate },
          status: { $nin: ['draft', 'cancelled'] },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$issueDate' } },
          totalSales: { $sum: { $ifNull: ['$grandTotal', 0] } },
          salesCount: { $sum: 1 },
          cashSales: { $sum: { $cond: [{ $eq: ['$paymentMethod', 'cash'] }, { $ifNull: ['$grandTotal', 0] }, 0] } },
          cardSales: { $sum: { $cond: [{ $eq: ['$paymentMethod', 'card'] }, { $ifNull: ['$grandTotal', 0] }, 0] } },
          khataSales: { $sum: { $cond: [{ $eq: ['$paymentMethod', 'khata'] }, { $ifNull: ['$grandTotal', 0] }, 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Monthly COGS
    const monthlyCogs = await Invoice.statsAggregate([
      {
        $match: {
          ...tenantFilter,
          businessContext: 'bakala',
          flow: 'sell',
          issueDate: { $gte: startDate, $lt: endDate },
          status: { $nin: ['draft', 'cancelled'] },
        },
      },
      { $unwind: '$lineItems' },
      {
        $lookup: {
          from: 'bakalaproducts',
          localField: 'lineItems.productId',
          foreignField: '_id',
          as: 'product',
        },
      },
      { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: null,
          cogs: { $sum: { $multiply: [{ $ifNull: ['$lineItems.quantity', 0] }, { $ifNull: ['$product.costPrice', 0] }] } },
        },
      },
    ]);

    // Monthly expenses from DailyPnL records
    const monthlyExpenses = await DailyPnL.aggregate([
      { $match: { ...tenantFilter, date: { $gte: startDate, $lt: endDate } } },
      { $unwind: '$cashMovements' },
      { $match: { 'cashMovements.type': 'out' } },
      {
        $group: {
          _id: '$cashMovements.category',
          total: { $sum: '$cashMovements.amount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { total: -1 } },
    ]);

    // Monthly totals
    const totalSales = dailySales.reduce((s, d) => s + d.totalSales, 0);
    const totalCogs = Math.round((monthlyCogs[0]?.cogs || 0) * 100) / 100;
    const grossProfit = totalSales - totalCogs;
    const totalExpenses = monthlyExpenses.reduce((s, e) => s + e.total, 0);
    const netProfit = grossProfit - totalExpenses;

    // Top products by profit
    const topProducts = await Invoice.statsAggregate([
      {
        $match: {
          ...tenantFilter,
          businessContext: 'bakala',
          flow: 'sell',
          issueDate: { $gte: startDate, $lt: endDate },
          status: { $nin: ['draft', 'cancelled'] },
        },
      },
      { $unwind: '$lineItems' },
      {
        $group: {
          _id: { $ifNull: ['$lineItems.productName', 'Unknown'] },
          revenue: { $sum: { $ifNull: ['$lineItems.lineTotal', 0] } },
          quantity: { $sum: { $ifNull: ['$lineItems.quantity', 0] } },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: 10 },
    ]);

    res.json({
      month: monthStr,
      summary: {
        totalSales: Math.round(totalSales * 100) / 100,
        totalCogs,
        grossProfit: Math.round(grossProfit * 100) / 100,
        grossMargin: totalSales > 0 ? Math.round((grossProfit / totalSales) * 10000) / 100 : 0,
        totalExpenses: Math.round(totalExpenses * 100) / 100,
        netProfit: Math.round(netProfit * 100) / 100,
        netMargin: totalSales > 0 ? Math.round((netProfit / totalSales) * 10000) / 100 : 0,
        salesCount: dailySales.reduce((s, d) => s + d.salesCount, 0),
      },
      dailySales: dailySales.map(d => ({
        date: d._id,
        totalSales: Math.round(d.totalSales * 100) / 100,
        salesCount: d.salesCount,
        cashSales: Math.round(d.cashSales * 100) / 100,
        cardSales: Math.round(d.cardSales * 100) / 100,
        khataSales: Math.round(d.khataSales * 100) / 100,
      })),
      expensesByCategory: monthlyExpenses.map(e => ({
        category: e._id,
        total: Math.round(e.total * 100) / 100,
        count: e.count,
      })),
      topProducts: topProducts.map(p => ({
        name: p._id,
        revenue: Math.round(p.revenue * 100) / 100,
        quantity: p.quantity,
      })),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   POST /api/bakala/pnl/cash-movement
router.post('/cash-movement', async (req, res) => {
  try {
    const { type, amount, category, description, reference, paymentMethod, date } = req.body;
    if (!type || !amount || !category) {
      return res.status(400).json({ error: 'Type, amount, and category are required' });
    }

    const movementDate = getDateOnly(date || new Date());
    const tenantFilter = getTenantFilter(req);

    let pnl = await DailyPnL.findOne({ ...tenantFilter, date: movementDate });
    if (!pnl) {
      pnl = new DailyPnL({ tenantId: req.user.tenantId, date: movementDate, cashMovements: [] });
    }

    pnl.cashMovements.push({
      type,
      amount: Number(amount),
      category,
      description: description || '',
      reference: reference || '',
      paymentMethod: paymentMethod || 'cash',
      recordedBy: req.user._id,
    });

    await pnl.save();
    res.status(201).json(pnl.cashMovements[pnl.cashMovements.length - 1]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   DELETE /api/bakala/pnl/cash-movement/:id?date=YYYY-MM-DD
router.delete('/cash-movement/:id', async (req, res) => {
  try {
    const dateStr = req.query.date;
    if (!dateStr) return res.status(400).json({ error: 'Date query param is required' });

    const date = getDateOnly(dateStr);
    const pnl = await DailyPnL.findOne({
      ...getTenantFilter(req),
      date,
    });

    if (!pnl) return res.status(404).json({ error: 'Daily PnL record not found' });

    const movement = pnl.cashMovements.id(req.params.id);
    if (!movement) return res.status(404).json({ error: 'Cash movement not found' });

    movement.deleteOne();
    await pnl.save();
    res.json({ message: 'Cash movement deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   GET /api/bakala/pnl/cash-flow?days=30
router.get('/cash-flow', async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const tenantFilter = getTenantFilter(req);
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    // Daily cash flow from sales + manual movements
    const dailyData = await Invoice.statsAggregate([
      {
        $match: {
          ...tenantFilter,
          businessContext: 'bakala',
          flow: 'sell',
          issueDate: { $gte: startDate, $lte: endDate },
          status: { $nin: ['draft', 'cancelled'] },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$issueDate' } },
          cashIn: { $sum: { $cond: [{ $eq: ['$paymentMethod', 'cash'] }, { $ifNull: ['$grandTotal', 0] }, 0] } },
          cardIn: { $sum: { $cond: [{ $eq: ['$paymentMethod', 'card'] }, { $ifNull: ['$grandTotal', 0] }, 0] } },
          khataIn: { $sum: { $cond: [{ $eq: ['$paymentMethod', 'khata'] }, { $ifNull: ['$grandTotal', 0] }, 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Manual cash movements
    const manualMovements = await DailyPnL.aggregate([
      { $match: { ...tenantFilter, date: { $gte: startDate, $lte: endDate } } },
      { $unwind: '$cashMovements' },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
          manualIn: { $sum: { $cond: [{ $eq: ['$cashMovements.type', 'in'] }, '$cashMovements.amount', 0] } },
          manualOut: { $sum: { $cond: [{ $eq: ['$cashMovements.type', 'out'] }, '$cashMovements.amount', 0] } },
        },
      },
    ]);

    const manualMap = {};
    manualMovements.forEach(m => {
      manualMap[m._id] = { manualIn: m.manualIn, manualOut: m.manualOut };
    });

    const chartData = dailyData.map(d => {
      const manual = manualMap[d._id] || { manualIn: 0, manualOut: 0 };
      return {
        date: d._id,
        cashIn: Math.round((d.cashIn + manual.manualIn) * 100) / 100,
        cashOut: Math.round(manual.manualOut * 100) / 100,
        cardIn: Math.round(d.cardIn * 100) / 100,
        khataIn: Math.round(d.khataIn * 100) / 100,
        net: Math.round((d.cashIn + manual.manualIn - manual.manualOut) * 100) / 100,
      };
    });

    const totalCashIn = chartData.reduce((s, d) => s + d.cashIn, 0);
    const totalCashOut = chartData.reduce((s, d) => s + d.cashOut, 0);
    const totalCard = chartData.reduce((s, d) => s + d.cardIn, 0);
    const totalKhata = chartData.reduce((s, d) => s + d.khataIn, 0);

    res.json({
      summary: {
        totalCashIn: Math.round(totalCashIn * 100) / 100,
        totalCashOut: Math.round(totalCashOut * 100) / 100,
        netCashFlow: Math.round((totalCashIn - totalCashOut) * 100) / 100,
        totalCard: Math.round(totalCard * 100) / 100,
        totalKhata: Math.round(totalKhata * 100) / 100,
      },
      chartData,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
