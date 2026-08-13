import express from 'express';
import mongoose from 'mongoose';
import SaloonAppointment from '../models/SaloonAppointment.js';
import SaloonService from '../models/SaloonService.js';
import SaloonOrder from '../models/SaloonOrder.js';
import { protect, tenantFilter, requireTenantFilter } from '../middleware/auth.js';

const router = express.Router();
router.use(protect);
router.use(tenantFilter);
router.use(requireTenantFilter);

function getTenantFilter(req) {
  return { tenantId: new mongoose.Types.ObjectId(req.user.tenantId) };
}

// @route   GET /api/saloon/appointments?date=YYYY-MM-DD
router.get('/', async (req, res) => {
  try {
    const { date, status, staffId, page = 1, limit = 50 } = req.query;
    const query = { ...getTenantFilter(req) };

    if (date) {
      const d = new Date(date);
      const next = new Date(d);
      next.setDate(next.getDate() + 1);
      query.date = { $gte: d, $lt: next };
    }
    if (status) query.status = status;
    if (staffId) query.staffId = new mongoose.Types.ObjectId(staffId);

    const [appointments, total] = await Promise.all([
      SaloonAppointment.find(query).sort({ startTime: 1 }).skip((page - 1) * limit).limit(parseInt(limit)),
      SaloonAppointment.countDocuments(query),
    ]);

    res.json({ appointments, pagination: { page: parseInt(page), limit: parseInt(limit), total } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   GET /api/saloon/appointments/commissions
router.get('/commissions', async (req, res) => {
  try {
    const { startDate, endDate, staffId } = req.query;
    const filter = { ...getTenantFilter(req), status: 'completed' };

    if (startDate || endDate) {
      filter.completedAt = {};
      if (startDate) filter.completedAt.$gte = new Date(startDate);
      if (endDate) filter.completedAt.$lte = new Date(endDate);
    }
    if (staffId) filter.staffId = new mongoose.Types.ObjectId(staffId);

    const commissions = await SaloonAppointment.aggregate([
      { $match: filter },
      {
        $group: {
          _id: { staffId: '$staffId', staffName: '$staffName' },
          totalAppointments: { $sum: 1 },
          totalRevenue: { $sum: '$servicePrice' },
          totalCommission: { $sum: '$commissionAmount' },
          paidCount: { $sum: { $cond: ['$commissionPaid', 1, 0] } },
          unpaidCommission: { $sum: { $cond: ['$commissionPaid', 0, '$commissionAmount'] } },
        },
      },
      { $sort: { totalCommission: -1 } },
    ]);

    const grandTotal = commissions.reduce((acc, c) => ({
      revenue: acc.revenue + c.totalRevenue,
      commission: acc.commission + c.totalCommission,
      unpaid: acc.unpaid + c.unpaidCommission,
    }), { revenue: 0, commission: 0, unpaid: 0 });

    res.json({ byStaff: commissions, grandTotal });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   POST /api/saloon/appointments
router.post('/', async (req, res) => {
  try {
    const { serviceId, commissionPercent = 0 } = req.body;

    let serviceData = {};
    if (serviceId) {
      const service = await SaloonService.findOne({ _id: serviceId, ...getTenantFilter(req) });
      if (!service) return res.status(404).json({ error: 'Service not found' });
      serviceData = {
        serviceName: service.nameEn,
        servicePrice: service.price,
        durationMinutes: service.durationMinutes,
      };
    }

    // Compute end time
    const startHour = parseInt(req.body.startTime?.split(':')[0] || '0');
    const startMin = parseInt(req.body.startTime?.split(':')[1] || '0');
    const duration = serviceData.durationMinutes || req.body.durationMinutes || 30;
    const endMinutes = startHour * 60 + startMin + duration;
    const endTime = `${String(Math.floor(endMinutes / 60) % 24).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`;

    // Check staff conflict
    if (req.body.staffId) {
      const apptDate = new Date(req.body.date);
      const nextDay = new Date(apptDate);
      nextDay.setDate(nextDay.getDate() + 1);

      const conflict = await SaloonAppointment.findOne({
        ...getTenantFilter(req),
        staffId: req.body.staffId,
        date: { $gte: apptDate, $lt: nextDay },
        status: { $in: ['booked', 'confirmed', 'in_progress'] },
        startTime: req.body.startTime,
      });
      if (conflict) return res.status(409).json({ error: 'Staff already has an appointment at this time' });
    }

    const commissionAmount = Math.round((serviceData.servicePrice || 0) * commissionPercent / 100 * 100) / 100;

    const appointment = await SaloonAppointment.create({
      ...req.body,
      ...serviceData,
      endTime,
      commissionPercent,
      commissionAmount,
      tenantId: req.user.tenantId,
      createdBy: req.user._id,
    });

    res.status(201).json(appointment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   PUT /api/saloon/appointments/:id/status
router.put('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const appointment = await SaloonAppointment.findOne({ _id: req.params.id, ...getTenantFilter(req) });
    if (!appointment) return res.status(404).json({ error: 'Appointment not found' });

    appointment.status = status;
    if (status === 'completed') appointment.completedAt = new Date();
    else if (status === 'cancelled') { appointment.cancelledAt = new Date(); appointment.cancelReason = req.body.reason || ''; }
    else if (status === 'in_progress') { /* nothing extra */ }

    await appointment.save();
    res.json(appointment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   PUT /api/saloon/appointments/:id/commission/pay
router.put('/:id/commission/pay', async (req, res) => {
  try {
    const appointment = await SaloonAppointment.findOne({ _id: req.params.id, ...getTenantFilter(req) });
    if (!appointment) return res.status(404).json({ error: 'Appointment not found' });

    appointment.commissionPaid = true;
    appointment.commissionPaidAt = new Date();
    await appointment.save();

    res.json({ message: 'Commission marked as paid', appointment });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   PUT /api/saloon/appointments/:id
router.put('/:id', async (req, res) => {
  try {
    const appointment = await SaloonAppointment.findOneAndUpdate(
      { _id: req.params.id, ...getTenantFilter(req) },
      req.body,
      { new: true, runValidators: true }
    );
    if (!appointment) return res.status(404).json({ error: 'Appointment not found' });
    res.json(appointment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   DELETE /api/saloon/appointments/:id
router.delete('/:id', async (req, res) => {
  try {
    const appointment = await SaloonAppointment.findOneAndDelete({ _id: req.params.id, ...getTenantFilter(req) });
    if (!appointment) return res.status(404).json({ error: 'Appointment not found' });
    res.json({ message: 'Appointment deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
