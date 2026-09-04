/**
 * Detect & merge duplicate customer (partner) records.
 * Re-points sell AR documents to primary; archives duplicates (no hard delete).
 */
import mongoose from 'mongoose';
import Partner from '../../models/Partner.js';
import Invoice from '../../models/Invoice.js';
import AccountPayment from '../../models/AccountPayment.js';
import JournalEntry from '../../models/JournalEntry.js';
import JournalItem from '../../models/JournalItem.js';
import Quotation from '../../models/Quotation.js';
import DeliveryNote from '../../models/DeliveryNote.js';
import PurchaseOrder from '../../models/PurchaseOrder.js';
import Transaction from '../../models/Transaction.js';
import Voucher from '../../models/Voucher.js';
import Expense from '../../models/Expense.js';
import { getPartnerBalances } from '../ledger/balances.js';

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

function normalizePhone(phone) {
  return String(phone || '').replace(/\D/g, '');
}

function levenshtein(a, b) {
  const s = String(a || '').toLowerCase().trim();
  const t = String(b || '').toLowerCase().trim();
  if (s === t) return 0;
  if (!s.length) return t.length;
  if (!t.length) return s.length;
  const row = Array.from({ length: t.length + 1 }, (_, i) => i);
  for (let i = 0; i < s.length; i += 1) {
    let prev = i + 1;
    for (let j = 0; j < t.length; j += 1) {
      const cur = s[i] === t[j] ? row[j] : Math.min(row[j], row[j + 1], prev) + 1;
      row[j] = prev;
      prev = cur;
    }
    row[t.length] = prev;
  }
  return row[t.length];
}

function namesSimilar(a, b) {
  const n = String(a || '').trim();
  const t = String(b || '').trim();
  if (!n || !t || n.length < 3 || t.length < 3) return false;
  const dist = levenshtein(n, t);
  const threshold = Math.max(2, Math.floor(Math.min(n.length, t.length) * 0.25));
  // Also treat containment as match ("ahtisham" ⊂ "Ahtisham Ul Hassan")
  const lowerN = n.toLowerCase();
  const lowerT = t.toLowerCase();
  if (lowerN.includes(lowerT) || lowerT.includes(lowerN)) {
    if (Math.min(n.length, t.length) >= 4) return true;
  }
  return dist <= threshold;
}

class UnionFind {
  constructor(ids) {
    this.parent = new Map();
    for (const id of ids) this.parent.set(id, id);
  }

  find(x) {
    let p = this.parent.get(x);
    if (p !== x) {
      p = this.find(p);
      this.parent.set(x, p);
    }
    return p;
  }

  union(a, b) {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra === rb) return;
    this.parent.set(rb, ra);
  }
}

const MERGE_FIELD_KEYS = [
  'name', 'nameEn', 'nameAr', 'email', 'phone', 'mobile',
  'vatNumber', 'crNumber', 'customerCode', 'creditLimit',
  'paymentTermsCustomer', 'notes', 'type',
];

const ADDRESS_KEYS = [
  'street', 'streetAr', 'city', 'cityAr', 'district', 'districtAr',
  'postalCode', 'country', 'buildingNumber', 'additionalNumber', 'shortAddress',
];

/**
 * Cluster active (non-merged) customers by VAT, phone, or fuzzy name.
 */
