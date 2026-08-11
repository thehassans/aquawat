import express from 'express';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import ExpenseClaim from '../models/ExpenseClaim.js';
import Employee from '../models/Employee.js';
import { protect, tenantFilter, checkPermission } from '../middleware/auth.js';
import { imageUpload } from '../utils/uploadMime.js';

const router = express.Router();
const upload = imageUpload;

router.use(protect);
router.use(tenantFilter);

const PER_DIEM_RATES = { domestic: 200, gulf: 350, international: 500 };
const MILEAGE_RATE = 2.5;

function calculateLineTotals(lines) {
  let subtotal = 0;
  let totalTax = 0;
  const calculated = lines.map(line => {
    let amount = Number(line.amount || 0);
    if (line.category === 'mileage' && line.distanceKm) {
      amount = Number(line.distanceKm) * MILEAGE_RATE;
    }
    if (line.category === 'per_diem' && line.perDiemDays) {
      const rate = PER_DIEM_RATES[line.perDiemType] || PER_DIEM_RATES.domestic;
      amount = Number(line.perDiemDays) * rate;
    }
    const taxAmount = Number(line.taxAmount || 0);
    const totalAmount = amount + taxAmount;
    subtotal += amount;
    totalTax += taxAmount;
    return { ...line, amount: Math.round(amount * 100) / 100, totalAmount: Math.round(totalAmount * 100) / 100 };
  });
  return {
    calculated,
    subtotal: Math.round(subtotal * 100) / 100,
    totalTax: Math.round(totalTax * 100) / 100,
    totalAmount: Math.round((subtotal + totalTax) * 100) / 100,
  };
}

async function generateClaimNumber(tenantFilterValue) {
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const prefix = `ECL-${y}${m}`;
  const last = await ExpenseClaim.findOne({
    ...tenantFilterValue,
    claimNumber: { $regex: `^${prefix}-` },
  }).sort({ claimNumber: -1 }).select('claimNumber');
  let seq = 1;
  if (last?.claimNumber) {
    const parts = last.claimNumber.split('-');
    const lastSeq = Number(parts[parts.length - 1]);
    if (Number.isFinite(lastSeq)) seq = lastSeq + 1;
  }
  return `${prefix}-${String(seq).padStart(3, '0')}`;
}

