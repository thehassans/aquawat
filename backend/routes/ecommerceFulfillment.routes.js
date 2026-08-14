import express from 'express';
import { resolveTenantId, handleTenantScopeError } from '../utils/tenantScope.js';
import { protect } from '../middleware/auth.js';
import Tenant from '../models/Tenant.js';
import EcommerceOrder from '../models/EcommerceOrder.js';
import { createCheckoutSession, verifyPaymentWebhook, getPaymentStatus, refundPayment, capturePayment } from '../services/paymentService.js';
import { createShipment, trackShipment, cancelShipment } from '../services/courierService.js';
import { COURIER_PROVIDER_KEYS } from '../utils/appStorePartnerApps.js';
import RestaurantOrder from '../models/RestaurantOrder.js';

const router = express.Router();

const getTargetTenantId = (user, req) => resolveTenantId(user, req);

const getProviderConfig = (tenant, provider, type = 'payments') => {
  const cfg = tenant.ecommerce?.[type]?.[provider];
  if (!cfg) throw new Error(`${provider} not configured`);
  return cfg;
};

function resolveCourierProvider(tenant, requested) {
  const couriers = tenant.ecommerce?.couriers || {};
  const key = String(requested || '').toLowerCase();
  if (key && COURIER_PROVIDER_KEYS.includes(key)) return key;
  const enabled = COURIER_PROVIDER_KEYS.find((provider) => couriers[provider]?.enabled);
  if (enabled) return enabled;
  throw new Error('No courier is enabled. Install a logistics app from the App Store and connect credentials.');
}

// ==================== PAYMENTS ====================

