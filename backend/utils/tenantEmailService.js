import Tenant from '../models/Tenant.js';
import Invoice from '../models/Invoice.js';
import Customer from '../models/Customer.js';
import EmailMessage from '../models/EmailMessage.js';
import SystemSettings from '../models/SystemSettings.js';
import logger from './logger.js';
import { getOrBuildInvoicePdfAttachment } from '../services/invoicePdfQueue.js';
import { ensureEmailDeliveryConfig, sendEmailWithConfig, verifyEmailDeliveryConnection } from './emailProviderService.js';
import {
  buildPremiumEmailShell,
  buildPremiumBilingualEmailShell,
  getTenantLoginUrl,
  getTenantWorkspaceHost,
  getTenantWorkspaceUrl,
  escapeHtml,
} from './premiumEmailShell.js';

const normalizeLanguage = (language) => {
  if (language === 'ar') return 'ar';
  if (language === 'en') return 'en';
  return null;
};

const dedupeValues = (...values) => {
  const seen = new Set();
  const result = [];

  values.flat().forEach((value) => {
    const normalized = String(value || '').trim();
    if (!normalized) return;
    const key = normalized.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    result.push(normalized);
  });

  return result;
};

const stripHtml = (value) => String(value || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

const interpolateTemplate = (template, variables = {}) => String(template || '').replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, key) => {
  const value = variables?.[key];
  return value === null || value === undefined ? '' : String(value);
});

const getGlobalSettings = async () => {
  const settings = await SystemSettings.findOne({ key: 'global' });
  if (settings) return settings;
  return new SystemSettings({ key: 'global', website: {}, email: {} });
};

const tenantHasEmailAddon = (tenant) => {
  if (tenant?.subscription?.hasEmailAddon === true) return true;
  const features = Array.isArray(tenant?.subscription?.features) ? tenant.subscription.features : [];
  if (features.includes('email_automation')) return true;
  const emailApp = tenant?.settings?.installedApps?.email_suite;
  return emailApp?.isInstalled === true && emailApp?.isEnabled !== false;
};

const resolveGlobalEmailConfig = (settings) => {
  const email = settings?.email?.toObject?.() || settings?.email || {};
  const website = settings?.website?.toObject?.() || settings?.website || {};
  const smtpPort = Number(email.smtpPort || 587);

  return {
    enabled: email.enabled === true,
    provider: String(email.provider || 'smtp').trim().toLowerCase() === 'brevo' ? 'brevo' : 'smtp',
    host: String(email.smtpHost || '').trim(),
    port: Number.isFinite(smtpPort) ? smtpPort : 587,
    secure: email.smtpSecure === true,
    user: String(email.smtpUser || '').trim(),
    pass: String(email.smtpPass || '').trim(),
    brevoApiKey: String(email.brevoApiKey || '').trim(),
    fromName: String(email.fromName || website.brandName || 'Maqder ERP').trim(),
    fromEmail: String(email.fromEmail || email.smtpUser || '').trim(),
    replyTo: String(email.replyTo || website.contactEmail || '').trim(),
    templates: email.templates || {},
    brandName: String(website.brandName || 'Maqder ERP').trim(),
  };
};

const resolveTenantEmailSettings = (tenant) => tenant?.settings?.communication?.email || {};

const resolveTenantEmailConfig = ({ tenant, settings }) => {
  const globalConfig = resolveGlobalEmailConfig(settings);
  const tenantEmail = resolveTenantEmailSettings(tenant);
  const useCustomSmtp = tenantEmail.identityType === 'custom_smtp' && tenantEmail.smtpHost && tenantEmail.smtpUser && tenantEmail.smtpPass;
  const rawPort = Number(useCustomSmtp ? tenantEmail.smtpPort : globalConfig.port);
  const fromName = String(tenantEmail.senderName || tenantEmail.requestedSenderName || globalConfig.fromName || tenant?.name || 'Maqder ERP').trim();
  const fromEmail = String(useCustomSmtp
    ? (tenantEmail.fromEmail || tenantEmail.smtpUser || '')
    : (tenantEmail.fromEmail || tenantEmail.requestedSenderEmail || globalConfig.fromEmail || '')).trim();
  const replyTo = String(tenantEmail.replyTo || tenant?.business?.contactEmail || globalConfig.replyTo || '').trim();

  return {
    enabled: tenantEmail.enabled === true,
    provider: useCustomSmtp ? 'custom_smtp' : globalConfig.provider,
    host: String(useCustomSmtp ? tenantEmail.smtpHost : globalConfig.host).trim(),
    port: Number.isFinite(rawPort) ? rawPort : 587,
    secure: useCustomSmtp ? tenantEmail.smtpSecure === true : globalConfig.secure === true,
    user: String(useCustomSmtp ? tenantEmail.smtpUser : globalConfig.user).trim(),
    pass: String(useCustomSmtp ? tenantEmail.smtpPass : globalConfig.pass).trim(),
    brevoApiKey: String(useCustomSmtp ? '' : globalConfig.brevoApiKey).trim(),
    fromName,
    fromEmail,
    replyTo,
    brandName: globalConfig.brandName,
    platformProvider: String(useCustomSmtp ? '' : (tenantEmail.platformProvider || globalConfig.provider || 'platform')).trim(),
    templates: globalConfig.templates || {},
  };
};

