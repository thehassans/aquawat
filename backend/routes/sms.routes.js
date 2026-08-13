import express from 'express';
import mongoose from 'mongoose';
import Tenant from '../models/Tenant.js';
import SmsMessage from '../models/SmsMessage.js';
import Invoice from '../models/Invoice.js';
import Customer from '../models/Customer.js';
import { protect, tenantFilter, authorize, requireTenantFilter, checkSmsAddon } from '../middleware/auth.js';
import { sendSms, serializeSmsSettings, normalizeSmsPhone, renderSmsTemplate } from '../services/smsService.js';
import { tenantHasSmsAddon } from '../utils/appStoreEntitlements.js';

const router = express.Router();

const DEFAULT_INVOICE_TEMPLATE_EN =
  'Dear {{customerName}}, invoice {{invoiceNumber}} totaling {{total}} {{currency}} is ready. {{link}}';
const DEFAULT_INVOICE_TEMPLATE_AR =
  'عزيزي {{customerName}}، فاتورتك رقم {{invoiceNumber}} بمبلغ {{total}} {{currency}} جاهزة. {{link}}';

const resolveSmsSettings = (tenant) => tenant?.settings?.communication?.sms || {};

const normalizeSmsSettings = (tenant, incoming = {}) => {
  const current = resolveSmsSettings(tenant);
  const next = {
    ...current,
    enabled: incoming.enabled === true,
    autoSendInvoices: incoming.autoSendInvoices === true,
    provider: ['twilio', 'unifonic', 'custom'].includes(String(incoming.provider || current.provider || 'twilio'))
      ? String(incoming.provider || current.provider || 'twilio')
      : 'twilio',
    fromNumber: String(incoming.fromNumber ?? current.fromNumber ?? '').trim(),
    twilioAccountSid: String(incoming.twilioAccountSid ?? current.twilioAccountSid ?? '').trim(),
    unifonicAppSid: String(incoming.unifonicAppSid ?? current.unifonicAppSid ?? '').trim(),
    unifonicSenderId: String(incoming.unifonicSenderId ?? current.unifonicSenderId ?? '').trim(),
    customUrl: String(incoming.customUrl ?? current.customUrl ?? '').trim(),
    customAuthHeader: String(incoming.customAuthHeader ?? current.customAuthHeader ?? '').trim(),
    invoiceTemplateEn: String(incoming.invoiceTemplateEn ?? current.invoiceTemplateEn ?? DEFAULT_INVOICE_TEMPLATE_EN).trim()
      || DEFAULT_INVOICE_TEMPLATE_EN,
    invoiceTemplateAr: String(incoming.invoiceTemplateAr ?? current.invoiceTemplateAr ?? DEFAULT_INVOICE_TEMPLATE_AR).trim()
      || DEFAULT_INVOICE_TEMPLATE_AR,
  };

  if (Object.prototype.hasOwnProperty.call(incoming, 'twilioAuthToken')) {
    const token = String(incoming.twilioAuthToken || '').trim();
    if (token) next.twilioAuthToken = token;
  }
  if (Object.prototype.hasOwnProperty.call(incoming, 'unifonicToken')) {
    const token = String(incoming.unifonicToken || '').trim();
    if (token) next.unifonicToken = token;
  }
  if (Object.prototype.hasOwnProperty.call(incoming, 'customApiKey')) {
    const key = String(incoming.customApiKey || '').trim();
    if (key) next.customApiKey = key;
  }

  return next;
};

const invoicePublicLink = (tenant, invoiceId) => {
  const host = process.env.APP_URL || 'https://app.maqder.com';
  return `${String(host).replace(/\/$/, '')}/app/dashboard/invoices/${invoiceId}`;
};

export async function sendInvoiceSms({ tenant, invoice, customer = null, language, to }) {
  if (!tenantHasSmsAddon(tenant)) {
    return { sent: false, reason: 'sms_app_not_installed' };
  }
  const sms = resolveSmsSettings(tenant);
  if (!sms.enabled) return { sent: false, reason: 'disabled' };

  const phone = normalizeSmsPhone(to || customer?.mobile || customer?.phone || invoice?.buyer?.phone || invoice?.buyer?.mobile);
  if (!phone) return { sent: false, reason: 'missing_phone' };

  const currency = String(tenant?.settings?.currency || 'SAR').toUpperCase();
  const vars = {
    customerName: customer?.name || customer?.nameAr || invoice?.buyer?.name || invoice?.buyer?.nameAr || '',
    invoiceNumber: invoice?.invoiceNumber || '',
    total: invoice?.grandTotal ?? invoice?.total ?? '',
    currency,
    link: invoicePublicLink(tenant, invoice?._id),
  };
  const isAr = language === 'ar';
  const template = isAr
    ? (sms.invoiceTemplateAr || DEFAULT_INVOICE_TEMPLATE_AR)
    : (sms.invoiceTemplateEn || DEFAULT_INVOICE_TEMPLATE_EN);
  const body = renderSmsTemplate(template, vars);

  const record = await SmsMessage.create({
    tenantId: tenant._id,
    to: phone,
    body,
    status: 'queued',
    purpose: 'invoice',
    relatedInvoiceId: invoice?._id,
    relatedCustomerId: customer?._id,
    metadata: { invoiceNumber: invoice?.invoiceNumber },
  });

  try {
    const result = await sendSms({ to: phone, body, settings: sms });
    record.status = 'sent';
    record.provider = result.provider;
    record.providerMessageId = result.providerMessageId || '';
    record.sentAt = new Date();
    await record.save();
    return { sent: true, message: record, delivery: result };
  } catch (error) {
    record.status = 'failed';
    record.error = error.message;
    await record.save();
    return { sent: false, reason: error.message, message: record };
  }
}

