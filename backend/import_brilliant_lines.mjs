// import_brilliant_lines.mjs
// Imports 865 products and 1388 invoices for Brilliant Lines Establishment for Trading
// Run: node import_brilliant_lines.mjs

import mongoose from 'mongoose';
import { createReadStream } from 'fs';
import { parse } from 'csv-parse';

const MONGODB_URI = 'mongodb+srv://hassansarwar2112_db_user:GvozITy6hCKgrIH4@maqder.se7slkz.mongodb.net/zatca-erp?retryWrites=true&w=majority&appName=Maqder';
const TENANT_SLUG  = 'brilliantlinesestablishment-fortrading';
const PRODUCTS_CSV = 'C:/Users/kjh/Downloads/productitemsbrilliantlines.csv';
const INVOICES_CSV = 'C:/Users/kjh/Downloads/saleinvoicesbrilliantline.csv';

// ─── Helpers ─────────────────────────────────────────────────────────────────
function parseCSV(filePath) {
  return new Promise((resolve, reject) => {
    const records = [];
    createReadStream(filePath)
      .pipe(parse({ columns: true, skip_empty_lines: true, trim: true, relax_quotes: true, bom: true }))
      .on('data', row => records.push(row))
      .on('end',  () => resolve(records))
      .on('error', reject);
  });
}

function normalizeUOM(unit) {
  const map = { 'PCS':'PCE','PC':'PCE','EA':'PCE','CTN':'CT','CARTON':'CT',
                'BOX':'BX','TIN':'PCE','BTL':'PCE','BAG':'BG','KG':'KGM',
                'LTR':'LTR','MTR':'MTR','ROLL':'RO' };
  const u = String(unit||'').toUpperCase().trim();
  return map[u] || (u||'PCE');
}

function parseDMY(str) {
  if (!str) return new Date();
  const [d, m, y] = String(str).trim().split('-');
  if (!d||!m||!y) return new Date(str)||new Date();
  return new Date(`${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}T00:00:00.000Z`);
}

