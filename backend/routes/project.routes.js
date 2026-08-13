import express from 'express';
import Project from '../models/Project.js';
import { protect, tenantFilter, checkPermission, requireBusinessType, requireTenantFilter } from '../middleware/auth.js';
import { checkTrialLimits } from '../middleware/trialLimits.js';

const router = express.Router();

router.use(protect);
router.use(tenantFilter);
router.use(requireTenantFilter);

async function generateProjectCode(tenantFilterValue) {
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const d = String(today.getDate()).padStart(2, '0');
  const prefix = `PRJ-${y}${m}${d}`;

  const last = await Project.findOne({
    ...tenantFilterValue,
    code: { $regex: `^${prefix}-` }
  })
    .sort({ createdAt: -1 })
    .select('code');

  let seq = 1;
  if (last?.code) {
    const parts = last.code.split('-');
    const lastSeq = Number(parts[parts.length - 1]);
    if (Number.isFinite(lastSeq)) seq = lastSeq + 1;
  }

  return `${prefix}-${String(seq).padStart(3, '0')}`;
}

router.get('/', checkPermission('project_management', 'read'), async (req, res) => {
  try {
    const { page = 1, limit = 25, status, search, isActive } = req.query;

    const query = { ...req.tenantFilter };

    if (isActive === 'false') {
      query.isActive = false;
    } else if (isActive === 'all') {
      // no filter
    } else {
      query.isActive = true;
    }

    if (status) query.status = status;

    if (search) {
      query.$or = [
        { code: { $regex: search, $options: 'i' } },
        { nameEn: { $regex: search, $options: 'i' } },
        { nameAr: { $regex: search, $options: 'i' } },
        { ownerName: { $regex: search, $options: 'i' } }
      ];
    }

    const projects = await Project.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Project.countDocuments(query);

    res.json({
      projects,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/stats', checkPermission('project_management', 'read'), async (req, res) => {
  try {
    const now = new Date();

    const stats = await Project.aggregate([
      { $match: { ...req.tenantFilter, isActive: true } },
      {
        $facet: {
          totals: [
            {
              $group: {
                _id: null,
                total: { $sum: 1 },
                active: {
                  $sum: {
                    $cond: [{ $in: ['$status', ['planned', 'in_progress', 'on_hold']] }, 1, 0]
                  }
                },
                completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } }
              }
            }
          ],
          byStatus: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
          overdue: [
            {
              $match: {
                dueDate: { $ne: null, $lt: now },
                status: { $nin: ['completed', 'cancelled'] }
              }
            },
            { $count: 'count' }
          ]
        }
      }
    ]);

    res.json(stats[0] || {});
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', checkPermission('project_management', 'read'), async (req, res) => {
  try {
    const project = await Project.findOne({ _id: req.params.id, ...req.tenantFilter })
      .populate('progressUpdates.createdBy', 'firstName lastName email')
      .populate('projectNotes.createdBy', 'firstName lastName email');

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json(project);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/notes', checkPermission('project_management', 'update'), async (req, res) => {
  try {
    const existing = await Project.findOne({ _id: req.params.id, ...req.tenantFilter });
    if (!existing) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const note = String(req.body?.note || '').trim();
    if (!note) {
      return res.status(400).json({ error: 'Note is required' });
    }

    existing.projectNotes = Array.isArray(existing.projectNotes) ? existing.projectNotes : [];
    existing.projectNotes.push({
      note,
      createdBy: req.user?._id,
      createdAt: new Date(),
    });

    await existing.save();

    const project = await Project.findOne({ _id: req.params.id, ...req.tenantFilter })
      .populate('progressUpdates.createdBy', 'firstName lastName email')
      .populate('projectNotes.createdBy', 'firstName lastName email');

    res.json(project);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/progress', checkPermission('project_management', 'update'), async (req, res) => {
  try {
    const existing = await Project.findOne({ _id: req.params.id, ...req.tenantFilter });
    if (!existing) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const rawProgress = Number(req.body?.progress);
    const progress = Number.isFinite(rawProgress) ? Math.max(0, Math.min(100, rawProgress)) : NaN;
    const note = String(req.body?.note || '').trim();

    if (!Number.isFinite(progress)) {
      return res.status(400).json({ error: 'Invalid progress' });
    }
    if (!note) {
      return res.status(400).json({ error: 'Note is required' });
    }

    existing.progress = progress;
    existing.progressUpdates = Array.isArray(existing.progressUpdates) ? existing.progressUpdates : [];
    existing.progressUpdates.push({
      progress,
      note,
      createdBy: req.user?._id,
      createdAt: new Date(),
    });

    if (progress >= 100 && existing.status !== 'cancelled') {
      existing.status = 'completed';
      if (!existing.completedAt) existing.completedAt = new Date();
    }

    if (progress < 100 && existing.status === 'completed') {
      existing.status = 'in_progress';
      existing.completedAt = undefined;
    }

    if (progress > 0 && existing.status === 'planned') {
      existing.status = 'in_progress';
    }

    await existing.save();
    res.json(existing);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', checkTrialLimits('projects'), checkPermission('project_management', 'create'), async (req, res) => {
  try {
    const code = req.body.code || (await generateProjectCode(req.tenantFilter));

    const projectData = {
      ...req.body,
      code,
      tenantId: req.user.tenantId,
      createdBy: req.user._id
    };

    const project = await Project.create(projectData);
    res.status(201).json(project);
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(400).json({ error: 'Duplicate project code' });
    }
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', checkPermission('project_management', 'update'), async (req, res) => {
  try {
    const existing = await Project.findOne({ _id: req.params.id, ...req.tenantFilter });
    if (!existing) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const updateData = { ...req.body };

    if (typeof updateData.progress !== 'undefined') {
      const p = Number(updateData.progress);
      updateData.progress = Number.isFinite(p) ? Math.max(0, Math.min(100, p)) : existing.progress;
    }

    if (updateData.status === 'completed' && !existing.completedAt) {
      updateData.completedAt = new Date();
      updateData.progress = 100;
    }

    if (updateData.status && updateData.status !== 'completed') {
      updateData.completedAt = undefined;
    }

    const project = await Project.findOneAndUpdate(
      { _id: req.params.id, ...req.tenantFilter },
      updateData,
      { new: true, runValidators: true }
    );

    res.json(project);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', checkPermission('project_management', 'delete'), async (req, res) => {
  try {
    const project = await Project.findOneAndUpdate(
      { _id: req.params.id, ...req.tenantFilter },
      { isActive: false },
      { new: true }
    );

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json({ message: 'Project deactivated', project });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
