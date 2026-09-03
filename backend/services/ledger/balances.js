/**
 * Single source of truth for GL account balances and partner (AR/AP) open residuals.
 *
 * Sign convention
 * ---------------
 * rawDebitMinusCredit = debit − credit (always)
 * naturalBalance      = debit nature (asset/expense) → debit − credit
 *                     = credit nature (liability/equity/revenue) → credit − debit
 *
 * Reversals
 * ---------
 * Default excludeReversalPairs=true:
 *   - skip status void / reversed / draft
 *   - skip counter-entries (type=reversal OR reversalOfId set)
 * So a reversed pair contributes 0 — matching ChartOfAccount.balance after
 * applyBalanceDelta on both post and reverse.
 */

import mongoose from 'mongoose';
import ChartOfAccount from '../../models/ChartOfAccount.js';
import JournalEntry from '../../models/JournalEntry.js';
import Invoice from '../../models/Invoice.js';
import Customer from '../../models/Customer.js';

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const DEBIT_NATURE = new Set(['asset', 'expense']);

export function isDebitNature(type) {
  return DEBIT_NATURE.has(String(type || '').toLowerCase());
}

export function toNaturalBalance(type, debit, credit) {
  const d = Number(debit) || 0;
  const c = Number(credit) || 0;
  const raw = round2(d - c);
  const natural = isDebitNature(type) ? raw : round2(c - d);
  return { rawDebitMinusCredit: raw, naturalBalance: natural };
}

export function agingBucket(ageDays) {
  const d = Math.max(0, Number(ageDays) || 0);
  if (d <= 30) return 'd0_30';
  if (d <= 60) return 'd31_60';
  if (d <= 90) return 'd61_90';
  return 'd90_plus';
}

export function emptyAgingBuckets() {
  return { d0_30: 0, d31_60: 0, d61_90: 0, d90_plus: 0, total: 0 };
}

/**
 * Status / reversal pair filter for journal balance rebuilds.
 * When includeDraft / includeReversed / includeVoid are true, those statuses are added.
 * Counter-entries of reversals are still excluded unless includeReversed is true
 * (otherwise COA and TB diverge by the reversal amount).
 */
export function journalStatusMatch({
  includeDraft = false,
  includeReversed = false,
  includeVoid = false,
} = {}) {
  const statuses = ['posted'];
  if (includeDraft) statuses.push('draft');
  if (includeReversed) statuses.push('reversed');
  if (includeVoid) statuses.push('void');

  const match = { status: { $in: statuses } };

  // Exclude reversal counter-entries unless caller wants full reversal history
  if (!includeReversed) {
    match.$and = [
      { $or: [{ type: { $ne: 'reversal' } }, { type: { $exists: false } }] },
      {
        $or: [
          { reversalOfId: null },
          { reversalOfId: { $exists: false } },
        ],
      },
    ];
  }

  return match;
}

function endOfDay(d) {
  if (!d) return null;
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return null;
  x.setHours(23, 59, 59, 999);
  return x;
}

function startOfDay(d) {
  if (!d) return null;
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return null;
  x.setHours(0, 0, 0, 0);
  return x;
}

/**
 * Aggregate debit/credit per account from journal lines (MongoDB pipeline).
 *
 * @returns {Map<string, { debit, credit }>}
 */
export async function aggregateAccountMovements(tenantId, {
  accountIds = null,
  from = null,
  to = null,
  includeDraft = false,
  includeReversed = false,
  includeVoid = false,
} = {}) {
  const match = {
    tenantId: new mongoose.Types.ObjectId(String(tenantId)),
    ...journalStatusMatch({ includeDraft, includeReversed, includeVoid }),
  };

  const fromD = startOfDay(from);
  const toD = endOfDay(to);
  if (fromD || toD) {
    match.entryDate = {};
    if (fromD) match.entryDate.$gte = fromD;
    if (toD) match.entryDate.$lte = toD;
  }

  const pipeline = [
    { $match: match },
    { $unwind: '$lines' },
  ];

  if (Array.isArray(accountIds) && accountIds.length) {
    pipeline.push({
      $match: {
        'lines.accountId': {
          $in: accountIds.map((id) => new mongoose.Types.ObjectId(String(id))),
        },
      },
    });
  }

  pipeline.push({
    $group: {
      _id: '$lines.accountId',
      debit: { $sum: { $ifNull: ['$lines.debit', 0] } },
      credit: { $sum: { $ifNull: ['$lines.credit', 0] } },
    },
  });

  const rows = await JournalEntry.aggregate(pipeline);
  const map = new Map();
  for (const row of rows) {
    map.set(String(row._id), {
      debit: round2(row.debit),
      credit: round2(row.credit),
    });
  }
  return map;
}

/**
 * Account balances with natural + raw signs.
 *
 * - If `from`+`to`: returns period movement; set withOpening=true to also
 *   attach initialBalance (movements strictly before `from`) and endingBalance.
 * - If only `to` / asOf: ending balance as of that date.
 * - If neither: all-time ending balance (same filter as COA should show).
 */
