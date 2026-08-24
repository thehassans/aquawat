/**
 * Nightly stock scheduler cron (optional).
 * Enable via StockSettings.schedulerEnabled = true per tenant.
 * Wired from server bootstrap when STOCK_SCHEDULER_CRON=1.
 */
import cron from 'node-cron';
import StockSettings from '../models/stock/StockSettings.js';
import { runScheduler } from '../services/stock/scheduler.js';

let started = false;

export function startStockSchedulerCron() {
  if (started) return;
  if (process.env.STOCK_SCHEDULER_CRON !== '1') return;

  // Default: 02:00 every night
  cron.schedule('0 2 * * *', async () => {
    try {
      const settings = await StockSettings.find({ schedulerEnabled: true, engineEnabled: true }).select('tenantId').lean();
      for (const s of settings) {
        try {
          await runScheduler(s.tenantId, null, { trigger: 'cron' });
        } catch (err) {
          console.error('[stock-scheduler]', String(s.tenantId), err.message);
        }
      }
    } catch (err) {
      console.error('[stock-scheduler] fatal', err.message);
    }
  });

  started = true;
  console.log('[stock-scheduler] cron registered (02:00 daily, STOCK_SCHEDULER_CRON=1)');
}
