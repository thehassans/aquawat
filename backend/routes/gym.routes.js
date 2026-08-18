import express from 'express';
import { protect, tenantFilter, requireTenantFilter, requireBusinessType } from '../middleware/auth.js';
import GymMember from '../models/GymMember.js';
import GymPlan from '../models/GymPlan.js';
import GymSubscription from '../models/GymSubscription.js';
import GymAttendance from '../models/GymAttendance.js';
import GymClass from '../models/GymClass.js';
import GymClassBooking from '../models/GymClassBooking.js';
import GymTrainer from '../models/GymTrainer.js';
import GymPTPackage from '../models/GymPTPackage.js';
import GymMeasurement from '../models/GymMeasurement.js';
import GymLocker from '../models/GymLocker.js';
import Invoice from '../models/Invoice.js';
import Tenant from '../models/Tenant.js';
import { v4 as uuidv4 } from 'uuid';
import mongoose from 'mongoose';

const router = express.Router();
router.use(protect);
router.use(tenantFilter);
router.use(requireTenantFilter);
router.use(requireBusinessType('gym'));

// Helper Functions
async function generateMemberNumber(tenantId) {
  const year = new Date().getFullYear();
  const prefix = `GYM-${year}`;
  const last = await GymMember.findOne({ tenantId, memberNumber: { $regex: `^${prefix}-` } })
    .sort({ memberNumber: -1 }).select('memberNumber').lean();
  let seq = 1;
  if (last?.memberNumber) {
    const parts = last.memberNumber.split('-');
    const lastSeq = Number(parts[parts.length - 1]);
    if (Number.isFinite(lastSeq)) seq = lastSeq + 1;
  }
  return `${prefix}-${String(seq).padStart(4, '0')}`;
}

async function generateSubscriptionNumber(tenantId) {
  const year = new Date().getFullYear();
  const prefix = `SUB-${year}`;
  const last = await GymSubscription.findOne({ tenantId, subscriptionNumber: { $regex: `^${prefix}-` } })
    .sort({ subscriptionNumber: -1 }).select('subscriptionNumber').lean();
  let seq = 1;
  if (last?.subscriptionNumber) {
    const parts = last.subscriptionNumber.split('-');
    const lastSeq = Number(parts[parts.length - 1]);
    if (Number.isFinite(lastSeq)) seq = lastSeq + 1;
  }
  return `${prefix}-${String(seq).padStart(4, '0')}`;
}

function getDefaultTaxRate(tenant) {
  const currency = String(tenant?.settings?.currency || 'SAR').toUpperCase();
  if (currency === 'SAR') return 15;
  if (currency === 'BDT') return 15;
  if (currency === 'PKR') return 18;
  return 0;
}

