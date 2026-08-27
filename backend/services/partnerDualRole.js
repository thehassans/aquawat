import Customer from '../models/Customer.js';
import Supplier from '../models/Supplier.js';

/**
 * Keep Customer ↔ Supplier mirrors in sync when dual-role flags are set.
 * Does not merge collections — creates/updates a linked record so pickers
 * find the partner under both /customers and /suppliers.
 */

function addrCopy(address = {}) {
  if (!address || typeof address !== 'object') return undefined;
  return {
    street: address.street || '',
    district: address.district || '',
    city: address.city || '',
    postalCode: address.postalCode || '',
    country: address.country || 'SA',
    buildingNumber: address.buildingNumber || '',
    additionalNumber: address.additionalNumber || '',
  };
}

async function nextSupplierCode(tenantId) {
  const count = await Supplier.countDocuments({ tenantId });
  return `SUP-${String(1000 + count)}`;
}

async function nextCustomerCode(tenantId) {
  const count = await Customer.countDocuments({ tenantId });
  return String(1000 + count);
}

/**
 * After Customer save: if isVendor, ensure linked Supplier exists and stays aligned.
 * @returns {Promise<import('mongoose').Document|null>} updated customer (may reload)
 */
export async function syncCustomerVendorMirror(customer) {
  if (!customer?._id || !customer.tenantId) return customer;

  const wantsVendor = customer.isVendor === true;
  if (!wantsVendor) return customer;

  const tenantId = customer.tenantId;
  let supplier = null;

  if (customer.linkedSupplierId) {
    supplier = await Supplier.findOne({ _id: customer.linkedSupplierId, tenantId });
  }
  if (!supplier) {
    supplier = await Supplier.findOne({ tenantId, linkedCustomerId: customer._id });
  }
  if (!supplier && customer.vatNumber) {
    supplier = await Supplier.findOne({ tenantId, vatNumber: customer.vatNumber });
  }

  const nameEn = customer.name || customer.nameEn || 'Partner';
  const nameAr = customer.nameAr || nameEn;
  const type = customer.type === 'individual' ? 'individual' : 'company';

  if (!supplier) {
    supplier = await Supplier.create({
      tenantId,
      code: await nextSupplierCode(tenantId),
      nameEn,
      nameAr,
      type,
      vatNumber: customer.vatNumber || undefined,
      crNumber: customer.crNumber || undefined,
      phone: customer.phone || customer.mobile || undefined,
      email: customer.email || undefined,
      address: addrCopy(customer.address),
      isVendor: true,
      isCustomer: true,
      isActive: customer.isActive !== false,
      linkedCustomerId: customer._id,
    });
  } else {
    supplier.nameEn = nameEn;
    supplier.nameAr = nameAr;
    supplier.type = type;
    if (customer.vatNumber) supplier.vatNumber = customer.vatNumber;
    if (customer.crNumber) supplier.crNumber = customer.crNumber;
    if (customer.phone || customer.mobile) supplier.phone = customer.phone || customer.mobile;
    if (customer.email) supplier.email = customer.email;
    if (customer.address) supplier.address = { ...(supplier.address || {}), ...addrCopy(customer.address) };
    supplier.isVendor = true;
    supplier.isCustomer = true;
    supplier.isActive = customer.isActive !== false;
    supplier.linkedCustomerId = customer._id;
    await supplier.save();
  }

  if (String(customer.linkedSupplierId || '') !== String(supplier._id)) {
    customer.linkedSupplierId = supplier._id;
    customer.isVendor = true;
    await customer.save();
  }

  return customer;
}

/**
 * After Supplier save: if isCustomer, ensure linked Customer exists and stays aligned.
 */
export async function syncSupplierCustomerMirror(supplier) {
  if (!supplier?._id || !supplier.tenantId) return supplier;

  const wantsCustomer = supplier.isCustomer === true;
  if (!wantsCustomer) return supplier;

  const tenantId = supplier.tenantId;
  let customer = null;

  if (supplier.linkedCustomerId) {
    customer = await Customer.findOne({ _id: supplier.linkedCustomerId, tenantId });
  }
  if (!customer) {
    customer = await Customer.findOne({ tenantId, linkedSupplierId: supplier._id });
  }
  if (!customer && supplier.vatNumber) {
    customer = await Customer.findOne({ tenantId, vatNumber: supplier.vatNumber });
  }

  const name = supplier.nameEn || supplier.nameAr || 'Partner';
  const nameAr = supplier.nameAr || name;
  const type = supplier.type === 'individual' ? 'individual' : 'business';

  if (!customer) {
    customer = await Customer.create({
      tenantId,
      customerCode: await nextCustomerCode(tenantId),
      name,
      nameAr,
      type,
      vatNumber: supplier.vatNumber || undefined,
      crNumber: supplier.crNumber || undefined,
      phone: supplier.phone || undefined,
      email: supplier.email || undefined,
      address: addrCopy(supplier.address),
      isCustomer: true,
      isVendor: true,
      isActive: supplier.isActive !== false,
      linkedSupplierId: supplier._id,
    });
  } else {
    customer.name = name;
    customer.nameAr = nameAr;
    customer.type = type;
    if (supplier.vatNumber) customer.vatNumber = supplier.vatNumber;
    if (supplier.crNumber) customer.crNumber = supplier.crNumber;
    if (supplier.phone) customer.phone = supplier.phone;
    if (supplier.email) customer.email = supplier.email;
    if (supplier.address) customer.address = { ...(customer.address || {}), ...addrCopy(supplier.address) };
    customer.isCustomer = true;
    customer.isVendor = true;
    customer.isActive = supplier.isActive !== false;
    customer.linkedSupplierId = supplier._id;
    await customer.save();
  }

  if (String(supplier.linkedCustomerId || '') !== String(customer._id)) {
    supplier.linkedCustomerId = customer._id;
    supplier.isCustomer = true;
    await supplier.save();
  }

  return supplier;
}

/**
 * One-shot for existing dual-role rows created before mirror hooks existed.
 * Safe to re-run — sync* functions are idempotent.
 */
export async function backfillDualRoleMirrors(tenantId) {
  if (!tenantId) throw new Error('tenantId required');

  const vendorCustomers = await Customer.find({ tenantId, isVendor: true });
  let customersSynced = 0;
  for (const customer of vendorCustomers) {
    await syncCustomerVendorMirror(customer);
    customersSynced += 1;
  }

  const customerSuppliers = await Supplier.find({ tenantId, isCustomer: true });
  let suppliersSynced = 0;
  for (const supplier of customerSuppliers) {
    await syncSupplierCustomerMirror(supplier);
    suppliersSynced += 1;
  }

  return {
    customersSynced,
    suppliersSynced,
    tenantId: String(tenantId),
  };
}
