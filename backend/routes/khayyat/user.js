import express from 'express';
import mongoose from 'mongoose';
import Customer from '../../models/Customer.js';
import KhayyatWorker from '../../models/khayyat/KhayyatWorker.js';
import KhayyatStitching from '../../models/khayyat/KhayyatStitching.js';
import KhayyatPayment from '../../models/khayyat/KhayyatPayment.js';
import { protect, tenantFilter, requireTenantFilter } from '../../middleware/auth.js';

const router = express.Router();

router.use(protect);
router.use(tenantFilter);
router.use(requireTenantFilter);

// Dashboard stats
router.get('/dashboard', async (req, res) => {
  try {
    const tenantIdStr = req.user.tenantId;
    const tenantId = new mongoose.Types.ObjectId(tenantIdStr);

    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);

    const [
      workersCount,
      customersCount,
      stitchingStats,
      totalRevenue,
      recentStitchings,
      upcomingDueStitchings,
      pendingStitchings,
      inProgressStitchings,
      completedStitchings,
      workerPayments,
      dueTodayCount
    ] = await Promise.all([
      KhayyatWorker.countDocuments({ tenantId }),
      Customer.countDocuments({ tenantId }),
      KhayyatStitching.aggregate([
        { $match: { tenantId } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            revenue: { $sum: '$price' }
          }
        }
      ]),
      KhayyatStitching.aggregate([
        { $match: { tenantId } },
        { $group: { _id: null, total: { $sum: '$price' }, paid: { $sum: '$paidAmount' } } }
      ]),
      KhayyatStitching.find({ tenantId })
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('customerId', 'name phone nameAr email')
        .populate('workerId', 'name phone nameI18n')
        .lean(),
      KhayyatStitching.find({
        tenantId,
        dueDate: { $ne: null },
        status: { $nin: ['delivered', 'done'] }
      })
        .sort({ dueDate: 1 })
        .limit(8)
        .populate('customerId', 'name phone nameAr email')
        .populate('workerId', 'name phone nameI18n')
        .lean(),
      KhayyatStitching.countDocuments({ tenantId, status: { $in: ['pending', 'assigned'] } }),
      KhayyatStitching.countDocuments({ tenantId, status: 'in_progress' }),
      KhayyatStitching.countDocuments({ tenantId, status: { $in: ['completed', 'delivered'] } }),
      KhayyatPayment.aggregate([
        { $match: { tenantId } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      KhayyatStitching.countDocuments({
        tenantId,
        dueDate: { $gte: todayStart, $lte: todayEnd },
        status: { $nin: ['delivered', 'done'] }
      })
    ]);

    const subscription = req.tenant?.subscription || { plan: 'trial', status: 'active', endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) };
    const endDate = subscription.endDate ? new Date(subscription.endDate) : null;
    const daysRemaining = endDate && Number.isFinite(endDate.getTime())
      ? Math.ceil((endDate - new Date()) / (1000 * 60 * 60 * 24))
      : 30;
    
    res.json({
      stats: {
        workersCount,
        customersCount,
        pendingStitchings,
        inProgressStitchings,
        completedStitchings,
        totalRevenue: totalRevenue[0]?.total || 0,
        totalPaid: totalRevenue[0]?.paid || 0,
        pendingPayments: (totalRevenue[0]?.total || 0) - (totalRevenue[0]?.paid || 0),
        workerPayments: workerPayments[0]?.total || 0,
        dueTodayCount
      },
      stitchingStats,
      recentStitchings,
      upcomingDueStitchings,
      subscription: {
        type: subscription.plan,
        endDate: subscription.endDate,
        daysRemaining
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
