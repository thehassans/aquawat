import express from 'express';
import PosTerminalSession from '../models/PosTerminalSession.js';
import { protect, authorize, tenantFilter, requireTenantFilter } from '../middleware/auth.js';

const router = express.Router();
router.use(protect);

// Heartbeat from an active POS terminal. Upserts a session row for this tenant/user/tab.
// POST /api/pos-terminal/heartbeat
router.post('/heartbeat', tenantFilter, requireTenantFilter, async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: 'tenantId is required' });
    }
    const tabId = req.body?.tabId || `default-${req.user._id}`;
    const deviceStatus = req.body?.deviceStatus || {};

    const session = await PosTerminalSession.findOneAndUpdate(
      { tenantId, userId: req.user._id, tabId },
      {
        tenantId,
        userId: req.user._id,
        branchId: req.user.branchId || null,
        tabId,
        lastSeenAt: new Date(),
        isActive: true,
        deviceStatus: {
          scanner: deviceStatus.scanner || 'disconnected',
          printer: deviceStatus.printer || 'disconnected',
          cashDrawer: deviceStatus.cashDrawer || 'disconnected',
          scale: deviceStatus.scale || 'disconnected',
        },
        meta: req.body?.meta || {},
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.json({ success: true, sessionId: session._id });
  } catch (error) {
    console.error('POS terminal heartbeat error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Close a POS terminal session when the tab unmounts / closes.
// POST /api/pos-terminal/close
router.post('/close', tenantFilter, requireTenantFilter, async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: 'tenantId is required' });
    }
    const tabId = req.body?.tabId || `default-${req.user._id}`;

    await PosTerminalSession.findOneAndUpdate(
      { tenantId, userId: req.user._id, tabId },
      { isActive: false, lastSeenAt: new Date() },
      { new: true }
    );

    res.json({ success: true });
  } catch (error) {
    console.error('POS terminal close error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Super admin view: list currently active POS terminal sessions with tenant/user info.
// GET /api/pos-terminal/super-admin/sessions
router.get('/super-admin/sessions', protect, authorize('super_admin'), async (req, res) => {
  try {
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
    const sessions = await PosTerminalSession.find({
      isActive: true,
      lastSeenAt: { $gte: twoMinutesAgo },
    })
      .sort({ lastSeenAt: -1 })
      .populate('tenantId', 'name slug business.legalNameEn business.legalNameAr subscription.plan')
      .populate('userId', 'firstName lastName email role')
      .populate('branchId', 'name');

    res.json({
      count: sessions.length,
      sessions: sessions.map((s) => ({
        _id: s._id,
        tenant: s.tenantId,
        user: s.userId,
        branch: s.branchId,
        tabId: s.tabId,
        openedAt: s.openedAt,
        lastSeenAt: s.lastSeenAt,
        deviceStatus: s.deviceStatus,
      })),
    });
  } catch (error) {
    console.error('Super admin POS sessions error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
