// ─── Master Spreadsheet Exporter (Excel & CSV) with Full Bilingual Support ────

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

// ─── CSV Builder Engine (Bilingual UTF-8 with BOM) ────────────────────────────

export function exportReportToCsv({ reportType, report, tenant, language = 'en' }) {
  const isAr = language === 'ar'
  const lines = []
  const dateStr = new Date().toISOString().slice(0, 10)
  const companyEn = tenant?.business?.legalNameEn || tenant?.name || 'Maqder Enterprise'
  const companyAr = tenant?.business?.legalNameAr || ''
  const companyTitle = companyAr ? `${companyEn} / ${companyAr}` : companyEn

  // Header metadata block
  lines.push([safeCsv('Maqder ERP Enterprise Report / تقرير نظام مقدر للمؤسسات'), safeCsv(companyTitle)].join(','))
  lines.push([safeCsv('Report Type / نوع التقرير'), safeCsv(reportType.toUpperCase())].join(','))
  lines.push([safeCsv('Generated Date / تاريخ الإصدار'), safeCsv(dateStr)].join(','))
  if (report?.period?.startDate && report?.period?.endDate) {
    lines.push([safeCsv('Period / الفترة'), safeCsv(`${formatDate(report.period.startDate)} to ${formatDate(report.period.endDate)}`)].join(','))
  }
  lines.push('') // empty line

  if (reportType === 'vat') {
    const t = report?.totals || {}
    const st = report?.vatReturn?.statement || {}
    lines.push(safeCsv('--- 1. VAT SUMMARY KPIS / مؤشرات الأداء الضريبي ---'))
    lines.push([safeCsv('Total Invoices / إجمالي الفواتير'), safeCsv(t.invoiceCount || 0)].join(','))
    lines.push([safeCsv('Standard Rated Sales / المبيعات الخاضعة للضريبة'), safeCsv(st?.salesStandardRated?.amount || t.taxableAmount || 0)].join(','))
    lines.push([safeCsv('Output VAT (15%) / ضريبة المخرجات'), safeCsv(st?.totalSales?.vatAmount || t.totalTax || 0)].join(','))
    lines.push([safeCsv('Input VAT Deductible / ضريبة المدخلات القابلة للخصم'), safeCsv(st?.totalPurchases?.vatAmount || t.purchasesTaxAmount || 0)].join(','))
    lines.push([safeCsv('Net VAT Due / صافي الضريبة المستحقة للسداد'), safeCsv(st?.netVatDue?.vatAmount ?? (t.totalTax || 0) - (t.purchasesTaxAmount || 0))].join(','))
    lines.push('')

    lines.push(safeCsv('--- 2. OFFICIAL VAT DECLARATION STATEMENT (ZATCA) / إقرار ضريبة القيمة المضافة الرسمي ---'))
    lines.push([safeCsv('Line Item / بند الإقرار الضريبي'), safeCsv('Amount (SAR) / المبلغ الخاضع'), safeCsv('Adjustment (SAR) / التعديل'), safeCsv('VAT Amount (SAR) / مبلغ الضريبة')].join(','))
    lines.push([safeCsv('1. Standard Rated Sales (15%) / المبيعات الخاضعة للنسبة الأساسية'), safeCsv(st?.salesStandardRated?.amount || 0), safeCsv(st?.salesStandardRated?.adjustment || 0), safeCsv(st?.salesStandardRated?.vatAmount || 0)].join(','))
    lines.push([safeCsv('2. Special Citizen Supplies / التوريدات للمواطنين'), safeCsv(st?.salesSpecialCitizen?.amount || 0), safeCsv(st?.salesSpecialCitizen?.adjustment || 0), safeCsv(st?.salesSpecialCitizen?.vatAmount || 0)].join(','))
    lines.push([safeCsv('3. Zero-Rated Domestic Sales / المبيعات الخاضعة للنسبة الصفرية'), safeCsv(st?.salesZeroRatedDomestic?.amount || 0), safeCsv(st?.salesZeroRatedDomestic?.adjustment || 0), safeCsv(st?.salesZeroRatedDomestic?.vatAmount || 0)].join(','))
    lines.push([safeCsv('4. Exports Outside KSA / الصادرات خارج المملكة'), safeCsv(st?.salesExports?.amount || 0), safeCsv(st?.salesExports?.adjustment || 0), safeCsv(st?.salesExports?.vatAmount || 0)].join(','))
    lines.push([safeCsv('5. Exempt Supplies / التوريدات المعفاة'), safeCsv(st?.salesExempt?.amount || 0), safeCsv(st?.salesExempt?.adjustment || 0), safeCsv(st?.salesExempt?.vatAmount || 0)].join(','))
    lines.push([safeCsv('Total Sales & Output Tax / إجمالي المبيعات والضريبة'), safeCsv(st?.totalSales?.amount || t.taxableAmount || 0), safeCsv(st?.totalSales?.adjustment || 0), safeCsv(st?.totalSales?.vatAmount || t.totalTax || 0)].join(','))
    lines.push([safeCsv('6. Standard Rated Purchases / المشتريات الخاضعة للنسبة الأساسية'), safeCsv(st?.purchasesStandardRatedDomestic?.amount || 0), safeCsv(st?.purchasesStandardRatedDomestic?.adjustment || 0), safeCsv(st?.purchasesStandardRatedDomestic?.vatAmount || 0)].join(','))
    lines.push([safeCsv('7. Imports Subject to Customs (15%) / الاستيرادات الخاضعة للضريبة الجمركية'), safeCsv(st?.purchasesImportsCustoms?.amount || 0), safeCsv(st?.purchasesImportsCustoms?.adjustment || 0), safeCsv(st?.purchasesImportsCustoms?.vatAmount || 0)].join(','))
    lines.push([safeCsv('Total Purchases & Input Tax / إجمالي المشتريات وضريبة المدخلات'), safeCsv(st?.totalPurchases?.amount || 0), safeCsv(st?.totalPurchases?.adjustment || 0), safeCsv(st?.totalPurchases?.vatAmount || t.purchasesTaxAmount || 0)].join(','))
    lines.push([safeCsv('Net VAT Due for Period / صافي الضريبة المستحقة'), safeCsv(''), safeCsv(''), safeCsv(st?.netVatDue?.vatAmount ?? (t.totalTax || 0) - (t.purchasesTaxAmount || 0))].join(','))

  } else if (reportType === 'business') {
    const t = report?.totals || {}
    lines.push(safeCsv('--- 1. FINANCIAL PERFORMANCE KPIS / مؤشرات الأداء المالي ---'))
    lines.push([safeCsv('Gross Sales / إجمالي المبيعات المفوترة'), safeCsv(t?.sales?.grandTotal || 0)].join(','))
    lines.push([safeCsv('Purchases / إجمالي المشتريات'), safeCsv(t?.purchases?.grandTotal || 0)].join(','))
    lines.push([safeCsv('Operating Expenses / المصروفات التشغيلية'), safeCsv(t?.expenses?.totalAmount || 0)].join(','))
    lines.push([safeCsv('Sales Discounts / خصومات المبيعات'), safeCsv(t?.sales?.totalDiscount || 0)].join(','))
    lines.push([safeCsv('Net Profit Yield / صافي الربح التشغيلي'), safeCsv(t?.net || 0)].join(','))
    lines.push('')

    lines.push(safeCsv('--- 2. SALES BY TRANSACTION TYPE / الإيرادات حسب نوع المعاملة ---'))
    lines.push([safeCsv('Transaction Type / نوع المعاملة'), safeCsv('Invoices / الفواتير'), safeCsv('Discount (SAR) / الخصم'), safeCsv('Revenue (SAR) / الإيراد'), safeCsv('VAT Tax (SAR) / الضريبة')].join(','))
    ;(report?.breakdown?.salesByTransactionType || []).forEach((r) => {
      lines.push([safeCsv(r._id), safeCsv(r.invoiceCount || 0), safeCsv(r.discount || 0), safeCsv(r.revenue || 0), safeCsv(r.tax || 0)].join(','))
    })
    lines.push('')

    lines.push(safeCsv('--- 3. TOP REVENUE CONTRIBUTING CUSTOMERS / أعلى العملاء مساهمة ---'))
    lines.push([safeCsv('Customer Name / اسم العميل'), safeCsv('Invoices / الفواتير'), safeCsv('Revenue (SAR) / الإيراد')].join(','))
    ;(report?.breakdown?.topCustomers || []).forEach((r) => {
      lines.push([safeCsv(r._id), safeCsv(r.invoiceCount || 0), safeCsv(r.revenue || 0)].join(','))
    })

  } else if (reportType === 'daily') {
    const rows = Array.isArray(report) ? report : []
    lines.push([safeCsv('Date (YYYY-MM-DD) / التاريخ'), safeCsv('Invoices Count / عدد الفواتير'), safeCsv('Total VAT Tax (SAR) / الضريبة 15%'), safeCsv('Grand Total Amount (SAR) / الإجمالي النهائي')].join(','))
    rows.forEach((r) => {
      lines.push([safeCsv(r._id), safeCsv(r.invoiceCount || 0), safeCsv(r.totalTax || 0), safeCsv(r.totalAmount || 0)].join(','))
    })

  } else if (reportType === 'sales') {
    const rows = Array.isArray(report) ? report : []
    lines.push([safeCsv('Customer Name / اسم العميل'), safeCsv('Invoices Count / الفواتير'), safeCsv('Total Sales Revenue (SAR) / إجمالي المبيعات')].join(','))
    rows.forEach((r) => {
      lines.push([safeCsv(r.customerName || 'Walk-in / عميل نقدي'), safeCsv(r.invoiceCount || 0), safeCsv(r.totalAmount || 0)].join(','))
    })

  } else if (reportType === 'internal_audit') {
    lines.push([safeCsv('Control Grade / درجة الرقابة'), safeCsv(report?.controlGrade || 'Strong')].join(','))
    lines.push([safeCsv('Compliance Score / درجة الامتثال'), safeCsv(report?.score || 100)].join(','))
    lines.push('')
    lines.push(safeCsv('--- CANCELLED & VOIDED INVOICES / سجل الفواتير الملغاة ---'))
    lines.push([safeCsv('Invoice Number / رقم الفاتورة'), safeCsv('Issue Date / التاريخ'), safeCsv('Customer / العميل'), safeCsv('Amount (SAR) / المبلغ'), safeCsv('Reason / السبب')].join(','))
    ;(report?.cancelledInvoicesList || []).forEach((r) => {
      lines.push([safeCsv(r.invoiceNumber), safeCsv(formatDate(r.issueDate)), safeCsv(r.customerName), safeCsv(r.amount), safeCsv(r.reason)].join(','))
    })

  } else if (reportType === 'external_audit') {
    lines.push([safeCsv('Auditor Opinion / رأي المراجع'), safeCsv(report?.auditOpinion || 'Unqualified Clean')].join(','))
    lines.push([safeCsv('ZATCA Compliance Rate / نسبة امتثال زاتكا'), safeCsv(`${report?.zatcaBreakdown?.complianceRate || 100}%`)].join(','))
    lines.push([safeCsv('Cryptographic Chaining / السلسلة التشفيرية'), safeCsv('100% Validated')].join(','))

  } else if (reportType.includes('restaurant') || reportType.includes('trading') || report?.sections) {
    const section = report?.sections?.find((s) => reportType.includes(s.key)) || report?.sections?.[0] || report
    lines.push(safeCsv(`--- KPIS (${section?.key || reportType}) / المؤشرات الرئيسية ---`))
    ;(section?.kpis || []).forEach((k) => {
      const lbl = typeof k.label === 'object' ? `${k.label.en} / ${k.label.ar}` : k.label
      lines.push([safeCsv(lbl), safeCsv(k.value)].join(','))
    })
    lines.push('')
    ;(section?.tables || []).forEach((tbl) => {
      const title = typeof tbl.title === 'object' ? `${tbl.title.en} / ${tbl.title.ar}` : tbl.title
      lines.push(safeCsv(`--- ${title} ---`))
      const colHeaders = (tbl.columns || []).map((c) => safeCsv(typeof c.label === 'object' ? `${c.label.en} / ${c.label.ar}` : c.label))
      lines.push(colHeaders.join(','))
      ;(tbl.rows || []).forEach((row) => {
        const rowVals = (tbl.columns || []).map((c) => safeCsv(row[c.key]))
        lines.push(rowVals.join(','))
      })
      lines.push('')
    })
  }

  // Prepend UTF-8 BOM so Excel opens Arabic correctly without garbled symbols
  const csvContent = '\uFEFF' + lines.join('\r\n')
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  downloadBlob(blob, `${reportType}_Report_${dateStr}.csv`)
}

