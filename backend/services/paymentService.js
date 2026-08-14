/**
 * Payment provider adapters for the ecommerce platform.
 * Each adapter implements:
 *   - createCheckoutSession({ amount, currency, orderId, orderNumber, customer, successUrl, cancelUrl, metadata })
 *   - verifyWebhook({ headers, rawBody })
 *   - getPaymentStatus(paymentId)
 *   - refund(paymentId, amount)
 */
import crypto from 'crypto';
import { verifyTabbyWebhook, verifyTamaraWebhook } from '../utils/webhookAuth.js';

// --- Moyasar ---
const moyasarAdapter = {
  async createCheckoutSession({ amount, currency, orderId, orderNumber, customer, successUrl, cancelUrl, config }) {
    const baseUrl = config.environment === 'production' ? 'https://api.moyasar.com/v1' : 'https://api.moyasar.com/v1';
    const body = {
      amount: Math.round(amount * 100), // Moyasar expects halalas (cents)
      currency: currency.toUpperCase(),
      description: `Order ${orderNumber}`,
      callback_url: successUrl,
      source: { type: 'creditcard', name: customer.name, message: `Payment for ${orderNumber}` },
      metadata: { orderId, orderNumber },
    };
    const res = await fetch(`${baseUrl}/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(config.secretKey + ':').toString('base64')}`,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Moyasar error: ${res.status}`);
    const data = await res.json();
    return {
      providerPaymentId: data.id,
      checkoutUrl: data.source?.transaction_url || null,
      status: data.status === 'paid' ? 'paid' : 'pending',
      raw: data,
    };
  },

  verifyWebhook({ headers, rawBody, config }) {
    // Moyasar sends a webhook token in headers
    const token = headers['moyasar-webhook-token'];
    if (!token || !config.secretKey) return false;
    return token === config.webhookSecret;
  },

  async getPaymentStatus(paymentId, config) {
    const baseUrl = 'https://api.moyasar.com/v1';
    const res = await fetch(`${baseUrl}/payments/${paymentId}`, {
      headers: { 'Authorization': `Basic ${Buffer.from(config.secretKey + ':').toString('base64')}` },
    });
    if (!res.ok) throw new Error(`Moyasar error: ${res.status}`);
    const data = await res.json();
    return { status: data.status === 'paid' ? 'paid' : data.status, raw: data };
  },

  async refund(paymentId, amount, config) {
    const res = await fetch(`https://api.moyasar.com/v1/payments/${paymentId}/refund`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(config.secretKey + ':').toString('base64')}`,
      },
      body: JSON.stringify({ amount: Math.round(amount * 100) }),
    });
    if (!res.ok) throw new Error(`Moyasar refund error: ${res.status}`);
    const data = await res.json();
    return { status: data.status, raw: data };
  },
};

