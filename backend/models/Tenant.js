import mongoose from 'mongoose';
import { BUSINESS_TYPES } from '../utils/businessTypes.js';

const subscriptionSchema = new mongoose.Schema({
  plan: {
    type: String,
    enum: ['trial', 'starter', 'professional', 'enterprise'],
    default: 'trial'
  },
  status: {
    type: String,
    enum: ['active', 'suspended', 'cancelled', 'expired', 'terminated'],
    default: 'active'
  },
  startDate: { type: Date, default: Date.now },
  endDate: { type: Date },
  maxUsers: { type: Number, default: 5 },
  maxInvoices: { type: Number, default: 100 },
  hasEmailAddon: { type: Boolean, default: false },
  hasIotAddon: { type: Boolean, default: false },
  hasWeightScaleAddon: { type: Boolean, default: false },
  hasBranchAddon: { type: Boolean, default: false },
  hasDeliveryAddon: { type: Boolean, default: false },
  hasMessAddon: { type: Boolean, default: false },
  hasCombosAddon: { type: Boolean, default: false },
  hasQrOrderingAddon: { type: Boolean, default: false },
  maxBranches: { type: Number, default: 0 },
  features: [{
    type: String,
    enum: ['hr', 'payroll', 'invoicing', 'inventory', 'ai', 'api_access', 'multi_warehouse', 'advanced_reports', 'email_automation']
  }],
  billingCycle: {
    type: String,
    enum: ['monthly', 'yearly'],
    default: 'monthly'
  },
  price: { type: Number, default: 0 }
});

const businessDetailsSchema = new mongoose.Schema({
  legalNameAr: { type: String, required: true },
  legalNameEn: { type: String, required: true },
  tradeName: { type: String },
  vatNumber: { type: String, default: '' },
  crNumber: { type: String, default: '' },
  address: {
    street: { type: String },
    streetAr: { type: String },
    district: { type: String },
    districtAr: { type: String },
    city: { type: String },
    cityAr: { type: String },
    postalCode: { type: String },
    country: { type: String, default: 'SA' },
    buildingNumber: { type: String },
    additionalNumber: { type: String }
  },
  contactPhone: { type: String },
  contactEmail: { type: String },
  website: { type: String },

  // Bank Details
  bankDetails: {
    bankName: { type: String, default: '' },
    accountName: { type: String, default: '' },
    accountNumber: { type: String, default: '' },
    iban: { type: String, default: '' },
  },

  // National Address (Saudi National Address)
  nationalAddress: {
    proofNumber: { type: String, default: '' },
    originalDate: { type: Date },
    expirationDate: { type: Date },
    customerAccount: { type: String, default: '' },
    regDate: { type: Date },
    shortAddress: { type: String, default: '' },
    buildingNo: { type: String, default: '' },
    neighborhood: { type: String, default: '' },
    region: { type: String, default: '' },
    qrCodeUrl: { type: String, default: '' },
  },

  // Commercial Registration (Ministry of Commerce)
  commercialRegistration: {
    crNumber: { type: String, default: '' },
    issueDate: { type: Date },
    companyType: { type: String, default: '' },
    companyTypeAr: { type: String, default: '' },
    companyStatus: { type: String, default: '' },
    companyStatusAr: { type: String, default: '' },
    qrCodeUrl: { type: String, default: '' },
  },

  // VAT Registration Certificate (ZATCA)
  vatCertificate: {
    certificateNo: { type: String, default: '' },
    certificateDate: { type: Date },
    effectiveDate: { type: Date },
    taxPeriod: { type: String, default: '' },
    taxPeriodAr: { type: String, default: '' },
    firstFilingDueDate: { type: Date },
    qrCodeUrl: { type: String, default: '' },
  },
});

const zatcaConfigSchema = new mongoose.Schema({
  phase: { type: Number, enum: [1, 2], default: 1 },
  isOnboarded: { type: Boolean, default: false },
  complianceCsid: { type: String },
  productionCsid: { type: String },
  privateKey: { type: String },
  certificateSerialNumber: { type: String },
  lastInvoiceHash: { type: String },
  invoiceCounter: { type: Number, default: 0 },
  deviceSerialNumber: { type: String },
  onboardedAt: { type: Date },
  environment: { type: String, enum: ['sandbox', 'simulation', 'production'], default: 'sandbox' }
});