const ensureConfigReady = (config) => {
  ensureEmailDeliveryConfig(config, { context: 'Tenant email delivery' });
};

export const verifyTenantEmailConnection = async (tenant) => {
  const settings = await SystemSettings.findOne({ key: 'global' });
  const config = resolveTenantEmailConfig({ tenant, settings });
  return verifyEmailDeliveryConnection({ ...config, enabled: true });
};

export const buildEmailShell = (options = {}) => buildPremiumEmailShell(options);

const buildBilingualEmailShell = (options = {}) => buildPremiumBilingualEmailShell(options);

const buildInvoiceVariables = ({ tenant, invoice, customerName, language, brandName }) => {
  const tenantSlug = String(tenant?.slug || '').trim().toLowerCase();
  const loginUrl = getTenantLoginUrl(tenant);
  const workspaceUrl = getTenantWorkspaceUrl(tenant);
  const workspaceHost = getTenantWorkspaceHost(tenant);
  return {
    brandName: String(brandName || 'Maqder ERP').trim(),
    companyName: language === 'ar'
      ? String(tenant?.business?.legalNameAr || tenant?.business?.legalNameEn || tenant?.name || brandName || 'Maqder ERP').trim()
      : String(tenant?.business?.legalNameEn || tenant?.business?.legalNameAr || tenant?.name || brandName || 'Maqder ERP').trim(),
    customerName: String(customerName || invoice?.buyer?.name || invoice?.buyer?.nameAr || 'Customer').trim(),
    invoiceNumber: String(invoice?.invoiceNumber || '').trim(),
    invoiceDate: invoice?.issueDate ? new Date(invoice.issueDate).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-GB') : '',
    invoiceTotal: `${Number(invoice?.grandTotal || 0).toFixed(2)} ${String(invoice?.currency || 'SAR').trim() || 'SAR'}`,
    invoiceStatus: String(invoice?.status || '').trim(),
    transactionType: String(invoice?.transactionType || '').trim(),
    tenantSlug,
    loginUrl,
    workspaceUrl,
    workspaceHost,
  };
};

const buildInvoiceSecondaryLines = (variables, language) => [
  { label: language === 'ar' ? 'رقم الفاتورة' : 'Invoice', value: variables.invoiceNumber },
  { label: language === 'ar' ? 'التاريخ' : 'Date', value: variables.invoiceDate },
  { label: language === 'ar' ? 'الإجمالي' : 'Total', value: variables.invoiceTotal },
  variables.workspaceHost
    ? { label: language === 'ar' ? 'مساحة العمل' : 'Workspace', value: variables.workspaceHost, href: variables.loginUrl }
    : null,
].filter((row) => row?.value);

