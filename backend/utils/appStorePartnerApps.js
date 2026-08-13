export const DELIVERY_PLATFORM_APP_MAP = {
  hungerstation_delivery: 'hungerstation',
  jahez_delivery: 'jahez',
  keeta_delivery: 'keeta',
  mrsool_delivery: 'mrsool',
  ninja_delivery: 'ninja',
  toyou_delivery: 'toyou',
  jumlaty_delivery: 'jumlaty',
}

export const COURIER_APP_MAP = {
  smsa_express: 'smsa',
  aramex_shipping: 'aramex',
  jnt_express: 'jnt',
  naqel_express: 'naqel',
  imile_courier: 'imile',
  spl_saudi_post: 'spl',
}

export const DELIVERY_HUB_APP_ID = 'delivery_platforms'
export const LOGISTICS_HUB_APP_ID = 'multicourier_shipping'

export const ALL_DELIVERY_APP_IDS = [DELIVERY_HUB_APP_ID, ...Object.keys(DELIVERY_PLATFORM_APP_MAP)]
export const ALL_COURIER_APP_IDS = [LOGISTICS_HUB_APP_ID, ...Object.keys(COURIER_APP_MAP)]
export const COURIER_PROVIDER_KEYS = ['smsa', 'aramex', 'naqel', 'imile', 'jnt', 'spl']

const deliveryMeta = {
  hungerstation_delivery: {
    nameEn: 'HungerStation',
    nameAr: 'هنقرستيشن',
    taglineEn: 'Receive HungerStation orders into kitchen, KDS, and restaurant orders.',
    taglineAr: 'استقبل طلبات هنقرستيشن في المطبخ وشاشة التحضير وطلبات المطعم.',
    icon: 'hungerstation',
    color: '#EC4899',
    url: 'hungerstation.com',
  },
  jahez_delivery: {
    nameEn: 'Jahez',
    nameAr: 'جاهز',
    taglineEn: 'Live Jahez order ingest, accept/reject, and kitchen dispatch.',
    taglineAr: 'استقبال طلبات جاهز لحظياً وقبولها أو رفضها وإرسالها للمطبخ.',
    icon: 'jahez',
    color: '#F97316',
    url: 'jahez.net',
  },
  keeta_delivery: {
    nameEn: 'Keeta',
    nameAr: 'كيتا',
    taglineEn: 'Keeta marketplace orders land in your restaurant POS and KDS.',
    taglineAr: 'طلبات كيتا تصل مباشرة إلى نقطة البيع وشاشة المطبخ.',
    icon: 'keeta',
    color: '#059669',
    url: 'keeta.com',
  },
  mrsool_delivery: {
    nameEn: 'Mrsool',
    nameAr: 'مرسول',
    taglineEn: 'Mrsool courier jobs sync into restaurant delivery and kitchen tickets.',
    taglineAr: 'طلبات مرسول تتزامن مع التوصيل وتذاكر المطبخ.',
    icon: 'mrsool',
    color: '#2563EB',
    url: 'mrsool.com',
  },
  ninja_delivery: {
    nameEn: 'Ninja',
    nameAr: 'نينجا',
    taglineEn: 'Ninja delivery orders with driver tracking and payouts.',
    taglineAr: 'طلبات نينجا مع تتبع السائق والتسويات.',
    icon: 'ninja',
    color: '#7C3AED',
    url: 'ninja.sa',
  },
  toyou_delivery: {
    nameEn: 'ToYou',
    nameAr: 'تويو',
    taglineEn: 'ToYou aggregator orders flow into restaurant orders automatically.',
    taglineAr: 'طلبات تويو تدخل قائمة طلبات المطعم تلقائياً.',
    icon: 'toyou',
    color: '#0EA5E9',
    url: 'toyou.com',
  },
  jumlaty_delivery: {
    nameEn: 'Jumlaty',
    nameAr: 'جملتي',
    taglineEn: 'Wholesale/QSR Jumlaty orders with menu mapping and settlements.',
    taglineAr: 'طلبات جملتي مع ربط القائمة والتسويات.',
    icon: 'jumlaty',
    color: '#D97706',
    url: 'jumlaty.com',
  },
}

