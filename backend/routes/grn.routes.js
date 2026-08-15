import express from 'express';
import multer from 'multer';
import GRN from '../models/GRN.js';
import PurchaseOrder from '../models/PurchaseOrder.js';
import { protect, tenantFilter, requireTenantFilter, checkPermission } from '../middleware/auth.js';
import { normalizeProductType } from '../utils/productType.js';
import {
  generateGrnNumber,
  confirmGrnReceive,
  cancelGrn,
  resolveWarehouse,
  PurchasesValidationError,
} from '../services/purchasesWorkflow.js';
import { toNumber } from '../services/purchasesLogic.js';

const router = express.Router();
router.use(protect);
router.use(tenantFilter);
router.use(requireTenantFilter);

const ALLOWED_ATTACH = new Set(['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
export const purchaseUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = ALLOWED_ATTACH.has(String(file?.mimetype || '').toLowerCase());
    cb(ok ? null : new Error('Only PDF, JPG, PNG, or WebP files are allowed'), ok);
  },
});

function handlePurchasesError(res, error) {
  if (error instanceof PurchasesValidationError) {
    return res.status(400).json({ error: error.message, code: error.code });
  }
  if (error?.message?.includes('Only PDF')) {
    return res.status(400).json({ error: error.message });
  }
  return res.status(500).json({ error: error.message });
}

function normalizeGrnLines(lines = []) {
  return (Array.isArray(lines) ? lines : []).map((line) => ({
    productId: line.productId || undefined,
    productName: line.productName || '',
    barcode: line.barcode || '',
    productType: normalizeProductType(line.productType),
    uom: line.uom || '',
    quantityOrdered: toNumber(line.quantityOrdered, 0),
    quantityReceived: toNumber(line.quantityReceived ?? line.quantity, 0),
    quantityReturned: toNumber(line.quantityReturned, 0),
    costPrice: toNumber(line.costPrice, 0),
    expiryDate: line.expiryDate || undefined,
    batchNumber: line.batchNumber || '',
    isDelayed: Boolean(line.isDelayed),
    delayedUntil: line.delayedUntil || undefined,
    delayReason: line.delayReason || '',
    notes: line.notes || '',
  }));
}

async function loadOpenPo(tenantFilter, purchaseOrderId) {
  if (!purchaseOrderId) return null;
  const po = await PurchaseOrder.findOne({ _id: purchaseOrderId, ...tenantFilter })
    .populate('supplierId', 'nameEn nameAr')
    .populate('warehouseId', 'code nameEn nameAr')
    .populate('lineItems.productId', 'sku nameEn nameAr barcode unitOfMeasure productType costPrice');
  return po;
}

router.get('/', checkPermission('supply_chain', 'read'), async (req, res) => {
  try {
    const { status, supplierId, warehouseId, purchaseOrderId, search } = req.query;
    const query = { tenantId: req.user.tenantId };
    if (status) query.status = status;
    if (supplierId) query.supplierId = supplierId;
    if (warehouseId) query.warehouseId = warehouseId;
    if (purchaseOrderId) query.purchaseOrderId = purchaseOrderId;
    if (search) {
      query.$or = [
        { grnNumber: { $regex: search, $options: 'i' } },
        { referenceNumber: { $regex: search, $options: 'i' } },
        { notes: { $regex: search, $options: 'i' } },
      ];
    }
    const grns = await GRN.find(query)
      .populate('supplierId', 'nameEn nameAr')
      .populate('purchaseOrderId', 'poNumber status warehouseId')
      .populate('warehouseId', 'code nameEn nameAr')
      .sort('-createdAt');
    res.json(grns);
  } catch (error) {
    handlePurchasesError(res, error);
  }
});

router.get('/from-po/:poId', checkPermission('supply_chain', 'read'), async (req, res) => {
  try {
    const po = await loadOpenPo(req.tenantFilter, req.params.poId);
    if (!po) return res.status(404).json({ error: 'Purchase order not found' });
    const openLines = (po.lineItems || []).map((li) => {
      const product = li.productId && typeof li.productId === 'object' ? li.productId : null;
      const ordered = toNumber(li.quantityOrdered);
      const received = toNumber(li.quantityReceived);
      return {
        productId: product?._id || li.productId,
        productName: product?.nameEn || product?.nameAr || li.manualName || '',
        barcode: product?.barcode || '',
        productType: li.productType || product?.productType || 'goods',
        uom: li.uom || product?.unitOfMeasure || '',
        quantityOrdered: ordered,
        quantityReceived: Math.max(0, ordered - received),
        remaining: Math.max(0, ordered - received),
        costPrice: li.unitCost,
      };
    }).filter((line) => line.remaining > 0);
    res.json({
      purchaseOrder: po,
      warehouseId: po.warehouseId?._id || po.warehouseId || null,
      supplierId: po.supplierId?._id || po.supplierId,
      lines: openLines,
    });
  } catch (error) {
    handlePurchasesError(res, error);
  }
});