// --- Dashboard Stats ---
router.get('/dashboard/stats', async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
    const next7Days = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

    const [
      totalMembers,
      activeSubscriptions,
      todayCheckins,
      liveOccupancy,
      monthlyRevenueData,
      expiringSoon,
      totalTrainers,
      activeClasses
    ] = await Promise.all([
      GymMember.countDocuments({ tenantId, isActive: true }),
      GymSubscription.countDocuments({ tenantId, status: 'active' }),
      GymAttendance.countDocuments({ tenantId, accessResult: 'granted', checkInTime: { $gte: today } }),
      GymAttendance.countDocuments({ tenantId, accessResult: 'granted', checkInTime: { $gte: today }, checkOutTime: null }),
      GymSubscription.aggregate([
        { $match: { tenantId, createdAt: { $gte: startOfMonth, $lte: endOfMonth } } },
        { $group: { _id: null, total: { $sum: '$amountPaid' } } }
      ]),
      GymSubscription.countDocuments({ tenantId, status: 'active', endDate: { $lte: next7Days, $gte: today } }),
      GymTrainer.countDocuments({ tenantId, isActive: true }),
      GymClass.countDocuments({ tenantId, isActive: true })
    ]);

    res.json({
      success: true,
      data: {
        totalMembers,
        activeSubscriptions,
        todayCheckins,
        liveOccupancy,
        monthlyRevenue: monthlyRevenueData[0]?.total || 0,
        expiringSoon,
        totalTrainers,
        activeClasses
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// --- Members CRUD ---
router.get('/members', async (req, res) => {
  try {
    const { search, status, page = 1, limit = 10 } = req.query;
    const query = { tenantId: req.user.tenantId };
    
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { memberNumber: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (status) query.status = status;

    const skip = (page - 1) * limit;
    
    const members = await GymMember.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await GymMember.countDocuments(query);
    
    // Attach active subscription to each member
    for (const member of members) {
        member.activeSubscription = await GymSubscription.findOne({ tenantId: req.user.tenantId, memberId: member._id, status: 'active' })
            .populate('planId', 'nameEn nameAr')
            .lean();
    }

    res.json({
      success: true,
      data: members,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/members/:id', async (req, res) => {
  try {
    const member = await GymMember.findOne({ _id: req.params.id, tenantId: req.user.tenantId }).lean();
    if (!member) return res.status(404).json({ success: false, message: 'Member not found' });

    const currentSubscription = await GymSubscription.findOne({ memberId: member._id, tenantId: req.user.tenantId, status: { $in: ['active', 'frozen'] } })
      .populate('planId')
      .sort({ createdAt: -1 })
      .lean();
      
    const recentAttendance = await GymAttendance.find({ memberId: member._id, tenantId: req.user.tenantId })
      .sort({ checkInTime: -1 })
      .limit(10)
      .lean();
      
    const measurementsCount = await GymMeasurement.countDocuments({ memberId: member._id, tenantId: req.user.tenantId });

    res.json({
      success: true,
      data: {
        ...member,
        currentSubscription,
        recentAttendance,
        measurementsCount
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/members', async (req, res) => {
  try {
    const memberNumber = await generateMemberNumber(req.user.tenantId);
    const qrCode = uuidv4();
    
    const member = new GymMember({
      ...req.body,
      tenantId: req.user.tenantId,
      memberNumber,
      qrCode,
      status: 'active',
      isActive: true
    });
    
    await member.save();
    res.status(201).json({ success: true, data: member });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/members/:id', async (req, res) => {
  try {
    const member = await GymMember.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.user.tenantId },
      req.body,
      { new: true, runValidators: true }
    );
    if (!member) return res.status(404).json({ success: false, message: 'Member not found' });
    res.json({ success: true, data: member });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/members/:id', async (req, res) => {
  try {
    const member = await GymMember.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.user.tenantId },
      { isActive: false, status: 'inactive' },
      { new: true }
    );
    if (!member) return res.status(404).json({ success: false, message: 'Member not found' });
    res.json({ success: true, data: member });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/members/:id/attendance', async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;
    
    const attendance = await GymAttendance.find({ memberId: req.params.id, tenantId: req.user.tenantId })
      .sort({ checkInTime: -1 })
      .skip(skip)
      .limit(parseInt(limit));
      
    const total = await GymAttendance.countDocuments({ memberId: req.params.id, tenantId: req.user.tenantId });
    
    res.json({
      success: true,
      data: attendance,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// --- Plans CRUD ---
router.get('/plans', async (req, res) => {
  try {
    const query = { tenantId: req.user.tenantId };
    if (req.query.isActive !== undefined) query.isActive = req.query.isActive === 'true';
    
    const plans = await GymPlan.find(query).sort({ sortOrder: 1, createdAt: -1 });
    res.json({ success: true, data: plans });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/plans', async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.user.tenantId);
    const taxRate = req.body.taxRate !== undefined ? req.body.taxRate : getDefaultTaxRate(tenant);
    
    const plan = new GymPlan({
      ...req.body,
      tenantId: req.user.tenantId,
      taxRate
    });
    
    await plan.save();
    res.status(201).json({ success: true, data: plan });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/plans/:id', async (req, res) => {
  try {
    const plan = await GymPlan.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.user.tenantId },
      req.body,
      { new: true, runValidators: true }
    );
    if (!plan) return res.status(404).json({ success: false, message: 'Plan not found' });
    res.json({ success: true, data: plan });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/plans/:id', async (req, res) => {
  try {
    const plan = await GymPlan.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.user.tenantId },
      { isActive: false },
      { new: true }
    );
    if (!plan) return res.status(404).json({ success: false, message: 'Plan not found' });
    res.json({ success: true, data: plan });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// --- Subscriptions ---
router.get('/subscriptions', async (req, res) => {
  try {
    const { status, memberId, page = 1, limit = 10 } = req.query;
    const query = { tenantId: req.user.tenantId };
    
    if (status) query.status = status;
    if (memberId) query.memberId = memberId;

    const skip = (page - 1) * limit;
    
    const subscriptions = await GymSubscription.find(query)
      .populate('memberId', 'firstName lastName phone memberNumber photoUrl')
      .populate('planId', 'nameEn nameAr durationDays planType')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await GymSubscription.countDocuments(query);

    res.json({
      success: true,
      data: subscriptions,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/subscriptions', async (req, res) => {
  try {
    const { memberId, planId, amountPaid } = req.body;
    const tenantId = req.user.tenantId;

    const plan = await GymPlan.findOne({ _id: planId, tenantId });
    if (!plan) return res.status(404).json({ success: false, message: 'Plan not found' });

    const tenant = await Tenant.findById(tenantId);
    
    const startDate = new Date();
    startDate.setHours(0,0,0,0);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + plan.durationDays);
    
    const subscriptionNumber = await generateSubscriptionNumber(tenantId);
    
    const finalAmountPaid = amountPaid !== undefined ? amountPaid : plan.price;
    const taxRate = plan.taxRate !== undefined ? plan.taxRate : getDefaultTaxRate(tenant);
    
    const sub = new GymSubscription({
      ...req.body,
      tenantId,
      subscriptionNumber,
      memberId,
      planId,
      startDate,
      endDate,
      status: 'active',
      currency: tenant.settings?.currency || 'SAR',
      taxRate,
      amountPaid: finalAmountPaid,
      totalAmount: plan.price,
      remainingFreezeDays: plan.maxFreezeDays || 0
    });
    
    await sub.save();

    // Create Invoice
    const year = new Date().getFullYear();
    const invoiceCount = await Invoice.countDocuments({ tenantId });
    const invoiceNumber = `INV-${year}-${String(invoiceCount + 1).padStart(5, '0')}`;
    
    const taxAmount = (finalAmountPaid * taxRate) / (100 + taxRate);
    const subtotal = finalAmountPaid - taxAmount;

    const invoice = new Invoice({
      tenantId,
      invoiceNumber,
      type: 'simplified',
      status: 'paid',
      customerName: 'Gym Member', // would ideally populate from member
      items: [{
        description: plan.nameEn || plan.nameAr,
        quantity: 1,
        unitPrice: subtotal,
        taxAmount,
        total: finalAmountPaid
      }],
      subTotal: subtotal,
      totalTax: taxAmount,
      totalAmount: finalAmountPaid,
      currency: tenant.settings?.currency || 'SAR'
    });
    await invoice.save();

    res.status(201).json({ success: true, data: sub });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/subscriptions/:id/freeze', async (req, res) => {
  try {
    const sub = await GymSubscription.findOne({ _id: req.params.id, tenantId: req.user.tenantId });
    if (!sub) return res.status(404).json({ success: false, message: 'Subscription not found' });
    if (sub.status !== 'active') return res.status(400).json({ success: false, message: 'Only active subscriptions can be frozen' });
    if (sub.remainingFreezeDays <= 0) return res.status(400).json({ success: false, message: 'No freeze days remaining' });

    sub.status = 'frozen';
    sub.freezeHistory.push({ freezeStart: new Date() });
    
    await sub.save();
    res.json({ success: true, data: sub });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/subscriptions/:id/unfreeze', async (req, res) => {
  try {
    const sub = await GymSubscription.findOne({ _id: req.params.id, tenantId: req.user.tenantId });
    if (!sub) return res.status(404).json({ success: false, message: 'Subscription not found' });
    if (sub.status !== 'frozen') return res.status(400).json({ success: false, message: 'Subscription is not frozen' });

    const activeFreeze = sub.freezeHistory[sub.freezeHistory.length - 1];
    if (activeFreeze && !activeFreeze.freezeEnd) {
      activeFreeze.freezeEnd = new Date();
      
      const diffTime = Math.abs(activeFreeze.freezeEnd - activeFreeze.freezeStart);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      sub.totalFreezeDaysUsed += diffDays;
      sub.remainingFreezeDays = Math.max(0, sub.remainingFreezeDays - diffDays);
      
      if (sub.endDate) {
          sub.endDate.setDate(sub.endDate.getDate() + diffDays);
      }
    }

    sub.status = 'active';
    await sub.save();
    res.json({ success: true, data: sub });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/subscriptions/:id/renew', async (req, res) => {
  try {
    const oldSub = await GymSubscription.findOne({ _id: req.params.id, tenantId: req.user.tenantId }).populate('planId');
    if (!oldSub) return res.status(404).json({ success: false, message: 'Subscription not found' });

    oldSub.status = 'expired';
    await oldSub.save();

    const plan = oldSub.planId;
    const startDate = new Date();
    startDate.setHours(0,0,0,0);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + plan.durationDays);

    const subscriptionNumber = await generateSubscriptionNumber(req.user.tenantId);

    const newSub = new GymSubscription({
      tenantId: req.user.tenantId,
      subscriptionNumber,
      memberId: oldSub.memberId,
      planId: oldSub.planId._id,
      startDate,
      endDate,
      status: 'active',
      renewedFromId: oldSub._id,
      currency: oldSub.currency,
      taxRate: oldSub.taxRate,
      totalAmount: plan.price,
      amountPaid: req.body.amountPaid !== undefined ? req.body.amountPaid : plan.price,
      remainingFreezeDays: plan.maxFreezeDays || 0
    });

    await newSub.save();
    res.json({ success: true, data: newSub });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/subscriptions/expiring', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const today = new Date();
    const futureDate = new Date();
    futureDate.setDate(today.getDate() + days);

    const subs = await GymSubscription.find({
      tenantId: req.user.tenantId,
      status: 'active',
      endDate: { $lte: futureDate, $gte: today }
    })
    .populate('memberId', 'firstName lastName phone')
    .populate('planId', 'nameEn nameAr');

    res.json({ success: true, data: subs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});


// --- Attendance / Check-in ---
router.post('/attendance/checkin', async (req, res) => {
  try {
    const { qrCode, memberNumber, phone } = req.body;
    let query = { tenantId: req.user.tenantId };
    
    if (qrCode) query.qrCode = qrCode;
    else if (memberNumber) query.memberNumber = memberNumber;
    else if (phone) query.phone = phone;
    else return res.status(400).json({ success: false, message: 'Please provide qrCode, memberNumber, or phone' });

    const member = await GymMember.findOne(query);
    if (!member) {
      const failed = new GymAttendance({
        tenantId: req.user.tenantId,
        accessResult: 'denied',
        deniedReason: 'Member not found'
      });
      await failed.save();
      return res.status(404).json({ success: false, message: 'Member not found' });
    }

    const today = new Date();
    const activeSub = await GymSubscription.findOne({
      memberId: member._id,
      tenantId: req.user.tenantId,
      status: 'active',
      startDate: { $lte: today },
      endDate: { $gte: today }
    });

    let accessResult = 'granted';
    let deniedReason = null;

    if (!activeSub) {
      accessResult = 'denied';
      deniedReason = 'No active subscription';
    } else if (member.status !== 'active') {
      accessResult = 'denied';
      deniedReason = `Member status is ${member.status}`;
    }

    const attendance = new GymAttendance({
      tenantId: req.user.tenantId,
      memberId: member._id,
      subscriptionId: activeSub ? activeSub._id : null,
      checkInTime: new Date(),
      accessResult,
      deniedReason
    });

    await attendance.save();

    if (accessResult === 'denied') {
      return res.status(403).json({ success: false, message: deniedReason, data: attendance });
    }

    res.json({ success: true, data: attendance, message: 'Check-in successful' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/attendance/checkout', async (req, res) => {
  try {
    const { memberId } = req.body;
    const today = new Date();
    today.setHours(0,0,0,0);

    const latestAttendance = await GymAttendance.findOne({
      memberId,
      tenantId: req.user.tenantId,
      checkInTime: { $gte: today },
      checkOutTime: null,
      accessResult: 'granted'
    }).sort({ checkInTime: -1 });

    if (!latestAttendance) {
      return res.status(404).json({ success: false, message: 'No active check-in found for today' });
    }

    const now = new Date();
    latestAttendance.checkOutTime = now;
    
    const diffTime = Math.abs(now - latestAttendance.checkInTime);
    latestAttendance.durationMinutes = Math.floor(diffTime / (1000 * 60));
    
    await latestAttendance.save();
    res.json({ success: true, data: latestAttendance, message: 'Check-out successful' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/attendance/live', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0,0,0,0);
    const count = await GymAttendance.countDocuments({
      tenantId: req.user.tenantId,
      checkInTime: { $gte: today },
      checkOutTime: null,
      accessResult: 'granted'
    });
    res.json({ success: true, data: { occupancy: count } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/attendance/analytics', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const stats = await GymAttendance.aggregate([
      { 
        $match: { 
          tenantId: mongoose.Types.ObjectId(req.user.tenantId),
          checkInTime: { $gte: startDate },
          accessResult: 'granted'
        } 
      },
      {
        $group: {
          _id: {
            dayOfWeek: { $dayOfWeek: "$checkInTime" },
            hour: { $hour: "$checkInTime" }
          },
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// --- Classes CRUD ---
router.get('/classes', async (req, res) => {
  try {
    const query = { tenantId: req.user.tenantId };
    if (req.query.isActive !== undefined) query.isActive = req.query.isActive === 'true';

    const classes = await GymClass.find(query)
      .populate('trainerId', 'nameEn nameAr photoUrl')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: classes });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/classes', async (req, res) => {
  try {
    const gymClass = new GymClass({
      ...req.body,
      tenantId: req.user.tenantId
    });
    await gymClass.save();
    res.status(201).json({ success: true, data: gymClass });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/classes/:id', async (req, res) => {
  try {
    const gymClass = await GymClass.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.user.tenantId },
      req.body,
      { new: true, runValidators: true }
    );
    if (!gymClass) return res.status(404).json({ success: false, message: 'Class not found' });
    res.json({ success: true, data: gymClass });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/classes/:id', async (req, res) => {
  try {
    const gymClass = await GymClass.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.user.tenantId },
      { isActive: false },
      { new: true }
    );
    if (!gymClass) return res.status(404).json({ success: false, message: 'Class not found' });
    res.json({ success: true, data: gymClass });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/classes/:id/book', async (req, res) => {
  try {
    const { memberId, date } = req.body;
    const classId = req.params.id;
    const tenantId = req.user.tenantId;

    const gymClass = await GymClass.findOne({ _id: classId, tenantId });
    if (!gymClass) return res.status(404).json({ success: false, message: 'Class not found' });

    const existingBooking = await GymClassBooking.findOne({ classId, memberId, date, tenantId });
    if (existingBooking) return res.status(400).json({ success: false, message: 'Already booked for this date' });

    const confirmedCount = await GymClassBooking.countDocuments({ classId, date, status: 'confirmed', tenantId });
    
    let status = 'confirmed';
    let waitlistPosition = null;

    if (confirmedCount >= gymClass.capacity) {
      status = 'waitlisted';
      const waitlistedCount = await GymClassBooking.countDocuments({ classId, date, status: 'waitlisted', tenantId });
      waitlistPosition = waitlistedCount + 1;
    }

    const booking = new GymClassBooking({
      tenantId,
      classId,
      memberId,
      date,
      status,
      waitlistPosition
    });

    await booking.save();
    res.status(201).json({ success: true, data: booking });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/bookings/:bookingId/cancel', async (req, res) => {
  try {
    const booking = await GymClassBooking.findOne({ _id: req.params.bookingId, tenantId: req.user.tenantId });
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    const wasConfirmed = booking.status === 'confirmed';
    booking.status = 'cancelled';
    await booking.save();

    if (wasConfirmed) {
      const nextWaitlisted = await GymClassBooking.findOne({
        classId: booking.classId,
        date: booking.date,
        status: 'waitlisted',
        tenantId: req.user.tenantId
      }).sort({ waitlistPosition: 1 });

      if (nextWaitlisted) {
        nextWaitlisted.status = 'confirmed';
        nextWaitlisted.waitlistPosition = null;
        await nextWaitlisted.save();
      }
    }

    res.json({ success: true, data: booking });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/classes/:id/bookings', async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ success: false, message: 'Date query param is required' });

    const bookings = await GymClassBooking.find({
      classId: req.params.id,
      date,
      tenantId: req.user.tenantId
    }).populate('memberId', 'firstName lastName phone photoUrl');

    res.json({ success: true, data: bookings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});


// --- Trainers CRUD ---
router.get('/trainers', async (req, res) => {
  try {
    const query = { tenantId: req.user.tenantId };
    if (req.query.isActive !== undefined) query.isActive = req.query.isActive === 'true';

    const trainers = await GymTrainer.find(query).sort({ createdAt: -1 });
    res.json({ success: true, data: trainers });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/trainers', async (req, res) => {
  try {
    const trainer = new GymTrainer({
      ...req.body,
      tenantId: req.user.tenantId
    });
    await trainer.save();
    res.status(201).json({ success: true, data: trainer });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/trainers/:id', async (req, res) => {
  try {
    const trainer = await GymTrainer.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.user.tenantId },
      req.body,
      { new: true, runValidators: true }
    );
    if (!trainer) return res.status(404).json({ success: false, message: 'Trainer not found' });
    res.json({ success: true, data: trainer });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/trainers/:id', async (req, res) => {
  try {
    const trainer = await GymTrainer.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.user.tenantId },
      { isActive: false },
      { new: true }
    );
    if (!trainer) return res.status(404).json({ success: false, message: 'Trainer not found' });
    res.json({ success: true, data: trainer });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});


// --- PT Packages ---
router.get('/pt-packages', async (req, res) => {
  try {
    const { status, memberId } = req.query;
    const query = { tenantId: req.user.tenantId };
    if (status) query.status = status;
    if (memberId) query.memberId = memberId;

    const packages = await GymPTPackage.find(query)
      .populate('memberId', 'firstName lastName phone photoUrl')
      .populate('trainerId', 'nameEn nameAr')
      .sort({ createdAt: -1 });
      
    res.json({ success: true, data: packages });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/pt-packages', async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.user.tenantId);
    
    const ptPackage = new GymPTPackage({
      ...req.body,
      tenantId: req.user.tenantId,
      remainingSessions: req.body.totalSessions,
      currency: tenant?.settings?.currency || 'SAR',
      taxRate: getDefaultTaxRate(tenant)
    });
    
    await ptPackage.save();
    res.status(201).json({ success: true, data: ptPackage });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/pt-packages/:id/log-session', async (req, res) => {
  try {
    const ptPackage = await GymPTPackage.findOne({ _id: req.params.id, tenantId: req.user.tenantId });
    if (!ptPackage) return res.status(404).json({ success: false, message: 'Package not found' });
    if (ptPackage.remainingSessions <= 0) return res.status(400).json({ success: false, message: 'No sessions remaining' });

    ptPackage.sessionLog.push({
      date: new Date(),
      notes: req.body.notes
    });
    
    ptPackage.usedSessions += 1;
    ptPackage.remainingSessions -= 1;
    
    if (ptPackage.remainingSessions === 0) {
      ptPackage.status = 'exhausted';
    }

    await ptPackage.save();
    res.json({ success: true, data: ptPackage });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});


// --- Measurements ---
router.get('/measurements/member/:memberId', async (req, res) => {
  try {
    const measurements = await GymMeasurement.find({
      memberId: req.params.memberId,
      tenantId: req.user.tenantId
    }).sort({ date: -1 });
    res.json({ success: true, data: measurements });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/measurements', async (req, res) => {
  try {
    const data = { ...req.body, tenantId: req.user.tenantId };
    
    if (data.weight && data.height) {
      const heightInMeters = data.height / 100;
      data.bmi = Number((data.weight / (heightInMeters * heightInMeters)).toFixed(2));
    }

    const measurement = new GymMeasurement(data);
    await measurement.save();
    res.status(201).json({ success: true, data: measurement });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/measurements/:id', async (req, res) => {
  try {
    const data = { ...req.body };
    if (data.weight && data.height) {
      const heightInMeters = data.height / 100;
      data.bmi = Number((data.weight / (heightInMeters * heightInMeters)).toFixed(2));
    }

    const measurement = await GymMeasurement.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.user.tenantId },
      data,
      { new: true, runValidators: true }
    );
    if (!measurement) return res.status(404).json({ success: false, message: 'Measurement not found' });
    res.json({ success: true, data: measurement });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});


// --- Lockers ---
router.get('/lockers', async (req, res) => {
  try {
    const lockers = await GymLocker.find({ tenantId: req.user.tenantId })
      .populate('assignedMemberId', 'firstName lastName phone')
      .sort({ lockerNumber: 1 });
    res.json({ success: true, data: lockers });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/lockers', async (req, res) => {
  try {
    const locker = new GymLocker({
      ...req.body,
      tenantId: req.user.tenantId
    });
    await locker.save();
    res.status(201).json({ success: true, data: locker });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/lockers/:id/assign', async (req, res) => {
  try {
    const { assignedMemberId, assignedFrom, assignedUntil } = req.body;
    const locker = await GymLocker.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.user.tenantId },
      { 
        status: 'occupied',
        assignedMemberId,
        assignedFrom,
        assignedUntil
      },
      { new: true }
    );
    if (!locker) return res.status(404).json({ success: false, message: 'Locker not found' });
    res.json({ success: true, data: locker });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/lockers/:id/release', async (req, res) => {
  try {
    const locker = await GymLocker.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.user.tenantId },
      { 
        status: 'available',
        $unset: { assignedMemberId: 1, assignedFrom: 1, assignedUntil: 1 }
      },
      { new: true }
    );
    if (!locker) return res.status(404).json({ success: false, message: 'Locker not found' });
    res.json({ success: true, data: locker });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/lockers/:id/maintenance', async (req, res) => {
  try {
    const locker = await GymLocker.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.user.tenantId },
      { 
        status: 'maintenance',
        $unset: { assignedMemberId: 1, assignedFrom: 1, assignedUntil: 1 }
      },
      { new: true }
    );
    if (!locker) return res.status(404).json({ success: false, message: 'Locker not found' });
    res.json({ success: true, data: locker });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});


export default router;
