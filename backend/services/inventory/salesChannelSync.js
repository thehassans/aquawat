import InvSalesChannel from '../../models/inventory/InvSalesChannel.js';
import InvQuant from '../../models/inventory/InvQuant.js';
import Product from '../../models/Product.js';
import { toObjectId } from '../../models/inventory/common.js';
import { InventoryValidationError } from './errors.js';

/**
 * B.8 — minimal sales-channel sync (stub connectors).
 * When credentials are configured, platform-specific fetch/push runs here.
 */
export async function syncSalesChannel(tenantId, channelId, { userId = null } = {}) {
  const tid = toObjectId(tenantId);
  const channel = await InvSalesChannel.findOne({ _id: channelId, tenantId: tid });
  if (!channel) throw new InventoryValidationError('Channel not found', 'CHANNEL_NOT_FOUND');

  const result = {
    platform: channel.platform,
    ordersFetched: 0,
    ordersCreated: 0,
    stockPushed: 0,
    skipped: true,
    message: 'Connector stub — add credentials to enable live sync',
  };

  try {
    if (channel.syncInbound && channel.credentialsEnc) {
      result.ordersFetched = await fetchPlatformOrders(channel);
      result.skipped = false;
    }

    if (channel.syncOutbound) {
      result.stockPushed = await pushStockLevels(tid, channel);
      result.skipped = false;
    }

    channel.lastSyncAt = new Date();
    channel.lastError = null;
    channel.status = result.skipped ? 'paused' : 'active';
    if (userId) channel.updatedBy = userId;
    await channel.save();
  } catch (err) {
    channel.lastError = err?.message || String(err);
    channel.status = 'error';
    await channel.save();
    throw err;
  }

  return { channel: channel.toObject(), ...result };
}

async function fetchPlatformOrders(channel) {
  // Platform OAuth/API hooks land here (Salla, Shopify, Zid, …)
  if (!channel.credentialsEnc) return 0;
  switch (channel.platform) {
    case 'salla':
    case 'shopify':
    case 'zid':
    case 'woocommerce':
      return 0;
    default:
      return 0;
  }
}

async function pushStockLevels(tenantId, channel) {
  const filter = { tenantId, quantity: { $ne: '0' } };
  if (channel.warehouseId) filter.warehouseId = channel.warehouseId;

  const quants = await InvQuant.find(filter).select('productId quantity').limit(500).lean();
  if (!quants.length) return 0;

  const productIds = [...new Set(quants.map((q) => String(q.productId)))];
  const products = await Product.find({ _id: { $in: productIds } }).select('sku externalId').lean();
  const skuById = new Map(products.map((p) => [String(p._id), p.sku]));

  let pushed = 0;
  for (const q of quants) {
    const sku = skuById.get(String(q.productId));
    if (!sku) continue;
    const qty = Math.max(0, Number(q.quantity || 0) - Number(channel.stockBuffer || 0));
    if (channel.credentialsEnc) {
      // POST qty to marketplace API using sku
      pushed += 1;
    } else {
      pushed += 1; // dry-run count for stub
    }
    void qty;
  }
  return pushed;
}
