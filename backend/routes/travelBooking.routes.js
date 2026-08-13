import express from 'express';
import TravelBooking from '../models/TravelBooking.js';
import Invoice from '../models/Invoice.js';
import Customer from '../models/Customer.js';
import Tenant from '../models/Tenant.js';
import { protect, tenantFilter, checkPermission, requireBusinessType } from '../middleware/auth.js';
import { checkTrialLimits } from '../middleware/trialLimits.js';
import { enrichInvoiceArabicFields } from '../utils/invoiceArabic.js';
import { buildDraftInvoiceQr } from '../utils/zatca/draftInvoiceQr.js';
import { isZatcaCurrency } from '../utils/zatcaCurrency.js';

const router = express.Router();

router.use(protect);
router.use(tenantFilter);
router.use(requireBusinessType('travel_agency'));

async function generateBookingNumber(tenantFilterValue) {
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const d = String(today.getDate()).padStart(2, '0');
  const prefix = `TB-${y}${m}${d}`;

  const last = await TravelBooking.findOne({
    ...tenantFilterValue,
    bookingNumber: { $regex: `^${prefix}-` },
    isActive: true,
  })
    .sort({ createdAt: -1 })
    .select('bookingNumber');

  let seq = 1;
  if (last?.bookingNumber) {
    const parts = last.bookingNumber.split('-');
    const lastSeq = Number(parts[parts.length - 1]);
    if (Number.isFinite(lastSeq)) seq = lastSeq + 1;
  }

  return `${prefix}-${String(seq).padStart(3, '0')}`;
}

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeText(value) {
  return String(value || '').trim();
}

function buildCustomerPayloadFromBooking(booking = {}) {
  const name = normalizeText(booking?.customerName);
  if (!name || name.toLowerCase() === 'cash customer') return null;

  const email = normalizeText(booking?.customerEmail).toLowerCase();
  const phone = normalizeText(booking?.customerPhone);

  return {
    type: 'individual',
    name,
    email: email || undefined,
    phone: phone || undefined,
    mobile: phone || undefined,
    address: { country: 'SA' },
  };
}

async function ensureCustomerRecord(tenantId, booking = {}) {
  const payload = buildCustomerPayloadFromBooking(booking);
  if (!payload) return null;

  const lookupCandidates = [
    payload.email ? { email: payload.email } : null,
    payload.phone ? { phone: payload.phone } : null,
    payload.name ? { name: payload.name } : null,
  ].filter(Boolean);

  let customer = null;
  for (const candidate of lookupCandidates) {
    customer = await Customer.findOne({ tenantId, isActive: true, ...candidate });
    if (customer) break;
  }

  if (customer) {
    customer.name = payload.name || customer.name;
    customer.email = payload.email || customer.email;
    customer.phone = payload.phone || customer.phone;
    customer.mobile = payload.mobile || customer.mobile;
    await customer.save();
    return customer;
  }

  return await Customer.create({ tenantId, ...payload });
}

async function syncCustomerStats(tenantId, customerId) {
  try {
    if (!tenantId || !customerId) return;
    const stats = await Invoice.statsAggregate([
      {
        $match: {
          tenantId,
          customerId,
          status: { $nin: ['draft', 'cancelled', 'credited'] },
        },
      },
      {
        $group: {
          _id: '$customerId',
          totalInvoices: { $sum: 1 },
          totalRevenue: { $sum: '$grandTotal' },
          lastInvoiceDate: { $max: '$issueDate' },
        },
      },
    ]);

    const doc = stats[0];
    await Customer.updateOne(
      { _id: customerId, tenantId },
      doc
        ? {
            totalInvoices: doc.totalInvoices,
            totalRevenue: doc.totalRevenue,
            lastInvoiceDate: doc.lastInvoiceDate,
          }
        : { totalInvoices: 0, totalRevenue: 0, lastInvoiceDate: null }
    );
  } catch (error) {
    console.error('Failed to sync customer stats', error);
  }
}

function normalizeTotals(payload) {
  const subtotal = toNumber(payload?.subtotal, 0);
  const totalTax = toNumber(payload?.totalTax, 0);
  const grandTotal = toNumber(payload?.grandTotal, subtotal + totalTax);

  return {
    subtotal,
    totalTax,
    grandTotal,
  };
}

function sanitizeSegments(segments = []) {
  return (Array.isArray(segments) ? segments : [])
    .map((segment) => ({
      from: String(segment?.from || '').trim(),
      to: String(segment?.to || '').trim(),
    }))
    .filter((segment) => segment.from || segment.to);
}