const courierMeta = {
  smsa_express: {
    nameEn: 'SMSA Express',
    nameAr: 'سمسا إكسبريس',
    taglineEn: 'Print AWB labels, track parcels, and reconcile COD with SMSA.',
    taglineAr: 'طباعة بوالص سمسا وتتبع الشحنات ومطابقة الدفع عند الاستلام.',
    icon: 'smsa',
  },
  aramex_shipping: {
    nameEn: 'Aramex',
    nameAr: 'أرامكس',
    taglineEn: 'Create Aramex shipments, labels, and live tracking from orders.',
    taglineAr: 'إنشاء شحنات أرامكس والملصقات والتتبع من الطلبات.',
    icon: 'aramex',
  },
  jnt_express: {
    nameEn: 'J&T Express',
    nameAr: 'جي آند تي إكسبريس',
    taglineEn: 'J&T waybills, pickup booking, and last-mile tracking.',
    taglineAr: 'بوالص جي آند تي وحجز الالتقاط وتتبع الميل الأخير.',
    icon: 'jnt',
  },
  naqel_express: {
    nameEn: 'Naqel Express',
    nameAr: 'ناقل إكسبريس',
    taglineEn: 'Domestic and GCC shipping with Naqel AWB generation.',
    taglineAr: 'شحن محلي وخليجي مع توليد بوالص ناقل.',
    icon: 'naqel',
  },
  imile_courier: {
    nameEn: 'iMile',
    nameAr: 'آي مايل',
    taglineEn: 'Cross-border and local iMile fulfillment for ecommerce orders.',
    taglineAr: 'تنفيذ شحنات آي مايل المحلية والعابرة للحدود.',
    icon: 'imile',
  },
  spl_saudi_post: {
    nameEn: 'Saudi Post (SPL)',
    nameAr: 'البريد السعودي (سبل)',
    taglineEn: 'SPL / Saudi Post labels and tracking for nationwide delivery.',
    taglineAr: 'بوالص سبل وتتبع التوصيل على مستوى المملكة.',
    icon: 'spl',
  },
}

export const DELIVERY_PARTNER_APPS = Object.entries(deliveryMeta).map(([appId, meta]) => ({
  appId,
  nameEn: meta.nameEn,
  nameAr: meta.nameAr,
  taglineEn: meta.taglineEn,
  taglineAr: meta.taglineAr,
  descriptionEn: `${meta.nameEn} connects to restaurant orders, kitchen/KDS, and delivery payouts. Incoming platform webhooks create a kitchen ticket and a unified delivery order automatically.`,
  descriptionAr: `${meta.nameAr} يرتبط بطلبات المطعم والمطبخ وشاشة التحضير وتسويات التوصيل. الطلبات الواردة تنشئ تذكرة مطبخ وطلب توصيل موحد تلقائياً.`,
  category: 'delivery_platforms',
  appType: 'premium_addon',
  icon: meta.icon,
  version: '1.0.0',
  downloadSize: '4.8 MB',
  author: 'Maqder Delivery',
  rating: 4.9,
  reviewsCount: 86,
  pricingTier: 'free',
  badge: 'Delivery',
  defaultRoute: `/app/dashboard/restaurant/delivery?platform=${DELIVERY_PLATFORM_APP_MAP[appId]}`,
  businessTypeGrant: 'restaurant',
  featuresEn: [
    `Dedicated ${meta.nameEn} workspace`,
    'Webhook ingest → restaurant order + kitchen ticket',
    'Accept / reject / ready / dispatched status loop',
    'Driver, commission, and payout tracking',
    `Menu mapping to ${meta.url}`,
  ],
  featuresAr: [
    `مساحة عمل مخصصة لـ ${meta.nameAr}`,
    'استقبال الويب هوك إلى طلب مطعم وتذكرة مطبخ',
    'قبول ورفض وتجهيز وإرسال الطلب',
    'تتبع السائق والعمولة والتسوية',
    `ربط القائمة مع ${meta.url}`,
  ],
  configSchema: [
    { key: 'apiKey', labelEn: 'API key', labelAr: 'مفتاح API', type: 'password', defaultValue: '' },
    { key: 'merchantId', labelEn: 'Merchant / branch ID', labelAr: 'معرف التاجر / الفرع', type: 'text', defaultValue: '' },
    { key: 'autoAcceptOrders', labelEn: 'Auto-accept incoming orders', labelAr: 'قبول الطلبات الواردة تلقائياً', type: 'boolean', defaultValue: false },
  ],
}))

