import { randomUUID } from 'crypto';
import { Queue, Worker } from 'bullmq';
import Redis from 'ioredis';
import logger from '../../utils/logger.js';
import { processInventoryJob } from './jobHandlers.js';

const QUEUE_NAME = 'inventory-jobs';
let invQueue = null;
let invWorker = null;
let bullmqRedis = null;
const localPending = [];
let localPumping = false;

function getBullmqRedis() {
  if (!bullmqRedis) {
    bullmqRedis = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
    });
    bullmqRedis.on('error', (error) => {
      logger.warn(`[inv-queue] redis: ${error.message}`);
    });
  }
  return bullmqRedis;
}

function getQueue() {
  if (invQueue) return invQueue;
  if (process.env.REDIS_ENABLED === 'false') return null;
  try {
    invQueue = new Queue(QUEUE_NAME, {
      connection: getBullmqRedis(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: { count: 100, age: 86400 },
        removeOnFail: { count: 200, age: 7 * 86400 },
      },
    });
    return invQueue;
  } catch (error) {
    logger.warn(`[inv-queue] init failed: ${error.message}`);
    return null;
  }
}

async function pumpLocal() {
  if (localPumping) return;
  localPumping = true;
  try {
    while (localPending.length) {
      const job = localPending.shift();
      try {
        await processInventoryJob(job);
      } catch (err) {
        logger.warn(`[inv-queue] local job failed: ${err.message}`);
      }
    }
  } finally {
    localPumping = false;
  }
}

/**
 * Enqueue an inventory background job.
 * Falls back to in-process setImmediate when Redis/BullMQ unavailable.
 * @returns {{ queued: boolean, mode: 'bullmq'|'inline', jobId: string }}
 */
export async function enqueueInventoryJob({
  jobType,
  tenantId,
  userId = null,
  trigger = 'api',
  payload = {},
  jobId,
} = {}) {
  const id = jobId || `${jobType}:${tenantId}:${randomUUID().slice(0, 8)}`;
  const data = {
    jobType,
    tenantId: String(tenantId),
    userId: userId ? String(userId) : null,
    trigger,
    payload,
  };

  const queue = getQueue();
  if (queue) {
    try {
      await queue.add(jobType, data, {
        jobId: id,
        // integrity/scheduler: avoid stacking identical tenant jobs
        ...(jobType === 'scheduler' || jobType === 'integrity'
          ? { jobId: `${jobType}:${tenantId}` }
          : {}),
      });
      return { queued: true, mode: 'bullmq', jobId: id };
    } catch (err) {
      logger.warn(`[inv-queue] enqueue failed, inline: ${err.message}`);
    }
  }

  localPending.push(data);
  setImmediate(() => { pumpLocal(); });
  return { queued: true, mode: 'inline', jobId: id };
}

export function startInventoryQueueWorker() {
  if (invWorker) return;
  if (process.env.REDIS_ENABLED === 'false') {
    logger.info('[inv-queue] Redis disabled — inline fallback only');
    return;
  }
  try {
    invWorker = new Worker(
      QUEUE_NAME,
      async (job) => processInventoryJob(job.data || job),
      {
        connection: getBullmqRedis(),
        concurrency: Number(process.env.INV_WORKER_CONCURRENCY || 2),
      },
    );
    invWorker.on('failed', (job, error) => {
      logger.warn(`[inv-queue] job ${job?.id} failed: ${error.message}`);
    });
    logger.info('[inv-queue] BullMQ worker listening');
  } catch (error) {
    logger.warn(`[inv-queue] worker init failed: ${error.message}`);
  }
}

export async function inventoryQueueStats() {
  const queue = getQueue();
  if (!queue) return { mode: 'inline', waiting: localPending.length };
  try {
    const [waiting, active, completed, failed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
    ]);
    return { mode: 'bullmq', waiting, active, completed, failed };
  } catch {
    return { mode: 'inline', waiting: localPending.length };
  }
}
