import logger from '../utils/logger.js';

const E164_RE = /^\+[1-9]\d{7,14}$/;

export function normalizeSmsPhone(raw) {
  const digits = String(raw || '').trim().replace(/[^\d+]/g, '');
  if (!digits) return '';
  if (digits.startsWith('+')) {
    const compact = `+${digits.slice(1).replace(/\D/g, '')}`;
    return E164_RE.test(compact) ? compact : compact;
  }
  const only = digits.replace(/\D/g, '');
  if (only.startsWith('00') && only.length > 10) return `+${only.slice(2)}`;
  if (only.startsWith('966') && only.length >= 12) return `+${only}`;
  if (only.startsWith('05') && only.length === 10) return `+966${only.slice(1)}`;
  if (only.startsWith('5') && only.length === 9) return `+966${only}`;
  if (only.length >= 8) return `+${only}`;
  return '';
}

const interpolate = (template, vars = {}) =>
  String(template || '').replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => (
    vars[key] == null ? '' : String(vars[key])
  ));

export function renderSmsTemplate(template, vars = {}) {
  return interpolate(template, vars).trim();
}

const serializeSmsSettings = (sms = {}) => ({
  enabled: sms.enabled === true,
  autoSendInvoices: sms.autoSendInvoices === true,
  provider: ['twilio', 'unifonic', 'custom'].includes(sms.provider) ? sms.provider : 'twilio',
  fromNumber: String(sms.fromNumber || '').trim(),
  twilioAccountSid: String(sms.twilioAccountSid || '').trim(),
  hasTwilioAuthToken: Boolean(sms.twilioAuthToken),
  unifonicAppSid: String(sms.unifonicAppSid || '').trim(),
  unifonicSenderId: String(sms.unifonicSenderId || '').trim(),
  hasUnifonicToken: Boolean(sms.unifonicToken),
  customUrl: String(sms.customUrl || '').trim(),
  customAuthHeader: String(sms.customAuthHeader || '').trim(),
  hasCustomApiKey: Boolean(sms.customApiKey),
  invoiceTemplateEn: String(sms.invoiceTemplateEn || '').trim(),
  invoiceTemplateAr: String(sms.invoiceTemplateAr || '').trim(),
});

export { serializeSmsSettings };

async function sendViaTwilio({ accountSid, authToken, from, to, body }) {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Messages.json`;
  const params = new URLSearchParams({ To: to, From: from, Body: body });
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.message || data?.error_message || `Twilio error ${response.status}`);
  }
  return { provider: 'twilio', providerMessageId: String(data?.sid || ''), status: String(data?.status || 'queued') };
}

async function sendViaUnifonic({ appSid, token, senderId, to, body }) {
  const url = 'https://el.cloud.unifonic.com/rest/SMS/messages';
  const params = new URLSearchParams({
    AppSid: appSid,
    SenderID: senderId,
    Recipient: to.replace(/^\+/, ''),
    Body: body,
    responseType: 'JSON',
  });
  const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(url, { method: 'POST', headers, body: params });
  const data = await response.json().catch(() => ({}));
  const success = response.ok && (data?.success === true || data?.success === 'true' || Number(data?.errorCode) === 0 || data?.data);
  if (!success) {
    throw new Error(data?.message || data?.errorCode || `Unifonic error ${response.status}`);
  }
  const messageId = String(data?.data?.MessageID || data?.data?.messageId || data?.MessageID || '');
  return { provider: 'unifonic', providerMessageId: messageId, status: 'sent' };
}

async function sendViaCustom({ url, apiKey, authHeader, to, body, from }) {
  const headers = { 'Content-Type': 'application/json' };
  if (apiKey && authHeader) headers[authHeader] = apiKey;
  else if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ to, body, from, text: body, phone: to }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || data?.message || `SMS gateway error ${response.status}`);
  }
  return {
    provider: 'custom',
    providerMessageId: String(data?.id || data?.messageId || data?.sid || ''),
    status: String(data?.status || 'sent'),
  };
}

export async function sendSms({ to, body, settings }) {
  const phone = normalizeSmsPhone(to);
  const text = String(body || '').trim();
  if (!phone) throw new Error('A valid mobile number is required');
  if (!text) throw new Error('SMS body is required');

  const sms = settings || {};
  if (sms.enabled !== true) {
    throw new Error('SMS sending is disabled. Enable it in SMS Marketing settings.');
  }

  const provider = ['twilio', 'unifonic', 'custom'].includes(sms.provider) ? sms.provider : 'twilio';
  const from = String(sms.fromNumber || sms.unifonicSenderId || '').trim();

  try {
    if (provider === 'twilio') {
      const accountSid = String(sms.twilioAccountSid || '').trim();
      const authToken = String(sms.twilioAuthToken || '').trim();
      if (!accountSid || !authToken || !from) {
        throw new Error('Twilio Account SID, Auth Token, and From number are required');
      }
      return await sendViaTwilio({ accountSid, authToken, from, to: phone, body: text });
    }

    if (provider === 'unifonic') {
      const appSid = String(sms.unifonicAppSid || '').trim();
      const senderId = String(sms.unifonicSenderId || from || '').trim();
      if (!appSid || !senderId) {
        throw new Error('Unifonic App SID and Sender ID are required');
      }
      return await sendViaUnifonic({
        appSid,
        token: String(sms.unifonicToken || '').trim(),
        senderId,
        to: phone,
        body: text,
      });
    }

    const customUrl = String(sms.customUrl || '').trim();
    if (!customUrl) throw new Error('Custom SMS gateway URL is required');
    return await sendViaCustom({
      url: customUrl,
      apiKey: String(sms.customApiKey || '').trim(),
      authHeader: String(sms.customAuthHeader || '').trim(),
      to: phone,
      body: text,
      from,
    });
  } catch (error) {
    logger.error(`[SMS] ${provider} send failed: ${error.message}`);
    throw error;
  }
}
