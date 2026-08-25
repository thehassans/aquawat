import express from 'express'
import mongoose from 'mongoose'
import jwt from 'jsonwebtoken'
import Tenant from '../models/Tenant.js'
import User from '../models/User.js'
import SystemSettings, { getDefaultPricingPlans, getDefaultPlansByBusinessType, overlayCatalogPrices } from '../models/SystemSettings.js'
import RestaurantMenuItem from '../models/RestaurantMenuItem.js'
import RestaurantOrder from '../models/RestaurantOrder.js'
import SaloonService from '../models/SaloonService.js'
import DemoUser from '../models/DemoUser.js'
import { sendDemoWelcomeEmail } from '../utils/emailService.js'
import { normalizeBusinessTypes, BUSINESS_TYPES } from '../utils/businessTypes.js'
import { provisionTenantApps } from '../utils/appProvisioning.js'
import { createCheckoutSession } from '../services/paymentService.js'

const router = express.Router()
const parsedDatabaseQueryTimeoutMs = Number(process.env.MONGODB_QUERY_TIMEOUT_MS || 10000)
const databaseQueryTimeoutMs = Number.isFinite(parsedDatabaseQueryTimeoutMs) && parsedDatabaseQueryTimeoutMs > 0 ? parsedDatabaseQueryTimeoutMs : 10000

const withQueryTimeout = (query) => query.maxTimeMS(databaseQueryTimeoutMs)

const isDatabaseAvailabilityError = (error) => {
  const message = String(error?.message || '').toLowerCase()

  return message.includes('buffering timed out')
    || message.includes('timed out after')
    || message.includes('server selection')
    || message.includes('ecconnrefused')
    || message.includes('not connected')
    || message.includes('initial connection')
    || message.includes('topology is closed')
    || message.includes('client must be connected')
}

const sendRouteError = (res, error) => {
  if (isDatabaseAvailabilityError(error)) {
    return res.status(503).json({ error: 'Service temporarily unavailable. Please try again in a moment.' })
  }

  return res.status(500).json({ error: error.message })
}

// @route   GET /api/public/telemetry
// Public analytics + Sentry DSN only (no secrets). Used to init client SDKs.
router.get('/telemetry', async (req, res) => {
  try {
    const settings = await withQueryTimeout(
      SystemSettings.findOne({ key: 'global' }).select('analytics errorTracking')
    ).lean()

    const analytics = settings?.analytics || {}
    const errorTracking = settings?.errorTracking || {}

    res.set('Cache-Control', 'public, max-age=60')
    res.json({
      analytics: {
        enabled: analytics.enabled === true,
        provider: analytics.provider || 'posthog',
        apiKey: analytics.enabled ? (analytics.apiKey || '') : '',
        endpoint: analytics.enabled ? (analytics.endpoint || '') : '',
      },
      errorTracking: {
        enabled: errorTracking.enabled === true,
        provider: errorTracking.provider || 'sentry',
        dsn: errorTracking.enabled ? (errorTracking.dsn || '') : '',
      },
    })
  } catch (error) {
    return sendRouteError(res, error)
  }
})

const createDefaultSettings = () => new SystemSettings({ key: 'global', website: {} })

const getGlobalSettings = async () => {
  const defaultSettings = createDefaultSettings()

  if (SystemSettings.db.readyState !== 1) {
    return defaultSettings
  }

  try {
    const existing = await SystemSettings.findOne({ key: 'global' }).maxTimeMS(3000)
    if (existing) {
      if (!existing.website) {
        existing.website = defaultSettings.website?.toObject?.() || {}
        existing.markModified('website')
        try {
          await existing.save()
        } catch {
        }
      }
      return existing
    }

    try {
      return await SystemSettings.create({ key: 'global', website: {} })
    } catch {
      return defaultSettings
    }
  } catch {
    return defaultSettings
  }
}

const maskSecret = (value) => {
  if (!value) return ''
  const v = String(value)
  if (v.length <= 4) return '****'
  return `${v.slice(0, 2)}***${v.slice(-2)}`
}

