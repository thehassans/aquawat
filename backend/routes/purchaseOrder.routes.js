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
import { protect, tenantFilter, checkPermission, requireTenantFilter } from '../middleware/auth.js';
import { checkTrialLimits } from '../middleware/trialLimits.js';
import { saveUploadBuffer, readUploadBuffer } from '../utils/objectStorage.js';
import { normalizeProductType } from '../utils/productType.js';
import { confirmGrnReceive, generateGrnNumber, PurchasesValidationError, upsertDraftLandedCostForPo } from '../services/purchasesWorkflow.js';
import { computePurchaseLineTotals, buildPoReceivingLedger } from '../services/purchasesLogic.js';

const router = express.Router();

router.use(protect);
router.use(tenantFilter);
router.use(requireTenantFilter);

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
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

function normalizeLineItems(lineItems = []) {
  const items = Array.isArray(lineItems) ? lineItems : [];
  const totals = computePurchaseLineTotals(items);
  const normalized = items.map((li, index) => {
    const computed = totals.lines[index] || { lineSubtotal: 0, lineTax: 0, lineTotal: 0 };
    return {
      productId: li.productId || undefined,
      manualName: li.manualName || '',
      uom: li.uom || '',
      description: li.description,
      productType: normalizeProductType(li.productType),
      quantityOrdered: toNumber(li.quantityOrdered ?? li.quantity ?? 0, 0),
      quantityReceived: toNumber(li.quantityReceived ?? 0, 0),
      quantityReturned: toNumber(li.quantityReturned, 0),
      unitCost: toNumber(li.unitCost ?? 0, 0),
      taxRate: toNumber(li.taxRate ?? 15, 15),
      lineSubtotal: computed.lineSubtotal,
      lineTax: computed.lineTax,
      lineTotal: computed.lineTotal
    };
  });
  return { normalized, subtotal: totals.subtotal, totalTax: totals.totalTax, grandTotal: totals.grandTotal };
}

async function generatePoNumber(tenantFilterValue) {
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const d = String(today.getDate()).padStart(2, '0');
  const prefix = `PO-${y}${m}${d}`;

  const last = await PurchaseOrder.findOne({
    ...tenantFilterValue,
    poNumber: { $regex: `^${prefix}-` }
  })
    .sort({ createdAt: -1 })
    .select('poNumber');

  let seq = 1;
  if (last?.poNumber) {
    const parts = last.poNumber.split('-');
    const lastSeq = Number(parts[parts.length - 1]);
    if (Number.isFinite(lastSeq)) seq = lastSeq + 1;
  }

  return `${prefix}-${String(seq).padStart(3, '0')}`;
}

