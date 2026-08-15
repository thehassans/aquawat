import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from './logger.js';
import { formatProductTypeBilingual } from './productType.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

const sanitizeFileName = (value) => String(value || 'invoice')
  .replace(/[\\/:*?"<>|]+/g, '-')
  .replace(/\s+/g, ' ')
  .trim();

const normalizeText = (value) => String(value || '').trim();

const toMoney = (value, currency = 'SAR', options = {}) => {
  const amount = Number(value || 0);
  const formatted = Number.isFinite(amount) ? amount.toFixed(2) : '0.00';
  const code = String(currency || 'SAR').trim() || 'SAR';
  const position = options?.position === 'before' ? 'before' : 'after';
  return position === 'before' ? `${code} ${formatted}` : `${formatted} ${code}`;
};

const resolveCurrencyPosition = (tenant) => {
  const value = tenant?.settings?.invoiceCurrencyPosition;
  return value === 'before' ? 'before' : 'after';
};

// On travel invoices the printed/displayed price comes from customerPrice;
// unitPrice & agencyPrice are internal ZATCA margin inputs and must never leak.
const isTravelInvoiceDoc = (invoice = {}) => invoice?.businessContext === 'travel_agency' || invoice?.invoiceSubtype === 'travel_ticket';
const resolveLineDisplayPrice = (invoice, line) => {
  if (isTravelInvoiceDoc(invoice)) {
    const customer = Number(line?.customerPrice || 0);
    if (customer > 0) return customer;
  }
  return Number(line?.unitPrice || 0);
};

const escapePdfText = (value) => String(value || '')
  .replace(/\\/g, '\\\\')
  .replace(/\(/g, '\\(')
  .replace(/\)/g, '\\)')
  .replace(/[\r\n]+/g, ' ')
  .replace(/[^\x20-\x7E]/g, '?');

const formatDate = (value, language = 'en') => {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-GB', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
};

const buildPartyLines = (party = {}, language = 'en') => {
  const address = party?.address || {};
  const cityLine = [address?.buildingNumber, address?.street, address?.district, address?.city].filter(Boolean).join(', ');
  const locationLine = [address?.postalCode, address?.country].filter(Boolean).join(' ');
  const labels = language === 'ar'
    ? { vat: 'الرقم الضريبي', cr: 'السجل التجاري', phone: 'الهاتف', email: 'البريد' }
    : { vat: 'VAT', cr: 'CR', phone: 'Phone', email: 'Email' };
  return [
    language === 'ar' ? normalizeText(party?.nameAr || party?.name) : normalizeText(party?.name || party?.nameAr),
    party?.vatNumber ? `${labels.vat}: ${normalizeText(party.vatNumber)}` : '',
    party?.crNumber ? `${labels.cr}: ${normalizeText(party.crNumber)}` : '',
    cityLine,
    locationLine,
    party?.contactPhone ? `${labels.phone}: ${normalizeText(party.contactPhone)}` : '',
    party?.contactEmail ? `${labels.email}: ${normalizeText(party.contactEmail)}` : '',
  ].filter(Boolean);
};

const buildTravelRows = (invoice = {}) => {
  const travelDetails = invoice?.travelDetails || {};
  const segments = Array.isArray(travelDetails?.segments) ? travelDetails.segments : [];
  const passengers = Array.isArray(travelDetails?.passengers) ? travelDetails.passengers : [];
  const routeLabel = segments.length
    ? segments.map((segment) => [normalizeText(segment?.from), normalizeText(segment?.to)].filter(Boolean).join(' → ')).filter(Boolean).join(' | ')
    : [normalizeText(travelDetails?.routeFrom), normalizeText(travelDetails?.routeTo)].filter(Boolean).join(' → ');

  return [
    ['Lead Traveler\nاسم المسافر', normalizeText(travelDetails?.travelerName || invoice?.buyer?.name || invoice?.buyer?.nameAr)],
    ['Passport\nرقم الجواز', normalizeText(travelDetails?.passportNumber)],
    ['Ticket Number\nرقم التذكرة', normalizeText(travelDetails?.ticketNumber)],
    ['PNR\nرقم الحجز', normalizeText(travelDetails?.pnr)],
    ['Airline / Vendor\nشركة الطيران / المورد', normalizeText(travelDetails?.airlineName)],
    ['Route\nالمسار', routeLabel],
    ['Departure Date\nتاريخ السفر', formatDate(travelDetails?.departureDate, 'en') || formatDate(invoice?.issueDate, 'en')],
    ['Return Date\nتاريخ العودة', travelDetails?.hasReturnDate ? formatDate(travelDetails?.returnDate, 'en') : '—'],
    ['Layover / Stay\nالتوقف / الإقامة', normalizeText(travelDetails?.layoverStay) || '—'],
    ['Additional Passengers\nمسافرون إضافيون', passengers.length ? passengers.map((passenger) => normalizeText(passenger?.name)).filter(Boolean).join(', ') : '—'],
  ].filter(([, value]) => String(value || '').trim());
};

const isBoutiqueInvoiceDoc = (invoice = {}) => invoice?.businessContext === 'boutique' || invoice?.invoiceSubtype === 'boutique_rental';

const buildBoutiqueRows = (invoice = {}) => {
  const bd = invoice?.boutiqueDetails || {};
  const rows = [
    ['Rental # / رقم الحجز', normalizeText(bd?.rentalNumber || invoice?.rentalNumber)],
    ['Type / النوع', bd?.transactionType === 'sale' ? 'Sale / بيع' : 'Rental / إيجار'],
    ['Rental Period / فترة الإيجار', bd?.startDate && bd?.endDate ? `${formatDate(bd.startDate, 'en')} → ${formatDate(bd.endDate, 'en')}` : '—'],
    ['Pick-up / الاستلام', formatDate(bd?.pickedUpAt, 'en') || '—'],
    ['Return / التسليم', formatDate(bd?.returnedAt, 'en') || '—'],
    ['Deposit / التأمين', bd?.totalDeposit > 0 ? toMoney(bd.totalDeposit, invoice?.currency) : '—'],
    ['Late Fee / رسوم التأخير', bd?.totalLateFee > 0 ? toMoney(bd.totalLateFee, invoice?.currency) : '—'],
    ['Damage Fee / رسوم التلف', bd?.totalDamageFee > 0 ? toMoney(bd.totalDamageFee, invoice?.currency) : '—'],
    ['Cleaning Fee / رسوم التنظيف', bd?.totalCleaningFee > 0 ? toMoney(bd.totalCleaningFee, invoice?.currency) : '—'],
    ['Amount Paid / المبلغ المدفوع', bd?.amountPaid > 0 ? toMoney(bd.amountPaid, invoice?.currency) : '—'],
    ['Refunded / المبلغ المسترجع', bd?.amountRefunded > 0 ? toMoney(bd.amountRefunded, invoice?.currency) : '—'],
    ['Deposit Status / حالة التأمين', normalizeText(bd?.depositStatus) || '—'],
  ];
  return rows.filter(([, value]) => String(value || '').trim() && String(value) !== '—');
};

const buildFallbackInvoiceLines = ({ invoice, tenant, customerName }) => {
  const sellerName = normalizeText(tenant?.business?.legalNameEn || tenant?.business?.legalNameAr || tenant?.name || 'Maqder ERP');
  const buyerName = normalizeText(customerName || invoice?.buyer?.name || invoice?.buyer?.nameAr || 'Customer');
  const lines = [
    sellerName,
    `Invoice ${normalizeText(invoice?.invoiceNumber)}`,
    `Issue Date: ${formatDate(invoice?.issueDate, 'en')}`,
    `Customer: ${buyerName}`,
    `Transaction: ${normalizeText(invoice?.transactionType)}`,
    `Payment Method: ${normalizeText(invoice?.paymentMethod)}`,
    `Subtotal: ${toMoney(invoice?.subtotal, invoice?.currency)}`,
    `Tax: ${toMoney(invoice?.totalTax, invoice?.currency)}`,
    `Total: ${toMoney(invoice?.grandTotal, invoice?.currency)}`,
    '',
    'Line Items',
  ];

  const invoiceLines = Array.isArray(invoice?.lineItems) ? invoice.lineItems : [];
  invoiceLines.slice(0, 18).forEach((line, index) => {
    const name = normalizeText(line?.productName || line?.productNameAr || `Item ${index + 1}`);
    const typeLabel = formatProductTypeBilingual(line?.productType);
    const qty = Number(line?.quantity || 0);
    const price = toMoney(resolveLineDisplayPrice(invoice, line), invoice?.currency);
    const total = toMoney(line?.lineTotalWithTax || line?.lineTotal, invoice?.currency);
    lines.push(`${index + 1}. ${name} (${typeLabel}) | Qty: ${Number.isFinite(qty) ? qty : 0} | Price: ${price} | Total: ${total}`);
  });

  const travelRows = buildTravelRows(invoice);
  if (travelRows.length) {
    lines.push('');
    lines.push('Travel Details');
    travelRows.forEach(([label, value]) => {
      lines.push(`${String(label || '').replace(/\n/g, ' / ')}: ${value}`);
    });
  }

  const boutiqueRows = buildBoutiqueRows(invoice);
  if (boutiqueRows.length) {
    lines.push('');
    lines.push('Rental Details / تفاصيل الإيجار');
    boutiqueRows.forEach(([label, value]) => {
      lines.push(`${String(label || '').replace(/\n/g, ' / ')}: ${value}`);
    });
  }

  if (invoice?.notes) {
    lines.push('');
    lines.push(`Notes: ${normalizeText(invoice.notes)}`);
  }

  return lines.filter(Boolean);
};

const buildFallbackPdfBufferFromLines = (lines) => {
  const safeLines = Array.isArray(lines) ? lines.slice(0, 40) : [];
  const operations = ['BT', '/F1 11 Tf', '50 800 Td'];

  safeLines.forEach((line, index) => {
    const escapedLine = escapePdfText(line);
    if (index > 0) {
      operations.push('0 -18 Td');
    }
    operations.push(`(${escapedLine}) Tj`);
  });

  operations.push('ET');
  const content = `${operations.join('\n')}\n`;

  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Count 1 /Kids [3 0 R] >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n',
    `4 0 obj\n<< /Length ${Buffer.byteLength(content, 'utf8')} >>\nstream\n${content}endstream\nendobj\n`,
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
  ];

  let output = '%PDF-1.4\n';
  const offsets = [0];

  objects.forEach((object) => {
    offsets.push(Buffer.byteLength(output, 'utf8'));
    output += object;
  });

  const xrefOffset = Buffer.byteLength(output, 'utf8');
  output += `xref\n0 ${objects.length + 1}\n`;
  output += '0000000000 65535 f \n';
  for (let index = 1; index <= objects.length; index += 1) {
    output += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`;
  }
  output += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(output, 'utf8');
};

let pdfRuntimePromise;

const resolvePdfRuntimeModules = (jspdfModule) => ({
  jsPDF: jspdfModule?.jsPDF || jspdfModule?.default?.jsPDF || jspdfModule?.default || jspdfModule,
});

const isValidPdfRuntime = (runtime) => Boolean(
  runtime
  && typeof runtime.jsPDF === 'function'
);

const loadPdfRuntime = async () => {
  if (!pdfRuntimePromise) {
    pdfRuntimePromise = (async () => {
      try {
        const runtime = resolvePdfRuntimeModules(require('jspdf'));
        if (isValidPdfRuntime(runtime)) {
          return runtime;
        }
        throw new Error('Require-loaded PDF runtime was invalid');
      } catch (requireError) {
        try {
          const jspdfModule = await import('jspdf');
          const runtime = resolvePdfRuntimeModules(jspdfModule);
          if (isValidPdfRuntime(runtime)) {
            return runtime;
          }
          throw new Error('Import-loaded PDF runtime was invalid');
        } catch (importError) {
          logger.error(`Invoice PDF runtime failed to load: require error: ${requireError?.message || requireError}; import error: ${importError?.message || importError}`);
          return null;
        }
      }
    })();
  }

  const runtime = await pdfRuntimePromise;
  if (!isValidPdfRuntime(runtime)) {
    pdfRuntimePromise = undefined;
    return null;
  }

  return runtime;
};

let tajawalRegularBase64 = '';
let tajawalBoldBase64 = '';
let fontLoadPromise;

const ensureFontData = async () => {
  if (!fontLoadPromise) {
    fontLoadPromise = (async () => {
      const regularPath = path.resolve(__dirname, '..', '..', 'frontend', 'public', 'fonts', 'Tajawal-Regular.ttf');
      const boldPath = path.resolve(__dirname, '..', '..', 'frontend', 'public', 'fonts', 'Tajawal-Bold.ttf');
      if (existsSync(regularPath)) {
        tajawalRegularBase64 = (await readFile(regularPath)).toString('base64');
      }
      if (existsSync(boldPath)) {
        tajawalBoldBase64 = (await readFile(boldPath)).toString('base64');
      }
    })();
  }

  await fontLoadPromise;
};

const ensureTajawalFont = async (doc) => {
  await ensureFontData();
  if (!tajawalRegularBase64) return false;

  try {
    doc.addFileToVFS('Tajawal-Regular.ttf', tajawalRegularBase64);
    doc.addFont('Tajawal-Regular.ttf', 'Tajawal', 'normal');
    if (tajawalBoldBase64) {
      doc.addFileToVFS('Tajawal-Bold.ttf', tajawalBoldBase64);
      doc.addFont('Tajawal-Bold.ttf', 'Tajawal', 'bold');
    }
    doc.setFont('Tajawal', 'normal');
    return true;
  } catch {
    return false;
  }
};

const setDocFont = (doc, fontFamily, fontStyle = 'normal', fontSize = 11) => {
  try {
    doc.setFont(fontFamily, fontStyle);
  } catch {
    doc.setFont('helvetica', fontStyle === 'bold' ? 'bold' : 'normal');
  }
  doc.setFontSize(fontSize);
};

const hasArabicText = (value = '') => /[\u0600-\u06FF]/.test(String(value || ''));

const mergeUniqueLines = (...values) => {
  const seen = new Set();
  const output = [];

  values.flat(Infinity).forEach((value) => {
    String(value || '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .forEach((line) => {
        const key = line.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        output.push(line);
      });
  });

  return output;
};

const splitLineForWidth = (doc, line, width) => {
  const value = normalizeText(line);
  if (!value) return [];
  const result = doc.splitTextToSize(value, width);
  return Array.isArray(result) ? result : [String(result)];
};

const measureWrappedLinesHeight = (doc, lines, width, englishFont, arabicFont, fontSize = 10.5, lineHeight = fontSize + 4) => {
  let totalHeight = 0;
  lines.forEach((line) => {
    const fontFamily = hasArabicText(line) ? arabicFont : englishFont;
    setDocFont(doc, fontFamily, 'normal', fontSize);
    const parts = splitLineForWidth(doc, line, width);
    totalHeight += Math.max(lineHeight, parts.length * lineHeight);
  });
  return totalHeight;
};

const drawWrappedLines = (doc, lines, x, y, width, { englishFont, arabicFont, fontSize = 10.5, lineHeight = fontSize + 4, align = 'left', fontStyle = 'normal' } = {}) => {
  let cursorY = y;

  lines.forEach((line) => {
    const fontFamily = hasArabicText(line) ? arabicFont : englishFont;
    setDocFont(doc, fontFamily, fontStyle, fontSize);
    const parts = splitLineForWidth(doc, line, width);

    parts.forEach((part) => {
      if (align === 'right' && hasArabicText(part) && typeof doc.setR2L === 'function') {
        doc.setR2L(true);
      }
      doc.text(part, x, cursorY, { maxWidth: width, align });
      if (align === 'right' && typeof doc.setR2L === 'function') {
        doc.setR2L(false);
      }
      cursorY += lineHeight;
    });
  });

  return cursorY;
};

const ensurePageSpace = (doc, currentY, requiredHeight, margin = 40, resetY = 46) => {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (currentY + requiredHeight <= pageHeight - margin) {
    return currentY;
  }
  doc.addPage();
  return resetY;
};

const drawCard = (doc, x, y, width, height, fillColor = [255, 255, 255], strokeColor = [226, 232, 240]) => {
  doc.setFillColor(...fillColor);
  doc.setDrawColor(...strokeColor);
  doc.roundedRect(x, y, width, height, 14, 14, 'FD');
};

const buildBilingualPartyLines = (party = {}, fallbackName = '') => {
  const normalizedParty = {
    ...party,
    name: normalizeText(party?.name || fallbackName),
    nameAr: normalizeText(party?.nameAr || ''),
  };

  return mergeUniqueLines(
    buildPartyLines(normalizedParty, 'en'),
    buildPartyLines(normalizedParty, 'ar')
  );
};

export const buildInvoicePdfBuffer = async ({ invoice, tenant, customerName, language = 'bilingual' }) => {
  const pdfRuntime = await loadPdfRuntime();
  if (!pdfRuntime?.jsPDF) {
    logger.warn(`Invoice PDF fallback renderer used for invoice ${sanitizeFileName(invoice?.invoiceNumber || 'unknown')}`);
    return buildFallbackPdfBufferFromLines(buildFallbackInvoiceLines({ invoice, tenant, customerName }));
  }

  const { jsPDF } = pdfRuntime;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;
  const arabicFontReady = await ensureTajawalFont(doc);
  const englishFont = 'helvetica';
  const arabicFont = arabicFontReady ? 'Tajawal' : 'helvetica';
  const sellerNameEn = normalizeText(tenant?.business?.legalNameEn || tenant?.name || 'Maqder ERP');
  const sellerNameAr = normalizeText(tenant?.business?.legalNameAr);
  const buyerName = normalizeText(customerName || invoice?.buyer?.name || invoice?.buyer?.nameAr || 'Customer');
  const isBoutiquePdf = isBoutiqueInvoiceDoc(invoice);
  const invoiceTitle = invoice?.businessContext === 'travel_agency' || invoice?.invoiceSubtype === 'travel_ticket'
    ? `Travel Services Invoice ${normalizeText(invoice?.invoiceNumber)}`
    : isBoutiquePdf
      ? `Boutique Invoice ${normalizeText(invoice?.invoiceNumber)}`
      : `Invoice ${normalizeText(invoice?.invoiceNumber)}`;
  const invoiceTitleAr = invoice?.businessContext === 'travel_agency' || invoice?.invoiceSubtype === 'travel_ticket'
    ? `فاتورة خدمات السفر ${normalizeText(invoice?.invoiceNumber)}`
    : isBoutiquePdf
      ? `فاتورة البوتيك ${normalizeText(invoice?.invoiceNumber)}`
      : `الفاتورة ${normalizeText(invoice?.invoiceNumber)}`;
  const flowValue = normalizeText(invoice?.flow || 'sell');
  const infoCards = [
    { label: 'Invoice # / رقم الفاتورة', value: normalizeText(invoice?.invoiceNumber) || '—' },
    { label: 'Issue Date / تاريخ الإصدار', value: formatDate(invoice?.issueDate, 'en') || '—' },
    { label: 'Flow / التدفق', value: flowValue || '—' },
    { label: 'Status / الحالة', value: normalizeText(invoice?.status) || '—' },
  ];
  const partyLinesSeller = buildBilingualPartyLines(invoice?.seller || tenant?.business || {}, sellerNameEn);
  const partyLinesBuyer = buildBilingualPartyLines(invoice?.buyer || {}, buyerName);
  const travelRows = buildTravelRows(invoice);
  const boutiqueRows = buildBoutiqueRows(invoice);
  const lineItems = Array.isArray(invoice?.lineItems) ? invoice.lineItems : [];

  doc.setFillColor(22, 59, 39);
  doc.rect(0, 0, pageWidth, 120, 'F');
  setDocFont(doc, englishFont, 'normal', 8);
  doc.setTextColor(214, 211, 209);
  const headerLabel = invoice?.businessContext === 'travel_agency' || invoice?.invoiceSubtype === 'travel_ticket'
    ? 'TRAVEL SERVICES INVOICE'
    : isBoutiquePdf
      ? 'BOUTIQUE INVOICE'
      : 'TAX INVOICE';
  doc.text(headerLabel, margin, 24);
  setDocFont(doc, englishFont, 'bold', 22);
  doc.setTextColor(255, 255, 255);
  doc.text(sellerNameEn, margin, 42);
  if (sellerNameAr) {
    setDocFont(doc, arabicFont, 'normal', 13);
    if (typeof doc.setR2L === 'function') doc.setR2L(true);
    doc.text(sellerNameAr, pageWidth - margin, 42, { align: 'right' });
    if (typeof doc.setR2L === 'function') doc.setR2L(false);
  }
  setDocFont(doc, englishFont, 'bold', 18);
  doc.text(invoiceTitle, margin, 78);
  setDocFont(doc, arabicFont, 'bold', 16);
  if (typeof doc.setR2L === 'function') doc.setR2L(true);
  doc.text(invoiceTitleAr, pageWidth - margin, 78, { align: 'right' });
  if (typeof doc.setR2L === 'function') doc.setR2L(false);

  const infoY = 138;
  const infoGap = 12;
  const infoWidth = (pageWidth - margin * 2 - infoGap * 3) / 4;
  infoCards.forEach((card, index) => {
    const x = margin + (infoWidth + infoGap) * index;
    drawCard(doc, x, infoY, infoWidth, 58, [248, 250, 252]);
    setDocFont(doc, englishFont, 'normal', 8.5);
    doc.setTextColor(100, 116, 139);
    doc.text(card.label, x + 12, infoY + 16, { maxWidth: infoWidth - 24 });
    setDocFont(doc, hasArabicText(card.value) ? arabicFont : englishFont, 'bold', 10.5);
    doc.setTextColor(15, 23, 42);
    doc.text(card.value, x + 12, infoY + 37, { maxWidth: infoWidth - 24 });
  });

  const partiesStartY = infoY + 76;
  const sectionWidth = (pageWidth - margin * 2 - 16) / 2;
  const partyTextWidth = sectionWidth - 24;
  const sellerHeight = measureWrappedLinesHeight(doc, partyLinesSeller, partyTextWidth, englishFont, arabicFont, 10, 13);
  const buyerHeight = measureWrappedLinesHeight(doc, partyLinesBuyer, partyTextWidth, englishFont, arabicFont, 10, 13);
  const partyHeight = Math.max(124, 32 + Math.max(sellerHeight, buyerHeight) + 18);

  drawCard(doc, margin, partiesStartY, sectionWidth, partyHeight, [248, 250, 252]);
  drawCard(doc, margin + sectionWidth + 16, partiesStartY, sectionWidth, partyHeight, [248, 250, 252]);
  setDocFont(doc, englishFont, 'bold', 12);
  doc.setTextColor(15, 23, 42);
  doc.text('Seller / البائع', margin + 12, partiesStartY + 18);
  doc.text('Customer / العميل', margin + sectionWidth + 28, partiesStartY + 18);
  drawWrappedLines(doc, partyLinesSeller, margin + 12, partiesStartY + 36, partyTextWidth, { englishFont, arabicFont, fontSize: 10, lineHeight: 13 });
  drawWrappedLines(doc, partyLinesBuyer, margin + sectionWidth + 28, partiesStartY + 36, partyTextWidth, { englishFont, arabicFont, fontSize: 10, lineHeight: 13 });

  let cursorY = partiesStartY + partyHeight + 18;

  if (travelRows.length) {
    const travelLabelWidth = 170;
    const travelValueWidth = pageWidth - margin * 2 - 32 - travelLabelWidth;
    const travelHeight = travelRows.reduce((total, [label, value]) => {
      const labelHeight = measureWrappedLinesHeight(doc, [label], travelLabelWidth, englishFont, arabicFont, 9.5, 12);
      const valueHeight = measureWrappedLinesHeight(doc, [value], travelValueWidth, englishFont, arabicFont, 9.5, 12);
      return total + Math.max(labelHeight, valueHeight, 20) + 10;
    }, 32);

    cursorY = ensurePageSpace(doc, cursorY, travelHeight + 12, margin, 46);
    drawCard(doc, margin, cursorY, pageWidth - margin * 2, travelHeight, [250, 250, 250]);
    setDocFont(doc, englishFont, 'bold', 12);
    doc.setTextColor(15, 23, 42);
    doc.text('Travel Details / تفاصيل السفر', margin + 12, cursorY + 18);

    let rowY = cursorY + 34;
    travelRows.forEach(([label, value], rowIndex) => {
      const rowHeight = Math.max(
        measureWrappedLinesHeight(doc, [label], travelLabelWidth, englishFont, arabicFont, 9.5, 12),
        measureWrappedLinesHeight(doc, [value], travelValueWidth, englishFont, arabicFont, 9.5, 12),
        20
      ) + 6;

      if (rowIndex > 0) {
        doc.setDrawColor(226, 232, 240);
        doc.line(margin + 12, rowY - 6, pageWidth - margin - 12, rowY - 6);
      }

      drawWrappedLines(doc, [label], margin + 12, rowY + 2, travelLabelWidth, { englishFont, arabicFont, fontSize: 9.5, lineHeight: 12 });
      drawWrappedLines(doc, [value], margin + 22 + travelLabelWidth, rowY + 2, travelValueWidth, { englishFont, arabicFont, fontSize: 9.5, lineHeight: 12 });
      rowY += rowHeight;
    });

    cursorY += travelHeight + 18;
  }

  if (boutiqueRows.length) {
    const boutiqueLabelWidth = 170;
    const boutiqueValueWidth = pageWidth - margin * 2 - 32 - boutiqueLabelWidth;
    const boutiqueHeight = boutiqueRows.reduce((total, [label, value]) => {
      const labelHeight = measureWrappedLinesHeight(doc, [label], boutiqueLabelWidth, englishFont, arabicFont, 9.5, 12);
      const valueHeight = measureWrappedLinesHeight(doc, [value], boutiqueValueWidth, englishFont, arabicFont, 9.5, 12);
      return total + Math.max(labelHeight, valueHeight, 20) + 10;
    }, 32);

    cursorY = ensurePageSpace(doc, cursorY, boutiqueHeight + 12, margin, 46);
    drawCard(doc, margin, cursorY, pageWidth - margin * 2, boutiqueHeight, [250, 250, 250]);
    setDocFont(doc, englishFont, 'bold', 12);
    doc.setTextColor(15, 23, 42);
    doc.text('Rental Details / تفاصيل الإيجار', margin + 12, cursorY + 18);

    let rowY = cursorY + 34;
    boutiqueRows.forEach(([label, value], rowIndex) => {
      const rowHeight = Math.max(
        measureWrappedLinesHeight(doc, [label], boutiqueLabelWidth, englishFont, arabicFont, 9.5, 12),
        measureWrappedLinesHeight(doc, [value], boutiqueValueWidth, englishFont, arabicFont, 9.5, 12),
        20
      ) + 6;

      if (rowIndex > 0) {
        doc.setDrawColor(226, 232, 240);
        doc.line(margin + 12, rowY - 6, pageWidth - margin - 12, rowY - 6);
      }

      drawWrappedLines(doc, [label], margin + 12, rowY + 2, boutiqueLabelWidth, { englishFont, arabicFont, fontSize: 9.5, lineHeight: 12 });
      drawWrappedLines(doc, [value], margin + 22 + boutiqueLabelWidth, rowY + 2, boutiqueValueWidth, { englishFont, arabicFont, fontSize: 9.5, lineHeight: 12 });
      rowY += rowHeight;
    });

    cursorY += boutiqueHeight + 18;
  }

  const tableX = margin;
  const tableWidth = pageWidth - margin * 2;
  const isTravelPdf = isTravelInvoiceDoc(invoice);
  // Travel invoices hide Qty (always 1 per ticket) and Tax (margin VAT is internal).
  const colWidths = isTravelPdf
    ? [32, tableWidth - (32 + 140 + 140) - 8, 140, 140, 8]
    : [24, 196, 44, 88, 56, tableWidth - (24 + 196 + 44 + 88 + 56)];
  const headerLabels = isTravelPdf
    ? ['#', 'Description / الوصف', 'Unit Price / سعر الوحدة', 'Total / الإجمالي', '']
    : ['#', 'Description / الوصف', 'Qty / الكمية', 'Unit Price / سعر الوحدة', 'Tax / الضريبة', 'Total / الإجمالي'];
  const drawItemsHeader = (y) => {
    doc.setFillColor(15, 23, 42);
    doc.setDrawColor(15, 23, 42);
    doc.rect(tableX, y, tableWidth, 28, 'FD');
    let currentX = tableX;
    headerLabels.forEach((header, index) => {
      setDocFont(doc, hasArabicText(header) ? arabicFont : englishFont, 'bold', 8.5);
      doc.setTextColor(255, 255, 255);
      doc.text(header, currentX + 6, y + 17, { maxWidth: colWidths[index] - 12 });
      currentX += colWidths[index];
    });
  };

  cursorY = ensurePageSpace(doc, cursorY, 60, margin, 46);
  drawItemsHeader(cursorY);
  let rowY = cursorY + 28;

  lineItems.forEach((line, index) => {
    const nameText = mergeUniqueLines(normalizeText(line?.productName), normalizeText(line?.productNameAr)).join('\n') || `Item ${index + 1}`;
    const typeLabel = formatProductTypeBilingual(line?.productType);
    const nameWithType = `${nameText}\n${typeLabel}`;
    const descRaw = mergeUniqueLines(normalizeText(line?.description), normalizeText(line?.descriptionAr)).join('\n');
    const descText = descRaw
      .replace(/\b(exclusions?|excl)\b/gi, '\n$1')
      .replace(/\n{2,}/g, '\n')
      .trim();
    const rowValues = isTravelPdf
      ? [
          String(index + 1),
          nameWithType,
          toMoney(resolveLineDisplayPrice(invoice, line), invoice?.currency),
          toMoney(line?.lineTotalWithTax || line?.lineTotal, invoice?.currency),
          '',
        ]
      : [
          String(index + 1),
          nameWithType,
          String(Number(line?.quantity || 0)),
          toMoney(resolveLineDisplayPrice(invoice, line), invoice?.currency),
          `${Number(line?.taxRate || 0).toFixed(2)}%`,
          toMoney(line?.lineTotalWithTax || line?.lineTotal, invoice?.currency),
        ];
    const nameHeight = Math.max(
      24,
      ...rowValues.map((value, cellIndex) => measureWrappedLinesHeight(doc, [value], colWidths[cellIndex] - 10, englishFont, arabicFont, 9.5, 12))
    ) + 8;
    const descHeight = descText
      ? measureWrappedLinesHeight(doc, [descText], colWidths[1] - 10, englishFont, arabicFont, 8, 10) + 4
      : 0;
    const rowHeight = nameHeight + descHeight;

    if (rowY + rowHeight > pageHeight - margin - 120) {
      doc.addPage();
      rowY = 46;
      drawItemsHeader(rowY);
      rowY += 28;
    }

    const fill = index % 2 === 0 ? [255, 255, 255] : [248, 250, 252];
    doc.setFillColor(...fill);
    doc.setDrawColor(226, 232, 240);
    doc.rect(tableX, rowY, tableWidth, rowHeight, 'FD');

    let currentX = tableX;
    rowValues.forEach((value, cellIndex) => {
      doc.setDrawColor(226, 232, 240);
      doc.line(currentX, rowY, currentX, rowY + rowHeight);
      const align = cellIndex === 0 || cellIndex >= 2 ? 'center' : 'left';
      drawWrappedLines(doc, [value], currentX + (align === 'left' ? 6 : colWidths[cellIndex] / 2), rowY + 15, colWidths[cellIndex] - 10, {
        englishFont,
        arabicFont,
        fontSize: 9.5,
        lineHeight: 12,
        align,
      });
      currentX += colWidths[cellIndex];
    });
    if (descText) {
      drawWrappedLines(doc, [descText], tableX + 6, rowY + 15 + nameHeight - 8, colWidths[1] - 10, {
        englishFont,
        arabicFont,
        fontSize: 8,
        lineHeight: 10,
        align: 'left',
        fontStyle: 'bold',
      });
    }
    doc.line(tableX + tableWidth, rowY, tableX + tableWidth, rowY + rowHeight);
    rowY += rowHeight;
  });

  let footerY = rowY + 18;
  footerY = ensurePageSpace(doc, footerY, 120, margin, 46);

  const summaryWidth = 226;
  const bd = invoice?.boutiqueDetails || {};
  const summaryRowsBase = [
    ['Subtotal / الإجمالي الفرعي', toMoney(invoice?.subtotal, invoice?.currency)],
  ];
  if (bd?.totalLateFee > 0) summaryRowsBase.push(['Late Fee / رسوم التأخير', toMoney(bd.totalLateFee, invoice?.currency)]);
  if (bd?.totalDamageFee > 0) summaryRowsBase.push(['Damage Fee / رسوم التلف', toMoney(bd.totalDamageFee, invoice?.currency)]);
  if (bd?.totalCleaningFee > 0) summaryRowsBase.push(['Cleaning Fee / رسوم التنظيف', toMoney(bd.totalCleaningFee, invoice?.currency)]);
  if (bd?.totalDeposit > 0) summaryRowsBase.push(['Deposit / التأمين', toMoney(bd.totalDeposit, invoice?.currency)]);
  summaryRowsBase.push(['Tax / الضريبة', toMoney(invoice?.totalTax, invoice?.currency)]);
  summaryRowsBase.push(['Grand Total / الإجمالي', toMoney(invoice?.grandTotal, invoice?.currency)]);

  const summaryHeight = 28 + summaryRowsBase.length * 24 + 8;
  drawCard(doc, pageWidth - margin - summaryWidth, footerY, summaryWidth, summaryHeight, [248, 250, 252]);
  summaryRowsBase.forEach(([label, value], index) => {
    const isTotal = index === summaryRowsBase.length - 1;
    const rowOffset = footerY + 22 + index * 24;
    setDocFont(doc, englishFont, isTotal ? 'bold' : 'normal', isTotal ? 11.5 : 10);
    doc.setTextColor(15, 23, 42);
    doc.text(label, pageWidth - margin - summaryWidth + 12, rowOffset);
    doc.text(value, pageWidth - margin - 12, rowOffset, { align: 'right' });
  });

  if (invoice?.notes) {
    const notesWidth = pageWidth - margin * 2 - summaryWidth - 18;
    drawCard(doc, margin, footerY, notesWidth, summaryHeight, [255, 255, 255]);
    setDocFont(doc, englishFont, 'bold', 11);
    doc.text('Notes / ملاحظات', margin + 12, footerY + 18);
    drawWrappedLines(doc, [normalizeText(invoice.notes)], margin + 12, footerY + 38, notesWidth - 24, { englishFont, arabicFont, fontSize: 10, lineHeight: 13 });
  }

  if (invoice?.termsAndConditions) {
    const tcHeight = measureWrappedLinesHeight(doc, [normalizeText(invoice.termsAndConditions)], pageWidth - margin * 2 - 24, englishFont, arabicFont, 9.5, 12) + 32;
    let tcY = footerY + summaryHeight + 18;
    tcY = ensurePageSpace(doc, tcY, tcHeight, margin, 46);
    drawCard(doc, margin, tcY, pageWidth - margin * 2, tcHeight, [255, 255, 255]);
    setDocFont(doc, englishFont, 'bold', 11);
    doc.text('Terms & Conditions / الشروط والأحكام', margin + 12, tcY + 18);
    drawWrappedLines(doc, [normalizeText(invoice.termsAndConditions)], margin + 12, tcY + 34, pageWidth - margin * 2 - 24, { englishFont, arabicFont, fontSize: 9.5, lineHeight: 12 });
  }

  const arrayBuffer = doc.output('arraybuffer');
  return Buffer.from(arrayBuffer);
};

export const buildInvoicePdfAttachment = async ({ invoice, tenant, customerName, language = 'bilingual' }) => {
  const filename = `${sanitizeFileName(invoice?.invoiceNumber || 'invoice')}.pdf`;
  const content = await buildInvoicePdfBuffer({ invoice, tenant, customerName, language });
  return {
    filename,
    content,
    contentType: 'application/pdf',
    size: content.length,
  };
};
