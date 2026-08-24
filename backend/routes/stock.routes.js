import express from 'express';
import mongoose from 'mongoose';
import { protect, tenantFilter, requireTenantFilter, checkPermission, requireBusinessType } from '../middleware/auth.js';
import {
  StockPicking,
  StockMove,
  StockMoveLine,
  StockOperationType,
  StockWarehouse,
  StockLocation,
  StockProductTemplate,
  StockProductVariant,
  StockUom,
  StockUomCategory,
  StockProductCategory,
  StockQuant,
  StockSettings,
  StockLot,
  StockPackage,
  StockPackageType,
  StockProductPackaging,
  StockScrap,
  StockRoute,
  StockRule,
  StockOrderpoint,
  StockStorageCategory,
  StockPutawayRule,
  StockSchedulerRun,
  StockValuationLayer,
  StockLandedCost,
  StockBarcodeNomenclature,
} from '../models/stock/index.js';
import { ensureStockBootstrap, getDefaultUom } from '../services/stock/bootstrap.js';
import {
  createPicking,
  confirmPicking,
  checkAvailability,
  unreservePicking,
  validatePicking,
  cancelPicking,
} from '../services/stock/pickingService.js';
import { stockReportRows, computeForecast, computeOnHand } from '../services/stock/forecast.js';
import { listInventoryQuants, setCountedQuantity, applyInventoryCounts } from '../services/stock/inventoryCount.js';
import { createScrap, validateScrap } from '../services/stock/scrapService.js';
import { movesHistory, lotTraceability, productTraceability } from '../services/stock/traceability.js';
import { nextSequenceName, ensureSequence } from '../services/stock/sequence.js';
import { recomputeWarehouseRoutes } from '../services/stock/warehouseSteps.js';
import { runProcurement } from '../services/stock/procurement.js';
import {
  listReplenishment,
  upsertOrderpoint,
  snoozeOrderpoint,
  orderOnce,
  runScheduler,
} from '../services/stock/scheduler.js';
import { createLandedCost, computeLandedCost, validateLandedCost } from '../services/stock/landedCost.js';
import { getReturnWizard, createReturnPicking } from '../services/stock/returns.js';
import { matchBarcode, defaultBarcodeRules } from '../services/stock/barcode.js';
import { movesAnalysis, performanceReport } from '../services/stock/analysis.js';
import { productInventoryValue } from '../services/stock/valuation.js';
import { StockValidationError } from '../services/stock/errors.js';
import { D, decStr } from '../utils/decimal.js';

const VARIANT_POPULATE = {
  path: 'productId',
  populate: { path: 'templateId', select: 'name defaultCode barcode uomId standardPrice' },
};

const router = express.Router();

router.use(protect);
router.use(tenantFilter);
router.use(requireTenantFilter);
router.use(requireBusinessType('trading', 'furniture_shop'));

function handleError(res, err) {
  if (err instanceof StockValidationError) {
    return res.status(err.status || 400).json({ error: err.message, code: err.code });
  }
  console.error('[stock]', err);
  return res.status(500).json({ error: err.message || 'Internal error' });
}

async function withBootstrap(req, res, next) {
  try {
    await ensureStockBootstrap(req.user.tenantId, req.user._id);
    next();
  } catch (err) {
    handleError(res, err);
  }
}

router.use(withBootstrap);

// ─── Bootstrap / settings ───────────────────────────────────────────────────

router.get('/settings', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const settings = await StockSettings.findOne({ tenantId: req.user.tenantId }).lean();
    res.json(settings || { engineEnabled: true });
  } catch (err) {
    handleError(res, err);
  }
});

router.patch('/settings', checkPermission('inventory', 'update'), async (req, res) => {
  try {
    const allowed = [
      'groupStockMultiLocations', 'groupStockAdvLocation', 'groupStockTrackingLot',
      'groupStockPackaging', 'groupStockProductionLot', 'groupLotOnDeliverySlip',
      'moduleProductExpiry', 'groupStockStorageCategories', 'groupStockPutawayRules',
      'groupStockSignDelivery', 'groupStockReceptionReport', 'groupStockAutoReception',
      'groupUom', 'groupProductVariant', 'stockMoveEmailValidation',
      'annualInventoryMonth', 'annualInventoryDay',
      'securityLeadTime', 'daysToPurchase', 'poLeadTime',
      'useLandedCosts', 'barcodeNomenclatureId',
      'schedulerEnabled', 'engineEnabled',
      'stockAccountingEnabled',
      'propertyStockValuationAccountId', 'propertyStockInputAccountId',
      'propertyStockOutputAccountId', 'propertyLandedCostAccountId',
    ];
    const updates = {};
    for (const k of allowed) {
      if (req.body[k] !== undefined) updates[k] = req.body[k];
    }
    const settings = await StockSettings.findOneAndUpdate(
      { tenantId: req.user.tenantId },
      { $set: updates },
      { new: true, upsert: true },
    );
    // Sync op-type lot flags when production lots enabled
    if (updates.groupStockProductionLot === true) {
      await StockOperationType.updateMany(
        { tenantId: req.user.tenantId, code: 'incoming' },
        { $set: { useCreateLots: true, useExistingLots: true } },
      );
      await StockOperationType.updateMany(
        { tenantId: req.user.tenantId, code: 'outgoing' },
        { $set: { useExistingLots: true } },
      );
    }
    res.json(settings);
  } catch (err) {
    handleError(res, err);
  }
});

