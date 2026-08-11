import SystemSettings from '../models/SystemSettings.js';
import logger from './logger.js';
import { ensureEmailDeliveryConfig, sendEmailWithConfig } from './emailProviderService.js';
import { generateTermsPdf } from './termsPdf.js';

const normalizeLanguage = (language) => {
  if (language === 'ar') return 'ar';
  if (language === 'en') return 'en';
  return null;
};

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

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

const buildSecondaryLinesHtml = (secondaryLines = []) => secondaryLines
  .filter(Boolean)
  .map((line) => `<p style="margin:0;color:#475569;font-size:13px;line-height:1.8;">${escapeHtml(line)}</p>`)
  .join('');

const buildEmailShell = ({ brandName, title, body, htmlBody, secondaryLines = [], dir = 'ltr', cta } = {}) => {
  const secondaryHtml = buildSecondaryLinesHtml(secondaryLines);
  const contentHtml = htmlBody || escapeHtml(body || '').replace(/\r?\n/g, '<br />');
  const ctaHtml = cta?.href
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0 8px;">
        <tr>
          <td align="center" style="border-radius:999px;background:linear-gradient(135deg,#059669 0%,#047857 100%);box-shadow:0 12px 28px -12px rgba(5,150,105,0.65);">
            <a href="${escapeHtml(cta.href)}" style="display:inline-block;padding:14px 28px;font-family:'Segoe UI',Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;letter-spacing:0.02em;color:#ffffff;text-decoration:none;">
              ${escapeHtml(cta.label || 'Open dashboard')}
            </a>
          </td>
        </tr>
      </table>`
    : '';

  return `<!DOCTYPE html>
<html lang="en" dir="${dir}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title>${escapeHtml(title)}</title>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap" rel="stylesheet" />
  <style>
    @keyframes maqderFadeUp {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes maqderPulse {
      0%, 100% { box-shadow: 0 0 0 0 rgba(16,185,129,0.35); }
      50% { box-shadow: 0 0 0 10px rgba(16,185,129,0); }
    }
    @keyframes maqderShimmer {
      0% { background-position: 0% 50%; }
      100% { background-position: 100% 50%; }
    }
    .maqder-card { animation: maqderFadeUp 0.7s ease-out both; }
    .maqder-badge { animation: maqderPulse 2.4s ease-in-out infinite; }
    .maqder-hero {
      background: linear-gradient(120deg, #064e3b 0%, #059669 42%, #0d9488 100%);
      background-size: 180% 180%;
      animation: maqderShimmer 8s ease-in-out infinite alternate;
    }
    @media only screen and (max-width: 620px) {
      .maqder-pad { padding: 24px 18px !important; }
      .maqder-title { font-size: 22px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:#eef2f7;font-family:'Plus Jakarta Sans','Segoe UI',Arial,Helvetica,sans-serif;color:#0f172a;-webkit-font-smoothing:antialiased;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(title)} — ${escapeHtml(brandName)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f7;padding:32px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="maqder-card" style="max-width:640px;background:#ffffff;border-radius:28px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 28px 60px -36px rgba(15,23,42,0.45);">
          <tr>
            <td class="maqder-hero maqder-pad" style="padding:36px 40px;color:#ffffff;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="left" valign="middle">
                    <div class="maqder-badge" style="display:inline-block;padding:6px 12px;border-radius:999px;background:rgba(255,255,255,0.14);border:1px solid rgba(255,255,255,0.22);font-size:11px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;">
                      ${escapeHtml(brandName)}
                    </div>
                    <h1 class="maqder-title" style="margin:16px 0 0;font-size:28px;line-height:1.25;font-weight:800;letter-spacing:-0.02em;color:#ffffff;">
                      ${escapeHtml(title)}
                    </h1>
                  </td>
                  <td align="right" valign="middle" width="72">
                    <img src="https://maqder.com/maqderlogolandingpage.webp" alt="${escapeHtml(brandName)}" width="56" height="56" style="display:block;width:56px;height:56px;border-radius:16px;background:#ffffff;object-fit:contain;padding:6px;box-shadow:0 10px 24px -12px rgba(0,0,0,0.45);" />
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td class="maqder-pad" style="padding:36px 40px;">
              <div style="font-size:15px;line-height:1.85;color:#1e293b;text-align:left;">${contentHtml}</div>
              ${secondaryHtml ? `<div style="margin-top:24px;padding:18px 20px;border-radius:18px;background:linear-gradient(180deg,#f8fafc 0%,#f1f5f9 100%);border:1px solid #e2e8f0;">${secondaryHtml}</div>` : ''}
              ${ctaHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:0 40px 32px;">
              <div style="height:1px;background:linear-gradient(90deg,transparent,#e2e8f0,transparent);"></div>
              <p style="margin:18px 0 0;font-size:12px;line-height:1.7;color:#94a3b8;text-align:center;">
                Sent by ${escapeHtml(brandName)} · <a href="https://maqder.com" style="color:#059669;text-decoration:none;font-weight:600;">maqder.com</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};

const buildCredentialRowsHtml = (rows = []) => {
  const items = rows.filter((row) => row?.label && row?.value);
  if (items.length === 0) return '';
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:22px 0;border-collapse:separate;border-spacing:0;border:1px solid #d1fae5;border-radius:18px;overflow:hidden;background:#ecfdf5;">
    ${items.map((row, index) => `
      <tr>
        <td style="padding:14px 18px;border-top:${index === 0 ? '0' : '1px solid #d1fae5'};width:38%;font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#047857;vertical-align:top;">
          ${escapeHtml(row.label)}
        </td>
        <td style="padding:14px 18px;border-top:${index === 0 ? '0' : '1px solid #d1fae5'};font-size:14px;font-weight:600;color:#0f172a;word-break:break-word;vertical-align:top;">
          ${row.href ? `<a href="${escapeHtml(row.href)}" style="color:#059669;text-decoration:none;">${escapeHtml(row.value)}</a>` : escapeHtml(row.value)}
        </td>
      </tr>`).join('')}
  </table>`;
};

const buildBilingualEmailShell = ({ brandName, title, sections = [] }) => {
  const sectionsHtml = sections
    .filter((section) => section?.body)
    .map((section) => {
      const dir = section.dir === 'rtl' ? 'rtl' : 'ltr';
      const align = dir === 'rtl' ? 'right' : 'left';
      const secondaryHtml = buildSecondaryLinesHtml(section.secondaryLines || []);
      return `<section dir="${dir}" style="padding:24px 0;text-align:${align};${dir === 'rtl' ? 'font-family:Tahoma,Arial,sans-serif;' : ''}">
        <h2 style="margin:0 0 12px;font-size:20px;line-height:1.5;color:#0f172a;">${escapeHtml(section.title || '')}</h2>
        <div style="font-size:15px;line-height:1.95;color:#1e293b;">${escapeHtml(section.body).replace(/\r?\n/g, '<br />')}</div>
        ${secondaryHtml ? `<div style="margin-top:20px;padding:18px;border-radius:18px;background:#f8fafc;border:1px solid #e2e8f0;display:grid;gap:8px;">${secondaryHtml}</div>` : ''}
      </section>`;
    })
    .join('<div style="height:1px;background:#e2e8f0;"></div>');

  return `<!DOCTYPE html>
<html dir="ltr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:24px;background:#f8fafc;font-family:Segoe UI,Arial,sans-serif;color:#0f172a;">
  <div style="max-width:720px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:24px;overflow:hidden;box-shadow:0 20px 45px -35px rgba(15,23,42,0.35);">
    <div style="background:linear-gradient(135deg,#1a3d28 0%,#2d5a3f 100%);padding:28px 32px;color:#ffffff;">
      <div style="font-size:13px;letter-spacing:0.18em;text-transform:uppercase;opacity:0.78;">${escapeHtml(brandName)}</div>
      <h1 style="margin:12px 0 0;font-size:24px;line-height:1.35;font-weight:700;">${escapeHtml(title)}</h1>
    </div>
    <div style="padding:0 32px;">${sectionsHtml}</div>
  </div>
</body>
</html>`;
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
  tenantSlug: String(tenant?.slug || '').trim(),
});

const buildTenantWelcomeSecondaryLines = (variables, language) => uniqueValues(
  variables.loginEmail ? `${language === 'ar' ? 'البريد للدخول' : 'Login email'}: ${variables.loginEmail}` : '',
  variables.tenantSlug ? `${language === 'ar' ? 'رمز الشركة' : 'Tenant slug'}: ${variables.tenantSlug}` : ''
);

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
      cta: { href: 'https://maqder.com/login', label: 'Open your dashboard' },
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
    const loginUrl = 'https://maqder.com/login';
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
      cta: { href: loginUrl, label: 'Open your dashboard' },
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
    const loginUrl = 'https://maqder.com/login';
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
    const loginUrl = 'https://maqder.com/login';
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
      cta: { href: loginUrl, label: 'Open your dashboard' },
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
