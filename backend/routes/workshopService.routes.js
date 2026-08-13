import express from 'express';
import mongoose from 'mongoose';
import WorkshopServiceReminder from '../models/WorkshopServiceReminder.js';
import WorkshopVehicle from '../models/WorkshopVehicle.js';
import WorkshopJobCard from '../models/WorkshopJobCard.js';
import { protect, tenantFilter, requireTenantFilter } from '../middleware/auth.js';

const router = express.Router();
router.use(protect);
router.use(tenantFilter);
router.use(requireTenantFilter);

function getTenantFilter(req) {
  return { tenantId: new mongoose.Types.ObjectId(req.user.tenantId) };
}

// @route   GET /api/workshop/service-history/:vehicleId
router.get('/service-history/:vehicleId', async (req, res) => {
  try {
    const vehicle = await WorkshopVehicle.findOne({ _id: req.params.vehicleId, ...getTenantFilter(req) });
    if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });

    const jobCards = await WorkshopJobCard.find({
      ...getTenantFilter(req),
      vehicleId: vehicle._id,
    })
      .select('jobCardNumber status checkInDate expectedCompletion customerComplaints laborTotal partsTotal grandTotal invoiceId assignedMechanics partsUsed qcChecklist')
      .sort({ checkInDate: -1 })
      .lean();

    const reminders = await WorkshopServiceReminder.find({
      ...getTenantFilter(req),
      vehicleId: vehicle._id,
      status: { $ne: 'disabled' },
    }).sort({ nextDueDate: 1 }).lean();

    const totalSpent = jobCards.reduce((sum, jc) => sum + (jc.grandTotal || 0), 0);
    const completedJobs = jobCards.filter(jc => jc.status === 'delivered' || jc.status === 'invoiced').length;

    // Build timeline
    const timeline = [];
    jobCards.forEach(jc => {
      timeline.push({
        type: 'job_card',
        date: jc.checkInDate,
        title: `Job Card ${jc.jobCardNumber}`,
        status: jc.status,
        description: jc.customerComplaints?.join(', ') || '',
        cost: jc.grandTotal || 0,
        laborTotal: jc.laborTotal,
        partsTotal: jc.partsTotal,
        partsUsed: jc.partsUsed?.length || 0,
        mechanics: jc.assignedMechanics?.map(m => m.taskDescription).filter(Boolean) || [],
      });
    });

    reminders.forEach(r => {
      if (r.lastServiceDate) {
        timeline.push({
          type: 'service',
          date: r.lastServiceDate,
          title: r.customLabel || r.reminderType.replace(/_/g, ' '),
          description: `Last service at ${r.lastServiceKm || 0} km`,
        });
      }
    });

    timeline.sort((a, b) => new Date(b.date) - new Date(a.date));

    res.json({
      vehicle,
      timeline,
      jobCards,
      reminders,
      stats: {
        totalJobs: jobCards.length,
        completedJobs,
        totalSpent,
        activeReminders: reminders.filter(r => r.status === 'active').length,
        overdueReminders: reminders.filter(r => r.status === 'active' && r.nextDueDate && new Date(r.nextDueDate) < new Date()).length,
        currentOdometer: vehicle.currentOdometer,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   GET /api/workshop/reminders
router.get('/reminders', async (req, res) => {
  try {
    const { status, vehicleId, page = 1, limit = 50 } = req.query;
    const query = { ...getTenantFilter(req) };
    if (status) query.status = status;
    if (vehicleId) query.vehicleId = new mongoose.Types.ObjectId(vehicleId);

    const [reminders, total] = await Promise.all([
      WorkshopServiceReminder.find(query).sort({ nextDueDate: 1 }).skip((page - 1) * limit).limit(parseInt(limit)),
      WorkshopServiceReminder.countDocuments(query),
    ]);

    res.json({ reminders, pagination: { page: parseInt(page), limit: parseInt(limit), total } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   GET /api/workshop/reminders/dashboard
router.get('/reminders/dashboard', async (req, res) => {
  try {
    const now = new Date();
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const [active, overdue, upcoming, total] = await Promise.all([
      WorkshopServiceReminder.find({ ...getTenantFilter(req), status: 'active', nextDueDate: { $lt: now } }).sort({ nextDueDate: 1 }).lean(),
      WorkshopServiceReminder.countDocuments({ ...getTenantFilter(req), status: 'active', nextDueDate: { $lt: now } }),
      WorkshopServiceReminder.countDocuments({ ...getTenantFilter(req), status: 'active', nextDueDate: { $gte: now, $lte: in30Days } }),
      WorkshopServiceReminder.countDocuments({ ...getTenantFilter(req), status: 'active' }),
    ]);

    res.json({
      summary: { totalActive: total, overdue, upcoming, },
      overdueReminders: active,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   POST /api/workshop/reminders
router.post('/reminders', async (req, res) => {
  try {
    const { vehicleId } = req.body;
    const vehicle = await WorkshopVehicle.findOne({ _id: vehicleId, ...getTenantFilter(req) });
    if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });

    const vehicleDisplay = `${vehicle.make} ${vehicle.model} ${vehicle.year || ''} - ${vehicle.plateNumber}`.trim();

    // Compute next due date
    let nextDueDate = null;
    if (req.body.lastServiceDate && req.body.intervalDays) {
      nextDueDate = new Date(req.body.lastServiceDate);
      nextDueDate.setDate(nextDueDate.getDate() + req.body.intervalDays);
    } else if (req.body.intervalDays) {
      nextDueDate = new Date();
      nextDueDate.setDate(nextDueDate.getDate() + req.body.intervalDays);
    }

    const nextDueKm = req.body.lastServiceKm && req.body.intervalKm ? req.body.lastServiceKm + req.body.intervalKm : (req.body.intervalKm ? (vehicle.currentOdometer || 0) + req.body.intervalKm : null);

    const reminder = await WorkshopServiceReminder.create({
      ...req.body,
      vehicleDisplay,
      customerName: req.body.customerName || '',
      customerPhone: req.body.customerPhone || '',
      customerId: vehicle.customerId,
      nextDueDate,
      nextDueKm,
      tenantId: req.user.tenantId,
      createdBy: req.user._id,
    });

    res.status(201).json(reminder);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   PUT /api/workshop/reminders/:id
router.put('/reminders/:id', async (req, res) => {
  try {
    const reminder = await WorkshopServiceReminder.findOneAndUpdate(
      { _id: req.params.id, ...getTenantFilter(req) },
      req.body,
      { new: true, runValidators: true }
    );
    if (!reminder) return res.status(404).json({ error: 'Reminder not found' });
    res.json(reminder);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   PUT /api/workshop/reminders/:id/snooze
router.put('/reminders/:id/snooze', async (req, res) => {
  try {
    const { days = 7 } = req.body;
    const snoozedUntil = new Date();
    snoozedUntil.setDate(snoozedUntil.getDate() + days);

    const reminder = await WorkshopServiceReminder.findOneAndUpdate(
      { _id: req.params.id, ...getTenantFilter(req) },
      { status: 'snoozed', snoozedUntil },
      { new: true }
    );
    if (!reminder) return res.status(404).json({ error: 'Reminder not found' });
    res.json(reminder);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   PUT /api/workshop/reminders/:id/complete
router.put('/reminders/:id/complete', async (req, res) => {
  try {
    const { serviceDate, serviceKm } = req.body;
    const reminder = await WorkshopServiceReminder.findOne({ _id: req.params.id, ...getTenantFilter(req) });
    if (!reminder) return res.status(404).json({ error: 'Reminder not found' });

    reminder.lastServiceDate = serviceDate ? new Date(serviceDate) : new Date();
    reminder.lastServiceKm = serviceKm || reminder.lastServiceKm;
    reminder.status = 'completed';

    // Compute next due
    if (reminder.intervalDays) {
      reminder.nextDueDate = new Date(reminder.lastServiceDate);
      reminder.nextDueDate.setDate(reminder.nextDueDate.getDate() + reminder.intervalDays);
    }
    if (reminder.intervalKm && serviceKm) {
      reminder.nextDueKm = serviceKm + reminder.intervalKm;
    }

    // Reset and create new cycle
    reminder.alertSent = false;
    await reminder.save();

    res.json(reminder);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   DELETE /api/workshop/reminders/:id
router.delete('/reminders/:id', async (req, res) => {
  try {
    const reminder = await WorkshopServiceReminder.findOneAndDelete({ _id: req.params.id, ...getTenantFilter(req) });
    if (!reminder) return res.status(404).json({ error: 'Reminder not found' });
    res.json({ message: 'Reminder deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
