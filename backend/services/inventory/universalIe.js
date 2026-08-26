import Product from '../../models/Product.js';
import Warehouse from '../../models/Warehouse.js';
import {
  InvLocation,
  InvLot,
  InvPackage,
  InvProductCategory,
  InvOperationType,
  InvReorderRule,
  InvPutawayRule,
  InvRoute,
  InvRule,
  InvTransfer,
  InvMoveLine,
  InvValuationLayer,
  InvProductVariant,
} from '../../models/inventory/index.js';
import InvIeTemplate from '../../models/inventory/InvIeTemplate.js';
import InvExportJob from '../../models/inventory/InvExportJob.js';
import { toObjectId } from '../../models/inventory/common.js';
import { InventoryValidationError } from './errors.js';
import {
  getIeModel,
  listIeModels,
  flattenIeFields,
  costGatedFieldKeys,
  IE_MODELS,
  assertProductRegistryComplete,
} from './ieRegistry.js';
import InvIeAudit from '../../models/inventory/InvIeAudit.js';
import {
  rowsToCsv,
  csvTextToXlsxBuffer,
  parseCsv,
  resolveImportCsvText,
  importProducts,
  importLocations,
} from './importExport.js';
import { stockExportRows } from './reporting.js';
import { importCountedQuantities, listInventoryQuants } from './inventoryCount.js';
import { withTenant } from '../../utils/tenantScope.js';

const SYNC_ROW_LIMIT = 5000;
const HARD_ROW_CAP = 50000;
const EXPORT_JOB_TTL_MS = 7 * 24 * 60 * 60 * 1000;

async function writeIeAudit(tenantId, userId, payload) {
  try {
    await InvIeAudit.create({
      tenantId: toObjectId(tenantId),
      userId: userId || undefined,
      ...payload,
    });
  } catch {
    /* audit must not block IE */
  }
}

/** Map Product document → registry field keys (§1.1). */
function mapProductExportRow(p) {
  const preferred = (p.suppliers || []).find((s) => s.isPreferred) || (p.suppliers || [])[0];
  const primaryImg = (p.images || []).find((i) => i.isPrimary) || (p.images || [])[0];
  const uom = p.uomId?.name || p.unitOfMeasure || 'PCE';
  const cat = p.categoryId;
  return {
    id: String(p._id),
    productId: p.productId || '',
    external_ref: p.externalId || '',
    sku: p.sku,
    barcode: p.barcode || '',
    active: p.isActive !== false && p.active !== false,
    createdAt: p.createdAt || '',
    updatedAt: p.updatedAt || '',
    createdBy: p.createdBy ? String(p.createdBy) : '',
    name_en: p.nameEn,
    name_ar: p.nameAr || '',
    nameEn: p.nameEn,
    nameAr: p.nameAr || '',
    description_en: p.descriptionEn || '',
    description_ar: p.descriptionAr || '',
    internalNotes: p.internalNotes || '',
    productType: p.productType || 'goods',
    trackInventory: p.trackInventory !== false,
    category: cat?.name || p.category || '',
    category_id: cat?._id ? String(cat._id) : '',
    'category.completeName': cat?.completePath || '',
    'category/name': cat?.name || p.category || '',
    tags: Array.isArray(p.tags) ? p.tags.join(',') : '',
    imageUrl: primaryImg?.url || '',
    imageCount: Array.isArray(p.images) ? p.images.length : 0,
    canBeSold: p.canBeSold !== false,
    canBePurchased: p.canBePurchased !== false,
    canBeExpensed: p.canBeExpensed === true,
    availableInPos: p.canBeSoldOnPos !== false,
    salesPrice: p.salePrice ?? p.sellingPrice ?? '',
    salePrice: p.salePrice ?? p.sellingPrice ?? '',
    taxRate: p.taxRate ?? '',
    salesDescription: p.salesDescription || '',
    minSaleQty: p.minSaleQty ?? '',
    saleMultiple: p.saleMultiple ?? '',
    invoicePolicy: p.invoicingPolicy || 'ordered',
    accessories: '',
    upsells: '',
    crossSells: '',
    optionals: '',
    substitutes: '',
    cost: p.costPrice ?? '',
    costPrice: p.costPrice ?? '',
    purchaseUom: p.purchaseUomId?.name || '',
    purchaseDescription: p.purchaseDescription || '',
    controlPolicy: p.controlPolicy || 'received',
    daysToPurchase: p.daysToPurchase ?? '',
    hsCode: p.hsCode || '',
    countryOfOrigin: p.countryOfOrigin || '',
    'vendor.primary.name': preferred?.supplierId?.name || '',
    'vendor.primary.code': preferred?.supplierId?.code || preferred?.supplierSku || '',
    'vendor.primary.price': preferred?.cost ?? '',
    'vendor.primary.minQty': preferred?.minQty ?? '',
    'vendor.primary.leadDays': preferred?.leadTimeDays ?? '',
    vendorCount: Array.isArray(p.suppliers) ? p.suppliers.length : 0,
    uom,
    unitOfMeasure: uom,
    tracking: p.tracking || 'none',
    useExpiration: p.useExpirationDate === true,
    shelfLifeDays: p.expirationDays ?? '',
    alertDays: p.alertDays ?? '',
    removalDays: p.removalDays ?? '',
    useByDays: p.useByDays ?? '',
    weight: p.weight ?? '',
    volume: p.volume ?? '',
    negativeStockAllowed: p.allowNegativeStock === true,
    incomeAccount: p.incomeAccountId ? String(p.incomeAccountId) : '',
    expenseAccount: p.expenseAccountId ? String(p.expenseAccountId) : '',
    valuationAccount: p.stockValuationAccountId ? String(p.stockValuationAccountId) : '',
    costingMethod: cat?.propertyCostMethod || '',
    valuationMode: cat?.propertyValuation || '',
    onHand: p.totalStock ?? '',
    freeToUse: '',
    reserved: '',
    forecasted: '',
    inventoryValue: '',
    avgCost: p.averageLandedCost ?? p.costPrice ?? '',
    variantCount: Array.isArray(p.attributeLines) ? p.attributeLines.length : 0,
  };
}

