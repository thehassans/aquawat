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
  // d90plus alias kept for API consumers that use the unpunctuated key
  return { d0_30: 0, d31_60: 0, d61_90: 0, d90_plus: 0, d90plus: 0, total: 0 };
}

function withAgingAliases(buckets) {
  const b = buckets || emptyAgingBuckets();
  const d90 = round2(b.d90_plus || b.d90plus || 0);
  return {
    d0_30: round2(b.d0_30 || 0),
    d31_60: round2(b.d31_60 || 0),
    d61_90: round2(b.d61_90 || 0),
    d90_plus: d90,
    d90plus: d90,
    total: round2(b.total || 0),
  };
}

const CONTROL_CODE = { customer: '1200', vendor: '2000' };

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

/** Parse YYYY-MM-DD as a calendar date (no timezone day-shift). */
function parseDateOnlyParts(d) {
  if (d == null || d === '') return null;
  if (typeof d === 'string') {
    const m = d.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return { y: Number(m[1]), mo: Number(m[2]), day: Number(m[3]) };
  }
  return null;
}

function endOfDay(d) {
  if (!d) return null;
  const parts = parseDateOnlyParts(d);
  if (parts) {
    return new Date(Date.UTC(parts.y, parts.mo - 1, parts.day, 23, 59, 59, 999));
  }
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return null;
  x.setUTCHours(23, 59, 59, 999);
  return x;
}

