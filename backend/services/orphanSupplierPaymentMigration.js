/**
 * Identify and repair orphan supplier payments that debit AP without a vendor bill.
 *
 * Modes:
 *  - reconstruct: create a posted vendor bill from PO/GRN, reverse the orphan AP debit,
 *    post proper bill JE (Dr 1310/expense + 1400 / Cr 2000), then post bill payment.
 *  - reclassify: reverse orphan AP debit and post Advance to Suppliers (1290) instead.
 *
 * Dry-run by default — pass apply:true to write.
 */
import JournalEntry from '../models/JournalEntry.js';
import PurchaseOrder from '../models/PurchaseOrder.js';
import Invoice from '../models/Invoice.js';
import ChartOfAccount from '../models/ChartOfAccount.js';
import GRN from '../models/GRN.js';
import {
  ensureDefaultChartOfAccounts,
  ensureAccountingDefaults,
  createJournalEntry,
  postVendorBillPaymentJournal,
  postSupplierAdvanceJournal,
  syncStoredAccountBalances,
  ACCOUNT_CODE_MAP,
  voidJournalEntry,
} from './accountingService.js';
import { postPurchaseInvoiceJournal } from './inventory/stockAccounting.js';

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

async function getApBalance(tenantId) {
  const ap = await ChartOfAccount.findOne({ tenantId, code: '2000' }).select('balance').lean();
  return round2(Number(ap?.balance || 0));
}

