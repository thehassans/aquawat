import express from 'express';
import { protect } from '../middleware/auth.js';
import Tenant from '../models/Tenant.js';
import { AppAddon } from '../models/AppAddon.js';
import { normalizeBusinessTypes } from '../utils/businessTypes.js';
import { PREMIUM_TEMPLATE_APP_ID as PREMIUM_INVOICE_TEMPLATES_APP_ID, hasPremiumTemplateAccess, ESSENTIAL_TEMPLATE_ID } from '../utils/premiumTemplates.js';
import { createStripeCheckoutSession, getStripeConfig, retrieveStripeCheckoutSession } from '../services/platformStripe.js';

const router = express.Router();

const getAppPrice = (appDef, billingCycle = 'monthly') => {
  const cycle = billingCycle === 'yearly' ? 'yearly' : 'monthly';
  const price = cycle === 'yearly'
    ? Number(appDef?.yearlyPrice || 0)
    : Number(appDef?.monthlyPrice || 0);
  return Number.isFinite(price) ? price : 0;
};

const isPaidApp = (appDef, billingCycle = 'monthly') => {
  const tier = String(appDef?.pricingTier || 'free').toLowerCase();
  if (tier === 'free') return false;
  return getAppPrice(appDef, billingCycle) > 0;
};

const applyAppInstall = async ({ tenant, appDef, appId, customConfig = {}, paymentMeta = null }) => {
  if (!tenant.settings) tenant.settings = {};
  if (!tenant.settings.installedApps) tenant.settings.installedApps = {};

  const defaultCfg = {};
  if (appDef.configSchema) {
    for (const field of appDef.configSchema) {
      if (field.defaultValue !== undefined) {
        defaultCfg[field.key] = field.defaultValue;
      }
    }
  }

  const existing = tenant.settings.installedApps[appId] || {};
  const appConfig = {
    isInstalled: true,
    isEnabled: true,
    installedAt: existing.installedAt || new Date(),
    version: appDef.version,
    config: { ...defaultCfg, ...(existing.config || {}), ...(customConfig || {}) },
  };

  if (paymentMeta) {
    appConfig.billing = {
      provider: paymentMeta.provider || 'stripe',
      billingCycle: paymentMeta.billingCycle || 'monthly',
      amount: Number(paymentMeta.amountMajor || 0),
      currency: String(paymentMeta.currency || 'SAR').toUpperCase(),
      paymentId: paymentMeta.paymentId || '',
      paidAt: new Date(),
    };
  }

  tenant.settings.installedApps[appId] = appConfig;

  if (appId === 'bangladesh_nbr_einvoicing') {
    if (!tenant.nbr) tenant.nbr = {};
    tenant.nbr.isEnabled = true;
    if (appConfig.config?.environment) tenant.nbr.environment = appConfig.config.environment;
    if (appConfig.config?.mushakForm) tenant.nbr.mushakForm = appConfig.config.mushakForm;
    if (appConfig.config?.autoGenerateQr !== undefined) tenant.nbr.autoGenerateQr = !!appConfig.config.autoGenerateQr;
    if (!tenant.nbr.connectionStatus || tenant.nbr.connectionStatus === 'disconnected') {
      tenant.nbr.connectionStatus = 'action_required';
    }
    tenant.markModified('nbr');
  }

  let currentTypes = normalizeBusinessTypes(tenant.businessTypes || [tenant.businessType || 'trading']);
  if (appDef.businessTypeGrant && !currentTypes.includes(appDef.businessTypeGrant)) {
    currentTypes.push(appDef.businessTypeGrant);
    tenant.businessTypes = currentTypes;
  }

  tenant.markModified('settings.installedApps');
  tenant.markModified('settings');
  tenant.markModified('businessTypes');
  await tenant.save();
  return tenant;
};

/** Called from Stripe webhook / session confirm after successful App Store payment. */
export async function fulfillAppStorePurchase({
  tenantId,
  appId,
  billingCycle = 'monthly',
  amountMajor = 0,
  currency = 'SAR',
  paymentId = '',
  provider = 'stripe',
}) {
  if (!tenantId || !appId) throw new Error('tenantId and appId are required');

  const tenant = await Tenant.findById(tenantId);
  if (!tenant) throw new Error('Tenant not found');

  const appDef = (await AppAddon.findOne({ appId }).lean()) || DEFAULT_APP_CATALOG.find((a) => a.appId === appId);
  if (!appDef) throw new Error('App not found in catalog');

  if (tenant.settings?.installedApps?.[appId]?.isInstalled) {
    return { alreadyInstalled: true, tenant };
  }

  await applyAppInstall({
    tenant,
    appDef,
    appId,
    paymentMeta: { provider, billingCycle, amountMajor, currency, paymentId },
  });

  return { alreadyInstalled: false, tenant };
}

// Helper to serialize tenant for Redux auth state
const serializeAuthTenant = (tenant) => {
  if (!tenant) return null;
  const source = typeof tenant.toObject === 'function' ? tenant.toObject() : tenant;
  return {
    _id: source._id,
    name: source.name,
    slug: source.slug,
    businessType: source.businessType,
    businessTypes: source.businessTypes,
    business: source.business,
    settings: source.settings,
    branding: source.branding,
    subscription: source.subscription,
    terminationNotice: source.terminationNotice,
    zatca: source.zatca,
    nbr: source.nbr,
  };
};

const getTenantForUser = async (req) => {
  let tenantId = req.user?.tenantId || req.tenant?._id;
  if (!tenantId && req.user?.role === 'super_admin') {
    const firstTenant = await Tenant.findOne();
    tenantId = firstTenant?._id;
  }
  if (!tenantId) return null;
  return await Tenant.findById(tenantId);
};

