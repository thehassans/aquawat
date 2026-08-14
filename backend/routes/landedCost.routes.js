import express from 'express';
import mongoose from 'mongoose';
import LandedCost from '../models/LandedCost.js';
import Shipment from '../models/Shipment.js';
import PurchaseOrder from '../models/PurchaseOrder.js';
import { protect, tenantFilter, checkPermission, requireBusinessType, requireTenantFilter } from '../middleware/auth.js';

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

async function allocationsFromLinks(shipmentId, purchaseOrderId, tenantFilterValue) {
  const allocations = [];
  let vendor = '';
  let resolvedPoId = purchaseOrderId;
  let resolvedShipmentId = shipmentId;

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

  return { allocations, vendor, purchaseOrder: resolvedPoId, shipment: resolvedShipmentId };
}

function sanitizeLandedCostBody(body) {
  const next = { ...body };
  next.purchaseOrder = asObjectId(body.purchaseOrder);
  next.shipment = asObjectId(body.shipment);
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
        .populate('shipment', 'shipmentNumber'),
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
    if (!hasAllocations && (payload.shipment || payload.purchaseOrder)) {
      const linked = await allocationsFromLinks(payload.shipment, payload.purchaseOrder, req.tenantFilter);
      payload.allocations = linked.allocations;
      if (!payload.vendor) payload.vendor = linked.vendor;
      if (!payload.purchaseOrder && linked.purchaseOrder) payload.purchaseOrder = linked.purchaseOrder;
      if (!payload.shipment && linked.shipment) payload.shipment = linked.shipment;
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
      .populate('shipment');
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

    const totalCost = lc.totalCost || 0;
    const allocations = lc.allocations || [];

    if (allocations.length === 0) {
      return res.status(400).json({ error: 'No allocation lines to calculate' });
    }

    // Determine the total basis for the chosen allocation method
    let totalBasis = 0;
    if (lc.allocationMethod === 'by_value') {
      totalBasis = allocations.reduce((s, a) => s + (a.lineValue || 0), 0);
    } else if (lc.allocationMethod === 'by_weight') {
      totalBasis = allocations.reduce((s, a) => s + (a.weight || 0), 0);
    } else if (lc.allocationMethod === 'by_quantity') {
      totalBasis = allocations.reduce((s, a) => s + (a.quantity || 0), 0);
    } else {
      // equal
      totalBasis = allocations.length;
    }

    lc.allocations = allocations.map((alloc, idx) => {
      let basis = 0;
      if (lc.allocationMethod === 'by_value') basis = alloc.lineValue || 0;
      else if (lc.allocationMethod === 'by_weight') basis = alloc.weight || 0;
      else if (lc.allocationMethod === 'by_quantity') basis = alloc.quantity || 0;
      else basis = 1; // equal

      const ratio = totalBasis > 0 ? basis / totalBasis : 1 / allocations.length;
      const allocatedCost = totalCost * ratio;
      const qty = alloc.quantity || 1;
      const unitLandedCost = allocatedCost / qty;
      const totalLandedUnitCost = (alloc.unitCostBeforeLanded || 0) + unitLandedCost;

      return {
        ...alloc.toObject ? alloc.toObject() : alloc,
        allocatedCost: Math.round(allocatedCost * 100) / 100,
        unitLandedCost: Math.round(unitLandedCost * 100) / 100,
        totalLandedUnitCost: Math.round(totalLandedUnitCost * 100) / 100
      };
    });

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
    lc.status = 'posted';
    lc.postedAt = new Date();
    lc.postedBy = req.user._id;
    await lc.save();
    res.json(lc);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
