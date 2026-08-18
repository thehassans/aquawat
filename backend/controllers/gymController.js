import mongoose from 'mongoose';
import GymMember from '../models/GymMember.js';
import GymPlan from '../models/GymPlan.js';
import GymSubscription from '../models/GymSubscription.js';
import GymAttendance from '../models/GymAttendance.js';
import GymClass from '../models/GymClass.js';
import GymMeasurement from '../models/GymMeasurement.js';
import GymLocker from '../models/GymLocker.js';

// ─── DASHBOARD STATS ──────────────────────────────────────────────────────────
export const getDashboardStats = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Active & Total Members
    const totalMembers = await GymMember.countDocuments({ tenantId });
    const activeMembers = await GymMember.countDocuments({ tenantId, status: 'active' });
    const frozenMembers = await GymMember.countDocuments({ tenantId, status: 'frozen' });
    const newMembersThisMonth = await GymMember.countDocuments({
      tenantId,
      createdAt: { $gte: firstDayOfMonth },
    });

    // Subscriptions Status
    const expiringSoon = await GymSubscription.countDocuments({
      tenantId,
      status: 'active',
      endDate: { $gte: now, $lte: sevenDaysFromNow },
    });

    const expiredSubscriptions = await GymSubscription.countDocuments({
      tenantId,
      status: 'expired',
    });

    // Check-ins Today
    const todayCheckIns = await GymAttendance.countDocuments({
      tenantId,
      checkInTime: { $gte: todayStart },
      accessStatus: 'granted',
    });

    // Live Floor Occupancy (Checked in today, no checkout, within last 3 hours)
    const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000);
    const liveOccupancy = await GymAttendance.countDocuments({
      tenantId,
      checkInTime: { $gte: threeHoursAgo },
      checkOutTime: { $exists: false },
      accessStatus: 'granted',
    });

    // Revenue this month
    const subscriptionsThisMonth = await GymSubscription.find({
      tenantId,
      startDate: { $gte: firstDayOfMonth },
    }).select('pricePaid currency');

    const revenueByCurrency = {};
    subscriptionsThisMonth.forEach((sub) => {
      const cur = sub.currency || 'SAR';
      revenueByCurrency[cur] = (revenueByCurrency[cur] || 0) + Number(sub.pricePaid || 0);
    });

    // Today's Classes
    const todayDayOfWeek = now.getDay();
    const todayClasses = await GymClass.find({
      tenantId,
      isActive: true,
      daysOfWeek: todayDayOfWeek,
    }).sort({ startTime: 1 });

    // Recent Check-ins feed
    const recentCheckIns = await GymAttendance.find({ tenantId })
      .sort({ checkInTime: -1 })
      .limit(10)
      .populate('memberId', 'memberNumber nameEn nameAr phone photoUrl gender');

    res.json({
      success: true,
      stats: {
        totalMembers,
        activeMembers,
        frozenMembers,
        newMembersThisMonth,
        expiringSoon,
        expiredSubscriptions,
        todayCheckIns,
        liveOccupancy,
        revenueByCurrency,
      },
      todayClasses,
      recentCheckIns,
    });
  } catch (error) {
    console.error('Error fetching gym dashboard stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ─── MEMBER CRUD ─────────────────────────────────────────────────────────────
export const getMembers = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { page = 1, limit = 20, search = '', status, gender } = req.query;

    const query = { tenantId };

    if (status) query.status = status;
    if (gender) query.gender = gender;

    if (search) {
      const regex = new RegExp(search.trim(), 'i');
      query.$or = [
        { nameEn: regex },
        { nameAr: regex },
        { phone: regex },
        { memberNumber: regex },
        { identityNumber: regex },
        { barcode: regex },
        { email: regex },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await GymMember.countDocuments(query);
    const members = await GymMember.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('activeSubscriptionId')
      .populate('assignedTrainerId', 'firstName lastName firstNameAr lastNameAr');

    res.json({
      success: true,
      members,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Error fetching gym members:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getMemberById = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { id } = req.params;

    const member = await GymMember.findOne({ _id: id, tenantId })
      .populate({
        path: 'activeSubscriptionId',
        populate: { path: 'planId' },
      })
      .populate('assignedTrainerId', 'firstName lastName');

    if (!member) {
      return res.status(404).json({ success: false, error: 'Member not found' });
    }

    // Fetch subscription history
    const subscriptions = await GymSubscription.find({ memberId: id, tenantId })
      .sort({ createdAt: -1 })
      .populate('planId');

    // Fetch attendance history
    const attendances = await GymAttendance.find({ memberId: id, tenantId })
      .sort({ checkInTime: -1 })
      .limit(30);

    // Fetch InBody measurements
    const measurements = await GymMeasurement.find({ memberId: id, tenantId })
      .sort({ date: -1 });

    // Fetch active locker rental
    const locker = await GymLocker.findOne({ currentMemberId: id, tenantId, status: 'occupied' });

    res.json({
      success: true,
      member,
      subscriptions,
      attendances,
      measurements,
      locker,
    });
  } catch (error) {
    console.error('Error fetching gym member details:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

export const createMember = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const {
      nameEn,
      nameAr,
      email,
      phone,
      gender,
      dob,
      identityType,
      identityNumber,
      photoUrl,
      emergencyContact,
      medicalConditions,
      fitnessGoal,
      preferredLanguage,
      notes,
    } = req.body;

    if (!nameEn || !phone) {
      return res.status(400).json({ success: false, error: 'Name and Phone are required' });
    }

    // Generate unique member number e.g. GYM-2026-00001
    const currentYear = new Date().getFullYear();
    const count = await GymMember.countDocuments({ tenantId });
    const memberNumber = `GYM-${currentYear}-${String(count + 1).padStart(5, '0')}`;
    const barcode = memberNumber.replace(/-/g, '');

    const member = new GymMember({
      tenantId,
      memberNumber,
      nameEn,
      nameAr: nameAr || '',
      email: email || '',
      phone,
      gender: gender || 'male',
      dob: dob || undefined,
      identityType: identityType || 'national_id',
      identityNumber: identityNumber || '',
      photoUrl: photoUrl || '',
      barcode,
      rfidCardNumber: barcode,
      emergencyContact: emergencyContact || {},
      medicalConditions: medicalConditions || '',
      fitnessGoal: fitnessGoal || 'general_fitness',
      preferredLanguage: preferredLanguage || 'en',
      notes: notes || '',
      status: 'active',
    });

    await member.save();
    res.status(201).json({ success: true, member });
  } catch (error) {
    console.error('Error creating gym member:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

export const updateMember = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { id } = req.params;

    const member = await GymMember.findOneAndUpdate(
      { _id: id, tenantId },
      { $set: req.body },
      { new: true }
    );

    if (!member) {
      return res.status(404).json({ success: false, error: 'Member not found' });
    }

    res.json({ success: true, member });
  } catch (error) {
    console.error('Error updating gym member:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

export const deleteMember = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { id } = req.params;

    const member = await GymMember.findOneAndDelete({ _id: id, tenantId });
    if (!member) {
      return res.status(404).json({ success: false, error: 'Member not found' });
    }

    await GymSubscription.deleteMany({ memberId: id, tenantId });
    await GymAttendance.deleteMany({ memberId: id, tenantId });
    await GymMeasurement.deleteMany({ memberId: id, tenantId });

    res.json({ success: true, message: 'Member deleted successfully' });
  } catch (error) {
    console.error('Error deleting gym member:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ─── PLANS CRUD ──────────────────────────────────────────────────────────────
export const getPlans = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const plans = await GymPlan.find({ tenantId }).sort({ sortOrder: 1, createdAt: 1 });
    res.json({ success: true, plans });
  } catch (error) {
    console.error('Error fetching gym plans:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

export const createPlan = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const {
      nameEn,
      nameAr,
      description,
      durationDays = 30,
      durationMonths = 1,
      price,
      currency = 'SAR',
      taxRate = 15,
      accessType = 'all_day',
      allowedFreezeDays = 7,
      branchAccess = 'single_branch',
      includedPtSessions = 0,
      includedClasses = -1,
      includedLocker = false,
      features = [],
      isPopular = false,
    } = req.body;

    const count = await GymPlan.countDocuments({ tenantId });
    const planCode = `PLAN-${String(count + 1).padStart(3, '0')}`;

    const plan = new GymPlan({
      tenantId,
      planCode,
      nameEn,
      nameAr: nameAr || '',
      description: description || '',
      durationDays: Number(durationDays),
      durationMonths: Number(durationMonths),
      price: Number(price || 0),
      currency,
      taxRate: Number(taxRate || 0),
      accessType,
      allowedFreezeDays: Number(allowedFreezeDays),
      branchAccess,
      includedPtSessions: Number(includedPtSessions),
      includedClasses: Number(includedClasses),
      includedLocker: Boolean(includedLocker),
      features: features || [],
      isPopular: Boolean(isPopular),
      isActive: true,
    });

    await plan.save();
    res.status(201).json({ success: true, plan });
  } catch (error) {
    console.error('Error creating gym plan:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

export const updatePlan = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { id } = req.params;

    const plan = await GymPlan.findOneAndUpdate(
      { _id: id, tenantId },
      { $set: req.body },
      { new: true }
    );

    if (!plan) {
      return res.status(404).json({ success: false, error: 'Plan not found' });
    }

    res.json({ success: true, plan });
  } catch (error) {
    console.error('Error updating gym plan:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

export const deletePlan = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { id } = req.params;

    const plan = await GymPlan.findOneAndDelete({ _id: id, tenantId });
    if (!plan) {
      return res.status(404).json({ success: false, error: 'Plan not found' });
    }

    res.json({ success: true, message: 'Plan deleted successfully' });
  } catch (error) {
    console.error('Error deleting gym plan:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ─── SUBSCRIPTIONS ───────────────────────────────────────────────────────────
export const getSubscriptions = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { status, memberId } = req.query;

    const query = { tenantId };
    if (status) query.status = status;
    if (memberId) query.memberId = memberId;

    const subscriptions = await GymSubscription.find(query)
      .sort({ createdAt: -1 })
      .populate('memberId', 'memberNumber nameEn nameAr phone photoUrl')
      .populate('planId');

    res.json({ success: true, subscriptions });
  } catch (error) {
    console.error('Error fetching gym subscriptions:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

export const createSubscription = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const {
      memberId,
      planId,
      startDate = new Date(),
      pricePaid,
      currency = 'SAR',
      discountAmount = 0,
      paymentMethod = 'card',
      notes,
    } = req.body;

    const plan = await GymPlan.findOne({ _id: planId, tenantId });
    if (!plan) {
      return res.status(404).json({ success: false, error: 'Gym Plan not found' });
    }

    const member = await GymMember.findOne({ _id: memberId, tenantId });
    if (!member) {
      return res.status(404).json({ success: false, error: 'Gym Member not found' });
    }

    const start = new Date(startDate);
    const end = new Date(start);
    end.setDate(end.getDate() + (plan.durationDays || 30));

    const currentYear = new Date().getFullYear();
    const count = await GymSubscription.countDocuments({ tenantId });
    const subscriptionNumber = `SUB-${currentYear}-${String(count + 1).padStart(5, '0')}`;

    const subscription = new GymSubscription({
      tenantId,
      subscriptionNumber,
      memberId,
      planId,
      startDate: start,
      endDate: end,
      pricePaid: Number(pricePaid !== undefined ? pricePaid : plan.price),
      currency: currency || plan.currency,
      discountAmount: Number(discountAmount || 0),
      paymentMethod,
      status: 'active',
      remainingPtSessions: plan.includedPtSessions || 0,
      notes: notes || '',
    });

    await subscription.save();

    // Link to member and set active
    member.activeSubscriptionId = subscription._id;
    member.status = 'active';
    await member.save();

    res.status(201).json({ success: true, subscription });
  } catch (error) {
    console.error('Error creating gym subscription:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

export const freezeSubscription = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { id } = req.params;
    const { freezeDays = 7, freezeReason = '' } = req.body;

    const subscription = await GymSubscription.findOne({ _id: id, tenantId }).populate('planId');
    if (!subscription) {
      return res.status(404).json({ success: false, error: 'Subscription not found' });
    }

    const maxFreeze = subscription.planId?.allowedFreezeDays || 14;
    const alreadyUsed = subscription.freezeDaysUsed || 0;
    if (alreadyUsed + Number(freezeDays) > maxFreeze) {
      return res.status(400).json({
        success: false,
        error: `Freeze allowance exceeded. Plan allows max ${maxFreeze} days (${alreadyUsed} days already used).`,
      });
    }

    const now = new Date();
    const resumeDate = new Date(now.getTime() + Number(freezeDays) * 24 * 60 * 60 * 1000);

    subscription.status = 'frozen';
    subscription.freezeStartDate = now;
    subscription.freezeEndDate = resumeDate;
    subscription.freezeDaysUsed = alreadyUsed + Number(freezeDays);
    subscription.freezeReason = freezeReason;

    // Extend subscription end date by freeze days
    const currentEnd = new Date(subscription.endDate);
    currentEnd.setDate(currentEnd.getDate() + Number(freezeDays));
    subscription.endDate = currentEnd;

    await subscription.save();

    // Update member status
    await GymMember.findOneAndUpdate(
      { _id: subscription.memberId, tenantId },
      { status: 'frozen' }
    );

    res.json({ success: true, subscription, message: 'Subscription frozen successfully' });
  } catch (error) {
    console.error('Error freezing subscription:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

export const unfreezeSubscription = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { id } = req.params;

    const subscription = await GymSubscription.findOne({ _id: id, tenantId });
    if (!subscription) {
      return res.status(404).json({ success: false, error: 'Subscription not found' });
    }

    subscription.status = 'active';
    subscription.freezeStartDate = undefined;
    subscription.freezeEndDate = undefined;
    await subscription.save();

    await GymMember.findOneAndUpdate(
      { _id: subscription.memberId, tenantId },
      { status: 'active' }
    );

    res.json({ success: true, subscription, message: 'Subscription reactivated' });
  } catch (error) {
    console.error('Error unfreezing subscription:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ─── CHECK-IN & KIOSK SCANNER ────────────────────────────────────────────────
export const processCheckIn = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { scanData, accessPoint = 'kiosk_scanner', accessMethod = 'qr_scan' } = req.body;

    if (!scanData) {
      return res.status(400).json({ success: false, error: 'Scan data / Member code required' });
    }

    const cleanInput = String(scanData).trim();

    // Find member by barcode, memberNumber, phone, RFID, or ID
    const member = await GymMember.findOne({
      tenantId,
      $or: [
        { barcode: cleanInput },
        { memberNumber: cleanInput },
        { phone: cleanInput },
        { rfidCardNumber: cleanInput },
        { identityNumber: cleanInput },
      ],
    }).populate({
      path: 'activeSubscriptionId',
      populate: { path: 'planId' },
    });

    if (!member) {
      // Record denied attendance
      return res.json({
        success: false,
        granted: false,
        reason: 'not_found',
        message: 'Member not found in database / العضو غير مسجل',
      });
    }

    const sub = member.activeSubscriptionId;
    const now = new Date();

    // Check if member has an active subscription
    if (!sub) {
      await GymAttendance.create({
        tenantId,
        memberId: member._id,
        accessPoint,
        accessMethod,
        accessStatus: 'denied',
        denialReason: 'expired_plan',
      });

      return res.json({
        success: false,
        granted: false,
        member,
        reason: 'no_subscription',
        message: 'No active subscription / لا يوجد اشتراك نشط',
      });
    }

    // Check if subscription is frozen
    if (sub.status === 'frozen' || member.status === 'frozen') {
      await GymAttendance.create({
        tenantId,
        memberId: member._id,
        subscriptionId: sub._id,
        accessPoint,
        accessMethod,
        accessStatus: 'denied',
        denialReason: 'frozen_subscription',
      });

      return res.json({
        success: false,
        granted: false,
        member,
        subscription: sub,
        reason: 'frozen',
        message: 'Subscription is currently frozen / الاشتراك معلق ومجمد حالياً',
      });
    }

    // Check if subscription has expired
    if (new Date(sub.endDate) < now || sub.status === 'expired') {
      sub.status = 'expired';
      member.status = 'expired';
      await sub.save();
      await member.save();

      await GymAttendance.create({
        tenantId,
        memberId: member._id,
        subscriptionId: sub._id,
        accessPoint,
        accessMethod,
        accessStatus: 'denied',
        denialReason: 'expired_plan',
      });

      return res.json({
        success: false,
        granted: false,
        member,
        subscription: sub,
        reason: 'expired',
        message: `Subscription expired on ${new Date(sub.endDate).toLocaleDateString()} / انتهت صلاحية الاشتراك`,
      });
    }

    // Check Access Timing rules (e.g. morning offpeak vs ladies only)
    const currentHour = now.getHours();
    const plan = sub.planId;
    if (plan?.accessType === 'morning_offpeak' && (currentHour < 6 || currentHour >= 13)) {
      await GymAttendance.create({
        tenantId,
        memberId: member._id,
        subscriptionId: sub._id,
        accessPoint,
        accessMethod,
        accessStatus: 'denied',
        denialReason: 'offpeak_restriction',
      });

      return res.json({
        success: false,
        granted: false,
        member,
        subscription: sub,
        reason: 'offpeak_restriction',
        message: 'Off-peak membership restricted to 6:00 AM - 1:00 PM / اشتراك صباحي خارج أوقات الذروة',
      });
    }

    // ACCESS GRANTED!
    const attendance = await GymAttendance.create({
      tenantId,
      memberId: member._id,
      subscriptionId: sub._id,
      accessPoint,
      accessMethod,
      accessStatus: 'granted',
      denialReason: 'none',
      checkInTime: now,
    });

    const daysRemaining = Math.max(0, Math.ceil((new Date(sub.endDate) - now) / (1000 * 60 * 60 * 24)));

    res.json({
      success: true,
      granted: true,
      member,
      subscription: sub,
      daysRemaining,
      attendanceId: attendance._id,
      message: 'Access Granted! Welcome to the gym! / تم تسجيل الدخول بنجاح',
    });
  } catch (error) {
    console.error('Error processing gym check-in:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getAttendanceLogs = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { page = 1, limit = 50, memberId, status } = req.query;

    const query = { tenantId };
    if (memberId) query.memberId = memberId;
    if (status) query.accessStatus = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await GymAttendance.countDocuments(query);
    const logs = await GymAttendance.find(query)
      .sort({ checkInTime: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('memberId', 'memberNumber nameEn nameAr phone photoUrl gender');

    res.json({
      success: true,
      logs,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Error fetching attendance logs:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ─── CLASSES & TIMETABLE ─────────────────────────────────────────────────────
export const getClasses = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const classes = await GymClass.find({ tenantId })
      .sort({ startTime: 1 })
      .populate('attendees.memberId', 'memberNumber nameEn nameAr phone photoUrl');

    res.json({ success: true, classes });
  } catch (error) {
    console.error('Error fetching gym classes:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

export const createClass = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const gymClass = new GymClass({
      ...req.body,
      tenantId,
    });
    await gymClass.save();
    res.status(201).json({ success: true, gymClass });
  } catch (error) {
    console.error('Error creating gym class:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

export const updateClass = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { id } = req.params;
    const gymClass = await GymClass.findOneAndUpdate(
      { _id: id, tenantId },
      { $set: req.body },
      { new: true }
    );
    if (!gymClass) return res.status(404).json({ success: false, error: 'Class not found' });
    res.json({ success: true, gymClass });
  } catch (error) {
    console.error('Error updating gym class:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

export const bookClassMember = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { id } = req.params;
    const { memberId } = req.body;

    const gymClass = await GymClass.findOne({ _id: id, tenantId });
    if (!gymClass) return res.status(404).json({ success: false, error: 'Class not found' });

    if (gymClass.attendees.length >= gymClass.capacity) {
      return res.status(400).json({ success: false, error: 'Class is already at full capacity' });
    }

    const alreadyBooked = gymClass.attendees.some(a => String(a.memberId) === String(memberId));
    if (alreadyBooked) {
      return res.status(400).json({ success: false, error: 'Member is already booked in this class' });
    }

    gymClass.attendees.push({
      memberId,
      bookedAt: new Date(),
      attended: false,
    });

    await gymClass.save();
    res.json({ success: true, gymClass, message: 'Class booked successfully' });
  } catch (error) {
    console.error('Error booking class:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

export const deleteClass = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { id } = req.params;
    const gymClass = await GymClass.findOneAndDelete({ _id: id, tenantId });
    if (!gymClass) return res.status(404).json({ success: false, error: 'Class not found' });
    res.json({ success: true, message: 'Class deleted successfully' });
  } catch (error) {
    console.error('Error deleting gym class:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ─── INBODY & MEASUREMENTS ───────────────────────────────────────────────────
export const getMemberMeasurements = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { memberId } = req.params;
    const measurements = await GymMeasurement.find({ memberId, tenantId }).sort({ date: -1 });
    res.json({ success: true, measurements });
  } catch (error) {
    console.error('Error fetching measurements:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

export const createMeasurement = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const measurement = new GymMeasurement({
      ...req.body,
      tenantId,
    });
    await measurement.save();
    res.status(201).json({ success: true, measurement });
  } catch (error) {
    console.error('Error creating measurement:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ─── LOCKER RENTALS ──────────────────────────────────────────────────────────
export const getLockers = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const lockers = await GymLocker.find({ tenantId })
      .sort({ lockerNumber: 1 })
      .populate('currentMemberId', 'memberNumber nameEn nameAr phone');

    res.json({ success: true, lockers });
  } catch (error) {
    console.error('Error fetching lockers:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

export const createLocker = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const locker = new GymLocker({
      ...req.body,
      tenantId,
    });
    await locker.save();
    res.status(201).json({ success: true, locker });
  } catch (error) {
    console.error('Error creating locker:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

export const assignLocker = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { id } = req.params;
    const { memberId, rentalDays = 30, keyPinCode, rentalFee, depositAmount } = req.body;

    const locker = await GymLocker.findOne({ _id: id, tenantId });
    if (!locker) return res.status(404).json({ success: false, error: 'Locker not found' });

    const start = new Date();
    const end = new Date(start);
    end.setDate(end.getDate() + Number(rentalDays));

    locker.status = 'occupied';
    locker.currentMemberId = memberId;
    locker.rentalStartDate = start;
    locker.rentalEndDate = end;
    if (keyPinCode) locker.keyPinCode = keyPinCode;
    if (rentalFee !== undefined) locker.rentalFee = Number(rentalFee);
    if (depositAmount !== undefined) locker.depositAmount = Number(depositAmount);

    await locker.save();
    res.json({ success: true, locker, message: 'Locker assigned successfully' });
  } catch (error) {
    console.error('Error assigning locker:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

export const releaseLocker = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { id } = req.params;

    const locker = await GymLocker.findOne({ _id: id, tenantId });
    if (!locker) return res.status(404).json({ success: false, error: 'Locker not found' });

    locker.status = 'available';
    locker.currentMemberId = undefined;
    locker.rentalStartDate = undefined;
    locker.rentalEndDate = undefined;
    locker.keyPinCode = '';

    await locker.save();
    res.json({ success: true, locker, message: 'Locker released to available' });
  } catch (error) {
    console.error('Error releasing locker:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};
