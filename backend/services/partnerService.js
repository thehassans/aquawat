import Partner from '../models/Partner.js';

/** Role filters for customer / supplier API facades */
export function asCustomerQuery(extra = {}) {
  const { includeMerged = false, ...rest } = extra || {};
  const q = { isCustomer: true, ...rest };
  if (!includeMerged) q.mergedIntoId = null;
  return q;
}

export function asVendorQuery(extra = {}) {
  const { includeMerged = false, ...rest } = extra || {};
  const q = { isVendor: true, ...rest };
  if (!includeMerged) q.mergedIntoId = null;
  return q;
}

/** Shape Partner → legacy Customer JSON */
export function toCustomerDto(doc) {
  if (!doc) return doc;
  const o = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
  return {
    ...o,
    name: o.name || o.nameEn || '',
    paymentTerms: o.paymentTermsCustomer || o.paymentTerms || 'net30',
    // Keep supplierCode/nameEn out of the way but harmless if present
  };
}

/** Shape Partner → legacy Supplier JSON */
export function toSupplierDto(doc) {
  if (!doc) return doc;
  const o = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
  return {
    ...o,
    nameEn: o.nameEn || o.name || '',
    name: o.name || o.nameEn || '',
    code: o.supplierCode || o.code || '',
    paymentTerms: o.paymentTermsVendor || o.paymentTerms || { term: 'net_30' },
    type: o.type === 'business' ? 'company' : (o.type || 'company'),
    contactPerson: typeof o.contactPerson === 'object'
      ? (o.contactPerson?.name || '')
      : (o.contactPerson || ''),
  };
}

export function normalizePartnerType(type, { asVendor = false } = {}) {
  if (!type) return 'business';
  if (type === 'company') return 'business';
  if (type === 'business' || type === 'individual') return type;
  return asVendor ? 'business' : 'business';
}

/** Map customer create/update body → Partner fields */
export function fromCustomerBody(body = {}) {
  const out = { ...body };
  if (body.paymentTerms != null && typeof body.paymentTerms === 'string') {
    out.paymentTermsCustomer = body.paymentTerms;
    delete out.paymentTerms;
  }
  delete out.linkedSupplierId;
  delete out.linkedCustomerId;
  if (out.isCustomer === undefined) out.isCustomer = true;
  if (out.nameEn == null && out.name) out.nameEn = out.name;
  out.type = normalizePartnerType(out.type);
  return out;
}

/** Map supplier create/update body → Partner fields */
export function fromSupplierBody(body = {}) {
  const out = { ...body };
  if (body.code != null) {
    out.supplierCode = body.code;
    delete out.code;
  }
  if (body.nameEn != null && !body.name) {
    out.name = body.nameEn;
  }
  if (body.name != null && !out.nameEn) {
    out.nameEn = body.name;
  }
  if (body.paymentTerms != null && typeof body.paymentTerms === 'object') {
    out.paymentTermsVendor = body.paymentTerms;
    delete out.paymentTerms;
  }
  if (typeof body.contactPerson === 'string') {
    out.contactPerson = { name: body.contactPerson };
  }
  delete out.linkedSupplierId;
  delete out.linkedCustomerId;
  if (out.isVendor === undefined) out.isVendor = true;
  out.type = normalizePartnerType(out.type === 'company' ? 'business' : out.type, { asVendor: true });
  return out;
}

export async function nextCustomerCode(tenantId) {
  const count = await Partner.countDocuments({ tenantId, customerCode: { $exists: true, $ne: '' } });
  return String(1000 + count);
}

export async function nextSupplierCode(tenantId) {
  const count = await Partner.countDocuments({ tenantId, supplierCode: { $exists: true, $ne: '' } });
  return `SUP-${String(1000 + count)}`;
}

export const PARTNER_POPULATE = [
  {
    path: 'parentCompanyId',
    select: 'name nameEn nameAr vatNumber crNumber address receivableAccountId payableAccountId paymentTermsCustomer paymentTermsVendor type',
  },
  { path: 'receivableAccountId', select: 'code name nameEn nameAr' },
  { path: 'payableAccountId', select: 'code name nameEn nameAr' },
  { path: 'salespersonId', select: 'firstName lastName firstNameAr lastNameAr email' },
];

/** Saudi VAT: exactly 15 digits (ZATCA). */
export function validateSaVat(vatNumber, country = 'SA') {
  const v = String(vatNumber || '').trim();
  if (!v) return { ok: true };
  const cc = String(country || 'SA').toUpperCase();
  if (cc === 'SA' || cc === 'SAUDI ARABIA') {
    if (!/^\d{15}$/.test(v)) {
      return { ok: false, error: 'VAT number must be exactly 15 digits for Saudi Arabia' };
    }
  }
  return { ok: true };
}