const invoiceBrandingProfileSchema = new mongoose.Schema({
  templateId: { type: Number, min: 1, max: 6 },
  logo: { type: String },
  stampImage: { type: String },
  letterheadImage: { type: String },
  headerTextEn: { type: String, default: '' },
  headerTextAr: { type: String, default: '' },
  footerTextEn: { type: String, default: '' },
  footerTextAr: { type: String, default: '' },
}, { _id: false });

const invoiceTypographySchema = new mongoose.Schema({
  bodyFontFamily: { type: String, enum: ['helvetica', 'times', 'courier'], default: 'helvetica' },
  headingFontFamily: { type: String, enum: ['helvetica', 'times', 'courier'], default: 'helvetica' },
  bodyFontSize: { type: Number, min: 9, max: 40, default: 12 },
  headingFontSize: { type: Number, min: 9, max: 40, default: 18 },
}, { _id: false });

const ecommerceDomainSchema = new mongoose.Schema({
  hostname: { type: String, required: true, lowercase: true, trim: true },
  type: { type: String, enum: ['subdomain', 'custom'], default: 'custom' },
  status: { type: String, enum: ['pending', 'verifying', 'verified', 'failed'], default: 'pending' },
  isPrimary: { type: Boolean, default: false },
  verificationToken: { type: String, default: '' },
  sslStatus: { type: String, enum: ['none', 'pending', 'active', 'error'], default: 'none' },
  verifiedAt: { type: Date },
  // Cloudflare for SaaS custom hostname ID
  cfHostnameId: { type: String, default: '' },
  // DNS records the client needs to add (returned by CF SaaS API)
  cfCnameTarget: { type: String, default: '' },
  cfTxtName: { type: String, default: '' },
  cfTxtValue: { type: String, default: '' },
  // Cloudflare custom hostname status (pending, active, etc.)
  cfStatus: { type: String, default: '' },
  // Error message if Cloudflare provisioning failed
  cfErrorMessage: { type: String, default: '' },
}, { _id: true, timestamps: true });

const ecommercePaymentProviderSchema = new mongoose.Schema({
  enabled: { type: Boolean, default: false },
  // Provider credentials are stored per tenant. Secrets should be masked in API responses.
  publishableKey: { type: String, default: '' },
  secretKey: { type: String, default: '' },
  merchantId: { type: String, default: '' },
  webhookSecret: { type: String, default: '' },
  environment: { type: String, enum: ['test', 'live'], default: 'test' },
}, { _id: false });

const ecommerceCourierProviderSchema = new mongoose.Schema({
  enabled: { type: Boolean, default: false },
  accountNumber: { type: String, default: '' },
  apiKey: { type: String, default: '' },
  apiSecret: { type: String, default: '' },
  environment: { type: String, enum: ['sandbox', 'production'], default: 'sandbox' },
}, { _id: false });