// ─── Warehouses & locations ─────────────────────────────────────────────────

router.get('/warehouses', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const warehouses = await StockWarehouse.find({ ...req.tenantFilter, active: true }).lean();
    res.json(warehouses);
  } catch (err) {
    handleError(res, err);
  }
});

router.patch('/warehouses/:id', checkPermission('inventory', 'update'), async (req, res) => {
  try {
    const allowed = ['name', 'receptionSteps', 'deliverySteps', 'buyToResupply', 'active'];
    const updates = {};
    for (const k of allowed) {
      if (req.body[k] !== undefined) updates[k] = req.body[k];
    }
    const wh = await StockWarehouse.findOneAndUpdate(
      { _id: req.params.id, ...req.tenantFilter },
      { $set: updates },
      { new: true },
    );
    if (!wh) return res.status(404).json({ error: 'Not found' });

    if (updates.receptionSteps || updates.deliverySteps) {
      await recomputeWarehouseRoutes(wh._id, req.user.tenantId, req.user._id);
      return res.json(await StockWarehouse.findById(wh._id).lean());
    }
    res.json(wh);
  } catch (err) {
    handleError(res, err);
  }
});

router.post('/warehouses/:id/recompute-routes', checkPermission('inventory', 'update'), async (req, res) => {
  try {
    const wh = await recomputeWarehouseRoutes(req.params.id, req.user.tenantId, req.user._id);
    res.json(wh);
  } catch (err) {
    handleError(res, err);
  }
});

router.get('/locations', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const { usage, warehouseId } = req.query;
    const filter = { ...req.tenantFilter, active: true };
    if (usage) filter.usage = usage;
    if (warehouseId) filter.warehouseId = warehouseId;
    const locations = await StockLocation.find(filter).sort({ completeName: 1 }).lean();
    res.json(locations);
  } catch (err) {
    handleError(res, err);
  }
});

router.post('/locations', checkPermission('inventory', 'create'), async (req, res) => {
  try {
    const { name, parentId, usage, warehouseId } = req.body;
    if (!name || !usage) return res.status(400).json({ error: 'name and usage required' });

    let completeName = name;
    if (parentId) {
      const parent = await StockLocation.findOne({ _id: parentId, ...req.tenantFilter });
      if (!parent) return res.status(404).json({ error: 'Parent location not found' });
      completeName = `${parent.completeName}/${name}`;
    }

    const [loc] = await StockLocation.create([{
      tenantId: req.user.tenantId,
      name,
      parentId: parentId || null,
      completeName,
      usage,
      warehouseId: warehouseId || null,
      createdBy: req.user._id,
    }]);
    res.status(201).json(loc);
  } catch (err) {
    handleError(res, err);
  }
});

// ─── Operation types ────────────────────────────────────────────────────────

router.get('/operation-types', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const { code } = req.query;
    const filter = { ...req.tenantFilter, active: true };
    if (code) filter.code = code;
    const types = await StockOperationType.find(filter).populate('warehouseId', 'name code').lean();
    res.json(types);
  } catch (err) {
    handleError(res, err);
  }
});

// ─── UoM ────────────────────────────────────────────────────────────────────

router.get('/uom', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const uoms = await StockUom.find({ ...req.tenantFilter, active: true }).populate('categoryId', 'name').lean();
    res.json(uoms);
  } catch (err) {
    handleError(res, err);
  }
});

router.get('/uom-categories', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const cats = await StockUomCategory.find({ ...req.tenantFilter }).lean();
    res.json(cats);
  } catch (err) {
    handleError(res, err);
  }
});

// ─── Product templates & variants ───────────────────────────────────────────

router.get('/products/variants', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const { search, limit = 100 } = req.query;
    const filter = { ...req.tenantFilter, active: true };
    const variants = await StockProductVariant.find(filter)
      .populate({ path: 'templateId', select: 'name defaultCode uomId' })
      .limit(Number(limit))
      .lean();

    let items = variants;
    if (search) {
      const re = new RegExp(search, 'i');
      items = variants.filter((v) =>
        re.test(v.templateId?.name || '') || re.test(v.defaultCode || '') || re.test(String(v._id)));
    }
    res.json(items);
  } catch (err) {
    handleError(res, err);
  }
});

router.get('/products/templates', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const { search, page = 1, limit = 80 } = req.query;
    const filter = { ...req.tenantFilter, active: true };
    if (search) {
      filter.$or = [
        { name: new RegExp(search, 'i') },
        { defaultCode: new RegExp(search, 'i') },
        { barcode: new RegExp(search, 'i') },
      ];
    }
    const templates = await StockProductTemplate.find(filter)
      .populate('uomId', 'name')
      .populate('categoryId', 'name completeName')
      .sort({ name: 1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit))
      .lean();
    const total = await StockProductTemplate.countDocuments(filter);
    res.json({ items: templates, total, page: Number(page), limit: Number(limit) });
  } catch (err) {
    handleError(res, err);
  }
});

