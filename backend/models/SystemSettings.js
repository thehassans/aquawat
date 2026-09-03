import mongoose from 'mongoose';

const defaultPlanFeaturesEn = ['ZATCA E-Invoicing', 'Inventory & Warehouses', 'Basic Reports', '1 user'];
const defaultPlanFeaturesAr = ['الفوترة الإلكترونية', 'المخزون والمستودعات', 'تقارير أساسية', 'مستخدم واحد'];

/** Clean psychological list prices — set independently per currency (no FX conversion). */
export const STANDARD_PLAN_PRICES = {
  starter: { monthlySar: 49.99, yearlySar: 499, monthlyUsd: 29.99, yearlyUsd: 299 },
  professional: { monthlySar: 99.99, yearlySar: 999, monthlyUsd: 59.99, yearlyUsd: 599 },
  enterprise: { monthlySar: 0, yearlySar: 0, monthlyUsd: 0, yearlyUsd: 0 },
}

const applyStandardPrices = (id, overrides = {}) => {
  const base = STANDARD_PLAN_PRICES[id] || STANDARD_PLAN_PRICES.starter
  const monthlySar = overrides.monthlySar ?? base.monthlySar
  const yearlySar = overrides.yearlySar ?? base.yearlySar
  const monthlyUsd = overrides.monthlyUsd ?? base.monthlyUsd
  const yearlyUsd = overrides.yearlyUsd ?? base.yearlyUsd
  return {
    priceMonthly: monthlySar,
    priceYearly: yearlySar,
    priceMonthlySar: monthlySar,
    priceYearlySar: yearlySar,
    priceMonthlyUsd: monthlyUsd,
    priceYearlyUsd: yearlyUsd,
  }
}

const planSchema = new mongoose.Schema({
  id: { type: String, default: 'starter' },
  nameEn: { type: String, default: 'Starter' },
  nameAr: { type: String, default: 'البداية' },
  priceMonthly: { type: Number, default: 49.99 },
  priceYearly: { type: Number, default: 499 },
  priceMonthlySar: { type: Number, default: 49.99 },
  priceYearlySar: { type: Number, default: 499 },
  priceMonthlyUsd: { type: Number, default: 29.99 },
  priceYearlyUsd: { type: Number, default: 299 },
  popular: { type: Boolean, default: false },
  featuresEn: { type: [String], default: defaultPlanFeaturesEn },
  featuresAr: { type: [String], default: defaultPlanFeaturesAr }
}, { _id: false });

const getDefaultPlans = () => [
  {
    id: 'starter',
    nameEn: 'Starter',
    nameAr: 'البداية',
    ...applyStandardPrices('starter'),
    popular: false,
    featuresEn: ['ZATCA E-Invoicing', '1 user', '50 invoices / month', '50 quotations / month', 'Inventory & Warehouses', 'Basic Reports', 'Email Support'],
    featuresAr: ['الفوترة الإلكترونية', 'مستخدم واحد', '50 فاتورة / شهر', '50 عرض سعر / شهر', 'المخزون والمستودعات', 'تقارير أساسية', 'دعم بالبريد']
  },
  {
    id: 'professional',
    nameEn: 'Professional',
    nameAr: 'الاحترافية',
    ...applyStandardPrices('professional'),
    popular: true,
    featuresEn: ['Everything in Starter', '3 users', '100 invoices / month', '100 quotations / month', 'HR & Payroll (GOSI/WPS)', 'Expenses & Finance', 'Projects & Tasks', 'Advanced Reports', 'Priority Support'],
    featuresAr: ['كل ما في البداية', '3 مستخدمين', '100 فاتورة / شهر', '100 عرض سعر / شهر', 'الموارد البشرية والرواتب', 'المصروفات والمالية', 'المشاريع والمهام', 'تقارير متقدمة', 'دعم ذو أولوية']
  },
  {
    id: 'enterprise',
    nameEn: 'Enterprise',
    nameAr: 'المؤسسات',
    ...applyStandardPrices('enterprise'),
    popular: false,
    featuresEn: ['Everything in Professional', 'Unlimited users', 'Dedicated Account Manager', 'Custom Integrations', 'On-premise Option', '24/7 Phone Support', 'SLA Guarantee'],
    featuresAr: ['كل ما في الاحترافية', 'مستخدمون غير محدودين', 'مدير حساب مخصص', 'تكاملات مخصصة', 'خيار الخادم الخاص', 'دعم هاتفي 24/7', 'ضمان SLA']
  }
];

