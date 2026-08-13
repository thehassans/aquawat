import express from 'express';
import { protect, tenantFilter, requireTenantFilter } from '../middleware/auth.js';
import KhataAccount from '../models/KhataAccount.js';
import KhataTransaction from '../models/KhataTransaction.js';

const router = express.Router();
router.use(protect);
router.use(tenantFilter);
router.use(requireTenantFilter);

// Get all Khata accounts
router.get('/', async (req, res) => {
  try {
    const accounts = await KhataAccount.find({ tenantId: req.user.tenantId })
      .populate('customerId', 'name phone email')
      .sort('-updatedAt');
    res.json(accounts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create new Khata account
router.post('/', async (req, res) => {
  try {
    const { customerId, creditLimit } = req.body;
    
    // Check if account already exists for this customer
    const existing = await KhataAccount.findOne({ tenantId: req.user.tenantId, customerId });
    if (existing) {
      return res.status(400).json({ error: 'Khata account already exists for this customer.' });
    }

    const account = new KhataAccount({
      tenantId: req.user.tenantId,
      customerId,
      creditLimit: creditLimit || 0
    });
    
    await account.save();
    
    const populatedAccount = await KhataAccount.findById(account._id).populate('customerId', 'name phone email');
    res.status(201).json(populatedAccount);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get transactions for an account
router.get('/:id/transactions', async (req, res) => {
  try {
    const transactions = await KhataTransaction.find({ 
      tenantId: req.user.tenantId, 
      accountId: req.params.id 
    })
    .populate('recordedBy', 'name')
    .sort('-date');
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Record a transaction (Credit or Payment)
router.post('/:id/transactions', async (req, res) => {
  try {
    const { type, amount, reference, notes } = req.body;
    
    const account = await KhataAccount.findOne({ _id: req.params.id, tenantId: req.user.tenantId });
    if (!account) return res.status(404).json({ error: 'Account not found' });

    const transaction = new KhataTransaction({
      tenantId: req.user.tenantId,
      accountId: account._id,
      type,
      amount: Number(amount),
      reference,
      notes,
      recordedBy: req.user._id
    });

    await transaction.save();

    // Update account balance
    if (type === 'credit') {
      account.balance += Number(amount);
    } else if (type === 'payment') {
      account.balance -= Number(amount);
    }
    await account.save();

    res.status(201).json(transaction);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

import User from '../models/User.js';

// Delete a Khata account (requires password)
router.delete('/:id', async (req, res) => {
  try {
    const { password } = req.body;
    
    // Verify password
    const user = await User.findById(req.user._id).select('+password');
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid password' });
    }

    const account = await KhataAccount.findOne({ _id: req.params.id, tenantId: req.user.tenantId });
    if (!account) return res.status(404).json({ error: 'Khata account not found' });

    await KhataTransaction.deleteMany({ accountId: account._id });
    await account.deleteOne();

    res.json({ message: 'Account deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
