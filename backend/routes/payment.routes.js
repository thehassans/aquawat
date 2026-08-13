import express from 'express'
import SystemSettings from '../models/SystemSettings.js'
import Tenant from '../models/Tenant.js'
import { getPlanEntitlements } from '../utils/planEntitlements.js'
import { isPaidPlanId, nextSubscriptionEndDate } from '../utils/subscriptionPeriod.js'
import DemoUser from '../models/DemoUser.js'
import { protect } from '../middleware/auth.js'
import { sendUpgradeWelcomeEmail, sendPaymentFailedEmail } from '../utils/emailService.js'
import { emitPlatformEvent } from '../utils/platformEvents.js'
import {
  canFulfillPaymentForTenant,
  rejectUnauthorizedPaymentPoll,
} from '../utils/paymentTenantGuard.js'
import {
  getStripeConfig,
  createStripeCheckoutSession,
  retrieveStripeCheckoutSession,
  verifyStripeWebhookSignature,
  isStripeFulfillmentEvent,
  isStripePaymentFailedEvent,
  stripeFailureContext,
} from '../services/platformStripe.js'
import {
  CHECKOUT_CURRENCY,
  gatewayNeedsSar,
  resolveCheckoutLane,
  toUsdMajor,
  usdToSarMajor,
} from '../utils/checkoutCurrency.js'
import {
  getRawBody,
  verifyMoyasarWebhook,
  verifyTabbyWebhook,
  verifyTamaraWebhook,
} from '../utils/webhookAuth.js'

const router = express.Router()

const getMoyasarConfig = async () => {
  const settings = await SystemSettings.findOne({ key: 'global' })
  const payment = settings?.payment?.toObject?.() || settings?.payment || {}
  const moyasar = payment?.moyasar || {}
  return {
    enabled: moyasar.enabled === true,
    publishableKey: moyasar.publishableKey || '',
    secretKey: moyasar.secretKey || '',
    webhookSecret: moyasar.webhookSecret || '',
    environment: moyasar.environment || 'test',
  }
}

const MOYASAR_API_BASE = 'https://api.moyasar.com'

const getTabbyConfig = async () => {
  const settings = await SystemSettings.findOne({ key: 'global' })
  const payment = settings?.payment?.toObject?.() || settings?.payment || {}
  const tabby = payment?.tabby || {}
  return {
    enabled: tabby.enabled === true,
    publicKey: tabby.publicKey || '',
    secretKey: tabby.secretKey || '',
    merchantCode: tabby.merchantCode || '',
    environment: tabby.environment || 'test',
  }
}

const getTamaraConfig = async () => {
  const settings = await SystemSettings.findOne({ key: 'global' })
  const payment = settings?.payment?.toObject?.() || settings?.payment || {}
  const tamara = payment?.tamara || {}
  return {
    enabled: tamara.enabled === true,
    apiToken: tamara.apiToken || '',
    notificationToken: tamara.notificationToken || '',
    environment: tamara.environment || 'test',
  }
}

const TABBY_API_BASE = 'https://api.tabby.ai/api/v1'
const TAMARA_API_BASE = (env) => env === 'live' ? 'https://api.tamara.co/api/v1' : 'https://api-sandbox.tamara.co/api/v1'

