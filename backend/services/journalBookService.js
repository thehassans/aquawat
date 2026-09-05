/**
 * Central journal-book resolution, posting-time sequences, and ZATCA sequence reports.
 * Kept separate from accountingService to avoid circular imports with stockAccounting.
 */
import Journal from '../models/Journal.js';
import JournalEntry from '../models/JournalEntry.js';
import ChartOfAccount from '../models/ChartOfAccount.js';
import Tenant from '../models/Tenant.js';
import InvSequence from '../models/inventory/InvSequence.js';
import { toObjectId } from '../models/inventory/common.js';

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/** Canonical system books — sequencePrefix drives {PREFIX}-{YYYY}-{NNNN}. */
export const SYSTEM_JOURNAL_DEFS = {
  sales: {
    code: 'SAL',
    name: 'Sales Journal',
    nameAr: 'دفتر المبيعات',
    type: 'sales',
    sequencePrefix: 'SAL',
  },
  purchase: {
    code: 'PUR',
    name: 'Purchase Journal',
    nameAr: 'دفتر المشتريات',
    type: 'purchase',
    sequencePrefix: 'PUR',
  },
  cash: {
    code: 'CSH',
    name: 'Cash Journal',
    nameAr: 'دفتر النقدية',
    type: 'cash',
    sequencePrefix: 'CSH',
  },
  bank: {
    code: 'BNK',
    name: 'Bank Journal',
    nameAr: 'دفتر البنك',
    type: 'bank',
    sequencePrefix: 'BNK',
  },
  stock: {
    code: 'STJ',
    name: 'Stock Journal',
    nameAr: 'دفتر المخزون',
    type: 'stock',
    sequencePrefix: 'STJ',
  },
  /** Manual / misc — JE series (not MISC) for ZATCA-style numbering */
  manual: {
    code: 'JE',
    name: 'Miscellaneous Journal',
    nameAr: 'دفتر متنوع',
    type: 'miscellaneous',
    sequencePrefix: 'JE',
    altCodes: ['MISC'],
  },
};

function normalizePrefix(sequencePrefix) {
  return String(sequencePrefix || 'JE').replace(/[^A-Za-z0-9]/g, '').toUpperCase() || 'JE';
}

function paymentIsCash(paymentMethod = '') {
  return String(paymentMethod || '').toLowerCase().includes('cash');
}

