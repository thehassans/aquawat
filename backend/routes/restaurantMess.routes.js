import express from 'express';
import mongoose from 'mongoose';
import {
  MessPlan,
  MessSubscriber,
  MessAttendance,
  MessBilling,
} from '../models/RestaurantMess.js';
import { protect, tenantFilter, checkPermission, requireBusinessType, requireTenantFilter } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);
router.use(tenantFilter);
router.use(requireTenantFilter);
router.use(requireBusinessType('restaurant'));

function getTenantFilter(req) {
  return { tenantId: new mongoose.Types.ObjectId(req.user.tenantId) };
}

// =================== Plans ===================

router.get('/plans', checkPermission('restaurant', 'read'), async (req, res) => {
  try {
    const { isActive = 'true' } = req.query;
    const query = { ...getTenantFilter(req) };
    if (isActive === 'false') query.isActive = false;
    else if (isActive !== 'all') query.isActive = true;

    const plans = await MessPlan.find(query).sort({ createdAt: -1 });
    res.json(plans);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/plans', checkPermission('restaurant', 'create'), async (req, res) => {
  try {
    const plan = await MessPlan.create({
      ...req.body,
      tenantId: req.user.tenantId,
      createdBy: req.user._id,
    });
    res.status(201).json(plan);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/plans/:id', checkPermission('restaurant', 'update'), async (req, res) => {
  try {
    const plan = await MessPlan.findOneAndUpdate(
      { _id: req.params.id, ...getTenantFilter(req) },
      req.body,
      { new: true, runValidators: true }
    );
    if (!plan) return res.status(404).json({ error: 'Plan not found' });
    res.json(plan);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/plans/:id', checkPermission('restaurant', 'delete'), async (req, res) => {
  try {
    const plan = await MessPlan.findOneAndUpdate(
      { _id: req.params.id, ...getTenantFilter(req) },
      { isActive: false },
      { new: true }
    );
    if (!plan) return res.status(404).json({ error: 'Plan not found' });
    res.json({ message: 'Plan deactivated' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// =================== Subscribers ===================

router.get('/subscribers', checkPermission('restaurant', 'read'), async (req, res) => {
  try {
    const { status, planId, search, page = 1, limit = 50 } = req.query;
    const query = { ...getTenantFilter(req) };

    if (status) query.status = status;
    if (planId) query.planId = planId;

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { nameAr: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { employeeId: { $regex: search, $options: 'i' } },
        { idNumber: { $regex: search, $options: 'i' } },
      ];
    }

    const [subscribers, total] = await Promise.all([
      MessSubscriber.find(query)
        .populate('planId', 'name nameAr pricePerCycle billingCycle meals billingMode')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit)),
      MessSubscriber.countDocuments(query),
    ]);

    res.json({ subscribers, pagination: { page: parseInt(page), limit: parseInt(limit), total } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/subscribers', checkPermission('restaurant', 'create'), async (req, res) => {
  try {
    const plan = await MessPlan.findOne({ _id: req.body.planId, ...getTenantFilter(req), isActive: true });
    if (!plan) return res.status(404).json({ error: 'Plan not found' });

    const subscriber = await MessSubscriber.create({
      ...req.body,
      billingMode: req.body.billingMode || plan.billingMode,
      tenantId: req.user.tenantId,
      createdBy: req.user._id,
    });
    res.status(201).json(subscriber);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/subscribers/:id', checkPermission('restaurant', 'update'), async (req, res) => {
  try {
    const subscriber = await MessSubscriber.findOneAndUpdate(
      { _id: req.params.id, ...getTenantFilter(req) },
      req.body,
      { new: true, runValidators: true }
    ).populate('planId', 'name nameAr pricePerCycle billingCycle meals billingMode');
    if (!subscriber) return res.status(404).json({ error: 'Subscriber not found' });
    res.json(subscriber);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/subscribers/:id', checkPermission('restaurant', 'delete'), async (req, res) => {
  try {
    const subscriber = await MessSubscriber.findOneAndUpdate(
      { _id: req.params.id, ...getTenantFilter(req) },
      { status: 'cancelled', isActive: false },
      { new: true }
    );
    if (!subscriber) return res.status(404).json({ error: 'Subscriber not found' });
    res.json({ message: 'Subscriber cancelled' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// =================== Attendance ===================

// GET attendance for a date
router.get('/attendance', checkPermission('restaurant', 'read'), async (req, res) => {
  try {
    const { date, meal, planId } = req.query;
    const targetDate = date ? new Date(date) : new Date();
    const nextDay = new Date(targetDate);
    nextDay.setDate(nextDay.getDate() + 1);

    const query = {
      ...getTenantFilter(req),
      date: { $gte: targetDate, $lt: nextDay },
    };
    if (meal) query.meal = meal;
    if (planId) query.planId = new mongoose.Types.ObjectId(planId);

    const [attendance, activeSubscribers] = await Promise.all([
      MessAttendance.find(query).populate('subscriberId', 'name nameAr phone employeeId').sort({ checkInTime: 1 }),
      MessSubscriber.find({
        ...getTenantFilter(req),
        status: 'active',
        ...(planId ? { planId: new mongoose.Types.ObjectId(planId) } : {}),
      }).select('name nameAr phone employeeId planId').populate('planId', 'meals name'),
    ]);

    // Build attendance map
    const attendanceMap = new Map();
    attendance.forEach(a => {
      attendanceMap.set(String(a.subscriberId?._id || a.subscriberId), a);
    });

    // Merge: all active subscribers with their attendance status
    const merged = activeSubscribers.map(sub => {
      const att = attendanceMap.get(String(sub._id));
      return {
        _id: att?._id,
        subscriberId: sub._id,
        name: sub.name,
        nameAr: sub.nameAr,
        phone: sub.phone,
        employeeId: sub.employeeId,
        planName: sub.planId?.name,
        planMeals: sub.planId?.meals || [],
        status: att?.status || 'absent',
        checkInTime: att?.checkInTime,
        meal: att?.meal || meal,
      };
    });

    const summary = {
      total: merged.length,
      present: merged.filter(m => m.status === 'present').length,
      absent: merged.filter(m => m.status === 'absent').length,
    };

    res.json({ date: targetDate, meal, attendance: merged, summary });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST mark attendance (single or bulk)
router.post('/attendance', checkPermission('restaurant', 'create'), async (req, res) => {
  try {
    const { entries } = req.body; // [{ subscriberId, planId, date, meal, status }]
    if (!Array.isArray(entries) || entries.length === 0) {
      return res.status(400).json({ error: 'entries array required' });
    }

    const results = [];
    for (const entry of entries) {
      const filter = {
        ...getTenantFilter(req),
        subscriberId: new mongoose.Types.ObjectId(entry.subscriberId),
        date: new Date(entry.date),
        meal: entry.meal,
      };

      const att = await MessAttendance.findOneAndUpdate(
        filter,
        {
          ...filter,
          planId: new mongoose.Types.ObjectId(entry.planId),
          status: entry.status || 'present',
          checkInTime: entry.status === 'present' ? new Date() : undefined,
          checkInMethod: entry.checkInMethod || 'manual',
          markedBy: req.user._id,
          notes: entry.notes,
        },
        { upsert: true, new: true, runValidators: true }
      );
      results.push(att);
    }

    res.json({ message: `${results.length} attendance records updated`, results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST QR check-in
router.post('/attendance/checkin', checkPermission('restaurant', 'create'), async (req, res) => {
  try {
    const { subscriberId, meal } = req.body;
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];

    const subscriber = await MessSubscriber.findOne({
      _id: subscriberId,
      ...getTenantFilter(req),
      status: 'active',
    });
    if (!subscriber) return res.status(404).json({ error: 'Subscriber not found or inactive' });

    // Check if already checked in for this meal today
    const existing = await MessAttendance.findOne({
      ...getTenantFilter(req),
      subscriberId: new mongoose.Types.ObjectId(subscriberId),
      date: new Date(dateStr),
      meal,
    });

    if (existing && existing.status === 'present') {
      return res.status(409).json({ error: 'Already checked in', attendance: existing });
    }

    const att = await MessAttendance.findOneAndUpdate(
      {
        ...getTenantFilter(req),
        subscriberId: new mongoose.Types.ObjectId(subscriberId),
        date: new Date(dateStr),
        meal,
      },
      {
        ...getTenantFilter(req),
        subscriberId: new mongoose.Types.ObjectId(subscriberId),
        planId: subscriber.planId,
        date: new Date(dateStr),
        meal,
        status: 'present',
        checkInTime: new Date(),
        checkInMethod: 'qr',
        markedBy: req.user._id,
      },
      { upsert: true, new: true }
    );

    res.json({ message: 'Checked in', attendance: att, subscriber: { name: subscriber.name, nameAr: subscriber.nameAr } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// =================== Billing ===================

// GET billing summary
router.get('/billing', checkPermission('restaurant', 'read'), async (req, res) => {
  try {
    const { status, period, page = 1, limit = 50 } = req.query;
    const query = { ...getTenantFilter(req) };
    if (status) query.status = status;
    if (period) query.periodLabel = period;

    const [billings, total] = await Promise.all([
      MessBilling.find(query)
        .populate('subscriberId', 'name nameAr phone employeeId companyName')
        .populate('planId', 'name nameAr billingCycle')
        .sort({ periodStart: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit)),
      MessBilling.countDocuments(query),
    ]);

    // Summary stats
    const stats = await MessBilling.aggregate([
      { $match: { ...getTenantFilter(req) } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' },
        },
      },
    ]);

    const summary = {};
    stats.forEach(s => { summary[s._id] = { count: s.count, totalAmount: s.totalAmount }; });

    res.json({ billings, pagination: { page: parseInt(page), limit: parseInt(limit), total }, summary });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST generate monthly billing for all active subscribers
router.post('/billing/generate', checkPermission('restaurant', 'create'), async (req, res) => {
  try {
    const { month, year } = req.body;
    const m = Number(month) || new Date().getMonth();
    const y = Number(year) || new Date().getFullYear();

    const periodStart = new Date(y, m, 1);
    const periodEnd = new Date(y, m + 1, 0, 23, 59, 59);
    const periodLabel = new Date(y, m).toLocaleDateString('en', { month: 'long', year: 'numeric' });

    // Get all active subscribers
    const subscribers = await MessSubscriber.find({
      ...getTenantFilter(req),
      status: 'active',
    }).populate('planId');

    if (subscribers.length === 0) {
      return res.json({ message: 'No active subscribers', generated: 0 });
    }

    // Get attendance counts for the period
    const attendanceCounts = await MessAttendance.aggregate([
      {
        $match: {
          ...getTenantFilter(req),
          date: { $gte: periodStart, $lte: periodEnd },
          status: 'present',
        },
      },
      {
        $group: {
          _id: { subscriberId: '$subscriberId', meal: '$meal' },
          count: { $sum: 1 },
        },
      },
    ]);

    // Build attendance map
    const attMap = new Map();
    attendanceCounts.forEach(a => {
      const key = String(a._id.subscriberId);
      if (!attMap.has(key)) attMap.set(key, {});
      attMap.get(key)[a._id.meal] = a.count;
    });

    let generated = 0;
    let skipped = 0;

    const subscriberIds = subscribers.map((sub) => sub._id);
    const existingBillings = subscriberIds.length
      ? await MessBilling.find({
          ...getTenantFilter(req),
          subscriberId: { $in: subscriberIds },
          periodStart,
        }).select('subscriberId').lean()
      : [];
    const billedSubscriberIds = new Set(existingBillings.map((row) => String(row.subscriberId)));

    for (const sub of subscribers) {
      if (billedSubscriberIds.has(String(sub._id))) { skipped++; continue; }

      const plan = sub.planId;
      const counts = attMap.get(String(sub._id)) || {};
      const totalMeals = (counts.breakfast || 0) + (counts.lunch || 0) + (counts.dinner || 0) + (counts.snack || 0);

      let baseAmount = 0;
      let perMealAmount = 0;
      let totalAmount = 0;

      const billingMode = sub.billingMode || plan?.billingMode || 'fixed';

      if (billingMode === 'fixed') {
        totalAmount = plan?.pricePerCycle || 0;
      } else if (billingMode === 'attendance_based') {
        perMealAmount = plan?.pricePerMeal || 0;
        totalAmount = totalMeals * perMealAmount;
      } else if (billingMode === 'hybrid') {
        baseAmount = plan?.basePrice || 0;
        perMealAmount = plan?.pricePerMeal || 0;
        totalAmount = baseAmount + (totalMeals * perMealAmount);
      }

      await MessBilling.create({
        tenantId: req.user.tenantId,
        subscriberId: sub._id,
        planId: sub.planId,
        periodStart,
        periodEnd,
        periodLabel,
        mealCounts: {
          breakfast: counts.breakfast || 0,
          lunch: counts.lunch || 0,
          dinner: counts.dinner || 0,
          snack: counts.snack || 0,
        },
        totalMeals,
        billingMode,
        baseAmount,
        perMealAmount,
        totalAmount,
        status: 'pending',
        createdBy: req.user._id,
      });
      generated++;
    }

    res.json({
      message: `${generated} billing records generated, ${skipped} already existed`,
      generated,
      skipped,
      period: periodLabel,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT mark billing as paid
router.put('/billing/:id/pay', checkPermission('restaurant', 'update'), async (req, res) => {
  try {
    const { paymentMethod } = req.body;
    const billing = await MessBilling.findOneAndUpdate(
      { _id: req.params.id, ...getTenantFilter(req) },
      {
        status: 'paid',
        paidAt: new Date(),
        paymentMethod: paymentMethod || 'cash',
      },
      { new: true }
    ).populate('subscriberId', 'name nameAr phone employeeId');

    if (!billing) return res.status(404).json({ error: 'Billing record not found' });
    res.json(billing);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// =================== Dashboard ===================

router.get('/dashboard', checkPermission('restaurant', 'read'), async (req, res) => {
  try {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    const [planCount, activeSubscribers, todayAttendance, pendingBillings, monthlyRevenue] = await Promise.all([
      MessPlan.countDocuments({ ...getTenantFilter(req), isActive: true }),
      MessSubscriber.countDocuments({ ...getTenantFilter(req), status: 'active' }),
      MessAttendance.countDocuments({
        ...getTenantFilter(req),
        date: { $gte: new Date(todayStr), $lt: new Date(todayStr + 'T23:59:59') },
        status: 'present',
      }),
      MessBilling.countDocuments({ ...getTenantFilter(req), status: 'pending' }),
      MessBilling.aggregate([
        { $match: { ...getTenantFilter(req), status: 'paid' } },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } },
      ]),
    ]);

    // Recent subscribers
    const recentSubscribers = await MessSubscriber.find({ ...getTenantFilter(req), status: 'active' })
      .populate('planId', 'name nameAr')
      .sort({ createdAt: -1 })
      .limit(5)
      .select('name nameAr phone employeeId companyName planId startDate');

    // Plan distribution
    const planDist = await MessSubscriber.aggregate([
      { $match: { ...getTenantFilter(req), status: 'active' } },
      { $group: { _id: '$planId', count: { $sum: 1 } } },
      { $lookup: { from: 'messplans', localField: '_id', foreignField: '_id', as: 'plan' } },
      { $unwind: '$plan' },
      { $project: { planName: '$plan.name', count: 1 } },
    ]);

    res.json({
      summary: {
        plans: planCount,
        activeSubscribers,
        todayAttendance,
        pendingBillings,
        monthlyRevenue: monthlyRevenue[0]?.total || 0,
      },
      recentSubscribers,
      planDistribution: planDist,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
