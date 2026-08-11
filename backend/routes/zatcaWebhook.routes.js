import express from 'express';
import crypto from 'crypto';
import Invoice from '../models/Invoice.js';
import ZatcaQueue from '../models/ZatcaQueue.js';
import ZatcaAuditLog from '../models/ZatcaAuditLog.js';
import Tenant from '../models/Tenant.js';
import logger from '../utils/logger.js';

const router = express.Router();

const verifyWebhookSignature = (payload, signature, secret) => {
  if (!signature || !secret) return false;
  try {
    const expected = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expected)
    );
  } catch {
    return false;
  }
};

const findInvoiceByUuid = async (uuid, tenantId) => {
  const query = { 'zatca.uuid': uuid };
  if (tenantId) query.tenantId = tenantId;
  return Invoice.findOne(query);
};

const logAudit = async (tenantId, action, status, message, details = {}) => {
  try {
    await ZatcaAuditLog.create({
      tenantId,
      action,
      severity: status === 'failed' ? 'warning' : 'info',
      status,
      message,
      details,
      performedByRole: 'system',
    });
  } catch (err) {
    console.error('[ZatcaAuditLog] Failed to log:', err.message);
  }
};

/**
 * POST /api/webhooks/zatca
 * Receives async callbacks from ZATCA Fatoora portal.
 * Supports both reporting and clearance status callbacks.
 *
 * Expected body:
 * {
 *   "uuid": "invoice-uuid",
 *   "invoiceHash": "base64-hash",
 *   "reportingStatus": "REPORTED" | "NOT_REPORTED",
 *   "clearanceStatus": "CLEARED" | "NOT_CLEARED",
 *   "validationResults": { ... },
 *   "tenantId": "optional-tenant-id",
 *   "timestamp": "2024-01-01T00:00:00Z"
 * }
 */
router.post('/', express.raw({ type: '*/*', limit: '1mb' }), async (req, res) => {
  try {
    const rawBody = req.body.toString('utf8');
    const signature = req.headers['x-zatca-signature'] || req.headers['x-signature'];
    const webhookSecret = process.env.ZATCA_WEBHOOK_SECRET;

    // Fail closed in production — unsigned callbacks must never mutate invoice status
    if (!webhookSecret) {
      if (process.env.NODE_ENV === 'production') {
        logger.warn('[ZATCA Webhook] ZATCA_WEBHOOK_SECRET missing — rejecting');
        return res.status(503).json({ error: 'Webhook secret not configured' });
      }
    } else if (!verifyWebhookSignature(rawBody, signature, webhookSecret)) {
      logger.warn('[ZATCA Webhook] Invalid signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    let body;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return res.status(400).json({ error: 'Invalid JSON payload' });
    }

    const { uuid, invoiceHash, reportingStatus, clearanceStatus, validationResults, tenantId, timestamp } = body;

    if (!uuid) {
      return res.status(400).json({ error: 'Missing invoice UUID' });
    }

    logger.info(`[ZATCA Webhook] Received callback for invoice UUID: ${uuid}`);

    const invoice = await findInvoiceByUuid(uuid, tenantId);
    if (!invoice) {
      logger.warn(`[ZATCA Webhook] Invoice not found for UUID: ${uuid}`);
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const isReported = reportingStatus === 'REPORTED';
    const isCleared = clearanceStatus === 'CLEARED';
    const hasError = reportingStatus === 'NOT_REPORTED' || clearanceStatus === 'NOT_CLEARED';

    if (isReported || isCleared) {
      invoice.zatca.submissionStatus = isCleared ? 'cleared' : 'reported';
      invoice.zatca.reportingStatus = reportingStatus || null;
      invoice.zatca.clearanceStatus = clearanceStatus || null;
      invoice.zatca.zatcaResponse = { ...invoice.zatca.zatcaResponse, webhookCallback: body };
      invoice.zatca.submittedAt = invoice.zatca.submittedAt || new Date();

      if (isCleared) invoice.zatca.clearedAt = new Date();

      await invoice.save();

      await ZatcaQueue.findOneAndUpdate(
        { invoiceId: invoice._id },
        {
          status: isCleared ? 'cleared' : 'reported',
          processedAt: new Date(),
          zatcaResponse: body,
        }
      );

      await logAudit(
        invoice.tenantId,
        'manual_sync',
        'success',
        `Invoice ${invoice.invoiceNumber} ${isCleared ? 'cleared' : 'reported'} via ZATCA webhook`,
        { uuid, reportingStatus, clearanceStatus }
      );

      logger.info(`[ZATCA Webhook] Invoice ${invoice.invoiceNumber} marked as ${isCleared ? 'cleared' : 'reported'}`);
    } else if (hasError) {
      const errorMsg = validationResults?.errors?.join(', ') || validationResults?.error || 'ZATCA validation failed';

      invoice.zatca.submissionStatus = 'rejected';
      invoice.zatca.lastError = errorMsg;
      invoice.zatca.zatcaResponse = { ...invoice.zatca.zatcaResponse, webhookCallback: body, error: errorMsg };
      invoice.zatca.retryCount = (invoice.zatca.retryCount || 0) + 1;

      await invoice.save();

      await ZatcaQueue.findOneAndUpdate(
        { invoiceId: invoice._id },
        {
          status: 'failed',
          lastError: errorMsg,
          retryCount: (await ZatcaQueue.findOne({ invoiceId: invoice._id }))?.retryCount + 1 || 1,
        }
      );

      await logAudit(
        invoice.tenantId,
        'manual_sync',
        'failed',
        `Invoice ${invoice.invoiceNumber} rejected by ZATCA: ${errorMsg}`,
        { uuid, reportingStatus, clearanceStatus, validationResults }
      );

      logger.warn(`[ZATCA Webhook] Invoice ${invoice.invoiceNumber} rejected: ${errorMsg}`);
    }

    res.status(200).json({ received: true, invoiceNumber: invoice.invoiceNumber });
  } catch (error) {
    logger.error(`[ZATCA Webhook] Error: ${error.message}`);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

/**
 * GET /api/webhooks/zatca/health
 * Health check endpoint for ZATCA webhook monitoring
 */
router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default router;
