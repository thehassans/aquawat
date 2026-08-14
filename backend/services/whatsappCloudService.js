/**
 * Official Meta WhatsApp Cloud API (Graph API).
 * Docs:
 *   https://developers.facebook.com/docs/whatsapp/cloud-api/get-started
 *   https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks
 *   https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-messages
 *   https://developers.facebook.com/docs/whatsapp/business-management-api/message-templates
 */
import axios from 'axios';
import { WhatsAppConfig, WhatsAppContact, WhatsAppMessage, WhatsAppTemplate } from '../models/WhatsApp.js';
import { getOrBuildInvoicePdfAttachment } from './invoicePdfQueue.js';

export const GRAPH_API_VERSION = 'v21.0';
export const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

export function formatWhatsAppPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('966')) return digits;
  if (digits.startsWith('00')) return digits.slice(2);
  if (digits.startsWith('0')) return `966${digits.slice(1)}`;
  if (digits.length === 9) return `966${digits}`;
  return digits;
}

export function graphErrorMessage(error) {
  const data = error?.response?.data?.error;
  if (data?.error_user_msg) return data.error_user_msg;
  if (data?.message) return data.message;
  return error?.message || 'WhatsApp Cloud API error';
}

function authHeaders(token) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

export async function getWhatsAppConfig(tenantId, { requireActive = false } = {}) {
  const query = { tenantId };
  if (requireActive) query.isActive = true;
  return WhatsAppConfig.findOne(query);
}

export async function fetchPhoneNumber(config) {
  const res = await axios.get(`${GRAPH_API_BASE}/${config.phoneNumberId}`, {
    params: {
      fields: 'id,display_phone_number,verified_name,quality_rating,code_verification_status,platform_type,is_official_business_account,throughput',
    },
    headers: authHeaders(config.accessToken),
    timeout: 20000,
  });
  return res.data;
}

export async function fetchWaba(config) {
  if (!config.businessAccountId) return null;
  const res = await axios.get(`${GRAPH_API_BASE}/${config.businessAccountId}`, {
    params: {
      fields: 'id,name,currency,timezone_id,account_review_status,message_template_namespace,ownership_type',
    },
    headers: authHeaders(config.accessToken),
    timeout: 20000,
  });
  return res.data;
}

export async function testCloudConnection(config) {
  if (!config?.accessToken || !config?.phoneNumberId) {
    throw new Error('Phone Number ID and access token are required');
  }
  const phone = await fetchPhoneNumber(config);
  let waba = null;
  if (config.businessAccountId) {
    try { waba = await fetchWaba(config); } catch { waba = null; }
  }
  return {
    ok: true,
    displayPhone: phone.display_phone_number || '',
    verifiedName: phone.verified_name || '',
    qualityRating: phone.quality_rating || '',
    verificationStatus: phone.code_verification_status || '',
    wabaName: waba?.name || '',
    wabaReview: waba?.account_review_status || '',
    raw: { phone, waba },
  };
}

export async function listCloudTemplates(config) {
  if (!config.businessAccountId) return [];
  const res = await axios.get(`${GRAPH_API_BASE}/${config.businessAccountId}/message_templates`, {
    params: { fields: 'id,name,status,language,category,components', limit: 100 },
    headers: authHeaders(config.accessToken),
    timeout: 20000,
  });
  return res.data?.data || [];
}

export async function syncCloudTemplates(tenantId, config) {
  const remote = await listCloudTemplates(config);
  for (const t of remote) {
    const body = t.components?.find((c) => c.type === 'BODY');
    const header = t.components?.find((c) => c.type === 'HEADER');
    const footer = t.components?.find((c) => c.type === 'FOOTER');
    await WhatsAppTemplate.findOneAndUpdate(
      { tenantId, name: t.name, language: t.language },
      {
        tenantId,
        name: t.name,
        language: t.language,
        category: String(t.category || 'utility').toLowerCase(),
        metaTemplateId: t.id,
        status: ['approved', 'rejected', 'disabled'].includes(String(t.status || '').toLowerCase())
          ? String(t.status).toLowerCase()
          : 'pending',
        body: body?.text || ' ',
        header: header ? { type: String(header.format || 'text').toLowerCase(), text: header.text || '', mediaUrl: '' } : undefined,
        footer: footer?.text || '',
        isActive: String(t.status || '').toUpperCase() === 'APPROVED',
      },
      { upsert: true }
    );
  }
  return { synced: remote.length, templates: remote };
}

