import express from 'express';
import KhayyatLaundry from '../../models/khayyat/KhayyatLaundry.js';
import KhayyatLaundryPayment from '../../models/khayyat/KhayyatLaundryPayment.js';
import { protect, tenantFilter, requireTenantFilter } from '../../middleware/auth.js';

const router = express.Router();

router.use(protect);
router.use(tenantFilter);
router.use(requireTenantFilter);

router.get('/', async (req, res) => {
  try {
    const laundries = await KhayyatLaundry.find({ tenantId: req.user.tenantId }).sort({ createdAt: -1 });
    res.json({ laundries });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, pricePerPiece } = req.body;
    if (!name) return res.status(400).json({ error: 'Laundry name is required' });

    const laundry = new KhayyatLaundry({
      tenantId: req.user.tenantId,
      name,
      pricePerPiece: pricePerPiece || 0,
      totalAssigned: 0
    });

    await laundry.save();
    res.status(201).json({ laundry });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const laundry = await KhayyatLaundry.findOne({ _id: req.params.id, tenantId: req.user.tenantId });
    if (!laundry) return res.status(404).json({ error: 'Laundry not found' });

    if (req.body.name) laundry.name = req.body.name;
    if (req.body.pricePerPiece !== undefined) laundry.pricePerPiece = req.body.pricePerPiece;
    if (req.body.totalAssigned !== undefined) laundry.totalAssigned = req.body.totalAssigned;

    await laundry.save();
    res.json({ laundry });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:id/payments', async (req, res) => {
  try {
    const laundry = await KhayyatLaundry.findOne({ _id: req.params.id, tenantId: req.user.tenantId });
    if (!laundry) return res.status(404).json({ error: 'Laundry not found' });

    const payments = await KhayyatLaundryPayment.find({ tenantId: req.user.tenantId, laundryId: laundry._id })
      .sort({ createdAt: -1 });

    const totalAmount = laundry.totalAssigned * laundry.pricePerPiece;
    const pendingAmount = Math.max(0, totalAmount - laundry.totalPaid);

    res.json({
      laundry,
      payments,
      summary: {
        totalAssigned: laundry.totalAssigned,
        pricePerPiece: laundry.pricePerPiece,
        totalAmount,
        totalPaid: laundry.totalPaid,
        pendingAmount
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/:id/payments', async (req, res) => {
  try {
    const laundry = await KhayyatLaundry.findOne({ _id: req.params.id, tenantId: req.user.tenantId });
    if (!laundry) return res.status(404).json({ error: 'Laundry not found' });

    const { amount, description } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ error: 'Invalid amount' });

    const payment = new KhayyatLaundryPayment({
      tenantId: req.user.tenantId,
      laundryId: laundry._id,
      amount,
      description: description || ''
    });

    await payment.save();

    laundry.totalPaid += amount;
    await laundry.save();

    res.status(201).json({ message: 'Payment saved', payment });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/:id/assign', async (req, res) => {
  try {
    const laundry = await KhayyatLaundry.findOne({ _id: req.params.id, tenantId: req.user.tenantId });
    if (!laundry) return res.status(404).json({ error: 'Laundry not found' });

    const { pieces } = req.body;
    if (!pieces || pieces <= 0) return res.status(400).json({ error: 'Invalid pieces' });

    laundry.totalAssigned += pieces;
    await laundry.save();

    res.json({ laundry });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const laundry = await KhayyatLaundry.findOneAndDelete({ _id: req.params.id, tenantId: req.user.tenantId });
    if (!laundry) return res.status(404).json({ error: 'Laundry not found' });
    
    await KhayyatLaundryPayment.deleteMany({ tenantId: req.user.tenantId, laundryId: req.params.id });
    res.json({ message: 'Laundry deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
