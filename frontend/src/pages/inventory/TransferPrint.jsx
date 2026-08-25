import { useSelector } from 'react-redux'
import { Printer } from 'lucide-react'

/**
 * ZATCA-aware bilingual print for receipts / delivery slips.
 * VAT number + QR placeholder for invoicing module to fill later.
 */
export function TransferPrintButton({ transfer, code }) {
  const { language } = useSelector((s) => s.ui)
  const { tenant } = useSelector((s) => s.auth)
  const ar = language === 'ar'

  const print = () => {
    try {
      const vat = tenant?.business?.vatNumber || tenant?.vatNumber || tenant?.zatca?.vatNumber || '—'
      const companyEn = tenant?.business?.legalNameEn || tenant?.nameEn || tenant?.name || 'Company'
      const companyAr = tenant?.business?.legalNameAr || tenant?.nameAr || companyEn
      const lines = transfer?.moves || []
      const title = code === 'incoming'
        ? { en: 'Goods Receipt', ar: 'إيصال استلام' }
        : code === 'outgoing'
          ? { en: 'Delivery Slip', ar: 'سند تسليم' }
          : { en: 'Internal Transfer', ar: 'تحويل داخلي' }

      const moveRows = (lines || []).flatMap((m) => {
        const mls = m.moveLines || m.lines || []
        if (mls.length) {
          return mls.map((l) => ({
            product: l.productId?.nameEn || m.productId?.nameEn || '—',
            productAr: l.productId?.nameAr || m.productId?.nameAr || '',
            qty: l.quantityInProductUom || l.quantity || m.quantityDone || m.productUomQty || '',
            lot: l.lotId?.name || l.lotName || '',
          }))
        }
        return [{
          product: m.productId?.nameEn || '—',
          productAr: m.productId?.nameAr || '',
          qty: m.quantityDone || m.productUomQty || '',
          lot: '',
        }]
      })

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
  .foot { margin-top: 24px; display: flex; justify-content: space-between; align-items: end; font-size: 12px; color: #475569; }
  @media print { body { margin: 12mm; } .noprint { display: none; } }
</style>
</head>
<body>
  <div class="hdr">
    <div>
      <div class="co">${escapeHtml(companyEn)}</div>
      <div class="co-ar">${escapeHtml(companyAr)}</div>
      <div style="font-size:12px;margin-top:6px">VAT / الرقم الضريبي: <strong>${escapeHtml(vat)}</strong></div>
    </div>
    <div class="meta">
      <h1>${title.en}</h1>
      <div dir="rtl">${title.ar}</div>
      <div style="margin-top:8px">${escapeHtml(transfer?.name || '')}</div>
      <div>${transfer?.scheduledDate ? new Date(transfer.scheduledDate).toLocaleDateString() : new Date().toLocaleDateString()}</div>
      <div>${escapeHtml(transfer?.partnerId?.name || transfer?.partnerName || '')}</div>
    </div>
  </div>
  <table>
    <thead>
      <tr>
        <th>Product / المنتج</th>
        <th>Lot / دفعة</th>
        <th>Qty / الكمية</th>
      </tr>
    </thead>
    <tbody>
      ${moveRows.map((r) => `<tr>
        <td>${escapeHtml(r.product)}${r.productAr ? `<div dir="rtl" style="font-size:11px;color:#64748b">${escapeHtml(r.productAr)}</div>` : ''}</td>
        <td>${escapeHtml(r.lot || '—')}</td>
        <td>${escapeHtml(String(r.qty))}</td>
      </tr>`).join('') || '<tr><td colspan="3">—</td></tr>'}
    </tbody>
  </table>
  <div class="foot">
    <div>
      <div>Origin: ${escapeHtml(transfer?.origin || '—')}</div>
      <div>Signature: ${transfer?.signature ? '✓' : '____________'}</div>
    </div>
    <div class="qr">ZATCA QR<br/>placeholder</div>
  </div>
  <p class="noprint" style="margin-top:16px"><button onclick="window.print()">Print</button></p>
  <script>setTimeout(() => window.print(), 300)</script>
</body></html>`)
      w.document.close()
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <button type="button" className="btn btn-ghost btn-sm" onClick={print}>
      <Printer className="h-4 w-4" />
      {ar ? 'طباعة' : 'Print'}
    </button>
  )
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