function filterFieldsByPermission(model, fieldKeys, { allowCost = true } = {}) {
  if (allowCost) return fieldKeys;
  const gated = costGatedFieldKeys(model);
  return fieldKeys.filter((k) => !gated.has(k));
}

function dig(obj, path) {
  if (!path) return undefined;
  if (path.includes('/')) {
    const [parent, child] = path.split('/');
    const rel = obj?.[parent];
    if (rel && typeof rel === 'object') return rel[child];
    return undefined;
  }
  if (path.includes('.')) {
    return path.split('.').reduce((acc, k) => (acc == null ? undefined : acc[k]), obj);
  }
  return obj?.[path];
}

function cell(v) {
  if (v == null) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'object' && v._id) return String(v._id);
  return String(v);
}

async function loadExportRows(tenantId, model, filters = {}) {
  const tid = toObjectId(tenantId);
  const limit = Math.min(HARD_ROW_CAP, Number(filters.limit) || HARD_ROW_CAP);
  const search = filters.search?.trim();

  switch (model) {
    case 'products': {
      const q = withTenant(tid, {});
      if (search) {
        q.$or = [
          { nameEn: new RegExp(search, 'i') },
          { nameAr: new RegExp(search, 'i') },
          { sku: new RegExp(search, 'i') },
          { barcode: new RegExp(search, 'i') },
        ];
      }
      const rows = await Product.find(q)
        .populate('categoryId', 'name completePath propertyCostMethod propertyValuation')
        .populate('uomId', 'name')
        .populate('purchaseUomId', 'name')
        .populate('suppliers.supplierId', 'name code')
        .limit(limit)
        .lean();
      return rows.map((p) => mapProductExportRow(p));
    }
    case 'warehouses': {
      const rows = await Warehouse.find({ tenantId: tid }).limit(limit).lean();
      return rows.map((w) => ({
        id: String(w._id),
        external_ref: w.externalId || '',
        code: w.code || '',
        nameEn: w.nameEn || '',
        nameAr: w.nameAr || '',
        active: w.active !== false,
        receptionSteps: w.receptionSteps ?? '',
        deliverySteps: w.deliverySteps ?? '',
        'address.city': w.address?.city || '',
        'address.country': w.address?.country || '',
      }));
    }
    case 'locations': {
      const rows = await InvLocation.find({ tenantId: tid })
        .populate('warehouseId', 'code nameEn')
        .sort({ completePath: 1 })
        .limit(limit)
        .lean();
      return rows.map((l) => ({
        id: String(l._id),
        external_ref: l.externalId || '',
        name: l.name,
        nameAr: l.nameAr || '',
        completePath: l.completePath || '',
        usage: l.usage,
        barcode: l.barcode || '',
        active: l.active !== false,
        warehouse: l.warehouseId,
        'warehouse/code': l.warehouseId?.code || '',
        'warehouse/nameEn': l.warehouseId?.nameEn || '',
      }));
    }
    case 'product_categories': {
      const q = { tenantId: tid };
      if (Array.isArray(filters.ids) && filters.ids.length) {
        q._id = { $in: filters.ids };
      }
      const rows = await InvProductCategory.find(q).sort({ completePath: 1 }).limit(limit).lean();
      return rows.map((c) => ({
        id: String(c._id),
        external_ref: c.externalId || '',
        name: c.name,
        completePath: c.completePath || '',
        parentPath: c.parentId ? (c.completePath || '').split('/').slice(0, -1).join('/') : '',
      }));
    }
    case 'operation_types': {
      const rows = await InvOperationType.find({ tenantId: tid })
        .populate('warehouseId', 'code nameEn')
        .limit(limit)
        .lean();
      return rows.map((o) => ({
        id: String(o._id),
        name: o.name,
        code: o.code || '',
        sequenceCode: o.sequenceCode || '',
        type: o.type || o.code || '',
        warehouse: o.warehouseId,
        'warehouse/code': o.warehouseId?.code || '',
      }));
    }
    case 'lots': {
      const rows = await InvLot.find({ tenantId: tid })
        .populate('productId', 'sku nameEn')
        .limit(limit)
        .lean();
      return rows.map((l) => ({
        id: String(l._id),
        external_ref: l.externalId || '',
        name: l.name,
        product_sku: l.productId?.sku || '',
        expirationDate: l.expirationDate || '',
        removalDate: l.removalDate || '',
      }));
    }
    case 'packages': {
      const rows = await InvPackage.find({ tenantId: tid })
        .populate('packageTypeId', 'name')
        .populate('locationId', 'completePath name')
        .limit(limit)
        .lean();
      return rows.map((p) => ({
        id: String(p._id),
        name: p.name,
        packageType: p.packageTypeId?.name || '',
        location_path: p.locationId?.completePath || p.locationId?.name || '',
      }));
    }
    case 'reorder_rules': {
      const rows = await InvReorderRule.find({ tenantId: tid })
        .populate('productId', 'sku')
        .populate('locationId', 'completePath')
        .limit(limit)
        .lean();
      return rows.map((r) => ({
        id: String(r._id),
        product_sku: r.productId?.sku || '',
        location_path: r.locationId?.completePath || '',
        minQty: r.minQty,
        maxQty: r.maxQty,
        qtyMultiple: r.qtyMultiple,
        trigger: r.trigger,
        active: r.active !== false,
      }));
    }
    case 'putaway_rules': {
      const rows = await InvPutawayRule.find({ tenantId: tid })
        .populate('productId', 'sku')
        .populate('fromLocationId', 'completePath')
        .populate('toLocationId', 'completePath')
        .populate('storageCategoryId', 'name')
        .limit(limit)
        .lean();
      return rows.map((r) => ({
        id: String(r._id),
        product_sku: r.productId?.sku || '',
        location_path: r.toLocationId?.completePath || r.fromLocationId?.completePath || '',
        storageCategory: r.storageCategoryId?.name || '',
        active: r.active !== false,
      }));
    }
    case 'routes': {
      const rows = await InvRoute.find({ tenantId: tid }).limit(limit).lean();
      return rows.map((r) => ({
        id: String(r._id),
        name: r.name,
        active: r.active !== false,
        productSelectable: !!r.productSelectable,
        warehouseSelectable: !!r.warehouseSelectable,
      }));
    }
    case 'rules': {
      const rows = await InvRule.find({ tenantId: tid })
        .populate('sourceLocationId', 'completePath')
        .populate('destLocationId', 'completePath')
        .limit(limit)
        .lean();
      return rows.map((r) => ({
        id: String(r._id),
        name: r.name,
        action: r.action,
        location_src: r.sourceLocationId?.completePath || '',
        location_dest: r.destLocationId?.completePath || '',
        active: r.active !== false,
      }));
    }
    case 'transfers': {
      const q = withTenant(tid, {});
      if (filters.state) q.state = filters.state;
      const rows = await InvTransfer.find(q)
        .populate('operationTypeId', 'name')
        .populate('sourceLocationId', 'completePath')
        .populate('destLocationId', 'completePath')
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();
      return rows.map((t) => ({
        id: String(t._id),
        name: t.name,
        state: t.state,
        origin: t.origin || '',
        scheduledDate: t.scheduledDate || '',
        operationType: t.operationTypeId?.name || '',
        partner: t.partnerId ? String(t.partnerId) : '',
        source_path: t.sourceLocationId?.completePath || '',
        dest_path: t.destLocationId?.completePath || '',
      }));
    }
    case 'transfer_lines': {
      const rows = await InvMoveLine.find({ tenantId: tid })
        .populate('productId', 'sku nameEn')
        .populate('lotId', 'name')
        .populate('packageId', 'name')
        .populate('sourceLocationId', 'completePath')
        .populate('destLocationId', 'completePath')
        .populate('uomId', 'name')
        .populate({ path: 'transferId', select: 'name' })
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();
      return rows.map((ln) => ({
        picking: ln.transferId?.name || ln.reference || '',
        product: ln.productId?.nameEn || '',
        sku: ln.productId?.sku || '',
        demand: ln.quantity ?? '',
        quantity: ln.quantity ?? '',
        uom: ln.uomId?.name || '',
        lot: ln.lotId?.name || ln.lotName || '',
        package: ln.packageId?.name || '',
        sourceLoc: ln.sourceLocationId?.completePath || '',
        destLoc: ln.destLocationId?.completePath || '',
        state: ln.state || '',
        unitCost: '',
        value: '',
      }));
    }
    case 'stock': {
      const rows = await stockExportRows(tid, { warehouseId: filters.warehouseId });
      return rows.slice(0, limit).map((r) => ({
        product_sku: r.sku || r.product_sku || '',
        product: r.product || r.nameEn || '',
        location: r.location || r.completePath || '',
        quantity: r.quantity ?? r.onHand ?? '',
        reserved: r.reserved ?? '',
        lot: r.lot || '',
        package: r.package || '',
      }));
    }
    case 'moves_history': {
      const rows = await InvMoveLine.find({ tenantId: tid, state: 'done' })
        .populate('productId', 'sku nameEn')
        .populate('sourceLocationId', 'completePath')
        .populate('destLocationId', 'completePath')
        .populate('lotId', 'name')
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();
      return rows.map((m) => ({
        date: m.createdAt,
        reference: m.reference || '',
        product_sku: m.productId?.sku || '',
        product: m.productId?.nameEn || '',
        quantity: m.quantity,
        from: m.sourceLocationId?.completePath || '',
        to: m.destLocationId?.completePath || '',
        state: m.state,
        lot: m.lotId?.name || '',
      }));
    }
    case 'valuation': {
      const rows = await InvValuationLayer.find({ tenantId: tid })
        .populate('productId', 'sku nameEn')
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();
      return rows.map((v) => ({
        product_sku: v.productId?.sku || '',
        product: v.productId?.nameEn || '',
        quantity: v.quantity,
        unitCost: v.unitCost,
        value: v.value,
        date: v.createdAt,
      }));
    }
    case 'physical_inventory': {
      const res = await listInventoryQuants(tid, {
        warehouseId: filters.warehouseId,
        locationId: filters.locationId,
        filter: filters.filter,
        search: filters.search,
        page: 1,
        limit,
      });
      return (res.data || []).map((q) => ({
        location: q.locationId?.completePath || q.locationId?.name || '',
        warehouse: q.locationId?.warehouseId?.nameEn
          || q.locationId?.warehouseId?.nameAr
          || q.locationId?.warehouseId?.code
          || filters.warehouseId
          || '',
        product_sku: q.productId?.sku || '',
        product_name: q.productId?.nameEn || q.productId?.nameAr || '',
        uom: q.productId?.unitOfMeasure || q.uomId?.name || '',
        lot: q.lotId?.name || '',
        on_hand: q.quantity,
        counted_qty: q.countedQuantity ?? '',
        difference: q.countDifference ?? '',
        scheduled_date: q.countScheduledDate || '',
        filter: filters.filter || '',
      }));
    }
    case 'product_variants': {
      const rows = await InvProductVariant.find({ tenantId: tid })
        .populate('productId', 'sku')
        .limit(limit)
        .lean();
      return rows.map((v) => ({
        id: String(v._id),
        product_sku: v.productId?.sku || '',
        sku: v.sku || '',
        barcode: v.barcode || '',
        active: v.active !== false,
      }));
    }
    case 'vendors_pricelist': {
      const products = await Product.find({ tenantId: tid })
        .populate('suppliers.supplierId', 'name code')
        .select('sku nameEn suppliers currency')
        .limit(Math.min(limit, 5000))
        .lean();
      const out = [];
      for (const p of products) {
        for (const s of p.suppliers || []) {
          out.push({
            product: p.nameEn || '',
            product_sku: p.sku || '',
            vendor: s.supplierId?.name || '',
            vendorProductCode: s.supplierSku || '',
            minQty: s.minQty ?? '',
            price: s.cost ?? '',
            currency: p.currency || 'SAR',
            leadDays: s.leadTimeDays ?? '',
            validFrom: s.validFrom || '',
            validTo: s.validTo || '',
          });
          if (out.length >= limit) break;
        }
        if (out.length >= limit) break;
      }
      return out;
    }
    default:
      throw new InventoryValidationError(`Unknown IE model: ${model}`, 'IE_UNKNOWN');
  }
}