export async function findCustomerDuplicateGroups(tenantId) {
  const customers = await Partner.find({
    tenantId,
    isCustomer: true,
    mergedIntoId: null,
    isActive: { $ne: false },
  })
    .select('name nameEn nameAr vatNumber phone mobile email customerCode creditLimit address type createdAt')
    .lean();

  if (customers.length < 2) {
    return { groupCount: 0, duplicateCustomerCount: 0, groups: [] };
  }

  const ids = customers.map((c) => String(c._id));
  const uf = new UnionFind(ids);
  const reasons = new Map(); // "idA|idB" -> Set of reasons

  const addReason = (a, b, reason) => {
    const [x, y] = String(a) < String(b) ? [a, b] : [b, a];
    const key = `${x}|${y}`;
    if (!reasons.has(key)) reasons.set(key, new Set());
    reasons.get(key).add(reason);
    uf.union(x, y);
  };

  // VAT
  const byVat = new Map();
  for (const c of customers) {
    const vat = String(c.vatNumber || '').trim();
    if (!vat) continue;
    if (!byVat.has(vat)) byVat.set(vat, []);
    byVat.get(vat).push(c);
  }
  for (const list of byVat.values()) {
    for (let i = 1; i < list.length; i += 1) {
      addReason(String(list[0]._id), String(list[i]._id), 'vat');
    }
  }

  // Phone
  const byPhone = new Map();
  for (const c of customers) {
    const phone = normalizePhone(c.mobile || c.phone);
    if (phone.length < 8) continue;
    if (!byPhone.has(phone)) byPhone.set(phone, []);
    byPhone.get(phone).push(c);
  }
  for (const list of byPhone.values()) {
    for (let i = 1; i < list.length; i += 1) {
      addReason(String(list[0]._id), String(list[i]._id), 'phone');
    }
  }

  // Fuzzy name (O(n²) but n is typically hundreds)
  for (let i = 0; i < customers.length; i += 1) {
    const a = customers[i];
    const aNames = [a.name, a.nameEn, a.nameAr].filter(Boolean);
    for (let j = i + 1; j < customers.length; j += 1) {
      const b = customers[j];
      const bNames = [b.name, b.nameEn, b.nameAr].filter(Boolean);
      let hit = false;
      for (const an of aNames) {
        for (const bn of bNames) {
          if (namesSimilar(an, bn)) {
            hit = true;
            break;
          }
        }
        if (hit) break;
      }
      if (hit) addReason(String(a._id), String(b._id), 'name');
    }
  }

  const byRoot = new Map();
  for (const id of ids) {
    const root = uf.find(id);
    if (!byRoot.has(root)) byRoot.set(root, []);
    byRoot.get(root).push(id);
  }

  const byId = Object.fromEntries(customers.map((c) => [String(c._id), c]));
  const groups = [];
  for (const members of byRoot.values()) {
    if (members.length < 2) continue;
    const reasonSet = new Set();
    for (let i = 0; i < members.length; i += 1) {
      for (let j = i + 1; j < members.length; j += 1) {
        const [x, y] = members[i] < members[j] ? [members[i], members[j]] : [members[j], members[i]];
        const r = reasons.get(`${x}|${y}`);
        if (r) r.forEach((v) => reasonSet.add(v));
      }
    }
    groups.push({
      id: members.slice().sort().join('-'),
      reasons: [...reasonSet],
      customers: members.map((id) => {
        const c = byId[id];
        return {
          _id: c._id,
          name: c.name || c.nameEn || '',
          nameEn: c.nameEn || c.name || '',
          nameAr: c.nameAr || '',
          vatNumber: c.vatNumber || '',
          phone: c.mobile || c.phone || '',
          email: c.email || '',
          customerCode: c.customerCode || '',
          createdAt: c.createdAt,
        };
      }),
    });
  }

  groups.sort((a, b) => b.customers.length - a.customers.length);
  const duplicateCustomerCount = groups.reduce((s, g) => s + g.customers.length, 0);

  return {
    groupCount: groups.length,
    duplicateCustomerCount,
    groups,
  };
}

/**
 * Preview merge impact: document counts + balances that will consolidate.
 */