const buildInvoiceMessage = ({ tenant, invoice, customerName, language, globalSettings }) => {
  const tenantEmail = resolveTenantEmailSettings(tenant);
  const templates = resolveGlobalEmailConfig(globalSettings).templates || {};
  const normalizedLanguage = normalizeLanguage(language);
  const brandName = resolveGlobalEmailConfig(globalSettings).brandName;
  const workspaceUrl = getTenantWorkspaceUrl(tenant);
  const workspaceHost = getTenantWorkspaceHost(tenant);
  const loginUrl = getTenantLoginUrl(tenant);

  const buildSingle = (targetLanguage) => {
    const variables = buildInvoiceVariables({ tenant, invoice, customerName, language: targetLanguage, brandName });
    const subjectTemplate = (targetLanguage === 'ar'
      ? String(tenantEmail.subjectAr || '').trim()
      : String(tenantEmail.subjectEn || '').trim()) || String(templates?.invoice?.[targetLanguage === 'ar' ? 'subjectAr' : 'subjectEn'] || '').trim() || 'Invoice {{invoiceNumber}}';
    const bodyTemplate = (targetLanguage === 'ar'
      ? String(tenantEmail.bodyAr || '').trim()
      : String(tenantEmail.bodyEn || '').trim()) || String(templates?.invoice?.[targetLanguage === 'ar' ? 'bodyAr' : 'bodyEn'] || '').trim() || 'Please find your invoice attached.';
    const signature = interpolateTemplate(targetLanguage === 'ar' ? String(tenantEmail.signatureAr || '').trim() : String(tenantEmail.signatureEn || '').trim(), variables);
    const body = [interpolateTemplate(bodyTemplate, variables), signature].filter(Boolean).join('\n\n');
    const subject = interpolateTemplate(subjectTemplate, variables);
    return {
      subject,
      body,
      variables,
      language: targetLanguage,
      html: buildEmailShell({
        brandName: tenantEmail.senderName || variables.companyName || brandName,
        title: subject,
        body,
        secondaryLines: buildInvoiceSecondaryLines(variables, targetLanguage),
        dir: targetLanguage === 'ar' ? 'rtl' : 'ltr',
        workspaceUrl,
        workspaceHost,
        cta: { href: loginUrl, label: targetLanguage === 'ar' ? 'فتح مساحة العمل' : 'Open workspace' },
      }),
    };
  };

  if (normalizedLanguage) {
    const localized = buildSingle(normalizedLanguage);
    return {
      subject: localized.subject,
      html: localized.html,
      text: stripHtml(localized.body),
      language: normalizedLanguage,
    };
  }

  const english = buildSingle('en');
  const arabic = buildSingle('ar');
  return {
    subject: dedupeValues(english.subject, arabic.subject).join(' | ') || english.subject,
    html: buildBilingualEmailShell({
      brandName: tenantEmail.senderName || brandName,
      title: dedupeValues(english.subject, arabic.subject).join(' | ') || english.subject,
      workspaceUrl,
      workspaceHost,
      cta: { href: loginUrl, label: 'Open workspace' },
      sections: [
        { title: english.subject, body: english.body, secondaryLines: buildInvoiceSecondaryLines(english.variables, 'en'), dir: 'ltr' },
        { title: arabic.subject, body: arabic.body, secondaryLines: buildInvoiceSecondaryLines(arabic.variables, 'ar'), dir: 'rtl' },
      ],
    }),
    text: [english.body, arabic.body].filter(Boolean).join('\n\n'),
    language: 'bilingual',
  };
};

const normalizeAttachmentInput = (attachment = {}) => {
  const rawContent = attachment.content;
  const bufferContent = Buffer.isBuffer(rawContent)
    ? rawContent
    : (rawContent instanceof Uint8Array ? Buffer.from(rawContent) : null);
  const base64 = String(attachment.contentBase64 || attachment.base64 || '').trim() || (bufferContent ? bufferContent.toString('base64') : '');
  return {
    filename: String(attachment.filename || attachment.name || 'attachment').trim(),
    content: bufferContent || (base64 ? Buffer.from(base64, 'base64') : undefined),
    contentType: String(attachment.contentType || attachment.type || 'application/octet-stream').trim(),
    size: Number(attachment.size || bufferContent?.length || 0),
    contentBase64: base64,
    url: String(attachment.url || '').trim(),
    contentId: String(attachment.contentId || '').trim(),
  };
};

const mapAttachmentsForTransport = (attachments = []) => attachments
  .map(normalizeAttachmentInput)
  .filter((attachment) => attachment.filename)
  .map((attachment) => ({
    filename: attachment.filename,
    content: attachment.content,
    contentType: attachment.contentType,
    cid: attachment.contentId || undefined,
    path: !attachment.content && attachment.url ? attachment.url : undefined,
  }));

const mapAttachmentsForStorage = (attachments = []) => attachments
  .map(normalizeAttachmentInput)
  .filter((attachment) => attachment.filename)
  .map((attachment) => ({
    name: attachment.filename,
    url: attachment.url,
    type: attachment.contentType,
    size: attachment.size || (attachment.content ? attachment.content.length : 0),
    contentId: attachment.contentId,
    contentBase64: attachment.contentBase64,
  }));

export const serializeTenantEmailSettings = (tenant) => {
  const email = resolveTenantEmailSettings(tenant);
  return {
    ...email,
    smtpPass: '',
    hasSmtpPass: Boolean(email?.smtpPass),
    smtpPassMasked: email?.smtpPass ? `${String(email.smtpPass).slice(0, 2)}***${String(email.smtpPass).slice(-2)}` : '',
  };
};