const applyTenantUpgrade = async ({ tenantId, demoEmail, plan, billingCycle, amountHalalas, currency, paymentId, zatcaPhase2 = false }) => {
  if (!tenantId) return

  const prior = await Tenant.findById(tenantId).select('subscription demoUpgraded isDemo createdAt').lean()
  const wasActive = prior?.subscription?.status === 'active' && prior?.demoUpgraded === true
  const wasTrial = String(prior?.subscription?.plan || '').toLowerCase() === 'trial' || prior?.isDemo === true
  const paidPrior = isPaidPlanId(prior?.subscription?.plan)

  const now = new Date()
  const endDate = nextSubscriptionEndDate(prior?.subscription?.endDate, billingCycle, now)
  const startDate = paidPrior && prior?.subscription?.startDate
    ? new Date(prior.subscription.startDate)
    : now

  const entitlements = getPlanEntitlements(plan, billingCycle)
  const update = {
    isDemo: false,
    demoUpgraded: true,
    'subscription.plan': plan,
    'subscription.status': 'active',
    'subscription.startDate': startDate,
    'subscription.endDate': endDate,
    'subscription.billingCycle': billingCycle,
    'subscription.price': Number(amountHalalas) / 100,
    'subscription.maxUsers': entitlements.maxUsers,
    'subscription.maxInvoices': entitlements.maxInvoices,
    'subscription.maxQuotations': entitlements.maxQuotations,
  }

  if (zatcaPhase2 === true || zatcaPhase2 === '1' || zatcaPhase2 === 1) {
    update['zatca.phase'] = 2
  }

  await Tenant.findByIdAndUpdate(tenantId, update)

  if (demoEmail) {
    await DemoUser.findOneAndUpdate(
      { email: demoEmail },
      {
        isUpgraded: true,
        upgradedAt: now,
        paymentId,
        amount: Number(amountHalalas) / 100,
        currency,
        plan,
        billingCycle,
      }
    )
  }

  const upgradedTenant = await Tenant.findById(tenantId).lean()
  if (!paidPrior) {
    sendUpgradeWelcomeEmail({
      email: demoEmail || upgradedTenant?.demoEmail || '',
      tenant: upgradedTenant,
      plan,
      billingCycle,
      amount: Number(amountHalalas) / 100,
      currency,
    }).catch(() => {})
  }

  emitPlatformEvent(paidPrior || wasActive ? 'subscription_renewed' : 'subscription_started', {
    tenantId: String(tenantId),
    plan,
    billingCycle,
    amount: Number(amountHalalas) / 100,
    currency,
    paymentId,
  })

  if (!wasActive && wasTrial && String(plan || '').toLowerCase() !== 'trial') {
    const start = prior?.subscription?.startDate || prior?.createdAt
    const daysToConvert = start
      ? Math.max(0, Math.round((Date.now() - new Date(start).getTime()) / 86400000))
      : undefined
    emitPlatformEvent('trial_converted', {
      tenantId: String(tenantId),
      plan,
      billingCycle,
      daysToConvert,
      paymentId,
    })
  }
}

const applyTenantUpgradeIfAuthorized = async (req, metadata, args) => {
  if (!canFulfillPaymentForTenant(req, metadata)) return false
  await applyTenantUpgrade(args)
  return true
}

