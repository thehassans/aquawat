import express from 'express';
import mongoose from 'mongoose';
import multer from 'multer';
import PurchaseOrder from '../models/PurchaseOrder.js';
import Supplier from '../models/Supplier.js';
import Product from '../models/Product.js';
import Warehouse from '../models/Warehouse.js';
import GRN from '../models/GRN.js';
import PurchaseReturn from '../models/PurchaseReturn.js';
import LandedCost from '../models/LandedCost.js';
import Invoice from '../models/Invoice.js';
import Tenant from '../models/Tenant.js';
import Customer from '../models/Customer.js';
import { protect, tenantFilter, checkPermission, checkAnyPermission, requireTenantFilter, tenantHasEmailAddon } from '../middleware/auth.js';
import { checkTrialLimits } from '../middleware/trialLimits.js';
import { saveUploadBuffer, readUploadBuffer } from '../utils/objectStorage.js';
import { normalizeProductType } from '../utils/productType.js';
import { confirmGrnReceive, generateGrnNumber, PurchasesValidationError, upsertDraftLandedCostForPo } from '../services/purchasesWorkflow.js';
import { computePurchaseLineTotals, buildPoReceivingLedger, round2, matchPurchaseLine } from '../services/purchasesLogic.js';
import { nextDailyDocNumber } from '../services/inventory/sequence.js';
import { assertSellOrderCanConfirm, shouldLockSellOrder, getSalesSettings } from '../services/sales/salesLifecycle.js';
import { enrichInvoiceArabicFields } from '../utils/invoiceArabic.js';
import { sendTenantEmail } from '../utils/tenantEmailService.js';
import { buildPremiumEmailShell, getTenantLoginUrl, getTenantWorkspaceHost, getTenantWorkspaceUrl } from '../utils/premiumEmailShell.js';
import { sendRestaurantWhatsApp } from '../services/restaurantWhatsAppService.js';
import { applyOwnerScopeToQuery } from '../utils/accessScope.js';

const router = express.Router();

router.use(protect);
router.use(tenantFilter);
router.use(requireTenantFilter);

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeText(value) {
  return String(value || '').trim();
}

function resolveSalesOrderRecipient(customer, order, fallbackRecipient = '') {
  const directRecipient = String(fallbackRecipient || '').trim().toLowerCase();
  if (directRecipient) return directRecipient;
  const customerEmail = String(customer?.email || '').trim().toLowerCase();
  if (customerEmail) return customerEmail;
  const contactEmail = String(customer?.contactPerson?.email || '').trim().toLowerCase();
  if (contactEmail) return contactEmail;
  return String(order?.buyer?.contactEmail || '').trim().toLowerCase();
}

function buildSalesOrderEmailHtml({ order, customerName = '', tenant }) {
  const safeName = normalizeText(customerName) || 'Customer';
  const orderNumber = normalizeText(order?.poNumber) || 'Sales Order';
  const total = `${toNumber(order?.grandTotal, 0).toFixed(2)} ${normalizeText(order?.currency) || 'SAR'}`;
  const companyName = normalizeText(tenant?.business?.legalNameEn || tenant?.name) || 'Maqder';
  const loginUrl = getTenantLoginUrl(tenant);

  return buildPremiumEmailShell({
    brandName: companyName,
    title: `Sales Order Bill ${orderNumber}`,
    body: `Dear ${safeName},\n\nPlease find your sales order bill attached.`,
    secondaryLines: [
      { label: 'Customer', value: safeName },
      { label: 'Sales order', value: orderNumber },
      { label: 'Total', value: total },
      { label: 'Workspace', value: getTenantWorkspaceHost(tenant), href: loginUrl },
    ].filter(Boolean),
    workspaceUrl: getTenantWorkspaceUrl(tenant),
    workspaceHost: getTenantWorkspaceHost(tenant),
    cta: { href: loginUrl, label: 'Open workspace' },
    dir: 'ltr',
  });
}

/**
 * Cast req.tenantFilter for use inside raw MongoDB aggregation pipelines.
 * Mongoose .find() auto-casts string tenantId → ObjectId, but $match in
 * aggregate() does NOT, so we must cast explicitly.
 */
function castTenantFilter(filter) {
  if (!filter || !filter.tenantId) return filter || {};
  return {
    ...filter,
    tenantId: typeof filter.tenantId === 'string'
      ? new mongoose.Types.ObjectId(filter.tenantId)
      : filter.tenantId,
  };
}

function safeRound2(value) {
  return typeof round2 === 'function' ? round2(value) : Math.round((toNumber(value) + Number.EPSILON) * 100) / 100;
}

const vendorBillUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp']
      .includes(String(file?.mimetype || '').toLowerCase());
    cb(ok ? null : new Error('Only PDF, JPG, PNG, or WebP files are allowed'), ok);
  },
});

function normalizeLineItems(lineItems = [], { requirePositiveCost = false } = {}) {
  const items = Array.isArray(lineItems) ? lineItems : [];
  const totals = computePurchaseLineTotals(items);
  const normalized = items.map((li, index) => {
    const computed = totals.lines[index] || { lineSubtotal: 0, lineTax: 0, lineTotal: 0 };
    const productType = normalizeProductType(li.productType);
    const unitCost = toNumber(li.unitCost ?? 0, 0);
    if (
      requirePositiveCost
      && productType !== 'service'
      && toNumber(li.quantityOrdered ?? li.quantity ?? 0, 0) > 0
      && unitCost <= 0
    ) {
      throw new PurchasesValidationError(
        'Unit cost must be greater than zero for stocked lines',
        'UNIT_COST_REQUIRED',
      );
    }
    return {
      productId: li.productId || undefined,
      variantId: li.variantId || undefined,
      manualName: li.manualName || '',
      uom: li.uom || '',
      description: li.description,
      productType,
      quantityOrdered: toNumber(li.quantityOrdered ?? li.quantity ?? 0, 0),
      quantityReceived: toNumber(li.quantityReceived ?? 0, 0),
      quantityReturned: toNumber(li.quantityReturned, 0),
      unitCost,
      taxRate: toNumber(li.taxRate ?? 15, 15),
      lineSubtotal: computed.lineSubtotal,
      lineTax: computed.lineTax,
      lineTotal: computed.lineTotal
    };
  });
  return { normalized, subtotal: totals.subtotal, totalTax: totals.totalTax, grandTotal: totals.grandTotal };
}

async function generatePoNumber(tenantId) {
  return nextDailyDocNumber(tenantId, 'PO', { padding: 3 });
}

const sellOrSupply = (action) => checkAnyPermission([
  ['supply_chain', action],
  ['sales', action],
  // Invoicing tenants often lack a dedicated "approve" action — allow update/create as confirm.
  ...(action === 'approve'
    ? [['supply_chain', 'update'], ['sales', 'update'], ['sales', 'create']]
    : []),
]);

function gateSellOrSupply(action) {
  return (req, res, next) => {
    if (req.query.flow === 'sell' || req.body?.flow === 'sell') {
      return sellOrSupply(action)(req, res, next);
    }
    return checkPermission('supply_chain', action)(req, res, next);
  };
}

