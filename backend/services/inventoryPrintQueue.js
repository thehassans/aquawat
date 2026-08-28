import { Queue, Worker } from 'bullmq';
import Redis from 'ioredis';
import logger from '../utils/logger.js';

const QUEUE_NAME = 'inventory-print';
let printQueue = null;
let printWorker = null;
let bullmqRedis = null;

function getBullmqRedis() {
  if (!bullmqRedis) {
    bullmqRedis = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
    });
    bullmqRedis.on('error', (error) => {
      logger.warn(`[inventoryPrint] bullmq redis: ${error.message}`);
    });
  }
  return bullmqRedis;
}

function getPrintQueue() {
  if (printQueue) return printQueue;
  if (process.env.REDIS_ENABLED === 'false') return null;
  try {
    printQueue = new Queue(QUEUE_NAME, {
      connection: getBullmqRedis(),
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: 'exponential', delay: 1500 },
        removeOnComplete: { count: 40, age: 3600 },
        removeOnFail: { count: 80, age: 86400 },
      },
    });
    return printQueue;
  } catch (error) {
    logger.warn(`[inventoryPrint] queue init failed: ${error.message}`);
    return null;
  }
}

async function processPrintJob({ tenantId, printJobId, payload }) {
  const { renderInventoryPdf } = await import('./inventory/invPrint.js');
  const InvPrintJob = (await import('../models/inventory/InvPrintJob.js')).default;

  const buf = await renderInventoryPdf(tenantId, payload);
  if (printJobId) {
    await InvPrintJob.updateOne(
      { _id: printJobId },
      {
        $set: {
          status: 'done',
          filename: `${payload.layout || 'document'}.pdf`,
          bytes: buf.length,
        },
      },
    ).catch(() => {});
  }
  return { bytes: buf.length };
}

/** Enqueue inventory PDF generation (BullMQ). Returns job id or null. */
export async function enqueueInventoryPrint({ tenantId, printJobId, payload }) {
  const queue = getPrintQueue();
  if (!queue) return null;
  const job = await queue.add('render', { tenantId, printJobId, payload });
  return job.id;
}

export function startInventoryPrintWorker() {
  if (printWorker) return;
  if (process.env.REDIS_ENABLED === 'false') return;
  try {
    printWorker = new Worker(
      QUEUE_NAME,
      async (job) => processPrintJob(job.data),
      {
        connection: getBullmqRedis(),
        concurrency: Number(process.env.INVENTORY_PRINT_CONCURRENCY || 1),
      },
    );
    printWorker.on('failed', (job, err) => {
      logger.warn(`[inventoryPrint] job ${job?.id} failed: ${err.message}`);
    });
    logger.info('[inventoryPrint] BullMQ worker listening');
  } catch (error) {
    logger.warn(`[inventoryPrint] worker start failed: ${error.message}`);
  }
}

export async function closeInventoryPrintQueue() {
  try {
    if (printWorker) await printWorker.close();
    if (printQueue) await printQueue.close();
    if (bullmqRedis) await bullmqRedis.quit();
  } catch { /* ignore */ }
  printWorker = null;
  printQueue = null;
  bullmqRedis = null;
}
