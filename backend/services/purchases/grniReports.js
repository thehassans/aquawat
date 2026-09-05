/**
 * GRNI / unmatched receipts reports for Stock Interim (Received) 1310.
 */
import GRN from '../../models/GRN.js';
import PurchaseOrder from '../../models/PurchaseOrder.js';
import ChartOfAccount from '../../models/ChartOfAccount.js';
import { toObjectId } from '../../models/inventory/common.js';
import { getAccountBalances } from '../ledger/balances.js';

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

/**
 * Build open GRN lines: net received not yet covered by PO quantityInvoiced (FIFO by receive date).
 * @returns {{ rows: Array, reportTotal: number }}
 */
export async function buildUnmatchedReceiptRows(tenantId, { supplierId, warehouseId } = {}) {
  const tid = toObjectId(tenantId);
  const filter = {
    tenantId: tid,
    status: { $in: ['received', 'completed'] },
    stockPostedAt: { $ne: null },
  };
  if (supplierId) filter.supplierId = toObjectId(supplierId);
  if (warehouseId) filter.warehouseId = toObjectId(warehouseId);

  const grns = await GRN.find(filter)
    .populate('supplierId', 'nameEn nameAr supplierCode')
    .populate('purchaseOrderId', 'poNumber lineItems')
    .sort({ dateReceived: 1, createdAt: 1 })
    .lean();

  // Remaining invoiced budget per PO product (consume FIFO across GRNs)
  const remainingInvoiced = new Map(); // `${poId}:${productId}` -> qty still attributable as billed
  const poIds = [...new Set(grns.map((g) => String(g.purchaseOrderId?._id || g.purchaseOrderId || '')).filter(Boolean))];
  if (poIds.length) {
    const pos = await PurchaseOrder.find({
      tenantId: tid,
      _id: { $in: poIds.map((id) => toObjectId(id)) },
    }).select('lineItems').lean();
    for (const po of pos) {
      const byProduct = new Map();
      for (const li of po.lineItems || []) {
        if (!li.productId) continue;
        const key = String(li.productId);
        byProduct.set(key, (byProduct.get(key) || 0) + num(li.quantityInvoiced));
      }
      for (const [productId, qty] of byProduct) {
        remainingInvoiced.set(`${po._id}:${productId}`, qty);
      }
    }
  }

  const now = Date.now();
  const rows = [];

  for (const grn of grns) {
    const poId = String(grn.purchaseOrderId?._id || grn.purchaseOrderId || '');
    const poNumber = grn.purchaseOrderId?.poNumber || '';
    const poLines = grn.purchaseOrderId?.lineItems || [];

    for (const line of grn.lines || []) {
      if (!line.productId) continue;
      const net = Math.max(0, num(line.quantityReceived) - num(line.quantityReturned));
      if (net <= 1e-9) continue;

      const productKey = String(line.productId);
      const budgetKey = `${poId}:${productKey}`;
      let billedAttr = 0;
      if (poId && remainingInvoiced.has(budgetKey)) {
        const budget = remainingInvoiced.get(budgetKey);
        billedAttr = Math.min(net, Math.max(0, budget));
        remainingInvoiced.set(budgetKey, budget - billedAttr);
      }

      const openQty = round2(net - billedAttr);
      if (openQty <= 1e-9) continue;

      // Unit cost: GRN line cost, else PO line unitCost
      let unitCost = num(line.costPrice);
      if (!(unitCost > 0) && poLines.length) {
        const poLine = poLines.find((p) => String(p.productId) === productKey);
        unitCost = num(poLine?.unitCost);
      }

      const amount = round2(openQty * unitCost);
      const recvDate = grn.dateReceived || grn.stockPostedAt || grn.createdAt;
      const ageDays = recvDate ? Math.max(0, Math.floor((now - new Date(recvDate).getTime()) / 86400000)) : 0;

      rows.push({
        grnId: grn._id,
        grnNumber: grn.grnNumber,
        dateReceived: recvDate,
        ageDays,
        supplierId: grn.supplierId?._id || grn.supplierId,
        supplierName: grn.supplierId?.nameEn || grn.supplierId?.nameAr || '',
        purchaseOrderId: poId || null,
        poNumber,
        productId: line.productId,
        productName: line.productName || '',
        uom: line.uom || '',
        quantityReceived: net,
        quantityBilledAttributed: billedAttr,
        quantityOpen: openQty,
        unitCost,
        amount,
        warehouseId: grn.warehouseId,
      });
    }
  }

  const reportTotal = round2(rows.reduce((s, r) => s + num(r.amount), 0));
  return { rows, reportTotal };
}

/**
 * Unmatched receipts report (GRNs without full vendor bill).
 */
export async function unmatchedReceiptsReport(tenantId, filters = {}) {
  const { rows, reportTotal } = await buildUnmatchedReceiptRows(tenantId, filters);
  return {
    rows,
    totalAmount: reportTotal,
    totalLines: rows.length,
    totalOpenQty: round2(rows.reduce((s, r) => s + num(r.quantityOpen), 0)),
  };
}

/**
 * 1310 Stock Interim (Received) reconciliation: open GRN lines vs GL balance.
 */
export async function stockInterimReceivedReconciliation(tenantId, filters = {}) {
  const tid = toObjectId(tenantId);
  const { rows, reportTotal } = await buildUnmatchedReceiptRows(tenantId, filters);

  let account = await ChartOfAccount.findOne({ tenantId: tid, code: '1310' }).lean();
  if (!account) {
    // Prefer settings-linked stock input account
    try {
      const { getInvSettings } = await import('../inventory/settingsService.js');
      const settings = await getInvSettings(tid);
      if (settings?.propertyStockInputAccountId) {
        account = await ChartOfAccount.findOne({
          _id: settings.propertyStockInputAccountId,
          tenantId: tid,
        }).lean();
      }
    } catch { /* ignore */ }
  }

  let glBalance = 0;
  if (account?._id) {
    const live = await getAccountBalances({
      tenantId: tid,
      accountIds: [account._id],
      activeOnly: false,
      includeReversed: false,
    });
    const row = (live.rows || [])[0];
    const natural = num(row?.naturalBalance);
    const raw = num(row?.rawDebitMinusCredit);
    // Credit-normal GRNI on asset 1310 → naturalBalance is typically negative (debit − credit).
    // Report amounts are positive open GRNI; compare absolute credit magnitude.
    glBalance = round2(natural < 0 ? -natural : (natural !== 0 ? natural : Math.abs(raw)));
  }

  const difference = round2(reportTotal - glBalance);

  return {
    account: account
      ? { _id: account._id, code: account.code, name: account.name, type: account.type, subtype: account.subtype }
      : { code: '1310', name: 'Stock Interim (Received)' },
    rows,
    reportTotal,
    glBalance,
    difference,
    balanced: Math.abs(difference) < 0.015,
    totalLines: rows.length,
  };
}
