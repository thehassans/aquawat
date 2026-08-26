import Customer from '../../models/Customer.js';
import Supplier from '../../models/Supplier.js';
import { toObjectId } from '../../models/inventory/common.js';

/**
 * Resolve transfer partner display fields.
 * Outgoing / PoS → Customer (name / nameAr)
 * Incoming → Supplier (nameEn / nameAr) then Customer fallback
 */
export async function resolveTransferPartner(tenantId, partnerId, opCode = null) {
  if (!partnerId) return null;
  const tid = toObjectId(tenantId);
  const id = toObjectId(partnerId);
  const preferSupplier = opCode === 'incoming';

  if (preferSupplier) {
    const supplier = await Supplier.findOne({ _id: id, tenantId: tid })
      .select('nameEn nameAr code')
      .lean();
    if (supplier) {
      return {
        _id: supplier._id,
        name: supplier.nameEn,
        nameEn: supplier.nameEn,
        nameAr: supplier.nameAr,
        code: supplier.code,
        kind: 'supplier',
      };
    }
  }

  const customer = await Customer.findOne({ _id: id, tenantId: tid })
    .select('name nameAr stockWarn stockWarnMsg')
    .lean();
  if (customer) {
    return {
      ...customer,
      nameEn: customer.name,
      kind: 'customer',
    };
  }

  if (!preferSupplier) {
    const supplier = await Supplier.findOne({ _id: id, tenantId: tid })
      .select('nameEn nameAr code')
      .lean();
    if (supplier) {
      return {
        _id: supplier._id,
        name: supplier.nameEn,
        nameEn: supplier.nameEn,
        nameAr: supplier.nameAr,
        code: supplier.code,
        kind: 'supplier',
      };
    }
  }

  return null;
}

/**
 * Batch-resolve partners for a list of transfers (already lean, with operationTypeId populated).
 */
export async function attachPartnersToTransfers(tenantId, transfers = []) {
  if (!transfers.length) return transfers;
  const tid = toObjectId(tenantId);

  const byCode = { incoming: new Set(), other: new Set() };
  for (const t of transfers) {
    if (!t.partnerId) continue;
    const id = String(t.partnerId?._id || t.partnerId);
    const code = t.operationTypeId?.code || null;
    if (code === 'incoming') byCode.incoming.add(id);
    else byCode.other.add(id);
  }

  const allIds = [...new Set([...byCode.incoming, ...byCode.other])];
  if (!allIds.length) {
    return transfers.map((t) => ({
      ...t,
      partner: null,
      partnerId: t.partnerId?._id || t.partnerId || null,
    }));
  }

  const [customers, suppliers] = await Promise.all([
    Customer.find({
      tenantId: tid,
      _id: { $in: allIds.map((id) => toObjectId(id)) },
    }).select('name nameAr stockWarn stockWarnMsg').lean(),
    Supplier.find({
      tenantId: tid,
      _id: { $in: allIds.map((id) => toObjectId(id)) },
    }).select('nameEn nameAr code').lean(),
  ]);

  const customerMap = new Map(customers.map((c) => [String(c._id), c]));
  const supplierMap = new Map(suppliers.map((s) => [String(s._id), s]));

  return transfers.map((t) => {
    const pid = t.partnerId?._id || t.partnerId;
    if (!pid) return { ...t, partner: null, partnerId: null };
    const id = String(pid);
    const code = t.operationTypeId?.code || null;
    let partner = null;
    if (code === 'incoming') {
      const s = supplierMap.get(id);
      if (s) {
        partner = {
          _id: s._id,
          name: s.nameEn,
          nameEn: s.nameEn,
          nameAr: s.nameAr,
          code: s.code,
          kind: 'supplier',
        };
      } else {
        const c = customerMap.get(id);
        if (c) partner = { ...c, nameEn: c.name, kind: 'customer' };
      }
    } else {
      const c = customerMap.get(id);
      if (c) partner = { ...c, nameEn: c.name, kind: 'customer' };
      else {
        const s = supplierMap.get(id);
        if (s) {
          partner = {
            _id: s._id,
            name: s.nameEn,
            nameEn: s.nameEn,
            nameAr: s.nameAr,
            code: s.code,
            kind: 'supplier',
          };
        }
      }
    }
    return {
      ...t,
      partner,
      partnerId: pid,
    };
  });
}
