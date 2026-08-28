import express from 'express';
import Invoice from '../models/Invoice.js';
import PurchaseOrder from '../models/PurchaseOrder.js';
import DeliveryNote from '../models/DeliveryNote.js';
import SalesTeam from '../models/sales/SalesTeam.js';
import Partner from '../models/Partner.js';
import Product from '../models/Product.js';
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
    }).select('invoiceDate customerId salespersonId lines subtotal grandTotal').lean();

    const buckets = new Map();

    for (const inv of invoices) {
      const bucketDate = groupKey(inv.invoiceDate, granularity);
      for (const line of inv.lines || []) {
        let key = 'unknown';
        if (groupBy === 'product') key = line.productName || String(line.productId || 'manual');
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

    const rows = [...buckets.values()].sort((a, b) => b[measure] - a[measure]);
    res.json({ from, to, groupBy, measure, rows });
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

    const notes = await DeliveryNote.find({ ...req.tenantFilter, purchaseOrderId: po._id, status: 'done' }).select('lines').lean();
    const delivered = new Map();
    for (const dn of notes) {
      for (const line of dn.lines || []) {
        const key = `${line.productId}:${line.variantId || ''}`;
        delivered.set(key, (delivered.get(key) || 0) + Number(line.quantity || 0));
      }
    }

    res.json({ purchaseOrderId: po._id, delivered: Object.fromEntries(delivered) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
