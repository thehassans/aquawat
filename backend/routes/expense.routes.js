import express from 'express';
import mongoose from 'mongoose';
import Expense from '../models/Expense.js';
import Project from '../models/Project.js';
import Supplier from '../models/Supplier.js';
import Employee from '../models/Employee.js';
import Customer from '../models/Customer.js';
import { protect, tenantFilter, checkPermission, requireTenantFilter } from '../middleware/auth.js';
import { checkTrialLimits } from '../middleware/trialLimits.js';
import { statsRead } from '../utils/mongoReadPreference.js';
import { cachedTenantStats } from '../utils/statsCache.js';
import { parsePagination } from '../utils/pagination.js';

const router = express.Router();

router.use(protect);
router.use(tenantFilter);
router.use(requireTenantFilter);

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toDateOrNull(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function generateExpenseNumber(tenantFilterValue) {
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const d = String(today.getDate()).padStart(2, '0');
  const prefix = `EXP-${y}${m}${d}`;

  const last = await Expense.findOne({
    ...tenantFilterValue,
    expenseNumber: { $regex: `^${prefix}-` }
  })
    .sort({ createdAt: -1 })
    .select('expenseNumber');

  let seq = 1;
  if (last?.expenseNumber) {
    const parts = last.expenseNumber.split('-');
    const lastSeq = Number(parts[parts.length - 1]);
    if (Number.isFinite(lastSeq)) seq = lastSeq + 1;
  }

  return `${prefix}-${String(seq).padStart(3, '0')}`;
}

router.get('/', checkPermission('finance', 'read'), async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      search,
      status,
      category,
      projectId,
      supplierId,
      employeeId,
      customerId,
      startDate,
      endDate,
      isActive
    } = req.query;

    const query = { ...req.tenantFilter };

    if (isActive === 'false') {
      query.isActive = false;
    } else if (isActive === 'all') {
    } else {
      query.isActive = true;
    }

    if (status) query.status = status;
    if (category) query.category = category;
    if (projectId) {
      if (!mongoose.Types.ObjectId.isValid(projectId)) {
        return res.status(400).json({ error: 'Invalid projectId' });
      }
      query.projectId = projectId;
    }
    if (supplierId) query.supplierId = supplierId;
    if (employeeId) query.employeeId = employeeId;
    if (customerId) query.customerId = customerId;

    const start = toDateOrNull(startDate);
    const end = toDateOrNull(endDate);
    if (start || end) {
      query.expenseDate = {};
      if (start) query.expenseDate.$gte = start;
      if (end) query.expenseDate.$lte = end;
    }

    if (search) {
      query.$or = [
        { expenseNumber: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { descriptionAr: { $regex: search, $options: 'i' } },
        { payeeName: { $regex: search, $options: 'i' } },
        { paymentReference: { $regex: search, $options: 'i' } }
      ];
    }

    const { page: pageNum, limit: limitNum, skip } = parsePagination(req.query, { limit: 20 });

    const [expenses, total] = await Promise.all([
      Expense.find(query)
        .select('expenseNumber expenseDate status category totalAmount currency description descriptionAr payeeName paymentReference projectId supplierId employeeId customerId isActive createdAt updatedAt')
        .populate('projectId', 'code nameEn nameAr')
        .populate('supplierId', 'supplierCode name nameEn nameAr phone email')
        .populate('employeeId', 'employeeId firstNameEn lastNameEn firstNameAr lastNameAr')
        .populate('customerId', 'name nameAr email phone')
        .sort({ expenseDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Expense.countDocuments(query)
    ]);

    res.json({
      expenses,
      pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/stats', checkPermission('finance', 'read'), async (req, res) => {
  try {
    const { isActive, projectId } = req.query;

    const match = { ...req.tenantFilter };

    if (projectId) {
      if (!mongoose.Types.ObjectId.isValid(projectId)) {
        return res.status(400).json({ error: 'Invalid projectId' });
      }
      match.projectId = new mongoose.Types.ObjectId(projectId);
    }

    if (isActive === 'false') {
      match.isActive = false;
    } else if (isActive === 'all') {
    } else {
      match.isActive = true;
    }

    const suffix = `${isActive || 'active'}:${projectId || 'all'}`;
    const payload = await cachedTenantStats(req, 'expenses', async () => {
    const [result] = await statsRead(Expense.aggregate([
      { $match: match },
      {
        $facet: {
          totals: [
            {
              $group: {
                _id: null,
                total: { $sum: 1 },
                grossTotal: { $sum: { $ifNull: ['$totalAmount', 0] } },
                paidTotal: {
                  $sum: {
                    $cond: [
                      { $eq: ['$status', 'paid'] },
                      { $ifNull: ['$totalAmount', 0] },
                      0
                    ]
                  }
                },
                approvedTotal: {
                  $sum: {
                    $cond: [
                      { $eq: ['$status', 'approved'] },
                      { $ifNull: ['$totalAmount', 0] },
                      0
                    ]
                  }
                }
              }
            }
          ],
          byStatus: [
            {
              $group: {
                _id: '$status',
                count: { $sum: 1 },
                totalAmount: { $sum: { $ifNull: ['$totalAmount', 0] } }
              }
            },
            { $sort: { count: -1 } }
          ],
          byCategory: [
            {
              $group: {
                _id: '$category',
                count: { $sum: 1 },
                totalAmount: { $sum: { $ifNull: ['$totalAmount', 0] } }
              }
            },
            { $sort: { totalAmount: -1 } },
            { $limit: 10 }
          ],
          recent: [
            { $sort: { expenseDate: -1, createdAt: -1 } },
            { $limit: 5 },
            { $project: { expenseNumber: 1, expenseDate: 1, status: 1, category: 1, totalAmount: 1 } }
          ]
        }
      }
    ]));

    const totals = result?.totals?.[0] || { total: 0, grossTotal: 0, paidTotal: 0, approvedTotal: 0 };

    return {
      totals,
      byStatus: result?.byStatus || [],
      byCategory: result?.byCategory || [],
      recent: result?.recent || []
    };
    }, { querySuffix: suffix });

    res.json(payload);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', checkPermission('finance', 'read'), async (req, res) => {
  try {
    const expense = await Expense.findOne({ _id: req.params.id, ...req.tenantFilter })
      .populate('projectId', 'code nameEn nameAr')
      .populate('supplierId', 'supplierCode name nameEn nameAr phone email')
      .populate('employeeId', 'employeeId firstNameEn lastNameEn firstNameAr lastNameAr')
      .populate('customerId', 'name nameAr email phone');

    if (!expense) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    res.json(expense);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', checkTrialLimits('expenses'), checkPermission('finance', 'create'), async (req, res) => {
  try {
    if (!req.user?.tenantId) {
      return res.status(400).json({ error: 'No tenant associated with user' });
    }

    const expenseDate = toDateOrNull(req.body.expenseDate) || new Date();

    const supplierId = req.body.supplierId || null;
    const employeeId = req.body.employeeId || null;
    const customerId = req.body.customerId || null;
    const projectId = req.body.projectId || null;

    if (supplierId) {
      const supplier = await Supplier.findOne({ _id: supplierId, ...req.tenantFilter });
      if (!supplier) return res.status(400).json({ error: 'Invalid supplier' });
    }

    if (employeeId) {
      const employee = await Employee.findOne({ _id: employeeId, ...req.tenantFilter });
      if (!employee) return res.status(400).json({ error: 'Invalid employee' });
    }

    if (customerId) {
      const customer = await Customer.findOne({ _id: customerId, ...req.tenantFilter });
      if (!customer) return res.status(400).json({ error: 'Invalid customer' });
    }

    if (projectId) {
      if (!mongoose.Types.ObjectId.isValid(projectId)) return res.status(400).json({ error: 'Invalid projectId' });
      const project = await Project.findOne({ _id: projectId, ...req.tenantFilter });
      if (!project) return res.status(400).json({ error: 'Invalid project' });
    }

    const expenseNumber = req.body.expenseNumber || (await generateExpenseNumber(req.tenantFilter));

    const data = {
      ...req.body,
      tenantId: req.user.tenantId,
      expenseNumber,
      expenseDate,
      amount: toNumber(req.body.amount, 0),
      taxAmount: toNumber(req.body.taxAmount, 0),
      paymentDate: toDateOrNull(req.body.paymentDate),
      createdBy: req.user._id
    };

    const expense = await Expense.create(data);
    res.status(201).json(expense);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', checkPermission('finance', 'update'), async (req, res) => {
  try {
    const existing = await Expense.findOne({ _id: req.params.id, ...req.tenantFilter });
    if (!existing) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    const updateData = { ...req.body };
    delete updateData.tenantId;
    delete updateData.createdBy;

    if (updateData.expenseDate) {
      const parsed = toDateOrNull(updateData.expenseDate);
      if (!parsed) return res.status(400).json({ error: 'Invalid expenseDate' });
      updateData.expenseDate = parsed;
    }

    if (updateData.paymentDate) {
      const parsed = toDateOrNull(updateData.paymentDate);
      if (!parsed) return res.status(400).json({ error: 'Invalid paymentDate' });
      updateData.paymentDate = parsed;
    }

    if (updateData.amount !== undefined) updateData.amount = toNumber(updateData.amount, existing.amount || 0);
    if (updateData.taxAmount !== undefined) updateData.taxAmount = toNumber(updateData.taxAmount, existing.taxAmount || 0);

    if (updateData.supplierId) {
      const supplier = await Supplier.findOne({ _id: updateData.supplierId, ...req.tenantFilter });
      if (!supplier) return res.status(400).json({ error: 'Invalid supplier' });
    }

    if (updateData.employeeId) {
      const employee = await Employee.findOne({ _id: updateData.employeeId, ...req.tenantFilter });
      if (!employee) return res.status(400).json({ error: 'Invalid employee' });
    }

    if (updateData.customerId) {
      const customer = await Customer.findOne({ _id: updateData.customerId, ...req.tenantFilter });
      if (!customer) return res.status(400).json({ error: 'Invalid customer' });
    }

    if (updateData.projectId === '') updateData.projectId = null;
    if (updateData.projectId) {
      if (!mongoose.Types.ObjectId.isValid(updateData.projectId)) return res.status(400).json({ error: 'Invalid projectId' });
      const project = await Project.findOne({ _id: updateData.projectId, ...req.tenantFilter });
      if (!project) return res.status(400).json({ error: 'Invalid project' });
    }

    Object.assign(existing, updateData);
    await existing.save();

    res.json(existing);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id/submit', checkPermission('finance', 'update'), async (req, res) => {
  try {
    const expense = await Expense.findOneAndUpdate(
      { _id: req.params.id, ...req.tenantFilter, status: 'draft' },
      { status: 'pending_approval' },
      { new: true }
    );

    if (!expense) {
      return res.status(404).json({ error: 'Expense not found or not in draft status' });
    }

    res.json(expense);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id/approve', checkPermission('finance', 'approve'), async (req, res) => {
  try {
    const expense = await Expense.findOneAndUpdate(
      { _id: req.params.id, ...req.tenantFilter, status: { $in: ['draft', 'pending_approval'] } },
      { status: 'approved', approvedBy: req.user._id, approvedAt: new Date() },
      { new: true }
    );

    if (!expense) {
      return res.status(404).json({ error: 'Expense not found or already processed' });
    }

    res.json(expense);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id/pay', checkPermission('finance', 'approve'), async (req, res) => {
  try {
    const { paymentMethod, paymentReference, paymentDate } = req.body;

    const expense = await Expense.findOneAndUpdate(
      { _id: req.params.id, ...req.tenantFilter, status: 'approved' },
      {
        status: 'paid',
        paymentMethod,
        paymentReference,
        paymentDate: toDateOrNull(paymentDate) || new Date()
      },
      { new: true }
    );

    if (!expense) {
      return res.status(404).json({ error: 'Expense not found or not approved' });
    }

    try {
      const { postExpensePaidJournal } = await import('../services/accountingService.js');
      await postExpensePaidJournal({
        tenantId: expense.tenantId,
        userId: req.user._id,
        expense,
        currency: expense.currency || req.tenant?.settings?.currency || 'SAR',
      });
    } catch (glError) {
      console.warn('[accounting] expense journal failed:', glError.message);
    }

    res.json(expense);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id/cancel', checkPermission('finance', 'update'), async (req, res) => {
  try {
    const expense = await Expense.findOneAndUpdate(
      { _id: req.params.id, ...req.tenantFilter, status: { $ne: 'paid' } },
      { status: 'cancelled', isActive: false },
      { new: true }
    );

    if (!expense) {
      return res.status(404).json({ error: 'Expense not found or already paid' });
    }

    res.json(expense);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', checkPermission('finance', 'delete'), async (req, res) => {
  try {
    const expense = await Expense.findOneAndUpdate(
      { _id: req.params.id, ...req.tenantFilter },
      { isActive: false, status: 'cancelled' },
      { new: true }
    );

    if (!expense) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    res.json({ message: 'Expense deactivated', expense });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
