/**
 * Optional inventory cron jobs — enqueue via BullMQ (inline fallback).
 * - Replenishment: STOCK_SCHEDULER_CRON=1
 * - Integrity: STOCK_INTEGRITY_CRON=1 (Sunday 03:00)
 * - Expiry + cyclic count: STOCK_MAINT_CRON=1 (daily 04:00)
 */
import cron from 'node-cron';
import InvSettings from '../models/inventory/InvSettings.js';
import { enqueueInventoryJob } from '../services/inventory/inventoryQueue.js';

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
            await enqueueInventoryJob({
              jobType: 'scheduler',
              tenantId: s.tenantId,
              trigger: 'cron',
            });
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
            await enqueueInventoryJob({
              jobType: 'integrity',
              tenantId: s.tenantId,
              trigger: 'cron',
            });
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

  if (process.env.STOCK_MAINT_CRON === '1') {
    cron.schedule('0 4 * * *', async () => {
      try {
        const settings = await InvSettings.find({ engineEnabled: true })
          .select('tenantId')
          .lean();
        for (const s of settings) {
          for (const jobType of ['expiry_alerts', 'cyclic_count', 'cache_reconcile', 'reservation_retry']) {
            try {
              await enqueueInventoryJob({
                jobType,
                tenantId: s.tenantId,
                trigger: 'cron',
                payload: jobType === 'cache_reconcile' ? { repair: true } : {},
              });
            } catch (err) {
              console.error(`[inv-maint:${jobType}]`, String(s.tenantId), err.message);
            }
          }
        }
      } catch (err) {
        console.error('[inv-maint] fatal', err.message);
      }
    });
    console.log('[inv-maint] cron registered (04:00 daily, STOCK_MAINT_CRON=1)');
  }
}