const SAMPLE_INVOICE_PDF = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n4 0 obj<</Length 68>>stream\nBT /F1 18 Tf 72 720 Td (Maqder sample invoice) Tj ET\nendstream\nendobj\n5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\nxref\n0 6\n0000000000 65535 f \ntrailer<</Size 6/Root 1 0 R>>\nstartxref\n600\n%%EOF\n'
);

async function resolveMetaAppId(config) {
  if (config.metaAppId) return config.metaAppId;
  const res = await axios.get(`${GRAPH_API_BASE}/app`, {
    params: { fields: 'id,name' },
    headers: authHeaders(config.accessToken),
    timeout: 15000,
  });
  return res.data?.id || '';
}

async function uploadTemplateExampleHandle(config) {
  const appId = await resolveMetaAppId(config);
  if (!appId) {
    throw new Error('Could not resolve Meta App ID. Paste App ID from developers.facebook.com/apps.');
  }
  const start = await axios.post(
    `${GRAPH_API_BASE}/${appId}/uploads`,
    null,
    {
      params: {
        file_name: 'maqder-sample-invoice.pdf',
        file_length: SAMPLE_INVOICE_PDF.length,
        file_type: 'application/pdf',
        access_token: config.accessToken,
      },
      timeout: 20000,
    }
  );
  const sessionId = start.data?.id;
  if (!sessionId) throw new Error('Meta upload session was not created');
  const finish = await axios.post(
    `https://graph.facebook.com/${sessionId}`,
    SAMPLE_INVOICE_PDF,
    {
      headers: {
        Authorization: `OAuth ${config.accessToken}`,
        file_offset: 0,
        'Content-Type': 'application/octet-stream',
      },
      timeout: 30000,
      maxBodyLength: Infinity,
    }
  );
  const handle = finish.data?.h;
  if (!handle) throw new Error('Meta did not return a template media handle');
  return { appId, handle };
}

function invoiceTemplatePayload(spec, headerHandle) {
  return {
    name: spec.name,
    language: spec.language,
    category: 'UTILITY',
    components: [
      { type: 'HEADER', format: 'DOCUMENT', example: { header_handle: [headerHandle] } },
      {
        type: 'BODY',
        text: spec.body,
        example: { body_text: [spec.example] },
      },
      { type: 'FOOTER', text: spec.footer },
    ],
  };
}

const INVOICE_SPECS = [
  {
    name: 'maqder_invoice',
    language: 'en_US',
    body: 'Hello {{1}}, your invoice {{2}} is ready. Amount due: {{3}}. Thank you for your business.',
    example: ['Customer', 'INV-1001', '150.00 SAR'],
    footer: 'Sent via Maqder',
  },
  {
    name: 'maqder_invoice_ar',
    language: 'ar',
    body: 'مرحباً {{1}}، فاتورتك رقم {{2}} جاهزة. المبلغ: {{3}}. شكراً لتعاملك معنا.',
    example: ['العميل', 'INV-1001', '150.00 SAR'],
    footer: 'مرسلة عبر مقدر',
  },
];

export async function createInvoiceTemplates(config) {
  const { appId, handle } = await uploadTemplateExampleHandle(config);
  if (appId && config.metaAppId !== appId) {
    config.metaAppId = appId;
    try { await config.save(); } catch { /* optional persist */ }
  }
  const created = [];
  const errors = [];
  for (const spec of INVOICE_SPECS) {
    const payload = invoiceTemplatePayload(spec, handle);
    try {
      const res = await axios.post(
        `${GRAPH_API_BASE}/${config.businessAccountId}/message_templates`,
        payload,
        { headers: authHeaders(config.accessToken), timeout: 20000 }
      );
      created.push({ name: spec.name, language: spec.language, id: res.data?.id, status: res.data?.status || 'PENDING' });
    } catch (error) {
      const msg = graphErrorMessage(error);
      if (/already exists|duplicate/i.test(msg)) {
        created.push({ name: spec.name, language: spec.language, status: 'EXISTS' });
      } else {
        errors.push({ name: spec.name, error: msg });
      }
    }
  }
  return { created, errors, metaAppId: appId };
}

