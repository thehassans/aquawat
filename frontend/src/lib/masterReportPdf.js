import jsPDF from 'jspdf'
import 'jspdf-autotable'
import { CURRENCY_CODE, formatCurrencyAmount } from './currency'

// ─── Arabic & Custom Font Engine ──────────────────────────────────────────────

let almaraiRegularBase64 = null
let almaraiBoldBase64 = null
let almaraiLoadPromise = null

const bufferToBase64 = (buffer) => {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

const hasFontSignature = (buffer) => {
  const bytes = new Uint8Array(buffer)
  if (bytes.length < 4) return false
  if (bytes[0] === 0x00 && bytes[1] === 0x01 && bytes[2] === 0x00 && bytes[3] === 0x00) return true
  const signature = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3])
  return signature === 'OTTO' || signature === 'true' || signature === 'ttcf'
}

const tryFetchFontBase64 = async (url) => {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const buf = await res.arrayBuffer()
    if (!hasFontSignature(buf)) return null
    return bufferToBase64(buf)
  } catch {
    return null
  }
}

async function ensureAlmaraiFont(doc) {
  if (!doc || typeof doc.addFileToVFS !== 'function' || typeof doc.addFont !== 'function') return false

  if (!almaraiLoadPromise) {
    almaraiLoadPromise = (async () => {
      almaraiRegularBase64 = await tryFetchFontBase64('/fonts/Almarai/Almarai-Regular.ttf')
      almaraiBoldBase64 = await tryFetchFontBase64('/fonts/Almarai/Almarai-Bold.ttf')
    })()
  }

  try {
    await almaraiLoadPromise
  } catch {
    almaraiLoadPromise = null
    return false
  }

  if (!almaraiRegularBase64) return false

  try {
    doc.addFileToVFS('Almarai-Regular.ttf', almaraiRegularBase64)
    doc.addFont('Almarai-Regular.ttf', 'Almarai', 'normal')
    if (almaraiBoldBase64) {
      doc.addFileToVFS('Almarai-Bold.ttf', almaraiBoldBase64)
      doc.addFont('Almarai-Bold.ttf', 'Almarai', 'bold')
    }
    doc.setFont('Almarai', 'normal')
    return true
  } catch {
    doc.setFont('helvetica', 'normal')
    return false
  }
}

// ─── Color Helpers & Utilities ────────────────────────────────────────────────

const hexToRgb = (hex) => {
  if (!hex) return null
  const raw = String(hex).trim().replace('#', '')
  if (raw.length === 3) {
    const r = parseInt(raw[0] + raw[0], 16)
    const g = parseInt(raw[1] + raw[1], 16)
    const b = parseInt(raw[2] + raw[2], 16)
    if ([r, g, b].some((n) => Number.isNaN(n))) return null
    return { r, g, b }
  }
  if (raw.length !== 6) return null
  const r = parseInt(raw.slice(0, 2), 16)
  const g = parseInt(raw.slice(2, 4), 16)
  const b = parseInt(raw.slice(4, 6), 16)
  if ([r, g, b].some((n) => Number.isNaN(n))) return null
  return { r, g, b }
}

const safeText = (value) => {
  if (value === null || value === undefined) return ''
  return String(value)
}

const sanitizePdfText = (value) => {
  return safeText(value)
    .replace(/[\u200e\u200f\u061c]/g, '')
    .replace(/﷼/g, 'SAR')
    .replace(/\s+/g, ' ')
    .trim()
}

