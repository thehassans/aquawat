import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { QRCodeSVG } from 'qrcode.react'
import InvoiceLivePreview from '../components/invoices/InvoiceLivePreview'
import ThermalReceipt from '../components/ui/ThermalReceipt'
import api from './api'
import { formatCurrency, isSarCurrency } from './currency'
import { calculateInvoiceSummary, normalizeTravelDetails } from './invoiceDocument'
import { getInvoiceBranding, getInvoiceTemplateId, splitBrandingText, getLetterheadContact, splitCompanyNameLines, getLetterheadStyle, hexColorToRgb } from './invoiceBranding'
import { getAmountInWords } from './amountInWords'
import { resolveTaxInvoiceQr } from './taxInvoiceQr'
import { resolveInvoiceBilingual, getInvoiceSecondaryLanguage, toEasternArabicNumerals } from './invoiceLanguage'
import { LETTERHEAD_TEMPLATE_ID, resolveQuotationTemplateId } from './invoiceTemplates'
import { formatProductTypeBilingual } from './productType'
import { autoTranslateText } from './builtInTranslator'
import { stripRichMarkup } from './formatRichText'
import { formatInvoiceDateDisplay, resolveInvoiceDateCalendar } from './invoiceDateFormat'

const sanitizeFileName = (value) => {
  return String(value || 'invoice')
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
}

const resolveDocumentPdfTemplateId = (tenant, invoice, documentType = 'invoice') => {
  const id = getInvoiceTemplateId(tenant, invoice?.businessContext, invoice?.pdfTemplateId)
  if (documentType === 'quotation' || invoice?.quotationNumber || documentType === 'purchase_order' || documentType === 'vendor_bill') {
    return resolveQuotationTemplateId(id)
  }
  return Number(id)
}

const resolveDocumentNumber = (invoice, documentType = 'invoice') => {
  if (documentType === 'quotation') {
    return invoice?.quotationNumber || invoice?.invoiceNumber || 'quotation'
  }
  if (documentType === 'purchase_order') {
    return invoice?.poNumber || 'purchase_order'
  }
  if (documentType === 'vendor_bill') {
    return invoice?.billNumber || (invoice?.poNumber ? `BILL-${invoice.poNumber}` : 'vendor_bill')
  }
  if (documentType === 'sales_order') {
    return invoice?.poNumber || invoice?.invoiceNumber || 'sales_order'
  }
  return invoice?.invoiceNumber || invoice?.quotationNumber || 'invoice'
}

const fetchInvoicePdfBlob = async (invoiceId) => {
  if (!invoiceId) return null

  const asPdfBlob = (data) => (data instanceof Blob ? data : new Blob([data], { type: 'application/pdf' }))
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const response = await api.get(`/invoices/${invoiceId}/pdf`, {
      responseType: 'blob',
      timeout: 120000,
      params: { async: 1 },
      validateStatus: (status) => status === 200 || status === 202,
    })
    const type = String(response.headers?.['content-type'] || '')
    if (response.status === 200 && type.includes('pdf')) {
      return asPdfBlob(response.data)
    }
    await sleep(400 + attempt * 150)
  }

  const fallback = await api.get(`/invoices/${invoiceId}/pdf`, {
    responseType: 'blob',
    timeout: 120000,
    params: { sync: 1 },
  })
  return asPdfBlob(fallback?.data)
}

const downloadPdfBlob = (blob, fileName) => {
  if (!blob || typeof window === 'undefined' || typeof document === 'undefined') return false
  const objectUrl = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = objectUrl
  link.download = `${sanitizeFileName(fileName)}.pdf`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), 1000)
  return true
}

export const printPdfBlob = async (blob, title) => {
  if (!blob || typeof window === 'undefined' || typeof document === 'undefined') return false
  const objectUrl = window.URL.createObjectURL(blob)
  const revokeLater = () => window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), 60_000)

  const popup = window.open(objectUrl, '_blank')
  if (popup) {
    popup.document.title = title || 'Print'
    const tryPrint = () => {
      try {
        popup.focus()
        popup.print()
      } catch {
        /* ignore */
      }
    }
    popup.onload = tryPrint
    window.setTimeout(tryPrint, 700)
    revokeLater()
    return true
  }

  const frame = document.createElement('iframe')
  frame.style.position = 'fixed'
  frame.style.right = '0'
  frame.style.bottom = '0'
  frame.style.width = '0'
  frame.style.height = '0'
  frame.style.border = '0'
  frame.title = title || 'Print'
  document.body.appendChild(frame)
  frame.src = objectUrl
  await Promise.race([
    new Promise((resolve) => {
      frame.onload = () => resolve()
    }),
    new Promise((resolve) => window.setTimeout(resolve, 800)),
  ])

  const printWindow = frame.contentWindow
  if (!printWindow) {
    if (frame.parentNode) frame.parentNode.removeChild(frame)
    window.URL.revokeObjectURL(objectUrl)
    return false
  }

  try {
    printWindow.focus()
    printWindow.print()
  } catch {
    if (frame.parentNode) frame.parentNode.removeChild(frame)
    window.URL.revokeObjectURL(objectUrl)
    return false
  }

  window.setTimeout(() => {
    if (frame.parentNode) frame.parentNode.removeChild(frame)
    window.URL.revokeObjectURL(objectUrl)
  }, 1500)

  return true
}

const clamp = (value, min, max) => Math.max(min, Math.min(max, value))

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

const mix = (a, b, w) => Math.round(a * (1 - w) + b * w)

const mixRgb = (rgb, target, w) => ({
  r: mix(rgb.r, target.r, w),
  g: mix(rgb.g, target.g, w),
  b: mix(rgb.b, target.b, w),
})

const rgbToHex = (rgb) => {
  const to = (n) => clamp(n, 0, 255).toString(16).padStart(2, '0')
  return `#${to(rgb.r)}${to(rgb.g)}${to(rgb.b)}`
}

const rgbArr = (rgb) => [rgb.r, rgb.g, rgb.b]
const toNumber = (value, fallback = 0) => {
  const numericValue = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(numericValue) ? numericValue : fallback
}

const detectImageFormat = (dataUrl) => {
  const m = /^data:image\/(png|jpeg|jpg);/i.exec(String(dataUrl || ''))
  if (!m) return null
  const ext = m[1].toLowerCase()
  return ext === 'jpg' ? 'JPEG' : ext === 'jpeg' ? 'JPEG' : 'PNG'
}

const blobToDataUrl = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(reader.result)
  reader.onerror = () => reject(reader.error)
  reader.readAsDataURL(blob)
})

const resolveImageSource = async (value) => {
  const raw = String(value || '').trim()
  if (!raw) return null
  if (/^data:image\//i.test(raw)) return raw

  try {
    const res = await fetch(raw)
    if (!res.ok) return null
    const blob = await res.blob()
    return await blobToDataUrl(blob)
  } catch {
    return null
  }
}

const renderQrToDataUrl = async (value, size = 112) => {
  const raw = String(value || '').trim()
  if (!raw || typeof document === 'undefined' || typeof Image === 'undefined') return null

  try {
    const svgMarkup = renderToStaticMarkup(createElement(QRCodeSVG, {
      value: raw,
      size,
      includeMargin: true,
      bgColor: '#FFFFFF',
      fgColor: '#0F172A',
    }))

    const svgBlob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' })
    const svgUrl = URL.createObjectURL(svgBlob)

    const dataUrl = await new Promise((resolve) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          URL.revokeObjectURL(svgUrl)
          resolve(null)
          return
        }
        ctx.fillStyle = '#FFFFFF'
        ctx.fillRect(0, 0, size, size)
        ctx.drawImage(img, 0, 0, size, size)
        URL.revokeObjectURL(svgUrl)
        resolve(canvas.toDataURL('image/png'))
      }
      img.onerror = () => {
        URL.revokeObjectURL(svgUrl)
        resolve(null)
      }
      img.src = svgUrl
    })

    return dataUrl
  } catch {
    return null
  }
}

const shouldRenderBilingualInvoice = (invoice, documentType = 'invoice', tenant = null) => {
  const contextBilingual = documentType === 'quotation'
    || documentType === 'purchase_order'
    || documentType === 'vendor_bill'
    || documentType === 'sales_order'
    || invoice?.invoiceSubtype === 'travel_ticket'
    || ['travel_agency', 'trading', 'construction', 'boutique'].includes(invoice?.businessContext)
  return resolveInvoiceBilingual(tenant, contextBilingual)
}

import { isThermalInvoice } from './invoiceFormat'

export { isThermalInvoice }
const isPosInvoice = isThermalInvoice

const captureElementSnapshotCanvas = async (sourceElement) => {
  if (!sourceElement || typeof window === 'undefined') return null

  try {
    await waitForElementImages(sourceElement)

    const html2canvasModule = await import('html2canvas')
    const html2canvas = html2canvasModule?.default || html2canvasModule
    const target = sourceElement.querySelector?.('[data-letterhead-root]') || sourceElement
    const width = Math.max(target.scrollWidth || 0, target.clientWidth || 0, 794)
    return await html2canvas(target, {
      backgroundColor: '#ffffff',
      scale: 2,
      useCORS: true,
      logging: false,
      width,
      windowWidth: width,
      onclone: (_document, clonedElement) => {
        // html2canvas + CSS uppercase/letter-spacing shred Arabic ligatures.
        clonedElement.querySelectorAll('[dir="rtl"], [lang="ar"], [dir=rtl], [lang=ar]').forEach((node) => {
          if (!(node instanceof HTMLElement)) return
          node.style.letterSpacing = '0'
          node.style.textTransform = 'none'
          if (!node.style.fontFamily) {
            node.style.fontFamily = '"InvoiceAlmarai", "Almarai", Arial, sans-serif'
          }
        })
      },
    })
  } catch (error) {
    console.warn('[invoicePdf] html2canvas snapshot failed', error)
    return null
  }
}

const renderElementSnapshotPdf = async ({ doc, sourceElement, fullBleed = false }) => {
  if (!doc || !sourceElement || typeof window === 'undefined') return false

  const canvas = await captureElementSnapshotCanvas(sourceElement)
  if (!canvas) return false

  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const isThermal = pageW < 300
  const margin = isThermal ? 8 : (fullBleed ? 0 : 18)
  const usableW = pageW - margin * 2
  const usableH = pageH - margin * 2
  const scale = usableW / canvas.width

  if (isThermal) {
    const imgHeight = canvas.height * scale
    doc.addImage(
      canvas.toDataURL('image/png'),
      'PNG',
      margin,
      margin,
      usableW,
      imgHeight,
      undefined,
      'FAST'
    )
    return true
  }

  const fittedScale = canvas.height * scale <= usableH + 1.5
    ? scale
    : Math.min(scale, usableH / canvas.height)
  const drawW = canvas.width * fittedScale
  const drawX = margin + (usableW - drawW) / 2

  if (canvas.height * fittedScale <= usableH + 1.5) {
    doc.addImage(
      canvas.toDataURL('image/png'),
      'PNG',
      drawX,
      margin,
      drawW,
      canvas.height * fittedScale,
      undefined,
      'FAST'
    )
    return true
  }

  const pageCanvasHeight = Math.max(1, Math.floor(usableH / fittedScale))

  let offsetY = 0
  let pageIndex = 0

  while (offsetY < canvas.height) {
    const sliceHeight = Math.min(pageCanvasHeight, canvas.height - offsetY)
    const pageCanvas = document.createElement('canvas')
    pageCanvas.width = canvas.width
    pageCanvas.height = sliceHeight
    const pageCtx = pageCanvas.getContext('2d')
    if (!pageCtx) return false

    pageCtx.fillStyle = '#FFFFFF'
    pageCtx.fillRect(0, 0, pageCanvas.width, pageCanvas.height)
    pageCtx.drawImage(
      canvas,
      0,
      offsetY,
      canvas.width,
      sliceHeight,
      0,
      0,
      canvas.width,
      sliceHeight,
    )

    if (pageIndex > 0) {
      doc.addPage()
    }

    doc.addImage(
      pageCanvas.toDataURL('image/png'),
      'PNG',
      drawX,
      margin,
      drawW,
      sliceHeight * fittedScale,
      undefined,
      'FAST'
    )

    offsetY += sliceHeight
    pageIndex += 1
  }

  return true
}

