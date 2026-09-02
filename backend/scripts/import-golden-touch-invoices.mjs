/**
 * Import historical Golden Touch POS sales into Maqder invoices.
 *
 * Usage (from backend/):
 *   node scripts/import-golden-touch-invoices.mjs
 *   node scripts/import-golden-touch-invoices.mjs --env=production
 *   node scripts/import-golden-touch-invoices.mjs --dry-run
 *   node scripts/import-golden-touch-invoices.mjs --create-tenant
 *
 * Idempotent: skips invoiceNumbers that already exist for the tenant.
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import dns from 'dns';
import dnsPromises from 'dns/promises';

dns.setServers(['8.8.8.8', '1.1.1.1']);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const args = new Set(process.argv.slice(2));
const useProd = args.has('--env=production') || args.has('--prod');
const dryRun = args.has('--dry-run');
const createTenant = args.has('--create-tenant');

// Prefer already-injected env (Docker / PM2). File load is for local/laptop runs.
if (!process.env.MONGODB_URI) {
  dotenv.config({ path: path.join(__dirname, useProd ? '../.env.production' : '../.env') });
} else if (useProd) {
  dotenv.config({ path: path.join(__dirname, '../.env.production'), override: false });
}

import Tenant from '../models/Tenant.js';
import User from '../models/User.js';
import Partner from '../models/Partner.js';
import Invoice from '../models/Invoice.js';
import {
  postSalesInvoiceJournal,
  postInvoicePaymentJournal,
  ensureAccountingDefaults,
} from '../services/accountingService.js';
import { roundMoney } from '../utils/money.js';

/** Source export — dates are MM/DD/YYYY (Aug–Sep 2026). Totals are VAT-inclusive SAR. */
const ROWS = [
  { date: '08/06/2026 21:55', no: '0112', customer: 'Nada Yahya', phone: '0552883448', payStatus: 'paid', method: 'cash', total: 1225, paid: 1225, note: '' },
  { date: '08/06/2026 23:19', no: '0086', customer: 'Omar Farouk', phone: '555', payStatus: 'paid', method: 'card', total: 300, paid: 300, note: '' },
  { date: '08/07/2026 23:49', no: '0087', customer: 'Abdul Aziz Muhammad', phone: '0551126316', payStatus: 'paid', method: 'cash', total: 200, paid: 200, note: '' },
  { date: '08/08/2026 21:56', no: '0113', customer: 'Reem Ali', phone: '0555321377', payStatus: 'paid', method: 'cash', total: 2400, paid: 2400, note: '' },
  { date: '08/08/2026 21:58', no: '0114', customer: 'Mona Hakami', phone: '0532967048', payStatus: 'paid', method: 'cash', total: 4100, paid: 4100, note: '' },
  { date: '08/09/2026 19:18', no: '0088', customer: 'Saleh Hussein Abdali', phone: '0551369260', payStatus: 'paid', method: 'card', total: 1725, paid: 1725, note: '' },
  { date: '08/09/2026 21:59', no: '0115', customer: 'Awatif Hassan', phone: '0538761032', payStatus: 'paid', method: 'cash', total: 1125, paid: 1125, note: '' },
  { date: '08/09/2026 22:00', no: '0116', customer: 'Noura Ali', phone: '0557923442', payStatus: 'paid', method: 'cash', total: 1000, paid: 1000, note: '' },
  { date: '08/09/2026 22:01', no: '0117', customer: 'Agwan', phone: '0583911661', payStatus: 'paid', method: 'cash', total: 2000, paid: 2000, note: '' },
  { date: '08/09/2026 22:02', no: '0118', customer: 'Ibtihal Muhammad', phone: '0543347008', payStatus: 'paid', method: 'cash', total: 1375, paid: 1375, note: '' },
  { date: '08/09/2026 22:03', no: '0119', customer: 'Mohammed', phone: '0543347008', payStatus: 'paid', method: 'cash', total: 100, paid: 100, note: '' },
  { date: '08/09/2026 22:16', no: '0089', customer: 'Samaa Aloun', phone: '054274574', payStatus: 'partial', method: 'cash', total: 3450, paid: 1000, note: '' },
  { date: '08/10/2026 22:38', no: '0090', customer: 'Zahraa Al-Naami', phone: '0534622833', payStatus: 'paid', method: 'card', total: 2185, paid: 2185, note: '' },
  { date: '08/10/2026 23:19', no: '0091', customer: 'Safaa Muhammad', phone: '9999', payStatus: 'paid', method: 'card', total: 150, paid: 150, note: '' },
  { date: '08/11/2026 22:06', no: '0120', customer: 'Walk-In Customer', phone: '', payStatus: 'paid', method: 'cash', total: 140, paid: 140, note: '' },
  { date: '08/11/2026 22:07', no: '0121', customer: 'Fatima Hassan Majiri', phone: '0538699447', payStatus: 'paid', method: 'cash', total: 2070, paid: 2070, note: '' },
  { date: '08/12/2026 22:07', no: '0122', customer: 'Susan Ayali', phone: '0509606022', payStatus: 'paid', method: 'cash', total: 450, paid: 450, note: '' },
  { date: '08/12/2026 22:08', no: '0123', customer: 'Mahja Aqeel Ali', phone: '0507244214', payStatus: 'paid', method: 'cash', total: 3077, paid: 3077, note: '' },
  { date: '08/13/2026 22:09', no: '0124', customer: 'Angham Hassan Masawi', phone: '0550301580', payStatus: 'paid', method: 'cash', total: 1600, paid: 1600, note: '' },
  { date: '08/14/2026 22:10', no: '0125', customer: 'Ahmed Ruby', phone: '0', payStatus: 'paid', method: 'cash', total: 200, paid: 200, note: '' },
  { date: '08/17/2026 22:11', no: '0126', customer: 'Maryam Jaabour', phone: '0554235553', payStatus: 'partial', method: 'cash', total: 1495, paid: 500, note: '' },
  { date: '08/19/2026 22:12', no: '0127', customer: 'Raneem Ahmed Areeji', phone: '0506604375', payStatus: 'paid', method: 'split', total: 1380, paid: 1380, note: '' },
  { date: '08/20/2026 22:13', no: '0128', customer: 'Amani 2222', phone: '0', payStatus: 'partial', method: 'cash', total: 650, paid: 150, note: '' },
  { date: '08/20/2026 22:13', no: '0092', customer: 'Fatima Yahya', phone: '0503588308', payStatus: 'paid', method: 'card', total: 500, paid: 500, note: '' },
  { date: '08/26/2026 18:27', no: '0129', customer: 'Shrouq Yahya Al-Maliki', phone: '0508896747', payStatus: 'paid', method: 'split', total: 1495, paid: 1495, note: 'Pickup 19/3, Return 22/3' },
  { date: '08/27/2026 22:39', no: '0130', customer: 'Zainab Qasim Sahlooli', phone: '0500094586', payStatus: 'partial', method: 'card', total: 2300, paid: 500, note: 'Received 12/4, Returned 14/4' },
  { date: '08/27/2026 23:28', no: '0131', customer: 'Hahaha', phone: '0502438198', payStatus: 'paid', method: 'card', total: 500, paid: 500, note: '' },
  { date: '08/28/2026 17:45', no: '0132', customer: 'Noor Muhammad Al-Attas', phone: '0530060932', payStatus: 'paid', method: 'card', total: 287.5, paid: 287.5, note: 'Rent a tarpaulin' },
  { date: '08/28/2026 17:50', no: '0133', customer: 'Talal Al-Maliki', phone: '0597088778', payStatus: 'partial', method: 'cash', total: 2070, paid: 500, note: 'Received 26, Returned 29/3' },
  { date: '08/28/2026 20:08', no: '0134', customer: 'Mohammed', phone: '0', payStatus: 'paid', method: 'card', total: 75, paid: 75, note: '' },
  { date: '08/30/2026 23:29', no: '0135', customer: 'Sharifa Shami', phone: '0559011935', payStatus: 'partial', method: 'card', total: 1300, paid: 500, note: '' },
  { date: '09/01/2026 19:58', no: '0136', customer: 'Noura Mohammed Subiani', phone: '0553260396', payStatus: 'partial', method: 'card', total: 3300, paid: 1000, note: '15/4 Probe, Receipt 19/4' },
];

