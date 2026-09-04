/**
 * Import historical Golden Touch POS sales into Maqder invoices (EN+AR).
 *
 * Usage (from backend/):
 *   node scripts/import-golden-touch-invoices.mjs
 *   node scripts/import-golden-touch-invoices.mjs --env=production
 *   node scripts/import-golden-touch-invoices.mjs --dry-run
 *   node scripts/import-golden-touch-invoices.mjs --create-tenant
 *
 * Matching invoiceNumbers are rewritten (journals reversed, invoice replaced).
 */
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
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

if (!process.env.MONGODB_URI) {
  dotenv.config({ path: path.join(__dirname, useProd ? '../.env.production' : '../.env') });
} else if (useProd) {
  dotenv.config({ path: path.join(__dirname, '../.env.production'), override: false });
}

import Tenant from '../models/Tenant.js';
import User from '../models/User.js';
import Partner from '../models/Partner.js';
import Invoice from '../models/Invoice.js';
import AccountPayment from '../models/AccountPayment.js';
import {
  postSalesInvoiceJournal,
  postInvoicePaymentJournal,
  ensureAccountingDefaults,
  reverseInvoiceLinkedJournals,
} from '../services/accountingService.js';
import { roundMoney } from '../utils/money.js';

const TAX_RATE = 15;
const IMPORT_TAG = 'golden-touch-legacy-import-2026-full';
const EXPECTED_TOTAL = 184665.98;
const EXPECTED_PAID = 136338.97;

