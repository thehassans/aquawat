import express from 'express';
import mongoose from 'mongoose';
import Tenant from '../models/Tenant.js';
import EmailMessage from '../models/EmailMessage.js';
import { protect, tenantFilter, authorize, checkEmailAddon, requireTenantFilter } from '../middleware/auth.js';
import { listEmailMessages, createDraftMessage, sendTenantEmail, serializeTenantEmailSettings, verifyTenantEmailConnection } from '../utils/tenantEmailService.js';

const router = express.Router();

const normalizeTenantEmailSettings = (tenant, incomingEmail = {}) => {
  const currentEmail = tenant?.settings?.communication?.email?.toObject?.() || tenant?.settings?.communication?.email || {};
  const nextEmail = {
    ...currentEmail,
    ...incomingEmail,
    enabled: incomingEmail?.enabled === true,
    autoSendInvoices: incomingEmail?.autoSendInvoices === true,
    autoSendQuotations: incomingEmail?.autoSendQuotations === true,
    smtpSecure: incomingEmail?.smtpSecure === true,
    smtpPort: Number(incomingEmail?.smtpPort || currentEmail?.smtpPort || 587),
    inboundAddress: String(incomingEmail?.inboundAddress || currentEmail?.inboundAddress || `${tenant?.slug || 'tenant'}@inbound.maqder.local`).trim().toLowerCase(),
    requestedSenderName: String(incomingEmail?.requestedSenderName || currentEmail?.requestedSenderName || '').trim(),
    requestedSenderEmail: String(incomingEmail?.requestedSenderEmail || currentEmail?.requestedSenderEmail || '').trim(),
    senderName: String(incomingEmail?.senderName || currentEmail?.senderName || '').trim(),
    fromEmail: String(incomingEmail?.fromEmail || currentEmail?.fromEmail || '').trim(),
    replyTo: String(incomingEmail?.replyTo || currentEmail?.replyTo || '').trim(),
    smtpHost: String(incomingEmail?.smtpHost || currentEmail?.smtpHost || '').trim(),
    smtpUser: String(incomingEmail?.smtpUser || currentEmail?.smtpUser || '').trim(),
    subjectEn: String(incomingEmail?.subjectEn || currentEmail?.subjectEn || '').trim(),
    subjectAr: String(incomingEmail?.subjectAr || currentEmail?.subjectAr || '').trim(),
    bodyEn: String(incomingEmail?.bodyEn || currentEmail?.bodyEn || '').trim(),
    bodyAr: String(incomingEmail?.bodyAr || currentEmail?.bodyAr || '').trim(),
    signatureEn: String(incomingEmail?.signatureEn || currentEmail?.signatureEn || '').trim(),
    signatureAr: String(incomingEmail?.signatureAr || currentEmail?.signatureAr || '').trim(),
    identityType: incomingEmail?.identityType === 'custom_smtp' ? 'custom_smtp' : 'platform',
    identityStatus: ['not_requested', 'requested', 'configured', 'verified'].includes(String(incomingEmail?.identityStatus || currentEmail?.identityStatus || 'not_requested'))
      ? String(incomingEmail?.identityStatus || currentEmail?.identityStatus || 'not_requested')
      : 'not_requested',
    platformProvider: String(incomingEmail?.platformProvider || currentEmail?.platformProvider || 'platform').trim() === 'brevo' ? 'brevo' : 'platform',
    providerSenderId: String(incomingEmail?.providerSenderId || currentEmail?.providerSenderId || '').trim(),
    providerSenderStatus: String(incomingEmail?.providerSenderStatus || currentEmail?.providerSenderStatus || '').trim(),
  };

  if (Object.prototype.hasOwnProperty.call(incomingEmail || {}, 'smtpPass')) {
    const nextPassword = String(incomingEmail?.smtpPass || '').trim();
    nextEmail.smtpPass = nextPassword || currentEmail?.smtpPass || '';
  }

  delete nextEmail.hasSmtpPass;
  delete nextEmail.smtpPassMasked;
  return nextEmail;
};

router.use(protect);
router.use(tenantFilter);
router.use(requireTenantFilter);
router.use(checkEmailAddon);

router.get('/settings', async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.user.tenantId)
      .select('slug business.contactEmail settings.communication.email subscription.hasEmailAddon subscription.features');
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    res.json({ email: serializeTenantEmailSettings(tenant) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/settings', authorize('admin'), async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.user.tenantId);
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    const payload = req.body?.email || req.body || {};
    const currentSettings = tenant.settings?.toObject?.() || tenant.settings || {};
    const currentCommunication = currentSettings.communication || {};
    const nextEmail = normalizeTenantEmailSettings(tenant, payload);

    tenant.settings = {
      ...currentSettings,
      communication: {
        ...currentCommunication,
        email: nextEmail,
      },
    };
    tenant.markModified('settings');
    await tenant.save();

    return res.json({ email: serializeTenantEmailSettings(tenant) });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.post('/settings/test', authorize('admin'), async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.user.tenantId);
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }
    const result = await verifyTenantEmailConnection(tenant);
    return res.json({ success: true, result });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

router.get('/messages', async (req, res) => {
  const timeoutMs = 10000;
  let timedOut = false;
  const timeoutId = setTimeout(() => {
    timedOut = true;
    if (!res.headersSent) res.status(504).json({ error: 'Request timed out loading messages' });
  }, timeoutMs);

  try {
    const result = await listEmailMessages({
      tenantId: new mongoose.Types.ObjectId(req.user.tenantId),
      folder: req.query.folder,
      search: req.query.search,
      page: req.query.page,
      limit: req.query.limit,
    });

    clearTimeout(timeoutId);
    if (!timedOut) res.json(result);
  } catch (error) {
    clearTimeout(timeoutId);
    if (!timedOut) res.status(500).json({ error: error.message });
  }
});

router.get('/messages/:id', async (req, res) => {
  try {
    const message = await EmailMessage.findOne({ _id: req.params.id, tenantId: req.user.tenantId });
    if (!message) {
      return res.status(404).json({ error: 'Email message not found' });
    }

    if (!message.isRead && message.type === 'inbox') {
      message.isRead = true;
      await message.save();
    }

    res.json(message);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/messages/:id/read', async (req, res) => {
  try {
    const message = await EmailMessage.findOne({ _id: req.params.id, tenantId: req.user.tenantId });
    if (!message) {
      return res.status(404).json({ error: 'Email message not found' });
    }

    message.isRead = req.body?.isRead !== false;
    await message.save();
    res.json(message);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/send', async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.user.tenantId);
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    const payload = req.body || {};
    if (payload.saveAsDraft === true) {
      const draft = await createDraftMessage({
        tenantId: tenant._id,
        payload: {
          ...payload,
          from: payload.from || tenant.settings?.communication?.email?.fromEmail || tenant.settings?.communication?.email?.requestedSenderEmail || tenant.business?.contactEmail || '',
          metadata: { purpose: 'manual_compose' },
        },
      });
      return res.status(201).json({ success: true, draft });
    }

    const delivery = await sendTenantEmail({
      tenant,
      to: payload.to,
      cc: payload.cc,
      bcc: payload.bcc,
      subject: payload.subject,
      html: payload.bodyHtml,
      text: payload.bodyText,
      attachments: payload.attachments || [],
      metadata: { purpose: 'manual_compose' },
    });

    res.status(201).json({ success: true, delivery });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
