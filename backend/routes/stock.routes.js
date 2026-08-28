import express from 'express';
import { protect, tenantFilter, requireTenantFilter, checkPermission } from '../middleware/auth.js';
import {
  InvSettings,
  InvLocation,
  InvUom,
  InvUomCategory,
  InvOperationType,
  InvTransfer,
  InvMove,
  InvMoveLine,
  InvQuant,
  InvProductCategory,
  InvProductVariant,
} from '../models/inventory/index.js';
import Warehouse from '../models/Warehouse.js';
import Product from '../models/Product.js';
import Journal from '../models/Journal.js';
import { ensureInventoryBootstrap, enableEngine, bootstrapWarehouse } from '../services/inventory/bootstrap.js';
import { createTransfer } from '../services/inventory/createTransfer.js';
import {
  confirmTransfer,
  validateTransfer,
  checkAvailability,
  unreserveTransfer,
  cancelTransfer,
} from '../services/inventory/transferService.js';
import { computeOnHand, computeForecast } from '../services/inventory/forecast.js';
import { migrateOpeningBalances } from '../services/inventory/migration.js';
import { resolveWarehouseScope, warehouseFilter, assertWarehouseAccess } from '../services/inventory/warehouseScope.js';
import { sendInvError, sendList } from '../services/inventory/apiContract.js';
import { stockMetricsMiddleware } from '../services/inventory/invMetrics.js';
import { D, decStr } from '../utils/decimal.js';
import { stockIdempotency } from '../middleware/stockIdempotency.js';
import { stockQueryBudget } from '../middleware/invQueryBudget.js';
import { stockHeavyLimiter } from '../middleware/stockHeavyLimit.js';
import {
  validateBody,
  validateTransferBody,
  posConsumeBody,
  applyCountsBody,
  integrityRunBody,
} from '../middleware/invValidate.js';
import { listLots, createLot } from '../services/inventory/lotService.js';
import {
  listInventoryQuants,
  setCountedQuantity,
  clearCountedQuantity,
  clearCountedQuantities,
  applyInventoryCounts,
  approveVarianceCounts,
  requestCount,
  previewApplyCounts,
  countLineHistory,
  importCountedQuantities,
} from '../services/inventory/inventoryCount.js';
import { createScrap, validateScrap, validateScrapsBulk, listScraps } from '../services/inventory/scrapService.js';
import { getReturnWizard, createReturnTransfer } from '../services/inventory/returns.js';
import { movesHistory, lotTraceability, productMoveHistory } from '../services/inventory/traceability.js';
import InvScrap from '../models/inventory/InvScrap.js';
import InvLot from '../models/inventory/InvLot.js';
import InvPackageType from '../models/inventory/InvPackageType.js';
import InvPackage from '../models/inventory/InvPackage.js';
import InvProductPackaging from '../models/inventory/InvProductPackaging.js';
import { threeWayMatch } from '../services/inventory/threeWayMatch.js';
import { postPosSaleViaEngine, isInvEngineEnabled } from '../services/inventory/legacyAdapter.js';
import {
  InvRoute,
  InvRule,
  InvReorderRule,
  InvPutawayRule,
  InvStorageCategory,
  InvProcurementGroup,
  InvSchedulerRun,
} from '../models/inventory/index.js';
import {
  listReplenishment,
  upsertReorderRule,
  snoozeReorderRule,
  orderOnce,
  runScheduler,
  getSchedulerStatus,
} from '../services/inventory/scheduler.js';
import { runProcurement } from '../services/inventory/procurement.js';
import { recomputeWarehouseRoutes } from '../services/inventory/warehouseSteps.js';
import { resolvePutawayLocation } from '../services/inventory/putaway.js';
import {
  createLocation,
  updateLocation,
  createOperationType,
  updateOperationType,
  createProductCategory,
  updateProductCategory,
  deleteProductCategory,
  duplicateProductCategory,
} from '../services/inventory/configMasters.js';
import {
  updateInvSettings,
  getInvSettings,
  isSmsProviderConfigured,
  SETTINGS_ALLOWED,
} from '../services/inventory/settingsService.js';

const router = express.Router();

router.use(protect, tenantFilter, requireTenantFilter);
router.use(stockIdempotency());
router.use(stockQueryBudget({ max: 10 }));
router.use(stockMetricsMiddleware());

function handleInventoryError(res, err) {
  return sendInvError(res, err);
}

async function assertMultiLocationsEnabled(tenantId) {
  const settings = await getInvSettings(tenantId);
  if (settings.groupStockMultiLocations === false) {
    const { InventoryValidationError } = await import('../services/inventory/errors.js');
    throw new InventoryValidationError(
      'Storage locations are disabled — enable them in Inventory Settings',
      'MULTI_LOC_OFF',
    );
  }
}

async function assertTransferWarehouseAccess(req, transfer) {
  if (!transfer?.operationTypeId) return;
  const otId = transfer.operationTypeId._id || transfer.operationTypeId;
  const ot = transfer.operationTypeId.warehouseId
    ? transfer.operationTypeId
    : await InvOperationType.findById(otId).select('warehouseId').lean();
  if (ot?.warehouseId) await assertWarehouseAccess(req, ot.warehouseId);
}

// ── Bootstrap / settings ───────────────────────────────────────────

