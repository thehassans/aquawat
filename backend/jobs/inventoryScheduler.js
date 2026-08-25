/**
 * Optional inventory scheduler cron.
 * Enable with STOCK_SCHEDULER_CRON=1 and InvSettings.schedulerEnabled per tenant.
 */
import cron from 'node-cron';
import InvSettings from '../models/inventory/InvSettings.js';
import { runScheduler } from '../services/inventory/scheduler.js';

export function startInventoryScheduler() {
  if (process.env.STOCK_SCHEDULER_CRON !== '1') return;

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