const mergeWebsiteDefaults = (website) => {
  const defaultsDoc = new SystemSettings({ key: 'global' })
  const defaults = defaultsDoc.website?.toObject?.() || defaultsDoc.website || {}
  const current = website?.toObject?.() || website || {}
  const currentPlans = current.pricing?.plans
  const hasPlans = Array.isArray(currentPlans) && currentPlans.length > 0
  const currentPlansByBusinessType = current.pricing?.plansByBusinessType
  const hasPlansByBusinessType = Array.isArray(currentPlansByBusinessType)

  const existingMap = new Map((hasPlansByBusinessType ? currentPlansByBusinessType : []).map((p) => [p.businessType, p]))
  const mergedPlansByBusinessType = BUSINESS_TYPES.map((type) => {
    if (existingMap.has(type)) return existingMap.get(type)
    return { businessType: type, plans: getDefaultPlansByBusinessType(type) }
  })

  return {
    ...defaults,
    ...current,
    hero: { ...(defaults.hero || {}), ...(current.hero || {}) },
    cta: { ...(defaults.cta || {}), ...(current.cta || {}) },
    demo: { ...(defaults.demo || {}), ...(current.demo || {}) },
    pricing: {
      ...(defaults.pricing || {}),
      ...(current.pricing || {}),
      plans: overlayCatalogPrices(hasPlans ? currentPlans : getDefaultPricingPlans()),
      plansByBusinessType: mergedPlansByBusinessType.map((row) => ({
        ...row,
        plans: overlayCatalogPrices(row?.plans),
      })),
    },
  }
}

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d',
  })
}

const normalizeStoredPlanLabels = (plans = []) =>
  (Array.isArray(plans) ? plans : []).map((plan) => {
    if (!plan) return plan
    const id = String(plan.id || '').toLowerCase()
    const nameEn = String(plan.nameEn || '')
    const nameAr = String(plan.nameAr || '')
    const isEnterprise =
      id === 'enterprise' ||
      /ultra\s*premium/i.test(nameEn) ||
      /ألترا\s*بريميوم/.test(nameAr) ||
      /ultra\s*premium/i.test(nameAr)
    if (!isEnterprise) return plan
    return {
      ...(typeof plan.toObject === 'function' ? plan.toObject() : plan),
      id: 'enterprise',
      nameEn: 'Enterprise',
      nameAr: 'المؤسسات',
    }
  })

const resolvePricingForBusinessType = (pricing, businessType) => {
  if (!businessType) {
    return {
      ...pricing,
      plans: normalizeStoredPlanLabels(pricing?.plans),
      plansByBusinessType: (pricing?.plansByBusinessType || []).map((row) => ({
        ...row,
        plans: normalizeStoredPlanLabels(row?.plans),
      })),
    }
  }
  const custom = pricing?.plansByBusinessType?.find((p) => p.businessType === businessType)
  const plans = overlayCatalogPrices(custom?.plans?.length ? custom.plans : getDefaultPlansByBusinessType(businessType))
  return {
    ...pricing,
    plans: normalizeStoredPlanLabels(plans),
  }
}

router.get('/website', async (req, res) => {
  try {
    const settings = await getGlobalSettings()
    const website = mergeWebsiteDefaults(settings.website)
    const businessType = normalizeBusinessTypes(req.query.businessType)[0]
    const pricing = resolvePricingForBusinessType(website.pricing, businessType)

    const payment = settings?.payment?.toObject?.() || settings?.payment || {}
    const moyasar = payment?.moyasar || {}
    const applePay = payment?.applePay || {}
    const stcPay = payment?.stcPay || {}
    const tabby = payment?.tabby || {}
    const tamara = payment?.tamara || {}

    res.json({
      ...website,
      pricing,
      demo: {
        enabled: !!website?.demo?.enabled,
        tenantSlug: website?.demo?.tenantSlug || 'demo',
        email: website?.demo?.email || 'demo@maqder.com',
        hasPassword: !!website?.demo?.password,
        passwordMasked: maskSecret(website?.demo?.password),
        moyasarEnabled: moyasar.enabled === true,
        moyasarPublishableKey: moyasar.publishableKey || '',
      },
      paymentMethods: {
        moyasar: moyasar.enabled === true,
        applePay: applePay.enabled === true,
        stcPay: stcPay.enabled === true,
        tabby: tabby.enabled === true,
        tamara: tamara.enabled === true,
        stripe: payment?.stripe?.enabled === true,
      },
      stripePublishableKey: payment?.stripe?.enabled ? (payment?.stripe?.publishableKey || '') : '',
    })
  } catch (error) {
    sendRouteError(res, error)
  }
})

