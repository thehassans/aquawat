import { D, decStr } from '../../utils/decimal.js';
import Product from '../../models/Product.js';
import Warehouse from '../../models/Warehouse.js';
import InvLocation from '../../models/inventory/InvLocation.js';
import InvReorderRule from '../../models/inventory/InvReorderRule.js';
import InvLot from '../../models/inventory/InvLot.js';
import InvOperationType from '../../models/inventory/InvOperationType.js';
import { toObjectId } from '../../models/inventory/common.js';
import { getDefaultUom } from './bootstrap.js';
import { createTransfer } from './createTransfer.js';
import { confirmTransfer, validateTransfer } from './transferService.js';
import { InventoryValidationError } from './errors.js';
import { stockExportRows } from './reporting.js';

/** Escape one CSV cell */
export function csvEscape(v) {
  const s = v == null ? '' : String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function rowsToCsv(rows, columns) {
  const cols = columns || (rows[0] ? Object.keys(rows[0]) : []);
  const lines = [cols.join(',')];
  for (const row of rows) {
    lines.push(cols.map((c) => csvEscape(row[c])).join(','));
  }
  return `${lines.join('\n')}\n`;
}

/**
 * Minimal CSV parser (quoted fields supported).
 */
export function parseCsv(text) {
  const rows = [];
  let i = 0;
  const s = String(text || '').replace(/^\uFEFF/, '');
  while (i < s.length) {
    const row = [];
    while (i < s.length) {
      if (s[i] === '"') {
        i += 1;
        let cell = '';
        while (i < s.length) {
          if (s[i] === '"' && s[i + 1] === '"') {
            cell += '"';
            i += 2;
            continue;
          }
          if (s[i] === '"') {
            i += 1;
            break;
          }
          cell += s[i];
          i += 1;
        }
        row.push(cell);
      } else {
        let cell = '';
        while (i < s.length && s[i] !== ',' && s[i] !== '\n' && s[i] !== '\r') {
          cell += s[i];
          i += 1;
        }
        row.push(cell.trim());
      }
      if (s[i] === ',') {
        i += 1;
        continue;
      }
      break;
    }
    if (s[i] === '\r') i += 1;
    if (s[i] === '\n') i += 1;
    if (row.length > 1 || (row.length === 1 && row[0] !== '')) rows.push(row);
  }
  if (!rows.length) return { headers: [], records: [] };
  const headers = rows[0].map((h) => h.trim());
  const records = rows.slice(1).map((r) => {
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = r[idx] ?? '';
    });
    return obj;
  });
  return { headers, records };
}

/**
 * First sheet of an .xlsx/.xls buffer → CSV text for the existing parsers.
 * Does not change dry-run / adjustment-transfer semantics.
 */
export async function xlsxBufferToCsv(buffer) {
  const XLSX = await import('xlsx');
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) {
    throw new InventoryValidationError('Workbook has no sheets', 'XLSX_EMPTY');
  }
  return XLSX.utils.sheet_to_csv(wb.Sheets[sheetName]);
}

/**
 * Prefer xlsxBase64 when provided; otherwise csvText / csv.
 * Accepts optional data-URL prefix on the base64 string.
 */
export async function resolveImportCsvText({ csvText, csv, xlsxBase64 } = {}) {
  if (xlsxBase64) {
    const raw = String(xlsxBase64).replace(/^data:[^;]+;base64,/, '');
    const buf = Buffer.from(raw, 'base64');
    if (!buf.length) {
      throw new InventoryValidationError('Empty XLSX payload', 'XLSX_EMPTY');
    }
    return xlsxBufferToCsv(buf);
  }
  return String(csvText || csv || '');
}