export async function getAccountBalances({
  tenantId,
  accountIds = null,
  from = null,
  to = null,
  asOf = null,
  includeDraft = false,
  includeReversed = false,
  includeVoid = false,
  activeOnly = true,
  withOpening = false,
} = {}) {
  if (!tenantId) throw new Error('tenantId is required');

  const accountFilter = { tenantId };
  if (activeOnly) accountFilter.isActive = true;
  if (Array.isArray(accountIds) && accountIds.length) {
    accountFilter._id = { $in: accountIds };
  }

  const accounts = await ChartOfAccount.find(accountFilter).sort({ code: 1 }).lean();
  const ids = accounts.map((a) => a._id);

  const opts = { includeDraft, includeReversed, includeVoid, accountIds: ids };

  const effectiveTo = to || asOf || null;
  const wantPeriod = Boolean(from && effectiveTo);
  const wantOpening = wantPeriod && withOpening;

  const [openingMap, movementMap] = await Promise.all([
    wantOpening
      ? aggregateAccountMovements(tenantId, {
          ...opts,
          from: null,
          to: new Date(startOfDay(from).getTime() - 1),
        })
      : Promise.resolve(new Map()),
    aggregateAccountMovements(tenantId, {
      ...opts,
      from: wantPeriod ? from : null,
      to: effectiveTo,
    }),
  ]);

  const rows = accounts.map((a) => {
    const key = String(a._id);
    const move = movementMap.get(key) || { debit: 0, credit: 0 };
    const open = openingMap.get(key) || { debit: 0, credit: 0 };

    const openSigns = toNaturalBalance(a.type, open.debit, open.credit);
    const moveSigns = toNaturalBalance(a.type, move.debit, move.credit);

    let endingDebit;
    let endingCredit;
    if (wantOpening) {
      endingDebit = round2(open.debit + move.debit);
      endingCredit = round2(open.credit + move.credit);
    } else {
      endingDebit = move.debit;
      endingCredit = move.credit;
    }
    const endSigns = toNaturalBalance(a.type, endingDebit, endingCredit);

    const initialBalance = wantOpening ? openSigns.naturalBalance : 0;
    const endingBalance = endSigns.naturalBalance;

    return {
      accountId: a._id,
      code: a.code,
      name: a.name,
      nameAr: a.nameAr,
      type: a.type,
      subtype: a.subtype,
      debit: move.debit,
      credit: move.credit,
      initialBalance: round2(initialBalance),
      endingBalance: round2(endingBalance),
      /** Alias used by TB / dashboard / BS */
      balance: round2(endingBalance),
      naturalBalance: round2(endingBalance),
      rawDebitMinusCredit: endSigns.rawDebitMinusCredit,
      storedBalance: round2(a.balance || 0),
    };
  });

  return {
    asOf: effectiveTo ? endOfDay(effectiveTo) : new Date(),
    from: from ? startOfDay(from) : null,
    to: effectiveTo ? endOfDay(effectiveTo) : null,
    mode: wantPeriod ? (wantOpening ? 'period' : 'period_movement') : (effectiveTo ? 'asOf' : 'allTime'),
    includeDraft,
    includeReversed,
    includeVoid,
    rows,
  };
}

/**
 * Partner open AR/AP from invoices (residual = grandTotal − paidAmount).
 * Aging from due date (fallback issue date).
 */
