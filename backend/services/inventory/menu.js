/**
 * Inventory v2 menu tree (canonical).
 * Flags map to InvSettings columns — see FLAG_MAP.
 */

export const FLAG_MAP = {
  multiLocations: 'groupStockMultiLocations',
  multiStepRoutes: 'groupAdvLocation',
  storageCategories: 'groupStockStorageCategories',
  putawayRules: 'groupPutawayRules',
  variants: 'groupProductVariant',
  lotSerial: (s) => s.groupProductionLot || s.groupStockTrackingLot,
  packages: (s) => s.groupStockPackaging || s.groupStockTrackingLot,
  uom: 'groupUom',
  productPackaging: 'groupStockPackaging',
  barcodeScanner: 'groupStockBarcode',
  deliveryMethods: 'groupDeliveryMethods',
  valuation: (s) => s.stockAccountingEnabled || s.groupLandedCosts,
  landedCosts: 'groupLandedCosts',
  pos: 'menuPos',
  manufacturing: 'menuManufacturing',
};

/** @type {import('../../frontend/src/pages/inventory/inventory.menu.js').InventoryMenuNode[]} */
export const INVENTORY_MENU_TREE = [
  {
    id: 'overview',
    label: 'Overview',
    labelAr: 'نظرة عامة',
    href: '/app/dashboard/inventory',
    end: true,
    permission: { module: 'inventory', action: 'read' },
  },
  {
    id: 'operations',
    label: 'Operations',
    labelAr: 'العمليات',
    permission: { module: 'inventory', action: 'read' },
    children: [
      { type: 'section', id: 'sec-transfers', label: 'Transfers', labelAr: 'التحويلات' },
      {
        id: 'receipts',
        label: 'Receipts',
        labelAr: 'الاستلامات',
        href: '/app/dashboard/inventory/receipts',
        permission: { module: 'inventory', action: 'read' },
      },
      {
        id: 'deliveries',
        label: 'Delivery Orders',
        labelAr: 'أوامر التسليم',
        href: '/app/dashboard/inventory/deliveries',
        permission: { module: 'inventory', action: 'read' },
      },
      {
        id: 'internal',
        label: 'Internal Transfers',
        labelAr: 'تحويلات داخلية',
        href: '/app/dashboard/inventory/internal',
        flag: 'multiLocations',
        permission: { module: 'inventory', action: 'read' },
      },
      {
        id: 'manufacturing',
        label: 'Manufacturings',
        labelAr: 'التصنيع',
        href: '/app/dashboard/manufacturing',
        flag: 'manufacturing',
        permission: { module: 'inventory', action: 'read' },
      },
      {
        id: 'pos-orders',
        label: 'PoS Orders',
        labelAr: 'طلبات نقطة البيع',
        href: '/app/dashboard/inventory/deliveries?isPos=1',
        flag: 'pos',
        permission: { module: 'inventory', action: 'read' },
      },
      {
        id: 'returns',
        label: 'Returns',
        labelAr: 'المرتجعات',
        href: '/app/dashboard/inventory/returns',
        permission: { module: 'inventory', action: 'read' },
      },
      { type: 'section', id: 'sec-adjustments', label: 'Adjustments', labelAr: 'التسويات' },
      {
        id: 'physical',
        label: 'Physical Inventory',
        labelAr: 'الجرد الفعلي',
        href: '/app/dashboard/inventory/physical',
        permission: { module: 'inventory', action: 'read' },
      },
      {
        id: 'scrap',
        label: 'Scrap',
        labelAr: 'خردة',
        href: '/app/dashboard/inventory/scrap',
        permission: { module: 'inventory', action: 'read' },
      },
      { type: 'section', id: 'sec-procurement', label: 'Procurement', labelAr: 'التوريد' },
      {
        id: 'replenishment',
        label: 'Replenishment',
        labelAr: 'إعادة التوريد',
        href: '/app/dashboard/inventory/replenishment',
        permission: { module: 'inventory', action: 'read' },
      },
      {
        id: 'references',
        label: 'References',
        labelAr: 'المراجع',
        href: '/app/dashboard/inventory/references',
        permission: { module: 'inventory', action: 'read' },
      },
      {
        id: 'run-scheduler',
        label: 'Procurement: Run Scheduler',
        labelAr: 'تشغيل المجدول',
        action: 'runScheduler',
        permission: { module: 'inventory', action: 'update' },
      },
    ],
  },
  {
    id: 'products',
    label: 'Products',
    labelAr: 'المنتجات',
    permission: { module: 'inventory', action: 'read' },
    children: [
      {
        id: 'products-list',
        label: 'Products',
        labelAr: 'المنتجات',
        href: '/app/dashboard/inventory/products',
        permission: { module: 'inventory', action: 'read' },
      },
      {
        id: 'variants',
        label: 'Product Variants',
        labelAr: 'متغيرات المنتج',
        href: '/app/dashboard/inventory/variants',
        flag: 'variants',
        permission: { module: 'inventory', action: 'read' },
      },
      {
        id: 'lots',
        label: 'Lots / Serial Numbers',
        labelAr: 'دفعات / أرقام تسلسلية',
        href: '/app/dashboard/inventory/lots',
        permission: { module: 'inventory', action: 'read' },
      },
      {
        id: 'packages',
        label: 'Packages',
        labelAr: 'الطرود',
        href: '/app/dashboard/inventory/packages',
        flag: 'packages',
        permission: { module: 'inventory', action: 'read' },
      },
    ],
  },
  {
    id: 'reporting',
    label: 'Reporting',
    labelAr: 'التقارير',
    permission: { module: 'inventory', action: 'read' },
    children: [
      {
        id: 'stock',
        label: 'Stock',
        labelAr: 'المخزون',
        href: '/app/dashboard/inventory/stock',
        permission: { module: 'inventory', action: 'read' },
      },
      {
        id: 'report-locations',
        label: 'Locations',
        labelAr: 'المواقع',
        href: '/app/dashboard/inventory/report/locations',
        flag: 'multiLocations',
        permission: { module: 'inventory', action: 'read' },
      },
      {
        id: 'moves',
        label: 'Moves History',
        labelAr: 'سجل الحركات',
        href: '/app/dashboard/inventory/moves',
        permission: { module: 'inventory', action: 'read' },
      },
      {
        id: 'moves-analysis',
        label: 'Moves Analysis',
        labelAr: 'تحليل الحركات',
        href: '/app/dashboard/inventory/moves-analysis',
        permission: { module: 'inventory', action: 'read' },
      },
      {
        id: 'performance',
        label: 'Performance',
        labelAr: 'الأداء',
        href: '/app/dashboard/inventory/performance',
        permission: { module: 'inventory', action: 'read' },
      },
      {
        id: 'forecast',
        label: 'Forecast',
        labelAr: 'التوقع',
        href: '/app/dashboard/inventory/forecast',
        permission: { module: 'inventory', action: 'read' },
      },
      {
        id: 'valuation',
        label: 'Valuation',
        labelAr: 'التقييم',
        href: '/app/dashboard/inventory/valuation',
        flag: 'valuation',
        permission: { module: 'inventory', action: 'read' },
      },
      {
        id: 'report-reconcile',
        label: 'Reconcile',
        labelAr: 'المطابقة',
        href: '/app/dashboard/inventory/report/reconcile',
        permission: { module: 'inventory', action: 'read' },
      },
      {
        id: 'reports-hub',
        label: 'Reports hub',
        labelAr: 'مركز التقارير',
        href: '/app/dashboard/inventory/reports',
        permission: { module: 'inventory', action: 'read' },
      },
    ],
  },
  {
    id: 'configuration',
    label: 'Configuration',
    labelAr: 'الإعدادات',
    permission: { module: 'inventory', action: 'read' },
    children: [
      {
        id: 'settings',
        label: 'Settings',
        labelAr: 'الإعدادات',
        href: '/app/dashboard/inventory/settings',
        permission: { module: 'inventory', action: 'update' },
      },
      { type: 'section', id: 'sec-wh', label: 'Warehouse Management', labelAr: 'إدارة المستودعات' },
      {
        id: 'warehouses',
        label: 'Warehouses',
        labelAr: 'المستودعات',
        href: '/app/dashboard/inventory/warehouses',
        permission: { module: 'inventory', action: 'read' },
      },
      {
        id: 'operation-types',
        label: 'Operations Types',
        labelAr: 'أنواع العمليات',
        href: '/app/dashboard/inventory/operation-types',
        permission: { module: 'inventory', action: 'read' },
      },
      {
        id: 'locations',
        label: 'Locations',
        labelAr: 'المواقع',
        href: '/app/dashboard/inventory/locations',
        flag: 'multiLocations',
        permission: { module: 'inventory', action: 'read' },
      },
      {
        id: 'rules',
        label: 'Rules',
        labelAr: 'القواعد',
        href: '/app/dashboard/inventory/rules',
        flag: 'multiStepRoutes',
        permission: { module: 'inventory', action: 'read' },
      },
      {
        id: 'routes',
        label: 'Routes',
        labelAr: 'المسارات',
        href: '/app/dashboard/inventory/routes',
        flag: 'multiStepRoutes',
        permission: { module: 'inventory', action: 'read' },
      },
      {
        id: 'putaway',
        label: 'Putaway Rules',
        labelAr: 'قواعد التخزين',
        href: '/app/dashboard/inventory/putaway',
        flag: 'putawayRules',
        permission: { module: 'inventory', action: 'read' },
      },
      {
        id: 'storage-categories',
        label: 'Storage Categories',
        labelAr: 'فئات التخزين',
        href: '/app/dashboard/inventory/storage-categories',
        flag: 'storageCategories',
        permission: { module: 'inventory', action: 'read' },
      },
      {
        id: 'reordering-rules',
        label: 'Reordering Rules',
        labelAr: 'قواعد إعادة الطلب',
        href: '/app/dashboard/inventory/reordering-rules',
        permission: { module: 'inventory', action: 'read' },
      },
      { type: 'section', id: 'sec-products', label: 'Products', labelAr: 'المنتجات' },
      {
        id: 'product-categories',
        label: 'Product Categories',
        labelAr: 'فئات المنتجات',
        href: '/app/dashboard/inventory/product-categories',
        permission: { module: 'inventory', action: 'read' },
      },
      {
        id: 'attributes',
        label: 'Attributes',
        labelAr: 'السمات',
        href: '/app/dashboard/inventory/attributes',
        flag: 'variants',
        permission: { module: 'inventory', action: 'read' },
      },
      {
        id: 'uom',
        label: 'Units & Packagings',
        labelAr: 'الوحدات والتعبئة',
        href: '/app/dashboard/inventory/uom',
        flag: 'uom',
        permission: { module: 'inventory', action: 'read' },
      },
      {
        id: 'barcode',
        label: 'Barcode Nomenclatures',
        labelAr: 'تسمية الباركود',
        href: '/app/dashboard/inventory/barcode',
        permission: { module: 'inventory', action: 'read' },
      },
      { type: 'section', id: 'sec-delivery', label: 'Delivery', labelAr: 'التسليم' },
      {
        id: 'delivery-methods',
        label: 'Delivery Methods',
        labelAr: 'طرق التسليم',
        href: '/app/dashboard/inventory/delivery-methods',
        flag: 'deliveryMethods',
        permission: { module: 'inventory', action: 'read' },
      },
      {
        id: 'shipping-connectors',
        label: 'Shipping Connectors',
        labelAr: 'موصلات الشحن',
        href: '/app/dashboard/inventory/shipping-connectors',
        flag: 'deliveryMethods',
        permission: { module: 'inventory', action: 'read' },
      },
      {
        id: 'landed-costs',
        label: 'Landed Costs',
        labelAr: 'التكاليف الإضافية',
        href: '/app/dashboard/inventory/landed-costs',
        flag: 'landedCosts',
        permission: { module: 'inventory', action: 'read' },
      },
      {
        id: 'import-export',
        label: 'Import / Export',
        labelAr: 'استيراد / تصدير',
        href: '/app/dashboard/inventory/import-export',
        permission: { module: 'inventory', action: 'update' },
      },
    ],
  },
];

