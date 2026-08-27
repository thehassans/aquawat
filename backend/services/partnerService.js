import Partner from '../models/Partner.js';

/** Role filters for customer / supplier API facades */
export function asCustomerQuery(extra = {}) {
  return { isCustomer: true, ...extra };
}

export function asVendorQuery(extra = {}) {
  return { isVendor: true, ...extra };
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

export { Partner };
