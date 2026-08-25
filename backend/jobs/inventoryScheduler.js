/**
 * Optional inventory cron jobs.
 * - Replenishment: STOCK_SCHEDULER_CRON=1 + InvSettings.schedulerEnabled
 * - Integrity: STOCK_INTEGRITY_CRON=1 (weekly Sunday 03:00) for engine-enabled tenants
 */
import cron from 'node-cron';
import InvSettings from '../models/inventory/InvSettings.js';
import { runScheduler } from '../services/inventory/scheduler.js';
import { runIntegrityJob } from '../services/inventory/jobRunner.js';

export function startInventoryScheduler() {
  if (process.env.STOCK_SCHEDULER_CRON === '1') {
    cron.schedule('0 2 * * *', async () => {
      try {
        const settings = await InvSettings.find({
          schedulerEnabled: true,
          engineEnabled: true,
        }).select('tenantId').lean();

        for (const s of settings) {
          try {
            await runScheduler(s.tenantId, { trigger: 'cron' });
          } catch (err) {
            console.error('[inv-scheduler]', String(s.tenantId), err.message);
          }
        }
      } catch (err) {
        console.error('[inv-scheduler] fatal', err.message);
      }
    });
    console.log('[inv-scheduler] cron registered (02:00 daily, STOCK_SCHEDULER_CRON=1)');
  }

  if (process.env.STOCK_INTEGRITY_CRON === '1') {
    cron.schedule('0 3 * * 0', async () => {
      try {
        const settings = await InvSettings.find({ engineEnabled: true })
          .select('tenantId')
          .lean();
        for (const s of settings) {
          try {
            await runIntegrityJob(s.tenantId, { trigger: 'cron' });
          } catch (err) {
            console.error('[inv-integrity]', String(s.tenantId), err.message);
          }
        }
      } catch (err) {
        console.error('[inv-integrity] fatal', err.message);
      }
    });
    console.log('[inv-integrity] cron registered (Sun 03:00, STOCK_INTEGRITY_CRON=1)');
  }
}
