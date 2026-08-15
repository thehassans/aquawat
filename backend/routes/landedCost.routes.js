import express from 'express';
import mongoose from 'mongoose';
import LandedCost from '../models/LandedCost.js';
import Shipment from '../models/Shipment.js';
import PurchaseOrder from '../models/PurchaseOrder.js';
import GRN from '../models/GRN.js';
import { protect, tenantFilter, checkPermission, requireBusinessType, requireTenantFilter } from '../middleware/auth.js';
import { allocateLandedCosts, applyLandedCostToProducts } from '../services/purchasesWorkflow.js';

const router = express.Router();

router.use(protect);
router.use(tenantFilter);
router.use(requireTenantFilter);
router.use(requireBusinessType('trading', 'bakala', 'pharmacy', 'furniture_shop'));

function asObjectId(value) {
  if (!value) return undefined;
  const raw = typeof value === 'object' && value._id ? value._id : value;
  const s = String(raw);
  if (mongoose.Types.ObjectId.isValid(s) && String(new mongoose.Types.ObjectId(s)) === s) return s;
  return undefined;
}

function productLabel(product, fallback = '') {
  if (!product || typeof product !== 'object') return fallback;
  return product.nameEn || product.nameAr || fallback;
}

async function allocationsFromLinks(shipmentId, purchaseOrderId, grnIds, tenantFilterValue) {
  const allocations = [];
  let vendor = '';
  let resolvedPoId = purchaseOrderId;
  let resolvedShipmentId = shipmentId;
  const resolvedGrnIds = Array.isArray(grnIds) ? grnIds.filter(Boolean) : (grnIds ? [grnIds] : []);

  if (resolvedGrnIds.length) {
    const grns = await GRN.find({ _id: { $in: resolvedGrnIds }, ...tenantFilterValue })
      .populate('supplierId', 'nameEn nameAr')
      .populate('purchaseOrderId');
    for (const grn of grns) {
      if (!resolvedPoId && grn.purchaseOrderId) {
        resolvedPoId = grn.purchaseOrderId._id || grn.purchaseOrderId;
      }
      if (!vendor) vendor = grn.supplierId?.nameEn || grn.supplierId?.nameAr || '';
      for (const line of grn.lines || []) {
        if (line.productType === 'service') continue;
        const qty = line.quantityReceived || 0;
        const unit = line.costPrice || 0;
        allocations.push({
          productId: line.productId || undefined,
          productName: line.productName || '',
          productCode: line.barcode || '',
          quantity: qty,
          unitCostBeforeLanded: unit,
          weight: 0,
          lineValue: qty * unit
        });
      }
    }
  }

  if (shipmentId) {
    const shipment = await Shipment.findOne({ _id: shipmentId, ...tenantFilterValue, isActive: true })
      .populate('lineItems.productId', 'sku nameEn nameAr')
      .populate('purchaseOrderId')
      .populate('supplierId', 'nameEn nameAr');
    if (shipment) {
      resolvedShipmentId = shipment._id;
      if (!resolvedPoId && shipment.purchaseOrderId) {
        resolvedPoId = shipment.purchaseOrderId._id || shipment.purchaseOrderId;
      }
      vendor = shipment.supplierId?.nameEn || shipment.supplierId?.nameAr || '';
      if (allocations.length === 0) {
        for (const line of shipment.lineItems || []) {
          const p = line.productId && typeof line.productId === 'object' ? line.productId : null;
          allocations.push({
            productId: p?._id || line.productId || undefined,
            productName: productLabel(p, line.description || ''),
            productCode: p?.sku || '',
            quantity: line.quantity || 0,
            unitCostBeforeLanded: 0,
            weight: 0,
            lineValue: 0
          });
        }
      }
    }
  }

  if (resolvedPoId) {
    const po = await PurchaseOrder.findOne({ _id: resolvedPoId, ...tenantFilterValue })
      .populate('lineItems.productId', 'sku nameEn nameAr')
      .populate('supplierId', 'nameEn nameAr');
    if (po) {
      if (!vendor) vendor = po.supplierId?.nameEn || po.supplierId?.nameAr || '';
      const byProduct = new Map();
      for (const line of po.lineItems || []) {
        const pid = String(line.productId?._id || line.productId || line.manualName || '');
        if (pid) byProduct.set(pid, line);
      }
      if (allocations.length === 0) {
        for (const line of po.lineItems || []) {
          const p = line.productId && typeof line.productId === 'object' ? line.productId : null;
          const qty = line.quantityOrdered || 0;
          const unit = line.unitCost || 0;
          allocations.push({
            productId: p?._id || line.productId || undefined,
            productName: productLabel(p, line.manualName || line.description || ''),
            productCode: p?.sku || '',
            quantity: qty,
            unitCostBeforeLanded: unit,
            weight: 0,
            lineValue: qty * unit
          });
        }
      } else {
        for (const alloc of allocations) {
          const pid = String(alloc.productId || '');
          const line = byProduct.get(pid);
          if (line) {
            alloc.unitCostBeforeLanded = line.unitCost || 0;
            alloc.lineValue = (Number(alloc.quantity) || 0) * (line.unitCost || 0);
            if (!alloc.productName) alloc.productName = productLabel(line.productId, line.manualName || '');
            if (!alloc.productCode) alloc.productCode = line.productId?.sku || '';
          }
        }
      }
    }
  }

  return { allocations, vendor, purchaseOrder: resolvedPoId, shipment: resolvedShipmentId, grnIds: resolvedGrnIds };
}

