/** Invoice line grid — Account / Analytic visibility from sales invoice settings. */

export function resolveInvoiceLineColumnSettings(settings) {
  return {
    showAccount: settings?.invoiceShowAccountColumn !== false,
    showAnalytic: settings?.invoiceShowAnalyticColumn !== false,
  }
}

/** Sell invoice lines grid (12 columns). */
export function sellLineProductColSpan({ showAccount = true, showAnalytic = true } = {}) {
  let span = 3
  if (!showAccount) span += 2
  if (!showAnalytic) span += 2
  return span
}

export const SELL_PRODUCT_COL_CLASS = {
  3: 'lg:col-span-3',
  5: 'lg:col-span-5',
  7: 'lg:col-span-7',
}

/** Purchase bill lines grid (14 columns). */
export function purchaseLineProductColSpan({ showAccount = true, showAnalytic = true } = {}) {
  let span = 3
  if (!showAccount) span += 2
  if (!showAnalytic) span += 2
  return span
}

export const PURCHASE_PRODUCT_COL_CLASS = {
  3: 'lg:col-span-3',
  5: 'lg:col-span-5',
  7: 'lg:col-span-7',
}