export async function getPartnerBalances({
  tenantId,
  partnerIds = null,
  partnerType = 'customer',
  asOf = null,
} = {}) {
  if (!tenantId) throw new Error('tenantId is required');
  const flow = partnerType === 'vendor' ? 'purchase' : 'sell';
  const asOfDate = endOfDay(asOf) || endOfDay(new Date());

  const match = {
    tenantId: new mongoose.Types.ObjectId(String(tenantId)),
    flow,
    status: { $nin: ['draft', 'cancelled', 'credited'] },
    paymentStatus: { $nin: ['paid', 'cancelled'] },
    issueDate: { $lte: asOfDate },
  };

  const partnerField = flow === 'sell' ? 'customerId' : 'supplierId';
  if (Array.isArray(partnerIds) && partnerIds.length) {
    match[partnerField] = {
      $in: partnerIds.map((id) => new mongoose.Types.ObjectId(String(id))),
    };
  }

  const invoiceRows = await Invoice.aggregate([
    { $match: match },
    {
      $addFields: {
        residual: {
          $round: [
            {
              $max: [
                0,
                { $subtract: [{ $ifNull: ['$grandTotal', 0] }, { $ifNull: ['$paidAmount', 0] }] },
              ],
            },
            2,
          ],
        },
        partnerId: { $ifNull: [`$${partnerField}`, '$customerId'] },
        dueForAge: { $ifNull: ['$dueDate', '$issueDate'] },
      },
    },
    { $match: { residual: { $gte: 0.01 } } },
    {
      $project: {
        invoiceId: '$_id',
        invoiceNumber: 1,
        invoiceType: 1,
        issueDate: 1,
        dueDate: 1,
        dueForAge: 1,
        grandTotal: 1,
        paidAmount: 1,
        residual: 1,
        partnerId: 1,
        paymentStatus: 1,
        paymentSchedule: 1,
      },
    },
  ]);

  const partnerIdSet = [
    ...new Set(invoiceRows.map((r) => String(r.partnerId || '')).filter((id) => id && id !== 'undefined')),
  ];
  const partners = partnerIdSet.length
    ? await Customer.find({ _id: { $in: partnerIdSet }, tenantId })
      .select('name nameEn nameAr displayName phone mobile vatNumber')
      .lean()
    : [];
  const partnerById = Object.fromEntries(partners.map((p) => [String(p._id), p]));

  const buckets = emptyAgingBuckets();
  const byPartner = new Map();
  const invoiceDetails = [];

  const ensurePartner = (id) => {
    const key = String(id || 'unknown');
    if (!byPartner.has(key)) {
      const p = partnerById[key];
      byPartner.set(key, {
        partnerId: id || null,
        partnerName: p?.displayName || p?.nameEn || p?.name || p?.nameAr || '—',
        partnerNameAr: p?.nameAr || '',
        phone: p?.mobile || p?.phone || '',
        vatNumber: p?.vatNumber || '',
        totalInvoiced: 0,
        totalPaid: 0,
        openResidual: 0,
        aging: emptyAgingBuckets(),
        invoiceCount: 0,
      });
    }
    return byPartner.get(key);
  };

  for (const inv of invoiceRows) {
    const residual = round2(inv.residual);
    if (residual < 0.01) continue;

    const due = new Date(inv.dueForAge || inv.dueDate || inv.issueDate || asOfDate);
    const ageDays = Math.max(0, Math.floor((asOfDate - due) / MS_PER_DAY));
    const bucket = agingBucket(ageDays);

    buckets[bucket] = round2(buckets[bucket] + residual);
    buckets.total = round2(buckets.total + residual);

    const row = ensurePartner(inv.partnerId);
    row.totalInvoiced = round2(row.totalInvoiced + Number(inv.grandTotal || 0));
    row.totalPaid = round2(row.totalPaid + Number(inv.paidAmount || 0));
    row.openResidual = round2(row.openResidual + residual);
    row.aging[bucket] = round2(row.aging[bucket] + residual);
    row.aging.total = round2(row.aging.total + residual);
    row.invoiceCount += 1;

    const partner = partnerById[String(inv.partnerId || '')];
    invoiceDetails.push({
      invoiceId: inv.invoiceId || inv._id,
      invoiceNumber: inv.invoiceNumber,
      invoiceType: inv.invoiceType,
      partnerId: inv.partnerId || null,
      partnerName: partner?.displayName || partner?.name || partner?.nameAr || '—',
      issueDate: inv.issueDate,
      dueDate: inv.dueDate || inv.dueForAge || null,
      grandTotal: round2(inv.grandTotal),
      paidAmount: round2(inv.paidAmount),
      residual,
      ageDays,
      bucket,
      paymentStatus: inv.paymentStatus,
    });
  }

  // Enrich with lifetime invoiced/paid even when currently paid (optional partners list)
  if (Array.isArray(partnerIds) && partnerIds.length) {
    for (const id of partnerIds) ensurePartner(id);
  }

  const partnersOut = [...byPartner.values()].sort((a, b) => b.openResidual - a.openResidual);
  invoiceDetails.sort((a, b) => b.ageDays - a.ageDays || b.residual - a.residual);

  return {
    asOf: asOfDate,
    partnerType,
    flow,
    buckets,
    partners: partnersOut,
    invoices: invoiceDetails,
    totals: {
      openResidual: buckets.total,
      partnerCount: partnersOut.filter((p) => p.openResidual >= 0.01).length,
      invoiceCount: invoiceDetails.length,
    },
  };
}

/**
 * Assert GL AR (code 1200 natural) == sum of partner open residuals (±tolerance).
 * Used by consistency script / tests.
 */
export async function assertReceivableConsistency(tenantId, { tolerance = 0.05, asOf = null } = {}) {
  const [gl, partners] = await Promise.all([
    getAccountBalances({ tenantId, to: asOf, activeOnly: true }),
    getPartnerBalances({ tenantId, partnerType: 'customer', asOf }),
  ]);
  const ar = (gl.rows || []).find((r) => String(r.code) === '1200');
  const glAr = round2(ar?.naturalBalance ?? ar?.balance ?? 0);
  const partnerSum = round2(partners.totals?.openResidual || 0);
  const delta = round2(glAr - partnerSum);
  return {
    ok: Math.abs(delta) <= tolerance,
    glAr,
    partnerSum,
    agedTotal: partnerSum,
    delta,
    tolerance,
    asOf: partners.asOf,
    account: ar
      ? {
          code: ar.code,
          naturalBalance: ar.naturalBalance,
          rawDebitMinusCredit: ar.rawDebitMinusCredit,
          storedBalance: ar.storedBalance,
        }
      : null,
  };
}
