import express from 'express';
import { protect, tenantFilter, checkPermission, requireTenantFilter } from '../middleware/auth.js';
import { checkTrialLimits } from '../middleware/trialLimits.js';
import Voucher from '../models/Voucher.js';
import Customer from '../models/Customer.js';
import Supplier from '../models/Supplier.js';

const router = express.Router();

router.use(protect);
router.use(tenantFilter);
router.use(requireTenantFilter);

// Get all vouchers
router.get('/', checkPermission('finance', 'read'), async (req, res) => {
  try {
    const { type, startDate, endDate, partyType } = req.query;
    const query = { tenantId: req.user.tenantId };
    
    if (type) query.type = type;
    if (partyType) query.partyType = partyType;
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    const vouchers = await Voucher.find(query)
      .sort({ date: -1, createdAt: -1 })
      .limit(Math.min(parseInt(req.query.limit) || 100, 200));
    res.json(vouchers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create voucher
router.post('/', checkTrialLimits('vouchers'), checkPermission('finance', 'create'), async (req, res) => {
  try {
    // Customer receipts: unified AccountPayment path (creates payment + mirror voucher + GL)
    if (req.body?.type === 'receive' && req.body?.partyType === 'customer') {
      const { createCustomerPayment } = await import('../services/customerPaymentService.js');
      const payment = await createCustomerPayment({
        tenantId: req.user.tenantId,
        userId: req.user._id,
        customerId: req.body.partyId || null,
        customerName: req.body.partyName || '',
        date: req.body.date || new Date(),
        amount: req.body.amount,
        method: req.body.paymentMethod || 'cash',
        reference: req.body.reference || '',
        memo: req.body.description || req.body.memo || '',
        currency: req.body.currency || 'SAR',
        allocations: Array.isArray(req.body.allocations) ? req.body.allocations : [],
        source: 'voucher',
        autoAllocateOldest: !!req.body.autoAllocateOldest,
      });
      if (payment.voucherId) {
        const mirrored = await Voucher.findById(payment.voucherId);
        if (mirrored) return res.status(201).json(mirrored);
      }
      return res.status(201).json(payment);
    }

    // Generate voucher number
    const count = await Voucher.countDocuments({ tenantId: req.user.tenantId });
    const prefix = req.body.type === 'receive' ? 'RV' : 'PV';
    const voucherNumber = `${prefix}-${new Date().getFullYear()}-${(count + 1).toString().padStart(4, '0')}`;

    const voucher = new Voucher({
      ...req.body,
      tenantId: req.user.tenantId,
      voucherNumber,
      createdBy: req.user._id
    });

    await voucher.save();

    try {
      const { postVoucherJournal } = await import('../services/accountingService.js');
      await postVoucherJournal({
        tenantId: voucher.tenantId,
        userId: req.user._id,
        voucher,
        currency: voucher.currency || 'SAR',
      });
    } catch (glError) {
      console.warn('[accounting] voucher journal failed:', glError.message);
    }

    res.status(201).json(voucher);
  } catch (error) {
    res.status(400).json({ error: error.message, code: error.code });
  }
});

// Update voucher
router.put('/:id', checkPermission('finance', 'update'), async (req, res) => {
  try {
    const voucher = await Voucher.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.user.tenantId },
      req.body,
      { new: true, runValidators: true }
    );
    if (!voucher) return res.status(404).json({ error: 'Voucher not found' });
    res.json(voucher);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Delete voucher
router.delete('/:id', checkPermission('finance', 'delete'), async (req, res) => {
  try {
    const voucher = await Voucher.findOneAndDelete({ _id: req.params.id, tenantId: req.user.tenantId });
    if (!voucher) return res.status(404).json({ error: 'Voucher not found' });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get parties for dropdowns
router.get('/parties/:type', checkPermission('finance', 'read'), async (req, res) => {
  try {
    const { type } = req.params;
    let parties = [];
    if (type === 'customer') {
      parties = await Customer.find({ tenantId: req.user.tenantId }).select('name nameAr companyName phone');
    } else if (type === 'supplier') {
      parties = await Supplier.find({ tenantId: req.user.tenantId }).select('name nameAr companyName phone');
    }
    res.json(parties);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
