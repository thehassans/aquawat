import path from 'path';
import crypto from 'crypto';
import { Queue, Worker } from 'bullmq';
import Redis from 'ioredis';
import Invoice from '../models/Invoice.js';
import Tenant from '../models/Tenant.js';
import Customer from '../models/Customer.js';
import { buildInvoicePdfAttachment } from '../utils/invoicePdfService.js';
import { saveUploadBuffer, readUploadBuffer } from '../utils/objectStorage.js';
import { isRedisReady } from '../lib/redis.js';
import logger from '../utils/logger.js';

const PDF_DIR = path.join(process.cwd(), 'storage');
const QUEUE_NAME = 'invoice-pdf';
const pending = [];
const queuedIds = new Set();
let pumping = false;
let pdfQueue = null;
let pdfWorker = null;
let bullmqRedis = null;

function fingerprint(invoice) {
  const raw = [
    invoice?._id,
    invoice?.updatedAt ? new Date(invoice.updatedAt).getTime() : '',
    invoice?.pdfTemplateId || '',
    invoice?.grandTotal ?? '',
    invoice?.totalTax ?? '',
    invoice?.invoiceNumber || '',
  ].join('|');
  return crypto.createHash('sha1').update(String(raw)).digest('hex').slice(0, 16);
}

function cacheKey(invoice) {
  const tenantId = String(invoice.tenantId || 'unknown');
  return `invoice-pdfs/${tenantId}/${invoice._id}-${fingerprint(invoice)}.pdf`;
}

function pdfFilename(invoice) {
  return `${String(invoice?.invoiceNumber || 'invoice').replace(/[^\w.-]+/g, '_')}.pdf`;
}

function getBullmqRedis() {
  if (!bullmqRedis) {
    bullmqRedis = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
    });
    bullmqRedis.on('error', (error) => {
      logger.warn(`[invoicePdf] bullmq redis: ${error.message}`);
    });
  }
  return bullmqRedis;
}

function getPdfQueue() {
  if (pdfQueue) return pdfQueue;
  if (process.env.REDIS_ENABLED === 'false') return null;
  try {
    pdfQueue = new Queue(QUEUE_NAME, {
      connection: getBullmqRedis(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: { count: 50, age: 3600 },
        removeOnFail: { count: 100, age: 86400 },
      },
    });
    return pdfQueue;
  } catch (error) {
    logger.warn(`[invoicePdf] queue init failed: ${error.message}`);
    return null;
  }
}

async function readCached(invoice) {
  try {
    return await readUploadBuffer(cacheKey(invoice), { localBaseDir: PDF_DIR });
  } catch {
    return null;
  }
}

async function writeCached(invoice, buffer) {
  await saveUploadBuffer({
    buffer,
    key: cacheKey(invoice),
    contentType: 'application/pdf',
    publicUrlPath: `/uploads/${cacheKey(invoice)}`,
    localBaseDir: PDF_DIR,
  });
}

export async function getCachedInvoicePdfAttachment(invoice) {
  const cached = await readCached(invoice);
  if (!cached) return null;
  return {
    filename: pdfFilename(invoice),
    content: cached,
    contentType: 'application/pdf',
    size: cached.length,
    cached: true,
  };
}

export async function getOrBuildInvoicePdfAttachment({ invoice, tenant, customerName, language = 'bilingual' }) {
  const cached = await getCachedInvoicePdfAttachment(invoice);
  if (cached) return cached;

  const attachment = await buildInvoicePdfAttachment({ invoice, tenant, customerName, language });
  writeCached(invoice, attachment.content).catch((error) => {
    logger.warn(`[invoicePdf] cache write failed: ${error.message}`);
  });
  return { ...attachment, cached: false };
}

async function renderInvoicePdf(invoiceId) {
  const invoice = await Invoice.findById(invoiceId);
  if (!invoice) return;
  const tenant = await Tenant.findById(invoice.tenantId);
  if (!tenant) return;
  const customer = invoice.customerId
    ? await Customer.findOne({ _id: invoice.customerId, tenantId: invoice.tenantId }).select('name nameAr')
    : null;
  await getOrBuildInvoicePdfAttachment({
    invoice,
    tenant,
    customerName: customer?.name || customer?.nameAr || invoice?.buyer?.name || invoice?.buyer?.nameAr,
    language: 'bilingual',
  });
}

async function pump() {
  if (pumping) return;
  pumping = true;
  while (pending.length) {
    const invoiceId = pending.shift();
    queuedIds.delete(invoiceId);
    try {
      await renderInvoicePdf(invoiceId);
    } catch (error) {
      logger.warn(`[invoicePdf] background render failed for ${invoiceId}: ${error.message}`);
    }
  }
  pumping = false;
}

function enqueueLocal(id) {
  if (queuedIds.has(id)) return;
  queuedIds.add(id);
  pending.push(id);
  setImmediate(() => {
    pump().catch((error) => logger.warn(`[invoicePdf] queue: ${error.message}`));
  });
}

/** Pre-render off the request path. GET /pdf still works sync and hits this cache. */
export function enqueueInvoicePdf(invoiceId) {
  const id = invoiceId ? String(invoiceId) : '';
  if (!id) return;
  const queue = getPdfQueue();
  if (queue) {
    queue.add('render', { invoiceId: id }).catch((error) => {
      if (process.env.PDF_WORKER_DEDICATED === 'true') {
        logger.warn(`[invoicePdf] enqueue failed: ${error.message}`);
        return;
      }
      enqueueLocal(id);
    });
    return;
  }
  enqueueLocal(id);
}

/** Consume BullMQ jobs. Call from the dedicated worker, or in-process when not dedicated. */
export function startPdfQueueWorker() {
  if (pdfWorker) return;
  try {
    pdfWorker = new Worker(
      QUEUE_NAME,
      async (job) => {
        const invoiceId = job?.data?.invoiceId;
        if (!invoiceId) return;
        await renderInvoicePdf(invoiceId);
      },
      {
        connection: getBullmqRedis(),
        concurrency: Number(process.env.PDF_WORKER_CONCURRENCY || 1),
      }
    );
    pdfWorker.on('failed', (job, error) => {
      logger.warn(`[invoicePdf] job ${job?.id} failed: ${error.message}`);
    });
    logger.info('[invoicePdf] BullMQ worker listening');
  } catch (error) {
    logger.warn(`[invoicePdf] worker init failed: ${error.message}`);
  }
}

export async function closePdfQueue() {
  try {
    if (pdfWorker) await pdfWorker.close();
  } catch { /* ignore */ }
  try {
    if (pdfQueue) await pdfQueue.close();
  } catch { /* ignore */ }
  try {
    if (bullmqRedis) await bullmqRedis.quit();
  } catch { /* ignore */ }
  pdfWorker = null;
  pdfQueue = null;
  bullmqRedis = null;
}

/** API process: enqueue only when a dedicated worker is running. */
export function startInvoicePdfWorker() {
  getPdfQueue();
  if (process.env.PDF_WORKER_DEDICATED === 'true') {
    logger.info('[invoicePdf] dedicated worker mode — this process only enqueues');
    return;
  }
  if (isRedisReady() || process.env.REDIS_ENABLED !== 'false') {
    startPdfQueueWorker();
  }
}