const ecommerceSchema = new mongoose.Schema({
  // Storefront availability
  storeStatus: { type: String, enum: ['draft', 'live', 'paused'], default: 'draft' },
  storeName: { type: String, default: '' },
  storeNameAr: { type: String, default: '' },
  // The free platform subdomain slug → {slug}.shop.maqder.com (defaults to tenant.slug)
  subdomain: { type: String, default: '', lowercase: true, trim: true },
  domains: { type: [ecommerceDomainSchema], default: [] },
  // Commerce defaults
  currency: { type: String, default: 'SAR' },
  defaultTaxRate: { type: Number, default: 15 },
  pricesIncludeTax: { type: Boolean, default: true },
  weightUnit: { type: String, enum: ['g', 'kg'], default: 'g' },
  // SEO defaults (per-product overrides live on the Product model)
  seo: {
    metaTitle: { type: String, default: '' },
    metaTitleAr: { type: String, default: '' },
    metaDescription: { type: String, default: '' },
    metaDescriptionAr: { type: String, default: '' },
    ogImage: { type: String, default: '' },
    faviconUrl: { type: String, default: '' },
    googleAnalyticsId: { type: String, default: '' },
    metaPixelId: { type: String, default: '' },
    robotsIndex: { type: Boolean, default: true },
  },
  // Tracking pixels — injected into storefront <head> and fired on events
  pixels: {
    googleAnalytics: {
      enabled: { type: Boolean, default: false },
      measurementId: { type: String, default: '' }, // e.g. G-XXXXXXXXXX
    },
    facebookPixel: {
      enabled: { type: Boolean, default: false },
      pixelId: { type: String, default: '' },
    },
    tiktokPixel: {
      enabled: { type: Boolean, default: false },
      pixelId: { type: String, default: '' },
    },
    snapchatPixel: {
      enabled: { type: Boolean, default: false },
      pixelId: { type: String, default: '' },
    },
    twitterPixel: {
      enabled: { type: Boolean, default: false },
      pixelId: { type: String, default: '' },
    },
    googleAds: {
      enabled: { type: Boolean, default: false },
      conversionId: { type: String, default: '' }, // e.g. AW-XXXXXXXXX
      conversionLabel: { type: String, default: '' },
    },
    snapchatCapi: {
      enabled: { type: Boolean, default: false },
      pixelId: { type: String, default: '' },
      token: { type: String, default: '' },
    },
    tiktokCapi: {
      enabled: { type: Boolean, default: false },
      pixelCode: { type: String, default: '' },
      accessToken: { type: String, default: '' },
    },
  },
  // Plug-and-play payment providers
  payments: {
    defaultProvider: { type: String, enum: ['', 'moyasar', 'tap', 'paytabs', 'stripe', 'cod'], default: '' },
    codEnabled: { type: Boolean, default: true },
    moyasar: { type: ecommercePaymentProviderSchema, default: () => ({}) },
    tap: { type: ecommercePaymentProviderSchema, default: () => ({}) },
    paytabs: { type: ecommercePaymentProviderSchema, default: () => ({}) },
    stripe: { type: ecommercePaymentProviderSchema, default: () => ({}) },
  },
  // Courier integrations
  couriers: {
    smsa: { type: ecommerceCourierProviderSchema, default: () => ({}) },
    aramex: { type: ecommerceCourierProviderSchema, default: () => ({}) },
    naqel: { type: ecommerceCourierProviderSchema, default: () => ({}) },
    imile: { type: ecommerceCourierProviderSchema, default: () => ({}) },
    flatRate: {
      enabled: { type: Boolean, default: true },
      price: { type: Number, default: 25 },
      freeShippingThreshold: { type: Number, default: 0 },
    },
  },
  // Tenant-level Cloudflare credentials (optional) for Connect with Cloudflare
  cloudflare: {
    apiToken: { type: String, default: '' },
    zoneId: { type: String, default: '' },
    fallbackOrigin: { type: String, default: '' },
    connectedAt: { type: Date },
  },
  // WordPress / WooCommerce integration
  wordpress: {
    enabled: { type: Boolean, default: false },
    siteUrl: { type: String, default: '' },
    consumerKey: { type: String, default: '' },
    consumerSecret: { type: String, default: '' },
    username: { type: String, default: '' },
    appPassword: { type: String, default: '' },
    syncDirection: { type: String, enum: ['push', 'pull', 'two-way'], default: 'push' },
    lastSyncAt: { type: Date },
    lastSyncStatus: { type: String, default: '' },
    lastSyncError: { type: String, default: '' },
    autoSync: { type: Boolean, default: false },
  },
  // Newsletter subscribers
  newsletterSubscribers: [{
    email: { type: String, required: true },
    subscribedAt: { type: Date, default: Date.now },
    isActive: { type: Boolean, default: true },
    unsubscribedAt: { type: Date, default: null },
    resubscribedAt: { type: Date, default: null },
  }],
  // Shopify-style JSON-driven theme customization
  theme: {
    // Currently published config (what the storefront renders)
    published: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
    // Draft config being edited in the theme editor
    draft: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
    // When the draft was last saved
    draftUpdatedAt: { type: Date, default: null },
    // When the theme was last published
    publishedAt: { type: Date, default: null },
  },
}, { _id: false });