router.get('/products/templates/:id', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const template = await StockProductTemplate.findOne({ _id: req.params.id, ...req.tenantFilter })
      .populate('uomId')
      .populate('categoryId')
      .lean();
    if (!template) return res.status(404).json({ error: 'Not found' });
    const variants = await StockProductVariant.find({ templateId: template._id, ...req.tenantFilter }).lean();
    const onHand = variants.length === 1
      ? await computeOnHand(req.user.tenantId, variants[0]._id)
      : null;
    const forecast = variants.length === 1
      ? await computeForecast(req.user.tenantId, variants[0]._id)
      : null;
    res.json({ template, variants, onHand, forecast });
  } catch (err) {
    handleError(res, err);
  }
});

router.post('/products/templates', checkPermission('inventory', 'create'), async (req, res) => {
  try {
    const body = req.body;
    let uomId = body.uomId;
    if (!uomId) {
      const defaultUom = await getDefaultUom(req.user.tenantId);
      uomId = defaultUom?._id;
    }
    if (!uomId) return res.status(400).json({ error: 'uomId required' });

    let categoryId = body.categoryId;
    if (!categoryId) {
      const root = await StockProductCategory.findOne({ ...req.tenantFilter, name: 'All' });
      categoryId = root?._id;
    }

    const [template] = await StockProductTemplate.create([{
      tenantId: req.user.tenantId,
      name: body.name,
      defaultCode: body.defaultCode,
      barcode: body.barcode,
      type: body.type || 'goods',
      isStorable: body.isStorable !== false,
      tracking: body.tracking || 'none',
      useExpirationDate: Boolean(body.useExpirationDate),
      expirationTime: Number(body.expirationTime) || 0,
      useTime: Number(body.useTime) || 0,
      removalTime: Number(body.removalTime) || 0,
      alertTime: Number(body.alertTime) || 0,
      uomId,
      purchaseUomId: body.purchaseUomId || uomId,
      listPrice: String(body.listPrice ?? 0),
      standardPrice: String(body.standardPrice ?? 0),
      categoryId,
      saleOk: body.saleOk !== false,
      purchaseOk: body.purchaseOk !== false,
      descriptionPicking: body.descriptionPicking,
      createdBy: req.user._id,
    }]);

    const [variant] = await StockProductVariant.create([{
      tenantId: req.user.tenantId,
      templateId: template._id,
      defaultCode: body.defaultCode,
      barcode: body.barcode,
      createdBy: req.user._id,
    }]);

    res.status(201).json({ template, variant });
  } catch (err) {
    handleError(res, err);
  }
});

router.patch('/products/templates/:id', checkPermission('inventory', 'update'), async (req, res) => {
  try {
    const allowed = ['name', 'defaultCode', 'barcode', 'listPrice', 'standardPrice', 'isStorable', 'tracking', 'useExpirationDate', 'expirationTime', 'useTime', 'removalTime', 'alertTime', 'descriptionPicking', 'active'];
    const updates = {};
    for (const k of allowed) {
      if (req.body[k] !== undefined) updates[k] = req.body[k];
    }
    const template = await StockProductTemplate.findOneAndUpdate(
      { _id: req.params.id, ...req.tenantFilter },
      { $set: updates },
      { new: true },
    );
    if (!template) return res.status(404).json({ error: 'Not found' });
    res.json(template);
  } catch (err) {
    handleError(res, err);
  }
});

// ─── Quants ─────────────────────────────────────────────────────────────────

router.get('/quants', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const { productId, locationId } = req.query;
    const filter = { ...req.tenantFilter };
    if (productId) filter.productId = productId;
    if (locationId) filter.locationId = locationId;
    const quants = await StockQuant.find(filter)
      .populate(VARIANT_POPULATE)
      .populate('locationId', 'completeName usage')
      .lean();
    res.json(quants);
  } catch (err) {
    handleError(res, err);
  }
});

// ─── Pickings ───────────────────────────────────────────────────────────────

router.get('/pickings', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const { code, state, search, page = 1, limit = 80 } = req.query;
    const filter = { ...req.tenantFilter };

    if (state) filter.state = state;
    if (search) filter.name = new RegExp(search, 'i');

    if (code) {
      const opTypes = await StockOperationType.find({ ...req.tenantFilter, code, active: true }).select('_id').lean();
      filter.operationTypeId = { $in: opTypes.map((o) => o._id) };
    }

    const pickings = await StockPicking.find(filter)
      .populate('operationTypeId', 'name code')
      .sort({ scheduledDate: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit))
      .lean();

    const total = await StockPicking.countDocuments(filter);
    res.json({ items: pickings, total, page: Number(page), limit: Number(limit) });
  } catch (err) {
    handleError(res, err);
  }
});

