import express from 'express';
import Supplier from '../models/Supplier.js';
import PurchaseOrder from '../models/PurchaseOrder.js';
import PurchaseReturn from '../models/PurchaseReturn.js';
import GRN from '../models/GRN.js';
import { protect, tenantFilter, checkPermission, requireTenantFilter } from '../middleware/auth.js';
import { checkTrialLimits } from '../middleware/trialLimits.js';

const router = express.Router();

router.use(protect);
router.use(tenantFilter);
router.use(requireTenantFilter);

// @route   GET /api/suppliers
router.get('/', checkPermission('supply_chain', 'read'), async (req, res) => {
  try {
    const { page = 1, limit = 50, search, isActive, isAddition } = req.query;

    const query = { ...req.tenantFilter };

    if (isActive === 'false') {
      query.isActive = false;
    } else if (isActive === 'all') {
      // no filter
    } else {
      query.isActive = true;
    }

    if (isAddition === 'true') {
      query.isAddition = true;
    } else if (isAddition === 'false') {
      query.isAddition = { $ne: true };
    }

    if (search) {
      const cleanSearch = String(search).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { code: { $regex: cleanSearch, $options: 'i' } },
        { nameEn: { $regex: cleanSearch, $options: 'i' } },
        { nameAr: { $regex: cleanSearch, $options: 'i' } },
        { vatNumber: { $regex: cleanSearch, $options: 'i' } },
        { phone: { $regex: cleanSearch, $options: 'i' } },
        { mobile: { $regex: cleanSearch, $options: 'i' } },
        { email: { $regex: cleanSearch, $options: 'i' } }
      ];
    }

    const [suppliers, total] = await Promise.all([
      Supplier.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit))
        .lean(),
      Supplier.countDocuments(query),
    ]);

    res.json({
      suppliers,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   GET /api/suppliers/stats
router.get('/stats', checkPermission('supply_chain', 'read'), async (req, res) => {
  try {
    const stats = await Supplier.aggregate([
      { $match: { ...req.tenantFilter } },
      {
        $facet: {
          totals: [{ $group: { _id: null, total: { $sum: 1 }, active: { $sum: { $cond: ['$isActive', 1, 0] } }, additions: { $sum: { $cond: ['$isAddition', 1, 0] } } } }],
          byType: [{ $group: { _id: '$type', count: { $sum: 1 } } }],
          byCity: [{ $group: { _id: '$address.city', count: { $sum: 1 } } }]
        }
      }
    ]);

    res.json(stats[0] || {});
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   GET /api/suppliers/financials
router.get('/financials', checkPermission('supply_chain', 'read'), async (req, res) => {
  try {
    const suppliers = await Supplier.find({ ...req.tenantFilter, isActive: true }).lean();
    const supplierIds = suppliers.map(s => s._id);

    const orders = await PurchaseOrder.find({
      ...req.tenantFilter,
      supplierId: { $in: supplierIds },
      status: { $ne: 'cancelled' },
    }).lean();

    const financials = suppliers.map(supplier => {
      const supplierOrders = orders.filter(o => o.supplierId?.toString() === supplier._id.toString());
      const totalCredit = Math.round(supplierOrders.reduce((sum, o) => sum + (Number(o.grandTotal) || 0), 0) * 100) / 100;
      const totalDebit = Math.round(supplierOrders.reduce((sum, o) => sum + (Number(o.paidAmount) || 0), 0) * 100) / 100;
      const balance = Math.round((totalCredit - totalDebit) * 100) / 100;

      return {
        _id: supplier._id,
        totalCredit,
        totalDebit,
        balance,
        totalPO: supplierOrders.length
      };
    });

    res.json(financials);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   GET /api/suppliers/:id
router.get('/:id', checkPermission('supply_chain', 'read'), async (req, res) => {
  try {
    const supplier = await Supplier.findOne({ _id: req.params.id, ...req.tenantFilter });

    if (!supplier) {
      return res.status(404).json({ error: 'Supplier not found' });
    }

    res.json(supplier);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   POST /api/suppliers
router.post('/', checkTrialLimits('suppliers'), checkPermission('supply_chain', 'create'), async (req, res) => {
  try {
    const data = {
      ...req.body,
      tenantId: req.user.tenantId,
      createdBy: req.user._id
    };

    const supplier = await Supplier.create(data);
    res.status(201).json(supplier);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   PUT /api/suppliers/:id
router.put('/:id', checkPermission('supply_chain', 'update'), async (req, res) => {
  try {
    const supplier = await Supplier.findOneAndUpdate(
      { _id: req.params.id, ...req.tenantFilter },
      req.body,
      { new: true, runValidators: true }
    );

    if (!supplier) {
      return res.status(404).json({ error: 'Supplier not found' });
    }

    res.json(supplier);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   DELETE /api/suppliers/:id
router.delete('/:id', checkPermission('supply_chain', 'delete'), async (req, res) => {
  try {
    const supplier = await Supplier.findOneAndUpdate(
      { _id: req.params.id, ...req.tenantFilter },
      { isActive: false },
      { new: true }
    );

    if (!supplier) {
      return res.status(404).json({ error: 'Supplier not found' });
    }

    res.json({ message: 'Supplier deactivated', supplier });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   GET /api/suppliers/performance
// @desc    Get supplier performance dashboard with scoring
router.get('/performance', checkPermission('supply_chain', 'read'), async (req, res) => {
  try {
    const { months = 6 } = req.query;
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - parseInt(months));

    const suppliers = await Supplier.find({ ...req.tenantFilter, isActive: true })
      .select('code nameEn nameAr vatNumber phone email')
      .lean();

    const supplierIds = suppliers.map(s => s._id);

    const [orders, returns] = await Promise.all([
      PurchaseOrder.find({
        ...req.tenantFilter,
        supplierId: { $in: supplierIds },
        orderDate: { $gte: startDate },
        status: { $ne: 'cancelled' },
      }).lean(),
      PurchaseReturn.find({
        ...req.tenantFilter,
        supplierId: { $in: supplierIds },
        dateReturned: { $gte: startDate },
      }).lean(),
    ]);

    const performance = suppliers.map(supplier => {
      const supplierOrders = orders.filter(o => o.supplierId?.toString() === supplier._id.toString());
      const supplierReturns = returns.filter(r => r.supplierId?.toString() === supplier._id.toString());

      const totalOrders = supplierOrders.length;
      const totalSpend = supplierOrders.reduce((sum, o) => sum + (o.grandTotal || 0), 0);

      const receivedOrders = supplierOrders.filter(o => ['received', 'closed', 'partially_received'].includes(o.status));
      const onTimeDeliveries = receivedOrders.filter(o => {
        if (!o.expectedDate) return true;
        const lastReceive = o.receiving?.length ? o.receiving[o.receiving.length - 1].receivedAt : o.updatedAt;
        return new Date(lastReceive) <= new Date(o.expectedDate);
      });

      const onTimeRate = receivedOrders.length > 0 ? (onTimeDeliveries.length / receivedOrders.length) * 100 : 100;

      const totalReturnQty = supplierReturns.reduce((sum, r) =>
        sum + (r.lines || []).reduce((ls, l) => ls + (l.quantityReturned || 0), 0), 0);
      const totalReceivedQty = receivedOrders.reduce((sum, o) =>
        sum + (o.lineItems || []).reduce((ls, l) => ls + (l.quantityReceived || 0), 0), 0);
      const returnRate = totalReceivedQty > 0 ? (totalReturnQty / totalReceivedQty) * 100 : 0;

      const avgOrderValue = totalOrders > 0 ? totalSpend / totalOrders : 0;

      const leadTimes = receivedOrders
        .filter(o => o.expectedDate && o.receiving?.length)
        .map(o => {
          const lastReceive = o.receiving[o.receiving.length - 1].receivedAt;
          return Math.ceil((new Date(lastReceive) - new Date(o.orderDate)) / (1000 * 60 * 60 * 24));
        });
      const avgLeadTime = leadTimes.length > 0 ? leadTimes.reduce((a, b) => a + b, 0) / leadTimes.length : 0;

      const onTimeScore = Math.min(onTimeRate, 100);
      const returnScore = Math.max(100 - returnRate * 2, 0);
      const volumeScore = Math.min(totalOrders * 5, 25);
      const totalScore = Math.round((onTimeScore * 0.4 + returnScore * 0.35 + volumeScore * 0.25));

      let grade = 'C';
      if (totalScore >= 80) grade = 'A';
      else if (totalScore >= 60) grade = 'B';

      return {
        _id: supplier._id,
        code: supplier.code,
        nameEn: supplier.nameEn,
        nameAr: supplier.nameAr,
        vatNumber: supplier.vatNumber,
        phone: supplier.phone,
        email: supplier.email,
        metrics: {
          totalOrders,
          totalSpend: Math.round(totalSpend * 100) / 100,
          avgOrderValue: Math.round(avgOrderValue * 100) / 100,
          onTimeRate: Math.round(onTimeRate * 10) / 10,
          returnRate: Math.round(returnRate * 10) / 10,
          avgLeadTimeDays: Math.round(avgLeadTime * 10) / 10,
          totalReturns: supplierReturns.length,
          totalReturnQty,
        },
        score: totalScore,
        grade,
      };
    });

    performance.sort((a, b) => b.score - a.score);

    const gradeDistribution = {
      A: performance.filter(p => p.grade === 'A').length,
      B: performance.filter(p => p.grade === 'B').length,
      C: performance.filter(p => p.grade === 'C').length,
    };

    const totals = {
      totalSuppliers: suppliers.length,
      totalSpend: performance.reduce((s, p) => s + p.metrics.totalSpend, 0),
      totalOrders: performance.reduce((s, p) => s + p.metrics.totalOrders, 0),
      avgOnTimeRate: performance.length > 0
        ? Math.round((performance.reduce((s, p) => s + p.metrics.onTimeRate, 0) / performance.length) * 10) / 10
        : 0,
      avgReturnRate: performance.length > 0
        ? Math.round((performance.reduce((s, p) => s + p.metrics.returnRate, 0) / performance.length) * 10) / 10
        : 0,
    };

    res.json({ performance, gradeDistribution, totals });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   GET /api/suppliers/:id/performance-detail
// @desc    Get detailed performance for a single supplier
router.get('/:id/performance-detail', checkPermission('supply_chain', 'read'), async (req, res) => {
  try {
    const { months = 6 } = req.query;
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - parseInt(months));

    const supplier = await Supplier.findOne({ _id: req.params.id, ...req.tenantFilter }).lean();
    if (!supplier) {
      return res.status(404).json({ error: 'Supplier not found' });
    }

    const orders = await PurchaseOrder.find({
      ...req.tenantFilter,
      supplierId: supplier._id,
      orderDate: { $gte: startDate },
    }).sort({ orderDate: -1 }).lean();

    const returns = await PurchaseReturn.find({
      ...req.tenantFilter,
      supplierId: supplier._id,
      dateReturned: { $gte: startDate },
    }).sort({ dateReturned: -1 }).lean();

    const monthlyTrend = [];
    for (let i = parseInt(months) - 1; i >= 0; i--) {
      const monthStart = new Date();
      monthStart.setMonth(monthStart.getMonth() - i);
      monthStart.setDate(1);
      const monthEnd = new Date(monthStart);
      monthEnd.setMonth(monthEnd.getMonth() + 1);

      const monthOrders = orders.filter(o =>
        new Date(o.orderDate) >= monthStart && new Date(o.orderDate) < monthEnd
      );
      const monthReturns = returns.filter(r =>
        new Date(r.dateReturned) >= monthStart && new Date(r.dateReturned) < monthEnd
      );

      monthlyTrend.push({
        month: monthStart.toLocaleDateString('en', { month: 'short', year: '2-digit' }),
        orders: monthOrders.length,
        spend: monthOrders.reduce((s, o) => s + (o.grandTotal || 0), 0),
        returns: monthReturns.length,
      });
    }

    const productBreakdown = {};
    orders.forEach(o => {
      (o.lineItems || []).forEach(li => {
        const key = li.productId?.toString() || li.manualName || 'unknown';
        if (!productBreakdown[key]) {
          productBreakdown[key] = {
            name: li.manualName || 'Product',
            totalOrdered: 0,
            totalReceived: 0,
            totalCost: 0,
          };
        }
        productBreakdown[key].totalOrdered += li.quantityOrdered || 0;
        productBreakdown[key].totalReceived += li.quantityReceived || 0;
        productBreakdown[key].totalCost += li.lineTotal || 0;
      });
    });

    const topProducts = Object.values(productBreakdown)
      .sort((a, b) => b.totalCost - a.totalCost)
      .slice(0, 10);

    const returnReasons = {};
    returns.forEach(r => {
      (r.lines || []).forEach(l => {
        const reason = l.reason || 'unspecified';
        returnReasons[reason] = (returnReasons[reason] || 0) + (l.quantityReturned || 0);
      });
    });

    res.json({
      supplier,
      orders: orders.slice(0, 20),
      returns: returns.slice(0, 20),
      monthlyTrend,
      topProducts,
      returnReasons,
      summary: {
        totalOrders: orders.length,
        totalSpend: orders.reduce((s, o) => s + (o.grandTotal || 0), 0),
        totalReturns: returns.length,
        avgOrderValue: orders.length > 0
          ? orders.reduce((s, o) => s + (o.grandTotal || 0), 0) / orders.length
          : 0,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
