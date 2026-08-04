import express from 'express';
import { authenticate } from '../middleware/auth.js';
import Tenant from '../models/Tenant.js';
import { AppAddon } from '../models/AppAddon.js';
import { normalizeBusinessTypes } from '../utils/businessTypes.js';

const router = express.Router();

// Built-in Apps and Add-ons Catalog Definition
export const DEFAULT_APP_CATALOG = [
  {
    appId: 'manufacturing_mes',
    nameEn: 'Manufacturing & Industrial MES',
    nameAr: 'نظام التصنيع والإنتاج المتقدم (MES & MRP II)',
    taglineEn: 'Multi-level BOMs, MRP planning, real-time shop floor execution, QA/QC, and OEE analytics.',
    taglineAr: 'شجرة المواد المتعددة، تخطيط الاحتياجات MRP، تنفيذ أرضية المصنع، فحص الجودة ومؤشرات OEE.',
    descriptionEn: 'Full-scale manufacturing ERP engine: define complex assemblies, generate dynamic work orders, dispatch job cards with mobile operator timers, enforce ISO-grade QA checklists, track scrap/NCRs, and calculate standard vs. actual cost variances in real-time.',
    descriptionAr: 'منظومة صناعية متكاملة لإدارة خطوط الإنتاج، شجرة المنتجات المركبة، تخطيط المواد، أوامر الشغل، ومراقبة الجودة وتكلفة المواد والعمالة اللحظية.',
    category: 'manufacturing',
    appType: 'core_vertical',
    icon: 'factory',
    version: '3.2.0',
    author: 'Maqder Core',
    rating: 4.98,
    reviewsCount: 342,
    pricingTier: 'free_included',
    badge: 'Enterprise',
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
    author: 'Maqder Saudi Gov Suite',
    rating: 5.0,
    reviewsCount: 890,
    pricingTier: 'free_included',
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
    author: 'Maqder IoT Labs',
    rating: 4.94,
    reviewsCount: 215,
    pricingTier: 'free_included',
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
    author: 'Maqder IoT Labs',
    rating: 4.88,
    reviewsCount: 94,
    pricingTier: 'free_included',
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
    author: 'Maqder Connect',
    rating: 4.96,
    reviewsCount: 520,
    pricingTier: 'free_included',
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
    author: 'Maqder AI Labs',
    rating: 4.95,
    reviewsCount: 410,
    pricingTier: 'free_included',
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
    author: 'Maqder Saudi Gov Suite',
    rating: 4.91,
    reviewsCount: 175,
    pricingTier: 'free_included',
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
    author: 'Maqder Logistics',
    rating: 4.87,
    reviewsCount: 160,
    pricingTier: 'free_included',
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
  {
    appId: 'geidea_paytabs_pos',
    nameEn: 'Geidea & PayTabs Smart Payment Terminals',
    nameAr: 'ربط أجهزة الدفع الإلكتروني الذكية (Geidea & PayTabs)',
    taglineEn: 'Mada, Apple Pay, Visa & Mastercard direct POS synchronization without manual amount entry.',
    taglineAr: 'ربط مباشر لشبكة مدى وApple Pay مع شاشات البيع لتجنب الأخطاء البشرية.',
    descriptionEn: 'Direct integration with Android POS payment terminals (Geidea, PayTabs, NearPay) via local Wi-Fi / Cloud APIs, eliminating manual transaction input and speeding up checkout.',
    descriptionAr: 'تكامل مباشر مع أجهزة مدى الذكية يرسل المبلغ للشاشة تلقائياً ويسجل الفاتورة فور قبول الدفع.',
    category: 'hardware_iot',
    appType: 'hardware_integration',
    icon: 'credit-card',
    version: '2.7.0',
    author: 'Maqder Pay',
    rating: 4.97,
    reviewsCount: 380,
    pricingTier: 'free_included',
    badge: 'Mada Certified',
    defaultRoute: '/app/dashboard/settings',
    requiresHardware: true,
    featuresEn: [
      'Automatic Amount Push to Terminal on Checkout',
      'Instant Webhook Approval & Receipt Stamping',
      'Daily Batch Settlement Reconciliation Reports',
      'Support for Mada, Apple Pay, Visa, Mastercard'
    ],
    featuresAr: [
      'إرسال المبلغ لجهاز مدى تلقائياً فور طلب الدفع',
      'اعتماد فوري للعملية وطباعة الفاتورة بدون تأخير',
      'تقارير مطابقة الموازنة اليومية لشبكة مدى',
      'دعم بطاقات مدى، أبل باي، فيزا، وماستركارد'
    ],
    configSchema: [
      { key: 'terminalProvider', labelEn: 'Terminal Hardware Provider', labelAr: 'مزود جهاز الدفع', type: 'select', defaultValue: 'geidea', options: [{ value: 'geidea', labelEn: 'Geidea Smart POS', labelAr: 'أجهزة جيديا الذكية' }, { value: 'paytabs', labelEn: 'PayTabs Terminal', labelAr: 'أجهزة بي تابز' }, { value: 'nearpay', labelEn: 'NearPay SoftPOS', labelAr: 'نير باي (جوال ككاشير)' }] },
      { key: 'autoFinalizeInvoice', labelEn: 'Auto-finalize & print invoice upon approved payment', labelAr: 'إغلاق الفاتورة وطباعتها تلقائياً عند نجاح الدفع', type: 'boolean', defaultValue: true }
    ]
  }
];

// Helper: Ensure default apps catalog is in DB
const ensureCatalogInitialized = async () => {
  try {
    for (const app of DEFAULT_APP_CATALOG) {
      await AppAddon.findOneAndUpdate(
        { appId: app.appId },
        { $set: app },
        { upsert: true, new: true }
      );
    }
  } catch (err) {
    console.error('Failed to initialize app catalog:', err.message);
  }
};
ensureCatalogInitialized();

// ─── 1. Get All Apps & Add-ons with Tenant Installation Status ───
router.get('/apps', authenticate, async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.user.tenantId);
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    let apps = await AppAddon.find({ isActive: true }).lean();
    if (!apps || apps.length === 0) {
      apps = DEFAULT_APP_CATALOG;
    }

    const tenantInstalled = tenant.settings?.installedApps || {};
    const tenantBusinessTypes = normalizeBusinessTypes(tenant.businessTypes || [tenant.businessType || 'trading']);

    const appsWithStatus = apps.map((app) => {
      const isGrantMatch = app.businessTypeGrant ? tenantBusinessTypes.includes(app.businessTypeGrant) : false;
      const isExplicitlyInstalled = !!tenantInstalled[app.appId]?.isInstalled;
      // If businessType matches, it's considered installed/included by default
      const isInstalled = isGrantMatch || isExplicitlyInstalled || app.pricingTier === 'free_included';
      const isEnabled = tenantInstalled[app.appId]?.isEnabled !== false;
      const config = tenantInstalled[app.appId]?.config || {};

      return {
        ...app,
        isInstalled,
        isEnabled,
        installedAt: tenantInstalled[app.appId]?.installedAt || (isInstalled ? tenant.createdAt : null),
        config
      };
    });

    res.json({
      success: true,
      apps: appsWithStatus,
      totalCount: appsWithStatus.length,
      installedCount: appsWithStatus.filter(a => a.isInstalled).length
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── 2. Install App / Add-on ───────────────────────────────────────
router.post('/apps/:appId/install', authenticate, async (req, res) => {
  try {
    const { appId } = req.params;
    const { initialConfig } = req.body || {};

    const tenant = await Tenant.findById(req.user.tenantId);
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    const app = await AppAddon.findOne({ appId }) || DEFAULT_APP_CATALOG.find(a => a.appId === appId);
    if (!app) return res.status(404).json({ error: 'App not found in catalog' });

    const installedApps = { ...(tenant.settings?.installedApps || {}) };
    installedApps[appId] = {
      isInstalled: true,
      isEnabled: true,
      installedAt: new Date(),
      config: initialConfig || {}
    };

    // If app grants a business type (e.g. manufacturing), ensure it is added to tenant.businessTypes
    let currentTypes = normalizeBusinessTypes(tenant.businessTypes || [tenant.businessType || 'trading']);
    if (app.businessTypeGrant && !currentTypes.includes(app.businessTypeGrant)) {
      currentTypes.push(app.businessTypeGrant);
      tenant.businessTypes = currentTypes;
    }

    if (!tenant.settings) tenant.settings = {};
    tenant.settings.installedApps = installedApps;
    tenant.markModified('settings');
    tenant.markModified('businessTypes');
    await tenant.save();

    res.json({
      success: true,
      message: 'App installed successfully',
      appId,
      installedApps: tenant.settings.installedApps,
      businessTypes: tenant.businessTypes
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── 3. Uninstall App / Add-on ─────────────────────────────────────
router.post('/apps/:appId/uninstall', authenticate, async (req, res) => {
  try {
    const { appId } = req.params;

    const tenant = await Tenant.findById(req.user.tenantId);
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    const installedApps = { ...(tenant.settings?.installedApps || {}) };
    if (installedApps[appId]) {
      installedApps[appId].isInstalled = false;
      installedApps[appId].isEnabled = false;
      installedApps[appId].uninstalledAt = new Date();
    }

    if (!tenant.settings) tenant.settings = {};
    tenant.settings.installedApps = installedApps;
    tenant.markModified('settings');
    await tenant.save();

    res.json({
      success: true,
      message: 'App uninstalled successfully',
      appId,
      installedApps: tenant.settings.installedApps
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── 4. Toggle App Active Status ──────────────────────────────────
router.post('/apps/:appId/toggle', authenticate, async (req, res) => {
  try {
    const { appId } = req.params;
    const { isEnabled } = req.body;

    const tenant = await Tenant.findById(req.user.tenantId);
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    const installedApps = { ...(tenant.settings?.installedApps || {}) };
    if (!installedApps[appId]) {
      installedApps[appId] = { isInstalled: true, installedAt: new Date() };
    }
    installedApps[appId].isEnabled = typeof isEnabled === 'boolean' ? isEnabled : !installedApps[appId].isEnabled;

    if (!tenant.settings) tenant.settings = {};
    tenant.settings.installedApps = installedApps;
    tenant.markModified('settings');
    await tenant.save();

    res.json({
      success: true,
      appId,
      isEnabled: installedApps[appId].isEnabled
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── 5. Save App Configuration ─────────────────────────────────────
router.put('/apps/:appId/settings', authenticate, async (req, res) => {
  try {
    const { appId } = req.params;
    const { config } = req.body;

    const tenant = await Tenant.findById(req.user.tenantId);
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    const installedApps = { ...(tenant.settings?.installedApps || {}) };
    if (!installedApps[appId]) {
      installedApps[appId] = { isInstalled: true, isEnabled: true, installedAt: new Date() };
    }
    installedApps[appId].config = { ...(installedApps[appId].config || {}), ...(config || {}) };

    if (!tenant.settings) tenant.settings = {};
    tenant.settings.installedApps = installedApps;
    tenant.markModified('settings');
    await tenant.save();

    res.json({
      success: true,
      message: 'App settings saved successfully',
      appId,
      config: installedApps[appId].config
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
