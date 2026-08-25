import { D, decStr } from '../../utils/decimal.js';
import Product from '../../models/Product.js';
import Warehouse from '../../models/Warehouse.js';
import InvLocation from '../../models/inventory/InvLocation.js';
import InvReorderRule from '../../models/inventory/InvReorderRule.js';
import InvLot from '../../models/inventory/InvLot.js';
import { toObjectId } from '../../models/inventory/common.js';
import { getDefaultUom } from './bootstrap.js';
import { setCountedQuantity } from './inventoryCount.js';
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
 * Optional countedQty + warehouseId → sets physical inventory counted qty (apply separately).
 */
export async function importProducts(tenantId, userId, {
  csvText,
  dryRun = true,
  warehouseId = null,
} = {}) {
  const tid = toObjectId(tenantId);
  const { records } = parseCsv(csvText);
  if (!records.length) throw new InventoryValidationError('CSV has no data rows', 'CSV_EMPTY');

  const defaultUom = await getDefaultUom(tid);
  const errors = [];
  const preview = [];
  let created = 0;
  let updated = 0;
  let countsQueued = 0;

  let stockLocationId = null;
  if (warehouseId) {
    const wh = await Warehouse.findOne({ _id: warehouseId, tenantId: tid }).lean();
    stockLocationId = wh?.stockLocationId || null;
  }

  for (let idx = 0; idx < records.length; idx += 1) {
    const row = records[idx];
    const rowNum = idx + 2;
    const sku = String(row.sku || '').trim();
    const nameEn = String(row.nameEn || row.name || '').trim();
    const externalId = String(row.externalId || '').trim();

    if (!sku && !externalId) {
      errors.push({ row: rowNum, message: 'sku or externalId required' });
      continue;
    }
    if (!nameEn && !externalId) {
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

    const payload = {
      sku: sku || product?.sku,
      nameEn: nameEn || product?.nameEn,
      nameAr: row.nameAr || product?.nameAr,
      barcode: row.barcode || product?.barcode,
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

    preview.push({
      row: rowNum,
      action: product ? 'update' : 'create',
      sku: payload.sku,
      externalId: payload.externalId,
      countedQty: row.countedQty || row.onHand || null,
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

    // Ledger-safe: queue counted qty only — never write quant
    const counted = row.countedQty ?? row.onHand;
    if (counted != null && counted !== '' && stockLocationId) {
      await setCountedQuantity(tid, {
        productId: product._id,
        locationId: stockLocationId,
        countedQty: decStr(counted),
        userId,
      });
      countsQueued += 1;
    } else if (counted != null && counted !== '' && !stockLocationId) {
      errors.push({
        row: rowNum,
        message: 'countedQty/onHand ignored — warehouseId required (use Physical Inventory Apply)',
      });
    }
  }

  return {
    dryRun: !!dryRun,
    totalRows: records.length,
    created,
    updated,
    countsQueued,
    errors,
    preview: dryRun ? preview.slice(0, 50) : preview.slice(0, 20),
  };
}
