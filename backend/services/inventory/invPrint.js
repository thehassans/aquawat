/**
 * Server-side inventory PDF print engine (v4.1 P2).
 * Uses Puppeteer for A4 bilingual HTML→PDF. Arabic shaping relies on Chromium.
 */

import puppeteer from 'puppeteer';
import Tenant from '../../models/Tenant.js';
import {
  InvTransfer,
  InvMoveLine,
  InvLocation,
  InvLot,
} from '../../models/inventory/index.js';
import Product from '../../models/Product.js';
import { toObjectId } from '../../models/inventory/common.js';
import { InventoryValidationError } from './errors.js';
import { listInventoryQuants } from './inventoryCount.js';

export const PRINT_LAYOUTS = [
  'goods_receipt',
  'delivery_note',
  'delivery_note_priced',
  'picking_list',
  'batch_picking',
  'internal_transfer',
  'return_note',
  'scrap_note',
  'count_sheet_blind',
  'count_sheet_open',
  'count_variance',
  'stock_report',
  'product_label',
  'lot_label',
  'package_label',
  'shipping_label',
  'location_label',
  'putaway_slip',
  'reorder_sheet',
];

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function companyHeader(tenant, { title, docNo, date, lang = 'ar' }) {
  const nameAr = tenant?.nameAr || tenant?.name || '';
  const nameEn = tenant?.nameEn || tenant?.name || '';
  const vat = tenant?.vatNumber || tenant?.taxNumber || '';
  const cr = tenant?.crNumber || tenant?.commercialRegistration || '';
  const rtl = lang === 'ar';
  return `
  <header class="hdr" dir="${rtl ? 'rtl' : 'ltr'}">
    <div class="brand">
      <div class="name-ar">${esc(nameAr)}</div>
      <div class="name-en">${esc(nameEn)}</div>
      <div class="meta">VAT: ${esc(vat)} · CR: ${esc(cr)}</div>
    </div>
    <div class="doc">
      <div class="title">${esc(title)}</div>
      <div>${esc(docNo || '')}</div>
      <div>${esc(date || '')}</div>
    </div>
  </header>`;
}

function watermark(state) {
  if (!state) return '';
  const t = String(state).toUpperCase();
  if (t !== 'DRAFT' && t !== 'CANCELLED' && t !== 'CANCELED') return '';
  return `<div class="wm">${esc(t === 'CANCELED' ? 'CANCELLED' : t)}</div>`;
}

function baseCss() {
  return `
  @page { size: A4; margin: 12mm; }
  body { font-family: 'Segoe UI', Tahoma, 'Noto Naskh Arabic', Arial, sans-serif; font-size: 11px; color: #111; }
  .hdr { display: flex; justify-content: space-between; border-bottom: 2px solid #0f172a; padding-bottom: 8px; margin-bottom: 12px; }
  .name-ar { font-size: 16px; font-weight: 700; }
  .name-en { font-size: 12px; color: #475569; }
  .title { font-size: 14px; font-weight: 700; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th, td { border: 1px solid #cbd5e1; padding: 4px 6px; vertical-align: top; }
  th { background: #f1f5f9; font-size: 10px; text-transform: uppercase; }
  .wm { position: fixed; top: 40%; left: 10%; font-size: 72px; color: rgba(220,38,38,0.12); transform: rotate(-30deg); font-weight: 800; z-index: 0; pointer-events: none; }
  .sigs { display: flex; gap: 24px; margin-top: 28px; }
  .sig { flex: 1; border-top: 1px solid #94a3b8; padding-top: 6px; min-height: 48px; }
  .footer { margin-top: 16px; font-size: 10px; color: #64748b; display: flex; justify-content: space-between; }
  .label-page { page-break-after: always; width: 50mm; height: 25mm; padding: 2mm; border: 1px dashed #94a3b8; }
  .loc-label { text-align: center; padding: 24px; }
  .loc-label .big { font-size: 22px; font-weight: 700; margin-bottom: 8px; }
  .barcode { font-family: 'Libre Barcode 128', monospace; font-size: 36px; letter-spacing: 2px; }
  `;
}

