import Tenant from '../../models/Tenant.js';
import Customer from '../../models/Customer.js';
import InvTransfer from '../../models/inventory/InvTransfer.js';
import InvOperationType from '../../models/inventory/InvOperationType.js';
import { toObjectId } from '../../models/inventory/common.js';
import { getInvSettings } from './settingsService.js';
import { sendTenantEmail } from '../../utils/tenantEmailService.js';
import { sendSms, normalizeSmsPhone } from '../smsService.js';
import { tenantHasSmsAddon } from '../../utils/appStoreEntitlements.js';

/**
 * Resolve SMS credentials — inventory settings historically looked at settings.sms;
 * Marketing SMS uses settings.communication.sms. Prefer communication, fall back to legacy.
 */
export function resolveTenantSmsSettings(tenant) {
  const comm = tenant?.settings?.communication?.sms;
  const legacy = tenant?.settings?.sms;
  if (comm && (comm.enabled || comm.provider || comm.twilioAccountSid || comm.customUrl)) {
    return comm;
  }
  return legacy || comm || {};
}

export function buildDeliveryEmail({ transfer, partner, tenant }) {
  const transferName = transfer?.name || '';
  const origin = transfer?.origin || '';
  const partnerName = partner?.name || partner?.nameAr || 'Customer';
  const company = tenant?.name || 'Company';
  const subject = `Delivery confirmed: ${transferName}`;
  const text = [
    `Dear ${partnerName},`,
    '',
    `${company} has confirmed delivery ${transferName}${origin ? ` (ref: ${origin})` : ''}.`,
    transfer?.trackingReference ? `Tracking: ${transfer.trackingReference}` : null,
    '',
    'Thank you.',
  ].filter((line) => line !== null).join('\n');
  const html = `<p>Dear ${escapeHtml(partnerName)},</p>
<p>${escapeHtml(company)} has confirmed delivery <strong>${escapeHtml(transferName)}</strong>${origin ? ` (ref: ${escapeHtml(origin)})` : ''}.</p>
${transfer?.trackingReference ? `<p>Tracking: ${escapeHtml(transfer.trackingReference)}</p>` : ''}
<p>Thank you.</p>`;
  return { subject, text, html };
}

export function buildDeliverySms({ transfer, partner, tenant }) {
  const partnerName = partner?.name || partner?.nameAr || 'Customer';
  const company = tenant?.name || 'Company';
  const transferName = transfer?.name || '';
  const track = transfer?.trackingReference ? ` Tracking: ${transfer.trackingReference}.` : '';
  return `${company}: delivery ${transferName} confirmed for ${partnerName}.${track}`;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function appendNote(existing, line) {
  return [existing, line].filter(Boolean).join('\n');
}

/**
 * After outgoing validate: send email/SMS when flags are on.
 * Never writes stock — only partner notify + transfer.note audit lines.
 */
export async function sendDeliveryConfirmations(tenantId, transferDoc) {
  if (!transferDoc?._id) return { sent: {}, skipped: true };

  const tid = toObjectId(tenantId);
  const settings = await getInvSettings(tid);
  const wantEmail = !!settings.emailConfirmationOnDelivery;
  const wantSms = !!settings.stockSmsConfirmation;
  if (!wantEmail && !wantSms) return { sent: {}, skipped: true };

  const transfer = await InvTransfer.findOne({ _id: transferDoc._id, tenantId: tid }).lean();
  if (!transfer || transfer.state !== 'done') return { sent: {}, skipped: true };

  const opType = await InvOperationType.findById(transfer.operationTypeId).select('code').lean();
  if (opType?.code !== 'outgoing') return { sent: {}, skipped: true, reason: 'not_outgoing' };

  const tenant = await Tenant.findById(tid)
    .select('name settings.sms settings.communication.sms settings.communication.email subscription hasEmailAddon settings.installedApps')
    .lean();
  if (!tenant) return { sent: {}, skipped: true, reason: 'no_tenant' };

  const partner = transfer.partnerId
    ? await Customer.findOne({ _id: transfer.partnerId, tenantId: tid })
      .select('name nameAr email phone mobile')
      .lean()
    : null;

  const stamp = new Date().toISOString();
  const noteLines = [];
  const sent = { email: null, sms: null };

  if (wantEmail) {
    const to = String(partner?.email || '').trim();
    if (!to) {
      noteLines.push(`[email-confirmation skipped missing_email ${stamp}]`);
      sent.email = { ok: false, reason: 'missing_email' };
    } else {
      try {
        const { subject, text, html } = buildDeliveryEmail({ transfer, partner, tenant });
        const result = await sendTenantEmail({
          tenant,
          to,
          subject,
          text,
          html,
          metadata: {
            type: 'delivery_confirmation',
            transferId: String(transfer._id),
            transferName: transfer.name,
          },
        });
        const mid = result?.providerMessageId || result?.messageId || '';
        noteLines.push(`[email-confirmation sent ${stamp}${mid ? ` id=${mid}` : ''} to=${to}]`);
        sent.email = { ok: true, to, providerMessageId: mid };
      } catch (err) {
        const msg = String(err?.message || err).slice(0, 120);
        noteLines.push(`[email-confirmation failed ${stamp} ${msg}]`);
        sent.email = { ok: false, reason: 'send_failed', error: msg };
      }
    }
  }

  if (wantSms) {
    const smsSettings = resolveTenantSmsSettings(tenant);
    const rawPhone = partner?.mobile || partner?.phone || '';
    const phone = normalizeSmsPhone(rawPhone);
    if (!tenantHasSmsAddon(tenant)) {
      noteLines.push(`[sms-confirmation skipped sms_app_not_installed ${stamp}]`);
      sent.sms = { ok: false, reason: 'sms_app_not_installed' };
    } else if (smsSettings.enabled !== true) {
      noteLines.push(`[sms-confirmation skipped disabled ${stamp}]`);
      sent.sms = { ok: false, reason: 'disabled' };
    } else if (!phone) {
      noteLines.push(`[sms-confirmation skipped missing_phone ${stamp}]`);
      sent.sms = { ok: false, reason: 'missing_phone' };
    } else {
      try {
        const body = buildDeliverySms({ transfer, partner, tenant });
        const result = await sendSms({ to: phone, body, settings: smsSettings });
        const mid = result?.providerMessageId || '';
        noteLines.push(`[sms-confirmation sent ${stamp}${mid ? ` id=${mid}` : ''} to=${phone}]`);
        sent.sms = { ok: true, to: phone, providerMessageId: mid };
      } catch (err) {
        const msg = String(err?.message || err).slice(0, 120);
        noteLines.push(`[sms-confirmation failed ${stamp} ${msg}]`);
        sent.sms = { ok: false, reason: 'send_failed', error: msg };
      }
    }
  }

  if (noteLines.length) {
    let note = transfer.note || '';
    for (const line of noteLines) note = appendNote(note, line);
    await InvTransfer.updateOne({ _id: transfer._id, tenantId: tid }, { $set: { note } });
  }

  return { sent, notes: noteLines };
}