const pdfDocumentToBlob = (doc) => {
  if (!doc) return null

  try {
    const blob = doc.output('blob')
    if (blob instanceof Blob) return blob
  } catch {
  }

  try {
    const arrayBuffer = doc.output('arraybuffer')
    return new Blob([arrayBuffer], { type: 'application/pdf' })
  } catch {
    return null
  }
}

const saveElementSnapshotPdf = async ({ doc, sourceElement, fileName, fullBleed = false }) => {
  const rendered = await renderElementSnapshotPdf({ doc, sourceElement, fullBleed })
  if (!rendered) return false

  doc.save(`${fileName}.pdf`)
  return true
}

export const printInvoiceSnapshot = async ({ invoice, language = 'en', tenant, sourceElement = null, documentType = 'invoice' }) => {
  if (!invoice || typeof document === 'undefined' || typeof window === 'undefined') return false

  const currency = invoice.currency || tenant?.settings?.currency || 'SAR'
  const shouldPreferGeneratedSnapshot = isSarCurrency(currency)

  let snapshotElement = shouldPreferGeneratedSnapshot ? null : sourceElement
  let generatedSnapshotHost = null

  if (!snapshotElement) {
    generatedSnapshotHost = await buildSnapshotElement({ invoice, tenant, language, documentType })
    snapshotElement = generatedSnapshotHost
  }

  const canvas = await captureElementSnapshotCanvas(snapshotElement)

  if (generatedSnapshotHost?.parentNode) {
    generatedSnapshotHost.parentNode.removeChild(generatedSnapshotHost)
  }

  if (!canvas) return false

  const imageData = canvas.toDataURL('image/png')
  const title = sanitizeFileName(resolveDocumentNumber(invoice, documentType))
  const frame = document.createElement('iframe')
  frame.style.position = 'fixed'
  frame.style.right = '0'
  frame.style.bottom = '0'
  frame.style.width = '0'
  frame.style.height = '0'
  frame.style.border = '0'
  document.body.appendChild(frame)

  const cleanup = () => {
    window.setTimeout(() => {
      if (frame.parentNode) {
        frame.parentNode.removeChild(frame)
      }
    }, 400)
  }

  const printWindow = frame.contentWindow
  if (!printWindow) {
    cleanup()
    return false
  }

  printWindow.document.open()
  printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>${title}</title>
  <style>
    @page { size: A4 portrait; margin: 8mm; }
    html, body { margin: 0; padding: 0; background: #ffffff; }
    body { font-family: 'InvoiceAlmarai', Arial, sans-serif; }
    .page {
      min-height: 100vh;
      display: flex;
      align-items: flex-start;
      justify-content: center;
      padding: 0;
      box-sizing: border-box;
      background: #ffffff;
    }
    img {
      display: block;
      width: 100%;
      max-width: 194mm;
      height: auto;
      object-fit: contain;
    }
  </style>
</head>
<body>
  <div class="page"><img src="${imageData}" alt="${title}" /></div>
</body>
</html>`)
  printWindow.document.close()

  await new Promise((resolve) => {
    frame.onload = () => resolve()
    window.setTimeout(resolve, 250)
  })

  printWindow.focus()
  printWindow.print()
  cleanup()
  return true
}

const waitForElementImages = async (element) => {
  if (!element) return
  const images = Array.from(element.querySelectorAll('img'))
  const pending = images
    .filter((img) => !img.complete)
    .map((img) => new Promise((resolve) => {
      const done = () => resolve()
      img.addEventListener('load', done, { once: true })
      img.addEventListener('error', done, { once: true })
    }))

  if (pending.length > 0) {
    await Promise.allSettled(pending)
  }

  if (document?.fonts?.load) {
    await Promise.allSettled([
      document.fonts.load('400 16px "InvoiceAlmarai"'),
      document.fonts.load('700 16px "InvoiceAlmarai"'),
      document.fonts.load('400 16px "Noto Nastaliq Urdu"'),
      document.fonts.load('700 16px "Noto Nastaliq Urdu"'),
    ])
  }
}

const buildSnapshotElement = async ({ invoice, tenant, language, documentType = 'invoice' }) => {
  if (typeof document === 'undefined') return null

  const templateId = resolveDocumentPdfTemplateId(tenant, invoice, documentType)
  const isLetterheadSnapshot = Number(templateId) === LETTERHEAD_TEMPLATE_ID

  const host = document.createElement('div')
  host.style.position = 'fixed'
  host.style.left = '-20000px'
  host.style.top = '0'
  host.style.width = isLetterheadSnapshot ? '794px' : '1120px'
  host.style.padding = isLetterheadSnapshot ? '0' : '24px'
  host.style.background = '#ffffff'
  host.style.zIndex = '-1'
  host.style.pointerEvents = 'none'

  const previewElement = createElement(InvoiceLivePreview, {
    invoice,
    tenant,
    language,
    templateId,
    bilingual: shouldRenderBilingualInvoice(invoice, documentType, tenant),
    secondaryLanguage: getInvoiceSecondaryLanguage(tenant) || undefined,
    currencyRenderMode: 'snapshot-icon',
    documentType,
  })
  const snapshotMarkup = renderToStaticMarkup(
    createElement('div', { style: { background: '#ffffff' } }, previewElement)
  )
  host.innerHTML = `
    <style>
      @font-face {
        font-family: "InvoiceAlmarai";
        src: url("/fonts/Almarai/Almarai-Regular.ttf") format("truetype");
        font-weight: 400;
        font-style: normal;
      }

      @font-face {
        font-family: "InvoiceAlmarai";
        src: url("/fonts/Almarai/Almarai-Bold.ttf") format("truetype");
        font-weight: 700;
        font-style: normal;
      }
      ${isLetterheadSnapshot ? `
        [data-letterhead-root] {
          max-width: none !important;
          width: 100% !important;
          margin-left: 0 !important;
          margin-right: 0 !important;
          border-radius: 0 !important;
          box-shadow: none !important;
          border-width: 0 !important;
          min-height: 297mm !important;
        }
      ` : ''}
    </style>
    ${snapshotMarkup}
  `

  document.body.appendChild(host)
  await waitForElementImages(host)
  await new Promise((resolve) => window.requestAnimationFrame(() => resolve()))
  return host
}

let almaraiRegularBase64
let almaraiBoldBase64
let almaraiLoadPromise
const customArabicFontEnabled = true
const almaraiFontCandidates = {
  regular: [
    '/fonts/Almarai/Almarai-Regular.ttf',
  ],
  bold: [
    '/fonts/Almarai/Almarai-Bold.ttf',
  ],
}

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

const looksLikeHtmlDocument = (buffer) => {
  try {
    const sample = new TextDecoder('utf-8').decode(buffer.slice(0, 160)).trim().toLowerCase()
    return sample.startsWith('<!doctype html') || sample.startsWith('<html') || sample.includes('<html')
  } catch {
    return false
  }
}

const tryFetchFontBase64 = async (url) => {
  const res = await fetch(url)
  if (!res.ok) return null
  const buf = await res.arrayBuffer()
  if (looksLikeHtmlDocument(buf) || !hasFontSignature(buf)) return null
  return bufferToBase64(buf)
}

const tryFetchFirstFontBase64 = async (urls = []) => {
  for (const url of urls) {
    try {
      const fontBase64 = await tryFetchFontBase64(url)
      if (fontBase64) return fontBase64
    } catch {
      // ignore and try next URL
    }
  }
  return null
}

const ensureAlmaraiFont = async (doc) => {
  if (!customArabicFontEnabled) return false
  if (!doc || typeof doc.addFileToVFS !== 'function' || typeof doc.addFont !== 'function') return false

  if (!almaraiLoadPromise) {
    almaraiLoadPromise = (async () => {
      almaraiRegularBase64 = await tryFetchFirstFontBase64(almaraiFontCandidates.regular)
      almaraiBoldBase64 = await tryFetchFirstFontBase64(almaraiFontCandidates.bold)
    })()
  }

  try {
    await almaraiLoadPromise
  } catch {
    almaraiLoadPromise = null
    return false
  }

  if (!almaraiRegularBase64) {
    almaraiLoadPromise = null
    return false
  }

  try {
    doc.addFileToVFS('Almarai-Regular.ttf', almaraiRegularBase64)
    doc.addFont('Almarai-Regular.ttf', 'Almarai', 'normal')
    if (almaraiBoldBase64) {
      doc.addFileToVFS('Almarai-Bold.ttf', almaraiBoldBase64)
      doc.addFont('Almarai-Bold.ttf', 'Almarai', 'bold')
    }
    doc.setFont('Almarai', 'normal')
    doc.getTextWidth('اختبار')
    return true
  } catch {
    doc.setFont('helvetica', 'normal')
    return false
  }
}

const safeText = (value) => {
  if (value === null || value === undefined) return ''
  return String(value)
}

const hasArabicText = (value = '') => /[\u0600-\u06FF]/.test(String(value || ''))

const uniqueTextLines = (...values) => {
  const seen = new Set()
  const result = []

  for (const value of values) {
    const lines = String(value || '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)

    for (const line of lines) {
      const key = line.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      result.push(line)
    }
  }

  return result
}

const toBilingualBlock = (englishValue, arabicValue, fallback = '—') => {
  const lines = uniqueTextLines(englishValue, arabicValue)
  return lines.length > 0 ? lines.join('\n') : fallback
}

const toBilingualText = (englishValue, arabicValue, fallback = '—') => {
  const lines = uniqueTextLines(englishValue, arabicValue)
  return lines.length > 0 ? lines.join('\n') : fallback
}

const formatDateTime = (value, language) => {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString(language === 'ar' ? 'ar-SA' : 'en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Riyadh',
  })
}

const formatInvoiceIssueDate = (invoice, tenant, language) => formatInvoiceDateDisplay(invoice?.issueDate, {
  mode: resolveInvoiceDateCalendar(tenant),
  language,
  hijriValue: invoice?.issueDateHijri,
  includeTime: true,
  timeZone: tenant?.settings?.timezone || 'Asia/Riyadh',
})

const formatAddress = (address = {}) => {
  return [address?.street, address?.district, address?.city, address?.postalCode, address?.country]
    .filter(Boolean)
    .join(', ')
}

const getPartyDetailLines = (party = {}, language = 'en', role = 'party', isPk = false) => {
  const lines = []
  const vatLabel = role === 'seller'
    ? (language === 'ar' ? 'الرقم الضريبي للشركة' : (isPk ? 'Company GST / STRN' : 'Company VAT'))
    : (language === 'ar' ? 'الرقم الضريبي' : (isPk ? 'GST / STRN' : 'VAT'))

  if (party?.ntn) {
    lines.push({ label: 'NTN', value: party.ntn })
  }

  if (party?.strn) {
    lines.push({ label: 'STRN', value: party.strn })
  }

  if (party?.cnic) {
    lines.push({ label: 'CNIC', value: party.cnic })
  }

  if (role !== 'seller' && party?.vatNumber) {
    lines.push({ label: vatLabel, value: party.vatNumber })
  }

  if (role !== 'seller' && party?.crNumber) {
    lines.push({ label: language === 'ar' ? 'السجل التجاري' : 'CR', value: party.crNumber })
  }

  if (party?.contactPhone) {
    lines.push({ label: language === 'ar' ? 'الهاتف' : 'Phone', value: party.contactPhone })
  }

  if (party?.contactEmail) {
    lines.push({ label: language === 'ar' ? 'البريد الإلكتروني' : 'Email', value: party.contactEmail })
  }

  const addressText = formatAddress(party?.address)
  if (addressText) {
    lines.push({ label: language === 'ar' ? 'العنوان' : 'Address', value: addressText })
  }

  return lines.length > 0 ? lines : [{ label: '', value: '—' }]
}

const getInvoiceEyebrow = (invoice, language = 'en', documentType = 'invoice') => {
  if (documentType === 'purchase_order') {
    return language === 'ar' ? 'طلب شراء' : 'Purchase Order'
  }
  if (documentType === 'vendor_bill') {
    return language === 'ar' ? 'فاتورة أمر الشراء' : 'Purchase Order Bill'
  }
  if (documentType === 'sales_order') {
    return language === 'ar' ? 'فاتورة أمر البيع' : 'Sales Order Bill'
  }
  if (invoice?.quotationNumber) {
    if (invoice?.businessContext === 'construction') {
      return language === 'ar' ? 'عرض سعر للمقاولات' : 'Construction Quotation'
    }
    if (invoice?.businessContext === 'travel_agency') {
      return language === 'ar' ? 'عرض سعر خدمات السفر' : 'Travel Services Quotation'
    }
    if (invoice?.businessContext === 'restaurant') {
      return language === 'ar' ? 'عرض سعر مطعم' : 'Restaurant Quotation'
    }
    if (invoice?.businessContext === 'manpower') {
      return language === 'ar' ? 'عرض سعر توريد عمالة' : 'Manpower Supply Quotation'
    }
    return language === 'ar' ? 'عرض سعر' : 'Quotation'
  }

  if (invoice?.invoiceSubtype === 'travel_ticket' || invoice?.businessContext === 'travel_agency') {
    return language === 'ar' ? 'فاتورة خدمات السفر' : 'Travel Services Invoice'
  }

  if (invoice?.businessContext === 'construction') {
    return language === 'ar' ? 'فاتورة مقاولات' : 'Construction Invoice'
  }

  if (invoice?.businessContext === 'restaurant') {
    return language === 'ar' ? 'فاتورة مطعم' : 'Restaurant Invoice'
  }

  if (invoice?.businessContext === 'manpower') {
    return language === 'ar' ? 'فاتورة توريد عمالة' : 'Manpower Supply Invoice'
  }

  return language === 'ar' ? 'فاتورة تجارة' : 'Trading Invoice'
}

const getInvoiceTitle = (invoice, language = 'en', documentType = 'invoice') => {
  if (documentType === 'purchase_order') {
    return language === 'ar' ? 'طلب شراء' : 'Purchase Order'
  }
  if (documentType === 'vendor_bill') {
    return language === 'ar' ? 'فاتورة أمر الشراء' : 'Purchase Order Bill'
  }
  if (documentType === 'sales_order') {
    return language === 'ar' ? 'فاتورة أمر البيع' : 'Sales Order Bill'
  }
  if (invoice?.quotationNumber) {
    if (invoice?.businessContext === 'construction') {
      return language === 'ar' ? 'عرض سعر للمقاولات' : 'Construction Quotation'
    }
    if (invoice?.businessContext === 'travel_agency') {
      return language === 'ar' ? 'عرض سعر لخدمات السفر' : 'Travel Services Quotation'
    }
    if (invoice?.businessContext === 'restaurant') {
      return language === 'ar' ? 'عرض سعر للمطعم' : 'Restaurant Quotation'
    }
    if (invoice?.businessContext === 'manpower') {
      return language === 'ar' ? 'عرض سعر توريد عمالة' : 'Manpower Supply Quotation'
    }
    return language === 'ar' ? 'عرض سعر' : 'Quotation'
  }

  if (invoice?.invoiceSubtype === 'travel_ticket' || invoice?.businessContext === 'travel_agency') {
    return language === 'ar' ? 'فاتورة ضريبية لخدمات السفر' : 'Travel Services Tax Invoice'
  }

  if (invoice?.businessContext === 'construction') {
    return language === 'ar' ? 'فاتورة ضريبية للمقاولات' : 'Construction Tax Invoice'
  }

  if (invoice?.businessContext === 'trading') {
    return language === 'ar' ? 'فاتورة ضريبية للتجارة' : 'Trading Tax Invoice'
  }

  if (invoice?.businessContext === 'manpower') {
    return language === 'ar' ? 'فاتورة ضريبية لتوريد العمالة' : 'Manpower Supply Tax Invoice'
  }

  return language === 'ar' ? 'فاتورة ضريبية' : 'Tax Invoice'
}

const generateInvoicePdf = async ({ invoice, language = 'en', tenant, sourceElement = null, output = 'save', documentType = 'invoice', editable = false }) => {
  if (!invoice) return

  const snapshotCurrency = invoice.currency || tenant?.settings?.currency || 'SAR'
  const requestedTemplateId = resolveDocumentPdfTemplateId(tenant, invoice, documentType)
  const isLetterhead = Number(requestedTemplateId) === LETTERHEAD_TEMPLATE_ID
  // Raster snapshots are not text-editable in Foxit/Adobe. Explicit "editable
  // PDF" downloads use native jsPDF text instead. Letterhead quotations use a
  // snapshot so the file matches the on-screen letterhead.
  const shouldUseSnapshotRenderer =
    !editable &&
    (Boolean(sourceElement) || isLetterhead || shouldRenderBilingualInvoice(invoice, documentType, tenant) || isSarCurrency(snapshotCurrency))

  const jspdfModule = await import('jspdf')
  const jsPDF = jspdfModule?.jsPDF || jspdfModule?.default || jspdfModule

  const autoTableModule = await import('jspdf-autotable')
  const autoTable = autoTableModule?.default || autoTableModule

  const isPos = isPosInvoice(invoice)
  const pdfOrientation = tenant?.settings?.invoicePdfOrientation || 'portrait'
  const pdfPageSize = isPos ? [226, 800] : (tenant?.settings?.invoicePdfPageSize || 'a4')
  const doc = new jsPDF({ orientation: pdfOrientation, unit: 'pt', format: pdfPageSize })
  const name = sanitizeFileName(resolveDocumentNumber(invoice, documentType))

  let snapshotElement = shouldUseSnapshotRenderer ? null : (sourceElement || null)
  let generatedSnapshotHost = null

  if (shouldUseSnapshotRenderer && !snapshotElement) {
    generatedSnapshotHost = await buildSnapshotElement({ invoice, tenant, language, documentType })
    snapshotElement = generatedSnapshotHost
  }

  if (snapshotElement) {
    const saved = output === 'blob'
      ? await renderElementSnapshotPdf({ doc, sourceElement: snapshotElement, fullBleed: isLetterhead })
      : await saveElementSnapshotPdf({ doc, sourceElement: snapshotElement, fileName: name, fullBleed: isLetterhead })
    if (generatedSnapshotHost?.parentNode) {
      generatedSnapshotHost.parentNode.removeChild(generatedSnapshotHost)
    }
    if (saved) {
      return output === 'blob' ? pdfDocumentToBlob(doc) : true
    }
  }

  if (generatedSnapshotHost?.parentNode) {
    generatedSnapshotHost.parentNode.removeChild(generatedSnapshotHost)
  }

  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const margin = 40
  const invoiceBranding = getInvoiceBranding(tenant, language, invoice?.businessContext)
  const templateId = resolveDocumentPdfTemplateId(tenant, invoice, documentType)
  const letterheadMode = Number(templateId) === LETTERHEAD_TEMPLATE_ID
  const footerH = letterheadMode ? 78 : 76
  const headerH = letterheadMode ? 104 : 132
  const topMargin = headerH + 14

  const isRtl = language === 'ar'
  const align = isRtl ? 'right' : 'left'
  const oppositeAlign = isRtl ? 'left' : 'right'

  const arabicFontReady = await ensureAlmaraiFont(doc)

  if (isRtl && typeof doc.setR2L === 'function') {
    try {
      doc.setR2L(true)
    } catch {
      // ignore
    }
  }

  const primaryRgb = hexToRgb(invoiceBranding.primaryColor) || { r: 15, g: 23, b: 42 }
  const secondaryRgb = hexToRgb(invoiceBranding.secondaryColor) || { r: 203, g: 213, b: 225 }
  const lightRgb = mixRgb(primaryRgb, { r: 255, g: 255, b: 255 }, 0.94)

  const theme = (() => {
    const base = {
      sidebarW: 0,
      headerBgRgb: null,
      headerTitleRgb: { r: 15, g: 23, b: 42 },
      headerMutedRgb: { r: 100, g: 116, b: 139 },
      metaFillRgb: { r: 248, g: 250, b: 252 },
      metaStrokeRgb: { r: 203, g: 213, b: 225 },
      boxFillRgb: { r: 255, g: 255, b: 255 },
      boxStrokeRgb: { r: 203, g: 213, b: 225 },
      tableHeadFillRgb: { r: 15, g: 23, b: 42 },
      tableHeadTextRgb: { r: 255, g: 255, b: 255 },
      altRowFillRgb: { r: 248, g: 250, b: 252 },
      drawFrame: () => {
        doc.setFillColor(primaryRgb.r, primaryRgb.g, primaryRgb.b)
        doc.rect(0, 0, pageW, 4, 'F')
        doc.setFillColor(secondaryRgb.r, secondaryRgb.g, secondaryRgb.b)
        doc.rect(0, 8, pageW, 2, 'F')
      },
    }

    if (templateId === 2) {
      return {
        ...base,
        drawFrame: () => {
          doc.setFillColor(primaryRgb.r, primaryRgb.g, primaryRgb.b)
          doc.rect(0, 0, pageW, 4, 'F')
        },
      }
    }

    if (templateId === 3) {
      return {
        ...base,
        drawFrame: () => {
          doc.setFillColor(primaryRgb.r, primaryRgb.g, primaryRgb.b)
          doc.rect(0, 0, pageW, 2, 'F')
        },
      }
    }

    if (templateId === 4) {
      return {
        ...base,
        metaFillRgb: { r: 255, g: 255, b: 255 },
        tableHeadFillRgb: primaryRgb,
        tableHeadTextRgb: { r: 255, g: 255, b: 255 },
        altRowFillRgb: { r: 255, g: 255, b: 255 },
        drawFrame: () => {
          doc.setFillColor(primaryRgb.r, primaryRgb.g, primaryRgb.b)
          doc.rect(0, 0, pageW, 2, 'F')
        },
      }
    }

    if (templateId === 5) {
      return {
        ...base,
        headerTitleRgb: { r: 15, g: 23, b: 42 },
        headerMutedRgb: { r: 100, g: 116, b: 139 },
        metaFillRgb: { r: 255, g: 255, b: 255 },
        tableHeadFillRgb: primaryRgb,
        tableHeadTextRgb: { r: 255, g: 255, b: 255 },
        boxStrokeRgb: { r: 203, g: 213, b: 225 },
        altRowFillRgb: { r: 248, g: 250, b: 252 },
      }
    }

    if (templateId === 6) {
      return {
        ...base,
        metaFillRgb: { r: 255, g: 255, b: 255 },
        metaStrokeRgb: { r: 203, g: 213, b: 225 },
        boxStrokeRgb: { r: 148, g: 163, b: 184 },
        tableHeadFillRgb: primaryRgb,
        tableHeadTextRgb: { r: 255, g: 255, b: 255 },
        altRowFillRgb: { r: 255, g: 255, b: 255 },
        drawFrame: () => {
          doc.setFillColor(primaryRgb.r, primaryRgb.g, primaryRgb.b)
          doc.rect(0, 0, pageW, 3, 'F')
        },
      }
    }

    return base
  })()

  const contentLeft = margin + (theme.sidebarW && !isRtl ? theme.sidebarW : 0)
  const contentRight = margin + (theme.sidebarW && isRtl ? theme.sidebarW : 0)
  const contentRightEdge = pageW - contentRight
  const contentW = pageW - contentLeft - contentRight

  const logo = await resolveImageSource(
    letterheadMode ? String(tenant?.branding?.logo || '').trim() : invoiceBranding.logoSrc
  )
  const logoFormat = detectImageFormat(logo)
  const signatureImage = await resolveImageSource(invoice?.authorizedPersonSignature)
  const signatureFormat = detectImageFormat(signatureImage)
  const stampImage = await resolveImageSource(invoice?.stampImage)
  const stampFormat = detectImageFormat(stampImage)
  const visionLogo = invoiceBranding.showVision2030 ? await resolveImageSource(invoiceBranding.vision2030LogoSrc) : null
  const visionLogoFormat = detectImageFormat(visionLogo)

  const seller = invoice.seller || {}
  const buyer = invoice.buyer || {}

  const currency = invoice.currency || tenant?.settings?.currency || 'SAR'
  const currencyOpts = { language, currency, currencyDisplay: 'code', minimumFractionDigits: 2, maximumFractionDigits: 2 }

  const money = (value) => formatCurrency(toNumber(value), currencyOpts)
  const txt = (value) => safeText(value)

  const shape = (value) => {
    const raw = safeText(value)
    if (!raw) return ''

    const lines = raw.split(/\r?\n/)
    const shapedLines = lines.map((line) => {
      if (!line || !hasArabicText(line) || typeof doc.processArabic !== 'function') return line
      try {
        return doc.processArabic(line)
      } catch {
        return line
      }
    })

    return shapedLines.join('\n')
  }

  const isVendorBillPdf = documentType === 'vendor_bill'
  const isPurchaseFlowPdf = invoice?.flow === 'purchase' || documentType === 'purchase_invoice' || documentType === 'purchase_order' || isVendorBillPdf

  const sellerNameEn = isPurchaseFlowPdf
    ? (tenant?.business?.legalNameEn || tenant?.name || invoiceBranding?.legalNameEn || '')
    : (seller.name || seller.nameAr || tenant?.business?.legalNameEn || tenant?.business?.legalNameAr || '')
  const sellerNameAr = isPurchaseFlowPdf
    ? (tenant?.business?.legalNameAr || invoiceBranding?.legalNameAr || '')
    : (seller.nameAr || (hasArabicText(seller.name) ? seller.name : '') || tenant?.business?.legalNameAr || '')
  
  const buyerParty = isPurchaseFlowPdf ? (invoice.seller || {}) : (invoice.buyer || {})
  const buyerNameEn = buyerParty.name || buyerParty.nameAr || (isPurchaseFlowPdf ? 'Cash Supplier' : 'Cash Customer')
  const buyerNameAr = buyerParty.nameAr || (hasArabicText(buyerParty.name) ? buyerParty.name : '') || (isPurchaseFlowPdf ? 'مورد نقدي' : 'عميل نقدي')
  
  const sellerName = sellerNameEn || sellerNameAr
  const buyerName = buyerNameEn || buyerNameAr
  const sellerDisplayName = toBilingualText(sellerNameEn, sellerNameAr)
  const buyerDisplayName = toBilingualText(buyerNameEn, buyerNameAr)
  const isPk = String(currency || '').toUpperCase() === 'PKR' || (tenant?.business?.address?.country || '').toUpperCase() === 'PK'
  const sellerDetailLines = getPartyDetailLines(isPurchaseFlowPdf ? (tenant?.business || {}) : seller, language, 'seller', isPk)
  const buyerDetailLines = getPartyDetailLines(buyerParty, language, isPurchaseFlowPdf ? 'supplier' : 'buyer', isPk)
  const totals = calculateInvoiceSummary(invoice)
  const travelDetailsEn = normalizeTravelDetails(invoice.travelDetails || {}, buyerNameEn || buyerNameAr, 'en')
  const travelDetailsAr = normalizeTravelDetails(invoice.travelDetails || {}, buyerNameAr || buyerNameEn, 'ar')
  const isQuotationPdf = Boolean(invoice?.quotationNumber) || documentType === 'quotation'
  const isPurchaseOrderPdf = documentType === 'purchase_order'
  const isSalesOrderPdf = documentType === 'sales_order'
  const isTravelInvoicePdf = !isQuotationPdf && !isPurchaseOrderPdf && !isSalesOrderPdf && (invoice?.invoiceSubtype === 'travel_ticket' || invoice?.businessContext === 'travel_agency')
  const skipDocumentQr = isTravelInvoicePdf || isQuotationPdf || isPurchaseOrderPdf || isSalesOrderPdf || documentType === 'vendor_bill' || ['cancelled'].includes(String(invoice?.status || '').toLowerCase())
  const isZatcaApplicablePdf = String(invoice?.currency || tenant?.settings?.currency || 'SAR').toUpperCase() === 'SAR'
  const qrValue = skipDocumentQr
    ? null
    : resolveTaxInvoiceQr({
        invoice,
        tenant,
        currency,
        sellerName,
        vatNumber: isPurchaseFlowPdf ? (tenant?.business?.vatNumber || '') : (seller?.vatNumber || tenant?.business?.vatNumber),
      })
  const skipQr = !qrValue || skipDocumentQr
  // Travel agency invoices omit the tax QR from the printed document.
  const fallbackQrImage = skipQr || (isZatcaApplicablePdf && invoice?.zatca?.qrCodeImage) || !qrValue ? null : await renderQrToDataUrl(qrValue, 120)
  const qr = skipQr ? null : await resolveImageSource((isZatcaApplicablePdf && invoice?.zatca?.qrCodeImage) || fallbackQrImage || null)
  const qrFormat = detectImageFormat(qr)
  const companyName = invoiceBranding.companyName || sellerNameEn || sellerNameAr || ''
  const letterheadContact = getLetterheadContact(tenant, invoice)
  const headerLines = isQuotationPdf ? [] : splitBrandingText(invoiceBranding.headerText)
  const footerLines = isQuotationPdf
    ? [letterheadContact.addressLine, letterheadContact.phone, letterheadContact.email].filter(Boolean)
    : splitBrandingText(invoiceBranding.footerText)
  const invoiceEyebrow = getInvoiceEyebrow(invoice, language, documentType)

  const title = isQuotationPdf
    ? getInvoiceTitle(invoice, language, documentType)
    : isPurchaseOrderPdf
    ? getInvoiceTitle(invoice, language, documentType)
    : isVendorBillPdf
    ? getInvoiceTitle(invoice, language, documentType)
    : isPurchaseFlowPdf
    ? (language === 'ar' ? 'فاتورة شراء' : 'Purchase Invoice')
    : invoice?.invoiceSubtype === 'travel_ticket' || invoice?.businessContext === 'travel_agency'
    ? ''
    : getInvoiceTitle(invoice, language, documentType)
  const customerLabel = isPurchaseOrderPdf || isPurchaseFlowPdf
    ? toBilingualBlock('Supplier', 'المورد')
    : toBilingualBlock('Customer', 'العميل')
  const sellerLabel = isPurchaseOrderPdf || isPurchaseFlowPdf
    ? toBilingualBlock('Company', 'الشركة')
    : toBilingualBlock('Seller', 'البائع')
  const amountInWords = getAmountInWords(totals.grandTotal, currency, language)
  const typography = invoiceBranding.typography || {}
  const bodyFontName = arabicFontReady ? 'Almarai' : (typography.bodyFontFamily || 'helvetica')
  const headingFontName = arabicFontReady ? 'Almarai' : (typography.headingFontFamily || 'helvetica')
  const bodyFontSize = Number(typography.bodyFontSize || 12)
  const headingFontSize = Number(typography.headingFontSize || 18)

  const setBodyFont = (size = bodyFontSize, style = 'normal') => {
    try {
      doc.setFont(bodyFontName, style)
    } catch {
      doc.setFont(arabicFontReady ? 'Almarai' : 'helvetica', style)
    }
    doc.setFontSize(size)
  }

  const setHeadingFont = (size = headingFontSize, style = 'bold') => {
    try {
      doc.setFont(headingFontName, style)
    } catch {
      doc.setFont(arabicFontReady ? 'Almarai' : 'helvetica', style)
    }
    doc.setFontSize(size)
  }

  const drawHeader = ({ pageNumber }) => {
    if (letterheadMode) {
      const contact = getLetterheadContact(tenant, invoice)
      const { textColor, accentColor } = getLetterheadStyle(tenant)
      const textRgb = hexColorToRgb(textColor)
      const accentRgb = hexColorToRgb(accentColor)
      doc.setFillColor(255, 255, 255)
      doc.rect(0, 0, pageW, headerH, 'F')

      const logoPx = Math.max(28, Math.min(120, Number(invoiceBranding.logoSize) || 64))
      // jsPDF uses mm-ish units via page points — map CSS px ≈ 0.35pt scale for letterhead
      const logoH = Math.round(logoPx * 0.38)
      const logoW = Math.round(logoH * 1.2)
      const logoX = (pageW - logoW) / 2
      if (logo && logoFormat) {
        doc.addImage(logo, logoFormat, logoX, 18, logoW, logoH)
      }

      const nameY = 28
      const crY = 60
      const vatY = 74
      const nameMaxW = (contentW / 2) - 52

      const headingPdfSize = Math.max(10, Math.min(28, Math.round((invoiceBranding.headingSize || 24) * 0.55)))
      const crVatPdfSize = Math.max(7, Math.min(14, Math.round((invoiceBranding.crVatSize || 14) * 0.6)))

      setHeadingFont(headingPdfSize, 'bold')
      doc.setTextColor(textRgb.r, textRgb.g, textRgb.b)
      const leftNameLines = splitCompanyNameLines(contact.companyEn || companyName)
      const rightNameLines = splitCompanyNameLines(contact.companyAr)
      leftNameLines.forEach((line, index) => {
        doc.text(shape(line), contentLeft, nameY + index * 14, { align: 'left', maxWidth: nameMaxW })
      })
      rightNameLines.forEach((line, index) => {
        doc.text(shape(line), contentRightEdge, nameY + index * 14, { align: 'right', maxWidth: nameMaxW })
      })

      setBodyFont(crVatPdfSize, 'bold')
      doc.setTextColor(textRgb.r, textRgb.g, textRgb.b)
      if (contact.crNumber) {
        doc.text(shape(`C.R # : ${contact.crNumber}`), contentLeft, crY, { align: 'left' })
        doc.text(shape(`س.ت : ${toEasternArabicNumerals(contact.crNumber)}`), contentRightEdge, crY, { align: 'right' })
      }
      if (contact.vatNumber) {
        doc.text(shape(`VAT # : ${contact.vatNumber}`), contentLeft, vatY, { align: 'left' })
        doc.text(shape(`الرقم الضريبي : ${toEasternArabicNumerals(contact.vatNumber)}`), contentRightEdge, vatY, { align: 'right' })
      }

      doc.setDrawColor(accentRgb.r, accentRgb.g, accentRgb.b)
      doc.setLineWidth(0.9)
      doc.line(contentLeft, 88, contentRightEdge, 88)
      doc.setLineWidth(0.2)
      return
    }

    theme.drawFrame({ pageNumber })

    const y = 20
    const logoW = 64
    const logoH = 64
    const rightPanelW = 148
    const qrW = 64
    const qrH = 64
    const rightPanelX = isRtl ? contentLeft : contentRightEdge - rightPanelW
    const logoX = isRtl ? contentRightEdge - logoW : contentLeft
    const brandBlockX = isRtl ? logoX - 16 : contentLeft + logoW + 16
    const brandBlockW = Math.max(160, contentW - logoW - rightPanelW - 40)
    const qrX = isRtl ? rightPanelX : rightPanelX + rightPanelW - qrW

    if (logo && logoFormat) {
      doc.addImage(logo, logoFormat, logoX, y + 4, logoW, logoH)
    }

    doc.setTextColor(theme.headerMutedRgb.r, theme.headerMutedRgb.g, theme.headerMutedRgb.b)
    setBodyFont(8, 'normal')
    doc.text(shape(invoiceEyebrow), brandBlockX, y + 14, { align, maxWidth: brandBlockW })

    doc.setTextColor(theme.headerTitleRgb.r, theme.headerTitleRgb.g, theme.headerTitleRgb.b)
    setHeadingFont(Math.max(headingFontSize + 1, 17), 'bold')
    const companyLines = doc.splitTextToSize(shape(companyName), brandBlockW).slice(0, 2)
    doc.text(companyLines, brandBlockX, y + 32, { align, maxWidth: brandBlockW })
    const companyBottomY = y + 32 + Math.max(0, companyLines.length - 1) * 15

    if (headerLines.length > 0) {
      doc.setTextColor(theme.headerMutedRgb.r, theme.headerMutedRgb.g, theme.headerMutedRgb.b)
      setBodyFont(8, 'normal')
      let headerY = companyBottomY + 13
      for (const line of headerLines.slice(0, 2)) {
        doc.text(shape(line), brandBlockX, headerY, { align, maxWidth: brandBlockW })
        headerY += 10
      }
    }

    if (qr && qrFormat) {
      doc.addImage(qr, qrFormat, qrX, y + 2, qrW, qrH)
    }

    const qrCenterX = qrX + qrW / 2
    const ntnValue = tenant?.fbr?.ntn || tenant?.business?.ntn || seller?.ntn
    const strnValue = tenant?.fbr?.strn || tenant?.business?.strn || seller?.strn
    const vatValue = seller.vatNumber || invoiceBranding.vatNumber
    const crValue = seller.crNumber || invoiceBranding.crNumber
    doc.setTextColor(theme.headerTitleRgb.r, theme.headerTitleRgb.g, theme.headerTitleRgb.b)
    setBodyFont(8, isQuotationPdf ? 'bold' : 'normal')
    if (String(currency || '').toUpperCase() === 'PKR' && ntnValue) {
      doc.text(shape(`NTN: ${ntnValue}`), qrCenterX, y + 76, { align: 'center', maxWidth: rightPanelW })
      if (strnValue) {
        doc.text(shape(`STRN: ${strnValue}`), qrCenterX, y + 87, { align: 'center', maxWidth: rightPanelW })
      }
    } else {
      if (vatValue) {
        doc.text(shape(`${isRtl ? 'الرقم الضريبي' : 'VAT'}: ${vatValue}`), qrCenterX, y + 76, { align: 'center', maxWidth: rightPanelW })
      }
      if (crValue) {
        doc.text(shape(`${isRtl ? 'السجل التجاري' : 'CR'}: ${crValue}`), qrCenterX, y + 87, { align: 'center', maxWidth: rightPanelW })
      }
    }

    const dividerY = y + 100

    doc.setDrawColor(226, 232, 240)
    doc.line(contentLeft, dividerY, contentRightEdge, dividerY)

    doc.setTextColor(theme.headerTitleRgb.r, theme.headerTitleRgb.g, theme.headerTitleRgb.b)
    if (title) {
      setHeadingFont(Math.max(headingFontSize, 18), 'bold')
      doc.text(shape(title), pageW / 2, dividerY + 23, { align: 'center' })
    }
  }

  drawHeader({ pageNumber: 1 })

  const cardX = contentLeft
  const cardW = contentW
  const cardY = topMargin

  const metaRows = [
    {
      k: isPurchaseOrderPdf
        ? (isRtl ? 'رقم طلب الشراء' : 'PO #')
        : isQuotationPdf
          ? (isRtl ? 'رقم عرض السعر' : 'Quotation #')
          : (isRtl ? 'رقم الفاتورة' : 'Invoice #'),
      v: resolveDocumentNumber(invoice, documentType),
    },
    { k: isRtl ? 'التاريخ' : 'Date', v: formatInvoiceIssueDate(invoice, tenant, language) },
    { k: isRtl ? 'المستند' : 'Document', v: invoiceEyebrow },
    {
      k: isRtl ? 'النوع / التدفق' : 'Type / Flow',
      v: isPurchaseOrderPdf
        ? (isRtl ? 'طلب شراء' : 'Purchase Order')
        : isQuotationPdf
          ? `${invoice.transactionType || '—'} / ${(isRtl ? 'عرض سعر' : 'Quotation')}`
          : `${invoice.transactionType || '—'} / ${invoice.flow || 'sell'}`,
    },
  ].filter(Boolean)

  const metaPairs = Math.ceil(metaRows.length / 2)
  const metaRowH = 26
  const metaYStart = 18
  const metaBottomPad = 10
  const metaH = metaYStart + metaPairs * metaRowH + metaBottomPad

  doc.setFillColor(theme.metaFillRgb.r, theme.metaFillRgb.g, theme.metaFillRgb.b)
  doc.setDrawColor(theme.metaStrokeRgb.r, theme.metaStrokeRgb.g, theme.metaStrokeRgb.b)
  doc.roundedRect(cardX, cardY, cardW, metaH, 14, 14, 'FD')

  const leftColX = isRtl ? cardX + cardW - 14 : cardX + 14
  const rightColX = isRtl ? cardX + 14 : cardX + cardW - 14

  setBodyFont(8, 'normal')
  let metaY = cardY + metaYStart

  for (let i = 0; i < metaRows.length; i += 2) {
    const a = metaRows[i]
    const b = metaRows[i + 1]

    doc.setTextColor(100)
    doc.text(shape(`${txt(a.k)}:`), leftColX, metaY, { align })
    doc.setTextColor(primaryRgb.r, primaryRgb.g, primaryRgb.b)
    doc.text(shape(txt(a.v)), leftColX, metaY + 12, { align })

    if (b) {
      doc.setTextColor(100)
      doc.text(shape(`${txt(b.k)}:`), rightColX, metaY, { align: isRtl ? 'left' : 'right' })
      doc.setTextColor(primaryRgb.r, primaryRgb.g, primaryRgb.b)
      doc.text(shape(txt(b.v)), rightColX, metaY + 12, { align: isRtl ? 'left' : 'right' })
    }

    metaY += metaRowH
  }

  const boxGap = 10
  const boxY = cardY + metaH + 10
  const boxW = (cardW - boxGap) / 2
  const partyLineHeight = 13
  const partyPad = 12
  const measureTextLines = (value, width, setter) => {
    setter()
    const lines = uniqueTextLines(value || '—').flatMap((line) => {
      const measured = doc.splitTextToSize(shape(line || '—'), width)
      return Array.isArray(measured) && measured.length > 0 ? measured : ['—']
    })
    return Array.isArray(lines) && lines.length > 0 ? lines : ['—']
  }
  const sellerNameLines = measureTextLines(sellerDisplayName, boxW - partyPad * 2, () => setHeadingFont(Math.max(bodyFontSize + 1, 10), 'bold'))
  const buyerNameLines = measureTextLines(buyerDisplayName, boxW - partyPad * 2, () => setHeadingFont(Math.max(bodyFontSize + 1, 10), 'bold'))
  const sellerDetailTextLines = sellerDetailLines.flatMap((detail) => measureTextLines(detail.label ? `${detail.label}: ${detail.value}` : detail.value, boxW - partyPad * 2, () => setBodyFont(Math.max(bodyFontSize - 1, 8), 'bold')))
  const buyerDetailTextLines = buyerDetailLines.flatMap((detail) => measureTextLines(detail.label ? `${detail.label}: ${detail.value}` : detail.value, boxW - partyPad * 2, () => setBodyFont(Math.max(bodyFontSize - 1, 8), 'bold')))
  const sellerNameHeight = sellerNameLines.length * 13
  const buyerNameHeight = buyerNameLines.length * 13
  const detailStartOffset = 38 + Math.max(sellerNameHeight, buyerNameHeight)
  const partyDetailsCount = Math.max(sellerDetailTextLines.length, buyerDetailTextLines.length, 1)
  const boxH = Math.max(94, detailStartOffset + partyDetailsCount * partyLineHeight + 14)

  const drawPartyBox = ({ x, y, label, nameLines, detailLines }) => {
    doc.setFillColor(theme.boxFillRgb.r, theme.boxFillRgb.g, theme.boxFillRgb.b)
    doc.setDrawColor(theme.boxStrokeRgb.r, theme.boxStrokeRgb.g, theme.boxStrokeRgb.b)
    doc.roundedRect(x, y, boxW, boxH, 14, 14, 'FD')

    const tx = isRtl ? x + boxW - partyPad : x + partyPad

    setBodyFont(8, 'normal')
    doc.setTextColor(100)
    doc.text(shape(label), tx, y + 18, { align })

    setHeadingFont(Math.max(bodyFontSize + 1, 10), 'bold')
    doc.setTextColor(primaryRgb.r, primaryRgb.g, primaryRgb.b)
    doc.text(nameLines, tx, y + 36, { align, maxWidth: boxW - partyPad * 2 })

    setBodyFont(Math.max(bodyFontSize - 1, 8), 'bold')
    doc.setTextColor(31, 41, 55)
    let ty = y + detailStartOffset

    for (const detailLine of detailLines.length > 0 ? detailLines : ['—']) {
      doc.text(shape(detailLine), tx, ty, { align, maxWidth: boxW - partyPad * 2 })
      ty += partyLineHeight
    }
  }

  const leftX = contentLeft
  const rightBoxX = contentLeft + boxW + boxGap

  const firstBoxX = isRtl ? rightBoxX : leftX
  const secondBoxX = isRtl ? leftX : rightBoxX

  drawPartyBox({
    x: firstBoxX,
    y: boxY,
    label: sellerLabel,
    nameLines: sellerNameLines,
    detailLines: sellerDetailTextLines,
  })

  drawPartyBox({
    x: secondBoxX,
    y: boxY,
    label: customerLabel,
    nameLines: buyerNameLines,
    detailLines: buyerDetailTextLines,
  })

  let y = boxY + boxH + 14

  if (invoice?.invoiceSubtype === 'travel_ticket') {
    const travelRows = [
      [toBilingualText('Lead Traveler', 'اسم المسافر الرئيسي'), toBilingualText(travelDetailsEn.travelerDisplayName || buyerNameEn || buyerNameAr, travelDetailsAr.travelerDisplayName || buyerNameAr || buyerNameEn, '')],
      [toBilingualText('Passport', 'رقم الجواز'), travelDetailsEn.passportNumber || travelDetailsAr.passportNumber || ''],
      [toBilingualText('Ticket Reference', 'مرجع التذكرة'), travelDetailsEn.ticketNumber || travelDetailsAr.ticketNumber || ''],
      [toBilingualText('PNR', 'رمز الحجز'), travelDetailsEn.pnr || travelDetailsAr.pnr || ''],
      [toBilingualText('Travel Route', 'مسار الرحلة'), toBilingualText(travelDetailsEn.routeText, travelDetailsAr.routeText, '')],
      [toBilingualText('Carrier / Service Provider', 'الناقل / مزود الخدمة'), toBilingualText(travelDetailsEn.airlineDisplayName, travelDetailsAr.airlineDisplayName, '')],
      [toBilingualText('Departure Date', 'تاريخ المغادرة'), toBilingualText(formatDateTime(travelDetailsEn.departureDate, 'en'), formatDateTime(travelDetailsAr.departureDate, 'ar'), '')],
      [toBilingualText('Return Date', 'تاريخ العودة'), travelDetailsEn.hasReturnDate ? toBilingualText(formatDateTime(travelDetailsEn.returnDate, 'en'), formatDateTime(travelDetailsAr.returnDate, 'ar'), '') : ''],
      [toBilingualText('Layover / Stay', 'التوقف / الإقامة'), toBilingualText(travelDetailsEn.layoverStayDisplay, travelDetailsAr.layoverStayDisplay, '')],
      [toBilingualText('Additional Passengers', 'مسافرون إضافيون'), toBilingualText(travelDetailsEn.additionalPassengersText === '—' ? '' : travelDetailsEn.additionalPassengersText, travelDetailsAr.additionalPassengersText === '—' ? '' : travelDetailsAr.additionalPassengersText, '')],
    ].filter(([, value]) => String(value || '').trim())

    autoTable(doc, {
      startY: y,
      margin: { left: contentLeft, right: contentRight, top: topMargin, bottom: footerH },
      theme: 'grid',
      tableWidth: contentW,
      body: travelRows,
      styles: {
        fontSize: Math.max(8, Math.min(14, bodyFontSize - 1)),
        cellPadding: 4,
        font: bodyFontName,
        textColor: [15, 23, 42],
        lineColor: [203, 213, 225],
        lineWidth: 0.35,
      },
      columnStyles: {
        0: { cellWidth: 150, fontStyle: 'bold', halign: align },
        1: { cellWidth: contentW - 150, halign: align },
      },
      didDrawPage: () => {
        const pageNumber = doc.getCurrentPageInfo().pageNumber
        drawHeader({ pageNumber })
      },
    })

    y = doc.lastAutoTable.finalY + 16
  }

  setHeadingFont(Math.max(bodyFontSize + 1, 11), 'bold')
  doc.setTextColor(primaryRgb.r, primaryRgb.g, primaryRgb.b)
  doc.text(shape(toBilingualBlock('Items', 'البنود')), isRtl ? contentRightEdge : contentLeft, y, { align })
  y += 14

  const lineItems = Array.isArray(totals?.lines) ? totals.lines : []

  const itemsBaseWidths = {
    idx: 28,
    desc: 214,
    qty: 48,
    unit: 72,
    tax: 66,
    total: 72,
  }
  const baseSum = Object.values(itemsBaseWidths).reduce((a, b) => a + b, 0)
  const scale = Math.min(1, contentW / baseSum)
  const idxW = Math.max(22, Math.round(itemsBaseWidths.idx * scale))
  const qtyW = Math.max(36, Math.round(itemsBaseWidths.qty * scale))
  const unitW = Math.max(56, Math.round(itemsBaseWidths.unit * scale))
  const taxW = Math.max(50, Math.round(itemsBaseWidths.tax * scale))
  const totalW = Math.max(56, Math.round(itemsBaseWidths.total * scale))
  const fixedW = idxW + qtyW + unitW + taxW + totalW
  const descW = Math.max(110, Math.floor(contentW - fixedW))

  const rowDescriptions = []

  const bodyRows = (lineItems.length ? lineItems : [{}]).map((l, idx) => {
    if (!l || !(l.raw?.productName || l.productName)) {
      rowDescriptions.push('')
      return [
        '',
        shape(isRtl ? 'خدمة' : 'Service'),
        '1',
        money(0),
        money(0),
        money(0),
      ]
    }

    const quantity = toNumber(l.quantity)
    const unitPrice = toNumber(l.unitPrice)
    const taxAmount = toNumber(l.taxAmount)
    const lineTotalWithTax = toNumber(l.lineTotalWithTax)
    const productNameEn = l.raw?.productName || l.productName || l.raw?.productNameAr || l.productNameAr || ''
    const productNameAr = l.raw?.productNameAr || l.productNameAr || (hasArabicText(productNameEn) ? productNameEn : '')
    const descriptionEn = l.raw?.description || l.description || l.raw?.descriptionAr || l.descriptionAr || ''
    const descriptionAr = l.raw?.descriptionAr || l.descriptionAr || (hasArabicText(descriptionEn) ? descriptionEn : '')
    const nameText = toBilingualText(productNameEn, productNameAr, '')
    const rawType = l.raw?.productType || l.productType
    const typeText = rawType && rawType !== 'goods' ? formatProductTypeBilingual(rawType) : ''
    const rawUnitCode = l.raw?.unitCode || l.unitCode || ''
    const unitCodeText = rawUnitCode ? String(rawUnitCode).trim() : ''

    rowDescriptions.push(descText)

    return [
      String(idx + 1),
      shape([nameText, typeText].filter(Boolean).join('\n')),
      unitCodeText ? `${quantity}\n${unitCodeText}` : String(quantity),
      money(unitPrice),
      money(taxAmount),
      money(lineTotalWithTax),
    ]
  })

  const nameFontSize = Math.max(8, Math.min(14, bodyFontSize - 1))
  const descFontSize = Math.max(7, Math.min(11, bodyFontSize - 3))

  autoTable(doc, {
    startY: y,
    margin: { left: contentLeft, right: contentRight, top: topMargin, bottom: footerH },
    head: [[
      '#',
      'Description\nالوصف',
      'Qty\nالكمية',
      'Unit Price\nسعر الوحدة',
      isPk ? 'GST\nالضريبة' : 'Tax\nالضريبة',
      'Total\nالإجمالي',
    ]],
    body: bodyRows,
    styles: {
      fontSize: nameFontSize,
      cellPadding: 4,
      font: bodyFontName,
      textColor: [15, 23, 42],
      lineColor: [226, 232, 240],
      lineWidth: 0.4,
      valign: 'top',
    },
    headStyles: {
      fillColor: rgbArr(theme.tableHeadFillRgb),
      textColor: rgbArr(theme.tableHeadTextRgb),
      fontStyle: 'bold',
    },
    alternateRowStyles: theme.altRowFillRgb ? { fillColor: rgbArr(theme.altRowFillRgb) } : {},
    columnStyles: {
      0: { cellWidth: idxW, halign: 'center', valign: 'middle' },
      1: { cellWidth: descW, halign: isRtl ? 'right' : 'left', valign: 'top' },
      2: { cellWidth: qtyW, halign: 'center', valign: 'middle' },
      3: { cellWidth: unitW, halign: 'right', valign: 'middle' },
      4: { cellWidth: taxW, halign: 'right', valign: 'middle' },
      5: { cellWidth: totalW, halign: 'right', fontStyle: 'bold', valign: 'middle' },
    },
    didParseCell: (data) => {
      if (data.column.index === 1 && data.section === 'body' && rowDescriptions[data.row.index]) {
        const rawDesc = rowDescriptions[data.row.index]
          .replace(/\b(exclusions?|excl)\b/gi, '\n$1')
          .replace(/\n{2,}/g, '\n')
          .trim()
        const descLines = doc.splitTextToSize(shape(rawDesc), descW - 8)
        const nameLines = doc.splitTextToSize(String(data.cell.text[0] || ''), descW - 8)
        const neededHeight = nameLines.length * (nameFontSize * 1.15) + descLines.length * (descFontSize * 1.15) + 12
        if (neededHeight > (data.cell.styles.minCellHeight || 0)) {
          data.cell.styles.minCellHeight = neededHeight
        }
      }
    },
    didDrawCell: (data) => {
      if (data.column.index === 1 && data.section === 'body' && rowDescriptions[data.row.index]) {
        const { x, y, width } = data.cell
        const padding = 4
        const textX = isRtl ? x + width - padding : x + padding
        const maxWidth = width - padding * 2

        const nameLines = doc.splitTextToSize(String(data.cell.text[0] || ''), maxWidth)
        let descY = y + padding + nameLines.length * (nameFontSize * 1.15) + 3

        doc.setFontSize(descFontSize)
        doc.setFont(bodyFontName, 'bold')
        doc.setTextColor(71, 85, 105)

        const rawDesc = rowDescriptions[data.row.index]
        const descWithExclusions = rawDesc
          .replace(/\b(exclusions?|excl)\b/gi, '\n$1')
          .replace(/\n{2,}/g, '\n')
          .trim()
        const descLines = doc.splitTextToSize(shape(descWithExclusions), maxWidth)
        doc.text(descLines, textX, descY, { align: isRtl ? 'right' : 'left', maxWidth })

        doc.setFontSize(nameFontSize)
        doc.setTextColor(primaryRgb.r, primaryRgb.g, primaryRgb.b)
      }
    },
    didDrawPage: () => {
      const pageNumber = doc.getCurrentPageInfo().pageNumber
      drawHeader({ pageNumber })
    },
  })

  const taxable = Number(totals.taxableAmount ?? 0)
  const totalTax = Number(totals.totalTax ?? 0)
  const grandTotal = Number(totals.grandTotal ?? 0)

  const totalsRows = [
    ['Subtotal', 'الإجمالي الفرعي', money(totals.subtotal)],
    ['Discount', 'الخصم', money(totals.totalDiscount)],
    ['Taxable Amount', 'الإجمالي قبل الضريبة', money(taxable)],
    [isPk ? 'GST' : 'Tax', 'الضريبة', money(totalTax)],
    ['Total', 'الإجمالي', money(grandTotal)],
  ]

  const summaryGap = 12
  const totalsW = 250
  const amountWordsW = Math.max(180, contentW - totalsW - summaryGap)
  const amountWordsLeft = isRtl ? contentRightEdge - amountWordsW : contentLeft
  const totalsLeft = isRtl ? contentLeft : contentRightEdge - totalsW
  const totalsTop = doc.lastAutoTable.finalY + 12
  const amountWordsH = Math.max(86, invoice?.notes ? 118 : 92)
  const totalsH = 210

  doc.setFillColor(255, 255, 255)
  doc.setDrawColor(theme.boxStrokeRgb.r, theme.boxStrokeRgb.g, theme.boxStrokeRgb.b)
  doc.roundedRect(amountWordsLeft, totalsTop, amountWordsW, amountWordsH, 12, 12, 'FD')

  setBodyFont(8, 'normal')
  doc.setTextColor(theme.headerMutedRgb.r, theme.headerMutedRgb.g, theme.headerMutedRgb.b)
  doc.text(shape(toBilingualBlock('Amount in Words', 'المبلغ كتابةً')), isRtl ? amountWordsLeft + amountWordsW - 12 : amountWordsLeft + 12, totalsTop + 18, { align, maxWidth: amountWordsW - 24 })

  setHeadingFont(Math.max(bodyFontSize + 1, 10), 'bold')
  doc.setTextColor(theme.headerTitleRgb.r, theme.headerTitleRgb.g, theme.headerTitleRgb.b)
  const amountWordLines = doc.splitTextToSize(shape(amountInWords), amountWordsW - 24)
  doc.text(amountWordLines, isRtl ? amountWordsLeft + amountWordsW - 12 : amountWordsLeft + 12, totalsTop + 38, { align, maxWidth: amountWordsW - 24 })

  if (invoice?.notes) {
    setBodyFont(Math.max(bodyFontSize - 1, 8), 'bold')
    doc.setTextColor(51, 65, 85)
    const noteLines = doc.splitTextToSize(shape(stripRichMarkup(invoice.notes)), amountWordsW - 24)
    doc.text(noteLines, isRtl ? amountWordsLeft + amountWordsW - 12 : amountWordsLeft + 12, totalsTop + 68, { align, maxWidth: amountWordsW - 24 })
  }

  doc.setFillColor(lightRgb.r, lightRgb.g, lightRgb.b)
  doc.setDrawColor(theme.boxStrokeRgb.r, theme.boxStrokeRgb.g, theme.boxStrokeRgb.b)
  doc.roundedRect(totalsLeft, totalsTop, totalsW, totalsH, 12, 12, 'FD')

  let totalsY = totalsTop + 18
  for (let i = 0; i < totalsRows.length; i += 1) {
    const [labelEn, labelAr, value] = totalsRows[i]
    const isGrandTotal = i === totalsRows.length - 1
    const label = toBilingualBlock(labelEn, labelAr)

    if (isGrandTotal) {
      doc.setDrawColor(203, 213, 225)
      doc.line(totalsLeft + 14, totalsY - 10, totalsLeft + totalsW - 14, totalsY - 10)

      setHeadingFont(Math.max(bodyFontSize, 10), 'bold')
      doc.setTextColor(theme.headerTitleRgb.r, theme.headerTitleRgb.g, theme.headerTitleRgb.b)
      doc.text(shape(label), isRtl ? totalsLeft + totalsW - 14 : totalsLeft + 14, totalsY, { align, maxWidth: totalsW - 36 })

      totalsY += 28

      setHeadingFont(Math.max(bodyFontSize + 6, 15), 'bold')
      doc.text(shape(value), isRtl ? totalsLeft + 14 : totalsLeft + totalsW - 14, totalsY, { align: oppositeAlign, maxWidth: totalsW - 28 })

      totalsY += 18
    } else {
      setBodyFont(Math.max(bodyFontSize - 1, 8), 'bold')
      doc.setTextColor(theme.headerMutedRgb.r, theme.headerMutedRgb.g, theme.headerMutedRgb.b)
      doc.text(shape(label), isRtl ? totalsLeft + totalsW - 14 : totalsLeft + 14, totalsY, { align, maxWidth: 148 })

      doc.setTextColor(theme.headerTitleRgb.r, theme.headerTitleRgb.g, theme.headerTitleRgb.b)
      doc.text(shape(value), isRtl ? totalsLeft + 14 : totalsLeft + totalsW - 14, totalsY, { align: oppositeAlign, maxWidth: 110 })

      totalsY += 28
    }
  }

  let extraBoxesY = totalsTop + totalsH + 14

  const pdfBank = invoice?.includeBankDetails ? (invoice?.bankDetails || {}) : null
  const hasPdfBank = Boolean(pdfBank && (pdfBank.bankName || pdfBank.accountName || pdfBank.accountNumber || pdfBank.iban))

  if (hasPdfBank) {
    const bankY = extraBoxesY
    const bankW = contentW
    const bankLines = [
      pdfBank.bankName ? `${isRtl ? 'اسم البنك' : 'Bank'}: ${pdfBank.bankName}` : null,
      pdfBank.accountName ? `${isRtl ? 'اسم الحساب' : 'Account Name'}: ${pdfBank.accountName}` : null,
      pdfBank.accountNumber ? `${isRtl ? 'رقم الحساب' : 'Account #'}: ${pdfBank.accountNumber}` : null,
      pdfBank.iban ? `IBAN: ${pdfBank.iban}` : null,
    ].filter(Boolean)

    const bankHeight = Math.max(38, bankLines.length * 12 + 24)
    doc.setFillColor(255, 255, 255)
    doc.setDrawColor(theme.boxStrokeRgb.r, theme.boxStrokeRgb.g, theme.boxStrokeRgb.b)
    doc.roundedRect(contentLeft, bankY, bankW, bankHeight, 12, 12, 'FD')

    setBodyFont(Math.max(bodyFontSize - 1, 8), 'bold')
    doc.setTextColor(51, 65, 85)
    doc.text(shape(toBilingualText('Bank Details', 'بيانات البنك')), isRtl ? contentRightEdge - 12 : contentLeft + 12, bankY + 14, { align, maxWidth: bankW - 24 })

    setBodyFont(Math.max(bodyFontSize - 2, 7.5), 'normal')
    doc.setTextColor(71, 85, 105)
    let lineY = bankY + 26
    for (const bLine of bankLines) {
      doc.text(shape(bLine), isRtl ? contentRightEdge - 12 : contentLeft + 12, lineY, { align, maxWidth: bankW - 24 })
      lineY += 11
    }
    extraBoxesY += bankHeight + 10
  }

  if (invoice?.termsAndConditions) {
    const tcY = extraBoxesY
    const tcW = contentW
    const tcText = shape(stripRichMarkup(invoice.termsAndConditions))
    setBodyFont(Math.max(bodyFontSize - 2, 7.5), 'normal')
    const tcLines = doc.splitTextToSize(tcText, tcW - 24)
    const tcHeight = Math.max(40, tcLines.length * (Math.max(bodyFontSize - 1, 8) * 1.3) + 28)

    doc.setFillColor(255, 255, 255)
    doc.setDrawColor(theme.boxStrokeRgb.r, theme.boxStrokeRgb.g, theme.boxStrokeRgb.b)
    doc.roundedRect(contentLeft, tcY, tcW, tcHeight, 12, 12, 'FD')

    setBodyFont(Math.max(bodyFontSize - 1, 8), 'bold')
    doc.setTextColor(51, 65, 85)
    doc.text(shape(toBilingualText('Terms & Conditions', 'الشروط والأحكام')), isRtl ? contentRightEdge - 12 : contentLeft + 12, tcY + 16, { align, maxWidth: tcW - 24 })

    setBodyFont(Math.max(bodyFontSize - 2, 7.5), 'normal')
    doc.setTextColor(71, 85, 105)
    doc.text(tcLines, isRtl ? contentRightEdge - 12 : contentLeft + 12, tcY + 30, { align, maxWidth: tcW - 24 })
    extraBoxesY += tcHeight + 10
  }

  if (signatureImage && signatureFormat) {
    const sigW = 130
    const sigH = 52
    const sigX = isRtl ? contentLeft : contentRightEdge - sigW
    const sigY = extraBoxesY + 8
    if (stampImage && stampFormat) {
      doc.addImage(stampImage, stampFormat, sigX - 90, sigY, 70, 70)
    }
    doc.addImage(signatureImage, signatureFormat, sigX, sigY, sigW, sigH)
    doc.setDrawColor(148, 163, 184)
    doc.setLineWidth(0.6)
    doc.line(sigX, sigY + sigH + 6, sigX + sigW, sigY + sigH + 6)
    setBodyFont(8, 'bold')
    doc.setTextColor(primaryRgb.r, primaryRgb.g, primaryRgb.b)
    const signLabel = invoice?.authorizedPersonName
      ? toBilingualText(invoice.authorizedPersonName, invoice.authorizedPersonNameAr)
      : toBilingualText('Authorized Signature', 'المفوض بالتوقيع')
    doc.text(shape(signLabel), sigX + sigW / 2, sigY + sigH + 18, { align: 'center', maxWidth: sigW + 24 })
  }

  const pageCount = doc.getNumberOfPages()
  const generatedAt = `${isRtl ? 'تاريخ الإنشاء' : 'Generated'}: ${formatDateTime(new Date(), language)}`
  const footerTextLines = footerLines.length > 0 ? footerLines : []
  const footerVisionW = 74
  const footerVisionH = 30
  const footerVisionX = contentLeft
  const footerVisionY = pageH - footerH + 20

  for (let i = 1; i <= pageCount; i += 1) {
    doc.setPage(i)

    if (letterheadMode) {
      const { textColor, accentColor, footerTextEn, footerTextAr } = getLetterheadStyle(tenant)
      const textRgb = hexColorToRgb(textColor)
      const accentRgb = hexColorToRgb(accentColor)
      const footerTop = pageH - footerH + 8
      doc.setDrawColor(accentRgb.r, accentRgb.g, accentRgb.b)
      doc.setLineWidth(0.9)
      doc.line(contentLeft, footerTop, contentRightEdge, footerTop)
      doc.setLineWidth(0.2)

      setBodyFont(8, 'bold')
      doc.setTextColor(textRgb.r, textRgb.g, textRgb.b)
      let footerY = footerTop + 16
      if (letterheadContact.addressLine) {
        doc.text(shape(letterheadContact.addressLine), pageW / 2, footerY, {
          align: 'center',
          maxWidth: contentW,
        })
        footerY += 12
      }
      if (letterheadContact.addressAr) {
        doc.text(shape(toEasternArabicNumerals(letterheadContact.addressAr)), pageW / 2, footerY, {
          align: 'center',
          maxWidth: contentW,
        })
        footerY += 12
      }
      const phoneEmail = [letterheadContact.phone, letterheadContact.email].filter(Boolean).join('     ')
      if (phoneEmail) {
        doc.text(shape(phoneEmail), pageW / 2, footerY, { align: 'center', maxWidth: contentW })
        footerY += 12
      }
      const extraFooter = [footerTextEn, footerTextAr].filter(Boolean).join('  •  ')
      if (extraFooter) {
        doc.text(shape(extraFooter), pageW / 2, footerY, { align: 'center', maxWidth: contentW })
      }

      setBodyFont(8, 'normal')
      doc.setTextColor(148, 163, 184)
      doc.text(`${i} / ${pageCount}`, contentRightEdge, pageH - 10, { align: 'right' })
      continue
    }

    setBodyFont(9, 'normal')
    doc.setTextColor(100)

    doc.setDrawColor(226, 232, 240)
    doc.line(contentLeft, pageH - footerH + 6, contentRightEdge, pageH - footerH + 6)

    if (visionLogo && visionLogoFormat) {
      doc.addImage(visionLogo, visionLogoFormat, footerVisionX, footerVisionY, footerVisionW, footerVisionH)
    }

    if (footerTextLines.length > 0) {
      setBodyFont(8, isQuotationPdf ? 'bold' : 'normal')
      const footerReservedLeft = visionLogo && visionLogoFormat ? footerVisionW + 18 : 0
      const footerReservedRight = 52
      const footerTextAreaX = contentLeft + footerReservedLeft
      const footerTextAreaW = Math.max(120, contentW - footerReservedLeft - footerReservedRight)
      const footerTextCenterX = footerTextAreaX + footerTextAreaW / 2
      const footerVisibleLines = footerTextLines.slice(0, 3)
      let footerY = footerVisionY + (footerVisionH / 2) - ((footerVisibleLines.length - 1) * 10) / 2 + 3
      for (const line of footerVisibleLines) {
        doc.text(shape(line), footerTextCenterX, footerY, { align: 'center', maxWidth: footerTextAreaW })
        footerY += 10
      }
      setBodyFont(9, 'normal')
    }

    doc.text(
      shape(generatedAt),
      isRtl ? contentRightEdge : contentLeft + (visionLogo && visionLogoFormat ? footerVisionW + 12 : 0),
      pageH - 16,
      { align }
    )

    doc.text(
      `${i} / ${pageCount}`,
      isRtl ? contentLeft : contentRightEdge,
      pageH - 16,
      { align: oppositeAlign }
    )
  }

  if (output === 'blob') {
    return pdfDocumentToBlob(doc)
  }

  doc.save(`${name}.pdf`)
  return true
}