export async function previewCustomerMerge(tenantId, { primaryId, secondaryIds = [] } = {}) {
  if (!primaryId) throw Object.assign(new Error('primaryId required'), { status: 400 });
  const secondaries = [...new Set((secondaryIds || []).map(String).filter((id) => id && id !== String(primaryId)))];
  if (!secondaries.length) throw Object.assign(new Error('Select at least one duplicate to merge'), { status: 400 });

  const allIds = [primaryId, ...secondaries];
  const partners = await Partner.find({
    _id: { $in: allIds },
    tenantId,
    isCustomer: true,
  }).lean();

  if (partners.length !== allIds.length) {
    throw Object.assign(new Error('One or more customers not found'), { status: 404 });
  }
  for (const p of partners) {
    if (p.mergedIntoId) {
      throw Object.assign(new Error(`Customer "${p.name}" is already merged`), { status: 400 });
    }
  }

  const secondaryOids = secondaries.map((id) => new mongoose.Types.ObjectId(id));
  const allOids = allIds.map((id) => new mongoose.Types.ObjectId(id));

  const [
    invoiceCountPrimary,
    invoiceCountSecondary,
    paymentCountSecondary,
    creditNoteCountSecondary,
    quotationCountSecondary,
    dnCountSecondary,
    soCountSecondary,
    voucherCountSecondary,
    jeLineCount,
    balances,
  ] = await Promise.all([
    Invoice.countDocuments({ tenantId, customerId: primaryId, flow: { $ne: 'purchase' }, status: { $nin: ['draft'] } }),
    Invoice.countDocuments({ tenantId, customerId: { $in: secondaryOids }, flow: { $ne: 'purchase' } }),
    AccountPayment.countDocuments({ tenantId, partnerId: { $in: secondaryOids } }),
    Invoice.countDocuments({
      tenantId,
      customerId: { $in: secondaryOids },
      flow: { $ne: 'purchase' },
      $or: [{ invoiceType: '381' }, { status: 'credited' }],
    }),
    Quotation.countDocuments({ tenantId, customerId: { $in: secondaryOids } }),
    DeliveryNote.countDocuments({ tenantId, customerId: { $in: secondaryOids } }),
    PurchaseOrder.countDocuments({ tenantId, customerId: { $in: secondaryOids }, flow: 'sell' }),
    Voucher.countDocuments({ tenantId, partyId: { $in: secondaryOids }, partyType: 'customer' }).catch(() => 0),
    JournalEntry.countDocuments({
      tenantId,
      'lines.partnerId': { $in: secondaryOids },
    }),
    getPartnerBalances({
      tenantId,
      partnerType: 'customer',
      partnerIds: allIds,
    }),
  ]);

  const balById = Object.fromEntries(
    (balances.partners || []).map((p) => [String(p.partnerId), round2(p.openResidual || 0)]),
  );
  const primaryBalance = balById[String(primaryId)] || 0;
  const secondaryBalance = secondaries.reduce((s, id) => s + (balById[id] || 0), 0);
  const resultingBalance = round2(primaryBalance + secondaryBalance);

  const byPartner = partners.map((p) => ({
    _id: p._id,
    name: p.nameEn || p.name,
    nameAr: p.nameAr || '',
    vatNumber: p.vatNumber || '',
    phone: p.mobile || p.phone || '',
    email: p.email || '',
    creditLimit: p.creditLimit || 0,
    address: p.address || {},
    customerCode: p.customerCode || '',
    paymentTermsCustomer: p.paymentTermsCustomer || 'net30',
    notes: p.notes || '',
    type: p.type || 'business',
    nameEn: p.nameEn || p.name || '',
    mobile: p.mobile || '',
    crNumber: p.crNumber || '',
    balance: balById[String(p._id)] || 0,
    isPrimary: String(p._id) === String(primaryId),
  }));

  return {
    primaryId,
    secondaryIds: secondaries,
    customers: byPartner,
    mergeFields: MERGE_FIELD_KEYS,
    addressFields: ADDRESS_KEYS,
    transfer: {
      invoices: invoiceCountSecondary,
      payments: paymentCountSecondary,
      creditNotes: creditNoteCountSecondary,
      quotations: quotationCountSecondary,
      deliveryNotes: dnCountSecondary,
      salesOrders: soCountSecondary,
      vouchers: voucherCountSecondary,
      journalEntries: jeLineCount,
      balanceSar: secondaryBalance,
    },
    balances: {
      primary: primaryBalance,
      secondary: secondaryBalance,
      resulting: resultingBalance,
      primaryInvoiceCount: invoiceCountPrimary,
      resultingInvoiceEstimate: invoiceCountPrimary + invoiceCountSecondary,
    },
    summary: {
      en: `${invoiceCountSecondary} invoices, ${paymentCountSecondary} payments, ${secondaryBalance.toFixed(2)} SAR balance will transfer`,
      ar: `${invoiceCountSecondary} فاتورة، ${paymentCountSecondary} دفعة، ${secondaryBalance.toFixed(2)} ر.س رصيد سينتقل`,
    },
  };
}

async function remountScalar(Model, field, tenantId, fromIds, toId) {
  const res = await Model.updateMany(
    { tenantId, [field]: { $in: fromIds } },
    { $set: { [field]: toId } },
  );
  return res.modifiedCount || 0;
}

/**
 * Execute merge: re-point docs → apply field picks → archive secondaries.
 */
