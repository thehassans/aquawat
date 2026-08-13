import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import jsPDF from 'jspdf'
import MasterReportDocumentPreview from '../components/reports/MasterReportDocumentPreview'
import { printPdfBlob } from './invoicePdf'

// ─── Image Pre-loader ─────────────────────────────────────────────────────────

const waitForElementImages = async (element) => {
  if (!element || typeof window === 'undefined') return
  const images = Array.from(element.querySelectorAll('img'))
  if (!images.length) return

  await Promise.all(
    images.map((img) => {
      if (img.complete) return Promise.resolve()
      return new Promise((resolve) => {
        img.onload = () => resolve()
        img.onerror = () => resolve()
      })
    })
  )
}

// ─── Font Pre-loader ──────────────────────────────────────────────────────────

const ensureDocumentFontsLoaded = async () => {
  if (typeof document === 'undefined' || !document?.fonts?.load) return
  try {
    await Promise.allSettled([
      document.fonts.load('400 16px "Almarai"'),
      document.fonts.load('700 16px "Almarai"'),
      document.fonts.load('400 16px "Inter"'),
      document.fonts.load('700 16px "Inter"'),
    ])
  } catch {
    // ignore if fonts fail
  }
}

// ─── Snapshot Element Builder ─────────────────────────────────────────────────

const buildReportSnapshotElement = async ({ reportType, report, tenant, language = 'en' }) => {
  if (typeof document === 'undefined') return null

  await ensureDocumentFontsLoaded()

  const host = document.createElement('div')
  host.style.position = 'fixed'
  host.style.left = '-20000px'
  host.style.top = '0'
  host.style.width = '1120px'
  host.style.padding = '0'
  host.style.margin = '0'
  host.style.background = '#ffffff'
  host.style.zIndex = '-1'
  host.style.pointerEvents = 'none'

  const previewElement = createElement(MasterReportDocumentPreview, {
    reportType,
    report,
    tenant,
    language,
  })

  const snapshotMarkup = renderToStaticMarkup(previewElement)

  host.innerHTML = `
    <style>
      @font-face {
        font-family: "Almarai";
        src: url("/fonts/Almarai/Almarai-Regular.ttf") format("truetype");
        font-weight: 400;
        font-style: normal;
      }
      @font-face {
        font-family: "Almarai";
        src: url("/fonts/Almarai/Almarai-Bold.ttf") format("truetype");
        font-weight: 700;
        font-style: normal;
      }
      * {
        box-sizing: border-box;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      #master-report-preview-canvas {
        min-height: 0 !important;
        width: 1120px !important;
      }
    </style>
    ${snapshotMarkup}
  `

  document.body.appendChild(host)
  await waitForElementImages(host)
  await new Promise((resolve) => window.requestAnimationFrame(() => resolve()))
  return host
}

const REPORT_SNAPSHOT_STYLE = `
  @font-face {
    font-family: "Almarai";
    src: url("/fonts/Almarai/Almarai-Regular.ttf") format("truetype");
    font-weight: 400;
    font-style: normal;
  }
  @font-face {
    font-family: "Almarai";
    src: url("/fonts/Almarai/Almarai-Bold.ttf") format("truetype");
    font-weight: 700;
    font-style: normal;
  }
  * {
    box-sizing: border-box;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  #master-report-preview-canvas {
    min-height: 0 !important;
    width: 1120px !important;
  }
`