async function htmlToPdf(html, { landscape = false } = {}) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--font-render-hinting=none'],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 60000 });
    const pdf = await page.pdf({
      format: 'A4',
      landscape,
      printBackground: true,
      margin: { top: '10mm', bottom: '12mm', left: '10mm', right: '10mm' },
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate: '<div style="font-size:9px;width:100%;text-align:center;color:#64748b;"><span class="pageNumber"></span> / <span class="totalPages"></span></div>',
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

async function loadTenant(tenantId) {
  return Tenant.findById(tenantId).lean();
}

async function loadTransferBundle(tenantId, transferId) {
  const tid = toObjectId(tenantId);
  const transfer = await InvTransfer.findOne({ _id: transferId, tenantId: tid })
    .populate('operationTypeId', 'name code type')
    .populate('locationId', 'name completePath')
    .populate('locationDestId', 'name completePath')
    .populate('partnerId', 'name nameAr vatNumber')
    .lean();
  if (!transfer) throw new InventoryValidationError('Transfer not found', 'NOT_FOUND');
  const lines = await InvMoveLine.find({ tenantId: tid, transferId: transfer._id })
    .populate('productId', 'nameEn nameAr sku barcode')
    .populate('lotId', 'name expirationDate')
    .populate('packageId', 'name')
    .populate('locationId', 'name completePath pickSequence')
    .populate('locationDestId', 'name completePath')
    .lean();
  return { transfer, lines };
}

function transferDocHtml({ tenant, transfer, lines, layout, lang, showPrices }) {
  const titles = {
    goods_receipt: { ar: 'إذن استلام بضاعة', en: 'Goods Receipt Note' },
    delivery_note: { ar: 'إذن تسليم', en: 'Delivery Note' },
    delivery_note_priced: { ar: 'إذن تسليم بأسعار', en: 'Delivery Note (Priced)' },
    picking_list: { ar: 'قائمة تجهيز', en: 'Picking List' },
    internal_transfer: { ar: 'نقل داخلي', en: 'Internal Transfer Note' },
    return_note: { ar: 'إذن مرتجع', en: 'Return Note' },
    scrap_note: { ar: 'إذن إتلاف', en: 'Scrap Note' },
  };
  const t = titles[layout] || { ar: layout, en: layout };
  const title = lang === 'ar' ? t.ar : t.en;
  const sorted = [...lines].sort((a, b) => {
    const sa = a.locationId?.pickSequence ?? 0;
    const sb = b.locationId?.pickSequence ?? 0;
    return sa - sb;
  });
  const priceCols = showPrices
    ? '<th>Unit</th><th>Total</th>'
    : '';
  const rows = sorted.map((ln, i) => {
    const p = ln.productId || {};
    const name = lang === 'ar' && p.nameAr ? p.nameAr : (p.nameEn || '');
    const name2 = lang === 'ar' ? (p.nameEn || '') : (p.nameAr || '');
    const qty = ln.qtyDone || ln.productQty || ln.quantity || '';
    const price = showPrices ? `<td>${esc(ln.priceUnit || '')}</td><td>${esc(ln.priceSubtotal || '')}</td>` : '';
    const check = layout === 'picking_list' ? '<td>☐</td>' : `<td>${i + 1}</td>`;
    return `<tr>
      ${check}
      <td>${layout === 'picking_list' ? esc(ln.locationId?.completePath || '') : ''}
      <div><strong>${esc(name)}</strong></div><div style="color:#64748b">${esc(name2)}</div></td>
      <td>${esc(p.sku)}</td>
      ${layout === 'picking_list' ? `<td>${esc(p.barcode || '')}</td>` : ''}
      <td>${esc(qty)}</td>
      <td>${esc(ln.lotId?.name || '')}</td>
      <td>${esc(ln.packageId?.name || '')}</td>
      ${price}
    </tr>`;
  }).join('');

  return `<!DOCTYPE html><html lang="${lang}" dir="${lang === 'ar' ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"/><style>${baseCss()}</style></head><body>
  ${watermark(transfer.state)}
  ${companyHeader(tenant, { title, docNo: transfer.name, date: transfer.scheduledDate || transfer.dateDone, lang })}
  <div class="meta-row">
    <div>${lang === 'ar' ? 'الشريك' : 'Partner'}: ${esc(transfer.partnerId?.nameAr || transfer.partnerId?.name || '')}</div>
    <div>${lang === 'ar' ? 'من' : 'From'}: ${esc(transfer.locationId?.completePath || '')}</div>
    <div>${lang === 'ar' ? 'إلى' : 'To'}: ${esc(transfer.locationDestId?.completePath || '')}</div>
  </div>
  <table>
    <thead><tr>
      <th>#</th>
      <th>${layout === 'picking_list' ? (lang === 'ar' ? 'موقع · منتج' : 'Loc · Product') : (lang === 'ar' ? 'المنتج' : 'Product')}</th>
      <th>SKU</th>
      ${layout === 'picking_list' ? '<th>Barcode</th>' : ''}
      <th>${lang === 'ar' ? 'الكمية' : 'Qty'}</th>
      <th>${lang === 'ar' ? 'دفعة' : 'Lot'}</th>
      <th>${lang === 'ar' ? 'عبوة' : 'Pkg'}</th>
      ${priceCols}
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="sigs">
    <div class="sig">${lang === 'ar' ? 'استلم / جهّز' : 'Received / Picked'}</div>
    <div class="sig">${lang === 'ar' ? 'راجع' : 'Checked by'}</div>
  </div>
  <div class="footer"><span>${esc(transfer.origin || '')}</span><span>${new Date().toISOString().slice(0, 10)}</span></div>
  </body></html>`;
}

async function countSheetHtml(tenantId, { blind, filters, lang }) {
  const tenant = await loadTenant(tenantId);
  const { data } = await listInventoryQuants(tenantId, { ...filters, limit: 2000, page: 1 });
  const title = blind
    ? (lang === 'ar' ? 'ورقة جرد (عمياء)' : 'Count Sheet (Blind)')
    : (lang === 'ar' ? 'ورقة جرد' : 'Count Sheet');
  const byLoc = {};
  for (const row of data) {
    const key = row.locationId?.completePath || row.locationId?.name || '—';
    if (!byLoc[key]) byLoc[key] = [];
    byLoc[key].push(row);
  }
  const sections = Object.entries(byLoc).map(([loc, rows]) => {
    const tr = rows.map((r) => {
      const p = r.productId || {};
      const name = lang === 'ar' && p.nameAr ? p.nameAr : p.nameEn;
      return `<tr>
        <td>${esc(name)}</td><td>${esc(p.sku)}</td><td>${esc(p.barcode || '')}</td>
        <td>${esc(r.uom || p.unitOfMeasure || '')}</td>
        <td>${esc(r.lotId?.name || '')}</td>
        ${blind ? '' : `<td>${esc(r.quantity)}</td>`}
        <td style="height:22px;min-width:60px"></td>
        ${blind ? '' : '<td></td>'}
      </tr>`;
    }).join('');
    return `<section style="margin-bottom:18px">
      <h3>${esc(loc)} <span class="barcode">${esc(rows[0]?.locationId?.barcode || '')}</span></h3>
      <table><thead><tr>
        <th>${lang === 'ar' ? 'المنتج' : 'Product'}</th><th>SKU</th><th>Barcode</th><th>UoM</th><th>Lot</th>
        ${blind ? '' : `<th>${lang === 'ar' ? 'المتاح' : 'On Hand'}</th>`}
        <th>${lang === 'ar' ? 'العد' : 'Counted'}</th>
        ${blind ? '' : `<th>${lang === 'ar' ? 'الفرق' : 'Diff'}</th>`}
      </tr></thead><tbody>${tr}</tbody></table>
    </section>`;
  }).join('');

  return `<!DOCTYPE html><html lang="${lang}" dir="${lang === 'ar' ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"/><style>${baseCss()}</style></head><body>
  ${companyHeader(tenant, { title, date: new Date().toISOString().slice(0, 10), lang })}
  ${sections}
  <div class="sigs"><div class="sig">${lang === 'ar' ? 'توقيع العداد' : 'Counter signature'}</div></div>
  </body></html>`;
}

async function locationLabelsHtml(tenantId, { locationIds, lang }) {
  const tenant = await loadTenant(tenantId);
  const tid = toObjectId(tenantId);
  const q = { tenantId: tid };
  if (locationIds?.length) q._id = { $in: locationIds };
  else q.usage = 'internal';
  const locs = await InvLocation.find(q).sort({ completePath: 1 }).limit(200).lean();
  const pages = locs.map((l) => `
    <div class="loc-label" style="page-break-after:always">
      ${companyHeader(tenant, { title: lang === 'ar' ? 'ملصق موقع' : 'Location Label', lang })}
      <div class="big">${esc(l.completePath || l.name)}</div>
      <div class="barcode">${esc(l.barcode || l._id)}</div>
      <div style="margin-top:8px;font-size:12px">${esc(l.barcode || '')}</div>
    </div>`).join('');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>${baseCss()}</style></head><body>${pages}</body></html>`;
}

async function qrDataUrl(text) {
  try {
    const QRCode = (await import('qrcode')).default;
    return await QRCode.toDataURL(String(text || ''), { margin: 1, width: 120 });
  } catch {
    return '';
  }
}

/** GS1 DataMatrix payload (AI 01 GTIN, 10 lot, 17 expiry YYMMDD) — rendered as QR until DataMatrix font available. */
function gs1Payload({ gtin, lot, expiry }) {
  const parts = [];
  if (gtin) parts.push(`01${String(gtin).padStart(14, '0').slice(-14)}`);
  if (lot) parts.push(`10${lot}`);
  if (expiry) {
    const d = new Date(expiry);
    if (!Number.isNaN(d.getTime())) {
      const yy = String(d.getFullYear()).slice(-2);
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      parts.push(`17${yy}${mm}${dd}`);
    }
  }
  return parts.join('');
}

async function countVarianceHtml(tenantId, { filters, lang }) {
  const tenant = await loadTenant(tenantId);
  const { data } = await listInventoryQuants(tenantId, {
    ...filters,
    filter: filters?.filter || 'toApply',
    limit: 2000,
    page: 1,
  });
  let pos = 0;
  let neg = 0;
  let net = 0;
  const rows = data.filter((r) => r.isCountSet).map((r) => {
    const diff = Number(r.countDifference || 0);
    const cost = Number(r.productId?.costPrice || 0);
    const impact = diff * cost;
    if (impact > 0) pos += impact;
    if (impact < 0) neg += impact;
    net += impact;
    const p = r.productId || {};
    return `<tr>
      <td>${esc(r.locationId?.completePath || '')}</td>
      <td>${esc(lang === 'ar' && p.nameAr ? p.nameAr : p.nameEn)}</td>
      <td>${esc(r.quantity)}</td>
      <td>${esc(r.countedQuantity)}</td>
      <td>${esc(r.countDifference)}</td>
      <td>${esc(cost.toFixed(2))}</td>
      <td>${esc(impact.toFixed(2))}</td>
      <td>${esc(r.reasonCode || '')}</td>
    </tr>`;
  }).join('');
  const title = lang === 'ar' ? 'تقرير فروقات الجرد' : 'Count Variance Report';
  return `<!DOCTYPE html><html lang="${lang}" dir="${lang === 'ar' ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"/><style>${baseCss()}</style></head><body>
  ${companyHeader(tenant, { title, date: new Date().toISOString().slice(0, 10), lang })}
  <table><thead><tr>
    <th>${lang === 'ar' ? 'الموقع' : 'Location'}</th>
    <th>${lang === 'ar' ? 'المنتج' : 'Product'}</th>
    <th>${lang === 'ar' ? 'النظام' : 'System'}</th>
    <th>${lang === 'ar' ? 'العد' : 'Counted'}</th>
    <th>${lang === 'ar' ? 'الفرق' : 'Diff'}</th>
    <th>${lang === 'ar' ? 'تكلفة' : 'Unit cost'}</th>
    <th>${lang === 'ar' ? 'الأثر' : 'Value'}</th>
    <th>${lang === 'ar' ? 'السبب' : 'Reason'}</th>
  </tr></thead><tbody>${rows}</tbody></table>
  <p><strong>${lang === 'ar' ? 'موجب' : 'Positive'}:</strong> ${pos.toFixed(2)}
     · <strong>${lang === 'ar' ? 'سالب' : 'Negative'}:</strong> ${neg.toFixed(2)}
     · <strong>${lang === 'ar' ? 'صافي' : 'Net'}:</strong> ${net.toFixed(2)} SAR</p>
  <div class="sigs"><div class="sig">${lang === 'ar' ? 'اعتماد الإدارة' : 'Management approval'}</div></div>
  </body></html>`;
}

async function stockReportHtml(tenantId, { filters, lang }) {
  const tenant = await loadTenant(tenantId);
  const { stockExportRows } = await import('./reporting.js');
  const rows = await stockExportRows(toObjectId(tenantId), { warehouseId: filters?.warehouseId });
  const title = lang === 'ar' ? 'تقرير المخزون / التقييم' : 'Stock / Valuation Report';
  const filterDesc = JSON.stringify(filters || {});
  const body = (rows || []).slice(0, 2000).map((r) => `<tr>
    <td>${esc(r.product || r.nameEn || '')}</td>
    <td>${esc(r.sku || r.product_sku || '')}</td>
    <td>${esc(r.warehouse || '')}</td>
    <td>${esc(r.location || r.completePath || '')}</td>
    <td>${esc(r.quantity ?? r.onHand ?? '')}</td>
    <td>${esc(r.unitCost ?? '')}</td>
    <td>${esc(r.totalValue ?? r.value ?? '')}</td>
  </tr>`).join('');
  return `<!DOCTYPE html><html lang="${lang}" dir="${lang === 'ar' ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"/><style>${baseCss()}</style></head><body>
  ${companyHeader(tenant, { title, date: new Date().toISOString().slice(0, 10), lang })}
  <p style="font-size:10px;color:#64748b">${lang === 'ar' ? 'الفلاتر' : 'Filters'}: ${esc(filterDesc)}</p>
  <table><thead><tr>
    <th>${lang === 'ar' ? 'المنتج' : 'Product'}</th><th>SKU</th>
    <th>${lang === 'ar' ? 'مستودع' : 'WH'}</th><th>${lang === 'ar' ? 'موقع' : 'Location'}</th>
    <th>${lang === 'ar' ? 'رصيد' : 'On Hand'}</th><th>${lang === 'ar' ? 'تكلفة' : 'Cost'}</th>
    <th>${lang === 'ar' ? 'قيمة' : 'Value'}</th>
  </tr></thead><tbody>${body}</tbody></table>
  </body></html>`;
}

async function productLabelsHtml(tenantId, { productIds, copies = 1, lang, preset = '50x25' }) {
  const tenant = await loadTenant(tenantId);
  const tid = toObjectId(tenantId);
  const q = { tenantId: tid };
  if (productIds?.length) q._id = { $in: productIds };
  const products = await Product.find(q).limit(100).lean();
  const size = preset === '100x50' ? 'width:100mm;height:50mm' : preset === '40x30' ? 'width:40mm;height:30mm' : 'width:50mm;height:25mm';
  const pages = [];
  for (const p of products) {
    const qr = await qrDataUrl(p.barcode || p.sku || String(p._id));
    for (let i = 0; i < Math.max(1, Number(copies) || 1); i += 1) {
      pages.push(`<div class="label-page" style="${size};page-break-after:always;padding:3mm">
        <div style="font-weight:700;font-size:12px">${esc(lang === 'ar' && p.nameAr ? p.nameAr : p.nameEn)}</div>
        <div style="font-size:10px;color:#475569">${esc(lang === 'ar' ? p.nameEn : p.nameAr || '')}</div>
        <div>SKU: ${esc(p.sku)}</div>
        <div class="barcode">${esc(p.barcode || p.sku)}</div>
        <div>${esc(p.sellingPrice ?? p.salePrice ?? '')} SAR</div>
        ${qr ? `<img src="${qr}" width="64" height="64" alt="qr"/>` : ''}
      </div>`);
    }
  }
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>${baseCss()}</style></head><body>${pages.join('')}</body></html>`;
}

async function lotLabelsHtml(tenantId, { lotIds, lang }) {
  const tenant = await loadTenant(tenantId);
  const tid = toObjectId(tenantId);
  const q = { tenantId: tid };
  if (lotIds?.length) q._id = { $in: lotIds };
  const lots = await InvLot.find(q).populate('productId', 'nameEn nameAr sku barcode').limit(100).lean();
  const pages = [];
  for (const lot of lots) {
    const p = lot.productId || {};
    const gs1 = gs1Payload({
      gtin: p.barcode,
      lot: lot.name,
      expiry: lot.expirationDate,
    });
    const qr = await qrDataUrl(gs1 || lot.name);
    pages.push(`<div class="label-page" style="width:70mm;height:40mm;page-break-after:always;padding:3mm">
      ${companyHeader(tenant, { title: lang === 'ar' ? 'ملصق دفعة' : 'Lot Label', lang })}
      <div><strong>${esc(p.nameEn || p.nameAr)}</strong></div>
      <div>${lang === 'ar' ? 'دفعة' : 'Lot'}: ${esc(lot.name)}</div>
      <div>${lang === 'ar' ? 'إنتاج' : 'Prod'}: ${esc(lot.productionDate || '')}</div>
      <div>${lang === 'ar' ? 'انتهاء' : 'Expiry'}: ${esc(lot.expirationDate || '')}</div>
      <div style="font-size:9px;word-break:break-all">GS1: ${esc(gs1)}</div>
      ${qr ? `<img src="${qr}" width="80" height="80" alt="gs1"/>` : ''}
    </div>`);
  }
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>${baseCss()}</style></head><body>${pages.join('')}</body></html>`;
}

async function packageLabelsHtml(tenantId, { packageIds, lang }) {
  const { InvPackage } = await import('../../models/inventory/index.js');
  const tenant = await loadTenant(tenantId);
  const tid = toObjectId(tenantId);
  const q = { tenantId: tid };
  if (packageIds?.length) q._id = { $in: packageIds };
  const pkgs = await InvPackage.find(q)
    .populate('locationId', 'completePath')
    .populate('packageTypeId', 'name')
    .limit(100)
    .lean();
  const pages = [];
  for (const [idx, pkg] of pkgs.entries()) {
    const qr = await qrDataUrl(pkg.name || String(pkg._id));
    pages.push(`<div class="label-page" style="width:100mm;height:60mm;page-break-after:always;padding:4mm">
      ${companyHeader(tenant, { title: lang === 'ar' ? 'ملصق عبوة' : 'Package Label', lang })}
      <div class="big">${esc(pkg.name)}</div>
      <div>${esc(pkg.packageTypeId?.name || '')}</div>
      <div>${esc(pkg.locationId?.completePath || '')}</div>
      <div>${lang === 'ar' ? 'صندوق' : 'Box'} ${idx + 1} / ${pkgs.length}</div>
      <div class="barcode">${esc(pkg.name)}</div>
      ${qr ? `<img src="${qr}" width="72" height="72"/>` : ''}
    </div>`);
  }
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>${baseCss()}</style></head><body>${pages.join('')}</body></html>`;
}

async function shippingLabelHtml(tenantId, { transferId, lang }) {
  const tenant = await loadTenant(tenantId);
  const { transfer } = await loadTransferBundle(tenantId, transferId);
  const partner = transfer.partnerId || {};
  const qr = await qrDataUrl(transfer.name);
  return `<!DOCTYPE html><html lang="${lang}" dir="${lang === 'ar' ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"/><style>${baseCss()}</style></head><body>
  ${companyHeader(tenant, { title: lang === 'ar' ? 'ملصق شحن' : 'Shipping Label', docNo: transfer.name, lang })}
  <div style="display:flex;gap:24px;margin-top:16px">
    <div style="flex:1;border:1px solid #cbd5e1;padding:12px">
      <div style="font-size:10px;text-transform:uppercase;color:#64748b">${lang === 'ar' ? 'المرسل' : 'From'}</div>
      <div>${esc(tenant?.nameAr || tenant?.name)}</div>
      <div>${esc(tenant?.address || '')}</div>
    </div>
    <div style="flex:1;border:2px solid #0f172a;padding:12px">
      <div style="font-size:10px;text-transform:uppercase;color:#64748b">${lang === 'ar' ? 'المستلم' : 'To'}</div>
      <div style="font-size:16px;font-weight:700">${esc(partner.nameAr || partner.name || '')}</div>
      <div>${esc(partner.phone || '')}</div>
      <div>${esc(partner.address || partner.city || '')}</div>
    </div>
  </div>
  <p>${lang === 'ar' ? 'مرجع' : 'Ref'}: ${esc(transfer.origin || transfer.name)}</p>
  ${qr ? `<img src="${qr}" width="100" height="100"/>` : ''}
  <div class="barcode">${esc(transfer.name)}</div>
  </body></html>`;
}

async function putawaySlipHtml(tenantId, { transferId, lang }) {
  const tenant = await loadTenant(tenantId);
  const { transfer, lines } = await loadTransferBundle(tenantId, transferId);
  const title = lang === 'ar' ? 'قسيمة تخزين' : 'Putaway Slip';
  const rows = lines.map((ln) => {
    const p = ln.productId || {};
    return `<tr>
      <td>${esc(lang === 'ar' && p.nameAr ? p.nameAr : p.nameEn)}</td>
      <td>${esc(p.sku)}</td>
      <td>${esc(ln.qtyDone || ln.productQty || '')}</td>
      <td>${esc(ln.locationDestId?.completePath || transfer.locationDestId?.completePath || '')}</td>
      <td>${esc(ln.lotId?.name || '')}</td>
    </tr>`;
  }).join('');
  return `<!DOCTYPE html><html lang="${lang}" dir="${lang === 'ar' ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"/><style>${baseCss()}</style></head><body>
  ${companyHeader(tenant, { title, docNo: transfer.name, lang })}
  <table><thead><tr>
    <th>${lang === 'ar' ? 'المنتج' : 'Product'}</th><th>SKU</th>
    <th>${lang === 'ar' ? 'كمية' : 'Qty'}</th>
    <th>${lang === 'ar' ? 'موقع مقترح' : 'Suggested location'}</th>
    <th>${lang === 'ar' ? 'دفعة' : 'Lot'}</th>
  </tr></thead><tbody>${rows}</tbody></table>
  <div class="sigs"><div class="sig">${lang === 'ar' ? 'نفّذ التخزين' : 'Putaway by'}</div></div>
  </body></html>`;
}

async function reorderSheetHtml(tenantId, { lang }) {
  const tenant = await loadTenant(tenantId);
  const { InvReorderRule } = await import('../../models/inventory/index.js');
  const rules = await InvReorderRule.find({ tenantId: toObjectId(tenantId), active: { $ne: false } })
    .populate('productId', 'nameEn nameAr sku costPrice suppliers')
    .populate('locationId', 'completePath')
    .limit(500)
    .lean();
  const byVendor = {};
  for (const r of rules) {
    const pref = (r.productId?.suppliers || []).find((s) => s.isPreferred) || (r.productId?.suppliers || [])[0];
    const key = pref?.supplierId ? String(pref.supplierId) : (lang === 'ar' ? 'بدون مورد' : 'No vendor');
    if (!byVendor[key]) byVendor[key] = [];
    byVendor[key].push(r);
  }
  const title = lang === 'ar' ? 'اقتراحات إعادة الطلب' : 'Reorder / Purchase Suggestion Sheet';
  const sections = Object.entries(byVendor).map(([vendor, list]) => {
    const rows = list.map((r) => {
      const p = r.productId || {};
      const toOrder = Math.max(0, Number(r.maxQty || 0) - Number(r.minQty || 0));
      return `<tr>
        <td>${esc(p.nameEn || p.nameAr)}</td><td>${esc(p.sku)}</td>
        <td>${esc(r.locationId?.completePath || '')}</td>
        <td>${esc(r.minQty)}</td><td>${esc(r.maxQty)}</td>
        <td>${esc(toOrder)}</td><td>${esc(p.costPrice ?? '')}</td>
      </tr>`;
    }).join('');
    return `<h3>${esc(vendor)}</h3><table><thead><tr>
      <th>${lang === 'ar' ? 'منتج' : 'Product'}</th><th>SKU</th><th>${lang === 'ar' ? 'موقع' : 'Loc'}</th>
      <th>Min</th><th>Max</th><th>${lang === 'ar' ? 'للطلب' : 'To order'}</th>
      <th>${lang === 'ar' ? 'آخر سعر' : 'Last price'}</th>
    </tr></thead><tbody>${rows}</tbody></table>`;
  }).join('');
  return `<!DOCTYPE html><html lang="${lang}" dir="${lang === 'ar' ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"/><style>${baseCss()}</style></head><body>
  ${companyHeader(tenant, { title, date: new Date().toISOString().slice(0, 10), lang })}
  ${sections || `<p>${lang === 'ar' ? 'لا قواعد إعادة طلب' : 'No reorder rules'}</p>`}
  </body></html>`;
}

async function batchPickingHtml(tenantId, { transferIds, lang }) {
  const tenant = await loadTenant(tenantId);
  const ids = transferIds || [];
  if (!ids.length) throw new InventoryValidationError('transferIds required', 'MISSING_FIELDS');
  const bundles = [];
  for (const id of ids) {
    // eslint-disable-next-line no-await-in-loop
    bundles.push(await loadTransferBundle(tenantId, id));
  }
  const byProduct = new Map();
  for (const { transfer, lines } of bundles) {
    for (const ln of lines) {
      const pid = String(ln.productId?._id || ln.productId || '');
      if (!byProduct.has(pid)) {
        byProduct.set(pid, {
          product: ln.productId,
          total: 0,
          perOrder: {},
        });
      }
      const entry = byProduct.get(pid);
      const qty = Number(ln.qtyDone || ln.productQty || ln.quantity || 0);
      entry.total += qty;
      entry.perOrder[transfer.name] = (entry.perOrder[transfer.name] || 0) + qty;
    }
  }
  const orderNames = bundles.map((b) => b.transfer.name);
  const headerOrders = orderNames.map((n) => `<th>${esc(n)}</th>`).join('');
  const rows = [...byProduct.values()].map((e) => {
    const p = e.product || {};
    const cells = orderNames.map((n) => `<td>${esc(e.perOrder[n] || 0)}</td>`).join('');
    return `<tr>
      <td>${esc(lang === 'ar' && p.nameAr ? p.nameAr : p.nameEn)}</td>
      <td>${esc(p.sku)}</td>
      <td>${esc(e.total)}</td>
      ${cells}
    </tr>`;
  }).join('');
  const title = lang === 'ar' ? 'تجهيز دفعي' : 'Batch Picking List';
  return `<!DOCTYPE html><html lang="${lang}" dir="${lang === 'ar' ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"/><style>${baseCss()}</style></head><body>
  ${companyHeader(tenant, { title, date: new Date().toISOString().slice(0, 10), lang })}
  <table><thead><tr>
    <th>${lang === 'ar' ? 'منتج' : 'Product'}</th><th>SKU</th>
    <th>${lang === 'ar' ? 'إجمالي' : 'Total'}</th>${headerOrders}
  </tr></thead><tbody>${rows}</tbody></table>
  </body></html>`;
}

/**
 * Render a print layout to PDF buffer.
 */
export async function renderInventoryPdf(tenantId, {
  layout,
  transferId,
  transferIds,
  locationIds,
  productIds,
  lotIds,
  packageIds,
  copies,
  labelPreset,
  filters,
  lang = 'ar',
  showPrices = false,
}) {
  if (!PRINT_LAYOUTS.includes(layout)) {
    throw new InventoryValidationError(`Unknown layout: ${layout}`, 'PRINT_LAYOUT');
  }

  let settings = null;
  try {
    const InvSettings = (await import('../../models/inventory/InvSettings.js')).default;
    settings = await InvSettings.findOne({ tenantId: toObjectId(tenantId) })
      .select('printDefaultLang printShowPricesOnDelivery printWatermarkEnabled printFooterTerms')
      .lean();
    if (!lang && settings?.printDefaultLang) lang = settings.printDefaultLang;
    if (showPrices == null && settings?.printShowPricesOnDelivery) showPrices = true;
  } catch {
    /* ignore */
  }

  if (['goods_receipt', 'delivery_note', 'delivery_note_priced', 'picking_list', 'internal_transfer', 'return_note', 'scrap_note'].includes(layout)) {
    const ids = transferIds?.length ? transferIds : (transferId ? [transferId] : []);
    if (!ids.length) throw new InventoryValidationError('transferId required', 'MISSING_FIELDS');
    const tenant = await loadTenant(tenantId);
    const chunks = [];
    for (const id of ids) {
      // eslint-disable-next-line no-await-in-loop
      const { transfer, lines } = await loadTransferBundle(tenantId, id);
      const priced = layout === 'delivery_note_priced' || (layout === 'delivery_note' && (showPrices || settings?.printShowPricesOnDelivery));
      let html = transferDocHtml({
        tenant,
        transfer,
        lines,
        layout: layout === 'delivery_note_priced' ? 'delivery_note' : layout,
        lang,
        showPrices: priced,
      });
      if (layout === 'delivery_note' || layout === 'delivery_note_priced') {
        const qr = await qrDataUrl(transfer.name);
        if (qr) html = html.replace('</body>', `<img src="${qr}" width="90" height="90" alt="verify"/><div style="font-size:9px">${esc(transfer.name)}</div></body>`);
      }
      if (settings?.printFooterTerms) {
        html = html.replace('</body>', `<p style="font-size:9px;margin-top:12px">${esc(settings.printFooterTerms)}</p></body>`);
      }
      chunks.push(html);
      // eslint-disable-next-line no-await-in-loop
      await InvTransfer.updateOne(
        { _id: id, tenantId: toObjectId(tenantId) },
        { $inc: { printedCount: 1 }, $set: { lastPrintedAt: new Date() } },
      ).catch(() => {});
    }
    const merged = chunks.map((h) => h.replace(/<\/?html[^>]*>/gi, '').replace(/<\/?body[^>]*>/gi, '').replace(/<head[\s\S]*?<\/head>/gi, '')).join('<div style="page-break-before:always"></div>');
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>${baseCss()}</style></head><body>${merged}</body></html>`;
    return htmlToPdf(html);
  }

  if (layout === 'batch_picking') {
    return htmlToPdf(await batchPickingHtml(tenantId, { transferIds, lang }));
  }
  if (layout === 'count_sheet_blind' || layout === 'count_sheet_open') {
    return htmlToPdf(await countSheetHtml(tenantId, { blind: layout === 'count_sheet_blind', filters, lang }));
  }
  if (layout === 'count_variance') {
    return htmlToPdf(await countVarianceHtml(tenantId, { filters, lang }));
  }
  if (layout === 'stock_report') {
    return htmlToPdf(await stockReportHtml(tenantId, { filters, lang }));
  }
  if (layout === 'location_label') {
    return htmlToPdf(await locationLabelsHtml(tenantId, { locationIds, lang }));
  }
  if (layout === 'product_label') {
    return htmlToPdf(await productLabelsHtml(tenantId, { productIds, copies, lang, preset: labelPreset }));
  }
  if (layout === 'lot_label') {
    return htmlToPdf(await lotLabelsHtml(tenantId, { lotIds, lang }));
  }
  if (layout === 'package_label') {
    return htmlToPdf(await packageLabelsHtml(tenantId, { packageIds, lang }));
  }
  if (layout === 'shipping_label') {
    if (!transferId) throw new InventoryValidationError('transferId required', 'MISSING_FIELDS');
    return htmlToPdf(await shippingLabelHtml(tenantId, { transferId, lang }));
  }
  if (layout === 'putaway_slip') {
    if (!transferId) throw new InventoryValidationError('transferId required', 'MISSING_FIELDS');
    return htmlToPdf(await putawaySlipHtml(tenantId, { transferId, lang }));
  }
  if (layout === 'reorder_sheet') {
    return htmlToPdf(await reorderSheetHtml(tenantId, { lang }));
  }

  const tenant = await loadTenant(tenantId);
  const html = `<!DOCTYPE html><html lang="${lang}" dir="${lang === 'ar' ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"/><style>${baseCss()}</style></head><body>
    ${companyHeader(tenant, { title: layout, date: new Date().toISOString().slice(0, 10), lang })}
    <p>${lang === 'ar' ? 'تخطيط قيد الإكمال' : 'Layout scaffold'}</p>
  </body></html>`;
  return htmlToPdf(html);
}

/** ZPL for a simple location or product label (Zebra). */
export function renderZplLabel({ title, barcode, line2 = '' }) {
  const t = String(title || '').slice(0, 40);
  const b = String(barcode || '').slice(0, 40);
  const l2 = String(line2 || '').slice(0, 40);
  return `^XA
^CF0,40
^FO50,30^FD${t}^FS
^FO50,80^FD${l2}^FS
^BY2,2,60
^FO50,120^BC^FD${b}^FS
^XZ
`;
}