export const buildInvoicePdfBlob = async ({ invoice, language = 'en', tenant, sourceElement = null }) => {
  return await generateInvoicePdf({ invoice, language, tenant, sourceElement, output: 'blob', documentType: 'invoice' })
}

export const downloadInvoicePdf = async ({ invoice, language = 'en', tenant, sourceElement = null }) => {
  return await generateInvoicePdf({ invoice, language, tenant, sourceElement, output: 'save', documentType: 'invoice' })
}

export const buildQuotationPdfBlob = async ({ quotation, language = 'en', tenant, sourceElement = null, editable = false }) => {
  return await generateInvoicePdf({ invoice: quotation, language, tenant, sourceElement: editable ? null : sourceElement, output: 'blob', documentType: 'quotation', editable })
}

export const downloadQuotationPdf = async ({ quotation, language = 'en', tenant, sourceElement = null, editable = false }) => {
  return await generateInvoicePdf({ invoice: quotation, language, tenant, sourceElement: editable ? null : sourceElement, output: 'save', documentType: 'quotation', editable })
}

export const printQuotationSnapshot = async ({ quotation, language = 'en', tenant, sourceElement = null }) => {
  return await printInvoiceSnapshot({ invoice: quotation, language, tenant, sourceElement, documentType: 'quotation' })
}

