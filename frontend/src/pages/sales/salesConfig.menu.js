/** Sales configuration hub navigation */

export const SALES_CONFIG_SECTIONS = [
  { id: 'settings', href: '/app/dashboard/sales/configuration/settings', label: 'Settings', labelAr: 'الإعدادات' },
  { id: 'teams', href: '/app/dashboard/sales/configuration/teams', label: 'Sales Teams', labelAr: 'فرق المبيعات' },
  { id: 'products', href: '/app/dashboard/inventory/products', label: 'Products', labelAr: 'المنتجات', external: true },
  { id: 'attributes', href: '/app/dashboard/inventory/attributes', label: 'Attributes', labelAr: 'السمات', external: true },
  { id: 'categories', href: '/app/dashboard/inventory/product-categories', label: 'Categories', labelAr: 'التصنيفات', external: true },
  { id: 'uom', href: '/app/dashboard/inventory/uom', label: 'Units', labelAr: 'الوحدات', external: true },
  { id: 'packagings', href: '/app/dashboard/inventory/product-packagings', label: 'Packagings', labelAr: 'التعبئة', external: true },
  { id: 'tags', href: '/app/dashboard/sales/configuration/tags', label: 'Product Tags', labelAr: 'وسوم المنتجات' },
  { id: 'combos', href: '/app/dashboard/restaurant/combos', label: 'Combo Choices', labelAr: 'اختيارات الكومبو', external: true, requireRestaurant: true },
  { id: 'activity-types', href: '/app/dashboard/sales/configuration/activity-types', label: 'Activity Types', labelAr: 'أنواع النشاط' },
  { id: 'activity-plans', href: '/app/dashboard/sales/configuration/activity-plans', label: 'Activity Plans', labelAr: 'خطط النشاط' },
  { id: 'pricelists', href: '/app/dashboard/sales/configuration/pricelists', label: 'Pricelists', labelAr: 'قوائم الأسعار' },
  { id: 'promotions', href: '/app/dashboard/sales/configuration/promotions', label: 'Promotions', labelAr: 'العروض' },
  { id: 'quotation-templates', href: '/app/dashboard/sales/configuration/quotation-templates', label: 'Quote Templates', labelAr: 'قوالب العروض' },
  { id: 'payment-providers', href: '/app/dashboard/sales/configuration/payment-providers', label: 'Payment Providers', labelAr: 'مزودو الدفع' },
  { id: 'payment-methods', href: '/app/dashboard/sales/configuration/payment-methods', label: 'Payment Methods', labelAr: 'طرق الدفع' },
  { id: 'payment-transactions', href: '/app/dashboard/sales/configuration/payment-transactions', label: 'Transactions', labelAr: 'المعاملات' },
  { id: 'carrier-connectors', href: '/app/dashboard/sales/configuration/carrier-connectors', label: 'Shipping Connectors', labelAr: 'موصلات الشحن' },
]

export const SALES_REPORT_SECTIONS = [
  { id: 'overview', href: '/app/dashboard/sales/reporting', label: 'Overview', labelAr: 'نظرة عامة' },
  { id: 'analysis', href: '/app/dashboard/sales/reporting/analysis', label: 'Sales Analysis', labelAr: 'تحليل المبيعات' },
  { id: 'matrix', href: '/app/dashboard/sales/reporting/matrix', label: 'Matrix', labelAr: 'مصفوفة' },
  { id: 'salespeople', href: '/app/dashboard/sales/reporting/salespeople', label: 'Salespeople', labelAr: 'مندوبي المبيعات' },
  { id: 'products', href: '/app/dashboard/sales/reporting/products', label: 'Products', labelAr: 'المنتجات' },
  { id: 'customers', href: '/app/dashboard/sales/reporting/customers', label: 'Customers', labelAr: 'العملاء' },
]

export const INCOTERMS = ['EXW', 'FCA', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP', 'FAS', 'FOB', 'CFR', 'CIF']

export const SALES_TEAM_TYPES = [
  { id: 'field', labelEn: 'Field sales', labelAr: 'مبيعات ميدانية' },
  { id: 'pos', labelEn: 'POS sales', labelAr: 'نقطة بيع' },
  { id: 'kiosk', labelEn: 'Kiosk sales', labelAr: 'كiosk' },
  { id: 'ecommerce', labelEn: 'E-commerce', labelAr: 'تجارة إلكترونية' },
  { id: 'other', labelEn: 'Other', labelAr: 'أخرى' },
]