// Built-in Apps and Add-ons Catalog Definition with distinct download sizes
export const DEFAULT_APP_CATALOG = [
  // ══════════════════════════════════════════════════════════════════════════════
  // ── 1. INDUSTRY VERTICAL APPS (15 BUSINESS TENANT APPS) ───────────────────────
  // ══════════════════════════════════════════════════════════════════════════════
  {
    appId: 'manufacturing_mes',
    nameEn: 'Manufacturing & Industrial MES',
    nameAr: 'نظام التصنيع والإنتاج المتقدم (MES & MRP II)',
    taglineEn: 'Multi-level BOMs, MRP planning, real-time shop floor execution, QA/QC, and OEE analytics.',
    taglineAr: 'شجرة المواد المتعددة، تخطيط الاحتياجات MRP، تنفيذ أرضية المصنع، فحص الجودة ومؤشرات OEE.',
    descriptionEn: 'Full-scale manufacturing ERP engine: define complex assemblies, generate dynamic work orders, dispatch job cards with mobile operator timers, enforce ISO-grade QA checklists, track scrap/NCRs, and calculate standard vs. actual cost variances in real-time.',
    descriptionAr: 'منظومة صناعية متكاملة لإدارة خطوط الإنتاج، شجرة المنتجات المركبة، تخطيط المواد، أوامر الشغل، ومراقبة الجودة وتكلفة المواد والعمالة اللحظية.',
    category: 'industry_verticals',
    appType: 'core_vertical',
    icon: 'factory',
    version: '3.2.0',
    downloadSize: '14.8 MB',
    author: 'Maqder Core',
    rating: 4.98,
    reviewsCount: 342,
    pricingTier: 'free',
    badge: 'Industrial',
    defaultRoute: '/app/dashboard/manufacturing',
    businessTypeGrant: 'manufacturing',
    featuresEn: [
      'Multi-Level BOMs with Sub-assemblies & Revisions',
      'Master Production Schedule (MPS) & MRP Engine',
      'Job Cards with Real-time Operator Timers & Downtime',
      'QA/QC Checklists & Non-Conformance Reports (NCR)',
      'OEE Real-Time Analytics & Standard vs Actual Costing'
    ],
    featuresAr: [
      'شجرة مواد متعددة المستويات مع تتبع المراجعات والتعديلات',
      'جدول الإنتاج الرئيسي (MPS) ومحرك تخطيط المواد (MRP)',
      'بطاقات العمل مع مؤقت المشغل اللحظي وسجل الأعطال والتوقفات',
      'قوائم فحص الجودة وتقارير عدم المطابقة (NCR)',
      'تحليلات الكفاءة الإجمالية OEE ومقارنة التكاليف المعيارية والفعلية'
    ],
    configSchema: [
      { key: 'autoGenerateWorkOrders', labelEn: 'Auto-Generate Work Orders from Confirmed Sales Orders', labelAr: 'إنشاء أوامر إنتاج تلقائياً من المبيعات المؤكدة', type: 'boolean', defaultValue: true },
      { key: 'strictQaSignoff', labelEn: 'Enforce Mandatory QA Sign-off Before Finished Goods Transfer', labelAr: 'إلزام اعتماد الفحص النهائي قبل التحويل للمستودع', type: 'boolean', defaultValue: true },
      { key: 'defaultScrapTolerancePercent', labelEn: 'Default Scrap Tolerance %', labelAr: 'نسبة الهدر المسموح بها افتراضياً %', type: 'number', defaultValue: 5 }
    ]
  },
  {
    appId: 'construction_projects',
    nameEn: 'Construction & Contracting Management',
    nameAr: 'إدارة المقاولات والمشاريع الإنشائية',
    taglineEn: 'Bill of Quantities (BOQ), interim payment certificates (Mustakhlasat), subcontractor contracts, and Gantt charts.',
    taglineAr: 'جداول الكميات BOQ، فواتير المستخلصات، إدارة مقاولي الباطن، ومخططات جانت الزمنية.',
    descriptionEn: 'End-to-end contracting ERP suite: master BOQs, milestone progress billing, retention and advance payment accounting, subcontractor tender tracking, daily site logs, and materials delivery verification.',
    descriptionAr: 'منظومة مقاولات ومشاريع متكاملة: إعداد جداول الكميات، إصدار المستخلصات المعتمدة، إدارة دفعات مقاولي الباطن، تتبع نسب الإنجاز وجداول جانت، وتوريدات مواقع العمل.',
    category: 'industry_verticals',
    appType: 'core_vertical',
    icon: 'folderkanban',
    version: '3.1.0',
    downloadSize: '16.2 MB',
    author: 'Maqder Core',
    rating: 4.96,
    reviewsCount: 289,
    pricingTier: 'free',
    badge: 'Contracting',
    defaultRoute: '/app/dashboard/projects',
    businessTypeGrant: 'construction',
    featuresEn: [
      'Bill of Quantities (BOQ) with Unit Price Breakdowns',
      'Interim Progress Billing & Mustakhlasat Generator',
      'Subcontractor Agreements & Retention Deductions',
      'Interactive Gantt Charts & Milestone Deadlines',
      'Site Material Deliveries & Equipment Logbook'
    ],
    featuresAr: [
      'جداول الكميات (BOQ) وتحليل أسعار البنود',
      'إصدار فواتير المستخلصات ونسب الإنجاز التراكمية',
      'عقود مقاولي الباطن وخصم مبالغ الضمان المحتجزة',
      'مخططات جانت التفاعلية ومتابعة المواعيد النهائية',
      'تتبع توريدات مواد الموقع وسجل تشغيل المعدات'
    ],
    configSchema: [
      { key: 'defaultRetentionPercent', labelEn: 'Default Retention Withholding %', labelAr: 'نسبة الدفعة المحتجزة للضمان %', type: 'number', defaultValue: 10 },
      { key: 'requireSitePhotoForProgress', labelEn: 'Require Site Inspection Photos for Milestones', labelAr: 'طلب صور ميدانية قبل اعتماد نسب الإنجاز', type: 'boolean', defaultValue: true }
    ]
  },
  {
    appId: 'travel_agency',
    nameEn: 'Travel Agency & Tourism Operations',
    nameAr: 'وكالات السفر والسياحة والحجوزات',
    taglineEn: 'Flight and hotel bookings, visa issuance tracker, custom holiday packages, and passenger manifests.',
    taglineAr: 'حجوزات الطيران والفنادق، تتبع إصدار التأشيرات، باقات الرحلات السياحية، وقوائم المسافرين.',
    descriptionEn: 'Comprehensive travel management: flight and hotel reservations, Saudi & international visa workflow tracker, custom tour packaging with multi-currency pricing, passenger manifest exports, and supplier commission reconciliation.',
    descriptionAr: 'حل متكامل لمكاتب وشركات السياحة: حجوزات الطيران والفنادق، متابعة معاملات التأشيرات، تصميم وتسعير الباقات السياحية، وتصدير قوائم الركاب ومطابقة عمولات الموردين.',
    category: 'industry_verticals',
    appType: 'core_vertical',
    icon: 'plane',
    version: '2.8.0',
    downloadSize: '11.5 MB',
    author: 'Maqder Core',
    rating: 4.92,
    reviewsCount: 194,
    pricingTier: 'free',
    badge: 'Tourism',
    defaultRoute: '/app/dashboard/travel-bookings',
    businessTypeGrant: 'travel_agency',
    featuresEn: [
      'Flight & Hotel Reservation Central Hub',
      'Visa Application Lifecycle & Document Tracker',
      'Custom Tour & Holiday Package Builder',
      'Passenger Manifest & PNR Management',
      'Supplier Commission & Voucher Auto-Settlement'
    ],
    featuresAr: [
      'مركز موحد لحجوزات الطيران والفنادق والمواصلات',
      'تتبع مراحل استخراج التأشيرات السياحية والتجارية',
      'تصميم وتسعير باقات الرحلات والبرامج السياحية',
      'إدارة سجلات الركاب PNR وتصدير القوائم الرسمية',
      'تسوية عمولات الموردين وإصدار قسائم الحجز تلقائياً'
    ],
    configSchema: [
      { key: 'defaultCommissionPercent', labelEn: 'Default Agency Markup %', labelAr: 'نسبة عمولة الوكالة الافتراضية %', type: 'number', defaultValue: 12 }
    ]
  },
  {
    appId: 'restaurant_cafe',
    nameEn: 'Restaurant, Cafe & Kitchen (KDS)',
    nameAr: 'المطاعم والمقاهي وشاشات المطبخ الذكية',
    taglineEn: 'Touch POS with table layout, Kitchen Display System (KDS), QR digital menu, and recipe cost depletion.',
    taglineAr: 'كاشير لمسي مع خريطة الطاولات، شاشات المطبخ KDS، منيو الباركود، والخصم التلقائي للمكونات.',
    descriptionEn: 'Full F&B operational suite: high-speed dine-in, takeaway and delivery POS, interactive table floor designer, live Kitchen Display screens with station routing, contactless QR digital menu, recipe BOMs with automated ingredient inventory deduction, and modifier combos.',
    descriptionAr: 'منظومة المطاعم والمقاهي المتطورة: كاشير لمسي سريع للمحلي والسفري والتوصيل، خريطة تفاعلية للطاولات، شاشات المطبخ الفورية KDS، منيو رقمي بالباركود، وخصم مكونات الوجبات من المخزون.',
    category: 'industry_verticals',
    appType: 'core_vertical',
    icon: 'utensils',
    version: '3.4.0',
    downloadSize: '15.6 MB',
    author: 'Maqder Core',
    rating: 4.97,
    reviewsCount: 512,
    pricingTier: 'free',
    badge: 'Popular F&B',
    defaultRoute: '/app/dashboard/restaurant/pos',
    businessTypeGrant: 'restaurant',
    featuresEn: [
      'High-Speed Touch POS & Split/Merge Table Bills',
      'Real-Time Kitchen Display System (KDS) Routing',
      'Interactive QR Digital Menu with Live Stock Sync',
      'Recipe Ingredient Yields & Auto-Inventory Depletion',
      'Delivery Aggregator Integrations (HungerStation, Jahez)'
    ],
    featuresAr: [
      'كاشير لمسي سريع مع تقسيم ودمج فواتير الطاولات',
      'شاشات المطبخ التفاعلية KDS مع توجيه الطلبات للمحطات',
      'منيو رقمي تفاعلي بالباركود مع تزامن المخزون اللحظي',
      'شجرة مكونات الوجبات وخصم المواد الخام تلقائياً',
      'ربط منصات وتطبيقات التوصيل (هنقرستيشن، جاهز، تويو)'
    ],
    configSchema: [
      { key: 'enableKdsSound', labelEn: 'Enable Sound Chime on New KDS Orders', labelAr: 'تفعيل التنبيه الصوتي عند وصول طلب للمطبخ', type: 'boolean', defaultValue: true },
      { key: 'defaultServiceChargePercent', labelEn: 'Default Dine-in Service Charge %', labelAr: 'نسبة خدمة الصالة الافتراضية %', type: 'number', defaultValue: 0 }
    ]
  },
  {
    appId: 'car_rental',
    nameEn: 'Car Rental & Fleet Leasing',
    nameAr: 'تأجير السيارات وإدارة الأسطول والعقود',
    taglineEn: 'Vehicle checkout/return, interactive damage matrix, customer KYC, overdue calculations, and lease contracts.',
    taglineAr: 'تسليم واستلام المركبات، مصفوفة فحص الصدمات، التحقق من هوية المستأجر، وعقود التأجير.',
    descriptionEn: 'Automate vehicle leasing operations: visual fleet availability calendar, digital vehicle check-out and intake with inspection photo capture, 3D body damage marker, customer KYC identity verification, automated late penalty calculation, and Tamm integration support.',
    descriptionAr: 'إدارة متكاملة لمكاتب تأجير السيارات: جدول توفر المركبات الفوري، عقود الإيجار الرقمية، فحص المركبة وتسجيل الملاحظات والصدمات بالصور، التحقق من رخص القيادة، وحساب غرامات التأخير آلياً.',
    category: 'industry_verticals',
    appType: 'core_vertical',
    icon: 'car',
    version: '3.0.0',
    downloadSize: '13.4 MB',
    author: 'Maqder Core',
    rating: 4.93,
    reviewsCount: 220,
    pricingTier: 'free',
    badge: 'Fleet',
    defaultRoute: '/app/rental/active',
    businessTypeGrant: 'car_rental',
    featuresEn: [
      'Interactive Fleet Availability & Reservation Timeline',
      'Vehicle Damage Matrix with Pre/Post Photos',
      'Customer ID & Driving License Verification (KYC)',
      'Automated Kilometre Overages & Late Penalties',
      'Periodic Maintenance & Oil Change Reminders'
    ],
    featuresAr: [
      'جدول زمني تفاعلي لحجوزات وتوفر أسطول السيارات',
      'مصفوفة فحص أضرار وخدوش المركبة بالصور قبل وبعد الإيجار',
      'التحقق الإلكتروني من الهوية الوطنية ورخصة القيادة',
      'احتساب الكيلومترات الزائدة وغرامات التأخير تلقائياً',
      'تنبيهات وجدولة الصيانة الدورية وتغيير الزيوت'
    ],
    configSchema: [
      { key: 'freeKmPerDay', labelEn: 'Free Kilometres per Day', labelAr: 'الكيلومترات المجانية المشمولة يومياً', type: 'number', defaultValue: 250 },
      { key: 'extraKmRate', labelEn: 'Extra KM Charge (SAR)', labelAr: 'سعر الكيلومتر الإضافي (ريال)', type: 'number', defaultValue: 0.5 }
    ]
  },
  {
    appId: 'laundry_cleaning',
    nameEn: 'Laundry & Dry Cleaning POS',
    nameAr: 'نظام المغاسل والتنظيف الجاف المتقدم',
    taglineEn: 'Garment barcode tagging, Kanban washing/ironing stages, express rush pricing, and SMS pickup alerts.',
    taglineAr: 'ترميز الملابس بالباركود، مسار الغسيل والكي كانبان، الخدمة المستعجلة، ورسائل الجاهزية.',
    descriptionEn: 'Purpose-built laundry management: lightning-fast garment check-in with thermal tag printing, visual Kanban pipeline for Wash/Dry/Iron/Ready states, garment weight or per-piece billing, customer pickup WhatsApp notifications, and home delivery dispatch.',
    descriptionAr: 'منظومة ذكية للمغاسل والتنظيف الجاف: استقبال سريع للقطع مع طباعة باركود مقاوم للماء، لوحة كانبان لمتابعة مراحل الغسيل والكي والجاهزية، تسعير بالقطعة أو الكيلو، وإرسال تنبيهات واتساب للعميل عند اكتمال الطلب.',
    category: 'industry_verticals',
    appType: 'core_vertical',
    icon: 'washing-machine',
    version: '2.9.0',
    downloadSize: '10.2 MB',
    author: 'Maqder Core',
    rating: 4.89,
    reviewsCount: 168,
    pricingTier: 'free',
    badge: 'Services',
    defaultRoute: '/app/laundry/pos',
    businessTypeGrant: 'laundry',
    featuresEn: [
      'Garment Thermal Tagging & Water-Resistant Barcodes',
      'Visual Kanban Workflow (Received, Wash, Iron, Ready)',
      'Piece & KG Pricing with Starch/Perfume Addons',
      'Automated Customer WhatsApp Pickup Notifications',
      'Home Delivery Route & Driver Collection Management'
    ],
    featuresAr: [
      'طباعة شرائط الباركود الحرارية المقاومة للمياه على الملابس',
      'لوحة تحكم مرئية لمراحل الاستلام والغسيل والكي والجاهزية',
      'تسعير مرن بالقطعة أو الوزن مع خيارات النشا والتعطير',
      'إشعار العميل آلياً عبر الواتساب فور اكتمال تجهيز ملابسه',
      'إدارة خطوط التوصيل المنزلي واستلام الملابس من المنازل'
    ],
    configSchema: [
      { key: 'autoSendReadySms', labelEn: 'Auto-Send WhatsApp Notification when Order is Ready', labelAr: 'إرسال إشعار واتساب تلقائي عند اكتمال الطلب', type: 'boolean', defaultValue: true }
    ]
  },
  {
    appId: 'saloon_barber',
    nameEn: 'Saloon, Barber & Spa Management',
    nameAr: 'إدارة صالونات الحلاقة والتجميل والسبا',
    taglineEn: 'Live chair queue, walk-in POS, appointment scheduling, stylist commission tracking, and consumables ledger.',
    taglineAr: 'طابور الكراسي المباشر، كاشير سريع، حجز المواعيد، عمولات الموظفين، وتتبع المستهلكات.',
    descriptionEn: 'Modern beauty salon and barbershop software: live waiting room queue display, rapid POS for services and packages, appointment calendar with SMS reminders, staff commission and tip distribution, and backbar inventory depletion tracking.',
    descriptionAr: 'برنامج إدارة صالونات الحلاقة ومراكز التجميل والسبا: شاشة ذكية لإدارة طابور الانتظار وتوزيع الكراسي، نقطة بيع فورية للخدمات والباقات، حجز المواعيد المسبقة، حساب نسب وعمولات الموظفين، وتتبع استهلاك مستحضرات التجميل.',
    category: 'industry_verticals',
    appType: 'core_vertical',
    icon: 'scissors',
    version: '2.7.0',
    downloadSize: '9.8 MB',
    author: 'Maqder Core',
    rating: 4.91,
    reviewsCount: 185,
    pricingTier: 'free',
    badge: 'Care & Beauty',
    defaultRoute: '/app/saloon/pos',
    businessTypeGrant: 'saloon',
    featuresEn: [
      'Live Queue TV Display & Specialist Chair Assignment',
      'Flexible Staff Commission & Tip Calculation Ledger',
      'Services, Packages & Treatment Duration Scheduler',
      'Customer Online Booking & WhatsApp Reminders',
      'Consumables & Backbar Product Usage Tracking'
    ],
    featuresAr: [
      'شاشة عرض تفاعلية لطابور الانتظار وحجز كراسي الخدمة',
      'سجل احتساب عمولات ونسب الحلاقين والإكراميات آلياً',
      'كتالوج الخدمات والباقات العلاجية مع ضبط مدة كل خدمة',
      'حجز المواعيد إلكترونياً مع تنبيهات واتساب قبل الموعد',
      'تتبع استهلاك المواد والمستحضرات التجميلية في الصالون'
    ],
    configSchema: [
      { key: 'defaultCommissionPercent', labelEn: 'Default Stylist Commission %', labelAr: 'نسبة عمولة الموظف الافتراضية %', type: 'number', defaultValue: 30 }
    ]
  },
  {
    appId: 'tailor_khayyat',
    nameEn: 'Tailoring & Custom Stitching (Khayyat)',
    nameAr: 'إدارة المشاغل والخياطة الرجالية والنسائية',
    taglineEn: '30+ point body measurement profiles, fabric bolt inventory, custom design styles, and worker piece rates.',
    taglineAr: 'سجل المقاسات التفصيلي، مخزون طاقات الأقمشة، تخصيص الموديلات، وأجور الخياطين بالقطعة.',
    descriptionEn: 'Specialized tailor shop and atelier ERP: store 30+ precise body measurements per customer, manage fabric bolts in metres/yards, customize collars, cuffs, embroidery patterns, track stitching production stages, schedule fitting trials, and calculate tailor piece-rate earnings.',
    descriptionAr: 'النظام الرائد للمشاغل ومحلات الخياطة: حفظ ملف المقاسات الدقيقة لأكثر من 30 قياساً، إدارة طاقات الأقمشة وتتبع الأمتار المتبقية، تخصيص الياقات والجيوب والتطريز، متابعة مراحل الخياطة والبروفة، واحتساب مستحقات الخياطين بالقطعة.',
    category: 'industry_verticals',
    appType: 'core_vertical',
    icon: 'needle',
    version: '3.1.0',
    downloadSize: '12.1 MB',
    author: 'Maqder Core',
    rating: 4.95,
    reviewsCount: 310,
    pricingTier: 'free',
    badge: 'Tailoring',
    defaultRoute: '/app/dashboard/khayyat',
    businessTypeGrant: 'khayyat',
    featuresEn: [
      'Detailed 30+ Point Body Measurement Database',
      'Fabric Bolt Inventory with Precise Metre/Yard Metering',
      'Style Customizer (Collars, Cuffs, Pockets, Embroidery)',
      'Worker Piece-Rate Ledger & Production Timelines',
      'Fitting Appointment Scheduler & Ready Alerts'
    ],
    featuresAr: [
      'سجل قياسات تفصيلي دقيق يشمل أكثر من 30 قياساً للعميل',
      'إدارة مخزون طاقات الأقمشة وخصم الأمتار والياردات بدقة',
      'تخصيص كامل للتفاصيل (الياقات، الكبك، الجيوب، التطريز)',
      'حساب أجور الخياطين بالقطعة ومتابعة مراحل الإنجاز',
      'جدولة مواعيد البروفة وإرسال إشعار جاهزية الثوب للعميل'
    ],
    configSchema: [
      { key: 'defaultThobeFabricMeters', labelEn: 'Average Meters per Standard Thobe', labelAr: 'متوسط الأمتار المستهلكة للثوب الواحد', type: 'number', defaultValue: 3.5 }
    ]
  },
  {
    appId: 'boutique_rental',
    nameEn: 'Boutique & Designer Dress Rental',
    nameAr: 'إدارة البوتيكات وتأجير فساتين المناسبات',
    taglineEn: 'Event dress booking calendar, refundable security deposits, alteration work orders, and return inspections.',
    taglineAr: 'تقويم حجوزات فساتين المناسبات، مبالغ التأمين المستردة، أوامر التعديل، وفحص ما بعد الإرجاع.',
    descriptionEn: 'Luxury fashion boutique and dress rental suite: event date booking calendar, refundable deposit management, alteration and tailoring work orders, pre/post-rental quality inspection checklist, dry cleaning turnaround logs, and late return fee calculations.',
    descriptionAr: 'منظومة متطورة لبوتيكات الأزياء وتأجير فساتين السهرة والأعراس: تقويم مرئي لحجوزات المناسبات، إدارة مبالغ التأمين المستردة، أوامر عمل التعديلات والمقاسات، فحص جودة القطعة بعد الإرجاع، وجدولة الغسيل الجاف وحساب غرامات التأخير.',
    category: 'industry_verticals',
    appType: 'core_vertical',
    icon: 'sparkles',
    version: '2.8.0',
    downloadSize: '11.0 MB',
    author: 'Maqder Core',
    rating: 4.90,
    reviewsCount: 142,
    pricingTier: 'free',
    badge: 'Haute Couture',
    defaultRoute: '/app/dashboard/boutique/pos',
    businessTypeGrant: 'boutique',
    featuresEn: [
      'Visual Event Booking Calendar & Availability Lock',
      'Refundable Security Deposit & Bond Ledger',
      'Alteration & Fitting Workshop Work Orders',
      'Post-Rental Inspection Logs & Damage Claims',
      'Dry Cleaning Cycle & Turnaround Scheduler'
    ],
    featuresAr: [
      'تقويم تفاعلي لحجز الفساتين وتثبيت مواعيد المناسبات',
      'إدارة مبالغ التأمين والضمان المالي المسترد للعملاء',
      'أوامر عمل التعديل والمقاسات للمشغل قبل موعد التسليم',
      'سجل فحص حالة الفستان بعد الاسترجاع وخصم الأضرار',
      'جدولة دورة التنظيف الجاف وتجهيز الفستان للحجز التالي'
    ],
    configSchema: [
      { key: 'defaultDepositAmount', labelEn: 'Default Security Deposit (SAR)', labelAr: 'مبلغ التأمين المسترد الافتراضي (ريال)', type: 'number', defaultValue: 500 }
    ]
  },
  {
    appId: 'manpower_supply',
    nameEn: 'Manpower & Labor Supply ERP',
    nameAr: 'إدارة شركات الاستقدام وتوريد العمالة',
    taglineEn: 'Worker allocations, client project contracts, Iqama/visa expiry tracker, digital timesheets, and man-hour billing.',
    taglineAr: 'تسكين العمالة، عقود توريد الشركات، تتبع الإقامات والتأشيرات، وساعات العمل والفوترة.',
    descriptionEn: 'Enterprise workforce supply ERP: worker master registry with Iqama/Visa/Medical expiry alerts, client project deployment contracts, digital timesheets with biometric/mobile overtime approvals, automated monthly client invoicing per man-hour/day, and WPS payroll reconciliation.',
    descriptionAr: 'منظومة شاملة لشركات استقدام وتوريد الكوادر البشرية: سجل العمالة الشامل مع تنبيهات انتهاء الإقامات والتأشيرات والتأمين الطبي، عقود توريد العمالة للمشاريع، اعتماد ساعات العمل الإضافية (Timesheet)، والفوترة الشهرية للشركات ومطابقة حماية الأجور.',
    category: 'industry_verticals',
    appType: 'core_vertical',
    icon: 'users',
    version: '3.3.0',
    downloadSize: '15.2 MB',
    author: 'Maqder Core',
    rating: 4.96,
    reviewsCount: 278,
    pricingTier: 'free',
    badge: 'Workforce',
    defaultRoute: '/app/dashboard/manpower/workers',
    businessTypeGrant: 'manpower',
    featuresEn: [
      'Worker Registry with Iqama, Visa & Medical Alerts',
      'Client Deployment Contracts & Site Allocations',
      'Digital Timesheets & Overtime Approval Flow',
      'Automated Monthly Invoicing (Per Hour / Per Day / Monthly)',
      'WPS Payroll & Worker Salary Advance Ledger'
    ],
    featuresAr: [
      'سجل العمالة مع تنبيهات انتهاء الإقامة والتأشيرة والتأمين',
      'عقود توريد الكوادر وتسكين العمال بمواقع ومشاريع العملاء',
      'سجلات الحضور وساعات العمل الإضافية المعتمدة (Timesheet)',
      'إصدار فواتير شهرية مؤتمتة بنظام الساعة أو اليومية أو الشهري',
      'مطابقة كشوف الرواتب مع حماية الأجور وسلف العمال'
    ],
    configSchema: [
      { key: 'iqamaAlertDaysBefore', labelEn: 'Alert Days Before Iqama Expiry', labelAr: 'عدد الأيام للتنبيه قبل انتهاء الإقامة', type: 'number', defaultValue: 60 }
    ]
  },
  {
    appId: 'bakala_supermarket',
    nameEn: 'Bakala, Grocery & Supermarket POS',
    nameAr: 'البقالات والسوبرماركت والتموينات الذكية',
    taglineEn: 'Sub-second barcode scanning, RS232 scale reading, expiry date markdown alerts, and multi-pack pricing.',
    taglineAr: 'كاشير باركود فائق السرعة، ربط الميزان الإلكتروني، تتبع تواريخ الصلاحية، وتسعير الكرتون والحبة.',
    descriptionEn: 'High-throughput retail grocery system: sub-second barcode checkout, direct integration with RS232/USB digital weight scales for fruits/vegetables, automated batch expiry date monitoring with promotional markdowns, carton vs single-piece dual pricing, and credit Khata ledger.',
    descriptionAr: 'نظام نقاط البيع فائق السرعة للتموينات والسوبرماركت: مسح فوري للباركود، ربط مباشر مع الموازين الإلكترونية لوزن الخضار والفواكه، تنبيهات تواريخ انتهاء الصلاحية والعروض الترويجية، بيع بالكرتون والحبة، ودفتر الحسابات الآجلة (الخاتا).',
    category: 'industry_verticals',
    appType: 'core_vertical',
    icon: 'shopping-cart',
    version: '3.2.0',
    downloadSize: '12.8 MB',
    author: 'Maqder Core',
    rating: 4.95,
    reviewsCount: 460,
    pricingTier: 'free',
    badge: 'Supermarket',
    defaultRoute: '/app/dashboard/bakala/pos',
    businessTypeGrant: 'bakala',
    featuresEn: [
      'Sub-Second Barcode Scanning & Instant POS Checkout',
      'Direct RS232/USB Digital Weight Scale Reading',
      'Batch Expiry Date Alerts & Markdown Promotions',
      'Carton / Inner Pack / Single Piece Dual Pricing',
      'Khata Customer Credit Ledger & Fast Daily P&L'
    ],
    featuresAr: [
      'مسح باركود فائق السرعة وإتمام البيع في أجزاء من الثانية',
      'قراءة مباشرة من الميزان الإلكتروني للأصناف الموزونة',
      'تنبيهات اقتراب انتهاء الصلاحية وتخفيض الأسعار التلقائي',
      'تسعير مرن للكرتون وعلبة التجزئة والحبة الواحدة',
      'دفتر تسجيل ديون العملاء (الخاتا) وملخص الأرباح اليومي'
    ],
    configSchema: [
      { key: 'enableScaleBarcodeParsing', labelEn: 'Auto-Parse Embedded Scale Barcodes (EAN-13 Price/Weight)', labelAr: 'قراءة باركود الميزان المدمج فيه الوزن والسعر تلقائياً', type: 'boolean', defaultValue: true }
    ]
  },
  {
    appId: 'car_workshop',
    nameEn: 'Auto Garage & Car Workshop ERP',
    nameAr: 'مراكز صيانة السيارات والورش المعتمدة',
    taglineEn: 'Chassis/Plate vehicle intake, digital job cards, technician time logs, spare parts auto-billing, and Taqdeer estimates.',
    taglineAr: 'استقبال المركبة برقم الهيكل، بطاقات الإصلاح الرقمية، صرف قطع الغيار، وتقديرات التأمين.',
    descriptionEn: 'Automotive repair centre suite: vehicle intake by chassis/VIN and license plate, interactive digital job cards with technician time logs, spare parts inventory dispatch with real-time billing, WhatsApp photo inspection reports for customer sign-off, and Taqdeer insurance quotation estimates.',
    descriptionAr: 'منظومة إدارة ورش ومراكز صيانة السيارات: استقبال المركبة برقم اللوحة والهيكل وسجل الصيانة السابقة، بطاقات إصلاح رقمية تتبع ساعات عمل الفنيين، صرف قطع الغيار من المستودع للفاتورة مباشرة، تقارير الفحص بالصور عبر الواتساب، وعروض أسعار معتمدة للتأمين وتقدير.',
    category: 'industry_verticals',
    appType: 'core_vertical',
    icon: 'wrench',
    version: '3.1.0',
    downloadSize: '14.0 MB',
    author: 'Maqder Core',
    rating: 4.94,
    reviewsCount: 305,
    pricingTier: 'free',
    badge: 'Auto Care',
    defaultRoute: '/app/workshop',
    businessTypeGrant: 'car_workshop',
    featuresEn: [
      'Chassis / VIN & Plate Vehicle Intake & Service History',
      'Digital Job Cards with Technician Labor Tracking',
      'Spare Parts Inventory & Real-Time Auto-Billing',
      'Customer WhatsApp Photo Inspection Approvals',
      'Taqdeer & Insurance Quotation Estimates'
    ],
    featuresAr: [
      'استقبال المركبة برقم الهيكل واللوحة والاطلاع على السجل',
      'بطاقات إصلاح رقمية وتتبع ساعات عمل وأجور الفنيين',
      'صرف قطع الغيار من المستودع وإضافتها للفاتورة آلياً',
      'إرسال صور الفحص للعميل عبر الواتساب للاعتماد الفوري',
      'إصدار عروض أسعار متوافقة مع متطلبات التأمين وتقدير'
    ],
    configSchema: [
      { key: 'defaultLaborHourlyRate', labelEn: 'Default Technician Hourly Labor Rate (SAR)', labelAr: 'أجرة ساعة عمل الفني الافتراضية (ريال)', type: 'number', defaultValue: 120 }
    ]
  },
  {
    appId: 'bookstore_stationery',
    nameEn: 'Bookstore & Stationery Retail',
    nameAr: 'المكتبات والقرطاسية والأدوات المدرسية',
    taglineEn: 'ISBN barcode lookups, publisher/author classifications, used book buyback, and school bundle packs.',
    taglineAr: 'كاشير برقم ISBN، تصنيف دور النشر والمؤلفين، شراء الكتب المستعملة، وباقات المدارس.',
    descriptionEn: 'Complete bookstore and stationery management: instant ISBN-10/13 barcode lookups, categorisation by author, publisher, genre and school grade, back-to-school bundle pack builders, used book buyback and exchange ledger, and wholesale vs retail stationery pricing.',
    descriptionAr: 'نظام متكامل للمكتبات والقرطاسية: التعرف التلقائي على الكتب عبر الرقم الدولي ISBN، تصنيف حسب المؤلفين ودور النشر والمراحل الدراسية، تجهيز باقات المستلزمات المدرسية بضغطة زر، شراء واستبدال الكتب المستعملة، وتسعير الجملة والقطاعي للأدوات المكتبية.',
    category: 'industry_verticals',
    appType: 'core_vertical',
    icon: 'book-open',
    version: '2.9.0',
    downloadSize: '10.5 MB',
    author: 'Maqder Core',
    rating: 4.88,
    reviewsCount: 135,
    pricingTier: 'free',
    badge: 'Bookstore',
    defaultRoute: '/app/dashboard/bookstore/pos',
    businessTypeGrant: 'bookstore',
    featuresEn: [
      'ISBN-10 / ISBN-13 Auto-Lookup & Fast POS Checkout',
      'Publisher, Author, Subject & School Grade Filters',
      'Back-to-School Supply List Bundles & Kit Pricing',
      'Used Book Buy-Back & Academic Exchange Management',
      'Bulk Stationery & Individual Item Dual Pricing'
    ],
    featuresAr: [
      'تعرف فوري على الكتب عبر الرقم التسلسلي الدولي ISBN',
      'تصنيف حسب دور النشر والمؤلفين والمراحل الدراسية',
      'إعداد باقات مستلزمات المدارس وقوائم الفصول المدرسية',
      'نظام استرجاع وشراء الكتب المستعملة والتبادل الدراسي',
      'تسعير الجملة والتجزئة للقرطاسية والأدوات المدرسية'
    ],
    configSchema: []
  },
  {
    appId: 'ecommerce_store',
    nameEn: 'E-Commerce & Multi-Tenant Online Store',
    nameAr: 'المتاجر الإلكترونية والبيع عبر الإنترنت',
    taglineEn: 'No-code storefront, custom domains, payment gateways (Mada/Apple Pay), courier sync, and pixel tracking.',
    taglineAr: 'متجر إلكتروني احترافي، ربط النطاقات، بوابات الدفع (مدى/Apple Pay)، بوالص الشحن، وبيكسل الإعلانات.',
    descriptionEn: 'Launch your branded online store in minutes: customizable mobile-first storefront themes, custom domain mapping with free SSL, native Saudi payment gateway checkouts (Mada, Apple Pay, Tabby, Tamara), automated multi-courier shipping waybills, and abandoned cart recovery.',
    descriptionAr: 'أطلق متجرك الإلكتروني بهويتك الخاصة: قوالب تصميم عصرية متوافقة مع الجوال، ربط نطاقك الخاص مع شهادة SSL مجانية، بوابات الدفع الإلكتروني المعتمدة (مدى، أبل باي، تابي، تمارا)، إصدار بوالص الشحن التلقائية، واستعادة السلات المتروكة.',
    category: 'industry_verticals',
    appType: 'core_vertical',
    icon: 'shopping-bag',
    version: '3.5.0',
    downloadSize: '16.8 MB',
    author: 'Maqder Core',
    rating: 4.98,
    reviewsCount: 620,
    pricingTier: 'free',
    badge: 'Online Store',
    defaultRoute: '/app/dashboard/ecommerce',
    businessTypeGrant: 'ecommerce',
    featuresEn: [
      'No-Code Storefront Theme Designer & Mobile Optimized',
      'Custom Domain Support with Free Automated SSL',
      'Payment Gateways (Mada, Apple Pay, Visa, Tabby, Tamara)',
      'Automated Courier Waybill Generation (SMSA, Aramex, DHL)',
      'Abandoned Cart WhatsApp Follow-ups & Tracking Pixels'
    ],
    featuresAr: [
      'محرر مرئي لتخصيص تصميم وهوية المتجر متوافق مع كافة الشاشات',
      'ربط النطاق الخاص (Custom Domain) مع شهادات الأمان SSL مجاناً',
      'تكامل فوري مع بوابات الدفع (مدى، أبل باي، تابي، تمارا، فيزا)',
      'إصدار بوالص الشحن التلقائية مع كبرى شركات الشحن (سمسا، أرامكس)',
      'استعادة السلات المتروكة وبيكسلات التتبع (تيك توك، ميتا، جوجل)'
    ],
    configSchema: [
      { key: 'enableCod', labelEn: 'Enable Cash on Delivery (COD)', labelAr: 'تفعيل خيار الدفع عند الاستلام', type: 'boolean', defaultValue: true },
      { key: 'codFeeAmount', labelEn: 'COD Extra Fee (SAR)', labelAr: 'رسوم إضافية للدفع عند الاستلام (ريال)', type: 'number', defaultValue: 15 }
    ]
  },
  {
    appId: 'furniture_shop',
    nameEn: 'Furniture Showroom & Custom Woodwork',
    nameAr: 'معارض الأثاث والمفروشات والتفصيل الخشبي',
    taglineEn: 'Showroom display stock, custom dimensions & woodwork, room package bundles, and delivery & assembly teams.',
    taglineAr: 'مخزون صالات العرض، طلبيات التفصيل والتنجيد، باقات تأثيث الغرف، وتتبع التوصيل والتركيب.',
    descriptionEn: 'Specialized furniture showroom and custom joinery ERP: separate floor display items from warehouse inventory, configure bespoke furniture dimensions, wood finishes and upholstery fabrics, create whole-room discount packages, and track delivery and assembly team schedules.',
    descriptionAr: 'منظومة معارض الأثاث والمفروشات وورش النجارة والتفصيل: إدارة مخزون صالات العرض التوضيحية ومستودعات البضائع، تخصيص مقاسات الأثاث ونوعية الأخشاب وأقمشة التنجيد حسب رغبة العميل، باقات تأثيث الغرف المتكاملة، وتتبع فرق التوصيل والتركيب المنزلي.',
    category: 'industry_verticals',
    appType: 'core_vertical',
    icon: 'sofa',
    version: '3.0.0',
    downloadSize: '13.2 MB',
    author: 'Maqder Core',
    rating: 4.93,
    reviewsCount: 195,
    pricingTier: 'free',
    badge: 'Showroom',
    defaultRoute: '/app/dashboard/furniture/pos',
    businessTypeGrant: 'furniture_shop',
    featuresEn: [
      'Showroom Floor Display vs Warehouse Stock Management',
      'Custom Furniture Dimensions, Wood & Upholstery Specs',
      'Whole-Room Furniture Packages & Bundle Discounts',
      'Delivery & Installation Route & Team Scheduling',
      'Layaway Deposit & Installment Milestone Tracking'
    ],
    featuresAr: [
      'فصل مخزون صالات العرض التوضيحية عن مخزون المستودعات الرئيسي',
      'تخصيص المقاسات ونوعية الأخشاب وأقمشة التنجيد حسب الطلب',
      'عروض وباقات تأثيث الغرف المتكاملة والخصومات الخاصة',
      'جدولة فرق التوصيل والتركيب المنزلي وتتبع إتمام الخدمة',
      'أنظمة الدفع بالأقساط وحجز البضائع حتى اكتمال التجهيز'
    ],
    configSchema: [
      { key: 'defaultAssemblyWarrantyMonths', labelEn: 'Default Installation Warranty (Months)', labelAr: 'مدة ضمان التركيب الافتراضية (بالأشهر)', type: 'number', defaultValue: 12 }
    ]
  },

  // ══════════════════════════════════════════════════════════════════════════════
  // ── 2. CORE BUSINESS & OPERATIONS ADD-ONS ─────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════════
  {
    appId: 'fleet_machinery',
    nameEn: 'Fleet & Machinery Management',
    nameAr: 'إدارة الأسطول والمعدات',
    taglineEn: 'Track vehicles, equipment, and maintenance schedules with automated alerts.',
    taglineAr: 'تتبع المركبات والمعدات وجداول الصيانة مع تنبيهات تلقائية.',
    descriptionEn: 'Complete fleet and machinery lifecycle management: asset registration, preventive maintenance scheduling, fuel tracking, depreciation calculations, and real-time maintenance alert notifications.',
    descriptionAr: 'إدارة شاملة لدورة حياة الأسطول والمعدات من التسجيل والصيانة الوقائية وتتبع الوقود وحساب الإهلاك والتنبيهات اللحظية.',
    category: 'hr_manpower',
    appType: 'core_vertical',
    icon: 'truck',
    version: '2.4.0',
    downloadSize: '6.4 MB',
    author: 'Maqder Core',
    rating: 4.8,
    reviewsCount: 95,
    pricingTier: 'free',
    badge: 'Operations',
    defaultRoute: '/app/dashboard/fleet',
    featuresEn: [
      'Vehicle & Equipment Asset Registry',
      'Preventive Maintenance Scheduling & Alerts',
      'Fuel Consumption & Cost Tracking',
      'Depreciation & Asset Valuation Reports'
    ],
    featuresAr: [
      'سجل أصول المركبات والمعدات',
      'جدولة الصيانة الوقائية والتنبيهات',
      'تتبع استهلاك الوقود والتكاليف',
      'تقارير الإهلاك وتقييم الأصول'
    ],
    configSchema: []
  },
  {
    appId: 'landed_costs',
    nameEn: 'Landed Costs',
    nameAr: 'التكاليف المرسية',
    taglineEn: 'Allocate import duties, freight, and customs charges across purchase orders.',
    taglineAr: 'توزيع رسوم الاستيراد والشحن والجمارك على أوامر الشراء.',
    descriptionEn: 'Accurately allocate landed costs including freight, insurance, customs duties, and handling charges to imported goods for true cost-of-goods-sold calculations.',
    descriptionAr: 'توزيع دقيق للتكاليف المرسية على البضائع المستوردة لحساب التكلفة الحقيقية للبضائع المباعة.',
    category: 'finance_accounting',
    appType: 'core_vertical',
    icon: 'anchor',
    version: '2.4.0',
    downloadSize: '3.8 MB',
    author: 'Maqder Core',
    rating: 4.7,
    reviewsCount: 68,
    pricingTier: 'free',
    badge: 'Import/Export',
    defaultRoute: '/app/dashboard/landed-costs',
    featuresEn: [
      'Multi-Currency Freight & Duty Allocation',
      'Per-Unit Cost Breakdown by SKU',
      'Customs Clearance Document Management',
      'Automatic COGS Adjustment on Receipt'
    ],
    featuresAr: [
      'توزيع الشحن والرسوم متعدد العملات',
      'تفصيل التكلفة لكل وحدة حسب المنتج',
      'إدارة مستندات التخليص الجمركي',
      'تعديل تلقائي لتكلفة البضاعة عند الاستلام'
    ],
    configSchema: []
  },
  {
    appId: 'iot_devices',
    nameEn: 'IoT & Smart Devices',
    nameAr: 'إنترنت الأشياء والأجهزة الذكية',
    taglineEn: 'Connect sensors, monitors, and smart devices for real-time operational insights.',
    taglineAr: 'ربط المستشعرات والشاشات والأجهزة الذكية للحصول على رؤى تشغيلية لحظية.',
    descriptionEn: 'IoT device management platform: register sensors and smart devices, configure thresholds and alerts, visualize real-time telemetry dashboards, and automate actions based on device readings.',
    descriptionAr: 'منصة إدارة أجهزة إنترنت الأشياء: تسجيل المستشعرات، ضبط الحدود والتنبيهات، لوحات بيانات لحظية، وأتمتة الإجراءات بناءً على قراءات الأجهزة.',
    category: 'hardware_iot',
    appType: 'core_vertical',
    icon: 'cpu',
    version: '2.4.0',
    downloadSize: '5.2 MB',
    author: 'Maqder Core',
    rating: 4.6,
    reviewsCount: 42,
    pricingTier: 'free',
    badge: 'Smart',
    defaultRoute: '/app/dashboard/iot',
    featuresEn: [
      'Device Registration & Health Monitoring',
      'Real-Time Telemetry Dashboards',
      'Threshold Alerts & Automated Actions',
      'Historical Data Analytics & Export'
    ],
    featuresAr: [
      'تسجيل الأجهزة ومراقبة صحتها',
      'لوحات بيانات لحظية',
      'تنبيهات الحدود والإجراءات التلقائية',
      'تحليلات البيانات التاريخية والتصدير'
    ],
    configSchema: []
  },
  {
    appId: 'crm_sales_pipeline',
    nameEn: 'CRM & Sales Pipeline',
    nameAr: 'إدارة العملاء وخط المبيعات',
    taglineEn: 'Manage leads, contacts, deals, and campaigns in one unified pipeline.',
    taglineAr: 'إدارة العملاء المحتملين وجهات الاتصال والصفقات والحملات في خط أنابيب موحد.',
    descriptionEn: 'Full-featured CRM: lead capture from multiple channels, contact management, deal pipeline with Kanban boards, activity scheduling, email campaigns, and sales performance analytics.',
    descriptionAr: 'نظام CRM متكامل: التقاط العملاء المحتملين من قنوات متعددة، إدارة جهات الاتصال، خط الصفقات بلوحات كانبان، جدولة الأنشطة، حملات البريد الإلكتروني، وتحليلات أداء المبيعات.',
    category: 'hr_manpower',
    appType: 'core_vertical',
    icon: 'target',
    version: '2.4.0',
    downloadSize: '8.6 MB',
    author: 'Maqder Core',
    rating: 4.9,
    reviewsCount: 215,
    pricingTier: 'free',
    badge: 'Popular',
    defaultRoute: '/app/dashboard/crm',
    featuresEn: [
      'Lead Capture & Scoring Engine',
      'Visual Deal Pipeline with Kanban Boards',
      'Activity Scheduling & Follow-up Reminders',
      'Campaign Management & Email Automation',
      'Sales Performance Analytics & Forecasting',
      'Contact & Company Management'
    ],
    featuresAr: [
      'التقاط وتسجيل العملاء المحتملين تلقائياً',
      'خط أنابيب الصفقات المرئي بلوحات كانبان',
      'جدولة الأنشطة والتذكيرات للمتابعة',
      'إدارة الحملات وأتمتة البريد الإلكتروني',
      'تحليلات أداء المبيعات والتنبؤات',
      'إدارة جهات الاتصال والشركات'
    ],
    configSchema: []
  },
  {
    appId: 'hr_payroll_pro',
    nameEn: 'HR, Payroll & Attendance',
    nameAr: 'الموارد البشرية والرواتب والحضور',
    taglineEn: 'Complete workforce management with payroll, attendance, leaves, and compliance.',
    taglineAr: 'إدارة شاملة للقوى العاملة تشمل الرواتب والحضور والإجازات والامتثال.',
    descriptionEn: 'Enterprise HR suite: employee records, biometric attendance tracking, automated payroll with GOSI/EOSB calculations, leave management, performance reviews, hiring pipeline, expense claims, and Saudi labor compliance.',
    descriptionAr: 'حزمة موارد بشرية متكاملة: سجلات الموظفين، تتبع الحضور البيومتري، كشوف رواتب تلقائية مع حسابات التأمينات ومكافأة نهاية الخدمة، إدارة الإجازات، تقييم الأداء، خط التوظيف، مطالبات المصروفات، والامتثال لنظام العمل السعودي.',
    category: 'hr_manpower',
    appType: 'core_vertical',
    icon: 'users',
    version: '2.4.0',
    downloadSize: '12.4 MB',
    author: 'Maqder Core',
    rating: 4.85,
    reviewsCount: 310,
    pricingTier: 'free',
    badge: 'Essential',
    defaultRoute: '/app/dashboard/employees',
    featuresEn: [
      'Employee Records & Document Management',
      'Biometric Attendance & Shift Tracking',
      'Automated Payroll with WPS Compliance',
      'GOSI & EOSB Auto-Calculations',
      'Leave Management & Approval Workflows',
      'Performance Reviews & KPIs',
      'Hiring Pipeline & Onboarding',
      'Expense Claims & Reimbursements',
      'Saudi Labor Law Compliance (Iqama/Balady)'
    ],
    featuresAr: [
      'سجلات الموظفين وإدارة المستندات',
      'حضور بيومتري وتتبع الورديات',
      'كشوف رواتب تلقائية متوافقة مع نظام حماية الأجور',
      'حساب تلقائي للتأمينات ومكافأة نهاية الخدمة',
      'إدارة الإجازات وسير عمل الموافقات',
      'تقييم الأداء ومؤشرات الأداء الرئيسية',
      'خط التوظيف والتهيئة',
      'مطالبات المصروفات والاسترداد',
      'امتثال نظام العمل السعودي (إقامة/بلدي)'
    ],
    configSchema: []
  },
  {
    appId: 'delivery_platforms',
    nameEn: 'Delivery Platforms',
    nameAr: 'منصات التوصيل',
    taglineEn: 'Integrate delivery platforms and manage driver dispatch for restaurant orders.',
    taglineAr: 'ربط منصات التوصيل وإدارة إرسال السائقين لطلبات المطعم.',
    descriptionEn: 'Restaurant delivery management: connect with HungerStation, Jahez, Marsool, and ToYou. Manage driver dispatch, track delivery status in real-time, and reconcile delivery platform settlements.',
    descriptionAr: 'إدارة توصيل المطاعم: ربط مع هنقرستيشن وجاهز ومرسول وتويو. إدارة إرسال السائقين، تتبع حالة التوصيل لحظياً، ومطابقة تسويات منصات التوصيل.',
    category: 'pos_retail',
    appType: 'core_vertical',
    icon: 'bike',
    version: '2.4.0',
    downloadSize: '7.1 MB',
    author: 'Maqder Core',
    rating: 4.75,
    reviewsCount: 178,
    pricingTier: 'free',
    badge: 'Restaurant',
    defaultRoute: '/app/dashboard/restaurant/delivery',
    featuresEn: [
      'Multi-Platform Integration (HungerStation, Jahez, Marsool)',
      'Real-Time Order & Driver Tracking',
      'Automated Dispatch & Route Optimization',
      'Delivery Settlement Reconciliation'
    ],
    featuresAr: [
      'ربط متعدد المنصات (هنقرستيشن، جاهز، مرسول)',
      'تتبع لحظي للطلبات والسائقين',
      'إرسال تلقائي وتحسين المسارات',
      'مطابقة تسويات التوصيل'
    ],
    configSchema: []
  },
  {
    appId: 'payment_terminal',
    nameEn: 'Payment Terminal Integration',
    nameAr: 'ربط أجهزة الدفع الإلكتروني',
    taglineEn: 'Connect Mada, Apple Pay, Visa & Mastercard POS terminals directly.',
    taglineAr: 'ربط مباشر لشبكة مدى وApple Pay مع أجهزة نقاط البيع.',
    descriptionEn: 'Direct integration with Android POS payment terminals (Geidea, PayTabs, NearPay) via local Wi-Fi / Cloud APIs, eliminating manual transaction input and speeding up checkout.',
    descriptionAr: 'تكامل مباشر مع أجهزة مدى الذكية يرسل المبلغ للشاشة تلقائياً ويسجل الفاتورة فور قبول الدفع.',
    category: 'hardware_iot',
    appType: 'hardware_integration',
    icon: 'credit-card',
    version: '2.4.0',
    downloadSize: '4.5 MB',
    author: 'Maqder Core',
    rating: 4.95,
    reviewsCount: 380,
    pricingTier: 'free',
    badge: 'Mada Certified',
    requiresHardware: true,
    defaultRoute: '/app/dashboard/settings',
    featuresEn: [
      'Automatic Amount Push to Terminal on Checkout',
      'Instant Webhook Approval & Receipt Stamping',
      'Daily Batch Settlement Reconciliation',
      'Support for Mada, Apple Pay, Visa, Mastercard'
    ],
    featuresAr: [
      'إرسال المبلغ لجهاز مدى تلقائياً فور طلب الدفع',
      'اعتماد فوري للعملية وطباعة الفاتورة بدون تأخير',
      'تقارير مطابقة الموازنة اليومية لشبكة مدى',
      'دعم بطاقات مدى، أبل باي، فيزا، وماستركارد'
    ],
    configSchema: [
      { key: 'terminalProvider', labelEn: 'Terminal Provider', labelAr: 'مزود جهاز الدفع', type: 'select', defaultValue: 'geidea', options: [{ value: 'geidea', labelEn: 'Geidea', labelAr: 'جيديا' }, { value: 'paytabs', labelEn: 'PayTabs', labelAr: 'بي تابز' }, { value: 'nearpay', labelEn: 'NearPay', labelAr: 'نير باي' }] }
    ]
  },
  {
    appId: 'zatca_phase2_pro',
    nameEn: 'ZATCA Phase 2 E-Invoicing Hub',
    nameAr: 'بوابة الفوترة الإلكترونية زاتكا المرحلة الثانية',
    taglineEn: 'Automated Cryptographic Stamping, QR Generation, and Real-Time Clearance.',
    taglineAr: 'الختم الرقمي والتشفير وتوليد الباركود والربط المباشر مع هيئة الزكاة والضريبة والجمارك.',
    descriptionEn: 'Full ZATCA Phase 2 (FATOORA) compliance suite: automated cryptographic stamping, XML UBL 2.1 generation, CSID onboarding, B2B tax clearance, and B2C simplified invoice reporting.',
    descriptionAr: 'تكامل معتمد مع منصة فاتورة للربط والتكامل والتخليص اللحظي للفواتير الضريبية والمبسطة.',
    category: 'saudi_compliance',
    appType: 'saudi_compliance',
    icon: 'shield',
    version: '4.1.0',
    downloadSize: '9.2 MB',
    author: 'Maqder Saudi Gov Suite',
    rating: 5.0,
    reviewsCount: 890,
    pricingTier: 'free',
    badge: 'ZATCA Certified',
    defaultRoute: '/app/dashboard/tenant-settings/zatca-dashboard',
    featuresEn: [
      'Automatic XML UBL 2.1 Generation & Validation',
      'ECDSA Secp256k1 Cryptographic Digital Stamping',
      'Real-time ZATCA Clearance & Reporting APIs',
      'Automated CSID Renewal & Secret Rotation'
    ],
    featuresAr: [
      'توليد والتحقق من ملفات XML UBL 2.1 تلقائياً',
      'الختم الرقمي والتشفير بمفاتيح ECDSA المعتمدة',
      'التخليص الفوري والإشعار اللحظي مع زاتكا',
      'تجديد شهادات CSID وتدوير المفاتيح آلياً'
    ],
    configSchema: [
      { key: 'environment', labelEn: 'ZATCA Environment', labelAr: 'بيئة زاتكا', type: 'select', defaultValue: 'sandbox', options: [{ value: 'sandbox', labelEn: 'Sandbox (Testing)', labelAr: 'بيئة التجربة' }, { value: 'simulation', labelEn: 'Simulation', labelAr: 'بيئة المحاكاة' }, { value: 'production', labelEn: 'Live Production', labelAr: 'البيئة الإنتاجية الحية' }] },
      { key: 'autoReportB2C', labelEn: 'Auto-report B2C invoices within 24h', labelAr: 'الإبلاغ التلقائي عن الفواتير المبسطة خلال 24 ساعة', type: 'boolean', defaultValue: true }
    ]
  },
  {
    appId: 'thermal_printer_driver',
    nameEn: 'Thermal Print & POS Network Hub',
    nameAr: 'محرك الطباعة الحرارية المباشرة وشبكة الكاشير',
    taglineEn: 'Direct ESC/POS, Bluetooth, USB, and LAN thermal printer integration without print popups.',
    taglineAr: 'طباعة فورية مباشرة بدون نوافذ متصفح عبر البلوتوث والـ USB وشبكة LAN.',
    descriptionEn: 'High-speed hardware driver enabling direct thermal receipt printing (58mm/80mm), kitchen ticket routing, automated cash drawer kick, and barcode label printer integration.',
    descriptionAr: 'تعريف أجهزة الطباعة الحرارية وطابعات الباركود وفتح درج النقود المباشر للكاشير والمطابخ والمصانع.',
    category: 'hardware_iot',
    appType: 'hardware_integration',
    icon: 'printer',
    version: '2.1.4',
    downloadSize: '1.9 MB',
    author: 'Maqder IoT Labs',
    rating: 4.94,
    reviewsCount: 215,
    pricingTier: 'free',
    badge: 'Hardware Ready',
    defaultRoute: '/app/dashboard/settings',
    requiresHardware: true,
    featuresEn: [
      'Direct ESC/POS Raw Thermal Printing',
      'LAN Network & Wi-Fi Printer Auto-Discovery',
      'Automated RJ11 Cash Drawer Kick Pulse',
      'Custom Multi-Language Receipt Layout Engine'
    ],
    featuresAr: [
      'طباعة حرارية مباشرة بأوامر ESC/POS السريعة',
      'اكتشاف طابعات الشبكة والواي فاي تلقائياً',
      'إرسال نبضة فتح درج الكاشير فور إتمام العملية',
      'تنسيق متقدم للفواتير بالعربية والإنجليزية'
    ],
    configSchema: [
      { key: 'paperWidth', labelEn: 'Default Paper Width', labelAr: 'عرض ورق الطباعة', type: 'select', defaultValue: '80mm', options: [{ value: '80mm', labelEn: '80mm (Standard)', labelAr: '80 مم قياسي' }, { value: '58mm', labelEn: '58mm (Compact)', labelAr: '58 مم مدمج' }] },
      { key: 'autoOpenCashDrawer', labelEn: 'Auto-Open Cash Drawer on Cash Sale', labelAr: 'فتح درج النقد تلقائياً عند البيع النقدي', type: 'boolean', defaultValue: true }
    ]
  },
  {
    appId: 'weight_scale_driver',
    nameEn: 'Digital Weight Scale RS232 / USB Driver',
    nameAr: 'تعريف الموازين الإلكترونية الذكية',
    taglineEn: 'Live weight reading directly into POS checkout for produce and bulk items.',
    taglineAr: 'قراءة الوزن اللحظية مباشرة لشاشات البيع والمستودعات والتصنيع.',
    descriptionEn: 'Connect CAS, Avery Berkel, Mettler Toledo, and Digi scales via WebSerial / RS232 / USB directly to POS and shop-floor kitting screens for instantaneous tare and net weight acquisition.',
    descriptionAr: 'تكامل مباشر مع الموازين الرقمية عبر منافذ USB و RS232 للتجزئة ومحطات وزن المواد الخام.',
    category: 'hardware_iot',
    appType: 'hardware_integration',
    icon: 'scale',
    version: '1.9.0',
    downloadSize: '2.4 MB',
    author: 'Maqder IoT Labs',
    rating: 4.88,
    reviewsCount: 94,
    pricingTier: 'free',
    badge: 'IoT Connected',
    defaultRoute: '/app/dashboard/bakala/weight-scale',
    requiresHardware: true,
    featuresEn: [
      'Live Serial/USB Stream Weight Polling',
      'Automatic Zero and Tare Compensation',
      'Weight-Embedded Barcode Parsing (EAN-13 / GS1)',
      'High Precision Industrial Scale Support'
    ],
    featuresAr: [
      'قراءة حية للوزن عبر المنافذ التسلسلية وUSB',
      'تصفير الميزان وخصم وزن العبوة تلقائياً',
      'قراءة وتوليد باركود الأوزان EAN-13 و GS1',
      'دعم الموازين الصناعية الدقيقة لخطوط الإنتاج'
    ],
    configSchema: [
      { key: 'baudRate', labelEn: 'Baud Rate', labelAr: 'معدل البود (Baud Rate)', type: 'select', defaultValue: '9600', options: [{ value: '9600', labelEn: '9600 bps', labelAr: '9600' }, { value: '4800', labelEn: '4800 bps', labelAr: '4800' }, { value: '19200', labelEn: '19200 bps', labelAr: '19200' }] },
      { key: 'unit', labelEn: 'Default Unit', labelAr: 'وحدة القياس الافتراضية', type: 'select', defaultValue: 'KG', options: [{ value: 'KG', labelEn: 'Kilograms (KG)', labelAr: 'كيلوجرام' }, { value: 'G', labelEn: 'Grams (G)', labelAr: 'جرام' }] }
    ]
  },
  {
    appId: 'whatsapp_cloud_auto',
    nameEn: 'WhatsApp Cloud Business Automation',
    nameAr: 'أتمتة رسائل واتساب السحابية الذكية',
    taglineEn: 'Auto-dispatch e-invoices, job card updates, order tracking, and marketing notifications.',
    taglineAr: 'إرسال الفواتير الإلكترونية، إشعارات أوامر الإنتاج، والتتبع التلقائي للعملاء.',
    descriptionEn: 'Official Meta WhatsApp Cloud API integration: send PDF invoice links, instant payment receipts, order preparation updates, and automated reminders with zero risk of phone number bans.',
    descriptionAr: 'ربط سحابي رسمي لإرسال روابط الفواتير وإشعارات الجاهزية للعملاء وحالة الإنتاج بضغطة واحدة.',
    category: 'automation_comm',
    appType: 'automation_comm',
    icon: 'whatsapp',
    version: '3.0.1',
    downloadSize: '6.8 MB',
    author: 'Maqder Connect',
    rating: 4.96,
    reviewsCount: 520,
    pricingTier: 'free',
    badge: 'Meta Verified',
    defaultRoute: '/app/dashboard/whatsapp',
    featuresEn: [
      'Official Meta WhatsApp Cloud API Webhooks',
      'Dynamic Template Variables & Auto-PDF Attachment',
      'Interactive Reply Buttons & List Messages',
      'Multi-Agent Customer Inbox with Delivery Status'
    ],
    featuresAr: [
      'ربط رسمي مع واجهة WhatsApp Cloud API',
      'قوالب رسائل ديناميكية مع إرفاق روابط PDF للفواتير',
      'أزرار تفاعلية وقوائم استجابة سريعة',
      'صندوق محادثات موحد مع مؤشرات وصول الرسائل'
    ],
    configSchema: [
      { key: 'autoSendInvoices', labelEn: 'Auto-send WhatsApp message on invoice completion', labelAr: 'إرسال رسالة واتساب تلقائياً عند إصدار الفاتورة', type: 'boolean', defaultValue: true },
      { key: 'autoNotifyOrderStatus', labelEn: 'Auto-notify on order ready or dispatch', labelAr: 'إشعار العميل عند جاهزية الطلب أو الإنتاج', type: 'boolean', defaultValue: true }
    ]
  },
  {
    appId: 'email_suite',
    nameEn: 'Email Suite & Automation',
    nameAr: 'منظومة البريد الإلكتروني والأتمتة',
    taglineEn: 'Unified IMAP/SMTP inbox, auto-fetch, HTML templates, and transaction notifications.',
    taglineAr: 'صندوق بريد متكامل، جلب تلقائي للرسائل، قوالب الفواتير، وإشعارات العمليات.',
    descriptionEn: 'Full-featured email communications engine: connect enterprise IMAP/SMTP inboxes, auto-sync incoming emails, design custom brand templates, and dispatch quotation and invoice PDF notifications automatically.',
    descriptionAr: 'منظومة مراسلات بريدية متقدمة: ربط خوادم IMAP/SMTP، مزامنة تلقائية للبريد الوارد، وتصميم قوالب إرسال الفواتير والعروض للعملاء.',
    category: 'automation_comm',
    appType: 'automation_comm',
    icon: 'mail',
    version: '2.8.0',
    downloadSize: '5.2 MB',
    author: 'Maqder Connect',
    rating: 4.92,
    reviewsCount: 310,
    pricingTier: 'free',
    badge: 'Popular',
    defaultRoute: '/app/dashboard/email',
    featuresEn: [
      'IMAP/SMTP Mailbox Integration & Auto-Sync',
      'Direct Email Dispatch for Invoices & Quotes',
      'Rich HTML Email Templates & Signature Builder',
      'Delivery Tracking & Unread Notifications'
    ],
    featuresAr: [
      'ربط صناديق البريد IMAP/SMTP ومزامنة الرسائل الواردة',
      'إرسال الفواتير وعروض الأسعار مباشرة للعملاء عبر البريد',
      'قوالب بريد HTML متجاوبة وتوقيع رقمي مخصص',
      'تتبع التسليم وإشعارات الرسائل غير المقروءة'
    ],
    configSchema: [
      { key: 'autoEmailInvoices', labelEn: 'Auto-email PDF copy on invoice issuance', labelAr: 'إرسال نسخة الفاتورة PDF تلقائياً عند الإصدار', type: 'boolean', defaultValue: true },
      { key: 'syncIntervalMinutes', labelEn: 'Inbox Sync Interval (Minutes)', labelAr: 'معدل مزامنة البريد الوارد (دقائق)', type: 'number', defaultValue: 15 }
    ]
  },
  {
    appId: 'ai_copilot_insights',
    nameEn: 'Maqder AI Financial & Operations Copilot',
    nameAr: 'مساعد الذكاء الاصطناعي للأعمال والعمليات',
    taglineEn: 'AI forecasting, predictive stock replenishment, smart cost optimization, and conversational analytics.',
    taglineAr: 'التنبؤ الذكي بالمبيعات، إعادة التزويد الآلي للمخزون، وتحليل هوامش الربح بدقة.',
    descriptionEn: 'Harness Google Gemini & custom LLMs to analyze business metrics, detect cash flow anomalies, suggest ideal reorder quantities, and optimize production scheduling automatically.',
    descriptionAr: 'محرك ذكاء اصطناعي مدعوم بنماذج متقدمة لتحليل التدفقات النقدية، اكتشاف الفروقات، والتنبؤ باحتياجات المواد.',
    category: 'ai_intelligence',
    appType: 'ai_tool',
    icon: 'sparkles',
    version: '2.5.0',
    downloadSize: '11.5 MB',
    author: 'Maqder AI Labs',
    rating: 4.95,
    reviewsCount: 410,
    pricingTier: 'free',
    badge: 'Next-Gen AI',
    defaultRoute: '/app/dashboard',
    featuresEn: [
      'Predictive Reorder & MRP Lead Time Forecasting',
      'Automated Financial Anomaly & Leakage Detection',
      'Natural Language BI Queries ("Show top 5 profitable items")',
      'Automated Executive Summary & PDF Briefings'
    ],
    featuresAr: [
      'تنبؤ ذكي بمواعيد إعادة الطلب واحتياجات الإنتاج',
      'اكتشاف الفروقات المالية وتسريبات التكاليف',
      'استعلامات تحليلية باللغة الطبيعية',
      'توليد تقارير تنفيذية دورية شاملة'
    ],
    configSchema: [
      { key: 'dailyExecutiveBriefing', labelEn: 'Receive Daily AI Executive Summary on WhatsApp/Email', labelAr: 'استلام ملخص تنفيذي يومي عبر الواتساب أو البريد', type: 'boolean', defaultValue: true },
      { key: 'anomalyAlerts', labelEn: 'Instant Alert on Unusual Margin Drops or Stock Spikes', labelAr: 'تنبيه فوري عند انخفاض هوامش الربح غير المعتاد', type: 'boolean', defaultValue: true }
    ]
  },
  {
    appId: 'gosi_mudad_compliance',
    nameEn: 'GOSI & Mudad Wage Protection Sync',
    nameAr: 'الربط المباشر مع التأمينات الاجتماعية ونظام مدد',
    taglineEn: 'Automated WPS payroll compliance, Saudization (Nitaqat) tracking, and GOSI certificate validation.',
    taglineAr: 'حماية الأجور، نسب التوطين (نطاقات)، وإصدار مسيرات الرواتب المتوافقة مع البنك المركزي.',
    descriptionEn: 'Connect your HR and Payroll with Saudi Ministry of Human Resources WPS specifications, automatic Mudad file generation, and live GOSI contribution tracking.',
    descriptionAr: 'توافق كامل مع متطلبات نظام حماية الأجور، وتوليد ملفات الرواتب المعتمدة للبنوك ووزارة الموارد البشرية.',
    category: 'saudi_compliance',
    appType: 'saudi_compliance',
    icon: 'briefcase',
    version: '2.0.0',
    downloadSize: '4.1 MB',
    author: 'Maqder Saudi Gov Suite',
    rating: 4.91,
    reviewsCount: 175,
    pricingTier: 'free',
    badge: 'HRSD Verified',
    defaultRoute: '/app/dashboard/payroll',
    featuresEn: [
      'WPS Salary File Auto-Generation (.SIF / SAMA format)',
      'Real-time Nitaqat Saudization Calculator',
      'End of Service (EOSB) Saudi Labor Law Calculation',
      'GOSI Subscription Deductions Breakdown'
    ],
    featuresAr: [
      'توليد ملفات حماية الأجور المعتمدة للبنوك تلقائياً',
      'حاسبة نطاقات ونسب التوطين المباشرة',
      'حساب مكافأة نهاية الخدمة وفق نظام العمل السعودي',
      'احتساب استقطاعات واشتراكات التأمينات الاجتماعية بدقة'
    ],
    configSchema: [
      { key: 'autoValidateWPS', labelEn: 'Validate Bank IBANs & IDs prior to salary release', labelAr: 'التحقق من صحة الآيبان والهويات قبل اعتماد المسير', type: 'boolean', defaultValue: true }
    ]
  },
  {
    appId: 'multicourier_shipping',
    nameEn: 'Multi-Courier Saudi Shipping Gateway',
    nameAr: 'بوابة الشحن والربط مع شركات النقل والتوصيل',
    taglineEn: 'One-click AWB shipping label generation with SMSA, Aramex, Torod, and SPL.',
    taglineAr: 'توليد بوالص الشحن التلقائية مع سمسا، أرامكس، سبل، وطرود بضغطة زر.',
    descriptionEn: 'Integrated logistics engine connecting e-commerce, wholesale deliveries, and manufacturing fulfillment to leading Saudi couriers with live tracking webhook updates.',
    descriptionAr: 'ربط مباشر لطباعة بوالص الشحن وتتبع الشحنات مع كبرى شركات النقل في المملكة.',
    category: 'ecommerce_payments',
    appType: 'automation_comm',
    icon: 'truck',
    version: '2.3.1',
    downloadSize: '7.8 MB',
    author: 'Maqder Logistics',
    rating: 4.87,
    reviewsCount: 160,
    pricingTier: 'free',
    badge: 'Logistics Ready',
    defaultRoute: '/app/dashboard/shipments',
    featuresEn: [
      'Instant AWB Shipping Label PDF Printing',
      'Live Tracking Updates & SMS Delivery Notifications',
      'Reverse Logistics & Customer Return Management',
      'Cash on Delivery (COD) Reconciliation Ledger'
    ],
    featuresAr: [
      'طباعة فورية لبوالص الشحن الإلكترونية PDF',
      'تتبع مباشر للشحنات مع إشعارات الرسائل القصيرة',
      'إدارة بوالص المرتجعات واستلام البضائع',
      'مطابقة وتسوية مبالغ الدفع عند الاستلام (COD)'
    ],
    configSchema: [
      { key: 'defaultCourier', labelEn: 'Default Primary Courier', labelAr: 'شركة الشحن الافتراضية', type: 'select', defaultValue: 'smsa', options: [{ value: 'smsa', labelEn: 'SMSA Express', labelAr: 'سمسا إكسبريس' }, { value: 'aramex', labelEn: 'Aramex', labelAr: 'أرامكس' }, { value: 'spl', labelEn: 'Saudi Post (SPL)', labelAr: 'البريد السعودي (سبل)' }] }
    ]
  },
  // ── Government Integration Apps ────────────────────────────────────────────────
  {
    appId: 'elm_identity_pro',
    nameEn: 'Elm Identity & Verification Suite',
    nameAr: 'منظومة علم للهوية والتحقق',
    taglineEn: 'Yakeen ID verification, Tamm vehicle registration, Najm accident lookup, Wathiq CR verify, Nafath OTP.',
    taglineAr: 'تحقق الهوية (يقين)، تسجيل المركبات (تامم)، سجل الحوادث (نجم)، السجل التجاري (وثيق)، نفاذ OTP.',
    descriptionEn: 'Connect to Saudi Elm DevPortal services: verify national IDs and Iqamas with Yakeen, register rental fleet with Tamm, check accident histories with Najm, verify Commercial Registrations with Wathiq, and authenticate customers via Nafath OTP.',
    descriptionAr: 'ربط شامل مع بوابة علم للمطورين: التحقق من الهوية الوطنية والإقامة، تسجيل المركبات، الاستعلام عن تاريخ الحوادث، التحقق من السجل التجاري، والمصادقة عبر نفاذ.',
    category: 'saudi_compliance',
    appType: 'saudi_compliance',
    icon: 'shield-check',
    version: '2.1.0',
    downloadSize: '3.2 MB',
    author: 'Maqder Saudi Gov Suite',
    rating: 4.88,
    reviewsCount: 134,
    pricingTier: 'free',
    badge: 'Elm Certified',
    defaultRoute: '/app/dashboard/tenant-settings/government-integrations/elm',
    featuresEn: [
      'Yakeen: Saudi & Resident National ID / Iqama Verification',
      'Tamm: Fleet Vehicle Registration & Ownership Lookup',
      'Najm: Accident History & Insurance Status Check',
      'Wathiq: Commercial Registration (CR) Verification',
      'Nafath OTP: Mobile Identity Authentication'
    ],
    featuresAr: [
      'يقين: التحقق من الهوية الوطنية وتصريح الإقامة',
      'تامم: تسجيل المركبات والاستعلام عن ملكيتها',
      'نجم: سجل الحوادث وحالة التأمين',
      'وثيق: التحقق من السجل التجاري',
      'نفاذ OTP: المصادقة عبر التطبيق الوطني'
    ],
    configSchema: [
      { key: 'clientId', labelEn: 'Elm Client ID', labelAr: 'معرف عميل علم', type: 'text', defaultValue: '' },
      { key: 'clientSecret', labelEn: 'Elm Client Secret', labelAr: 'مفتاح عميل علم', type: 'password', defaultValue: '' },
      { key: 'nafathOtpEnabled', labelEn: 'Enable Nafath OTP Authentication', labelAr: 'تفعيل المصادقة عبر نفاذ', type: 'boolean', defaultValue: false },
      { key: 'tammEnabled', labelEn: 'Enable Tamm Vehicle Integration', labelAr: 'تفعيل تكامل تامم للمركبات', type: 'boolean', defaultValue: false }
    ]
  },
  {
    appId: 'qiwa_hr_integration',
    nameEn: 'Qiwa HR Portal Integration',
    nameAr: 'ربط بوابة قوى للموارد البشرية',
    taglineEn: 'Contract authentication, Nitaqat Saudization tracking, and MHRSD compliance automation.',
    taglineAr: 'توثيق العقود، متابعة نطاقات التوطين، والامتثال لوزارة الموارد البشرية.',
    descriptionEn: 'Connect your HR module directly to the Ministry of Human Resources Qiwa platform: authenticate employee contracts digitally, monitor real-time Saudization ratios, and automate compliance reporting.',
    descriptionAr: 'ربط مباشر مع منصة قوى لوزارة الموارد البشرية: توثيق عقود الموظفين إلكترونياً، ومراقبة نسب التوطين، وأتمتة تقارير الامتثال.',
    category: 'saudi_compliance',
    appType: 'saudi_compliance',
    icon: 'users-round',
    version: '1.8.0',
    downloadSize: '2.8 MB',
    author: 'Maqder Saudi Gov Suite',
    rating: 4.85,
    reviewsCount: 112,
    pricingTier: 'free',
    badge: 'MHRSD Linked',
    defaultRoute: '/app/dashboard/tenant-settings/government-integrations/qiwa',
    featuresEn: [
      'Digital Employee Contract Authentication via Qiwa',
      'Real-time Nitaqat Saudization Calculator',
      'Establishment ID Management & OAuth Integration',
      'Automated Labor Law Compliance Monitoring'
    ],
    featuresAr: [
      'توثيق عقود الموظفين إلكترونياً عبر قوى',
      'حاسبة نطاقات التوطين الفورية',
      'إدارة معرّف المنشأة وتكامل OAuth',
      'مراقبة تلقائية لامتثال نظام العمل'
    ],
    configSchema: [
      { key: 'establishmentId', labelEn: 'Qiwa Establishment ID', labelAr: 'رقم منشأة قوى', type: 'text', defaultValue: '' },
      { key: 'accessToken', labelEn: 'Qiwa Access Token', labelAr: 'رمز وصول قوى', type: 'password', defaultValue: '' },
      { key: 'contractAuthAutomationEnabled', labelEn: 'Auto-submit Contracts for Authentication', labelAr: 'إرسال العقود تلقائياً للتوثيق', type: 'boolean', defaultValue: false },
      { key: 'saudizationWidgetEnabled', labelEn: 'Show Saudization Widget on Dashboard', labelAr: 'عرض مؤشر نطاقات في لوحة التحكم', type: 'boolean', defaultValue: true }
    ]
  },
  {
    appId: 'balady_municipal',
    nameEn: 'Balady Municipal Licensing',
    nameAr: 'بلدي - الترخيص والصحة البلدية',
    taglineEn: 'Municipal health certificates and business licensing compliance for food, bakery, and retail.',
    taglineAr: 'شهادات الصحة البلدية وتراخيص الأعمال للمطاعم والمخابز والبقالات.',
    descriptionEn: 'Manage your municipal health certificates, food safety compliance, and business licensing requirements via the Balady platform — track expiry dates, store certificates, and receive renewal alerts.',
    descriptionAr: 'إدارة شهادات الصحة البلدية، ومتطلبات السلامة الغذائية والتراخيص التجارية عبر منصة بلدي، مع تتبع تواريخ الانتهاء وتنبيهات التجديد.',
    category: 'saudi_compliance',
    appType: 'saudi_compliance',
    icon: 'building',
    version: '1.4.0',
    downloadSize: '1.9 MB',
    author: 'Maqder Saudi Gov Suite',
    rating: 4.79,
    reviewsCount: 87,
    pricingTier: 'free',
    badge: 'Balady Ready',
    defaultRoute: '/app/dashboard/tenant-settings/government-integrations/balady',
    featuresEn: [
      'Municipal Health Certificate Storage & Tracking',
      'Business License Expiry Alerts',
      'Food Safety Compliance Checklist',
      'Worker Health Certificate Management'
    ],
    featuresAr: [
      'حفظ وتتبع شهادات الصحة البلدية',
      'تنبيهات انتهاء صلاحية التراخيص التجارية',
      'قوائم فحص امتثال سلامة الأغذية',
      'إدارة شهادات صحة العمال'
    ],
    configSchema: [
      { key: 'baladyApiKey', labelEn: 'Balady API Key', labelAr: 'مفتاح API بلدي', type: 'password', defaultValue: '' },
      { key: 'expiryAlertDays', labelEn: 'Alert Days Before Expiry', labelAr: 'أيام التنبيه قبل الانتهاء', type: 'number', defaultValue: 30 }
    ]
  },
  {
    appId: 'saber_conformity',
    nameEn: 'Saber Product Conformity',
    nameAr: 'سابر - شهادات المطابقة (SASO)',
    taglineEn: 'SASO product conformity certificate management and shipment release tracking.',
    taglineAr: 'إدارة شهادات مطابقة SASO وتتبع الإفراج عن الشحنات.',
    descriptionEn: 'Manage your Saudi product conformity requirements through Saber: store and track SASO conformity certificates for regulated products, monitor certificate expiry, and link certificates to inventory items and purchase orders.',
    descriptionAr: 'إدارة شهادات المطابقة السعودية عبر منصة سابر: تخزين شهادات SASO للمنتجات الخاضعة للتنظيم، وربطها بالمخزون وأوامر الشراء.',
    category: 'saudi_compliance',
    appType: 'saudi_compliance',
    icon: 'badge-check',
    version: '1.2.0',
    downloadSize: '1.6 MB',
    author: 'Maqder Saudi Gov Suite',
    rating: 4.75,
    reviewsCount: 64,
    pricingTier: 'free',
    badge: 'SASO Verified',
    defaultRoute: '/app/dashboard/tenant-settings/government-integrations/saber',
    featuresEn: [
      'SASO Conformity Certificate Storage & Linking',
      'Certificate Expiry Tracking & Renewal Alerts',
      'Link Certificates to Products & Purchase Orders',
      'Shipment Release Document Management'
    ],
    featuresAr: [
      'حفظ شهادات المطابقة وربطها بالمنتجات',
      'تتبع انتهاء الشهادات وتنبيهات التجديد',
      'ربط الشهادات بأوامر الشراء',
      'إدارة وثائق الإفراج عن الشحنات'
    ],
    configSchema: [
      { key: 'saberToken', labelEn: 'Saber API Token', labelAr: 'رمز API سابر', type: 'password', defaultValue: '' }
    ]
  },
  {
    appId: 'etimad_procurement',
    nameEn: 'Etimad Government Procurement',
    nameAr: 'اعتماد - المشتريات الحكومية',
    taglineEn: 'Manage Saudi government procurement portal bids, contracts, and vendor credentials.',
    taglineAr: 'إدارة عطاءات ومشتريات البوابة الحكومية السعودية اعتماد.',
    descriptionEn: 'Connect your business to the Saudi Etimad government procurement portal: manage vendor credentials, track active tenders and bid submissions, store contract documents, and monitor payment status from government entities.',
    descriptionAr: 'ربط منشأتك ببوابة اعتماد للمشتريات الحكومية السعودية: إدارة بيانات المورد، تتبع المناقصات وتقديم العروض، وتخزين وثائق العقود.',
    category: 'saudi_compliance',
    appType: 'saudi_compliance',
    icon: 'landmark',
    version: '1.1.0',
    downloadSize: '2.1 MB',
    author: 'Maqder Saudi Gov Suite',
    rating: 4.71,
    reviewsCount: 48,
    pricingTier: 'free',
    badge: 'Gov Procurement',
    defaultRoute: '/app/dashboard/tenant-settings/government-integrations/etimad',
    featuresEn: [
      'Etimad Vendor Portal Credential Management',
      'Government Tender Tracking & Bid Submissions',
      'Contract Document Storage & Version Control',
      'Government Payment Status Monitoring'
    ],
    featuresAr: [
      'إدارة بيانات اعتماد المورد في البوابة الحكومية',
      'تتبع المناقصات الحكومية وتقديم العروض',
      'حفظ وثائق العقود وإدارة الإصدارات',
      'مراقبة حالة المدفوعات الحكومية'
    ],
    configSchema: [
      { key: 'etimadUsername', labelEn: 'Etimad Portal Username', labelAr: 'اسم مستخدم بوابة اعتماد', type: 'text', defaultValue: '' },
      { key: 'etimadPassword', labelEn: 'Etimad Portal Password', labelAr: 'كلمة مرور بوابة اعتماد', type: 'password', defaultValue: '' }
    ]
  },
  // ══════════════════════════════════════════════════════════════════════════════
  // ── BANGLADESH NBR / MUSHAK COMPLIANCE ───────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════════
  {
    appId: 'bangladesh_nbr_einvoicing',
    nameEn: 'NBR Mushak E-Invoicing (Bangladesh)',
    nameAr: 'الفوترة الإلكترونية NBR / Mushak (بنغلاديش)',
    taglineEn: 'BIN, Mushak 6.3 VAT invoices, and NBR-ready QR on receipts — Bangladesh tax suite.',
    taglineAr: 'رقم BIN وفواتير Mushak 6.3 ورمز QR جاهز لهيئة الإيرادات الوطنية البنغلاديشية.',
    descriptionEn: 'Complete Bangladesh National Board of Revenue (NBR) compliance pack for BDT businesses: Business Identification Number (BIN) management, Mushak 6.3 VAT tax invoice formatting on POS receipts and PDFs, standard 15% VAT defaults, sandbox/production API credentials for e-invoicing gateways, and verification QR codes on every receipt. Mirrors the ZATCA hub for Saudi tenants — install only when your default currency is BDT.',
    descriptionAr: 'حزمة امتثال هيئة الإيرادات الوطنية البنغلاديشية (NBR) للمنشآت بعملة التاكا: إدارة رقم BIN، تنسيق فواتير ضريبة Mushak 6.3، معدل ضريبة 15%، وبيانات API للربط، ورموز تحقق QR على الإيصالات.',
    category: 'bangladesh_compliance',
    appType: 'bangladesh_compliance',
    requiredCurrency: 'BDT',
    icon: 'shield',
    version: '1.0.0',
    downloadSize: '4.8 MB',
    author: 'Maqder Bangladesh Gov Suite',
    rating: 4.9,
    reviewsCount: 42,
    pricingTier: 'free',
    badge: 'NBR Ready',
    defaultRoute: '/app/dashboard/tenant-settings/nbr-dashboard',
    featuresEn: [
      'Business Identification Number (BIN) & VAT registration',
      'Mushak 6.3 tax invoice titles on POS thermal receipts',
      'NBR verification QR on sales receipts',
      'Sandbox / production API credential vault',
      'Default 15% Bangladesh VAT rate helpers'
    ],
    featuresAr: [
      'إدارة رقم BIN وتسجيل ضريبة القيمة المضافة',
      'عناوين فاتورة Mushak 6.3 على إيصالات نقاط البيع',
      'رمز QR للتحقق من NBR على إيصالات البيع',
      'خزنة بيانات API لبيئتي التجربة والإنتاج',
      'مساعدات معدل ضريبة بنغلاديش 15%'
    ],
    configSchema: [
      { key: 'environment', labelEn: 'NBR Environment', labelAr: 'بيئة NBR', type: 'select', defaultValue: 'sandbox', options: [{ value: 'sandbox', labelEn: 'Sandbox (Testing)', labelAr: 'بيئة التجربة' }, { value: 'production', labelEn: 'Live Production', labelAr: 'البيئة الإنتاجية' }] },
      { key: 'mushakForm', labelEn: 'Default Mushak Form', labelAr: 'نموذج Mushak الافتراضي', type: 'select', defaultValue: '6.3', options: [{ value: '6.3', labelEn: 'Mushak 6.3 (Tax Invoice)', labelAr: 'Mushak 6.3 (فاتورة ضريبية)' }, { value: '6.4', labelEn: 'Mushak 6.4 (Credit Note)', labelAr: 'Mushak 6.4 (إشعار دائن)' }] },
      { key: 'autoGenerateQr', labelEn: 'Auto-generate NBR QR on receipts', labelAr: 'توليد رمز QR تلقائياً على الإيصالات', type: 'boolean', defaultValue: true }
    ]
  },
  // ══════════════════════════════════════════════════════════════════════════════
  // ── DOCUMENT DESIGN ADD-ONS ────────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════════
  {
    appId: PREMIUM_INVOICE_TEMPLATES_APP_ID,
    nameEn: 'Premium Invoice & Quotation Templates',
    nameAr: 'قوالب الفواتير وعروض الأسعار المميزة',
    taglineEn: 'Unlock 7 additional professionally designed PDF templates',
    taglineAr: 'افتح 7 قوالب PDF احترافية إضافية للفواتير وعروض الأسعار',
    descriptionEn: 'Give your invoices and quotations a distinctive, professional identity. This add-on unlocks the full design library — Modern, Mono, Air, Ledger, Signature, Classic Elegant and Modern Split — on top of the free Essential template. Switch templates anytime from Settings without losing your logo, stamp, signature or bilingual Arabic layout.',
    descriptionAr: 'امنح فواتيرك وعروض أسعارك هوية احترافية مميزة. تفتح هذه الإضافة مكتبة التصميم الكاملة (حديث، أحادي، هواء، سجل، توقيع، كلاسيكي أنيق، وحديث منقسم) بالإضافة إلى القالب الأساسي المجاني. بدّل بين القوالب في أي وقت من الإعدادات دون فقدان شعارك أو ختمك أو توقيعك أو التصميم العربي ثنائي اللغة.',
    category: 'finance_accounting',
    appType: 'premium_addon',
    icon: 'file-text',
    version: '1.0.0',
    downloadSize: '3.2 MB',
    author: 'Maqder Core',
    rating: 4.95,
    reviewsCount: 156,
    pricingTier: 'free',
    badge: 'Design Pack',
    defaultRoute: '/app/dashboard/settings',
    featuresEn: [
      '7 additional professional PDF templates: Modern, Mono, Air, Ledger, Signature, Classic Elegant & Modern Split',
      'Full bilingual Arabic/English layout support on every template',
      'Switch templates instantly from Settings — applies to invoices, quotations & PDF exports',
      'Keeps your logo, stamp, signature and brand colors intact'
    ],
    featuresAr: [
      '7 قوالب PDF احترافية إضافية: حديث، أحادي، هواء، سجل، توقيع، كلاسيكي أنيق، وحديث منقسم',
      'دعم كامل للتصميم ثنائي اللغة عربي/إنجليزي على كل قالب',
      'بدّل القوالب فورًا من الإعدادات - تنطبق على الفواتير وعروض الأسعار وملفات PDF',
      'يحافظ على شعارك وختمك وتوقيعك وألوان علامتك التجارية'
    ],
    configSchema: []
  }
];