// --- Tap Payments ---
const tapAdapter = {
  async createCheckoutSession({ amount, currency, orderId, orderNumber, customer, successUrl, cancelUrl, config }) {
    const baseUrl = config.environment === 'production' ? 'https://api.tap.company/v2' : 'https://api.tap.company/v2';
    const body = {
      amount: amount.toString(),
      currency: currency.toUpperCase(),
      customer: {
        first_name: customer.name,
        email: customer.email || '',
        phone: { country_code: '966', number: customer.phone || '' },
      },
      source: { id: 'src_all' },
      redirect: { url: successUrl },
      post: { url: config.webhookUrl || '' },
      metadata: { orderId, orderNumber },
    };
    const res = await fetch(`${baseUrl}/charges`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.secretKey}`,
        'lang_code': 'en',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Tap error: ${res.status}`);
    const data = await res.json();
    return {
      providerPaymentId: data.id,
      checkoutUrl: data.transaction?.url || null,
      status: data.status === 'CAPTURED' ? 'paid' : 'pending',
      raw: data,
    };
  },

  verifyWebhook({ headers, rawBody, config }) {
    // Tap uses x-callback signature
    const signature = headers['x-callback'];
    if (!signature || !config.secretKey) return false;
    return signature === config.webhookSecret;
  },

  async getPaymentStatus(chargeId, config) {
    const res = await fetch(`https://api.tap.company/v2/charges/${chargeId}`, {
      headers: { 'Authorization': `Bearer ${config.secretKey}` },
    });
    if (!res.ok) throw new Error(`Tap error: ${res.status}`);
    const data = await res.json();
    return { status: data.status === 'CAPTURED' ? 'paid' : data.status, raw: data };
  },

  async refund(chargeId, amount, config) {
    const res = await fetch(`https://api.tap.company/v2/refunds`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.secretKey}`,
      },
      body: JSON.stringify({ charge_id: chargeId, amount: amount.toString(), currency: 'SAR' }),
    });
    if (!res.ok) throw new Error(`Tap refund error: ${res.status}`);
    const data = await res.json();
    return { status: data.status, raw: data };
  },
};

// --- PayTabs ---
const paytabsAdapter = {
  async createCheckoutSession({ amount, currency, orderId, orderNumber, customer, successUrl, cancelUrl, config }) {
    const baseUrl = config.environment === 'production'
      ? 'https://secure.paytabs.com/payment/request'
      : 'https://secure.paytabs.sa/payment/request';
    const body = {
      profile_id: config.merchantId,
      tran_type: 'sale',
      tran_class: 'ecom',
      cart_id: orderNumber,
      cart_description: `Order ${orderNumber}`,
      cart_currency: currency.toUpperCase(),
      cart_amount: amount.toString(),
      customer_details: {
        name: customer.name,
        email: customer.email || '',
        phone: customer.phone || '',
      },
      callback: successUrl,
      return: successUrl,
    };
    const res = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': config.secretKey,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`PayTabs error: ${res.status}`);
    const data = await res.json();
    return {
      providerPaymentId: data.tran_ref,
      checkoutUrl: data.redirect_url || null,
      status: 'pending',
      raw: data,
    };
  },

  verifyWebhook({ headers, rawBody, config }) {
    // PayTabs sends a server-to-server callback with a hash signature
    const hash = headers['hash'];
    if (!hash || !config.secretKey) return false;
    return hash === config.webhookSecret;
  },

  async getPaymentStatus(tranRef, config) {
    const baseUrl = 'https://secure.paytabs.com/payment/query';
    const res = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': config.secretKey,
      },
      body: JSON.stringify({ profile_id: config.merchantId, tran_ref: tranRef }),
    });
    if (!res.ok) throw new Error(`PayTabs error: ${res.status}`);
    const data = await res.json();
    return { status: data.payment_result?.response_status === 'A' ? 'paid' : 'pending', raw: data };
  },

  async refund(tranRef, amount, config) {
    const res = await fetch('https://secure.paytabs.com/payment/request', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': config.secretKey,
      },
      body: JSON.stringify({
        profile_id: config.merchantId,
        tran_type: 'refund',
        tran_class: 'ecom',
        tran_ref: tranRef,
        cart_amount: amount.toString(),
        cart_currency: 'SAR',
      }),
    });
    if (!res.ok) throw new Error(`PayTabs refund error: ${res.status}`);
    const data = await res.json();
    return { status: data.payment_result?.response_status, raw: data };
  },
};

// --- Stripe ---
const stripeAdapter = {
  async createCheckoutSession({ amount, currency, orderId, orderNumber, customer, successUrl, cancelUrl, config }) {
    const baseUrl = 'https://api.stripe.com/v1';
    const body = new URLSearchParams({
      'mode': 'payment',
      'success_url': successUrl,
      'cancel_url': cancelUrl,
      'client_reference_id': orderId,
      'line_items[0][price_data][currency]': currency.toLowerCase(),
      'line_items[0][price_data][product_data][name]': `Order ${orderNumber}`,
      'line_items[0][price_data][unit_amount]': String(Math.round(amount * 100)),
      'line_items[0][quantity]': '1',
      'customer_email': customer.email || '',
    });
    const res = await fetch(`${baseUrl}/checkout/sessions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });
    if (!res.ok) throw new Error(`Stripe error: ${res.status} ${await res.text()}`);
    const data = await res.json();
    return {
      providerPaymentId: data.id,
      checkoutUrl: data.url,
      status: data.payment_status === 'paid' ? 'paid' : 'pending',
      raw: data,
    };
  },

  verifyWebhook({ headers, rawBody, config }) {
    // Stripe sends a stripe-signature header: t=timestamp,v1=signature
    const sig = headers['stripe-signature'];
    if (!sig || !config.webhookSecret) return false;

    // Parse the signature header
    const parts = sig.split(',');
    const timestampPart = parts.find(p => p.startsWith('t='));
    const signaturePart = parts.find(p => p.startsWith('v1='));
    if (!timestampPart || !signaturePart) return false;

    const timestamp = timestampPart.split('=')[1];
    const signature = signaturePart.split('=')[1];

    // Prevent replay attacks — reject if older than 5 minutes
    const age = Math.floor(Date.now() / 1000) - parseInt(timestamp, 10);
    if (age > 300) return false;

    // Compute expected signature: HMAC-SHA256(timestamp + '.' + rawBody, webhookSecret)
    const payload = `${timestamp}.${rawBody}`;
    const expected = crypto.createHmac('sha256', config.webhookSecret).update(payload).digest('hex');

    // Use timing-safe comparison
    try {
      const a = Buffer.from(signature, 'hex');
      const b = Buffer.from(expected, 'hex');
      if (a.length !== b.length) return false;
      return crypto.timingSafeEqual(a, b);
    } catch {
      return false;
    }
  },

  async getPaymentStatus(sessionId, config) {
    const res = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sessionId}`, {
      headers: { 'Authorization': `Bearer ${config.secretKey}` },
    });
    if (!res.ok) throw new Error(`Stripe error: ${res.status}`);
    const data = await res.json();
    return { status: data.payment_status === 'paid' ? 'paid' : data.payment_status, raw: data };
  },

  async refund(paymentIntentId, amount, config) {
    const body = new URLSearchParams({
      'payment_intent': paymentIntentId,
      'amount': String(Math.round(amount * 100)),
    });
    const res = await fetch('https://api.stripe.com/v1/refunds', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });
    if (!res.ok) throw new Error(`Stripe refund error: ${res.status}`);
    const data = await res.json();
    return { status: data.status, raw: data };
  },
};

function ksaPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '966500000000';
  if (digits.startsWith('966')) return digits;
  if (digits.startsWith('0')) return `966${digits.slice(1)}`;
  if (digits.length === 9) return `966${digits}`;
  return digits;
}

function ksaCountry(value) {
  const raw = String(value || 'SA').trim();
  if (raw.length === 2) return raw.toUpperCase();
  if (/saudi/i.test(raw)) return 'SA';
  return 'SA';
}

function tamaraBase(config) {
  return config.environment === 'live' ? 'https://api.tamara.co' : 'https://api-sandbox.tamara.co';
}

function mapBnplStatus(status) {
  const s = String(status || '').toLowerCase();
  if (['captured', 'closed', 'fully_captured', 'approved', 'paid'].includes(s)) return 'paid';
  if (['authorized', 'authorised', 'order_approved'].includes(s)) return 'authorized';
  if (['rejected', 'expired', 'canceled', 'cancelled', 'declined', 'failed'].includes(s)) return 'failed';
  if (['refunded', 'fully_refunded'].includes(s)) return 'refunded';
  return 'pending';
}

async function readPaymentJson(res, label) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data.message || data.errors?.[0]?.message || data.error || res.status;
    throw new Error(`${label} error: ${msg}`);
  }
  return data;
}

const tabbyAdapter = {
  async createCheckoutSession({ amount, currency, orderId, orderNumber, customer, items, successUrl, cancelUrl, config }) {
    const origin = (() => {
      try { return new URL(successUrl).origin; } catch { return ''; }
    })();
    const lineItems = (items || []).map((item) => ({
      title: item.productTitle || item.name || 'Item',
      description: item.variantLabel || '',
      quantity: item.quantity || 1,
      unit_price: String(item.price || item.unitPrice || amount),
      category: 'general',
    }));
    const body = {
      payment: {
        amount: String(Number(amount).toFixed(2)),
        currency: (currency || 'SAR').toUpperCase(),
        description: `Order ${orderNumber}`,
        buyer: {
          phone: ksaPhone(customer?.phone),
          email: customer?.email || '',
          name: customer?.name || '',
        },
        buyer_history: { registered_since: new Date().toISOString().slice(0, 10), loyalty_level: 0 },
        order: {
          reference_id: orderNumber,
          items: lineItems.length ? lineItems : [{ title: `Order ${orderNumber}`, quantity: 1, unit_price: String(Number(amount).toFixed(2)), category: 'general' }],
        },
        shipping_address: {
          city: customer?.city || 'Riyadh',
          address: customer?.addressLine1 || 'KSA',
          zip: customer?.postalCode || '',
        },
      },
      lang: 'ar',
      merchant_code: config.merchantId || '',
      merchant_urls: {
        success: successUrl,
        cancel: cancelUrl,
        failure: cancelUrl,
        notification: origin ? `${origin}/api/ecommerce/fulfillment/webhook/tabby` : '',
      },
    };
    const res = await fetch('https://api.tabby.ai/api/v2/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.secretKey}` },
      body: JSON.stringify(body),
    });
    const data = await readPaymentJson(res, 'Tabby');
    if (String(data.status || '').toLowerCase() === 'rejected') {
      throw new Error('Tabby declined this order. Try another payment method.');
    }
    const url = data.configuration?.available_products?.installments?.[0]?.web_url
      || data.configuration?.available_products?.pay_later?.[0]?.web_url
      || data.payment_url
      || data.url;
    if (!url) throw new Error('Tabby is not available for this customer or amount.');
    return {
      providerPaymentId: data.payment?.id || data.id,
      checkoutUrl: url,
      status: 'pending',
      raw: data,
    };
  },

  verifyWebhook({ headers, rawBody, config }) {
    return verifyTabbyWebhook({ headers, rawBody, body: {} }, config.secretKey);
  },

  async getPaymentStatus(paymentId, config) {
    const res = await fetch(`https://api.tabby.ai/api/v2/payments/${encodeURIComponent(paymentId)}`, {
      headers: { Authorization: `Bearer ${config.secretKey}` },
    });
    const data = await readPaymentJson(res, 'Tabby status');
    return { status: mapBnplStatus(data.status), raw: data };
  },

  async capture(paymentId, amount, config) {
    const res = await fetch(`https://api.tabby.ai/api/v2/payments/${encodeURIComponent(paymentId)}/captures`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.secretKey}` },
      body: JSON.stringify({ amount: String(Number(amount).toFixed(2)) }),
    });
    const data = await readPaymentJson(res, 'Tabby capture');
    return { status: mapBnplStatus(data.status || 'captured'), raw: data };
  },

  async refund(paymentId, amount, config) {
    const res = await fetch(`https://api.tabby.ai/api/v2/payments/${encodeURIComponent(paymentId)}/refunds`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.secretKey}` },
      body: JSON.stringify({ amount: String(Number(amount).toFixed(2)) }),
    });
    const data = await readPaymentJson(res, 'Tabby refund');
    return { status: mapBnplStatus(data.status || 'refunded'), raw: data };
  },
};

