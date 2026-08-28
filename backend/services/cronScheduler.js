import cron from 'node-cron';
import { checkIqamaExpiry } from '../jobs/iqamaChecker.js';
import { processScheduledReports } from '../jobs/reportScheduleJob.js';
import { syncZatcaInvoices } from '../jobs/zatcaSync.js';
import { fetchImapEmails } from '../jobs/imapFetcher.js';
import { startBoutiqueReminderJobs } from '../jobs/boutiqueReminderJob.js';
import { checkRestaurantAutoStatus } from '../jobs/restaurantAutoStatusJob.js';
import { markOverdueInvoices } from '../jobs/invoiceOverdueJob.js';
import { processQueue as processZatcaQueue } from '../services/zatcaQueueProcessor.js';
import { runZatcaMonitoring, runCertExpiryCheck } from '../jobs/zatcaMonitoringJob.js';
import { evaluateSloAndAlert } from '../jobs/sloAlertJob.js';
import { cacheSet, cacheSetNx, isRedisReady } from '../lib/redis.js';
import logger from '../utils/logger.js';

let jobsStarted = false;

const WORKER_ID = Number(process.env.WORKER_ID || 1);
const CRON_WORKER_ENV = process.env.CRON_WORKER;
const DISABLE_CRON = CRON_WORKER_ENV === '0';
const FORCE_CRON_WORKER = CRON_WORKER_ENV === '1' || process.env.NODE_ENV === 'development';

export function isCronJobsStarted() {
  return jobsStarted;
}

export async function startCronJobs({ dbReady = () => true } = {}) {
  if (jobsStarted) return;

  if (DISABLE_CRON) {
    logger.info(`[cron] Worker ${WORKER_ID} — skipping (CRON_WORKER=0)`);
    return;
  }

  let shouldRun = FORCE_CRON_WORKER;
  if (!shouldRun) {
    const acquired = await cacheSetNx('cron:leader', { workerId: WORKER_ID, at: Date.now() }, 90);
    if (acquired) {
      shouldRun = true;
      setInterval(() => {
        cacheSet('cron:leader', { workerId: WORKER_ID, at: Date.now() }, 90).catch(() => {});
      }, 30_000).unref();
    } else if (!isRedisReady() && WORKER_ID === 1) {
      shouldRun = true;
    } else {
      logger.info(`[cron] Worker ${WORKER_ID} — waiting for leader lock`);
      setInterval(async () => {
        if (jobsStarted) return;
        const got = await cacheSetNx('cron:leader', { workerId: WORKER_ID, at: Date.now() }, 90);
        if (got) startCronJobs({ dbReady });
      }, 60_000).unref();
      return;
    }
  }

  if (!shouldRun) return;

  jobsStarted = true;
  logger.info(`[cron] Worker ${WORKER_ID} — starting scheduled jobs`);

  cron.schedule('0 8 * * *', () => {
    logger.info('[cron] Iqama expiry check');
    checkIqamaExpiry();
  });

  cron.schedule('0 */6 * * *', () => {
    logger.info('[cron] ZATCA B2C invoice sync');
    syncZatcaInvoices();
  });

  cron.schedule('*/2 * * * *', async () => {
    logger.info('[cron] ZATCA queue processor');
    await processZatcaQueue(25);
  });

  cron.schedule('0 2 * * *', async () => {
    logger.info('[cron] ZATCA nightly monitoring');
    await runZatcaMonitoring();
  });

  cron.schedule('0 8 * * *', async () => {
    logger.info('[cron] ZATCA certificate expiry check');
    await runCertExpiryCheck();
  });

  cron.schedule('*/15 * * * *', async () => {
    logger.info('[cron] Scheduled reports');
    await processScheduledReports();
  });

  cron.schedule('* * * * *', async () => {
    await fetchImapEmails();
  });

  startBoutiqueReminderJobs();

  cron.schedule('* * * * *', async () => {
    await checkRestaurantAutoStatus();
  });

  cron.schedule('5 0 * * *', async () => {
    logger.info('[cron] Mark overdue invoices');
    await markOverdueInvoices();
  }, { timezone: 'Asia/Riyadh' });

  cron.schedule('*/2 * * * *', async () => {
    await evaluateSloAndAlert({
      dbReady: dbReady(),
      redisReady: isRedisReady(),
      redisRequired: process.env.REDIS_ENABLED !== 'false',
    });
  });

  if (process.env.STOCK_SCHEDULER_CRON === '1') {
    const { startInventoryScheduler } = await import('../jobs/inventoryScheduler.js');
    startInventoryScheduler();
  }
}
