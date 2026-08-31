import mongoose from 'mongoose';
import ChartOfAccount from '../models/ChartOfAccount.js';
import JournalItem from '../models/JournalItem.js';
import BankStatement from '../models/BankStatement.js';
import BankStatementLine from '../models/BankStatementLine.js';

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

async function assertBankAccount(tenantId, accountId) {
  const acct = await ChartOfAccount.findOne({
    _id: accountId,
    tenantId,
    isActive: true,
  }).lean();
  if (!acct) throw new Error('Bank/cash account not found');
  if (!['cash', 'bank'].includes(acct.subtype) && !['1000', '1100'].includes(String(acct.code))) {
    // Allow any postable asset; prefer cash/bank subtype
    if (acct.type !== 'asset' || acct.isPostable === false) {
      throw new Error('Select a postable cash or bank account');
    }
  }
  return acct;
}

export async function listBankStatements(tenantId, { accountId = null, limit = 50 } = {}) {
  const filter = { tenantId };
  if (accountId) filter.accountId = accountId;
  return BankStatement.find(filter)
    .sort({ statementDate: -1, createdAt: -1 })
    .limit(Math.min(100, Math.max(1, Number(limit) || 50)))
    .populate('accountId', 'code name nameAr subtype')
    .lean();
}

export async function getBankStatement(tenantId, statementId) {
  const statement = await BankStatement.findOne({ _id: statementId, tenantId })
    .populate('accountId', 'code name nameAr subtype')
    .lean();
  if (!statement) throw new Error('Statement not found');
  const lines = await BankStatementLine.find({ tenantId, statementId })
    .sort({ date: 1, lineIndex: 1 })
    .lean();
  return { statement, lines };
}

export async function createBankStatement(tenantId, userId, payload = {}) {
  const accountId = payload.accountId;
  if (!accountId) throw new Error('accountId is required');
  await assertBankAccount(tenantId, accountId);

  const name = String(payload.name || '').trim()
    || `Statement ${payload.statementDate || new Date().toISOString().slice(0, 10)}`;
  const statement = await BankStatement.create({
    tenantId,
    accountId,
    name,
    statementDate: payload.statementDate ? new Date(payload.statementDate) : new Date(),
    periodFrom: payload.periodFrom ? new Date(payload.periodFrom) : null,
    periodTo: payload.periodTo ? new Date(payload.periodTo) : null,
    currency: payload.currency || 'SAR',
    openingBalance: round2(payload.openingBalance),
    closingBalance: round2(payload.closingBalance),
    status: 'open',
    notes: payload.notes || '',
    createdBy: userId || undefined,
  });

  const rawLines = Array.isArray(payload.lines) ? payload.lines : [];
  if (rawLines.length) {
    const docs = rawLines
      .map((line, lineIndex) => ({
        tenantId,
        statementId: statement._id,
        accountId,
        date: line.date ? new Date(line.date) : statement.statementDate,
        label: String(line.label || line.description || '').trim(),
        reference: String(line.reference || '').trim(),
        amount: round2(line.amount),
        lineIndex,
      }))
      .filter((l) => l.amount !== 0);
    if (docs.length) await BankStatementLine.insertMany(docs);
  }

  return getBankStatement(tenantId, statement._id);
}

export async function addBankStatementLines(tenantId, statementId, lines = []) {
  const statement = await BankStatement.findOne({ _id: statementId, tenantId });
  if (!statement) throw new Error('Statement not found');
  if (statement.status === 'reconciled') throw new Error('Statement is already reconciled');

  const last = await BankStatementLine.findOne({ tenantId, statementId })
    .sort({ lineIndex: -1 })
    .select('lineIndex')
    .lean();
  let idx = last ? Number(last.lineIndex) + 1 : 0;

  const docs = (Array.isArray(lines) ? lines : [])
    .map((line) => {
      const doc = {
        tenantId,
        statementId,
        accountId: statement.accountId,
        date: line.date ? new Date(line.date) : statement.statementDate,
        label: String(line.label || line.description || '').trim(),
        reference: String(line.reference || '').trim(),
        amount: round2(line.amount),
        lineIndex: idx,
      };
      idx += 1;
      return doc;
    })
    .filter((l) => l.amount !== 0);

  if (docs.length) await BankStatementLine.insertMany(docs);
  return getBankStatement(tenantId, statementId);
}