// Helper: Ensure default apps catalog is in DB on demand
export const ensureCatalogInitialized = async () => {
  try {
    for (const app of DEFAULT_APP_CATALOG) {
      await AppAddon.findOneAndUpdate(
        { appId: app.appId },
        { 
          $set: {
            nameEn: app.nameEn,
            nameAr: app.nameAr,
            taglineEn: app.taglineEn,
            taglineAr: app.taglineAr,
            descriptionEn: app.descriptionEn,
            descriptionAr: app.descriptionAr,
            category: app.category,
            appType: app.appType,
            icon: app.icon,
            version: app.version,
            author: app.author,
            rating: app.rating,
            reviewsCount: app.reviewsCount,
            badge: app.badge,
            downloadSize: app.downloadSize,
            defaultRoute: app.defaultRoute,
            businessTypeGrant: app.businessTypeGrant,
            requiresHardware: app.requiresHardware,
            featuresEn: app.featuresEn,
            featuresAr: app.featuresAr,
            configSchema: app.configSchema,
            requiredCurrency: app.requiredCurrency || '',
          },
          $setOnInsert: {
            pricingTier: app.pricingTier || 'free',
            monthlyPrice: app.monthlyPrice || 0,
            yearlyPrice: app.yearlyPrice || 0,
            isActive: true
          }
        },
        { upsert: true, new: true }
      );
    }
  } catch (err) {
    console.error('Failed to initialize app catalog:', err.message);
  }
};

