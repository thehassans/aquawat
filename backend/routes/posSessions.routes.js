import express from 'express';
import { protect, tenantFilter, requireTenantFilter } from '../middleware/auth.js';
import PosSession from '../models/PosSession.js';

const router = express.Router();
router.use(protect);
router.use(tenantFilter);
router.use(requireTenantFilter);

// Get the currently open session for the logged-in user
router.get('/current', protect, async (req, res) => {
  try {
    const session = await PosSession.findOne({
      tenantId: req.user.tenantId,
      userId: req.user._id,
      status: 'open'
    });
    res.json({ session });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Open a new session
router.post('/open', protect, async (req, res) => {
  try {
    // Check if there's already an open session
    const existing = await PosSession.findOne({
      tenantId: req.user.tenantId,
      userId: req.user._id,
      status: 'open'
    });
    if (existing) {
      return res.status(400).json({ error: 'You already have an open session.' });
    }

    const session = new PosSession({
      tenantId: req.user.tenantId,
      userId: req.user._id,
      openingBalance: req.body.openingBalance || 0
    });
    await session.save();
    res.status(201).json(session);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Close session (EOD blind count)
router.post('/:id/close', protect, async (req, res) => {
  try {
    const session = await PosSession.findOne({ _id: req.params.id, tenantId: req.user.tenantId });
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (session.status === 'closed') return res.status(400).json({ error: 'Session already closed' });

    // In a real system, expectedClosingBalance would be calculated by summing all invoices linked to this session
    // For now, we will just take the actual closing balance from the user.
    session.status = 'closed';
    session.closedAt = new Date();
    session.actualClosingBalance = req.body.actualClosingBalance || 0;
    // Expected = opening balance + (cash sales) - (cash drops). Assuming 0 sales for now if not tracked.
    session.expectedClosingBalance = session.openingBalance - session.cashDrops.reduce((sum, drop) => sum + drop.amount, 0); 
    
    await session.save();
    res.json(session);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add cash drop
router.post('/:id/drop', protect, async (req, res) => {
  try {
    const session = await PosSession.findOne({ _id: req.params.id, tenantId: req.user.tenantId });
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (session.status === 'closed') return res.status(400).json({ error: 'Session already closed' });

    session.cashDrops.push({
      amount: req.body.amount,
      reason: req.body.reason
    });
    await session.save();
    res.json(session);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