const tamaraAdapter = {
  async createCheckoutSession({ amount, currency, orderId, orderNumber, customer, items, successUrl, cancelUrl, config }) {
    const origin = (() => {
      try { return new URL(successUrl).origin; } catch { return ''; }
    })();
    const cur = (currency || 'SAR').toUpperCase();
    const money = (value) => ({ amount: Number(Number(value).toFixed(2)), currency: cur });
    const lineItems = (items || []).map((item, idx) => ({
      name: item.productTitle || item.name || 'Item',
      type: 'Physical',
      reference_id: String(item.sku || item.productId || idx),
      sku: item.sku || String(item.productId || idx),
      quantity: item.quantity || 1,
      unit_price: money(item.price || item.unitPrice || amount),
      total_amount: money((item.price || item.unitPrice || amount) * (item.quantity || 1)),
      tax_amount: money(item.taxAmount || 0),
      discount_amount: money(0),
    }));
    const body = {
      order_reference_id: orderNumber,
      total_amount: money(amount),
      description: `Order ${orderNumber}`,
      country_code: ksaCountry(customer?.country),
      payment_type: 'PAY_BY_INSTALMENTS',
      locale: 'ar_SA',
      items: lineItems.length ? lineItems : [{
        name: `Order ${orderNumber}`,
        type: 'Physical',
        reference_id: orderId,
        sku: orderNumber,
        quantity: 1,
        unit_price: money(amount),
        total_amount: money(amount),
        tax_amount: money(0),
        discount_amount: money(0),
      }],
      consumer: {
        first_name: customer?.name || 'Customer',
        last_name: '',
        phone_number: ksaPhone(customer?.phone),
        email: customer?.email || '',
      },
      billing_address: {
        first_name: customer?.name || 'Customer',
        last_name: '',
        line1: customer?.addressLine1 || 'KSA',
        city: customer?.city || 'Riyadh',
        country_code: ksaCountry(customer?.country),
        phone_number: ksaPhone(customer?.phone),
      },
      shipping_address: {
        first_name: customer?.name || 'Customer',
        last_name: '',
        line1: customer?.addressLine1 || 'KSA',
        city: customer?.city || 'Riyadh',
        country_code: ksaCountry(customer?.country),
        phone_number: ksaPhone(customer?.phone),
      },
      merchant_url: {
        success: successUrl,
        failure: cancelUrl,
        cancel: cancelUrl,
        notification: origin ? `${origin}/api/ecommerce/fulfillment/webhook/tamara` : '',
      },
    };
    const res = await fetch(`${tamaraBase(config)}/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.secretKey}` },
      body: JSON.stringify(body),
    });
    const data = await readPaymentJson(res, 'Tamara');
    const url = data.checkout_url || data.url;
    if (!url) throw new Error('Tamara is not available for this customer or amount.');
    return {
      providerPaymentId: data.order_id || data.checkout_id,
      checkoutUrl: url,
      status: 'pending',
      raw: data,
    };
  },

  verifyWebhook({ headers, rawBody, config }) {
    return verifyTamaraWebhook({ headers, rawBody, body: {} }, config.webhookSecret || config.secretKey);
  },

  async getPaymentStatus(orderId, config) {
    const res = await fetch(`${tamaraBase(config)}/orders/${encodeURIComponent(orderId)}`, {
      headers: { Authorization: `Bearer ${config.secretKey}` },
    });
    const data = await readPaymentJson(res, 'Tamara status');
    return { status: mapBnplStatus(data.status), raw: data };
  },

  async capture(orderId, amount, config) {
    const res = await fetch(`${tamaraBase(config)}/orders/${encodeURIComponent(orderId)}/capture`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.secretKey}` },
      body: JSON.stringify({ total_amount: { amount: Number(Number(amount).toFixed(2)), currency: 'SAR' } }),
    });
    const data = await readPaymentJson(res, 'Tamara capture');
    return { status: mapBnplStatus(data.status || 'fully_captured'), raw: data };
  },

  async refund(orderId, amount, config) {
    const res = await fetch(`${tamaraBase(config)}/orders/${encodeURIComponent(orderId)}/refund`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.secretKey}` },
      body: JSON.stringify({ total_amount: { amount: Number(Number(amount).toFixed(2)), currency: 'SAR' } }),
    });
    const data = await readPaymentJson(res, 'Tamara refund');
    return { status: mapBnplStatus(data.status || 'refunded'), raw: data };
  },
};