async function nextBillNumber(tenantId, year = new Date().getFullYear()) {
  const prefix = `BILL-${year}-`;
  const last = await Invoice.findOne({
    tenantId,
    invoiceNumber: new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`),
  })
    .sort({ createdAt: -1 })
    .select('invoiceNumber')
    .lean();
  const seq = last?.invoiceNumber
    ? (parseInt(String(last.invoiceNumber).split('-').pop(), 10) || 0) + 1
    : 1;
  return `${prefix}${String(seq).padStart(6, '0')}`;
}

/**
 * Find posted PurchaseOrderPayment journals that debit AP with no linked bill payment.
 */
export async function findOrphanSupplierPayments(tenantId) {
  const entries = await JournalEntry.find({
    tenantId,
    status: 'posted',
    $or: [
      { sourceModel: 'PurchaseOrderPayment' },
      { memo: /Supplier payment for PO/i },
    ],
  })
    .sort({ entryDate: 1 })
    .lean();

  const orphans = [];
  for (const je of entries) {
    const po = await PurchaseOrder.findOne({ _id: je.sourceId, tenantId })
      .select('poNumber supplierId grandTotal paidAmount billedInvoiceId payments lineItems totalTax subtotal status')
      .lean();
    if (!po) {
      orphans.push({
        journalEntryId: je._id,
        journalNumber: je.entryNumber || je.reference,
        memo: je.memo,
        amount: round2(je.lines?.find((l) => Number(l.debit) > 0)?.debit || 0),
        entryDate: je.entryDate,
        reason: 'missing_po',
        recommendedAction: 'reclassify',
        po: null,
      });
      continue;
    }

    const hasBill = Boolean(po.billedInvoiceId)
      || Boolean(await Invoice.exists({
        tenantId,
        flow: 'purchase',
        invoiceType: '388',
        sourcePurchaseOrderId: po._id,
        status: { $nin: ['draft', 'cancelled'] },
      }));

    // Already has a bill — payment should have been against bill; still orphan AP if no VendorBillPayment
    const billPay = await JournalEntry.exists({
      tenantId,
      sourceModel: 'VendorBillPayment',
      sourceId: po.billedInvoiceId || undefined,
      status: 'posted',
      memo: new RegExp(String(po.poNumber || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&') || '___none___'),
    });

    if (hasBill && billPay) continue;

    const amount = round2(
      (je.lines || []).find((l) => String(l.accountCode) === '2000' && Number(l.debit) > 0)?.debit
      || (je.lines || []).find((l) => Number(l.debit) > 0)?.debit
      || 0,
    );

    const grnCount = await GRN.countDocuments({
      tenantId,
      purchaseOrderId: po._id,
      status: { $in: ['received', 'completed'] },
    });

    orphans.push({
      journalEntryId: je._id,
      journalNumber: je.entryNumber || je.reference,
      memo: je.memo,
      amount,
      entryDate: je.entryDate,
      reason: hasBill ? 'paid_po_despite_bill' : 'no_vendor_bill',
      recommendedAction: grnCount > 0 || (po.lineItems || []).length ? 'reconstruct' : 'reclassify',
      po: {
        _id: po._id,
        poNumber: po.poNumber,
        supplierId: po.supplierId,
        grandTotal: po.grandTotal,
        billedInvoiceId: po.billedInvoiceId || null,
        grnCount,
      },
    });
  }

  return orphans;
}

async function reverseOrphanApDebit({ tenantId, userId, orphanJe, dryRun }) {
  if (dryRun) return { reversed: false, dryRun: true };
  // Prefer void/reverse if available; else create offsetting JE
  if (typeof voidJournalEntry === 'function') {
    try {
      const voided = await voidJournalEntry(
        tenantId,
        orphanJe._id || orphanJe.journalEntryId,
        userId,
        'Reclassify orphan supplier payment (no vendor bill)',
      );
      if (voided) return { reversed: true, method: 'void', entry: voided };
    } catch {
      // fall through to manual reverse
    }
  }

  const full = await JournalEntry.findOne({ _id: orphanJe._id || orphanJe.journalEntryId, tenantId });
  if (!full) return { reversed: false, error: 'journal_not_found' };

  const reverseLines = (full.lines || []).map((l) => ({
    accountId: l.accountId,
    accountCode: l.accountCode,
    debit: round2(Number(l.credit) || 0),
    credit: round2(Number(l.debit) || 0),
    description: `Reverse orphan: ${l.description || ''}`,
    partnerId: l.partnerId || null,
  })).filter((l) => l.debit > 0 || l.credit > 0);

  if (reverseLines.length < 2) return { reversed: false, error: 'cannot_reverse' };

  const entry = await createJournalEntry({
    tenantId,
    userId,
    entryDate: full.entryDate || new Date(),
    type: 'reversal',
    memo: `Reversal: ${full.memo || 'orphan supplier payment'}`,
    reference: `REV-${full.reference || full._id}`,
    lines: reverseLines,
    sourceModel: 'OrphanSupplierPaymentReversal',
    sourceId: full._id,
    sourceNumber: full.sourceNumber || '',
    status: 'posted',
    journalId: full.journalId || null,
  });
  return { reversed: true, method: 'reversal_je', entry };
}

async function reconstructBillFromPo({ tenantId, userId, po, orphan, dryRun }) {
  const order = await PurchaseOrder.findOne({ _id: po._id, tenantId });
  if (!order) return { ok: false, error: 'po_not_found' };

  const existingBill = await Invoice.findOne({
    tenantId,
    flow: 'purchase',
    invoiceType: '388',
    sourcePurchaseOrderId: order._id,
    status: { $nin: ['draft', 'cancelled'] },
  });
  if (existingBill) {
    return { ok: true, bill: existingBill, created: false };
  }

  const grns = await GRN.find({
    tenantId,
    purchaseOrderId: order._id,
    status: { $in: ['received', 'completed'] },
  }).select('_id').lean();

  const invoiceNumber = await nextBillNumber(tenantId);
  const issueDate = orphan.entryDate ? new Date(orphan.entryDate) : new Date();
  const lineItems = (order.lineItems || []).map((li, idx) => {
    const qty = Number(li.quantityReceived || li.quantity || 0);
    const unitPrice = Number(li.unitCost || li.unitPrice || 0);
    const taxRate = Number(li.taxRate ?? 15);
    const lineTotal = round2(qty * unitPrice);
    const taxAmount = round2(lineTotal * (taxRate / 100));
    return {
      lineNumber: idx + 1,
      productId: li.productId,
      productName: li.productName || li.description || 'Item',
      description: li.description || li.productName || '',
      quantity: qty,
      unitPrice,
      taxRate,
      taxAmount,
      lineTotal,
      lineTotalWithTax: round2(lineTotal + taxAmount),
      productType: li.productType || 'product',
      sourcePoItemId: li._id,
    };
  }).filter((li) => li.quantity > 0);

  const subtotal = round2(lineItems.reduce((s, l) => s + l.lineTotal, 0));
  const totalTax = round2(lineItems.reduce((s, l) => s + l.taxAmount, 0));
  const grandTotal = round2(subtotal + totalTax);

  if (dryRun) {
    return {
      ok: true,
      created: true,
      dryRun: true,
      preview: { invoiceNumber, subtotal, totalTax, grandTotal, lineCount: lineItems.length, grnIds: grns.map((g) => g._id) },
    };
  }

  const Supplier = (await import('../models/Supplier.js')).default;
  const supplier = order.supplierId
    ? await Supplier.findOne({ _id: order.supplierId, tenantId }).lean()
    : null;

  const bill = await Invoice.create({
    tenantId,
    flow: 'purchase',
    invoiceNumber,
    invoiceType: '388',
    invoiceTypeCode: '0100000',
    transactionType: 'B2B',
    issueDate,
    accountingDate: issueDate,
    vendorInvoiceNumber: `MIG-${order.poNumber || invoiceNumber}`,
    vendorInvoiceDate: issueDate,
    contractNumber: `MIG-${order.poNumber || invoiceNumber}`,
    supplierId: order.supplierId,
    seller: {
      name: supplier?.nameEn || supplier?.name || 'Supplier',
      nameAr: supplier?.nameAr || '',
      vatNumber: supplier?.vatNumber || '',
    },
    buyer: { name: 'Company' },
    lineItems,
    subtotal,
    taxableAmount: subtotal,
    totalTax,
    grandTotal,
    currency: 'SAR',
    status: 'approved',
    paymentStatus: 'pending',
    paidAmount: 0,
    sourcePurchaseOrderId: order._id,
    sourceGrnIds: grns.map((g) => g._id),
    purchaseOrderNumber: order.poNumber,
    internalNotes: 'Auto-reconstructed by orphan supplier payment migration',
  });

  await postPurchaseInvoiceJournal({
    tenantId,
    userId,
    invoice: bill,
    currency: 'SAR',
  });

  order.billedInvoiceId = bill._id;
  if (['received', 'partially_received'].includes(order.status)) {
    order.status = 'billed';
  }
  await order.save();

  return { ok: true, bill, created: true };
}

/**
 * @param {object} opts
 * @param {boolean} [opts.dryRun=true]
 * @param {'auto'|'reconstruct'|'reclassify'} [opts.strategy='auto']
 */
export async function migrateOrphanSupplierPayments(tenantId, {
  dryRun = true,
  strategy = 'auto',
  userId = null,
} = {}) {
  await ensureDefaultChartOfAccounts(tenantId);
  await ensureAccountingDefaults(tenantId);

  const apBefore = await getApBalance(tenantId);
  const orphans = await findOrphanSupplierPayments(tenantId);

  const rows = [];
  let reconstructCount = 0;
  let reclassifyCount = 0;
  let skipped = 0;
  let apDeltaEstimate = 0;

  for (const orphan of orphans) {
    const action = strategy === 'auto'
      ? orphan.recommendedAction
      : strategy;

    const row = {
      ...orphan,
      action,
      applied: false,
      details: null,
    };

    // Each orphan currently Dr AP — reversing removes that debit (AP balance ↑ toward credit for liability)
    // Liability nature: +credit −debit, so reversing a debit increases AP liability (corrects the debit balance).
    apDeltaEstimate = round2(apDeltaEstimate + orphan.amount);

    if (dryRun) {
      if (action === 'reconstruct' && orphan.po) {
        const preview = await reconstructBillFromPo({
          tenantId,
          userId,
          po: orphan.po,
          orphan,
          dryRun: true,
        });
        row.details = preview;
        reconstructCount += 1;
      } else {
        row.details = {
          would: 'reclassify_to_1290',
          account: ACCOUNT_CODE_MAP.advanceToSuppliers,
          amount: orphan.amount,
        };
        reclassifyCount += 1;
      }
      rows.push(row);
      continue;
    }

    try {
      const reverse = await reverseOrphanApDebit({
        tenantId,
        userId,
        orphanJe: orphan,
        dryRun: false,
      });
      if (!reverse.reversed) {
        row.details = { error: reverse.error || 'reverse_failed' };
        skipped += 1;
        rows.push(row);
        continue;
      }

      if (action === 'reconstruct' && orphan.po) {
        const built = await reconstructBillFromPo({
          tenantId,
          userId,
          po: orphan.po,
          orphan,
          dryRun: false,
        });
        if (!built.ok || !built.bill) {
          // Fall back to advance
          const poDoc = await PurchaseOrder.findOne({ _id: orphan.po._id, tenantId });
          await postSupplierAdvanceJournal({
            tenantId,
            userId,
            purchaseOrder: poDoc,
            amount: orphan.amount,
            paymentDate: orphan.entryDate || new Date(),
            reference: `mig-adv-${orphan.journalEntryId}`,
            notes: 'Migrated orphan PO payment → advance (bill reconstruct failed)',
          });
          reclassifyCount += 1;
          row.action = 'reclassify';
          row.details = { reverse, reconstructError: built.error, fellBackToAdvance: true };
        } else {
          await postVendorBillPaymentJournal({
            tenantId,
            userId,
            invoice: built.bill,
            amount: orphan.amount,
            paymentDate: orphan.entryDate || new Date(),
            reference: `mig-pay-${orphan.journalEntryId}`,
            memo: `Migrated payment for reconstructed bill ${built.bill.invoiceNumber}`,
          });
          const bill = await Invoice.findById(built.bill._id);
          if (bill) {
            const paid = round2(Number(bill.paidAmount || 0) + orphan.amount);
            bill.paidAmount = paid;
            bill.paymentStatus = paid >= round2(bill.grandTotal) - 0.001 ? 'paid' : 'partial';
            await bill.save();
          }
          reconstructCount += 1;
          row.details = { reverse, billId: built.bill._id, billNumber: built.bill.invoiceNumber, created: built.created };
        }
      } else {
        const poDoc = orphan.po
          ? await PurchaseOrder.findOne({ _id: orphan.po._id, tenantId })
          : null;
        if (!poDoc) {
          skipped += 1;
          row.details = { reverse, error: 'no_po_for_advance' };
        } else {
          await postSupplierAdvanceJournal({
            tenantId,
            userId,
            purchaseOrder: poDoc,
            amount: orphan.amount,
            paymentDate: orphan.entryDate || new Date(),
            reference: `mig-adv-${orphan.journalEntryId}`,
            notes: 'Migrated orphan PO payment → Advance to Suppliers',
          });
          // Mark matching payment rows as advances
          for (const p of poDoc.payments || []) {
            if (String(p.journalEntryId) === String(orphan.journalEntryId)) {
              p.asAdvance = true;
            }
          }
          await poDoc.save();
          reclassifyCount += 1;
          row.details = { reverse, advanceAccount: ACCOUNT_CODE_MAP.advanceToSuppliers };
        }
      }
      row.applied = true;
    } catch (err) {
      skipped += 1;
      row.details = { error: err.message };
    }
    rows.push(row);
  }

  if (!dryRun) {
    await syncStoredAccountBalances(tenantId);
  }
  const apAfter = dryRun
    ? round2(apBefore + apDeltaEstimate)
    : await getApBalance(tenantId);

  return {
    dryRun,
    strategy,
    orphanCount: orphans.length,
    reconstructCount,
    reclassifyCount,
    skipped,
    apBalanceBefore: apBefore,
    apBalanceAfter: apAfter,
    /**
     * Liability account: positive balance = credit (normal). Negative = debit (abnormal).
     * Migrating orphan Dr AP payments increases AP toward a normal credit balance.
     */
    apBalanceNote: 'Liability: positive = credit (normal AP), negative = debit (abnormal). Migration reverses orphan AP debits.',
    rows,
  };
}
