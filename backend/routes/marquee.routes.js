import express from 'express';
import multer from 'multer';
import sharp from 'sharp';
import MarqueePackage from '../models/MarqueePackage.js';
import MarqueeAppointment from '../models/MarqueeAppointment.js';
import Customer from '../models/Customer.js';
import Tenant from '../models/Tenant.js';
import { protect, tenantFilter, requireTenantFilter, checkPermission } from '../middleware/auth.js';
import { recordUserActivity } from '../utils/auditLogger.js';
import { saveUploadBuffer } from '../utils/objectStorage.js';

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

// ─── Public endpoint for scanning QR Digital Menu at tables/hall entrance ─────
router.get('/public/menu/:tenantSlug', async (req, res) => {
  try {
    const { tenantSlug } = req.params;
    const tenant = await Tenant.findOne({ slug: tenantSlug }).select('name branding settings business');
    if (!tenant) return res.status(404).json({ error: 'Marquee not found' });

    const packages = await MarqueePackage.find({ tenantId: tenant._id, isActive: true })
      .sort({ ratePerHead: 1 })
      .lean();

    res.json({
      marqueeName: tenant.name,
      branding: tenant.branding,
      business: tenant.business,
      currency: tenant.settings?.currency || 'SAR',
      qrMenu: tenant.settings?.marquee?.qrMenu || {},
      packages,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── Protected Routes ────────────────────────────────────────────────────────
router.use(protect);
router.use(tenantFilter);
router.use(requireTenantFilter);

// ─── PACKAGES CRUD ───────────────────────────────────────────────────────────

// @route   GET /api/marquee/packages
// @desc    List all packages for tenant
router.get('/packages', checkPermission('invoicing', 'read'), async (req, res) => {
  try {
    const { search, category, isActive } = req.query;
    const query = { tenantId: req.user.tenantId };

    if (category) query.category = category;
    if (typeof isActive !== 'undefined') query.isActive = String(isActive) === 'true';

    if (search) {
      const q = String(search).trim();
      query.$or = [
        { name: { $regex: q, $options: 'i' } },
        { nameAr: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } },
      ];
    }

    const packages = await MarqueePackage.find(query).sort({ createdAt: -1 }).lean();
    res.json(packages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   GET /api/marquee/packages/:id
// @desc    Get single package
router.get('/packages/:id', checkPermission('invoicing', 'read'), async (req, res) => {
  try {
    const pkg = await MarqueePackage.findOne({ _id: req.params.id, tenantId: req.user.tenantId });
    if (!pkg) return res.status(404).json({ error: 'Package not found' });
    res.json(pkg);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   POST /api/marquee/packages
// @desc    Create new package
router.post('/packages', checkPermission('invoicing', 'create'), async (req, res) => {
  try {
    const {
      name,
      nameAr,
      category,
      description,
      descriptionAr,
      items,
      ratePerHead,
      hallBaseRent,
      minGuests,
      maxGuests,
      currency,
      taxRate,
      isActive,
      bannerImage,
    } = req.body;

    if (!name) return res.status(400).json({ error: 'Package name is required' });

    const tenantCurrency = req.tenant?.settings?.currency || currency || 'SAR';

    const pkg = await MarqueePackage.create({
      tenantId: req.user.tenantId,
      name: String(name).trim(),
      nameAr: nameAr ? String(nameAr).trim() : undefined,
      category: category || 'wedding',
      description,
      descriptionAr,
      items: Array.isArray(items) ? items : [],
      ratePerHead: Number(ratePerHead) || 0,
      hallBaseRent: Number(hallBaseRent) || 0,
      minGuests: Number(minGuests) || 50,
      maxGuests: Number(maxGuests) || 2000,
      currency: tenantCurrency,
      taxRate: Number(taxRate) || 0,
      isActive: typeof isActive === 'boolean' ? isActive : true,
      bannerImage,
      createdBy: req.user._id,
    });

    await recordUserActivity(req, {
      action: 'create',
      module: 'marquee',
      resourceType: 'MarqueePackage',
      resourceId: pkg._id,
      resourceName: pkg.name,
      description: `Created marquee package ${pkg.name} (${pkg.ratePerHead} / head)`,
      descriptionAr: `تم إنشاء باقة مناسبات جديدة ${pkg.name} (${pkg.ratePerHead} للشخص)`,
    });

    res.status(201).json(pkg);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   PUT /api/marquee/packages/:id
// @desc    Update package
router.put('/packages/:id', checkPermission('invoicing', 'update'), async (req, res) => {
  try {
    const pkg = await MarqueePackage.findOne({ _id: req.params.id, tenantId: req.user.tenantId });
    if (!pkg) return res.status(404).json({ error: 'Package not found' });

    const fields = [
      'name',
      'nameAr',
      'category',
      'description',
      'descriptionAr',
      'items',
      'ratePerHead',
      'hallBaseRent',
      'minGuests',
      'maxGuests',
      'currency',
      'taxRate',
      'isActive',
      'bannerImage',
    ];

    fields.forEach((f) => {
      if (typeof req.body[f] !== 'undefined') {
        pkg[f] = req.body[f];
      }
    });

    await pkg.save();

    await recordUserActivity(req, {
      action: 'update',
      module: 'marquee',
      resourceType: 'MarqueePackage',
      resourceId: pkg._id,
      resourceName: pkg.name,
      description: `Updated marquee package ${pkg.name}`,
      descriptionAr: `تم تحديث باقة المناسبات ${pkg.name}`,
    });

    res.json(pkg);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   DELETE /api/marquee/packages/:id
// @desc    Delete package
router.delete('/packages/:id', checkPermission('invoicing', 'delete'), async (req, res) => {
  try {
    const pkg = await MarqueePackage.findOne({ _id: req.params.id, tenantId: req.user.tenantId });
    if (!pkg) return res.status(404).json({ error: 'Package not found' });

    await MarqueePackage.deleteOne({ _id: pkg._id });

    await recordUserActivity(req, {
      action: 'delete',
      module: 'marquee',
      resourceType: 'MarqueePackage',
      resourceId: pkg._id,
      resourceName: pkg.name,
      description: `Deleted marquee package ${pkg.name}`,
      descriptionAr: `تم حذف باقة المناسبات ${pkg.name}`,
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── APPOINTMENTS & BOOKINGS ─────────────────────────────────────────────────

// @route   GET /api/marquee/appointments
// @desc    List marquee bookings/appointments
router.get('/appointments', checkPermission('invoicing', 'read'), async (req, res) => {
  try {
    const { startDate, endDate, status, hallName, eventShift, search, page = 1, limit = 50 } = req.query;
    const query = { tenantId: req.user.tenantId };

    if (status) query.status = status;
    if (hallName) query.hallName = hallName;
    if (eventShift) query.eventShift = eventShift;

    if (startDate || endDate) {
      query.eventDate = {};
      if (startDate) query.eventDate.$gte = new Date(startDate);
      if (endDate) query.eventDate.$lte = new Date(endDate);
    }

    if (search) {
      const q = String(search).trim();
      query.$or = [
        { bookingNumber: { $regex: q, $options: 'i' } },
        { title: { $regex: q, $options: 'i' } },
        { clientName: { $regex: q, $options: 'i' } },
        { clientPhone: { $regex: q, $options: 'i' } },
        { hallName: { $regex: q, $options: 'i' } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [bookings, total] = await Promise.all([
      MarqueeAppointment.find(query)
        .sort({ eventDate: 1, eventStartTime: 1 })
        .skip(skip)
        .limit(Number(limit))
        .populate('packageId', 'name ratePerHead')
        .populate('invoiceId', 'invoiceNumber grandTotal status')
        .populate('quotationId', 'quotationNumber grandTotal status')
        .lean(),
      MarqueeAppointment.countDocuments(query),
    ]);

    res.json({
      bookings,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   GET /api/marquee/appointments/check-conflict
// @desc    Check if hall/slot is already booked
router.get('/appointments/check-conflict', checkPermission('invoicing', 'read'), async (req, res) => {
  try {
    const { eventDate, eventShift, hallName, excludeBookingId } = req.query;
    if (!eventDate) return res.status(400).json({ error: 'eventDate is required' });

    const targetDate = new Date(eventDate);
    const startOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
    const endOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 59, 999);

    const query = {
      tenantId: req.user.tenantId,
      eventDate: { $gte: startOfDay, $lte: endOfDay },
      status: { $in: ['confirmed', 'tentative', 'in_progress'] },
    };

    if (eventShift && eventShift !== 'full_day') {
      query.$or = [{ eventShift }, { eventShift: 'full_day' }];
    }

    if (hallName) {
      query.hallName = hallName;
    }

    if (excludeBookingId) {
      query._id = { $ne: excludeBookingId };
    }

    const conflicting = await MarqueeAppointment.findOne(query).lean();

    res.json({
      isConflict: Boolean(conflicting),
      conflictingBooking: conflicting || null,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   POST /api/marquee/appointments
// @desc    Create new marquee booking/appointment
router.post('/appointments', checkPermission('invoicing', 'create'), async (req, res) => {
  try {
    const {
      title,
      titleAr,
      eventType,
      eventDate,
      eventShift,
      eventStartTime,
      eventEndTime,
      hallName,
      guestCount,
      customerId,
      clientName,
      clientPhone,
      clientEmail,
      packageId,
      packageName,
      ratePerHead,
      hallBaseRent,
      selectedItems,
      subtotal,
      taxRate,
      taxAmount,
      totalAmount,
      advancePaid,
      remainingAmount,
      stageTheme,
      colorTheme,
      specialRequests,
      notes,
      status,
    } = req.body;

    if (!title) return res.status(400).json({ error: 'Event title is required' });
    if (!eventDate) return res.status(400).json({ error: 'Event date is required' });
    if (!clientName) return res.status(400).json({ error: 'Client name is required' });
    if (!clientPhone) return res.status(400).json({ error: 'Client phone is required' });

    // Generate unique booking number
    const lastBooking = await MarqueeAppointment.findOne({ tenantId: req.user.tenantId })
      .sort({ createdAt: -1 })
      .select('bookingNumber');

    const nextSeq = lastBooking?.bookingNumber
      ? parseInt(String(lastBooking.bookingNumber).split('-').pop() || '0', 10) + 1
      : 1;

    const year = new Date(eventDate).getFullYear() || new Date().getFullYear();
    const bookingNumber = `MQ-${year}-${String(nextSeq).padStart(5, '0')}`;

    const tenantCurrency = req.tenant?.settings?.currency || 'SAR';

    const booking = await MarqueeAppointment.create({
      tenantId: req.user.tenantId,
      bookingNumber,
      title: String(title).trim(),
      titleAr,
      eventType: eventType || 'wedding',
      eventDate: new Date(eventDate),
      eventShift: eventShift || 'dinner',
      eventStartTime: eventStartTime || '19:00',
      eventEndTime: eventEndTime || '23:30',
      hallName: hallName || 'Grand Ballroom',
      guestCount: Number(guestCount) || 100,
      customerId: customerId || undefined,
      clientName: String(clientName).trim(),
      clientPhone: String(clientPhone).trim(),
      clientEmail,
      packageId: packageId || undefined,
      packageName,
      ratePerHead: Number(ratePerHead) || 0,
      hallBaseRent: Number(hallBaseRent) || 0,
      selectedItems: Array.isArray(selectedItems) ? selectedItems : [],
      subtotal: Number(subtotal) || 0,
      taxRate: Number(taxRate) || 0,
      taxAmount: Number(taxAmount) || 0,
      totalAmount: Number(totalAmount) || 0,
      advancePaid: Number(advancePaid) || 0,
      remainingAmount: Number(remainingAmount) || (Number(totalAmount) - Number(advancePaid || 0)),
      currency: tenantCurrency,
      stageTheme,
      colorTheme,
      specialRequests,
      notes,
      status: status || 'confirmed',
      createdBy: req.user._id,
    });

    await recordUserActivity(req, {
      action: 'create',
      module: 'marquee',
      resourceType: 'MarqueeAppointment',
      resourceId: booking._id,
      resourceName: `${booking.bookingNumber} (${booking.title})`,
      description: `Booked marquee event ${booking.title} on ${new Date(booking.eventDate).toLocaleDateString()} for ${booking.guestCount} guests`,
      descriptionAr: `تم حجز قاعة المناسبات لـ ${booking.title} بتاريخ ${new Date(booking.eventDate).toLocaleDateString()} لعدد ${booking.guestCount} ضيف`,
    });

    res.status(201).json(booking);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   PUT /api/marquee/appointments/:id
// @desc    Update marquee booking
router.put('/appointments/:id', checkPermission('invoicing', 'update'), async (req, res) => {
  try {
    const booking = await MarqueeAppointment.findOne({ _id: req.params.id, tenantId: req.user.tenantId });
    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    const fields = [
      'title',
      'titleAr',
      'eventType',
      'eventDate',
      'eventShift',
      'eventStartTime',
      'eventEndTime',
      'hallName',
      'guestCount',
      'customerId',
      'clientName',
      'clientPhone',
      'clientEmail',
      'packageId',
      'packageName',
      'ratePerHead',
      'hallBaseRent',
      'selectedItems',
      'subtotal',
      'taxRate',
      'taxAmount',
      'totalAmount',
      'advancePaid',
      'remainingAmount',
      'stageTheme',
      'colorTheme',
      'specialRequests',
      'notes',
      'status',
    ];

    fields.forEach((f) => {
      if (typeof req.body[f] !== 'undefined') {
        booking[f] = req.body[f];
      }
    });

    if (req.body.totalAmount || req.body.advancePaid) {
      const tot = Number(booking.totalAmount) || 0;
      const adv = Number(booking.advancePaid) || 0;
      booking.remainingAmount = Math.max(0, tot - adv);
    }

    await booking.save();

    await recordUserActivity(req, {
      action: 'update',
      module: 'marquee',
      resourceType: 'MarqueeAppointment',
      resourceId: booking._id,
      resourceName: `${booking.bookingNumber} (${booking.title})`,
      description: `Updated booking ${booking.bookingNumber} (${booking.title})`,
      descriptionAr: `تم تحديث حجز القاعة ${booking.bookingNumber} (${booking.title})`,
    });

    res.json(booking);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   DELETE /api/marquee/appointments/:id
// @desc    Cancel or delete booking
router.delete('/appointments/:id', checkPermission('invoicing', 'delete'), async (req, res) => {
  try {
    const booking = await MarqueeAppointment.findOne({ _id: req.params.id, tenantId: req.user.tenantId });
    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    booking.status = 'cancelled';
    await booking.save();

    await recordUserActivity(req, {
      action: 'delete',
      module: 'marquee',
      resourceType: 'MarqueeAppointment',
      resourceId: booking._id,
      resourceName: `${booking.bookingNumber} (${booking.title})`,
      description: `Cancelled marquee booking ${booking.bookingNumber}`,
      descriptionAr: `تم إلغاء حجز القاعة ${booking.bookingNumber}`,
    });

    res.json({ success: true, booking });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   GET /api/marquee/stats
// @desc    Get marquee metrics and dashboard KPIs
router.get('/stats', checkPermission('invoicing', 'read'), async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const [
      totalPackages,
      upcomingEvents,
      monthBookings,
      totalRevenueAgg,
      totalGuestsAgg,
    ] = await Promise.all([
      MarqueePackage.countDocuments({ tenantId, isActive: true }),
      MarqueeAppointment.countDocuments({ tenantId, eventDate: { $gte: now }, status: { $ne: 'cancelled' } }),
      MarqueeAppointment.countDocuments({ tenantId, eventDate: { $gte: startOfMonth, $lte: endOfMonth }, status: { $ne: 'cancelled' } }),
      MarqueeAppointment.aggregate([
        { $match: { tenantId, eventDate: { $gte: startOfMonth, $lte: endOfMonth }, status: { $ne: 'cancelled' } } },
        { $group: { _id: null, total: { $sum: '$totalAmount' }, advance: { $sum: '$advancePaid' } } },
      ]),
      MarqueeAppointment.aggregate([
        { $match: { tenantId, eventDate: { $gte: startOfMonth, $lte: endOfMonth }, status: { $ne: 'cancelled' } } },
        { $group: { _id: null, totalGuests: { $sum: '$guestCount' } } },
      ]),
    ]);

    res.json({
      activePackages: totalPackages,
      upcomingEvents,
      monthBookings,
      monthRevenue: totalRevenueAgg[0]?.total || 0,
      monthAdvanceReceived: totalRevenueAgg[0]?.advance || 0,
      monthTotalGuests: totalGuestsAgg[0]?.totalGuests || 0,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   POST /api/marquee/upload-image
// @desc    Upload package banner / photo
router.post('/upload-image', checkPermission('invoicing', 'write'), upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image uploaded' });

    const tenantIdStr = req.user.tenantId.toString();
    const filename = `marquee-pkg-${Date.now()}-${Math.round(Math.random() * 1E9)}.webp`;
    const key = `marquee/${tenantIdStr}/${filename}`;

    const buffer = await sharp(req.file.buffer)
      .resize({ width: 1200, withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer();

    const { url: imageUrl } = await saveUploadBuffer({
      buffer,
      key,
      contentType: 'image/webp',
      publicUrlPath: `/uploads/${key}`,
    });

    res.json({ imageUrl });
  } catch (error) {
    console.error('Marquee image upload error:', error);
    res.status(500).json({ error: 'Failed to process image' });
  }
});

// @route   POST /api/marquee/upload-hero
// @desc    Upload marquee public QR hero banner
router.post('/upload-hero', checkPermission('invoicing', 'write'), upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image uploaded' });

    const tenantIdStr = req.user.tenantId.toString();
    const filename = `marquee-hero-${Date.now()}-${Math.round(Math.random() * 1E9)}.webp`;
    const key = `marquee/${tenantIdStr}/${filename}`;

    const buffer = await sharp(req.file.buffer)
      .resize({ width: 1600, withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer();

    const { url: imageUrl } = await saveUploadBuffer({
      buffer,
      key,
      contentType: 'image/webp',
      publicUrlPath: `/uploads/${key}`,
    });

    res.json({ imageUrl });
  } catch (error) {
    console.error('Marquee hero upload error:', error);
    res.status(500).json({ error: 'Failed to process image' });
  }
});

// @route   GET /api/marquee/qr-settings
// @desc    Get marquee QR menu customization settings
router.get('/qr-settings', checkPermission('invoicing', 'read'), async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.user.tenantId).select('settings.marquee');
    res.json(tenant?.settings?.marquee?.qrMenu || {});
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   PUT /api/marquee/qr-settings
// @desc    Update marquee QR menu customization settings
router.put('/qr-settings', checkPermission('invoicing', 'write'), async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.user.tenantId);
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    if (!tenant.settings) tenant.settings = {};
    if (!tenant.settings.marquee) tenant.settings.marquee = {};
    
    tenant.settings.marquee.qrMenu = {
      ...(tenant.settings.marquee.qrMenu || {}),
      ...req.body,
    };

    tenant.markModified('settings.marquee');
    await tenant.save();

    res.json(tenant.settings.marquee.qrMenu);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