const TAX_RATE = 15;
const IMPORT_TAG = 'golden-touch-legacy-import-2026-08';

function parseIssueDate(raw) {
  const m = String(raw).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})$/);
  if (!m) throw new Error(`Bad date: ${raw}`);
  const [, mm, dd, yyyy, hh, min] = m.map(Number);
  // Store as local wall-clock in Asia/Riyadh (+03) as UTC+3 absolute.
  return new Date(Date.UTC(yyyy, mm - 1, dd, hh - 3, min, 0));
}

function normalizePhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits || digits === '0' || digits.length < 7) return '';
  if (digits.startsWith('966')) return `+${digits}`;
  if (digits.startsWith('05') && digits.length === 10) return `+966${digits.slice(1)}`;
  if (digits.startsWith('5') && digits.length === 9) return `+966${digits}`;
  return digits;
}

function isRentalNote(note) {
  const n = String(note || '').toLowerCase();
  return /pickup|return|received|returned|rent|probe|receipt|tarpaulin/.test(n);
}

/** Split VAT-inclusive total so mongoose tax hook (net + round(net*15%)) equals source. */
function inclusiveLine(totalIncl) {
  const grand = roundMoney(totalIncl);
  let net = roundMoney(grand / (1 + TAX_RATE / 100));
  for (let i = 0; i < 40; i += 1) {
    const tax = roundMoney(net * (TAX_RATE / 100));
    const got = roundMoney(net + tax);
    if (got === grand) return { net, tax, grand };
    net = roundMoney(net + (got < grand ? 0.01 : -0.01));
  }
  const tax = roundMoney(grand - net);
  return { net, tax, grand };
}