router.get('/pickings/:id', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const picking = await StockPicking.findOne({ _id: req.params.id, ...req.tenantFilter })
      .populate('operationTypeId')
      .lean();
    if (!picking) return res.status(404).json({ error: 'Not found' });

    const moves = await StockMove.find({ pickingId: picking._id, ...req.tenantFilter })
      .populate(VARIANT_POPULATE)
      .lean();
    const moveLines = await StockMoveLine.find({ pickingId: picking._id, ...req.tenantFilter })
      .populate('locationId', 'completeName usage')
      .populate('locationDestId', 'completeName usage')
      .lean();

    res.json({ picking, moves, moveLines });
  } catch (err) {
    handleError(res, err);
  }
});

router.post('/pickings', checkPermission('inventory', 'create'), async (req, res) => {
  try {
    const picking = await createPicking({
      tenantId: req.user.tenantId,
      userId: req.user._id,
      ...req.body,
    });
    res.status(201).json(picking);
  } catch (err) {
    handleError(res, err);
  }
});

router.post('/pickings/:id/confirm', checkPermission('inventory', 'update'), async (req, res) => {
  try {
    const picking = await confirmPicking(req.params.id, req.user.tenantId);
    res.json(picking);
  } catch (err) {
    handleError(res, err);
  }
});

router.post('/pickings/:id/check-availability', checkPermission('inventory', 'update'), async (req, res) => {
  try {
    const picking = await checkAvailability(req.params.id, req.user.tenantId);
    res.json(picking);
  } catch (err) {
    handleError(res, err);
  }
});

router.post('/pickings/:id/unreserve', checkPermission('inventory', 'update'), async (req, res) => {
  try {
    const picking = await unreservePicking(req.params.id, req.user.tenantId);
    res.json(picking);
  } catch (err) {
    handleError(res, err);
  }
});

router.post('/pickings/:id/validate', checkPermission('inventory', 'update'), async (req, res) => {
  try {
    const { createBackorder } = req.body || {};
    const picking = await validatePicking(req.params.id, req.user.tenantId, { createBackorder });
    res.json(picking);
  } catch (err) {
    handleError(res, err);
  }
});

router.post('/pickings/:id/cancel', checkPermission('inventory', 'update'), async (req, res) => {
  try {
    const picking = await cancelPicking(req.params.id, req.user.tenantId);
    res.json(picking);
  } catch (err) {
    handleError(res, err);
  }
});

// ─── Overview dashboard stats ───────────────────────────────────────────────

router.get('/dashboard/overview', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const opTypes = await StockOperationType.find({ ...req.tenantFilter, active: true }).lean();
    const now = new Date();
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const cards = [];
    for (const ot of opTypes) {
      const baseFilter = { ...req.tenantFilter, operationTypeId: ot._id, state: { $nin: ['done', 'cancel'] } };
      const ready = await StockPicking.countDocuments({ ...baseFilter, state: 'assigned' });
      const waiting = await StockPicking.countDocuments({ ...baseFilter, state: { $in: ['waiting', 'confirmed'] } });
      const late = await StockPicking.countDocuments({
        ...baseFilter,
        dateDeadline: { $lt: now },
        state: { $nin: ['done', 'cancel'] },
      });

      const scheduled = await StockPicking.find({
        ...req.tenantFilter,
        operationTypeId: ot._id,
        scheduledDate: { $gte: weekAgo, $lte: now },
      }).select('scheduledDate state').lean();

      cards.push({
        operationType: ot,
        counts: { ready, waiting, late },
        scheduled,
      });
    }

    res.json({ cards });
  } catch (err) {
    handleError(res, err);
  }
});

// ─── Reports ────────────────────────────────────────────────────────────────

router.get('/reports/stock', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const data = await stockReportRows(req.user.tenantId, req.query);
    res.json(data);
  } catch (err) {
    handleError(res, err);
  }
});

router.get('/reports/forecast/:productId', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const data = await computeForecast(req.user.tenantId, req.params.productId, req.query);
    res.json(data);
  } catch (err) {
    handleError(res, err);
  }
});

// ─── Lots / serials ─────────────────────────────────────────────────────────

router.get('/lots', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const { productId, search, page = 1, limit = 80 } = req.query;
    const filter = { ...req.tenantFilter };
    if (productId) filter.productId = productId;
    if (search) filter.name = new RegExp(search, 'i');
    const items = await StockLot.find(filter)
      .populate(VARIANT_POPULATE)
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit))
      .lean();
    const total = await StockLot.countDocuments(filter);
    res.json({ items, total, page: Number(page), limit: Number(limit) });
  } catch (err) {
    handleError(res, err);
  }
});

router.post('/lots', checkPermission('inventory', 'create'), async (req, res) => {
  try {
    const { name, productId, ref, expirationDate, useDate, removalDate, alertDate, note } = req.body;
    if (!name || !productId) return res.status(400).json({ error: 'name and productId required' });
    const [lot] = await StockLot.create([{
      tenantId: req.user.tenantId,
      name,
      productId,
      ref,
      expirationDate,
      useDate,
      removalDate,
      alertDate,
      note,
      createdBy: req.user._id,
    }]);
    res.status(201).json(lot);
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'Lot name already exists for this product', code: 'LOT_DUP' });
    handleError(res, err);
  }
});

