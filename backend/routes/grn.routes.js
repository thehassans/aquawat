import express from 'express';
import multer from 'multer';
import GRN from '../models/GRN.js';
import PurchaseOrder from '../models/PurchaseOrder.js';
import LandedCost from '../models/LandedCost.js';
import { protect, tenantFilter, requireTenantFilter, checkPermission } from '../middleware/auth.js';
import { normalizeProductType } from '../utils/productType.js';
import {
  generateGrnNumber,
  confirmGrnReceive,
  cancelGrn,
  resolveWarehouse,
  PurchasesValidationError,
} from '../services/purchasesWorkflow.js';
import { toNumber, buildOpenReceiveLines, summarizeOpenPo, assertDelayedLines } from '../services/purchasesLogic.js';

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
    variantId: line.variantId || undefined,
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

function mapDelayLines(lines = []) {
  return (Array.isArray(lines) ? lines : [])
    .filter((line) => line.isDelayed)
    .map((line) => ({
      productName: line.productName || '',
      quantityOrdered: Math.max(0, toNumber(line.quantityOrdered) - Math.max(toNumber(line.quantityReceived), toNumber(line.quantityReturned))),
      delayedUntil: line.delayedUntil || null,
      delayReason: line.delayReason || '',
      notes: line.notes || '',
      costPrice: toNumber(line.costPrice),
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

function slimPo(po) {
  if (!po) return null;
  const supplier = po.supplierId && typeof po.supplierId === 'object' ? po.supplierId : null;
  const warehouse = po.warehouseId && typeof po.warehouseId === 'object' ? po.warehouseId : null;
  return {
    _id: po._id,
    poNumber: po.poNumber,
    status: po.status,
    expectedDate: po.expectedDate,
    orderDate: po.orderDate,
    supplierId: supplier ? { _id: supplier._id, nameEn: supplier.nameEn, nameAr: supplier.nameAr } : po.supplierId,
    warehouseId: warehouse
      ? { _id: warehouse._id, code: warehouse.code, nameEn: warehouse.nameEn, nameAr: warehouse.nameAr }
      : po.warehouseId,
  };
}

async function attachLandedCosts(tenantId, grns) {
  const list = Array.isArray(grns) ? grns : [];
  if (!list.length) return list;
  const grnIds = list.map((g) => g._id);
  const poIds = list.map((g) => g.purchaseOrderId?._id || g.purchaseOrderId).filter(Boolean);
  const lcs = await LandedCost.find({
    tenantId,
    isActive: { $ne: false },
    $or: [
      { grnIds: { $in: grnIds } },
      ...(poIds.length ? [{ purchaseOrder: { $in: poIds } }] : []),
    ],
  }).select('lcNumber totalCost status grnIds purchaseOrder').lean();

  return list.map((grn) => {
    const plain = typeof grn.toObject === 'function' ? grn.toObject() : grn;
    const gid = String(grn._id);
    const pid = String(grn.purchaseOrderId?._id || grn.purchaseOrderId || '');
    plain.landedCosts = lcs.filter((lc) => {
      const linkedGrns = (lc.grnIds || []).map((id) => String(id));
      return linkedGrns.includes(gid) || (pid && String(lc.purchaseOrder || '') === pid);
    });
    return plain;
  });
}

router.get('/', checkPermission('supply_chain', 'read'), async (req, res) => {
  try {
    const { status, supplierId, warehouseId, purchaseOrderId, search, page, limit } = req.query;
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

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(200, parseInt(limit, 10) || 100));
    const listQuery = GRN.find(query)
      .select('grnNumber status referenceNumber notes createdAt updatedAt receivedDate totalAmount supplierId purchaseOrderId warehouseId')
      .populate('supplierId', 'nameEn nameAr')
      .populate('purchaseOrderId', 'poNumber status warehouseId expectedDate')
      .populate('warehouseId', 'code nameEn nameAr')
      .sort('-createdAt')
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean();

    const [total, grns] = await Promise.all([
      GRN.countDocuments(query),
      listQuery,
    ]);

    const enriched = await attachLandedCosts(req.user.tenantId, grns);
    res.json({
      grns: enriched,
      pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) || 0 },
    });
  } catch (error) {
    handlePurchasesError(res, error);
  }
});

router.get('/from-po/:poId', checkPermission('supply_chain', 'read'), async (req, res) => {
  try {
    const po = await loadOpenPo(req.tenantFilter, req.params.poId);
    if (!po) return res.status(404).json({ error: 'Purchase order not found' });
    const openLines = buildOpenReceiveLines(po);
    res.json({
      purchaseOrder: slimPo(po),
      warehouseId: po.warehouseId?._id || po.warehouseId || null,
      supplierId: po.supplierId?._id || po.supplierId,
      expectedDate: po.expectedDate || null,
      lines: openLines,
    });
  } catch (error) {
    handlePurchasesError(res, error);
  }
});

router.get('/upcoming', checkPermission('supply_chain', 'read'), async (req, res) => {
  try {
    const search = String(req.query.search || '').trim();
    const pos = await PurchaseOrder.find({
      ...req.tenantFilter,
      status: { $nin: ['cancelled', 'billed', 'closed', 'received'] },
    })
      .populate('supplierId', 'nameEn nameAr')
      .populate('warehouseId', 'code nameEn nameAr')
      .populate('lineItems.productId', 'sku nameEn nameAr barcode unitOfMeasure productType costPrice')
      .sort({ expectedDate: 1, orderDate: 1, createdAt: 1 });

    const poRows = pos.map((po) => {
      const summary = summarizeOpenPo(po);
      if (summary.remainingQty <= 0) return null;
      const row = slimPo(po);
      const haystack = `${row.poNumber || ''} ${row.supplierId?.nameEn || ''} ${row.supplierId?.nameAr || ''}`.toLowerCase();
      if (search && !haystack.includes(search.toLowerCase())) return null;
      return {
        kind: 'po',
        _id: po._id,
        purchaseOrderId: po._id,
        poNumber: po.poNumber,
        supplierId: row.supplierId,
        warehouseId: row.warehouseId,
        expectedDate: po.expectedDate,
        remainingQty: summary.remainingQty,
        remainingValue: summary.remainingValue,
        lineCount: summary.lines.length,
        status: po.status,
        delayed: false,
      };
    }).filter(Boolean);

    const delayedGrns = await GRN.find({
      tenantId: req.user.tenantId,
      status: { $in: ['draft', 'received'] },
      'lines.isDelayed': true,
    })
      .populate('supplierId', 'nameEn nameAr')
      .populate('purchaseOrderId', 'poNumber status')
      .populate('warehouseId', 'code nameEn nameAr')
      .sort({ expectedDate: 1, createdAt: 1 });

    const delayedRows = delayedGrns.map((grn) => {
      if (grn.purchaseOrderId && ['received', 'closed', 'billed', 'cancelled'].includes(grn.purchaseOrderId.status)) {
        return null;
      }
      const delayLines = mapDelayLines(grn.lines);
      if (!delayLines.length) return null;
      const haystack = [
        grn.grnNumber,
        grn.purchaseOrderId?.poNumber,
        grn.supplierId?.nameEn,
        grn.supplierId?.nameAr,
        ...delayLines.map((line) => `${line.productName} ${line.delayReason} ${line.notes}`),
      ].join(' ').toLowerCase();
      if (search && !haystack.includes(search.toLowerCase())) return null;
      const nextDate = delayLines
        .map((line) => line.delayedUntil)
        .filter(Boolean)
        .sort((a, b) => new Date(a) - new Date(b))[0] || grn.expectedDate;
      return {
        kind: 'delayed',
        _id: grn._id,
        grnId: grn._id,
        grnNumber: grn.grnNumber,
        purchaseOrderId: grn.purchaseOrderId?._id || grn.purchaseOrderId,
        poNumber: grn.purchaseOrderId?.poNumber,
        supplierId: grn.supplierId,
        warehouseId: grn.warehouseId,
        expectedDate: nextDate,
        remainingQty: delayLines.reduce((sum, line) => sum + toNumber(line.quantityOrdered), 0),
        remainingValue: delayLines.reduce((sum, line) => sum + toNumber(line.quantityOrdered) * toNumber(line.costPrice), 0),
        lineCount: delayLines.length,
        status: 'delayed',
        delayed: true,
        delayLines,
      };
    }).filter(Boolean);

    const items = [...delayedRows, ...poRows].sort((a, b) => {
      const da = a.expectedDate ? new Date(a.expectedDate).getTime() : Number.MAX_SAFE_INTEGER;
      const db = b.expectedDate ? new Date(b.expectedDate).getTime() : Number.MAX_SAFE_INTEGER;
      return da - db;
    });

    res.json({ items, counts: { upcoming: poRows.length, delayed: delayedRows.length } });
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
    assertDelayedLines(normalized);

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
      .populate('purchaseOrderId', 'poNumber status warehouseId expectedDate')
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
    if (Array.isArray(lines)) {
      const normalized = normalizeGrnLines(lines);
      assertDelayedLines(normalized);
      grn.lines = normalized;
    }
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
    assertDelayedLines(grn.lines);
    const warehouseId = req.body.warehouseId || grn.warehouseId;
    const { isInvEngineEnabled } = await import('../services/inventory/legacyAdapter.js');
    if (await isInvEngineEnabled(req.user.tenantId) && !warehouseId) {
      return res.status(400).json({
        error: 'warehouseId required when inventory engine is enabled',
        code: 'WAREHOUSE_REQUIRED',
      });
    }
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
