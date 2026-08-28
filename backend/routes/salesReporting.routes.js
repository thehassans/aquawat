import express from 'express';
import Invoice from '../models/Invoice.js';
import PurchaseOrder from '../models/PurchaseOrder.js';
import SalesTeam from '../models/sales/SalesTeam.js';
import Partner from '../models/Partner.js';
import Product from '../models/Product.js';
import { getDeliveredQuantities } from '../services/sales/invoicingPolicy.js';
import { protect, tenantFilter, checkPermission, requireTenantFilter } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);
router.use(tenantFilter);
router.use(requireTenantFilter);

function parseRange(query) {
  const now = new Date();
  const preset = query.preset || '365d';
  let from = query.from ? new Date(query.from) : null;
  const to = query.to ? new Date(query.to) : now;

  if (!from) {
    if (preset === 'ytd') from = new Date(now.getFullYear(), 0, 1);
    else if (preset === 'mtd') from = new Date(now.getFullYear(), now.getMonth(), 1);
    else if (preset === '7d') from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    else if (preset === '30d') from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    else from = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
  }

  return { from, to };
}

function groupKey(date, granularity) {
  const d = new Date(date);
  if (granularity === 'month') return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  if (granularity === 'week') {
    const onejan = new Date(d.getFullYear(), 0, 1);
    const week = Math.ceil((((d - onejan) / 86400000) + onejan.getDay() + 1) / 7);
    return `${d.getFullYear()}-W${week}`;
  }
  return d.toISOString().slice(0, 10);
}

