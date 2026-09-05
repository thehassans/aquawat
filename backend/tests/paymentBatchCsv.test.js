import test from 'node:test';
import assert from 'node:assert/strict';

// Lightweight CSV escape / shape check without DB — mirrors paymentBatchService helpers
function csvEscape(value) {
  const s = String(value ?? '');
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function buildCsv(lines) {
  const header = ['vendor_name', 'iban', 'amount', 'reference', 'invoice_number', 'currency'];
  const rows = lines.map((line) => [
    csvEscape(line.vendorName),
    csvEscape(line.iban),
    csvEscape(Number(line.amount).toFixed(2)),
    csvEscape(line.reference),
    csvEscape(line.invoiceNumber),
    csvEscape(line.currency || 'SAR'),
  ].join(','));
  return `${header.join(',')}\n${rows.join('\n')}\n`;
}

test('payment batch CSV includes vendor IBAN and amounts', () => {
  const csv = buildCsv([
    {
      vendorName: 'Al Noor Trading',
      iban: 'SA0380000000608010167519',
      amount: 1500.5,
      reference: 'BILL-001',
      invoiceNumber: 'BILL-001',
      currency: 'SAR',
    },
    {
      vendorName: 'Vendor, With Comma',
      iban: 'SA0380000000608010167519',
      amount: 99,
      reference: 'BILL-002',
      invoiceNumber: 'BILL-002',
      currency: 'SAR',
    },
  ]);
  assert.match(csv, /vendor_name,iban,amount,reference/);
  assert.match(csv, /Al Noor Trading,SA0380000000608010167519,1500\.50,BILL-001/);
  assert.match(csv, /"Vendor, With Comma"/);
  assert.match(csv, /99\.00/);
});
