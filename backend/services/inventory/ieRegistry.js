/**
 * Field registries for universal inventory Import / Export (v4.1).
 * Product catalog lives in ieProductsRegistry.js — single source of truth.
 * `importable: false` → export-only (computed / ledger).
 */

import {
  PRODUCT_IE_FIELDS,
  PRODUCT_EXCLUDED_FROM_EXPORT,
  PRODUCT_SYSTEM_TEMPLATES,
} from './ieProductsRegistry.js';

/**
 * @typedef {object} ExportField
 * @property {string} key
 * @property {string} label
 * @property {string} [labelAr]
 * @property {string} [group]
 * @property {string} [type]
 * @property {string|object} [relation]
 * @property {boolean} [importable]
 * @property {boolean} [required]
 * @property {boolean} [unique]
 * @property {string[]} [enumValues]
 * @property {string} [example]
 * @property {string} [help]
 * @property {string} [permission]
 */

/** @typedef {ExportField} IeField */

export { PRODUCT_IE_FIELDS, PRODUCT_EXCLUDED_FROM_EXPORT, PRODUCT_SYSTEM_TEMPLATES };

/** @type {Record<string, { label: string, importable: boolean, fields: IeField[], defaultExport: string[], excludedFromExport?: { key: string, reason: string }[], systemTemplates?: object[] }>} */
export const IE_MODELS = {
  products: {
    label: 'Products',
    importable: true,
    defaultExport: ['id', 'productId', 'sku', 'barcode', 'name_en', 'name_ar', 'salesPrice', 'cost', 'uom', 'tracking', 'category'],
    fields: PRODUCT_IE_FIELDS,
    excludedFromExport: PRODUCT_EXCLUDED_FROM_EXPORT,
    systemTemplates: PRODUCT_SYSTEM_TEMPLATES,
  },
  warehouses: {
    label: 'Warehouses',
    importable: true,
    defaultExport: ['code', 'nameEn', 'nameAr', 'active', 'receptionSteps', 'deliverySteps'],
    fields: [
      { key: 'id', label: 'id', group: 'Identity', importable: true },
      { key: 'external_ref', label: 'external_ref', group: 'Identity', importable: true },
      { key: 'code', label: 'Code', group: 'General', importable: true, required: true },
      { key: 'nameEn', label: 'Name (EN)', group: 'General', importable: true, required: true },
      { key: 'nameAr', label: 'Name (AR)', group: 'General', importable: true },
      { key: 'address', label: 'Address', group: 'General', importable: true },
      { key: 'address.city', label: 'City', group: 'General', importable: true },
      { key: 'address.country', label: 'Country', group: 'General', importable: true },
      { key: 'lotStock', label: 'Lot Stock Location', group: 'Inventory', importable: false },
      { key: 'receptionSteps', label: 'Reception Steps', group: 'Inventory', importable: true },
      { key: 'deliverySteps', label: 'Delivery Steps', group: 'Inventory', importable: true },
      { key: 'buyToResupply', label: 'Buy to Resupply', group: 'Inventory', importable: true, type: 'boolean' },
      { key: 'manufactureToResupply', label: 'Manufacture to Resupply', group: 'Inventory', importable: true, type: 'boolean' },
      { key: 'resupplyFrom', label: 'Resupply From', group: 'Inventory', importable: false },
      { key: 'active', label: 'Active', group: 'General', importable: true, type: 'boolean' },
      { key: 'onHandValue', label: 'On Hand Value', group: 'Computed', importable: false, permission: 'inventory.cost' },
    ],
  },
  locations: {
    label: 'Locations',
    importable: true,
    defaultExport: ['completePath', 'name', 'usage', 'barcode', 'active'],
    fields: [
      { key: 'id', label: 'id', group: 'Identity', importable: true },
      { key: 'external_ref', label: 'external_ref', group: 'Identity', importable: true },
      { key: 'name', label: 'Name', group: 'General', importable: true, required: true },
      { key: 'nameAr', label: 'Name (AR)', group: 'General', importable: true },
      { key: 'completePath', label: 'Complete Name', group: 'General', importable: false },
      { key: 'parent', label: 'Parent', group: 'General', importable: true },
      { key: 'usage', label: 'Type', group: 'General', importable: true },
      { key: 'barcode', label: 'Barcode', group: 'Inventory', importable: true },
      { key: 'isScrap', label: 'Is Scrap', group: 'Inventory', importable: false, type: 'boolean' },
      { key: 'isReturn', label: 'Is Return', group: 'Inventory', importable: false, type: 'boolean' },
      { key: 'replenishLocation', label: 'Replenish Location', group: 'Inventory', importable: true, type: 'boolean' },
      { key: 'storageCategory', label: 'Storage Category', group: 'Inventory', importable: true },
      { key: 'removalStrategy', label: 'Removal Strategy', group: 'Inventory', importable: true },
      { key: 'pickSequence', label: 'Pick Sequence', group: 'Inventory', importable: true, type: 'number' },
      { key: 'cyclicFrequency', label: 'Cyclic Frequency', group: 'Inventory', importable: true, type: 'number' },
      { key: 'lastInventoryDate', label: 'Last Inventory Date', group: 'Inventory', importable: false, type: 'date' },
      { key: 'nextInventoryDate', label: 'Next Inventory Date', group: 'Inventory', importable: false, type: 'date' },
      { key: 'active', label: 'Active', group: 'General', importable: true, type: 'boolean' },
      {
        key: 'warehouse',
        label: 'Warehouse',
        group: 'General',
        importable: true,
        type: 'm2o',
        relation: {
          model: 'warehouse',
          fields: [
            { key: 'code', label: 'Short Name' },
            { key: 'nameEn', label: 'Name' },
          ],
        },
      },
      { key: 'warehouse_id', label: 'Warehouse ID', group: 'General', importable: true },
    ],
  },
  product_categories: {
    label: 'Product Categories',
    importable: true,
    defaultExport: ['name', 'completePath', 'parentPath', 'costingMethod', 'valuationMode'],
    fields: [
      { key: 'id', label: 'id', group: 'Identity', importable: true },
      { key: 'external_ref', label: 'external_ref', group: 'Identity', importable: true },
      { key: 'name', label: 'Name', group: 'General', importable: true, required: true },
      { key: 'parent', label: 'Parent', group: 'General', importable: true },
      { key: 'completePath', label: 'Complete Name', group: 'General', importable: false },
      { key: 'parentPath', label: 'Parent Path', group: 'General', importable: true },
      { key: 'costingMethod', label: 'Costing Method', group: 'Accounting', importable: true },
      { key: 'valuationMode', label: 'Valuation Mode', group: 'Accounting', importable: true },
      { key: 'removalStrategy', label: 'Removal Strategy', group: 'Inventory', importable: true },
      { key: 'routes', label: 'Routes', group: 'Inventory', importable: false },
      { key: 'incomeAccount', label: 'Income Account', group: 'Accounting', importable: true },
      { key: 'expenseAccount', label: 'Expense Account', group: 'Accounting', importable: true },
      { key: 'valuationAccount', label: 'Valuation Account', group: 'Accounting', importable: true },
      { key: 'productCount', label: 'Product Count', group: 'Computed', importable: false },
    ],
  },
  operation_types: {
    label: 'Operation Types',
    importable: true,
    defaultExport: ['name', 'code', 'sequenceCode', 'type'],
    fields: [
      { key: 'id', label: 'id', group: 'Identity', importable: true },
      { key: 'name', label: 'Name', group: 'General', importable: true, required: true },
      { key: 'code', label: 'Code', group: 'General', importable: true },
      { key: 'sequenceCode', label: 'Sequence Prefix', group: 'General', importable: true },
      { key: 'type', label: 'Type', group: 'General', importable: true },
      { key: 'defaultSrc', label: 'Default Source', group: 'Inventory', importable: true },
      { key: 'defaultDest', label: 'Default Dest', group: 'Inventory', importable: true },
      { key: 'reservationMethod', label: 'Reservation Method', group: 'Inventory', importable: true },
      { key: 'createBackorder', label: 'Create Backorder', group: 'Inventory', importable: true },
      { key: 'useCreateLots', label: 'Create Lots', group: 'Inventory', importable: true, type: 'boolean' },
      { key: 'useExistingLots', label: 'Use Existing Lots', group: 'Inventory', importable: true, type: 'boolean' },
      { key: 'returnType', label: 'Return Type', group: 'Inventory', importable: true },
      { key: 'barcode', label: 'Barcode', group: 'Inventory', importable: true },
      { key: 'active', label: 'Active', group: 'General', importable: true, type: 'boolean' },
      {
        key: 'warehouse',
        label: 'Warehouse',
        group: 'General',
        importable: true,
        type: 'm2o',
        relation: { model: 'warehouse', fields: [{ key: 'code', label: 'Short Name' }] },
      },
    ],
  },
  lots: {
    label: 'Lots / Serial Numbers',
    importable: true,
    defaultExport: ['name', 'product_sku', 'expirationDate', 'removalDate', 'onHand'],
    fields: [
      { key: 'id', label: 'id', group: 'Identity', importable: true },
      { key: 'external_ref', label: 'external_ref', group: 'Identity', importable: true },
      { key: 'name', label: 'Lot/Serial', group: 'General', importable: true, required: true },
      { key: 'product', label: 'Product', group: 'General', importable: false },
      { key: 'product_sku', label: 'SKU', group: 'General', importable: true, required: true },
      { key: 'expirationDate', label: 'Expiration Date', group: 'Inventory', importable: true, type: 'date' },
      { key: 'useDate', label: 'Use Date', group: 'Inventory', importable: true, type: 'date' },
      { key: 'removalDate', label: 'Removal Date', group: 'Inventory', importable: true, type: 'date' },
      { key: 'alertDate', label: 'Alert Date', group: 'Inventory', importable: true, type: 'date' },
      { key: 'onHand', label: 'On Hand', group: 'Computed', importable: false },
      { key: 'locations', label: 'Location(s)', group: 'Computed', importable: false },
      { key: 'createdAt', label: 'Created At', group: 'Identity', importable: false, type: 'datetime' },
      { key: 'note', label: 'Note', group: 'General', importable: true },
    ],
  },
  packages: {
    label: 'Packages',
    importable: true,
    defaultExport: ['name', 'packageType', 'location_path', 'weight'],
    fields: [
      { key: 'id', label: 'id', group: 'Identity', importable: true },
      { key: 'name', label: 'Package', group: 'General', importable: true, required: true },
      { key: 'packageType', label: 'Package Type', group: 'General', importable: true },
      { key: 'location_path', label: 'Location', group: 'Inventory', importable: true },
      { key: 'contents', label: 'Contents Summary', group: 'Computed', importable: false },
      { key: 'weight', label: 'Weight', group: 'Inventory', importable: true, type: 'number' },
    ],
  },
  reorder_rules: {
    label: 'Reordering Rules',
    importable: true,
    defaultExport: ['product_sku', 'location_path', 'minQty', 'maxQty', 'qtyMultiple', 'trigger', 'active'],
    fields: [
      { key: 'id', label: 'id', group: 'Identity', importable: true },
      { key: 'product', label: 'Product', group: 'General', importable: false },
      { key: 'product_sku', label: 'SKU', group: 'General', importable: true, required: true },
      { key: 'warehouse', label: 'Warehouse', group: 'Inventory', importable: false },
      { key: 'location_path', label: 'Location', group: 'Inventory', importable: true },
      { key: 'minQty', label: 'Min Qty', group: 'Inventory', importable: true, type: 'decimal' },
      { key: 'maxQty', label: 'Max Qty', group: 'Inventory', importable: true, type: 'decimal' },
      { key: 'qtyMultiple', label: 'Multiple', group: 'Inventory', importable: true, type: 'decimal' },
      { key: 'trigger', label: 'Trigger', group: 'Inventory', importable: true },
      { key: 'route', label: 'Route', group: 'Inventory', importable: true },
      { key: 'leadDays', label: 'Lead Days', group: 'Inventory', importable: true, type: 'number' },
      { key: 'onHand', label: 'On Hand', group: 'Computed', importable: false },
      { key: 'forecast', label: 'Forecast', group: 'Computed', importable: false },
      { key: 'toOrder', label: 'To Order', group: 'Computed', importable: false },
      { key: 'snoozedUntil', label: 'Snoozed Until', group: 'Inventory', importable: true, type: 'date' },
      { key: 'active', label: 'Active', group: 'General', importable: true, type: 'boolean' },
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
    defaultExport: ['name', 'state', 'origin', 'scheduledDate', 'operationType', 'partner', 'lineCount', 'totalQty'],
    fields: [
      { key: 'id', label: 'id', group: 'Identity', importable: false },
      { key: 'name', label: 'Reference', group: 'Identity', importable: false },
      { key: 'operationType', label: 'Operation Type', group: 'General', importable: false },
      { key: 'partner', label: 'Partner', group: 'General', importable: false },
      { key: 'source_path', label: 'From', group: 'Inventory', importable: false },
      { key: 'dest_path', label: 'To', group: 'Inventory', importable: false },
      { key: 'scheduledDate', label: 'Scheduled Date', group: 'General', importable: false, type: 'datetime' },
      { key: 'deadline', label: 'Deadline', group: 'General', importable: false, type: 'datetime' },
      { key: 'dateDone', label: 'Date Done', group: 'General', importable: false, type: 'datetime' },
      { key: 'state', label: 'Status', group: 'General', importable: false },
      { key: 'origin', label: 'Source Document', group: 'General', importable: false },
      { key: 'backorderOf', label: 'Backorder Of', group: 'General', importable: false },
      { key: 'responsible', label: 'Responsible', group: 'General', importable: false },
      { key: 'priority', label: 'Priority', group: 'General', importable: false },
      { key: 'company', label: 'Company', group: 'General', importable: false },
      { key: 'lineCount', label: 'Line Count', group: 'Computed', importable: false },
      { key: 'totalQty', label: 'Total Qty', group: 'Computed', importable: false },
    ],
  },
  transfer_lines: {
    label: 'Transfer Lines',
    importable: false,
    defaultExport: [
      'picking', 'product', 'sku', 'demand', 'quantity', 'uom', 'lot', 'package', 'sourceLoc', 'destLoc', 'state', 'unitCost', 'value',
    ],
    fields: [
      { key: 'picking', label: 'Picking', group: 'Identity', importable: false },
      { key: 'product', label: 'Product', group: 'General', importable: false },
      { key: 'sku', label: 'SKU', group: 'Identity', importable: false },
      { key: 'demand', label: 'Demand', group: 'Inventory', importable: false },
      { key: 'quantity', label: 'Quantity', group: 'Inventory', importable: false },
      { key: 'uom', label: 'UoM', group: 'Inventory', importable: false },
      { key: 'lot', label: 'Lot', group: 'Inventory', importable: false },
      { key: 'package', label: 'Package', group: 'Inventory', importable: false },
      { key: 'sourceLoc', label: 'Source Loc', group: 'Inventory', importable: false },
      { key: 'destLoc', label: 'Dest Loc', group: 'Inventory', importable: false },
      { key: 'state', label: 'State', group: 'General', importable: false },
      { key: 'unitCost', label: 'Unit Cost', group: 'Accounting', importable: false, permission: 'inventory.cost' },
      { key: 'value', label: 'Value', group: 'Accounting', importable: false, permission: 'inventory.cost' },
    ],
  },
  stock: {
    label: 'Stock',
    importable: false,
    defaultExport: ['product', 'product_sku', 'warehouse', 'location', 'quantity', 'reserved', 'unitCost', 'totalValue'],
    fields: [
      { key: 'product', label: 'Product', group: 'General', importable: false },
      { key: 'product_sku', label: 'SKU', group: 'Identity', importable: false },
      { key: 'productId', label: 'Product ID', group: 'Identity', importable: false },
      { key: 'variant', label: 'Variant', group: 'General', importable: false },
      { key: 'location', label: 'Location', group: 'Inventory', importable: false },
      { key: 'warehouse', label: 'Warehouse', group: 'Inventory', importable: false },
      { key: 'lot', label: 'Lot/Serial', group: 'Inventory', importable: false },
      { key: 'quantity', label: 'On Hand', group: 'Inventory', importable: false },
      { key: 'freeToUse', label: 'Free to Use', group: 'Inventory', importable: false },
      { key: 'reserved', label: 'Reserved', group: 'Inventory', importable: false },
      { key: 'incoming', label: 'Incoming', group: 'Inventory', importable: false },
      { key: 'outgoing', label: 'Outgoing', group: 'Inventory', importable: false },
      { key: 'forecasted', label: 'Forecasted', group: 'Inventory', importable: false },
      { key: 'uom', label: 'UoM', group: 'Inventory', importable: false },
      { key: 'unitCost', label: 'Unit Cost', group: 'Accounting', importable: false, permission: 'inventory.cost' },
      { key: 'totalValue', label: 'Total Value', group: 'Accounting', importable: false, permission: 'inventory.cost' },
      { key: 'lastCountDate', label: 'Last Count Date', group: 'Inventory', importable: false, type: 'date' },
      { key: 'ageDays', label: 'Age Days', group: 'Computed', importable: false },
      { key: 'package', label: 'Package', group: 'Inventory', importable: false },
    ],
    systemTemplates: [
      {
        name: 'Stock snapshot',
        fields: ['product', 'product_sku', 'warehouse', 'location', 'quantity', 'freeToUse', 'unitCost', 'totalValue'],
        format: 'xlsx',
        isSystem: true,
      },
    ],
  },
  moves_history: {
    label: 'Moves History',
    importable: false,
    defaultExport: ['date', 'reference', 'product_sku', 'quantity', 'from', 'to', 'state', 'value'],
    fields: [
      { key: 'date', label: 'Date', group: 'Identity', importable: false, type: 'datetime' },
      { key: 'reference', label: 'Reference', group: 'Identity', importable: false },
      { key: 'sourceDoc', label: 'Source Doc', group: 'General', importable: false },
      { key: 'product_sku', label: 'SKU', group: 'Identity', importable: false },
      { key: 'product', label: 'Product', group: 'General', importable: false },
      { key: 'lot', label: 'Lot/Serial', group: 'Inventory', importable: false },
      { key: 'from', label: 'From', group: 'Inventory', importable: false },
      { key: 'to', label: 'To', group: 'Inventory', importable: false },
      { key: 'quantity', label: 'Qty', group: 'Inventory', importable: false },
      { key: 'uom', label: 'UoM', group: 'Inventory', importable: false },
      { key: 'partner', label: 'Partner', group: 'General', importable: false },
      { key: 'user', label: 'User', group: 'General', importable: false },
      { key: 'state', label: 'State', group: 'General', importable: false },
      { key: 'unitCost', label: 'Unit Cost', group: 'Accounting', importable: false, permission: 'inventory.cost' },
      { key: 'value', label: 'Value', group: 'Accounting', importable: false, permission: 'inventory.cost' },
    ],
    systemTemplates: [
      {
        name: 'Audit export',
        fields: ['date', 'reference', 'product', 'from', 'to', 'quantity', 'user', 'value'],
        format: 'xlsx',
        isSystem: true,
      },
    ],
  },
  valuation: {
    label: 'Valuation',
    importable: false,
    defaultExport: ['date', 'product_sku', 'product', 'quantity', 'unitCost', 'value'],
    fields: [
      { key: 'date', label: 'Date', group: 'Identity', importable: false, type: 'datetime' },
      { key: 'product', label: 'Product', group: 'General', importable: false },
      { key: 'product_sku', label: 'SKU', group: 'Identity', importable: false },
      { key: 'description', label: 'Description', group: 'General', importable: false },
      { key: 'moveRef', label: 'Move Reference', group: 'Identity', importable: false },
      { key: 'quantity', label: 'Qty', group: 'Inventory', importable: false },
      { key: 'unitCost', label: 'Unit Cost', group: 'Accounting', importable: false, permission: 'inventory.cost' },
      { key: 'value', label: 'Value', group: 'Accounting', importable: false, permission: 'inventory.cost' },
      { key: 'remainingQty', label: 'Remaining Qty', group: 'Accounting', importable: false },
      { key: 'remainingValue', label: 'Remaining Value', group: 'Accounting', importable: false, permission: 'inventory.cost' },
      { key: 'method', label: 'Method', group: 'Accounting', importable: false },
      { key: 'landedCostRef', label: 'Landed Cost Ref', group: 'Accounting', importable: false },
    ],
  },
  physical_inventory: {
    label: 'Physical Inventory',
    importable: true,
    defaultExport: [
      'location', 'product_sku', 'product_name', 'uom', 'lot', 'package', 'on_hand', 'counted_qty', 'difference', 'scheduled_date', 'warehouse',
    ],
    fields: [
      { key: 'location', label: 'Location', group: 'Inventory', importable: true },
      { key: 'warehouse', label: 'Warehouse', group: 'Inventory', importable: false },
      { key: 'product_sku', label: 'SKU', group: 'Identity', importable: true, required: true },
      { key: 'product_name', label: 'Product', group: 'General', importable: false },
      { key: 'uom', label: 'UoM', group: 'Inventory', importable: false },
      { key: 'lot', label: 'Lot', group: 'Inventory', importable: true },
      { key: 'package', label: 'Package', group: 'Inventory', importable: true },
      { key: 'on_hand', label: 'On Hand', group: 'Inventory', importable: false },
      { key: 'counted_qty', label: 'Counted', group: 'Inventory', importable: true },
      { key: 'difference', label: 'Difference', group: 'Computed', importable: false },
      { key: 'differenceValue', label: 'Difference Value', group: 'Computed', importable: false, permission: 'inventory.cost' },
      { key: 'scheduled_date', label: 'Scheduled Date', group: 'General', importable: false, type: 'date' },
      { key: 'user', label: 'User', group: 'General', importable: false },
      { key: 'lastCountDate', label: 'Last Count Date', group: 'General', importable: false, type: 'date' },
      { key: 'reasonCode', label: 'Reason Code', group: 'General', importable: true },
      { key: 'state', label: 'State', group: 'General', importable: false },
      { key: 'filter', label: 'Filter Tag', group: 'General', importable: false },
    ],
    systemTemplates: [
      {
        name: 'Count sheet',
        fields: ['location', 'product_name', 'product_sku', 'lot', 'uom', 'on_hand', 'counted_qty'],
        format: 'xlsx',
        isSystem: true,
      },
    ],
  },
  product_variants: {
    label: 'Product Variants',
    importable: true,
    defaultExport: ['product_sku', 'sku', 'name', 'barcode', 'priceExtra', 'cost', 'salesPrice', 'onHand', 'active'],
    fields: [
      { key: 'id', label: 'id', group: 'Identity', importable: true },
      { key: 'variantId', label: 'Variant ID', group: 'Identity', importable: false },
      { key: 'product_sku', label: 'Template SKU', group: 'Identity', importable: true },
      { key: 'sku', label: 'Variant SKU', group: 'Identity', importable: true },
      { key: 'barcode', label: 'Barcode', group: 'Identity', importable: true },
      { key: 'priceExtra', label: 'Price Extra', group: 'Sales', importable: true, type: 'decimal' },
      { key: 'cost', label: 'Cost', group: 'Purchase', importable: true, type: 'decimal', permission: 'inventory.cost' },
      { key: 'onHand', label: 'On Hand', group: 'Computed', importable: false },
      { key: 'active', label: 'Active', group: 'Identity', importable: true, type: 'boolean' },
    ],
  },
  vendors_pricelist: {
    label: 'Vendors Pricelist',
    importable: true,
    defaultExport: ['product_sku', 'vendor', 'vendorProductCode', 'minQty', 'price', 'leadDays'],
    fields: [
      { key: 'product', label: 'Product', group: 'General', importable: false },
      { key: 'product_sku', label: 'SKU', group: 'Identity', importable: true, required: true },
      { key: 'vendor', label: 'Vendor', group: 'Purchase', importable: true, required: true },
      { key: 'vendorProductCode', label: 'Vendor Product Code', group: 'Purchase', importable: true },
      { key: 'minQty', label: 'Min Qty', group: 'Purchase', importable: true, type: 'decimal' },
      { key: 'price', label: 'Price', group: 'Purchase', importable: true, type: 'decimal', permission: 'inventory.cost' },
      { key: 'currency', label: 'Currency', group: 'Purchase', importable: true },
      { key: 'leadDays', label: 'Lead Days', group: 'Purchase', importable: true, type: 'number' },
      { key: 'validFrom', label: 'Valid From', group: 'Purchase', importable: true, type: 'date' },
      { key: 'validTo', label: 'Valid To', group: 'Purchase', importable: true, type: 'date' },
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

/** Cost-sensitive field keys for a model (permission: inventory.cost). */
export function costGatedFieldKeys(modelKey) {
  const model = getIeModel(modelKey);
  if (!model) return new Set();
  return new Set(
    (model.fields || [])
      .filter((f) => f.permission === 'inventory.cost')
      .map((f) => f.key),
  );
}

/**
 * Flatten fields + one-level relation children for the export picker.
 * Includes group, type, importable, locked (computed), permission.
 */
export function flattenIeFields(modelKey, { importCompatible = false } = {}) {
  const model = getIeModel(modelKey);
  if (!model) return [];
  const out = [];
  for (const fld of model.fields) {
    if (importCompatible && fld.importable === false) continue;
    if (importCompatible && fld.key === 'id') {
      out.push({
        key: 'id',
        label: 'id',
        path: 'id',
        importable: true,
        group: fld.group || 'Identity',
        type: fld.type || 'string',
        locked: false,
      });
      continue;
    }
    const locked = fld.importable === false || fld.group === 'Computed';
    out.push({
      key: fld.key,
      label: fld.label,
      labelAr: fld.labelAr,
      path: fld.key,
      importable: fld.importable !== false,
      group: fld.group || 'General',
      type: fld.type || 'string',
      locked,
      permission: fld.permission || null,
      required: !!fld.required,
      unique: !!fld.unique,
      enumValues: fld.enumValues,
      example: fld.example,
      help: fld.help,
    });
    if (fld.relation?.fields?.length) {
      for (const child of fld.relation.fields) {
        const path = `${fld.key}/${child.key}`;
        out.push({
          key: path,
          label: `${fld.label} / ${child.label}`,
          path,
          importable: fld.importable !== false,
          parent: fld.key,
          group: fld.group || 'General',
          type: 'string',
          locked: fld.importable === false,
        });
      }
    }
  }
  if (importCompatible) {
    return out.filter((f) => f.importable !== false);
  }
  return out;
}

/**
 * CI / startup assert: every Product mongoose path of interest is registered or excluded.
 * Passes when PRODUCT_IE_FIELDS + PRODUCT_EXCLUDED cover the v4.1 §1.1 catalog keys we track.
 */
export function assertProductRegistryComplete() {
  const registered = new Set(PRODUCT_IE_FIELDS.map((x) => x.key));
  const excluded = new Set(PRODUCT_EXCLUDED_FROM_EXPORT.map((x) => x.key));
  const requiredCatalog = [
    'id', 'productId', 'external_ref', 'sku', 'barcode', 'active', 'createdAt', 'updatedAt', 'createdBy',
    'name_en', 'name_ar', 'description_en', 'description_ar', 'internalNotes', 'productType', 'trackInventory',
    'category', 'category.completeName', 'tags', 'imageUrl', 'imageCount',
    'canBeSold', 'canBePurchased', 'canBeExpensed', 'availableInPos',
    'salesPrice', 'taxRate', 'salesDescription', 'minSaleQty', 'saleMultiple', 'invoicePolicy',
    'accessories', 'upsells', 'crossSells', 'optionals', 'substitutes',
    'cost', 'purchaseUom', 'purchaseDescription', 'controlPolicy', 'daysToPurchase', 'hsCode', 'countryOfOrigin',
    'vendor.primary.name', 'vendor.primary.code', 'vendor.primary.price', 'vendor.primary.minQty', 'vendor.primary.leadDays', 'vendorCount',
    'uom', 'tracking', 'useExpiration', 'shelfLifeDays', 'alertDays', 'removalDays', 'useByDays', 'weight', 'volume',
    'negativeStockAllowed',
    'incomeAccount', 'expenseAccount', 'valuationAccount', 'costingMethod', 'valuationMode',
    'onHand', 'freeToUse', 'reserved', 'forecasted', 'inventoryValue', 'avgCost', 'variantCount',
    // §1.1 excluded-with-reason
    'barcodes[]', 'company', 'responsible', 'standardPrice', 'uomCategory', 'routes[]', 'removalStrategy',
    'packagings[]', 'descriptionPicking', 'descriptionPickingIn', 'descriptionPickingOut', 'abcClass',
    'priceDifferenceAccount', 'incoming', 'outgoing', 'lastPurchasePrice', 'lastPurchaseDate', 'lastSaleDate',
    'salesQty30d', 'salesQty90d', 'daysOfStock', 'lotCount', 'moveCount', 'reorderingRuleCount', 'stockByWarehouse',
  ];
  const missing = requiredCatalog.filter((k) => !registered.has(k) && !excluded.has(k));
  if (missing.length) {
    throw new Error(`Product IE registry incomplete — missing: ${missing.join(', ')}`);
  }
  const noReason = PRODUCT_EXCLUDED_FROM_EXPORT.filter((e) => !e.reason);
  if (noReason.length) {
    throw new Error(`PRODUCT_EXCLUDED_FROM_EXPORT missing reasons: ${noReason.map((e) => e.key).join(', ')}`);
  }
  return { ok: true, registered: registered.size, excluded: excluded.size };
}