// @route   POST /api/payments/create-payment
// @desc    Create a Moyasar hosted invoice for demo user upgrade
// @access  Private (demo users only)
router.post('/create-payment', protect, async (req, res) => {
  try {
    const {
      amount: rawAmount,
      amountSar: rawAmountSar,
      currency: rawCurrency = CHECKOUT_CURRENCY,
      plan = 'professional',
      billingCycle = 'monthly',
      paymentMethod = 'creditcard',
      zatcaPhase2 = false,
      intent = 'subscribe',
    } = req.body

    const tenant = await Tenant.findById(req.user.tenantId)
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' })
    }

    // Any authenticated tenant may subscribe, upgrade, or renew from checkout.
    if (!tenant.isActive && tenant.subscription?.status !== 'expired') {
      return res.status(403).json({ error: 'Tenant account is inactive' })
    }

    // Dual list prices: `amount` is always the USD list; `amountSar` is the SAR list. No FX.
    const amountUsd = toUsdMajor(rawAmount, 'USD')
    const listedSar = Number(rawAmountSar)
    const lane = resolveCheckoutLane(tenant)
    const useSarGateway = gatewayNeedsSar(paymentMethod)
    const chargeSar = useSarGateway || lane === 'SAR'
    const currency = chargeSar ? 'SAR' : 'USD'
    const amount = chargeSar
      ? (Number.isFinite(listedSar) && listedSar > 0 ? Math.round(listedSar * 100) / 100 : usdToSarMajor(amountUsd))
      : amountUsd
    const finalAmount = Math.round(Number(amount) * 100)

    if (!finalAmount || finalAmount < 100) {
      return res.status(400).json({
        error: `Invalid amount: ${rawAmount} (USD ${amountUsd} → ${finalAmount} minor units)`,
      })
    }

    const frontendUrl = (process.env.FRONTEND_URL || `${req.protocol}://${req.get('host')}`).split(',')[0].trim().replace(/\/$/, '')
    const successUrl = `${frontendUrl}/payment-result?status=paid&tenantId=${tenant._id}&method=${paymentMethod}`
    const backUrl = `${frontendUrl}/demo-checkout`

    const upgradeMeta = {
      type: 'tenant_upgrade',
      tenantId: String(tenant._id),
      demoEmail: tenant.demoEmail || '',
      plan,
      billingCycle,
      amountMajor: String(amount),
      currency,
      chargeCurrency: currency,
      zatcaPhase2: zatcaPhase2 ? '1' : '0',
      intent: intent === 'renew' ? 'renew' : 'subscribe',
    }

    // --- Stripe checkout (platform SaaS upgrade) ---
    if (paymentMethod === 'stripe') {
      try {
        const session = await createStripeCheckoutSession({
          amountMajor: amount,
          currency,
          adaptivePricing: currency === 'USD',
          productName: `Maqder ERP — ${plan} (${billingCycle})`,
          productDescription: `Upgrade demo tenant to ${plan} plan`,
          customerEmail: tenant.demoEmail || tenant.business?.contactEmail || '',
          successUrl: `${frontendUrl}/payment-result?status=paid&tenantId=${tenant._id}&method=stripe&session_id={CHECKOUT_SESSION_ID}`,
          cancelUrl: backUrl,
          clientReferenceId: String(tenant._id),
          metadata: upgradeMeta,
        })
        return res.json({ id: session.id, status: session.status, url: session.url, provider: 'stripe' })
      } catch (err) {
        return res.status(400).json({ error: err.message || 'Failed to create Stripe checkout' })
      }
    }

    const config = await getMoyasarConfig()
    if (!config.enabled || !config.secretKey) {
      const stripeCfg = await getStripeConfig()
      if (stripeCfg.enabled && stripeCfg.secretKey) {
        try {
          const session = await createStripeCheckoutSession({
            amountMajor: amount,
            currency,
            adaptivePricing: currency === 'USD',
            productName: `Maqder ERP — ${plan} (${billingCycle})`,
            productDescription: `Upgrade demo tenant to ${plan} plan`,
            customerEmail: tenant.demoEmail || tenant.business?.contactEmail || '',
            successUrl: `${frontendUrl}/payment-result?status=paid&tenantId=${tenant._id}&method=stripe&session_id={CHECKOUT_SESSION_ID}`,
            cancelUrl: backUrl,
            clientReferenceId: String(tenant._id),
            metadata: upgradeMeta,
          })
          return res.json({ id: session.id, status: session.status, url: session.url, provider: 'stripe' })
        } catch (err) {
          return res.status(400).json({ error: err.message || 'Failed to create Stripe checkout' })
        }
      }
      return res.status(400).json({ error: 'Payment gateway is not configured' })
    }

    if (paymentMethod === 'stcpay') {
      return res.status(400).json({ error: 'STC Pay integration is coming soon. Please use Credit Card, Apple Pay, or Stripe.' })
    }

    // --- Tabby checkout ---
    if (paymentMethod === 'tabby') {
      const tabbyConfig = await getTabbyConfig()
      if (!tabbyConfig.enabled || !tabbyConfig.secretKey) {
        return res.status(400).json({ error: 'Tabby is not configured' })
      }

      const tabbyBody = {
        amount: finalAmount / 100,
        currency,
        description: `Maqder ERP - ${plan} plan (${billingCycle})`,
        merchant_code: tabbyConfig.merchantCode,
        order: {
          reference_id: String(tenant._id),
          items: [{
            title: `Maqder ERP ${plan} plan`,
            description: `${plan} plan - ${billingCycle} billing`,
            quantity: 1,
            unit_price: finalAmount / 100,
            category: 'software',
          }],
          tax_amount: 0,
          shipping_amount: 0,
          discount_amount: 0,
        },
        buyer: {
          email: tenant.demoEmail || '',
          phone: tenant.phone || '',
          name: tenant.name || '',
        },
        success_url: successUrl,
        cancel_url: backUrl,
        failure_url: `${frontendUrl}/payment-result?status=failed&tenantId=${tenant._id}&method=tabby`,
        metadata: {
          tenantId: String(tenant._id),
          demoEmail: tenant.demoEmail || '',
          plan,
          billingCycle,
          paymentMethod: 'tabby',
          zatcaPhase2: zatcaPhase2 ? '1' : '0',
        },
      }

      const tabbyRes = await fetch(`${TABBY_API_BASE}/checkouts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tabbyConfig.secretKey.trim()}`,
        },
        body: JSON.stringify(tabbyBody),
      })

      const tabbyData = await tabbyRes.json()
      if (!tabbyRes.ok) {
        console.error('[Tabby] Checkout creation failed:', tabbyRes.status, JSON.stringify(tabbyData))
        return res.status(400).json({ error: tabbyData?.errors?.[0]?.message || tabbyData?.message || 'Failed to create Tabby checkout', tabbyError: tabbyData })
      }

      res.json({ id: tabbyData.id, status: tabbyData.status, url: tabbyData.configuration?.available_products?.installments?.[0]?.web_url || tabbyData.payment_url || tabbyData.url })
      return
    }

    // --- Tamara checkout ---
    if (paymentMethod === 'tamara') {
      const tamaraConfig = await getTamaraConfig()
      if (!tamaraConfig.enabled || !tamaraConfig.apiToken) {
        return res.status(400).json({ error: 'Tamara is not configured' })
      }

      const tamaraBody = {
        order_reference_id: String(tenant._id),
        total_amount: { amount: finalAmount / 100, currency },
        description: `Maqder ERP - ${plan} plan (${billingCycle})`,
        country_code: 'SA',
        payment_type: 'PAY_BY_INSTALMENTS',
        items: [{
          name: `Maqder ERP ${plan} plan`,
          reference_id: String(tenant._id),
          type: 'Digital',
          quantity: 1,
          unit_price: { amount: finalAmount / 100, currency },
          total_amount: { amount: finalAmount / 100, currency },
          tax_amount: { amount: 0, currency },
          discount_amount: { amount: 0, currency },
        }],
        consumer: {
          email: tenant.demoEmail || '',
          phone_number: tenant.phone || '',
          first_name: tenant.name || '',
          last_name: '',
        },
        billing_address: {
          first_name: tenant.name || '',
          last_name: '',
          email: tenant.demoEmail || '',
          phone_number: tenant.phone || '',
          country: 'SA',
        },
        shipping_address: {
          first_name: tenant.name || '',
          last_name: '',
          email: tenant.demoEmail || '',
          phone_number: tenant.phone || '',
          country: 'SA',
        },
        success_url: successUrl,
        failure_url: `${frontendUrl}/payment-result?status=failed&tenantId=${tenant._id}&method=tamara`,
        notification_url: `${frontendUrl}/api/payments/tamara-webhook`,
        metadata: {
          tenantId: String(tenant._id),
          demoEmail: tenant.demoEmail || '',
          plan,
          billingCycle,
          paymentMethod: 'tamara',
          zatcaPhase2: zatcaPhase2 ? '1' : '0',
        },
      }

      const tamaraRes = await fetch(`${TAMARA_API_BASE(tamaraConfig.environment)}/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tamaraConfig.apiToken.trim()}`,
        },
        body: JSON.stringify(tamaraBody),
      })

      const tamaraData = await tamaraRes.json()
      if (!tamaraRes.ok) {
        console.error('[Tamara] Checkout creation failed:', tamaraRes.status, JSON.stringify(tamaraData))
        return res.status(400).json({ error: tamaraData?.errors?.[0]?.message || tamaraData?.message || 'Failed to create Tamara checkout', tamaraError: tamaraData })
      }

      res.json({ id: tamaraData.checkout_id || tamaraData.order_id, status: 'created', url: tamaraData.checkout_url || tamaraData.url })
      return
    }

    // --- Moyasar invoice (default) ---
    const callbackUrl = `${frontendUrl}/api/payments/invoice-webhook`

    const requestBody = {
      amount: finalAmount,
      currency,
      description: `Maqder ERP - ${plan} plan (${billingCycle}) upgrade for ${tenant.demoEmail || tenant.name}`,
      callback_url: callbackUrl,
      success_url: successUrl,
      back_url: backUrl,
      metadata: {
        tenantId: String(tenant._id),
        demoEmail: tenant.demoEmail || '',
        plan,
        billingCycle,
        zatcaPhase2: zatcaPhase2 ? '1' : '0',
      },
    }

    const response = await fetch(`${MOYASAR_API_BASE}/v1/invoices`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(config.secretKey.trim() + ':').toString('base64')}`,
      },
      body: JSON.stringify(requestBody),
    })

    const invoiceData = await response.json()

    if (!response.ok) {
      console.error('[Moyasar] Invoice creation failed:', response.status, JSON.stringify(invoiceData))
      return res.status(400).json({
        error: invoiceData?.message || 'Failed to create invoice',
        moyasarError: invoiceData,
      })
    }

    res.json({
      id: invoiceData.id,
      status: invoiceData.status,
      url: invoiceData.url,
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// @route   POST /api/payments/invoice-webhook
// @desc    Moyasar invoice webhook — invoked with the invoice object when paid
// @access  Public (signature required when payments enabled)
router.post('/invoice-webhook', async (req, res) => {
  try {
    const config = await getMoyasarConfig()
    if (!config.enabled) {
      return res.status(503).json({ error: 'Payments disabled' })
    }
    if (!config.webhookSecret) {
      return res.status(503).json({ error: 'Moyasar webhook secret not configured' })
    }
    if (!verifyMoyasarWebhook(req, config.webhookSecret)) {
      return res.status(401).json({ error: 'Invalid Moyasar signature' })
    }

    const invoice = req.body

    if (invoice?.status === 'paid') {
      await applyTenantUpgrade({
        tenantId: invoice?.metadata?.tenantId,
        demoEmail: invoice?.metadata?.demoEmail,
        plan: invoice?.metadata?.plan || 'professional',
        billingCycle: invoice?.metadata?.billingCycle || 'monthly',
        amountHalalas: invoice.amount,
        currency: invoice.currency,
        paymentId: invoice.id,
        zatcaPhase2: invoice?.metadata?.zatcaPhase2,
      })
    }

    res.status(200).json({ received: true })
  } catch (error) {
    console.error('[Moyasar] Invoice webhook error:', error.message)
    res.status(500).json({ error: error.message })
  }
})

// @route   POST /api/payments/tabby-webhook
// @desc    Tabby webhook handler for payment status updates
// @access  Public (Authorization / signature required)
router.post('/tabby-webhook', async (req, res) => {
  try {
    const config = await getTabbyConfig()
    if (!config.enabled) {
      return res.status(503).json({ error: 'Tabby payments disabled' })
    }
    if (!config.secretKey) {
      return res.status(503).json({ error: 'Tabby secret not configured' })
    }
    if (!verifyTabbyWebhook(req, config.secretKey)) {
      return res.status(401).json({ error: 'Invalid Tabby signature' })
    }

    const body = req.body

    // Tabby sends events with type and data
    const payment = body?.data?.payment || body?.payment || body
    const meta = payment?.metadata || body?.metadata || {}

    const status = payment?.status || body?.status

    if (status === 'authorized' || status === 'captured' || status === 'closed' || body?.type === 'payment.succeeded') {
      await applyTenantUpgrade({
        tenantId: meta.tenantId,
        demoEmail: meta.demoEmail,
        plan: meta.plan || 'professional',
        billingCycle: meta.billingCycle || 'monthly',
        amountHalalas: Math.round((payment?.amount || body?.amount || 0) * 100),
        currency: payment?.currency || body?.currency || 'SAR',
        paymentId: payment?.id || body?.id,
        zatcaPhase2: meta.zatcaPhase2,
      })
    }

    res.status(200).json({ received: true })
  } catch (error) {
    console.error('[Tabby] Webhook error:', error.message)
    res.status(500).json({ error: error.message })
  }
})

// @route   POST /api/payments/tamara-webhook
// @desc    Tamara webhook handler for payment status updates
// @access  Public (notification token required)
router.post('/tamara-webhook', async (req, res) => {
  try {
    const config = await getTamaraConfig()
    if (!config.enabled) {
      return res.status(503).json({ error: 'Tamara payments disabled' })
    }
    if (!config.notificationToken) {
      return res.status(503).json({ error: 'Tamara notification token not configured' })
    }
    if (!verifyTamaraWebhook(req, config.notificationToken)) {
      return res.status(401).json({ error: 'Invalid Tamara signature' })
    }

    const body = req.body

    const eventType = body?.event_type || body?.type
    const order = body?.order || body?.data?.order || body
    const meta = order?.metadata || body?.metadata || {}

    const orderStatus = order?.status || body?.order_status

    // Tamara statuses: 'approved', 'partially_captured', 'fully_captured'
    if (eventType === 'order_approved' || eventType === 'order_fully_captured' || orderStatus === 'approved' || orderStatus === 'fully_captured') {
      const totalAmount = order?.total_amount || body?.total_amount || {}
      await applyTenantUpgrade({
        tenantId: meta.tenantId,
        demoEmail: meta.demoEmail,
        plan: meta.plan || 'professional',
        billingCycle: meta.billingCycle || 'monthly',
        amountHalalas: Math.round((totalAmount.amount || totalAmount || 0) * 100),
        currency: totalAmount.currency || 'SAR',
        paymentId: order?.order_id || order?.order_reference_id || body?.order_id,
      })
    }

    res.status(200).json({ received: true })
  } catch (error) {
    console.error('[Tamara] Webhook error:', error.message)
    res.status(500).json({ error: error.message })
  }
})

// @route   GET /api/payments/tabby/:id
// @desc    Fetch Tabby checkout status and apply upgrade if authorized
// @access  Private
router.get('/tabby/:id', protect, async (req, res) => {
  try {
    const config = await getTabbyConfig()
    if (!config.enabled || !config.secretKey) {
      return res.status(400).json({ error: 'Tabby is not configured' })
    }

    const response = await fetch(`${TABBY_API_BASE}/checkouts/${req.params.id}`, {
      headers: { 'Authorization': `Bearer ${config.secretKey.trim()}` },
    })

    const checkout = await response.json()
    if (!response.ok) {
      return res.status(400).json({ error: checkout?.message || 'Failed to fetch Tabby checkout' })
    }

    const status = checkout?.payment?.status || checkout?.status
    const meta = checkout?.metadata || checkout?.payment?.metadata || {}
    if (rejectUnauthorizedPaymentPoll(req, res, meta)) return

    if (status === 'authorized' || status === 'captured' || status === 'closed') {
      await applyTenantUpgradeIfAuthorized(req, meta, {
        tenantId: meta.tenantId,
        demoEmail: meta.demoEmail,
        plan: meta.plan || 'professional',
        billingCycle: meta.billingCycle || 'monthly',
        amountHalalas: Math.round((checkout?.payment?.amount || checkout?.amount || 0) * 100),
        currency: checkout?.payment?.currency || checkout?.currency || 'SAR',
        paymentId: checkout?.id,
      })
    }

    res.json({ id: checkout.id, status })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// @route   GET /api/payments/tamara/:id
// @desc    Fetch Tamara order status and apply upgrade if approved
// @access  Private
router.get('/tamara/:id', protect, async (req, res) => {
  try {
    const config = await getTamaraConfig()
    if (!config.enabled || !config.apiToken) {
      return res.status(400).json({ error: 'Tamara is not configured' })
    }

    const response = await fetch(`${TAMARA_API_BASE(config.environment)}/orders/${req.params.id}`, {
      headers: { 'Authorization': `Bearer ${config.apiToken.trim()}` },
    })

    const order = await response.json()
    if (!response.ok) {
      return res.status(400).json({ error: order?.message || 'Failed to fetch Tamara order' })
    }

    const status = order?.status
    const meta = order?.metadata || {}
    if (rejectUnauthorizedPaymentPoll(req, res, meta)) return

    if (status === 'approved' || status === 'fully_captured') {
      const totalAmount = order?.total_amount || {}
      await applyTenantUpgradeIfAuthorized(req, meta, {
        tenantId: meta.tenantId,
        demoEmail: meta.demoEmail,
        plan: meta.plan || 'professional',
        billingCycle: meta.billingCycle || 'monthly',
        amountHalalas: Math.round((totalAmount.amount || 0) * 100),
        currency: totalAmount.currency || 'SAR',
        paymentId: order?.order_id,
      })
    }

    res.json({ id: order?.order_id, status })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// @route   GET /api/payments/callback
// @desc    Legacy Moyasar payment callback - redirect to frontend
// @access  Public
router.get('/callback', async (req, res) => {
  const { id, status, tenantId } = req.query
  const frontendUrl = process.env.FRONTEND_URL || 'https://maqder.com'
  res.redirect(`${frontendUrl}/payment-result?id=${id}&status=${status}&tenantId=${tenantId || ''}`)
})

// @route   POST /api/payments/webhook
// @desc    Moyasar webhook handler
// @access  Public (verified by webhook secret — fail closed)
router.post('/webhook', async (req, res) => {
  try {
    const config = await getMoyasarConfig()
    if (!config.enabled) {
      return res.status(503).json({ error: 'Payments disabled' })
    }
    if (!config.webhookSecret) {
      return res.status(503).json({ error: 'Moyasar webhook secret not configured' })
    }
    if (!verifyMoyasarWebhook(req, config.webhookSecret)) {
      return res.status(401).json({ error: 'Invalid Moyasar signature' })
    }

    const body = req.body

    if (body?.type === 'payment.created' || body?.type === 'payment.updated') {
      const payment = body?.data || body
      const paymentStatus = payment?.status

      if (paymentStatus === 'paid') {
        await applyTenantUpgrade({
          tenantId: payment?.metadata?.tenantId,
          demoEmail: payment?.metadata?.demoEmail,
          plan: payment?.metadata?.plan || 'professional',
          billingCycle: payment?.metadata?.billingCycle || 'monthly',
          amountHalalas: payment.amount,
          currency: payment.currency,
          paymentId: payment.id,
          zatcaPhase2: payment?.metadata?.zatcaPhase2,
        })
      }
    }

    res.status(200).json({ received: true })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// @route   GET /api/payments/invoice/:id
// @desc    Fetch invoice status directly from Moyasar and apply tenant upgrade if paid
//          (fallback in case the invoice-webhook can't reach this server)
// @access  Private
router.get('/invoice/:id', protect, async (req, res) => {
  try {
    const config = await getMoyasarConfig()
    if (!config.enabled || !config.secretKey) {
      return res.status(400).json({ error: 'Payment gateway is not configured' })
    }

    const response = await fetch(`${MOYASAR_API_BASE}/v1/invoices/${req.params.id}`, {
      headers: {
        'Authorization': `Basic ${Buffer.from(config.secretKey.trim() + ':').toString('base64')}`,
      },
    })

    const invoice = await response.json()

    if (!response.ok) {
      return res.status(400).json({ error: invoice?.message || 'Failed to fetch invoice' })
    }

    const invoiceMeta = invoice?.metadata || {}
    if (rejectUnauthorizedPaymentPoll(req, res, invoiceMeta)) return

    if (invoice.status === 'paid') {
      await applyTenantUpgradeIfAuthorized(req, invoiceMeta, {
        tenantId: invoice?.metadata?.tenantId,
        demoEmail: invoice?.metadata?.demoEmail,
        plan: invoice?.metadata?.plan || 'professional',
        billingCycle: invoice?.metadata?.billingCycle || 'monthly',
        amountHalalas: invoice.amount,
        currency: invoice.currency,
        paymentId: invoice.id,
        zatcaPhase2: invoice?.metadata?.zatcaPhase2,
      })
    }

    res.json({ id: invoice.id, status: invoice.status })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// @route   GET /api/payments/tenant-status/:tenantId
// @desc    Check whether a tenant has been upgraded (used by the payment result page
//          for the invoice-based flow, since the invoice ID isn't returned to the browser)
// @access  Private
router.get('/tenant-status/:tenantId', protect, async (req, res) => {
  try {
    const isOwnTenant = String(req.user.tenantId) === String(req.params.tenantId)
    const isSuperAdmin = req.user.role === 'super_admin'
    if (!isOwnTenant && !isSuperAdmin) {
      return res.status(403).json({ error: 'Not authorized to view this tenant status' })
    }

    const tenant = await Tenant.findById(req.params.tenantId).select('isDemo demoUpgraded subscription').lean()
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' })
    }
    res.json({
      isDemo: tenant.isDemo,
      demoUpgraded: tenant.demoUpgraded === true,
      subscription: tenant.subscription,
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

const handleStripeCheckoutCompleted = async (session) => {
  const meta = session?.metadata || {}
  const type = meta.type || 'tenant_upgrade'

  if (type === 'app_store') {
    const { fulfillAppStorePurchase } = await import('./appStore.routes.js')
    await fulfillAppStorePurchase({
      tenantId: meta.tenantId,
      appId: meta.appId,
      billingCycle: meta.billingCycle || 'monthly',
      amountMajor: Number(meta.amountMajor || (session.amount_total || 0) / 100),
      currency: (meta.currency || session.currency || 'SAR').toUpperCase(),
      paymentId: session.id,
      provider: 'stripe',
    })
    return { type: 'app_store', appId: meta.appId }
  }

  await applyTenantUpgrade({
    tenantId: meta.tenantId,
    demoEmail: meta.demoEmail,
    plan: meta.plan || 'professional',
    billingCycle: meta.billingCycle || 'monthly',
    amountHalalas: Math.round(Number(meta.amountMajor || (session.amount_total || 0) / 100) * 100),
    currency: (meta.currency || session.currency || CHECKOUT_CURRENCY).toUpperCase(),
    paymentId: session.id,
    zatcaPhase2: meta.zatcaPhase2,
  })
  return { type: 'tenant_upgrade', tenantId: meta.tenantId }
}

const handleStripePaymentFailed = async (event) => {
  const ctx = stripeFailureContext(event)
  emitPlatformEvent('subscription_payment_failed', {
    tenantId: ctx.tenantId || undefined,
    email: ctx.email || undefined,
    stripeEvent: event?.type,
    reason: ctx.reason,
  })
  let tenant = null
  if (ctx.tenantId) {
    tenant = await Tenant.findById(ctx.tenantId).select('name slug business.contactEmail').lean()
  }
  await sendPaymentFailedEmail({
    tenant,
    tenantId: ctx.tenantId,
    email: ctx.email,
    plan: ctx.plan,
    reason: ctx.reason,
  })
  return ctx
}

// @route   GET /api/payments/stripe-session/:id
// @desc    Confirm Stripe Checkout Session and fulfill entitlements (success-page fallback)
router.get('/stripe-session/:id', protect, async (req, res) => {
  try {
    const session = await retrieveStripeCheckoutSession(req.params.id)
    const meta = session?.metadata || {}
    if (rejectUnauthorizedPaymentPoll(req, res, meta)) return
    if (session.payment_status !== 'paid' && session.status !== 'complete') {
      return res.json({ paid: false, status: session.payment_status || session.status, sessionId: session.id })
    }
    const result = await handleStripeCheckoutCompleted(session)
    res.json({ paid: true, sessionId: session.id, ...result })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

// Stripe webhook — mounted with express.raw in server.js
export async function stripeWebhookHandler(req, res) {
  try {
    const config = await getStripeConfig()
    if (!config.enabled) {
      return res.status(503).json({ error: 'Stripe payments disabled' })
    }
    if (!config.webhookSecret) {
      return res.status(503).json({ error: 'Stripe webhook secret not configured' })
    }

    const rawBody = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : (typeof req.body === 'string' ? req.body : getRawBody(req))

    const ok = verifyStripeWebhookSignature({
      headers: req.headers,
      rawBody,
      webhookSecret: config.webhookSecret,
    })
    if (!ok) {
      return res.status(400).json({ error: 'Invalid Stripe signature' })
    }

    const event = typeof req.body === 'object' && !Buffer.isBuffer(req.body)
      ? req.body
      : JSON.parse(rawBody)

    if (isStripeFulfillmentEvent(event.type)) {
      const session = event.data?.object
      if (session) await handleStripeCheckoutCompleted(session)
    } else if (isStripePaymentFailedEvent(event.type)) {
      await handleStripePaymentFailed(event)
    }

    res.json({ received: true })
  } catch (error) {
    console.error('[Stripe webhook]', error.message)
    res.status(500).json({ error: error.message })
  }
}

// @route   GET /api/payments/:id
// @desc    Get payment status by ID
// @access  Private
router.get('/:id', protect, async (req, res) => {
  try {
    const config = await getMoyasarConfig()
    if (!config.enabled || !config.secretKey) {
      return res.status(400).json({ error: 'Payment gateway is not configured' })
    }

    const response = await fetch(`${MOYASAR_API_BASE}/v1/payments/${req.params.id}`, {
      headers: {
        'Authorization': `Basic ${Buffer.from(config.secretKey + ':').toString('base64')}`,
      },
    })

    const paymentData = await response.json()

    if (!response.ok) {
      return res.status(400).json({ error: paymentData?.message || 'Failed to fetch payment' })
    }

    const meta = paymentData?.metadata || {}
    if (rejectUnauthorizedPaymentPoll(req, res, meta)) return

    if (paymentData.status === 'paid') {
      await applyTenantUpgradeIfAuthorized(req, meta, {
        tenantId: meta.tenantId,
        demoEmail: meta.demoEmail,
        plan: meta.plan || 'professional',
        billingCycle: meta.billingCycle || 'monthly',
        amountHalalas: paymentData.amount,
        currency: paymentData.currency,
        paymentId: paymentData.id,
        zatcaPhase2: meta.zatcaPhase2,
      })
    }

    res.json({
      id: paymentData.id,
      status: paymentData.status,
      amount: Number(paymentData.amount) / 100,
      currency: paymentData.currency,
      source: paymentData.source,
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

export default router
