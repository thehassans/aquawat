import express from 'express';
import mongoose from 'mongoose';
import Invoice from '../models/Invoice.js';
import PurchaseOrder from '../models/PurchaseOrder.js';
import SalesTeam from '../models/sales/SalesTeam.js';
import Partner from '../models/Partner.js';
import Product from '../models/Product.js';
import User from '../models/User.js';
import { getDeliveredQuantities } from '../services/sales/invoicingPolicy.js';
import { protect, tenantFilter, checkPermission, requireTenantFilter } from '../middleware/auth.js';
import { shouldScopeInvoicesToSelf, applyCreatedByScope } from '../utils/accessScope.js';

const router = express.Router();

router.use(protect);
router.use(tenantFilter);
router.use(requireTenantFilter);

function parseRange(query) {
  const now = new Date();
  const preset = query.preset || '365d';
  let from = query.from ? new Date(query.from) : null;
  let to = query.to ? new Date(query.to) : now;

  if (Number.isNaN(to?.getTime?.())) to = now;
  if (from && Number.isNaN(from.getTime())) from = null;

  if (!from) {
    if (preset === 'ytd') from = new Date(now.getFullYear(), 0, 1);
    else if (preset === 'mtd') from = new Date(now.getFullYear(), now.getMonth(), 1);
    else if (preset === '7d') from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    else if (preset === '30d') from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    else from = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
  }

  // Inclusive end-of-day for date-only strings
  if (query.to && String(query.to).length <= 10) {
    to = new Date(to);
    to.setHours(23, 59, 59, 999);
  }

  return { from, to };
}

/** Canonical sell-invoice match — same shape as /reports/* and dashboard revenue. */
function sellInvoiceMatch(req, from, to) {
  const match = {
    ...req.tenantFilter,
    flow: 'sell',
    invoiceSubtype: { $ne: 'proforma' },
    status: { $nin: ['draft', 'cancelled', 'credited'] },
    issueDate: { $gte: from, $lte: to },
  };

  if (req.query.transactionType === 'B2B' || req.query.transactionType === 'B2C') {
    match.transactionType = req.query.transactionType;
  }
  if (req.query.businessContext) {
    match.businessContext = String(req.query.businessContext);
  }
  if (req.query.customerId && mongoose.Types.ObjectId.isValid(req.query.customerId)) {
    match.customerId = new mongoose.Types.ObjectId(req.query.customerId);
  }

  if (shouldScopeInvoicesToSelf(req.user)) {
    applyCreatedByScope(match, req.user._id);
  }

  return match;
}

function groupKey(date, granularity) {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return 'unknown';
  if (granularity === 'month') return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  if (granularity === 'week') {
    const onejan = new Date(d.getFullYear(), 0, 1);
    const week = Math.ceil((((d - onejan) / 86400000) + onejan.getDay() + 1) / 7);
    return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
  }
  return d.toISOString().slice(0, 10);
}

function lineAmounts(line) {
  const qty = Number(line?.quantity || 0);
  const untaxed = Number(line?.lineTotal ?? (Number(line?.unitPrice || 0) * qty)) || 0;
  const taxed = Number(line?.lineTotalWithTax ?? untaxed) || 0;
  return { qty, untaxed, taxed };
}

function userDisplayName(u) {
  if (!u) return '';
  const full = `${u.firstName || ''} ${u.lastName || ''}`.trim();
  return full || u.email || '';
}

async function loadSellInvoices(req, from, to) {
  return Invoice.find(sellInvoiceMatch(req, from, to))
    .select(
      'issueDate customerId buyer createdBy createdByName sourcePurchaseOrderId lineItems subtotal taxableAmount totalTax grandTotal paidAmount paymentStatus transactionType businessContext',
    )
    .lean();
}