function startOfDay(d) {
  if (!d) return null;
  const parts = parseDateOnlyParts(d);
  if (parts) {
    return new Date(Date.UTC(parts.y, parts.mo - 1, parts.day, 0, 0, 0, 0));
  }
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return null;
  x.setUTCHours(0, 0, 0, 0);
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
 * Partner AR/AP balances from GL control-account journal lines (1200 / 2000).
 * openResidual + aging come from posted journal lines (same filter as getAccountBalances),
 * so Σ partners.openResidual === COA control-account natural balance.
 * totalInvoiced / totalPaid come from a parallel invoice aggregation.
 */
export async function getPartnerBalances({
  tenantId,
  partnerIds = null,
  partnerType = 'customer',
  asOf = null,
  includeDraft = false,
  includeReversed = false,
  includeVoid = false,
  createdBy = null,
} = {}) {
  if (!tenantId) throw new Error('tenantId is required');
  const flow = partnerType === 'vendor' ? 'purchase' : 'sell';
  const controlCode = CONTROL_CODE[partnerType] || CONTROL_CODE.customer;
  const asOfDate = endOfDay(asOf) || endOfDay(new Date());
  const tid = new mongoose.Types.ObjectId(String(tenantId));

  const controlAccounts = await ChartOfAccount.find({
    tenantId: tid,
    code: controlCode,
    isActive: true,
  }).select('_id code type').lean();

  if (!controlAccounts.length) {
    return {
      asOf: asOfDate,
      partnerType,
      flow,
      controlCode,
      buckets: withAgingAliases(emptyAgingBuckets()),
      glBuckets: withAgingAliases(emptyAgingBuckets()),
      partners: [],
      allPartners: [],
      advances: [],
      unallocated: null,
      invoices: [],
      totals: {
        openResidual: 0,
        partnerCount: 0,
        invoiceCount: 0,
        glControlBalance: 0,
        payableResidual: 0,
        advanceResidual: 0,
        unallocatedResidual: 0,
        unallocatedAmount: 0,
        advancePartnerCount: 0,
      },
    };
  }

  const accountIds = controlAccounts.map((a) => a._id);
  const isAr = partnerType !== 'vendor';

  const entryMatch = {
    tenantId: tid,
    ...journalStatusMatch({ includeDraft, includeReversed, includeVoid }),
    entryDate: { $lte: asOfDate },
  };

  const partnerIdFilter = Array.isArray(partnerIds) && partnerIds.length
    ? partnerIds.map((id) => new mongoose.Types.ObjectId(String(id)))
    : null;

  /**
   * amount = signed contribution to natural control balance:
   *   AR (asset): debit − credit
   *   AP (liability): credit − debit
   */
  const amountExpr = isAr
    ? { $subtract: [{ $ifNull: ['$lines.debit', 0] }, { $ifNull: ['$lines.credit', 0] }] }
    : { $subtract: [{ $ifNull: ['$lines.credit', 0] }, { $ifNull: ['$lines.debit', 0] }] };

  const lineMatch = {
    'lines.accountId': { $in: accountIds },
  };
  // When filtering partners, still keep unallocated (null) so Σ stays = GL
  if (partnerIdFilter) {
    lineMatch.$or = [
      { 'lines.partnerId': { $in: partnerIdFilter } },
      { 'lines.partnerId': null },
      { 'lines.partnerId': { $exists: false } },
    ];
  }

  const glFacet = await JournalEntry.aggregate([
    { $match: entryMatch },
    { $unwind: '$lines' },
    { $match: lineMatch },
    {
      $addFields: {
        amount: amountExpr,
        dueForAge: { $ifNull: ['$lines.dueDate', '$entryDate'] },
      },
    },
    {
      $addFields: {
        ageDays: {
          $max: [
            0,
            {
              $dateDiff: {
                startDate: '$dueForAge',
                endDate: asOfDate,
                unit: 'day',
              },
            },
          ],
        },
      },
    },
    {
      $addFields: {
        bucket: {
          $switch: {
            branches: [
              { case: { $lte: ['$ageDays', 30] }, then: 'd0_30' },
              { case: { $lte: ['$ageDays', 60] }, then: 'd31_60' },
              { case: { $lte: ['$ageDays', 90] }, then: 'd61_90' },
            ],
            default: 'd90_plus',
          },
        },
      },
    },
    {
      $facet: {
        byPartner: [
          {
            $group: {
              _id: '$lines.partnerId',
              openResidual: { $sum: '$amount' },
              lineCount: { $sum: 1 },
              d0_30: { $sum: { $cond: [{ $eq: ['$bucket', 'd0_30'] }, '$amount', 0] } },
              d31_60: { $sum: { $cond: [{ $eq: ['$bucket', 'd31_60'] }, '$amount', 0] } },
              d61_90: { $sum: { $cond: [{ $eq: ['$bucket', 'd61_90'] }, '$amount', 0] } },
              d90_plus: { $sum: { $cond: [{ $eq: ['$bucket', 'd90_plus'] }, '$amount', 0] } },
            },
          },
        ],
        byBucket: [
          {
            $group: {
              _id: '$bucket',
              total: { $sum: '$amount' },
            },
          },
        ],
        grand: [
          {
            $group: {
              _id: null,
              openResidual: { $sum: '$amount' },
              lineCount: { $sum: 1 },
            },
          },
        ],
      },
    },
  ]);

  const facet = glFacet[0] || { byPartner: [], byBucket: [], grand: [] };
  const glControlBalance = round2(facet.grand?.[0]?.openResidual || 0);

  const buckets = emptyAgingBuckets();
  for (const row of facet.byBucket || []) {
    const key = row._id;
    if (key && Object.prototype.hasOwnProperty.call(buckets, key)) {
      buckets[key] = round2(row.total);
    }
  }
  buckets.total = glControlBalance;
  const bucketsOut = withAgingAliases(buckets);

  const partnerField = flow === 'sell' ? 'customerId' : 'supplierId';
  const invoiceMatch = {
    tenantId: tid,
    flow,
    status: { $nin: ['draft', 'cancelled', 'credited'] },
    issueDate: { $lte: asOfDate },
  };
  if (partnerIdFilter) {
    invoiceMatch[partnerField] = { $in: partnerIdFilter };
  }
  if (createdBy) {
    invoiceMatch.createdBy = new mongoose.Types.ObjectId(String(createdBy));
  }

  const [invoiceStats, openInvoiceRows] = await Promise.all([
    Invoice.aggregate([
      { $match: invoiceMatch },
      {
        $group: {
          _id: `$${partnerField}`,
          totalInvoiced: { $sum: { $ifNull: ['$grandTotal', 0] } },
          totalPaid: { $sum: { $ifNull: ['$paidAmount', 0] } },
          invoiceCount: { $sum: 1 },
        },
      },
    ]),
    Invoice.aggregate([
      {
        $match: {
          ...invoiceMatch,
          paymentStatus: { $nin: ['paid', 'cancelled'] },
        },
      },
      {
        $addFields: {
          residual: {
            $round: [
              {
                $subtract: [
                  { $ifNull: ['$grandTotal', 0] },
                  { $ifNull: ['$paidAmount', 0] },
                ],
              },
              2,
            ],
          },
          dueForAge: { $ifNull: ['$dueDate', '$issueDate'] },
        },
      },
      { $match: { residual: { $ne: 0 } } },
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
          partnerId: `$${partnerField}`,
          paymentStatus: 1,
        },
      },
    ]),
  ]);

  const invStatsById = Object.fromEntries(
    (invoiceStats || []).map((r) => [String(r._id || ''), r]),
  );

  const partnerIdSet = new Set();
  for (const row of facet.byPartner || []) {
    if (row._id) partnerIdSet.add(String(row._id));
  }
  for (const id of Object.keys(invStatsById)) {
    if (id && id !== 'null' && id !== 'undefined') partnerIdSet.add(id);
  }
  if (partnerIdFilter) {
    for (const id of partnerIdFilter) partnerIdSet.add(String(id));
  }

  const partnerDocs = partnerIdSet.size
    ? await Customer.find({ _id: { $in: [...partnerIdSet] }, tenantId: tid })
      .select('name nameEn nameAr displayName phone mobile vatNumber')
      .lean()
    : [];
  const partnerById = Object.fromEntries(partnerDocs.map((p) => [String(p._id), p]));

  const byPartner = new Map();
  const ensurePartner = (id) => {
    const key = id ? String(id) : 'unallocated';
    if (!byPartner.has(key)) {
      const p = id ? partnerById[String(id)] : null;
      byPartner.set(key, {
        partnerId: id || null,
        partnerName: id
          ? (p?.displayName || p?.nameEn || p?.name || p?.nameAr || '—')
          : 'Unallocated',
        partnerNameAr: id ? (p?.nameAr || '') : 'غير مخصص',
        phone: p?.mobile || p?.phone || '',
        vatNumber: p?.vatNumber || '',
        totalInvoiced: 0,
        totalPaid: 0,
        openResidual: 0,
        aging: withAgingAliases(emptyAgingBuckets()),
        invoiceCount: 0,
        lineCount: 0,
      });
    }
    return byPartner.get(key);
  };

  for (const row of facet.byPartner || []) {
    const partner = ensurePartner(row._id || null);
    partner.openResidual = round2(row.openResidual);
    partner.lineCount = row.lineCount || 0;
    partner.aging = withAgingAliases({
      d0_30: row.d0_30,
      d31_60: row.d31_60,
      d61_90: row.d61_90,
      d90_plus: row.d90_plus,
      total: row.openResidual,
    });
  }

  for (const [id, stats] of Object.entries(invStatsById)) {
    if (!id || id === 'null' || id === 'undefined') continue;
    const partner = ensurePartner(id);
    partner.totalInvoiced = round2(stats.totalInvoiced);
    partner.totalPaid = round2(stats.totalPaid);
    partner.invoiceCount = stats.invoiceCount || 0;
  }

  const invoiceDetails = (openInvoiceRows || []).map((inv) => {
    const due = new Date(inv.dueForAge || inv.dueDate || inv.issueDate || asOfDate);
    const ageDays = Math.max(0, Math.floor((asOfDate - due) / MS_PER_DAY));
    const bucket = agingBucket(ageDays);
    const p = partnerById[String(inv.partnerId || '')];
    return {
      invoiceId: inv.invoiceId || inv._id,
      invoiceNumber: inv.invoiceNumber,
      invoiceType: inv.invoiceType,
      partnerId: inv.partnerId || null,
      partnerName: p?.displayName || p?.name || p?.nameAr || '—',
      issueDate: inv.issueDate,
      dueDate: inv.dueDate || inv.dueForAge || null,
      grandTotal: round2(inv.grandTotal),
      paidAmount: round2(inv.paidAmount),
      residual: round2(inv.residual),
      ageDays,
      bucket,
      paymentStatus: inv.paymentStatus,
      trancheSequence: null,
      source: 'invoice',
    };
  }).sort((a, b) => b.ageDays - a.ageDays || Math.abs(b.residual) - Math.abs(a.residual));

  const partnersOut = [...byPartner.values()]
    .filter((p) => Math.abs(p.openResidual) >= 0.005
      || p.totalInvoiced >= 0.005
      || (partnerIdFilter && p.partnerId && partnerIdFilter.some((id) => String(id) === String(p.partnerId))))
    .sort((a, b) => Math.abs(b.openResidual) - Math.abs(a.openResidual));

  /**
   * Split GL control into:
   *  - payables/receivables (positive natural residual) → aging table
   *  - advances (negative) → supplier/customer advances card
   *  - unallocated (null partnerId) → unallocated payments card
   */
  let unallocated = null;
  const payablePartners = [];
  const advancePartners = [];
  for (const p of partnersOut) {
    if (!p.partnerId) {
      unallocated = {
        openResidual: round2(p.openResidual),
        amount: round2(Math.abs(p.openResidual)),
        lineCount: p.lineCount || 0,
        aging: p.aging || withAgingAliases(emptyAgingBuckets()),
      };
      continue;
    }
    if (p.openResidual < -0.005) {
      advancePartners.push({
        ...p,
        advanceAmount: round2(-p.openResidual),
      });
      continue;
    }
    if (p.openResidual > 0.005 || p.invoiceCount > 0 || p.totalInvoiced >= 0.005) {
      // Aging UI must not show negative buckets for advances
      const agingPos = withAgingAliases({
        d0_30: Math.max(0, p.aging?.d0_30 || 0),
        d31_60: Math.max(0, p.aging?.d31_60 || 0),
        d61_90: Math.max(0, p.aging?.d61_90 || 0),
        d90_plus: Math.max(0, p.aging?.d90_plus || 0),
        total: Math.max(0, p.openResidual),
      });
      payablePartners.push({ ...p, aging: agingPos, openResidual: round2(Math.max(0, p.openResidual)) });
    }
  }

  const agingBuckets = emptyAgingBuckets();
  for (const p of payablePartners) {
    agingBuckets.d0_30 += p.aging?.d0_30 || 0;
    agingBuckets.d31_60 += p.aging?.d31_60 || 0;
    agingBuckets.d61_90 += p.aging?.d61_90 || 0;
    agingBuckets.d90_plus += p.aging?.d90_plus || 0;
  }
  const payableResidual = round2(payablePartners.reduce((s, p) => s + (Number(p.openResidual) || 0), 0));
  agingBuckets.total = payableResidual;
  const agingBucketsOut = withAgingAliases(agingBuckets);

  const advanceResidual = round2(advancePartners.reduce((s, p) => s + (Number(p.advanceAmount) || 0), 0));
  const unallocatedAmount = round2(unallocated?.amount || 0);

  return {
    asOf: asOfDate,
    partnerType,
    flow,
    controlCode,
    source: 'gl_control_account',
    /** Aging buckets: positive payables/receivables only (excludes advances + unallocated). */
    buckets: agingBucketsOut,
    /** Full GL control buckets (legacy; may include negatives). */
    glBuckets: bucketsOut,
    partners: payablePartners,
    allPartners: partnersOut,
    advances: advancePartners,
    unallocated,
    invoices: invoiceDetails.filter((inv) => Number(inv.residual) > 0.005),
    totals: {
      openResidual: glControlBalance,
      glControlBalance,
      payableResidual,
      advanceResidual,
      unallocatedResidual: round2(unallocated?.openResidual || 0),
      unallocatedAmount,
      partnerCount: payablePartners.filter((p) => Math.abs(p.openResidual) >= 0.01).length,
      advancePartnerCount: advancePartners.length,
      invoiceCount: invoiceDetails.filter((inv) => Number(inv.residual) > 0.005).length,
    },
  };
}