/** Sales analysis BI engine */
router.get('/analysis', checkPermission('sales', 'read'), async (req, res) => {
  try {
    const { from, to } = parseRange(req.query);
    const groupBy = req.query.groupBy || 'product';
    const granularity = req.query.granularity || 'month';
    const measure = req.query.measure || 'untaxedTotal';

    const invoices = await Invoice.find({
      ...req.tenantFilter,
      invoiceType: 'sell',
      status: { $in: ['approved', 'signed', 'paid', 'partially_paid'] },
      invoiceDate: { $gte: from, $lte: to },
    }).select('invoiceDate customerId salespersonId lineItems subtotal grandTotal').lean();

    const buckets = new Map();

    for (const inv of invoices) {
      const bucketDate = groupKey(inv.invoiceDate, granularity);
      for (const line of inv.lineItems || inv.lines || []) {
        let key = 'unknown';
        if (groupBy === 'product') key = line.productName || String(line.productId || 'manual');
        else if (groupBy === 'category') key = String(line.categoryName || line.categoryId || 'uncategorized');
        else if (groupBy === 'variant') key = String(line.variantSku || line.variantId || line.productName || 'no-variant');
        else if (groupBy === 'customer') key = String(inv.customerId || 'walk-in');
        else if (groupBy === 'salesperson') key = String(inv.salespersonId || 'unassigned');
        else if (groupBy === 'date') key = bucketDate;
        else key = bucketDate;

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

        const qty = Number(line.quantity || 0);
        const lineTotal = Number(line.lineTotal || line.unitPrice * qty || 0);
        const cost = Number(line.unitCost || 0) * qty;
        prev.untaxedTotal += lineTotal;
        prev.totalSales += Number(line.lineTotalWithTax || lineTotal);
        prev.margin += lineTotal - cost;
        prev.qtyOrdered += qty;
        prev.qtyInvoiced += qty;
        buckets.set(composite, prev);
      }
    }

    res.json({
      from,
      to,
      groupBy,
      measure,
      rows: [...buckets.values()].sort((a, b) => b[measure] - a[measure]),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * Matrix / pivot report — rows × columns of a single measure.
 * Query: row=salesperson|customer|product|category  col=month|week|day|…  measure=…
 */
router.get('/matrix', checkPermission('sales', 'read'), async (req, res) => {
  try {
    const { from, to } = parseRange(req.query);
    const rowDim = req.query.row || 'salesperson';
    const colDim = req.query.col || 'month';
    const measure = req.query.measure || 'untaxedTotal';

    const invoices = await Invoice.find({
      ...req.tenantFilter,
      invoiceType: 'sell',
      status: { $in: ['approved', 'signed', 'paid', 'partially_paid'] },
      invoiceDate: { $gte: from, $lte: to },
    }).select('invoiceDate customerId salespersonId lineItems lines subtotal grandTotal').lean();

    const dimLabel = (dim, inv, line) => {
      if (dim === 'salesperson') return String(inv.salespersonId || 'unassigned');
      if (dim === 'customer') return String(inv.customerId || 'walk-in');
      if (dim === 'product') return line.productName || String(line.productId || 'manual');
      if (dim === 'category') return String(line.categoryName || line.categoryId || 'uncategorized');
      if (dim === 'variant') return String(line.variantSku || line.variantId || line.productName || 'no-variant');
      if (dim === 'month') return groupKey(inv.invoiceDate, 'month');
      if (dim === 'week') return groupKey(inv.invoiceDate, 'week');
      if (dim === 'day') return groupKey(inv.invoiceDate, 'day');
      return groupKey(inv.invoiceDate, 'month');
    };

    const measureValue = (line) => {
      const qty = Number(line.quantity || 0);
      const lineTotal = Number(line.lineTotal || (line.unitPrice || 0) * qty || 0);
      const cost = Number(line.unitCost || line.costPrice || 0) * qty;
      if (measure === 'margin') return lineTotal - cost;
      if (measure === 'qtyOrdered' || measure === 'qtyInvoiced') return qty;
      if (measure === 'totalSales') return Number(line.lineTotalWithTax || lineTotal);
      return lineTotal;
    };

    const cells = new Map();
    const rowSet = new Set();
    const colSet = new Set();

    for (const inv of invoices) {
      const lines = inv.lineItems || inv.lines || [];
      if (!lines.length && (['salesperson', 'customer', 'month', 'week', 'day'].includes(rowDim)
        || ['salesperson', 'customer', 'month', 'week', 'day'].includes(colDim))) {
        const r = dimLabel(rowDim, inv, {});
        const c = dimLabel(colDim, inv, {});
        rowSet.add(r);
        colSet.add(c);
        const key = `${r}||${c}`;
        const headerVal = measure === 'qtyInvoiced' || measure === 'qtyOrdered' ? 0 : Number(inv.subtotal || inv.grandTotal || 0);
        cells.set(key, (cells.get(key) || 0) + headerVal);
        continue;
      }
      for (const line of lines) {
        const r = dimLabel(rowDim, inv, line);
        const c = dimLabel(colDim, inv, line);
        rowSet.add(r);
        colSet.add(c);
        const key = `${r}||${c}`;
        cells.set(key, (cells.get(key) || 0) + measureValue(line));
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
    const teams = await SalesTeam.find({ ...req.tenantFilter, isActive: true }).lean();
    const invoices = await Invoice.find({
      ...req.tenantFilter,
      invoiceType: 'sell',
      invoiceDate: { $gte: from, $lte: to },
    }).select('salespersonId subtotal grandTotal').lean();

    const byUser = new Map();
    for (const inv of invoices) {
      const uid = String(inv.salespersonId || 'unassigned');
      const prev = byUser.get(uid) || { salespersonId: uid, revenue: 0, invoiceCount: 0 };
      prev.revenue += Number(inv.subtotal || inv.grandTotal || 0);
      prev.invoiceCount += 1;
      byUser.set(uid, prev);
    }

    res.json({
      teams,
      performance: [...byUser.values()],
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/customers', checkPermission('sales', 'read'), async (req, res) => {
  try {
    const partners = await Partner.find({ ...req.tenantFilter, isCustomer: true })
      .select('name totalInvoiced totalPaid balanceDue loyaltyPoints')
      .sort('-totalInvoiced')
      .limit(200)
      .lean();
    res.json({ customers: partners });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/products', checkPermission('sales', 'read'), async (req, res) => {
  try {
    const { from, to } = parseRange(req.query);
    const products = await Product.find({ ...req.tenantFilter, isActive: true })
      .select('name sku categoryId salePrice costPrice')
      .limit(500)
      .lean();

    const invoices = await Invoice.find({
      ...req.tenantFilter,
      invoiceType: 'sell',
      invoiceDate: { $gte: from, $lte: to },
    }).select('lines').lean();

    const velocity = new Map();
    for (const inv of invoices) {
      for (const line of inv.lines || []) {
        const pid = String(line.productId || line.productName);
        const prev = velocity.get(pid) || { productId: line.productId, name: line.productName, qty: 0, revenue: 0 };
        prev.qty += Number(line.quantity || 0);
        prev.revenue += Number(line.lineTotal || 0);
        velocity.set(pid, prev);
      }
    }

    res.json({
      products,
      velocity: [...velocity.values()].sort((a, b) => b.qty - a.qty),
    });
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
