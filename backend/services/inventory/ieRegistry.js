/**
 * Field registries for universal inventory Import / Export.
 * `importable: false` → export-only (ledger / derived data).
 */

/** @typedef {{ key: string, label: string, importable?: boolean, relation?: { model: string, fields: { key: string, label: string }[] } }} IeField */

/** @type {Record<string, { label: string, importable: boolean, fields: IeField[], defaultExport: string[] }>} */
export const IE_MODELS = {
  products: {
    label: 'Products',
    importable: true,
    defaultExport: ['sku', 'barcode', 'nameEn', 'nameAr', 'costPrice', 'salePrice', 'tracking', 'unitOfMeasure'],
    fields: [
      { key: 'id', label: 'id', importable: true },
      { key: 'external_ref', label: 'external_ref', importable: true },
      { key: 'sku', label: 'SKU', importable: true },
      { key: 'barcode', label: 'Barcode', importable: true },
      { key: 'nameEn', label: 'Name (EN)', importable: true },
      { key: 'nameAr', label: 'Name (AR)', importable: true },
      { key: 'costPrice', label: 'Cost', importable: true },
      { key: 'salePrice', label: 'Sales Price', importable: true },
      { key: 'tracking', label: 'Tracking', importable: true },
      { key: 'unitOfMeasure', label: 'UoM', importable: true },
      { key: 'canBeSold', label: 'Can Be Sold', importable: true },
      { key: 'canBePurchased', label: 'Can Be Purchased', importable: true },
      {
        key: 'category',
        label: 'Category',
        importable: true,
        relation: { model: 'category', fields: [{ key: 'name', label: 'Name' }] },
      },
    ],
  },
  warehouses: {
    label: 'Warehouses',
    importable: true,
    defaultExport: ['code', 'nameEn', 'nameAr', 'active'],
    fields: [
      { key: 'id', label: 'id', importable: true },
      { key: 'external_ref', label: 'external_ref', importable: true },
      { key: 'code', label: 'Short Name', importable: true },
      { key: 'nameEn', label: 'Name (EN)', importable: true },
      { key: 'nameAr', label: 'Name (AR)', importable: true },
      { key: 'active', label: 'Active', importable: true },
      { key: 'receptionSteps', label: 'Reception Steps', importable: true },
      { key: 'deliverySteps', label: 'Delivery Steps', importable: true },
      { key: 'address.city', label: 'City', importable: true },
      { key: 'address.country', label: 'Country', importable: true },
    ],
  },
  locations: {
    label: 'Locations',
    importable: true,
    defaultExport: ['completePath', 'name', 'usage', 'barcode', 'active'],
    fields: [
      { key: 'id', label: 'id', importable: true },
      { key: 'external_ref', label: 'external_ref', importable: true },
      { key: 'name', label: 'Name', importable: true },
      { key: 'nameAr', label: 'Name (AR)', importable: true },
      { key: 'completePath', label: 'Complete Name', importable: true },
      { key: 'usage', label: 'Usage', importable: true },
      { key: 'barcode', label: 'Barcode', importable: true },
      { key: 'active', label: 'Active', importable: true },
      {
        key: 'warehouse',
        label: 'Warehouse',
        importable: true,
        relation: {
          model: 'warehouse',
          fields: [
            { key: 'code', label: 'Short Name' },
            { key: 'nameEn', label: 'Name' },
          ],
        },
      },
    ],
  },
  product_categories: {
    label: 'Product Categories',
    importable: true,
    defaultExport: ['name', 'completePath', 'parentPath'],
    fields: [
      { key: 'id', label: 'id', importable: true },
      { key: 'external_ref', label: 'external_ref', importable: true },
      { key: 'name', label: 'Name', importable: true },
      { key: 'completePath', label: 'Complete Name', importable: true },
      { key: 'parentPath', label: 'Parent Path', importable: true },
    ],
  },
  operation_types: {
    label: 'Operation Types',
    importable: true,
    defaultExport: ['name', 'code', 'sequenceCode', 'type'],
    fields: [
      { key: 'id', label: 'id', importable: true },
      { key: 'name', label: 'Name', importable: true },
      { key: 'code', label: 'Code', importable: true },
      { key: 'sequenceCode', label: 'Sequence Code', importable: true },
      { key: 'type', label: 'Type', importable: true },
      {
        key: 'warehouse',
        label: 'Warehouse',
        importable: true,
        relation: { model: 'warehouse', fields: [{ key: 'code', label: 'Short Name' }] },
      },
    ],
  },
  lots: {
    label: 'Lots / Serial Numbers',
    importable: true,
    defaultExport: ['name', 'product_sku', 'expirationDate', 'removalDate'],
    fields: [
      { key: 'id', label: 'id', importable: true },
      { key: 'external_ref', label: 'external_ref', importable: true },
      { key: 'name', label: 'Lot/Serial', importable: true },
      { key: 'product_sku', label: 'Product SKU', importable: true },
      { key: 'expirationDate', label: 'Expiration Date', importable: true },
      { key: 'removalDate', label: 'Removal Date', importable: true },
    ],
  },
  packages: {
    label: 'Packages',
    importable: true,
    defaultExport: ['name', 'packageType', 'location_path'],
    fields: [
      { key: 'id', label: 'id', importable: true },
      { key: 'name', label: 'Package', importable: true },
      { key: 'packageType', label: 'Package Type', importable: true },
      { key: 'location_path', label: 'Location', importable: true },
    ],
  },
  reorder_rules: {
    label: 'Reordering Rules',
    importable: true,
    defaultExport: ['product_sku', 'location_path', 'minQty', 'maxQty', 'qtyMultiple', 'trigger', 'active'],
    fields: [
      { key: 'id', label: 'id', importable: true },
      { key: 'product_sku', label: 'Product SKU', importable: true },
      { key: 'location_path', label: 'Location', importable: true },
      { key: 'minQty', label: 'Min Qty', importable: true },
      { key: 'maxQty', label: 'Max Qty', importable: true },
      { key: 'qtyMultiple', label: 'Multiple', importable: true },
      { key: 'trigger', label: 'Trigger', importable: true },
      { key: 'active', label: 'Active', importable: true },
    ],
  },
  putaway_rules: {
    label: 'Putaway Rules',
    importable: true,
    defaultExport: ['product_sku', 'location_path', 'storageCategory', 'active'],
    fields: [
      { key: 'id', label: 'id', importable: true },
      { key: 'product_sku', label: 'Product SKU', importable: true },
      { key: 'location_path', label: 'Location', importable: true },
      { key: 'storageCategory', label: 'Storage Category', importable: true },
      { key: 'active', label: 'Active', importable: true },
    ],
  },
  routes: {
    label: 'Routes',
    importable: true,
    defaultExport: ['name', 'active', 'productSelectable', 'warehouseSelectable'],
    fields: [
      { key: 'id', label: 'id', importable: true },
      { key: 'name', label: 'Name', importable: true },
      { key: 'active', label: 'Active', importable: true },
      { key: 'productSelectable', label: 'Product Selectable', importable: true },
      { key: 'warehouseSelectable', label: 'Warehouse Selectable', importable: true },
    ],
  },
  rules: {
    label: 'Rules',
    importable: true,
    defaultExport: ['name', 'action', 'location_src', 'location_dest', 'active'],
    fields: [
      { key: 'id', label: 'id', importable: true },
      { key: 'name', label: 'Name', importable: true },
      { key: 'action', label: 'Action', importable: true },
      { key: 'location_src', label: 'Source Location', importable: true },
      { key: 'location_dest', label: 'Dest Location', importable: true },
      { key: 'active', label: 'Active', importable: true },
    ],
  },
  transfers: {
    label: 'Transfers',
    importable: false,
    defaultExport: ['name', 'state', 'origin', 'scheduledDate', 'operationType', 'partner'],
    fields: [
      { key: 'id', label: 'id', importable: false },
      { key: 'name', label: 'Reference', importable: false },
      { key: 'state', label: 'Status', importable: false },
      { key: 'origin', label: 'Source Document', importable: false },
      { key: 'scheduledDate', label: 'Scheduled Date', importable: false },
      { key: 'operationType', label: 'Operation Type', importable: false },
      { key: 'partner', label: 'Partner', importable: false },
      { key: 'source_path', label: 'From', importable: false },
      { key: 'dest_path', label: 'To', importable: false },
    ],
  },
  stock: {
    label: 'Stock',
    importable: false,
    defaultExport: ['product_sku', 'product', 'location', 'quantity', 'reserved', 'lot'],
    fields: [
      { key: 'product_sku', label: 'Product SKU', importable: false },
      { key: 'product', label: 'Product', importable: false },
      { key: 'location', label: 'Location', importable: false },
      { key: 'quantity', label: 'On Hand', importable: false },
      { key: 'reserved', label: 'Reserved', importable: false },
      { key: 'lot', label: 'Lot/Serial', importable: false },
      { key: 'package', label: 'Package', importable: false },
    ],
  },
  moves_history: {
    label: 'Moves History',
    importable: false,
    defaultExport: ['date', 'reference', 'product_sku', 'quantity', 'from', 'to', 'state'],
    fields: [
      { key: 'date', label: 'Date', importable: false },
      { key: 'reference', label: 'Reference', importable: false },
      { key: 'product_sku', label: 'Product SKU', importable: false },
      { key: 'product', label: 'Product', importable: false },
      { key: 'quantity', label: 'Quantity', importable: false },
      { key: 'from', label: 'From', importable: false },
      { key: 'to', label: 'To', importable: false },
      { key: 'state', label: 'State', importable: false },
      { key: 'lot', label: 'Lot/Serial', importable: false },
    ],
  },
  valuation: {
    label: 'Valuation',
    importable: false,
    defaultExport: ['product_sku', 'product', 'quantity', 'unitCost', 'value', 'date'],
    fields: [
      { key: 'product_sku', label: 'Product SKU', importable: false },
      { key: 'product', label: 'Product', importable: false },
      { key: 'quantity', label: 'Quantity', importable: false },
      { key: 'unitCost', label: 'Unit Cost', importable: false },
      { key: 'value', label: 'Value', importable: false },
      { key: 'date', label: 'Date', importable: false },
    ],
  },
  physical_inventory: {
    label: 'Physical Inventory',
    importable: true,
    defaultExport: [
      'location', 'product_sku', 'lot', 'on_hand', 'counted_qty', 'difference', 'scheduled_date',
    ],
    fields: [
      { key: 'location', label: 'Location', importable: true },
      { key: 'product_sku', label: 'Product SKU', importable: true },
      { key: 'lot', label: 'Lot', importable: true },
      { key: 'on_hand', label: 'On Hand', importable: false },
      { key: 'counted_qty', label: 'Counted Quantity', importable: true },
      { key: 'difference', label: 'Difference', importable: false },
      { key: 'scheduled_date', label: 'Scheduled Date', importable: false },
    ],
  },
  product_variants: {
    label: 'Product Variants',
    importable: true,
    defaultExport: ['product_sku', 'sku', 'barcode', 'active'],
    fields: [
      { key: 'id', label: 'id', importable: true },
      { key: 'product_sku', label: 'Template SKU', importable: true },
      { key: 'sku', label: 'Variant SKU', importable: true },
      { key: 'barcode', label: 'Barcode', importable: true },
      { key: 'active', label: 'Active', importable: true },
    ],
  },
};

export function getIeModel(key) {
  return IE_MODELS[key] || null;
}

export function listIeModels() {
  return Object.entries(IE_MODELS).map(([key, m]) => ({
    key,
    label: m.label,
    importable: m.importable !== false,
    defaultExport: m.defaultExport || [],
  }));
}

/** Flatten fields + one-level relation children for the export picker. */
export function flattenIeFields(modelKey, { importCompatible = false } = {}) {
  const model = getIeModel(modelKey);
  if (!model) return [];
  const out = [];
  for (const f of model.fields) {
    if (importCompatible && f.importable === false) continue;
    if (importCompatible && f.key === 'id') {
      out.push({ key: 'id', label: 'id', path: 'id', importable: true });
      continue;
    }
    out.push({
      key: f.key,
      label: f.label,
      path: f.key,
      importable: f.importable !== false,
    });
    if (f.relation?.fields?.length) {
      for (const child of f.relation.fields) {
        const path = `${f.key}/${child.key}`;
        out.push({
          key: path,
          label: `${f.label} / ${child.label}`,
          path,
          importable: f.importable !== false,
          parent: f.key,
        });
      }
    }
  }
  if (importCompatible) {
    return out.filter((f) => f.importable !== false);
  }
  return out;
}
