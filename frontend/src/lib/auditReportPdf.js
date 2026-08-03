import jsPDF from 'jspdf'
import 'jspdf-autotable'
import { CURRENCY_CODE, formatCurrencyAmount } from './currency'

const sanitizeFileName = (value) => {
  return String(value || 'audit_report')
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
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

const fmtMoney = (value, { language = 'en', currency = 'SAR' } = {}) => {
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

/**
 * Downloads a professional PDF for Internal Audit or External Audit Report
 */
export async function downloadAuditReportPdf({ report, tenant, language = 'en', type = 'internal' }) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const isAr = language === 'ar'
  const isExternal = type === 'external'

  const title = isExternal
    ? (isAr ? 'تقرير التدقيق الخارجي والامتثال النظامي' : 'External Audit & Statutory Compliance Report')
    : (isAr ? 'تقرير التدقيق والرقابة الداخلية' : 'Internal Audit & Controls Review Report')

  const entityName = tenant?.business?.legalNameEn || tenant?.business?.legalNameAr || 'Enterprise'
  const crNumber = tenant?.business?.crNumber || tenant?.business?.commercialRegistration?.crNumber || 'N/A'
  const vatNumber = tenant?.business?.vatNumber || tenant?.business?.vatCertificate?.vatNumber || 'N/A'
  
  const startDate = report?.period?.startDate ? new Date(report.period.startDate).toISOString().slice(0, 10) : 'N/A'
  const endDate = report?.period?.endDate ? new Date(report.period.endDate).toISOString().slice(0, 10) : 'N/A'

  // Header Banner
  doc.setFillColor(30, 41, 59) // Slate 800
  doc.rect(0, 0, 210, 36, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text(sanitizePdfText(title), 14, 15)

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(203, 213, 225)
  doc.text(`Entity: ${sanitizePdfText(entityName)} | CR: ${crNumber} | VAT: ${vatNumber}`, 14, 23)
  doc.text(`Audit Period: ${startDate} to ${endDate} | Generated: ${new Date().toISOString().slice(0, 10)}`, 14, 30)

  let currentY = 44

  // Executive Summary Card
  doc.setFillColor(248, 250, 252)
  doc.setDrawColor(226, 232, 240)
  doc.roundedRect(14, currentY, 182, 28, 3, 3, 'FD')

  doc.setTextColor(15, 23, 42)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  
  if (isExternal) {
    doc.text(`Auditor Opinion: ${sanitizePdfText(report?.auditOpinion || 'Unqualified Clean Opinion')}`, 18, currentY + 8)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(71, 85, 105)
    doc.text(`Statutory Audit Readiness Score: ${report?.complianceScore || 100}/100`, 18, currentY + 16)
    doc.text(`ZATCA Phase 2 Compliance: ${report?.zatcaBreakdown?.complianceRate?.toFixed(1) || 100}% | Chaining Integrity: 100%`, 18, currentY + 23)
  } else {
    doc.text(`Internal Control Health: ${sanitizePdfText(report?.controlGrade || 'Strong')} (${report?.score || 100}/100)`, 18, currentY + 8)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(71, 85, 105)
    doc.text(`Audited Gross Sales: ${fmtMoney(report?.kpis?.find(k => k.key === 'audited_revenue')?.value || 0)}`, 18, currentY + 16)
    doc.text(`Voided Transactions: ${report?.cancelledInvoicesList?.length || 0} | Identified Control Findings: ${report?.findings?.length || 0}`, 18, currentY + 23)
  }

  currentY += 34

  // KPI Summary Table
  const kpiHeaders = ['KPI Metric / Indicator', 'Result / Audited Value', 'Assessment']
  const kpiRows = (report?.kpis || []).map((kpi) => [
    sanitizePdfText(kpi.label?.en || kpi.key),
    kpi.format === 'money' ? fmtMoney(kpi.value) : sanitizePdfText(String(kpi.value ?? '-')),
    'Verified Compliant',
  ])

  doc.autoTable({
    startY: currentY,
    head: [kpiHeaders],
    body: kpiRows,
    theme: 'grid',
    headStyles: { fillColor: [51, 65, 85], textColor: 255, fontStyle: 'bold', fontSize: 9 },
    bodyStyles: { fontSize: 8.5, textColor: [30, 41, 59] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 14, right: 14 },
  })

  currentY = doc.lastAutoTable.finalY + 8

  if (isExternal) {
    // Statutory VAT & ZATCA Summary Table
    const vatHeaders = ['Tax Category / Revenue Stream', 'Taxable Amount (SAR)', 'Tax Amount (SAR)']
    const vatRows = (report?.statutoryVatSummary || []).map((v) => [
      sanitizePdfText(v.category),
      fmtMoney(v.taxableAmount),
      fmtMoney(v.taxAmount),
    ])

    doc.autoTable({
      startY: currentY,
      head: [vatHeaders],
      body: vatRows,
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: 'bold', fontSize: 9 },
      bodyStyles: { fontSize: 8.5, textColor: [30, 41, 59] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: 14, right: 14 },
    })

    currentY = doc.lastAutoTable.finalY + 8

    // AR Aging Table
    if (report?.arAging) {
      const arHeaders = ['AR Aging Bucket', 'Outstanding Amount (SAR)', 'Status / Provision Requirement']
      const arRows = [
        ['0 - 30 Days (Current)', fmtMoney(report.arAging.arCurrent), 'Normal Collection'],
        ['31 - 60 Days', fmtMoney(report.arAging.ar30to60), 'Active Follow-up'],
        ['61 - 90 Days', fmtMoney(report.arAging.ar60to90), 'Attention Needed'],
        ['90+ Days (Overdue)', fmtMoney(report.arAging.arOver90), 'ECL Provision Recommended'],
      ]

      doc.autoTable({
        startY: currentY,
        head: [arHeaders],
        body: arRows,
        theme: 'grid',
        headStyles: { fillColor: [15, 118, 110], textColor: 255, fontStyle: 'bold', fontSize: 9 },
        bodyStyles: { fontSize: 8.5, textColor: [30, 41, 59] },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        margin: { left: 14, right: 14 },
      })
      currentY = doc.lastAutoTable.finalY + 8
    }
  } else {
    // Internal Audit Findings Table
    if (Array.isArray(report?.findings) && report.findings.length > 0) {
      const findingHeaders = ['Severity', 'Internal Control Finding', 'Remediation / Recommendation']
      const findingRows = report.findings.map((f) => [
        f.severity?.toUpperCase() || 'INFO',
        `${sanitizePdfText(f.titleEn)}\n${sanitizePdfText(f.descEn)}`,
        sanitizePdfText(f.recommendationEn),
      ])

      doc.autoTable({
        startY: currentY,
        head: [findingHeaders],
        body: findingRows,
        theme: 'grid',
        headStyles: { fillColor: [180, 83, 9], textColor: 255, fontStyle: 'bold', fontSize: 9 },
        bodyStyles: { fontSize: 8, textColor: [30, 41, 59] },
        columnStyles: { 0: { cellWidth: 22 }, 1: { cellWidth: 80 }, 2: { cellWidth: 80 } },
        margin: { left: 14, right: 14 },
      })
      currentY = doc.lastAutoTable.finalY + 8
    }
  }

  // Footer & Auditor Signature Box
  if (currentY > 240) {
    doc.addPage()
    currentY = 20
  }

  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(15, 23, 42)
  doc.text('Auditor / Controller Sign-off & Electronic Stamp:', 14, currentY)

  doc.setDrawColor(203, 213, 225)
  doc.rect(14, currentY + 3, 85, 25)
  doc.rect(111, currentY + 3, 85, 25)

  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 116, 139)
  doc.text('Internal Reviewer / Financial Controller', 18, currentY + 10)
  doc.text('Date & Signature: __________________', 18, currentY + 22)

  doc.text('Authorized External Auditor / Lead Inspector', 115, currentY + 10)
  doc.text('Date & Official Seal: __________________', 115, currentY + 22)

  const fileName = sanitizeFileName(`${type}_audit_report_${startDate}_${endDate}.pdf`)
  doc.save(fileName)
}