/**
 * Rewrite ChartOfAccount.balance from live journal rebuild (excludes reversal pairs).
 * Fixes stored vs TB/BS drift after orphaned reverses / imports.
 */
export async function syncStoredAccountBalances(tenantId, { accountIds = null } = {}) {
  const live = await getAccountBalances({
    tenantId,
    accountIds,
    activeOnly: false,
    includeReversed: false,
  });
  let updated = 0;
  for (const row of live.rows || []) {
    const next = round2(row.naturalBalance ?? row.balance ?? 0);
    const prev = round2(row.storedBalance ?? 0);
    if (Math.abs(next - prev) < 0.005) continue;
    await ChartOfAccount.updateOne(
      { _id: row.accountId, tenantId },
      { $set: { balance: next } },
    );
    updated += 1;
  }
  return { updated, total: (live.rows || []).length };
}

/**
 * Assert GL AR (1200) == partner open sum == aged total (±tolerance).
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

/**
 * Assert GL AP (2000) == partner open sum == aged payables total (±tolerance).
 */
export async function assertPayableConsistency(tenantId, { tolerance = 0.05, asOf = null } = {}) {
  const [gl, partners] = await Promise.all([
    getAccountBalances({ tenantId, to: asOf, activeOnly: true }),
    getPartnerBalances({ tenantId, partnerType: 'vendor', asOf }),
  ]);
  const ap = (gl.rows || []).find((r) => String(r.code) === '2000');
  const glAp = round2(ap?.naturalBalance ?? ap?.balance ?? 0);
  const partnerSum = round2(partners.totals?.openResidual || 0);
  const delta = round2(glAp - partnerSum);
  return {
    ok: Math.abs(delta) <= tolerance,
    glAp,
    partnerSum,
    agedTotal: partnerSum,
    delta,
    tolerance,
    asOf: partners.asOf,
    account: ap
      ? {
          code: ap.code,
          naturalBalance: ap.naturalBalance,
          rawDebitMinusCredit: ap.rawDebitMinusCredit,
          storedBalance: ap.storedBalance,
        }
      : null,
  };
}
