import { useSelector } from 'react-redux'
import { Printer } from 'lucide-react'
import toast from 'react-hot-toast'
import QRCode from 'qrcode'
import api from '../../lib/api'
import { formatInvError } from '../../lib/invError'
import { generateZatcaQrValue } from '../../lib/zatcaQr'

function layoutForOpCode(code) {
  if (code === 'incoming') return 'goods_receipt'
  if (code === 'outgoing') return 'delivery_note'
  if (code === 'internal') return 'internal_transfer'
  if (code === 'manufacturing') return 'picking_list'
  if (code === 'pos') return 'delivery_note'
  return 'picking_list'
}

/**
 * Server PDF (primary) + ZATCA-aware browser print (secondary).
 */
export function TransferPrintButton({ transfer, code, settingsHints, buttonLabel, primary }) {
  const { language } = useSelector((s) => s.ui)
  const { tenant } = useSelector((s) => s.auth)
  const ar = language === 'ar'
  const showLots = code !== 'outgoing'
    ? true
    : settingsHints?.showLotsOnDeliverySlips !== false
  const label = buttonLabel
    || (code === 'internal'
      ? (ar ? 'طباعة سند التحويل' : 'Print Transfer Slip')
      : code === 'outgoing'
        ? (ar ? 'طباعة سند التسليم' : 'Print Delivery Slip')
        : (ar ? 'PDF' : 'PDF'))

  const printServerPdf = async () => {
    if (!transfer?._id) {
      toast.error(ar ? 'احفظ التحويل أولاً' : 'Save the transfer first')
      return
    }
    try {
      const layout = layoutForOpCode(code)
      const res = await api.post('/stock/print', {
        layout,
        transferId: transfer._id,
        lang: ar ? 'ar' : 'en',
        showPrices: !!settingsHints?.printShowPricesOnDelivery,
      }, { responseType: 'blob' })
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = `${layout}-${transfer.name || 'doc'}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      toast.error(formatInvError(e, language) || (ar ? 'فشل الطباعة' : 'Print failed'))
    }
  }

  const print = async () => {
    try {
      const vat = tenant?.business?.vatNumber || tenant?.vatNumber || tenant?.zatca?.vatNumber || '—'
      const companyEn = tenant?.business?.legalNameEn || tenant?.nameEn || tenant?.name || 'Company'
      const companyAr = tenant?.business?.legalNameAr || tenant?.nameAr || companyEn
      const lines = transfer?.moves || []
      const moveLines = transfer?.moveLines || []
      const title = code === 'incoming'
        ? { en: 'Goods Receipt', ar: 'إيصال استلام' }
        : code === 'outgoing'
          ? { en: 'Delivery Slip', ar: 'سند تسليم' }
          : { en: 'Internal Transfer', ar: 'تحويل داخلي' }

      let printCtx = null
      if (transfer?._id) {
        try {
          printCtx = await api.get(`/stock/transfers/${transfer._id}/print-context`).then((r) => r.data)
        } catch {
          printCtx = null
        }
      }

      let zatcaPayload = printCtx?.zatcaQrPayload || null
      if (!zatcaPayload && printCtx?.totals && printCtx?.seller?.vatNumber) {
        zatcaPayload = generateZatcaQrValue({
          sellerName: printCtx.seller.name || companyAr || companyEn,
          vatNumber: printCtx.seller.vatNumber,
          timestamp: printCtx.linked?.invoice?.issueDate || transfer?.scheduledDate || new Date(),
          totalWithVat: printCtx.totals.totalWithVat,
          vatTotal: printCtx.totals.vatTotal,
        })
      }

      let qrHtml = '<div class="qr">ZATCA QR<br/>—</div>'
      if (zatcaPayload) {
        try {
          const dataUrl = await QRCode.toDataURL(zatcaPayload, { width: 120, margin: 1, errorCorrectionLevel: 'M' })
          const srcLabel = printCtx?.qrSource === 'invoice_stored' || printCtx?.qrSource === 'invoice_phase2'
            ? (ar ? 'من الفاتورة' : 'from invoice')
            : (ar ? 'Phase-1' : 'Phase-1')
          qrHtml = `<div class="qr-wrap"><img src="${dataUrl}" alt="ZATCA QR" width="96" height="96"/><div class="qr-cap">ZATCA · ${srcLabel}</div></div>`
        } catch {
          qrHtml = '<div class="qr">ZATCA QR<br/>error</div>'
        }
      } else if (printCtx?.linked?.invoice) {
        qrHtml = `<div class="qr">${ar ? 'فاتورة بلا QR<br/>تحقق من الرقم الضريبي' : 'Invoice<br/>no valid QR'}</div>`
      } else {
        qrHtml = `<div class="qr">${ar ? 'اربط فاتورة<br/>للرمز الضريبي' : 'Link invoice<br/>for ZATCA QR'}</div>`
      }

      const linkedBits = []
      if (printCtx?.linked?.invoice?.invoiceNumber) {
        linkedBits.push(`Invoice: ${printCtx.linked.invoice.invoiceNumber}`)
      }
      if (printCtx?.linked?.deliveryNote?.dnNumber) {
        linkedBits.push(`DN: ${printCtx.linked.deliveryNote.dnNumber}`)
      }
      if (printCtx?.linked?.grn?.grnNumber) {
        linkedBits.push(`GRN: ${printCtx.linked.grn.grnNumber}`)
      }
      if (printCtx?.totals) {
        linkedBits.push(`Total: ${Number(printCtx.totals.totalWithVat).toFixed(2)} (VAT ${Number(printCtx.totals.vatTotal).toFixed(2)})`)
      }

      const moveRows = (lines || []).flatMap((m) => {
        const mls = moveLines.filter((l) => String(l.moveId) === String(m._id))
        const fromMove = m.moveLines || m.lines || []
        const use = mls.length ? mls : fromMove
        if (use.length) {
          return use.map((l) => ({
            product: l.productId?.nameEn || m.productId?.nameEn || '—',
            productAr: l.productId?.nameAr || m.productId?.nameAr || '',
            qty: l.quantityInProductUom || l.quantity || m.quantityDone || m.productUomQty || m.doneQty || m.demandQty || '',
            lot: l.lotId?.name || l.lotName || '',
            variant: m.variantId?.name || '',
          }))
        }
        return [{
          product: m.productId?.nameEn || '—',
          productAr: m.productId?.nameAr || '',
          qty: m.quantityDone || m.productUomQty || m.doneQty || m.demandQty || '',
          lot: '',
          variant: m.variantId?.name || '',
        }]
      })

      const lotHeader = showLots ? '<th>Lot / دفعة</th>' : ''
      const displayVat = printCtx?.seller?.vatNumber || vat
      const displayCoEn = printCtx?.seller?.nameEn || companyEn
      const displayCoAr = printCtx?.seller?.nameAr || companyAr
      const partnerName = printCtx?.partner?.name
        || printCtx?.partner?.nameEn
        || printCtx?.linked?.deliveryNote?.customerName
        || transfer?.partner?.name
        || transfer?.partner?.nameEn
        || transfer?.partner?.nameAr
        || transfer?.partnerName
        || ''
      const partnerLabel = code === 'incoming'
        ? (ar ? 'المورد' : 'Supplier')
        : code === 'outgoing'
          ? (ar ? 'العميل' : 'Customer')
          : (ar ? 'الشريك' : 'Partner')

      const w = window.open('', '_blank', 'noopener,noreferrer,width=900,height=700')
      if (!w) return
      w.document.write(`<!DOCTYPE html><html lang="${ar ? 'ar' : 'en'}" dir="${ar ? 'rtl' : 'ltr'}">
<head>
<meta charset="utf-8"/>
<title>${title.en} / ${title.ar} — ${transfer?.name || ''}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;600&family=Source+Sans+3:wght@400;600&display=swap');
  * { box-sizing: border-box; }
  body { font-family: ${ar ? "'IBM Plex Sans Arabic'" : "'Source Sans 3'"}, sans-serif; margin: 24px; color: #0f172a; }
  .hdr { display: flex; justify-content: space-between; gap: 16px; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px; }
  .co { font-size: 20px; font-weight: 600; }
  .co-ar { font-size: 18px; direction: rtl; }
  .meta { font-size: 12px; color: #475569; text-align: end; }
  h1 { font-size: 16px; margin: 0 0 4px; }
  table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 13px; }
  th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: start; }
  th { background: #f1f5f9; }
  .qr { width: 96px; height: 96px; border: 1px dashed #94a3b8; display: flex; align-items: center; justify-content: center; font-size: 10px; color: #64748b; text-align: center; }
  .qr-wrap { text-align: center; }
  .qr-cap { font-size: 9px; color: #64748b; margin-top: 4px; }
  .foot { margin-top: 24px; display: flex; justify-content: space-between; align-items: end; font-size: 12px; color: #475569; gap: 16px; }
  .linked { margin-top: 6px; font-size: 11px; color: #64748b; }
  @media print { body { margin: 12mm; } .noprint { display: none; } }
</style>
</head>
<body>
  <div class="hdr">
    <div>
      <div class="co">${escapeHtml(displayCoEn)}</div>
      <div class="co-ar">${escapeHtml(displayCoAr)}</div>
      <div style="font-size:12px;margin-top:6px">VAT / الرقم الضريبي: <strong>${escapeHtml(displayVat)}</strong></div>
    </div>
    <div class="meta">
      <h1>${title.en}</h1>
      <div dir="rtl">${title.ar}</div>
      <div style="margin-top:8px">${escapeHtml(transfer?.name || '')}</div>
      <div>${transfer?.scheduledDate ? new Date(transfer.scheduledDate).toLocaleDateString() : new Date().toLocaleDateString()}</div>
      <div>${partnerName ? `${escapeHtml(partnerLabel)}: ${escapeHtml(partnerName)}` : ''}</div>
    </div>
  </div>
  <table>
    <thead>
      <tr>
        <th>Product / المنتج</th>
        ${lotHeader}
        <th>Qty / الكمية</th>
      </tr>
    </thead>
    <tbody>
      ${moveRows.map((r) => `<tr>
        <td>${escapeHtml(r.product)}${r.variant ? ` <span style="color:#64748b">(${escapeHtml(r.variant)})</span>` : ''}${r.productAr ? `<div dir="rtl" style="font-size:11px;color:#64748b">${escapeHtml(r.productAr)}</div>` : ''}</td>
        ${showLots ? `<td>${escapeHtml(r.lot || '—')}</td>` : ''}
        <td>${escapeHtml(String(r.qty))}</td>
      </tr>`).join('') || `<tr><td colspan="${showLots ? 3 : 2}">—</td></tr>`}
    </tbody>
  </table>
  <div class="foot">
    <div>
      <div>Origin: ${escapeHtml(transfer?.origin || '—')}</div>
      <div>Signature: ${transfer?.signature ? '✓' : '____________'}</div>
      ${transfer?.carrierId || transfer?.shippingCost || transfer?.trackingReference
        ? `<div class="linked">Carrier: ${escapeHtml(transfer?.carrierId?.name || '—')} · Ship: ${escapeHtml(String(transfer?.shippingCost ?? '—'))} · Track: ${escapeHtml(transfer?.trackingReference || '—')}</div>`
        : ''}
      ${linkedBits.length ? `<div class="linked">${escapeHtml(linkedBits.join(' · '))}</div>` : ''}
    </div>
    ${qrHtml}
  </div>
  <p class="noprint" style="margin-top:16px"><button onclick="window.print()">Print</button></p>
  <script>setTimeout(() => window.print(), 400)</script>
</body></html>`)
      w.document.close()
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <div className="inline-flex items-center gap-1">
      <button
        type="button"
        className={primary ? 'btn btn-secondary text-sm' : 'btn btn-ghost btn-sm'}
        onClick={printServerPdf}
        title={ar ? 'PDF من الخادم' : 'Server PDF'}
      >
        <Printer className="h-4 w-4" />
        {label}
      </button>
      {code !== 'internal' && code !== 'incoming' && code !== 'manufacturing' && code !== 'pos' && (
        <button type="button" className="btn btn-ghost btn-sm text-xs" onClick={print} title={ar ? 'طباعة متصفح + زاتكا' : 'Browser + ZATCA'}>
          {ar ? 'زاتكا' : 'ZATCA'}
        </button>
      )}
    </div>
  )
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