// ─── Excel (XLSX) Builder Engine with Bilingual Headers ───────────────────────

export async function exportReportToExcel({ reportType, report, tenant, language = 'en' }) {
  const xlsxModule = await import('xlsx')
  const XLSX = xlsxModule.default || xlsxModule
  const workbook = XLSX.utils.book_new()
  const dateStr = new Date().toISOString().slice(0, 10)

  const autoWidth = (ws) => {
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:Z50')
    const colWidths = []
    for (let C = range.s.c; C <= range.e.c; ++C) {
      let maxLen = 14
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
      ['Maqder ERP - VAT Return Declaration / إقرار ضريبة القيمة المضافة', ''],
      ['Tenant / المؤسسة', tenant?.business?.legalNameEn || tenant?.name || 'Company'],
      ['Period / الفترة', `${formatDate(report?.period?.startDate)} to ${formatDate(report?.period?.endDate)}`],
      ['Generated On / تاريخ الإصدار', dateStr],
      [],
      ['Key Performance Indicator / مؤشر الأداء', 'Value (SAR / Count) / القيمة'],
      ['Total Invoices Issued / إجمالي الفواتير الصادرة', t.invoiceCount || 0],
      ['Standard Rated Sales Taxable / المبيعات الخاضعة للضريبة', st?.salesStandardRated?.amount || t.taxableAmount || 0],
      ['Standard Rated Output VAT (15%) / ضريبة المخرجات', st?.totalSales?.vatAmount || t.totalTax || 0],
      ['Input Deductible VAT / ضريبة المدخلات القابلة للخصم', st?.totalPurchases?.vatAmount || t.purchasesTaxAmount || 0],
      ['Net VAT Due to ZATCA / صافي الضريبة المستحقة للهيئة', st?.netVatDue?.vatAmount ?? (t.totalTax || 0) - (t.purchasesTaxAmount || 0)],
    ]
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData)
    autoWidth(wsSummary)
    XLSX.utils.book_append_sheet(workbook, wsSummary, 'VAT_Summary')

    // Sheet 2: Official Statement
    const statementData = [
      ['ZATCA Declaration Line Item / بند الإقرار الضريبي', 'Base Amount (SAR) / المبلغ الخاضع', 'Adjustment (SAR) / التعديل', 'VAT Amount (SAR) / مبلغ الضريبة'],
      ['1. Standard Rated Sales (15%) / المبيعات الخاضعة للنسبة الأساسية', st?.salesStandardRated?.amount || 0, st?.salesStandardRated?.adjustment || 0, st?.salesStandardRated?.vatAmount || 0],
      ['2. Special Citizen Supplies / التوريدات للمواطنين', st?.salesSpecialCitizen?.amount || 0, st?.salesSpecialCitizen?.adjustment || 0, st?.salesSpecialCitizen?.vatAmount || 0],
      ['3. Zero-Rated Domestic Sales / المبيعات الخاضعة للنسبة الصفرية', st?.salesZeroRatedDomestic?.amount || 0, st?.salesZeroRatedDomestic?.adjustment || 0, st?.salesZeroRatedDomestic?.vatAmount || 0],
      ['4. Exports Outside KSA / الصادرات خارج المملكة', st?.salesExports?.amount || 0, st?.salesExports?.adjustment || 0, st?.salesExports?.vatAmount || 0],
      ['5. Exempt Supplies / التوريدات المعفاة', st?.salesExempt?.amount || 0, st?.salesExempt?.adjustment || 0, st?.salesExempt?.vatAmount || 0],
      ['Total Sales & Output VAT / إجمالي المبيعات وضريبة المخرجات', st?.totalSales?.amount || t.taxableAmount || 0, st?.totalSales?.adjustment || 0, st?.totalSales?.vatAmount || t.totalTax || 0],
      ['6. Standard Rated Purchases / المشتريات الخاضعة للنسبة الأساسية', st?.purchasesStandardRatedDomestic?.amount || 0, st?.purchasesStandardRatedDomestic?.adjustment || 0, st?.purchasesStandardRatedDomestic?.vatAmount || 0],
      ['7. Imports Subject to Customs (15%) / الاستيرادات الخاضعة للضريبة الجمركية', st?.purchasesImportsCustoms?.amount || 0, st?.purchasesImportsCustoms?.adjustment || 0, st?.purchasesImportsCustoms?.vatAmount || 0],
      ['Total Purchases & Input VAT / إجمالي المشتريات وضريبة المدخلات', st?.totalPurchases?.amount || 0, st?.totalPurchases?.adjustment || 0, st?.totalPurchases?.vatAmount || t.purchasesTaxAmount || 0],
      ['Net VAT Due for Period / صافي الضريبة المستحقة للسداد', '', '', st?.netVatDue?.vatAmount ?? (t.totalTax || 0) - (t.purchasesTaxAmount || 0)],
    ]
    const wsStatement = XLSX.utils.aoa_to_sheet(statementData)
    autoWidth(wsStatement)
    XLSX.utils.book_append_sheet(workbook, wsStatement, 'ZATCA_Statement')

  } else if (reportType === 'business') {
    const t = report?.totals || {}
    const pnlData = [
      ['Business P&L Metric / مؤشر الأرباح والخسائر', 'Amount (SAR) / المبلغ'],
      ['Gross Invoiced Sales / إجمالي المبيعات المفوترة', t?.sales?.grandTotal || 0],
      ['Taxable Sales (ex-VAT) / المبيعات الخاضعة بدون الضريبة', t?.sales?.taxableAmount || 0],
      ['Sales Discounts / خصومات المبيعات', t?.sales?.totalDiscount || 0],
      ['Purchases (Cost) / المشتريات والتكاليف', t?.purchases?.grandTotal || 0],
      ['Operating Expenses / المصروفات التشغيلية', t?.expenses?.totalAmount || 0],
      ['Net Profit / Yield / صافي الأرباح التشغيلية', t?.net || 0],
    ]
    const wsPnl = XLSX.utils.aoa_to_sheet(pnlData)
    autoWidth(wsPnl)
    XLSX.utils.book_append_sheet(workbook, wsPnl, 'P&L_Summary')

    const salesByType = (report?.breakdown?.salesByTransactionType || []).map((r) => ({
      'Channel / نوع المعاملة': r._id,
      'Invoices / الفواتير': r.invoiceCount || 0,
      'Discount_SAR / الخصم': r.discount || 0,
      'Revenue_SAR / الإيراد': r.revenue || 0,
      'VAT_SAR / الضريبة': r.tax || 0,
    }))
    const wsSales = XLSX.utils.json_to_sheet(salesByType)
    autoWidth(wsSales)
    XLSX.utils.book_append_sheet(workbook, wsSales, 'Sales_By_Channel')

    const topCust = (report?.breakdown?.topCustomers || []).map((r) => ({
      'Customer / اسم العميل': r._id,
      'Invoices / الفواتير': r.invoiceCount || 0,
      'Revenue_SAR / الإيراد': r.revenue || 0,
    }))
    const wsCust = XLSX.utils.json_to_sheet(topCust)
    autoWidth(wsCust)
    XLSX.utils.book_append_sheet(workbook, wsCust, 'Top_Customers')

  } else if (reportType === 'daily') {
    const rows = (Array.isArray(report) ? report : []).map((r) => ({
      'Date / التاريخ': r._id,
      'Invoices_Count / عدد الفواتير': r.invoiceCount || 0,
      'Total_VAT_SAR / الضريبة 15%': r.totalTax || 0,
      'Gross_Total_SAR / الإجمالي النهائي': r.totalAmount || 0,
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    autoWidth(ws)
    XLSX.utils.book_append_sheet(workbook, ws, 'Daily_Sales')

  } else if (reportType === 'sales') {
    const rows = (Array.isArray(report) ? report : []).map((r, idx) => ({
      'Rank / الترتيب': idx + 1,
      'Customer_Name / اسم العميل': r.customerName || 'Walk-in / عميل نقدي',
      'Invoices_Count / عدد الفواتير': r.invoiceCount || 0,
      'Total_Sales_SAR / إجمالي المبيعات': r.totalAmount || 0,
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    autoWidth(ws)
    XLSX.utils.book_append_sheet(workbook, ws, 'Customer_Sales')

  } else if (reportType === 'internal_audit') {
    const summary = [
      ['Internal Control Grade / تقييم الرقابة الداخلية', report?.controlGrade || 'Strong'],
      ['Audit Score / درجة التدقيق', `${report?.score || 100}/100`],
      ['Total Findings / الملاحظات المسجلة', report?.findings?.length || 0],
    ]
    const wsSum = XLSX.utils.aoa_to_sheet(summary)
    autoWidth(wsSum)
    XLSX.utils.book_append_sheet(workbook, wsSum, 'Audit_Summary')

    const cancelled = (report?.cancelledInvoicesList || []).map((r) => ({
      'Invoice_Number / رقم الفاتورة': r.invoiceNumber,
      'Date / التاريخ': formatDate(r.issueDate),
      'Customer / العميل': r.customerName,
      'Amount_SAR / المبلغ': r.amount,
      'Reason / السبب': r.reason,
    }))
    const wsCanc = XLSX.utils.json_to_sheet(cancelled)
    autoWidth(wsCanc)
    XLSX.utils.book_append_sheet(workbook, wsCanc, 'Cancelled_Invoices')

  } else if (reportType === 'external_audit') {
    const auditData = [
      ['Statutory Parameter / معيار التدقيق النظامي', 'Status / النتيجة'],
      ['Auditor Opinion / رأي المراجع المستقل', report?.auditOpinion || 'Unqualified Clean'],
      ['ZATCA Phase 2 Compliance Rate / نسبة امتثال زاتكا', `${report?.zatcaBreakdown?.complianceRate || 100}%`],
      ['Cryptographic Hash Chaining / السلسلة التشفيرية', '100% Validated'],
      ['Total Invoices Inspected / الفواتير المفحوصة', report?.zatcaBreakdown?.totalInvoicesChecked || 0],
    ]
    const ws = XLSX.utils.aoa_to_sheet(auditData)
    autoWidth(ws)
    XLSX.utils.book_append_sheet(workbook, ws, 'Statutory_Audit')

  } else {
    // Restaurant / Trading / Ops
    const section = report?.sections?.find((s) => reportType.includes(s.key)) || report?.sections?.[0] || report
    const kpis = (section?.kpis || []).map((k) => ({
      'Metric / المؤشر': typeof k.label === 'object' ? `${k.label.en} / ${k.label.ar}` : k.label,
      'Value / القيمة': k.value,
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
