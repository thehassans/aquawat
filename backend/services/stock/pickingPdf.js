/**
 * Build a picking PDF buffer with jsPDF + autotable (same stack as report PDFs).
 */
export async function buildPickingPdfBuffer({
  picking,
  moves,
  moveLines,
  printedAt,
  showLots = true,
  partnerLabel = '',
}) {
  const { jsPDF } = await import('jspdf');
  await import('jspdf-autotable');

  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const opName = picking.operationTypeId?.name || picking.operationTypeId?.code || '';
  const src = picking.locationId?.completeName || picking.locationId?.name || '';
  const dest = picking.locationDestId?.completeName || picking.locationDestId?.name || '';

  doc.setFillColor(20, 184, 166);
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(15, 23, 42);
  doc.text(String(picking.name || 'Transfer'), 40, 40);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(100);
  let y = 58;
  const meta = [
    `${opName} · ${picking.state || ''}`,
    picking.origin ? `Origin: ${picking.origin}` : null,
    partnerLabel ? `Partner: ${partnerLabel}` : null,
    (src || dest) ? `${src || '—'} → ${dest || '—'}` : null,
    picking.scheduledDate ? `Scheduled: ${new Date(picking.scheduledDate).toLocaleString()}` : null,
    `Printed: ${printedAt || new Date().toISOString()}`,
  ].filter(Boolean);
  for (const line of meta) {
    doc.text(String(line), 40, y);
    y += 14;
  }

  const head = showLots
    ? [['Product', 'Demand', 'Done', 'Lot', 'State']]
    : [['Product', 'Demand', 'Done', 'State']];

  const body = (moves || []).map((m) => {
    const productLabel = m.productId?.templateId?.name
      || m.productId?.defaultCode
      || String(m.productId?._id || m.productId || '');
    const lots = showLots
      ? (moveLines || [])
        .filter((l) => String(l.moveId) === String(m._id))
        .map((l) => l.lotName || l.lotId?.name || '')
        .filter(Boolean)
        .join(', ')
      : '';
    const row = [
      productLabel,
      String(m.productUomQty ?? ''),
      String(m.quantity ?? ''),
    ];
    if (showLots) row.push(lots || '—');
    row.push(m.state || '');
    return row;
  });

  doc.autoTable({
    startY: y + 8,
    head,
    body: body.length ? body : [['—', '—', '—', ...(showLots ? ['—'] : []), '—']],
    styles: { fontSize: 9, cellPadding: 6 },
    headStyles: { fillColor: [15, 118, 110], textColor: 255 },
  });

  const endY = (doc.lastAutoTable?.finalY || y) + 40;
  doc.setDrawColor(148, 163, 184);
  doc.line(40, endY, 250, endY);
  doc.line(300, endY, 510, endY);
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text('Prepared by', 40, endY + 14);
  doc.text('Received by', 300, endY + 14);

  return Buffer.from(doc.output('arraybuffer'));
}
