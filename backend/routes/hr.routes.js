import express from 'express';
import JobRequisition from '../models/JobRequisition.js';
import Candidate from '../models/Candidate.js';
import LeaveRequest from '../models/LeaveRequest.js';
import PerformanceReview from '../models/PerformanceReview.js';
import Employee from '../models/Employee.js';
import Payroll from '../models/Payroll.js';
import { protect, tenantFilter, checkPermission, requireTenantFilter } from '../middleware/auth.js';
import multer from 'multer';
import path from 'path';
import { saveUploadBuffer } from '../utils/objectStorage.js';

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'].includes(String(file?.mimetype || '').toLowerCase());
    cb(ok ? null : new Error('Only image or PDF uploads are allowed'), ok);
  },
});
router.use(protect);
router.use(tenantFilter);
router.use(requireTenantFilter);

/* ───────────────── JOB REQUISITIONS ───────────────── */

// GET /api/hr/requisitions
router.get('/requisitions', checkPermission('hr', 'read'), async (req, res) => {
  try {
    const { status, search } = req.query;
    const filter = { ...req.tenantFilter };
    if (status) filter.status = status;
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { department: { $regex: search, $options: 'i' } },
        { requisitionId: { $regex: search, $options: 'i' } },
      ];
    }
    const requisitions = await JobRequisition.find(filter).sort({ createdAt: -1 }).lean();
    res.json(requisitions);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/requisitions/:id', checkPermission('hr', 'read'), async (req, res) => {
  try {
    const req_ = await JobRequisition.findOne({ _id: req.params.id, ...req.tenantFilter }).lean();
    if (!req_) return res.status(404).json({ error: 'Not found' });
    res.json(req_);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/requisitions', checkPermission('hr', 'create'), async (req, res) => {
  try {
    const data = { ...req.body, tenantId: req.user.tenantId, createdBy: req.user._id };
    const req_ = await JobRequisition.create(data);
    res.status(201).json(req_);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.put('/requisitions/:id', checkPermission('hr', 'update'), async (req, res) => {
  try {
    const req_ = await JobRequisition.findOneAndUpdate(
      { _id: req.params.id, ...req.tenantFilter },
      req.body,
      { new: true }
    );
    if (!req_) return res.status(404).json({ error: 'Not found' });
    res.json(req_);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.delete('/requisitions/:id', checkPermission('hr', 'delete'), async (req, res) => {
  try {
    const req_ = await JobRequisition.findOneAndDelete({ _id: req.params.id, ...req.tenantFilter });
    if (!req_) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ───────────────── CANDIDATES ───────────────── */

async function _saveCandidateFile(tenantId, fieldname, file) {
  const originalname = file?.originalname || `${fieldname}.pdf`;
  const ext = path.extname(originalname) || '.pdf';
  const filename = `${fieldname}-${Date.now()}-${Math.round(Math.random() * 1E9)}${ext}`;
  const tenantIdStr = String(tenantId);
  const key = `hr/candidates/${tenantIdStr}/${filename}`;
  const { url } = await saveUploadBuffer({
    buffer: file.buffer,
    key,
    contentType: file.mimetype || 'application/octet-stream',
    publicUrlPath: `/uploads/${key}`,
  });
  return url;
}

// GET /api/hr/candidates
router.get('/candidates', checkPermission('hr', 'read'), async (req, res) => {
  try {
    const { jobRequisitionId, stage, search } = req.query;
    const filter = { ...req.tenantFilter };
    if (jobRequisitionId) filter.jobRequisitionId = jobRequisitionId;
    if (stage) filter.stage = stage;
    if (search) {
      filter.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
      ];
    }
    const candidates = await Candidate.find(filter).sort({ createdAt: -1 }).lean();
    res.json(candidates);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/candidates', checkPermission('hr', 'create'), upload.fields([{ name: 'resumeFile', maxCount: 1 }, { name: 'coverLetterFile', maxCount: 1 }]), async (req, res) => {
  try {
    const data = { ...req.body, tenantId: req.user.tenantId, createdBy: req.user._id };
    if (req.files?.resumeFile?.[0]) {
      data.resumeFile = await _saveCandidateFile(req.user.tenantId, 'resume', req.files.resumeFile[0]);
    }
    if (req.files?.coverLetterFile?.[0]) {
      data.coverLetterFile = await _saveCandidateFile(req.user.tenantId, 'coverLetter', req.files.coverLetterFile[0]);
    }
    const cand = await Candidate.create(data);
    res.status(201).json(cand);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.put('/candidates/:id', checkPermission('hr', 'update'), upload.fields([{ name: 'resumeFile', maxCount: 1 }, { name: 'coverLetterFile', maxCount: 1 }]), async (req, res) => {
  try {
    const update = { ...req.body };
    if (req.files?.resumeFile?.[0]) {
      update.resumeFile = await _saveCandidateFile(req.user.tenantId, 'resume', req.files.resumeFile[0]);
    }
    if (req.files?.coverLetterFile?.[0]) {
      update.coverLetterFile = await _saveCandidateFile(req.user.tenantId, 'coverLetter', req.files.coverLetterFile[0]);
    }
    const cand = await Candidate.findOneAndUpdate(
      { _id: req.params.id, ...req.tenantFilter },
      update,
      { new: true }
    );
    if (!cand) return res.status(404).json({ error: 'Not found' });
    res.json(cand);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.delete('/candidates/:id', checkPermission('hr', 'delete'), async (req, res) => {
  try {
    const cand = await Candidate.findOneAndDelete({ _id: req.params.id, ...req.tenantFilter });
    if (!cand) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ───────────────── LEAVE REQUESTS ───────────────── */

// GET /api/hr/leaves
router.get('/leaves', checkPermission('hr', 'read'), async (req, res) => {
  try {
    const { status, employeeId, type, month, year } = req.query;
    const filter = { ...req.tenantFilter };
    if (status) filter.status = status;
    if (employeeId) filter.employeeId = employeeId;
    if (type) filter.leaveType = type;
    if (year) {
      const y = Number(year);
      const start = new Date(y, month ? Number(month) - 1 : 0, 1);
      const end = new Date(y, month ? Number(month) : 12, 1);
      filter.startDate = { $gte: start, $lt: end };
    }
    const leaves = await LeaveRequest.find(filter).sort({ createdAt: -1 }).lean();
    res.json(leaves);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/leaves', checkPermission('hr', 'create'), async (req, res) => {
  try {
    const { employeeId, leaveType, startDate, endDate, reason } = req.body;
    const msPerDay = 1000 * 60 * 60 * 24;
    const days = Math.ceil((new Date(endDate) - new Date(startDate)) / msPerDay) + 1;
    const data = {
      tenantId: req.user.tenantId,
      employeeId,
      leaveType,
      startDate,
      endDate,
      days,
      reason,
      createdBy: req.user._id,
    };
    const leave = await LeaveRequest.create(data);
    res.status(201).json(leave);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.put('/leaves/:id', checkPermission('hr', 'update'), async (req, res) => {
  try {
    const { status, rejectionReason } = req.body;
    const update = {};
    if (status) {
      update.status = status;
      if (status === 'approved') { update.approvedBy = req.user._id; update.approvedAt = new Date(); }
      if (status === 'rejected') { update.rejectionReason = rejectionReason || ''; }
    }
    const leave = await LeaveRequest.findOneAndUpdate(
      { _id: req.params.id, ...req.tenantFilter },
      update,
      { new: true }
    );
    if (!leave) return res.status(404).json({ error: 'Not found' });
    res.json(leave);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.delete('/leaves/:id', checkPermission('hr', 'delete'), async (req, res) => {
  try {
    const leave = await LeaveRequest.findOneAndDelete({ _id: req.params.id, ...req.tenantFilter });
    if (!leave) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ───────────────── PERFORMANCE REVIEWS ───────────────── */

// GET /api/hr/performance
router.get('/performance', checkPermission('hr', 'read'), async (req, res) => {
  try {
    const { employeeId, status, period } = req.query;
    const filter = { ...req.tenantFilter };
    if (employeeId) filter.employeeId = employeeId;
    if (status) filter.status = status;
    if (period) filter.period = period;
    const reviews = await PerformanceReview.find(filter).sort({ createdAt: -1 }).lean();
    res.json(reviews);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/performance', checkPermission('hr', 'create'), async (req, res) => {
  try {
    const data = { ...req.body, tenantId: req.user.tenantId, reviewerId: req.user._id, createdBy: req.user._id };
    const review = await PerformanceReview.create(data);
    res.status(201).json(review);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.put('/performance/:id', checkPermission('hr', 'update'), async (req, res) => {
  try {
    const review = await PerformanceReview.findOneAndUpdate(
      { _id: req.params.id, ...req.tenantFilter },
      req.body,
      { new: true }
    );
    if (!review) return res.status(404).json({ error: 'Not found' });
    res.json(review);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.delete('/performance/:id', checkPermission('hr', 'delete'), async (req, res) => {
  try {
    const review = await PerformanceReview.findOneAndDelete({ _id: req.params.id, ...req.tenantFilter });
    if (!review) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ───────────────── HR REPORTS ───────────────── */

// GET /api/hr/reports
router.get('/reports', checkPermission('hr', 'read'), async (req, res) => {
  try {
    const { year, month } = req.query;
    const y = Number(year) || new Date().getFullYear();
    const m = month ? Number(month) : null;

    const empFilter = { ...req.tenantFilter, isActive: true };
    const totalEmployees = await Employee.countDocuments(empFilter);
    const byDepartment = await Employee.aggregate([
      { $match: empFilter },
      { $group: { _id: '$department', count: { $sum: 1 } } },
    ]);
    const byStatus = await Employee.aggregate([
      { $match: req.tenantFilter },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);
    const byNationality = await Employee.aggregate([
      { $match: empFilter },
      { $group: { _id: '$nationality', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    // Payroll summary
    const payrollFilter = { ...req.tenantFilter, periodYear: y };
    if (m) payrollFilter.periodMonth = m;
    const payrollAgg = await Payroll.aggregate([
      { $match: payrollFilter },
      { $group: { _id: '$status', count: { $sum: 1 }, totalNet: { $sum: '$netPay' } } },
    ]);

    // Leave summary
    const leaveFilter = { ...req.tenantFilter };
    if (m) {
      leaveFilter.startDate = { $gte: new Date(y, m - 1, 1), $lt: new Date(y, m, 1) };
    } else {
      leaveFilter.startDate = { $gte: new Date(y, 0, 1), $lt: new Date(y + 1, 0, 1) };
    }
    const leaveByType = await LeaveRequest.aggregate([
      { $match: leaveFilter },
      { $group: { _id: '$leaveType', count: { $sum: 1 }, totalDays: { $sum: '$days' } } },
    ]);
    const leaveByStatus = await LeaveRequest.aggregate([
      { $match: { ...req.tenantFilter, ...leaveFilter.startDate ? { startDate: leaveFilter.startDate } : {} } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    // Hiring summary
    const openRequisitions = await JobRequisition.countDocuments({ ...req.tenantFilter, status: 'open' });
    const newCandidates = await Candidate.countDocuments({ ...req.tenantFilter, stage: 'new' });
    const hiredCandidates = await Candidate.countDocuments({ ...req.tenantFilter, stage: 'hired' });

    // Performance summary
    const reviewStats = await PerformanceReview.aggregate([
      { $match: { ...req.tenantFilter, period: `${y}` } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);
    const avgRating = await PerformanceReview.aggregate([
      { $match: { ...req.tenantFilter, overallRating: { $exists: true, $ne: null } } },
      { $group: { _id: null, avg: { $avg: '$overallRating' } } },
    ]);

    res.json({
      employees: { total: totalEmployees, byDepartment, byStatus, byNationality },
      payroll: payrollAgg,
      leaves: { byType: leaveByType, byStatus: leaveByStatus },
      hiring: { openRequisitions, newCandidates, hiredCandidates },
      performance: { reviewStats, avgRating: avgRating[0]?.avg || 0 },
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;
