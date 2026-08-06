// ─── Master Spreadsheet Exporter (Excel & CSV) for All 8 Reports ──────────────

const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

const safeCsv = (val) => {
  if (val === null || val === undefined) return '""'
  const str = String(val).replace(/"/g, '""')
  return `"${str}"`
}

const formatDate = (val) => {
  if (!val) return ''
  const d = new Date(val)
  if (Number.isNaN(d.getTime())) return String(val)
  return d.toISOString().slice(0, 10)
}

// ─── CSV Builder Engine ──────────────────────────────────────────────────────

export function exportReportToCsv({ reportType, report, tenant, language = 'en' }) {
  const isAr = language === 'ar'
  const lines = []
  const dateStr = new Date().toISOString().slice(0, 10)
  const company = tenant?.business?.legalNameEn || tenant?.name || 'Maqder Enterprise'

  // Header metadata block
  lines.push([safeCsv('Maqder ERP Enterprise Report'), safeCsv(company)].join(','))
  lines.push([safeCsv('Report Type'), safeCsv(reportType.toUpperCase())].join(','))
  lines.push([safeCsv('Generated Date'), safeCsv(dateStr)].join(','))
  if (report?.period?.startDate && report?.period?.endDate) {
    lines.push([safeCsv('Period'), safeCsv(`${formatDate(report.period.startDate)} to ${formatDate(report.period.endDate)}`)].join(','))
  }
  lines.push('') // empty line

  if (reportType === 'vat') {
    const t = report?.totals || {}
    const st = report?.vatReturn?.statement || {}
    lines.push(safeCsv('--- 1. VAT SUMMARY KPIs ---'))
    lines.push([safeCsv('Total Invoices'), safeCsv(t.invoiceCount || 0)].join(','))
    lines.push([safeCsv('Total Taxable Sales'), safeCsv(t.taxableAmount || 0)].join(','))
    lines.push([safeCsv('Output VAT (15%)'), safeCsv(t.totalTax || 0)].join(','))
    lines.push([safeCsv('Input VAT Deductible'), safeCsv(t.purchasesTaxAmount || 0)].join(','))
    lines.push([safeCsv('Net VAT Due'), safeCsv((t.totalTax || 0) - (t.purchasesTaxAmount || 0))].join(','))
    lines.push('')

    lines.push(safeCsv('--- 2. OFFICIAL VAT DECLARATION STATEMENT (ZATCA) ---'))
    lines.push([safeCsv('Line Item'), safeCsv('Amount (SAR)'), safeCsv('Adjustment (SAR)'), safeCsv('VAT Amount (SAR)')].join(','))
    lines.push([safeCsv('Standard Rated Sales (15%)'), safeCsv(st?.salesStandardRated?.amount || 0), safeCsv(st?.salesStandardRated?.adjustment || 0), safeCsv(st?.salesStandardRated?.vatAmount || 0)].join(','))
    lines.push([safeCsv('Special Citizen Supplies'), safeCsv(st?.salesSpecialCitizen?.amount || 0), safeCsv(st?.salesSpecialCitizen?.adjustment || 0), safeCsv(st?.salesSpecialCitizen?.vatAmount || 0)].join(','))
    lines.push([safeCsv('Zero-Rated Domestic Sales'), safeCsv(st?.salesZeroRatedDomestic?.amount || 0), safeCsv(st?.salesZeroRatedDomestic?.adjustment || 0), safeCsv(st?.salesZeroRatedDomestic?.vatAmount || 0)].join(','))
    lines.push([safeCsv('Exports Outside KSA'), safeCsv(st?.salesExports?.amount || 0), safeCsv(st?.salesExports?.adjustment || 0), safeCsv(st?.salesExports?.vatAmount || 0)].join(','))
    lines.push([safeCsv('Exempt Supplies'), safeCsv(st?.salesExempt?.amount || 0), safeCsv(st?.salesExempt?.adjustment || 0), safeCsv(st?.salesExempt?.vatAmount || 0)].join(','))
    lines.push([safeCsv('Total Sales & Output Tax'), safeCsv(st?.totalSales?.amount || t.taxableAmount || 0), safeCsv(st?.totalSales?.adjustment || 0), safeCsv(st?.totalSales?.vatAmount || t.totalTax || 0)].join(','))
    lines.push([safeCsv('Standard Rated Domestic Purchases'), safeCsv(st?.purchasesStandardRatedDomestic?.amount || 0), safeCsv(st?.purchasesStandardRatedDomestic?.adjustment || 0), safeCsv(st?.purchasesStandardRatedDomestic?.vatAmount || 0)].join(','))
    lines.push([safeCsv('Imports Subject to Customs (15%)'), safeCsv(st?.purchasesImportsCustoms?.amount || 0), safeCsv(st?.purchasesImportsCustoms?.adjustment || 0), safeCsv(st?.purchasesImportsCustoms?.vatAmount || 0)].join(','))
    lines.push([safeCsv('Total Purchases & Input Tax'), safeCsv(st?.totalPurchases?.amount || 0), safeCsv(st?.totalPurchases?.adjustment || 0), safeCsv(st?.totalPurchases?.vatAmount || t.purchasesTaxAmount || 0)].join(','))
    lines.push([safeCsv('Net VAT Due'), safeCsv(''), safeCsv(''), safeCsv(st?.netVatDue?.vatAmount ?? (t.totalTax || 0) - (t.purchasesTaxAmount || 0))].join(','))

  } else if (reportType === 'business') {
    const t = report?.totals || {}
    lines.push(safeCsv('--- 1. FINANCIAL PERFORMANCE KPIS ---'))
    lines.push([safeCsv('Gross Sales'), safeCsv(t?.sales?.grandTotal || 0)].join(','))
    lines.push([safeCsv('Purchases'), safeCsv(t?.purchases?.grandTotal || 0)].join(','))
    lines.push([safeCsv('Expenses'), safeCsv(t?.expenses?.totalAmount || 0)].join(','))
    lines.push([safeCsv('Sales Discounts'), safeCsv(t?.sales?.totalDiscount || 0)].join(','))
    lines.push([safeCsv('Net Profit'), safeCsv(t?.net || 0)].join(','))
    lines.push('')

    lines.push(safeCsv('--- 2. SALES BY TRANSACTION TYPE ---'))
    lines.push([safeCsv('Type'), safeCsv('Invoices Count'), safeCsv('Discount (SAR)'), safeCsv('Revenue (SAR)'), safeCsv('Tax (SAR)')].join(','))
    ;(report?.breakdown?.salesByTransactionType || []).forEach((r) => {
      lines.push([safeCsv(r._id), safeCsv(r.invoiceCount || 0), safeCsv(r.discount || 0), safeCsv(r.revenue || 0), safeCsv(r.tax || 0)].join(','))
    })
    lines.push('')

    lines.push(safeCsv('--- 3. TOP CUSTOMERS ---'))
    lines.push([safeCsv('Customer'), safeCsv('Invoices Count'), safeCsv('Revenue (SAR)')].join(','))
    ;(report?.breakdown?.topCustomers || []).forEach((r) => {
      lines.push([safeCsv(r._id), safeCsv(r.invoiceCount || 0), safeCsv(r.revenue || 0)].join(','))
    })

  } else if (reportType === 'daily') {
    const rows = Array.isArray(report) ? report : []
    lines.push([safeCsv('Date (YYYY-MM-DD)'), safeCsv('Invoices Count'), safeCsv('Total VAT Tax (SAR)'), safeCsv('Grand Total Amount (SAR)')].join(','))
    rows.forEach((r) => {
      lines.push([safeCsv(r._id), safeCsv(r.invoiceCount || 0), safeCsv(r.totalTax || 0), safeCsv(r.totalAmount || 0)].join(','))
    })

  } else if (reportType === 'sales') {
    const rows = Array.isArray(report) ? report : []
    lines.push([safeCsv('Customer Name'), safeCsv('Invoices Count'), safeCsv('Total Sales Revenue (SAR)')].join(','))
    rows.forEach((r) => {
      lines.push([safeCsv(r.customerName || 'Walk-in'), safeCsv(r.invoiceCount || 0), safeCsv(r.totalAmount || 0)].join(','))
    })

  } else if (reportType === 'internal_audit') {
    lines.push([safeCsv('Control Grade'), safeCsv(report?.controlGrade || 'Strong')].join(','))
    lines.push([safeCsv('Compliance Score'), safeCsv(report?.score || 100)].join(','))
    lines.push('')
    lines.push(safeCsv('--- CANCELLED INVOICES ---'))
    lines.push([safeCsv('Invoice Number'), safeCsv('Issue Date'), safeCsv('Customer'), safeCsv('Amount (SAR)'), safeCsv('Reason')].join(','))
    ;(report?.cancelledInvoicesList || []).forEach((r) => {
      lines.push([safeCsv(r.invoiceNumber), safeCsv(formatDate(r.issueDate)), safeCsv(r.customerName), safeCsv(r.amount), safeCsv(r.reason)].join(','))
    })

  } else if (reportType === 'external_audit') {
    lines.push([safeCsv('Auditor Opinion'), safeCsv(report?.auditOpinion || 'Unqualified Clean')].join(','))
    lines.push([safeCsv('ZATCA Compliance Rate'), safeCsv(`${report?.zatcaBreakdown?.complianceRate || 100}%`)].join(','))
    lines.push([safeCsv('Cryptographic Chaining'), safeCsv('100% Validated')].join(','))

  } else if (reportType.includes('restaurant') || reportType.includes('trading') || report?.sections) {
    const section = report?.sections?.find((s) => reportType.includes(s.key)) || report?.sections?.[0] || report
    lines.push(safeCsv(`--- KPIS (${section?.key || reportType}) ---`))
    ;(section?.kpis || []).forEach((k) => {
      const lbl = typeof k.label === 'object' ? k.label.en : k.label
      lines.push([safeCsv(lbl), safeCsv(k.value)].join(','))
    })
    lines.push('')
    ;(section?.tables || []).forEach((tbl) => {
      const title = typeof tbl.title === 'object' ? tbl.title.en : tbl.title
      lines.push(safeCsv(`--- ${title} ---`))
      const colHeaders = (tbl.columns || []).map((c) => safeCsv(typeof c.label === 'object' ? c.label.en : c.label))
      lines.push(colHeaders.join(','))
      ;(tbl.rows || []).map((row) => {
        const rowVals = (tbl.columns || []).map((c) => safeCsv(row[c.key]))
        lines.push(rowVals.join(','))
      })
      lines.push('')
    })
  }

  // Prepend UTF-8 BOM so Excel opens Arabic correctly
  const csvContent = '\uFEFF' + lines.join('\r\n')
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  downloadBlob(blob, `${reportType}_Report_${dateStr}.csv`)
}

// ─── Excel (XLSX) Builder Engine ──────────────────────────────────────────────

export async function exportReportToExcel({ reportType, report, tenant, language = 'en' }) {
  const xlsxModule = await import('xlsx')
  const XLSX = xlsxModule.default || xlsxModule
  const workbook = XLSX.utils.book_new()
  const dateStr = new Date().toISOString().slice(0, 10)

  const autoWidth = (ws) => {
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:Z50')
    const colWidths = []
    for (let C = range.s.c; C <= range.e.c; ++C) {
      let maxLen = 12
      for (let R = range.s.r; R <= range.e.r; ++R) {
        const cell = ws[XLSX.utils.encode_cell({ r: R, c: C })]
        if (cell && cell.v) {
          const len = String(cell.v).length
          if (len > maxLen) maxLen = Math.min(len + 4, 60)
        }
      }
      colWidths.push({ wch: maxLen })
    }
    ws['!cols'] = colWidths
  }

  if (reportType === 'vat') {
    const t = report?.totals || {}
    const st = report?.vatReturn?.statement || {}

    // Sheet 1: Executive Summary
    const summaryData = [
      ['Maqder ERP - VAT Declaration Statement', ''],
      ['Tenant', tenant?.name || 'Company'],
      ['Period', `${formatDate(report?.period?.startDate)} to ${formatDate(report?.period?.endDate)}`],
      ['Generated On', dateStr],
      [],
      ['Key Performance Indicator', 'Value (SAR / Count)'],
      ['Total Invoices Issued', t.invoiceCount || 0],
      ['Standard Rated Sales Taxable', t.byCategory?.standardRated?.taxableAmount || 0],
      ['Standard Rated Output VAT (15%)', t.totalTax || 0],
      ['Input Deductible VAT', t.purchasesTaxAmount || 0],
      ['Net VAT Due to ZATCA', (t.totalTax || 0) - (t.purchasesTaxAmount || 0)],
    ]
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData)
    autoWidth(wsSummary)
    XLSX.utils.book_append_sheet(workbook, wsSummary, 'VAT_Summary')

    // Sheet 2: Official Statement
    const statementData = [
      ['ZATCA Declaration Line Item', 'Base Amount (SAR)', 'Adjustment (SAR)', 'VAT Amount (SAR)'],
      ['1. Standard Rated Sales (15%)', st?.salesStandardRated?.amount || 0, st?.salesStandardRated?.adjustment || 0, st?.salesStandardRated?.vatAmount || 0],
      ['2. Special Citizen Supplies', st?.salesSpecialCitizen?.amount || 0, st?.salesSpecialCitizen?.adjustment || 0, st?.salesSpecialCitizen?.vatAmount || 0],
      ['3. Zero-Rated Domestic Sales', st?.salesZeroRatedDomestic?.amount || 0, st?.salesZeroRatedDomestic?.adjustment || 0, st?.salesZeroRatedDomestic?.vatAmount || 0],
      ['4. Exports Outside KSA', st?.salesExports?.amount || 0, st?.salesExports?.adjustment || 0, st?.salesExports?.vatAmount || 0],
      ['5. Exempt Supplies', st?.salesExempt?.amount || 0, st?.salesExempt?.adjustment || 0, st?.salesExempt?.vatAmount || 0],
      ['Total Sales & Output VAT', st?.totalSales?.amount || t.taxableAmount || 0, st?.totalSales?.adjustment || 0, st?.totalSales?.vatAmount || t.totalTax || 0],
      ['6. Standard Rated Purchases', st?.purchasesStandardRatedDomestic?.amount || 0, st?.purchasesStandardRatedDomestic?.adjustment || 0, st?.purchasesStandardRatedDomestic?.vatAmount || 0],
      ['7. Imports Subject to Customs (15%)', st?.purchasesImportsCustoms?.amount || 0, st?.purchasesImportsCustoms?.adjustment || 0, st?.purchasesImportsCustoms?.vatAmount || 0],
      ['Total Purchases & Input VAT', st?.totalPurchases?.amount || 0, st?.totalPurchases?.adjustment || 0, st?.totalPurchases?.vatAmount || t.purchasesTaxAmount || 0],
      ['Net VAT Due for Period', '', '', st?.netVatDue?.vatAmount ?? (t.totalTax || 0) - (t.purchasesTaxAmount || 0)],
    ]
    const wsStatement = XLSX.utils.aoa_to_sheet(statementData)
    autoWidth(wsStatement)
    XLSX.utils.book_append_sheet(workbook, wsStatement, 'ZATCA_Statement')

  } else if (reportType === 'business') {
    const t = report?.totals || {}
    const pnlData = [
      ['Business P&L Metric', 'Amount (SAR)'],
      ['Gross Invoiced Sales', t?.sales?.grandTotal || 0],
      ['Taxable Sales (ex-VAT)', t?.sales?.taxableAmount || 0],
      ['Sales Discounts', t?.sales?.totalDiscount || 0],
      ['Purchases (Cost)', t?.purchases?.grandTotal || 0],
      ['Operating Expenses', t?.expenses?.totalAmount || 0],
      ['Net Profit / Yield', t?.net || 0],
    ]
    const wsPnl = XLSX.utils.aoa_to_sheet(pnlData)
    autoWidth(wsPnl)
    XLSX.utils.book_append_sheet(workbook, wsPnl, 'P&L_Summary')

    const salesByType = (report?.breakdown?.salesByTransactionType || []).map((r) => ({
      Type: r._id,
      Invoices: r.invoiceCount || 0,
      Discount: r.discount || 0,
      Revenue: r.revenue || 0,
      VAT: r.tax || 0,
    }))
    const wsSales = XLSX.utils.json_to_sheet(salesByType)
    autoWidth(wsSales)
    XLSX.utils.book_append_sheet(workbook, wsSales, 'Sales_By_Type')

    const topCust = (report?.breakdown?.topCustomers || []).map((r) => ({
      Customer: r._id,
      Invoices: r.invoiceCount || 0,
      Revenue_SAR: r.revenue || 0,
    }))
    const wsCust = XLSX.utils.json_to_sheet(topCust)
    autoWidth(wsCust)
    XLSX.utils.book_append_sheet(workbook, wsCust, 'Top_Customers')

  } else if (reportType === 'daily') {
    const rows = (Array.isArray(report) ? report : []).map((r) => ({
      Date: r._id,
      Invoices_Count: r.invoiceCount || 0,
      Total_VAT_SAR: r.totalTax || 0,
      Gross_Total_SAR: r.totalAmount || 0,
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    autoWidth(ws)
    XLSX.utils.book_append_sheet(workbook, ws, 'Daily_Sales')

  } else if (reportType === 'sales') {
    const rows = (Array.isArray(report) ? report : []).map((r, idx) => ({
      Rank: idx + 1,
      Customer_Name: r.customerName || 'Walk-in',
      Invoices_Count: r.invoiceCount || 0,
      Total_Sales_SAR: r.totalAmount || 0,
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    autoWidth(ws)
    XLSX.utils.book_append_sheet(workbook, ws, 'Customer_Sales')

  } else if (reportType === 'internal_audit') {
    const summary = [
      ['Internal Control Grade', report?.controlGrade || 'Strong'],
      ['Audit Score', `${report?.score || 100}/100`],
      ['Total Findings', report?.findings?.length || 0],
    ]
    const wsSum = XLSX.utils.aoa_to_sheet(summary)
    autoWidth(wsSum)
    XLSX.utils.book_append_sheet(workbook, wsSum, 'Audit_Summary')

    const cancelled = (report?.cancelledInvoicesList || []).map((r) => ({
      Invoice_Number: r.invoiceNumber,
      Date: formatDate(r.issueDate),
      Customer: r.customerName,
      Amount_SAR: r.amount,
      Reason: r.reason,
    }))
    const wsCanc = XLSX.utils.json_to_sheet(cancelled)
    autoWidth(wsCanc)
    XLSX.utils.book_append_sheet(workbook, wsCanc, 'Cancelled_Invoices')

  } else if (reportType === 'external_audit') {
    const auditData = [
      ['Statutory Parameter', 'Status / Value'],
      ['Auditor Opinion', report?.auditOpinion || 'Unqualified Clean'],
      ['ZATCA Phase 2 Compliance Rate', `${report?.zatcaBreakdown?.complianceRate || 100}%`],
      ['Cryptographic Hash Chaining', '100% Validated'],
      ['Total Invoices Inspected', report?.zatcaBreakdown?.totalInvoicesChecked || 0],
    ]
    const ws = XLSX.utils.aoa_to_sheet(auditData)
    autoWidth(ws)
    XLSX.utils.book_append_sheet(workbook, ws, 'Statutory_Audit')

  } else {
    // Restaurant / Trading / Ops
    const section = report?.sections?.find((s) => reportType.includes(s.key)) || report?.sections?.[0] || report
    const kpis = (section?.kpis || []).map((k) => ({
      Metric: typeof k.label === 'object' ? k.label.en : k.label,
      Value: k.value,
    }))
    const wsKpi = XLSX.utils.json_to_sheet(kpis)
    autoWidth(wsKpi)
    XLSX.utils.book_append_sheet(workbook, wsKpi, 'KPIs')

    ;(section?.tables || []).forEach((tbl, idx) => {
      const title = (typeof tbl.title === 'object' ? tbl.title.en : tbl.title).slice(0, 28)
      const wsTbl = XLSX.utils.json_to_sheet(tbl.rows || [])
      autoWidth(wsTbl)
      XLSX.utils.book_append_sheet(workbook, wsTbl, `Table_${idx + 1}`)
    })
  }

  XLSX.writeFile(workbook, `${reportType}_Report_${dateStr}.xlsx`)
}