export async function mergeCustomers(tenantId, {
  primaryId,
  secondaryIds = [],
  fieldChoices = {},
  addressChoices = {},
  userId = null,
} = {}) {
  const preview = await previewCustomerMerge(tenantId, { primaryId, secondaryIds });
  const secondaries = preview.secondaryIds;
  const fromOids = secondaries.map((id) => new mongoose.Types.ObjectId(id));
  const toOid = new mongoose.Types.ObjectId(String(primaryId));

  const remaps = {};

  remaps.invoices = await remountScalar(Invoice, 'customerId', tenantId, fromOids, toOid);
  remaps.payments = await remountScalar(AccountPayment, 'partnerId', tenantId, fromOids, toOid);
  remaps.quotations = await remountScalar(Quotation, 'customerId', tenantId, fromOids, toOid);
  remaps.deliveryNotes = await remountScalar(DeliveryNote, 'customerId', tenantId, fromOids, toOid);
  remaps.salesOrders = (await PurchaseOrder.updateMany(
    { tenantId, customerId: { $in: fromOids }, flow: 'sell' },
    { $set: { customerId: toOid } },
  )).modifiedCount || 0;
  remaps.transactions = await remountScalar(Transaction, 'customerId', tenantId, fromOids, toOid).catch(() => 0);
  remaps.expenses = await remountScalar(Expense, 'customerId', tenantId, fromOids, toOid).catch(() => 0);

  try {
    remaps.vouchers = (await Voucher.updateMany(
      { tenantId, partyId: { $in: fromOids } },
      { $set: { partyId: toOid, partyType: 'customer' } },
    )).modifiedCount || 0;
  } catch {
    remaps.vouchers = 0;
  }

  // Journal entry nested lines
  remaps.journalEntryLines = (await JournalEntry.updateMany(
    { tenantId, 'lines.partnerId': { $in: fromOids } },
    { $set: { 'lines.$[elem].partnerId': toOid } },
    { arrayFilters: [{ 'elem.partnerId': { $in: fromOids } }] },
  )).modifiedCount || 0;

  remaps.journalItems = (await JournalItem.updateMany(
    { tenantId, partnerId: { $in: fromOids } },
    { $set: { partnerId: toOid } },
  ).catch(() => ({ modifiedCount: 0 }))).modifiedCount || 0;

  // Optional: update AccountPayment partnerName
  const primary = await Partner.findOne({ _id: primaryId, tenantId });
  if (!primary) throw Object.assign(new Error('Primary customer not found'), { status: 404 });

  const byId = Object.fromEntries(preview.customers.map((c) => [String(c._id), c]));

  // fieldChoices[key] = partnerId whose value to keep
  const patch = {};
  for (const key of MERGE_FIELD_KEYS) {
    const choice = fieldChoices[key];
    if (choice == null || choice === '') continue;
    const fromPartner = byId[String(choice)];
    if (fromPartner && Object.prototype.hasOwnProperty.call(fromPartner, key)) {
      patch[key] = fromPartner[key];
    }
  }

  // addressChoices: { street: partnerId, ... }
  const addressPatch = { ...(primary.address?.toObject?.() || primary.address || {}) };
  let addressChanged = false;
  for (const key of ADDRESS_KEYS) {
    const choice = addressChoices[key];
    if (!choice) continue;
    const src = byId[String(choice)];
    if (src?.address && Object.prototype.hasOwnProperty.call(src.address, key)) {
      addressPatch[key] = src.address[key];
      addressChanged = true;
    }
  }
  if (addressChanged) patch.address = addressPatch;

  // Ensure name stays required
  if (patch.nameEn && !patch.name) patch.name = patch.nameEn;
  if (patch.name && !patch.nameEn) patch.nameEn = patch.name;

  if (Object.keys(patch).length) {
    Object.assign(primary, patch);
  }

  primary.mergedFromCustomerIds = [
    ...new Set([
      ...(primary.mergedFromCustomerIds || []).map(String),
      ...secondaries,
    ]),
  ];
  await primary.save();

  // Refresh payment display names
  await AccountPayment.updateMany(
    { tenantId, partnerId: toOid },
    { $set: { partnerName: primary.nameEn || primary.name } },
  ).catch(() => {});

  const primaryLabel = primary.nameEn || primary.name || String(primaryId);
  for (const sid of secondaries) {
    await Partner.updateOne(
      { _id: sid, tenantId },
      {
        $set: {
          isActive: false,
          mergedIntoId: toOid,
          mergedAt: new Date(),
          mergedBy: userId || null,
          mergeNote: `Merged into ${primaryLabel}`,
        },
      },
    );
  }

  // Post-merge balances
  const after = await getPartnerBalances({
    tenantId,
    partnerType: 'customer',
    partnerIds: [primaryId],
  });
  const openResidual = round2(
    (after.partners || []).find((p) => String(p.partnerId) === String(primaryId))?.openResidual || 0,
  );

  const invoiceCount = await Invoice.countDocuments({
    tenantId,
    customerId: primaryId,
    flow: { $ne: 'purchase' },
  });

  return {
    success: true,
    primaryId,
    archivedIds: secondaries,
    remaps,
    preview: preview.transfer,
    resulting: {
      openResidual,
      invoiceCount,
      expectedBalance: preview.balances.resulting,
    },
  };
}

export { MERGE_FIELD_KEYS, ADDRESS_KEYS };
