/**
 * v4.1 ExportField helper + product registry.
 * Fields that do not exist on Product yet are listed in PRODUCT_EXCLUDED_FROM_EXPORT
 * (CI must pass: every Product path is registered or excluded with a reason).
 */

/** @typedef {'string'|'number'|'decimal'|'boolean'|'date'|'datetime'|'enum'|'m2o'|'m2m'|'html'} IeFieldType */
/** @typedef {'Identity'|'General'|'Behaviour'|'Sales'|'Purchase'|'Inventory'|'Accounting'|'Computed'} IeGroup */

/**
 * @param {object} p
 * @returns {import('./ieRegistry.js').ExportField}
 */
export function f(p) {
  return {
    key: p.key,
    label: p.label,
    labelAr: p.labelAr || p.label,
    group: p.group || 'General',
    type: p.type || 'string',
    relation: p.relation,
    importable: p.importable !== false,
    required: !!p.required,
    unique: !!p.unique,
    enumValues: p.enumValues,
    example: p.example,
    help: p.help,
    permission: p.permission,
  };
}

/** Product fields present on the model or safely derived for export/import. */
export const PRODUCT_IE_FIELDS = [
  // Identity
  f({ key: 'id', label: 'id', labelAr: 'المعرف', group: 'Identity', type: 'string', unique: true, example: '64f…' }),
  f({ key: 'productId', label: 'Product ID', labelAr: 'رمز المنتج', group: 'Identity', type: 'string', unique: true, example: 'P00007' }),
  f({ key: 'external_ref', label: 'External Ref', labelAr: 'مرجع خارجي', group: 'Identity', type: 'string', unique: true }),
  f({ key: 'sku', label: 'SKU', labelAr: 'SKU', group: 'Identity', type: 'string', required: true, unique: true, example: 'TEE-RED-M' }),
  f({ key: 'barcode', label: 'Barcode', labelAr: 'باركود', group: 'Identity', type: 'string', unique: true }),
  f({ key: 'active', label: 'Active', labelAr: 'نشط', group: 'Identity', type: 'boolean', example: 'TRUE' }),
  f({ key: 'createdAt', label: 'Created At', labelAr: 'تاريخ الإنشاء', group: 'Identity', type: 'datetime', importable: false }),
  f({ key: 'updatedAt', label: 'Updated At', labelAr: 'تاريخ التحديث', group: 'Identity', type: 'datetime', importable: false }),
  f({ key: 'createdBy', label: 'Created By', labelAr: 'أنشئ بواسطة', group: 'Identity', type: 'string', importable: false }),

  // General
  f({ key: 'name_en', label: 'Name (EN)', labelAr: 'الاسم إنجليزي', group: 'General', type: 'string', required: true, example: 'Audit Tee' }),
  f({ key: 'name_ar', label: 'Name (AR)', labelAr: 'الاسم عربي', group: 'General', type: 'string', example: 'تيشيرت' }),
  f({ key: 'description_en', label: 'Description (EN)', labelAr: 'الوصف إنجليزي', group: 'General', type: 'html' }),
  f({ key: 'description_ar', label: 'Description (AR)', labelAr: 'الوصف عربي', group: 'General', type: 'html' }),
  f({ key: 'internalNotes', label: 'Internal Notes', labelAr: 'ملاحظات داخلية', group: 'General', type: 'string' }),
  f({
    key: 'productType',
    label: 'Product Type',
    labelAr: 'نوع المنتج',
    group: 'General',
    type: 'enum',
    required: true,
    enumValues: ['goods', 'service'],
    example: 'goods',
  }),
  f({ key: 'trackInventory', label: 'Track Inventory', labelAr: 'تتبع المخزون', group: 'General', type: 'boolean' }),
  f({
    key: 'category',
    label: 'Category',
    labelAr: 'التصنيف',
    group: 'General',
    type: 'm2o',
    relation: 'category',
    required: true,
  }),
  f({ key: 'category_id', label: 'Category ID', labelAr: 'معرّف التصنيف', group: 'General', type: 'string' }),
  f({ key: 'category.completeName', label: 'Category Path', labelAr: 'مسار التصنيف', group: 'General', type: 'string', importable: false }),
  f({ key: 'tags', label: 'Tags', labelAr: 'وسوم', group: 'General', type: 'm2m', example: 'Ramadan,Gift' }),
  f({ key: 'imageUrl', label: 'Primary Image URL', labelAr: 'صورة رئيسية', group: 'General', type: 'string', importable: false }),
  f({ key: 'imageCount', label: 'Image Count', labelAr: 'عدد الصور', group: 'General', type: 'number', importable: false }),

  // Behaviour
  f({ key: 'canBeSold', label: 'Can Be Sold', labelAr: 'قابل للبيع', group: 'Behaviour', type: 'boolean' }),
  f({ key: 'canBePurchased', label: 'Can Be Purchased', labelAr: 'قابل للشراء', group: 'Behaviour', type: 'boolean' }),
  f({ key: 'canBeExpensed', label: 'Can Be Expensed', labelAr: 'مصروف', group: 'Behaviour', type: 'boolean' }),
  f({ key: 'availableInPos', label: 'Available in POS', labelAr: 'متاح في نقطة البيع', group: 'Behaviour', type: 'boolean' }),

  // Sales
  f({ key: 'salesPrice', label: 'Sales Price', labelAr: 'سعر البيع', group: 'Sales', type: 'decimal', example: '50.00' }),
  f({ key: 'taxRate', label: 'Tax Rate %', labelAr: 'نسبة الضريبة', group: 'Sales', type: 'number', example: '15' }),
  f({ key: 'salesDescription', label: 'Sales Description', labelAr: 'وصف المبيعات', group: 'Sales', type: 'string' }),
  f({ key: 'minSaleQty', label: 'Min Sale Qty', labelAr: 'حد أدنى للبيع', group: 'Sales', type: 'decimal' }),
  f({ key: 'saleMultiple', label: 'Sale Multiple', labelAr: 'مضاعف البيع', group: 'Sales', type: 'decimal' }),
  f({
    key: 'invoicePolicy',
    label: 'Invoicing Policy',
    labelAr: 'سياسة الفوترة',
    group: 'Sales',
    type: 'enum',
    enumValues: ['ordered', 'delivered'],
  }),
  f({ key: 'accessories', label: 'Accessories', labelAr: 'ملحقات', group: 'Sales', type: 'm2m', importable: false }),
  f({ key: 'upsells', label: 'Upsells', labelAr: 'ترقية', group: 'Sales', type: 'm2m', importable: false }),
  f({ key: 'crossSells', label: 'Cross-sells', labelAr: 'بيع متقاطع', group: 'Sales', type: 'm2m', importable: false }),
  f({ key: 'optionals', label: 'Optionals', labelAr: 'اختياري', group: 'Sales', type: 'm2m', importable: false }),
  f({ key: 'substitutes', label: 'Substitutes', labelAr: 'بدائل', group: 'Sales', type: 'm2m', importable: false }),

  // Purchase
  f({ key: 'cost', label: 'Cost', labelAr: 'التكلفة', group: 'Purchase', type: 'decimal', permission: 'inventory.cost', example: '20.00' }),
  f({ key: 'purchaseUom', label: 'Purchase UoM', labelAr: 'وحدة الشراء', group: 'Purchase', type: 'string' }),
  f({ key: 'purchaseDescription', label: 'Purchase Description', labelAr: 'وصف الشراء', group: 'Purchase', type: 'string' }),
  f({
    key: 'controlPolicy',
    label: 'Control Policy',
    labelAr: 'سياسة الرقابة',
    group: 'Purchase',
    type: 'enum',
    enumValues: ['ordered', 'received'],
  }),
  f({ key: 'daysToPurchase', label: 'Days to Purchase', labelAr: 'أيام الشراء', group: 'Purchase', type: 'number' }),
  f({ key: 'hsCode', label: 'HS Code', labelAr: 'رمز HS', group: 'Purchase', type: 'string', example: '6109.10' }),
  f({ key: 'countryOfOrigin', label: 'Country of Origin', labelAr: 'بلد المنشأ', group: 'Purchase', type: 'string', example: 'SA' }),
  f({ key: 'vendor.primary.name', label: 'Primary Vendor', labelAr: 'المورد الرئيسي', group: 'Purchase', type: 'string', importable: false }),
  f({ key: 'vendor.primary.code', label: 'Primary Vendor Code', labelAr: 'رمز المورد', group: 'Purchase', type: 'string', importable: false }),
  f({ key: 'vendor.primary.price', label: 'Primary Vendor Price', labelAr: 'سعر المورد', group: 'Purchase', type: 'decimal', importable: false, permission: 'inventory.cost' }),
  f({ key: 'vendor.primary.minQty', label: 'Primary Vendor Min Qty', labelAr: 'حد أدنى للمورد', group: 'Purchase', type: 'decimal', importable: false }),
  f({ key: 'vendor.primary.leadDays', label: 'Primary Vendor Lead Days', labelAr: 'مهلة المورد', group: 'Purchase', type: 'number', importable: false }),
  f({ key: 'vendorCount', label: 'Vendor Count', labelAr: 'عدد الموردين', group: 'Purchase', type: 'number', importable: false }),

  // Inventory
  f({ key: 'uom', label: 'UoM', labelAr: 'وحدة القياس', group: 'Inventory', type: 'string', required: true, example: 'PCE' }),
  f({
    key: 'tracking',
    label: 'Tracking',
    labelAr: 'التتبع',
    group: 'Inventory',
    type: 'enum',
    enumValues: ['none', 'lot', 'serial'],
  }),
  f({ key: 'useExpiration', label: 'Use Expiration', labelAr: 'صلاحية', group: 'Inventory', type: 'boolean' }),
  f({ key: 'shelfLifeDays', label: 'Shelf Life Days', labelAr: 'أيام الصلاحية', group: 'Inventory', type: 'number' }),
  f({ key: 'alertDays', label: 'Alert Days', labelAr: 'أيام التنبيه', group: 'Inventory', type: 'number' }),
  f({ key: 'removalDays', label: 'Removal Days', labelAr: 'أيام الإزالة', group: 'Inventory', type: 'number' }),
  f({ key: 'useByDays', label: 'Use-By Days', labelAr: 'أيام الاستخدام', group: 'Inventory', type: 'number' }),
  f({ key: 'weight', label: 'Weight', labelAr: 'الوزن', group: 'Inventory', type: 'number' }),
  f({ key: 'volume', label: 'Volume', labelAr: 'الحجم', group: 'Inventory', type: 'number' }),
  f({ key: 'negativeStockAllowed', label: 'Negative Stock Allowed', labelAr: 'سماح بالسالب', group: 'Inventory', type: 'boolean' }),

  // Accounting
  f({ key: 'incomeAccount', label: 'Income Account', labelAr: 'حساب الإيراد', group: 'Accounting', type: 'string' }),
  f({ key: 'expenseAccount', label: 'Expense Account', labelAr: 'حساب المصروف', group: 'Accounting', type: 'string' }),
  f({ key: 'valuationAccount', label: 'Valuation Account', labelAr: 'حساب التقييم', group: 'Accounting', type: 'string' }),
  f({ key: 'costingMethod', label: 'Costing Method', labelAr: 'طريقة التكلفة', group: 'Accounting', type: 'string', importable: false }),
  f({ key: 'valuationMode', label: 'Valuation Mode', labelAr: 'وضع التقييم', group: 'Accounting', type: 'string', importable: false }),

  // Computed
  f({ key: 'onHand', label: 'On Hand', labelAr: 'الرصيد', group: 'Computed', type: 'decimal', importable: false }),
  f({ key: 'freeToUse', label: 'Free to Use', labelAr: 'المتاح', group: 'Computed', type: 'decimal', importable: false }),
  f({ key: 'reserved', label: 'Reserved', labelAr: 'محجوز', group: 'Computed', type: 'decimal', importable: false }),
  f({ key: 'forecasted', label: 'Forecasted', labelAr: 'المتوقع', group: 'Computed', type: 'decimal', importable: false }),
  f({ key: 'inventoryValue', label: 'Inventory Value', labelAr: 'قيمة المخزون', group: 'Computed', type: 'decimal', importable: false, permission: 'inventory.cost' }),
  f({ key: 'avgCost', label: 'Avg Cost', labelAr: 'متوسط التكلفة', group: 'Computed', type: 'decimal', importable: false, permission: 'inventory.cost' }),
  f({ key: 'variantCount', label: 'Variant Count', labelAr: 'عدد المتغيرات', group: 'Computed', type: 'number', importable: false }),
];

