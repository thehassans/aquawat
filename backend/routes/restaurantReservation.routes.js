import express from 'express';
import mongoose from 'mongoose';
import RestaurantReservation from '../models/RestaurantReservation.js';
import RestaurantTable from '../models/RestaurantTable.js';
import { protect, tenantFilter, requireTenantFilter } from '../middleware/auth.js';

const router = express.Router();
router.use(protect);
router.use(tenantFilter);
router.use(requireTenantFilter);

function getTenantFilter(req) {
  return { tenantId: new mongoose.Types.ObjectId(req.user.tenantId) };
}

// @route   GET /api/restaurant/reservations?date=YYYY-MM-DD
router.get('/', async (req, res) => {
  try {
    const { date, status, page = 1, limit = 50 } = req.query;
    const query = { ...getTenantFilter(req) };

    if (date) {
      const d = new Date(date);
      const next = new Date(d);
      next.setDate(next.getDate() + 1);
      query.date = { $gte: d, $lt: next };
    }
    if (status) query.status = status;

    const [reservations, total] = await Promise.all([
      RestaurantReservation.find(query).sort({ time: 1 }).skip((page - 1) * limit).limit(parseInt(limit)),
      RestaurantReservation.countDocuments(query),
    ]);

    res.json({ reservations, pagination: { page: parseInt(page), limit: parseInt(limit), total } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   GET /api/restaurant/reservations/dashboard
router.get('/dashboard', async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date ? new Date(date) : new Date();
    const next = new Date(targetDate);
    next.setDate(next.getDate() + 1);

    const filter = { ...getTenantFilter(req), date: { $gte: targetDate, $lt: next } };

    const [reservations, stats] = await Promise.all([
      RestaurantReservation.find(filter).sort({ time: 1 }),
      RestaurantReservation.aggregate([
        { $match: filter },
        { $group: { _id: '$status', count: { $sum: 1 }, partySize: { $sum: '$partySize' } } },
      ]),
    ]);

    const tables = await RestaurantTable.find({ ...getTenantFilter(req), isActive: true }).sort({ tableNumber: 1 });

    const statusCounts = {};
    stats.forEach(s => { statusCounts[s._id] = { count: s.count, partySize: s.partySize }; });

    res.json({
      date: targetDate.toISOString(),
      reservations,
      tables,
      summary: {
        total: reservations.length,
        confirmed: statusCounts.confirmed?.count || 0,
        seated: statusCounts.seated?.count || 0,
        completed: statusCounts.completed?.count || 0,
        cancelled: statusCounts.cancelled?.count || 0,
        noShow: statusCounts.no_show?.count || 0,
        waitlist: statusCounts.waitlist?.count || 0,
        totalCovers: reservations.filter(r => r.status !== 'cancelled' && r.status !== 'no_show').reduce((s, r) => s + r.partySize, 0),
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   POST /api/restaurant/reservations
router.post('/', async (req, res) => {
  try {
    const { tableId } = req.body;
    if (tableId) {
      const table = await RestaurantTable.findOne({ _id: tableId, ...getTenantFilter(req) });
      if (!table) return res.status(404).json({ error: 'Table not found' });
    }

    // Check for conflicts
    const conflictDate = new Date(req.body.date);
    const nextDay = new Date(conflictDate);
    nextDay.setDate(nextDay.getDate() + 1);

    if (tableId) {
      const conflict = await RestaurantReservation.findOne({
        ...getTenantFilter(req),
        tableId,
        date: { $gte: conflictDate, $lt: nextDay },
        status: { $in: ['confirmed', 'seated'] },
        time: req.body.time,
      });
      if (conflict) return res.status(409).json({ error: 'Table already reserved for this time' });
    }

    const reservation = await RestaurantReservation.create({
      ...req.body,
      tenantId: req.user.tenantId,
      createdBy: req.user._id,
    });

    if (tableId) {
      await RestaurantTable.findByIdAndUpdate(tableId, { status: 'reserved' });
    }

    res.status(201).json(reservation);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   PUT /api/restaurant/reservations/:id
router.put('/:id', async (req, res) => {
  try {
    const reservation = await RestaurantReservation.findOneAndUpdate(
      { _id: req.params.id, ...getTenantFilter(req) },
      req.body,
      { new: true, runValidators: true }
    );
    if (!reservation) return res.status(404).json({ error: 'Reservation not found' });
    res.json(reservation);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   PUT /api/restaurant/reservations/:id/status
router.put('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const reservation = await RestaurantReservation.findOne({ _id: req.params.id, ...getTenantFilter(req) });
    if (!reservation) return res.status(404).json({ error: 'Reservation not found' });

    const oldStatus = reservation.status;
    reservation.status = status;

    if (status === 'seated') reservation.seatedAt = new Date();
    else if (status === 'completed') reservation.completedAt = new Date();
    else if (status === 'cancelled') { reservation.cancelledAt = new Date(); reservation.cancelReason = req.body.reason || ''; }
    else if (status === 'no_show') reservation.cancelledAt = new Date();

    await reservation.save();

    // Update table status
    if (reservation.tableId) {
      let tableStatus = 'available';
      if (status === 'seated') tableStatus = 'occupied';
      else if (status === 'confirmed') tableStatus = 'reserved';
      await RestaurantTable.findByIdAndUpdate(reservation.tableId, { status: tableStatus });
    }

    res.json(reservation);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   DELETE /api/restaurant/reservations/:id
router.delete('/:id', async (req, res) => {
  try {
    const reservation = await RestaurantReservation.findOneAndDelete({ _id: req.params.id, ...getTenantFilter(req) });
    if (!reservation) return res.status(404).json({ error: 'Reservation not found' });

    if (reservation.tableId) {
      await RestaurantTable.findByIdAndUpdate(reservation.tableId, { status: 'available' });
    }

    res.json({ message: 'Reservation deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
