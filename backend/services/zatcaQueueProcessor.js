import ZatcaQueue from '../models/ZatcaQueue.js';
import Invoice from '../models/Invoice.js';
import Tenant from '../models/Tenant.js';
import ZatcaAuditLog from '../models/ZatcaAuditLog.js';
import ZatcaService from '../utils/zatca/ZatcaService.js';
import { decryptZatcaConfig } from '../utils/zatcaKeyVault.js';
import logger from '../utils/logger.js';
import { isZatcaCurrency } from '../utils/zatcaCurrency.js';
import { redisGetJson, redisSetJson } from '../utils/redisJson.js';

const MAX_RETRIES = 5;
const BASE_RETRY_DELAY_MS = 30_000;
const MAX_RETRY_DELAY_MS = 3_600_000;
const CIRCUIT_BREAKER_THRESHOLD = 5;
const CIRCUIT_BREAKER_RESET_MS = 10 * 60 * 1000;

const circuitBreakerState = new Map();
const breakerKey = (tenantId) => `zatca:breaker:${tenantId}`;

const getCircuitState = async (tenantId) => {
  const key = String(tenantId);
  const fromRedis = await redisGetJson(breakerKey(key));
  if (fromRedis) {
    circuitBreakerState.set(key, fromRedis);
    return fromRedis;
  }
  if (!circuitBreakerState.has(key)) {
    circuitBreakerState.set(key, { failures: 0, tripped: false, trippedAt: null });
  }
  return circuitBreakerState.get(key);
};

const persistCircuit = async (tenantId, state) => {
  const key = String(tenantId);
  circuitBreakerState.set(key, state);
  await redisSetJson(breakerKey(key), state, Math.ceil(CIRCUIT_BREAKER_RESET_MS / 1000) + 60);
};

const tripCircuit = async (tenantId) => {
  const state = await getCircuitState(tenantId);
  state.tripped = true;
  state.trippedAt = Date.now();
  await persistCircuit(tenantId, state);
  logger.warn(`[ZATCA Queue] Circuit breaker tripped for tenant ${tenantId}`);
};

const resetCircuit = async (tenantId) => {
  const next = { failures: 0, tripped: false, trippedAt: null };
  await persistCircuit(tenantId, next);
};

const isCircuitOpen = async (tenantId) => {
  const state = await getCircuitState(tenantId);
  if (!state.tripped) return false;
  if (Date.now() - state.trippedAt > CIRCUIT_BREAKER_RESET_MS) {
    await resetCircuit(tenantId);
    logger.info(`[ZATCA Queue] Circuit breaker reset for tenant ${tenantId}`);
    return false;
  }
  return true;
};

const recordSuccess = async (tenantId) => {
  await resetCircuit(tenantId);
};

const recordFailure = async (tenantId) => {
  const state = await getCircuitState(tenantId);
  state.failures++;
  if (state.failures >= CIRCUIT_BREAKER_THRESHOLD) {
    await tripCircuit(tenantId);
  } else {
    await persistCircuit(tenantId, state);
  }
};