// @route   GET /api/public/tenant-branding/:slug
// @desc    Minimal, safe-to-expose branding for a tenant's alias login page
//          (`{slug}.maqder.com`). No auth — only non-sensitive display fields.
router.get('/tenant-branding/:slug', async (req, res) => {
  try {
    const slug = String(req.params.slug || '').trim().toLowerCase()
    if (!slug) return res.status(400).json({ error: 'Slug is required' })

    const tenant = await withQueryTimeout(
      Tenant.findOne({ slug, isActive: true }).select('name slug business.legalNameEn business.legalNameAr branding.logo branding.primaryColor branding.secondaryColor settings.currency')
    )

    if (!tenant) return res.status(404).json({ found: false })

    res.json({
      found: true,
      slug: tenant.slug,
      name: tenant.business?.legalNameEn || tenant.business?.legalNameAr || tenant.name,
      nameAr: tenant.business?.legalNameAr || tenant.name,
      logo: tenant.branding?.logo || null,
      primaryColor: tenant.branding?.primaryColor || '#14B8A6',
      secondaryColor: tenant.branding?.secondaryColor || '#D946EF',
      currency: String(tenant.settings?.currency || 'SAR').trim().toUpperCase(),
    })
  } catch (error) {
    sendRouteError(res, error)
  }
})

router.post('/demo-login', async (req, res) => {
  try {
    const databaseReady = await req.app.locals.waitForDatabaseReady?.()

    if (!databaseReady) {
      return res.status(503).json({ error: 'Live demo is temporarily unavailable. Please try again in a moment.' })
    }

    const settings = await getGlobalSettings()
    const demo = settings.website?.demo

    if (!demo?.enabled) {
      return res.status(400).json({ error: 'Demo is disabled' })
    }

    const tenantSlug = String(demo.tenantSlug || 'demo').trim().toLowerCase()
    const email = String(demo.email || '').trim().toLowerCase()

    if (!tenantSlug || !email) {
      return res.status(400).json({ error: 'Demo settings are incomplete' })
    }

    let tenant = await withQueryTimeout(Tenant.findOne({ slug: tenantSlug }).select('name slug business settings branding subscription isActive'))

    if (!tenant) {
      const now = Date.now()
      tenant = await Tenant.create({
        name: 'Maqder Demo',
        slug: tenantSlug,
        business: {
          legalNameAr: 'مقدّر - عرض تجريبي',
          legalNameEn: 'Maqder Demo',
          vatNumber: '',
          crNumber: ''
        },
        subscription: {
          plan: 'trial',
          status: 'active',
          maxUsers: 25,
          maxInvoices: 5000,
          billingCycle: 'monthly',
          price: 0
        },
        isActive: true
      })
      await provisionTenantApps(tenant, { save: true })
    }

    if (!tenant.isActive) {
      return res.status(401).json({ error: 'Demo tenant is inactive' })
    }

    let user = await withQueryTimeout(User.findOne({ email, tenantId: tenant._id }))

    if (!user) {
      user = await User.create({
        email,
        password: demo.password || 'Demo@12345',
        firstName: 'Demo',
        lastName: 'User',
        firstNameAr: 'تجريبي',
        lastNameAr: 'مستخدم',
        tenantId: tenant._id,
        role: 'admin',
        isActive: true,
      })
    }

    const token = generateToken(user._id)

    res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        firstNameAr: user.firstNameAr,
        lastNameAr: user.lastNameAr,
        role: user.role,
        permissions: user.permissions,
        preferences: user.preferences,
        avatar: user.avatar,
      },
      tenant: {
        _id: tenant._id,
        name: tenant.name,
        slug: tenant.slug,
        businessType: tenant.businessType,
        businessTypes: tenant.businessTypes,
        business: tenant.business,
        settings: tenant.settings,
        branding: tenant.branding,
        subscription: tenant.subscription
      },
    })
  } catch (error) {
    sendRouteError(res, error)
  }
})

