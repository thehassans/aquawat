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

/**
 * Render a print layout to PDF buffer.
 */
export async function renderInventoryPdf(tenantId, {
  layout,
  transferId,
  transferIds,
  locationIds,
  filters,
  lang = 'ar',
  showPrices = false,
}) {
  if (!PRINT_LAYOUTS.includes(layout)) {
    throw new InventoryValidationError(`Unknown layout: ${layout}`, 'PRINT_LAYOUT');
  }

  if (['goods_receipt', 'delivery_note', 'delivery_note_priced', 'picking_list', 'internal_transfer', 'return_note', 'scrap_note'].includes(layout)) {
    const ids = transferIds?.length ? transferIds : (transferId ? [transferId] : []);
    if (!ids.length) throw new InventoryValidationError('transferId required', 'MISSING_FIELDS');
    const tenant = await loadTenant(tenantId);
    const chunks = [];
    for (const id of ids) {
      // eslint-disable-next-line no-await-in-loop
      const { transfer, lines } = await loadTransferBundle(tenantId, id);
      const priced = layout === 'delivery_note_priced' || (layout === 'delivery_note' && showPrices);
      const effective = layout === 'delivery_note' && priced ? 'delivery_note_priced' : layout;
      chunks.push(transferDocHtml({
        tenant,
        transfer,
        lines,
        layout: effective === 'delivery_note_priced' ? 'delivery_note' : effective,
        lang,
        showPrices: priced,
      }));
      // bump printedCount
      // eslint-disable-next-line no-await-in-loop
      await InvTransfer.updateOne(
        { _id: id, tenantId: toObjectId(tenantId) },
        { $inc: { printedCount: 1 }, $set: { lastPrintedAt: new Date() } },
      ).catch(() => {});
    }
    // Merge: concatenate HTML bodies into one PDF by joining pages
    const merged = chunks.map((h) => h.replace(/<\/?html[^>]*>/gi, '').replace(/<\/?body[^>]*>/gi, '').replace(/<head[\s\S]*?<\/head>/gi, '')).join('<div style="page-break-before:always"></div>');
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>${baseCss()}</style></head><body>${merged}</body></html>`;
    return htmlToPdf(html);
  }

  if (layout === 'count_sheet_blind' || layout === 'count_sheet_open') {
    const html = await countSheetHtml(tenantId, { blind: layout === 'count_sheet_blind', filters, lang });
    return htmlToPdf(html);
  }

  if (layout === 'location_label') {
    const html = await locationLabelsHtml(tenantId, { locationIds, lang });
    return htmlToPdf(html);
  }

  // Stub remaining layouts with a titled placeholder until full data wiring
  const tenant = await loadTenant(tenantId);
  const html = `<!DOCTYPE html><html lang="${lang}" dir="${lang === 'ar' ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"/><style>${baseCss()}</style></head><body>
    ${companyHeader(tenant, { title: layout, date: new Date().toISOString().slice(0, 10), lang })}
    <p>${lang === 'ar' ? 'تخطيط قيد الإكمال — المحرك جاهز.' : 'Layout scaffold — print engine ready.'}</p>
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
