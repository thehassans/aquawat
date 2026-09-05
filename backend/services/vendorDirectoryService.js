import Partner from '../models/Partner.js';
import Invoice from '../models/Invoice.js';
import AccountPayment from '../models/AccountPayment.js';
import { getPartnerBalances } from './ledger/balances.js';
import { findPaymentTerm } from '../utils/invoicePaymentTerms.js';
import { isValidSaudiVat, assertSaudiVat, isEmptyOrValidSaudiVat } from '../utils/saudiVat.js';

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/** @deprecated use isEmptyOrValidSaudiVat from utils/saudiVat.js */
export function isValidSaudiVatNumber(vat) {
  return isEmptyOrValidSaudiVat(vat);
}

/** @deprecated use assertSaudiVat from utils/saudiVat.js */
export function assertSaudiVatNumber(vat, opts) {
  return assertSaudiVat(vat, opts);
}

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

const VENDOR_TERMS_LABEL = {
  immediate: { en: 'Immediate', ar: 'فوري' },
  net_7: { en: 'Net 7', ar: 'صافي 7' },
  net_15: { en: 'Net 15', ar: 'صافي 15' },
  net_30: { en: 'Net 30', ar: 'صافي 30' },
  net_60: { en: 'Net 60', ar: 'صافي 60' },
  net7: { en: 'Net 7', ar: 'صافي 7' },
  net15: { en: 'Net 15', ar: 'صافي 15' },
  net30: { en: 'Net 30', ar: 'صافي 30' },
  net60: { en: 'Net 60', ar: 'صافي 60' },
};

/** Map legacy vendor term → catalog paymentTermsId */
const LEGACY_TO_CATALOG = {
  immediate: 'immediate',
  net_7: 'net7',
  net_15: 'net15',
  net_30: 'net30',
  net_60: 'net60',
};

export function resolveVendorPaymentTermsId(partner = {}) {
  const catalogId = String(partner.paymentTermsId || '').trim();
  if (catalogId && findPaymentTerm(catalogId)) return catalogId;
  const legacy = partner.paymentTermsVendor?.term || partner.paymentTermsVendorTerm || '';
  return LEGACY_TO_CATALOG[legacy] || legacy || 'net30';
}

export function paymentTermsLabelVendor(partnerOrTerms, language = 'en') {
  if (partnerOrTerms && typeof partnerOrTerms === 'object') {
    const id = resolveVendorPaymentTermsId(partnerOrTerms);
    const catalog = findPaymentTerm(id);
    if (catalog) return language === 'ar' ? catalog.labelAr : catalog.labelEn;
    const legacy = partnerOrTerms.paymentTermsVendor?.term || id;
    const row = VENDOR_TERMS_LABEL[legacy];
    if (row) return language === 'ar' ? row.ar : row.en;
    return legacy || '—';
  }
  const key = String(partnerOrTerms || '').toLowerCase();
  const catalog = findPaymentTerm(key);
  if (catalog) return language === 'ar' ? catalog.labelAr : catalog.labelEn;
  const row = VENDOR_TERMS_LABEL[key];
  if (!row) return partnerOrTerms || '—';
  return language === 'ar' ? row.ar : row.en;
}

/**
 * Accounting vendor directory with live AP from getPartnerBalances (COA 2000).
 * Includes isVendor partners + any partner that has purchase invoices.
 */