export const mapSalesOrderForPdf = (salesOrder, tenant) => {
  if (!salesOrder || typeof salesOrder !== 'object') {
    throw new Error('Sales order is required')
  }

  const customer = salesOrder.customerId && typeof salesOrder.customerId === 'object'
    ? salesOrder.customerId
    : {}
  const business = tenant?.business || {}

  const lineItems = (Array.isArray(salesOrder.lineItems) ? salesOrder.lineItems : []).map((li) => {
    const product = (li?.productId && typeof li.productId === 'object') ? li.productId : null
    const rawManual = li?.manualName || li?.description || ''
    const isManualArabic = /[\u0600-\u06FF]/.test(rawManual)
    const productName =
      product?.nameEn ||
      (!isManualArabic ? rawManual : autoTranslateText(rawManual, 'ar', 'en')) ||
      li?.productName ||
      product?.nameAr ||
      'Item'
    const productNameAr =
      product?.nameAr ||
      li?.productNameAr ||
      li?.manualNameAr ||
      (isManualArabic ? rawManual : autoTranslateText(rawManual, 'en', 'ar')) ||
      (product?.nameEn ? autoTranslateText(product.nameEn, 'en', 'ar') : '') ||
      productName

    return {
      productId: product?._id || (typeof li?.productId === 'string' ? li.productId : '') || '',
      productName,
      productNameAr,
      description: li?.description || '',
      unitCode: li?.uom || li?.unitCode || product?.unitOfMeasure || 'PCE',
      quantity: Number(li?.quantityOrdered ?? li?.quantity ?? 0),
      unitPrice: Number(li?.unitCost ?? li?.unitPrice ?? 0),
      taxRate: Number(li?.taxRate ?? 15),
      productType: li?.productType || product?.productType || 'goods',
    }
  })

  const buyerNameEn = customer.nameEn || customer.name || ''
  const buyerNameAr = customer.nameAr || ''

  return {
    ...salesOrder,
    poNumber: salesOrder.poNumber || salesOrder.invoiceNumber || 'sales_order',
    invoiceNumber: salesOrder.poNumber || salesOrder.invoiceNumber || 'sales_order',
    issueDate: salesOrder.orderDate || salesOrder.issueDate || salesOrder.approvedAt || salesOrder.createdAt || new Date(),
    dueDate: salesOrder.expectedDate || salesOrder.dueDate || null,
    currency: salesOrder.currency || tenant?.settings?.currency || 'SAR',
    transactionType: salesOrder.transactionType
      || (customer.entityType === 'business' || customer.vatNumber ? 'B2B' : 'B2C'),
    flow: 'sell',
    lineItems,
    seller: {
      name: business.legalNameEn || business.legalNameAr || tenant?.name || '',
      nameEn: business.legalNameEn || tenant?.name || '',
      nameAr: business.legalNameAr || '',
      vatNumber: business.vatNumber || '',
      crNumber: business.crNumber || business.commercialRegistration?.crNumber || '',
      contactPhone: business.contactPhone || '',
      contactEmail: business.contactEmail || '',
      address: business.address || {},
    },
    buyer: {
      name: buyerNameEn || buyerNameAr || '',
      nameEn: buyerNameEn || '',
      nameAr: buyerNameAr || '',
      vatNumber: customer.vatNumber || '',
      crNumber: customer.crNumber || '',
      contactPhone: customer.phone || customer.contactPhone || customer.mobile || '',
      contactEmail: customer.email || customer.contactEmail || '',
      address: customer.address || {},
    },
    subtotal: salesOrder.subtotal,
    totalTax: salesOrder.totalTax,
    grandTotal: salesOrder.grandTotal,
  }
}

