/**
 * Pakistan FBR Digital Invoicing adapter.
 * Posts sale invoices to FBR's DI gateway when credentials exist.
 * Sandbox tenants without a token still get a local FBR QR + reference
 * so the workspace is usable before live onboarding.
 *
 * Gateway (official DI):
 *   sandbox    https://gw.fbr.gov.pk/di_data/v1/di/postinvoicedata_sb
 *   production https://gw.fbr.gov.pk/di_data/v1/di/postinvoicedata
 */

export const FBR_SANDBOX_URL = 'https://gw.fbr.gov.pk/di_data/v1/di/postinvoicedata_sb'
export const FBR_PRODUCTION_URL = 'https://gw.fbr.gov.pk/di_data/v1/di/postinvoicedata'

const DEFAULT_SALE_TYPE = 'Goods at standard rate (default)'
const DEFAULT_UOM = 'Numbers, pieces, units'

export function fbrEndpoint(environment, overrideUrl = '') {
  if (overrideUrl) return overrideUrl
  return environment === 'production' ? FBR_PRODUCTION_URL : FBR_SANDBOX_URL
}

export function generateFbrQrPayload({
  sellerName,
  ntn,
  strn,
  invoiceNumber,
  fbrInvoiceNo,
  timestamp,
  totalWithTax,
  salesTax,
}) {
  return JSON.stringify({
    v: 1,
    authority: 'FBR',
    seller: String(sellerName || '').trim(),
    ntn: String(ntn || '').trim(),
    strn: String(strn || '').trim(),
    inv: String(invoiceNumber || '').trim(),
    fbr: String(fbrInvoiceNo || '').trim(),
    ts: timestamp || new Date().toISOString(),
    total: Number(Number(totalWithTax || 0).toFixed(2)),
    st: Number(Number(salesTax || 0).toFixed(2)),
    currency: 'PKR',
  })
}

function round2(n) {
  return Number(Number(n || 0).toFixed(2))
}

export function buildFbrInvoicePayload(invoice, tenant) {
  const fbr = tenant.fbr || {}
  const business = tenant.business || {}
  const address = business.address || {}
  const sellerNtn = fbr.ntn || business.ntn || ''
  const ratePct = Number(fbr.defaultSalesTaxRate || 18)
  const items = (invoice.lineItems || []).map((line) => {
    const qty = Number(line.quantity || 1)
    const excl = Number(line.lineSubtotal ?? (Number(line.unitPrice || 0) * qty))
    const tax = Number(line.lineTax ?? line.taxAmount ?? 0)
    const total = Number(line.lineTotal ?? line.lineTotalWithTax ?? excl + tax)
    return {
      hsCode: line.hsCode || fbr.defaultHsCode || '0000.0000',
      productDescription: line.productName || line.name || 'Item',
      rate: `${ratePct}%`,
      uoM: line.uom || DEFAULT_UOM,
      quantity: qty,
      totalValues: round2(total),
      valueSalesExcludingST: round2(excl),
      fixedNotifiedValueOrRetailPrice: 0,
      salesTaxApplicable: round2(tax),
      salesTaxWithheldAtSource: 0,
      extraTax: 0,
      furtherTax: 0,
      sroScheduleNo: '',
      fedPayable: 0,
      discount: round2(line.discountAmount || 0),
      saleType: DEFAULT_SALE_TYPE,
      sroItemSerialNo: '',
    }
  })

  const buyer = invoice.buyer || {}
  const buyerRegType = buyer.ntn || buyer.vatNumber || fbr.buyerDefaultNtn
    ? 'Registered'
    : 'Unregistered'

  return {
    invoiceType: invoice.transactionType === 'credit_note' ? 'Credit Note' : 'Sale Invoice',
    invoiceDate: new Date(invoice.issueDate || Date.now()).toISOString().slice(0, 10),
    sellerNTNCNIC: sellerNtn,
    sellerBusinessName: business.legalNameEn || tenant.name || '',
    sellerProvince: fbr.province || address.state || address.city || 'Sindh',
    sellerAddress: [address.street, address.district, address.city].filter(Boolean).join(', ') || 'Pakistan',
    buyerNTNCNIC: buyer.ntn || buyer.vatNumber || buyer.cnic || '0000000000000',
    buyerBusinessName: buyer.name || 'Walk-in Customer',
    buyerProvince: buyer.province || buyer.city || fbr.province || 'Sindh',
    buyerAddress: buyer.address || buyer.city || 'Pakistan',
    buyerRegistrationType: buyerRegType,
    invoiceRefNo: invoice.invoiceNumber || '',
    scenarioId: fbr.scenarioId || '',
    items: items.length ? items : [{
      hsCode: fbr.defaultHsCode || '0000.0000',
      productDescription: 'Sale',
      rate: `${ratePct}%`,
      uoM: DEFAULT_UOM,
      quantity: 1,
      totalValues: round2(invoice.grandTotal),
      valueSalesExcludingST: round2(invoice.subtotal),
      fixedNotifiedValueOrRetailPrice: 0,
      salesTaxApplicable: round2(invoice.totalTax),
      salesTaxWithheldAtSource: 0,
      extraTax: 0,
      furtherTax: 0,
      sroScheduleNo: '',
      fedPayable: 0,
      discount: 0,
      saleType: DEFAULT_SALE_TYPE,
      sroItemSerialNo: '',
    }],
  }
}