export const paymentAdapters = {
  moyasar: moyasarAdapter,
  tap: tapAdapter,
  paytabs: paytabsAdapter,
  stripe: stripeAdapter,
  tabby: tabbyAdapter,
  tamara: tamaraAdapter,
};

export function getPaymentAdapter(provider) {
  return paymentAdapters[provider] || null;
}

/**
 * Create a checkout session with the tenant's configured payment provider.
 * @param {string} provider - 'moyasar' | 'tap' | 'paytabs' | 'stripe' | 'tabby' | 'tamara'
 * @param {object} params - Checkout parameters
 * @param {object} config - Provider config from tenant.ecommerce.payments[provider]
 */
export async function createCheckoutSession(provider, params, config) {
  const adapter = getPaymentAdapter(provider);
  if (!adapter) throw new Error(`Unknown payment provider: ${provider}`);
  if (!config?.enabled) throw new Error(`${provider} is not enabled`);
  if (!config?.secretKey) throw new Error(`${provider} secret key not configured`);
  return adapter.createCheckoutSession({ ...params, config });
}

export async function capturePayment(provider, paymentId, amount, config) {
  const adapter = getPaymentAdapter(provider);
  if (!adapter) throw new Error(`Unknown payment provider: ${provider}`);
  if (typeof adapter.capture !== 'function') return { status: 'paid' };
  return adapter.capture(paymentId, amount, config);
}

/**
 * Verify a webhook from a payment provider.
 */
export function verifyPaymentWebhook(provider, { headers, rawBody, config }) {
  const adapter = getPaymentAdapter(provider);
  if (!adapter) return false;
  return adapter.verifyWebhook({ headers, rawBody, config });
}

/**
 * Query payment status from provider.
 */
export async function getPaymentStatus(provider, paymentId, config) {
  const adapter = getPaymentAdapter(provider);
  if (!adapter) throw new Error(`Unknown payment provider: ${provider}`);
  return adapter.getPaymentStatus(paymentId, config);
}

/**
 * Refund a payment.
 */
export async function refundPayment(provider, paymentId, amount, config) {
  const adapter = getPaymentAdapter(provider);
  if (!adapter) throw new Error(`Unknown payment provider: ${provider}`);
  return adapter.refund(paymentId, amount, config);
}