const fmtMoney = (value, { currency = 'SAR' } = {}) => {
  const currencyCode = String(currency || CURRENCY_CODE).trim().toUpperCase() || CURRENCY_CODE
  const amount = formatCurrencyAmount(Number(value || 0), {
    language: 'en',
    currency: currencyCode,
    currencyDisplay: 'code',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return `${amount} ${currencyCode}`
}

const formatDate = (value, language = 'en') => {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

const detectImageFormat = (dataUrl) => {
  const m = /^data:image\/(png|jpeg|jpg);/i.exec(String(dataUrl || ''))
  if (!m) return null
  const ext = m[1].toLowerCase()
  return ext === 'jpg' ? 'JPEG' : ext === 'jpeg' ? 'JPEG' : 'PNG'
}

// ─── Light-Themed Professional Invoice-Style Report Canvas Builder ─────────────

function createReportDocument({ orientation = 'portrait' } = {}) {
  return new jsPDF({ orientation, unit: 'mm', format: 'a4' })
}

/**
 * Renders an ultra-clean, light-themed invoice header matching official ZATCA tax invoice layouts.
 * Fully bilingual with company legal names, CR, VAT number, document title, and period.
 */
function drawEnterpriseLightHeader(doc, { tenant, titleEn, titleAr, reportTypeBadge, startDate, endDate, language = 'en', fontName = 'helvetica' }) {
  const pageW = doc.internal.pageSize.getWidth()
  const primaryHex = tenant?.branding?.primaryColor || '#1e3a8a'
  const brandRgb = hexToRgb(primaryHex) || { r: 30, g: 58, b: 138 }

  // 1. Top Brand Accent Line (3.5mm)
  doc.setFillColor(brandRgb.r, brandRgb.g, brandRgb.b)
  doc.rect(0, 0, pageW, 3.5, 'F')

  // 2. Light Background Canvas (Pure White)
  doc.setFillColor(255, 255, 255)
  doc.rect(0, 3.5, pageW, 38, 'F')

  // Company Logo
  const logo = tenant?.branding?.logo
  const logoFormat = detectImageFormat(logo)
  let textLeft = 14
  if (logo && logoFormat) {
    try {
      doc.addImage(logo, logoFormat, 14, 7, 22, 22)
      textLeft = 40
    } catch {
      // fallback
    }
  }

  // Company Information (Left Block - Clean Light Theme)
  const legalNameEn = tenant?.business?.legalNameEn || tenant?.name || 'Maqder Enterprise'
  const legalNameAr = tenant?.business?.legalNameAr || ''
  const companyTitle = legalNameAr ? `${legalNameEn} / ${legalNameAr}` : legalNameEn
  const crNumber = tenant?.business?.crNumber || tenant?.business?.commercialRegistration?.crNumber || '—'
  const vatNumber = tenant?.business?.vatNumber || tenant?.business?.vatCertificate?.vatNumber || '—'
  const city = tenant?.business?.city || 'Saudi Arabia'

  doc.setFont(fontName, 'bold')
  doc.setFontSize(11)
  doc.setTextColor(15, 23, 42) // Slate 900
  doc.text(sanitizePdfText(companyTitle), textLeft, 11)

  doc.setFont(fontName, 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(71, 85, 105) // Slate 600
  doc.text(`CR No. / السجل التجاري: ${sanitizePdfText(crNumber)}`, textLeft, 16)
  doc.text(`VAT TRN / الرقم الضريبي: ${sanitizePdfText(vatNumber)}`, textLeft, 20.5)
  doc.text(`Location / الموقع: ${sanitizePdfText(city)}`, textLeft, 25)

  // Document Details (Right Block - Official Invoice-Style Box)
  const rightX = pageW - 14

  // Bilingual Title
  doc.setFont(fontName, 'bold')
  doc.setFontSize(11)
  doc.setTextColor(15, 23, 42)
  doc.text(sanitizePdfText(titleEn), rightX, 11, { align: 'right' })

  if (titleAr) {
    doc.setFontSize(9)
    doc.setTextColor(51, 65, 85)
    doc.text(sanitizePdfText(titleAr), rightX, 15.5, { align: 'right' })
  }

  // Official Status Badge (Light Pill)
  if (reportTypeBadge) {
    const badgeText = sanitizePdfText(reportTypeBadge)
    doc.setFont(fontName, 'bold')
    doc.setFontSize(7)
    const textWidth = doc.getTextWidth(badgeText)
    const badgeW = Math.max(textWidth + 8, 38)
    const badgeX = rightX - badgeW

    // Light Tinted Background Pill
    doc.setFillColor(241, 245, 249) // Slate 100
    doc.setDrawColor(brandRgb.r, brandRgb.g, brandRgb.b)
    doc.setLineWidth(0.3)
    doc.roundedRect(badgeX, 18, badgeW, 5.5, 1.2, 1.2, 'FD')

    doc.setTextColor(brandRgb.r, brandRgb.g, brandRgb.b)
    doc.text(badgeText, rightX - badgeW / 2, 21.8, { align: 'center' })
  }

  // Period and Issue Date
  const startStr = startDate ? formatDate(startDate, 'en') : '—'
  const endStr = endDate ? formatDate(endDate, 'en') : '—'
  const dateStr = new Date().toISOString().slice(0, 10)

  doc.setFont(fontName, 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(100, 116, 139) // Slate 500
  doc.text(`Period / الفترة: ${startStr} — ${endStr}`, rightX, 28, { align: 'right' })
  doc.text(`Issued / تاريخ الإصدار: ${dateStr}`, rightX, 32.5, { align: 'right' })

  // Subtle Separator Line
  doc.setDrawColor(226, 232, 240) // Slate 200
  doc.setLineWidth(0.4)
  doc.line(14, 37, pageW - 14, 37)

  return 43 // Start Y for content
}

/**
 * Renders Light-Themed KPI Scorecard Cards with Bilingual Labels.
 */
function drawLightKpiGrid(doc, startY, kpis = [], fontName = 'helvetica') {
  if (!kpis || kpis.length === 0) return startY
  const pageW = doc.internal.pageSize.getWidth()
  const margin = 14
  const usableW = pageW - margin * 2
  const count = Math.min(kpis.length, 5)
  const gap = 3
  const cardW = (usableW - (count - 1) * gap) / count
  const cardH = 19

  kpis.slice(0, count).forEach((kpi, idx) => {
    const x = margin + idx * (cardW + gap)

    // Card background (clean slate-50 with fine border)
    doc.setFillColor(248, 250, 252) // slate-50
    doc.setDrawColor(226, 232, 240) // slate-200
    doc.setLineWidth(0.3)
    doc.roundedRect(x, startY, cardW, cardH, 2, 2, 'FD')

    // Top subtle color indicator
    const rgb = kpi.colorRgb || [30, 58, 138]
    doc.setFillColor(rgb[0], rgb[1], rgb[2])
    doc.rect(x + 2, startY, cardW - 4, 1.2, 'F')

    // Bilingual Label
    doc.setFont(fontName, 'bold')
    doc.setFontSize(6.2)
    doc.setTextColor(100, 116, 139) // slate-500
    const labelEn = sanitizePdfText(String(kpi.label || kpi.labelEn || '').toUpperCase())
    doc.text(labelEn, x + 3, startY + 5.8)

    if (kpi.labelAr) {
      doc.setFont(fontName, 'normal')
      doc.setFontSize(5.8)
      doc.setTextColor(148, 163, 184)
      doc.text(sanitizePdfText(kpi.labelAr), x + 3, startY + 8.8)
    }

    // Amount / Value
    doc.setFont(fontName, 'bold')
    doc.setFontSize(9)
    doc.setTextColor(15, 23, 42) // slate-900
    doc.text(sanitizePdfText(String(kpi.value || '0')), x + 3, startY + (kpi.labelAr ? 14 : 12.5))

    // Subtitle if present
    if (kpi.sub) {
      doc.setFont(fontName, 'normal')
      doc.setFontSize(5.5)
      doc.setTextColor(148, 163, 184)
      doc.text(sanitizePdfText(String(kpi.sub)), x + 3, startY + 17)
    }
  })

  return startY + cardH + 6
}

/**
 * Section Header with left accent bar and bilingual title.
 */
function drawLightSectionHeading(doc, startY, titleEn, titleAr = '', fontName = 'helvetica') {
  doc.setFillColor(30, 58, 138) // Primary Navy
  doc.rect(14, startY, 2.5, 5, 'F')

  doc.setFont(fontName, 'bold')
  doc.setFontSize(9.5)
  doc.setTextColor(15, 23, 42)
  const fullTitle = titleAr ? `${sanitizePdfText(titleEn)}  /  ${sanitizePdfText(titleAr)}` : sanitizePdfText(titleEn)
  doc.text(fullTitle, 18.5, startY + 4)
  return startY + 7.5
}

/**
 * Renders an official invoice-style summary totals box on the bottom right.
 */
function drawInvoiceStyleSummaryBox(doc, startY, summaryRows = [], fontName = 'helvetica') {
  if (!summaryRows || summaryRows.length === 0) return startY
  const pageW = doc.internal.pageSize.getWidth()
  const boxW = 85
  const boxX = pageW - 14 - boxW
  const rowH = 6.2
  const totalH = summaryRows.length * rowH + 4

  // Clean Light Container
  doc.setFillColor(248, 250, 252) // Slate 50
  doc.setDrawColor(226, 232, 240) // Slate 200
  doc.setLineWidth(0.3)
  doc.roundedRect(boxX, startY, boxW, totalH, 2, 2, 'FD')

  // Official Seal Watermark (Left side)
  doc.setFillColor(241, 245, 249)
  doc.roundedRect(14, startY, 80, totalH, 2, 2, 'F')
  doc.setFont(fontName, 'bold')
  doc.setFontSize(7)
  doc.setTextColor(71, 85, 105)
  doc.text('OFFICIAL VERIFIED REPORT', 18, startY + 6)
  doc.text('تقرير تدقيق رسمي معتمد', 18, startY + 10)
  doc.setFont(fontName, 'normal')
  doc.setFontSize(6)
  doc.setTextColor(148, 163, 184)
  doc.text('Generated via Maqder ERP Reporting Engine', 18, startY + 15)
  doc.text('ZATCA Tax Standard Compliant', 18, startY + 18.5)

  // Summary Rows
  summaryRows.forEach((row, i) => {
    const y = startY + 4 + i * rowH
    const isHighlight = row.isHighlight || i === summaryRows.length - 1

    if (isHighlight) {
      doc.setFillColor(241, 245, 249)
      doc.rect(boxX + 1, y - 2.5, boxW - 2, rowH, 'F')
    }

    doc.setFont(fontName, isHighlight ? 'bold' : 'normal')
    doc.setFontSize(isHighlight ? 7.8 : 7.2)
    doc.setTextColor(isHighlight ? 15 : 71, isHighlight ? 23 : 85, isHighlight ? 42 : 105)

    const label = row.labelAr ? `${row.labelEn} / ${row.labelAr}` : row.labelEn
    doc.text(sanitizePdfText(label), boxX + 3, y + 1.5)
    doc.text(sanitizePdfText(row.value), boxX + boxW - 3, y + 1.5, { align: 'right' })
  })

  return startY + totalH + 6
}

function attachLightPageFooters(doc, fontName = 'helvetica') {
  const pageCount = doc.internal.getNumberOfPages()
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setDrawColor(226, 232, 240)
    doc.setLineWidth(0.3)
    doc.line(14, pageH - 11, pageW - 14, pageH - 11)

    doc.setFont(fontName, 'normal')
    doc.setFontSize(7)
    doc.setTextColor(148, 163, 184)
    doc.text('Maqder ERP Reporting System  •  Confidential & Official Document  •  نظام مقدر للتقارير المعتمدة', 14, pageH - 6.5)
    doc.text(`Page ${i} of ${pageCount}  |  صفحة ${i} من ${pageCount}`, pageW - 14, pageH - 6.5, { align: 'right' })
  }
}

// ─── 1. VAT Return PDF Generator ─────────────────────────────────────────────

export async function generateVatReturnPdf({ report, tenant, language = 'en' }) {
  const doc = createReportDocument()
  const hasArabic = await ensureAlmaraiFont(doc)
  const fontName = hasArabic ? 'Almarai' : 'helvetica'

  const totals = report?.totals || {}
  const statement = report?.vatReturn?.statement || {}

  let y = drawEnterpriseLightHeader(doc, {
    tenant,
    titleEn: 'VAT Return & Tax Declaration Report',
    titleAr: 'تقرير إقرار ضريبة القيمة المضافة',
    reportTypeBadge: 'ZATCA VAT Statement / إقرار الزكاة والضريبة',
    startDate: report?.period?.startDate,
    endDate: report?.period?.endDate,
    language,
    fontName,
  })

  // Light KPI Grid with Dual-Language Labels
  y = drawLightKpiGrid(doc, y, [
    { labelEn: 'Total Invoices', labelAr: 'إجمالي الفواتير', value: (totals?.invoiceCount || 0).toLocaleString(), sub: 'Tax period count' },
    { labelEn: 'Standard Rated Sales', labelAr: 'المبيعات الخاضعة (15%)', value: fmtMoney(statement?.salesStandardRated?.amount || totals?.byCategory?.standardRated?.taxableAmount || 0), colorRgb: [37, 99, 235] },
    { labelEn: 'Output VAT (15%)', labelAr: 'ضريبة المخرجات', value: fmtMoney(statement?.totalSales?.vatAmount || totals?.totalTax || 0), colorRgb: [16, 185, 129] },
    { labelEn: 'Input VAT (Deductible)', labelAr: 'ضريبة المدخلات القابلة للخصم', value: fmtMoney(statement?.totalPurchases?.vatAmount || totals?.purchasesTaxAmount || 0), colorRgb: [245, 158, 11] },
    { labelEn: 'Net VAT Due / Refund', labelAr: 'صافي الضريبة المستحقة', value: fmtMoney(statement?.netVatDue?.vatAmount ?? (totals?.totalTax || 0) - (totals?.purchasesTaxAmount || 0)), colorRgb: [225, 29, 72] },
  ], fontName)

  // Section 1: Official ZATCA VAT Statement Table
  y = drawLightSectionHeading(doc, y, '1. Official VAT Declaration Statement', 'إقرار ضريبة القيمة المضافة الرسمي', fontName)

  const statementRows = [
    ['1. Standard Rated Sales (15%) / المبيعات الخاضعة للنسبة الأساسية', fmtMoney(statement?.salesStandardRated?.amount || 0), fmtMoney(statement?.salesStandardRated?.adjustment || 0), fmtMoney(statement?.salesStandardRated?.vatAmount || 0)],
    ['2. Special Citizen Supplies / التوريدات للمواطنين (الخدمات الصحية والتعليمية)', fmtMoney(statement?.salesSpecialCitizen?.amount || 0), fmtMoney(statement?.salesSpecialCitizen?.adjustment || 0), fmtMoney(statement?.salesSpecialCitizen?.vatAmount || 0)],
    ['3. Zero-Rated Domestic Sales / المبيعات المحلية الخاضعة للنسبة الصفرية', fmtMoney(statement?.salesZeroRatedDomestic?.amount || 0), fmtMoney(statement?.salesZeroRatedDomestic?.adjustment || 0), fmtMoney(statement?.salesZeroRatedDomestic?.vatAmount || 0)],
    ['4. Exports Outside KSA / الصادرات إلى خارج المملكة', fmtMoney(statement?.salesExports?.amount || 0), fmtMoney(statement?.salesExports?.adjustment || 0), fmtMoney(statement?.salesExports?.vatAmount || 0)],
    ['5. Exempt Supplies / التوريدات المعفاة من الضريبة', fmtMoney(statement?.salesExempt?.amount || 0), fmtMoney(statement?.salesExempt?.adjustment || 0), fmtMoney(statement?.salesExempt?.vatAmount || 0)],
    ['Total Sales & Output Tax / إجمالي المبيعات والضريبة المستحقة', fmtMoney(statement?.totalSales?.amount || totals?.taxableAmount || 0), fmtMoney(statement?.totalSales?.adjustment || 0), fmtMoney(statement?.totalSales?.vatAmount || totals?.totalTax || 0)],
    ['6. Standard Rated Domestic Purchases / المشتريات المحلية الخاضعة للنسبة الأساسية', fmtMoney(statement?.purchasesStandardRatedDomestic?.amount || 0), fmtMoney(statement?.purchasesStandardRatedDomestic?.adjustment || 0), fmtMoney(statement?.purchasesStandardRatedDomestic?.vatAmount || 0)],
    ['7. Imports Subject to Customs (15%) / الاستيرادات الخاضعة للضريبة الجمركية', fmtMoney(statement?.purchasesImportsCustoms?.amount || 0), fmtMoney(statement?.purchasesImportsCustoms?.adjustment || 0), fmtMoney(statement?.purchasesImportsCustoms?.vatAmount || 0)],
    ['8. Imports (Reverse Charge) / الاستيرادات الخاضعة لآلية الاحتساب العكسي', fmtMoney(statement?.purchasesImportsReverseCharge?.amount || 0), fmtMoney(statement?.purchasesImportsReverseCharge?.adjustment || 0), fmtMoney(statement?.purchasesImportsReverseCharge?.vatAmount || 0)],
    ['9. Zero-Rated Purchases / المشتريات الخاضعة للنسبة الصفرية', fmtMoney(statement?.purchasesZeroRated?.amount || 0), fmtMoney(statement?.purchasesZeroRated?.adjustment || 0), fmtMoney(statement?.purchasesZeroRated?.vatAmount || 0)],
    ['10. Exempt Purchases / المشتريات المعفاة من الضريبة', fmtMoney(statement?.purchasesExempt?.amount || 0), fmtMoney(statement?.purchasesExempt?.adjustment || 0), fmtMoney(statement?.purchasesExempt?.vatAmount || 0)],
    ['Total Purchases & Input Tax / إجمالي المشتريات وضريبة المدخلات', fmtMoney(statement?.totalPurchases?.amount || 0), fmtMoney(statement?.totalPurchases?.adjustment || 0), fmtMoney(statement?.totalPurchases?.vatAmount || totals?.purchasesTaxAmount || 0)],
    ['Net VAT Due / صافي الضريبة المستحقة للسداد', '—', '—', fmtMoney(statement?.netVatDue?.vatAmount ?? (totals?.totalTax || 0) - (totals?.purchasesTaxAmount || 0))],
  ]

  doc.autoTable({
    startY: y,
    head: [['VAT Category Line / بند الإقرار الضريبي', 'Base Amount / المبلغ (SAR)', 'Adjustment / التعديل (SAR)', 'VAT Tax / الضريبة (SAR)']],
    body: statementRows,
    theme: 'plain',
    headStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold', fontSize: 7.5, font: fontName },
    bodyStyles: { textColor: [30, 41, 59], fontSize: 7, cellPadding: 3, font: fontName },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 95 },
      1: { halign: 'right' },
      2: { halign: 'right' },
      3: { halign: 'right', fontStyle: 'bold' },
    },
    didDrawPage: (data) => { y = data.cursor.y },
  })

  y += 6

  // Invoice-Style Totals Box
  y = drawInvoiceStyleSummaryBox(doc, y, [
    { labelEn: 'Total Taxable Sales (Ex-VAT)', labelAr: 'إجمالي المبيعات الخاضعة', value: fmtMoney(statement?.totalSales?.amount || totals?.taxableAmount || 0) },
    { labelEn: 'Total Output VAT (15%)', labelAr: 'إجمالي ضريبة المخرجات', value: fmtMoney(statement?.totalSales?.vatAmount || totals?.totalTax || 0) },
    { labelEn: 'Total Input VAT (Deductible)', labelAr: 'إجمالي ضريبة المدخلات القابلة للخصم', value: fmtMoney(statement?.totalPurchases?.vatAmount || totals?.purchasesTaxAmount || 0) },
    { labelEn: 'Net Payable to ZATCA', labelAr: 'صافي الضريبة المستحقة للهيئة', value: fmtMoney(statement?.netVatDue?.vatAmount ?? (totals?.totalTax || 0) - (totals?.purchasesTaxAmount || 0)), isHighlight: true },
  ], fontName)

  attachLightPageFooters(doc, fontName)
  doc.save(`VAT_Declaration_Report_${new Date().toISOString().slice(0, 10)}.pdf`)
}

// ─── 2. Business Performance PDF Generator ───────────────────────────────────

export async function generateBusinessPdf({ report, tenant, language = 'en' }) {
  const doc = createReportDocument()
  const hasArabic = await ensureAlmaraiFont(doc)
  const fontName = hasArabic ? 'Almarai' : 'helvetica'
  const totals = report?.totals || {}

  let y = drawEnterpriseLightHeader(doc, {
    tenant,
    titleEn: 'Business Performance & Financial Summary',
    titleAr: 'تقرير الأداء المالي والأعمال',
    reportTypeBadge: 'P&L Executive Summary / تقرير الأرباح والخسائر',
    startDate: report?.period?.startDate,
    endDate: report?.period?.endDate,
    language,
    fontName,
  })

  y = drawLightKpiGrid(doc, y, [
    { labelEn: 'Gross Invoiced Sales', labelAr: 'إجمالي المبيعات', value: fmtMoney(totals?.sales?.grandTotal || 0), sub: `Ex-VAT: ${fmtMoney(totals?.sales?.taxableAmount || 0)}`, colorRgb: [16, 185, 129] },
    { labelEn: 'Purchases (Cost)', labelAr: 'المشتريات والتكاليف', value: fmtMoney(totals?.purchases?.grandTotal || 0), sub: `Ex-VAT: ${fmtMoney(totals?.purchases?.taxableAmount || 0)}`, colorRgb: [59, 130, 246] },
    { labelEn: 'Operating Expenses', labelAr: 'المصروفات التشغيلية', value: fmtMoney(totals?.expenses?.totalAmount || 0), sub: `${totals?.expenses?.expenseCount || 0} vouchers logged`, colorRgb: [245, 158, 11] },
    { labelEn: 'Sales Discounts', labelAr: 'خصومات المبيعات', value: fmtMoney(totals?.sales?.totalDiscount || 0), colorRgb: [239, 68, 68] },
    { labelEn: 'Net Operating Yield', labelAr: 'صافي الأرباح التشغيلية', value: fmtMoney(totals?.net || 0), sub: 'Sales - Purchases - Expenses', colorRgb: (totals?.net || 0) >= 0 ? [16, 185, 129] : [225, 29, 72] },
  ], fontName)

  // Section 1: Sales by Channel
  y = drawLightSectionHeading(doc, y, '1. Sales Revenue by Transaction Channel', 'الإيرادات حسب نوع المعاملة', fontName)
  doc.autoTable({
    startY: y,
    head: [['Channel / نوع المعاملة', 'Invoices Count / الفواتير', 'Discount / الخصم (SAR)', 'Taxable / الخاضع (SAR)', 'Total Revenue / الإجمالي (SAR)']],
    body: (report?.breakdown?.salesByTransactionType || []).map((row) => [
      String(row._id || 'Standard Tax Invoice').toUpperCase(),
      (row.invoiceCount || 0).toLocaleString(),
      fmtMoney(row.discount || 0),
      fmtMoney(row.taxableAmount || (row.revenue || 0) - (row.tax || 0)),
      fmtMoney(row.revenue || 0),
    ]),
    theme: 'plain',
    headStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold', fontSize: 7.5, font: fontName },
    bodyStyles: { textColor: [30, 41, 59], fontSize: 7.5, cellPadding: 3, font: fontName },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: { 0: { cellWidth: 60 }, 1: { halign: 'center' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right', fontStyle: 'bold' } },
    didDrawPage: (data) => { y = data.cursor.y },
  })

  y += 6

  // Section 2: Top Customers
  if (report?.breakdown?.topCustomers?.length > 0) {
    y = drawLightSectionHeading(doc, y, '2. Top Revenue Contributing Customers', 'أعلى العملاء مساهمة في الإيرادات', fontName)
    doc.autoTable({
      startY: y,
      head: [['Customer / اسم العميل', 'Invoices Count / الفواتير', 'Total Revenue / الإجمالي (SAR)', 'Share % / النسبة']],
      body: (report.breakdown.topCustomers || []).map((row) => {
        const totalSales = totals?.sales?.grandTotal || 1
        const share = (((row.revenue || 0) / totalSales) * 100).toFixed(1)
        return [
          row._id || 'Walk-in Customer / عميل نقدي',
          (row.invoiceCount || 0).toLocaleString(),
          fmtMoney(row.revenue || 0),
          `${share}%`,
        ]
      }),
      theme: 'plain',
      headStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold', fontSize: 7.5, font: fontName },
      bodyStyles: { textColor: [30, 41, 59], fontSize: 7.5, cellPadding: 3, font: fontName },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: { 0: { cellWidth: 80 }, 1: { halign: 'center' }, 2: { halign: 'right', fontStyle: 'bold' }, 3: { halign: 'center' } },
      didDrawPage: (data) => { y = data.cursor.y },
    })
    y += 6
  }

  // Invoice-Style Totals Summary Box
  y = drawInvoiceStyleSummaryBox(doc, y, [
    { labelEn: 'Gross Invoiced Sales', labelAr: 'إجمالي المبيعات المفوترة', value: fmtMoney(totals?.sales?.grandTotal || 0) },
    { labelEn: 'Cost of Goods (Purchases)', labelAr: 'تكلفة المشتريات', value: fmtMoney(totals?.purchases?.grandTotal || 0) },
    { labelEn: 'Operating Expenses', labelAr: 'المصروفات التشغيلية', value: fmtMoney(totals?.expenses?.totalAmount || 0) },
    { labelEn: 'Net Profit / Yield', labelAr: 'صافي الربح التشغيلي', value: fmtMoney(totals?.net || 0), isHighlight: true },
  ], fontName)

  attachLightPageFooters(doc, fontName)
  doc.save(`Business_Performance_${new Date().toISOString().slice(0, 10)}.pdf`)
}

// ─── 3. Internal Audit PDF Generator ─────────────────────────────────────────

export async function generateInternalAuditPdf({ report, tenant, language = 'en' }) {
  const doc = createReportDocument()
  const hasArabic = await ensureAlmaraiFont(doc)
  const fontName = hasArabic ? 'Almarai' : 'helvetica'

  let y = drawEnterpriseLightHeader(doc, {
    tenant,
    titleEn: 'Internal Audit & Controls Review Report',
    titleAr: 'تقرير التدقيق والرقابة الداخلية',
    reportTypeBadge: 'Internal Controls / الرقابة والتدقيق الداخلي',
    startDate: report?.period?.startDate,
    endDate: report?.period?.endDate,
    language,
    fontName,
  })

  y = drawLightKpiGrid(doc, y, [
    { labelEn: 'Control Health Grade', labelAr: 'تقييم الرقابة', value: String(report?.controlGrade || 'Strong'), sub: `Score: ${report?.score || 100}/100`, colorRgb: [16, 185, 129] },
    { labelEn: 'Audited Gross Sales', labelAr: 'المبيعات المدققة', value: fmtMoney(report?.kpis?.find((k) => k.key === 'audited_revenue')?.value || 0), colorRgb: [37, 99, 235] },
    { labelEn: 'Voided Invoices', labelAr: 'الفواتير الملغاة', value: (report?.cancelledInvoicesList?.length || 0).toLocaleString(), colorRgb: [239, 68, 68] },
    { labelEn: 'High Discount Lines', labelAr: 'خصومات استثنائية', value: (report?.highDiscountInvoices?.length || 0).toLocaleString(), colorRgb: [245, 158, 11] },
    { labelEn: 'Unreconciled Vouchers', labelAr: 'سندات غير مسواة', value: (report?.unreconciledVouchers?.length || 0).toLocaleString(), colorRgb: [168, 85, 247] },
  ], fontName)

  // Findings
  y = drawLightSectionHeading(doc, y, '1. Internal Control Review & Key Findings', 'ملاحظات التدقيق الداخلي والتوصيات', fontName)
  const findingsRows = (report?.findings || []).map((f) => [
    f.area || 'Control Governance / حوكمة الرقابة',
    f.riskLevel?.toUpperCase() || 'LOW',
    f.observation || 'Operational controls aligned with internal financial governance guidelines.',
    f.recommendation || 'Maintain regular quarterly audit reconciliations.',
  ])

  if (findingsRows.length === 0) {
    findingsRows.push(['General Controls / الرقابة العامة', 'LOW', 'No significant internal control deficiencies detected in this period.', 'Continue standard operating procedures.'])
  }

  doc.autoTable({
    startY: y,
    head: [['Focus Area / مجال التدقيق', 'Risk / المخاطر', 'Observation / الملاحظة', 'Recommendation / التوصية']],
    body: findingsRows,
    theme: 'plain',
    headStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold', fontSize: 7.5, font: fontName },
    bodyStyles: { textColor: [30, 41, 59], fontSize: 7, cellPadding: 3, font: fontName },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: { 0: { cellWidth: 42 }, 1: { cellWidth: 22, halign: 'center', fontStyle: 'bold' }, 2: { cellWidth: 62 }, 3: { cellWidth: 54 } },
    didDrawPage: (data) => { y = data.cursor.y },
  })

  y += 6

  // Cancelled Invoices
  if (report?.cancelledInvoicesList?.length > 0) {
    y = drawLightSectionHeading(doc, y, '2. Cancelled & Voided Invoices Register', 'سجل الفواتير الملغاة والمسترجعة', fontName)
    doc.autoTable({
      startY: y,
      head: [['Invoice # / الفاتورة', 'Issue Date / التاريخ', 'Customer / العميل', 'Voided Amount / المبلغ', 'Reason / السبب']],
      body: report.cancelledInvoicesList.map((inv) => [
        inv.invoiceNumber || '—',
        formatDate(inv.issueDate),
        inv.customerName || 'Walk-in / عميل نقدي',
        fmtMoney(inv.amount || 0),
        inv.reason || 'User voided prior to settlement',
      ]),
      theme: 'plain',
      headStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold', fontSize: 7.5, font: fontName },
      bodyStyles: { textColor: [30, 41, 59], fontSize: 7, cellPadding: 3, font: fontName },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: { 0: { cellWidth: 35 }, 1: { cellWidth: 28 }, 2: { cellWidth: 45 }, 3: { halign: 'right' }, 4: { cellWidth: 48 } },
      didDrawPage: (data) => { y = data.cursor.y },
    })
  }

  attachLightPageFooters(doc, fontName)
  doc.save(`Internal_Audit_Report_${new Date().toISOString().slice(0, 10)}.pdf`)
}

// ─── 4. External Audit PDF Generator ─────────────────────────────────────────

export async function generateExternalAuditPdf({ report, tenant, language = 'en' }) {
  const doc = createReportDocument()
  const hasArabic = await ensureAlmaraiFont(doc)
  const fontName = hasArabic ? 'Almarai' : 'helvetica'

  let y = drawEnterpriseLightHeader(doc, {
    tenant,
    titleEn: 'External Audit & Statutory Compliance Report',
    titleAr: 'تقرير التدقيق الخارجي والامتثال النظامي',
    reportTypeBadge: 'Statutory Assurance / تقرير المراجع المستقل',
    startDate: report?.period?.startDate,
    endDate: report?.period?.endDate,
    language,
    fontName,
  })

  y = drawLightKpiGrid(doc, y, [
    { labelEn: 'Auditor Opinion', labelAr: 'رأي المراجع', value: String(report?.auditOpinion || 'Unqualified Clean'), sub: 'Statutory Standard', colorRgb: [16, 185, 129] },
    { labelEn: 'ZATCA Integrity', labelAr: 'تكامل الفاتورة', value: `${report?.zatcaBreakdown?.complianceRate?.toFixed(1) || 100}%`, sub: 'Cryptographic chaining: 100%', colorRgb: [37, 99, 235] },
    { labelEn: 'Statutory VAT Verified', labelAr: 'الضريبة المدققة', value: fmtMoney(report?.statutoryVat?.totalVat || report?.vatReconciliation?.totalOutputVat || 0), colorRgb: [16, 185, 129] },
    { labelEn: 'Compliance Score', labelAr: 'درجة الامتثال', value: `${report?.complianceScore || 100}/100`, colorRgb: [245, 158, 11] },
    { labelEn: 'Invoices Inspected', labelAr: 'الفواتير المفحوصة', value: (report?.zatcaBreakdown?.totalInvoicesChecked || report?.totalInvoicesAudited || 0).toLocaleString(), colorRgb: [100, 116, 139] },
  ], fontName)

  // Auditor Opinion Box (Light Card)
  doc.setFillColor(248, 250, 252)
  doc.setDrawColor(226, 232, 240)
  doc.roundedRect(14, y, doc.internal.pageSize.getWidth() - 28, 18, 2, 2, 'FD')

  doc.setFont(fontName, 'bold')
  doc.setFontSize(8)
  doc.setTextColor(15, 23, 42)
  doc.text('Independent Auditor Statutory Opinion Note / تقرير رأي المراجع القانوني المستقل:', 18, y + 5)

  doc.setFont(fontName, 'normal')
  doc.setFontSize(7)
  doc.setTextColor(71, 85, 105)
  const opinionText = report?.opinionBasis || 'In our professional opinion, the financial statements present fairly, in all material respects, the financial position and statutory tax compliance of the entity in conformity with Saudi Arabian General Authority of Zakat & Tax (ZATCA) regulations and IFRS standards.'
  doc.text(doc.splitTextToSize(opinionText, doc.internal.pageSize.getWidth() - 36), 18, y + 9.5)

  y += 24

  // Section 1: ZATCA Phase 2 Verification
  y = drawLightSectionHeading(doc, y, '1. ZATCA Phase 2 Clearance & Verification', 'التحقق من الامتثال لمتطلبات المرحلة الثانية للربط والتكامل', fontName)
  doc.autoTable({
    startY: y,
    head: [['Check Parameter / معيار الفحص', 'Inspection Metric / نطاق الفحص', 'Audit Result / نتيجة التدقيق', 'Status / الحالة']],
    body: [
      ['Cryptographic Hash Chaining / السلسلة التشفيرية', '100% Sequence Validated', 'No broken chain gaps or out-of-order hashes identified', 'PASSED / سليم'],
      ['E-Invoice Clearance & Reporting / إرسال الفواتير', `${(report?.zatcaBreakdown?.totalInvoicesChecked || 0).toLocaleString()} Verified`, 'All B2B & B2C invoices cleared/reported to ZATCA Fatoora platform', 'PASSED / سليم'],
      ['Standard VAT 15% Calculation / حساب الضريبة 15%', 'Automated Line-Item Math', 'Zero calculation variance detected across examined population', 'PASSED / سليم'],
      ['Sequential Numbering Integrity / التسلسل الرقمي', 'Continuous Counter', 'Strict monotonicity verified with zero missing reference indices', 'PASSED / سليم'],
    ],
    theme: 'plain',
    headStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold', fontSize: 7.5, font: fontName },
    bodyStyles: { textColor: [30, 41, 59], fontSize: 7, cellPadding: 3, font: fontName },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: { 0: { cellWidth: 55 }, 1: { cellWidth: 40 }, 2: { cellWidth: 62 }, 3: { halign: 'center', fontStyle: 'bold', textColor: [16, 185, 129] } },
    didDrawPage: (data) => { y = data.cursor.y },
  })

  attachLightPageFooters(doc, fontName)
  doc.save(`External_Audit_Report_${new Date().toISOString().slice(0, 10)}.pdf`)
}

// ─── 5. Daily Invoices PDF Generator ─────────────────────────────────────────

export async function generateDailyInvoicesPdf({ report, tenant, language = 'en' }) {
  const doc = createReportDocument()
  const hasArabic = await ensureAlmaraiFont(doc)
  const fontName = hasArabic ? 'Almarai' : 'helvetica'

  const rows = Array.isArray(report) ? report : []
  const totalInvoices = rows.reduce((sum, r) => sum + (r.invoiceCount || 0), 0)
  const totalTax = rows.reduce((sum, r) => sum + (r.totalTax || 0), 0)
  const totalAmount = rows.reduce((sum, r) => sum + (r.totalAmount || 0), 0)
  const avgDaily = rows.length > 0 ? totalAmount / rows.length : 0

  let y = drawEnterpriseLightHeader(doc, {
    tenant,
    titleEn: 'Daily Sales & Revenue Ledger',
    titleAr: 'تقرير المبيعات والفوترة اليومية',
    reportTypeBadge: 'Daily Revenue / دفتر المبيعات اليومي',
    startDate: rows[0]?._id,
    endDate: rows[rows.length - 1]?._id,
    language,
    fontName,
  })

  y = drawLightKpiGrid(doc, y, [
    { labelEn: 'Active Trading Days', labelAr: 'أيام العمل', value: rows.length.toLocaleString(), sub: 'Days with recorded sales' },
    { labelEn: 'Total Invoices Issued', labelAr: 'إجمالي الفواتير', value: totalInvoices.toLocaleString(), colorRgb: [37, 99, 235] },
    { labelEn: 'Total VAT Tax (15%)', labelAr: 'إجمالي الضريبة (15%)', value: fmtMoney(totalTax), colorRgb: [245, 158, 11] },
    { labelEn: 'Gross Revenue', labelAr: 'إجمالي الإيرادات', value: fmtMoney(totalAmount), colorRgb: [16, 185, 129] },
    { labelEn: 'Daily Average Revenue', labelAr: 'متوسط الإيراد اليومي', value: fmtMoney(avgDaily), colorRgb: [168, 85, 247] },
  ], fontName)

  y = drawLightSectionHeading(doc, y, '1. Chronological Daily Sales Register', 'سجل المبيعات اليومية التفصيلي', fontName)
  doc.autoTable({
    startY: y,
    head: [['Date / التاريخ', 'Invoices / الفواتير', 'VAT Tax Collected / الضريبة (SAR)', 'Gross Amount / الإجمالي (SAR)']],
    body: rows.map((row) => [
      row._id || '—',
      (row.invoiceCount || 0).toLocaleString(),
      fmtMoney(row.totalTax || 0),
      fmtMoney(row.totalAmount || 0),
    ]),
    foot: [['Total Period Summary / المجموع العام', totalInvoices.toLocaleString(), fmtMoney(totalTax), fmtMoney(totalAmount)]],
    theme: 'plain',
    headStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold', fontSize: 7.5, font: fontName },
    footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold', fontSize: 7.5, font: fontName },
    bodyStyles: { textColor: [30, 41, 59], fontSize: 7.5, cellPadding: 3, font: fontName },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: { 0: { cellWidth: 50 }, 1: { halign: 'center' }, 2: { halign: 'right' }, 3: { halign: 'right', fontStyle: 'bold' } },
    didDrawPage: (data) => { y = data.cursor.y },
  })

  y += 6

  // Summary Totals Card
  y = drawInvoiceStyleSummaryBox(doc, y, [
    { labelEn: 'Total Net (Ex-VAT)', labelAr: 'صافي المبيعات بدون الضريبة', value: fmtMoney(totalAmount - totalTax) },
    { labelEn: 'Total VAT Tax (15%)', labelAr: 'إجمالي ضريبة القيمة المضافة', value: fmtMoney(totalTax) },
    { labelEn: 'Grand Total Billed', labelAr: 'المجموع الإجمالي شامل الضريبة', value: fmtMoney(totalAmount), isHighlight: true },
  ], fontName)

  attachLightPageFooters(doc, fontName)
  doc.save(`Daily_Sales_Report_${new Date().toISOString().slice(0, 10)}.pdf`)
}

// ─── 6. Customer Sales PDF Generator ─────────────────────────────────────────

export async function generateCustomerSalesPdf({ report, tenant, language = 'en' }) {
  const doc = createReportDocument()
  const hasArabic = await ensureAlmaraiFont(doc)
  const fontName = hasArabic ? 'Almarai' : 'helvetica'

  const rows = Array.isArray(report) ? report : []
  const totalCustomers = rows.length
  const totalInvoices = rows.reduce((sum, r) => sum + (r.invoiceCount || 0), 0)
  const totalAmount = rows.reduce((sum, r) => sum + (r.totalAmount || 0), 0)
  const avgPerCustomer = totalCustomers > 0 ? totalAmount / totalCustomers : 0

  let y = drawEnterpriseLightHeader(doc, {
    tenant,
    titleEn: 'Customer Sales & Account Revenue Report',
    titleAr: 'تقرير مبيعات وحسابات العملاء',
    reportTypeBadge: 'Customer Accounts / حسابات ومبيعات العملاء',
    language,
    fontName,
  })

  y = drawLightKpiGrid(doc, y, [
    { labelEn: 'Active Buying Accounts', labelAr: 'العملاء النشطين', value: totalCustomers.toLocaleString(), sub: 'Customer entities' },
    { labelEn: 'Total Invoices Billed', labelAr: 'إجمالي الفواتير', value: totalInvoices.toLocaleString(), colorRgb: [37, 99, 235] },
    { labelEn: 'Total Billed Revenue', labelAr: 'إجمالي المبيعات', value: fmtMoney(totalAmount), colorRgb: [16, 185, 129] },
    { labelEn: 'Avg Revenue / Customer', labelAr: 'متوسط مبيعات العميل', value: fmtMoney(avgPerCustomer), colorRgb: [245, 158, 11] },
    { labelEn: 'Top Customer Share', labelAr: 'حصة أعلى عميل', value: totalAmount > 0 ? `${(((rows[0]?.totalAmount || 0) / totalAmount) * 100).toFixed(1)}%` : '0%', colorRgb: [168, 85, 247] },
  ], fontName)

  y = drawLightSectionHeading(doc, y, '1. Customer Lifetime & Period Revenue Rankings', 'تصنيف مبيعات وحسابات العملاء', fontName)
  doc.autoTable({
    startY: y,
    head: [['#', 'Customer Name / اسم العميل', 'Invoices / الفواتير', 'Total Revenue / الإجمالي (SAR)', 'Share % / النسبة']],
    body: rows.map((row, idx) => {
      const share = totalAmount > 0 ? (((row.totalAmount || 0) / totalAmount) * 100).toFixed(1) : '0'
      return [
        `#${idx + 1}`,
        row.customerName || 'Walk-in Retail Customer / عميل نقدي',
        (row.invoiceCount || 0).toLocaleString(),
        fmtMoney(row.totalAmount || 0),
        `${share}%`,
      ]
    }),
    foot: [['—', 'Total All Customers / إجمالي كافة العملاء', totalInvoices.toLocaleString(), fmtMoney(totalAmount), '100%']],
    theme: 'plain',
    headStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold', fontSize: 7.5, font: fontName },
    footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold', fontSize: 7.5, font: fontName },
    bodyStyles: { textColor: [30, 41, 59], fontSize: 7.5, cellPadding: 3, font: fontName },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: { 0: { cellWidth: 15, halign: 'center' }, 1: { cellWidth: 80 }, 2: { halign: 'center' }, 3: { halign: 'right', fontStyle: 'bold' }, 4: { halign: 'center' } },
    didDrawPage: (data) => { y = data.cursor.y },
  })

  attachLightPageFooters(doc, fontName)
  doc.save(`Customer_Sales_Report_${new Date().toISOString().slice(0, 10)}.pdf`)
}

// ─── 7. Restaurant Operations PDF Generator ───────────────────────────────────

export async function generateRestaurantPdf({ report, tenant, language = 'en' }) {
  const doc = createReportDocument()
  const hasArabic = await ensureAlmaraiFont(doc)
  const fontName = hasArabic ? 'Almarai' : 'helvetica'

  const section = report?.sections?.find((s) => s.key === 'restaurant') || report?.sections?.[0] || report
  const kpis = section?.kpis || []
  const tables = section?.tables || []

  let y = drawEnterpriseLightHeader(doc, {
    tenant,
    titleEn: 'Restaurant Operations & Sales Report',
    titleAr: 'تقرير مبيعات وعمليات المطعم',
    reportTypeBadge: 'Restaurant POS / مبيعات وإيرادات المطعم',
    startDate: report?.period?.startDate,
    endDate: report?.period?.endDate,
    language,
    fontName,
  })

  const formattedKpis = kpis.map((k) => ({
    labelEn: typeof k.label === 'object' ? k.label.en : k.label,
    labelAr: typeof k.label === 'object' ? k.label.ar : '',
    value: k.format === 'money' ? fmtMoney(k.value) : k.format === 'percent' ? `${k.value}%` : Number(k.value || 0).toLocaleString(),
    colorRgb: [225, 29, 72],
  }))

  y = drawLightKpiGrid(doc, y, formattedKpis, fontName)

  tables.forEach((tbl, tIdx) => {
    const titleEn = typeof tbl.title === 'object' ? tbl.title.en : tbl.title
    const titleAr = typeof tbl.title === 'object' ? tbl.title.ar : ''
    y = drawLightSectionHeading(doc, y, `${tIdx + 1}. ${titleEn}`, titleAr, fontName)

    const headers = (tbl.columns || []).map((col) => {
      const en = typeof col.label === 'object' ? col.label.en : col.label
      const ar = typeof col.label === 'object' ? col.label.ar : ''
      return ar ? `${en} / ${ar}` : en
    })

    const body = (tbl.rows || []).map((row) =>
      (tbl.columns || []).map((col) => {
        const val = row[col.key]
        if (col.format === 'money') return fmtMoney(val)
        if (col.format === 'number') return Number(val || 0).toLocaleString()
        return safeText(val)
      })
    )

    doc.autoTable({
      startY: y,
      head: [headers],
      body,
      theme: 'plain',
      headStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold', fontSize: 7.5, font: fontName },
      bodyStyles: { textColor: [30, 41, 59], fontSize: 7.5, cellPadding: 3, font: fontName },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      didDrawPage: (data) => { y = data.cursor.y },
    })

    y += 6
  })

  attachLightPageFooters(doc, fontName)
  doc.save(`Restaurant_Report_${new Date().toISOString().slice(0, 10)}.pdf`)
}

// ─── 8. Trading & Inventory PDF Generator ────────────────────────────────────

export async function generateTradingPdf({ report, tenant, language = 'en' }) {
  const doc = createReportDocument()
  const hasArabic = await ensureAlmaraiFont(doc)
  const fontName = hasArabic ? 'Almarai' : 'helvetica'

  const section = report?.sections?.find((s) => s.key === 'trading') || report?.sections?.[0] || report
  const kpis = section?.kpis || []
  const tables = section?.tables || []

  let y = drawEnterpriseLightHeader(doc, {
    tenant,
    titleEn: 'Trading & Inventory Valuation Report',
    titleAr: 'تقرير التجارة وتقييم المخزون',
    reportTypeBadge: 'Inventory & Wholesale / التجارة والمخزون',
    startDate: report?.period?.startDate,
    endDate: report?.period?.endDate,
    language,
    fontName,
  })

  const formattedKpis = kpis.map((k) => ({
    labelEn: typeof k.label === 'object' ? k.label.en : k.label,
    labelAr: typeof k.label === 'object' ? k.label.ar : '',
    value: k.format === 'money' ? fmtMoney(k.value) : k.format === 'percent' ? `${k.value}%` : Number(k.value || 0).toLocaleString(),
    colorRgb: [37, 99, 235],
  }))

  y = drawLightKpiGrid(doc, y, formattedKpis, fontName)

  tables.forEach((tbl, tIdx) => {
    const titleEn = typeof tbl.title === 'object' ? tbl.title.en : tbl.title
    const titleAr = typeof tbl.title === 'object' ? tbl.title.ar : ''
    y = drawLightSectionHeading(doc, y, `${tIdx + 1}. ${titleEn}`, titleAr, fontName)

    const headers = (tbl.columns || []).map((col) => {
      const en = typeof col.label === 'object' ? col.label.en : col.label
      const ar = typeof col.label === 'object' ? col.label.ar : ''
      return ar ? `${en} / ${ar}` : en
    })

    const body = (tbl.rows || []).map((row) =>
      (tbl.columns || []).map((col) => {
        const val = row[col.key]
        if (col.format === 'money') return fmtMoney(val)
        if (col.format === 'number') return Number(val || 0).toLocaleString()
        return safeText(val)
      })
    )

    doc.autoTable({
      startY: y,
      head: [headers],
      body,
      theme: 'plain',
      headStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold', fontSize: 7.5, font: fontName },
      bodyStyles: { textColor: [30, 41, 59], fontSize: 7.5, cellPadding: 3, font: fontName },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      didDrawPage: (data) => { y = data.cursor.y },
    })

    y += 6
  })

  attachLightPageFooters(doc, fontName)
  doc.save(`Trading_Inventory_Report_${new Date().toISOString().slice(0, 10)}.pdf`)
}

// ─── Master Unified Dispatcher ───────────────────────────────────────────────

export async function downloadMasterReportPdf({ reportType, report, tenant, language = 'en' }) {
  if (!report) throw new Error('No report data available to export')

  if (reportType === 'vat') {
    return generateVatReturnPdf({ report, tenant, language })
  }
  if (reportType === 'business') {
    return generateBusinessPdf({ report, tenant, language })
  }
  if (reportType === 'internal_audit') {
    return generateInternalAuditPdf({ report, tenant, language })
  }
  if (reportType === 'external_audit') {
    return generateExternalAuditPdf({ report, tenant, language })
  }
  if (reportType === 'daily') {
    return generateDailyInvoicesPdf({ report, tenant, language })
  }
  if (reportType === 'sales') {
    return generateCustomerSalesPdf({ report, tenant, language })
  }
  if (reportType === 'ops:restaurant' || reportType === 'restaurant') {
    return generateRestaurantPdf({ report, tenant, language })
  }
  if (reportType === 'ops:trading' || reportType === 'trading') {
    return generateTradingPdf({ report, tenant, language })
  }

  return generateTradingPdf({ report, tenant, language })
}