function projectRows(rows, fieldKeys) {
  return rows.map((row) => {
    const out = {};
    for (const key of fieldKeys) {
      out[key] = cell(dig(row, key) ?? row[key]);
    }
    return out;
  });
}

async function buildExportPayload(tenantId, {
  model,
  fields,
  importCompatible = false,
  format = 'csv',
  filters = {},
  allowCost = true,
  meta = {},
}) {
  const def = getIeModel(model);
  if (!def) throw new InventoryValidationError(`Unknown model: ${model}`, 'IE_UNKNOWN');

  let fieldKeys = Array.isArray(fields) && fields.length
    ? fields
    : [...(def.defaultExport || [])];

  if (importCompatible) {
    const allowed = new Set(flattenIeFields(model, { importCompatible: true }).map((f) => f.path));
    fieldKeys = fieldKeys.filter((k) => allowed.has(k) || k === 'id' || k === 'external_ref');
    if (!fieldKeys.includes('id')) fieldKeys = ['id', ...fieldKeys];
  }

  fieldKeys = filterFieldsByPermission(model, fieldKeys, { allowCost });

  const raw = await loadExportRows(tenantId, model, filters);
  const projected = projectRows(raw, fieldKeys);
  const csv = rowsToCsv(projected, fieldKeys, { bom: true });
  const filename = `${model}-export.${format === 'xlsx' ? 'xlsx' : 'csv'}`;

  if (format === 'xlsx') {
    const buf = await csvTextToXlsxBuffer(csv, model, {
      info: {
        model,
        exportDate: new Date().toISOString(),
        user: meta.userId || '',
        rowCount: projected.length,
        fields: fieldKeys.join(', '),
        filter: JSON.stringify(filters || {}),
      },
    });
    return {
      filename,
      format: 'xlsx',
      rowCount: projected.length,
      encoding: 'base64',
      payload: Buffer.from(buf).toString('base64'),
      mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  }
  return {
    filename,
    format: 'csv',
    rowCount: projected.length,
    encoding: 'utf8',
    payload: csv,
    mime: 'text/csv;charset=utf-8',
  };
}

/**
 * Export — sync under 5k rows; otherwise create a background job.
 */
export async function universalExport(tenantId, userId, opts) {
  const { model, fields, importCompatible, format, filters, forceAsync, allowCost = true } = opts;
  const def = getIeModel(model);
  if (!def) throw new InventoryValidationError(`Unknown model: ${model}`, 'IE_UNKNOWN');

  // Cheap count probe for known collections
  let approx = 0;
  try {
    const probe = await loadExportRows(tenantId, model, { ...filters, limit: SYNC_ROW_LIMIT + 1 });
    approx = probe.length;
  } catch {
    approx = 0;
  }

  if (!forceAsync && approx <= SYNC_ROW_LIMIT) {
    const built = await buildExportPayload(tenantId, {
      model,
      fields,
      importCompatible,
      format,
      filters,
      allowCost,
      meta: { userId },
    });
    await writeIeAudit(tenantId, userId, {
      action: 'export',
      model,
      format: built.format,
      rowCount: built.rowCount,
      fields: Array.isArray(fields) ? fields : undefined,
      filterJson: filters ? JSON.stringify(filters) : undefined,
      async: false,
    });
    return { async: false, ...built };
  }

  const expiresAt = new Date(Date.now() + EXPORT_JOB_TTL_MS);
  const job = await InvExportJob.create({
    tenantId: toObjectId(tenantId),
    userId,
    model,
    format: format === 'xlsx' ? 'xlsx' : 'csv',
    status: 'pending',
    expiresAt,
    fields: Array.isArray(fields) ? fields : undefined,
    filterJson: filters ? JSON.stringify(filters) : undefined,
  });

  // Persist opts on job via filename placeholder fields — store in error? Better: attach to enqueue payload
  const exportOpts = { model, fields, importCompatible, format, filters, allowCost };

  try {
    const { enqueueInventoryJob } = await import('./inventoryQueue.js');
    await enqueueInventoryJob({
      jobType: 'export',
      tenantId,
      userId,
      trigger: 'api',
      payload: { exportJobId: String(job._id), exportOpts },
    });
  } catch {
    // fallback inline
    setImmediate(() => runQueuedExport(tenantId, job._id, exportOpts));
  }

  await writeIeAudit(tenantId, userId, {
    action: 'export',
    model,
    format: format === 'xlsx' ? 'xlsx' : 'csv',
    fields: Array.isArray(fields) ? fields : undefined,
    filterJson: filters ? JSON.stringify(filters) : undefined,
    async: true,
    jobId: job._id,
  });

  return {
    async: true,
    jobId: job._id,
    message: 'Export queued — poll job status for download',
    threshold: SYNC_ROW_LIMIT,
  };
}

export async function runQueuedExport(tenantId, exportJobId, exportOpts = {}) {
  await InvExportJob.updateOne({ _id: exportJobId }, { $set: { status: 'running' } });
  try {
    const built = await buildExportPayload(tenantId, {
      model: exportOpts.model,
      fields: exportOpts.fields,
      importCompatible: exportOpts.importCompatible,
      format: exportOpts.format,
      filters: exportOpts.filters || {},
    });
    await InvExportJob.updateOne({ _id: exportJobId }, {
      $set: {
        status: 'done',
        rowCount: built.rowCount,
        filename: built.filename,
        payload: built.payload,
        payloadEncoding: built.encoding,
        expiresAt: new Date(Date.now() + EXPORT_JOB_TTL_MS),
      },
    });
    return built;
  } catch (err) {
    await InvExportJob.updateOne({ _id: exportJobId }, {
      $set: { status: 'failed', error: err.message || String(err) },
    });
    throw err;
  }
}

export async function getExportJob(tenantId, jobId) {
  const job = await InvExportJob.findOne({
    _id: jobId,
    tenantId: toObjectId(tenantId),
  }).lean();
  if (!job) throw new InventoryValidationError('Export job not found', 'JOB_NOT_FOUND');
  return job;
}

/**
 * Universal import — dry-run first. Dispatches to model-specific writers.
 * Never writes quant qty directly (products opening qty still uses adjustment transfers).
 */
export async function universalImport(tenantId, userId, {
  model,
  csvText,
  csv,
  xlsxBase64,
  rows: rawRows,
  columnMap,
  dryRun = true,
  warehouseId,
} = {}) {
  const def = getIeModel(model);
  if (!def) throw new InventoryValidationError(`Unknown model: ${model}`, 'IE_UNKNOWN');
  if (def.importable === false) {
    throw new InventoryValidationError(
      `Model ${model} is export-only (ledger / derived). Import would corrupt history.`,
      'IE_READONLY',
    );
  }

  let records = rawRows;
  if (!records?.length) {
    const text = await resolveImportCsvText({ csvText, csv, xlsxBase64 });
    const parsed = parseCsv(text);
    records = parsed.records;
  }
  if (!records?.length) {
    throw new InventoryValidationError('No data rows', 'CSV_EMPTY');
  }

  // Apply optional column remap: { fileHeader: modelField }
  if (columnMap && typeof columnMap === 'object') {
    records = records.map((row) => {
      const next = { ...row };
      for (const [from, to] of Object.entries(columnMap)) {
        if (from !== to && row[from] != null) {
          next[to] = row[from];
        }
      }
      return next;
    });
  }

  // Normalize common aliases
  records = records.map((row) => {
    const r = { ...row };
    if (r.id && !r.externalId) r.externalId = r.id;
    if (r.external_ref && !r.externalId) r.externalId = r.external_ref;
    if (r['Category / Name'] && !r.category) r.category = r['Category / Name'];
    return r;
  });

  if (model === 'products') {
    const result = await importProducts(tenantId, userId, {
      csvText: rowsToCsv(records, undefined, { bom: false }),
      dryRun,
      warehouseId,
    });
    const out = attachImportErrorFile(result, records);
    await writeIeAudit(tenantId, userId, {
      action: 'import',
      model,
      rowCount: out.totalRows || records.length,
      dryRun: !!dryRun,
      created: out.created ?? out.wouldCreate,
      updated: out.updated ?? out.wouldUpdate,
      errors: (out.errors || []).length,
    });
    return out;
  }
  if (model === 'locations') {
    const result = await importLocations(tenantId, userId, {
      csvText: rowsToCsv(records, undefined, { bom: false }),
      dryRun,
      warehouseId,
    });
    const out = attachImportErrorFile(result, records);
    await writeIeAudit(tenantId, userId, {
      action: 'import',
      model,
      rowCount: out.totalRows || records.length,
      dryRun: !!dryRun,
      created: out.created ?? out.wouldCreate,
      updated: out.updated ?? out.wouldUpdate,
      errors: (out.errors || []).length,
    });
    return out;
  }
  if (model === 'physical_inventory') {
    const result = await importCountedQuantities(tenantId, records, { dryRun, userId });
    const out = attachImportErrorFile(result, records);
    await writeIeAudit(tenantId, userId, {
      action: 'import',
      model,
      rowCount: out.totalRows || records.length,
      dryRun: !!dryRun,
      created: out.created ?? out.wouldCreate,
      updated: out.updated ?? out.wouldUpdate,
      errors: (out.errors || []).length,
    });
    return out;
  }

  // Generic create/update for simple masters
  const result = await genericMasterImport(tenantId, userId, model, records, dryRun);
  const out = attachImportErrorFile(result, records);
  await writeIeAudit(tenantId, userId, {
    action: 'import',
    model,
    rowCount: out.totalRows || records.length,
    dryRun: !!dryRun,
    created: out.created ?? out.wouldCreate,
    updated: out.updated ?? out.wouldUpdate,
    errors: (out.errors || []).length,
  });
  return out;
}

/** Build downloadable CSV of failed rows with original columns + `_error`. */
function attachImportErrorFile(result, records) {
  const errors = result?.errors || [];
  if (!errors.length) {
    return {
      ...result,
      unchanged: result.unchanged
        ?? Math.max(0, (result.totalRows || records.length) - (result.created || result.wouldCreate || 0) - (result.updated || result.wouldUpdate || 0) - errors.length),
    };
  }
  const byRow = new Map();
  for (const e of errors) {
    const msg = e.reason || e.message || 'error';
    const prev = byRow.get(e.row) || [];
    prev.push(`${e.field ? `${e.field}: ` : ''}${msg}`);
    byRow.set(e.row, prev);
  }
  const failRows = [];
  for (const [rowNum, msgs] of byRow) {
    const idx = Number(rowNum) - 2;
    const original = records[idx] || {};
    failRows.push({ ...original, _error: msgs.join('; ') });
  }
  const cols = [...new Set(failRows.flatMap((r) => Object.keys(r)))];
  const errorFileCsv = rowsToCsv(failRows, cols, { bom: true });
  return {
    ...result,
    unchanged: result.unchanged
      ?? Math.max(0, (result.totalRows || records.length) - (result.created || result.wouldCreate || 0) - (result.updated || result.wouldUpdate || 0) - errors.length),
    errorFileCsv,
    errorFileName: 'import-errors.csv',
  };
}

async function genericMasterImport(tenantId, userId, model, records, dryRun) {
  const tid = toObjectId(tenantId);
  const errors = [];
  const preview = [];
  let created = 0;
  let updated = 0;

  for (let i = 0; i < records.length; i += 1) {
    const row = records[i];
    const rowNum = i + 2;
    try {
      // eslint-disable-next-line no-await-in-loop
      const result = await importOneMaster(tid, userId, model, row, dryRun);
      preview.push({ row: rowNum, ...result });
      if (result.action === 'create') created += 1;
      if (result.action === 'update') updated += 1;
    } catch (err) {
      errors.push({
        row: rowNum,
        field: err.field || 'row',
        reason: err.message || String(err),
      });
    }
  }

  return {
    dryRun: !!dryRun,
    totalRows: records.length,
    matched: preview.length,
    unmatched: errors.length,
    created: dryRun ? preview.filter((p) => p.action === 'create').length : created,
    updated: dryRun ? preview.filter((p) => p.action === 'update').length : updated,
    wouldCreate: preview.filter((p) => p.action === 'create').length,
    wouldUpdate: preview.filter((p) => p.action === 'update').length,
    errors,
    preview: preview.slice(0, 50),
  };
}

async function importOneMaster(tid, userId, model, row, dryRun) {
  if (model === 'warehouses') {
    const code = String(row.code || '').trim();
    const nameEn = String(row.nameEn || row.name || '').trim();
    const id = String(row.id || row.externalId || '').trim();
    let doc = null;
    if (id && /^[a-f0-9]{24}$/i.test(id)) {
      doc = await Warehouse.findOne({ _id: id, tenantId: tid });
    }
    if (!doc && code) doc = await Warehouse.findOne({ tenantId: tid, code });
    if (!doc && !nameEn && !code) {
      const e = new Error('code or nameEn required');
      e.field = 'code';
      throw e;
    }
    if (dryRun) return { action: doc ? 'update' : 'create', code: code || doc?.code };
    if (doc) {
      if (nameEn) doc.nameEn = nameEn;
      if (row.nameAr != null) doc.nameAr = row.nameAr;
      if (row.active != null) doc.active = String(row.active).toLowerCase() !== 'false';
      await doc.save();
      return { action: 'update', id: String(doc._id) };
    }
    doc = await Warehouse.create({
      tenantId: tid,
      code: code || `WH${Date.now().toString(36).slice(-4)}`,
      nameEn: nameEn || code,
      nameAr: row.nameAr || '',
      createdBy: userId,
    });
    return { action: 'create', id: String(doc._id) };
  }

  if (model === 'lots') {
    const name = String(row.name || '').trim();
    const sku = String(row.product_sku || row.sku || '').trim();
    if (!name || !sku) {
      const e = new Error('name and product_sku required');
      e.field = 'name';
      throw e;
    }
    const product = await Product.findOne({ tenantId: tid, sku }).select('_id').lean();
    if (!product) {
      const e = new Error(`Product sku not found: ${sku}`);
      e.field = 'product_sku';
      throw e;
    }
    let doc = await InvLot.findOne({ tenantId: tid, productId: product._id, name });
    if (dryRun) return { action: doc ? 'update' : 'create', name, product_sku: sku };
    if (doc) {
      if (row.expirationDate) doc.expirationDate = new Date(row.expirationDate);
      if (row.removalDate) doc.removalDate = new Date(row.removalDate);
      await doc.save();
      return { action: 'update', id: String(doc._id) };
    }
    doc = await InvLot.create({
      tenantId: tid,
      productId: product._id,
      name,
      expirationDate: row.expirationDate ? new Date(row.expirationDate) : undefined,
      removalDate: row.removalDate ? new Date(row.removalDate) : undefined,
      createdBy: userId,
    });
    return { action: 'create', id: String(doc._id) };
  }

  if (model === 'product_categories') {
    const name = String(row.name || '').trim();
    if (!name) {
      const e = new Error('name required');
      e.field = 'name';
      throw e;
    }
    const id = String(row.id || '').trim();
    let doc = id && /^[a-f0-9]{24}$/i.test(id)
      ? await InvProductCategory.findOne({ _id: id, tenantId: tid })
      : await InvProductCategory.findOne({ tenantId: tid, name });
    if (dryRun) return { action: doc ? 'update' : 'create', name };
    if (doc) {
      doc.name = name;
      await doc.save();
      return { action: 'update', id: String(doc._id) };
    }
    doc = await InvProductCategory.create({
      tenantId: tid,
      name,
      completePath: name,
      createdBy: userId,
    });
    return { action: 'create', id: String(doc._id) };
  }

  if (model === 'product_variants') {
    const sku = String(row.sku || '').trim();
    const templateSku = String(row.product_sku || '').trim();
    if (!sku) {
      const e = new Error('sku required');
      e.field = 'sku';
      throw e;
    }
    let doc = await InvProductVariant.findOne({ tenantId: tid, sku });
    const product = templateSku
      ? await Product.findOne({ tenantId: tid, sku: templateSku }).select('_id').lean()
      : null;
    if (dryRun) return { action: doc ? 'update' : 'create', sku };
    if (doc) {
      if (row.barcode != null) doc.barcode = row.barcode;
      if (row.active != null) doc.active = String(row.active).toLowerCase() !== 'false';
      await doc.save();
      return { action: 'update', id: String(doc._id) };
    }
    if (!product) {
      const e = new Error('product_sku required to create variant');
      e.field = 'product_sku';
      throw e;
    }
    doc = await InvProductVariant.create({
      tenantId: tid,
      productId: product._id,
      name: row.name || sku,
      sku,
      barcode: row.barcode || undefined,
      combinationKey: row.combinationKey || `ie:${sku}`,
      active: String(row.active || 'true').toLowerCase() !== 'false',
      createdBy: userId,
    });
    return { action: 'create', id: String(doc._id) };
  }

  if (model === 'reorder_rules') {
    const sku = String(row.product_sku || '').trim();
    const locPath = String(row.location_path || row.location || '').trim();
    if (!sku || !locPath) {
      const e = new Error('product_sku and location_path required');
      e.field = 'product_sku';
      throw e;
    }
    const product = await Product.findOne({ tenantId: tid, sku }).select('_id').lean();
    const location = await InvLocation.findOne({
      tenantId: tid,
      $or: [{ completePath: locPath }, { name: locPath }],
    }).select('_id warehouseId').lean();
    if (!product || !location) {
      const e = new Error('product or location not found');
      e.field = !product ? 'product_sku' : 'location_path';
      throw e;
    }
    let doc = await InvReorderRule.findOne({
      tenantId: tid,
      productId: product._id,
      locationId: location._id,
    });
    if (dryRun) return { action: doc ? 'update' : 'create', product_sku: sku };
    const payload = {
      minQty: row.minQty ?? doc?.minQty ?? '0',
      maxQty: row.maxQty ?? doc?.maxQty ?? '0',
      qtyMultiple: row.qtyMultiple ?? doc?.qtyMultiple ?? '1',
      trigger: row.trigger || doc?.trigger || 'auto',
      active: row.active != null ? String(row.active).toLowerCase() !== 'false' : true,
    };
    if (doc) {
      Object.assign(doc, payload);
      await doc.save();
      return { action: 'update', id: String(doc._id) };
    }
    doc = await InvReorderRule.create({
      tenantId: tid,
      productId: product._id,
      locationId: location._id,
      warehouseId: location.warehouseId,
      ...payload,
      createdBy: userId,
    });
    return { action: 'create', id: String(doc._id) };
  }

  const e = new Error(`Import not implemented for ${model} in this pass — use dedicated tools`);
  e.field = 'model';
  throw e;
}

export async function listTemplates(tenantId, userId, model) {
  const tid = toObjectId(tenantId);
  const q = {
    tenantId: tid,
    ...(model ? { model } : {}),
    $or: [
      { userId },
      { isShared: true },
      { isSystem: true },
    ],
  };
  const userTemplates = await InvIeTemplate.find(q).sort({ isDefault: -1, name: 1 }).lean();

  // Merge system templates from registry (not necessarily persisted)
  const system = [];
  const models = model ? { [model]: IE_MODELS[model] } : IE_MODELS;
  for (const [key, def] of Object.entries(models)) {
    if (!def?.systemTemplates) continue;
    for (const tpl of def.systemTemplates) {
      const exists = userTemplates.some(
        (t) => t.isSystem && t.model === key && t.name === tpl.name,
      );
      if (!exists) {
        system.push({
          _id: `system:${key}:${tpl.name}`,
          model: key,
          name: tpl.name,
          nameAr: tpl.nameAr,
          fields: tpl.fields,
          format: tpl.format || 'xlsx',
          importCompatible: !!tpl.updateMode,
          updateMode: !!tpl.updateMode,
          isSystem: true,
          isShared: true,
          isDefault: false,
          readOnly: true,
        });
      }
    }
  }
  return [...system, ...userTemplates];
}

export async function saveTemplate(tenantId, userId, {
  model,
  name,
  fields,
  importCompatible,
  format,
  updateMode,
  isShared,
  isDefault,
}) {
  if (!model || !name) {
    throw new InventoryValidationError('model and name required', 'MISSING_FIELDS');
  }
  if (String(name).startsWith('system:')) {
    throw new InventoryValidationError('Cannot overwrite system template id', 'SYSTEM_TEMPLATE');
  }
  const tid = toObjectId(tenantId);
  if (isDefault) {
    await InvIeTemplate.updateMany(
      { tenantId: tid, userId, model, isDefault: true },
      { $set: { isDefault: false } },
    );
  }
  return InvIeTemplate.findOneAndUpdate(
    {
      tenantId: tid,
      userId,
      model,
      name: String(name).trim(),
    },
    {
      $set: {
        fields: Array.isArray(fields) ? fields : [],
        importCompatible: !!(importCompatible || updateMode),
        updateMode: !!updateMode,
        format: format === 'csv' ? 'csv' : 'xlsx',
        isShared: !!isShared,
        isDefault: !!isDefault,
        isSystem: false,
      },
      $setOnInsert: { createdBy: userId },
    },
    { upsert: true, new: true },
  ).lean();
}

export async function deleteTemplate(tenantId, userId, templateId) {
  const doc = await InvIeTemplate.findOne({
    _id: templateId,
    tenantId: toObjectId(tenantId),
  });
  if (doc?.isSystem) {
    throw new InventoryValidationError('Cannot delete system template', 'SYSTEM_TEMPLATE');
  }
  await InvIeTemplate.deleteOne({
    _id: templateId,
    tenantId: toObjectId(tenantId),
    userId,
  });
  return { ok: true };
}

export { listIeModels, flattenIeFields, getIeModel, SYNC_ROW_LIMIT, assertProductRegistryComplete };