// Create checkout session for an order
router.post('/checkout/:orderId', protect, async (req, res) => {
  try {
    const tenantId = getTargetTenantId(req.user, req);
    if (!tenantId) return res.status(400).json({ error: 'No tenant found.' });

    const tenant = await Tenant.findById(tenantId).select('ecommerce.payments');
    const order = await EcommerceOrder.findOne({ _id: req.params.orderId, tenantId });
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const provider = req.body.provider || tenant.ecommerce?.payments?.defaultProvider;
    if (!provider || provider === 'cod') {
      // COD doesn't need a checkout session
      order.payment.method = 'cod';
      order.payment.status = 'pending';
      await order.save();
      return res.json({ provider: 'cod', checkoutUrl: null, message: 'Cash on Delivery selected' });
    }

    const config = getProviderConfig(tenant, provider, 'payments');
    const origin = req.headers.origin || `https://${tenant.slug}.shop.maqder.com`;
    const result = await createCheckoutSession(provider, {
      amount: order.grandTotal,
      currency: order.currency,
      orderId: order._id.toString(),
      orderNumber: order.orderNumber,
      customer: order.customer,
      items: order.lineItems,
      successUrl: `${origin}/checkout/success?order=${order.orderNumber}`,
      cancelUrl: `${origin}/checkout/cancel?order=${order.orderNumber}`,
    }, config);

    // Save payment info on order
    order.payment.method = provider;
    order.payment.provider = provider;
    order.payment.providerTransactionId = result.providerPaymentId;
    order.payment.status = 'pending';
    order.payment.amount = order.grandTotal;
    await order.save();

    res.json({ provider, checkoutUrl: result.checkoutUrl, paymentId: result.providerPaymentId });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Webhook endpoint for payment providers (no auth — verified by provider signature)
router.post('/webhook/:provider', async (req, res) => {
  try {
    const { provider } = req.params;
    const body = req.body || {};
    const payment = body?.data?.payment || body?.payment || body?.order || body;
    const meta = payment?.metadata || body?.metadata || {};
    const orderNumber = meta.orderNumber
      || payment?.order?.reference_id
      || payment?.order_reference_id
      || body.order_reference_id
      || body.client_reference_id
      || body.refNo
      || body.cart_id;
    const paymentId = payment?.id || body.id || body.tran_ref || body.charge_id || body.order_id;

    let order = null;
    if (orderNumber) order = await EcommerceOrder.findOne({ orderNumber });
    if (!order && paymentId) order = await EcommerceOrder.findOne({ 'payment.providerTransactionId': paymentId });

    if (!order) {
      let restaurantOrder = null;
      if (orderNumber) restaurantOrder = await RestaurantOrder.findOne({ orderNumber });
      if (!restaurantOrder && paymentId) restaurantOrder = await RestaurantOrder.findOne({ providerTransactionId: paymentId });
      if (!restaurantOrder) return res.status(404).json({ error: 'Order not found' });

      const tenant = await Tenant.findById(restaurantOrder.tenantId);
      const config = getProviderConfig(tenant, provider, 'payments');
      const isValid = verifyPaymentWebhook(provider, { headers: req.headers, rawBody: req.rawBody, config });
      if (!isValid) return res.status(401).json({ error: 'Invalid webhook signature' });

      const statusResult = paymentId
        ? await getPaymentStatus(provider, paymentId, config)
        : { status: mapIncomingBnpl(body, payment) };
      if (statusResult.status === 'authorized' && paymentId) {
        await capturePayment(provider, paymentId, restaurantOrder.grandTotal, config);
        restaurantOrder.status = 'paid';
      } else if (statusResult.status === 'paid') {
        restaurantOrder.status = 'paid';
      }
      if (paymentId) restaurantOrder.providerTransactionId = paymentId;
      await restaurantOrder.save();
      return res.json({ received: true });
    }

    const tenant = await Tenant.findById(order.tenantId);
    const config = getProviderConfig(tenant, provider, 'payments');

    const isValid = verifyPaymentWebhook(provider, { headers: req.headers, rawBody: req.rawBody, config });
    if (!isValid) return res.status(401).json({ error: 'Invalid webhook signature' });

    const id = paymentId || order.payment.providerTransactionId;
    if (id) {
      const statusResult = await getPaymentStatus(provider, id, config);
      order.payment.provider = provider;
      order.payment.providerTransactionId = id;
      if (statusResult.status === 'paid') {
        order.payment.status = 'paid';
        if (!order.payment.paidAt) order.payment.paidAt = new Date();
        if (order.status === 'pending') order.status = 'confirmed';
      } else if (statusResult.status === 'authorized') {
        order.payment.status = 'authorized';
      } else if (statusResult.status === 'failed' || statusResult.status === 'refunded') {
        order.payment.status = statusResult.status;
      }
      await order.save();
    }

    res.json({ received: true });
  } catch (error) {
    if (handleTenantScopeError(res, error)) return;
    res.status(500).json({ error: error.message });
  }
});

function mapIncomingBnpl(body, payment) {
  const status = String(payment?.status || body?.status || body?.event_type || '').toLowerCase();
  if (status.includes('captur') || status.includes('succeed') || status === 'closed' || status === 'approved') return 'paid';
  if (status.includes('author')) return 'authorized';
  if (status.includes('fail') || status.includes('reject') || status.includes('cancel')) return 'failed';
  return 'pending';
}

// Verify payment status (manual check)
router.get('/verify/:orderId', protect, async (req, res) => {
  try {
    const tenantId = getTargetTenantId(req.user, req);
    if (!tenantId) return res.status(400).json({ error: 'No tenant found.' });

    const order = await EcommerceOrder.findOne({ _id: req.params.orderId, tenantId });
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const provider = order.payment?.provider;
    if (!provider || provider === 'cod') return res.json({ status: order.payment?.status || 'pending' });

    const tenant = await Tenant.findById(tenantId).select('ecommerce.payments');
    const config = getProviderConfig(tenant, provider, 'payments');
    const paymentId = order.payment?.providerTransactionId;
    if (!paymentId) return res.json({ status: 'pending' });

    const result = await getPaymentStatus(provider, paymentId, config);
    if (result.status === 'paid' && order.payment.status !== 'paid') {
      order.payment.status = 'paid';
      order.payment.paidAt = new Date();
      await order.save();
    }

    res.json({ status: result.status, raw: result.raw });
  } catch (error) {
    if (handleTenantScopeError(res, error)) return;
    res.status(500).json({ error: error.message });
  }
});

// Refund a payment
router.post('/refund/:orderId', protect, async (req, res) => {
  try {
    const tenantId = getTargetTenantId(req.user, req);
    if (!tenantId) return res.status(400).json({ error: 'No tenant found.' });

    const order = await EcommerceOrder.findOne({ _id: req.params.orderId, tenantId });
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const provider = order.payment?.provider;
    if (!provider || provider === 'cod') return res.status(400).json({ error: 'Cannot refund COD order' });

    const tenant = await Tenant.findById(tenantId).select('ecommerce.payments');
    const config = getProviderConfig(tenant, provider, 'payments');
    const paymentId = order.payment?.providerTransactionId;
    const amount = req.body.amount || order.grandTotal;

    const result = await refundPayment(provider, paymentId, amount, config);
    order.payment.status = 'refunded';
    await order.save();

    res.json({ status: 'refunded', raw: result.raw });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ==================== COURIERS / FULFILLMENT ====================

// Create shipment for an order
router.post('/ship/:orderId', protect, async (req, res) => {
  try {
    const tenantId = getTargetTenantId(req.user, req);
    if (!tenantId) return res.status(400).json({ error: 'No tenant found.' });

    const tenant = await Tenant.findById(tenantId).select('ecommerce.couriers ecommerce.payments');
    const order = await EcommerceOrder.findOne({ _id: req.params.orderId, tenantId });
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const provider = resolveCourierProvider(tenant, req.body.provider);
    const config = getProviderConfig(tenant, provider, 'couriers');

    const result = await createShipment(provider, {
      order,
      customer: order.customer,
      items: order.lineItems,
    }, config);

    if (['tabby', 'tamara'].includes(order.payment?.provider) && order.payment?.providerTransactionId && order.payment.status !== 'paid') {
      const payConfig = getProviderConfig(tenant, order.payment.provider, 'payments');
      await capturePayment(order.payment.provider, order.payment.providerTransactionId, order.grandTotal, payConfig);
      order.payment.status = 'paid';
      order.payment.paidAt = new Date();
    }

    // Update order shipping info
    order.shipping.method = provider;
    order.shipping.courier = provider;
    order.shipping.trackingNumber = result.trackingNumber;
    order.shipping.status = 'fulfilled';
    order.shipping.fulfilledAt = new Date();
    await order.save();

    res.json({ trackingNumber: result.trackingNumber, labelUrl: result.labelUrl, raw: result.raw });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Track a shipment
router.get('/track/:orderId', protect, async (req, res) => {
  try {
    const tenantId = getTargetTenantId(req.user, req);
    if (!tenantId) return res.status(400).json({ error: 'No tenant found.' });

    const order = await EcommerceOrder.findOne({ _id: req.params.orderId, tenantId });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (!order.shipping?.trackingNumber) return res.status(400).json({ error: 'No tracking number' });

    const provider = order.shipping?.method || order.shipping?.courier;
    if (!provider || provider === 'flat_rate') return res.status(400).json({ error: 'No courier provider' });

    const tenant = await Tenant.findById(tenantId).select('ecommerce.couriers');
    const config = getProviderConfig(tenant, provider, 'couriers');

    const result = await trackShipment(provider, order.shipping.trackingNumber, config);
    res.json(result);
  } catch (error) {
    if (handleTenantScopeError(res, error)) return;
    res.status(500).json({ error: error.message });
  }
});

// Cancel a shipment
router.post('/cancel-shipment/:orderId', protect, async (req, res) => {
  try {
    const tenantId = getTargetTenantId(req.user, req);
    if (!tenantId) return res.status(400).json({ error: 'No tenant found.' });

    const order = await EcommerceOrder.findOne({ _id: req.params.orderId, tenantId });
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const provider = order.shipping?.method || order.shipping?.courier;
    if (!provider || provider === 'flat_rate') return res.status(400).json({ error: 'No courier provider' });

    const tenant = await Tenant.findById(tenantId).select('ecommerce.couriers');
    const config = getProviderConfig(tenant, provider, 'couriers');

    const shipmentId = order.shipping?.trackingNumber;
    const result = await cancelShipment(provider, shipmentId, config);

    order.shipping.status = 'returned';
    await order.save();

    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