function sanitizeBookingPayload(payload = {}) {
  const segments = sanitizeSegments(payload?.segments);
  const firstSegment = segments[0];
  const lastSegment = segments[segments.length - 1];
  const hasReturnDate = Boolean(payload?.hasReturnDate && payload?.returnDate);

  return {
    ...payload,
    routeFrom: String(payload?.routeFrom || firstSegment?.from || '').trim(),
    routeTo: String(payload?.routeTo || lastSegment?.to || '').trim(),
    segments,
    hasReturnDate,
    returnDate: hasReturnDate ? payload?.returnDate : undefined,
    layoverStay: String(payload?.layoverStay || '').trim(),
  };
}

router.get('/', checkPermission('travel', 'read'), async (req, res) => {
  try {
    const { page = 1, limit = 25, search, status, serviceType } = req.query;

    const query = { ...req.tenantFilter, isActive: true };

    if (status) query.status = status;
    if (serviceType) query.serviceType = serviceType;

    if (search) {
      query.$or = [
        { bookingNumber: { $regex: search, $options: 'i' } },
        { customerName: { $regex: search, $options: 'i' } },
        { customerEmail: { $regex: search, $options: 'i' } },
        { customerPhone: { $regex: search, $options: 'i' } },
      ];
    }

    const bookings = await TravelBooking.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await TravelBooking.countDocuments(query);

    res.json({
      bookings,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/stats', checkPermission('travel', 'read'), async (req, res) => {
  try {
    const stats = await TravelBooking.aggregate([
      { $match: { ...req.tenantFilter, isActive: true } },
      {
        $facet: {
          totals: [
            {
              $group: {
                _id: null,
                total: { $sum: 1 },
                revenue: { $sum: '$grandTotal' },
                open: {
                  $sum: {
                    $cond: [{ $in: ['$status', ['draft', 'confirmed', 'ticketed']] }, 1, 0],
                  },
                },
              },
            },
          ],
          byStatus: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
          byServiceType: [{ $group: { _id: '$serviceType', count: { $sum: 1 } } }],
        },
      },
    ]);

    res.json(stats?.[0] || {});
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', checkPermission('travel', 'read'), async (req, res) => {
  try {
    const booking = await TravelBooking.findOne({ _id: req.params.id, ...req.tenantFilter, isActive: true });
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    res.json(booking);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/create-invoice', checkPermission('travel', 'update'), checkPermission('invoicing', 'create'), async (req, res) => {
  try {
    const booking = await TravelBooking.findOne({ _id: req.params.id, ...req.tenantFilter, isActive: true });
    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    if (booking.invoiceId) {
      const existing = await Invoice.findOne({ _id: booking.invoiceId, ...req.tenantFilter });
      if (existing) {
        return res.json({ invoice: existing, booking });
      }
    }

    const tenant = await Tenant.findById(req.user.tenantId);
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    const lastInvoice = await Invoice.findOne({ tenantId: req.user.tenantId })
      .sort({ createdAt: -1 })
      .select('invoiceNumber');

    let invoiceCount = 1;
    if (lastInvoice?.invoiceNumber) {
      const maybe = parseInt(String(lastInvoice.invoiceNumber).split('-').pop());
      if (Number.isFinite(maybe)) invoiceCount = maybe + 1;
    }

    const invoiceNumber = `INV-${new Date().getFullYear()}-${String(invoiceCount).padStart(6, '0')}`;

    const bookingSubtotal = toNumber(booking.subtotal, 0);
    const bookingTotalTax = toNumber(booking.totalTax, 0);
    const bookingGrandTotal = toNumber(booking.grandTotal, bookingSubtotal + bookingTotalTax);

    let taxableAmount = bookingSubtotal;
    if (taxableAmount <= 0 && bookingGrandTotal > 0) {
      taxableAmount = Math.max(0, bookingGrandTotal - bookingTotalTax);
    }

    const taxRate = taxableAmount > 0 ? Math.round((bookingTotalTax / taxableAmount) * 10000) / 100 : 0;
    const customer = await ensureCustomerRecord(req.user.tenantId, booking);

    const invoiceData = {
      tenantId: req.user.tenantId,
      flow: 'sell',
      businessContext: 'travel_agency',
      invoiceNumber,
      invoiceSubtype: 'travel_ticket',
      pdfTemplateId: Number(tenant?.settings?.invoicePdfTemplate || 1),
      transactionType: 'B2C',
      invoiceTypeCode: '0200000',
      issueDate: new Date(),
      currency: booking.currency || 'SAR',
      contractNumber: booking.bookingNumber,
      travelBookingId: booking._id,
      customerId: customer?._id,
      status: 'pending',
      seller: {
        name: tenant.business.legalNameEn,
        nameAr: tenant.business.legalNameAr,
        vatNumber: tenant.business.vatNumber,
        crNumber: tenant.business.crNumber,
        address: tenant.business.address,
      },
      buyer: {
        name: booking.customerName || customer?.name || 'Cash Customer',
        nameAr: booking.customerName ? undefined : 'عميل نقدي',
        contactEmail: booking.customerEmail || customer?.email,
        contactPhone: booking.customerPhone || customer?.phone || customer?.mobile,
      },
      travelDetails: {
        travelerName: booking.travelerName || booking.customerName,
        passportNumber: booking.passportNumber,
        ticketNumber: booking.ticketNumber,
        pnr: booking.pnr,
        airlineName: booking.airlineName,
        routeFrom: booking.routeFrom,
        routeTo: booking.routeTo,
        segments: booking.segments || [],
        departureDate: booking.departureDate,
        hasReturnDate: Boolean(booking.hasReturnDate && booking.returnDate),
        returnDate: booking.hasReturnDate ? booking.returnDate : undefined,
        layoverStay: booking.layoverStay,
      },
      lineItems: [
        {
          lineNumber: 1,
          productName: `Travel Booking ${booking.bookingNumber}`,
          description: booking.serviceType ? `Service: ${booking.serviceType}` : undefined,
          quantity: 1,
          unitCode: 'PCE',
          unitPrice: taxableAmount,
          taxRate,
          taxCategory: 'S',
        },
      ],
      createdBy: req.user._id,
    };

    const enrichedInvoiceData = await enrichInvoiceArabicFields(invoiceData);
    const createdInvoice = await Invoice.create(enrichedInvoiceData);

    if (isZatcaCurrency(tenant)) {
      const draftQr = await buildDraftInvoiceQr({
        seller: tenant.business,
        issueDate: createdInvoice.issueDate,
        grandTotal: createdInvoice.grandTotal,
        totalTax: createdInvoice.totalTax,
      });

      createdInvoice.zatca = {
        ...(createdInvoice.zatca || {}),
        ...draftQr,
      };
    }

    const invoice = await createdInvoice.save();

    const updatedBooking = await TravelBooking.findOneAndUpdate(
      { _id: booking._id, ...req.tenantFilter },
      { invoiceId: invoice._id, invoiceNumber: invoice.invoiceNumber, invoicedAt: new Date(), status: booking.status === 'completed' ? 'completed' : 'ticketed' },
      { new: true }
    );

    if (customer?._id) {
      await syncCustomerStats(req.user.tenantId, customer._id);
    }

    res.status(201).json({ invoice, booking: updatedBooking });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', checkTrialLimits('travelBookings'), checkPermission('travel', 'create'), async (req, res) => {
  try {
    if (!req.user.tenantId) {
      return res.status(400).json({ error: 'No tenant associated with user' });
    }

    const bookingNumber = req.body.bookingNumber || (await generateBookingNumber(req.tenantFilter));
    const totals = normalizeTotals(req.body);
    const payload = sanitizeBookingPayload(req.body);

    const booking = await TravelBooking.create({
      ...payload,
      ...totals,
      bookingNumber,
      tenantId: req.user.tenantId,
      createdBy: req.user._id,
    });

    res.status(201).json(booking);
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(400).json({ error: 'Duplicate booking number' });
    }
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', checkPermission('travel', 'update'), async (req, res) => {
  try {
    const existing = await TravelBooking.findOne({ _id: req.params.id, ...req.tenantFilter, isActive: true });
    if (!existing) return res.status(404).json({ error: 'Booking not found' });

    const totals = normalizeTotals(req.body);
    const payload = sanitizeBookingPayload(req.body);

    const updated = await TravelBooking.findOneAndUpdate(
      { _id: req.params.id, ...req.tenantFilter },
      { ...payload, ...totals },
      { new: true, runValidators: true }
    );

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', checkPermission('travel', 'delete'), async (req, res) => {
  try {
    const booking = await TravelBooking.findOneAndUpdate(
      { _id: req.params.id, ...req.tenantFilter },
      { isActive: false },
      { new: true }
    );

    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    res.json({ message: 'Booking deactivated', booking });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
