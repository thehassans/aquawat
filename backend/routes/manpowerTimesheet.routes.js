import express from 'express';
import mongoose from 'mongoose';
import ManpowerTimesheet from '../models/ManpowerTimesheet.js';
import ManpowerWorker from '../models/ManpowerWorker.js';
import ManpowerAssignment from '../models/ManpowerAssignment.js';
import { protect, tenantFilter, requireTenantFilter } from '../middleware/auth.js';

const router = express.Router();
router.use(protect);
router.use(tenantFilter);
router.use(requireTenantFilter);

function getTenantFilter(req) {
  return { tenantId: new mongoose.Types.ObjectId(req.user.tenantId) };
}

// @route   GET /api/manpower/timesheets?startDate=...&endDate=...&workerId=...&projectId=...
router.get('/', async (req, res) => {
  try {
    const { startDate, endDate, workerId, projectId, assignmentId, page = 1, limit = 50 } = req.query;
    const query = { ...getTenantFilter(req) };

    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }
    if (workerId) query.workerId = new mongoose.Types.ObjectId(workerId);
    if (projectId) query.projectId = new mongoose.Types.ObjectId(projectId);
    if (assignmentId) query.assignmentId = new mongoose.Types.ObjectId(assignmentId);

    const [entries, total] = await Promise.all([
      ManpowerTimesheet.find(query).sort({ date: -1, createdAt: -1 }).skip((page - 1) * limit).limit(parseInt(limit)),
      ManpowerTimesheet.countDocuments(query),
    ]);

    res.json({ timesheets: entries, pagination: { page: parseInt(page), limit: parseInt(limit), total } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   GET /api/manpower/timesheets/summary?startDate=...&endDate=...
router.get('/summary', async (req, res) => {
  try {
    const { startDate, endDate, groupBy = 'project' } = req.query;
    const filter = { ...getTenantFilter(req) };

    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }

    const groupField = groupBy === 'worker' ? '$workerId' : groupBy === 'client' ? '$clientId' : '$projectId';

    const summary = await ManpowerTimesheet.aggregate([
      { $match: filter },
      {
        $group: {
          _id: { id: groupField, name: groupBy === 'worker' ? '$workerName' : groupBy === 'client' ? '$clientName' : '$projectName' },
          totalRegularHours: { $sum: '$regularHours' },
          totalOvertimeHours: { $sum: '$overtimeHours' },
          totalHours: { $sum: '$totalHours' },
          totalCost: { $sum: '$totalCost' },
          billableHours: { $sum: { $cond: ['$isBillable', '$totalHours', 0] } },
          nonBillableHours: { $sum: { $cond: ['$isBillable', 0, '$totalHours'] } },
          entries: { $sum: 1 },
          presentDays: { $sum: { $cond: [{ $eq: ['$attendanceStatus', 'present'] }, 1, 0] } },
          absentDays: { $sum: { $cond: [{ $eq: ['$attendanceStatus', 'absent'] }, 1, 0] } },
        },
      },
      { $sort: { totalCost: -1 } },
    ]);

    const grandTotal = summary.reduce((acc, s) => ({
      regularHours: acc.regularHours + s.totalRegularHours,
      overtimeHours: acc.overtimeHours + s.totalOvertimeHours,
      totalHours: acc.totalHours + s.totalHours,
      totalCost: acc.totalCost + s.totalCost,
      billableHours: acc.billableHours + s.billableHours,
      nonBillableHours: acc.nonBillableHours + s.nonBillableHours,
    }), { regularHours: 0, overtimeHours: 0, totalHours: 0, totalCost: 0, billableHours: 0, nonBillableHours: 0 });

    res.json({ groups: summary, grandTotal });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   POST /api/manpower/timesheets
router.post('/', async (req, res) => {
  try {
    const { workerId } = req.body;
    const worker = await ManpowerWorker.findOne({ _id: workerId, ...getTenantFilter(req) });
    if (!worker) return res.status(404).json({ error: 'Worker not found' });

    const entry = await ManpowerTimesheet.create({
      ...req.body,
      workerName: worker.name,
      trade: worker.trade,
      hourlyRate: req.body.hourlyRate || worker.hourlyRate,
      tenantId: req.user.tenantId,
      createdBy: req.user._id,
    });

    res.status(201).json(entry);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   POST /api/manpower/timesheets/bulk
router.post('/bulk', async (req, res) => {
  try {
    const { entries } = req.body;
    if (!Array.isArray(entries) || entries.length === 0) return res.status(400).json({ error: 'entries array required' });

    const workerIds = [...new Set(entries.map(e => e.workerId))];
    const workers = await ManpowerWorker.find({ _id: { $in: workerIds }, ...getTenantFilter(req) });
    const workerMap = new Map(workers.map(w => [w._id.toString(), w]));

    const docs = entries.map(e => {
      const worker = workerMap.get(e.workerId);
      if (!worker) return null;
      const totalHours = (e.regularHours || 0) + (e.overtimeHours || 0);
      const hourlyRate = e.hourlyRate || worker.hourlyRate || 0;
      const overtimeRate = e.overtimeRate || hourlyRate * 1.5;
      return {
        ...e,
        workerName: worker.name,
        trade: worker.trade,
        hourlyRate,
        overtimeRate,
        regularCost: Math.round((e.regularHours || 0) * hourlyRate * 100) / 100,
        overtimeCost: Math.round((e.overtimeHours || 0) * overtimeRate * 100) / 100,
        totalCost: Math.round(((e.regularHours || 0) * hourlyRate + (e.overtimeHours || 0) * overtimeRate) * 100) / 100,
        totalHours,
        tenantId: req.user.tenantId,
        createdBy: req.user._id,
      };
    }).filter(Boolean);

    const result = await ManpowerTimesheet.insertMany(docs);
    res.status(201).json({ created: result.length, entries: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   PUT /api/manpower/timesheets/:id
router.put('/:id', async (req, res) => {
  try {
    const entry = await ManpowerTimesheet.findOneAndUpdate(
      { _id: req.params.id, ...getTenantFilter(req) },
      req.body,
      { new: true, runValidators: true }
    );
    if (!entry) return res.status(404).json({ error: 'Timesheet entry not found' });
    res.json(entry);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   DELETE /api/manpower/timesheets/:id
router.delete('/:id', async (req, res) => {
  try {
    const entry = await ManpowerTimesheet.findOneAndDelete({ _id: req.params.id, ...getTenantFilter(req) });
    if (!entry) return res.status(404).json({ error: 'Timesheet entry not found' });
    res.json({ message: 'Entry deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
