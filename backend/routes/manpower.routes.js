import express from 'express';
import { protect, authorize, requireBusinessType, tenantFilter, checkPermission, requireTenantFilter } from '../middleware/auth.js';
import ManpowerWorker from '../models/ManpowerWorker.js';
import ManpowerAssignment from '../models/ManpowerAssignment.js';
import Customer from '../models/Customer.js';

const router = express.Router();

// Apply middleware to all routes
router.use(protect);
router.use(tenantFilter);
router.use(requireTenantFilter);
router.use(requireBusinessType(['manpower', 'construction', 'trading']));

// --- WORKERS ---

// @route   GET /api/manpower/workers
router.get('/workers', async (req, res) => {
  try {
    const { status, trade, search } = req.query;
    let query = { tenantId: req.tenant._id };

    if (status) query.status = status;
    if (trade) query.trade = trade;
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { workerNumber: { $regex: search, $options: 'i' } }
      ];
    }

    const workers = await ManpowerWorker.find(query)
        .populate('currentAssignment')
        .populate('clientId', 'name nameAr')
        .sort({ createdAt: -1 });

    res.json(workers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   POST /api/manpower/workers
router.post('/workers', checkPermission('canCreateWorker'), async (req, res) => {
  try {
    const lastWorker = await ManpowerWorker.findOne({ tenantId: req.tenant._id })
        .sort({ workerNumber: -1 });
    
    let nextNum = 1;
    if (lastWorker && lastWorker.workerNumber) {
      const match = lastWorker.workerNumber.match(/\d+$/);
      if (match) nextNum = parseInt(match[0], 10) + 1;
    }
    const workerNumber = `WKR-${new Date().getFullYear()}-${nextNum.toString().padStart(4, '0')}`;

    const worker = await ManpowerWorker.create({
      ...req.body,
      tenantId: req.tenant._id,
      workerNumber,
      createdBy: req.user._id
    });

    res.status(201).json(worker);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
// @route   POST /api/manpower/workers/bulk
router.post('/workers/bulk', checkPermission('canCreateWorker'), async (req, res) => {
  try {
    const { workers } = req.body;
    if (!Array.isArray(workers) || workers.length === 0) {
      return res.status(400).json({ error: 'No workers provided' });
    }

    const lastWorker = await ManpowerWorker.findOne({ tenantId: req.tenant._id })
        .sort({ workerNumber: -1 });
    
    let nextNum = 1;
    if (lastWorker && lastWorker.workerNumber) {
      const match = lastWorker.workerNumber.match(/\d+$/);
      if (match) nextNum = parseInt(match[0], 10) + 1;
    }

    const year = new Date().getFullYear();
    const ops = workers.map((w, index) => {
      const workerNumber = `WKR-${year}-${(nextNum + index).toString().padStart(4, '0')}`;
      return {
        insertOne: {
          document: {
            ...w,
            tenantId: req.tenant._id,
            workerNumber,
            createdBy: req.user._id,
            status: 'available'
          }
        }
      };
    });

    const result = await ManpowerWorker.bulkWrite(ops, { ordered: false });
    res.status(201).json({ success: true, count: result.insertedCount });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// @route   GET /api/manpower/workers/:id
router.get('/workers/:id', async (req, res) => {
  try {
    const worker = await ManpowerWorker.findOne({ _id: req.params.id, tenantId: req.tenant._id })
        .populate('currentAssignment')
        .populate('clientId', 'name nameAr');
    
    if (!worker) return res.status(404).json({ error: 'Worker not found' });
    res.json(worker);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   PUT /api/manpower/workers/:id
router.put('/workers/:id', checkPermission('canUpdateWorker'), async (req, res) => {
  try {
    const worker = await ManpowerWorker.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenant._id },
      { $set: req.body },
      { new: true, runValidators: true }
    );
    
    if (!worker) return res.status(404).json({ error: 'Worker not found' });
    res.json(worker);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// --- ASSIGNMENTS ---

// @route   GET /api/manpower/assignments
router.get('/assignments', async (req, res) => {
  try {
    const { status, clientId } = req.query;
    let query = { tenantId: req.tenant._id };

    if (status) query.status = status;
    if (clientId) query.clientId = clientId;

    const assignments = await ManpowerAssignment.find(query)
        .populate('clientId', 'name nameAr')
        .populate('workers.workerId', 'name workerNumber trade')
        .sort({ createdAt: -1 });

    res.json(assignments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   POST /api/manpower/assignments
router.post('/assignments', checkPermission('canCreateAssignment'), async (req, res) => {
  try {
    const lastAssignment = await ManpowerAssignment.findOne({ tenantId: req.tenant._id })
        .sort({ assignmentNumber: -1 });
    
    let nextNum = 1;
    if (lastAssignment && lastAssignment.assignmentNumber) {
      const match = lastAssignment.assignmentNumber.match(/\d+$/);
      if (match) nextNum = parseInt(match[0], 10) + 1;
    }
    const assignmentNumber = `ASN-${new Date().getFullYear()}-${nextNum.toString().padStart(4, '0')}`;

    const assignment = await ManpowerAssignment.create({
      ...req.body,
      tenantId: req.tenant._id,
      assignmentNumber,
      createdBy: req.user._id
    });
    
    // Update worker status if assignment is active
    if (assignment.status === 'active' && assignment.workers?.length > 0) {
      const workerIds = assignment.workers.map(w => w.workerId);
      await ManpowerWorker.updateMany(
        { _id: { $in: workerIds }, tenantId: req.tenant._id },
        { 
          $set: { 
            status: 'assigned',
            currentAssignment: assignment._id,
            clientId: assignment.clientId
          }
        }
      );
    }

    res.status(201).json(assignment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   GET /api/manpower/assignments/:id
router.get('/assignments/:id', async (req, res) => {
  try {
    const assignment = await ManpowerAssignment.findOne({ _id: req.params.id, tenantId: req.tenant._id })
        .populate('clientId', 'name nameAr vatNumber')
        .populate('workers.workerId', 'name workerNumber trade dailyRate')
        .populate('invoiceIds');
    
    if (!assignment) return res.status(404).json({ error: 'Assignment not found' });
    res.json(assignment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   PUT /api/manpower/assignments/:id
router.put('/assignments/:id', checkPermission('canUpdateAssignment'), async (req, res) => {
  try {
    const assignment = await ManpowerAssignment.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenant._id },
      { $set: req.body },
      { new: true, runValidators: true }
    );
    
    if (!assignment) return res.status(404).json({ error: 'Assignment not found' });
    res.json(assignment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