/**
 * Posted journal items on this bank/cash account that are not yet matched.
 */
export async function listUnmatchedJournalItems(tenantId, accountId, { from, to, limit = 200 } = {}) {
  await assertBankAccount(tenantId, accountId);
  const filter = {
    tenantId,
    accountId,
    state: 'posted',
    $or: [{ reconcileId: null }, { reconcileId: { $exists: false } }],
  };
  if (from || to) {
    filter.entryDate = {};
    if (from) filter.entryDate.$gte = new Date(from);
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      filter.entryDate.$lte = end;
    }
  }
  return JournalItem.find(filter)
    .sort({ entryDate: -1, createdAt: -1 })
    .limit(Math.min(500, Math.max(1, Number(limit) || 200)))
    .lean();
}

/**
 * Unmatched Outstanding Payments credits (vendor disbursements awaiting bank clearance).
 */
export async function listUnmatchedOutstandingPayments(tenantId, { limit = 200 } = {}) {
  let outstandingAccountId = null;
  try {
    const { ensureAccountingDefaults, resolveRoleAccount, getAccountMap } = await import('./accountingService.js');
    const { byCode, byId } = await getAccountMap(tenantId);
    const { ids: defaultIds } = await ensureAccountingDefaults(tenantId);
    const outstanding = await resolveRoleAccount(tenantId, 'outstandingPayments', { byCode, byId, defaultIds });
    outstandingAccountId = outstanding?._id || null;
  } catch {
    outstandingAccountId = null;
  }
  if (!outstandingAccountId) return [];

  return JournalItem.find({
    tenantId,
    accountId: outstandingAccountId,
    state: 'posted',
    credit: { $gt: 0 },
    $or: [{ reconcileId: null }, { reconcileId: { $exists: false } }],
  })
    .sort({ entryDate: -1, createdAt: -1 })
    .limit(Math.min(500, Math.max(1, Number(limit) || 200)))
    .lean();
}

/**
 * Unmatched Outstanding Receipts debits (customer receipts awaiting bank clearance).
 */
export async function listUnmatchedOutstandingReceipts(tenantId, { limit = 200 } = {}) {
  let outstandingAccountId = null;
  try {
    const { ensureAccountingDefaults, resolveRoleAccount, getAccountMap } = await import('./accountingService.js');
    const { byCode, byId } = await getAccountMap(tenantId);
    const { ids: defaultIds } = await ensureAccountingDefaults(tenantId);
    const outstanding = await resolveRoleAccount(tenantId, 'outstandingReceipts', { byCode, byId, defaultIds });
    outstandingAccountId = outstanding?._id || null;
  } catch {
    outstandingAccountId = null;
  }
  if (!outstandingAccountId) return [];

  return JournalItem.find({
    tenantId,
    accountId: outstandingAccountId,
    state: 'posted',
    debit: { $gt: 0 },
    $or: [{ reconcileId: null }, { reconcileId: { $exists: false } }],
  })
    .sort({ entryDate: -1, createdAt: -1 })
    .limit(Math.min(500, Math.max(1, Number(limit) || 200)))
    .lean();
}

export async function listUnmatchedStatementLines(tenantId, { statementId = null, accountId = null } = {}) {
  const filter = {
    tenantId,
    $or: [{ reconcileId: null }, { reconcileId: { $exists: false } }],
  };
  if (statementId) filter.statementId = statementId;
  if (accountId) filter.accountId = accountId;
  return BankStatementLine.find(filter).sort({ date: 1, lineIndex: 1 }).lean();
}

/**
 * Match one statement line to one or more journal items (amounts should net-equal).
 * Optionally clear Outstanding Payments: select outstanding credit items for an outflow;
 * a clearance journal (Outstanding Dr / Bank Cr) is posted and matched to the statement.
 */