export const listEmailMessages = async ({ tenantId, folder = 'inbox', search = '', page = 1, limit = 20 }) => {
  const pageNumber = Math.max(1, Number(page) || 1);
  const limitNumber = Math.min(100, Math.max(1, Number(limit) || 20));
  const normalizedFolder = ['all', 'inbox', 'sent', 'draft'].includes(String(folder || '').trim().toLowerCase())
    ? String(folder || '').trim().toLowerCase()
    : 'inbox';
  const query = {
    tenantId,
    ...(normalizedFolder === 'all' ? {} : { type: normalizedFolder }),
  };

  if (search) {
    query.$or = [
      { subject: { $regex: search, $options: 'i' } },
      { from: { $regex: search, $options: 'i' } },
      { to: { $regex: search, $options: 'i' } },
      { previewText: { $regex: search, $options: 'i' } },
    ];
  }

  const [messages, total, counts] = await Promise.all([
    EmailMessage.find(query)
      .select('from to cc subject previewText isRead type direction status createdAt updatedAt delivery.sentAt delivery.receivedAt relatedInvoiceId attachments.name attachments.type attachments.size metadata')
      .sort({ createdAt: -1 })
      .skip((pageNumber - 1) * limitNumber)
      .limit(limitNumber)
      .lean(),
    EmailMessage.countDocuments(query),
    EmailMessage.aggregate([
      { $match: { tenantId } },
      { $group: { _id: '$type', count: { $sum: 1 }, unread: { $sum: { $cond: [{ $eq: ['$isRead', false] }, 1, 0] } } } },
    ]),
  ]);

  return {
    messages,
    pagination: {
      page: pageNumber,
      limit: limitNumber,
      total,
      pages: Math.max(1, Math.ceil(total / limitNumber)),
    },
    counts: counts.reduce((acc, item) => {
      acc[item._id] = { count: item.count, unread: item.unread };
      acc.all.count += item.count || 0;
      acc.all.unread += item.unread || 0;
      return acc;
    }, { all: { count: 0, unread: 0 }, inbox: { count: 0, unread: 0 }, sent: { count: 0, unread: 0 }, draft: { count: 0, unread: 0 } }),
  };
};

export const createDraftMessage = async ({ tenantId, payload = {} }) => {
  return await EmailMessage.create({
    tenantId,
    to: dedupeValues(payload.to),
    cc: dedupeValues(payload.cc),
    bcc: dedupeValues(payload.bcc),
    from: String(payload.from || '').trim(),
    subject: String(payload.subject || '').trim(),
    bodyHtml: String(payload.bodyHtml || '').trim(),
    bodyText: String(payload.bodyText || stripHtml(payload.bodyHtml || '')).trim(),
    type: 'draft',
    direction: 'outgoing',
    status: 'draft',
    attachments: mapAttachmentsForStorage(payload.attachments || []),
    metadata: payload.metadata || {},
  });
};

export const sendTenantEmail = async ({ tenant, to, cc, bcc, subject, html, text, attachments = [], relatedInvoiceId = null, metadata = {} }) => {
  const settings = await getGlobalSettings();
  const config = resolveTenantEmailConfig({ tenant, settings });
  ensureConfigReady(config);

  const recipients = dedupeValues(to);
  if (recipients.length === 0) {
    throw new Error('Email recipient is required');
  }

  const mailOptions = {
    subject: String(subject || '').trim(),
    html: String(html || '').trim(),
    text: String(text || stripHtml(html || '')).trim() || undefined,
  };

  try {
    const result = await sendEmailWithConfig({
      config,
      to: recipients,
      cc: dedupeValues(cc),
      bcc: dedupeValues(bcc),
      replyTo: config.replyTo || undefined,
      subject: mailOptions.subject,
      html: mailOptions.html,
      text: mailOptions.text,
      attachments: mapAttachmentsForTransport(attachments),
    });
    const stored = await EmailMessage.create({
      tenantId: tenant._id,
      relatedInvoiceId,
      messageId: String(result?.providerMessageId || '').trim(),
      to: recipients,
      cc: dedupeValues(cc),
      bcc: dedupeValues(bcc),
      from: config.fromEmail,
      subject: mailOptions.subject,
      bodyHtml: mailOptions.html,
      bodyText: mailOptions.text || '',
      type: 'sent',
      direction: 'outgoing',
      status: 'sent',
      attachments: mapAttachmentsForStorage(attachments),
      delivery: {
        provider: config.provider,
        providerMessageId: String(result?.providerMessageId || '').trim(),
        sentAt: new Date(),
      },
      metadata,
    });

    return { sent: true, message: stored, providerMessageId: result?.providerMessageId || '' };
  } catch (error) {
    await EmailMessage.create({
      tenantId: tenant._id,
      relatedInvoiceId,
      to: recipients,
      cc: dedupeValues(cc),
      bcc: dedupeValues(bcc),
      from: config.fromEmail || config.user || '',
      subject: mailOptions.subject,
      bodyHtml: mailOptions.html,
      bodyText: mailOptions.text || '',
      type: 'sent',
      direction: 'outgoing',
      status: 'failed',
      attachments: mapAttachmentsForStorage(attachments),
      delivery: {
        provider: config.provider,
        error: error.message,
      },
      metadata,
    });
    throw error;
  }
};