router.get('/', checkPermission('supply_chain', 'read'), async (req, res) => {
  try {
    const { page = 1, limit = 25, status, supplierId, warehouseId, search, startDate, endDate, receivable } = req.query;
    
    const query = { ...req.tenantFilter };

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
        $or: [
          { nameEn: { $regex: search, $options: 'i' } },
          { nameAr: { $regex: search, $options: 'i' } },
          { code: { $regex: search, $options: 'i' } },
        ],
      }).select('_id');
      query.$or = [
        { poNumber: { $regex: search, $options: 'i' } },
        { supplierId: { $in: matchingSuppliers.map((s) => s._id) } },
      ];
    }

    const purchaseOrders = await PurchaseOrder.find(query)
      .populate('supplierId', 'code nameEn nameAr')
      .populate('warehouseId', 'code nameEn nameAr')
      .sort({ orderDate: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await PurchaseOrder.countDocuments(query);

    res.json({
      purchaseOrders,
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
    const stats = await PurchaseOrder.aggregate([
      { $match: req.tenantFilter },
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
    const matchQuery = { ...req.tenantFilter };

    if (supplierId) matchQuery.supplierId = new mongoose.Types.ObjectId(supplierId);
    if (warehouseId) matchQuery.warehouseId = new mongoose.Types.ObjectId(warehouseId);

    if (startDate || endDate) {
      matchQuery.orderDate = {};
      if (startDate) matchQuery.orderDate.$gte = new Date(startDate);
      if (endDate) matchQuery.orderDate.$lte = new Date(endDate);
    }

    const [pos, summaryAgg, monthlyAgg, statusAgg] = await Promise.all([
      PurchaseOrder.find(matchQuery)
        .populate('supplierId', 'code nameEn nameAr phone email')
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

router.get('/:id', checkPermission('supply_chain', 'read'), async (req, res) => {
  try {
    const order = await PurchaseOrder.findOne({ _id: req.params.id, ...req.tenantFilter })
      .populate('supplierId', 'code nameEn nameAr phone email vatNumber crNumber address contactPerson')
      .populate('warehouseId', 'code nameEn nameAr')
      .populate('lineItems.productId', 'sku nameEn nameAr barcode unitOfMeasure productType')
      .populate('receiving.warehouseId', 'code nameEn nameAr');

    if (!order) {
      return res.status(404).json({ error: 'Purchase order not found' });
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
    payload.related = { grns, returns, landedCosts, invoices };
    payload.receivingLedger = buildPoReceivingLedger({ lineItems: payload.lineItems, grns });
    res.json(payload);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', checkTrialLimits('purchaseOrders'), checkPermission('supply_chain', 'create'), async (req, res) => {
  try {
    if (!req.user.tenantId) {
      return res.status(400).json({ error: 'No tenant associated with user' });
    }

    const supplier = await Supplier.findOne({ _id: req.body.supplierId, ...req.tenantFilter, isActive: true });
    if (!supplier) {
      return res.status(400).json({ error: 'Invalid supplier' });
    }

    if (req.body.warehouseId) {
      const warehouse = await Warehouse.findOne({ _id: req.body.warehouseId, ...req.tenantFilter, isActive: true });
      if (!warehouse) {
        return res.status(400).json({ error: 'Invalid warehouse' });
      }
    }

    const poNumber = req.body.poNumber || (await generatePoNumber(req.tenantFilter));

    const { normalized, subtotal, totalTax, grandTotal } = normalizeLineItems(req.body.lineItems);

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
      status: body.status && body.status !== 'draft' ? body.status : 'approved',
    };

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
    res.status(201).json(order);
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(400).json({ error: 'Duplicate purchase order number' });
    }
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', checkPermission('supply_chain', 'update'), async (req, res) => {
  try {
    const existing = await PurchaseOrder.findOne({ _id: req.params.id, ...req.tenantFilter });
    if (!existing) {
      return res.status(404).json({ error: 'Purchase order not found' });
    }

    if (['received', 'cancelled', 'partially_received'].includes(existing.status)) {
      return res.status(400).json({ error: 'Cannot update this purchase order' });
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
      const { normalized, subtotal, totalTax, grandTotal } = normalizeLineItems(body.lineItems);
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
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/approve', checkPermission('supply_chain', 'approve'), async (req, res) => {
  try {
    const order = await PurchaseOrder.findOne({ _id: req.params.id, ...req.tenantFilter });
    if (!order) {
      return res.status(404).json({ error: 'Purchase order not found' });
    }

    if (order.status === 'cancelled') {
      return res.status(400).json({ error: 'Cannot approve a cancelled order' });
    }

    order.status = 'approved';
    order.approvedBy = req.user._id;
    order.approvedAt = new Date();
    await order.save();

    res.json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/send', checkPermission('supply_chain', 'update'), async (req, res) => {
  try {
    const order = await PurchaseOrder.findOne({ _id: req.params.id, ...req.tenantFilter });
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
    const order = await PurchaseOrder.findOne({ _id: req.params.id, ...req.tenantFilter });
    if (!order) {
      return res.status(404).json({ error: 'Purchase order not found' });
    }

    if (order.status === 'received') {
      return res.status(400).json({ error: 'Cannot cancel a received order' });
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

    const order = await PurchaseOrder.findOne({ _id: req.params.id, ...req.tenantFilter });
    if (!order) {
      return res.status(404).json({ error: 'Purchase order not found' });
    }
    if (order.status === 'cancelled') {
      return res.status(400).json({ error: 'Cannot receive against a cancelled order' });
    }

    const resolvedWarehouseId = warehouseId || order.warehouseId;
    if (resolvedWarehouseId) {
      const warehouse = await Warehouse.findOne({ _id: resolvedWarehouseId, ...req.tenantFilter, isActive: true });
      if (!warehouse) {
        return res.status(400).json({ error: 'Warehouse not found' });
      }
    }

    const lines = [];
    for (const item of items) {
      const productId = item.productId;
      const qty = toNumber(item.quantity ?? item.qty, 0);
      if (!productId || qty <= 0) continue;
      const line = order.lineItems.find((li) => li.productId?.toString() === productId.toString());
      if (!line) {
        return res.status(400).json({ error: 'Invalid item in receive list' });
      }
      lines.push({
        productId,
        productName: line.manualName || '',
        productType: line.productType || 'goods',
        uom: line.uom || '',
        quantityOrdered: line.quantityOrdered,
        quantityReceived: qty,
        costPrice: line.unitCost,
      });
    }

    if (!lines.length) {
      return res.status(400).json({ error: 'No valid receiving items' });
    }

    const grn = new GRN({
      tenantId: req.user.tenantId,
      grnNumber: await generateGrnNumber(req.tenantFilter),
      supplierId: order.supplierId,
      purchaseOrderId: order._id,
      warehouseId: resolvedWarehouseId || undefined,
      notes,
      createdBy: req.user._id,
      receivedBy: req.user._id,
      status: 'draft',
      lines,
    });
    await grn.save();
    await confirmGrnReceive({
      tenantFilter: req.tenantFilter,
      user: req.user,
      grn,
      warehouseId: resolvedWarehouseId,
    });

    const refreshed = await PurchaseOrder.findOne({ _id: order._id, ...req.tenantFilter });
    res.json({ ...refreshed.toObject(), grnId: grn._id, grnNumber: grn.grnNumber });
  } catch (error) {
    if (error instanceof PurchasesValidationError) {
      return res.status(400).json({ error: error.message, code: error.code });
    }
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/attachments', checkPermission('supply_chain', 'update'), vendorBillUpload.single('file'), async (req, res) => {
  try {
    const order = await PurchaseOrder.findOne({ _id: req.params.id, ...req.tenantFilter });
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
    const order = await PurchaseOrder.findOne({ _id: req.params.id, ...req.tenantFilter }).select('attachments');
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

router.post('/:id/payment', checkPermission('supply_chain', 'update'), async (req, res) => {
  try {
    const order = await PurchaseOrder.findOne({ _id: req.params.id, ...req.tenantFilter });
    if (!order) return res.status(404).json({ error: 'Purchase order not found' });
    
    const amount = Number(req.body.amount || 0);
    if (amount <= 0) return res.status(400).json({ error: 'Valid amount is required' });

    const payment = {
      amount,
      date: req.body.date ? new Date(req.body.date) : new Date(),
      method: req.body.method || 'transfer',
      reference: req.body.reference || '',
      recordedBy: req.user._id
    };

    order.payments = [...(order.payments || []), payment];
    order.paidAmount = (order.paidAmount || 0) + amount;
    order.balanceDue = Math.max(0, order.grandTotal - order.paidAmount);
    
    if (order.paidAmount >= order.grandTotal) {
      order.paymentStatus = 'paid';
    } else if (order.paidAmount > 0) {
      order.paymentStatus = 'partial';
    } else {
      order.paymentStatus = 'pending';
    }

    await order.save();
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