/**
 * §1.1 fields not on Product (or not yet implemented as columns).
 * CI: every excluded key must have a reason.
 */
export const PRODUCT_EXCLUDED_FROM_EXPORT = [
  { key: 'barcodes[]', reason: 'Multi-barcode table not on Product yet — only primary barcode' },
  { key: 'company', reason: 'Multi-company not scoped on Product' },
  { key: 'responsible', reason: 'Responsible user field not on Product' },
  { key: 'standardPrice', reason: 'Alias of cost/costPrice — use cost' },
  { key: 'uomCategory', reason: 'Derived via InvUom — not denormalized on Product' },
  { key: 'routes[]', reason: 'routeIds ObjectIds — export as codes deferred' },
  { key: 'removalStrategy', reason: 'Lives on category/location, not Product' },
  { key: 'packagings[]', reason: 'InvProductPackaging — separate model export' },
  { key: 'descriptionPicking', reason: 'Not on Product schema yet' },
  { key: 'descriptionPickingIn', reason: 'Not on Product schema yet' },
  { key: 'descriptionPickingOut', reason: 'Not on Product schema yet' },
  { key: 'abcClass', reason: 'Not on Product schema yet' },
  { key: 'priceDifferenceAccount', reason: 'Not on Product schema yet' },
  { key: 'incoming', reason: 'Computed via forecast — enrich pass deferred for sync export' },
  { key: 'outgoing', reason: 'Computed via forecast — enrich pass deferred for sync export' },
  { key: 'lastPurchasePrice', reason: 'Requires move aggregation job' },
  { key: 'lastPurchaseDate', reason: 'Requires move aggregation job' },
  { key: 'lastSaleDate', reason: 'Requires invoice aggregation job' },
  { key: 'salesQty30d', reason: 'Requires invoice aggregation job' },
  { key: 'salesQty90d', reason: 'Requires invoice aggregation job' },
  { key: 'daysOfStock', reason: 'Requires aggregation job' },
  { key: 'lotCount', reason: 'Requires InvLot count enrich' },
  { key: 'moveCount', reason: 'Requires InvMove count enrich' },
  { key: 'reorderingRuleCount', reason: 'Requires InvReorderRule count enrich' },
  { key: 'stockByWarehouse', reason: 'Dynamic columns — phase 2 of export enrich' },
];

export const PRODUCT_SYSTEM_TEMPLATES = [
  {
    name: 'Price list update',
    nameAr: 'تحديث قائمة الأسعار',
    fields: ['id', 'productId', 'sku', 'name_en', 'salesPrice', 'cost', 'taxRate'],
    format: 'xlsx',
    updateMode: true,
    isSystem: true,
  },
  {
    name: 'Opening stock',
    nameAr: 'مخزون افتتاحي',
    fields: ['sku', 'name_en', 'uom', 'cost'],
    format: 'xlsx',
    updateMode: false,
    isSystem: true,
  },
  {
    name: 'Barcode labels',
    nameAr: 'ملصقات الباركود',
    fields: ['sku', 'name_en', 'name_ar', 'barcode', 'salesPrice'],
    format: 'xlsx',
    updateMode: false,
    isSystem: true,
  },
  {
    name: 'Full catalogue',
    nameAr: 'كتالوج كامل',
    fields: PRODUCT_IE_FIELDS
      .filter((x) => ['General', 'Sales', 'Purchase', 'Inventory', 'Behaviour'].includes(x.group) && x.importable !== false)
      .map((x) => x.key),
    format: 'xlsx',
    updateMode: true,
    isSystem: true,
  },
];