const tenantSchema = new mongoose.Schema({
  name: { type: String, required: true },
  slug: { type: String, required: true, unique: true, lowercase: true },
  personalEmail: { type: String },
  phoneNumber: { type: String },
  businessType: { type: String, enum: BUSINESS_TYPES, default: 'trading', index: true },
  businessTypes: {
    type: [{ type: String, enum: BUSINESS_TYPES }],
    default: ['trading'],
  },
  business: businessDetailsSchema,
  subscription: subscriptionSchema,
  terminationNotice: {
    date: { type: Date },
    reason: { type: String }
  },
  zatca: zatcaConfigSchema,
  ecommerce: { type: ecommerceSchema, default: () => ({}) },
  settings: {
    language: { type: String, enum: ['en', 'ar'], default: 'ar' },
    currency: { type: String, default: 'SAR' },
    timezone: { type: String, default: 'Asia/Riyadh' },
    fiscalYearStart: { type: Number, default: 1 },
    dateFormat: { type: String, default: 'DD/MM/YYYY' },
    useHijriDates: { type: Boolean, default: true },
    hiddenUoms: [{ type: String }],
    invoiceSequencePattern: { type: String, default: 'RCPT-{N}' },
    invoiceSequenceCounter: { type: Number, default: 0 },
    khayyat: {
      whatsappLanguage: { type: String, enum: ['ar', 'en', 'both'], default: 'both' }
    },
    invoicePdfTemplate: { type: Number, default: 1, min: 1, max: 6 },
    invoicePdfPageSize: { type: String, enum: ['a4', 'letter', 'a5'], default: 'a4' },
    invoicePdfOrientation: { type: String, enum: ['portrait', 'landscape'], default: 'portrait' },
    // How SAR is rendered next to amounts on invoices and PDFs.
    // - 'icon'  → Saudi Riyal symbol (﷼)
    // - 'text'  → the letters "SAR"
    invoiceCurrencyDisplay: { type: String, enum: ['icon', 'text'], default: 'text' },
    // Where the currency marker sits relative to the amount.
    invoiceCurrencyPosition: { type: String, enum: ['before', 'after'], default: 'after' },
    invoiceBranding: {
      presetSignature: { type: String },
      presetStamp: { type: String },
      logo: { type: String },
      headerTextEn: { type: String, default: '' },
      headerTextAr: { type: String, default: '' },
      footerTextEn: { type: String, default: '' },
      footerTextAr: { type: String, default: '' },
      typography: { type: invoiceTypographySchema, default: () => ({}) },
      showVision2030: { type: Boolean, default: true },
      vision2030Logo: { type: String },
      contextProfiles: {
        trading: { type: invoiceBrandingProfileSchema, default: () => ({ templateId: 5 }) },
        construction: { type: invoiceBrandingProfileSchema, default: () => ({ templateId: 6 }) },
        travel_agency: { type: invoiceBrandingProfileSchema, default: () => ({ templateId: 4 }) },
      }
    },
    saudiIntegrations: {
      enabled: { type: Boolean, default: true },
      useSaudiIdValidation: { type: Boolean, default: true },
      autoTrackIqamaExpiry: { type: Boolean, default: true },
      identity: {
        enabled: { type: Boolean, default: false },
        provider: { type: String, default: 'custom_webhook' },
        endpoint: { type: String, default: '' },
        apiKey: { type: String, default: '' },
        ocrEnabled: { type: Boolean, default: false },
      },
      gosi: {
        enabled: { type: Boolean, default: false },
        establishmentId: { type: String, default: '' },
        registrationNumber: { type: String, default: '' },
        clientId: { type: String, default: '' },
        clientSecret: { type: String, default: '' },
        redirectUri: { type: String, default: '' },
        lastSyncAt: { type: Date },
      },
      elm: {
        clientId: { type: String, default: '' },
        clientSecret: { type: String, default: '' },
        appId: { type: String, default: '' },
        agencyId: { type: String, default: '' },
        nafathOtpEnabled: { type: Boolean, default: false },
        tammEnabled: { type: Boolean, default: false }
      },
      qiwa: {
        establishmentId: { type: String, default: '' },
        accessToken: { type: String, default: '' },
        contractAuthAutomationEnabled: { type: Boolean, default: false },
        saudizationWidgetEnabled: { type: Boolean, default: false }
      },
      mudad: {
        registrationNumber: { type: String, default: '' },
        clientCertificate: { type: String, default: '' },
        autoSifUploadEnabled: { type: Boolean, default: false }
      }
    },
    communication: {
      email: {
        enabled: { type: Boolean, default: false },
        autoSendInvoices: { type: Boolean, default: false },
        identityType: { type: String, enum: ['platform', 'custom_smtp'], default: 'platform' },
        identityStatus: { type: String, enum: ['not_requested', 'requested', 'configured', 'verified'], default: 'not_requested' },
        platformProvider: { type: String, enum: ['platform', 'brevo'], default: 'platform' },
        providerSenderId: { type: String, default: '' },
        providerSenderStatus: { type: String, default: '' },
        requestedSenderName: { type: String, default: '' },
        requestedSenderEmail: { type: String, default: '' },
        senderName: { type: String, default: '' },
        fromEmail: { type: String, default: '' },
        replyTo: { type: String, default: '' },
        inboundAddress: { type: String, default: '' },
        smtpHost: { type: String, default: '' },
        smtpPort: { type: Number, default: 587 },
        smtpSecure: { type: Boolean, default: false },
        smtpUser: { type: String, default: '' },
        smtpPass: { type: String, default: '' },
        subjectEn: { type: String, default: '' },
        subjectAr: { type: String, default: '' },
        bodyEn: { type: String, default: '' },
        bodyAr: { type: String, default: '' },
        signatureEn: { type: String, default: '' },
        signatureAr: { type: String, default: '' }
      }
    },
    posTerminal: {
      enabled: { type: Boolean, default: false },
      // Supported gateways that push a payment to a physical card terminal.
      provider: {
        type: String,
        enum: ['geidea', 'paytabs', 'ngenius', 'urway', 'moyasar', 'custom'],
        default: 'custom'
      },
      // Display label for the connected device shown in the POS.
      terminalLabel: { type: String, default: '' },
      // Provider credentials / identifiers (stored per tenant).
      apiBaseUrl: { type: String, default: '' },
      apiKey: { type: String, default: '' },
      apiSecret: { type: String, default: '' },
      merchantId: { type: String, default: '' },
      terminalId: { type: String, default: '' },
      outletId: { type: String, default: '' },
      webhookSecret: { type: String, default: '' },
      currency: { type: String, default: 'SAR' },
      environment: { type: String, enum: ['test', 'live'], default: 'test' },
      // How long (seconds) the POS waits for the cardholder to complete payment.
      pollTimeoutSec: { type: Number, default: 120 },
      autoProceedOnApproval: { type: Boolean, default: true },
      lastTestedAt: { type: Date },
      lastTestStatus: { type: String, default: '' }
    },
    hardwareSettings: {
      receiptPrinterType: { type: String, enum: ['usb', 'network', 'bluetooth', 'none', 'android', 'android_system_print'], default: 'none' },
      printerIpAddress: { type: String, default: '192.168.1.100' },
      printerPort: { type: Number, default: 9100 },
      cashDrawerKickCode: { type: String, default: '27,112,0,50,250' }, // ESC p 0 50 250
      openCashDrawerOnCashPayment: { type: Boolean, default: true },
      barcodeScannerPrefix: { type: String, default: '' },
      barcodeScannerSuffix: { type: String, default: 'Enter' },
      scaleBarcodePrefix: { type: String, default: '21' },
      scaleType: { type: String, enum: ['none', 'serial', 'network'], default: 'none' },
    },
    thermalPrinter: {
      printerModel: { type: String, default: 'generic_80' },
      paperWidth: { type: Number, default: 80 },
      charsPerLine: { type: Number, default: 48 },
      dpi: { type: Number, default: 203 },
      fontSize: { type: Number, default: 11 },
      lineHeight: { type: Number, default: 1.4 },
      padding: { type: Number, default: 4 },
      autoPrint: { type: Boolean, default: false },
      showLogo: { type: Boolean, default: true },
      showQrCode: { type: Boolean, default: true },
      showFooter: { type: Boolean, default: true },
      footerTextEn: { type: String, default: 'Thank you for your visit!' },
      footerTextAr: { type: String, default: 'شكراً لزيارتكم!' },
      cutAtEnd: { type: Boolean, default: true },
      copies: { type: Number, default: 1 },
      encoding: { type: String, default: 'utf8' },
      darkness: { type: Number, default: 2 },
      beepOnComplete: { type: Boolean, default: false },
    },
    restaurant: {
      qrMenu: {
        heroImage: { type: String },
        defaultLanguage: { type: String, enum: ['en', 'ar'], default: 'ar' },
        mode: { type: String, enum: ['digital', 'image_only'], default: 'digital' },
        menuImages: [{ type: String }],
        allowOnlineOrdering: { type: Boolean, default: true },
        allowDelivery: { type: Boolean, default: true },
        allowTakeaway: { type: Boolean, default: true },
        allowDineIn: { type: Boolean, default: true },
        acceptedPayments: { 
          type: [String], 
          default: ['cash', 'apple_pay', 'stc_pay', 'visa', 'mada', 'master_card', 'tabby', 'tamara'] 
        },
        stcPayMerchantId: { type: String, default: '' },
        tabbyMerchantCode: { type: String, default: '' },
        tabbyApiKey: { type: String, default: '' },
        tamaraMerchantToken: { type: String, default: '' },
        tamaraNotificationToken: { type: String, default: '' },
        applePayMerchantId: { type: String, default: '' },
        cardPaymentApiKey: { type: String, default: '' }
      },
      autoStatusUpdate: { type: Boolean, default: false },
      openingTime: { type: String, default: '08:00' },
      closingTime: { type: String, default: '23:00' },
      notifyOnStatusChange: { type: Boolean, default: false },
      statusNotificationPhone: { type: String, default: '' },
      printers: [{
        name: { type: String, default: 'Kitchen Printer' },
        type: { type: String, enum: ['usb', 'network', 'bluetooth'], default: 'network' },
        role: { type: String, enum: ['kitchen', 'receipt'], default: 'kitchen' },
        ipAddress: { type: String, default: '192.168.1.100' },
        port: { type: Number, default: 9100 },
        enabled: { type: Boolean, default: false },
        paperWidth: { type: Number, default: 80 }, // mm
      }],
      whatsapp: {
        autoSendEnabled: { type: Boolean, default: false },
        autoSendOnOpen: { type: Boolean, default: false },
        autoSendOnOrderPlaced: { type: Boolean, default: false },
        autoSendOnOrderReady: { type: Boolean, default: false },
        autoSendOnOrderServed: { type: Boolean, default: false },
        openMessageEn: { type: String, default: 'We are now open! Visit us today.' },
        openMessageAr: { type: String, default: 'نحن الآن مفتوحون! زورنا اليوم.' },
        orderPlacedMessageEn: { type: String, default: 'Your order has been placed. Order #: {{orderNumber}}' },
        orderPlacedMessageAr: { type: String, default: 'تم استلام طلبك. رقم الطلب: {{orderNumber}}' },
        orderReadyMessageEn: { type: String, default: 'Your order is ready for pickup/delivery. Order #: {{orderNumber}}' },
        orderReadyMessageAr: { type: String, default: 'طلبك جاهز للاستلام/التوصيل. رقم الطلب: {{orderNumber}}' },
        orderServedMessageEn: { type: String, default: 'Your order has been served. Thank you! Order #: {{orderNumber}}' },
        orderServedMessageAr: { type: String, default: 'تم تقديم طلبك. شكراً لك! رقم الطلب: {{orderNumber}}' },
        notifyPhoneList: [{ type: String }],
        lastOpenNotificationSent: { type: Date },
      },
    },
    saloon: {
      qrServices: {
        heroImage: { type: String },
        defaultLanguage: { type: String, enum: ['en', 'ar'], default: 'ar' }
      }
    },
    bakala: {
      requireShift: { type: Boolean, default: true }
    },
    carRentalIntegrations: {
      // ── Tamm (Amakin) ─ Saudi rental traffic registry integration
      tamm: {
        enabled: { type: Boolean, default: false },
        apiKey: { type: String, default: '' },
        apiSecret: { type: String, default: '' },
        companyLicenseNumber: { type: String, default: '' },
        environment: { type: String, enum: ['sandbox', 'production'], default: 'sandbox' },
        autoSyncContracts: { type: Boolean, default: false },
        lastSyncAt: { type: Date },
      },
      // ── NAJM (Saudi Insurance) ─ accident/insurance verification
      najm: {
        enabled: { type: Boolean, default: false },
        apiKey: { type: String, default: '' },
        clientId: { type: String, default: '' },
        clientSecret: { type: String, default: '' },
        environment: { type: String, enum: ['sandbox', 'production'], default: 'sandbox' },
        autoCheckOnCheckout: { type: Boolean, default: true },
        lastSyncAt: { type: Date },
      },
      // ── Wathiq (SAFCSP) ─ identity & document verification
      wathiq: {
        enabled: { type: Boolean, default: false },
        apiKey: { type: String, default: '' },
        appId: { type: String, default: '' },
        environment: { type: String, enum: ['sandbox', 'production'], default: 'sandbox' },
        autoVerifyId: { type: Boolean, default: true },
      },
      // ── SMS Notification (Taqnyat / Unifonic)
      smsNotifications: {
        enabled: { type: Boolean, default: false },
        provider: { type: String, enum: ['taqnyat', 'unifonic', 'msegat', 'custom'], default: 'taqnyat' },
        apiKey: { type: String, default: '' },
        senderId: { type: String, default: '' },
        sendOnCheckout: { type: Boolean, default: true },
        sendOnCheckin: { type: Boolean, default: true },
        sendOnOverdue: { type: Boolean, default: true },
      },
    },
  },
  branding: {
    logo: { type: String },
    primaryColor: { type: String, default: '#14B8A6' },
    secondaryColor: { type: String, default: '#D946EF' },
    headerStyle: { type: String, enum: ['glass', 'solid'], default: 'glass' },
    sidebarStyle: { type: String, enum: ['glass', 'solid'], default: 'solid' }
  },
  isActive: { type: Boolean, default: true },
  isDemo: { type: Boolean, default: false, index: true },
  demoEmail: { type: String, default: '', index: true },
  demoTrialEndsAt: { type: Date, default: null },
  demoUpgraded: { type: Boolean, default: false },
  resellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Reseller', default: null, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, {
  timestamps: true
});