const computeBackoff = (retryCount) => {
  const delay = Math.min(BASE_RETRY_DELAY_MS * Math.pow(2, retryCount), MAX_RETRY_DELAY_MS);
  return new Date(Date.now() + delay);
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

export async function enqueueInvoice(invoiceId, tenantId, invoiceNumber, transactionType = 'B2C', priority = 0) {
  try {
    const existing = await ZatcaQueue.findOne({ invoiceId });
    if (existing) {
      if (existing.status === 'failed' || existing.status === 'cancelled') {
        existing.status = 'queued';
        existing.retryCount = 0;
        existing.lastError = '';
        existing.nextRetryAt = null;
        existing.priority = priority;
        await existing.save();
        logger.info(`[ZATCA Queue] Re-queued invoice ${invoiceNumber}`);
      }
      return existing;
    }

    const queueItem = await ZatcaQueue.create({
      tenantId,
      invoiceId,
      invoiceNumber,
      transactionType,
      priority,
      status: 'queued',
    });

    logger.info(`[ZATCA Queue] Enqueued invoice ${invoiceNumber} for tenant ${tenantId}`);
    return queueItem;
  } catch (error) {
    logger.error(`[ZATCA Queue] Failed to enqueue invoice ${invoiceNumber}: ${error.message}`);
    throw error;
  }
}

export async function processQueue(batchSize = 25) {
  const results = {
    processed: 0,
    success: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  };

  try {
    const pendingItems = await ZatcaQueue.find({
      status: { $in: ['queued', 'processing'] },
      $or: [
        { nextRetryAt: null },
        { nextRetryAt: { $lte: new Date() } },
      ],
    })
      .sort({ priority: -1, queuedAt: 1 })
      .limit(batchSize)
      .lean();

    if (pendingItems.length === 0) {
      return results;
    }

    const tenantIds = [...new Set(pendingItems.map((item) => item.tenantId.toString()))];
    const tenants = await Tenant.find({ _id: { $in: tenantIds } })
      .select('name slug business zatca settings')
      .lean();

    const tenantMap = new Map(tenants.map((t) => [t._id.toString(), t]));

    for (const item of pendingItems) {
      const tenantIdStr = item.tenantId.toString();

      if (await isCircuitOpen(tenantIdStr)) {
        results.skipped++;
        continue;
      }

      const tenant = tenantMap.get(tenantIdStr);
      if (!tenant) {
        await ZatcaQueue.findByIdAndUpdate(item._id, {
          status: 'cancelled',
          lastError: 'Tenant not found',
        });
        results.skipped++;
        continue;
      }

      if (!isZatcaCurrency(tenant)) {
        await ZatcaQueue.findByIdAndUpdate(item._id, {
          status: 'cancelled',
          lastError: 'Tenant currency is not SAR; ZATCA does not apply',
        });
        results.skipped++;
        continue;
      }

      const zatcaConfig = decryptZatcaConfig(tenant.zatca);
      if (!zatcaConfig?.isOnboarded || !zatcaConfig?.productionCsid) {
        await ZatcaQueue.findByIdAndUpdate(item._id, {
          status: 'cancelled',
          lastError: 'Tenant not onboarded for ZATCA Phase 2',
        });
        results.skipped++;
        continue;
      }

      try {
        await ZatcaQueue.findByIdAndUpdate(item._id, {
          status: 'processing',
          lastAttemptAt: new Date(),
        });

        const invoice = await Invoice.findById(item.invoiceId);
        if (!invoice) {
          await ZatcaQueue.findByIdAndUpdate(item._id, {
            status: 'cancelled',
            lastError: 'Invoice not found',
          });
          results.skipped++;
          continue;
        }

        const zatcaService = new ZatcaService({
          privateKey: zatcaConfig.privateKey,
          csid: zatcaConfig.productionCsid,
          previousInvoiceHash: zatcaConfig.lastInvoiceHash,
        });

        const isB2B = item.transactionType === 'B2B';
        const submitResult = isB2B
          ? await zatcaService.submitForClearance(
              invoice.zatca?.signedXml,
              invoice.zatca?.invoiceHash,
              invoice.zatca?.uuid
            )
          : await zatcaService.submitForReporting(
              invoice.zatca?.signedXml,
              invoice.zatca?.invoiceHash,
              invoice.zatca?.uuid
            );

        if (submitResult.success) {
          await ZatcaQueue.findByIdAndUpdate(item._id, {
            status: isB2B ? 'cleared' : 'reported',
            processedAt: new Date(),
            zatcaResponse: submitResult,
          });

          invoice.zatca.submissionStatus = isB2B ? 'cleared' : 'reported';
          invoice.zatca.reportingStatus = submitResult.reportingStatus;
          invoice.zatca.zatcaResponse = submitResult;
          invoice.zatca.submittedAt = new Date();
          await invoice.save();

          await recordSuccess(tenantIdStr);
          results.success++;
          results.processed++;

          await logAudit(
            item.tenantId,
            'manual_sync',
            'success',
            `Invoice ${item.invoiceNumber} ${isB2B ? 'cleared' : 'reported'} successfully via queue`,
            { invoiceNumber: item.invoiceNumber, retryCount: item.retryCount }
          );
        } else {
          throw new Error(submitResult.errors?.join(', ') || submitResult.error || 'Unknown ZATCA API error');
        }
      } catch (error) {
        results.failed++;
        results.processed++;
        results.errors.push({
          invoiceNumber: item.invoiceNumber,
          error: error.message,
        });

        await recordFailure(tenantIdStr);

        const newRetryCount = item.retryCount + 1;
        const circuitOpen = await isCircuitOpen(tenantIdStr);
        const shouldRetry = newRetryCount < MAX_RETRIES && !circuitOpen;

        await ZatcaQueue.findByIdAndUpdate(item._id, {
          status: shouldRetry ? 'queued' : 'failed',
          retryCount: newRetryCount,
          lastError: error.message,
          nextRetryAt: shouldRetry ? computeBackoff(newRetryCount) : null,
          circuitBreakerTripped: circuitOpen,
        });

        await logAudit(
          item.tenantId,
          'manual_sync',
          'failed',
          `Invoice ${item.invoiceNumber} submission failed (attempt ${newRetryCount}/${MAX_RETRIES}): ${error.message}`,
          { invoiceNumber: item.invoiceNumber, retryCount: newRetryCount, willRetry: shouldRetry }
        );

        logger.error(`[ZATCA Queue] Invoice ${item.invoiceNumber} failed: ${error.message}`);
      }

      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    logger.info(`[ZATCA Queue] Batch processed: ${results.success} success, ${results.failed} failed, ${results.skipped} skipped`);
    return results;
  } catch (error) {
    logger.error(`[ZATCA Queue] Process error: ${error.message}`);
    return { ...results, error: error.message };
  }
}

export function getCircuitBreakerStatus() {
  const result = [];
  for (const [tenantId, state] of circuitBreakerState.entries()) {
    result.push({
      tenantId,
      failures: state.failures,
      tripped: state.tripped,
      trippedAt: state.trippedAt,
      timeUntilReset: state.tripped ? Math.max(0, CIRCUIT_BREAKER_RESET_MS - (Date.now() - state.trippedAt)) : 0,
    });
  }
  return result;
}

export { isCircuitOpen, tripCircuit, resetCircuit };