export const buildSalesOrderPdfBlob = async ({ salesOrder, language = 'en', tenant, sourceElement = null }) => {
  const mapped = mapSalesOrderForPdf(salesOrder, tenant)
  return await generateInvoicePdf({ invoice: mapped, language, tenant, sourceElement, output: 'blob', documentType: 'sales_order' })
}

export const downloadSalesOrderPdf = async ({ salesOrder, language = 'en', tenant, sourceElement = null }) => {
  const mapped = mapSalesOrderForPdf(salesOrder, tenant)
  const result = await generateInvoicePdf({ invoice: mapped, language, tenant, sourceElement, output: 'save', documentType: 'sales_order' })
  if (!result) throw new Error('Failed to generate sales order PDF')
  return result
}

export const printSalesOrderPdf = async ({ salesOrder, language = 'en', tenant, sourceElement = null }) => {
  const mapped = mapSalesOrderForPdf(salesOrder, tenant)
  try {
    const snapshotOk = await printInvoiceSnapshot({
      invoice: mapped,
      language,
      tenant,
      sourceElement,
      documentType: 'sales_order',
    })
    if (snapshotOk) return true
  } catch (error) {
    console.warn('[printSalesOrderPdf] snapshot print failed, using PDF blob', error)
  }

  const blob = await generateInvoicePdf({ invoice: mapped, language, tenant, output: 'blob', documentType: 'sales_order' })
  if (!blob) throw new Error('Failed to generate sales order PDF')
  const title = resolveDocumentNumber(mapped, 'sales_order')
  const printed = await printPdfBlob(blob, title)
  if (!printed) throw new Error('Failed to open print dialog')
  return true
}