router.get('/lots/:id', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const lot = await StockLot.findOne({ _id: req.params.id, ...req.tenantFilter }).populate(VARIANT_POPULATE).lean();
    if (!lot) return res.status(404).json({ error: 'Not found' });
    const trace = await lotTraceability(req.user.tenantId, lot._id);
    res.json({ lot, trace });
  } catch (err) {
    handleError(res, err);
  }
});

router.get('/lots/:id/traceability', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const data = await lotTraceability(req.user.tenantId, req.params.id);
    if (!data) return res.status(404).json({ error: 'Not found' });
    res.json(data);
  } catch (err) {
    handleError(res, err);
  }
});

// ─── Packages ───────────────────────────────────────────────────────────────

router.get('/package-types', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    res.json(await StockPackageType.find({ ...req.tenantFilter }).lean());
  } catch (err) {
    handleError(res, err);
  }
});

router.post('/package-types', checkPermission('inventory', 'create'), async (req, res) => {
  try {
    const [row] = await StockPackageType.create([{
      tenantId: req.user.tenantId,
      ...req.body,
      createdBy: req.user._id,
    }]);
    res.status(201).json(row);
  } catch (err) {
    handleError(res, err);
  }
});

router.get('/packages', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const items = await StockPackage.find({ ...req.tenantFilter })
      .populate('packageTypeId', 'name')
      .populate('locationId', 'completeName')
      .sort({ createdAt: -1 })
      .lean();
    res.json(items);
  } catch (err) {
    handleError(res, err);
  }
});

router.post('/packages', checkPermission('inventory', 'create'), async (req, res) => {
  try {
    await ensureSequence(req.user.tenantId, 'PACK', 'PACK');
    const name = req.body.name || await nextSequenceName(req.user.tenantId, 'PACK');
    const [pkg] = await StockPackage.create([{
      tenantId: req.user.tenantId,
      name,
      packageTypeId: req.body.packageTypeId || null,
      locationId: req.body.locationId || null,
      createdBy: req.user._id,
    }]);
    res.status(201).json(pkg);
  } catch (err) {
    handleError(res, err);
  }
});

router.get('/product-packagings', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const filter = { ...req.tenantFilter };
    if (req.query.productId) filter.productId = req.query.productId;
    res.json(await StockProductPackaging.find(filter).populate('packageTypeId', 'name').lean());
  } catch (err) {
    handleError(res, err);
  }
});

router.post('/product-packagings', checkPermission('inventory', 'create'), async (req, res) => {
  try {
    const [row] = await StockProductPackaging.create([{
      tenantId: req.user.tenantId,
      name: req.body.name,
      productId: req.body.productId,
      qty: String(req.body.qty ?? 1),
      barcode: req.body.barcode,
      packageTypeId: req.body.packageTypeId || null,
      purchaseOk: req.body.purchaseOk !== false,
      salesOk: req.body.salesOk !== false,
      createdBy: req.user._id,
    }]);
    res.status(201).json(row);
  } catch (err) {
    handleError(res, err);
  }
});

// ─── Physical inventory ─────────────────────────────────────────────────────

router.get('/inventory', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const items = await listInventoryQuants(req.user.tenantId, req.query);
    res.json(items);
  } catch (err) {
    handleError(res, err);
  }
});

router.post('/quants/set-counted', checkPermission('inventory', 'update'), async (req, res) => {
  try {
    const quant = await setCountedQuantity(req.user.tenantId, { ...req.body, userId: req.user._id });
    res.json(quant);
  } catch (err) {
    handleError(res, err);
  }
});

router.post('/quants/apply-count', checkPermission('inventory', 'update'), async (req, res) => {
  try {
    const result = await applyInventoryCounts(req.user.tenantId, {
      ids: req.body.ids,
      accountingDate: req.body.accountingDate,
      reason: req.body.reason,
      userId: req.user._id,
    });
    res.json(result);
  } catch (err) {
    handleError(res, err);
  }
});

// ─── Scrap ──────────────────────────────────────────────────────────────────

router.get('/scraps', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const items = await StockScrap.find({ ...req.tenantFilter })
      .populate(VARIANT_POPULATE)
      .populate('locationId', 'completeName')
      .sort({ createdAt: -1 })
      .lean();
    res.json(items);
  } catch (err) {
    handleError(res, err);
  }
});

router.post('/scraps', checkPermission('inventory', 'create'), async (req, res) => {
  try {
    const scrap = await createScrap(req.user.tenantId, req.user._id, req.body);
    res.status(201).json(scrap);
  } catch (err) {
    handleError(res, err);
  }
});

router.post('/scraps/:id/validate', checkPermission('inventory', 'update'), async (req, res) => {
  try {
    const scrap = await validateScrap(req.params.id, req.user.tenantId);
    res.json(scrap);
  } catch (err) {
    handleError(res, err);
  }
});

