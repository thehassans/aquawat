import Tenant from '../models/Tenant.js';
import Invoice from '../models/Invoice.js';
import ZatcaAuditLog from '../models/ZatcaAuditLog.js';
import ZatcaQueue from '../models/ZatcaQueue.js';
import SystemSettings from '../models/SystemSettings.js';
import { verifyHashChain, verifyQrIntegrity } from '../lib/zatcaQr.js';
import { decryptZatcaConfig } from '../utils/zatcaKeyVault.js';
import { sendEmailWithConfig } from '../utils/emailProviderService.js';
import logger from '../utils/logger.js';
import crypto from 'crypto';
import { isZatcaCurrency } from '../utils/zatcaCurrency.js';

const DEFAULT_SEED = 'NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYzIzOWRkNGU5MWI0NjcyOWQ3M2EyN2ZiNTdlOQ==';
const CERT_EXPIRY_WARNING_DAYS = 30;

const getAlertRecipients = async () => {
  try {
    const settings = await SystemSettings.findOne().lean();
    const recipients = [];

    if (settings?.email?.fromEmail) {
      recipients.push(settings.email.fromEmail);
    }
    if (settings?.email?.alertEmails && Array.isArray(settings.email.alertEmails)) {
      recipients.push(...settings.email.alertEmails);
    }

    return [...new Set(recipients.filter(Boolean))];
  } catch {
    return [];
  }
};

const getEmailConfig = async () => {
  try {
    const settings = await SystemSettings.findOne().lean();
    return settings?.email || null;
  } catch {
    return null;
  }
};

const sendAlertEmail = async (subject, htmlBody) => {
  try {
    const recipients = await getAlertRecipients();
    if (recipients.length === 0) {
      logger.warn('[ZATCA Monitor] No alert recipients configured, skipping email');
      return;
    }

    const emailConfig = await getEmailConfig();
    if (!emailConfig) {
      logger.warn('[ZATCA Monitor] No email config found, skipping alert email');
      return;
    }

    await sendEmailWithConfig({
      config: emailConfig,
      to: recipients,
      subject: `[ZATCA Monitor] ${subject}`,
      html: htmlBody,
    });

    logger.info(`[ZATCA Monitor] Alert email sent to ${recipients.length} recipients: ${subject}`);
  } catch (error) {
    logger.error(`[ZATCA Monitor] Failed to send alert email: ${error.message}`);
  }
};

const logAudit = async (tenantId, action, severity, status, message, details = {}) => {
  try {
    await ZatcaAuditLog.create({
      tenantId,
      action,
      severity,
      status,
      message,
      details,
      performedByRole: 'system',
    });
  } catch (err) {
    console.error('[ZatcaAuditLog] Failed to log:', err.message);
  }
};

const checkCertificateExpiry = async (tenant) => {
  const alerts = [];
  const zatcaConfig = decryptZatcaConfig(tenant.zatca);

  if (!zatcaConfig?.productionCsid && !zatcaConfig?.complianceCsid) {
    return alerts;
  }

  const csid = zatcaConfig.productionCsid || zatcaConfig.complianceCsid;

  try {
    const certMatch = csid.match(/-----BEGIN CERTIFICATE-----([\s\S]*?)-----END CERTIFICATE-----/);
    if (!certMatch) return alerts;

    const certPem = `-----BEGIN CERTIFICATE-----${certMatch[1]}-----END CERTIFICATE-----`;
    const cert = new crypto.X509Certificate(certPem);

    if (cert.validTo) {
      const expiryDate = new Date(cert.validTo);
      const daysUntilExpiry = Math.ceil((expiryDate - new Date()) / (1000 * 60 * 60 * 24));

      if (daysUntilExpiry < 0) {
        alerts.push({
          tenantId: tenant._id,
          tenantName: tenant.name,
          severity: 'critical',
          message: `ZATCA certificate EXPIRED ${Math.abs(daysUntilExpiry)} days ago`,
          expiryDate: expiryDate.toISOString(),
        });
      } else if (daysUntilExpiry <= CERT_EXPIRY_WARNING_DAYS) {
        alerts.push({
          tenantId: tenant._id,
          tenantName: tenant.name,
          severity: 'warning',
          message: `ZATCA certificate expires in ${daysUntilExpiry} days`,
          expiryDate: expiryDate.toISOString(),
        });
      }
    }
  } catch (error) {
    logger.debug(`[ZATCA Monitor] Could not parse cert for tenant ${tenant.name}: ${error.message}`);
  }

  return alerts;
};