export async function uploadMedia(config, { buffer, filename, mimeType }) {
  const form = new FormData();
  form.append('messaging_product', 'whatsapp');
  form.append('type', mimeType || 'application/pdf');
  const bytes = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  form.append('file', new Blob([new Uint8Array(bytes)], { type: mimeType || 'application/pdf' }), filename || 'invoice.pdf');
  const res = await axios.post(`${GRAPH_API_BASE}/${config.phoneNumberId}/media`, form, {
    headers: { Authorization: `Bearer ${config.accessToken}` },
    timeout: 45000,
    maxBodyLength: Infinity,
  });
  return res.data?.id;
}

export async function sendCloudMessage(config, payload) {
  const res = await axios.post(
    `${GRAPH_API_BASE}/${config.phoneNumberId}/messages`,
    { messaging_product: 'whatsapp', recipient_type: 'individual', ...payload },
    { headers: authHeaders(config.accessToken), timeout: 20000 }
  );
  return res.data;
}

async function upsertOutboundMessage({ tenantId, phone, waMessageId, type, text, templateName, mediaId, fileName }) {
  const formatted = formatWhatsAppPhone(phone);
  let contact = await WhatsAppContact.findOne({ tenantId, phoneNumber: formatted });
  if (!contact) {
    contact = await WhatsAppContact.create({
      tenantId,
      phoneNumber: formatted,
      formattedPhone: formatted,
      name: formatted,
      source: 'manual',
      lastMessageAt: new Date(),
      totalMessages: 1,
    });
  } else {
    contact.lastMessageAt = new Date();
    contact.totalMessages = (contact.totalMessages || 0) + 1;
    await contact.save();
  }
  await WhatsAppMessage.create({
    tenantId,
    contactId: contact._id,
    waMessageId: waMessageId || '',
    direction: 'outbound',
    type,
    text: text || '',
    templateName: templateName || '',
    mediaId: mediaId || '',
    fileName: fileName || '',
    status: 'sent',
    timestamp: new Date(),
  });
}

export async function sendSessionText(config, to, text) {
  const data = await sendCloudMessage(config, {
    to: formatWhatsAppPhone(to),
    type: 'text',
    text: { preview_url: true, body: text },
  });
  return { messageId: data?.messages?.[0]?.id, data };
}

export async function sendSessionDocument(config, to, { mediaId, filename, caption }) {
  const data = await sendCloudMessage(config, {
    to: formatWhatsAppPhone(to),
    type: 'document',
    document: { id: mediaId, filename, caption: caption || '' },
  });
  return { messageId: data?.messages?.[0]?.id, data };
}

export async function sendInvoiceTemplate(config, to, { mediaId, filename, customerName, invoiceNumber, amountLabel, language }) {
  const arabic = language === 'ar';
  const name = arabic
    ? (config.invoiceTemplateNameAr || 'maqder_invoice_ar')
    : (config.invoiceTemplateName || 'maqder_invoice');
  const langCode = arabic ? (config.invoiceTemplateLanguageAr || 'ar') : (config.invoiceTemplateLanguage || 'en_US');
  const components = [
    {
      type: 'header',
      parameters: [{ type: 'document', document: { id: mediaId, filename } }],
    },
    {
      type: 'body',
      parameters: [
        { type: 'text', text: String(customerName || 'Customer').slice(0, 60) },
        { type: 'text', text: String(invoiceNumber || '').slice(0, 40) },
        { type: 'text', text: String(amountLabel || '').slice(0, 40) },
      ],
    },
  ];
  const data = await sendCloudMessage(config, {
    to: formatWhatsAppPhone(to),
    type: 'template',
    template: { name, language: { code: langCode }, components },
  });
  return { messageId: data?.messages?.[0]?.id, templateName: name, data };
}