const resolveInvoiceRecipient = (customer, invoice, fallbackRecipient = '') => {
  const directRecipient = String(fallbackRecipient || '').trim().toLowerCase();
  if (directRecipient) return directRecipient;
  const customerEmail = String(customer?.email || '').trim().toLowerCase();
  if (customerEmail) return customerEmail;
  const contactEmail = String(customer?.contactPerson?.email || '').trim().toLowerCase();
  if (contactEmail) return contactEmail;
  return String(invoice?.buyer?.contactEmail || '').trim().toLowerCase();
};

export const sendInvoiceToRecipient = async ({ tenant, invoice, recipient, customerName, language, purpose = 'manual_invoice', attachment = null }) => {
  const settings = await getGlobalSettings();
  const message = buildInvoiceMessage({ tenant, invoice, customerName, language: 'bilingual', globalSettings: settings });
  const invoiceAttachment = attachment && (attachment.content || attachment.contentBase64 || attachment.base64 || attachment.url)
    ? {
        filename: String(attachment.filename || `${String(invoice?.invoiceNumber || 'invoice').trim() || 'invoice'}.pdf`).trim(),
        content: attachment.content,
        contentBase64: String(attachment.contentBase64 || attachment.base64 || '').trim(),
        contentType: String(attachment.contentType || attachment.type || 'application/pdf').trim() || 'application/pdf',
        size: Number(attachment.size || 0),
        url: String(attachment.url || '').trim(),
      }
    : await getOrBuildInvoicePdfAttachment({ invoice, tenant, customerName, language: 'bilingual' });

  return await sendTenantEmail({
    tenant,
    to: recipient,
    subject: message.subject,
    html: message.html,
    text: message.text,
    attachments: [invoiceAttachment],
    relatedInvoiceId: invoice._id,
    metadata: { purpose, invoiceNumber: invoice.invoiceNumber, language: message.language },
  });
};

/**
 * Send an order confirmation email when a new order is placed on the storefront.
 */