/** Map invoice → salesperson via SO.salespersonId, else createdBy */
async function resolveSalespersonMap(req, invoices) {
  const poIds = [
    ...new Set(
      invoices
        .map((inv) => inv.sourcePurchaseOrderId)
        .filter(Boolean)
        .map((id) => String(id)),
    ),
  ];

  const poById = new Map();
  if (poIds.length) {
    const pos = await PurchaseOrder.find({
      ...req.tenantFilter,
      _id: { $in: poIds },
      flow: 'sell',
    })
      .select('salespersonId salesTeamId')
      .lean();
    for (const po of pos) poById.set(String(po._id), po);
  }

  const userIds = new Set();
  const attribution = new Map();

  for (const inv of invoices) {
    const invId = String(inv._id);
    const po = inv.sourcePurchaseOrderId ? poById.get(String(inv.sourcePurchaseOrderId)) : null;
    const spId = po?.salespersonId || inv.createdBy || null;
    if (spId) userIds.add(String(spId));
    attribution.set(invId, {
      salespersonId: spId ? String(spId) : 'unassigned',
      labelHint: inv.createdByName || '',
    });
  }

  const users = userIds.size
    ? await User.find({ _id: { $in: [...userIds] } }).select('firstName lastName email').lean()
    : [];
  const userById = new Map(users.map((u) => [String(u._id), u]));

  const labelFor = (salespersonId, hint) => {
    if (!salespersonId || salespersonId === 'unassigned') return 'Unassigned';
    const u = userById.get(salespersonId);
    return userDisplayName(u) || hint || salespersonId;
  };

  return { attribution, labelFor };
}

async function loadProductMeta(req, invoices) {
  const productIds = [
    ...new Set(
      invoices
        .flatMap((inv) => (inv.lineItems || []).map((l) => l.productId).filter(Boolean))
        .map((id) => String(id)),
    ),
  ];
  if (!productIds.length) return new Map();

  const products = await Product.find({
    ...req.tenantFilter,
    _id: { $in: productIds },
  })
    .select('nameEn nameAr sku costPrice sellingPrice categoryId')
    .lean();

  return new Map(products.map((p) => [String(p._id), p]));
}