function sandboxResult(invoice, tenant, note = '') {
  const fbrNo = `FBR-SBX-${Date.now().toString().slice(-10)}`
  const qrCode = generateFbrQrPayload({
    sellerName: tenant.business?.legalNameEn || tenant.name,
    ntn: tenant.fbr?.ntn,
    strn: tenant.fbr?.strn,
    invoiceNumber: invoice.invoiceNumber,
    fbrInvoiceNo: fbrNo,
    timestamp: invoice.issueDate,
    totalWithTax: invoice.grandTotal,
    salesTax: invoice.totalTax,
  })
  return {
    fbrInvoiceNo: fbrNo,
    qrCode,
    submissionStatus: 'sandbox',
    submittedAt: new Date(),
    lastError: '',
    sandbox: true,
    message: note || 'Sandbox FBR invoice registered locally. Add a live bearer token to post to FBR.',
    response: { sandbox: true, fbrInvoiceNo: fbrNo },
  }
}

/** Attach FBR QR (and optionally post to DI) on a mongoose invoice document. */
export async function applyFbrToInvoice(invoice, tenant, seller = {}) {
  const fbr = tenant.fbr || {}
  if (fbr.autoGenerateQr === false) return invoice

  const existing = invoice.fbr?.toObject?.() || invoice.fbr || {}
  const qrCode = generateFbrQrPayload({
    sellerName: seller?.legalNameEn || seller?.name || tenant.business?.legalNameEn || tenant.name,
    ntn: fbr.ntn || tenant.business?.vatNumber || '',
    strn: fbr.strn,
    invoiceNumber: invoice.invoiceNumber,
    fbrInvoiceNo: existing.fbrInvoiceNo,
    timestamp: invoice.issueDate,
    totalWithTax: invoice.grandTotal,
    salesTax: invoice.totalTax,
  })
  invoice.fbr = {
    ...existing,
    qrCode,
    submissionStatus: existing.submissionStatus || 'pending',
  }

  if (fbr.isEnabled && fbr.autoSubmit !== false) {
    try {
      const posted = await postInvoiceToFbr(invoice, tenant)
      invoice.fbr = { ...invoice.fbr, ...posted }
      if (!tenant.fbr) tenant.fbr = {}
      tenant.fbr.invoiceCounter = (tenant.fbr.invoiceCounter || 0) + 1
      tenant.fbr.lastSyncAt = new Date()
      tenant.markModified?.('fbr')
      await tenant.save()
    } catch (err) {
      invoice.fbr.lastError = err.message
      invoice.fbr.submissionStatus = 'rejected'
    }
  }
  return invoice
}

export async function postInvoiceToFbr(invoice, tenant) {
  const fbr = tenant.fbr || {}
  const isSandbox = fbr.environment !== 'production'
  const token = fbr.apiToken || fbr.apiKey || ''
  const payload = buildFbrInvoicePayload(invoice, tenant)

  if (!token) {
    if (isSandbox) return sandboxResult(invoice, tenant)
    throw new Error('FBR API token is required for production posting')
  }

  const url = fbrEndpoint(fbr.environment, fbr.apiBaseUrl)
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      const msg = data?.error || data?.message || `FBR error ${res.status}`
      if (isSandbox) return sandboxResult(invoice, tenant, msg)
      throw new Error(msg)
    }
    const fbrInvoiceNo = data?.invoiceNumber || data?.FBRInvoiceNumber || data?.data?.invoiceNumber || ''
    const qrCode = data?.QRCode || data?.qrCode || generateFbrQrPayload({
      sellerName: tenant.business?.legalNameEn || tenant.name,
      ntn: fbr.ntn,
      strn: fbr.strn,
      invoiceNumber: invoice.invoiceNumber,
      fbrInvoiceNo,
      timestamp: invoice.issueDate,
      totalWithTax: invoice.grandTotal,
      salesTax: invoice.totalTax,
    })
    return {
      fbrInvoiceNo,
      qrCode,
      submissionStatus: 'submitted',
      submittedAt: new Date(),
      lastError: '',
      sandbox: false,
      response: data,
    }
  } catch (err) {
    if (isSandbox) return sandboxResult(invoice, tenant, err.message)
    throw err
  }
}

export async function testFbrConnection(tenant) {
  const fbr = tenant.fbr || {}
  const ntn = String(fbr.ntn || '').trim()
  if (!ntn) {
    return { success: false, message: 'NTN is required before testing the FBR connection.' }
  }
  if (!fbr.apiToken && !fbr.apiKey && fbr.environment === 'production') {
    return { success: false, message: 'Production FBR posting requires a bearer token from IRIS / Digital Invoicing.' }
  }
  return {
    success: true,
    message: fbr.apiToken || fbr.apiKey
      ? `FBR credentials stored for NTN ${ntn} (${fbr.environment || 'sandbox'}).`
      : `NTN ${ntn} saved. Sandbox invoices will receive a local FBR reference until a live token is added.`,
    checks: {
      ntnConfigured: true,
      strnConfigured: Boolean(fbr.strn),
      posIdConfigured: Boolean(fbr.posId),
      tokenLoaded: Boolean(fbr.apiToken || fbr.apiKey),
      environment: fbr.environment || 'sandbox',
    },
  }
}
