import express from 'express';
import ZatcaLog from '../models/ZatcaLog.js';
import { protect, tenantFilter, checkPermission, requireTenantFilter } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);
router.use(tenantFilter);
router.use(requireTenantFilter);

// @route   GET /api/zatca/logs
router.get('/logs', checkPermission('finance', 'read'), async (req, res) => {
  try {
    const { page = 1, limit = 20, status, search } = req.query;
    const query = { ...req.tenantFilter };

    if (status) query.status = status;
    if (search) query.invoiceNumber = { $regex: search, $options: 'i' };

    const logs = await ZatcaLog.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await ZatcaLog.countDocuments(query);

    res.json({
      logs,
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

// @route   GET /api/zatca/logs/stats
router.get('/logs/stats', checkPermission('finance', 'read'), async (req, res) => {
  try {
    const stats = await ZatcaLog.aggregate([
      { $match: { ...req.tenantFilter } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);
    
    const formattedStats = {
      success: 0,
      warning: 0,
      error: 0,
      total: 0
    };

    stats.forEach(stat => {
      if (formattedStats[stat._id] !== undefined) {
        formattedStats[stat._id] = stat.count;
      }
      formattedStats.total += stat.count;
    });

    res.json(formattedStats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