tenantSchema.pre('validate', function(next) {
  const values = Array.isArray(this.businessTypes) && this.businessTypes.length > 0
    ? this.businessTypes.map(v => String(v || '').trim().toLowerCase())
    : [String(this.businessType || 'trading').trim().toLowerCase()];
  const currentSubscription = this.subscription?.toObject?.() || this.subscription || {};
  const features = Array.isArray(currentSubscription.features) ? currentSubscription.features.filter(Boolean) : [];
  const hasEmailAddon = currentSubscription.hasEmailAddon === true;
  const hasBranchAddon = currentSubscription.hasBranchAddon === true;

  const normalized = [...new Set(values.filter((value) => BUSINESS_TYPES.includes(value)))];
  this.businessTypes = normalized.length ? normalized : ['trading'];

  let nextFeatures = features;
  if (hasEmailAddon) {
    nextFeatures = [...new Set([...nextFeatures, 'email_automation'])];
  } else {
    nextFeatures = nextFeatures.filter((feature) => feature !== 'email_automation');
  }
  if (hasBranchAddon) {
    nextFeatures = [...new Set([...nextFeatures, 'multi_warehouse'])];
  } else {
    nextFeatures = nextFeatures.filter((feature) => feature !== 'multi_warehouse');
  }

  this.subscription = {
    ...currentSubscription,
    hasEmailAddon,
    hasBranchAddon,
    features: nextFeatures,
  };

  if (!this.businessType || !this.businessTypes.includes(this.businessType)) {
    this.businessType = this.businessTypes[0] || 'trading';
  }

  next();
});

tenantSchema.index({ isActive: 1 });
tenantSchema.index({ businessType: 1 });
tenantSchema.index({ businessTypes: 1 });

const Tenant = mongoose.model('Tenant', tenantSchema);
export default Tenant;
