import express from 'express';
import PurchaseOrder from '../models/PurchaseOrder.js';
import Supplier from '../models/Supplier.js';
import Product from '../models/Product.js';
import Warehouse from '../models/Warehouse.js';
import { protect, tenantFilter, checkPermission, requireBusinessType, requireTenantFilter } from '../middleware/auth.js';
import { checkTrialLimits } from '../middleware/trialLimits.js';

const router = express.Router();

router.use(protect);
router.use(tenantFilter);
router.use(requireTenantFilter);

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

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
      quantityOrdered,
      quantityReceived,
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
    const { page = 1, limit = 25, status, supplierId, search, startDate, endDate } = req.query;

    const query = { ...req.tenantFilter };

    if (status) query.status = status;
    if (supplierId) query.supplierId = supplierId;

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
      .populate('lineItems.productId', 'sku nameEn nameAr barcode unitOfMeasure')
      .populate('receiving.warehouseId', 'code nameEn nameAr');

    if (!order) {
      return res.status(404).json({ error: 'Purchase order not found' });
    }

    res.json(order);
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
    const { warehouseId, items } = req.body;

    if (!warehouseId) {
      return res.status(400).json({ error: 'warehouseId is required' });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'items is required' });
    }

    const warehouse = await Warehouse.findOne({ _id: warehouseId, ...req.tenantFilter, isActive: true });
    if (!warehouse) {
      return res.status(400).json({ error: 'Warehouse not found' });
    }

    const order = await PurchaseOrder.findOne({ _id: req.params.id, ...req.tenantFilter });
    if (!order) {
      return res.status(404).json({ error: 'Purchase order not found' });
    }

    if (order.status === 'cancelled') {
      return res.status(400).json({ error: 'Cannot receive against a cancelled order' });
    }

    const receivingItems = [];

    for (const item of items) {
      const productId = item.productId;
      const qty = toNumber(item.quantity ?? item.qty, 0);

      if (!productId || !qty || qty <= 0) continue;

      const line = order.lineItems.find((li) => li.productId?.toString() === productId.toString());
      if (!line) {
        return res.status(400).json({ error: 'Invalid item in receive list' });
      }

      const remaining = Math.max(0, toNumber(line.quantityOrdered, 0) - toNumber(line.quantityReceived, 0));
      if (qty > remaining) {
        return res.status(400).json({ error: 'Received quantity exceeds remaining quantity' });
      }

      const product = await Product.findOne({ _id: productId, ...req.tenantFilter });
      if (!product) {
        return res.status(400).json({ error: 'Product not found' });
      }

      product.updateStock(warehouseId, qty);
      if (toNumber(line.unitCost, 0) > 0) {
        product.calculateLandedCost({
          purchasePrice: toNumber(line.unitCost, 0),
          quantity: qty,
          purchaseOrderId: order._id
        });
      }
      await product.save();

      line.quantityReceived = toNumber(line.quantityReceived, 0) + qty;
      receivingItems.push({ productId, quantity: qty });
    }

    if (receivingItems.length === 0) {
      return res.status(400).json({ error: 'No valid receiving items' });
    }

    order.receiving.push({
      receivedAt: new Date(),
      warehouseId,
      receivedBy: req.user._id,
      items: receivingItems
    });

    const fullyReceived = order.lineItems.every(
      (li) => toNumber(li.quantityReceived, 0) >= toNumber(li.quantityOrdered, 0)
    );
    order.status = fullyReceived ? 'received' : 'partially_received';

    await order.save();

    res.json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