/** English source name → Arabic display name (bilingual invoices). */
const CUSTOMER_AR = {
  'Noura Mohammed Subiani': 'نورة محمد صبياني',
  'Sharifa Shami': 'شريفة شامي',
  Mohammed: 'محمد',
  'Talal Al-Maliki': 'طلال المالكي',
  'Noor Muhammad Al-Attas': 'نور محمد العطاس',
  Hahaha: 'هههه',
  'Zainab Qasim Sahlooli': 'زينب قاسم سهلولي',
  'Shrouq Yahya Al-Maliki': 'شروق يحيى المالكي',
  'Fatima Yahya': 'فاطمة يحيى',
  'Amani 2222': 'أماني 2222',
  'Raneem Ahmed Areeji': 'رنيم أحمد عريجي',
  'Maryam Jaabour': 'مريم جعبور',
  'Ahmed Ruby': 'أحمد روبي',
  'Angham Hassan Masawi': 'أنغام حسن مساوي',
  'Mahja Aqeel Ali': 'مهجة عقيل علي',
  'Susan Ayali': 'سوزان عيالي',
  'Fatima Hassan Majiri': 'فاطمة حسن مجيري',
  'Walk-In Customer': 'عميل عابر',
  'Safaa Muhammad': 'صفاء محمد',
  'Zahraa Al-Naami': 'زهراء النعمي',
  'Samaa Aloun': 'سماء علون',
  'Ibtihal Muhammad': 'ابتهال محمد',
  Agwan: 'أجوان',
  'Noura Ali': 'نورة علي',
  'Awatif Hassan': 'عواطف حسن',
  'Saleh Hussein Abdali': 'صالح حسين عبدلي',
  'Mona Hakami': 'منى حكمي',
  'Reem Ali': 'ريم علي',
  'Abdul Aziz Muhammad': 'عبد العزيز محمد',
  'Omar Farouk': 'عمر فاروق',
  'Nada Yahya': 'ندى يحيى',
  "Ru'a Al-Hazmi": 'رؤى الحازمي',
  Siyabari: 'سيابري',
  'Sarah Ali Maroubi': 'سارة علي مروبي',
  'Amani Ibrahim Jabali': 'أماني إبراهيم جبالي',
  'Issa Aqili witnessed': 'عيسى عقيلي شهد',
  'Sharifa Ahmed Matari': 'شريفة أحمد مطري',
  Yara: 'يارا',
  'Reem Hassan': 'ريم حسن',
  'Arena Mahzari': 'أرينا محظري',
  'Amal Al-Hazmi': 'أمل الحازمي',
  'Zakaria Hakami': 'زكريا حكمي',
  'Majed Abdullah': 'ماجد عبدالله',
  'Kholoud Ahmed': 'خلود أحمد',
  'Layla Muafa': 'ليلى معافا',
  'Rawbi Ahmed': 'روابي أحمد',
  'Juman Mubarak': 'جمان مبارك',
  'Fatima Nazim Muhammad': 'فاطمة ناظم محمد',
  'Mubarak Nebula': 'مبارك سديم',
  'Samira Abdelli': 'سميرة عبدلي',
  'Good candy': 'حلوى جيدة',
  'Maryam Muhammad Ali': 'مريم محمد علي',
  Ahmed: 'أحمد',
  'My ambition witnessed': 'طموحي شهد',
  'Noha Ahmed': 'نهى أحمد',
  'Fatima Murei Arji': 'فاطمة مرعي عرجي',
  Cave: 'كهف',
  'Ibrahim Ali Al-Fifi': 'إبراهيم علي الفيفي',
  'Abrar Ahmed': 'أبرار أحمد',
  'Maimouna Jaafari': 'ميمونة جعفري',
  'Sanaa Sadiq': 'سناء صادق',
  'Najwa Al-Harbi': 'نجوى الحربي',
  'Bashayer Doushi': 'بشاير دوشي',
  'Mohamed Hassan': 'محمد حسن',
  Rawabi: 'روابي',
  sentiment: 'شعور',
  'Aa L': 'أ أ ل',
  'Laila Ibrahim': 'ليلى إبراهيم',
  'Sarah Nasser': 'سارة ناصر',
  Zahra: 'زهرة',
  'The Good News of Abraham': 'بشرى إبراهيم',
  'Rahaf Ali': 'رهف علي',
  'Mohamed Gamal': 'محمد جمال',
  'Maram Ahmed': 'مرام أحمد',
  'Hanan Hassan': 'حنان حسن',
  Fatasa: 'فطاسة',
  'Layan Hassan': 'ليان حسن',
  'Al-Wasli narrated': 'الوصلي روى',
  'Nadine Sultan': 'نادين سلطان',
  pleasant: 'لطيف',
  'Popular breeze': 'نسيم شعبي',
  princess: 'الأميرة',
  'mlak Atif': 'ملاك عاطف',
  'With her, Abdul Wadud Hassan': 'معها عبد الودود حسن',
  'Hanan Ala': 'حنان علاء',
  'Hassan lived': 'حسن عاش',
  'Amna Hazazi': 'آمنة هزازي',
  'Azhar Ahmed': 'أزهار أحمد',
  'Rinas Abdullah': 'ريناس عبدالله',
  'Noha Ali': 'نهى علي',
  'His customer modified': 'عميله المعدل',
  'Atheer Jabali': 'أثير جبالي',
  'His daytime order': 'طلبه النهاري',
  'Amjad Amer Ali': 'أمجد عامر علي',
  'Al-Anoud Othman': 'العنود عثمان',
  'Layl Ala': 'ليل علاء',
  'Wasan Ahmed': 'وسن أحمد',
  'to attest': 'تشهد',
  'Zaqri Ahmed': 'زقري أحمد',
  'Atra Khorma': 'عطرة خرمة',
  'Ghabia Muhammad': 'غابية محمد',
  'Rania Jabri': 'رانيا جبري',
  'Wajdan Muhammad Ali': 'وجدان محمد علي',
  'Rafif on': 'رفيف على',
  'Joud Ahmed Ghazi': 'جود أحمد غازي',
  'Elham Ahmed': 'إلهام أحمد',
  'Sarah Kharafi': 'سارة خرفي',
  'On this': 'على هذا',
  'Ruqaya Hadi': 'رقية هادي',
  'Abdullah witnessed': 'عبدالله شهد',
  'Abdullah Othman': 'عبدالله عثمان',
  'Nibras Asiri': 'نبراس عسيري',
  Rehav: 'رحاب',
  Fatima: 'فاطمة',
  Neuer: 'نوير',
  'Rahaf Hamdi': 'رهف حمدي',
  immortality: 'خلود',
  'Hanan Al-Yamani': 'حنان اليماني',
  'Jaber collapsed': 'جابر انهار',
  'Hanan Madkhali': 'حنان مدخلي',
  'Ghafira Atouli': 'غفيرة عتولي',
};

const NOTE_AR = {
  '15/4 Probe, Receipt 19/4': 'تجربة 15/4، استلام 19/4',
  'Received 26, Returned 29/3': 'استلام 26، إرجاع 29/3',
  'Rent a tarpaulin': 'إيجار شادر',
  'Received 12/4, Returned 14/4': 'استلام 12/4، إرجاع 14/4',
  'Pickup 19/3, Return 22/3': 'استلام 19/3، إرجاع 22/3',
};

function mapPaymentMethod(raw) {
  const m = String(raw || '').trim().toLowerCase();
  if (m.includes('mada') || m === 'card') return 'card';
  if (m.includes('multi') || m.includes('split')) return 'split';
  if (m.includes('cash') || m === 'in cash') return 'cash';
  if (m === 'last') return 'cash'; // POS “آخر/آجل” export quirk — record paid portion as cash
  return 'cash';
}