router.post('/demo-signup', async (req, res) => {
  try {
    const databaseReady = await req.app.locals.waitForDatabaseReady?.()
    if (!databaseReady) {
      return res.status(503).json({ error: 'Service temporarily unavailable. Please try again in a moment.' })
    }

    const { email, businessType, country, currency, companyName, logo } = req.body

    const normalizedEmail = String(email || '').trim().toLowerCase()
    if (!normalizedEmail) {
      return res.status(400).json({ error: 'Email is required' })
    }

    if (!normalizedEmail.endsWith('@gmail.com')) {
      return res.status(400).json({ error: 'Please use a Gmail address to sign up for a demo' })
    }

    const normalizedBusinessTypes = normalizeBusinessTypes(businessType)
    if (normalizedBusinessTypes.length === 0) {
      return res.status(400).json({ error: 'Valid business type is required' })
    }
    const primaryBusinessType = normalizedBusinessTypes[0]

    const COUNTRY_META = {
      SA: { currency: 'SAR', timezone: 'Asia/Riyadh', taxRate: 15 },
      AE: { currency: 'AED', timezone: 'Asia/Dubai', taxRate: 5 },
      QA: { currency: 'QAR', timezone: 'Asia/Qatar', taxRate: 0 },
      KW: { currency: 'KWD', timezone: 'Asia/Kuwait', taxRate: 0 },
      BH: { currency: 'BHD', timezone: 'Asia/Bahrain', taxRate: 10 },
      OM: { currency: 'OMR', timezone: 'Asia/Muscat', taxRate: 5 },
      BD: { currency: 'BDT', timezone: 'Asia/Dhaka', taxRate: 15 },
      PK: { currency: 'PKR', timezone: 'Asia/Karachi', taxRate: 18 },
      IN: { currency: 'INR', timezone: 'Asia/Kolkata', taxRate: 18 },
      EG: { currency: 'EGP', timezone: 'Africa/Cairo', taxRate: 14 },
      JO: { currency: 'JOD', timezone: 'Asia/Amman', taxRate: 16 },
      US: { currency: 'USD', timezone: 'America/New_York', taxRate: 0 },
      GB: { currency: 'GBP', timezone: 'Europe/London', taxRate: 20 },
      TR: { currency: 'TRY', timezone: 'Europe/Istanbul', taxRate: 20 },
      MY: { currency: 'MYR', timezone: 'Asia/Kuala_Lumpur', taxRate: 6 },
      SG: { currency: 'SGD', timezone: 'Asia/Singapore', taxRate: 9 },
      OTHER: { currency: 'USD', timezone: 'UTC', taxRate: 0 },
    }
    const GCC = new Set(['SA', 'AE', 'QA', 'KW', 'BH', 'OM'])
    const countryCode = String(country || 'OTHER').trim().toUpperCase()
    const meta = COUNTRY_META[countryCode] || COUNTRY_META.OTHER
    const resolvedCurrency = String(currency || meta.currency || 'USD').trim().toUpperCase()
    const resolvedTimezone = meta.timezone || 'Asia/Riyadh'
    const resolvedTaxRate = typeof meta.taxRate === 'number' ? meta.taxRate : 15
    const company = String(companyName || '').trim() || `Demo - ${normalizedEmail}`
    const isGcc = GCC.has(countryCode) || ['SAR', 'AED', 'QAR', 'KWD', 'BHD', 'OMR'].includes(resolvedCurrency)

    const rawLogo = typeof logo === 'string' ? logo.trim() : ''
    const logoDataUrl = rawLogo.startsWith('data:image/') && rawLogo.length <= 4_200_000 ? rawLogo : ''

    const existingDemo = await DemoUser.findOne({ email: normalizedEmail })
    if (existingDemo) {
      return res.status(409).json({
        error: 'A demo account already exists for this email',
        existingDemo: true,
        tenantSlug: existingDemo.tenantId ? String(existingDemo.tenantId) : null,
      })
    }

    const trialStartDate = new Date()
    const trialEndDate = new Date(trialStartDate.getTime() + 7 * 24 * 60 * 60 * 1000)

    const slugBase = `demo-${normalizedEmail.replace(/[^a-z0-9]/g, '').slice(0, 15)}-${Date.now().toString(36)}`
    const password = `Demo${Date.now().toString(36).slice(-6)}@`

    const tenant = await Tenant.create({
      name: company,
      slug: slugBase,
      businessType: primaryBusinessType,
      businessTypes: normalizedBusinessTypes,
      business: {
        legalNameEn: company,
        ...(isGcc ? { legalNameAr: company } : {}),
        vatNumber: '',
        crNumber: '',
        contactEmail: normalizedEmail,
        address: {
          country: countryCode === 'OTHER' ? '' : countryCode,
        },
      },
      branding: {
        ...(logoDataUrl ? { logo: logoDataUrl } : {}),
        primaryColor: '#059669',
        secondaryColor: '#0D9488',
      },
      settings: {
        currency: resolvedCurrency,
        timezone: resolvedTimezone,
        taxRate: resolvedTaxRate,
        invoiceLanguage: 'auto',
        invoiceBranding: {
          showVision2030: resolvedCurrency === 'SAR',
        },
      },
      fta: {
        isEnabled: countryCode === 'AE' || resolvedCurrency === 'AED',
        trn: countryCode === 'AE' || resolvedCurrency === 'AED' ? `100${Date.now()}` : '',
        standardVatRate: 5,
      },
      ota: {
        isEnabled: countryCode === 'OM' || resolvedCurrency === 'OMR',
        tin: countryCode === 'OM' || resolvedCurrency === 'OMR' ? `OM1${Date.now()}` : '',
        standardVatRate: 5,
      },
      bahrainNbr: {
        isEnabled: countryCode === 'BH' || resolvedCurrency === 'BHD',
        vatAccountNumber: countryCode === 'BH' || resolvedCurrency === 'BHD' ? `200${Date.now()}` : '',
        standardVatRate: 10,
      },
      mofKuwait: {
        isEnabled: countryCode === 'KW' || resolvedCurrency === 'KWD',
        civilId: countryCode === 'KW' || resolvedCurrency === 'KWD' ? `KW${Date.now()}` : '',
      },
      gtaQatar: {
        isEnabled: countryCode === 'QA' || resolvedCurrency === 'QAR',
        tin: countryCode === 'QA' || resolvedCurrency === 'QAR' ? `QA${Date.now()}` : '',
      },
      subscription: {
        plan: 'trial',
        status: 'active',
        startDate: trialStartDate,
        endDate: trialEndDate,
        maxUsers: 1,
        maxInvoices: 10,
        maxQuotations: 10,
        billingCycle: 'monthly',
        price: 0,
      },
      isDemo: true,
      demoEmail: normalizedEmail,
      demoTrialEndsAt: trialEndDate,
      demoUpgraded: false,
      isActive: true,
    })

    await provisionTenantApps(tenant, { save: true })

    const user = await User.create({
      email: normalizedEmail,
      password,
      firstName: 'Demo',
      lastName: 'User',
      ...(isGcc ? { firstNameAr: 'تجريبي', lastNameAr: 'مستخدم' } : {}),
      tenantId: tenant._id,
      role: 'admin',
      isActive: true,
    })

    const demoUser = await DemoUser.create({
      email: normalizedEmail,
      tenantId: tenant._id,
      businessType: primaryBusinessType,
      businessTypes: normalizedBusinessTypes,
      currency: resolvedCurrency,
      trialStartDate,
      trialEndDate,
      isActive: true,
    })

    const welcomeEmail = await sendDemoWelcomeEmail({
      email: normalizedEmail,
      tenant,
      businessType: primaryBusinessType,
      trialEndDate,
      password,
      preferredLanguage: 'en',
    })

    const token = generateToken(user._id)

    res.status(201).json({
      token,
      message: 'Demo account created successfully',
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        firstNameAr: user.firstNameAr,
        lastNameAr: user.lastNameAr,
        role: user.role,
        permissions: user.permissions,
        preferences: user.preferences,
        avatar: user.avatar,
      },
      tenant: {
        _id: tenant._id,
        name: tenant.name,
        slug: tenant.slug,
        businessType: tenant.businessType,
        businessTypes: tenant.businessTypes,
        business: tenant.business,
        settings: tenant.settings,
        branding: tenant.branding,
        subscription: tenant.subscription,
        isDemo: tenant.isDemo,
        demoTrialEndsAt: tenant.demoTrialEndsAt,
        demoUpgraded: tenant.demoUpgraded,
      },
      welcomeEmail,
    })
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ error: 'A demo account already exists for this email' })
    }
    sendRouteError(res, error)
  }
})