export async function listAccountingVendors(tenantId, {
  search = '',
  page = 1,
  limit = 50,
  sort = 'name',
  order = 'asc',
  hasOpenBalance = false,
  overdueOnly = false,
  isActive = 'all',
  city = '',
  ownerUser = null,
} = {}) {
  const filter = {
    tenantId,
    isVendor: true,
    mergedIntoId: null,
  };

  if (isActive === 'true' || isActive === true) filter.isActive = true;
  if (isActive === 'false' || isActive === false) filter.isActive = false;
  if (city) filter['address.city'] = new RegExp(String(city).trim(), 'i');

  if (search) {
    const q = String(search).trim();
    filter.$and = (filter.$and || []).concat([{
      $or: [
        { name: new RegExp(q, 'i') },
        { nameEn: new RegExp(q, 'i') },
        { nameAr: new RegExp(q, 'i') },
        { vatNumber: new RegExp(q, 'i') },
        { phone: new RegExp(q, 'i') },
        { mobile: new RegExp(q, 'i') },
        { supplierCode: new RegExp(q, 'i') },
        { email: new RegExp(q, 'i') },
      ],
    }]);
  }

  const invoiceMatch = {
    tenantId,
    flow: 'purchase',
    supplierId: { $ne: null },
  };
  if (ownerUser?._id) invoiceMatch.createdBy = ownerUser._id;

  const invoicePartnerIds = await Invoice.distinct('supplierId', invoiceMatch);

  if (ownerUser?._id) {
    filter.$and = (filter.$and || []).concat([{
      $or: [
        { createdBy: ownerUser._id },
        { _id: { $in: invoicePartnerIds } },
      ],
    }]);
  }

  const basePartners = await Partner.find(filter)
    .select('name nameEn nameAr vatNumber crNumber phone mobile email creditLimit paymentTermsVendor paymentTermsId address isActive supplierCode tags type bank bankAccounts defaultExpenseAccountId totalPurchases totalInvoices')
    .lean();

  const baseIds = new Set(basePartners.map((p) => String(p._id)));
  const missingIds = invoicePartnerIds
    .map((id) => String(id))
    .filter((id) => id && !baseIds.has(id));

  let extras = [];
  if (missingIds.length) {
    extras = await Partner.find({ _id: { $in: missingIds }, tenantId, mergedIntoId: null })
      .select('name nameEn nameAr vatNumber crNumber phone mobile email creditLimit paymentTermsVendor paymentTermsId address isActive supplierCode tags type bank bankAccounts defaultExpenseAccountId totalPurchases totalInvoices isVendor')
      .lean();
  }

  const allPartners = [...basePartners, ...extras];

  const balances = await getPartnerBalances({
    tenantId,
    partnerType: 'vendor',
  });
  const balById = new Map();
  for (const b of balances.partners || []) {
    if (b.partnerId) balById.set(String(b.partnerId), b);
  }
  // Advances (negative AP) still belong to the vendor row for transparency
  for (const b of balances.advances || []) {
    if (!b.partnerId) continue;
    const id = String(b.partnerId);
    if (balById.has(id)) continue;
    balById.set(id, {
      ...b,
      openResidual: round2(-(Number(b.advanceAmount) || Math.abs(b.openResidual) || 0)),
    });
  }

  let rows = allPartners.map((p) => {
    const bal = balById.get(String(p._id)) || null;
    const outstanding = round2(bal?.openResidual || 0);
    const overdue = round2(Math.max(
      0,
      (bal?.aging?.d31_60 || 0)
      + (bal?.aging?.d61_90 || 0)
      + (bal?.aging?.d90_plus || bal?.aging?.d90plus || 0),
    ));
    const vat = String(p.vatNumber || '').trim();
    const termsId = resolveVendorPaymentTermsId(p);
    return {
      _id: p._id,
      name: p.name || p.nameEn || '',
      nameEn: p.nameEn || p.name || '',
      nameAr: p.nameAr || '',
      vatNumber: vat,
      crNumber: p.crNumber || '',
      phone: p.mobile || p.phone || '',
      email: p.email || '',
      creditLimit: Number(p.creditLimit) || 0,
      paymentTermsId: termsId,
      paymentTerms: p.paymentTermsVendor?.term || termsId,
      paymentTermsLabel: paymentTermsLabelVendor(p),
      paymentTermsLabelAr: paymentTermsLabelVendor(p, 'ar'),
      city: p.address?.city || '',
      address: p.address || null,
      isActive: p.isActive !== false,
      supplierCode: p.supplierCode || '',
      tags: p.tags || [],
      type: p.type || 'business',
      defaultExpenseAccountId: p.defaultExpenseAccountId || null,
      bank: p.bank || null,
      bankAccounts: p.bankAccounts || [],
      outstanding,
      payable: round2(Math.max(0, outstanding)),
      overdue,
      aging: bal?.aging || null,
      invoiceCountOpen: bal?.invoiceCount || 0,
      zatcaStatus: vat && isValidSaudiVat(vat) ? 'verified' : (vat ? 'invalid' : 'unverified'),
    };
  });

  // Include GL-only partners (on 2000) that are not in the vendor master list
  const glExtras = [...(balances.partners || []), ...(balances.advances || [])];
  for (const bal of glExtras) {
    if (!bal.partnerId) continue;
    const id = String(bal.partnerId);
    if (rows.some((r) => String(r._id) === id)) continue;
    const open = bal.advanceAmount != null
      ? round2(-(Number(bal.advanceAmount) || 0))
      : round2(bal.openResidual || 0);
    if (Math.abs(open) < 0.01) continue;
    rows.push({
      _id: bal.partnerId,
      name: bal.partnerName || '—',
      nameEn: bal.partnerName || '—',
      nameAr: bal.partnerNameAr || '',
      vatNumber: bal.vatNumber || '',
      crNumber: '',
      phone: bal.phone || '',
      email: '',
      creditLimit: 0,
      paymentTermsId: 'net30',
      paymentTerms: 'net30',
      paymentTermsLabel: paymentTermsLabelVendor('net30'),
      paymentTermsLabelAr: paymentTermsLabelVendor('net30', 'ar'),
      city: '',
      address: null,
      isActive: true,
      supplierCode: '',
      tags: [],
      type: 'business',
      defaultExpenseAccountId: null,
      bank: null,
      bankAccounts: [],
      outstanding: open,
      payable: Math.max(0, open),
      overdue: round2(Math.max(
        0,
        (bal.aging?.d31_60 || 0) + (bal.aging?.d61_90 || 0) + (bal.aging?.d90_plus || 0),
      )),
      aging: bal.aging || null,
      invoiceCountOpen: bal.invoiceCount || 0,
      zatcaStatus: 'unverified',
      glOnly: true,
      isAdvance: open < -0.005,
    });
  }

  if (hasOpenBalance === true || hasOpenBalance === 'true') {
    rows = rows.filter((r) => Math.abs(r.outstanding) >= 0.01);
  }
  if (overdueOnly === true || overdueOnly === 'true') {
    rows = rows.filter((r) => r.overdue >= 0.01);
  }

  const sortKey = String(sort || 'name');
  const dir = String(order || 'asc').toLowerCase() === 'desc' ? -1 : 1;
  const sortAlias = sortKey === 'payable' ? 'outstanding' : sortKey;
  rows.sort((a, b) => {
    const av = a[sortAlias] ?? a.nameEn ?? '';
    const bv = b[sortAlias] ?? b.nameEn ?? '';
    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
    return String(av).localeCompare(String(bv), undefined, { sensitivity: 'base' }) * dir;
  });

  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(200, Math.max(1, Number(limit) || 50));
  const total = rows.length;
  const paged = rows.slice((pageNum - 1) * limitNum, pageNum * limitNum);

  // KPI payables = sum of directory row payables (positive AP only).
  // Advances + unallocated are surfaced separately so Σ(rows) == KPI.
  const payablesSum = round2(rows.reduce((s, r) => s + Math.max(0, Number(r.payable ?? r.outstanding) || 0), 0));
  const advancesSum = round2(balances.totals?.advanceResidual || 0);
  const unallocatedAmount = round2(balances.totals?.unallocatedAmount || 0);
  const glControlBalance = round2(balances.totals?.glControlBalance ?? balances.totals?.openResidual ?? 0);

  return {
    vendors: paged,
    suppliers: paged,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      pages: Math.ceil(total / limitNum) || 0,
    },
    totals: {
      payablesSum,
      advancesSum,
      unallocatedAmount,
      overdueSum: round2(rows.reduce((s, r) => s + r.overdue, 0)),
      vendorCount: total,
      withOpenBalance: rows.filter((r) => Math.abs(r.outstanding) >= 0.01).length,
      glControlBalance,
      /** Assertion helper: sum(rows.payable) should equal payablesSum */
      rowsPayableSum: payablesSum,
    },
  };
}