// ─── Move lines upsert (detailed ops) ───────────────────────────────────────

router.post('/move-lines', checkPermission('inventory', 'update'), async (req, res) => {
  try {
    const { id, pickingId, moveId, productId, productUomId, quantity, locationId, locationDestId, lotId, lotName, packageId } = req.body;
    if (id) {
      const line = await StockMoveLine.findOneAndUpdate(
        { _id: id, ...req.tenantFilter, state: { $nin: ['done', 'cancel'] } },
        {
          $set: {
            quantity: String(quantity ?? 0),
            quantityProduct: String(quantity ?? 0),
            lotId: lotId || null,
            lotName,
            packageId: packageId || null,
            locationId,
            locationDestId,
          },
        },
        { new: true },
      );
      if (!line) return res.status(404).json({ error: 'Move line not found or done' });
      return res.json(line);
    }
    const [line] = await StockMoveLine.create([{
      tenantId: req.user.tenantId,
      pickingId,
      moveId,
      productId,
      productUomId,
      quantity: String(quantity ?? 0),
      quantityProduct: String(quantity ?? 0),
      locationId,
      locationDestId,
      lotId: lotId || null,
      lotName,
      packageId: packageId || null,
      state: 'confirmed',
      createdBy: req.user._id,
    }]);
    res.status(201).json(line);
  } catch (err) {
    handleError(res, err);
  }
});

// ─── Reports: moves history + product trace ─────────────────────────────────

router.get('/reports/moves-history', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    res.json(await movesHistory(req.user.tenantId, req.query));
  } catch (err) {
    handleError(res, err);
  }
});

router.get('/reports/traceability/product/:productId', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    res.json(await productTraceability(req.user.tenantId, req.params.productId, req.query));
  } catch (err) {
    handleError(res, err);
  }
});

// ─── Routes & Rules ─────────────────────────────────────────────────────────

router.get('/routes', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const routes = await StockRoute.find({ ...req.tenantFilter }).sort({ sequence: 1 }).lean();
    res.json(routes);
  } catch (err) {
    handleError(res, err);
  }
});

router.post('/routes', checkPermission('inventory', 'create'), async (req, res) => {
  try {
    const [route] = await StockRoute.create([{
      tenantId: req.user.tenantId,
      name: req.body.name,
      sequence: req.body.sequence ?? 10,
      productSelectable: req.body.productSelectable !== false,
      productCategSelectable: req.body.productCategSelectable !== false,
      warehouseSelectable: req.body.warehouseSelectable !== false,
      warehouseIds: req.body.warehouseIds || [],
      createdBy: req.user._id,
    }]);
    res.status(201).json(route);
  } catch (err) {
    handleError(res, err);
  }
});

router.patch('/routes/:id', checkPermission('inventory', 'update'), async (req, res) => {
  try {
    const allowed = ['name', 'sequence', 'active', 'warehouseIds', 'productSelectable', 'productCategSelectable'];
    const updates = {};
    for (const k of allowed) {
      if (req.body[k] !== undefined) updates[k] = req.body[k];
    }
    const route = await StockRoute.findOneAndUpdate(
      { _id: req.params.id, ...req.tenantFilter },
      { $set: updates },
      { new: true },
    );
    if (!route) return res.status(404).json({ error: 'Not found' });
    res.json(route);
  } catch (err) {
    handleError(res, err);
  }
});

router.get('/rules', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const filter = { ...req.tenantFilter };
    if (req.query.routeId) filter.routeId = req.query.routeId;
    const rules = await StockRule.find(filter)
      .populate('routeId', 'name')
      .populate('operationTypeId', 'name code')
      .populate('locationSrcId', 'completeName')
      .populate('locationDestId', 'completeName')
      .sort({ sequence: 1 })
      .lean();
    res.json(rules);
  } catch (err) {
    handleError(res, err);
  }
});

router.post('/rules', checkPermission('inventory', 'create'), async (req, res) => {
  try {
    const [rule] = await StockRule.create([{
      tenantId: req.user.tenantId,
      name: req.body.name,
      routeId: req.body.routeId,
      sequence: req.body.sequence ?? 20,
      action: req.body.action || 'pull',
      operationTypeId: req.body.operationTypeId || null,
      locationSrcId: req.body.locationSrcId || null,
      locationDestId: req.body.locationDestId,
      procureMethod: req.body.procureMethod || 'make_to_stock',
      groupPropagationOption: req.body.groupPropagationOption || 'propagate',
      propagateCancel: req.body.propagateCancel !== false,
      delay: req.body.delay || 0,
      createdBy: req.user._id,
    }]);
    res.status(201).json(rule);
  } catch (err) {
    handleError(res, err);
  }
});