const sanitizeFilePart = (value) =>
  String(value || 'Report')
    .replace(/[^A-Za-z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60) || 'Report'

const resolveReportFileName = ({ reportType, tenant }) => {
  const dateStr = new Date().toISOString().slice(0, 10)
  const company = sanitizeFilePart(tenant?.business?.legalNameEn || tenant?.name || 'Maqder')
  const type = sanitizeFilePart(reportType || 'Official')
  return `${company}_${type}_${dateStr}.pdf`
}

const parseHexColor = (hex, fallback = { r: 30, g: 58, b: 138 }) => {
  const raw = String(hex || '').trim().replace('#', '')
  if (raw.length === 3) {
    const r = parseInt(raw[0] + raw[0], 16)
    const g = parseInt(raw[1] + raw[1], 16)
    const b = parseInt(raw[2] + raw[2], 16)
    if ([r, g, b].some((n) => Number.isNaN(n))) return fallback
    return { r, g, b }
  }
  if (raw.length !== 6) return fallback
  const r = parseInt(raw.slice(0, 2), 16)
  const g = parseInt(raw.slice(2, 4), 16)
  const b = parseInt(raw.slice(4, 6), 16)
  if ([r, g, b].some((n) => Number.isNaN(n))) return fallback
  return { r, g, b }
}

const buildMasterReportPdfDoc = async ({ reportType, report, tenant, language = 'en' }) => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return null

  let host = null
  try {
    host = await buildReportSnapshotElement({ reportType, report, tenant, language })
    if (!host) return null

    const targetElement = host.querySelector('#master-report-preview-canvas') || host.lastElementChild || host
    const html2canvasModule = await import('html2canvas')
    const html2canvas = html2canvasModule?.default || html2canvasModule

    const canvas = await html2canvas(targetElement, {
      backgroundColor: '#ffffff',
      scale: 2,
      useCORS: true,
      logging: false,
    })

    if (!canvas || canvas.width === 0 || canvas.height === 0) return null

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true,
    })

    const pageW = doc.internal.pageSize.getWidth()
    const pageH = doc.internal.pageSize.getHeight()
    const marginX = 10
    const marginTop = 8
    const footerH = 10
    const usableW = pageW - marginX * 2
    const usableH = pageH - marginTop - footerH
    const scale = usableW / canvas.width
    const pageCanvasHeight = Math.max(1, Math.floor(usableH / scale))
    const brand = parseHexColor(tenant?.branding?.primaryColor)
    const company = tenant?.business?.legalNameEn || tenant?.name || 'Maqder ERP'

    let offsetY = 0
    let pageIndex = 0

    while (offsetY < canvas.height) {
      const sliceHeight = Math.min(pageCanvasHeight, canvas.height - offsetY)
      const pageCanvas = document.createElement('canvas')
      pageCanvas.width = canvas.width
      pageCanvas.height = sliceHeight
      const pageCtx = pageCanvas.getContext('2d')
      if (!pageCtx) break

      pageCtx.fillStyle = '#FFFFFF'
      pageCtx.fillRect(0, 0, pageCanvas.width, pageCanvas.height)
      pageCtx.drawImage(canvas, 0, offsetY, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight)

      if (pageIndex > 0) doc.addPage()

      doc.addImage(
        pageCanvas.toDataURL('image/png'),
        'PNG',
        marginX,
        marginTop,
        usableW,
        sliceHeight * scale,
        undefined,
        'FAST'
      )

      offsetY += sliceHeight
      pageIndex += 1
    }

    const totalPages = doc.getNumberOfPages()
    for (let i = 1; i <= totalPages; i += 1) {
      doc.setPage(i)
      doc.setFillColor(brand.r, brand.g, brand.b)
      doc.rect(0, 0, pageW, 1.4, 'F')
      doc.setDrawColor(226, 232, 240)
      doc.setLineWidth(0.25)
      doc.line(marginX, pageH - 8, pageW - marginX, pageH - 8)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7.2)
      doc.setTextColor(100, 116, 139)
      doc.text('CONFIDENTIAL · MANAGEMENT USE ONLY', marginX, pageH - 4.5)
      doc.text(String(company).slice(0, 42), pageW / 2, pageH - 4.5, { align: 'center' })
      doc.text(`Page ${i} of ${totalPages}`, pageW - marginX, pageH - 4.5, { align: 'right' })
    }

    return doc
  } finally {
    if (host && host.parentNode) host.parentNode.removeChild(host)
  }
}

export async function buildMasterReportPdfBlob(args) {
  const doc = await buildMasterReportPdfDoc(args)
  if (!doc) return null
  return doc.output('blob')
}

export async function downloadMasterReportPdf(args) {
  try {
    const doc = await buildMasterReportPdfDoc(args)
    if (!doc) return false
    doc.save(resolveReportFileName(args))
    return true
  } catch (err) {
    console.error('[masterReportPdf] PDF generation failed:', err)
    return false
  }
}

const printReportHtmlWindow = async ({ reportType, report, tenant, language = 'en' }) => {
  const host = await buildReportSnapshotElement({ reportType, report, tenant, language })
  if (!host) return false
  const iframe = document.createElement('iframe')
  iframe.setAttribute('aria-hidden', 'true')
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'
  document.body.appendChild(iframe)
  try {
    const source = host.querySelector('#master-report-preview-canvas')
    const idoc = iframe.contentDocument
    if (!idoc || !source) return false
    const title = `${tenant?.business?.legalNameEn || tenant?.name || 'Official Report'} — ${reportType || 'Statement'}`
    idoc.open()
    idoc.write('<!DOCTYPE html><html><head><meta charset="utf-8" /></head><body></body></html>')
    idoc.close()
    idoc.title = title
    document.querySelectorAll('style, link[rel="stylesheet"]').forEach((node) => {
      idoc.head.appendChild(node.cloneNode(true))
    })
    const pageStyle = idoc.createElement('style')
    pageStyle.textContent = `
      ${REPORT_SNAPSHOT_STYLE}
      @page { size: A4 portrait; margin: 10mm 12mm 14mm; }
      html, body { margin: 0; background: #fff; }
      #master-report-preview-canvas { width: 100% !important; min-height: 0 !important; }
    `
    idoc.head.appendChild(pageStyle)
    idoc.body.appendChild(source.cloneNode(true))
    await waitForElementImages(idoc.body)
    await new Promise((resolve) => window.setTimeout(resolve, 350))
    iframe.contentWindow?.focus()
    iframe.contentWindow?.print()
    return true
  } finally {
    window.setTimeout(() => {
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe)
    }, 1500)
    if (host.parentNode) host.parentNode.removeChild(host)
  }
}

export async function printMasterReport(args) {
  try {
    const blob = await buildMasterReportPdfBlob(args)
    if (blob) {
      const printed = await printPdfBlob(blob, resolveReportFileName(args))
      if (printed) return true
    }
  } catch (err) {
    console.warn('[masterReportPdf] PDF print failed, using document window', err)
  }
  return printReportHtmlWindow(args)
}

export async function exportReportToPdf(args) {
  return downloadMasterReportPdf(args)
}