const verifyTenantChain = async (tenant) => {
  const invoices = await Invoice.find({
    tenantId: tenant._id,
    'zatca.qrCodeData': { $exists: true, $ne: '' },
  })
    .sort({ issueDate: 1, createdAt: 1 })
    .select('invoiceNumber issueDate grandTotal totalTax seller lineItems zatca')
    .lean();

  if (invoices.length === 0) {
    return { totalInvoices: 0, validLinks: 0, brokenLinks: 0, brokenInvoices: [] };
  }

  let previousHash = tenant.zatca?.lastInvoiceHash || DEFAULT_SEED;
  let validLinks = 0;
  let brokenLinks = 0;
  const brokenInvoices = [];

  for (const invoice of invoices) {
    const verification = verifyHashChain(invoice, previousHash);
    if (verification.valid) {
      validLinks++;
      previousHash = verification.expectedChainedHash;
    } else {
      brokenLinks++;
      brokenInvoices.push({
        invoiceId: invoice._id,
        invoiceNumber: invoice.invoiceNumber,
        issueDate: invoice.issueDate,
      });
      previousHash = invoice.zatca?.invoiceHash || verification.expectedChainedHash;
    }
  }

  return { totalInvoices: invoices.length, validLinks, brokenLinks, brokenInvoices };
};

const verifyTenantQrCodes = async (tenant) => {
  const invoices = await Invoice.find({
    tenantId: tenant._id,
    'zatca.qrCodeData': { $exists: true, $ne: '' },
  })
    .select('invoiceNumber zatca.qrCodeData')
    .sort({ issueDate: -1 })
    .limit(200)
    .lean();

  let validCount = 0;
  let invalidCount = 0;
  const invalidInvoices = [];

  for (const invoice of invoices) {
    const integrity = verifyQrIntegrity(invoice.zatca.qrCodeData);
    if (integrity.valid) {
      validCount++;
    } else {
      invalidCount++;
      invalidInvoices.push({
        invoiceId: invoice._id,
        invoiceNumber: invoice.invoiceNumber,
        errors: integrity.errors,
      });
    }
  }

  return { totalChecked: invoices.length, validCount, invalidCount, invalidInvoices };
};