export const LOGISTICS_PARTNER_APPS = Object.entries(courierMeta).map(([appId, meta]) => ({
  appId,
  nameEn: meta.nameEn,
  nameAr: meta.nameAr,
  taglineEn: meta.taglineEn,
  taglineAr: meta.taglineAr,
  descriptionEn: `${meta.nameEn} prints shipping labels, books pickups, and tracks last-mile status from ecommerce and wholesale orders.`,
  descriptionAr: `${meta.nameAr} يطبع بوالص الشحن ويحجز الالتقاط ويتتبع حالة التوصيل من طلبات المتجر والجملة.`,
  category: 'logistics',
  appType: 'automation_comm',
  icon: meta.icon,
  version: '1.0.0',
  downloadSize: '5.2 MB',
  author: 'Maqder Logistics',
  rating: 4.88,
  reviewsCount: 74,
  pricingTier: 'free',
  badge: 'Logistics',
  defaultRoute: `/app/dashboard/logistics?courier=${COURIER_APP_MAP[appId]}`,
  featuresEn: [
    'Create shipment / AWB from an order',
    'Print or download shipping label',
    'Live tracking events',
    'Cancel or void a booked shipment',
    'Cash-on-delivery amount on the waybill',
  ],
  featuresAr: [
    'إنشاء شحنة / بوليصة من الطلب',
    'طباعة أو تنزيل ملصق الشحن',
    'أحداث التتبع المباشرة',
    'إلغاء الشحنة المحجوزة',
    'مبلغ الدفع عند الاستلام على البوليصة',
  ],
  configSchema: [
    { key: 'environment', labelEn: 'Environment', labelAr: 'البيئة', type: 'select', defaultValue: 'sandbox', options: [{ value: 'sandbox', labelEn: 'Sandbox', labelAr: 'تجربة' }, { value: 'production', labelEn: 'Production', labelAr: 'إنتاج' }] },
    { key: 'accountNumber', labelEn: 'Account number', labelAr: 'رقم الحساب', type: 'text', defaultValue: '' },
    { key: 'apiKey', labelEn: 'API key', labelAr: 'مفتاح API', type: 'password', defaultValue: '' },
    { key: 'apiSecret', labelEn: 'API secret', labelAr: 'سر API', type: 'password', defaultValue: '' },
  ],
}))

export function isDeliveryPartnerApp(appId) {
  return appId === DELIVERY_HUB_APP_ID || Boolean(DELIVERY_PLATFORM_APP_MAP[appId])
}

export function isCourierPartnerApp(appId) {
  return appId === LOGISTICS_HUB_APP_ID || Boolean(COURIER_APP_MAP[appId])
}

export function tenantHasDeliveryAccess(tenant) {
  if (tenant?.subscription?.hasDeliveryAddon) return true
  const apps = tenant?.settings?.installedApps || {}
  return ALL_DELIVERY_APP_IDS.some((id) => apps[id]?.isInstalled && apps[id]?.isEnabled !== false)
}

export function tenantHasAnyDeliveryAppInstalled(tenant) {
  const apps = tenant?.settings?.installedApps || {}
  return ALL_DELIVERY_APP_IDS.some((id) => apps[id]?.isInstalled && apps[id]?.isEnabled !== false)
}
