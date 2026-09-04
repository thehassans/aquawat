import Partner from '../models/Partner.js';
import Invoice from '../models/Invoice.js';
import AccountPayment from '../models/AccountPayment.js';
import { getPartnerBalances } from './ledger/balances.js';

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

const TERMS_LABEL = {
  immediate: { en: 'Immediate', ar: 'فوري' },
  net15: { en: 'Net 15', ar: 'صافي 15' },
  net30: { en: 'Net 30', ar: 'صافي 30' },
  net45: { en: 'Net 45', ar: 'صافي 45' },
  net60: { en: 'Net 60', ar: 'صافي 60' },
  net90: { en: 'Net 90', ar: 'صافي 90' },
};

export function paymentTermsLabel(terms, language = 'en') {
  const key = String(terms || '').toLowerCase();
  const row = TERMS_LABEL[key];
  if (!row) return terms || '—';
  return language === 'ar' ? row.ar : row.en;
}

/**
 * Accounting customer directory with live AR from getPartnerBalances.
 * Includes isCustomer partners + any partner that has sell invoices (covers orphans).
 */
export async function listAccountingCustomers(tenantId, {
  search = '',
  page = 1,
  limit = 50,
  sort = 'name',
  order = 'asc',
  hasOpenBalance = false,
  overdueOnly = false,
  isActive = 'all',
  city = '',
} = {}) {
  const filter = {
    tenantId,
    $or: [{ isCustomer: true }, { isCustomer: { $exists: false } }],
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
        { customerCode: new RegExp(q, 'i') },
        { email: new RegExp(q, 'i') },
      ],
    }]);
  }

  // Also pull partner IDs that appear on sell invoices but might not be flagged isCustomer
  const invoicePartnerIds = await Invoice.distinct('customerId', {
    tenantId,
    flow: { $ne: 'purchase' },
    customerId: { $ne: null },
  });

  const basePartners = await Partner.find(filter)
    .select('name nameEn nameAr vatNumber crNumber phone mobile email creditLimit paymentTermsCustomer address isActive customerCode tags type totalInvoices totalRevenue')
    .lean();

  const baseIds = new Set(basePartners.map((p) => String(p._id)));
  const missingIds = invoicePartnerIds
    .map((id) => String(id))
    .filter((id) => id && !baseIds.has(id));

  let extras = [];
  if (missingIds.length) {
    extras = await Partner.find({ _id: { $in: missingIds }, tenantId })
      .select('name nameEn nameAr vatNumber crNumber phone mobile email creditLimit paymentTermsCustomer address isActive customerCode tags type totalInvoices totalRevenue isCustomer')
      .lean();
  }

  const allPartners = [...basePartners, ...extras];
  const partnerIds = allPartners.map((p) => p._id);

  const balances = await getPartnerBalances({
    tenantId,
    partnerType: 'customer',
    partnerIds,
  });
  const balById = new Map(
    (balances.partners || []).map((b) => [String(b.partnerId), b]),
  );

  let rows = allPartners.map((p) => {
    const bal = balById.get(String(p._id)) || null;
    const outstanding = round2(bal?.openResidual || 0);
    const overdue = round2(
      (bal?.aging?.d31_60 || 0)
      + (bal?.aging?.d61_90 || 0)
      + (bal?.aging?.d90_plus || 0),
    );
    const vat = String(p.vatNumber || '').trim();
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
      paymentTerms: p.paymentTermsCustomer || 'net30',
      paymentTermsLabel: paymentTermsLabel(p.paymentTermsCustomer || 'net30'),
      paymentTermsLabelAr: paymentTermsLabel(p.paymentTermsCustomer || 'net30', 'ar'),
      city: p.address?.city || '',
      address: p.address || null,
      isActive: p.isActive !== false,
      customerCode: p.customerCode || '',
      tags: p.tags || [],
      type: p.type || 'business',
      outstanding,
      overdue,
      aging: bal?.aging || null,
      invoiceCountOpen: bal?.invoiceCount || 0,
      zatcaStatus: vat && isValidSaudiVatNumber(vat) ? 'verified' : (vat ? 'invalid' : 'unverified'),
    };
  });

  if (hasOpenBalance === true || hasOpenBalance === 'true') {
    rows = rows.filter((r) => r.outstanding >= 0.01);
  }
  if (overdueOnly === true || overdueOnly === 'true') {
    rows = rows.filter((r) => r.overdue >= 0.01);
  }

  const sortKey = String(sort || 'name');
  const dir = String(order || 'asc').toLowerCase() === 'desc' ? -1 : 1;
  rows.sort((a, b) => {
    const av = a[sortKey] ?? a.nameEn ?? '';
    const bv = b[sortKey] ?? b.nameEn ?? '';
    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
    return String(av).localeCompare(String(bv), undefined, { sensitivity: 'base' }) * dir;
  });

  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(200, Math.max(1, Number(limit) || 50));
  const total = rows.length;
  const paged = rows.slice((pageNum - 1) * limitNum, pageNum * limitNum);

  const receivablesSum = round2(rows.reduce((s, r) => s + r.outstanding, 0));

  return {
    customers: paged,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      pages: Math.ceil(total / limitNum) || 0,
    },
    totals: {
      receivablesSum,
      overdueSum: round2(rows.reduce((s, r) => s + r.overdue, 0)),
      customerCount: total,
      withOpenBalance: rows.filter((r) => r.outstanding >= 0.01).length,
    },
  };
}