export const mapPurchaseOrderForPdf = (purchaseOrder, tenant) => {
  if (!purchaseOrder || typeof purchaseOrder !== 'object') {
    throw new Error('Purchase order is required')
  }

  const supplier = purchaseOrder.supplierId && typeof purchaseOrder.supplierId === 'object'
    ? purchaseOrder.supplierId
    : {}
  const business = tenant?.business || {}

  const lineItems = (Array.isArray(purchaseOrder.lineItems) ? purchaseOrder.lineItems : []).map((li) => {
    const product = (li?.productId && typeof li.productId === 'object') ? li.productId : null
    const rawManual = li?.manualName || li?.description || ''
    const isManualArabic = /[\u0600-\u06FF]/.test(rawManual)
    const productName =
      product?.nameEn ||
      (!isManualArabic ? rawManual : autoTranslateText(rawManual, 'ar', 'en')) ||
      li?.productName ||
      product?.nameAr ||
      'Item'
    const productNameAr =
      product?.nameAr ||
      li?.productNameAr ||
      li?.manualNameAr ||
      (isManualArabic ? rawManual : autoTranslateText(rawManual, 'en', 'ar')) ||
      (product?.nameEn ? autoTranslateText(product.nameEn, 'en', 'ar') : '') ||
      productName

    return {
      productId: product?._id || (typeof li?.productId === 'string' ? li.productId : '') || '',
      productName,
      productNameAr,
      description: li?.description || '',
      unitCode: li?.uom || li?.unitCode || product?.unitOfMeasure || 'PCE',
      quantity: Number(li?.quantityOrdered ?? li?.quantity ?? 0),
      unitPrice: Number(li?.unitCost ?? li?.unitPrice ?? 0),
      taxRate: Number(li?.taxRate ?? 15),
      productType: li?.productType || product?.productType || 'goods',
    }
  })

  return {
    ...purchaseOrder,
    poNumber: purchaseOrder.poNumber || purchaseOrder.invoiceNumber || 'purchase_order',
    invoiceNumber: purchaseOrder.poNumber || purchaseOrder.invoiceNumber || 'purchase_order',
    issueDate: purchaseOrder.orderDate || purchaseOrder.issueDate || purchaseOrder.createdAt || new Date(),
    dueDate: purchaseOrder.expectedDate || purchaseOrder.dueDate || null,
    currency: purchaseOrder.currency || tenant?.settings?.currency || 'SAR',
    transactionType: 'Purchase Order',
    flow: 'purchase',
    lineItems,
    // Letterhead = tenant issuing the PO; counterparty box = supplier
    seller: {
      name: business.legalNameEn || business.legalNameAr || tenant?.name || '',
      nameEn: business.legalNameEn || tenant?.name || '',
      nameAr: business.legalNameAr || '',
      vatNumber: business.vatNumber || '',
      crNumber: business.crNumber || business.commercialRegistration?.crNumber || '',
      contactPhone: business.contactPhone || '',
      contactEmail: business.contactEmail || '',
      address: business.address || {},
    },
    buyer: {
      name: supplier.nameEn || supplier.name || supplier.nameAr || '',
      nameEn: supplier.nameEn || supplier.name || '',
      nameAr: supplier.nameAr || '',
      vatNumber: supplier.vatNumber || '',
      crNumber: supplier.crNumber || '',
      contactPhone: supplier.phone || supplier.contactPhone || '',
      contactEmail: supplier.email || supplier.contactEmail || '',
      address: supplier.address || {},
    },
    subtotal: purchaseOrder.subtotal,
    totalTax: purchaseOrder.totalTax,
    grandTotal: purchaseOrder.grandTotal,
  }
}

