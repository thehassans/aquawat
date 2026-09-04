/**
 * Pre-post checklist for customer (sell) invoices.
 * Blocking checks must pass before Confirm/Post; duplicate is warning-only.
 */
import mongoose from 'mongoose';
import Invoice from '../../models/Invoice.js';
import Partner from '../../models/Partner.js';
import { isValidSaudiVat } from '../../utils/saudiVat.js';
import { extractDateOnly } from '../../utils/dateOnly.js';
import { getAccountingLockDates } from '../accountingService.js';
import { evaluateCustomerCredit } from './creditLimit.js';
import { resolveProductGlAccounts } from '../inventory/productAccounting.js';

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

function lineHasContent(line = {}) {
  const name = String(line.productName || line.description || line.name || '').trim();
  const price = Number(line.unitPrice);
  return Boolean(name) || (Number.isFinite(price) && price > 0) || Boolean(line.productId);
}

function checkResult({ id, ok, blocking = true, message = '', messageAr = '', detail = null }) {
  return { id, ok: Boolean(ok), blocking: Boolean(blocking), message, messageAr, detail };
}

/**
 * @param {object} opts
 * @param {string|object} opts.tenantId
 * @param {object} opts.payload — invoice body (buyer, lineItems, transactionType, …)
 * @param {string|null} [opts.excludeInvoiceId]
 * @param {boolean} [opts.allowDuplicate=false] — ignore duplicate warning for canPost (always non-blocking)
 */