/** CSV text → .xlsx buffer (single sheet) for download. */
export async function csvTextToXlsxBuffer(csvText, sheetName = 'Export') {
  const XLSX = await import('xlsx');
  const wb = XLSX.read(String(csvText || ''), { type: 'string' });
  if (sheetName && wb.SheetNames[0]) {
    const old = wb.SheetNames[0];
    const next = String(sheetName).slice(0, 31);
    if (old !== next) {
      wb.Sheets[next] = wb.Sheets[old];
      delete wb.Sheets[old];
      wb.SheetNames[0] = next;
    }
  }
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

const PRODUCT_EXPORT_COLUMNS = [
  'externalId', 'sku', 'barcode', 'nameEn', 'nameAr', 'costPrice', 'salePrice',
  'category', 'tracking', 'unitOfMeasure', 'canBeSold', 'canBePurchased',
];

export async function exportCollection(tenantId, collection, { warehouseId } = {}) {
  const tid = toObjectId(tenantId);

  if (collection === 'stock') {
    const rows = await stockExportRows(tid, { warehouseId });
    return { filename: 'stock-export.csv', csv: rowsToCsv(rows) };
  }

  if (collection === 'products') {
    const products = await Product.find({ tenantId: tid }).limit(5000).lean();
    const rows = products.map((p) => ({
      externalId: p.externalId || String(p._id),
      sku: p.sku,
      barcode: p.barcode || '',
      nameEn: p.nameEn,
      nameAr: p.nameAr || '',
      costPrice: p.costPrice ?? 0,
      salePrice: p.salePrice ?? p.sellingPrice ?? 0,
      category: p.category || '',
      tracking: p.tracking || 'none',
      unitOfMeasure: p.unitOfMeasure || 'PCE',
      canBeSold: p.canBeSold !== false,
      canBePurchased: p.canBePurchased !== false,
    }));
    return { filename: 'products-export.csv', csv: rowsToCsv(rows, PRODUCT_EXPORT_COLUMNS) };
  }

  if (collection === 'locations') {
    const locs = await InvLocation.find({ tenantId: tid }).sort({ completePath: 1 }).lean();
    const rows = locs.map((l) => ({
      externalId: String(l._id),
      completePath: l.completePath,
      name: l.name,
      usage: l.usage,
      warehouseId: l.warehouseId || '',
      barcode: l.barcode || '',
      active: l.active !== false,
    }));
    return { filename: 'locations-export.csv', csv: rowsToCsv(rows) };
  }

  if (collection === 'reorder-rules') {
    const rules = await InvReorderRule.find({ tenantId: tid }).lean();
    const rows = rules.map((r) => ({
      externalId: String(r._id),
      productId: r.productId,
      locationId: r.locationId,
      warehouseId: r.warehouseId,
      minQty: r.minQty,
      maxQty: r.maxQty,
      qtyMultiple: r.qtyMultiple,
      trigger: r.trigger,
      active: r.active !== false,
    }));
    return { filename: 'reorder-rules-export.csv', csv: rowsToCsv(rows) };
  }

  if (collection === 'lots') {
    const lots = await InvLot.find({ tenantId: tid }).limit(5000).lean();
    const rows = lots.map((l) => ({
      externalId: String(l._id),
      name: l.name,
      productId: l.productId,
      expirationDate: l.expirationDate || '',
      removalDate: l.removalDate || '',
    }));
    return { filename: 'lots-export.csv', csv: rowsToCsv(rows) };
  }

  throw new InventoryValidationError(`Unknown export collection: ${collection}`, 'EXPORT_UNKNOWN');
}

/**
 * Import products by externalId/sku. Never writes quants directly.
 * Optional countedQty/onHand + warehouseId → inventory adjustment transfer (not a direct write).
 */
export async function importProducts(tenantId, userId, {
  csvText,
  csv,
  xlsxBase64,
  dryRun = true,
  warehouseId = null,
} = {}) {
  const tid = toObjectId(tenantId);
  const text = await resolveImportCsvText({ csvText, csv, xlsxBase64 });
  const { records } = parseCsv(text);
  if (!records.length) throw new InventoryValidationError('CSV has no data rows', 'CSV_EMPTY');

  const defaultUom = await getDefaultUom(tid);
  const errors = [];
  const preview = [];
  let created = 0;
  let updated = 0;
  let openingPosted = 0;

  let wh = null;
  let adjLoc = null;
  let opType = null;
  if (warehouseId) {
    wh = await Warehouse.findOne({ _id: warehouseId, tenantId: tid }).lean();
    if (wh?.stockLocationId) {
      adjLoc = await InvLocation.findOne({
        tenantId: tid,
        usage: 'inventoryLoss',
        completePath: /Inventory adjustment$/,
      }).lean();
      opType = await InvOperationType.findOne({
        tenantId: tid,
        warehouseId: wh._id,
        sequenceCode: `${(wh.code || 'WH').toUpperCase()}/ADJ`,
      }).lean();
    }
  }

  for (let idx = 0; idx < records.length; idx += 1) {
    const row = records[idx];
    const rowNum = idx + 2;
    const sku = String(row.sku || '').trim();
    const nameEn = String(row.nameEn || row.name || '').trim();
    const externalId = String(row.externalId || '').trim();
    const barcode = String(row.barcode || '').trim();

    if (!sku && !externalId && !barcode) {
      errors.push({ row: rowNum, message: 'sku, barcode or externalId required' });
      continue;
    }
    if (!nameEn && !externalId && !barcode) {
      errors.push({ row: rowNum, message: 'nameEn required for create' });
      continue;
    }

    let product = null;
    if (externalId) {
      const or = [{ externalId }];
      if (/^[a-f0-9]{24}$/i.test(externalId)) or.push({ _id: externalId });
      product = await Product.findOne({ tenantId: tid, $or: or });
    }
    if (!product && sku) {
      product = await Product.findOne({ tenantId: tid, sku });
    }
    if (!product && barcode) {
      product = await Product.findOne({ tenantId: tid, barcode });
    }

    const payload = {
      sku: sku || product?.sku,
      nameEn: nameEn || product?.nameEn,
      nameAr: row.nameAr || product?.nameAr,
      barcode: barcode || product?.barcode,
      costPrice: row.costPrice !== '' && row.costPrice != null ? Number(row.costPrice) : product?.costPrice,
      category: row.category || product?.category,
      tracking: ['none', 'lot', 'serial'].includes(row.tracking) ? row.tracking : (product?.tracking || 'none'),
      unitOfMeasure: row.unitOfMeasure || product?.unitOfMeasure || 'PCE',
      uomId: product?.uomId || defaultUom?._id,
      externalId: externalId || product?.externalId || undefined,
    };

    if (row.salePrice !== '' && row.salePrice != null) {
      payload.salePrice = Number(row.salePrice);
    }

    const openingQty = row.countedQty ?? row.onHand ?? row.openingQty;
    preview.push({
      row: rowNum,
      action: product ? 'update' : 'create',
      sku: payload.sku,
      barcode: payload.barcode,
      externalId: payload.externalId,
      openingQty: openingQty || null,
      openingVia: openingQty != null && openingQty !== '' ? 'inventory_adjustment' : null,
    });

    if (dryRun) continue;

    if (product) {
      Object.assign(product, payload);
      if (userId) product.updatedBy = userId;
      await product.save();
      updated += 1;
    } else {
      if (!payload.nameEn || !payload.sku) {
        errors.push({ row: rowNum, message: 'Cannot create without sku and nameEn' });
        continue;
      }
      product = await Product.create({
        tenantId: tid,
        ...payload,
        createdBy: userId,
      });
      created += 1;
    }

    if (openingQty != null && openingQty !== '') {
      if (!wh?.stockLocationId || !adjLoc || !opType) {
        errors.push({
          row: rowNum,
          message: 'opening qty needs warehouseId with bootstrapped adjustment op type',
        });
        continue;
      }
      try {
        const qty = D(openingQty);
        if (qty.isZero()) continue;
        const isPositive = qty.gt(0);
        const transfer = await createTransfer(tid, {
          operationTypeId: opType._id,
          sourceLocationId: isPositive ? adjLoc._id : wh.stockLocationId,
          destLocationId: isPositive ? wh.stockLocationId : adjLoc._id,
          origin: `Import opening ${product.sku || product._id}`,
          note: 'CSV import opening stock (adjustment transfer)',
          sourceModel: 'import',
          sourceDocId: product._id,
          lines: [{
            productId: product._id,
            demandQty: decStr(qty.abs()),
            uomId: product.uomId || defaultUom._id,
          }],
        }, userId);
        await confirmTransfer(tid, transfer._id, userId);
        await validateTransfer(tid, transfer._id, {
          userId,
          immediate: true,
          createBackorder: false,
        });
        openingPosted += 1;
      } catch (err) {
        errors.push({ row: rowNum, message: err.message || 'opening adjustment failed' });
      }
    }
  }

  return {
    dryRun: !!dryRun,
    totalRows: records.length,
    created,
    updated,
    openingPosted,
    countsQueued: openingPosted,
    errors,
    preview: dryRun ? preview.slice(0, 50) : preview.slice(0, 20),
  };
}

/**
 * Import locations (name/path/usage) — dry-run then create under warehouse.
 */
export async function importLocations(tenantId, userId, {
  csvText,
  csv,
  xlsxBase64,
  dryRun = true,
  warehouseId = null,
} = {}) {
  const tid = toObjectId(tenantId);
  const text = await resolveImportCsvText({ csvText, csv, xlsxBase64 });
  const { records } = parseCsv(text);
  if (!records.length) throw new InventoryValidationError('CSV has no data rows', 'CSV_EMPTY');
  if (!warehouseId) throw new InventoryValidationError('warehouseId required', 'WH_REQUIRED');

  const wh = await Warehouse.findOne({ _id: warehouseId, tenantId: tid }).lean();
  if (!wh) throw new InventoryValidationError('Warehouse not found', 'WH_NOT_FOUND');

  const errors = [];
  const preview = [];
  let created = 0;

  for (let idx = 0; idx < records.length; idx += 1) {
    const row = records[idx];
    const rowNum = idx + 2;
    const name = String(row.name || '').trim();
    const barcode = String(row.barcode || '').trim();
    if (!name) {
      errors.push({ row: rowNum, message: 'name required' });
      continue;
    }
    const usage = ['internal', 'view', 'supplier', 'customer', 'inventoryLoss', 'production', 'transit']
      .includes(row.usage) ? row.usage : 'internal';
    preview.push({ row: rowNum, action: 'create', name, usage, barcode });
    if (dryRun) continue;

    const { createLocation } = await import('./configMasters.js');
    try {
      await createLocation(tid, userId, {
        name,
        nameAr: row.nameAr,
        usage,
        warehouseId: wh._id,
        parentId: wh.stockLocationId || null,
        barcode: barcode || undefined,
      });
      created += 1;
    } catch (err) {
      errors.push({ row: rowNum, message: err.message });
    }
  }

  return {
    dryRun: !!dryRun,
    totalRows: records.length,
    created,
    errors,
    preview: preview.slice(0, 50),
  };
}