/** Sales analysis BI engine — all sell invoices in range */
router.get('/analysis', checkPermission('sales', 'read'), async (req, res) => {
  try {
    const { from, to } = parseRange(req.query);
    const groupBy = req.query.groupBy || 'product';
    const granularity = req.query.granularity || 'month';
    const measure = req.query.measure || 'untaxedTotal';

    const invoices = await loadSellInvoices(req, from, to);
    const { attribution, labelFor } = await resolveSalespersonMap(req, invoices);
    const productById = await loadProductMeta(req, invoices);

    const buckets = new Map();

    for (const inv of invoices) {
      const bucketDate = groupKey(inv.issueDate, granularity);
      const sp = attribution.get(String(inv._id)) || { salespersonId: 'unassigned', labelHint: '' };
      const customerLabel =
        inv.buyer?.name ||
        (inv.customerId ? String(inv.customerId) : 'Walk-in');

      const lines = inv.lineItems || [];
      if (!lines.length) {
        if (!['customer', 'salesperson', 'date', 'transactionType', 'businessContext'].includes(groupBy)) continue;
        let key = bucketDate;
        if (groupBy === 'customer') key = customerLabel;
        else if (groupBy === 'salesperson') key = labelFor(sp.salespersonId, sp.labelHint);
        else if (groupBy === 'transactionType') key = inv.transactionType || 'B2B';
        else if (groupBy === 'businessContext') key = inv.businessContext || 'general';
        const composite = groupBy === 'date' ? key : `${key}|${bucketDate}`;
        const prev = buckets.get(composite) || {
          key,
          period: bucketDate,
          untaxedTotal: 0,
          totalSales: 0,
          margin: 0,
          qtyOrdered: 0,
          qtyDelivered: 0,
          qtyInvoiced: 0,
        };
        prev.untaxedTotal += Number(inv.taxableAmount ?? inv.subtotal ?? 0);
        prev.totalSales += Number(inv.grandTotal || 0);
        buckets.set(composite, prev);
        continue;
      }

      for (const line of lines) {
        const { qty, untaxed, taxed } = lineAmounts(line);
        const product = line.productId ? productById.get(String(line.productId)) : null;
        const unitCost = Number(
          line.agencyPrice > 0
            ? line.agencyPrice
            : product?.costPrice || line.unitCost || 0,
        );
        const cost = unitCost * qty;

        let key = bucketDate;
        if (groupBy === 'product') key = line.productName || product?.nameEn || String(line.productId || 'Manual');
        else if (groupBy === 'category') {
          key = String(line.categoryName || product?.categoryId || 'Uncategorized');
        } else if (groupBy === 'variant') {
          key = String(line.variantSku || line.variantId || line.productName || 'No variant');
        } else if (groupBy === 'customer') key = customerLabel;
        else if (groupBy === 'salesperson') key = labelFor(sp.salespersonId, sp.labelHint);
        else if (groupBy === 'transactionType') key = inv.transactionType || 'B2B';
        else if (groupBy === 'businessContext') key = inv.businessContext || 'general';
        else if (groupBy === 'date') key = bucketDate;

        const composite = groupBy === 'date' ? key : `${key}|${bucketDate}`;
        const prev = buckets.get(composite) || {
          key,
          period: bucketDate,
          untaxedTotal: 0,
          totalSales: 0,
          margin: 0,
          qtyOrdered: 0,
          qtyDelivered: 0,
          qtyInvoiced: 0,
        };

        prev.untaxedTotal += untaxed;
        prev.totalSales += taxed;
        prev.margin += untaxed - cost;
        prev.qtyOrdered += qty;
        prev.qtyInvoiced += qty;
        prev.qtyDelivered += qty;
        buckets.set(composite, prev);
      }
    }

    const rows = [...buckets.values()]
      .map((r) => ({
        ...r,
        untaxedTotal: Number(r.untaxedTotal.toFixed(2)),
        totalSales: Number(r.totalSales.toFixed(2)),
        margin: Number(r.margin.toFixed(2)),
      }))
      .sort((a, b) => Number(b[measure] || 0) - Number(a[measure] || 0));

    res.json({
      from,
      to,
      groupBy,
      measure,
      invoiceCount: invoices.length,
      rows,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * Matrix / pivot report — rows × columns of a single measure.
 */
router.get('/matrix', checkPermission('sales', 'read'), async (req, res) => {
  try {
    const { from, to } = parseRange(req.query);
    const rowDim = req.query.row || 'salesperson';
    const colDim = req.query.col || 'month';
    const measure = req.query.measure || 'untaxedTotal';

    const invoices = await loadSellInvoices(req, from, to);
    const { attribution, labelFor } = await resolveSalespersonMap(req, invoices);
    const productById = await loadProductMeta(req, invoices);

    const dimLabel = (dim, inv, line, sp) => {
      const customerLabel = inv.buyer?.name || (inv.customerId ? String(inv.customerId) : 'Walk-in');
      const product = line?.productId ? productById.get(String(line.productId)) : null;
      if (dim === 'salesperson') return labelFor(sp.salespersonId, sp.labelHint);
      if (dim === 'customer') return customerLabel;
      if (dim === 'product') return line?.productName || product?.nameEn || String(line?.productId || 'Manual');
      if (dim === 'category') return String(line?.categoryName || product?.categoryId || 'Uncategorized');
      if (dim === 'variant') return String(line?.variantSku || line?.variantId || line?.productName || 'No variant');
      if (dim === 'transactionType') return inv.transactionType || 'B2B';
      if (dim === 'businessContext') return inv.businessContext || 'general';
      if (dim === 'month') return groupKey(inv.issueDate, 'month');
      if (dim === 'week') return groupKey(inv.issueDate, 'week');
      if (dim === 'day') return groupKey(inv.issueDate, 'day');
      return groupKey(inv.issueDate, 'month');
    };

    const measureValue = (line, inv) => {
      if (!line || !Object.keys(line).length) {
        if (measure === 'qtyInvoiced' || measure === 'qtyOrdered') return 0;
        if (measure === 'totalSales') return Number(inv.grandTotal || 0);
        if (measure === 'margin') return 0;
        return Number(inv.taxableAmount ?? inv.subtotal ?? 0);
      }
      const { qty, untaxed, taxed } = lineAmounts(line);
      const product = line.productId ? productById.get(String(line.productId)) : null;
      const unitCost = Number(
        line.agencyPrice > 0 ? line.agencyPrice : product?.costPrice || line.unitCost || 0,
      );
      if (measure === 'margin') return untaxed - unitCost * qty;
      if (measure === 'qtyOrdered' || measure === 'qtyInvoiced') return qty;
      if (measure === 'totalSales') return taxed;
      return untaxed;
    };

    const cells = new Map();
    const rowSet = new Set();
    const colSet = new Set();

    for (const inv of invoices) {
      const sp = attribution.get(String(inv._id)) || { salespersonId: 'unassigned', labelHint: '' };
      const lines = inv.lineItems || [];
      if (!lines.length) {
        if (
          ['salesperson', 'customer', 'month', 'week', 'day', 'transactionType', 'businessContext'].includes(rowDim)
          || ['salesperson', 'customer', 'month', 'week', 'day', 'transactionType', 'businessContext'].includes(colDim)
        ) {
          const r = dimLabel(rowDim, inv, {}, sp);
          const c = dimLabel(colDim, inv, {}, sp);
          rowSet.add(r);
          colSet.add(c);
          const key = `${r}||${c}`;
          cells.set(key, (cells.get(key) || 0) + measureValue({}, inv));
        }
        continue;
      }
      for (const line of lines) {
        const r = dimLabel(rowDim, inv, line, sp);
        const c = dimLabel(colDim, inv, line, sp);
        rowSet.add(r);
        colSet.add(c);
        const key = `${r}||${c}`;
        cells.set(key, (cells.get(key) || 0) + measureValue(line, inv));
      }
    }

    const rows = [...rowSet].sort();
    const cols = [...colSet].sort();
    const matrix = rows.map((r) => ({
      row: r,
      values: Object.fromEntries(cols.map((c) => [c, Number((cells.get(`${r}||${c}`) || 0).toFixed(2))])),
      total: Number(cols.reduce((s, c) => s + (cells.get(`${r}||${c}`) || 0), 0).toFixed(2)),
    }));

    res.json({
      from,
      to,
      row: rowDim,
      col: colDim,
      measure,
      invoiceCount: invoices.length,
      rows,
      cols,
      matrix,
      colTotals: Object.fromEntries(
        cols.map((c) => [c, Number(rows.reduce((s, r) => s + (cells.get(`${r}||${c}`) || 0), 0).toFixed(2))]),
      ),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/salespeople', checkPermission('sales', 'read'), async (req, res) => {
  try {
    const { from, to } = parseRange(req.query);
    const teams = await SalesTeam.find({ ...req.tenantFilter, isActive: { $ne: false } }).lean();
    const invoices = await loadSellInvoices(req, from, to);
    const { attribution, labelFor } = await resolveSalespersonMap(req, invoices);

    const byUser = new Map();
    for (const inv of invoices) {
      const sp = attribution.get(String(inv._id)) || { salespersonId: 'unassigned', labelHint: '' };
      const uid = sp.salespersonId;
      const prev = byUser.get(uid) || {
        salespersonId: uid,
        name: labelFor(uid, sp.labelHint),
        revenue: 0,
        untaxed: 0,
        invoiceCount: 0,
        paid: 0,
      };
      prev.revenue += Number(inv.grandTotal || 0);
      prev.untaxed += Number(inv.taxableAmount ?? inv.subtotal ?? 0);
      prev.paid += Number(inv.paidAmount || 0);
      prev.invoiceCount += 1;
      if (!prev.name || prev.name === uid) prev.name = labelFor(uid, sp.labelHint);
      byUser.set(uid, prev);
    }

    const performance = [...byUser.values()]
      .map((r) => ({
        ...r,
        revenue: Number(r.revenue.toFixed(2)),
        untaxed: Number(r.untaxed.toFixed(2)),
        paid: Number(r.paid.toFixed(2)),
      }))
      .sort((a, b) => b.revenue - a.revenue);

    res.json({
      from,
      to,
      teams,
      invoiceCount: invoices.length,
      performance,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/customers', checkPermission('sales', 'read'), async (req, res) => {
  try {
    const { from, to } = parseRange(req.query);

    const periodAgg = await Invoice.aggregate([
      { $match: sellInvoiceMatch(req, from, to) },
      {
        $group: {
          _id: '$customerId',
          customerName: { $first: '$buyer.name' },
          invoiceCount: { $sum: 1 },
          totalInvoiced: { $sum: { $ifNull: ['$grandTotal', 0] } },
          totalPaid: { $sum: { $ifNull: ['$paidAmount', 0] } },
          untaxed: { $sum: { $ifNull: ['$taxableAmount', { $ifNull: ['$subtotal', 0] }] } },
        },
      },
      { $sort: { totalInvoiced: -1 } },
      { $limit: 200 },
    ]);

    const customerIds = periodAgg.map((r) => r._id).filter(Boolean);
    const partners = customerIds.length
      ? await Partner.find({ ...req.tenantFilter, _id: { $in: customerIds } })
          .select('name nameEn nameAr currentBalance loyaltyPoints totalRevenue totalInvoices')
          .lean()
      : [];
    const partnerById = new Map(partners.map((p) => [String(p._id), p]));

    const lifetime = await Partner.find({ ...req.tenantFilter, isCustomer: true })
      .select('name nameEn nameAr currentBalance loyaltyPoints totalRevenue totalInvoices')
      .sort('-totalRevenue')
      .limit(50)
      .lean();

    const customers = periodAgg.map((row) => {
      const p = row._id ? partnerById.get(String(row._id)) : null;
      const totalInvoiced = Number(row.totalInvoiced || 0);
      const totalPaid = Number(row.totalPaid || 0);
      return {
        _id: row._id,
        name: row.customerName || p?.name || p?.nameEn || 'Walk-in',
        invoiceCount: row.invoiceCount,
        totalInvoiced: Number(totalInvoiced.toFixed(2)),
        totalPaid: Number(totalPaid.toFixed(2)),
        balanceDue: Number((p?.currentBalance ?? Math.max(0, totalInvoiced - totalPaid)).toFixed(2)),
        untaxed: Number((row.untaxed || 0).toFixed(2)),
        loyaltyPoints: p?.loyaltyPoints ?? 0,
        lifetimeRevenue: Number(p?.totalRevenue || 0),
      };
    });

    res.json({
      from,
      to,
      customers,
      lifetime: lifetime.map((p) => ({
        _id: p._id,
        name: p.name || p.nameEn || 'Customer',
        totalInvoiced: Number(p.totalRevenue || 0),
        totalPaid: Number(Math.max(0, (p.totalRevenue || 0) - (p.currentBalance || 0)).toFixed(2)),
        balanceDue: Number(p.currentBalance || 0),
        loyaltyPoints: p.loyaltyPoints ?? 0,
        invoiceCount: p.totalInvoices ?? 0,
      })),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/products', checkPermission('sales', 'read'), async (req, res) => {
  try {
    const { from, to } = parseRange(req.query);
    const invoices = await loadSellInvoices(req, from, to);
    const productById = await loadProductMeta(req, invoices);

    const velocity = new Map();
    for (const inv of invoices) {
      for (const line of inv.lineItems || []) {
        const pid = String(line.productId || line.productName || 'manual');
        const meta = line.productId ? productById.get(String(line.productId)) : null;
        const { qty, untaxed, taxed } = lineAmounts(line);
        const prev = velocity.get(pid) || {
          productId: line.productId || null,
          name: line.productName || meta?.nameEn || 'Manual line',
          sku: meta?.sku || '',
          qty: 0,
          revenue: 0,
          untaxed: 0,
        };
        prev.qty += qty;
        prev.revenue += taxed;
        prev.untaxed += untaxed;
        if (!prev.name && meta?.nameEn) prev.name = meta.nameEn;
        velocity.set(pid, prev);
      }
    }

    const velocityRows = [...velocity.values()]
      .map((r) => ({
        ...r,
        qty: Number(r.qty.toFixed(4)),
        revenue: Number(r.revenue.toFixed(2)),
        untaxed: Number(r.untaxed.toFixed(2)),
      }))
      .sort((a, b) => b.qty - a.qty);

    res.json({
      from,
      to,
      invoiceCount: invoices.length,
      velocity: velocityRows,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** Summary KPIs for reporting hub */
router.get('/summary', checkPermission('sales', 'read'), async (req, res) => {
  try {
    const { from, to } = parseRange(req.query);
    const [agg] = await Invoice.aggregate([
      { $match: sellInvoiceMatch(req, from, to) },
      {
        $group: {
          _id: null,
          invoiceCount: { $sum: 1 },
          revenue: { $sum: { $ifNull: ['$grandTotal', 0] } },
          untaxed: { $sum: { $ifNull: ['$taxableAmount', { $ifNull: ['$subtotal', 0] }] } },
          tax: { $sum: { $ifNull: ['$totalTax', 0] } },
          paid: { $sum: { $ifNull: ['$paidAmount', 0] } },
        },
      },
    ]);

    const byType = await Invoice.aggregate([
      { $match: sellInvoiceMatch(req, from, to) },
      {
        $group: {
          _id: '$transactionType',
          invoiceCount: { $sum: 1 },
          revenue: { $sum: { $ifNull: ['$grandTotal', 0] } },
        },
      },
    ]);

    res.json({
      from,
      to,
      invoiceCount: agg?.invoiceCount || 0,
      revenue: Number((agg?.revenue || 0).toFixed(2)),
      untaxed: Number((agg?.untaxed || 0).toFixed(2)),
      tax: Number((agg?.tax || 0).toFixed(2)),
      paid: Number((agg?.paid || 0).toFixed(2)),
      outstanding: Number(Math.max(0, (agg?.revenue || 0) - (agg?.paid || 0)).toFixed(2)),
      byTransactionType: byType.map((r) => ({
        type: r._id || 'B2B',
        invoiceCount: r.invoiceCount,
        revenue: Number((r.revenue || 0).toFixed(2)),
      })),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** Chart series for reporting overview */
router.get('/charts', checkPermission('sales', 'read'), async (req, res) => {
  try {
    const { from, to } = parseRange(req.query);
    const match = sellInvoiceMatch(req, from, to);

    const invoices = await Invoice.find(match)
      .select('issueDate grandTotal lineItems salesTeamId salespersonId')
      .lean();

    const byDayMap = new Map();
    const productMap = new Map();
    const teamMap = new Map();

    for (const inv of invoices) {
      const day = groupKey(inv.issueDate, 'day');
      const rev = Number(inv.grandTotal || 0);
      byDayMap.set(day, (byDayMap.get(day) || 0) + rev);

      const teamKey = String(inv.salesTeamId || 'none');
      teamMap.set(teamKey, (teamMap.get(teamKey) || 0) + rev);

      for (const line of inv.lineItems || []) {
        const name = line.productName || line.manualName || 'Item';
        const lineRev = Number(line.lineTotalWithTax ?? line.lineTotal ?? 0);
        productMap.set(name, (productMap.get(name) || 0) + lineRev);
      }
    }

    const teamIds = [...teamMap.keys()].filter((id) => id !== 'none' && mongoose.Types.ObjectId.isValid(id));
    const teams = teamIds.length
      ? await SalesTeam.find({ _id: { $in: teamIds }, ...req.tenantFilter }).select('name').lean()
      : [];
    const teamName = Object.fromEntries(teams.map((t) => [String(t._id), t.name]));

    const revenueByDay = [...byDayMap.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([label, revenue]) => ({ label, revenue: Number(revenue.toFixed(2)) }));

    const byTeam = [...teamMap.entries()]
      .map(([id, revenue]) => ({
        name: id === 'none' ? 'Unassigned' : (teamName[id] || 'Team'),
        revenue: Number(revenue.toFixed(2)),
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8);

    const topProducts = [...productMap.entries()]
      .map(([name, revenue]) => ({ name: String(name).slice(0, 28), revenue: Number(revenue.toFixed(2)) }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8);

    res.json({ from, to, revenueByDay, byTeam, topProducts });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** Delivered quantities for invoicing policy */
router.get('/delivered-qty/:purchaseOrderId', checkPermission('sales', 'read'), async (req, res) => {
  try {
    const po = await PurchaseOrder.findOne({ _id: req.params.purchaseOrderId, ...req.tenantFilter, flow: 'sell' }).lean();
    if (!po) return res.status(404).json({ error: 'Sales order not found' });

    const delivered = await getDeliveredQuantities(req.tenantId || po.tenantId, po._id);

    res.json({ purchaseOrderId: po._id, delivered: Object.fromEntries(delivered) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
