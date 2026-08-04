import express from 'express';
import { protect } from '../middleware/auth.js';
import Tenant from '../models/Tenant.js';
import { AppAddon } from '../models/AppAddon.js';
import { normalizeBusinessTypes } from '../utils/businessTypes.js';

const router = express.Router();

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
    downloadSize: '14.8 MB',
    author: 'Maqder Core',
    rating: 4.98,
    reviewsCount: 342,
    pricingTier: 'free',
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
            configSchema: app.configSchema
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

    const appsWithStatus = finalApps.map((app) => {
      const defApp = defaultCatalogMap.get(app.appId);
      const isExplicitlyInstalled = !!tenantInstalled[app.appId]?.isInstalled;
      const isInstalled = isExplicitlyInstalled;
      const isEnabled = tenantInstalled[app.appId]?.isEnabled !== false;
      const config = tenantInstalled[app.appId]?.config || {};

      return {
        ...app,
        downloadSize: app.downloadSize || defApp?.downloadSize || '4.5 MB',
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

// ─── 2. Install App / Add-on ───
router.post('/apps/:appId/install', protect, async (req, res) => {
  try {
    const { appId } = req.params;
    const { customConfig } = req.body || {};

    const appDef = (await AppAddon.findOne({ appId }).lean()) || DEFAULT_APP_CATALOG.find(a => a.appId === appId);
    if (!appDef) return res.status(404).json({ error: 'App not found in catalog' });

    const tenant = await getTenantForUser(req);
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

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

    const appConfig = {
      isInstalled: true,
      isEnabled: true,
      installedAt: new Date(),
      version: appDef.version,
      config: { ...defaultCfg, ...(customConfig || {}) }
    };

    tenant.settings.installedApps[appId] = appConfig;

    // If app grants a business type (e.g. manufacturing), ensure it is added to tenant.businessTypes
    let currentTypes = normalizeBusinessTypes(tenant.businessTypes || [tenant.businessType || 'trading']);
    if (appDef.businessTypeGrant && !currentTypes.includes(appDef.businessTypeGrant)) {
      currentTypes.push(appDef.businessTypeGrant);
      tenant.businessTypes = currentTypes;
    }

    tenant.markModified('settings.installedApps');
    tenant.markModified('settings');
    tenant.markModified('businessTypes');
    await tenant.save();

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