export async function matchBankReconciliation(tenantId, userId, {
  statementLineId,
  journalItemIds = [],
  outstandingJournalItemIds = [],
  outstandingReceiptJournalItemIds = [],
} = {}) {
  if (!statementLineId) throw new Error('statementLineId is required');
  const bankIds = (Array.isArray(journalItemIds) ? journalItemIds : []).filter(Boolean);
  const outstandingIds = (Array.isArray(outstandingJournalItemIds) ? outstandingJournalItemIds : []).filter(Boolean);
  const outstandingReceiptIds = (Array.isArray(outstandingReceiptJournalItemIds) ? outstandingReceiptJournalItemIds : []).filter(Boolean);
  if (!bankIds.length && !outstandingIds.length && !outstandingReceiptIds.length) throw new Error('journalItemIds required');

  const line = await BankStatementLine.findOne({ _id: statementLineId, tenantId });
  if (!line) throw new Error('Statement line not found');
  if (line.reconcileId) throw new Error('Statement line already matched');

  let ids = [...bankIds];
  let clearanceEntry = null;

  if (outstandingIds.length) {
    const stmtAmt = round2(line.amount);
    if (stmtAmt >= 0) {
      throw new Error('Outstanding payments can only clear bank outflows (negative statement lines)');
    }
    const outstandingItems = await JournalItem.find({
      _id: { $in: outstandingIds },
      tenantId,
      state: 'posted',
    });
    if (outstandingItems.length !== outstandingIds.length) {
      throw new Error('One or more outstanding payment items not found');
    }
    if (outstandingItems.some((i) => i.reconcileId)) {
      throw new Error('One or more outstanding payment items are already matched');
    }
    const outCredit = round2(outstandingItems.reduce((s, i) => s + Number(i.credit || 0), 0));
    if (Math.abs(outCredit + stmtAmt) > 0.02) {
      throw new Error(`Outstanding credits ${outCredit} do not match statement outflow ${stmtAmt}`);
    }

    const { postOutstandingPaymentClearance } = await import('./accountingService.js');
    clearanceEntry = await postOutstandingPaymentClearance({
      tenantId,
      userId,
      bankAccountId: line.accountId,
      amount: outCredit,
      paymentDate: line.date || new Date(),
      reference: line.reference || line.label || '',
      memo: `Bank clearance: ${line.label || line.reference || ''}`.trim(),
    });
    if (!clearanceEntry?._id) throw new Error('Failed to post outstanding payment clearance');

    const bankCreditItems = await JournalItem.find({
      tenantId,
      moveId: clearanceEntry._id,
      accountId: line.accountId,
      credit: { $gt: 0 },
      state: 'posted',
    }).select('_id');
    ids = [...ids, ...bankCreditItems.map((i) => String(i._id))];
  }

  if (outstandingReceiptIds.length) {
    const stmtAmt = round2(line.amount);
    if (stmtAmt <= 0) {
      throw new Error('Outstanding receipts can only clear bank inflows (positive statement lines)');
    }
    const outstandingItems = await JournalItem.find({
      _id: { $in: outstandingReceiptIds },
      tenantId,
      state: 'posted',
    });
    if (outstandingItems.length !== outstandingReceiptIds.length) {
      throw new Error('One or more outstanding receipt items not found');
    }
    if (outstandingItems.some((i) => i.reconcileId)) {
      throw new Error('One or more outstanding receipt items are already matched');
    }
    const outDebit = round2(outstandingItems.reduce((s, i) => s + Number(i.debit || 0), 0));
    if (Math.abs(outDebit - stmtAmt) > 0.02) {
      throw new Error(`Outstanding debits ${outDebit} do not match statement inflow ${stmtAmt}`);
    }

    const { postOutstandingReceiptClearance } = await import('./accountingService.js');
    clearanceEntry = await postOutstandingReceiptClearance({
      tenantId,
      userId,
      bankAccountId: line.accountId,
      amount: outDebit,
      paymentDate: line.date || new Date(),
      reference: line.reference || line.label || '',
      memo: `Bank clearance: ${line.label || line.reference || ''}`.trim(),
    });
    if (!clearanceEntry?._id) throw new Error('Failed to post outstanding receipt clearance');

    const bankDebitItems = await JournalItem.find({
      tenantId,
      moveId: clearanceEntry._id,
      accountId: line.accountId,
      debit: { $gt: 0 },
      state: 'posted',
    }).select('_id');
    ids = [...ids, ...bankDebitItems.map((i) => String(i._id))];
  }

  if (!ids.length) throw new Error('journalItemIds required');

  const items = await JournalItem.find({
    _id: { $in: ids },
    tenantId,
    accountId: line.accountId,
    state: 'posted',
  });
  if (items.length !== ids.length) {
    throw new Error('One or more journal items not found on this bank account');
  }
  if (items.some((i) => i.reconcileId)) {
    throw new Error('One or more journal items are already matched');
  }

  // Statement amount: +in / −out. Journal cash/bank: debit increases, credit decreases.
  // Match when sum(item.debit − item.credit) ≈ statement amount.
  const glNet = round2(items.reduce((s, i) => s + Number(i.debit || 0) - Number(i.credit || 0), 0));
  const stmtAmt = round2(line.amount);
  if (Math.abs(glNet - stmtAmt) > 0.02) {
    throw new Error(
      `Amounts do not match (statement ${stmtAmt} ≠ journal net ${glNet})`,
    );
  }

  const reconcileId = new mongoose.Types.ObjectId();
  line.reconcileId = reconcileId;
  line.matchedAt = new Date();
  line.matchedBy = userId || undefined;
  await line.save();

  await JournalItem.updateMany(
    { _id: { $in: ids }, tenantId },
    { $set: { reconcileId } },
  );

  if (outstandingIds.length) {
    await JournalItem.updateMany(
      { _id: { $in: outstandingIds }, tenantId },
      { $set: { reconcileId } },
    );
  }

  if (outstandingReceiptIds.length) {
    await JournalItem.updateMany(
      { _id: { $in: outstandingReceiptIds }, tenantId },
      { $set: { reconcileId } },
    );
  }

  return {
    reconcileId,
    statementLine: line.toObject(),
    journalItemIds: ids,
    outstandingJournalItemIds: outstandingIds,
    outstandingReceiptJournalItemIds: outstandingReceiptIds,
    clearanceEntryId: clearanceEntry?._id || null,
  };
}

