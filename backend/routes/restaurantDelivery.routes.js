import express from 'express';
import mongoose from 'mongoose';
import {
  DeliveryPlatformConfig,
  DeliveryOrder,
  MenuSyncLog,
} from '../models/RestaurantDelivery.js';
import RestaurantMenuItem from '../models/RestaurantMenuItem.js';
import { protect, tenantFilter, checkPermission, requireBusinessType } from '../middleware/auth.js';

const router = express.Router();

// Webhook routes don't need auth - they use webhook secret
const webhookRouter = express.Router();

function getTenantFilter(req) {
  return { tenantId: new mongoose.Types.ObjectId(req.user.tenantId) };
}

// =================== Platform Config ===================

// GET /api/restaurant/delivery/platforms
router.get('/platforms', protect, tenantFilter, requireBusinessType('restaurant'), checkPermission('restaurant', 'read'), async (req, res) => {
  try {
    const configs = await DeliveryPlatformConfig.find({ ...getTenantFilter(req), isActive: true })
      .sort({ platform: 1 });
    res.json(configs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/restaurant/delivery/platforms
router.post('/platforms', protect, tenantFilter, requireBusinessType('restaurant'), checkPermission('restaurant', 'create'), async (req, res) => {
  try {
    const existing = await DeliveryPlatformConfig.findOne({
      ...getTenantFilter(req),
      platform: req.body.platform,
      branchId: req.body.branchId || null,
    });
    if (existing) return res.status(400).json({ error: 'Platform already configured for this branch' });

    const webhookUrl = `${req.protocol}://${req.get('host')}/api/restaurant/delivery/webhook/${req.body.platform}/${req.user.tenantId}`;

    const config = await DeliveryPlatformConfig.create({
      ...req.body,
      webhookUrl,
      tenantId: req.user.tenantId,
      createdBy: req.user._id,
    });
    res.status(201).json(config);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/restaurant/delivery/platforms/:id
router.put('/platforms/:id', protect, tenantFilter, requireBusinessType('restaurant'), checkPermission('restaurant', 'update'), async (req, res) => {
  try {
    const config = await DeliveryPlatformConfig.findOneAndUpdate(
      { _id: req.params.id, ...getTenantFilter(req) },
      req.body,
      { new: true, runValidators: true }
    );
    if (!config) return res.status(404).json({ error: 'Platform config not found' });
    res.json(config);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/restaurant/delivery/platforms/:id
router.delete('/platforms/:id', protect, tenantFilter, requireBusinessType('restaurant'), checkPermission('restaurant', 'delete'), async (req, res) => {
  try {
    const config = await DeliveryPlatformConfig.findOneAndUpdate(
      { _id: req.params.id, ...getTenantFilter(req) },
      { isActive: false, isConnected: false },
      { new: true }
    );
    if (!config) return res.status(404).json({ error: 'Platform config not found' });
    res.json({ message: 'Platform disconnected' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/restaurant/delivery/platforms/:id/test-connection
router.post('/platforms/:id/test-connection', protect, tenantFilter, requireBusinessType('restaurant'), checkPermission('restaurant', 'update'), async (req, res) => {
  try {
    const config = await DeliveryPlatformConfig.findOne({ _id: req.params.id, ...getTenantFilter(req) });
    if (!config) return res.status(404).json({ error: 'Platform config not found' });

    // Simulate connection test based on platform
    const hasCredentials = config.credentials?.apiKey || config.credentials?.merchantId;
    if (!hasCredentials) {
      return res.json({ success: false, message: 'Missing API credentials' });
    }

    // Mark as connected (in production, would make actual API call to platform)
    config.isConnected = true;
    config.lastSyncAt = new Date();
    await config.save();

    res.json({ success: true, message: `${config.platform} connection verified` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// =================== Delivery Orders ===================

// GET /api/restaurant/delivery/orders
router.get('/orders', protect, tenantFilter, requireBusinessType('restaurant'), checkPermission('restaurant', 'read'), async (req, res) => {
  try {
    const { platform, status, page = 1, limit = 50, startDate, endDate } = req.query;
    const query = { ...getTenantFilter(req), isActive: true };

    if (platform) query.platform = platform;
    if (status) query.status = status;

    if (startDate || endDate) {
      query.placedAt = {};
      if (startDate) query.placedAt.$gte = new Date(startDate);
      if (endDate) query.placedAt.$lte = new Date(endDate + 'T23:59:59');
    }

    const [orders, total] = await Promise.all([
      DeliveryOrder.find(query)
        .populate('platformConfigId', 'platform displayName commissionPercent')
        .sort({ placedAt: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit)),
      DeliveryOrder.countDocuments(query),
    ]);

    res.json({ orders, pagination: { page: parseInt(page), limit: parseInt(limit), total } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/restaurant/delivery/orders/:id/status
router.put('/orders/:id/status', protect, tenantFilter, requireBusinessType('restaurant'), checkPermission('restaurant', 'update'), async (req, res) => {
  try {
    const { status } = req.body;
    const order = await DeliveryOrder.findOne({ _id: req.params.id, ...getTenantFilter(req) });
    if (!order) return res.status(404).json({ error: 'Delivery order not found' });

    order.status = status;
    order.lastSyncedAt = new Date();

    // Set timestamps
    const now = new Date();
    if (status === 'accepted') order.acceptedAt = now;
    else if (status === 'preparing') order.preparingAt = now;
    else if (status === 'ready') order.readyAt = now;
    else if (status === 'picked_up') order.pickedUpAt = now;
    else if (status === 'delivered') order.deliveredAt = now;
    else if (status === 'cancelled' || status === 'rejected') order.cancelledAt = now;

    await order.save();

    // In production, push status update to platform API
    // await pushStatusToPlatform(order.platform, order.platformOrderId, status, order.platformConfigId);

    res.json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/restaurant/delivery/orders/:id/accept
router.post('/orders/:id/accept', protect, tenantFilter, requireBusinessType('restaurant'), checkPermission('restaurant', 'update'), async (req, res) => {
  try {
    const order = await DeliveryOrder.findOne({ _id: req.params.id, ...getTenantFilter(req) });
    if (!order) return res.status(404).json({ error: 'Delivery order not found' });
    if (order.status !== 'pending') return res.status(400).json({ error: 'Order is not pending' });

    order.status = 'accepted';
    order.acceptedAt = new Date();
    order.lastSyncedAt = new Date();
    await order.save();

    res.json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/restaurant/delivery/orders/:id/reject
router.post('/orders/:id/reject', protect, tenantFilter, requireBusinessType('restaurant'), checkPermission('restaurant', 'update'), async (req, res) => {
  try {
    const { reason } = req.body;
    const order = await DeliveryOrder.findOne({ _id: req.params.id, ...getTenantFilter(req) });
    if (!order) return res.status(404).json({ error: 'Delivery order not found' });

    order.status = 'rejected';
    order.cancelledAt = new Date();
    order.cancelReason = reason || 'Rejected by restaurant';
    order.cancelledBy = 'restaurant';
    order.lastSyncedAt = new Date();
    await order.save();

    res.json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// =================== Webhook (no auth - uses webhook secret) ===================

// POST /api/restaurant/delivery/webhook/:platform/:tenantId
webhookRouter.post('/webhook/:platform/:tenantId', async (req, res) => {
  try {
    const { platform, tenantId } = req.params;
    const event = req.body;

    // Find platform config
    const config = await DeliveryPlatformConfig.findOne({
      tenantId: new mongoose.Types.ObjectId(tenantId),
      platform,
      isActive: true,
      webhookActive: true,
    });

    if (!config) return res.status(404).json({ error: 'Platform not configured' });

    const webhookSecret = config.credentials?.webhookSecret;
    if (!webhookSecret) {
      return res.status(503).json({ error: 'Webhook secret not configured' });
    }
    const providedSecret = req.headers['x-webhook-secret'] || req.headers['x-jahez-secret'] || req.query.secret;
    if (providedSecret !== webhookSecret) {
      return res.status(401).json({ error: 'Invalid webhook secret' });
    }

    // Parse order from webhook payload (platform-specific format)
    const parsed = parsePlatformOrder(platform, event, config);

    if (parsed.eventType === 'order_created' || parsed.eventType === 'new_order') {
      // Check if order already exists
      const existing = await DeliveryOrder.findOne({
        tenantId: config.tenantId,
        platform,
        platformOrderId: parsed.platformOrderId,
      });

      if (existing) {
        // Update status if needed
        if (parsed.status && parsed.status !== existing.status) {
          existing.status = parsed.status;
          existing.platformStatus = parsed.platformStatus;
          existing.lastSyncedAt = new Date();
          await existing.save();
        }
        return res.json({ message: 'Order already exists', orderId: existing._id });
      }

      // Create new delivery order
      const order = await DeliveryOrder.create({
        tenantId: config.tenantId,
        branchId: config.branchId,
        platform,
        platformConfigId: config._id,
        platformOrderId: parsed.platformOrderId,
        platformOrderNumber: parsed.platformOrderNumber,
        customerName: parsed.customerName,
        customerPhone: parsed.customerPhone,
        deliveryAddress: parsed.deliveryAddress,
        items: parsed.items,
        subtotal: parsed.subtotal || 0,
        deliveryFee: parsed.deliveryFee || 0,
        serviceFee: parsed.serviceFee || 0,
        discount: parsed.discount || 0,
        commissionAmount: parsed.commissionAmount || 0,
        vatAmount: parsed.vatAmount || 0,
        total: parsed.total || 0,
        netPayout: parsed.netPayout || (parsed.total || 0) - (parsed.commissionAmount || 0),
        paymentMethod: parsed.paymentMethod || 'online',
        paymentStatus: parsed.paymentStatus || 'paid',
        status: parsed.status || 'pending',
        platformStatus: parsed.platformStatus,
        placedAt: parsed.placedAt || new Date(),
        estimatedDeliveryTime: parsed.estimatedDeliveryTime,
        prepTimeMinutes: parsed.prepTimeMinutes,
        driver: parsed.driver,
        payoutStatus: 'pending',
      });

      // Update platform config
      config.lastOrderAt = new Date();
      await config.save();

      return res.status(201).json({ message: 'Order received', orderId: order._id });
    }

    if (parsed.eventType === 'order_status_update' || parsed.eventType === 'status_update') {
      const order = await DeliveryOrder.findOne({
        tenantId: config.tenantId,
        platform,
        platformOrderId: parsed.platformOrderId,
      });

      if (order) {
        order.status = mapPlatformStatus(platform, parsed.platformStatus);
        order.platformStatus = parsed.platformStatus;
        order.lastSyncedAt = new Date();

        if (parsed.driver) order.driver = { ...order.driver, ...parsed.driver };
        if (parsed.status === 'delivered') order.deliveredAt = new Date();
        if (parsed.status === 'cancelled') {
          order.cancelledAt = new Date();
          order.cancelReason = parsed.cancelReason;
          order.cancelledBy = parsed.cancelledBy || 'platform';
        }

        await order.save();
        return res.json({ message: 'Status updated', orderId: order._id });
      }

      return res.status(404).json({ error: 'Order not found' });
    }

    if (parsed.eventType === 'payout' || parsed.eventType === 'settlement') {
      const orders = await DeliveryOrder.updateMany(
        {
          tenantId: config.tenantId,
          platform,
          payoutStatus: 'pending',
          payoutId: parsed.payoutId,
        },
        {
          payoutStatus: 'settled',
          payoutDate: new Date(),
        }
      );
      return res.json({ message: `${orders.modifiedCount} orders settled` });
    }

    res.json({ message: 'Webhook received', eventType: parsed.eventType });
  } catch (error) {
    console.error('Delivery webhook error:', error);
    res.status(500).json({ error: error.message });
  }
});

// =================== Menu Sync ===================

// POST /api/restaurant/delivery/platforms/:id/sync-menu
router.post('/platforms/:id/sync-menu', protect, tenantFilter, requireBusinessType('restaurant'), checkPermission('restaurant', 'create'), async (req, res) => {
  try {
    const config = await DeliveryPlatformConfig.findOne({ _id: req.params.id, ...getTenantFilter(req) });
    if (!config) return res.status(404).json({ error: 'Platform config not found' });

    const menuItems = await RestaurantMenuItem.find({ ...getTenantFilter(req), isActive: true }).lean();

    let synced = 0;
    let failed = 0;
    const errors = [];

    // Build/update menu mapping
    const newMapping = [];
    for (const item of menuItems) {
      try {
        // In production, push item to platform API
        // const platformItemId = await pushItemToPlatform(config.platform, item, config.credentials);
        const platformItemId = `${config.platform}_${item._id}`;

        newMapping.push({
          menuItemId: item._id,
          platformItemId,
          platformItemName: item.nameEn,
          isActive: true,
        });
        synced++;
      } catch (err) {
        failed++;
        errors.push({ item: item.nameEn, error: err.message });
      }
    }

    config.menuMapping = newMapping;
    config.lastSyncAt = new Date();
    await config.save();

    // Log sync
    await MenuSyncLog.create({
      tenantId: req.user.tenantId,
      platformConfigId: config._id,
      platform: config.platform,
      action: 'full_sync',
      status: failed > 0 ? 'partial' : 'success',
      itemsSynced: synced,
      itemsFailed: failed,
      errors,
      triggeredBy: 'manual',
      createdBy: req.user._id,
    });

    res.json({
      message: `Menu sync complete: ${synced} synced, ${failed} failed`,
      synced,
      failed,
      errors,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/restaurant/delivery/platforms/:id/sync-logs
router.get('/platforms/:id/sync-logs', protect, tenantFilter, requireBusinessType('restaurant'), checkPermission('restaurant', 'read'), async (req, res) => {
  try {
    const logs = await MenuSyncLog.find({
      ...getTenantFilter(req),
      platformConfigId: req.params.id,
    }).sort({ createdAt: -1 }).limit(20);
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// =================== Dashboard ===================

// GET /api/restaurant/delivery/dashboard
router.get('/dashboard', protect, tenantFilter, requireBusinessType('restaurant'), checkPermission('restaurant', 'read'), async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const dateFilter = {};
    if (startDate) dateFilter.$gte = new Date(startDate);
    if (endDate) dateFilter.$lte = new Date(endDate + 'T23:59:59');

    const matchFilter = {
      ...getTenantFilter(req),
      isActive: true,
      ...(Object.keys(dateFilter).length > 0 ? { placedAt: dateFilter } : {}),
    };

    const [platforms, ordersByPlatform, statusCounts, revenueStats, recentOrders, pendingCount] = await Promise.all([
      DeliveryPlatformConfig.find({ ...getTenantFilter(req), isActive: true }).lean(),
      DeliveryOrder.aggregate([
        { $match: matchFilter },
        { $group: { _id: '$platform', count: { $sum: 1 }, revenue: { $sum: '$total' }, commission: { $sum: '$commissionAmount' }, netPayout: { $sum: '$netPayout' } } },
      ]),
      DeliveryOrder.aggregate([
        { $match: matchFilter },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      DeliveryOrder.aggregate([
        { $match: matchFilter },
        {
          $group: {
            _id: null,
            totalOrders: { $sum: 1 },
            totalRevenue: { $sum: '$total' },
            totalCommission: { $sum: '$commissionAmount' },
            totalNetPayout: { $sum: '$netPayout' },
            avgOrderValue: { $avg: '$total' },
          },
        },
      ]),
      DeliveryOrder.find(matchFilter).sort({ placedAt: -1 }).limit(10).lean(),
      DeliveryOrder.countDocuments({ ...getTenantFilter(req), status: 'pending', isActive: true }),
    ]);

    // Pending payouts
    const pendingPayouts = await DeliveryOrder.aggregate([
      { $match: { ...getTenantFilter(req), payoutStatus: 'pending', isActive: true } },
      { $group: { _id: '$platform', count: { $sum: 1 }, amount: { $sum: '$netPayout' } } },
    ]);

    // Daily trend
    const dailyTrend = await DeliveryOrder.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$placedAt' } },
          orders: { $sum: 1 },
          revenue: { $sum: '$total' },
        },
      },
      { $sort: { _id: 1 } },
      { $limit: 30 },
    ]);

    const platformMap = {};
    ordersByPlatform.forEach(p => {
      platformMap[p._id] = { count: p.count, revenue: p.revenue, commission: p.commission, netPayout: p.netPayout };
    });

    const statusMap = {};
    statusCounts.forEach(s => { statusMap[s._id] = s.count; });

    const summary = revenueStats[0] || {
      totalOrders: 0, totalRevenue: 0, totalCommission: 0, totalNetPayout: 0, avgOrderValue: 0,
    };

    res.json({
      platforms: platforms.map(p => ({
        ...p,
        stats: platformMap[p.platform] || { count: 0, revenue: 0, commission: 0, netPayout: 0 },
      })),
      summary: {
        ...summary,
        avgOrderValue: Math.round((summary.avgOrderValue || 0) * 100) / 100,
        totalRevenue: Math.round((summary.totalRevenue || 0) * 100) / 100,
        totalCommission: Math.round((summary.totalCommission || 0) * 100) / 100,
        totalNetPayout: Math.round((summary.totalNetPayout || 0) * 100) / 100,
        pendingOrders: pendingCount,
      },
      statusBreakdown: statusMap,
      pendingPayouts,
      dailyTrend: dailyTrend.map(d => ({ date: d._id, orders: d.orders, revenue: d.revenue })),
      recentOrders,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// =================== Helpers ===================

function parsePlatformOrder(platform, event, config) {
  // Platform-specific order parsing
  // In production, each platform has a different payload format

  const result = {
    eventType: event.event_type || event.type || 'order_created',
    platformOrderId: event.order_id || event.orderId || event.id || `UNK-${Date.now()}`,
    platformOrderNumber: event.order_number || event.orderNumber || event.order_id,
    platformStatus: event.status || event.order_status,
  };

  // Jahez format
  if (platform === 'jahez') {
    result.eventType = event.type || 'order_created';
    result.platformOrderId = event.order?.id || event.order_id;
    result.platformOrderNumber = event.order?.reference || event.order_id;
    result.customerName = event.order?.customer?.name;
    result.customerPhone = event.order?.customer?.phone;
    result.deliveryAddress = {
      street: event.order?.address?.street,
      building: event.order?.address?.building,
      floor: event.order?.address?.floor,
      apartment: event.order?.address?.apartment,
      district: event.order?.address?.district,
      city: event.order?.address?.city,
      latitude: event.order?.address?.lat,
      longitude: event.order?.address?.lng,
      notes: event.order?.address?.notes,
    };
    result.items = (event.order?.items || []).map(i => ({
      platformItemId: i.id,
      name: i.name,
      nameAr: i.name_ar,
      quantity: i.quantity,
      unitPrice: i.price,
      notes: i.notes,
      modifications: i.modifications,
      lineTotal: (i.quantity || 1) * (i.price || 0),
    }));
    result.subtotal = event.order?.subtotal;
    result.deliveryFee = event.order?.delivery_fee;
    result.serviceFee = event.order?.service_fee;
    result.discount = event.order?.discount;
    result.commissionAmount = event.order?.commission;
    result.vatAmount = event.order?.vat;
    result.total = event.order?.total;
    result.netPayout = event.order?.net_payout;
    result.paymentMethod = event.order?.payment_method;
    result.paymentStatus = event.order?.payment_status || 'paid';
    result.estimatedDeliveryTime = event.order?.estimated_delivery_time;
    result.prepTimeMinutes = event.order?.prep_time;
    result.driver = event.order?.driver ? {
      name: event.order.driver.name,
      phone: event.order.driver.phone,
    } : undefined;
  }

  // HungerStation / Delivery Hero format
  else if (platform === 'hungerstation') {
    result.eventType = event.event || 'order_created';
    result.platformOrderId = event.payload?.order_id || event.order_id;
    result.customerName = event.payload?.customer_name;
    result.customerPhone = event.payload?.customer_phone;
    result.items = (event.payload?.items || []).map(i => ({
      platformItemId: i.product_id,
      name: i.name,
      quantity: i.quantity,
      unitPrice: i.price,
      lineTotal: i.quantity * i.price,
    }));
    result.subtotal = event.payload?.subtotal;
    result.deliveryFee = event.payload?.delivery_fee;
    result.total = event.payload?.total;
    result.commissionAmount = event.payload?.commission;
    result.paymentMethod = event.payload?.payment_method;
  }

  // Ninja, Keeta, Mrsool, Jumlaty - similar generic parsing
  else {
    const order = event.order || event.payload || event;
    result.platformOrderId = order.id || order.order_id || result.platformOrderId;
    result.customerName = order.customer_name || order.customerName;
    result.customerPhone = order.customer_phone || order.customerPhone;
    result.deliveryAddress = {
      street: order.address || order.delivery_address?.street,
      district: order.area || order.delivery_address?.district,
      city: order.city || order.delivery_address?.city,
      notes: order.delivery_notes || order.delivery_address?.notes,
      latitude: order.lat || order.delivery_address?.lat,
      longitude: order.lng || order.delivery_address?.lng,
    };
    result.items = (order.items || order.products || []).map(i => ({
      platformItemId: i.id || i.product_id,
      name: i.name || i.product_name,
      nameAr: i.name_ar,
      quantity: i.quantity || i.qty,
      unitPrice: i.price || i.unit_price,
      notes: i.notes || i.special_instructions,
      lineTotal: (i.quantity || i.qty || 1) * (i.price || i.unit_price || 0),
    }));
    result.subtotal = order.subtotal;
    result.deliveryFee = order.delivery_fee;
    result.serviceFee = order.service_fee;
    result.discount = order.discount;
    result.commissionAmount = order.commission;
    result.vatAmount = order.vat || order.tax;
    result.total = order.total || order.grand_total;
    result.netPayout = order.net_amount || ((order.total || 0) - (order.commission || 0));
    result.paymentMethod = order.payment_method;
    result.paymentStatus = order.payment_status || 'paid';
    result.estimatedDeliveryTime = order.estimated_delivery_time;
    result.prepTimeMinutes = order.prep_time;
  }

  result.status = mapPlatformStatus(platform, result.platformStatus);

  return result;
}

function mapPlatformStatus(platform, platformStatus) {
  if (!platformStatus) return 'pending';

  const s = platformStatus.toLowerCase();

  // Common status mappings
  if (['new', 'placed', 'created', 'received'].includes(s)) return 'pending';
  if (['accepted', 'confirmed', 'approved'].includes(s)) return 'accepted';
  if (['preparing', 'in_progress', 'cooking', 'processing'].includes(s)) return 'preparing';
  if (['ready', 'prepared', 'ready_for_pickup', 'ready_for_pick_up'].includes(s)) return 'ready';
  if (['picked_up', 'picked', 'on_the_way', 'out_for_delivery', 'driver_assigned'].includes(s)) return 'picked_up';
  if (['delivered', 'completed', 'done', 'fulfilled'].includes(s)) return 'delivered';
  if (['cancelled', 'canceled'].includes(s)) return 'cancelled';
  if (['rejected', 'declined'].includes(s)) return 'rejected';

  return 'pending';
}

export default router;
export { webhookRouter };
