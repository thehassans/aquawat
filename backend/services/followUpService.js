/**
 * AR collection follow-up: preview + send with FollowUpLog.
 */
import mongoose from 'mongoose';
import Invoice from '../models/Invoice.js';
import Customer from '../models/Customer.js';
import Tenant from '../models/Tenant.js';
import FollowUpLog from '../models/FollowUpLog.js';
import {
  getFollowUpLevels,
  resolveFollowUpLevel,
  getReminderTemplate,
  renderReminderTemplate,
} from './accountingService.js';

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

function cleanPhone(phone) {
  return String(phone || '').replace(/[^0-9]/g, '');
}

function buildBaseUrl(tenant) {
  const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
  return process.env.APP_URL || `${protocol}://${tenant?.domain || 'app.maqder.com'}`;
}

/**
 * Build reminder payloads for selected invoices (no side effects).
 */
export async function prepareFollowUpReminders({
  tenantId,
  invoiceIds = [],
  language = 'ar',
  channel = null,
  levelId = null,
  asOf = null,
} = {}) {
  const ids = (invoiceIds || []).filter(Boolean).slice(0, 50);
  if (!ids.length) throw Object.assign(new Error('invoiceIds required'), { status: 400 });

  const tenant = await Tenant.findById(tenantId);
  const { levels } = await getFollowUpLevels(tenantId);
  const { template: globalTemplate } = await getReminderTemplate(tenantId);
  const asOfDate = asOf ? new Date(asOf) : new Date();

  const invoices = await Invoice.find({
    _id: { $in: ids },
    tenantId,
    flow: 'sell',
    status: { $nin: ['draft', 'cancelled', 'credited'] },
  }).lean();

  const partnerIds = [...new Set(invoices.map((i) => String(i.customerId || '')).filter(Boolean))];
  const partners = partnerIds.length
    ? await Customer.find({ _id: { $in: partnerIds }, tenantId }).select('name nameEn nameAr phone mobile email').lean()
    : [];
  const byPartner = Object.fromEntries(partners.map((p) => [String(p._id), p]));
  const baseUrl = buildBaseUrl(tenant);

  const forcedLevel = levelId != null
    ? levels.find((l) => String(l.level) === String(levelId) || String(l._id) === String(levelId))
    : null;

  const results = invoices.map((invoice) => {
    const customer = invoice.customerId ? byPartner[String(invoice.customerId)] : null;
    const phone = cleanPhone(customer?.mobile || customer?.phone || invoice?.buyer?.phone || invoice?.buyer?.contactPhone);
    const residual = Math.max(0, Number(invoice.grandTotal || 0) - Number(invoice.paidAmount || 0));
    const amountLabel = `${residual.toFixed(2)} ${invoice.currency || 'SAR'}`;
    const customerName = customer?.name || customer?.nameEn || customer?.nameAr || invoice?.buyer?.name || 'Customer';
    const link = `${baseUrl}/app/dashboard/accounting/invoices/${invoice._id}`;
    const dueRaw = invoice.dueDate || invoice.issueDate || asOfDate;
    const baseDate = new Date(dueRaw);
    const ageDays = Math.max(0, Math.floor((asOfDate - baseDate) / 86400000));
    const level = forcedLevel || resolveFollowUpLevel(ageDays, levels);
    const levelNameEn = level?.name || 'Reminder';
    const levelNameAr = level?.nameAr || level?.name || 'تذكير';
    const levelName = language === 'ar' ? levelNameAr : levelNameEn;
    const dueLabel = baseDate.toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-GB');
    const vars = {
      customerName,
      invoiceNumber: invoice.invoiceNumber || '',
      amount: amountLabel,
      dueDate: dueLabel,
      daysOverdue: String(ageDays),
      link,
      levelName,
    };

    const templateEn = String(level?.templateEn || globalTemplate.en || '');
    const templateAr = String(level?.templateAr || globalTemplate.ar || '');
    const textEn = renderReminderTemplate(templateEn, { ...vars, levelName: levelNameEn });
    const textAr = renderReminderTemplate(templateAr, { ...vars, levelName: levelNameAr });
    const resolvedChannel = channel || level?.channel || 'whatsapp';
    const messageText = language === 'ar' ? textAr : textEn;
    const bilingual = `${textEn}\n\n——\n\n${textAr}`;
    const waLink = phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(bilingual)}`
      : `https://wa.me/?text=${encodeURIComponent(bilingual)}`;

    return {
      invoiceId: invoice._id,
      invoiceNumber: invoice.invoiceNumber,
      customerId: invoice.customerId || null,
      partnerName: customerName,
      partnerEmail: customer?.email || invoice?.buyer?.contactEmail || '',
      phone: phone || null,
      residual: round2(residual),
      ageDays,
      dueDate: invoice.dueDate || invoice.issueDate || null,
      followUpLevel: level?.level || null,
      levelName: levelNameEn,
      levelNameAr,
      followUpChannel: resolvedChannel,
      messageText,
      messageEn: textEn,
      messageAr: textAr,
      bilingual,
      waLink,
    };
  });

  return {
    count: results.length,
    language,
    customerCount: new Set(results.map((r) => String(r.customerId || r.partnerName))).size,
    totalResidual: round2(results.reduce((s, r) => s + Number(r.residual || 0), 0)),
    results,
  };
}

/**
 * Preview (dryRun) or send follow-up reminders and write FollowUpLog.
 */