export async function unmatchBankReconciliation(tenantId, { reconcileId = null, statementLineId = null } = {}) {
  let rid = reconcileId;
  if (!rid && statementLineId) {
    const line = await BankStatementLine.findOne({ _id: statementLineId, tenantId }).select('reconcileId');
    rid = line?.reconcileId;
  }
  if (!rid) throw new Error('reconcileId or matched statementLineId required');

  await BankStatementLine.updateMany(
    { tenantId, reconcileId: rid },
    { $set: { reconcileId: null, matchedAt: null, matchedBy: null } },
  );
  await JournalItem.updateMany(
    { tenantId, reconcileId: rid },
    { $set: { reconcileId: null } },
  );
  return { reconcileId: rid, unmatched: true };
}

export async function getReconciliationSummary(tenantId, accountId) {
  await assertBankAccount(tenantId, accountId);
  const [unmatchedItems, unmatchedLines, statements] = await Promise.all([
    JournalItem.countDocuments({
      tenantId,
      accountId,
      state: 'posted',
      $or: [{ reconcileId: null }, { reconcileId: { $exists: false } }],
    }),
    BankStatementLine.countDocuments({
      tenantId,
      accountId,
      $or: [{ reconcileId: null }, { reconcileId: { $exists: false } }],
    }),
    BankStatement.countDocuments({ tenantId, accountId }),
  ]);
  return { accountId, unmatchedItems, unmatchedLines, statements };
}

function tokenizeMatchText(...parts) {
  return String(parts.filter(Boolean).join(' '))
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 2);
}

/**
 * Score unmatched GL / outstanding items against one bank statement line.
 * Factors: exact/near amount, date proximity, label/reference token overlap.
 */
