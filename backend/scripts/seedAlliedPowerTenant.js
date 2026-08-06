import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import XLSX from 'xlsx';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

import Tenant from '../models/Tenant.js';
import User from '../models/User.js';
import Warehouse from '../models/Warehouse.js';
import Customer from '../models/Customer.js';
import Supplier from '../models/Supplier.js';
import Product from '../models/Product.js';

import fs from 'fs';

const DATA_DIR = path.join(__dirname, 'data/allied');
const DOWNLOADS_DIR = 'C:\\Users\\kjh\\Downloads';

function readExcelFile(filename) {
  const jsonPath = path.join(DATA_DIR, filename.replace('.xlsx', '.json'));
  if (fs.existsSync(jsonPath)) {
    return JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  }
  const relXlsx = path.join(DATA_DIR, filename);
  if (fs.existsSync(relXlsx)) {
    const wb = XLSX.readFile(relXlsx);
    return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
  }
  const dlXlsx = path.join(DOWNLOADS_DIR, filename);
  if (fs.existsSync(dlXlsx)) {
    const wb = XLSX.readFile(dlXlsx);
    return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
  }
  console.warn('⚠️ File not found:', filename);
  return [];
}

function cleanString(val) {
  if (val === null || val === undefined) return '';
  return String(val).trim();
}

function cleanVat(val) {
  const str = cleanString(val);
  const digits = str.replace(/[^\d]/g, '');
  return digits.length >= 10 ? digits : (str.length > 3 ? str : '');
}

function cleanPhone(val) {
  return cleanString(val).replace(/\s+/g, ' ');
}

function cleanEmail(val) {
  const str = cleanString(val);
  if (str.includes('@') && str.includes('.')) {
    return str.split(/[ ,;]/)[0].toLowerCase().trim();
  }
  return '';
}

function mapUOM(unitStr) {
  const u = cleanString(unitStr).toUpperCase();
  if (u === 'EACH' || u === 'EA' || u === 'PC' || u === 'PCS' || u === 'PIECE') return 'PCE';
  if (u === 'METER' || u === 'MTR' || u === 'M') return 'MTR';
  if (u === 'SET' || u === 'SETS') return 'SET';
  if (u === 'ROLL' || u === 'RL') return 'ROL';
  if (u === 'BOX' || u === 'BX') return 'BX';
  if (u === 'PACK' || u === 'PK' || u === 'PKT') return 'PK';
  if (u === 'PAIR' || u === 'PR') return 'PR';
  if (u === 'KG' || u === 'KILOGRAM') return 'KGM';
  if (u === 'LITER' || u === 'LTR') return 'LTR';
  if (u === 'FT' || u === 'FEET') return 'FOT';
  return 'PCE';
}

function parseAddressDetails(addrStr) {
  const raw = cleanString(addrStr);
  if (!raw) return { street: '', city: 'Al Khobar', country: 'SA', raw: '' };

  let city = 'Al Khobar';
  const lower = raw.toLowerCase();
  if (lower.includes('dammam') || raw.includes('الدمام')) city = 'Dammam';
  else if (lower.includes('khobar') || raw.includes('الخبر')) city = 'Al Khobar';
  else if (lower.includes('jubail') || raw.includes('الجبيل')) city = 'Jubail';
  else if (lower.includes('riyadh') || raw.includes('الرياض')) city = 'Riyadh';
  else if (lower.includes('jeddah') || raw.includes('جدة')) city = 'Jeddah';
  else if (lower.includes('yanbu') || raw.includes('ينبع')) city = 'Yanbu';
  else if (lower.includes('al ahsa') || lower.includes('hofuf') || raw.includes('الاحساء') || raw.includes('الهفوف')) city = 'Al Ahsa';

  let postalCode = '';
  const postMatch = raw.match(/\b\d{5}\b/);
  if (postMatch) postalCode = postMatch[0];

  return {
    street: raw.substring(0, 200),
    city,
    postalCode,
    country: 'SA',
    raw
  };
}