export const sendOrderConfirmationEmail = async ({ tenant, order }) => {
  if (!order?.customer?.email) return { skipped: true, reason: 'no customer email' };
  const storeName = tenant.ecommerce?.storeName || tenant.name || 'Store';
  const orderNumber = order.orderNumber;
  const customerName = order.customer.name || 'Customer';

  const itemsHtml = (order.lineItems || []).map(item => `
    <tr>
      <td style="padding: 8px 0; border-bottom: 1px solid #f3f4f6; font-size: 14px; color: #374151;">${item.productTitle}${item.variantLabel ? ` (${item.variantLabel})` : ''}</td>
      <td style="padding: 8px 0; border-bottom: 1px solid #f3f4f6; font-size: 14px; color: #6b7280; text-align: center;">${item.quantity}</td>
      <td style="padding: 8px 0; border-bottom: 1px solid #f3f4f6; font-size: 14px; font-weight: bold; text-align: right;">${item.lineTotal} ${order.currency || 'SAR'}</td>
    </tr>
  `).join('');

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: #4f46e5; padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="color: #fff; margin: 0; font-size: 22px;">${storeName}</h1>
      </div>
      <div style="background: #f9fafb; padding: 32px; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb;">
        <h2 style="color: #111; margin: 0 0 8px;">Thank you for your order!</h2>
        <p style="color: #6b7280; margin: 0 0 16px;">Hi ${customerName}, we've received your order and will process it shortly.</p>

        <div style="background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <p style="margin: 0 0 8px;"><strong>Order Number:</strong> ${orderNumber}</p>
          <p style="margin: 0 0 8px;"><strong>Payment Method:</strong> ${order.payment?.method?.toUpperCase() || 'COD'}</p>
          <p style="margin: 0;"><strong>Shipping Address:</strong> ${order.customer?.addressLine1 || ''}${order.customer?.city ? ', ' + order.customer.city : ''}${order.customer?.phone ? ' · ' + order.customer.phone : ''}</p>
        </div>

        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
          <thead>
            <tr style="border-bottom: 2px solid #e5e7eb;">
              <th style="padding: 8px 0; text-align: left; font-size: 12px; color: #9ca3af; text-transform: uppercase;">Item</th>
              <th style="padding: 8px 0; text-align: center; font-size: 12px; color: #9ca3af; text-transform: uppercase;">Qty</th>
              <th style="padding: 8px 0; text-align: right; font-size: 12px; color: #9ca3af; text-transform: uppercase;">Total</th>
            </tr>
          </thead>
          <tbody>${itemsHtml}</tbody>
        </table>

        <div style="text-align: right; margin-top: 12px;">
          ${order.shippingCost > 0 ? `<p style="margin: 4px 0; font-size: 14px; color: #6b7280;">Shipping: ${order.shippingCost} ${order.currency || 'SAR'}</p>` : ''}
          <p style="margin: 8px 0 0; font-size: 20px; font-weight: bold; color: #059669;">Total: ${order.grandTotal} ${order.currency || 'SAR'}</p>
        </div>

        <p style="color: #9ca3af; font-size: 12px; margin: 24px 0 0; text-align: center;">You can track your order anytime using your order number and phone number.</p>
      </div>
    </div>
  `;

  return await sendTenantEmail({
    tenant,
    to: order.customer.email,
    subject: `Order Confirmation — ${orderNumber}`,
    html,
    text: `Thank you for your order! Order ${orderNumber} — Total: ${order.grandTotal} ${order.currency || 'SAR'}`,
    metadata: { type: 'order_confirmation', orderId: order._id?.toString() },
  });
};

/**
 * Send an ecommerce order status notification email to the customer.
 */
export const sendOrderStatusEmail = async ({ tenant, order, status, note = '' }) => {
  if (!order?.customer?.email) return { skipped: true, reason: 'no customer email' };
  const storeName = tenant.ecommerce?.storeName || tenant.name || 'Store';
  const orderNumber = order.orderNumber;
  const customerName = order.customer.name || 'Customer';

  const statusMessages = {
    confirmed: { subject: `Order ${orderNumber} Confirmed`, title: 'Your order has been confirmed!', desc: "We're preparing your items for shipment." },
    processing: { subject: `Order ${orderNumber} — Being Processed`, title: 'Your order is being processed', desc: "We're getting your items ready to ship." },
    shipped: { subject: `Order ${orderNumber} — Shipped!`, title: 'Your order has been shipped!', desc: `Tracking: ${order.shipping?.trackingNumber || 'Available soon'}` },
    delivered: { subject: `Order ${orderNumber} — Delivered`, title: 'Your order has been delivered!', desc: 'Thank you for shopping with us!' },
    completed: { subject: `Order ${orderNumber} — Complete`, title: 'Your order is complete', desc: 'Thank you for your purchase!' },
    cancelled: { subject: `Order ${orderNumber} — Cancelled`, title: 'Your order has been cancelled', desc: note || 'Please contact us if you have questions.' },
    returned: { subject: `Order ${orderNumber} — Return Processed`, title: 'Your return has been processed', desc: 'Your refund will be processed shortly.' },
  };

  const msg = statusMessages[status] || { subject: `Order ${orderNumber} — Update`, title: 'Order update', desc: note || '' };

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: #4f46e5; padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="color: #fff; margin: 0; font-size: 22px;">${storeName}</h1>
      </div>
      <div style="background: #f9fafb; padding: 32px; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb;">
        <h2 style="color: #111; margin: 0 0 8px;">${msg.title}</h2>
        <p style="color: #6b7280; margin: 0 0 16px;">${msg.desc}</p>
        <div style="background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <p style="margin: 0 0 8px;"><strong>Order:</strong> ${orderNumber}</p>
          <p style="margin: 0 0 8px;"><strong>Customer:</strong> ${customerName}</p>
          <p style="margin: 0;"><strong>Total:</strong> ${order.grandTotal} ${order.currency || 'SAR'}</p>
        </div>
        ${note ? `<p style="color: #4b5563; font-size: 14px; margin: 16px 0;"><strong>Note:</strong> ${note}</p>` : ''}
        <p style="color: #9ca3af; font-size: 12px; margin: 24px 0 0; text-align: center;">This is an automated message from ${storeName}.</p>
      </div>
    </div>
  `;

  return await sendTenantEmail({
    tenant,
    to: order.customer.email,
    subject: msg.subject,
    html,
    text: `${msg.title} — ${msg.desc} (Order: ${orderNumber})`,
    metadata: { type: 'order_status', orderId: order._id?.toString(), status },
  });
};

