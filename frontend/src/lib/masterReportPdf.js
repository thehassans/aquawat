import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import jsPDF from 'jspdf'
import MasterReportDocumentPreview from '../components/reports/MasterReportDocumentPreview'

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
    </style>
    ${snapshotMarkup}
  `

  document.body.appendChild(host)
  await waitForElementImages(host)
  await new Promise((resolve) => window.requestAnimationFrame(() => resolve()))
  return host
}

// ─── PDF Canvas Slicing & Builder ─────────────────────────────────────────────

export async function downloadMasterReportPdf({ reportType, report, tenant, language = 'en' }) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false

  let host = null
  try {
    host = await buildReportSnapshotElement({ reportType, report, tenant, language })
    if (!host) return false

    const targetElement = host.firstElementChild || host

    const html2canvasModule = await import('html2canvas')
    const html2canvas = html2canvasModule?.default || html2canvasModule

    const canvas = await html2canvas(targetElement, {
      backgroundColor: '#ffffff',
      scale: 2,
      useCORS: true,
      logging: false,
    })

    if (!canvas || canvas.width === 0 || canvas.height === 0) return false

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true,
    })

    const pageW = doc.internal.pageSize.getWidth() // 210mm
    const pageH = doc.internal.pageSize.getHeight() // 297mm
    const margin = 10 // 10mm margin
    const usableW = pageW - margin * 2 // 190mm
    const usableH = pageH - margin * 2 // 277mm

    const scale = usableW / canvas.width
    const pageCanvasHeight = Math.max(1, Math.floor(usableH / scale))

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
      pageCtx.drawImage(
        canvas,
        0,
        offsetY,
        canvas.width,
        sliceHeight,
        0,
        0,
        canvas.width,
        sliceHeight
      )

      if (pageIndex > 0) {
        doc.addPage()
      }

      doc.addImage(
        pageCanvas.toDataURL('image/png'),
        'PNG',
        margin,
        margin,
        usableW,
        sliceHeight * scale,
        undefined,
        'FAST'
      )

      offsetY += sliceHeight
      pageIndex += 1
    }

    const dateStr = new Date().toISOString().slice(0, 10)
    const fileName = `${reportType}_Report_${dateStr}.pdf`
    doc.save(fileName)
    return true
  } catch (err) {
    console.error('[masterReportPdf] PDF generation failed:', err)
    return false
  } finally {
    if (host && host.parentNode) {
      host.parentNode.removeChild(host)
    }
  }
}

// ─── Direct Compatibility Dispatcher ──────────────────────────────────────────

export async function exportReportToPdf(args) {
  return await downloadMasterReportPdf(args)
}