const plan = (id, nameEn, nameAr, _priceMonthly, _priceYearly, popular, featuresEn, featuresAr) => ({
  id,
  nameEn,
  nameAr,
  ...applyStandardPrices(id),
  popular,
  featuresEn,
  featuresAr,
});

export const getDefaultPlansByBusinessType = (businessType) => {
  const type = String(businessType || '').trim().toLowerCase();

  const starter = (priceMonthly, priceYearly, featuresEn, featuresAr) =>
    plan('starter', 'Starter', 'البداية', priceMonthly, priceYearly, false, featuresEn, featuresAr);
  const professional = (priceMonthly, priceYearly, featuresEn, featuresAr) =>
    plan('professional', 'Professional', 'الاحترافية', priceMonthly, priceYearly, true, featuresEn, featuresAr);
  const enterprise = () =>
    plan('enterprise', 'Enterprise', 'المؤسسات', 0, 0, false, ['Unlimited users', 'Dedicated account manager', 'Custom integrations', 'On-premise or private cloud', '24/7 phone support'], ['مستخدمون غير محدودين', 'مدير حساب مخصص', 'تكاملات مخصصة', 'خادم خاص أو سحابة خاصة', 'دعم هاتفي 24/7']);

  switch (type) {
    case 'trading':
      return [
        starter(199, 1990, ['1 user', '50 invoices / month', '50 quotations / month', 'Purchase orders', 'Inventory management', 'ZATCA E-Invoicing', 'Basic reports'], ['مستخدم واحد', '50 فاتورة / شهر', '50 عرض سعر / شهر', 'أوامر الشراء', 'إدارة المخزون', 'الفوترة الإلكترونية', 'تقارير أساسية']),
        professional(499, 4990, ['3 users', '100 invoices / month', '100 quotations / month', 'WhatsApp integration', 'Email notifications', 'HR & Payroll', 'Multi-warehouse', 'Advanced reports'], ['3 مستخدمين', '100 فاتورة / شهر', '100 عرض سعر / شهر', 'تكامل واتساب', 'إشعارات البريد', 'الموارد البشرية والرواتب', 'مستودعات متعددة', 'تقارير متقدمة']),
        enterprise()
      ];
    case 'construction':
      return [
        starter(249, 2490, ['1 user', '50 invoices / month', '50 quotations / month', 'Projects & job costing', 'Purchase orders', 'Quotations', 'ZATCA E-Invoicing'], ['مستخدم واحد', '50 فاتورة / شهر', '50 عرض سعر / شهر', 'المشاريع وتكلفة المهام', 'أوامر الشراء', 'عروض الأسعار', 'الفوترة الإلكترونية']),
        professional(599, 5990, ['3 users', '100 invoices / month', '100 quotations / month', 'WhatsApp integration', 'Email notifications', 'HR & Payroll', 'Progress billing', 'Advanced reports'], ['3 مستخدمين', '100 فاتورة / شهر', '100 عرض سعر / شهر', 'تكامل واتساب', 'إشعارات البريد', 'الموارد البشرية والرواتب', 'الفوترة التدريجية', 'تقارير متقدمة']),
        enterprise()
      ];
    case 'travel_agency':
      return [
        starter(249, 2490, ['1 user', '50 invoices / month', '50 quotations / month', 'Travel bookings', 'Ticket invoices', 'Package management', 'ZATCA E-Invoicing'], ['مستخدم واحد', '50 فاتورة / شهر', '50 عرض سعر / شهر', 'حجوزات السفر', 'فواتير التذاكر', 'إدارة الباقات', 'الفوترة الإلكترونية']),
        professional(599, 5990, ['3 users', '100 invoices / month', '100 quotations / month', 'WhatsApp integration', 'Email notifications', 'HR & Payroll', 'Supplier reconciliation', 'Advanced reports'], ['3 مستخدمين', '100 فاتورة / شهر', '100 عرض سعر / شهر', 'تكامل واتساب', 'إشعارات البريد', 'الموارد البشرية والرواتب', 'تسوية الموردين', 'تقارير متقدمة']),
        enterprise()
      ];
    case 'restaurant':
      return [
        starter(249, 2490, ['1 user', '50 invoices / month', '50 quotations / month', 'POS & orders', 'Menu management', 'Table management', 'Kitchen display'], ['مستخدم واحد', '50 فاتورة / شهر', '50 عرض سعر / شهر', 'نقطة البيع والطلبات', 'إدارة القائمة', 'إدارة الطاولات', 'شاشة المطبخ']),
        professional(599, 5990, ['3 users', '100 invoices / month', '100 quotations / month', 'WhatsApp integration', 'Email notifications', 'HR & Payroll', 'Inventory tracking', 'Online menu & QR'], ['3 مستخدمين', '100 فاتورة / شهر', '100 عرض سعر / شهر', 'تكامل واتساب', 'إشعارات البريد', 'الموارد البشرية والرواتب', 'تتبع المخزون', 'قائمة وQR اونلاين']),
        enterprise()
      ];
    case 'car_rental':
      return [
        starter(249, 2490, ['1 user', '50 invoices / month', '50 quotations / month', 'Fleet management', 'Rental contracts', 'POS checkout', 'Vehicle tracking'], ['مستخدم واحد', '50 فاتورة / شهر', '50 عرض سعر / شهر', 'إدارة الأسطول', 'عقود التأجير', 'نقطة البيع', 'تتبع المركبات']),
        professional(599, 5990, ['3 users', '100 invoices / month', '100 quotations / month', 'WhatsApp integration', 'Email notifications', 'HR & Payroll', 'Maintenance logs', 'Advanced reports'], ['3 مستخدمين', '100 فاتورة / شهر', '100 عرض سعر / شهر', 'تكامل واتساب', 'إشعارات البريد', 'الموارد البشرية والرواتب', 'سجلات الصيانة', 'تقارير متقدمة']),
        enterprise()
      ];
    case 'laundry':
      return [
        starter(199, 1990, ['1 user', '50 invoices / month', '50 quotations / month', 'Laundry orders', 'POS checkout', 'Inventory management', 'Customer tracking'], ['مستخدم واحد', '50 فاتورة / شهر', '50 عرض سعر / شهر', 'طلبات المغسلة', 'نقطة البيع', 'إدارة المخزون', 'تتبع العملاء']),
        professional(499, 4990, ['3 users', '100 invoices / month', '100 quotations / month', 'WhatsApp integration', 'Email notifications', 'HR & Payroll', 'Delivery tracking', 'Advanced reports'], ['3 مستخدمين', '100 فاتورة / شهر', '100 عرض سعر / شهر', 'تكامل واتساب', 'إشعارات البريد', 'الموارد البشرية والرواتب', 'تتبع التوصيل', 'تقارير متقدمة']),
        enterprise()
      ];
    case 'saloon':
      return [
        starter(199, 1990, ['1 user', '50 invoices / month', '50 quotations / month', 'Services & appointments', 'POS checkout', 'Customer profiles', 'Staff scheduling'], ['مستخدم واحد', '50 فاتورة / شهر', '50 عرض سعر / شهر', 'الخدمات والمواعيد', 'نقطة البيع', 'ملفات العملاء', 'جدولة الموظفين']),
        professional(499, 4990, ['3 users', '100 invoices / month', '100 quotations / month', 'WhatsApp integration', 'Email notifications', 'HR & Payroll', 'Online booking', 'Advanced reports'], ['3 مستخدمين', '100 فاتورة / شهر', '100 عرض سعر / شهر', 'تكامل واتساب', 'إشعارات البريد', 'الموارد البشرية والرواتب', 'حجز اونلاين', 'تقارير متقدمة']),
        enterprise()
      ];
    case 'khayyat':
      return [
        starter(199, 1990, ['1 user', '50 invoices / month', '50 quotations / month', 'Measurements & orders', 'POS checkout', 'Stitching tracking', 'Customer profiles'], ['مستخدم واحد', '50 فاتورة / شهر', '50 عرض سعر / شهر', 'المقاسات والطلبات', 'نقطة البيع', 'تتبع الخياطة', 'ملفات العملاء']),
        professional(499, 4990, ['3 users', '100 invoices / month', '100 quotations / month', 'WhatsApp integration', 'Email notifications', 'HR & Payroll', 'Order photos', 'Advanced reports'], ['3 مستخدمين', '100 فاتورة / شهر', '100 عرض سعر / شهر', 'تكامل واتساب', 'إشعارات البريد', 'الموارد البشرية والرواتب', 'صور الطلبات', 'تقارير متقدمة']),
        enterprise()
      ];
    case 'boutique':
      return [
        starter(199, 1990, ['1 user', '50 invoices / month', '50 quotations / month', 'Dress inventory', 'Rental calendar', 'POS checkout', 'Customer profiles'], ['مستخدم واحد', '50 فاتورة / شهر', '50 عرض سعر / شهر', 'مخزون الفساتين', 'تقويم الإيجار', 'نقطة البيع', 'ملفات العملاء']),
        professional(499, 4990, ['3 users', '100 invoices / month', '100 quotations / month', 'WhatsApp integration', 'Email notifications', 'HR & Payroll', 'Online catalog', 'Advanced reports'], ['3 مستخدمين', '100 فاتورة / شهر', '100 عرض سعر / شهر', 'تكامل واتساب', 'إشعارات البريد', 'الموارد البشرية والرواتب', 'كتالوج اونلاين', 'تقارير متقدمة']),
        enterprise()
      ];
    case 'manpower':
      return [
        starter(249, 2490, ['1 user', '50 invoices / month', '50 quotations / month', 'Labor contracts', 'Assignments', 'Project billing', 'ZATCA E-Invoicing'], ['مستخدم واحد', '50 فاتورة / شهر', '50 عرض سعر / شهر', 'عقود العمالة', 'التعيينات', 'فوترة المشاريع', 'الفوترة الإلكترونية']),
        professional(599, 5990, ['3 users', '100 invoices / month', '100 quotations / month', 'WhatsApp integration', 'Email notifications', 'HR & Payroll', 'Timesheets', 'Advanced reports'], ['3 مستخدمين', '100 فاتورة / شهر', '100 عرض سعر / شهر', 'تكامل واتساب', 'إشعارات البريد', 'الموارد البشرية والرواتب', 'سجلات الدوام', 'تقارير متقدمة']),
        enterprise()
      ];
    case 'bakala':
      return [
        starter(199, 1990, ['1 user', '50 invoices / month', '50 quotations / month', 'Fast POS', 'Barcode scanning', 'Inventory management', 'Customer tracking'], ['مستخدم واحد', '50 فاتورة / شهر', '50 عرض سعر / شهر', 'نقطة بيع سريعة', 'مسح الباركود', 'إدارة المخزون', 'تتبع العملاء']),
        professional(499, 4990, ['3 users', '100 invoices / month', '100 quotations / month', 'WhatsApp integration', 'Email notifications', 'HR & Payroll', 'Multi-device POS', 'Advanced reports'], ['3 مستخدمين', '100 فاتورة / شهر', '100 عرض سعر / شهر', 'تكامل واتساب', 'إشعارات البريد', 'الموارد البشرية والرواتب', 'نقطة بيع متعددة الأجهزة', 'تقارير متقدمة']),
        enterprise()
      ];
    case 'pharmacy':
      return [
        starter(249, 2490, ['1 user', '50 invoices / month', 'Pharmacy POS', 'Barcode & GTIN', 'Batch & expiry', 'Prescription capture', 'ZATCA E-Invoicing'], ['مستخدم واحد', '50 فاتورة / شهر', 'نقطة بيع الصيدلية', 'باركود وGTIN', 'التشغيلة والصلاحية', 'تسجيل الوصفات', 'الفوترة الإلكترونية']),
        professional(599, 5990, ['3 users', '100 invoices / month', 'Controlled-drug log', 'SFDA register fields', 'WhatsApp integration', 'HR & Payroll', 'Multi-device POS', 'Advanced reports'], ['3 مستخدمين', '100 فاتورة / شهر', 'سجل الأدوية الخاضعة للرقابة', 'رقم تسجيل هيئة الغذاء والدواء', 'تكامل واتساب', 'الموارد البشرية والرواتب', 'نقطة بيع متعددة الأجهزة', 'تقارير متقدمة']),
        enterprise()
      ];
    case 'car_workshop':
      return [
        starter(299, 2990, ['1 user', '50 invoices / month', '50 quotations / month', 'Job cards', 'Taqdeer estimates', 'Parts inventory', 'ZATCA E-Invoicing'], ['مستخدم واحد', '50 فاتورة / شهر', '50 عرض سعر / شهر', 'بطاقات الإصلاح', 'تقديرات تقدير', 'مخزون القطع', 'الفوترة الإلكترونية']),
        professional(699, 6990, ['3 users', '100 invoices / month', '100 quotations / month', 'WhatsApp integration', 'Email notifications', 'HR & Payroll', 'Absher integration', 'Advanced reports'], ['3 مستخدمين', '100 فاتورة / شهر', '100 عرض سعر / شهر', 'تكامل واتساب', 'إشعارات البريد', 'الموارد البشرية والرواتب', 'تكامل أبشر', 'تقارير متقدمة']),
        enterprise()
      ];
    case 'bookstore':
      return [
        starter(199, 1990, ['1 user', '50 invoices / month', '50 quotations / month', 'POS checkout', 'ISBN scanning', 'Inventory management', 'Thermal printer support'], ['مستخدم واحد', '50 فاتورة / شهر', '50 عرض سعر / شهر', 'نقطة البيع', 'مسح ISBN', 'إدارة المخزون', 'دعم الطابعة الحرارية']),
        professional(499, 4990, ['3 users', '100 invoices / month', '100 quotations / month', 'WhatsApp integration', 'Email notifications', 'HR & Payroll', 'Online catalog', 'Advanced reports'], ['3 مستخدمين', '100 فاتورة / شهر', '100 عرض سعر / شهر', 'تكامل واتساب', 'إشعارات البريد', 'الموارد البشرية والرواتب', 'كتالوج اونلاين', 'تقارير متقدمة']),
        enterprise()
      ];
    default:
      return getDefaultPlans();
  }
};