router.patch('/rules/:id', checkPermission('inventory', 'update'), async (req, res) => {
  try {
    const allowed = [
      'name', 'sequence', 'action', 'operationTypeId', 'locationSrcId', 'locationDestId',
      'procureMethod', 'groupPropagationOption', 'propagateCancel', 'delay', 'active',
    ];
    const updates = {};
    for (const k of allowed) {
      if (req.body[k] !== undefined) updates[k] = req.body[k];
    }
    const rule = await StockRule.findOneAndUpdate(
      { _id: req.params.id, ...req.tenantFilter },
      { $set: updates },
      { new: true },
    );
    if (!rule) return res.status(404).json({ error: 'Not found' });
    res.json(rule);
  } catch (err) {
    handleError(res, err);
  }
});

// ─── Putaway & storage categories ───────────────────────────────────────────

router.get('/storage-categories', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    res.json(await StockStorageCategory.find({ ...req.tenantFilter }).lean());
  } catch (err) {
    handleError(res, err);
  }
});

router.post('/storage-categories', checkPermission('inventory', 'create'), async (req, res) => {
  try {
    const [row] = await StockStorageCategory.create([{
      tenantId: req.user.tenantId,
      name: req.body.name,
      maxWeight: req.body.maxWeight != null ? String(req.body.maxWeight) : null,
      allowNewProduct: req.body.allowNewProduct || 'mixed',
      createdBy: req.user._id,
    }]);
    res.status(201).json(row);
  } catch (err) {
    handleError(res, err);
  }
});

router.get('/putaway-rules', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const rules = await StockPutawayRule.find({ ...req.tenantFilter })
      .populate(VARIANT_POPULATE)
      .populate('locationInId', 'completeName')
      .populate('locationOutId', 'completeName')
      .sort({ sequence: -1 })
      .lean();
    res.json(rules);
  } catch (err) {
    handleError(res, err);
  }
});

router.post('/putaway-rules', checkPermission('inventory', 'create'), async (req, res) => {
  try {
    const [rule] = await StockPutawayRule.create([{
      tenantId: req.user.tenantId,
      sequence: req.body.sequence ?? 10,
      productId: req.body.productId || null,
      categoryId: req.body.categoryId || null,
      packageTypeId: req.body.packageTypeId || null,
      locationInId: req.body.locationInId,
      locationOutId: req.body.locationOutId,
      storageCategoryId: req.body.storageCategoryId || null,
      createdBy: req.user._id,
    }]);
    res.status(201).json(rule);
  } catch (err) {
    handleError(res, err);
  }
});

// ─── Orderpoints / Replenishment / Scheduler ────────────────────────────────

router.get('/orderpoints', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    res.json(await listReplenishment(req.user.tenantId, req.query));
  } catch (err) {
    handleError(res, err);
  }
});

router.post('/orderpoints', checkPermission('inventory', 'create'), async (req, res) => {
  try {
    const op = await upsertOrderpoint(req.user.tenantId, req.user._id, req.body);
    res.status(201).json(op);
  } catch (err) {
    handleError(res, err);
  }
});

router.post('/orderpoints/:id/snooze', checkPermission('inventory', 'update'), async (req, res) => {
  try {
    const op = await snoozeOrderpoint(req.user.tenantId, req.params.id, req.body);
    res.json(op);
  } catch (err) {
    handleError(res, err);
  }
});

router.post('/orderpoints/order-once', checkPermission('inventory', 'create'), async (req, res) => {
  try {
    const result = await orderOnce(req.user.tenantId, req.user._id, req.body);
    res.status(201).json(result);
  } catch (err) {
    handleError(res, err);
  }
});

router.post('/procurement/run', checkPermission('inventory', 'create'), async (req, res) => {
  try {
    const result = await runProcurement({
      tenantId: req.user.tenantId,
      userId: req.user._id,
      productId: req.body.productId,
      qty: req.body.qty,
      locationId: req.body.locationId,
      dateDeadline: req.body.dateDeadline,
      preferredRouteId: req.body.routeId,
      groupId: req.body.groupId,
    });
    res.status(201).json(result);
  } catch (err) {
    handleError(res, err);
  }
});

router.get('/procurement-groups', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const StockProcurementGroup = (await import('../models/stock/StockProcurementGroup.js')).default;
    const items = await StockProcurementGroup.find({ ...req.tenantFilter }).sort({ createdAt: -1 }).limit(100).lean();
    res.json(items);
  } catch (err) {
    handleError(res, err);
  }
});

router.post('/scheduler/run', checkPermission('inventory', 'update'), async (req, res) => {
  try {
    const run = await runScheduler(req.user.tenantId, req.user._id, { trigger: 'manual' });
    res.json(run);
  } catch (err) {
    handleError(res, err);
  }
});

router.get('/scheduler/runs', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const runs = await StockSchedulerRun.find({ ...req.tenantFilter }).sort({ startedAt: -1 }).limit(20).lean();
    res.json(runs);
  } catch (err) {
    handleError(res, err);
  }
});

// ─── Returns ────────────────────────────────────────────────────────────────

router.get('/pickings/:id/return-wizard', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    res.json(await getReturnWizard(req.user.tenantId, req.params.id));
  } catch (err) {
    handleError(res, err);
  }
});