function loadRows() {
  const tsvPath = path.join(__dirname, 'data/golden-touch-legacy.tsv');
  const lines = fs.readFileSync(tsvPath, 'utf8').trim().split(/\r?\n/);
  const header = lines[0].split('\t');
  return lines.slice(1).map((line) => {
    const cols = line.split('\t');
    const row = {};
    header.forEach((h, i) => { row[h] = cols[i] ?? ''; });
    const customer = String(row.customer || '').trim() || 'Walk-In Customer';
    return {
      date: row.date.trim(),
      no: String(row.no).trim(),
      customer,
      customerAr: CUSTOMER_AR[customer] || customer,
      phone: String(row.phone || '').trim(),
      payStatus: row.payStatus.trim(),
      method: mapPaymentMethod(row.method),
      methodRaw: row.method.trim(),
      total: Number(row.total),
      paid: Number(row.paid),
      note: String(row.note || '').trim(),
      noteAr: NOTE_AR[String(row.note || '').trim()] || '',
    };
  });
}

const ROWS = loadRows();

function parseIssueDate(raw) {
  const m = String(raw).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})$/);
  if (!m) throw new Error(`Bad date: ${raw}`);
  const [, mm, dd, yyyy, hh, min] = m.map(Number);
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

function bilingualNote(note, noteAr) {
  if (!note) return '';
  if (noteAr && noteAr !== note) return `${note} | ${noteAr}`;
  return note;
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
    tenant.settings = tenant.settings || {};
    tenant.settings.currency = tenant.settings.currency || 'SAR';
    tenant.settings.invoiceLanguage = 'en_ar';
    tenant.settings.invoicePdfPageSize = 'a4';
    tenant.business = tenant.business || {};
    tenant.business.legalNameEn = tenant.business.legalNameEn || 'Golden Touch Business Services Company';
    tenant.business.legalNameAr = tenant.business.legalNameAr || 'شركة جولدن تاتش لخدمات الأعمال';
    tenant.business.tradeName = tenant.business.tradeName || 'Golden Touch';
    tenant.business.address = {
      ...(tenant.business.address || {}),
      city: tenant.business.address?.city || 'Jeddah',
      cityAr: tenant.business.address?.cityAr || 'جدة',
      country: tenant.business.address?.country || 'SA',
    };
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
      invoiceLanguage: 'en_ar',
      invoicePdfPageSize: 'a4',
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
  const nameAr = String(row.customerAr || name).trim();
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
    let dirty = false;
    if (phone && !partner.phone) {
      partner.phone = phone;
      partner.mobile = phone;
      dirty = true;
    }
    if (!partner.nameAr || partner.nameAr === partner.name) {
      partner.nameAr = nameAr;
      dirty = true;
    }
    if (!partner.nameEn) {
      partner.nameEn = name;
      dirty = true;
    }
    if (dirty) await partner.save();
    return partner;
  }

  return Partner.create({
    tenantId,
    name,
    nameEn: name,
    nameAr,
    phone: phone || undefined,
    mobile: phone || undefined,
    type: 'individual',
    isCustomer: true,
    isVendor: false,
    isActive: true,
    notes: `Imported from legacy POS (${IMPORT_TAG})`,
  });
}

async function rewriteExistingInvoice(tenantId, invoiceNumber, userId) {
  const existing = await Invoice.findOne({ tenantId, invoiceNumber });
  if (!existing) return { rewritten: false };

  await reverseInvoiceLinkedJournals(
    tenantId,
    existing._id,
    userId,
    `Rewrite legacy import ${IMPORT_TAG} #${invoiceNumber}`,
  );

  await AccountPayment.deleteMany({
    tenantId,
    'allocations.invoiceId': existing._id,
  });

  await Invoice.deleteOne({ _id: existing._id });
  return { rewritten: true, previousId: existing._id.toString() };
}