async function resolveAtlasUri(srvUri) {
  const m = String(srvUri || '').match(/^mongodb\+srv:\/\/([^/]+)@([^/]+)\/([^?]*)(\?.*)?$/i);
  if (!m) return srvUri;
  const [, auth, host, dbName] = m;
  let records;
  try {
    records = await dnsPromises.resolveSrv(`_mongodb._tcp.${host}`);
  } catch {
    records = [
      { name: 'ac-cgalqev-shard-00-00.se7slkz.mongodb.net', port: 27017 },
      { name: 'ac-cgalqev-shard-00-02.se7slkz.mongodb.net', port: 27017 },
    ];
  }
  const txt = (await dnsPromises.resolveTxt(host).catch(() => [])).flat().join('');
  const rs = txt.match(/replicaSet=([^\s&]+)/)?.[1] || 'atlas-1356r1-shard-0';
  const hosts = [];
  for (const r of records) {
    try {
      await dnsPromises.resolve4(r.name);
      hosts.push(`${r.name}:${r.port || 27017}`);
    } catch {
      /* skip */
    }
  }
  if (!hosts.length) throw new Error('No Atlas hosts resolved');
  return `mongodb://${auth}@${hosts.join(',')}/${dbName || 'zatca-erp'}?ssl=true&authSource=admin&retryWrites=true&w=majority&replicaSet=${rs}`;
}

async function findOrCreateTenant() {
  let tenant = await Tenant.findOne({
    $or: [
      { name: /Golden Touch/i },
      { 'business.legalNameEn': /Golden Touch/i },
      { 'business.tradeName': /Golden Touch/i },
      { slug: /golden-touch/i },
    ],
  });

  if (tenant) {
    const types = new Set([...(tenant.businessTypes || []), tenant.businessType].filter(Boolean));
    types.add('trading');
    types.add('boutique');
    tenant.businessTypes = [...types];
    if (!tenant.businessType) tenant.businessType = 'trading';
    await tenant.save();
    return tenant;
  }

  if (!createTenant) {
    throw new Error('Golden Touch tenant not found. Re-run with --create-tenant on local, or --prod when Atlas is reachable.');
  }

  tenant = await Tenant.create({
    name: 'Golden Touch Business Services Company',
    slug: `golden-touch-${Date.now().toString(36)}`,
    businessType: 'trading',
    businessTypes: ['trading', 'boutique'],
    isActive: true,
    zatca: { phase: 1, isOnboarded: false },
    business: {
      legalNameEn: 'Golden Touch Business Services Company',
      legalNameAr: 'شركة جولدن تاتش لخدمات الأعمال',
      tradeName: 'Golden Touch',
      vatNumber: '',
      crNumber: '',
      address: { city: 'Jeddah', cityAr: 'جدة', country: 'SA' },
    },
    settings: {
      currency: 'SAR',
      taxRate: 15,
      language: 'en',
      invoicePrefix: 'INV',
    },
    subscription: {
      plan: 'professional',
      status: 'active',
      startDate: new Date(),
      endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      maxUsers: 10,
      maxInvoices: 100000,
    },
  });
  console.log('Created tenant', tenant._id.toString(), tenant.name);
  return tenant;
}