export const downloadPurchaseOrderPdf = async ({ purchaseOrder, language = 'en', tenant }) => {
  const mapped = mapPurchaseOrderForPdf(purchaseOrder, tenant)
  const result = await generateInvoicePdf({ invoice: mapped, language, tenant, output: 'save', documentType: 'purchase_order' })
  if (!result) throw new Error('Failed to generate purchase order PDF')
  return result
}

export const printPurchaseOrderPdf = async ({ purchaseOrder, language = 'en', tenant, sourceElement = null }) => {
  const mapped = mapPurchaseOrderForPdf(purchaseOrder, tenant)
  try {
    const snapshotOk = await printInvoiceSnapshot({
      invoice: mapped,
      language,
      tenant,
      sourceElement,
      documentType: 'purchase_order',
    })
    if (snapshotOk) return true
  } catch (error) {
    console.warn('[printPurchaseOrderPdf] snapshot print failed, using PDF blob', error)
  }

  const blob = await generateInvoicePdf({ invoice: mapped, language, tenant, output: 'blob', documentType: 'purchase_order' })
  if (!blob) throw new Error('Failed to generate purchase order PDF')
  const title = resolveDocumentNumber(mapped, 'purchase_order')
  const printed = await printPdfBlob(blob, title)
  if (!printed) throw new Error('Failed to open print dialog')
  return true
}