export const overlayCatalogPrices = (plans = []) =>
  (Array.isArray(plans) ? plans : []).map((plan) => {
    if (!plan) return plan
    const id = String(plan.id || '').toLowerCase()
    const std = STANDARD_PLAN_PRICES[id]
    if (!std) return plan
    const obj = typeof plan.toObject === 'function' ? plan.toObject() : { ...plan }
    return { ...obj, ...applyStandardPrices(id) }
  })

const systemSettingsSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, default: 'global' },
  gemini: {
    enabled: { type: Boolean, default: false },
    apiKey: { type: String },
    model: { type: String, default: 'gemini-2.5-flash' }
  },
  openai: {
    enabled: { type: Boolean, default: false },
    apiKey: { type: String },
    model: { type: String, default: 'gpt-4o-mini' }
  },
  grok: {
    enabled: { type: Boolean, default: false },
    apiKey: { type: String },
    model: { type: String, default: 'grok-2-latest' }
  },
  groq: {
    enabled: { type: Boolean, default: false },
    apiKey: { type: String },
    model: { type: String, default: 'llama-3.1-8b-instant' }
  },
  glmOcr: {
    enabled: { type: Boolean, default: false },
    baseURL: { type: String, default: 'http://localhost:8000/v1' },
    apiKey: { type: String, default: 'EMPTY' },
    model: { type: String, default: 'glm-ocr' }
  },
  identity: {
    enabled: { type: Boolean, default: false },
    provider: { type: String, default: 'custom_webhook' },
    endpoint: { type: String, default: '' },
    apiKey: { type: String, default: '' },
    ocrEnabled: { type: Boolean, default: false }
  },
  website: {
    brandName: { type: String, default: 'Maqder ERP' },
    domain: { type: String, default: 'maqder.com' },
    contactPhone: { type: String, default: '+966595930045' },
    contactEmail: { type: String, default: 'info@maqder.com' },
    contactAddressEn: { type: String, default: 'DAMMAM, Madinat Al Ummal Dist. 18, Saudi Arabia' },
    contactAddressAr: { type: String, default: 'الدمام، حي مدينة العمال 18، المملكة العربية السعودية' },
    hero: {
      titleEn: { type: String, default: 'Complete ERP System' },
      titleAr: { type: String, default: 'نظام ERP متكامل' },
      subtitleEn: { type: String, default: 'Saudi compliant, ZATCA Phase 2 ready. Invoicing, HR, Payroll, Inventory & more.' },
      subtitleAr: { type: String, default: 'متوافق مع السعودية وجاهز للمرحلة الثانية. فوترة، موارد بشرية، رواتب، مخزون وأكثر.' }
    },
    cta: {
      primaryEn: { type: String, default: 'Start Now' },
      primaryAr: { type: String, default: 'ابدأ الآن' },
      secondaryEn: { type: String, default: 'Live Demo' },
      secondaryAr: { type: String, default: 'عرض مباشر' }
    },
    demo: {
      enabled: { type: Boolean, default: true },
      tenantSlug: { type: String, default: 'demo' },
      email: { type: String, default: 'demo@maqder.com' },
      password: { type: String, default: 'Demo@12345' }
    },
    pricing: {
      currency: { type: String, default: 'SAR' },
      plans: { type: [planSchema], default: getDefaultPlans },
      plansByBusinessType: {
        type: [
          {
            businessType: { type: String, required: true },
            plans: { type: [planSchema], default: [] }
          }
        ],
        default: []
      }
    }
  },
  email: {
    enabled: { type: Boolean, default: false },
    provider: { type: String, enum: ['smtp', 'brevo'], default: 'smtp' },
    smtpHost: { type: String, default: '' },
    smtpPort: { type: Number, default: 587 },
    smtpSecure: { type: Boolean, default: false },
    smtpUser: { type: String, default: '' },
    smtpPass: { type: String, default: '' },
    brevoApiKey: { type: String, default: '' },
    fromName: { type: String, default: 'Maqder ERP' },
    fromEmail: { type: String, default: '' },
    replyTo: { type: String, default: '' },
    salesEmail: { type: String, default: '' },
    supportEmail: { type: String, default: '' },
    billingEmail: { type: String, default: '' },
    templates: {
      tenantCreated: {
        subjectEn: { type: String, default: 'Your {{brandName}} panel is ready for {{companyName}}' },
        subjectAr: { type: String, default: 'لوحة {{brandName}} أصبحت جاهزة لشركة {{companyName}}' },
        bodyEn: { type: String, default: 'Hello {{contactName}},\n\nYour panel for {{companyName}} has been created successfully.\n\nLogin email: {{loginEmail}}\nTenant slug: {{tenantSlug}}\n\nYou can now sign in and start using {{brandName}}.' },
        bodyAr: { type: String, default: 'مرحباً {{contactName}}،\n\nتم إنشاء لوحة {{brandName}} الخاصة بشركة {{companyName}} بنجاح.\n\nالبريد للدخول: {{loginEmail}}\nرمز الشركة: {{tenantSlug}}\n\nيمكنك الآن تسجيل الدخول والبدء باستخدام {{brandName}}.' }
      },
      invoice: {
        subjectEn: { type: String, default: 'Invoice {{invoiceNumber}} from {{companyName}}' },
        subjectAr: { type: String, default: 'الفاتورة {{invoiceNumber}} من {{companyName}}' },
        bodyEn: { type: String, default: 'Hello {{customerName}},\n\nPlease find your invoice {{invoiceNumber}} dated {{invoiceDate}} with a total of {{invoiceTotal}}.\n\nThank you for your business.\n{{companyName}}' },
        bodyAr: { type: String, default: 'مرحباً {{customerName}}،\n\nنرفق لكم الفاتورة رقم {{invoiceNumber}} بتاريخ {{invoiceDate}} بإجمالي {{invoiceTotal}}.\n\nشكراً لتعاملكم معنا.\n{{companyName}}' }
      }
    }
  },
  errorTracking: {
    enabled: { type: Boolean, default: false },
    provider: { type: String, enum: ['sentry', 'bugsnag', 'custom'], default: 'sentry' },
    dsn: { type: String, default: '' },
    uploadSourceMaps: { type: Boolean, default: false },
  },
  sms: {
    enabled: { type: Boolean, default: false },
    provider: { type: String, enum: ['twilio', 'custom'], default: 'twilio' },
    twilioAccountSid: { type: String, default: '' },
    twilioAuthToken: { type: String, default: '' },
    twilioFromNumber: { type: String, default: '' },
    customEndpoint: { type: String, default: '' }
  },
  analytics: {
    enabled: { type: Boolean, default: false },
    provider: { type: String, enum: ['posthog', 'mixpanel', 'amplitude', 'custom'], default: 'posthog' },
    apiKey: { type: String, default: '' },
    endpoint: { type: String, default: '' },
    trackEvents: {
      signUp: { type: Boolean, default: true },
      login: { type: Boolean, default: true },
      invoiceCreated: { type: Boolean, default: true },
      invoicePaid: { type: Boolean, default: true },
      invoiceSigned: { type: Boolean, default: true },
      posPayment: { type: Boolean, default: true },
      orderCompleted: { type: Boolean, default: true },
      subscriptionStarted: { type: Boolean, default: true },
      subscriptionRenewed: { type: Boolean, default: true },
      subscriptionCanceled: { type: Boolean, default: true },
      trialConverted: { type: Boolean, default: true },
      firstInvoiceWithin7d: { type: Boolean, default: true },
    },
  },
  rateLimiting: {
    authMaxRequests: { type: Number, default: 300 },
    authWindowMinutes: { type: Number, default: 15 },
    // Must stay high enough for ERP report browsing (many GETs per page).
    apiMaxRequests: { type: Number, default: 15000 },
    apiWindowMinutes: { type: Number, default: 15 },
  },
  sessionConfig: {
    accessTokenExpiryMinutes: { type: Number, default: 60 },
    refreshTokenExpiryDays: { type: Number, default: 30 },
    sessionTimeoutMinutes: { type: Number, default: 480 },
  },
  xssProtection: { type: Boolean, default: true },
  mongoSanitize: { type: Boolean, default: true },
  payment: {
    moyasar: {
      enabled: { type: Boolean, default: false },
      publishableKey: { type: String, default: '' },
      secretKey: { type: String, default: '' },
      webhookSecret: { type: String, default: '' },
      environment: { type: String, enum: ['test', 'live'], default: 'test' },
    },
    applePay: {
      enabled: { type: Boolean, default: false },
      merchantId: { type: String, default: '' },
      merchantCertificatePath: { type: String, default: '' },
      merchantCertificateKeyPath: { type: String, default: '' },
      environment: { type: String, enum: ['test', 'live'], default: 'test' },
    },
    stcPay: {
      enabled: { type: Boolean, default: false },
      merchantId: { type: String, default: '' },
      apiKey: { type: String, default: '' },
      environment: { type: String, enum: ['test', 'live'], default: 'test' },
    },
    tabby: {
      enabled: { type: Boolean, default: false },
      publicKey: { type: String, default: '' },
      secretKey: { type: String, default: '' },
      merchantCode: { type: String, default: '' },
      environment: { type: String, enum: ['test', 'live'], default: 'test' },
    },
    tamara: {
      enabled: { type: Boolean, default: false },
      apiToken: { type: String, default: '' },
      notificationToken: { type: String, default: '' },
      environment: { type: String, enum: ['test', 'live'], default: 'test' },
    },
    stripe: {
      enabled: { type: Boolean, default: false },
      publishableKey: { type: String, default: '' },
      secretKey: { type: String, default: '' },
      webhookSecret: { type: String, default: '' },
      environment: { type: String, enum: ['test', 'live'], default: 'test' },
    },
  },
  tenantMonitoring: {
    enabled: { type: Boolean, default: false },
    endpointURL: { type: String, default: '' },
    apiKey: { type: String, default: '' },
    provider: { type: String, enum: ['custom', 'plesk', 'cpanel'], default: 'custom' },
  },
}, {
  timestamps: true
});

const SystemSettings = mongoose.model('SystemSettings', systemSettingsSchema);
export const getDefaultPricingPlans = getDefaultPlans;
export default SystemSettings;