async function runSeed(shouldDisconnect = false) {
  console.log('🚀 Starting Allied Power Industrial Company Import & Integration...');

  if (mongoose.connection.readyState !== 1) {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/maqder';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB:', mongoUri);
  }

  // 1. Find or Create Tenant
  const vatNumber = '314807049800003';
  const crNumber = '7054403162';
  const tenantName = 'Allied Power Industrial Company';
  const tenantNameAr = 'شركة ألايد باور إندستريال';

  let tenant = await Tenant.findOne({
    $or: [
      { 'business.vatNumber': vatNumber },
      { 'business.crNumber': crNumber },
      { name: new RegExp(tenantName, 'i') },
      { slug: 'allied-power' }
    ]
  });

  const tenantData = {
    name: tenantName,
    slug: 'allied-power',
    businessType: 'trading',
    businessTypes: ['trading'],
    personalEmail: 'admin@alliedpower.com.sa',
    phoneNumber: '+966-13-8476681',
    business: {
      legalNameAr: tenantNameAr,
      legalNameEn: tenantName,
      tradeName: 'Allied Power',
      vatNumber: vatNumber,
      crNumber: crNumber,
      contactPhone: '+966-13-8476681',
      contactEmail: 'admin@alliedpower.com.sa',
      address: {
        buildingNumber: '8469',
        additionalNumber: '3227',
        street: 'Prince Bandar Ibn Abdulaziz',
        streetAr: 'الامير بندر بن عبدالعزيز',
        district: 'Al Khubar Ash Shamaliyah Dist.',
        districtAr: 'حي الخبر الشمالية',
        city: 'AL KHOBAR',
        cityAr: 'الخبر',
        postalCode: '34426',
        country: 'SA'
      },
      nationalAddress: {
        proofNumber: '1087849671',
        customerAccount: '31335492756',
        shortAddress: 'EKDA8469',
        buildingNo: '8469',
        neighborhood: 'حي الخبر الشمالية',
        region: 'المنطقة الشرقية',
        regDate: new Date('2026-05-19'),
        expirationDate: new Date('2026-12-13')
      },
      commercialRegistration: {
        crNumber: crNumber,
        issueDate: new Date('2026-05-19'),
        companyType: 'Company Limited liability (One person)',
        companyTypeAr: 'شركة ذات مسؤولية محدودة (شخص واحد)',
        companyStatus: 'Active',
        companyStatusAr: 'قائم'
      },
      vatCertificate: {
        certificateNo: vatNumber,
        taxPeriod: 'Quarterly',
        effectiveDate: new Date('2026-05-19')
      }
    },
    subscription: {
      plan: 'enterprise',
      status: 'active',
      maxUsers: 50,
      maxInvoices: 100000,
      features: ['hr', 'payroll', 'invoicing', 'inventory', 'ai', 'api_access', 'multi_warehouse', 'advanced_reports', 'email_automation']
    },
    settings: {
      language: 'ar',
      currency: 'SAR',
      timezone: 'Asia/Riyadh',
      dateFormat: 'DD/MM/YYYY',
      useHijriDates: true,
      inventory: {
        allowNegativeStock: true,
        lowStockThreshold: 10
      },
      invoiceBranding: {
        headerTextEn: 'Allied Power Industrial Company',
        headerTextAr: 'شركة ألايد باور إندستريال',
        footerTextEn: 'Thank you for your business.',
        footerTextAr: 'شكراً لتعاملكم معنا'
      }
    },
    isActive: true
  };

  if (!tenant) {
    tenant = await Tenant.create(tenantData);
    console.log('✅ Created Tenant:', tenant.name, `(ID: ${tenant._id})`);
  } else {
    Object.assign(tenant, tenantData);
    await tenant.save();
    console.log('✅ Updated Tenant:', tenant.name, `(ID: ${tenant._id})`);
  }

  // 2. Ensure Primary Warehouse
  let warehouse = await Warehouse.findOne({ tenantId: tenant._id, isPrimary: true });
  if (!warehouse) {
    warehouse = await Warehouse.findOne({ tenantId: tenant._id, code: 'WH-MAIN' });
  }
  if (!warehouse) {
    warehouse = await Warehouse.create({
      tenantId: tenant._id,
      code: 'WH-MAIN',
      nameEn: 'Main Warehouse - Al Khobar',
      nameAr: 'المستودع الرئيسي - الخبر',
      type: 'main',
      isPrimary: true,
      address: {
        street: 'Prince Bandar Ibn Abdulaziz',
        district: 'Al Khubar Ash Shamaliyah',
        city: 'AL KHOBAR',
        postalCode: '34426',
        country: 'SA'
      },
      isActive: true
    });
    console.log('✅ Created Primary Warehouse:', warehouse.nameEn, `(ID: ${warehouse._id})`);
  } else {
    console.log('✅ Found Primary Warehouse:', warehouse.nameEn, `(ID: ${warehouse._id})`);
  }

  // 3. Ensure Admin User
  const adminEmail = 'admin@alliedpower.com.sa';
  let adminUser = await User.findOne({ email: adminEmail });
  if (!adminUser) {
    adminUser = await User.create({
      tenantId: tenant._id,
      firstName: 'Allied',
      lastName: 'Admin',
      firstNameAr: 'ألايد',
      lastNameAr: 'أدمن',
      email: adminEmail,
      password: 'Password@123',
      role: 'admin',
      permissions: [
        { module: 'sales', actions: ['create', 'read', 'update', 'delete', 'approve', 'export'] },
        { module: 'purchases', actions: ['create', 'read', 'update', 'delete', 'approve', 'export'] },
        { module: 'inventory', actions: ['create', 'read', 'update', 'delete', 'approve', 'export'] },
        { module: 'supply_chain', actions: ['create', 'read', 'update', 'delete', 'approve', 'export'] },
        { module: 'contacts', actions: ['create', 'read', 'update', 'delete', 'approve', 'export'] },
        { module: 'finance', actions: ['create', 'read', 'update', 'delete', 'approve', 'export'] },
        { module: 'reports', actions: ['create', 'read', 'update', 'delete', 'approve', 'export'] },
        { module: 'settings', actions: ['create', 'read', 'update', 'delete', 'approve', 'export'] }
      ],
      isActive: true
    });
    console.log('✅ Created Admin User:', adminUser.email, 'Password: Password@123');
  } else {
    adminUser.tenantId = tenant._id;
    adminUser.role = 'admin';
    adminUser.firstName = 'Allied';
    adminUser.lastName = 'Admin';
    await adminUser.save();
    console.log('✅ Linked Admin User:', adminUser.email);
  }

  // 4. Import Customers from alliedcustomer.xlsx
  console.log('\n--- Importing Customers (alliedcustomer.xlsx) ---');
  const customersRaw = readExcelFile('alliedcustomer.xlsx');
  console.log(`Read ${customersRaw.length} customer rows.`);

  let customersCreated = 0;
  let customersUpdated = 0;

  for (const row of customersRaw) {
    const code = cleanString(row.Code);
    const name = cleanString(row.Name);
    if (!name && !code) continue;

    const vat = cleanVat(row['Vat No']);
    const phone = cleanPhone(row.Tele);
    const fax = cleanPhone(row.Fax);
    const attn = cleanString(row.Attn);
    const email = cleanEmail(row.Email);
    const addr = parseAddressDetails(row.Address);

    const customerPayload = {
      tenantId: tenant._id,
      customerCode: code || undefined,
      name: name || code,
      nameEn: name,
      nameAr: '',
      type: 'business',
      vatNumber: vat,
      phone: phone,
      email: email,
      contactPerson: {
        name: attn
      },
      address: {
        street: addr.street,
        city: addr.city,
        postalCode: addr.postalCode,
        country: 'SA'
      },
      notes: [
        fax ? `Fax: ${fax}` : '',
        addr.raw ? `Full Address: ${addr.raw}` : ''
      ].filter(Boolean).join('\n'),
      isActive: true,
      createdBy: adminUser._id
    };

    const existing = await Customer.findOne({
      tenantId: tenant._id,
      $or: [
        ...(code ? [{ customerCode: code }] : []),
        { name: name }
      ]
    });

    if (existing) {
      Object.assign(existing, customerPayload);
      await existing.save();
      customersUpdated++;
    } else {
      await Customer.create(customerPayload);
      customersCreated++;
    }
  }
  console.log(`✅ Customers Processed: ${customersCreated} created, ${customersUpdated} updated.`);

  // 5. Import Suppliers & Supplier Additions
  console.log('\n--- Importing Suppliers (alliedSupplier.xlsx & alliedSUPPLIER ADDITION.xlsx) ---');
  const suppliersMainRaw = readExcelFile('alliedSupplier.xlsx');
  const suppliersAddRaw = readExcelFile('alliedSUPPLIER ADDITION.xlsx');
  console.log(`Read ${suppliersMainRaw.length} main suppliers, ${suppliersAddRaw.length} addition suppliers.`);

  const addMap = new Map();
  suppliersAddRaw.forEach(s => {
    const code = cleanString(s.Code);
    if (code) addMap.set(code, s);
  });

  const allSupplierCodes = new Set([
    ...suppliersMainRaw.map(s => cleanString(s.Code)),
    ...suppliersAddRaw.map(s => cleanString(s.Code))
  ]);

  let suppliersCreated = 0;
  let suppliersUpdated = 0;

  for (const code of allSupplierCodes) {
    if (!code) continue;

    const mainRow = suppliersMainRaw.find(s => cleanString(s.Code) === code);
    const addRow = addMap.get(code);

    const isAddition = Boolean(addRow);
    const effectiveRow = addRow || mainRow;

    const name = cleanString(effectiveRow.Name || mainRow?.Name);
    if (!name) continue;

    const vat = cleanVat(effectiveRow['Vat No'] || mainRow?.['Vat No']);
    const phone = cleanPhone(effectiveRow.Tele || mainRow?.Tele);
    const fax = cleanPhone(effectiveRow.Fax || mainRow?.Fax);
    const attn = cleanString(effectiveRow.Attn || mainRow?.Attn);
    const email = cleanEmail(effectiveRow.Email || mainRow?.Email);
    const addr = parseAddressDetails(effectiveRow.Address || mainRow?.Address);

    const supplierPayload = {
      tenantId: tenant._id,
      code: code,
      nameEn: name,
      nameAr: '',
      type: 'company',
      vatNumber: vat,
      contactPerson: attn,
      phone: phone,
      email: email,
      address: {
        street: addr.street,
        city: addr.city,
        postalCode: addr.postalCode,
        country: 'SA'
      },
      isAddition: isAddition,
      additionSource: isAddition ? 'alliedSUPPLIER ADDITION' : 'direct',
      additionDate: isAddition ? new Date() : undefined,
      tags: isAddition ? ['Supplier Addition', 'Allied'] : ['Allied'],
      notes: [
        fax ? `Fax: ${fax}` : '',
        addr.raw ? `Full Address: ${addr.raw}` : ''
      ].filter(Boolean).join('\n'),
      isActive: true,
      createdBy: adminUser._id
    };

    const existing = await Supplier.findOne({ tenantId: tenant._id, code: code });
    if (existing) {
      Object.assign(existing, supplierPayload);
      await existing.save();
      suppliersUpdated++;
    } else {
      await Supplier.create(supplierPayload);
      suppliersCreated++;
    }
  }
  console.log(`✅ Suppliers Processed: ${suppliersCreated} created, ${suppliersUpdated} updated.`);

  // 6. Import Inventory & Negative Inventory
  console.log('\n--- Importing Inventory (alliedInventory.xlsx & alliedInventoryNegtive.xlsx) ---');
  const inventoryRaw = readExcelFile('alliedInventory.xlsx');
  const inventoryNegRaw = readExcelFile('alliedInventoryNegtive.xlsx');
  console.log(`Read ${inventoryRaw.length} inventory items, ${inventoryNegRaw.length} negative inventory items.`);

  const negativeItemCodes = new Set(inventoryNegRaw.map(i => cleanString(i.ItemCode)));

  let productsCreated = 0;
  let productsUpdated = 0;

  for (const row of inventoryRaw) {
    const itemCode = cleanString(row.ItemCode);
    const itemName = cleanString(row.ItemName);
    if (!itemCode && !itemName) continue;

    const sku = itemCode || itemName.substring(0, 30);
    const isNegativeAllowed = negativeItemCodes.has(itemCode) || negativeItemCodes.has(sku);
    const uom = mapUOM(row.Unit);
    const taxRate = parseFloat(row['VAT Amt %']) || 15;

    const productPayload = {
      tenantId: tenant._id,
      sku: sku,
      nameEn: itemName || sku,
      nameAr: '',
      descriptionEn: `Item Code: ${itemCode}`,
      category: 'Electrical & Industrial Supplies',
      unitOfMeasure: uom,
      costPrice: 0,
      sellingPrice: 0,
      taxRate: taxRate,
      taxCategory: 'S',
      allowNegativeStock: isNegativeAllowed,
      status: 'active',
      isActive: true,
      stocks: [
        {
          warehouseId: warehouse._id,
          quantity: 0,
          reservedQuantity: 0,
          reorderPoint: 5
        }
      ],
      createdBy: adminUser._id
    };

    const existing = await Product.findOne({ tenantId: tenant._id, sku: sku });
    if (existing) {
      existing.nameEn = productPayload.nameEn;
      existing.allowNegativeStock = isNegativeAllowed;
      existing.unitOfMeasure = uom;
      existing.taxRate = taxRate;
      if (!existing.stocks || existing.stocks.length === 0) {
        existing.stocks = productPayload.stocks;
      }
      await existing.save();
      productsUpdated++;
    } else {
      await Product.create(productPayload);
      productsCreated++;
    }
  }
  console.log(`✅ Inventory Processed: ${productsCreated} created, ${productsUpdated} updated.`);

  // 7. Verification Summary
  const customerCount = await Customer.countDocuments({ tenantId: tenant._id });
  const supplierTotalCount = await Supplier.countDocuments({ tenantId: tenant._id });
  const supplierAdditionsCount = await Supplier.countDocuments({ tenantId: tenant._id, isAddition: true });
  const productTotalCount = await Product.countDocuments({ tenantId: tenant._id });
  const productNegativeCount = await Product.countDocuments({ tenantId: tenant._id, allowNegativeStock: true });

  console.log('\n========================================');
  console.log('🎉 ALLIED POWER INDUSTRIAL COMPANY READY!');
  console.log('========================================');
  console.log(`Tenant ID:          ${tenant._id}`);
  console.log(`Tenant Name:        ${tenant.name}`);
  console.log(`VAT Number:         ${tenant.business.vatNumber}`);
  console.log(`CR Number:          ${tenant.business.crNumber}`);
  console.log(`Total Customers:    ${customerCount}`);
  console.log(`Total Suppliers:    ${supplierTotalCount} (${supplierAdditionsCount} Additions)`);
  console.log(`Total Products:     ${productTotalCount} (${productNegativeCount} Negative Allowed)`);
  console.log('========================================\n');

  if (shouldDisconnect) {
    await mongoose.disconnect();
    console.log('✅ Database disconnected.');
  }
}

export const seedAlliedPowerTenant = () => runSeed(false);

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  runSeed(true).catch(err => {
    console.error('❌ Migration Error:', err);
    process.exit(1);
  });
}

export default seedAlliedPowerTenant;
