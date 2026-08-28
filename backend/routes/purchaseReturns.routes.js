import express from 'express';
import { protect, tenantFilter, requireTenantFilter, checkPermission } from '../middleware/auth.js';
import { checkTrialLimits } from '../middleware/trialLimits.js';
import PurchaseReturn from '../models/PurchaseReturn.js';
import GRN from '../models/GRN.js';
import { normalizeProductType } from '../utils/productType.js';
import {
  generateReturnNumber,
  confirmPurchaseReturn,
  cancelPurchaseReturn,
  resolveWarehouse,
  PurchasesValidationError,
} from '../services/purchasesWorkflow.js';
import { remainingReturnable, toNumber } from '../services/purchasesLogic.js';

const router = express.Router();
router.use(protect);
router.use(tenantFilter);
router.use(requireTenantFilter);

function handlePurchasesError(res, error) {
  if (error instanceof PurchasesValidationError) {
    return res.status(400).json({ error: error.message, code: error.code });
  }
  return res.status(500).json({ error: error.message });
}

function normalizeReturnLines(lines = [], costMap = {}) {
  return (Array.isArray(lines) ? lines : []).map((line) => {
    const qty = toNumber(line.quantityReturned ?? line.quantity, 0);
    const unitCost = costMap[String(line.productId)] || 0;
    return {
      productId: line.productId || undefined,
      variantId: line.variantId || undefined,
      productName: line.productName || '',
      barcode: line.barcode || '',
      productType: normalizeProductType(line.productType),
      quantityReturned: qty,
      unitCost: unitCost,
      lineTotal: qty * unitCost,
      reason: line.reason || '',
      notes: line.notes || '',
      grnLineIndex: line.grnLineIndex,
    };
  });
}

router.get('/', checkPermission('supply_chain', 'read'), async (req, res) => {
  try {
    const { status, supplierId, warehouseId, search } = req.query;
    const query = { tenantId: req.user.tenantId };
    if (status) query.status = status;
    if (supplierId) query.supplierId = supplierId;
    if (warehouseId) query.warehouseId = warehouseId;
    if (search) {
      query.$or = [
        { returnNumber: { $regex: search, $options: 'i' } },
        { referenceNumber: { $regex: search, $options: 'i' } },
        { notes: { $regex: search, $options: 'i' } },
      ];
    }
    const returns = await PurchaseReturn.find(query)
      .populate('supplierId', 'nameEn nameAr')
      .populate('warehouseId', 'code nameEn nameAr')
      .populate('purchaseOrderId', 'poNumber')
      .populate('grnId', 'grnNumber')
      .sort('-createdAt');
    res.json(returns);
  } catch (error) {
    handlePurchasesError(res, error);
  }
});

router.get('/from-grn/:grnId', checkPermission('supply_chain', 'read'), async (req, res) => {
  try {
    const grn = await GRN.findOne({ _id: req.params.grnId, tenantId: req.user.tenantId })
      .populate('supplierId', 'nameEn nameAr')
      .populate('warehouseId', 'code nameEn nameAr')
      .populate('purchaseOrderId', 'poNumber');
    if (!grn) return res.status(404).json({ error: 'GRN not found' });
    
    // Attempt to fetch unit cost from PO if it exists
    let costMap = {};
    if (grn.purchaseOrderId) {
      import('../models/PurchaseOrder.js').then(({ default: PurchaseOrder }) => {
        PurchaseOrder.findById(grn.purchaseOrderId).then((po) => {
          if (po) po.lineItems.forEach(li => costMap[String(li.productId)] = li.unitCost || 0);
        });
      }).catch(() => {});
    }

    const lines = (grn.lines || []).map((line, index) => ({
      productId: line.productId,
      variantId: line.variantId || undefined,
      productName: line.productName,
      barcode: line.barcode,
      productType: line.productType || 'goods',
      quantityReceived: line.quantityReceived,
      quantityReturned: line.quantityReturned || 0,
      remaining: remainingReturnable(line),
      grnLineIndex: index,
    })).filter((line) => line.remaining > 0);
    res.json({
      grn,
      warehouseId: grn.warehouseId?._id || grn.warehouseId,
      supplierId: grn.supplierId?._id || grn.supplierId,
      purchaseOrderId: grn.purchaseOrderId?._id || grn.purchaseOrderId,
      lines,
    });
  } catch (error) {
    handlePurchasesError(res, error);
  }
});

