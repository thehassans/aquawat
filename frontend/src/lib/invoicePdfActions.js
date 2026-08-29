/**
 * Lazy facade for invoicePdf — avoids loading react-dom/server + preview components
 * on list pages until the user actually prints or downloads a PDF.
 */

const load = () => import('./invoicePdf')

export async function downloadInvoicePdf(...args) {
  const { downloadInvoicePdf: fn } = await load()
  return fn(...args)
}

export async function buildInvoicePdfBlob(...args) {
  const { buildInvoicePdfBlob: fn } = await load()
  return fn(...args)
}

export async function downloadQuotationPdf(...args) {
  const { downloadQuotationPdf: fn } = await load()
  return fn(...args)
}

export async function printQuotationSnapshot(...args) {
  const { printQuotationSnapshot: fn } = await load()
  return fn(...args)
}

export async function downloadSalesOrderPdf(...args) {
  const { downloadSalesOrderPdf: fn } = await load()
  return fn(...args)
}

export async function buildSalesOrderPdfBlob(...args) {
  const { buildSalesOrderPdfBlob: fn } = await load()
  return fn(...args)
}

export async function printSalesOrderPdf(...args) {
  const { printSalesOrderPdf: fn } = await load()
  return fn(...args)
}

export async function downloadPurchaseOrderPdf(...args) {
  const { downloadPurchaseOrderPdf: fn } = await load()
  return fn(...args)
}

export async function printPurchaseOrderPdf(...args) {
  const { printPurchaseOrderPdf: fn } = await load()
  return fn(...args)
}

export async function downloadVendorBillPdf(...args) {
  const { downloadVendorBillPdf: fn } = await load()
  return fn(...args)
}

export async function printVendorBillPdf(...args) {
  const { printVendorBillPdf: fn } = await load()
  return fn(...args)
}