async function main() {
  const rawUri = process.env.MONGODB_URI;
  if (!rawUri) throw new Error('MONGODB_URI missing');
  const uri = (useProd && String(rawUri).startsWith('mongodb+srv://'))
    ? await resolveAtlasUri(rawUri)
    : rawUri;
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 30000 });
  console.log('Connected', mongoose.connection.db.databaseName, useProd ? '(production flag)' : '');
  console.log(`Source rows: ${ROWS.length}`);

  const tenant = await findOrCreateTenant();
  console.log('Tenant', tenant._id.toString(), '|', tenant.name, '| invoiceLanguage=', tenant.settings?.invoiceLanguage);

  let user = await User.findOne({ tenantId: tenant._id, role: { $in: ['admin', 'super_admin', 'owner'] } }).sort({ createdAt: 1 });
  if (!user) user = await User.findOne({ tenantId: tenant._id }).sort({ createdAt: 1 });

  if (!dryRun) {
    await ensureAccountingDefaults(tenant._id);
  }

  const seller = {
    name: tenant.business?.legalNameEn || tenant.name,
    nameAr: tenant.business?.legalNameAr || 'شركة جولدن تاتش لخدمات الأعمال',
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
  let rewritten = 0;
  let errors = 0;
  let sumTotal = 0;
  let sumPaid = 0;

  for (const row of ROWS) {
    sumTotal = roundMoney(sumTotal + row.total);
    sumPaid = roundMoney(sumPaid + row.paid);

    const issueDate = parseIssueDate(row.date);
    const { net, tax, grand } = inclusiveLine(row.total);
    const rental = isRentalNote(row.note);
    const businessContext = rental ? 'boutique' : 'trading';
    const tarpaulin = row.note?.toLowerCase().includes('tarpaulin');
    const productName = rental
      ? (tarpaulin ? 'Tarpaulin rental' : 'Boutique rental')
      : 'Sales item';
    const productNameAr = rental
      ? (tarpaulin ? 'إيجار شادر' : 'إيجار بوتيك')
      : 'صنف مبيعات';
    const paidAmount = roundMoney(Math.min(row.paid, grand));
    const paymentStatus = paidAmount >= grand - 0.005 ? 'paid' : (paidAmount > 0 ? 'partial' : 'pending');
    const paymentMethod = row.method;
    const notes = bilingualNote(row.note, row.noteAr);

    if (dryRun) {
      const exists = await Invoice.exists({ tenantId: tenant._id, invoiceNumber: row.no });
      console.log(`DRY ${row.no} ${exists ? 'REWRITE' : 'CREATE'} ${businessContext} ${grand} paid=${paidAmount} ${paymentStatus} | ${row.customer} / ${row.customerAr}`);
      if (exists) rewritten += 1;
      else created += 1;
      continue;
    }

    try {
      const prior = await rewriteExistingInvoice(tenant._id, row.no, user?._id);
      if (prior.rewritten) {
        console.log(`REWRITE ${row.no} (was ${prior.previousId})`);
        rewritten += 1;
      }

      const partner = await upsertCustomer(tenant._id, row);
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
        printFormat: 'a4',
        currency: 'SAR',
        seller,
        buyer: {
          name: row.customer || 'Walk-In Customer',
          nameAr: row.customerAr || row.customer || 'عميل عابر',
          contactPhone: phoneDisplay || undefined,
          address: {
            country: 'SA',
            city: seller.address.city || 'Jeddah',
            cityAr: seller.address.cityAr || 'جدة',
          },
        },
        customerId: partner?._id,
        lineItems: [{
          lineNumber: 1,
          productName,
          productNameAr,
          productType: rental ? 'service' : 'goods',
          description: notes || 'Legacy POS import / استيراد من نقطة البيع',
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
        payments: paidAmount > 0
          ? [{ method: paymentMethod === 'split' ? 'cash' : paymentMethod, amount: paidAmount }]
          : [],
        status: 'approved',
        notes,
        internalNotes: `[${IMPORT_TAG}] Legacy POS sale #${row.no}; method=${row.methodRaw}; source status=${row.payStatus}`,
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

      const invoice = await Invoice.create(doc);
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
            'buyer.nameAr': row.customerAr || row.customer,
            'seller.nameAr': seller.nameAr,
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
      if (!prior.rewritten) created += 1;
    } catch (err) {
      errors += 1;
      console.error(`ERR ${row.no}`, err.message);
    }
  }

  if (!dryRun) {
    const legacyNumbers = ROWS.map((r) => r.no);
    const formatFix = await Invoice.updateMany(
      {
        tenantId: tenant._id,
        invoiceNumber: { $in: legacyNumbers },
      },
      {
        $set: {
          printFormat: 'a4',
          'seller.name': seller.name,
          'seller.nameAr': seller.nameAr,
        },
      },
    );
    console.log(`Format fix → a4 bilingual: matched=${formatFix.matchedCount} modified=${formatFix.modifiedCount}`);
  }

  console.log('\n--- Summary ---');
  console.log({
    created,
    rewritten,
    errors,
    sourceRows: ROWS.length,
    sumTotal,
    sumPaid,
    expectedTotal: EXPECTED_TOTAL,
    expectedPaid: EXPECTED_PAID,
    totalsMatch: sumTotal === EXPECTED_TOTAL && sumPaid === EXPECTED_PAID,
  });
  await mongoose.disconnect();
  if (errors > 0) process.exitCode = 1;
}

main().catch(async (err) => {
  console.error(err);
  try { await mongoose.disconnect(); } catch { /* ignore */ }
  process.exit(1);
});
