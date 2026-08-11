import express from 'express';
import { saveInboundEmail } from '../utils/tenantEmailService.js';

const router = express.Router();

router.post('/email-inbound', async (req, res) => {
  try {
    const configuredSecret = String(process.env.EMAIL_INBOUND_WEBHOOK_SECRET || '').trim();
    if (!configuredSecret && process.env.NODE_ENV === 'production') {
      return res.status(503).json({ error: 'Webhook secret not configured' });
    }
    if (configuredSecret) {
      const providedSecret = String(req.headers['x-email-webhook-secret'] || req.query.secret || req.body?.secret || '').trim();
      if (providedSecret !== configuredSecret) {
        return res.status(401).json({ error: 'Invalid webhook secret' });
      }
    }

    const provider = String(req.headers['x-email-provider'] || req.body?.provider || '').trim();
    const result = await saveInboundEmail(req.body || {}, { provider });

    if (!result.saved) {
      return res.status(404).json({ error: result.reason || 'Unable to resolve tenant' });
    }

    res.status(201).json({ success: true, duplicate: result.duplicate === true, tenantId: result.tenantId || result.message?.tenantId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
