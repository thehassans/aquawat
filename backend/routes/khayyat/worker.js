import express from 'express';
import jwt from 'jsonwebtoken';
import KhayyatWorker from '../../models/khayyat/KhayyatWorker.js';
import KhayyatStitching from '../../models/khayyat/KhayyatStitching.js';
import KhayyatPayment from '../../models/khayyat/KhayyatPayment.js';
import { protect, tenantFilter, requireTenantFilter } from '../../middleware/auth.js';

const router = express.Router();

const generateToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

const protectWorker = async (req, res, next) => {
  let token;
  if (req.headers.authorization?.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }
  if (!token) return res.status(401).json({ error: 'Not authorized, no token' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const worker = await KhayyatWorker.findById(decoded.id).select('-password');
    if (!worker || !worker.isActive) return res.status(401).json({ error: 'Worker not found or inactive' });
    req.worker = worker;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Not authorized, invalid token' });
  }
};

// User routes for managing workers
router.get('/', protect, tenantFilter, requireTenantFilter, async (req, res) => {
  try {
    const workers = await KhayyatWorker.find({ tenantId: req.user.tenantId })
      .sort({ createdAt: -1 })
      .select('-password');
    res.json({ workers });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/login-as/:id', protect, tenantFilter, requireTenantFilter, async (req, res) => {
  try {
    const worker = await KhayyatWorker.findOne({ _id: req.params.id, tenantId: req.user.tenantId })
      .populate('tenantId', 'name logo')
      .select('-password');

    if (!worker) {
      return res.status(404).json({ error: 'Worker not found' });
    }

    const token = generateToken(worker._id, 'worker');
    res.json({
      token,
      role: 'worker',
      user: {
        id: worker._id,
        name: worker.name,
        phone: worker.phone,
        language: worker.language,
        shopName: worker.tenantId?.name,
        shopLogo: worker.tenantId?.logo,
        role: 'worker'
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/profile/:id', protect, tenantFilter, requireTenantFilter, async (req, res) => {
  try {
    const worker = await KhayyatWorker.findOne({
      _id: req.params.id,
      tenantId: req.user.tenantId
    }).select('-password');

    if (!worker) {
      return res.status(404).json({ error: 'Worker not found' });
    }

    const stitchings = await KhayyatStitching.find({ workerId: worker._id })
      .sort({ createdAt: -1 })
      .limit(100)
      .populate('customerId', 'name phone')
      .populate('workerId', 'name phone');

    const stats = {
      total: 0,
      assigned: 0,
      inProgress: 0,
      completed: 0,
      delivered: 0,
      uniqueCustomers: 0
    };

    const customerSet = new Set();
    for (const s of stitchings) {
      stats.total += 1;
      if (s.customerId?._id) customerSet.add(String(s.customerId._id));
      if (s.status === 'assigned') stats.assigned += 1;
      else if (s.status === 'in_progress') stats.inProgress += 1;
      else if (s.status === 'completed') stats.completed += 1;
      else if (s.status === 'delivered') stats.delivered += 1;
    }
    stats.uniqueCustomers = customerSet.size;

    res.json({ worker, stitchings, stats });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:id([0-9a-fA-F]{24})', protect, tenantFilter, requireTenantFilter, async (req, res) => {
  try {
    const worker = await KhayyatWorker.findOne({ 
      _id: req.params.id, 
      tenantId: req.user.tenantId 
    }).select('-password');
    
    if (!worker) {
      return res.status(404).json({ error: 'Worker not found' });
    }
    
    const stitchings = await KhayyatStitching.find({ workerId: worker._id })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('customerId', 'name phone');
    
    const payments = await KhayyatPayment.find({ workerId: worker._id })
      .sort({ createdAt: -1 })
      .limit(10);
    
    res.json({ worker, stitchings, payments });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', protect, tenantFilter, requireTenantFilter, async (req, res) => {
  try {
    const { name, phone, password, paymentType, paymentAmount } = req.body;
    
    const existingWorker = await KhayyatWorker.findOne({ tenantId: req.user.tenantId, phone });
    if (existingWorker) {
      return res.status(400).json({ error: 'Worker with this phone already exists' });
    }
    
    const worker = new KhayyatWorker({
      tenantId: req.user.tenantId,
      name,
      phone,
      password,
      paymentType: paymentType || 'per_stitching',
      paymentAmount: paymentAmount || 0
    });

    await worker.save();
    
    res.status(201).json({ 
      message: 'Worker created successfully',
      worker: {
        id: worker._id,
        name: worker.name,
        phone: worker.phone,
        paymentType: worker.paymentType,
        paymentAmount: worker.paymentAmount
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:id([0-9a-fA-F]{24})', protect, tenantFilter, requireTenantFilter, async (req, res) => {
  try {
    const { name, phone, password, paymentType, paymentAmount, isActive } = req.body;
    
    const worker = await KhayyatWorker.findOne({ _id: req.params.id, tenantId: req.user.tenantId });
    if (!worker) {
      return res.status(404).json({ error: 'Worker not found' });
    }
    
    if (name) worker.name = name;
    if (phone) worker.phone = phone;
    if (password) worker.password = password;
    if (paymentType) worker.paymentType = paymentType;
    if (paymentAmount !== undefined) worker.paymentAmount = paymentAmount;
    if (isActive !== undefined) worker.isActive = isActive;
    
    await worker.save();
    
    res.json({ message: 'Worker updated successfully', worker });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id([0-9a-fA-F]{24})', protect, tenantFilter, requireTenantFilter, async (req, res) => {
  try {
    const worker = await KhayyatWorker.findOne({ _id: req.params.id, tenantId: req.user.tenantId });
    if (!worker) {
      return res.status(404).json({ error: 'Worker not found' });
    }
    
    await KhayyatStitching.updateMany(
      { workerId: worker._id, tenantId: req.user.tenantId },
      { $set: { workerId: null, status: 'pending' } }
    );
    
    await KhayyatPayment.deleteMany({ workerId: worker._id, tenantId: req.user.tenantId });
    await KhayyatWorker.deleteOne({ _id: worker._id, tenantId: req.user.tenantId });
    
    res.json({ message: 'Worker deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Worker panel routes
router.get('/panel/dashboard', protectWorker, async (req, res) => {
  try {
    const workerId = req.worker._id;

    const [assignedStitchings, completedStitchings, recentStitchings] = await Promise.all([
      KhayyatStitching.countDocuments({
        workerId,
        status: { $in: ['assigned', 'in_progress'] }
      }),
      KhayyatStitching.countDocuments({
        workerId,
        status: 'completed'
      }),
      KhayyatStitching.find({ workerId })
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('customerId', 'name phone')
        .populate('relationId', 'name phone')
        .populate('fabricId', 'name madeIn pricePerRoll rollsInStock')
        .lean()
    ]);

    const pendingAmount = req.worker.pendingAmount;
    const totalEarnings = req.worker.totalEarnings;
    const totalPaid = req.worker.totalPaid;
    
    res.json({
      stats: {
        assignedStitchings,
        completedStitchings,
        pendingAmount,
        totalEarnings,
        totalPaid
      },
      recentStitchings
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/panel/stitchings', protectWorker, async (req, res) => {
  try {
    const { status } = req.query;
    const query = { workerId: req.worker._id };
    
    if (status) {
      query.status = status;
    }
    
    const stitchings = await KhayyatStitching.find(query)
      .sort({ createdAt: -1 })
      .populate('customerId', 'name phone')
      .populate('relationId', 'name phone')
      .populate('fabricId', 'name madeIn pricePerRoll rollsInStock')
      .lean();
    
    res.json({ stitchings });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/panel/stitchings/:id/status', protectWorker, async (req, res) => {
  try {
    const { status } = req.body;
    
    const stitching = await KhayyatStitching.findOne({ 
      _id: req.params.id, 
      workerId: req.worker._id 
    });
    
    if (!stitching) {
      return res.status(404).json({ error: 'Stitching not found' });
    }

    if (status === 'delivered' && stitching.status !== 'delivered') {
      stitching.deliveredDate = new Date();

      if (req.worker.paymentType === 'per_stitching' && !stitching.workerEarningsCredited) {
        const q = Number(stitching.quantity) || 0;
        req.worker.totalEarnings += req.worker.paymentAmount * q;
        req.worker.completedStitchings += q;
        await req.worker.save();
        stitching.workerEarningsCredited = true;
      }
    }
    
    stitching.status = status;
    await stitching.save();
    
    res.json({ message: 'Status updated successfully', stitching });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/panel/amounts', protectWorker, async (req, res) => {
  try {
    const payments = await KhayyatPayment.find({ workerId: req.worker._id })
      .sort({ createdAt: -1 });
    
    res.json({
      payments,
      summary: {
        totalEarnings: req.worker.totalEarnings,
        totalPaid: req.worker.totalPaid,
        pendingAmount: req.worker.pendingAmount
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/panel/settings', protectWorker, async (req, res) => {
  try {
    const { language } = req.body;
    
    if (language) {
      req.worker.language = language;
      await req.worker.save();
    }
    
    res.json({ message: 'Settings updated successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
