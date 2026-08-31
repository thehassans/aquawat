/**
 * Pure scoring for bank reconciliation auto-match (unit-testable).
 */

const round2 = (value) => Math.round((Number(value) || 0) * 100) / 100;

export function tokenizeMatchText(...parts) {
  return String(parts.filter(Boolean).join(' '))
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 2);
}

/**
 * @param {object} line - statement line { amount, date, label, reference }
 * @param {object} candidate - { amount, item: { entryDate, description, entryNumber, sourceModel }, bucket, id }
 * @param {array} activeModels - reconciliation models
 */
export function scoreBankMatchCandidate(line, candidate, activeModels = []) {
  const stmtAmt = round2(line?.amount);
  const absStmt = Math.abs(stmtAmt);
  const lineDate = line?.date ? new Date(line.date) : null;
  const tokens = new Set(tokenizeMatchText(line?.label, line?.reference));

  let score = 0;
  const reasons = [];
  const absAmt = Math.abs(candidate.amount);
  const amtDiff = round2(Math.abs(absAmt - absStmt));

  if ((stmtAmt > 0 && candidate.amount > 0) || (stmtAmt < 0 && candidate.amount < 0)) {
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

  if (lineDate && candidate.item?.entryDate) {
    const days = Math.abs((new Date(candidate.item.entryDate) - lineDate) / 86400000);
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
    candidate.item?.description,
    candidate.item?.entryNumber,
    candidate.item?.sourceModel,
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

  const ref = String(line?.reference || line?.label || '');
  if (ref && candidate.item?.entryNumber && ref.toLowerCase().includes(String(candidate.item.entryNumber).toLowerCase())) {
    score += 40;
    reasons.push('entry_number');
  }

  const labelText = String(line?.label || '').toLowerCase();
  const refText = String(line?.reference || '').toLowerCase();
  for (const model of activeModels || []) {
    const labelNeedle = String(model.labelContains || '').toLowerCase();
    const refNeedle = String(model.referenceContains || '').toLowerCase();
    if (labelNeedle && labelText.includes(labelNeedle)) {
      score += 25 + Math.min(20, Number(model.priority) || 0);
      reasons.push(`model:${model.name}`);
    }
    if (refNeedle && refText.includes(refNeedle)) {
      score += 20;
      reasons.push(`model_ref:${model.name}`);
    }
    if (model.autoMatchExactAmount && amtDiff <= 0.01) {
      score += 15;
      reasons.push(`model_exact:${model.name}`);
    }
    if (model.autoMatchInvoiceRef && overlap >= 1) {
      score += 12;
      reasons.push(`model_inv:${model.name}`);
    }
    if (model.feePercent > 0 && labelNeedle && labelText.includes(labelNeedle) && amtDiff <= absStmt * (Number(model.feePercent) / 100) * 1.5) {
      score += 10;
      reasons.push(`model_fee:${model.feePercent}%`);
    }
  }

  return {
    id: candidate.id,
    bucket: candidate.bucket,
    score,
    reasons,
    amount: candidate.amount,
    residual: round2(stmtAmt - candidate.amount),
    item: candidate.item,
  };
}

export default { tokenizeMatchText, scoreBankMatchCandidate };