function sanitizeLandedCostBody(body) {
  const next = { ...body };
  next.purchaseOrder = asObjectId(body.purchaseOrder);
  next.shipment = asObjectId(body.shipment);
  const rawGrns = Array.isArray(body.grnIds) ? body.grnIds : (body.grnId ? [body.grnId] : []);
  next.grnIds = rawGrns.map(asObjectId).filter(Boolean);
  if (!next.purchaseOrder) delete next.purchaseOrder;
  if (!next.shipment) delete next.shipment;
  return next;
}

async function generateLcNumber(tenantFilterValue) {
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const d = String(today.getDate()).padStart(2, '0');
  const prefix = `LC-${y}${m}${d}`;
  const last = await LandedCost.findOne({ ...tenantFilterValue, lcNumber: { $regex: `^${prefix}-` } })
    .sort({ createdAt: -1 })
    .select('lcNumber');
  let seq = 1;
  if (last?.lcNumber) {
    const parts = last.lcNumber.split('-');
    const lastSeq = Number(parts[parts.length - 1]);
    if (Number.isFinite(lastSeq)) seq = lastSeq + 1;
  }
  return `${prefix}-${String(seq).padStart(3, '0')}`;
}

// ─── Stats ─────────────────────────────────────────────────────────────────────

router.get('/stats', checkPermission('landed_costs', 'read'), async (req, res) => {
  try {
    const startOfYear = new Date(new Date().getFullYear(), 0, 1);

    const [ytdAgg, statusAgg, dutyAgg] = await Promise.all([
      LandedCost.aggregate([
        { $match: { ...req.tenantFilter, isActive: true, status: 'posted', createdAt: { $gte: startOfYear } } },
        { $group: { _id: null, total: { $sum: '$totalCost' } } }
      ]),
      LandedCost.aggregate([
        { $match: { ...req.tenantFilter, isActive: true } },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      LandedCost.aggregate([
        { $match: { ...req.tenantFilter, isActive: true, status: 'posted' } },
        { $unwind: '$costLines' },
        { $match: { 'costLines.type': 'customs_duty' } },
        { $group: { _id: null, totalDuty: { $sum: '$costLines.amountSAR' }, totalCost: { $sum: '$totalCost' } } }
      ])
    ]);

    const statusMap = {};
    (statusAgg || []).forEach(s => { statusMap[s._id] = s.count; });
    const totalDuty = dutyAgg[0]?.totalDuty || 0;
    const totalCostForDuty = dutyAgg[0]?.totalCost || 0;
    const avgDutyRate = totalCostForDuty > 0 ? ((totalDuty / totalCostForDuty) * 100).toFixed(2) : 0;

    res.json({
      totalLandedCostsYTD: ytdAgg[0]?.total || 0,
      avgDutyRate: parseFloat(avgDutyRate),
      pendingCount: (statusMap['draft'] || 0) + (statusMap['calculated'] || 0),
      postedCount: statusMap['posted'] || 0
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── List / Create ─────────────────────────────────────────────────────────────

router.get('/', checkPermission('landed_costs', 'read'), async (req, res) => {
  try {
    const { page = 1, limit = 25, status, search } = req.query;
    const query = { ...req.tenantFilter, isActive: true };

    if (status) query.status = status;
    if (search) {
      query.$or = [
        { lcNumber: { $regex: search, $options: 'i' } },
        { vendor: { $regex: search, $options: 'i' } },
        { referenceNumber: { $regex: search, $options: 'i' } }
      ];
    }

    const [landedCosts, total] = await Promise.all([
      LandedCost.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit))
        .populate('purchaseOrder', 'poNumber')
        .populate('shipment', 'shipmentNumber')
        .populate('grnIds', 'grnNumber'),
      LandedCost.countDocuments(query)
    ]);

    res.json({ landedCosts, pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', checkPermission('landed_costs', 'create'), async (req, res) => {
  try {
    const lcNumber = req.body.lcNumber || (await generateLcNumber(req.tenantFilter));
    const payload = sanitizeLandedCostBody(req.body);
    const hasAllocations = Array.isArray(payload.allocations) && payload.allocations.some((a) => a?.productName || a?.productId || a?.quantity);
    if (!hasAllocations && (payload.shipment || payload.purchaseOrder || (payload.grnIds || []).length)) {
      const linked = await allocationsFromLinks(payload.shipment, payload.purchaseOrder, payload.grnIds, req.tenantFilter);
      payload.allocations = linked.allocations;
      if (!payload.vendor) payload.vendor = linked.vendor;
      if (!payload.purchaseOrder && linked.purchaseOrder) payload.purchaseOrder = linked.purchaseOrder;
      if (!payload.shipment && linked.shipment) payload.shipment = linked.shipment;
      if ((!payload.grnIds || !payload.grnIds.length) && linked.grnIds?.length) payload.grnIds = linked.grnIds;
    }
    const lc = new LandedCost({
      ...payload,
      lcNumber,
      tenantId: req.user.tenantId,
      createdBy: req.user._id
    });
    await lc.save();
    res.status(201).json(lc);
  } catch (error) {
    if (error?.code === 11000) return res.status(400).json({ error: 'Duplicate LC number' });
    res.status(500).json({ error: error.message });
  }
});

// ─── Single ────────────────────────────────────────────────────────────────────

router.get('/:id', checkPermission('landed_costs', 'read'), async (req, res) => {
  try {
    const lc = await LandedCost.findOne({ _id: req.params.id, ...req.tenantFilter })
      .populate('purchaseOrder')
      .populate('shipment')
      .populate('grnIds', 'grnNumber status');
    if (!lc) return res.status(404).json({ error: 'Landed cost not found' });
    res.json(lc);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', checkPermission('landed_costs', 'update'), async (req, res) => {
  try {
    const lc = await LandedCost.findOne({ _id: req.params.id, ...req.tenantFilter });
    if (!lc) return res.status(404).json({ error: 'Landed cost not found' });
    if (lc.status === 'posted') return res.status(400).json({ error: 'Cannot edit a posted landed cost' });
    if (lc.status === 'cancelled') return res.status(400).json({ error: 'Cannot edit a cancelled landed cost' });
    Object.assign(lc, sanitizeLandedCostBody(req.body));
    await lc.save();
    res.json(lc);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', checkPermission('landed_costs', 'delete'), async (req, res) => {
  try {
    const lc = await LandedCost.findOneAndUpdate(
      { _id: req.params.id, ...req.tenantFilter },
      { isActive: false },
      { new: true }
    );
    if (!lc) return res.status(404).json({ error: 'Landed cost not found' });
    res.json({ message: 'Landed cost deactivated', lc });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── Calculate Allocation ──────────────────────────────────────────────────────

router.post('/:id/calculate', checkPermission('landed_costs', 'update'), async (req, res) => {
  try {
    const lc = await LandedCost.findOne({ _id: req.params.id, ...req.tenantFilter });
    if (!lc) return res.status(404).json({ error: 'Landed cost not found' });
    if (lc.status === 'posted') return res.status(400).json({ error: 'Cannot recalculate a posted landed cost' });
    if (lc.status === 'cancelled') return res.status(400).json({ error: 'Cannot recalculate a cancelled landed cost' });

    const totalCost = lc.totalCost || 0;
    const { allocations } = allocateLandedCosts({
      totalCost,
      allocations: (lc.allocations || []).map((row) => (row.toObject ? row.toObject() : row)),
      method: lc.allocationMethod || 'by_value',
    });

    if (allocations.length === 0) {
      return res.status(400).json({ error: 'No allocation lines to calculate' });
    }

    lc.allocations = allocations;
    lc.status = 'calculated';
    await lc.save();
    res.json(lc);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── Post ──────────────────────────────────────────────────────────────────────

router.post('/:id/post', checkPermission('landed_costs', 'update'), async (req, res) => {
  try {
    const lc = await LandedCost.findOne({ _id: req.params.id, ...req.tenantFilter });
    if (!lc) return res.status(404).json({ error: 'Landed cost not found' });
    if (lc.status !== 'calculated') return res.status(400).json({ error: 'Only calculated landed costs can be posted' });
    await applyLandedCostToProducts({ tenantFilter: req.tenantFilter, landedCost: lc });
    lc.status = 'posted';
    lc.postedAt = new Date();
    lc.postedBy = req.user._id;
    await lc.save();
    res.json(lc);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/cancel', checkPermission('landed_costs', 'update'), async (req, res) => {
  try {
    const lc = await LandedCost.findOne({ _id: req.params.id, ...req.tenantFilter });
    if (!lc) return res.status(404).json({ error: 'Landed cost not found' });
    if (lc.status === 'posted') return res.status(400).json({ error: 'Posted landed costs cannot be cancelled' });
    lc.status = 'cancelled';
    lc.cancelledAt = new Date();
    await lc.save();
    res.json(lc);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