function startOfDay(d) {
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return null;
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

/**
 * Ensure a system journal book exists (by code, type, or altCodes).
 */
export async function ensureSystemJournalBook(tenantId, kind, userId = null) {
  const tid = toObjectId(tenantId);
  const def = SYSTEM_JOURNAL_DEFS[kind] || SYSTEM_JOURNAL_DEFS.manual;

  let book = await Journal.findOne({ tenantId: tid, code: def.code });
  if (!book && def.altCodes?.length) {
    book = await Journal.findOne({ tenantId: tid, code: { $in: def.altCodes } });
  }
  if (!book) {
    book = await Journal.findOne({ tenantId: tid, type: def.type, isSystem: true });
  }

  if (!book) {
    book = await Journal.create({
      tenantId: tid,
      code: def.code,
      name: def.name,
      nameAr: def.nameAr,
      type: def.type,
      sequencePrefix: def.sequencePrefix,
      active: true,
      isSystem: true,
      createdBy: userId || undefined,
    });
    return book;
  }

  const patch = {};
  if (!book.sequencePrefix || (kind === 'manual' && book.sequencePrefix === 'MISC')) {
    patch.sequencePrefix = def.sequencePrefix;
  }
  if (!book.isSystem) patch.isSystem = true;
  if (kind === 'manual' && book.code === 'MISC' && !await Journal.findOne({ tenantId: tid, code: 'JE' })) {
    // Prefer JE code going forward; keep MISC row but align prefix
    patch.sequencePrefix = 'JE';
  }
  if (Object.keys(patch).length) {
    Object.assign(book, patch);
    if (userId) book.updatedBy = userId;
    await book.save();
  }
  return book;
}

export async function ensureAllSystemJournalBooks(tenantId, userId = null) {
  const kinds = Object.keys(SYSTEM_JOURNAL_DEFS);
  const books = {};
  for (const kind of kinds) {
    books[kind] = await ensureSystemJournalBook(tenantId, kind, userId);
  }
  return books;
}

/**
 * Resolve journal book for a transaction.
 * Priority: explicit journalId → bankAccount link → payment method / kind defaults.
 *
 * @param {'sales'|'purchase'|'cash'|'bank'|'stock'|'manual'|'payment'} kind
 */
export async function resolveJournalBook(tenantId, userId, {
  kind = 'manual',
  paymentMethod = null,
  bankAccountId = null,
  journalId = null,
  liquidityAccountId = null,
} = {}) {
  const tid = toObjectId(tenantId);
  await ensureAllSystemJournalBooks(tid, userId);

  if (journalId) {
    const book = await Journal.findOne({ _id: journalId, tenantId: tid, active: { $ne: false } }).lean();
    if (book) return book;
  }

  const accountId = bankAccountId || liquidityAccountId || null;
  if (accountId) {
    const fromBankLink = await resolveBookFromBankAccount(tid, accountId);
    if (fromBankLink) return fromBankLink;

    const acct = await ChartOfAccount.findOne({ _id: accountId, tenantId: tid }).select('subtype').lean();
    if (acct?.subtype === 'cash') {
      return ensureSystemJournalBook(tid, 'cash', userId);
    }
    if (acct?.subtype === 'bank') {
      const byDefault = await Journal.findOne({
        tenantId: tid,
        type: 'bank',
        active: { $ne: false },
        $or: [
          { defaultDebitAccountId: accountId },
          { defaultCreditAccountId: accountId },
        ],
      }).lean();
      if (byDefault) return byDefault;
      return ensureSystemJournalBook(tid, 'bank', userId);
    }
  }

  const k = String(kind || 'manual').toLowerCase();
  if (k === 'sales' || k === 'sale' || k === 'invoice') {
    return ensureSystemJournalBook(tid, 'sales', userId);
  }
  if (k === 'purchase' || k === 'bill' || k === 'vendor_bill') {
    return ensureSystemJournalBook(tid, 'purchase', userId);
  }
  if (k === 'stock') {
    return ensureSystemJournalBook(tid, 'stock', userId);
  }
  if (k === 'manual' || k === 'misc' || k === 'miscellaneous' || k === 'adjustment') {
    return ensureSystemJournalBook(tid, 'manual', userId);
  }

  // payment / cash / bank — resolve from method
  if (k === 'cash' || paymentIsCash(paymentMethod)) {
    return ensureSystemJournalBook(tid, 'cash', userId);
  }
  if (k === 'bank' || k === 'payment' || k === 'voucher' || k === 'expense') {
    return ensureSystemJournalBook(tid, 'bank', userId);
  }

  return ensureSystemJournalBook(tid, 'manual', userId);
}

export async function resolveJournalBookId(tenantId, userId, opts = {}) {
  const book = await resolveJournalBook(tenantId, userId, opts);
  return book?._id || null;
}

async function resolveBookFromBankAccount(tenantId, accountId) {
  const tenant = await Tenant.findById(tenantId)
    .select('settings.accounting.bankAccounts')
    .lean();
  const links = Array.isArray(tenant?.settings?.accounting?.bankAccounts)
    ? tenant.settings.accounting.bankAccounts
    : [];
  const link = links.find((row) => String(row.accountId || '') === String(accountId) && row.journalId);
  if (!link?.journalId) return null;
  return Journal.findOne({
    _id: link.journalId,
    tenantId,
    active: { $ne: false },
  }).lean();
}

function sequenceCodeFor(prefix, year) {
  return `JESEQ:${normalizePrefix(prefix)}:${year}`;
}

/**
 * Align InvSequence cursor to max existing posted entry so we never collide.
 */
async function alignJournalSequence(tenantId, prefix, year) {
  const tid = toObjectId(tenantId);
  const base = normalizePrefix(prefix);
  const displayPrefix = `${base}-${year}-`;
  const code = sequenceCodeFor(base, year);

  const last = await JournalEntry.findOne({
    tenantId: tid,
    entryNumber: new RegExp(`^${displayPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`),
    status: { $nin: ['void'] },
  })
    .sort({ entryNumber: -1 })
    .select('entryNumber')
    .lean();

  const maxExisting = last?.entryNumber
    ? (Number(String(last.entryNumber).split('-').pop()) || 0)
    : 0;
  const nextNeeded = maxExisting + 1;

  let seq = await InvSequence.findOne({ tenantId: tid, code });
  if (!seq) {
    await InvSequence.create({
      tenantId: tid,
      code,
      prefix: displayPrefix.replace(/-$/, ''),
      padding: 4,
      nextNumber: nextNeeded,
    });
    return;
  }
  if ((seq.nextNumber || 1) < nextNeeded) {
    seq.nextNumber = nextNeeded;
    await seq.save();
  }
}

/**
 * Allocate next {PREFIX}-{YYYY}-{NNNN} at posting time (atomic).
 * Year follows entryDate, not wall clock.
 */
export async function allocateJournalEntryNumber(tenantId, sequencePrefix, entryDate = new Date()) {
  const tid = toObjectId(tenantId);
  const day = startOfDay(entryDate) || startOfDay(new Date());
  const year = day.getUTCFullYear();
  const base = normalizePrefix(sequencePrefix);
  const displayPrefix = `${base}-${year}-`;
  const code = sequenceCodeFor(base, year);

  await alignJournalSequence(tid, base, year);

  const seq = await InvSequence.findOneAndUpdate(
    { tenantId: tid, code },
    { $inc: { nextNumber: 1 } },
    { new: true },
  );
  const num = (seq?.nextNumber || 2) - 1;
  const entryNumber = `${displayPrefix}${String(num).padStart(4, '0')}`;

  const isBackdated = await isBackdatedEntry(tid, displayPrefix, day, entryNumber);
  return { entryNumber, isBackdated, year, sequencePrefix: base };
}

/**
 * True when a lower date would get a higher sequence than an already-posted later date.
 */
export async function isBackdatedEntry(tenantId, displayPrefix, entryDay, _candidateNumber) {
  const prior = await JournalEntry.findOne({
    tenantId,
    status: 'posted',
    entryNumber: new RegExp(`^${String(displayPrefix).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`),
  })
    .sort({ entryNumber: -1 })
    .select('entryDate entryNumber')
    .lean();

  if (!prior?.entryDate) return false;
  const priorDay = startOfDay(prior.entryDate);
  if (!priorDay || !entryDay) return false;
  return entryDay.getTime() < priorDay.getTime();
}

/** Temporary number for drafts — does not consume book sequence. */
export function makeDraftEntryNumber() {
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  return `DRAFT-${id}`.toUpperCase();
}

export function isDraftEntryNumber(entryNumber) {
  return String(entryNumber || '').toUpperCase().startsWith('DRAFT-');
}

/**
 * Infer expected journal kind from a posted/draft entry (for mapping report).
 */
export function inferExpectedJournalKind(entry, { paymentMethod = null, liquiditySubtype = null } = {}) {
  const source = String(entry?.sourceModel || '').toLowerCase();
  const type = String(entry?.type || '').toLowerCase();
  const memo = String(entry?.memo || '').toLowerCase();

  if (type === 'stock' || source.includes('stock') || source.includes('landed') || source.includes('valuation')) {
    return 'stock';
  }
  if (
    source === 'invoice'
    || source === 'salesinvoice'
    || source === 'creditnote'
    || (type === 'invoice' && !source.includes('vendor') && !source.includes('purchase'))
  ) {
    // purchase bills use sourceModel Invoice with flow purchase — callers may pass hint
    if (source.includes('vendor') || source.includes('purchase') || source.includes('bill')) return 'purchase';
    return 'sales';
  }
  if (source === 'vendorbill' || source.includes('vendorbill') || source === 'purchaseinvoice') {
    return 'purchase';
  }
  if (
    source.includes('payment')
    || source.includes('voucher')
    || source.includes('advance')
    || source.includes('refund')
    || source.includes('clearance')
    || type === 'payment'
    || type === 'voucher'
    || type === 'expense'
    || memo.includes('supplier payment')
    || memo.includes('vendor payment')
    || memo.includes('voucher ')
  ) {
    if (liquiditySubtype === 'cash' || paymentIsCash(paymentMethod)) return 'cash';
    return 'bank';
  }
  if (type === 'manual' || type === 'adjustment' || type === 'opening' || type === 'closing') {
    return 'manual';
  }
  return 'manual';
}

/**
 * Sequence integrity: gaps, duplicates, and date/number order violations per book/year.
 */
export async function buildSequenceIntegrityReport(tenantId, {
  year = null,
  journalId = null,
} = {}) {
  const tid = toObjectId(tenantId);
  const y = year ? Number(year) : new Date().getFullYear();

  const filter = {
    tenantId: tid,
    status: { $in: ['posted', 'reversed'] },
    entryNumber: { $not: /^DRAFT-/i },
  };
  if (journalId) filter.journalId = journalId;

  const entries = await JournalEntry.find(filter)
    .select('entryNumber entryDate status journalId memo sourceModel type isBackdated totalDebit totalCredit')
    .populate('journalId', 'code name sequencePrefix type')
    .sort({ entryNumber: 1 })
    .lean();

  const bySeries = new Map();
  for (const e of entries) {
    const m = String(e.entryNumber || '').match(/^([A-Z0-9]+)-(\d{4})-(\d+)$/i);
    if (!m) continue;
    const prefix = m[1].toUpperCase();
    const entryYear = Number(m[2]);
    if (y && entryYear !== y) continue;
    const seq = Number(m[3]);
    const key = `${prefix}-${entryYear}`;
    if (!bySeries.has(key)) bySeries.set(key, []);
    bySeries.get(key).push({
      entryId: e._id,
      entryNumber: e.entryNumber,
      seq,
      entryDate: e.entryDate,
      status: e.status,
      journalCode: e.journalId?.code || '',
      isBackdated: !!e.isBackdated,
      memo: e.memo,
      totalDebit: round2(e.totalDebit || 0),
      totalCredit: round2(e.totalCredit || 0),
    });
  }

  const books = [];
  let totalGaps = 0;
  let totalDuplicates = 0;
  let totalDateOrderIssues = 0;

  for (const [series, rows] of [...bySeries.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const bySeq = new Map();
    const duplicates = [];
    for (const row of rows) {
      if (!bySeq.has(row.seq)) bySeq.set(row.seq, []);
      bySeq.get(row.seq).push(row);
    }
    for (const [seq, list] of bySeq) {
      if (list.length > 1) {
        duplicates.push({
          seq,
          entryNumbers: list.map((r) => r.entryNumber),
          entryIds: list.map((r) => r.entryId),
          message: `Duplicate ${series}-${String(seq).padStart(4, '0')}: ${list.length} entries`,
        });
      }
    }

    const sortedSeqs = [...bySeq.keys()].sort((a, b) => a - b);
    const gaps = [];
    for (let i = 1; i < sortedSeqs.length; i += 1) {
      if (sortedSeqs[i] !== sortedSeqs[i - 1] + 1) {
        gaps.push({
          from: sortedSeqs[i - 1] + 1,
          to: sortedSeqs[i] - 1,
          message: `Gap in ${series}: missing ${sortedSeqs[i - 1] + 1}–${sortedSeqs[i] - 1}`,
        });
      }
    }

    // Date order: higher seq should not have earlier date than previous seq (unless flagged backdated)
    const dateOrderIssues = [];
    const uniqueRows = sortedSeqs.map((s) => bySeq.get(s)[0]);
    for (let i = 1; i < uniqueRows.length; i += 1) {
      const prev = uniqueRows[i - 1];
      const cur = uniqueRows[i];
      const prevDay = startOfDay(prev.entryDate);
      const curDay = startOfDay(cur.entryDate);
      if (prevDay && curDay && curDay.getTime() < prevDay.getTime()) {
        dateOrderIssues.push({
          entryNumber: cur.entryNumber,
          entryDate: cur.entryDate,
          previousNumber: prev.entryNumber,
          previousDate: prev.entryDate,
          isBackdated: cur.isBackdated,
          message: `${cur.entryNumber} dated ${curDay.toISOString().slice(0, 10)} is before ${prev.entryNumber} (${prevDay.toISOString().slice(0, 10)})`,
        });
      }
    }

    totalGaps += gaps.length;
    totalDuplicates += duplicates.length;
    totalDateOrderIssues += dateOrderIssues.length;

    books.push({
      series,
      prefix: series.split('-')[0],
      year: Number(series.split('-')[1]),
      count: rows.length,
      minSeq: sortedSeqs[0] || null,
      maxSeq: sortedSeqs[sortedSeqs.length - 1] || null,
      gaps,
      duplicates,
      dateOrderIssues,
      backdatedCount: rows.filter((r) => r.isBackdated).length,
      ok: gaps.length === 0 && duplicates.length === 0,
    });
  }

  return {
    year: y,
    journalId,
    books,
    summary: {
      seriesCount: books.length,
      totalGaps,
      totalDuplicates,
      totalDateOrderIssues,
      intact: totalGaps === 0 && totalDuplicates === 0,
    },
  };
}

/**
 * Mapping report: which historical entries sit in the wrong book (do not rename).
 */
export async function buildJournalBookMappingReport(tenantId, {
  from = null,
  to = null,
  onlyMismatches = true,
} = {}) {
  const tid = toObjectId(tenantId);
  await ensureAllSystemJournalBooks(tid);

  const start = from ? new Date(from) : new Date(new Date().getFullYear(), 0, 1);
  const end = to ? new Date(to) : new Date();
  end.setHours(23, 59, 59, 999);

  const entries = await JournalEntry.find({
    tenantId: tid,
    status: { $in: ['posted', 'reversed', 'draft'] },
    entryDate: { $gte: start, $lte: end },
    entryNumber: { $not: /^DRAFT-/i },
  })
    .select('entryNumber entryDate status journalId memo sourceModel sourceNumber type lines')
    .populate('journalId', 'code name type sequencePrefix')
    .sort({ entryDate: 1, entryNumber: 1 })
    .lean();

  const booksByKind = {};
  for (const kind of Object.keys(SYSTEM_JOURNAL_DEFS)) {
    booksByKind[kind] = await ensureSystemJournalBook(tid, kind);
  }

  const rows = [];
  for (const e of entries) {
    // Infer liquidity subtype from credit/debit cash/bank lines when present
    let liquiditySubtype = null;
    const hasCashLine = (e.lines || []).some((l) => /cash/i.test(l.accountName || '') || l.accountCode === '1000');
    const hasBankLine = (e.lines || []).some((l) => /bank/i.test(l.accountName || '') || String(l.accountCode || '').startsWith('11'));
    if (hasCashLine && !hasBankLine) liquiditySubtype = 'cash';
    else if (hasBankLine) liquiditySubtype = 'bank';

    let expectedKind = inferExpectedJournalKind(e, { liquiditySubtype });
    // Purchase invoices: sourceModel often "Invoice" — detect via AP-ish memo/source
    if (
      expectedKind === 'sales'
      && (/vendor|purchase|bill|ap |مورد/i.test(e.memo || '')
        || /bill|purchase/i.test(e.sourceNumber || ''))
    ) {
      expectedKind = 'purchase';
    }

    const expectedBook = booksByKind[expectedKind];
    const actualCode = e.journalId?.code || (String(e.entryNumber || '').match(/^([A-Z0-9]+)-/i)?.[1] || '');
    const expectedCode = expectedBook?.code || SYSTEM_JOURNAL_DEFS[expectedKind]?.code;
    const expectedPrefix = expectedBook?.sequencePrefix || SYSTEM_JOURNAL_DEFS[expectedKind]?.sequencePrefix;
    const actualPrefix = e.journalId?.sequencePrefix
      || String(e.entryNumber || '').match(/^([A-Z0-9]+)-/i)?.[1]
      || '';

    const mismatch = String(actualPrefix).toUpperCase() !== String(expectedPrefix).toUpperCase()
      && String(actualCode).toUpperCase() !== String(expectedCode).toUpperCase();

    // Also mismatch if payment-like entry has JE/MISC book
    const paymentLike = ['cash', 'bank'].includes(expectedKind);
    const inMisc = ['JE', 'MISC'].includes(String(actualCode || actualPrefix).toUpperCase());
    const wrongBook = mismatch || (paymentLike && inMisc && !e.journalId);

    if (onlyMismatches && !wrongBook) continue;

    rows.push({
      entryId: e._id,
      entryNumber: e.entryNumber,
      entryDate: e.entryDate,
      status: e.status,
      memo: e.memo,
      sourceModel: e.sourceModel,
      sourceNumber: e.sourceNumber,
      actualJournalCode: actualCode || null,
      actualJournalId: e.journalId?._id || null,
      expectedKind,
      expectedJournalCode: expectedCode,
      expectedSequencePrefix: expectedPrefix,
      mismatch: wrongBook,
      note: wrongBook
        ? `Should be ${expectedPrefix}-* (${expectedKind}); currently ${e.entryNumber} / book ${actualCode || 'none'}`
        : 'OK',
    });
  }

  return {
    from: start,
    to: end,
    onlyMismatches,
    count: rows.length,
    rows,
  };
}
