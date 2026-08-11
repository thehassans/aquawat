import crypto from 'crypto'
import SystemSettings from '../models/SystemSettings.js'

const STRIPE_API = 'https://api.stripe.com/v1'

export async function getStripeConfig() {
  const settings = await SystemSettings.findOne({ key: 'global' }).lean()
  const stripe = settings?.payment?.stripe || {}
  return {
    enabled: stripe.enabled === true,
    publishableKey: stripe.publishableKey || '',
    secretKey: stripe.secretKey || '',
    webhookSecret: stripe.webhookSecret || '',
    environment: stripe.environment || 'test',
  }
}

/**
 * Create a Stripe Checkout Session (one-time payment).
 * amountMajor = major currency units (e.g. 79.00 USD).
 * Default presentment/integration currency is USD; Adaptive Pricing lets Stripe
 * auto-convert to the customer's local currency at checkout (official Stripe FX).
 */
export async function createStripeCheckoutSession({
  amountMajor,
  currency = 'USD',
  productName,
  productDescription = '',
  customerEmail = '',
  successUrl,
  cancelUrl,
  metadata = {},
  clientReferenceId = '',
  adaptivePricing = true,
}) {
  const config = await getStripeConfig()
  if (!config.enabled || !config.secretKey) {
    throw new Error('Stripe is not configured. Enable it in Super Admin → Payment Settings.')
  }

  const unitAmount = Math.round(Number(amountMajor) * 100)
  if (!Number.isFinite(unitAmount) || unitAmount < 1) {
    throw new Error(`Invalid Stripe amount: ${amountMajor}`)
  }

  const body = new URLSearchParams({
    mode: 'payment',
    success_url: successUrl,
    cancel_url: cancelUrl,
    'line_items[0][price_data][currency]': String(currency || 'USD').toLowerCase(),
    'line_items[0][price_data][product_data][name]': String(productName || 'Maqder').slice(0, 120),
    'line_items[0][price_data][unit_amount]': String(unitAmount),
    'line_items[0][quantity]': '1',
  })

  if (adaptivePricing) {
    body.set('adaptive_pricing[enabled]', 'true')
  }

  if (productDescription) {
    body.set('line_items[0][price_data][product_data][description]', String(productDescription).slice(0, 500))
  }
  if (customerEmail) body.set('customer_email', String(customerEmail).trim())
  if (clientReferenceId) body.set('client_reference_id', String(clientReferenceId).slice(0, 200))

  Object.entries(metadata || {}).forEach(([key, value]) => {
    if (value === undefined || value === null) return
    body.set(`metadata[${key}]`, String(value).slice(0, 500))
  })

  const res = await fetch(`${STRIPE_API}/checkout/sessions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data?.error?.message || `Stripe checkout failed (${res.status})`)
  }

  return {
    id: data.id,
    url: data.url,
    status: data.payment_status || 'unpaid',
    raw: data,
  }
}

export async function retrieveStripeCheckoutSession(sessionId) {
  const config = await getStripeConfig()
  if (!config.secretKey) throw new Error('Stripe secret key is not configured')

  const res = await fetch(`${STRIPE_API}/checkout/sessions/${encodeURIComponent(sessionId)}`, {
    headers: { Authorization: `Bearer ${config.secretKey}` },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data?.error?.message || `Stripe session lookup failed (${res.status})`)
  }
  return data
}

export function verifyStripeWebhookSignature({ headers, rawBody, webhookSecret }) {
  const sig = headers?.['stripe-signature'] || headers?.['Stripe-Signature']
  if (!sig || !webhookSecret || !rawBody) return false

  const parts = String(sig).split(',')
  const timestamp = parts.find((p) => p.startsWith('t='))?.split('=')[1]
  const signature = parts.find((p) => p.startsWith('v1='))?.split('=')[1]
  if (!timestamp || !signature) return false

  const age = Math.floor(Date.now() / 1000) - parseInt(timestamp, 10)
  if (!Number.isFinite(age) || age > 300) return false

  const payload = `${timestamp}.${typeof rawBody === 'string' ? rawBody : Buffer.from(rawBody).toString('utf8')}`
  const expected = crypto.createHmac('sha256', webhookSecret).update(payload, 'utf8').digest('hex')

  try {
    const a = Buffer.from(signature, 'hex')
    const b = Buffer.from(expected, 'hex')
    if (a.length !== b.length) return false
    return crypto.timingSafeEqual(a, b)
  } catch {
    return false
  }
}

export async function testStripeConnection() {
  const config = await getStripeConfig()
  if (!config.secretKey) {
    return { ok: false, message: 'Stripe secret key is not configured.' }
  }
  try {
    const res = await fetch(`${STRIPE_API}/balance`, {
      headers: { Authorization: `Bearer ${config.secretKey}` },
      signal: AbortSignal.timeout(8000),
    })
    if (res.ok) {
      return { ok: true, message: `Stripe connection successful (${config.environment}).` }
    }
    const body = await res.json().catch(() => ({}))
    return { ok: false, message: body?.error?.message || `Stripe API returned ${res.status}` }
  } catch (err) {
    return { ok: false, message: err.message || 'Could not reach Stripe API.' }
  }
}