export const autoSendInvoice = async (invoiceId, tenantId, options = {}) => {
  try {
    const [tenant, invoice] = await Promise.all([
      Tenant.findById(tenantId),
      Invoice.findOne({ _id: invoiceId, tenantId }),
    ]);

    if (!tenant || !invoice) {
      return { sent: false, reason: 'not_found' };
    }

    if (!tenantHasEmailAddon(tenant)) {
      return { sent: false, reason: 'addon_disabled' };
    }

    const tenantEmail = resolveTenantEmailSettings(tenant);
    if (!tenantEmail.enabled || !tenantEmail.autoSendInvoices || invoice.flow === 'purchase') {
      return { sent: false, reason: 'disabled' };
    }

    if (!(invoice.status === 'approved' || invoice.zatca?.signedXml)) {
      return { sent: false, reason: 'not_ready' };
    }

    const existing = await EmailMessage.findOne({
      tenantId,
      relatedInvoiceId: invoice._id,
      type: 'sent',
      status: 'sent',
      'metadata.purpose': 'auto_invoice',
    });
    if (existing) {
      return { sent: false, reason: 'already_sent', messageId: existing._id };
    }

    const customer = invoice.customerId
      ? await Customer.findOne({ _id: invoice.customerId, tenantId }).select('name nameAr email contactPerson')
      : null;
    const recipient = resolveInvoiceRecipient(customer, invoice, options.recipient);
    if (!recipient) {
      return { sent: false, reason: 'missing_recipient' };
    }

    const delivery = await sendInvoiceToRecipient({
      tenant,
      invoice,
      recipient,
      customerName: customer?.name || customer?.nameAr || invoice?.buyer?.name || invoice?.buyer?.nameAr,
      language: options.language || tenant?.settings?.language,
      purpose: 'auto_invoice',
    });

    return { sent: true, delivery };
  } catch (error) {
    logger.error(`Failed to auto-send invoice email: ${error.message}`);
    return { sent: false, reason: 'send_failed', error: error.message };
  }
};

const collectRecipientCandidates = (payload = {}) => dedupeValues(
  payload.to,
  payload.recipient,
  payload.recipients,
  payload.envelope?.to,
  payload.headers?.to,
  payload.To,
  payload.cc,
  payload.Cc,
  payload.deliveredTo,
  payload.delivered_to,
);

const normalizeAddressList = (value) => dedupeValues(String(value || '').split(/[;,]+/).map((item) => item.trim()));

const resolveInboundTenant = async (payload = {}) => {
  const explicitTenantId = String(payload.tenantId || '').trim();
  if (explicitTenantId) {
    const tenant = await Tenant.findById(explicitTenantId);
    if (tenant) return tenant;
  }

  const explicitTenantSlug = String(payload.tenantSlug || payload.tenant_slug || '').trim().toLowerCase();
  if (explicitTenantSlug) {
    const tenant = await Tenant.findOne({ slug: explicitTenantSlug });
    if (tenant) return tenant;
  }

  const candidates = collectRecipientCandidates(payload).flatMap((entry) => normalizeAddressList(entry));
  if (candidates.length === 0) return null;

  return await Tenant.findOne({ 'settings.communication.email.inboundAddress': { $in: candidates.map((item) => item.toLowerCase()) } });
};

const extractInboundAttachments = (payload = {}) => {
  const attachments = Array.isArray(payload.attachments)
    ? payload.attachments
    : Array.isArray(payload.attachment)
      ? payload.attachment
      : [];

  return attachments.map((attachment) => ({
    name: String(attachment.filename || attachment.name || 'attachment').trim(),
    url: String(attachment.url || '').trim(),
    type: String(attachment.contentType || attachment.type || 'application/octet-stream').trim(),
    size: Number(attachment.size || 0),
    contentId: String(attachment.contentId || attachment.cid || '').trim(),
    contentBase64: String(attachment.contentBase64 || attachment.base64 || attachment.content || '').trim(),
  }));
};