export async function checkCustomerDuplicate(tenantId, {
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
    const q = { tenantId, vatNumber: vat, isCustomer: true };
    if (excludeId) q._id = { $ne: excludeId };
    const hits = await Partner.find(q).select('name nameEn nameAr vatNumber phone').limit(5).lean();
    for (const h of hits) {
      warnings.push({
        reason: 'vat',
        message: `Same VAT number as "${h.nameEn || h.name}"`,
        messageAr: `نفس الرقم الضريبي لـ "${h.nameAr || h.name}"`,
        customer: h,
      });
    }
  }

  const phoneNorm = normalizePhone(phone);
  if (phoneNorm.length >= 8) {
    const candidates = await Partner.find({
      tenantId,
      isCustomer: true,
      ...(excludeId ? { _id: { $ne: excludeId } } : {}),
    }).select('name nameEn nameAr phone mobile vatNumber').limit(400).lean();
    for (const h of candidates) {
      const hp = normalizePhone(h.mobile || h.phone);
      if (hp && hp === phoneNorm) {
        warnings.push({
          reason: 'phone',
          message: `Same phone as "${h.nameEn || h.name}"`,
          messageAr: `نفس الهاتف لـ "${h.nameAr || h.name}"`,
          customer: h,
        });
      }
    }
  }

  const names = [name, nameEn, nameAr].map((n) => String(n || '').trim()).filter(Boolean);
  if (names.length) {
    const candidates = await Partner.find({
      tenantId,
      isCustomer: true,
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
              customer: h,
              distance: dist,
            });
          }
        }
      }
    }
  }

  // Dedupe by customer id
  const seen = new Set();
  const unique = [];
  for (const w of warnings) {
    const key = `${w.reason}:${w.customer?._id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(w);
  }

  return { hasDuplicates: unique.length > 0, warnings: unique };
}

export async function getAccountingCustomerDetail(tenantId, customerId) {
  const partner = await Partner.findOne({ _id: customerId, tenantId }).lean();
  if (!partner) {
    const err = new Error('Customer not found');
    err.status = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  const [balances, invoices, payments] = await Promise.all([
    getPartnerBalances({ tenantId, partnerType: 'customer', partnerIds: [customerId] }),
    Invoice.find({
      tenantId,
      customerId,
      flow: { $ne: 'purchase' },
    })
      .sort({ issueDate: -1 })
      .limit(50)
      .select('invoiceNumber issueDate dueDate grandTotal paidAmount paymentStatus status invoiceType currency')
      .lean(),
    AccountPayment.find({
      tenantId,
      partnerId: customerId,
      direction: 'inbound',
      status: { $ne: 'cancelled' },
    })
      .sort({ date: -1 })
      .limit(50)
      .select('number date amount allocatedAmount unallocatedAmount method status')
      .lean(),
  ]);

  const bal = (balances.partners || [])[0] || null;
  const creditNotes = invoices.filter((i) => String(i.invoiceType) === '381' || String(i.status) === 'credited');

  const paidInvoices = invoices.filter((i) => String(i.paymentStatus) === 'paid' && i.issueDate && i.dueDate);
  let avgPaymentDays = null;
  if (paidInvoices.length) {
    const days = paidInvoices.map((i) => {
      const issued = new Date(i.issueDate).getTime();
      // approximate: use updated paid via due vs issue when no paidAt
      return Math.max(0, Math.floor((new Date(i.dueDate) - new Date(i.issueDate)) / 86400000));
    });
    avgPaymentDays = Math.round(days.reduce((s, d) => s + d, 0) / days.length);
  }

  return {
    customer: {
      ...partner,
      paymentTerms: partner.paymentTermsCustomer || partner.paymentTerms || 'net30',
      zatcaStatus: partner.vatNumber && isValidSaudiVatNumber(partner.vatNumber)
        ? 'verified'
        : (partner.vatNumber ? 'invalid' : 'unverified'),
    },
    kpis: {
      totalBusiness: round2(partner.totalRevenue || invoices.reduce((s, i) => s + (Number(i.grandTotal) || 0), 0)),
      outstanding: round2(bal?.openResidual || 0),
      overdue: round2(
        (bal?.aging?.d31_60 || 0) + (bal?.aging?.d61_90 || 0) + (bal?.aging?.d90_plus || 0),
      ),
      averagePaymentDays: avgPaymentDays,
      openInvoiceCount: bal?.invoiceCount || 0,
    },
    invoices,
    payments,
    creditNotes,
    aging: bal?.aging || null,
  };
}