router.post('/bootstrap', checkPermission('inventory', 'update'), async (req, res) => {
  try {
    const result = await ensureInventoryBootstrap(req.user.tenantId, req.user._id);
    res.json(result);
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.post('/enable', checkPermission('inventory', 'update'), async (req, res) => {
  try {
    await ensureInventoryBootstrap(req.user.tenantId, req.user._id);
    const settings = await enableEngine(req.user.tenantId, req.user._id);
    res.json(settings);
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.get('/settings', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const settings = await getInvSettings(req.user.tenantId);
    const smsProviderConfigured = await isSmsProviderConfigured(req.user.tenantId);
    const payload = {
      ...(settings.toObject ? settings.toObject() : settings),
      smsProviderConfigured,
    };
    if (req.query.include === 'effects' || req.query.effects === '1') {
      const { listSettingsEffects, SETTINGS_EFFECTS } = await import('../services/inventory/settingsEffects.js');
      payload.effects = listSettingsEffects();
      payload.effectsCoverage = SETTINGS_ALLOWED.every((k) => SETTINGS_EFFECTS[k]);
    }
    res.json(payload);
  } catch (err) {
    handleInventoryError(res, err);
  }
});

/** Lightweight flag for sell/PoS UIs that may lack inventory:read */
router.get('/engine-status', async (req, res) => {
  try {
    const settings = await InvSettings.findOne({ ...req.tenantFilter })
      .select('engineEnabled enforceWarehouseRestriction')
      .lean();
    res.json({
      engineEnabled: Boolean(settings?.engineEnabled),
      enforceWarehouseRestriction: Boolean(settings?.enforceWarehouseRestriction),
    });
  } catch (err) {
    handleInventoryError(res, err);
  }
});

/** Module health for Overview strip (§3.5) */
router.get('/health', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const { inventoryModuleHealth } = await import('../services/inventory/moduleHealth.js');
    res.json(await inventoryModuleHealth(req.user.tenantId));
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.patch('/settings', checkPermission('inventory', 'update'), async (req, res) => {
  try {
    const settings = await updateInvSettings(req.user.tenantId, req.user._id, req.body);
    const smsProviderConfigured = await isSmsProviderConfigured(req.user.tenantId);
    res.json({
      ...(settings.toObject ? settings.toObject() : settings),
      smsProviderConfigured,
    });
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.post('/migrate-opening-balances', checkPermission('inventory', 'update'), async (req, res) => {
  try {
    const result = await migrateOpeningBalances(req.user.tenantId, {
      userId: req.user._id,
      batchSize: Number(req.body.batchSize) || 50,
      enableEngineAfter: req.body.enableEngineAfter === true,
    });
    res.json(result);
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.post('/warehouses/:id/bootstrap', checkPermission('inventory', 'update'), async (req, res) => {
  try {
    await ensureInventoryBootstrap(req.user.tenantId, req.user._id);
    const wh = await Warehouse.findOne({ _id: req.params.id, ...req.tenantFilter });
    if (!wh) return res.status(404).json({ error: 'Warehouse not found' });
    const result = await bootstrapWarehouse(req.user.tenantId, wh, null, req.user._id);
    res.json(result);
  } catch (err) {
    handleInventoryError(res, err);
  }
});

// ── Locations / UoM / Op types ─────────────────────────────────────

router.get('/locations', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const scope = await resolveWarehouseScope(req);
    const filter = { ...req.tenantFilter, ...warehouseFilter(scope) };
    if (req.query.usage) filter.usage = req.query.usage;
    if (req.query.warehouseId) filter.warehouseId = req.query.warehouseId;
    if (req.query.active !== 'false') filter.active = true;
    const locations = await InvLocation.find(filter)
      .populate('stockValuationAccountId', 'code name nameAr')
      .populate('stockInputAccountId', 'code name nameAr')
      .populate('stockOutputAccountId', 'code name nameAr')
      .sort({ completePath: 1 })
      .lean();
    return sendList(res, locations, {
      appliedFilters: {
        usage: req.query.usage || null,
        warehouseId: req.query.warehouseId || null,
        active: req.query.active !== 'false',
      },
    });
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.get('/locations/:id', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const loc = await InvLocation.findOne({ _id: req.params.id, ...req.tenantFilter })
      .populate('stockValuationAccountId', 'code name nameAr')
      .populate('stockInputAccountId', 'code name nameAr')
      .populate('stockOutputAccountId', 'code name nameAr')
      .lean();
    if (!loc) return res.status(404).json({ error: 'Location not found' });
    res.json(loc);
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.post('/locations', checkPermission('inventory', 'create'), async (req, res) => {
  try {
    await assertMultiLocationsEnabled(req.user.tenantId);
    const loc = await createLocation(req.user.tenantId, req.user._id, req.body);
    res.status(201).json(loc);
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.patch('/locations/:id', checkPermission('inventory', 'update'), async (req, res) => {
  try {
    await assertMultiLocationsEnabled(req.user.tenantId);
    const loc = await updateLocation(req.user.tenantId, req.user._id, req.params.id, req.body);
    res.json(loc);
  } catch (err) {
    handleInventoryError(res, err);
  }
});

/**
 * UI "Ratio" = how many reference units equal 1 of this UoM
 * (e.g. kg ref → g=0.001, t=1000). Storage still uses Odoo factor:
 * qty_ref = qty / factor, so factor = 1 / ratio.
 */
function ratioFromFactor(factor) {
  try {
    const f = D(factor == null || factor === '' ? '1' : factor);
    if (f.lte(0)) return '1';
    return decStr(D(1).div(f));
  } catch {
    return '1';
  }
}

function factorFromRatio(ratio) {
  const r = D(ratio == null || ratio === '' ? '1' : ratio);
  if (r.lte(0)) {
    const err = new Error('Ratio must be positive');
    err.code = 'UOM_RATIO';
    throw err;
  }
  return decStr(D(1).div(r));
}

function deriveUomTypeFromRatio(ratio) {
  const r = D(ratio == null || ratio === '' ? '1' : ratio);
  if (r.eq(1)) return 'reference';
  if (r.gt(1)) return 'bigger';
  return 'smaller';
}

function annotateUomRatio(row) {
  if (!row) return row;
  const ratio = ratioFromFactor(row.factor);
  return { ...row, ratio, isReference: row.uomType === 'reference' || String(ratio) === '1' };
}

async function demoteOtherReferences(tenantId, categoryId, keepId) {
  const others = await InvUom.find({
    tenantId,
    categoryId,
    uomType: 'reference',
    ...(keepId ? { _id: { $ne: keepId } } : {}),
  }).select('_id factor').lean();
  for (const u of others) {
    const nextType = deriveUomTypeFromRatio(ratioFromFactor(u.factor));
    await InvUom.updateOne(
      { _id: u._id },
      { $set: { uomType: nextType === 'reference' ? 'bigger' : nextType } },
    );
  }
}

async function uomHasActiveInventory(tenantFilter, uomId) {
  const Product = (await import('../models/Product.js')).default;
  const productIds = await Product.find({
    ...tenantFilter,
    $or: [{ uomId }, { purchaseUomId: uomId }],
  }).distinct('_id');
  if (!productIds.length) return false;
  const activeStock = await InvQuant.findOne({
    ...tenantFilter,
    productId: { $in: productIds },
    $expr: { $gt: [{ $toDouble: { $ifNull: ['$quantity', '0'] } }, 0] },
  }).select('_id').lean();
  return Boolean(activeStock);
}

router.get('/uom-categories', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const cats = await InvUomCategory.find({ ...req.tenantFilter }).sort({ name: 1 }).lean();
    if (!cats.length) return sendList(res, []);
    const catIds = cats.map((c) => c._id);
    const [counts, refs] = await Promise.all([
      InvUom.aggregate([
        { $match: { ...req.tenantFilter, categoryId: { $in: catIds } } },
        { $group: { _id: '$categoryId', total: { $sum: 1 } } },
      ]),
      InvUom.find({
        ...req.tenantFilter,
        categoryId: { $in: catIds },
        uomType: 'reference',
      }).select('name nameAr categoryId factor').lean(),
    ]);
    const countBy = new Map(counts.map((c) => [String(c._id), c.total]));
    const refBy = new Map(refs.map((r) => [String(r.categoryId), r]));
    return sendList(res, cats.map((c) => {
      const ref = refBy.get(String(c._id));
      return {
        ...c,
        uomCount: countBy.get(String(c._id)) || 0,
        referenceUom: ref
          ? { _id: ref._id, name: ref.name, nameAr: ref.nameAr, ratio: ratioFromFactor(ref.factor) }
          : null,
      };
    }));
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.get('/uom-categories/:id', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const cat = await InvUomCategory.findOne({ _id: req.params.id, ...req.tenantFilter }).lean();
    if (!cat) return res.status(404).json({ error: 'Category not found', code: 'UOM_CAT_NOT_FOUND' });
    const ref = await InvUom.findOne({
      ...req.tenantFilter,
      categoryId: cat._id,
      uomType: 'reference',
    }).select('name nameAr factor').lean();
    const uomCount = await InvUom.countDocuments({ ...req.tenantFilter, categoryId: cat._id });
    res.json({
      ...cat,
      uomCount,
      referenceUom: ref
        ? { _id: ref._id, name: ref.name, nameAr: ref.nameAr, ratio: ratioFromFactor(ref.factor) }
        : null,
    });
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.post('/uom-categories', checkPermission('inventory', 'create'), async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    if (!name) return res.status(400).json({ error: 'Name required', code: 'UOM_CAT_NAME' });
    const measureType = [
      'unit', 'weight', 'volume', 'length', 'time', 'workingTime',
    ].includes(req.body.measureType)
      ? req.body.measureType
      : 'unit';
    const cat = await InvUomCategory.create({
      tenantId: req.user.tenantId,
      name,
      nameAr: req.body.nameAr,
      measureType,
      createdBy: req.user._id,
    });
    res.status(201).json(cat);
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.get('/uoms', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const filter = { ...req.tenantFilter };
    if (req.query.categoryId) filter.categoryId = req.query.categoryId;
    if (req.query.active !== 'false') filter.active = true;
    const rows = await InvUom.find(filter).populate('categoryId', 'name nameAr').sort({ name: 1 }).lean();

    // Annotate UoMs that have products with on-hand stock (for Ratio/Rounding UI lock)
    if (req.query.stockGuard === '1' && rows.length) {
      const Product = (await import('../models/Product.js')).default;
      const uomIds = rows.map((u) => u._id);
      const products = await Product.find({
        ...req.tenantFilter,
        $or: [{ uomId: { $in: uomIds } }, { purchaseUomId: { $in: uomIds } }],
      }).select('_id uomId purchaseUomId').lean();
      const productIds = products.map((p) => p._id);
      const activeProductIds = new Set();
      if (productIds.length) {
        const quants = await InvQuant.aggregate([
          {
            $match: {
              ...req.tenantFilter,
              productId: { $in: productIds },
            },
          },
          {
            $group: {
              _id: '$productId',
              qty: { $sum: { $toDouble: { $ifNull: ['$quantity', '0'] } } },
            },
          },
          { $match: { qty: { $gt: 0 } } },
        ]);
        for (const q of quants) activeProductIds.add(String(q._id));
      }
      const lockedUomIds = new Set();
      for (const p of products) {
        if (!activeProductIds.has(String(p._id))) continue;
        if (p.uomId) lockedUomIds.add(String(p.uomId));
        if (p.purchaseUomId) lockedUomIds.add(String(p.purchaseUomId));
      }
      for (const u of rows) {
        u.hasActiveStock = lockedUomIds.has(String(u._id));
      }
    }

    return sendList(res, rows.map(annotateUomRatio));
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.post('/uoms', checkPermission('inventory', 'create'), async (req, res) => {
  try {
    const { InventoryValidationError } = await import('../services/inventory/errors.js');
    const name = String(req.body.name || '').trim();
    const categoryId = req.body.categoryId;
    if (!name) throw new InventoryValidationError('UoM name required', 'UOM_NAME');
    if (!categoryId) throw new InventoryValidationError('Category required', 'UOM_CATEGORY_REQ');

    const cat = await InvUomCategory.findOne({ _id: categoryId, ...req.tenantFilter }).lean();
    if (!cat) throw new InventoryValidationError('Category not found', 'UOM_CAT_NOT_FOUND');

    let ratio = req.body.ratio != null && req.body.ratio !== ''
      ? String(req.body.ratio)
      : null;
    let factor = req.body.factor != null && req.body.factor !== ''
      ? String(req.body.factor)
      : null;

    try {
      if (ratio != null) {
        factor = factorFromRatio(ratio);
      } else if (factor != null) {
        ratio = ratioFromFactor(factor);
      } else {
        ratio = '1';
        factor = '1';
      }
    } catch (e) {
      if (e.code === 'UOM_RATIO') {
        throw new InventoryValidationError(e.message, 'UOM_RATIO');
      }
      throw e;
    }

    let wantReference = req.body.isReference === true
      || req.body.uomType === 'reference'
      || D(ratio).eq(1);

    const existingRef = await InvUom.findOne({
      ...req.tenantFilter,
      categoryId,
      uomType: 'reference',
    }).select('_id name').lean();

    if (!wantReference && !existingRef) {
      // First unit in a category becomes the reference anchor
      wantReference = true;
      ratio = '1';
      factor = '1';
    }

    if (wantReference) {
      ratio = '1';
      factor = '1';
    }

    const uomType = wantReference || D(ratio).eq(1)
      ? 'reference'
      : deriveUomTypeFromRatio(ratio);

    if (uomType === 'reference') {
      await demoteOtherReferences(req.user.tenantId, categoryId, null);
    }

    const uom = await InvUom.create({
      tenantId: req.user.tenantId,
      name,
      nameAr: req.body.nameAr,
      categoryId,
      uomType,
      factor,
      rounding: req.body.rounding != null ? String(req.body.rounding) : '0.01',
      externalCode: req.body.externalCode,
      active: req.body.active !== false,
      createdBy: req.user._id,
    });
    res.status(201).json(annotateUomRatio(uom.toObject ? uom.toObject() : uom));
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.patch('/uoms/:id', checkPermission('inventory', 'update'), async (req, res) => {
  try {
    const { InventoryValidationError } = await import('../services/inventory/errors.js');
    const existing = await InvUom.findOne({ _id: req.params.id, ...req.tenantFilter }).lean();
    if (!existing) return res.status(404).json({ error: 'UoM not found' });

    const $set = { updatedBy: req.user._id };

    try {
      if (req.body.ratio !== undefined) {
        const ratio = String(req.body.ratio);
        $set.factor = factorFromRatio(ratio);
        $set.uomType = deriveUomTypeFromRatio(ratio);
      } else if (req.body.factor !== undefined) {
        $set.factor = String(req.body.factor);
        if (req.body.uomType === undefined) {
          $set.uomType = deriveUomTypeFromRatio(ratioFromFactor($set.factor));
        }
      }
    } catch (e) {
      if (e.code === 'UOM_RATIO') {
        throw new InventoryValidationError(e.message, 'UOM_RATIO');
      }
      throw e;
    }

    if (req.body.isReference === true || req.body.uomType === 'reference') {
      $set.factor = '1';
      $set.uomType = 'reference';
    } else if (req.body.uomType !== undefined && req.body.ratio === undefined && req.body.factor === undefined) {
      $set.uomType = req.body.uomType;
      if (req.body.uomType === 'reference') {
        $set.factor = '1';
      }
    }

    if (req.body.rounding !== undefined) $set.rounding = String(req.body.rounding);
    if (req.body.name !== undefined) $set.name = req.body.name;
    if (req.body.nameAr !== undefined) $set.nameAr = req.body.nameAr;
    if (req.body.externalCode !== undefined) $set.externalCode = req.body.externalCode;
    if (req.body.active !== undefined) $set.active = req.body.active;

    const factorChanged = $set.factor !== undefined && String($set.factor) !== String(existing.factor);
    const roundingChanged = $set.rounding !== undefined && String($set.rounding) !== String(existing.rounding);
    if (factorChanged || roundingChanged) {
      if (await uomHasActiveInventory(req.tenantFilter, existing._id)) {
        return res.status(409).json({
          error: 'Cannot modify a UOM that has active inventory, as this will corrupt historical valuations.',
          code: 'UOM_ACTIVE_STOCK',
          messageAr: 'لا يمكن تعديل وحدة قياس لها مخزون نشط، لأن ذلك يفسد التقييمات التاريخية.',
        });
      }
    }

    if ($set.uomType === 'reference') {
      await demoteOtherReferences(req.user.tenantId, existing.categoryId, existing._id);
    }

    const uom = await InvUom.findOneAndUpdate(
      { _id: req.params.id, ...req.tenantFilter },
      { $set },
      { new: true },
    ).lean();
    if (!uom) return res.status(404).json({ error: 'UoM not found' });
    res.json(annotateUomRatio(uom));
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.get('/operation-types', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const scope = await resolveWarehouseScope(req);
    const filter = { ...req.tenantFilter, ...warehouseFilter(scope) };
    if (req.query.code) filter.code = req.query.code;
    if (req.query.warehouseId) filter.warehouseId = req.query.warehouseId;
    if (req.query.active !== 'false') filter.active = true;
    return sendList(
      res,
      await InvOperationType.find(filter)
        .populate('warehouseId', 'code nameEn nameAr name')
        .sort({ name: 1 })
        .lean(),
    );
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.get('/operation-types/:id', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const ot = await InvOperationType.findOne({ _id: req.params.id, ...req.tenantFilter }).lean();
    if (!ot) return res.status(404).json({ error: 'Operation type not found' });
    res.json(ot);
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.post('/operation-types', checkPermission('inventory', 'create'), async (req, res) => {
  try {
    const ot = await createOperationType(req.user.tenantId, req.user._id, req.body);
    res.status(201).json(ot);
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.patch('/operation-types/:id', checkPermission('inventory', 'update'), async (req, res) => {
  try {
    const ot = await updateOperationType(req.user.tenantId, req.user._id, req.params.id, req.body);
    res.json(ot);
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.get('/product-categories', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    // Ensure Journal schema is registered for stockJournalId populate
    void Journal;
    return sendList(
      res,
      await InvProductCategory.find({ ...req.tenantFilter })
        .populate('incomeAccountId', 'code name nameAr')
        .populate('expenseAccountId', 'code name nameAr')
        .populate('priceDifferenceAccountId', 'code name nameAr')
        .populate('stockValuationAccountId', 'code name nameAr')
        .populate({ path: 'stockJournalId', select: 'code name nameAr type', options: { strictPopulate: false } })
        .populate('stockInputAccountId', 'code name nameAr')
        .populate('stockOutputAccountId', 'code name nameAr')
        .sort({ completePath: 1 })
        .lean(),
    );
  } catch (err) {
    // Fallback without journal populate if COA/journal refs are broken
    try {
      return sendList(
        res,
        await InvProductCategory.find({ ...req.tenantFilter }).sort({ completePath: 1 }).lean(),
      );
    } catch (err2) {
      handleInventoryError(res, err2);
    }
  }
});

/** Top-used categories for this tenant (product.categoryId counts). */
router.get('/product-categories/popular', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const Product = (await import('../models/Product.js')).default;
    const rows = await Product.aggregate([
      { $match: { tenantId: req.user.tenantId, categoryId: { $ne: null } } },
      { $group: { _id: '$categoryId', n: { $sum: 1 } } },
      { $sort: { n: -1 } },
      { $limit: 8 },
    ]);
    const ids = [];
    const seen = new Set();
    for (const r of rows) {
      const key = String(r._id);
      if (seen.has(key)) continue;
      seen.add(key);
      ids.push(r._id);
    }
    const cats = await InvProductCategory.find({ ...req.tenantFilter, _id: { $in: ids } }).lean();
    const byId = new Map(cats.map((c) => [String(c._id), c]));
    return sendList(res, ids.map((id) => byId.get(String(id))).filter(Boolean));
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.get('/product-categories/:id', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const cat = await InvProductCategory.findOne({ _id: req.params.id, ...req.tenantFilter })
      .populate('incomeAccountId', 'code name nameAr')
      .populate('expenseAccountId', 'code name nameAr')
      .populate('priceDifferenceAccountId', 'code name nameAr')
      .populate('stockValuationAccountId', 'code name nameAr')
      .populate('stockJournalId', 'code name nameAr type')
      .populate('stockInputAccountId', 'code name nameAr')
      .populate('stockOutputAccountId', 'code name nameAr')
      .lean();
    if (!cat) return res.status(404).json({ error: 'Category not found' });
    res.json(cat);
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.get('/product-categories/:id/costing-preview', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const { previewCategoryCostingDelta } = await import('../services/inventory/costingPreview.js');
    res.json(await previewCategoryCostingDelta(
      req.user.tenantId,
      req.params.id,
      req.query.costingMethod || req.query.method,
    ));
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.post('/product-categories', checkPermission('inventory', 'create'), async (req, res) => {
  try {
    const cat = await createProductCategory(req.user.tenantId, req.user._id, req.body);
    res.status(201).json(cat);
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.patch('/product-categories/:id', checkPermission('inventory', 'update'), async (req, res) => {
  try {
    const cat = await updateProductCategory(req.user.tenantId, req.user._id, req.params.id, req.body);
    res.json(cat);
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.post('/product-categories/:id/duplicate', checkPermission('inventory', 'create'), async (req, res) => {
  try {
    const cat = await duplicateProductCategory(req.user.tenantId, req.user._id, req.params.id, {
      nameSuffix: req.body?.nameSuffix,
    });
    res.status(201).json(cat);
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.delete('/product-categories/:id', checkPermission('inventory', 'delete'), async (req, res) => {
  try {
    res.json(await deleteProductCategory(req.user.tenantId, req.params.id));
  } catch (err) {
    handleInventoryError(res, err);
  }
});

// ── Transfers ──────────────────────────────────────────────────────

/** Aggregated open-transfer counts for inventory overview (same builder as list). */
router.get('/transfer-counts', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const scope = await resolveWarehouseScope(req);
    const { countTransfersByCodeAndState } = await import('../services/inventory/transferQuery.js');
    res.json(await countTransfersByCodeAndState(req.user.tenantId, scope));
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.get('/transfers', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const scope = await resolveWarehouseScope(req);
    const { listTransfers } = await import('../services/inventory/transferQuery.js');
    const payload = await listTransfers(req.user.tenantId, req.query, scope);
    return sendList(res, payload.data, {
      total: payload._meta.total,
      page: payload._meta.page,
      pageSize: payload._meta.pageSize,
      appliedFilters: payload._meta.appliedFilters || {},
      nextCursor: payload._meta.nextCursor,
    });
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.get('/transfers/:id/print-context', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const transfer = await InvTransfer.findOne({ _id: req.params.id, ...req.tenantFilter })
      .populate('operationTypeId', 'warehouseId code')
      .lean();
    if (!transfer) return res.status(404).json({ error: 'Transfer not found' });
    await assertTransferWarehouseAccess(req, transfer);
    const { getTransferPrintContext } = await import('../services/inventory/printContext.js');
    res.json(await getTransferPrintContext(req.user.tenantId, req.params.id));
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.get('/transfers/:id', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const transfer = await InvTransfer.findOne({ _id: req.params.id, ...req.tenantFilter })
      .populate('operationTypeId')
      .populate('carrierId', 'name nameAr carrierType fixedPrice providerCode installed')
      .populate('sourceLocationId', 'name completePath usage warehouseId')
      .populate('destLocationId', 'name completePath usage warehouseId')
      .lean();
    if (!transfer) return res.status(404).json({ error: 'Transfer not found' });
    await assertTransferWarehouseAccess(req, transfer);
    const moves = await InvMove.find({ tenantId: req.user.tenantId, transferId: transfer._id })
      .populate('productId', 'nameEn nameAr sku barcode unitOfMeasure tracking uomId attributeLines')
      .populate('variantId', 'name nameAr sku barcode')
      .populate('uomId', 'name nameAr')
      .populate('sourceLocationId', 'name completePath')
      .populate('destLocationId', 'name completePath')
      .lean();
    const moveLines = await InvMoveLine.find({
      tenantId: req.user.tenantId,
      transferId: transfer._id,
    })
      .populate('lotId', 'name')
      .populate('packageId', 'name')
      .lean();
    const { resolveTransferPartner } = await import('../services/inventory/partnerResolve.js');
    const partner = await resolveTransferPartner(
      req.user.tenantId,
      transfer.partnerId,
      transfer.operationTypeId?.code,
    );
    const settings = await getInvSettings(req.user.tenantId);
    res.json({
      ...transfer,
      moves,
      moveLines,
      partner,
      settingsHints: {
        multiLocations: settings.groupStockMultiLocations !== false,
        barcode: !!settings.groupStockBarcode,
        signatureRequired: !!(settings.signatureOnDelivery || settings.groupStockSignDelivery),
        partnerWarnings: !!settings.groupStockWarning,
        showDetailedOps: !!transfer.operationTypeId?.showDetailedOperations,
        lotsEnabled: !!(settings.groupProductionLot || settings.groupStockTrackingLot),
        packagesEnabled: !!(settings.groupStockTrackingLot || settings.groupStockPackaging),
        showLotsOnDeliverySlips: !!(settings.showLotsOnDeliverySlips || settings.groupLotOnDeliverySlip),
        emailConfirmationOnDelivery: !!settings.emailConfirmationOnDelivery,
        stockSmsConfirmation: !!settings.stockSmsConfirmation,
        variantsEnabled: !!settings.groupProductVariant,
        deliveryMethods: !!settings.groupDeliveryMethods,
        qualityEnabled: !!settings.moduleQuality,
        ownerTracking: !!settings.groupStockTrackingOwner,
      },
    });
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.patch('/transfers/:id', checkPermission('inventory', 'update'), async (req, res) => {
  try {
    const transfer = await InvTransfer.findOne({ _id: req.params.id, ...req.tenantFilter });
    if (!transfer) return res.status(404).json({ error: 'Transfer not found' });
    await assertTransferWarehouseAccess(req, transfer);

    if (transfer.state === 'done' || transfer.state === 'cancelled') {
      // Only chatter-like note append + signature metadata allowed when done
      if (req.body.logNote) {
        transfer.note = [transfer.note, `[note ${new Date().toISOString()}] ${req.body.logNote}`].filter(Boolean).join('\n');
      }
      if (req.body.signature != null && !transfer.signature) {
        transfer.signature = req.body.signature;
        transfer.signedBy = req.body.signedBy || req.user.name || req.user.email;
        transfer.signedOn = new Date();
      }
      transfer.updatedBy = req.user._id;
      await transfer.save();
      return res.json(transfer);
    }

    if (transfer.state === 'draft') {
      if (req.body.operationTypeId) {
        const ot = await InvOperationType.findOne({
          _id: req.body.operationTypeId,
          ...req.tenantFilter,
          active: true,
        });
        if (!ot) return res.status(400).json({ error: 'Operation type not found' });
        transfer.operationTypeId = ot._id;
        if (ot.defaultSourceLocationId) transfer.sourceLocationId = ot.defaultSourceLocationId;
        if (ot.defaultDestLocationId) transfer.destLocationId = ot.defaultDestLocationId;
      }
      if (req.body.sourceLocationId) transfer.sourceLocationId = req.body.sourceLocationId;
      if (req.body.destLocationId) transfer.destLocationId = req.body.destLocationId;
      if (req.body.partnerId !== undefined) transfer.partnerId = req.body.partnerId || null;
      if (req.body.ownerId !== undefined) transfer.ownerId = req.body.ownerId || null;
      if (req.body.scheduledDate) transfer.scheduledDate = new Date(req.body.scheduledDate);
      if (req.body.deadlineDate !== undefined) {
        transfer.deadlineDate = req.body.deadlineDate ? new Date(req.body.deadlineDate) : null;
      }
      if (req.body.origin !== undefined) transfer.origin = req.body.origin;
      if (req.body.priority) transfer.priority = req.body.priority;
    }

    if (req.body.note !== undefined) transfer.note = req.body.note;
    if (req.body.logNote) {
      transfer.note = [transfer.note, `[note ${new Date().toISOString()}] ${req.body.logNote}`].filter(Boolean).join('\n');
    }
    if (req.body.signature != null) {
      transfer.signature = req.body.signature;
      transfer.signedBy = req.body.signedBy || req.user.name || req.user.email;
      transfer.signedOn = new Date();
    }
    if (req.body.responsibleId !== undefined) transfer.responsibleId = req.body.responsibleId || null;
    if (req.body.carrierId !== undefined) transfer.carrierId = req.body.carrierId || null;
    if (req.body.trackingReference !== undefined) transfer.trackingReference = req.body.trackingReference;
    if (req.body.shippingWeight !== undefined) transfer.shippingWeight = req.body.shippingWeight;
    if (req.body.shippingCost !== undefined) {
      transfer.shippingCost = req.body.shippingCost === null || req.body.shippingCost === ''
        ? undefined
        : String(req.body.shippingCost);
    }

    transfer.updatedBy = req.user._id;
    await transfer.save();
    res.json(transfer);
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.post('/transfers/:id/signature', checkPermission('inventory', 'update'), async (req, res) => {
  try {
    const transfer = await InvTransfer.findOne({ _id: req.params.id, ...req.tenantFilter });
    if (!transfer) return res.status(404).json({ error: 'Transfer not found' });
    if (!req.body.signature) return res.status(400).json({ error: 'signature required' });
    transfer.signature = req.body.signature;
    transfer.signedBy = req.body.signedBy || req.user.name || req.user.email;
    transfer.signedOn = new Date();
    transfer.updatedBy = req.user._id;
    await transfer.save();
    res.json(transfer);
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.post('/transfers', checkPermission('inventory', 'create'), async (req, res) => {
  try {
    if (req.body.operationTypeId) {
      const ot = await InvOperationType.findOne({
        _id: req.body.operationTypeId,
        ...req.tenantFilter,
      }).select('warehouseId').lean();
      if (ot?.warehouseId) await assertWarehouseAccess(req, ot.warehouseId);
    }
    const transfer = await createTransfer(req.user.tenantId, req.body, req.user._id);
    res.status(201).json(transfer);
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.post('/transfers/:id/confirm', checkPermission('inventory', 'update'), async (req, res) => {
  try {
    const transfer = await InvTransfer.findOne({ _id: req.params.id, ...req.tenantFilter });
    if (!transfer) return res.status(404).json({ error: 'Transfer not found' });
    await assertTransferWarehouseAccess(req, transfer);
    res.json(await confirmTransfer(req.user.tenantId, req.params.id, req.user._id));
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.post('/transfers/:id/check-availability', checkPermission('inventory', 'update'), async (req, res) => {
  try {
    const transfer = await InvTransfer.findOne({ _id: req.params.id, ...req.tenantFilter });
    if (!transfer) return res.status(404).json({ error: 'Transfer not found' });
    await assertTransferWarehouseAccess(req, transfer);
    res.json(await checkAvailability(req.user.tenantId, req.params.id));
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.post('/transfers/:id/unreserve', checkPermission('inventory', 'update'), async (req, res) => {
  try {
    const transfer = await InvTransfer.findOne({ _id: req.params.id, ...req.tenantFilter });
    if (!transfer) return res.status(404).json({ error: 'Transfer not found' });
    await assertTransferWarehouseAccess(req, transfer);
    res.json(await unreserveTransfer(req.user.tenantId, req.params.id));
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.post('/transfers/:id/validate', checkPermission('inventory', 'update'), validateBody(validateTransferBody), async (req, res) => {
  try {
    const transfer = await InvTransfer.findOne({ _id: req.params.id, ...req.tenantFilter });
    if (!transfer) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Transfer not found', messageAr: 'التحويل غير موجود' } });
    await assertTransferWarehouseAccess(req, transfer);
    res.json(await validateTransfer(req.user.tenantId, req.params.id, {
      userId: req.user._id,
      createBackorder: typeof req.validatedBody.createBackorder === 'boolean'
        ? (req.validatedBody.createBackorder ? 'always' : 'never')
        : req.validatedBody.createBackorder,
      immediate: req.validatedBody.immediate === true,
      moveQuantities: Array.isArray(req.validatedBody.moveQuantities)
        ? req.validatedBody.moveQuantities
        : undefined,
    }));
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.post('/transfers/:id/cancel', checkPermission('inventory', 'update'), async (req, res) => {
  try {
    const transfer = await InvTransfer.findOne({ _id: req.params.id, ...req.tenantFilter });
    if (!transfer) return res.status(404).json({ error: 'Transfer not found' });
    await assertTransferWarehouseAccess(req, transfer);
    const { cancelTransfer } = await import('../services/inventory/transferService.js');
    res.json(await cancelTransfer(req.user.tenantId, req.params.id, req.user._id, {
      reason: req.body?.reason || req.body?.cancelReason || null,
    }));
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.post('/transfers/:id/duplicate', checkPermission('inventory', 'create'), async (req, res) => {
  try {
    const transfer = await InvTransfer.findOne({ _id: req.params.id, ...req.tenantFilter });
    if (!transfer) return res.status(404).json({ error: 'Transfer not found' });
    await assertTransferWarehouseAccess(req, transfer);
    const { duplicateTransfer } = await import('../services/inventory/transferService.js');
    const doc = await duplicateTransfer(req.user.tenantId, req.params.id, req.user._id);
    res.status(201).json(doc);
  } catch (err) {
    handleInventoryError(res, err);
  }
});

// ── Stock report / forecast ────────────────────────────────────────

router.get('/report/stock', checkPermission('inventory', 'read'), stockHeavyLimiter, async (req, res) => {
  try {
    if (req.query.asOf) {
      const { inventoryAtDate } = await import('../services/inventory/reporting.js');
      const warehouseId = req.query.warehouseId || undefined;
      if (warehouseId) await assertWarehouseAccess(req, warehouseId);
      return res.json(await inventoryAtDate(req.user.tenantId, {
        asOf: req.query.asOf,
        warehouseId,
      }));
    }

    const scope = await resolveWarehouseScope(req);
    const locFilter = {
      ...req.tenantFilter,
      usage: 'internal',
      active: true,
      ...warehouseFilter(scope),
    };
    if (req.query.warehouseId) locFilter.warehouseId = req.query.warehouseId;
    const locs = await InvLocation.find(locFilter).select('_id').lean();
    const locIds = locs.map((l) => l._id);

    const { stockReportLive } = await import('../services/inventory/reporting.js');
    return res.json(await stockReportLive(req.user.tenantId, {
      warehouseId: req.query.warehouseId,
      locIds,
    }));
  } catch (err) {
    handleInventoryError(res, err);
  }
});

/** Inline On Hand — adjustment transfer only (never direct quant write). */
router.post('/report/stock/:productId/adjust', checkPermission('inventory', 'update'), async (req, res) => {
  try {
    const productId = req.params.productId;
    const warehouseId = req.body.warehouseId;
    const newQty = D(req.body.onHand);
    if (!warehouseId) return res.status(400).json({ error: 'warehouseId required' });
    await assertWarehouseAccess(req, warehouseId);

    const wh = await Warehouse.findOne({ _id: warehouseId, ...req.tenantFilter });
    if (!wh?.stockLocationId) {
      return res.status(400).json({ error: 'Warehouse not bootstrapped' });
    }

    const current = await computeOnHand(req.user.tenantId, productId, { warehouseId });
    const diff = newQty.minus(D(current.onHand));
    if (diff.isZero()) return res.json({ onHand: current.onHand, adjusted: false });

    const adjLoc = await InvLocation.findOne({ ...req.tenantFilter, usage: 'inventoryLoss' });
    const code = (wh.code || 'WH').toUpperCase();
    const opType = await InvOperationType.findOne({
      ...req.tenantFilter,
      sequenceCode: `${code}/ADJ`,
    });
    if (!adjLoc || !opType) {
      return res.status(400).json({ error: 'Adjustment configuration missing — run bootstrap' });
    }

    const isGain = diff.gt(0);
    const variantId = req.body.variantId || null;
    const { assertStockMoveVariant } = await import('../services/inventory/variantGuard.js');
    const resolvedVariantId = await assertStockMoveVariant(req.user.tenantId, {
      productId,
      variantId,
      allowAutoSingle: false,
    });
    const transfer = await createTransfer(req.user.tenantId, {
      operationTypeId: opType._id,
      sourceLocationId: isGain ? adjLoc._id : wh.stockLocationId,
      destLocationId: isGain ? wh.stockLocationId : adjLoc._id,
      origin: 'Stock report adjustment',
      note: req.body.reason || 'Inline on-hand edit',
      sourceModel: 'stockReport',
      lines: [{ productId, variantId: resolvedVariantId || undefined, demandQty: decStr(diff.abs()) }],
    }, req.user._id);

    await confirmTransfer(req.user.tenantId, transfer._id, req.user._id);
    await validateTransfer(req.user.tenantId, transfer._id, {
      userId: req.user._id,
      immediate: true,
      createBackorder: false,
    });

    const after = await computeOnHand(req.user.tenantId, productId, { warehouseId });
    res.json({ onHand: after.onHand, adjusted: true, transferId: transfer._id });
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.get('/products/:productId/forecast', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    res.json(await computeForecast(req.user.tenantId, req.params.productId, {
      warehouseId: req.query.warehouseId,
    }));
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.get('/products/:productId/on-hand', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    res.json(await computeOnHand(req.user.tenantId, req.params.productId, {
      warehouseId: req.query.warehouseId,
      locationId: req.query.locationId,
    }));
  } catch (err) {
    handleInventoryError(res, err);
  }
});

/** Aggregate counts for product form smart buttons */
router.get('/products/:productId/smart-buttons', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const productId = req.params.productId;
    const tid = req.user.tenantId;
    const [onHand, forecast, reorderCount, lotCount, moveCount, putawayCount, variantCount] = await Promise.all([
      computeOnHand(tid, productId),
      computeForecast(tid, productId),
      InvReorderRule.countDocuments({ tenantId: tid, productId }),
      InvLot.countDocuments({ tenantId: tid, productId }),
      InvMove.countDocuments({ tenantId: tid, productId, state: { $ne: 'cancelled' } }),
      InvPutawayRule.countDocuments({ tenantId: tid, productId }),
      InvProductVariant.countDocuments({ tenantId: tid, productId, active: true }),
    ]);
    // Template On Hand = sum of child variant quants when variants exist (exclude orphan template-level stock)
    const onHandResolved = variantCount > 0
      ? await computeOnHand(tid, productId, { sumVariantsOnly: true })
      : onHand;
    res.json({
      onHand: onHandResolved.onHand,
      forecasted: forecast.forecasted ?? forecast.forecast,
      incoming: forecast.incoming,
      outgoing: forecast.outgoing,
      reorderRules: reorderCount,
      lots: lotCount,
      moves: moveCount,
      putawayRules: putawayCount,
      variants: variantCount,
      onHandIsVariantSum: variantCount > 0,
    });
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.get('/quants', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const scope = await resolveWarehouseScope(req);
    const locFilter = {
      ...req.tenantFilter,
      usage: 'internal',
      active: true,
      ...warehouseFilter(scope),
    };
    if (req.query.warehouseId) locFilter.warehouseId = req.query.warehouseId;
    const locs = await InvLocation.find(locFilter).select('_id').lean();
    const filter = {
      ...req.tenantFilter,
      locationId: { $in: locs.map((l) => l._id) },
    };
    if (req.query.productId) filter.productId = req.query.productId;
    const rows = await InvQuant.find(filter)
      .populate('productId', 'nameEn nameAr sku')
      .populate('locationId', 'name completePath')
      .limit(500)
      .lean();
    return sendList(res, rows, {
      total: rows.length,
      pageSize: 500,
      appliedFilters: {
        warehouseId: req.query.warehouseId || null,
        productId: req.query.productId || null,
      },
    });
  } catch (err) {
    handleInventoryError(res, err);
  }
});

// ── Lots / serials ─────────────────────────────────────────────────

router.get('/lots', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const result = await listLots(req.user.tenantId, {
      productId: req.query.productId,
      q: req.query.q,
      page: req.query.page,
      limit: req.query.limit,
    });
    return sendList(res, result.items, {
      total: result.total,
      page: result.page,
      pageSize: result.limit,
      appliedFilters: {
        productId: req.query.productId || null,
        q: req.query.q || null,
      },
    });
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.post('/lots', checkPermission('inventory', 'create'), async (req, res) => {
  try {
    res.status(201).json(await createLot(req.user.tenantId, req.user._id, req.body));
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.get('/lots/:id', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const lot = await InvLot.findOne({ _id: req.params.id, ...req.tenantFilter })
      .populate('productId', 'nameEn nameAr sku tracking')
      .lean();
    if (!lot) return res.status(404).json({ error: 'Lot not found' });
    res.json(lot);
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.get('/lots/:id/traceability', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const tree = await lotTraceability(req.user.tenantId, req.params.id);
    if (!tree) return res.status(404).json({ error: 'Lot not found' });
    res.json(tree);
  } catch (err) {
    handleInventoryError(res, err);
  }
});

// ── Product attributes & variants ──────────────────────────────────

router.get('/attributes', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const { listAttributes } = await import('../services/inventory/variants.js');
    const items = await listAttributes(req.user.tenantId, {
      activeOnly: req.query.active !== 'false',
    });
    return sendList(res, items);
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.post('/attributes', checkPermission('inventory', 'create'), async (req, res) => {
  try {
    const { createAttribute } = await import('../services/inventory/variants.js');
    res.status(201).json(await createAttribute(req.user.tenantId, req.user._id, req.body));
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.get('/attributes/:id', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const { getAttribute } = await import('../services/inventory/variants.js');
    res.json(await getAttribute(req.user.tenantId, req.params.id));
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.patch('/attributes/:id', checkPermission('inventory', 'update'), async (req, res) => {
  try {
    const { updateAttribute } = await import('../services/inventory/variants.js');
    res.json(await updateAttribute(req.user.tenantId, req.params.id, req.user._id, req.body));
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.delete('/attributes/:id', checkPermission('inventory', 'delete'), async (req, res) => {
  try {
    const { deleteAttribute } = await import('../services/inventory/variants.js');
    res.json(await deleteAttribute(req.user.tenantId, req.params.id));
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.get('/attributes/:id/values', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const { listAttributeValues } = await import('../services/inventory/variants.js');
    return sendList(res, await listAttributeValues(req.user.tenantId, req.params.id));
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.post('/attributes/:id/values', checkPermission('inventory', 'create'), async (req, res) => {
  try {
    const { createAttributeValue } = await import('../services/inventory/variants.js');
    res.status(201).json(await createAttributeValue(
      req.user.tenantId,
      req.user._id,
      req.params.id,
      req.body,
    ));
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.patch('/attribute-values/:id', checkPermission('inventory', 'update'), async (req, res) => {
  try {
    const { updateAttributeValue } = await import('../services/inventory/variants.js');
    res.json(await updateAttributeValue(req.user.tenantId, req.params.id, req.user._id, req.body));
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.delete('/attribute-values/:id', checkPermission('inventory', 'delete'), async (req, res) => {
  try {
    const { deleteAttributeValue } = await import('../services/inventory/variants.js');
    res.json(await deleteAttributeValue(req.user.tenantId, req.params.id));
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.get('/variants', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const { listVariants } = await import('../services/inventory/variants.js');
    const items = await listVariants(req.user.tenantId, {
      productId: req.query.productId,
      q: req.query.q,
      attributeId: req.query.attributeId,
      activeOnly: req.query.active !== 'false',
      limit: req.query.limit,
      enrichStock: req.query.enrich === '1' || req.query.enrich === 'true',
    });
    return sendList(res, items);
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.post('/variants/preview-count', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const { previewVariantCount } = await import('../services/inventory/variants.js');
    res.json(await previewVariantCount(req.user.tenantId, req.body));
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.post('/variants', checkPermission('inventory', 'create'), async (req, res) => {
  try {
    const { createVariant } = await import('../services/inventory/variants.js');
    res.status(201).json(await createVariant(req.user.tenantId, req.user._id, req.body));
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.post('/variants/generate', checkPermission('inventory', 'create'), async (req, res) => {
  try {
    const { generateVariants } = await import('../services/inventory/variants.js');
    res.json(await generateVariants(req.user.tenantId, req.user._id, {
      productId: req.body.productId,
      attributeIds: req.body.attributeIds,
      attributeLines: req.body.attributeLines,
      dryRun: req.body.dryRun === true,
    }));
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.patch('/variants/:id', checkPermission('inventory', 'update'), async (req, res) => {
  try {
    const { updateVariant } = await import('../services/inventory/variants.js');
    res.json(await updateVariant(req.user.tenantId, req.params.id, req.user._id, req.body));
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.post('/variants/get-or-create', checkPermission('inventory', 'create'), async (req, res) => {
  try {
    const { getOrCreateVariant } = await import('../services/inventory/variants.js');
    res.json(await getOrCreateVariant(req.user.tenantId, req.user._id, req.body));
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.get('/products/:productId/exclusions', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const { listExclusions } = await import('../services/inventory/variants.js');
    return sendList(res, await listExclusions(req.user.tenantId, req.params.productId));
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.post('/exclusions', checkPermission('inventory', 'create'), async (req, res) => {
  try {
    const { upsertExclusion } = await import('../services/inventory/variants.js');
    res.status(201).json(await upsertExclusion(req.user.tenantId, req.user._id, req.body));
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.delete('/exclusions/:id', checkPermission('inventory', 'delete'), async (req, res) => {
  try {
    const { deleteExclusion } = await import('../services/inventory/variants.js');
    res.json(await deleteExclusion(req.user.tenantId, req.params.id));
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.get('/products/:productId/template-attribute-values', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const { listTemplateAttributeValues } = await import('../services/inventory/variants.js');
    return sendList(res, await listTemplateAttributeValues(req.user.tenantId, req.params.productId));
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.post('/template-attribute-values', checkPermission('inventory', 'update'), async (req, res) => {
  try {
    const { upsertTemplateAttributeValue } = await import('../services/inventory/variants.js');
    res.json(await upsertTemplateAttributeValue(req.user.tenantId, req.user._id, req.body));
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.get('/products/:productId/relations', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const { listRelations } = await import('../services/inventory/productRelations.js');
    return sendList(res, await listRelations(req.user.tenantId, {
      productId: req.params.productId,
      type: req.query.type,
      direction: req.query.direction || 'outgoing',
      activeOnly: req.query.active !== 'false',
    }));
  } catch (err) {
    handleInventoryError(res, err);
  }
});

/** Catalogue preload for POS/sales — all active relations (optional type filter). */
router.get('/relations', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const { listRelations } = await import('../services/inventory/productRelations.js');
    return sendList(res, await listRelations(req.user.tenantId, {
      productId: req.query.productId,
      type: req.query.type,
      direction: req.query.direction || 'outgoing',
      activeOnly: req.query.active !== 'false',
    }));
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.post('/relations', checkPermission('inventory', 'create'), async (req, res) => {
  try {
    const { upsertRelation } = await import('../services/inventory/productRelations.js');
    res.status(201).json(await upsertRelation(req.user.tenantId, req.user._id, req.body));
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.delete('/relations/:id', checkPermission('inventory', 'delete'), async (req, res) => {
  try {
    const { deleteRelation } = await import('../services/inventory/productRelations.js');
    res.json(await deleteRelation(req.user.tenantId, req.params.id));
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.get('/products/:productId/suggestions', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const { suggestionsForProduct } = await import('../services/inventory/productRelations.js');
    const types = req.query.types ? String(req.query.types).split(',') : undefined;
    return sendList(res, await suggestionsForProduct(req.user.tenantId, req.params.productId, { types }));
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.get('/products/:productId/bundle', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const { getBundle } = await import('../services/inventory/productBundles.js');
    const doc = await getBundle(req.user.tenantId, req.params.productId);
    if (!doc) return res.status(404).json({ error: 'Bundle not found' });
    res.json(doc);
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.put('/products/:productId/bundle', checkPermission('inventory', 'update'), async (req, res) => {
  try {
    const { upsertBundle } = await import('../services/inventory/productBundles.js');
    res.json(await upsertBundle(req.user.tenantId, req.user._id, {
      ...req.body,
      productId: req.params.productId,
    }));
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.get('/products/:productId/kit-availability', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const { kitAvailability } = await import('../services/inventory/productBundles.js');
    res.json(await kitAvailability(req.user.tenantId, req.params.productId, {
      warehouseId: req.query.warehouseId,
    }));
  } catch (err) {
    handleInventoryError(res, err);
  }
});

// ── Physical inventory ─────────────────────────────────────────────

router.get('/physical-inventory', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const result = await listInventoryQuants(req.user.tenantId, {
      locationId: req.query.locationId,
      warehouseId: req.query.warehouseId,
      productId: req.query.productId,
      filter: req.query.filter,
      search: req.query.search,
      page: req.query.page,
      limit: req.query.limit,
    });
    const items = result.items || result.data || (Array.isArray(result) ? result : []);
    return sendList(res, items, {
      total: result.total ?? result._meta?.total ?? items.length,
      page: result.page ?? result._meta?.page,
      pageSize: result.limit ?? result._meta?.pageSize,
      totals: result._meta?.totals,
      appliedFilters: {
        warehouseId: req.query.warehouseId || null,
        locationId: req.query.locationId || null,
        filter: req.query.filter || null,
        search: req.query.search || null,
      },
    });
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.post('/physical-inventory/set', checkPermission('inventory', 'update'), async (req, res) => {
  try {
    res.json(await setCountedQuantity(req.user.tenantId, {
      ...req.body,
      userId: req.user._id,
    }));
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.post('/physical-inventory/clear', checkPermission('inventory', 'update'), async (req, res) => {
  try {
    if (Array.isArray(req.body?.ids) && req.body.ids.length) {
      res.json(await clearCountedQuantities(req.user.tenantId, req.body.ids));
      return;
    }
    res.json(await clearCountedQuantity(req.user.tenantId, req.body.quantId));
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.post('/physical-inventory/apply-preview', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    res.json(await previewApplyCounts(req.user.tenantId, req.body.ids || []));
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.post('/physical-inventory/apply', checkPermission('inventory', 'update'), validateBody(applyCountsBody), async (req, res) => {
  try {
    res.json(await applyInventoryCounts(req.user.tenantId, {
      ids: req.validatedBody.ids,
      accountingDate: req.validatedBody.accountingDate,
      reason: req.validatedBody.reason,
      reasonCode: req.validatedBody.reasonCode,
      forceApprove: !!req.validatedBody.forceApprove
        && (req.user.role === 'admin' || req.user.role === 'owner'),
      userId: req.user._id,
    }));
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.post('/physical-inventory/approve-variance', checkPermission('inventory', 'update'), async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'owner') {
      return res.status(403).json({ error: 'Variance approval requires admin' });
    }
    res.json(await approveVarianceCounts(req.user.tenantId, {
      ids: req.body.ids || [],
      userId: req.user._id,
    }));
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.post('/physical-inventory/request-count', checkPermission('inventory', 'update'), async (req, res) => {
  try {
    res.json(await requestCount(req.user.tenantId, {
      warehouseId: req.body.warehouseId,
      locationId: req.body.locationId,
      categoryId: req.body.categoryId,
      productIds: req.body.productIds,
      scheduledDate: req.body.scheduledDate,
      includeZero: req.body.includeZero !== false,
      countUserId: req.body.countUserId || req.body.userId,
      userId: req.user._id,
    }));
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.get('/physical-inventory/history', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    res.json({
      items: await countLineHistory(req.user.tenantId, {
        productId: req.query.productId,
        locationId: req.query.locationId,
        limit: req.query.limit,
      }),
    });
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.post('/physical-inventory/import', checkPermission('inventory', 'update'), async (req, res) => {
  try {
    let rows = req.body.rows;
    if (!rows?.length) {
      const { resolveImportCsvText, parseCsv } = await import('../services/inventory/importExport.js');
      const text = await resolveImportCsvText(req.body);
      const parsed = parseCsv(text);
      rows = parsed.records;
    }
    res.json(await importCountedQuantities(req.user.tenantId, rows || [], {
      dryRun: req.body.dryRun !== false,
      userId: req.user._id,
    }));
  } catch (err) {
    handleInventoryError(res, err);
  }
});

// ── Quality points & checks ────────────────────────────────────────

router.get('/quality-points', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const { listQualityPoints } = await import('../services/inventory/quality.js');
    return sendList(res, await listQualityPoints(req.user.tenantId, {
      operationTypeId: req.query.operationTypeId,
      activeOnly: req.query.active !== 'false',
    }));
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.post('/quality-points', checkPermission('inventory', 'create'), async (req, res) => {
  try {
    const { createQualityPoint } = await import('../services/inventory/quality.js');
    res.status(201).json(await createQualityPoint(req.user.tenantId, req.user._id, req.body));
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.patch('/quality-points/:id', checkPermission('inventory', 'update'), async (req, res) => {
  try {
    const { updateQualityPoint } = await import('../services/inventory/quality.js');
    res.json(await updateQualityPoint(req.user.tenantId, req.params.id, req.user._id, req.body));
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.get('/transfers/:id/quality-checks', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const transfer = await InvTransfer.findOne({ _id: req.params.id, ...req.tenantFilter }).lean();
    if (!transfer) return res.status(404).json({ error: 'Transfer not found' });
    await assertTransferWarehouseAccess(req, transfer);
    const { listTransferQualityChecks } = await import('../services/inventory/quality.js');
    return sendList(res, await listTransferQualityChecks(req.user.tenantId, req.params.id));
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.post('/transfers/:id/quality-checks/ensure', checkPermission('inventory', 'update'), async (req, res) => {
  try {
    const transfer = await InvTransfer.findOne({ _id: req.params.id, ...req.tenantFilter }).lean();
    if (!transfer) return res.status(404).json({ error: 'Transfer not found' });
    await assertTransferWarehouseAccess(req, transfer);
    const { ensureTransferQualityChecks } = await import('../services/inventory/quality.js');
    res.json(await ensureTransferQualityChecks(req.user.tenantId, req.params.id, req.user._id));
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.patch('/quality-checks/:id', checkPermission('inventory', 'update'), async (req, res) => {
  try {
    const { resolveQualityCheck } = await import('../services/inventory/quality.js');
    res.json(await resolveQualityCheck(req.user.tenantId, req.params.id, req.user._id, req.body));
  } catch (err) {
    handleInventoryError(res, err);
  }
});

// ── Batch transfers ────────────────────────────────────────────────

router.get('/batch-transfers', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const { listBatchTransfers } = await import('../services/inventory/batchTransfers.js');
    return sendList(res, await listBatchTransfers(req.user.tenantId, {
      state: req.query.state,
      limit: req.query.limit,
    }));
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.post('/batch-transfers', checkPermission('inventory', 'create'), async (req, res) => {
  try {
    const { createBatchTransfer } = await import('../services/inventory/batchTransfers.js');
    res.status(201).json(await createBatchTransfer(req.user.tenantId, req.user._id, req.body));
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.get('/batch-transfers/:id', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const { getBatchTransfer } = await import('../services/inventory/batchTransfers.js');
    res.json(await getBatchTransfer(req.user.tenantId, req.params.id));
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.post('/batch-transfers/:id/add-pickings', checkPermission('inventory', 'update'), async (req, res) => {
  try {
    const { addPickingsToBatch } = await import('../services/inventory/batchTransfers.js');
    res.json(await addPickingsToBatch(
      req.user.tenantId,
      req.params.id,
      req.user._id,
      req.body.pickingIds || [],
    ));
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.post('/batch-transfers/:id/remove-picking', checkPermission('inventory', 'update'), async (req, res) => {
  try {
    const { removePickingFromBatch } = await import('../services/inventory/batchTransfers.js');
    res.json(await removePickingFromBatch(
      req.user.tenantId,
      req.params.id,
      req.user._id,
      req.body.pickingId,
    ));
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.post('/batch-transfers/:id/confirm', checkPermission('inventory', 'update'), async (req, res) => {
  try {
    const { confirmBatchTransfer } = await import('../services/inventory/batchTransfers.js');
    res.json(await confirmBatchTransfer(req.user.tenantId, req.params.id, req.user._id));
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.post('/batch-transfers/:id/check-availability', checkPermission('inventory', 'update'), async (req, res) => {
  try {
    const { checkBatchAvailability } = await import('../services/inventory/batchTransfers.js');
    res.json(await checkBatchAvailability(req.user.tenantId, req.params.id));
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.post('/batch-transfers/:id/validate', checkPermission('inventory', 'update'), async (req, res) => {
  try {
    const { validateBatchTransfer } = await import('../services/inventory/batchTransfers.js');
    res.json(await validateBatchTransfer(req.user.tenantId, req.params.id, req.user._id, {
      createBackorder: req.body.createBackorder,
    }));
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.post('/batch-transfers/:id/cancel', checkPermission('inventory', 'update'), async (req, res) => {
  try {
    const { cancelBatchTransfer } = await import('../services/inventory/batchTransfers.js');
    res.json(await cancelBatchTransfer(req.user.tenantId, req.params.id, req.user._id));
  } catch (err) {
    handleInventoryError(res, err);
  }
});

// ── Scrap ──────────────────────────────────────────────────────────

router.get('/scraps', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const result = await listScraps(req.user.tenantId, {
      state: req.query.state,
      page: req.query.page,
      limit: req.query.limit,
    });
    return sendList(res, result.items, {
      total: result.total,
      page: result.page,
      pageSize: result.limit,
      appliedFilters: { state: req.query.state || null },
    });
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.post('/scraps', checkPermission('inventory', 'create'), async (req, res) => {
  try {
    res.status(201).json(await createScrap(req.user.tenantId, req.user._id, req.body));
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.post('/scraps/validate-bulk', checkPermission('inventory', 'update'), async (req, res) => {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
    if (!ids.length) return res.status(400).json({ error: 'ids required' });
    res.json(await validateScrapsBulk(req.user.tenantId, ids, req.user._id));
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.get('/scraps/:id', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const scrap = await InvScrap.findOne({ _id: req.params.id, ...req.tenantFilter })
      .populate('productId', 'nameEn nameAr sku unitOfMeasure uomId')
      .populate('uomId', 'name nameAr')
      .populate('variantId', 'name sku')
      .populate('sourceLocationId', 'name completePath')
      .populate('scrapLocationId', 'name completePath')
      .lean();
    if (!scrap) return res.status(404).json({ error: 'Scrap not found' });
    res.json(scrap);
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.post('/scraps/:id/validate', checkPermission('inventory', 'update'), async (req, res) => {
  try {
    res.json(await validateScrap(req.params.id, req.user.tenantId, req.user._id));
  } catch (err) {
    handleInventoryError(res, err);
  }
});

// ── Returns ────────────────────────────────────────────────────────

router.get('/transfers/:id/return-wizard', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    res.json(await getReturnWizard(req.user.tenantId, req.params.id));
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.post('/transfers/:id/return', checkPermission('inventory', 'create'), async (req, res) => {
  try {
    const transfer = await createReturnTransfer(
      req.user.tenantId,
      req.user._id,
      req.params.id,
      {
        lines: req.body.lines,
        destLocationId: req.body.destLocationId,
        sourceLocationId: req.body.sourceLocationId,
      },
    );
    res.status(201).json(transfer);
  } catch (err) {
    handleInventoryError(res, err);
  }
});

// ── Moves history / product history ────────────────────────────────

router.get('/moves-history', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const result = await movesHistory(req.user.tenantId, {
      productId: req.query.productId,
      lotId: req.query.lotId,
      locationId: req.query.locationId,
      transferId: req.query.transferId,
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
      direction: req.query.direction,
      page: req.query.page,
      limit: Math.min(10000, Number(req.query.limit) || 80),
      cursor: req.query.cursor,
    });
    return sendList(res, result.items, {
      total: result._meta?.total ?? result.total ?? result.items?.length,
      page: result._meta?.page,
      pageSize: result._meta?.pageSize ?? result._meta?.limit,
      nextCursor: result._meta?.nextCursor || null,
      appliedFilters: {
        productId: req.query.productId || null,
        lotId: req.query.lotId || null,
        locationId: req.query.locationId || null,
        transferId: req.query.transferId || null,
        direction: req.query.direction || null,
      },
    });
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.get('/products/:productId/moves', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    res.json(await productMoveHistory(req.user.tenantId, req.params.productId, {
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
      page: req.query.page,
      limit: req.query.limit,
    }));
  } catch (err) {
    handleInventoryError(res, err);
  }
});

// ── Packages (basic CRUD) ──────────────────────────────────────────

router.get('/package-types', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    return sendList(res, await InvPackageType.find({ ...req.tenantFilter, active: { $ne: false } }).sort({ name: 1 }));
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.post('/package-types', checkPermission('inventory', 'create'), async (req, res) => {
  try {
    res.status(201).json(await InvPackageType.create({
      ...req.body,
      tenantId: req.user.tenantId,
      createdBy: req.user._id,
    }));
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.get('/packages', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const filter = { ...req.tenantFilter };
    if (req.query.locationId) filter.locationId = req.query.locationId;
    return sendList(res, await InvPackage.find(filter).populate('packageTypeId').sort({ createdAt: -1 }).limit(200));
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.post('/packages', checkPermission('inventory', 'create'), async (req, res) => {
  try {
    const settings = await getInvSettings(req.user.tenantId);
    if (!(settings.groupStockTrackingLot || settings.groupStockPackaging)) {
      return res.status(400).json({ error: 'Packages are disabled in settings', code: 'PACKAGES_DISABLED' });
    }
    res.status(201).json(await InvPackage.create({
      tenantId: req.user.tenantId,
      name: req.body.name,
      packageTypeId: req.body.packageTypeId || null,
      locationId: req.body.locationId || null,
      createdBy: req.user._id,
    }));
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.get('/delivery-carriers', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const { default: InvDeliveryCarrier } = await import('../models/inventory/InvDeliveryCarrier.js');
    const items = await InvDeliveryCarrier.find({ tenantId: req.user.tenantId })
      .sort({ name: 1 })
      .lean();
    return sendList(res, items);
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.post('/delivery-carriers', checkPermission('inventory', 'create'), async (req, res) => {
  try {
    const { default: InvDeliveryCarrier } = await import('../models/inventory/InvDeliveryCarrier.js');
    const doc = await InvDeliveryCarrier.create({
      tenantId: req.user.tenantId,
      name: req.body.name || 'Carrier',
      nameAr: req.body.nameAr,
      carrierType: req.body.carrierType || 'fixed',
      providerCode: req.body.providerCode || 'none',
      fixedPrice: req.body.fixedPrice != null ? String(req.body.fixedPrice) : '0',
      freeAbove: req.body.freeAbove != null && req.body.freeAbove !== ''
        ? String(req.body.freeAbove)
        : null,
      marginPercent: Number(req.body.marginPercent) || 0,
      installed: false,
      active: req.body.active !== false,
      createdBy: req.user._id,
    });
    res.status(201).json(doc);
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.patch('/delivery-carriers/:id', checkPermission('inventory', 'update'), async (req, res) => {
  try {
    const { updateDeliveryCarrier } = await import('../services/inventory/carriers.js');
    res.json(await updateDeliveryCarrier(req.user.tenantId, req.params.id, req.user._id, req.body));
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.post('/delivery-carriers/:id/rate', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const { rateDeliveryCarrier } = await import('../services/inventory/carriers.js');
    res.json(await rateDeliveryCarrier(req.user.tenantId, req.params.id, {
      orderTotal: req.body.orderTotal ?? req.query.orderTotal,
    }));
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.get('/product-packagings', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const settings = await getInvSettings(req.user.tenantId);
    if (!settings.groupStockPackaging) {
      return res.status(400).json({ error: 'Product packagings are disabled', code: 'PACKAGING_DISABLED' });
    }
    const filter = { ...req.tenantFilter };
    if (req.query.active !== 'all') filter.active = { $ne: false };
    if (req.query.productId) filter.productId = req.query.productId;
    const rows = await InvProductPackaging.find(filter)
      .populate('productId', 'nameEn nameAr sku barcode')
      .populate('packageTypeId', 'name')
      .sort({ name: 1 })
      .lean();
    return sendList(res, rows);
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.post('/product-packagings', checkPermission('inventory', 'create'), async (req, res) => {
  try {
    const settings = await getInvSettings(req.user.tenantId);
    if (!settings.groupStockPackaging) {
      return res.status(400).json({ error: 'Product packagings are disabled', code: 'PACKAGING_DISABLED' });
    }
    const row = await InvProductPackaging.create({
      productId: req.body.productId,
      name: req.body.name,
      qty: req.body.qty ?? '1',
      barcode: req.body.barcode || undefined,
      packageTypeId: req.body.packageTypeId || null,
      purchaseOk: req.body.purchaseOk !== false,
      salesOk: req.body.salesOk !== false,
      active: req.body.active !== false,
      tenantId: req.user.tenantId,
      createdBy: req.user._id,
    });
    const populated = await InvProductPackaging.findById(row._id)
      .populate('productId', 'nameEn nameAr sku barcode')
      .populate('packageTypeId', 'name')
      .lean();
    res.status(201).json(populated);
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.patch('/product-packagings/:id', checkPermission('inventory', 'update'), async (req, res) => {
  try {
    const settings = await getInvSettings(req.user.tenantId);
    if (!settings.groupStockPackaging) {
      return res.status(400).json({ error: 'Product packagings are disabled', code: 'PACKAGING_DISABLED' });
    }
    const $set = {};
    for (const key of ['name', 'qty', 'barcode', 'packageTypeId', 'purchaseOk', 'salesOk', 'active']) {
      if (req.body[key] !== undefined) $set[key] = req.body[key];
    }
    if (req.body.productId !== undefined) $set.productId = req.body.productId;
    $set.updatedBy = req.user._id;
    const row = await InvProductPackaging.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.user.tenantId },
      { $set, $inc: { version: 1 } },
      { new: true },
    )
      .populate('productId', 'nameEn nameAr sku barcode')
      .populate('packageTypeId', 'name');
    if (!row) return res.status(404).json({ error: 'Packaging not found' });
    res.json(row);
  } catch (err) {
    handleInventoryError(res, err);
  }
});

// ── PoS close (idempotent) ─────────────────────────────────────────

router.post('/pos-close', checkPermission('inventory', 'create'), async (req, res) => {
  try {
    if (!(await isInvEngineEnabled(req.user.tenantId))) {
      return res.status(400).json({ error: 'Inventory engine is not enabled' });
    }
    const result = await postPosSaleViaEngine({
      tenantId: req.user.tenantId,
      userId: req.user._id,
      warehouseId: req.body.warehouseId,
      lines: req.body.lines,
      orderId: req.body.orderId,
      offlineId: req.body.offlineId,
      partnerId: req.body.partnerId,
    });
    res.status(201).json(result);
  } catch (err) {
    handleInventoryError(res, err);
  }
});

/** PoS consume — create+validate pos picking (works without PoS UI). */
router.post('/pos/consume', checkPermission('inventory', 'create'), validateBody(posConsumeBody), async (req, res) => {
  try {
    const { posConsume } = await import('../services/inventory/posManufacturing.js');
    res.status(201).json(await posConsume(req.user.tenantId, req.user._id, req.validatedBody));
  } catch (err) {
    handleInventoryError(res, err);
  }
});

/** Manual MO: consume components + produce finished (no BoM required). */
router.post('/manufacturing/consume-produce', checkPermission('inventory', 'create'), async (req, res) => {
  try {
    const { manufactureConsumeProduce } = await import('../services/inventory/posManufacturing.js');
    res.status(201).json(await manufactureConsumeProduce(req.user.tenantId, req.user._id, req.body));
  } catch (err) {
    handleInventoryError(res, err);
  }
});

// ── Three-way match preview ────────────────────────────────────────

router.post('/three-way-match', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const result = await threeWayMatch({
      tenantId: req.user.tenantId,
      purchaseOrderId: req.body.purchaseOrderId,
      billLines: req.body.billLines,
      qtyTolerance: req.body.qtyTolerance,
      priceTolerancePct: req.body.priceTolerancePct,
    });
    res.json(result);
  } catch (err) {
    handleInventoryError(res, err);
  }
});

// ── Phase 4: Routes & Rules ────────────────────────────────────────

router.get('/routes', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const filter = { tenantId: req.user.tenantId };
    if (req.query.active === 'true') filter.active = true;
    if (req.query.active === 'false') filter.active = false;
    const items = await InvRoute.find(filter)
      .sort({ sequence: 1, name: 1 })
      .lean();
    return sendList(res, items);
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.get('/routes/:id', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const route = await InvRoute.findOne({ _id: req.params.id, tenantId: req.user.tenantId }).lean();
    if (!route) return res.status(404).json({ error: 'Route not found', code: 'ROUTE_NOT_FOUND' });
    res.json(route);
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.post('/routes', checkPermission('inventory', 'create'), async (req, res) => {
  try {
    const route = await InvRoute.create({
      tenantId: req.user.tenantId,
      name: req.body.name,
      nameAr: req.body.nameAr,
      sequence: req.body.sequence ?? 10,
      active: req.body.active !== false,
      productSelectable: req.body.productSelectable !== false,
      categorySelectable: req.body.categorySelectable !== false,
      warehouseSelectable: req.body.warehouseSelectable !== false,
      packagingSelectable: !!req.body.packagingSelectable,
      saleOrderSelectable: !!req.body.saleOrderSelectable,
      warehouseIds: req.body.warehouseIds || [],
      suppliedWarehouseId: req.body.suppliedWarehouseId || null,
      supplierWarehouseId: req.body.supplierWarehouseId || null,
      createdBy: req.user._id,
    });
    res.status(201).json(route);
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.patch('/routes/:id', checkPermission('inventory', 'update'), async (req, res) => {
  try {
    const $set = { updatedBy: req.user._id };
    const fields = [
      'name', 'nameAr', 'sequence', 'active',
      'productSelectable', 'categorySelectable', 'warehouseSelectable',
      'packagingSelectable', 'saleOrderSelectable',
      'warehouseIds', 'suppliedWarehouseId', 'supplierWarehouseId',
    ];
    for (const k of fields) {
      if (req.body[k] !== undefined) $set[k] = req.body[k];
    }
    const route = await InvRoute.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.user.tenantId },
      { $set },
      { new: true },
    );
    if (!route) return res.status(404).json({ error: 'Route not found' });
    res.json(route);
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.get('/rules', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const filter = { tenantId: req.user.tenantId };
    if (req.query.routeId) filter.routeId = req.query.routeId;
    const items = await InvRule.find(filter)
      .populate('routeId', 'name')
      .populate('operationTypeId', 'name code warehouseId')
      .populate('sourceLocationId', 'completePath name warehouseId')
      .populate('destLocationId', 'completePath name warehouseId')
      .sort({ sequence: 1 })
      .lean();
    return sendList(res, items);
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.post('/rules', checkPermission('inventory', 'create'), async (req, res) => {
  try {
    const name = String(req.body.name || '').trim()
      || `${req.body.action || 'pull'} rule`;
    if (!req.body.routeId) {
      return res.status(400).json({ error: 'routeId required', code: 'RULE_ROUTE' });
    }
    if (!req.body.destLocationId && req.body.action !== 'buy' && req.body.action !== 'manufacture') {
      return res.status(400).json({ error: 'Destination location required', code: 'RULE_DEST' });
    }
    const rule = await InvRule.create({
      tenantId: req.user.tenantId,
      name,
      routeId: req.body.routeId,
      sequence: req.body.sequence ?? 20,
      action: req.body.action || 'pull',
      operationTypeId: req.body.operationTypeId || null,
      sourceLocationId: req.body.sourceLocationId || null,
      destLocationId: req.body.destLocationId || req.body.sourceLocationId || null,
      procureMethod: req.body.procureMethod || 'makeToStock',
      groupPropagation: req.body.groupPropagation || 'propagate',
      leadDays: req.body.leadDays || 0,
      active: req.body.active !== false,
      createdBy: req.user._id,
    });
    const populated = await InvRule.findById(rule._id)
      .populate('operationTypeId', 'name code warehouseId')
      .populate('sourceLocationId', 'completePath name warehouseId')
      .populate('destLocationId', 'completePath name warehouseId')
      .lean();
    res.status(201).json(populated);
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.patch('/rules/:id', checkPermission('inventory', 'update'), async (req, res) => {
  try {
    const allowed = [
      'name', 'sequence', 'action', 'operationTypeId', 'sourceLocationId', 'destLocationId',
      'procureMethod', 'groupPropagation', 'leadDays', 'active', 'propagateCancel',
    ];
    const $set = { updatedBy: req.user._id };
    for (const k of allowed) {
      if (req.body[k] !== undefined) $set[k] = req.body[k];
    }
    const rule = await InvRule.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.user.tenantId },
      { $set },
      { new: true },
    )
      .populate('operationTypeId', 'name code warehouseId')
      .populate('sourceLocationId', 'completePath name warehouseId')
      .populate('destLocationId', 'completePath name warehouseId');
    if (!rule) return res.status(404).json({ error: 'Rule not found' });
    res.json(rule);
  } catch (err) {
    handleInventoryError(res, err);
  }
});

// ── Replenishment / reorder ────────────────────────────────────────

router.get('/replenishment', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const items = await listReplenishment(req.user.tenantId, {
      warehouseId: req.query.warehouseId,
      permanentOnly: req.query.permanentOnly,
    });
    return sendList(res, items);
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.get('/reorder-rules', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const filter = { tenantId: req.user.tenantId };
    if (req.query.warehouseId) filter.warehouseId = req.query.warehouseId;
    if (req.query.active === 'false') {
      /* include inactive */
    } else if (req.query.active !== 'all') {
      filter.active = { $ne: false };
    }
    const items = await InvReorderRule.find(filter)
      .populate('productId', 'nameEn nameAr sku')
      .populate('variantId', 'name sku barcode')
      .populate('locationId', 'completePath name warehouseId')
      .populate('warehouseId', 'name nameEn code')
      .populate('routeId', 'name nameAr active')
      .sort({ createdAt: -1 })
      .lean();
    return sendList(res, items);
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.post('/reorder-rules', checkPermission('inventory', 'create'), async (req, res) => {
  try {
    const rule = await upsertReorderRule(req.user.tenantId, req.user._id, req.body);
    const populated = await InvReorderRule.findById(rule._id)
      .populate('productId', 'nameEn nameAr sku')
      .populate('variantId', 'name sku barcode')
      .populate('locationId', 'completePath name warehouseId')
      .populate('warehouseId', 'name nameEn code')
      .populate('routeId', 'name nameAr active')
      .lean();
    res.status(201).json(populated);
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.patch('/reorder-rules/:id', checkPermission('inventory', 'update'), async (req, res) => {
  try {
    const existing = await InvReorderRule.findOne({ _id: req.params.id, tenantId: req.user.tenantId });
    if (!existing) return res.status(404).json({ error: 'Reorder rule not found' });

    // Direct patch by id (supports inline grid edits without upsert key collision)
    const $set = { updatedBy: req.user._id };
    for (const k of [
      'productId', 'variantId', 'locationId', 'warehouseId',
      'minQty', 'maxQty', 'qtyMultiple', 'trigger', 'routeId',
      'preferredVendorId', 'leadDays', 'active',
    ]) {
      if (req.body[k] !== undefined) {
        $set[k] = (k === 'minQty' || k === 'maxQty' || k === 'qtyMultiple')
          ? String(req.body[k])
          : (req.body[k] === '' ? null : req.body[k]);
      }
    }
    const rule = await InvReorderRule.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.user.tenantId },
      { $set, $inc: { version: 1 } },
      { new: true },
    )
      .populate('productId', 'nameEn nameAr sku')
      .populate('variantId', 'name sku barcode')
      .populate('locationId', 'completePath name warehouseId')
      .populate('warehouseId', 'name nameEn code')
      .populate('routeId', 'name nameAr active');
    if (!rule) return res.status(404).json({ error: 'Reorder rule not found' });
    res.json(rule);
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.post('/reorder-rules/:id/snooze', checkPermission('inventory', 'update'), async (req, res) => {
  try {
    const rule = await snoozeReorderRule(req.user.tenantId, req.params.id, req.body);
    res.json(rule);
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.post('/replenishment/order', checkPermission('inventory', 'create'), async (req, res) => {
  try {
    const result = await orderOnce(req.user.tenantId, req.user._id, req.body);
    res.status(201).json(result);
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.post('/procurement/run', checkPermission('inventory', 'create'), async (req, res) => {
  try {
    const result = await runProcurement({
      tenantId: req.user.tenantId,
      productId: req.body.productId,
      qty: req.body.qty,
      locationId: req.body.locationId,
      dateDeadline: req.body.dateDeadline,
      preferredRouteId: req.body.routeId,
      warehouseId: req.body.warehouseId,
      preferredVendorId: req.body.preferredVendorId,
      userId: req.user._id,
    });
    res.status(201).json(result);
  } catch (err) {
    handleInventoryError(res, err);
  }
});

// ── Scheduler ──────────────────────────────────────────────────────

router.get('/scheduler', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    res.json(await getSchedulerStatus(req.user.tenantId));
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.post('/scheduler/run', checkPermission('inventory', 'update'), stockHeavyLimiter, async (req, res) => {
  try {
    if (req.body?.async || req.query.async === '1') {
      const { enqueueInventoryJob } = await import('../services/inventory/inventoryQueue.js');
      const q = await enqueueInventoryJob({
        jobType: 'scheduler',
        tenantId: req.user.tenantId,
        userId: req.user._id,
        trigger: 'api',
        payload: { force: !!req.body?.force },
      });
      return res.status(202).json({ data: q, ...q, async: true });
    }
    const run = await runScheduler(req.user.tenantId, {
      trigger: 'manual',
      userId: req.user._id,
      force: !!req.body?.force,
    });
    res.json(run);
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.get('/scheduler/runs', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const items = await InvSchedulerRun.find({ tenantId: req.user.tenantId })
      .sort({ startedAt: -1 })
      .limit(Number(req.query.limit) || 20)
      .lean();
    return sendList(res, items);
  } catch (err) {
    handleInventoryError(res, err);
  }
});

// ── Putaway & storage ──────────────────────────────────────────────

router.get('/putaway-rules', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const items = await InvPutawayRule.find({ tenantId: req.user.tenantId })
      .populate('productId', 'nameEn sku')
      .populate('fromLocationId', 'completePath')
      .populate('toLocationId', 'completePath')
      .sort({ sequence: -1 })
      .lean();
    return sendList(res, items);
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.post('/putaway-rules', checkPermission('inventory', 'create'), async (req, res) => {
  try {
    await assertMultiLocationsEnabled(req.user.tenantId);
    const rule = await InvPutawayRule.create({
      tenantId: req.user.tenantId,
      sequence: req.body.sequence ?? 10,
      productId: req.body.productId || null,
      categoryId: req.body.categoryId || null,
      packageTypeId: req.body.packageTypeId || null,
      fromLocationId: req.body.fromLocationId,
      toLocationId: req.body.toLocationId,
      storageCategoryId: req.body.storageCategoryId || null,
      active: req.body.active !== false,
      createdBy: req.user._id,
    });
    res.status(201).json(rule);
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.get('/storage-categories', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const items = await InvStorageCategory.find({ tenantId: req.user.tenantId }).sort({ name: 1 }).lean();
    return sendList(res, items);
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.post('/storage-categories', checkPermission('inventory', 'create'), async (req, res) => {
  try {
    const cat = await InvStorageCategory.create({
      tenantId: req.user.tenantId,
      name: req.body.name,
      nameAr: req.body.nameAr,
      maxWeight: req.body.maxWeight != null ? String(req.body.maxWeight) : null,
      allowNewProduct: req.body.allowNewProduct || 'mixed',
      capacityByProduct: req.body.capacityByProduct || [],
      capacityByPackageType: req.body.capacityByPackageType || [],
      createdBy: req.user._id,
    });
    res.status(201).json(cat);
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.patch('/storage-categories/:id', checkPermission('inventory', 'update'), async (req, res) => {
  try {
    const allowed = ['name', 'nameAr', 'maxWeight', 'allowNewProduct', 'capacityByProduct', 'capacityByPackageType'];
    const $set = { updatedBy: req.user._id };
    for (const k of allowed) {
      if (req.body[k] !== undefined) {
        $set[k] = k === 'maxWeight' && req.body[k] != null ? String(req.body[k]) : req.body[k];
      }
    }
    const cat = await InvStorageCategory.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.user.tenantId },
      { $set },
      { new: true },
    );
    if (!cat) return res.status(404).json({ error: 'Storage category not found' });
    res.json(cat);
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.post('/putaway/resolve', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const locationId = await resolvePutawayLocation(req.user.tenantId, {
      fromLocationId: req.body.fromLocationId,
      productId: req.body.productId,
      packageTypeId: req.body.packageTypeId,
    });
    res.json({ locationId });
  } catch (err) {
    handleInventoryError(res, err);
  }
});

// ── Warehouse multi-step ───────────────────────────────────────────

router.post('/warehouses/:id/recompute-routes', checkPermission('inventory', 'update'), async (req, res) => {
  try {
    if (req.body.receptionSteps || req.body.deliverySteps || req.body.buyToResupply != null
      || req.body.resupplyFromWarehouseIds) {
      await Warehouse.findOneAndUpdate(
        { _id: req.params.id, tenantId: req.user.tenantId },
        {
          $set: {
            ...(req.body.receptionSteps && { receptionSteps: req.body.receptionSteps }),
            ...(req.body.deliverySteps && { deliverySteps: req.body.deliverySteps }),
            ...(req.body.buyToResupply != null && { buyToResupply: req.body.buyToResupply }),
            ...(req.body.resupplyFromWarehouseIds && { resupplyFromWarehouseIds: req.body.resupplyFromWarehouseIds }),
          },
        },
      );
    }
    const wh = await recomputeWarehouseRoutes(req.params.id, req.user.tenantId, req.user._id);
    res.json(wh);
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.get('/procurement-groups', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const { default: InvTransfer } = await import('../models/inventory/InvTransfer.js');
    const groups = await InvProcurementGroup.find({ tenantId: req.user.tenantId })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    const ids = groups.map((g) => g._id);
    const transfers = ids.length
      ? await InvTransfer.find({ tenantId: req.user.tenantId, procurementGroupId: { $in: ids } })
        .select('procurementGroupId state scheduledDate deadlineDate name reference')
        .lean()
      : [];

    const byGroup = new Map();
    for (const t of transfers) {
      const key = String(t.procurementGroupId);
      if (!byGroup.has(key)) byGroup.set(key, []);
      byGroup.get(key).push(t);
    }

    const items = groups.map((g) => {
      const list = byGroup.get(String(g._id)) || [];
      const status = list.some((t) => t.state === 'done')
        ? 'done'
        : list.some((t) => ['assigned', 'confirmed', 'waiting', 'partiallyAvailable'].includes(t.state))
          ? 'in_progress'
          : list.length ? 'open' : 'draft';
      const deliveryDate = list
        .map((t) => t.scheduledDate || t.deadlineDate)
        .filter(Boolean)
        .sort((a, b) => new Date(a) - new Date(b))[0] || null;
      return {
        ...g,
        status,
        deliveryDate,
        transferCount: list.length,
        origin: [g.originModel, g.originDocId].filter(Boolean).join(' ') || g.name,
      };
    });

    return sendList(res, items);
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.get('/procurement-groups/:id', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const group = await InvProcurementGroup.findOne({
      _id: req.params.id,
      tenantId: req.user.tenantId,
    }).lean();
    if (!group) return res.status(404).json({ error: 'Procurement group not found' });

    const { default: InvTransfer } = await import('../models/inventory/InvTransfer.js');
    const { default: InvMove } = await import('../models/inventory/InvMove.js');
    const [transfers, moves] = await Promise.all([
      InvTransfer.find({ tenantId: req.user.tenantId, procurementGroupId: group._id })
        .sort({ createdAt: -1 })
        .limit(100)
        .populate('operationTypeId', 'name code')
        .lean(),
      InvMove.find({ tenantId: req.user.tenantId, procurementGroupId: group._id })
        .sort({ createdAt: -1 })
        .limit(100)
        .populate('productId', 'nameEn sku')
        .lean(),
    ]);

    res.json({
      ...group,
      transfers,
      moves,
      status: transfers.some((t) => t.state === 'done')
        ? 'done'
        : transfers.some((t) => ['assigned', 'confirmed', 'waiting'].includes(t.state))
          ? 'in_progress'
          : 'draft',
      deliveryDate: transfers.map((t) => t.scheduledDate || t.deadlineDate).filter(Boolean).sort()[0]
        || group.createdAt,
    });
  } catch (err) {
    handleInventoryError(res, err);
  }
});

// ── Phase 5: Valuation & landed costs ──────────────────────────────

router.get('/valuation-layers', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const { default: InvValuationLayer } = await import('../models/inventory/InvValuationLayer.js');
    const filter = { tenantId: req.user.tenantId };
    if (req.query.productId) filter.productId = req.query.productId;
    const items = await InvValuationLayer.find(filter)
      .populate('productId', 'nameEn nameAr sku costPrice')
      .sort({ createdAt: -1 })
      .limit(Number(req.query.limit) || 100)
      .lean();
    return sendList(res, items);
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.get('/products/:productId/inventory-value', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const { productInventoryValue } = await import('../services/inventory/valuation.js');
    res.json(await productInventoryValue(req.user.tenantId, req.params.productId));
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.get('/valuation-report', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const { productInventoryValue } = await import('../services/inventory/valuation.js');
    const products = await Product.find({
      tenantId: req.user.tenantId,
      isActive: { $ne: false },
      trackInventory: { $ne: false },
    }).select('nameEn nameAr sku costPrice').limit(200).lean();

    const rows = [];
    for (const p of products) {
      const v = await productInventoryValue(req.user.tenantId, p._id);
      if (Number(v.qty) === 0 && Number(v.value) === 0) continue;
      rows.push({
        productId: p._id,
        name: p.nameEn || p.sku,
        sku: p.sku,
        costMethod: v.costMethod,
        qty: v.qty,
        unitCost: v.unitCost || p.costPrice,
        value: v.value,
      });
    }
    return sendList(res, rows);
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.get('/landed-costs', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const { default: InvLandedCost } = await import('../models/inventory/InvLandedCost.js');
    const items = await InvLandedCost.find({ tenantId: req.user.tenantId })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    return sendList(res, items);
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.post('/landed-costs', checkPermission('inventory', 'create'), async (req, res) => {
  try {
    const { createLandedCost } = await import('../services/inventory/landedCost.js');
    const doc = await createLandedCost(req.user.tenantId, req.user._id, req.body);
    res.status(201).json(doc);
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.post('/landed-costs/:id/compute', checkPermission('inventory', 'update'), async (req, res) => {
  try {
    const { computeLandedCost } = await import('../services/inventory/landedCost.js');
    res.json(await computeLandedCost(req.user.tenantId, req.params.id));
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.post('/landed-costs/:id/validate', checkPermission('inventory', 'update'), async (req, res) => {
  try {
    const { validateLandedCost } = await import('../services/inventory/landedCost.js');
    res.json(await validateLandedCost(req.user.tenantId, req.params.id, req.user._id));
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.post('/accounting/ensure-accounts', checkPermission('inventory', 'update'), async (req, res) => {
  try {
    const {
      resolveStockAccounts,
      validateAutomatedCategoryAccounts,
      linkDefaultPropertyStockAccounts,
      isStockAccountingEnabled,
    } = await import('../services/inventory/stockAccounting.js');
    if (!(await isStockAccountingEnabled(req.user.tenantId))) {
      return res.json({
        ok: true,
        skipped: true,
        reason: 'full_accounting_disabled',
        automatedCount: 0,
        gapCount: 0,
        gaps: [],
      });
    }
    // Seed interim COA + STJ and prefill empty tenant property accounts (never invent category links)
    const linked = await linkDefaultPropertyStockAccounts(req.user.tenantId, req.user._id);
    const validation = await validateAutomatedCategoryAccounts(req.user.tenantId);
    const accounts = await resolveStockAccounts(req.user.tenantId);
    res.json({
      ...validation,
      defaultStockJournalId: linked?.stockJournalId || accounts.settings?.stockJournalId,
      propertyAccounts: {
        valuation: linked?.propertyStockValuationAccountId,
        input: linked?.propertyStockInputAccountId,
        output: linked?.propertyStockOutputAccountId,
        landed: linked?.propertyLandedCostAccountId,
      },
      accounts: {
        inventory: accounts.inventory?._id,
        stockInput: accounts.stockInput?._id,
        stockOutput: accounts.stockOutput?._id,
      },
    });
  } catch (err) {
    handleInventoryError(res, err);
  }
});

/** Journal books for category stock journal picker (inventory permission). */
router.get('/journal-books', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const { listJournalBooks } = await import('../services/inventory/stockAccounting.js');
    res.json(await listJournalBooks(req.user.tenantId, {
      type: req.query.type || 'stock',
      activeOnly: req.query.active !== 'false',
    }));
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.post('/sync-product-cache', checkPermission('inventory', 'update'), async (req, res) => {
  try {
    const { syncProductsStockCache, syncProductStockCache } = await import('../services/inventory/syncProductCache.js');
    if (req.body.productId) {
      const product = await syncProductStockCache(req.user.tenantId, req.body.productId);
      return res.json({ product });
    }
    const ids = Array.isArray(req.body.productIds) ? req.body.productIds : [];
    if (!ids.length) {
      const products = await Product.find({
        tenantId: req.user.tenantId,
        trackInventory: { $ne: false },
      }).select('_id').limit(500).lean();
      await syncProductsStockCache(req.user.tenantId, products.map((p) => p._id));
      return res.json({ synced: products.length });
    }
    await syncProductsStockCache(req.user.tenantId, ids);
    res.json({ synced: ids.length });
  } catch (err) {
    handleInventoryError(res, err);
  }
});

// ── Phase 6: Reporting, import/export, barcode, settings extras ───

router.get('/report/moves-analysis', checkPermission('inventory', 'read'), stockHeavyLimiter, async (req, res) => {
  try {
    const { movesAnalysis } = await import('../services/inventory/reporting.js');
    const items = await movesAnalysis(req.user.tenantId, {
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
      warehouseId: req.query.warehouseId,
      groupBy: req.query.groupBy || 'product',
    });
    return sendList(res, items);
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.get('/report/performance', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const { performanceKpis } = await import('../services/inventory/reporting.js');
    res.json(await performanceKpis(req.user.tenantId, {
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
      warehouseId: req.query.warehouseId,
    }));
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.get('/report/forecast', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const { forecastReport } = await import('../services/inventory/reporting.js');
    const items = await forecastReport(req.user.tenantId, {
      warehouseId: req.query.warehouseId,
      limit: req.query.limit,
    });
    return sendList(res, items);
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.get('/report/expiry-at-risk', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const { expiryAtRiskReport } = await import('../services/inventory/reporting.js');
    res.json(await expiryAtRiskReport(req.user.tenantId, {
      warehouseId: req.query.warehouseId,
      buckets: req.query.buckets
        ? String(req.query.buckets).split(',').map(Number).filter(Boolean)
        : undefined,
    }));
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.patch('/quants/:id/status', checkPermission('inventory', 'update'), async (req, res) => {
  try {
    const { updateQuantInventoryStatus } = await import('../services/inventory/quantStatus.js');
    const quant = await updateQuantInventoryStatus(req.user.tenantId, req.params.id, {
      status: req.body.status || req.body.inventoryStatus,
      reason: req.body.reason,
      userId: req.user._id,
    });
    res.json(quant);
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.post('/quants/:id/write-off-expired', checkPermission('inventory', 'update'), async (req, res) => {
  try {
    const { writeOffExpiredQuant } = await import('../services/inventory/quantStatus.js');
    res.json(await writeOffExpiredQuant(req.user.tenantId, req.params.id, req.user._id));
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.get('/report/stock-ageing', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const { stockAgeingReport } = await import('../services/inventory/reporting.js');
    res.json(await stockAgeingReport(req.user.tenantId, { warehouseId: req.query.warehouseId }));
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.get('/report/dead-stock', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const { deadStockReport } = await import('../services/inventory/reporting.js');
    res.json(await deadStockReport(req.user.tenantId, {
      warehouseId: req.query.warehouseId,
      inactiveDays: req.query.inactiveDays,
    }));
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.get('/report/mock-recall', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const { mockRecallReport } = await import('../services/inventory/reporting.js');
    if (!req.query.lotId) return res.status(400).json({ error: 'lotId required' });
    res.json(await mockRecallReport(req.user.tenantId, req.query.lotId));
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.get('/report/count-accuracy', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const { countAccuracyReport } = await import('../services/inventory/reporting.js');
    res.json(await countAccuracyReport(req.user.tenantId, { months: req.query.months }));
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.get('/report/inventory-turns', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const { inventoryTurnsReport } = await import('../services/inventory/reporting.js');
    res.json(await inventoryTurnsReport(req.user.tenantId, {
      warehouseId: req.query.warehouseId,
      windowDays: req.query.windowDays,
    }));
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.get('/period-close/checklist', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const { periodCloseChecklist } = await import('../services/inventory/periodLock.js');
    res.json(await periodCloseChecklist(req.user.tenantId, { asOf: req.query.asOf }));
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.post('/period-close/lock', checkPermission('inventory', 'update'), async (req, res) => {
  try {
    const { setPeriodLockDate } = await import('../services/inventory/periodLock.js');
    res.json(await setPeriodLockDate(req.user.tenantId, req.user._id, req.body.lockDate));
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.get('/count-plans', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const { listCountPlans } = await import('../services/inventory/countPlans.js');
    return sendList(res, await listCountPlans(req.user.tenantId));
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.post('/count-plans', checkPermission('inventory', 'update'), async (req, res) => {
  try {
    const { upsertCountPlan } = await import('../services/inventory/countPlans.js');
    res.status(201).json(await upsertCountPlan(req.user.tenantId, req.user._id, req.body));
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.post('/count-plans/:id/run', checkPermission('inventory', 'update'), async (req, res) => {
  try {
    const { runCountPlan } = await import('../services/inventory/countPlans.js');
    res.json(await runCountPlan(req.user.tenantId, req.params.id, req.user._id));
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.post('/count-plans/compute-abc', checkPermission('inventory', 'update'), async (req, res) => {
  try {
    const { computeAbcClasses } = await import('../services/inventory/countPlans.js');
    res.json(await computeAbcClasses(req.user.tenantId, { windowDays: req.body.windowDays }));
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.get('/replenishment/suggestions', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const { listDemandSuggestions, listDemandSuggestionsByVendor } = await import('../services/inventory/demandReplenishment.js');
    if (req.query.groupBy === 'vendor') {
      return res.json({ groups: await listDemandSuggestionsByVendor(req.user.tenantId, {
        warehouseId: req.query.warehouseId,
      }) });
    }
    return sendList(res, await listDemandSuggestions(req.user.tenantId, {
      warehouseId: req.query.warehouseId,
    }));
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.post('/replenishment/suggestions/:ruleId/apply', checkPermission('inventory', 'update'), async (req, res) => {
  try {
    const { applyDemandSuggestion } = await import('../services/inventory/demandReplenishment.js');
    res.json(await applyDemandSuggestion(req.user.tenantId, req.params.ruleId, req.user._id, req.body));
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.get('/batch-transfers/:id/pick-list', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const { getMergedPickList } = await import('../services/inventory/batchTransfers.js');
    res.json(await getMergedPickList(req.user.tenantId, req.params.id));
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.get('/api-keys', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const { default: InvApiKey } = await import('../models/inventory/InvApiKey.js');
    const keys = await InvApiKey.find({ tenantId: req.user.tenantId, revokedAt: null })
      .select('-keyHash')
      .sort({ createdAt: -1 })
      .lean();
    return sendList(res, keys);
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.post('/api-keys', checkPermission('inventory', 'update'), async (req, res) => {
  try {
    const { default: InvApiKey } = await import('../models/inventory/InvApiKey.js');
    const { generateApiKey } = await import('../middleware/invApiKeyAuth.js');
    const { raw, prefix, hash } = generateApiKey();
    const [key] = await InvApiKey.create([{
      tenantId: req.user.tenantId,
      name: req.body.name || 'API key',
      keyPrefix: prefix,
      keyHash: hash,
      scopes: req.body.scopes || ['read'],
      createdBy: req.user._id,
    }]);
    res.status(201).json({ key: { ...key.toObject(), keyHash: undefined }, secret: raw });
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.get('/webhooks', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const { default: InvWebhookSubscription } = await import('../models/inventory/InvWebhookSubscription.js');
    const items = await InvWebhookSubscription.find({ tenantId: req.user.tenantId }).select('-secret').lean();
    return sendList(res, items);
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.post('/webhooks', checkPermission('inventory', 'update'), async (req, res) => {
  try {
    const { default: InvWebhookSubscription } = await import('../models/inventory/InvWebhookSubscription.js');
    const crypto = await import('crypto');
    const secret = crypto.randomBytes(24).toString('hex');
    const [sub] = await InvWebhookSubscription.create([{
      tenantId: req.user.tenantId,
      event: req.body.event,
      url: req.body.url,
      secret,
      createdBy: req.user._id,
    }]);
    res.status(201).json({ subscription: sub.toObject(), secret });
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.get('/sales-channels', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const { default: InvSalesChannel } = await import('../models/inventory/InvSalesChannel.js');
    return sendList(res, await InvSalesChannel.find({ tenantId: req.user.tenantId }).lean());
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.post('/sales-channels', checkPermission('inventory', 'update'), async (req, res) => {
  try {
    const { default: InvSalesChannel } = await import('../models/inventory/InvSalesChannel.js');
    const [ch] = await InvSalesChannel.create([{
      tenantId: req.user.tenantId,
      platform: req.body.platform,
      name: req.body.name,
      warehouseId: req.body.warehouseId,
      status: 'paused',
      createdBy: req.user._id,
    }]);
    res.status(201).json(ch);
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.post('/sales-channels/:id/sync', checkPermission('inventory', 'update'), async (req, res) => {
  try {
    const { syncSalesChannel } = await import('../services/inventory/salesChannelSync.js');
    res.json(await syncSalesChannel(req.user.tenantId, req.params.id, { userId: req.user._id }));
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.get('/invoices/:invoiceId/lots', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const { getInvoiceLotLines } = await import('../services/inventory/invoiceLots.js');
    res.json(await getInvoiceLotLines(req.user.tenantId, req.params.invoiceId));
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.get('/report/reception', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const settings = await getInvSettings(req.user.tenantId);
    if (!(settings.receptionReportEnabled || settings.groupReceptionReport)) {
      return res.status(400).json({
        error: 'Reception report is disabled in settings',
        code: 'RECEPTION_REPORT_OFF',
      });
    }
    const { receptionReport } = await import('../services/inventory/reporting.js');
    res.json(await receptionReport(req.user.tenantId, {
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
      warehouseId: req.query.warehouseId,
      partnerId: req.query.partnerId,
      limit: req.query.limit,
    }));
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.get('/report/locations', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const { locationsReport } = await import('../services/inventory/reconciliation.js');
    res.json(await locationsReport(req.user.tenantId, {
      warehouseId: req.query.warehouseId,
      usage: req.query.usage || 'internal',
    }));
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.get('/report/reconcile', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const { reconcileInventory } = await import('../services/inventory/reconciliation.js');
    res.json(await reconcileInventory(req.user.tenantId, {
      warehouseId: req.query.warehouseId || null,
      productId: req.query.productId || null,
      includeCache: req.query.includeCache !== 'false',
      limit: Number(req.query.limit) || 500,
    }));
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.post('/report/reconcile/repair-cache', checkPermission('inventory', 'update'), async (req, res) => {
  try {
    const { repairStockCache, reconcileInventory } = await import('../services/inventory/reconciliation.js');
    const repair = await repairStockCache(req.user.tenantId, {
      productIds: req.body.productIds || null,
    });
    const after = await reconcileInventory(req.user.tenantId, {
      warehouseId: req.body.warehouseId || null,
      includeCache: true,
    });
    res.json({ repair, after });
  } catch (err) {
    handleInventoryError(res, err);
  }
});

// ── Universal Import / Export (v3 §2.2) ───────────────────────────

router.get('/ie/models', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const { listIeModels } = await import('../services/inventory/universalIe.js');
    res.json({ models: listIeModels() });
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.get('/ie/models/:model/fields', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const { flattenIeFields, getIeModel } = await import('../services/inventory/universalIe.js');
    const def = getIeModel(req.params.model);
    if (!def) return res.status(404).json({ error: 'Unknown model' });
    res.json({
      model: req.params.model,
      label: def.label,
      importable: def.importable !== false,
      defaultExport: def.defaultExport || [],
      fields: flattenIeFields(req.params.model, {
        importCompatible: req.query.importCompatible === '1' || req.query.importCompatible === 'true',
      }),
    });
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.post('/ie/export', checkPermission('inventory', 'read'), stockHeavyLimiter, async (req, res) => {
  try {
    const { universalExport } = await import('../services/inventory/universalIe.js');
    const result = await universalExport(req.user.tenantId, req.user._id, {
      model: req.body.model,
      fields: req.body.fields,
      importCompatible: !!req.body.importCompatible,
      format: req.body.format || 'csv',
      filters: req.body.filters || {},
      forceAsync: !!req.body.forceAsync,
      // Operators without accounting/cost permission do not get cost columns
      allowCost: req.user.role === 'admin'
        || req.user.role === 'owner'
        || !!req.user.permissions?.accounting
        || !!req.user.permissions?.inventory?.cost,
    });
    if (result.async) return res.status(202).json(result);
    if (req.body.download === false) return res.json(result);
    const buf = result.encoding === 'base64'
      ? Buffer.from(result.payload, 'base64')
      : Buffer.from(result.payload, 'utf8');
    res.setHeader('Content-Type', result.mime || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.setHeader('X-Row-Count', String(result.rowCount || 0));
    return res.send(buf);
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.get('/ie/export/jobs/:id', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const { getExportJob } = await import('../services/inventory/universalIe.js');
    const job = await getExportJob(req.user.tenantId, req.params.id);
    if (req.query.download === '1' && job.status === 'done' && job.payload) {
      const buf = job.payloadEncoding === 'base64'
        ? Buffer.from(job.payload, 'base64')
        : Buffer.from(job.payload, 'utf8');
      const mime = job.format === 'xlsx'
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : 'text/csv;charset=utf-8';
      res.setHeader('Content-Type', mime);
      res.setHeader('Content-Disposition', `attachment; filename="${job.filename || 'export.csv'}"`);
      return res.send(buf);
    }
    res.json({
      _id: job._id,
      model: job.model,
      format: job.format,
      status: job.status,
      rowCount: job.rowCount,
      filename: job.filename,
      error: job.error,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    });
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.post('/ie/import', checkPermission('inventory', 'create'), async (req, res) => {
  try {
    const { universalImport } = await import('../services/inventory/universalIe.js');
    res.json(await universalImport(req.user.tenantId, req.user._id, {
      model: req.body.model,
      csvText: req.body.csvText || req.body.csv,
      xlsxBase64: req.body.xlsxBase64,
      rows: req.body.rows,
      columnMap: req.body.columnMap,
      dryRun: req.body.dryRun !== false && req.body.dryRun !== '0',
      warehouseId: req.body.warehouseId,
    }));
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.get('/ie/templates', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const { listTemplates } = await import('../services/inventory/universalIe.js');
    return sendList(res, await listTemplates(req.user.tenantId, req.user._id, req.query.model));
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.post('/ie/templates', checkPermission('inventory', 'update'), async (req, res) => {
  try {
    const { saveTemplate } = await import('../services/inventory/universalIe.js');
    res.json(await saveTemplate(req.user.tenantId, req.user._id, req.body));
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.delete('/ie/templates/:id', checkPermission('inventory', 'update'), async (req, res) => {
  try {
    const { deleteTemplate } = await import('../services/inventory/universalIe.js');
    res.json(await deleteTemplate(req.user.tenantId, req.user._id, req.params.id));
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.get('/export/:collection', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const { exportCollection, csvTextToXlsxBuffer } = await import('../services/inventory/importExport.js');
    const { filename, csv } = await exportCollection(req.user.tenantId, req.params.collection, {
      warehouseId: req.query.warehouseId,
    });
    const format = String(req.query.format || 'csv').toLowerCase();
    if (format === 'xlsx' || format === 'xls') {
      const buf = await csvTextToXlsxBuffer(csv, req.params.collection);
      const xlsxName = filename.replace(/\.csv$/i, '.xlsx');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${xlsxName}"`);
      return res.send(buf);
    }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.post('/import/products', checkPermission('inventory', 'create'), async (req, res) => {
  try {
    const { importProducts } = await import('../services/inventory/importExport.js');
    const result = await importProducts(req.user.tenantId, req.user._id, {
      csvText: req.body.csvText || req.body.csv || '',
      xlsxBase64: req.body.xlsxBase64,
      dryRun: req.body.dryRun !== false && req.body.dryRun !== '0',
      warehouseId: req.body.warehouseId,
    });
    res.json(result);
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.post('/import/locations', checkPermission('inventory', 'create'), async (req, res) => {
  try {
    const { importLocations } = await import('../services/inventory/importExport.js');
    const result = await importLocations(req.user.tenantId, req.user._id, {
      csvText: req.body.csvText || req.body.csv || '',
      xlsxBase64: req.body.xlsxBase64,
      dryRun: req.body.dryRun !== false && req.body.dryRun !== '0',
      warehouseId: req.body.warehouseId,
    });
    res.json(result);
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.get('/exceptions', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const { listInventoryExceptions } = await import('../services/inventory/exceptions.js');
    const result = await listInventoryExceptions(req.user.tenantId, {
      limit: Number(req.query.limit) || 100,
    });
    return sendList(res, result.items, {
      total: result.total,
      appliedFilters: { limit: Number(req.query.limit) || 100 },
    });
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.post('/integrity/run', checkPermission('inventory', 'update'), stockHeavyLimiter, validateBody(integrityRunBody), async (req, res) => {
  try {
    if (req.query.async === '1' || req.validatedBody.async) {
      const { enqueueInventoryJob } = await import('../services/inventory/inventoryQueue.js');
      const q = await enqueueInventoryJob({
        jobType: 'integrity',
        tenantId: req.user.tenantId,
        userId: req.user._id,
        trigger: 'api',
        payload: { limit: req.validatedBody.limit },
      });
      return res.status(202).json({ data: q, ...q, async: true });
    }
    const { runIntegrityJob } = await import('../services/inventory/jobRunner.js');
    const { job, report } = await runIntegrityJob(req.user.tenantId, {
      trigger: 'manual',
      userId: req.user._id,
      limit: req.validatedBody.limit,
    });
    const payload = {
      jobId: job._id,
      status: job.status,
      durationMs: job.durationMs,
      failureCount: report.failureCount,
      checks: report.checks,
      failures: report.failures,
      ok: report.ok,
    };
    res.json({ data: payload, ...payload });
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.get('/integrity/latest', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const { latestIntegrityFailures } = await import('../services/inventory/jobRunner.js');
    res.json(await latestIntegrityFailures(req.user.tenantId, {
      limit: Number(req.query.limit) || 50,
    }));
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.get('/jobs', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const { listJobRuns } = await import('../services/inventory/jobRunner.js');
    const { inventoryQueueStats } = await import('../services/inventory/inventoryQueue.js');
    const result = await listJobRuns(req.user.tenantId, {
      jobType: req.query.jobType || undefined,
      limit: Number(req.query.limit) || 40,
    });
    const queue = await inventoryQueueStats();
    return sendList(res, result.items, {
      total: result.total,
      pageSize: Number(req.query.limit) || 40,
      appliedFilters: { jobType: req.query.jobType || null },
      links: { queue },
    });
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.post('/jobs/enqueue', checkPermission('inventory', 'update'), stockHeavyLimiter, async (req, res) => {
  try {
    const jobType = req.body?.jobType;
    const allowed = [
      'integrity', 'scheduler', 'cache_reconcile', 'reservation_retry',
      'expiry_alerts', 'cyclic_count', 'count_plan_due', 'delivery_notify',
    ];
    if (!allowed.includes(jobType)) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION',
          message: `jobType must be one of ${allowed.join(', ')}`,
          messageAr: 'نوع المهمة غير صالح',
        },
      });
    }
    const { enqueueInventoryJob } = await import('../services/inventory/inventoryQueue.js');
    const q = await enqueueInventoryJob({
      jobType,
      tenantId: req.user.tenantId,
      userId: req.user._id,
      trigger: 'api',
      payload: req.body?.payload || {},
    });
    res.status(202).json({ data: q, ...q });
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.get('/metrics', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const { getInvMetricsSnapshot } = await import('../services/inventory/invMetrics.js');
    const { inventoryQueueStats } = await import('../services/inventory/inventoryQueue.js');
    res.json({
      data: {
        ...getInvMetricsSnapshot(),
        queue: await inventoryQueueStats(),
      },
    });
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.get('/config-audit', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const { default: InvConfigAudit } = await import('../models/inventory/InvConfigAudit.js');
    const items = await InvConfigAudit.find({ tenantId: req.user.tenantId })
      .sort({ createdAt: -1 })
      .limit(Number(req.query.limit) || 50)
      .lean();
    return sendList(res, items);
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.get('/report/cache-assert', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const { assertProductStockCache } = await import('../services/inventory/syncProductCache.js');
    res.json(await assertProductStockCache(req.user.tenantId, {
      limit: Number(req.query.limit) || 500,
    }));
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.get('/barcode-nomenclatures', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const { default: InvBarcodeNomenclature } = await import('../models/inventory/InvBarcodeNomenclature.js');
    const items = await InvBarcodeNomenclature.find({ tenantId: req.user.tenantId }).lean();
    return sendList(res, items);
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.post('/barcode-nomenclatures', checkPermission('inventory', 'create'), async (req, res) => {
  try {
    const { default: InvBarcodeNomenclature } = await import('../models/inventory/InvBarcodeNomenclature.js');
    const doc = await InvBarcodeNomenclature.create({
      tenantId: req.user.tenantId,
      name: req.body.name || 'Default',
      nameAr: req.body.nameAr,
      isDefault: !!req.body.isDefault,
      rules: req.body.rules || [
        { name: 'EAN-13', pattern: '^\\d{13}$', type: 'product', sequence: 10 },
        { name: 'Lot prefix', pattern: '^LOT', type: 'lot', sequence: 20 },
      ],
      createdBy: req.user._id,
    });
    res.status(201).json(doc);
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.post('/barcode-nomenclatures/:id/test', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const { default: InvBarcodeNomenclature, matchBarcode } = await import('../models/inventory/InvBarcodeNomenclature.js');
    const nom = await InvBarcodeNomenclature.findOne({ _id: req.params.id, tenantId: req.user.tenantId }).lean();
    if (!nom) return res.status(404).json({ error: 'Not found' });
    res.json(matchBarcode(nom, req.body.barcode || ''));
  } catch (err) {
    handleInventoryError(res, err);
  }
});

// ── Print / PDF (v4.1 P2) ─────────────────────────────────────────

router.get('/print/layouts', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const { PRINT_LAYOUTS } = await import('../services/inventory/invPrint.js');
    res.json({ layouts: PRINT_LAYOUTS });
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.get('/print/jobs', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const InvPrintJob = (await import('../models/inventory/InvPrintJob.js')).default;
    const { toObjectId } = await import('../models/inventory/common.js');
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const jobs = await InvPrintJob.find({ tenantId: toObjectId(req.user.tenantId) })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    res.json({ jobs });
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.post('/print', checkPermission('inventory', 'read'), stockHeavyLimiter, async (req, res) => {
  try {
    const { renderInventoryPdf, renderZplLabel } = await import('../services/inventory/invPrint.js');
    const InvPrintJob = (await import('../models/inventory/InvPrintJob.js')).default;
    const { toObjectId } = await import('../models/inventory/common.js');
    if (req.body.format === 'zpl') {
      const zpl = renderZplLabel({
        title: req.body.title,
        barcode: req.body.barcode,
        line2: req.body.line2,
      });
      res.setHeader('Content-Type', 'application/zpl');
      res.setHeader('Content-Disposition', 'attachment; filename="label.zpl"');
      return res.send(zpl);
    }

    const layout = req.body.layout;
    const printJob = await InvPrintJob.create({
      tenantId: toObjectId(req.user.tenantId),
      userId: req.user._id,
      layout,
      status: 'pending',
      lang: req.body.lang || 'ar',
      transferIds: [
        ...(req.body.transferIds || []),
        ...(req.body.transferId ? [req.body.transferId] : []),
      ].filter(Boolean),
      productIds: req.body.productIds || [],
      locationIds: req.body.locationIds || [],
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    }).catch(() => null);

    try {
      const buf = await renderInventoryPdf(req.user.tenantId, {
        layout,
        transferId: req.body.transferId,
        transferIds: req.body.transferIds,
        locationIds: req.body.locationIds,
        productIds: req.body.productIds,
        lotIds: req.body.lotIds,
        packageIds: req.body.packageIds,
        copies: req.body.copies,
        labelPreset: req.body.labelPreset,
        labelItems: req.body.labelItems || [],
        filters: req.body.filters || {},
        lang: req.body.lang || 'ar',
        showPrices: !!req.body.showPrices,
      });
      if (printJob?._id) {
        await InvPrintJob.updateOne(
          { _id: printJob._id },
          {
            $set: {
              status: 'done',
              filename: `${layout || 'document'}.pdf`,
              bytes: buf.length,
            },
          },
        ).catch(() => {});
      }
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${layout || 'document'}.pdf"`);
      if (printJob?._id) res.setHeader('X-Print-Job-Id', String(printJob._id));
      return res.send(buf);
    } catch (err) {
      if (printJob?._id) {
        await InvPrintJob.updateOne(
          { _id: printJob._id },
          { $set: { status: 'failed', error: err.message || String(err) } },
        ).catch(() => {});
      }
      throw err;
    }
  } catch (err) {
    handleInventoryError(res, err);
  }
});

router.get('/ie/import-template/:model', checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const { flattenIeFields, getIeModel } = await import('../services/inventory/ieRegistry.js');
    const { rowsToCsv, csvTextToXlsxBuffer } = await import('../services/inventory/importExport.js');
    const model = req.params.model;
    const def = getIeModel(model);
    if (!def || def.importable === false) return res.status(404).json({ error: 'Unknown or non-importable model' });
    const fields = flattenIeFields(model, { importCompatible: true });
    const headers = fields.map((f) => f.path);
    const example = {};
    for (const f of fields) {
      example[f.path] = f.example || (f.required ? `(required)` : '');
    }
    const csv = rowsToCsv([example], headers, { bom: true });
    const notes = fields.map((f) => ({
      field: f.path,
      required: f.required ? 'yes' : '',
      type: f.type || '',
      enum: (f.enumValues || []).join('|'),
      help: f.help || '',
    }));
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();
    const dataSheet = XLSX.utils.aoa_to_sheet([headers, headers.map((h) => example[h] || '')]);
    XLSX.utils.book_append_sheet(wb, dataSheet, 'Template');
    const notesSheet = XLSX.utils.json_to_sheet(notes);
    XLSX.utils.book_append_sheet(wb, notesSheet, 'Info');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${model}-import-template.xlsx"`);
    return res.send(buf);
  } catch (err) {
    handleInventoryError(res, err);
  }
});

export default router;