export const saveInboundEmail = async (payload = {}, options = {}) => {
  const candidates = collectRecipientCandidates(payload).map(c => c.toLowerCase());

  const globalSettings = await getGlobalSettings();
  const globalEmail = globalSettings?.email || {};
  const globalAliases = [
    String(globalEmail.fromEmail || '').trim().toLowerCase(),
    String(globalEmail.salesEmail || '').trim().toLowerCase(),
    String(globalEmail.supportEmail || '').trim().toLowerCase(),
    String(globalEmail.billingEmail || '').trim().toLowerCase(),
  ].filter(Boolean);

  const isSuperAdminEmail = globalAliases.some(alias => candidates.includes(alias));

  let ownerType = 'tenant';
  let ownerId = null;

  if (isSuperAdminEmail) {
    ownerType = 'super_admin';
  } else {
    const tenant = await resolveInboundTenant(payload);
    if (!tenant) {
      return { saved: false, reason: 'tenant_not_found' };
    }
    ownerId = tenant._id;
  }

  const messageId = String(payload.messageId || payload['Message-Id'] || payload.headers?.['message-id'] || '').trim();
  if (messageId) {
    const query = ownerType === 'super_admin' ? { ownerType: 'super_admin', messageId } : { tenantId: ownerId, messageId };
    const existing = await EmailMessage.findOne(query);
    if (existing) {
      return { saved: true, duplicate: true, message: existing };
    }
  }

  const saved = await EmailMessage.create({
    ownerType,
    ...(ownerType === 'tenant' ? { tenantId: ownerId } : {}),
    messageId,
    threadId: String(payload.threadId || payload.thread_id || '').trim(),
    to: collectRecipientCandidates(payload),
    from: String(payload.from || payload.sender || payload.headers?.from || '').trim(),
    subject: String(payload.subject || '').trim(),
    bodyHtml: String(payload.html || payload.bodyHtml || payload.body || '').trim(),
    bodyText: String(payload.text || payload.bodyText || stripHtml(payload.html || payload.bodyHtml || payload.body || '')).trim(),
    isRead: false,
    type: 'inbox',
    direction: 'incoming',
    status: 'received',
    attachments: extractInboundAttachments(payload),
    delivery: {
      provider: String(options.provider || payload.provider || '').trim(),
      providerMessageId: String(payload.eventId || payload.event_id || '').trim(),
      receivedAt: new Date(),
    },
    metadata: payload,
  });

  return { saved: true, [ownerType === 'tenant' ? 'tenantId' : 'ownerType']: ownerType === 'tenant' ? ownerId : 'super_admin', message: saved };
};

export const sendUserWelcomeEmail = async ({ tenant, user, temporaryPassword, language = 'en' }) => {
  if (!tenant || !user?.email) {
    throw new Error('Tenant and user email are required');
  }

  const isAr = language === 'ar';
  const loginUrl = getTenantLoginUrl(tenant);
  const workspaceHost = getTenantWorkspaceHost(tenant);
  const companyName = tenant?.business?.legalNameEn || tenant?.business?.legalNameAr || tenant?.name || 'Maqder';
  const displayName = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email;
  const roleLabel = String(user.role || 'viewer').replace(/_/g, ' ');

  const secondaryLinesEn = [
    { label: 'Email', value: user.email },
    { label: 'Role', value: roleLabel },
    temporaryPassword ? { label: 'Temporary password', value: temporaryPassword } : null,
    { label: 'Workspace', value: workspaceHost, href: loginUrl },
  ].filter(Boolean);

  const secondaryLinesAr = [
    { label: 'البريد', value: user.email },
    { label: 'الدور', value: roleLabel },
    temporaryPassword ? { label: 'كلمة المرور المؤقتة', value: temporaryPassword } : null,
    { label: 'مساحة العمل', value: workspaceHost, href: loginUrl },
  ].filter(Boolean);

  const html = buildPremiumBilingualEmailShell({
    brandName: companyName,
    title: isAr ? `مرحباً ${displayName}` : `Welcome, ${displayName}`,
    sections: [
      {
        dir: 'ltr',
        title: `Welcome to ${companyName}`,
        body: `Your account has been created. Sign in with your email and the password provided by your administrator.`,
        secondaryLines: secondaryLinesEn,
      },
      {
        dir: 'rtl',
        title: `مرحباً بك في ${companyName}`,
        body: `تم إنشاء حسابك. سجّل الدخول باستخدام بريدك الإلكتروني وكلمة المرور التي زودك بها المسؤول.`,
        secondaryLines: secondaryLinesAr,
      },
    ],
    cta: {
      href: loginUrl,
      label: isAr ? 'تسجيل الدخول' : 'Sign in to workspace',
    },
    workspaceUrl: getTenantWorkspaceUrl(tenant),
    workspaceHost,
    logoUrl: tenant?.branding?.logo || tenant?.settings?.invoiceBranding?.logo || undefined,
  });

  return sendTenantEmail({
    tenant,
    to: user.email,
    subject: isAr ? `دعوة للانضمام إلى ${companyName}` : `You are invited to ${companyName}`,
    html,
    metadata: { type: 'user_welcome', userId: String(user._id || '') },
  });
};
