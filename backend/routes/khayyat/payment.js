import express from 'express';
import KhayyatPayment from '../../models/khayyat/KhayyatPayment.js';
import KhayyatWorker from '../../models/khayyat/KhayyatWorker.js';
import KhayyatStitching from '../../models/khayyat/KhayyatStitching.js';
import { protect, tenantFilter, requireTenantFilter } from '../../middleware/auth.js';

const router = express.Router();

router.use(protect);
router.use(tenantFilter);
router.use(requireTenantFilter);

router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 20, workerId } = req.query;
    const query = { tenantId: req.user.tenantId };
    
    if (workerId) query.workerId = workerId;
    
    const payments = await KhayyatPayment.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('workerId', 'name phone');
    
    const total = await KhayyatPayment.countDocuments(query);
    
    res.json({
      payments,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/summary', async (req, res) => {
  try {
    const workers = await KhayyatWorker.find({ tenantId: req.user.tenantId })
      .select('name phone paymentType paymentAmount totalEarnings totalPaid pendingAmount completedStitchings');

    const perStitchingWorkers = workers.filter((w) => w.paymentType === 'per_stitching');
    if (perStitchingWorkers.length > 0) {
      const ids = perStitchingWorkers.map((w) => w._id);
      const rows = await KhayyatStitching.aggregate([
        { $match: { workerId: { $in: ids }, status: 'delivered' } },
        { $group: { _id: '$workerId', qty: { $sum: '$quantity' } } }
      ]);

      const qtyByWorker = new Map(rows.map((r) => [String(r._id), Number(r.qty) || 0]));

      const ops = [];
      perStitchingWorkers.forEach((w) => {
        const qty = qtyByWorker.get(String(w._id)) || 0;
        const totalEarnings = (Number(w.paymentAmount) || 0) * qty;
        ops.push({
          updateOne: {
            filter: { _id: w._id },
            update: {
              $set: {
                totalEarnings,
                completedStitchings: qty,
                pendingAmount: totalEarnings - (Number(w.totalPaid) || 0)
              }
            }
          }
        });
      });

      if (ops.length > 0) {
        await KhayyatWorker.bulkWrite(ops, { ordered: false });
      }
    }

    const refreshedWorkers = await KhayyatWorker.find({ tenantId: req.user.tenantId })
      .select('name phone totalEarnings totalPaid pendingAmount');
    
    const totalPaid = await KhayyatPayment.aggregate([
      { $match: { tenantId: req.user.tenantId } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    
    res.json({
      workers: refreshedWorkers,
      totalPaid: totalPaid[0]?.total || 0
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { workerId, amount, type, description } = req.body;
    
    const worker = await KhayyatWorker.findOne({ 
      _id: workerId, 
      tenantId: req.user.tenantId 
    });
    
    if (!worker) {
      return res.status(404).json({ error: 'Worker not found' });
    }
    
    if (amount <= 0) {
      return res.status(400).json({ error: 'Amount must be greater than 0' });
    }
    
    const payment = new KhayyatPayment({
      tenantId: req.user.tenantId,
      workerId,
      amount,
      type: type || 'salary',
      description: description || ''
    });
    
    await payment.save();
    
    worker.totalPaid += amount;
    worker.pendingAmount = worker.totalEarnings - worker.totalPaid;
    await worker.save();
    
    await payment.populate('workerId', 'name phone');
    
    res.status(201).json({ 
      message: 'Payment sent successfully',
      payment,
      workerBalance: {
        totalEarnings: worker.totalEarnings,
        totalPaid: worker.totalPaid,
        pendingAmount: worker.pendingAmount
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const payment = await KhayyatPayment.findOne({ 
      _id: req.params.id, 
      tenantId: req.user.tenantId 
    });
    
    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }
    
    const worker = await KhayyatWorker.findOne({ _id: payment.workerId, tenantId: req.user.tenantId });
    if (worker) {
      worker.totalPaid -= payment.amount;
      worker.pendingAmount = worker.totalEarnings - worker.totalPaid;
      await worker.save();
    }
    
    await KhayyatPayment.deleteOne({ _id: payment._id, tenantId: req.user.tenantId });
    
    res.json({ message: 'Payment deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