async function hasOpenCustomerWindow(tenantId, phone) {
  const formatted = formatWhatsAppPhone(phone);
  const contact = await WhatsAppContact.findOne({ tenantId, phoneNumber: formatted });
  if (!contact) return false;
  const lastInbound = await WhatsAppMessage.findOne({
    tenantId,
    contactId: contact._id,
    direction: 'inbound',
  }).sort({ timestamp: -1 });
  if (!lastInbound?.timestamp) return false;
  return Date.now() - new Date(lastInbound.timestamp).getTime() < 24 * 60 * 60 * 1000;
}

export async function sendInvoiceOnWhatsApp({ tenant, invoice, customer, language }) {
  const config = await getWhatsAppConfig(tenant._id, { requireActive: true });
  if (!config?.accessToken || !config?.phoneNumberId) {
    return { sent: false, reason: 'whatsapp_not_connected' };
  }
  const phone = customer?.phone || customer?.mobile || invoice?.buyer?.phone;
  if (!phone) return { sent: false, reason: 'no_customer_phone' };

  const customerName = customer?.name || customer?.nameAr || invoice?.buyer?.name || invoice?.buyer?.nameAr || 'Customer';
  const amountLabel = `${Number(invoice.grandTotal || 0).toFixed(2)} ${invoice.currency || 'SAR'}`;
  const attachment = await getOrBuildInvoicePdfAttachment({
    invoice,
    tenant,
    customerName,
    language: language === 'ar' ? 'ar' : 'bilingual',
  });
  const mediaId = await uploadMedia(config, {
    buffer: attachment.content,
    filename: attachment.filename,
    mimeType: 'application/pdf',
  });

  const caption = language === 'ar'
    ? `فاتورتك ${invoice.invoiceNumber} — ${amountLabel}`
    : `Invoice ${invoice.invoiceNumber} — ${amountLabel}`;
  const openWindow = await hasOpenCustomerWindow(tenant._id, phone);

  if (openWindow) {
    const result = await sendSessionDocument(config, phone, { mediaId, filename: attachment.filename, caption });
    await upsertOutboundMessage({
      tenantId: tenant._id,
      phone,
      waMessageId: result.messageId,
      type: 'document',
      text: caption,
      mediaId,
      fileName: attachment.filename,
    });
    return { sent: true, channel: 'session', messageId: result.messageId };
  }

  try {
    const result = await sendInvoiceTemplate(config, phone, {
      mediaId,
      filename: attachment.filename,
      customerName,
      invoiceNumber: invoice.invoiceNumber,
      amountLabel,
      language,
    });
    await upsertOutboundMessage({
      tenantId: tenant._id,
      phone,
      waMessageId: result.messageId,
      type: 'template',
      text: `${invoice.invoiceNumber} ${amountLabel}`,
      templateName: result.templateName,
      mediaId,
      fileName: attachment.filename,
    });
    return { sent: true, channel: 'template', messageId: result.messageId, templateName: result.templateName };
  } catch (templateError) {
    try {
      const result = await sendSessionDocument(config, phone, { mediaId, filename: attachment.filename, caption });
      await upsertOutboundMessage({
        tenantId: tenant._id,
        phone,
        waMessageId: result.messageId,
        type: 'document',
        text: caption,
        mediaId,
        fileName: attachment.filename,
      });
      return { sent: true, channel: 'session_fallback', messageId: result.messageId };
    } catch {
      throw templateError;
    }
  }
}

export function maskSecret(value) {
  if (!value) return '';
  const s = String(value);
  if (s.length <= 8) return '••••••••';
  return `••••••••${s.slice(-6)}`;
}

export function serializeWhatsAppConfig(config) {
  if (!config) return null;
  const obj = typeof config.toObject === 'function' ? config.toObject() : { ...config };
  return {
    ...obj,
    accessToken: obj.accessToken ? maskSecret(obj.accessToken) : '',
    appSecret: obj.appSecret ? maskSecret(obj.appSecret) : '',
    hasAccessToken: Boolean(obj.accessToken),
    hasAppSecret: Boolean(obj.appSecret),
    webhookUrl: `${String(process.env.APP_URL || 'https://maqder.com').replace(/\/$/, '')}/api/whatsapp/webhook`,
    connected: Boolean(obj.isActive && obj.accessToken && obj.phoneNumberId),
  };
}
