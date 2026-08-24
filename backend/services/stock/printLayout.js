/**
 * Build a printable HTML slip for a stock picking.
 */
export function buildPickingPrintHtml({ picking, moves, moveLines, printedAt }) {
  const opName = picking.operationTypeId?.name || picking.operationTypeId?.code || '';
  const rows = (moves || []).map((m) => {
    const productLabel = m.productId?.defaultCode
      || m.productId?.name
      || String(m.productId?._id || m.productId || '');
    const lots = (moveLines || [])
      .filter((l) => String(l.moveId) === String(m._id))
      .map((l) => l.lotName || '')
      .filter(Boolean)
      .join(', ');
    return `<tr>
      <td>${escapeHtml(productLabel)}</td>
      <td>${escapeHtml(String(m.productUomQty ?? ''))}</td>
      <td>${escapeHtml(String(m.quantity ?? ''))}</td>
      <td>${escapeHtml(lots || '—')}</td>
      <td>${escapeHtml(m.state || '')}</td>
    </tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(picking.name || 'Transfer')}</title>
  <style>
    body { font-family: Georgia, "Times New Roman", serif; color: #0f172a; margin: 32px; }
    h1 { font-size: 22px; margin: 0 0 4px; }
    .meta { color: #64748b; font-size: 13px; margin-bottom: 24px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { border-bottom: 1px solid #e2e8f0; padding: 8px 6px; text-align: left; }
    th { font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: #64748b; }
    @media print { body { margin: 12mm; } .noprint { display: none; } }
  </style>
</head>
<body>
  <button class="noprint" onclick="window.print()" style="margin-bottom:16px">Print</button>
  <h1>${escapeHtml(picking.name || 'Transfer')}</h1>
  <div class="meta">
    ${escapeHtml(opName)} · ${escapeHtml(picking.state || '')}
    ${picking.origin ? ` · Origin: ${escapeHtml(picking.origin)}` : ''}
    <br/>Printed ${escapeHtml(printedAt || new Date().toISOString())}
  </div>
  <table>
    <thead>
      <tr><th>Product</th><th>Demand</th><th>Done</th><th>Lot</th><th>State</th></tr>
    </thead>
    <tbody>
      ${rows || '<tr><td colspan="5">No operations</td></tr>'}
    </tbody>
  </table>
</body>
</html>`;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
