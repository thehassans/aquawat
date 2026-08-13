import express from 'express';
import Contract from '../models/Contract.js';
import { protect, tenantFilter, checkPermission, requireBusinessType, requireTenantFilter } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);
router.use(tenantFilter);
router.use(requireTenantFilter);
router.use(requireBusinessType('construction'));

// ─── Helper ────────────────────────────────────────────────────────────────────

async function generateContractNumber(tenantFilterValue) {
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const d = String(today.getDate()).padStart(2, '0');
  const prefix = `CON-${y}${m}${d}`;
  const last = await Contract.findOne({ ...tenantFilterValue, contractNumber: { $regex: `^${prefix}-` } })
    .sort({ createdAt: -1 })
    .select('contractNumber');
  let seq = 1;
  if (last?.contractNumber) {
    const parts = last.contractNumber.split('-');
    const lastSeq = Number(parts[parts.length - 1]);
    if (Number.isFinite(lastSeq)) seq = lastSeq + 1;
  }
  return `${prefix}-${String(seq).padStart(3, '0')}`;
}

// ─── Stats ─────────────────────────────────────────────────────────────────────

router.get('/stats', checkPermission('contracts', 'read'), async (req, res) => {
  try {
    const now = new Date();
    const thirtyDaysOut = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const [agg, upcomingMilestonesAgg] = await Promise.all([
      Contract.aggregate([
        { $match: { ...req.tenantFilter, isActive: true } },
        {
          $facet: {
            activeContracts: [
              { $match: { status: 'active' } },
              { $group: { _id: null, count: { $sum: 1 }, totalValue: { $sum: '$revisedContractValue' }, retentionHeld: { $sum: '$retentionAmount' } } }
            ]
          }
        }
      ]),
      Contract.aggregate([
        { $match: { ...req.tenantFilter, isActive: true, status: 'active' } },
        { $unwind: '$milestones' },
        { $match: { 'milestones.status': 'pending', 'milestones.dueDate': { $gte: now, $lte: thirtyDaysOut } } },
        { $count: 'count' }
      ])
    ]);

    const active = agg[0]?.activeContracts?.[0] || {};
    res.json({
      totalActive: active.count || 0,
      totalContractValue: active.totalValue || 0,
      totalRetentionHeld: active.retentionHeld || 0,
      upcomingMilestones: upcomingMilestonesAgg[0]?.count || 0
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── List / Create ─────────────────────────────────────────────────────────────

router.get('/', checkPermission('contracts', 'read'), async (req, res) => {
  try {
    const { page = 1, limit = 25, status, search } = req.query;
    const query = { ...req.tenantFilter, isActive: true };

    if (status) query.status = status;
    if (search) {
      query.$or = [
        { contractNumber: { $regex: search, $options: 'i' } },
        { title: { $regex: search, $options: 'i' } },
        { customerName: { $regex: search, $options: 'i' } }
      ];
    }

    const [contracts, total] = await Promise.all([
      Contract.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit))
        .populate('customer', 'legalNameEn legalNameAr')
        .populate('project', 'nameEn code'),
      Contract.countDocuments(query)
    ]);

    res.json({ contracts, pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', checkPermission('contracts', 'create'), async (req, res) => {
  try {
    const contractNumber = req.body.contractNumber || (await generateContractNumber(req.tenantFilter));
    const contract = new Contract({
      ...req.body,
      contractNumber,
      tenantId: req.user.tenantId,
      createdBy: req.user._id
    });
    await contract.save();
    res.status(201).json(contract);
  } catch (error) {
    if (error?.code === 11000) return res.status(400).json({ error: 'Duplicate contract number' });
    res.status(500).json({ error: error.message });
  }
});

// ─── Single Contract ───────────────────────────────────────────────────────────

router.get('/:id', checkPermission('contracts', 'read'), async (req, res) => {
  try {
    const contract = await Contract.findOne({ _id: req.params.id, ...req.tenantFilter })
      .populate('customer', 'legalNameEn legalNameAr')
      .populate('project', 'nameEn code');
    if (!contract) return res.status(404).json({ error: 'Contract not found' });
    res.json(contract);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', checkPermission('contracts', 'update'), async (req, res) => {
  try {
    const contract = await Contract.findOne({ _id: req.params.id, ...req.tenantFilter });
    if (!contract) return res.status(404).json({ error: 'Contract not found' });
    Object.assign(contract, req.body);
    await contract.save(); // triggers pre-save hook
    res.json(contract);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', checkPermission('contracts', 'delete'), async (req, res) => {
  try {
    const contract = await Contract.findOneAndUpdate(
      { _id: req.params.id, ...req.tenantFilter },
      { isActive: false },
      { new: true }
    );
    if (!contract) return res.status(404).json({ error: 'Contract not found' });
    res.json({ message: 'Contract deactivated', contract });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── Milestones ────────────────────────────────────────────────────────────────

router.post('/:id/milestones', checkPermission('contracts', 'update'), async (req, res) => {
  try {
    const contract = await Contract.findOne({ _id: req.params.id, ...req.tenantFilter });
    if (!contract) return res.status(404).json({ error: 'Contract not found' });
    contract.milestones.push(req.body);
    await contract.save();
    res.json(contract);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id/milestones/:milestoneId', checkPermission('contracts', 'update'), async (req, res) => {
  try {
    const contract = await Contract.findOne({ _id: req.params.id, ...req.tenantFilter });
    if (!contract) return res.status(404).json({ error: 'Contract not found' });
    const milestone = contract.milestones.id(req.params.milestoneId);
    if (!milestone) return res.status(404).json({ error: 'Milestone not found' });
    Object.assign(milestone, req.body);
    await contract.save();
    res.json(contract);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/milestones/:milestoneId/complete', checkPermission('contracts', 'update'), async (req, res) => {
  try {
    const contract = await Contract.findOne({ _id: req.params.id, ...req.tenantFilter });
    if (!contract) return res.status(404).json({ error: 'Contract not found' });
    const milestone = contract.milestones.id(req.params.milestoneId);
    if (!milestone) return res.status(404).json({ error: 'Milestone not found' });
    milestone.status = 'completed';
    milestone.completionDate = new Date();
    await contract.save();
    res.json({ milestone, contract, invoiceCreated: false });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/milestones/:milestoneId/bill', checkPermission('contracts', 'update'), async (req, res) => {
  try {
    const contract = await Contract.findOne({ _id: req.params.id, ...req.tenantFilter });
    if (!contract) return res.status(404).json({ error: 'Contract not found' });
    const milestone = contract.milestones.id(req.params.milestoneId);
    if (!milestone) return res.status(404).json({ error: 'Milestone not found' });
    milestone.status = 'billed';
    await contract.save();
    res.json({ milestone, contract });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── Change Orders ─────────────────────────────────────────────────────────────

router.post('/:id/change-orders', checkPermission('contracts', 'update'), async (req, res) => {
  try {
    const contract = await Contract.findOne({ _id: req.params.id, ...req.tenantFilter });
    if (!contract) return res.status(404).json({ error: 'Contract not found' });
    const coCount = contract.changeOrders.length + 1;
    const coNumber = `CO-${String(coCount).padStart(3, '0')}`;
    contract.changeOrders.push({ ...req.body, coNumber });
    await contract.save();
    res.json(contract);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id/change-orders/:coId', checkPermission('contracts', 'update'), async (req, res) => {
  try {
    const contract = await Contract.findOne({ _id: req.params.id, ...req.tenantFilter });
    if (!contract) return res.status(404).json({ error: 'Contract not found' });
    const co = contract.changeOrders.id(req.params.coId);
    if (!co) return res.status(404).json({ error: 'Change order not found' });
    if (req.body.status === 'approved' && !co.approvedAt) {
      req.body.approvedAt = new Date();
      req.body.approvedBy = req.user._id;
    }
    Object.assign(co, req.body);
    await contract.save();
    res.json(contract);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── Retention ─────────────────────────────────────────────────────────────────

router.post('/:id/release-retention', checkPermission('contracts', 'update'), async (req, res) => {
  try {
    const contract = await Contract.findOne({ _id: req.params.id, ...req.tenantFilter });
    if (!contract) return res.status(404).json({ error: 'Contract not found' });
    if (contract.retentionReleased) return res.status(400).json({ error: 'Retention already released' });
    contract.retentionReleased = true;
    contract.retentionReleasedAt = new Date();
    contract.retentionReleasedAmount = contract.retentionAmount;
    await contract.save();
    res.json(contract);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
