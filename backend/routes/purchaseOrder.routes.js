import express from 'express';
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
import { saveUploadBuffer } from '../utils/objectStorage.js';
import { normalizeProductType } from '../utils/productType.js';
import { confirmGrnReceive, generateGrnNumber, PurchasesValidationError } from '../services/purchasesWorkflow.js';

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
  const normalized = (Array.isArray(lineItems) ? lineItems : []).map((li) => {
    const quantityOrdered = toNumber(li.quantityOrdered ?? li.quantity ?? 0, 0);
    const quantityReceived = toNumber(li.quantityReceived ?? 0, 0);
    const unitCost = toNumber(li.unitCost ?? 0, 0);
    const taxRate = toNumber(li.taxRate ?? 15, 15);

    const lineSubtotal = quantityOrdered * unitCost;
    const lineTax = lineSubtotal * (taxRate / 100);
    const lineTotal = lineSubtotal + lineTax;

    return {
      productId: li.productId || undefined,
      manualName: li.manualName || '',
      uom: li.uom || '',
      description: li.description,
      productType: normalizeProductType(li.productType),
      quantityOrdered,
      quantityReceived,
      quantityReturned: toNumber(li.quantityReturned, 0),
      unitCost,
      taxRate,
      lineSubtotal,
      lineTax,
      lineTotal
    };
  });

  const subtotal = normalized.reduce((sum, li) => sum + (li.lineSubtotal || 0), 0);
  const totalTax = normalized.reduce((sum, li) => sum + (li.lineTax || 0), 0);
  const grandTotal = subtotal + totalTax;

  return { normalized, subtotal, totalTax, grandTotal };
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
    const { page = 1, limit = 25, status, supplierId, warehouseId, search, startDate, endDate } = req.query;

    const query = { ...req.tenantFilter };

    if (status) query.status = status;
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
      GRN.find({ ...req.tenantFilter, purchaseOrderId: order._id }).select('grnNumber status dateReceived warehouseId').sort('-createdAt'),
      PurchaseReturn.find({ ...req.tenantFilter, purchaseOrderId: order._id }).select('returnNumber status dateReturned').sort('-createdAt'),
      LandedCost.find({ ...req.tenantFilter, purchaseOrder: order._id, isActive: true }).select('lcNumber status totalCost').sort('-createdAt'),
      Invoice.find({ ...req.tenantFilter, sourcePurchaseOrderId: order._id, flow: 'purchase' }).select('invoiceNumber status grandTotal issueDate').sort('-createdAt'),
    ]);

    const payload = order.toObject();
    payload.related = { grns, returns, landedCosts, invoices };
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

    const data = {
      ...req.body,
      poNumber,
      tenantId: req.user.tenantId,
      createdBy: req.user._id,
      lineItems: normalized,
      subtotal,
      totalTax,
      grandTotal
    };

    const order = await PurchaseOrder.create(data);
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

    const updateData = { ...req.body };

    if (Array.isArray(req.body.lineItems)) {
      const { normalized, subtotal, totalTax, grandTotal } = normalizeLineItems(req.body.lineItems);
      updateData.lineItems = normalized;
      updateData.subtotal = subtotal;
      updateData.totalTax = totalTax;
      updateData.grandTotal = grandTotal;
    }

    const order = await PurchaseOrder.findOneAndUpdate(
      { _id: req.params.id, ...req.tenantFilter },
      updateData,
      { new: true, runValidators: true }
    );

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

export default router;
