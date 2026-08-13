import SystemSettings from '../models/SystemSettings.js';
import logger from './logger.js';
import { ensureEmailDeliveryConfig, sendEmailWithConfig } from './emailProviderService.js';
import { generateTermsPdf } from './termsPdf.js';
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

const dedupeRecipients = (...values) => {
  const seen = new Set();
  const result = [];

  values
    .flat()
    .map((value) => String(value || '').trim().toLowerCase())
    .filter(Boolean)
    .forEach((value) => {
      if (seen.has(value)) return;
      seen.add(value);
      result.push(value);
    });

  return result;
};

const interpolateTemplate = (template, variables = {}) => String(template || '').replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, key) => {
  const value = variables?.[key];
  return value === null || value === undefined ? '' : String(value);
});

const getGlobalSettings = async () => {
  const settings = await SystemSettings.findOne({ key: 'global' });
  if (settings) return settings;
  return new SystemSettings({ key: 'global', website: {}, email: {} });
};

const resolveEmailConfig = (settings, options = {}) => {
  const { allowEnvFallback = true } = options;
  const email = settings?.email?.toObject?.() || settings?.email || {};
  const website = settings?.website?.toObject?.() || settings?.website || {};
  const smtpPort = Number(email.smtpPort || (allowEnvFallback ? process.env.SMTP_PORT : '') || 587);
  const provider = String(email.provider || (allowEnvFallback ? process.env.EMAIL_PROVIDER : '') || 'smtp').trim().toLowerCase() === 'brevo' ? 'brevo' : 'smtp';
  const brevoApiKey = String(email.brevoApiKey || (allowEnvFallback ? process.env.BREVO_API_KEY : '') || '').trim();
  const hasProviderCredentials = provider === 'brevo'
    ? Boolean(brevoApiKey)
    : Boolean(
        String(email.smtpHost || (allowEnvFallback ? process.env.SMTP_HOST : '') || '').trim()
        && String(email.smtpUser || (allowEnvFallback ? process.env.SMTP_USER : '') || '').trim()
        && String(email.smtpPass || (allowEnvFallback ? process.env.SMTP_PASS : '') || '').trim()
      );

  return {
    enabled: email.enabled === true || (allowEnvFallback && hasProviderCredentials),
    provider,
    host: String(email.smtpHost || (allowEnvFallback ? process.env.SMTP_HOST : '') || '').trim(),
    port: Number.isFinite(smtpPort) ? smtpPort : 587,
    secure: email.smtpSecure === true,
    user: String(email.smtpUser || (allowEnvFallback ? process.env.SMTP_USER : '') || '').trim(),
    pass: String(email.smtpPass || (allowEnvFallback ? process.env.SMTP_PASS : '') || '').trim(),
    brevoApiKey,
    fromName: String(email.fromName || website.brandName || 'Maqder ERP').trim(),
    fromEmail: String(email.fromEmail || email.smtpUser || (allowEnvFallback ? process.env.SMTP_USER : '') || '').trim(),
    replyTo: String(email.replyTo || website.contactEmail || '').trim(),
    templates: email.templates || {},
    brandName: String(website.brandName || 'Maqder ERP').trim(),
    website,
  };
};

const ensureEmailConfigured = (config) => {
  ensureEmailDeliveryConfig(config, { context: 'Email delivery' });
};

const buildEmailShell = (options = {}) => buildPremiumEmailShell(options);

const buildBilingualEmailShell = (options = {}) => buildPremiumBilingualEmailShell(options);