export async function autoSmsInvoiceIfEnabled({ tenant, invoice, customer = null, language }) {
  if (invoice?.flow === 'purchase') return { sent: false, reason: 'purchase' };
  const sms = resolveSmsSettings(tenant);
  if (!sms.autoSendInvoices) return { sent: false, reason: 'auto_send_off' };
  return sendInvoiceSms({ tenant, invoice, customer, language });
}

router.use(protect);
router.use(tenantFilter);
router.use(requireTenantFilter);
router.use(checkSmsAddon);

router.get('/settings', async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.user.tenantId).select('settings.communication.sms subscription.hasSmsAddon settings.installedApps');
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
    res.json({ sms: serializeSmsSettings(resolveSmsSettings(tenant)) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/settings', authorize('admin'), async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.user.tenantId);
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
    const payload = req.body?.sms || req.body || {};
    const currentSettings = tenant.settings?.toObject?.() || tenant.settings || {};
    const currentCommunication = currentSettings.communication || {};
    const nextSms = normalizeSmsSettings(tenant, payload);
    tenant.settings = {
      ...currentSettings,
      communication: {
        ...currentCommunication,
        sms: nextSms,
      },
    };
    tenant.markModified('settings');
    await tenant.save();
    res.json({ sms: serializeSmsSettings(nextSms) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/test', authorize('admin'), async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.user.tenantId);
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
    const sms = resolveSmsSettings(tenant);
    const to = normalizeSmsPhone(req.body?.to);
    if (!to) return res.status(400).json({ error: 'A valid test mobile number is required' });
    const body = String(req.body?.body || 'Maqder SMS Marketing test message.').trim();
    const result = await sendSms({ to, body, settings: { ...sms, enabled: true } });
    await SmsMessage.create({
      tenantId: tenant._id,
      to,
      body,
      status: 'sent',
      purpose: 'test',
      provider: result.provider,
      providerMessageId: result.providerMessageId || '',
      sentAt: new Date(),
    });
    res.json({ success: true, delivery: result });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/messages', async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
    const search = String(req.query.search || '').trim();
    const status = String(req.query.status || '').trim();
    const query = { tenantId: req.user.tenantId };
    if (['queued', 'sent', 'failed', 'draft'].includes(status)) query.status = status;
    if (search) {
      query.$or = [
        { to: { $regex: search, $options: 'i' } },
        { body: { $regex: search, $options: 'i' } },
      ];
    }
    const [messages, total] = await Promise.all([
      SmsMessage.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      SmsMessage.countDocuments(query),
    ]);
    res.json({ messages, total, page, pages: Math.ceil(total / limit) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/stats', async (req, res) => {
  try {
    const tenantId = new mongoose.Types.ObjectId(req.user.tenantId);
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [totals] = await SmsMessage.aggregate([
      { $match: { tenantId, createdAt: { $gte: since } } },
      {
        $group: {
          _id: null,
          sent: { $sum: { $cond: [{ $eq: ['$status', 'sent'] }, 1, 0] } },
          failed: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } },
          invoices: { $sum: { $cond: [{ $eq: ['$purpose', 'invoice'] }, 1, 0] } },
        },
      },
    ]);
    res.json({
      sent: totals?.sent || 0,
      failed: totals?.failed || 0,
      invoices: totals?.invoices || 0,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/send', async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.user.tenantId);
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
    const sms = resolveSmsSettings(tenant);
    const recipients = Array.isArray(req.body?.to) ? req.body.to : [req.body?.to];
    const phones = [...new Set(recipients.map(normalizeSmsPhone).filter(Boolean))];
    const body = String(req.body?.body || '').trim();
    if (!phones.length) return res.status(400).json({ error: 'At least one valid mobile number is required' });
    if (!body) return res.status(400).json({ error: 'Message body is required' });

    const deliveries = [];
    for (const phone of phones) {
      const record = await SmsMessage.create({
        tenantId: tenant._id,
        to: phone,
        body,
        status: 'queued',
        purpose: phones.length > 1 ? 'campaign' : 'manual',
        relatedCustomerId: req.body?.customerId || undefined,
      });
      try {
        const result = await sendSms({ to: phone, body, settings: sms });
        record.status = 'sent';
        record.provider = result.provider;
        record.providerMessageId = result.providerMessageId || '';
        record.sentAt = new Date();
        await record.save();
        deliveries.push({ to: phone, sent: true, id: record._id });
      } catch (error) {
        record.status = 'failed';
        record.error = error.message;
        await record.save();
        deliveries.push({ to: phone, sent: false, error: error.message, id: record._id });
      }
    }

    res.status(201).json({
      success: deliveries.some((d) => d.sent),
      deliveries,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/invoices/:invoiceId/send', async (req, res) => {
  try {
    const invoice = await Invoice.findOne({ _id: req.params.invoiceId, ...req.tenantFilter });
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    if (invoice.flow === 'purchase') {
      return res.status(400).json({ error: 'Purchase invoices cannot be sent by SMS' });
    }
    const tenant = await Tenant.findById(req.user.tenantId);
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
    const customer = invoice.customerId
      ? await Customer.findOne({ _id: invoice.customerId, tenantId: invoice.tenantId }).select('name nameAr email phone mobile contactPerson')
      : null;
    const result = await sendInvoiceSms({
      tenant,
      invoice,
      customer,
      language: req.body?.language || tenant?.settings?.language,
      to: req.body?.to,
    });
    if (!result.sent) {
      return res.status(400).json({ error: result.reason || 'Failed to send SMS' });
    }
    res.json({ success: true, delivery: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