export function mapVendorBillForPdf(purchaseOrder = {}, tenant = null) {
  const business = tenant?.business || {}
  const supplier = purchaseOrder.supplierId && typeof purchaseOrder.supplierId === 'object'
    ? purchaseOrder.supplierId
    : {}

  const rawLines = Array.isArray(purchaseOrder.lineItems) ? purchaseOrder.lineItems : []
  const hasReceived = rawLines.some(li => Number(li?.quantityReceived || 0) > 0)
  
  let subtotal = 0
  let totalTax = 0

  const lineItems = rawLines
    .map((li) => {
      const product = li?.productId && typeof li.productId === 'object' ? li.productId : null
      const productName = li?.manualName || product?.nameEn || product?.name || li?.description || 'Item'
      const productNameAr = li?.manualNameAr || product?.nameAr || ''
      const qty = hasReceived ? Number(li?.quantityReceived ?? 0) : Number(li?.quantityOrdered ?? li?.quantity ?? 0)
      if (hasReceived && qty <= 0) return null
      const unitPrice = Number(li?.unitCost ?? li?.unitPrice ?? 0)
      const taxRate = Number(li?.taxRate ?? 15)
      const lineSub = qty * unitPrice
      const lineTax = lineSub * (taxRate / 100)
      subtotal += lineSub
      totalTax += lineTax

      return {
        productId: product?._id || (typeof li?.productId === 'string' ? li.productId : '') || '',
        productName,
        productNameAr,
        description: li?.description || '',
        unitCode: li?.uom || li?.unitCode || product?.unitOfMeasure || 'PCE',
        quantity: qty,
        unitPrice,
        taxRate,
        lineSubtotal: lineSub,
        lineTax,
        lineTotal: lineSub + lineTax,
        productType: li?.productType || product?.productType || 'goods',
      }
    })
    .filter(Boolean)

  const grandTotal = subtotal + totalTax
  const billNum = `BILL-${purchaseOrder.poNumber || 'PO'}`

  return {
    ...purchaseOrder,
    billNumber: billNum,
    poNumber: purchaseOrder.poNumber,
    invoiceNumber: billNum,
    issueDate: purchaseOrder.orderDate || purchaseOrder.createdAt || new Date(),
    dueDate: purchaseOrder.expectedDate || null,
    currency: purchaseOrder.currency || tenant?.settings?.currency || 'SAR',
    transactionType: 'Vendor Bill',
    flow: 'purchase',
    lineItems,
    seller: {
      name: supplier.nameEn || supplier.name || supplier.nameAr || 'Supplier',
      nameEn: supplier.nameEn || supplier.name || '',
      nameAr: supplier.nameAr || '',
      vatNumber: supplier.vatNumber || '',
      crNumber: supplier.crNumber || '',
      contactPhone: supplier.phone || supplier.contactPhone || '',
      contactEmail: supplier.email || supplier.contactEmail || '',
      address: supplier.address || {},
    },
    buyer: {
      name: business.legalNameEn || business.legalNameAr || tenant?.name || '',
      nameEn: business.legalNameEn || tenant?.name || '',
      nameAr: business.legalNameAr || '',
      vatNumber: business.vatNumber || '',
      crNumber: business.crNumber || business.commercialRegistration?.crNumber || '',
      contactPhone: business.contactPhone || '',
      contactEmail: business.contactEmail || '',
      address: business.address || {},
    },
    subtotal,
    totalTax,
    grandTotal,
  }
}

export const downloadVendorBillPdf = async ({ purchaseOrder, language = 'en', tenant }) => {
  const mapped = mapVendorBillForPdf(purchaseOrder, tenant)
  const result = await generateInvoicePdf({ invoice: mapped, language, tenant, output: 'save', documentType: 'vendor_bill' })
  if (!result) throw new Error('Failed to generate vendor bill PDF')
  return result
}

export const printVendorBillPdf = async ({ purchaseOrder, language = 'en', tenant, sourceElement = null }) => {
  const mapped = mapVendorBillForPdf(purchaseOrder, tenant)
  try {
    const snapshotOk = await printInvoiceSnapshot({
      invoice: mapped,
      language,
      tenant,
      sourceElement,
      documentType: 'vendor_bill',
    })
    if (snapshotOk) return true
  } catch (error) {
    console.warn('[printVendorBillPdf] snapshot print failed, using PDF blob', error)
  }

  const blob = await generateInvoicePdf({ invoice: mapped, language, tenant, output: 'blob', documentType: 'vendor_bill' })
  if (!blob) throw new Error('Failed to generate vendor bill PDF')
  const title = resolveDocumentNumber(mapped, 'vendor_bill')
  const printed = await printPdfBlob(blob, title)
  if (!printed) throw new Error('Failed to open print dialog')
  return true
}