router.post('/', checkTrialLimits('purchaseReturns'), checkPermission('supply_chain', 'create'), async (req, res) => {
  try {
    const {
      supplierId,
      warehouseId,
      purchaseOrderId,
      grnId,
      referenceNumber,
      lines,
      notes,
      reason,
      status = 'draft',
    } = req.body;

    if (!supplierId) return res.status(400).json({ error: 'supplierId is required' });

    let grn = null;
    if (grnId) {
      grn = await GRN.findOne({ _id: grnId, tenantId: req.user.tenantId });
      if (!grn) return res.status(400).json({ error: 'Invalid GRN' });
    }

    const resolvedWarehouseId = warehouseId || grn?.warehouseId;
    if (resolvedWarehouseId) {
      const warehouse = await resolveWarehouse(req.tenantFilter, resolvedWarehouseId);
      if (!warehouse) return res.status(400).json({ error: 'Warehouse not found' });
    }

    const actualPoId = purchaseOrderId || grn?.purchaseOrderId;
    let costMap = {};
    if (actualPoId) {
      const { default: PurchaseOrder } = await import('../models/PurchaseOrder.js');
      const po = await PurchaseOrder.findOne({ _id: actualPoId, tenantId: req.user.tenantId });
      if (po && po.lineItems) {
        po.lineItems.forEach(li => { costMap[String(li.productId)] = li.unitCost || 0; });
      }
    }

    const normalized = normalizeReturnLines(lines, costMap).filter((line) => line.quantityReturned > 0);
    if (!normalized.length) return res.status(400).json({ error: 'At least one return line is required' });

    const returnAmount = normalized.reduce((sum, line) => sum + (line.lineTotal || 0), 0);

    const purchaseReturn = new PurchaseReturn({
      tenantId: req.user.tenantId,
      returnNumber: await generateReturnNumber(req.tenantFilter),
      supplierId,
      warehouseId: resolvedWarehouseId || undefined,
      purchaseOrderId: actualPoId || undefined,
      grnId: grnId || undefined,
      referenceNumber,
      notes,
      reason,
      createdBy: req.user._id,
      returnedBy: req.user._id,
      status: status === 'completed' ? 'draft' : (status || 'draft'),
      returnAmount,
      lines: normalized,
    });
    await purchaseReturn.save();

    if (status === 'completed' || req.body.confirm === true) {
      await confirmPurchaseReturn({ tenantFilter: req.tenantFilter, user: req.user, purchaseReturn });
    }

    const saved = await PurchaseReturn.findOne({ _id: purchaseReturn._id, tenantId: req.user.tenantId })
      .populate('supplierId', 'nameEn nameAr')
      .populate('warehouseId', 'code nameEn nameAr')
      .populate('grnId', 'grnNumber')
      .populate('purchaseOrderId', 'poNumber');
    res.status(201).json(saved);
  } catch (error) {
    handlePurchasesError(res, error);
  }
});

router.get('/:id', checkPermission('supply_chain', 'read'), async (req, res) => {
  try {
    const purchaseReturn = await PurchaseReturn.findOne({ _id: req.params.id, tenantId: req.user.tenantId })
      .populate('supplierId', 'nameEn nameAr email phone')
      .populate('warehouseId', 'code nameEn nameAr')
      .populate('purchaseOrderId', 'poNumber')
      .populate('grnId', 'grnNumber')
      .populate('returnedBy', 'firstName lastName name');
    if (!purchaseReturn) return res.status(404).json({ error: 'Purchase Return not found' });
    res.json(purchaseReturn);
  } catch (error) {
    handlePurchasesError(res, error);
  }
});

router.put('/:id', checkPermission('supply_chain', 'update'), async (req, res) => {
  try {
    const purchaseReturn = await PurchaseReturn.findOne({ _id: req.params.id, tenantId: req.user.tenantId });
    if (!purchaseReturn) return res.status(404).json({ error: 'Purchase Return not found' });
    if (purchaseReturn.status !== 'draft') {
      return res.status(400).json({ error: 'Only draft returns can be edited' });
    }
    const { supplierId, warehouseId, referenceNumber, notes, reason, lines, grnId, purchaseOrderId } = req.body;
    if (supplierId) purchaseReturn.supplierId = supplierId;
    if (warehouseId !== undefined) purchaseReturn.warehouseId = warehouseId || undefined;
    if (referenceNumber !== undefined) purchaseReturn.referenceNumber = referenceNumber;
    if (notes !== undefined) purchaseReturn.notes = notes;
    if (reason !== undefined) purchaseReturn.reason = reason;
    if (grnId !== undefined) purchaseReturn.grnId = grnId || undefined;
    if (purchaseOrderId !== undefined) purchaseReturn.purchaseOrderId = purchaseOrderId || undefined;
    
    if (Array.isArray(lines)) {
      const actualPoId = purchaseReturn.purchaseOrderId || (purchaseReturn.grnId ? (await GRN.findById(purchaseReturn.grnId))?.purchaseOrderId : null);
      let costMap = {};
      if (actualPoId) {
        const { default: PurchaseOrder } = await import('../models/PurchaseOrder.js');
        const po = await PurchaseOrder.findOne({ _id: actualPoId, tenantId: req.user.tenantId });
        if (po && po.lineItems) po.lineItems.forEach(li => { costMap[String(li.productId)] = li.unitCost || 0; });
      }
      purchaseReturn.lines = normalizeReturnLines(lines, costMap);
      purchaseReturn.returnAmount = purchaseReturn.lines.reduce((sum, line) => sum + (line.lineTotal || 0), 0);
    }
    
    await purchaseReturn.save();
    res.json(purchaseReturn);
  } catch (error) {
    handlePurchasesError(res, error);
  }
});

router.post('/:id/confirm', checkPermission('supply_chain', 'update'), async (req, res) => {
  try {
    const purchaseReturn = await PurchaseReturn.findOne({ _id: req.params.id, tenantId: req.user.tenantId });
    if (!purchaseReturn) return res.status(404).json({ error: 'Purchase Return not found' });
    if (purchaseReturn.status === 'cancelled') {
      return res.status(400).json({ error: 'Cannot confirm a cancelled return' });
    }
    await confirmPurchaseReturn({ tenantFilter: req.tenantFilter, user: req.user, purchaseReturn });
    res.json(purchaseReturn);
  } catch (error) {
    handlePurchasesError(res, error);
  }
});

router.post('/:id/cancel', checkPermission('supply_chain', 'update'), async (req, res) => {
  try {
    const purchaseReturn = await PurchaseReturn.findOne({ _id: req.params.id, tenantId: req.user.tenantId });
    if (!purchaseReturn) return res.status(404).json({ error: 'Purchase Return not found' });
    await cancelPurchaseReturn({ tenantFilter: req.tenantFilter, user: req.user, purchaseReturn });
    res.json(purchaseReturn);
  } catch (error) {
    handlePurchasesError(res, error);
  }
});

export default router;
