import express from 'express';
import Tenant from '../models/Tenant.js';
import PosPayment from '../models/PosPayment.js';
import { protect, tenantFilter, authorize, requireTenantFilter } from '../middleware/auth.js';
import {
  createTerminalPayment,
  getTerminalPaymentStatus,
  cancelTerminalPayment,
  testTerminalConnection,
  isSimulationMode,
} from '../utils/posTerminalService.js';

const router = express.Router();

router.use(protect);
router.use(tenantFilter);
router.use(requireTenantFilter);

const getPosConfig = (tenant) => {
  const settings = tenant?.settings?.toObject?.() || tenant?.settings || {};
  return settings.posTerminal || {};
};

const sanitizePayment = (payment) => ({
  _id: payment._id,
  status: payment.status,
  amount: payment.amount,
  currency: payment.currency,
  provider: payment.provider,
  providerPaymentId: payment.providerPaymentId,
  approvalCode: payment.approvalCode,
  cardScheme: payment.cardScheme,
  cardLast4: payment.cardLast4,
  rrn: payment.rrn,
  orderNumber: payment.orderNumber,
  errorMessage: payment.errorMessage,
  expiresAt: payment.expiresAt,
  completedAt: payment.completedAt,
  createdAt: payment.createdAt,
});

// @route   POST /api/pos/test-connection  (admin only)
router.post('/test-connection', authorize('admin'), async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.user.tenantId);
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    // Allow testing with the values being edited in the settings form.
    const config = { ...getPosConfig(tenant), ...(req.body || {}) };
    const result = await testTerminalConnection(config);

    tenant.settings = tenant.settings || {};
    tenant.settings.posTerminal = {
      ...getPosConfig(tenant),
      lastTestedAt: new Date(),
      lastTestStatus: result.ok ? 'success' : 'failed',
    };
    tenant.markModified('settings');
    await tenant.save();

    res.json({ ...result, simulation: isSimulationMode(config) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   GET /api/pos/payments — list recent payments (last 20)
router.get('/payments', async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const payments = await PosPayment.find(req.tenantFilter)
      .sort({ createdAt: -1 })
      .limit(limit);
    res.json(payments.map(sanitizePayment));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   POST /api/pos/payments  (start a card payment on the terminal)
router.post('/payments', async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.user.tenantId);
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    const config = getPosConfig(tenant);
    if (!config.enabled) {
      return res.status(400).json({ error: 'Card terminal is not enabled. Configure it in Settings → Card Machine.' });
    }

    const amount = Number(req.body?.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: 'A valid payment amount is required.' });
    }

    const currency = req.body?.currency || config.currency || 'SAR';
    const pollTimeoutSec = Number(config.pollTimeoutSec) > 0 ? Number(config.pollTimeoutSec) : 120;

    const payment = new PosPayment({
      tenantId: req.user.tenantId,
      provider: config.provider || 'custom',
      terminalId: config.terminalId || '',
      source: req.body?.source || 'pos',
      orderType: req.body?.orderType || '',
      orderNumber: req.body?.orderNumber || '',
      amount,
      currency,
      status: 'pending',
      expiresAt: new Date(Date.now() + pollTimeoutSec * 1000),
      createdBy: req.user._id,
    });

    const result = await createTerminalPayment(config, {
      amount,
      currency,
      orderNumber: payment.orderNumber,
    });

    payment.providerPaymentId = result.providerPaymentId || '';
    payment.status = result.status || 'processing';
    payment.rawResponse = result.raw;
    await payment.save();

    res.status(201).json({ ...sanitizePayment(payment), simulation: Boolean(result.simulated) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   GET /api/pos/payments/:id  (poll status)
router.get('/payments/:id', async (req, res) => {
  try {
    const payment = await PosPayment.findOne({ _id: req.params.id, ...req.tenantFilter });
    if (!payment) return res.status(404).json({ error: 'Payment not found' });

    // Terminal states are final once reached.
    if (['approved', 'declined', 'cancelled', 'failed', 'expired'].includes(payment.status)) {
      return res.json(sanitizePayment(payment));
    }

    // Expire locally if the terminal never responded in time.
    if (payment.expiresAt && payment.expiresAt.getTime() < Date.now()) {
      payment.status = 'expired';
      payment.errorMessage = 'Payment timed out waiting for the card terminal.';
      await payment.save();
      return res.json(sanitizePayment(payment));
    }

    const tenant = await Tenant.findById(req.user.tenantId);
    const config = getPosConfig(tenant);

    const result = await getTerminalPaymentStatus(config, payment.providerPaymentId, {
      createdAt: payment.createdAt,
    });

    payment.status = result.status || payment.status;
    if (result.approvalCode) payment.approvalCode = result.approvalCode;
    if (result.cardScheme) payment.cardScheme = result.cardScheme;
    if (result.cardLast4) payment.cardLast4 = result.cardLast4;
    if (result.rrn) payment.rrn = result.rrn;
    payment.rawResponse = result.raw;
    if (['approved', 'declined', 'cancelled', 'failed', 'expired'].includes(payment.status)) {
      payment.completedAt = new Date();
    }
    await payment.save();

    res.json(sanitizePayment(payment));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   POST /api/pos/payments/:id/cancel
router.post('/payments/:id/cancel', async (req, res) => {
  try {
    const payment = await PosPayment.findOne({ _id: req.params.id, ...req.tenantFilter });
    if (!payment) return res.status(404).json({ error: 'Payment not found' });

    if (['approved'].includes(payment.status)) {
      return res.status(400).json({ error: 'Payment already approved and cannot be cancelled here.' });
    }

    const tenant = await Tenant.findById(req.user.tenantId);
    const config = getPosConfig(tenant);

    try {
      if (payment.providerPaymentId) {
        await cancelTerminalPayment(config, payment.providerPaymentId);
      }
    } catch {
      // Best-effort cancel; still mark locally cancelled.
    }

    payment.status = 'cancelled';
    payment.completedAt = new Date();
    await payment.save();

    res.json(sanitizePayment(payment));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