router.get('/tenant/:id/menu', async (req, res) => {
  try {
    const tenant = await withQueryTimeout(
      Tenant.findById(req.params.id).select('name slug business branding settings isActive subscription.hasQrOrderingAddon')
    )

    if (!tenant || !tenant.isActive) {
      return res.status(404).json({ error: 'Restaurant not found or inactive' })
    }

    const items = await withQueryTimeout(
      RestaurantMenuItem.find({ tenantId: tenant._id, isActive: true }).select('-costPrice -supplier -supplierId').sort({ category: 1, nameEn: 1 })
    )

    const qrMenu = { ...(tenant.settings?.restaurant?.qrMenu || { defaultLanguage: 'ar' }) }
    const accepted = new Set(qrMenu.acceptedPayments || ['cash'])
    if (!qrMenu.tabbyApiKey || !qrMenu.tabbyMerchantCode) accepted.delete('tabby')
    if (!qrMenu.tamaraMerchantToken) accepted.delete('tamara')
    qrMenu.acceptedPayments = [...accepted]

    res.json({
      tenant: {
        name: tenant.name,
        business: tenant.business,
        branding: tenant.branding,
        settings: {
          restaurant: {
            qrMenu
          }
        },
        subscription: {
          hasQrOrderingAddon: tenant.subscription?.hasQrOrderingAddon === true,
        }
      },
      items
    })
  } catch (error) {
    sendRouteError(res, error)
  }
})