async function upsertCustomer(tenantId, row) {
  const name = String(row.customer || 'Walk-In Customer').trim() || 'Walk-In Customer';
  const phone = normalizePhone(row.phone);
  const rawPhone = String(row.phone || '').trim();

  let partner = null;
  if (phone) {
    partner = await Partner.findOne({
      tenantId,
      isCustomer: true,
      $or: [{ phone }, { mobile: phone }, { phone: rawPhone }, { mobile: rawPhone }],
    });
  }
  if (!partner && name.toLowerCase() !== 'walk-in customer') {
    partner = await Partner.findOne({
      tenantId,
      isCustomer: true,
      name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
    });
  }

  if (partner) {
    if (phone && !partner.phone) {
      partner.phone = phone;
      partner.mobile = phone;
      await partner.save();
    }
    return partner;
  }

  return Partner.create({
    tenantId,
    name,
    phone: phone || undefined,
    mobile: phone || undefined,
    type: 'individual',
    isCustomer: true,
    isVendor: false,
    isActive: true,
    notes: `Imported from legacy POS (${IMPORT_TAG})`,
  });
}

async function main() {
  const rawUri = process.env.MONGODB_URI;
  if (!rawUri) throw new Error('MONGODB_URI missing');
  // Only rewrite SRV when explicitly targeting Atlas from a broken local DNS environment.
  const uri = (useProd && String(rawUri).startsWith('mongodb+srv://'))
    ? await resolveAtlasUri(rawUri)
    : rawUri;
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 30000 });
  console.log('Connected', mongoose.connection.db.databaseName, useProd ? '(production flag)' : '');

  const tenant = await findOrCreateTenant();
  console.log('Tenant', tenant._id.toString(), '|', tenant.name, '|', tenant.businessTypes);

  let user = await User.findOne({ tenantId: tenant._id, role: { $in: ['admin', 'super_admin', 'owner'] } }).sort({ createdAt: 1 });
  if (!user) user = await User.findOne({ tenantId: tenant._id }).sort({ createdAt: 1 });

  if (!dryRun) {
    await ensureAccountingDefaults(tenant._id);
  }

  const seller = {
    name: tenant.business?.legalNameEn || tenant.name,
    nameAr: tenant.business?.legalNameAr || '',
    vatNumber: tenant.business?.vatNumber || '',
    crNumber: tenant.business?.crNumber || '',
    address: {
      street: tenant.business?.address?.street || '',
      streetAr: tenant.business?.address?.streetAr || '',
      district: tenant.business?.address?.district || '',
      city: tenant.business?.address?.city || 'Jeddah',
      cityAr: tenant.business?.address?.cityAr || 'جدة',
      postalCode: tenant.business?.address?.postalCode || '',
      country: tenant.business?.address?.country || 'SA',
      buildingNumber: tenant.business?.address?.buildingNumber || '',
    },
    contactPhone: tenant.phoneNumber || tenant.business?.phone || '',
  };

  let created = 0;
  let skipped = 0;
  let errors = 0;
  let sumTotal = 0;
  let sumPaid = 0;

  for (const row of ROWS) {
    sumTotal = roundMoney(sumTotal + row.total);
    sumPaid = roundMoney(sumPaid + row.paid);

    const existing = await Invoice.findOne({ tenantId: tenant._id, invoiceNumber: row.no }).select('_id status grandTotal');
    if (existing) {
      console.log(`SKIP ${row.no} (exists ${existing._id})`);
      skipped += 1;
      continue;
    }

    const issueDate = parseIssueDate(row.date);
    const { net, tax, grand } = inclusiveLine(row.total);
    const rental = isRentalNote(row.note);
    const businessContext = rental ? 'boutique' : 'trading';
    const productName = rental
      ? (row.note?.toLowerCase().includes('tarpaulin') ? 'Tarpaulin rental' : 'Boutique rental')
      : 'Sales item';
    const paidAmount = roundMoney(Math.min(row.paid, grand));
    const paymentStatus = paidAmount >= grand - 0.005 ? 'paid' : (paidAmount > 0 ? 'partial' : 'pending');
    const paymentMethod = row.method === 'card' || row.method === 'cash' || row.method === 'split'
      ? row.method
      : 'cash';

    const partner = dryRun ? null : await upsertCustomer(tenant._id, row);
    const phoneDisplay = normalizePhone(row.phone) || String(row.phone || '').trim();

    const doc = {
      tenantId: tenant._id,
      flow: 'sell',
      businessContext,
      invoiceNumber: row.no,
      invoiceType: '388',
      invoiceSubtype: 'standard',
      invoiceTypeCode: '0200000',
      transactionType: 'B2C',
      issueDate,
      supplyDate: issueDate,
      dueDate: issueDate,
      accountingDate: issueDate,
      printFormat: 'thermal',
      currency: 'SAR',
      seller,
      buyer: {
        name: row.customer || 'Walk-In Customer',
        contactPhone: phoneDisplay || undefined,
        address: { country: 'SA', city: seller.address.city || 'Jeddah' },
      },
      customerId: partner?._id,
      lineItems: [{
        lineNumber: 1,
        productName,
        productNameAr: rental ? 'إيجار بوتيك' : 'صنف مبيعات',
        productType: rental ? 'service' : 'goods',
        description: row.note || 'Legacy POS import',
        quantity: 1,
        unitCode: rental ? 'DAY' : 'PCE',
        unitPrice: net,
        discount: 0,
        taxCategory: 'S',
        taxRate: TAX_RATE,
        taxAmount: tax,
        lineTotal: net,
        lineTotalWithTax: grand,
      }],
      subtotal: net,
      invoiceDiscount: 0,
      totalDiscount: 0,
      taxableAmount: net,
      totalTax: tax,
      grandTotal: grand,
      paymentMethod,
      paymentStatus,
      paidAmount,
      payments: paidAmount > 0 ? [{ method: paymentMethod === 'split' ? 'cash' : paymentMethod, amount: paidAmount }] : [],
      status: 'approved',
      notes: row.note || '',
      internalNotes: `[${IMPORT_TAG}] Legacy POS sale #${row.no}; method=${row.method}; source status=${row.payStatus}`,
      createdBy: user?._id,
      createdByName: 'Business',
      approvedBy: user?._id,
      approvedAt: issueDate,
    };

    if (rental) {
      doc.boutiqueDetails = {
        transactionType: 'rental',
        amountPaid: paidAmount,
        depositStatus: 'pending',
        startDate: issueDate,
        endDate: issueDate,
      };
    }

    if (dryRun) {
      console.log(`DRY ${row.no} ${businessContext} ${grand} paid=${paidAmount} ${paymentStatus}`);
      created += 1;
      continue;
    }

    try {
      const invoice = await Invoice.create(doc);
      // Force exact VAT-inclusive totals (2dp VAT math cannot always match every retail total).
      await Invoice.collection.updateOne(
        { _id: invoice._id },
        {
          $set: {
            status: 'approved',
            paidAmount,
            paymentStatus,
            paymentMethod,
            subtotal: net,
            taxableAmount: net,
            totalTax: tax,
            grandTotal: grand,
            'lineItems.0.unitPrice': net,
            'lineItems.0.taxAmount': tax,
            'lineItems.0.lineTotal': net,
            'lineItems.0.lineTotalWithTax': grand,
          },
        },
      );
      const fresh = await Invoice.findById(invoice._id);
      if (!fresh) throw new Error('Invoice missing after create');

      await postSalesInvoiceJournal({
        tenantId: tenant._id,
        userId: user?._id,
        invoice: fresh,
        currency: 'SAR',
      });
      if (paidAmount > 0) {
        await postInvoicePaymentJournal({
          tenantId: tenant._id,
          userId: user?._id,
          invoice: fresh,
          amount: paidAmount,
          paymentMethod: paymentMethod === 'split' ? 'cash' : paymentMethod,
          paymentDate: issueDate,
          reference: `legacy-${row.no}`,
          currency: 'SAR',
        });
      }

      console.log(`OK  ${row.no} ${fresh.grandTotal} paid=${fresh.paidAmount} ${fresh.paymentStatus} ${businessContext}`);
      created += 1;
    } catch (err) {
      errors += 1;
      console.error(`ERR ${row.no}`, err.message);
    }
  }

  console.log('\n--- Summary ---');
  console.log({ created, skipped, errors, sourceRows: ROWS.length, sumTotal, sumPaid, expectedTotal: 44224.5, expectedPaid: 33809.5 });
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  try { await mongoose.disconnect(); } catch { /* ignore */ }
  process.exit(1);
});
