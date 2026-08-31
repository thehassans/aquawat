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

/** Download SEPA XML for selected vendor bill ids. */
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
}

export default { printVendorCheck, downloadSepaBatch }
