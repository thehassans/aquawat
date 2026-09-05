import api from './api'

/** Open printable check HTML in a new window. */
export async function printVendorCheck({
  payeeName,
  amount,
  currency = 'SAR',
  memo = '',
  checkNumber = '',
  paymentDate,
}) {
  const htmlRes = await api.post('/invoices/purchase/check-print', {
    payeeName,
    amount,
    currency,
    memo,
    checkNumber,
    paymentDate,
    format: 'html',
  }, { responseType: 'text' })

  const win = window.open('', '_blank', 'width=900,height=700')
  if (!win) throw new Error('Pop-up blocked — allow pop-ups to print checks')
  win.document.write(htmlRes.data)
  win.document.close()
  win.focus()
}

/** Download SEPA XML for selected vendor bill ids. Returns stamped invoice ids. */
export async function downloadSepaBatch(invoiceIds = [], executionDate) {
  const res = await api.post('/invoices/purchase/batch-sepa-export', {
    invoiceIds,
    executionDate,
  }, { responseType: 'blob' })

  const blob = new Blob([res.data], { type: 'application/xml' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `sepa-vendor-payments-${new Date().toISOString().slice(0, 10)}.xml`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)

  let stampedIds = invoiceIds
  try {
    const header = res.headers?.['x-sepa-invoice-ids']
    if (header) stampedIds = JSON.parse(header)
  } catch {
    /* keep request ids */
  }
  return { invoiceIds: stampedIds }
}

/** Confirm that the SEPA file was uploaded to the bank portal. */
export async function markSepaUploaded(invoiceIds = []) {
  const res = await api.post('/invoices/purchase/batch-sepa-mark-uploaded', { invoiceIds })
  return res.data
}

/** Create a draft payment batch from vendor bill ids. */
export async function createPaymentBatch(invoiceIds = [], { executionDate, notes } = {}) {
  const res = await api.post('/accounting/payment-batches', {
    invoiceIds,
    executionDate,
    notes,
    format: 'csv',
  })
  return res.data
}

/** Export payment batch as CSV and download. Marks batch exported. */
export async function downloadPaymentBatchCsv(batchId) {
  const res = await api.post(`/accounting/payment-batches/${batchId}/export`, {}, { responseType: 'blob' })
  const filename = (() => {
    const cd = res.headers?.['content-disposition'] || ''
    const m = cd.match(/filename="?([^";]+)"?/i)
    return m?.[1] || `payment-batch-${batchId}.csv`
  })()
  const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
  return { filename, batchId }
}

/** Create batch from bills then immediately download CSV. */
export async function createAndExportPaymentBatchCsv(invoiceIds = [], options = {}) {
  const batch = await createPaymentBatch(invoiceIds, options)
  const download = await downloadPaymentBatchCsv(batch._id)
  return { batch, ...download }
}

export async function confirmPaymentBatch(batchId) {
  const res = await api.post(`/accounting/payment-batches/${batchId}/confirm`)
  return res.data
}

export async function listPaymentBatches(params = {}) {
  const res = await api.get('/accounting/payment-batches', { params })
  return res.data
}

export default {
  printVendorCheck,
  downloadSepaBatch,
  markSepaUploaded,
  createPaymentBatch,
  downloadPaymentBatchCsv,
  createAndExportPaymentBatchCsv,
  confirmPaymentBatch,
  listPaymentBatches,
}
