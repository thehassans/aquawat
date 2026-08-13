import express from 'express';
import Task from '../models/Task.js';
import Project from '../models/Project.js';
import { protect, tenantFilter, checkPermission, requireBusinessType, requireTenantFilter } from '../middleware/auth.js';
import { checkTrialLimits } from '../middleware/trialLimits.js';

const router = express.Router();

router.use(protect);
router.use(tenantFilter);
router.use(requireTenantFilter);

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

async function generateTaskNumber(tenantFilterValue) {
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const d = String(today.getDate()).padStart(2, '0');
  const prefix = `TSK-${y}${m}${d}`;

  const last = await Task.findOne({
    ...tenantFilterValue,
    taskNumber: { $regex: `^${prefix}-` }
  })
    .sort({ createdAt: -1 })
    .select('taskNumber');

  let seq = 1;
  if (last?.taskNumber) {
    const parts = last.taskNumber.split('-');
    const lastSeq = Number(parts[parts.length - 1]);
    if (Number.isFinite(lastSeq)) seq = lastSeq + 1;
  }

  return `${prefix}-${String(seq).padStart(3, '0')}`;
}

router.get('/', checkPermission('project_management', 'read'), async (req, res) => {
  try {
    const { page = 1, limit = 25, status, priority, projectId, search, isActive, startDue, endDue } = req.query;

    const query = { ...req.tenantFilter };

    if (isActive === 'false') {
      query.isActive = false;
    } else if (isActive === 'all') {
      // no filter
    } else {
      query.isActive = true;
    }

    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (projectId) query.projectId = projectId;

    if (startDue || endDue) {
      query.dueDate = {};
      if (startDue) query.dueDate.$gte = new Date(startDue);
      if (endDue) query.dueDate.$lte = new Date(endDue);
    }

    if (search) {
      query.$or = [
        { taskNumber: { $regex: search, $options: 'i' } },
        { titleEn: { $regex: search, $options: 'i' } },
        { titleAr: { $regex: search, $options: 'i' } },
        { assigneeName: { $regex: search, $options: 'i' } }
      ];
    }

    const tasks = await Task.find(query)
      .populate('projectId', 'code nameEn nameAr status')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Task.countDocuments(query);

    res.json({
      tasks,
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

    const stats = await Task.aggregate([
      { $match: { ...req.tenantFilter, isActive: true } },
      {
        $facet: {
          totals: [
            {
              $group: {
                _id: null,
                total: { $sum: 1 },
                open: {
                  $sum: {
                    $cond: [{ $in: ['$status', ['todo', 'in_progress', 'blocked']] }, 1, 0]
                  }
                },
                done: { $sum: { $cond: [{ $eq: ['$status', 'done'] }, 1, 0] } }
              }
            }
          ],
          byStatus: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
          byPriority: [{ $group: { _id: '$priority', count: { $sum: 1 } } }],
          overdue: [
            {
              $match: {
                dueDate: { $ne: null, $lt: now },
                status: { $nin: ['done', 'cancelled'] }
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
    const task = await Task.findOne({ _id: req.params.id, ...req.tenantFilter })
      .populate('projectId', 'code nameEn nameAr status');

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json(task);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', checkTrialLimits('tasks'), checkPermission('project_management', 'create'), async (req, res) => {
  try {
    if (!req.user.tenantId) {
      return res.status(400).json({ error: 'No tenant associated with user' });
    }

    if (req.body.projectId) {
      const project = await Project.findOne({ _id: req.body.projectId, ...req.tenantFilter, isActive: true });
      if (!project) {
        return res.status(400).json({ error: 'Invalid project' });
      }
    }

    const taskNumber = req.body.taskNumber || (await generateTaskNumber(req.tenantFilter));

    const taskData = {
      ...req.body,
      taskNumber,
      tenantId: req.user.tenantId,
      createdBy: req.user._id
    };

    const task = await Task.create(taskData);
    res.status(201).json(task);
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(400).json({ error: 'Duplicate task number' });
    }
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', checkPermission('project_management', 'update'), async (req, res) => {
  try {
    const existing = await Task.findOne({ _id: req.params.id, ...req.tenantFilter });
    if (!existing) {
      return res.status(404).json({ error: 'Task not found' });
    }

    if (req.body.projectId) {
      const project = await Project.findOne({ _id: req.body.projectId, ...req.tenantFilter, isActive: true });
      if (!project) {
        return res.status(400).json({ error: 'Invalid project' });
      }
    }

    const updateData = { ...req.body };

    if (updateData.status === 'done' && !existing.completedAt) {
      updateData.completedAt = new Date();
    }

    if (updateData.status && updateData.status !== 'done') {
      updateData.completedAt = undefined;
    }

    if (typeof updateData.priority === 'undefined' && existing.priority) {
      updateData.priority = existing.priority;
    }

    const task = await Task.findOneAndUpdate(
      { _id: req.params.id, ...req.tenantFilter },
      updateData,
      { new: true, runValidators: true }
    );

    res.json(task);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', checkPermission('project_management', 'delete'), async (req, res) => {
  try {
    const task = await Task.findOneAndUpdate(
      { _id: req.params.id, ...req.tenantFilter },
      { isActive: false },
      { new: true }
    );

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json({ message: 'Task deactivated', task });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
