import SalesSettings from '../models/sales/SalesSettings.js';
import InvSalesChannel from '../models/inventory/InvSalesChannel.js';
import logger from '../utils/logger.js';

/**
 * Amazon Seller Central order import — runs for tenants with amazonSyncEnabled.
 */
export async function runAmazonMarketplaceSync() {
  const settingsRows = await SalesSettings.find({ amazonSyncEnabled: true }).select('tenantId').lean();
  for (const row of settingsRows) {
    const channels = await InvSalesChannel.find({
      tenantId: row.tenantId,
      platform: { $in: ['amazon', 'amazon_seller'] },
      isActive: true,
    }).select('_id').lean();

    for (const ch of channels) {
      try {
        const { syncSalesChannel } = await import('./inventory/salesChannelSync.js');
        await syncSalesChannel(row.tenantId, ch._id);
      } catch (err) {
        logger.warn(`[amazon-sync] tenant ${row.tenantId} channel ${ch._id}: ${err.message}`);
      }
    }
  }
}

export default runAmazonMarketplaceSync;
