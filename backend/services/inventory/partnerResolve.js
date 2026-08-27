import Partner from '../../models/Partner.js';
import { toObjectId } from '../../models/inventory/common.js';

/**
 * Shape Partner → transfer supplier DTO (toSupplierDto field mapping).
 * code ← supplierCode; nameEn ← nameEn || name
 */
function asSupplierPartner(doc) {
  const nameEn = doc.nameEn || doc.name;
  return {
    _id: doc._id,
    name: nameEn,
    nameEn,
    nameAr: doc.nameAr,
    code: doc.supplierCode || null,
    kind: 'supplier',
  };
}

function asCustomerPartner(doc) {
  return {
    _id: doc._id,
    name: doc.name || doc.nameEn,
    nameEn: doc.nameEn || doc.name,
    nameAr: doc.nameAr,
    stockWarn: doc.stockWarn,
    stockWarnMsg: doc.stockWarnMsg,
    kind: 'customer',
  };
}

/**
 * Resolve transfer partner display fields from unified Partner collection.
 * Incoming / preferSupplier + isVendor → supplier; else isCustomer → customer; else vendor fallback.
 */
export async function resolveTransferPartner(tenantId, partnerId, opCode = null) {
  if (!partnerId) return null;
  const tid = toObjectId(tenantId);
  const id = toObjectId(partnerId);
  const preferSupplier = opCode === 'incoming';

  const partner = await Partner.findOne({ _id: id, tenantId: tid })
    .select('name nameEn nameAr supplierCode isCustomer isVendor stockWarn stockWarnMsg')
    .lean();
  if (!partner) return null;

  if (preferSupplier && partner.isVendor) {
    return asSupplierPartner(partner);
  }
  if (partner.isCustomer) {
    return asCustomerPartner(partner);
  }
  return asSupplierPartner(partner);
}

/**
 * Batch-resolve partners for a list of transfers (already lean, with operationTypeId populated).
 * Single Partner.find for all ids; map by role preference same as resolveTransferPartner.
 */
export async function attachPartnersToTransfers(tenantId, transfers = []) {
  if (!transfers.length) return transfers;
  const tid = toObjectId(tenantId);

  const ids = new Set();
  for (const t of transfers) {
    if (!t.partnerId) continue;
    ids.add(String(t.partnerId?._id || t.partnerId));
  }

  if (!ids.size) {
    return transfers.map((t) => ({
      ...t,
      partner: null,
      partnerId: t.partnerId?._id || t.partnerId || null,
    }));
  }

  const partners = await Partner.find({
    tenantId: tid,
    _id: { $in: [...ids].map((id) => toObjectId(id)) },
  })
    .select('name nameEn nameAr supplierCode isCustomer isVendor stockWarn stockWarnMsg')
    .lean();

  const partnerMap = new Map(partners.map((p) => [String(p._id), p]));

  return transfers.map((t) => {
    const pid = t.partnerId?._id || t.partnerId;
    if (!pid) return { ...t, partner: null, partnerId: null };
    const doc = partnerMap.get(String(pid));
    if (!doc) {
      return { ...t, partner: null, partnerId: pid };
    }

    const preferSupplier = (t.operationTypeId?.code || null) === 'incoming';
    let partner = null;
    if (preferSupplier && doc.isVendor) {
      partner = asSupplierPartner(doc);
    } else if (doc.isCustomer) {
      partner = asCustomerPartner(doc);
    } else {
      partner = asSupplierPartner(doc);
    }

    return {
      ...t,
      partner,
      partnerId: pid,
    };
  });
}