/** Resolve flag against InvSettings (respect explicit false; defaults when missing). */
export function isMenuFlagOn(settings, flagKey) {
  if (!flagKey) return true;
  const s = settings || {};
  const mapped = FLAG_MAP[flagKey];
  if (typeof mapped === 'function') return Boolean(mapped(s));
  if (typeof mapped !== 'string') return true;
  if (Object.prototype.hasOwnProperty.call(s, mapped) && s[mapped] != null) {
    return Boolean(s[mapped]);
  }
  const defaultsOn = new Set([
    'groupStockMultiLocations',
    'groupAdvLocation',
    'groupPutawayRules',
    'groupUom',
    'groupLandedCosts',
    'stockAccountingEnabled',
  ]);
  return defaultsOn.has(mapped);
}

function hasPermission(user, perm) {
  if (!perm) return true;
  if (!user) return false;
  if (user.role === 'super_admin' || user.role === 'admin') return true;
  const row = Array.isArray(user.permissions)
    ? user.permissions.find((p) => p?.module === perm.module)
    : null;
  const actions = Array.isArray(row?.actions) ? row.actions : [];
  return actions.includes(perm.action);
}

function filterNode(node, settings, user) {
  if (node.type === 'section') return { ...node };
  if (node.permission && !hasPermission(user, node.permission)) return null;
  if (node.flag && !isMenuFlagOn(settings, node.flag)) return null;
  if (node.children) {
    const children = [];
    for (const child of node.children) {
      const next = filterNode(child, settings, user);
      if (next) children.push(next);
    }
    // Drop orphan section headers (no following items until next section)
    const cleaned = [];
    for (let i = 0; i < children.length; i += 1) {
      const c = children[i];
      if (c.type === 'section') {
        const hasItem = children.slice(i + 1).some((x) => x.type !== 'section');
        if (!hasItem) continue;
        const nextSection = children.slice(i + 1).findIndex((x) => x.type === 'section');
        const slice = nextSection === -1 ? children.slice(i + 1) : children.slice(i + 1, i + 1 + nextSection);
        if (!slice.some((x) => x.type !== 'section')) continue;
      }
      cleaned.push(c);
    }
    if (!cleaned.length && !node.href && !node.action) return null;
    return { ...node, children: cleaned };
  }
  return { ...node };
}

export function filterInventoryMenu(settings, user) {
  return INVENTORY_MENU_TREE.map((n) => filterNode(n, settings, user)).filter(Boolean);
}