function plainAddress(addr) {
  if (!addr) return {};
  return typeof addr.toObject === 'function' ? addr.toObject() : { ...addr };
}

/** Fill empty child fields from parent company (address, tax, accounting). */
export async function inheritFromParentCompany(data, tenantId) {
  if (!data.parentCompanyId) return data;
  const parent = await Partner.findOne({ _id: data.parentCompanyId, tenantId }).lean();
  if (!parent) return data;

  const out = { ...data };
  if (!out.vatNumber && parent.vatNumber) out.vatNumber = parent.vatNumber;
  if (!out.crNumber && parent.crNumber) out.crNumber = parent.crNumber;
  if (!out.receivableAccountId && parent.receivableAccountId) {
    out.receivableAccountId = parent.receivableAccountId;
  }
  if (!out.payableAccountId && parent.payableAccountId) {
    out.payableAccountId = parent.payableAccountId;
  }
  if (!out.paymentTermsCustomer && parent.paymentTermsCustomer) {
    out.paymentTermsCustomer = parent.paymentTermsCustomer;
  }
  if (!out.paymentTermsVendor && parent.paymentTermsVendor) {
    out.paymentTermsVendor = parent.paymentTermsVendor;
  }

  const parentAddr = plainAddress(parent.address);
  const childAddr = plainAddress(out.address);
  out.address = { ...parentAddr };
  for (const key of Object.keys(parentAddr)) {
    if (childAddr[key]) out.address[key] = childAddr[key];
  }

  return out;
}

function normalizeBankAccounts(accounts = []) {
  if (!Array.isArray(accounts)) return [];
  return accounts
    .map((row) => ({
      bankName: String(row.bankName || '').trim(),
      accountName: String(row.accountName || row.beneficiaryName || '').trim(),
      iban: String(row.iban || '').trim(),
      accountNumber: String(row.accountNumber || '').trim(),
      isDefault: Boolean(row.isDefault),
    }))
    .filter((row) => row.bankName || row.iban || row.accountNumber);
}

/** Map unified partner form/API body → Partner document fields */
export function fromPartnerBody(body = {}) {
  let out = fromCustomerBody(fromSupplierBody({ ...body }));

  if (body.entity === 'individual') out.type = 'individual';
  if (body.entity === 'company') out.type = 'business';

  const nameEn = String(body.nameEn || body.name || '').trim();
  if (nameEn) {
    out.name = nameEn;
    out.nameEn = nameEn;
  }
  if (body.nameAr != null) out.nameAr = String(body.nameAr).trim();

  if (body.paymentTermsVendorTerm) {
    out.paymentTermsVendor = { term: body.paymentTermsVendorTerm };
  }

  if (Array.isArray(body.bankAccounts)) {
    out.bankAccounts = normalizeBankAccounts(body.bankAccounts);
    const primary = out.bankAccounts.find((b) => b.isDefault) || out.bankAccounts[0];
    if (primary) {
      out.bank = {
        iban: primary.iban || primary.accountNumber,
        bankName: primary.bankName,
        beneficiaryName: primary.accountName,
      };
    }
  }

  if (body.salespersonId === '' || body.salespersonId == null) {
    out.salespersonId = null;
  } else if (body.salespersonId) {
    out.salespersonId = body.salespersonId;
  }

  if (body.logoUrl != null) out.logoUrl = String(body.logoUrl);

  delete out.entity;
  delete out.firstName;
  delete out.lastName;
  delete out.jobTitle;
  delete out.paymentTermsVendorTerm;

  return out;
}

/** Shape Partner document for unified partner API */
export function toPartnerDto(doc) {
  if (!doc) return doc;
  const o = typeof doc.toObject === 'function' ? doc.toObject({ virtuals: true }) : { ...doc };

  const bankAccounts = Array.isArray(o.bankAccounts) && o.bankAccounts.length
    ? o.bankAccounts
    : (o.bank?.iban || o.bank?.bankName
      ? [{
        bankName: o.bank.bankName || '',
        accountName: o.bank.beneficiaryName || '',
        iban: o.bank.iban || '',
        accountNumber: o.bank.iban || '',
        isDefault: true,
      }]
      : []);

  return {
    ...o,
    nameEn: o.nameEn || o.name || '',
    paymentTerms: o.paymentTermsCustomer || o.paymentTerms,
    code: o.supplierCode || o.customerCode || o.code || '',
    internalRef: o.customerCode || o.supplierCode || null,
    customerCode: o.customerCode || null,
    supplierCode: o.supplierCode || null,
    bankAccounts,
    paymentTermsVendorTerm: o.paymentTermsVendor?.term || null,
  };
}

export { Partner };
