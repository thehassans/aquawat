import express from 'express';
import mongoose from 'mongoose';
import RestaurantCombo from '../models/RestaurantCombo.js';
import RestaurantMenuItem from '../models/RestaurantMenuItem.js';
import RestaurantOrder from '../models/RestaurantOrder.js';
import { protect, tenantFilter, checkPermission, requireBusinessType, requireTenantFilter } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);
router.use(tenantFilter);
router.use(requireTenantFilter);
router.use(requireBusinessType('restaurant'));

function getTenantFilter(req) {
  return { tenantId: new mongoose.Types.ObjectId(req.user.tenantId) };
}

// @route   GET /api/restaurant/combos
router.get('/', checkPermission('restaurant', 'read'), async (req, res) => {
  try {
    const { type, isActive = 'true', page = 1, limit = 50 } = req.query;
    const query = { ...getTenantFilter(req) };

    if (isActive === 'false') query.isActive = false;
    else if (isActive === 'all') {} else query.isActive = true;

    if (type) query.type = type;

    const [combos, total] = await Promise.all([
      RestaurantCombo.find(query).sort({ sortOrder: 1, createdAt: -1 }).skip((page - 1) * limit).limit(parseInt(limit)),
      RestaurantCombo.countDocuments(query),
    ]);

    res.json({ combos, pagination: { page: parseInt(page), limit: parseInt(limit), total } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   GET /api/restaurant/combos/active
router.get('/active', checkPermission('restaurant', 'read'), async (req, res) => {
  try {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const combos = await RestaurantCombo.find({
      ...getTenantFilter(req),
      isActive: true,
      $or: [
        { isTimeLimited: false },
        {
          isTimeLimited: true,
          timeSlots: {
            $elemMatch: {
              daysOfWeek: dayOfWeek,
              startTime: { $lte: currentTime },
              endTime: { $gte: currentTime },
            },
          },
        },
      ],
    }).sort({ sortOrder: 1 });

    // Filter out expired seasonal
    const valid = combos.filter(c => {
      if (c.startDate && new Date(c.startDate) > now) return false;
      if (c.endDate && new Date(c.endDate) < now) return false;
      if (c.totalQuantityLimit > 0 && c.usedCount >= c.totalQuantityLimit) return false;
      return true;
    });

    res.json(valid);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   POST /api/restaurant/combos
router.post('/', checkPermission('restaurant', 'create'), async (req, res) => {
  try {
    const { items = [] } = req.body;

    // Enrich items with menu item data
    const enrichedItems = [];
    let originalTotal = 0;

    for (const item of items) {
      if (item.menuItemId) {
        const mi = await RestaurantMenuItem.findOne({ _id: item.menuItemId, ...getTenantFilter(req) });
        if (mi) {
          enrichedItems.push({
            ...item,
            name: mi.nameEn,
            nameAr: mi.nameAr,
            unitPrice: mi.sellingPrice,
          });
          originalTotal += mi.sellingPrice * (item.quantity || 1);
        }
      } else {
        enrichedItems.push(item);
        originalTotal += (item.unitPrice || 0) * (item.quantity || 1);
      }
    }

    const comboPrice = Number(req.body.comboPrice) || 0;
    const discountAmount = Math.max(0, originalTotal - comboPrice);
    const discountPercent = originalTotal > 0 ? Math.round((discountAmount / originalTotal) * 100 * 10) / 10 : 0;

    const combo = await RestaurantCombo.create({
      ...req.body,
      items: enrichedItems,
      originalTotal,
      discountAmount,
      discountPercent,
      tenantId: req.user.tenantId,
      createdBy: req.user._id,
    });

    res.status(201).json(combo);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   PUT /api/restaurant/combos/:id
router.put('/:id', checkPermission('restaurant', 'update'), async (req, res) => {
  try {
    const { items = [] } = req.body;

    let enrichedItems = req.body.items;
    let originalTotal = req.body.originalTotal;

    if (items.length > 0 && items.some(i => i.menuItemId)) {
      enrichedItems = [];
      originalTotal = 0;
      for (const item of items) {
        if (item.menuItemId) {
          const mi = await RestaurantMenuItem.findOne({ _id: item.menuItemId, ...getTenantFilter(req) });
          if (mi) {
            enrichedItems.push({ ...item, name: mi.nameEn, nameAr: mi.nameAr, unitPrice: mi.sellingPrice });
            originalTotal += mi.sellingPrice * (item.quantity || 1);
          }
        } else {
          enrichedItems.push(item);
          originalTotal += (item.unitPrice || 0) * (item.quantity || 1);
        }
      }
    }

    const comboPrice = Number(req.body.comboPrice) || 0;
    const discountAmount = Math.max(0, (originalTotal || 0) - comboPrice);
    const discountPercent = (originalTotal || 0) > 0 ? Math.round((discountAmount / originalTotal) * 100 * 10) / 10 : 0;

    const combo = await RestaurantCombo.findOneAndUpdate(
      { _id: req.params.id, ...getTenantFilter(req) },
      { ...req.body, items: enrichedItems, originalTotal, discountAmount, discountPercent },
      { new: true, runValidators: true }
    );

    if (!combo) return res.status(404).json({ error: 'Combo not found' });
    res.json(combo);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   DELETE /api/restaurant/combos/:id
router.delete('/:id', checkPermission('restaurant', 'delete'), async (req, res) => {
  try {
    const combo = await RestaurantCombo.findOneAndUpdate(
      { _id: req.params.id, ...getTenantFilter(req) },
      { isActive: false },
      { new: true }
    );
    if (!combo) return res.status(404).json({ error: 'Combo not found' });
    res.json({ message: 'Combo deactivated', combo });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   POST /api/restaurant/combos/:id/apply
router.post('/:id/apply', checkPermission('restaurant', 'create'), async (req, res) => {
  try {
    const combo = await RestaurantCombo.findOne({ _id: req.params.id, ...getTenantFilter(req), isActive: true });
    if (!combo) return res.status(404).json({ error: 'Combo not found or inactive' });

    // Check time validity
    if (combo.isTimeLimited) {
      const now = new Date();
      const dayOfWeek = now.getDay();
      const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const validSlot = combo.timeSlots.some(slot =>
        slot.daysOfWeek?.includes(dayOfWeek) &&
        slot.startTime <= currentTime &&
        slot.endTime >= currentTime
      );
      if (!validSlot) return res.status(400).json({ error: 'Combo not available at this time' });
    }

    // Check date range
    const now = new Date();
    if (combo.startDate && new Date(combo.startDate) > now) return res.status(400).json({ error: 'Combo not yet available' });
    if (combo.endDate && new Date(combo.endDate) < now) return res.status(400).json({ error: 'Combo expired' });

    // Check usage limits
    if (combo.totalQuantityLimit > 0 && combo.usedCount >= combo.totalQuantityLimit) {
      return res.status(400).json({ error: 'Combo sold out' });
    }

    // Return combo line items for POS integration
    const lineItems = combo.items.map(item => ({
      menuItemId: item.menuItemId || undefined,
      name: item.name,
      nameAr: item.nameAr,
      quantity: item.quantity,
      unitPrice: combo.comboPrice / combo.items.length, // distribute combo price
      taxRate: 15,
      isComboItem: true,
      comboId: combo._id,
    }));

    // Increment usage
    await RestaurantCombo.findByIdAndUpdate(combo._id, { $inc: { usedCount: 1 } });

    res.json({
      combo,
      lineItems,
      comboPrice: combo.comboPrice,
      originalTotal: combo.originalTotal,
      savings: combo.discountAmount,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===================== Sales Analytics =====================

// @route   GET /api/restaurant/analytics/overview?startDate=...&endDate=...
router.get('/analytics/overview', checkPermission('restaurant', 'read'), async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const filter = {
      ...getTenantFilter(req),
      isActive: true,
      status: { $ne: 'cancelled' },
    };

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate + 'T23:59:59');
    }

    const [orders, stats] = await Promise.all([
      RestaurantOrder.find(filter).select('orderNumber status orderType grandTotal subtotal totalTax createdAt tableNumber lineItems').lean(),
      RestaurantOrder.aggregate([
        { $match: filter },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$grandTotal' },
            totalSubtotal: { $sum: '$subtotal' },
            totalTax: { $sum: '$totalTax' },
            totalOrders: { $sum: 1 },
            avgTicket: { $avg: '$grandTotal' },
            dineInCount: { $sum: { $cond: [{ $eq: ['$orderType', 'dine_in'] }, 1, 0] } },
            takeawayCount: { $sum: { $cond: [{ $eq: ['$orderType', 'takeaway'] }, 1, 0] } },
            deliveryCount: { $sum: { $cond: [{ $eq: ['$orderType', 'delivery'] }, 1, 0] } },
            paidCount: { $sum: { $cond: [{ $eq: ['$status', 'paid'] }, 1, 0] } },
            openCount: { $sum: { $cond: [{ $eq: ['$status', 'open'] }, 1, 0] } },
          },
        },
      ]),
    ]);

    // Best selling items
    const itemStats = {};
    orders.forEach(order => {
      order.lineItems?.forEach(li => {
        const key = li.name || 'Unknown';
        if (!itemStats[key]) itemStats[key] = { name: key, nameAr: li.nameAr, quantity: 0, revenue: 0 };
        itemStats[key].quantity += li.quantity || 0;
        itemStats[key].revenue += (li.lineTotal || (li.quantity * li.unitPrice * (1 + (li.taxRate || 15) / 100))) || 0;
      });
    });

    const bestSellers = Object.values(itemStats).sort((a, b) => b.quantity - a.quantity).slice(0, 15);

    // Peak hours
    const hourBuckets = new Array(24).fill(0).map((_, i) => ({ hour: i, orders: 0, revenue: 0 }));
    orders.forEach(order => {
      const h = new Date(order.createdAt).getHours();
      hourBuckets[h].orders++;
      hourBuckets[h].revenue += order.grandTotal || 0;
    });

    // Daily revenue trend
    const dailyMap = {};
    orders.forEach(order => {
      const dateKey = new Date(order.createdAt).toISOString().split('T')[0];
      if (!dailyMap[dateKey]) dailyMap[dateKey] = { date: dateKey, revenue: 0, orders: 0 };
      dailyMap[dateKey].revenue += order.grandTotal || 0;
      dailyMap[dateKey].orders++;
    });
    const dailyTrend = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));

    // Category performance
    const categoryMap = {};
    orders.forEach(order => {
      order.lineItems?.forEach(li => {
        // We don't have category in line items, so group by item name
        const key = li.name || 'Unknown';
        if (!categoryMap[key]) categoryMap[key] = { name: key, revenue: 0, quantity: 0 };
        categoryMap[key].revenue += (li.lineTotal || (li.quantity * li.unitPrice)) || 0;
        categoryMap[key].quantity += li.quantity || 0;
      });
    });
    const topByRevenue = Object.values(categoryMap).sort((a, b) => b.revenue - a.revenue).slice(0, 10);

    // Table turnover (unique tables used per day)
    const tableUsage = {};
    orders.forEach(order => {
      if (order.tableNumber) {
        const dateKey = new Date(order.createdAt).toISOString().split('T')[0];
        const key = `${dateKey}-${order.tableNumber}`;
        tableUsage[key] = (tableUsage[key] || 0) + 1;
      }
    });
    const tableTurnoverRates = Object.values(
      Object.entries(tableUsage).reduce((acc, [k, count]) => {
        const date = k.split('-').slice(0, 3).join('-');
        if (!acc[date]) acc[date] = { date, tables: 0, turns: 0 };
        acc[date].tables++;
        acc[date].turns += count;
        return acc;
      }, {})
    ).map(d => ({ date: d.date, avgTurns: d.tables > 0 ? Math.round((d.turns / d.tables) * 10) / 10 : 0 }));

    const summary = stats[0] || {
      totalRevenue: 0, totalSubtotal: 0, totalTax: 0, totalOrders: 0,
      avgTicket: 0, dineInCount: 0, takeawayCount: 0, deliveryCount: 0,
      paidCount: 0, openCount: 0,
    };

    res.json({
      summary: {
        ...summary,
        avgTicket: Math.round(summary.avgTicket * 100) / 100,
        totalRevenue: Math.round(summary.totalRevenue * 100) / 100,
      },
      bestSellers,
      peakHours: hourBuckets,
      dailyTrend,
      topByRevenue,
      tableTurnoverRates,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