export async function evaluateInvoicePrePost({
  tenantId,
  payload = {},
  excludeInvoiceId = null,
  language = 'en',
} = {}) {
  const tid = tenantId;
  const txn = String(payload.transactionType || 'B2C').toUpperCase() === 'B2B' ? 'B2B' : 'B2C';
  const lines = (Array.isArray(payload.lineItems) ? payload.lineItems : []).filter(lineHasContent);
  const grandTotal = round2(
    payload.grandTotal != null
      ? Number(payload.grandTotal)
      : (Array.isArray(payload.lineItems)
        ? payload.lineItems.reduce((s, li) => s + Number(li.lineTotalWithTax ?? li.lineTotal ?? 0), 0)
        : 0),
  );

  const customerId = payload.customerId
    ? String(payload.customerId._id || payload.customerId)
    : '';
  const buyer = payload.buyer || {};
  let partner = null;
  if (customerId && mongoose.Types.ObjectId.isValid(customerId)) {
    partner = await Partner.findOne({ _id: customerId, tenantId: tid })
      .select('name nameEn nameAr vatNumber crNumber creditLimit address type entityType')
      .lean();
  }

  const vat = String(buyer.vatNumber || partner?.vatNumber || '').trim();
  const issueOnly = extractDateOnly(payload.issueDate) || extractDateOnly(new Date());

  // 1. Customer selected
  const customerOk = Boolean(customerId && partner);
  const checks = [
    checkResult({
      id: 'customer',
      ok: customerOk,
      message: customerOk ? 'Customer selected' : 'Select a customer before posting',
      messageAr: customerOk ? 'تم اختيار العميل' : 'اختر عميلاً قبل الترحيل',
    }),
  ];

  // 2. B2B VAT
  let b2bVatOk = true;
  let b2bMsg = 'B2B VAT not required (B2C)';
  let b2bMsgAr = 'ضريبة العميل غير مطلوبة (B2C)';
  if (txn === 'B2B') {
    if (!vat) {
      b2bVatOk = false;
      b2bMsg = 'B2B requires a customer VAT number';
      b2bMsgAr = 'فاتورة B2B تتطلب الرقم الضريبي للعميل';
    } else if (!isValidSaudiVat(vat)) {
      b2bVatOk = false;
      b2bMsg = 'Customer VAT must be 15 digits starting and ending with 3';
      b2bMsgAr = 'الرقم الضريبي يجب أن يكون 15 رقماً ويبدأ وينتهي بـ 3';
    } else {
      b2bMsg = 'Customer VAT is valid';
      b2bMsgAr = 'الرقم الضريبي للعميل صالح';
    }
  }
  checks.push(checkResult({
    id: 'b2b_vat',
    ok: b2bVatOk,
    message: b2bMsg,
    messageAr: b2bMsgAr,
    detail: { transactionType: txn, vat: vat || null },
  }));

  // 3. At least one line
  const hasLines = lines.length >= 1;
  checks.push(checkResult({
    id: 'lines',
    ok: hasLines,
    message: hasLines ? `${lines.length} line(s)` : 'Add at least one invoice line',
    messageAr: hasLines ? `${lines.length} بند` : 'أضف بنداً واحداً على الأقل',
  }));

  // 4. Total > 0
  const totalOk = grandTotal > 0.009;
  checks.push(checkResult({
    id: 'total',
    ok: totalOk,
    message: totalOk
      ? `Total ${grandTotal.toFixed(2)}`
      : 'Invoice total must be greater than 0.00',
    messageAr: totalOk
      ? `الإجمالي ${grandTotal.toFixed(2)}`
      : 'إجمالي الفاتورة يجب أن يكون أكبر من 0.00',
    detail: { grandTotal },
  }));

  // 5. Each line: name + unit price > 0
  const badLines = [];
  for (let i = 0; i < lines.length; i += 1) {
    const li = lines[i];
    const name = String(li.productName || li.description || '').trim();
    const price = Number(li.unitPrice);
    if (!name || !Number.isFinite(price) || price <= 0) {
      badLines.push(i + 1);
    }
  }
  const linesDetailOk = hasLines && badLines.length === 0;
  checks.push(checkResult({
    id: 'line_detail',
    ok: linesDetailOk,
    message: linesDetailOk
      ? 'Every line has description and unit price'
      : `Line(s) ${badLines.join(', ')} need a description and unit price > 0`,
    messageAr: linesDetailOk
      ? 'كل البنود لها وصف وسعر وحدة'
      : `البند/البنود ${badLines.join('، ')} تحتاج وصفاً وسعر وحدة أكبر من 0`,
    detail: { badLines },
  }));

  // 6. Income account resolve per line
  const incomeMissing = [];
  for (let i = 0; i < lines.length; i += 1) {
    const li = lines[i];
    try {
      const resolved = await resolveProductGlAccounts(tid, {
        _id: li.productId || undefined,
        incomeAccountId: li.incomeAccountId,
        productType: li.productType || 'goods',
        categoryId: li.categoryId,
      });
      if (!resolved?.income?._id) incomeMissing.push(i + 1);
      else if (!li.incomeAccountId && resolved.income._id) {
        // Soft-stamp for callers that persist the payload after validation
        li.incomeAccountId = resolved.income._id;
      }
    } catch {
      incomeMissing.push(i + 1);
    }
  }
  const incomeOk = hasLines && incomeMissing.length === 0;
  checks.push(checkResult({
    id: 'income_account',
    ok: incomeOk,
    message: incomeOk
      ? 'Income account resolved on every line'
      : `Line(s) ${incomeMissing.join(', ')} missing income account (product → category → company default)`,
    messageAr: incomeOk
      ? 'حساب الإيراد محدد لكل بند'
      : `البند/البنود ${incomeMissing.join('، ')} بلا حساب إيراد (منتج ← فئة ← افتراضي الشركة)`,
    detail: { incomeMissing },
  }));

  // 7. Tax code / rate set
  const taxMissing = [];
  for (let i = 0; i < lines.length; i += 1) {
    const li = lines[i];
    const rate = li.taxRate;
    const cat = String(li.taxCategory || '').trim();
    const rateOk = rate !== '' && rate != null && Number.isFinite(Number(rate)) && Number(rate) >= 0;
    if (!rateOk && !cat) taxMissing.push(i + 1);
  }
  const taxOk = hasLines && taxMissing.length === 0;
  checks.push(checkResult({
    id: 'tax',
    ok: taxOk,
    message: taxOk
      ? 'Tax rate/code set on every line'
      : `Line(s) ${taxMissing.join(', ')} missing tax rate (needed for VAT return)`,
    messageAr: taxOk
      ? 'نسبة/رمز الضريبة محدد لكل بند'
      : `البند/البنود ${taxMissing.join('، ')} بلا نسبة ضريبة (مطلوبة لإقرار الضريبة)`,
    detail: { taxMissing },
  }));

  // 8. Issue date after accounting lock
  const locks = await getAccountingLockDates(tid);
  const lockOnly = extractDateOnly(locks.lockDate);
  let lockOk = true;
  let lockMsg = 'No accounting lock date set';
  let lockMsgAr = 'لا يوجد تاريخ قفل محاسبي';
  if (lockOnly) {
    lockOk = issueOnly > lockOnly;
    lockMsg = lockOk
      ? `Invoice date ${issueOnly} is after lock ${lockOnly}`
      : `Invoice date ${issueOnly} must be after accounting lock date ${lockOnly}`;
    lockMsgAr = lockOk
      ? `تاريخ الفاتورة ${issueOnly} بعد القفل ${lockOnly}`
      : `تاريخ الفاتورة ${issueOnly} يجب أن يكون بعد تاريخ القفل ${lockOnly}`;
  }
  checks.push(checkResult({
    id: 'lock_date',
    ok: lockOk,
    message: lockMsg,
    messageAr: lockMsgAr,
    detail: { issueDate: issueOnly, lockDate: lockOnly },
  }));

  // 9. Credit limit
  let creditOk = true;
  let creditMsg = 'No credit limit set';
  let creditMsgAr = 'لا يوجد حد ائتمان';
  let creditDetail = null;
  if (customerId && partner) {
    // Draft / new: full total. Already-posted edit: only the increase vs prior total (AR already holds residual).
    let creditOrderTotal = grandTotal;
    if (excludeInvoiceId && mongoose.Types.ObjectId.isValid(String(excludeInvoiceId))) {
      const existing = await Invoice.findOne({ _id: excludeInvoiceId, tenantId: tid })
        .select('status grandTotal')
        .lean();
      if (existing && !['draft', 'cancelled', 'void'].includes(String(existing.status || ''))) {
        creditOrderTotal = Math.max(0, grandTotal - Number(existing.grandTotal || 0));
      }
    }
    const credit = await evaluateCustomerCredit({
      tenantId: tid,
      customerId,
      orderTotal: creditOrderTotal,
      excludeOrderId: null,
    });
    creditDetail = {
      exposure: credit.exposure,
      creditLimit: credit.creditLimit,
      skipped: credit.skipped,
    };
    if (credit.skipped) {
      creditOk = true;
    } else if (!credit.ok) {
      creditOk = false;
      creditMsg = credit.error || 'Credit limit exceeded';
      creditMsgAr = `تجاوز حد الائتمان: التعرض ${Number(credit.exposure || 0).toFixed(2)} من ${Number(credit.creditLimit || 0).toFixed(2)}`;
    } else {
      creditMsg = `Credit OK (exposure ${Number(credit.exposure || 0).toFixed(2)} / ${Number(credit.creditLimit || 0).toFixed(2)})`;
      creditMsgAr = `الائتمان ضمن الحد (${Number(credit.exposure || 0).toFixed(2)} / ${Number(credit.creditLimit || 0).toFixed(2)})`;
    }
  } else if (!customerId) {
    creditOk = true;
    creditMsg = 'Credit check skipped (no customer)';
    creditMsgAr = 'تم تخطي فحص الائتمان (لا يوجد عميل)';
  }
  checks.push(checkResult({
    id: 'credit_limit',
    ok: creditOk,
    message: creditMsg,
    messageAr: creditMsgAr,
    detail: creditDetail,
  }));

  // 10. Duplicate warning (non-blocking)
  let duplicateOk = true;
  let duplicateMsg = 'No duplicate invoice found';
  let duplicateMsgAr = 'لا توجد فاتورة مكررة';
  let duplicateDetail = null;
  if (customerId && issueOnly && grandTotal > 0.009) {
    const dayStart = new Date(`${issueOnly}T00:00:00.000Z`);
    const dayEnd = new Date(`${issueOnly}T23:59:59.999Z`);
    const dupFilter = {
      tenantId: tid,
      flow: { $ne: 'purchase' },
      customerId,
      status: { $nin: ['draft', 'cancelled', 'void'] },
      issueDate: { $gte: dayStart, $lte: dayEnd },
      grandTotal: { $gte: grandTotal - 0.02, $lte: grandTotal + 0.02 },
    };
    if (excludeInvoiceId) dupFilter._id = { $ne: excludeInvoiceId };
    const dup = await Invoice.findOne(dupFilter)
      .select('invoiceNumber issueDate grandTotal')
      .lean();
    if (dup) {
      duplicateOk = false;
      duplicateMsg = `Possible duplicate: ${dup.invoiceNumber} (same customer, date, total)`;
      duplicateMsgAr = `تكرار محتمل: ${dup.invoiceNumber} (نفس العميل والتاريخ والإجمالي)`;
      duplicateDetail = {
        invoiceId: dup._id,
        invoiceNumber: dup.invoiceNumber,
        grandTotal: dup.grandTotal,
      };
    }
  }
  checks.push(checkResult({
    id: 'duplicate',
    ok: duplicateOk,
    blocking: false,
    message: duplicateMsg,
    messageAr: duplicateMsgAr,
    detail: duplicateDetail,
  }));

  const blockingFailed = checks.filter((c) => c.blocking && !c.ok);
  const warnings = checks.filter((c) => !c.blocking && !c.ok);
  const canPost = blockingFailed.length === 0;

  return {
    canPost,
    hasWarnings: warnings.length > 0,
    blockingFailed,
    warnings,
    checks,
    language,
    summary: {
      customerId: customerId || null,
      transactionType: txn,
      lineCount: lines.length,
      grandTotal,
      issueDate: issueOnly,
    },
  };
}

/**
 * Throw 400 if blocking checks fail. Duplicate never blocks.
 * Mutates payload.lineItems incomeAccountId when resolved.
 */
export async function assertInvoicePrePostReady({
  tenantId,
  payload,
  excludeInvoiceId = null,
  allowDuplicate = true,
} = {}) {
  const result = await evaluateInvoicePrePost({
    tenantId,
    payload,
    excludeInvoiceId,
  });
  if (!result.canPost) {
    const first = result.blockingFailed[0];
    const err = new Error(first?.message || 'Invoice failed pre-post checks');
    err.status = 400;
    err.code = 'INVOICE_PRE_POST_FAILED';
    err.checks = result.checks;
    err.blockingFailed = result.blockingFailed;
    throw err;
  }
  // allowDuplicate is reserved for future hard-block; warnings are informational
  void allowDuplicate;
  return result;
}