router.post('/pickings/:id/return', checkPermission('inventory', 'create'), async (req, res) => {
  try {
    const picking = await createReturnPicking(req.user.tenantId, req.user._id, req.params.id, {
      lines: req.body.lines || [],
    });
    res.status(201).json(picking);
  } catch (err) {
    handleError(res, err);
  }
});

// ─── Landed costs (stock engine) ────────────────────────────────────────────

router.get('/landed-costs', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const items = await StockLandedCost.find({ ...req.tenantFilter }).sort({ createdAt: -1 }).lean();
    res.json(items);
  } catch (err) {
    handleError(res, err);
  }
});

router.get('/landed-costs/:id', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const doc = await StockLandedCost.findOne({ _id: req.params.id, ...req.tenantFilter }).lean();
    if (!doc) return res.status(404).json({ error: 'Not found' });
    res.json(doc);
  } catch (err) {
    handleError(res, err);
  }
});

router.post('/landed-costs', checkPermission('inventory', 'create'), async (req, res) => {
  try {
    const doc = await createLandedCost(req.user.tenantId, req.user._id, req.body);
    res.status(201).json(doc);
  } catch (err) {
    handleError(res, err);
  }
});

router.post('/landed-costs/:id/compute', checkPermission('inventory', 'update'), async (req, res) => {
  try {
    res.json(await computeLandedCost(req.user.tenantId, req.params.id));
  } catch (err) {
    handleError(res, err);
  }
});

router.post('/landed-costs/:id/validate', checkPermission('inventory', 'update'), async (req, res) => {
  try {
    res.json(await validateLandedCost(req.user.tenantId, req.params.id));
  } catch (err) {
    handleError(res, err);
  }
});

// ─── Valuation ──────────────────────────────────────────────────────────────

router.get('/valuation/:productId', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const value = await productInventoryValue(req.user.tenantId, req.params.productId);
    const layers = await StockValuationLayer.find({
      ...req.tenantFilter,
      productId: req.params.productId,
    }).sort({ createdAt: -1 }).limit(50).lean();
    res.json({ ...value, layers });
  } catch (err) {
    handleError(res, err);
  }
});

// ─── Barcode nomenclature ───────────────────────────────────────────────────

router.get('/barcode-nomenclatures', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    res.json(await StockBarcodeNomenclature.find({ ...req.tenantFilter }).lean());
  } catch (err) {
    handleError(res, err);
  }
});

router.post('/barcode-nomenclatures', checkPermission('inventory', 'create'), async (req, res) => {
  try {
    const [doc] = await StockBarcodeNomenclature.create([{
      tenantId: req.user.tenantId,
      name: req.body.name || 'Default Nomenclature',
      upcEanConv: req.body.upcEanConv !== false,
      rules: req.body.rules?.length ? req.body.rules : defaultBarcodeRules(),
      createdBy: req.user._id,
    }]);
    res.status(201).json(doc);
  } catch (err) {
    handleError(res, err);
  }
});

router.post('/barcode/parse', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const settings = await StockSettings.findOne({ tenantId: req.user.tenantId }).lean();
    let nom = null;
    if (settings?.barcodeNomenclatureId) {
      nom = await StockBarcodeNomenclature.findById(settings.barcodeNomenclatureId).lean();
    }
    if (!nom) {
      nom = await StockBarcodeNomenclature.findOne({ ...req.tenantFilter, active: true }).lean();
    }
    res.json(matchBarcode(nom || { rules: defaultBarcodeRules() }, req.body.barcode));
  } catch (err) {
    handleError(res, err);
  }
});

// ─── Analysis / Performance ─────────────────────────────────────────────────

router.get('/reports/moves-analysis', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    res.json(await movesAnalysis(req.user.tenantId, req.query));
  } catch (err) {
    handleError(res, err);
  }
});

router.get('/reports/performance', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    res.json(await performanceReport(req.user.tenantId, req.query));
  } catch (err) {
    handleError(res, err);
  }
});

// Print — JSON payload by default; ?format=html for printable slip
router.get('/pickings/:id/print', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const picking = await StockPicking.findOne({ _id: req.params.id, ...req.tenantFilter })
      .populate('operationTypeId')
      .lean();
    if (!picking) return res.status(404).json({ error: 'Not found' });
    const moves = await StockMove.find({ pickingId: picking._id, ...req.tenantFilter })
      .populate(VARIANT_POPULATE)
      .lean();
    const moveLines = await StockMoveLine.find({ pickingId: picking._id, ...req.tenantFilter }).lean();
    await StockPicking.updateOne({ _id: picking._id }, { $set: { printed: true } });
    const printedAt = new Date().toISOString();
    const payload = { title: picking.name, picking, moves, moveLines, printedAt };

    if (String(req.query.format || '').toLowerCase() === 'html') {
      const { buildPickingPrintHtml } = await import('../services/stock/printLayout.js');
      res.type('html').send(buildPickingPrintHtml(payload));
      return;
    }
    res.json(payload);
  } catch (err) {
    handleError(res, err);
  }
});

export default router;