// @route   GET /api/expense-claims
router.get('/', checkPermission('hr', 'read'), async (req, res) => {
  try {
    const { page = 1, limit = 25, status, employeeId, category, startDate, endDate, search } = req.query;
    const query = { ...req.tenantFilter };

    if (status) query.status = status;
    if (employeeId) query.employeeId = employeeId;
    if (category) query['lines.category'] = category;

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    if (search) {
      const cleanSearch = String(search).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { claimNumber: { $regex: cleanSearch, $options: 'i' } },
        { title: { $regex: cleanSearch, $options: 'i' } },
        { employeeName: { $regex: cleanSearch, $options: 'i' } },
      ];
    }

    const [claims, total] = await Promise.all([
      ExpenseClaim.find(query)
        .populate('employeeId', 'employeeId firstNameEn lastNameEn firstNameAr lastNameAr department')
        .populate('submittedBy', 'firstName lastName email')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit)),
      ExpenseClaim.countDocuments(query),
    ]);

    res.json({
      claims,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   GET /api/expense-claims/stats
router.get('/stats', checkPermission('hr', 'read'), async (req, res) => {
  try {
    const { months = 6 } = req.query;
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - parseInt(months));

    const stats = await ExpenseClaim.aggregate([
      { $match: { ...req.tenantFilter, createdAt: { $gte: startDate } } },
      {
        $facet: {
          totals: [{
            $group: {
              _id: null,
              totalClaims: { $sum: 1 },
              totalAmount: { $sum: '$totalAmount' },
              pendingCount: { $sum: { $cond: [{ $in: ['$status', ['submitted', 'pending_approval']] }, 1, 0] } },
              approvedCount: { $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] } },
              reimbursedCount: { $sum: { $cond: [{ $eq: ['$status', 'reimbursed'] }, 1, 0] } },
              rejectedCount: { $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] } },
            },
          }],
          byCategory: [
            { $unwind: '$lines' },
            { $group: { _id: '$lines.category', count: { $sum: 1 }, amount: { $sum: '$lines.amount' } } },
            { $sort: { amount: -1 } },
          ],
          byStatus: [
            { $group: { _id: '$status', count: { $sum: 1 }, amount: { $sum: '$totalAmount' } } },
          ],
          byMonth: [
            { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }, count: { $sum: 1 }, amount: { $sum: '$totalAmount' } } },
            { $sort: { _id: 1 } },
          ],
        },
      },
    ]);

    res.json(stats[0] || {});
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   GET /api/expense-claims/:id
router.get('/:id', checkPermission('hr', 'read'), async (req, res) => {
  try {
    const claim = await ExpenseClaim.findOne({ _id: req.params.id, ...req.tenantFilter })
      .populate('employeeId', 'employeeId firstNameEn lastNameEn firstNameAr lastNameAr department position')
      .populate('submittedBy', 'firstName lastName email')
      .populate('approvalTrail.approverId', 'firstName lastName email');

    if (!claim) return res.status(404).json({ error: 'Expense claim not found' });
    res.json(claim);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   POST /api/expense-claims
router.post('/', checkPermission('hr', 'create'), async (req, res) => {
  try {
    if (!req.user.tenantId) {
      return res.status(400).json({ error: 'No tenant associated with user' });
    }

    const employee = await Employee.findOne({
      _id: req.body.employeeId,
      ...req.tenantFilter,
    }).select('employeeId firstNameEn lastNameEn firstNameAr lastNameAr department');
    if (!employee) {
      return res.status(400).json({ error: 'Invalid employee' });
    }

    const claimNumber = req.body.claimNumber || (await generateClaimNumber(req.tenantFilter));
    const { calculated, subtotal, totalTax, totalAmount } = calculateLineTotals(req.body.lines || []);
    const status = req.body.submit ? 'submitted' : 'draft';

    const claim = await ExpenseClaim.create({
      ...req.body,
      claimNumber,
      tenantId: req.user.tenantId,
      employeeName: `${employee.firstNameEn} ${employee.lastNameEn}`,
      department: employee.department,
      submittedBy: req.user._id,
      lines: calculated,
      subtotal,
      totalTax,
      totalAmount,
      status,
    });

    res.status(201).json(claim);
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(400).json({ error: 'Duplicate claim number' });
    }
    res.status(500).json({ error: error.message });
  }
});

// @route   PUT /api/expense-claims/:id
router.put('/:id', checkPermission('hr', 'update'), async (req, res) => {
  try {
    const existing = await ExpenseClaim.findOne({ _id: req.params.id, ...req.tenantFilter });
    if (!existing) return res.status(404).json({ error: 'Expense claim not found' });

    if (['approved', 'rejected', 'reimbursed'].includes(existing.status)) {
      return res.status(400).json({ error: 'Cannot edit a claim that has been approved, rejected, or reimbursed' });
    }

    const updateData = { ...req.body };
    if (Array.isArray(req.body.lines)) {
      const { calculated, subtotal, totalTax, totalAmount } = calculateLineTotals(req.body.lines);
      updateData.lines = calculated;
      updateData.subtotal = subtotal;
      updateData.totalTax = totalTax;
      updateData.totalAmount = totalAmount;
    }

    if (req.body.submit && existing.status === 'draft') {
      updateData.status = 'submitted';
    }

    const claim = await ExpenseClaim.findOneAndUpdate(
      { _id: req.params.id, ...req.tenantFilter },
      updateData,
      { new: true, runValidators: true }
    );

    res.json(claim);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   POST /api/expense-claims/:id/approve
router.post('/:id/approve', checkPermission('hr', 'approve'), async (req, res) => {
  try {
    const claim = await ExpenseClaim.findOne({ _id: req.params.id, ...req.tenantFilter });
    if (!claim) return res.status(404).json({ error: 'Expense claim not found' });

    if (!['submitted', 'pending_approval'].includes(claim.status)) {
      return res.status(400).json({ error: 'Claim is not in an approvable state' });
    }

    claim.approvalTrail.push({
      approverId: req.user._id,
      approverName: `${req.user.firstName} ${req.user.lastName}`,
      status: 'approved',
      actedAt: new Date(),
      comment: req.body.comment || '',
    });
    claim.status = 'approved';
    await claim.save();

    res.json(claim);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   POST /api/expense-claims/:id/reject
router.post('/:id/reject', checkPermission('hr', 'approve'), async (req, res) => {
  try {
    const claim = await ExpenseClaim.findOne({ _id: req.params.id, ...req.tenantFilter });
    if (!claim) return res.status(404).json({ error: 'Expense claim not found' });

    if (!['submitted', 'pending_approval'].includes(claim.status)) {
      return res.status(400).json({ error: 'Claim is not in a rejectable state' });
    }

    claim.approvalTrail.push({
      approverId: req.user._id,
      approverName: `${req.user.firstName} ${req.user.lastName}`,
      status: 'rejected',
      actedAt: new Date(),
      comment: req.body.comment || '',
    });
    claim.status = 'rejected';
    await claim.save();

    res.json(claim);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   POST /api/expense-claims/:id/reimburse
router.post('/:id/reimburse', checkPermission('payroll', 'approve'), async (req, res) => {
  try {
    const claim = await ExpenseClaim.findOne({ _id: req.params.id, ...req.tenantFilter });
    if (!claim) return res.status(404).json({ error: 'Expense claim not found' });

    if (claim.status !== 'approved') {
      return res.status(400).json({ error: 'Only approved claims can be reimbursed' });
    }

    claim.status = 'reimbursed';
    claim.reimbursedAt = new Date();
    claim.reimbursedVia = req.body.method || 'payroll';
    claim.payrollMonth = req.body.payrollMonth || '';
    await claim.save();

    res.json(claim);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   DELETE /api/expense-claims/:id
router.delete('/:id', checkPermission('hr', 'delete'), async (req, res) => {
  try {
    const claim = await ExpenseClaim.findOne({ _id: req.params.id, ...req.tenantFilter });
    if (!claim) return res.status(404).json({ error: 'Expense claim not found' });

    if (!['draft', 'rejected'].includes(claim.status)) {
      return res.status(400).json({ error: 'Can only delete draft or rejected claims' });
    }

    await ExpenseClaim.deleteOne({ _id: claim._id });
    res.json({ message: 'Expense claim deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   POST /api/expense-claims/upload-receipt
router.post('/upload-receipt', checkPermission('hr', 'create'), upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image uploaded' });

    const tenantIdStr = req.user.tenantId.toString();
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'expense-receipts', tenantIdStr);
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const filename = `receipt-${Date.now()}-${Math.round(Math.random() * 1E9)}.webp`;
    const filepath = path.join(uploadsDir, filename);

    await sharp(req.file.buffer)
      .resize({ width: 1000, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toFile(filepath);

    const imageUrl = `/uploads/expense-receipts/${tenantIdStr}/${filename}`;
    res.json({ imageUrl });
  } catch (error) {
    console.error('Receipt upload error:', error);
    res.status(500).json({ error: 'Failed to process image' });
  }
});

export default router;