router.post('/', checkPermission('supply_chain', 'create'), async (req, res) => {
  try {
    const {
      supplierId,
      purchaseOrderId,
      warehouseId,
      referenceNumber,
      lines,
      notes,
      expectedDate,
      status = 'draft',
    } = req.body;

    if (!supplierId) return res.status(400).json({ error: 'supplierId is required' });
    const normalized = normalizeGrnLines(lines);
    if (!normalized.length) return res.status(400).json({ error: 'At least one line is required' });

    let po = null;
    if (purchaseOrderId) {
      po = await loadOpenPo(req.tenantFilter, purchaseOrderId);
      if (!po) return res.status(400).json({ error: 'Invalid purchase order' });
    }

    const resolvedWarehouseId = warehouseId || po?.warehouseId?._id || po?.warehouseId;
    if (resolvedWarehouseId) {
      const warehouse = await resolveWarehouse(req.tenantFilter, resolvedWarehouseId);
      if (!warehouse) return res.status(400).json({ error: 'Warehouse not found' });
    }

    const grn = new GRN({
      tenantId: req.user.tenantId,
      grnNumber: await generateGrnNumber(req.tenantFilter),
      supplierId,
      purchaseOrderId: purchaseOrderId || undefined,
      warehouseId: resolvedWarehouseId || undefined,
      referenceNumber,
      notes,
      expectedDate,
      createdBy: req.user._id,
      receivedBy: req.user._id,
      status: status === 'received' ? 'draft' : (status || 'draft'),
      lines: normalized,
    });
    await grn.save();

    if (status === 'received' || req.body.receive === true) {
      await confirmGrnReceive({ tenantFilter: req.tenantFilter, user: req.user, grn });
    }

    const saved = await GRN.findOne({ _id: grn._id, ...req.tenantFilter })
      .populate('supplierId', 'nameEn nameAr')
      .populate('purchaseOrderId', 'poNumber')
      .populate('warehouseId', 'code nameEn nameAr');
    res.status(201).json(saved);
  } catch (error) {
    handlePurchasesError(res, error);
  }
});

router.get('/:id', checkPermission('supply_chain', 'read'), async (req, res) => {
  try {
    const grn = await GRN.findOne({ _id: req.params.id, tenantId: req.user.tenantId })
      .populate('supplierId', 'nameEn nameAr email phone')
      .populate('purchaseOrderId', 'poNumber status warehouseId')
      .populate('warehouseId', 'code nameEn nameAr')
      .populate('receivedBy', 'firstName lastName name')
      .populate('createdBy', 'firstName lastName name');
    if (!grn) return res.status(404).json({ error: 'GRN not found' });
    res.json(grn);
  } catch (error) {
    handlePurchasesError(res, error);
  }
});

router.put('/:id', checkPermission('supply_chain', 'update'), async (req, res) => {
  try {
    const grn = await GRN.findOne({ _id: req.params.id, tenantId: req.user.tenantId });
    if (!grn) return res.status(404).json({ error: 'GRN not found' });
    if (!['draft'].includes(grn.status)) {
      return res.status(400).json({ error: 'Only draft GRNs can be edited' });
    }
    const { supplierId, warehouseId, referenceNumber, notes, expectedDate, lines, purchaseOrderId } = req.body;
    if (supplierId) grn.supplierId = supplierId;
    if (warehouseId !== undefined) grn.warehouseId = warehouseId || undefined;
    if (referenceNumber !== undefined) grn.referenceNumber = referenceNumber;
    if (notes !== undefined) grn.notes = notes;
    if (expectedDate !== undefined) grn.expectedDate = expectedDate;
    if (purchaseOrderId !== undefined) grn.purchaseOrderId = purchaseOrderId || undefined;
    if (Array.isArray(lines)) grn.lines = normalizeGrnLines(lines);
    await grn.save();
    res.json(grn);
  } catch (error) {
    handlePurchasesError(res, error);
  }
});

router.post('/:id/receive', checkPermission('supply_chain', 'update'), async (req, res) => {
  try {
    const grn = await GRN.findOne({ _id: req.params.id, tenantId: req.user.tenantId });
    if (!grn) return res.status(404).json({ error: 'GRN not found' });
    if (grn.status === 'cancelled') return res.status(400).json({ error: 'Cannot receive a cancelled GRN' });
    const warehouseId = req.body.warehouseId || grn.warehouseId;
    if (warehouseId) {
      const warehouse = await resolveWarehouse(req.tenantFilter, warehouseId);
      if (!warehouse) return res.status(400).json({ error: 'Warehouse not found' });
    }
    await confirmGrnReceive({ tenantFilter: req.tenantFilter, user: req.user, grn, warehouseId });
    res.json(grn);
  } catch (error) {
    handlePurchasesError(res, error);
  }
});

router.post('/:id/complete', checkPermission('supply_chain', 'update'), async (req, res) => {
  try {
    const grn = await GRN.findOne({ _id: req.params.id, tenantId: req.user.tenantId });
    if (!grn) return res.status(404).json({ error: 'GRN not found' });
    if (grn.status === 'cancelled') return res.status(400).json({ error: 'Cannot complete a cancelled GRN' });
    if (!grn.stockPostedAt) {
      await confirmGrnReceive({ tenantFilter: req.tenantFilter, user: req.user, grn });
    }
    grn.status = 'completed';
    grn.completedAt = new Date();
    await grn.save();
    res.json(grn);
  } catch (error) {
    handlePurchasesError(res, error);
  }
});

router.post('/:id/cancel', checkPermission('supply_chain', 'update'), async (req, res) => {
  try {
    const grn = await GRN.findOne({ _id: req.params.id, tenantId: req.user.tenantId });
    if (!grn) return res.status(404).json({ error: 'GRN not found' });
    await cancelGrn({ tenantFilter: req.tenantFilter, user: req.user, grn });
    res.json(grn);
  } catch (error) {
    handlePurchasesError(res, error);
  }
});

export default router;