export async function checkVendorDuplicate(tenantId, {
  name = '',
  nameEn = '',
  nameAr = '',
  vatNumber = '',
  phone = '',
  excludeId = null,
} = {}) {
  const warnings = [];
  const vat = String(vatNumber || '').trim();
  if (vat) {
    assertSaudiVatNumber(vat);
    const q = { tenantId, vatNumber: vat, isVendor: true, mergedIntoId: null };
    if (excludeId) q._id = { $ne: excludeId };
    const hits = await Partner.find(q).select('name nameEn nameAr vatNumber phone').limit(5).lean();
    for (const h of hits) {
      warnings.push({
        reason: 'vat',
        message: `Same VAT number as "${h.nameEn || h.name}"`,
        messageAr: `نفس الرقم الضريبي لـ "${h.nameAr || h.name}"`,
        vendor: h,
        customer: h,
      });
    }
  }

  const phoneNorm = normalizePhone(phone);
  if (phoneNorm.length >= 8) {
    const candidates = await Partner.find({
      tenantId,
      isVendor: true,
      mergedIntoId: null,
      ...(excludeId ? { _id: { $ne: excludeId } } : {}),
    }).select('name nameEn nameAr phone mobile vatNumber').limit(400).lean();
    for (const h of candidates) {
      const hp = normalizePhone(h.mobile || h.phone);
      if (hp && hp === phoneNorm) {
        warnings.push({
          reason: 'phone',
          message: `Same phone as "${h.nameEn || h.name}"`,
          messageAr: `نفس الهاتف لـ "${h.nameAr || h.name}"`,
          vendor: h,
          customer: h,
        });
      }
    }
  }

  const names = [name, nameEn, nameAr].map((n) => String(n || '').trim()).filter(Boolean);
  if (names.length) {
    const candidates = await Partner.find({
      tenantId,
      isVendor: true,
      mergedIntoId: null,
      ...(excludeId ? { _id: { $ne: excludeId } } : {}),
    }).select('name nameEn nameAr phone vatNumber').limit(500).lean();
    for (const h of candidates) {
      const targets = [h.name, h.nameEn, h.nameAr].map((n) => String(n || '').trim()).filter(Boolean);
      for (const n of names) {
        for (const t of targets) {
          const dist = levenshtein(n, t);
          const threshold = Math.max(2, Math.floor(Math.min(n.length, t.length) * 0.25));
          if (dist <= threshold && n.length >= 3 && t.length >= 3) {
            warnings.push({
              reason: 'name',
              message: `Similar name to "${h.nameEn || h.name}" (distance ${dist})`,
              messageAr: `اسم مشابه لـ "${h.nameAr || h.name}"`,
              vendor: h,
              customer: h,
              distance: dist,
            });
          }
        }
      }
    }
  }

  const seen = new Set();
  const unique = [];
  for (const w of warnings) {
    const key = `${w.reason}:${w.vendor?._id || w.customer?._id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(w);
  }

  return { hasDuplicates: unique.length > 0, warnings: unique };
}

export async function getAccountingVendorDetail(tenantId, vendorId, { ownerUser = null } = {}) {
  const partner = await Partner.findOne({ _id: vendorId, tenantId }).lean();
  if (!partner) {
    const err = new Error('Vendor not found');
    err.status = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  const [balances, bills, payments] = await Promise.all([
    getPartnerBalances({ tenantId, partnerType: 'vendor', partnerIds: [vendorId] }),
    Invoice.find({
      tenantId,
      supplierId: vendorId,
      flow: 'purchase',
    })
      .sort({ issueDate: -1 })
      .limit(50)
      .select('invoiceNumber issueDate dueDate grandTotal paidAmount paymentStatus status invoiceType currency')
      .lean(),
    AccountPayment.find({
      tenantId,
      partnerId: vendorId,
      direction: 'outbound',
      status: { $ne: 'cancelled' },
    })
      .sort({ date: -1 })
      .limit(50)
      .select('number date amount allocatedAmount unallocatedAmount method status')
      .lean(),
  ]);

  const bal = (balances.partners || []).find((p) => String(p.partnerId) === String(vendorId)) || null;
  const debitNotes = bills.filter((i) => String(i.invoiceType) === '381' || String(i.status) === 'credited');
  const purchaseBills = bills.filter((i) => String(i.invoiceType) !== '381');

  const paidBills = purchaseBills.filter((i) => String(i.paymentStatus) === 'paid' && i.issueDate);
  let avgPaymentDays = null;
  if (paidBills.length) {
    const days = paidBills.map((i) => {
      const issued = new Date(i.issueDate).getTime();
      const dueOrPaid = new Date(i.dueDate || i.issueDate).getTime();
      return Math.max(0, Math.floor((dueOrPaid - issued) / 86400000));
    });
    avgPaymentDays = Math.round(days.reduce((s, d) => s + d, 0) / days.length);
  }

  const totalPurchases = round2(
    partner.totalPurchases
    || purchaseBills.reduce((s, i) => s + (Number(i.grandTotal) || 0), 0),
  );

  const termsId = resolveVendorPaymentTermsId(partner);

  return {
    vendor: {
      ...partner,
      paymentTermsId: termsId,
      paymentTerms: partner.paymentTermsVendor || { term: termsId },
      paymentTermsLabel: paymentTermsLabelVendor(partner),
      zatcaStatus: partner.vatNumber && isValidSaudiVat(partner.vatNumber)
        ? 'verified'
        : (partner.vatNumber ? 'invalid' : 'unverified'),
    },
    kpis: {
      totalPurchases,
      outstanding: round2(bal?.openResidual || 0),
      payable: round2(bal?.openResidual || 0),
      overdue: round2(
        (bal?.aging?.d31_60 || 0) + (bal?.aging?.d61_90 || 0) + (bal?.aging?.d90_plus || 0),
      ),
      averagePaymentDays: avgPaymentDays,
      openBillCount: bal?.invoiceCount || 0,
    },
    bills: purchaseBills,
    payments,
    debitNotes,
    aging: bal?.aging || null,
  };
}