// @route   POST /api/public/tenant/:id/order
// @desc    Place a new public restaurant order via QR menu
router.post('/tenant/:id/order', async (req, res) => {
  try {
    const tenant = await withQueryTimeout(
      Tenant.findById(req.params.id).select('name subscription settings isActive')
    )

    if (!tenant || !tenant.isActive) {
      return res.status(404).json({ error: 'Restaurant not found or inactive' })
    }

    if (!tenant.subscription?.hasQrOrderingAddon) {
      return res.status(403).json({ error: 'Online ordering is not enabled for this restaurant' })
    }

    const {
      customerName,
      customerPhone,
      deliveryAddress,
      orderType = 'dine_in',
      tableNumber,
      paymentMethod = 'cash',
      notes,
      lineItems = []
    } = req.body

    if (!Array.isArray(lineItems) || lineItems.length === 0) {
      return res.status(400).json({ error: 'Order must contain at least one item.' })
    }

    if (!customerName || !customerPhone) {
      return res.status(400).json({ error: 'Customer name and phone number are required.' })
    }

    const menuIds = [...new Set(
      lineItems
        .map((item) => item.menuItemId)
        .filter(Boolean)
        .map((id) => String(id))
    )]

    if (menuIds.length !== lineItems.length) {
      return res.status(400).json({ error: 'Every line item must reference a valid menuItemId.' })
    }

    const menuDocs = await RestaurantMenuItem.find({
      _id: { $in: menuIds },
      tenantId: tenant._id,
      isActive: true,
    }).select('nameEn nameAr sellingPrice taxRate').lean()

    const menuById = new Map(menuDocs.map((doc) => [String(doc._id), doc]))
    if (menuById.size !== menuIds.length) {
      return res.status(400).json({ error: 'One or more menu items are invalid or unavailable.' })
    }

    // Re-price from menu DB — never trust client unitPrice/taxRate
    let subtotal = 0
    let totalTax = 0

    const processedLineItems = lineItems.map((item) => {
      const menu = menuById.get(String(item.menuItemId))
      const qty = Math.max(1, parseInt(item.quantity, 10) || 1)
      const price = Math.max(0, Number(menu.sellingPrice) || 0)
      const taxRate = Number.isFinite(Number(menu.taxRate)) ? Number(menu.taxRate) : 15
      const itemSubtotal = Math.round(qty * price * 100) / 100
      const itemTax = Math.round((itemSubtotal * (taxRate / 100)) * 100) / 100
      const itemTotal = Math.round((itemSubtotal + itemTax) * 100) / 100

      subtotal += itemSubtotal
      totalTax += itemTax

      return {
        menuItemId: menu._id,
        name: menu.nameEn || item.nameEn || item.name || 'Item',
        nameAr: menu.nameAr || item.nameAr || item.name || 'عنصر',
        quantity: qty,
        unitPrice: price,
        taxRate,
        lineSubtotal: itemSubtotal,
        lineTax: itemTax,
        lineTotal: itemTotal
      }
    })

    subtotal = Math.round(subtotal * 100) / 100
    totalTax = Math.round(totalTax * 100) / 100
    const grandTotal = Math.round((subtotal + totalTax) * 100) / 100

    // Generate order number
    const count = await RestaurantOrder.countDocuments({ tenantId: tenant._id })
    const orderNumber = `QR-${1000 + count + 1}`

    const newOrder = new RestaurantOrder({
      tenantId: tenant._id,
      orderNumber,
      status: 'open',
      kitchenStatus: 'new',
      tableNumber: tableNumber || '',
      orderType: ['dine_in', 'takeaway', 'delivery'].includes(orderType) ? orderType : 'dine_in',
      customerName: String(customerName).trim(),
      customerPhone: String(customerPhone).trim(),
      deliveryAddress: deliveryAddress ? String(deliveryAddress).trim() : '',
      currency: 'SAR',
      lineItems: processedLineItems,
      subtotal,
      totalTax,
      grandTotal,
      paymentMethod,
      notes: notes ? String(notes).trim() : ''
    })

    await newOrder.save()

    let checkoutUrl = null
    if (paymentMethod === 'tabby' || paymentMethod === 'tamara') {
      const qrMenu = tenant.settings?.restaurant?.qrMenu || {}
      const config = paymentMethod === 'tabby'
        ? {
          enabled: Boolean(qrMenu.tabbyApiKey && qrMenu.tabbyMerchantCode),
          secretKey: qrMenu.tabbyApiKey,
          merchantId: qrMenu.tabbyMerchantCode,
        }
        : {
          enabled: Boolean(qrMenu.tamaraMerchantToken),
          secretKey: qrMenu.tamaraMerchantToken,
          webhookSecret: qrMenu.tamaraNotificationToken,
        }
      if (!config?.enabled || !config?.secretKey) {
        return res.status(400).json({ error: `${paymentMethod} is not enabled for this restaurant` })
      }
      const origin = `${req.protocol}://${req.get('host')}`
      const result = await createCheckoutSession(paymentMethod, {
        amount: grandTotal,
        currency: 'SAR',
        orderId: newOrder._id.toString(),
        orderNumber: newOrder.orderNumber,
        customer: { name: newOrder.customerName, phone: newOrder.customerPhone, email: '', addressLine1: newOrder.deliveryAddress || 'KSA', city: 'Riyadh', country: 'SA' },
        items: processedLineItems.map((item) => ({
          productTitle: item.name,
          quantity: item.quantity,
          price: item.unitPrice,
          taxAmount: item.lineTax,
        })),
        successUrl: `${origin}/public/menu?tenant=${tenant._id}&paid=1&order=${newOrder.orderNumber}`,
        cancelUrl: `${origin}/public/menu?tenant=${tenant._id}&paid=0&order=${newOrder.orderNumber}`,
      }, config)
      newOrder.providerTransactionId = result.providerPaymentId
      await newOrder.save()
      checkoutUrl = result.checkoutUrl
    }

    res.status(201).json({
      success: true,
      message: 'Order placed successfully',
      order: newOrder,
      checkoutUrl,
    })
  } catch (error) {
    sendRouteError(res, error)
  }
})