const buildCredentialRowsHtml = (rows = []) => {
  const items = rows.filter((row) => row?.label && row?.value);
  if (items.length === 0) return '';
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:22px 0;border-collapse:collapse;">
    ${items.map((row, index) => `
      <tr>
        <td style="padding:${index === 0 ? '0' : '14px'} 0 14px;border-top:${index === 0 ? '0' : '1px solid #eceff3'};vertical-align:top;">
          <div style="font-size:11px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:#94a3b8;margin:0 0 4px;">${escapeHtml(row.label)}</div>
          <div style="font-size:15px;font-weight:600;color:#0f172a;line-height:1.5;word-break:break-word;">
            ${row.href
              ? `<a href="${escapeHtml(row.href)}" style="color:#0f766e;text-decoration:none;">${escapeHtml(row.value)}</a>`
              : escapeHtml(row.value)}
          </div>
        </td>
      </tr>`).join('')}
  </table>`;
};

const pickLocalizedValue = (source, language, fieldBase) => {
  const normalized = normalizeLanguage(language);
  if (normalized === 'ar') return String(source?.[`${fieldBase}Ar`] || '').trim();
  return String(source?.[`${fieldBase}En`] || '').trim();
};

const uniqueValues = (...values) => {
  const seen = new Set();
  const result = [];

  values
    .flat()
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .forEach((value) => {
      const key = value.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      result.push(value);
    });

  return result;
};

const resolveLocalizedContactName = (adminUser, tenant, language) => {
  if (language === 'ar') {
    const fullNameAr = `${String(adminUser?.firstNameAr || '').trim()} ${String(adminUser?.lastNameAr || '').trim()}`.trim();
    if (fullNameAr) return fullNameAr;
  }

  const fullNameEn = `${String(adminUser?.firstName || '').trim()} ${String(adminUser?.lastName || '').trim()}`.trim();
  if (fullNameEn) return fullNameEn;

  if (language === 'ar') {
    return String(tenant?.business?.legalNameAr || tenant?.name || 'العميل').trim();
  }

  return String(tenant?.business?.legalNameEn || tenant?.name || 'Customer').trim();
};

const buildTenantWelcomeVariables = ({ tenant, adminUser, brandName, language }) => ({
  brandName: String(brandName || 'Maqder ERP').trim(),
  companyName: language === 'ar'
    ? String(tenant?.business?.legalNameAr || tenant?.business?.legalNameEn || tenant?.name || brandName || 'Maqder ERP').trim()
    : String(tenant?.business?.legalNameEn || tenant?.business?.legalNameAr || tenant?.name || brandName || 'Maqder ERP').trim(),
  contactName: resolveLocalizedContactName(adminUser, tenant, language),
  loginEmail: String(adminUser?.email || tenant?.business?.contactEmail || '').trim(),
  tenantSlug: String(tenant?.slug || '').trim().toLowerCase(),
  loginUrl: getTenantLoginUrl(tenant),
  workspaceUrl: getTenantWorkspaceUrl(tenant),
  workspaceHost: getTenantWorkspaceHost(tenant),
});

const buildTenantWelcomeSecondaryLines = (variables, language) => [
  variables.loginEmail ? { label: language === 'ar' ? 'البريد للدخول' : 'Login email', value: variables.loginEmail } : null,
  variables.workspaceHost ? { label: language === 'ar' ? 'مساحة العمل' : 'Workspace', value: variables.workspaceHost, href: variables.loginUrl } : null,
].filter(Boolean);

const buildLocalizedTenantWelcomeMessage = ({ template, brandName, tenant, adminUser, language }) => {
  const normalizedLanguage = normalizeLanguage(language) || 'en';
  const variables = buildTenantWelcomeVariables({ tenant, adminUser, brandName, language: normalizedLanguage });
  const subjectTemplate = pickLocalizedValue(template, normalizedLanguage, 'subject')
    || (normalizedLanguage === 'ar' ? 'مرحباً بك في {{brandName}}' : 'Welcome to {{brandName}}');
  const bodyTemplate = pickLocalizedValue(template, normalizedLanguage, 'body')
    || (normalizedLanguage === 'ar' ? 'لوحتك جاهزة.' : 'Your panel is ready.');
  const subject = interpolateTemplate(subjectTemplate, variables);
  const body = interpolateTemplate(bodyTemplate, variables);

  return {
    subject,
    html: buildEmailShell({
      brandName: variables.brandName,
      title: subject,
      body,
      secondaryLines: buildTenantWelcomeSecondaryLines(variables, normalizedLanguage),
      dir: normalizedLanguage === 'ar' ? 'rtl' : 'ltr',
      workspaceUrl: variables.workspaceUrl,
      workspaceHost: variables.workspaceHost,
      cta: { href: variables.loginUrl, label: normalizedLanguage === 'ar' ? 'فتح مساحة العمل' : 'Open your workspace' },
    }),
    language: normalizedLanguage,
  };
};

const buildBilingualTenantWelcomeMessage = ({ template, brandName, tenant, adminUser }) => {
  const english = buildLocalizedTenantWelcomeMessage({ template, brandName, tenant, adminUser, language: 'en' });
  const arabic = buildLocalizedTenantWelcomeMessage({ template, brandName, tenant, adminUser, language: 'ar' });
  const subject = uniqueValues(english.subject, arabic.subject).join(' | ') || brandName;

  return {
    subject,
    html: buildBilingualEmailShell({
      brandName,
      title: subject,
      workspaceUrl: getTenantWorkspaceUrl(tenant),
      workspaceHost: getTenantWorkspaceHost(tenant),
      cta: { href: getTenantLoginUrl(tenant), label: 'Open your workspace' },
      sections: [
        {
          title: english.subject,
          body: interpolateTemplate(pickLocalizedValue(template, 'en', 'body') || 'Your panel is ready.', buildTenantWelcomeVariables({ tenant, adminUser, brandName, language: 'en' })),
          secondaryLines: buildTenantWelcomeSecondaryLines(buildTenantWelcomeVariables({ tenant, adminUser, brandName, language: 'en' }), 'en'),
          dir: 'ltr',
        },
        {
          title: arabic.subject,
          body: interpolateTemplate(pickLocalizedValue(template, 'ar', 'body') || 'لوحتك جاهزة.', buildTenantWelcomeVariables({ tenant, adminUser, brandName, language: 'ar' })),
          secondaryLines: buildTenantWelcomeSecondaryLines(buildTenantWelcomeVariables({ tenant, adminUser, brandName, language: 'ar' }), 'ar'),
          dir: 'rtl',
        },
      ],
    }),
    language: 'bilingual',
  };
};

const formatInvoiceTotal = (invoice) => {
  const amount = Number(invoice?.grandTotal || 0);
  const currency = String(invoice?.currency || 'SAR').trim() || 'SAR';
  if (!Number.isFinite(amount)) return `0.00 ${currency}`;
  return `${amount.toFixed(2)} ${currency}`;
};

const formatInvoiceDate = (invoice, language) => {
  const value = invoice?.issueDate ? new Date(invoice.issueDate) : new Date();
  const locale = normalizeLanguage(language) === 'ar' ? 'ar-SA' : 'en-GB';
  return Number.isNaN(value.getTime()) ? '' : value.toLocaleDateString(locale);
};

export const hasEmailAutomationAddon = (tenant) => {
  if (tenant?.subscription?.hasEmailAddon === true) return true;
  const features = Array.isArray(tenant?.subscription?.features) ? tenant.subscription.features : [];
  if (features.includes('email_automation')) return true;
  const emailApp = tenant?.settings?.installedApps?.email_suite;
  return emailApp?.isInstalled === true && emailApp?.isEnabled !== false;
};

export const sendEmailMessage = async ({ to, subject, html, replyTo, config: providedConfig }) => {
  const settings = providedConfig ? null : await getGlobalSettings();
  const config = providedConfig || resolveEmailConfig(settings);
  ensureEmailConfigured(config);

  const recipients = dedupeRecipients(to);
  if (recipients.length === 0) {
    throw new Error('Email recipient is required');
  }

  const delivery = await sendEmailWithConfig({
    config,
    to: recipients,
    subject,
    html,
    replyTo: String(replyTo || config.replyTo || '').trim() || undefined,
  });

  return { to: recipients, from: config.fromEmail, provider: delivery.provider, providerMessageId: delivery.providerMessageId };
};

export const sendTenantOnboardingEmail = async ({ tenant, adminUser, rawPassword, personalEmail, billingCleared } = {}) => {
  try {
    const settings = await getGlobalSettings();
    const config = resolveEmailConfig(settings, { allowEnvFallback: false });

    if (!config.enabled) {
      return { sent: false, reason: 'email_disabled' };
    }

    ensureEmailConfigured(config);

    const recipients = dedupeRecipients(personalEmail, tenant?.business?.contactEmail || '', adminUser?.email || '');
    if (recipients.length === 0) {
      return { sent: false, reason: 'missing_recipient' };
    }

    const brandName = config.brandName;
    const loginUrl = getTenantLoginUrl(tenant);
    const subject = `Welcome to ${brandName} — your workspace is ready`;
    const firstName = escapeHtml(adminUser?.firstName || 'there');

    const htmlBody = `
      <p style="margin:0 0 14px;">Hello ${firstName},</p>
      <p style="margin:0 0 14px;">Welcome to <strong>${escapeHtml(brandName)}</strong>. Your account is live and ready to use.</p>
      ${buildCredentialRowsHtml([
        { label: 'Login URL', value: loginUrl, href: loginUrl },
        { label: 'Email', value: adminUser?.email || '' },
        { label: 'Password', value: rawPassword || '' },
      ])}
      ${billingCleared ? '<p style="margin:0 0 14px;padding:12px 14px;border-radius:14px;background:#ecfdf5;border:1px solid #a7f3d0;color:#047857;font-weight:700;">Billing has been cleared successfully.</p>' : ''}
      <p style="margin:0;">Need help? Just reply to this email — our team is here for you.</p>
    `;

    const fullHtml = buildEmailShell({
      brandName,
      title: subject,
      htmlBody,
      cta: { href: loginUrl, label: 'Open your workspace' },
      workspaceUrl: getTenantWorkspaceUrl(tenant),
      workspaceHost: getTenantWorkspaceHost(tenant),
      dir: 'ltr',
    });

    let attachments = [];
    if (billingCleared) {
      const pdfBuffer = await generateTermsPdf({ tenantName: tenant.name, billingCleared: true });
      attachments.push({
        filename: 'Terms_and_Conditions.pdf',
        content: pdfBuffer,
        contentType: 'application/pdf'
      });
    }

    await sendEmailWithConfig({
      config,
      to: recipients,
      subject,
      html: fullHtml,
      replyTo: config.replyTo,
      attachments
    });

    return { sent: true, to: recipients };
  } catch (error) {
    logger.error(`Failed to send tenant onboarding email: ${error.message}`);
    return { sent: false, reason: 'send_failed', error: error.message };
  }
};

export const sendTenantWelcomeEmail = async ({ tenant, adminUser } = {}) => {
  try {
    const settings = await getGlobalSettings();
    const config = resolveEmailConfig(settings, { allowEnvFallback: false });

    if (!config.enabled) {
      return { sent: false, reason: 'email_disabled' };
    }

    ensureEmailConfigured(config);

    const recipients = dedupeRecipients(tenant?.business?.contactEmail || '', adminUser?.email || '');
    if (recipients.length === 0) {
      return { sent: false, reason: 'missing_recipient' };
    }

    const template = config.templates?.tenantCreated || {};
    const message = buildLocalizedTenantWelcomeMessage({
      template,
      brandName: config.brandName,
      tenant,
      adminUser,
      language: 'en',
    });

    await sendEmailMessage({
      to: recipients,
      subject: message.subject,
      html: message.html,
      replyTo: config.replyTo,
      config,
    });

    return { sent: true, to: recipients, language: 'en' };
  } catch (error) {
    logger.error(`Failed to send tenant welcome email: ${error.message}`);
    return { sent: false, reason: 'send_failed', error: error.message };
  }
};

export const sendPaymentFailedEmail = async ({ tenant, tenantId, email, plan, reason } = {}) => {
  try {
    const settings = await getGlobalSettings();
    const config = resolveEmailConfig(settings, { allowEnvFallback: false });
    if (!config.enabled) {
      return { sent: false, reason: 'email_disabled' };
    }
    ensureEmailConfigured(config);

    let tenantDoc = tenant;
    if (!tenantDoc && tenantId) {
      const Tenant = (await import('../models/Tenant.js')).default;
      tenantDoc = await Tenant.findById(tenantId).select('name slug business.contactEmail').lean();
    }

    const recipients = dedupeRecipients(email, tenantDoc?.business?.contactEmail);
    if (recipients.length === 0) {
      return { sent: false, reason: 'missing_recipient' };
    }

    const brandName = config.brandName;
    const loginUrl = getTenantLoginUrl(tenantDoc);
    const planName = plan ? String(plan) : 'your plan';
    const subject = `Payment unsuccessful — ${brandName}`;
    const htmlBody = `
      <p style="margin:0 0 14px;">We could not complete a payment for <strong>${escapeHtml(String(tenantDoc?.name || brandName))}</strong> (${escapeHtml(planName)}).</p>
      <p style="margin:0 0 14px;">${escapeHtml(String(reason || 'The card issuer declined the charge.'))}</p>
      <p style="margin:0;">Update the payment method in billing to keep the workspace active. No invoice entitlements were granted for this attempt.</p>
    `;
    const fullHtml = buildEmailShell({
      brandName,
      title: subject,
      htmlBody,
      cta: { href: loginUrl, label: 'Open billing' },
      workspaceUrl: getTenantWorkspaceUrl(tenantDoc),
      workspaceHost: getTenantWorkspaceHost(tenantDoc),
      dir: 'ltr',
    });

    await sendEmailWithConfig({
      config,
      to: recipients,
      subject,
      html: fullHtml,
      replyTo: config.replyTo,
    });
    return { sent: true, to: recipients };
  } catch (error) {
    logger.error(`Failed to send payment-failed email: ${error.message}`);
    return { sent: false, reason: 'send_failed', error: error.message };
  }
};

export const sendInvoiceEmail = async ({ tenant, invoice, recipient, customerName, language }) => {
  const settings = await getGlobalSettings();
  const config = resolveEmailConfig(settings);
  ensureEmailConfigured(config);

  const tenantEmailSettings = tenant?.settings?.communication?.email || {};
  const recipients = dedupeRecipients(recipient, invoice?.buyer?.contactEmail);
  if (recipients.length === 0) {
    throw new Error('Customer email is missing');
  }

  const preferredLanguage = normalizeLanguage(language || tenant?.settings?.language);
  const systemTemplate = config.templates?.invoice || {};
  const variables = {
    brandName: config.brandName,
    companyName: tenant?.business?.legalNameEn || tenant?.business?.legalNameAr || tenant?.name || config.brandName,
    customerName: customerName || invoice?.buyer?.name || invoice?.buyer?.nameAr || 'Customer',
    invoiceNumber: invoice?.invoiceNumber || '',
    invoiceDate: formatInvoiceDate(invoice, preferredLanguage),
    invoiceTotal: formatInvoiceTotal(invoice),
    invoiceStatus: invoice?.status || '',
    transactionType: invoice?.transactionType || '',
  };

  const subjectTemplate = (preferredLanguage === 'ar'
    ? String(tenantEmailSettings.subjectAr || '').trim()
    : String(tenantEmailSettings.subjectEn || '').trim()) || pickLocalizedValue(systemTemplate, preferredLanguage, 'subject') || 'Invoice {{invoiceNumber}}';
  const bodyTemplate = (preferredLanguage === 'ar'
    ? String(tenantEmailSettings.bodyAr || '').trim()
    : String(tenantEmailSettings.bodyEn || '').trim()) || pickLocalizedValue(systemTemplate, preferredLanguage, 'body') || 'Please find your invoice.';
  const subject = interpolateTemplate(subjectTemplate, variables);
  const body = interpolateTemplate(bodyTemplate, variables);
  const senderName = String(tenantEmailSettings.senderName || config.fromName || '').trim() || config.brandName;
  const senderEmail = String(tenantEmailSettings.fromEmail || config.fromEmail || '').trim() || config.fromEmail;
  const html = buildEmailShell({
    brandName: senderName,
    title: subject,
    body,
    secondaryLines: [
      `${preferredLanguage === 'ar' ? 'رقم الفاتورة' : 'Invoice #'}: ${variables.invoiceNumber}`,
      `${preferredLanguage === 'ar' ? 'التاريخ' : 'Date'}: ${variables.invoiceDate}`,
      `${preferredLanguage === 'ar' ? 'الإجمالي' : 'Total'}: ${variables.invoiceTotal}`,
    ],
    dir: preferredLanguage === 'ar' ? 'rtl' : 'ltr',
  });

  await sendEmailMessage({
    to: recipients,
    subject,
    html,
    replyTo: String(tenantEmailSettings.replyTo || config.replyTo || '').trim() || undefined,
    config: {
      ...config,
      fromName: senderName,
      fromEmail: senderEmail,
    },
  });

  return { sent: true, to: recipients, language: preferredLanguage };
};

export const sendDemoWelcomeEmail = async ({ email, tenant, businessType, trialEndDate, password } = {}) => {
  try {
    const settings = await getGlobalSettings();
    const config = resolveEmailConfig(settings, { allowEnvFallback: false });

    if (!config.enabled) {
      return { sent: false, reason: 'email_disabled' };
    }

    ensureEmailConfigured(config);

    const recipients = dedupeRecipients(email);
    if (recipients.length === 0) {
      return { sent: false, reason: 'missing_recipient' };
    }

    const brandName = config.brandName;
    const salesEmail = String(settings?.email?.salesEmail || config.replyTo || config.fromEmail || '').trim();
    const loginUrl = getTenantLoginUrl(tenant);
    const trialEndStr = trialEndDate
      ? new Date(trialEndDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
      : '';
    const companyName = String(tenant?.business?.legalNameEn || tenant?.name || 'Your company').trim();
    const subject = `Welcome to ${brandName} — your free trial is ready`;

    const htmlBody = `
      <p style="margin:0 0 14px;">Hello,</p>
      <p style="margin:0 0 14px;">Your <strong>7-day free trial</strong> for <strong>${escapeHtml(companyName)}</strong> is live on ${escapeHtml(brandName)}. Full access is unlocked — finance, HR, inventory, and more.</p>
      ${buildCredentialRowsHtml([
        { label: 'Login URL', value: loginUrl, href: loginUrl },
        { label: 'Email', value: email },
        { label: 'Password', value: password || '' },
        { label: 'Business type', value: businessType || '' },
        { label: 'Trial expires', value: trialEndStr },
      ])}
      <p style="margin:0 0 14px;">Keep this email handy — you will need these credentials to sign back in.</p>
      <p style="margin:0;">Questions? Reply anytime and our sales team will help. When you are ready, choose <strong>Get Full Version</strong> in your dashboard header.</p>
    `;

    const html = buildEmailShell({
      brandName,
      title: 'Your free trial is ready',
      htmlBody,
      cta: { href: loginUrl, label: 'Launch your workspace' },
      workspaceUrl: getTenantWorkspaceUrl(tenant),
      workspaceHost: getTenantWorkspaceHost(tenant),
      dir: 'ltr',
    });

    await sendEmailWithConfig({
      config,
      to: recipients,
      subject,
      html,
      replyTo: salesEmail || config.replyTo,
    });

    return { sent: true, to: recipients };
  } catch (error) {
    logger.error(`Failed to send demo welcome email: ${error.message}`);
    return { sent: false, reason: 'send_failed', error: error.message };
  }
};

export const sendUpgradeWelcomeEmail = async ({ email, tenant, plan, billingCycle, amount, currency = 'SAR' } = {}) => {
  try {
    const settings = await getGlobalSettings();
    const config = resolveEmailConfig(settings, { allowEnvFallback: false });

    if (!config.enabled) {
      return { sent: false, reason: 'email_disabled' };
    }

    ensureEmailConfigured(config);

    const recipients = dedupeRecipients(email);
    if (recipients.length === 0) {
      return { sent: false, reason: 'missing_recipient' };
    }

    const brandName = config.brandName;
    const salesEmail = String(settings?.email?.salesEmail || config.replyTo || config.fromEmail || '').trim();
    const loginUrl = getTenantLoginUrl(tenant);
    const planName = plan ? plan.charAt(0).toUpperCase() + plan.slice(1) : 'Professional';
    const cycleLabel = billingCycle === 'yearly' ? 'Annual' : 'Monthly';
    const amountStr = amount ? `${amount} ${currency}` : '';
    const now = new Date();
    const startDate = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    const endDate = new Date(now.getTime() + (billingCycle === 'yearly' ? 365 : 30) * 24 * 60 * 60 * 1000);
    const endDateStr = endDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    const companyName = String(tenant?.name || 'Valued customer').trim();
    const subject = `Welcome to ${brandName} — your subscription is active`;

    const htmlBody = `
      <p style="margin:0 0 14px;">Dear ${escapeHtml(companyName)},</p>
      <p style="margin:0 0 14px;">Congratulations — your full ${escapeHtml(brandName)} subscription is active. Here is a clear summary of your plan:</p>
      ${buildCredentialRowsHtml([
        { label: 'Plan', value: planName },
        { label: 'Billing cycle', value: cycleLabel },
        { label: 'Amount', value: amountStr },
        { label: 'Start date', value: startDate },
        { label: 'Next renewal', value: endDateStr },
      ])}
      <p style="margin:0 0 10px;font-weight:700;color:#0f172a;">What you now have access to</p>
      <ul style="margin:0 0 16px;padding-left:18px;color:#334155;line-height:1.8;">
        <li>ZATCA Phase 2 e-invoicing</li>
        <li>HR &amp; payroll management</li>
        <li>Inventory &amp; warehouses</li>
        <li>Advanced reports &amp; analytics</li>
      </ul>
      <p style="margin:0;">Thank you for choosing ${escapeHtml(brandName)}. Reply to this email anytime if you need assistance.</p>
    `;

    const html = buildEmailShell({
      brandName,
      title: 'Your subscription is active',
      htmlBody,
      cta: { href: loginUrl, label: 'Open your workspace' },
      workspaceUrl: getTenantWorkspaceUrl(tenant),
      workspaceHost: getTenantWorkspaceHost(tenant),
      dir: 'ltr',
    });

    await sendEmailWithConfig({
      config,
      to: recipients,
      subject,
      html,
      replyTo: salesEmail || config.replyTo,
    });

    return { sent: true, to: recipients };
  } catch (error) {
    logger.error(`Failed to send upgrade welcome email: ${error.message}`);
    return { sent: false, reason: 'send_failed', error: error.message };
  }
};

export const maskEmailSecret = (value) => {
  if (!value) return '';
  const text = String(value);
  if (text.length <= 4) return '****';
  return `${text.slice(0, 2)}***${text.slice(-2)}`;
};

export const sendPasswordResetEmail = async ({ user, resetUrl, personalEmail } = {}) => {
  try {
    const settings = await getGlobalSettings();
    const config = resolveEmailConfig(settings, { allowEnvFallback: false });

    if (!config.enabled) {
      return { sent: false, reason: 'email_disabled' };
    }

    ensureEmailConfigured(config);

    const recipients = dedupeRecipients(personalEmail, user.email);
    if (recipients.length === 0) {
      return { sent: false, reason: 'missing_recipient' };
    }

    const brandName = config.brandName;
    const subject = `Password reset request — ${brandName}`;

    const htmlBody = `
      <p style="margin:0 0 14px;">Hello ${escapeHtml(user.firstName || 'there')},</p>
      <p style="margin:0 0 14px;">We received a request to reset the password for your <strong>${escapeHtml(brandName)}</strong> account.</p>
      <p style="margin:0 0 14px;">This link expires in <strong>1 hour</strong>. If you did not request a reset, you can safely ignore this email.</p>
    `;

    const fullHtml = buildEmailShell({
      brandName,
      title: 'Reset your password',
      htmlBody,
      cta: { href: resetUrl, label: 'Reset password' },
      dir: 'ltr',
    });

    await sendEmailWithConfig({
      config,
      to: recipients,
      subject,
      html: fullHtml,
    });

    return { sent: true };
  } catch (error) {
    console.error('[EmailService] Failed to send password reset email:', error);
    return { sent: false, reason: 'error', details: error.message };
  }
};