export async function suggestBankMatches(tenantId, statementLineId, { limit = 12 } = {}) {
  const line = await BankStatementLine.findOne({ _id: statementLineId, tenantId }).lean();
  if (!line) throw new Error('Statement line not found');
  if (line.reconcileId) return { line, suggestions: [], message: 'Line already matched' };

  const stmtAmt = round2(line.amount);
  const isInflow = stmtAmt > 0;
  const absStmt = Math.abs(stmtAmt);
  const lineDate = line.date ? new Date(line.date) : null;
  const tokens = new Set(tokenizeMatchText(line.label, line.reference));

  const [glItems, outstandingPays, outstandingReceipts] = await Promise.all([
    listUnmatchedJournalItems(tenantId, line.accountId, { limit: 300 }),
    isInflow ? Promise.resolve([]) : listUnmatchedOutstandingPayments(tenantId, { limit: 200 }),
    isInflow ? listUnmatchedOutstandingReceipts(tenantId, { limit: 200 }) : Promise.resolve([]),
  ]);

  const candidates = [];
  for (const item of glItems) {
    const net = round2((Number(item.debit) || 0) - (Number(item.credit) || 0));
    candidates.push({
      item,
      bucket: 'journal',
      amount: net,
      id: String(item._id),
    });
  }
  for (const item of outstandingPays) {
    candidates.push({
      item,
      bucket: 'outstanding_payment',
      amount: -round2(Number(item.credit) || 0),
      id: String(item._id),
    });
  }
  for (const item of outstandingReceipts) {
    candidates.push({
      item,
      bucket: 'outstanding_receipt',
      amount: round2(Number(item.debit) || 0),
      id: String(item._id),
    });
  }

  const scored = candidates.map((c) => {
    let score = 0;
    const reasons = [];
    const absAmt = Math.abs(c.amount);
    const amtDiff = round2(Math.abs(absAmt - absStmt));

    // Direction: statement inflow should match positive GL net / receipt debit
    if ((stmtAmt > 0 && c.amount > 0) || (stmtAmt < 0 && c.amount < 0)) {
      score += 15;
      reasons.push('direction');
    } else {
      score -= 40;
      reasons.push('wrong_direction');
    }

    if (amtDiff <= 0.01) {
      score += 100;
      reasons.push('exact_amount');
    } else if (amtDiff <= 1) {
      score += 70;
      reasons.push('near_amount');
    } else if (amtDiff <= absStmt * 0.02) {
      score += 40;
      reasons.push('close_amount');
    } else if (amtDiff > absStmt * 0.25 && absStmt > 0) {
      score -= 30;
      reasons.push('amount_mismatch');
    }

    if (lineDate && c.item.entryDate) {
      const days = Math.abs((new Date(c.item.entryDate) - lineDate) / 86400000);
      if (days <= 0.5) {
        score += 25;
        reasons.push('same_day');
      } else if (days <= 3) {
        score += 15;
        reasons.push('within_3_days');
      } else if (days <= 14) {
        score += 5;
        reasons.push('within_2_weeks');
      }
    }

    const itemTokens = tokenizeMatchText(
      c.item.description,
      c.item.entryNumber,
      c.item.sourceModel,
    );
    let overlap = 0;
    for (const t of itemTokens) {
      if (tokens.has(t)) overlap += 1;
    }
    if (overlap >= 2) {
      score += 35;
      reasons.push('reference_match');
    } else if (overlap === 1) {
      score += 18;
      reasons.push('partial_reference');
    }

    // Prefer invoice-like refs embedded in label
    const ref = String(line.reference || line.label || '');
    if (ref && c.item.entryNumber && ref.toLowerCase().includes(String(c.item.entryNumber).toLowerCase())) {
      score += 40;
      reasons.push('entry_number');
    }

    return {
      id: c.id,
      bucket: c.bucket,
      score,
      reasons,
      amount: c.amount,
      residual: round2(stmtAmt - c.amount),
      item: c.item,
    };
  })
    .filter((s) => s.score >= 40)
    .sort((a, b) => b.score - a.score || Math.abs(a.residual) - Math.abs(b.residual))
    .slice(0, Math.min(30, Math.max(1, Number(limit) || 12)));

  return {
    line,
    suggestions: scored,
    best: scored[0] || null,
  };
}