// ─── 1. Get All Apps & Add-ons with Tenant Installation Status ───
router.get('/apps', protect, async (req, res) => {
  try {
    const tenant = await getTenantForUser(req);
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    // Sync / refresh catalog definitions
    await ensureCatalogInitialized();

    // Only return apps that are not hidden by Super Admin (isActive !== false)
    const apps = await AppAddon.find({ isActive: { $ne: false } }).lean();
    const finalApps = (apps && apps.length > 0) ? apps : DEFAULT_APP_CATALOG;

    const defaultCatalogMap = new Map(DEFAULT_APP_CATALOG.map(a => [a.appId, a]));
    const tenantInstalled = tenant.settings?.installedApps || {};
    const tenantCurrency = String(tenant.settings?.currency || 'SAR').trim().toUpperCase();

    const isAppVisibleForCurrency = (app) => {
      const required = String(app.requiredCurrency || defaultCatalogMap.get(app.appId)?.requiredCurrency || '').trim().toUpperCase();
      if (required) return tenantCurrency === required;
      if (app.category === 'saudi_compliance' || app.appType === 'saudi_compliance') {
        return tenantCurrency === 'SAR';
      }
      if (app.category === 'bangladesh_compliance' || app.appType === 'bangladesh_compliance') {
        return tenantCurrency === 'BDT';
      }
      return true;
    };

    const appsWithStatus = finalApps.filter(isAppVisibleForCurrency).map((app) => {
      const defApp = defaultCatalogMap.get(app.appId);
      const isExplicitlyInstalled = !!tenantInstalled[app.appId]?.isInstalled;
      // Grandfather tenants who already had premium invoice templates
      // configured before this app-store gating existed, so nothing breaks
      // retroactively for existing customers.
      const isGrandfatheredPremiumTemplates = app.appId === PREMIUM_INVOICE_TEMPLATES_APP_ID && !isExplicitlyInstalled && hasPremiumTemplateAccess(tenant);
      const isInstalled = isExplicitlyInstalled || isGrandfatheredPremiumTemplates;
      const isEnabled = tenantInstalled[app.appId]?.isEnabled !== false;
      const config = tenantInstalled[app.appId]?.config || {};

      return {
        ...app,
        downloadSize: app.downloadSize || defApp?.downloadSize || '4.5 MB',
        monthlyPrice: Number(app.monthlyPrice ?? defApp?.monthlyPrice ?? 0) || 0,
        yearlyPrice: Number(app.yearlyPrice ?? defApp?.yearlyPrice ?? 0) || 0,
        pricingTier: app.pricingTier || defApp?.pricingTier || 'free',
        isInstalled,
        isEnabled,
        installedAt: tenantInstalled[app.appId]?.installedAt || (isInstalled ? tenant.createdAt : null),
        config,
        requiresPayment: isPaidApp({ ...app, monthlyPrice: app.monthlyPrice ?? defApp?.monthlyPrice, yearlyPrice: app.yearlyPrice ?? defApp?.yearlyPrice, pricingTier: app.pricingTier || defApp?.pricingTier }),
        billing: tenantInstalled[app.appId]?.billing || null,
      };
    });

    const stripe = await getStripeConfig().catch(() => ({ enabled: false }));

    res.json({
      success: true,
      apps: appsWithStatus,
      totalCount: appsWithStatus.length,
      installedCount: appsWithStatus.filter(a => a.isInstalled).length,
      payments: {
        stripeEnabled: stripe.enabled === true && !!stripe.secretKey,
        currency: tenantCurrency,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── 2. Install App / Add-on ───
router.post('/apps/:appId/install', protect, async (req, res) => {
  try {
    const { appId } = req.params;
    const { customConfig, billingCycle = 'monthly', skipPayment } = req.body || {};

    const appDef = (await AppAddon.findOne({ appId }).lean()) || DEFAULT_APP_CATALOG.find(a => a.appId === appId);
    if (!appDef) return res.status(404).json({ error: 'App not found in catalog' });

    const tenant = await getTenantForUser(req);
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    const tenantCurrency = String(tenant.settings?.currency || 'SAR').trim().toUpperCase();
    const required = String(appDef.requiredCurrency || '').trim().toUpperCase();
    if (required && tenantCurrency !== required) {
      return res.status(400).json({
        error: `This app requires default currency ${required}. Current tenant currency is ${tenantCurrency}.`,
      });
    }
    if ((appDef.category === 'saudi_compliance' || appDef.appType === 'saudi_compliance') && tenantCurrency !== 'SAR') {
      return res.status(400).json({ error: 'Saudi government apps require SAR as the tenant default currency.' });
    }
    if ((appDef.category === 'bangladesh_compliance' || appDef.appType === 'bangladesh_compliance') && tenantCurrency !== 'BDT') {
      return res.status(400).json({ error: 'Bangladesh NBR apps require BDT as the tenant default currency.' });
    }

    // Paid apps must go through Stripe unless Super Admin forced skip (not exposed to clients).
    if (isPaidApp(appDef, billingCycle) && skipPayment !== true) {
      return res.status(402).json({
        error: 'Payment required',
        requiresPayment: true,
        appId,
        pricingTier: appDef.pricingTier,
        monthlyPrice: Number(appDef.monthlyPrice || 0),
        yearlyPrice: Number(appDef.yearlyPrice || 0),
        currency: tenantCurrency,
        checkoutPath: `/app-store/apps/${appId}/checkout`,
      });
    }

    await applyAppInstall({ tenant, appDef, appId, customConfig });

    res.json({
      success: true,
      message: `App ${appDef.nameEn} installed successfully`,
      appId,
      installedApps: tenant.settings.installedApps,
      businessTypes: tenant.businessTypes,
      tenant: serializeAuthTenant(tenant)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── 2b. Stripe checkout for paid App Store apps ───
router.post('/apps/:appId/checkout', protect, async (req, res) => {
  try {
    const { appId } = req.params;
    const billingCycle = req.body?.billingCycle === 'yearly' ? 'yearly' : 'monthly';

    const appDef = (await AppAddon.findOne({ appId }).lean()) || DEFAULT_APP_CATALOG.find(a => a.appId === appId);
    if (!appDef) return res.status(404).json({ error: 'App not found in catalog' });

    const tenant = await getTenantForUser(req);
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    if (tenant.settings?.installedApps?.[appId]?.isInstalled) {
      return res.status(400).json({ error: 'App is already installed' });
    }

    const amount = getAppPrice(appDef, billingCycle);
    if (!isPaidApp(appDef, billingCycle) || amount <= 0) {
      return res.status(400).json({ error: 'This app does not require payment. Use install instead.' });
    }

    const stripe = await getStripeConfig();
    if (!stripe.enabled || !stripe.secretKey) {
      return res.status(400).json({ error: 'Stripe is not configured. Ask your platform admin to enable Stripe in Payment Settings.' });
    }

    const currency = String(tenant.settings?.currency || 'SAR').trim().toUpperCase() || 'SAR';
    const frontendUrl = (process.env.FRONTEND_URL || `${req.protocol}://${req.get('host')}`).split(',')[0].trim().replace(/\/$/, '');
    const successUrl = `${frontendUrl}/app/dashboard/app-store?paid=1&appId=${encodeURIComponent(appId)}&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${frontendUrl}/app/dashboard/app-store?canceled=1&appId=${encodeURIComponent(appId)}`;

    const session = await createStripeCheckoutSession({
      amountMajor: amount,
      currency,
      productName: appDef.nameEn || appId,
      productDescription: `${billingCycle} — Maqder App Store`,
      customerEmail: req.user?.email || tenant.business?.contactEmail || '',
      successUrl,
      cancelUrl,
      clientReferenceId: `${tenant._id}:${appId}`,
      metadata: {
        type: 'app_store',
        tenantId: String(tenant._id),
        appId,
        billingCycle,
        amountMajor: String(amount),
        currency,
      },
    });

    res.json({
      success: true,
      requiresPayment: true,
      provider: 'stripe',
      sessionId: session.id,
      url: session.url,
      amount,
      currency,
      billingCycle,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ─── 2c. Confirm Stripe payment from App Store success redirect ───
router.post('/apps/:appId/confirm-payment', protect, async (req, res) => {
  try {
    const { appId } = req.params;
    const sessionId = req.body?.sessionId || req.query?.session_id;
    if (!sessionId) return res.status(400).json({ error: 'sessionId is required' });

    const tenant = await getTenantForUser(req);
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    const session = await retrieveStripeCheckoutSession(sessionId);
    if (session.payment_status !== 'paid' && session.status !== 'complete') {
      return res.status(400).json({ error: 'Payment is not completed yet', status: session.payment_status });
    }

    const meta = session.metadata || {};
    if (meta.type === 'app_store' && meta.appId && meta.appId !== appId) {
      return res.status(400).json({ error: 'Session app mismatch' });
    }
    if (meta.tenantId && String(meta.tenantId) !== String(tenant._id)) {
      return res.status(403).json({ error: 'Session tenant mismatch' });
    }

    const result = await fulfillAppStorePurchase({
      tenantId: tenant._id,
      appId: meta.appId || appId,
      billingCycle: meta.billingCycle || 'monthly',
      amountMajor: Number(meta.amountMajor || (session.amount_total || 0) / 100),
      currency: (meta.currency || session.currency || 'SAR').toUpperCase(),
      paymentId: session.id,
      provider: 'stripe',
    });

    const refreshed = await Tenant.findById(tenant._id);
    res.json({
      success: true,
      alreadyInstalled: result.alreadyInstalled,
      appId,
      tenant: serializeAuthTenant(refreshed),
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ─── 3. Uninstall App / Add-on ───
router.post('/apps/:appId/uninstall', protect, async (req, res) => {
  try {
    const { appId } = req.params;

    const tenant = await getTenantForUser(req);
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    const installedApps = { ...(tenant.settings?.installedApps || {}) };
    if (installedApps[appId]) {
      installedApps[appId].isInstalled = false;
      installedApps[appId].isEnabled = false;
      installedApps[appId].uninstalledAt = new Date();
    }

    // Revoke premium PDF templates on uninstall so tenants actually lose
    // access instead of staying grandfathered in via their prior default.
    if (appId === PREMIUM_INVOICE_TEMPLATES_APP_ID) {
      if (!tenant.settings) tenant.settings = {};
      if (Number(tenant.settings.invoicePdfTemplate) > ESSENTIAL_TEMPLATE_ID) {
        tenant.settings.invoicePdfTemplate = ESSENTIAL_TEMPLATE_ID;
      }
      const contextProfiles = tenant.settings?.invoiceBranding?.contextProfiles;
      if (contextProfiles && typeof contextProfiles === 'object') {
        for (const key of Object.keys(contextProfiles)) {
          if (Number(contextProfiles[key]?.templateId) > ESSENTIAL_TEMPLATE_ID) {
            contextProfiles[key].templateId = ESSENTIAL_TEMPLATE_ID;
          }
        }
      }
    }

    const appDef = (await AppAddon.findOne({ appId }).lean()) || DEFAULT_APP_CATALOG.find(a => a.appId === appId);
    if (appDef && appDef.businessTypeGrant) {
      const currentTypes = normalizeBusinessTypes(tenant.businessTypes || [tenant.businessType || 'trading']);
      tenant.businessTypes = currentTypes.filter(t => t !== appDef.businessTypeGrant);
      if (tenant.businessTypes.length === 0) tenant.businessTypes = ['trading'];
      tenant.businessType = tenant.businessTypes[0];
      tenant.markModified('businessTypes');
    }

    if (!tenant.settings) tenant.settings = {};
    tenant.settings.installedApps = installedApps;
    tenant.markModified('settings');
    tenant.markModified('settings.installedApps');
    await tenant.save();

    res.json({
      success: true,
      message: 'App uninstalled successfully',
      appId,
      installedApps: tenant.settings.installedApps,
      businessTypes: tenant.businessTypes,
      tenant: serializeAuthTenant(tenant)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── 4. Toggle App Active Status ───
router.post('/apps/:appId/toggle', protect, async (req, res) => {
  try {
    const { appId } = req.params;
    const { isEnabled } = req.body;

    const tenant = await getTenantForUser(req);
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    const installedApps = { ...(tenant.settings?.installedApps || {}) };
    if (!installedApps[appId]) {
      installedApps[appId] = { isInstalled: true, installedAt: new Date() };
    }
    installedApps[appId].isEnabled = typeof isEnabled === 'boolean' ? isEnabled : !installedApps[appId].isEnabled;

    if (!tenant.settings) tenant.settings = {};
    tenant.settings.installedApps = installedApps;
    tenant.markModified('settings');
    tenant.markModified('settings.installedApps');
    await tenant.save();

    res.json({
      success: true,
      appId,
      isEnabled: installedApps[appId].isEnabled,
      tenant: serializeAuthTenant(tenant)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── 5. Save App Configuration ───
router.put('/apps/:appId/settings', protect, async (req, res) => {
  try {
    const { appId } = req.params;
    const { config } = req.body;

    const tenant = await getTenantForUser(req);
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    const installedApps = { ...(tenant.settings?.installedApps || {}) };
    if (!installedApps[appId]) {
      installedApps[appId] = { isInstalled: true, isEnabled: true, installedAt: new Date() };
    }
    installedApps[appId].config = { ...(installedApps[appId].config || {}), ...(config || {}) };

    if (!tenant.settings) tenant.settings = {};
    tenant.settings.installedApps = installedApps;
    tenant.markModified('settings');
    tenant.markModified('settings.installedApps');
    await tenant.save();

    res.json({
      success: true,
      message: 'App settings saved successfully',
      appId,
      config: installedApps[appId].config,
      tenant: serializeAuthTenant(tenant)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