export async function sendFollowUpReminders({
  tenantId,
  userId,
  invoiceIds = [],
  language = 'ar',
  channel = null,
  levelId = null,
  dryRun = true,
  asOf = null,
} = {}) {
  const preview = await prepareFollowUpReminders({
    tenantId,
    invoiceIds,
    language,
    channel,
    levelId,
    asOf,
  });

  if (dryRun) {
    return { ...preview, dryRun: true, sent: 0, failed: 0, logs: [] };
  }

  let sent = 0;
  let failed = 0;
  const logs = [];

  for (const row of preview.results) {
    const ch = channel || row.followUpChannel || 'whatsapp';
    let status = 'wa_link';
    let response = '';

    try {
      if (ch === 'whatsapp') {
        // Prefer Cloud API when connected; otherwise fall back to wa.me link (opened by client).
        try {
          const tenant = await Tenant.findById(tenantId);
          const { getWhatsAppConfig, sendInvoiceOnWhatsApp } = await import('./whatsappCloudService.js');
          const cfg = getWhatsAppConfig?.(tenant);
          if (cfg?.connected || cfg?.accessToken || tenant?.whatsapp?.accessToken) {
            const invoice = await Invoice.findById(row.invoiceId);
            const customer = row.customerId
              ? await Customer.findById(row.customerId).lean()
              : null;
            const result = await sendInvoiceOnWhatsApp({
              tenant,
              invoice,
              customer: customer || { phone: row.phone, name: row.partnerName },
              language,
            });
            if (result?.sent) {
              status = 'sent';
              response = result.reason || 'whatsapp_cloud';
            } else {
              status = 'wa_link';
              response = result?.reason || 'whatsapp_not_connected';
            }
          }
        } catch (waErr) {
          status = 'wa_link';
          response = waErr.message || 'whatsapp_fallback';
        }
      } else if (ch === 'email') {
        status = 'copied';
        response = 'email_copy_fallback';
      } else if (ch === 'sms' || ch === 'call') {
        status = 'copied';
        response = `${ch}_manual`;
      } else {
        status = 'copied';
      }

      const log = await FollowUpLog.create({
        tenantId,
        customerId: row.customerId || null,
        invoiceId: row.invoiceId,
        invoiceNumber: row.invoiceNumber,
        level: row.followUpLevel || 1,
        levelName: language === 'ar' ? row.levelNameAr : row.levelName,
        channel: ch,
        sentAt: new Date(),
        sentBy: userId || null,
        messageBody: row.bilingual || row.messageText,
        messageEn: row.messageEn,
        messageAr: row.messageAr,
        status,
        response,
        waLink: row.waLink || '',
        phone: row.phone || '',
        ageDays: row.ageDays,
        residual: row.residual,
        dryRun: false,
      });

      logs.push({
        logId: log._id,
        invoiceId: row.invoiceId,
        status,
        waLink: row.waLink,
        phone: row.phone,
        messageEn: row.messageEn,
        messageAr: row.messageAr,
        bilingual: row.bilingual,
      });
      if (status === 'failed') failed += 1;
      else sent += 1;
    } catch (err) {
      failed += 1;
      const log = await FollowUpLog.create({
        tenantId,
        customerId: row.customerId || null,
        invoiceId: row.invoiceId,
        invoiceNumber: row.invoiceNumber,
        level: row.followUpLevel || 1,
        levelName: row.levelName,
        channel: ch,
        sentBy: userId || null,
        messageBody: row.bilingual || row.messageText,
        messageEn: row.messageEn,
        messageAr: row.messageAr,
        status: 'failed',
        response: err.message || 'send_failed',
        waLink: row.waLink || '',
        phone: row.phone || '',
        ageDays: row.ageDays,
        residual: row.residual,
        dryRun: false,
      });
      logs.push({ logId: log._id, invoiceId: row.invoiceId, status: 'failed', error: err.message });
    }
  }

  return {
    ...preview,
    dryRun: false,
    sent,
    failed,
    logs,
  };
}

/** Latest non-preview log per invoice. */
export async function getLastFollowUpsByInvoiceIds(tenantId, invoiceIds = []) {
  const ids = (invoiceIds || []).filter(Boolean).slice(0, 200);
  if (!ids.length) return {};

  const logs = await FollowUpLog.aggregate([
    {
      $match: {
        tenantId: new mongoose.Types.ObjectId(String(tenantId)),
        invoiceId: { $in: ids.map((id) => new mongoose.Types.ObjectId(String(id))) },
        dryRun: { $ne: true },
        status: { $nin: ['preview'] },
      },
    },
    { $sort: { sentAt: -1 } },
    {
      $group: {
        _id: '$invoiceId',
        sentAt: { $first: '$sentAt' },
        channel: { $first: '$channel' },
        level: { $first: '$level' },
        levelName: { $first: '$levelName' },
        status: { $first: '$status' },
      },
    },
  ]);

  return Object.fromEntries(logs.map((l) => [String(l._id), l]));
}

export async function listFollowUpLogs(tenantId, {
  customerId = null,
  invoiceId = null,
  limit = 50,
} = {}) {
  const filter = { tenantId, dryRun: { $ne: true } };
  if (customerId) filter.customerId = customerId;
  if (invoiceId) filter.invoiceId = invoiceId;
  const rows = await FollowUpLog.find(filter)
    .sort({ sentAt: -1 })
    .limit(Math.min(100, Math.max(1, Number(limit) || 50)))
    .lean();
  return { rows };
}