function normalizePayment(m) {
  const v = String(m||'').toLowerCase().trim();
  if (v==='cash') return 'cash';
  if (v==='credit') return 'credit';
  if (v==='card') return 'card';
  if (v.includes('bank')) return 'bank_transfer';
  return 'cash';
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🔌 Connecting to MongoDB Atlas...');
  await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
  console.log('✅ Connected\n');

  const db = mongoose.connection.db;

  // Find tenant
  const tenant = await db.collection('tenants').findOne({ slug: TENANT_SLUG });
  if (!tenant) throw new Error('Tenant not found: ' + TENANT_SLUG);
  const tenantId = tenant._id;
  console.log(`✅ Tenant: ${tenant.name} (${tenantId})\n`);

  const sellerInfo = {
    name:      tenant.name || 'Brilliant Lines Establishment for Trading',
    nameAr:    tenant.nameAr || 'مؤسسة الخطوط المتألقة للتجارة',
    vatNumber: (tenant.business && tenant.business.vatNumber) || '312781372800003',
    crNumber:  (tenant.business && tenant.business.crNumber)  || '',
    address: { country: 'SA', city: (tenant.business && tenant.business.city) || '' },
  };

  // ─── 1. PRODUCTS ──────────────────────────────────────────────────────────
  console.log('📦 Reading products CSV...');
  const productRows = await parseCSV(PRODUCTS_CSV);
  console.log(`   ${productRows.length} rows found`);

  const productColl = db.collection('products');
  let pCreated=0, pUpdated=0, pSkipped=0;
  const productMapByBarcode = {}; // barcode -> ObjectId
  const productMapByName    = {}; // nameEn.lower -> ObjectId

  for (let i=0; i<productRows.length; i++) {
    const r   = productRows[i];
    const nameEn = String(r['english items']||r['English Items']||'').trim();
    const nameAr = String(r['arabic items'] ||r['Arabic Items'] ||'').trim();
    const barcode= String(r['bracode']||r['barcode']||r['Barcode']||'').trim();
    const unit   = normalizeUOM(r['unit']||r['Unit']||'PCE');
    const cost   = parseFloat(r['purchase_price']||0)||0;
    const price  = parseFloat(r['sale_price']    ||0)||0;
    const alert  = parseFloat(r['alert_quantity'] ||0)||0;
    const cat    = String(r['category']||'').trim();
    const brand  = String(r['brand']||'').trim();
    const desc   = String(r['description']||'').trim();
    const active = String(r['active']||'1') !== '0';

    if (!nameEn || price === 0) { pSkipped++; continue; }

    const sku = barcode || `BL-${String(i+1).padStart(5,'0')}`;

    const filter = barcode ? { tenantId, barcode } : { tenantId, nameEn };
    const doc = {
      tenantId,
      sku,
      nameEn,
      nameAr: nameAr||undefined,
      barcode: barcode||undefined,
      descriptionEn: desc||undefined,
      category:  cat||undefined,
      brand:     brand||undefined,
      unitOfMeasure:   unit,
      unitOfMeasureAr: 'قطعة',
      costPrice:    cost,
      sellingPrice: price,
      taxRate:      15,
      taxCategory:  'S',
      currency: 'SAR',
      isActive: active,
      alertQuantity: alert,
      totalStock: 0,
      stocks: [],
    };

    const existing = await productColl.findOne(filter);
    if (existing) {
      await productColl.updateOne({ _id: existing._id }, { $set: { ...doc, updatedAt: new Date() } });
      productMapByBarcode[barcode] = existing._id;
      productMapByName[nameEn.toLowerCase()] = existing._id;
      pUpdated++;
    } else {
      const id = new mongoose.Types.ObjectId();
      await productColl.insertOne({ _id: id, ...doc, createdAt: new Date(), updatedAt: new Date(), __v: 0 });
      productMapByBarcode[barcode] = id;
      productMapByName[nameEn.toLowerCase()] = id;
      pCreated++;
    }

    if ((i+1)%100===0) process.stdout.write(`   ${i+1}/${productRows.length} products...\r`);
  }
  console.log(`\n✅ Products: ${pCreated} created, ${pUpdated} updated, ${pSkipped} skipped\n`);

  // ─── 2. INVOICES + CUSTOMERS ──────────────────────────────────────────────
  console.log('🧾 Reading invoices CSV...');
  const invoiceRows = await parseCSV(INVOICES_CSV);
  console.log(`   ${invoiceRows.length} rows found`);

  const invoiceColl  = db.collection('invoices');
  const customerColl = db.collection('customers');

  const customerCache = {};
  const existingCusts = await customerColl.find({ tenantId }).project({ name:1, vatNumber:1 }).toArray();
  for (const c of existingCusts) {
    customerCache[c.name.toLowerCase()] = c._id;
    if (c.vatNumber) customerCache[`vat:${c.vatNumber}`] = c._id;
  }

  let iCreated=0, iSkipped=0, cCreated=0;

  for (let i=0; i<invoiceRows.length; i++) {
    const r = invoiceRows[i];
    const invoiceNumber = String(r['Invoice No']||r['invoice no']||'').trim();
    const dateStr       = String(r['Date']||r['date']||'').trim();
    const amount        = parseFloat(r['Amount']||0)||0;
    const discount      = parseFloat(r['Discount']||0)||0;
    const vat           = parseFloat(r['VAT']||0)||0;
    const grandTotal    = parseFloat(r['Grand Total']||r['GrandTotal']||0)||0;
    const payMethod     = String(r['Payment Method']||r['payment method']||'').trim();
    const custName      = String(r['Customer Name']||r['customer name']||'Cash Customer').trim()||'Cash Customer';
    const custPhone     = String(r['Customer Phone']||'').trim().replace(/^0+$/,'');
    const custVAT       = String(r['Customer VAT NO']||r['Customer VAT No']||'').trim();

    if (!invoiceNumber) { iSkipped++; continue; }

    const exists = await invoiceColl.findOne({ tenantId, invoiceNumber });
    if (exists) { iSkipped++; continue; }

    // Customer upsert
    const nameKey = custName.toLowerCase();
    const vatKey  = custVAT && custVAT.length > 5 ? `vat:${custVAT}` : null;
    let customerId = (vatKey && customerCache[vatKey]) || customerCache[nameKey];

    if (!customerId && custName && custName !== 'Cash Customer') {
      const newCust = {
        _id: new mongoose.Types.ObjectId(),
        tenantId,
        name: custName,
        phone: custPhone && custPhone.length > 2 ? custPhone : undefined,
        vatNumber: custVAT && custVAT.length > 5 ? custVAT : undefined,
        type: custVAT && custVAT.length > 5 ? 'business' : 'individual',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        __v: 0,
      };
      await customerColl.insertOne(newCust);
      customerId = newCust._id;
      customerCache[nameKey] = customerId;
      if (vatKey) customerCache[vatKey] = customerId;
      cCreated++;
    }

    const isB2B = !!(custVAT && custVAT.length > 5);
    const issueDate = parseDMY(dateStr);
    const pm = normalizePayment(payMethod);

    const lineItem = {
      lineNumber:      1,
      productName:     'Goods & Products',
      productNameAr:   'بضائع ومنتجات',
      quantity:        1,
      unitCode:        'PCE',
      unitPrice:       amount,
      discount:        discount,
      discountType:    'fixed',
      taxCategory:     'S',
      taxRate:         15,
      taxAmount:       vat,
      lineTotal:       amount - discount,
      lineTotalWithTax:(amount - discount) + vat,
    };

    await invoiceColl.insertOne({
      _id: new mongoose.Types.ObjectId(),
      tenantId,
      flow: 'sell',
      businessContext: 'trading',
      invoiceNumber,
      invoiceType: '388',
      invoiceTypeCode: isB2B ? '0100000' : '0200000',
      transactionType: isB2B ? 'B2B' : 'B2C',
      issueDate,
      seller: sellerInfo,
      buyer: {
        name: custName,
        vatNumber: custVAT && custVAT.length > 5 ? custVAT : undefined,
        contactPhone: custPhone && custPhone.length > 2 ? custPhone : undefined,
      },
      customerId: customerId || undefined,
      lineItems: [lineItem],
      subtotal: amount,
      invoiceDiscount: discount,
      totalDiscount: discount,
      taxableAmount: amount - discount,
      totalTax: vat,
      grandTotal,
      currency: 'SAR',
      paymentMethod: pm,
      paymentStatus: pm === 'credit' ? 'unpaid' : 'paid',
      status: 'draft',
      source: 'import',
      createdAt: new Date(),
      updatedAt: new Date(),
      __v: 0,
    });

    iCreated++;
    if ((i+1)%100===0) process.stdout.write(`   ${i+1}/${invoiceRows.length} invoices...\r`);
  }

  console.log(`\n✅ Invoices: ${iCreated} created, ${iSkipped} skipped`);
  console.log(`✅ Customers created: ${cCreated}\n`);
  console.log('🎉 Import complete!');
  await mongoose.disconnect();
}

main().catch(err => {
  console.error('\n❌ Error:', err.message || err);
  process.exit(1);
});