router.get('/tenant/:id/services', async (req, res) => {
  try {
    const tenant = await withQueryTimeout(
      Tenant.findById(req.params.id).select('name slug business branding settings isActive')
    )

    if (!tenant || !tenant.isActive) {
      return res.status(404).json({ error: 'Saloon not found or inactive' })
    }

    const services = await withQueryTimeout(
      SaloonService.find({ tenantId: tenant._id, isActive: true }).sort({ category: 1, nameEn: 1 })
    )

    res.json({
      tenant: {
        name: tenant.name,
        business: tenant.business,
        branding: tenant.branding,
        settings: {
          saloon: {
            qrServices: tenant.settings?.saloon?.qrServices || { defaultLanguage: 'ar' }
          }
        }
      },
      services
    })
  } catch (error) {
    sendRouteError(res, error)
  }
})

import KhayyatStitching, { createTrackToken } from '../models/khayyat/KhayyatStitching.js'

router.get('/track/khayyat/:id', async (req, res) => {
  try {
    const id = String(req.params.id || '').trim()
    if (!id) {
      return res.status(404).json({ error: 'Order not found' })
    }

    const trackSelect = 'orderNumber receiptNumber status customerName customerPhone dueDate completedDate deliveredDate description quantity price paidAmount tenantId trackToken'
    let order = await withQueryTimeout(
      KhayyatStitching.findOne({ trackToken: id })
        .select(trackSelect)
        .populate('tenantId', 'name business.phone branding.logo')
        .lean()
    )

    if (!order && mongoose.Types.ObjectId.isValid(id) && String(new mongoose.Types.ObjectId(id)) === id) {
      const byId = await withQueryTimeout(
        KhayyatStitching.findById(id)
          .select(trackSelect)
          .populate('tenantId', 'name business.phone branding.logo')
          .lean()
      )
      if (byId && !byId.trackToken) {
        const token = createTrackToken()
        await KhayyatStitching.updateOne(
          { _id: byId._id, $or: [{ trackToken: { $exists: false } }, { trackToken: null }, { trackToken: '' }] },
          { $set: { trackToken: token } }
        )
        order = { ...byId, trackToken: token }
      }
    }

    if (!order) {
      return res.status(404).json({ error: 'Order not found' })
    }

    const rawName = String(order.customerName || '').trim()
    const customerName = rawName ? rawName.split(/\s+/)[0] : ''
    const phone = String(order.customerPhone || '').trim()
    const customerPhone = phone.length > 4
      ? `${'*'.repeat(Math.max(0, phone.length - 4))}${phone.slice(-4)}`
      : phone ? '****' : ''

    res.json({
      orderNumber: order.orderNumber || order.receiptNumber || null,
      receiptNumber: order.receiptNumber || null,
      status: order.status,
      customerName,
      customerPhone,
      dueDate: order.dueDate || null,
      completedDate: order.completedDate || null,
      deliveredDate: order.deliveredDate || null,
      description: order.description || '',
      quantity: order.quantity || 1,
      price: order.price || 0,
      paidAmount: order.paidAmount || 0,
      tenantId: order.tenantId
        ? {
            name: order.tenantId.name || '',
            branding: order.tenantId.branding ? { logo: order.tenantId.branding.logo || null } : undefined,
            business: order.tenantId.business ? { phone: order.tenantId.business.phone || '' } : undefined,
          }
        : null,
    })
  } catch (error) {
    sendRouteError(res, error)
  }
})

export default router