export async function runZatcaMonitoring() {
  logger.info('[ZATCA Monitor] Starting nightly monitoring check...');
  const report = {
    tenantsChecked: 0,
    chainIssues: [],
    qrIssues: [],
    certAlerts: [],
    queueAlerts: [],
  };

  try {
    const allOnboardedTenants = await Tenant.find({
      isActive: true,
      'zatca.isOnboarded': true,
    })
      .select('name slug business zatca settings')
      .lean();

    // ZATCA monitoring only applies to SAR-denominated tenants; skip any
    // tenant that has since switched to a non-Saudi default currency.
    const tenants = allOnboardedTenants.filter((tenant) => isZatcaCurrency(tenant));

    report.tenantsChecked = tenants.length;

    for (const tenant of tenants) {
      try {
        const chainResult = await verifyTenantChain(tenant);
        if (chainResult.brokenLinks > 0) {
          report.chainIssues.push({
            tenantId: tenant._id,
            tenantName: tenant.name,
            ...chainResult,
          });

          await logAudit(
            tenant._id,
            'chain_verification',
            'warning',
            'partial',
            `Nightly check: ${chainResult.brokenLinks} broken chain links out of ${chainResult.totalInvoices} invoices`,
            { brokenLinks: chainResult.brokenLinks, totalInvoices: chainResult.totalInvoices }
          );
        }

        const qrResult = await verifyTenantQrCodes(tenant);
        if (qrResult.invalidCount > 0) {
          report.qrIssues.push({
            tenantId: tenant._id,
            tenantName: tenant.name,
            ...qrResult,
          });

          await logAudit(
            tenant._id,
            'qr_integrity_check',
            'warning',
            'partial',
            `Nightly check: ${qrResult.invalidCount} invalid QR codes out of ${qrResult.totalChecked} checked`,
            { invalidCount: qrResult.invalidCount, totalChecked: qrResult.totalChecked }
          );
        }

        const certAlerts = await checkCertificateExpiry(tenant);
        if (certAlerts.length > 0) {
          report.certAlerts.push(...certAlerts);
          for (const alert of certAlerts) {
            await logAudit(
              tenant._id,
              'certificate_renewal',
              alert.severity,
              'failed',
              alert.message,
              { expiryDate: alert.expiryDate }
            );
          }
        }
      } catch (error) {
        logger.error(`[ZATCA Monitor] Error checking tenant ${tenant.name}: ${error.message}`);
      }
    }

    const failedQueueItems = await ZatcaQueue.countDocuments({ status: 'failed' });
    if (failedQueueItems > 0) {
      report.queueAlerts.push({
        message: `${failedQueueItems} invoices permanently failed in ZATCA queue`,
        count: failedQueueItems,
      });
    }

    const hasIssues =
      report.chainIssues.length > 0 ||
      report.qrIssues.length > 0 ||
      report.certAlerts.length > 0 ||
      report.queueAlerts.length > 0;

    if (hasIssues) {
      const htmlParts = ['<h2>ZATCA Nightly Monitoring Report</h2>'];

      if (report.chainIssues.length > 0) {
        htmlParts.push('<h3 style="color: #f59e0b;">Chain Verification Issues</h3><ul>');
        for (const issue of report.chainIssues) {
          htmlParts.push(`<li><strong>${issue.tenantName}</strong>: ${issue.brokenLinks}/${issue.totalInvoices} broken links</li>`);
        }
        htmlParts.push('</ul>');
      }

      if (report.qrIssues.length > 0) {
        htmlParts.push('<h3 style="color: #f59e0b;">QR Integrity Issues</h3><ul>');
        for (const issue of report.qrIssues) {
          htmlParts.push(`<li><strong>${issue.tenantName}</strong>: ${issue.invalidCount}/${issue.totalChecked} invalid QR codes</li>`);
        }
        htmlParts.push('</ul>');
      }

      if (report.certAlerts.length > 0) {
        htmlParts.push('<h3 style="color: #ef4444;">Certificate Alerts</h3><ul>');
        for (const alert of report.certAlerts) {
          htmlParts.push(`<li><strong>${alert.tenantName}</strong>: ${alert.message} (expires: ${new Date(alert.expiryDate).toLocaleDateString()})</li>`);
        }
        htmlParts.push('</ul>');
      }

      if (report.queueAlerts.length > 0) {
        htmlParts.push('<h3 style="color: #ef4444;">Queue Alerts</h3><ul>');
        for (const alert of report.queueAlerts) {
          htmlParts.push(`<li>${alert.message}</li>`);
        }
        htmlParts.push('</ul>');
      }

      htmlParts.push(`<hr><p style="color: #6b7280; font-size: 12px;">Checked ${report.tenantsChecked} tenants at ${new Date().toISOString()}</p>`);

      await sendAlertEmail('Issues Detected', htmlParts.join(''));
      logger.info(`[ZATCA Monitor] Report: ${report.chainIssues.length} chain issues, ${report.qrIssues.length} QR issues, ${report.certAlerts.length} cert alerts, ${report.queueAlerts.length} queue alerts`);
    } else {
      logger.info(`[ZATCA Monitor] All ${report.tenantsChecked} tenants passed checks - no issues found`);
    }

    return report;
  } catch (error) {
    logger.error(`[ZATCA Monitor] Fatal error: ${error.message}`);
    return { ...report, error: error.message };
  }
}

export async function runCertExpiryCheck() {
  logger.info('[ZATCA Monitor] Running certificate expiry check...');
  const alerts = [];

  try {
    const allOnboardedTenants = await Tenant.find({
      isActive: true,
      'zatca.isOnboarded': true,
    })
      .select('name slug zatca settings')
      .lean();

    const tenants = allOnboardedTenants.filter((tenant) => isZatcaCurrency(tenant));

    for (const tenant of tenants) {
      const certAlerts = await checkCertificateExpiry(tenant);
      alerts.push(...certAlerts);
    }

    if (alerts.length > 0) {
      const critical = alerts.filter((a) => a.severity === 'critical');
      const subject = critical.length > 0
        ? `${critical.length} Expired Certificate(s)`
        : `${alerts.length} Certificate(s) Expiring Soon`;

      const htmlParts = ['<h2>ZATCA Certificate Expiry Alert</h2><ul>'];
      for (const alert of alerts) {
        const color = alert.severity === 'critical' ? '#ef4444' : '#f59e0b';
        htmlParts.push(`<li style="color: ${color};"><strong>${alert.tenantName}</strong>: ${alert.message}</li>`);
      }
      htmlParts.push('</ul>');

      await sendAlertEmail(subject, htmlParts.join(''));
    }

    logger.info(`[ZATCA Monitor] Cert check: ${alerts.length} alerts found`);
    return alerts;
  } catch (error) {
    logger.error(`[ZATCA Monitor] Cert check error: ${error.message}`);
    return [];
  }
}

export default runZatcaMonitoring;