router.get('/', gateSellOrSupply('read'), async (req, res) => {
  try {
    const { page = 1, limit = 25, status, supplierId, warehouseId, search, startDate, endDate, receivable, flow } = req.query;
    
    const query = { ...req.tenantFilter };
    applyOwnerScopeToQuery(query, req.user);

    if (flow === 'sell' || flow === 'purchase') query.flow = flow;

    if (String(receivable) === '1') {
      query.status = { $nin: ['cancelled', 'billed', 'closed'] };
    } else if (status) query.status = status;
    if (supplierId) query.supplierId = supplierId;
    if (warehouseId) query.warehouseId = warehouseId;

    if (startDate || endDate) {
      query.orderDate = {};
      if (startDate) query.orderDate.$gte = new Date(startDate);
      if (endDate) query.orderDate.$lte = new Date(endDate);
    }

    if (search) {
      const matchingSuppliers = await Supplier.find({
        ...req.tenantFilter,
        isVendor: true,
        $or: [
          { nameEn: { $regex: search, $options: 'i' } },
          { name: { $regex: search, $options: 'i' } },
          { nameAr: { $regex: search, $options: 'i' } },
          { supplierCode: { $regex: search, $options: 'i' } },
        ],
      }).select('_id');
      query.$or = [
        { poNumber: { $regex: search, $options: 'i' } },
        { supplierId: { $in: matchingSuppliers.map((s) => s._id) } },
      ];
    }

    const purchaseOrders = await PurchaseOrder.find(query)
      .populate('supplierId', 'supplierCode name nameEn nameAr')
      .populate('warehouseId', 'code nameEn nameAr')
      .sort({ orderDate: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const normalizedOrders = purchaseOrders.map((doc) => {
      const po = doc.toObject();
      if (po.notes && po.notes.includes('[Refund:')) {
        const totalRec = (po.lineItems || []).reduce((s, li) => s + toNumber(li.quantityReceived, 0), 0);
        const totalRet = (po.lineItems || []).reduce((s, li) => s + toNumber(li.quantityReturned, 0), 0);
        const totalOrd = (po.lineItems || []).reduce((s, li) => s + toNumber(li.quantityOrdered, 0), 0);
        if (totalRec === 0 && (totalRet >= totalOrd || po.status === 'received') && totalOrd > 0) {
          po.status = 'refunded';
        }
      }
      return po;
    });

    const total = await PurchaseOrder.countDocuments(query);

    res.json({
      purchaseOrders: normalizedOrders,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/stats', checkPermission('supply_chain', 'read'), async (req, res) => {
  try {
    const match = { ...castTenantFilter(req.tenantFilter) };
    applyOwnerScopeToQuery(match, req.user);
    const flow = String(req.query.flow || 'purchase').toLowerCase();
    if (flow === 'sell' || flow === 'purchase') match.flow = flow;
    const stats = await PurchaseOrder.aggregate([
      { $match: match },
      {
        $facet: {
          totals: [
            {
              $group: {
                _id: null,
                count: { $sum: 1 },
                totalValue: { $sum: '$grandTotal' },
                openCount: {
                  $sum: {
                    $cond: [
                      { $in: ['$status', ['draft', 'sent', 'approved', 'partially_received']] },
                      1,
                      0
                    ]
                  }
                }
              }
            }
          ],
          byStatus: [{ $group: { _id: '$status', count: { $sum: 1 }, value: { $sum: '$grandTotal' } } }],
          recent: [
            { $sort: { orderDate: -1, createdAt: -1 } },
            { $limit: 5 },
            { $project: { poNumber: 1, orderDate: 1, status: 1, grandTotal: 1, supplierId: 1 } }
          ]
        }
      }
    ]);

    res.json(stats[0] || {});
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/reports', checkPermission('supply_chain', 'read'), async (req, res) => {
  try {
    const { startDate, endDate, supplierId, warehouseId } = req.query;
    const matchQuery = { ...castTenantFilter(req.tenantFilter) };
    applyOwnerScopeToQuery(matchQuery, req.user);

    if (supplierId) matchQuery.supplierId = new mongoose.Types.ObjectId(supplierId);
    if (warehouseId) matchQuery.warehouseId = new mongoose.Types.ObjectId(warehouseId);

    if (startDate || endDate) {
      matchQuery.orderDate = {};
      if (startDate) matchQuery.orderDate.$gte = new Date(startDate);
      if (endDate) matchQuery.orderDate.$lte = new Date(endDate);
    }

    const [pos, summaryAgg, monthlyAgg, statusAgg] = await Promise.all([
      PurchaseOrder.find(matchQuery)
        .populate('supplierId', 'supplierCode name nameEn nameAr phone email')
        .populate('warehouseId', 'code nameEn nameAr')
        .sort({ orderDate: -1 })
        .lean(),
      PurchaseOrder.aggregate([
        { $match: matchQuery },
        {
          $group: {
            _id: null,
            totalOrders: { $sum: 1 },
            totalSpend: { $sum: '$grandTotal' },
            totalSubtotal: { $sum: '$subtotal' },
            totalTax: { $sum: '$totalTax' },
            totalPaid: { $sum: { $ifNull: ['$paidAmount', 0] } },
            totalBalance: { $sum: { $ifNull: ['$balanceDue', '$grandTotal'] } },
            openOrders: {
              $sum: {
                $cond: [{ $in: ['$status', ['draft', 'sent', 'approved', 'partially_received']] }, 1, 0]
              }
            },
            receivedOrders: {
              $sum: { $cond: [{ $eq: ['$status', 'received'] }, 1, 0] }
            },
            cancelledOrders: {
              $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] }
            }
          }
        }
      ]),
      PurchaseOrder.aggregate([
        { $match: { ...matchQuery, status: { $ne: 'cancelled' } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m', date: '$orderDate' } },
            spend: { $sum: '$grandTotal' },
            paid: { $sum: { $ifNull: ['$paidAmount', 0] } },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]),
      PurchaseOrder.aggregate([
        { $match: matchQuery },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            total: { $sum: '$grandTotal' }
          }
        }
      ])
    ]);

    // Compute Product & Supplier breakdowns
    const supplierMap = {};
    const productMap = {};
    let totalOrderedQty = 0;
    let totalReceivedQty = 0;

    for (const po of pos) {
      if (po.status === 'cancelled') continue;
      const sId = String(po.supplierId?._id || po.supplierId || 'unknown');
      const sName = po.supplierId?.nameEn || po.supplierId?.nameAr || po.supplierId?.code || 'Unknown';
      if (!supplierMap[sId]) {
        supplierMap[sId] = {
          supplierId: sId,
          nameEn: po.supplierId?.nameEn || sName,
          nameAr: po.supplierId?.nameAr || sName,
          code: po.supplierId?.code || '',
          totalSpend: 0,
          totalPaid: 0,
          balanceDue: 0,
          poCount: 0,
        };
      }
      supplierMap[sId].totalSpend += (po.grandTotal || 0);
      supplierMap[sId].totalPaid += (po.paidAmount || 0);
      supplierMap[sId].balanceDue += (po.balanceDue != null ? po.balanceDue : (po.grandTotal || 0));
      supplierMap[sId].poCount += 1;

      for (const li of po.lineItems || []) {
        const pId = String(li.productId?._id || li.productId || li.manualName || 'other');
        const pName = li.manualName || li.description || 'Item';
        const ord = Number(li.quantityOrdered || 0);
        const rec = Number(li.quantityReceived || 0);
        const cost = Number(li.lineTotal || (ord * Number(li.unitCost || 0)));

        totalOrderedQty += ord;
        totalReceivedQty += rec;

        if (!productMap[pId]) {
          productMap[pId] = {
            productId: pId,
            name: pName,
            uom: li.uom || 'PCE',
            orderedQty: 0,
            receivedQty: 0,
            backorderQty: 0,
            totalCost: 0,
            orderCount: 0,
          };
        }
        productMap[pId].orderedQty += ord;
        productMap[pId].receivedQty += rec;
        productMap[pId].backorderQty += Math.max(0, ord - rec);
        productMap[pId].totalCost += cost;
        productMap[pId].orderCount += 1;
      }
    }

    const summary = summaryAgg[0] || {
      totalOrders: pos.length,
      totalSpend: 0,
      totalPaid: 0,
      totalBalance: 0,
      openOrders: 0,
      receivedOrders: 0,
      cancelledOrders: 0,
    };
    summary.totalOrderedQty = totalOrderedQty;
    summary.totalReceivedQty = totalReceivedQty;
    summary.totalBackorderQty = Math.max(0, totalOrderedQty - totalReceivedQty);
    summary.fulfillmentRate = totalOrderedQty > 0 ? Math.round((totalReceivedQty / totalOrderedQty) * 100) : 0;
    summary.averageOrderValue = summary.totalOrders > 0 ? Math.round((summary.totalSpend / summary.totalOrders) * 100) / 100 : 0;

    const suppliersList = Object.values(supplierMap).sort((a, b) => b.totalSpend - a.totalSpend);
    const topProducts = Object.values(productMap).sort((a, b) => b.totalCost - a.totalCost);

    res.json({
      summary,
      monthlyTrends: monthlyAgg.map(m => ({ month: m._id, spend: m.spend, paid: m.paid, count: m.count })),
      byStatus: statusAgg.map(s => ({ status: s._id, count: s.count, total: s.total })),
      bySupplier: suppliersList,
      topProducts,
      orders: pos.slice(0, 100),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/** Unmatched receipts — GRNs not yet fully billed (explains 1310 GRNI) */
router.get('/reports/unmatched-receipts', checkPermission('supply_chain', 'read'), async (req, res) => {
  try {
    const { unmatchedReceiptsReport } = await import('../services/purchases/grniReports.js');
    const data = await unmatchedReceiptsReport(req.user.tenantId, {
      supplierId: req.query.supplierId || undefined,
      warehouseId: req.query.warehouseId || undefined,
    });
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/** 1310 Stock Interim (Received) reconciliation vs open GRN lines */
router.get('/reports/stock-interim-received', checkPermission('supply_chain', 'read'), async (req, res) => {
  try {
    const { stockInterimReceivedReconciliation } = await import('../services/purchases/grniReports.js');
    const data = await stockInterimReceivedReconciliation(req.user.tenantId, {
      supplierId: req.query.supplierId || undefined,
      warehouseId: req.query.warehouseId || undefined,
    });
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', sellOrSupply('read'), async (req, res) => {
  try {
    const order = await PurchaseOrder.findOne((() => { const q = { _id: req.params.id, ...req.tenantFilter }; applyOwnerScopeToQuery(q, req.user); return q; })())
      .populate('supplierId', 'supplierCode name nameEn nameAr phone email vatNumber crNumber address contactPerson')
      .populate('customerId', 'name nameEn nameAr entityType vatNumber crNumber phone mobile email address contactPerson')
      .populate('sourceQuotationId', 'quotationNumber status')
      .populate('salesTeamId', 'name nameAr code teamType')
      .populate('warehouseId', 'code nameEn nameAr')
      .populate('lineItems.productId', 'sku nameEn nameAr barcode unitOfMeasure productType')
      .populate('lineItems.variantId', 'name nameAr sku')
      .populate('receiving.warehouseId', 'code nameEn nameAr')
      .populate('payments.recordedBy', 'name firstName lastName');

    if (!order) {
      return res.status(404).json({ error: 'Purchase order not found' });
    }

    // Heal stuck quote→SO rows: approvedAt set but status left as draft/sent
    if (
      order.flow === 'sell' &&
      order.approvedAt &&
      ['draft', 'sent'].includes(String(order.status || ''))
    ) {
      order.status = 'approved';
      await order.save();
    }

    const [grns, returns, landedCosts, invoices] = await Promise.all([
      GRN.find({ ...req.tenantFilter, purchaseOrderId: order._id })
        .populate('warehouseId', 'code nameEn nameAr')
        .populate('receivedBy', 'firstName lastName name')
        .select('grnNumber status dateReceived createdAt warehouseId receivedBy notes lines')
        .sort('-createdAt')
        .lean(),
      PurchaseReturn.find({ ...req.tenantFilter, purchaseOrderId: order._id }).select('returnNumber status dateReturned').sort('-createdAt'),
      LandedCost.find({ ...req.tenantFilter, purchaseOrder: order._id, isActive: true }).select('lcNumber status totalCost costLines').sort('-createdAt'),
      Invoice.find({ ...req.tenantFilter, sourcePurchaseOrderId: order._id, flow: 'purchase' }).select('invoiceNumber status grandTotal issueDate').sort('-createdAt'),
    ]);

    const payload = order.toObject({ depopulate: false, virtuals: false });
    const totalRec = (payload.lineItems || []).reduce((s, li) => s + toNumber(li.quantityReceived, 0), 0);
    const totalRet = (payload.lineItems || []).reduce((s, li) => s + toNumber(li.quantityReturned, 0), 0);
    const totalOrd = (payload.lineItems || []).reduce((s, li) => s + toNumber(li.quantityOrdered, 0), 0);
    if (totalRec === 0 && totalRet >= totalOrd && totalOrd > 0) {
      payload.status = 'refunded';
    }
    payload.related = { grns, returns, landedCosts, invoices };
    payload.receivingLedger = buildPoReceivingLedger({ lineItems: payload.lineItems, grns });
    res.json(payload);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', checkTrialLimits('purchaseOrders'), gateSellOrSupply('create'), async (req, res) => {
  try {
    if (!req.user.tenantId) {
      return res.status(400).json({ error: 'No tenant associated with user' });
    }

    const flow = req.body.flow === 'sell' ? 'sell' : 'purchase';

    if (flow === 'purchase') {
      const supplier = await Supplier.findOne({ _id: req.body.supplierId, ...req.tenantFilter, isActive: true });
      if (!supplier) {
        return res.status(400).json({ error: 'Invalid supplier' });
      }
    } else {
      const Partner = (await import('../models/Partner.js')).default;
      const customer = await Partner.findOne({
        _id: req.body.customerId,
        ...req.tenantFilter,
        isCustomer: true,
        isActive: { $ne: false },
      });
      if (!customer) {
        return res.status(400).json({ error: 'Invalid customer' });
      }
      if (Array.isArray(req.body.lineItems) && req.body.lineItems.length) {
        const { assertSellLineVariantBinding } = await import('../services/sales/variantBinding.js');
        const binding = await assertSellLineVariantBinding(req.body.lineItems, req.user.tenantId);
        if (!binding.ok) {
          return res.status(400).json({ error: binding.errors.join('; '), code: 'VARIANT_REQUIRED' });
        }
      }
    }

    if (req.body.warehouseId) {
      const warehouse = await Warehouse.findOne({ _id: req.body.warehouseId, ...req.tenantFilter, isActive: true });
      if (!warehouse) {
        return res.status(400).json({ error: 'Invalid warehouse' });
      }
    }

    const poNumber = req.body.poNumber
      || (flow === 'sell'
        ? await nextDailyDocNumber(req.user.tenantId, 'SO', { padding: 3 })
        : await generatePoNumber(req.user.tenantId));

    const { normalized, subtotal, totalTax, grandTotal } = normalizeLineItems(req.body.lineItems, {
      requirePositiveCost: flow === 'purchase',
    });

    const productIds = normalized
      .map((li) => li.productId)
      .filter(Boolean)
      .map((id) => id.toString());
    const uniqueProductIds = [...new Set(productIds)];

    if (uniqueProductIds.length) {
      const existingCount = await Product.countDocuments({ _id: { $in: uniqueProductIds }, ...req.tenantFilter });
      if (existingCount !== uniqueProductIds.length) {
        return res.status(400).json({ error: 'Invalid product in line items' });
      }
    }

    // Validate that each line item has either a productId or a manualName
    const hasInvalidItem = normalized.some((li) => !li.productId && !li.manualName);
    if (hasInvalidItem) {
      return res.status(400).json({ error: 'Each line item must have a product or a product name' });
    }

    const { landedCostLines, initialPaidAmount, initialPaymentMethod, initialPaymentReference, ...body } = req.body || {};
    
    let paidAmount = 0;
    let payments = [];
    const advance = toNumber(initialPaidAmount, 0);
    if (advance > 0) {
      paidAmount = advance;
      payments.push({
        amount: advance,
        date: new Date(),
        method: initialPaymentMethod || 'transfer',
        reference: initialPaymentReference || 'Advance Payment',
        recordedBy: req.user._id
      });
    }

    const balanceDue = Math.max(0, grandTotal - paidAmount);
    let paymentStatus = 'pending';
    if (paidAmount > 0) {
      paymentStatus = paidAmount >= grandTotal ? 'paid' : 'partial';
    }

    const data = {
      ...body,
      flow,
      poNumber,
      tenantId: req.user.tenantId,
      createdBy: req.user._id,
      lineItems: normalized,
      subtotal,
      totalTax,
      grandTotal,
      paidAmount,
      balanceDue,
      paymentStatus,
      payments,
      status: body.status || 'draft',
    };
    if (flow === 'sell') {
      data.customerId = body.customerId;
      data.supplierId = body.supplierId || undefined;
    }

    const order = await PurchaseOrder.create(data);
    if (landedCostLines?.length) {
      await upsertDraftLandedCostForPo({
        tenantId: req.user.tenantId,
        tenantFilter: req.tenantFilter,
        userId: req.user._id,
        purchaseOrder: order,
        costLines: landedCostLines,
      });
    }

    // Sell orders: confirm + post outgoing stock immediately (Physical Inventory deducts)
    if (flow === 'sell') {
      order.status = 'approved';
      order.approvedBy = req.user._id;
      order.approvedAt = new Date();
      try {
        const settings = await getSalesSettings(req.user.tenantId);
        if (shouldLockSellOrder(order, settings)) order.isLocked = true;
      } catch {
        order.isLocked = true;
      }
      await order.save();

      let draftDelivery = null;
      try {
        const populated = await PurchaseOrder.findOne({ _id: order._id, ...req.tenantFilter })
          .populate('lineItems.productId', 'sku nameEn nameAr barcode unitOfMeasure productType costPrice')
          .populate('customerId', 'name nameAr nameEn');
        const { fulfillSellOrderStockOut } = await import('../services/inventory/documentLinks.js');
        const result = await fulfillSellOrderStockOut({
          tenantId: req.user.tenantId,
          userId: req.user._id,
          purchaseOrder: populated || order,
          tenantFilter: req.tenantFilter,
        });
        if (result.deliveryNote) {
          draftDelivery = {
            _id: result.deliveryNote._id,
            dnNumber: result.deliveryNote.dnNumber,
            posted: Boolean(result.posted),
            inventoryTransferId: result.transfer?._id || result.deliveryNote.inventoryTransferId,
            transferState: result.transfer?.state,
            stockError: result.error || undefined,
          };
        }
        if (result.error) {
          console.warn('[po] create SO stock-out failed:', result.error);
        }
      } catch (stockErr) {
        console.warn('[po] create SO fulfillment failed:', stockErr.message);
      }

      const fresh = await PurchaseOrder.findById(order._id)
        .populate('warehouseId', 'code nameEn nameAr')
        .populate('customerId', 'name nameAr nameEn');
      return res.status(201).json({
        ...(typeof fresh.toJSON === 'function' ? fresh.toJSON() : fresh),
        draftDelivery,
      });
    }

    res.status(201).json(order);
  } catch (error) {
    if (error instanceof PurchasesValidationError) {
      return res.status(400).json({ error: error.message, code: error.code });
    }
    if (error?.code === 11000) {
      return res.status(400).json({ error: 'Duplicate purchase order number' });
    }
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', checkPermission('supply_chain', 'update'), async (req, res) => {
  try {
    const existing = await PurchaseOrder.findOne((() => { const q = { _id: req.params.id, ...req.tenantFilter }; applyOwnerScopeToQuery(q, req.user); return q; })());
    if (!existing) {
      return res.status(404).json({ error: 'Purchase order not found' });
    }

    if (existing.isLocked || (existing.flow === 'sell' && existing.status === 'approved')) {
      const settings = await getSalesSettings(req.user.tenantId);
      if (shouldLockSellOrder(existing, settings) || existing.isLocked) {
        return res.status(400).json({ error: 'Confirmed sales order is locked and cannot be modified' });
      }
    }

    if (['approved', 'received', 'cancelled', 'partially_received', 'billed'].includes(existing.status)) {
      return res.status(400).json({ error: 'Cannot update an approved, processed, or cancelled purchase order' });
    }

    if (req.body.supplierId) {
      const supplier = await Supplier.findOne({ _id: req.body.supplierId, ...req.tenantFilter, isActive: true });
      if (!supplier) {
        return res.status(400).json({ error: 'Invalid supplier' });
      }
    }

    if (req.body.warehouseId) {
      const warehouse = await Warehouse.findOne({ _id: req.body.warehouseId, ...req.tenantFilter, isActive: true });
      if (!warehouse) {
        return res.status(400).json({ error: 'Invalid warehouse' });
      }
    }

    const { landedCostLines, ...body } = req.body || {};
    const updateData = { ...body };

    if (Array.isArray(body.lineItems)) {
      const { normalized, subtotal, totalTax, grandTotal } = normalizeLineItems(body.lineItems, {
        requirePositiveCost: (existing.flow || 'purchase') === 'purchase',
      });
      updateData.lineItems = normalized;
      updateData.subtotal = subtotal;
      updateData.totalTax = totalTax;
      updateData.grandTotal = grandTotal;
      updateData.balanceDue = Math.max(0, grandTotal - (existing.paidAmount || 0));
      
      if ((existing.paidAmount || 0) >= grandTotal && grandTotal > 0) {
        updateData.paymentStatus = 'paid';
      } else if ((existing.paidAmount || 0) > 0) {
        updateData.paymentStatus = 'partial';
      } else {
        updateData.paymentStatus = 'pending';
      }
    }

    const order = await PurchaseOrder.findOneAndUpdate(
      { _id: req.params.id, ...req.tenantFilter },
      updateData,
      { new: true, runValidators: true }
    );
    if (landedCostLines?.length) {
      await upsertDraftLandedCostForPo({
        tenantId: req.user.tenantId,
        tenantFilter: req.tenantFilter,
        userId: req.user._id,
        purchaseOrder: order,
        costLines: landedCostLines,
      });
    }

    res.json(order);
  } catch (error) {
    if (error instanceof PurchasesValidationError) {
      return res.status(400).json({ error: error.message, code: error.code });
    }
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/approve', sellOrSupply('approve'), async (req, res) => {
  try {
    const order = await PurchaseOrder.findOne((() => { const q = { _id: req.params.id, ...req.tenantFilter }; applyOwnerScopeToQuery(q, req.user); return q; })());
    if (!order) {
      return res.status(404).json({ error: 'Purchase order not found' });
    }

    if (order.status === 'cancelled') {
      return res.status(400).json({ error: 'Cannot approve a cancelled order' });
    }

    if (order.status === 'approved') {
      return res.json({
        success: true,
        alreadyApproved: true,
        message: 'Order is already approved',
        order,
      });
    }

    if (order.flow === 'sell') {
      const gate = await assertSellOrderCanConfirm(order, req.user.tenantId);
      if (!gate.ok && gate.hold) {
        order.status = 'pending_approval';
        order.approvalReason = gate.error;
        order.approvalCode = gate.code;
        order.creditExposureAtHold = gate.credit?.exposure ?? null;
        order.isLocked = false;
        await order.save();
        try {
          const { appendDocumentMessage } = await import('../services/sales/documentChatter.js');
          await appendDocumentMessage({
            tenantId: req.user.tenantId,
            docType: 'sales_order',
            docId: order._id,
            userId: req.user._id,
            body: `Credit hold: ${gate.error}`,
            kind: 'system',
          });
        } catch { /* chatter optional */ }
        try {
          const { notifyFinanceApprovalHold } = await import('../services/sales/financeNotify.js');
          await notifyFinanceApprovalHold({
            tenantId: req.user.tenantId,
            order,
            reason: gate.error,
            code: gate.code || 'CREDIT_LIMIT_EXCEEDED',
            userId: req.user._id,
          });
        } catch { /* notify optional */ }
        return res.status(402).json({
          error: gate.error,
          code: gate.code,
          status: 'pending_approval',
          credit: gate.credit,
          order,
        });
      }
      if (!gate.ok) {
        return res.status(400).json({ error: gate.error, code: gate.code });
      }
      const { assertSellLineVariantBinding } = await import('../services/sales/variantBinding.js');
      const binding = await assertSellLineVariantBinding(order.lineItems || [], req.user.tenantId);
      if (!binding.ok) {
        return res.status(400).json({ error: binding.errors.join('; '), code: 'VARIANT_REQUIRED' });
      }

      // Margin threshold → pending approval (sales manager)
      const minMargin = Number(gate.settings?.minMarginPercent || 0);
      if (minMargin > 0) {
        const Product = (await import('../models/Product.js')).default;
        const pids = [...new Set((order.lineItems || []).map((l) => l.productId).filter(Boolean))];
        const products = await Product.find({ _id: { $in: pids }, tenantId: req.user.tenantId })
          .select('costPrice')
          .lean();
        const costMap = Object.fromEntries(products.map((p) => [String(p._id), Number(p.costPrice || 0)]));
        const { estimateOrderMarginPercent } = await import('../services/sales/salesLifecycle.js');
        const margin = estimateOrderMarginPercent(order, costMap);
        if (margin < minMargin) {
          order.status = 'pending_approval';
          order.approvalReason = `Margin ${margin.toFixed(1)}% is below threshold ${minMargin}%`;
          order.approvalCode = 'MARGIN_BELOW_THRESHOLD';
          await order.save();
          try {
            const { appendDocumentMessage } = await import('../services/sales/documentChatter.js');
            await appendDocumentMessage({
              tenantId: req.user.tenantId,
              docType: 'sales_order',
              docId: order._id,
              userId: req.user._id,
              body: `Margin hold: ${order.approvalReason}`,
              kind: 'system',
            });
          } catch { /* optional */ }
          try {
            const { notifyFinanceApprovalHold } = await import('../services/sales/financeNotify.js');
            await notifyFinanceApprovalHold({
              tenantId: req.user.tenantId,
              order,
              reason: order.approvalReason,
              code: 'MARGIN_BELOW_THRESHOLD',
              userId: req.user._id,
            });
          } catch { /* optional */ }
          return res.status(402).json({
            error: order.approvalReason,
            code: 'MARGIN_BELOW_THRESHOLD',
            status: 'pending_approval',
            margin,
            order,
          });
        }
      }

      // Oversell gate for MTS lines
      try {
        const { evaluateSellOrderOversell } = await import('../services/sales/oversellGate.js');
        const stockGate = await evaluateSellOrderOversell(order, req.user.tenantId, {
          allowOversell: Boolean(req.body?.allowOversell),
        });
        if (!stockGate.ok) {
          return res.status(400).json({
            error: stockGate.error,
            code: stockGate.code,
            shortages: stockGate.shortages,
            policy: stockGate.policy,
          });
        }
        if (stockGate.warning) {
          req._oversellWarning = stockGate;
        }
      } catch (stockErr) {
        console.warn('[po] oversell gate skipped:', stockErr.message);
      }
    }

    order.status = 'approved';
    order.approvedBy = req.user._id;
    order.approvedAt = new Date();
    if (order.flow === 'sell') {
      const settings = await getSalesSettings(req.user.tenantId);
      if (shouldLockSellOrder(order, settings)) {
        order.isLocked = true;
      }
    }
    await order.save();

    let draftGrn = null;
    let draftDelivery = null;
    try {
      const populated = await PurchaseOrder.findOne({ _id: order._id, ...req.tenantFilter })
        .populate('lineItems.productId', 'sku nameEn nameAr barcode unitOfMeasure productType costPrice')
        .populate('customerId', 'name nameAr')
        .populate('supplierId', 'nameEn nameAr');

      // Purchase GRNs are created only on PO receive — not on approve (avoids duplicate GRNs).
      if (order.flow === 'sell') {
        const { fulfillSellOrderStockOut } = await import('../services/inventory/documentLinks.js');
        const result = await fulfillSellOrderStockOut({
          tenantId: req.user.tenantId,
          userId: req.user._id,
          purchaseOrder: populated || order,
          tenantFilter: req.tenantFilter,
        });
        if (result.deliveryNote) {
          draftDelivery = {
            _id: result.deliveryNote._id,
            dnNumber: result.deliveryNote.dnNumber,
            status: result.deliveryNote.status,
            created: result.created,
            inventoryTransferId: result.transfer?._id || result.deliveryNote.inventoryTransferId,
            posted: Boolean(result.posted),
            stockPostedAt: result.deliveryNote.stockPostedAt,
            transferState: result.transfer?.state,
          };
          if (result.error) {
            draftDelivery.stockError = result.error;
            draftDelivery.reserved = Boolean(result.reserved);
            console.warn('[po] SO stock-out failed:', result.error);
          }
        }

        // Dropship / MTO orchestration for lines with procurementRoute
        try {
          const { orchestrateSellOrderRoutes } = await import('../services/sales/routeOrchestration.js');
          draftDelivery = {
            ...(draftDelivery || {}),
            routes: await orchestrateSellOrderRoutes({
              tenantId: req.user.tenantId,
              userId: req.user._id,
              order: populated || order,
              tenantFilter: req.tenantFilter,
            }),
          };
        } catch (routeErr) {
          console.warn('[po] route orchestration failed:', routeErr.message);
        }
      }
    } catch (draftErr) {
      console.warn('[po] draft stock doc on approve failed:', draftErr.message);
    }

    const payload = typeof order.toJSON === 'function' ? order.toJSON() : order;
    let responseOrder = payload;
    if (order.flow === 'sell') {
      const fresh = await PurchaseOrder.findOne({ _id: order._id, ...req.tenantFilter });
      if (fresh) responseOrder = typeof fresh.toJSON === 'function' ? fresh.toJSON() : fresh;
    }
    res.json({
      ...responseOrder,
      draftGrn,
      draftDelivery,
      ...(req._oversellWarning
        ? { oversellWarning: req._oversellWarning.warning, shortages: req._oversellWarning.shortages }
        : {}),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/** Finance / sales-manager: release credit or margin hold and confirm the SO */
router.post('/:id/release-approval', sellOrSupply('approve'), async (req, res) => {
  try {
    const order = await PurchaseOrder.findOne((() => { const q = { _id: req.params.id, ...req.tenantFilter }; applyOwnerScopeToQuery(q, req.user); return q; })());
    if (!order) return res.status(404).json({ error: 'Purchase order not found' });
    if (order.flow !== 'sell' || order.status !== 'pending_approval') {
      return res.status(400).json({ error: 'Order is not pending approval' });
    }

    const { canReleaseSalesApproval } = await import('../services/sales/financeNotify.js');
    if (!canReleaseSalesApproval(req.user, order.approvalCode)) {
      return res.status(403).json({
        error: 'Only finance/sales managers can release this hold',
        code: 'RELEASE_FORBIDDEN',
      });
    }

    const gate = await assertSellOrderCanConfirm(order, req.user.tenantId, { skipCredit: true });
    if (!gate.ok) {
      return res.status(400).json({ error: gate.error, code: gate.code });
    }

    order.status = 'approved';
    order.approvedBy = req.user._id;
    order.approvedAt = new Date();
    order.approvalReason = '';
    order.approvalCode = '';
    if (shouldLockSellOrder(order, gate.settings)) order.isLocked = true;
    await order.save();

    let draftDelivery = null;
    try {
      const populated = await PurchaseOrder.findOne({ _id: order._id, ...req.tenantFilter })
        .populate('lineItems.productId', 'sku nameEn nameAr barcode unitOfMeasure productType costPrice')
        .populate('customerId', 'name nameAr');
      const { fulfillSellOrderStockOut } = await import('../services/inventory/documentLinks.js');
      const result = await fulfillSellOrderStockOut({
        tenantId: req.user.tenantId,
        userId: req.user._id,
        purchaseOrder: populated || order,
        tenantFilter: req.tenantFilter,
      });
      if (result.deliveryNote) {
        draftDelivery = {
          _id: result.deliveryNote._id,
          dnNumber: result.deliveryNote.dnNumber,
          inventoryTransferId: result.transfer?._id || result.deliveryNote.inventoryTransferId,
          posted: Boolean(result.posted),
          stockPostedAt: result.deliveryNote.stockPostedAt,
          transferState: result.transfer?.state,
        };
        if (result.error) {
          draftDelivery.stockError = result.error;
          draftDelivery.reserved = Boolean(result.reserved);
        }
      }
      try {
        const { orchestrateSellOrderRoutes } = await import('../services/sales/routeOrchestration.js');
        draftDelivery = {
          ...(draftDelivery || {}),
          routes: await orchestrateSellOrderRoutes({
            tenantId: req.user.tenantId,
            userId: req.user._id,
            order: populated || order,
            tenantFilter: req.tenantFilter,
          }),
        };
      } catch { /* optional */ }
    } catch (e) {
      console.warn('[po] release-approval fulfillment failed:', e.message);
    }

    try {
      const { appendDocumentMessage } = await import('../services/sales/documentChatter.js');
      await appendDocumentMessage({
        tenantId: req.user.tenantId,
        docType: 'sales_order',
        docId: order._id,
        userId: req.user._id,
        body: 'Credit/margin hold released — order confirmed',
        kind: 'system',
      });
    } catch { /* optional */ }

    res.json({ ...(typeof order.toJSON === 'function' ? order.toJSON() : order), draftDelivery });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/reject-approval', sellOrSupply('approve'), async (req, res) => {
  try {
    const order = await PurchaseOrder.findOne((() => { const q = { _id: req.params.id, ...req.tenantFilter }; applyOwnerScopeToQuery(q, req.user); return q; })());
    if (!order) return res.status(404).json({ error: 'Purchase order not found' });
    if (order.flow !== 'sell' || order.status !== 'pending_approval') {
      return res.status(400).json({ error: 'Order is not pending approval' });
    }
    order.status = 'draft';
    order.rejectedBy = req.user._id;
    order.rejectedAt = new Date();
    order.rejectionReason = String(req.body?.reason || '').trim();
    order.approvalReason = '';
    order.approvalCode = '';
    order.isLocked = false;
    await order.save();
    try {
      const { appendDocumentMessage } = await import('../services/sales/documentChatter.js');
      await appendDocumentMessage({
        tenantId: req.user.tenantId,
        docType: 'sales_order',
        docId: order._id,
        userId: req.user._id,
        body: `Approval rejected${order.rejectionReason ? `: ${order.rejectionReason}` : ''}`,
        kind: 'system',
      });
    } catch { /* optional */ }
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/send', sellOrSupply('update'), async (req, res) => {
  try {
    const order = await PurchaseOrder.findOne((() => { const q = { _id: req.params.id, ...req.tenantFilter }; applyOwnerScopeToQuery(q, req.user); return q; })());
    if (!order) {
      return res.status(404).json({ error: 'Purchase order not found' });
    }
    if (!['draft', 'sent'].includes(order.status)) {
      return res.status(400).json({ error: 'Only draft purchase orders can be sent' });
    }
    order.status = 'sent';
    await order.save();
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/cancel', checkPermission('supply_chain', 'update'), async (req, res) => {
  try {
    const order = await PurchaseOrder.findOne((() => { const q = { _id: req.params.id, ...req.tenantFilter }; applyOwnerScopeToQuery(q, req.user); return q; })());
    if (!order) {
      return res.status(404).json({ error: 'Purchase order not found' });
    }

    if (order.status === 'cancelled') {
      return res.status(400).json({ error: 'Order is already cancelled' });
    }

    // Approved (and later) purchase orders cannot be cancelled — only draft/sent.
    if (!['draft', 'sent'].includes(String(order.status || ''))) {
      return res.status(400).json({
        error: 'Cannot cancel an approved or processed purchase order',
        code: 'PO_CANCEL_LOCKED',
      });
    }

    order.status = 'cancelled';
    await order.save();

    res.json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/receive', checkPermission('supply_chain', 'update'), async (req, res) => {
  try {
    const { warehouseId, items, notes } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'items is required' });
    }

    const order = await PurchaseOrder.findOne((() => { const q = { _id: req.params.id, ...req.tenantFilter }; applyOwnerScopeToQuery(q, req.user); return q; })());
    if (!order) {
      return res.status(404).json({ error: 'Purchase order not found' });
    }
    if (order.status === 'cancelled') {
      return res.status(400).json({ error: 'Cannot receive against a cancelled order' });
    }

    const resolvedWarehouseId = warehouseId || order.warehouseId;
    if (!resolvedWarehouseId) {
      return res.status(400).json({
        error: 'Warehouse is required to receive stock',
        code: 'WAREHOUSE_REQUIRED',
      });
    }
    {
      const warehouse = await Warehouse.findOne({ _id: resolvedWarehouseId, ...req.tenantFilter, isActive: true });
      if (!warehouse) {
        return res.status(400).json({ error: 'Warehouse not found' });
      }
    }

    const lines = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const productId = item.productId;
      const variantId = item.variantId;
      const lineIndex = item.lineIndex !== undefined ? item.lineIndex : i;
      const qty = toNumber(item.quantity ?? item.qty, 0);
      if (qty <= 0) continue;
      let line = null;
      if (productId) {
        if (variantId) {
          line = order.lineItems.find(
            (li) => li.productId?.toString() === productId.toString()
              && String(li.variantId || '') === String(variantId),
          );
        }
        if (!line) {
          line = order.lineItems.find((li) => li.productId?.toString() === productId.toString());
        }
      }
      if (!line && order.lineItems[lineIndex]) {
        line = order.lineItems[lineIndex];
      }
      if (!line) {
        return res.status(400).json({ error: 'Invalid item in receive list' });
      }
      lines.push({
        productId: line.productId || undefined,
        variantId: line.variantId || variantId || undefined,
        productName: line.manualName || (line.productId?.nameEn || line.productId?.nameAr) || '',
        productType: line.productType || 'goods',
        uom: line.uom || '',
        quantityOrdered: line.quantityOrdered,
        quantityReceived: qty,
        costPrice: line.unitCost,
      });
    }

    const hasRefund = items.some((it) => it.remainingAction === 'refund');
    if (!lines.length && !hasRefund) {
      return res.status(400).json({ error: 'No valid receiving or refund items' });
    }

    let grn = null;
    if (lines.length > 0) {
      // Reuse existing draft GRN from an older approve path — never create a second GRN for the same receive.
      const draftExisting = await GRN.findOne({
        ...req.tenantFilter,
        purchaseOrderId: order._id,
        status: 'draft',
      }).sort({ createdAt: 1 });

      if (draftExisting) {
        draftExisting.lines = lines;
        draftExisting.warehouseId = resolvedWarehouseId;
        draftExisting.notes = notes || draftExisting.notes;
        draftExisting.receivedBy = req.user._id;
        await draftExisting.save();
        grn = draftExisting;
        // Cancel any other leftover drafts for this PO
        await GRN.updateMany(
          {
            ...req.tenantFilter,
            purchaseOrderId: order._id,
            status: 'draft',
            _id: { $ne: draftExisting._id },
          },
          { $set: { status: 'cancelled', cancelledAt: new Date() } },
        );
      } else {
        grn = new GRN({
          tenantId: req.user.tenantId,
          grnNumber: await generateGrnNumber(req.tenantFilter),
          supplierId: order.supplierId,
          purchaseOrderId: order._id,
          warehouseId: resolvedWarehouseId,
          notes,
          createdBy: req.user._id,
          receivedBy: req.user._id,
          status: 'draft',
          lines,
        });
        await grn.save();
      }

      // Link draft incoming transfer when inventory engine is on (so Physical Inventory gets quants)
      if (!grn.inventoryTransferId) {
        try {
          const { linkDraftReceiptToGrn } = await import('../services/inventory/documentLinks.js');
          await linkDraftReceiptToGrn({
            tenantId: req.user.tenantId,
            userId: req.user._id,
            purchaseOrder: order,
            grn,
          });
          const refreshedGrn = await GRN.findById(grn._id);
          if (refreshedGrn) grn = refreshedGrn;
        } catch (linkErr) {
          console.warn('[po] receive link draft transfer:', linkErr.message);
        }
      }

      await confirmGrnReceive({
        tenantFilter: req.tenantFilter,
        user: req.user,
        grn,
        warehouseId: resolvedWarehouseId,
      });
    }

    const refreshed = await PurchaseOrder.findOne({ _id: order._id, ...req.tenantFilter });
    if (refreshed) {
      const refundNotes = [];
      let hasAnyPendingBackorder = false;

      (refreshed.lineItems || []).forEach((li, idx) => {
        const itemReq = items.find((it) => matchPurchaseLine(li, {
          productId: it.productId,
          variantId: it.variantId,
        }) || it.lineIndex === idx);
        const rem = Math.max(0, toNumber(li.quantityOrdered, 0) - toNumber(li.quantityReceived, 0) - toNumber(li.quantityReturned, 0));
        if (rem > 0) {
          if (itemReq?.remainingAction === 'refund') {
            const pName = li.manualName || (li.productId?.nameEn || li.productId?.nameAr) || 'Item';
            li.quantityReturned = safeRound2(toNumber(li.quantityReturned, 0) + rem);
            refundNotes.push(`${pName}: ${rem} ${li.uom || 'units'} refunded/cancelled`);
          } else {
            hasAnyPendingBackorder = true;
          }
        }
      });

      if (refundNotes.length > 0) {
        refreshed.notes = (refreshed.notes ? `${refreshed.notes} | ` : '') + `[Refund: ${refundNotes.join(', ')}]`;
      }

      const totalRec = (refreshed.lineItems || []).reduce((s, li) => s + toNumber(li.quantityReceived, 0), 0);
      const totalRet = (refreshed.lineItems || []).reduce((s, li) => s + toNumber(li.quantityReturned, 0), 0);
      const totalOrd = (refreshed.lineItems || []).reduce((s, li) => s + toNumber(li.quantityOrdered, 0), 0);

      if (!hasAnyPendingBackorder) {
        if (totalRec === 0 && (totalRet >= totalOrd || refundNotes.length > 0)) {
          refreshed.status = 'refunded';
        } else if (totalRec > 0) {
          refreshed.status = 'received';
        } else {
          refreshed.status = 'refunded';
        }
      }

      if (req.body.settlementReason) {
        refreshed.notes = (refreshed.notes ? `${refreshed.notes} | ` : '') + req.body.settlementReason;
      }
      await refreshed.save();
    }
    res.json({ ...refreshed.toObject(), grnId: grn?._id, grnNumber: grn?.grnNumber });
  } catch (error) {
    if (error instanceof PurchasesValidationError) {
      return res.status(400).json({ error: error.message, code: error.code });
    }
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/attachments', checkPermission('supply_chain', 'update'), vendorBillUpload.single('file'), async (req, res) => {
  try {
    const order = await PurchaseOrder.findOne((() => { const q = { _id: req.params.id, ...req.tenantFilter }; applyOwnerScopeToQuery(q, req.user); return q; })());
    if (!order) {
      return res.status(404).json({ error: 'Purchase order not found' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    const ext = (req.file.originalname.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '');
    const filename = `vendor-bill-${Date.now()}-${Math.round(Math.random() * 1e9)}.${ext || 'bin'}`;
    const key = `purchase-orders/${req.user.tenantId}/${order._id}/${filename}`;
    const { url } = await saveUploadBuffer({
      buffer: req.file.buffer,
      key,
      contentType: req.file.mimetype,
      publicUrlPath: `/uploads/${key}`,
    });
    const attachment = {
      name: req.file.originalname || filename,
      url,
      key,
      mimeType: req.file.mimetype,
      size: req.file.size,
      uploadedAt: new Date(),
    };
    order.attachments = [...(order.attachments || []), attachment];
    await order.save();
    res.status(201).json({ attachment, attachments: order.attachments });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/:id/attachments/:fileId', checkPermission('supply_chain', 'read'), async (req, res) => {
  try {
    const order = await PurchaseOrder.findOne((() => { const q = { _id: req.params.id, ...req.tenantFilter }; applyOwnerScopeToQuery(q, req.user); return q; })()).select('attachments');
    if (!order) return res.status(404).json({ error: 'Purchase order not found' });
    const files = Array.isArray(order.attachments) ? order.attachments : [];
    const fileId = decodeURIComponent(String(req.params.fileId || ''));
    const byIndex = /^\d+$/.test(fileId) ? files[Number(fileId)] : null;
    const file = byIndex
      || files.find((row) => row?.name === fileId)
      || files.find((row) => String(row?.url || '').endsWith(fileId))
      || files.find((row) => String(row?.key || '').endsWith(fileId));
    if (!file) return res.status(404).json({ error: 'Vendor bill not found' });

    const rawUrl = String(file.url || '').replace(/^\/api/, '');
    const key = String(file.key || '').replace(/^\/+/, '')
      || rawUrl.replace(/^\/uploads\//, '').replace(/^\/+/, '');
    if (!key) return res.status(404).json({ error: 'Vendor bill not found' });

    const buffer = await readUploadBuffer(key);
    if (!buffer) {
      return res.status(404).json({ error: 'Vendor bill file is missing. Upload it again.' });
    }

    const inline = String(req.query.inline || '1') !== '0';
    const filename = file.name || key.split('/').pop() || 'vendor-bill';
    res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename="${filename.replace(/"/g, '')}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/payment', checkPermission('supply_chain', 'update'), vendorBillUpload.single('receipt'), async (req, res) => {
  try {
    const order = await PurchaseOrder.findOne((() => { const q = { _id: req.params.id, ...req.tenantFilter }; applyOwnerScopeToQuery(q, req.user); return q; })());
    if (!order) return res.status(404).json({ error: 'Purchase order not found' });
    
    const amount = Math.round(Number(req.body.amount || 0) * 100) / 100;
    if (amount <= 0) return res.status(400).json({ error: 'Valid amount greater than 0 is required' });

    const asAdvance = ['1', 'true', 'yes', 'on'].includes(String(req.body.asAdvance || '').trim().toLowerCase());

    // Resolve linked posted vendor bill (Invoice flow=purchase)
    const Invoice = (await import('../models/Invoice.js')).default;
    let linkedBill = null;
    if (order.billedInvoiceId) {
      linkedBill = await Invoice.findOne({
        _id: order.billedInvoiceId,
        tenantId: req.user.tenantId,
        flow: 'purchase',
        invoiceType: '388',
        status: { $nin: ['draft', 'cancelled'] },
      });
    }
    if (!linkedBill) {
      linkedBill = await Invoice.findOne({
        tenantId: req.user.tenantId,
        flow: 'purchase',
        invoiceType: '388',
        sourcePurchaseOrderId: order._id,
        status: { $nin: ['draft', 'cancelled'] },
      }).sort({ createdAt: -1 });
      if (linkedBill && !order.billedInvoiceId) {
        order.billedInvoiceId = linkedBill._id;
      }
    }

    if (!linkedBill && !asAdvance) {
      return res.status(400).json({
        error: 'Vendor bill required before payment. Create and post a vendor bill from this PO, or set asAdvance=true to record an Advance to Suppliers (account 1290).',
        code: 'VENDOR_BILL_REQUIRED',
      });
    }

    let receiptUrl = String(req.body.receiptUrl || '').trim();
    let receiptName = String(req.body.receiptName || '').trim();

    if (req.file) {
      const ext = (req.file.originalname.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '');
      const filename = `payment-receipt-${Date.now()}-${Math.round(Math.random() * 1e9)}.${ext || 'bin'}`;
      const key = `purchase-orders/${req.user.tenantId}/${order._id}/${filename}`;
      const { url } = await saveUploadBuffer({
        buffer: req.file.buffer,
        key,
        contentType: req.file.mimetype,
        publicUrlPath: `/uploads/${key}`,
      });
      receiptUrl = url;
      receiptName = req.file.originalname || filename;
    }

    const paymentMethodMapped = req.body.method === 'transfer' ? 'bank_transfer' : (req.body.method || 'bank_transfer');
    const paymentDate = req.body.date ? new Date(req.body.date) : new Date();
    const reference = String(req.body.reference || '').trim();
    const notes = String(req.body.notes || '').trim();
    const confirmNegativeCash = req.body?.confirmNegativeCash === true
      || req.body?.confirmNegative === true
      || String(req.body?.confirmNegativeCash || '').toLowerCase() === 'true';

    const payment = {
      amount,
      date: paymentDate,
      method: req.body.method || 'transfer',
      reference,
      receiptUrl,
      receiptName,
      notes,
      recordedBy: req.user._id,
      asAdvance: Boolean(asAdvance && !linkedBill),
    };

    // Unified vendor payment (AccountPayment + GL + voucher mirror)
    try {
      const Partner = (await import('../models/Partner.js')).default;
      const partner = order.supplierId
        ? await Partner.findOne({ _id: order.supplierId, tenantId: req.user.tenantId })
          .select('name nameEn nameAr')
          .lean()
        : null;
      const supplierName = partner?.nameAr || partner?.nameEn || partner?.name || '';

      let billAllocAmount = amount;
      if (linkedBill) {
        const residual = Math.round(
          (Math.max(0, (Number(linkedBill.grandTotal) || 0) - (Number(linkedBill.paidAmount) || 0))) * 100,
        ) / 100;
        billAllocAmount = Math.min(amount, residual);
      }

      const { createVendorPayment } = await import('../services/vendorPaymentService.js');
      const accountPayment = await createVendorPayment({
        tenantId: req.user.tenantId,
        userId: req.user._id,
        vendorId: order.supplierId || null,
        vendorName: supplierName,
        date: paymentDate,
        amount,
        method: paymentMethodMapped,
        reference: reference || order.poNumber,
        memo: notes || (linkedBill
          ? `Payment for vendor bill ${linkedBill.invoiceNumber} (PO ${order.poNumber})`
          : `Advance on PO ${order.poNumber}`),
        currency: order.currency || 'SAR',
        allocations: linkedBill && billAllocAmount > 0.005
          ? [{ billId: linkedBill._id, amount: billAllocAmount }]
          : [],
        source: 'purchase_order',
        confirmNegativeCash,
        purchaseOrder: (!linkedBill || amount > billAllocAmount + 0.005) ? order : null,
        attachments: receiptUrl
          ? [{ name: receiptName || 'receipt', url: receiptUrl, type: '' }]
          : [],
      });

      payment.voucherId = accountPayment.voucherId || null;
      payment.voucherNumber = accountPayment.number || '';
      payment.journalEntryId = accountPayment.journalEntryId || null;
      payment.accountPaymentId = accountPayment._id || null;
      payment.paymentNumber = accountPayment.number || '';
    } catch (glErr) {
      const status = glErr.status || glErr.statusCode || 500;
      return res.status(status).json({
        error: glErr.message || 'Failed to post payment',
        code: glErr.code,
        details: glErr.details,
      });
    }

    order.payments = [...(order.payments || []), payment];
    const totalPaid = Math.round((order.payments || []).reduce((sum, p) => sum + (Number(p.amount) || 0), 0) * 100) / 100;
    order.paidAmount = totalPaid;
    order.balanceDue = Math.max(0, Math.round((order.grandTotal - totalPaid) * 100) / 100);
    
    if (order.paidAmount >= order.grandTotal - 0.001) {
      order.paymentStatus = 'paid';
    } else if (order.paidAmount > 0) {
      order.paymentStatus = 'partial';
    } else {
      order.paymentStatus = 'pending';
    }

    await order.save();

    const refreshed = await PurchaseOrder.findOne({ _id: order._id, ...req.tenantFilter })
      .populate('payments.recordedBy', 'name firstName lastName');
    res.json(refreshed);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/** Create down-payment invoice from sell order (virtual product line, no stock impact) */
router.post('/:id/down-payment-invoice', sellOrSupply('create'), async (req, res) => {
  try {
    const order = await PurchaseOrder.findOne((() => { const q = { _id: req.params.id, ...req.tenantFilter, flow: 'sell' }; applyOwnerScopeToQuery(q, req.user); return q; })());
    if (!order) return res.status(404).json({ error: 'Sales order not found' });

    const percent = Number(req.body?.percent || 0);
    const fixedAmount = Number(req.body?.amount || 0);
    let amount = fixedAmount;
    if (!amount && percent > 0) {
      amount = Math.round((Number(order.grandTotal || 0) * percent) / 100 * 100) / 100;
    }
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Provide amount or percent for down payment' });
    }

    const tenant = await Tenant.findById(req.user.tenantId);
    const lastInvoice = await Invoice.findOne({ tenantId: req.user.tenantId, invoiceSubtype: { $ne: 'proforma' } })
      .sort({ createdAt: -1 })
      .select('invoiceNumber');
    const seq = lastInvoice
      ? parseInt(String(lastInvoice.invoiceNumber || '').split('-').pop(), 10) + 1
      : 1;

    const invoiceData = {
      tenantId: req.user.tenantId,
      flow: 'sell',
      invoiceSubtype: 'standard',
      invoiceNumber: `INV-${new Date().getFullYear()}-${String(seq).padStart(6, '0')}`,
      sourcePurchaseOrderId: order._id,
      customerId: order.customerId,
      status: 'draft',
      issueDate: new Date(),
      transactionType: 'B2B',
      lineItems: [{
        productName: `Down Payment — ${order.poNumber || order._id}`,
        productType: 'service',
        quantity: 1,
        unitPrice: amount,
        taxRate: 15,
        lineTotal: amount,
      }],
      subtotal: amount,
      totalTax: Math.round(amount * 0.15 * 100) / 100,
      grandTotal: Math.round(amount * 1.15 * 100) / 100,
      notes: req.body?.notes || `Down payment for sales order ${order.poNumber || order._id}`,
      seller: {
        name: tenant?.business?.legalNameEn,
        nameAr: tenant?.business?.legalNameAr,
        vatNumber: tenant?.business?.vatNumber,
        crNumber: tenant?.business?.crNumber,
        address: tenant?.business?.address,
      },
      createdBy: req.user._id,
    };

    const enriched = await enrichInvoiceArabicFields(invoiceData);
    const invoice = await Invoice.create(enriched);

    res.status(201).json({ invoice, downPaymentAmount: amount });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// @route   POST /api/purchase-orders/:id/send-email
// @desc    Email sales order bill PDF (sell flow only)
router.post('/:id/send-email', checkPermission('invoicing', 'update'), async (req, res) => {
  try {
    const order = await PurchaseOrder.findOne((() => { const q = { _id: req.params.id, ...req.tenantFilter, flow: 'sell' }; applyOwnerScopeToQuery(q, req.user); return q; })());
    if (!order) {
      return res.status(404).json({ error: 'Sales order not found' });
    }

    const tenant = await Tenant.findById(req.user.tenantId);
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    if (!tenantHasEmailAddon(tenant)) {
      return res.status(403).json({ error: 'Email Marketing is not installed for this tenant' });
    }

    const customer = order.customerId
      ? await Customer.findOne({ _id: order.customerId, tenantId: order.tenantId }).select('name nameEn nameAr email contactPerson')
      : null;
    const recipient = resolveSalesOrderRecipient(customer, order, req.body?.to);
    if (!recipient) {
      return res.status(400).json({ error: 'Customer email is missing' });
    }

    const attachment = req.body?.attachment && typeof req.body.attachment === 'object'
      ? {
          filename: String(req.body.attachment.filename || `${order.poNumber || 'sales-order'}.pdf`).trim(),
          contentBase64: String(req.body.attachment.contentBase64 || '').trim(),
          contentType: String(req.body.attachment.contentType || 'application/pdf').trim() || 'application/pdf',
          size: Number(req.body.attachment.size || 0),
        }
      : null;

    if (!attachment?.contentBase64) {
      return res.status(400).json({ error: 'Sales order PDF attachment is required' });
    }

    const subject = `${order.poNumber} Sales Order Bill | فاتورة أمر البيع ${order.poNumber}`;
    const html = buildSalesOrderEmailHtml({
      order,
      tenant,
      customerName: customer?.nameEn || customer?.name || customer?.nameAr || order?.buyer?.name || order?.buyer?.nameAr,
    });

    const delivery = await sendTenantEmail({
      tenant,
      to: recipient,
      subject,
      html,
      attachments: [attachment],
      metadata: { purpose: 'manual_sales_order', poNumber: order.poNumber },
    });

    res.json({ success: true, delivery });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   POST /api/purchase-orders/:id/send-whatsapp
// @desc    Send sales order via WhatsApp with wa.me link fallback
router.post('/:id/send-whatsapp', checkPermission('invoicing', 'read'), async (req, res) => {
  try {
    const order = await PurchaseOrder.findOne((() => { const q = { _id: req.params.id, ...req.tenantFilter, flow: 'sell' }; applyOwnerScopeToQuery(q, req.user); return q; })());
    if (!order) {
      return res.status(404).json({ error: 'Sales order not found' });
    }

    const tenant = await Tenant.findById(req.user.tenantId);
    let customer = null;
    if (order.customerId) {
      customer = await Customer.findOne({ _id: order.customerId, tenantId: tenant._id });
    }

    const phone = req.body?.phone || customer?.phone || customer?.mobile || order?.buyer?.contactPhone || order?.buyer?.phone;
    const cleanPhone = String(phone || '').replace(/[^0-9]/g, '');

    const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
    const baseUrl = process.env.APP_URL || `${protocol}://${tenant.domain || 'app.maqder.com'}`;
    const link = `${baseUrl}/app/dashboard/sales/orders/${order._id}`;
    const amountLabel = `${Number(order.grandTotal || 0).toFixed(2)} ${order.currency || 'SAR'}`;
    const customerName = customer?.nameEn || customer?.name || customer?.nameAr || order?.buyer?.name || order?.buyer?.nameAr || 'Customer';
    const orderNumber = order.poNumber || String(order._id);

    const textEn = `Dear ${customerName}, sales order bill ${orderNumber} (${amountLabel}) from ${tenant?.name || 'us'} is ready: ${link}`;
    const textAr = `عزيزي ${customerName}، فاتورة أمر البيع رقم ${orderNumber} بقيمة (${amountLabel}) من ${tenant?.nameAr || tenant?.name || 'مؤسستنا'} متاحة عبر الرابط: ${link}`;
    const messageText = req.body?.language === 'ar' ? textAr : textEn;
    const waLink = cleanPhone ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(messageText)}` : `https://wa.me/?text=${encodeURIComponent(messageText)}`;

    if (cleanPhone) {
      try {
        const sendResult = await sendRestaurantWhatsApp({
          tenantId: tenant._id,
          phone: cleanPhone,
          messageEn: textEn,
          messageAr: textAr,
          replacements: { poNumber: orderNumber, total: order.grandTotal, link, customer_name: customerName },
        });
        if (sendResult?.sent) {
          return res.json({ success: true, channel: 'direct_whatsapp', message: 'Sales order sent via WhatsApp successfully', waLink });
        }
      } catch (_e) {
        // Fall through to wa.me link
      }
    }

    res.json({ success: true, channel: 'wa_me', waLink });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
